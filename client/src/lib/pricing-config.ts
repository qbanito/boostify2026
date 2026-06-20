/**
 * Configuración centralizada de planes de suscripción
 * 
 * SINGLE SOURCE OF TRUTH para todos los planes, precios y features
 * Actualizado: Noviembre 2025
 */

export type PlanTier = 'free' | 'artist' | 'creator' | 'professional' | 'enterprise';

export interface PlanConfig {
  key: PlanTier;
  displayName: string;
  description: string;
  price: {
    monthly: number;
    yearly: number;
    yearlyEquivalentMonthly: number;
  };
  stripeIds: {
    monthly: string;
    yearly: string;
  };
  features: {
    name: string;
    included: boolean;
  }[];
  popular?: boolean;
  highlight?: string;
}

/**
 * ✅ Price IDs actualizados - Abril 2026
 * 5-Tier System: Discover → Artist → Elevate → Amplify → Dominate
 * Incluye precios mensuales y anuales (16% descuento en anuales)
 */
export const SUBSCRIPTION_PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    key: 'free',
    displayName: 'Discover',
    description: 'Start your music journey',
    highlight: 'Always free',
    price: {
      monthly: 0,
      yearly: 0,
      yearlyEquivalentMonthly: 0
    },
    stripeIds: {
      monthly: '',
      yearly: ''
    },
    features: [
      { name: 'Community Hub', included: true },
      { name: 'Merch Store (Basic)', included: true },
      { name: 'Learn Hub', included: true },
      { name: 'BoostifyTV', included: true },
      { name: 'Earn 5% Commissions', included: true },
      { name: '50 Credits/month', included: true },
      { name: 'Up to 5 Songs', included: true },
      { name: 'Artist Hub', included: false },
      { name: 'Spotify Growth', included: false },
      { name: 'Legal Contracts', included: false },
      { name: 'PR Tools', included: false },
      { name: 'Expert Advisors', included: false },
      { name: 'AI Agents', included: false }
    ]
  },

  artist: {
    key: 'artist',
    displayName: 'Artist',
    description: 'Launch your artist career with essential tools',
    highlight: '🔥 Most Popular',
    popular: true,
    price: {
      monthly: 19.99,
      yearly: 201.00,
      yearlyEquivalentMonthly: 16.75
    },
    stripeIds: {
      monthly: 'price_1TIhw72LyFplWimfqmZYMwUv',
      yearly: 'price_1TIhw72LyFplWimfcpPISLbE'
    },
    features: [
      { name: 'Everything in Discover', included: true },
      { name: 'Artist Hub & Profile', included: true },
      { name: 'Contract Templates', included: true },
      { name: 'Video Creator (Basic)', included: true },
      { name: 'Merch Store (Full)', included: true },
      { name: 'Podcast Studio', included: true },
      { name: 'Image Generator', included: true },
      { name: '200 Credits/month', included: true },
      { name: '15% Commission Rate', included: true },
      { name: 'Up to 20 Songs', included: true },
      { name: 'PR & Analytics', included: false },
      { name: 'AI Music Studio', included: false },
      { name: 'Label Creator', included: false }
    ]
  },
  
  creator: {
    key: 'creator',
    displayName: 'Elevate',
    description: 'Build your artist presence & fanbase',
    highlight: 'For serious artists',
    price: {
      monthly: 49.99,
      yearly: 503.00,
      yearlyEquivalentMonthly: 41.92
    },
    stripeIds: {
      monthly: 'price_1R0lay2LyFplWimfQxUL6Hn0',
      yearly: 'price_1SUz302LyFplWimfv5MZCNz4'
    },
    features: [
      { name: 'Everything in Artist', included: true },
      { name: 'PR Starter Kit', included: true },
      { name: 'Spotify Growth Engine', included: true },
      { name: 'Music Video Creator', included: true },
      { name: 'News & Events Hub', included: true },
      { name: 'Content Studio', included: true },
      { name: 'Creative Image AI', included: true },
      { name: 'Master Classes', included: true },
      { name: 'Expert Advisors (3/month)', included: true },
      { name: '500 Credits/month', included: true },
      { name: '20% Commission Rate', included: true },
      { name: 'Up to 50 Songs', included: true },
      { name: 'YouTube Mastery', included: false },
      { name: 'Instagram Domination', included: false },
      { name: 'Label Creator', included: false }
    ]
  },
  
  professional: {
    key: 'professional',
    displayName: 'Amplify',
    description: 'Scale your sound & reach globally',
    highlight: '⚡ Best value',
    price: {
      monthly: 89.99,
      yearly: 905.00,
      yearlyEquivalentMonthly: 75.42
    },
    stripeIds: {
      monthly: 'price_1R0laz2LyFplWimfsBd5ASoa',
      yearly: 'price_1SUz302LyFplWimfG5YtbUJ3'
    },
    features: [
      { name: 'Everything in Elevate', included: true },
      { name: 'Pro Analytics Engine', included: true },
      { name: 'YouTube Mastery Suite', included: true },
      { name: 'Instagram Domination Suite', included: true },
      { name: 'Career Manager Suite', included: true },
      { name: 'Music Production Lab', included: true },
      { name: 'AI Music Studio (Advanced)', included: true },
      { name: 'Premium Merch Hub', included: true },
      { name: 'Global Language Studio', included: true },
      { name: 'Creative Canvas AI (50/month)', included: true },
      { name: 'Expert Advisors (10/month)', included: true },
      { name: 'AI Agents (5)', included: true },
      { name: '2,000 Credits/month', included: true },
      { name: 'Unlimited Songs', included: true },
      { name: 'Label Creator', included: false }
    ]
  },
  
  enterprise: {
    key: 'enterprise',
    displayName: 'Dominate',
    description: 'Conquer the music industry',
    highlight: 'Maximum power',
    price: {
      monthly: 149.99,
      yearly: 1511.00,
      yearlyEquivalentMonthly: 125.92
    },
    stripeIds: {
      monthly: 'price_1R0lb12LyFplWimf7JpMynKA',
      yearly: 'price_1SUz312LyFplWimfQSQLo349'
    },
    features: [
      { name: 'Everything in Amplify', included: true },
      { name: '✨ Virtual Label Empire (10 artists)', included: true },
      { name: '🤖 AI Agent Suite (Unlimited)', included: true },
      { name: '👑 Expert Advisors (Unlimited)', included: true },
      { name: '🎭 Artist Generator Pro', included: true },
      { name: '🌍 Global Ecosystem Hub', included: true },
      { name: '🚀 International Expansion', included: true },
      { name: '🎬 Premium Video Studio (Unlimited)', included: true },
      { name: '📊 Enterprise Analytics', included: true },
      { name: '🎵 Spotify Growth Unlimited', included: true },
      { name: '🎨 Creative Canvas Unlimited', included: true },
      { name: '🎶 AI Music Studio (Unlimited)', included: true },
      { name: '🎯 VIP Support (24/7)', included: true },
      { name: '⚡ Priority Fast-Track', included: true },
      { name: '10,000 Credits/month', included: true },
      { name: 'Web3 & Blockchain Access', included: true }
    ]
  }
};

/**
 * Helper para obtener configuración de un plan
 */
export function getPlanConfig(tier: PlanTier): PlanConfig {
  return SUBSCRIPTION_PLANS[tier];
}

/**
 * Helper para verificar si un usuario tiene acceso a una feature
 */
export function hasFeatureAccess(currentTier: PlanTier, requiredTier: PlanTier): boolean {
  const tierHierarchy: PlanTier[] = ['free', 'artist', 'creator', 'professional', 'enterprise'];
  const currentIndex = tierHierarchy.indexOf(currentTier);
  const requiredIndex = tierHierarchy.indexOf(requiredTier);
  
  return currentIndex >= requiredIndex;
}

/**
 * Helper para obtener Price ID de Stripe basado en plan e intervalo
 */
export function getStripePriceId(tier: PlanTier, interval: 'monthly' | 'yearly'): string {
  const plan = SUBSCRIPTION_PLANS[tier];
  return plan.stripeIds[interval];
}

/**
 * Helper para calcular ahorro anual
 */
export function getYearlySavings(tier: PlanTier): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  const monthlyTotal = plan.price.monthly * 12;
  const yearlyPrice = plan.price.yearly;
  return monthlyTotal - yearlyPrice;
}

/**
 * Helper para obtener porcentaje de descuento anual
 */
export function getYearlyDiscountPercentage(tier: PlanTier): number {
  const plan = SUBSCRIPTION_PLANS[tier];
  if (plan.price.yearly === 0) return 0;
  
  const monthlyTotal = plan.price.monthly * 12;
  const yearlyPrice = plan.price.yearly;
  const savings = monthlyTotal - yearlyPrice;
  
  return Math.round((savings / monthlyTotal) * 100);
}
