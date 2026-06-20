/**
 * Standalone Spotify Boost Pro pricing modal.
 * Same business model as Instagram Boost Pro — standalone tool, no full suite required.
 * Monthly $19, Quarterly $16/mo, Annual $12/mo.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { SiSpotify } from 'react-icons/si';
import { useAuth } from '../../hooks/use-auth';
import { useToast } from '../../hooks/use-toast';
import {
  Crown, X, Check, Sparkles, Zap, Shield,
  Music, Radio, ListMusic, BarChart3, TrendingUp, Mail,
  Download, PartyPopper, Clock, Star, ArrowRight, Infinity
} from 'lucide-react';
import { SPOTIFY_BOOST_STANDALONE_PRICES } from '../../../../shared/constants';

type BillingCycle = 'monthly' | 'quarterly' | 'annual';

interface SpotifyPricingProps {
  open: boolean;
  onClose: () => void;
}

const BILLING_OPTIONS: { key: BillingCycle; label: string; price: number; per: string; billed: string; savings?: string; popular?: boolean }[] = [
  {
    key: 'monthly',
    label: 'Monthly',
    price: 19,
    per: '$19/mo',
    billed: '$19 billed every month',
  },
  {
    key: 'quarterly',
    label: 'Quarterly',
    price: 16,
    per: '$16/mo',
    billed: '$48 billed every 3 months',
    savings: 'Save 16%',
  },
  {
    key: 'annual',
    label: 'Annual',
    price: 12,
    per: '$12/mo',
    billed: '$144 billed every 12 months',
    savings: 'Save 37%',
    popular: true,
  },
];

const FREE_FEATURES = [
  { text: '3 AI tool uses per day', included: true },
  { text: '1 content generation/day', included: true },
  { text: 'Extension sync', included: true },
  { text: 'Basic analytics', included: true },
  { text: 'Unlimited AI tools', included: false },
  { text: 'Unlimited extractions', included: false },
  { text: 'Curator finder & pitches', included: false },
  { text: 'Full analytics & reports', included: false },
];

const PRO_FEATURES = [
  { icon: Infinity, text: 'Unlimited AI tools & content generation' },
  { icon: ListMusic, text: 'Unlimited playlist matching & discovery' },
  { icon: Mail, text: 'AI-powered curator pitches & outreach' },
  { icon: Radio, text: 'Spotify SEO optimizer & keyword analysis' },
  { icon: TrendingUp, text: 'Monthly listener prediction engine' },
  { icon: Music, text: 'Release strategy & pre-save campaigns' },
  { icon: BarChart3, text: 'Full analytics, reports & CSV export' },
  { icon: Download, text: 'Export data to XLSX or CSV format' },
  { icon: Sparkles, text: 'AI bio writer, press kit & EPK generator' },
  { icon: Star, text: 'Priority support & early feature access' },
];

export function SpotifyPricing({ open, onClose }: SpotifyPricingProps) {
  const [billing, setBilling] = useState<BillingCycle>('annual');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const selectedOption = BILLING_OPTIONS.find(b => b.key === billing)!;

  async function handleSubscribe() {
    if (!user) {
      toast({ title: 'Please log in first', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const priceId = SPOTIFY_BOOST_STANDALONE_PRICES.pro[billing];
      const res = await fetch('/api/stripe/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ priceId, product: 'spotify_boost' }),
      });
      if (!res.ok) throw new Error('Failed to create checkout session');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.message || 'No checkout URL returned');
      }
    } catch (err: any) {
      toast({ title: 'Checkout error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 350 }}
            className="fixed inset-0 z-[1001] flex items-center justify-center p-3 sm:p-6"
            onClick={(e) => e.target === e.currentTarget && onClose()}
          >
            <div className="bg-card border-2 border-green-500/30 rounded-2xl shadow-2xl shadow-green-500/10 w-full max-w-2xl max-h-[92dvh] overflow-y-auto">

              {/* Header */}
              <div className="relative bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 p-5 sm:p-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="absolute top-3 right-3 text-white/70 hover:text-white hover:bg-white/10 h-8 w-8 rounded-full"
                >
                  <X className="h-4 w-4" />
                </Button>

                <div className="flex items-center gap-3 mb-3">
                  <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center">
                    <SiSpotify className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg sm:text-xl">
                      Spotify Boost Pro
                    </h2>
                    <p className="text-white/80 text-xs sm:text-sm">
                      Standalone tool — no full suite required
                    </p>
                  </div>
                </div>

                {/* Limited Time Offer badge */}
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1"
                >
                  <PartyPopper className="w-4 h-4 text-amber-200" />
                  <span className="text-white font-semibold text-xs">
                    Limited Time Offer (Apr 2026)
                  </span>
                </motion.div>
              </div>

              {/* Content */}
              <div className="p-4 sm:p-6 space-y-5">

                {/* Free vs Pro comparison */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Free column */}
                  <div className="rounded-xl border border-border p-4">
                    <div className="text-center mb-4">
                      <Badge variant="outline" className="text-xs mb-2">Current Plan</Badge>
                      <h3 className="font-bold text-lg text-foreground">Free Trial</h3>
                      <p className="text-2xl font-black text-muted-foreground mt-1">$0</p>
                    </div>
                    <ul className="space-y-2.5">
                      {FREE_FEATURES.map((f) => (
                        <li key={f.text} className="flex items-center gap-2 text-xs">
                          {f.included ? (
                            <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          ) : (
                            <X className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={f.included ? 'text-foreground' : 'text-muted-foreground/50 line-through'}>
                            {f.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Pro column */}
                  <div className="relative rounded-xl border-2 border-green-500/50 bg-green-500/5 p-4">
                    <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-600 to-emerald-600 text-white text-[10px] px-2.5 py-0.5 border-0 font-semibold">
                      RECOMMENDED
                    </Badge>
                    <div className="text-center mb-4 pt-1">
                      <div className="inline-flex items-center gap-1.5 mb-2">
                        <Crown className="w-4 h-4 text-amber-400" />
                        <span className="font-bold text-sm text-amber-400">PRO</span>
                      </div>
                      <h3 className="font-bold text-lg text-foreground">Spotify Boost Pro</h3>
                      <div className="flex items-baseline justify-center gap-1 mt-1">
                        <span className="text-sm text-muted-foreground line-through">$29</span>
                        <span className="text-3xl font-black bg-gradient-to-r from-green-500 to-emerald-400 bg-clip-text text-transparent">
                          ${selectedOption.price}
                        </span>
                        <span className="text-xs text-muted-foreground">/mo</span>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {PRO_FEATURES.map((f) => (
                        <li key={f.text} className="flex items-center gap-2 text-xs">
                          <f.icon className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          <span className="text-foreground font-medium">{f.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Billing cycle selector */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-3 text-center">Choose your billing cycle</p>
                  <div className="grid grid-cols-3 gap-2">
                    {BILLING_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => setBilling(opt.key)}
                        className={`relative rounded-xl border-2 p-3 text-center transition-all ${
                          billing === opt.key
                            ? 'border-green-500 bg-green-500/5 shadow-lg shadow-green-500/10'
                            : 'border-border hover:border-green-500/30'
                        }`}
                      >
                        {opt.popular && (
                          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[9px] px-1.5 py-0 border-0 font-semibold">
                            Most Popular
                          </Badge>
                        )}
                        {opt.savings && (
                          <Badge className="absolute -top-2 right-1 bg-green-500 text-white text-[9px] px-1.5 py-0 border-0">
                            {opt.savings}
                          </Badge>
                        )}
                        <div className="text-[10px] text-muted-foreground font-medium pt-1">{opt.label}</div>
                        <div className="flex items-baseline justify-center gap-0.5 mt-1">
                          <span className={`text-lg font-black ${billing === opt.key ? 'bg-gradient-to-r from-green-500 to-emerald-400 bg-clip-text text-transparent' : 'text-foreground'}`}>
                            ${opt.price}
                          </span>
                          <span className="text-[10px] text-muted-foreground">/mo</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{opt.billed}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CTA */}
                <Button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full h-12 text-sm font-bold rounded-xl bg-gradient-to-r from-green-600 via-emerald-600 to-green-700 text-white hover:opacity-90 shadow-lg shadow-green-500/20 transition-all"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Redirecting to Stripe...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4" />
                      Start Pro — {selectedOption.per}
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  )}
                </Button>

                {/* Footer */}
                <div className="flex flex-col items-center gap-1 pt-1">
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> Secure payment</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Cancel anytime</span>
                    <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant access</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/60">
                    7-day money-back guarantee · Powered by Stripe
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
