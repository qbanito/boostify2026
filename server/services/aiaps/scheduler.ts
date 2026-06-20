/**
 * Simple in-process scheduler for AIAPS background jobs.
 * - Health snapshot + auto-incidents every 6h
 * - Warm-up task dispatcher every 30m (marks due tasks as in_progress)
 *
 * This is deliberately lightweight (no Redis). For multi-instance
 * deployments, replace with BullMQ or pg-boss.
 */
import { snapshotHealth, autoCreateIncidents } from './health-engine';
import { pool } from './db';
import { jobStats } from './job-queue';
import { listOperators } from './rbac';
import { vaultList } from './vault';

let started = false;

export function startScheduler(): void {
  if (started) return;
  started = true;
  const skip = process.env.AIAPS_DISABLE_SCHEDULER === '1';
  if (skip) {
    console.log('[AIAPS scheduler] disabled via AIAPS_DISABLE_SCHEDULER=1');
    // Even when disabled, bootstrap tables so audit sees them
    bootstrapTables().catch((e) => console.warn('[AIAPS bootstrap]', e.message));
    return;
  }
  console.log('[AIAPS scheduler] started');

  // Eager schema bootstrap (idempotent)
  bootstrapTables().catch((e) => console.warn('[AIAPS bootstrap]', e.message));

  // Health snapshot every 6h (also at startup, delayed 30s)
  setTimeout(runHealthCycle, 30_000).unref();
  setInterval(runHealthCycle, 6 * 3600 * 1000).unref();

  // Warm-up dispatcher every 30m
  setTimeout(runWarmupCycle, 60_000).unref();
  setInterval(runWarmupCycle, 30 * 60 * 1000).unref();
}

async function runHealthCycle() {  try {
    const n = await snapshotHealth();
    const created = await autoCreateIncidents();
    console.log(`[AIAPS scheduler] health: ${n} report(s), ${created} incident(s) created`);
  } catch (err: any) {
    console.warn('[AIAPS scheduler] health cycle failed:', err.message);
  }
}

async function runWarmupCycle() {
  try {
    // Move tasks whose scheduled_at <= now from pending → in_progress
    const { rowCount } = await pool.query(
      `UPDATE aiaps_warmup_tasks
         SET status='in_progress'
       WHERE status='pending'
         AND scheduled_at IS NOT NULL
         AND scheduled_at <= NOW()`,
    );
    if (rowCount && rowCount > 0) {
      console.log(`[AIAPS scheduler] warmup: dispatched ${rowCount} task(s)`);
    }
  } catch (err: any) {
    console.warn('[AIAPS scheduler] warmup cycle failed:', err.message);
  }
}

async function bootstrapTables() {
  // Trigger lazy ensureTable() in each service so schema is ready.
  try { await jobStats(); } catch { /* ok */ }
  try { await listOperators(); } catch { /* ok */ }
  try { await vaultList(); } catch { /* ok */ }
}
