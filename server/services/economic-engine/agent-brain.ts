/**
 * BOOSTIFY ECONOMIC ENGINE — Agent Brain (OpenClaw/LLM)
 * Replaces Math.random() and hardcoded if/else with LLM-powered reasoning
 * Each agent can call the brain for intelligent decision-making
 */

import OpenAI from 'openai';
import { buildFinancialAgentPrompt } from '../../utils/economic-skills-injector';

// ============================================
// TYPES
// ============================================

export interface AgentDecision {
  action: string;
  confidence: number; // 0-100
  reasoning: string;
  parameters: Record<string, any>;
  riskScore: number; // 0-100
  shouldExecute: boolean;
}

export interface MarketContext {
  prices: Record<string, number>;
  fearGreedIndex: number;
  btcDominance: number;
  marketTrend: 'bullish' | 'bearish' | 'neutral';
  totalVolume24h: number;
}

export interface PortfolioContext {
  totalValue: number;
  vaultBalances: Record<string, number>;
  activePositions: Array<{
    protocol: string;
    type: string;
    amount: number;
    pnl: number;
    age: number;
  }>;
  operatingMode: string;
  healthScore: number;
  riskTolerance: string;
}

// ============================================
// SYSTEM PROMPTS PER AGENT
// ============================================

const AGENT_SYSTEM_PROMPTS: Record<string, string> = {
  capital_keeper: buildFinancialAgentPrompt('capital_keeper', `You are the Capital Keeper agent for Boostify Music's Economic Engine.
Your role is CAPITAL PRESERVATION with guaranteed 24h liquidity.
You manage conservative DeFi positions: stablecoin lending (Aave, Compound) and low-risk vaults.

Rules:
- NEVER recommend anything with APY > 15% (too risky for your mandate)
- Always maintain 40% in instantly withdrawable positions
- Prefer established protocols only (Aave V3, Compound V3, top Yearn vaults)
- If market fear index < 25, recommend increasing cash position
- Maximum single position: 30% of your allocation

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),

  flow_maker: buildFinancialAgentPrompt('flow_maker', `You are the Flow Maker agent for Boostify Music's Economic Engine.
Your role is YIELD GENERATION through LP pools and yield farming.
You manage medium-risk DeFi positions: Uniswap V3 LP, Curve pools, yield farms.

Rules:
- Target APY range: 5-25%
- Always check impermanent loss risk before LP positions
- Prefer stablecoin pairs (USDC/USDT, USDC/DAI) in volatile markets
- Diversify across at least 2-3 protocols
- Rebalance positions that deviate >10% from target allocation
- If health score < 50, reduce exposure by 50%

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),

  alpha_hunter: buildFinancialAgentPrompt('alpha_hunter', `You are the Alpha Hunter agent for Boostify Music's Economic Engine.
Your role is TACTICAL ALPHA through arbitrage, flash loans, and opportunities.
You manage the highest-risk portion of the portfolio.

Rules:
- NEVER risk more than 10% of total DeFi allocation on a single trade
- Minimum confidence threshold: 75% before executing
- Check token security (GoPlus) before any new token interaction
- Flash loan arbitrage only if spread > 0.5% after gas
- Set hard stop-loss at -10% on every position
- Take profit at +5% minimum
- In survival/defense mode: YOU ARE FROZEN, do not execute

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),

  shield_node: buildFinancialAgentPrompt('shield_node', `You are the Shield Node agent for Boostify Music's Economic Engine.
Your role is RISK MANAGEMENT with veto power and circuit breaker authority.
You monitor all positions and can freeze the entire engine.

Rules:
- Activate circuit breaker if total drawdown > 15%
- Warning zone at 10% drawdown: reduce all positions by 30%
- Veto any position with risk score > 80
- Monitor gas prices: pause operations if gas > 200 gwei
- Check protocol TVL changes: alert if >20% drop in 24h
- Always maintain hedge positions (insurance) of 20% allocation

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),

  market_analyst: buildFinancialAgentPrompt('market_analyst', `You are the Market Analyst agent for Boostify Music's Economic Engine.
Your role is to analyze market conditions and provide actionable intelligence.

Analyze the provided market data and give a comprehensive market assessment:
- Overall market sentiment (bullish/bearish/neutral)
- Key risk factors
- Opportunities in DeFi yields
- Recommended operating mode based on market conditions
- Any urgent warnings

Respond with JSON: { sentiment, riskFactors, opportunities, recommendedMode, warnings, confidence }`),

  token_operations: buildFinancialAgentPrompt('token_operations', `You are the Token Operations agent for Boostify Music's Economic Engine.
Your role is managing the BTF token: liquidity pool management, market making, and listing strategy.

Rules:
- Maintain minimum liquidity of $10,000 in primary pool
- Keep bid-ask spread < 2% during normal conditions
- Monitor token price vs NAV (net asset value)
- Alert if sell pressure exceeds 3x buy pressure in 1h
- Never dump more than 5% of supply in 24h

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),

  market_hunter: buildFinancialAgentPrompt('market_hunter', `You are the Market Hunter agent for Boostify Music's Economic Engine.
Your role is TACTICAL DAY TRADING of crypto spot positions on Polygon.
You execute WMATIC/WETH spot trades with strict risk controls.

Rules:
- Only enter trades with confluence of RSI, MACD, and Bollinger signals
- Hard stop-loss at -3% per trade, take-profit at +5%
- Maximum 2 concurrent trades
- NEVER trade during extreme fear (F&G < 20) or extreme greed (F&G > 80)
- Spot only: no leverage, no futures, no shorts

Respond with JSON: { action, confidence, reasoning, parameters, riskScore, shouldExecute }`),
};

// ============================================
// AGENT BRAIN (LLM-POWERED DECISION ENGINE)
// ============================================

export class AgentBrain {
  private client: OpenAI | null = null;
  private model: string;

  constructor() {
    this.model = process.env.AGENT_LLM_MODEL || 'gpt-4o-mini';
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  /**
   * Ask an agent to make a decision based on market + portfolio context
   */
  async decide(
    agentType: string,
    prompt: string,
    market: MarketContext,
    portfolio: PortfolioContext
  ): Promise<AgentDecision> {
    if (!this.client) {
      // Fallback to rule-based decision if no LLM configured
      return this.fallbackDecision(agentType, market, portfolio);
    }

    const systemPrompt = AGENT_SYSTEM_PROMPTS[agentType] || AGENT_SYSTEM_PROMPTS.market_analyst;

    const contextBlock = `
CURRENT MARKET DATA:
- BTC Dominance: ${market.btcDominance}%
- Fear & Greed Index: ${market.fearGreedIndex}/100
- Market Trend: ${market.marketTrend}
- 24h Volume: $${(market.totalVolume24h / 1e9).toFixed(1)}B
- Prices: ${JSON.stringify(market.prices)}

PORTFOLIO STATE:
- Total Value: $${portfolio.totalValue.toFixed(2)}
- Operating Mode: ${portfolio.operatingMode}
- Health Score: ${portfolio.healthScore}/100
- Risk Tolerance: ${portfolio.riskTolerance}
- Vault Balances: ${JSON.stringify(portfolio.vaultBalances)}
- Active Positions: ${portfolio.activePositions.length} (${portfolio.activePositions.map(p => `${p.protocol}: $${p.amount} [${p.pnl > 0 ? '+' : ''}${p.pnl}%]`).join(', ')})
`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contextBlock + '\n\nDECISION REQUEST:\n' + prompt },
        ],
        temperature: 0.3, // Low temperature for financial decisions
        max_tokens: 800,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      const parsed = JSON.parse(content);

      return {
        action: parsed.action || 'hold',
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reasoning: parsed.reasoning || 'No reasoning provided',
        parameters: parsed.parameters || {},
        riskScore: Math.min(100, Math.max(0, parsed.riskScore || 50)),
        shouldExecute: parsed.shouldExecute === true && (parsed.confidence || 0) >= 60,
      };
    } catch (error: any) {
      console.error(`[AgentBrain] LLM call failed for ${agentType}:`, error.message);
      return this.fallbackDecision(agentType, market, portfolio);
    }
  }

  /**
   * Analyze market conditions — used by the orchestrator
   */
  async analyzeMarket(
    market: MarketContext
  ): Promise<{
    sentiment: string;
    riskFactors: string[];
    opportunities: string[];
    recommendedMode: string;
    warnings: string[];
    confidence: number;
  }> {
    if (!this.client) {
      return this.fallbackMarketAnalysis(market);
    }

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: AGENT_SYSTEM_PROMPTS.market_analyst },
          {
            role: 'user',
            content: `Analyze this market state:\n${JSON.stringify(market, null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 600,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content || '{}';
      return JSON.parse(content);
    } catch {
      return this.fallbackMarketAnalysis(market);
    }
  }

  // ── Fallback (rule-based when LLM unavailable) ──

  private fallbackDecision(
    agentType: string,
    market: MarketContext,
    portfolio: PortfolioContext
  ): AgentDecision {
    const isBearish = market.fearGreedIndex < 30;
    const isHealthy = portfolio.healthScore > 70;

    // Conservative defaults
    if (agentType === 'capital_keeper') {
      return {
        action: 'supply_aave',
        confidence: isHealthy ? 80 : 50,
        reasoning: `Rule-based: Health ${portfolio.healthScore}, FearGreed ${market.fearGreedIndex}`,
        parameters: { protocol: 'aave_v3', asset: 'USDC' },
        riskScore: 15,
        shouldExecute: isHealthy && !isBearish,
      };
    }

    if (agentType === 'alpha_hunter') {
      return {
        action: 'hold',
        confidence: 30,
        reasoning: 'Rule-based fallback: Alpha hunting requires LLM intelligence',
        parameters: {},
        riskScore: 70,
        shouldExecute: false,
      };
    }

    return {
      action: 'hold',
      confidence: 40,
      reasoning: 'Fallback rule-based decision — LLM not configured',
      parameters: {},
      riskScore: 50,
      shouldExecute: false,
    };
  }

  private fallbackMarketAnalysis(market: MarketContext) {
    let sentiment = 'neutral';
    let recommendedMode = 'stable';

    if (market.fearGreedIndex < 25) {
      sentiment = 'bearish';
      recommendedMode = 'defense';
    } else if (market.fearGreedIndex > 75) {
      sentiment = 'bullish';
      recommendedMode = 'expansion';
    }

    return {
      sentiment,
      riskFactors: market.fearGreedIndex < 40 ? ['High fear in market'] : [],
      opportunities: market.fearGreedIndex > 60 ? ['Favorable market for yield farming'] : [],
      recommendedMode,
      warnings: market.fearGreedIndex < 20 ? ['Extreme fear — consider pausing DeFi operations'] : [],
      confidence: 60,
    };
  }
}

// ── Singleton ──

let _brain: AgentBrain | null = null;

export function getAgentBrain(): AgentBrain {
  if (!_brain) _brain = new AgentBrain();
  return _brain;
}
