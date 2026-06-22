/**
 * C-Suite AI · Runtime
 *
 * Executes a single agent turn:
 *   1. Build messages (system persona + recent thread + user input).
 *   2. Call OpenAI Chat Completions with the agent's tool set.
 *   3. If model emits tool_calls → execute each via the registry, append
 *      tool result, loop until model returns plain text or maxToolCalls hit.
 *   4. Persist every message + costs + decision logs.
 *   5. Stream events (token-by-token + tool calls) to a listener if present.
 *
 * Safety:
 *   - kill_switch in c_suite_settings → throws immediately.
 *   - dryRun + readOnly checks in tools.
 *   - autonomy gate before every tool execution.
 *   - max tool calls per thread (default 10).
 */

import { db } from '../../db';
import {
  cSuiteAgents,
  cSuiteThreads,
  cSuiteMessages,
  cSuiteSettings,
  cSuiteMemory,
} from '../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { getTool, toolsToOpenAI, type ToolContext } from './tools';
import { EventEmitter } from 'events';
import { ZAI_API_KEY, ZAI_BASE_URL, isZaiConfigured } from '../../utils/ai-config';

// Single shared OpenAI client. Use existing tracked variant if available.
let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) {
    _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _client;
}

// z.ai (Zhipu GLM) client — OpenAI-compatible. GLM-5.2 is the flagship primary
// model for the C-Suite; OpenAI is kept as automatic fallback.
const GLM_FLAGSHIP = 'glm-5.2';
let _zaiClient: OpenAI | null = null;
function zaiClient(): OpenAI | null {
  if (!isZaiConfigured()) return null;
  if (!_zaiClient) {
    _zaiClient = new OpenAI({ apiKey: ZAI_API_KEY, baseURL: ZAI_BASE_URL });
  }
  return _zaiClient;
}

/**
 * Resilient chat completion for C-Suite agents.
 * PRIMARY: z.ai GLM-5.2 (flagship). FALLBACK: OpenAI with the agent's configured model.
 * Tool/function calling is preserved across both providers.
 */
async function createAgentCompletion(
  agentModel: string,
  params: { messages: any[]; tools?: any; tool_choice?: any; temperature?: number },
) {
  const zai = zaiClient();
  if (zai) {
    try {
      const completion = await zai.chat.completions.create({ model: GLM_FLAGSHIP, ...params });
      if (completion?.choices?.length) return completion;
    } catch (err: any) {
      console.warn('[C-Suite] GLM-5.2 primary failed, falling back to OpenAI:', err?.message || err);
    }
  }
  return client().chat.completions.create({ model: agentModel || 'gpt-4o-mini', ...params });
}

// Pricing table (USD per 1M tokens). Update as needed.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o':       { in: 2.5,  out: 10.0 },
  'gpt-4o-mini':  { in: 0.15, out: 0.60 },
  'gpt-4.1':      { in: 2.0,  out: 8.0 },
  'gpt-4.1-mini': { in: 0.4,  out: 1.6 },
  'glm-5.2':      { in: 1.4,  out: 4.4 },
  'glm-4.6':      { in: 0.6,  out: 2.2 },
  'glm-4.5-flash':{ in: 0.0,  out: 0.0 },
  'glm-4.5-air':  { in: 0.2,  out: 1.1 },
};
function estimateCost(model: string, inT: number, outT: number): number {
  const p = PRICING[model] || PRICING['gpt-4o-mini'];
  return (inT * p.in + outT * p.out) / 1_000_000;
}

// Global event bus — UI subscribes via SSE.
export const runtimeEvents = new EventEmitter();
runtimeEvents.setMaxListeners(50);

// ---------- Settings & kill switch ----------

async function loadSettings() {
  const [row] = await db.select().from(cSuiteSettings).limit(1);
  if (row) return row;
  const [created] = await db.insert(cSuiteSettings).values({}).returning();
  return created;
}

// ---------- Public API ----------

export interface RunArgs {
  agentId: string;
  userMessage: string;
  parentThreadId?: number;
  triggeredBy?: string;
  maxToolCalls?: number;
  adminEmail?: string;
}

export interface RunResult {
  threadId: number;
  finalText: string;
  toolCalls: number;
  totalCostUsd: number;
}

export async function runAgentTurn(args: RunArgs): Promise<RunResult> {
  const settings = await loadSettings();
  if (settings.killSwitch) {
    throw new Error('C-Suite kill switch is ON. All agents are paused.');
  }

  const [agent] = await db.select().from(cSuiteAgents).where(eq(cSuiteAgents.id, args.agentId)).limit(1);
  if (!agent) throw new Error(`Agent not found: ${args.agentId}`);
  if (!agent.active) throw new Error(`Agent ${args.agentId} is not active.`);

  // ---- Budget guard: check daily spend for this agent ----
  const since24h = new Date(Date.now() - 86400 * 1000);
  const [spent24h] = await db.select({
    sum: sql<string>`COALESCE(SUM(cost_usd),0)::text`
  }).from(cSuiteMessages)
    .innerJoin(cSuiteThreads, eq(cSuiteMessages.threadId, cSuiteThreads.id))
    .where(and(
      eq(cSuiteThreads.agentId, agent.id),
      sql`${cSuiteMessages.createdAt} >= ${since24h.toISOString()}`,
    ));
  const spent = Number(spent24h?.sum || 0);
  const budget = Number(agent.budgetUsdDaily || 0);
  if (budget > 0 && spent >= budget) {
    throw new Error(`Agent ${agent.id} hit daily budget: $${spent.toFixed(2)}/$${budget.toFixed(2)}. Increase budget or wait.`);
  }

  const dryRun = settings.globalDryRun || agent.dryRun;
  const maxToolCalls = args.maxToolCalls ?? 10;
  const turnDeadline = Date.now() + 5 * 60 * 1000; // 5 min hard limit per turn

  // Create thread
  const [thread] = await db.insert(cSuiteThreads).values({
    agentId: agent.id,
    parentId: args.parentThreadId ?? null,
    topic: args.userMessage.slice(0, 120),
    triggeredBy: args.triggeredBy ?? 'admin',
    status: 'active',
  }).returning();

  // Recall top long-term memories (weight DESC, limit 5)
  const memories = await db.select().from(cSuiteMemory)
    .where(eq(cSuiteMemory.agentId, agent.id))
    .orderBy(desc(cSuiteMemory.weight), desc(cSuiteMemory.createdAt))
    .limit(5);
  const memoryBlock = memories.length
    ? `\n\nRELEVANT MEMORIES:\n${memories.map((m) => `- [${m.kind}] ${m.content}`).join('\n')}`
    : '';

  const systemMsg = agent.persona + memoryBlock + `\n\nCURRENT CONTEXT:\n- agent_id: ${agent.id}\n- dry_run: ${dryRun}\n- autonomy_level: ${agent.autonomy}`;

  await db.insert(cSuiteMessages).values({
    threadId: thread.id,
    role: 'system',
    content: systemMsg,
    model: agent.model,
  });
  await db.insert(cSuiteMessages).values({
    threadId: thread.id,
    role: 'user',
    content: args.userMessage,
  });

  runtimeEvents.emit('event', {
    type: 'thread_started',
    threadId: thread.id,
    agentId: agent.id,
    userMessage: args.userMessage,
  });

  // Build OpenAI messages array
  const conversation: any[] = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: args.userMessage },
  ];

  let toolCallCount = 0;
  let totalCost = 0;
  let finalText = '';
  const openaiTools = toolsToOpenAI(agent.tools as string[] || []);

  for (let iter = 0; iter < 6; iter++) {
    if (Date.now() > turnDeadline) {
      finalText = '⚠️ Turn deadline (5 min) exceeded — terminating.';
      break;
    }
    const completion = await createAgentCompletion(agent.model, {
      messages: conversation,
      tools: openaiTools.length ? openaiTools : undefined,
      tool_choice: openaiTools.length ? 'auto' : undefined,
      temperature: 0.4,
    });

    const choice = completion.choices[0];
    const usage = completion.usage;
    const stepCost = estimateCost(
      completion.model || agent.model,
      usage?.prompt_tokens || 0,
      usage?.completion_tokens || 0
    );
    totalCost += stepCost;

    // Persist assistant turn
    await db.insert(cSuiteMessages).values({
      threadId: thread.id,
      role: 'assistant',
      content: choice.message.content || null,
      tokensIn: usage?.prompt_tokens || 0,
      tokensOut: usage?.completion_tokens || 0,
      costUsd: String(stepCost),
      model: completion.model,
    });

    runtimeEvents.emit('event', {
      type: 'assistant_message',
      threadId: thread.id,
      agentId: agent.id,
      content: choice.message.content || '',
      toolCallsRequested: choice.message.tool_calls?.length ?? 0,
    });

    // No tool calls? we're done.
    if (!choice.message.tool_calls?.length) {
      finalText = choice.message.content || '';
      conversation.push({ role: 'assistant', content: finalText });
      break;
    }

    // Execute tool calls in order
    conversation.push({
      role: 'assistant',
      content: choice.message.content,
      tool_calls: choice.message.tool_calls,
    });

    for (const tc of choice.message.tool_calls) {
      toolCallCount++;
      if (toolCallCount > maxToolCalls) {
        conversation.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: JSON.stringify({ error: 'max tool calls exceeded' }),
        });
        continue;
      }

      const tool = getTool(tc.function.name);
      let result: any;
      if (!tool) {
        result = { error: `unknown tool: ${tc.function.name}` };
      } else if (tool.requiredAutonomy > agent.autonomy) {
        result = { error: `tool ${tool.id} requires autonomy >= ${tool.requiredAutonomy}, agent has ${agent.autonomy}` };
      } else {
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          const parsed = tool.schema.safeParse(args);
          if (!parsed.success) {
            result = { error: 'schema_validation_failed', details: parsed.error.format() };
          } else {
            const ctx: ToolContext = {
              agentId: agent.id,
              threadId: thread.id,
              dryRun,
              autonomy: agent.autonomy,
            };
            // human_required short-circuits to approval gate
            if (tool.humanRequired) {
              const { requestApproval } = await import('./tools');
              result = await requestApproval(ctx, tool.id, parsed.data, `Auto-requested by ${agent.id}`, tool.risk);
            } else if (dryRun && !tool.readOnly) {
              result = { dryRun: true, would: parsed.data };
            } else {
              result = await tool.execute(parsed.data, ctx);
            }
          }
        } catch (err: any) {
          result = { error: err.message };
        }
      }

      await db.insert(cSuiteMessages).values({
        threadId: thread.id,
        role: 'tool',
        content: null,
        toolName: tc.function.name,
        toolArgs: tryParse(tc.function.arguments),
        toolResult: result,
      });
      runtimeEvents.emit('event', {
        type: 'tool_call',
        threadId: thread.id,
        agentId: agent.id,
        toolName: tc.function.name,
        result,
      });

      conversation.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result).slice(0, 12_000),
      });
    }

    if (toolCallCount > maxToolCalls) break;
  }

  await db.update(cSuiteThreads)
    .set({ status: 'done', finishedAt: new Date() })
    .where(eq(cSuiteThreads.id, thread.id));

  runtimeEvents.emit('event', {
    type: 'thread_finished',
    threadId: thread.id,
    agentId: agent.id,
    finalText,
    totalCostUsd: totalCost,
  });

  return {
    threadId: thread.id,
    finalText,
    toolCalls: toolCallCount,
    totalCostUsd: totalCost,
  };
}

function tryParse(s?: string) {
  try { return JSON.parse(s || '{}'); } catch { return s; }
}

// ---------- Seed ----------

export async function seedAgentsIfMissing() {
  const { AGENT_SEEDS } = await import('./agents');
  const existing = await db.select({ id: cSuiteAgents.id }).from(cSuiteAgents);
  const existingIds = new Set(existing.map((r) => r.id));
  for (const seed of AGENT_SEEDS) {
    if (existingIds.has(seed.id)) continue;
    await db.insert(cSuiteAgents).values({
      id: seed.id,
      name: seed.name,
      role: seed.role,
      model: seed.model,
      autonomy: seed.autonomy,
      active: false, // SAFE DEFAULT
      dryRun: true,  // SAFE DEFAULT
      persona: seed.persona,
      tools: seed.tools,
      escalatesTo: seed.escalatesTo,
      budgetUsdDaily: seed.budgetUsdDaily,
    });
  }
  // Ensure settings row exists
  await loadSettings();
}
