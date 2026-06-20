/**
 * Song DNA — Saved analyses
 * ---------------------------------------------------------
 * GET    /api/song-dna/saved          — list current user's saved analyses
 * POST   /api/song-dna/save           — save/upsert an analysis snapshot
 * GET    /api/song-dna/saved/:id      — single analysis
 * DELETE /api/song-dna/saved/:id      — remove analysis
 * PATCH  /api/song-dna/saved/:id      — update notes
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { songDnaAnalyses, users } from '../db/schema';
import { and, desc, eq, or } from 'drizzle-orm';
import { isAuthenticated } from '../middleware/clerk-auth';

const router = Router();

async function getUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

router.get('/saved', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const uid = await getUserPgId(req);
    if (!uid) return res.status(401).json({ success: false, error: 'User not found' });
    const rows = await db.select().from(songDnaAnalyses)
      .where(eq(songDnaAnalyses.userId, uid))
      .orderBy(desc(songDnaAnalyses.updatedAt));
    res.json({ success: true, analyses: rows });
  } catch (e: any) {
    console.error('[SongDnaSaved] list error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/saved/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const uid = await getUserPgId(req);
    if (!uid) return res.status(401).json({ success: false, error: 'User not found' });
    const id = parseInt(req.params.id);
    const [row] = await db.select().from(songDnaAnalyses)
      .where(and(eq(songDnaAnalyses.id, id), eq(songDnaAnalyses.userId, uid)))
      .limit(1);
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, analysis: row });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/save', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const uid = await getUserPgId(req);
    if (!uid) return res.status(401).json({ success: false, error: 'User not found' });

    const b = req.body || {};
    if (!b.spotifyTrackId || !b.title) {
      return res.status(400).json({ success: false, error: 'spotifyTrackId and title are required' });
    }

    // Upsert by (userId, spotifyTrackId)
    const [existing] = await db.select({ id: songDnaAnalyses.id }).from(songDnaAnalyses)
      .where(and(eq(songDnaAnalyses.userId, uid), eq(songDnaAnalyses.spotifyTrackId, b.spotifyTrackId)))
      .limit(1);

    const payload = {
      userId: uid,
      spotifyTrackId: String(b.spotifyTrackId),
      title: String(b.title),
      artistName: b.artistName ?? null,
      albumName: b.albumName ?? null,
      isrc: b.isrc ?? null,
      imageUrl: b.imageUrl ?? null,
      previewUrl: b.previewUrl ?? null,
      durationMs: b.durationMs ?? null,
      explicit: Boolean(b.explicit),
      mood: b.mood ?? null,
      genres: Array.isArray(b.genres) ? b.genres : [],
      audioFeatures: b.audioFeatures ?? null,
      performance: b.performance ?? null,
      demographics: b.demographics ?? null,
      marketPotential: b.marketPotential ?? null,
      hitPotential: b.hitPotential ?? null,
      crossPlatform: b.crossPlatform ?? null,
      notes: b.notes ?? null,
    };

    if (existing) {
      const [row] = await db.update(songDnaAnalyses)
        .set({ ...payload, updatedAt: new Date() })
        .where(eq(songDnaAnalyses.id, existing.id))
        .returning();
      return res.json({ success: true, analysis: row, updated: true });
    }

    const [row] = await db.insert(songDnaAnalyses).values(payload).returning();
    res.json({ success: true, analysis: row, created: true });
  } catch (e: any) {
    console.error('[SongDnaSaved] save error:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

router.patch('/saved/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const uid = await getUserPgId(req);
    if (!uid) return res.status(401).json({ success: false, error: 'User not found' });
    const id = parseInt(req.params.id);
    const { notes } = req.body || {};
    const [row] = await db.update(songDnaAnalyses)
      .set({ notes: notes ?? null, updatedAt: new Date() })
      .where(and(eq(songDnaAnalyses.id, id), eq(songDnaAnalyses.userId, uid)))
      .returning();
    if (!row) return res.status(404).json({ success: false, error: 'Not found' });
    res.json({ success: true, analysis: row });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.delete('/saved/:id', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const uid = await getUserPgId(req);
    if (!uid) return res.status(401).json({ success: false, error: 'User not found' });
    const id = parseInt(req.params.id);
    await db.delete(songDnaAnalyses)
      .where(and(eq(songDnaAnalyses.id, id), eq(songDnaAnalyses.userId, uid)));
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
