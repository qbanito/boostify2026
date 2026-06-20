/**
 * CAPITAL KEEPER — Conservative Treasury Agent
 * Mandate: Preserve cash, maintain liquidity, calculate runway
 * Operates with 40% of DeFi allocation
 * 
 * REAL MODE: Uses Aave V3 on Polygon for lending positions
 * SIMULATED MODE: Falls back to DB-only tracking when wallet not configured
 */

import { db } from '../../db';
import { defiPositions, defiAgentActions, artistTreasuryVault } from '../../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { AgentAction, RiskAssessment } from './types';
import { isConfigured as blockchainReady } from './blockchain-provider';
import { getAaveAdapter } from './defi-adapters';
import { getAgentBrain, type PortfolioContext } from './agent-brain';
import { getCommunityManager } from './community-bots';

const AGENT_TYPE = 'capital_keeper' as const;

/**
 * Execute Capital Keeper's strategy for an artist
 * - Parks capital in stablecoins
 * - Opens conservative lending positions on Aave V3 (real) or simulated
 * - Maintains 24h liquidity guarantee
 * - Uses AgentBrain (LLM) for allocation decisions when available
 */
export async function executeCapitalKeeperCycle(
  artistId: number, allocatedAmount: number
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];
  
  if (allocatedAmount <= 0) return actions;

  const existingPositions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  const totalInvested = existingPositions.reduce((sum, p) => sum + parseFloat(p.amountInvested), 0);

  // Ask AgentBrain for allocation split if available
  let parkingPct = 0.60;
  let lendingPct = 0.40;

  const brain = getAgentBrain();
  if (brain.isConfigured()) {
    try {
      const portfolio: PortfolioContext = {
        totalValue: totalInvested + allocatedAmount,
        positions: existingPositions.map(p => ({
          protocol: p.protocol || '',
          asset: p.asset || '',
          value: parseFloat(p.currentValue),
          pnl: parseFloat(p.unrealizedPnl || '0'),
        })),
        availableCash: allocatedAmount,
      };
      const decision = await brain.decide(
        'capital_keeper',
        `New allocation of $${allocatedAmount.toFixed(2)}. Current positions: ${existingPositions.length}. Decide parking vs lending ratio.`,
        undefined, portfolio
      );
      if (decision.parameters?.parkingPct) parkingPct = decision.parameters.parkingPct;
      if (decision.parameters?.lendingPct) lendingPct = decision.parameters.lendingPct;
    } catch {}
  }

  const parkingAmount = allocatedAmount * parkingPct;
  const lendingAmount = allocatedAmount * lendingPct;

  // Park stablecoins (always DB-tracked, no on-chain action needed)
  if (parkingAmount > 10) {
    const parkingPosition = await db.insert(defiPositions).values({
      artistId,
      agentType: AGENT_TYPE,
      positionType: 'stablecoin_parking',
      protocol: 'USDC Vault',
      asset: 'USDC',
      amountInvested: String(parkingAmount),
      currentValue: String(parkingAmount),
      apy: '2.5000',
      riskScore: 5,
      status: 'active',
    }).returning();

    const action: AgentAction = {
      agentType: AGENT_TYPE,
      actionType: 'open_position',
      positionId: parkingPosition[0]?.id,
      amount: parkingAmount,
      reason: 'Stablecoin parking for 24h liquidity guarantee',
      riskAssessment: assessRisk(parkingAmount, totalInvested + parkingAmount),
    };
    actions.push(action);
    await logAction(artistId, action);
  }

  // Conservative lending — Aave V3 (real) or simulated
  if (lendingAmount > 10) {
    let realApy = '4.2000';
    let txHash: string | undefined;
    const isReal = blockchainReady();

    if (isReal) {
      try {
        const aave = getAaveAdapter();
        const apy = await aave.getSupplyAPY();
        realApy = apy.toFixed(4);

        // Execute real Aave V3 supply (convert USD amount to USDC 6-decimal bigint)
        const usdcAmount = BigInt(Math.floor(lendingAmount * 1e6));
        const result = await aave.supplyUSDC(usdcAmount);
        txHash = result.txHash;

        // Broadcast to community
        try {
          const community = getCommunityManager();
          await community.broadcastAgentAction({
            agent: 'Capital Keeper',
            action: 'Supplied USDC to Aave V3',
            amount: `$${lendingAmount.toFixed(2)}`,
            result: `APY: ${realApy}% | TX: ${txHash}`,
          });
        } catch {}
      } catch (err: any) {
        console.log(`[Capital Keeper] Aave real supply failed, falling back to simulated: ${err.message}`);
      }
    }

    const lendingPosition = await db.insert(defiPositions).values({
      artistId,
      agentType: AGENT_TYPE,
      positionType: 'lending',
      protocol: 'Aave V3',
      asset: 'USDC',
      amountInvested: String(lendingAmount),
      currentValue: String(lendingAmount),
      apy: realApy,
      riskScore: 15,
      status: 'active',
      metadata: txHash ? { txHash, mode: 'real' } : { mode: 'simulated' },
    }).returning();

    const action: AgentAction = {
      agentType: AGENT_TYPE,
      actionType: 'open_position',
      positionId: lendingPosition[0]?.id,
      amount: lendingAmount,
      reason: `Conservative lending on Aave V3 at ${realApy}% APY${txHash ? ' [REAL]' : ' [SIM]'}`,
      riskAssessment: assessRisk(lendingAmount, totalInvested + allocatedAmount),
    };
    actions.push(action);
    await logAction(artistId, action);
  }

  return actions;
}

/**
 * Compound existing positions (harvest + reinvest yields)
 * Uses real Aave V3 position data when blockchain is configured
 */
export async function harvestYields(artistId: number): Promise<number> {
  const positions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  let totalYield = 0;
  const isReal = blockchainReady();

  // If real mode, get actual Aave position value
  let realAaveValue: number | null = null;
  if (isReal) {
    try {
      const aave = getAaveAdapter();
      const position = await aave.getPosition();
      realAaveValue = parseFloat(position.deposited);
    } catch {}
  }

  for (const pos of positions) {
    const invested = parseFloat(pos.amountInvested);
    let newValue: number;

    if (isReal && pos.protocol === 'Aave V3' && realAaveValue !== null) {
      // Use real on-chain value
      newValue = realAaveValue;
      const dailyYield = newValue - parseFloat(pos.currentValue);
      totalYield += Math.max(0, dailyYield);
    } else {
      // Simulated yield
      const apy = parseFloat(pos.apy || '0');
      const dailyYield = (invested * apy) / (365 * 100);
      totalYield += dailyYield;
      newValue = parseFloat(pos.currentValue) + dailyYield;
    }

    await db.update(defiPositions)
      .set({ 
        currentValue: String(newValue),
        unrealizedPnl: String(newValue - invested),
      })
      .where(eq(defiPositions.id, pos.id));
  }

  if (totalYield > 0) {
    await logAction(artistId, {
      agentType: AGENT_TYPE,
      actionType: 'yield_harvest',
      amount: totalYield,
      reason: `Harvested $${totalYield.toFixed(2)} from ${positions.length} positions${isReal ? ' [REAL]' : ' [SIM]'}`,
    });
  }

  return totalYield;
}

/**
 * Calculate available liquidity (can be withdrawn in <24h)
 */
export async function getAvailableLiquidity(artistId: number): Promise<number> {
  const positions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active')
    ));

  return positions.reduce((sum, p) => sum + parseFloat(p.currentValue), 0);
}

function assessRisk(amount: number, totalExposure: number): RiskAssessment {
  return {
    riskLevel: 'low',
    drawdownPct: 0.5,
    exposurePct: totalExposure > 0 ? (amount / totalExposure) * 100 : 100,
    recommendation: 'Conservative stablecoin strategy — minimal risk',
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
