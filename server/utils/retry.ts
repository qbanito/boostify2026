/**
 * Retry with exponential backoff + full jitter.
 * =============================================
 * Wraps any async operation so transient failures (network blips, 5xx, Neon
 * cold-starts) are retried, while permanent failures (4xx, validation) are
 * surfaced immediately. Never retries forever; bounded by `attempts`.
 *
 * Usage:
 *   const data = await retry(() => fetchJSON(url), {
 *     attempts: 4,
 *     retryOn: isTransientError,
 *   });
 */
export interface RetryOptions {
  /** Total tries including the first. Default 3. */
  attempts?: number;
  /** Base delay in ms for the first backoff. Default 300. */
  baseMs?: number;
  /** Maximum delay cap in ms. Default 5000. */
  maxMs?: number;
  /** Decide whether a given error is retryable. Default: retry everything. */
  retryOn?: (err: any) => boolean;
  /** Optional hook fired before each retry (for logging/metrics). */
  onRetry?: (err: any, attempt: number, delayMs: number) => void;
}

/** Heuristic: retry network/5xx/timeout errors, NOT 4xx client errors. */
export function isTransientError(err: any): boolean {
  if (!err) return false;
  const status = err.status ?? err.statusCode ?? err.response?.status;
  if (typeof status === 'number') return status >= 500 || status === 429;
  const code = err.code || err.errno || '';
  if (
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNREFUSED' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND' || // transient DNS (Neon blips show this)
    code === 'EPIPE'
  ) {
    return true;
  }
  const name = err.name || '';
  if (name === 'AbortError' || name === 'TimeoutError') return true;
  const msg = String(err.message || '').toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('timeout') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  );
}

export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const {
    attempts = 3,
    baseMs = 300,
    maxMs = 5000,
    retryOn = () => true,
    onRetry,
  } = opts;

  let lastErr: any;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const isLast = i === attempts - 1;
      if (isLast || !retryOn(err)) break;
      const backoff = Math.min(maxMs, baseMs * 2 ** i);
      // Full jitter: random in [backoff/2, backoff] to avoid thundering herds.
      const delay = Math.round(backoff * (0.5 + Math.random() * 0.5));
      onRetry?.(err, i + 1, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}
