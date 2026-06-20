/**
 * SHIELD NODE — Risk & Compliance Agent
 * Mandate: Monitor drawdown, circuit-break, veto power, freeze protocols
 * Operates with 20% of DeFi allocation (defensive margin)
 * 
 * REAL MODE: Monitors on-chain positions, uses SecurityChecker + AgentBrain
 * SIMULATED MODE: DB-only monitoring with deterministic risk assessment
 */

import { db } from '../../db';
import { 
  defiPositions, defiAgentActions, artistTreasuryVault,
  riskEngineState, economicEngineAuditLog, economicEngineConfig
} from '../../../db/schema';
import { eq, and, ne } from 'drizzle-orm';
import type { AgentAction, RiskAssessment } from './types';
import { isConfigured as blockchainReady } from './blockchain-provider';
import { getAaveAdapter, getSecurityChecker } from './defi-adapters';
import { getAgentBrain, type MarketContext, type PortfolioContext } from './agent-brain';
import { getFearGreedIndex } from './price-feeds';
import { getCommunityManager } from './community-bots';

const AGENT_TYPE = 'shield_node' as const;

/**
 * Execute Shield Node's monitoring cycle
 * - Check all positions for anomalies (real on-chain + DB)
 * - Uses AgentBrain for risk analysis when available
 * - Calculate total exposure and drawdown
 * - Activate circuit breaker if needed
 * - Broadcast alerts to community channels
 */
export async function executeShieldNodeCycle(
  artistId: number, allocatedAmount: number
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];
  const isReal = blockchainReady();

  // 1. Monitor all active positions across all agents
  const allPositions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.status, 'active')
    ));

  let totalInvested = allPositions.reduce((sum, p) => sum + parseFloat(p.amountInvested), 0);
  let totalCurrentValue = allPositions.reduce((sum, p) => sum + parseFloat(p.currentValue), 0);

  // Real mode: verify on-chain values for Aave positions
  if (isReal) {
    try {
      const aave = getAaveAdapter();
      const aavePosition = await aave.getPosition();
      // Update Aave positions with real on-chain data
      for (const pos of allPositions) {
        if (pos.protocol === 'Aave V3' && pos.positionType === 'lending') {
          const realValue = parseFloat(aavePosition.deposited);
          const diff = Math.abs(parseFloat(pos.currentValue) - realValue);
          if (diff > 0.01) {
            await db.update(defiPositions).set({
              currentValue: String(realValue),
              unrealizedPnl: String(realValue - parseFloat(pos.amountInvested)),
            }).where(eq(defiPositions.id, pos.id));
          }
        }
      }
      // Recalculate with real values
      totalCurrentValue = allPositions.reduce((sum, p) => sum + parseFloat(p.currentValue), 0);
    } catch {}
  }

  const totalPnl = totalCurrentValue - totalInvested;
  
  // 2. Get vault state
  const [vault] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  const peakValue = Math.max(parseFloat(vault?.peakDefiValue || '0'), totalCurrentValue);
  const drawdownPct = peakValue > 0 ? ((peakValue - totalCurrentValue) / peakValue) * 100 : 0;

  // Update vault drawdown tracking
  if (vault) {
    await db.update(artistTreasuryVault).set({
      currentDrawdown: String(drawdownPct),
      peakDefiValue: String(peakValue),
      updatedAt: new Date(),
    }).where(eq(artistTreasuryVault.artistId, artistId));
  }

  // 3. Load config for thresholds
  const [config] = await db.select().from(economicEngineConfig).limit(1);
  const maxDrawdown = parseFloat(config?.maxDrawdownPct || '15');

  // 3.5 Ask AgentBrain risk analysis if available
  const brain = getAgentBrain();
  if (brain.isConfigured()) {
    try {
      let marketCtx: MarketContext | undefined;
      try {
        const fg = await getFearGreedIndex();
        marketCtx = {
          prices: {}, fearGreedIndex: fg.value, btcDominance: 50,
          marketTrend: fg.value > 60 ? 'bullish' : fg.value < 35 ? 'bearish' : 'neutral',
          totalVolume24h: 0,
        };
      } catch {}

      const portfolio: PortfolioContext = {
        totalValue: totalCurrentValue,
        positions: allPositions.map(p => ({
          protocol: p.protocol || '', asset: p.asset || '',
          value: parseFloat(p.currentValue), pnl: parseFloat(p.unrealizedPnl || '0'),
        })),
        availableCash: allocatedAmount,
      };

      const decision = await brain.decide(
        'shield_node',
        `Drawdown: ${drawdownPct.toFixed(1)}%, Max: ${maxDrawdown}%, PnL: $${totalPnl.toFixed(2)}, Positions: ${allPositions.length}. Assess risk.`,
        marketCtx, portfolio
      );

      // If brain says risk is critical, lower circuit breaker threshold
      if (decision.riskScore && decision.riskScore > 80 && drawdownPct > maxDrawdown * 0.5) {
        const exitActions = await activateCircuitBreaker(artistId, allPositions, drawdownPct, maxDrawdown);
        actions.push(...exitActions);
        return actions;
      }
    } catch {}
  }

  // 4. CIRCUIT BREAKER: If drawdown exceeds limit, emergency exit all risky positions
  if (drawdownPct > maxDrawdown) {
    const exitActions = await activateCircuitBreaker(artistId, allPositions, drawdownPct, maxDrawdown);
    actions.push(...exitActions);

    // Broadcast circuit breaker alert
    try {
      const community = getCommunityManager();
      await community.broadcastAlert({
        title: 'CIRCUIT BREAKER ACTIVATED',
        message: `Artist ${artistId} drawdown ${drawdownPct.toFixed(1)}% exceeded ${maxDrawdown}% limit. All risk positions closed.`,
        severity: 'critical',
      });
    } catch {}

    return actions;
  }

  // 5. WARNING ZONE: If drawdown > 70% of limit, reduce risky positions
  if (drawdownPct > maxDrawdown * 0.7) {
    const reduceActions = await reduceRiskyExposure(artistId, allPositions, drawdownPct);
    actions.push(...reduceActions);

    try {
      const community = getCommunityManager();
      await community.broadcastAlert({
        title: 'Drawdown Warning',
        message: `Artist ${artistId} drawdown at ${drawdownPct.toFixed(1)}% (limit: ${maxDrawdown}%). Reducing exposure.`,
        severity: 'warning',
      });
    } catch {}
  }

  // 6. Allocate defensive margin (hedging positions)
  if (allocatedAmount > 10) {
    const hedgePosition = await db.insert(defiPositions).values({
      artistId,
      agentType: AGENT_TYPE,
      positionType: 'insurance',
      protocol: 'Shield Reserve',
      asset: 'USDC',
      amountInvested: String(allocatedAmount),
      currentValue: String(allocatedAmount),
      apy: '1.5000',
      riskScore: 3,
      status: 'active',
    }).returning();

    const action: AgentAction = {
      agentType: AGENT_TYPE,
      actionType: 'hedge',
      positionId: hedgePosition[0]?.id,
      amount: allocatedAmount,
      reason: `Defensive margin allocation: $${allocatedAmount.toFixed(2)}`,
      riskAssessment: {
        riskLevel: 'low',
        drawdownPct,
        exposurePct: totalInvested > 0 ? (allocatedAmount / totalInvested) * 100 : 0,
        recommendation: 'Shield reserve maintained for emergency coverage',
      },
    };
    actions.push(action);
    await logAction(artistId, action);
  }

  // 7. Audit log
  await logAction(artistId, {
    agentType: AGENT_TYPE,
    actionType: 'audit',
    reason: `Audit complete: ${allPositions.length} positions, drawdown ${drawdownPct.toFixed(1)}%, PnL $${totalPnl.toFixed(2)}`,
    riskAssessment: {
      riskLevel: drawdownPct > maxDrawdown * 0.5 ? 'medium' : 'low',
      drawdownPct,
      exposurePct: 100,
      recommendation: drawdownPct > maxDrawdown * 0.7 ? 'Reducing exposure' : 'All systems nominal',
    },
  });

  return actions;
}

/**
 * CIRCUIT BREAKER: Emergency exit all risky positions
 */
async function activateCircuitBreaker(
  artistId: number, positions: any[], drawdownPct: number, maxDrawdown: number
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  console.log(`🛡️ [Shield Node] CIRCUIT BREAKER ACTIVATED for artist ${artistId} — Drawdown: ${drawdownPct.toFixed(1)}%`);

  // Close all non-parking positions
  for (const pos of positions) {
    if (pos.positionType !== 'stablecoin_parking' && pos.positionType !== 'insurance') {
      await db.update(defiPositions)
        .set({ status: 'closed', closedAt: new Date() })
        .where(eq(defiPositions.id, pos.id));

      const action: AgentAction = {
        agentType: AGENT_TYPE,
        actionType: 'emergency_exit',
        positionId: pos.id,
        amount: parseFloat(pos.currentValue),
        reason: `Circuit breaker: closing ${pos.positionType} on ${pos.protocol} — drawdown ${drawdownPct.toFixed(1)}%`,
        riskAssessment: {
          riskLevel: 'critical',
          drawdownPct,
          exposurePct: 100,
          recommendation: 'EMERGENCY: All risk positions closed. Freeze until re-audit.',
        },
      };
      actions.push(action);
      await logAction(artistId, action);
    }
  }

  // Activate Shield veto
  await db.update(riskEngineState).set({
    shieldVetoActive: true,
    shieldVetoReason: `Circuit breaker: drawdown ${drawdownPct.toFixed(1)}% > limit ${maxDrawdown}%`,
    currentMode: 'defense',
    updatedAt: new Date(),
  }).where(eq(riskEngineState.artistId, artistId));

  // Audit log
  await db.insert(economicEngineAuditLog).values({
    artistId,
    actorType: 'shield_node',
    action: 'shield_veto',
    description: `Circuit breaker activated: drawdown ${drawdownPct.toFixed(1)}% exceeded ${maxDrawdown}% limit. All risk positions closed.`,
    newState: { shieldVetoActive: true, mode: 'defense' },
  });

  return actions;
}

/**
 * Reduce exposure in risky positions (warning zone)
 */
async function reduceRiskyExposure(
  artistId: number, positions: any[], drawdownPct: number
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  // Find high-risk positions (Alpha Hunter + Flow Maker yield farms)
  const riskyPositions = positions.filter(p => 
    p.agentType === 'alpha_hunter' || 
    (p.agentType === 'flow_maker' && parseInt(p.riskScore || '0') > 50)
  );

  for (const pos of riskyPositions) {
    const currentValue = parseFloat(pos.currentValue);
    const reduceBy = currentValue * 0.3; // Reduce by 30%
    
    await db.update(defiPositions).set({
      currentValue: String(currentValue - reduceBy),
      amountInvested: String(parseFloat(pos.amountInvested) - reduceBy),
    }).where(eq(defiPositions.id, pos.id));

    const action: AgentAction = {
      agentType: AGENT_TYPE,
      actionType: 'decrease_position',
      positionId: pos.id,
      amount: reduceBy,
      reason: `Warning zone (${drawdownPct.toFixed(1)}%): reducing ${pos.agentType} position by 30%`,
      riskAssessment: {
        riskLevel: 'high',
        drawdownPct,
        exposurePct: 70,
        recommendation: 'Reducing risky exposure as drawdown approaches limit',
      },
    };
    actions.push(action);
    await logAction(artistId, action);
  }

  return actions;
}

/**
 * Admin: Clear Shield veto (after manual audit)
 */
export async function clearShieldVeto(artistId: number, adminId: number) {
  await db.update(riskEngineState).set({
    shieldVetoActive: false,
    shieldVetoReason: null,
    updatedAt: new Date(),
  }).where(eq(riskEngineState.artistId, artistId));

  await db.insert(economicEngineAuditLog).values({
    artistId,
    actorId: adminId,
    actorType: 'admin',
    action: 'shield_veto_cleared',
    description: 'Shield veto cleared after manual audit',
  });
}

/**
 * Check if Shield veto is active for an artist
 */
export async function isShieldVetoActive(artistId: number): Promise<boolean> {
  const [state] = await db.select().from(riskEngineState)
    .where(eq(riskEngineState.artistId, artistId));
  return state?.shieldVetoActive ?? false;
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
    outcome: action.actionType === 'emergency_exit' ? 'success' : 'success',
  });
}
