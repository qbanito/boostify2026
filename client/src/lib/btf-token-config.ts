/**
 * BTF Token Configuration — Boostify Music Ecosystem Currency
 * 
 * Deployed on Polygon Mainnet (Chain 137)
 * BTFToken:        0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05
 * BTFStakingVault: 0x493b942d85d6D8D2E221f2b0FF4192dFBc1BfAAa
 */

// ═══════════════════════════════════════════════════════
//  CONTRACT ADDRESSES
// ═══════════════════════════════════════════════════════

export const BTF_TOKEN_ADDRESS = '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05' as const;
export const BTF_STAKING_VAULT_ADDRESS = '0x493b942d85d6D8D2E221f2b0FF4192dFBc1BfAAa' as const;
export const BTF_CHAIN_ID = 137;

/**
 * BTFTokenSale — Direct purchase contract (MATIC → BTF at fixed rate)
 * Deployed on Polygon Mainnet: 1 MATIC = 1000 BTF
 * Funded with 1,000,000 BTF
 */
export const BTF_SALE_ADDRESS = '0x2a434268ED7d16a5d5CB8f6143E4535BDe16239d' as const;

// ═══════════════════════════════════════════════════════
//  TOKEN METADATA
// ═══════════════════════════════════════════════════════

export const BTF_TOKEN_META = {
  name: 'Boostify Token',
  symbol: 'BTF',
  decimals: 18,
  totalSupply: '100000000',
  chainId: 137,
  image: '/btf_logo.png',
} as const;

// ═══════════════════════════════════════════════════════
//  STAKING TIERS
// ═══════════════════════════════════════════════════════

export type StakingTier = 'None' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export const STAKING_TIERS: Record<StakingTier, {
  threshold: number;
  color: string;
  gradient: string;
  icon: string;
  benefits: string[];
}> = {
  None: {
    threshold: 0,
    color: '#6B7280',
    gradient: 'from-gray-400 to-gray-600',
    icon: '○',
    benefits: [],
  },
  Bronze: {
    threshold: 100,
    color: '#CD7F32',
    gradient: 'from-amber-600 to-amber-800',
    icon: '🥉',
    benefits: ['Verified badge', 'Basic analytics', 'Community access'],
  },
  Silver: {
    threshold: 500,
    color: '#C0C0C0',
    gradient: 'from-gray-300 to-gray-500',
    icon: '🥈',
    benefits: ['Radio priority', '20% service discount', 'Priority support'],
  },
  Gold: {
    threshold: 2000,
    color: '#FFD700',
    gradient: 'from-yellow-400 to-yellow-600',
    icon: '🥇',
    benefits: ['Free AI videos', 'Homepage featuring', '40% service discount', 'Early access'],
  },
  Platinum: {
    threshold: 10000,
    color: '#E5E4E2',
    gradient: 'from-purple-300 to-purple-500',
    icon: '💎',
    benefits: ['Revenue share', 'DAO voting', 'VIP support', 'All discounts free', 'Exclusive events'],
  },
};

export const LOCK_PERIODS = [
  { days: 30, label: '30 Days', seconds: 2592000, apyBps: 800, apy: '8%' },
  { days: 90, label: '90 Days', seconds: 7776000, apyBps: 1500, apy: '15%' },
  { days: 180, label: '180 Days', seconds: 15552000, apyBps: 2500, apy: '25%' },
  { days: 365, label: '365 Days', seconds: 31536000, apyBps: 4000, apy: '40%' },
] as const;

export function getTierForAmount(amount: number): StakingTier {
  if (amount >= 10000) return 'Platinum';
  if (amount >= 2000) return 'Gold';
  if (amount >= 500) return 'Silver';
  if (amount >= 100) return 'Bronze';
  return 'None';
}

// ═══════════════════════════════════════════════════════
//  BTF TOKEN ABI (ERC-20 + custom functions)
// ═══════════════════════════════════════════════════════

export const BTF_TOKEN_ABI = [
  // ERC-20 Standard
  { inputs: [{ name: 'account', type: 'address' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'name', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'symbol', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'decimals', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transfer', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'owner', type: 'address' }, { name: 'spender', type: 'address' }], name: 'allowance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'from', type: 'address' }, { name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'transferFrom', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },

  // BTF Custom Read
  { inputs: [], name: 'totalBurned', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'ecosystemRewardsDistributed', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'ecosystemRewardsRemaining', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'transferBurnBps', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'serviceBurnBps', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'maxWalletAmount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'circulatingSupply', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [],
    name: 'getTokenStats',
    outputs: [
      { name: '_totalSupply', type: 'uint256' },
      { name: '_totalBurned', type: 'uint256' },
      { name: '_ecosystemDistributed', type: 'uint256' },
      { name: '_ecosystemRemaining', type: 'uint256' },
      { name: '_transferBurnBps', type: 'uint256' },
      { name: '_serviceBurnBps', type: 'uint256' },
      { name: '_maxWalletBps', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },

  // BTF Write
  { inputs: [{ name: 'amount', type: 'uint256' }, { name: 'service', type: 'string' }], name: 'payForService', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [], name: 'releaseVested', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: true, name: 'to', type: 'address' }, { indexed: false, name: 'value', type: 'uint256' }], name: 'Transfer', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'from', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'reason', type: 'string' }], name: 'TokensBurned', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'artist', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'action', type: 'string' }], name: 'EcosystemReward', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'payer', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'burned', type: 'uint256' }, { indexed: false, name: 'service', type: 'string' }], name: 'ServicePayment', type: 'event' },
] as const;

// ═══════════════════════════════════════════════════════
//  STAKING VAULT ABI
// ═══════════════════════════════════════════════════════

export const BTF_STAKING_VAULT_ABI = [
  // Read
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserTier', outputs: [{ name: '', type: 'uint8' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'tier', type: 'uint8' }], name: 'getTierName', outputs: [{ name: '', type: 'string' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'getUserStakeCount', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }], name: 'userTotalStaked', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'user', type: 'address' }, { name: 'index', type: 'uint256' }], name: 'pendingRewards', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  {
    inputs: [{ name: 'user', type: 'address' }, { name: 'index', type: 'uint256' }],
    name: 'getUserStake',
    outputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'lockPeriod', type: 'uint256' },
      { name: 'stakedAt', type: 'uint256' },
      { name: 'lockEndsAt', type: 'uint256' },
      { name: 'accruedRewards', type: 'uint256' },
      { name: 'pendingReward', type: 'uint256' },
      { name: 'active', type: 'bool' },
      { name: 'isLocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'user', type: 'address' }],
    name: 'getUserDashboard',
    outputs: [
      { name: '_totalStaked', type: 'uint256' },
      { name: '_tier', type: 'uint8' },
      { name: '_stakeCount', type: 'uint256' },
      { name: '_totalPendingRewards', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getVaultStats',
    outputs: [
      { name: '_totalStaked', type: 'uint256' },
      { name: '_totalStakers', type: 'uint256' },
      { name: '_totalRewardsDistributed', type: 'uint256' },
      { name: '_totalPenaltyBurned', type: 'uint256' },
      { name: '_rewardsPoolBalance', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  { inputs: [], name: 'totalStaked', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'totalStakers', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'rewardsPool', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'period', type: 'uint256' }], name: 'lockPeriodAPY', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },

  // Write
  { inputs: [{ name: 'amount', type: 'uint256' }, { name: 'lockPeriod', type: 'uint256' }], name: 'stake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'stakeIndex', type: 'uint256' }], name: 'unstake', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'stakeIndex', type: 'uint256' }], name: 'claimRewards', outputs: [], stateMutability: 'nonpayable', type: 'function' },

  // Events
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'lockPeriod', type: 'uint256' }, { indexed: false, name: 'stakeIndex', type: 'uint256' }], name: 'Staked', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'rewards', type: 'uint256' }, { indexed: false, name: 'penalty', type: 'uint256' }, { indexed: false, name: 'stakeIndex', type: 'uint256' }], name: 'Unstaked', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'amount', type: 'uint256' }, { indexed: false, name: 'stakeIndex', type: 'uint256' }], name: 'RewardsClaimed', type: 'event' },
  { anonymous: false, inputs: [{ indexed: true, name: 'user', type: 'address' }, { indexed: false, name: 'tier', type: 'uint8' }, { indexed: false, name: 'totalStaked', type: 'uint256' }], name: 'TierAchieved', type: 'event' },
] as const;