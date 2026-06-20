/**
 * BuyBTFWidget — Buy BTF Token with MATIC on Polygon
 * 
 * NOW with IN-APP SWAP via QuickSwap Router V2!
 * Falls back to external DEX links if no on-chain liquidity.
 * 
 * Exports:
 *   - BuyBTFWidget: Sidebar card with in-app swap + fallbacks
 *   - BuyBTFButton: Inline button that opens swap page
 *   - NeedBTFBanner: CTA when balance insufficient
 * 
 * Integrated across: Social Network sidebar, BTF Wallet, Artist Mint Widget
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useWeb3 } from '../../hooks/use-web3';
import { useBTFSwap } from '../../hooks/use-btf-swap';
import { useBTFSale } from '../../hooks/use-btf-sale';
import { BTF_TOKEN_ADDRESS, BTF_TOKEN_META, BTF_CHAIN_ID } from '../../lib/btf-token-config';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UtilityDisclaimer } from '../btf/utility-disclaimer';
import {
  ShoppingCart, Copy, Check, ExternalLink, Wallet, ArrowRight,
  ChevronRight, Plus, Coins, TrendingUp, Zap, Shield, Info,
  ChevronDown, ChevronUp, Loader2, CheckCircle2, AlertCircle,
  RefreshCw
} from 'lucide-react';

const BTF_IMG = BTF_TOKEN_META.image;

// PolygonScan token page
const POLYGONSCAN_URL = `https://polygonscan.com/token/${BTF_TOKEN_ADDRESS}`;
const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';

// ═══════════════════════════════════════════════════════
//  Add to MetaMask helper
// ═══════════════════════════════════════════════════════

async function addBTFToMetaMask(): Promise<boolean> {
  try {
    const ethereum = (window as any).ethereum;
    if (!ethereum) return false;

    const added = await ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: BTF_TOKEN_ADDRESS,
          symbol: BTF_TOKEN_META.symbol,
          decimals: BTF_TOKEN_META.decimals,
          image: window.location.origin + BTF_TOKEN_META.image,
        },
      },
    });
    return !!added;
  } catch {
    return false;
  }
}

// ═══════════════════════════════════════════════════════
//  COMPACT WIDGET (for sidebars)
// ═══════════════════════════════════════════════════════

export function BuyBTFWidget() {
  const { isConnected, isWeb3Ready } = useWeb3();
  const dex = useBTFSwap();
  const sale = useBTFSale();

  // Use sale as primary buy method
  const useSale = sale.isActive || !dex.poolInfo?.hasLiquidity;
  const status = useSale ? sale.status : dex.status;
  const quote = useSale
    ? (sale.quote ? { outputAmount: sale.quote.outputBTF } : null)
    : (dex.quote ? { outputAmount: dex.quote.outputAmount } : null);
  const txHash = useSale ? sale.txHash : dex.txHash;
  const error = useSale ? sale.error : dex.error;

  const [copied, setCopied] = useState(false);
  const [addedToWallet, setAddedToWallet] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isBusy = status === 'quoting' || status === 'buying' || status === 'approving' || status === 'swapping';

  // Debounced quotes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!inputVal || parseFloat(inputVal) <= 0) return;
    debounceRef.current = setTimeout(() => {
      if (sale.isActive || sale.isDeployed) sale.getQuote(inputVal);
      if (dex.poolInfo?.hasLiquidity) dex.getQuoteBuy(inputVal);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [inputVal, sale.isActive, sale.isDeployed, dex.poolInfo?.hasLiquidity]);

  const canBuy = sale.isActive || sale.isDeployed || (dex.poolInfo?.hasLiquidity ?? false);

  const handleBuy = useCallback(async () => {
    if (!inputVal || !canBuy) return;
    let result: string | null = null;
    if (sale.isActive || sale.isDeployed) {
      result = await sale.buyBTF(inputVal);
    } else if (dex.poolInfo?.hasLiquidity) {
      result = await dex.buyBTF(inputVal);
    }
    if (result) {
      setInputVal('');
      setTimeout(() => { dex.reset(); sale.reset(); }, 5000);
    }
  }, [inputVal, canBuy, sale.isActive, sale.isDeployed, dex.poolInfo?.hasLiquidity]);

  const formatNum = (val: string, dec = 2) => {
    const n = parseFloat(val); return isNaN(n) ? '0' : n.toFixed(dec);
  };

  const copyAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(BTF_TOKEN_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement('input');
      input.value = BTF_TOKEN_ADDRESS;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const handleAddToWallet = useCallback(async () => {
    const success = await addBTFToMetaMask();
    if (success) {
      setAddedToWallet(true);
      setTimeout(() => setAddedToWallet(false), 3000);
    }
  }, []);

  // Success state
  if (status === 'success' && txHash) {
    return (
      <Card className="bg-gradient-to-br from-green-950/50 via-slate-900/80 to-emerald-950/30 border-green-500/20 backdrop-blur-sm overflow-hidden">
        <CardContent className="py-6 text-center space-y-3">
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200 }}>
            <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto" />
          </motion.div>
          <p className="text-base font-bold text-white">Purchase Successful!</p>
          <p className="text-sm text-gray-400">~{formatNum(quote?.outputAmount || '0')} BTF</p>
          <a
            href={`${POLYGONSCAN_TX}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-green-400/80 text-xs hover:text-green-300"
          >
            View on PolygonScan <ExternalLink className="h-2.5 w-2.5" />
          </a>
          <Button onClick={() => { dex.reset(); sale.reset(); setInputVal(''); }} size="sm" className="w-full bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> New Swap
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-gradient-to-br from-orange-950/50 via-slate-900/80 to-amber-950/30 border-orange-500/20 backdrop-blur-sm overflow-hidden relative">
      {/* Glow */}
      <motion.div
        className="absolute top-0 right-0 w-36 h-36 bg-orange-500/10 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />

      <CardHeader className="pb-2 relative">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="relative">
              <img src={BTF_IMG} alt="BTF" className="w-6 h-6 rounded-lg" />
              <motion.div
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 border border-slate-900"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            </div>
            <span className="bg-gradient-to-r from-orange-400 to-amber-400 bg-clip-text text-transparent text-base font-bold">
              Add BTF Credits
            </span>
          </div>
          <span className="text-[10px] text-gray-500 font-normal">Polygon</span>
        </CardTitle>
        <CardDescription className="text-gray-500 text-xs">
          Add BTF Credits to access digital services on Boostify
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 relative">
        {/* Token Info Banner */}
        <div className="bg-slate-900/60 rounded-xl p-3 border border-orange-500/10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <img src={BTF_IMG} alt="BTF" className="w-5 h-5 rounded" />
              <div>
                <p className="text-sm font-bold text-white">Boostify Token</p>
                <p className="text-[10px] text-gray-500">BTF • ERC-20</p>
              </div>
            </div>
            {(sale.saleInfo?.isActive || dex.poolInfo?.hasLiquidity) && (
              <div className="text-right">
                <p className="text-[10px] text-gray-500">Price</p>
                <p className="text-xs font-semibold text-orange-400">
                  1 MATIC = {formatNum(sale.saleInfo?.isActive ? sale.saleInfo.rate : (dex.poolInfo?.maticPriceInBTF || '0'))} BTF
                </p>
              </div>
            )}
          </div>

          {/* Tokenomics mini */}
          <div className="grid grid-cols-3 gap-1.5 mt-2">
            <div className="text-center bg-red-500/10 rounded-lg p-1.5 border border-red-500/10">
              <p className="text-[9px] text-red-400">🔥 2% Burn</p>
            </div>
            <div className="text-center bg-purple-500/10 rounded-lg p-1.5 border border-purple-500/10">
              <p className="text-[9px] text-purple-400">💰 Staking</p>
            </div>
            <div className="text-center bg-blue-500/10 rounded-lg p-1.5 border border-blue-500/10">
              <p className="text-[9px] text-blue-400">🛡️ Anti-whale</p>
            </div>
          </div>
        </div>

        {/* ═══ IN-APP SWAP SECTION ═══ */}
        <div className="space-y-2">
          <p className="text-[10px] text-gray-500 uppercase tracking-wider flex items-center gap-1">
            <Zap className="h-3 w-3 text-orange-400" /> Quick Swap (In-App)
          </p>

          {/* MATIC Input */}
          <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30 space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="0.0"
                value={inputVal}
                onChange={e => setInputVal(e.target.value)}
                disabled={isBusy}
                className="flex-1 bg-transparent text-lg font-bold text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center gap-1.5 bg-slate-800/60 rounded-lg px-2.5 py-1.5 border border-slate-700/30">
                <span className="text-xs">💜</span>
                <span className="text-xs font-semibold text-white">MATIC</span>
              </div>
            </div>

            {/* Quick amounts */}
            <div className="flex gap-1">
              {['10', '50', '100', '500'].map(amt => (
                <button
                  key={amt}
                  onClick={() => setInputVal(amt)}
                  disabled={isBusy}
                  className="px-2 py-0.5 rounded text-[9px] bg-slate-800/40 text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 border border-slate-700/20 transition-all disabled:opacity-50"
                >
                  {amt}
                </button>
              ))}
            </div>
          </div>

          {/* Output preview */}
          {quote && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between bg-orange-500/5 rounded-xl px-3 py-2 border border-orange-500/10"
            >
              <span className="text-[10px] text-gray-500">You receive</span>
              <span className="text-sm font-bold text-orange-400">
                ~{formatNum(quote.outputAmount)} BTF
              </span>
            </motion.div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-1.5 text-[10px] text-red-400 bg-red-500/10 rounded-lg px-2.5 py-1.5">
              <AlertCircle className="h-3 w-3" /> {error}
            </div>
          )}

          {/* Buy Button — in-app swap */}
          {!isConnected ? (
            isWeb3Ready ? (
              <ConnectButton.Custom>
                {({ openConnectModal }) => (
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={openConnectModal}
                    className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/20 transition-all"
                  >
                    <Wallet className="h-4 w-4" /> Connect Wallet
                  </motion.button>
                )}
              </ConnectButton.Custom>
            ) : (
              <Link href="/boostiswap">
                <motion.span
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/20 transition-all cursor-pointer"
                >
                  <Wallet className="h-4 w-4" /> Connect Wallet
                </motion.span>
              </Link>
            )
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBuy}
              disabled={isBusy || !inputVal || parseFloat(inputVal) <= 0 || !canBuy}
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white px-4 py-3 rounded-xl text-sm font-semibold shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {status === 'swapping' || status === 'buying' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Buying...</>
              ) : status === 'quoting' ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Quoting...</>
              ) : (
                <><Zap className="h-4 w-4" /> Add BTF Credits</>
              )}
            </motion.button>
          )}

          {/* Full swap page link */}
          <Link href="/boostiswap">
            <span className="flex items-center justify-center gap-1 text-[10px] text-orange-400/60 hover:text-orange-400 transition-colors cursor-pointer">
              Advanced Swap <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>

        {/* Contract Address — Copy */}
        <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Contract Address</p>
            <span className="text-[9px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full border border-green-500/20">Verified ✓</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="text-[10px] text-orange-300 bg-slate-800/50 px-2 py-1.5 rounded-lg flex-1 font-mono truncate border border-slate-700/30">
              {BTF_TOKEN_ADDRESS}
            </code>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={copyAddress}
              className={`p-2 rounded-lg transition-all ${
                copied 
                  ? 'bg-green-500/20 text-green-400' 
                  : 'bg-slate-800 text-gray-400 hover:text-white hover:bg-slate-700'
              }`}
              title="Copy address"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </motion.button>
          </div>
        </div>

        {/* Wallet Actions */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleAddToWallet}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
              addedToWallet
                ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                : 'bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/20 text-orange-400'
            }`}
          >
            {addedToWallet ? (
              <><Check className="h-3 w-3" /> Added!</>
            ) : (
              <><Plus className="h-3 w-3" /> Add to MetaMask</>
            )}
          </motion.button>
          <motion.a
            href={POLYGONSCAN_URL}
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 py-2.5 rounded-xl text-xs font-medium transition-all cursor-pointer"
          >
            <ExternalLink className="h-3 w-3" /> PolygonScan
          </motion.a>
        </div>

        {/* Expandable: How to buy guide */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-between w-full text-[10px] text-gray-500 hover:text-gray-300 transition-colors py-1"
          >
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3" /> How to add BTF Credits
            </span>
            {showDetails ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          <AnimatePresence>
            {showDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 pt-2"
              >
                {[
                  { step: '1', text: 'Get MATIC on Polygon network', icon: '💜' },
                  { step: '2', text: 'Enter MATIC amount above & click "Buy BTF Now"', icon: '⚡' },
                  { step: '3', text: 'Confirm the swap in your wallet', icon: '👛' },
                  { step: '4', text: 'Use BTF to mint AI Artists & stake', icon: '🎨' },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-2 text-[11px] text-gray-400">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 flex items-center justify-center text-[9px] font-bold mt-0.5">{item.step}</span>
                    <span>{item.icon} {item.text}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Use Cases */}
        <div className="grid grid-cols-2 gap-1.5">
          <Link href="/btf-artist-mint">
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-1.5 text-[10px] text-purple-400 hover:text-purple-300 transition-colors cursor-pointer bg-purple-500/5 hover:bg-purple-500/10 rounded-lg px-2 py-2 border border-purple-500/10"
            >
              <Zap className="h-3 w-3 flex-shrink-0" />
              <span>Mint AI Artists</span>
            </motion.div>
          </Link>
          <Link href="/btf-staking">
            <motion.div
              whileHover={{ x: 2 }}
              className="flex items-center gap-1.5 text-[10px] text-green-400 hover:text-green-300 transition-colors cursor-pointer bg-green-500/5 hover:bg-green-500/10 rounded-lg px-2 py-2 border border-green-500/10"
            >
              <Shield className="h-3 w-3 flex-shrink-0" />
              <span>Lock for Service Credits</span>
            </motion.div>
          </Link>
        </div>
        <UtilityDisclaimer variant="short" size="xs" className="mt-3" />
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
//  INLINE BUY BUTTON (for embedding in other widgets)
// ═══════════════════════════════════════════════════════

export function BuyBTFButton({ size = 'sm', className = '' }: { size?: 'sm' | 'md'; className?: string }) {
  const [, navigate] = useLocation();
  return (
    <motion.button
      onClick={() => navigate('/boostiswap')}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`inline-flex items-center gap-1.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold rounded-lg shadow-lg shadow-orange-500/20 transition-all cursor-pointer ${
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm'
      } ${className}`}
    >
      <Zap className={size === 'sm' ? 'h-3 w-3' : 'h-4 w-4'} />
      Add BTF Credits
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════
//  NEED BTF CTA (shown when user doesn't have enough)
// ═══════════════════════════════════════════════════════

export function NeedBTFBanner({ requiredAmount, currentBalance }: { requiredAmount?: string; currentBalance?: string }) {
  const [, navigate] = useLocation();
  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-3 space-y-2">
      <div className="flex items-start gap-2">
        <Coins className="h-4 w-4 text-orange-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-orange-400">Need BTF Tokens?</p>
          <p className="text-[10px] text-gray-400 mt-0.5">
            {requiredAmount && currentBalance
              ? `You need ${requiredAmount} BTF but only have ${currentBalance} BTF`
              : 'Get BTF tokens to mint AI Artists and unlock platform features'}
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <BuyBTFButton size="sm" className="flex-1 justify-center" />
        <Link href="/btf-wallet">
          <span className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 px-3 py-1.5 text-xs rounded-lg transition-colors cursor-pointer">
            <Wallet className="h-3 w-3" /> Wallet
          </span>
        </Link>
      </div>
    </div>
  );
}
