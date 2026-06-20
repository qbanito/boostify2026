/**
 * Artist Career Suite — Runtime
 *
 * Mirrors `server/services/c-suite/runtime.ts` but every read/write
 * targets the `artist_suite_*` tables and is scoped by `artistId`.
 *
 * Two session types:
 *   - 'personal'  → uses an agent row from artist_suite_agents
 *                   (one of: manager / marketing / ar / merch / finance)
 *   - 'corporate' → reuses the persona of an existing c_suite_agents
 *                   row (ceo, cfo, etc.) but isolates the conversation
 *                   inside artist_suite_threads/messages so the artist's
 *                   data never leaks into admin dashboards.
 *
 * Safety:
 *   - Subscription must be 'approved' or 'active'.
 *   - Per-artist kill switch (artist_suite_settings.kill_switch).
 *   - dryRun defaults to TRUE for personal agents.
 *   - Daily $ budget enforced per artist.
 */

import { db } from '../../db';
import {
  artistSuiteSubscriptions,
  artistSuiteAgents,
  artistSuiteThreads,
  artistSuiteMessages,
  artistSuiteSettings,
  artistSuiteMemory,
  cSuiteAgents,
} from '../../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import OpenAI from 'openai';
import { getTool, toolsToOpenAI, type ToolContext } from '../c-suite/tools';
// Side-effect import: registers artist-scoped tools (queryArtistOverview, etc.)
import './artist-tools';
import { EventEmitter } from 'events';
import { CORPORATE_AGENT_KEYS, type ArtistAgentKey } from './agent-presets';

let _client: OpenAI | null = null;
function client(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return _client;
}

// Pricing (USD per 1M tokens). Keep in sync with c-suite/runtime.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o':       { in: 2.5,  out: 10.0 },
  'gpt-4o-mini':  { in: 0.15, out: 0.60 },
  'gpt-4.1':      { in: 2.0,  out: 8.0 },
  'gpt-4.1-mini': { in: 0.4,  out: 1.6 },
};
function estimateCost(model: string, inT: number, outT: number) {
  const p = PRICING[model] || PRICING['gpt-4o-mini'];
  return (inT * p.in + outT * p.out) / 1_000_000;
}

// Per-artist event bus — UI subscribes via SSE keyed by artistId.
export const artistRuntimeEvents = new EventEmitter();
artistRuntimeEvents.setMaxListeners(200);

async function loadArtistSettings(artistId: string) {
  const [row] = await db
    .select()
    .from(artistSuiteSettings)
    .where(eq(artistSuiteSettings.artistId, artistId))
    .limit(1);
  if (row) return row;
  const [created] = await db
    .insert(artistSuiteSettings)
    .values({ artistId })
    .returning();
  return created;
}

async function loadSubscription(artistId: string) {
  const [sub] = await db
    .select()
    .from(artistSuiteSubscriptions)
    .where(eq(artistSuiteSubscriptions.artistId, artistId))
    .limit(1);
  return sub;
}

export interface ArtistRunArgs {
  artistId: string;
  agentKey: ArtistAgentKey;
  sessionType: 'personal' | 'corporate';
  userMessage: string;
  parentThreadId?: number;
  triggeredBy?: string;
  maxToolCalls?: number;
  artistEmail?: string;
  /** Allow admin override (skip subscription gate). Set by admin endpoints only. */
  adminOverride?: boolean;
}

export interface ArtistRunResult {
  threadId: number;
  finalText: string;
  toolCalls: number;
  totalCostUsd: number;
}

export async function runArtistAgentTurn(args: ArtistRunArgs): Promise<ArtistRunResult> {
  // ---- Gate: subscription approved? ----
  if (!args.adminOverride) {
    const sub = await loadSubscription(args.artistId);
    if (!sub) {
      throw new Error('No Artist Career Suite subscription. Activate it from the module first.');
    }
    if (sub.status !== 'approved' && sub.status !== 'active') {
      throw new Error(`Artist Career Suite is ${sub.status}. Wait for admin approval.`);
    }
    if (args.sessionType === 'corporate' && !sub.enableCorporateAccess) {
      throw new Error('Corporate consultations are disabled for this subscription.');
    }
    if (args.sessionType === 'personal' && !sub.enablePersonalAgents) {
      throw new Error('Personal agents are disabled for this subscription.');
    }
  }

  // ---- Per-artist kill switch ----
  const settings = await loadArtistSettings(args.artistId);
  if (settings.killSwitch) {
    throw new Error('Artist Career Suite kill switch is ON for this artist.');
  }

  // ---- Resolve the agent record (model, persona, tools, autonomy) ----
  let agentName: string;
  let agentRole: string;
  let model: string;
  let persona: string;
  let autonomy: number;
  let tools: string[];
  let dryRunFromAgent = settings.dryRunGlobal ?? true;
  let budgetUsdDaily = '0.50';

  if (args.sessionType === 'personal') {
    const [agent] = await db
      .select()
      .from(artistSuiteAgents)
      .where(
        and(
          eq(artistSuiteAgents.artistId, args.artistId),
          eq(artistSuiteAgents.agentKey, args.agentKey),
        ),
      )
      .limit(1);
    if (!agent) {
      throw new Error(`Personal agent '${args.agentKey}' not found for artist ${args.artistId}. Has the suite been activated?`);
    }
    if (!agent.active) throw new Error(`Personal agent '${args.agentKey}' is disabled.`);
    agentName = agent.name;
    agentRole = agent.role;
    model = agent.model;
    persona = agent.persona;
    autonomy = agent.autonomy;
    tools = (agent.tools as string[]) || [];
    dryRunFromAgent = settings.dryRunGlobal || agent.dryRun;
    budgetUsdDaily = String(agent.budgetUsdDaily ?? '0.50');
  } else {
    // corporate: must be a known corporate key
    if (!(CORPORATE_AGENT_KEYS as readonly string[]).includes(args.agentKey)) {
      throw new Error(`Unknown corporate agent: ${args.agentKey}`);
    }
    const [corp] = await db
      .select()
      .from(cSuiteAgents)
      .where(eq(cSuiteAgents.id, args.agentKey))
      .limit(1);
    if (!corp) throw new Error(`Corporate agent '${args.agentKey}' is not seeded yet.`);
    if (!corp.active) throw new Error(`Corporate agent '${args.agentKey}' is currently inactive.`);
    agentName = corp.name;
    agentRole = corp.role;
    model = corp.model;
    autonomy = Math.min(corp.autonomy, 2); // cap autonomy when consulting from artist context
    // For corporate consultations we strip every executive/admin tool: read-only memory recall only.
    // The corporate agent acts purely as an advisor to the artist here.
    tools = ['recallMemory'];
    dryRunFromAgent = true; // always dry-run when corporate consults an artist
    budgetUsdDaily = '0.30';
    persona =
      corp.persona +
      `\n\nCONSULTATION CONTEXT:\nYou are speaking IN AN ADVISORY CAPACITY to an independent artist on Boostify. ` +
      `You do not have access to platform-level executive tools in this session — only conversational advice and memory recall. ` +
      `Provide strategic, honest, plain-language guidance from your domain. Decline anything that requires platform-side actions; ` +
      `route the artist to their personal AI manager instead.`;
  }

  // ---- Daily $ budget guard (per artist + agentKey) ----
  const since24h = new Date(Date.now() - 86400 * 1000);
  const [spent24h] = await db
    .select({ sum: sql<string>`COALESCE(SUM(cost_usd),0)::text` })
    .from(artistSuiteMessages)
    .innerJoin(artistSuiteThreads, eq(artistSuiteMessages.threadId, artistSuiteThreads.id))
    .where(
      and(
        eq(artistSuiteThreads.artistId, args.artistId),
        eq(artistSuiteThreads.agentKey, args.agentKey),
        sql`${artistSuiteMessages.createdAt} >= ${since24h.toISOString()}`,
      ),
    );
  const spent = Number(spent24h?.sum || 0);
  const budget = Number(budgetUsdDaily || 0);
  if (budget > 0 && spent >= budget) {
    throw new Error(
      `Agent '${args.agentKey}' hit daily budget for this artist: $${spent.toFixed(2)}/$${budget.toFixed(2)}.`,
    );
  }

  const dryRun = !!dryRunFromAgent;
  const maxToolCalls = args.maxToolCalls ?? 6;
  const turnDeadline = Date.now() + 5 * 60 * 1000;

  // ---- Create thread ----
  const [thread] = await db
    .insert(artistSuiteThreads)
    .values({
      artistId: args.artistId,
      sessionType: args.sessionType,
      agentKey: args.agentKey,
      parentId: args.parentThreadId ?? null,
      topic: args.userMessage.slice(0, 120),
      triggeredBy: args.triggeredBy ?? 'artist',
      status: 'active',
    })
    .returning();

  // ---- Recall artist+agent memory ----
  const memories = await db
    .select()
    .from(artistSuiteMemory)
    .where(
      and(
        eq(artistSuiteMemory.artistId, args.artistId),
        eq(artistSuiteMemory.agentKey, args.agentKey),
      ),
    )
    .orderBy(desc(artistSuiteMemory.weight), desc(artistSuiteMemory.createdAt))
    .limit(5);
  const memoryBlock = memories.length
    ? `\n\nRELEVANT MEMORIES:\n${memories.map((m) => `- [${m.kind}] ${m.content}`).join('\n')}`
    : '';

  const systemMsg =
    persona +
    memoryBlock +
    `\n\nCURRENT CONTEXT:\n- artist_id: ${args.artistId}\n- session: ${args.sessionType}\n- agent: ${args.agentKey} (${agentName})\n- dry_run: ${dryRun}\n- autonomy_level: ${autonomy}`;

  await db.insert(artistSuiteMessages).values({
    threadId: thread.id,
    artistId: args.artistId,
    role: 'system',
    content: systemMsg,
    model,
  });
  await db.insert(artistSuiteMessages).values({
    threadId: thread.id,
    artistId: args.artistId,
    role: 'user',
    content: args.userMessage,
  });

  artistRuntimeEvents.emit('event', {
    artistId: args.artistId,
    type: 'thread_started',
    threadId: thread.id,
    agentKey: args.agentKey,
    sessionType: args.sessionType,
    userMessage: args.userMessage,
  });

  // ---- Tool loop ----
  const conversation: any[] = [
    { role: 'system', content: systemMsg },
    { role: 'user', content: args.userMessage },
  ];
  const openaiTools = toolsToOpenAI(tools);
  let toolCallCount = 0;
  let totalCost = 0;
  let finalText = '';

  for (let iter = 0; iter < 6; iter++) {
    if (Date.now() > turnDeadline) {
      finalText = '⚠️ Turn deadline (5 min) exceeded — terminating.';
      break;
    }

    const completion = await client().chat.completions.create({
      model,
      messages: conversation,
      tools: openaiTools.length ? openaiTools : undefined,
      tool_choice: openaiTools.length ? 'auto' : undefined,
      temperature: 0.4,
    });

    const choice = completion.choices[0];
    const usage = completion.usage;
    const stepCost = estimateCost(
      completion.model || model,
      usage?.prompt_tokens || 0,
      usage?.completion_tokens || 0,
    );
    totalCost += stepCost;

    await db.insert(artistSuiteMessages).values({
      threadId: thread.id,
      artistId: args.artistId,
      role: 'assistant',
      content: choice.message.content || null,
      tokensIn: usage?.prompt_tokens || 0,
      tokensOut: usage?.completion_tokens || 0,
      costUsd: String(stepCost),
      model: completion.model,
    });

    artistRuntimeEvents.emit('event', {
      artistId: args.artistId,
      type: 'assistant_message',
      threadId: thread.id,
      agentKey: args.agentKey,
      content: choice.message.content || '',
      toolCallsRequested: choice.message.tool_calls?.length ?? 0,
    });

    if (!choice.message.tool_calls?.length) {
      finalText = choice.message.content || '';
      conversation.push({ role: 'assistant', content: finalText });
      break;
    }

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
      } else if (tool.requiredAutonomy > autonomy) {
        result = { error: `tool ${tool.id} requires autonomy >= ${tool.requiredAutonomy}, agent has ${autonomy}` };
      } else if (!tool.readOnly && args.sessionType === 'corporate') {
        result = { error: 'write tools are disabled in corporate consultations' };
      } else {
        try {
          const parsedArgs = JSON.parse(tc.function.arguments || '{}');
          const parsed = tool.schema.safeParse(parsedArgs);
          if (!parsed.success) {
            result = { error: 'schema_validation_failed', details: parsed.error.format() };
          } else {
            const ctx: ToolContext = {
              agentId: `artist:${args.artistId}:${args.agentKey}`,
              threadId: thread.id,
              dryRun,
              autonomy,
              adminEmail: args.artistEmail,
              artistId: args.artistId,
              artistAgentKey: args.agentKey,
            };
            if (tool.humanRequired) {
              // We don't have a per-artist approval path yet — short-circuit.
              result = {
                pending: true,
                note: 'Action requires human approval; queued conceptually but not yet wired into per-artist approvals.',
                target: parsed.data,
              };
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

      await db.insert(artistSuiteMessages).values({
        threadId: thread.id,
        artistId: args.artistId,
        role: 'tool',
        content: null,
        toolName: tc.function.name,
        toolArgs: tryParse(tc.function.arguments),
        toolResult: result,
      });
      artistRuntimeEvents.emit('event', {
        artistId: args.artistId,
        type: 'tool_call',
        threadId: thread.id,
        agentKey: args.agentKey,
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

  await db
    .update(artistSuiteThreads)
    .set({ status: 'done', finishedAt: new Date() })
    .where(eq(artistSuiteThreads.id, thread.id));

  artistRuntimeEvents.emit('event', {
    artistId: args.artistId,
    type: 'thread_finished',
    threadId: thread.id,
    agentKey: args.agentKey,
    finalText,
    totalCostUsd: totalCost,
  });

  // Bump subscription to 'active' on first successful turn
  await db
    .update(artistSuiteSubscriptions)
    .set({ status: 'active', activatedAt: sql`COALESCE(activated_at, NOW())`, updatedAt: new Date() })
    .where(
      and(
        eq(artistSuiteSubscriptions.artistId, args.artistId),
        eq(artistSuiteSubscriptions.status, 'approved'),
      ),
    );

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

// ---------- Seeding helpers ----------

import { PERSONAL_AGENT_PRESETS } from './agent-presets';

/**
 * Seed (or re-sync) the 5 personal agents for an artist.
 * - Inserts any missing preset rows.
 * - Updates the `tools`, `persona`, `model`, `role`, `name` of existing rows
 *   so that schema changes to PERSONAL_AGENT_PRESETS propagate without
 *   needing to manually drop rows.
 * Called when an admin approves a subscription, and idempotent on every
 * subsequent activation request.
 */
export async function seedPersonalAgentsForArtist(artistId: string) {
  const existing = await db
    .select({
      agentKey: artistSuiteAgents.agentKey,
      tools: artistSuiteAgents.tools,
      persona: artistSuiteAgents.persona,
    })
    .from(artistSuiteAgents)
    .where(eq(artistSuiteAgents.artistId, artistId));
  const have = new Map(existing.map((e) => [e.agentKey, e]));

  const inserted: string[] = [];
  const synced: string[] = [];
  for (const preset of PERSONAL_AGENT_PRESETS) {
    const cur = have.get(preset.agentKey);
    if (!cur) {
      await db.insert(artistSuiteAgents).values({
        artistId,
        agentKey: preset.agentKey,
        name: preset.name,
        role: preset.role,
        model: preset.model,
        persona: preset.persona,
        autonomy: preset.autonomy,
        active: true,
        dryRun: true,
        tools: preset.tools as any,
        budgetUsdDaily: preset.budgetUsdDaily,
      });
      inserted.push(preset.agentKey);
      continue;
    }
    // Re-sync tools / persona / role / name / model when the preset has changed.
    const curTools = (cur.tools as string[]) || [];
    const newTools = preset.tools as string[];
    const toolsChanged =
      curTools.length !== newTools.length ||
      curTools.some((t, i) => t !== newTools[i]);
    const personaChanged = cur.persona !== preset.persona;
    if (toolsChanged || personaChanged) {
      await db
        .update(artistSuiteAgents)
        .set({
          tools: newTools as any,
          persona: preset.persona,
          name: preset.name,
          role: preset.role,
          model: preset.model,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(artistSuiteAgents.artistId, artistId),
            eq(artistSuiteAgents.agentKey, preset.agentKey),
          ),
        );
      synced.push(preset.agentKey);
    }
  }

  // Ensure a settings row exists.
  await loadArtistSettings(artistId);

  return { inserted, synced, total: PERSONAL_AGENT_PRESETS.length };
}
