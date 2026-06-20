/**
 * Influencer Content Routes — API for the Influencer Module
 * 
 * Voice, Avatar, Content Generation, Publishing & Scheduling
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import crypto from 'crypto';
import { db } from '../../db';
import {
  influencerContent,
  influencerScheduleConfig,
  users,
  userCreatedArtists,
  instagramExtensionConnections,
  instagramPendingActions,
  socialMediaPosts,
} from '../../db/schema';
import { eq, desc, and, lte, isNotNull } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { storage } from '../firebase';

// Services
import { cloneInfluencerVoice, cloneInfluencerVoiceFromBuffer, generateInfluencerSpeech, getVoiceProfile, deleteVoiceProfile, listElevenLabsVoices, setupGeminiVoice, GEMINI_VOICES } from '../services/influencer-voice-service';
import { createInfluencerAvatar, getAvatarProfile, deleteAvatarProfile } from '../services/influencer-avatar-service';
import { generateInfluencerScript, suggestTopics } from '../services/influencer-script-service';
import { runInfluencerPipeline, getPipelineStatus } from '../services/influencer-pipeline';
import {
  generateImageWithNanoBanana,
  editImageWithGPTImage2,
  generateVideoWithHappyHorse,
  generateVideoFromReferenceWithHappyHorse,
} from '../services/fal-service';
import { chargeCreditsFromUsd, canAffordUsd, getUserBalance } from '../services/credit-engine';

const router = Router();

// Multer for voice file uploads (memory storage, 25MB max)
const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/wave', 'audio/x-wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/m4a', 'audio/x-m4a'];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|webm|m4a)$/i)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported audio format: ${file.mimetype}`));
    }
  }
});

// Multer for avatar image uploads (memory storage, 10MB each, max 4 images)
const avatarImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(png|jpe?g|webp|heic|heif)$/i.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported image format: ${file.mimetype}`));
    }
  }
});

async function uploadBufferToFirebase(
  buffer: Buffer,
  mimeType: string,
  folder: string,
  fileName: string,
): Promise<string> {
  if (!storage) throw new Error('Storage not configured on server');
  const ext = (fileName.includes('.') ? fileName.split('.').pop() : '') || mimeType.split('/')[1] || 'jpg';
  const safeBase = fileName.replace(/[^\w\-]+/g, '-').replace(/-+/g, '-').slice(0, 60) || 'image';
  const objectPath = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${safeBase}.${ext}`;
  const bucket = storage.bucket();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType: mimeType,
    resumable: false,
    metadata: {
      cacheControl: 'public, max-age=31536000, immutable',
    },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;
}

// ═══════════════════════════════════════════
// VOICE ENDPOINTS
// ═══════════════════════════════════════════

/** POST /voice/upload — Clone voice from uploaded file (ElevenLabs) */
router.post('/voice/upload', voiceUpload.single('audio'), async (req: Request, res: Response) => {
  try {
    const { userId, voiceName, language } = req.body;
    if (!userId || !req.file) {
      return res.status(400).json({ error: 'userId and audio file required' });
    }

    const result = await cloneInfluencerVoiceFromBuffer(
      Number(userId),
      req.file.buffer,
      req.file.originalname,
      voiceName || 'My Voice',
      language || 'en'
    );

    res.json(result);
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] voice/upload error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/** POST /voice/create — Clone voice from audio URL */
router.post('/voice/create', async (req: Request, res: Response) => {
  try {
    const { userId, audioSampleUrl, voiceName, language } = req.body;
    if (!userId || !audioSampleUrl) {
      return res.status(400).json({ error: 'userId and audioSampleUrl required' });
    }

    const result = await cloneInfluencerVoice(
      Number(userId),
      audioSampleUrl,
      voiceName || 'My Voice',
      language || 'en'
    );

    res.json(result);
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] voice/create error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/** GET /voice/:userId — Get voice profile */
router.get('/voice/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await getVoiceProfile(Number(req.params.userId));
    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** DELETE /voice/:userId — Delete voice profile */
router.delete('/voice/:userId', async (req: Request, res: Response) => {
  try {
    await deleteVoiceProfile(Number(req.params.userId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /voices/library — List available ElevenLabs voices */
router.get('/voices/library', async (_req: Request, res: Response) => {
  try {
    const voices = await listElevenLabsVoices();
    res.json({ voices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /voices/gemini — List available Gemini TTS preset voices */
router.get('/voices/gemini', (_req: Request, res: Response) => {
  res.json({ voices: GEMINI_VOICES });
});

/** POST /voice/gemini-setup — Set up a Gemini TTS voice profile (no file upload) */
router.post('/voice/gemini-setup', async (req: Request, res: Response) => {
  try {
    const { userId, voiceName, geminiVoiceId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const result = await setupGeminiVoice(
      Number(userId),
      voiceName || 'My Voice',
      geminiVoiceId || 'Aoede',
    );
    res.json(result);
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] voice/gemini-setup error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// AVATAR ENDPOINTS
// ═══════════════════════════════════════════

/** POST /avatar/create — Create HeyGen avatar from photo */
router.post('/avatar/create', async (req: Request, res: Response) => {
  try {
    const { userId, imageUrl, avatarStyle } = req.body;
    if (!userId || !imageUrl) {
      return res.status(400).json({ error: 'userId and imageUrl required' });
    }

    const result = await createInfluencerAvatar(
      Number(userId),
      imageUrl,
      avatarStyle || 'casual'
    );

    res.json(result);
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] avatar/create error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/** GET /avatar/:userId — Get avatar profile */
router.get('/avatar/:userId', async (req: Request, res: Response) => {
  try {
    const profile = await getAvatarProfile(Number(req.params.userId));
    res.json({ profile });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** DELETE /avatar/:userId — Delete avatar profile */
router.delete('/avatar/:userId', async (req: Request, res: Response) => {
  try {
    await deleteAvatarProfile(Number(req.params.userId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /profile-image/:userId — Return the artist's current profile photo (used as avatar fallback preview) */
router.get('/profile-image/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const [user] = await db.select({
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
    })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    let imageUrl: string | null = user?.profileImage || user?.profileImageUrl || null;

    if (!imageUrl) {
      const [aiArtist] = await db.select({ avatarUrl: userCreatedArtists.avatarUrl })
        .from(userCreatedArtists)
        .where(eq(userCreatedArtists.artistUserId, userId))
        .limit(1);
      imageUrl = aiArtist?.avatarUrl || null;
    }

    res.json({ imageUrl });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /avatar/auto-create — Create avatar using the artist's own profile image
 * Looks up profileImage from the users table — no manual URL needed.
 */
router.post('/avatar/auto-create', async (req: Request, res: Response) => {
  try {
    const { userId, avatarStyle } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Try several sources to locate the artist's profile/face image.
    // 1) users.profileImage  2) users.profileImageUrl  3) userCreatedArtists.avatarUrl (AI artists)
    const [user] = await db.select({
      profileImage: users.profileImage,
      profileImageUrl: users.profileImageUrl,
    })
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    let imageUrl: string | null = user?.profileImage || user?.profileImageUrl || null;

    if (!imageUrl) {
      const [aiArtist] = await db.select({ avatarUrl: userCreatedArtists.avatarUrl })
        .from(userCreatedArtists)
        .where(eq(userCreatedArtists.artistUserId, Number(userId)))
        .limit(1);
      imageUrl = aiArtist?.avatarUrl || null;
    }

    if (!imageUrl) {
      return res.status(400).json({ error: 'Artist has no profile image set. Upload a profile photo first.' });
    }

    const result = await createInfluencerAvatar(
      Number(userId),
      imageUrl,
      avatarStyle || 'casual',
    );

    res.json({ ...result, imageUrl });
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] avatar/auto-create error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /avatar/create-multi — Upload up to 4 images and create avatar
 * Form data: userId, avatarStyle (optional), images[] (1-4 image files)
 * Uses the first image as the primary HeyGen avatar source; the rest are stored
 * as reference images (returned to the client; useful for future multi-shot avatars).
 */
router.post('/avatar/create-multi', avatarImageUpload.array('images', 4), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.body.userId || (req as any).auth?.userId || (req as any).user?.id);
    const avatarStyle = req.body.avatarStyle || 'casual';
    const files = (req.files as Express.Multer.File[]) || [];

    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (files.length === 0) return res.status(400).json({ error: 'At least one image is required' });

    // Upload all images to Firebase
    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const url = await uploadBufferToFirebase(
        f.buffer,
        f.mimetype,
        `influencer-avatars/${userId}`,
        `avatar-${i}-${(f.originalname || 'photo').replace(/\s+/g, '-')}`,
      );
      uploadedUrls.push(url);
    }

    const primaryImageUrl = uploadedUrls[0];
    const referenceImageUrls = uploadedUrls.slice(1);

    const result = await createInfluencerAvatar(userId, primaryImageUrl, avatarStyle);

    res.json({
      ...result,
      primaryImageUrl,
      referenceImageUrls,
      uploadedUrls,
    });
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] avatar/create-multi error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// PUBLISH BRIDGES — Instagram (via extension queue) & TikTok
// ═══════════════════════════════════════════

/**
 * POST /content/:id/publish-instagram — Queue an Instagram publish via the
 * Chrome extension. Inserts a row into instagramPendingActions; the extension
 * picks it up on its next sync cycle.
 */
router.post('/content/:id/publish-instagram', async (req: Request, res: Response) => {
  try {
    const contentId = Number(req.params.id);
    const userId = Number(req.body.userId || (req as any).auth?.userId || (req as any).user?.id);
    const captionOverride: string | undefined = req.body.caption;
    const postType: 'reel' | 'post' = req.body.postType === 'post' ? 'post' : 'reel';

    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Look up content + verify ownership
    const [content] = await db.select().from(influencerContent).where(eq(influencerContent.id, contentId)).limit(1);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (content.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const mediaUrl = content.finalVideoUrl || content.avatarVideoUrl;
    if (!mediaUrl) return res.status(400).json({ error: 'Content has no published video yet' });

    // Look up user's IG extension connection
    const [connection] = await db.select()
      .from(instagramExtensionConnections)
      .where(and(
        eq(instagramExtensionConnections.userId, userId),
        eq(instagramExtensionConnections.status, 'active'),
      ))
      .orderBy(desc(instagramExtensionConnections.createdAt))
      .limit(1);

    if (!connection) {
      return res.status(400).json({
        error: 'No active Instagram connection. Install the Boostify Chrome extension and connect your Instagram account.',
        needsExtension: true,
      });
    }

    // Build caption
    const hashtagsArr: string[] = Array.isArray(content.hashtags) ? content.hashtags : [];
    const baseCaption = captionOverride || content.title || content.topic;
    const caption = `${baseCaption}${hashtagsArr.length ? '\n\n' + hashtagsArr.map(h => h.startsWith('#') ? h : `#${h}`).join(' ') : ''}`;

    // Queue the action — extension polls instagram_pending_actions
    const [action] = await db.insert(instagramPendingActions).values({
      userId,
      connectionId: connection.id,
      actionType: postType === 'reel' ? 'post_reel' : 'post_caption',
      payload: {
        mediaUrl,
        caption,
        contentId,
        title: content.title,
        thumbnailUrl: content.thumbnailUrl,
      },
      generatedBy: 'influencer-module',
      priority: 5,
    }).returning();

    // Mark content as published-to-IG
    await db.update(influencerContent)
      .set({ status: 'published', publishedAt: new Date(), platform: 'instagram', updatedAt: new Date() })
      .where(eq(influencerContent.id, contentId));

    res.json({
      success: true,
      actionId: action.id,
      connectionUsername: connection.instagramUsername,
      message: `Queued for @${connection.instagramUsername}. The Chrome extension will publish on its next sync.`,
    });
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] publish-instagram error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /content/:id/publish-tiktok — Queue a TikTok publish.
 * No native extension queue exists yet, so we record the intent in
 * social_media_posts (isPublished=false). A worker / future TikTok extension
 * picks it up. Returns the media URL so the user can also publish manually.
 */
router.post('/content/:id/publish-tiktok', async (req: Request, res: Response) => {
  try {
    const contentId = Number(req.params.id);
    const userId = Number(req.body.userId || (req as any).auth?.userId || (req as any).user?.id);
    const captionOverride: string | undefined = req.body.caption;

    if (!userId) return res.status(400).json({ error: 'userId required' });

    const [content] = await db.select().from(influencerContent).where(eq(influencerContent.id, contentId)).limit(1);
    if (!content) return res.status(404).json({ error: 'Content not found' });
    if (content.userId !== userId) return res.status(403).json({ error: 'Not authorized' });

    const mediaUrl = content.finalVideoUrl || content.avatarVideoUrl;
    if (!mediaUrl) return res.status(400).json({ error: 'Content has no published video yet' });

    const hashtagsArr: string[] = Array.isArray(content.hashtags) ? content.hashtags : [];
    const caption = captionOverride || content.title || content.topic;

    const [post] = await db.insert(socialMediaPosts).values({
      userId,
      platform: 'tiktok',
      caption,
      hashtags: hashtagsArr.length ? hashtagsArr : ['boostify'],
      cta: 'Watch full video on my profile',
      isPublished: false, // queued
    }).returning();

    await db.update(influencerContent)
      .set({ status: 'published', publishedAt: new Date(), platform: 'tiktok', updatedAt: new Date() })
      .where(eq(influencerContent.id, contentId));

    res.json({
      success: true,
      postId: post.id,
      mediaUrl,
      caption,
      message: 'Queued for TikTok. Use the download link below to publish manually until the TikTok extension ships.',
    });
  } catch (error: any) {
    logger.error(`[InfluencerRoutes] publish-tiktok error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// CONTENT GENERATION
// ═══════════════════════════════════════════

/** POST /content/generate-script — Generate only the script */
router.post('/content/generate-script', async (req: Request, res: Response) => {
  try {
    const { userId, topic, contentType, targetDurationSec, language, customPrompt } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const script = await generateInfluencerScript(Number(userId), {
      topic, contentType, targetDurationSec, language, customPrompt,
    });

    res.json(script);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /content/generate — Run full pipeline (script → voice → avatar → video) */
router.post('/content/generate', async (req: Request, res: Response) => {
  try {
    const { userId, topic, contentType, targetDurationSec, language, customPrompt, existingContentId } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    // Run pipeline asynchronously — return immediately with content ID
    const pipelinePromise = runInfluencerPipeline(Number(userId), {
      topic, contentType, targetDurationSec, language, customPrompt,
      existingContentId: existingContentId ? Number(existingContentId) : undefined,
    });

    // For short content, wait up to 5 seconds for script step
    const raceResult = await Promise.race([
      pipelinePromise,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
    ]);

    if (raceResult && (raceResult as any).success !== undefined) {
      return res.json(raceResult);
    }

    // Pipeline still running — return status
    res.json({
      success: true,
      status: 'generating',
      message: 'Pipeline started. Poll /content/:id/status for progress.',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /content/:id/status — Get pipeline status */
router.get('/content/:id/status', async (req: Request, res: Response) => {
  try {
    const status = await getPipelineStatus(Number(req.params.id));
    if (!status) return res.status(404).json({ error: 'Content not found' });
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /content/published/:userId — Public: only published content (must be before :userId param route) */
router.get('/content/published/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const content = await db.select().from(influencerContent)
      .where(and(
        eq(influencerContent.userId, userId),
        eq(influencerContent.status, 'published')
      ))
      .orderBy(desc(influencerContent.publishedAt))
      .limit(20);

    res.json({ content });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** GET /content/:userId — List all influencer content for a user */
router.get('/content/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const limit = Number(req.query.limit) || 20;
    const offset = Number(req.query.offset) || 0;
    const statusFilter = req.query.status as string;

    let query = db.select().from(influencerContent)
      .where(eq(influencerContent.userId, userId))
      .orderBy(desc(influencerContent.createdAt))
      .limit(limit)
      .offset(offset);

    const content = await query;

    // Filter by status in JS if needed (drizzle dynamic where can be tricky)
    const filtered = statusFilter
      ? content.filter(c => c.status === statusFilter)
      : content;

    res.json({ content: filtered, total: filtered.length });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PATCH /content/:id/publish — Publish content */
router.patch('/content/:id/publish', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const { platform } = req.body;

    await db.update(influencerContent)
      .set({
        status: 'published',
        publishedAt: new Date(),
        platform: platform || 'internal',
        updatedAt: new Date(),
      })
      .where(eq(influencerContent.id, id));

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** DELETE /content/:id — Delete content */
router.delete('/content/:id', async (req: Request, res: Response) => {
  try {
    await db.delete(influencerContent)
      .where(eq(influencerContent.id, Number(req.params.id)));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// TOPICS
// ═══════════════════════════════════════════

/** POST /topics/suggest — Get AI-suggested topics */
router.post('/topics/suggest', async (req: Request, res: Response) => {
  try {
    const { userId, count } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId required' });

    const topics = await suggestTopics(Number(userId), count || 5);
    res.json({ topics });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════
// SCHEDULE CONFIG
// ═══════════════════════════════════════════

/** GET /schedule/:userId — Get schedule config */
router.get('/schedule/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const [config] = await db.select()
      .from(influencerScheduleConfig)
      .where(eq(influencerScheduleConfig.userId, userId))
      .limit(1);

    if (!config) {
      // Return defaults
      return res.json({
        config: {
          frequency: 'weekly',
          preferredHour: 12,
          preferredDayOfWeek: 3,
          autoPublish: false,
          autoGenerate: true,
          topics: ['trending', 'behind_scenes', 'music_industry', 'tips', 'opinion'],
          isActive: false,
        },
      });
    }

    res.json({ config });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** PUT /schedule/:userId — Update schedule config */
router.put('/schedule/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    const { frequency, customIntervalHours, preferredHour, preferredDayOfWeek, autoPublish, autoGenerate, topics, isActive } = req.body;

    const [existing] = await db.select()
      .from(influencerScheduleConfig)
      .where(eq(influencerScheduleConfig.userId, userId))
      .limit(1);

    const data = {
      frequency: frequency || 'weekly',
      customIntervalHours: customIntervalHours || null,
      preferredHour: preferredHour ?? 12,
      preferredDayOfWeek: preferredDayOfWeek ?? 3,
      autoPublish: autoPublish ?? false,
      autoGenerate: autoGenerate ?? true,
      topics: topics || ['trending', 'behind_scenes', 'music_industry'],
      isActive: isActive ?? true,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.update(influencerScheduleConfig)
        .set(data)
        .where(eq(influencerScheduleConfig.userId, userId));
    } else {
      await db.insert(influencerScheduleConfig).values({ userId, ...data });
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// =====================================================================
// 🔥 VIRAL CONTENT STUDIO ROUTES
// =====================================================================
// Pipeline: prompt-engineering → imagen viral → (opcional edit) → video 5-15s
// Modelos: nano-banana-2 / gpt-image-2/edit / happy-horse i2v / happy-horse r2v
// Promotion targets: song | video | merch | service (boostifymusic.com/create-artist)

const VIRAL_PROMOTION_FOOTERS: Record<string, string> = {
  song: 'Hyper-share-worthy social moment promoting a new song release. Include implied music energy, audio-reactive visual cues, vertical 9:16 framing, dynamic hook in the first second.',
  video: 'TikTok/Reels-ready scroll-stopper announcing a new music video. Cinematic but raw, gen-Z native pacing, instant hook, vertical 9:16, bold contrast.',
  merch: 'Product-forward viral content. The product is the hero — clear silhouette, satisfying motion, premium retail aesthetic, vertical 9:16, copy-friendly negative space.',
  service: 'Promotional content for the BOOSTIFY artist creation platform (boostifymusic.com/create-artist). Aspirational vibe of "becoming an AI-powered artist", futuristic neon-glass aesthetic, transformation moment, vertical 9:16, strong CTA framing.',
};

function buildViralPrompt(basePrompt: string, target: string, artistName?: string): string {
  const footer = VIRAL_PROMOTION_FOOTERS[target] || VIRAL_PROMOTION_FOOTERS['service'];
  const artistTag = artistName ? `Featuring artist "${artistName}". ` : '';
  return `${artistTag}${basePrompt}\n\nVIRAL DIRECTIVES: ${footer} Composition optimized for social feeds: bold subject, clean background, high color contrast, eye-catching micro-detail, no on-image text, no watermarks.`.trim();
}

// Coste interno (USD) por operación viral. Se multiplica por el markup global.
const VIRAL_COSTS_USD = {
  image: 0.04,        // nano-banana-2
  imageEdit: 0.08,    // gpt-image-2/edit (BYOK)
  videoI2vPerSec: 0.15, // happy-horse i2v
  videoR2vPerSec: 0.18, // happy-horse r2v
};

/**
 * POST /viral/estimate-cost
 * Calcula el coste total (créditos + USD) ANTES de generar.
 * Body: { steps: ('image'|'imageEdit'|'i2v'|'r2v')[], duration?: 5|10|15 }
 */
router.post('/viral/estimate-cost', async (req: Request, res: Response) => {
  try {
    const { steps = [], duration = 10 } = req.body as {
      steps: Array<'image' | 'imageEdit' | 'i2v' | 'r2v'>;
      duration?: 5 | 10 | 15;
    };
    const dur = Math.min(15, Math.max(5, Number(duration) || 10));

    const breakdown: Array<{ step: string; usd: number; credits: number }> = [];
    let totalUsd = 0;

    for (const step of steps) {
      let usd = 0;
      let label = step;
      if (step === 'image') { usd = VIRAL_COSTS_USD.image; label = 'Viral Image (Nano Banana 2)'; }
      else if (step === 'imageEdit') { usd = VIRAL_COSTS_USD.imageEdit; label = 'Image Edit (GPT-Image-2)'; }
      else if (step === 'i2v') { usd = VIRAL_COSTS_USD.videoI2vPerSec * dur; label = `Image-to-Video (Happy Horse, ${dur}s)`; }
      else if (step === 'r2v') { usd = VIRAL_COSTS_USD.videoR2vPerSec * dur; label = `Reference-to-Video (Happy Horse, ${dur}s)`; }
      else continue;

      const credits = await (await import('../services/credit-engine')).getCreditCostFromUsd(usd);
      breakdown.push({ step: label, usd: Number(usd.toFixed(4)), credits });
      totalUsd += usd;
    }

    const totalCredits = breakdown.reduce((acc, b) => acc + b.credits, 0);

    // Balance del usuario (si proporciona email)
    let balance: number | null = null;
    if (req.body.userEmail) {
      const b = await getUserBalance(req.body.userEmail);
      balance = b.credits;
    }

    res.json({
      success: true,
      duration: dur,
      totalUsd: Number(totalUsd.toFixed(4)),
      totalCredits,
      totalUserPriceUsd: totalCredits / 100,
      breakdown,
      userBalance: balance,
      canAfford: balance === null ? null : balance >= totalCredits,
    });
  } catch (error: any) {
    logger.error(`[ViralStudio] estimate-cost error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /viral/generate-image
 * Genera una imagen viral inicial (nano-banana-2) lista para convertir a video.
 * Body: { userId, userEmail, prompt, target, artistName?, aspectRatio? }
 */
router.post('/viral/generate-image', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, prompt, target = 'service', artistName, aspectRatio = '9:16' } = req.body;
    if (!userId || !prompt) return res.status(400).json({ error: 'userId & prompt required' });

    // Pre-check balance
    if (userEmail) {
      const afford = await canAffordUsd(userEmail, VIRAL_COSTS_USD.image);
      if (!afford.allowed) return res.status(402).json({ error: 'Insufficient credits', ...afford });
    }

    const finalPrompt = buildViralPrompt(prompt, target, artistName);
    const result = await generateImageWithNanoBanana(finalPrompt, { aspectRatio: aspectRatio as any });

    if (!result.success) return res.status(502).json({ error: result.error || 'Image generation failed' });

    // Charge credits post-success
    let charged: any = null;
    if (userEmail) {
      charged = await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.image, 'Viral Image (Nano Banana 2)');
    }

    res.json({
      success: true,
      imageUrl: result.imageUrl,
      provider: result.provider,
      finalPrompt,
      charged,
    });
  } catch (error: any) {
    logger.error(`[ViralStudio] generate-image error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /viral/edit-image
 * Edita 1+ imagen(es) con GPT-Image-2 (premium, BYOK).
 * Body: { userId, userEmail, imageUrls[], prompt, target?, aspectRatio? }
 */
router.post('/viral/edit-image', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, imageUrls, prompt, target, aspectRatio = '1:1' } = req.body;
    if (!userId || !prompt || !Array.isArray(imageUrls) || !imageUrls.length) {
      return res.status(400).json({ error: 'userId, prompt & imageUrls[] required' });
    }

    if (userEmail) {
      const afford = await canAffordUsd(userEmail, VIRAL_COSTS_USD.imageEdit);
      if (!afford.allowed) return res.status(402).json({ error: 'Insufficient credits', ...afford });
    }

    const finalPrompt = target ? buildViralPrompt(prompt, target) : prompt;
    const result = await editImageWithGPTImage2(imageUrls, finalPrompt, { aspectRatio });

    if (!result.success) return res.status(502).json({ error: result.error || 'Image edit failed' });

    let charged: any = null;
    if (userEmail) {
      charged = await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.imageEdit, 'Viral Image Edit (GPT-Image-2)');
    }

    res.json({ success: true, imageUrl: result.imageUrl, provider: result.provider, finalPrompt, charged });
  } catch (error: any) {
    logger.error(`[ViralStudio] edit-image error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /viral/image-to-video
 * Convierte una imagen en video viral (happy-horse i2v) hasta 15s.
 * Body: { userId, userEmail, imageUrl, prompt, target, duration?, aspectRatio?, resolution? }
 */
router.post('/viral/image-to-video', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, imageUrl, prompt, target = 'service', artistName,
      duration = 10, aspectRatio = '9:16', resolution = '720p' } = req.body;
    if (!userId || !imageUrl || !prompt) return res.status(400).json({ error: 'userId, imageUrl & prompt required' });

    const dur = Math.min(15, Math.max(5, Number(duration) || 10)) as 5 | 10 | 15;
    const usd = VIRAL_COSTS_USD.videoI2vPerSec * dur;

    if (userEmail) {
      const afford = await canAffordUsd(userEmail, usd);
      if (!afford.allowed) return res.status(402).json({ error: 'Insufficient credits', ...afford });
    }

    const finalPrompt = buildViralPrompt(prompt, target, artistName);
    const result = await generateVideoWithHappyHorse(imageUrl, finalPrompt, {
      duration: dur,
      aspectRatio,
      resolution,
    });

    if (!result.success) return res.status(502).json({ error: result.error || 'Video generation failed' });

    let charged: any = null;
    if (userEmail) {
      charged = await chargeCreditsFromUsd(userEmail, usd, `Viral Video I2V (${dur}s)`);
    }

    // Persistir como influencerContent draft
    try {
      await db.insert(influencerContent).values({
        userId: Number(userId),
        title: `Viral I2V — ${target}`,
        scriptText: finalPrompt,
        topic: target,
        contentType: 'promo',
        targetDurationSec: dur,
        finalVideoUrl: result.videoUrl,
        thumbnailUrl: imageUrl,
        status: 'ready',
        platform: 'all',
        generationCostUsd: String(usd) as any,
      } as any);
    } catch (e: any) {
      logger.warn(`[ViralStudio] Could not persist content row: ${e.message}`);
    }

    res.json({ success: true, videoUrl: result.videoUrl, duration: dur, finalPrompt, charged });
  } catch (error: any) {
    logger.error(`[ViralStudio] image-to-video error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /viral/reference-to-video
 * Crea video viral usando 1-4 imágenes de referencia (producto, persona, escena).
 * Body: { userId, userEmail, referenceImageUrls[], prompt, target, duration?, aspectRatio?, resolution? }
 */
router.post('/viral/reference-to-video', async (req: Request, res: Response) => {
  try {
    const { userId, userEmail, referenceImageUrls, prompt, target = 'merch', artistName,
      duration = 10, aspectRatio = '9:16', resolution = '720p' } = req.body;
    if (!userId || !prompt || !Array.isArray(referenceImageUrls) || !referenceImageUrls.length) {
      return res.status(400).json({ error: 'userId, prompt & referenceImageUrls[] required' });
    }

    const dur = Math.min(15, Math.max(5, Number(duration) || 10)) as 5 | 10 | 15;
    const usd = VIRAL_COSTS_USD.videoR2vPerSec * dur;

    if (userEmail) {
      const afford = await canAffordUsd(userEmail, usd);
      if (!afford.allowed) return res.status(402).json({ error: 'Insufficient credits', ...afford });
    }

    const finalPrompt = buildViralPrompt(prompt, target, artistName);
    const result = await generateVideoFromReferenceWithHappyHorse(referenceImageUrls, finalPrompt, {
      duration: dur,
      aspectRatio,
      resolution,
    });

    if (!result.success) return res.status(502).json({ error: result.error || 'Reference-to-video failed' });

    let charged: any = null;
    if (userEmail) {
      charged = await chargeCreditsFromUsd(userEmail, usd, `Viral Video R2V (${dur}s)`);
    }

    try {
      await db.insert(influencerContent).values({
        userId: Number(userId),
        title: `Viral R2V — ${target}`,
        scriptText: finalPrompt,
        topic: target,
        contentType: 'promo',
        targetDurationSec: dur,
        finalVideoUrl: result.videoUrl,
        thumbnailUrl: referenceImageUrls[0],
        status: 'ready',
        platform: 'all',
        generationCostUsd: String(usd) as any,
      } as any);
    } catch (e: any) {
      logger.warn(`[ViralStudio] Could not persist content row: ${e.message}`);
    }

    res.json({ success: true, videoUrl: result.videoUrl, duration: dur, finalPrompt, charged });
  } catch (error: any) {
    logger.error(`[ViralStudio] reference-to-video error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /viral/generate-full
 * Pipeline completo viral: prompt → imagen viral → (opcional gpt-image-2 edit) → video 15s.
 * Body: {
 *   userId, userEmail, prompt, target, artistName?,
 *   useImageEdit?: boolean, editPrompt?: string,
 *   referenceImageUrls?: string[],   // si se proveen, usa R2V
 *   duration?: 5|10|15, aspectRatio?, resolution?
 * }
 */
router.post('/viral/generate-full', async (req: Request, res: Response) => {
  const startMs = Date.now();
  try {
    const {
      userId, userEmail, prompt, target = 'service', artistName,
      useImageEdit = false, editPrompt,
      referenceImageUrls, duration = 10,
      aspectRatio = '9:16', resolution = '720p',
    } = req.body;

    if (!userId || !prompt) return res.status(400).json({ error: 'userId & prompt required' });

    const dur = Math.min(15, Math.max(5, Number(duration) || 10)) as 5 | 10 | 15;
    const usingReference = Array.isArray(referenceImageUrls) && referenceImageUrls.length > 0;

    // Pre-flight cost
    let totalUsd = 0;
    if (!usingReference) totalUsd += VIRAL_COSTS_USD.image;
    if (useImageEdit) totalUsd += VIRAL_COSTS_USD.imageEdit;
    totalUsd += (usingReference ? VIRAL_COSTS_USD.videoR2vPerSec : VIRAL_COSTS_USD.videoI2vPerSec) * dur;

    if (userEmail) {
      const afford = await canAffordUsd(userEmail, totalUsd);
      if (!afford.allowed) return res.status(402).json({ error: 'Insufficient credits', ...afford });
    }

    const finalPrompt = buildViralPrompt(prompt, target, artistName);
    const steps: any[] = [];
    let workingImageUrl: string | undefined;

    // STEP 1: imagen base (skip si tenemos referencias)
    if (!usingReference) {
      const img = await generateImageWithNanoBanana(finalPrompt, { aspectRatio: aspectRatio as any });
      if (!img.success || !img.imageUrl) {
        return res.status(502).json({ error: `Image generation failed: ${img.error}` });
      }
      workingImageUrl = img.imageUrl;
      steps.push({ step: 'image', imageUrl: img.imageUrl, provider: img.provider });
      if (userEmail) await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.image, 'Viral Image (Nano Banana 2)');
    }

    // STEP 2: edición opcional con gpt-image-2
    if (useImageEdit) {
      const refsForEdit = usingReference ? referenceImageUrls : (workingImageUrl ? [workingImageUrl] : []);
      if (refsForEdit.length) {
        const edited = await editImageWithGPTImage2(refsForEdit, editPrompt || finalPrompt, { aspectRatio: '1:1' });
        if (edited.success && edited.imageUrl) {
          workingImageUrl = edited.imageUrl;
          steps.push({ step: 'imageEdit', imageUrl: edited.imageUrl, provider: edited.provider });
          if (userEmail) await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.imageEdit, 'Viral Image Edit (GPT-Image-2)');
        } else {
          steps.push({ step: 'imageEdit', skipped: true, reason: edited.error });
        }
      }
    }

    // STEP 3: video viral
    let videoResult;
    if (usingReference) {
      videoResult = await generateVideoFromReferenceWithHappyHorse(referenceImageUrls, finalPrompt, {
        duration: dur, aspectRatio, resolution,
      });
      if (videoResult.success && userEmail) {
        await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.videoR2vPerSec * dur, `Viral Video R2V (${dur}s)`);
      }
    } else if (workingImageUrl) {
      videoResult = await generateVideoWithHappyHorse(workingImageUrl, finalPrompt, {
        duration: dur, aspectRatio, resolution,
      });
      if (videoResult.success && userEmail) {
        await chargeCreditsFromUsd(userEmail, VIRAL_COSTS_USD.videoI2vPerSec * dur, `Viral Video I2V (${dur}s)`);
      }
    } else {
      return res.status(500).json({ error: 'No source image available for video generation' });
    }

    if (!videoResult.success) {
      return res.status(502).json({ error: videoResult.error || 'Video generation failed', steps });
    }

    steps.push({ step: usingReference ? 'r2v' : 'i2v', videoUrl: videoResult.videoUrl, duration: dur });

    // Persistir como influencerContent
    try {
      await db.insert(influencerContent).values({
        userId: Number(userId),
        title: `Viral Pipeline — ${target}`,
        scriptText: finalPrompt,
        topic: target,
        contentType: 'promo',
        targetDurationSec: dur,
        finalVideoUrl: videoResult.videoUrl,
        thumbnailUrl: workingImageUrl || referenceImageUrls?.[0],
        status: 'ready',
        platform: 'all',
        generationCostUsd: String(totalUsd) as any,
      } as any);
    } catch (e: any) {
      logger.warn(`[ViralStudio] Could not persist full-pipeline content: ${e.message}`);
    }

    res.json({
      success: true,
      videoUrl: videoResult.videoUrl,
      thumbnailUrl: workingImageUrl || referenceImageUrls?.[0],
      duration: dur,
      finalPrompt,
      steps,
      totalCostUsd: Number(totalUsd.toFixed(4)),
      elapsedMs: Date.now() - startMs,
    });
  } catch (error: any) {
    logger.error(`[ViralStudio] generate-full error: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

export default router;
