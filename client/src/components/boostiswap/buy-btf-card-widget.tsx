/**
 * BuyBTFCardWidget — Buy BTF tokens with credit/debit card via Stripe
 * 
 * Embeds Stripe PaymentElement for in-app checkout, no redirects.
 * After payment, server transfers BTF from treasury to user's wallet.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { useWeb3 } from '../../hooks/use-web3';
import { useToast } from '../../hooks/use-toast';
import { BTF_TOKEN_META } from '../../lib/btf-token-config';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { UtilityDisclaimer } from '../btf/utility-disclaimer';
import {
  CreditCard, Loader2, CheckCircle2, AlertCircle,
  ExternalLink, Wallet, DollarSign, Zap, ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import type { Stripe as StripeType } from '@stripe/stripe-js';

const BTF_IMG = BTF_TOKEN_META.image;
const POLYGONSCAN_TX = 'https://polygonscan.com/tx/';

// ═══════════════════════════════════════════════
//  STRIPE LOADER (lazy, same pattern as VideoBudgetModal)
// ═══════════════════════════════════════════════

let stripePromiseCache: Promise<StripeType | null> | null = null;

function getStripePromise(): Promise<StripeType | null> {
  if (stripePromiseCache) return stripePromiseCache;
  stripePromiseCache = (async () => {
    try {
      const { loadStripe } = await import('@stripe/stripe-js');
      const key = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
      if (!key) {
        // Fallback: fetch from server
        const resp = await fetch('/api/stripe/publishable-key');
        const data = await resp.json();
        if (data.publishableKey) return await loadStripe(data.publishableKey);
        console.warn('[BTF-Card] No Stripe publishable key found');
        return null;
      }
      return await loadStripe(key);
    } catch (e) {
      console.error('[BTF-Card] Error loading Stripe:', e);
      return null;
    }
  })();
  return stripePromiseCache;
}

// ═══════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════

interface Quote {
  pricePerBTF: number;
  btfPerDollar: number;
  minPurchaseUSD: number;
  maxPurchaseUSD: number;
  treasuryAvailable: string;
}

// ═══════════════════════════════════════════════
//  CHECKOUT FORM (rendered inside Stripe Elements)
// ═══════════════════════════════════════════════

function StripeCheckoutForm({
  usdAmount,
  btfAmount,
  purchaseId,
  onSuccess,
  onError,
}: {
  usdAmount: number;
  btfAmount: number;
  purchaseId: string;
  onSuccess: (txHash: string) => void;
  onError: (msg: string) => void;
}) {
  // Dynamic imports to avoid SSR issues
  const [StripeComponents, setStripeComponents] = useState<{
    useStripe: any;
    useElements: any;
    PaymentElement: any;
  } | null>(null);

  useEffect(() => {
    import('@stripe/react-stripe-js').then(mod => {
      setStripeComponents({
        useStripe: mod.useStripe,
        useElements: mod.useElements,
        PaymentElement: mod.PaymentElement,
      });
    });
  }, []);

  if (!StripeComponents) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-orange-400" />
      </div>
    );
  }

  return (
    <StripeCheckoutInner
      usdAmount={usdAmount}
      btfAmount={btfAmount}
      purchaseId={purchaseId}
      onSuccess={onSuccess}
      onError={onError}
      components={StripeComponents}
    />
  );
}

function StripeCheckoutInner({
  usdAmount,
  btfAmount,
  purchaseId,
  onSuccess,
  onError,
  components,
}: {
  usdAmount: number;
  btfAmount: number;
  purchaseId: string;
  onSuccess: (txHash: string) => void;
  onError: (msg: string) => void;
  components: { useStripe: any; useElements: any; PaymentElement: any };
}) {
  const stripe = components.useStripe();
  const elements = components.useElements();
  const [processing, setProcessing] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
        confirmParams: {
          return_url: window.location.origin,
        },
      });

      if (error) {
        onError(error.message || 'Payment failed');
        return;
      }

      if (paymentIntent && paymentIntent.status === 'succeeded') {
        // Payment succeeded — now verify + transfer BTF
        setVerifying(true);
        const resp = await fetch('/api/btf-card/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            purchaseId,
            paymentIntentId: paymentIntent.id,
          }),
        });
        const data = await resp.json();

        if (data.success && data.txHash) {
          onSuccess(data.txHash);
        } else {
          onError(data.error || 'BTF transfer failed');
        }
      }
    } catch (err: any) {
      onError(err.message || 'Error processing payment');
    } finally {
      setProcessing(false);
      setVerifying(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Amount summary */}
      <div className="bg-slate-900/50 rounded-xl p-3 border border-slate-700/30 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Pagas</span>
          <span className="text-white font-semibold">${usdAmount.toFixed(2)} USD</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Recibes</span>
          <span className="text-orange-400 font-semibold">{btfAmount.toLocaleString()} BTF</span>
        </div>
      </div>

      {/* Stripe payment form */}
      <div className="bg-slate-950/50 rounded-xl p-3 border border-slate-700/30">
        <components.PaymentElement
          options={{
            layout: 'tabs',
          }}
        />
      </div>

      <Button
        type="submit"
        disabled={!stripe || processing || verifying}
        className="w-full h-12 text-base font-bold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50"
      >
        {verifying ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Transfiriendo BTF...
          </span>
        ) : processing ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Procesando pago...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Pagar ${usdAmount.toFixed(2)} y recibir {btfAmount.toLocaleString()} BTF
          </span>
        )}
      </Button>

      <p className="text-[9px] text-gray-600 text-center">
        🔒 Pago seguro via Stripe • Los BTF se envían a tu wallet en Polygon
      </p>
    </form>
  );
}

// ═══════════════════════════════════════════════
//  MAIN WIDGET
// ═══════════════════════════════════════════════

export function BuyBTFCardWidget() {
  const { address, isWeb3Ready } = useWeb3();
  const { toast } = useToast();

  // State
  const [quote, setQuote] = useState<Quote | null>(null);
  const [usdAmount, setUsdAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState('');
  const [purchaseId, setPurchaseId] = useState('');
  const [btfAmount, setBtfAmount] = useState(0);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [step, setStep] = useState<'input' | 'pay' | 'success'>('input');
  const [stripePromise, setStripePromise] = useState<Promise<StripeType | null> | null>(null);
  const [Elements, setElements] = useState<any>(null);

  // Load quote on mount
  useEffect(() => {
    fetch('/api/btf-card/quote')
      .then(r => r.json())
      .then(data => {
        if (data.success) setQuote(data);
      })
      .catch(() => {});
  }, []);

  // Lazy load Stripe & Elements
  useEffect(() => {
    getStripePromise().then(() => setStripePromise(getStripePromise()));
    import('@stripe/react-stripe-js').then(mod => setElements(() => mod.Elements));
  }, []);

  // Calculated BTF for input
  const calcBTF = quote ? Math.floor(parseFloat(usdAmount || '0') / quote.pricePerBTF) : 0;
  const isValidAmount = quote
    ? parseFloat(usdAmount || '0') >= quote.minPurchaseUSD && parseFloat(usdAmount || '0') <= quote.maxPurchaseUSD
    : false;

  // Create payment
  const handleCreatePayment = useCallback(async () => {
    if (!address || !usdAmount || !isValidAmount) return;

    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/btf-card/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          usdAmount: parseFloat(usdAmount),
          walletAddress: address,
        }),
      });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        throw new Error(data.error || 'Failed to create payment');
      }

      setClientSecret(data.clientSecret);
      setPurchaseId(data.purchaseId);
      setBtfAmount(parseInt(data.btfAmount));
      setStep('pay');
    } catch (err: any) {
      setError(err.message);
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [address, usdAmount, isValidAmount]);

  // Quick USD amounts
  const quickAmounts = ['5', '10', '25', '50', '100'];

  // ── Success ──
  if (step === 'success' && txHash) {
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
            <h3 className="text-xl font-bold text-white">¡Compra Exitosa!</h3>
            <p className="text-gray-400 text-sm mt-1">
              Recibiste <span className="text-orange-400 font-semibold">{btfAmount.toLocaleString()} BTF</span> en tu wallet
            </p>
          </div>
          <a
            href={`${POLYGONSCAN_TX}${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-green-400 text-sm hover:text-green-300"
          >
            Ver en PolygonScan <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <Button
            onClick={() => {
              window.location.href = `/token-purchase-success?tx=${txHash}&amount=${btfAmount}&token=btf&method=card&usd=${usdAmount}`;
            }}
            className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-semibold"
          >
            <Wallet className="h-4 w-4 mr-2" /> Agregar a Wallet & Ver Factura
          </Button>
          <Button
            onClick={() => {
              setStep('input');
              setClientSecret('');
              setTxHash(null);
              setUsdAmount('');
            }}
            variant="ghost"
            className="w-full text-green-400/70 hover:text-green-400 text-sm"
          >
            Comprar más BTF
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Payment step (Stripe Elements) ──
  if (step === 'pay' && clientSecret && stripePromise && Elements) {
    return (
      <Card className="bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-indigo-950/30 border-blue-500/20 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-400" />
            <span className="text-blue-400 font-bold">Pago con Tarjeta</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Elements stripe={stripePromise} options={{ clientSecret }}>
            <StripeCheckoutForm
              usdAmount={parseFloat(usdAmount)}
              btfAmount={btfAmount}
              purchaseId={purchaseId}
              onSuccess={(hash) => {
                setTxHash(hash);
                setStep('success');
                toast({ title: '✅ BTF recibidos', description: `${btfAmount.toLocaleString()} BTF enviados a tu wallet` });
              }}
              onError={(msg) => {
                setError(msg);
                setStep('input');
                toast({ title: 'Error', description: msg, variant: 'destructive' });
              }}
            />
          </Elements>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setStep('input'); setClientSecret(''); }}
            className="w-full mt-2 text-gray-500 hover:text-white text-xs"
          >
            ← Volver
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Input step ──
  return (
    <Card className="bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-indigo-950/30 border-blue-500/20 backdrop-blur-sm overflow-hidden relative">
      <motion.div
        className="absolute top-0 right-0 w-40 h-40 bg-blue-500/8 rounded-full blur-3xl pointer-events-none"
        animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      <CardHeader className="pb-3 relative">
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-blue-400" />
          <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent text-lg font-bold">
            Agregar BTF Credits con Tarjeta
          </span>
        </CardTitle>
        <p className="text-gray-500 text-xs">
          Paga con tarjeta de crédito/débito • BTF Credits a tu cuenta Boostify
        </p>
      </CardHeader>

      <CardContent className="space-y-3 relative">
        {/* Price info */}
        {quote && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-400">
                  $1 USD = {quote.btfPerDollar.toLocaleString()} BTF
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Min: ${quote.minPurchaseUSD} • Max: ${quote.maxPurchaseUSD}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* USD Input */}
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Monto en USD</p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="0.00"
              value={usdAmount}
              onChange={e => setUsdAmount(e.target.value)}
              disabled={loading}
              className="flex-1 bg-transparent text-2xl font-bold text-white placeholder-gray-600 focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-slate-700/30">
              <DollarSign className="h-5 w-5 text-green-400" />
              <span className="text-sm font-semibold text-white">USD</span>
            </div>
          </div>

          {/* Quick amounts */}
          <div className="flex gap-1.5">
            {quickAmounts.map(amt => (
              <button
                key={amt}
                onClick={() => setUsdAmount(amt)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                  usdAmount === amt
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                    : 'bg-slate-800/40 text-gray-400 hover:text-blue-400 hover:bg-blue-500/10 border-slate-700/20'
                }`}
              >
                ${amt}
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex justify-center">
          <motion.div
            className="p-2 rounded-full bg-slate-800/60 border border-slate-700/30"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <ArrowRight className="h-4 w-4 text-blue-400 rotate-90" />
          </motion.div>
        </div>

        {/* BTF Output Preview */}
        <div className="bg-slate-900/60 rounded-xl p-4 border border-slate-700/30">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">Recibes</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex-1 text-2xl font-bold text-orange-400">
              {calcBTF > 0 ? calcBTF.toLocaleString() : '0'}
            </span>
            <div className="flex items-center gap-2 bg-slate-800/60 rounded-xl px-3 py-2 border border-orange-500/20">
              <img src={BTF_IMG} alt="BTF" className="w-6 h-6 rounded" />
              <span className="text-sm font-semibold text-orange-400">BTF</span>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 flex items-start gap-2"
          >
            <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-red-400">{error}</p>
          </motion.div>
        )}

        {/* Buy button or connect wallet */}
        {!address ? (
          isWeb3Ready ? (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <Button
                  onClick={openConnectModal}
                  className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold"
                >
                  <Wallet className="h-4 w-4 mr-2" /> Conectar Wallet
                </Button>
              )}
            </ConnectButton.Custom>
          ) : (
            <Button className="w-full h-12 opacity-70" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando Web3...
            </Button>
          )
        ) : (
          <Button
            onClick={handleCreatePayment}
            disabled={loading || !isValidAmount || calcBTF <= 0}
            className="w-full h-12 bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white font-semibold disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando pago...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                {isValidAmount
                  ? `Pagar $${parseFloat(usdAmount).toFixed(2)} → ${calcBTF.toLocaleString()} BTF`
                  : quote
                    ? `Mínimo $${quote.minPurchaseUSD} USD`
                    : 'Ingresa un monto'}
              </span>
            )}
          </Button>
        )}

        {/* Info */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <ShieldCheck className="h-3 w-3 text-green-500" />
          <span className="text-[9px] text-gray-600">
            Powered by Stripe • BTF Credits via Polygon Network
          </span>
        </div>
        <UtilityDisclaimer variant="short" size="xs" className="mt-2" />
      </CardContent>
    </Card>
  );
}
