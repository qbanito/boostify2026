/**
 * useConversionTracking
 * -----------------------------------------------------------------
 * Client-side per-product conversion funnel tracker for Instagram
 * Boost features. Follows the same storage-first pattern used by
 * `use-ig-boost-limits` and `use-instagram-boost-limits`:
 *
 *   - localStorage-backed, so counts persist across reloads.
 *   - Daily reset: snapshots are scoped by YYYY-MM-DD and reseed
 *     automatically when the calendar day rolls over.
 *   - Stable, typed product catalog (no loose strings) so sibling
 *     tabs can call `track('ai_caption', 'action')` without making
 *     typos that end up as ghost products in the funnel.
 *
 * The Reports tab reads this same storage key to render the
 * "Conversion Analytics" card — all writes go through this hook so
 * the UI and the event sources stay consistent.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';

// ─── Product catalog (shared with reports-tab.tsx) ─────────────
export const CONVERSION_PRODUCTS = [
  { key: 'ai_caption',         label: 'AI Captions',         category: 'aiTools'   },
  { key: 'ai_hashtags',        label: 'Hashtag Generator',   category: 'aiTools'   },
  { key: 'content_image',      label: 'Image Creator',       category: 'create'    },
  { key: 'content_carousel',   label: 'Carousel Builder',    category: 'create'    },
  { key: 'growth_dm',          label: 'DM Campaigns',        category: 'growth'    },
  { key: 'growth_collab',      label: 'Collab Finder',       category: 'growth'    },
  { key: 'profile_extraction', label: 'Profile Extraction',  category: 'analytics' },
  { key: 'account_audit',      label: 'Account Audit',       category: 'analytics' },
] as const;

export type ConversionProductKey = (typeof CONVERSION_PRODUCTS)[number]['key'];
export type ConversionProductCategory = (typeof CONVERSION_PRODUCTS)[number]['category'];

export type ConversionField = 'impressions' | 'clicks' | 'actions' | 'conversions';

export interface ProductConversion {
  product: ConversionProductKey;
  category: ConversionProductCategory;
  impressions: number;
  clicks: number;
  actions: number;
  conversions: number;
  revenue: number; // cents
  lastUpdated: string; // ISO
}

export interface ConversionSnapshot {
  date: string; // YYYY-MM-DD
  products: ProductConversion[];
}

// ─── Storage ───────────────────────────────────────────────────
const STORAGE_KEY = 'boostify_ig_conversions';

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function buildEmptySnapshot(): ConversionSnapshot {
  return {
    date: getTodayKey(),
    products: CONVERSION_PRODUCTS.map(p => ({
      product: p.key,
      category: p.category,
      impressions: 0,
      clicks: 0,
      actions: 0,
      conversions: 0,
      revenue: 0,
      lastUpdated: new Date().toISOString(),
    })),
  };
}

function loadSnapshot(): ConversionSnapshot {
  try {
    if (typeof window === 'undefined') return buildEmptySnapshot();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return buildEmptySnapshot();
    const parsed = JSON.parse(raw) as Partial<ConversionSnapshot> | null;
    if (!parsed || parsed.date !== getTodayKey() || !Array.isArray(parsed.products)) {
      return buildEmptySnapshot();
    }
    // Guarantee every known product exists in the snapshot so new
    // catalog entries get a zeroed row without wiping history.
    const byKey = new Map(parsed.products.map(p => [p.product, p]));
    const products: ProductConversion[] = CONVERSION_PRODUCTS.map(def => {
      const existing = byKey.get(def.key);
      if (existing) {
        return {
          product: def.key,
          category: def.category,
          impressions: existing.impressions ?? 0,
          clicks: existing.clicks ?? 0,
          actions: existing.actions ?? 0,
          conversions: existing.conversions ?? 0,
          revenue: existing.revenue ?? 0,
          lastUpdated: existing.lastUpdated ?? new Date().toISOString(),
        };
      }
      return {
        product: def.key,
        category: def.category,
        impressions: 0,
        clicks: 0,
        actions: 0,
        conversions: 0,
        revenue: 0,
        lastUpdated: new Date().toISOString(),
      };
    });
    return { date: parsed.date, products };
  } catch {
    return buildEmptySnapshot();
  }
}

function saveSnapshot(snapshot: ConversionSnapshot): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // quota / privacy mode — silently skip
  }
}

// ─── Public hook ───────────────────────────────────────────────
export interface UseConversionTrackingResult {
  snapshot: ConversionSnapshot;
  /** Increment one funnel counter for a product. Returns the new value. */
  track: (product: ConversionProductKey, field: ConversionField, delta?: number) => number;
  /** Record revenue (cents) on a product. Also bumps `conversions` by 1. */
  trackRevenue: (product: ConversionProductKey, cents: number) => void;
  /** Reset today's counters (admin/debug). */
  reset: () => void;
  /** Aggregate totals for the current snapshot. */
  totals: {
    impressions: number;
    clicks: number;
    actions: number;
    conversions: number;
    revenue: number;
    ctr: number;          // clicks / impressions * 100
    conversionRate: number; // conversions / actions * 100
  };
}

export function useConversionTracking(): UseConversionTrackingResult {
  const [snapshot, setSnapshot] = useState<ConversionSnapshot>(() => loadSnapshot());

  // Listen for cross-tab updates so the Reports tab stays in sync when
  // sibling tabs (Growth, Community, etc.) track events.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setSnapshot(loadSnapshot());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Daily roll-over check (mirrors the pattern from use-instagram-boost-limits).
  useEffect(() => {
    const id = setInterval(() => {
      setSnapshot(prev => (prev.date === getTodayKey() ? prev : buildEmptySnapshot()));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const track = useCallback<UseConversionTrackingResult['track']>(
    (product, field, delta = 1) => {
      let nextValue = 0;
      setSnapshot(prev => {
        const products = prev.products.map(p => {
          if (p.product !== product) return p;
          const newVal = Math.max(0, (p[field] ?? 0) + delta);
          nextValue = newVal;
          return { ...p, [field]: newVal, lastUpdated: new Date().toISOString() };
        });
        const updated: ConversionSnapshot = { ...prev, products };
        saveSnapshot(updated);
        return updated;
      });
      return nextValue;
    },
    []
  );

  const trackRevenue = useCallback<UseConversionTrackingResult['trackRevenue']>(
    (product, cents) => {
      if (!Number.isFinite(cents) || cents <= 0) return;
      setSnapshot(prev => {
        const products = prev.products.map(p =>
          p.product === product
            ? {
                ...p,
                revenue: p.revenue + Math.floor(cents),
                conversions: p.conversions + 1,
                lastUpdated: new Date().toISOString(),
              }
            : p
        );
        const updated: ConversionSnapshot = { ...prev, products };
        saveSnapshot(updated);
        return updated;
      });
    },
    []
  );

  const reset = useCallback(() => {
    const empty = buildEmptySnapshot();
    saveSnapshot(empty);
    setSnapshot(empty);
  }, []);

  const totals = useMemo(() => {
    const t = snapshot.products.reduce(
      (acc, p) => {
        acc.impressions += p.impressions;
        acc.clicks += p.clicks;
        acc.actions += p.actions;
        acc.conversions += p.conversions;
        acc.revenue += p.revenue;
        return acc;
      },
      { impressions: 0, clicks: 0, actions: 0, conversions: 0, revenue: 0 }
    );
    return {
      ...t,
      ctr: t.impressions > 0 ? (t.clicks / t.impressions) * 100 : 0,
      conversionRate: t.actions > 0 ? (t.conversions / t.actions) * 100 : 0,
    };
  }, [snapshot]);

  return { snapshot, track, trackRevenue, reset, totals };
}

export default useConversionTracking;
