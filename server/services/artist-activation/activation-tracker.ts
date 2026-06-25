/**
 * Activation Tracker — Records events, updates scores, manages magic links
 * Core service that every other activation component uses.
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { db } from '../../db';
import { activationEvents, activationScores, dripSequences, musicIndustryContacts } from '../../db/schema';
import { eq, sql, and, gt, lt, isNull } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || 'boostify-activation-2026';
const PLATFORM_URL = process.env.BASE_URL || 'https://boostifymusic.com';

// ─── Score weights for signals ──────────────────────────────────

const SCORE_WEIGHTS: Record<string, number> = {
  email_sent: 0,
  email_delivered: 0,
  email_opened: 5,
  email_clicked: 10,
  email_bounced: -20,
  email_soft_bounce: -5,
  magic_link_generated: 0,
  magic_link_clicked: 15,
  account_created: 20,
  profile_completed: 10,
  song_uploaded: 15,
  landing_visited: 5,
  credits_used: 10,
  pricing_visited: 20,
  page_shared: 10,
  upgrade_offered: 0,
  upgrade_clicked: 15,
  upgrade_completed: 0, // score doesn't matter anymore, they converted
  referral_sent: 5,
  referral_converted: 10,
  claim_viewed: 8,
  profile_claimed: 30, // strongest signal: a real human took ownership of their pre-built profile
};

// ─── Segment thresholds ─────────────────────────────────────────

function getSegment(score: number, plan: string): string {
  if (plan !== 'none' && plan !== 'free') return 'converted';
  if (score >= 70) return 'hot';
  if (score >= 45) return 'engaged';
  if (score >= 20) return 'warming';
  return 'cold';
}

// ─── Track Event ─────────────────────────────────────────────────

export async function trackEvent(
  email: string,
  eventType: string,
  data: Record<string, any> = {},
  contactId?: number,
  userId?: number,
): Promise<void> {
  try {
    // Insert event
    await db.insert(activationEvents).values({
      email,
      eventType: eventType as any,
      eventData: data,
      contactId: contactId || null,
      userId: userId || null,
    });

    // Update score
    const weight = SCORE_WEIGHTS[eventType] || 0;
    if (weight !== 0) {
      await updateScore(email, eventType, weight, contactId, userId);
    }
  } catch (err) {
    console.error('[ActivationTracker] Track event error:', err);
  }
}

// ─── Update Score ────────────────────────────────────────────────

async function updateScore(
  email: string,
  signal: string,
  points: number,
  contactId?: number,
  userId?: number,
): Promise<void> {
  try {
    // Upsert score record
    const existing = await db.select().from(activationScores).where(eq(activationScores.email, email)).limit(1);

    if (existing.length > 0) {
      const record = existing[0];
      const signals = (record.signals || {}) as Record<string, number>;
      signals[signal] = (signals[signal] || 0) + 1;
      const newScore = Math.max(0, Math.min(100, record.score + points));
      const segment = getSegment(newScore, record.currentPlan || 'none');

      await db.update(activationScores)
        .set({
          score: newScore,
          signals,
          segment: segment as any,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
          ...(contactId ? { contactId } : {}),
          ...(userId ? { userId } : {}),
        })
        .where(eq(activationScores.email, email));
    } else {
      const newScore = Math.min(100, points);
      await db.insert(activationScores).values({
        email,
        score: newScore,
        segment: getSegment(newScore, 'none') as any,
        signals: { [signal]: 1 },
        currentPlan: 'none',
        contactId: contactId || null,
        userId: userId || null,
        lastActivityAt: new Date(),
      });
    }
  } catch (err) {
    console.error('[ActivationTracker] Update score error:', err);
  }
}

// ─── Magic Link Generator ────────────────────────────────────────

export interface MagicLinkPayload {
  contactId: number;
  email: string;
  name: string;
  genre?: string;
  country?: string;
  spotifyUrl?: string;
  instagramHandle?: string;
  soundcloudUrl?: string;
  /** Pre-built artist profile this link claims (Claim Loop). */
  slug?: string;
  userId?: number;
}

export function generateMagicLink(payload: MagicLinkPayload): string {
  const token = jwt.sign(
    {
      type: 'artist_activation',
      cid: payload.contactId,
      e: payload.email,
      n: payload.name,
      g: payload.genre,
      c: payload.country,
      sp: payload.spotifyUrl,
      ig: payload.instagramHandle,
      sc: payload.soundcloudUrl,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Store token in activation_scores for tracking
  db.insert(activationScores).values({
    email: payload.email,
    contactId: payload.contactId,
    magicLinkToken: token,
    magicLinkExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    score: 0,
    segment: 'cold' as any,
    signals: {},
    currentPlan: 'none',
  }).onConflictDoUpdate({
    target: activationScores.email,
    set: {
      magicLinkToken: token,
      magicLinkExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    },
  }).catch(() => {});

  return `${PLATFORM_URL}/activate?token=${token}`;
}

export function verifyMagicLink(token: string): MagicLinkPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'artist_activation') return null;
    return {
      contactId: decoded.cid,
      email: decoded.e,
      name: decoded.n,
      genre: decoded.g,
      country: decoded.c,
      spotifyUrl: decoded.sp,
      instagramHandle: decoded.ig,
      soundcloudUrl: decoded.sc,
      slug: decoded.s,
      userId: decoded.uid,
    };
  } catch {
    return null;
  }
}

/**
 * Claim Loop — mint a signed link that takes a pre-built profile's owner
 * straight to the claim page. Reuses the 'artist_activation' token type so
 * verifyMagicLink validates it. Stateless (JWT), so no per-row token column.
 */
export function generateClaimLink(payload: MagicLinkPayload): string {
  const token = jwt.sign(
    {
      type: 'artist_activation',
      cid: payload.contactId,
      e: payload.email,
      n: payload.name,
      g: payload.genre,
      c: payload.country,
      sp: payload.spotifyUrl,
      ig: payload.instagramHandle,
      sc: payload.soundcloudUrl,
      s: payload.slug,
      uid: payload.userId,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
  return `${PLATFORM_URL}/claim?token=${token}`;
}

// ─── Get Unsubscribe URL ─────────────────────────────────────────

export function getUnsubscribeUrl(email: string, contactId: number): string {
  const token = jwt.sign({ type: 'unsub', e: email, cid: contactId }, JWT_SECRET, { expiresIn: '365d' });
  return `${PLATFORM_URL}/api/artist-activation/unsubscribe?token=${token}`;
}

export function verifyUnsubscribeToken(token: string): { email: string; contactId: number } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    if (decoded.type !== 'unsub') return null;
    return { email: decoded.e, contactId: decoded.cid };
  } catch {
    return null;
  }
}

// ─── Score Queries ───────────────────────────────────────────────

export async function getScoreByEmail(email: string) {
  const rows = await db.select().from(activationScores).where(eq(activationScores.email, email)).limit(1);
  return rows[0] || null;
}

export async function getHotLeads(minScore = 60, limit = 100) {
  return db.select()
    .from(activationScores)
    .where(and(
      gt(activationScores.score, minScore),
      eq(activationScores.currentPlan as any, 'none'),
    ))
    .orderBy(sql`score DESC`)
    .limit(limit);
}

export async function getActivationStats() {
  const [totalResult, segmentResult, weekResult, convertedResult] = await Promise.all([
    db.execute(sql`SELECT count(*) as total FROM activation_scores`),
    db.execute(sql`SELECT segment, count(*) as cnt FROM activation_scores GROUP BY segment ORDER BY cnt DESC`),
    db.execute(sql`SELECT count(*) as cnt FROM activation_events WHERE created_at > NOW() - INTERVAL '7 days'`),
    db.execute(sql`SELECT count(*) as cnt FROM activation_scores WHERE current_plan != 'none' AND current_plan != 'free'`),
  ]);

  return {
    totalTracked: parseInt(totalResult.rows[0]?.total as string || '0'),
    bySegment: segmentResult.rows,
    eventsThisWeek: parseInt(weekResult.rows[0]?.cnt as string || '0'),
    paidConverted: parseInt(convertedResult.rows[0]?.cnt as string || '0'),
  };
}
