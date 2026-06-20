/**
 * BOOSTIFY ECONOMIC ENGINE — Funding Rate Scanner
 * Scans public funding rates across all supported CEX exchanges.
 * No API keys required — funding rates are public data.
 *
 * Scans every 5 minutes (configurable). Detects opportunities when
 * annualized funding rate exceeds the configured threshold.
 *
 * ⚠️ RISK NOTICE: High funding rates are attractive but volatile.
 * Rates can flip negative in minutes during market stress events.
 * Always verify the trend before entering a position.
 */

import { db } from '../../db';
import { fundingRateHistory, cexArbOpportunities } from '../../../db/schema';
import { desc, eq, and, gt, sql } from 'drizzle-orm';
import { fetchPublicFundingRates, SUPPORTED_EXCHANGES, type SupportedExchangeId } from './exchange-connector';

// ─── Symbols to Scan ────────────────────────────────────────────────────
// Format: perpetual market format for CCXT (SYMBOL/QUOTE:SETTLE)
const TOP_PERP_SYMBOLS = [
  'BTC/USDT:USDT',
  'ETH/USDT:USDT',
  'SOL/USDT:USDT',
  'BNB/USDT:USDT',
  'XRP/USDT:USDT',
  'DOGE/USDT:USDT',
  'AVAX/USDT:USDT',
  'LINK/USDT:USDT',
  'MATIC/USDT:USDT',
  'ARB/USDT:USDT',
];

// ─── Opportunity Detection Config ────────────────────────────────────────

/** Minimum annualized APR to register an opportunity (default: 15% APR) */
const MIN_OPPORTUNITY_APR = 0.15;

/** Typical exchange fees for a full round-trip (open + close): ~0.1% spot + 0.05% perp maker */
const ESTIMATED_ROUND_TRIP_FEES_PCT = 0.0015;

// ─── Scanner Result Types ─────────────────────────────────────────────────

export interface FundingScanResult {
  exchangeId: string;
  symbol: string;
  baseSymbol: string;        // 'BTC' from 'BTC/USDT:USDT'
  fundingRate: number;
  intervalHours: number;
  annualizedRate: number;    // as decimal (0.20 = 20% APR)
  annualizedRatePct: number; // as percent (20)
  direction: 'positive' | 'negative'; // positive: longs pay shorts → short perp earns
  nextFundingTime: number | null;
  scannedAt: Date;
}

export interface ArbitrageOpportunity {
  type: 'funding';
  exchangeId: string;
  symbol: string;
  baseSymbol: string;
  grossApr: number;        // as decimal
  grossAprPct: number;
  netAprPct: number;       // after estimated fees
  requiredCapitalUsd: number; // minimum sensible position
  direction: 'long_spot_short_perp' | 'short_spot_long_perp';
  riskLevel: 'low' | 'medium' | 'high';
  expiresAt: Date;
}

// ─── Scanner State ────────────────────────────────────────────────────────

let lastScanAt: Date | null = null;
let lastScanResults: FundingScanResult[] = [];
let lastOpportunities: ArbitrageOpportunity[] = [];

// ─── Core Scanner ─────────────────────────────────────────────────────────

/** Run a full scan across all supported exchanges and all top symbols. */
export async function runFundingRateScan(): Promise<FundingScanResult[]> {
  const exchanges = Object.keys(SUPPORTED_EXCHANGES) as SupportedExchangeId[];
  const allResults: FundingScanResult[] = [];

  // Run exchange scans in parallel
  await Promise.allSettled(
    exchanges.map(async (exchangeId) => {
      try {
        const rates = await fetchPublicFundingRates(exchangeId, TOP_PERP_SYMBOLS);
        for (const r of rates) {
          const baseSymbol = r.symbol.split('/')[0];
          const result: FundingScanResult = {
            exchangeId: r.exchangeId,
            symbol: r.symbol,
            baseSymbol,
            fundingRate: r.fundingRate,
            intervalHours: r.intervalHours,
            annualizedRate: r.annualizedRate,
            annualizedRatePct: r.annualizedRate * 100,
            direction: r.fundingRate >= 0 ? 'positive' : 'negative',
            nextFundingTime: r.nextFundingTime,
            scannedAt: new Date(),
          };
          allResults.push(result);
        }
      } catch (err) {
        console.warn(`[FundingScanner] ${exchangeId} scan failed:`, (err as Error).message);
      }
    })
  );

  lastScanAt = new Date();
  lastScanResults = allResults;

  // Persist scan results to DB
  if (allResults.length > 0) {
    await persistScanResults(allResults);
  }

  // Detect and persist opportunities
  lastOpportunities = detectOpportunities(allResults);
  if (lastOpportunities.length > 0) {
    await persistOpportunities(lastOpportunities);
  }

  console.log(
    `[FundingScanner] Scan complete: ${allResults.length} rates, ` +
    `${lastOpportunities.length} opportunities found.`
  );

  return allResults;
}

// ─── Opportunity Detection ─────────────────────────────────────────────────

function detectOpportunities(results: FundingScanResult[]): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  for (const r of results) {
    const absApr = Math.abs(r.annualizedRate);
    if (absApr < MIN_OPPORTUNITY_APR) continue;

    // Net APR after estimated round-trip fees
    const netApr = absApr - ESTIMATED_ROUND_TRIP_FEES_PCT * 12; // fees amortized over a month
    if (netApr <= 0) continue;

    const direction = r.fundingRate > 0
      ? 'long_spot_short_perp' as const   // shorts receive funding
      : 'short_spot_long_perp' as const;  // longs receive funding (rare)

    // Risk classification based on APR magnitude
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (absApr > 1.0) riskLevel = 'high';   // > 100% APR — very volatile
    else if (absApr > 0.4) riskLevel = 'medium'; // > 40% APR

    opportunities.push({
      type: 'funding',
      exchangeId: r.exchangeId,
      symbol: r.symbol,
      baseSymbol: r.baseSymbol,
      grossApr: absApr,
      grossAprPct: absApr * 100,
      netAprPct: netApr * 100,
      requiredCapitalUsd: 100, // minimum $100 per side
      direction,
      riskLevel,
      expiresAt: new Date(Date.now() + r.intervalHours * 3600 * 1000),
    });
  }

  // Sort by net APR descending
  return opportunities.sort((a, b) => b.netAprPct - a.netAprPct);
}

// ─── Persistence ──────────────────────────────────────────────────────────

async function persistScanResults(results: FundingScanResult[]): Promise<void> {
  try {
    const rows = results.map((r) => ({
      exchangeId: r.exchangeId,
      symbol: r.symbol,
      rate: String(r.fundingRate),
      annualizedRate: String(r.annualizedRate),
      intervalHours: r.intervalHours,
      nextFundingAt: r.nextFundingTime ? new Date(r.nextFundingTime) : null,
    }));
    await db.insert(fundingRateHistory).values(rows);
  } catch (err) {
    console.warn('[FundingScanner] Failed to persist scan results:', (err as Error).message);
  }
}

async function persistOpportunities(ops: ArbitrageOpportunity[]): Promise<void> {
  try {
    const rows = ops.map((o) => ({
      type: o.type,
      exchangeA: o.exchangeId,
      exchangeB: null,
      symbol: o.symbol,
      spreadPct: String(o.grossAprPct),
      netSpreadAfterFees: String(o.netAprPct),
      estimatedApr: String(o.grossAprPct),
      requiredCapitalUsd: String(o.requiredCapitalUsd),
      status: 'detected' as const,
      expiresAt: o.expiresAt,
    }));
    await db.insert(cexArbOpportunities).values(rows);
  } catch (err) {
    console.warn('[FundingScanner] Failed to persist opportunities:', (err as Error).message);
  }
}

// ─── Cached Getters ────────────────────────────────────────────────────────

export function getLastScanResults(): FundingScanResult[] {
  return lastScanResults;
}

export function getLastOpportunities(): ArbitrageOpportunity[] {
  return lastOpportunities;
}

export function getLastScanTime(): Date | null {
  return lastScanAt;
}

/** Get recent funding rate history from DB for a specific symbol */
export async function getFundingRateHistory(
  exchangeId: string,
  symbol: string,
  limit = 48
) {
  return db
    .select()
    .from(fundingRateHistory)
    .where(
      and(
        eq(fundingRateHistory.exchangeId, exchangeId),
        eq(fundingRateHistory.symbol, symbol)
      )
    )
    .orderBy(desc(fundingRateHistory.scannedAt))
    .limit(limit);
}

/** Get top current opportunities from DB */
export async function getTopOpportunities(limit = 20) {
  return db
    .select()
    .from(cexArbOpportunities)
    .where(eq(cexArbOpportunities.status, 'detected'))
    .orderBy(desc(cexArbOpportunities.estimatedApr))
    .limit(limit);
}
