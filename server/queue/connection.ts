/**
 * Queue Redis connection (lazy, optional)
 * =======================================
 * BullMQ needs a Redis connection. We only create one when REDIS_URL (or
 * QUEUE_REDIS_URL) is configured, so local dev and any deployment without
 * Redis keep working exactly as before — heavy jobs simply run in-process.
 */
import IORedis, { type Redis } from 'ioredis';

let connection: Redis | null = null;

/** The configured Redis URL, if any. */
export function redisUrl(): string | undefined {
  return process.env.REDIS_URL || process.env.QUEUE_REDIS_URL || undefined;
}

/**
 * A shared ioredis connection for BullMQ. Returns null when no Redis is
 * configured. `maxRetriesPerRequest: null` is REQUIRED by BullMQ workers.
 */
export function getRedisConnection(): Redis | null {
  const url = redisUrl();
  if (!url) return null;
  if (connection) return connection;
  connection = new IORedis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
  });
  connection.on('error', (e: any) => console.warn('[queue] redis error:', e?.message));
  connection.on('connect', () => console.log('[queue] redis connected'));
  return connection;
}

/** Close the shared connection (used on graceful worker shutdown). */
export async function closeRedisConnection(): Promise<void> {
  if (connection) {
    try { await connection.quit(); } catch { /* ignore */ }
    connection = null;
  }
}
