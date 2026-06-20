/**
 * Artist Hermes Proxy — Clerk-authenticated frontend facade over /api/hermes
 *
 * The raw /api/hermes/* routes require x-hermes-secret header (server-to-server).
 * This router exposes the same data to the authenticated frontend user via
 * Clerk session auth, so the secret is never sent to the browser.
 *
 * Mounted at: /api/artist-hermes
 */

import { Router } from 'express';
import { requireAuth } from '../middleware/clerk-auth';
import { exportArtistHermesProfile } from '../services/hermes-memory';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ── Ownership guard ────────────────────────────────────────────────────────────
// Confirms the requesting user owns the given pgId (numeric artist id).
async function isArtistOwner(clerkId: string, artistPgId: number): Promise<boolean> {
  try {
    const [artist] = await db
      .select({ id: users.id, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.id, artistPgId))
      .limit(1);
    return !!artist && artist.clerkId === clerkId;
  } catch {
    return false;
  }
}

// ── GET /api/artist-hermes/:id/status ─────────────────────────────────────────
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = (req as any).auth?.userId;
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      status: 'ok',
      agentName: 'Hermes',
      capabilities: ['memory', 'goals', 'soul', 'blueprint', 'songs', 'content-calendar', 'weekly-check', 'competitor-analysis'],
      integration: 'active',
      artistId,
    });
  } catch (err) {
    console.error('[hermes-proxy] status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /api/artist-hermes/:id/profile ────────────────────────────────────────
router.get('/:id/profile', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = (req as any).auth?.userId;
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const profile = await exportArtistHermesProfile(artistId);
    res.json({ success: true, ...profile });
  } catch (err) {
    console.error('[hermes-proxy] profile error:', err);
    res.status(500).json({ error: 'Failed to load Hermes profile' });
  }
});

// ── GET /api/artist-hermes/:id/memory ─────────────────────────────────────────
router.get('/:id/memory', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = (req as any).auth?.userId;
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { memory } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, memory });
  } catch (err) {
    console.error('[hermes-proxy] memory error:', err);
    res.status(500).json({ error: 'Failed to load memory' });
  }
});

// ── GET /api/artist-hermes/:id/soul ───────────────────────────────────────────
router.get('/:id/soul', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = (req as any).auth?.userId;
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { soul } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, soul });
  } catch (err) {
    console.error('[hermes-proxy] soul error:', err);
    res.status(500).json({ error: 'Failed to load soul' });
  }
});

// ── GET /api/artist-hermes/:id/goals ──────────────────────────────────────────
router.get('/:id/goals', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = (req as any).auth?.userId;
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { goals } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, goals });
  } catch (err) {
    console.error('[hermes-proxy] goals error:', err);
    res.status(500).json({ error: 'Failed to load goals' });
  }
});

export default router;
