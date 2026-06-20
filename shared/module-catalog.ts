/**
 * BOOSTIFY MUSIC — Module Unlock Catalog (Single Source of Truth)
 * ================================================================
 * Defines the platform modules that can be unlocked with a ONE-TIME payment
 * (lifetime access), as an alternative to a recurring subscription.
 *
 * Access rule (the "perfect plan"):
 *  - A subscription that covers the module's `requiredPlan` (or higher) → access.
 *  - A one-time module unlock (this catalog) → lifetime access to that module.
 *  - The ALL-ACCESS lifetime pass → every module forever.
 *  - Admins → everything.
 *
 * Heavy AI compute (video/music/image renders) stays credit-metered even after
 * an unlock — unlocking grants ACCESS to the studio, not unlimited generations.
 */
import type { PlanId } from './plan-config';
import { getPlanLevel } from './plan-config';

export const ALL_ACCESS_KEY = 'all-access';

export interface ModuleDefinition {
  /** Stable key used in DB + Stripe metadata + ModuleGate prop. */
  key: string;
  /** Display name. */
  name: string;
  /** Short value-prop shown in the paywall. */
  description: string;
  /** App route this module lives at (for deep-links). */
  route: string;
  /** Subscription tier that includes this module (for "Subscribe" upsell). */
  requiredPlan: PlanId;
  /** One-time unlock price in cents. */
  unlockPriceCents: number;
  /** lucide-react icon name (resolved on the client). */
  icon: string;
  /** Optional note shown under the price (e.g. credit metering). */
  note?: string;
}

/**
 * The unlockable modules. Prices are intentionally ~1.5–3 months of the tier
 * that includes them, so the subscription always remains the better deal.
 */
export const MODULE_CATALOG: ModuleDefinition[] = [
  {
    key: 'music-video-creator',
    name: 'Music Video Creator',
    description: 'AI music video studio: scenes, storyboards, lip-sync and full timeline editor.',
    route: '/music-video-creator',
    requiredPlan: 'creator',
    unlockPriceCents: 4900,
    icon: 'Clapperboard',
    note: 'Renders consume credits or per-video pricing.',
  },
  {
    key: 'ai-music-generator',
    name: 'AI Music Generator',
    description: 'Generate original songs and instrumentals with AI.',
    route: '/music-generator',
    requiredPlan: 'professional',
    unlockPriceCents: 3900,
    icon: 'Music',
    note: 'Generations consume credits.',
  },
  {
    key: 'producer-tools',
    name: 'Producer Tools + Mastering',
    description: 'Pro audio suite: mixing, AI mastering and stem tools.',
    route: '/producer-tools',
    requiredPlan: 'professional',
    unlockPriceCents: 5900,
    icon: 'SlidersHorizontal',
  },
  {
    key: 'analytics-observatory',
    name: 'Analytics Observatory',
    description: 'Deep audience, streaming and revenue analytics.',
    route: '/analytics',
    requiredPlan: 'professional',
    unlockPriceCents: 4900,
    icon: 'Activity',
  },
  {
    key: 'ai-agents',
    name: 'AI Agents · C-Suite',
    description: 'Autonomous AI team that runs your growth, content and revenue.',
    route: '/ai-agents',
    requiredPlan: 'professional',
    unlockPriceCents: 7900,
    icon: 'Bot',
    note: 'Agent actions consume credits.',
  },
  {
    key: 'hologram-show-engine',
    name: 'Hologram Show Engine',
    description: 'Holographic live-show experience with a rotatable 3D avatar.',
    route: '/hologram-show-engine',
    requiredPlan: 'enterprise',
    unlockPriceCents: 6900,
    icon: 'Sparkles',
  },
  {
    key: 'artist-generator',
    name: 'AI Artist Generator',
    description: 'Create a complete AI artist: identity, image, voice and catalog.',
    route: '/artist-generator',
    requiredPlan: 'enterprise',
    unlockPriceCents: 9900,
    icon: 'Wand2',
    note: 'Generations consume credits.',
  },
  {
    key: 'virtual-record-label',
    name: 'Virtual Record Label',
    description: 'Run a full virtual label: roster, releases and distribution.',
    route: '/virtual-record-label',
    requiredPlan: 'enterprise',
    unlockPriceCents: 12900,
    icon: 'Building2',
  },
  {
    key: 'tokenization',
    name: 'Tokenization · Web3',
    description: 'Tokenize songs and access the BTF Web3 ecosystem.',
    route: '/tokenization',
    requiredPlan: 'enterprise',
    unlockPriceCents: 9900,
    icon: 'Coins',
  },
  {
    key: 'fashion-store',
    name: 'Fashion Virtual Store',
    description: 'One-click AI fashion universe: brand, drops, products and campaign.',
    route: '/store',
    requiredPlan: 'creator',
    unlockPriceCents: 4900,
    icon: 'Shirt',
    note: 'Image generations consume credits.',
  },
  {
    key: 'karaoke-studio',
    name: 'Karaoke Studio',
    description: 'Turn any song into a synced karaoke experience.',
    route: '/artist-dashboard',
    requiredPlan: 'creator',
    unlockPriceCents: 2400,
    icon: 'Mic2',
  },
];

/** The all-access lifetime pass — unlocks every current module. */
export const ALL_ACCESS_PASS = {
  key: ALL_ACCESS_KEY,
  name: 'All-Access Lifetime Pass',
  description: 'Every premium module on Boostify — unlocked forever, no subscription.',
  unlockPriceCents: 39900,
  icon: 'Crown',
};

export const MODULE_MAP: Record<string, ModuleDefinition> = Object.fromEntries(
  MODULE_CATALOG.map((m) => [m.key, m]),
);

/** Lookup a module by key (undefined for unknown keys; all-access is separate). */
export function getModule(key: string): ModuleDefinition | undefined {
  return MODULE_MAP[key];
}

/** Is this a valid unlockable key (a module or the all-access pass)? */
export function isValidModuleKey(key: string): boolean {
  return key === ALL_ACCESS_KEY || key in MODULE_MAP;
}

/** Unlock price in cents for any valid key. */
export function getUnlockPriceCents(key: string): number | null {
  if (key === ALL_ACCESS_KEY) return ALL_ACCESS_PASS.unlockPriceCents;
  return MODULE_MAP[key]?.unlockPriceCents ?? null;
}

/**
 * Resolve module access from the three sources of truth.
 * @param moduleKey       the module being gated
 * @param currentPlan     the user's subscription plan id (or null)
 * @param unlockedKeys    keys the user has one-time unlocked (may include all-access)
 * @param isAdmin         admin override
 */
export function resolveModuleAccess(
  moduleKey: string,
  currentPlan: string | null | undefined,
  unlockedKeys: string[] | undefined,
  isAdmin = false,
): boolean {
  if (isAdmin) return true;
  const keys = unlockedKeys || [];
  if (keys.includes(ALL_ACCESS_KEY)) return true;
  if (keys.includes(moduleKey)) return true;
  const mod = MODULE_MAP[moduleKey];
  if (!mod) return false;
  return getPlanLevel(currentPlan) >= getPlanLevel(mod.requiredPlan);
}
