/**
 * AI Video Studio Route
 *
 * Boostify HyperFrame Video Engine — Backend REST API
 *
 * Endpoints:
 *   POST /api/ai-video-studio/:artistId/generate          — Full pipeline
 *   POST /api/ai-video-studio/:artistId/concept           — AI concept only
 *   POST /api/ai-video-studio/:artistId/compose           — HyperFrames composition only
 *   POST /api/ai-video-studio/:artistId/heygen-avatar     — Generate HeyGen avatar video
 *   GET  /api/ai-video-studio/:artistId/jobs              — List jobs
 *   GET  /api/ai-video-studio/:artistId/jobs/:jobId       — Get job status
 *   DELETE /api/ai-video-studio/:artistId/jobs/:jobId     — Delete job
 *   POST /api/ai-video-studio/:artistId/generate-avatar-scenes — Generate realistic artist scenes via FAL flux-kontext
 *   POST /api/ai-video-studio/:artistId/create-photo-avatar   — Create HeyGen photo avatar from image URL
 *   POST /api/ai-video-studio/webhooks/heygen             — HeyGen webhook
 *   GET  /api/ai-video-studio/heygen/avatars              — List HeyGen avatars
 *   GET  /api/ai-video-studio/heygen/voices               — List HeyGen voices
 *   GET  /api/ai-video-studio/templates                   — List HyperFrames templates
 *   POST /api/ai-video-studio/templates                   — Save a template
 */

import { Router, Request, Response } from 'express';
import { neon } from '@neondatabase/serverless';
import { db } from '../db';
import { videoJobs, videoOutputs, hyperframesTemplates } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  orchestrateVideoProduction,
  runCreativeDirectorAgent,
  type VideoProductionInput,
} from '../services/video-agents';
import {
  generateCompositionHtml,
  renderHyperFramesComposition,
  type HyperFramesCompositionInput,
} from '../services/hyperframes-render';
import {
  listHeyGenAvatars,
  listHeyGenVoices,
  generateHeyGenVideo,
  getHeyGenVideoStatus,
  pollHeyGenVideoUntilDone,
  heygenDimensionFromFormat,
} from '../services/heygen-video-api';
import { generateKontextImage } from '../services/flux-kontext-generator';
import axios from 'axios';

const sql = neon(process.env.DATABASE_URL!);
const router = Router();

// ─── Helper: resolve artist data ──────────────────────────────────────────────

async function resolveArtist(artistId: string): Promise<any> {
  try {
    const numeric = /^\d+$/.test(artistId);
    if (numeric) {
      const rows = await sql`
        SELECT id, artist_name, biography, genre, genres, profile_image, brand_colors, logo_url, firestore_id
        FROM users WHERE id = ${Number(artistId)} LIMIT 1`;
      if (rows[0]) return rows[0];
    }
    const rows = await sql`
      SELECT id, artist_name, biography, genre, genres, profile_image, brand_colors, logo_url, firestore_id
      FROM users WHERE firestore_id = ${artistId} LIMIT 1`;
    return rows[0] ?? null;
  } catch { return null; }
}

// ─── POST /heygen/avatars ─────────────────────────────────────────────────────
router.get('/heygen/avatars', async (_req: Request, res: Response) => {
  try {
    const avatars = await listHeyGenAvatars();
    res.json({ success: true, avatars });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /heygen/voices ───────────────────────────────────────────────────────
router.get('/heygen/voices', async (req: Request, res: Response) => {
  const { language } = req.query as { language?: string };
  try {
    const voices = await listHeyGenVoices(language);
    res.json({ success: true, voices });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /templates ───────────────────────────────────────────────────────────
router.get('/templates', async (req: Request, res: Response) => {
  const { category, genre, format } = req.query as Record<string, string>;
  try {
    let templates = await db.select().from(hyperframesTemplates)
      .where(eq(hyperframesTemplates.isPublic, true))
      .orderBy(desc(hyperframesTemplates.createdAt))
      .limit(50);

    if (category) templates = templates.filter(t => t.category === category);
    if (genre) templates = templates.filter(t => !t.genre || t.genre === genre);
    if (format) templates = templates.filter(t => t.format === format);

    res.json({ success: true, templates });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /templates ──────────────────────────────────────────────────────────
router.post('/templates', authenticate, async (req: Request, res: Response) => {
  const { name, description, category, preset, genre, format, durationSeconds,
    compositionHtml, stylesCss, timelineJs, previewImageUrl, tags } = req.body;

  if (!name || !category || !compositionHtml) {
    return res.status(400).json({ success: false, error: 'name, category, compositionHtml required' });
  }

  try {
    const [template] = await db.insert(hyperframesTemplates).values({
      name, description, category, preset, genre, format: format ?? '9:16',
      durationSeconds: durationSeconds ?? 30, compositionHtml, stylesCss, timelineJs,
      previewImageUrl, tags: tags ?? [],
    } as any).returning();

    res.json({ success: true, template });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/concept ──────────────────────────────────────────────────
// Just runs the Creative Director Agent (fast, no video render)
router.post('/:artistId/concept', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const input: VideoProductionInput = req.body;

  if (!input?.videoType || !input?.artist?.name) {
    return res.status(400).json({ success: false, error: 'videoType and artist.name required' });
  }

  try {
    const concept = await runCreativeDirectorAgent({ ...input, artist: { ...input.artist, id: artistId } });
    res.json({ success: true, concept });
  } catch (err: any) {
    logger.error(`[AIVideoStudio] /concept error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/compose ──────────────────────────────────────────────────
// Generates HyperFrames composition HTML files without rendering
router.post('/:artistId/compose', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const compositionInput: HyperFramesCompositionInput = req.body;

  if (!compositionInput?.jobId || !compositionInput?.artistName) {
    return res.status(400).json({ success: false, error: 'jobId and artistName required' });
  }

  try {
    const result = generateCompositionHtml(compositionInput);
    res.json({
      success: true,
      compositionHtml: result.html,
      stylesCss: result.css,
      timelineJs: result.js,
      metadata: result.metadata,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/heygen-avatar ────────────────────────────────────────────
// Kicks off a HeyGen avatar video generation
router.post('/:artistId/heygen-avatar', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { jobId, avatarId, voiceId, script, format, background, caption } = req.body;

  if (!avatarId || !voiceId || !script) {
    return res.status(400).json({ success: false, error: 'avatarId, voiceId, script required' });
  }

  try {
    const videoId = await generateHeyGenVideo({
      avatar_id: avatarId,
      voice_id: voiceId,
      script,
      dimension: heygenDimensionFromFormat(format ?? '9:16'),
      background: background ?? { type: 'color', value: '#0a0a0a' },
      caption: caption ?? false,
    });

    // Update job if jobId provided
    if (jobId) {
      await db.update(videoJobs)
        .set({ heygenVideoId: videoId, status: 'heygen_processing', updatedAt: new Date() } as any)
        .where(eq(videoJobs.id, Number(jobId)));
    }

    res.json({ success: true, videoId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/generate ─────────────────────────────────────────────────
// Full pipeline: concept → script → HyperFrames → HeyGen → assemble → save
router.post('/:artistId/generate', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const input: VideoProductionInput = req.body;

  if (!input?.videoType) {
    return res.status(400).json({ success: false, error: 'videoType is required' });
  }

  try {
    // 1. Resolve artist from DB
    const artistRow = await resolveArtist(artistId);

    // Merge DB data with request input
    const mergedInput: VideoProductionInput = {
      ...input,
      artist: {
        id: artistId,
        name: artistRow?.artist_name || input.artist?.name || 'Artist',
        genre: artistRow?.genre || input.artist?.genre || 'Pop',
        bio: artistRow?.biography || input.artist?.bio,
        profileImageUrl: artistRow?.profile_image || input.artist?.profileImageUrl,
        brandColors: artistRow?.brand_colors || input.artist?.brandColors,
        avatarId: input.artist?.avatarId,
        voiceId: input.artist?.voiceId,
        language: input.campaign?.language || input.artist?.language || 'en',
        ...input.artist,
      },
    };

    // 2. Create initial DB job record
    const [job] = await db.insert(videoJobs).values({
      artistId,
      songId: input.song?.id,
      videoType: input.videoType as any,
      platform: input.campaign?.platform || 'tiktok',
      format: input.campaign?.format || '9:16',
      language: input.campaign?.language || 'en',
      durationSeconds: input.campaign?.durationSeconds || 30,
      inputPayload: input as any,
      status: 'draft',
    } as any).returning();

    logger.info(`[AIVideoStudio] Job created: ${job.id} for artist ${artistId}`);

    // 3. Run AI orchestrator (async response — job polling)
    // We return the job ID immediately and process in background
    res.json({ success: true, jobId: job.id, status: 'draft', message: 'Video job queued. Poll /jobs/:jobId for status.' });

    // 4. Background processing
    processVideoJobAsync(job.id, mergedInput).catch((err) => {
      logger.error(`[AIVideoStudio] Background job ${job.id} failed: ${err.message}`);
    });

  } catch (err: any) {
    logger.error(`[AIVideoStudio] /generate error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── Background processing pipeline ──────────────────────────────────────────

async function processVideoJobAsync(jobId: number, input: VideoProductionInput): Promise<void> {
  const update = (data: Record<string, any>) =>
    db.update(videoJobs).set({ ...data, updatedAt: new Date() } as any).where(eq(videoJobs.id, jobId));

  try {
    // Step 1-4: AI Orchestration
    await update({ status: 'draft', progressPercent: 5 });
    const plan = await orchestrateVideoProduction(input);
    await update({
      status: 'script_generated',
      progressPercent: 30,
      creativeConcept: plan.concept as any,
      script: plan.script as any,
      scenes: plan.scenes as any,
    });

    // Step 5: HyperFrames composition
    const durationMs = (input.campaign?.durationSeconds ?? 30) * 1000;
    const primaryColor = (input.artist?.brandColors?.[0]) || '#7c3aed';
    const secondaryColor = (input.artist?.brandColors?.[1]) || '#1e1b4b';
    const accentColor = (input.artist?.brandColors?.[2]) || '#a78bfa';

    const compositionInput: HyperFramesCompositionInput = {
      jobId: String(jobId),
      artistName: input.artist.name,
      songTitle: input.song?.title,
      brandColors: { primary: primaryColor, secondary: secondaryColor, accent: accentColor },
      logoUrl: undefined,
      coverArtUrl: input.song?.coverArtUrl,
      audioUrl: input.song?.audioUrl,
      format: (input.campaign?.format ?? '9:16') as '9:16' | '16:9' | '1:1',
      durationMs,
      scenes: plan.hyperframesScenes,
      captions: plan.script.captions,
      cta: input.campaign?.cta,
      motionStyle: (input.videoStyle?.motionStyle ?? 'cinematic') as any,
    };

    const { html: compositionHtml, css: stylesCss, js: timelineJs, metadata } = generateCompositionHtml(compositionInput);

    await update({
      status: 'hyperframes_generated',
      progressPercent: 50,
      hyperframesCompositionHtml: compositionHtml,
      hyperframesStylesCss: stylesCss,
      hyperframesTimelineJs: timelineJs,
      hyperframesMetadata: metadata as any,
      heygenPayload: plan.heygenPayload as any,
    });

    // Step 6: HeyGen avatar (only if API key configured)
    if (process.env.HEYGEN_API_KEY && input.artist.avatarId && input.artist.voiceId) {
      const heygenVideoId = await generateHeyGenVideo(plan.heygenPayload);
      await update({
        status: 'heygen_processing',
        progressPercent: 65,
        heygenVideoId,
      });

      // Poll for HeyGen completion
      const heygenStatus = await pollHeyGenVideoUntilDone(heygenVideoId, 600000);
      if (heygenStatus.video_url) {
        await update({ heygenVideoUrl: heygenStatus.video_url, progressPercent: 80 });
      }
    }

    // Step 7: HyperFrames render (if CLI available)
    let videoUrl = '';
    try {
      const jobRow = await db.select().from(videoJobs).where(eq(videoJobs.id, jobId)).limit(1);
      const heygenVideoUrl = jobRow[0]?.heygenVideoUrl;

      // Inject avatar video URL into scenes
      if (heygenVideoUrl) {
        plan.hyperframesScenes.forEach(s => {
          if (!s.avatarVideoUrl) s.avatarVideoUrl = heygenVideoUrl;
        });
        compositionInput.scenes = plan.hyperframesScenes;
      }

      await update({ status: 'rendering', progressPercent: 85 });
      const renderResult = await renderHyperFramesComposition(compositionInput);
      videoUrl = renderResult.videoUrl;
    } catch (renderErr: any) {
      logger.warn(`[AIVideoStudio] Render skipped (HyperFrames not installed): ${renderErr.message}`);
      // Fall back to composition files only
    }

    // Step 8: Save video output
    if (videoUrl) {
      await db.insert(videoOutputs).values({
        jobId,
        artistId: input.artist.id,
        videoUrl,
        format: input.campaign?.format ?? '9:16',
        durationSeconds: input.campaign?.durationSeconds ?? 30,
      } as any);
    }

    // Mark complete
    await update({ status: 'completed', progressPercent: 100 });
    logger.info(`[AIVideoStudio] Job ${jobId} completed. Video: ${videoUrl || '(composition only)'}`);

  } catch (err: any) {
    logger.error(`[AIVideoStudio] Job ${jobId} failed: ${err.message}`);
    await db.update(videoJobs)
      .set({ status: 'failed', errorMessage: err.message.slice(0, 500), updatedAt: new Date() } as any)
      .where(eq(videoJobs.id, jobId));
  }
}

// ─── GET /:artistId/jobs ──────────────────────────────────────────────────────
router.get('/:artistId/jobs', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { limit = '20', offset = '0' } = req.query as Record<string, string>;

  try {
    const jobs = await db.select().from(videoJobs)
      .where(eq(videoJobs.artistId, artistId))
      .orderBy(desc(videoJobs.createdAt))
      .limit(Math.min(Number(limit), 50))
      .offset(Number(offset));

    res.json({ success: true, jobs, total: jobs.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/jobs/:jobId ───────────────────────────────────────────────
router.get('/:artistId/jobs/:jobId', authenticate, async (req: Request, res: Response) => {
  const { artistId, jobId } = req.params;

  try {
    const [job] = await db.select().from(videoJobs)
      .where(and(eq(videoJobs.id, Number(jobId)), eq(videoJobs.artistId, artistId)));

    if (!job) return res.status(404).json({ success: false, error: 'Job not found' });

    // Fetch output if completed
    let output = null;
    if (job.status === 'completed') {
      const [out] = await db.select().from(videoOutputs).where(eq(videoOutputs.jobId, job.id));
      output = out ?? null;
    }

    // If heygen_processing, poll live status
    let liveHeygenStatus = null;
    if (job.status === 'heygen_processing' && job.heygenVideoId) {
      try {
        liveHeygenStatus = await getHeyGenVideoStatus(job.heygenVideoId);
        // Auto-update if heygen completed
        if (liveHeygenStatus.status === 'completed' && liveHeygenStatus.video_url) {
          await db.update(videoJobs)
            .set({ heygenVideoUrl: liveHeygenStatus.video_url, updatedAt: new Date() } as any)
            .where(eq(videoJobs.id, job.id));
        }
      } catch { /* ignore polling errors */ }
    }

    res.json({ success: true, job, output, liveHeygenStatus });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:artistId/jobs/:jobId ────────────────────────────────────────────
router.delete('/:artistId/jobs/:jobId', authenticate, async (req: Request, res: Response) => {
  const { artistId, jobId } = req.params;

  try {
    await db.delete(videoJobs)
      .where(and(eq(videoJobs.id, Number(jobId)), eq(videoJobs.artistId, artistId)));
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /webhooks/heygen ────────────────────────────────────────────────────
// HeyGen sends webhook when video generation completes
router.post('/webhooks/heygen', async (req: Request, res: Response) => {
  const { event_type, event_data } = req.body;

  logger.info(`[AIVideoStudio] HeyGen webhook: ${event_type}`);

  if (event_type === 'avatar_video.success') {
    const { video_id, video_url, thumbnail_url } = event_data ?? {};
    if (video_id && video_url) {
      try {
        await db.update(videoJobs)
          .set({ heygenVideoUrl: video_url, status: 'rendering', progressPercent: 80, updatedAt: new Date() } as any)
          .where(eq(videoJobs.heygenVideoId, video_id));
        logger.info(`[AIVideoStudio] HeyGen video ready: ${video_id}`);
      } catch (err: any) {
        logger.error(`[AIVideoStudio] Webhook DB update failed: ${err.message}`);
      }
    }
  }

  if (event_type === 'avatar_video.fail') {
    const { video_id, error } = event_data ?? {};
    if (video_id) {
      await db.update(videoJobs)
        .set({ status: 'failed', errorMessage: error || 'HeyGen video failed', updatedAt: new Date() } as any)
        .where(eq(videoJobs.heygenVideoId, video_id));
    }
  }

  res.json({ received: true });
});

// ─── Scene presets for Artist Avatar Scene Generator ──────────────────────────

const AVATAR_SCENE_PRESETS = [
  {
    id: 'recording_studio',
    label: 'Recording Studio',
    icon: '🎙️',
    prompt: 'Professional music recording session inside a modern recording studio booth. Acoustic foam panels on walls, professional condenser microphone, warm amber studio lighting, authentic artist portrait, ultra photorealistic',
  },
  {
    id: 'urban_street',
    label: 'Urban Street',
    icon: '🌆',
    prompt: 'Standing on an urban city street, downtown environment, graffiti walls, streetwear aesthetic, candid natural golden hour lighting, documentary-style, ultra photorealistic portrait',
  },
  {
    id: 'concert_stage',
    label: 'Concert Stage',
    icon: '🎤',
    prompt: 'Performing live on a concert stage, dramatic multi-color spotlights, microphone in hand, crowd silhouettes blurred in background, epic live performance energy, ultra photorealistic',
  },
  {
    id: 'backstage',
    label: 'Backstage',
    icon: '🎭',
    prompt: 'Backstage before a live show, mirror ringed with Hollywood bulb lights, casual pre-show atmosphere, authentic behind-the-scenes mood, warm dressing room lighting, ultra photorealistic portrait',
  },
  {
    id: 'rooftop_night',
    label: 'Rooftop at Night',
    icon: '🌃',
    prompt: 'Standing on a city rooftop at night, bokeh city lights in background, cool cinematic tones with warm rim light, moody atmospheric, ultra photorealistic',
  },
  {
    id: 'music_video_set',
    label: 'Music Video Set',
    icon: '🎬',
    prompt: 'On a professional music video production set, dramatic creative lighting, colorful artistic direction, high production value, camera crew gear subtly visible, ultra photorealistic',
  },
  {
    id: 'outdoor_festival',
    label: 'Music Festival',
    icon: '🎪',
    prompt: 'At an outdoor music festival during golden hour, warm sunset light, festival wristbands, crowd and stage visible in background, vibrant energetic mood, ultra photorealistic',
  },
  {
    id: 'home_studio',
    label: 'Home Studio',
    icon: '🏠',
    prompt: 'Working in a cozy home studio setup, glowing computer screen with DAW software, studio monitor speakers, bedroom producer aesthetic, intimate creative atmosphere, ultra photorealistic portrait',
  },
] as const;

// ─── POST /:artistId/generate-avatar-scenes ───────────────────────────────────
router.post('/:artistId/generate-avatar-scenes', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { profileImageUrl: bodyImageUrl, scenes: requestedScenes } = req.body as {
    profileImageUrl?: string;
    scenes?: string[];
  };

  try {
    // Resolve artist to get profile image if not supplied
    let profileImageUrl = bodyImageUrl;
    if (!profileImageUrl) {
      const artist = await resolveArtist(artistId);
      profileImageUrl = artist?.profile_image || artist?.profileImage || null;
    }

    if (!profileImageUrl) {
      return res.status(400).json({ success: false, error: 'No profile image available. Please provide profileImageUrl.' });
    }

    // Filter presets to the requested scenes, or use all
    const presets = requestedScenes && requestedScenes.length > 0
      ? AVATAR_SCENE_PRESETS.filter(p => requestedScenes.includes(p.id))
      : [...AVATAR_SCENE_PRESETS];

    if (presets.length === 0) {
      return res.status(400).json({ success: false, error: 'No valid scenes requested.' });
    }

    // Generate all scenes in parallel
    const results = await Promise.allSettled(
      presets.map(async (scene) => {
        const output = await generateKontextImage({
          basePrompt: scene.prompt,
          style: 'cinematic',
          referenceImageUrl: profileImageUrl!,
          aspectRatio: '4:5',
          numImages: 1,
        });
        return {
          scene: scene.id,
          label: scene.label,
          icon: scene.icon,
          imageUrl: output.imageUrls[0] ?? null,
          prompt: output.prompt,
        };
      })
    );

    const scenes = results
      .map((r, i) => {
        if (r.status === 'fulfilled') return r.value;
        logger.warn(`[AvatarScenes] Scene "${presets[i].id}" failed: ${(r as PromiseRejectedResult).reason?.message}`);
        return {
          scene: presets[i].id,
          label: presets[i].label,
          icon: presets[i].icon,
          imageUrl: null,
          error: (r as PromiseRejectedResult).reason?.message ?? 'Generation failed',
        };
      });

    return res.json({ success: true, scenes, profileImageUrl });
  } catch (err: any) {
    logger.error(`[AvatarScenes] Error: ${err.message}`);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/create-photo-avatar ──────────────────────────────────────
router.post('/:artistId/create-photo-avatar', async (req: Request, res: Response) => {
  const { imageUrl, avatarName } = req.body as { imageUrl: string; avatarName?: string };

  if (!imageUrl) {
    return res.status(400).json({ success: false, error: 'imageUrl is required' });
  }

  const HEYGEN_KEY = process.env.HEYGEN_API_KEY;
  if (!HEYGEN_KEY) {
    return res.status(500).json({ success: false, error: 'HeyGen API key not configured' });
  }

  try {
    const headers = {
      'x-api-key': HEYGEN_KEY,
      'Content-Type': 'application/json',
    };

    // Try v2 photo_avatar endpoint first
    const response = await axios.post(
      'https://api.heygen.com/v2/photo_avatar',
      { image_url: imageUrl, name: avatarName || 'Artist Photo Avatar' },
      { headers, timeout: 60_000 }
    );

    const data = response.data?.data ?? response.data ?? {};
    const avatarId =
      data.photo_avatar_id ||
      data.talking_photo_id ||
      data.avatar_id ||
      data.id ||
      null;

    if (!avatarId) {
      logger.warn(`[PhotoAvatar] Unexpected HeyGen response: ${JSON.stringify(response.data)}`);
      return res.status(502).json({ success: false, error: 'HeyGen did not return an avatar ID', raw: response.data });
    }

    logger.info(`[PhotoAvatar] Created photo avatar: ${avatarId}`);
    return res.json({ success: true, avatarId, previewUrl: imageUrl, raw: data });
  } catch (err: any) {
    const status = err.response?.status ?? 500;
    const msg = err.response?.data?.message || err.message;
    logger.error(`[PhotoAvatar] HeyGen error ${status}: ${msg}`);
    return res.status(status >= 400 && status < 600 ? status : 500).json({ success: false, error: msg });
  }
});

export default router;
