/**
 * BOOSTIFY ECONOMIC ENGINE — DeFi Protocol Adapters
 * Real integrations with Aave V3, Uniswap V3, 1inch
 * Replaces all simulated DeFi interactions
 */

import { ethers } from 'ethers';
import { getProvider, getSigner, POLYGON_ADDRESSES } from './blockchain-provider';
import { getWalletManager } from './wallet-manager';

// ============================================
// AAVE V3 ADAPTER (Polygon)
// ============================================

const AAVE_POOL_ABI = [
  'function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)',
  'function withdraw(address asset, uint256 amount, address to) returns (uint256)',
  'function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
];

const AAVE_DATA_PROVIDER_ABI = [
  'function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)',
  'function getReserveData(address asset) view returns (uint256 unbacked, uint256 accruedToTreasuryScaled, uint256 totalAToken, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)',
];

export class AaveV3Adapter {
  private pool: ethers.Contract;
  private dataProvider: ethers.Contract;

  constructor() {
    const signer = getSigner();
    this.pool = new ethers.Contract(POLYGON_ADDRESSES.AAVE_V3_POOL, AAVE_POOL_ABI, signer);
    this.dataProvider = new ethers.Contract(
      POLYGON_ADDRESSES.AAVE_V3_POOL_DATA_PROVIDER,
      AAVE_DATA_PROVIDER_ABI,
      getProvider()
    );
  }

  /** Supply USDC to Aave V3 lending pool */
  async supplyUSDC(amountRaw: bigint): Promise<{ txHash: string; amountSupplied: string }> {
    const wallet = getWalletManager();
    await wallet.ensureAllowance(POLYGON_ADDRESSES.USDC, POLYGON_ADDRESSES.AAVE_V3_POOL, amountRaw);

    const tx = await this.pool.supply(
      POLYGON_ADDRESSES.USDC,
      amountRaw,
      wallet.address,
      0 // referral code
    );
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      amountSupplied: ethers.formatUnits(amountRaw, 6),
    };
  }

  /** Withdraw USDC from Aave V3 */
  async withdrawUSDC(amountRaw: bigint): Promise<{ txHash: string; amountWithdrawn: string }> {
    const wallet = getWalletManager();
    const tx = await this.pool.withdraw(POLYGON_ADDRESSES.USDC, amountRaw, wallet.address);
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      amountWithdrawn: ethers.formatUnits(amountRaw, 6),
    };
  }

  /** Get current Aave position for wallet */
  async getPosition(): Promise<{
    deposited: string;
    earned: string;
    apy: number;
    healthFactor: string;
  }> {
    const wallet = getWalletManager();
    const [userData, reserveData] = await Promise.all([
      this.dataProvider.getUserReserveData(POLYGON_ADDRESSES.USDC, wallet.address),
      this.dataProvider.getReserveData(POLYGON_ADDRESSES.USDC),
    ]);

    const deposited = ethers.formatUnits(userData.currentATokenBalance, 6);
    // APY from liquidity rate (ray = 1e27)
    const liquidityRateRay = Number(reserveData.liquidityRate);
    const apy = (liquidityRateRay / 1e27) * 100;

    return {
      deposited,
      earned: '0', // Would need to track principal separately
      apy: Math.round(apy * 100) / 100,
      healthFactor: 'N/A', // No borrows
    };
  }

  /** Get current supply APY for USDC */
  async getSupplyAPY(): Promise<number> {
    const reserveData = await this.dataProvider.getReserveData(POLYGON_ADDRESSES.USDC);
    const liquidityRateRay = Number(reserveData.liquidityRate);
    return (liquidityRateRay / 1e27) * 100;
  }
}

// ============================================
// UNISWAP V3 ADAPTER (Polygon)
// ============================================

const UNISWAP_ROUTER_ABI = [
  'function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)',
];

const UNISWAP_QUOTER_ABI = [
  'function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) returns (uint256 amountOut)',
];

const UNISWAP_FACTORY_ABI = [
  'function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)',
];

export class UniswapV3Adapter {
  private router: ethers.Contract;
  private quoter: ethers.Contract;
  private factory: ethers.Contract;

  constructor() {
    const signer = getSigner();
    this.router = new ethers.Contract(POLYGON_ADDRESSES.UNISWAP_V3_ROUTER, UNISWAP_ROUTER_ABI, signer);
    this.quoter = new ethers.Contract(POLYGON_ADDRESSES.UNISWAP_V3_QUOTER, UNISWAP_QUOTER_ABI, getProvider());
    this.factory = new ethers.Contract(POLYGON_ADDRESSES.UNISWAP_V3_FACTORY, UNISWAP_FACTORY_ABI, getProvider());
  }

  /** Get a swap quote */
  async getQuote(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    fee: number = 3000
  ): Promise<{ amountOut: bigint; priceImpact: number }> {
    const amountOut = await this.quoter.quoteExactInputSingle.staticCall(
      tokenIn,
      tokenOut,
      fee,
      amountIn,
      0
    );
    return { amountOut, priceImpact: 0 }; // Price impact needs deeper calculation
  }

  /** Execute a swap */
  async swap(
    tokenIn: string,
    tokenOut: string,
    amountIn: bigint,
    minAmountOut: bigint,
    fee: number = 3000
  ): Promise<{ txHash: string; amountOut: string }> {
    const wallet = getWalletManager();
    await wallet.ensureAllowance(tokenIn, POLYGON_ADDRESSES.UNISWAP_V3_ROUTER, amountIn);

    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 min deadline
    const tx = await this.router.exactInputSingle({
      tokenIn,
      tokenOut,
      fee,
      recipient: wallet.address,
      deadline,
      amountIn,
      amountOutMinimum: minAmountOut,
      sqrtPriceLimitX96: 0,
    });
    const receipt = await tx.wait();
    return {
      txHash: receipt.hash,
      amountOut: minAmountOut.toString(), // Actual amount from event logs
    };
  }

  /** Check if a pool exists */
  async poolExists(tokenA: string, tokenB: string, fee: number = 3000): Promise<string | null> {
    const pool = await this.factory.getPool(tokenA, tokenB, fee);
    return pool === ethers.ZeroAddress ? null : pool;
  }
}

// ============================================
// 1INCH AGGREGATOR ADAPTER
// ============================================

const ONEINCH_BASE = 'https://api.1inch.dev/swap/v6.0/137'; // Polygon chain ID

export class OneInchAdapter {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ONEINCH_API_KEY || '';
  }

  private async apiFetch(path: string): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers['Authorization'] = `Bearer ${this.apiKey}`;

    const res = await fetch(`${ONEINCH_BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`1inch API error: ${res.status}`);
    return res.json();
  }

  /** Get best swap quote across all DEXes */
  async getQuote(
    fromToken: string,
    toToken: string,
    amount: string
  ): Promise<{
    toAmount: string;
    estimatedGas: number;
    protocols: string[];
  }> {
    const data = await this.apiFetch(
      `/quote?src=${fromToken}&dst=${toToken}&amount=${amount}`
    );
    return {
      toAmount: data.toAmount || '0',
      estimatedGas: data.gas || 0,
      protocols: (data.protocols?.[0] || []).map((p: any) => p[0]?.name || ''),
    };
  }

  /** Build and execute a swap transaction via 1inch */
  async buildSwapTx(
    fromToken: string,
    toToken: string,
    amount: string,
    slippage: number = 1
  ): Promise<{
    txHash: string;
    toAmount: string;
  }> {
    const wallet = getWalletManager();
    const data = await this.apiFetch(
      `/swap?src=${fromToken}&dst=${toToken}&amount=${amount}&from=${wallet.address}&slippage=${slippage}`
    );

    const signer = getSigner();
    const tx = await signer.sendTransaction({
      to: data.tx.to,
      data: data.tx.data,
      value: data.tx.value ? BigInt(data.tx.value) : 0n,
      gasLimit: BigInt(data.tx.gas || 500000),
    });
    const receipt = await tx.wait();
    return {
      txHash: receipt?.hash || '',
      toAmount: data.toAmount || '0',
    };
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}

// ============================================
// TRANSACTION SIMULATOR (Tenderly)
// ============================================

export class TransactionSimulator {
  private accessKey: string;
  private accountSlug: string;
  private projectSlug: string;

  constructor() {
    this.accessKey = process.env.TENDERLY_ACCESS_KEY || '';
    this.accountSlug = process.env.TENDERLY_ACCOUNT_SLUG || '';
    this.projectSlug = process.env.TENDERLY_PROJECT_SLUG || '';
  }

  /** Simulate a transaction before executing it */
  async simulate(tx: {
    from: string;
    to: string;
    data: string;
    value?: string;
  }): Promise<{
    success: boolean;
    gasUsed: number;
    error?: string;
  }> {
    if (!this.accessKey) {
      // If Tenderly not configured, skip simulation
      return { success: true, gasUsed: 0 };
    }

    const res = await fetch(
      `https://api.tenderly.co/api/v1/account/${this.accountSlug}/project/${this.projectSlug}/simulate`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Access-Key': this.accessKey,
        },
        body: JSON.stringify({
          network_id: '137', // Polygon
          from: tx.from,
          to: tx.to,
          input: tx.data,
          value: tx.value || '0',
          save: false,
        }),
      }
    );

    if (!res.ok) return { success: false, gasUsed: 0, error: 'Simulation failed' };
    const data = await res.json();
    return {
      success: data.transaction?.status === true,
      gasUsed: data.transaction?.gas_used || 0,
      error: data.transaction?.error_message,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.accessKey && this.accountSlug && this.projectSlug);
  }
}

// ============================================
// 0x PROTOCOL ADAPTER (Polygon)
// ============================================

const ZEROX_BASE = 'https://polygon.api.0x.org';

export class ZeroXAdapter {
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.ZEROX_API_KEY || '';
  }

  private async apiFetch(path: string): Promise<any> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.apiKey) headers['0x-api-key'] = this.apiKey;

    const res = await fetch(`${ZEROX_BASE}${path}`, { headers });
    if (!res.ok) throw new Error(`0x API error: ${res.status}`);
    return res.json();
  }

  /** Get swap quote from 0x aggregator */
  async getQuote(
    sellToken: string,
    buyToken: string,
    sellAmount: string
  ): Promise<{ buyAmount: string; estimatedGas: number; sources: string[] }> {
    const data = await this.apiFetch(
      `/swap/v1/quote?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`
    );
    return {
      buyAmount: data.buyAmount || '0',
      estimatedGas: parseInt(data.estimatedGas || '0'),
      sources: (data.sources || []).filter((s: any) => parseFloat(s.proportion) > 0).map((s: any) => s.name),
    };
  }

  /** Get price (no tx data, lighter) */
  async getPrice(
    sellToken: string,
    buyToken: string,
    sellAmount: string
  ): Promise<{ buyAmount: string; estimatedGas: number }> {
    const data = await this.apiFetch(
      `/swap/v1/price?sellToken=${sellToken}&buyToken=${buyToken}&sellAmount=${sellAmount}`
    );
    return {
      buyAmount: data.buyAmount || '0',
      estimatedGas: parseInt(data.estimatedGas || '0'),
    };
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey);
  }
}

// ============================================
// PARASWAP ADAPTER (Polygon)
// ============================================

const PARASWAP_BASE = 'https://apiv5.paraswap.io';

export class ParaSwapAdapter {
  /** Get swap price from ParaSwap (no API key needed) */
  async getPrice(
    srcToken: string,
    destToken: string,
    amount: string,
    srcDecimals: number = 6,
    destDecimals: number = 18
  ): Promise<{ destAmount: string; estimatedGas: number; bestRoute: string }> {
    const params = new URLSearchParams({
      srcToken,
      destToken,
      amount,
      srcDecimals: String(srcDecimals),
      destDecimals: String(destDecimals),
      side: 'SELL',
      network: '137',
    });
    const res = await fetch(`${PARASWAP_BASE}/prices?${params}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`ParaSwap API error: ${res.status}`);
    const data = await res.json();
    const priceRoute = data.priceRoute || {};
    return {
      destAmount: priceRoute.destAmount || '0',
      estimatedGas: parseInt(priceRoute.gasCost || '0'),
      bestRoute: priceRoute.bestRoute?.[0]?.swaps?.[0]?.swapExchanges?.[0]?.exchange || 'unknown',
    };
  }
}

// ============================================
// MULTI-DEX AGGREGATOR
// ============================================

export interface DexQuote {
  dex: '1inch' | '0x' | 'paraswap' | 'uniswap';
  amountOut: string;
  estimatedGas: number;
  sources?: string[];
}

export class MultiDexAggregator {
  /** Get quotes from all available DEX aggregators and return sorted best-first */
  async getBestQuote(
    fromToken: string,
    toToken: string,
    amount: string,
    fromDecimals: number = 6,
    toDecimals: number = 18
  ): Promise<{ best: DexQuote; all: DexQuote[] }> {
    const quotes: DexQuote[] = [];

    // Fetch from all sources in parallel
    const promises: Promise<void>[] = [];

    // 1inch
    const oneInch = getOneInchAdapter();
    if (oneInch.isConfigured()) {
      promises.push(
        oneInch.getQuote(fromToken, toToken, amount)
          .then(q => { quotes.push({ dex: '1inch', amountOut: q.toAmount, estimatedGas: q.estimatedGas, sources: q.protocols }); })
          .catch(() => {})
      );
    }

    // 0x
    const zeroX = getZeroXAdapter();
    if (zeroX.isConfigured()) {
      promises.push(
        zeroX.getPrice(fromToken, toToken, amount)
          .then(q => { quotes.push({ dex: '0x', amountOut: q.buyAmount, estimatedGas: q.estimatedGas }); })
          .catch(() => {})
      );
    }

    // ParaSwap (always available, no key)
    const paraswap = getParaSwapAdapter();
    promises.push(
      paraswap.getPrice(fromToken, toToken, amount, fromDecimals, toDecimals)
        .then(q => { quotes.push({ dex: 'paraswap', amountOut: q.destAmount, estimatedGas: q.estimatedGas, sources: [q.bestRoute] }); })
        .catch(() => {})
    );

    await Promise.all(promises);

    if (quotes.length === 0) {
      throw new Error('No DEX aggregator returned a valid quote');
    }

    // Sort by output amount descending (best rate first)
    quotes.sort((a, b) => {
      const aOut = BigInt(a.amountOut || '0');
      const bOut = BigInt(b.amountOut || '0');
      if (bOut > aOut) return 1;
      if (bOut < aOut) return -1;
      return 0;
    });

    return { best: quotes[0], all: quotes };
  }
}

// ============================================
// SECURITY CHECKER (GoPlus)
// ============================================

export class SecurityChecker {
  /** Check if a token is safe (rug pull detection) */
  async checkTokenSecurity(
    tokenAddress: string,
    chainId: string = '137'
  ): Promise<{
    isSafe: boolean;
    isOpenSource: boolean;
    isProxy: boolean;
    isHoneypot: boolean;
    buyTax: number;
    sellTax: number;
    holders: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const res = await fetch(
      `https://api.gopluslabs.com/api/v1/token_security/${chainId}?contract_addresses=${tokenAddress}`
    );
    if (!res.ok) {
      return {
        isSafe: false, isOpenSource: false, isProxy: false,
        isHoneypot: true, buyTax: 100, sellTax: 100, holders: 0, riskLevel: 'high',
      };
    }

    const data = await res.json();
    const info = data.result?.[tokenAddress.toLowerCase()] || {};

    const isHoneypot = info.is_honeypot === '1';
    const buyTax = parseFloat(info.buy_tax || '0') * 100;
    const sellTax = parseFloat(info.sell_tax || '0') * 100;
    const isOpenSource = info.is_open_source === '1';
    const holders = parseInt(info.holder_count || '0');

    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (isHoneypot || sellTax > 10) riskLevel = 'high';
    else if (sellTax > 3 || !isOpenSource || holders < 100) riskLevel = 'medium';

    return {
      isSafe: !isHoneypot && sellTax < 10 && buyTax < 10,
      isOpenSource,
      isProxy: info.is_proxy === '1',
      isHoneypot,
      buyTax,
      sellTax,
      holders,
      riskLevel,
    };
  }

  /** Check multiple tokens in a swap pair — both must be safe */
  async checkSwapPairSecurity(
    tokenIn: string,
    tokenOut: string,
    chainId: string = '137'
  ): Promise<{
    isSafe: boolean;
    tokenInSecurity: Awaited<ReturnType<SecurityChecker['checkTokenSecurity']>>;
    tokenOutSecurity: Awaited<ReturnType<SecurityChecker['checkTokenSecurity']>>;
    summary: string;
  }> {
    const [tokenInSec, tokenOutSec] = await Promise.all([
      this.checkTokenSecurity(tokenIn, chainId),
      this.checkTokenSecurity(tokenOut, chainId),
    ]);

    const isSafe = tokenInSec.isSafe && tokenOutSec.isSafe;
    const risks: string[] = [];
    if (!tokenInSec.isSafe) risks.push(`tokenIn risk=${tokenInSec.riskLevel}`);
    if (!tokenOutSec.isSafe) risks.push(`tokenOut risk=${tokenOutSec.riskLevel}`);

    return {
      isSafe,
      tokenInSecurity: tokenInSec,
      tokenOutSecurity: tokenOutSec,
      summary: isSafe ? 'Both tokens pass security checks' : `UNSAFE: ${risks.join(', ')}`,
    };
  }
}

// ============================================
// SINGLETONS
// ============================================

let _aave: AaveV3Adapter | null = null;
let _uniswap: UniswapV3Adapter | null = null;
let _oneInch: OneInchAdapter | null = null;
let _zeroX: ZeroXAdapter | null = null;
let _paraswap: ParaSwapAdapter | null = null;
let _multiDex: MultiDexAggregator | null = null;
let _simulator: TransactionSimulator | null = null;
let _securityChecker: SecurityChecker | null = null;

export function getAaveAdapter(): AaveV3Adapter {
  if (!_aave) _aave = new AaveV3Adapter();
  return _aave;
}

export function getUniswapAdapter(): UniswapV3Adapter {
  if (!_uniswap) _uniswap = new UniswapV3Adapter();
  return _uniswap;
}

export function getOneInchAdapter(): OneInchAdapter {
  if (!_oneInch) _oneInch = new OneInchAdapter();
  return _oneInch;
}

export function getZeroXAdapter(): ZeroXAdapter {
  if (!_zeroX) _zeroX = new ZeroXAdapter();
  return _zeroX;
}

export function getParaSwapAdapter(): ParaSwapAdapter {
  if (!_paraswap) _paraswap = new ParaSwapAdapter();
  return _paraswap;
}

export function getMultiDexAggregator(): MultiDexAggregator {
  if (!_multiDex) _multiDex = new MultiDexAggregator();
  return _multiDex;
}

export function getSimulator(): TransactionSimulator {
  if (!_simulator) _simulator = new TransactionSimulator();
  return _simulator;
}

export function getSecurityChecker(): SecurityChecker {
  if (!_securityChecker) _securityChecker = new SecurityChecker();
  return _securityChecker;
}
