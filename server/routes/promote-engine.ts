/**
 * 🎬 Promote Engine routes
 *
 * Mount: /api/promote-engine
 *
 * Sprint 1 endpoints:
 *  - GET    /artist-style/:artistId/status         → latest LoRA + training status
 *  - POST   /artist-style/:artistId/auto-bootstrap → 1-click full pipeline
 *  - POST   /artist-style/:artistId/upload-references { imageUrls[] } → save manual refs
 *  - POST   /artist-style/:artistId/train          → submit training using current refs
 *  - POST   /song/:songId/generate-pack { styles?, aspectRatio? } → 3 promo images
 *  - GET    /song/:songId/assets                   → list generated promo assets
 *  - GET    /styles                                → preset catalog
 */
import { Router, type Request, type Response } from 'express';
import { clerkClient } from '@clerk/express';
import { isAuthenticated } from '../middleware/clerk-auth';
import { db } from '../db';
import { users, songs, artistLoras, promoAssets, challengeCampaigns } from '../../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { isAdminEmail } from '../../shared/constants';

import {
  autoBootstrapArtistLora,
  getLatestArtistLora,
} from '../services/auto-reference-bootstrap';
import {
  submitLoraTraining,
  getTrainingStatus,
  getTrainingResult,
} from '../services/flux-trainer';
import { generatePromoPacks } from '../services/promo-orchestrator';
import {
  generateHookVideoFromAsset,
  generateSpokenPromoFromAsset,
} from '../services/promo-video-orchestrator';
import { styleList, type PromoStyle } from '../services/promo-style-presets';
import { extractSongClipForPromo } from '../services/song-audio-extractor';
import { mixVideoWithSongAudio, MIXING_PROFILES } from '../services/promo-audio-mixer';
import { analyzeSongVirality } from '../services/challenge-analyzer';
import { generateChallengeVideos } from '../services/challenge-video-generator';
import { buildChallengeCampaign } from '../services/challenge-campaign-builder';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
async function resolveCallerPgUser(req: Request) {
  const clerkUserId = (req as any).user?.clerkUserId || (req as any).user?.id;
  if (!clerkUserId) return null;
  const [u] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.clerkId, clerkUserId))
    .limit(1);
  return u || null;
}

async function resolveCallerIdentity(req: Request) {
  const clerkUserId = (req as any).user?.clerkUserId || (req as any).user?.id;
  let email = ((req as any).user?.email || '').toLowerCase();

  if (!email && clerkUserId) {
    try {
      const clerkUser = await clerkClient.users.getUser(clerkUserId);
      email = (clerkUser?.emailAddresses?.[0]?.emailAddress || '').toLowerCase();
      if (email) {
        (req as any).user = { ...((req as any).user || {}), clerkUserId, id: clerkUserId, email };
      }
    } catch (err: any) {
      logger.warn('[PromoteEngine] failed to resolve caller email from Clerk', {
        err: err?.message,
        clerkUserId,
      });
    }
  }

  return { clerkUserId, email };
}

async function canActOnArtist(req: Request, artistId: number): Promise<boolean> {
  const { clerkUserId, email: callerEmail } = await resolveCallerIdentity(req);
  if (callerEmail && isAdminEmail(callerEmail)) return true;

  const caller = await resolveCallerPgUser(req);
  if (caller) {
    if (caller.role === 'admin') return true;
    if (caller.id === artistId) return true;
  }

  if (!clerkUserId) return false;
  const [targetArtist] = await db
    .select({ id: users.id, clerkId: users.clerkId })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  return !!targetArtist && targetArtist.clerkId === clerkUserId;
}

function slugifyTrigger(name: string, artistId: number): string {
  const base = (name || 'artist')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 18);
  return `${base || 'artist'}_${artistId}`;
}

// Refresh training status from FAL when stored row is in 'training'.
async function refreshTrainingIfNeeded(loraId: number) {
  const [row] = await db.select().from(artistLoras).where(eq(artistLoras.id, loraId)).limit(1);
  if (!row || row.status !== 'training' || !row.trainingJobId) return row;
  try {
    const status = await getTrainingStatus(row.trainingJobId);
    if (status.status === 'COMPLETED') {
      const result = await getTrainingResult(row.trainingJobId);
      const [updated] = await db
        .update(artistLoras)
        .set({
          status: 'ready',
          loraUrl: result.loraUrl,
          trainedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(artistLoras.id, loraId))
        .returning();
      return updated;
    }
    if (status.status === 'FAILED') {
      const [updated] = await db
        .update(artistLoras)
        .set({
          status: 'failed',
          errorMessage: 'FAL training reported FAILED',
          updatedAt: new Date(),
        })
        .where(eq(artistLoras.id, loraId))
        .returning();
      return updated;
    }
  } catch (err: any) {
    logger.warn('[PromoteEngine] training status refresh failed', { err: err?.message });
  }
  return row;
}

// ─────────────────────────────────────────────────────────────────────────
// GET /styles
// ─────────────────────────────────────────────────────────────────────────
router.get('/styles', (_req, res) => {
  res.json({ ok: true, styles: styleList() });
});

// ─────────────────────────────────────────────────────────────────────────
// GET /artist-style/:artistId/status
// ─────────────────────────────────────────────────────────────────────────
router.get(
  '/artist-style/:artistId/status',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ ok: false, error: 'Invalid artistId' });
    }
    if (!(await canActOnArtist(req, artistId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    let row = await getLatestArtistLora(artistId);
    if (row) row = await refreshTrainingIfNeeded(row.id);
    res.json({ ok: true, lora: row });
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /artist-style/:artistId/auto-bootstrap
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/artist-style/:artistId/auto-bootstrap',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ ok: false, error: 'Invalid artistId' });
    }
    if (!(await canActOnArtist(req, artistId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    try {
      const result = await autoBootstrapArtistLora(artistId);
      res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] auto-bootstrap failed', { err: err?.message, stack: err?.stack });
      console.error('[PromoteEngine] auto-bootstrap FULL ERROR:', err);
      res.status(500).json({ ok: false, error: err?.message || 'Bootstrap failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /artist-style/:artistId/upload-references  body: { imageUrls: string[] }
// (Caller is responsible for uploading to Firebase Storage first; this just
//  records the URLs as the new pending reference set.)
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/artist-style/:artistId/upload-references',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ ok: false, error: 'Invalid artistId' });
    }
    if (!(await canActOnArtist(req, artistId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const imageUrls: string[] = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls : [];
    if (imageUrls.length < 4) {
      return res.status(400).json({ ok: false, error: 'Need at least 4 reference images' });
    }

    try {
      const [user] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
      const profileRef =
        (user as any)?.profileImage ||
        (user as any)?.profileImageUrl ||
        null;
      const mergedImageUrls = Array.from(
        new Set([profileRef, ...imageUrls].filter((value): value is string => !!value)),
      );
      const triggerWord = slugifyTrigger(
        (user as any)?.artistName || (user as any)?.username || 'artist',
        artistId,
      );

      const [row] = await db
        .insert(artistLoras)
        .values({
          artistId,
          triggerWord,
          referenceImages: mergedImageUrls as any,
          status: 'pending',
        })
        .returning();
      res.json({ ok: true, lora: row });
    } catch (err: any) {
      logger.error('[PromoteEngine] upload-references failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'Save failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /artist-style/:artistId/train
// Trigger flux-kontext-trainer on the most recent pending row.
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/artist-style/:artistId/train',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const artistId = parseInt(req.params.artistId, 10);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ ok: false, error: 'Invalid artistId' });
    }
    if (!(await canActOnArtist(req, artistId))) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    try {
      const row = await getLatestArtistLora(artistId);
      if (!row) {
        return res.status(404).json({ ok: false, error: 'No reference set found' });
      }
      if (row.status === 'training') {
        return res.json({ ok: true, lora: row, alreadyTraining: true });
      }
      const refs = (row.referenceImages as string[] | null) || [];
      if (refs.length < 4) {
        return res
          .status(400)
          .json({ ok: false, error: 'Need at least 4 reference images before training' });
      }
      const submitted = await submitLoraTraining({
        imageUrls: refs,
        triggerWord: row.triggerWord,
        steps: 1000,
      });
      const [updated] = await db
        .update(artistLoras)
        .set({
          trainingJobId: submitted.requestId,
          status: 'training',
          updatedAt: new Date(),
        })
        .where(eq(artistLoras.id, row.id))
        .returning();
      res.json({ ok: true, lora: updated });
    } catch (err: any) {
      logger.error('[PromoteEngine] train failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'Train failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /song/:songId/generate-pack  body: { styles?: PromoStyle[], aspectRatio? }
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/song/:songId/generate-pack',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId' });
    }

    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) {
        return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      }
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const caller = await resolveCallerPgUser(req);

      // Refresh & require ready LoRA (we still allow generation without it,
      // just less consistent — caller can opt-in via allowNoLora=true).
      let lora = await getLatestArtistLora(artistId);
      if (lora) lora = await refreshTrainingIfNeeded(lora.id);

      const allowNoLora = req.body?.allowNoLora === true;
      if ((!lora || lora.status !== 'ready') && !allowNoLora) {
        return res.status(409).json({
          ok: false,
          error: 'Artist LoRA is not ready yet',
          loraStatus: lora?.status || 'missing',
        });
      }

      const styles = Array.isArray(req.body?.styles) ? (req.body.styles as PromoStyle[]) : undefined;
      const aspectRatio = req.body?.aspectRatio;

      const result = await generatePromoPacks({
        songId,
        artistId,
        lora: lora && lora.status === 'ready' ? (lora as any) : null,
        styles,
        aspectRatio,
        createdBy: caller?.id,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] generate-pack failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'Generate failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// GET /song/:songId/assets
// ─────────────────────────────────────────────────────────────────────────
router.get(
  '/song/:songId/assets',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId' });
    }
    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) {
        return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      }
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const rows = await db
        .select()
        .from(promoAssets)
        .where(and(eq(promoAssets.songId, songId)))
        .orderBy(desc(promoAssets.createdAt));
      res.json({ ok: true, assets: rows });
    } catch (err: any) {
      logger.error('[PromoteEngine] list assets failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'List failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /asset/:imageAssetId/hook-video  body: { tier?: 'standard'|'pro'|'4k' }
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/asset/:imageAssetId/hook-video',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const imageAssetId = parseInt(req.params.imageAssetId, 10);
    if (!Number.isFinite(imageAssetId)) {
      return res.status(400).json({ ok: false, error: 'Invalid imageAssetId' });
    }
    try {
      const [src] = await db
        .select()
        .from(promoAssets)
        .where(eq(promoAssets.id, imageAssetId))
        .limit(1);
      if (!src) return res.status(404).json({ ok: false, error: 'Asset not found' });
      if (!(await canActOnArtist(req, src.artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const caller = await resolveCallerPgUser(req);
      const tier = req.body?.tier as 'standard' | 'pro' | '4k' | undefined;

      const result = await generateHookVideoFromAsset({
        imageAssetId,
        tier,
        createdBy: caller?.id,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] hook-video failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'Hook video failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /asset/:imageAssetId/spoken-promo
// body: { audioUrl?, voiceId?, language? }
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/asset/:imageAssetId/spoken-promo',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const imageAssetId = parseInt(req.params.imageAssetId, 10);
    if (!Number.isFinite(imageAssetId)) {
      return res.status(400).json({ ok: false, error: 'Invalid imageAssetId' });
    }
    try {
      const [src] = await db
        .select()
        .from(promoAssets)
        .where(eq(promoAssets.id, imageAssetId))
        .limit(1);
      if (!src) return res.status(404).json({ ok: false, error: 'Asset not found' });
      if (!(await canActOnArtist(req, src.artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const caller = await resolveCallerPgUser(req);

      const result = await generateSpokenPromoFromAsset({
        imageAssetId,
        audioUrl: req.body?.audioUrl,
        voiceId: req.body?.voiceId,
        language: req.body?.language,
        createdBy: caller?.id,
      });
      res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] spoken-promo failed', { err: err?.message });
      res.status(500).json({ ok: false, error: err?.message || 'Spoken promo failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /song/:songId/extract-promo-clip
// body: { strategy?, customStart?, customDuration?, targetDuration? }
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/song/:songId/extract-promo-clip',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId' });
    }

    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) {
        return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      }
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const clip = await extractSongClipForPromo({
        songId,
        strategy: req.body?.strategy || 'best-section',
        customStart: req.body?.customStart,
        customDuration: req.body?.customDuration,
        targetDuration: req.body?.targetDuration,
      });

      return res.json({
        ok: true,
        clipStart: clip.startSeconds,
        clipDuration: clip.durationSeconds,
        confidence: clip.confidence,
        reason: clip.reason,
      });
    } catch (err: any) {
      logger.error('[PromoteEngine] extract-promo-clip failed', { err: err?.message });
      return res.status(500).json({ ok: false, error: err?.message || 'Extract failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// GET /mixing-profiles
// ─────────────────────────────────────────────────────────────────────────
router.get('/mixing-profiles', isAuthenticated, async (_req: Request, res: Response) => {
  return res.json({ ok: true, profiles: MIXING_PROFILES });
});

// ─────────────────────────────────────────────────────────────────────────
// POST /asset/:videoAssetId/mix-with-audio
// body: { profile?, audioUrl?, clipStrategy?, clipDuration? }
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/asset/:videoAssetId/mix-with-audio',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const videoAssetId = parseInt(req.params.videoAssetId, 10);
    if (!Number.isFinite(videoAssetId)) {
      return res.status(400).json({ ok: false, error: 'Invalid videoAssetId' });
    }

    try {
      const [videoAsset] = await db
        .select()
        .from(promoAssets)
        .where(eq(promoAssets.id, videoAssetId))
        .limit(1);

      if (!videoAsset) return res.status(404).json({ ok: false, error: 'Asset not found' });
      if (videoAsset.type === 'image') {
        return res.status(400).json({ ok: false, error: 'Asset must be a video promo' });
      }
      if (!videoAsset.url) {
        return res.status(400).json({ ok: false, error: 'Source video asset has no URL' });
      }
      if (!(await canActOnArtist(req, videoAsset.artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const [song] = await db
        .select()
        .from(songs)
        .where(eq(songs.id, videoAsset.songId))
        .limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });

      const profileName = (req.body?.profile || 'BALANCED') as keyof typeof MIXING_PROFILES;
      if (!MIXING_PROFILES[profileName]) {
        return res.status(400).json({ ok: false, error: `Unknown profile ${profileName}` });
      }

      const clip = await extractSongClipForPromo({
        songId: song.id,
        strategy: req.body?.clipStrategy || 'best-section',
        targetDuration: req.body?.clipDuration || videoAsset.durationSeconds || 6,
      });

      const songAudioUrl = req.body?.audioUrl || song.audioUrl;
      if (!songAudioUrl) {
        return res.status(400).json({ ok: false, error: 'Song audio URL is required' });
      }

      const mixed = await mixVideoWithSongAudio({
        videoUrl: videoAsset.url,
        audioUrl: songAudioUrl,
        ...MIXING_PROFILES[profileName],
        outputFormat: 'mp4',
      });

      const caller = await resolveCallerPgUser(req);
      const [row] = await db
        .insert(promoAssets)
        .values({
          songId: videoAsset.songId,
          artistId: videoAsset.artistId,
          packId: videoAsset.packId,
          type: 'composite',
          style: videoAsset.style,
          url: mixed.videoUrl,
          thumbnailUrl: videoAsset.thumbnailUrl || videoAsset.url,
          prompt: videoAsset.prompt,
          model: `${videoAsset.model || 'unknown'} + promo-audio-mixer`,
          durationSeconds: mixed.durationSeconds,
          costCents: (videoAsset.costCents || 0) + 5,
          metadata: {
            sourceVideoAssetId: videoAsset.id,
            sourceVideoType: videoAsset.type,
            audioMixInfo: mixed.audioMixInfo,
            mixProfile: profileName,
            clipStrategy: req.body?.clipStrategy || 'best-section',
            clipStartSeconds: clip.startSeconds,
            clipDurationSeconds: clip.durationSeconds,
          },
          status: 'ready',
          createdBy: caller?.id,
        })
        .returning();

      return res.json({
        ok: true,
        assetId: row.id,
        videoUrl: row.url,
        mixProfile: profileName,
        audioMixInfo: mixed.audioMixInfo,
      });
    } catch (err: any) {
      logger.error('[PromoteEngine] mix-with-audio failed', { err: err?.message });
      return res.status(500).json({ ok: false, error: err?.message || 'Audio mix failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /song/:songId/challenge-analyze
// Analyze virality + create challenge_campaigns row
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/song/:songId/challenge-analyze',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId' });
    }
    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const result = await analyzeSongVirality(songId);
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] challenge-analyze failed', { err: err?.message, stack: err?.stack });
      console.error('[PromoteEngine] challenge-analyze FULL ERROR:', err);
      return res.status(500).json({ ok: false, error: err?.message || 'Analysis failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /song/:songId/challenge-generate
// body: { campaignId, referenceVideoUrl? }
// Fires 3 Kling jobs async (non-blocking) — client polls status
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/song/:songId/challenge-generate',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    const campaignId = parseInt(req.body?.campaignId, 10);
    if (!Number.isFinite(songId) || !Number.isFinite(campaignId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId or campaignId' });
    }
    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      // Resolve reference image: prefer referenceVideoUrl frame, fallback to artist profile image
      const [artistUser] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
      const referenceImageUrl: string =
        req.body?.referenceVideoUrl ||
        (artistUser as any)?.profileImageUrl ||
        (artistUser as any)?.profileImage ||
        '';

      if (!referenceImageUrl) {
        return res.status(400).json({ ok: false, error: 'Artist has no profile image to use as reference. Upload a profile image first.' });
      }

      // Fire videos async — respond immediately, client polls /challenge-status
      generateChallengeVideos({
        campaignId,
        referenceImageUrl,
        referenceVideoUrl: req.body?.referenceVideoUrl ?? null,
      }).catch((err: any) => {
        logger.error('[PromoteEngine] challenge-generate background failed', { err: err?.message, campaignId });
      });

      return res.json({ ok: true, campaignId, status: 'generating', message: 'Videos are being generated. Poll /challenge-status for progress.' });
    } catch (err: any) {
      logger.error('[PromoteEngine] challenge-generate failed', { err: err?.message });
      return res.status(500).json({ ok: false, error: err?.message || 'Generate failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// GET /song/:songId/challenge-status/:campaignId
// Poll the generation status of a campaign
// ─────────────────────────────────────────────────────────────────────────
router.get(
  '/song/:songId/challenge-status/:campaignId',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    const campaignId = parseInt(req.params.campaignId, 10);
    if (!Number.isFinite(songId) || !Number.isFinite(campaignId)) {
      return res.status(400).json({ ok: false, error: 'Invalid ids' });
    }
    try {
      const [campaign] = await db
        .select()
        .from(challengeCampaigns)
        .where(eq(challengeCampaigns.id, campaignId))
        .limit(1);
      if (!campaign) return res.status(404).json({ ok: false, error: 'Campaign not found' });
      if (!(await canActOnArtist(req, campaign.artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      return res.json({ ok: true, campaign });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// POST /song/:songId/challenge-campaign
// body: { campaignId }
// Build 15-day campaign calendar
// ─────────────────────────────────────────────────────────────────────────
router.post(
  '/song/:songId/challenge-campaign',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    const campaignId = parseInt(req.body?.campaignId, 10);
    if (!Number.isFinite(songId) || !Number.isFinite(campaignId)) {
      return res.status(400).json({ ok: false, error: 'Invalid ids' });
    }
    try {
      const [campaign] = await db
        .select()
        .from(challengeCampaigns)
        .where(eq(challengeCampaigns.id, campaignId))
        .limit(1);
      if (!campaign) return res.status(404).json({ ok: false, error: 'Campaign not found' });
      if (!(await canActOnArtist(req, campaign.artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const result = await buildChallengeCampaign(campaignId);
      return res.json({ ok: true, ...result });
    } catch (err: any) {
      logger.error('[PromoteEngine] challenge-campaign failed', { err: err?.message });
      return res.status(500).json({ ok: false, error: err?.message || 'Calendar failed' });
    }
  },
);

// ─────────────────────────────────────────────────────────────────────────
// GET /song/:songId/challenges
// List all challenge campaigns for a song
// ─────────────────────────────────────────────────────────────────────────
router.get(
  '/song/:songId/challenges',
  isAuthenticated,
  async (req: Request, res: Response) => {
    const songId = parseInt(req.params.songId, 10);
    if (!Number.isFinite(songId)) {
      return res.status(400).json({ ok: false, error: 'Invalid songId' });
    }
    try {
      const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
      if (!song) return res.status(404).json({ ok: false, error: 'Song not found' });
      const artistId = ((song as any).artistId ?? (song as any).userId) as number;
      if (!artistId) return res.status(400).json({ ok: false, error: 'Song has no artist owner' });
      if (!(await canActOnArtist(req, artistId))) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const rows = await db
        .select()
        .from(challengeCampaigns)
        .where(eq(challengeCampaigns.songId, songId))
        .orderBy(desc(challengeCampaigns.createdAt));
      return res.json({ ok: true, campaigns: rows });
    } catch (err: any) {
      return res.status(500).json({ ok: false, error: err?.message });
    }
  },
);

export default router;

