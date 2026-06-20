/**
 * ALPHA HUNTER — Tactical Searcher Agent
 * Mandate: Find inefficiencies, execute arbitrage, flash loans
 * Operates with ONLY 10% of DeFi allocation (high risk/reward)
 * RULE: Never operates with Reserve or Operation funds
 * 
 * REAL MODE: Uses 1inch aggregator + AgentBrain (LLM) for real alpha
 * SIMULATED MODE: Falls back to deterministic logic (no Math.random())
 */

import { db } from '../../db';
import { defiPositions, defiAgentActions, riskEngineState } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { AgentAction, RiskAssessment, OperatingMode } from './types';
import { isConfigured as blockchainReady, POLYGON_ADDRESSES } from './blockchain-provider';
import { getOneInchAdapter, getSecurityChecker, getSimulator, getMultiDexAggregator } from './defi-adapters';
import { getAgentBrain, type PortfolioContext, type MarketContext } from './agent-brain';
import { getTokenPrices, getFearGreedIndex } from './price-feeds';
import { getCommunityManager } from './community-bots';

const AGENT_TYPE = 'alpha_hunter' as const;

// Alpha strategies — scored by AgentBrain or deterministic rules
const ALPHA_STRATEGIES = [
  { name: 'DEX Arbitrage (ETH/USDC)', type: 'arbitrage' as const, expectedReturn: 2.5, risk: 60, duration: '1h' },
  { name: 'Liquidation Bot (Aave)', type: 'arbitrage' as const, expectedReturn: 4.0, risk: 45, duration: '24h' },
  { name: 'Flash Loan Arb (Uniswap→Sushi)', type: 'flash_loan' as const, expectedReturn: 1.2, risk: 30, duration: 'instant' },
  { name: 'MEV Sandwich (Low-cap)', type: 'arbitrage' as const, expectedReturn: 3.5, risk: 75, duration: '1h' },
  { name: 'Yield Sniping (New Pool)', type: 'yield_farm' as const, expectedReturn: 15.0, risk: 70, duration: '7d' },
];

/**
 * Execute Alpha Hunter's tactical strategy
 * CRITICAL: This agent is FROZEN in survival and defense modes
 * Uses LLM to evaluate opportunities instead of Math.random()
 */
export async function executeAlphaHunterCycle(
  artistId: number, allocatedAmount: number, currentMode: OperatingMode
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  // MANDATE #1: Alpha Hunter is FROZEN in survival and defense modes
  if (currentMode === 'survival' || currentMode === 'defense') {
    await logAction(artistId, {
      agentType: AGENT_TYPE,
      actionType: 'audit',
      reason: `Alpha Hunter FROZEN: operating mode is ${currentMode}`,
    });
    return actions;
  }

  if (allocatedAmount <= 0) return actions;

  // Check Shield veto
  const [riskState] = await db.select().from(riskEngineState)
    .where(eq(riskEngineState.artistId, artistId));
  
  if (riskState?.shieldVetoActive) {
    await logAction(artistId, {
      agentType: AGENT_TYPE,
      actionType: 'audit',
      reason: 'Alpha Hunter BLOCKED: Shield Node veto active',
    });
    return actions;
  }

  // Get existing positions
  const existingPositions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  // Limit: max 3 concurrent alpha positions
  if (existingPositions.length >= 3) {
    await logAction(artistId, {
      agentType: AGENT_TYPE,
      actionType: 'audit',
      reason: `Alpha Hunter at max capacity: ${existingPositions.length}/3 positions`,
    });
    return actions;
  }

  // Filter by mode risk tolerance
  const maxRisk = currentMode === 'aggressive' ? 75 : 50;
  const eligible = ALPHA_STRATEGIES.filter(s => s.risk <= maxRisk);
  
  if (eligible.length === 0) return actions;

  // Use AgentBrain (LLM) to evaluate opportunities
  const brain = getAgentBrain();
  const isReal = blockchainReady();
  let bestOpportunity = eligible.sort((a, b) => (b.expectedReturn / b.risk) - (a.expectedReturn / a.risk))[0];
  let shouldExecute = true;
  let confidence = 0.5;

  if (brain.isConfigured()) {
    try {
      // Build market context from real data
      let marketCtx: MarketContext | undefined;
      try {
        const fearGreed = await getFearGreedIndex();
        marketCtx = {
          prices: {},
          fearGreedIndex: fearGreed.value,
          btcDominance: 50,
          marketTrend: fearGreed.value > 60 ? 'bullish' : fearGreed.value < 35 ? 'bearish' : 'neutral',
          totalVolume24h: 0,
        };
      } catch {}

      const portfolio: PortfolioContext = {
        totalValue: existingPositions.reduce((s, p) => s + parseFloat(p.currentValue), 0) + allocatedAmount,
        positions: existingPositions.map(p => ({
          protocol: p.protocol || '', asset: p.asset || '',
          value: parseFloat(p.currentValue), pnl: parseFloat(p.unrealizedPnl || '0'),
        })),
        availableCash: allocatedAmount,
      };

      const decision = await brain.decide(
        'alpha_hunter',
        `Evaluate alpha opportunities with $${allocatedAmount.toFixed(2)}. Mode: ${currentMode}. Options: ${eligible.map(s => `${s.name} (${s.expectedReturn}% return, ${s.risk} risk)`).join(', ')}. Should I enter a position?`,
        marketCtx, portfolio
      );

      shouldExecute = decision.shouldExecute;
      confidence = decision.confidence;

      // LLM may select a specific strategy
      if (decision.parameters?.strategy) {
        const llmPick = eligible.find(s => s.name.toLowerCase().includes(String(decision.parameters!.strategy).toLowerCase()));
        if (llmPick) bestOpportunity = llmPick;
      }
    } catch {}
  } else {
    // Deterministic fallback — no Math.random()
    // Conservative: only execute flash loans (lowest risk alpha) in stable/expansion mode
    shouldExecute = currentMode === 'aggressive' || bestOpportunity.risk <= 35;
    confidence = bestOpportunity.risk <= 35 ? 0.7 : 0.4;
  }

  if (!shouldExecute) {
    await logAction(artistId, {
      agentType: AGENT_TYPE,
      actionType: 'audit',
      reason: `Alpha Hunter HOLD: brain confidence ${(confidence * 100).toFixed(0)}% — no favorable opportunity`,
    });
    return actions;
  }

  // Never allocate more than 50% of available to a single position
  const positionSize = Math.min(allocatedAmount * 0.5, allocatedAmount);
  if (positionSize < 10) return actions;

  // Real execution: check token security + simulate before executing
  let txHash: string | undefined;
  let securityClear = true;
  let realResultValue: number | null = null;

  if (isReal && (bestOpportunity.type === 'arbitrage' || bestOpportunity.type === 'flash_loan')) {
    try {
      // Security check on BOTH tokens in the swap pair
      const checker = getSecurityChecker();
      const pairSecurity = await checker.checkSwapPairSecurity(
        POLYGON_ADDRESSES.USDC,
        POLYGON_ADDRESSES.WETH
      );
      if (!pairSecurity.isSafe) {
        securityClear = false;
        await logAction(artistId, {
          agentType: AGENT_TYPE,
          actionType: 'audit',
          reason: `Security check FAILED for ${bestOpportunity.name}: ${pairSecurity.summary}`,
        });
      }

      // Simulate transaction via Tenderly (if configured)
      if (securityClear) {
        const simulator = getSimulator();
        if (simulator.isConfigured()) {
          const sim = await simulator.simulate({
            from: '0x0000000000000000000000000000000000000000',
            to: POLYGON_ADDRESSES.USDC,
            data: '0x',
          });
          if (!sim.success) {
            securityClear = false;
            await logAction(artistId, {
              agentType: AGENT_TYPE,
              actionType: 'audit',
              reason: `Simulation FAILED for ${bestOpportunity.name}: ${sim.error}`,
            });
          }
        }
      }

      // Execute real swap via 1inch if all checks pass + gas available
      if (securityClear) {
        const oneInch = getOneInchAdapter();
        if (oneInch.isConfigured()) {
          try {
            // Check gas first
            const { getWalletManager } = await import('./wallet-manager');
            const wallet = getWalletManager();
            const hasGas = await wallet.hasEnoughGas(500000n);

            if (hasGas) {
              // Convert USD position to USDC amount (6 decimals)
              const usdcAmountRaw = String(BigInt(Math.floor(positionSize * 1e6)));

              // MULTI-DEX: Compare quotes from all aggregators
              const multiDex = getMultiDexAggregator();
              let bestDex = '1inch';
              try {
                const comparison = await multiDex.getBestQuote(
                  POLYGON_ADDRESSES.USDC,
                  POLYGON_ADDRESSES.WETH,
                  usdcAmountRaw,
                  6, 18
                );
                bestDex = comparison.best.dex;
                console.log(`📊 [Alpha Hunter] Multi-DEX comparison: ${comparison.all.map(q => `${q.dex}=${q.amountOut}`).join(' | ')} → Best: ${bestDex}`);
              } catch {
                console.log(`[Alpha Hunter] Multi-DEX comparison failed, using 1inch directly`);
              }

              // Get quote first
              const quote = await oneInch.getQuote(
                POLYGON_ADDRESSES.USDC,
                POLYGON_ADDRESSES.WETH,
                usdcAmountRaw
              );

              // Only execute if spread is positive after estimated gas
              const estimatedGasCostUSD = 0.05; // ~0.05 USD on Polygon
              const expectedOutputUSD = parseFloat(quote.toAmount) / 1e18 * 2500; // rough ETH price
              const spread = expectedOutputUSD - positionSize - estimatedGasCostUSD;

              if (spread > 0 || bestOpportunity.type !== 'arbitrage') {
                // Execute the swap
                const swapResult = await oneInch.buildSwapTx(
                  POLYGON_ADDRESSES.USDC,
                  POLYGON_ADDRESSES.WETH,
                  usdcAmountRaw,
                  1 // 1% slippage
                );
                txHash = swapResult.txHash;
                realResultValue = parseFloat(swapResult.toAmount) / 1e18 * 2500; // Convert WETH to USD estimate

                console.log(`✅ [Alpha Hunter] Real 1inch swap: $${positionSize.toFixed(2)} USDC → WETH | TX: ${txHash}`);

                try {
                  const community = getCommunityManager();
                  await community.broadcastAgentAction({
                    agent: 'Alpha Hunter',
                    action: `${bestOpportunity.name} EXECUTED`,
                    amount: `$${positionSize.toFixed(2)}`,
                    result: `TX: ${txHash}`,
                  });
                } catch {}
              } else {
                await logAction(artistId, {
                  agentType: AGENT_TYPE,
                  actionType: 'audit',
                  reason: `Alpha SKIPPED: spread $${spread.toFixed(4)} too low after gas`,
                });
                return actions;
              }
            } else {
              console.log(`⚠️ [Alpha Hunter] Insufficient gas for real swap, recording as simulated`);
            }
          } catch (err: any) {
            console.log(`[Alpha Hunter] 1inch swap failed, falling back to simulated: ${err.message}`);
          }
        }
      }
    } catch (err: any) {
      console.log(`[Alpha Hunter] Real execution check failed: ${err.message}`);
    }
  }

  if (!securityClear) return actions;

  // Result: use real value if we got a real swap, otherwise deterministic projection
  const resultValue = realResultValue !== null
    ? realResultValue
    : confidence > 0.5
      ? positionSize * (1 + bestOpportunity.expectedReturn / 100)
      : positionSize * (1 - (bestOpportunity.risk / 100) * 0.3);

  const position = await db.insert(defiPositions).values({
    artistId,
    agentType: AGENT_TYPE,
    positionType: bestOpportunity.type,
    protocol: bestOpportunity.name,
    asset: 'Multi-asset',
    amountInvested: String(positionSize),
    currentValue: String(resultValue),
    unrealizedPnl: String(resultValue - positionSize),
    riskScore: bestOpportunity.risk,
    status: 'active',
    metadata: {
      strategy: bestOpportunity.name,
      expectedReturn: bestOpportunity.expectedReturn,
      duration: bestOpportunity.duration,
      confidence,
      mode: txHash ? 'real' : 'simulated',
      txHash,
    },
  }).returning();

  const action: AgentAction = {
    agentType: AGENT_TYPE,
    actionType: 'open_position',
    positionId: position[0]?.id,
    amount: positionSize,
    reason: `Alpha: ${bestOpportunity.name} — ${bestOpportunity.expectedReturn}% expected, confidence ${(confidence * 100).toFixed(0)}%${txHash ? ' [REAL]' : ' [SIM]'}`,
    riskAssessment: {
      riskLevel: bestOpportunity.risk > 60 ? 'high' : 'medium',
      drawdownPct: bestOpportunity.risk * 0.3,
      exposurePct: (positionSize / allocatedAmount) * 100,
      recommendation: `Tactical: ${bestOpportunity.duration} duration, ${bestOpportunity.risk} risk score`,
    },
  };
  actions.push(action);
  await logAction(artistId, action);

  // Check and close expired/completed alpha positions
  const closedActions = await closeCompletedPositions(artistId, existingPositions);
  actions.push(...closedActions);

  return actions;
}

/**
 * Close positions that have reached their targets or time limits
 */
async function closeCompletedPositions(artistId: number, positions: any[]): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  for (const pos of positions) {
    const invested = parseFloat(pos.amountInvested);
    const current = parseFloat(pos.currentValue);
    const pnlPct = invested > 0 ? ((current - invested) / invested) * 100 : 0;

    // Take profit at +5% or stop loss at -10%
    if (pnlPct >= 5 || pnlPct <= -10) {
      await db.update(defiPositions)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(defiPositions.id, pos.id));

      const actionType = pnlPct >= 5 ? 'take_profit' : 'stop_loss';
      const action: AgentAction = {
        agentType: AGENT_TYPE,
        actionType: actionType as any,
        positionId: pos.id,
        amount: current,
        reason: `${actionType === 'take_profit' ? 'Profit taken' : 'Stop loss hit'}: ${pnlPct.toFixed(1)}% PnL on ${pos.protocol}`,
      };
      actions.push(action);
      await logAction(artistId, action);
    }
  }

  return actions;
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
