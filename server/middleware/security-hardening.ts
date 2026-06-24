/**
 * ════════════════════════════════════════════════════════════════════════
 *  SECURITY HARDENING MIDDLEWARE
 * ════════════════════════════════════════════════════════════════════════
 * Centralised, defence-in-depth protections layered on top of the existing
 * helmet + CORS + express-rate-limit setup in server/index.ts.
 *
 *  - publicFormLimiter   : strict IP limiter for UNauthenticated public forms
 *                          (waitlist / leads / contact / apply) → anti-spam &
 *                          resource-abuse.
 *  - authSlowDown        : progressive per-IP delay on auth endpoints →
 *                          makes credential-stuffing / brute force impractical.
 *  - sanitizeInput       : strips NoSQL-operator keys ($…, .) and prototype
 *                          pollution vectors (__proto__, constructor,
 *                          prototype) from body / query / params.
 *  - hppProtection       : guards against HTTP Parameter Pollution.
 *  - blockSuspiciousPaths: rejects obvious probe/scanner paths (.env, .git,
 *                          wp-admin, phpMyAdmin, etc.) cheaply, before they
 *                          reach any route handler.
 * ════════════════════════════════════════════════════════════════════════
 */

import type { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import hpp from 'hpp';
import { makeRateStore } from './rate-limit-tiers';

const isDev = process.env.NODE_ENV !== 'production';

const isLoopback = (ip: string) =>
  ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

/**
 * Strict limiter for public, unauthenticated mutation endpoints (sign-up forms,
 * lead capture, contact, waitlist). These are the classic spam / abuse targets.
 * Keyed by IP. Generous in dev so local testing isn't blocked.
 */
export const publicFormLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDev ? 100000 : 20, // 20 submissions / hour / IP in prod
  standardHeaders: true,
  legacyHeaders: false,
  store: makeRateStore('rl:form:'),
  message: { success: false, error: 'Too many submissions from this IP. Please try again later.' },
  skip: (req) => isLoopback(req.ip || ''),
});

/**
 * Progressive delay for auth endpoints. After `delayAfter` requests inside the
 * window, each further request is delayed a bit more — turning a fast brute
 * force into a multi-hour crawl without hard-blocking legitimate users.
 */
export const authSlowDown = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: isDev ? 100000 : 5, // allow 5 quick attempts
  delayMs: (hits) => (hits - (isDev ? 100000 : 5)) * 500, // +0.5s each subsequent attempt
  maxDelayMs: 10_000, // cap at 10s
  skip: (req) => isLoopback(req.ip || ''),
});

// ─── Input sanitisation ───────────────────────────────────────────────────
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively delete dangerous keys in place. Only key *names* are inspected,
 * never value contents, so large base64 upload payloads are not deep-copied
 * (mutation is O(number-of-keys), strings are left untouched).
 */
function scrub(value: any, depth = 0): void {
  if (depth > 20 || value === null || typeof value !== 'object') return;
  if (Buffer.isBuffer(value)) return; // raw webhook bodies — leave untouched
  if (Array.isArray(value)) {
    for (const item of value) scrub(item, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    // NoSQL operator injection ($gt, $where…) and prototype pollution vectors.
    // (Only unambiguously-dangerous keys — never legitimate in this app's
    // Postgres/Firestore payloads — so real data is left untouched.)
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) {
      delete value[key];
      continue;
    }
    scrub(value[key], depth + 1);
  }
}

/**
 * Sanitises req.body, req.query and req.params. Skipped for very large upload
 * routes where the body is a single huge base64 string (nothing to scrub and
 * we avoid touching the hot path).
 */
export function sanitizeInput(req: Request, _res: Response, next: NextFunction) {
  try {
    if (req.body && typeof req.body === 'object') scrub(req.body);
    if (req.query && typeof req.query === 'object') scrub(req.query);
    if (req.params && typeof req.params === 'object') scrub(req.params);
  } catch {
    // Never let sanitisation crash a request.
  }
  next();
}

/**
 * HTTP Parameter Pollution guard. Collapses duplicated *query-string* params to
 * a single value so `?role=user&role=admin` can't be exploited. Body checking is
 * disabled so JSON payloads with legitimate arrays (e.g. lessonTitles[]) are
 * never altered.
 */
export const hppProtection = hpp({ checkBody: false, checkQuery: true });

// ─── Cheap scanner / probe blocking ───────────────────────────────────────
const SUSPICIOUS_PATTERNS = [
  /\.env(\.|$)/i,
  /\/\.git(\/|$)/i,
  /\/\.aws(\/|$)/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/phpmyadmin/i,
  /\/xmlrpc\.php/i,
  /\/\.well-known\/.*\.php/i,
  /\/vendor\/phpunit/i,
  /\/etc\/passwd/i,
  /\.\.[\/\\]/, // path traversal
];

/**
 * Rejects obvious vulnerability-scanner probes with a 404 before they touch any
 * route. Keeps logs clean and starves automated scanners.
 */
export function blockSuspiciousPaths(req: Request, res: Response, next: NextFunction) {
  const url = req.originalUrl || req.url || '';
  if (SUSPICIOUS_PATTERNS.some((re) => re.test(url))) {
    return res.status(404).json({ error: 'Not found' });
  }
  next();
}
