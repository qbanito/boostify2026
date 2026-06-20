/**
 * BTFSwapWidget — In-app MATIC ↔ BTF swap via QuickSwap Router V2
 * 
 * Features:
 *   - Real-time price quotes from on-chain reserves
 *   - Buy (MATIC → BTF) & Sell (BTF → MATIC) modes
 *   - Slippage settings (0.5%, 1%, 3%, custom)
 *   - Price impact indicator
 *   - Pool liquidity display
 *   - Transaction status with PolygonScan links
 *   - Fallback to external DEXes if no liquidity
 * 
 * Directly integrated into BoostiSwap — no external redirects needed.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useBTFSwap } from '../../hooks/use-btf-swap';
import { useBTFSale } from '../../hooks/use-btf-sale';
import { useBTFToken } from '../../hooks/use-btf-token';
import { useWeb3 } from '../../hooks/use-web3';
import { useToast } from '../../hooks/use-toast';
import { BTF_TOKEN_ADDRESS, BTF_TOKEN_META } from '../../lib/btf-token-config';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { BuyBTFCardWidget } from './buy-btf-card-widget';
import {
  ArrowDownUp, Settings2, Loader2, CheckCircle2, AlertCircle,
  ArrowDown, ExternalLink, Copy, Check, Wallet, Info,
  TrendingUp, Droplets, ShieldCheck, Zap, RefreshCw, X,
  ChevronDown, Coins, CreditCard,
} from 'lucide-react';

const BTF_IMG = BTF_TOKEN_META.image;
const MATIC_IMG = '/polygon-logo.svg'; // Uses Polygon logo

const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';

// ═══════════════════════════════════════════════════════
//  MAIN SWAP WIDGET WITH TABS (MATIC + Card)
// ═══════════════════════════════════════════════════════

export function BTFSwapWidget({ compact = false }: { compact?: boolean }) {
  const [payMethod, setPayMethod] = useState<'crypto' | 'card'>('crypto');

  return (
    <div className="space-y-3">
      {/* Payment method tabs */}
      <div className="flex gap-2 bg-slate-900/60 rounded-xl p-1 border border-slate-700/30">
        <button
          onClick={() => setPayMethod('crypto')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
            payMethod === 'crypto'
              ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30 shadow-lg shadow-orange-500/10'
              : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Coins className="h-4 w-4" />
          MATIC
        </button>
        <button
          onClick={() => setPayMethod('card')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
            payMethod === 'card'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-500/10'
              : 'text-gray-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <CreditCard className="h-4 w-4" />
          Tarjeta (USD)
        </button>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {payMethod === 'crypto' ? (
          <motion.div
            key="crypto"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            transition={{ duration: 0.2 }}
          >
            <BTFCryptoSwapWidget compact={compact} />
          </motion.div>
        ) : (
          <motion.div
            key="card"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <BuyBTFCardWidget />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════
//  CRYPTO SWAP WIDGET (MATIC ↔ BTF)
// ═══════════════════════════════════════════════════════

function BTFCryptoSwapWidget({ compact = false }: { compact?: boolean }) {
  // DEX swap (QuickSwap Router — needs liquidity pool)
  const dex = useBTFSwap();
  // Direct sale contract (no pool needed — primary buy method)
  const sale = useBTFSale();

  const { balance: btfBalance } = useBTFToken();
  const { address, isWeb3Ready, balanceFormatted: maticBalance } = useWeb3();
  const { toast } = useToast();
  const [localError, setLocalError] = useState<string | null>(null);

  const [mode, setMode] = useState<'buy' | 'sell'>('buy');
  const [inputValue, setInputValue] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [customSlippage, setCustomSlippage] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Use sale contract for buying when active; DEX for selling or when sale unavailable
  const useSale = mode === 'buy' && (sale.isActive || !dex.poolInfo?.hasLiquidity);

  // Unified state from whichever source is active
  const status = useSale ? sale.status : dex.status;
  const quote = useSale
    ? (sale.quote ? { outputAmount: sale.quote.outputBTF, rate: sale.quote.rate, minimumOutput: sale.quote.outputBTF, priceImpact: '0', inputAmount: sale.quote.inputMatic } : null)
    : dex.quote;
  const txHash = useSale ? sale.txHash : dex.txHash;
  const error = localError || (useSale ? sale.error : dex.error);
  const poolInfo = dex.poolInfo;
  const slippage = dex.slippage;
  const isConnected = dex.isConnected;

  const isBusy = status === 'quoting' || status === 'buying' || status === 'approving' || status === 'swapping';

  // Debounced quote fetching
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!inputValue || parseFloat(inputValue) <= 0) return;

    debounceRef.current = setTimeout(() => {
      if (mode === 'buy') {
        // Try sale contract first, fall back to DEX
        if (sale.isActive || sale.isDeployed) {
          sale.getQuote(inputValue);
        }
        if (dex.poolInfo?.hasLiquidity) {
          dex.getQuoteBuy(inputValue);
        }
      } else {
        // Only attempt sell quote if there's a liquidity pool
        if (dex.poolInfo?.hasLiquidity) {
          dex.getQuoteSell(inputValue);
        }
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputValue, mode, sale.isActive, sale.isDeployed, dex.poolInfo?.hasLiquidity]);

  // Toggle buy/sell
  const toggleMode = useCallback(() => {
    setMode(m => m === 'buy' ? 'sell' : 'buy');
    setInputValue('');
    dex.reset();
    sale.reset();
  }, [dex.reset, sale.reset]);

  // No way to buy/sell?
  const canBuy = sale.isActive || sale.isDeployed || (dex.poolInfo?.hasLiquidity ?? false);
  const canSell = dex.poolInfo?.hasLiquidity ?? false;

  // Execute swap
  const handleSwap = useCallback(async () => {
    if (!inputValue || parseFloat(inputValue) <= 0) return;
    if (mode === 'buy') {
      setLocalError(null);
      // Prefer sale contract, fall back to DEX only if pool has liquidity
      if (sale.isActive || sale.isDeployed) {
        await sale.buyBTF(inputValue);
      } else if (dex.poolInfo?.hasLiquidity) {
        await dex.buyBTF(inputValue);
      } else {
        const msg = 'Compra no disponible — el contrato de venta aún no está desplegado y no hay pool de liquidez en QuickSwap.';
        setLocalError(msg);
        toast({ title: 'No disponible', description: msg, variant: 'destructive' });
      }
    } else {
      setLocalError(null);
      if (dex.poolInfo?.hasLiquidity) {
        await dex.sellBTF(inputValue);
      } else {
        const msg = 'Venta no disponible — no hay pool de liquidez WMATIC/BTF en QuickSwap.';
        setLocalError(msg);
        toast({ title: 'No disponible', description: msg, variant: 'destructive' });
      }
    }
  }, [mode, inputValue, sale.isActive, sale.isDeployed, dex.poolInfo?.hasLiquidity]);

  // Quick amounts
  const quickAmounts = mode === 'buy'
    ? ['10', '50', '100', '500']
    : ['100', '500', '1000', '5000'];

  // Format number display
  const formatNum = (val: string, decimals = 4) => {
    const n = parseFloat(val);
    if (isNaN(n)) return '0';
    if (n > 1000) return n.toLocaleString('en', { maximumFractionDigits: 2 });
    return n.toFixed(decimals);
  };

  // No liquidity — only matters for sell mode (buy uses sale contract)
  const noLiquidity = mode === 'sell' && poolInfo && !poolInfo.hasLiquidity;

  // ── Success state ──
  if (status === 'success' && txHash) {
    return (
      <Card className="bg-gradient-to-br from-green-950/50 via-slate-900/80 to-emerald-950/30 border-green-500/20 backdrop-blur-sm overflow-hidden">
        <CardContent className="py-8 text-center space-y-4">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            <CheckCircle2 className="h-16 w-16 text-green-400 mx-auto" />
          </motion.div>
          <div>
            <h3 className="text-xl font-bold text-white">
              {mode === 'buy' ? '¡Swap Exitoso!' : '¡Venta Exitosa!'}
            </h3>
            <p className="text-gray-400 text-sm mt-1">
              {mode === 'buy'
                ? `Compraste ~${formatNum(quote?.outputAmount || '0', 2)} BTF`
                : `Recibiste ~${formatNum(quote?.outputAmount || '0', 4)} MATIC`}
            </p>
          </div>
          <a
            href={`${POLYGONSCAN_TX}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-green-400 text-sm hover:text-green-300 transition-colors"
          >
            Ver en PolygonScan <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button
            onClick={() => {
              const amount = mode === 'buy' ? formatNum(quote?.outputAmount || '0', 2) : formatNum(quote?.outputAmount || '0', 4);
              window.location.href = `/token-purchase-success?tx=${txHash}&amount=${amount}&token=btf&method=matic`;
            }}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
          >
            <Wallet className="h-4 w-4 mr-2" /> Agregar a Wallet & Ver Factura
          </Button>
          <Button
            onClick={() => { dex.reset(); sale.reset(); setInputValue(''); }}
            variant="ghost"
            className="w-full text-green-400/70 hover:text-green-400 text-sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Nuevo Swap
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-orange-950/40 via-slate-900/90 to-amber-950/30 border-orange-500/20 backdrop-blur-sm overflow-hidden relative">
      {/* Background glow */}
      <motion.div
        className="absolute top-0 right-0 w-40 h-40 bg-orange-500/8 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <CardHeader className="pb-3 relative">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="relative">
              <img src={BTF_IMG} alt="BTF" className="w-7 h-7 rounded-lg" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border-2 border-slate-900"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </div>
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent text-lg font-bold">
              BoostiSwap
            </span>
          </CardTitle>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 60 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowSettings(!showSettings)}
              className={`p-2 rounded-lg transition-colors ${
                showSettings ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800/50 text-gray-400 hover:text-white'
              }`}
            >
              <Settings2 className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => { dex.fetchPoolInfo(); sale.fetchSaleInfo(); }}
              className="p-2 rounded-lg bg-slate-800/50 text-gray-400 hover:text-white transition-colors"
              title="Refresh price"
            >
              <RefreshCw className="h-4 w-4" />
            </motion.button>
          </div>
        </div>
        <CardDescription className="text-gray-500 text-xs">
          Swap MATIC ↔ BTF directamente en Polygon
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 relative">
        {/* ── Slippage Settings ── */}
        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/30 space-y-2 mb-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-gray-400 flex items-center gap-1">
                    <Settings2 className="h-3 w-3" /> Slippage Tolerance
                  </p>
                  <button onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex gap-2">
                  {[0.5, 1, 3].map(val => (
                    <button
                      key={val}
                      onClick={() => { dex.setSlippage(val); setCustomSlippage(''); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        slippage === val && !customSlippage
                          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                          : 'bg-slate-800/50 text-gray-400 hover:text-white border border-slate-700/30'
                      }`}
                    >
                      {val}%
                    </button>
                  ))}
                  <div className="relative flex-1">
                    <input
                      type="number"
                      placeholder="Custom"
                      value={customSlippage}
                      onChange={e => {
                        setCustomSlippage(e.target.value);
                        const val = parseFloat(e.target.value);
                        if (val > 0 && val <= 50) dex.setSlippage(val);
                      }}
                      className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-800/50 border border-slate-700/30 text-white focus:border-orange-500/50 focus:outline-none"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-500">%</span>
                  </div>
                </div>
                {slippage > 5 && (
                  <p className="text-[10px] text-amber-400 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> High slippage may result in unfavorable trade
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Sale Info (when using direct sale) ── */}
        {mode === 'buy' && sale.isActive && sale.saleInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-green-500/10 border border-green-500/20 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-400">Compra Directa Activa</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  1 MATIC = {formatNum(sale.saleInfo.rate, 0)} BTF • {formatNum(sale.saleInfo.btfAvailable, 0)} BTF disponibles
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Sell No Liquidity Warning ── */}
        {noLiquidity && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-400">Pool de Liquidez no Disponible</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  No hay pool WMATIC/BTF para vender. Puedes vender cuando se cree liquidez en QuickSwap.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Buy Not Available (no sale contract + no DEX pool) ── */}
        {mode === 'buy' && !canBuy && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">Compra No Disponible</p>
                <p className="text-[10px] text-gray-400 mt-1">
                  El contrato de venta directa aún no está desplegado y no hay pool de liquidez en QuickSwap. 
                  Despliega el contrato con: <code className="text-orange-400 bg-slate-800/50 px-1 rounded">npx hardhat run scripts/deploy-btf-sale.cjs --network polygon</code>
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── INPUT SECTION ── */}
        <div className="space-y-1">
          {/* From token */}
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {mode === 'buy' ? 'You Pay' : 'You Sell'}
              </p>
              <p className="text-[10px] text-gray-500">
                Balance: {mode === 'buy'
                  ? (maticBalance ? `${parseFloat(maticBalance).toFixed(4)} MATIC` : '—')
                  : `${formatNum(btfBalance || '0', 2)} BTF`}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="number"
                placeholder="0.0"
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                disabled={isBusy}
                className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/30">
                {mode === 'buy' ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">💜</div>
                    <span className="text-sm font-semibold text-white">MATIC</span>
                  </>
                ) : (
                  <>
                    <img src={BTF_IMG} alt="BTF" className="w-6 h-6 rounded" />
                    <span className="text-sm font-semibold text-orange-400">BTF</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1.5">
              {quickAmounts.map(amt => (
                <button
                  key={amt}
                  onClick={() => setInputValue(amt)}
                  disabled={isBusy}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-slate-800/40 text-gray-400 hover:text-white hover:bg-orange-500/15 border border-slate-700/20 hover:border-orange-500/30 transition-all disabled:opacity-50"
                >
                  {amt} {mode === 'buy' ? 'MATIC' : 'BTF'}
                </button>
              ))}
              {mode === 'sell' && btfBalance && parseFloat(btfBalance) > 0 && (
                <button
                  onClick={() => setInputValue(btfBalance)}
                  disabled={isBusy}
                  className="px-2.5 py-1 rounded-lg text-[10px] bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                >
                  MAX
                </button>
              )}
            </div>
          </div>

          {/* Arrow swap button */}
          <div className="flex justify-center -my-2 relative z-10">
            <motion.button
              whileHover={{ scale: 1.15, rotate: 180 }}
              whileTap={{ scale: 0.9 }}
              onClick={toggleMode}
              disabled={isBusy}
              className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center shadow-lg shadow-orange-500/30 border-4 border-slate-900 disabled:opacity-50"
            >
              <ArrowDown className="h-4 w-4 text-white" />
            </motion.button>
          </div>

          {/* To token */}
          <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">
                {mode === 'buy' ? 'You Receive' : 'You Get'}
              </p>
              {quote && (
                <p className="text-[10px] text-gray-500">
                  Min: {formatNum(quote.minimumOutput, mode === 'buy' ? 2 : 6)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 text-2xl font-bold">
                {status === 'quoting' ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-lg">Getting quote...</span>
                  </div>
                ) : quote ? (
                  <span className={mode === 'buy' ? 'text-orange-400' : 'text-purple-400'}>
                    {formatNum(quote.outputAmount, mode === 'buy' ? 2 : 6)}
                  </span>
                ) : (
                  <span className="text-gray-600">0.0</span>
                )}
              </div>
              <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/30">
                {mode === 'buy' ? (
                  <>
                    <img src={BTF_IMG} alt="BTF" className="w-6 h-6 rounded" />
                    <span className="text-sm font-semibold text-orange-400">BTF</span>
                  </>
                ) : (
                  <>
                    <div className="w-6 h-6 rounded-full bg-purple-500/20 flex items-center justify-center text-xs">💜</div>
                    <span className="text-sm font-semibold text-white">MATIC</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Quote Details ── */}
        {quote && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-900/40 rounded-xl p-3 border border-slate-700/20 space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Rate</span>
              <span className="text-gray-300">
                {mode === 'buy'
                  ? `1 MATIC = ${formatNum(quote.rate, 2)} BTF`
                  : `1 BTF = ${formatNum(quote.rate, 6)} MATIC`}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Price Impact</span>
              <span className={
                parseFloat(quote.priceImpact) > 5 ? 'text-red-400' :
                parseFloat(quote.priceImpact) > 2 ? 'text-amber-400' : 'text-green-400'
              }>
                ~{quote.priceImpact}%
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Slippage</span>
              <span className="text-gray-400">{slippage}%</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500">Route</span>
              <span className="text-gray-400 flex items-center gap-1">
                {mode === 'buy' ? 'MATIC' : 'BTF'} → WMATIC → {mode === 'buy' ? 'BTF' : 'MATIC'}
              </span>
            </div>
          </motion.div>
        )}

        {/* ── Swap Button ── */}
        {!isConnected ? (
          <div className="w-full">
            {isWeb3Ready ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <Button
                    onClick={openConnectModal}
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-6 text-base shadow-lg shadow-orange-500/20"
                  >
                    <Wallet className="h-5 w-5 mr-2" /> Connect Wallet
                  </Button>
                )}
              </ConnectButton.Custom>
            ) : (
              <Button className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold py-6 text-base shadow-lg shadow-orange-500/20 opacity-70" disabled>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading Wallet...
              </Button>
            )}
          </div>
        ) : (
          <Button
            onClick={handleSwap}
            disabled={isBusy || !inputValue || parseFloat(inputValue) <= 0 || (mode === 'buy' ? !canBuy : !canSell)}
            className={`w-full font-semibold py-6 text-base shadow-lg transition-all ${
              mode === 'buy'
                ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-orange-500/20'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-purple-500/20'
            } text-white disabled:opacity-50`}
          >
            {status === 'approving' ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Approving BTF...</>
            ) : status === 'swapping' ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Swapping...</>
            ) : status === 'quoting' ? (
              <><Loader2 className="h-5 w-5 mr-2 animate-spin" /> Getting Quote...</>
            ) : mode === 'buy' ? (
              <><Zap className="h-5 w-5 mr-2" /> Buy BTF</>
            ) : (
              <><Coins className="h-5 w-5 mr-2" /> Sell BTF</>
            )}
          </Button>
        )}

        {/* ── Error ── */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}

        {/* ── Pool Info ── */}
        {poolInfo && poolInfo.hasLiquidity && (
          <div className="bg-slate-900/30 rounded-xl p-3 border border-slate-700/20 space-y-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
              <Droplets className="h-3 w-3" /> Pool Liquidity
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-gray-400">MATIC</p>
                <p className="text-sm font-semibold text-purple-400">
                  {formatNum(poolInfo.reserveMATIC, 2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400">BTF</p>
                <p className="text-sm font-semibold text-orange-400">
                  {formatNum(poolInfo.reserveBTF, 2)}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-slate-800/50">
              <span className="text-[10px] text-gray-500">1 MATIC =</span>
              <span className="text-[10px] text-orange-400 font-medium">
                {formatNum(poolInfo.maticPriceInBTF, 2)} BTF
              </span>
            </div>
          </div>
        )}

        {/* ── Powered By ── */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span className="text-[9px] text-gray-600">
            Powered by {useSale ? 'Direct Sale' : 'QuickSwap Router V2'} • Polygon Network
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  COMPACT SWAP CARD (for sidebars — replaces external-only widget)
// ═══════════════════════════════════════════════════════

export function BTFSwapCard() {
  const dex = useBTFSwap();
  const sale = useBTFSale();
  const { isWeb3Ready } = useWeb3();
  const [inputVal, setInputVal] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Use sale as primary buy method
  const useSaleHere = sale.isActive || !dex.poolInfo?.hasLiquidity;
  const status = useSaleHere ? sale.status : dex.status;
  const quote = useSaleHere
    ? (sale.quote ? { outputAmount: sale.quote.outputBTF } : null)
    : (dex.quote ? { outputAmount: dex.quote.outputAmount } : null);
  const txHash = useSaleHere ? sale.txHash : dex.txHash;
  const isConnected = dex.isConnected;
  const poolInfo = dex.poolInfo;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputVal || parseFloat(inputVal) <= 0) return;
    debounceRef.current = setTimeout(() => {
      if (sale.isActive || sale.isDeployed) sale.getQuote(inputVal);
      if (dex.poolInfo?.hasLiquidity) dex.getQuoteBuy(inputVal);
    }, 600);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputVal, sale.isActive, sale.isDeployed, dex.poolInfo?.hasLiquidity]);

  const handleBuy = useCallback(async () => {
    if (!inputVal) return;
    let result: string | null = null;
    if (sale.isActive || sale.isDeployed) {
      result = await sale.buyBTF(inputVal);
    } else {
      result = await dex.buyBTF(inputVal);
    }
    if (result) {
      setInputVal('');
      setTimeout(() => { dex.reset(); sale.reset(); }, 5000);
    }
  }, [inputVal, sale.isActive, sale.isDeployed]);

  const formatNum = (val: string, dec = 2) => {
    const n = parseFloat(val);
    return isNaN(n) ? '0' : n.toFixed(dec);
  };

  if (status === 'success' && txHash) {
    return (
      <Card className="bg-gradient-to-br from-green-950/40 to-slate-900/80 border-green-500/20">
        <CardContent className="py-4 text-center space-y-2">
          <CheckCircle2 className="h-10 w-10 text-green-400 mx-auto" />
          <p className="text-sm font-semibold text-green-400">¡Compra Exitosa!</p>
          <a
            href={`${POLYGONSCAN_TX}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-green-400/70 hover:text-green-300 flex items-center justify-center gap-1"
          >
            Ver TX <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <Button
            onClick={() => {
              window.location.href = `/token-purchase-success?tx=${txHash}&amount=0&token=btf&method=matic`;
            }}
            size="sm"
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold text-xs py-1.5"
          >
            <Wallet className="h-3 w-3 mr-1.5" /> Agregar a Wallet
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-orange-950/40 via-slate-900/80 to-amber-950/30 border-orange-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <img src={BTF_IMG} alt="BTF" className="w-5 h-5 rounded" />
          <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent font-bold">
            Quick Buy BTF
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {/* Price */}
        {(sale.saleInfo?.isActive || poolInfo?.hasLiquidity) && (
          <div className="flex items-center justify-between bg-slate-900/50 rounded-lg px-3 py-1.5">
            <span className="text-[10px] text-gray-500">Price</span>
            <span className="text-xs text-orange-400 font-medium">
              1 MATIC = {formatNum(sale.saleInfo?.isActive ? sale.saleInfo.rate : (poolInfo?.maticPriceInBTF || '0'))} BTF
            </span>
          </div>
        )}

        {/* Input */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="MATIC amount"
              value={inputVal}
              onChange={e => setInputVal(e.target.value)}
              className="w-full bg-slate-900/50 border border-slate-700/30 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-orange-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
          </div>
        </div>

        {/* Quick buttons */}
        <div className="flex gap-1.5">
          {['10', '50', '100'].map(amt => (
            <button
              key={amt}
              onClick={() => setInputVal(amt)}
              className="flex-1 px-2 py-1 rounded-lg text-[10px] bg-slate-800/40 text-gray-400 hover:text-orange-400 hover:bg-orange-500/10 border border-slate-700/20 transition-all"
            >
              {amt} MATIC
            </button>
          ))}
        </div>

        {/* Output preview */}
        {quote && (
          <div className="flex items-center justify-between bg-orange-500/5 rounded-lg px-3 py-1.5 border border-orange-500/10">
            <span className="text-[10px] text-gray-500">You get</span>
            <span className="text-sm font-semibold text-orange-400">
              ~{formatNum(quote.outputAmount)} BTF
            </span>
          </div>
        )}

        {/* Buy button */}
        {!isConnected ? (
          isWeb3Ready ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button
                  onClick={openConnectModal}
                  size="sm"
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold"
                >
                  <Wallet className="h-3.5 w-3.5 mr-1.5" /> Connect Wallet
                </Button>
              )}
            </ConnectButton.Custom>
          ) : (
            <Button size="sm" className="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-semibold opacity-70" disabled>
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Loading...
            </Button>
          )
        ) : (
          <Button
            onClick={handleBuy}
            disabled={status !== 'idle' || !inputVal || (!quote && !useSaleHere)}
            size="sm"
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {status === 'swapping' || status === 'buying' ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Comprando...</>
            ) : status === 'quoting' ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Quoting...</>
            ) : (
              <><Zap className="h-3.5 w-3.5 mr-1.5" /> Buy BTF</>
            )}
          </Button>
        )}

        <p className="text-[8px] text-gray-600 text-center">
          {useSaleHere ? 'Compra Directa' : 'Via QuickSwap Router'} • Polygon
        </p>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  INLINE BTF BUY BUTTON (in-app swap trigger)
// ═══════════════════════════════════════════════════════

export function InAppBuyBTFButton({
  size = 'sm',
  className = '',
  onBuyClick,
}: {
  size?: 'sm' | 'md';
  className?: string;
  onBuyClick?: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      onClick={onBuyClick}
      className={`inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/20 transition-all cursor-pointer ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
      } ${className}`}
    >
      <Zap className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      Buy BTF
    </motion.button>
  );
}
