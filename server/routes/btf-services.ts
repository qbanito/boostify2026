/**
 * BTF Services API — Server-side payment verification & service management
 * 
 * Routes:
 *   GET  /prices              — Get all service prices with tier-aware discounts
 *   POST /verify-payment      — Verify on-chain BTF payment receipt
 *   POST /boost-song          — Activate a song boost after payment
 *   POST /record-tip          — Record artist tip for leaderboards
 *   GET  /boost-status/:songId — Check boost status for a song
 *   GET  /economy-stats       — Platform economy metrics
 */

import { Router, Request, Response } from 'express';
import { createPublicClient, http, fallback, parseAbiItem, formatEther } from 'viem';
import { polygon } from 'viem/chains';

const router = Router();

// ═══════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════

const BTF_TOKEN_ADDRESS = '0x3DF18dAa074D8744cC620a89CFc8b7c4138CEb05';
const BTF_STAKING_VAULT_ADDRESS = '0x493b942d85d6D8D2E221f2b0FF4192dFBc1BfAAa';

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

// Service Payment event signature
const SERVICE_PAYMENT_EVENT = parseAbiItem(
  'event ServicePayment(address indexed payer, uint256 amount, uint256 burned, string service)'
);

// Staking tier ABI
const GET_USER_TIER_ABI = [{
  inputs: [{ name: 'user', type: 'address' }],
  name: 'getUserTier',
  outputs: [{ name: '', type: 'uint8' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

const BALANCE_OF_ABI = [{
  inputs: [{ name: 'account', type: 'address' }],
  name: 'balanceOf',
  outputs: [{ name: '', type: 'uint256' }],
  stateMutability: 'view',
  type: 'function',
}] as const;

const GET_TOKEN_STATS_ABI = [{
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
}] as const;

const TIER_NAMES = ['None', 'Bronze', 'Silver', 'Gold', 'Platinum'];

const TIER_DISCOUNTS: Record<string, number> = {
  None: 0,
  Bronze: 0,
  Silver: 20,
  Gold: 40,
  Platinum: 100,
};

// In-memory boost & tip tracking (would be DB in production)
const activeBoosts: Map<string, { tier: string; activatedAt: Date; expiresAt: Date; txHash: string }> = new Map();
const tipLeaderboard: Map<string, number> = new Map();

// Service prices (mirror of client config)
const SERVICE_PRICES: Record<string, { name: string; basePriceBTF: number; freeForPlatinum: boolean }> = {
  ai_song_generation: { name: 'AI Song Generation', basePriceBTF: 100, freeForPlatinum: true },
  music_video_creation: { name: 'Music Video Creation', basePriceBTF: 500, freeForPlatinum: false },
  album_art_design: { name: 'Album Art Design', basePriceBTF: 50, freeForPlatinum: true },
  voice_clone: { name: 'Voice Clone', basePriceBTF: 300, freeForPlatinum: false },
  lip_sync_video: { name: 'Lip Sync Video', basePriceBTF: 250, freeForPlatinum: false },
  fashion_studio: { name: 'Fashion Studio', basePriceBTF: 150, freeForPlatinum: true },
  pr_campaign: { name: 'PR Campaign', basePriceBTF: 200, freeForPlatinum: false },
  song_boost_mini: { name: 'Mini Boost', basePriceBTF: 25, freeForPlatinum: true },
  song_boost_radio: { name: 'Radio Boost', basePriceBTF: 100, freeForPlatinum: true },
  song_boost_homepage: { name: 'Homepage Feature', basePriceBTF: 250, freeForPlatinum: false },
  song_boost_viral: { name: 'Viral Campaign', basePriceBTF: 500, freeForPlatinum: false },
  fan_tip: { name: 'Fan Tip', basePriceBTF: 0, freeForPlatinum: false },
  collab_request: { name: 'Collaboration', basePriceBTF: 50, freeForPlatinum: true },
  live_space: { name: 'Live Space', basePriceBTF: 75, freeForPlatinum: true },
  audio_analysis: { name: 'Audio Analysis', basePriceBTF: 30, freeForPlatinum: true },
  premium_analytics: { name: 'Premium Analytics', basePriceBTF: 80, freeForPlatinum: true },
  ai_course: { name: 'AI Course', basePriceBTF: 75, freeForPlatinum: true },
  ai_artist_create: { name: 'Create AI Artist', basePriceBTF: 60, freeForPlatinum: true },
};

// ═══════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════

async function getUserTierOnChain(walletAddress: string): Promise<string> {
  try {
    const tier = await publicClient.readContract({
      address: BTF_STAKING_VAULT_ADDRESS as `0x${string}`,
      abi: GET_USER_TIER_ABI,
      functionName: 'getUserTier',
      args: [walletAddress as `0x${string}`],
    });
    return TIER_NAMES[Number(tier)] || 'None';
  } catch {
    return 'None';
  }
}

async function getUserBalance(walletAddress: string): Promise<string> {
  try {
    const bal = await publicClient.readContract({
      address: BTF_TOKEN_ADDRESS as `0x${string}`,
      abi: BALANCE_OF_ABI,
      functionName: 'balanceOf',
      args: [walletAddress as `0x${string}`],
    });
    return formatEther(bal);
  } catch {
    return '0';
  }
}

function calculateDiscount(basePriceBTF: number, tier: string, freeForPlatinum: boolean): number {
  if (tier === 'Platinum' && freeForPlatinum) return 0;
  if (tier === 'Platinum' && !freeForPlatinum) return Math.floor(basePriceBTF * 0.4); // 60% discount
  const discount = TIER_DISCOUNTS[tier] || 0;
  return Math.max(0, basePriceBTF - Math.floor(basePriceBTF * discount / 100));
}

// ═══════════════════════════════════════════════════════
//  ROUTES
// ═══════════════════════════════════════════════════════

/**
 * GET /prices — All service prices with tier-aware discounts
 * Query: ?wallet=0x... (optional — for discount calculation)
 */
router.get('/prices', async (req: Request, res: Response) => {
  try {
    const walletAddress = (req.query.wallet as string) || '';
    let tier = 'None';

    if (walletAddress && walletAddress.startsWith('0x')) {
      tier = await getUserTierOnChain(walletAddress);
    }

    const prices = Object.entries(SERVICE_PRICES).map(([serviceId, service]) => {
      const finalPrice = calculateDiscount(service.basePriceBTF, tier, service.freeForPlatinum);
      const isFree = finalPrice === 0;
      return {
        serviceId,
        name: service.name,
        basePriceBTF: service.basePriceBTF,
        finalPriceBTF: finalPrice,
        discountPercent: service.basePriceBTF > 0
          ? Math.round((1 - finalPrice / service.basePriceBTF) * 100)
          : 0,
        isFree,
        burnAmount: Math.floor(finalPrice * 0.5),
      };
    });

    res.json({
      success: true,
      userTier: tier,
      prices,
    });
  } catch (error: any) {
    console.error('[BTF Services] Error fetching prices:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /verify-payment — Verify an on-chain ServicePayment event in a tx receipt
 * Body: { txHash, serviceId, walletAddress }
 */
router.post('/verify-payment', async (req: Request, res: Response) => {
  try {
    const { txHash, serviceId, walletAddress } = req.body;

    if (!txHash || !serviceId) {
      return res.status(400).json({ success: false, error: 'txHash and serviceId required' });
    }

    // Fetch transaction receipt
    const receipt = await publicClient.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });

    if (!receipt || receipt.status !== 'success') {
      return res.status(400).json({ success: false, error: 'Transaction failed or not found' });
    }

    // Check that tx was to BTF Token contract
    if (receipt.to?.toLowerCase() !== BTF_TOKEN_ADDRESS.toLowerCase()) {
      return res.status(400).json({ success: false, error: 'Transaction not to BTF Token contract' });
    }

    // Parse ServicePayment events from logs
    const servicePaymentEvents = receipt.logs.filter(log => {
      try {
        return log.address.toLowerCase() === BTF_TOKEN_ADDRESS.toLowerCase();
      } catch { return false; }
    });

    if (servicePaymentEvents.length === 0) {
      return res.status(400).json({ success: false, error: 'No ServicePayment event found' });
    }

    // Verify payer matches
    if (walletAddress) {
      const fromAddress = receipt.from.toLowerCase();
      if (fromAddress !== walletAddress.toLowerCase()) {
        return res.status(400).json({ success: false, error: 'Payer address mismatch' });
      }
    }

    res.json({
      success: true,
      verified: true,
      txHash,
      blockNumber: Number(receipt.blockNumber),
      from: receipt.from,
      serviceId,
      gasUsed: receipt.gasUsed.toString(),
    });
  } catch (error: any) {
    console.error('[BTF Services] Verify error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /boost-song — Activate a song boost after payment
 * Body: { songId, boostTier, txHash, walletAddress }
 */
router.post('/boost-song', async (req: Request, res: Response) => {
  try {
    const { songId, boostTier, txHash, walletAddress } = req.body;

    if (!songId || !boostTier || !txHash) {
      return res.status(400).json({ success: false, error: 'songId, boostTier, txHash required' });
    }

    const BOOST_DURATIONS: Record<string, number> = {
      mini: 24 * 60 * 60 * 1000,         // 24 hours
      radio: 7 * 24 * 60 * 60 * 1000,    // 7 days
      homepage: 3 * 24 * 60 * 60 * 1000,  // 3 days
      viral: 14 * 24 * 60 * 60 * 1000,    // 14 days
    };

    const duration = BOOST_DURATIONS[boostTier] || BOOST_DURATIONS.mini;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + duration);

    activeBoosts.set(songId, {
      tier: boostTier,
      activatedAt: now,
      expiresAt,
      txHash,
    });

    res.json({
      success: true,
      songId,
      boost: {
        tier: boostTier,
        activatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        txHash,
      },
    });
  } catch (error: any) {
    console.error('[BTF Services] Boost error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /boost-status/:songId — Check boost status
 */
router.get('/boost-status/:songId', async (req: Request, res: Response) => {
  try {
    const { songId } = req.params;
    const boost = activeBoosts.get(songId);

    if (!boost) {
      return res.json({ success: true, active: false, boost: null });
    }

    const isActive = new Date() < boost.expiresAt;
    if (!isActive) {
      activeBoosts.delete(songId);
      return res.json({ success: true, active: false, boost: null });
    }

    res.json({
      success: true,
      active: true,
      boost: {
        tier: boost.tier,
        activatedAt: boost.activatedAt.toISOString(),
        expiresAt: boost.expiresAt.toISOString(),
        remainingMs: boost.expiresAt.getTime() - Date.now(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /record-tip — Record an artist tip for leaderboards
 * Body: { artistAddress, amount, txHash, tipperAddress }
 */
router.post('/record-tip', async (req: Request, res: Response) => {
  try {
    const { artistAddress, amount, txHash, tipperAddress } = req.body;

    if (!artistAddress || !amount) {
      return res.status(400).json({ success: false, error: 'artistAddress and amount required' });
    }

    const currentTotal = tipLeaderboard.get(artistAddress.toLowerCase()) || 0;
    tipLeaderboard.set(artistAddress.toLowerCase(), currentTotal + parseFloat(amount));

    res.json({
      success: true,
      artistAddress,
      tipAmount: parseFloat(amount),
      totalTipsReceived: currentTotal + parseFloat(amount),
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /tip-leaderboard — Top tipped artists
 */
router.get('/tip-leaderboard', async (_req: Request, res: Response) => {
  try {
    const sorted = Array.from(tipLeaderboard.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([address, total]) => ({ address, totalBTF: total }));

    res.json({ success: true, leaderboard: sorted });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /economy-stats — Platform BTF economy metrics
 */
router.get('/economy-stats', async (_req: Request, res: Response) => {
  try {
    const stats = await publicClient.readContract({
      address: BTF_TOKEN_ADDRESS as `0x${string}`,
      abi: GET_TOKEN_STATS_ABI,
      functionName: 'getTokenStats',
    });

    const totalBurned = formatEther(stats[1]);
    const ecosystemDistributed = formatEther(stats[2]);
    const ecosystemRemaining = formatEther(stats[3]);

    const totalActiveBoosts = Array.from(activeBoosts.values())
      .filter(b => new Date() < b.expiresAt).length;

    const totalTipVolume = Array.from(tipLeaderboard.values())
      .reduce((sum, v) => sum + v, 0);

    res.json({
      success: true,
      economy: {
        totalBurned,
        ecosystemDistributed,
        ecosystemRemaining,
        totalActiveBoosts,
        totalTipVolume: totalTipVolume.toFixed(2),
        totalTippedArtists: tipLeaderboard.size,
        serviceBurnRate: '50%',
        transferBurnRate: '2%',
      },
    });
  } catch (error: any) {
    console.error('[BTF Services] Economy stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /user-status — Get user's BTF status (balance, tier, access)
 * Query: ?wallet=0x...
 */
router.get('/user-status', async (req: Request, res: Response) => {
  try {
    const walletAddress = (req.query.wallet as string);
    if (!walletAddress || !walletAddress.startsWith('0x')) {
      return res.status(400).json({ success: false, error: 'Valid wallet address required' });
    }

    const [tier, balance] = await Promise.all([
      getUserTierOnChain(walletAddress),
      getUserBalance(walletAddress),
    ]);

    const isHolder = parseFloat(balance) > 0;
    const discount = TIER_DISCOUNTS[tier] || 0;

    res.json({
      success: true,
      wallet: walletAddress,
      balance,
      tier,
      isHolder,
      discountPercent: tier === 'Platinum' ? 60 : discount,
      freeServicesCount: tier === 'Platinum'
        ? Object.values(SERVICE_PRICES).filter(s => s.freeForPlatinum).length
        : 0,
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
