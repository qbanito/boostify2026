/**
 * Hook for accessing freemium tier limits
 * Combines auth state + subscription to provide limits & helpers
 */
import { useAuth } from './use-auth';
import { useQuery } from '@tanstack/react-query';
import {
  TIER_LIMITS,
  PREMIUM_LEFT_MODULES,
  PREMIUM_RIGHT_MODULES,
  FREE_PALETTE_NAMES,
  getTierFromPlan,
  isModuleLocked,
  type SubscriptionTier,
  type TierLimits,
} from '../../../shared/tier-limits';

export function useTierLimits() {
  const { user, isAdmin, userSubscription } = useAuth();

  // Fetch subscription details (includes songsUsed, videosUsed, etc.)
  const { data: subscription } = useQuery<any>({
    queryKey: ['/api/subscription/user', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/subscription/user/${user.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 2,
  });

  const tier: SubscriptionTier = isAdmin
    ? 'enterprise'
    : getTierFromPlan(userSubscription || subscription?.plan);

  const limits: TierLimits = TIER_LIMITS[tier];
  const isFree = tier === 'free' && !isAdmin;
  const isPremium = !isFree;

  return {
    tier,
    limits,
    isFree,
    isPremium,
    isAdmin: isAdmin ?? false,

    /** Check if a specific module is locked for this user */
    isModuleLocked: (moduleId: string) => {
      if (isAdmin) return false;
      return isModuleLocked(moduleId, tier);
    },

    /** Check if user can upload more songs */
    canUploadSong: (currentCount: number) => {
      if (isAdmin) return true;
      return currentCount < limits.songs;
    },

    /** Check if user can upload more videos */
    canUploadVideo: (currentCount: number) => {
      if (isAdmin) return true;
      return currentCount < limits.videos;
    },

    /** Check if a palette name is available to the user */
    isPaletteAvailable: (paletteName: string) => {
      if (isAdmin || !isFree) return true;
      return FREE_PALETTE_NAMES.includes(paletteName);
    },

    /** Get remaining uploads */
    songsRemaining: (currentCount: number) => Math.max(0, limits.songs - currentCount),
    videosRemaining: (currentCount: number) => Math.max(0, limits.videos - currentCount),

    /** Premium module lists (for rendering gates) */
    PREMIUM_LEFT_MODULES,
    PREMIUM_RIGHT_MODULES,
    FREE_PALETTE_NAMES,
  };
}
