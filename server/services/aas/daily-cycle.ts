/**
 * AAS Daily Cycle Runner v2.1
 * 
 * The main 7-phase loop that runs the AAS engine for one artist:
 *   1. DIAGNOSE  — Calculate survival score + financial snapshot
 *   2. PRIORITIZE — Create a daily plan (strategist v2: contacts, extensions, emails)
 *   3. SET GOALS — Generate and save daily goals (radio, labels, social, blockchain, etc.)
 *   4. VALIDATE  — Run compliance checks (risk agent)
 *   5. EXECUTE   — Route approved actions to 9+ agents (email, FAL AI, extensions, social, blockchain)
 *   6. EVALUATE  — Log results, update score, update goal progress
 *   7. LEARN     — Save strategic memories
 */

import { db } from '../../db';
import {
  aasConfig,
  aasDailyActionLog,
  aasStrategicMemory,
} from '../../db/schema';
import { eq, and } from 'drizzle-orm';

import {
  getFinancialSnapshot,
  calculateSurvivalScore,
  saveSurvivalSnapshot,
} from './survival-score';
import { generateDailyGoals, saveDailyGoals, updateGoalProgress, inferGoalCategory } from './daily-goals';
import { createDailyPlan } from '../../agents/aas/survival-strategist';
import { validatePlan } from '../../agents/aas/risk-compliance';
import { executeRevenueAction } from '../../agents/aas/revenue-operator';
import { executeDealAction } from '../../agents/aas/deal-closer';
import { executeGrowthAction } from '../../agents/aas/growth-operator';
import { executeCommunityAction } from '../../agents/aas/community-operator';
import { executeComplianceAction } from '../../agents/aas/risk-compliance';
import { executeFinanceAction } from '../../agents/aas/finance-controller';
import { executeSocialAction } from '../../agents/aas/social-operator';
import { executeBlockchainAction } from '../../agents/aas/blockchain-operator';
import type { ActionResult, PlannedAction } from './types';

/**
 * Run a full AAS daily cycle for one artist.
 * Returns a summary of what happened.
 */
export async function runDailyCycle(artistId: number): Promise<CycleSummary> {
  const cycleDate = new Date().toISOString().slice(0, 10);

  // ── Check config ────────────────────────────────────────
  const [config] = await db
    .select()
    .from(aasConfig)
    .where(and(eq(aasConfig.artistId, artistId), eq(aasConfig.enabled, true)));

  if (!config) {
    return { artistId, cycleDate, skipped: true, reason: 'AAS not enabled' };
  }

  console.log(`[AAS] Cycle start for artist ${artistId} — ${cycleDate}`);

  // ── Phase 1: DIAGNOSE ───────────────────────────────────
  const scoreBefore = await calculateSurvivalScore(artistId);
  const financial = await getFinancialSnapshot(artistId);

  console.log(`[AAS] Artist ${artistId} diagnosis: score=${scoreBefore.total} (${scoreBefore.status}), runway=${financial.runwayDays}d, burn=$${financial.dailyBurnRate.toFixed(2)}/d`);

  // ── Phase 2: PRIORITIZE ─────────────────────────────────
  const plan = await createDailyPlan(artistId);

  console.log(`[AAS] Artist ${artistId} plan: mode=${plan.priorityMode}, actions=${plan.actions.length}, budget=$${plan.maxBudget}`);

  // ── Phase 3: SET GOALS ──────────────────────────────────
  const hasExtensions = plan.actions.some(a => a.channel === 'instagram' || a.channel === 'youtube');
  const goals = await generateDailyGoals(artistId, plan.priorityMode, scoreBefore.total, hasExtensions);
  const goalIds = await saveDailyGoals(artistId, cycleDate, goals);
  console.log(`[AAS] Artist ${artistId}: ${goals.length} daily goals set (${goals.map(g => g.category).join(', ')})`);

  // ── Phase 4: VALIDATE ───────────────────────────────────
  const { approved, blocked, pendingApproval } = await validatePlan(
    artistId,
    plan.actions,
  );

  console.log(
    `[AAS] Artist ${artistId}: ${approved.length} approved, ${blocked.length} blocked, ${pendingApproval.length} pending`,
  );

  // ── Phase 4: EXECUTE ────────────────────────────────────
  const results: ActionResult[] = [];
  let totalSpent = 0;
  let totalEarned = 0;

  for (const action of approved) {
    console.log(`[AAS] Executing: [${action.agent}] ${action.action} (budget: $${action.budgetAllocated})`);
    const result = await routeAction(artistId, action);
    results.push(result);
    totalSpent += result.costActual ?? 0;
    totalEarned += result.revenueGenerated ?? 0;
    console.log(`[AAS]   → ${result.success ? 'OK' : 'FAIL'}: ${result.details.substring(0, 120)}`);
  }

  const completed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  // ── Phase 5.5: UPDATE GOALS ─────────────────────────────
  // Map successful action results to the daily goals they advance and update
  // progress. Categories are inferred from the action wording (keyword-based)
  // so goal tracking stays correct even when strategist action strings change.
  // Each goal is advanced at most once per matching successful action; goals
  // already at their target are skipped.
  const goalProgress = new Map<number, number>(); // goalId → increments applied this cycle

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r.success) continue;

    const actionName = approved[i]?.action ?? r.action;
    const category = inferGoalCategory(actionName);
    if (!category) continue;

    // Find a goal of this category that still has remaining capacity.
    const goalIdx = goals.findIndex((g, idx) => {
      if (g.category !== category) return false;
      const id = goalIds[idx];
      if (id == null) return false;
      const alreadyApplied = goalProgress.get(id) ?? 0;
      return alreadyApplied < g.targetCount;
    });

    if (goalIdx >= 0 && goalIdx < goalIds.length) {
      const goalId = goalIds[goalIdx];
      goalProgress.set(goalId, (goalProgress.get(goalId) ?? 0) + 1);
      try {
        await updateGoalProgress(goalId, 1, r.details);
      } catch (err) {
        console.error(`[AAS] Failed to update goal ${goalId} progress:`, err);
      }
    }
  }

  // ── Phase 6: EVALUATE ───────────────────────────────────
  const scoreAfter = await calculateSurvivalScore(artistId);

  // Save survival snapshot
  await saveSurvivalSnapshot(artistId, scoreAfter, financial, 'daily');

  // Log the full cycle
  await db.insert(aasDailyActionLog).values({
    artistId,
    cycleDate,
    objectives: plan.objectives,
    plannedActions: results.map((r, i) => ({
      action: approved[i]?.action ?? r.action,
      agent: r.agent,
      channel: approved[i]?.channel ?? '',
      budgetAllocated: approved[i]?.budgetAllocated ?? 0,
      status: r.success ? ('completed' as const) : ('failed' as const),
      result: r.details,
      costActual: r.costActual,
      revenueGenerated: r.revenueGenerated,
    })),
    maxDailyBudget: config.maxDailyBudget,
    totalSpent: totalSpent.toFixed(2),
    totalEarned: totalEarned.toFixed(2),
    actionsCompleted: completed,
    actionsFailed: failed,
    lessonsLearned: results
      .flatMap((r) => r.lessonsLearned ?? [])
      .filter(Boolean),
    survivalScoreBefore: scoreBefore.total.toFixed(2),
    survivalScoreAfter: scoreAfter.total.toFixed(2),
  });

  // Update cached score on config
  await db
    .update(aasConfig)
    .set({
      survivalScore: scoreAfter.total.toFixed(2),
      lastCycleAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(aasConfig.artistId, artistId));

  // ── Phase 7: LEARN ──────────────────────────────────────
  const lessons = results
    .flatMap((r) => r.lessonsLearned ?? [])
    .filter(Boolean);

  for (const insight of lessons.slice(0, 5)) {
    await db.insert(aasStrategicMemory).values({
      artistId,
      category: 'creative_roi',
      insight,
      confidence: '0.50',
      evidenceCount: 1,
      lastValidatedAt: new Date(),
    });
  }

  const summary: CycleSummary = {
    artistId,
    cycleDate,
    skipped: false,
    scoreBefore: scoreBefore.total,
    scoreAfter: scoreAfter.total,
    statusBefore: scoreBefore.status,
    statusAfter: scoreAfter.status,
    mode: plan.priorityMode,
    actionsPlanned: plan.actions.length,
    actionsApproved: approved.length,
    actionsBlocked: blocked.length,
    actionsPending: pendingApproval.length,
    actionsCompleted: completed,
    actionsFailed: failed,
    totalSpent,
    totalEarned,
    netResult: totalEarned - totalSpent,
    objectives: plan.objectives,
    lessons,
  };

  console.log(
    `[AAS] Cycle done for artist ${artistId}: score ${scoreBefore.total} → ${scoreAfter.total} | earned $${totalEarned.toFixed(2)} spent $${totalSpent.toFixed(2)}`,
  );

  return summary;
}

/**
 * Route one action to the correct agent
 */
async function routeAction(
  artistId: number,
  action: PlannedAction,
): Promise<ActionResult> {
  try {
    switch (action.agent) {
      case 'revenue-operator':
        return await executeRevenueAction(artistId, action.action, action.budgetAllocated);
      case 'deal-closer':
        return await executeDealAction(artistId, action.action, action.budgetAllocated);
      case 'growth-operator':
        return await executeGrowthAction(artistId, action.action, action.budgetAllocated);
      case 'community-operator':
        return await executeCommunityAction(artistId, action.action, action.budgetAllocated);
      case 'risk-compliance':
        return await executeComplianceAction(artistId, action.action);
      case 'finance-controller':
        return await executeFinanceAction(artistId, action.action);
      case 'content-creator':
        // Content-creator is a virtual agent that delegates to growth-operator
        return await executeGrowthAction(artistId, action.action, action.budgetAllocated);
      case 'social-operator':
        return await executeSocialAction(artistId, action.action, action.budgetAllocated);
      case 'blockchain-operator':
        return await executeBlockchainAction(artistId, action.action, action.budgetAllocated);
      default:
        console.warn(`[AAS] Unknown agent: ${action.agent} — routing to default handler`);
        return {
          success: false,
          agent: action.agent,
          action: action.action,
          costActual: 0,
          revenueGenerated: 0,
          details: `Unknown agent: ${action.agent}`,
        };
    }
  } catch (error: any) {
    return {
      success: false,
      agent: action.agent,
      action: action.action,
      costActual: 0,
      revenueGenerated: 0,
      details: `Execution error: ${error.message}`,
    };
  }
}

/**
 * Run cycles for ALL enabled artists.
 * Called from the orchestrator tick.
 */
export async function runAllAASCycles(): Promise<CycleSummary[]> {
  const enabledArtists = await db
    .select({ artistId: aasConfig.artistId })
    .from(aasConfig)
    .where(eq(aasConfig.enabled, true));

  const summaries: CycleSummary[] = [];

  for (const { artistId } of enabledArtists) {
    try {
      const summary = await runDailyCycle(artistId);
      summaries.push(summary);
    } catch (error: any) {
      console.error(`[AAS] Cycle failed for artist ${artistId}:`, error.message);
      summaries.push({
        artistId,
        cycleDate: new Date().toISOString().slice(0, 10),
        skipped: true,
        reason: `Error: ${error.message}`,
      });
    }
  }

  console.log(
    `[AAS] All cycles complete: ${summaries.filter((s) => !s.skipped).length}/${enabledArtists.length} succeeded`,
  );

  return summaries;
}

// ── Types ─────────────────────────────────────────────────

export interface CycleSummary {
  artistId: number;
  cycleDate: string;
  skipped: boolean;
  reason?: string;
  scoreBefore?: number;
  scoreAfter?: number;
  statusBefore?: string;
  statusAfter?: string;
  mode?: string;
  actionsPlanned?: number;
  actionsApproved?: number;
  actionsBlocked?: number;
  actionsPending?: number;
  actionsCompleted?: number;
  actionsFailed?: number;
  totalSpent?: number;
  totalEarned?: number;
  netResult?: number;
  objectives?: string[];
  lessons?: string[];
}
