/**
 * C-Suite Autonomous Scheduler
 * ----------------------------
 * Executes rows from c_suite_schedule so agents WORK on their own instead of
 * only reacting to manual admin commands.
 *
 * Cadence format (column `cron`, simple presets — not full crontab):
 *   '@hourly' | '@every6h' | '@every12h' | '@daily' | '@weekly' | 'every:N' (N = minutes)
 *
 * Task types (column `task`):
 *   'daily_briefing'    → CEO daily briefing (self-maintenance.ts)
 *   'self_maintenance'  → CTO diagnostics cycle (self-maintenance.ts)
 *   'agent_prompt'      → runAgentTurn(agentId, payload.prompt)
 *
 * Inactive agents / kill switch throw inside runAgentTurn — errors are logged
 * and the schedule advances anyway (no retry storm).
 */
import { db } from '../../db';
import { cSuiteSchedule } from '../../db/schema';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';

const POLL_MS = 60_000;
let started = false;
let running = false;

function intervalMs(cron: string): number {
  switch (cron) {
    case '@hourly': return 3600_000;
    case '@every6h': return 6 * 3600_000;
    case '@every12h': return 12 * 3600_000;
    case '@daily': return 24 * 3600_000;
    case '@weekly': return 7 * 24 * 3600_000;
    default: {
      const m = /^every:(\d+)$/.exec(cron || '');
      const mins = m ? Math.max(parseInt(m[1], 10), 5) : 24 * 60;
      return mins * 60_000;
    }
  }
}

async function runScheduledTask(row: typeof cSuiteSchedule.$inferSelect) {
  const payload = (row.payload as any) || {};
  switch (row.task) {
    case 'daily_briefing': {
      const { runDailyBriefing } = await import('./self-maintenance');
      return runDailyBriefing('schedule');
    }
    case 'self_maintenance': {
      const { runSelfMaintenanceCycle } = await import('./self-maintenance');
      return runSelfMaintenanceCycle('schedule');
    }
    case 'agent_prompt': {
      if (!payload.prompt) return { ok: false, message: 'schedule payload.prompt missing' };
      const { runAgentTurn } = await import('./runtime');
      const res = await runAgentTurn({
        agentId: row.agentId,
        userMessage: payload.prompt,
        triggeredBy: 'schedule',
      });
      return { ok: true, message: `thread ${res.threadId}, ${res.toolCalls} tool calls` };
    }
    default:
      return { ok: false, message: `unknown task type: ${row.task}` };
  }
}

async function tick() {
  if (running) return; // concurrency guard
  running = true;
  try {
    const now = new Date();
    const due = await db.select().from(cSuiteSchedule)
      .where(and(
        eq(cSuiteSchedule.active, true),
        or(isNull(cSuiteSchedule.nextRun), lte(cSuiteSchedule.nextRun, now)),
      ))
      .limit(10);

    for (const row of due) {
      const nextRun = new Date(Date.now() + intervalMs(row.cron));
      // Advance the schedule FIRST so a crash mid-task can't cause a hot loop.
      await db.update(cSuiteSchedule)
        .set({ lastRun: now, nextRun })
        .where(eq(cSuiteSchedule.id, row.id));
      try {
        const result = await runScheduledTask(row);
        console.log(`[C-Suite Scheduler] ${row.agentId}/${row.task}: ${(result as any)?.message ?? 'ok'}`);
      } catch (err: any) {
        // Inactive agent / kill switch / budget exceeded — log and move on.
        console.warn(`[C-Suite Scheduler] ${row.agentId}/${row.task} failed: ${err?.message || err}`);
      }
    }
  } catch (err: any) {
    console.error('[C-Suite Scheduler] tick error:', err?.message || err);
  } finally {
    running = false;
  }
}

/** Idempotent: seeds the default autonomous work cadence only when the table is empty. */
export async function seedDefaultSchedules() {
  const [{ n }] = await db.select({ n: sql<number>`COUNT(*)::int` }).from(cSuiteSchedule);
  if (n > 0) return { seeded: 0 };
  const defaults = [
    { agentId: 'ceo', cron: '@daily', task: 'daily_briefing', payload: {}, active: true },
    { agentId: 'cto', cron: '@every12h', task: 'self_maintenance', payload: {}, active: true },
    {
      agentId: 'cmo', cron: '@daily', task: 'agent_prompt', active: true,
      payload: { prompt: 'Growth pulse: usa queryGrowthFunnel para revisar signups y funnel de adquisición. Haz check-in de tus goals de crecimiento con checkInOnGoal. Si detectas caída de signups, propone (remember) 3 acciones concretas de adquisición y, si procede, prepara un sendOutreachEmail para un partner o comunidad relevante.' },
    },
    {
      agentId: 'cfo', cron: '@daily', task: 'agent_prompt', active: true,
      payload: { prompt: 'Investor pipeline review: usa queryInvestorLeads para revisar los leads de inversores. Haz seguimiento de los de interés alto (prepara sendOutreachEmail de follow-up si llevan >3 días sin contacto). Registra con recordInvestorLead cualquier inversor cualificado nuevo mencionado en memoria. Haz check-in del goal de pipeline.' },
    },
  ];
  for (const d of defaults) {
    await db.insert(cSuiteSchedule).values(d as any);
  }
  return { seeded: defaults.length };
}

export function startCSuiteScheduler() {
  if (started) return;
  started = true;
  console.log('🤖 [C-Suite Scheduler] started (60s poll)');
  setInterval(() => { void tick(); }, POLL_MS);
  // First tick shortly after boot (let DB pool warm up).
  setTimeout(() => { void tick(); }, 15_000);
}
