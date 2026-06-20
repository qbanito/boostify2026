import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "./use-auth";

// ───── Plan Tiers ─────
export type SpotifyPlan = 'free' | 'basic' | 'pro' | 'premium';

const LIMITS: Record<SpotifyPlan, Record<string, number>> = {
  free:    { tools: 3, create: 1, growth: 2, analytics: 1, extract: 0 },
  basic:   { tools: 20, create: 5, growth: 10, analytics: 5, extract: 3 },
  pro:     { tools: 100, create: 25, growth: 50, analytics: 25, extract: 15 },
  premium: { tools: Infinity, create: Infinity, growth: Infinity, analytics: Infinity, extract: Infinity },
};

const STORAGE_KEY = 'boostify_spotify_usage';
const BANNER_TIMER_KEY = 'boostify_spotify_banner_shown';

interface DailyUsage {
  date: string;
  tools: number;
  create: number;
  growth: number;
  analytics: number;
  extract: number;
}

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function loadUsage(): DailyUsage {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as DailyUsage;
      if (data.date === getTodayKey()) return data;
    }
  } catch {}
  return { date: getTodayKey(), tools: 0, create: 0, growth: 0, analytics: 0, extract: 0 };
}

function saveUsage(usage: DailyUsage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

function getPlanFromSubscription(sub: string | null | undefined, isAdmin: boolean): SpotifyPlan {
  if (isAdmin) return 'premium';
  if (!sub) return 'free';
  const s = sub.toLowerCase();
  if (s === 'premium' || s === 'enterprise') return 'premium';
  if (s === 'pro' || s === 'professional' || s === 'spotify_boost_pro') return 'pro';
  if (s === 'basic' || s === 'creator') return 'basic';
  return 'free';
}

export function useSpotifyBoostLimits() {
  const { user, userSubscription, isAdmin } = useAuth();
  const plan = getPlanFromSubscription(userSubscription, isAdmin ?? false);
  const limits = LIMITS[plan];
  const [usage, setUsage] = useState<DailyUsage>(loadUsage);
  const [showBanner, setShowBanner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerDismissedRef = useRef(false);

  // Show banner after 60s for free users
  useEffect(() => {
    if (plan !== 'free') {
      setShowBanner(false);
      return;
    }
    const shown = sessionStorage.getItem(BANNER_TIMER_KEY);
    if (shown === 'dismissed') {
      timerRef.current = setTimeout(() => {
        setShowBanner(true);
        sessionStorage.removeItem(BANNER_TIMER_KEY);
      }, 180_000);
      return;
    }
    timerRef.current = setTimeout(() => setShowBanner(true), 60_000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plan]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    bannerDismissedRef.current = true;
    sessionStorage.setItem(BANNER_TIMER_KEY, 'dismissed');
    timerRef.current = setTimeout(() => {
      setShowBanner(true);
      sessionStorage.removeItem(BANNER_TIMER_KEY);
    }, 180_000);
  }, []);

  const canUse = useCallback((feature: string): boolean => {
    const limit = limits[feature] ?? 0;
    if (!isFinite(limit)) return true;
    return (usage[feature as keyof DailyUsage] as number || 0) < limit;
  }, [limits, usage]);

  const use = useCallback((feature: string): boolean => {
    if (!canUse(feature)) return false;
    setUsage(prev => {
      const updated = { ...prev, [feature]: ((prev[feature as keyof DailyUsage] as number) || 0) + 1 };
      saveUsage(updated);
      return updated;
    });
    return true;
  }, [canUse]);

  const getRemaining = useCallback((feature: string): number => {
    const limit = limits[feature] ?? 0;
    if (!isFinite(limit)) return Infinity;
    return Math.max(0, limit - ((usage[feature as keyof DailyUsage] as number) || 0));
  }, [limits, usage]);

  const getLimit = useCallback((feature: string): number => {
    return limits[feature] ?? 0;
  }, [limits]);

  const getUsed = useCallback((feature: string): number => {
    return (usage[feature as keyof DailyUsage] as number) || 0;
  }, [usage]);

  // Totals for subscription banner
  const totalUsed = usage.tools + usage.create + usage.growth + usage.analytics + usage.extract;
  const totalLimit = (limits.tools || 0) + (limits.create || 0) + (limits.growth || 0) + (limits.analytics || 0) + (limits.extract || 0);

  return {
    plan,
    tier: plan, // backwards compat
    limits,
    usage,
    canUse,
    use,
    getRemaining,
    getLimit,
    getUsed,
    showBanner,
    dismissBanner,
    isFreePlan: plan === 'free',
    isPro: plan !== 'free',
    isPaid: plan !== 'free',
    totalUsed,
    totalLimit,
  };
}
