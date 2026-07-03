/**
 * City geocoding via OpenStreetMap Nominatim (free) with a permanent
 * Postgres cache (geo_cache) so each distinct city is resolved at most once.
 *
 * Nominatim usage policy: max 1 req/s + descriptive User-Agent. We serialize
 * all lookups through a module-level promise chain with a 1.1s gap.
 */
import { db } from '../db';
import { sql } from 'drizzle-orm';

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'BoostifyMusic/1.0 (info@boostifymusic.com)';
const GAP_MS = 1100;

export interface GeoPoint { lat: number; lng: number; }

// Serialize remote lookups (Nominatim policy: 1 req/s).
let chain: Promise<void> = Promise.resolve();
function throttle(): Promise<void> {
  const next = chain.then(() => new Promise<void>((r) => setTimeout(r, GAP_MS)));
  chain = next.catch(() => {});
  return next;
}

function normQuery(city: string): string {
  return city.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200);
}

/**
 * Resolve a free-text city (e.g. "Miami", "Paris, France") to coordinates.
 * Returns null when the city can't be resolved. Misses are cached too so we
 * never re-query Nominatim for the same string.
 */
export async function geocodeCity(city: string | null | undefined): Promise<GeoPoint | null> {
  const q = normQuery(String(city || ''));
  if (!q || q.length < 2) return null;

  try {
    const { rows } = await db.execute(sql`SELECT lat, lng FROM geo_cache WHERE query = ${q} LIMIT 1`);
    if (rows.length) {
      const r: any = rows[0];
      return r.lat != null && r.lng != null ? { lat: Number(r.lat), lng: Number(r.lng) } : null;
    }
  } catch { /* cache table may not exist yet — fall through to remote */ }

  await throttle();
  let point: GeoPoint | null = null;
  try {
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=en`;
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) {
      const data: any = await res.json();
      const hit = Array.isArray(data) ? data[0] : null;
      const lat = parseFloat(hit?.lat);
      const lng = parseFloat(hit?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) point = { lat, lng };
    }
  } catch (e: any) {
    console.warn('[Geocode] lookup failed for', q, '-', e?.message);
    return null; // network error → don't cache, retry next time
  }

  // Cache hit OR definitive miss.
  db.execute(sql`
    INSERT INTO geo_cache (query, lat, lng) VALUES (${q}, ${point?.lat ?? null}, ${point?.lng ?? null})
    ON CONFLICT (query) DO NOTHING
  `).catch(() => {});

  return point;
}

/** Small deterministic jitter (±~0.015°) so multiple musicians in the same city don't stack on one pixel. */
export function jitterPoint(point: GeoPoint, seed: string): GeoPoint {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const dx = ((h % 1000) / 1000 - 0.5) * 0.03;
  const dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.03;
  return { lat: point.lat + dy, lng: point.lng + dx };
}
