/**
 * C-Suite AI · Self-Maintenance Loop
 *
 * Runs periodically (manually-triggered initially, cron later).
 * The CTO agent (Kai) executes runSelfDiagnostics, interprets the issues,
 * and either files self-improvement tickets or proposes tunings via
 * proposeAgentTuning (which queues for human approval).
 *
 * Goal: the system should detect its own bugs, performance issues,
 * cost spikes and goal drifts, and propose remediations — all logged
 * to c_suite_self_improvement for full audit trail.
 */

import { runAgentTurn } from './runtime';
import { db } from '../../db';
import { cSuiteAgents } from '../../db/schema';
import { eq } from 'drizzle-orm';

export async function runSelfMaintenanceCycle(triggeredBy = 'cron'): Promise<{ ok: boolean; message: string }> {
  const [cto] = await db.select().from(cSuiteAgents).where(eq(cSuiteAgents.id, 'cto')).limit(1);
  if (!cto) return { ok: false, message: 'CTO agent not seeded' };
  if (!cto.active) return { ok: false, message: 'CTO is inactive — skipped' };

  const prompt = `Run a complete self-maintenance cycle for the Boostify C-Suite.

Steps:
1. Call runSelfDiagnostics to find issues (stuck threads, failed tools, off-track goals, cost spikes).
2. For each issue with severity >= 3, call reportSelfImprovement with category, severity, title, description and a concrete proposedFix.
3. If you detect any agent that is consistently failing or expensive, call proposeAgentTuning to suggest a model change, persona tweak, or autonomy adjustment.
4. Summarize what you did at the end in 5 bullets max.

Be precise. Use evidence from the diagnostics output, not speculation.`;

  const result = await runAgentTurn({
    agentId: 'cto',
    userMessage: prompt,
    triggeredBy,
    maxToolCalls: 12,
  });

  return {
    ok: true,
    message: `Self-maintenance cycle complete. Thread ${result.threadId}, ${result.toolCalls} tool calls, $${result.totalCostUsd.toFixed(4)}.`,
  };
}

export async function runDailyBriefing(triggeredBy = 'cron'): Promise<{ ok: boolean; message: string }> {
  const [ceo] = await db.select().from(cSuiteAgents).where(eq(cSuiteAgents.id, 'ceo')).limit(1);
  if (!ceo) return { ok: false, message: 'CEO not seeded' };
  if (!ceo.active) return { ok: false, message: 'CEO inactive — skipped' };

  const prompt = `Run the Boostify daily briefing.

Steps:
1. queryPlatformOverview for current state.
2. queryRevenueSnapshot for last 7 days.
3. queryAgentHealth to see your team status.
4. listGoals (status='at_risk' OR 'off_track') to find what needs attention.
5. If anything is at risk, hand it off to the right C-level (CFO for revenue, CMO for growth, CTO for platform, etc.) with a sharp question.
6. End with a 6-bullet executive summary in this format:
   • Health: <one-liner>
   • MRR: <number + trend>
   • Top Risk: <one-liner>
   • Top Opportunity: <one-liner>
   • Decision Needed: <yes/no + what>
   • Tomorrow's Focus: <one-liner>`;

  const result = await runAgentTurn({
    agentId: 'ceo',
    userMessage: prompt,
    triggeredBy,
    maxToolCalls: 12,
  });

  return {
    ok: true,
    message: `Daily briefing complete. Thread ${result.threadId}, ${result.toolCalls} tool calls, $${result.totalCostUsd.toFixed(4)}.`,
  };
}
