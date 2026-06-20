/**
 * C-Suite AI · Admin REST + SSE endpoints
 *
 * Mount: /api/admin/c-suite
 * All endpoints require admin via requireAdmin middleware.
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  cSuiteAgents,
  cSuiteThreads,
  cSuiteMessages,
  cSuiteDecisions,
  cSuiteApprovals,
  cSuiteGoals,
  cSuiteSelfImprovement,
  cSuiteSettings,
  cSuiteMemory,
} from '../../db/schema';
import { and, desc, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/require-admin';
import { runAgentTurn, runtimeEvents, seedAgentsIfMissing } from '../services/c-suite/runtime';
import { runSelfMaintenanceCycle, runDailyBriefing } from '../services/c-suite/self-maintenance';

const router = Router();

router.use(requireAdmin);

// ---------------- Bootstrap (idempotent) ----------------
router.post('/bootstrap', async (_req, res) => {
  try {
    await seedAgentsIfMissing();
    const agents = await db.select().from(cSuiteAgents);
    res.json({ ok: true, seededCount: agents.length });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Settings ----------------
router.get('/settings', async (_req, res) => {
  let [s] = await db.select().from(cSuiteSettings).limit(1);
  if (!s) {
    [s] = await db.insert(cSuiteSettings).values({}).returning();
  }
  res.json({ ok: true, settings: s });
});

router.patch('/settings', async (req, res) => {
  const { killSwitch, globalDryRun, dailyTokenBudgetUsd, autoApproveBelowRisk } = req.body || {};
  const patch: any = { updatedAt: new Date() };
  if (typeof killSwitch === 'boolean') patch.killSwitch = killSwitch;
  if (typeof globalDryRun === 'boolean') patch.globalDryRun = globalDryRun;
  if (dailyTokenBudgetUsd != null) patch.dailyTokenBudgetUsd = String(dailyTokenBudgetUsd);
  if (autoApproveBelowRisk != null) patch.autoApproveBelowRisk = autoApproveBelowRisk;
  const [existing] = await db.select().from(cSuiteSettings).limit(1);
  if (!existing) {
    const [created] = await db.insert(cSuiteSettings).values(patch).returning();
    return res.json({ ok: true, settings: created });
  }
  const [updated] = await db.update(cSuiteSettings).set(patch).where(eq(cSuiteSettings.id, existing.id)).returning();
  res.json({ ok: true, settings: updated });
});

// ---------------- Agents ----------------
router.get('/agents', async (_req, res) => {
  const rows = await db.select().from(cSuiteAgents).orderBy(cSuiteAgents.id);
  res.json({ ok: true, agents: rows });
});

router.patch('/agents/:id', async (req, res) => {
  const { active, dryRun, autonomy, model, persona, budgetUsdDaily } = req.body || {};
  const patch: any = { updatedAt: new Date() };
  if (typeof active === 'boolean') patch.active = active;
  if (typeof dryRun === 'boolean') patch.dryRun = dryRun;
  if (autonomy != null) patch.autonomy = Math.max(1, Math.min(3, autonomy));
  if (model) patch.model = model;
  if (persona) patch.persona = persona;
  if (budgetUsdDaily != null) patch.budgetUsdDaily = String(budgetUsdDaily);
  const [updated] = await db.update(cSuiteAgents).set(patch).where(eq(cSuiteAgents.id, req.params.id)).returning();
  res.json({ ok: true, agent: updated });
});

// ---------------- Command (sync execution) ----------------
router.post('/command', async (req, res) => {
  try {
    const { agentId = 'ceo', message } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ ok: false, error: 'message is required' });
    const result = await runAgentTurn({
      agentId,
      userMessage: message,
      triggeredBy: 'admin',
      adminEmail: (req as any).adminEmail,
    });
    res.json({ ok: true, result });
  } catch (e: any) {
    console.error('[c-suite] /command FAILED:', {
      agentId: req.body?.agentId,
      message: req.body?.message?.slice(0, 80),
      err: e?.message,
      code: e?.code,
      status: e?.status,
      stack: e?.stack?.split('\n').slice(0, 6).join('\n'),
    });
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: e?.message || String(e) });
    }
  }
});

// ---------------- SSE event stream (live thinking) ----------------
router.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
  res.write(`: connected\n\n`);

  let closed = false;
  const safeWrite = (chunk: string) => {
    if (closed || res.writableEnded || res.destroyed) return;
    try { res.write(chunk); } catch { closed = true; }
  };

  const handler = (event: any) => {
    safeWrite(`data: ${JSON.stringify(event)}\n\n`);
  };
  runtimeEvents.on('event', handler);

  const heartbeat = setInterval(() => safeWrite(`: heartbeat\n\n`), 25_000);

  const cleanup = () => {
    closed = true;
    clearInterval(heartbeat);
    runtimeEvents.off('event', handler);
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
});

// ---------------- Threads & Messages ----------------
router.get('/threads', async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50), 200);
  const rows = await db.select().from(cSuiteThreads).orderBy(desc(cSuiteThreads.createdAt)).limit(limit);
  res.json({ ok: true, threads: rows });
});

router.get('/threads/:id/messages', async (req, res) => {
  const id = Number(req.params.id);
  const rows = await db.select().from(cSuiteMessages).where(eq(cSuiteMessages.threadId, id)).orderBy(cSuiteMessages.id);
  res.json({ ok: true, messages: rows });
});

// ---------------- Decisions ----------------
router.get('/decisions', async (req, res) => {
  const status = req.query.status as string | undefined;
  const where = status ? eq(cSuiteDecisions.status, status as any) : undefined;
  const rows = await db.select().from(cSuiteDecisions).where(where).orderBy(desc(cSuiteDecisions.createdAt)).limit(100);
  res.json({ ok: true, decisions: rows });
});

// ---------------- Approvals ----------------
router.get('/approvals', async (_req, res) => {
  const rows = await db.select().from(cSuiteApprovals).where(eq(cSuiteApprovals.status, 'pending')).orderBy(desc(cSuiteApprovals.createdAt));
  res.json({ ok: true, approvals: rows });
});

router.post('/approvals/:id/decide', async (req, res) => {
  const id = Number(req.params.id);
  const decision = req.body?.decision as 'approve' | 'reject';
  const notes = (req.body?.notes as string) || null;
  if (!['approve', 'reject'].includes(decision)) {
    return res.status(400).json({ ok: false, error: 'decision must be approve|reject' });
  }
  const [appr] = await db.select().from(cSuiteApprovals).where(eq(cSuiteApprovals.id, id)).limit(1);
  if (!appr) return res.status(404).json({ ok: false, error: 'not found' });
  const newStatus = decision === 'approve' ? 'approved' : 'rejected';
  await db.update(cSuiteApprovals).set({
    status: newStatus,
    resolvedBy: (req as any).adminEmail,
    resolvedAt: new Date(),
    notes,
  }).where(eq(cSuiteApprovals.id, id));
  await db.update(cSuiteDecisions).set({
    status: decision === 'approve' ? 'approved' : 'rejected',
    approvedBy: (req as any).adminEmail,
    executedAt: decision === 'approve' ? new Date() : null,
  }).where(eq(cSuiteDecisions.id, appr.decisionId));

  // Auto-execute approved decisions (best-effort).
  let execResult: any = null;
  if (decision === 'approve') {
    try {
      const [dec] = await db.select().from(cSuiteDecisions).where(eq(cSuiteDecisions.id, appr.decisionId)).limit(1);
      if (dec && dec.action) {
        const { getTool } = await import('../services/c-suite/tools');
        const tool = getTool(dec.action);
        if (tool) {
          const args = (dec.target as any) || {};
          const parsed = tool.schema.safeParse(args);
          if (parsed.success) {
            execResult = await tool.execute(parsed.data, {
              agentId: dec.agentId,
              threadId: dec.threadId ?? 0,
              dryRun: false,
              autonomy: 3, // human-approved bypass
            });
          } else {
            execResult = { error: 'schema_validation_failed', details: parsed.error.format() };
          }
        } else {
          execResult = { error: `unknown tool: ${dec.action}` };
        }
      }
    } catch (e: any) {
      execResult = { error: e.message };
    }
    // Audit log
    try {
      await db.insert(cSuiteMemory).values({
        agentId: appr.requestedBy,
        kind: 'decision',
        content: JSON.stringify({
          type: 'human_approved_execution',
          approvalId: id,
          decisionId: appr.decisionId,
          adminEmail: (req as any).adminEmail,
          execResult,
        }),
        tags: ['approval', 'audit'],
        weight: 3,
      });
    } catch { /* non-fatal */ }
  }
  res.json({ ok: true, status: newStatus, execResult });
});

// ---------------- Goals ----------------
router.get('/goals', async (_req, res) => {
  const rows = await db.select().from(cSuiteGoals).orderBy(desc(cSuiteGoals.createdAt));
  res.json({ ok: true, goals: rows });
});

router.post('/goals', async (req, res) => {
  const { scope, ownerAgent, parentId, title, metric, targetValue, baseline, periodEnd } = req.body || {};
  if (!ownerAgent || !title || !metric || targetValue == null) {
    return res.status(400).json({ ok: false, error: 'ownerAgent, title, metric, targetValue required' });
  }
  const [created] = await db.insert(cSuiteGoals).values({
    scope: scope || 'department',
    ownerAgent,
    parentId,
    title,
    metric,
    targetValue: String(targetValue),
    baseline: baseline != null ? String(baseline) : undefined,
    periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    status: 'on_track',
  }).returning();
  res.json({ ok: true, goal: created });
});

// ---------------- Goal presets (one-click templates) ----------------
router.get('/goals/presets', async (_req, res) => {
  const { GOAL_PRESETS } = await import('../services/c-suite/goal-presets');
  res.json({ ok: true, presets: GOAL_PRESETS });
});

router.post('/goals/from-preset', async (req, res) => {
  const { presetKey, customTarget, periodEnd, autoExecute = true } = req.body || {};
  if (!presetKey) return res.status(400).json({ ok: false, error: 'presetKey required' });
  const { getPreset } = await import('../services/c-suite/goal-presets');
  const preset = getPreset(presetKey);
  if (!preset) return res.status(404).json({ ok: false, error: 'preset not found' });
  const [created] = await db.insert(cSuiteGoals).values({
    scope: preset.scope,
    ownerAgent: preset.ownerAgent,
    title: preset.title,
    metric: preset.metric,
    targetValue: String(customTarget ?? preset.targetValue),
    baseline: preset.baseline != null ? String(preset.baseline) : undefined,
    periodEnd: periodEnd ? new Date(periodEnd) : undefined,
    status: 'on_track',
  }).returning();

  // Auto-kick off owner agent to plan strategy for this goal (fire-and-forget).
  let executed = false;
  if (autoExecute) {
    const prompt = buildGoalKickoffPrompt(created, preset.description);
    runAgentTurn({
      agentId: preset.ownerAgent,
      userMessage: prompt,
      triggeredBy: `preset:${preset.key}`,
      adminEmail: (req as any).adminEmail,
    }).catch((err) => {
      console.error(`[c-suite] preset auto-execute failed for ${preset.key}:`, err.message);
    });
    executed = true;
  }
  res.json({ ok: true, goal: created, preset: preset.key, executed });
});

// ---------------- Delete goal ----------------
router.delete('/goals/:id', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    if (!goalId) return res.status(400).json({ ok: false, error: 'invalid goal id' });
    const deleted = await db.delete(cSuiteGoals).where(eq(cSuiteGoals.id, goalId)).returning();
    if (!deleted.length) return res.status(404).json({ ok: false, error: 'goal not found' });
    res.json({ ok: true, deletedId: goalId });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Goal execution (kick off owner agent strategy) ----------------
router.post('/goals/:id/execute', async (req, res) => {
  try {
    const goalId = parseInt(req.params.id, 10);
    if (!goalId) return res.status(400).json({ ok: false, error: 'invalid goal id' });
    const [goal] = await db.select().from(cSuiteGoals).where(eq(cSuiteGoals.id, goalId)).limit(1);
    if (!goal) return res.status(404).json({ ok: false, error: 'goal not found' });

    const prompt = buildGoalKickoffPrompt(goal);
    const result = await runAgentTurn({
      agentId: goal.ownerAgent,
      userMessage: prompt,
      triggeredBy: `goal:${goalId}`,
      adminEmail: (req as any).adminEmail,
    });
    res.json({ ok: true, goalId, threadId: result.threadId, finalText: result.finalText });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

function buildGoalKickoffPrompt(goal: any, description?: string): string {
  const target = goal.targetValue ?? '?';
  const metric = goal.metric ?? '?';
  const baseline = goal.baseline ? ` Current baseline: ${goal.baseline}.` : '';
  const desc = description ? `\n\nContext: ${description}` : '';
  return [
    `You have been assigned a new goal: "${goal.title}".`,
    `Metric to move: ${metric}. Target: ${target}.${baseline}`,
    desc,
    ``,
    `Your job NOW (this turn):`,
    `1. Use your read-only tools to query the CURRENT value of "${metric}" and recent trend.`,
    `2. Identify the top 3 levers to move this metric (concrete, owned by you or a peer agent).`,
    `3. Propose a 14-day action plan with specific tool calls / decisions you would make.`,
    `4. Save the plan as a memory entry (kind="decision", tags=["goal:${goal.id}"]) using the remember tool.`,
    `5. If you need cross-functional help, list which peer agents (cmo/cfo/cto/...) you would handoff to and why — do NOT actually handoff yet.`,
    ``,
    `Be specific, numerical, and avoid generic advice. Respect dryRun=true.`,
  ].join('\n');
}

// ---------------- Self-improvement log ----------------
router.get('/self-improvement', async (_req, res) => {
  const rows = await db.select().from(cSuiteSelfImprovement).orderBy(desc(cSuiteSelfImprovement.createdAt)).limit(100);
  res.json({ ok: true, items: rows });
});

router.post('/self-improvement/run', async (_req, res) => {
  try {
    const r = await runSelfMaintenanceCycle('admin');
    res.json({ ok: r.ok, message: r.message });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Daily briefing on demand ----------------
router.post('/briefing/run', async (_req, res) => {
  try {
    const r = await runDailyBriefing('admin');
    res.json({ ok: r.ok, message: r.message });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ---------------- Memory browser ----------------
router.get('/memory/:agentId', async (req, res) => {
  const rows = await db.select().from(cSuiteMemory).where(eq(cSuiteMemory.agentId, req.params.agentId))
    .orderBy(desc(cSuiteMemory.weight), desc(cSuiteMemory.createdAt)).limit(100);
  res.json({ ok: true, memory: rows });
});

// ---------------- Stats summary (for dashboard) ----------------
router.get('/stats', async (_req, res) => {
  const [{ activeAgents }] = await db.select({ activeAgents: sql<number>`COUNT(*) FILTER (WHERE active = true)::int` }).from(cSuiteAgents);
  const [{ pendingApprovals }] = await db.select({ pendingApprovals: sql<number>`COUNT(*)::int` }).from(cSuiteApprovals).where(eq(cSuiteApprovals.status, 'pending'));
  const [{ openIssues }] = await db.select({ openIssues: sql<number>`COUNT(*)::int` }).from(cSuiteSelfImprovement).where(sql`${cSuiteSelfImprovement.status} IN ('detected','analyzing','proposed')`);
  const [{ activeGoals }] = await db.select({ activeGoals: sql<number>`COUNT(*)::int` }).from(cSuiteGoals).where(sql`${cSuiteGoals.status} IN ('on_track','at_risk','off_track')`);
  const [{ activeThreads }] = await db.select({ activeThreads: sql<number>`COUNT(*)::int` }).from(cSuiteThreads).where(eq(cSuiteThreads.status, 'active'));
  res.json({
    ok: true,
    stats: {
      activeAgents: activeAgents ?? 0,
      pendingApprovals: pendingApprovals ?? 0,
      openIssues: openIssues ?? 0,
      activeGoals: activeGoals ?? 0,
      activeThreads: activeThreads ?? 0,
    },
  });
});

export default router;
