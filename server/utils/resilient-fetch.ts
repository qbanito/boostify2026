/**
 * resilientFetch — one call that combines timeout + retry + circuit breaker.
 * =========================================================================
 * The recommended way to call any unstable external HTTP API:
 *
 *   const json = await resilientJSON('https://api.fal.ai/...', {
 *     breaker: 'fal',
 *     init: { method: 'POST', headers, body },
 *     timeoutMs: 15_000,
 *     attempts: 3,
 *   });
 *
 * Composition order (outer → inner): breaker( retry( timeout(fetch) ) ).
 *  • timeout   — aborts a single hung request.
 *  • retry     — re-issues transient failures with backoff+jitter.
 *  • breaker   — fails fast while the upstream is clearly down.
 */
import { fetchWithTimeout, fetchJSON } from './timeout';
import { retry, isTransientError, type RetryOptions } from './retry';
import { getBreaker, type BreakerOptions } from './circuit-breaker';

export interface ResilientOptions {
  /** Circuit-breaker key (one per upstream, e.g. 'fal', 'openai'). */
  breaker?: string;
  breakerOptions?: BreakerOptions;
  /** fetch init. */
  init?: RequestInit;
  /** Per-attempt hard timeout (ms). Default 12000. */
  timeoutMs?: number;
  /** Retry config. Defaults to 3 attempts on transient errors. */
  attempts?: number;
  retry?: Omit<RetryOptions, 'attempts' | 'retryOn'> & {
    retryOn?: RetryOptions['retryOn'];
  };
}

function wrapBreaker<T>(name: string | undefined, opts: BreakerOptions | undefined, fn: () => Promise<T>): Promise<T> {
  if (!name) return fn();
  return getBreaker(name, opts).exec(fn);
}

/** Resilient fetch returning the raw Response. */
export function resilientFetch(url: string | URL, opts: ResilientOptions = {}): Promise<Response> {
  const { breaker, breakerOptions, init, timeoutMs = 12_000, attempts = 3, retry: retryOpts } = opts;
  return wrapBreaker(breaker, breakerOptions, () =>
    retry(() => fetchWithTimeout(url, init, timeoutMs), {
      attempts,
      retryOn: retryOpts?.retryOn ?? isTransientError,
      baseMs: retryOpts?.baseMs,
      maxMs: retryOpts?.maxMs,
      onRetry: retryOpts?.onRetry,
    }),
  );
}

/** Resilient fetch + JSON parse. Throws with `.status` on non-2xx. */
export function resilientJSON<T = any>(url: string | URL, opts: ResilientOptions = {}): Promise<T> {
  const { breaker, breakerOptions, init, timeoutMs = 12_000, attempts = 3, retry: retryOpts } = opts;
  return wrapBreaker(breaker, breakerOptions, () =>
    retry(() => fetchJSON<T>(url, init, timeoutMs), {
      attempts,
      retryOn: retryOpts?.retryOn ?? isTransientError,
      baseMs: retryOpts?.baseMs,
      maxMs: retryOpts?.maxMs,
      onRetry: retryOpts?.onRetry,
    }),
  );
}
