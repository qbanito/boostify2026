/**
 * Artist Content Engine - shared content inventory and orchestration plans.
 *
 * This route is intentionally light: it indexes/generated assets first, then
 * creates production plans that the specialized modules can execute.
 */

import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { db as firestoreDb } from '../firebase';
import { logger } from '../utils/logger';
import { listArtistVideoAssets } from '../services/artist-content-library';
import { resolveArtistIdentity } from '../services/artist-identity-resolver';

const router = Router();

type ContentPlatform = 'tiktok' | 'instagram_reels' | 'youtube_shorts' | 'youtube' | 'instagram_feed';
type ContentGoal = 'virality' | 'release' | 'fan_connection' | 'ads' | 'evergreen';
type ApprovalMode = 'auto' | 'review';

interface ContentPackTask {
  id: string;
  module: 'lyrics_video' | 'promo_clips' | 'avatar_talk' | 'ads_autopilot';
  title: string;
  purpose: string;
  status: 'planned' | 'queued' | 'ready';
  dependsOn?: string[];
  outputTypes: string[];
}

function normalizePlatforms(platforms: unknown): ContentPlatform[] {
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return ['tiktok', 'instagram_reels', 'youtube_shorts'];
  }
  const normalized = platforms
    .map(platform => String(platform))
    .filter((platform): platform is ContentPlatform => (
      ['tiktok', 'instagram_reels', 'youtube_shorts', 'youtube', 'instagram_feed'].includes(platform)
    ));
  return normalized.length > 0 ? normalized : ['tiktok', 'instagram_reels', 'youtube_shorts'];
}

function buildPackTasks(goal: ContentGoal): ContentPackTask[] {
  const lyricsTaskId = 'lyrics_timing';
  const promoTaskId = 'promo_clip_batch';
  const avatarTaskId = 'avatar_spokesperson_batch';

  return [
    {
      id: lyricsTaskId,
      module: 'lyrics_video',
      title: goal === 'evergreen' ? 'Full evergreen lyrics video' : 'Lyric timing and hook extraction',
      purpose: 'Transcribe the song, capture word-level timing, and create reusable lyric moments.',
      status: 'planned',
      outputTypes: ['transcript', 'lyrics_video', 'lyric_hooks'],
    },
    {
      id: promoTaskId,
      module: 'promo_clips',
      title: goal === 'ads' ? 'Ad-ready music video variants' : 'Short-form promo clip batch',
      purpose: 'Generate cinematic/lipsync/b-roll variants from the strongest lyric and audio segments.',
      status: 'planned',
      dependsOn: [lyricsTaskId],
      outputTypes: ['vertical_video', 'caption_set', 'thumbnail'],
    },
    {
      id: avatarTaskId,
      module: 'avatar_talk',
      title: goal === 'fan_connection' ? 'Fan connection avatar replies' : 'Artist announcement avatar clips',
      purpose: 'Turn artist persona, song story, and campaign goal into talking-head scripts and videos.',
      status: 'planned',
      dependsOn: [lyricsTaskId],
      outputTypes: ['script', 'avatar_video', 'cta'],
    },
    {
      id: 'autopilot_distribution',
      module: 'ads_autopilot',
      title: 'Calendar and autopilot distribution',
      purpose: 'Schedule a balanced mix of lyrics, promo, avatar, and ad content with optional approval.',
      status: 'planned',
      dependsOn: [promoTaskId, avatarTaskId],
      outputTypes: ['calendar_posts', 'publish_queue'],
    },
  ];
}

router.get('/:artistId/assets/videos', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const result = await listArtistVideoAssets(artistId);
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[ContentEngine] list videos error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:artistId/assets', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const result = await listArtistVideoAssets(artistId);
    const videoCounts = result.videos.reduce<Record<string, number>>((acc, video) => {
      acc[video.source] = (acc[video.source] || 0) + 1;
      return acc;
    }, {});

    return res.json({
      success: true,
      identity: result.identity,
      assets: { videos: result.videos },
      summary: { totalVideos: result.videos.length, videoCounts },
    });
  } catch (err: any) {
    logger.error('[ContentEngine] list assets error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/:artistId/packs', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb.collection('contentEnginePacks')
      .doc(artistId)
      .collection('packs')
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();

    return res.json({ success: true, packs: snap.docs.map(doc => doc.data()) });
  } catch (err: any) {
    logger.error('[ContentEngine] list packs error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/:artistId/generate-pack', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      songId = null,
      songTitle = null,
      goal = 'virality',
      platforms,
      approvalMode = 'auto',
      budgetTier = 'balanced',
    } = req.body || {};

    const normalizedGoal: ContentGoal = ['virality', 'release', 'fan_connection', 'ads', 'evergreen'].includes(String(goal))
      ? String(goal) as ContentGoal
      : 'virality';
    const normalizedApproval: ApprovalMode = approvalMode === 'review' ? 'review' : 'auto';
    const normalizedPlatforms = normalizePlatforms(platforms);
    const identity = await resolveArtistIdentity(artistId);
    const packId = `content_pack_${uuidv4()}`;
    const now = new Date().toISOString();

    const pack = {
      id: packId,
      artistId,
      canonicalArtistId: identity.numericId ? String(identity.numericId) : identity.rawArtistId,
      artistName: identity.artistName,
      songId,
      songTitle,
      goal: normalizedGoal,
      platforms: normalizedPlatforms,
      approvalMode: normalizedApproval,
      budgetTier,
      status: 'planned',
      tasks: buildPackTasks(normalizedGoal),
      createdAt: now,
      updatedAt: now,
    };

    await firestoreDb.collection('contentEnginePacks')
      .doc(artistId)
      .collection('packs')
      .doc(packId)
      .set(pack);

    return res.json({ success: true, pack });
  } catch (err: any) {
    logger.error('[ContentEngine] generate-pack error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;