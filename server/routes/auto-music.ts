/**
 * Music Auto-Pilot routes — /api/music-auto
 *
 * Lets an artist configure ACTIVE music generation: schedules that use
 * their existing songs as references to auto-generate new singles/EPs/albums
 * on a cadence (daily/weekly/biweekly/monthly), plus run-now and history.
 */

import { Router, Response } from 'express';
import { db } from '../db';
import { songs, musicAutoSchedules, musicAutoRuns } from '../db/schema';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import {
  runAutoMusicJob,
  computeNextRun,
  defaultSongsForType,
  type AutoCadence,
} from '../services/auto-music-scheduler';

const router = Router();

const CADENCES = ['daily', 'weekly', 'biweekly', 'monthly'] as const;
const RELEASE_TYPES = ['single', 'ep', 'album'] as const;

// GET /api/music-auto/my-songs — minimal catalog list for picking references
router.get('/my-songs', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const rows = await db
      .select({
        id: songs.id,
        title: songs.title,
        genre: songs.genre,
        mood: songs.mood,
        coverArt: songs.coverArt,
        createdAt: songs.createdAt,
      })
      .from(songs)
      .where(and(eq(songs.userId, userId), eq(songs.isPublished, true)))
      .orderBy(desc(songs.createdAt))
      .limit(100);
    res.json({ success: true, songs: rows });
  } catch (err: any) {
    console.error('[Auto-Music] my-songs error:', err?.message);
    res.status(500).json({ success: false, message: 'Error loading songs' });
  }
});

// GET /api/music-auto/schedules — all schedules + recent runs for the artist
router.get('/schedules', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const schedules = await db
      .select()
      .from(musicAutoSchedules)
      .where(eq(musicAutoSchedules.userId, userId))
      .orderBy(desc(musicAutoSchedules.createdAt));

    const runs = await db
      .select()
      .from(musicAutoRuns)
      .where(eq(musicAutoRuns.userId, userId))
      .orderBy(desc(musicAutoRuns.startedAt))
      .limit(20);

    res.json({ success: true, schedules, runs });
  } catch (err: any) {
    console.error('[Auto-Music] schedules error:', err?.message);
    res.status(500).json({ success: false, message: 'Error loading schedules' });
  }
});

// POST /api/music-auto/schedules — create or update a schedule
router.post('/schedules', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const {
      id,
      enabled,
      cadence,
      releaseType,
      songsPerRun,
      referenceSongIds,
      styleNotes,
      autoPublish,
      generateCover,
    } = req.body || {};

    if (cadence && !CADENCES.includes(cadence)) {
      return res.status(400).json({ success: false, message: `cadence must be one of: ${CADENCES.join(', ')}` });
    }
    if (releaseType && !RELEASE_TYPES.includes(releaseType)) {
      return res.status(400).json({ success: false, message: `releaseType must be one of: ${RELEASE_TYPES.join(', ')}` });
    }

    // Validate reference songs belong to this artist
    let refs: number[] | null = null;
    if (Array.isArray(referenceSongIds) && referenceSongIds.length > 0) {
      const ids = referenceSongIds.map((n: any) => parseInt(String(n), 10)).filter((n: number) => Number.isFinite(n));
      if (ids.length > 0) {
        const owned = await db
          .select({ id: songs.id })
          .from(songs)
          .where(and(eq(songs.userId, userId), inArray(songs.id, ids)));
        refs = owned.map(r => r.id);
        if (refs.length !== ids.length) {
          return res.status(400).json({ success: false, message: 'Some reference songs do not belong to this artist' });
        }
      }
    }

    const resolvedType = (releaseType || 'single') as typeof RELEASE_TYPES[number];
    const resolvedCadence = (cadence || 'weekly') as AutoCadence;
    const perRun = Math.max(1, Math.min(10, parseInt(String(songsPerRun), 10) || defaultSongsForType(resolvedType)));

    const values = {
      enabled: enabled !== false,
      cadence: resolvedCadence,
      releaseType: resolvedType,
      songsPerRun: perRun,
      referenceSongIds: refs,
      styleNotes: typeof styleNotes === 'string' ? styleNotes.slice(0, 2000) : null,
      autoPublish: autoPublish !== false,
      generateCover: generateCover !== false,
      updatedAt: new Date(),
    };

    if (id) {
      // Update — must own the schedule
      const [existing] = await db
        .select()
        .from(musicAutoSchedules)
        .where(and(eq(musicAutoSchedules.id, parseInt(String(id), 10)), eq(musicAutoSchedules.userId, userId)))
        .limit(1);
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Schedule not found' });
      }
      const [updated] = await db
        .update(musicAutoSchedules)
        .set({
          ...values,
          // Re-anchor next run when cadence changed or schedule re-enabled without one
          nextRunAt:
            existing.cadence !== resolvedCadence || !existing.nextRunAt
              ? computeNextRun(resolvedCadence)
              : existing.nextRunAt,
        })
        .where(eq(musicAutoSchedules.id, existing.id))
        .returning();
      return res.json({ success: true, schedule: updated });
    }

    const [created] = await db
      .insert(musicAutoSchedules)
      .values({
        userId,
        ...values,
        nextRunAt: computeNextRun(resolvedCadence),
      })
      .returning();

    res.json({ success: true, schedule: created });
  } catch (err: any) {
    console.error('[Auto-Music] save schedule error:', err?.message);
    res.status(500).json({ success: false, message: 'Error saving schedule' });
  }
});

// DELETE /api/music-auto/schedules/:id
router.delete('/schedules/:id', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const deleted = await db
      .delete(musicAutoSchedules)
      .where(and(eq(musicAutoSchedules.id, id), eq(musicAutoSchedules.userId, userId)))
      .returning({ id: musicAutoSchedules.id });

    if (deleted.length === 0) return res.status(404).json({ success: false, message: 'Schedule not found' });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[Auto-Music] delete schedule error:', err?.message);
    res.status(500).json({ success: false, message: 'Error deleting schedule' });
  }
});

// POST /api/music-auto/schedules/:id/run-now — fire a generation run immediately
router.post('/schedules/:id/run-now', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ success: false, message: 'Invalid id' });

    const [schedule] = await db
      .select()
      .from(musicAutoSchedules)
      .where(and(eq(musicAutoSchedules.id, id), eq(musicAutoSchedules.userId, userId)))
      .limit(1);
    if (!schedule) return res.status(404).json({ success: false, message: 'Schedule not found' });
    if (schedule.lastRunStatus === 'running') {
      return res.status(409).json({ success: false, message: 'A run is already in progress for this schedule' });
    }

    // Fire-and-forget — generation can take several minutes per song
    runAutoMusicJob(id).catch((err: any) =>
      console.error(`[Auto-Music] run-now job error for schedule #${id}:`, err?.message),
    );

    res.json({ success: true, status: 'running', message: 'Generation started — new songs will appear in your profile shortly' });
  } catch (err: any) {
    console.error('[Auto-Music] run-now error:', err?.message);
    res.status(500).json({ success: false, message: 'Error starting run' });
  }
});

export default router;
