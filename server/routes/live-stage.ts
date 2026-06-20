/**
 * BOOSTIFY LIVE STAGE — live video monetization API
 * --------------------------------------------------
 * Mounted at /api/live-stage.
 *
 * A specialized live-streaming economy for music artists. Fans join live
 * sessions, chat, send animated gifts paid with internal credits (optionally
 * backed by the BTF token), request songs, vote in battles and buy VIP access.
 * Every gift splits revenue across the artist, the platform and a reward pool,
 * with a secure internal ledger and KYC-gated payouts.
 *
 * Economy split per gift:  75% artist · 20% platform · 5% reward pool / burn.
 *
 * Firestore collections
 *   live_stage_sessions          live session docs (+ subcols chat, gifts, requests)
 *   live_stage_wallets           one wallet per artist (credits + usd ledger summary)
 *   live_stage_credits           one credit balance per fan/user
 *   live_stage_transactions      append-only ledger (gifts, purchases, payouts)
 *   live_stage_fans              aggregated fan stats per artist (ranking, level)
 *   live_stage_payouts           payout requests (KYC gated)
 *   live_stage_payments          Stripe credit-pack checkout sessions
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { isAuthenticated, getUserId } from '../middleware/clerk-auth';
import { db, FieldValue } from '../firebase';

const router = Router();

/* ----------------------------- collections ----------------------------- */
const SESSIONS_COL = 'live_stage_sessions';
const WALLETS_COL = 'live_stage_wallets';
const CREDITS_COL = 'live_stage_credits';
const LEDGER_COL = 'live_stage_transactions';
const FANS_COL = 'live_stage_fans';
const PAYOUTS_COL = 'live_stage_payouts';
const PAYMENTS_COL = 'live_stage_payments';

/* ------------------------------ economy -------------------------------- */
/** 1 credit = $0.01  →  100 credits = $1.00 */
export const CREDIT_USD_VALUE = 0.01;
const ARTIST_SHARE = 0.75;
const PLATFORM_SHARE = 0.20;
const REWARD_SHARE = 0.05; // remainder, burn / treasury / reward pool

/* ----------------------------- gift catalog ---------------------------- */
interface GiftDef {
  id: string;
  name: string;
  emoji: string;
  tier: 'cheap' | 'mid' | 'premium' | 'legendary';
  credits: number;
  rankValue: number; // weight toward fan ranking + stage rank
  animation: 'float' | 'burst' | 'rocket' | 'rain' | 'stage' | 'crown' | 'spotlight';
  color: string;
  sound?: string;
}

export const GIFT_CATALOG: GiftDef[] = [
  { id: 'red_rose', name: 'Red Rose', emoji: '🌹', tier: 'cheap', credits: 5, rankValue: 5, animation: 'float', color: '#ef4444' },
  { id: 'fire_mic', name: 'Fire Mic', emoji: '🎤', tier: 'cheap', credits: 10, rankValue: 12, animation: 'burst', color: '#f97316' },
  { id: 'boost_rocket', name: 'Boost Rocket', emoji: '🚀', tier: 'mid', credits: 50, rankValue: 70, animation: 'rocket', color: '#38bdf8' },
  { id: 'crown_fan', name: 'Crown Fan', emoji: '👑', tier: 'mid', credits: 99, rankValue: 150, animation: 'crown', color: '#facc15' },
  { id: 'golden_mic', name: 'Golden Mic', emoji: '🏆', tier: 'premium', credits: 299, rankValue: 480, animation: 'spotlight', color: '#eab308' },
  { id: 'diamond_stage', name: 'Diamond Stage', emoji: '💎', tier: 'premium', credits: 599, rankValue: 1000, animation: 'stage', color: '#22d3ee' },
  { id: 'private_dedication', name: 'Private Dedication', emoji: '💌', tier: 'legendary', credits: 999, rankValue: 1800, animation: 'spotlight', color: '#ec4899' },
  { id: 'legend_gift', name: 'Legend Gift', emoji: '🌟', tier: 'legendary', credits: 1999, rankValue: 4000, animation: 'rain', color: '#a855f7' },
];

const GIFT_MAP = new Map(GIFT_CATALOG.map((g) => [g.id, g]));

/* --------------------------- credit packages --------------------------- */
interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonus: number; // extra credits
  amount: number; // cents (Stripe)
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: 'pack_starter', name: 'Starter', credits: 500, bonus: 0, amount: 499 },
  { id: 'pack_fan', name: 'Super Fan', credits: 1200, bonus: 150, amount: 999 },
  { id: 'pack_vip', name: 'VIP', credits: 3000, bonus: 600, amount: 2499 },
  { id: 'pack_legend', name: 'Legend', credits: 6500, bonus: 1800, amount: 4999 },
  { id: 'pack_icon', name: 'Icon', credits: 14000, bonus: 5000, amount: 9999 },
];

const PACKAGE_MAP = new Map(CREDIT_PACKAGES.map((p) => [p.id, p]));

/* ------------------------------ live types ----------------------------- */
export const LIVE_TYPES = [
  { id: 'performance', name: 'Live Performance', emoji: '🎸' },
  { id: 'listening_party', name: 'Listening Party', emoji: '🎧' },
  { id: 'backstage', name: 'Backstage Live', emoji: '🎬' },
  { id: 'vip_room', name: 'Private VIP Room', emoji: '🔒' },
  { id: 'masterclass', name: 'Masterclass', emoji: '🎓' },
  { id: 'qa', name: 'Fan Q&A', emoji: '💬' },
  { id: 'song_request', name: 'Song Request Live', emoji: '🎵' },
  { id: 'battle', name: 'Battle Live', emoji: '⚔️' },
  { id: 'rehearsal', name: 'Rehearsal Live', emoji: '🎹' },
  { id: 'release_party', name: 'Release Party', emoji: '🎉' },
  { id: 'sponsor', name: 'Sponsor Live', emoji: '🤝' },
];

/* ----------------------------- level systems --------------------------- */
export const ARTIST_LEVELS = [
  { id: 'new_stage', name: 'New Stage', minScore: 0 },
  { id: 'rising_voice', name: 'Rising Voice', minScore: 500 },
  { id: 'fan_magnet', name: 'Fan Magnet', minScore: 2500 },
  { id: 'golden_performer', name: 'Golden Performer', minScore: 10000 },
  { id: 'headliner', name: 'Headliner', minScore: 35000 },
  { id: 'icon', name: 'Icon', minScore: 100000 },
  { id: 'legend_stage', name: 'Legend Stage', minScore: 300000 },
];

export const FAN_LEVELS = [
  { id: 'new_fan', name: 'New Fan', minPoints: 0 },
  { id: 'supporter', name: 'Supporter', minPoints: 100 },
  { id: 'super_fan', name: 'Super Fan', minPoints: 500 },
  { id: 'vip_fan', name: 'VIP Fan', minPoints: 2000 },
  { id: 'executive_fan', name: 'Executive Fan', minPoints: 8000 },
  { id: 'legend_fan', name: 'Legend Fan', minPoints: 25000 },
];

export function artistLevelForScore(score: number) {
  let level = ARTIST_LEVELS[0];
  for (const l of ARTIST_LEVELS) if (score >= l.minScore) level = l;
  return level;
}

export function fanLevelForPoints(points: number) {
  let level = FAN_LEVELS[0];
  for (const l of FAN_LEVELS) if (points >= l.minPoints) level = l;
  return level;
}

/* ------------------------- moderation (basic AI) ----------------------- */
const BLOCKED_WORDS = ['spam', 'scam', 'http://', 'https://', 'free money', 'onlyfans', 'telegram.me', 't.me/'];

function moderateMessage(text: string): { allowed: boolean; cleaned: string; reason?: string } {
  const lower = text.toLowerCase();
  for (const w of BLOCKED_WORDS) {
    if (lower.includes(w)) return { allowed: false, cleaned: '', reason: 'blocked_content' };
  }
  // light profanity mask
  const cleaned = text.replace(/\b(fuck|shit|bitch)\b/gi, (m) => m[0] + '*'.repeat(m.length - 1));
  return { allowed: true, cleaned: cleaned.slice(0, 500) };
}

/* ------------------------------ helpers -------------------------------- */
function requireDb(res: Response): boolean {
  if (!db) {
    res.status(503).json({ success: false, error: 'Firestore unavailable' });
    return false;
  }
  return true;
}

function shortId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clean<T extends Record<string, any>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

function serialize(value: any): any {
  if (!value) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

function docData(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
  return serialize({ id: doc.id, ...(doc.data() || {}) });
}

function currentUser(req: Request, res: Response): string | null {
  const userId = getUserId(req) || (req.user as any)?.id || null;
  if (!userId) {
    res.status(401).json({ success: false, error: 'unauthenticated' });
    return null;
  }
  return String(userId);
}

function optionalUser(req: Request): string | null {
  const userId = getUserId(req) || (req.user as any)?.id || null;
  return userId ? String(userId) : null;
}

function currentName(req: Request): string {
  const u = req.user as any;
  return u?.username || u?.firstName || u?.name || u?.email?.split('@')[0] || 'Fan';
}

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any }) : null;

function getBaseUrl(req: Request): string {
  if (process.env.PRODUCTION_URL) return process.env.PRODUCTION_URL.replace(/\/$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5000';
  return `${proto}://${host}`;
}

/* =======================================================================
 *  ALGORITHMS — Quality Score + StageRank
 * ===================================================================== */

export interface SessionMetrics {
  watchSeconds: number;     // total cumulative watch time (all viewers)
  peakViewers: number;
  avgViewers: number;
  uniqueViewers: number;
  chatMessages: number;
  durationSeconds: number;
  giftsCredits: number;     // total credits gifted
  giftsCount: number;
  newFollowers: number;
  returningFans: number;
  songRequests: number;
  negativeReports: number;
  audioQuality: number;     // 0..1 self/auto reported
  videoQuality: number;     // 0..1
  connectionStability: number; // 0..1
}

/**
 * Quality Score (0..100): gates whether a live qualifies for discovery.
 * Combines technical quality (audio/video/connection) with real engagement
 * and penalizes negative reports.
 */
export function computeQualityScore(m: Partial<SessionMetrics>): number {
  const audio = clamp01(m.audioQuality ?? 0.7);
  const video = clamp01(m.videoQuality ?? 0.7);
  const conn = clamp01(m.connectionStability ?? 0.8);
  const duration = m.durationSeconds ?? 0;
  const chat = m.chatMessages ?? 0;
  const gifts = m.giftsCount ?? 0;
  const viewers = m.avgViewers ?? 0;
  const reports = m.negativeReports ?? 0;

  // technical 50%, engagement 50%
  const technical = (audio * 0.4 + video * 0.4 + conn * 0.2) * 50;

  const engagementSignal =
    Math.min(1, chat / Math.max(1, duration / 30)) * 0.35 + // ~1 msg / 30s = full
    Math.min(1, gifts / 10) * 0.35 +
    Math.min(1, viewers / 25) * 0.30;
  const engagement = engagementSignal * 50;

  let score = technical + engagement;
  score -= Math.min(40, reports * 8); // each report stings
  if (duration < 60) score *= 0.6;    // too short to evaluate
  return Math.round(clamp(score, 0, 100));
}

/**
 * StageRank score: decides discovery / trending / boost.
 * Weighted blend of retention, engagement, monetization, growth and quality,
 * penalized by negative reports. Designed for quality artists, not just volume.
 */
export const STAGE_RANK_WEIGHTS = {
  watchTime: 0.18,
  retention: 0.16,
  chatRate: 0.12,
  gifts: 0.20,
  newFollowers: 0.10,
  returningFans: 0.08,
  quality: 0.12,
  conversion: 0.04,
  reportsPenalty: 0.30, // applied as subtractive multiplier base
};

export function computeStageRank(m: Partial<SessionMetrics>, qualityScore?: number): number {
  const duration = Math.max(1, m.durationSeconds ?? 1);
  const avgViewers = m.avgViewers ?? 0;
  const peak = Math.max(1, m.peakViewers ?? 1);
  const watchTime = Math.min(1, (m.watchSeconds ?? 0) / (duration * Math.max(1, avgViewers) || 1));
  const retention = clamp01(avgViewers / peak);
  const chatRate = Math.min(1, (m.chatMessages ?? 0) / (duration / 30));
  const gifts = Math.min(1, (m.giftsCredits ?? 0) / 2000);
  const newFollowers = Math.min(1, (m.newFollowers ?? 0) / 50);
  const returningFans = Math.min(1, (m.returningFans ?? 0) / 30);
  const quality = clamp01((qualityScore ?? computeQualityScore(m)) / 100);
  const conversion = Math.min(1, (m.giftsCount ?? 0) / Math.max(1, m.uniqueViewers ?? 1));

  const w = STAGE_RANK_WEIGHTS;
  let raw =
    watchTime * w.watchTime +
    retention * w.retention +
    chatRate * w.chatRate +
    gifts * w.gifts +
    newFollowers * w.newFollowers +
    returningFans * w.returningFans +
    quality * w.quality +
    conversion * w.conversion;

  // negative reports cut the score multiplicatively
  const reportPenalty = Math.max(0, 1 - (m.negativeReports ?? 0) * 0.15);
  raw *= reportPenalty;

  return Math.round(clamp(raw, 0, 1) * 1000); // 0..1000 scale
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function clamp01(v: number) {
  return clamp(v, 0, 1);
}

function metricsFromSession(s: any): Partial<SessionMetrics> {
  const totals = s.totals || {};
  const started = s.startedAt?.toDate ? s.startedAt.toDate().getTime() : Date.now();
  const ended = s.endedAt?.toDate ? s.endedAt.toDate().getTime() : Date.now();
  const durationSeconds = s.status === 'live' ? (Date.now() - started) / 1000 : Math.max(0, (ended - started) / 1000);
  return {
    watchSeconds: totals.watchSeconds || 0,
    peakViewers: totals.peakViewers || 0,
    avgViewers: totals.avgViewers || totals.peakViewers || 0,
    uniqueViewers: totals.uniqueViewers || 0,
    chatMessages: totals.chatMessages || 0,
    durationSeconds,
    giftsCredits: totals.giftsCredits || 0,
    giftsCount: totals.giftsCount || 0,
    newFollowers: totals.newFollowers || 0,
    returningFans: totals.returningFans || 0,
    songRequests: totals.songRequests || 0,
    negativeReports: totals.negativeReports || 0,
    audioQuality: s.quality?.audio ?? 0.75,
    videoQuality: s.quality?.video ?? 0.75,
    connectionStability: s.quality?.connection ?? 0.85,
  };
}

/* =======================================================================
 *  CATALOG
 * ===================================================================== */
router.get('/catalog', (_req: Request, res: Response) => {
  res.json({
    success: true,
    gifts: GIFT_CATALOG,
    creditPackages: CREDIT_PACKAGES,
    liveTypes: LIVE_TYPES,
    artistLevels: ARTIST_LEVELS,
    fanLevels: FAN_LEVELS,
    creditUsdValue: CREDIT_USD_VALUE,
    economy: { artist: ARTIST_SHARE, platform: PLATFORM_SHARE, rewardPool: REWARD_SHARE },
  });
});

/* =======================================================================
 *  DISCOVERY
 * ===================================================================== */
router.get('/discovery', async (_req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const snap = await db.collection(SESSIONS_COL)
      .where('status', '==', 'live')
      .limit(50)
      .get();
    const sessions = snap.docs
      .map(docData)
      .filter((s: any) => s.visibility !== 'private')
      .map((s: any) => ({ ...s, stageRank: s.stageRank ?? 0 }))
      .sort((a: any, b: any) => (b.stageRank ?? 0) - (a.stageRank ?? 0));
    res.json({ success: true, sessions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  SESSIONS
 * ===================================================================== */
// Artist session history + active session
router.get('/artist/:artistId/sessions', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const artistId = String(req.params.artistId);
    const snap = await db.collection(SESSIONS_COL)
      .where('artistId', '==', artistId)
      .limit(50)
      .get();
    const sessions = snap.docs.map(docData)
      .sort((a: any, b: any) => (b.createdAt > a.createdAt ? 1 : -1));
    const live = sessions.find((s: any) => s.status === 'live') || null;
    res.json({ success: true, sessions, live });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Create / start a live session (owner)
router.post('/sessions', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const b = req.body || {};
    const artistId = String(b.artistId || userId);
    const id = shortId('live');
    const now = FieldValue.serverTimestamp();
    const scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    const isScheduled = !!scheduledAt && scheduledAt.getTime() > Date.now();

    const doc = clean({
      id,
      artistId,
      ownerId: userId,
      artistName: b.artistName || 'Artist',
      artistAvatar: b.artistAvatar || null,
      artistSlug: b.artistSlug || null,
      title: String(b.title || 'Live Stage').slice(0, 120),
      type: LIVE_TYPES.find((t) => t.id === b.type) ? b.type : 'performance',
      visibility: ['public', 'private', 'ticketed', 'vip'].includes(b.visibility) ? b.visibility : 'public',
      ticketPriceCredits: Math.max(0, Number(b.ticketPriceCredits) || 0),
      vipPriceCredits: Math.max(0, Number(b.vipPriceCredits) || 0),
      songRequestPriceCredits: Math.max(0, Number(b.songRequestPriceCredits) || 25),
      giftGoalCredits: Math.max(0, Number(b.giftGoalCredits) || 0),
      chatEnabled: b.chatEnabled !== false,
      slowModeSeconds: Math.max(0, Number(b.slowModeSeconds) || 0),
      status: isScheduled ? 'scheduled' : 'live',
      scheduledAt: scheduledAt ? scheduledAt : null,
      quality: { audio: 0.8, video: 0.8, connection: 0.9 },
      totals: {
        watchSeconds: 0, peakViewers: 0, avgViewers: 0, uniqueViewers: 0,
        chatMessages: 0, giftsCredits: 0, giftsCount: 0, newFollowers: 0,
        returningFans: 0, songRequests: 0, negativeReports: 0,
        artistCredits: 0, platformCredits: 0, rewardCredits: 0,
      },
      stageRank: 0,
      qualityScore: 0,
      viewers: 0,
      createdAt: now,
      startedAt: isScheduled ? null : now,
      endedAt: null,
    });

    await db.collection(SESSIONS_COL).doc(id).set(doc);
    await ensureWallet(artistId, doc.artistName);
    res.json({ success: true, session: serialize({ ...doc, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Get a session
router.get('/sessions/:id', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const snap = await db.collection(SESSIONS_COL).doc(String(req.params.id)).get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    res.json({ success: true, session: docData(snap) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Update / control a session (owner): end, toggle chat, go-live a scheduled one
router.patch('/sessions/:id', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const ref = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = snap.data() as any;
    if (s.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });

    const b = req.body || {};
    const update: Record<string, any> = {};
    if (b.action === 'go-live') { update.status = 'live'; update.startedAt = FieldValue.serverTimestamp(); }
    if (b.action === 'end') {
      update.status = 'ended';
      update.endedAt = FieldValue.serverTimestamp();
      // finalize scores
      const metrics = metricsFromSession(s);
      const qualityScore = computeQualityScore(metrics);
      update.qualityScore = qualityScore;
      update.stageRank = computeStageRank(metrics, qualityScore);
    }
    if (typeof b.chatEnabled === 'boolean') update.chatEnabled = b.chatEnabled;
    if (typeof b.slowModeSeconds === 'number') update.slowModeSeconds = Math.max(0, b.slowModeSeconds);
    if (typeof b.giftGoalCredits === 'number') update['giftGoalCredits'] = Math.max(0, b.giftGoalCredits);
    if (b.quality && typeof b.quality === 'object') {
      update.quality = {
        audio: clamp01(Number(b.quality.audio ?? s.quality?.audio ?? 0.8)),
        video: clamp01(Number(b.quality.video ?? s.quality?.video ?? 0.8)),
        connection: clamp01(Number(b.quality.connection ?? s.quality?.connection ?? 0.9)),
      };
    }
    update.updatedAt = FieldValue.serverTimestamp();
    await ref.set(update, { merge: true });
    const fresh = await ref.get();
    res.json({ success: true, session: docData(fresh) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Viewer heartbeat — tracks presence + watch time + recomputes live rank
router.post('/sessions/:id/heartbeat', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const ref = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const snap = await ref.get();
    if (!snap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = snap.data() as any;
    const viewers = Math.max(0, Number(req.body?.viewers ?? s.viewers ?? 0));
    const watched = Math.max(0, Number(req.body?.watchedSeconds ?? 0));

    const totals = s.totals || {};
    const peak = Math.max(totals.peakViewers || 0, viewers);
    const samples = (totals._viewerSamples || 0) + 1;
    const avg = ((totals.avgViewers || 0) * (samples - 1) + viewers) / samples;

    const newTotals = {
      ...totals,
      watchSeconds: (totals.watchSeconds || 0) + watched,
      peakViewers: peak,
      avgViewers: Math.round(avg),
      _viewerSamples: samples,
    };
    const metrics = metricsFromSession({ ...s, totals: newTotals });
    const qualityScore = computeQualityScore(metrics);
    const stageRank = computeStageRank(metrics, qualityScore);

    await ref.set({ viewers, totals: newTotals, qualityScore, stageRank, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true, viewers, stageRank, qualityScore });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  CHAT
 * ===================================================================== */
router.get('/sessions/:id/chat', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const limit = Math.min(100, Number(req.query.limit) || 60);
    const snap = await db.collection(SESSIONS_COL).doc(sessionId).collection('chat')
      .orderBy('createdAt', 'desc').limit(limit).get();
    const messages = snap.docs.map(docData).reverse();
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/sessions/:id/chat', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const sessionRef = db.collection(SESSIONS_COL).doc(sessionId);
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = sSnap.data() as any;
    if (s.chatEnabled === false) return res.status(403).json({ success: false, error: 'chat_disabled' });

    const text = String(req.body?.text || '').trim();
    if (!text) return res.status(400).json({ success: false, error: 'empty' });
    const mod = moderateMessage(text);
    if (!mod.allowed) return res.status(422).json({ success: false, error: mod.reason });

    const userId = optionalUser(req);
    const name = req.body?.name ? String(req.body.name).slice(0, 40) : currentName(req);
    const isOwner = !!userId && userId === s.ownerId;

    const fanStats = userId ? await getFanStats(s.artistId, userId) : null;
    const msg = clean({
      id: shortId('msg'),
      userId: userId || null,
      name,
      text: mod.cleaned,
      isOwner,
      pinned: false,
      badge: fanStats ? fanStats.level : null,
      fanPoints: fanStats ? fanStats.points : 0,
      createdAt: FieldValue.serverTimestamp(),
    });
    await sessionRef.collection('chat').doc(msg.id).set(msg);
    await sessionRef.set({ 'totals.chatMessages': FieldValue.increment(1) }, { merge: true });
    res.json({ success: true, message: serialize({ ...msg, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Pin / announce (owner)
router.post('/sessions/:id/announce', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const sessionRef = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    if ((sSnap.data() as any).ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const text = String(req.body?.text || '').trim().slice(0, 280);
    if (!text) return res.status(400).json({ success: false, error: 'empty' });
    const msg = {
      id: shortId('ann'), userId, name: (sSnap.data() as any).artistName || 'Artist',
      text, isOwner: true, pinned: true, type: 'announcement', createdAt: FieldValue.serverTimestamp(),
    };
    await sessionRef.collection('chat').doc(msg.id).set(msg);
    await sessionRef.set({ pinnedMessage: text }, { merge: true });
    res.json({ success: true, message: serialize({ ...msg, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  GIFTS — the core economy transaction
 * ===================================================================== */
router.get('/sessions/:id/gifts', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const snap = await db.collection(SESSIONS_COL).doc(sessionId).collection('gifts')
      .orderBy('createdAt', 'desc').limit(30).get();
    res.json({ success: true, gifts: snap.docs.map(docData).reverse() });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/sessions/:id/gift', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const giftDef = GIFT_MAP.get(String(req.body?.giftId));
    if (!giftDef) return res.status(400).json({ success: false, error: 'invalid_gift' });
    const quantity = Math.max(1, Math.min(99, Number(req.body?.quantity) || 1));
    const cost = giftDef.credits * quantity;

    const sessionRef = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = sSnap.data() as any;

    // Atomic credit deduction (anti-overdraft via transaction)
    const creditRef = db.collection(CREDITS_COL).doc(userId);
    const result = await db.runTransaction(async (tx) => {
      const cSnap = await tx.get(creditRef);
      const balance = cSnap.exists ? Number((cSnap.data() as any).balance || 0) : 0;
      if (balance < cost) return { ok: false as const, balance };
      tx.set(creditRef, {
        userId, balance: balance - cost,
        lifetimeSpent: FieldValue.increment(cost),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return { ok: true as const, balance: balance - cost };
    });

    if (!result.ok) {
      return res.status(402).json({ success: false, error: 'insufficient_credits', balance: result.balance });
    }

    // Economy split
    const artistCredits = Math.round(cost * ARTIST_SHARE);
    const platformCredits = Math.round(cost * PLATFORM_SHARE);
    const rewardCredits = cost - artistCredits - platformCredits;
    const rankValue = giftDef.rankValue * quantity;
    const name = req.body?.name ? String(req.body.name).slice(0, 40) : currentName(req);

    // Credit the artist wallet
    await db.collection(WALLETS_COL).doc(s.artistId).set({
      artistId: s.artistId,
      artistName: s.artistName,
      creditsBalance: FieldValue.increment(artistCredits),
      lifetimeCredits: FieldValue.increment(artistCredits),
      lifetimeUsd: FieldValue.increment(artistCredits * CREDIT_USD_VALUE),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Gift event (for animation + history)
    const giftEvent = clean({
      id: shortId('gift'),
      giftId: giftDef.id, name: giftDef.name, emoji: giftDef.emoji, animation: giftDef.animation,
      color: giftDef.color, tier: giftDef.tier, quantity, credits: cost, rankValue,
      senderId: userId, senderName: name,
      artistCredits, platformCredits, rewardCredits,
      createdAt: FieldValue.serverTimestamp(),
    });
    await sessionRef.collection('gifts').doc(giftEvent.id).set(giftEvent);

    // Ledger entries (append-only)
    await writeLedger({
      type: 'gift', artistId: s.artistId, sessionId: s.id, senderId: userId,
      giftId: giftDef.id, credits: cost, artistCredits, platformCredits, rewardCredits, quantity,
    });

    // Session totals
    await sessionRef.set({
      'totals.giftsCredits': FieldValue.increment(cost),
      'totals.giftsCount': FieldValue.increment(quantity),
      'totals.artistCredits': FieldValue.increment(artistCredits),
      'totals.platformCredits': FieldValue.increment(platformCredits),
      'totals.rewardCredits': FieldValue.increment(rewardCredits),
    }, { merge: true });

    // Fan ranking (global per artist + per session)
    await bumpFan(s.artistId, userId, name, { points: rankValue, creditsSpent: cost, gifts: quantity });
    await sessionRef.collection('fans').doc(userId).set({
      userId, name, points: FieldValue.increment(rankValue), creditsSpent: FieldValue.increment(cost),
      gifts: FieldValue.increment(quantity), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    res.json({
      success: true,
      gift: serialize({ ...giftEvent, createdAt: new Date().toISOString() }),
      balance: result.balance,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  SONG REQUESTS
 * ===================================================================== */
router.get('/sessions/:id/song-requests', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const snap = await db.collection(SESSIONS_COL).doc(String(req.params.id)).collection('requests')
      .orderBy('credits', 'desc').limit(50).get();
    res.json({ success: true, requests: snap.docs.map(docData) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/sessions/:id/song-request', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const sessionRef = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = sSnap.data() as any;
    const song = String(req.body?.song || '').trim().slice(0, 120);
    if (!song) return res.status(400).json({ success: false, error: 'empty' });
    const cost = Math.max(0, Number(s.songRequestPriceCredits) || 0);

    if (cost > 0) {
      const creditRef = db.collection(CREDITS_COL).doc(userId);
      const result = await db.runTransaction(async (tx) => {
        const cSnap = await tx.get(creditRef);
        const balance = cSnap.exists ? Number((cSnap.data() as any).balance || 0) : 0;
        if (balance < cost) return { ok: false as const, balance };
        tx.set(creditRef, { userId, balance: balance - cost, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return { ok: true as const, balance: balance - cost };
      });
      if (!result.ok) return res.status(402).json({ success: false, error: 'insufficient_credits', balance: result.balance });

      const artistCredits = Math.round(cost * ARTIST_SHARE);
      await db.collection(WALLETS_COL).doc(s.artistId).set({
        artistId: s.artistId, creditsBalance: FieldValue.increment(artistCredits),
        lifetimeCredits: FieldValue.increment(artistCredits), updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      await writeLedger({ type: 'song_request', artistId: s.artistId, sessionId: s.id, senderId: userId, credits: cost, artistCredits });
    }

    const name = req.body?.name ? String(req.body.name).slice(0, 40) : currentName(req);
    const reqDoc = clean({
      id: shortId('req'), userId, name, song, credits: cost,
      status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });
    await sessionRef.collection('requests').doc(reqDoc.id).set(reqDoc);
    await sessionRef.set({ 'totals.songRequests': FieldValue.increment(1) }, { merge: true });
    await bumpFan(s.artistId, userId, name, { points: Math.round(cost * 0.5), creditsSpent: cost });
    res.json({ success: true, request: serialize({ ...reqDoc, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.patch('/sessions/:id/song-requests/:reqId', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const sessionRef = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    if ((sSnap.data() as any).ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const status = ['pending', 'fulfilled', 'declined'].includes(req.body?.status) ? req.body.status : 'fulfilled';
    await sessionRef.collection('requests').doc(String(req.params.reqId)).set({ status, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  RANKING + ANALYTICS
 * ===================================================================== */
router.get('/sessions/:id/ranking', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const snap = await db.collection(SESSIONS_COL).doc(String(req.params.id)).collection('fans')
      .orderBy('points', 'desc').limit(20).get();
    res.json({ success: true, topFans: snap.docs.map(docData) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.get('/sessions/:id/analytics', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionRef = db.collection(SESSIONS_COL).doc(String(req.params.id));
    const sSnap = await sessionRef.get();
    if (!sSnap.exists) return res.status(404).json({ success: false, error: 'not_found' });
    const s = sSnap.data() as any;
    const metrics = metricsFromSession(s);
    const qualityScore = s.qualityScore || computeQualityScore(metrics);
    const stageRank = s.stageRank || computeStageRank(metrics, qualityScore);
    const fansSnap = await sessionRef.collection('fans').orderBy('points', 'desc').limit(10).get();
    const totals = s.totals || {};
    const grossUsd = (totals.giftsCredits || 0) * CREDIT_USD_VALUE;
    const artistUsd = (totals.artistCredits || 0) * CREDIT_USD_VALUE;

    res.json({
      success: true,
      analytics: {
        viewers: s.viewers || 0,
        peakViewers: totals.peakViewers || 0,
        avgViewers: totals.avgViewers || 0,
        uniqueViewers: totals.uniqueViewers || 0,
        watchSeconds: totals.watchSeconds || 0,
        chatMessages: totals.chatMessages || 0,
        giftsCount: totals.giftsCount || 0,
        giftsCredits: totals.giftsCredits || 0,
        songRequests: totals.songRequests || 0,
        newFollowers: totals.newFollowers || 0,
        grossUsd: Math.round(grossUsd * 100) / 100,
        artistUsd: Math.round(artistUsd * 100) / 100,
        artistCredits: totals.artistCredits || 0,
        qualityScore,
        stageRank,
        qualifiesForDiscovery: qualityScore >= 55,
        topFans: fansSnap.docs.map(docData),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  WALLET + CREDITS + PAYOUTS
 * ===================================================================== */
router.get('/wallet/:artistId', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const artistId = String(req.params.artistId);
    await ensureWallet(artistId);
    const wSnap = await db.collection(WALLETS_COL).doc(artistId).get();
    const wallet = wSnap.exists ? docData(wSnap) : { artistId, creditsBalance: 0, lifetimeUsd: 0 };
    const ledgerSnap = await db.collection(LEDGER_COL)
      .where('artistId', '==', artistId).orderBy('createdAt', 'desc').limit(40).get();
    const level = artistLevelForScore(((wallet as any).lifetimeCredits) || 0);
    res.json({
      success: true,
      wallet: { ...wallet, usdBalance: Math.round(((wallet as any).creditsBalance || 0) * CREDIT_USD_VALUE * 100) / 100, level },
      transactions: ledgerSnap.docs.map(docData),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Fan credit balance
router.get('/credits/balance', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const snap = await db.collection(CREDITS_COL).doc(userId).get();
    const balance = snap.exists ? Number((snap.data() as any).balance || 0) : 0;
    res.json({ success: true, balance, usd: Math.round(balance * CREDIT_USD_VALUE * 100) / 100 });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Buy credits via Stripe (returns checkout url). Falls back to dev grant when Stripe is absent.
router.post('/credits/checkout', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const pack = PACKAGE_MAP.get(String(req.body?.packageId));
    if (!pack) return res.status(400).json({ success: false, error: 'invalid_package' });
    const totalCredits = pack.credits + pack.bonus;

    if (!stripe) {
      // Dev / no-Stripe fallback: grant immediately so the flow is testable.
      await grantCredits(userId, totalCredits, 'dev_grant', pack.id);
      const snap = await db.collection(CREDITS_COL).doc(userId).get();
      return res.json({ success: true, devGranted: true, balance: Number((snap.data() as any)?.balance || 0) });
    }

    const base = getBaseUrl(req);
    const returnTo = String(req.body?.returnTo || '/');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `Boostify Live — ${pack.name} (${totalCredits} credits)` },
          unit_amount: pack.amount,
        },
        quantity: 1,
      }],
      success_url: `${base}${returnTo}${returnTo.includes('?') ? '&' : '?'}live_credits=success`,
      cancel_url: `${base}${returnTo}${returnTo.includes('?') ? '&' : '?'}live_credits=cancel`,
      metadata: { type: 'live_stage_credits', userId, packageId: pack.id, credits: String(totalCredits) },
    });
    await db.collection(PAYMENTS_COL).doc(session.id).set({
      id: session.id, userId, packageId: pack.id, credits: totalCredits,
      amount: pack.amount, status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });
    res.json({ success: true, checkoutUrl: session.url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

// Request payout (KYC gated)
router.post('/payouts', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const artistId = String(req.body?.artistId || userId);
    const wSnap = await db.collection(WALLETS_COL).doc(artistId).get();
    if (!wSnap.exists) return res.status(404).json({ success: false, error: 'no_wallet' });
    const wallet = wSnap.data() as any;
    if (wallet.ownerId && wallet.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    if (!wallet.kycVerified) return res.status(403).json({ success: false, error: 'kyc_required' });
    const credits = Math.max(0, Number(req.body?.credits) || 0);
    if (credits <= 0 || credits > (wallet.creditsBalance || 0)) {
      return res.status(400).json({ success: false, error: 'invalid_amount' });
    }
    const payout = {
      id: shortId('payout'), artistId, ownerId: userId, credits,
      usd: Math.round(credits * CREDIT_USD_VALUE * 100) / 100,
      status: 'requested', createdAt: FieldValue.serverTimestamp(),
    };
    await db.collection(PAYOUTS_COL).doc(payout.id).set(payout);
    await db.collection(WALLETS_COL).doc(artistId).set({ creditsBalance: FieldValue.increment(-credits), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    await writeLedger({ type: 'payout', artistId, senderId: userId, credits: -credits });
    res.json({ success: true, payout: serialize({ ...payout, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* =======================================================================
 *  STRIPE WEBHOOK — credits fan account on purchase
 * ===================================================================== */
router.post('/webhook', async (req: Request, res: Response) => {
  if (!stripe) return res.json({ received: true, skipped: 'no_stripe' });
  const sig = req.headers['stripe-signature'] as string;
  const secret = process.env.STRIPE_LIVE_STAGE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.json({ received: true, skipped: 'no_secret' });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, sig, secret);
  } catch (err: any) {
    return res.status(400).json({ received: false, error: `signature: ${err?.message}` });
  }

  try {
    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.metadata?.type === 'live_stage_credits') {
        const userId = session.metadata.userId;
        const credits = Number(session.metadata.credits || 0);
        if (userId && credits > 0 && db) {
          const payRef = db.collection(PAYMENTS_COL).doc(session.id);
          const already = await payRef.get();
          if (!already.exists || (already.data() as any).status !== 'completed') {
            await grantCredits(userId, credits, 'purchase', session.metadata.packageId);
            await payRef.set({ status: 'completed', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
          }
        }
      }
    }
  } catch (err: any) {
    console.error('[LiveStage] webhook error:', err?.message);
  }
  res.json({ received: true });
});

/* ============================== internals ============================== */
async function ensureWallet(artistId: string, artistName?: string, ownerId?: string) {
  const ref = db.collection(WALLETS_COL).doc(artistId);
  const snap = await ref.get();
  if (!snap.exists) {
    await ref.set(clean({
      artistId, artistName: artistName || null, ownerId: ownerId || null,
      creditsBalance: 0, lifetimeCredits: 0, lifetimeUsd: 0, kycVerified: false,
      createdAt: FieldValue.serverTimestamp(),
    }));
  } else if (artistName && !(snap.data() as any).artistName) {
    await ref.set({ artistName }, { merge: true });
  }
}

async function grantCredits(userId: string, credits: number, reason: string, packageId?: string) {
  await db.collection(CREDITS_COL).doc(userId).set({
    userId, balance: FieldValue.increment(credits),
    lifetimePurchased: FieldValue.increment(credits), updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  await writeLedger({ type: 'credit_purchase', senderId: userId, credits, packageId, reason } as any);
}

async function writeLedger(entry: Record<string, any>) {
  const id = shortId('tx');
  await db.collection(LEDGER_COL).doc(id).set(clean({ id, ...entry, createdAt: FieldValue.serverTimestamp() }));
}

async function getFanStats(artistId: string, userId: string): Promise<{ points: number; level: string } | null> {
  try {
    const snap = await db.collection(FANS_COL).doc(`${artistId}__${userId}`).get();
    if (!snap.exists) return { points: 0, level: FAN_LEVELS[0].name };
    const points = Number((snap.data() as any).points || 0);
    return { points, level: fanLevelForPoints(points).name };
  } catch {
    return null;
  }
}

async function bumpFan(
  artistId: string, userId: string, name: string,
  inc: { points?: number; creditsSpent?: number; gifts?: number },
) {
  const ref = db.collection(FANS_COL).doc(`${artistId}__${userId}`);
  await ref.set(clean({
    artistId, userId, name,
    points: FieldValue.increment(inc.points || 0),
    creditsSpent: FieldValue.increment(inc.creditsSpent || 0),
    gifts: FieldValue.increment(inc.gifts || 0),
    updatedAt: FieldValue.serverTimestamp(),
  }), { merge: true });
}

export default router;
