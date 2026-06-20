/**
 * BOOSTIFY ECONOMIC ENGINE — CEX Exchange Connector
 * CCXT v4 multi-exchange wrapper for funding rate arbitrage & spot trading.
 *
 * Supported exchanges (NOT banned in USA):
 *   • Bybit    — derivatives leader, excellent funding rates
 *   • OKX      — OKX US available, deep perps liquidity
 *   • Kraken   — highest US compliance, Kraken Pro futures
 *   • Bitget   — available in USA, competitive funding rates
 *
 * ⚠️ RISK NOTICE: Trading perpetual futures carries substantial risk.
 * Funding rate arbitrage can lose money if rates flip, if there are
 * liquidation cascades, or if exchange-specific events occur.
 * Each artist operates with their OWN API keys and bears full
 * responsibility for their exchange accounts.
 */

// ─── Lazy CCXT Loader ───────────────────────────────────────────────────────
// CCXT is a 100 MB+ module. Loading it statically at import time hangs the
// server startup. Instead we load it on first use and cache the reference.
let _ccxtModule: any = null;
async function loadCcxt(): Promise<any> {
  if (!_ccxtModule) {
    const mod = await import('ccxt');
    _ccxtModule = (mod as any).default ?? mod;
  }
  return _ccxtModule;
}

// ─── Supported Exchange IDs ───────────────────────────────────────────────
export type SupportedExchangeId = 'bybit' | 'okx' | 'kraken' | 'bitget';

export const SUPPORTED_EXCHANGES: Record<SupportedExchangeId, {
  name: string;
  website: string;
  hasFunding: boolean;   // supports funding rate queries
  hasSpot: boolean;
  hasPerps: boolean;
  sandboxSupported: boolean;
  usaAvailable: boolean;
  setupGuideUrl: string;
}> = {
  bybit: {
    name: 'Bybit',
    website: 'https://www.bybit.com',
    hasFunding: true,
    hasSpot: true,
    hasPerps: true,
    sandboxSupported: true,
    usaAvailable: true,
    setupGuideUrl: 'https://bybit-exchange.github.io/docs/v5/intro',
  },
  okx: {
    name: 'OKX',
    website: 'https://www.okx.com',
    hasFunding: true,
    hasSpot: true,
    hasPerps: true,
    sandboxSupported: true,
    usaAvailable: true,
    setupGuideUrl: 'https://www.okx.com/docs-v5/en/',
  },
  kraken: {
    name: 'Kraken Pro',
    website: 'https://pro.kraken.com',
    hasFunding: true,
    hasSpot: true,
    hasPerps: true,
    sandboxSupported: false, // Kraken has no testnet for futures
    usaAvailable: true,
    setupGuideUrl: 'https://docs.kraken.com/rest/',
  },
  bitget: {
    name: 'Bitget',
    website: 'https://www.bitget.com',
    hasFunding: true,
    hasSpot: true,
    hasPerps: true,
    sandboxSupported: true,
    usaAvailable: true,
    setupGuideUrl: 'https://bitgetlimited.github.io/apidoc/en/mix/intro.html',
  },
};

// ─── Exchange Instance Cache ──────────────────────────────────────────────
const instanceCache = new Map<string, any>();

export interface ExchangeCredentials {
  exchangeId: SupportedExchangeId;
  apiKey: string;
  apiSecret: string;
  passphrase?: string; // OKX requires this
  isTestnet: boolean;
}

/** Build a cache key for a given artist + exchange + mode */
function cacheKey(artistId: number, exchangeId: string, testnet: boolean): string {
  return `${artistId}:${exchangeId}:${testnet ? 'test' : 'live'}`;
}

/** Create or return a cached CCXT exchange instance for an artist */
export async function getExchangeInstance(artistId: number, creds: ExchangeCredentials): Promise<any> {
  const key = cacheKey(artistId, creds.exchangeId, creds.isTestnet);
  if (instanceCache.has(key)) return instanceCache.get(key);

  const ccxt = await loadCcxt();
  const ExchangeClass = ccxt[creds.exchangeId];
  if (!ExchangeClass) throw new Error(`Exchange "${creds.exchangeId}" not found in CCXT`);

  const options: Record<string, any> = {
    apiKey: creds.apiKey,
    secret: creds.apiSecret,
    enableRateLimit: true,
    options: { defaultType: 'swap' }, // default to perpetual/swap market
  };

  if (creds.passphrase) options.password = creds.passphrase;

  const instance = new (ExchangeClass as any)(options);

  // Enable sandbox/testnet mode when requested and supported
  if (creds.isTestnet && SUPPORTED_EXCHANGES[creds.exchangeId]?.sandboxSupported) {
    instance.setSandboxMode(true);
  }

  instanceCache.set(key, instance);
  return instance;
}

/** Remove cached instance (call after key rotation / disconnection) */
export function evictExchangeInstance(artistId: number, exchangeId: string, testnet: boolean): void {
  instanceCache.delete(cacheKey(artistId, exchangeId, testnet));
}

// ─── Market Data ─────────────────────────────────────────────────────────

export interface FundingRateResult {
  exchangeId: string;
  symbol: string;          // e.g. BTC/USDT:USDT
  fundingRate: number;     // e.g. 0.0001 = 0.01%
  fundingTimestamp: number | null;
  nextFundingTime: number | null;
  annualizedRate: number;  // rate × 3 × 365 (assuming 8h intervals)
  intervalHours: number;   // most exchanges: 8h; some: 1h or 4h
}

/** Interval hours per exchange (default 8h) */
const FUNDING_INTERVALS: Record<SupportedExchangeId, number> = {
  bybit: 8,
  okx: 8,
  kraken: 4,
  bitget: 8,
};

export async function fetchFundingRate(
  artistId: number,
  creds: ExchangeCredentials,
  symbol: string // perpetual symbol, e.g. 'BTC/USDT:USDT'
): Promise<FundingRateResult> {
  const exchange = await getExchangeInstance(artistId, creds);
  const raw = await exchange.fetchFundingRate(symbol);
  const rate = typeof raw.fundingRate === 'number' ? raw.fundingRate : 0;
  const hours = FUNDING_INTERVALS[creds.exchangeId] ?? 8;
  const annualized = rate * (24 / hours) * 365;
  return {
    exchangeId: creds.exchangeId,
    symbol,
    fundingRate: rate,
    fundingTimestamp: raw.timestamp ?? null,
    nextFundingTime: raw.nextFundingDatetime ? new Date(raw.nextFundingDatetime).getTime() : null,
    annualizedRate: annualized,
    intervalHours: hours,
  };
}

/** Fetch funding rates for multiple symbols at once (no auth needed) */
export async function fetchPublicFundingRates(
  exchangeId: SupportedExchangeId,
  symbols: string[]
): Promise<FundingRateResult[]> {
  // Public endpoint — no API keys needed for reading funding rates
  const ccxt = await loadCcxt();
  const ExchangeClass = ccxt[exchangeId];
  if (!ExchangeClass) return [];
  const exchange = new (ExchangeClass as any)({ enableRateLimit: true });
  const results: FundingRateResult[] = [];
  const hours = FUNDING_INTERVALS[exchangeId] ?? 8;

  for (const symbol of symbols) {
    try {
      const raw = await exchange.fetchFundingRate(symbol);
      const rate = typeof raw.fundingRate === 'number' ? raw.fundingRate : 0;
      results.push({
        exchangeId,
        symbol,
        fundingRate: rate,
        fundingTimestamp: raw.timestamp ?? null,
        nextFundingTime: raw.nextFundingDatetime
          ? new Date(raw.nextFundingDatetime).getTime()
          : null,
        annualizedRate: rate * (24 / hours) * 365,
        intervalHours: hours,
      });
    } catch {
      // Symbol might not be listed on this exchange — skip silently
    }
  }
  return results;
}

// ─── Balance ─────────────────────────────────────────────────────────────

export interface BalanceSummary {
  total: Record<string, number>;
  free: Record<string, number>;
  used: Record<string, number>;
  usdtTotal: number;
  usdcTotal: number;
  totalUsdEquivalent: number; // approximated from USDT+USDC
}

export async function fetchBalance(artistId: number, creds: ExchangeCredentials): Promise<BalanceSummary> {
  const exchange = await getExchangeInstance(artistId, creds);
  const raw = await exchange.fetchBalance();
  const usdt = raw.total?.['USDT'] ?? 0;
  const usdc = raw.total?.['USDC'] ?? 0;
  return {
    total: raw.total ?? {},
    free: raw.free ?? {},
    used: raw.used ?? {},
    usdtTotal: usdt,
    usdcTotal: usdc,
    totalUsdEquivalent: usdt + usdc,
  };
}

// ─── Ticker ──────────────────────────────────────────────────────────────

export interface TickerResult {
  symbol: string;
  bid: number;
  ask: number;
  last: number;
  volume: number;
  timestamp: number;
}

export async function fetchTicker(
  artistId: number,
  creds: ExchangeCredentials,
  symbol: string
): Promise<TickerResult> {
  const exchange = await getExchangeInstance(artistId, creds);
  const raw = await exchange.fetchTicker(symbol);
  return {
    symbol,
    bid: raw.bid ?? 0,
    ask: raw.ask ?? 0,
    last: raw.last ?? 0,
    volume: raw.baseVolume ?? 0,
    timestamp: raw.timestamp ?? Date.now(),
  };
}

// ─── Orders ──────────────────────────────────────────────────────────────

export type OrderSide = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';

export interface PlaceOrderResult {
  orderId: string;
  symbol: string;
  side: OrderSide;
  type: OrderType;
  amount: number;
  price: number | null;
  status: string;
  timestamp: number;
}

/**
 * Place a spot or perp order.
 * For perps, symbol must be 'BTC/USDT:USDT' format.
 * For spot, symbol is 'BTC/USDT'.
 */
export async function placeOrder(
  artistId: number,
  creds: ExchangeCredentials,
  symbol: string,
  side: OrderSide,
  type: OrderType,
  amountBase: number,     // in base currency (e.g. BTC amount)
  price?: number          // required for limit orders
): Promise<PlaceOrderResult> {
  const exchange = await getExchangeInstance(artistId, creds);
  const raw = await exchange.createOrder(symbol, type, side, amountBase, price);
  return {
    orderId: String(raw.id),
    symbol,
    side,
    type,
    amount: raw.amount ?? amountBase,
    price: raw.price ?? null,
    status: raw.status ?? 'open',
    timestamp: raw.timestamp ?? Date.now(),
  };
}

/** Cancel an open order */
export async function cancelOrder(
  artistId: number,
  creds: ExchangeCredentials,
  orderId: string,
  symbol: string
): Promise<void> {
  const exchange = await getExchangeInstance(artistId, creds);
  await exchange.cancelOrder(orderId, symbol);
}

// ─── Positions ───────────────────────────────────────────────────────────

export interface PositionResult {
  symbol: string;
  side: 'long' | 'short' | 'both';
  contracts: number;
  notional: number;        // USD value
  unrealizedPnl: number;
  percentage: number | null;
  entryPrice: number;
  liquidationPrice: number | null;
  leverage: number;
  marginMode: string;
}

export async function fetchPositions(
  artistId: number,
  creds: ExchangeCredentials,
  symbols?: string[]
): Promise<PositionResult[]> {
  const exchange = await getExchangeInstance(artistId, creds);
  const raw = await exchange.fetchPositions(symbols);
  return (raw as any[])
    .filter((p: any) => p.contracts && p.contracts !== 0)
    .map((p: any) => ({
      symbol: p.symbol,
      side: p.side ?? 'both',
      contracts: p.contracts ?? 0,
      notional: p.notional ?? 0,
      unrealizedPnl: p.unrealizedPnl ?? 0,
      percentage: p.percentage ?? null,
      entryPrice: p.entryPrice ?? 0,
      liquidationPrice: p.liquidationPrice ?? null,
      leverage: p.leverage ?? 1,
      marginMode: p.marginMode ?? 'cross',
    }));
}

// ─── Connection Test (verify API keys are valid) ─────────────────────────

export interface VerifyResult {
  success: boolean;
  exchangeId: string;
  isTestnet: boolean;
  usdtBalance?: number;
  permissions?: string[];
  errorMessage?: string;
}

export async function verifyConnection(
  artistId: number,
  creds: ExchangeCredentials
): Promise<VerifyResult> {
  try {
    const exchange = await getExchangeInstance(artistId, creds);
    const balance = await exchange.fetchBalance();
    const usdt = balance.total?.['USDT'] ?? 0;

    // Detect permissions from the exchange response header / balance call
    const permissions: string[] = ['read'];
    if (usdt !== undefined) permissions.push('trade');

    return {
      success: true,
      exchangeId: creds.exchangeId,
      isTestnet: creds.isTestnet,
      usdtBalance: usdt,
      permissions,
    };
  } catch (err: any) {
    // Evict the bad instance from cache
    evictExchangeInstance(artistId, creds.exchangeId, creds.isTestnet);
    return {
      success: false,
      exchangeId: creds.exchangeId,
      isTestnet: creds.isTestnet,
      errorMessage: err?.message ?? 'Unknown error',
    };
  }
}
