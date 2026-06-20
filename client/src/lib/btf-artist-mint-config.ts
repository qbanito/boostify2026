/**
 * BTF AI Artist Mint Config V2 — Continuous Bonding + Value Appreciation
 *
 * Contains:
 * - Contract address & ABI (V2)
 * - Tier definitions with step increases
 * - Distribution constants (4-way)
 * - Activity value mappings
 * - Helper functions
 */

// ═══════════════════════════════════════════════════════
//  CONTRACT ADDRESS
// ═══════════════════════════════════════════════════════

// Deployed on Polygon Mainnet — 2026-02-11
export const BTF_ARTIST_MINTER_ADDRESS = '0xeFE401C7cF872978e8ab51d08eE740B0B59987B9' as `0x${string}`;

// BTF Token (already deployed on Polygon)
export const BTF_TOKEN_ADDRESS = '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05';
export const BTF_CHAIN_ID = 137; // Polygon Mainnet

// ═══════════════════════════════════════════════════════
//  SUPPLY CONSTANTS
// ═══════════════════════════════════════════════════════

export const MAX_ARTISTS = 1000;
export const PUBLIC_SUPPLY = 800;
export const PLATFORM_RESERVE = 200;
export const MAX_PER_WALLET = 5;

// ═══════════════════════════════════════════════════════
//  CONTINUOUS BONDING CURVE TIERS
// ═══════════════════════════════════════════════════════

export interface MintTier {
  tier: number;
  name: string;
  label: string;
  basePriceBTF: number;
  stepIncrease: number;  // BTF increase per mint within tier
  startId: number;       // Public mint start (1-based)
  endId: number;         // Public mint end (inclusive)
  count: number;
  color: string;
  gradient: string;
  emoji: string;
  usdEstimate: string;   // estimated at tier start
  maxPriceBTF: number;   // price of the LAST artist in this tier
}

export const MINT_TIERS: MintTier[] = [
  {
    tier: 1,
    name: 'Common',
    label: 'Tier 1 — Common',
    basePriceBTF: 2000,
    stepIncrease: 10,
    startId: 1,
    endId: 160,
    count: 160,
    color: '#8B5CF6',
    gradient: 'from-purple-400 to-violet-600',
    emoji: '🟣',
    usdEstimate: '~$200',
    maxPriceBTF: 2000 + (159 * 10), // 3,590
  },
  {
    tier: 2,
    name: 'Uncommon',
    label: 'Tier 2 — Uncommon',
    basePriceBTF: 3500,
    stepIncrease: 20,
    startId: 161,
    endId: 400,
    count: 240,
    color: '#22C55E',
    gradient: 'from-green-400 to-emerald-600',
    emoji: '🟢',
    usdEstimate: '~$350',
    maxPriceBTF: 3500 + (239 * 20), // 8,280
  },
  {
    tier: 3,
    name: 'Rare',
    label: 'Tier 3 — Rare',
    basePriceBTF: 6000,
    stepIncrease: 40,
    startId: 401,
    endId: 600,
    count: 200,
    color: '#3B82F6',
    gradient: 'from-blue-400 to-blue-600',
    emoji: '🔵',
    usdEstimate: '~$600',
    maxPriceBTF: 6000 + (199 * 40), // 13,960
  },
  {
    tier: 4,
    name: 'Epic',
    label: 'Tier 4 — Epic',
    basePriceBTF: 10000,
    stepIncrease: 80,
    startId: 601,
    endId: 720,
    count: 120,
    color: '#A855F7',
    gradient: 'from-purple-400 to-purple-600',
    emoji: '💎',
    usdEstimate: '~$1,000',
    maxPriceBTF: 10000 + (119 * 80), // 19,520
  },
  {
    tier: 5,
    name: 'Legendary',
    label: 'Tier 5 — Legendary',
    basePriceBTF: 20000,
    stepIncrease: 150,
    startId: 721,
    endId: 800,
    count: 80,
    color: '#F59E0B',
    gradient: 'from-yellow-400 to-amber-600',
    emoji: '🏆',
    usdEstimate: '~$2,000',
    maxPriceBTF: 20000 + (79 * 150), // 31,850
  },
];

export function getTierForPublicMint(num: number): MintTier {
  return MINT_TIERS.find(t => num >= t.startId && num <= t.endId) || MINT_TIERS[0];
}

export function getCurrentTierFromMinted(publicMinted: number): MintTier {
  return getTierForPublicMint(publicMinted + 1);
}

/**
 * Calculate the exact price for a given public mint number
 */
export function getPriceForMint(publicNumber: number): number {
  const tier = getTierForPublicMint(publicNumber);
  const positionInTier = publicNumber - tier.startId;
  return tier.basePriceBTF + positionInTier * tier.stepIncrease;
}

// ═══════════════════════════════════════════════════════
//  TOKEN DISTRIBUTION (4-WAY V2)
// ═══════════════════════════════════════════════════════

export const DISTRIBUTION = {
  burn: { bps: 4000, percent: 40, label: '🔥 Burned Forever', color: '#EF4444' },
  staking: { bps: 3000, percent: 30, label: '💰 Staking Rewards', color: '#22C55E' },
  treasury: { bps: 2000, percent: 20, label: '🏦 Platform Treasury', color: '#3B82F6' },
  reserve: { bps: 1000, percent: 10, label: '🏗️ Reserve Fund', color: '#F59E0B' },
} as const;

// ═══════════════════════════════════════════════════════
//  ACTIVITY VALUES (for artist value appreciation)
// ═══════════════════════════════════════════════════════

export const ACTIVITY_VALUES = {
  song_created: { points: 50, label: '🎵 Song Created', emoji: '🎵' },
  video_created: { points: 200, label: '🎬 Video Created', emoji: '🎬' },
  collab_completed: { points: 100, label: '🤝 Collaboration', emoji: '🤝' },
  fan_interaction: { points: 25, label: '💬 Fan Interaction', emoji: '💬' },
  merch_sold: { points: 75, label: '👕 Merch Sold', emoji: '👕' },
  stream_milestone: { points: 150, label: '📈 Stream Milestone', emoji: '📈' },
} as const;

// ═══════════════════════════════════════════════════════
//  ABI — BTFArtistMinter V2
// ═══════════════════════════════════════════════════════

export const BTF_ARTIST_MINTER_ABI = [
  // ── Read functions ──
  { inputs: [], name: 'MAX_ARTISTS', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PUBLIC_SUPPLY', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'PLATFORM_RESERVE', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'publicMinted', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'platformMinted', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalMinted', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'maxPerWallet', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'globalValueScore', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getCurrentPrice', outputs: [{ name: 'price', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'getCurrentTier', outputs: [{ name: 'tier', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'publicNumber', type: 'uint256' }], name: 'getPriceForPublicMint', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'pure', type: 'function' },
  { inputs: [], name: 'remainingPublicSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'remainingPlatformReserve', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'ownerMintCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }], name: 'getOwnerArtists', outputs: [{ name: '', type: 'uint256[]' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'id', type: 'uint256' }],
    name: 'artists',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'owner', type: 'address' },
      { name: 'mintedAt', type: 'uint256' },
      { name: 'pricePaid', type: 'uint256' },
      { name: 'tier', type: 'uint256' },
      { name: 'artistName', type: 'string' },
      { name: 'genre', type: 'string' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPlatformReserve', type: 'bool' },
      { name: 'valueScore', type: 'uint256' },
      { name: 'totalSongs', type: 'uint256' },
      { name: 'totalVideos', type: 'uint256' },
      { name: 'totalCollabs', type: 'uint256' },
      { name: 'totalInteractions', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'artistId', type: 'uint256' }],
    name: 'getArtistFull',
    outputs: [
      { name: 'id', type: 'uint256' },
      { name: 'owner', type: 'address' },
      { name: 'mintedAt', type: 'uint256' },
      { name: 'pricePaid', type: 'uint256' },
      { name: 'tier', type: 'uint256' },
      { name: 'artistName', type: 'string' },
      { name: 'genre', type: 'string' },
      { name: 'isActive', type: 'bool' },
      { name: 'isPlatformReserve', type: 'bool' },
      { name: 'valueScore', type: 'uint256' },
      { name: 'totalSongs', type: 'uint256' },
      { name: 'totalVideos', type: 'uint256' },
      { name: 'totalCollabs', type: 'uint256' },
      { name: 'totalInteractions', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getMintStats',
    outputs: [
      { name: '_publicMinted', type: 'uint256' },
      { name: '_remainingPublic', type: 'uint256' },
      { name: '_currentPrice', type: 'uint256' },
      { name: '_currentTier', type: 'uint256' },
      { name: '_totalCollected', type: 'uint256' },
      { name: '_totalBurned', type: 'uint256' },
      { name: '_totalToStaking', type: 'uint256' },
      { name: '_totalToTreasury', type: 'uint256' },
      { name: '_platformMinted', type: 'uint256' },
      { name: '_remainingPlatform', type: 'uint256' },
      { name: '_totalToReserve', type: 'uint256' },
      { name: '_globalValueScore', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getBondingCurve',
    outputs: [
      { name: 'basePrices', type: 'uint256[5]' },
      { name: 'steps', type: 'uint256[5]' },
      { name: 'boundaries', type: 'uint256[5]' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },

  // ── Write functions ──
  {
    inputs: [
      { name: 'artistName', type: 'string' },
      { name: 'genre', type: 'string' },
    ],
    name: 'mintArtist',
    outputs: [{ name: 'artistId', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  { inputs: [{ name: 'artistId', type: 'uint256' }], name: 'deactivateArtist', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'artistId', type: 'uint256' }], name: 'reactivateArtist', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'artistId', type: 'uint256' }, { name: 'newOwner', type: 'address' }], name: 'transferArtist', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // ── Events ──
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'artistId', type: 'uint256' },
      { indexed: true, name: 'owner', type: 'address' },
      { indexed: false, name: 'artistName', type: 'string' },
      { indexed: false, name: 'genre', type: 'string' },
      { indexed: false, name: 'pricePaid', type: 'uint256' },
      { indexed: false, name: 'tier', type: 'uint256' },
      { indexed: false, name: 'burned', type: 'uint256' },
      { indexed: false, name: 'toStaking', type: 'uint256' },
      { indexed: false, name: 'toTreasury', type: 'uint256' },
      { indexed: false, name: 'toReserve', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'ArtistMinted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'artistId', type: 'uint256' },
      { indexed: false, name: 'artistName', type: 'string' },
      { indexed: false, name: 'genre', type: 'string' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'PlatformArtistMinted',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'artistId', type: 'uint256' },
      { indexed: false, name: 'activityType', type: 'string' },
      { indexed: false, name: 'valueAdded', type: 'uint256' },
      { indexed: false, name: 'newTotalValue', type: 'uint256' },
    ],
    name: 'ActivityRecorded',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'artistId', type: 'uint256' },
      { indexed: true, name: 'from', type: 'address' },
      { indexed: true, name: 'to', type: 'address' },
    ],
    name: 'ArtistTransferred',
    type: 'event',
  },
] as const;
