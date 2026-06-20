/**
 * Inline subscription banner for Instagram Boost.
 * Shows remaining daily actions with progress bar for free-tier users.
 * Orange-500 → Red-500 gradient. Auto-hides for paid plans.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Crown, X, Zap, Timer } from 'lucide-react';
import type { IgPlan } from '../../hooks/use-ig-boost-limits';

interface SubscriptionBannerProps {
  show: boolean;
  onDismiss: () => void;
  onOpenPricing?: () => void;
  plan: IgPlan;
  usage: {
    aiTools: number;
    create: number;
    growth: number;
    analytics: number;
    extractions: number;
  };
  /** Cheapest paid-tier price (used in the CTA). Defaults to $12/mo. */
  upgradePrice?: string;
}

// Free tier: 5 per feature × 5 features = 25 actions/day.
// Stays in sync with PLAN_LIMITS.free in use-ig-boost-limits.ts — if you raise
// any per-feature cap, update this constant too.
const FREE_DAILY_LIMIT = 25;

export function SubscriptionBanner({
  show,
  onDismiss,
  plan,
  usage,
  onOpenPricing,
  upgradePrice = '$12/mo',
}: SubscriptionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  // Auto-hide for paid plans or after the subscription check resolves a non-free tier
  if (plan !== 'free' || dismissed) return null;

  const totalUsed =
    usage.aiTools + usage.create + usage.growth + usage.analytics + usage.extractions;
  const remaining = Math.max(0, FREE_DAILY_LIMIT - totalUsed);
  const pct = Math.min((totalUsed / FREE_DAILY_LIMIT) * 100, 100);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative rounded-xl border border-orange-500/30 bg-gradient-to-r from-orange-950/60 via-red-950/40 to-orange-950/60 p-4 mb-4"
        >
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-muted-foreground hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Icon + Title */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-600/20 flex items-center justify-center">
                <Crown className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-amber-400" /> Instagram Boost Pro
                </p>
                <p className="text-[11px] text-orange-300/70">
                  {remaining > 0
                    ? `${remaining} free actions remaining today`
                    : 'Daily limit reached — upgrade for unlimited'}
                </p>
              </div>
            </div>

            <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/20 text-[10px] gap-1">
              <Timer className="w-3 h-3" /> Free Tier
            </Badge>

            {/* Progress bar */}
            <div className="flex-1 min-w-[120px]">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>Daily usage</span>
                <span>{totalUsed}/{FREE_DAILY_LIMIT}</span>
              </div>
              <div className="h-1.5 bg-orange-950 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 80
                      ? 'bg-gradient-to-r from-red-500 to-red-400'
                      : 'bg-gradient-to-r from-orange-500 to-red-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>

            {/* CTA */}
            <Button
              size="sm"
              onClick={() => { handleDismiss(); onOpenPricing?.(); }}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs h-8 gap-1 shrink-0 hover:opacity-90 shadow-lg shadow-orange-500/20"
            >
              <Zap className="w-3 h-3" /> Upgrade to Pro — {upgradePrice}
            </Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
