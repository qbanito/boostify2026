/**
 * AAS Daily Goals Service
 * 
 * Generates, tracks, and evaluates daily goals for each artist.
 * Goals cover: radio, labels, social network, blockchain, sponsors, venues, content, etc.
 * 
 * Goals are generated during the daily cycle based on:
 * - Priority mode (from survival strategist)
 * - Available contacts (radio, labels, sponsors, venues)
 * - Blockchain readiness (registered? songs to tokenize?)
 * - Social network activity
 * - Extension status (YouTube/Instagram)
 */

import { db } from '../../db';
import {
  aasDailyGoals,
  musicIndustryContacts,
  sponsorContacts,
  venueContacts,
  tokenizedSongs,
  songs,
  users,
} from '../../db/schema';
import { eq, and, sql, count, desc } from 'drizzle-orm';
import type { DailyGoal, PriorityMode, GoalCategory, DailyGoalStatus } from './types';
import { isBlockchainServiceAvailable } from '../btf2300-blockchain';

interface GoalContext {
  artistId: number;
  priorityMode: PriorityMode;
  survivalScore: number;
  radioContactsAvailable: number;
  labelContactsAvailable: number;
  sponsorContactsAvailable: number;
  venueContactsAvailable: number;
  songsCount: number;
  tokenizedSongsCount: number;
  isBlockchainReady: boolean;
  hasExtensions: boolean;
}

/**
 * Generate daily goals for an artist based on their current state
 */
export async function generateDailyGoals(
  artistId: number,
  priorityMode: PriorityMode,
  survivalScore: number,
  hasExtensions: boolean,
): Promise<DailyGoal[]> {
  const ctx = await buildGoalContext(artistId, priorityMode, survivalScore, hasExtensions);
  const goals: DailyGoal[] = [];

  // ── ALWAYS: Social network engagement ────────────────────
  goals.push({
    category: 'social_post',
    title: 'Post on Boostify social network',
    description: 'Create an engaging post on the Boostify social feed',
    targetCount: 1,
    agent: 'social-operator',
    channel: 'social',
    priority: 3,
  });

  goals.push({
    category: 'social_engage',
    title: 'Engage with 3 posts on social network',
    description: 'Like and comment on other artists\' posts',
    targetCount: 3,
    agent: 'social-operator',
    channel: 'social',
    priority: 4,
  });

  // ── Radio outreach (if contacts available) ───────────────
  if (ctx.radioContactsAvailable > 0) {
    const radioTarget = Math.min(ctx.radioContactsAvailable, priorityMode === 'radio_push' ? 5 : 2);
    goals.push({
      category: 'radio_outreach',
      title: `Contact ${radioTarget} radio station${radioTarget > 1 ? 's' : ''} for airplay`,
      description: `Send music submission to radio contacts from ${ctx.radioContactsAvailable} available`,
      targetCount: radioTarget,
      agent: 'deal-closer',
      channel: 'email',
      priority: priorityMode === 'radio_push' ? 1 : 3,
    });
  }

  // ── Label deals (if contacts available) ──────────────────
  if (ctx.labelContactsAvailable > 0) {
    const labelTarget = Math.min(ctx.labelContactsAvailable, priorityMode === 'close_deal' ? 3 : 1);
    goals.push({
      category: 'label_deal',
      title: `Pitch to ${labelTarget} record label${labelTarget > 1 ? 's' : ''}`,
      description: `Send label pitches from ${ctx.labelContactsAvailable} available label contacts`,
      targetCount: labelTarget,
      agent: 'deal-closer',
      channel: 'email',
      priority: priorityMode === 'close_deal' ? 1 : 2,
    });
  }

  // ── Sponsor outreach ─────────────────────────────────────
  if (ctx.sponsorContactsAvailable > 0 && (priorityMode === 'outreach' || priorityMode === 'sell')) {
    const sponsorTarget = Math.min(ctx.sponsorContactsAvailable, 3);
    goals.push({
      category: 'sponsor_outreach',
      title: `Send proposals to ${sponsorTarget} sponsor${sponsorTarget > 1 ? 's' : ''}`,
      description: 'Send branded partnership proposals',
      targetCount: sponsorTarget,
      agent: 'deal-closer',
      channel: 'email',
      priority: 2,
    });
  }

  // ── Venue booking ────────────────────────────────────────
  if (ctx.venueContactsAvailable > 0 && (priorityMode === 'outreach' || priorityMode === 'launch')) {
    const venueTarget = Math.min(ctx.venueContactsAvailable, 2);
    goals.push({
      category: 'venue_booking',
      title: `Book ${venueTarget} venue${venueTarget > 1 ? 's' : ''} for live shows`,
      description: 'Send booking requests to venues',
      targetCount: venueTarget,
      agent: 'deal-closer',
      channel: 'email',
      priority: 3,
    });
  }

  // ── Blockchain operations ────────────────────────────────
  if (ctx.isBlockchainReady) {
    // Register on-chain if not yet
    goals.push({
      category: 'blockchain_register',
      title: 'Register artist on Polygon blockchain',
      description: 'Create on-chain identity with BTF-2300 contract',
      targetCount: 1,
      agent: 'blockchain-operator',
      channel: 'blockchain',
      priority: priorityMode === 'blockchain_ops' ? 1 : 4,
    });

    // Tokenize songs
    if (ctx.songsCount > ctx.tokenizedSongsCount) {
      const tokTarget = Math.min(ctx.songsCount - ctx.tokenizedSongsCount, 2);
      goals.push({
        category: 'blockchain_tokenize',
        title: `Tokenize ${tokTarget} song${tokTarget > 1 ? 's' : ''} on Polygon`,
        description: 'Create song tokens for fans to purchase',
        targetCount: tokTarget,
        agent: 'blockchain-operator',
        channel: 'blockchain',
        priority: priorityMode === 'blockchain_ops' ? 1 : 4,
      });
    }
  }

  // ── Content creation ─────────────────────────────────────
  if (priorityMode === 'content_blitz' || priorityMode === 'content' || priorityMode === 'grow') {
    goals.push({
      category: 'content_create',
      title: 'Create AI-generated promotional content',
      description: 'Generate images and/or videos with FAL AI',
      targetCount: priorityMode === 'content_blitz' ? 3 : 1,
      agent: 'growth-operator',
      channel: ctx.hasExtensions ? 'instagram' : 'internal',
      priority: 1,
    });
  }

  // ── Fan engagement ───────────────────────────────────────
  goals.push({
    category: 'fan_engage',
    title: 'Engage with fans and community',
    description: 'Respond to comments, nurture superfans',
    targetCount: 1,
    agent: 'community-operator',
    channel: 'social',
    priority: 4,
  });

  // ── Mode-specific bonus goals ────────────────────────────
  switch (priorityMode) {
    case 'sell':
      goals.push({
        category: 'merch_launch',
        title: 'Push merch sale to fans',
        description: 'Create and promote merchandise',
        targetCount: 1,
        agent: 'revenue-operator',
        channel: 'email',
        priority: 1,
      });
      break;
    case 'launch':
      goals.push({
        category: 'music_release',
        title: 'Prepare new music release',
        description: 'Generate music and prepare launch assets',
        targetCount: 1,
        agent: 'growth-operator',
        channel: 'internal',
        priority: 1,
      });
      goals.push({
        category: 'email_campaign',
        title: 'Send launch announcement to fans',
        description: 'Email blast about new release',
        targetCount: 1,
        agent: 'community-operator',
        channel: 'email',
        priority: 1,
      });
      break;
    case 'radio_push':
      // Extra radio goal already added above
      goals.push({
        category: 'content_create',
        title: 'Create radio-ready promotional materials',
        description: 'Generate press kit and radio submission package',
        targetCount: 1,
        agent: 'growth-operator',
        channel: 'internal',
        priority: 2,
      });
      break;
    case 'blockchain_ops':
      goals.push({
        category: 'blockchain_trade',
        title: 'Promote token sales to fans',
        description: 'Post about token availability on social network',
        targetCount: 1,
        agent: 'social-operator',
        channel: 'social',
        priority: 2,
      });
      break;
  }

  return goals;
}

/**
 * Save generated goals to the database
 */
export async function saveDailyGoals(
  artistId: number,
  cycleDate: string,
  goals: DailyGoal[],
): Promise<number[]> {
  const ids: number[] = [];

  for (const goal of goals) {
    const [row] = await db.insert(aasDailyGoals).values({
      artistId,
      cycleDate,
      category: goal.category,
      title: goal.title,
      description: goal.description,
      targetCount: goal.targetCount,
      completedCount: 0,
      status: 'pending',
      agent: goal.agent,
      channel: goal.channel,
      priority: goal.priority,
    }).returning({ id: aasDailyGoals.id });

    ids.push(row.id);
  }

  return ids;
}

/**
 * Increment progress on a daily goal
 */
export async function updateGoalProgress(
  goalId: number,
  incrementBy: number = 1,
  result?: string,
  metadata?: Record<string, any>,
): Promise<void> {
  const [goal] = await db.select().from(aasDailyGoals).where(eq(aasDailyGoals.id, goalId));
  if (!goal) return;

  const newCompleted = Math.min((goal.completedCount || 0) + incrementBy, goal.targetCount);
  const isComplete = newCompleted >= goal.targetCount;

  await db.update(aasDailyGoals).set({
    completedCount: newCompleted,
    status: isComplete ? 'completed' : 'in_progress',
    result: result || goal.result,
    metadata: metadata ? { ...(goal.metadata as Record<string, any> || {}), ...metadata } : goal.metadata,
    startedAt: goal.startedAt || new Date(),
    completedAt: isComplete ? new Date() : undefined,
  }).where(eq(aasDailyGoals.id, goalId));
}

/**
 * Infer the goal category that a completed strategist action contributes to.
 *
 * The survival strategist emits free-form action strings (e.g. "Send sponsor
 * proposals", "Create album art"). Previously these were matched against a
 * hard-coded `action → category` map in the daily cycle, but the keys drifted
 * out of sync with the strategist's real action strings, so goal progress for
 * many successful actions silently never updated. This keyword-based classifier
 * is resilient to wording changes and keeps goal tracking working.
 *
 * Returns null when the action does not map to any trackable goal category
 * (e.g. internal audits, compliance checks, pipeline reviews).
 */
export function inferGoalCategory(action: string): GoalCategory | null {
  const a = (action || '').toLowerCase().trim();
  if (!a) return null;

  // ── Blockchain (most specific first) ──
  if (a.includes('tokenize')) return 'blockchain_tokenize';
  if (a.includes('register') && (a.includes('blockchain') || a.includes('chain') || a.includes('polygon'))) {
    return 'blockchain_register';
  }
  if (a.includes('token') && (a.includes('promote') || a.includes('sale') || a.includes('trade') || a.includes('sell'))) {
    return 'blockchain_trade';
  }

  // ── Industry outreach / deals ──
  if (a.includes('radio')) return 'radio_outreach';
  if (a.includes('sponsor')) return 'sponsor_outreach';
  if (a.includes('venue')) return 'venue_booking';
  if (a.includes('record label') || a.includes('to labels') || a.includes('to record') || a.includes('industry outreach')) {
    return 'label_deal';
  }

  // ── Merch ──
  if (a.includes('merch')) return 'merch_launch';

  // ── Music release ──
  if (a.includes('new music') || a.includes('music release') || a.includes('release new music')) {
    return 'music_release';
  }

  // ── Email campaigns / newsletters ──
  if (a.includes('newsletter') || a.includes('email blast') || a.includes('launch announcement') || a.includes('announcement to fans')) {
    return 'email_campaign';
  }

  // ── Content creation (AI-generated assets) ──
  if ((a.includes('create') || a.includes('generate') || a.includes('publish')) &&
      (a.includes('image') || a.includes('video') || a.includes('album art') || a.includes('content') ||
       a.includes('promo') || a.includes('media kit') || a.includes('press kit') || a.includes('materials') || a.includes('design'))) {
    return 'content_create';
  }

  // ── Community engagement vs. social engagement ──
  if (a.includes('engage')) {
    if (a.includes('community') || a.includes('fan') || a.includes('poll') || a.includes('superfan')) return 'fan_engage';
    if (a.includes('social') || a.includes('post')) return 'social_engage';
    return 'fan_engage';
  }

  // ── Social posting ──
  if (a.includes('post') && (a.includes('social') || a.includes('story'))) return 'social_post';
  if (a.includes('promote') && a.includes('release')) return 'social_post';

  // ── Superfan / community nurture ──
  if (a.includes('superfan') || a.includes('nurture') || a.includes('community')) return 'fan_engage';

  return null;
}

/**
 * Mark a goal as failed
 */
export async function failGoal(goalId: number, reason: string): Promise<void> {
  await db.update(aasDailyGoals).set({
    status: 'failed',
    result: reason,
    completedAt: new Date(),
  }).where(eq(aasDailyGoals.id, goalId));
}

/**
 * Get today's goals for an artist
 */
export async function getTodayGoals(artistId: number): Promise<DailyGoalStatus[]> {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(aasDailyGoals)
    .where(and(
      eq(aasDailyGoals.artistId, artistId),
      eq(aasDailyGoals.cycleDate, today),
    ))
    .orderBy(aasDailyGoals.priority);

  return rows.map(r => ({
    id: r.id,
    category: r.category as GoalCategory,
    title: r.title,
    description: r.description ?? undefined,
    targetCount: r.targetCount,
    completedCount: r.completedCount,
    status: r.status as DailyGoalStatus['status'],
    agent: r.agent ?? undefined,
    channel: r.channel ?? undefined,
    priority: r.priority ?? 3,
    result: r.result ?? undefined,
    metadata: r.metadata as Record<string, any> | undefined,
    startedAt: r.startedAt ?? undefined,
    completedAt: r.completedAt ?? undefined,
  }));
}

/**
 * Get goal summary stats for an artist on a given date
 */
export async function getGoalsSummary(artistId: number, date?: string): Promise<{
  total: number;
  completed: number;
  inProgress: number;
  failed: number;
  pending: number;
  completionRate: number;
  byCategory: Record<string, { total: number; completed: number }>;
}> {
  const targetDate = date || new Date().toISOString().slice(0, 10);
  const rows = await db.select().from(aasDailyGoals)
    .where(and(
      eq(aasDailyGoals.artistId, artistId),
      eq(aasDailyGoals.cycleDate, targetDate),
    ));

  const total = rows.length;
  const completed = rows.filter(r => r.status === 'completed').length;
  const inProgress = rows.filter(r => r.status === 'in_progress').length;
  const failed = rows.filter(r => r.status === 'failed').length;
  const pending = rows.filter(r => r.status === 'pending').length;

  const byCategory: Record<string, { total: number; completed: number }> = {};
  for (const r of rows) {
    if (!byCategory[r.category]) {
      byCategory[r.category] = { total: 0, completed: 0 };
    }
    byCategory[r.category].total++;
    if (r.status === 'completed') byCategory[r.category].completed++;
  }

  return {
    total,
    completed,
    inProgress,
    failed,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    byCategory,
  };
}

// ── Private helpers ───────────────────────────────────────

async function buildGoalContext(
  artistId: number,
  priorityMode: PriorityMode,
  survivalScore: number,
  hasExtensions: boolean,
): Promise<GoalContext> {
  // Count radio contacts
  const [radio] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(musicIndustryContacts)
    .where(and(
      eq(musicIndustryContacts.category, 'radio'),
      eq(musicIndustryContacts.status, 'new'),
    ));

  // Count label contacts
  const [labels] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(musicIndustryContacts)
    .where(and(
      eq(musicIndustryContacts.category, 'record_label'),
      eq(musicIndustryContacts.status, 'new'),
    ));

  // Count sponsors
  const [sponsors] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(sponsorContacts)
    .where(eq(sponsorContacts.status, 'new'));

  // Count venues
  const [venues] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(venueContacts)
    .where(eq(venueContacts.status, 'new'));

  // Count songs
  const [songsCount] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(songs)
    .where(eq(songs.userId, artistId));

  // Count tokenized songs
  const [tokenized] = await db.select({ c: sql<number>`COUNT(*)` })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.artistId, artistId));

  return {
    artistId,
    priorityMode,
    survivalScore,
    radioContactsAvailable: radio?.c || 0,
    labelContactsAvailable: labels?.c || 0,
    sponsorContactsAvailable: sponsors?.c || 0,
    venueContactsAvailable: venues?.c || 0,
    songsCount: songsCount?.c || 0,
    tokenizedSongsCount: tokenized?.c || 0,
    isBlockchainReady: isBlockchainServiceAvailable(),
    hasExtensions,
  };
}
