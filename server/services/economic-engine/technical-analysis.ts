/**
 * TECHNICAL ANALYSIS ENGINE — Multi-Indicator Signal Confluence System
 *
 * Extracted & adapted from: atilaahmettaner/tradingview-mcp (MIT)
 * Implements: RSI, MACD, Bollinger Bands, EMA Cross, ATR, Support/Resistance,
 *             Multi-Timeframe Analysis, Confluent Signal scoring
 *
 * All calculations are pure TypeScript math — no external TA library dependencies.
 * CoinGecko free tier used for historical price data.
 *
 * Used by: market-hunter.ts (entry/exit signals), alpha-hunter.ts (strategy selection)
 */

import { getTokenPrices } from './price-feeds';

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';

// ============================================
// TYPES
// ============================================

export interface OHLCV {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RSIResult {
  value: number;
  signal: 'oversold' | 'overbought' | 'neutral';
  strength: 'strong' | 'moderate' | 'weak';
}

export interface MACDResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  cross: 'golden' | 'death' | null;
  momentum: 'bullish' | 'bearish' | 'neutral';
}

export interface BollingerResult {
  upper: number;
  middle: number;  // SMA
  lower: number;
  bandwidth: number;      // (upper-lower)/middle * 100
  squeeze: boolean;       // bandwidth < 10%
  position: 'above_upper' | 'near_upper' | 'middle' | 'near_lower' | 'below_lower';
}

export interface EMACrossResult {
  ema20: number;
  ema50: number;
  ema200: number;
  cross: 'golden' | 'death' | null;   // EMA20/EMA50 cross
  trend: 'bullish' | 'bearish' | 'neutral';
}

export interface SupportResistance {
  supports: number[];
  resistances: number[];
  nearestSupport: number | null;
  nearestResistance: number | null;
  strengthMap: Record<number, number>;  // price → strength score
}

export interface MultiTimeframeAlignment {
  weekly: 'bullish' | 'bearish' | 'neutral';
  daily: 'bullish' | 'bearish' | 'neutral';
  h4: 'bullish' | 'bearish' | 'neutral';
  h1: 'bullish' | 'bearish' | 'neutral';
  alignment: 'bullish' | 'bearish' | 'mixed';
  score: number;  // -4 to +4 (sum of aligned signals)
}

export interface ConfluentSignal {
  score: number;          // 0-100 confluence score
  signals: string[];      // list of confirming signals
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;     // 0-1
  rsi: RSIResult;
  macd: MACDResult;
  bb: BollingerResult;
  ema: EMACrossResult;
  atr: number;
  stopLossPrice: number;
  takeProfitPrice: number;
}

// ============================================
// HISTORICAL DATA FETCHER
// ============================================

/** Fetch OHLCV data from CoinGecko (free) */
async function fetchOHLCV(
  coingeckoId: string,
  days: 1 | 7 | 14 | 30 | 90 | 180 | 365,
): Promise<OHLCV[]> {
  const url = `${COINGECKO_BASE}/coins/${coingeckoId}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, {
    signal: AbortSignal.timeout(8000),
    headers: { 'Accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`CoinGecko OHLCV ${coingeckoId}: ${res.status}`);

  // CoinGecko returns [timestamp, open, high, low, close]
  const raw = await res.json() as Array<[number, number, number, number, number]>;
  return raw.map(([timestamp, open, high, low, close]) => ({
    timestamp, open, high, low, close, volume: 0,
  }));
}

/** Extract close prices from OHLCV */
function closes(data: OHLCV[]): number[] {
  return data.map(d => d.close);
}

// ============================================
// RSI — Relative Strength Index
// ============================================

export function calculateRSI(prices: number[], period = 14): RSIResult {
  if (prices.length < period + 1) return { value: 50, signal: 'neutral', strength: 'weak' };

  let gains = 0;
  let losses = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses += Math.abs(change);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  // Smooth over remaining prices (Wilder's smoothing)
  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const value = 100 - 100 / (1 + rs);

  let signal: RSIResult['signal'];
  let strength: RSIResult['strength'];

  if (value <= 30) {
    signal = 'oversold';
    strength = value <= 20 ? 'strong' : 'moderate';
  } else if (value >= 70) {
    signal = 'overbought';
    strength = value >= 80 ? 'strong' : 'moderate';
  } else {
    signal = 'neutral';
    strength = value < 40 || value > 60 ? 'moderate' : 'weak';
  }

  return { value, signal, strength };
}

// ============================================
// MACD — Moving Average Convergence Divergence
// ============================================

function calculateEMA(prices: number[], period: number): number[] {
  if (prices.length < period) return [];
  const k = 2 / (period + 1);
  const emas: number[] = new Array(prices.length).fill(0);

  // Simple average for first value
  emas[period - 1] = prices.slice(0, period).reduce((s, v) => s + v, 0) / period;

  for (let i = period; i < prices.length; i++) {
    emas[i] = prices[i] * k + emas[i - 1] * (1 - k);
  }

  return emas;
}

export function calculateMACD(
  prices: number[],
  fast = 12,
  slow = 26,
  signal = 9,
): MACDResult {
  if (prices.length < slow + signal) {
    return { macdLine: 0, signalLine: 0, histogram: 0, cross: null, momentum: 'neutral' };
  }

  const emaFast = calculateEMA(prices, fast);
  const emaSlow = calculateEMA(prices, slow);

  const macdValues: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    if (emaFast[i] && emaSlow[i]) macdValues.push(emaFast[i] - emaSlow[i]);
  }

  const signalValues = calculateEMA(macdValues, signal);
  const macdLine = macdValues[macdValues.length - 1];
  const signalLine = signalValues[signalValues.length - 1];
  const histogram = macdLine - signalLine;

  // Detect cross (compare with previous bar)
  let cross: MACDResult['cross'] = null;
  if (macdValues.length >= 2 && signalValues.length >= 2) {
    const prevMacd = macdValues[macdValues.length - 2];
    const prevSignal = signalValues[signalValues.length - 2];
    if (prevMacd < prevSignal && macdLine > signalLine) cross = 'golden';
    else if (prevMacd > prevSignal && macdLine < signalLine) cross = 'death';
  }

  const momentum: MACDResult['momentum'] =
    macdLine > 0 && histogram > 0 ? 'bullish' :
    macdLine < 0 && histogram < 0 ? 'bearish' : 'neutral';

  return { macdLine, signalLine, histogram, cross, momentum };
}

// ============================================
// BOLLINGER BANDS
// ============================================

export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDevMultiplier = 2,
): BollingerResult {
  if (prices.length < period) {
    const p = prices[prices.length - 1] || 0;
    return { upper: p * 1.05, middle: p, lower: p * 0.95, bandwidth: 10, squeeze: false, position: 'middle' };
  }

  const slice = prices.slice(-period);
  const middle = slice.reduce((s, v) => s + v, 0) / period;
  const variance = slice.reduce((s, v) => s + Math.pow(v - middle, 2), 0) / period;
  const sd = Math.sqrt(variance);

  const upper = middle + stdDevMultiplier * sd;
  const lower = middle - stdDevMultiplier * sd;
  const bandwidth = middle > 0 ? ((upper - lower) / middle) * 100 : 10;
  const squeeze = bandwidth < 8;

  const currentPrice = prices[prices.length - 1];
  let position: BollingerResult['position'];
  if (currentPrice > upper) position = 'above_upper';
  else if (currentPrice > middle + sd) position = 'near_upper';
  else if (currentPrice < lower) position = 'below_lower';
  else if (currentPrice < middle - sd) position = 'near_lower';
  else position = 'middle';

  return { upper, middle, lower, bandwidth, squeeze, position };
}

// ============================================
// EMA CROSS
// ============================================

export function calculateEMACross(prices: number[]): EMACrossResult {
  const ema20arr = calculateEMA(prices, 20);
  const ema50arr = calculateEMA(prices, 50);
  const ema200arr = calculateEMA(prices, 200);

  const ema20 = ema20arr[ema20arr.length - 1] || 0;
  const ema50 = ema50arr[ema50arr.length - 1] || 0;
  const ema200 = ema200arr[ema200arr.length - 1] || 0;

  // Detect EMA20/50 cross on last bar
  let cross: EMACrossResult['cross'] = null;
  if (ema20arr.length >= 2 && ema50arr.length >= 2) {
    const prev20 = ema20arr[ema20arr.length - 2];
    const prev50 = ema50arr[ema50arr.length - 2];
    if (prev20 < prev50 && ema20 > ema50) cross = 'golden';
    else if (prev20 > prev50 && ema20 < ema50) cross = 'death';
  }

  let trend: EMACrossResult['trend'];
  if (ema20 > ema50 && ema50 > (ema200 || ema50)) trend = 'bullish';
  else if (ema20 < ema50 && ema50 < (ema200 || ema50)) trend = 'bearish';
  else trend = 'neutral';

  return { ema20, ema50, ema200, cross, trend };
}

// ============================================
// ATR — Average True Range
// ============================================

export function calculateATR(data: OHLCV[], period = 14): number {
  if (data.length < 2) return 0;

  const trValues: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low - data[i - 1].close);
    trValues.push(Math.max(hl, hc, lc));
  }

  // Wilder's ATR smoothing
  let atr = trValues.slice(0, period).reduce((s, v) => s + v, 0) / period;
  for (let i = period; i < trValues.length; i++) {
    atr = (atr * (period - 1) + trValues[i]) / period;
  }

  return atr;
}

// ============================================
// SUPPORT & RESISTANCE
// ============================================

export function getSupportResistance(prices: number[], lookback = 20): SupportResistance {
  if (prices.length < lookback * 2) {
    const p = prices[prices.length - 1] || 0;
    return { supports: [p * 0.95], resistances: [p * 1.05], nearestSupport: p * 0.95, nearestResistance: p * 1.05, strengthMap: {} };
  }

  const pivotHighs: number[] = [];
  const pivotLows: number[] = [];

  // Find swing highs and lows
  for (let i = lookback; i < prices.length - lookback; i++) {
    const slice = prices.slice(i - lookback, i + lookback);
    const max = Math.max(...slice);
    const min = Math.min(...slice);
    if (prices[i] === max) pivotHighs.push(prices[i]);
    if (prices[i] === min) pivotLows.push(prices[i]);
  }

  // Cluster nearby levels (within 0.5% of each other)
  const cluster = (levels: number[]): number[] => {
    const sorted = [...levels].sort((a, b) => a - b);
    const clustered: number[] = [];
    let i = 0;
    while (i < sorted.length) {
      const base = sorted[i];
      const group = [base];
      while (i + 1 < sorted.length && Math.abs(sorted[i + 1] - base) / base < 0.005) {
        i++;
        group.push(sorted[i]);
      }
      clustered.push(group.reduce((s, v) => s + v, 0) / group.length);
      i++;
    }
    return clustered;
  };

  const supports = cluster(pivotLows).slice(-5);
  const resistances = cluster(pivotHighs).slice(-5);
  const currentPrice = prices[prices.length - 1];

  const nearestSupport = supports.filter(s => s < currentPrice).sort((a, b) => b - a)[0] ?? null;
  const nearestResistance = resistances.filter(r => r > currentPrice).sort((a, b) => a - b)[0] ?? null;

  // Strength = how many times price respected this level
  const strengthMap: Record<number, number> = {};
  for (const level of [...supports, ...resistances]) {
    const touches = prices.filter(p => Math.abs(p - level) / level < 0.01).length;
    strengthMap[level] = touches;
  }

  return { supports, resistances, nearestSupport, nearestResistance, strengthMap };
}

// ============================================
// MULTI-TIMEFRAME ANALYSIS
// ============================================

/** Compute trend bias for a set of prices (simple EMA comparison) */
function getTimeframeBias(prices: number[]): 'bullish' | 'bearish' | 'neutral' {
  if (prices.length < 20) return 'neutral';
  const ema9 = calculateEMA(prices, 9);
  const ema21 = calculateEMA(prices, 21);
  const e9 = ema9[ema9.length - 1];
  const e21 = ema21[ema21.length - 1];
  if (!e9 || !e21) return 'neutral';
  const diff = (e9 - e21) / e21 * 100;
  if (diff > 0.3) return 'bullish';
  if (diff < -0.3) return 'bearish';
  return 'neutral';
}

/**
 * Multi-timeframe alignment using CoinGecko OHLCV
 * Timeframes: weekly (90d), daily (30d), 4h (7d), 1h (1d)
 */
export async function getMultiTimeframeAlignment(
  coingeckoId: string,
): Promise<MultiTimeframeAlignment> {
  const fallback: MultiTimeframeAlignment = {
    weekly: 'neutral', daily: 'neutral', h4: 'neutral', h1: 'neutral',
    alignment: 'mixed', score: 0,
  };

  try {
    const [w, d, h4, h1] = await Promise.allSettled([
      fetchOHLCV(coingeckoId, 90),
      fetchOHLCV(coingeckoId, 30),
      fetchOHLCV(coingeckoId, 7),
      fetchOHLCV(coingeckoId, 1),
    ]);

    const weekly = w.status === 'fulfilled' ? getTimeframeBias(closes(w.value)) : 'neutral';
    const daily = d.status === 'fulfilled' ? getTimeframeBias(closes(d.value)) : 'neutral';
    const h4bias = h4.status === 'fulfilled' ? getTimeframeBias(closes(h4.value)) : 'neutral';
    const h1bias = h1.status === 'fulfilled' ? getTimeframeBias(closes(h1.value)) : 'neutral';

    const biases = [weekly, daily, h4bias, h1bias];
    const scoreMap = { bullish: 1, neutral: 0, bearish: -1 };
    const score = biases.reduce((s, b) => s + scoreMap[b], 0);

    const alignment: MultiTimeframeAlignment['alignment'] =
      score >= 2 ? 'bullish' : score <= -2 ? 'bearish' : 'mixed';

    return { weekly, daily, h4: h4bias, h1: h1bias, alignment, score };
  } catch {
    return fallback;
  }
}

// ============================================
// CONFLUENT SIGNAL — Main Entry Point
// ============================================

/**
 * Calculate a confluence score from multiple indicators.
 * Returns BUY signal only when multiple indicators agree.
 *
 * Score breakdown:
 *   RSI oversold (BUY): +25
 *   MACD golden cross: +20
 *   MACD bullish momentum: +10
 *   BB below lower band: +15
 *   BB squeeze break: +10
 *   EMA golden cross: +20
 *   EMA bullish trend: +10
 *   Price near support: +15 (deducted: -10 if near resistance)
 */
export async function getConfluentSignal(
  coingeckoId: string,
  currentPrice?: number,
): Promise<ConfluentSignal> {
  const HOLD: ConfluentSignal = {
    score: 50, signals: ['Insufficient data'], action: 'HOLD', confidence: 0,
    rsi: { value: 50, signal: 'neutral', strength: 'weak' },
    macd: { macdLine: 0, signalLine: 0, histogram: 0, cross: null, momentum: 'neutral' },
    bb: { upper: 0, middle: 0, lower: 0, bandwidth: 10, squeeze: false, position: 'middle' },
    ema: { ema20: 0, ema50: 0, ema200: 0, cross: null, trend: 'neutral' },
    atr: 0, stopLossPrice: 0, takeProfitPrice: 0,
  };

  try {
    const ohlcv = await fetchOHLCV(coingeckoId, 30);
    if (ohlcv.length < 26) return HOLD;

    const priceData = closes(ohlcv);
    const price = currentPrice ?? priceData[priceData.length - 1];

    const rsi = calculateRSI(priceData, 14);
    const macd = calculateMACD(priceData, 12, 26, 9);
    const bb = calculateBollingerBands(priceData, 20, 2);
    const ema = calculateEMACross(priceData);
    const atr = calculateATR(ohlcv, 14);
    const sr = getSupportResistance(priceData, 10);

    let score = 0;
    const signals: string[] = [];

    // RSI signals
    if (rsi.signal === 'oversold') {
      score += rsi.strength === 'strong' ? 30 : 20;
      signals.push(`RSI oversold (${rsi.value.toFixed(1)})`);
    } else if (rsi.signal === 'overbought') {
      score -= 20;
      signals.push(`RSI overbought (${rsi.value.toFixed(1)})`);
    } else if (rsi.value > 45 && rsi.value < 65) {
      score += 5;
      signals.push(`RSI neutral-bullish (${rsi.value.toFixed(1)})`);
    }

    // MACD signals
    if (macd.cross === 'golden') {
      score += 25;
      signals.push('MACD golden cross');
    } else if (macd.cross === 'death') {
      score -= 20;
      signals.push('MACD death cross');
    }
    if (macd.momentum === 'bullish') {
      score += 10;
      signals.push('MACD bullish momentum');
    } else if (macd.momentum === 'bearish') {
      score -= 10;
    }

    // Bollinger Bands
    if (bb.position === 'below_lower') {
      score += 20;
      signals.push('Price at BB lower band (mean reversion)');
    } else if (bb.position === 'above_upper') {
      score -= 15;
      signals.push('Price above BB upper band');
    }
    if (bb.squeeze) {
      score += 8;
      signals.push('BB squeeze detected (breakout imminent)');
    }

    // EMA trend
    if (ema.cross === 'golden') {
      score += 25;
      signals.push('EMA20/50 golden cross');
    } else if (ema.cross === 'death') {
      score -= 20;
      signals.push('EMA20/50 death cross');
    }
    if (ema.trend === 'bullish') {
      score += 10;
      signals.push('EMA bullish alignment');
    } else if (ema.trend === 'bearish') {
      score -= 10;
    }

    // Support/Resistance proximity
    if (sr.nearestSupport && price > 0) {
      const distToSupport = ((price - sr.nearestSupport) / price) * 100;
      if (distToSupport < 2) {
        score += 15;
        signals.push(`Near strong support ($${sr.nearestSupport.toFixed(4)})`);
      }
    }
    if (sr.nearestResistance && price > 0) {
      const distToResistance = ((sr.nearestResistance - price) / price) * 100;
      if (distToResistance < 1) {
        score -= 10;
        signals.push(`Near resistance ($${sr.nearestResistance.toFixed(4)})`);
      }
    }

    // Normalize score to 0-100
    score = Math.max(0, Math.min(100, score + 30)); // baseline of 30

    // Determine action
    let action: ConfluentSignal['action'];
    if (score >= 65 && signals.filter(s => !s.includes('overbought') && !s.includes('resistance') && !s.includes('death')).length >= 2) {
      action = 'BUY';
    } else if (score <= 30) {
      action = 'SELL';
    } else {
      action = 'HOLD';
    }

    const confidence = Math.min(1, (Math.abs(score - 50) / 50) * (1 + signals.length * 0.05));

    // Risk/reward based on ATR
    const atrMultiple = 1.5;
    const stopLossPrice = action === 'BUY' ? price - (atr * atrMultiple) : price + (atr * atrMultiple);
    const takeProfitPrice = action === 'BUY' ? price + (atr * atrMultiple * 2) : price - (atr * atrMultiple * 2);

    return { score, signals, action, confidence, rsi, macd, bb, ema, atr, stopLossPrice, takeProfitPrice };
  } catch (err: any) {
    console.warn(`[TechnicalAnalysis] getConfluentSignal failed for ${coingeckoId}: ${err.message}`);
    return HOLD;
  }
}
