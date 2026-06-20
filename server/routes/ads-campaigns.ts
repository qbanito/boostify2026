/**
 * Ads Campaign Manager — Multi-platform paid ads orchestration
 *
 * Supports: Facebook Ads (Meta), Instagram Ads (Meta), TikTok Ads
 * Stores campaigns in Firestore: adsCampaigns/{artistId}/campaigns/{campaignId}
 * Stores credentials in Firestore: adsCredentials/{artistId}
 *
 * Routes:
 *  GET  /:artistId/campaigns              — list all campaigns
 *  POST /:artistId/campaigns              — create / save campaign
 *  PUT  /:artistId/campaigns/:id          — update campaign (status, budget, etc.)
 *  DEL  /:artistId/campaigns/:id          — delete campaign
 *  POST /:artistId/campaigns/:id/launch   — launch to platform(s)
 *  POST /:artistId/credentials            — save/update platform API credentials
 *  GET  /:artistId/credentials            — load credentials (masked)
 *  POST /:artistId/generate-copy          — AI ad copy generator
 *  GET  /:artistId/creatives              — load available creative images
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db as firestoreDb } from '../firebase';
import { db as pgDb } from '../db';
import { tiktokConnections } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { listArtistVideoAssets } from '../services/artist-content-library';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';

const router = Router();

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '',
});

// ─── Types ─────────────────────────────────────────────────────────────────

export type AdPlatform = 'facebook' | 'instagram' | 'tiktok';
export type CampaignObjective = 'awareness' | 'traffic' | 'engagement' | 'leads' | 'conversions' | 'app_installs';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'failed';
export type BudgetType = 'daily' | 'lifetime';

export interface AdCreative {
  imageUrl: string;
  videoUrl?: string;
  headline: string;
  primaryText: string;
  description?: string;
  callToAction: string;
  linkUrl?: string;
}

export interface AdCampaign {
  id: string;
  artistId: string;
  name: string;
  objective: CampaignObjective;
  platforms: AdPlatform[];
  status: CampaignStatus;
  budgetType: BudgetType;
  budgetAmount: number;
  currency: string;
  startDate: string;
  endDate?: string;
  creative: AdCreative;
  targetAudience?: {
    ageMin?: number;
    ageMax?: number;
    genders?: string[];
    countries?: string[];
    interests?: string[];
    languages?: string[];
  };
  platformCampaignIds?: Record<string, string>; // { facebook: 'xxx', tiktok: 'yyy' }
  stats?: {
    impressions?: number;
    clicks?: number;
    spend?: number;
    ctr?: number;
    cpm?: number;
    conversions?: number;
    lastSyncAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function maskSecret(val: string): string {
  if (!val || val.length < 8) return '••••••••';
  return val.slice(0, 4) + '••••••••' + val.slice(-4);
}

async function getCampaignsRef(artistId: string) {
  return firestoreDb.collection('adsCampaigns').doc(artistId).collection('campaigns');
}

function httpError(message: string, statusCode = 400) {
  const err = new Error(message) as Error & { statusCode?: number };
  err.statusCode = statusCode;
  return err;
}

function hasTikTokScope(scopes: string | null | undefined, scope: string): boolean {
  return String(scopes || '').split(/[\s,]+/).filter(Boolean).includes(scope);
}

async function getTikTokAccessForUser(userId: number, requiredScope?: string) {
  const [conn] = await pgDb
    .select()
    .from(tiktokConnections)
    .where(eq(tiktokConnections.userId, userId))
    .limit(1);

  if (!conn || !conn.isActive) {
    throw httpError('TikTok account not connected. Connect it via the Connect tab.', 400);
  }

  let activeConn = conn;
  if (conn.tokenExpiresAt && new Date(conn.tokenExpiresAt) <= new Date(Date.now() + 60_000)) {
    const { refreshTiktokToken } = await import('../services/tiktok-service');
    const refreshed = await refreshTiktokToken(userId);
    if (!refreshed) throw httpError('TikTok token expired and could not be refreshed. Reconnect TikTok.', 401);
    activeConn = refreshed;
  }

  if (requiredScope && !hasTikTokScope(activeConn.scopes, requiredScope)) {
    throw httpError(`TikTok permission missing: ${requiredScope}. Reconnect TikTok to grant the new permission.`, 403);
  }

  return { accessToken: activeConn.accessToken, connection: activeConn };
}

async function publishInstagramContent(artistId: string, input: { imageUrl?: string | null; videoUrl?: string | null; caption?: string; hashtags?: string }) {
  const { imageUrl, videoUrl, caption = '', hashtags = '' } = input;
  if (!imageUrl && !videoUrl) throw httpError('imageUrl or videoUrl required', 400);

  const credsDoc = await firestoreDb.collection('adsCredentials').doc(artistId).get();
  if (!credsDoc.exists) throw httpError('No Meta credentials configured. Set them in Connect tab.', 400);

  const creds = credsDoc.data() || {};
  const accessToken = creds.facebookAccessToken;
  const igAccountId = creds.instagramAccountId;
  if (!accessToken) throw httpError('facebookAccessToken not configured', 400);
  if (!igAccountId) throw httpError('instagramAccountId not configured', 400);

  const fullCaption = [caption, hashtags].filter(Boolean).join('\n\n');
  const isVideo = !!videoUrl;
  const containerParams: Record<string, string> = {
    caption: fullCaption,
    access_token: accessToken,
  };

  if (isVideo) {
    containerParams.video_url = videoUrl!;
    containerParams.media_type = 'REELS';
  } else {
    containerParams.image_url = imageUrl!;
  }

  const containerResp = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media`,
    containerParams,
  );

  const creationId = containerResp.data?.id;
  if (!creationId) throw httpError('Failed to create media container', 500);

  if (isVideo) {
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const statusResp = await axios.get(
        `https://graph.facebook.com/v19.0/${creationId}`,
        { params: { fields: 'status_code', access_token: accessToken } },
      );
      const statusCode = statusResp.data?.status_code;
      if (statusCode === 'FINISHED') break;
      if (statusCode === 'ERROR') throw httpError('Instagram video processing failed', 500);
    }
  }

  const publishResp = await axios.post(
    `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
    { creation_id: creationId, access_token: accessToken },
  );

  const mediaId = publishResp.data?.id;
  if (!mediaId) throw httpError('Publish call did not return media ID', 500);
  return { mediaId, platform: 'instagram' as const };
}

async function publishTikTokContent(userId: number, input: { videoUrl?: string | null; caption?: string; hashtags?: string; privacy?: string }) {
  const { videoUrl, caption = '', hashtags = '', privacy = 'SELF_ONLY' } = input;
  if (!videoUrl) throw httpError('videoUrl is required for TikTok posts', 400);

  const { accessToken } = await getTikTokAccessForUser(userId, 'video.publish');
  const fullCaption = [caption, hashtags].filter(Boolean).join(' ');

  const initResp = await axios.post(
    'https://open.tiktokapis.com/v2/post/publish/video/init/',
    {
      post_info: {
        title: fullCaption.slice(0, 2200),
        privacy_level: privacy.toUpperCase(),
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: videoUrl,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
  );

  const publishId: string = initResp.data?.data?.publish_id;
  if (!publishId) {
    const errData = initResp.data?.error;
    throw httpError(errData?.message || 'TikTok init failed', 500);
  }

  return { publishId, platform: 'tiktok' as const, status: 'PROCESSING' };
}

// ─── GET /:artistId/campaigns ───────────────────────────────────────────────
router.get('/:artistId/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const ref = await getCampaignsRef(artistId);
    const snap = await ref.orderBy('createdAt', 'desc').get();
    const campaigns: AdCampaign[] = snap.docs.map(d => d.data() as AdCampaign);
    return res.json({ success: true, campaigns });
  } catch (err: any) {
    logger.error('[AdsCampaigns] GET campaigns error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/campaigns ──────────────────────────────────────────────
router.post('/:artistId/campaigns', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const body = req.body as Partial<AdCampaign>;

    if (!body.name || !body.objective || !body.platforms?.length) {
      return res.status(400).json({ success: false, error: 'name, objective, and at least one platform are required' });
    }

    const now = new Date().toISOString();
    const id = body.id || uuidv4();
    const campaign: AdCampaign = {
      id,
      artistId,
      name: body.name,
      objective: body.objective,
      platforms: body.platforms,
      status: body.status || 'draft',
      budgetType: body.budgetType || 'daily',
      budgetAmount: body.budgetAmount || 0,
      currency: body.currency || 'USD',
      startDate: body.startDate || now.split('T')[0],
      endDate: body.endDate,
      creative: body.creative || { imageUrl: '', headline: '', primaryText: '', callToAction: 'LEARN_MORE' },
      targetAudience: body.targetAudience || {},
      platformCampaignIds: body.platformCampaignIds || {},
      stats: body.stats || {},
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    const ref = await getCampaignsRef(artistId);
    await ref.doc(id).set(campaign);

    logger.log(`[AdsCampaigns] ✅ Campaign saved: ${id} for artist=${artistId}`);
    return res.json({ success: true, campaign });
  } catch (err: any) {
    logger.error('[AdsCampaigns] POST campaign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /:artistId/campaigns/:id ───────────────────────────────────────────
router.put('/:artistId/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, id } = req.params;
    const updates = req.body;
    const ref = await getCampaignsRef(artistId);
    const docRef = ref.doc(id);
    const snap = await docRef.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Campaign not found' });

    const merged = { ...snap.data(), ...updates, updatedAt: new Date().toISOString() };
    await docRef.set(merged, { merge: true });
    return res.json({ success: true, campaign: merged });
  } catch (err: any) {
    logger.error('[AdsCampaigns] PUT campaign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:artistId/campaigns/:id ────────────────────────────────────────
router.delete('/:artistId/campaigns/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, id } = req.params;
    const ref = await getCampaignsRef(artistId);
    await ref.doc(id).delete();
    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AdsCampaigns] DELETE campaign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/campaigns/:id/launch ───────────────────────────────────
router.post('/:artistId/campaigns/:id/launch', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, id } = req.params;
    const ref = await getCampaignsRef(artistId);
    const snap = await ref.doc(id).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'Campaign not found' });

    const campaign = snap.data() as AdCampaign;

    // Load platform credentials
    const credsSnap = await firestoreDb.collection('adsCredentials').doc(artistId).get();
    const creds = credsSnap.exists ? credsSnap.data() || {} : {};

    const results: Record<string, { success: boolean; campaignId?: string; error?: string }> = {};
    const platformIds: Record<string, string> = { ...(campaign.platformCampaignIds || {}) };

    for (const platform of campaign.platforms) {
      try {
        if (platform === 'facebook' || platform === 'instagram') {
          // Meta Marketing API — requires FACEBOOK_ACCESS_TOKEN + FACEBOOK_AD_ACCOUNT_ID
          const accessToken = (creds as any).facebookAccessToken;
          const adAccountId = (creds as any).facebookAdAccountId;

          if (!accessToken || !adAccountId) {
            results[platform] = { success: false, error: 'Facebook credentials not configured. Add them in the Connect tab.' };
            continue;
          }

          // Create campaign via Meta Marketing API v19
          const metaRes = await axios.post(
            `https://graph.facebook.com/v19.0/act_${adAccountId}/campaigns`,
            {
              name: campaign.name,
              objective: mapObjectiveToMeta(campaign.objective),
              status: campaign.status === 'scheduled' ? 'PAUSED' : 'ACTIVE',
              special_ad_categories: [],
              daily_budget: campaign.budgetType === 'daily' ? Math.round(campaign.budgetAmount * 100) : undefined,
              lifetime_budget: campaign.budgetType === 'lifetime' ? Math.round(campaign.budgetAmount * 100) : undefined,
              start_time: campaign.startDate,
              stop_time: campaign.endDate,
            },
            { params: { access_token: accessToken } },
          );

          const metaCampaignId = metaRes.data.id;
          platformIds[platform] = metaCampaignId;
          results[platform] = { success: true, campaignId: metaCampaignId };
          logger.log(`[AdsCampaigns] ✅ Meta ${platform} campaign created: ${metaCampaignId}`);

        } else if (platform === 'tiktok') {
          // TikTok Ads API v1.3 — requires TIKTOK_ACCESS_TOKEN + TIKTOK_ADVERTISER_ID
          const accessToken = (creds as any).tiktokAccessToken;
          const advertiserId = (creds as any).tiktokAdvertiserId;

          if (!accessToken || !advertiserId) {
            results[platform] = { success: false, error: 'TikTok credentials not configured. Add them in the Connect tab.' };
            continue;
          }

          const ttRes = await axios.post(
            'https://business-api.tiktok.com/open_api/v1.3/campaign/create/',
            {
              advertiser_id: advertiserId,
              campaign_name: campaign.name,
              campaign_type: 'REGULAR_CAMPAIGN',
              objective_type: mapObjectiveToTikTok(campaign.objective),
              budget_mode: campaign.budgetType === 'daily' ? 'BUDGET_MODE_DAY' : 'BUDGET_MODE_TOTAL',
              budget: campaign.budgetAmount,
              operation_status: 'ENABLE',
            },
            { headers: { 'Access-Token': accessToken, 'Content-Type': 'application/json' } },
          );

          if (ttRes.data?.code === 0) {
            const ttCampaignId = ttRes.data.data?.campaign_id;
            platformIds['tiktok'] = String(ttCampaignId);
            results['tiktok'] = { success: true, campaignId: String(ttCampaignId) };
            logger.log(`[AdsCampaigns] ✅ TikTok campaign created: ${ttCampaignId}`);
          } else {
            results['tiktok'] = { success: false, error: ttRes.data?.message || 'TikTok API error' };
          }
        }
      } catch (platformErr: any) {
        logger.warn(`[AdsCampaigns] ${platform} launch error:`, platformErr?.message);
        results[platform] = { success: false, error: platformErr?.message || 'Platform API error' };
      }
    }

    // Update campaign status
    const anySuccess = Object.values(results).some(r => r.success);
    const newStatus: CampaignStatus = anySuccess ? 'active' : 'failed';
    const updatedCampaign = {
      ...campaign,
      status: newStatus,
      platformCampaignIds: platformIds,
      updatedAt: new Date().toISOString(),
    };
    await ref.doc(id).set(updatedCampaign, { merge: true });

    return res.json({ success: anySuccess, campaign: updatedCampaign, platformResults: results });
  } catch (err: any) {
    logger.error('[AdsCampaigns] launch campaign error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/credentials ────────────────────────────────────────────
router.post('/:artistId/credentials', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      facebookAccessToken,
      facebookAdAccountId,
      facebookAppId,
      facebookAppSecret,
      instagramAccountId,
      tiktokAccessToken,
      tiktokAdvertiserId,
      tiktokAppId,
      tiktokAppSecret,
    } = req.body;

    await firestoreDb.collection('adsCredentials').doc(artistId).set({
      ...(facebookAccessToken !== undefined && { facebookAccessToken }),
      ...(facebookAdAccountId !== undefined && { facebookAdAccountId }),
      ...(facebookAppId !== undefined && { facebookAppId }),
      ...(facebookAppSecret !== undefined && { facebookAppSecret }),
      ...(instagramAccountId !== undefined && { instagramAccountId }),
      ...(tiktokAccessToken !== undefined && { tiktokAccessToken }),
      ...(tiktokAdvertiserId !== undefined && { tiktokAdvertiserId }),
      ...(tiktokAppId !== undefined && { tiktokAppId }),
      ...(tiktokAppSecret !== undefined && { tiktokAppSecret }),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return res.json({ success: true, message: 'Credentials saved securely' });
  } catch (err: any) {
    logger.error('[AdsCampaigns] save credentials error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/credentials ─────────────────────────────────────────────
router.get('/:artistId/credentials', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb.collection('adsCredentials').doc(artistId).get();
    if (!snap.exists) return res.json({ success: true, credentials: {} });

    const raw = snap.data() || {};
    // Return masked values so the UI can show "connected" without exposing secrets
    const masked: Record<string, any> = {};
    for (const [key, val] of Object.entries(raw)) {
      if (key === 'updatedAt') { masked[key] = val; continue; }
      masked[key] = val ? maskSecret(String(val)) : '';
      // Also return boolean indicating if set
      masked[`${key}Set`] = Boolean(val);
    }

    return res.json({ success: true, credentials: masked });
  } catch (err: any) {
    logger.error('[AdsCampaigns] get credentials error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/generate-copy ──────────────────────────────────────────
router.post('/:artistId/generate-copy', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { artistName, songName, genre, objective, platform, mood, viralHook, language = 'en', pgUserId } = req.body;

    if (!artistName) return res.status(400).json({ success: false, error: 'artistName required' });

    const objectiveDesc: Record<string, string> = {
      awareness: 'grow brand awareness and reach new fans',
      traffic: 'drive traffic to streaming platforms or website',
      engagement: 'maximize likes, comments, shares and saves',
      leads: 'capture fan emails and phone numbers',
      conversions: 'drive music purchases or merch sales',
      app_installs: 'get installs for the Boostify app',
    };

    const platformGuidelines: Record<string, string> = {
      facebook: 'Facebook: conversational, story-driven, 1-3 sentences. Include a hook and soft CTA.',
      instagram: 'Instagram: short, punchy, visual-first. Use emojis naturally. 1-2 sentences + hashtags.',
      tiktok: 'TikTok: ultra-casual, Gen-Z energy, trending language. 1 sentence + viral hook.',
    };

    // Build enriched system prompt with ads & ad-creative skills
    const systemPrompt = await buildEnrichedSystemPrompt(
      'ads-campaigns',
      'You are a paid social ads copywriter specializing in music marketing. You create high-converting ad copy with viral appeal and strong CTAs.',
      pgUserId ? Number(pgUserId) : undefined,
    );

    const userPrompt = `Artist: ${artistName}
Song: ${songName || 'latest release'}
Genre: ${genre || 'music'}
Campaign Objective: ${objectiveDesc[objective] || objective}
Platform: ${platform || 'multi-platform'}
Mood/Vibe: ${mood || 'energetic, emotional'}
Viral Hook: ${viralHook || ''}
Language: ${language}

Platform guidelines: ${platformGuidelines[platform] || 'Write versatile copy that works across platforms.'}

Generate ad copy in JSON:
{
  "headline": "<5-7 word attention-grabbing headline>",
  "primaryText": "<Main ad body copy — platform-optimized, 1-3 sentences>",
  "description": "<Short description for link preview — max 30 chars>",
  "callToAction": "<One of: LISTEN_NOW / STREAM_NOW / WATCH_NOW / SHOP_NOW / LEARN_MORE / SIGN_UP / GET_OFFER>",
  "hashtags": ["<tag1>", "<tag2>", "<tag3>"],
  "tiktokCaption": "<ultra-casual TikTok caption with hook>",
  "alternativeHeadlines": ["<alt1>", "<alt2>"]
}

Be bold, direct, and platform-native. Do not use generic phrases.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.85,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let copy: any;
    try { copy = JSON.parse(raw); } catch { copy = { headline: '', primaryText: raw, callToAction: 'LEARN_MORE' }; }

    return res.json({ success: true, copy });
  } catch (err: any) {
    logger.error('[AdsCampaigns] generate-copy error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/creatives ────────────────────────────────────────────────
// Pull available creative images from Firestore (promo clips gallery + character pack + merch)
router.get('/:artistId/creatives', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;

    const creatives: Array<{ url: string; source: string; label: string }> = [];

    // 1. Promo Clips generated images
    try {
      const promoSnap = await firestoreDb.collection('artistPromoGalleries')
        .where('userId', '==', artistId)
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      for (const doc of promoSnap.docs) {
        const data = doc.data();
        const images: any[] = data.generatedImages || [];
        for (const img of images.slice(0, 3)) {
          if (img?.url) creatives.push({ url: img.url, source: 'promo_clips', label: `Promo: ${data.singleName || 'Clip'}` });
        }
      }
    } catch { /* table may not exist yet */ }

    // 2. Character Pack images
    try {
      const packSnap = await firestoreDb.collection('artistCharacterPacks').doc(artistId).get();
      if (packSnap.exists) {
        const packData = packSnap.data() || {};
        const images: any[] = packData.images || [];
        for (const img of images) {
          if (img?.url) creatives.push({ url: img.url, source: 'character_pack', label: `Character: ${img.angle || img.label || 'Reference'}` });
        }
      }
    } catch { /* ignore */ }

    // 3. Artist gallery
    try {
      const gallerySnap = await firestoreDb.collection('artistGallery')
        .doc(artistId)
        .collection('images')
        .orderBy('createdAt', 'desc')
        .limit(12)
        .get();

      for (const doc of gallerySnap.docs) {
        const data = doc.data();
        if (data?.url) creatives.push({ url: data.url, source: 'gallery', label: `Gallery: ${data.label || data.prompt?.slice(0, 30) || 'Image'}` });
      }
    } catch { /* ignore */ }

    // 4. Hollywood Posters from promo clips
    try {
      const posterSnap = await firestoreDb.collection('artistPromoGalleries')
        .where('userId', '==', artistId)
        .where('source', '==', 'promo_clips_poster')
        .limit(6)
        .get();

      for (const doc of posterSnap.docs) {
        const data = doc.data();
        const images: any[] = data.generatedImages || [];
        for (const img of images.slice(0, 2)) {
          if (img?.url) creatives.push({ url: img.url, source: 'poster', label: `Poster: ${data.singleName || ''}` });
        }
      }
    } catch { /* ignore */ }

    return res.json({ success: true, creatives });
  } catch (err: any) {
    logger.error('[AdsCampaigns] get creatives error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/creatives/videos — unified video creative library ────────
router.get('/:artistId/creatives/videos', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { videos } = await listArtistVideoAssets(artistId);
    return res.json({ success: true, videos });
  } catch (err: any) {
    logger.error('[AdsCampaigns] get videos error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/publish/instagram ── organic content post ──────────────
/**
 * Publishes an image or video to Instagram via the Graph API Content Publishing API.
 * Requires: facebookAccessToken + instagramAccountId in Firestore adsCredentials.
 *
 * Body: { imageUrl?, videoUrl?, caption, hashtags? }
 */
router.post('/:artistId/publish/instagram', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { imageUrl, videoUrl, caption = '', hashtags = '' } = req.body;

  try {
    const { mediaId } = await publishInstagramContent(artistId, { imageUrl, videoUrl, caption, hashtags });
    logger.info(`[AdsCampaigns] Instagram publish success — mediaId=${mediaId} artist=${artistId}`);
    return res.json({ success: true, mediaId, platform: 'instagram' });

  } catch (err: any) {
    const detail = err?.response?.data || err?.message;
    logger.error('[AdsCampaigns] Instagram publish error:', detail);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'Instagram publish failed', detail });
  }
});

// ─── POST /:artistId/publish/tiktok ── organic video post (Login Kit) ────────
/**
 * Publishes a video to TikTok using the Content Posting API v2.
 * Requires: TikTok OAuth connection stored in tiktokConnections (DB).
 * Scopes needed: video.publish
 *
 * Body: { videoUrl, caption, hashtags?, privacy? }
 */
router.post('/:artistId/publish/tiktok', authenticate, async (req: Request, res: Response) => {
  const { videoUrl, caption = '', hashtags = '', privacy = 'SELF_ONLY' } = req.body;

  const userId: number = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

  try {
    const { publishId, status } = await publishTikTokContent(userId, { videoUrl, caption, hashtags, privacy });
    logger.info(`[AdsCampaigns] TikTok publish initiated — publishId=${publishId}`);
    return res.json({ success: true, publishId, platform: 'tiktok', status });

  } catch (err: any) {
    const detail = err?.response?.data || err?.message;
    logger.error('[AdsCampaigns] TikTok publish error:', detail);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'TikTok publish failed', detail });
  }
});

// ─── GET /:artistId/publish/tiktok/status — check publish status ─────────────
router.get('/:artistId/publish/tiktok/status', authenticate, async (req: Request, res: Response) => {
  const { publishId } = req.query;
  if (!publishId) return res.status(400).json({ success: false, error: 'publishId required' });

  const userId: number = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

  try {
    const { accessToken } = await getTikTokAccessForUser(userId);

    const resp = await axios.post(
      'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
      { publish_id: publishId },
      { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json; charset=UTF-8' } },
    );

    return res.json({ success: true, status: resp.data?.data });
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({ success: false, error: err?.response?.data?.error?.message || err.message });
  }
});

// ─── POST /:artistId/schedule ── schedule a content post ─────────────────────
/**
 * Saves a post to be published at a future time.
 * Stores in Firestore: scheduledPosts/{artistId}/posts/{id}
 *
 * Body: { platform, imageUrl?, videoUrl?, caption, hashtags?, scheduledAt (ISO string) }
 */
router.post('/:artistId/schedule', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const { platform, imageUrl, videoUrl, mediaUrl, mediaType, caption = '', hashtags = '', scheduledAt } = req.body;
  const normalizedVideoUrl = videoUrl || ((mediaType === 'reel' || mediaType === 'video') ? mediaUrl : null);
  const normalizedImageUrl = imageUrl || (!normalizedVideoUrl ? mediaUrl : null);

  if (!platform) return res.status(400).json({ success: false, error: 'platform required' });
  if (!normalizedImageUrl && !normalizedVideoUrl) return res.status(400).json({ success: false, error: 'imageUrl or videoUrl required' });
  if (!scheduledAt) return res.status(400).json({ success: false, error: 'scheduledAt (ISO datetime) required' });

  const scheduledDate = new Date(scheduledAt);
  if (isNaN(scheduledDate.getTime()) || scheduledDate <= new Date()) {
    return res.status(400).json({ success: false, error: 'scheduledAt must be a valid future datetime' });
  }

  try {
    const postId = uuidv4();
    const post = {
      id: postId,
      artistId,
      platform,
      imageUrl: normalizedImageUrl || null,
      videoUrl: normalizedVideoUrl || null,
      caption,
      hashtags,
      scheduledAt: scheduledDate.toISOString(),
      status: 'scheduled',
      userId: (req as any).user?.id || null,
      createdAt: new Date().toISOString(),
      publishedAt: null,
      platformPostIds: {},
      error: null,
    };

    await firestoreDb
      .collection('scheduledPosts')
      .doc(artistId)
      .collection('posts')
      .doc(postId)
      .set(post);

    return res.json({ success: true, post });
  } catch (err: any) {
    logger.error('[AdsCampaigns] schedule post error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/schedule ── list scheduled posts ─────────────────────────
router.get('/:artistId/schedule', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const snap = await firestoreDb
      .collection('scheduledPosts')
      .doc(artistId)
      .collection('posts')
      .orderBy('scheduledAt', 'asc')
      .get();

    const posts = snap.docs.map(d => d.data());
    return res.json({ success: true, posts });
  } catch (err: any) {
    logger.error('[AdsCampaigns] list scheduled posts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /:artistId/schedule/:postId ── cancel scheduled post ──────────────
router.delete('/:artistId/schedule/:postId', authenticate, async (req: Request, res: Response) => {
  const { artistId, postId } = req.params;
  try {
    await firestoreDb
      .collection('scheduledPosts')
      .doc(artistId)
      .collection('posts')
      .doc(postId)
      .delete();

    return res.json({ success: true });
  } catch (err: any) {
    logger.error('[AdsCampaigns] delete scheduled post error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/analytics/tiktok ── TikTok video.list ────────────────────
router.get('/:artistId/analytics/tiktok', authenticate, async (req: Request, res: Response) => {
  const userId: number = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Not authenticated' });

  try {
    const { accessToken, connection } = await getTikTokAccessForUser(userId, 'video.list');

    const resp = await axios.post(
      'https://open.tiktokapis.com/v2/video/list/',
      { max_count: 20 },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
        params: {
          fields: 'id,title,create_time,cover_image_url,share_url,view_count,like_count,comment_count,share_count,duration',
        },
      },
    );

    const videos = resp.data?.data?.videos || [];
    return res.json({ success: true, videos, username: connection.displayName });
  } catch (err: any) {
    const detail = err?.response?.data?.error || err?.message;
    logger.error('[AdsCampaigns] TikTok analytics error:', detail);
    return res.status(err.statusCode || 500).json({ success: false, error: err.message || 'TikTok analytics fetch failed', detail });
  }
});

// ─── GET /:artistId/analytics/instagram ── Meta/IG insights ──────────────────
router.get('/:artistId/analytics/instagram', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const credsDoc = await firestoreDb.collection('adsCredentials').doc(artistId).get();
    if (!credsDoc.exists) return res.json({ success: true, media: [], message: 'No Meta credentials' });

    const creds = credsDoc.data() || {};
    const accessToken = creds.facebookAccessToken;
    const igAccountId = creds.instagramAccountId;

    if (!accessToken || !igAccountId) {
      return res.json({ success: true, media: [], message: 'Meta credentials incomplete' });
    }

    const resp = await axios.get(
      `https://graph.facebook.com/v19.0/${igAccountId}/media`,
      {
        params: {
          fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count,reach,impressions',
          limit: 20,
          access_token: accessToken,
        },
      },
    );

    const media = resp.data?.data || [];
    return res.json({ success: true, media });
  } catch (err: any) {
    const detail = err?.response?.data?.error || err?.message;
    logger.error('[AdsCampaigns] IG analytics error:', detail);
    return res.status(500).json({ success: false, error: 'Instagram analytics failed', detail });
  }
});

// ─── Mapping helpers ─────────────────────────────────────────────────────────

function mapObjectiveToMeta(obj: CampaignObjective): string {
  const map: Record<CampaignObjective, string> = {
    awareness: 'OUTCOME_AWARENESS',
    traffic: 'OUTCOME_TRAFFIC',
    engagement: 'OUTCOME_ENGAGEMENT',
    leads: 'OUTCOME_LEADS',
    conversions: 'OUTCOME_SALES',
    app_installs: 'OUTCOME_APP_PROMOTION',
  };
  return map[obj] || 'OUTCOME_AWARENESS';
}

function mapObjectiveToTikTok(obj: CampaignObjective): string {
  const map: Record<CampaignObjective, string> = {
    awareness: 'REACH',
    traffic: 'TRAFFIC',
    engagement: 'VIDEO_VIEWS',
    leads: 'LEAD_GENERATION',
    conversions: 'CONVERSIONS',
    app_installs: 'APP_INSTALL',
  };
  return map[obj] || 'REACH';
}

// ─── FAL helpers ─────────────────────────────────────────────────────────────

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const FAL_BASE = 'https://fal.run';

type ContentScene = 'studio' | 'live_show' | 'viral' | 'behind_scenes' | 'music_video';

const SCENE_PROMPTS: Record<ContentScene, string> = {
  studio: 'professional recording studio session, cinematic moody lighting, vintage microphone, mixing board in background, artistic and intimate atmosphere, 4K quality, shallow depth of field',
  live_show: 'electrifying live concert performance on stage, dramatic colored stage lighting, cheering crowd in background, dynamic pose, smoke and laser effects, concert photography style',
  viral: 'fun energetic viral moment, trendy aesthetic, vibrant saturated colors, social media worthy composition, candid authentic energy, millennial/Gen-Z vibe, lifestyle photography',
  behind_scenes: 'behind the scenes moment, casual authentic lifestyle, music industry setting, natural daylight, candid expression, premium streetwear, urban environment',
  music_video: 'cinematic music video scene, professional film production quality, dramatic artistic lighting, bold color grading, high-fashion aesthetic, editorial magazine quality',
};

const SCENE_VIDEO_PROMPTS: Record<ContentScene, string> = {
  studio: 'artist recording in studio, camera slowly zooms in, warm moody ambiance',
  live_show: 'artist performing on stage, crowd cheering, dramatic camera movement, concert energy',
  viral: 'trendy viral social media moment, quick dynamic cuts, energetic movement',
  behind_scenes: 'candid behind the scenes moment, natural movement, authentic vibe',
  music_video: 'cinematic music video sequence, slow motion, artistic camera work',
};

async function generateContentImage(
  referenceImageUrl: string | null,
  artistName: string,
  genre: string,
  scene: ContentScene,
  aspectRatio: string,
): Promise<string | null> {
  if (!FAL_KEY) return null;

  const basePrompt = `${artistName}, ${genre} music artist. ${SCENE_PROMPTS[scene]}`;

  try {
    let response;
    if (referenceImageUrl) {
      // Image-to-image: preserve artist identity via flux-pro/kontext
      response = await axios.post(
        `${FAL_BASE}/fal-ai/flux-pro/kontext`,
        {
          prompt: basePrompt,
          image_url: referenceImageUrl,
          aspect_ratio: aspectRatio || '1:1',
          output_format: 'jpeg',
          guidance_scale: 3.5,
          num_inference_steps: 28,
          safety_tolerance: '6',
        },
        {
          headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
          timeout: 120_000,
        },
      );
    } else {
      response = await axios.post(
        `${FAL_BASE}/fal-ai/flux-pro/kontext/text-to-image`,
        {
          prompt: basePrompt,
          aspect_ratio: aspectRatio || '1:1',
          output_format: 'jpeg',
          safety_tolerance: '6',
          num_images: 1,
        },
        {
          headers: { Authorization: `Key ${FAL_KEY}`, 'Content-Type': 'application/json' },
          timeout: 120_000,
        },
      );
    }

    return response.data?.images?.[0]?.url || null;
  } catch (err: any) {
    logger.warn('[AdsContent] FAL image failed:', err?.response?.data?.detail || err.message);
    return null;
  }
}

// ─── POST /:artistId/generate-content ─── FAL AI content generation ───────────
/**
 * Generates content images (and optionally short preview videos) using the artist's
 * profile image as reference and FAL Flux Pro Kontext (image-to-image).
 *
 * Body: { referenceImageUrl?, scene, artistName, genre, count, aspectRatio }
 * Returns: { success, images: [{url, scene, prompt}] }
 */
router.post('/:artistId/generate-content', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      referenceImageUrl = null,
      scene = 'studio' as ContentScene,
      artistName = 'Artist',
      genre = 'music',
      count = 1,
      aspectRatio = '1:1',
    } = req.body;

    const validScenes: ContentScene[] = ['studio', 'live_show', 'viral', 'behind_scenes', 'music_video'];
    const resolvedScene: ContentScene = validScenes.includes(scene) ? scene : 'studio';
    const resolvedCount = Math.min(Math.max(1, Number(count)), 4);

    logger.log(`[AdsContent] Generating ${resolvedCount}x ${resolvedScene} images for artist=${artistId}`);

    // Generate images in parallel
    const imagePromises = Array.from({ length: resolvedCount }, () =>
      generateContentImage(referenceImageUrl, artistName, genre, resolvedScene, aspectRatio),
    );
    const imageUrls = await Promise.all(imagePromises);
    const validImages = imageUrls.filter(Boolean) as string[];

    if (validImages.length === 0) {
      return res.status(500).json({ success: false, error: 'FAL image generation failed. Check FAL_KEY configuration.' });
    }

    // Save to Firestore gallery so images appear in creative picker
    const galleryDoc = {
      userId: artistId,
      singleName: `Content: ${resolvedScene.replace('_', ' ')} — ${new Date().toLocaleDateString()}`,
      source: 'ads_content_studio',
      scene: resolvedScene,
      generatedImages: validImages.map(url => ({ url, scene: resolvedScene, aspectRatio })),
      createdAt: new Date().toISOString(),
    };
    await firestoreDb.collection('artistPromoGalleries').add(galleryDoc);

    const images = validImages.map(url => ({
      url,
      scene: resolvedScene,
      prompt: `${artistName} — ${resolvedScene.replace('_', ' ')}`,
      aspectRatio,
    }));

    return res.json({ success: true, images });
  } catch (err: any) {
    logger.error('[AdsContent] generate-content error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:artistId/generate-calendar ─── AI 30-day content calendar ─────────
/**
 * Uses OpenAI to generate a 30-day content calendar for the artist.
 * Each entry has: date, platform, scene, contentType, caption, hashtags, visualPrompt
 *
 * Body: { artistName, genre, biography?, songs?, startDate?, days? }
 * Returns: { success, calendar: [...posts], calendarId }
 */
router.post('/:artistId/generate-calendar', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      artistName = 'Artist',
      genre = 'music',
      biography = '',
      songs = [],
      startDate,
      days = 30,
    } = req.body;

    const resolvedDays = Math.min(Math.max(7, Number(days)), 30);
    const start = startDate ? new Date(startDate) : new Date();

    const songList = Array.isArray(songs) && songs.length > 0
      ? songs.slice(0, 8).map((s: any) => s.title || s.name || s).join(', ')
      : 'original music';

    const prompt = `You are a music marketing strategist creating a ${resolvedDays}-day social media content calendar for ${artistName}, a ${genre} artist.

Artist bio: ${biography.slice(0, 300) || 'Talented independent artist'}
Songs: ${songList}
Start date: ${start.toISOString().split('T')[0]}

Generate a ${resolvedDays}-day content calendar with VARIED, HIGH-ENGAGEMENT posts mixing these scene types:
- studio: Recording session, creative process
- live_show: Concert, performance, show announcements
- viral: Trending challenges, humor, relatable moments
- behind_scenes: Day in the life, candid moments
- music_video: Song promotion, music video teasers

Rules:
- Post 1-2 times per day total across Instagram + TikTok
- Alternate platforms (don't post both same day every time)
- Mix promotional with personal content (ratio 40% promo / 60% personal/engaging)
- Every 3rd post should be viral/engagement focused
- Week 1: introduce/tease new content
- Week 2: peak promotional push
- Week 3: community engagement
- Week 4: recap + build anticipation for next release

Return ONLY valid JSON array (no markdown):
[
  {
    "day": 1,
    "date": "YYYY-MM-DD",
    "platform": "instagram" | "tiktok",
    "scene": "studio" | "live_show" | "viral" | "behind_scenes" | "music_video",
    "contentType": "photo" | "reel" | "story" | "video",
    "caption": "<engaging caption with artist voice, 1-3 sentences>",
    "hashtags": "<5-8 relevant hashtags>",
    "visualPrompt": "<brief description of what the image/video should show>",
    "callToAction": "<specific CTA like 'Link in bio', 'Drop a 🔥 below', etc.>",
    "engagementHook": "<opening hook line for the caption>"
  }
]`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.85,
      max_tokens: 6000,
    });

    const raw = completion.choices[0]?.message?.content || '[]';
    let calendarPosts: any[];
    try {
      // Strip possible markdown code fences
      const cleaned = raw.replace(/```json?\n?/g, '').replace(/```\n?/g, '').trim();
      calendarPosts = JSON.parse(cleaned);
      if (!Array.isArray(calendarPosts)) calendarPosts = [];
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to parse calendar JSON from AI' });
    }

    // Add sequential dates starting from start
    calendarPosts = calendarPosts.map((post, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return { ...post, day: i + 1, date: d.toISOString().split('T')[0] };
    });

    // Save to Firestore
    const calendarId = uuidv4();
    await firestoreDb
      .collection('adsContentCalendars')
      .doc(artistId)
      .collection('calendars')
      .doc(calendarId)
      .set({
        id: calendarId,
        artistId,
        artistName,
        genre,
        posts: calendarPosts,
        startDate: start.toISOString().split('T')[0],
        days: resolvedDays,
        createdAt: new Date().toISOString(),
      });

    logger.log(`[AdsContent] Calendar generated: ${calendarPosts.length} posts for artist=${artistId}`);
    return res.json({ success: true, calendar: calendarPosts, calendarId });
  } catch (err: any) {
    logger.error('[AdsContent] generate-calendar error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:artistId/calendar — list saved content calendars ──────────────────
router.get('/:artistId/calendar', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb
      .collection('adsContentCalendars')
      .doc(artistId)
      .collection('calendars')
      .orderBy('createdAt', 'desc')
      .limit(3)
      .get();

    const calendars = snap.docs.map(d => d.data());
    const latest = calendars[0] || null;
    return res.json({ success: true, calendars, calendar: latest?.posts || [] });
  } catch (err: any) {
    logger.error('[AdsContent] get calendar error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── AUTOPILOT SYSTEM ─────────────────────────────────────────────────────────
// Full automatic publishing pipeline:
//   1. Artist generates 30-day calendar → activates autopilot
//   2. Posts saved to Firestore with status 'scheduled' (auto) or 'pending_approval' (review)
//   3. External cron (cron-job.org) hits /cron/publish-due-posts every hour
//   4. Cron generates image via FAL if missing, then posts to Instagram/TikTok
//   5. Artist can optionally approve individual posts before they go live

// POST /:artistId/autopilot/activate
router.post('/:artistId/autopilot/activate', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { posts, autopilotMode = true, referenceImageUrl, artistName: aName, genre: aGenre } = req.body;

    if (!Array.isArray(posts) || posts.length === 0) {
      return res.status(400).json({ success: false, error: 'posts array required' });
    }

    const col = firestoreDb.collection('autopilotPosts').doc(artistId).collection('posts');

    // Clear any previous autopilot posts for this artist before activating
    const existing = await col.get();
    if (!existing.empty) {
      const delBatch = firestoreDb.batch();
      existing.docs.forEach(d => delBatch.delete(d.ref));
      await delBatch.commit();
    }

    const batch = firestoreDb.batch();
    const saved: any[] = [];

    (posts as any[]).forEach((post: any) => {
      const docRef = col.doc();
      const scheduled = new Date(`${post.date}T12:00:00`);
      const data = {
        ...post,
        id: docRef.id,
        artistId,
        userId: (req as any).user?.id || null,
        artistName: aName || '',
        genre: aGenre || '',
        imageUrl: null,
        referenceImageUrl: referenceImageUrl || null,
        status: autopilotMode ? 'scheduled' : 'pending_approval',
        requiresApproval: !autopilotMode,
        scheduledAt: scheduled,
        createdAt: new Date(),
        approvedAt: null,
        publishedAt: null,
        platformPostId: null,
        error: null,
      };
      batch.set(docRef, data);
      saved.push({ ...data, scheduledAt: scheduled.toISOString(), createdAt: new Date().toISOString() });
    });

    await batch.commit();
    logger.log(`[Autopilot] Activated ${posts.length} posts for artist=${artistId}, mode=${autopilotMode ? 'auto' : 'review'}`);
    return res.json({ success: true, count: posts.length, mode: autopilotMode ? 'auto' : 'review', posts: saved });
  } catch (err: any) {
    logger.error('[Autopilot] activate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /:artistId/autopilot/posts
router.get('/:artistId/autopilot/posts', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb
      .collection('autopilotPosts').doc(artistId).collection('posts')
      .orderBy('day', 'asc')
      .get();

    const posts = snap.docs.map(d => {
      const data = d.data();
      return {
        ...data,
        id: d.id,
        scheduledAt: data.scheduledAt?.toDate?.()?.toISOString() || data.scheduledAt,
        approvedAt: data.approvedAt?.toDate?.()?.toISOString() || data.approvedAt || null,
        publishedAt: data.publishedAt?.toDate?.()?.toISOString() || data.publishedAt || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt,
      };
    });

    return res.json({ success: true, posts });
  } catch (err: any) {
    logger.error('[Autopilot] get posts error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /:artistId/autopilot/approve/:postId — approve individual post
router.patch('/:artistId/autopilot/approve/:postId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, postId } = req.params;
    const ref = firestoreDb.collection('autopilotPosts').doc(artistId).collection('posts').doc(postId);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Post not found' });
    await ref.update({ status: 'scheduled', approvedAt: new Date(), requiresApproval: false });
    return res.json({ success: true, postId });
  } catch (err: any) {
    logger.error('[Autopilot] approve error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /:artistId/autopilot/approve-all — approve all pending posts
router.patch('/:artistId/autopilot/approve-all', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb
      .collection('autopilotPosts').doc(artistId).collection('posts')
      .where('status', '==', 'pending_approval').get();
    if (snap.empty) return res.json({ success: true, approved: 0 });
    const batch = firestoreDb.batch();
    const now = new Date();
    snap.docs.forEach(d => batch.update(d.ref, { status: 'scheduled', approvedAt: now, requiresApproval: false }));
    await batch.commit();
    return res.json({ success: true, approved: snap.docs.length });
  } catch (err: any) {
    logger.error('[Autopilot] approve-all error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /:artistId/autopilot/posts — reset / clear all autopilot posts
router.delete('/:artistId/autopilot/posts', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await firestoreDb.collection('autopilotPosts').doc(artistId).collection('posts').get();
    if (snap.empty) return res.json({ success: true, deleted: 0 });
    const batch = firestoreDb.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    return res.json({ success: true, deleted: snap.docs.length });
  } catch (err: any) {
    logger.error('[Autopilot] delete error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /cron/publish-due-posts — external cron endpoint (protected by x-cron-secret header)
// Configure cron-job.org to POST https://boostifymusic.com/api/ads-campaigns/cron/publish-due-posts
// every 60 minutes with header: x-cron-secret: <CRON_SECRET env var>
router.post('/cron/publish-due-posts', async (req: Request, res: Response) => {
  const cronSecret = process.env.CRON_SECRET;
  const provided = (req.headers['x-cron-secret'] as string) || (req.body as any)?.cronSecret;
  if (cronSecret && provided !== cronSecret) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const now = new Date();
  const nowIso = now.toISOString();
  const results: Array<{ postId: string; artistId: string; source: 'autopilot' | 'manual'; status: string; error?: string }> = [];

  try {
    const snap = await firestoreDb
      .collectionGroup('posts')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', now)
      .limit(20)
      .get();

    logger.log(`[Autopilot Cron] ${snap.docs.length} posts due`);

    for (const docSnap of snap.docs) {
      // Scope to autopilotPosts collection only
      if (!docSnap.ref.path.includes('autopilotPosts')) continue;

      const post = docSnap.data();
      const artistId = post.artistId as string;

      try {
        await docSnap.ref.update({ status: 'publishing' });

        // Generate image if not yet generated
        let imageUrl: string | null = post.imageUrl || null;
        if (!imageUrl && post.visualPrompt) {
          imageUrl = await generateContentImage(
            post.referenceImageUrl || null,
            post.artistName || 'Artist',
            post.genre || 'music',
            (post.scene as ContentScene) || 'studio',
            post.contentType === 'reel' ? '9:16' : '1:1',
          );
          if (imageUrl) await docSnap.ref.update({ imageUrl });
        }

        const captionText = [post.engagementHook, post.caption, post.callToAction, post.hashtags]
          .filter(Boolean).join('\n\n');

        const platforms = post.platform === 'both' || post.platform === 'all'
          ? ['instagram', 'tiktok']
          : [post.platform || 'instagram'];
        const platformPostIds: Record<string, string> = {};
        const failures: string[] = [];

        for (const platform of platforms) {
          try {
            if (platform === 'instagram') {
              const result = await publishInstagramContent(artistId, { imageUrl, caption: captionText });
              platformPostIds.instagram = result.mediaId;
            } else if (platform === 'tiktok') {
              const videoUrl = post.videoUrl || post.mediaUrl || null;
              const userId = Number(post.userId || 0);
              if (!userId) throw httpError('TikTok autopilot post has no owner userId', 400);
              const result = await publishTikTokContent(userId, { videoUrl, caption: captionText, privacy: post.privacy || 'SELF_ONLY' });
              platformPostIds.tiktok = result.publishId;
            }
          } catch (platformErr: any) {
            failures.push(`${platform}: ${platformErr.message}`);
          }
        }

        const published = Object.keys(platformPostIds).length > 0 && failures.length === 0;
        const status = published ? 'published' : (Object.keys(platformPostIds).length > 0 ? 'partial' : 'failed');

        await docSnap.ref.update({
          status,
          publishedAt: status === 'published' || status === 'partial' ? new Date() : null,
          platformPostIds,
          platformPostId: platformPostIds.instagram || platformPostIds.tiktok || null,
          error: failures.length ? failures.join(' | ') : null,
        });
        results.push({ postId: docSnap.id, artistId, source: 'autopilot', status });
      } catch (postErr: any) {
        logger.error(`[Autopilot Cron] Post ${docSnap.id} failed:`, postErr.message);
        await docSnap.ref.update({ status: 'failed', error: postErr.message });
        results.push({ postId: docSnap.id, artistId, source: 'autopilot', status: 'failed', error: postErr.message });
      }
    }

    const manualSnap = await firestoreDb
      .collectionGroup('posts')
      .where('status', '==', 'scheduled')
      .where('scheduledAt', '<=', nowIso)
      .limit(20)
      .get();

    logger.log(`[Scheduled Cron] ${manualSnap.docs.length} manual posts due`);

    for (const docSnap of manualSnap.docs) {
      if (!docSnap.ref.path.includes('scheduledPosts')) continue;

      const post = docSnap.data();
      const artistId = post.artistId as string;

      try {
        await docSnap.ref.update({ status: 'publishing' });

        const platforms = post.platform === 'both' || post.platform === 'all'
          ? ['instagram', 'tiktok']
          : [post.platform || 'instagram'];
        const platformPostIds: Record<string, string> = {};
        const failures: string[] = [];

        for (const platform of platforms) {
          try {
            if (platform === 'instagram') {
              const result = await publishInstagramContent(artistId, {
                imageUrl: post.imageUrl || null,
                videoUrl: post.videoUrl || null,
                caption: post.caption || '',
                hashtags: post.hashtags || '',
              });
              platformPostIds.instagram = result.mediaId;
            } else if (platform === 'tiktok') {
              const userId = Number(post.userId || 0);
              if (!userId) throw httpError('Scheduled TikTok post has no owner userId', 400);
              const result = await publishTikTokContent(userId, {
                videoUrl: post.videoUrl || null,
                caption: post.caption || '',
                hashtags: post.hashtags || '',
                privacy: post.privacy || 'SELF_ONLY',
              });
              platformPostIds.tiktok = result.publishId;
            }
          } catch (platformErr: any) {
            failures.push(`${platform}: ${platformErr.message}`);
          }
        }

        const status = failures.length === 0 ? 'published' : (Object.keys(platformPostIds).length > 0 ? 'partial' : 'failed');
        await docSnap.ref.update({
          status,
          publishedAt: status === 'published' || status === 'partial' ? new Date().toISOString() : null,
          platformPostIds,
          platformPostId: platformPostIds.instagram || platformPostIds.tiktok || null,
          error: failures.length ? failures.join(' | ') : null,
        });
        results.push({ postId: docSnap.id, artistId, source: 'manual', status });
      } catch (postErr: any) {
        logger.error(`[Scheduled Cron] Post ${docSnap.id} failed:`, postErr.message);
        await docSnap.ref.update({ status: 'failed', error: postErr.message });
        results.push({ postId: docSnap.id, artistId, source: 'manual', status: 'failed', error: postErr.message });
      }
    }

    return res.json({ success: true, processed: results.length, results });
  } catch (err: any) {
    logger.error('[Autopilot Cron] Fatal:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
