/**
 * Concert Commission Service
 * ==========================
 * Single source of truth for the Boostify commission applied to concert
 * ticket sales. The rate is admin-configurable (a global default plus optional
 * per-artist overrides) and ALWAYS clamped to the allowed 10–30% band on read,
 * so a bad value in the DB can never produce an out-of-policy split.
 *
 * Stored in the generic `platform_config` table under key 'concert_commission':
 *   { globalRate: 20, minRate: 10, maxRate: 30, overrides: { "1417": 15 } }
 */
import { eq } from 'drizzle-orm';
import { db } from '../db';
import { platformConfig } from '../db/schema';

export const CONCERT_COMMISSION_KEY = 'concert_commission';
export const COMMISSION_MIN = 10;
export const COMMISSION_MAX = 30;
export const COMMISSION_DEFAULT = 20;

export interface ConcertCommissionConfig {
  globalRate: number;
  minRate: number;
  maxRate: number;
  overrides: Record<string, number>; // artistId(string) → rate
}

const FALLBACK: ConcertCommissionConfig = {
  globalRate: COMMISSION_DEFAULT,
  minRate: COMMISSION_MIN,
  maxRate: COMMISSION_MAX,
  overrides: {},
};

/** Clamp any number into the allowed commission band (10–30), rounded to int. */
export function clampRate(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return COMMISSION_DEFAULT;
  return Math.min(COMMISSION_MAX, Math.max(COMMISSION_MIN, n));
}

/** Read the raw commission config (with safe defaults if unset/corrupt). */
export async function getCommissionConfig(): Promise<ConcertCommissionConfig> {
  try {
    const rows = await db
      .select({ value: platformConfig.value })
      .from(platformConfig)
      .where(eq(platformConfig.key, CONCERT_COMMISSION_KEY))
      .limit(1);
    if (!rows.length) return { ...FALLBACK };
    const raw = (rows[0].value || {}) as Partial<ConcertCommissionConfig>;
    const overrides: Record<string, number> = {};
    if (raw.overrides && typeof raw.overrides === 'object') {
      for (const [k, v] of Object.entries(raw.overrides)) {
        overrides[String(k)] = clampRate(v);
      }
    }
    return {
      globalRate: clampRate(raw.globalRate ?? COMMISSION_DEFAULT),
      minRate: COMMISSION_MIN,
      maxRate: COMMISSION_MAX,
      overrides,
    };
  } catch (err) {
    console.error('[concert-commission] getCommissionConfig failed:', (err as any)?.message);
    return { ...FALLBACK };
  }
}

/** Effective commission rate (%) for a given artist, clamped to 10–30. */
export async function resolveCommissionRate(artistId: number | string): Promise<number> {
  const cfg = await getCommissionConfig();
  const key = String(artistId);
  if (cfg.overrides[key] != null) return clampRate(cfg.overrides[key]);
  return clampRate(cfg.globalRate);
}

/** Split a gross subtotal into platform fee + artist earning using a rate (%). */
export function splitAmount(subtotal: number, ratePct: number): { platformFee: number; artistEarning: number; rate: number } {
  const rate = clampRate(ratePct);
  const platformFee = Math.round(subtotal * rate) / 100;
  const fee = Math.min(subtotal, Math.max(0, platformFee));
  return {
    rate,
    platformFee: Number(fee.toFixed(2)),
    artistEarning: Number((subtotal - fee).toFixed(2)),
  };
}

/**
 * Persist an updated commission config. `updatedBy` is the admin user id.
 * Global rate + every override are clamped before writing.
 */
export async function saveCommissionConfig(
  next: { globalRate?: number; overrides?: Record<string, number> },
  updatedBy?: number,
): Promise<ConcertCommissionConfig> {
  const current = await getCommissionConfig();
  const overrides: Record<string, number> = { ...current.overrides };
  if (next.overrides && typeof next.overrides === 'object') {
    for (const [k, v] of Object.entries(next.overrides)) {
      if (v == null || v === ('' as any)) {
        delete overrides[String(k)]; // explicit removal
      } else {
        overrides[String(k)] = clampRate(v);
      }
    }
  }
  const value: ConcertCommissionConfig = {
    globalRate: clampRate(next.globalRate ?? current.globalRate),
    minRate: COMMISSION_MIN,
    maxRate: COMMISSION_MAX,
    overrides,
  };

  const existing = await db
    .select({ id: platformConfig.id })
    .from(platformConfig)
    .where(eq(platformConfig.key, CONCERT_COMMISSION_KEY))
    .limit(1);

  if (existing.length) {
    await db
      .update(platformConfig)
      .set({ value, updatedAt: new Date(), updatedBy: updatedBy ?? null })
      .where(eq(platformConfig.key, CONCERT_COMMISSION_KEY));
  } else {
    await db.insert(platformConfig).values({
      key: CONCERT_COMMISSION_KEY,
      value,
      updatedBy: updatedBy ?? null,
    });
  }
  return value;
}
