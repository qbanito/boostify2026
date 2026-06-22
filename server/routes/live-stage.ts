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
import { pool } from '../db';

const router = Router();

/* ----------------------------- collections ----------------------------- */
const SESSIONS_COL = 'live_stage_sessions';
const WALLETS_COL = 'live_stage_wallets';
const CREDITS_COL = 'live_stage_credits';
const LEDGER_COL = 'live_stage_transactions';
const FANS_COL = 'live_stage_fans';
const PAYOUTS_COL = 'live_stage_payouts';
const PAYMENTS_COL = 'live_stage_payments';
const EVENTS_COL = 'live_stage_events';
const TICKETS_COL = 'live_stage_event_tickets';

/* ------------------------------ economy -------------------------------- */
/** 1 credit = $0.01  →  100 credits = $1.00 */
export const CREDIT_USD_VALUE = 0.01;
const ARTIST_SHARE = 0.75;
const PLATFORM_SHARE = 0.20;
const REWARD_SHARE = 0.05; // remainder, burn / treasury / reward pool

/* ---------------------- paid live events economy ----------------------- */
/** Ticketed live events (courses, podcasts, masterclasses): 70% creator / 30% platform. */
const EVENT_CREATOR_SHARE = 0.70;
const EVENT_PLATFORM_SHARE = 0.30;

export const EVENT_TYPES = [
  { id: 'live_course', name: 'Live Course', emoji: '🎓', desc: 'Teach a class live, lesson by lesson' },
  { id: 'live_podcast', name: 'Live Podcast', emoji: '🎙️', desc: 'Host a live show with your audience' },
  { id: 'masterclass', name: 'Masterclass', emoji: '✨', desc: 'A premium deep-dive session' },
  { id: 'workshop', name: 'Workshop', emoji: '🛠️', desc: 'Hands-on, interactive session' },
  { id: 'qa', name: 'Live Q&A', emoji: '💬', desc: 'Answer your community live' },
  { id: 'performance', name: 'Exclusive Performance', emoji: '🎤', desc: 'A ticketed live show' },
] as const;
const EVENT_TYPE_IDS = new Set(EVENT_TYPES.map((t) => t.id));

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
      } else if (session.metadata?.type === 'live_stage_event_ticket') {
        const ticketId = session.metadata.ticketId;
        if (ticketId && db) {
          await settleEventTicket(ticketId);
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

/**
 * Settle a paid event ticket (idempotent): mark it paid, bump the event's
 * sales counters and pay the creator their 70% share into the artist wallet
 * (in credits, so the existing KYC payout flow handles cash-out). 30% stays
 * with the platform.
 */
async function settleEventTicket(ticketId: string): Promise<boolean> {
  const ticketRef = db.collection(TICKETS_COL).doc(ticketId);
  const snap = await ticketRef.get();
  if (!snap.exists) return false;
  const t = snap.data() as any;
  if (t.status === 'paid') return true; // already settled

  const creatorUsd = Number(t.creatorShareUsd || 0);
  const creatorCredits = Math.round(creatorUsd * 100); // 1 credit = $0.01

  await ticketRef.set({ status: 'paid', paidAt: FieldValue.serverTimestamp() }, { merge: true });

  // event sales counters
  if (t.eventId) {
    await db.collection(EVENTS_COL).doc(String(t.eventId)).set({
      soldCount: FieldValue.increment(1),
      revenueUsd: FieldValue.increment(Number(t.amountUsd || 0)),
      creatorEarnedUsd: FieldValue.increment(creatorUsd),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // pay the creator
  if (t.artistId && creatorCredits > 0) {
    await ensureWallet(String(t.artistId), t.artistName, t.ownerId);
    await db.collection(WALLETS_COL).doc(String(t.artistId)).set({
      creditsBalance: FieldValue.increment(creatorCredits),
      lifetimeCredits: FieldValue.increment(creatorCredits),
      lifetimeUsd: FieldValue.increment(creatorUsd),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    await writeLedger({
      type: 'event_sale', artistId: String(t.artistId), eventId: t.eventId,
      senderId: t.buyerId, credits: creatorCredits, usd: creatorUsd,
      platformUsd: Number(t.platformShareUsd || 0), reason: 'event_ticket',
    });
  }
  return true;
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

/* =======================================================================
 *  WEBRTC SIGNALING  (real broadcaster → viewer video)
 *  One-to-many mesh negotiated over HTTP/Firestore polling. The owner is
 *  the broadcaster (publishes their camera tracks); each viewer opens a
 *  recv-only RTCPeerConnection. The viewer creates the OFFER, the owner
 *  answers per viewer. ICE candidates are relayed through the peer doc.
 *  Subcollection: live_stage_sessions/{id}/rtc_peers/{viewerId}
 * ===================================================================== */

/** ICE servers (STUN always; TURN if configured) so NAT traversal works. */
router.get('/rtc/ice-servers', (_req: Request, res: Response) => {
  const iceServers: any[] = [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ];
  const turnUrl = process.env.LIVE_STAGE_TURN_URL || process.env.TURN_URL;
  if (turnUrl) {
    iceServers.push(clean({
      urls: turnUrl.split(',').map((u) => u.trim()).filter(Boolean),
      username: process.env.LIVE_STAGE_TURN_USERNAME || process.env.TURN_USERNAME || undefined,
      credential: process.env.LIVE_STAGE_TURN_CREDENTIAL || process.env.TURN_CREDENTIAL || undefined,
    }));
  }
  res.json({ success: true, iceServers });
});

async function loadLiveSession(res: Response, sessionId: string) {
  const ref = db.collection(SESSIONS_COL).doc(sessionId);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ success: false, error: 'not_found' }); return null; }
  return { ref, data: snap.data() as any };
}

/** Viewer publishes its SDP offer (creates/refreshes its peer slot). */
router.post('/sessions/:id/rtc/offer', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const loaded = await loadLiveSession(res, sessionId);
    if (!loaded) return;
    if (loaded.data.status !== 'live') return res.status(409).json({ success: false, error: 'not_live' });

    const viewerId = String(req.body?.viewerId || '').slice(0, 80);
    const sdp = req.body?.sdp;
    if (!viewerId || !sdp || typeof sdp !== 'object') return res.status(400).json({ success: false, error: 'invalid' });

    await loaded.ref.collection('rtc_peers').doc(viewerId).set({
      viewerId,
      offer: sdp,
      answer: null,
      ownerCandidates: [],
      viewerCandidates: [],
      status: 'pending',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: false });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Viewer polls its peer slot for the owner's answer + owner ICE candidates. */
router.get('/sessions/:id/rtc/peer', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const viewerId = String(req.query.viewerId || '').slice(0, 80);
    if (!viewerId) return res.status(400).json({ success: false, error: 'viewerId required' });
    const snap = await db.collection(SESSIONS_COL).doc(sessionId).collection('rtc_peers').doc(viewerId).get();
    if (!snap.exists) return res.json({ success: true, status: 'gone', answer: null, ownerCandidates: [] });
    const p = snap.data() as any;
    res.json({ success: true, status: p.status || 'pending', answer: p.answer || null, ownerCandidates: p.ownerCandidates || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Owner polls for viewer peers (offers to answer + their ICE candidates). */
router.get('/sessions/:id/rtc/peers', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res); if (!userId) return;
    const sessionId = String(req.params.id);
    const loaded = await loadLiveSession(res, sessionId);
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const snap = await loaded.ref.collection('rtc_peers').orderBy('createdAt', 'desc').limit(40).get();
    const peers = snap.docs.map((d) => {
      const p = d.data() as any;
      return { viewerId: p.viewerId, offer: p.offer || null, status: p.status || 'pending', viewerCandidates: p.viewerCandidates || [] };
    });
    res.json({ success: true, peers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Owner posts its SDP answer for a specific viewer. */
router.post('/sessions/:id/rtc/answer', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const userId = currentUser(req, res); if (!userId) return;
    const sessionId = String(req.params.id);
    const loaded = await loadLiveSession(res, sessionId);
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const viewerId = String(req.body?.viewerId || '').slice(0, 80);
    const sdp = req.body?.sdp;
    if (!viewerId || !sdp) return res.status(400).json({ success: false, error: 'invalid' });
    const peerRef = loaded.ref.collection('rtc_peers').doc(viewerId);
    if (!(await peerRef.get()).exists) return res.status(404).json({ success: false, error: 'peer_gone' });
    await peerRef.set({ answer: sdp, status: 'answered', updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Both sides trickle ICE candidates into the peer slot. role = owner|viewer. */
router.post('/sessions/:id/rtc/candidate', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const viewerId = String(req.body?.viewerId || '').slice(0, 80);
    const role = req.body?.role === 'owner' ? 'owner' : 'viewer';
    const candidate = req.body?.candidate;
    if (!viewerId || !candidate) return res.status(400).json({ success: false, error: 'invalid' });
    const peerRef = db.collection(SESSIONS_COL).doc(sessionId).collection('rtc_peers').doc(viewerId);
    if (!(await peerRef.get()).exists) return res.json({ success: true, dropped: true });
    const field = role === 'owner' ? 'ownerCandidates' : 'viewerCandidates';
    await peerRef.set({ [field]: FieldValue.arrayUnion(candidate), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Viewer leaves → drop its peer slot so the owner stops sending to it. */
router.post('/sessions/:id/rtc/leave', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const sessionId = String(req.params.id);
    const viewerId = String(req.body?.viewerId || '').slice(0, 80);
    if (viewerId) await db.collection(SESSIONS_COL).doc(sessionId).collection('rtc_peers').doc(viewerId).delete().catch(() => {});
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* ====================================================================== */
/*  PAID LIVE EVENTS — sell live courses, podcasts, masterclasses          */
/*  Creators publish a ticketed event, share a promo link and sell it on   */
/*  the platform. Revenue splits 70% creator / 30% Boostify via Stripe.    */
/*  Ticket holders get a private messaging/Q&A room for the event.         */
/* ====================================================================== */

function eventTicketId(eventId: string, userId: string): string {
  return `${eventId}__${userId}`;
}

async function loadEvent(res: Response, eventId: string): Promise<{ ref: FirebaseFirestore.DocumentReference; data: any } | null> {
  const ref = db.collection(EVENTS_COL).doc(eventId);
  const snap = await ref.get();
  if (!snap.exists) { res.status(404).json({ success: false, error: 'event_not_found' }); return null; }
  return { ref, data: { id: snap.id, ...(snap.data() as any) } };
}

async function hasPaidTicket(eventId: string, userId: string): Promise<boolean> {
  try {
    const snap = await db.collection(TICKETS_COL).doc(eventTicketId(eventId, userId)).get();
    return snap.exists && (snap.data() as any).status === 'paid';
  } catch { return false; }
}

/** Public catalog of event formats a creator can launch. */
router.get('/events/types', (_req: Request, res: Response) => {
  res.json({ success: true, types: EVENT_TYPES, creatorShare: EVENT_CREATOR_SHARE, platformShare: EVENT_PLATFORM_SHARE });
});

/** Create a paid live event (draft). */
router.post('/events', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const b = req.body || {};
    const title = String(b.title || '').trim().slice(0, 140);
    const type = String(b.type || '');
    if (!title) return res.status(400).json({ success: false, error: 'title_required' });
    if (!EVENT_TYPE_IDS.has(type as any)) return res.status(400).json({ success: false, error: 'invalid_type' });
    const priceUsd = Math.max(0, Math.min(100000, Number(b.priceUsd) || 0));
    const id = shortId('evt');
    const shareSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'event'}-${Math.random().toString(36).slice(2, 7)}`;
    const doc = clean({
      id, ownerId: userId, artistId: String(b.artistId || userId),
      artistName: b.artistName ? String(b.artistName).slice(0, 120) : currentName(req),
      title, type, description: b.description ? String(b.description).slice(0, 4000) : null,
      coverImage: b.coverImage ? String(b.coverImage).slice(0, 1000) : null,
      priceUsd, currency: 'usd',
      scheduledAt: b.scheduledAt ? new Date(b.scheduledAt) : null,
      durationMinutes: b.durationMinutes ? Math.max(0, Math.min(1440, Number(b.durationMinutes))) : null,
      maxSeats: b.maxSeats ? Math.max(0, Math.min(100000, Number(b.maxSeats))) : null,
      soldCount: 0, revenueUsd: 0, creatorEarnedUsd: 0,
      status: 'draft', shareSlug, sessionId: null,
      createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
    });
    await db.collection(EVENTS_COL).doc(id).set(doc);
    res.json({ success: true, event: serialize({ ...doc, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** A creator's own events (any status). */
router.get('/events/mine', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const snap = await db.collection(EVENTS_COL).where('ownerId', '==', userId).limit(100).get();
    const events = snap.docs.map(docData).sort((a: any, b: any) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    res.json({ success: true, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Public list of an artist's published / live events (for promo + marketplace). */
router.get('/artist/:artistId/events', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const artistId = String(req.params.artistId);
    const snap = await db.collection(EVENTS_COL).where('artistId', '==', artistId).limit(100).get();
    const events = snap.docs.map(docData)
      .filter((e: any) => ['published', 'live'].includes(e.status))
      .sort((a: any, b: any) => String(a.scheduledAt || a.createdAt || '').localeCompare(String(b.scheduledAt || b.createdAt || '')));
    res.json({ success: true, events });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Resolve a promo link slug → event id. */
router.get('/events/slug/:slug', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const snap = await db.collection(EVENTS_COL).where('shareSlug', '==', String(req.params.slug)).limit(1).get();
    if (snap.empty) return res.status(404).json({ success: false, error: 'event_not_found' });
    res.json({ success: true, event: docData(snap.docs[0]) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Event detail (public). Adds the caller's ticket + ownership when authed. */
router.get('/events/:id', async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    const me = optionalUser(req);
    let myTicket: any = null; let isOwner = false;
    if (me) {
      isOwner = loaded.data.ownerId === me;
      const tSnap = await db.collection(TICKETS_COL).doc(eventTicketId(loaded.data.id, me)).get();
      if (tSnap.exists) myTicket = docData(tSnap);
    }
    res.json({ success: true, event: serialize(loaded.data), myTicket, isOwner, hasAccess: isOwner || myTicket?.status === 'paid' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Update / publish / cancel an event (owner only). */
router.patch('/events/:id', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const b = req.body || {};
    const patch: Record<string, any> = { updatedAt: FieldValue.serverTimestamp() };
    if (b.title !== undefined) patch.title = String(b.title).trim().slice(0, 140);
    if (b.description !== undefined) patch.description = b.description ? String(b.description).slice(0, 4000) : null;
    if (b.coverImage !== undefined) patch.coverImage = b.coverImage ? String(b.coverImage).slice(0, 1000) : null;
    if (b.type !== undefined && EVENT_TYPE_IDS.has(String(b.type) as any)) patch.type = String(b.type);
    if (b.priceUsd !== undefined) patch.priceUsd = Math.max(0, Math.min(100000, Number(b.priceUsd) || 0));
    if (b.scheduledAt !== undefined) patch.scheduledAt = b.scheduledAt ? new Date(b.scheduledAt) : null;
    if (b.durationMinutes !== undefined) patch.durationMinutes = b.durationMinutes ? Math.max(0, Math.min(1440, Number(b.durationMinutes))) : null;
    if (b.maxSeats !== undefined) patch.maxSeats = b.maxSeats ? Math.max(0, Math.min(100000, Number(b.maxSeats))) : null;
    if (b.status !== undefined && ['draft', 'published', 'cancelled'].includes(String(b.status))) patch.status = String(b.status);
    await loaded.ref.set(patch, { merge: true });
    const after = await loaded.ref.get();
    res.json({ success: true, event: docData(after) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Buy a ticket. Free → instant; no Stripe → dev grant; else Stripe checkout. */
router.post('/events/:id/checkout', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    const ev = loaded.data;
    if (ev.ownerId === userId) return res.status(400).json({ success: false, error: 'cannot_buy_own_event' });
    if (!['published', 'live'].includes(ev.status)) return res.status(409).json({ success: false, error: 'not_on_sale' });
    if (ev.maxSeats && Number(ev.soldCount || 0) >= Number(ev.maxSeats)) return res.status(409).json({ success: false, error: 'sold_out' });

    const ticketId = eventTicketId(ev.id, userId);
    const ticketRef = db.collection(TICKETS_COL).doc(ticketId);
    const existing = await ticketRef.get();
    if (existing.exists && (existing.data() as any).status === 'paid') {
      return res.json({ success: true, alreadyPurchased: true, ticket: docData(existing) });
    }

    const amountUsd = Math.max(0, Number(ev.priceUsd) || 0);
    const creatorShareUsd = Math.round(amountUsd * EVENT_CREATOR_SHARE * 100) / 100;
    const platformShareUsd = Math.round((amountUsd - creatorShareUsd) * 100) / 100;
    const baseTicket = clean({
      id: ticketId, eventId: ev.id, ownerId: ev.ownerId, artistId: ev.artistId, artistName: ev.artistName,
      eventTitle: ev.title, buyerId: userId, buyerName: currentName(req),
      amountUsd, creatorShareUsd, platformShareUsd, currency: 'usd',
      status: 'pending', createdAt: FieldValue.serverTimestamp(),
    });

    // Free event → instant access.
    if (amountUsd <= 0) {
      await ticketRef.set({ ...baseTicket, status: 'pending' });
      await settleEventTicket(ticketId);
      const t = await ticketRef.get();
      return res.json({ success: true, free: true, ticket: docData(t) });
    }

    // No Stripe configured → dev grant so the flow is testable end-to-end.
    if (!stripe) {
      await ticketRef.set({ ...baseTicket, status: 'pending' });
      await settleEventTicket(ticketId);
      const t = await ticketRef.get();
      return res.json({ success: true, devGranted: true, ticket: docData(t) });
    }

    const base = getBaseUrl(req);
    const returnTo = String(req.body?.returnTo || '/');
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${ev.title} — ${ev.artistName || 'Live event'}` },
          unit_amount: Math.round(amountUsd * 100),
        },
        quantity: 1,
      }],
      success_url: `${base}${returnTo}${returnTo.includes('?') ? '&' : '?'}live_event=success`,
      cancel_url: `${base}${returnTo}${returnTo.includes('?') ? '&' : '?'}live_event=cancel`,
      metadata: { type: 'live_stage_event_ticket', ticketId, eventId: ev.id, buyerId: userId },
    });
    await ticketRef.set({ ...baseTicket, stripeSessionId: session.id }, { merge: true });
    res.json({ success: true, checkoutUrl: session.url });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Current user's ticket for an event. */
router.get('/events/:id/ticket', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const snap = await db.collection(TICKETS_COL).doc(eventTicketId(String(req.params.id), userId)).get();
    res.json({ success: true, ticket: snap.exists ? docData(snap) : null });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Creator: list buyers of an event. */
router.get('/events/:id/attendees', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    const snap = await db.collection(TICKETS_COL).where('eventId', '==', loaded.data.id).where('status', '==', 'paid').limit(500).get();
    res.json({ success: true, attendees: snap.docs.map(docData), count: snap.size });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Owner goes live → mark the event live (optionally link a live session). */
router.post('/events/:id/start', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    await loaded.ref.set({
      status: 'live', startedAt: FieldValue.serverTimestamp(),
      sessionId: req.body?.sessionId ? String(req.body.sessionId) : loaded.data.sessionId || null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    const after = await loaded.ref.get();
    res.json({ success: true, event: docData(after) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Owner ends the event. */
router.post('/events/:id/end', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    if (loaded.data.ownerId !== userId) return res.status(403).json({ success: false, error: 'forbidden' });
    await loaded.ref.set({ status: 'ended', endedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const after = await loaded.ref.get();
    res.json({ success: true, event: docData(after) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/** Private event messaging / Q&A — owner + paid ticket holders only. */
router.get('/events/:id/messages', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    const allowed = loaded.data.ownerId === userId || await hasPaidTicket(loaded.data.id, userId);
    if (!allowed) return res.status(403).json({ success: false, error: 'ticket_required' });
    const snap = await loaded.ref.collection('messages').orderBy('createdAt', 'desc').limit(80).get();
    const messages = snap.docs.map(docData).reverse();
    res.json({ success: true, messages });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

router.post('/events/:id/messages', isAuthenticated, async (req: Request, res: Response) => {
  if (!requireDb(res)) return;
  const userId = currentUser(req, res);
  if (!userId) return;
  try {
    const loaded = await loadEvent(res, String(req.params.id));
    if (!loaded) return;
    const isOwner = loaded.data.ownerId === userId;
    const allowed = isOwner || await hasPaidTicket(loaded.data.id, userId);
    if (!allowed) return res.status(403).json({ success: false, error: 'ticket_required' });
    const mod = moderateMessage(String(req.body?.text || ''));
    if (!mod.allowed) return res.status(400).json({ success: false, error: 'message_blocked' });
    const id = shortId('msg');
    const msg = clean({
      id, userId, name: currentName(req), text: mod.cleaned,
      isOwner, createdAt: FieldValue.serverTimestamp(),
    });
    await loaded.ref.collection('messages').doc(id).set(msg);
    res.json({ success: true, message: serialize({ ...msg, createdAt: new Date().toISOString() }) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message });
  }
});

/* ====================================================================== */
/*  MARKETPLACE — public sales feed for the viewer session                */
/*  An interactive shop the (even logged-out) viewer sees on the stage:    */
/*  the artist's store, merch, courses and music, each with an affiliate   */
/*  commission so any fan can promote it and earn (links to /affiliates).  */
/* ====================================================================== */

/** Affiliate commission rates per item kind (integer percent, mirrors /api/affiliate). */
const MARKETPLACE_COMMISSIONS: Record<string, number> = {
  store: 15, merch: 20, course: 25, music: 15, service: 20,
};

function marketplaceArtistPk(raw: string | number): number | null {
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

router.get('/:artistId/marketplace', async (req: Request, res: Response) => {
  const empty = { success: true, artistName: null as string | null, artistSlug: null as string | null, storeUrl: null as string | null, affiliateJoinUrl: '/affiliates', items: [] as any[] };
  try {
    const pk = marketplaceArtistPk(req.params.artistId);
    if (!pk) return res.json(empty);

    // Artist identity → links.
    let artistName: string | null = null;
    let handle = '';
    try {
      const { rows } = await pool.query(
        'SELECT artist_name, username, slug FROM users WHERE id = $1 LIMIT 1', [pk],
      );
      const u: any = rows[0] || {};
      artistName = u.artist_name || u.username || null;
      handle = String(u.slug || u.username || '').trim();
    } catch { /* ignore */ }

    const base = handle ? `/artist/${handle}` : null;
    const storeUrl = base ? `${base}/store` : null;
    const items: any[] = [];

    // Featured: the full official store.
    if (storeUrl) {
      items.push({
        kind: 'store', id: 'store', title: `${artistName || 'Official'} Store`,
        subtitle: 'Browse the full collection', price: null, priceLabel: null,
        image: null, link: storeUrl, badge: 'Official Store', featured: true,
        commissionPct: MARKETPLACE_COMMISSIONS.store, affiliate: true,
      });
    }

    // Merch (available).
    try {
      const { rows } = await pool.query(
        `SELECT id, name, price, images FROM merchandise
         WHERE user_id = $1 AND is_available = true
         ORDER BY created_at DESC LIMIT 24`, [pk],
      );
      for (const r of rows as any[]) {
        const img = Array.isArray(r.images) ? r.images[0] : (typeof r.images === 'string' ? r.images : null);
        const priceNum = r.price != null ? Number(r.price) : null;
        items.push({
          kind: 'merch', id: String(r.id), title: r.name, subtitle: 'Official merch',
          price: priceNum, priceLabel: priceNum != null ? `$${priceNum.toFixed(2)}` : null,
          image: img || null, link: storeUrl || (base ? `${base}#merchandise` : null),
          badge: 'Merch', commissionPct: MARKETPLACE_COMMISSIONS.merch, affiliate: true,
        });
      }
    } catch { /* ignore */ }

    // Courses (published, taught by this artist).
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.title, c.price, c.thumbnail, c.category, c.level
         FROM courses c JOIN course_instructors ci ON ci.id = c.instructor_id
         WHERE ci.user_id = $1 AND c.status = 'published'
         ORDER BY c.created_at DESC LIMIT 12`, [pk],
      );
      for (const r of rows as any[]) {
        const priceNum = r.price != null ? Number(r.price) : null;
        items.push({
          kind: 'course', id: String(r.id), title: r.title,
          subtitle: [r.category, r.level].filter(Boolean).join(' · ') || 'Online course',
          price: priceNum, priceLabel: priceNum != null && priceNum > 0 ? `$${priceNum.toFixed(2)}` : 'Free',
          image: r.thumbnail || null, link: `/course/${r.id}`,
          badge: 'Course', commissionPct: MARKETPLACE_COMMISSIONS.course, affiliate: true,
        });
      }
    } catch { /* ignore */ }

    // Music (published songs — streamable products).
    try {
      const { rows } = await pool.query(
        `SELECT id, title, genre, cover_art FROM songs
         WHERE user_id = $1 AND is_published = true
         ORDER BY created_at DESC LIMIT 16`, [pk],
      );
      for (const r of rows as any[]) {
        items.push({
          kind: 'music', id: String(r.id), title: r.title, subtitle: r.genre || 'Single',
          price: null, priceLabel: 'Stream', image: r.cover_art || null,
          link: base ? `${base}#songs` : null,
          badge: 'Music', commissionPct: MARKETPLACE_COMMISSIONS.music, affiliate: true,
        });
      }
    } catch { /* ignore */ }

    res.json({ success: true, artistName, artistSlug: handle || null, storeUrl, affiliateJoinUrl: '/affiliates', items });
  } catch (err: any) {
    res.json({ ...empty, error: err?.message });
  }
});

export default router;
