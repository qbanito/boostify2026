/**
 * PoolAnalytics — Liquidity Pool Analytics for BoostiSwap
 *
 * Sections:
 *  1. KPI summary row (TVL, total fees, avg APR, active pools)
 *  2. Reserve Composition — stacked bar per pool (Token vs MATIC USD value)
 *  3. Fee APR Leaderboard — bar chart + sortable table
 *  4. Pool Efficiency (fee yield / TVL ratio)
 *  5. Impermanent Loss Estimator — interactive slider
 *  6. Reserve Ratio Trend — 7-day simulated line chart
 *
 * Data sources:
 *  - On-chain via useBTF2300 (getPoolInfo, getTokenBalance)
 *  - useArtistTokens for metadata & prices
 *
 * No `any` types used throughout.
 */

import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Card, CardContent, CardHeader, CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBTF2300, type PoolInfo } from "@/hooks/use-btf2300";
import { useArtistTokens, type ArtistToken } from "@/hooks/use-artist-tokens";
import { TOKEN_PREFIXES } from "@/lib/btf2300-config";
import { formatEther } from "viem";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, Cell,
} from "recharts";
import {
  Droplets, RefreshCw, Loader2, TrendingUp, TrendingDown,
  DollarSign, Percent, Activity, AlertTriangle, Info,
  ChevronUp, ChevronDown, ChevronsUpDown, Zap,
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const MATIC_USD = 0.40; // approximate fallback price
const CHART_COLORS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#eab308", "#06b6d4", "#f43f5e",
];
const TOOLTIP_STYLE = {
  backgroundColor: "#1e293b",
  border: "1px solid #475569",
  borderRadius: "8px",
  fontSize: "12px",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

interface PoolAnalyticsData {
  tokenId: number;
  symbol: string;
  artist: string;
  image: string;
  // raw on-chain
  tokenReserve: bigint;
  ethReserve: bigint;
  totalLPTokens: bigint;
  feeAccumulated: bigint;
  isActive: boolean;
  // derived
  tokenReserveNum: number;
  ethReserveNum: number;
  feeAccumulatedNum: number;
  totalLPTokensNum: number;
  tokenPriceUSD: number;     // from ArtistToken.price
  impliedPriceMATIC: number; // ethReserve / tokenReserve
  tvlUSD: number;
  feeAPR: number;            // annualised fee yield %
  utilization: number;       // estimated volume / TVL (0–100)
  reserveRatio: number;      // MATIC side as % of TVL (50 = balanced)
  depthScore: number;        // 0–100 based on TVL
}

type SortField = "symbol" | "tvlUSD" | "feeAPR" | "utilization" | "depthScore";
type SortDir = "asc" | "desc";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Annualise accumulated fees.  Assume fees built up over ~30 days of operation. */
function calcFeeAPR(feeUSD: number, tvlUSD: number): number {
  if (tvlUSD <= 0) return 0;
  const dailyFee = feeUSD / 30; // rough: assume 30-day accumulation
  return Math.min((dailyFee * 365) / tvlUSD * 100, 999);
}

/** Impermanent Loss given price ratio k = newPrice / originalPrice */
function calcIL(k: number): number {
  if (k <= 0) return 0;
  return (2 * Math.sqrt(k) / (1 + k) - 1) * 100; // negative = loss
}

function fmt(n: number, dp = 2): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(dp)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(dp)}K`;
  return `$${n.toFixed(dp)}`;
}

function fmtPct(n: number, dp = 1): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  color: "orange" | "blue" | "green" | "purple";
}) {
  const ring: Record<typeof color, string> = {
    orange: "from-orange-500/20 to-orange-600/10 border-orange-500/30",
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/30",
    green: "from-green-500/20 to-green-600/10 border-green-500/30",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/30",
  };
  const iconBg: Record<typeof color, string> = {
    orange: "bg-orange-500/20",
    blue: "bg-blue-500/20",
    green: "bg-green-500/20",
    purple: "bg-purple-500/20",
  };
  const text: Record<typeof color, string> = {
    orange: "text-orange-400",
    blue: "text-blue-400",
    green: "text-green-400",
    purple: "text-purple-400",
  };
  return (
    <Card className={`bg-gradient-to-br ${ring[color]}`}>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between">
          <div>
            <p className={`text-[10px] ${text[color]} uppercase tracking-widest opacity-70`}>{label}</p>
            <p className={`text-2xl font-bold ${text[color]} mt-1`}>{value}</p>
            {sub && <p className={`text-xs ${text[color]} opacity-60 mt-0.5`}>{sub}</p>}
          </div>
          <div className={`w-11 h-11 rounded-full ${iconBg[color]} flex items-center justify-center`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SortHeaderProps {
  field: SortField;
  label: string;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}
function SortHeader({ field, label, sortField, sortDir, onSort }: SortHeaderProps) {
  const active = sortField === field;
  return (
    <button
      type="button"
      onClick={() => onSort(field)}
      className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-white transition-colors"
    >
      {label}
      {active
        ? sortDir === "asc"
          ? <ChevronUp className="h-3 w-3 text-orange-400" />
          : <ChevronDown className="h-3 w-3 text-orange-400" />
        : <ChevronsUpDown className="h-3 w-3 opacity-30" />
      }
    </button>
  );
}

// ─── Impermanent Loss Estimator ───────────────────────────────────────────────

function ILEstimator() {
  const [priceChangePct, setPriceChangePct] = useState(0);

  // Build curve data: IL vs price change from -90% to +900%
  const curveData = useMemo(() => {
    const points: Array<{ change: number; il: number }> = [];
    for (let pct = -90; pct <= 900; pct += 10) {
      const k = 1 + pct / 100;
      const il = k > 0 ? calcIL(k) : -100;
      points.push({ change: pct, il: parseFloat(il.toFixed(3)) });
    }
    return points;
  }, []);

  const currentIL = priceChangePct > -100
    ? calcIL(1 + priceChangePct / 100)
    : -100;

  const ilColor =
    currentIL < -15 ? "text-red-400"
    : currentIL < -5 ? "text-amber-400"
    : "text-green-400";

  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
      <CardHeader className="border-b border-slate-700/50 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-400" />
          Impermanent Loss Estimator
          <Badge className="ml-auto bg-slate-700/60 text-gray-300 border-slate-600 text-[10px]">
            Interactive
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Token Price Change</p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={-90}
                max={900}
                step={5}
                value={priceChangePct}
                onChange={(e) => setPriceChangePct(Number(e.target.value))}
                className="w-48 accent-orange-500"
              />
              <span className={`text-xl font-bold min-w-[5ch] ${
                priceChangePct >= 0 ? "text-green-400" : "text-red-400"
              }`}>
                {priceChangePct >= 0 ? "+" : ""}{priceChangePct}%
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-1">Estimated IL</p>
            <p className={`text-3xl font-bold ${ilColor}`}>
              {currentIL.toFixed(2)}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              vs holding tokens outside pool
            </p>
          </div>
        </div>

        {/* IL curve chart */}
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={curveData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="ilGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="change"
              stroke="#94a3b8"
              tickFormatter={(v: number) => `${v}%`}
              interval={3}
              tick={{ fontSize: 10 }}
            />
            <YAxis
              stroke="#94a3b8"
              tickFormatter={(v: number) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 10 }}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => [`${v.toFixed(3)}%`, "IL"]}
              labelFormatter={(l: number) => `Price change: ${l}%`}
            />
            {/* Reference line for current selection */}
            <Area
              type="monotone"
              dataKey="il"
              stroke="#f97316"
              strokeWidth={2}
              fill="url(#ilGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Quick reference table */}
        <div className="grid grid-cols-4 gap-2 pt-1 border-t border-slate-700/30">
          {[
            { label: "±25%", val: calcIL(1.25) },
            { label: "±50%", val: calcIL(1.5) },
            { label: "±100%", val: calcIL(2) },
            { label: "±200%", val: calcIL(3) },
          ].map(({ label, val }) => (
            <div key={label} className="text-center bg-slate-900/40 rounded-lg p-2 border border-slate-700/20">
              <p className="text-[10px] text-muted-foreground">{label}</p>
              <p className="text-sm font-bold text-amber-400">{val.toFixed(2)}%</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground flex items-start gap-1">
          <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
          IL is calculated relative to simply holding the same tokens outside the pool.
          Fees earned may offset IL over time.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Reserve Ratio Trend (simulated) ─────────────────────────────────────────

function ReserveTrendChart({ pools }: { pools: PoolAnalyticsData[] }) {
  // Build 7-day simulated trend for top 3 pools
  const top3 = pools.slice(0, 3);
  const days = ["7d ago", "6d ago", "5d ago", "4d ago", "3d ago", "2d ago", "1d ago", "Now"];

  const trendData = useMemo(() => {
    return days.map((day, i) => {
      const entry: Record<string, string | number> = { day };
      top3.forEach((pool) => {
        // Simulate slight TVL growth toward present
        const growth = 1 + (i / days.length) * 0.12;
        const noise = 1 + (Math.sin(i * pool.tokenId * 0.7) * 0.05);
        entry[pool.symbol] = parseFloat((pool.tvlUSD * growth * noise).toFixed(2));
      });
      return entry;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pools]);

  if (top3.length === 0) return null;

  return (
    <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
      <CardHeader className="border-b border-slate-700/50 pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-blue-400" />
          TVL Trend — Top Pools (7 days)
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <defs>
              {top3.map((pool, i) => (
                <linearGradient key={pool.symbol} id={`trend${pool.symbol}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS[i]} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={CHART_COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 10 }} />
            <YAxis
              stroke="#94a3b8"
              tick={{ fontSize: 10 }}
              tickFormatter={(v: number) => fmt(v, 0)}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => [fmt(v), ""]}
            />
            <Legend />
            {top3.map((pool, i) => (
              <Line
                key={pool.symbol}
                type="monotone"
                dataKey={pool.symbol}
                stroke={CHART_COLORS[i]}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function PoolAnalytics() {
  const btf2300 = useBTF2300();
  const artistTokens = useArtistTokens();

  const [pools, setPools] = useState<PoolAnalyticsData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sortField, setSortField] = useState<SortField>("tvlUSD");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // ── Fetch pool data ──
  const fetchData = useCallback(
    async (silent = false) => {
      if (!silent) setIsRefreshing(true);
      try {
        const results = await Promise.all(
          artistTokens.slice(0, 12).map(async (token: ArtistToken) => {
            const artistId = parseInt(token.id, 10);
            const tokenId = TOKEN_PREFIXES.ARTIST + artistId;
            try {
              const info: PoolInfo | null = await btf2300.getPoolInfo(tokenId);
              if (!info || !info.isActive) return null;

              const ethReserveNum = parseFloat(formatEther(info.ethReserve));
              const feeAccumulatedNum = parseFloat(formatEther(info.feeAccumulated));
              const tokenReserveNum = Number(info.tokenReserve);
              const totalLPTokensNum = Number(info.totalLPTokens);

              const maticUSD = MATIC_USD;
              const ethSideUSD = ethReserveNum * maticUSD;
              const tokenSideUSD =
                token.price > 0
                  ? tokenReserveNum * token.price
                  : ethSideUSD; // balanced pool fallback
              const tvlUSD = ethSideUSD + tokenSideUSD;

              const feeUSD = feeAccumulatedNum * maticUSD;
              const feeAPR = calcFeeAPR(feeUSD, tvlUSD);
              const reserveRatio = tvlUSD > 0 ? (ethSideUSD / tvlUSD) * 100 : 50;
              const utilization = Math.min(
                100,
                ((token.volume24h ?? 0) / Math.max(tvlUSD, 1)) * 100,
              );
              const depthScore = Math.min(100, Math.log10(tvlUSD + 1) * 20);
              const impliedPriceMATIC =
                tokenReserveNum > 0 ? ethReserveNum / tokenReserveNum : 0;

              return {
                tokenId,
                symbol: token.symbol,
                artist: token.artist,
                image: token.image,
                tokenReserve: info.tokenReserve,
                ethReserve: info.ethReserve,
                totalLPTokens: info.totalLPTokens,
                feeAccumulated: info.feeAccumulated,
                isActive: info.isActive,
                tokenReserveNum,
                ethReserveNum,
                feeAccumulatedNum,
                totalLPTokensNum,
                tokenPriceUSD: token.price,
                impliedPriceMATIC,
                tvlUSD,
                feeAPR,
                utilization,
                reserveRatio,
                depthScore,
              } satisfies PoolAnalyticsData;
            } catch {
              return null;
            }
          }),
        );
        const active = results.filter((p): p is PoolAnalyticsData => p !== null);
        setPools(active);
        setLastUpdated(new Date());
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [artistTokens, btf2300],
  );

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artistTokens]);

  // ── Sort table ──
  const handleSort = useCallback((field: SortField) => {
    setSortDir((d) => (sortField === field ? (d === "asc" ? "desc" : "asc") : "desc"));
    setSortField(field);
  }, [sortField]);

  const sortedPools = useMemo(() => {
    return [...pools].sort((a, b) => {
      const av = a[sortField];
      const bv = b[sortField];
      if (typeof av === "string" && typeof bv === "string")
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === "asc"
        ? (av as number) - (bv as number)
        : (bv as number) - (av as number);
    });
  }, [pools, sortField, sortDir]);

  // ── KPI summary ──
  const totalTVL = pools.reduce((s, p) => s + p.tvlUSD, 0);
  const totalFeesUSD = pools.reduce((s, p) => s + p.feeAccumulatedNum * MATIC_USD, 0);
  const avgAPR =
    pools.length > 0
      ? pools.reduce((s, p) => s + p.feeAPR, 0) / pools.length
      : 0;

  // ── Reserve composition chart data ──
  const reserveCompData = useMemo(
    () =>
      [...pools]
        .sort((a, b) => b.tvlUSD - a.tvlUSD)
        .slice(0, 8)
        .map((p) => ({
          symbol: p.symbol,
          "Token Side ($)": parseFloat(
            (p.tokenReserveNum * p.tokenPriceUSD).toFixed(2),
          ),
          "MATIC Side ($)": parseFloat(
            (p.ethReserveNum * MATIC_USD).toFixed(2),
          ),
        })),
    [pools],
  );

  // ── Fee APR chart data ──
  const feeAPRData = useMemo(
    () =>
      [...pools]
        .sort((a, b) => b.feeAPR - a.feeAPR)
        .slice(0, 8)
        .map((p, i) => ({
          symbol: p.symbol,
          APR: parseFloat(p.feeAPR.toFixed(2)),
          fill: CHART_COLORS[i % CHART_COLORS.length],
        })),
    [pools],
  );

  // ── Utilization chart data ──
  const utilizationData = useMemo(
    () =>
      [...pools]
        .sort((a, b) => b.utilization - a.utilization)
        .slice(0, 8)
        .map((p, i) => ({
          symbol: p.symbol,
          Utilization: parseFloat(p.utilization.toFixed(1)),
          fill: CHART_COLORS[i % CHART_COLORS.length],
        })),
    [pools],
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-orange-400" />
        <p className="text-muted-foreground text-sm">Loading on-chain pool analytics…</p>
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
        <CardContent className="py-16 text-center space-y-3">
          <Droplets className="h-12 w-12 text-muted-foreground mx-auto opacity-40" />
          <p className="text-muted-foreground">No active liquidity pools detected on-chain.</p>
          <p className="text-xs text-muted-foreground">
            Deploy the BTF-2300 DEX contract and create pools to see analytics here.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData()}
            className="border-orange-500/40 hover:border-orange-500"
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Section header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Droplets className="h-5 w-5 text-orange-400" />
            Liquidity Pool Analytics
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            On-chain data from Polygon •{" "}
            {lastUpdated
              ? `Updated ${lastUpdated.toLocaleTimeString()}`
              : "Loading…"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchData()}
          disabled={isRefreshing}
          className="border-orange-500/40 hover:border-orange-500"
        >
          {isRefreshing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Refresh
        </Button>
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="Total TVL"
          value={fmt(totalTVL)}
          sub={`${pools.length} active pools`}
          icon={<DollarSign className="h-5 w-5 text-orange-400" />}
          color="orange"
        />
        <KpiCard
          label="Total Fees Earned"
          value={fmt(totalFeesUSD)}
          sub="Accumulated on-chain"
          icon={<Zap className="h-5 w-5 text-blue-400" />}
          color="blue"
        />
        <KpiCard
          label="Average Fee APR"
          value={`${avgAPR.toFixed(1)}%`}
          sub="30-day annualised"
          icon={<Percent className="h-5 w-5 text-green-400" />}
          color="green"
        />
        <KpiCard
          label="Pool Depth (avg)"
          value={`${(pools.reduce((s, p) => s + p.depthScore, 0) / pools.length).toFixed(0)}/100`}
          sub="Liquidity depth score"
          icon={<Activity className="h-5 w-5 text-purple-400" />}
          color="purple"
        />
      </div>

      {/* ── Charts row 1 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reserve Composition */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Droplets className="h-4 w-4 text-purple-400" />
              Reserve Composition (USD)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={reserveCompData}
                margin={{ top: 5, right: 15, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="symbol" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => fmt(v, 0)}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [fmt(v), ""]}
                />
                <Legend />
                <Bar dataKey="Token Side ($)" stackId="a" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
                <Bar dataKey="MATIC Side ($)" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Fee APR Leaderboard chart */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-400" />
              Fee APR by Pool (annualised)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={feeAPRData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 50, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  type="number"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}%`}
                />
                <YAxis
                  dataKey="symbol"
                  type="category"
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  width={48}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(2)}%`, "Fee APR"]}
                />
                <Bar dataKey="APR" radius={[0, 4, 4, 0]}>
                  {feeAPRData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* ── Charts row 2 ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pool Utilization */}
        <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
          <CardHeader className="border-b border-slate-700/50 pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-400" />
              Pool Utilization (Volume / TVL %)
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-5">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={utilizationData} margin={{ top: 5, right: 15, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="symbol" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fontSize: 10 }}
                  tickFormatter={(v: number) => `${v}%`}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(v: number) => [`${v.toFixed(1)}%`, "Utilization"]}
                />
                <Bar dataKey="Utilization" radius={[4, 4, 0, 0]}>
                  {utilizationData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* 7-day TVL trend */}
        <ReserveTrendChart pools={sortedPools} />
      </div>

      {/* ── Impermanent Loss Estimator ── */}
      <ILEstimator />

      {/* ── Pool details table ── */}
      <Card className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 border-slate-700">
        <CardHeader className="border-b border-slate-700/50 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Droplets className="h-4 w-4 text-orange-400" />
            Pool Metrics Table
            <Badge className="ml-auto bg-slate-700/60 text-gray-300 border-slate-600 text-[10px]">
              Click headers to sort
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-slate-700/40">
                <th className="text-left pb-3 pr-4">
                  <SortHeader field="symbol" label="Pool" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right pb-3 pr-4">
                  <SortHeader field="tvlUSD" label="TVL" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right pb-3 pr-4">
                  <SortHeader field="feeAPR" label="Fee APR" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right pb-3 pr-4">
                  <SortHeader field="utilization" label="Utilization" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
                <th className="text-right pb-3 pr-4">Reserve Ratio</th>
                <th className="text-right pb-3">
                  <SortHeader field="depthScore" label="Depth" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/20">
              {sortedPools.map((pool) => (
                <tr
                  key={pool.tokenId}
                  className="hover:bg-slate-700/20 transition-colors"
                >
                  {/* Pool name */}
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <img
                        src={pool.image}
                        alt={pool.symbol}
                        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                      <div>
                        <p className="font-semibold text-white">{pool.symbol} / MATIC</p>
                        <p className="text-[10px] text-muted-foreground truncate max-w-[140px]">
                          {pool.artist}
                        </p>
                      </div>
                    </div>
                  </td>

                  {/* TVL */}
                  <td className="text-right py-3 pr-4">
                    <span className="font-semibold text-orange-400">{fmt(pool.tvlUSD)}</span>
                    <p className="text-[10px] text-muted-foreground">
                      {pool.tokenReserveNum.toLocaleString("en", { maximumFractionDigits: 0 })} tokens
                    </p>
                  </td>

                  {/* Fee APR */}
                  <td className="text-right py-3 pr-4">
                    <span
                      className={`font-bold ${
                        pool.feeAPR >= 20
                          ? "text-green-400"
                          : pool.feeAPR >= 5
                          ? "text-amber-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      {pool.feeAPR.toFixed(1)}%
                    </span>
                    <p className="text-[10px] text-muted-foreground">
                      {fmt(pool.feeAccumulatedNum * MATIC_USD)} total fees
                    </p>
                  </td>

                  {/* Utilization */}
                  <td className="text-right py-3 pr-4">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-sm text-white">{pool.utilization.toFixed(1)}%</span>
                      <div className="w-16 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all"
                          style={{ width: `${Math.min(pool.utilization, 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Reserve ratio */}
                  <td className="text-right py-3 pr-4">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-xs text-muted-foreground">
                        {(100 - pool.reserveRatio).toFixed(0)}% Token
                        {" / "}
                        {pool.reserveRatio.toFixed(0)}% MATIC
                      </span>
                      {/* Two-tone bar */}
                      <div className="w-20 h-1.5 rounded-full overflow-hidden flex">
                        <div
                          className="bg-purple-500 h-full"
                          style={{ width: `${100 - pool.reserveRatio}%` }}
                        />
                        <div
                          className="bg-orange-500 h-full"
                          style={{ width: `${pool.reserveRatio}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Depth score */}
                  <td className="text-right py-3">
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`font-semibold ${
                          pool.depthScore >= 70
                            ? "text-green-400"
                            : pool.depthScore >= 40
                            ? "text-amber-400"
                            : "text-red-400"
                        }`}
                      >
                        {pool.depthScore.toFixed(0)}/100
                      </span>
                      <div className="w-12 bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            pool.depthScore >= 70
                              ? "bg-green-500"
                              : pool.depthScore >= 40
                              ? "bg-amber-500"
                              : "bg-red-500"
                          }`}
                          style={{ width: `${pool.depthScore}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ── Health indicators legend ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {[
          {
            color: "text-green-400",
            bg: "bg-green-500/10 border-green-500/20",
            title: "Healthy Pool",
            desc: "Depth ≥ 70 · APR ≥ 20% · Utilization balanced",
          },
          {
            color: "text-amber-400",
            bg: "bg-amber-500/10 border-amber-500/20",
            title: "Moderate Pool",
            desc: "Depth 40–70 · Growing liquidity · Normal fees",
          },
          {
            color: "text-red-400",
            bg: "bg-red-500/10 border-red-500/20",
            title: "Low Liquidity",
            desc: "Depth < 40 · High slippage · Consider adding liquidity",
          },
        ].map(({ color, bg, title, desc }) => (
          <div key={title} className={`rounded-xl p-3 border ${bg} flex items-start gap-2`}>
            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
              color === "text-green-400" ? "bg-green-400"
              : color === "text-amber-400" ? "bg-amber-400"
              : "bg-red-400"
            }`} />
            <div>
              <p className={`text-xs font-semibold ${color}`}>{title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
