/**
 * BullMQ media worker
 * ===================
 * Consumes the `boostify:media` queue and dispatches each job to its registered
 * handler. Started by the dedicated `worker` Render service (or
 * `npm run start:worker`). Requires REDIS_URL.
 */
import { Worker, type Job } from 'bullmq';
import { getRedisConnection } from './connection';
import { MEDIA_QUEUE, getHandler, registeredJobNames } from './index';
import './jobs'; // side-effect: registers all handlers

export function startMediaWorker(): Worker | null {
  const connection = getRedisConnection();
  if (!connection) {
    console.error('[worker] REDIS_URL not set — cannot start BullMQ worker.');
    return null;
  }

  const concurrency = Number(process.env.WORKER_CONCURRENCY || 3);
  const worker = new Worker(
    MEDIA_QUEUE,
    async (job: Job) => {
      const handler = getHandler(job.name);
      if (!handler) throw new Error(`No handler registered for job "${job.name}"`);
      return handler(job.data, { jobId: job.id, name: job.name, attempt: job.attemptsMade });
    },
    { connection, concurrency },
  );

  worker.on('completed', (job) => console.log(`[worker] ✓ ${job.name} #${job.id}`));
  worker.on('failed', (job, err) =>
    console.error(`[worker] ✗ ${job?.name} #${job?.id} (attempt ${job?.attemptsMade}):`, err?.message),
  );
  worker.on('error', (err) => console.error('[worker] error:', err?.message));

  console.log(
    `[worker] media worker started (concurrency ${concurrency}). Handlers: ${
      registeredJobNames().join(', ') || '(none)'
    }`,
  );
  return worker;
}
