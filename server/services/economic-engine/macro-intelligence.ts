/**
 * MACRO INTELLIGENCE — Macro-Economic Signal Engine
 *
 * Sources:
 *   - FRED API (St. Louis Fed) — 840k+ economic series, free key required
 *   - Yahoo Finance (no key) — VIX, S&P500, market breadth
 *   - Fallback: graceful null signals if APIs are unavailable
 *
 * Adapted from: Trade-With-Claude/cbt-framework FRED integration pattern
 * Used by: risk-engine.ts (evaluateRisk override)
 *
 * CRITICAL: All functions fail SILENTLY. Never throw to callers.
 */

import type { OperatingMode } from './types';

const FRED_BASE = 'https://api.econdb.com/api/series';  // No-auth proxy, or use FRED directly
const FRED_API_BASE = 'https://api.stlouisfed.org/fred/series/observations';
const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';

// ============================================
// TYPES
// ============================================

export interface FedFundsData {
  current: number;
  trend: 'rising' | 'falling' | 'stable';
  lastUpdated: string;
}

export interface YieldCurveData {
  twoTen: number;        // 10Y - 2Y spread in bps (negative = inverted)
  inversion: boolean;
  tenYear: number;
  twoYear: number;
}

export interface CPIData {
  current: number;   // headline CPI YoY %
  yoy: number;
  trend: 'rising' | 'falling' | 'stable';
}

export interface VIXData {
  current: number;
  regime: 'low' | 'normal' | 'high' | 'extreme';
  previousClose: number;
  change: number;
}

export interface MarketRegimeData {
  regime: 'bull' | 'bear' | 'sideways';
  confidence: number;   // 0-100
  sp500Change30d: number;
  sp500Change90d: number;
}

export interface MacroRiskSignal {
  level: number;                            // 0-100, higher = more risk
  factors: string[];                        // Human-readable risk factors
  recommendedMode: OperatingMode | null;    // null = no override
  vixLevel: number;
  yieldCurveInverted: boolean;
  marketRegime: 'bull' | 'bear' | 'sideways';
  riskLabel: 'low' | 'moderate' | 'elevated' | 'high' | 'extreme';
  calculatedAt: string;
}

// ============================================
// HELPERS
// ============================================

/** Fetch from FRED API if key is set, otherwise try EconDB proxy */
async function fetchFredSeries(
  seriesId: string,
  limit = 30,
): Promise<Array<{ date: string; value: string }>> {
  const key = process.env.FRED_API_KEY;
  if (key) {
    const url = `${FRED_API_BASE}?series_id=${seriesId}&api_key=${key}&file_type=json&limit=${limit}&sort_order=desc`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`FRED ${seriesId}: ${res.status}`);
    const data = await res.json() as { observations: Array<{ date: string; value: string }> };
    return data.observations.filter(o => o.value !== '.' && o.value !== 'NA');
  }
  // Fallback: EconDB (no key, some series available)
  const url = `https://api.econdb.com/api/series/?ticker=${encodeURIComponent(seriesId)}&format=json`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`EconDB ${seriesId}: ${res.status}`);
  const data = await res.json() as any;
  const obs = data?.results?.[0]?.data ?? [];
  return obs.slice(-limit).map((o: any) => ({ date: o[0], value: String(o[1]) })).filter((o: any) => o.value !== 'null');
}

/** Fetch Yahoo Finance data for a ticker (1 month of daily closes) */
async function fetchYahooPrice(symbol: string): Promise<{ close: number; previousClose: number; change: number; data30d: number[] }> {
  const period1 = Math.floor((Date.now() - 90 * 86400000) / 1000);
  const period2 = Math.floor(Date.now() / 1000);
  const url = `${YAHOO_CHART_BASE}/${symbol}?period1=${period1}&period2=${period2}&interval=1d`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BoostifyMusicBot/1.0)' },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: ${res.status}`);
  const raw = await res.json() as any;
  const closes: number[] = raw?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
  const validCloses = closes.filter((v: number) => v != null && !isNaN(v));
  if (validCloses.length < 2) throw new Error(`Yahoo ${symbol}: insufficient data`);

  const current = validCloses[validCloses.length - 1];
  const previous = validCloses[validCloses.length - 2];
  return {
    close: current,
    previousClose: previous,
    change: ((current - previous) / previous) * 100,
    data30d: validCloses.slice(-30),
  };
}

/** Compute trend from a series of values */
function computeTrend(values: number[], periods = 5): 'rising' | 'falling' | 'stable' {
  if (values.length < 2) return 'stable';
  const recent = values.slice(-periods);
  const first = recent[0];
  const last = recent[recent.length - 1];
  const change = ((last - first) / Math.abs(first || 1)) * 100;
  if (change > 0.2) return 'rising';
  if (change < -0.2) return 'falling';
  return 'stable';
}

// ============================================
// PUBLIC DATA FUNCTIONS
// ============================================

/** Federal Funds Effective Rate */
export async function getFedFundsRate(): Promise<FedFundsData | null> {
  try {
    const obs = await fetchFredSeries('FEDFUNDS', 12);
    if (obs.length < 2) return null;
    const values = obs.reverse().map(o => parseFloat(o.value));
    const current = values[values.length - 1];
    return {
      current,
      trend: computeTrend(values, 3),
      lastUpdated: obs[obs.length - 1]?.date ?? '',
    };
  } catch {
    return null;
  }
}

/** 10Y-2Y Treasury Yield Spread (recession indicator) */
export async function getYieldCurveSpreads(): Promise<YieldCurveData | null> {
  try {
    const [obs10, obs2] = await Promise.all([
      fetchFredSeries('DGS10', 5),
      fetchFredSeries('DGS2', 5),
    ]);
    if (!obs10.length || !obs2.length) return null;

    const tenYear = parseFloat(obs10[obs10.length - 1].value);
    const twoYear = parseFloat(obs2[obs2.length - 1].value);
    const twoTen = (tenYear - twoYear) * 100; // in bps

    return { twoTen, inversion: twoTen < 0, tenYear, twoYear };
  } catch {
    return null;
  }
}

/** CPI — Consumer Price Index YoY */
export async function getCPI(): Promise<CPIData | null> {
  try {
    const obs = await fetchFredSeries('CPIAUCSL', 13);  // 13 months
    if (obs.length < 13) return null;
    const values = obs.reverse().map(o => parseFloat(o.value));
    const current = values[values.length - 1];
    const yearAgo = values[values.length - 13];
    const yoy = ((current - yearAgo) / yearAgo) * 100;

    // YoY trend from last 3 readings
    const prev3 = [
      ((values[values.length - 2] - values[values.length - 14]) / (values[values.length - 14] || 1)) * 100,
      ((values[values.length - 3] - values[values.length - 15]) / (values[values.length - 15] || 1)) * 100,
    ].filter(v => !isNaN(v));

    const allValues = [...prev3, yoy];
    const trend = computeTrend(allValues, allValues.length);

    return { current, yoy, trend };
  } catch {
    return null;
  }
}

/** VIX — Volatility Index (market fear gauge) */
export async function getVIXLevel(): Promise<VIXData | null> {
  try {
    const data = await fetchYahooPrice('^VIX');
    const current = data.close;
    let regime: VIXData['regime'];
    if (current < 15) regime = 'low';
    else if (current < 25) regime = 'normal';
    else if (current < 35) regime = 'high';
    else regime = 'extreme';

    return {
      current,
      regime,
      previousClose: data.previousClose,
      change: data.change,
    };
  } catch {
    return null;
  }
}

/** S&P500 market regime (bull/bear/sideways) based on price action */
export async function getMarketRegime(): Promise<MarketRegimeData | null> {
  try {
    const data = await fetchYahooPrice('^GSPC');
    const closes = data.data30d;
    if (closes.length < 20) return null;

    const current = closes[closes.length - 1];
    const ago30 = closes[0];
    const ago60 = closes[Math.max(0, closes.length - 60)] ?? ago30;

    const change30d = ((current - ago30) / ago30) * 100;
    const change90d = ((current - ago60) / ago60) * 100;

    let regime: MarketRegimeData['regime'];
    let confidence: number;

    if (change30d > 5 && change90d > 10) {
      regime = 'bull';
      confidence = Math.min(95, 60 + change30d * 2);
    } else if (change30d < -5 && change90d < -10) {
      regime = 'bear';
      confidence = Math.min(95, 60 + Math.abs(change30d) * 2);
    } else {
      regime = 'sideways';
      confidence = 60;
    }

    return { regime, confidence, sp500Change30d: change30d, sp500Change90d: change90d };
  } catch {
    return null;
  }
}

// ============================================
// MAIN SIGNAL: Aggregate macro data → risk signal
// ============================================

/**
 * Get a composite macro risk signal.
 * Used by risk-engine.ts to adjust operating mode.
 *
 * Risk level interpretation:
 *   0-25  → Low risk, macro tailwinds
 *   26-50 → Moderate, neutral macro
 *   51-70 → Elevated, some caution warranted
 *   71-85 → High, consider defense mode
 *   86-100 → Extreme, force survival/defense
 */
export async function getMacroRiskSignal(): Promise<MacroRiskSignal | null> {
  try {
    // Fetch all data in parallel, tolerate individual failures
    const [vix, yieldCurve, cpi, regime] = await Promise.allSettled([
      getVIXLevel(),
      getYieldCurveSpreads(),
      getCPI(),
      getMarketRegime(),
    ]);

    const vixData = vix.status === 'fulfilled' ? vix.value : null;
    const yieldData = yieldCurve.status === 'fulfilled' ? yieldCurve.value : null;
    const cpiData = cpi.status === 'fulfilled' ? cpi.value : null;
    const regimeData = regime.status === 'fulfilled' ? regime.value : null;

    // Build risk score (0-100)
    let riskScore = 30;  // baseline — neutral
    const factors: string[] = [];

    // VIX contribution (max 35 pts)
    const vixLevel = vixData?.current ?? 20;
    if (vixLevel >= 35) {
      riskScore += 35;
      factors.push(`VIX extreme (${vixLevel.toFixed(1)})`);
    } else if (vixLevel >= 25) {
      riskScore += 20;
      factors.push(`VIX elevated (${vixLevel.toFixed(1)})`);
    } else if (vixLevel <= 14) {
      riskScore -= 10;
      factors.push(`VIX low/complacent (${vixLevel.toFixed(1)})`);
    }

    // Yield curve contribution (max 20 pts)
    if (yieldData?.inversion) {
      const severity = Math.abs(yieldData.twoTen);
      const pts = Math.min(20, severity / 3);
      riskScore += pts;
      factors.push(`Yield curve inverted (${yieldData.twoTen.toFixed(0)}bps)`);
    } else if ((yieldData?.twoTen ?? 100) > 50) {
      riskScore -= 5;
      factors.push(`Yield curve healthy (+${yieldData?.twoTen.toFixed(0)}bps)`);
    }

    // CPI contribution (max 15 pts)
    if (cpiData) {
      if (cpiData.yoy > 6) {
        riskScore += 15;
        factors.push(`High inflation (CPI +${cpiData.yoy.toFixed(1)}%)`);
      } else if (cpiData.yoy > 4) {
        riskScore += 8;
        factors.push(`Elevated inflation (CPI +${cpiData.yoy.toFixed(1)}%)`);
      } else if (cpiData.yoy < 2 && cpiData.trend === 'falling') {
        riskScore += 5;
        factors.push(`Deflation risk (CPI ${cpiData.yoy.toFixed(1)}%)`);
      }
    }

    // Market regime contribution (max 20 pts)
    if (regimeData) {
      if (regimeData.regime === 'bear') {
        riskScore += 20;
        factors.push(`Bear market (S&P500 ${regimeData.sp500Change30d.toFixed(1)}% 30d)`);
      } else if (regimeData.regime === 'bull') {
        riskScore -= 10;
        factors.push(`Bull market (S&P500 +${regimeData.sp500Change30d.toFixed(1)}% 30d)`);
      }
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    // Determine recommended operating mode
    let recommendedMode: OperatingMode | null = null;
    if (riskScore >= 80) recommendedMode = 'defense';
    else if (riskScore >= 65) recommendedMode = 'stable';
    else if (riskScore <= 20 && regimeData?.regime === 'bull') recommendedMode = 'aggressive';

    // Risk label
    let riskLabel: MacroRiskSignal['riskLabel'];
    if (riskScore <= 25) riskLabel = 'low';
    else if (riskScore <= 50) riskLabel = 'moderate';
    else if (riskScore <= 65) riskLabel = 'elevated';
    else if (riskScore <= 80) riskLabel = 'high';
    else riskLabel = 'extreme';

    if (factors.length === 0) factors.push('Normal macro conditions');

    console.log(`📊 [MacroIntelligence] Risk=${riskScore} (${riskLabel}) | ${factors.join(', ')}`);

    return {
      level: riskScore,
      factors,
      recommendedMode,
      vixLevel,
      yieldCurveInverted: yieldData?.inversion ?? false,
      marketRegime: regimeData?.regime ?? 'sideways',
      riskLabel,
      calculatedAt: new Date().toISOString(),
    };
  } catch (err: any) {
    console.warn(`[MacroIntelligence] Signal generation failed: ${err.message}`);
    return null;
  }
}
