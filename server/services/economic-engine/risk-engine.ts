/**
 * RISK ENGINE — Mode determination & health scoring
 * Evaluates artist financial state and triggers mode transitions
 */

import { db } from '../../db';
import { 
  artistEconomicProfile, artistTreasuryVault, riskEngineState,
  defiPositions, economicEngineAuditLog, economicEngineConfig
} from '../../../db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { OperatingMode, RiskEvaluation, ModeTransition } from './types';
import { MODE_DISTRIBUTIONS } from './types';
import { getMacroRiskSignal } from './macro-intelligence';

/**
 * Evaluate an artist's financial health and determine operating mode
 */
export async function evaluateRisk(artistId: number): Promise<{
  mode: OperatingMode;
  evaluation: RiskEvaluation;
  transition?: ModeTransition;
}> {
  const [profile] = await db.select().from(artistEconomicProfile).where(eq(artistEconomicProfile.artistId, artistId));
  const [vault] = await db.select().from(artistTreasuryVault).where(eq(artistTreasuryVault.artistId, artistId));
  const [riskState] = await db.select().from(riskEngineState).where(eq(riskEngineState.artistId, artistId));

  if (!profile || !vault) {
    return { mode: 'stable', evaluation: getDefaultEvaluation() };
  }

  const monthlyCost = parseFloat(profile.monthlyOperatingCost || '0');
  const reserveBalance = parseFloat(vault.reserveBalance);
  const operationBalance = parseFloat(vault.operationBalance);
  const defiBalance = parseFloat(vault.defiBalance);
  const totalDefiProfit = parseFloat(vault.totalDefiProfit);
  const totalDefiLoss = parseFloat(vault.totalDefiLoss);
  const currentDrawdown = parseFloat(vault.currentDrawdown);
  const peakDefiValue = parseFloat(vault.peakDefiValue);

  // Calculate metrics
  const reserveMonths = monthlyCost > 0 ? reserveBalance / monthlyCost : 999;
  const incomeVsCosts = monthlyCost > 0 ? (operationBalance + reserveBalance) / monthlyCost : 999;
  const defiROI = defiBalance > 0 ? ((totalDefiProfit - totalDefiLoss) / defiBalance) * 100 : 0;

  const evaluation: RiskEvaluation = {
    incomeVsCosts,
    reserveAdequacy: reserveMonths >= 6 ? 'excess' : reserveMonths >= 3 ? 'strong' : 
                     reserveMonths >= 2 ? 'adequate' : reserveMonths >= 1 ? 'low' : 'critical',
    defiPerformance: defiROI,
    audienceGrowth: 0, // Will be connected to marketing metrics later
    marketCondition: 'neutral',
  };

  // Load global config for thresholds
  const [config] = await db.select().from(economicEngineConfig).limit(1);
  const maxDrawdown = parseFloat(config?.maxDrawdownPct || '15');

  // Enrich evaluation with real macro conditions (fails silently)
  const macroSignal = await getMacroRiskSignal().catch(() => null);
  if (macroSignal) {
    evaluation.marketCondition = macroSignal.riskLabel === 'low' ? 'bullish'
      : macroSignal.riskLabel === 'extreme' ? 'bear_extreme'
      : macroSignal.riskLabel === 'high' ? 'bearish'
      : macroSignal.marketRegime === 'bull' ? 'bullish'
      : macroSignal.marketRegime === 'bear' ? 'bearish' : 'neutral';
  }

  // Check Shield veto first
  if (riskState?.shieldVetoActive) {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'defense', evaluation, 
      'Shield Node veto active — forced defense mode', riskState);
  }

  // MACRO OVERRIDE: Extreme macro risk forces defense
  if (macroSignal && macroSignal.level >= 75 && currentDrawdown > 5) {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'defense', evaluation,
      `Macro risk ${macroSignal.level}/100 (${macroSignal.riskLabel}) + drawdown ${currentDrawdown.toFixed(1)}% — macro override to defense`, riskState);
  }
  if (macroSignal && macroSignal.vixLevel >= 35 && macroSignal.recommendedMode === 'defense') {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'defense', evaluation,
      `VIX extreme (${macroSignal.vixLevel.toFixed(1)}) + macro defense signal — override`, riskState);
  }

  // DEFENSE: drawdown exceeds limit
  if (currentDrawdown > maxDrawdown) {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'defense', evaluation,
      `Drawdown ${currentDrawdown.toFixed(1)}% exceeds limit ${maxDrawdown}%`, riskState);
  }

  // SURVIVAL: insufficient reserve or income
  if (evaluation.reserveAdequacy === 'critical' || evaluation.reserveAdequacy === 'low') {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'survival', evaluation,
      `Reserve inadequate: ${reserveMonths.toFixed(1)} months (need 3+)`, riskState);
  }

  // AGGRESSIVE: strong reserves and positive DeFi ROI
  const minReserveMonths = config?.minReserveMonths || 3;
  if (reserveMonths > minReserveMonths * 2 && defiROI > 0) {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'aggressive', evaluation,
      `Strong reserves (${reserveMonths.toFixed(1)}mo) + positive DeFi ROI (${defiROI.toFixed(1)}%)`, riskState);
  }

  // EXPANSION: good reserves and audience growing
  if (reserveMonths > minReserveMonths && evaluation.audienceGrowth > 10) {
    return maybeTransition(artistId, riskState?.currentMode || 'stable', 'expansion', evaluation,
      `Adequate reserves + audience growth ${evaluation.audienceGrowth}%`, riskState);
  }

  // STABLE: default
  return maybeTransition(artistId, riskState?.currentMode || 'stable', 'stable', evaluation,
    'Standard operating conditions', riskState);
}

async function maybeTransition(
  artistId: number, currentMode: OperatingMode, newMode: OperatingMode,
  evaluation: RiskEvaluation, reason: string, riskState: any
): Promise<{ mode: OperatingMode; evaluation: RiskEvaluation; transition?: ModeTransition }> {
  
  const transition = currentMode !== newMode ? { from: currentMode, to: newMode, reason, timestamp: new Date() } : undefined;

  // Upsert risk engine state
  await db.insert(riskEngineState).values({
    artistId,
    currentMode: newMode,
    previousMode: transition ? currentMode : riskState?.previousMode,
    modeChangedAt: transition ? new Date() : riskState?.modeChangedAt,
    modeChangeReason: transition ? reason : riskState?.modeChangeReason,
    healthScore: String(calculateHealthScore(evaluation)),
    reserveMonths: String(evaluation.incomeVsCosts),
    lastEvaluationAt: new Date(),
    evaluationData: evaluation,
  }).onConflictDoUpdate({
    target: riskEngineState.artistId,
    set: {
      currentMode: newMode,
      previousMode: transition ? currentMode : undefined,
      modeChangedAt: transition ? new Date() : undefined,
      modeChangeReason: transition ? reason : undefined,
      healthScore: String(calculateHealthScore(evaluation)),
      lastEvaluationAt: new Date(),
      evaluationData: evaluation,
      updatedAt: new Date(),
    }
  });

  // Log mode transitions
  if (transition) {
    await db.insert(economicEngineAuditLog).values({
      artistId,
      actorType: 'risk_engine',
      action: 'mode_changed',
      previousState: { mode: currentMode },
      newState: { mode: newMode },
      description: reason,
    });

    // Update profile operating mode
    await db.update(artistEconomicProfile)
      .set({ operatingMode: newMode })
      .where(eq(artistEconomicProfile.artistId, artistId));

    // Generate news for mode transition
    try {
      const { generateEngineModeChangeNews } = await import('../business-plan-engine-bridge');
      await generateEngineModeChangeNews(artistId, currentMode, newMode);
    } catch (newsErr) {
      console.error(`⚠️ [RiskEngine] Bridge news failed (non-critical):`, newsErr);
    }
  }

  return { mode: newMode, evaluation, transition };
}

function calculateHealthScore(evaluation: RiskEvaluation): number {
  let score = 50; // baseline
  
  // Income vs costs ratio
  if (evaluation.incomeVsCosts >= 2) score += 20;
  else if (evaluation.incomeVsCosts >= 1.5) score += 15;
  else if (evaluation.incomeVsCosts >= 1) score += 5;
  else score -= 20;

  // Reserve adequacy
  const reserveScores = { excess: 20, strong: 15, adequate: 5, low: -10, critical: -25 };
  score += reserveScores[evaluation.reserveAdequacy] || 0;

  // DeFi performance
  if (evaluation.defiPerformance > 10) score += 10;
  else if (evaluation.defiPerformance > 0) score += 5;
  else if (evaluation.defiPerformance < -10) score -= 15;

  return Math.max(0, Math.min(100, score));
}

function getDefaultEvaluation(): RiskEvaluation {
  return {
    incomeVsCosts: 1,
    reserveAdequacy: 'adequate',
    defiPerformance: 0,
    audienceGrowth: 0,
    marketCondition: 'neutral',
  };
}

/**
 * Get the current distribution matrix for an artist based on mode
 */
export function getDistributionForMode(mode: OperatingMode): typeof MODE_DISTRIBUTIONS[OperatingMode] {
  return MODE_DISTRIBUTIONS[mode];
}

/**
 * Admin override: force a specific operating mode
 */
export async function forceMode(artistId: number, newMode: OperatingMode, adminId: number, reason: string) {
  const [riskState] = await db.select().from(riskEngineState).where(eq(riskEngineState.artistId, artistId));
  const previousMode = riskState?.currentMode || 'stable';

  await db.insert(riskEngineState).values({
    artistId,
    currentMode: newMode,
    previousMode,
    modeChangedAt: new Date(),
    modeChangeReason: `Admin override: ${reason}`,
    lastEvaluationAt: new Date(),
  }).onConflictDoUpdate({
    target: riskEngineState.artistId,
    set: {
      currentMode: newMode,
      previousMode,
      modeChangedAt: new Date(),
      modeChangeReason: `Admin override: ${reason}`,
      updatedAt: new Date(),
    }
  });

  await db.update(artistEconomicProfile)
    .set({ operatingMode: newMode })
    .where(eq(artistEconomicProfile.artistId, artistId));

  await db.insert(economicEngineAuditLog).values({
    artistId,
    actorId: adminId,
    actorType: 'admin',
    action: 'risk_override',
    previousState: { mode: previousMode },
    newState: { mode: newMode },
    description: reason,
  });

  return { previousMode, newMode };
}
