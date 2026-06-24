/**
 * Request timeout middleware — no API request lives forever.
 * =========================================================
 * If a handler stalls (a hung upstream that slipped past per-call timeouts, a
 * slow DB query, an unresolved promise), this releases the socket with a 503
 * after `ms`, so the request doesn't pin a worker/connection indefinitely.
 *
 * Keep `ms` comfortably BELOW the platform's health-check / proxy timeout so a
 * single slow request never cascades into the whole instance being marked
 * unhealthy.
 */
import type { Request, Response, NextFunction } from 'express';

/** Path prefixes that legitimately run long (uploads, media/AI generation,
 * streaming, websockets). They opt out of the API timeout ceiling. */
const DEFAULT_SKIP_PREFIXES = [
  '/api/videoservice/lead',
  '/api/events/upload-media',
  '/api/music/generate',
  '/api/video/generate',
  '/api/artist-generator',
  '/api/kits-ai',
  '/api/fashion',
  '/api/upload',
  '/api/proxy',
  '/api/karaoke',
  '/api/lyrics-video',
];

export function requestTimeout(ms = 25_000, skipPrefixes: string[] = DEFAULT_SKIP_PREFIXES) {
  return (req: Request, res: Response, next: NextFunction) => {
    // When this middleware is mounted on a sub-path (e.g. app.use('/api/', ...)),
    // Express strips the mount prefix from req.path. The skip prefixes are written
    // as absolute paths ('/api/lyrics-video', ...), so compare against the FULL
    // path (baseUrl + path) — otherwise long-running routes are never exempted.
    const fullPath = (req.baseUrl || '') + req.path;
    // Long-running streaming / upload / generation endpoints opt out (they
    // legitimately take longer than the API read ceiling).
    if (skipPrefixes.some((p) => fullPath.startsWith(p) || req.path.startsWith(p))) return next();

    res.setTimeout(ms, () => {
      if (res.headersSent) return;
      console.warn(`[timeout] ${req.method} ${fullPath} exceeded ${ms}ms`);
      res.status(503).json({
        success: false,
        error: 'Request timed out. Please try again.',
      });
    });
    next();
  };
}
