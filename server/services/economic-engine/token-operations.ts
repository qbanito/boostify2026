/**
 * BOOSTIFY ECONOMIC ENGINE — Token Operations
 * BTF token management: pool creation, listing, market making
 * Community token distribution and airdrops
 */

import { ethers } from 'ethers';
import { getProvider, getSigner, POLYGON_ADDRESSES } from './blockchain-provider';
import { getWalletManager } from './wallet-manager';
import { getSecurityChecker } from './defi-adapters';
import { searchDexTokens, getDexPairData } from './price-feeds';

// ============================================
// BTF TOKEN ABI (ERC-20 with mint/burn)
// ============================================

const BTF_TOKEN_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function mint(address to, uint256 amount)',
  'function burn(uint256 amount)',
  'function owner() view returns (address)',
  'function paused() view returns (bool)',
];

// ============================================
// TOKEN OPERATIONS SERVICE
// ============================================

export class TokenOperationsService {
  // ── Token Info ──

  async getTokenInfo(): Promise<{
    address: string;
    name: string;
    symbol: string;
    decimals: number;
    totalSupply: string;
    treasuryBalance: string;
    isConfigured: boolean;
  }> {
    const tokenAddress = POLYGON_ADDRESSES.BTF_TOKEN;
    if (!tokenAddress) {
      return {
        address: '',
        name: 'BTF Token',
        symbol: 'BTF',
        decimals: 18,
        totalSupply: '0',
        treasuryBalance: '0',
        isConfigured: false,
      };
    }

    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, BTF_TOKEN_ABI, provider);
    const wallet = getWalletManager();

    const [name, symbol, decimals, totalSupply, balance] = await Promise.all([
      contract.name(),
      contract.symbol(),
      contract.decimals(),
      contract.totalSupply(),
      contract.balanceOf(wallet.address),
    ]);

    return {
      address: tokenAddress,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
      treasuryBalance: ethers.formatUnits(balance, decimals),
      isConfigured: true,
    };
  }

  // ── Token Distribution ──

  async distributeTokens(
    recipients: Array<{ address: string; amount: string }>
  ): Promise<Array<{ address: string; txHash: string; success: boolean }>> {
    const tokenAddress = POLYGON_ADDRESSES.BTF_TOKEN;
    if (!tokenAddress) throw new Error('BTF_TOKEN_ADDRESS not configured');

    const signer = getSigner();
    const contract = new ethers.Contract(tokenAddress, BTF_TOKEN_ABI, signer);
    const results: Array<{ address: string; txHash: string; success: boolean }> = [];

    for (const recipient of recipients) {
      try {
        const amount = ethers.parseEther(recipient.amount);
        const tx = await contract.transfer(recipient.address, amount);
        const receipt = await tx.wait();
        results.push({
          address: recipient.address,
          txHash: receipt.hash,
          success: true,
        });
      } catch (error: any) {
        results.push({
          address: recipient.address,
          txHash: '',
          success: false,
        });
      }
    }

    return results;
  }

  // ── Pool Management ──

  async getPoolData(): Promise<{
    exists: boolean;
    pairAddress: string;
    priceUsd: number;
    liquidity: number;
    volume24h: number;
    priceChange24h: number;
  } | null> {
    const tokenAddress = POLYGON_ADDRESSES.BTF_TOKEN;
    if (!tokenAddress) return null;

    // Search DexScreener for BTF pairs
    const pairs = await searchDexTokens(tokenAddress);
    if (pairs.length === 0) {
      return {
        exists: false,
        pairAddress: '',
        priceUsd: 0,
        liquidity: 0,
        volume24h: 0,
        priceChange24h: 0,
      };
    }

    const mainPair = pairs[0];
    return {
      exists: true,
      pairAddress: mainPair.pairAddress,
      priceUsd: mainPair.priceUsd,
      liquidity: mainPair.liquidity,
      volume24h: mainPair.volume24h,
      priceChange24h: mainPair.priceChange24h,
    };
  }

  // ── Security Audit ──

  async auditToken(): Promise<{
    isSafe: boolean;
    isOpenSource: boolean;
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    holders: number;
    riskLevel: string;
  } | null> {
    const tokenAddress = POLYGON_ADDRESSES.BTF_TOKEN;
    if (!tokenAddress) return null;

    const checker = getSecurityChecker();
    return checker.checkTokenSecurity(tokenAddress);
  }

  // ── Token Metrics Dashboard ──

  async getMetrics(): Promise<{
    token: { address: string; symbol: string; totalSupply: string; isConfigured: boolean };
    pool: { exists: boolean; priceUsd: number; liquidity: number; volume24h: number } | null;
    treasury: { balance: string };
  }> {
    const tokenInfo = await this.getTokenInfo();
    const poolData = await this.getPoolData().catch(() => null);
    const wallet = getWalletManager();
    const balances = await wallet.getWalletBalances().catch(() => ({
      matic: '0', usdc: '0', usdt: '0', weth: '0', btf: '0',
    }));

    return {
      token: {
        address: tokenInfo.address,
        symbol: tokenInfo.symbol,
        totalSupply: tokenInfo.totalSupply,
        isConfigured: tokenInfo.isConfigured,
      },
      pool: poolData ? {
        exists: poolData.exists,
        priceUsd: poolData.priceUsd,
        liquidity: poolData.liquidity,
        volume24h: poolData.volume24h,
      } : null,
      treasury: {
        balance: balances.usdc,
      },
    };
  }
}

// ── Listing Strategy ──

export interface ListingAction {
  platform: string;
  status: 'not_started' | 'submitted' | 'listed' | 'rejected';
  requirements: string[];
  url: string;
}

export function getListingStrategy(): ListingAction[] {
  return [
    {
      platform: 'DexScreener',
      status: 'not_started',
      requirements: ['Active Uniswap pool with >$1K liquidity', 'Token contract verified on Polygonscan'],
      url: 'https://dexscreener.com/polygon',
    },
    {
      platform: 'GeckoTerminal',
      status: 'not_started',
      requirements: ['Active DEX pool', 'Auto-detected once pool has trades'],
      url: 'https://www.geckoterminal.com',
    },
    {
      platform: 'CoinGecko',
      status: 'not_started',
      requirements: ['Listed on DEX with consistent volume', 'Working website', 'Active community', 'Submit via request form'],
      url: 'https://www.coingecko.com/en/coins/listing',
    },
    {
      platform: 'CoinMarketCap',
      status: 'not_started',
      requirements: ['Listed on ≥1 tracked exchange', 'Working block explorer', 'Supply API endpoint', 'Submit application'],
      url: 'https://support.coinmarketcap.com/hc/en-us/articles/360043659351',
    },
    {
      platform: 'DEXTools',
      status: 'not_started',
      requirements: ['Active Uniswap/SushiSwap pool', 'Contract verified', 'Auto-detected once trades occur'],
      url: 'https://www.dextools.io',
    },
  ];
}

// ── Singleton ──

let _tokenOps: TokenOperationsService | null = null;

export function getTokenOperations(): TokenOperationsService {
  if (!_tokenOps) _tokenOps = new TokenOperationsService();
  return _tokenOps;
}
