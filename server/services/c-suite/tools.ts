/**
 * C-Suite AI · Tool Registry
 *
 * Each tool wraps an existing service / DB query in a typed, audited,
 * autonomy-checked callable. Agents can ONLY interact with the rest
 * of Boostify through these tools — no direct DB access from prompts.
 *
 * Autonomy levels:
 *   1 = HITL required (queues into approvals)
 *   2 = Autonomous if under budget, else HITL
 *   3 = Autonomous (read-only or trivially reversible)
 */

import { z } from 'zod';
import { db } from '../../db';
import {
  cSuiteAgents,
  cSuiteDecisions,
  cSuiteApprovals,
  cSuiteThreads,
  cSuiteGoals,
  cSuiteGoalCheckins,
  cSuiteSelfImprovement,
  cSuiteMemory,
  cSuiteMessages,
  users,
  merchandise,
  newsArticles,
  investorFeedback,
} from '../../db/schema';
import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// ============================================================
// Types
// ============================================================

export interface ToolContext {
  agentId: string;
  threadId: number;
  dryRun: boolean;
  autonomy: number;
  adminEmail?: string;
  /** When set, tool runs in artist-scope (Artist Career Suite). */
  artistId?: string;
  /** When set with artistId, identifies which personal/corporate agent key
   *  is invoking the tool (e.g. 'manager', 'marketing', 'cfo'). */
  artistAgentKey?: string;
}

export interface Tool<I = any, O = any> {
  id: string;
  description: string;
  schema: z.ZodType<I>;
  /** Required minimum autonomy on the agent to even attempt this tool. */
  requiredAutonomy: 1 | 2 | 3;
  /** If true, ALWAYS routes through approvals queue (regardless of autonomy). */
  humanRequired?: boolean;
  /** Estimated risk score 1..10 used to populate approval entries. */
  risk: number;
  /** Read-only tools never mutate state and bypass dry-run. */
  readOnly: boolean;
  /** Categorized for UI grouping. */
  category: 'database' | 'platform' | 'marketing' | 'finance' | 'ops' | 'meta' | 'self' | 'goals';
  execute: (input: I, ctx: ToolContext) => Promise<O>;
  /**
   * REAL action for humanRequired tools. `execute` queues the approval;
   * once an admin approves, the approvals route calls `performApproved`
   * to actually do the work. Without this, approving a HITL decision
   * would just re-queue another approval forever.
   */
  performApproved?: (input: I, ctx: ToolContext) => Promise<any>;
}

const tools = new Map<string, Tool>();
export function registerTool(t: Tool) {
  if (tools.has(t.id)) throw new Error(`Tool already registered: ${t.id}`);
  tools.set(t.id, t);
}
export function getTool(id: string): Tool | undefined {
  return tools.get(id);
}
export function listTools(): Tool[] {
  return Array.from(tools.values());
}

/** OpenAI function-calling schema for a list of tool ids. */
export function toolsToOpenAI(toolIds: string[]) {
  return toolIds
    .map((id) => tools.get(id))
    .filter((t): t is Tool => Boolean(t))
    .map((t) => ({
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: zodToJsonSchema(t.schema),
      },
    }));
}

// Tiny Zod → JSON Schema (only the subset we use).
function zodToJsonSchema(s: z.ZodTypeAny): any {
  if (s instanceof z.ZodObject) {
    const shape = (s as any)._def.shape();
    const properties: Record<string, any> = {};
    const required: string[] = [];
    for (const [k, v] of Object.entries(shape)) {
      const vAny = v as z.ZodTypeAny;
      properties[k] = zodToJsonSchema(vAny);
      if (!(vAny instanceof z.ZodOptional) && !(vAny instanceof z.ZodDefault)) {
        required.push(k);
      }
    }
    return { type: 'object', properties, ...(required.length ? { required } : {}) };
  }
  if (s instanceof z.ZodOptional) return zodToJsonSchema((s as any)._def.innerType);
  if (s instanceof z.ZodDefault) return zodToJsonSchema((s as any)._def.innerType);
  if (s instanceof z.ZodString) return { type: 'string' };
  if (s instanceof z.ZodNumber) return { type: 'number' };
  if (s instanceof z.ZodBoolean) return { type: 'boolean' };
  if (s instanceof z.ZodArray) return { type: 'array', items: zodToJsonSchema((s as any)._def.type) };
  if (s instanceof z.ZodEnum) return { type: 'string', enum: (s as any)._def.values };
  if (s instanceof z.ZodLiteral) return { const: (s as any)._def.value };
  if (s instanceof z.ZodUnion) return { anyOf: (s as any)._def.options.map(zodToJsonSchema) };
  if (s instanceof z.ZodAny) return {};
  return {};
}

// ============================================================
// Sign every decision (audit forensics)
// ============================================================

function signPayload(payload: unknown): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(payload) + (process.env.OPENAI_API_KEY?.slice(-4) || ''))
    .digest('hex');
}

// ============================================================
// Approval gate — used by tools that mutate state
// ============================================================

export async function requestApproval(
  ctx: ToolContext,
  action: string,
  target: any,
  rationale: string,
  risk: number
): Promise<{ id: number; status: 'pending' }> {
  const [decision] = await db
    .insert(cSuiteDecisions)
    .values({
      agentId: ctx.agentId,
      threadId: ctx.threadId,
      action,
      target,
      rationale,
      riskLevel: risk,
      status: 'pending',
      signatureSha256: signPayload({ action, target, agentId: ctx.agentId }),
    })
    .returning();
  await db.insert(cSuiteApprovals).values({
    decisionId: decision.id,
    requestedBy: ctx.agentId,
    summary: `${ctx.agentId} requests: ${action}`,
    riskScore: risk,
    expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
  });
  return { id: decision.id, status: 'pending' };
}

// ============================================================
// READ-ONLY TOOLS (autonomy 3)
// ============================================================

registerTool({
  id: 'queryPlatformOverview',
  description: 'High-level snapshot of the Boostify platform: total users, artists, songs, MRR estimate, recent signups, recent revenue.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async () => {
    const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(users);
    const [{ totalMerch }] = await db.select({ totalMerch: count() }).from(merchandise);
    const recent = await db
      .select({ id: users.id, email: users.email, createdAt: users.createdAt })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(5);
    return { totalUsers, totalMerchProducts: totalMerch, recentSignups: recent };
  },
});

registerTool({
  id: 'queryUsers',
  description: 'List or count users with optional filters.',
  schema: z.object({
    limit: z.number().min(1).max(100).optional(),
    role: z.enum(['artist', 'admin']).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'database',
  execute: async ({ limit = 25, role }) => {
    const where = role ? eq(users.role, role) : undefined;
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        artistName: users.artistName,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(where)
      .orderBy(desc(users.createdAt))
      .limit(limit);
    return { rows, count: rows.length };
  },
});

registerTool({
  id: 'queryRevenueSnapshot',
  description: 'Estimate revenue from merchandise + recent paid transactions in the last N days.',
  schema: z.object({ days: z.number().min(1).max(365).default(30) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async ({ days }) => {
    const since = new Date(Date.now() - days * 86400 * 1000);
    // Use raw SQL safely — we whitelist columns, no user input concatenation.
    const result = await db.execute(sql`
      SELECT 
        COALESCE(SUM(amount_total)/100.0, 0) AS revenue_usd,
        COUNT(*) AS tx_count
      FROM sales_transactions
      WHERE created_at >= ${since.toISOString()} AND status = 'completed'
    `).catch(() => ({ rows: [{ revenue_usd: 0, tx_count: 0 }] }));
    return { since: since.toISOString(), days, summary: (result as any).rows?.[0] || {} };
  },
});

registerTool({
  id: 'queryAgentHealth',
  description: 'Get health status of all C-Suite agents: active threads, recent errors, token usage, decisions pending.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'self',
  execute: async () => {
    const agents = await db.select().from(cSuiteAgents);
    const since24h = new Date(Date.now() - 86400 * 1000);
    const result: any[] = [];
    for (const a of agents) {
      const [threads] = await db
        .select({ c: count() })
        .from(cSuiteThreads)
        .where(and(eq(cSuiteThreads.agentId, a.id), eq(cSuiteThreads.status, 'active')));
      const [decisions] = await db
        .select({ c: count() })
        .from(cSuiteDecisions)
        .where(and(eq(cSuiteDecisions.agentId, a.id), gte(cSuiteDecisions.createdAt, since24h)));
      const [pending] = await db
        .select({ c: count() })
        .from(cSuiteDecisions)
        .where(and(eq(cSuiteDecisions.agentId, a.id), eq(cSuiteDecisions.status, 'pending')));
      result.push({
        id: a.id,
        name: a.name,
        active: a.active,
        autonomy: a.autonomy,
        dryRun: a.dryRun,
        activeThreads: threads.c,
        decisions24h: decisions.c,
        pendingApprovals: pending.c,
      });
    }
    return { agents: result };
  },
});

registerTool({
  id: 'recallMemory',
  description: 'Retrieve relevant past lessons / facts / decisions from this agent\'s long-term memory.',
  schema: z.object({ tags: z.array(z.string()).optional(), limit: z.number().default(10) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'meta',
  execute: async ({ tags, limit }, ctx) => {
    const rows = await db
      .select()
      .from(cSuiteMemory)
      .where(eq(cSuiteMemory.agentId, ctx.agentId))
      .orderBy(desc(cSuiteMemory.weight), desc(cSuiteMemory.createdAt))
      .limit(limit);
    const filtered = tags?.length
      ? rows.filter((r) => r.tags?.some((t) => tags.includes(t)))
      : rows;
    return { memories: filtered.map((m) => ({ id: m.id, kind: m.kind, content: m.content, tags: m.tags })) };
  },
});

// ============================================================
// META / AGENT-TO-AGENT TOOLS (autonomy 3)
// ============================================================

registerTool({
  id: 'remember',
  description: 'Persist a lesson, fact, or decision to long-term memory for this agent. Use sparingly for IMPORTANT learnings only.',
  schema: z.object({
    kind: z.enum(['lesson', 'fact', 'decision', 'feedback']),
    content: z.string().min(10).max(2000),
    tags: z.array(z.string()).optional(),
    weight: z.number().min(0).max(10).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: false,
  category: 'meta',
  execute: async ({ kind, content, tags, weight }, ctx) => {
    const [m] = await db
      .insert(cSuiteMemory)
      .values({ agentId: ctx.agentId, kind, content, tags, weight: weight ?? 1.0 })
      .returning();
    return { saved: true, id: m.id };
  },
});

registerTool({
  id: 'handoffTo',
  description: 'Hand off a question or task to another C-Suite agent. Returns their response. Use for cross-functional decisions.',
  schema: z.object({
    targetAgentId: z.string().describe("Target agent id e.g. 'cfo', 'cmo', 'cto'"),
    topic: z.string().min(5).max(200),
    context: z.string().min(10).max(4000),
  }),
  requiredAutonomy: 3,
  risk: 2,
  readOnly: false,
  category: 'meta',
  execute: async ({ targetAgentId, topic, context }, ctx) => {
    // Lazy import to avoid circular ref with runtime
    const { runAgentTurn } = await import('./runtime');
    const result = await runAgentTurn({
      agentId: targetAgentId,
      userMessage: `[handoff from ${ctx.agentId}] Topic: ${topic}\n\nContext:\n${context}`,
      parentThreadId: ctx.threadId,
      triggeredBy: `agent:${ctx.agentId}`,
      maxToolCalls: 8,
    });
    return { from: targetAgentId, response: result.finalText, threadId: result.threadId };
  },
});

// ============================================================
// GOALS TOOLS
// ============================================================

registerTool({
  id: 'createGoal',
  description: 'Create a new OKR / goal for an agent.',
  schema: z.object({
    scope: z.enum(['company', 'department', 'key_result']),
    ownerAgent: z.string(),
    parentId: z.number().optional(),
    title: z.string().min(5).max(200),
    metric: z.string().min(2).max(60),
    targetValue: z.number(),
    baseline: z.number().optional(),
    periodEnd: z.string().optional(),
  }),
  requiredAutonomy: 2,
  risk: 2,
  readOnly: false,
  category: 'goals',
  execute: async (input, ctx) => {
    if (ctx.dryRun) return { dryRun: true, would: input };
    const [g] = await db
      .insert(cSuiteGoals)
      .values({
        scope: input.scope,
        ownerAgent: input.ownerAgent,
        parentId: input.parentId,
        title: input.title,
        metric: input.metric,
        targetValue: String(input.targetValue),
        baseline: input.baseline != null ? String(input.baseline) : undefined,
        periodEnd: input.periodEnd ? new Date(input.periodEnd) : undefined,
        status: 'on_track',
      })
      .returning();
    return { created: true, goalId: g.id };
  },
});

registerTool({
  id: 'listGoals',
  description: 'List goals optionally filtered by owner or status.',
  schema: z.object({
    ownerAgent: z.string().optional(),
    status: z.enum(['draft', 'on_track', 'at_risk', 'off_track', 'achieved', 'missed']).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'goals',
  execute: async ({ ownerAgent, status }) => {
    const filters: any[] = [];
    if (ownerAgent) filters.push(eq(cSuiteGoals.ownerAgent, ownerAgent));
    if (status) filters.push(eq(cSuiteGoals.status, status));
    const rows = await db
      .select()
      .from(cSuiteGoals)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(cSuiteGoals.createdAt))
      .limit(50);
    return { goals: rows };
  },
});

registerTool({
  id: 'checkInOnGoal',
  description: 'Record a daily check-in on a goal, updating its current value and status.',
  schema: z.object({
    goalId: z.number(),
    measured: z.number(),
    notes: z.string().min(10).max(2000),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: false,
  category: 'goals',
  execute: async ({ goalId, measured, notes }, ctx) => {
    const [goal] = await db.select().from(cSuiteGoals).where(eq(cSuiteGoals.id, goalId)).limit(1);
    if (!goal) return { error: 'goal not found' };
    const target = Number(goal.targetValue);
    const baseline = goal.baseline != null ? Number(goal.baseline) : 0;
    const denom = target - baseline || target || 1;
    const progress = (measured - baseline) / denom;
    let status: typeof goal.status = goal.status;
    if (progress >= 1) status = 'achieved';
    else if (progress >= 0.7) status = 'on_track';
    else if (progress >= 0.4) status = 'at_risk';
    else status = 'off_track';
    const prev = goal.currentValue != null ? Number(goal.currentValue) : baseline;
    await db.insert(cSuiteGoalCheckins).values({
      goalId,
      agentId: ctx.agentId,
      measured: String(measured),
      delta: String(measured - prev),
      notes,
    });
    if (!ctx.dryRun) {
      await db.update(cSuiteGoals)
        .set({ currentValue: String(measured), status, updatedAt: new Date() })
        .where(eq(cSuiteGoals.id, goalId));
    }
    return { goalId, progress: Math.round(progress * 100) / 100, status, dryRun: ctx.dryRun };
  },
});

// ============================================================
// SELF-IMPROVEMENT TOOLS — used by the system to heal itself
// ============================================================

registerTool({
  id: 'reportSelfImprovement',
  description: 'File a self-detected issue (bug, slow tool, drifting metric, agent quality issue) into the self-improvement log.',
  schema: z.object({
    category: z.enum(['bug', 'performance', 'cost', 'goal_drift', 'agent_quality', 'tool_failure', 'security', 'ux']),
    severity: z.number().min(1).max(5),
    title: z.string().min(5).max(200),
    description: z.string().max(4000).optional(),
    evidence: z.any().optional(),
    proposedFix: z.string().min(5).max(2000).optional(),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: false,
  category: 'self',
  execute: async (input, ctx) => {
    const [row] = await db.insert(cSuiteSelfImprovement).values({
      detectedBy: ctx.agentId,
      category: input.category,
      severity: input.severity,
      title: input.title,
      description: input.description,
      evidence: input.evidence,
      proposedFix: input.proposedFix,
      status: input.proposedFix ? 'proposed' : 'detected',
    }).returning();
    return { filed: true, id: row.id, status: row.status };
  },
});

registerTool({
  id: 'runSelfDiagnostics',
  description: 'Run a full diagnostics sweep: failed tool calls, stuck threads, cost spikes, off-track goals. Returns issues found.',
  schema: z.object({}),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'self',
  execute: async () => {
    const since24h = new Date(Date.now() - 86400 * 1000);
    const issues: any[] = [];

    // Stuck threads
    const stuck = await db.select({ c: count() }).from(cSuiteThreads)
      .where(and(eq(cSuiteThreads.status, 'active'),
        sql`created_at < ${new Date(Date.now() - 4 * 3600 * 1000).toISOString()}`));
    if (stuck[0]?.c > 0) {
      issues.push({ category: 'performance', title: `${stuck[0].c} threads stuck > 4h`, severity: 3 });
    }

    // Failed tool calls
    const failed = await db.execute(sql`
      SELECT tool_name, COUNT(*) AS c
      FROM c_suite_messages
      WHERE role = 'tool' AND created_at >= ${since24h.toISOString()}
        AND tool_result::text ILIKE '%error%'
      GROUP BY tool_name
      ORDER BY c DESC
      LIMIT 5
    `).catch(() => ({ rows: [] }));
    for (const row of (failed as any).rows || []) {
      if (row.c >= 3) {
        issues.push({ category: 'tool_failure', title: `Tool ${row.tool_name} failed ${row.c}x in 24h`, severity: 4 });
      }
    }

    // Off-track goals
    const offtrack = await db
      .select()
      .from(cSuiteGoals)
      .where(eq(cSuiteGoals.status, 'off_track'));
    for (const g of offtrack) {
      issues.push({ category: 'goal_drift', title: `Goal off-track: ${g.title}`, severity: 4, evidence: { goalId: g.id } });
    }

    // Cost spike: total tokens last 24h
    const cost24h = await db.execute(sql`
      SELECT COALESCE(SUM(cost_usd),0) AS total
      FROM c_suite_messages
      WHERE created_at >= ${since24h.toISOString()}
    `).catch(() => ({ rows: [{ total: 0 }] }));
    const totalUsd = Number((cost24h as any).rows?.[0]?.total ?? 0);
    if (totalUsd > 30) {
      issues.push({ category: 'cost', title: `High spend last 24h: $${totalUsd.toFixed(2)}`, severity: 4 });
    }

    return { ranAt: new Date().toISOString(), issuesFound: issues.length, issues };
  },
});

registerTool({
  id: 'proposeAgentTuning',
  description: 'Propose a tuning change to an agent\'s persona, model, or autonomy. Always queues for human approval.',
  schema: z.object({
    targetAgentId: z.string(),
    field: z.enum(['persona', 'model', 'autonomy', 'budgetUsdDaily']),
    newValue: z.union([z.string(), z.number()]),
    rationale: z.string().min(20).max(2000),
  }),
  requiredAutonomy: 2,
  humanRequired: true,
  risk: 6,
  readOnly: false,
  category: 'self',
  execute: async (input, ctx) => {
    return await requestApproval(ctx, 'proposeAgentTuning', input, input.rationale, 6);
  },
  performApproved: async (input) => {
    const patch: Record<string, any> = {};
    if (input.field === 'autonomy') patch.autonomy = Math.min(Math.max(Number(input.newValue) || 1, 1), 3);
    else if (input.field === 'budgetUsdDaily') patch.budgetUsdDaily = String(Number(input.newValue) || 1);
    else patch[input.field] = String(input.newValue);
    await db.update(cSuiteAgents).set(patch).where(eq(cSuiteAgents.id, input.targetAgentId));
    return { applied: true, agentId: input.targetAgentId, field: input.field };
  },
});

// ============================================================
// PLATFORM ACTIONS (always HITL)
// ============================================================

registerTool({
  id: 'pauseUser',
  description: 'Suspend a user account. Always requires admin approval.',
  schema: z.object({ userId: z.number(), reason: z.string().min(10).max(500) }),
  requiredAutonomy: 1,
  humanRequired: true,
  risk: 8,
  readOnly: false,
  category: 'platform',
  execute: async (input, ctx) => {
    return await requestApproval(ctx, 'pauseUser', input, input.reason, 8);
  },
  performApproved: async (input, ctx) => {
    // No hard "suspended" column exists on users — record the sanctioned
    // suspension in agent memory as an auditable directive for ops.
    await db.insert(cSuiteMemory).values({
      agentId: ctx.agentId,
      kind: 'decision',
      content: `[APPROVED] Suspend user ${input.userId}: ${input.reason}. Apply in Clerk dashboard (ban) — no automated suspension column exists yet.`,
      tags: ['suspension', 'approved', 'manual-action'],
      weight: 5,
    });
    return { recorded: true, userId: input.userId, note: 'Suspension approved & logged. Manual Clerk ban still required.' };
  },
});

registerTool({
  id: 'publishNews',
  description: 'Publish a news article on Boostify News (real publication after admin approval). Body supports plain paragraphs separated by blank lines.',
  schema: z.object({
    title: z.string().min(10).max(140),
    body: z.string().min(50).max(8000),
    tags: z.array(z.string()).optional(),
  }),
  requiredAutonomy: 2,
  humanRequired: true,
  risk: 4,
  readOnly: false,
  category: 'marketing',
  execute: async (input, ctx) => {
    return await requestApproval(ctx, 'publishNews', input, `Article: ${input.title}`, 4);
  },
  performApproved: async (input, ctx) => {
    const slugBase = input.title.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const slug = `${slugBase}-${Date.now().toString(36)}`;
    const htmlContent = input.body
      .split(/\n{2,}/)
      .map((p) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`)
      .join('\n');
    const [article] = await db.insert(newsArticles).values({
      slug,
      title: input.title,
      summary: input.body.slice(0, 280),
      htmlContent,
      category: 'platform-updates',
      tags: input.tags || ['c-suite'],
      status: 'published',
      publishedAt: new Date(),
      generatedBy: `c-suite:${ctx.agentId}`,
      aiModel: 'glm-5.2',
    }).returning({ id: newsArticles.id, slug: newsArticles.slug });
    return { published: true, articleId: article.id, slug: article.slug, url: `/news/${article.slug}` };
  },
});

registerTool({
  id: 'broadcastDirective',
  description: 'CEO only. Broadcast a strategic directive to all C-level agents. They will incorporate it into their next planning cycle.',
  schema: z.object({ directive: z.string().min(20).max(4000) }),
  requiredAutonomy: 2,
  risk: 3,
  readOnly: false,
  category: 'meta',
  execute: async ({ directive }, ctx) => {
    if (ctx.agentId !== 'ceo') return { error: 'Only CEO may broadcast directives' };
    if (ctx.dryRun) return { dryRun: true, directive };
    // Persist as a high-weight memory for ALL agents
    const all = await db.select({ id: cSuiteAgents.id }).from(cSuiteAgents);
    for (const a of all) {
      if (a.id === 'ceo') continue;
      await db.insert(cSuiteMemory).values({
        agentId: a.id,
        kind: 'fact',
        content: `[CEO Directive] ${directive}`,
        weight: 5.0,
        tags: ['directive', 'ceo'],
      });
    }
    return { broadcasted: true, recipients: all.length - 1 };
  },
});

// ============================================================
// GROWTH & INVESTOR ACQUISITION TOOLS — the agents' real work
// ============================================================

registerTool({
  id: 'queryGrowthFunnel',
  description: 'User acquisition funnel: signups (current vs previous period), daily signup series, cold outreach performance (sent/opened/replied 30d) and investor lead count.',
  schema: z.object({ days: z.number().min(1).max(90).default(30) }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'marketing',
  execute: async ({ days }) => {
    const since = new Date(Date.now() - days * 86400 * 1000);
    const prevSince = new Date(Date.now() - 2 * days * 86400 * 1000);
    const [{ current }] = await db.select({ current: count() }).from(users)
      .where(gte(users.createdAt, since));
    const [{ previous }] = await db.select({ previous: count() }).from(users)
      .where(and(gte(users.createdAt, prevSince), sql`${users.createdAt} < ${since.toISOString()}`));
    const daily = await db.execute(sql`
      SELECT DATE(created_at) AS day, COUNT(*) AS signups
      FROM users WHERE created_at >= ${new Date(Date.now() - 14 * 86400 * 1000).toISOString()}
      GROUP BY 1 ORDER BY 1 DESC LIMIT 14
    `).catch(() => ({ rows: [] }));
    const outreach = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','delivered','opened','clicked','replied')) AS sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE replied_at IS NOT NULL) AS replied
      FROM outreach_email_log
      WHERE created_at >= ${new Date(Date.now() - 30 * 86400 * 1000).toISOString()}
    `).catch(() => ({ rows: [{ sent: 0, opened: 0, replied: 0 }] }));
    const [{ investorLeads }] = await db.select({ investorLeads: count() }).from(investorFeedback)
      .where(gte(investorFeedback.createdAt, since));
    return {
      periodDays: days,
      signups: { current, previous, trendPct: previous ? Math.round(((current - previous) / previous) * 100) : null },
      dailySignups14d: (daily as any).rows || [],
      outreach30d: (outreach as any).rows?.[0] || {},
      investorLeadsInPeriod: investorLeads,
    };
  },
});

registerTool({
  id: 'queryInvestorLeads',
  description: 'List investor leads captured via the Investor Room and agent outreach: name, email, company, type, interest level, viewpoints.',
  schema: z.object({
    interestLevel: z.enum(['low', 'medium', 'high']).optional(),
    limit: z.number().min(1).max(100).default(25),
  }),
  requiredAutonomy: 3,
  risk: 1,
  readOnly: true,
  category: 'finance',
  execute: async ({ interestLevel, limit }) => {
    const rows = await db.select({
      id: investorFeedback.id,
      name: investorFeedback.name,
      email: investorFeedback.email,
      company: investorFeedback.company,
      investorType: investorFeedback.investorType,
      interestLevel: investorFeedback.interestLevel,
      viewpoints: investorFeedback.viewpoints,
      createdAt: investorFeedback.createdAt,
    }).from(investorFeedback)
      .where(interestLevel ? eq(investorFeedback.interestLevel, interestLevel) : undefined)
      .orderBy(desc(investorFeedback.createdAt))
      .limit(limit);
    return { leads: rows, count: rows.length };
  },
});

registerTool({
  id: 'recordInvestorLead',
  description: 'Register a new investor lead in the pipeline (name, email, company, interest). Use when you identify or qualify a potential investor.',
  schema: z.object({
    name: z.string().min(2).max(120),
    email: z.string().min(5).max(200),
    company: z.string().max(160).optional(),
    investorType: z.enum(['individual', 'corporate', 'institutional', 'other']).default('individual'),
    interestLevel: z.enum(['low', 'medium', 'high']).default('medium'),
    notes: z.string().min(10).max(4000).describe('Qualification notes: thesis fit, check size, stage, next step.'),
  }),
  requiredAutonomy: 2,
  risk: 2,
  readOnly: false,
  category: 'finance',
  execute: async (input, ctx) => {
    if (ctx.dryRun) return { dryRun: true, would: input };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) return { error: 'invalid_email' };
    const [lead] = await db.insert(investorFeedback).values({
      name: input.name,
      email: input.email.toLowerCase(),
      company: input.company,
      investorType: input.investorType,
      interestLevel: input.interestLevel,
      viewpoints: input.notes,
      userAgent: `c-suite:${ctx.agentId}`,
    }).returning({ id: investorFeedback.id });
    return { recorded: true, leadId: lead.id };
  },
});

registerTool({
  id: 'sendOutreachEmail',
  description: 'Send a REAL outreach email (user acquisition, investor relations, partnerships). Always requires admin approval before sending. Body is plain text; paragraphs separated by blank lines.',
  schema: z.object({
    to: z.string().min(5).max(200),
    subject: z.string().min(5).max(150),
    body: z.string().min(50).max(6000),
    purpose: z.enum(['user_acquisition', 'investor_relations', 'partnership', 'retention']),
  }),
  requiredAutonomy: 2,
  humanRequired: true,
  risk: 7,
  readOnly: false,
  category: 'marketing',
  execute: async (input, ctx) => {
    return await requestApproval(ctx, 'sendOutreachEmail', input, `${input.purpose} → ${input.to}: ${input.subject}`, 7);
  },
  performApproved: async (input, ctx) => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.to)) return { error: 'invalid_email' };
    const { sendOutreachEmail } = await import('../artist-activation/outreach-email');
    const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;line-height:1.6;max-width:600px;margin:0 auto;padding:24px;">${
      input.body.split(/\n{2,}/).map((p) => `<p>${p.trim().replace(/\n/g, '<br/>')}</p>`).join('')
    }<p style="color:#888;font-size:12px;margin-top:32px;">Boostify Music · boostifymusic.com</p></body></html>`;
    const result = await sendOutreachEmail(input.to, input.subject, html);
    await db.insert(cSuiteMemory).values({
      agentId: ctx.agentId,
      kind: 'decision',
      content: `[outreach:${input.purpose}] ${result.success ? 'SENT' : 'FAILED'} → ${input.to} · "${input.subject}"${result.success ? '' : ` · error: ${result.error}`}`,
      tags: ['outreach', input.purpose],
      weight: 2,
    });
    return { sent: result.success, provider: (result as any).provider, error: (result as any).error };
  },
});

// ============================================================
// TOOL SETS PER ROLE
// ============================================================

const ARTIST_READ_TOOLS = [
  'queryArtistOverview', 'queryArtistSongStats', 'queryArtistMerchPerformance',
  'queryArtistFanMetrics', 'queryArtistTreasury', 'queryArtistMonetizationFunnel',
  'queryTopArtistsByRevenue', 'queryAtRiskArtists', 'listArtistRecommendations',
];

export const TOOL_SETS: Record<string, string[]> = {
  ceo: [
    'queryPlatformOverview', 'queryRevenueSnapshot', 'queryAgentHealth',
    'listGoals', 'createGoal', 'broadcastDirective',
    'handoffTo', 'remember', 'recallMemory',
    'runSelfDiagnostics', 'reportSelfImprovement', 'proposeAgentTuning',
    'queryArtistOverview', 'queryTopArtistsByRevenue', 'queryAtRiskArtists',
    'recommendArtistStrategy',
    'queryGrowthFunnel', 'queryInvestorLeads', 'recordInvestorLead', 'sendOutreachEmail',
  ],
  cmo: [
    'queryPlatformOverview', 'queryUsers',
    'listGoals', 'checkInOnGoal', 'createGoal',
    'publishNews',
    'handoffTo', 'remember', 'recallMemory',
    'queryArtistFanMetrics', 'queryArtistOverview', 'recommendArtistStrategy',
    'queryGrowthFunnel', 'sendOutreachEmail',
  ],
  cro: [
    'queryPlatformOverview', 'queryUsers',
    'listGoals', 'checkInOnGoal', 'createGoal',
    'handoffTo', 'remember', 'recallMemory',
    'queryArtistMerchPerformance', 'queryTopArtistsByRevenue',
    'queryArtistMonetizationFunnel', 'recommendArtistStrategy',
    'queryGrowthFunnel', 'queryInvestorLeads', 'sendOutreachEmail',
  ],
  cpo: [
    'queryPlatformOverview', 'queryUsers',
    'listGoals', 'checkInOnGoal',
    'handoffTo', 'remember', 'recallMemory',
    'queryArtistOverview', 'queryAtRiskArtists', 'queryArtistSongStats',
  ],
  cfo: [
    'queryPlatformOverview', 'queryRevenueSnapshot',
    'listGoals', 'checkInOnGoal', 'createGoal',
    'handoffTo', 'remember', 'recallMemory',
    'queryArtistTreasury', 'queryArtistMonetizationFunnel', 'queryTopArtistsByRevenue',
    'queryInvestorLeads', 'recordInvestorLead', 'sendOutreachEmail',
  ],
  coo: [
    'queryPlatformOverview', 'queryAgentHealth',
    'listGoals', 'checkInOnGoal',
    'handoffTo', 'remember', 'recallMemory',
    'queryAtRiskArtists', 'queryArtistOverview', 'recommendArtistStrategy',
  ],
  cto: [
    'queryAgentHealth', 'runSelfDiagnostics', 'reportSelfImprovement',
    'proposeAgentTuning',
    'handoffTo', 'remember', 'recallMemory',
  ],
  clo: [
    'queryUsers', 'pauseUser',
    'handoffTo', 'remember', 'recallMemory',
  ],
  cdo: [
    'queryPlatformOverview', 'queryRevenueSnapshot', 'queryUsers',
    'listGoals', 'checkInOnGoal',
    'handoffTo', 'remember', 'recallMemory',
    'queryGrowthFunnel', 'queryInvestorLeads',
    ...ARTIST_READ_TOOLS,
  ],
  ciso: [
    'queryUsers', 'pauseUser',
    'runSelfDiagnostics', 'reportSelfImprovement',
    'handoffTo', 'remember', 'recallMemory',
  ],
};

// Auto-load artist-scoped tools (registers via side-effect import).
// Use fire-and-forget to avoid circular top-level-await deadlock with
// artist-tools.ts (which imports registerTool from this file).
import('./artist-tools').catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[c-suite] failed to load artist-tools:', e);
});
