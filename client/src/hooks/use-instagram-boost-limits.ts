/**
 * useInstagramBoostLimits
 * -----------------------------------------------------------------
 * Daily/monthly usage caps for the Instagram Boost module.
 *
 * Pattern mirrors `use-spotify-boost-limits.ts` but exposes the
 * simpler shape required by the roadmap task:
 *   { canUse, remaining, limit, tier, isLoading, use, reset, showUpgradeToast }
 *
 * - Reads the current subscription from `useAuth()` (which internally
 *   calls `/api/auth/user`), so no extra fetch is needed.
 * - Tracks per-day usage in localStorage, resetting automatically when
 *   the ISO date changes.
 * - When a user tries to go over the limit, `use()` returns false and
 *   fires a toast suggesting an upgrade (only once per session to
 *   avoid spam).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "./use-auth";
import { useToast } from "./use-toast";

// ─── Plan Tiers ────────────────────────────────────────────────
export type InstagramBoostTier = "free" | "basic" | "pro" | "premium";

interface TierLimits {
  /** Actions per rolling 24-hour (local) day */
  daily: number;
  /** Actions per calendar month (Infinity = unlimited) */
  monthly: number;
}

const LIMITS: Record<InstagramBoostTier, TierLimits> = {
  free:    { daily: 5,        monthly: 50 },
  basic:   { daily: 25,       monthly: 500 },
  pro:     { daily: Infinity, monthly: Infinity },
  premium: { daily: Infinity, monthly: Infinity },
};

const STORAGE_KEY = "boostify_instagram_boost_usage";
const TOAST_THROTTLE_KEY = "boostify_instagram_boost_toast_shown";

// ─── Storage helpers ───────────────────────────────────────────
interface UsageRecord {
  /** YYYY-MM-DD key for daily bucket */
  dayKey: string;
  /** YYYY-MM key for monthly bucket */
  monthKey: string;
  dailyCount: number;
  monthlyCount: number;
}

function getDayKey(d: Date = new Date()): string {
  return d.toISOString().split("T")[0];
}
function getMonthKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 7);
}

function loadUsage(): UsageRecord {
  const fresh: UsageRecord = {
    dayKey: getDayKey(),
    monthKey: getMonthKey(),
    dailyCount: 0,
    monthlyCount: 0,
  };
  try {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return fresh;
    const parsed = JSON.parse(raw) as Partial<UsageRecord>;
    const dayKey = getDayKey();
    const monthKey = getMonthKey();
    return {
      dayKey,
      monthKey,
      dailyCount: parsed.dayKey === dayKey ? parsed.dailyCount ?? 0 : 0,
      monthlyCount: parsed.monthKey === monthKey ? parsed.monthlyCount ?? 0 : 0,
    };
  } catch {
    return fresh;
  }
}

function saveUsage(u: UsageRecord) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  } catch {
    // ignore quota errors
  }
}

// ─── Plan resolution ───────────────────────────────────────────
function resolveTier(
  sub: string | null | undefined,
  isAdmin: boolean
): InstagramBoostTier {
  if (isAdmin) return "premium";
  if (!sub) return "free";
  const s = sub.toLowerCase();
  if (s.includes("premium") || s.includes("enterprise")) return "premium";
  if (s.includes("pro")) return "pro";
  if (s.includes("basic") || s.includes("creator") || s.includes("starter")) return "basic";
  return "free";
}

// ─── Hook ──────────────────────────────────────────────────────
export interface UseInstagramBoostLimitsResult {
  /** Currently resolved tier */
  tier: InstagramBoostTier;
  /** Daily limit for the resolved tier (Infinity = unlimited) */
  limit: number;
  /** Remaining daily actions (Infinity when unlimited) */
  remaining: number;
  /** Total daily actions already used today */
  used: number;
  /** True while the auth/user query is still in flight */
  isLoading: boolean;
  /** True if the user still has daily budget */
  canUse: boolean;
  /**
   * Consumes one action. Returns true if allowed; false if the daily
   * or monthly cap was hit (in which case an upgrade toast is shown).
   */
  use: () => boolean;
  /** Manually show the upgrade toast (idempotent per session). */
  showUpgradeToast: () => void;
  /** Reset the local counters (admin/debug). */
  reset: () => void;
  /** Raw usage object (exposed for UI meters). */
  usage: UsageRecord;
}

export function useInstagramBoostLimits(): UseInstagramBoostLimitsResult {
  const { user, userSubscription, isAdmin, isLoading: authLoading } = useAuth() as {
    user: unknown;
    userSubscription?: string | null;
    isAdmin?: boolean;
    isLoading?: boolean;
    loading?: boolean;
  };
  const { toast } = useToast();

  const tier = useMemo(
    () => resolveTier(userSubscription ?? null, isAdmin ?? false),
    [userSubscription, isAdmin]
  );

  const [usage, setUsage] = useState<UsageRecord>(() => loadUsage());

  // Roll over daily/monthly buckets when the date changes while the app is open.
  useEffect(() => {
    const id = setInterval(() => {
      setUsage((prev) => {
        const dayKey = getDayKey();
        const monthKey = getMonthKey();
        if (prev.dayKey === dayKey && prev.monthKey === monthKey) return prev;
        const rolled: UsageRecord = {
          dayKey,
          monthKey,
          dailyCount: prev.dayKey === dayKey ? prev.dailyCount : 0,
          monthlyCount: prev.monthKey === monthKey ? prev.monthlyCount : 0,
        };
        saveUsage(rolled);
        return rolled;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  const { daily: dailyLimit, monthly: monthlyLimit } = LIMITS[tier];

  const remaining = isFinite(dailyLimit)
    ? Math.max(0, dailyLimit - usage.dailyCount)
    : Infinity;
  const canUse = remaining > 0 && (!isFinite(monthlyLimit) || usage.monthlyCount < monthlyLimit);

  const showUpgradeToast = useCallback(() => {
    try {
      if (sessionStorage.getItem(TOAST_THROTTLE_KEY) === "1") return;
      sessionStorage.setItem(TOAST_THROTTLE_KEY, "1");
    } catch {
      // no-op
    }
    toast({
      title: "Daily limit reached",
      description:
        tier === "free"
          ? `You've used all ${dailyLimit} free Instagram Boost actions today. Upgrade for unlimited.`
          : "You've hit your plan's daily cap. Upgrade for higher limits.",
      variant: "destructive",
    });
  }, [toast, tier, dailyLimit]);

  const use = useCallback((): boolean => {
    if (!canUse) {
      showUpgradeToast();
      return false;
    }
    setUsage((prev) => {
      const next: UsageRecord = {
        ...prev,
        dailyCount: prev.dailyCount + 1,
        monthlyCount: prev.monthlyCount + 1,
      };
      saveUsage(next);
      return next;
    });
    return true;
  }, [canUse, showUpgradeToast]);

  const reset = useCallback(() => {
    const fresh: UsageRecord = {
      dayKey: getDayKey(),
      monthKey: getMonthKey(),
      dailyCount: 0,
      monthlyCount: 0,
    };
    saveUsage(fresh);
    setUsage(fresh);
    try {
      sessionStorage.removeItem(TOAST_THROTTLE_KEY);
    } catch {
      // no-op
    }
  }, []);

  return {
    tier,
    limit: dailyLimit,
    remaining,
    used: usage.dailyCount,
    isLoading: Boolean(authLoading) && !user,
    canUse,
    use,
    showUpgradeToast,
    reset,
    usage,
  };
}

export default useInstagramBoostLimits;
