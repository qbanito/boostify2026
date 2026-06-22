/**
 * Timeout helpers — no external call should ever hang forever.
 * ===========================================================
 * A single hung upstream request (FAL / OpenAI / Meshy / Printful …) holds a
 * Node request handler and its memory open indefinitely, which under load is a
 * primary cause of event-loop pressure and OOM. These helpers put a hard
 * ceiling on every external call.
 */

export class TimeoutError extends Error {
  constructor(message = 'Operation timed out') {
    super(message);
    this.name = 'TimeoutError';
  }
}

/**
 * Race any promise against a timeout. Rejects with TimeoutError after `ms`.
 * Note: this does NOT cancel the underlying work (use fetchWithTimeout for
 * cancellable fetches). It only stops the CALLER from waiting forever.
 */
export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label = 'operation',
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms`)),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/**
 * fetch() with a hard timeout via AbortController. The underlying request is
 * actually aborted (socket closed) when the deadline passes, freeing memory.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  ms = 12_000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new TimeoutError(`fetch ${url} timed out after ${ms}ms`)), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetch + parse JSON with a hard timeout. Throws an Error carrying `.status`
 * on non-2xx so callers / retry helpers can branch on it.
 */
export async function fetchJSON<T = any>(
  url: string | URL,
  init: RequestInit = {},
  ms = 12_000,
): Promise<T> {
  const res = await fetchWithTimeout(url, init, ms);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err: any = new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return (await res.json()) as T;
}
