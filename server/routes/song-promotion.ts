/**
 * 🎵 Song Promotion · public-ish endpoints
 *
 * Mount: /api/song-promotion
 *
 * Provides:
 *  - POST /ensure-pg-song { firestoreId } → { pgId }
 *      Lazily creates a Postgres shadow row for a Firestore-only song so the
 *      Admin Song Analyzer / Promote modal pipeline can operate on it.
 */
import { Router, type Request, type Response } from 'express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { db } from '../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { ensurePgSongFromFirestore } from '../services/firestore-song-sync';
import { logger } from '../utils/logger';

const router = Router();

// POST /ensure-pg-song · body: { firestoreId }
router.post('/ensure-pg-song', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const firestoreId = String(req.body?.firestoreId || '').trim();
    if (!firestoreId) {
      return res.status(400).json({ ok: false, error: 'firestoreId required' });
    }

    // Resolve requester Postgres user.id from Clerk session
    const clerkUserId = (req as any).user?.clerkUserId || (req as any).user?.id;
    if (!clerkUserId) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }
    const [pgUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!pgUser) {
      return res.status(404).json({ ok: false, error: 'User not found in Postgres' });
    }

    const result = await ensurePgSongFromFirestore({
      firestoreId,
      requesterUserId: pgUser.id,
    });

    res.json({ ok: true, pgId: result.pgId, created: result.created });
  } catch (err: any) {
    logger.error('[SongPromotion] /ensure-pg-song failed:', err?.message);
    res.status(500).json({ ok: false, error: err?.message || 'Internal error' });
  }
});

export default router;
