/**
 * BOOSTIFY ECONOMIC ENGINE — Market Intelligence Service
 * Aggregates all market data sources into actionable intelligence
 * Feeds the Agent Brain with real-time context for decisions
 */

import { getFullMarketSnapshot, getTokenPrices, getFearGreedIndex, searchDexTokens } from './price-feeds';
import { getAgentBrain, type MarketContext } from './agent-brain';
import { isConfigured as blockchainConfigured, getConfigStatus } from './blockchain-provider';
import { getAaveAdapter, getOneInchAdapter, getSecurityChecker, getSimulator } from './defi-adapters';
import { getTokenOperations, getListingStrategy } from './token-operations';
import { getCommunityManager } from './community-bots';
import { getCombinedSentimentSignal, type CombinedSentimentSignal } from './sentiment-tracker';

// ============================================
// TYPES
// ============================================

export interface SystemStatus {
  blockchain: {
    alchemyConfigured: boolean;
    walletConfigured: boolean;
    btfTokenConfigured: boolean;
    network: string;
  };
  defi: {
    aaveAvailable: boolean;
    oneInchAvailable: boolean;
    tenderlyAvailable: boolean;
  };
  intelligence: {
    llmConfigured: boolean;
    model: string;
  };
  community: {
    discordConfigured: boolean;
    telegramConfigured: boolean;
    twitterConfigured: boolean;
  };
  token: {
    isConfigured: boolean;
    address: string;
  };
}

export interface MarketIntelligenceReport {
  timestamp: string;
  market: MarketContext;
  analysis: {
    sentiment: string;
    riskFactors: string[];
    opportunities: string[];
    recommendedMode: string;
    warnings: string[];
    confidence: number;
  };
  systemStatus: SystemStatus;
  sentiment?: CombinedSentimentSignal;
}

// ============================================
// MARKET INTELLIGENCE SERVICE
// ============================================

export class MarketIntelligenceService {
  /**
   * Generate full system status — what's configured and operational
   */
  getSystemStatus(): SystemStatus {
    const blockchainStatus = getConfigStatus();
    const brain = getAgentBrain();
    const oneInch = getOneInchAdapter();
    const simulator = getSimulator();
    const community = getCommunityManager();
    const communityStatus = community.getStatus();

    return {
      blockchain: blockchainStatus,
      defi: {
        aaveAvailable: blockchainStatus.walletConfigured,
        oneInchAvailable: oneInch.isConfigured(),
        tenderlyAvailable: simulator.isConfigured(),
      },
      intelligence: {
        llmConfigured: brain.isConfigured(),
        model: process.env.AGENT_LLM_MODEL || 'gpt-4o-mini',
      },
      community: {
        discordConfigured: communityStatus.discord !== null,
        telegramConfigured: communityStatus.telegram !== null,
        twitterConfigured: communityStatus.twitter !== null,
      },
      token: {
        isConfigured: blockchainStatus.btfTokenConfigured,
        address: process.env.BTF_TOKEN_ADDRESS || '',
      },
    };
  }

  /**
   * Build MarketContext for agent decisions — from real API data
   */
  async buildMarketContext(): Promise<MarketContext> {
    try {
      const snapshot = await getFullMarketSnapshot();

      let marketTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
      if (snapshot.fearGreed.value > 60) marketTrend = 'bullish';
      else if (snapshot.fearGreed.value < 35) marketTrend = 'bearish';

      return {
        prices: snapshot.prices,
        fearGreedIndex: snapshot.fearGreed.value,
        btcDominance: snapshot.market.btcDominance,
        marketTrend,
        totalVolume24h: snapshot.market.totalVolume24h,
      };
    } catch (error) {
      // Fallback context if APIs fail
      return {
        prices: {},
        fearGreedIndex: 50,
        btcDominance: 50,
        marketTrend: 'neutral',
        totalVolume24h: 0,
      };
    }
  }

  /**
   * Generate a full intelligence report with LLM analysis
   */
  async generateReport(): Promise<MarketIntelligenceReport> {
    const market = await this.buildMarketContext();
    const brain = getAgentBrain();
    const analysis = await brain.analyzeMarket(market);
    const systemStatus = this.getSystemStatus();

    // Enrich with aggregated sentiment (fails silently)
    const sentiment = await getCombinedSentimentSignal().catch(() => undefined);

    return {
      timestamp: new Date().toISOString(),
      market,
      analysis,
      systemStatus,
      sentiment,
    };
  }

  /**
   * Get yield opportunities across protocols
   */
  async getYieldOpportunities(): Promise<Array<{
    protocol: string;
    asset: string;
    apy: number;
    tvl: string;
    risk: 'low' | 'medium' | 'high';
    available: boolean;
  }>> {
    const opportunities = [];

    // Aave USDC yield
    try {
      if (getConfigStatus().walletConfigured) {
        const aave = getAaveAdapter();
        const apy = await aave.getSupplyAPY();
        opportunities.push({
          protocol: 'Aave V3',
          asset: 'USDC',
          apy,
          tvl: 'High',
          risk: 'low' as const,
          available: true,
        });
      }
    } catch {}

    // Static known opportunities (updated periodically)
    opportunities.push(
      {
        protocol: 'Compound V3',
        asset: 'USDC',
        apy: 3.5,
        tvl: '$1.2B',
        risk: 'low' as const,
        available: false, // Not yet integrated
      },
      {
        protocol: 'Yearn V3',
        asset: 'USDC',
        apy: 5.2,
        tvl: '$800M',
        risk: 'low' as const,
        available: false,
      },
      {
        protocol: 'Uniswap V3',
        asset: 'USDC/USDT',
        apy: 8.5,
        tvl: '$500M',
        risk: 'medium' as const,
        available: getConfigStatus().walletConfigured,
      },
      {
        protocol: 'Curve',
        asset: '3pool',
        apy: 4.1,
        tvl: '$2B',
        risk: 'low' as const,
        available: false,
      }
    );

    return opportunities;
  }

  /**
   * Get token listing progress
   */
  getListingProgress() {
    return getListingStrategy();
  }

  /**
   * Get community status across all platforms
   */
  getCommunityStatus() {
    return getCommunityManager().getStatus();
  }

  /**
   * Check a token's security before any interaction
   */
  async checkTokenSecurity(tokenAddress: string): Promise<any> {
    const checker = getSecurityChecker();
    return checker.checkTokenSecurity(tokenAddress);
  }
}

// ── Singleton ──

let _marketIntel: MarketIntelligenceService | null = null;

export function getMarketIntelligence(): MarketIntelligenceService {
  if (!_marketIntel) _marketIntel = new MarketIntelligenceService();
  return _marketIntel;
}
