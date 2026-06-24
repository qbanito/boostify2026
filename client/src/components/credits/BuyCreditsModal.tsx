/**
 * BuyCreditsModal
 * ===============
 * Elegant credit-purchase modal. Lists credit packages from the server, shows an
 * English purchase agreement that the buyer must accept, then opens a Stripe
 * hosted Checkout session. On return (?credits_session=...) the CreditsWidget
 * verifies and settles the purchase.
 */

import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Sparkles, Zap, ShieldCheck, Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface CreditPackage {
  id: string;
  credits: number;
  priceUsd: number;
  popular: boolean;
  label: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  email: string;
  tier?: string;
  accentColor?: string;
  primaryColor?: string;
}

export default function BuyCreditsModal({
  open,
  onClose,
  email,
  tier = 'free',
  accentColor = '#f97316',
  primaryColor = '#ec4899',
}: Props) {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  const { data: packagesData } = useQuery({
    queryKey: ['credit-packages'],
    queryFn: async () => {
      const res = await apiRequest('/api/credits/packages', { method: 'GET' });
      return (res?.packages || res || []) as CreditPackage[];
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  const packages = useMemo<CreditPackage[]>(() => {
    if (Array.isArray(packagesData) && packagesData.length) return packagesData;
    // Fallback so the modal always renders something.
    return [
      { id: 'starter', credits: 500, priceUsd: 4.99, popular: false, label: 'Starter' },
      { id: 'basic', credits: 1200, priceUsd: 9.99, popular: false, label: 'Basic' },
      { id: 'standard', credits: 3000, priceUsd: 24.99, popular: true, label: 'Standard' },
      { id: 'pro', credits: 7500, priceUsd: 49.99, popular: false, label: 'Pro' },
      { id: 'studio', credits: 20000, priceUsd: 99.99, popular: false, label: 'Studio' },
      { id: 'enterprise', credits: 60000, priceUsd: 249.99, popular: false, label: 'Enterprise' },
    ];
  }, [packagesData]);

  const selected = packages.find((p) => p.id === selectedId) || null;

  const handleCheckout = async () => {
    if (!selected) {
      toast({ title: 'Select a package', description: 'Choose a credit package to continue.', variant: 'destructive' });
      return;
    }
    if (!accepted) {
      toast({ title: 'Accept the agreement', description: 'Please accept the purchase agreement to continue.', variant: 'destructive' });
      return;
    }
    if (!email) {
      toast({ title: 'Sign in required', description: 'You need to be signed in to buy credits.', variant: 'destructive' });
      return;
    }

    setRedirecting(true);
    try {
      const res = await apiRequest('/api/credits/create-checkout-session', {
        method: 'POST',
        data: {
          email,
          packageId: selected.id,
          tier,
          successUrl: window.location.href.split('#')[0],
          cancelUrl: window.location.href.split('#')[0],
        },
      });
      if (res?.url) {
        window.location.href = res.url; // redirect to Stripe Checkout
      } else {
        throw new Error('No checkout URL returned');
      }
    } catch (e: any) {
      setRedirecting(false);
      toast({ title: 'Checkout failed', description: e?.message || 'Could not start checkout.', variant: 'destructive' });
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={redirecting ? undefined : onClose} />

          <motion.div
            className="relative w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border shadow-2xl"
            style={{
              background: 'linear-gradient(160deg, rgba(12,12,16,0.98) 0%, rgba(20,18,26,0.98) 100%)',
              borderColor: `${accentColor}55`,
              boxShadow: `0 0 60px ${accentColor}33`,
            }}
            initial={{ scale: 0.94, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.94, y: 20 }}
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between p-5 border-b border-white/10 backdrop-blur-md bg-black/40">
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                >
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white leading-tight">Buy Credits</h2>
                  <p className="text-xs text-gray-400">Power your AI tools — images, video, voice & more</p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={redirecting}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Packages */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {packages.map((pkg) => {
                  const isSel = pkg.id === selectedId;
                  const perCredit = (pkg.priceUsd / pkg.credits) * 100; // cents shown as value
                  return (
                    <button
                      key={pkg.id}
                      onClick={() => setSelectedId(pkg.id)}
                      className="relative text-left rounded-xl p-4 border transition-all"
                      style={{
                        borderColor: isSel ? accentColor : 'rgba(255,255,255,0.12)',
                        background: isSel
                          ? `linear-gradient(135deg, ${primaryColor}22, ${accentColor}22)`
                          : 'rgba(255,255,255,0.03)',
                        boxShadow: isSel ? `0 0 20px ${accentColor}44` : 'none',
                      }}
                    >
                      {pkg.popular && (
                        <span
                          className="absolute -top-2 right-3 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
                        >
                          POPULAR
                        </span>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-gray-300">{pkg.label}</span>
                        {isSel && <Check className="h-4 w-4" style={{ color: accentColor }} />}
                      </div>
                      <div className="mt-2 flex items-baseline gap-1">
                        <Zap className="h-4 w-4" style={{ color: accentColor }} />
                        <span className="text-xl font-extrabold text-white">{pkg.credits.toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-gray-400">credits</div>
                      <div className="mt-2 text-sm font-bold text-white">${pkg.priceUsd.toFixed(2)}</div>
                    </button>
                  );
                })}
              </div>

              {/* Purchase agreement (English) */}
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck className="h-4 w-4" style={{ color: accentColor }} />
                  <h3 className="text-sm font-bold text-white">Purchase Agreement</h3>
                </div>
                <div className="text-[11px] leading-relaxed text-gray-400 max-h-32 overflow-y-auto pr-2 space-y-1.5">
                  <p>
                    By completing this purchase you agree to buy a one-time, non-refundable allotment of Boostify
                    AI credits. Credits are a prepaid digital balance used to access AI-powered features (image,
                    video, audio, voice, text and related generation services).
                  </p>
                  <p>
                    <strong className="text-gray-300">Consumption.</strong> Credits are deducted as you use AI
                    features, at the per-operation rates shown at the time of use. Rates may change; the rate
                    applied is the one displayed when the operation runs.
                  </p>
                  <p>
                    <strong className="text-gray-300">No expiration of purchased credits.</strong> Purchased
                    credits do not expire. Monthly plan credits granted by your subscription are valid for that
                    billing period only and do not roll over.
                  </p>
                  <p>
                    <strong className="text-gray-300">Refunds.</strong> Credit purchases are final and
                    non-refundable except where required by law. Credits have no cash value and cannot be
                    transferred or redeemed for cash.
                  </p>
                  <p>
                    <strong className="text-gray-300">Payment.</strong> Payments are processed securely by Stripe.
                    Boostify does not store your card details. Taxes may apply based on your location.
                  </p>
                </div>
                <label className="mt-3 flex items-start gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={accepted}
                    onChange={(e) => setAccepted(e.target.checked)}
                    className="mt-0.5 accent-current"
                    style={{ accentColor }}
                  />
                  <span className="text-xs text-gray-300">
                    I have read and agree to the Purchase Agreement and understand credits are non-refundable.
                  </span>
                </label>
              </div>

              {/* Summary + CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-sm text-gray-300">
                  {selected ? (
                    <>
                      <span className="font-bold text-white">{selected.credits.toLocaleString()}</span> credits ·{' '}
                      <span className="font-bold text-white">${selected.priceUsd.toFixed(2)}</span>
                    </>
                  ) : (
                    <span className="text-gray-500">Select a package to continue</span>
                  )}
                </div>
                <button
                  onClick={handleCheckout}
                  disabled={!selected || !accepted || redirecting}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full font-bold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:scale-[1.02]"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})`, boxShadow: `0 4px 20px ${accentColor}55` }}
                >
                  {redirecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="h-4 w-4" /> Continue to secure checkout
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
