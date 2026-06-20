/**
 * 🎵 Admin Song Analysis · REST endpoints
 *
 * Mount: /api/admin/song-analysis
 *
 * Access model:
 *  - GET  /songs (list)           → admin only
 *  - All  /songs/:id/* routes     → admin OR the authenticated song owner
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import { db } from '../db';
import { songs, users } from '../../db/schema';
import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/require-admin';
import { isAuthenticated } from '../middleware/clerk-auth';
import { isAdminEmail } from '../../shared/constants';
import { logger } from '../utils/logger';
import {
  analyzeSongAndStore,
  triggerSongAnalysis,
  type SongAnalysisJson,
  type SongCreativeInsights,
} from '../services/song-analysis-pipeline';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { generateImageWithNanoBanana, generateImageWithOpenAI } from '../services/fal-service';
import { generateKontextImage } from '../services/flux-kontext-generator';
import { mirrorUrlToFirebase } from '../services/storage-mirror';
import { PRIMARY_MODEL } from '../utils/ai-config';

const router = Router();

/**
 * Middleware for per-song routes: allows admin users AND any authenticated
 * user who owns the requested song.  Keeps the /songs list admin-only.
 */
async function requireAdminOrSongOwner(req: Request, res: Response, next: NextFunction) {
  // Fast path: admin users bypass the ownership DB check
  const userEmail =
    (req as any).auth?.sessionClaims?.email ||
    (req as any).user?.email ||
    (req as any).auth?.email;
  if (userEmail && isAdminEmail(userEmail)) return next();

  // Owner path: authenticated Clerk user must own the song
  const clerkUserId = (req as any).user?.clerkUserId || (req as any).user?.id;
  if (!clerkUserId) {
    return res.status(401).json({ ok: false, error: 'Authentication required' });
  }

  const songId = parseInt(req.params.id, 10);
  if (!Number.isFinite(songId)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  try {
    const [pgUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);

    if (!pgUser) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    const [song] = await db
      .select({ id: songs.id, userId: songs.userId })
      .from(songs)
      .where(eq(songs.id, songId))
      .limit(1);

    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
    if (song.userId !== pgUser.id) {
      return res.status(403).json({ ok: false, error: 'Access denied' });
    }

    return next();
  } catch (err: any) {
    logger.error('[requireAdminOrSongOwner]', err?.message);
    return res.status(500).json({ ok: false, error: 'Auth check failed' });
  }
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

// In-memory rate limit: 1 analyze trigger every 30s per song
const lastTriggerAt = new Map<number, number>();
const TRIGGER_COOLDOWN_MS = 30_000;

// ─── GET / · list songs with analysis status (SQL-paginated + searchable) ──
// Admin only — this lists ALL songs across all artists.
router.get('/songs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 200);
    const offset = Math.max(parseInt(String(req.query.offset || '0'), 10) || 0, 0);
    const filter = String(req.query.status || 'all');
    const q = String(req.query.q || '').trim();

    // Build conditions in SQL — no in-memory filtering, no over-fetch.
    const conds: any[] = [];
    if (filter === 'analyzed') conds.push(eq(songs.analysisStatus, 'ready'));
    else if (filter === 'pending')
      conds.push(or(isNull(songs.analysisStatus), eq(songs.analysisStatus, 'pending')));
    else if (filter === 'failed') conds.push(eq(songs.analysisStatus, 'failed'));
    else if (filter === 'processing') conds.push(eq(songs.analysisStatus, 'processing'));

    if (q) {
      const like = `%${q}%`;
      conds.push(
        or(
          sql`${songs.title} ILIKE ${like}`,
          sql`${users.username} ILIKE ${like}`,
          sql`${users.email} ILIKE ${like}`,
        ),
      );
    }

    const where = conds.length ? and(...conds) : undefined;

    const rows = await db
      .select({
        id: songs.id,
        userId: songs.userId,
        title: songs.title,
        genre: songs.genre,
        mood: songs.mood,
        coverArt: songs.coverArt,
        audioUrl: songs.audioUrl,
        analysisStatus: songs.analysisStatus,
        analyzedAt: songs.analyzedAt,
        analysisError: songs.analysisError,
        createdAt: songs.createdAt,
        artistName: users.username,
        artistEmail: users.email,
      })
      .from(songs)
      .leftJoin(users, eq(songs.userId, users.id))
      .where(where as any)
      .orderBy(desc(songs.createdAt))
      .limit(limit)
      .offset(offset);

    res.json({ ok: true, count: rows.length, songs: rows, limit, offset, hasMore: rows.length === limit });
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /songs failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── GET /songs/:id · full row + analysis JSON ─────────────────────────────
router.get('/songs/:id', isAuthenticated, requireAdminOrSongOwner, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  try {
    const [song] = await db
      .select()
      .from(songs)
      .where(eq(songs.id, id))
      .limit(1);

    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

    let artist: { id: number; username: string | null; email: string | null } | null = null;
    if (song.userId) {
      const [a] = await db
        .select({ id: users.id, username: users.username, email: users.email })
        .from(users)
        .where(eq(users.id, song.userId))
        .limit(1);
      if (a) artist = a;
    }

    res.json({ ok: true, song, artist });
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /songs/:id failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /songs/:id/analyze · trigger (re)analysis ────────────────────────
router.post('/songs/:id/analyze', isAuthenticated, requireAdminOrSongOwner, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  const force = req.body?.force === true || req.query.force === '1';
  const wait = req.body?.wait === true || req.query.wait === '1';

  // Rate-limit
  const last = lastTriggerAt.get(id) || 0;
  const now = Date.now();
  if (!force && now - last < TRIGGER_COOLDOWN_MS) {
    const retryIn = Math.ceil((TRIGGER_COOLDOWN_MS - (now - last)) / 1000);
    return res.status(429).json({
      ok: false,
      error: `Rate limited. Retry in ${retryIn}s.`,
      retryAfterSeconds: retryIn,
    });
  }
  lastTriggerAt.set(id, now);

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
    if (!song.audioUrl) {
      return res.status(400).json({ ok: false, error: 'Song has no audio URL' });
    }

    // Idempotent: if ready and not force, return cached
    if (!force && song.analysisStatus === 'ready' && song.analysisJson) {
      return res.json({
        ok: true,
        cached: true,
        status: 'ready',
        analyzedAt: song.analyzedAt,
      });
    }

    // Mark pending immediately so the UI shows the right state
    await db
      .update(songs)
      .set({ analysisStatus: 'processing', analysisError: null })
      .where(eq(songs.id, id));

    if (wait) {
      await analyzeSongAndStore(id);
      const [updated] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
      return res.json({
        ok: true,
        status: updated?.analysisStatus,
        analyzedAt: updated?.analyzedAt,
        analysisJson: updated?.analysisJson,
      });
    }

    // Fire-and-forget
    triggerSongAnalysis(id);
    res.json({ ok: true, status: 'processing', queued: true });
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /analyze failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /songs/:id/captions · generate social captions from JSON ─────────
router.post('/songs/:id/captions', isAuthenticated, requireAdminOrSongOwner, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  const platforms: string[] = Array.isArray(req.body?.platforms) && req.body.platforms.length
    ? req.body.platforms
    : ['instagram', 'tiktok', 'twitter', 'youtube_shorts', 'facebook'];

  if (!OPENAI_API_KEY) {
    return res.status(503).json({ ok: false, error: 'OPENAI_API_KEY not configured' });
  }

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

    const analysis = song.analysisJson as SongAnalysisJson | null;
    const insights: SongCreativeInsights | null = analysis?.insights || null;

    const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

    const sys = `You are a music marketing copywriter. Produce platform-specific social captions for a song. Return JSON with shape: { captions: [{ platform: string, caption: string, hashtags: string[] }] }. Keep each caption native to the platform's tone and length conventions.`;

    const user = JSON.stringify({
      song: {
        title: song.title,
        genre: song.genre,
        mood: song.mood,
        lyricsExcerpt: (song.lyrics || '').slice(0, 600) || null,
      },
      insights: insights
        ? {
            summary: insights.summary,
            themes: insights.themes,
            mood: insights.mood,
            targetAudience: insights.targetAudience,
            marketingAngles: insights.marketingAngles,
            hashtags: insights.hashtags,
          }
        : null,
      platforms,
    });

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.85,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    res.json({ ok: true, captions: parsed.captions || [] });
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /captions failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /songs/:id/cover · generate promo cover image ────────────────────
router.post('/songs/:id/cover', isAuthenticated, requireAdminOrSongOwner, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  const aspectRatio = (req.body?.aspectRatio as string) || '1:1';
  const customPrompt = req.body?.prompt as string | undefined;

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

    const analysis = song.analysisJson as SongAnalysisJson | null;
    const insights = analysis?.insights || null;

    // Resolve artist profile image for FLUX CONTEXT PRO reference
    const artistId = ((song as any).artistId ?? (song as any).userId) as number;
    let referenceImageUrl: string | null = null;
    if (artistId) {
      const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
      referenceImageUrl = (artist as any)?.profileImage || (artist as any)?.profileImageUrl || null;
    }

    let prompt = customPrompt;
    if (!prompt) {
      const moodStr = insights?.mood?.join(', ') || song.mood || 'cinematic';
      const themeStr = insights?.themes?.slice(0, 3).join(', ') || song.genre || '';
      const summary = insights?.summary || `Promotional cover art for "${song.title}"`;
      prompt = `Promotional poster artwork for the song "${song.title}". ${summary}. Visual themes: ${themeStr}. Mood: ${moodStr}. Cinematic, high contrast, editorial composition, professional music marketing photography, 8K, dramatic lighting.`;
    }

    // Use FLUX CONTEXT PRO (fal-ai/flux-pro/kontext) with reference image
    const kontextResult = await generateKontextImage({
      basePrompt: prompt,
      style: 'cinematic',
      referenceImageUrl: referenceImageUrl || undefined,
      aspectRatio: aspectRatio as any,
      numImages: 1,
    });

    if (kontextResult.imageUrls.length > 0) {
      const imageUrl = kontextResult.imageUrls[0];
      // Mirror to Firebase for permanent ownership
      const ownedUrl = await mirrorUrlToFirebase(imageUrl, `promo-covers/song-${id}`);

      // Save to Firestore image_galleries so it appears in the artist's gallery section
      try {
        const { db: firestoreDb } = await import('../firebase');
        const userId = String(artistId);
        const galleryId = `promo-covers-song-${id}`;
        const galleryRef = firestoreDb.collection('image_galleries').doc(galleryId);
        const galleryDoc = await galleryRef.get();

        const newImage = {
          id: `cover-${Date.now()}`,
          url: ownedUrl,
          prompt: kontextResult.prompt,
          createdAt: new Date().toISOString(),
        };

        if (galleryDoc.exists) {
          await galleryRef.update({
            generatedImages: [...(galleryDoc.data()?.generatedImages || []), newImage],
            updatedAt: new Date().toISOString(),
          });
        } else {
          await galleryRef.set({
            userId,
            singleName: song.title || `Song #${id}`,
            artistName: (artist as any)?.artistName || (artist as any)?.username || 'Artist',
            basePrompt: kontextResult.prompt,
            styleInstructions: 'Cover variations',
            referenceImageUrls: referenceImageUrl ? [referenceImageUrl] : [],
            generatedImages: [newImage],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPublic: true,
          });
        }
        logger.info('[AdminSongAnalysis] cover saved to Firestore gallery', { galleryId });
      } catch (fsErr: any) {
        logger.warn('[AdminSongAnalysis] failed to save cover to Firestore gallery', { err: fsErr?.message });
      }

      res.json({
        ok: true,
        imageUrl: ownedUrl,
        provider: 'fal-flux-pro-kontext',
        prompt: kontextResult.prompt,
      });
    } else {
      return res.status(502).json({
        ok: false,
        error: 'FLUX CONTEXT PRO returned no images',
      });
    }
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /cover failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ─── POST /songs/:id/promo-prompts · seed prompts for video tools ──────────
router.post('/songs/:id/promo-prompts', isAuthenticated, requireAdminOrSongOwner, async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    return res.status(400).json({ ok: false, error: 'Invalid song id' });
  }

  try {
    const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
    if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

    const analysis = song.analysisJson as SongAnalysisJson | null;
    const insights = analysis?.insights || null;

    const prompts = {
      videoConcepts: insights?.videoConcepts || [],
      marketingAngles: insights?.marketingAngles || [],
      hashtags: insights?.hashtags || [],
      syncOpportunities: insights?.syncOpportunities || [],
      emotionalArc: insights?.emotionalArc || '',
      targetAudience: insights?.targetAudience || '',
      recommendedPlatforms: insights?.recommendedPlatforms || [],
      // Suggested image prompts ready for the image generator
      imagePrompts: (insights?.videoConcepts || []).slice(0, 6).map((concept) => ({
        concept,
        prompt: `Cinematic still frame inspired by: ${concept}. Mood: ${(insights?.mood || []).join(', ')}. High-end music video aesthetic.`,
      })),
    };

    res.json({ ok: true, prompts });
  } catch (err: any) {
    logger.error('[AdminSongAnalysis] /promo-prompts failed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
