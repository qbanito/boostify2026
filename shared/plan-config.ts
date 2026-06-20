/**
 * BOOSTIFY MUSIC — Plan Configuration (Single Source of Truth)
 * ==============================================================
 * ALL plan definitions, limits, features, pricing, and access rules.
 * 
 * 5 Plans: Discover (free) → Artist ($19.99) → Elevate ($49.99) → Amplify ($89.99) → Dominate ($149.99)
 * 
 * DB names: free | artist | creator | professional | enterprise
 * UI names: Discover | Artist | Elevate | Amplify | Dominate
 * Legacy:   free | basic | pro | premium (mapped automatically)
 */

// ============================================
// PLAN TYPES
// ============================================

export type PlanId = 'free' | 'artist' | 'creator' | 'professional' | 'enterprise';

export interface PlanDefinition {
  id: PlanId;
  uiName: string;
  tagline: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlySavings: number;
  level: number;              // Hierarchy level for access checks
  stripePriceIds: {
    monthly: string | null;
    yearly: string | null;
  };
  limits: PlanLimits;
  credits: PlanCredits;
  features: PlanFeature[];
}

export interface PlanLimits {
  songs: number;
  videos: number;
  photos: number;
  themes: number;
  merchProducts: number;
  aiImagesPerMonth: number;
  aiVideosPerMonth: number;
  musicVideosPerMonth: number;
  musicMasteringPerMonth: number;
  faceSwapPerMonth: number;
  contentPostsPerMonth: number;
  copyrightChecksPerMonth: number;
  expertAdvisorsPerMonth: number;
  aiAgents: number;
  virtualLabelArtists: number;
  messagesPerDay: number;
  coursesAccess: number;         // 0 = none, -1 = all
  dragDropLayout: boolean;
  removeWatermark: boolean;
  customizeMerchandise: boolean;
  removeBoostifyLogo: boolean;
}

export interface PlanCredits {
  monthlyCredits: number;
  bonusOnPurchase: number;       // percentage
  discountOnOps: number;         // percentage
  commissionRate: number;        // percentage for affiliates
}

export interface PlanFeature {
  text: string;
  included: boolean;
  highlight?: boolean;
}

// ============================================
// PLAN DEFINITIONS
// ============================================

export const PLANS: Record<PlanId, PlanDefinition> = {
  free: {
    id: 'free',
    uiName: 'Discover',
    tagline: 'Start your music journey',
    description: 'Explore the ecosystem for free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlySavings: 0,
    level: 0,
    stripePriceIds: { monthly: null, yearly: null },
    limits: {
      songs: 10,
      videos: 5,
      photos: 20,
      themes: 5,
      merchProducts: 0,
      aiImagesPerMonth: 0,
      aiVideosPerMonth: 0,
      musicVideosPerMonth: 0,
      musicMasteringPerMonth: 0,
      faceSwapPerMonth: 0,
      contentPostsPerMonth: 0,
      copyrightChecksPerMonth: 0,
      expertAdvisorsPerMonth: 0,
      aiAgents: 0,
      virtualLabelArtists: 0,
      messagesPerDay: 5,
      coursesAccess: 5,
      dragDropLayout: false,
      removeWatermark: false,
      customizeMerchandise: false,
      removeBoostifyLogo: false,
    },
    credits: {
      monthlyCredits: 50,
      bonusOnPurchase: 0,
      discountOnOps: 0,
      commissionRate: 5,
    },
    features: [
      { text: 'Community Hub & Social Network', included: true },
      { text: 'BoostifyTV (watch content)', included: true },
      { text: 'Learn Hub (5 basic courses)', included: true },
      { text: 'Blog, News, Tips & Guides', included: true },
      { text: 'Merch Store (browse & buy)', included: true },
      { text: 'Basic Artist Profile', included: true },
      { text: '10 Songs, 5 Videos, 20 Photos', included: true },
      { text: 'Earn Commissions (5%)', included: true },
      { text: '50 Credits/month', included: true },
      { text: 'Artist Hub', included: false },
      { text: 'Growth Tools', included: false },
      { text: 'AI Tools', included: false },
    ],
  },

  artist: {
    id: 'artist',
    uiName: 'Artist',
    tagline: 'Your first professional step',
    description: 'Essential tools to launch your career',
    monthlyPrice: 19.99,
    yearlyPrice: 199.99,
    yearlySavings: 40,
    level: 1,
    stripePriceIds: {
      monthly: 'price_1TIhw72LyFplWimfqmZYMwUv',
      yearly: 'price_1TIhw72LyFplWimfcpPISLbE',
    },
    limits: {
      songs: 20,
      videos: 10,
      photos: 50,
      themes: 20,
      merchProducts: 5,
      aiImagesPerMonth: 5,
      aiVideosPerMonth: 0,
      musicVideosPerMonth: 0,
      musicMasteringPerMonth: 0,
      faceSwapPerMonth: 0,
      contentPostsPerMonth: 5,
      copyrightChecksPerMonth: 0,
      expertAdvisorsPerMonth: 0,
      aiAgents: 0,
      virtualLabelArtists: 0,
      messagesPerDay: -1,
      coursesAccess: -1,
      dragDropLayout: true,
      removeWatermark: true,
      customizeMerchandise: false,
      removeBoostifyLogo: false,
    },
    credits: {
      monthlyCredits: 200,
      bonusOnPurchase: 0,
      discountOnOps: 0,
      commissionRate: 15,
    },
    features: [
      { text: 'Everything in Discover', included: true, highlight: true },
      { text: 'Full Artist Hub & Dashboard', included: true },
      { text: 'Custom Profile Themes (20)', included: true },
      { text: 'Drag & Drop Layout', included: true },
      { text: 'No Watermark', included: true },
      { text: 'Spotify Growth Engine (basic)', included: true },
      { text: 'Content Studio (5 posts/mo)', included: true },
      { text: 'Creative Image AI (5/mo)', included: true },
      { text: 'Podcast Studio', included: true },
      { text: 'Contract Templates (3)', included: true },
      { text: 'Merch Store — Sell (5 products)', included: true },
      { text: '200 Credits/month', included: true },
      { text: 'Earn Commissions (15%)', included: true },
    ],
  },

  creator: {
    id: 'creator',
    uiName: 'Elevate',
    tagline: 'Grow your fanbase fast',
    description: 'Serious tools for serious artists',
    monthlyPrice: 49.99,
    yearlyPrice: 499.99,
    yearlySavings: 100,
    level: 2,
    stripePriceIds: {
      monthly: 'price_1R0lay2LyFplWimfQxUL6Hn0',
      yearly: 'price_1Sei7X2LyFplWimfMgbnJvPM',
    },
    limits: {
      songs: 50,
      videos: 25,
      photos: 200,
      themes: 20,
      merchProducts: 15,
      aiImagesPerMonth: 20,
      aiVideosPerMonth: 0,
      musicVideosPerMonth: 3,
      musicMasteringPerMonth: 0,
      faceSwapPerMonth: 0,
      contentPostsPerMonth: 20,
      copyrightChecksPerMonth: 3,
      expertAdvisorsPerMonth: 3,
      aiAgents: 0,
      virtualLabelArtists: 0,
      messagesPerDay: -1,
      coursesAccess: -1,
      dragDropLayout: true,
      removeWatermark: true,
      customizeMerchandise: true,
      removeBoostifyLogo: false,
    },
    credits: {
      monthlyCredits: 500,
      bonusOnPurchase: 5,
      discountOnOps: 0,
      commissionRate: 20,
    },
    features: [
      { text: 'Everything in Artist', included: true, highlight: true },
      { text: 'PR Starter Kit', included: true },
      { text: 'YouTube Growth Tools (basic)', included: true },
      { text: 'Instagram Growth Tools (basic)', included: true },
      { text: 'Content Studio (20 posts/mo)', included: true },
      { text: 'Creative Image AI (20/mo)', included: true },
      { text: 'Music Video Creator (3/mo)', included: true },
      { text: 'Copyright Verification (3/mo)', included: true },
      { text: 'Expert Advisors (3 calls/mo)', included: true },
      { text: 'All Master Classes', included: true },
      { text: 'Merch Store (15 products)', included: true },
      { text: '500 Credits/month', included: true },
    ],
  },

  professional: {
    id: 'professional',
    uiName: 'Amplify',
    tagline: 'Scale your sound globally',
    description: 'Pro tools for career artists',
    monthlyPrice: 89.99,
    yearlyPrice: 899.99,
    yearlySavings: 180,
    level: 3,
    stripePriceIds: {
      monthly: 'price_1R0laz2LyFplWimfsBd5ASoa',
      yearly: 'price_1Sei7X2LyFplWimfL1qscrKR',
    },
    limits: {
      songs: -1,
      videos: -1,
      photos: -1,
      themes: 20,
      merchProducts: 50,
      aiImagesPerMonth: 50,
      aiVideosPerMonth: 5,
      musicVideosPerMonth: 5,
      musicMasteringPerMonth: 5,
      faceSwapPerMonth: 5,
      contentPostsPerMonth: -1,
      copyrightChecksPerMonth: 5,
      expertAdvisorsPerMonth: 10,
      aiAgents: 5,
      virtualLabelArtists: 0,
      messagesPerDay: -1,
      coursesAccess: -1,
      dragDropLayout: true,
      removeWatermark: true,
      customizeMerchandise: true,
      removeBoostifyLogo: true,
    },
    credits: {
      monthlyCredits: 2000,
      bonusOnPurchase: 10,
      discountOnOps: 5,
      commissionRate: 20,
    },
    features: [
      { text: 'Everything in Elevate', included: true, highlight: true },
      { text: 'Pro Analytics Dashboard', included: true },
      { text: 'YouTube Mastery Suite (full)', included: true },
      { text: 'Instagram Domination Suite', included: true },
      { text: 'Spotify Growth Engine (pro)', included: true },
      { text: 'Career Manager Suite', included: true },
      { text: 'Manager & Producer Tools', included: true },
      { text: 'AI Music Video Creator (5/mo)', included: true },
      { text: 'AI Music Generator (10/mo)', included: true },
      { text: 'Music Mastering (5/mo)', included: true },
      { text: 'Image Generator Pro (50/mo)', included: true },
      { text: 'Face Swap Tool (5/mo)', included: true },
      { text: 'Professional Video Editor', included: true },
      { text: 'AI Agents (5)', included: true },
      { text: 'Expert Advisors (10/mo)', included: true },
      { text: 'Smart Cards & Translator', included: true },
      { text: 'Unlimited Uploads', included: true },
      { text: '2,000 Credits/month', included: true },
    ],
  },

  enterprise: {
    id: 'enterprise',
    uiName: 'Dominate',
    tagline: 'Rule the music industry',
    description: 'Your full AI-powered empire',
    monthlyPrice: 149.99,
    yearlyPrice: 1499.99,
    yearlySavings: 300,
    level: 4,
    stripePriceIds: {
      monthly: 'price_1Sei8R2LyFplWimfXK8dAE06',
      yearly: 'price_1Sei8R2LyFplWimf15fDEJDL',
    },
    limits: {
      songs: -1,
      videos: -1,
      photos: -1,
      themes: 20,
      merchProducts: -1,
      aiImagesPerMonth: -1,
      aiVideosPerMonth: -1,
      musicVideosPerMonth: -1,
      musicMasteringPerMonth: -1,
      faceSwapPerMonth: -1,
      contentPostsPerMonth: -1,
      copyrightChecksPerMonth: -1,
      expertAdvisorsPerMonth: -1,
      aiAgents: -1,
      virtualLabelArtists: 10,
      messagesPerDay: -1,
      coursesAccess: -1,
      dragDropLayout: true,
      removeWatermark: true,
      customizeMerchandise: true,
      removeBoostifyLogo: true,
    },
    credits: {
      monthlyCredits: 10000,
      bonusOnPurchase: 20,
      discountOnOps: 15,
      commissionRate: 20,
    },
    features: [
      { text: 'Everything in Amplify', included: true, highlight: true },
      { text: 'Virtual Record Label (10 AI artists)', included: true },
      { text: 'AI Artist Generator Pro', included: true },
      { text: 'Label Dashboard & B2B Licensing', included: true },
      { text: 'AI Agent Suite — Unlimited', included: true },
      { text: 'Expert Advisors — Unlimited', included: true },
      { text: 'Motion DNA (Premium AI)', included: true },
      { text: 'Kling AI Video Tools', included: true },
      { text: 'All Creative Tools — Unlimited', included: true },
      { text: 'BoostiSwap DEX & BTF Wallet', included: true },
      { text: 'Artist NFT Minting & Tokenization', included: true },
      { text: 'Enterprise Analytics', included: true },
      { text: 'Global Ecosystem Hub', included: true },
      { text: 'VIP 24/7 Priority Support', included: true },
      { text: '10,000 Credits/month (15% discount)', included: true },
    ],
  },
};

// ============================================
// PLAN ARRAYS & HELPERS
// ============================================

/** Ordered list of plans (for UI) */
export const PLAN_LIST: PlanDefinition[] = [
  PLANS.free,
  PLANS.artist,
  PLANS.creator,
  PLANS.professional,
  PLANS.enterprise,
];

/** All valid plan IDs */
export const ALL_PLAN_IDS: PlanId[] = ['free', 'artist', 'creator', 'professional', 'enterprise'];

// ============================================
// LEGACY PLAN MAPPING
// ============================================

/** Map any legacy or alias name to canonical PlanId */
export const LEGACY_TO_PLAN: Record<string, PlanId> = {
  // Canonical
  'free': 'free',
  'artist': 'artist',
  'creator': 'creator',
  'professional': 'professional',
  'enterprise': 'enterprise',
  // Legacy aliases
  'basic': 'creator',         // Old "basic" → now "creator" (Elevate)
  'pro': 'professional',      // Old "pro" → now "professional" (Amplify)
  'premium': 'enterprise',    // Old "premium" → now "enterprise" (Dominate)
  // UI name aliases (lowercase)
  'discover': 'free',
  'elevate': 'creator',
  'amplify': 'professional',
  'dominate': 'enterprise',
};

/** Normalize any plan name to canonical PlanId */
export function normalizePlan(plan: string | null | undefined): PlanId {
  if (!plan) return 'free';
  return LEGACY_TO_PLAN[plan.toLowerCase()] || 'free';
}

/** Get plan definition from any name */
export function getPlan(plan: string | null | undefined): PlanDefinition {
  return PLANS[normalizePlan(plan)];
}

/** Get plan level from any name */
export function getPlanLevel(plan: string | null | undefined): number {
  return getPlan(plan).level;
}

/** Check if currentPlan has access to a feature requiring requiredPlan */
export function hasPlanAccess(currentPlan: string | null | undefined, requiredPlan: string | null | undefined): boolean {
  if (!requiredPlan) return true;
  return getPlanLevel(currentPlan) >= getPlanLevel(requiredPlan);
}

/** Get UI display name for any plan identifier */
export function getPlanDisplayName(plan: string | null | undefined): string {
  return getPlan(plan).uiName;
}

// ============================================
// ROUTE ACCESS MAP
// ============================================

/**
 * Minimum plan required per route.
 * null = public (no auth needed)
 * 'free' = requires login only
 * 'artist'|'creator'|'professional'|'enterprise' = requires that plan or higher
 */
export const ROUTE_PLAN_MAP: Record<string, PlanId | null> = {
  // ── PUBLIC (no auth) ──
  '/': null,
  '/auth': null,
  '/login': null,
  '/pricing': null,
  '/terms': null,
  '/privacy': null,
  '/privacy/extension': null,
  '/cookies': null,
  '/features': null,
  '/resources': null,
  '/tips': null,
  '/guides': null,
  '/tools': null,
  '/article/:id': null,
  '/profile/:id': null,
  '/artist/:slug': null,
  '/artist/:slug/store': null,
  '/artist-setup': null,
  '/videoservice': null,
  '/videoservice/success': null,
  '/boostify-explicit': null,
  '/music-video-pricing': null,
  '/diagnostics': null,
  '/boostiswap': null,
  '/debug-firebase': null,
  '/admin': null,
  '/affiliate-admin': null,
  '/investors-dashboard': null,
  '/sponsor/proposal/:dealId': null,
  '/venue-proposal/:dealId': null,
  '/verify/:hash': null,
  '/product-success': null,
  '/product-cancelled': null,
  '/token-purchase-success': null,

  // ── FREE (auth required, no subscription) ──
  '/dashboard': 'free',
  '/profile': 'free',
  '/settings': 'free',
  '/messages': 'free',
  '/account': 'free',
  '/my-artist': 'free',
  '/my-artists': 'free',
  '/subscription/success': 'free',
  '/subscription/cancelled': 'free',
  '/subscription/example': 'free',
  '/music-video-success': 'free',
  '/music-video-cancelled': 'free',
  '/boostify-tv': 'free',
  '/social-network': 'free',
  '/firestore-social': 'free',
  '/education': 'free',
  '/blog': 'free',
  '/news': 'free',
  '/events': 'free',
  '/store': 'free',
  '/affiliates': 'free',
  '/affiliates-new': 'free',
  '/spotify': 'free',
  '/youtube-views': 'free',
  '/instagram-boost': 'free',

  // ── ARTIST ($19.99) ──
  '/artist-dashboard': 'artist',
  '/live-podcast-studio': 'artist',
  '/podcast-episodes': 'artist',
  '/contracts': 'artist',
  '/videos': 'artist',
  '/social-media-generator': 'artist',
  '/image-generator-simple': 'artist',
  '/artist-image-advisor': 'artist',
  '/artist-image-advisor-improved': 'artist',
  '/merchandise': 'artist',
  '/course/:id': 'artist',

  // ── ELEVATE / CREATOR ($49.99) ──
  '/pr': 'creator',
  '/promotion': 'creator',
  '/copyright-verify': 'creator',
  '/music-video-creator': 'creator',
  '/music-video-workflow': 'creator',
  '/music-video-flow': 'creator',
  '/ai-advisors': 'creator',
  '/ai-advisors-v2': 'creator',
  '/achievements': 'creator',

  // ── AMPLIFY / PROFESSIONAL ($89.99) ──
  '/analytics': 'professional',
  '/global': 'professional',
  '/financial-enablement': 'professional',
  '/manager-tools': 'professional',
  '/producer-tools': 'professional',
  '/music-generator': 'professional',
  '/music-mastering': 'professional',
  '/image-generator': 'professional',
  '/face-swap': 'professional',
  '/professional-editor': 'professional',
  '/smart-cards': 'professional',
  '/translator': 'professional',
  '/ai-agents': 'professional',
  '/ai-video-creation': 'professional',

  // ── DOMINATE / ENTERPRISE ($149.99) ──
  '/virtual-record-label': 'enterprise',
  '/vrl': 'enterprise',
  '/record-label-services': 'enterprise',
  '/artist-generator': 'enterprise',
  '/motion-dna': 'enterprise',
  '/kling-tools': 'enterprise',
  '/kling-store': 'enterprise',
  '/ecosystem': 'enterprise',
  '/boostify-international': 'enterprise',
  '/contacts': 'enterprise',
  '/tokenization': 'enterprise',
  '/btf-wallet': 'enterprise',
  '/btf-staking': 'enterprise',
  '/btf-artist-mint': 'enterprise',
};

// ============================================
// INDIVIDUAL TOOL PLANS (pay-per-tool)
// ============================================

export interface IndividualToolPlan {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  category: 'growth' | 'creation' | 'analytics' | 'ai' | 'web3';
  routes: string[];                    // Routes unlocked by this tool plan
  stripePriceId: string | null;       // Will need real Stripe IDs
  minPlan: PlanId;                    // Minimum plan that includes this tool
}

export const INDIVIDUAL_TOOL_PLANS: IndividualToolPlan[] = [
  {
    id: 'tool_spotify',
    name: 'Spotify Growth Engine',
    description: 'Spotify playlist pitching, analytics & growth tools',
    monthlyPrice: 9.99,
    category: 'growth',
    routes: ['/spotify'],
    stripePriceId: null,
    minPlan: 'free',
  },
  {
    id: 'tool_youtube',
    name: 'YouTube Mastery Suite',
    description: 'YouTube analytics, SEO optimization & growth',
    monthlyPrice: 9.99,
    category: 'growth',
    routes: ['/youtube-views'],
    stripePriceId: null,
    minPlan: 'free',
  },
  {
    id: 'tool_instagram',
    name: 'Instagram Domination',
    description: 'Instagram growth automation & analytics',
    monthlyPrice: 9.99,
    category: 'growth',
    routes: ['/instagram-boost'],
    stripePriceId: null,
    minPlan: 'free',
  },
  {
    id: 'tool_video_creator',
    name: 'Music Video Creator',
    description: 'AI-powered music video generation',
    monthlyPrice: 14.99,
    category: 'creation',
    routes: ['/music-video-creator', '/music-video-workflow', '/music-video-flow'],
    stripePriceId: null,
    minPlan: 'creator',
  },
  {
    id: 'tool_ai_images',
    name: 'AI Image Studio',
    description: 'AI image generation, face swap & editing',
    monthlyPrice: 9.99,
    category: 'creation',
    routes: ['/image-generator', '/image-generator-simple', '/face-swap'],
    stripePriceId: null,
    minPlan: 'artist',
  },
  {
    id: 'tool_analytics',
    name: 'Pro Analytics',
    description: 'Advanced analytics and financial tools',
    monthlyPrice: 14.99,
    category: 'analytics',
    routes: ['/analytics', '/global', '/financial-enablement'],
    stripePriceId: null,
    minPlan: 'professional',
  },
  {
    id: 'tool_ai_advisors',
    name: 'Expert Advisors',
    description: 'AI-powered music industry expert consultations',
    monthlyPrice: 9.99,
    category: 'ai',
    routes: ['/ai-advisors', '/ai-advisors-v2'],
    stripePriceId: null,
    minPlan: 'creator',
  },
  {
    id: 'tool_music_production',
    name: 'Music Production Lab',
    description: 'AI music generation & professional mastering',
    monthlyPrice: 14.99,
    category: 'creation',
    routes: ['/music-generator', '/music-mastering'],
    stripePriceId: null,
    minPlan: 'professional',
  },
];
