import { useState, useMemo, useEffect } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { useToast } from "../../hooks/use-toast";
import { useInstagramConnection } from "../../hooks/use-instagram-connection";
import { useConversionTracking, type ConversionProductKey } from "../../hooks/use-conversion-tracking";
import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart2, TrendingUp, Users, Heart, Image,
  Loader2, CheckCircle, ArrowRight, ArrowUp, ArrowDown,
  Eye, Sparkles, Zap, Target, Clock,
  Calendar, FileText, Plug, AlertCircle, RefreshCw,
  ShoppingBag, MousePointerClick, DollarSign, Percent, Filter
} from "lucide-react";

interface ReportsTabProps {
  artistId?: number;
}

// ─── Conversion Tracking Types & Helpers ────────────────────────
interface ProductConversion {
  product: string;
  category: "aiTools" | "create" | "growth" | "analytics";
  impressions: number;
  clicks: number;
  actions: number;       // tool executions
  conversions: number;   // successful outcomes (follower gain, engagement boost, etc.)
  revenue: number;       // attributed revenue in cents
  lastUpdated: string;
}

interface ConversionSnapshot {
  date: string;
  products: ProductConversion[];
}

const PRODUCTS = [
  { key: "ai_caption",        label: "AI Captions",          category: "aiTools" as const,   color: "#833ab4", icon: Sparkles },
  { key: "ai_hashtags",       label: "Hashtag Generator",    category: "aiTools" as const,   color: "#833ab4", icon: Target },
  { key: "content_image",     label: "Image Creator",        category: "create" as const,    color: "#fcb045", icon: Image },
  { key: "content_carousel",  label: "Carousel Builder",     category: "create" as const,    color: "#fcb045", icon: FileText },
  { key: "growth_dm",         label: "DM Campaigns",         category: "growth" as const,    color: "#fd1d1d", icon: Users },
  { key: "growth_collab",     label: "Collab Finder",        category: "growth" as const,    color: "#fd1d1d", icon: Heart },
  { key: "profile_extraction",label: "Profile Extraction",   category: "analytics" as const, color: "#405DE6", icon: Eye },
  { key: "account_audit",     label: "Account Audit",        category: "analytics" as const, color: "#405DE6", icon: BarChart2 },
] as const;

type ConversionFilter = "all" | "aiTools" | "create" | "growth" | "analytics";

export function ReportsTab({ artistId }: ReportsTabProps) {
  const { toast } = useToast();
  const ig = useInstagramConnection();
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<any>(null);
  const [showPipeline, setShowPipeline] = useState(false);
  const [pipelineSteps, setPipelineSteps] = useState<Array<{ id: string; label: string; status: "waiting" | "active" | "done" | "error" }>>([]);

  // ─── Conversion Tracking State ──────────────────────────
  // Real per-product funnel counters, shared across tabs via the
  // useConversionTracking hook (localStorage-backed, daily reset).
  const conversionTracker = useConversionTracking();
  const conversions = conversionTracker.snapshot;
  const [convFilter, setConvFilter] = useState<ConversionFilter>("all");

  // Record an impression for each visible product once per mount so the
  // funnel has a baseline denominator (users opening the Reports tab
  // have clearly seen the product roster).
  useEffect(() => {
    PRODUCTS.forEach(p => conversionTracker.track(p.key, "impressions"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredProducts = useMemo(() => {
    if (convFilter === "all") return conversions.products;
    return conversions.products.filter(p => p.category === convFilter);
  }, [conversions.products, convFilter]);

  const convTotals = useMemo(() => {
    const prods = filteredProducts;
    const impressions = prods.reduce((s, p) => s + p.impressions, 0);
    const clicks = prods.reduce((s, p) => s + p.clicks, 0);
    const actions = prods.reduce((s, p) => s + p.actions, 0);
    const converted = prods.reduce((s, p) => s + p.conversions, 0);
    const revenue = prods.reduce((s, p) => s + p.revenue, 0);
    return {
      impressions,
      clicks,
      actions,
      conversions: converted,
      revenue,
      ctr: impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : "0.0",
      convRate: actions > 0 ? ((converted / actions) * 100).toFixed(1) : "0.0",
    };
  }, [filteredProducts]);

  // Map a report button id → conversion product key so each click is
  // attributed to the right funnel row.
  const REPORT_PRODUCT_MAP: Record<string, ConversionProductKey> = {
    audit: "account_audit",
    growth: "growth_dm",
    content: "content_image",
    timing: "profile_extraction",
  };

  // Compute growth from snapshots
  const growth = useMemo(() => {
    if (ig.snapshots.length < 2) return null;
    const latest = ig.snapshots[0];
    const prev = ig.snapshots[ig.snapshots.length > 7 ? 7 : ig.snapshots.length - 1];
    return {
      followers: latest.followers - prev.followers,
      followersPercent: prev.followers > 0 ? ((latest.followers - prev.followers) / prev.followers * 100).toFixed(1) : "0",
      engagement: (Number(latest.engagementRate) - Number(prev.engagementRate)).toFixed(2),
      likes: latest.avgLikes - prev.avgLikes,
      posts: latest.postsCount - prev.postsCount,
      period: ig.snapshots.length > 7 ? "7d" : `${ig.snapshots.length}d`,
    };
  }, [ig.snapshots]);

  const runAction = async (id: string, action: string, params: Record<string, any>) => {
    setActiveAction(id);
    setActionResult(null);

    // Conversion tracking — click + action attribution.
    const productKey = REPORT_PRODUCT_MAP[id];
    if (productKey) {
      conversionTracker.track(productKey, "clicks");
      conversionTracker.track(productKey, "actions");
    }

    const steps = [
      { id: "collect", label: "Collecting Data", status: "waiting" as const },
      { id: "analyze", label: "Analyzing", status: "waiting" as const },
      { id: "ready", label: "Report Ready", status: "waiting" as const },
    ];
    setPipelineSteps(steps);
    setShowPipeline(true);

    setPipelineSteps(s => s.map(st => st.id === "collect" ? { ...st, status: "active" as const } : st));
    await new Promise(r => setTimeout(r, 600));
    setPipelineSteps(s => s.map(st => st.id === "collect" ? { ...st, status: "done" as const } : st));
    setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "active" as const } : st));

    try {
      const result = await ig.executeAiAction.mutateAsync({ action, inputParams: { ...params, artistId }, autoQueue: false });
      setPipelineSteps(s => s.map(st => st.id === "analyze" ? { ...st, status: "done" as const } : st));
      setPipelineSteps(s => s.map(st => st.id === "ready" ? { ...st, status: "active" as const } : st));
      await new Promise(r => setTimeout(r, 300));
      setPipelineSteps(s => s.map(st => st.id === "ready" ? { ...st, status: "done" as const } : st));
      setActionResult(result.data || result);

      // Successful completion counts as a conversion for this product.
      if (productKey) {
        conversionTracker.track(productKey, "conversions");
      }

      setTimeout(() => setShowPipeline(false), 1500);
    } catch (err: any) {
      setPipelineSteps(s => s.map(st => st.status === ("active" as const) ? { ...st, status: "error" as const } : st));
      toast({ title: "Failed", description: err.message, variant: "destructive" });
      setTimeout(() => setShowPipeline(false), 3000);
    }
  };

  const isExecuting = ig.executeAiAction.isPending;

  const reports = [
    { id: "audit", icon: <Target className="w-4 h-4" />, label: "Full Account Audit", desc: "Score, strengths, weaknesses, quick wins", color: "#833ab4", action: "full_audit", params: {} },
    { id: "growth", icon: <TrendingUp className="w-4 h-4" />, label: "Growth Forecast", desc: "30/60/90 day projection", color: "#fd1d1d", action: "growth_plan", params: {} },
    { id: "content", icon: <BarChart2 className="w-4 h-4" />, label: "Content Analysis", desc: "What's working, what's not", color: "#fcb045", action: "generate_content_ideas", params: { customPrompt: "Analyze what types of Instagram content work best for music artists in 2025-2026. Compare: Reels vs Carousels vs Single Posts vs Stories. For each give: avg engagement rate, reach multiplier, best use cases, and content ideas. Be data-driven." } },
    { id: "timing", icon: <Clock className="w-4 h-4" />, label: "Timing Report", desc: "When your audience is most active", color: "#405DE6", action: "analyze_best_times", params: {} },
  ];

  return (
    <div className="space-y-5">
      {!ig.isConnected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-yellow-500/20 bg-gradient-to-r from-yellow-500/5 to-orange-500/5 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0"><Plug className="w-6 h-6 text-yellow-500" /></div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-yellow-600">Connect for Real Analytics</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Reports are powered by your real Instagram data. Go to <strong>Extension</strong> tab to connect.</p>
          </div>
        </motion.div>
      )}

      {/* Real Stats Dashboard */}
      {ig.latestSnapshot && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-[#833ab4]" />
              Account Overview
            </h3>
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => ig.refresh()}>
              <RefreshCw className="w-3 h-3" /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                label: "Followers",
                value: ig.formatNumber(ig.latestSnapshot.followers),
                change: growth ? `${growth.followers >= 0 ? "+" : ""}${ig.formatNumber(growth.followers)}` : null,
                positive: growth ? growth.followers >= 0 : true,
                icon: Users, color: "#833ab4",
              },
              {
                label: "Engagement Rate",
                value: `${Number(ig.latestSnapshot.engagementRate || 0).toFixed(2)}%`,
                change: growth ? `${Number(growth.engagement) >= 0 ? "+" : ""}${growth.engagement}%` : null,
                positive: growth ? Number(growth.engagement) >= 0 : true,
                icon: Heart, color: "#fd1d1d",
              },
              {
                label: "Avg Likes",
                value: ig.formatNumber(ig.latestSnapshot.avgLikes),
                change: growth ? `${growth.likes >= 0 ? "+" : ""}${ig.formatNumber(growth.likes)}` : null,
                positive: growth ? growth.likes >= 0 : true,
                icon: TrendingUp, color: "#fcb045",
              },
              {
                label: "Total Posts",
                value: ig.formatNumber(ig.latestSnapshot.postsCount),
                change: growth ? `+${growth.posts} new` : null,
                positive: true,
                icon: Image, color: "#405DE6",
              },
            ].map((stat, i) => (
              <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                <Card className="p-3 sm:p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${stat.color}15` }}>
                      <stat.icon className="h-4 w-4" style={{ color: stat.color }} />
                    </div>
                    {stat.change && (
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 gap-0.5 ${stat.positive ? "text-green-500 border-green-500/30" : "text-red-400 border-red-400/30"}`}>
                        {stat.positive ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                        {stat.change}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xl sm:text-2xl font-black">{stat.value}</div>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{stat.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Growth Chart (text-based since we have snapshot data) */}
          {ig.snapshots.length > 1 && (
            <Card className="p-4">
              <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-500" />
                Follower History
                <Badge variant="secondary" className="text-[10px]">{ig.snapshots.length} snapshots</Badge>
              </h4>
              <div className="flex items-end gap-1 h-24 overflow-x-auto">
                {ig.snapshots.slice(0, 20).reverse().map((snap, i) => {
                  const max = Math.max(...ig.snapshots.slice(0, 20).map(s => s.followers));
                  const min = Math.min(...ig.snapshots.slice(0, 20).map(s => s.followers));
                  const range = max - min || 1;
                  const height = Math.max(8, ((snap.followers - min) / range) * 80);
                  return (
                    <motion.div
                      key={snap.id}
                      initial={{ height: 0 }}
                      animate={{ height }}
                      transition={{ delay: i * 0.03, type: "spring" }}
                      className="flex-1 min-w-[12px] rounded-t bg-gradient-to-t from-[#833ab4] to-[#fd1d1d] opacity-70 hover:opacity-100 transition-opacity cursor-pointer group relative"
                      title={`${ig.formatNumber(snap.followers)} followers`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-muted-foreground">Oldest</span>
                <span className="text-[10px] text-muted-foreground">Latest</span>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Report Actions */}
      <Card className="p-4 sm:p-5">
        <div className="mb-4">
          <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
            <Zap className="h-5 w-5 text-[#fcb045]" />
            AI Reports
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Deep analysis powered by your real data</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {reports.map((r, i) => (
            <motion.button
              key={r.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              disabled={isExecuting}
              onClick={() => runAction(r.id, r.action, r.params)}
              className={`relative p-3 sm:p-4 rounded-xl border text-left transition-all overflow-hidden group ${
                activeAction === r.id && isExecuting ? "border-[#833ab4]/50 bg-[#833ab4]/5 ring-2 ring-[#833ab4]/20" : "border-border hover:border-primary/30 bg-card"
              }`}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ background: `radial-gradient(circle at center, ${r.color}10 0%, transparent 70%)` }} />
              <div className="relative z-10">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2" style={{ backgroundColor: `${r.color}15` }}>
                  {activeAction === r.id && isExecuting ? <Loader2 className="w-4 h-4 animate-spin" style={{ color: r.color }} /> : <div style={{ color: r.color }}>{r.icon}</div>}
                </div>
                <h4 className="text-sm font-semibold">{r.label}</h4>
                <p className="text-[10px] text-muted-foreground mt-0.5">{r.desc}</p>
              </div>
            </motion.button>
          ))}
        </div>
      </Card>

      {/* Pipeline */}
      {showPipeline && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="rounded-xl border border-[#833ab4]/30 bg-gradient-to-r from-[#833ab4]/5 to-[#fd1d1d]/5 p-4">
          <div className="flex items-center gap-1 overflow-x-auto">
            {pipelineSteps.map((step, i) => (
              <div key={step.id} className="flex items-center gap-1 shrink-0">
                <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium ${
                  step.status === "done" ? "bg-green-500/10 text-green-600 border border-green-500/20" :
                  step.status === "active" ? "bg-[#833ab4]/10 text-[#833ab4] border border-[#833ab4]/30 ring-2 ring-[#833ab4]/20" :
                  step.status === "error" ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                  "bg-muted/30 text-muted-foreground border border-border"
                }`}>
                  {step.status === "active" ? <Loader2 className="w-3 h-3 animate-spin" /> : step.status === "done" ? <CheckCircle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                  <span className="hidden sm:inline">{step.label}</span>
                </div>
                {i < pipelineSteps.length - 1 && <ArrowRight className={`w-3 h-3 shrink-0 ${step.status === "done" ? "text-green-500" : "text-muted-foreground/30"}`} />}
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Results */}
      <AnimatePresence>
        {actionResult && !isExecuting && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-semibold">Report Results</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setActionResult(null)}>Clear</Button>
              </div>
              <div className="max-h-[500px] overflow-y-auto space-y-3">
                {/* Audit */}
                {(actionResult.score != null || actionResult.strengths) && (
                  <div className="space-y-3">
                    {actionResult.score != null && (
                      <div className="flex items-center gap-3">
                        <div className={`text-3xl font-black ${actionResult.score >= 80 ? "text-green-500" : actionResult.score >= 50 ? "text-yellow-500" : "text-red-500"}`}>
                          {actionResult.score}/100
                        </div>
                        {actionResult.grade && <Badge variant="outline" className="text-sm">{actionResult.grade}</Badge>}
                      </div>
                    )}
                    {actionResult.strengths?.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-green-500">Strengths</span>
                        <ul className="mt-1 space-y-1">{actionResult.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}</li>
                        ))}</ul>
                      </div>
                    )}
                    {actionResult.weaknesses?.length > 0 && (
                      <div>
                        <span className="text-xs font-medium text-red-400">Weaknesses</span>
                        <ul className="mt-1 space-y-1">{actionResult.weaknesses.map((w: string, i: number) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs"><AlertCircle className="w-3 h-3 text-red-400 mt-0.5 shrink-0" />{w}</li>
                        ))}</ul>
                      </div>
                    )}
                    {actionResult.quickWins?.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs font-medium text-[#fcb045]">Quick Wins</span>
                        <div className="grid gap-1.5 mt-1">{actionResult.quickWins.map((q: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 rounded border border-[#fcb045]/20 bg-[#fcb045]/5 p-2 text-xs">
                            <Zap className="w-3 h-3 text-[#fcb045] shrink-0" />
                            <span>{typeof q === "string" ? q : q.action}</span>
                          </div>
                        ))}</div>
                      </div>
                    )}
                    {actionResult.growthProjection && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs font-medium text-[#833ab4]">Growth Projection</span>
                        <div className="grid grid-cols-3 gap-2 mt-1">{Object.entries(actionResult.growthProjection).map(([period, value]: [string, any]) => (
                          <div key={period} className="rounded border border-[#833ab4]/20 bg-[#833ab4]/5 p-2 text-center">
                            <div className="text-xs text-muted-foreground">{period}</div>
                            <div className="text-sm font-bold text-[#833ab4]">{value}</div>
                          </div>
                        ))}</div>
                      </div>
                    )}
                  </div>
                )}

                {/* Growth Plan */}
                {actionResult.plan && Object.entries(actionResult.plan).map(([week, wd]: [string, any]) => (
                  <div key={week} className="rounded-lg border border-border bg-card p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase text-muted-foreground">{week.replace(/(\d)/, " $1")}</span>
                      {wd.theme && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{wd.theme}</Badge>}
                    </div>
                    <div className="space-y-1">{wd.tasks?.map((task: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <Badge variant="outline" className="text-[9px] px-1 py-0">{task.type}</Badge>
                        <span className="flex-1">{task.action}</span>
                      </div>
                    ))}</div>
                  </div>
                ))}

                {/* Best Times */}
                {actionResult.bestTimes && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {actionResult.bestTimes.map((t: any, i: number) => (
                      <div key={i} className="rounded-lg border border-green-500/20 bg-green-500/5 p-2.5 text-center space-y-1">
                        <span className="text-xs font-bold">{t.day}</span>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {t.times?.map((time: string, j: number) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0 border-green-500/30 text-green-600">{time}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Content Ideas */}
                {actionResult.ideas && actionResult.ideas.map((idea: any, i: number) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                    className="flex items-start gap-3 rounded-lg border border-border bg-card p-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#833ab4]/20 to-[#fcb045]/20 flex items-center justify-center shrink-0 text-xs font-bold">{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{idea.title}</span>
                      <p className="text-xs text-muted-foreground mt-0.5">{idea.description}</p>
                    </div>
                  </motion.div>
                ))}

                {/* Fallback */}
                {!actionResult.score && !actionResult.strengths && !actionResult.plan && !actionResult.bestTimes && !actionResult.ideas && (
                  typeof actionResult === "string"
                    ? <pre className="text-sm whitespace-pre-wrap font-sans">{actionResult}</pre>
                    : <pre className="text-xs whitespace-pre-wrap font-mono bg-muted/30 rounded-lg p-3">{JSON.stringify(actionResult, null, 2)}</pre>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Conversion Tracking Analytics Per Product ─────────── */}
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-orange-500" />
              Conversion Analytics
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track performance per product — impressions to conversions
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {([
              { key: "all", label: "All" },
              { key: "aiTools", label: "AI Tools" },
              { key: "create", label: "Create" },
              { key: "growth", label: "Growth" },
              { key: "analytics", label: "Analytics" },
            ] as const).map(f => (
              <Button
                key={f.key}
                size="sm"
                variant={convFilter === f.key ? "default" : "outline"}
                className={`h-7 text-[10px] px-2.5 ${convFilter === f.key ? "bg-gradient-to-r from-orange-500 to-red-500 text-white border-0" : ""}`}
                onClick={() => setConvFilter(f.key)}
              >
                {f.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">
          {[
            { label: "Impressions", value: convTotals.impressions.toLocaleString(), icon: Eye, color: "#833ab4" },
            { label: "Clicks", value: convTotals.clicks.toLocaleString(), icon: MousePointerClick, color: "#fd1d1d" },
            { label: "Actions", value: convTotals.actions.toLocaleString(), icon: Zap, color: "#fcb045" },
            { label: "Conv. Rate", value: `${convTotals.convRate}%`, icon: Percent, color: "#00c853" },
            { label: "Revenue", value: `$${(convTotals.revenue / 100).toFixed(2)}`, icon: DollarSign, color: "#405DE6" },
          ].map((m, i) => (
            <motion.div key={m.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <div className="rounded-lg border border-border bg-card p-2.5 sm:p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                  <span className="text-[10px] text-muted-foreground">{m.label}</span>
                </div>
                <div className="text-lg sm:text-xl font-bold">{m.value}</div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Per-Product Table */}
        <div className="rounded-lg border border-border overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-1 px-3 py-2 bg-muted/30 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
            <span>Product</span>
            <span className="text-center">Impr.</span>
            <span className="text-center">Clicks</span>
            <span className="text-center">Actions</span>
            <span className="text-center">Conv.</span>
            <span className="text-center">Rate</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {filteredProducts.map((p, i) => {
              const productDef = PRODUCTS.find(pr => pr.key === p.product);
              if (!productDef) return null;
              const Icon = productDef.icon;
              const rate = p.actions > 0 ? ((p.conversions / p.actions) * 100) : 0;
              const ctr = p.impressions > 0 ? ((p.clicks / p.impressions) * 100) : 0;

              return (
                <motion.div
                  key={p.product}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="grid grid-cols-[1fr_repeat(5,_minmax(0,_1fr))] gap-1 px-3 py-2.5 items-center hover:bg-muted/20 transition-colors group"
                >
                  {/* Product name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: `${productDef.color}15` }}>
                      <Icon className="w-3 h-3" style={{ color: productDef.color }} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-medium truncate block">{productDef.label}</span>
                      <span className="text-[9px] text-muted-foreground">{ctr.toFixed(1)}% CTR</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="text-center text-xs tabular-nums">{p.impressions.toLocaleString()}</div>
                  <div className="text-center text-xs tabular-nums">{p.clicks.toLocaleString()}</div>
                  <div className="text-center text-xs tabular-nums">{p.actions.toLocaleString()}</div>
                  <div className="text-center text-xs tabular-nums font-medium">{p.conversions}</div>

                  {/* Conversion rate bar */}
                  <div className="flex items-center gap-1.5">
                    <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(rate, 100)}%`,
                          background: `linear-gradient(to right, ${productDef.color}, ${rate >= 50 ? "#00c853" : productDef.color}cc)`,
                        }}
                      />
                    </div>
                    <span className={`text-[10px] tabular-nums font-medium ${rate >= 50 ? "text-green-500" : rate >= 20 ? "text-orange-400" : "text-muted-foreground"}`}>
                      {rate.toFixed(0)}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Funnel Visualization */}
        {convTotals.impressions > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Filter className="w-3 h-3" /> Conversion Funnel
            </h4>
            <div className="space-y-2">
              {[
                { label: "Impressions", value: convTotals.impressions, color: "#833ab4" },
                { label: "Clicks", value: convTotals.clicks, color: "#fd1d1d" },
                { label: "Actions Taken", value: convTotals.actions, color: "#fcb045" },
                { label: "Conversions", value: convTotals.conversions, color: "#00c853" },
              ].map((step, i) => {
                const maxVal = convTotals.impressions;
                const width = maxVal > 0 ? Math.max(8, (step.value / maxVal) * 100) : 0;
                const dropoff = i > 0
                  ? (1 - step.value / [convTotals.impressions, convTotals.clicks, convTotals.actions, convTotals.conversions][i - 1]) * 100
                  : 0;

                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, scaleX: 0 }}
                    animate={{ opacity: 1, scaleX: 1 }}
                    transition={{ delay: i * 0.1, type: "spring" }}
                    style={{ originX: 0 }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-24 text-[11px] text-muted-foreground shrink-0">{step.label}</span>
                      <div className="flex-1 h-6 bg-muted/20 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md transition-all flex items-center justify-end pr-2"
                          style={{ width: `${width}%`, backgroundColor: `${step.color}30`, borderLeft: `3px solid ${step.color}` }}
                        >
                          <span className="text-[10px] font-bold tabular-nums" style={{ color: step.color }}>
                            {step.value.toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {i > 0 && (
                        <Badge variant="outline" className={`text-[9px] px-1.5 py-0 shrink-0 ${dropoff > 70 ? "text-red-400 border-red-400/30" : dropoff > 40 ? "text-orange-400 border-orange-400/30" : "text-green-500 border-green-500/30"}`}>
                          -{dropoff.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </Card>

      {/* Empty state when not connected */}
      {!ig.latestSnapshot && !actionResult && !isExecuting && (
        <Card className="p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#833ab4]/20 via-[#fd1d1d]/20 to-[#fcb045]/20 flex items-center justify-center mx-auto mb-4">
            <BarChart2 className="w-8 h-8 text-[#833ab4]" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Generate Your First Report</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Use the AI report tools above to get a full account audit, growth forecast, content analysis, or timing optimization.
          </p>
        </Card>
      )}
    </div>
  );
}
