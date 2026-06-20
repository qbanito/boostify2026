import { useQuery, type UseQueryOptions, type QueryKey } from "@tanstack/react-query";
import { useRef } from "react";

/**
 * use-cached-query
 * ------------------------------------------------------------------
 * A thin wrapper over @tanstack/react-query (v5) that adds a persistent
 * multi-level cache layer on top of react-query's in-memory cache:
 *
 *   1. In-memory  -> react-query (dedupes concurrent calls, instant on remount)
 *   2. localStorage (or sessionStorage) -> survives full page reloads, so the
 *      Artist Profile can paint cached data INSTANTLY on load while it
 *      revalidates in the background ("stale-while-revalidate").
 *
 * This is the building block for reducing repeated Firestore / API reads on
 * the Artist Profile. Each data type gets a sensible TTL via CACHE_TTL.
 *
 * Usage:
 *   const { data } = useCachedQuery({
 *     queryKey: ['artist-summary', artistId],
 *     queryFn: () => fetchSummary(artistId),
 *     ttl: CACHE_TTL.stats,
 *   });
 */

export const CACHE_TTL = {
  /** Public/profile-level data — changes rarely. */
  profile: 15 * 60 * 1000, // 15 min
  /** Stats / counters — refreshed often but cheap to show stale. */
  stats: 2 * 60 * 1000, // 2 min
  /** Media library listings. */
  media: 20 * 60 * 1000, // 20 min
  /** Settings / config — until explicitly invalidated. */
  settings: 60 * 60 * 1000, // 60 min
  /** Default. */
  default: 5 * 60 * 1000, // 5 min
} as const;

const STORAGE_PREFIX = "bq:q:"; // boostify query cache
const DATE_TAG = "__bqdate";

interface PersistedEntry {
  v: unknown;
  t: number; // stored-at epoch ms
}

interface Hydrated<T> {
  value: T;
  storedAt: number;
}

function storageKey(key: QueryKey): string {
  try {
    return STORAGE_PREFIX + JSON.stringify(key);
  } catch {
    return STORAGE_PREFIX + String(key);
  }
}

/** JSON replacer: tag Date + Firestore Timestamp so they survive a round-trip. */
function replacer(_k: string, value: any): any {
  if (value instanceof Date) {
    return { [DATE_TAG]: value.toISOString() };
  }
  // Firestore Timestamp (has toDate()) — convert without importing firestore.
  if (value && typeof value === "object" && typeof value.toDate === "function") {
    try {
      return { [DATE_TAG]: value.toDate().toISOString() };
    } catch {
      return value;
    }
  }
  return value;
}

/** JSON reviver: rebuild Date objects from the tag. */
function reviver(_k: string, value: any): any {
  if (value && typeof value === "object" && typeof value[DATE_TAG] === "string") {
    const d = new Date(value[DATE_TAG]);
    return Number.isNaN(d.getTime()) ? value : d;
  }
  return value;
}

function readPersisted<T>(
  key: QueryKey,
  ttl: number,
  store: Storage,
): Hydrated<T> | undefined {
  try {
    const raw = store.getItem(storageKey(key));
    if (!raw) return undefined;
    const entry = JSON.parse(raw, reviver) as PersistedEntry;
    if (typeof entry?.t !== "number") return undefined;
    if (Date.now() - entry.t > ttl) {
      store.removeItem(storageKey(key));
      return undefined;
    }
    return { value: entry.v as T, storedAt: entry.t };
  } catch {
    return undefined;
  }
}

function writePersisted<T>(key: QueryKey, value: T, store: Storage): void {
  try {
    const entry: PersistedEntry = { v: value, t: Date.now() };
    store.setItem(storageKey(key), JSON.stringify(entry, replacer));
  } catch {
    // Quota exceeded / private mode / non-serialisable — silently skip.
  }
}

export interface CachedQueryOptions<T>
  extends Omit<UseQueryOptions<T, Error, T, QueryKey>, "staleTime" | "gcTime"> {
  /** Time-to-live for the persisted layer (and react-query staleTime). */
  ttl?: number;
  /** Use sessionStorage instead of localStorage. */
  session?: boolean;
  /** Disable the persistent layer entirely (memory cache only). */
  persist?: boolean;
}

export function useCachedQuery<T>(options: CachedQueryOptions<T>) {
  const {
    ttl = CACHE_TTL.default,
    session = false,
    persist = true,
    queryKey,
    queryFn,
    ...rest
  } = options;

  // Resolve the storage backend once; tolerate SSR / disabled storage.
  const storeRef = useRef<Storage | null>(null);
  if (storeRef.current === null && typeof window !== "undefined") {
    try {
      storeRef.current = session ? window.sessionStorage : window.localStorage;
    } catch {
      storeRef.current = null;
    }
  }
  const store = persist ? storeRef.current : null;

  // Hydrate initial data from the persisted layer for an instant first paint.
  const initial = store ? readPersisted<T>(queryKey, ttl, store) : undefined;

  const result = useQuery<T, Error, T, QueryKey>({
    queryKey,
    queryFn: queryFn as any,
    staleTime: ttl,
    gcTime: ttl * 2,
    ...(initial !== undefined
      ? { initialData: initial.value, initialDataUpdatedAt: initial.storedAt }
      : {}),
    ...rest,
  });

  // Persist fresh successful results.
  if (store && result.isSuccess && result.data !== undefined && !result.isFetching) {
    writePersisted(queryKey, result.data, store);
  }

  return result;
}

/** Manually invalidate the persisted layer for a key (e.g. after a mutation). */
export function clearPersistedQuery(key: QueryKey, session = false): void {
  if (typeof window === "undefined") return;
  try {
    (session ? window.sessionStorage : window.localStorage).removeItem(
      storageKey(key),
    );
  } catch {
    /* noop */
  }
}
