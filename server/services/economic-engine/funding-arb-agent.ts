/**
 * BOOSTIFY ECONOMIC ENGINE — Funding Rate Arbitrage Agent (Phase 1)
 *
 * Strategy: Delta-Neutral Funding Rate Capture
 * ─────────────────────────────────────────────
 * 1. Identify a perpetual contract with high funding rate (longs pay shorts).
 * 2. BUY spot (same notional size) — no directional exposure.
 * 3. SELL (short) the perpetual — earns funding payments every 8h (or 1h/4h).
 * 4. Net P&L ≈ funding received − trading fees.
 * 5. EXIT when: rate drops below floor, stop-loss on combined P&L, or max duration.
 *
 * ⚠️ RISK DISCLOSURE (MANDATORY — READ BEFORE ENABLING):
 *   • Funding rate flips: rates can reverse and you START PAYING instead of earning.
 *   • Liquidation risk: short perp position can be liquidated if price spikes.
 *   • Exchange risk: exchange insolvency, halts, or API failures may prevent closing.
 *   • Slippage: large positions may receive worse fills than the scanner detected.
 *   • This module operates with REAL MONEY on your exchange account.
 *   • Maximum recommended position: 20% of your available exchange balance.
 *   • Boostify is NOT a registered investment adviser. Trade at your own risk.
 *
 * Each artist operates with their own API keys and is solely responsible
 * for all trades executed through this agent.
 */

import { db } from '../../db';
import { fundingArbPositions, cexArbOpportunities } from '../../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import {
  fetchTicker, placeOrder, fetchPositions, fetchFundingRate,
  fetchBalance, type ExchangeCredentials
} from './exchange-connector';
import {
  loadExchangeCredentials, getArtistExchangeConfigs
} from './exchange-key-vault';
import {
  getLastOpportunities, type ArbitrageOpportunity
} from './funding-scanner';
import type { SupportedExchangeId } from './exchange-connector';

// ─── Risk Parameters ──────────────────────────────────────────────────────

/** Maximum fraction of USDT balance to deploy per position */
const MAX_POSITION_FRACTION = 0.20; // 20%

/** Maximum USD per side, absolute cap */
const MAX_POSITION_USD = 5000;

/** Minimum USD per side to make fees worthwhile */
const MIN_POSITION_USD = 50;

/** Close the position if annualized funding rate drops below this */
const MIN_FUNDING_RATE_TO_HOLD = 0.05; // 5% APR

/** Stop-loss: close if combined unrealized + fee loss exceeds this fraction of position */
const STOP_LOSS_PCT = 0.03; // −3% of notional

/** Maximum days to keep a position open (then force re-evaluation) */
const MAX_POSITION_DAYS = 7;

// ─── Position Execution ───────────────────────────────────────────────────

export interface FundingArbResult {
  artistId: number;
  exchangeId: string;
  symbol: string;
  action: 'opened' | 'closed' | 'monitored' | 'skipped' | 'error';
  reason?: string;
  spotOrderId?: string;
  perpOrderId?: string;
  sizeUsd?: number;
  estimatedAprPct?: number;
}

/**
 * Main entry point — called from economic-brain each cycle.
 * Finds the best opportunity for this artist, opens or monitors positions.
 */
export async function executeFundingArbCycle(
  artistId: number,
  allocationUsd: number
): Promise<FundingArbResult[]> {
  const results: FundingArbResult[] = [];

  // 1. Check artist has at least one active exchange config
  const exchangeConfigs = await getArtistExchangeConfigs(artistId);
  if (exchangeConfigs.length === 0) {
    return [{ artistId, exchangeId: 'none', symbol: 'none', action: 'skipped', reason: 'No exchange keys configured' }];
  }

  // 2. Monitor existing open positions
  const openPositions = await db
    .select()
    .from(fundingArbPositions)
    .where(
      and(
        eq(fundingArbPositions.artistId, artistId),
        eq(fundingArbPositions.status, 'open')
      )
    );

  for (const pos of openPositions) {
    const creds = await loadExchangeCredentials(artistId, pos.exchangeId as SupportedExchangeId, pos.isTestnet);
    if (!creds) continue;
    const monitorResult = await monitorPosition(artistId, pos, creds);
    results.push(monitorResult);
  }

  // 3. If we already have 3+ open positions, don't open more
  const stillOpen = openPositions.filter((p) => p.status === 'open');
  if (stillOpen.length >= 3) {
    results.push({ artistId, exchangeId: 'all', symbol: 'all', action: 'skipped', reason: 'Max concurrent positions reached (3)' });
    return results;
  }

  // 4. Look for new opportunities from the last scanner run
  const opportunities = getLastOpportunities();
  if (opportunities.length === 0) {
    results.push({ artistId, exchangeId: 'none', symbol: 'none', action: 'skipped', reason: 'No opportunities from last scan' });
    return results;
  }

  // 5. Try to open the best opportunity on any exchange the artist has keys for
  const configuredExchangeIds = new Set(exchangeConfigs.map((c) => c.exchangeId));

  for (const opp of opportunities) {
    if (!configuredExchangeIds.has(opp.exchangeId)) continue;
    // Skip if we already have this symbol open
    const alreadyOpen = stillOpen.some((p) => p.symbol === opp.symbol && p.exchangeId === opp.exchangeId);
    if (alreadyOpen) continue;

    const cfg = exchangeConfigs.find((c) => c.exchangeId === opp.exchangeId);
    if (!cfg) continue;
    const creds = await loadExchangeCredentials(artistId, opp.exchangeId as SupportedExchangeId, cfg.isTestnet);
    if (!creds) continue;

    const openResult = await openFundingArbPosition(artistId, creds, opp, allocationUsd);
    results.push(openResult);
    if (openResult.action === 'opened') break; // one new position per cycle
  }

  return results;
}

// ─── Open Position ────────────────────────────────────────────────────────

async function openFundingArbPosition(
  artistId: number,
  creds: ExchangeCredentials,
  opp: ArbitrageOpportunity,
  allocationUsd: number
): Promise<FundingArbResult> {
  try {
    // Check exchange balance
    const balance = await fetchBalance(artistId, creds);
    const availableUsd = Math.min(balance.usdtTotal, balance.usdcTotal + balance.usdtTotal);

    // Calculate position size: min of (allocation, max fraction of balance, absolute cap)
    const sizeUsd = Math.min(
      allocationUsd,
      availableUsd * MAX_POSITION_FRACTION,
      MAX_POSITION_USD
    );

    if (sizeUsd < MIN_POSITION_USD) {
      return {
        artistId, exchangeId: creds.exchangeId, symbol: opp.symbol,
        action: 'skipped', reason: `Insufficient balance: $${sizeUsd.toFixed(2)} < min $${MIN_POSITION_USD}`
      };
    }

    // Get current spot price to calculate base amount
    const spotSymbol = opp.baseSymbol + '/USDT';
    const ticker = await fetchTicker(artistId, creds, spotSymbol);
    const baseAmount = sizeUsd / ticker.last;

    // ── Spot BUY ──
    const spotOrder = await placeOrder(
      artistId, creds,
      spotSymbol, 'buy', 'market',
      baseAmount
    );

    // ── Perp SHORT ──
    const perpOrder = await placeOrder(
      artistId, creds,
      opp.symbol, 'sell', 'market',
      baseAmount
    );

    // Persist position to DB
    const currentRate = await fetchFundingRate(artistId, creds, opp.symbol);

    await db.insert(fundingArbPositions).values({
      artistId,
      exchangeId: creds.exchangeId,
      symbol: opp.symbol,
      spotSymbol,
      spotSizeUsd: String(sizeUsd),
      perpSizeUsd: String(sizeUsd),
      entryFundingRate: String(currentRate.fundingRate),
      currentFundingRate: String(currentRate.fundingRate),
      accumulatedFundingUsd: '0',
      estimatedApr: String(opp.grossAprPct),
      netPnlUsd: '0',
      status: 'open',
      isTestnet: creds.isTestnet,
      spotOrderId: spotOrder.orderId,
      perpOrderId: perpOrder.orderId,
    });

    console.log(
      `[FundingArb] Opened position: ${creds.exchangeId} ${opp.symbol} ` +
      `$${sizeUsd.toFixed(2)} @ ${(opp.grossAprPct).toFixed(2)}% APR`
    );

    return {
      artistId, exchangeId: creds.exchangeId, symbol: opp.symbol,
      action: 'opened',
      spotOrderId: spotOrder.orderId,
      perpOrderId: perpOrder.orderId,
      sizeUsd,
      estimatedAprPct: opp.grossAprPct,
    };
  } catch (err: any) {
    return {
      artistId, exchangeId: creds.exchangeId, symbol: opp.symbol,
      action: 'error', reason: err?.message ?? 'Unknown error'
    };
  }
}

// ─── Monitor / Close Position ──────────────────────────────────────────────

async function monitorPosition(
  artistId: number,
  pos: typeof fundingArbPositions.$inferSelect,
  creds: ExchangeCredentials
): Promise<FundingArbResult> {
  try {
    // Fetch current funding rate
    const current = await fetchFundingRate(artistId, creds, pos.symbol);
    const currentRate = current.fundingRate;
    const currentApr = current.annualizedRate;

    // Fetch perp position P&L
    const positions = await fetchPositions(artistId, creds, [pos.symbol]);
    const perpPos = positions.find((p) => p.symbol === pos.symbol);
    const unrealizedPnl = perpPos?.unrealizedPnl ?? 0;

    const spotSizeUsd = parseFloat(pos.spotSizeUsd);
    const stopLossThreshold = -spotSizeUsd * STOP_LOSS_PCT;

    // Check days open
    const daysOpen = (Date.now() - new Date(pos.openedAt).getTime()) / 86400000;

    let closeReason: string | null = null;
    if (currentApr < MIN_FUNDING_RATE_TO_HOLD) {
      closeReason = `Funding rate dropped to ${(currentApr * 100).toFixed(2)}% APR`;
    } else if (unrealizedPnl < stopLossThreshold) {
      closeReason = `Stop-loss triggered: P&L ${unrealizedPnl.toFixed(2)} USD`;
    } else if (daysOpen > MAX_POSITION_DAYS) {
      closeReason = `Max duration reached (${MAX_POSITION_DAYS} days)`;
    }

    if (closeReason) {
      await closePosition(artistId, pos, creds, closeReason, unrealizedPnl);
      return { artistId, exchangeId: creds.exchangeId, symbol: pos.symbol, action: 'closed', reason: closeReason };
    }

    // Update current rate and accumulated P&L
    const prevRate = parseFloat(pos.currentFundingRate);
    const accFunding = parseFloat(pos.accumulatedFundingUsd) + spotSizeUsd * (currentRate - prevRate);

    await db
      .update(fundingArbPositions)
      .set({
        currentFundingRate: String(currentRate),
        accumulatedFundingUsd: String(accFunding),
        netPnlUsd: String(unrealizedPnl + accFunding),
        updatedAt: new Date(),
      })
      .where(eq(fundingArbPositions.id, pos.id));

    return {
      artistId, exchangeId: creds.exchangeId, symbol: pos.symbol,
      action: 'monitored',
      estimatedAprPct: currentApr * 100,
    };
  } catch (err: any) {
    return { artistId, exchangeId: creds.exchangeId, symbol: pos.symbol, action: 'error', reason: err?.message };
  }
}

async function closePosition(
  artistId: number,
  pos: typeof fundingArbPositions.$inferSelect,
  creds: ExchangeCredentials,
  reason: string,
  finalPnl: number
): Promise<void> {
  try {
    // Close spot (sell) and perp (buy back)
    const ticker = await fetchTicker(artistId, creds, pos.spotSymbol);
    const baseAmount = parseFloat(pos.spotSizeUsd) / ticker.last;

    await placeOrder(artistId, creds, pos.spotSymbol, 'sell', 'market', baseAmount);
    await placeOrder(artistId, creds, pos.symbol, 'buy', 'market', baseAmount);

    await db
      .update(fundingArbPositions)
      .set({
        status: 'closed',
        closeReason: reason,
        netPnlUsd: String(finalPnl),
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(fundingArbPositions.id, pos.id));

    console.log(`[FundingArb] Closed ${pos.symbol} — ${reason}. P&L: $${finalPnl.toFixed(2)}`);
  } catch (err: any) {
    console.error(`[FundingArb] Failed to close position ${pos.id}:`, err?.message);
    await db
      .update(fundingArbPositions)
      .set({ status: 'error', closeReason: err?.message, updatedAt: new Date() })
      .where(eq(fundingArbPositions.id, pos.id));
  }
}

/** Manually close a specific position (admin override) */
export async function forceClosePosition(
  artistId: number,
  positionId: number,
  adminReason = 'Manual close by admin'
): Promise<FundingArbResult> {
  const [pos] = await db
    .select()
    .from(fundingArbPositions)
    .where(and(eq(fundingArbPositions.id, positionId), eq(fundingArbPositions.artistId, artistId)))
    .limit(1);

  if (!pos) return { artistId, exchangeId: 'unknown', symbol: 'unknown', action: 'error', reason: 'Position not found' };

  const creds = await loadExchangeCredentials(artistId, pos.exchangeId as SupportedExchangeId, pos.isTestnet);
  if (!creds) return { artistId, exchangeId: pos.exchangeId, symbol: pos.symbol, action: 'error', reason: 'No valid credentials' };

  await closePosition(artistId, pos, creds, adminReason, parseFloat(pos.netPnlUsd ?? '0'));
  return { artistId, exchangeId: pos.exchangeId, symbol: pos.symbol, action: 'closed', reason: adminReason };
}

/** Get all positions for an artist */
export async function getArtistPositions(artistId: number) {
  return db
    .select()
    .from(fundingArbPositions)
    .where(eq(fundingArbPositions.artistId, artistId))
    .orderBy(desc(fundingArbPositions.openedAt));
}
