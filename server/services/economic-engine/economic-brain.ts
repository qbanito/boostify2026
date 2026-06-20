/**
 * ECONOMIC BRAIN — The Orchestrator (CFO Autónomo)
 * Central coordinator: reads global state, dispatches to agents, manages cycles
 * Single bridge between artist commercial reality and DeFi execution
 */

import { db } from '../../db';
import { 
  artistEconomicProfile, artistTreasuryVault, economicEngineConfig,
  defiPositions, riskEngineState, economicEngineAuditLog, users
} from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { evaluateRisk, getDistributionForMode } from './risk-engine';
import { executeCapitalKeeperCycle, harvestYields } from './capital-keeper';
import { executeFlowMakerCycle, rebalancePositions } from './flow-maker';
import { executeAlphaHunterCycle } from './alpha-hunter';
import { executeShieldNodeCycle, isShieldVetoActive } from './shield-node';
import { executeMarketHunterCycle } from './market-hunter';
import { executeFundingArbCycle } from './funding-arb-agent';
import { processIncome, getVaultState, ensureVaultExists } from './revenue-router';
import { distributeProfits } from './profit-distributor';
import type { 
  CycleResult, EconomicKPIs, SimulationResult, 
  VaultBalances, DefiSplit, OperatingMode 
} from './types';
import { DEFAULT_DEFI_SPLIT, DEFAULT_DEFI_SPLIT_WITH_DAYTRADING } from './types';

/**
 * Run a complete economic cycle for a single artist
 * This is the main entry point called by the orchestrator tick
 */
export async function runEconomicCycle(artistId: number): Promise<CycleResult | null> {
  const [profile] = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId));

  if (!profile?.isEnabled) return null;

  console.log(`🧠 [EconomicBrain] Starting cycle for artist ${artistId}...`);

  // 1. Risk evaluation — determine operating mode
  const { mode, evaluation, transition } = await evaluateRisk(artistId);

  // 2. Ensure vault exists
  await ensureVaultExists(artistId);
  const vault = await getVaultState(artistId);
  if (!vault) return null;

  const defiBalance = parseFloat(vault.defiBalance);

  // 3. Get DeFi split (custom or default). When dayTrading is enabled, use
  //    the day-trading-aware default which carves out a slice for Market Hunter.
  const dayTrading = (profile as any).dayTradingEnabled === true;
  const cexTrading = (profile as any).cexTradingEnabled === true;
  const defiSplit = profile.defiSplit
    || (dayTrading ? DEFAULT_DEFI_SPLIT_WITH_DAYTRADING : DEFAULT_DEFI_SPLIT);

  // 4. Calculate DeFi allocations per agent
  const allocations = {
    capital_keeper: (defiBalance * defiSplit.capitalKeeper) / 100,
    flow_maker:    (defiBalance * defiSplit.flowMaker) / 100,
    alpha_hunter:  (defiBalance * defiSplit.alphaHunter) / 100,
    shield_node:   (defiBalance * defiSplit.shieldNode) / 100,
    market_hunter: dayTrading ? (defiBalance * (defiSplit.marketHunter || 0)) / 100 : 0,
  };

  // 5. Execute agent cycles (in priority order)
  const allActions = [];

  // Shield Node first (it can block everything)
  const shieldActions = await executeShieldNodeCycle(artistId, allocations.shield_node);
  allActions.push(...shieldActions);

  // If Shield veto activated during this cycle, stop other agents
  const vetoActive = await isShieldVetoActive(artistId);
  
  if (!vetoActive) {
    // Capital Keeper (conservative, always runs)
    const keeperActions = await executeCapitalKeeperCycle(artistId, allocations.capital_keeper);
    allActions.push(...keeperActions);

    // Flow Maker (yield farming)
    if (profile.defiEnabled) {
      const flowActions = await executeFlowMakerCycle(artistId, allocations.flow_maker, profile.riskTolerance);
      allActions.push(...flowActions);
    }

    // Alpha Hunter (tactical — may be frozen by mode)
    if (profile.defiEnabled) {
      const alphaActions = await executeAlphaHunterCycle(artistId, allocations.alpha_hunter, mode);
      allActions.push(...alphaActions);
    }

    // Market Hunter (day trading — opt-in via dayTradingEnabled, frozen by mode)
    if (dayTrading && allocations.market_hunter > 0) {
      const marketActions = await executeMarketHunterCycle(artistId, allocations.market_hunter, mode);
      allActions.push(...marketActions);
    }

    // CEX Funding Rate Arbitrage — opt-in via cexTradingEnabled, requires artist API keys
    // Uses 20% of defiBalance by default; agent enforces its own risk caps.
    if (cexTrading && mode !== 'emergency') {
      try {
        const cexAllocation = defiBalance * 0.20;
        const arbResult = await executeFundingArbCycle(artistId, cexAllocation);
        if (arbResult.actionsLog?.length) {
          allActions.push(...arbResult.actionsLog.map((msg: string) => ({
            agentType: 'funding_arb' as any,
            action: 'funding_arb_cycle',
            description: msg,
            amountUsdc: 0,
            success: true,
          })));
        }
      } catch (cexError) {
        console.error(`⚠️ [EconomicBrain] CEX arb cycle failed for artist ${artistId} (non-critical):`, cexError);
      }
    }

    // Harvest yields from Capital Keeper
    await harvestYields(artistId);

    // Rebalance Flow Maker positions
    const rebalanceActions = await rebalancePositions(artistId);
    allActions.push(...rebalanceActions);
  }

  // 6. Calculate KPIs
  const kpis = await calculateKPIs(artistId);

  // 7. Distribute profits if any
  const totalProfit = parseFloat(vault.totalDefiProfit);
  const totalLoss = parseFloat(vault.totalDefiLoss);
  // Cascade threshold: any net profit > $0.01 triggers a distribution.
  // Previous threshold of $10 meant simulated/small yields never reached the
  // operationBalance the dashboard shows, so users saw a frozen number.
  const CASCADE_THRESHOLD = parseFloat(process.env.ECONOMIC_ENGINE_CASCADE_THRESHOLD || '0.01');
  if (totalProfit > totalLoss + CASCADE_THRESHOLD) {
    await distributeProfits(artistId, totalProfit - totalLoss);
  }

  // 8. Update last cycle timestamp
  await db.update(artistEconomicProfile)
    .set({ lastCycleAt: new Date() })
    .where(eq(artistEconomicProfile.artistId, artistId));

  const result: CycleResult = {
    artistId,
    mode,
    incomeProcessed: 0,
    distribution: {
      operation: parseFloat(vault.operationBalance),
      reserve: parseFloat(vault.reserveBalance),
      growth: parseFloat(vault.growthBalance),
      defi: defiBalance,
      boostifyFee: parseFloat(vault.boostifyFeeBalance),
    },
    defiAllocations: allocations,
    agentActions: allActions,
    modeTransition: transition,
    kpis,
    timestamp: new Date(),
  };

  console.log(`🧠 [EconomicBrain] Cycle complete for artist ${artistId}: mode=${mode}, actions=${allActions.length}, health=${kpis.operatingCoverage.toFixed(1)}x`);

  // 9. Sync to business plan & update dynamic roadmap
  try {
    const { syncEngineToBusinessPlan, updateDynamicRoadmap } = await import('../business-plan-engine-bridge');
    await syncEngineToBusinessPlan(artistId);
    await updateDynamicRoadmap(artistId);
  } catch (bridgeError) {
    console.error(`⚠️ [EconomicBrain] Bridge sync failed (non-critical):`, bridgeError);
  }

  return result;
}

/**
 * Run economic cycles for ALL enabled artists
 * Called by the orchestrator tick
 */
export async function processEconomicEngineTick(): Promise<void> {
  // Check global toggle
  const [config] = await db.select().from(economicEngineConfig).limit(1);
  if (!config?.isGloballyEnabled) return;

  // Get all enabled artists
  const enabledProfiles = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.isEnabled, true));

  console.log(`🧠 [EconomicBrain] Processing tick for ${enabledProfiles.length} artists...`);

  for (const profile of enabledProfiles) {
    try {
      await runEconomicCycle(profile.artistId);
    } catch (error) {
      console.error(`❌ [EconomicBrain] Error in cycle for artist ${profile.artistId}:`, error);
    }
  }
}

/**
 * Calculate KPIs for an artist
 */
export async function calculateKPIs(artistId: number): Promise<EconomicKPIs> {
  const vault = await getVaultState(artistId);
  const [profile] = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId));

  if (!vault || !profile) {
    return { operatingCoverage: 0, treasuryRatio: 0, defiROI: 0, maxDrawdown: 0, reserveMonths: 0, totalVaultValue: 0, netDefiPnl: 0 };
  }

  const opBalance = parseFloat(vault.operationBalance);
  const reserveBalance = parseFloat(vault.reserveBalance);
  const growthBalance = parseFloat(vault.growthBalance);
  const defiBalance = parseFloat(vault.defiBalance);
  const feeBalance = parseFloat(vault.boostifyFeeBalance);
  const totalVaultValue = opBalance + reserveBalance + growthBalance + defiBalance + feeBalance;

  const monthlyCost = parseFloat(profile.monthlyOperatingCost || '0');
  const totalProfit = parseFloat(vault.totalDefiProfit);
  const totalLoss = parseFloat(vault.totalDefiLoss);
  const netDefiPnl = totalProfit - totalLoss;

  return {
    operatingCoverage: monthlyCost > 0 ? (opBalance + reserveBalance) / monthlyCost : 999,
    treasuryRatio: reserveBalance > 0 ? (defiBalance + growthBalance) / reserveBalance : 0,
    defiROI: defiBalance > 0 ? (netDefiPnl / defiBalance) * 100 : 0,
    maxDrawdown: parseFloat(vault.currentDrawdown),
    reserveMonths: monthlyCost > 0 ? reserveBalance / monthlyCost : 999,
    totalVaultValue,
    netDefiPnl,
  };
}

/**
 * Simulate a distribution without executing it
 */
export async function simulateDistribution(
  artistId: number, inputAmount: number
): Promise<SimulationResult> {
  const [profile] = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId));

  const mode = profile?.operatingMode || 'stable';
  const matrix = profile?.distributionMatrix || getDistributionForMode(mode as OperatingMode);
  const defiSplit = profile?.defiSplit || DEFAULT_DEFI_SPLIT;

  const distribution: VaultBalances = {
    operation: (inputAmount * matrix.operation) / 100,
    reserve: (inputAmount * matrix.reserve) / 100,
    growth: (inputAmount * matrix.growth) / 100,
    defi: (inputAmount * matrix.defi) / 100,
    boostifyFee: (inputAmount * matrix.boostifyFee) / 100,
  };

  const defiAllocations = {
    capital_keeper: (distribution.defi * defiSplit.capitalKeeper) / 100,
    flow_maker: (distribution.defi * defiSplit.flowMaker) / 100,
    alpha_hunter: (distribution.defi * defiSplit.alphaHunter) / 100,
    shield_node: (distribution.defi * defiSplit.shieldNode) / 100,
  };

  // Estimate yields (weighted average APY)
  const estimatedAPY = 
    (defiAllocations.capital_keeper * 3.5 + 
     defiAllocations.flow_maker * 6.5 + 
     defiAllocations.alpha_hunter * 8.0 + 
     defiAllocations.shield_node * 1.5) / distribution.defi || 0;

  return {
    inputAmount,
    mode: mode as OperatingMode,
    distribution,
    defiAllocations,
    projectedMonthlyYield: (distribution.defi * estimatedAPY) / (12 * 100),
    projectedAnnualROI: estimatedAPY,
  };
}

/**
 * Get comprehensive engine status for an artist
 */
export async function getEngineStatus(artistId: number) {
  const [profile] = await db.select().from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId));
  const vault = await getVaultState(artistId);
  const [riskState] = await db.select().from(riskEngineState)
    .where(eq(riskEngineState.artistId, artistId));
  
  const positions = await db.select().from(defiPositions)
    .where(and(eq(defiPositions.artistId, artistId), eq(defiPositions.status, 'active')));
  
  const kpis = await calculateKPIs(artistId);

  return {
    profile,
    vault,
    riskState,
    activePositions: positions,
    kpis,
    isEnabled: profile?.isEnabled ?? false,
    currentMode: riskState?.currentMode || profile?.operatingMode || 'stable',
    shieldVetoActive: riskState?.shieldVetoActive ?? false,
  };
}
