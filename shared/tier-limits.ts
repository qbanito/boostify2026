/**
 * Freemium Tier Limits — Single Source of Truth
 * Shared between client and server
 * 
 * 5 Tiers: free → artist → creator → professional → enterprise
 */

import { type PlanId, PLANS, normalizePlan } from './plan-config';

export type SubscriptionTier = PlanId;

export interface TierLimits {
  songs: number;
  videos: number;
  photos: number;
  themes: number;
  dragDropLayout: boolean;
  removeWatermark: boolean;
}

/** Convert -1 (unlimited) to Infinity for runtime checks */
function inf(n: number): number { return n === -1 ? Infinity : n; }

export const TIER_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    songs: inf(PLANS.free.limits.songs),
    videos: inf(PLANS.free.limits.videos),
    photos: inf(PLANS.free.limits.photos),
    themes: PLANS.free.limits.themes,
    dragDropLayout: PLANS.free.limits.dragDropLayout,
    removeWatermark: PLANS.free.limits.removeWatermark,
  },
  artist: {
    songs: inf(PLANS.artist.limits.songs),
    videos: inf(PLANS.artist.limits.videos),
    photos: inf(PLANS.artist.limits.photos),
    themes: PLANS.artist.limits.themes,
    dragDropLayout: PLANS.artist.limits.dragDropLayout,
    removeWatermark: PLANS.artist.limits.removeWatermark,
  },
  creator: {
    songs: inf(PLANS.creator.limits.songs),
    videos: inf(PLANS.creator.limits.videos),
    photos: inf(PLANS.creator.limits.photos),
    themes: PLANS.creator.limits.themes,
    dragDropLayout: PLANS.creator.limits.dragDropLayout,
    removeWatermark: PLANS.creator.limits.removeWatermark,
  },
  professional: {
    songs: inf(PLANS.professional.limits.songs),
    videos: inf(PLANS.professional.limits.videos),
    photos: inf(PLANS.professional.limits.photos),
    themes: PLANS.professional.limits.themes,
    dragDropLayout: PLANS.professional.limits.dragDropLayout,
    removeWatermark: PLANS.professional.limits.removeWatermark,
  },
  enterprise: {
    songs: inf(PLANS.enterprise.limits.songs),
    videos: inf(PLANS.enterprise.limits.videos),
    photos: inf(PLANS.enterprise.limits.photos),
    themes: PLANS.enterprise.limits.themes,
    dragDropLayout: PLANS.enterprise.limits.dragDropLayout,
    removeWatermark: PLANS.enterprise.limits.removeWatermark,
  },
};

/** Left-column modules that require a paid subscription */
export const PREMIUM_LEFT_MODULES = [
  'downloads',
  'merchandise',
  'tokenization',
  'monetize-cta',
  'analytics',
  'earnings',
  'crowdfunding',
  'sponsors',
];

/** Right-column widgets that require a paid subscription */
export const PREMIUM_RIGHT_MODULES = [
  'physical-cards',
  'tokenized-music',
  'premium-tools',
];

/** Free left-column modules (always available) */
export const FREE_LEFT_MODULES = [
  'songs',
  'videos',
  'news',
  'social-posts',
  'social-hub',
  'galleries',
];

/** Free right-column widgets (always available) */
export const FREE_RIGHT_MODULES = [
  'qr-card',
  'statistics',
  'information',
  'social-media',
  'spotify',
  'upcoming-shows',
];

/** Free palette names (out of 20 total) */
export const FREE_PALETTE_NAMES = [
  'Boostify Naranja',
  'Midnight Carbon',
  'Deep Space',
  'Silver Frost',
  'Desert Sand',
];

/**
 * Get tier from plan name (handles legacy naming)
 */
export function getTierFromPlan(plan: string | null | undefined): SubscriptionTier {
  return normalizePlan(plan);
}

/**
 * Check if a module is premium-locked for a given tier
 */
export function isModuleLocked(moduleId: string, tier: SubscriptionTier): boolean {
  if (tier !== 'free') return false;
  return PREMIUM_LEFT_MODULES.includes(moduleId) || PREMIUM_RIGHT_MODULES.includes(moduleId);
}
