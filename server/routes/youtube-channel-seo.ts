/**
 * BOOSTIFY — YouTube Channel SEO Engine
 * Mounted at: /api/youtube-seo
 *
 * Real-time SEO widgets for the artist's ACTUAL YouTube channel (uses the
 * OAuth connection stored by /api/auth/youtube — same one the lyrics-video /
 * karaoke upload flow uses). Reads real channel + video data via the YouTube
 * Data API v3, scores SEO deterministically, generates improvements with
 * GLM-5.2 (z.ai) → OpenAI fallback, and APPLIES them back to the channel in
 * real time (videos.update / channels.update).
 *
 * GET  /overview               → real channel stats + branding + channel SEO score
 * GET  /videos?max=12          → recent uploads w/ stats + per-video SEO score & issues
 * POST /audit-video            → { videoId } deep AI audit → improved title/description/tags
 * POST /apply-video            → { videoId, title?, description?, tags? } REAL videos.update
 * POST /audit-channel          → AI audit of channel keywords/description
 * POST /apply-channel          → { keywords?, description? } REAL channels.update (brandingSettings)
 */

import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { authenticate } from '../middleware/auth';
import {
  getValidAccessToken,
  getYoutubeConnection,
  sanitizeYoutubeTags,
  sanitizeYoutubeText,
} from '../services/youtube-service';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { PRIMARY_MODEL, ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } from '../utils/ai-config';

const router = Router();

const openai = createTrackedOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const glm: OpenAI | null = isZaiConfigured()
  ? new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL })
  : null;

/** GLM-5.2 → OpenAI cascade returning parsed JSON (or null). */
async function callSeoLLM(system: string, prompt: string): Promise<any | null> {
  const messages = [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: prompt },
  ];
  const parse = (raw: string | null | undefined): any | null => {
    if (!raw) return null;
    try {
      return JSON.parse(raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim());
    } catch {
      return null;
    }
  };
  if (glm) {
    try {
      const res = await glm.chat.completions.create({
        model: 'glm-5.2',
        messages,
        temperature: 0.6,
        max_tokens: 2500,
        response_format: { type: 'json_object' },
      });
      const out = parse(res.choices[0]?.message?.content);
      if (out) {
        console.log('[youtube-seo] GLM-5.2 ✅');
        return out;
      }
    } catch (e: any) {
      console.warn('[youtube-seo] GLM-5.2 failed, falling back to OpenAI:', e?.message);
    }
  }
  try {
    const res = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages,
      temperature: 0.6,
      response_format: { type: 'json_object' },
    });
    return parse(res.choices[0]?.message?.content);
  } catch (e: any) {
    console.warn('[youtube-seo] OpenAI fallback failed:', e?.message);
    return null;
  }
}

/** Authenticated googleapis YouTube client for the user, or null when not connected. */
async function getYt(userId: number): Promise<any | null> {
  const token = await getValidAccessToken(userId);
  if (!token) return null;
  const { google } = await import('googleapis');
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: token });
  return google.youtube({ version: 'v3', auth });
}

function ytErrorReason(e: any): string {
  const apiErr = e?.response?.data?.error;
  const reason = apiErr?.errors?.[0]?.reason;
  const msg = apiErr?.message || e?.message || 'unknown error';
  return reason ? `${reason}: ${msg}` : msg;
}

// ─── Deterministic SEO scoring (real metadata, no AI) ────────────────────────

interface SeoCheck {
  id: string;
  label: string;
  pass: boolean;
  weight: number;
  tip: string;
}

function scoreVideoSeo(snippet: any, stats: any): { score: number; checks: SeoCheck[] } {
  const title: string = snippet?.title || '';
  const desc: string = snippet?.description || '';
  const tags: string[] = snippet?.tags || [];
  const views = Number(stats?.viewCount || 0);
  const likes = Number(stats?.likeCount || 0);
  const checks: SeoCheck[] = [
    {
      id: 'title-length', label: 'Title 20–70 chars',
      pass: title.length >= 20 && title.length <= 70, weight: 15,
      tip: 'Titles between 20 and 70 characters rank best and never truncate in search.',
    },
    {
      id: 'title-hook', label: 'Title has a hook (number, bracket or power word)',
      pass: /\d|\[|\(|official|video|live|new|remix|ft\.|feat/i.test(title), weight: 10,
      tip: 'Add a number, [Official Video], (Live) or a power word to lift CTR.',
    },
    {
      id: 'desc-length', label: 'Description ≥ 200 chars',
      pass: desc.length >= 200, weight: 15,
      tip: 'YouTube indexes the first 200+ characters — describe the song, artist and links.',
    },
    {
      id: 'desc-links', label: 'Description has links',
      pass: /https?:\/\//i.test(desc), weight: 10,
      tip: 'Add streaming, merch and social links to convert viewers.',
    },
    {
      id: 'desc-hashtags', label: 'Description has hashtags',
      pass: /#\w+/.test(desc), weight: 10,
      tip: 'Add 3 relevant hashtags — they show above the title.',
    },
    {
      id: 'tags-count', label: '8+ tags',
      pass: tags.length >= 8, weight: 15,
      tip: 'Use 8–15 tags mixing artist name, song, genre and mood keywords.',
    },
    {
      id: 'keyword-consistency', label: 'Title keywords repeated in description',
      pass: title
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .some((w) => desc.toLowerCase().includes(w)), weight: 10,
      tip: 'Repeat your main title keywords in the first lines of the description.',
    },
    {
      id: 'engagement', label: 'Healthy like ratio',
      pass: views === 0 || likes / Math.max(views, 1) >= 0.01, weight: 15,
      tip: 'Ask viewers to like/comment — engagement drives recommendations.',
    },
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

function scoreChannelSeo(branding: any, snippet: any, stats: any): { score: number; checks: SeoCheck[] } {
  const keywords: string = branding?.channel?.keywords || '';
  const desc: string = branding?.channel?.description || snippet?.description || '';
  const checks: SeoCheck[] = [
    {
      id: 'channel-keywords', label: 'Channel keywords set',
      pass: keywords.trim().length >= 20, weight: 30,
      tip: 'Channel keywords tell YouTube what your channel is about — set 10-15.',
    },
    {
      id: 'channel-desc', label: 'Channel description ≥ 150 chars',
      pass: desc.length >= 150, weight: 30,
      tip: 'Write a keyword-rich channel description (first 150 chars appear in search).',
    },
    {
      id: 'channel-branding', label: 'Custom thumbnail/avatar',
      pass: Boolean(snippet?.thumbnails?.high?.url), weight: 15,
      tip: 'Upload channel art so search results look professional.',
    },
    {
      id: 'upload-cadence', label: 'Active channel (5+ videos)',
      pass: Number(stats?.videoCount || 0) >= 5, weight: 25,
      tip: 'Consistent uploads signal an active channel to the algorithm.',
    },
  ];
  const total = checks.reduce((s, c) => s + c.weight, 0);
  const earned = checks.reduce((s, c) => s + (c.pass ? c.weight : 0), 0);
  return { score: Math.round((earned / total) * 100), checks };
}

// ─── GET /overview — real channel stats + channel SEO score ─────────────────

router.get('/overview', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const conn = await getYoutubeConnection(userId);
    if (!conn) return res.json({ success: true, connected: false });
    const yt = await getYt(userId);
    if (!yt) return res.json({ success: true, connected: false });

    const ch = await yt.channels.list({
      part: ['snippet', 'statistics', 'brandingSettings', 'contentDetails'],
      mine: true,
    });
    const c = ch.data.items?.[0];
    if (!c) return res.json({ success: true, connected: false });

    const { score, checks } = scoreChannelSeo(c.brandingSettings, c.snippet, c.statistics);
    res.json({
      success: true,
      connected: true,
      channel: {
        id: c.id,
        title: c.snippet?.title || conn.channelTitle,
        thumbnailUrl: c.snippet?.thumbnails?.high?.url || c.snippet?.thumbnails?.default?.url || conn.thumbnailUrl,
        customUrl: c.snippet?.customUrl || '',
        subscribers: Number(c.statistics?.subscriberCount || 0),
        totalViews: Number(c.statistics?.viewCount || 0),
        videoCount: Number(c.statistics?.videoCount || 0),
        keywords: c.brandingSettings?.channel?.keywords || '',
        description: c.brandingSettings?.channel?.description || c.snippet?.description || '',
        uploadsPlaylistId: c.contentDetails?.relatedPlaylists?.uploads || '',
        canManageChannel: (conn.scopes || '').split(/\s+/).includes('https://www.googleapis.com/auth/youtube'),
      },
      seo: { score, checks },
    });
  } catch (e: any) {
    console.error('[youtube-seo] overview error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

// ─── GET /videos — recent uploads + per-video real SEO scores ────────────────

router.get('/videos', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  try {
    const yt = await getYt(userId);
    if (!yt) return res.json({ success: true, connected: false, videos: [] });

    const ch = await yt.channels.list({ part: ['contentDetails'], mine: true });
    const uploads = ch.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return res.json({ success: true, connected: true, videos: [] });

    const max = Math.min(Number(req.query.max) || 12, 25);
    const pl = await yt.playlistItems.list({ part: ['contentDetails'], playlistId: uploads, maxResults: max });
    const ids = (pl.data.items || [])
      .map((i: any) => i.contentDetails?.videoId)
      .filter(Boolean);
    if (ids.length === 0) return res.json({ success: true, connected: true, videos: [] });

    const vids = await yt.videos.list({ part: ['snippet', 'statistics'], id: ids });
    const videos = (vids.data.items || []).map((v: any) => {
      const { score, checks } = scoreVideoSeo(v.snippet, v.statistics);
      return {
        id: v.id,
        title: v.snippet?.title || '',
        description: v.snippet?.description || '',
        tags: v.snippet?.tags || [],
        thumbnailUrl: v.snippet?.thumbnails?.medium?.url || '',
        publishedAt: v.snippet?.publishedAt,
        views: Number(v.statistics?.viewCount || 0),
        likes: Number(v.statistics?.likeCount || 0),
        comments: Number(v.statistics?.commentCount || 0),
        seoScore: score,
        issues: checks.filter((c) => !c.pass).map((c) => ({ id: c.id, label: c.label, tip: c.tip })),
      };
    });
    videos.sort((a: any, b: any) => a.seoScore - b.seoScore);
    res.json({ success: true, connected: true, videos });
  } catch (e: any) {
    console.error('[youtube-seo] videos error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

// ─── POST /audit-video — AI improvement plan for a real video ────────────────

router.post('/audit-video', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { videoId, artistName, genre } = req.body || {};
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required' });
  try {
    const yt = await getYt(userId);
    if (!yt) return res.status(400).json({ success: false, error: 'YouTube not connected' });

    const list = await yt.videos.list({ part: ['snippet', 'statistics'], id: [videoId] });
    const v = list.data.items?.[0];
    if (!v?.snippet) return res.status(404).json({ success: false, error: 'Video not found' });

    const { score, checks } = scoreVideoSeo(v.snippet, v.statistics);
    const failing = checks.filter((c) => !c.pass);

    const result = await callSeoLLM(
      'You are a YouTube SEO expert for music artists. Respond with valid JSON only.',
      `Optimize this REAL YouTube video for search and CTR.
Artist: ${artistName || 'music artist'}${genre ? ` (genre: ${genre})` : ''}
Current title: ${v.snippet.title}
Current description (first 800 chars): ${(v.snippet.description || '').slice(0, 800)}
Current tags: ${(v.snippet.tags || []).join(', ') || 'none'}
Stats: ${v.statistics?.viewCount || 0} views, ${v.statistics?.likeCount || 0} likes
Current SEO score: ${score}/100. Failing checks: ${failing.map((f) => f.label).join('; ') || 'none'}

Return JSON:
{
  "improvedTitle": "optimized title, 20-70 chars, keep artist/song name, add a CTR hook",
  "improvedDescription": "full optimized description: 2-3 keyword-rich paragraphs, then LINKS section placeholder lines, then 3 hashtags. Keep any existing links from the current description.",
  "improvedTags": ["12-15 tags: artist, song, genre, mood, related artists"],
  "reasoning": "2 sentences: what changed and why it will rank better",
  "expectedImpact": "short phrase e.g. '+15-30% search CTR'"
}`,
    );
    if (!result) return res.status(500).json({ success: false, error: 'AI audit failed' });
    res.json({
      success: true,
      videoId,
      currentScore: score,
      failingChecks: failing,
      suggestion: {
        title: String(result.improvedTitle || v.snippet.title).slice(0, 100),
        description: String(result.improvedDescription || v.snippet.description || ''),
        tags: sanitizeYoutubeTags(Array.isArray(result.improvedTags) ? result.improvedTags : []),
        reasoning: result.reasoning || '',
        expectedImpact: result.expectedImpact || '',
      },
    });
  } catch (e: any) {
    console.error('[youtube-seo] audit-video error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

// ─── POST /apply-video — REAL-TIME update on the channel (videos.update) ─────

router.post('/apply-video', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { videoId, title, description, tags } = req.body || {};
  if (!videoId) return res.status(400).json({ success: false, error: 'videoId is required' });
  if (!title && !description && !tags) {
    return res.status(400).json({ success: false, error: 'Nothing to apply' });
  }
  try {
    const yt = await getYt(userId);
    if (!yt) return res.status(400).json({ success: false, error: 'YouTube not connected' });

    // videos.update requires the full snippet — read current & merge.
    const list = await yt.videos.list({ part: ['snippet'], id: [videoId] });
    const item = list.data.items?.[0];
    if (!item?.snippet) return res.status(404).json({ success: false, error: 'Video not found' });

    const nextTags = tags ? sanitizeYoutubeTags(tags) : item.snippet.tags || undefined;
    await yt.videos.update({
      part: ['snippet'],
      requestBody: {
        id: videoId,
        snippet: {
          title: sanitizeYoutubeText(title || item.snippet.title || 'Video', 95),
          categoryId: item.snippet.categoryId || '10',
          description: sanitizeYoutubeText(description || item.snippet.description || '', 4900),
          tags: nextTags,
          defaultLanguage: item.snippet.defaultLanguage || undefined,
        },
      },
    });
    // Re-score after applying so the widget updates instantly.
    const after = await yt.videos.list({ part: ['snippet', 'statistics'], id: [videoId] });
    const v = after.data.items?.[0];
    const rescored = v ? scoreVideoSeo(v.snippet, v.statistics) : null;
    res.json({
      success: true,
      applied: true,
      videoId,
      newScore: rescored?.score ?? null,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
    });
  } catch (e: any) {
    console.error('[youtube-seo] apply-video error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

// ─── POST /audit-channel — AI keywords/description for the channel ───────────

router.post('/audit-channel', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { artistName, genre } = req.body || {};
  try {
    const yt = await getYt(userId);
    if (!yt) return res.status(400).json({ success: false, error: 'YouTube not connected' });

    const ch = await yt.channels.list({ part: ['snippet', 'statistics', 'brandingSettings'], mine: true });
    const c = ch.data.items?.[0];
    if (!c) return res.status(404).json({ success: false, error: 'Channel not found' });

    const result = await callSeoLLM(
      'You are a YouTube channel SEO strategist for music artists. Respond with valid JSON only.',
      `Optimize the channel-level SEO for this REAL YouTube channel.
Channel: ${c.snippet?.title}
Artist: ${artistName || c.snippet?.title}${genre ? ` (genre: ${genre})` : ''}
Current channel keywords: ${c.brandingSettings?.channel?.keywords || 'NONE SET'}
Current channel description: ${(c.brandingSettings?.channel?.description || c.snippet?.description || 'NONE').slice(0, 600)}
Stats: ${c.statistics?.subscriberCount || 0} subscribers, ${c.statistics?.videoCount || 0} videos

Return JSON:
{
  "keywords": "space-separated channel keywords (quote multi-word ones), 12-15 total, mixing artist name, genre, and discovery terms",
  "description": "optimized channel description, 300-600 chars, keyword-rich first sentence, artist story, upload promise",
  "reasoning": "2 sentences why these choices"
}`,
    );
    if (!result) return res.status(500).json({ success: false, error: 'AI audit failed' });
    res.json({
      success: true,
      current: {
        keywords: c.brandingSettings?.channel?.keywords || '',
        description: c.brandingSettings?.channel?.description || c.snippet?.description || '',
      },
      suggestion: {
        keywords: String(result.keywords || ''),
        description: String(result.description || '').slice(0, 900),
        reasoning: result.reasoning || '',
      },
    });
  } catch (e: any) {
    console.error('[youtube-seo] audit-channel error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

// ─── POST /apply-channel — REAL channels.update (brandingSettings) ───────────

router.post('/apply-channel', authenticate, async (req: Request, res: Response) => {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });
  const { keywords, description } = req.body || {};
  if (!keywords && !description) {
    return res.status(400).json({ success: false, error: 'Nothing to apply' });
  }
  try {
    const yt = await getYt(userId);
    if (!yt) return res.status(400).json({ success: false, error: 'YouTube not connected' });

    const ch = await yt.channels.list({ part: ['brandingSettings'], mine: true });
    const c = ch.data.items?.[0];
    if (!c?.id) return res.status(404).json({ success: false, error: 'Channel not found' });

    const current = c.brandingSettings?.channel || {};
    await yt.channels.update({
      part: ['brandingSettings'],
      requestBody: {
        id: c.id,
        brandingSettings: {
          channel: {
            ...current,
            keywords: keywords != null ? String(keywords).slice(0, 500) : current.keywords,
            description: description != null ? sanitizeYoutubeText(String(description), 900) : current.description,
          },
        },
      },
    });
    res.json({ success: true, applied: true, channelId: c.id });
  } catch (e: any) {
    console.error('[youtube-seo] apply-channel error:', ytErrorReason(e));
    res.status(500).json({ success: false, error: ytErrorReason(e) });
  }
});

export default router;
