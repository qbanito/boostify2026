/**
 * Artist Superstar Blueprint Routes
 *
 * POST /api/artist-blueprint/:artistId/generate  — genera o regenera el blueprint
 * GET  /api/artist-blueprint/:artistId            — obtiene el blueprint guardado
 */

import { Router, Request, Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { db as pgDb } from '../../db';
import { users, artistBlueprints } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateArtistBlueprint } from '../services/artist-blueprint-generator';

const router = Router();

// ─── Helper: verify ownership ─────────────────────────────────────────────────

async function verifyArtistOwnership(
  artistId: number,
  clerkUserId: string,
  resolvedPgId?: number,
): Promise<{ allowed: boolean; pgUserId?: number; error?: string }> {
  // If clerkAuthMiddleware already resolved the pgId, use it directly
  // to avoid failing when clerk_id column is null (users created before Clerk)
  let pgUserId: number | undefined = resolvedPgId;
  let callerEmail = '';

  if (pgUserId) {
    // Already resolved — just fetch email for admin check
    const [callerRow] = await pgDb
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, pgUserId))
      .limit(1);
    callerEmail = callerRow?.email ?? '';
  } else {
    // Fall back: look up by clerkId
    const callerRows = await pgDb
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (callerRows.length === 0) {
      return { allowed: false, error: 'User not found' };
    }
    pgUserId = callerRows[0].id;
    callerEmail = callerRows[0].email ?? '';
  }

  // Admin bypass
  const { isAdminEmail } = await import('../../shared/constants');
  if (isAdminEmail(callerEmail)) {
    return { allowed: true, pgUserId };
  }

  // Fetch artist and check ownership
  const artistRows = await pgDb
    .select({ id: users.id, generatedBy: users.generatedBy })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  if (artistRows.length === 0) {
    return { allowed: false, error: 'Artist not found' };
  }

  const artist = artistRows[0];
  const isOwner = artist.id === pgUserId || artist.generatedBy === pgUserId;

  return { allowed: isOwner, pgUserId, error: isOwner ? undefined : 'Not authorized for this artist' };
}

// ─── POST /api/artist-blueprint/:artistId/generate ───────────────────────────

/**
 * Generates (or regenerates) the Superstar Blueprint for an artist.
 * Streams progressive status updates via polling — the client should poll
 * GET /:artistId while status === 'generating'.
 */
router.post('/:artistId/generate', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    // Clerk string ID for ownership lookup
    const clerkUserId = (req as any).user?.clerkUserId ?? (req as any).user?.uid ?? '';
    // Pre-resolved integer pgId (set by clerkAuthMiddleware — avoids second DB lookup)
    const resolvedPgId = typeof (req as any).user?.id === 'number' ? (req as any).user.id as number : undefined;
    if (!clerkUserId && !resolvedPgId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify ownership
    const { allowed, pgUserId, error: ownerError } = await verifyArtistOwnership(artistId, clerkUserId, resolvedPgId);
    if (!allowed) {
      return res.status(403).json({ error: ownerError || 'Forbidden' });
    }

    // Check if a blueprint is already being generated (prevent duplicate calls).
    // A stale "generating" row (older than STALE_MS) means a previous run was
    // interrupted (server restart / crash / hang) — we treat it as recoverable
    // and allow a fresh generation instead of blocking forever with a 409.
    const STALE_MS = 4 * 60 * 1000; // 4 minutes
    const existing = await pgDb
      .select({
        id: artistBlueprints.id,
        generationStatus: artistBlueprints.generationStatus,
        updatedAt: artistBlueprints.updatedAt,
      })
      .from(artistBlueprints)
      .where(eq(artistBlueprints.artistId, artistId))
      .limit(1);

    if (existing.length > 0 && existing[0].generationStatus === 'generating') {
      const updatedMs = existing[0].updatedAt ? new Date(existing[0].updatedAt).getTime() : 0;
      const isStale = Date.now() - updatedMs > STALE_MS;
      if (!isStale) {
        return res.status(409).json({
          error: 'Blueprint generation already in progress',
          status: 'generating',
        });
      }
      console.warn(
        `[artist-blueprint] Stale 'generating' row for artist ${artistId} (last update ${Math.round((Date.now() - updatedMs) / 1000)}s ago) — restarting generation`,
      );
    }

    // Upsert row with status = generating so frontend can poll
    if (existing.length === 0) {
      await pgDb.insert(artistBlueprints).values({
        artistId,
        version: '2.0',
        blueprintJson: {},
        generationStatus: 'generating',
      });
    } else {
      await pgDb
        .update(artistBlueprints)
        .set({ generationStatus: 'generating', generationError: null, updatedAt: new Date() })
        .where(eq(artistBlueprints.artistId, artistId));
    }

    // Respond immediately so client can poll
    res.status(202).json({ success: true, status: 'generating', artistId });

    // Run generation in background (no await in response path)
    setImmediate(async () => {
      try {
        console.log(`[artist-blueprint] Starting generation for artist ${artistId}`);
        // Watchdog: never let a single run hang forever. If the AI cascade or
        // brand-profile generation stalls, fail gracefully so the row leaves
        // the 'generating' state and the user can retry.
        const GENERATION_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
        const blueprint = await Promise.race([
          generateArtistBlueprint(artistId),
          new Promise<never>((_, reject) =>
            setTimeout(
              () => reject(new Error('Blueprint generation timed out after 3 minutes')),
              GENERATION_TIMEOUT_MS,
            ),
          ),
        ]);

        const score = blueprint._meta?.global_artist_score ?? null;
        const era = blueprint.era_evolution?.current_era ?? null;
        const genre = blueprint.artist_dna?.primary_genre ?? null;
        const archetype = blueprint.identity?.brand_archetype ?? null;

        await pgDb
          .update(artistBlueprints)
          .set({
            blueprintJson: blueprint as any,
            generationStatus: 'completed',
            globalArtistScore: score,
            currentEra: era,
            primaryGenre: genre,
            brandArchetype: archetype,
            generatedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(artistBlueprints.artistId, artistId));

        console.log(`[artist-blueprint] ✅ Blueprint completed for artist ${artistId} — score: ${score}`);
      } catch (genErr) {
        const errMsg = genErr instanceof Error ? genErr.message : 'Unknown error';
        console.error(`[artist-blueprint] ❌ Generation failed for artist ${artistId}:`, errMsg);
        await pgDb
          .update(artistBlueprints)
          .set({
            generationStatus: 'failed',
            generationError: errMsg,
            updatedAt: new Date(),
          })
          .where(eq(artistBlueprints.artistId, artistId))
          .catch(() => {});
      }
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[artist-blueprint] POST /generate error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
});

// ─── GET /api/artist-blueprint/:artistId ─────────────────────────────────────
// Public endpoint — anyone can read a blueprint (no auth required)
// Only generation/regeneration requires ownership.

router.get('/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const rows = await pgDb
      .select()
      .from(artistBlueprints)
      .where(eq(artistBlueprints.artistId, artistId))
      .limit(1);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'No blueprint found for this artist', hasBlueprint: false });
    }

    const row = rows[0];
    return res.status(200).json({
      success: true,
      hasBlueprint: row.generationStatus === 'completed',
      status: row.generationStatus,
      blueprintId: row.id,
      globalArtistScore: row.globalArtistScore,
      currentEra: row.currentEra,
      primaryGenre: row.primaryGenre,
      brandArchetype: row.brandArchetype,
      generatedAt: row.generatedAt,
      blueprint: row.generationStatus === 'completed' ? row.blueprintJson : null,
      error: row.generationError,
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[artist-blueprint] GET error:', errMsg);
    return res.status(500).json({ error: errMsg });
  }
});

export default router;
