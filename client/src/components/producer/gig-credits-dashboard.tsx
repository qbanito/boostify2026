/**
 * GigCreditsDashboard — Full credits management panel
 * Shows balance, buy packages, view rewards, messages inbox, transaction history
 */

import { useState, useEffect } from "react";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";
import {
  Coins, ShoppingCart, Gift, Mail, History, Sparkles,
  CheckCircle2, ArrowRight, Loader2, CreditCard, TrendingUp,
  Star, Zap, Crown, ExternalLink, Bell, MailOpen,
} from "lucide-react";

// ── Types ──

interface GigCreditAccount {
  balance: number;
  totalPurchased: number;
  totalSpent: number;
  totalEarned: number;
}

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  bonusCredits: number;
  priceUsd: number;
  savings: string;
  popular?: boolean;
}

interface CreditReward {
  type: string;
  credits: number;
  title: string;
  description: string;
  icon: string;
  oneTime: boolean;
  claimed: boolean;
  canClaim: boolean;
}

interface AutoMessage {
  id: number;
  type: string;
  title: string;
  content: string;
  actionUrl?: string;
  actionLabel?: string;
  read: boolean;
  createdAt: string;
}

interface CreditTransaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  balanceAfter: number;
  createdAt: string;
}

// ── Component ──

export default function GigCreditsDashboard({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [purchasing, setPurchasing] = useState<string | null>(null);

  // ── Queries ──

  const { data: account } = useQuery<GigCreditAccount>({
    queryKey: ["/api/gig-credits/balance"],
    enabled: open,
  });

  const { data: packages } = useQuery<CreditPackage[]>({
    queryKey: ["/api/gig-credits/packages"],
    enabled: open,
  });

  const { data: rewards } = useQuery<CreditReward[]>({
    queryKey: ["/api/gig-credits/rewards"],
    enabled: open && activeTab === "rewards",
  });

  const { data: messages } = useQuery<AutoMessage[]>({
    queryKey: ["/api/gig-credits/messages"],
    enabled: open && activeTab === "inbox",
  });

  const { data: transactions } = useQuery<CreditTransaction[]>({
    queryKey: ["/api/gig-credits/transactions"],
    enabled: open && activeTab === "history",
  });

  // ── Auto-verify Stripe redirect ──
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const creditsStatus = params.get("credits");

    if (sessionId && creditsStatus === "success") {
      verifyCheckout(sessionId);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("session_id");
      url.searchParams.delete("credits");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  async function verifyCheckout(sessionId: string) {
    try {
      const result = await apiRequest("POST", "/api/gig-credits/verify-checkout", { sessionId });
      if (result.success) {
        toast({
          title: "💰 Credits Added!",
          description: `${result.credits} gig credits added to your account.`,
        });
        queryClient.invalidateQueries({ queryKey: ["/api/gig-credits/balance"] });
      }
    } catch (error) {
      console.error("Failed to verify checkout:", error);
    }
  }

  // ── Buy Package ──

  async function handleBuyPackage(packageId: string) {
    setPurchasing(packageId);
    try {
      const result = await apiRequest("POST", "/api/gig-credits/checkout", { packageId });

      if (result.url) {
        window.location.href = result.url;
      } else {
        // Fallback: use stripe.js
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripeKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
        const stripe = await loadStripe(stripeKey);
        if (stripe && result.sessionId) {
          await stripe.redirectToCheckout({ sessionId: result.sessionId });
        }
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setPurchasing(null);
    }
  }

  // ── Claim Reward ──

  const claimMutation = useMutation({
    mutationFn: (rewardType: string) =>
      apiRequest("POST", "/api/gig-credits/rewards/claim", { rewardType }),
    onSuccess: (data) => {
      toast({
        title: "🎁 Reward Claimed!",
        description: `+${data.creditsAwarded} credits added to your balance!`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/gig-credits/rewards"] });
      queryClient.invalidateQueries({ queryKey: ["/api/gig-credits/balance"] });
    },
    onError: (error: any) => {
      toast({ title: "Cannot claim", description: error.message, variant: "destructive" });
    },
  });

  // ── Mark Message Read ──

  async function markRead(id: number) {
    await apiRequest("PATCH", `/api/gig-credits/messages/${id}/read`, {});
    queryClient.invalidateQueries({ queryKey: ["/api/gig-credits/messages"] });
  }

  const balance = account?.balance ?? 0;
  const unreadCount = messages?.filter(m => !m.read).length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-900 border-slate-700 p-0">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-white flex items-center gap-2 text-lg">
            <Coins className="h-5 w-5 text-amber-400" />
            Gig Credits
          </DialogTitle>
        </DialogHeader>

        {/* ── Balance Banner ── */}
        <div className="mx-5 mt-3 bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-rose-500/20 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-amber-300/70 uppercase tracking-wider font-medium">Your Balance</div>
              <div className="text-3xl font-black text-white mt-0.5">
                {balance}
                <span className="text-sm font-medium text-amber-300 ml-1">credits</span>
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                1 credit = $1 · Apply to gigs starting at 1 credit
              </div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                <TrendingUp className="h-3 w-3" /> Purchased: <span className="text-slate-300">{account?.totalPurchased ?? 0}</span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                <Zap className="h-3 w-3" /> Spent: <span className="text-slate-300">{account?.totalSpent ?? 0}</span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1 justify-end">
                <Gift className="h-3 w-3" /> Earned: <span className="text-emerald-400">{account?.totalEarned ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Tabs ── */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="px-5 pb-5 mt-3">
          <TabsList className="bg-slate-800 border border-slate-700 w-full grid grid-cols-4 h-9">
            <TabsTrigger value="overview" className="text-xs data-[state=active]:bg-amber-500/20 data-[state=active]:text-amber-300">
              <ShoppingCart className="h-3.5 w-3.5 mr-1" /> Buy
            </TabsTrigger>
            <TabsTrigger value="rewards" className="text-xs data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-300">
              <Gift className="h-3.5 w-3.5 mr-1" /> Rewards
            </TabsTrigger>
            <TabsTrigger value="inbox" className="text-xs data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-300 relative">
              <Mail className="h-3.5 w-3.5 mr-1" /> Inbox
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] font-bold text-white rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-xs data-[state=active]:bg-purple-500/20 data-[state=active]:text-purple-300">
              <History className="h-3.5 w-3.5 mr-1" /> History
            </TabsTrigger>
          </TabsList>

          {/* ── BUY CREDITS ── */}
          <TabsContent value="overview" className="mt-4 space-y-3">
            <p className="text-xs text-slate-400">
              Buy credits to apply for music gigs. Each application costs 5% of the job budget (e.g., $200 gig = 10 credits).
            </p>
            <div className="grid gap-3">
              {(packages || []).map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`relative bg-slate-800/60 border-slate-700 p-4 hover:border-amber-500/50 transition-all cursor-pointer ${
                    pkg.popular ? "border-amber-500/40 ring-1 ring-amber-500/20" : ""
                  }`}
                  onClick={() => handleBuyPackage(pkg.id)}
                >
                  {pkg.popular && (
                    <Badge className="absolute -top-2 right-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px] font-bold px-2 py-0.5 border-0">
                      <Star className="h-3 w-3 mr-0.5" /> MOST POPULAR
                    </Badge>
                  )}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        pkg.popular
                          ? "bg-gradient-to-br from-amber-500 to-orange-500"
                          : "bg-slate-700"
                      }`}>
                        <Coins className={`h-5 w-5 ${pkg.popular ? "text-white" : "text-amber-400"}`} />
                      </div>
                      <div>
                        <div className="font-bold text-white text-sm">{pkg.name}</div>
                        <div className="text-xs text-slate-400">
                          {pkg.credits} credits
                          {pkg.bonusCredits > 0 && (
                            <span className="text-emerald-400 font-semibold ml-1">
                              +{pkg.bonusCredits} bonus!
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-white text-lg">${pkg.priceUsd}</div>
                      {pkg.savings !== "0%" && (
                        <div className="text-[10px] text-emerald-400 font-medium">Save {pkg.savings}</div>
                      )}
                    </div>
                  </div>
                  {purchasing === pkg.id && (
                    <div className="absolute inset-0 bg-slate-900/80 rounded-lg flex items-center justify-center">
                      <Loader2 className="h-5 w-5 animate-spin text-amber-400" />
                      <span className="text-sm text-amber-300 ml-2">Redirecting to Stripe...</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Revenue model info */}
            <div className="bg-slate-800/40 rounded-xl p-3 border border-slate-700/50 mt-4">
              <div className="text-[11px] text-slate-500 font-medium uppercase tracking-wider mb-2">How it works</div>
              <div className="space-y-1.5">
                <div className="text-xs text-slate-400 flex items-start gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span><b className="text-slate-300">Buy credits</b> — 1 credit = $1, min purchase $10</span>
                </div>
                <div className="text-xs text-slate-400 flex items-start gap-2">
                  <Zap className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span><b className="text-slate-300">Apply to gigs</b> — costs 5% of job budget (e.g., $100 gig = 5 credits)</span>
                </div>
                <div className="text-xs text-slate-400 flex items-start gap-2">
                  <Crown className="h-3.5 w-3.5 text-amber-400 mt-0.5 shrink-0" />
                  <span><b className="text-slate-300">Get hired</b> — platform charges 20% commission on completed services</span>
                </div>
                <div className="text-xs text-slate-400 flex items-start gap-2">
                  <Gift className="h-3.5 w-3.5 text-emerald-400 mt-0.5 shrink-0" />
                  <span><b className="text-slate-300">Earn free credits</b> — complete profile, refer musicians, get reviews</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ── REWARDS ── */}
          <TabsContent value="rewards" className="mt-4 space-y-3">
            <p className="text-xs text-slate-400">
              Earn free credits by completing actions. Some rewards can only be claimed once.
            </p>
            <div className="grid gap-2">
              {(rewards || []).map((reward) => (
                <Card
                  key={reward.type}
                  className={`bg-slate-800/60 border-slate-700 p-3 ${
                    reward.claimed ? "opacity-60" : ""
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-2xl w-9 text-center">{reward.icon}</div>
                      <div>
                        <div className="font-semibold text-sm text-white">{reward.title}</div>
                        <div className="text-[11px] text-slate-400">{reward.description}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-0 text-xs font-bold">
                        +{reward.credits}
                      </Badge>
                      {reward.claimed ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <Button
                          size="sm"
                          disabled={!reward.canClaim || claimMutation.isPending}
                          onClick={() => claimMutation.mutate(reward.type)}
                          className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white text-xs h-7 px-3"
                        >
                          {claimMutation.isPending ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>Claim <Sparkles className="h-3 w-3 ml-1" /></>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* ── INBOX ── */}
          <TabsContent value="inbox" className="mt-4 space-y-2">
            {(!messages || messages.length === 0) ? (
              <div className="text-center py-10">
                <MailOpen className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <div className="text-sm text-slate-500">No messages yet</div>
                <div className="text-xs text-slate-600 mt-1">
                  You'll receive gig proposals and notifications here
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <Card
                  key={msg.id}
                  className={`bg-slate-800/60 border-slate-700 p-3 cursor-pointer transition-all hover:border-slate-600 ${
                    !msg.read ? "border-l-2 border-l-blue-500" : ""
                  }`}
                  onClick={() => !msg.read && markRead(msg.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {!msg.read && <Bell className="h-3 w-3 text-blue-400 shrink-0" />}
                        <div className="font-semibold text-sm text-white truncate">{msg.title}</div>
                      </div>
                      <div className="text-xs text-slate-400 mt-1 line-clamp-2">{msg.content}</div>
                      <div className="text-[10px] text-slate-600 mt-1.5">
                        {new Date(msg.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    {msg.actionUrl && msg.actionLabel && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-[10px] h-6 border-slate-600 text-slate-300 shrink-0"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = msg.actionUrl!;
                        }}
                      >
                        {msg.actionLabel} <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </TabsContent>

          {/* ── HISTORY ── */}
          <TabsContent value="history" className="mt-4 space-y-2">
            {(!transactions || transactions.length === 0) ? (
              <div className="text-center py-10">
                <History className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                <div className="text-sm text-slate-500">No transactions yet</div>
              </div>
            ) : (
              transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-800/40 border border-slate-700/50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-white font-medium truncate">{tx.description}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={`text-sm font-bold ${tx.amount > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {tx.amount > 0 ? "+" : ""}{tx.amount}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      bal: {tx.balanceAfter}
                    </div>
                  </div>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
