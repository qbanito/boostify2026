/**
 * Audience Capture Engine — REST API router
 * Mounted at /api/audience-capture
 */
import { Router, Request, Response } from 'express';
import {
  getAudienceProfile,
  upsertAudienceProfile,
  getContentPillars,
  upsertContentPillar,
  scoreContent,
  generateContent,
  generateHooks,
  getWinningPatterns,
  saveMemoryEntry,
  getDailyPlan,
  generateDailyPlan,
} from '../services/audience-capture-engine';
import {
  contentCaptureScores,
  contentExperiments,
  instagramExtensionConnections,
  instagramProfileSnapshots,
  youtubeExtensionConnections,
  youtubeChannelSnapshots,
  spotifyExtensionConnections,
  spotifyProfileSnapshots,
} from '../db/schema';
import { db } from '../db';
import { eq, and, desc } from 'drizzle-orm';
import { logger } from '../utils/logger';
import type { Platform } from '../../shared/types/audience-capture';
import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';

const router = Router();

// ─── Audience Profile ─────────────────────────────────────────────────────────

// GET /api/audience-capture/profile/:artistId
router.get('/profile/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

    const profile = await getAudienceProfile(artistId);
    const pillars = await getContentPillars(artistId);
    return res.json({ success: true, profile, pillars });
  } catch (err: any) {
    logger.error('[AudienceCapture] GET profile error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/audience-capture/profile
router.post('/profile', async (req: Request, res: Response) => {
  try {
    const { artistId, ...data } = req.body;
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const profile = await upsertAudienceProfile(parseInt(artistId, 10), data);
    return res.json({ success: true, profile });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST profile error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/audience-capture/pillars
router.post('/pillars', async (req: Request, res: Response) => {
  try {
    const { artistId, pillar, ...data } = req.body;
    if (!artistId || !pillar) return res.status(400).json({ error: 'artistId and pillar required' });

    const result = await upsertContentPillar(parseInt(artistId, 10), pillar, data);
    return res.json({ success: true, pillar: result });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST pillars error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// Bulk update pillars: POST /api/audience-capture/pillars/bulk
router.post('/pillars/bulk', async (req: Request, res: Response) => {
  try {
    const { artistId, pillars } = req.body;
    if (!artistId || !Array.isArray(pillars)) {
      return res.status(400).json({ error: 'artistId and pillars[] required' });
    }
    const results = await Promise.all(
      pillars.map((p: any) => upsertContentPillar(parseInt(artistId, 10), p.pillar, p)),
    );
    return res.json({ success: true, pillars: results });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST pillars/bulk error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── Content Generation ───────────────────────────────────────────────────────

// POST /api/audience-capture/generate
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const {
      artistId,
      platform = 'instagram',
      goal = 'capture_new_audience',
      contentType = 'hook',
      songId,
      audienceSegment,
      language = 'es',
      duration = '30s',
    } = req.body;

    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const result = await generateContent({
      artistId: parseInt(artistId, 10),
      platform: platform as Platform,
      goal,
      contentType,
      songId,
      audienceSegment,
      language,
      duration,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST generate error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/audience-capture/score
router.post('/score', async (req: Request, res: Response) => {
  try {
    const { artistId, hook, script, caption, cta, platform = 'instagram' } = req.body;
    if (!artistId || !hook) return res.status(400).json({ error: 'artistId and hook required' });

    const score = await scoreContent(parseInt(artistId, 10), { hook, script, caption, cta, platform });
    return res.json({ success: true, score });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST score error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── Hook Generation ──────────────────────────────────────────────────────────

// POST /api/audience-capture/hooks
router.post('/hooks', async (req: Request, res: Response) => {
  try {
    const {
      artistId,
      songId,
      platform = 'instagram',
      count = 10,
      hookType = 'mixed',
    } = req.body;

    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const result = await generateHooks({
      artistId: parseInt(artistId, 10),
      songId,
      platform: platform as Platform,
      count: Math.min(parseInt(count, 10) || 10, 20),
      hookType,
    });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST hooks error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── Winning Patterns Memory ──────────────────────────────────────────────────

// GET /api/audience-capture/memory/:artistId
router.get('/memory/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

    const patterns = await getWinningPatterns(artistId);
    return res.json({ success: true, patterns });
  } catch (err: any) {
    logger.error('[AudienceCapture] GET memory error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/audience-capture/memory
router.post('/memory', async (req: Request, res: Response) => {
  try {
    const { artistId, type, value, platform = 'instagram', score, tags = [] } = req.body;
    if (!artistId || !type || !value) {
      return res.status(400).json({ error: 'artistId, type, and value required' });
    }

    const entry = await saveMemoryEntry(parseInt(artistId, 10), {
      type,
      value,
      platform,
      score,
      tags,
    });
    return res.json({ success: true, entry });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST memory error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── Daily Content Plan ───────────────────────────────────────────────────────

// GET /api/audience-capture/plan/:artistId?date=YYYY-MM-DD
router.get('/plan/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    const date = (req.query.date as string) ?? new Date().toISOString().split('T')[0];
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

    const plan = await getDailyPlan(artistId, date);
    return res.json({ success: true, plan });
  } catch (err: any) {
    logger.error('[AudienceCapture] GET plan error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/audience-capture/plan
router.post('/plan', async (req: Request, res: Response) => {
  try {
    const { artistId, date } = req.body;
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const planDate = date ?? new Date().toISOString().split('T')[0];
    const plan = await generateDailyPlan(parseInt(artistId, 10), planDate);
    return res.json({ success: true, plan });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST plan error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── Experiments ──────────────────────────────────────────────────────────────

// POST /api/audience-capture/experiment
router.post('/experiment', async (req: Request, res: Response) => {
  try {
    const { artistId, songId, hypothesis, platform = 'instagram', budget = 0 } = req.body;
    if (!artistId || !hypothesis) {
      return res.status(400).json({ error: 'artistId and hypothesis required' });
    }

    const [experiment] = await db
      .insert(contentExperiments)
      .values({
        artistId: parseInt(artistId, 10),
        songId: songId ? parseInt(songId, 10) : null,
        hypothesis,
        platform,
        budget: parseInt(budget, 10),
        status: 'draft',
        variations: [],
      })
      .returning();

    return res.json({ success: true, experiment });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST experiment error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/audience-capture/experiment/:id
router.patch('/experiment/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, variations, results, winnerId } = req.body;

    const [updated] = await db
      .update(contentExperiments)
      .set({ status, variations, results, winnerId, updatedAt: new Date() } as any)
      .where(eq(contentExperiments.id, id))
      .returning();

    return res.json({ success: true, experiment: updated });
  } catch (err: any) {
    logger.error('[AudienceCapture] PATCH experiment error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/audience-capture/scores/:artistId
router.get('/scores/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artistId' });

    const scores = await db
      .select()
      .from(contentCaptureScores)
      .where(eq(contentCaptureScores.artistId, artistId))
      .orderBy(desc(contentCaptureScores.createdAt))
      .limit(50);

    return res.json({ success: true, scores });
  } catch (err: any) {
    logger.error('[AudienceCapture] GET scores error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

// ─── AI Auto-Setup ────────────────────────────────────────────────────────────

// ─── Helper: fetch all connected platform data for an artist ─────────────────
async function fetchPlatformData(userId: number) {
  const results: {
    instagram: { connected: boolean; username?: string; followers?: number; following?: number; engagementRate?: number; avgLikes?: number; avgComments?: number; topHashtags?: string[]; recentPosts?: any[]; audienceDemographics?: any; bio?: string } | null;
    youtube: { connected: boolean; channelName?: string; subscribers?: number; totalViews?: number; watchTimeHours?: number; avgViewDuration?: number; topVideos?: any[]; trafficSources?: any; demographics?: any } | null;
    spotify: { connected: boolean; artistName?: string; monthlyListeners?: number; followers?: number; totalStreams?: number; topCities?: any[]; popularity?: number } | null;
  } = { instagram: null, youtube: null, spotify: null };

  try {
    // Instagram
    const [igConn] = await db
      .select({ id: instagramExtensionConnections.id, username: instagramExtensionConnections.instagramUsername, status: instagramExtensionConnections.status })
      .from(instagramExtensionConnections)
      .where(and(eq(instagramExtensionConnections.userId, userId), eq(instagramExtensionConnections.status, 'active')))
      .limit(1);

    if (igConn) {
      const [igSnap] = await db
        .select()
        .from(instagramProfileSnapshots)
        .where(eq(instagramProfileSnapshots.connectionId, igConn.id))
        .orderBy(desc(instagramProfileSnapshots.snapshotAt))
        .limit(1);

      results.instagram = {
        connected: true,
        username: igConn.username || undefined,
        followers: igSnap?.followers || 0,
        following: igSnap?.following || 0,
        engagementRate: igSnap?.engagementRate || 0,
        avgLikes: igSnap?.avgLikes || 0,
        avgComments: igSnap?.avgComments || 0,
        topHashtags: igSnap?.topHashtags || [],
        recentPosts: igSnap?.recentPosts || [],
        audienceDemographics: igSnap?.audienceDemographics || {},
        bio: igSnap?.bio || undefined,
      };
    }
  } catch {}

  try {
    // YouTube
    const [ytConn] = await db
      .select({ id: youtubeExtensionConnections.id, channelName: youtubeExtensionConnections.channelName, status: youtubeExtensionConnections.status })
      .from(youtubeExtensionConnections)
      .where(and(eq(youtubeExtensionConnections.userId, userId), eq(youtubeExtensionConnections.status, 'active')))
      .limit(1);

    if (ytConn) {
      const [ytSnap] = await db
        .select()
        .from(youtubeChannelSnapshots)
        .where(eq(youtubeChannelSnapshots.connectionId, ytConn.id))
        .orderBy(desc(youtubeChannelSnapshots.snapshotAt))
        .limit(1);

      results.youtube = {
        connected: true,
        channelName: ytConn.channelName || undefined,
        subscribers: ytSnap?.subscribers || 0,
        totalViews: ytSnap?.totalViews || 0,
        watchTimeHours: ytSnap?.watchTimeHours || 0,
        avgViewDuration: ytSnap?.avgViewDuration || 0,
        topVideos: ytSnap?.topVideos || [],
        trafficSources: ytSnap?.trafficSources || {},
        demographics: ytSnap?.demographics || {},
      };
    }
  } catch {}

  try {
    // Spotify
    const [spConn] = await db
      .select()
      .from(spotifyExtensionConnections)
      .where(and(eq(spotifyExtensionConnections.userId, userId), eq(spotifyExtensionConnections.status, 'active')))
      .limit(1);

    if (spConn) {
      const [spSnap] = await db
        .select()
        .from(spotifyProfileSnapshots)
        .where(eq(spotifyProfileSnapshots.connectionId, spConn.id))
        .orderBy(desc(spotifyProfileSnapshots.snapshotAt))
        .limit(1);

      results.spotify = {
        connected: true,
        artistName: spConn.displayName || spConn.spotifyUsername || undefined,
        monthlyListeners: spSnap?.monthlyListeners ?? spConn.monthlyListeners ?? 0,
        followers: spSnap?.followers ?? spConn.followers ?? 0,
        totalStreams: spSnap?.totalStreams ?? spConn.totalStreams ?? 0,
        topCities: spSnap?.topCities ?? spConn.topCities ?? [],
        popularity: spSnap?.popularity || 0,
      };
    }
  } catch {}

  return results;
}

// GET /api/audience-capture/platform-status/:artistId
router.get('/platform-status/:artistId', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.artistId, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid artistId' });

    const data = await fetchPlatformData(id);
    return res.json({
      success: true,
      instagram: data.instagram ? { connected: true, username: data.instagram.username, followers: data.instagram.followers, engagementRate: data.instagram.engagementRate } : { connected: false },
      youtube: data.youtube ? { connected: true, channelName: data.youtube.channelName, subscribers: data.youtube.subscribers } : { connected: false },
      spotify: data.spotify ? { connected: true, artistName: data.spotify.artistName, monthlyListeners: data.spotify.monthlyListeners, followers: data.spotify.followers } : { connected: false },
      tiktok: { connected: false }, // TikTok has no extension — shown as "connect via link"
    });
  } catch (err: any) {
    logger.error('[AudienceCapture] GET platform-status error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/audience-capture/auto-setup
 * Reads the artist's Superstar Blueprint (if available) + basic profile data to
 * auto-infer a complete audience profile + 7 content pillars using the
 * Hook → Identity → Emotion → Action framework.
 */
router.post('/auto-setup', async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, genre, biography, location, languages } = req.body;
    if (!artistId) return res.status(400).json({ error: 'artistId required' });

    const id = parseInt(artistId, 10);
    const { callAISimple } = await import('../utils/smart-ai');
    const { db } = await import('../../db');
    const { artistBlueprints } = await import('../../db/schema');
    const { eq } = await import('drizzle-orm');

    // ── Pull real platform data from Chrome extensions ─────────────────────
    const platformData = await fetchPlatformData(id);
    let platformContext = '';
    if (platformData.instagram?.connected) {
      platformContext += `
INSTAGRAM (real data from Chrome extension):
- Username: @${platformData.instagram.username || 'unknown'}
- Followers: ${platformData.instagram.followers?.toLocaleString()}
- Engagement rate: ${platformData.instagram.engagementRate}%
- Avg likes: ${platformData.instagram.avgLikes} | Avg comments: ${platformData.instagram.avgComments}
- Top hashtags used: ${(platformData.instagram.topHashtags || []).slice(0, 10).join(', ') || 'none recorded'}
- Bio: ${platformData.instagram.bio || 'not captured'}
- Recent post types: ${(platformData.instagram.recentPosts || []).map((p: any) => p.type).filter(Boolean).slice(0, 5).join(', ') || 'unknown'}
- Audience demographics: ${JSON.stringify(platformData.instagram.audienceDemographics || {}).slice(0, 300)}
`;
    }
    if (platformData.youtube?.connected) {
      platformContext += `
YOUTUBE (real data from Chrome extension):
- Channel: ${platformData.youtube.channelName || 'unknown'}
- Subscribers: ${platformData.youtube.subscribers?.toLocaleString()}
- Total views: ${platformData.youtube.totalViews?.toLocaleString()}
- Avg view duration: ${platformData.youtube.avgViewDuration}s | Watch hours: ${platformData.youtube.watchTimeHours}h
- Traffic sources: ${JSON.stringify(platformData.youtube.trafficSources || {}).slice(0, 200)}
- Audience demographics: ${JSON.stringify(platformData.youtube.demographics || {}).slice(0, 300)}
- Top videos: ${(platformData.youtube.topVideos || []).slice(0, 3).map((v: any) => v.title).join(' | ') || 'none'}
`;
    }
    if (platformData.spotify?.connected) {
      platformContext += `
SPOTIFY (real data from Chrome extension):
- Artist: ${platformData.spotify.artistName || 'unknown'}
- Monthly listeners: ${platformData.spotify.monthlyListeners?.toLocaleString()}
- Followers: ${platformData.spotify.followers?.toLocaleString()}
- Total streams: ${platformData.spotify.totalStreams?.toLocaleString()}
- Top cities: ${(platformData.spotify.topCities || []).slice(0, 5).map((c: any) => `${c.city} (${c.listeners})`).join(', ') || 'none'}
- Popularity score: ${platformData.spotify.popularity}/100
`;
    }

    // ── Pull Superstar Blueprint if available ──────────────────────────────
    let blueprintContext = '';
    try {
      const [bp] = await db
        .select({ blueprintJson: artistBlueprints.blueprintJson, brandArchetype: artistBlueprints.brandArchetype, currentEra: artistBlueprints.currentEra })
        .from(artistBlueprints)
        .where(eq(artistBlueprints.artistId, id))
        .limit(1);

      if (bp?.blueprintJson) {
        const bpJson = bp.blueprintJson as any;
        // Extract key modules for audience / content context
        const identity   = bpJson.artisticIdentity   || bpJson.identity        || bpJson.module2 || {};
        const audience   = bpJson.audienceStrategy   || bpJson.audience        || bpJson.module5 || {};
        const content    = bpJson.contentStrategy    || bpJson.content         || bpJson.module6 || {};
        const hook       = bpJson.hookFramework      || bpJson.hook            || {};
        const emotion    = bpJson.emotionalTriggers  || identity.emotionalCore || audience.emotionalTriggers || {};
        const action     = bpJson.callToAction       || content.cta            || {};
        const brand      = bpJson.brandIdentity      || bpJson.brand           || {};

        blueprintContext = `
SUPERSTAR BLUEPRINT (use this as primary data source — it is the artist's full strategic plan):
- Brand Archetype: ${bp.brandArchetype || identity.archetype || 'Unknown'}
- Current Era: ${bp.currentEra || bpJson.currentEra || 'Unknown'}
- Artistic Identity: ${JSON.stringify(identity).slice(0, 600)}
- Audience Strategy: ${JSON.stringify(audience).slice(0, 600)}
- Emotional Core / Triggers: ${JSON.stringify(emotion).slice(0, 400)}
- Hook Framework (Hook → Identity → Emotion → Action): ${JSON.stringify(hook).slice(0, 400)}
- Content Strategy: ${JSON.stringify(content).slice(0, 600)}
- Call-to-Action patterns: ${JSON.stringify(action).slice(0, 300)}
- Brand Identity: ${JSON.stringify(brand).slice(0, 400)}
`;
        logger.info(`[AudienceCapture] auto-setup using Blueprint for artist ${id}`);
      }
    } catch (bpErr: any) {
      logger.warn('[AudienceCapture] Blueprint lookup skipped', { bpErr: bpErr.message });
    }

    const prompt = `You are an elite music marketing strategist with access to the artist's Superstar Blueprint AND real social media analytics. Use the Hook → Identity → Emotion → Action framework to generate a precise audience profile and content pillars based on REAL data.

HOOK → IDENTITY → EMOTION → ACTION framework:
- HOOK: What immediately grabs this audience's attention (pattern interrupts, curiosity, relatability)
- IDENTITY: Who this audience sees themselves as (archetype, values, tribe)  
- EMOTION: What emotional states this music triggers (nostalgia, pride, freedom, rebellion)
- ACTION: What behavior the content should drive (follow, share, stream, attend shows)

${blueprintContext}
${platformContext ? `REAL PLATFORM DATA FROM CHROME EXTENSIONS (use to calibrate audience precision):\n${platformContext}` : ''}

ARTIST BASIC DATA:
Artist Name: ${artistName || 'Unknown'}
Genre: ${genre || 'Unknown'}
Bio: ${biography || 'No bio provided'}
Location: ${location || 'Unknown'}
Languages: ${(languages || ['es']).join(', ')}

Priority order: 1) Superstar Blueprint, 2) Real platform data, 3) Basic artist data.
If platform data is available, use demographics, engagement patterns, and top hashtags to make the profile ultra-precise.
Return ONLY a valid JSON object with this exact structure:
{
  "profile": {
    "primaryAgeRange": "18-35",
    "languages": ["es"],
    "locations": ["México", "Colombia", "España"],
    "interests": ["música urbana", "cultura latina", "baile"],
    "emotionalTriggers": ["nostalgia", "orgullo latino", "amor"],
    "platforms": ["instagram", "tiktok"],
    "preferredFormats": ["Short videos (15-30s)", "Reels (30-60s)"],
    "archetype": "El Rebelde Auténtico",
    "promise": "Música que te hace sentir libre y real",
    "visualIdentity": "Oscuro, urbano, con destellos de color neón",
    "tone": "Intenso, cercano, directo"
  },
  "pillars": [
    { "pillar": "behind_the_scenes", "isActive": true, "weight": 20, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "emotional_storytelling", "isActive": true, "weight": 20, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "music_performance", "isActive": true, "weight": 20, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "lifestyle", "isActive": true, "weight": 15, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "fan_engagement", "isActive": true, "weight": 10, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "education_tips", "isActive": false, "weight": 10, "description": "...", "contentIdeas": ["...", "..."] },
    { "pillar": "promotional", "isActive": false, "weight": 5, "description": "...", "contentIdeas": ["...", "..."] }
  ]
}`;

    let aiResult: any = null;
    try {
      const enrichedSystemPrompt = await buildEnrichedSystemPrompt(
        'audience-capture',
        'You are an elite music marketing AI using the Hook → Identity → Emotion → Action framework. When a Superstar Blueprint is provided, it is your primary source of truth. Return only valid JSON.',
        id,
      );
      const raw = await callAISimple('content', enrichedSystemPrompt, prompt, {
        requireJSON: true,
        temperature: 0.6,
        label: 'audience-auto-setup',
      });
      aiResult = JSON.parse(raw);
    } catch (aiErr: any) {
      logger.warn('[AudienceCapture] auto-setup AI fallback', { aiErr: aiErr.message });
      // Minimal fallback profile
      aiResult = {
        profile: {
          primaryAgeRange: '18-35',
          languages: languages || ['es'],
          locations: location ? [location] : [],
          interests: genre ? [genre] : [],
          emotionalTriggers: ['emoción', 'autenticidad'],
          platforms: ['instagram', 'tiktok'],
          preferredFormats: ['Short videos (15-30s)', 'Reels (30-60s)'],
          archetype: `Artista de ${genre || 'música'}`,
          promise: `Música auténtica de ${artistName || 'este artista'}`,
          visualIdentity: 'Artístico y personal',
          tone: 'Auténtico y cercano',
        },
        pillars: [
          { pillar: 'behind_the_scenes', isActive: true, weight: 20, description: 'Detrás de cámaras', contentIdeas: ['Proceso creativo', 'Días de estudio'] },
          { pillar: 'emotional_storytelling', isActive: true, weight: 20, description: 'Historias emocionales', contentIdeas: ['Historia de una canción', 'Experiencias personales'] },
          { pillar: 'music_performance', isActive: true, weight: 20, description: 'Presentaciones musicales', contentIdeas: ['Cover acústico', 'Preview de canción'] },
          { pillar: 'lifestyle', isActive: true, weight: 15, description: 'Estilo de vida', contentIdeas: ['Día a día', 'Inspiraciones'] },
          { pillar: 'fan_engagement', isActive: true, weight: 10, description: 'Interacción con fans', contentIdeas: ['Q&A', 'Reacciones'] },
          { pillar: 'education_tips', isActive: false, weight: 10, description: 'Tips y educación', contentIdeas: ['Consejos musicales', 'Behind the music'] },
          { pillar: 'promotional', isActive: false, weight: 5, description: 'Promocional', contentIdeas: ['Anuncio de lanzamiento', 'Merch'] },
        ],
      };
    }

    // Save profile
    const { upsertAudienceProfile, upsertContentPillar } = await import('../services/audience-capture-engine');
    const savedProfile = await upsertAudienceProfile(id, aiResult.profile);

    // Save pillars
    const savedPillars = await Promise.all(
      (aiResult.pillars || []).map((p: any) =>
        upsertContentPillar(id, p.pillar, {
          isActive: p.isActive ?? true,
          weight: p.weight ?? 15,
          description: p.description,
          contentIdeas: p.contentIdeas ?? [],
        }),
      ),
    );

    return res.json({
      success: true,
      profile: savedProfile,
      pillars: savedPillars,
      dataSources: {
        blueprint: !!blueprintContext,
        instagram: !!platformData.instagram?.connected,
        youtube: !!platformData.youtube?.connected,
        spotify: !!platformData.spotify?.connected,
      },
    });
  } catch (err: any) {
    logger.error('[AudienceCapture] POST auto-setup error', { err: err.message });
    return res.status(500).json({ error: err.message });
  }
});

export default router;
