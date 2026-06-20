import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { ScrollArea } from "../components/ui/scroll-area";
import { Header } from "../components/layout/header";
import { Badge } from "../components/ui/badge";
import {
  Activity, TrendingUp, Download, Calendar, Music2, Users, DollarSign,
  CreditCard, Video, ShoppingBag, BarChart3, PieChart as PieChartIcon,
  ArrowUpRight, ArrowDownRight, Zap, Database, Eye, Loader2, RefreshCw,
  GraduationCap, Crown
} from "lucide-react";
import { ChartsIntelligenceTab } from "../components/analytics/charts-intelligence-tab";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, BarChart, Bar, Legend, LineChart, Line,
  ComposedChart
} from "recharts";
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { useToast } from "../hooks/use-toast";

const CHART_COLORS = [
  "#f97316", "#fb923c", "#fdba74", "#fbbf24", "#34d399",
  "#60a5fa", "#a78bfa", "#f472b6", "#94a3b8", "#10b981",
  "#8b5cf6", "#ec4899", "#06b6d4"
];

const GRADIENT_PAIRS = [
  { from: "#f97316", to: "#ea580c" },
  { from: "#3b82f6", to: "#2563eb" },
  { from: "#10b981", to: "#059669" },
  { from: "#8b5cf6", to: "#7c3aed" },
  { from: "#f59e0b", to: "#d97706" },
  { from: "#ec4899", to: "#db2777" },
];

type Period = "7d" | "30d" | "90d" | "12m";

const periodToDays: Record<Period, number> = {
  "7d": 7, "30d": 30, "90d": 90, "12m": 365,
};

const periodLabels: Record<Period, string> = {
  "7d": "7 Days", "30d": "30 Days", "90d": "90 Days", "12m": "12 Months",
};

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  return `$${formatNumber(value)}`;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-orange-500/20 bg-black/90 backdrop-blur-md px-4 py-3 shadow-2xl">
      <p className="text-xs text-gray-400 mb-1.5">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-gray-300">{entry.name}:</span>
          <span className="font-semibold text-white">
            {entry.name?.toLowerCase().includes("revenue") || entry.name?.toLowerCase().includes("fee") || entry.name?.toLowerCase().includes("earning")
              ? formatCurrency(entry.value)
              : formatNumber(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
};

function KPICard({
  icon: Icon, label, value, prefix, gradient, delay = 0,
}: {
  icon: any; label: string; value: number | string; prefix?: string; gradient: { from: string; to: string }; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }}>
      <Card className="relative overflow-hidden border-white/5 bg-black/40 backdrop-blur-sm hover:border-orange-500/30 transition-all duration-300 group">
        <div className="absolute inset-0 opacity-[0.07] group-hover:opacity-[0.12] transition-opacity" style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }} />
        <div className="relative p-4 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-xl" style={{ background: `linear-gradient(135deg, ${gradient.from}20, ${gradient.to}10)` }}>
              <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: gradient.from }} />
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-400 mb-1">{label}</p>
          <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-white tracking-tight">
            {prefix}{typeof value === "number" ? formatNumber(value) : value}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}

function Section({ title, subtitle, icon: Icon, children, delay = 0 }: {
  title: string; subtitle?: string; icon?: any; children: React.ReactNode; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay }}>
      <Card className="border-white/5 bg-black/40 backdrop-blur-sm overflow-hidden">
        <div className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-1">
            {Icon && <Icon className="h-5 w-5 text-orange-500" />}
            <h3 className="text-base sm:text-lg font-semibold text-white">{title}</h3>
          </div>
          {subtitle && <p className="text-xs sm:text-sm text-gray-400 mb-4">{subtitle}</p>}
          <div className="mt-4">{children}</div>
        </div>
      </Card>
    </motion.div>
  );
}

export default function AnalyticsPage() {
  const { toast } = useToast();
  const [selectedPeriod, setSelectedPeriod] = useState<Period>("30d");
  const [activeTab, setActiveTab] = useState<"overview" | "revenue" | "content" | "users" | "charts">("overview");
  const days = periodToDays[selectedPeriod];

  const { data: overview, isLoading: loadingOverview, refetch: refetchOverview } = useQuery({
    queryKey: ["platform-analytics", "overview"],
    queryFn: () => fetch("/api/platform-analytics/overview").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: userGrowth } = useQuery({
    queryKey: ["platform-analytics", "user-growth", days],
    queryFn: () => fetch(`/api/platform-analytics/user-growth?days=${days}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: revenueBreakdown } = useQuery({
    queryKey: ["platform-analytics", "revenue-breakdown", days],
    queryFn: () => fetch(`/api/platform-analytics/revenue-breakdown?days=${days}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: revenueTrend } = useQuery({
    queryKey: ["platform-analytics", "revenue-trend", days],
    queryFn: () => fetch(`/api/platform-analytics/revenue-trend?days=${days}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: subsData } = useQuery({
    queryKey: ["platform-analytics", "subscriptions"],
    queryFn: () => fetch("/api/platform-analytics/subscriptions").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: contentStats } = useQuery({
    queryKey: ["platform-analytics", "content-stats"],
    queryFn: () => fetch("/api/platform-analytics/content-stats").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: salesData } = useQuery({
    queryKey: ["platform-analytics", "sales", days],
    queryFn: () => fetch(`/api/platform-analytics/sales?days=${days}`).then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: creditsData } = useQuery({
    queryKey: ["platform-analytics", "credits"],
    queryFn: () => fetch("/api/platform-analytics/credits").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: videoData } = useQuery({
    queryKey: ["platform-analytics", "video-projects"],
    queryFn: () => fetch("/api/platform-analytics/video-projects").then((r) => r.json()),
    staleTime: 60_000,
  });

  const { data: recentActivity } = useQuery({
    queryKey: ["platform-analytics", "recent-activity"],
    queryFn: () => fetch("/api/platform-analytics/recent-activity").then((r) => r.json()),
    staleTime: 30_000,
  });

  const subscriptionPieData = useMemo(() => {
    if (!subsData?.byPlan) return [];
    const planMap = new Map<string, number>();
    subsData.byPlan.forEach((s: any) => {
      if (s.status === "active") planMap.set(s.plan, (planMap.get(s.plan) || 0) + s.count);
    });
    return Array.from(planMap.entries()).map(([plan, cnt]) => ({
      name: plan.charAt(0).toUpperCase() + plan.slice(1), value: cnt,
    }));
  }, [subsData]);

  const revenueTypeLabels: Record<string, string> = {
    subscription: "Subscriptions", merch_commission: "Merch Fees", token_sale_commission: "Token Fees",
    music_streaming: "Streaming", nft_sale: "NFT Sales", premium_feature: "Premium",
    swap_fee: "Swap Fees", collaboration_fee: "Collab Fees", beef_sponsorship: "Beef Sponsors",
    token_trading_fee: "Trading Fees", promoted_post: "Promotions", liquidity_fee: "Liquidity Fees",
    token_purchase: "Token Sales",
  };

  const isLoading = loadingOverview;

  const handleRefresh = () => {
    refetchOverview();
    toast({ title: "Refreshing analytics...", description: "Fetching latest data from database." });
  };

  const periods: Period[] = ["7d", "30d", "90d", "12m"];
  const tabs = [
    { id: "overview" as const, label: "Overview", icon: BarChart3 },
    { id: "revenue" as const, label: "Revenue", icon: DollarSign },
    { id: "content" as const, label: "Content", icon: Music2 },
    { id: "users" as const, label: "Users", icon: Users },
    { id: "charts" as const, label: "Charts", icon: Crown },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-black via-gray-950 to-black">
      <Header />
      <main className="flex-1 pt-20">
        <ScrollArea className="flex-1 h-[calc(100vh-5rem)]">
          <div className="container mx-auto px-3 sm:px-4 lg:px-8 py-6 sm:py-8 max-w-[1400px]">

            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 sm:mb-8">
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <div className="flex items-center gap-3 mb-1">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/10">
                    <Activity className="h-6 w-6 text-orange-500" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 via-orange-500 to-amber-500">
                    Platform Analytics
                  </h1>
                </div>
                <p className="text-sm text-gray-400 ml-14">Real-time insights from your database</p>
              </motion.div>

              <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <div className="flex rounded-xl bg-white/5 border border-white/10 p-0.5 overflow-x-auto">
                  {periods.map((p) => (
                    <button key={p} onClick={() => setSelectedPeriod(p)}
                      className={`px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap ${
                        selectedPeriod === p ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "text-gray-400 hover:text-white hover:bg-white/5"
                      }`}>{periodLabels[p]}</button>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={handleRefresh} className="border-white/10 bg-white/5 hover:bg-white/10 text-gray-300 gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5" /><span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-6 sm:mb-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium rounded-lg transition-all whitespace-nowrap flex-1 sm:flex-none justify-center ${
                    activeTab === tab.id ? "bg-orange-500/10 text-orange-400 border border-orange-500/20" : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}>
                  <tab.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />{tab.label}
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-32">
                <Loader2 className="h-8 w-8 text-orange-500 animate-spin" />
                <span className="ml-3 text-gray-400">Loading analytics...</span>
              </div>
            ) : (
              <AnimatePresence mode="wait">
                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <motion.div key="overview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                      <KPICard icon={Users} label="Total Users" value={overview?.totalUsers || 0} gradient={GRADIENT_PAIRS[0]} delay={0.05} />
                      <KPICard icon={Music2} label="Total Songs" value={overview?.totalSongs || 0} gradient={GRADIENT_PAIRS[1]} delay={0.1} />
                      <KPICard icon={Eye} label="Total Plays" value={overview?.totalPlays || 0} gradient={GRADIENT_PAIRS[2]} delay={0.15} />
                      <KPICard icon={DollarSign} label="Platform Revenue" value={overview?.totalPlatformRevenue || 0} prefix="$" gradient={GRADIENT_PAIRS[3]} delay={0.2} />
                      <KPICard icon={CreditCard} label="Active Subscriptions" value={overview?.activeSubscriptions || 0} gradient={GRADIENT_PAIRS[4]} delay={0.25} />
                      <KPICard icon={Video} label="Video Projects" value={overview?.videoProjects || 0} gradient={GRADIENT_PAIRS[5]} delay={0.3} />
                      <KPICard icon={Zap} label="AI Songs" value={overview?.aiGeneratedSongs || 0} gradient={GRADIENT_PAIRS[0]} delay={0.35} />
                      <KPICard icon={ShoppingBag} label="Merch Products" value={overview?.merchProducts || 0} gradient={GRADIENT_PAIRS[1]} delay={0.4} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                      <Section title="User Growth" subtitle={`New registrations — last ${periodLabels[selectedPeriod]}`} icon={TrendingUp} delay={0.3}>
                        <div className="h-[280px] sm:h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={userGrowth || []}>
                              <defs>
                                <linearGradient id="gradUsers" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis yAxisId="left" tick={{ fill: "#888", fontSize: 11 }} />
                              <YAxis yAxisId="right" orientation="right" tick={{ fill: "#888", fontSize: 11 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar yAxisId="left" dataKey="newUsers" name="New Users" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} opacity={0.8} />
                              <Line yAxisId="right" type="monotone" dataKey="totalUsers" name="Total Users" stroke="#60a5fa" strokeWidth={2} dot={false} />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </Section>

                      <Section title="Subscription Plans" subtitle="Active subscriptions by plan" icon={PieChartIcon} delay={0.4}>
                        <div className="h-[280px] sm:h-[320px] flex items-center">
                          {subscriptionPieData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <Pie data={subscriptionPieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="value" stroke="none">
                                  {subscriptionPieData.map((_: any, i: number) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-gray-300 text-xs">{value}</span>} />
                              </RePieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full text-gray-500">
                              <Database className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">No subscription data yet</p>
                            </div>
                          )}
                        </div>
                        {subsData && (
                          <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                            <div><p className="text-xs text-gray-500">MRR</p><p className="text-lg font-bold text-green-400">{formatCurrency(subsData.mrr || 0)}</p></div>
                            <div><p className="text-xs text-gray-500">ARR</p><p className="text-lg font-bold text-blue-400">{formatCurrency(subsData.arr || 0)}</p></div>
                          </div>
                        )}
                      </Section>
                    </div>

                    <Section title="Recent Activity" subtitle="Latest platform events" icon={Activity} delay={0.5}>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">New Users</h4>
                          <div className="space-y-2">
                            {(recentActivity?.recentUsers || []).slice(0, 5).map((u: any) => (
                              <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                <div><p className="text-sm text-white">{u.artistName || "User"}</p><p className="text-xs text-gray-500">{u.email}</p></div>
                                <span className="text-[10px] text-gray-500">{u.createdAt ? format(new Date(u.createdAt), "MMM dd") : ""}</span>
                              </div>
                            ))}
                            {(!recentActivity?.recentUsers?.length) && <p className="text-xs text-gray-500 text-center py-4">No users yet</p>}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wider mb-3">Recent Sales</h4>
                          <div className="space-y-2">
                            {(recentActivity?.recentSales || []).slice(0, 5).map((s: any) => (
                              <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                <div>
                                  <p className="text-sm text-white truncate max-w-[140px]">{s.productName}</p>
                                  <Badge variant="outline" className={`text-[10px] mt-0.5 ${s.status === "completed" ? "border-green-500/30 text-green-400" : "border-yellow-500/30 text-yellow-400"}`}>{s.status}</Badge>
                                </div>
                                <span className="text-sm font-semibold text-green-400">${Number(s.saleAmount).toFixed(2)}</span>
                              </div>
                            ))}
                            {(!recentActivity?.recentSales?.length) && <p className="text-xs text-gray-500 text-center py-4">No sales yet</p>}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-3">Credit Activity</h4>
                          <div className="space-y-2">
                            {(recentActivity?.recentCredits || []).slice(0, 5).map((c: any) => (
                              <div key={c.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                <div><p className="text-xs text-gray-400 truncate max-w-[140px]">{c.description}</p><p className="text-[10px] text-gray-500">{c.userEmail}</p></div>
                                <span className={`text-sm font-semibold ${c.type === "purchase" || c.type === "bonus" ? "text-green-400" : "text-red-400"}`}>
                                  {c.type === "purchase" || c.type === "bonus" ? "+" : "-"}{Math.abs(c.amount)}
                                </span>
                              </div>
                            ))}
                            {(!recentActivity?.recentCredits?.length) && <p className="text-xs text-gray-500 text-center py-4">No credit activity yet</p>}
                          </div>
                        </div>
                      </div>
                    </Section>
                  </motion.div>
                )}

                {/* REVENUE TAB */}
                {activeTab === "revenue" && (
                  <motion.div key="revenue" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                      <KPICard icon={DollarSign} label="Total Revenue" value={overview?.totalPlatformRevenue || 0} prefix="$" gradient={GRADIENT_PAIRS[0]} delay={0.05} />
                      <KPICard icon={ShoppingBag} label="Sales Revenue" value={overview?.totalSalesRevenue || 0} prefix="$" gradient={GRADIENT_PAIRS[2]} delay={0.1} />
                      <KPICard icon={CreditCard} label="Platform Fees" value={overview?.totalPlatformFees || 0} prefix="$" gradient={GRADIENT_PAIRS[3]} delay={0.15} />
                      <KPICard icon={Zap} label="Credits Purchased" value={overview?.creditsPurchased || 0} gradient={GRADIENT_PAIRS[4]} delay={0.2} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <Section title="Revenue Trend" subtitle={`Daily revenue — last ${periodLabels[selectedPeriod]}`} icon={TrendingUp} delay={0.3}>
                        <div className="h-[300px] sm:h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueTrend?.revenueTrend || []}>
                              <defs>
                                <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="total" name="Revenue" stroke="#10b981" fill="url(#gradRevenue)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </Section>

                      <Section title="Revenue by Type" subtitle="Breakdown by revenue source" icon={PieChartIcon} delay={0.4}>
                        <div className="h-[300px] sm:h-[340px]">
                          {revenueBreakdown?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <Pie data={(revenueBreakdown || []).map((r: any) => ({ name: revenueTypeLabels[r.type] || r.type, value: r.total }))}
                                  cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2} dataKey="value" stroke="none">
                                  {(revenueBreakdown || []).map((_: any, i: number) => (<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={6} formatter={(value: string) => <span className="text-gray-400 text-[10px]">{value}</span>} />
                              </RePieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <Database className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">No revenue data yet</p>
                            </div>
                          )}
                        </div>
                      </Section>
                    </div>

                    <Section title="Merch Sales" subtitle={`Sales performance — last ${periodLabels[selectedPeriod]}`} icon={ShoppingBag} delay={0.5}>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 h-[280px] sm:h-[320px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesData?.salesByDay || []}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => `$${v}`} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend formatter={(value: string) => <span className="text-gray-300 text-xs">{value}</span>} />
                              <Bar dataKey="total" name="Revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="platformFees" name="Platform Fees" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="artistEarnings" name="Artist Earnings" fill="#34d399" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">Top Products</h4>
                          <div className="space-y-2">
                            {(salesData?.topProducts || []).slice(0, 6).map((p: any, i: number) => (
                              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 w-4">#{i + 1}</span>
                                  <span className="text-sm text-white truncate max-w-[120px]">{p.name}</span>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-green-400">${Number(p.revenue).toFixed(0)}</p>
                                  <p className="text-[10px] text-gray-500">{p.sold} sold</p>
                                </div>
                              </div>
                            ))}
                            {(!salesData?.topProducts?.length) && <p className="text-xs text-gray-500 text-center py-4">No sales data yet</p>}
                          </div>
                        </div>
                      </div>
                    </Section>
                  </motion.div>
                )}

                {/* CONTENT TAB */}
                {activeTab === "content" && (
                  <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                      <KPICard icon={Music2} label="Total Songs" value={overview?.totalSongs || 0} gradient={GRADIENT_PAIRS[1]} delay={0.05} />
                      <KPICard icon={Zap} label="AI Generated" value={overview?.aiGeneratedSongs || 0} gradient={GRADIENT_PAIRS[3]} delay={0.1} />
                      <KPICard icon={Video} label="Video Projects" value={overview?.videoProjects || 0} gradient={GRADIENT_PAIRS[5]} delay={0.15} />
                      <KPICard icon={GraduationCap} label="Course Enrollments" value={overview?.courseEnrollments || 0} gradient={GRADIENT_PAIRS[2]} delay={0.2} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <Section title="Songs by Genre" subtitle="Distribution across music genres" icon={Music2} delay={0.3}>
                        <div className="h-[300px] sm:h-[340px]">
                          {contentStats?.byGenre?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={(contentStats?.byGenre || []).slice(0, 10)} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis type="number" tick={{ fill: "#888", fontSize: 11 }} />
                                <YAxis dataKey="genre" type="category" tick={{ fill: "#888", fontSize: 10 }} width={80} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="count" name="Songs" fill="#f97316" radius={[0, 4, 4, 0]} barSize={16} />
                              </BarChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                              <Database className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">No song data yet</p>
                            </div>
                          )}
                        </div>
                      </Section>

                      <Section title="AI vs Manual Songs" subtitle="Content creation method comparison" icon={Zap} delay={0.4}>
                        <div className="h-[300px] sm:h-[340px] flex items-center">
                          {contentStats?.aiVsManual ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <RePieChart>
                                <Pie data={[{ name: "AI Generated", value: contentStats.aiVsManual.ai }, { name: "Manual Upload", value: contentStats.aiVsManual.manual }]}
                                  cx="50%" cy="50%" innerRadius={65} outerRadius={100} paddingAngle={4} dataKey="value" stroke="none">
                                  <Cell fill="#8b5cf6" /><Cell fill="#f97316" />
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                                <Legend verticalAlign="bottom" iconType="circle" iconSize={8} formatter={(value: string) => <span className="text-gray-300 text-xs">{value}</span>} />
                              </RePieChart>
                            </ResponsiveContainer>
                          ) : (
                            <div className="flex flex-col items-center justify-center w-full text-gray-500">
                              <Database className="h-12 w-12 mb-2 opacity-30" /><p className="text-sm">No data yet</p>
                            </div>
                          )}
                        </div>
                      </Section>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <Section title="Song Uploads Trend" subtitle="New songs over the last 90 days" icon={TrendingUp} delay={0.5}>
                        <div className="h-[260px] sm:h-[300px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={contentStats?.songsTrend || []}>
                              <defs>
                                <linearGradient id="gradSongs" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="count" name="Songs" stroke="#8b5cf6" fill="url(#gradSongs)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </Section>

                      <Section title="Top Songs by Plays" subtitle="Most popular tracks on the platform" icon={BarChart3} delay={0.6}>
                        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                          {(contentStats?.topSongs || []).map((song: any, i: number) => (
                            <div key={song.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                              <span className="text-lg font-bold text-orange-500/50 w-6 text-right">{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white truncate">{song.title}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {song.genre && <Badge variant="outline" className="text-[10px] border-white/10 text-gray-400">{song.genre}</Badge>}
                                  {song.generatedWithAI && <Badge className="text-[10px] bg-purple-500/10 text-purple-400 border-0">AI</Badge>}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-semibold text-white">{formatNumber(song.plays)}</p>
                                <p className="text-[10px] text-gray-500">plays</p>
                              </div>
                            </div>
                          ))}
                          {(!contentStats?.topSongs?.length) && <p className="text-xs text-gray-500 text-center py-8">No song data yet</p>}
                        </div>
                      </Section>
                    </div>

                    <Section title="Video Projects" subtitle="Music video creation statistics" icon={Video} delay={0.7}>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                        {(videoData?.byStatus || []).map((s: any, i: number) => (
                          <div key={i} className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-xs text-gray-500 capitalize">{s.status || "Unknown"}</p>
                            <p className="text-2xl font-bold text-white mt-1">{s.count}</p>
                          </div>
                        ))}
                        {videoData?.paid && (
                          <>
                            <div className="px-4 py-3 rounded-xl bg-green-500/5 border border-green-500/10">
                              <p className="text-xs text-green-400">Paid Projects</p>
                              <p className="text-2xl font-bold text-green-400 mt-1">{videoData.paid.totalPaid}</p>
                            </div>
                            <div className="px-4 py-3 rounded-xl bg-orange-500/5 border border-orange-500/10">
                              <p className="text-xs text-orange-400">Video Revenue</p>
                              <p className="text-2xl font-bold text-orange-400 mt-1">{formatCurrency(videoData.paid.totalRevenue)}</p>
                            </div>
                          </>
                        )}
                      </div>
                    </Section>
                  </motion.div>
                )}

                {/* USERS TAB */}
                {activeTab === "users" && (
                  <motion.div key="users" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
                      <KPICard icon={Users} label="Total Users" value={overview?.totalUsers || 0} gradient={GRADIENT_PAIRS[0]} delay={0.05} />
                      <KPICard icon={CreditCard} label="Subscribers" value={overview?.activeSubscriptions || 0} gradient={GRADIENT_PAIRS[2]} delay={0.1} />
                      <KPICard icon={GraduationCap} label="Course Enrollments" value={overview?.courseEnrollments || 0} gradient={GRADIENT_PAIRS[4]} delay={0.15} />
                      <KPICard icon={ShoppingBag} label="Total Sales" value={overview?.totalSalesCount || 0} gradient={GRADIENT_PAIRS[5]} delay={0.2} />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
                      <Section title="User Registrations" subtitle={`Growth over last ${periodLabels[selectedPeriod]}`} icon={TrendingUp} delay={0.3}>
                        <div className="h-[300px] sm:h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={userGrowth || []}>
                              <defs>
                                <linearGradient id="gradUserArea" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor="#f97316" stopOpacity={0.4} />
                                  <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Area type="monotone" dataKey="totalUsers" name="Total Users" stroke="#f97316" fill="url(#gradUserArea)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </Section>

                      <Section title="Credit System" subtitle="Purchases vs deductions over time" icon={CreditCard} delay={0.4}>
                        <div className="h-[300px] sm:h-[340px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={creditsData?.recentActivity || []}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                              <XAxis dataKey="date" tick={{ fill: "#888", fontSize: 11 }} tickFormatter={(v) => { try { return format(new Date(v), "MM/dd"); } catch { return v; }}} />
                              <YAxis tick={{ fill: "#888", fontSize: 11 }} />
                              <Tooltip content={<CustomTooltip />} />
                              <Legend formatter={(value: string) => <span className="text-gray-300 text-xs">{value}</span>} />
                              <Bar dataKey="purchases" name="Purchases" fill="#10b981" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="deductions" name="Used" fill="#ef4444" radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </Section>
                    </div>

                    <Section title="Credit Transactions Summary" subtitle="Breakdown by transaction type" icon={Database} delay={0.5}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                        {(creditsData?.byType || []).map((t: any, i: number) => (
                          <div key={i} className="px-4 py-3 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-xs text-gray-500 capitalize">{t.type}</p>
                            <p className="text-xl sm:text-2xl font-bold text-white mt-1">{formatNumber(Math.abs(t.total))}</p>
                            <p className="text-[10px] text-gray-500">{t.count} transactions</p>
                          </div>
                        ))}
                        {(!creditsData?.byType?.length) && <p className="text-xs text-gray-500 col-span-4 text-center py-4">No credit data yet</p>}
                      </div>
                    </Section>
                  </motion.div>
                )}

                {/* CHARTS TAB */}
                {activeTab === "charts" && (
                  <motion.div key="charts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                    <ChartsIntelligenceTab />
                  </motion.div>
                )}
              </AnimatePresence>
            )}

            <div className="mt-8 mb-4 text-center">
              <p className="text-xs text-gray-600">Data sourced directly from PostgreSQL database · Auto-refreshes every 60s</p>
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}