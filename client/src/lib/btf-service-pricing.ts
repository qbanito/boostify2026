/**
 * BTF Service Pricing — Central pricing engine for all Boostify services
 * 
 * Every service in the platform can be paid via BTF token.
 * - 50% of each payment is burned on-chain (deflationary)
 * - Staking tier discounts apply automatically
 * - Platinum users get most services FREE
 */

import type { StakingTier } from './btf-token-config';

// ═══════════════════════════════════════════════════════
//  SERVICE DEFINITIONS
// ═══════════════════════════════════════════════════════

export type BTFServiceId =
  | 'ai_song'
  | 'music_video'
  | 'album_art'
  | 'pr_campaign'
  | 'fashion_studio'
  | 'voice_clone'
  | 'lip_sync'
  | 'audio_analysis'
  | 'ai_course'
  | 'ai_artist_create'
  | 'song_boost_mini'
  | 'song_boost_radio'
  | 'song_boost_homepage'
  | 'song_boost_viral'
  | 'fan_tip'
  | 'premium_analytics'
  | 'collab_request'
  | 'live_space';

export interface BTFServicePrice {
  id: BTFServiceId;
  name: string;
  description: string;
  basePriceBTF: number;
  category: 'creation' | 'promotion' | 'social' | 'analytics' | 'education';
  icon: string;
  /** If true, Platinum tier gets it completely free */
  freeForPlatinum: boolean;
  /** The string passed to payForService(amount, serviceString) on-chain */
  onChainServiceId: string;
}

export const BTF_SERVICE_PRICES: Record<BTFServiceId, BTFServicePrice> = {
  // ── Creation Services ──
  ai_song: {
    id: 'ai_song',
    name: 'AI Song Generation',
    description: 'Generate a full AI song with lyrics, melody, and production',
    basePriceBTF: 100,
    category: 'creation',
    icon: '🎵',
    freeForPlatinum: true,
    onChainServiceId: 'ai_song_generation',
  },
  music_video: {
    id: 'music_video',
    name: 'Music Video Creation',
    description: 'AI-powered music video with visual effects and themes',
    basePriceBTF: 500,
    category: 'creation',
    icon: '🎬',
    freeForPlatinum: false,
    onChainServiceId: 'music_video_creation',
  },
  album_art: {
    id: 'album_art',
    name: 'Album Art Design',
    description: 'AI-generated album artwork and cover designs',
    basePriceBTF: 50,
    category: 'creation',
    icon: '🎨',
    freeForPlatinum: true,
    onChainServiceId: 'album_art_design',
  },
  voice_clone: {
    id: 'voice_clone',
    name: 'Voice AI Clone',
    description: 'Create a custom AI voice model from samples',
    basePriceBTF: 300,
    category: 'creation',
    icon: '🎤',
    freeForPlatinum: false,
    onChainServiceId: 'voice_clone',
  },
  lip_sync: {
    id: 'lip_sync',
    name: 'Lip Sync Video',
    description: 'AI lip-sync animation for music videos',
    basePriceBTF: 250,
    category: 'creation',
    icon: '👄',
    freeForPlatinum: false,
    onChainServiceId: 'lip_sync_video',
  },
  fashion_studio: {
    id: 'fashion_studio',
    name: 'Fashion Studio',
    description: 'AI fashion design and merch mockups',
    basePriceBTF: 150,
    category: 'creation',
    icon: '👗',
    freeForPlatinum: true,
    onChainServiceId: 'fashion_studio',
  },

  // ── Promotion Services ──
  pr_campaign: {
    id: 'pr_campaign',
    name: 'PR Campaign',
    description: 'AI-powered PR campaign with press releases and outreach',
    basePriceBTF: 200,
    category: 'promotion',
    icon: '📢',
    freeForPlatinum: false,
    onChainServiceId: 'pr_campaign',
  },
  song_boost_mini: {
    id: 'song_boost_mini',
    name: 'Mini Boost',
    description: 'Boost your song to reach 1K+ listeners',
    basePriceBTF: 25,
    category: 'promotion',
    icon: '⚡',
    freeForPlatinum: true,
    onChainServiceId: 'song_boost_mini',
  },
  song_boost_radio: {
    id: 'song_boost_radio',
    name: 'Radio Boost',
    description: 'Featured on Boostify Radio rotation for 7 days',
    basePriceBTF: 100,
    category: 'promotion',
    icon: '📻',
    freeForPlatinum: true,
    onChainServiceId: 'song_boost_radio',
  },
  song_boost_homepage: {
    id: 'song_boost_homepage',
    name: 'Homepage Feature',
    description: 'Featured on Boostify homepage for 3 days',
    basePriceBTF: 250,
    category: 'promotion',
    icon: '🏠',
    freeForPlatinum: false,
    onChainServiceId: 'song_boost_homepage',
  },
  song_boost_viral: {
    id: 'song_boost_viral',
    name: 'Viral Campaign',
    description: 'Full viral campaign: radio + homepage + social push',
    basePriceBTF: 500,
    category: 'promotion',
    icon: '🚀',
    freeForPlatinum: false,
    onChainServiceId: 'song_boost_viral',
  },

  // ── Social Services ──
  fan_tip: {
    id: 'fan_tip',
    name: 'Fan Tip',
    description: 'Send BTF directly to an artist you love',
    basePriceBTF: 0, // Variable — user chooses amount
    category: 'social',
    icon: '💝',
    freeForPlatinum: false,
    onChainServiceId: 'fan_tip',
  },
  collab_request: {
    id: 'collab_request',
    name: 'Collaboration Request',
    description: 'Send a priority collaboration request to any artist',
    basePriceBTF: 50,
    category: 'social',
    icon: '🤝',
    freeForPlatinum: true,
    onChainServiceId: 'collab_request',
  },
  live_space: {
    id: 'live_space',
    name: 'Live Space Event',
    description: 'Host a premium live space with recording',
    basePriceBTF: 75,
    category: 'social',
    icon: '🎙️',
    freeForPlatinum: true,
    onChainServiceId: 'live_space',
  },

  // ── Analytics & Education ──
  audio_analysis: {
    id: 'audio_analysis',
    name: 'Audio Analysis',
    description: 'Deep AI analysis of your track quality and hit potential',
    basePriceBTF: 30,
    category: 'analytics',
    icon: '📊',
    freeForPlatinum: true,
    onChainServiceId: 'audio_analysis',
  },
  premium_analytics: {
    id: 'premium_analytics',
    name: 'Premium Analytics',
    description: 'Advanced audience insights & market analysis (30 days)',
    basePriceBTF: 80,
    category: 'analytics',
    icon: '📈',
    freeForPlatinum: true,
    onChainServiceId: 'premium_analytics',
  },
  ai_course: {
    id: 'ai_course',
    name: 'AI Music Course',
    description: 'Personalized AI music education module',
    basePriceBTF: 75,
    category: 'education',
    icon: '🎓',
    freeForPlatinum: true,
    onChainServiceId: 'ai_course',
  },
  ai_artist_create: {
    id: 'ai_artist_create',
    name: 'Create AI Artist',
    description: 'Generate a new AI artist persona with personality',
    basePriceBTF: 60,
    category: 'creation',
    icon: '🤖',
    freeForPlatinum: true,
    onChainServiceId: 'ai_artist_create',
  },
};

// ═══════════════════════════════════════════════════════
//  TIER DISCOUNT ENGINE
// ═══════════════════════════════════════════════════════

/** Discount percentage per tier */
export const TIER_DISCOUNTS: Record<StakingTier, number> = {
  None: 0,
  Bronze: 0,      // Bronze gets badge + community, no price discount
  Silver: 20,     // 20% off
  Gold: 40,       // 40% off
  Platinum: 100,  // 100% off (free) for eligible services
};

export interface PriceCalculation {
  basePrice: number;
  discountPercent: number;
  discountAmount: number;
  finalPrice: number;
  burnAmount: number;      // 50% of finalPrice burned on-chain
  treasuryAmount: number;  // 50% of finalPrice to treasury
  isFree: boolean;
  tier: StakingTier;
  serviceName: string;
}

/**
 * Calculate the final BTF price for a service based on user's staking tier
 */
export function calculateServicePrice(
  serviceId: BTFServiceId,
  userTier: StakingTier
): PriceCalculation {
  const service = BTF_SERVICE_PRICES[serviceId];
  if (!service) throw new Error(`Unknown service: ${serviceId}`);

  const basePrice = service.basePriceBTF;
  const discountPercent = TIER_DISCOUNTS[userTier];

  // Platinum gets 100% discount only on freeForPlatinum services
  const effectiveDiscount = userTier === 'Platinum' && service.freeForPlatinum
    ? 100
    : userTier === 'Platinum' && !service.freeForPlatinum
      ? 60 // Platinum still gets 60% on non-free services
      : discountPercent;

  const discountAmount = Math.floor(basePrice * effectiveDiscount / 100);
  const finalPrice = Math.max(0, basePrice - discountAmount);
  const isFree = finalPrice === 0;
  const burnAmount = Math.floor(finalPrice * 50 / 100);
  const treasuryAmount = finalPrice - burnAmount;

  return {
    basePrice,
    discountPercent: effectiveDiscount,
    discountAmount,
    finalPrice,
    burnAmount,
    treasuryAmount,
    isFree,
    tier: userTier,
    serviceName: service.name,
  };
}

/**
 * Get all services in a category with tier-aware pricing
 */
export function getServicesByCategory(
  category: BTFServicePrice['category'],
  userTier: StakingTier = 'None'
) {
  return Object.values(BTF_SERVICE_PRICES)
    .filter(s => s.category === category)
    .map(service => ({
      ...service,
      pricing: calculateServicePrice(service.id, userTier),
    }));
}

/**
 * Format BTF amount for display
 */
export function formatBTF(amount: number): string {
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K BTF`;
  return `${amount} BTF`;
}

/**
 * Check if user has enough BTF balance for a service
 */
export function hasEnoughBTF(
  balanceStr: string,
  serviceId: BTFServiceId,
  userTier: StakingTier
): boolean {
  const balance = parseFloat(balanceStr) || 0;
  const { finalPrice } = calculateServicePrice(serviceId, userTier);
  return balance >= finalPrice;
}

// ═══════════════════════════════════════════════════════
//  BOOST TIERS (Song Promotion System)
// ═══════════════════════════════════════════════════════

export const SONG_BOOST_TIERS = [
  {
    id: 'song_boost_mini' as BTFServiceId,
    name: 'Mini Boost',
    icon: '⚡',
    priceBTF: 25,
    reach: '1K+ listeners',
    duration: '24 hours',
    features: ['Discovery feed placement', 'Algorithm push'],
    color: 'from-blue-500 to-blue-600',
  },
  {
    id: 'song_boost_radio' as BTFServiceId,
    name: 'Radio Boost',
    icon: '📻',
    priceBTF: 100,
    reach: '10K+ listeners',
    duration: '7 days',
    features: ['Boostify Radio rotation', 'Discovery feed', 'Playlist inclusion'],
    color: 'from-purple-500 to-purple-600',
  },
  {
    id: 'song_boost_homepage' as BTFServiceId,
    name: 'Homepage',
    icon: '🏠',
    priceBTF: 250,
    reach: '50K+ impressions',
    duration: '3 days',
    features: ['Homepage banner', 'Radio rotation', 'Social push', 'Featured artist'],
    color: 'from-amber-500 to-orange-600',
  },
  {
    id: 'song_boost_viral' as BTFServiceId,
    name: 'Viral Campaign',
    icon: '🚀',
    priceBTF: 500,
    reach: '100K+ impressions',
    duration: '14 days',
    features: ['Full viral package', 'Homepage + Radio', 'AI social posts', 'Email blast', 'PR mentions'],
    color: 'from-red-500 to-pink-600',
  },
] as const;

// ═══════════════════════════════════════════════════════
//  TIP PRESETS
// ═══════════════════════════════════════════════════════

export const TIP_PRESETS = [
  { amount: 5, label: '☕ Coffee', emoji: '☕' },
  { amount: 10, label: '🎵 Track', emoji: '🎵' },
  { amount: 25, label: '🔥 Fire', emoji: '🔥' },
  { amount: 50, label: '💎 Diamond', emoji: '💎' },
  { amount: 100, label: '🚀 Rocket', emoji: '🚀' },
] as const;

// ═══════════════════════════════════════════════════════
//  GATED CONTENT TIERS
// ═══════════════════════════════════════════════════════

export type GateType = 'balance' | 'tier' | 'holder';

export interface ContentGate {
  type: GateType;
  /** Minimum BTF balance required (for 'balance' type) */
  minBalance?: number;
  /** Minimum staking tier required (for 'tier' type) */
  minTier?: StakingTier;
  /** Just needs to hold any BTF (for 'holder' type) */
  label: string;
}

export const CONTENT_GATES: Record<string, ContentGate> = {
  basic: { type: 'holder', label: 'BTF Holders Only' },
  premium: { type: 'balance', minBalance: 100, label: '100+ BTF Required' },
  vip: { type: 'tier', minTier: 'Silver', label: 'Silver Tier+' },
  exclusive: { type: 'tier', minTier: 'Gold', label: 'Gold Tier+' },
  platinum: { type: 'tier', minTier: 'Platinum', label: 'Platinum Only' },
};

const TIER_RANK: Record<StakingTier, number> = {
  None: 0,
  Bronze: 1,
  Silver: 2,
  Gold: 3,
  Platinum: 4,
};

/**
 * Check if user passes a content gate
 */
export function passesGate(
  gate: ContentGate,
  userBalance: number,
  userTier: StakingTier
): boolean {
  switch (gate.type) {
    case 'holder':
      return userBalance > 0;
    case 'balance':
      return userBalance >= (gate.minBalance || 0);
    case 'tier':
      return TIER_RANK[userTier] >= TIER_RANK[gate.minTier || 'None'];
    default:
      return false;
  }
}
