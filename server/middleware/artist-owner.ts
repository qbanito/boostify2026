/**
 * Shared artist-ownership guard.
 *
 * Verifies that the authenticated caller owns (or is admin over) the artist
 * referenced by req.params.artistId. Mirrors the battle-tested pattern from
 * aas-core.ts so every artist-scoped module (Ads Campaigns, Avatar Talk,
 * Facebook Groups, Influencer Studio…) enforces the same access control.
 *
 * artistId may be a numeric pg id, a slug, or a firestore uid — all resolved
 * against the users table (same lookup strategy as avatar-talk's
 * fetchArtistIdentity).
 *
 * Usage:  router.post('/:artistId/thing', authenticate, requireArtistOwnerParam, handler)
 * The route MUST run an auth middleware first so req.user is populated.
 */

import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { db as firestoreDb } from '../firebase';
import { users } from '../../db/schema';
import { eq, or } from 'drizzle-orm';
import { isAdminEmail } from '../../shared/constants';

export interface OwnershipResult {
  allowed: boolean;
  pgUserId?: number;
  artistPgId?: number;
  error?: string;
}

/** Resolve an artist users row from a flexible identifier (pg id | slug | firestore uid). */
async function resolveArtistRow(artistId: string) {
  const trimmed = String(artistId || '').trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) {
    const [row] = await db
      .select({ id: users.id, generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, Number(trimmed)))
      .limit(1);
    if (row) return row;
  }
  const [row] = await db
    .select({ id: users.id, generatedBy: users.generatedBy })
    .from(users)
    .where(or(eq(users.slug, trimmed), eq(users.firestoreId, trimmed), eq(users.clerkId, trimmed)))
    .limit(1);
  return row ?? null;
}

/**
 * Core check: does the caller (pg id / clerk id / email on req.user) own the
 * artist `artistId`? Owner = same user OR the user that generated the
 * AI artist (users.generated_by). Admins always pass.
 */
export async function verifyArtistOwner(req: Request, artistId: string): Promise<OwnershipResult> {
  const u: any = (req as any).user || {};
  const callerEmail: string = (u.email || '').toLowerCase();
  if (callerEmail && isAdminEmail(callerEmail)) return { allowed: true };

  let pgUserId: number | undefined = typeof u.id === 'number' ? u.id : undefined;

  if (pgUserId === undefined) {
    // Resolve via clerk uid or email
    const clerkId: string = u.uid || u.clerkUserId || '';
    if (!clerkId && !callerEmail) return { allowed: false, error: 'Authentication required' };
    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(clerkId ? eq(users.clerkId, clerkId) : eq(users.email, callerEmail))
      .limit(1);
    if (!row) return { allowed: false, error: 'User not found' };
    pgUserId = row.id;
  }

  const artist = await resolveArtistRow(artistId);
  if (!artist) {
    // Fallback: artist may only exist in Firestore (uid docs). Allow if that
    // Firestore user doc belongs to the caller (uid or email match).
    const fsOwned = await firestoreUserOwnedBy(artistId, u);
    if (fsOwned === null) return { allowed: false, pgUserId, error: 'Artist not found' };
    return {
      allowed: fsOwned,
      pgUserId,
      error: fsOwned ? undefined : 'Not authorized for this artist',
    };
  }

  const isOwner = artist.id === pgUserId || artist.generatedBy === pgUserId;
  return {
    allowed: isOwner,
    pgUserId,
    artistPgId: artist.id,
    error: isOwner ? undefined : 'Not authorized for this artist',
  };
}

/**
 * Firestore fallback ownership: returns true/false when a Firestore user doc
 * exists for the id (owner = matching uid, clerk id, or email), or null when
 * no doc exists at all.
 */
async function firestoreUserOwnedBy(artistId: string, caller: any): Promise<boolean | null> {
  try {
    const uid: string = caller?.uid || caller?.clerkUserId || '';
    const email: string = (caller?.email || '').toLowerCase();

    const byDoc = await firestoreDb.collection('users').doc(artistId).get();
    let data: any = byDoc.exists ? byDoc.data() : null;
    if (!data) {
      const byUid = await firestoreDb.collection('users').where('uid', '==', artistId).limit(1).get();
      if (!byUid.empty) data = byUid.docs[0].data();
    }
    if (!data) return null;

    const docUid = String(data.uid || '');
    const docEmail = String(data.email || '').toLowerCase();
    return Boolean((uid && docUid && docUid === uid) || (email && docEmail && docEmail === email));
  } catch (error: any) {
    console.warn('[artist-owner] firestore fallback failed:', error?.message);
    return null;
  }
}

/**
 * Express middleware: enforces ownership of req.params.artistId.
 * Responds 400/401/403/404 on failure, otherwise calls next().
 * Attaches the resolved artist pg id at (req as any).artistPgId.
 */
export async function requireArtistOwnerParam(req: Request, res: Response, next: NextFunction) {
  try {
    const artistId = String(req.params.artistId || '').trim();
    if (!artistId) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }
    const result = await verifyArtistOwner(req, artistId);
    if (!result.allowed) {
      const status = result.error === 'Artist not found' ? 404
        : result.error === 'Authentication required' ? 401 : 403;
      return res.status(status).json({ success: false, error: result.error || 'Forbidden' });
    }
    (req as any).artistPgId = result.artistPgId;
    next();
  } catch (error: any) {
    console.error('[artist-owner] guard error:', error?.message);
    return res.status(500).json({ success: false, error: 'Ownership check failed' });
  }
}
