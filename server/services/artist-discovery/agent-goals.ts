/**
 * Agent Goals Engine — Autonomous goal-setting, tracking, and self-evaluation
 * 
 * The agent:
 * 1. Creates weekly KPI targets (auto-adjusts based on past performance)
 * 2. Tracks progress in real-time via DB queries
 * 3. Self-evaluates at week's end with GPT reflection
 * 4. Recommends strategy adjustments (source allocation, sequence focus)
 * 5. Tracks Source ROI to optimize discovery channel allocation
 */

import { createTrackedOpenAI } from '../../utils/tracked-openai';
import { db } from '../../db';
import { agentGoals, sourceRoi, agentDecisions, musicIndustryContacts, activationScores, activationEvents, dripSequences, discoveryRuns } from '../../../db/schema';
import { eq, sql, and, gte, lte, desc } from 'drizzle-orm';

const openai = createTrackedOpenAI();
const MODEL = 'gpt-4o-mini';

// ─── Types ───────────────────────────────────────────────────────

export interface WeeklyGoal {
  id: number;
  weekStart: Date;
  weekEnd: Date;
  status: string;
  targets: GoalKPIs;
  actuals: GoalKPIs;
  performanceScore: number | null;
  aiReflection: string | null;
  aiStrategyNext: string | null;
  sourceAllocation: Record<string, number> | null;
}

export interface GoalKPIs {
  leadsDiscovered: number;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  hotLeads: number;
}

export interface SourceROIData {
  source: string;
  weekStart: Date;
  leadsDiscovered: number;
  leadsEmailed: number;
  emailsOpened: number;
  emailsClicked: number;
  conversions: number;
  avgScore: number;
  roiScore: number | null;
}

export interface GoalsDashboard {
  currentGoal: WeeklyGoal | null;
  recentGoals: WeeklyGoal[];
  sourceROI: SourceROIData[];
  overallPerformance: number; // avg of last 4 weeks
  trend: 'improving' | 'stable' | 'declining';
}

// ─── Week Helpers ────────────────────────────────────────────────

function getWeekBounds(date: Date = new Date()): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

// ─── Initialize Weekly Goals ─────────────────────────────────────

/**
 * Creates goals for the current week if they don't exist.
 * Auto-adjusts targets based on last week's actuals + a 10% growth factor.
 */
export async function initializeWeeklyGoals(): Promise<WeeklyGoal | null> {
  try {
    const { start, end } = getWeekBounds();

    // Check if goals already exist for this week
    const existing = await db.select().from(agentGoals)
      .where(eq(agentGoals.weekStart, start))
      .limit(1);

    if (existing.length > 0) {
      return mapGoalRow(existing[0]);
    }

    // Get last week's goals for growth-based targets
    const lastWeek = getWeekBounds(new Date(start.getTime() - 7 * 24 * 60 * 60 * 1000));
    const prevGoals = await db.select().from(agentGoals)
      .where(eq(agentGoals.weekStart, lastWeek.start))
      .limit(1);

    // Auto-calculate targets: last week's actuals * 1.1 (10% growth), or defaults
    const prev = prevGoals[0];
    const growthFactor = 1.10;

    const targets = {
      leadsDiscovered: prev?.actualLeadsDiscovered
        ? Math.round((prev.actualLeadsDiscovered || 0) * growthFactor)
        : 500,
      emailsSent: prev?.actualEmailsSent
        ? Math.round((prev.actualEmailsSent || 0) * growthFactor)
        : 200,
      emailsOpened: prev?.actualEmailsOpened
        ? Math.round((prev.actualEmailsOpened || 0) * growthFactor)
        : 40,
      emailsClicked: prev?.actualEmailsClicked
        ? Math.round((prev.actualEmailsClicked || 0) * growthFactor)
        : 15,
      conversions: prev?.actualConversions
        ? Math.round((prev.actualConversions || 0) * growthFactor)
        : 5,
      hotLeads: prev?.actualHotLeads
        ? Math.round((prev.actualHotLeads || 0) * growthFactor)
        : 10,
    };

    // Source allocation: use AI strategy from last week, or default even split
    const sourceAllocation = prev?.aiStrategyNext
      ? tryParseSourceAllocation(prev.aiStrategyNext)
      : { spotify: 30, bandcamp: 25, google_ai: 20, instagram: 15, soundcloud: 10 };

    const [newGoal] = await db.insert(agentGoals).values({
      weekStart: start,
      weekEnd: end,
      status: 'active',
      targetLeadsDiscovered: targets.leadsDiscovered,
      targetEmailsSent: targets.emailsSent,
      targetEmailsOpened: targets.emailsOpened,
      targetEmailsClicked: targets.emailsClicked,
      targetConversions: targets.conversions,
      targetHotLeads: targets.hotLeads,
      sourceAllocation: sourceAllocation,
    }).returning();

    console.log(`[GoalEngine] Created weekly goals: ${targets.leadsDiscovered} leads, ${targets.emailsSent} emails, ${targets.conversions} conversions`);

    // Log the decision
    await logGoalDecision('create_goals', { targets, sourceAllocation }, 'Auto-created weekly goals with 10% growth factor');

    return mapGoalRow(newGoal);
  } catch (err: any) {
    console.error('[GoalEngine] Init goals error:', err.message);
    return null;
  }
}

// ─── Update Goal Progress ────────────────────────────────────────

/**
 * Queries real-time data to update current week's actual KPIs
 */
export async function updateGoalProgress(): Promise<GoalKPIs | null> {
  try {
    const { start, end } = getWeekBounds();

    // Find active goal for this week
    const [goal] = await db.select().from(agentGoals)
      .where(and(eq(agentGoals.weekStart, start), eq(agentGoals.status, 'active')))
      .limit(1);

    if (!goal) return null;

    // Query actual metrics for this week
    const [
      leadsResult,
      emailsSentResult,
      emailsOpenedResult,
      emailsClickedResult,
      conversionsResult,
      hotLeadsResult,
    ] = await Promise.all([
      // Leads discovered this week
      db.execute(sql`
        SELECT count(*) as cnt FROM music_industry_contacts
        WHERE created_at >= ${start} AND created_at <= ${end}
      `),
      // Emails sent this week
      db.execute(sql`
        SELECT count(*) as cnt FROM activation_events
        WHERE event_type = 'email_sent' AND created_at >= ${start} AND created_at <= ${end}
      `),
      // Emails opened this week
      db.execute(sql`
        SELECT count(DISTINCT email) as cnt FROM activation_events
        WHERE event_type = 'email_opened' AND created_at >= ${start} AND created_at <= ${end}
      `),
      // Emails clicked this week
      db.execute(sql`
        SELECT count(DISTINCT email) as cnt FROM activation_events
        WHERE (event_type = 'email_clicked' OR event_type = 'magic_link_clicked')
          AND created_at >= ${start} AND created_at <= ${end}
      `),
      // Conversions (account created) this week
      db.execute(sql`
        SELECT count(DISTINCT email) as cnt FROM activation_events
        WHERE event_type = 'account_created' AND created_at >= ${start} AND created_at <= ${end}
      `),
      // Hot leads (score >= 70) currently
      db.execute(sql`
        SELECT count(*) as cnt FROM activation_scores WHERE segment = 'hot'
      `),
    ]);

    const actuals: GoalKPIs = {
      leadsDiscovered: parseInt(leadsResult.rows[0]?.cnt as string || '0'),
      emailsSent: parseInt(emailsSentResult.rows[0]?.cnt as string || '0'),
      emailsOpened: parseInt(emailsOpenedResult.rows[0]?.cnt as string || '0'),
      emailsClicked: parseInt(emailsClickedResult.rows[0]?.cnt as string || '0'),
      conversions: parseInt(conversionsResult.rows[0]?.cnt as string || '0'),
      hotLeads: parseInt(hotLeadsResult.rows[0]?.cnt as string || '0'),
    };

    // Update the goal record
    await db.update(agentGoals).set({
      actualLeadsDiscovered: actuals.leadsDiscovered,
      actualEmailsSent: actuals.emailsSent,
      actualEmailsOpened: actuals.emailsOpened,
      actualEmailsClicked: actuals.emailsClicked,
      actualConversions: actuals.conversions,
      actualHotLeads: actuals.hotLeads,
      updatedAt: new Date(),
    }).where(eq(agentGoals.id, goal.id));

    return actuals;
  } catch (err: any) {
    console.error('[GoalEngine] Update progress error:', err.message);
    return null;
  }
}

// ─── Self-Evaluation ─────────────────────────────────────────────

/**
 * Evaluates the week's performance using GPT and generates strategy for next week.
 * Should be called at end of week (Sunday) or beginning of new week.
 */
export async function evaluateWeeklyPerformance(weekStart?: Date): Promise<{
  performanceScore: number;
  reflection: string;
  strategyNext: string;
} | null> {
  try {
    const target = weekStart || getWeekBounds(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).start;

    const [goal] = await db.select().from(agentGoals)
      .where(eq(agentGoals.weekStart, target))
      .limit(1);

    if (!goal) return null;

    // First update the progress to get latest actuals
    await updateGoalProgress();

    // Re-fetch with updated data
    const [updatedGoal] = await db.select().from(agentGoals)
      .where(eq(agentGoals.id, goal.id))
      .limit(1);

    if (!updatedGoal) return null;

    // Calculate performance score (weighted average of KPI completion rates)
    const kpiCompletion = calculateKPICompletion(updatedGoal);
    const performanceScore = Math.round(kpiCompletion.overall);

    // Get source ROI data for context
    const roiData = await getSourceROI(target);

    // GPT self-reflection
    const start = Date.now();
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            week: target.toISOString().slice(0, 10),
            targets: {
              leadsDiscovered: updatedGoal.targetLeadsDiscovered,
              emailsSent: updatedGoal.targetEmailsSent,
              emailsOpened: updatedGoal.targetEmailsOpened,
              emailsClicked: updatedGoal.targetEmailsClicked,
              conversions: updatedGoal.targetConversions,
              hotLeads: updatedGoal.targetHotLeads,
            },
            actuals: {
              leadsDiscovered: updatedGoal.actualLeadsDiscovered,
              emailsSent: updatedGoal.actualEmailsSent,
              emailsOpened: updatedGoal.actualEmailsOpened,
              emailsClicked: updatedGoal.actualEmailsClicked,
              conversions: updatedGoal.actualConversions,
              hotLeads: updatedGoal.actualHotLeads,
            },
            performanceScore,
            kpiCompletion,
            sourceROI: roiData,
          }),
        },
      ],
      temperature: 0.4,
      max_tokens: 600,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content) as {
      reflection: string;
      strategyNext: string;
      sourceAllocation: Record<string, number>;
    };

    // Update the goal with evaluation
    await db.update(agentGoals).set({
      status: 'completed',
      performanceScore,
      aiReflection: parsed.reflection,
      aiStrategyNext: parsed.strategyNext,
      updatedAt: new Date(),
    }).where(eq(agentGoals.id, updatedGoal.id));

    // Log AI decision
    await logGoalDecision('weekly_evaluation', {
      performanceScore,
      kpiCompletion,
      sourceROI: roiData.slice(0, 5),
    }, parsed.reflection, response.usage?.total_tokens || 0, Date.now() - start);

    console.log(`[GoalEngine] Week evaluated: score ${performanceScore}/100 — ${parsed.reflection.slice(0, 100)}...`);

    return {
      performanceScore,
      reflection: parsed.reflection,
      strategyNext: parsed.strategyNext,
    };
  } catch (err: any) {
    console.error('[GoalEngine] Evaluation error:', err.message);
    return null;
  }
}

// ─── Source ROI Tracking ─────────────────────────────────────────

/**
 * Calculates and stores ROI metrics per discovery source for a given week
 */
export async function computeSourceROI(weekStart?: Date): Promise<SourceROIData[]> {
  try {
    const { start } = weekStart ? { start: weekStart } : getWeekBounds();
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    const sources = ['spotify', 'bandcamp', 'google_ai', 'instagram', 'soundcloud'];
    const results: SourceROIData[] = [];

    for (const source of sources) {
      const [
        leadsResult,
        emailedResult,
        openedResult,
        clickedResult,
        convertedResult,
        avgScoreResult,
      ] = await Promise.all([
        db.execute(sql`
          SELECT count(*) as cnt FROM music_industry_contacts
          WHERE import_source = ${source}
            AND created_at >= ${start} AND created_at <= ${end}
        `),
        db.execute(sql`
          SELECT count(DISTINCT ae.email) as cnt
          FROM activation_events ae
          INNER JOIN music_industry_contacts mic ON mic.email = ae.email
          WHERE mic.import_source = ${source}
            AND ae.event_type = 'email_sent'
            AND ae.created_at >= ${start} AND ae.created_at <= ${end}
        `),
        db.execute(sql`
          SELECT count(DISTINCT ae.email) as cnt
          FROM activation_events ae
          INNER JOIN music_industry_contacts mic ON mic.email = ae.email
          WHERE mic.import_source = ${source}
            AND ae.event_type = 'email_opened'
            AND ae.created_at >= ${start} AND ae.created_at <= ${end}
        `),
        db.execute(sql`
          SELECT count(DISTINCT ae.email) as cnt
          FROM activation_events ae
          INNER JOIN music_industry_contacts mic ON mic.email = ae.email
          WHERE mic.import_source = ${source}
            AND (ae.event_type = 'email_clicked' OR ae.event_type = 'magic_link_clicked')
            AND ae.created_at >= ${start} AND ae.created_at <= ${end}
        `),
        db.execute(sql`
          SELECT count(DISTINCT ae.email) as cnt
          FROM activation_events ae
          INNER JOIN music_industry_contacts mic ON mic.email = ae.email
          WHERE mic.import_source = ${source}
            AND ae.event_type = 'account_created'
            AND ae.created_at >= ${start} AND ae.created_at <= ${end}
        `),
        db.execute(sql`
          SELECT COALESCE(AVG(asc2.score), 0) as avg
          FROM activation_scores asc2
          INNER JOIN music_industry_contacts mic ON mic.id = asc2.contact_id
          WHERE mic.import_source = ${source}
            AND mic.created_at >= ${start} AND mic.created_at <= ${end}
        `),
      ]);

      const leads = parseInt(leadsResult.rows[0]?.cnt as string || '0');
      const emailed = parseInt(emailedResult.rows[0]?.cnt as string || '0');
      const opened = parseInt(openedResult.rows[0]?.cnt as string || '0');
      const clicked = parseInt(clickedResult.rows[0]?.cnt as string || '0');
      const conversions = parseInt(convertedResult.rows[0]?.cnt as string || '0');
      const avgScore = Math.round(parseFloat(avgScoreResult.rows[0]?.avg as string || '0'));

      // ROI score: weighted composite (conversions are king)
      const roiScore = leads > 0
        ? Math.min(100, Math.round(
            (conversions / Math.max(leads, 1)) * 5000 +
            (clicked / Math.max(leads, 1)) * 1000 +
            (opened / Math.max(emailed || 1, 1)) * 200 +
            avgScore * 0.5
          ))
        : 0;

      // Upsert into source_roi table
      const existing = await db.select().from(sourceRoi)
        .where(and(eq(sourceRoi.source, source), eq(sourceRoi.weekStart, start)))
        .limit(1);

      if (existing.length > 0) {
        await db.update(sourceRoi).set({
          leadsDiscovered: leads,
          leadsEmailed: emailed,
          emailsOpened: opened,
          emailsClicked: clicked,
          conversions,
          avgScore,
          roiScore,
        }).where(eq(sourceRoi.id, existing[0].id));
      } else {
        await db.insert(sourceRoi).values({
          source,
          weekStart: start,
          leadsDiscovered: leads,
          leadsEmailed: emailed,
          emailsOpened: opened,
          emailsClicked: clicked,
          conversions,
          avgScore,
          roiScore,
        });
      }

      results.push({
        source,
        weekStart: start,
        leadsDiscovered: leads,
        leadsEmailed: emailed,
        emailsOpened: opened,
        emailsClicked: clicked,
        conversions,
        avgScore,
        roiScore,
      });
    }

    console.log(`[GoalEngine] Source ROI computed for week ${start.toISOString().slice(0, 10)}`);
    return results;
  } catch (err: any) {
    console.error('[GoalEngine] Source ROI error:', err.message);
    return [];
  }
}

/**
 * Get source ROI history (current week or specific week)
 */
export async function getSourceROI(weekStart?: Date): Promise<SourceROIData[]> {
  try {
    const { start } = weekStart ? { start: weekStart } : getWeekBounds();
    const rows = await db.select().from(sourceRoi)
      .where(eq(sourceRoi.weekStart, start));

    return rows.map(r => ({
      source: r.source,
      weekStart: r.weekStart,
      leadsDiscovered: r.leadsDiscovered || 0,
      leadsEmailed: r.leadsEmailed || 0,
      emailsOpened: r.emailsOpened || 0,
      emailsClicked: r.emailsClicked || 0,
      conversions: r.conversions || 0,
      avgScore: r.avgScore || 0,
      roiScore: r.roiScore,
    }));
  } catch (err: any) {
    console.error('[GoalEngine] Get ROI error:', err.message);
    return [];
  }
}

// ─── Goals Dashboard ─────────────────────────────────────────────

export async function getGoalsDashboard(): Promise<GoalsDashboard> {
  try {
    const { start } = getWeekBounds();

    // Ensure goals exist for current week
    await initializeWeeklyGoals();

    // Update current progress
    await updateGoalProgress();

    // Get current + recent goals
    const goals = await db.select().from(agentGoals)
      .orderBy(desc(agentGoals.weekStart))
      .limit(8);

    const mapped = goals.map(mapGoalRow);
    const currentGoal = mapped.find(g => g.weekStart.getTime() === start.getTime()) || mapped[0] || null;

    // Get current week's source ROI
    const roi = await getSourceROI();

    // If no ROI data yet, compute it
    const effectiveROI = roi.length > 0 ? roi : await computeSourceROI();

    // Calculate overall performance trend (last 4 completed weeks)
    const completedGoals = mapped.filter(g => g.performanceScore !== null).slice(0, 4);
    const overallPerformance = completedGoals.length > 0
      ? Math.round(completedGoals.reduce((a, b) => a + (b.performanceScore || 0), 0) / completedGoals.length)
      : 0;

    // Trend: compare last 2 weeks
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (completedGoals.length >= 2) {
      const diff = (completedGoals[0].performanceScore || 0) - (completedGoals[1].performanceScore || 0);
      if (diff > 5) trend = 'improving';
      else if (diff < -5) trend = 'declining';
    }

    return {
      currentGoal,
      recentGoals: mapped,
      sourceROI: effectiveROI,
      overallPerformance,
      trend,
    };
  } catch (err: any) {
    console.error('[GoalEngine] Dashboard error:', err.message);
    return {
      currentGoal: null,
      recentGoals: [],
      sourceROI: [],
      overallPerformance: 0,
      trend: 'stable',
    };
  }
}

// ─── Goal Tick (called from activation tick) ─────────────────────

/**
 * Processes goal-related tasks on each activation tick:
 * - Ensures weekly goals exist
 * - Updates progress
 * - At week boundary: evaluates past week + computes ROI
 */
export async function processGoalTick(): Promise<{ goalsUpdated: boolean; evaluated: boolean }> {
  try {
    // Ensure current week has goals
    const goal = await initializeWeeklyGoals();

    // Update progress
    await updateGoalProgress();

    // Check if we need to evaluate last week
    const lastWeek = getWeekBounds(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const [lastGoal] = await db.select().from(agentGoals)
      .where(and(
        eq(agentGoals.weekStart, lastWeek.start),
        eq(agentGoals.status, 'active'),
      ))
      .limit(1);

    let evaluated = false;
    if (lastGoal) {
      // Last week still active → evaluate it
      await evaluateWeeklyPerformance(lastWeek.start);
      await computeSourceROI(lastWeek.start);
      evaluated = true;
    }

    // Compute current week's ROI
    await computeSourceROI();

    return { goalsUpdated: !!goal, evaluated };
  } catch (err: any) {
    console.error('[GoalEngine] Goal tick error:', err.message);
    return { goalsUpdated: false, evaluated: false };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────

function mapGoalRow(row: any): WeeklyGoal {
  return {
    id: row.id,
    weekStart: row.weekStart,
    weekEnd: row.weekEnd,
    status: row.status,
    targets: {
      leadsDiscovered: row.targetLeadsDiscovered || 0,
      emailsSent: row.targetEmailsSent || 0,
      emailsOpened: row.targetEmailsOpened || 0,
      emailsClicked: row.targetEmailsClicked || 0,
      conversions: row.targetConversions || 0,
      hotLeads: row.targetHotLeads || 0,
    },
    actuals: {
      leadsDiscovered: row.actualLeadsDiscovered || 0,
      emailsSent: row.actualEmailsSent || 0,
      emailsOpened: row.actualEmailsOpened || 0,
      emailsClicked: row.actualEmailsClicked || 0,
      conversions: row.actualConversions || 0,
      hotLeads: row.actualHotLeads || 0,
    },
    performanceScore: row.performanceScore,
    aiReflection: row.aiReflection,
    aiStrategyNext: row.aiStrategyNext,
    sourceAllocation: row.sourceAllocation as Record<string, number> | null,
  };
}

function calculateKPICompletion(goal: any): Record<string, number> & { overall: number } {
  const calc = (actual: number, target: number) =>
    target > 0 ? Math.min(200, Math.round((actual / target) * 100)) : 0;

  const kpis = {
    leadsDiscovered: calc(goal.actualLeadsDiscovered || 0, goal.targetLeadsDiscovered || 1),
    emailsSent: calc(goal.actualEmailsSent || 0, goal.targetEmailsSent || 1),
    emailsOpened: calc(goal.actualEmailsOpened || 0, goal.targetEmailsOpened || 1),
    emailsClicked: calc(goal.actualEmailsClicked || 0, goal.targetEmailsClicked || 1),
    conversions: calc(goal.actualConversions || 0, goal.targetConversions || 1),
    hotLeads: calc(goal.actualHotLeads || 0, goal.targetHotLeads || 1),
  };

  // Weighted average: conversions (30%) > clicks (20%) > opens (15%) > emails (15%) > leads (10%) > hot (10%)
  const overall =
    kpis.conversions * 0.30 +
    kpis.emailsClicked * 0.20 +
    kpis.emailsOpened * 0.15 +
    kpis.emailsSent * 0.15 +
    kpis.leadsDiscovered * 0.10 +
    kpis.hotLeads * 0.10;

  return { ...kpis, overall };
}

function tryParseSourceAllocation(strategy: string): Record<string, number> {
  // Try to extract source allocation from AI strategy text
  const defaults = { spotify: 30, bandcamp: 25, google_ai: 20, instagram: 15, soundcloud: 10 };
  try {
    // Look for JSON-like structure in the strategy string
    const match = strategy.match(/\{[^}]*spotify[^}]*\}/i);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (parsed.spotify !== undefined) return parsed;
    }
  } catch {
    // ignore
  }
  return defaults;
}

async function logGoalDecision(
  type: string,
  data: Record<string, any>,
  reasoning: string,
  tokens = 0,
  durationMs = 0,
): Promise<void> {
  try {
    await db.insert(agentDecisions).values({
      decisionType: type,
      input: data,
      output: {},
      reasoning,
      model: tokens > 0 ? MODEL : 'rule-based',
      tokensUsed: tokens,
      durationMs,
    });
  } catch (err) {
    console.error('[GoalEngine] Decision log error:', err);
  }
}

// ─── System Prompts ──────────────────────────────────────────────

const EVALUATION_SYSTEM_PROMPT = `You are the Boostify Artist Hunter Agent's self-evaluation module. You analyze your weekly performance and recommend improvements.

You receive:
- Weekly KPI targets vs actuals
- Performance score (0-100)
- Source ROI data per discovery channel

Generate:
1. A reflection (2-3 sentences) on what went well, what didn't
2. A strategy recommendation for next week
3. Recommended source allocation (% split across: spotify, bandcamp, google_ai, instagram, soundcloud — must sum to 100)

Focus on actionable insights. If conversion rates are low on a source, recommend reducing allocation. If a source has high ROI, recommend increasing it.

Respond ONLY in JSON:
{
  "reflection": "<2-3 sentence performance reflection>",
  "strategyNext": "<2-3 sentence strategy for next week>",
  "sourceAllocation": { "spotify": <number>, "bandcamp": <number>, "google_ai": <number>, "instagram": <number>, "soundcloud": <number> }
}`;
