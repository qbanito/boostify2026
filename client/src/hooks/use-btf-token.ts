/**
 * useBTFToken - Hook para interactuar con BTF Token + Staking Vault en Polygon
 * 
 * Proporciona:
 * - Balance BTF del usuario
 * - Token stats (supply, burns, rewards)
 * - Staking: stake, unstake, claimRewards
 * - Dashboard del usuario (tier, stakes, rewards)
 * - Vault stats globales
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { parseEther, formatEther, createPublicClient, http, createWalletClient, custom, fallback } from 'viem';
import { polygon } from 'viem/chains';
import { useWeb3 } from './use-web3';
import { useToast } from './use-toast';
import {
  BTF_TOKEN_ADDRESS,
  BTF_STAKING_VAULT_ADDRESS,
  BTF_TOKEN_ABI,
  BTF_STAKING_VAULT_ABI,
  STAKING_TIERS,
  type StakingTier,
} from '@/lib/btf-token-config';

// RPC fallbacks
const POLYGON_RPCS = [
  'https://polygon-bor-rpc.publicnode.com',
  'https://rpc.ankr.com/polygon',
  'https://1rpc.io/matic',
  'https://polygon-rpc.com',
];

const publicClient = createPublicClient({
  chain: polygon,
  transport: fallback(
    POLYGON_RPCS.map(url => http(url, { timeout: 10000, retryCount: 2 })),
    { rank: true }
  ),
});

// Cache
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 30000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  cache.delete(key);
  return null;
}
function setCache(key: string, data: any) { cache.set(key, { data, timestamp: Date.now() }); }

// Types
export interface TokenStats {
  totalSupply: string;
  totalBurned: string;
  ecosystemDistributed: string;
  ecosystemRemaining: string;
  circulatingSupply: string;
  transferBurnBps: number;
  serviceBurnBps: number;
}

export interface UserStake {
  index: number;
  amount: string;
  lockPeriod: number;
  stakedAt: Date;
  lockEndsAt: Date;
  accruedRewards: string;
  pendingReward: string;
  active: boolean;
  isLocked: boolean;
  daysRemaining: number;
  apyPercent: string;
}

export interface UserDashboard {
  totalStaked: string;
  tier: StakingTier;
  tierInfo: typeof STAKING_TIERS[StakingTier];
  stakeCount: number;
  totalPendingRewards: string;
  stakes: UserStake[];
}

export interface VaultStats {
  totalStaked: string;
  totalStakers: number;
  totalRewardsDistributed: string;
  totalPenaltyBurned: string;
  rewardsPoolBalance: string;
}

const TIER_MAP: StakingTier[] = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];
const LOCK_APY: Record<number, string> = { 2592000: '8%', 7776000: '15%', 15552000: '25%', 31536000: '40%' };

export function useBTFToken() {
  const { address, isConnected, chainId } = useWeb3();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [balance, setBalance] = useState<string>('0');
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null);
  const [userDashboard, setUserDashboard] = useState<UserDashboard | null>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);

  const isPolygon = chainId === 137;

  // Wallet client
  const getWalletClient = useCallback(async () => {
    if (!window.ethereum) throw new Error('MetaMask not installed');
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    if (chainId !== 137) {
      try {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x89' }],
        });
      } catch (e: any) {
        if (e.code === 4902) {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: '0x89',
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com/'],
              blockExplorerUrls: ['https://polygonscan.com/'],
            }],
          });
        }
      }
    }

    return createWalletClient({ chain: polygon, transport: custom(window.ethereum) });
  }, [chainId]);

  // ═════════════════════════════════════════
  //  READ: Balance
  // ═════════════════════════════════════════

  const fetchBalance = useCallback(async () => {
    if (!address) return;
    const cacheKey = `btf-balance-${address}`;
    const cached = getCached<string>(cacheKey);
    if (cached) { setBalance(cached); return; }

    try {
      const result = await publicClient.readContract({
        address: BTF_TOKEN_ADDRESS,
        abi: BTF_TOKEN_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      });
      const formatted = formatEther(result as bigint);
      setBalance(formatted);
      setCache(cacheKey, formatted);
    } catch (err) {
      console.error('[BTFToken] Error fetching balance:', err);
    }
  }, [address]);

  // ═════════════════════════════════════════
  //  READ: Token Stats
  // ═════════════════════════════════════════

  const fetchTokenStats = useCallback(async () => {
    const cached = getCached<TokenStats>('btf-token-stats');
    if (cached) { setTokenStats(cached); return; }

    try {
      const result = await publicClient.readContract({
        address: BTF_TOKEN_ADDRESS,
        abi: BTF_TOKEN_ABI,
        functionName: 'getTokenStats',
      }) as bigint[];

      const stats: TokenStats = {
        totalSupply: formatEther(result[0]),
        totalBurned: formatEther(result[1]),
        ecosystemDistributed: formatEther(result[2]),
        ecosystemRemaining: formatEther(result[3]),
        circulatingSupply: formatEther(result[0]), // OZ totalSupply already accounts for burns
        transferBurnBps: Number(result[4]),
        serviceBurnBps: Number(result[5]),
      };
      setTokenStats(stats);
      setCache('btf-token-stats', stats);
    } catch (err) {
      console.error('[BTFToken] Error fetching stats:', err);
    }
  }, []);

  // ═════════════════════════════════════════
  //  READ: User Dashboard (Staking)
  // ═════════════════════════════════════════

  const fetchUserDashboard = useCallback(async () => {
    if (!address) return;
    const cacheKey = `btf-dashboard-${address}`;

    try {
      // Get dashboard summary
      const dashboard = await publicClient.readContract({
        address: BTF_STAKING_VAULT_ADDRESS,
        abi: BTF_STAKING_VAULT_ABI,
        functionName: 'getUserDashboard',
        args: [address as `0x${string}`],
      }) as [bigint, number, bigint, bigint];

      const stakeCount = Number(dashboard[2]);
      const tierIndex = Number(dashboard[1]);
      const tier = TIER_MAP[tierIndex] || 'None';

      // Fetch individual stakes
      const stakes: UserStake[] = [];
      for (let i = 0; i < stakeCount; i++) {
        try {
          const stake = await publicClient.readContract({
            address: BTF_STAKING_VAULT_ADDRESS,
            abi: BTF_STAKING_VAULT_ABI,
            functionName: 'getUserStake',
            args: [address as `0x${string}`, BigInt(i)],
          }) as [bigint, bigint, bigint, bigint, bigint, bigint, boolean, boolean];

          const lockEndsAt = new Date(Number(stake[3]) * 1000);
          const now = new Date();
          const daysRemaining = Math.max(0, Math.ceil((lockEndsAt.getTime() - now.getTime()) / 86400000));

          stakes.push({
            index: i,
            amount: formatEther(stake[0]),
            lockPeriod: Number(stake[1]),
            stakedAt: new Date(Number(stake[2]) * 1000),
            lockEndsAt,
            accruedRewards: formatEther(stake[4]),
            pendingReward: formatEther(stake[5]),
            active: stake[6],
            isLocked: stake[7],
            daysRemaining,
            apyPercent: LOCK_APY[Number(stake[1])] || '0%',
          });
        } catch { /* skip invalid stake */ }
      }

      const result: UserDashboard = {
        totalStaked: formatEther(dashboard[0]),
        tier,
        tierInfo: STAKING_TIERS[tier],
        stakeCount,
        totalPendingRewards: formatEther(dashboard[3]),
        stakes,
      };

      setUserDashboard(result);
      setCache(cacheKey, result);
    } catch (err) {
      console.error('[BTFToken] Error fetching dashboard:', err);
    }
  }, [address]);

  // ═════════════════════════════════════════
  //  READ: Vault Stats
  // ═════════════════════════════════════════

  const fetchVaultStats = useCallback(async () => {
    const cached = getCached<VaultStats>('btf-vault-stats');
    if (cached) { setVaultStats(cached); return; }

    try {
      const result = await publicClient.readContract({
        address: BTF_STAKING_VAULT_ADDRESS,
        abi: BTF_STAKING_VAULT_ABI,
        functionName: 'getVaultStats',
      }) as bigint[];

      const stats: VaultStats = {
        totalStaked: formatEther(result[0]),
        totalStakers: Number(result[1]),
        totalRewardsDistributed: formatEther(result[2]),
        totalPenaltyBurned: formatEther(result[3]),
        rewardsPoolBalance: formatEther(result[4]),
      };
      setVaultStats(stats);
      setCache('btf-vault-stats', stats);
    } catch (err) {
      console.error('[BTFToken] Error fetching vault stats:', err);
    }
  }, []);

  // ═════════════════════════════════════════
  //  WRITE: Stake BTF
  // ═════════════════════════════════════════

  const stakeBTF = useCallback(async (amount: string, lockPeriodSeconds: number) => {
    if (!isConnected || !address) {
      toast({ title: 'Connect Wallet', description: 'Connect your wallet to stake BTF', variant: 'destructive' });
      return null;
    }

    setIsLoading(true);
    try {
      const walletClient = await getWalletClient();
      const amountWei = parseEther(amount);

      // 1. Approve staking vault to spend tokens
      toast({ title: 'Approving BTF...', description: 'Confirm in your wallet' });
      const approveHash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS,
        abi: BTF_TOKEN_ABI,
        functionName: 'approve',
        args: [BTF_STAKING_VAULT_ADDRESS, amountWei],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      // 2. Stake
      toast({ title: 'Staking BTF...', description: `Locking ${amount} BTF` });
      const stakeHash = await walletClient.writeContract({
        address: BTF_STAKING_VAULT_ADDRESS,
        abi: BTF_STAKING_VAULT_ABI,
        functionName: 'stake',
        args: [amountWei, BigInt(lockPeriodSeconds)],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash: stakeHash });

      setTxHash(stakeHash);
      toast({ title: 'Staked Successfully!', description: `${amount} BTF locked` });

      // Refresh data
      cache.clear();
      await Promise.all([fetchBalance(), fetchUserDashboard(), fetchVaultStats()]);

      return stakeHash;
    } catch (err: any) {
      console.error('[BTFToken] Stake error:', err);
      toast({ title: 'Stake Failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, getWalletClient, toast, fetchBalance, fetchUserDashboard, fetchVaultStats]);

  // ═════════════════════════════════════════
  //  WRITE: Unstake
  // ═════════════════════════════════════════

  const unstakeBTF = useCallback(async (stakeIndex: number) => {
    if (!isConnected || !address) return null;

    setIsLoading(true);
    try {
      const walletClient = await getWalletClient();

      toast({ title: 'Unstaking BTF...', description: 'Confirm in your wallet' });
      const hash = await walletClient.writeContract({
        address: BTF_STAKING_VAULT_ADDRESS,
        abi: BTF_STAKING_VAULT_ABI,
        functionName: 'unstake',
        args: [BigInt(stakeIndex)],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setTxHash(hash);
      toast({ title: 'Unstaked!', description: 'BTF returned to your wallet' });

      cache.clear();
      await Promise.all([fetchBalance(), fetchUserDashboard(), fetchVaultStats()]);
      return hash;
    } catch (err: any) {
      console.error('[BTFToken] Unstake error:', err);
      toast({ title: 'Unstake Failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, getWalletClient, toast, fetchBalance, fetchUserDashboard, fetchVaultStats]);

  // ═════════════════════════════════════════
  //  WRITE: Claim Rewards
  // ═════════════════════════════════════════

  const claimRewards = useCallback(async (stakeIndex: number) => {
    if (!isConnected || !address) return null;

    setIsLoading(true);
    try {
      const walletClient = await getWalletClient();

      toast({ title: 'Claiming Rewards...', description: 'Confirm in your wallet' });
      const hash = await walletClient.writeContract({
        address: BTF_STAKING_VAULT_ADDRESS,
        abi: BTF_STAKING_VAULT_ABI,
        functionName: 'claimRewards',
        args: [BigInt(stakeIndex)],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setTxHash(hash);
      toast({ title: 'Rewards Claimed!', description: 'BTF added to your balance' });

      cache.clear();
      await Promise.all([fetchBalance(), fetchUserDashboard()]);
      return hash;
    } catch (err: any) {
      console.error('[BTFToken] Claim error:', err);
      toast({ title: 'Claim Failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, getWalletClient, toast, fetchBalance, fetchUserDashboard]);

  // ═════════════════════════════════════════
  //  WRITE: Pay For Service
  // ═════════════════════════════════════════

  const payForService = useCallback(async (amount: string, service: string) => {
    if (!isConnected || !address) return null;

    setIsLoading(true);
    try {
      const walletClient = await getWalletClient();
      const amountWei = parseEther(amount);

      toast({ title: `Paying with BTF...`, description: `${amount} BTF for ${service}` });
      const hash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS,
        abi: BTF_TOKEN_ABI,
        functionName: 'payForService',
        args: [amountWei, service],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setTxHash(hash);
      toast({ title: 'Payment Complete!', description: `50% of payment was burned` });

      cache.clear();
      await Promise.all([fetchBalance(), fetchTokenStats()]);
      return hash;
    } catch (err: any) {
      console.error('[BTFToken] Payment error:', err);
      toast({ title: 'Payment Failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, getWalletClient, toast, fetchBalance, fetchTokenStats]);

  // ═════════════════════════════════════════
  //  WRITE: Transfer BTF
  // ═════════════════════════════════════════

  const transferBTF = useCallback(async (to: string, amount: string) => {
    if (!isConnected || !address) return null;

    setIsLoading(true);
    try {
      const walletClient = await getWalletClient();
      const amountWei = parseEther(amount);

      toast({ title: 'Sending BTF...', description: `${amount} BTF → ${to.slice(0, 8)}...` });
      const hash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS,
        abi: BTF_TOKEN_ABI,
        functionName: 'transfer',
        args: [to as `0x${string}`, amountWei],
        account: address as `0x${string}`,
        chain: polygon,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setTxHash(hash);
      toast({ title: 'Sent!', description: `2% burn tax applied automatically` });

      cache.clear();
      await fetchBalance();
      return hash;
    } catch (err: any) {
      console.error('[BTFToken] Transfer error:', err);
      toast({ title: 'Transfer Failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address, getWalletClient, toast, fetchBalance]);

  // ═════════════════════════════════════════
  //  AUTO-REFRESH
  // ═════════════════════════════════════════

  useEffect(() => {
    fetchTokenStats();
    fetchVaultStats();
  }, [fetchTokenStats, fetchVaultStats]);

  useEffect(() => {
    if (address && isConnected) {
      fetchBalance();
      fetchUserDashboard();
    }
  }, [address, isConnected, fetchBalance, fetchUserDashboard]);

  // Refresh every 60s
  useEffect(() => {
    if (!address || !isConnected) return;
    const interval = setInterval(() => {
      cache.clear();
      fetchBalance();
      fetchUserDashboard();
      fetchTokenStats();
      fetchVaultStats();
    }, 60000);
    return () => clearInterval(interval);
  }, [address, isConnected, fetchBalance, fetchUserDashboard, fetchTokenStats, fetchVaultStats]);

  const refreshAll = useCallback(() => {
    cache.clear();
    fetchBalance();
    fetchTokenStats();
    fetchVaultStats();
    if (address) fetchUserDashboard();
  }, [fetchBalance, fetchTokenStats, fetchVaultStats, fetchUserDashboard, address]);

  return {
    // State
    balance,
    tokenStats,
    userDashboard,
    vaultStats,
    isLoading,
    txHash,
    isPolygon,
    isConnected,
    address,

    // Actions
    stakeBTF,
    unstakeBTF,
    claimRewards,
    payForService,
    transferBTF,
    refreshAll,

    // Fetchers
    fetchBalance,
    fetchTokenStats,
    fetchUserDashboard,
    fetchVaultStats,
  };
}
