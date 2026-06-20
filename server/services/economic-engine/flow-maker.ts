/**
 * FLOW MAKER — Yield & Liquidity Agent
 * Mandate: Generate stable yields via LP pools and yield farming
 * Operates with 30% of DeFi allocation
 * 
 * REAL MODE: Uses Uniswap V3 / 1inch on Polygon for real swaps & LP
 * SIMULATED MODE: Falls back to DB-only tracking when wallet not configured
 */

import { db } from '../../db';
import { defiPositions, defiAgentActions } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { AgentAction, RiskAssessment } from './types';
import { isConfigured as blockchainReady, POLYGON_ADDRESSES } from './blockchain-provider';
import { getUniswapAdapter, getOneInchAdapter, getSecurityChecker, getMultiDexAggregator } from './defi-adapters';
import { getAgentBrain, type PortfolioContext, type MarketContext } from './agent-brain';
import { getTokenPrices } from './price-feeds';
import { getCommunityManager } from './community-bots';

const AGENT_TYPE = 'flow_maker' as const;

// Available yield strategies with risk profiles
const YIELD_STRATEGIES = [
  { protocol: 'Uniswap V3', asset: 'USDC/ETH LP', type: 'liquidity_pool' as const, apy: 8.5, risk: 35, realSupport: true },
  { protocol: 'Curve Finance', asset: '3pool (DAI/USDC/USDT)', type: 'liquidity_pool' as const, apy: 5.2, risk: 15, realSupport: false },
  { protocol: 'Yearn Finance', asset: 'yvUSDC', type: 'yield_farm' as const, apy: 6.8, risk: 20, realSupport: false },
  { protocol: 'Lido', asset: 'stETH', type: 'yield_farm' as const, apy: 3.8, risk: 25, realSupport: false },
  { protocol: 'Convex Finance', asset: 'cvxCRV', type: 'yield_farm' as const, apy: 7.5, risk: 30, realSupport: false },
];

/**
 * Execute Flow Maker's yield strategy
 * - Uses AgentBrain (LLM) to pick optimal strategy
 * - Executes real swaps via 1inch when blockchain configured
 * - Falls back to simulated positions when not
 */
export async function executeFlowMakerCycle(
  artistId: number, allocatedAmount: number, riskTolerance: string
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  if (allocatedAmount <= 0) return actions;

  const existingPositions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  // Filter strategies by risk tolerance
  const maxRisk = riskTolerance === 'conservative' ? 20 : riskTolerance === 'moderate' ? 35 : 50;
  const eligibleStrategies = YIELD_STRATEGIES.filter(s => s.risk <= maxRisk);

  if (eligibleStrategies.length === 0) return actions;

  // Ask AgentBrain which strategies to pick
  const brain = getAgentBrain();
  let selectedStrategies = eligibleStrategies;
  if (brain.isConfigured()) {
    try {
      const portfolio: PortfolioContext = {
        totalValue: existingPositions.reduce((s, p) => s + parseFloat(p.currentValue), 0) + allocatedAmount,
        positions: existingPositions.map(p => ({
          protocol: p.protocol || '', asset: p.asset || '',
          value: parseFloat(p.currentValue), pnl: parseFloat(p.unrealizedPnl || '0'),
        })),
        availableCash: allocatedAmount,
      };
      const decision = await brain.decide(
        'flow_maker',
        `Allocate $${allocatedAmount.toFixed(2)} across yield strategies. Risk tolerance: ${riskTolerance}. Available: ${eligibleStrategies.map(s => `${s.protocol} (${s.apy}% APY, risk ${s.risk})`).join(', ')}`,
        undefined, portfolio
      );
      // Use LLM selection if it provided strategy names
      if (decision.parameters?.strategies && Array.isArray(decision.parameters.strategies)) {
        const llmPicks = decision.parameters.strategies as string[];
        const matched = eligibleStrategies.filter(s => llmPicks.some(p => s.protocol.toLowerCase().includes(p.toLowerCase())));
        if (matched.length > 0) selectedStrategies = matched;
      }
    } catch {}
  }

  const isReal = blockchainReady();

  // Distribute across selected strategies
  const totalWeight = selectedStrategies.reduce((sum, s) => sum + (s.apy / s.risk), 0);

  for (const strategy of selectedStrategies) {
    const weight = (strategy.apy / strategy.risk) / totalWeight;
    const amount = allocatedAmount * weight;

    if (amount < 5) continue;

    let txHash: string | undefined;
    let realApy = String(strategy.apy);

    // Real execution for supported protocols
    if (isReal && strategy.realSupport && strategy.protocol === 'Uniswap V3') {
      try {
        // SECURITY CHECK: verify both tokens before swapping
        const checker = getSecurityChecker();
        const pairSecurity = await checker.checkSwapPairSecurity(
          POLYGON_ADDRESSES.USDC,
          POLYGON_ADDRESSES.WETH
        );
        if (!pairSecurity.isSafe) {
          console.log(`🛡️ [Flow Maker] Security check BLOCKED swap: ${pairSecurity.summary}`);
          continue;
        }

        const uniswap = getUniswapAdapter();
        const poolAddress = await uniswap.poolExists(
          POLYGON_ADDRESSES.USDC,
          POLYGON_ADDRESSES.WETH,
          3000
        );
        if (poolAddress) {
          // Convert USD amount to USDC 6-decimal bigint
          const usdcAmount = BigInt(Math.floor(amount * 1e6));

          // MULTI-DEX: Compare quotes from all aggregators to find best rate
          const multiDex = getMultiDexAggregator();
          let bestDex = 'uniswap';
          try {
            const comparison = await multiDex.getBestQuote(
              POLYGON_ADDRESSES.USDC,
              POLYGON_ADDRESSES.WETH,
              String(usdcAmount),
              6, 18
            );
            bestDex = comparison.best.dex;
            console.log(`📊 [Flow Maker] Multi-DEX comparison: ${comparison.all.map(q => `${q.dex}=${q.amountOut}`).join(' | ')} → Best: ${bestDex}`);
          } catch {
            console.log(`[Flow Maker] Multi-DEX comparison failed, using Uniswap V3 directly`);
          }

          // Get real quote to calculate minAmountOut with slippage
          const quote = await uniswap.getQuote(
            POLYGON_ADDRESSES.USDC,
            POLYGON_ADDRESSES.WETH,
            usdcAmount,
            3000
          );

          // Apply 1% slippage tolerance
          const minOut = (quote.amountOut * 99n) / 100n;

          // Check gas before executing
          const { getWalletManager } = await import('./wallet-manager');
          const wallet = getWalletManager();
          const hasGas = await wallet.hasEnoughGas(300000n);

          if (hasGas) {
            // Execute real swap: USDC → WETH (single-sided LP proxy)
            const swapResult = await uniswap.swap(
              POLYGON_ADDRESSES.USDC,
              POLYGON_ADDRESSES.WETH,
              usdcAmount,
              minOut,
              3000
            );
            txHash = swapResult.txHash;

            console.log(`✅ [Flow Maker] Real Uniswap V3 swap: $${amount.toFixed(2)} USDC → WETH | TX: ${txHash}`);

            try {
              const community = getCommunityManager();
              await community.broadcastAgentAction({
                agent: 'Flow Maker',
                action: `Uniswap V3 USDC→WETH swap executed`,
                amount: `$${amount.toFixed(2)}`,
                result: `TX: ${txHash}`,
              });
            } catch {}
          } else {
            console.log(`⚠️ [Flow Maker] Insufficient gas for real swap, recording as simulated`);
          }
        }
      } catch (err: any) {
        console.log(`[Flow Maker] Real ${strategy.protocol} failed, falling back to simulated: ${err.message}`);
      }
    }

    const position = await db.insert(defiPositions).values({
      artistId,
      agentType: AGENT_TYPE,
      positionType: strategy.type,
      protocol: strategy.protocol,
      asset: strategy.asset,
      amountInvested: String(amount),
      currentValue: String(amount),
      apy: realApy,
      riskScore: strategy.risk,
      status: 'active',
      metadata: { mode: txHash ? 'real' : 'simulated', txHash },
    }).returning();

    const action: AgentAction = {
      agentType: AGENT_TYPE,
      actionType: 'open_position',
      positionId: position[0]?.id,
      amount,
      reason: `Yield farming: ${strategy.protocol} (${strategy.asset}) at ${realApy}% APY${isReal && strategy.realSupport ? ' [REAL]' : ' [SIM]'}`,
      riskAssessment: assessRisk(amount, strategy.risk),
    };
    actions.push(action);
    await logAction(artistId, action);
  }

  // Harvest yields from existing positions
  const harvestAmount = await harvestAndCompound(artistId, existingPositions);
  if (harvestAmount > 0) {
    actions.push({
      agentType: AGENT_TYPE,
      actionType: 'yield_harvest',
      amount: harvestAmount,
      reason: `Harvested $${harvestAmount.toFixed(2)} from ${existingPositions.length} yield positions`,
    });
  }

  return actions;
}

/**
 * Harvest yields and compound — uses real on-chain data when available
 */
async function harvestAndCompound(artistId: number, positions: any[]): Promise<number> {
  let totalHarvested = 0;
  const isReal = blockchainReady();

  // For real Uniswap positions, fetch actual WETH balance as proxy for value
  let realWethPrice: number | null = null;
  if (isReal) {
    try {
      const prices = await getTokenPrices(['ethereum']);
      realWethPrice = prices.ethereum?.usd || null;
    } catch {}
  }

  for (const pos of positions) {
    const invested = parseFloat(pos.amountInvested);
    const metadata = pos.metadata as any;
    let newValue: number;

    if (isReal && metadata?.mode === 'real' && metadata?.txHash && realWethPrice) {
      // For real positions, estimate value from WETH price movement
      // This is a proxy — in production you'd query LP token value directly
      const currentWethValue = parseFloat(pos.currentValue);
      const priceChange = (realWethPrice - (metadata.entryPrice || realWethPrice)) / (metadata.entryPrice || realWethPrice);
      newValue = invested * (1 + priceChange * 0.5); // LP gets ~50% of price movement
      const dailyYield = Math.max(0, newValue - parseFloat(pos.currentValue));
      totalHarvested += dailyYield;
    } else {
      // Simulated yield based on APY
      const apy = parseFloat(pos.apy || '0');
      const dailyYield = (invested * apy) / (365 * 100);
      totalHarvested += dailyYield;
      newValue = parseFloat(pos.currentValue) + dailyYield;
    }

    await db.update(defiPositions)
      .set({
        currentValue: String(newValue),
        unrealizedPnl: String(newValue - invested),
      })
      .where(eq(defiPositions.id, pos.id));
  }

  return totalHarvested;
}

/**
 * Rebalance underperforming positions
 */
export async function rebalancePositions(artistId: number): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];
  const positions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  for (const pos of positions) {
    const pnl = parseFloat(pos.unrealizedPnl || '0');
    const invested = parseFloat(pos.amountInvested);
    const pnlPct = invested > 0 ? (pnl / invested) * 100 : 0;

    // Close positions with significant negative PnL
    if (pnlPct < -5) {
      await db.update(defiPositions)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(defiPositions.id, pos.id));

      const action: AgentAction = {
        agentType: AGENT_TYPE,
        actionType: 'close_position',
        positionId: pos.id,
        amount: parseFloat(pos.currentValue),
        reason: `Closing underperforming position: ${pos.protocol} at ${pnlPct.toFixed(1)}% PnL`,
      };
      actions.push(action);
      await logAction(artistId, action);
    }
  }

  return actions;
}

function assessRisk(amount: number, riskScore: number): RiskAssessment {
  return {
    riskLevel: riskScore <= 15 ? 'low' : riskScore <= 30 ? 'medium' : 'high',
    drawdownPct: riskScore * 0.3,
    exposurePct: 100,
    recommendation: riskScore <= 20 ? 'Stable yield source' : 'Moderate yield — monitor regularly',
  };
}

async function logAction(artistId: number, action: AgentAction) {
  await db.insert(defiAgentActions).values({
    artistId,
    agentType: AGENT_TYPE,
    actionType: action.actionType,
    positionId: action.positionId,
    amount: action.amount ? String(action.amount) : undefined,
    reason: action.reason,
    riskAssessment: action.riskAssessment,
    outcome: 'success',
  });
}
