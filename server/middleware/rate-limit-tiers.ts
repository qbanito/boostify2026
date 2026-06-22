/**
 * Tiered rate limiting — per IP, per user and per heavy module.
 * ============================================================
 * The base `apiLimiter` in index.ts throttles per IP. These add:
 *   • per-USER limits (so one logged-in user can't exhaust a shared IP, and a
 *     NAT'd office isn't punished as one client),
 *   • strict per-MODULE limits on expensive AI endpoints (music video,
 *     campaigns, …) keyed by user+module.
 *
 * Store: uses a shared Redis store when REDIS_URL is configured (correct across
 * multiple web instances); otherwise falls back to express-rate-limit's
 * in-memory store (correct on a single instance). Zero new dependencies — the
 * Redis store is a tiny adapter over the existing ioredis connection.
 */
import rateLimit, { ipKeyGenerator, type Options, type Store } from 'express-rate-limit';
import type { Request } from 'express';
import { getRedisConnection } from '../queue/connection';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Identify the caller: authenticated user id when present, else a normalized
 * IP. IPv6 addresses MUST go through `ipKeyGenerator` (groups them by /56
 * subnet) — otherwise a single IPv6 user could rotate addresses to bypass the
 * limit (express-rate-limit throws ERR_ERL_KEY_GEN_IPV6 if you don't).
 */
function userOrIp(req: Request): string {
  const anyReq = req as any;
  const id =
    anyReq.user?.id?.toString() ||
    anyReq.user?.clerkUserId ||
    anyReq.auth?.userId ||
    (req.headers['x-user-id'] as string);
  if (id) return `u:${id}`;
  return `ip:${ipKeyGenerator(req.ip || '0.0.0.0')}`;
}

const isLocal = (req: Request) => {
  const ip = req.ip || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
};

// ─── Minimal ioredis-backed store (only used when REDIS_URL is set) ──────────
class RedisRateStore implements Store {
  private windowMs = 60_000;
  prefix = 'rl:';
  private client = getRedisConnection();

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string) {
    const client = this.client;
    const k = this.prefix + key;
    if (!client) {
      // Should never happen (factory only uses this when client exists), but be safe.
      return { totalHits: 1, resetTime: new Date(Date.now() + this.windowMs) };
    }
    const hits = await client.incr(k);
    let pttl = await client.pttl(k);
    if (pttl < 0) {
      await client.pexpire(k, this.windowMs);
      pttl = this.windowMs;
    }
    return { totalHits: hits, resetTime: new Date(Date.now() + pttl) };
  }

  async decrement(key: string) {
    await this.client?.decr(this.prefix + key);
  }

  async resetKey(key: string) {
    await this.client?.del(this.prefix + key);
  }
}

function makeStore(): Store | undefined {
  // Only use Redis store when a connection is actually available.
  return getRedisConnection() ? new RedisRateStore() : undefined;
}

/**
 * Per-user read limiter — generous; protects shared IPs and authenticated
 * abuse without punishing NAT'd networks. Apply to hot read surfaces.
 */
export const userReadLimiter = rateLimit({
  windowMs: 60_000,
  max: isDev ? 10_000 : 600,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: userOrIp,
  skip: isLocal,
  store: makeStore(),
  message: { success: false, error: 'Too many requests, please slow down.' },
});

/**
 * Strict per-module limiter factory for expensive AI generation endpoints.
 * Keyed by `${module}:${user}` so each user gets an independent budget per
 * module.
 */
export function heavyModuleLimiter(module: string, maxPerHour = 20) {
  return rateLimit({
    windowMs: 60 * 60_000,
    max: isDev ? 10_000 : maxPerHour,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request) => `${module}:${userOrIp(req)}`,
    skip: isLocal,
    store: makeStore(),
    message: {
      success: false,
      error: `Has alcanzado el límite del módulo "${module}". Intenta de nuevo más tarde.`,
    },
  });
}
