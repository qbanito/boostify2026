/**
 * Instagram Boost freemium usage limits hook.
 * Tracks daily usage per tool, enforces plan limits, and manages the trial timer.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './use-auth';
import { useToast } from './use-toast';

// ───── Plan Tiers ─────
export type IgPlan = 'free' | 'basic' | 'pro' | 'premium';

export interface IgToolLimits {
  aiToolsPerDay: number;        // caption, hashtag, bio, ideas, timing generators
  createPerDay: number;         // image/carousel/video generation
  growthActionsPerDay: number;  // growth tab AI actions
  analyticsPerDay: number;      // report/audit generations
  extractionsPerDay: number;    // profile extractions
  extensionSync: boolean;       // can use extension sync
  boostBot: boolean;            // floating AI chat
}

const PLAN_LIMITS: Record<IgPlan, IgToolLimits> = {
  free: {
    aiToolsPerDay: 5,
    createPerDay: 5,
    growthActionsPerDay: 5,
    analyticsPerDay: 5,
    extractionsPerDay: 0,
    extensionSync: true,     // free to connect
    boostBot: true,          // free but limited messages
  },
  basic: {
    aiToolsPerDay: 20,
    createPerDay: 5,
    growthActionsPerDay: 10,
    analyticsPerDay: 5,
    extractionsPerDay: 3,
    extensionSync: true,
    boostBot: true,
  },
  pro: {
    aiToolsPerDay: 100,
    createPerDay: 25,
    growthActionsPerDay: 50,
    analyticsPerDay: 25,
    extractionsPerDay: 15,
    extensionSync: true,
    boostBot: true,
  },
  premium: {
    aiToolsPerDay: -1, // unlimited
    createPerDay: -1,
    growthActionsPerDay: -1,
    analyticsPerDay: -1,
    extractionsPerDay: -1,
    extensionSync: true,
    boostBot: true,
  },
};

export type ToolCategory = 'aiTools' | 'create' | 'growth' | 'analytics' | 'extractions';

const CATEGORY_LIMIT_KEY: Record<ToolCategory, keyof IgToolLimits> = {
  aiTools: 'aiToolsPerDay',
  create: 'createPerDay',
  growth: 'growthActionsPerDay',
  analytics: 'analyticsPerDay',
  extractions: 'extractionsPerDay',
};

const STORAGE_KEY = 'boostify_ig_usage';
const BANNER_TIMER_KEY = 'boostify_ig_banner_shown';

interface DailyUsage {
  date: string; // YYYY-MM-DD
  aiTools: number;
  create: number;
  growth: number;
  analytics: number;
  extractions: number;
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
  return { date: getTodayKey(), aiTools: 0, create: 0, growth: 0, analytics: 0, extractions: 0 };
}

function saveUsage(usage: DailyUsage) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
}

function getPlanFromSubscription(sub: string | null | undefined, isAdmin: boolean): IgPlan {
  if (isAdmin) return 'premium';
  if (!sub) return 'free';
  const s = sub.toLowerCase();
  if (s === 'premium' || s === 'enterprise') return 'premium';
  if (s === 'pro' || s === 'professional' || s === 'ig_boost_pro') return 'pro';
  if (s === 'basic' || s === 'creator') return 'basic';
  return 'free';
}

export function useIgBoostLimits() {
  const { user, userSubscription, isAdmin, isLoading } = useAuth();
  const { toast } = useToast();
  const plan = getPlanFromSubscription(userSubscription, isAdmin ?? false);
  const limits = PLAN_LIMITS[plan];
  const [usage, setUsage] = useState<DailyUsage>(loadUsage);
  const [showBanner, setShowBanner] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerDismissedRef = useRef(false);

  // Start 60-second timer for free users
  useEffect(() => {
    if (plan !== 'free') {
      setShowBanner(false);
      return;
    }

    // Check if already shown in this session
    const shown = sessionStorage.getItem(BANNER_TIMER_KEY);
    if (shown === 'dismissed') {
      // Show again after 3 minutes
      timerRef.current = setTimeout(() => {
        setShowBanner(true);
        sessionStorage.removeItem(BANNER_TIMER_KEY);
      }, 180_000);
      return;
    }

    // Show banner after 60 seconds
    timerRef.current = setTimeout(() => {
      setShowBanner(true);
    }, 60_000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [plan]);

  const dismissBanner = useCallback(() => {
    setShowBanner(false);
    bannerDismissedRef.current = true;
    sessionStorage.setItem(BANNER_TIMER_KEY, 'dismissed');
    // Re-show after 3 minutes
    timerRef.current = setTimeout(() => {
      setShowBanner(true);
      sessionStorage.removeItem(BANNER_TIMER_KEY);
    }, 180_000);
  }, []);

  const getRemaining = useCallback((category: ToolCategory): number => {
    const limitKey = CATEGORY_LIMIT_KEY[category];
    const limit = limits[limitKey] as number;
    if (limit === -1) return Infinity;
    return Math.max(0, limit - usage[category]);
  }, [limits, usage]);

  const canUse = useCallback((category: ToolCategory): boolean => {
    const limitKey = CATEGORY_LIMIT_KEY[category];
    const limit = limits[limitKey] as number;
    if (limit === -1) return true;
    return usage[category] < limit;
  }, [limits, usage]);

  const recordUsage = useCallback((category: ToolCategory): boolean => {
    if (!canUse(category)) {
      toast({
        title: 'Daily limit reached',
        description: `You've used all your free ${category} actions today. Upgrade to Pro for unlimited access.`,
        variant: 'destructive',
      });
      return false;
    }
    setUsage(prev => {
      const updated = { ...prev, [category]: prev[category] + 1 };
      saveUsage(updated);
      // Toast warning when approaching limit (1 remaining)
      const limitKey = CATEGORY_LIMIT_KEY[category];
      const limit = limits[limitKey] as number;
      if (limit !== -1 && updated[category] >= limit) {
        toast({
          title: 'Limit reached',
          description: `You've reached your daily ${category} limit. Upgrade for more.`,
          variant: 'destructive',
        });
      } else if (limit !== -1 && updated[category] === limit - 1) {
        toast({
          title: '1 action remaining',
          description: `You have 1 ${category} action left today. Consider upgrading.`,
        });
      }
      return updated;
    });
    return true;
  }, [canUse, limits, toast]);

  const getUsageDisplay = useCallback((category: ToolCategory): string => {
    const limitKey = CATEGORY_LIMIT_KEY[category];
    const limit = limits[limitKey] as number;
    if (limit === -1) return '∞';
    return `${usage[category]}/${limit}`;
  }, [limits, usage]);

  return {
    plan,
    limits,
    usage,
    showBanner,
    dismissBanner,
    canUse,
    getRemaining,
    recordUsage,
    getUsageDisplay,
    isFreePlan: plan === 'free',
    isPaid: plan !== 'free',
    isLoading: isLoading ?? false,
    tier: plan,
    remaining: (category: ToolCategory) => getRemaining(category),
    limit: (category: ToolCategory) => {
      const limitKey = CATEGORY_LIMIT_KEY[category];
      const l = limits[limitKey] as number;
      return l === -1 ? Infinity : l;
    },
    PLAN_LIMITS,
  };
}
