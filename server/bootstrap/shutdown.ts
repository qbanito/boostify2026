/**
 * Graceful shutdown — drain in-flight requests before the process exits.
 * =====================================================================
 * On every deploy Render sends SIGTERM. Without draining, in-flight requests
 * are cut mid-response and DB connections are abandoned (which can leave the
 * Neon pool wedged). This stops accepting new connections, lets active ones
 * finish, closes the DB pool, then exits — with a hard deadline so a stuck
 * request can never block the deploy.
 */
import type { Server } from 'http';

export interface ShutdownOptions {
  /** Hard deadline before force-exit (ms). Default 12000. */
  deadlineMs?: number;
  /** Extra async cleanups (close redis, stop workers, …). */
  onShutdown?: Array<() => Promise<void> | void>;
}

export function installGracefulShutdown(server: Server, opts: ShutdownOptions = {}): void {
  const { deadlineMs = 12_000, onShutdown = [] } = opts;
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[shutdown] ${signal} received — draining connections…`);

    // Stop accepting new connections; finish the in-flight ones.
    server.close((err) => {
      if (err) console.error('[shutdown] server.close error:', err?.message);
      else console.log('[shutdown] HTTP server closed');
    });

    // Force-exit if draining takes too long.
    const force = setTimeout(() => {
      console.warn('[shutdown] deadline exceeded — forcing exit');
      process.exit(0);
    }, deadlineMs);
    force.unref();

    // Best-effort cleanups (never let one failure block the rest).
    for (const fn of onShutdown) {
      try {
        await fn();
      } catch (e: any) {
        console.warn('[shutdown] cleanup error:', e?.message || e);
      }
    }

    try {
      const { pool } = await import('../db');
      await pool.end();
      console.log('[shutdown] DB pool closed');
    } catch (e: any) {
      console.warn('[shutdown] pool.end error:', e?.message || e);
    }

    clearTimeout(force);
    console.log('[shutdown] clean exit');
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}
