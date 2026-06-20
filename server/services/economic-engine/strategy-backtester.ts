/**
 * STRATEGY BACKTESTER — Historical Strategy Validation Engine
 *
 * Inspired by: Trade-With-Claude/cbt-framework walk-forward methodology
 *              wshobson/maverick-mcp VectorBT backtesting approach
 *
 * Uses: CoinGecko free historical data (no key required)
 * Implements: 6 strategies, walk-forward optimization, param grid search
 *
 * Used by: /backtest endpoint, /optimize endpoint, validateMarketHunterParams()
 */

import { calculateRSI, calculateMACD, calculateBollingerBands, calculateEMACross } from './technical-analysis';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// ============================================
// TYPES
// ============================================

export type StrategyType =
  | 'momentum'
  | 'mean_reversion'
  | 'rsi'
  | 'macd'
  | 'bollinger'
  | 'ema_cross';

export interface BacktestConfig {
  coingeckoId: string;
  symbol: string;
  strategy: StrategyType;
  periodDays: 30 | 60 | 90 | 180 | 365;
  stopLossPct: number;   // e.g. 0.03 = 3%
  takeProfitPct: number; // e.g. 0.05 = 5%
  allocationUsd: number;
  // Strategy-specific params (optional)
  rsiOversold?: number;
  rsiOverbought?: number;
  bbPeriod?: number;
  emaFast?: number;
  emaSlow?: number;
}

export interface BacktestTrade {
  entryIndex: number;
  exitIndex: number;
  entryPrice: number;
  exitPrice: number;
  pnlPct: number;
  pnlUsd: number;
  holdBars: number;
  exitReason: 'take_profit' | 'stop_loss' | 'signal' | 'end_of_data';
}

export interface BacktestResult {
  strategy: StrategyType;
  coingeckoId: string;
  symbol: string;
  periodDays: number;
  startDate: string;
  endDate: string;
  // Returns
  totalReturnPct: number;
  buyAndHoldReturnPct: number;
  alpha: number;  // totalReturn - buyAndHold
  // Risk
  sharpeRatio: number;
  maxDrawdownPct: number;
  // Trade stats
  totalTrades: number;
  winRate: number;
  profitFactor: number;
  avgWinPct: number;
  avgLossPct: number;
  // Equity curve
  equityCurve: number[];
  trades: BacktestTrade[];
  // Validation
  isStatisticallySignificant: boolean;  // >= 30 trades
  overfitWarning: boolean;
}

export interface StrategyComparison {
  strategy: StrategyType;
  sharpeRatio: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRate: number;
  totalTrades: number;
  score: number;  // composite ranking score
}

export interface OptimizeConfig {
  coingeckoId: string;
  symbol: string;
  strategy: StrategyType;
  periodDays: 180 | 365;
  inSamplePct?: number;  // default 0.7 (70% in-sample, 30% out-of-sample)
}

export interface OptimizationResult {
  strategy: StrategyType;
  bestParams: Record<string, number>;
  inSampleSharpe: number;
  outOfSampleSharpe: number;
  overfitRatio: number;     // OOS/IS Sharpe — < 0.5 suggests overfitting
  recommendedParams: Record<string, number>;
  isReliable: boolean;      // OOS Sharpe > 0.5 AND overfitRatio > 0.5
  comparisons: Array<{ params: Record<string, number>; isSharpe: number; oosSharpe: number }>;
}

export interface ValidationReport {
  artistId: number;
  currentParams: { stopLossPct: number; takeProfitPct: number };
  validationResults: BacktestResult[];
  recommendations: string[];
  isApproved: boolean;
  confidenceScore: number;
}

// ============================================
// HISTORICAL DATA
// ============================================

async function fetchDailyPrices(
  coingeckoId: string,
  days: number,
): Promise<{ prices: number[]; timestamps: number[] }> {
  const url = `${COINGECKO_BASE}/coins/${coingeckoId}/market_chart?vs_currency=usd&days=${days}&interval=daily`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10000),
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko market_chart ${coingeckoId}: ${res.status}`);

  const raw = await res.json() as { prices: [number, number][] };
  const prices = raw.prices.map(([, p]) => p);
  const timestamps = raw.prices.map(([t]) => t);
  return { prices, timestamps };
}

// ============================================
// SIGNAL GENERATORS (per strategy)
// ============================================

/** Generate entry (true) / hold (false) signals for each bar */
function generateSignals(prices: number[], strategy: StrategyType, config: BacktestConfig): boolean[] {
  const signals: boolean[] = new Array(prices.length).fill(false);
  const rsiOversold = config.rsiOversold ?? 30;
  const rsiOverbought = config.rsiOverbought ?? 70;

  switch (strategy) {
    case 'rsi': {
      for (let i = 20; i < prices.length; i++) {
        const rsi = calculateRSI(prices.slice(0, i + 1), 14);
        signals[i] = rsi.signal === 'oversold';
      }
      break;
    }
    case 'macd': {
      for (let i = 35; i < prices.length; i++) {
        const macd = calculateMACD(prices.slice(0, i + 1), 12, 26, 9);
        signals[i] = macd.cross === 'golden';
      }
      break;
    }
    case 'bollinger': {
      for (let i = 20; i < prices.length; i++) {
        const bb = calculateBollingerBands(prices.slice(0, i + 1), config.bbPeriod ?? 20, 2);
        signals[i] = bb.position === 'below_lower';
      }
      break;
    }
    case 'ema_cross': {
      for (let i = 55; i < prices.length; i++) {
        const ema = calculateEMACross(prices.slice(0, i + 1));
        signals[i] = ema.cross === 'golden';
      }
      break;
    }
    case 'momentum': {
      // Momentum: price > 10-day EMA AND RSI > 50
      for (let i = 20; i < prices.length; i++) {
        const slice = prices.slice(0, i + 1);
        const ema10 = slice.slice(-10).reduce((s, v) => s + v, 0) / 10;
        const rsi = calculateRSI(slice, 14);
        signals[i] = prices[i] > ema10 && rsi.value > 50 && rsi.value < 70;
      }
      break;
    }
    case 'mean_reversion': {
      // Mean reversion: RSI oversold OR price at/below BB lower band
      for (let i = 20; i < prices.length; i++) {
        const slice = prices.slice(0, i + 1);
        const rsi = calculateRSI(slice, 14);
        const bb = calculateBollingerBands(slice, 20, 2);
        signals[i] = rsi.value <= rsiOversold || bb.position === 'below_lower';
      }
      break;
    }
  }

  return signals;
}

// ============================================
// CORE BACKTEST ENGINE
// ============================================

function runBacktestEngine(
  prices: number[],
  timestamps: number[],
  signals: boolean[],
  config: BacktestConfig,
): { trades: BacktestTrade[]; equityCurve: number[] } {
  const trades: BacktestTrade[] = [];
  const equity = config.allocationUsd;
  const equityCurve: number[] = new Array(prices.length).fill(equity);

  let capital = equity;
  let inPosition = false;
  let entryIndex = 0;
  let entryPrice = 0;

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i];

    if (!inPosition && signals[i]) {
      // Enter long position
      inPosition = true;
      entryIndex = i;
      entryPrice = price;
    } else if (inPosition) {
      // Check exit conditions
      const pnlPct = (price - entryPrice) / entryPrice;
      let exitReason: BacktestTrade['exitReason'] | null = null;

      if (pnlPct >= config.takeProfitPct) exitReason = 'take_profit';
      else if (pnlPct <= -config.stopLossPct) exitReason = 'stop_loss';
      else if (i === prices.length - 1) exitReason = 'end_of_data';

      if (exitReason) {
        const pnlUsd = capital * pnlPct;
        capital += pnlUsd;
        trades.push({
          entryIndex,
          exitIndex: i,
          entryPrice,
          exitPrice: price,
          pnlPct: pnlPct * 100,
          pnlUsd,
          holdBars: i - entryIndex,
          exitReason,
        });
        inPosition = false;
      }
    }

    equityCurve[i] = capital;
  }

  return { trades, equityCurve };
}

// ============================================
// STATISTICAL ANALYSIS
// ============================================

function computeBacktestStats(
  trades: BacktestTrade[],
  equityCurve: number[],
  startCapital: number,
  periodDays: number,
): Pick<BacktestResult, 'totalReturnPct' | 'sharpeRatio' | 'maxDrawdownPct' | 'winRate' | 'profitFactor' | 'avgWinPct' | 'avgLossPct'> {
  const finalCapital = equityCurve[equityCurve.length - 1];
  const totalReturnPct = ((finalCapital - startCapital) / startCapital) * 100;

  const wins = trades.filter(t => t.pnlPct > 0);
  const losses = trades.filter(t => t.pnlPct <= 0);
  const winRate = trades.length > 0 ? (wins.length / trades.length) * 100 : 0;
  const avgWinPct = wins.length > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0) / wins.length : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;

  const grossProfit = wins.reduce((s, t) => s + Math.abs(t.pnlUsd), 0);
  const grossLoss = losses.reduce((s, t) => s + Math.abs(t.pnlUsd), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;

  // Max drawdown from equity curve
  let peak = equityCurve[0];
  let maxDd = 0;
  for (const val of equityCurve) {
    if (val > peak) peak = val;
    const dd = (peak - val) / peak * 100;
    if (dd > maxDd) maxDd = dd;
  }

  // Sharpe (using daily trade returns)
  const dailyReturns = trades.map(t => t.pnlPct / 100);
  const avgReturn = dailyReturns.length > 0 ? dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length : 0;
  const annualizedReturn = avgReturn * (365 / periodDays);
  const returnStd = dailyReturns.length >= 2
    ? Math.sqrt(dailyReturns.reduce((s, v) => s + Math.pow(v - avgReturn, 2), 0) / (dailyReturns.length - 1)) * Math.sqrt(365 / periodDays)
    : 0.1;
  const sharpeRatio = returnStd > 0 ? (annualizedReturn - 0.045) / returnStd : 0;

  return { totalReturnPct, sharpeRatio, maxDrawdownPct: maxDd, winRate, profitFactor, avgWinPct, avgLossPct };
}

// ============================================
// PUBLIC API
// ============================================

/** Run a full backtest for a given config */
export async function backtestStrategy(config: BacktestConfig): Promise<BacktestResult> {
  const { prices, timestamps } = await fetchDailyPrices(config.coingeckoId, config.periodDays);
  const signals = generateSignals(prices, config.strategy, config);
  const { trades, equityCurve } = runBacktestEngine(prices, timestamps, signals, config);

  const startPrice = prices[0];
  const endPrice = prices[prices.length - 1];
  const buyAndHoldReturnPct = ((endPrice - startPrice) / startPrice) * 100;

  const stats = computeBacktestStats(trades, equityCurve, config.allocationUsd, config.periodDays);

  return {
    strategy: config.strategy,
    coingeckoId: config.coingeckoId,
    symbol: config.symbol,
    periodDays: config.periodDays,
    startDate: new Date(timestamps[0]).toISOString(),
    endDate: new Date(timestamps[timestamps.length - 1]).toISOString(),
    ...stats,
    buyAndHoldReturnPct,
    alpha: stats.totalReturnPct - buyAndHoldReturnPct,
    totalTrades: trades.length,
    equityCurve: equityCurve.map(v => Math.round(v * 100) / 100),
    trades: trades.slice(0, 100),  // cap for response size
    isStatisticallySignificant: trades.length >= 30,
    overfitWarning: trades.length < 10,
  };
}

/** Compare all 6 strategies on the same asset, ranked by composite score */
export async function compareStrategies(
  coingeckoId: string,
  symbol: string,
  periodDays: 90 | 180 | 365 = 180,
  allocationUsd = 1000,
): Promise<StrategyComparison[]> {
  const strategies: StrategyType[] = ['momentum', 'mean_reversion', 'rsi', 'macd', 'bollinger', 'ema_cross'];
  const defaultConfig: Omit<BacktestConfig, 'strategy'> = {
    coingeckoId, symbol, periodDays, stopLossPct: 0.03, takeProfitPct: 0.05, allocationUsd,
  };

  const results = await Promise.allSettled(
    strategies.map(s => backtestStrategy({ ...defaultConfig, strategy: s })),
  );

  const comparisons: StrategyComparison[] = [];
  for (let i = 0; i < strategies.length; i++) {
    const r = results[i];
    if (r.status !== 'fulfilled') continue;
    const res = r.value;

    // Composite score: Sharpe (40%) + WinRate (20%) + ProfitFactor (20%) + DrawdownPenalty (20%)
    const ddPenalty = Math.max(0, 1 - res.maxDrawdownPct / 50);
    const pfNorm = Math.min(1, res.profitFactor / 3);
    const score = (
      Math.min(1, Math.max(0, (res.sharpeRatio + 1) / 4)) * 40 +
      (res.winRate / 100) * 20 +
      pfNorm * 20 +
      ddPenalty * 20
    );

    comparisons.push({
      strategy: res.strategy,
      sharpeRatio: res.sharpeRatio,
      totalReturnPct: res.totalReturnPct,
      maxDrawdownPct: res.maxDrawdownPct,
      winRate: res.winRate,
      totalTrades: res.totalTrades,
      score: Math.round(score),
    });
  }

  return comparisons.sort((a, b) => b.score - a.score);
}

/** Walk-forward optimization — detect overfitting */
export async function walkForwardOptimize(config: OptimizeConfig): Promise<OptimizationResult> {
  const { prices, timestamps } = await fetchDailyPrices(config.coingeckoId, config.periodDays);
  const splitPct = config.inSamplePct ?? 0.7;
  const splitIdx = Math.floor(prices.length * splitPct);

  const isSample = prices.slice(0, splitIdx);
  const oosSample = prices.slice(splitIdx);
  const oosTimes = timestamps.slice(splitIdx);

  // Parameter grid for the given strategy
  const paramGrid: Array<Record<string, number>> = buildParamGrid(config.strategy);

  const comparisons: OptimizationResult['comparisons'] = [];
  let bestParams: Record<string, number> = paramGrid[0];
  let bestIsSharpe = -Infinity;

  for (const params of paramGrid) {
    const isConfig = buildConfigFromParams(config, params, isSample.length);
    const isSignals = generateSignals(isSample, config.strategy, isConfig);
    const { trades: isTrades, equityCurve: isEq } = runBacktestEngine(isSample, [], isSignals, isConfig);
    const isStats = computeBacktestStats(isTrades, isEq, isConfig.allocationUsd, isConfig.periodDays);

    const oosConfig = buildConfigFromParams(config, params, oosSample.length);
    const oosSignals = generateSignals(oosSample, config.strategy, oosConfig);
    const { trades: oosTrades, equityCurve: oosEq } = runBacktestEngine(oosSample, oosTimes, oosSignals, oosConfig);
    const oosStats = computeBacktestStats(oosTrades, oosEq, oosConfig.allocationUsd, oosConfig.periodDays);

    comparisons.push({ params, isSharpe: isStats.sharpeRatio, oosSharpe: oosStats.sharpeRatio });

    if (isStats.sharpeRatio > bestIsSharpe) {
      bestIsSharpe = isStats.sharpeRatio;
      bestParams = params;
    }
  }

  const bestComparison = comparisons.find(
    c => JSON.stringify(c.params) === JSON.stringify(bestParams),
  )!;

  const overfitRatio = bestIsSharpe > 0
    ? bestComparison.oosSharpe / bestIsSharpe
    : 0;

  return {
    strategy: config.strategy,
    bestParams,
    inSampleSharpe: bestComparison.isSharpe,
    outOfSampleSharpe: bestComparison.oosSharpe,
    overfitRatio,
    recommendedParams: overfitRatio > 0.5 ? bestParams : paramGrid[0],
    isReliable: bestComparison.oosSharpe > 0.5 && overfitRatio > 0.5,
    comparisons: comparisons.sort((a, b) => b.oosSharpe - a.oosSharpe).slice(0, 10),
  };
}

/** Validate an artist's current Market Hunter settings against historical data */
export async function validateMarketHunterParams(artistId: number): Promise<ValidationReport> {
  // Default params matching market-hunter.ts constants
  const currentParams = { stopLossPct: 0.03, takeProfitPct: 0.05 };

  const assets = [
    { id: 'matic-network', symbol: 'MATIC' },
    { id: 'weth', symbol: 'WETH' },
  ];

  const results: BacktestResult[] = [];
  for (const asset of assets) {
    try {
      const result = await backtestStrategy({
        coingeckoId: asset.id,
        symbol: asset.symbol,
        strategy: 'momentum',
        periodDays: 90,
        stopLossPct: currentParams.stopLossPct,
        takeProfitPct: currentParams.takeProfitPct,
        allocationUsd: 1000,
      });
      results.push(result);
    } catch {
      // Skip failed assets
    }
  }

  const avgSharpe = results.length > 0
    ? results.reduce((s, r) => s + r.sharpeRatio, 0) / results.length
    : 0;
  const avgWinRate = results.length > 0
    ? results.reduce((s, r) => s + r.winRate, 0) / results.length
    : 0;
  const maxDd = results.length > 0
    ? Math.max(...results.map(r => r.maxDrawdownPct))
    : 0;

  const recommendations: string[] = [];
  if (avgSharpe < 0.5) recommendations.push('Low Sharpe ratio — consider tightening stop loss or reducing trade frequency');
  if (avgWinRate < 40) recommendations.push(`Win rate ${avgWinRate.toFixed(0)}% is below 40% — strategy underperforming`);
  if (maxDd > 15) recommendations.push(`Max drawdown ${maxDd.toFixed(0)}% exceeds 15% — consider smaller position sizes`);
  if (results.every(r => !r.isStatisticallySignificant)) recommendations.push('Insufficient trade sample size — extend backtest period');
  if (recommendations.length === 0) recommendations.push('Current parameters validated — within acceptable risk parameters');

  const confidenceScore = Math.min(100, Math.max(0, avgSharpe * 30 + avgWinRate * 0.5 + Math.max(0, 30 - maxDd)));

  return {
    artistId,
    currentParams,
    validationResults: results,
    recommendations,
    isApproved: avgSharpe >= 0.5 && avgWinRate >= 40 && maxDd <= 15,
    confidenceScore: Math.round(confidenceScore),
  };
}

// ============================================
// HELPERS
// ============================================

function buildParamGrid(strategy: StrategyType): Array<Record<string, number>> {
  switch (strategy) {
    case 'rsi':
      return [20, 25, 30, 35].map(oversold => ({ rsiOversold: oversold, rsiOverbought: 100 - oversold }));
    case 'bollinger':
      return [14, 20, 26].map(period => ({ bbPeriod: period }));
    case 'ema_cross':
      return [
        { emaFast: 10, emaSlow: 30 },
        { emaFast: 20, emaSlow: 50 },
        { emaFast: 9, emaSlow: 21 },
      ];
    default:
      return [
        { stopLossPct: 0.02, takeProfitPct: 0.04 },
        { stopLossPct: 0.03, takeProfitPct: 0.05 },
        { stopLossPct: 0.04, takeProfitPct: 0.08 },
      ];
  }
}

function buildConfigFromParams(
  base: OptimizeConfig,
  params: Record<string, number>,
  days: number,
): BacktestConfig {
  return {
    coingeckoId: base.coingeckoId,
    symbol: base.symbol,
    strategy: base.strategy,
    periodDays: Math.min(365, days) as BacktestConfig['periodDays'],
    stopLossPct: params.stopLossPct ?? 0.03,
    takeProfitPct: params.takeProfitPct ?? 0.05,
    allocationUsd: 1000,
    rsiOversold: params.rsiOversold,
    rsiOverbought: params.rsiOverbought,
    bbPeriod: params.bbPeriod,
    emaFast: params.emaFast,
    emaSlow: params.emaSlow,
  };
}
