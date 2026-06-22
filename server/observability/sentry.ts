/**
 * Optional Sentry integration — zero hard dependency.
 * ==================================================
 * Error monitoring is initialised ONLY when SENTRY_DSN is set AND the
 * `@sentry/node` package is installed. Otherwise every function here is a safe
 * no-op, so the app builds and runs identically without Sentry.
 *
 * To activate in production:
 *   1. npm i @sentry/node
 *   2. set SENTRY_DSN in the Render dashboard (web + worker + scheduler)
 *
 * Until then `captureException` simply logs through the structured logger.
 */
import { ROLE } from '../bootstrap/role';
import { logger } from './logger';

let sentry: any = null;
let enabled = false;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return; // not configured → no-op
  try {
    // Dynamic import so the package is optional at build/runtime.
    const mod: any = await import('@sentry/node' as any).catch(() => null);
    if (!mod) {
      logger.warn('SENTRY_DSN set but @sentry/node not installed — run `npm i @sentry/node`');
      return;
    }
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || 'development',
      release: process.env.npm_package_version || undefined,
      serverName: ROLE,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_RATE ?? 0.1),
    });
    sentry = mod;
    enabled = true;
    logger.info('Sentry initialised', { role: ROLE });
  } catch (e: any) {
    logger.warn('Sentry init failed (continuing without it)', { error: e?.message });
  }
}

export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (enabled && sentry) {
    try {
      sentry.captureException(err, context ? { extra: context } : undefined);
    } catch {
      /* never let monitoring break the request path */
    }
  }
  // Always log locally too.
  logger.error('captured exception', {
    error: err instanceof Error ? err.message : String(err),
    ...context,
  });
}

export function isSentryEnabled(): boolean {
  return enabled;
}
