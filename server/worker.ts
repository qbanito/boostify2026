/**
 * Worker process entrypoint
 * =========================
 * Standalone Node process for Render's `worker` service. Boots the BullMQ media
 * worker and keeps the event loop alive with graceful shutdown.
 *
 *   Build:  esbuild server/worker.ts → dist/server/worker.js (see build-for-deploy.js)
 *   Run:    npm run start:worker    (node dist/server/worker.js)
 *   Dev:    npx tsx server/worker.ts
 */
import 'dotenv/config';
import { startMediaWorker } from './queue/worker';
import { closeRedisConnection } from './queue/connection';

console.log('[worker] booting media worker process…');

const worker = startMediaWorker();

if (!worker) {
  console.error('[worker] no worker started (missing REDIS_URL). Exiting.');
  process.exit(1);
}

// Keep the event loop alive.
const keepAlive = setInterval(() => {}, 30_000);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received, shutting down…`);
  clearInterval(keepAlive);
  try {
    await worker?.close();
  } catch (e: any) {
    console.warn('[worker] close error:', e?.message);
  }
  await closeRedisConnection();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'EPIPE') return;
  console.error('[worker] uncaughtException:', err?.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[worker] unhandledRejection:', reason);
});
