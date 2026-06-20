/**
 * useBTFArtistMint V2 — Hook for AI Artist Minting + Value Appreciation
 *
 * V2 additions:
 * - Continuous bonding curve (price per mint)
 * - Platform reserve stats (200 reserved)
 * - Value appreciation scores per artist
 * - 4-way distribution (burn/staking/treasury/reserve)
 * - Global value score tracking
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { parseEther, formatEther, createPublicClient, http, createWalletClient, custom, fallback } from 'viem';
import { polygon } from 'viem/chains';
import { useWeb3 } from './use-web3';
import { useToast } from './use-toast';
import {
  BTF_ARTIST_MINTER_ADDRESS,
  BTF_ARTIST_MINTER_ABI,
  BTF_TOKEN_ADDRESS,
  BTF_CHAIN_ID,
  MINT_TIERS,
  getCurrentTierFromMinted,
  PUBLIC_SUPPLY,
  PLATFORM_RESERVE,
  MAX_ARTISTS,
  MAX_PER_WALLET,
  DISTRIBUTION,
  type MintTier,
} from '@/lib/btf-artist-mint-config';
import { BTF_TOKEN_ABI } from '@/lib/btf-token-config';

// ─── Polygon RPC Fallbacks ──────────────────────────────
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

// ─── Cache ──────────────────────────────────────────────
const cache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15000;

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) return entry.data as T;
  cache.delete(key);
  return null;
}
function setCache(key: string, data: any) { cache.set(key, { data, timestamp: Date.now() }); }

// ─── Types V2 ───────────────────────────────────────────

export interface MintStats {
  // Core
  publicMinted: number;
  remainingPublic: number;
  currentPrice: string; // formatted BTF
  currentPriceRaw: bigint;
  currentTier: number;
  currentTierInfo: MintTier;
  // Financial
  totalCollected: string;
  totalBurned: string;
  totalToStaking: string;
  totalToTreasury: string;
  totalToReserve: string;
  // Platform reserve
  platformMinted: number;
  remainingPlatform: number;
  // Value appreciation
  globalValueScore: number;
  // Derived
  totalMinted: number;     // publicMinted + platformMinted
  percentMinted: number;   // vs PUBLIC_SUPPLY
  isSoldOut: boolean;      // publicMinted >= PUBLIC_SUPPLY
}

export interface ArtistRecord {
  id: number;
  owner: string;
  mintedAt: Date;
  pricePaid: string;
  tier: number;
  tierInfo: MintTier;
  artistName: string;
  genre: string;
  isActive: boolean;
  isPlatformReserve: boolean;
  valueScore: number;
  totalSongs: number;
  totalVideos: number;
  totalCollabs: number;
  totalInteractions: number;
  // Backend enrichment (from PostgreSQL via API)
  slug?: string;
  landingPageUrl?: string;
  avatarUrl?: string;
  dbArtistId?: number;
}

export interface UserMintInfo {
  mintCount: number;
  canMint: boolean;
  remainingMints: number;
  btfBalance: string;
  btfBalanceRaw: bigint;
  btfAllowance: string;
  btfAllowanceRaw: bigint;
  hasApproved: boolean;
  artistIds: number[];
}

export interface MintSyncResult {
  artistId: number;
  slug: string;
  username: string;
  artistName: string;
  genre: string;
  landingPageUrl: string;
  blockchainTxHash: string;
  blockchainArtistId: number;
  tier: number;
}

// ═══════════════════════════════════════════════════════
//  HOOK
// ═══════════════════════════════════════════════════════

export function useBTFArtistMint() {
  const { address, isConnected, chainId } = useWeb3();
  const { toast } = useToast();

  const [mintStats, setMintStats] = useState<MintStats | null>(null);
  const [userInfo, setUserInfo] = useState<UserMintInfo | null>(null);
  const [userArtists, setUserArtists] = useState<ArtistRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [approving, setApproving] = useState(false);

  const isCorrectChain = chainId === BTF_CHAIN_ID;

  // ─── Fetch Mint Stats (V2 — 12 return values) ────────

  const fetchMintStats = useCallback(async () => {
    const cached = getCached<MintStats>('mintStats');
    if (cached) { setMintStats(cached); return cached; }

    try {
      const result = await publicClient.readContract({
        address: BTF_ARTIST_MINTER_ADDRESS,
        abi: BTF_ARTIST_MINTER_ABI,
        functionName: 'getMintStats',
      }) as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint, bigint];

      const publicMinted = Number(result[0]);
      const remainingPublic = Number(result[1]);
      const currentPriceRaw = result[2];
      const currentTier = Number(result[3]);
      const platformMinted = Number(result[8]);
      const remainingPlatform = Number(result[9]);

      const stats: MintStats = {
        publicMinted,
        remainingPublic,
        currentPrice: formatEther(currentPriceRaw),
        currentPriceRaw,
        currentTier,
        currentTierInfo: getCurrentTierFromMinted(publicMinted),
        totalCollected: formatEther(result[4]),
        totalBurned: formatEther(result[5]),
        totalToStaking: formatEther(result[6]),
        totalToTreasury: formatEther(result[7]),
        platformMinted,
        remainingPlatform,
        totalToReserve: formatEther(result[10]),
        globalValueScore: Number(result[11]),
        // Derived
        totalMinted: publicMinted + platformMinted,
        percentMinted: (publicMinted / PUBLIC_SUPPLY) * 100,
        isSoldOut: publicMinted >= PUBLIC_SUPPLY,
      };

      setCache('mintStats', stats);
      setMintStats(stats);
      return stats;
    } catch (err) {
      console.error('[BTFArtistMint] Failed to fetch mint stats:', err);
      return null;
    }
  }, []);

  // ─── Fetch User Info ──────────────────────────────────

  const fetchUserInfo = useCallback(async () => {
    if (!address) return null;

    const cacheKey = `userMint:${address}`;
    const cached = getCached<UserMintInfo>(cacheKey);
    if (cached) { setUserInfo(cached); return cached; }

    try {
      const [mintCount, btfBalance, btfAllowance, artistIds] = await Promise.all([
        publicClient.readContract({
          address: BTF_ARTIST_MINTER_ADDRESS,
          abi: BTF_ARTIST_MINTER_ABI,
          functionName: 'ownerMintCount',
          args: [address as `0x${string}`],
        }) as Promise<bigint>,

        publicClient.readContract({
          address: BTF_TOKEN_ADDRESS as `0x${string}`,
          abi: BTF_TOKEN_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }) as Promise<bigint>,

        publicClient.readContract({
          address: BTF_TOKEN_ADDRESS as `0x${string}`,
          abi: BTF_TOKEN_ABI,
          functionName: 'allowance',
          args: [address as `0x${string}`, BTF_ARTIST_MINTER_ADDRESS as `0x${string}`],
        }) as Promise<bigint>,

        publicClient.readContract({
          address: BTF_ARTIST_MINTER_ADDRESS,
          abi: BTF_ARTIST_MINTER_ABI,
          functionName: 'getOwnerArtists',
          args: [address as `0x${string}`],
        }) as Promise<readonly bigint[]>,
      ]);

      const count = Number(mintCount);
      const info: UserMintInfo = {
        mintCount: count,
        canMint: count < MAX_PER_WALLET,
        remainingMints: MAX_PER_WALLET - count,
        btfBalance: formatEther(btfBalance),
        btfBalanceRaw: btfBalance,
        btfAllowance: formatEther(btfAllowance),
        btfAllowanceRaw: btfAllowance,
        hasApproved: btfAllowance > BigInt(0),
        artistIds: artistIds.map(Number),
      };

      setCache(cacheKey, info);
      setUserInfo(info);
      return info;
    } catch (err) {
      console.error('[BTFArtistMint] Failed to fetch user info:', err);
      return null;
    }
  }, [address]);

  // ─── Fetch User's Artists (V2 — with value scores) ────

  const fetchUserArtists = useCallback(async () => {
    if (!userInfo || userInfo.artistIds.length === 0) {
      setUserArtists([]);
      return [];
    }

    try {
      const records = await Promise.all(
        userInfo.artistIds.map(async (id) => {
          const data = await publicClient.readContract({
            address: BTF_ARTIST_MINTER_ADDRESS,
            abi: BTF_ARTIST_MINTER_ABI,
            functionName: 'getArtistFull',
            args: [BigInt(id)],
          }) as readonly [bigint, string, bigint, bigint, bigint, string, string, boolean, boolean, bigint, bigint, bigint, bigint, bigint];

          const tierNum = Number(data[4]);
          return {
            id: Number(data[0]),
            owner: data[1],
            mintedAt: new Date(Number(data[2]) * 1000),
            pricePaid: formatEther(data[3]),
            tier: tierNum,
            tierInfo: tierNum > 0 ? (MINT_TIERS[(tierNum - 1)] || MINT_TIERS[0]) : MINT_TIERS[0],
            artistName: data[5],
            genre: data[6],
            isActive: data[7],
            isPlatformReserve: data[8],
            valueScore: Number(data[9]),
            totalSongs: Number(data[10]),
            totalVideos: Number(data[11]),
            totalCollabs: Number(data[12]),
            totalInteractions: Number(data[13]),
          } as ArtistRecord;
        })
      );

      // Enrich with backend data (slug, landing page URL)
      try {
        const chainIds = records.map(r => r.id).join(',');
        const enrichRes = await fetch(`/api/ai-social/minted-artists-by-chain-ids?ids=${chainIds}`);
        if (enrichRes.ok) {
          const enrichData = await enrichRes.json();
          if (enrichData.success && enrichData.artists?.length > 0) {
            const byChainId = new Map<number, any>();
            for (const a of enrichData.artists) {
              if (a.blockchainArtistId) byChainId.set(a.blockchainArtistId, a);
            }
            for (const rec of records) {
              const backend = byChainId.get(rec.id);
              if (backend) {
                rec.slug = backend.slug;
                rec.landingPageUrl = backend.landingPageUrl;
                rec.avatarUrl = backend.avatarUrl || backend.profileImageUrl;
                rec.dbArtistId = backend.id;
              }
            }
          }
        }
      } catch (enrichErr) {
        console.warn('[BTFArtistMint] Backend enrichment failed (non-critical):', enrichErr);
      }

      setUserArtists(records);
      return records;
    } catch (err) {
      console.error('[BTFArtistMint] Failed to fetch artists:', err);
      return [];
    }
  }, [userInfo]);

  // ─── Approve BTF for Minter ─────────────────────────

  const approveBTF = useCallback(async (amount?: bigint) => {
    if (!address || !isConnected) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return false;
    }
    if (!isCorrectChain) {
      toast({ title: 'Switch to Polygon network', variant: 'destructive' });
      return false;
    }

    setApproving(true);
    try {
      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom((window as any).ethereum),
      });

      const approveAmount = amount || parseEther('999999999');

      const hash = await walletClient.writeContract({
        address: BTF_TOKEN_ADDRESS as `0x${string}`,
        abi: BTF_TOKEN_ABI,
        functionName: 'approve',
        args: [BTF_ARTIST_MINTER_ADDRESS as `0x${string}`, approveAmount],
        account: address as `0x${string}`,
      });

      toast({ title: '⏳ Approving BTF...', description: 'Waiting for confirmation' });
      await publicClient.waitForTransactionReceipt({ hash });

      toast({ title: '✅ BTF Approved!', description: 'You can now mint AI Artists' });

      cache.delete(`userMint:${address}`);
      await fetchUserInfo();
      return true;
    } catch (err: any) {
      console.error('[BTFArtistMint] Approve failed:', err);
      toast({ title: 'Approval failed', description: err.shortMessage || err.message, variant: 'destructive' });
      return false;
    } finally {
      setApproving(false);
    }
  }, [address, isConnected, isCorrectChain, toast, fetchUserInfo]);

  // ─── Mint AI Artist ─────────────────────────────────

  const mintArtist = useCallback(async (artistName: string, genre: string, personalityPreset?: string, creatorUserId?: number): Promise<{ hash: string; receipt: any; syncResult?: MintSyncResult } | null> => {
    if (!address || !isConnected) {
      toast({ title: 'Connect wallet first', variant: 'destructive' });
      return null;
    }
    if (!isCorrectChain) {
      toast({ title: 'Switch to Polygon network', variant: 'destructive' });
      return null;
    }
    if (!artistName.trim()) {
      toast({ title: 'Enter artist name', variant: 'destructive' });
      return null;
    }

    setMinting(true);
    try {
      const walletClient = createWalletClient({
        chain: polygon,
        transport: custom((window as any).ethereum),
      });

      const hash = await walletClient.writeContract({
        address: BTF_ARTIST_MINTER_ADDRESS as `0x${string}`,
        abi: BTF_ARTIST_MINTER_ABI,
        functionName: 'mintArtist',
        args: [artistName.trim(), genre.trim()],
        account: address as `0x${string}`,
      });

      toast({ title: '⏳ Minting AI Artist...', description: `Creating "${artistName}" on Polygon` });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // ── Sync with backend — Create AI artist + personality + landing page ──
      let syncResult: MintSyncResult | undefined;
      try {
        // Extract on-chain artist ID from receipt logs if possible
        let onChainArtistId: number | undefined;
        try {
          // The ArtistMinted event has artistId as first indexed param
          for (const log of receipt.logs) {
            if (log.topics[0] && log.topics[1]) {
              const possibleId = parseInt(log.topics[1], 16);
              if (possibleId > 0 && possibleId <= 1000) {
                onChainArtistId = possibleId;
                break;
              }
            }
          }
        } catch { /* ignore log parsing errors */ }

        const currentTier = mintStats?.currentTier || 1;
        const currentPrice = mintStats?.currentPrice || '0';

        const syncRes = await fetch('/api/ai-social/mint-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            artistName: artistName.trim(),
            genre: genre.trim(),
            onChainArtistId,
            txHash: hash,
            tier: currentTier,
            pricePaid: currentPrice,
            walletAddress: address,
            personalityPreset: personalityPreset || 'mainstream',
            creatorUserId,
          }),
        });

        if (syncRes.ok) {
          const syncData = await syncRes.json();
          if (syncData.success) {
            syncResult = syncData.data;
            console.log(`✅ [MintSync] Artist synced: ${syncResult?.slug}`);
          }
        }
      } catch (syncErr) {
        console.warn('[MintSync] Backend sync failed (artist minted on-chain but not synced):', syncErr);
      }

      toast({
        title: '🎉 AI Artist Minted!',
        description: syncResult
          ? `"${artistName}" is live! Landing page: /artist/${syncResult.slug}`
          : `"${artistName}" is now live on-chain! Tx: ${hash.slice(0, 10)}...`
      });

      cache.clear();
      await Promise.all([fetchMintStats(), fetchUserInfo()]);

      return { hash, receipt, syncResult };
    } catch (err: any) {
      console.error('[BTFArtistMint] Mint failed:', err);

      let message = err.shortMessage || err.message;
      if (message.includes('MaxArtistsReached')) message = 'All 800 public AI Artists have been minted! 🏆';
      else if (message.includes('MaxPerWalletReached')) message = `You've reached the max ${MAX_PER_WALLET} artists per wallet`;
      else if (message.includes('InsufficientBTFBalance')) message = 'Not enough BTF tokens. Buy more on BoostiSwap!';
      else if (message.includes('InsufficientBTFAllowance')) message = 'Please approve BTF tokens first';

      toast({ title: 'Mint failed', description: message, variant: 'destructive' });
      return null;
    } finally {
      setMinting(false);
    }
  }, [address, isConnected, isCorrectChain, toast, fetchMintStats, fetchUserInfo, mintStats]);

  // ─── Auto-refresh ───────────────────────────────────

  useEffect(() => {
    fetchMintStats();
    const interval = setInterval(fetchMintStats, 30000);
    return () => clearInterval(interval);
  }, [fetchMintStats]);

  useEffect(() => {
    if (address && isConnected) {
      fetchUserInfo();
    }
  }, [address, isConnected, fetchUserInfo]);

  useEffect(() => {
    if (userInfo && userInfo.artistIds.length > 0) {
      fetchUserArtists();
    }
  }, [userInfo, fetchUserArtists]);

  // ─── Refresh all ────────────────────────────────────

  const refresh = useCallback(async () => {
    setLoading(true);
    cache.clear();
    await Promise.all([fetchMintStats(), fetchUserInfo()]);
    setLoading(false);
  }, [fetchMintStats, fetchUserInfo]);

  return {
    // State
    mintStats,
    userInfo,
    userArtists,
    loading,
    minting,
    approving,
    isConnected,
    isCorrectChain,

    // Actions
    approveBTF,
    mintArtist,
    refresh,
    fetchMintStats,
    fetchUserInfo,
    fetchUserArtists,

    // Helpers
    MINT_TIERS,
    PUBLIC_SUPPLY,
    PLATFORM_RESERVE,
    MAX_ARTISTS,
    MAX_PER_WALLET,
    DISTRIBUTION,
  };
}
