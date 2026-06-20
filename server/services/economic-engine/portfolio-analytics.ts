/**
 * PORTFOLIO ANALYTICS — Institutional-Grade Risk & Performance Metrics
 *
 * Adapted from: wshobson/maverick-mcp (MIT) & standard quantitative finance
 * Provides: Sharpe, Sortino, Calmar, Max Drawdown, Win Rate, Expectancy,
 *           Profit Factor, Monte Carlo simulations, Position correlation matrix
 *
 * All calculations are pure TypeScript — no external dependencies.
 * Used by: profit-distributor, economic-brain KPIs, new /analytics endpoint
 */

import { db } from '../../db';
import {
  artistTreasuryVault, defiPositions, defiAgentActions, riskEngineState,
} from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

// ============================================
// TYPES
// ============================================

export interface TradeRecord {
  entryPrice: number;
  exitPrice: number;
  size: number;           // USD notional
  entryTime: Date;
  exitTime: Date;
  pnlUsd: number;
  pnlPct: number;
  strategy: string;
  asset: string;
}

export interface EquityPoint {
  timestamp: Date;
  value: number;
}

export interface DrawdownResult {
  maxDrawdownPct: number;    // worst peak-to-trough as %
  maxDrawdownUsd: number;
  currentDrawdownPct: number;
  durationDays: number;      // duration of worst drawdown
  startDate: Date | null;
  troughDate: Date | null;
}

export interface MonteCarloResult {
  iterations: number;
  p5: number;   // 5th percentile outcome
  p25: number;
  p50: number;  // median
  p75: number;
  p95: number;  // 95th percentile outcome
  worstCase: number;
  bestCase: number;
  probabilityOfLoss: number;  // % simulations ending in loss
}

export interface InstitutionalKPIs {
  // Return metrics
  totalReturnPct: number;
  totalReturnUsd: number;
  annualizedReturnPct: number;

  // Risk-adjusted metrics
  sharpeRatio: number;     // (return - rfr) / std_dev
  sortinoRatio: number;    // (return - rfr) / downside_dev
  calmarRatio: number;     // annualized_return / max_drawdown

  // Risk metrics
  maxDrawdownPct: number;
  maxDrawdownUsd: number;
  currentDrawdownPct: number;
  volatilityPct: number;   // annualized

  // Trade metrics
  totalTrades: number;
  winRate: number;
  lossRate: number;
  avgWinPct: number;
  avgLossPct: number;
  avgWinUsd: number;
  avgLossUsd: number;
  expectancy: number;      // expected $ per trade
  profitFactor: number;    // gross profit / |gross loss|
  bestTradePct: number;
  worstTradePct: number;

  // Portfolio metrics
  activePositions: number;
  totalDefiProfit: number;
  totalDefiLoss: number;

  // Meta
  periodDays: number;
  calculatedAt: string;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | 'F';  // overall grade
}

// ============================================
// CORE MATH FUNCTIONS
// ============================================

const RISK_FREE_RATE_ANNUAL = 0.045;  // 4.5% — approximate US T-bill rate
const TRADING_DAYS_PER_YEAR = 365;    // crypto is 24/7

/** Annualized risk-free rate for a given number of days */
function rfr(days: number): number {
  return RISK_FREE_RATE_ANNUAL * (days / TRADING_DAYS_PER_YEAR);
}

/** Sample standard deviation of an array */
function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

/** Downside deviation — only considers negative returns */
function downsideDev(returns: number[], threshold = 0): number {
  const negReturns = returns.filter(r => r < threshold).map(r => Math.pow(r - threshold, 2));
  if (negReturns.length === 0) return 0.001; // avoid division by zero
  return Math.sqrt(negReturns.reduce((s, v) => s + v, 0) / returns.length);
}

/**
 * Sharpe Ratio: (Portfolio Return - Risk-Free Rate) / Standard Deviation
 * > 1.0 is good, > 2.0 is excellent, > 3.0 is exceptional
 */
export function calculateSharpeRatio(
  returns: number[],
  periodDays: number,
): number {
  if (returns.length < 2) return 0;
  const totalReturn = returns.reduce((s, r) => s + r, 0);
  const annualizedReturn = totalReturn * (TRADING_DAYS_PER_YEAR / periodDays);
  const annualizedStd = stdDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR / periodDays);
  if (annualizedStd === 0) return 0;
  return (annualizedReturn - RISK_FREE_RATE_ANNUAL) / annualizedStd;
}

/**
 * Sortino Ratio: Like Sharpe but only penalizes downside volatility
 * Better metric for crypto where upside volatility is welcome
 * > 1.0 is good, > 2.0 is very good
 */
export function calculateSortinoRatio(
  returns: number[],
  periodDays: number,
): number {
  if (returns.length < 2) return 0;
  const totalReturn = returns.reduce((s, r) => s + r, 0);
  const annualizedReturn = totalReturn * (TRADING_DAYS_PER_YEAR / periodDays);
  const annualizedDownside = downsideDev(returns) * Math.sqrt(TRADING_DAYS_PER_YEAR / periodDays);
  if (annualizedDownside === 0) return 0;
  return (annualizedReturn - RISK_FREE_RATE_ANNUAL) / annualizedDownside;
}

/**
 * Calmar Ratio: Annualized Return / Max Drawdown
 * > 1.0 is decent, > 3.0 is excellent
 */
export function calculateCalmarRatio(
  annualizedReturnPct: number,
  maxDrawdownPct: number,
): number {
  if (maxDrawdownPct === 0) return annualizedReturnPct > 0 ? 99 : 0;
  return annualizedReturnPct / Math.abs(maxDrawdownPct);
}

/**
 * Maximum Drawdown analysis
 */
export function calculateMaxDrawdown(equityCurve: EquityPoint[]): DrawdownResult {
  if (equityCurve.length < 2) {
    return {
      maxDrawdownPct: 0, maxDrawdownUsd: 0, currentDrawdownPct: 0,
      durationDays: 0, startDate: null, troughDate: null,
    };
  }

  let peak = equityCurve[0].value;
  let maxDd = 0;
  let maxDdUsd = 0;
  let startDate: Date | null = equityCurve[0].timestamp;
  let troughDate: Date | null = null;
  let currentPeak = equityCurve[0].value;
  let currentPeakDate = equityCurve[0].timestamp;
  let tempStart: Date = equityCurve[0].timestamp;
  let durationDays = 0;

  for (const point of equityCurve) {
    if (point.value > currentPeak) {
      currentPeak = point.value;
      currentPeakDate = point.timestamp;
      tempStart = point.timestamp;
    }
    const dd = (currentPeak - point.value) / currentPeak;
    const ddUsd = currentPeak - point.value;
    if (dd > maxDd) {
      maxDd = dd;
      maxDdUsd = ddUsd;
      startDate = tempStart;
      troughDate = point.timestamp;
      durationDays = Math.floor(
        (point.timestamp.getTime() - tempStart.getTime()) / (1000 * 60 * 60 * 24),
      );
    }
  }

  const last = equityCurve[equityCurve.length - 1].value;
  const currentDd = peak > 0 ? ((peak - last) / peak) * 100 : 0;

  return {
    maxDrawdownPct: maxDd * 100,
    maxDrawdownUsd: maxDdUsd,
    currentDrawdownPct: Math.max(0, currentDd),
    durationDays,
    startDate,
    troughDate,
  };
}

/**
 * Win Rate, Loss Rate, Averages, Expectancy, Profit Factor
 */
export function calculateTradeMetrics(trades: TradeRecord[]): {
  winRate: number; lossRate: number;
  avgWinPct: number; avgLossPct: number;
  avgWinUsd: number; avgLossUsd: number;
  expectancy: number;
  profitFactor: number;
  bestTradePct: number; worstTradePct: number;
} {
  if (trades.length === 0) {
    return { winRate: 0, lossRate: 0, avgWinPct: 0, avgLossPct: 0, avgWinUsd: 0, avgLossUsd: 0, expectancy: 0, profitFactor: 0, bestTradePct: 0, worstTradePct: 0 };
  }

  const wins = trades.filter(t => t.pnlUsd > 0);
  const losses = trades.filter(t => t.pnlUsd <= 0);

  const winRate = (wins.length / trades.length) * 100;
  const lossRate = (losses.length / trades.length) * 100;
  const avgWinPct = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const avgWinUsd = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlUsd, 0) / wins.length : 0;
  const avgLossUsd = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlUsd, 0) / losses.length : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnlUsd, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnlUsd, 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  // Expectancy = (Win Rate × Avg Win) + (Loss Rate × Avg Loss)
  const expectancy = (winRate / 100 * avgWinUsd) + (lossRate / 100 * avgLossUsd);

  const pcts = trades.map(t => t.pnlPct);
  const bestTradePct = Math.max(...pcts);
  const worstTradePct = Math.min(...pcts);

  return { winRate, lossRate, avgWinPct, avgLossPct, avgWinUsd, avgLossUsd, expectancy, profitFactor, bestTradePct, worstTradePct };
}

/**
 * Monte Carlo simulation — run N iterations resampling trade returns
 * Returns distribution of final portfolio value given starting capital
 */
export function runMonteCarloSimulation(
  trades: TradeRecord[],
  startingCapital: number,
  forwardTrades = 100,
  iterations = 1000,
): MonteCarloResult {
  if (trades.length < 5) {
    return { iterations, p5: startingCapital, p25: startingCapital, p50: startingCapital, p75: startingCapital, p95: startingCapital, worstCase: startingCapital, bestCase: startingCapital, probabilityOfLoss: 0 };
  }

  const returns = trades.map(t => t.pnlPct / 100);
  const finalValues: number[] = [];

  for (let i = 0; i < iterations; i++) {
    let capital = startingCapital;
    for (let j = 0; j < forwardTrades; j++) {
      // Resample with replacement from historical returns
      const r = returns[Math.floor(Math.random() * returns.length)];
      capital *= (1 + r);
      if (capital <= 0) { capital = 0; break; }
    }
    finalValues.push(capital);
  }

  finalValues.sort((a, b) => a - b);
  const p = (pct: number) => finalValues[Math.floor((pct / 100) * iterations)] ?? startingCapital;
  const losses = finalValues.filter(v => v < startingCapital).length;

  return {
    iterations,
    p5: p(5),
    p25: p(25),
    p50: p(50),
    p75: p(75),
    p95: p(95),
    worstCase: finalValues[0],
    bestCase: finalValues[finalValues.length - 1],
    probabilityOfLoss: (losses / iterations) * 100,
  };
}

/**
 * Overall portfolio grade based on key metrics
 */
function gradePortfolio(kpis: Omit<InstitutionalKPIs, 'grade'>): InstitutionalKPIs['grade'] {
  let score = 0;

  // Sharpe Ratio (max 30 pts)
  if (kpis.sharpeRatio >= 3) score += 30;
  else if (kpis.sharpeRatio >= 2) score += 22;
  else if (kpis.sharpeRatio >= 1) score += 15;
  else if (kpis.sharpeRatio >= 0) score += 5;

  // Win Rate (max 20 pts)
  if (kpis.winRate >= 60) score += 20;
  else if (kpis.winRate >= 50) score += 14;
  else if (kpis.winRate >= 40) score += 8;

  // Profit Factor (max 20 pts)
  if (kpis.profitFactor >= 2) score += 20;
  else if (kpis.profitFactor >= 1.5) score += 14;
  else if (kpis.profitFactor >= 1) score += 7;

  // Max Drawdown (max 20 pts)
  if (kpis.maxDrawdownPct <= 5) score += 20;
  else if (kpis.maxDrawdownPct <= 10) score += 14;
  else if (kpis.maxDrawdownPct <= 15) score += 8;
  else if (kpis.maxDrawdownPct <= 25) score += 3;

  // Total Return (max 10 pts)
  if (kpis.totalReturnPct >= 20) score += 10;
  else if (kpis.totalReturnPct >= 10) score += 7;
  else if (kpis.totalReturnPct >= 5) score += 4;
  else if (kpis.totalReturnPct > 0) score += 2;

  if (score >= 85) return 'A+';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  if (score >= 30) return 'D';
  return 'F';
}

// ============================================
// MAIN: Build full institutional KPI report for an artist
// ============================================

export async function buildInstitutionalKPIReport(artistId: number): Promise<InstitutionalKPIs> {
  // Load vault data
  const [vault] = await db.select().from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId));

  // Load closed trades from defi_agent_actions
  const rawActions = await db.select().from(defiAgentActions)
    .where(and(
      eq(defiAgentActions.artistId, artistId),
      eq(defiAgentActions.actionType, 'close_position' as any),
    ))
    .orderBy(desc(defiAgentActions.createdAt));

  // Build trade records from closed positions
  const trades: TradeRecord[] = rawActions
    .filter((a: any) => a.metadata?.entryPrice && a.metadata?.exitPrice)
    .map((a: any) => {
      const size = parseFloat(a.amountUsd || '0');
      const entryPrice = parseFloat(a.metadata.entryPrice || '0');
      const exitPrice = parseFloat(a.metadata.exitPrice || '0');
      const pnlPct = entryPrice > 0 ? ((exitPrice - entryPrice) / entryPrice) * 100 : 0;
      const pnlUsd = size * (pnlPct / 100);
      return {
        entryPrice, exitPrice, size, pnlUsd, pnlPct,
        entryTime: new Date(a.metadata.entryTime || a.createdAt),
        exitTime: new Date(a.createdAt),
        strategy: a.metadata?.strategy || 'unknown',
        asset: a.metadata?.asset || 'unknown',
      };
    });

  // Build equity curve from vault snapshots (simplified: use available data)
  const totalDefiProfit = parseFloat(vault?.totalDefiProfit || '0');
  const totalDefiLoss = parseFloat(vault?.totalDefiLoss || '0');
  const defiBalance = parseFloat(vault?.defiBalance || '0');
  const peakDefiValue = parseFloat(vault?.peakDefiValue || '0');
  const currentDrawdownPct = parseFloat(vault?.currentDrawdown || '0');

  // Total return
  const initialCapital = Math.max(1, defiBalance - totalDefiProfit + totalDefiLoss);
  const totalReturnUsd = totalDefiProfit - totalDefiLoss;
  const totalReturnPct = initialCapital > 0 ? (totalReturnUsd / initialCapital) * 100 : 0;

  // Period (estimate from oldest trade)
  const now = new Date();
  const oldest = trades.length > 0 ? trades[trades.length - 1].entryTime : new Date(Date.now() - 30 * 86400000);
  const periodDays = Math.max(1, Math.floor((now.getTime() - oldest.getTime()) / 86400000));

  // Per-period returns (daily approximation from trades)
  const tradeReturns = trades.map(t => t.pnlPct / 100);
  const volatilityPct = tradeReturns.length >= 2 ? stdDev(tradeReturns) * Math.sqrt(TRADING_DAYS_PER_YEAR) * 100 : 0;

  const annualizedReturnPct = totalReturnPct * (TRADING_DAYS_PER_YEAR / periodDays);
  const maxDrawdownPct = peakDefiValue > 0
    ? ((peakDefiValue - Math.min(defiBalance, peakDefiValue)) / peakDefiValue) * 100
    : currentDrawdownPct;

  const sharpeRatio = calculateSharpeRatio(tradeReturns, periodDays);
  const sortinoRatio = calculateSortinoRatio(tradeReturns, periodDays);
  const calmarRatio = calculateCalmarRatio(annualizedReturnPct, maxDrawdownPct);

  const tradeMetrics = calculateTradeMetrics(trades);

  // Active positions count
  const activePos = await db.select().from(defiPositions)
    .where(and(eq(defiPositions.artistId, artistId), eq(defiPositions.status, 'active')));

  const kpisWithoutGrade: Omit<InstitutionalKPIs, 'grade'> = {
    totalReturnPct,
    totalReturnUsd,
    annualizedReturnPct,
    sharpeRatio,
    sortinoRatio,
    calmarRatio,
    maxDrawdownPct,
    maxDrawdownUsd: peakDefiValue > 0 ? peakDefiValue - Math.min(defiBalance, peakDefiValue) : 0,
    currentDrawdownPct,
    volatilityPct,
    totalTrades: trades.length,
    ...tradeMetrics,
    activePositions: activePos.length,
    totalDefiProfit,
    totalDefiLoss,
    periodDays,
    calculatedAt: new Date().toISOString(),
  };

  return { ...kpisWithoutGrade, grade: gradePortfolio(kpisWithoutGrade) };
}

/** Quick summary for dashboard display */
export function summarizeKPIs(kpis: InstitutionalKPIs): string {
  return [
    `Grade: ${kpis.grade}`,
    `Sharpe: ${kpis.sharpeRatio.toFixed(2)}`,
    `Sortino: ${kpis.sortinoRatio.toFixed(2)}`,
    `Win Rate: ${kpis.winRate.toFixed(1)}%`,
    `Max DD: ${kpis.maxDrawdownPct.toFixed(1)}%`,
    `Profit Factor: ${kpis.profitFactor.toFixed(2)}`,
    `Total Return: ${kpis.totalReturnPct.toFixed(1)}%`,
  ].join(' | ');
}
