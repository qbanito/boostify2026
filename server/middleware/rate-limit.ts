/**
 * Tiny in-memory per-user token-bucket rate limiter.
 * No external dep. Intended for admin-only routes (low volume).
 * Not cluster-safe; if you run multiple node processes, upgrade to Redis.
 */

import type { Request, Response, NextFunction } from 'express';

interface Bucket {
  tokens: number;
  lastRefillMs: number;
}

export function rateLimit(opts: {
  capacity: number;       // max tokens
  refillPerMinute: number; // tokens added per minute
  keyFn?: (req: Request) => string;
  message?: string;
}) {
  const buckets = new Map<string, Bucket>();
  const keyFn = opts.keyFn || ((req: Request) => {
    const email = (req as any).adminEmail || (req as any).auth?.sessionClaims?.email;
    return email || req.ip || 'anon';
  });

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyFn(req);
    const now = Date.now();
    let b = buckets.get(key);
    if (!b) {
      b = { tokens: opts.capacity, lastRefillMs: now };
      buckets.set(key, b);
    }
    // Refill
    const elapsedMs = now - b.lastRefillMs;
    const refill = (elapsedMs / 60_000) * opts.refillPerMinute;
    if (refill > 0) {
      b.tokens = Math.min(opts.capacity, b.tokens + refill);
      b.lastRefillMs = now;
    }
    if (b.tokens < 1) {
      const retryAfterSec = Math.ceil((1 - b.tokens) * (60 / opts.refillPerMinute));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        ok: false,
        error: opts.message || 'Rate limit exceeded',
        retryAfter: retryAfterSec,
      });
    }
    b.tokens -= 1;
    next();
  };
}

// ─── Presets for the 6 Artist modules ──────────────────────────────
/** 30 email sends / minute per user (sponsor + venue outreach) */
export const rateLimitEmailSend = rateLimit({
  capacity: 30,
  refillPerMinute: 30,
  message: 'Too many outreach emails — slow down (30/min).',
});
/** 10 AI generations / minute per user (viral-products, brand, explicit) */
export const rateLimitAiGen = rateLimit({
  capacity: 10,
  refillPerMinute: 10,
  message: 'AI generation throttled (10/min).',
});
/** 20 proposal responses / minute (public deal pages) */
export const rateLimitProposal = rateLimit({
  capacity: 20,
  refillPerMinute: 20,
  keyFn: (req) => req.ip || 'anon',
  message: 'Too many proposal responses from this IP.',
});
