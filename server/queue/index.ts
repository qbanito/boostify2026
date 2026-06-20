/**
 * Boostify durable job queue (BullMQ + Redis, with a safe in-process fallback)
 * ============================================================================
 * Goal: get long-running media generation (music videos, marketing campaigns,
 * original-song pipelines, 3D/boutique assets…) OUT of `fire-and-forget`
 * closures that die on a web redeploy. Those closures lose all in-flight work
 * when Render restarts the web service, leaving rows stuck in `generating`.
 *
 * Design — additive and non-breaking:
 *   • If REDIS_URL is set AND a worker handler is registered for the job name,
 *     `runOrEnqueue()` enqueues the job to BullMQ. A separate `worker` service
 *     (see render.yaml / `npm run start:worker`) processes it durably with
 *     retries, so a web redeploy no longer kills the work.
 *   • Otherwise the work runs in-process exactly as before. Local dev and any
 *     deployment without Redis behave identically to today.
 *
 * Migration path for an existing fire-and-forget block:
 *   BEFORE:  setImmediate(async () => { ...heavy work... });
 *   AFTER:   void runOrEnqueue('my-job', payload, async () => { ...heavy work... });
 *           // then register a serializable handler in ./jobs.ts to offload it.
 */
import { Queue, type JobsOptions } from 'bullmq';
import { getRedisConnection, redisUrl } from './connection';

/** Single BullMQ queue; the job `name` discriminates the handler. */
export const MEDIA_QUEUE = 'boostify:media';

export type JobContext = { jobId?: string; name: string; attempt?: number };
export type JobHandler = (data: any, ctx: JobContext) => Promise<any>;

const handlers = new Map<string, JobHandler>();

/** Register a worker handler for a job name. Called from ./jobs.ts. */
export function defineJob(name: string, handler: JobHandler): void {
  handlers.set(name, handler);
}
export function getHandler(name: string): JobHandler | undefined {
  return handlers.get(name);
}
export function registeredJobNames(): string[] {
  return [...handlers.keys()];
}

/** True when a Redis URL is configured (queue mode available). */
export function isQueueEnabled(): boolean {
  return !!redisUrl();
}

let queueSingleton: Queue | null = null;
function getQueue(): Queue | null {
  if (!isQueueEnabled()) return null;
  if (queueSingleton) return queueSingleton;
  const connection = getRedisConnection();
  if (!connection) return null;
  queueSingleton = new Queue(MEDIA_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 15_000 },
      removeOnComplete: { age: 86_400, count: 1000 },
      removeOnFail: { age: 7 * 86_400 },
    },
  });
  return queueSingleton;
}

/** Enqueue a job. Returns the job id, or null when queue mode is off. */
export async function enqueue(name: string, data: any, opts?: JobsOptions): Promise<string | null> {
  const q = getQueue();
  if (!q) return null;
  const job = await q.add(name, data, opts);
  return job.id ?? null;
}

export type DispatchResult = { mode: 'queued' | 'inline'; jobId?: string };

/**
 * Durable dispatch with a safe inline fallback.
 *
 *  • Queue mode (REDIS_URL set AND a handler registered for `name`): the job is
 *    enqueued to BullMQ and processed by the worker service (survives web
 *    redeploys, auto-retried on failure).
 *  • Inline mode (otherwise): runs in-process, fire-and-forget, never blocking
 *    the caller — identical to the previous behaviour.
 *
 * Never throws; callers can `void runOrEnqueue(...)`.
 */
export async function runOrEnqueue(
  name: string,
  data: any,
  inline: () => Promise<any> | any,
  opts?: JobsOptions,
): Promise<DispatchResult> {
  if (isQueueEnabled() && getHandler(name)) {
    try {
      const jobId = await enqueue(name, data, opts);
      if (jobId) {
        console.log(`[queue] enqueued ${name} #${jobId}`);
        return { mode: 'queued', jobId };
      }
    } catch (e: any) {
      console.warn(`[queue] enqueue ${name} failed, falling back to inline:`, e?.message);
    }
  }
  // Inline fallback — do not block the caller.
  Promise.resolve()
    .then(() => inline())
    .catch((e) => console.error(`[queue] inline ${name} failed:`, e?.message || e));
  return { mode: 'inline' };
}

/** Lightweight stats for an admin/health endpoint. */
export async function queueStats(): Promise<{
  enabled: boolean;
  handlers: string[];
  counts?: Record<string, number>;
}> {
  const enabled = isQueueEnabled();
  const base = { enabled, handlers: registeredJobNames() };
  const q = getQueue();
  if (!q) return base;
  try {
    const counts = await q.getJobCounts('waiting', 'active', 'delayed', 'completed', 'failed');
    return { ...base, counts: counts as Record<string, number> };
  } catch {
    return base;
  }
}
