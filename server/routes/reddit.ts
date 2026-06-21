/**
 * Reddit Artist Intelligence Center — API routes (mounted at /api/reddit).
 * ---------------------------------------------------------------------------
 * READ-ONLY market intelligence. This module turns Reddit into a continuous
 * source of fan discovery, trend detection, community & competitor analysis,
 * viral-opportunity scoring and AI growth strategy for each artist. It NEVER
 * posts, comments or votes — it only listens, scores and advises.
 *
 * Reddit access is app-level OAuth (REDDIT_CLIENT_ID/SECRET); artists connect
 * nothing. When credentials are missing the adapter runs in SIMULATION mode.
 *
 * Firestore (Admin-SDK only, client access denied by rules):
 *   artists/{artistId}/redditConfig/main          — genre, keywords, similarArtists
 *   artists/{artistId}/redditIntel/snapshot       — latest scan (all arrays)
 *   artists/{artistId}/redditReports/{reportId}   — AI strategy history
 *   artists/{artistId}/redditAuditLog/{logId}     — compliance trail
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import { getRedditGateway, isRedditConfigured, type RedditPost, type RedditSubreddit } from '../services/reddit-intelligence/reddit.adapter';
import {
  trendingScore, growthVelocity, engagementScore, viralProbability,
  audienceMatchScore, competitionLevel, fanPotential,
  aggregateSentiment, sentimentOf, keywordGrowth, mentionsTimeline, activityHeatmap,
} from '../services/reddit-intelligence/reddit.analytics';
import { generateStrategy, summarizeAudience } from '../services/reddit-intelligence/reddit.ai';

const router = Router();

function nowMs() { return Date.now(); }
function artistDoc(artistId: string) { return db.collection('artists').doc(String(artistId)); }
function uid(req: Request): string {
  return String((req.user as any)?.id ?? (req.user as any)?.uid ?? '');
}

// ─── Per-artist scan rate limiter (protects Reddit's API budget) ─────────────
const scanBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_SCANS_PER_MINUTE = 6;
function checkScanRate(artistId: string): boolean {
  const key = String(artistId);
  const now = nowMs();
  const b = scanBuckets.get(key);
  if (!b || now > b.resetAt) { scanBuckets.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count + 1 > MAX_SCANS_PER_MINUTE) return false;
  b.count += 1;
  return true;
}

async function audit(artistId: string, action: string, detail: any, ownerId?: string) {
  try {
    await artistDoc(artistId).collection('redditAuditLog').add({ action, detail: detail ?? null, ownerId: ownerId ?? null, at: nowMs() });
  } catch (e: any) {
    logger.warn('[reddit] audit write failed:', e?.message);
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────
interface RedditConfig {
  genre: string;
  keywords: string[];
  similarArtists: string[];
  autoScan: boolean;
  updatedAt: number;
}

async function loadConfig(artistId: string, fallbackGenre = 'indie', fallbackName = ''): Promise<RedditConfig> {
  const snap = await artistDoc(artistId).collection('redditConfig').doc('main').get();
  const d = (snap.exists ? snap.data() : {}) as Partial<RedditConfig>;
  return {
    genre: d.genre || fallbackGenre,
    keywords: Array.isArray(d.keywords) && d.keywords.length ? d.keywords : (fallbackName ? [fallbackName, fallbackGenre] : [fallbackGenre]),
    similarArtists: Array.isArray(d.similarArtists) ? d.similarArtists : [],
    autoScan: d.autoScan ?? false,
    updatedAt: d.updatedAt || 0,
  };
}

router.get('/config/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const cfg = await loadConfig(req.params.artistId);
    res.json({ success: true, config: cfg, configured: isRedditConfigured() });
  } catch (e: any) {
    logger.error('[reddit] get config:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load config' });
  }
});

router.post('/config/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { genre, keywords, similarArtists, autoScan } = req.body || {};
    const patch: Partial<RedditConfig> = { updatedAt: nowMs() };
    if (typeof genre === 'string') patch.genre = genre.trim().slice(0, 60);
    if (Array.isArray(keywords)) patch.keywords = keywords.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 20);
    if (Array.isArray(similarArtists)) patch.similarArtists = similarArtists.map((k: any) => String(k).trim()).filter(Boolean).slice(0, 20);
    if (typeof autoScan === 'boolean') patch.autoScan = autoScan;
    await artistDoc(artistId).collection('redditConfig').doc('main').set(patch, { merge: true });
    await audit(artistId, 'config_update', patch, uid(req));
    const cfg = await loadConfig(artistId);
    res.json({ success: true, config: cfg });
  } catch (e: any) {
    logger.error('[reddit] save config:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to save config' });
  }
});

// ─── Snapshot read/write helpers ──────────────────────────────────────────────
function snapshotRef(artistId: string) { return artistDoc(artistId).collection('redditIntel').doc('snapshot'); }

async function loadSnapshot(artistId: string): Promise<any> {
  const snap = await snapshotRef(artistId).get();
  return snap.exists ? snap.data() : null;
}

// ─── SCAN — the intelligence engine that populates everything ─────────────────
router.post('/scan/:artistId', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    if (!checkScanRate(artistId)) {
      return res.status(429).json({ success: false, error: 'Scan rate limit reached. Try again in a minute.' });
    }
    const artistName = String(req.body?.artistName || '').trim();
    const cfg = await loadConfig(artistId, req.body?.genre || 'indie', artistName);
    const gateway = getRedditGateway();

    // 1) Communities for the artist's genre.
    const subs = await gateway.searchSubreddits(cfg.genre, 14);
    const seenSub = new Set<string>();
    const communities = subs
      .filter((s) => s.subscribers > 0 && !seenSub.has(s.name) && seenSub.add(s.name))
      .map((s) => {
        const matchScore = audienceMatchScore(s);
        return {
          name: s.name,
          title: s.title,
          subscribers: s.subscribers,
          activeUsers: s.activeUsers,
          matchScore,
          fanPotential: fanPotential(matchScore),
          competitionLevel: competitionLevel(s),
          url: s.url,
          description: s.publicDescription,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);

    // 2) Trending posts across top communities + keyword searches.
    const topSubs = communities.slice(0, 4).map((c) => c.name);
    const postBatches = await Promise.all([
      ...topSubs.map((s) => gateway.getTrendingPosts(s, 18).catch(() => [] as RedditPost[])),
      ...cfg.keywords.slice(0, 3).map((k) => gateway.searchPosts(k, { sort: 'hot', limit: 18, time: 'week' }).catch(() => [] as RedditPost[])),
    ]);
    const allPosts: RedditPost[] = [];
    const seenPost = new Set<string>();
    for (const batch of postBatches) for (const p of batch) {
      if (p.id && !seenPost.has(p.id) && seenPost.add(p.id)) allPosts.push(p);
    }

    const trends = allPosts
      .map((p) => ({
        id: p.id, title: p.title, subreddit: p.subreddit, author: p.author, permalink: p.permalink,
        score: p.score, numComments: p.numComments, createdUtc: p.createdUtc,
        trendingScore: Math.round(trendingScore(p)),
        velocity: growthVelocity(p),
        engagement: Math.round(engagementScore(p)),
        viralProbability: viralProbability(p),
        sentiment: sentimentOf(`${p.title} ${p.selftext}`).label,
      }))
      .sort((a, b) => b.trendingScore - a.trendingScore)
      .slice(0, 24);

    // 3) Viral opportunities — fresh, high-velocity posts to engage with.
    const opportunities = allPosts
      .map((p) => ({ p, vp: viralProbability(p) }))
      .filter((x) => x.vp >= 45)
      .sort((a, b) => b.vp - a.vp)
      .slice(0, 12)
      .map(({ p, vp }) => ({
        id: p.id, title: p.title, subreddit: p.subreddit, permalink: p.permalink,
        viralProbability: vp, engagement: Math.round(engagementScore(p)), velocity: growthVelocity(p),
        score: p.score, numComments: p.numComments,
        reason: vp >= 75 ? 'Breaking out now — engage immediately with value' : vp >= 60 ? 'Rising fast — strong window to participate' : 'Active discussion relevant to your niche',
      }));

    // 4) Audience aggregate + sentiment.
    const sentiment = aggregateSentiment(allPosts);
    const totalReach = communities.reduce((s, c) => s + c.subscribers, 0);
    const timeline = mentionsTimeline(allPosts, 7);
    const heatmap = activityHeatmap(allPosts);

    // 5) Keyword intelligence.
    const keywordStats = await Promise.all(
      cfg.keywords.slice(0, 6).map(async (kw) => {
        try {
          const mention = await gateway.getKeywordMentions(kw, 40);
          return {
            keyword: kw,
            mentions: mention.totalMentions,
            growth: keywordGrowth(mention),
            sentiment: aggregateSentiment(mention.posts).label,
            topSubreddits: mention.topSubreddits.slice(0, 5),
          };
        } catch {
          return { keyword: kw, mentions: 0, growth: 0, sentiment: 'neutral', topSubreddits: [] };
        }
      }),
    );

    // 6) Competitors (similar artists) mention tracking.
    const competitors = await Promise.all(
      cfg.similarArtists.slice(0, 6).map(async (name) => {
        try {
          const mention = await gateway.getKeywordMentions(name, 30);
          const sent = aggregateSentiment(mention.posts);
          const avgViral = mention.posts.length ? Math.round(mention.posts.reduce((s, p) => s + viralProbability(p), 0) / mention.posts.length) : 0;
          return {
            artistName: name,
            mentions: mention.totalMentions,
            growth: keywordGrowth(mention),
            sentiment: sent.label,
            sentimentScore: sent.score,
            avgViral,
            topSubreddits: mention.topSubreddits.slice(0, 4),
          };
        } catch {
          return { artistName: name, mentions: 0, growth: 0, sentiment: 'neutral', sentimentScore: 50, avgViral: 0, topSubreddits: [] };
        }
      }),
    );

    // 7) Fan-discovery leads — people asking for recommendations in the genre.
    const fanLeadPosts = allPosts.filter((p) => /recommend|discover|looking for|suggest|new (music|artist|band)|playlist|underrated/i.test(p.title));
    const fanLeads = fanLeadPosts.slice(0, 14).map((p) => {
      const match = Math.round((engagementScore(p) * 0.5) + (sentimentOf(p.title).score * 0.5));
      return {
        id: p.id, title: p.title, subreddit: p.subreddit, author: p.author, permalink: p.permalink,
        matchScore: match, potential: fanPotential(match), numComments: p.numComments, createdUtc: p.createdUtc,
      };
    }).sort((a, b) => b.matchScore - a.matchScore);

    // 8) Analytics rollup.
    const analytics = {
      totalCommunities: communities.length,
      totalReach,
      avgMatchScore: communities.length ? Math.round(communities.reduce((s, c) => s + c.matchScore, 0) / communities.length) : 0,
      trendsTracked: trends.length,
      opportunitiesFound: opportunities.length,
      fanLeads: fanLeads.length,
      sentiment,
      timeline,
      avgViral: trends.length ? Math.round(trends.reduce((s, t) => s + t.viralProbability, 0) / trends.length) : 0,
    };

    const snapshot = {
      scannedAt: nowMs(),
      simulated: gateway.isSimulated(),
      genre: cfg.genre,
      communities, trends, opportunities, keywords: keywordStats, competitors,
      fanLeads, audience: { sentiment, totalReach, timeline, heatmap, communityCount: communities.length },
      analytics,
    };
    await snapshotRef(artistId).set(snapshot, { merge: false });
    await audit(artistId, 'scan', { genre: cfg.genre, trends: trends.length, opportunities: opportunities.length, simulated: gateway.isSimulated() }, uid(req));

    res.json({ success: true, snapshot });
  } catch (e: any) {
    logger.error('[reddit] scan failed:', e?.message);
    res.status(500).json({ success: false, error: 'Scan failed' });
  }
});

// ─── Read endpoints (serve the latest snapshot) ───────────────────────────────
function pick(key: string, fallback: any = []) {
  return async (req: Request, res: Response) => {
    try {
      const snap = await loadSnapshot(req.params.artistId);
      res.json({ success: true, [key]: snap?.[key] ?? fallback, scannedAt: snap?.scannedAt ?? null, simulated: snap?.simulated ?? !isRedditConfigured() });
    } catch (e: any) {
      logger.error(`[reddit] get ${key}:`, e?.message);
      res.status(500).json({ success: false, error: `Failed to load ${key}` });
    }
  };
}

router.get('/overview/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const [snap, cfg] = await Promise.all([loadSnapshot(req.params.artistId), loadConfig(req.params.artistId)]);
    res.json({
      success: true,
      configured: isRedditConfigured(),
      config: cfg,
      hasData: !!snap,
      scannedAt: snap?.scannedAt ?? null,
      simulated: snap?.simulated ?? !isRedditConfigured(),
      analytics: snap?.analytics ?? null,
    });
  } catch (e: any) {
    logger.error('[reddit] overview:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

router.get('/trends/:artistId', authenticate, pick('trends'));
router.get('/communities/:artistId', authenticate, pick('communities'));
router.get('/opportunities/:artistId', authenticate, pick('opportunities'));
router.get('/competitors/:artistId', authenticate, pick('competitors'));
router.get('/keywords/:artistId', authenticate, pick('keywords'));
router.get('/fans/:artistId', authenticate, pick('fanLeads'));
router.get('/analytics/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await loadSnapshot(req.params.artistId);
    res.json({ success: true, analytics: snap?.analytics ?? null, audience: snap?.audience ?? null, scannedAt: snap?.scannedAt ?? null, simulated: snap?.simulated ?? !isRedditConfigured() });
  } catch (e: any) {
    logger.error('[reddit] analytics:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

router.get('/audience/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await loadSnapshot(req.params.artistId);
    res.json({ success: true, audience: snap?.audience ?? null, communities: snap?.communities ?? [], scannedAt: snap?.scannedAt ?? null });
  } catch (e: any) {
    logger.error('[reddit] audience:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load audience' });
  }
});

// ─── Add a keyword / competitor to monitor ────────────────────────────────────
router.post('/keywords/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const keyword = String(req.body?.keyword || '').trim();
    if (!keyword) return res.status(400).json({ success: false, error: 'keyword required' });
    const cfg = await loadConfig(artistId);
    if (!cfg.keywords.includes(keyword)) cfg.keywords.push(keyword);
    await artistDoc(artistId).collection('redditConfig').doc('main').set({ keywords: cfg.keywords.slice(0, 20), updatedAt: nowMs() }, { merge: true });
    await audit(artistId, 'add_keyword', { keyword }, uid(req));
    res.json({ success: true, keywords: cfg.keywords });
  } catch (e: any) {
    logger.error('[reddit] add keyword:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to add keyword' });
  }
});

router.post('/competitors/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const name = String(req.body?.artistName || '').trim();
    if (!name) return res.status(400).json({ success: false, error: 'artistName required' });
    const cfg = await loadConfig(artistId);
    if (!cfg.similarArtists.includes(name)) cfg.similarArtists.push(name);
    await artistDoc(artistId).collection('redditConfig').doc('main').set({ similarArtists: cfg.similarArtists.slice(0, 20), updatedAt: nowMs() }, { merge: true });
    await audit(artistId, 'add_competitor', { name }, uid(req));
    res.json({ success: true, similarArtists: cfg.similarArtists });
  } catch (e: any) {
    logger.error('[reddit] add competitor:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to add competitor' });
  }
});

// ─── AI Strategy report ───────────────────────────────────────────────────────
router.post('/generate-strategy/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const artistName = String(req.body?.artistName || 'Artist');
    const [snap, cfg] = await Promise.all([loadSnapshot(artistId), loadConfig(artistId, req.body?.genre || 'indie', artistName)]);
    const report = await generateStrategy({
      artistName,
      genre: cfg.genre,
      keywords: cfg.keywords,
      topCommunities: (snap?.communities ?? []).map((c: any) => ({ name: c.name, matchScore: c.matchScore, subscribers: c.subscribers, competitionLevel: c.competitionLevel })),
      trendingTitles: (snap?.trends ?? []).map((t: any) => t.title),
      sentiment: snap?.audience?.sentiment ? { score: snap.audience.sentiment.score, label: snap.audience.sentiment.label } : undefined,
      competitors: (snap?.competitors ?? []).map((c: any) => ({ artistName: c.artistName, mentions: c.mentions, growth: c.growth })),
    });
    const doc = { ...report, generatedBy: uid(req), reportType: 'strategy', createdAt: nowMs() };
    const ref = await artistDoc(artistId).collection('redditReports').add(doc);
    await audit(artistId, 'generate_strategy', { source: report.source, reportId: ref.id }, uid(req));
    res.json({ success: true, report: { id: ref.id, ...doc } });
  } catch (e: any) {
    logger.error('[reddit] generate strategy:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to generate strategy' });
  }
});

router.get('/reports/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('redditReports').orderBy('createdAt', 'desc').limit(20).get();
    const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    res.json({ success: true, reports });
  } catch (e: any) {
    logger.error('[reddit] reports:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load reports' });
  }
});

// ─── Audience natural-language summary (on-demand) ────────────────────────────
router.post('/audience-summary/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const artistName = String(req.body?.artistName || 'Artist');
    const [snap, cfg] = await Promise.all([loadSnapshot(artistId), loadConfig(artistId, req.body?.genre || 'indie', artistName)]);
    const summary = await summarizeAudience({
      artistName, genre: cfg.genre,
      topCommunities: (snap?.communities ?? []).map((c: any) => ({ name: c.name, matchScore: c.matchScore, subscribers: c.subscribers })),
      sentiment: snap?.audience?.sentiment,
      totalReach: snap?.audience?.totalReach,
      communityCount: snap?.audience?.communityCount,
    });
    res.json({ success: true, summary });
  } catch (e: any) {
    logger.error('[reddit] audience summary:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to summarize audience' });
  }
});

export default router;
