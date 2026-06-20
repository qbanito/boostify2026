/**
 * 🎬 Promo Video Orchestrator (Sprint 2)
 *
 * Two pipelines, both fed by a previously-generated image asset so the
 * artist's identity stays coherent:
 *
 *  A) generateHookVideoFromAsset(imageAssetId, tier)
 *     → Kling image-to-video, 5-10s, motion respecting the source scene.
 *
 *  B) generateSpokenPromoFromAsset(imageAssetId, opts)
 *     → GPT spoken script + HeyGen avatar4 talking head.
 *        Audio is provided via a TTS URL (caller can attach later).
 *
 * Each call writes a new promoAssets row sharing the original packId so
 * the UI can display image + hook video + spoken promo together.
 */
import { db } from '../db';
import { promoAssets, songs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { generateKlingVideoBlocking, type KlingTier } from './kling-video';
import { generateHeygenBlocking } from './heygen-avatar';
import {
  buildKlingMotionPlan,
  type ImageSceneContext,
} from './promo-video-prompts';
import { mirrorUrlToFirebase } from './storage-mirror';
import type { CharacterSheet } from './character-sheet-generator';
import { buildImprovedSpokenPromo } from './improved-promo-generator';
import { analyzeVideoIntent } from './video-intent-analyzer';
import { evaluateGeneratedMedia, buildRetryPrompt } from './video-self-evaluator';
import { generatePixVerseImageToVideo, isPixVerseAvailable } from './pixverse-video';

export interface HookVideoResult {
  assetId: number;
  videoUrl: string;
  packId: string;
  prompt: string;
  durationSeconds: number;
  model: string;
}

export async function generateHookVideoFromAsset(args: {
  imageAssetId: number;
  tier?: KlingTier;
  createdBy?: number;
  userRequest?: string;
}): Promise<HookVideoResult> {
  const [imageAsset] = await db
    .select()
    .from(promoAssets)
    .where(eq(promoAssets.id, args.imageAssetId))
    .limit(1);
  if (!imageAsset) throw new Error(`Image asset ${args.imageAssetId} not found`);
  if (imageAsset.type !== 'image') throw new Error('Source asset must be type=image');

  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, imageAsset.songId))
    .limit(1);
  if (!song) throw new Error(`Song ${imageAsset.songId} not found`);

  const meta = (imageAsset.metadata as any) || {};
  const sheet: CharacterSheet | null = meta.characterSheetSnapshot || null;
  const insights = (song.analysisJson as any)?.insights || {};

  // ── Fase 5: Analyze intent ────────────────────────────────────────────────
  let intent;
  try {
    intent = await analyzeVideoIntent({
      artistContext: {
        name: sheet?.artistName,
        genre: insights.genre,
        style: insights.style,
        hasPhoto: Boolean(imageAsset.url),
      },
      songData: {
        title: song.title || `Song #${song.id}`,
        mood: insights.mood,
        bpm: insights.bpm,
        duration: song.duration,
      },
      userRequest: args.userRequest,
    });
    logger.info('[VideoOrchestrator] intent analyzed', {
      pipeline: intent.recommendedPipeline,
      confidence: intent.confidence,
    });
  } catch {
    // Non-fatal — proceed without intent
  }

  const scene: ImageSceneContext = {
    basePrompt: imageAsset.prompt || '',
    hookLine: meta.hookLine,
    action: meta.action,
    environment: meta.environment,
    wardrobe: meta.wardrobe,
    camera: meta.camera,
  };

  const plan = await buildKlingMotionPlan({
    scene,
    sheet,
    songTitle: song.title || `Song #${song.id}`,
    songMood: insights.mood,
  });

  logger.info('[VideoOrchestrator] motion plan', { plan });

  // ── Fase 4: PixVerse fallback for pro tier ─────────────────────────────────
  const usePixVerse = args.tier === 'pro' && isPixVerseAvailable();

  // ── Adaptive retry loop (max 2 attempts) ──────────────────────────────────
  let videoUrl = '';
  let usedModel = '';
  let motionPrompt = plan.motionPrompt;
  let attempt = 1;
  let requestId: string | undefined;

  while (attempt <= 2) {
    try {
      if (usePixVerse) {
        const pv = await generatePixVerseImageToVideo({
          imageUrl: imageAsset.url,
          prompt: motionPrompt,
          model: 'v6',
          aspectRatio: '9:16',
          duration: plan.duration === 10 ? 10 : 5,
        });
        videoUrl = pv.videoUrl;
        usedModel = `pixverse-${pv.model}`;
      } else {
        const kr = await generateKlingVideoBlocking({
          imageUrl: imageAsset.url,
          prompt: motionPrompt,
          negativePrompt: plan.negativePrompt,
          duration: plan.duration,
          aspectRatio: '9:16',
          tier: args.tier || 'standard',
        });
        videoUrl = kr.videoUrl;
        usedModel = kr.model;
        requestId = kr.requestId;
      }
    } catch (err) {
      if (attempt < 2) {
        logger.warn('[VideoOrchestrator] generation attempt failed, retrying', { attempt, err });
        attempt++;
        continue;
      }
      throw err;
    }

    // ── Fase 5: Self-evaluate the result ──────────────────────────────────
    try {
      const evaluation = await evaluateGeneratedMedia({
        mediaUrl: videoUrl,
        mediaType: 'video',
        originalPrompt: motionPrompt,
        intent,
        attempt,
      });

      logger.info('[VideoOrchestrator] self-evaluation', {
        score: evaluation.score,
        shouldRetry: evaluation.shouldRetry,
        issues: evaluation.issues,
      });

      if (evaluation.shouldRetry && attempt < 2) {
        motionPrompt = buildRetryPrompt({
          originalPrompt: motionPrompt,
          evaluation,
          attempt,
          intent,
        });
        attempt++;
        continue;
      }
    } catch {
      // Evaluation failure is non-fatal
    }

    // Accept result
    break;
  }

  const ownedUrl = await mirrorUrlToFirebase(
    videoUrl,
    `promo-assets/song-${imageAsset.songId}/videos`,
  );

  const tier = args.tier || 'standard';
  const costCents = tier === '4k' ? 80 : tier === 'pro' ? 40 : 20;

  const [row] = await db
    .insert(promoAssets)
    .values({
      songId: imageAsset.songId,
      artistId: imageAsset.artistId,
      packId: imageAsset.packId,           // share pack with source image
      type: 'hook_video',
      style: imageAsset.style,
      url: ownedUrl,
      thumbnailUrl: imageAsset.url,        // reuse source still as poster
      prompt: motionPrompt,
      model: usedModel,
      durationSeconds: plan.duration,
      costCents,
      metadata: {
        sourceImageAssetId: imageAsset.id,
        sourceImagePrompt: imageAsset.prompt,
        cameraMovement: plan.cameraMovement,
        negativePrompt: plan.negativePrompt,
        klingRequestId: requestId,
        tier,
        usedPixVerse: usePixVerse,
        intentPipeline: intent?.recommendedPipeline,
        retryAttempts: attempt,
      },
      status: 'ready',
      createdBy: args.createdBy,
    })
    .returning();

  return {
    assetId: row.id,
    videoUrl: ownedUrl,
    packId: row.packId,
    prompt: motionPrompt,
    durationSeconds: plan.duration,
    model: usedModel,
  };
}

export interface SpokenPromoResult {
  assetId: number;
  videoUrl: string;
  packId: string;
  script: string;
  language: string;
  durationSeconds: number;
  model: string;
}

export async function generateSpokenPromoFromAsset(args: {
  imageAssetId: number;
  audioUrl?: string;          // pre-rendered TTS (recommended)
  voiceId?: string;           // alternative: HeyGen voice
  language?: string;
  createdBy?: number;
}): Promise<SpokenPromoResult> {
  const [imageAsset] = await db
    .select()
    .from(promoAssets)
    .where(eq(promoAssets.id, args.imageAssetId))
    .limit(1);
  if (!imageAsset) throw new Error(`Image asset ${args.imageAssetId} not found`);

  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, imageAsset.songId))
    .limit(1);
  if (!song) throw new Error(`Song ${imageAsset.songId} not found`);

  const meta = (imageAsset.metadata as any) || {};
  const sheet: CharacterSheet | null = meta.characterSheetSnapshot || null;
  const insights = (song.analysisJson as any)?.insights || {};

  const script = await buildImprovedSpokenPromo({
    songTitle: song.title || `Song #${song.id}`,
    songMood: insights.mood,
    songThemes: insights.themes,
    hookLine: meta.hookLine,
    artistName: sheet?.artistName,
    sheet,
    language: args.language,
  });

  if (!args.audioUrl && !args.voiceId) {
    throw new Error(
      'Spoken promo needs either audioUrl (pre-rendered TTS) or voiceId (HeyGen voice)',
    );
  }

  const heygen = await generateHeygenBlocking({
    imageUrl: imageAsset.url,
    audioUrl: args.audioUrl,
    script: args.audioUrl ? undefined : script.script,
    voiceId: args.voiceId,
    aspectRatio: '9:16',
  });

  const ownedUrl = await mirrorUrlToFirebase(
    heygen.videoUrl,
    `promo-assets/song-${imageAsset.songId}/spoken`,
  );

  const [row] = await db
    .insert(promoAssets)
    .values({
      songId: imageAsset.songId,
      artistId: imageAsset.artistId,
      packId: imageAsset.packId,
      type: 'spoken_promo',
      style: imageAsset.style,
      url: ownedUrl,
      thumbnailUrl: imageAsset.url,
      prompt: imageAsset.prompt,
      script: script.script,
      voiceId: args.voiceId,
      model: heygen.model,
      durationSeconds: script.estimatedSeconds,
      costCents: 60,
      metadata: {
        sourceImageAssetId: imageAsset.id,
        language: script.language,
        hookPattern: script.hookPattern,
        heygenRequestId: heygen.requestId,
        usedAudioUrl: args.audioUrl,
      },
      status: 'ready',
      createdBy: args.createdBy,
    })
    .returning();

  return {
    assetId: row.id,
    videoUrl: ownedUrl,
    packId: row.packId,
    script: script.script,
    language: script.language,
    durationSeconds: script.estimatedSeconds,
    model: heygen.model,
  };
}
