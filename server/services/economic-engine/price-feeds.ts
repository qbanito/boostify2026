/**
 * BOOSTIFY ECONOMIC ENGINE — Price Feed Service
 * Real-time price data from CoinGecko + Chainlink on-chain oracles
 * Provides market data for all agent decisions
 */

import { ethers } from 'ethers';
import { getProvider, POLYGON_ADDRESSES } from './blockchain-provider';

// ============================================
// CHAINLINK AGGREGATOR ABI (minimal)
// ============================================

const CHAINLINK_ABI = [
  'function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)',
  'function decimals() view returns (uint8)',
  'function description() view returns (string)',
];

// ============================================
// TYPES
// ============================================

export interface TokenPrice {
  symbol: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
  marketCap: number;
  lastUpdated: string;
}

export interface MarketOverview {
  totalMarketCap: number;
  totalVolume24h: number;
  btcDominance: number;
  fearGreedIndex: number;
  trending: string[];
}

export interface DexPoolData {
  pairAddress: string;
  baseToken: string;
  quoteToken: string;
  priceUsd: number;
  liquidity: number;
  volume24h: number;
  priceChange24h: number;
  txCount24h: number;
}

// ============================================
// COINGECKO API (Free tier: 30 calls/min)
// ============================================

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_BASE = 'https://pro-api.coingecko.com/api/v3';

function getCoinGeckoHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  if (key) return { 'x-cg-pro-api-key': key };
  return {};
}

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_KEY ? COINGECKO_PRO_BASE : COINGECKO_BASE;
}

async function cgFetch(path: string): Promise<any> {
  const url = `${getCoinGeckoBase()}${path}`;
  const res = await fetch(url, { headers: getCoinGeckoHeaders() });
  if (!res.ok) throw new Error(`CoinGecko API error: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function getTokenPrices(tokenIds: string[]): Promise<TokenPrice[]> {
  const ids = tokenIds.join(',');
  const data = await cgFetch(
    `/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false`
  );
  return data.map((coin: any) => ({
    symbol: coin.symbol?.toUpperCase(),
    priceUsd: coin.current_price || 0,
    change24h: coin.price_change_percentage_24h || 0,
    volume24h: coin.total_volume || 0,
    marketCap: coin.market_cap || 0,
    lastUpdated: coin.last_updated || new Date().toISOString(),
  }));
}

export async function getSimplePrice(ids: string): Promise<Record<string, { usd: number }>> {
  return cgFetch(`/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`);
}

export async function getMarketOverview(): Promise<MarketOverview> {
  const [globalData, trendingData] = await Promise.all([
    cgFetch('/global'),
    cgFetch('/search/trending').catch(() => ({ coins: [] })),
  ]);

  return {
    totalMarketCap: globalData.data?.total_market_cap?.usd || 0,
    totalVolume24h: globalData.data?.total_volume?.usd || 0,
    btcDominance: globalData.data?.market_cap_percentage?.btc || 0,
    fearGreedIndex: 50, // Will use alternative.me API separately
    trending: (trendingData.coins || []).slice(0, 5).map((c: any) => c.item?.symbol || ''),
  };
}

// ============================================
// DEXSCREENER API (Free, no key needed)
// ============================================

const DEXSCREENER_BASE = 'https://api.dexscreener.com/latest';

export async function getDexPairData(
  chainId: string,
  pairAddress: string
): Promise<DexPoolData | null> {
  const res = await fetch(`${DEXSCREENER_BASE}/dex/pairs/${chainId}/${pairAddress}`);
  if (!res.ok) return null;
  const data = await res.json();
  const pair = data.pairs?.[0];
  if (!pair) return null;

  return {
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken?.symbol || '',
    quoteToken: pair.quoteToken?.symbol || '',
    priceUsd: parseFloat(pair.priceUsd) || 0,
    liquidity: pair.liquidity?.usd || 0,
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    txCount24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
  };
}

export async function searchDexTokens(query: string): Promise<DexPoolData[]> {
  const res = await fetch(`${DEXSCREENER_BASE}/dex/search/?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.pairs || []).slice(0, 10).map((pair: any) => ({
    pairAddress: pair.pairAddress,
    baseToken: pair.baseToken?.symbol || '',
    quoteToken: pair.quoteToken?.symbol || '',
    priceUsd: parseFloat(pair.priceUsd) || 0,
    liquidity: pair.liquidity?.usd || 0,
    volume24h: pair.volume?.h24 || 0,
    priceChange24h: pair.priceChange?.h24 || 0,
    txCount24h: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
  }));
}

// ============================================
// CHAINLINK ON-CHAIN PRICE FEEDS (Polygon)
// ============================================

export async function getChainlinkPrice(feedAddress: string): Promise<number> {
  const provider = getProvider();
  const feed = new ethers.Contract(feedAddress, CHAINLINK_ABI, provider);
  const [, answer, , , ] = await feed.latestRoundData();
  const decimals = await feed.decimals();
  return Number(answer) / Math.pow(10, Number(decimals));
}

export async function getOnChainPrices(): Promise<{
  maticUsd: number;
  ethUsd: number;
  btcUsd: number;
}> {
  const [maticUsd, ethUsd, btcUsd] = await Promise.all([
    getChainlinkPrice(POLYGON_ADDRESSES.CHAINLINK_MATIC_USD),
    getChainlinkPrice(POLYGON_ADDRESSES.CHAINLINK_ETH_USD),
    getChainlinkPrice(POLYGON_ADDRESSES.CHAINLINK_BTC_USD),
  ]);
  return { maticUsd, ethUsd, btcUsd };
}

// ============================================
// FEAR & GREED INDEX (alternative.me)
// ============================================

export async function getFearGreedIndex(): Promise<{ value: number; label: string }> {
  try {
    const res = await fetch('https://api.alternative.me/fng/?limit=1');
    if (!res.ok) return { value: 50, label: 'Neutral' };
    const data = await res.json();
    const entry = data.data?.[0];
    return {
      value: parseInt(entry?.value || '50'),
      label: entry?.value_classification || 'Neutral',
    };
  } catch {
    return { value: 50, label: 'Neutral' };
  }
}

// ============================================
// AGGREGATED MARKET INTELLIGENCE
// ============================================

export async function getFullMarketSnapshot(): Promise<{
  prices: Record<string, number>;
  market: MarketOverview;
  fearGreed: { value: number; label: string };
  onChain: { maticUsd: number; ethUsd: number; btcUsd: number } | null;
}> {
  const [priceData, market, fearGreed] = await Promise.all([
    getSimplePrice('matic-network,ethereum,bitcoin,usd-coin').catch(() => ({})),
    getMarketOverview().catch(() => ({
      totalMarketCap: 0,
      totalVolume24h: 0,
      btcDominance: 0,
      fearGreedIndex: 50,
      trending: [],
    })),
    getFearGreedIndex(),
  ]);

  // On-chain prices need Alchemy — try but don't fail
  let onChain = null;
  try {
    if (process.env.ALCHEMY_API_KEY) {
      onChain = await getOnChainPrices();
    }
  } catch {}

  const prices: Record<string, number> = {};
  for (const [key, value] of Object.entries(priceData)) {
    prices[key] = (value as any)?.usd || 0;
  }

  return { prices, market, fearGreed, onChain };
}
