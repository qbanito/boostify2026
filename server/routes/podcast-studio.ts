/**
 * Podcast Studio API Routes
 * CRUD for sessions, participants, stream destinations, recordings, episodes
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  podcastSessions, podcastParticipants, streamDestinations,
  podcastRecordings, podcastEpisodes
} from '../db/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getRoomViewerCount } from '../socket';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// Ensure uploads directory exists
const RECORDINGS_DIR = path.join(process.cwd(), 'uploads', 'podcast-recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

const recordingUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, RECORDINGS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.webm';
      cb(null, `rec_${nanoid(12)}_${Date.now()}${ext}`);
    }
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 }, // 2GB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['video/webm', 'audio/webm', 'video/mp4', 'audio/ogg', 'audio/mp4'];
    cb(null, allowed.includes(file.mimetype));
  }
});

// ── CREATE SESSION ──
router.post('/sessions', async (req: Request, res: Response) => {
  try {
    const { userId, title, description, coverImage, sessionType, maxParticipants, layout, settings, scheduledAt } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: 'userId and title are required' });
    }

    const roomCode = nanoid(8);
    const [session] = await db.insert(podcastSessions).values({
      hostUserId: userId,
      title,
      description: description || null,
      coverImage: coverImage || null,
      sessionType: sessionType || 'podcast',
      status: 'setup',
      roomCode,
      maxParticipants: maxParticipants || 6,
      layout: layout || 'solo',
      settings: settings || { allowChat: true, allowQuestions: true, allowReactions: true, autoRecord: false, showLowerThirds: true },
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    }).returning();

    res.json(session);
  } catch (error: any) {
    console.error('Error creating podcast session:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET USER SESSIONS ──
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const sessions = await db
      .select()
      .from(podcastSessions)
      .where(eq(podcastSessions.hostUserId, userId))
      .orderBy(desc(podcastSessions.createdAt));

    res.json(sessions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET SESSION BY ROOM CODE ──
router.get('/sessions/room/:roomCode', async (req: Request, res: Response) => {
  try {
    const [session] = await db
      .select()
      .from(podcastSessions)
      .where(eq(podcastSessions.roomCode, req.params.roomCode));

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const participants = await db
      .select()
      .from(podcastParticipants)
      .where(eq(podcastParticipants.sessionId, session.id));

    const viewerCount = getRoomViewerCount(session.roomCode);

    res.json({ ...session, participants, viewerCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET SESSION BY ID ──
router.get('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .select()
      .from(podcastSessions)
      .where(eq(podcastSessions.id, id));

    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── UPDATE SESSION ──
router.patch('/sessions/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    // Whitelist allowed fields to prevent injection
    const allowedFields = ['title', 'description', 'coverImage', 'sessionType', 'status', 'layout', 'maxParticipants', 'settings', 'scheduledAt'] as const;
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    const [session] = await db
      .update(podcastSessions)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(podcastSessions.id, id))
      .returning();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GO LIVE ──
router.post('/sessions/:id/go-live', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .update(podcastSessions)
      .set({ status: 'live', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(podcastSessions.id, id))
      .returning();

    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── END SESSION ──
router.post('/sessions/:id/end', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [session] = await db
      .select()
      .from(podcastSessions)
      .where(eq(podcastSessions.id, id));

    if (!session) return res.status(404).json({ error: 'Session not found' });

    const startedAt = session.startedAt ? new Date(session.startedAt).getTime() : Date.now();
    const duration = Math.floor((Date.now() - startedAt) / 1000);

    const [updated] = await db
      .update(podcastSessions)
      .set({
        status: 'ended',
        endedAt: new Date(),
        duration,
        updatedAt: new Date()
      })
      .where(eq(podcastSessions.id, id))
      .returning();

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── ADD PARTICIPANT ──
router.post('/participants', async (req: Request, res: Response) => {
  try {
    const { sessionId, userId, role, displayName, avatarUrl } = req.body;
    const [participant] = await db.insert(podcastParticipants).values({
      sessionId,
      userId,
      role: role || 'guest',
      displayName,
      avatarUrl: avatarUrl || null,
    }).returning();

    res.json(participant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── REMOVE PARTICIPANT ──
router.delete('/participants/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [participant] = await db
      .update(podcastParticipants)
      .set({ leftAt: new Date() })
      .where(eq(podcastParticipants.id, id))
      .returning();

    res.json(participant);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── STREAM DESTINATIONS CRUD ──
router.get('/destinations', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const destinations = await db
      .select()
      .from(streamDestinations)
      .where(eq(streamDestinations.userId, userId));

    res.json(destinations);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/destinations', async (req: Request, res: Response) => {
  try {
    const { userId, platform, label, streamKey, streamUrl } = req.body;
    if (!userId || !platform || !streamKey || !streamUrl) {
      return res.status(400).json({ error: 'userId, platform, streamKey, and streamUrl are required' });
    }

    const [dest] = await db.insert(streamDestinations).values({
      userId,
      platform,
      label: label || platform,
      streamKey,
      streamUrl,
    }).returning();

    res.json(dest);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/destinations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(streamDestinations).where(eq(streamDestinations.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════
// RECORDINGS
// ══════════════════════════════════════════════════

// ── UPLOAD RECORDING ──
router.post('/recordings/upload', recordingUpload.single('recording'), async (req: Request, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ error: 'No recording file provided' });

    const { sessionId, userId, duration, mimeType, recordingType } = req.body;
    if (!sessionId || !userId) return res.status(400).json({ error: 'sessionId and userId required' });

    const fileUrl = `/uploads/podcast-recordings/${file.filename}`;

    const [recording] = await db.insert(podcastRecordings).values({
      sessionId: parseInt(sessionId),
      userId,
      filename: file.filename,
      fileUrl,
      fileSize: file.size,
      mimeType: mimeType || file.mimetype || 'video/webm',
      duration: duration ? parseInt(duration) : 0,
      recordingType: recordingType || 'video',
      status: 'ready',
    }).returning();

    // Update session with recording URL
    await db.update(podcastSessions)
      .set({ recordingUrl: fileUrl, isRecording: false, updatedAt: new Date() })
      .where(eq(podcastSessions.id, parseInt(sessionId)));

    res.json({
      recordingId: recording.id,
      url: fileUrl,
      fileSize: file.size,
      filename: file.filename,
    });
  } catch (error: any) {
    console.error('Error uploading recording:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET RECORDINGS FOR SESSION ──
router.get('/recordings/session/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = parseInt(req.params.sessionId);
    const recordings = await db
      .select()
      .from(podcastRecordings)
      .where(eq(podcastRecordings.sessionId, sessionId))
      .orderBy(desc(podcastRecordings.createdAt));

    res.json(recordings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET USER RECORDINGS ──
router.get('/recordings', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const recordings = await db
      .select()
      .from(podcastRecordings)
      .where(eq(podcastRecordings.userId, userId))
      .orderBy(desc(podcastRecordings.createdAt));

    res.json(recordings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE RECORDING ──
router.delete('/recordings/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [recording] = await db
      .select()
      .from(podcastRecordings)
      .where(eq(podcastRecordings.id, id));

    if (!recording) return res.status(404).json({ error: 'Recording not found' });

    // Delete file from disk
    const filePath = path.join(process.cwd(), recording.fileUrl || '');
    if (recording.fileUrl && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await db.delete(podcastRecordings).where(eq(podcastRecordings.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ══════════════════════════════════════════════════
// EPISODES (Publishing)
// ══════════════════════════════════════════════════

// ── CREATE EPISODE (from recording) ──
router.post('/episodes', async (req: Request, res: Response) => {
  try {
    const {
      userId, recordingId, sessionId, title, description, showNotes,
      audioUrl, videoUrl, thumbnailUrl, duration, episodeNumber,
      seasonNumber, tags, category, language, explicit, chapters, status
    } = req.body;

    if (!userId || !title) return res.status(400).json({ error: 'userId and title required' });

    const [episode] = await db.insert(podcastEpisodes).values({
      userId,
      recordingId: recordingId || null,
      sessionId: sessionId || null,
      title,
      description: description || null,
      showNotes: showNotes || null,
      audioUrl: audioUrl || null,
      videoUrl: videoUrl || null,
      thumbnailUrl: thumbnailUrl || null,
      duration: duration || 0,
      episodeNumber: episodeNumber || null,
      seasonNumber: seasonNumber || null,
      tags: tags || [],
      category: category || null,
      language: language || 'en',
      explicit: explicit || false,
      chapters: chapters || [],
      status: status || 'draft',
      fileSize: req.body.fileSize || null,
    }).returning();

    res.json(episode);
  } catch (error: any) {
    console.error('Error creating episode:', error);
    res.status(500).json({ error: error.message });
  }
});

// ── GET USER EPISODES ──
router.get('/episodes', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const episodes = await db
      .select()
      .from(podcastEpisodes)
      .where(eq(podcastEpisodes.userId, userId))
      .orderBy(desc(podcastEpisodes.createdAt));

    res.json(episodes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET SINGLE EPISODE ──
router.get('/episodes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [episode] = await db
      .select()
      .from(podcastEpisodes)
      .where(eq(podcastEpisodes.id, id));

    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── UPDATE EPISODE ──
router.patch('/episodes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    // Whitelist allowed fields to prevent injection
    const allowedFields = ['title', 'description', 'showNotes', 'audioUrl', 'videoUrl', 'thumbnailUrl', 'duration', 'episodeNumber', 'seasonNumber', 'tags', 'category', 'language', 'explicit', 'chapters', 'status'] as const;
    const updates: Record<string, any> = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const [episode] = await db
      .update(podcastEpisodes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(podcastEpisodes.id, id))
      .returning();

    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── PUBLISH EPISODE ──
router.post('/episodes/:id/publish', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [episode] = await db
      .update(podcastEpisodes)
      .set({
        status: 'published',
        publishedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(podcastEpisodes.id, id))
      .returning();

    if (!episode) return res.status(404).json({ error: 'Episode not found' });
    res.json(episode);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── DELETE EPISODE ──
router.delete('/episodes/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const [episode] = await db
      .update(podcastEpisodes)
      .set({ status: 'deleted', updatedAt: new Date() })
      .where(eq(podcastEpisodes.id, id))
      .returning();

    res.json(episode || { success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── GET PUBLISHED EPISODES (public feed) ──
router.get('/feed/:userId', async (req: Request, res: Response) => {
  try {
    const episodes = await db
      .select()
      .from(podcastEpisodes)
      .where(
        and(
          eq(podcastEpisodes.userId, req.params.userId),
          eq(podcastEpisodes.status, 'published')
        )
      )
      .orderBy(desc(podcastEpisodes.publishedAt));

    res.json(episodes);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── INCREMENT PLAY COUNT ──
router.post('/episodes/:id/play', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(podcastEpisodes)
      .set({ playCount: sql`${podcastEpisodes.playCount} + 1` })
      .where(eq(podcastEpisodes.id, id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ── UPDATE RECORDING STATUS (for session tracking) ──
router.post('/sessions/:id/recording-status', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { isRecording } = req.body;
    const [session] = await db
      .update(podcastSessions)
      .set({ isRecording: !!isRecording, updatedAt: new Date() })
      .where(eq(podcastSessions.id, id))
      .returning();
    res.json(session);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
