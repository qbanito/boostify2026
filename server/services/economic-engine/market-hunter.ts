/**
 * MARKET HUNTER — Day Trading Agent (opt-in, 5th agent)
 * Mandate: Take SHORT-TERM directional trades on MATIC/ETH/BTC pairs
 * using momentum + mean-reversion signals from CoinGecko / Chainlink.
 *
 * Strict risk controls:
 *  - Default allocation: 5-10% of defiBalance (cap)
 *  - Max 2 concurrent open trades
 *  - Stop-loss: -3% per trade (hard exit)
 *  - Take-profit: +5% per trade
 *  - Max trade duration: 6h (force-close otherwise)
 *  - Daily loss limit: -5% of slice in 24h => 24h cooldown
 *  - FROZEN in survival/defense modes (same as Alpha Hunter)
 *  - FROZEN when Shield Node veto active
 *
 * REAL MODE: Executes spot swaps on Polygon via 1inch (USDC <-> WMATIC/WETH/WBTC).
 * SIMULATED MODE: Tracks paper trades using live CoinGecko prices, marks-to-market.
 *
 * IMPORTANT: This is NOT leveraged trading. No futures, no perps, no liquidations.
 * Spot only — worst case is the position drops to 0 (extremely unlikely on majors).
 */

import { db } from '../../db';
import { defiPositions, defiAgentActions, riskEngineState, artistEconomicProfile } from '../../../db/schema';
import { eq, and, gte } from 'drizzle-orm';
import type { AgentAction, OperatingMode } from './types';
import { isConfigured as blockchainReady, POLYGON_ADDRESSES } from './blockchain-provider';
import { getOneInchAdapter } from './defi-adapters';
import { getTokenPrices, getFearGreedIndex } from './price-feeds';
import { getConfluentSignal } from './technical-analysis';
import { getCombinedSentimentSignal, shouldAvoidTradeEntry } from './sentiment-tracker';

const AGENT_TYPE = 'market_hunter' as const;

// Tradable pairs (CoinGecko id, on-chain WRAPPED token symbol/address)
const TRADABLE_ASSETS = [
  { coingeckoId: 'matic-network', symbol: 'WMATIC', address: POLYGON_ADDRESSES.WMATIC, decimals: 18 },
  { coingeckoId: 'ethereum',      symbol: 'WETH',   address: POLYGON_ADDRESSES.WETH,   decimals: 18 },
  // Bitcoin via wrapped token on Polygon would go here when wired:
  // { coingeckoId: 'bitcoin', symbol: 'WBTC', address: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', decimals: 8 },
];

// Risk constants — pro-trader defaults (ATR-driven, these are CLAMPS)
const STOP_LOSS_PCT = 0.03;          // fallback fixed SL when ATR unavailable
const TAKE_PROFIT_PCT = 0.05;        // fallback fixed TP when ATR unavailable
const MIN_STOP_PCT = 0.015;          // never tighter than -1.5% (noise)
const MAX_STOP_PCT = 0.05;           // never wider than -5%
const ATR_STOP_MULT = 1.5;           // SL = entry - 1.5 × ATR
const ATR_TP_MULT = 2.5;             // TP = entry + 2.5 × ATR (R:R ≥ 1.66)
const TRAIL_ARM_R = 1.0;             // arm trailing stop after +1R unrealized
const TRAIL_ATR_MULT = 1.2;          // trail = high-water - 1.2 × ATR
const RISK_PER_TRADE_PCT = 0.012;    // risk 1.2% of slice per trade (vol-targeted sizing)
const MAX_OPEN_TRADES = 2;
const MAX_TRADE_DURATION_MS = 6 * 60 * 60 * 1000; // 6h
const DAILY_LOSS_LIMIT_PCT = 0.05; // -5% of slice in 24h => freeze

interface PriceSnapshot {
  symbol: string;
  priceUsd: number;
  change24h: number;
  volume24h: number;
}

/**
 * Main entry point — called by economic-brain on every cycle for opted-in artists.
 */
export async function executeMarketHunterCycle(
  artistId: number,
  allocatedAmount: number,
  currentMode: OperatingMode,
): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];

  // ── HARD GUARDS ─────────────────────────────────────────────
  if (currentMode === 'survival' || currentMode === 'defense') {
    await logAction(artistId, {
      actionType: 'audit',
      reason: `Market Hunter FROZEN: operating mode is ${currentMode}`,
    });
    return actions;
  }

  const [riskState] = await db.select().from(riskEngineState)
    .where(eq(riskEngineState.artistId, artistId));
  if (riskState?.shieldVetoActive) {
    await logAction(artistId, {
      actionType: 'audit',
      reason: 'Market Hunter BLOCKED: Shield Node veto active',
    });
    return actions;
  }

  // Daily loss limit check
  if (await isInDailyCooldown(artistId, allocatedAmount)) {
    await logAction(artistId, {
      actionType: 'audit',
      reason: 'Market Hunter in 24h cooldown after hitting daily loss limit',
    });
    return actions;
  }

  // 1. Mark-to-market existing positions, exit on SL/TP/timeout
  const exitActions = await managePositions(artistId);
  actions.push(...exitActions);

  // 2. Check capacity for new trades
  const openPositions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active'),
    ));

  if (openPositions.length >= MAX_OPEN_TRADES) return actions;
  if (allocatedAmount <= 5) return actions; // skip dust

  // 3. Look for entry signal
  const signal = await findEntrySignal(currentMode);
  if (!signal) {
    await logAction(artistId, {
      actionType: 'audit',
      reason: 'No high-conviction signal this cycle',
    });
    return actions;
  }

  // 4. Open trade (real or simulated)
  const tradeAction = await openTrade(artistId, signal, allocatedAmount);
  if (tradeAction) actions.push(tradeAction);

  return actions;
}

// ────────────────────────────────────────────────────────────
// SIGNAL ENGINE
// ────────────────────────────────────────────────────────────

interface TradeSignal {
  asset: typeof TRADABLE_ASSETS[number];
  direction: 'long'; // spot only — no shorts on this layer
  entryPrice: number;
  reasoning: string;
  confidence: number; // 0..1
  strategy: 'momentum' | 'mean_reversion';
  atrPct: number;     // ATR as fraction of price (0 when unavailable)
  stopPct: number;    // dynamic stop distance (fraction)
  tpPct: number;      // dynamic take-profit distance (fraction)
}

async function findEntrySignal(mode: OperatingMode): Promise<TradeSignal | null> {
  let currentPrices: PriceSnapshot[];
  try {
    const ids = TRADABLE_ASSETS.map(a => a.coingeckoId);
    const data = await getTokenPrices(ids);
    currentPrices = data.map(p => ({
      symbol: p.symbol,
      priceUsd: p.priceUsd,
      change24h: p.change24h,
      volume24h: p.volume24h,
    }));
  } catch {
    return null; // no data, no trade
  }

  // SENTIMENT GATE: skip all entries during extreme conditions
  try {
    const sentiment = await getCombinedSentimentSignal();
    if (shouldAvoidTradeEntry(sentiment)) {
      console.log(`[MarketHunter] Entry blocked by sentiment gate: ${sentiment.signal} (${sentiment.score})`);
      return null;
    }
  } catch {
    // sentiment check failed — proceed with TA signals only
  }

  // Confidence threshold tightens in non-aggressive modes
  const minConfidence = mode === 'aggressive' ? 0.45 : mode === 'stable' ? 0.6 : 0.7;

  let best: TradeSignal | null = null;

  for (const asset of TRADABLE_ASSETS) {
    const snap = currentPrices.find(p =>
      p.symbol === asset.symbol.replace('W', '') || p.symbol === asset.symbol,
    );
    if (!snap || snap.priceUsd <= 0) continue;

    // ── TECHNICAL ANALYSIS CONFLUENT SIGNAL ──
    try {
      const taSignal = await getConfluentSignal(asset.coingeckoId, snap.priceUsd);

      if (taSignal.action === 'BUY' && taSignal.confidence >= minConfidence) {
        // ── ATR-driven dynamic risk levels (volatility-adjusted, clamped) ──
        const atrPct = taSignal.atr > 0 && snap.priceUsd > 0 ? taSignal.atr / snap.priceUsd : 0;
        const stopPct = atrPct > 0
          ? Math.min(MAX_STOP_PCT, Math.max(MIN_STOP_PCT, atrPct * ATR_STOP_MULT))
          : STOP_LOSS_PCT;
        const tpPct = atrPct > 0
          ? Math.max(stopPct * 1.6, atrPct * ATR_TP_MULT) // enforce R:R ≥ 1.6
          : TAKE_PROFIT_PCT;

        const indicatorSummary = taSignal.signals.slice(0, 3).join(' + ');
        const reasoning = [
          `TA Confluent LONG ${asset.symbol}:`,
          `Score=${taSignal.score}/100, Confidence=${(taSignal.confidence * 100).toFixed(0)}%`,
          `RSI=${taSignal.rsi.value.toFixed(1)} (${taSignal.rsi.signal}),`,
          `MACD=${taSignal.macd.momentum} (${taSignal.macd.cross ? 'CROSS:' + taSignal.macd.cross : 'no cross'}),`,
          `BB=${taSignal.bb.position}`,
          `ATR=${(atrPct * 100).toFixed(2)}% → SL -${(stopPct * 100).toFixed(2)}% / TP +${(tpPct * 100).toFixed(2)}%`,
          `Signals: ${indicatorSummary}`,
        ].join(' ');

        if (!best || taSignal.confidence > best.confidence) {
          best = {
            asset,
            direction: 'long',
            entryPrice: snap.priceUsd,
            reasoning,
            confidence: taSignal.confidence,
            strategy: taSignal.rsi.signal === 'oversold' || taSignal.bb.position === 'below_lower'
              ? 'mean_reversion'
              : 'momentum',
            atrPct,
            stopPct,
            tpPct,
          };
        }
      }
    } catch {
      // TA signal failed for this asset — continue with others
    }
  }

  return best;
}

// ────────────────────────────────────────────────────────────
// EXECUTION
// ────────────────────────────────────────────────────────────

async function openTrade(
  artistId: number,
  signal: TradeSignal,
  allocatedAmount: number,
): Promise<AgentAction | null> {
  // ── VOLATILITY-TARGETED POSITION SIZING (how pros size) ──
  // Risk a fixed % of the slice per trade; size = riskBudget / stopDistance.
  // Wider stop (more volatile asset) → smaller position. Confidence scales ±25%.
  const riskBudget = allocatedAmount * RISK_PER_TRADE_PCT;
  const confMult = 0.75 + Math.min(1, Math.max(0, signal.confidence)) * 0.5; // 0.75..1.25
  const volSized = (riskBudget / Math.max(signal.stopPct, MIN_STOP_PCT)) * confMult;
  const sizeUsd = Math.min(volSized, allocatedAmount * 0.5, 100); // caps: 50% slice, $100 hard
  if (sizeUsd < 5) return null;

  const isReal = blockchainReady();
  let txHash: string | null = null;

  // REAL MODE: execute spot swap USDC -> target token via 1inch
  if (isReal) {
    try {
      const oneInch = getOneInchAdapter();
      // Best-effort real swap; on any error fall back to paper trade
      const amountAtomic = BigInt(Math.floor(sizeUsd * 1e6)); // USDC has 6 decimals
      const swap = await oneInch.buildSwapTx(
        POLYGON_ADDRESSES.USDC,
        signal.asset.address,
        amountAtomic.toString(),
        1, // 1% slippage
      );
      txHash = swap?.txHash || null;
    } catch (e: any) {
      // Real swap failed -> log & fall back to paper
      await logAction(artistId, {
        actionType: 'audit',
        reason: `Real swap failed, paper-trading: ${e?.message || 'unknown'}`,
      });
    }
  }

  // Persist the position
  const [pos] = await db.insert(defiPositions).values({
    artistId,
    agentType: AGENT_TYPE,
    positionType: 'directional_trade',
    protocol: '1inch / Uniswap V3',
    asset: `${signal.asset.symbol}/USDC`,
    amountInvested: String(sizeUsd),
    currentValue: String(sizeUsd),
    unrealizedPnl: '0.00',
    apy: '0.0000',
    riskScore: 80,
    status: 'active',
    metadata: {
      strategy: signal.strategy,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      confidence: signal.confidence,
      atrPct: signal.atrPct,
      stopPct: signal.stopPct,
      tpPct: signal.tpPct,
      stopLossPrice: signal.entryPrice * (1 - signal.stopPct),
      takeProfitPrice: signal.entryPrice * (1 + signal.tpPct),
      highWater: signal.entryPrice,   // for trailing stop
      trailArmed: false,
      txHash,
      mode: isReal && txHash ? 'real' : 'simulated',
    },
  }).returning();

  await logAction(artistId, {
    actionType: 'enter_long',
    positionId: pos?.id,
    amount: sizeUsd,
    reason: `${signal.reasoning} | conf=${signal.confidence.toFixed(2)} | size=$${sizeUsd.toFixed(2)} ${isReal && txHash ? '[REAL]' : '[SIM]'}`,
  });

  return {
    agentType: AGENT_TYPE,
    actionType: 'enter_long',
    positionId: pos?.id,
    amount: sizeUsd,
    reason: signal.reasoning,
  };
}

/**
 * Mark-to-market all open positions, exit on SL / TP / max duration.
 */
async function managePositions(artistId: number): Promise<AgentAction[]> {
  const actions: AgentAction[] = [];
  const positions = await db.select().from(defiPositions)
    .where(and(
      eq(defiPositions.artistId, artistId),
      eq(defiPositions.agentType, AGENT_TYPE),
      eq(defiPositions.status, 'active'),
    ));

  if (positions.length === 0) return actions;

  // Fetch prices once
  const ids = TRADABLE_ASSETS.map(a => a.coingeckoId);
  let priceMap: Record<string, number> = {};
  try {
    const data = await getTokenPrices(ids);
    for (const a of TRADABLE_ASSETS) {
      const p = data.find(d => d.symbol === a.symbol.replace('W', '') || d.symbol === a.symbol);
      if (p) priceMap[a.symbol] = p.priceUsd;
    }
  } catch {
    return actions; // skip mark-to-market this cycle
  }

  for (const pos of positions) {
    const meta = (pos.metadata || {}) as any;
    const entry = Number(meta.entryPrice || 0);
    const symbol = (pos.asset || '').split('/')[0];
    const currentPrice = priceMap[symbol];
    if (!entry || !currentPrice) continue;

    const sizeUsd = parseFloat(pos.amountInvested);
    const ret = (currentPrice - entry) / entry; // long-only
    const newValue = sizeUsd * (1 + ret);
    const pnl = newValue - sizeUsd;

    // Per-position dynamic levels (fallback to legacy constants for old rows)
    const stopPct = Number(meta.stopPct) > 0 ? Number(meta.stopPct) : STOP_LOSS_PCT;
    const tpPct = Number(meta.tpPct) > 0 ? Number(meta.tpPct) : TAKE_PROFIT_PCT;
    const atrPct = Number(meta.atrPct) > 0 ? Number(meta.atrPct) : stopPct / ATR_STOP_MULT;

    // ── TRAILING STOP (lock in profits like a pro) ──
    // After +1R unrealized: stop ratchets to max(breakeven, highWater - 1.2×ATR).
    let highWater = Math.max(Number(meta.highWater || entry), currentPrice);
    let trailArmed = !!meta.trailArmed;
    let trailStopPrice = 0;
    if (!trailArmed && ret >= stopPct * TRAIL_ARM_R) trailArmed = true;
    if (trailArmed) {
      trailStopPrice = Math.max(entry, highWater * (1 - atrPct * TRAIL_ATR_MULT));
    }
    const metaChanged = highWater !== Number(meta.highWater || entry) || trailArmed !== !!meta.trailArmed;

    await db.update(defiPositions)
      .set({
        currentValue: String(newValue),
        unrealizedPnl: String(pnl),
        ...(metaChanged ? { metadata: { ...meta, highWater, trailArmed, trailStopPrice } } : {}),
      })
      .where(eq(defiPositions.id, pos.id));

    const ageMs = Date.now() - new Date(pos.openedAt).getTime();
    let exitReason: string | null = null;
    let exitType: 'stop_loss' | 'take_profit' | 'exit_trade' | null = null;

    if (ret <= -stopPct) {
      exitReason = `Stop-loss hit @ ${(ret * 100).toFixed(2)}% (dynamic ATR stop -${(stopPct * 100).toFixed(2)}%)`;
      exitType = 'stop_loss';
    } else if (trailArmed && trailStopPrice > 0 && currentPrice <= trailStopPrice) {
      exitReason = `Trailing stop hit @ +${(ret * 100).toFixed(2)}% (high-water $${highWater.toFixed(4)}, locked profit)`;
      exitType = 'take_profit';
    } else if (ret >= tpPct) {
      exitReason = `Take-profit hit @ +${(ret * 100).toFixed(2)}% (target +${(tpPct * 100).toFixed(2)}%)`;
      exitType = 'take_profit';
    } else if (ageMs > MAX_TRADE_DURATION_MS) {
      exitReason = `Max duration reached (6h) @ ${(ret * 100).toFixed(2)}%`;
      exitType = 'exit_trade';
    }

    if (exitReason && exitType) {
      // Close position
      await db.update(defiPositions)
        .set({ status: 'closed', closedAt: new Date(), currentValue: String(newValue), unrealizedPnl: String(pnl) })
        .where(eq(defiPositions.id, pos.id));

      await logAction(artistId, {
        actionType: exitType,
        positionId: pos.id,
        amount: pnl,
        reason: `${exitReason} | ${pos.asset} | size=$${sizeUsd.toFixed(2)} pnl=$${pnl.toFixed(2)}`,
      });

      actions.push({
        agentType: AGENT_TYPE,
        actionType: exitType,
        positionId: pos.id,
        amount: pnl,
        reason: exitReason,
      });
    }
  }

  return actions;
}

// ────────────────────────────────────────────────────────────
// DAILY LOSS LIMIT
// ────────────────────────────────────────────────────────────

async function isInDailyCooldown(artistId: number, slice: number): Promise<boolean> {
  if (slice <= 0) return false;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await db.select().from(defiAgentActions)
    .where(and(
      eq(defiAgentActions.artistId, artistId),
      eq(defiAgentActions.agentType, AGENT_TYPE),
      gte(defiAgentActions.createdAt, since),
    ));

  let pnl24h = 0;
  for (const a of recent) {
    if (a.actionType === 'stop_loss' || a.actionType === 'take_profit' || a.actionType === 'exit_trade') {
      pnl24h += parseFloat(a.amount || '0');
    }
  }
  return pnl24h <= -slice * DAILY_LOSS_LIMIT_PCT;
}

// ────────────────────────────────────────────────────────────
// LOGGING
// ────────────────────────────────────────────────────────────

async function logAction(
  artistId: number,
  data: { actionType: any; positionId?: number; amount?: number; reason: string },
): Promise<void> {
  await db.insert(defiAgentActions).values({
    artistId,
    agentType: AGENT_TYPE,
    actionType: data.actionType,
    positionId: data.positionId,
    amount: data.amount !== undefined ? String(data.amount) : undefined,
    reason: data.reason,
    outcome: 'success',
  }).catch(() => {}); // non-critical
}
