/**
 * TV Monetization Components
 * ──────────────────────────────────────────────────────────────────
 * Three exports:
 *   VideoTipButton    — compact trigger shown on video cards / player
 *   TvRevenuePanel    — artist-facing earnings dashboard (Monetize tab)
 *
 * Design: dark theme, orange-500 accents, slate-900/60 backgrounds
 * (matches the rest of /boostify-tv).
 *
 * Payment flow (VideoTipButton → TipDialog):
 *   1. Fan selects amount → POST /api/tv/monetization/tip/intent
 *   2. Server returns Stripe clientSecret
 *   3. PaymentElement renders, fan confirms
 *   4. POST /api/tv/monetization/tip/confirm → walletTransaction written
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { useToast } from "../../hooks/use-toast";
import { useAuth } from "../../hooks/use-auth";

// UI components
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

// Icons
import {
  Heart,
  DollarSign,
  Loader2,
  TrendingUp,
  Gift,
  Award,
  BarChart3,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Trophy,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VideoTipButtonProps {
  videoId: string;
  videoTitle: string;
  /** DB user id of the artist who owns this video */
  artistId: number | string | undefined;
  artistName?: string;
  /** If true renders a larger button suitable for the video player overlay */
  variant?: "card" | "player";
}

interface TipBreakdown {
  total: number;
  platformFee: number;
  artistAmount: number;
}

interface TipIntentResponse {
  success: boolean;
  clientSecret: string;
  paymentIntentId: string;
  breakdown: TipBreakdown;
}

interface RevenueStats {
  totalTips: number;
  totalRevenue: number;
  totalEarning: number;
  totalPlatformFee: number;
  byVideo: { title: string; count: number; earning: number }[];
  recentTips: { id: number; videoTitle: string; amount: number; earning: number; createdAt: string }[];
  periodDays: number;
}

// ─── Currency helpers ─────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(n);
}

// ─── Stripe lazy-loader ───────────────────────────────────────────────────────

let _stripePromise: Promise<import("@stripe/stripe-js").Stripe | null> | null = null;

function getStripe() {
  if (!_stripePromise) {
    _stripePromise = import("@stripe/stripe-js").then(({ loadStripe }) => {
      const key =
        (import.meta as Record<string, Record<string, string>>).env.VITE_STRIPE_PUBLISHABLE_KEY ??
        (import.meta as Record<string, Record<string, string>>).env.VITE_STRIPE_PUBLIC_KEY ??
        "";
      return loadStripe(key);
    });
  }
  return _stripePromise;
}

// ─── Stripe Payment Form (rendered inside Elements) ──────────────────────────

interface StripeFormProps {
  clientSecret: string;
  paymentIntentId: string;
  onSuccess: () => void;
  onError: (msg: string) => void;
}

function StripePaymentForm({ clientSecret, paymentIntentId, onSuccess, onError }: StripeFormProps) {
  const [mods, setMods] = useState<{
    Elements: React.FC<{ stripe: Promise<import("@stripe/stripe-js").Stripe | null>; options: object; children: React.ReactNode }>;
    PaymentElement: React.FC;
    useStripe: () => import("@stripe/stripe-js").Stripe | null;
    useElements: () => import("@stripe/stripe-js").StripeElements | null;
  } | null>(null);

  useEffect(() => {
    import("@stripe/react-stripe-js").then(mod => {
      setMods({
        Elements: mod.Elements as unknown as StripeFormProps extends never ? never : typeof mod.Elements,
        PaymentElement: mod.PaymentElement as unknown as React.FC,
        useStripe: mod.useStripe as unknown as () => import("@stripe/stripe-js").Stripe | null,
        useElements: mod.useElements as unknown as () => import("@stripe/stripe-js").StripeElements | null,
      });
    });
  }, []);

  if (!mods) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
      </div>
    );
  }

  const { Elements, PaymentElement, useStripe, useElements } = mods;

  function InnerForm() {
    const stripe = useStripe();
    const elements = useElements();
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;
      setLoading(true);
      try {
        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: window.location.href },
          redirect: "if_required",
        });
        if (error) {
          onError(error.message ?? "Payment failed");
          return;
        }
        // Confirm on backend
        await axios.post("/api/tv/monetization/tip/confirm", { paymentIntentId });
        onSuccess();
      } catch (err: unknown) {
        onError(err instanceof Error ? err.message : "Payment failed");
      } finally {
        setLoading(false);
      }
    };

    return (
      <form onSubmit={handleSubmit} className="space-y-4">
        <PaymentElement />
        <Button
          type="submit"
          disabled={loading || !stripe || !elements}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white mt-2"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Heart className="h-4 w-4 mr-2" />}
          {loading ? "Processing…" : "Send Tip"}
        </Button>
      </form>
    );
  }

  return (
    <Elements
      stripe={getStripe()}
      options={{ clientSecret, appearance: { theme: "night", variables: { colorPrimary: "#f97316" } } }}
    >
      <InnerForm />
    </Elements>
  );
}

// ─── Tip Dialog ───────────────────────────────────────────────────────────────

const PRESET_AMOUNTS_CENTS = [100, 200, 500, 1000] as const; // $1 / $2 / $5 / $10

function TipDialog({
  open,
  onClose,
  videoId,
  videoTitle,
  artistId,
  artistName,
}: {
  open: boolean;
  onClose: () => void;
  videoId: string;
  videoTitle: string;
  artistId: number;
  artistName: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<"select" | "pay" | "done">("select");
  const [selectedCents, setSelectedCents] = useState<number>(PRESET_AMOUNTS_CENTS[1]); // default $2
  const [customDollars, setCustomDollars] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [breakdown, setBreakdown] = useState<TipBreakdown | null>(null);

  const getAmountCents = () => {
    if (customDollars) {
      const v = Math.round(parseFloat(customDollars) * 100);
      return isNaN(v) || v < 100 ? null : v;
    }
    return selectedCents;
  };

  const intentMutation = useMutation({
    mutationFn: async (amountCents: number) => {
      const res = await axios.post<TipIntentResponse>("/api/tv/monetization/tip/intent", {
        videoId,
        videoTitle,
        artistId,
        amountCents,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setClientSecret(data.clientSecret);
      setPaymentIntentId(data.paymentIntentId);
      setBreakdown(data.breakdown);
      setStep("pay");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Failed to create payment";
      toast({ title: "Error", description: msg, variant: "destructive" });
    },
  });

  const handleProceed = () => {
    const cents = getAmountCents();
    if (!cents) {
      toast({ title: "Invalid amount", description: "Minimum tip is $1.00", variant: "destructive" });
      return;
    }
    intentMutation.mutate(cents);
  };

  const handleSuccess = () => {
    setStep("done");
    toast({
      title: "Tip sent! 🎉",
      description: `${artistName} will love your support.`,
    });
  };

  const handleClose = () => {
    onClose();
    // Reset after close animation
    setTimeout(() => {
      setStep("select");
      setCustomDollars("");
      setSelectedCents(PRESET_AMOUNTS_CENTS[1]);
      setClientSecret("");
      setBreakdown(null);
    }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && handleClose()}>
      <DialogContent className="max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Heart className="h-5 w-5 text-orange-500" />
            {step === "done" ? "Tip Sent!" : `Support ${artistName}`}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {step === "select" && `Tip the artist for "${videoTitle}"`}
            {step === "pay" && "Enter your card details to complete the tip"}
            {step === "done" && "Your support goes directly to the artist"}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* Step 1: Amount selection */}
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                {PRESET_AMOUNTS_CENTS.map(cents => (
                  <Button
                    key={cents}
                    variant={selectedCents === cents && !customDollars ? "default" : "outline"}
                    className={`transition-all ${selectedCents === cents && !customDollars ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : "border-slate-600 text-slate-300 hover:border-orange-500/50"}`}
                    onClick={() => { setSelectedCents(cents); setCustomDollars(""); }}
                  >
                    ${cents / 100}
                  </Button>
                ))}
              </div>

              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  step="0.50"
                  placeholder="Custom amount"
                  value={customDollars}
                  onChange={e => setCustomDollars(e.target.value)}
                  className="w-full pl-7 pr-4 py-2 rounded-md bg-slate-800 border border-slate-600 text-white text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="bg-slate-800/60 rounded-lg p-3 text-xs text-slate-400 space-y-1">
                <div className="flex justify-between">
                  <span>You pay</span>
                  <span className="text-white">{fmt((getAmountCents() ?? 0) / 100)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Artist receives (~85%)</span>
                  <span className="text-green-400">{fmt(((getAmountCents() ?? 0) / 100) * 0.85)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform fee (15%)</span>
                  <span>{fmt(((getAmountCents() ?? 0) / 100) * 0.15)}</span>
                </div>
              </div>

              <Button
                onClick={handleProceed}
                disabled={!getAmountCents() || intentMutation.isPending}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {intentMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Preparing…</>
                  : <><Heart className="h-4 w-4 mr-2" />Continue to Payment</>}
              </Button>
            </motion.div>
          )}

          {/* Step 2: Stripe payment */}
          {step === "pay" && clientSecret && (
            <motion.div key="pay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              {breakdown && (
                <div className="flex justify-between text-sm bg-slate-800/60 rounded-lg p-3">
                  <span className="text-slate-400">Sending to {artistName}</span>
                  <span className="text-green-400 font-semibold">{fmt(breakdown.artistAmount)}</span>
                </div>
              )}
              <StripePaymentForm
                clientSecret={clientSecret}
                paymentIntentId={paymentIntentId}
                onSuccess={handleSuccess}
                onError={msg => toast({ title: "Payment failed", description: msg, variant: "destructive" })}
              />
              <Button variant="ghost" className="w-full text-slate-400 hover:text-slate-200" onClick={() => setStep("select")}>
                ← Change amount
              </Button>
            </motion.div>
          )}

          {/* Step 3: Success */}
          {step === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-4 py-6 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                className="w-16 h-16 rounded-full bg-orange-500/20 flex items-center justify-center"
              >
                <Heart className="h-8 w-8 text-orange-500 fill-orange-500" />
              </motion.div>
              <p className="text-white font-semibold text-lg">Thank you!</p>
              <p className="text-slate-400 text-sm max-w-xs">
                Your tip has been sent to {artistName}. They'll be notified and your support helps them keep creating.
              </p>
              <Button onClick={handleClose} className="bg-orange-500 hover:bg-orange-600 text-white">
                Done
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

// ─── VideoTipButton — public export ──────────────────────────────────────────

export function VideoTipButton({ videoId, videoTitle, artistId, artistName = "Artist", variant = "card" }: VideoTipButtonProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  // Don't render if no artistId
  if (!artistId) return null;

  const artistIdNum = typeof artistId === "string" ? parseInt(artistId, 10) : artistId;
  if (isNaN(artistIdNum)) return null;

  // Don't show tip button on your own videos
  if (user && (user as Record<string, unknown>).id === artistId) return null;

  if (variant === "player") {
    return (
      <>
        <Button
          size="sm"
          className="bg-orange-500/90 hover:bg-orange-500 text-white shadow-lg shadow-orange-500/30 gap-1.5"
          onClick={() => setOpen(true)}
          data-testid={`button-tip-player-${videoId}`}
        >
          <Heart className="h-3.5 w-3.5" />
          Tip Artist
        </Button>
        {open && (
          <TipDialog
            open={open}
            onClose={() => setOpen(false)}
            videoId={videoId}
            videoTitle={videoTitle}
            artistId={artistIdNum}
            artistName={artistName}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 hover:text-orange-500 transition-colors"
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        title={`Tip ${artistName}`}
        data-testid={`button-tip-${videoId}`}
      >
        <Heart className="h-4 w-4" />
      </Button>
      {open && (
        <TipDialog
          open={open}
          onClose={() => setOpen(false)}
          videoId={videoId}
          videoTitle={videoTitle}
          artistId={artistIdNum}
          artistName={artistName}
        />
      )}
    </>
  );
}

// ─── TvRevenuePanel — artist-facing earnings panel ───────────────────────────

export function TvRevenuePanel() {
  const [days, setDays] = useState(30);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ success: boolean; stats: RevenueStats }>({
    queryKey: ["/api/tv/monetization/revenue", { days }],
    staleTime: 60_000,
  });

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">
            TV <span className="text-orange-500">Revenue</span>
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">Earnings from fan tips on your videos</p>
        </div>

        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? "default" : "outline"}
              className={days === d ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500" : "border-slate-600 text-slate-300 hover:border-orange-500/50"}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
          <Button
            variant="outline"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            className="border-slate-600"
          >
            <TrendingUp className={`h-4 w-4 ${isFetching ? "animate-pulse" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[72px] rounded-xl" />)
        ) : (
          <>
            <StatCard label="Your Earnings" value={fmt(stats?.totalEarning ?? 0)} icon={DollarSign} color="text-green-400" />
            <StatCard label="Total Tips" value={stats?.totalTips ?? 0} icon={Heart} color="text-orange-500" />
            <StatCard label="Total Revenue" value={fmt(stats?.totalRevenue ?? 0)} icon={BarChart3} color="text-blue-400" />
            <StatCard label="Unique Videos" value={stats?.byVideo?.length ?? 0} icon={Sparkles} color="text-purple-400" />
          </>
        )}
      </div>

      {isError && (
        <Card className="p-8 text-center bg-slate-900/60 border-slate-700/50">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="font-medium">Failed to load revenue data</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => refetch()}>Retry</Button>
        </Card>
      )}

      {!isLoading && !isError && (stats?.totalTips ?? 0) === 0 && (
        <Card className="p-12 text-center bg-slate-900/60 border-slate-700/50">
          <Gift className="h-14 w-14 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-1">No tips yet this period</h3>
          <p className="text-sm text-muted-foreground">
            When fans tip your videos, earnings will appear here. Make sure your videos are visible on Boostify TV!
          </p>
        </Card>
      )}

      {/* Top videos */}
      {!isLoading && (stats?.byVideo?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" /> Top Tipped Videos
          </h3>
          <div className="space-y-2">
            {stats!.byVideo.map((v, i) => (
              <Card key={v.title} className="p-3 bg-slate-900/60 border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-slate-500 w-6 text-center">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{v.title}</p>
                    <p className="text-xs text-muted-foreground">{v.count} tip{v.count !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-400">{fmt(v.earning)}</p>
                    <p className="text-xs text-muted-foreground">earned</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent tips */}
      {!isLoading && (stats?.recentTips?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" /> Recent Tips
          </h3>
          <div className="space-y-2">
            {stats!.recentTips.map(tip => (
              <div key={tip.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                <div className="flex items-center gap-3">
                  <div className="p-1.5 rounded-full bg-orange-500/10">
                    <Heart className="h-3.5 w-3.5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate max-w-[200px]">{tip.videoTitle}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(tip.createdAt), "MMM d, yyyy")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-orange-500">{fmt(tip.amount)}</p>
                  <p className="text-xs text-green-400">+{fmt(tip.earning)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leaderboard teaser */}
      <LeaderboardTeaser />
    </div>
  );
}

// ─── Leaderboard teaser — embedded inside Revenue panel ──────────────────────

interface LeaderboardEntry {
  artistId: number;
  artistName: string;
  artistSlug: string | null;
  totalEarning: number;
  tipCount: number;
}

function LeaderboardTeaser() {
  const { data, isLoading } = useQuery<{ success: boolean; leaderboard: LeaderboardEntry[] }>({
    queryKey: ["/api/tv/monetization/top-tipped"],
    staleTime: 120_000,
  });

  const list = data?.leaderboard ?? [];
  if (!isLoading && list.length === 0) return null;

  return (
    <div>
      <h3 className="text-base font-semibold mb-3 flex items-center gap-2">
        <Award className="h-4 w-4 text-orange-500" /> Top Tipped Artists (30 days)
      </h3>
      <div className="space-y-2">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)
          : list.map((entry, i) => (
              <Card key={entry.artistId} className="p-3 bg-slate-900/60 border-slate-700/50">
                <div className="flex items-center gap-3">
                  <span className={`text-base font-bold w-5 text-center ${i === 0 ? "text-yellow-400" : i === 1 ? "text-slate-300" : i === 2 ? "text-orange-600" : "text-slate-500"}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{entry.artistName}</p>
                    <p className="text-xs text-muted-foreground">{entry.tipCount} tip{entry.tipCount !== 1 ? "s" : ""}</p>
                  </div>
                  <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 text-xs">
                    {fmt(entry.totalEarning)}
                  </Badge>
                </div>
              </Card>
            ))}
      </div>
    </div>
  );
}

// ─── StatCard helper ──────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: React.FC<{ className?: string }>; color: string }) {
  return (
    <Card className="p-4 bg-slate-900/60 border-slate-700/50">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-800/80">
          <Icon className={`h-5 w-5 ${color}`} />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      </div>
    </Card>
  );
}
