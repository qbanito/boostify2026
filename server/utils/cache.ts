/**
 * Cache layer — Upstash Redis (REST) when configured, in-memory TTL fallback otherwise.
 *
 * Design goals:
 *  - ZERO new dependencies (uses global fetch + a Map).
 *  - NEVER throws: a cache failure must never break a request. On any error we
 *    transparently fall through to the source loader.
 *  - Works TODAY on a single instance (in-memory) and scales to multi-instance
 *    the moment UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 *
 * Env (optional):
 *   UPSTASH_REDIS_REST_URL   - e.g. https://xxx.upstash.io
 *   UPSTASH_REDIS_REST_TOKEN - REST token from the Upstash console
 */

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';
const REMOTE_ENABLED = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

// ─── In-memory fallback (per-process) ────────────────────────────────────────
interface MemEntry { value: string; expiresAt: number; }
const mem = new Map<string, MemEntry>();
const MEM_MAX_KEYS = 5_000;

function memGet(key: string): string | null {
  const e = mem.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { mem.delete(key); return null; }
  return e.value;
}

function memSet(key: string, value: string, ttlSec: number): void {
  // Simple bound: when full, drop the oldest inserted key (Map preserves order).
  if (mem.size >= MEM_MAX_KEYS) {
    const oldest = mem.keys().next().value;
    if (oldest !== undefined) mem.delete(oldest);
  }
  mem.set(key, { value, expiresAt: Date.now() + ttlSec * 1000 });
}

function memDel(key: string): void { mem.delete(key); }

// ─── Upstash REST helpers ────────────────────────────────────────────────────
async function upstash(command: (string | number)[]): Promise<any> {
  const res = await fetch(UPSTASH_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const json = await res.json();
  return json?.result ?? null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/** Low-level get. Returns the raw stored string or null. Never throws. */
export async function cacheGetRaw(key: string): Promise<string | null> {
  try {
    if (REMOTE_ENABLED) return (await upstash(['GET', key])) as string | null;
    return memGet(key);
  } catch {
    return memGet(key); // remote hiccup → try local
  }
}

/** Low-level set with TTL (seconds). Never throws. */
export async function cacheSetRaw(key: string, value: string, ttlSec: number): Promise<void> {
  try {
    if (REMOTE_ENABLED) { await upstash(['SET', key, value, 'EX', ttlSec]); return; }
    memSet(key, value, ttlSec);
  } catch {
    memSet(key, value, ttlSec); // remote hiccup → keep local copy
  }
}

/** Delete one or more keys. Never throws. */
export async function cacheDel(...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  try {
    if (REMOTE_ENABLED) { await upstash(['DEL', ...keys]); return; }
  } catch { /* ignore */ }
  for (const k of keys) memDel(k);
}

/**
 * Cache-aside: return the cached JSON value or run `loader`, cache it, and return.
 * `ttlSec` is the time-to-live in seconds. On ANY cache error we fall through to
 * the loader so the request always succeeds.
 */
export async function cached<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
  const hit = await cacheGetRaw(key);
  if (hit != null) {
    try { return JSON.parse(hit) as T; } catch { /* corrupt entry → reload */ }
  }
  const fresh = await loader();
  // Fire-and-forget the write; do not block the response on cache latency.
  cacheSetRaw(key, JSON.stringify(fresh), ttlSec).catch(() => {});
  return fresh;
}

/** True when a shared (multi-instance safe) Redis backend is active. */
export function isSharedCache(): boolean { return REMOTE_ENABLED; }
