/**
 * Route-level response cache middleware.
 *
 * Caches successful (200) JSON responses for `ttlSec` seconds using the shared
 * cache layer (Upstash Redis when configured, in-memory TTL otherwise). Safe by
 * design: only GET requests are cached, errors are never cached, and a cache
 * outage transparently falls through to the handler.
 *
 * Usage:
 *   router.get('/artist/:slug/public',
 *     cacheRoute(300, req => `artist:${req.params.slug}`),
 *     handler);
 */
import type { Request, Response, NextFunction } from 'express';
import { cacheGetRaw, cacheSetRaw } from '../utils/cache';

export function cacheRoute(
  ttlSec: number,
  keyFn?: (req: Request) => string,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache idempotent reads.
    if (req.method !== 'GET') return next();

    const key = `route:${keyFn ? keyFn(req) : req.originalUrl}`;

    const hit = await cacheGetRaw(key);
    if (hit != null) {
      try {
        const body = JSON.parse(hit);
        res.setHeader('X-Cache', 'HIT');
        return res.json(body);
      } catch {
        // corrupt entry → ignore and regenerate
      }
    }

    // Wrap res.json to capture a successful payload on the way out.
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode === 200) {
        cacheSetRaw(key, JSON.stringify(body), ttlSec).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(body);
    };

    next();
  };
}
