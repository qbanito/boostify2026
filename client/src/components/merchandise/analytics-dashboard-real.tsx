/**
 * Analytics Dashboard — Real data from /api/merch-analytics endpoints
 * Replaces the old hardcoded analytics-dashboard.tsx
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "../ui/card";
import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/skeleton";
import { Button } from "../ui/button";
import {
  TrendingUp, TrendingDown, DollarSign, Package, ShoppingCart,
  Users, BarChart3, Activity, Clock, ArrowUpRight, ArrowDownRight,
} from "lucide-react";

interface SalesOverview {
  allTime: {
    totalSales: number;
    totalRevenue: number;
    totalProductionCost: number;
    totalArtistEarnings: number;
    totalPlatformFees: number;
    totalQuantity: number;
    avgOrderValue: number;
  };
  last30Days: {
    totalSales: number;
    totalRevenue: number;
    revenueTrend: string;
    salesTrend: string;
  };
  statusBreakdown: Record<string, number>;
  uniqueBuyers: number;
}

interface TrendPoint {
  date: string;
  revenue: number;
  sales: number;
  fees: number;
}

interface TopProduct {
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  totalPlatformFees: number;
  orderCount: number;
}

interface RecentSale {
  id: number;
  productName: string;
  saleAmount: number;
  quantity: number;
  artistEarning: number;
  platformFee: number;
  buyerEmail: string | null;
  status: string;
  createdAt: string;
  artistName: string | null;
}

interface RevenueArtist {
  artistId: number;
  artistName: string;
  totalRevenue: number;
  totalArtistEarnings: number;
  totalPlatformFees: number;
  totalSales: number;
}

export function AnalyticsDashboardReal() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const { data: overview, isLoading: loadingOverview } = useQuery<SalesOverview>({
    queryKey: ['/api/merch-analytics/overview'],
    queryFn: async () => {
      const res = await fetch('/api/merch-analytics/overview');
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: trendData } = useQuery<{ period: string; trend: TrendPoint[] }>({
    queryKey: ['/api/merch-analytics/sales-trend', period],
    queryFn: async () => {
      const res = await fetch(`/api/merch-analytics/sales-trend?period=${period}`);
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
  });

  const { data: topProducts = [] } = useQuery<TopProduct[]>({
    queryKey: ['/api/merch-analytics/top-products'],
    queryFn: async () => {
      const res = await fetch('/api/merch-analytics/top-products');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: recentSales = [] } = useQuery<RecentSale[]>({
    queryKey: ['/api/merch-analytics/recent-sales'],
    queryFn: async () => {
      const res = await fetch('/api/merch-analytics/recent-sales');
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: revenueSplit } = useQuery<{ byArtist: RevenueArtist[]; platformMerchRevenue: number }>({
    queryKey: ['/api/merch-analytics/revenue-split'],
    queryFn: async () => {
      const res = await fetch('/api/merch-analytics/revenue-split');
      if (!res.ok) return { byArtist: [], platformMerchRevenue: 0 };
      return res.json();
    },
  });

  const at = overview?.allTime;
  const l30 = overview?.last30Days;
  const trend = trendData?.trend || [];

  // Simple sparkline bar chart using CSS
  const maxRevenue = Math.max(...trend.map(t => t.revenue), 1);

  if (loadingOverview) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <Card key={i} className="p-5"><Skeleton className="h-4 w-20 mb-2" /><Skeleton className="h-8 w-24" /></Card>)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-green-500 to-emerald-500 rounded-lg">
          <BarChart3 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="text-lg font-bold">Sales Analytics</h3>
          <p className="text-xs text-muted-foreground">Real-time data from merchandise transactions</p>
        </div>
      </div>

      {/* Primary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          icon={<DollarSign className="w-4 h-4 text-green-500" />}
          title="Total Revenue"
          value={`$${(at?.totalRevenue || 0).toFixed(2)}`}
          trend={l30?.revenueTrend}
          accent="green"
        />
        <KpiCard
          icon={<ShoppingCart className="w-4 h-4 text-blue-500" />}
          title="Total Sales"
          value={String(at?.totalSales || 0)}
          trend={l30?.salesTrend}
          accent="blue"
        />
        <KpiCard
          icon={<Package className="w-4 h-4 text-purple-500" />}
          title="Avg Order Value"
          value={`$${(at?.avgOrderValue || 0).toFixed(2)}`}
          accent="purple"
        />
        <KpiCard
          icon={<Users className="w-4 h-4 text-orange-500" />}
          title="Unique Buyers"
          value={String(overview?.uniqueBuyers || 0)}
          accent="orange"
        />
      </div>

      {/* Earnings breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Platform Fees Earned</p>
          <p className="text-xl font-bold text-orange-500">${(at?.totalPlatformFees || 0).toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Artist Earnings Paid</p>
          <p className="text-xl font-bold text-green-400">${(at?.totalArtistEarnings || 0).toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">Production Costs</p>
          <p className="text-xl font-bold text-red-400">${(at?.totalProductionCost || 0).toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground mb-1">30-Day Revenue</p>
          <p className="text-xl font-bold text-blue-400">${(l30?.totalRevenue || 0).toFixed(2)}</p>
        </Card>
      </div>

      {/* Sales Trend Chart */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" /> Sales Trend
          </h4>
          <div className="flex items-center gap-1">
            {(['7d', '30d', '90d', '1y'] as const).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1 text-xs rounded-md transition-colors ${
                  period === p
                    ? 'bg-orange-500 text-white'
                    : 'bg-muted hover:bg-muted/80 text-muted-foreground'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {trend.length > 0 ? (
          <div className="space-y-2">
            {/* Revenue bars */}
            <div className="flex items-end gap-[2px] h-32">
              {trend.slice(-60).map((point, i) => {
                const pct = (point.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-stretch justify-end h-full group relative">
                    <div
                      className="bg-gradient-to-t from-orange-500/80 to-orange-400/60 rounded-t-sm min-h-[2px] transition-all hover:from-orange-500 hover:to-orange-400"
                      style={{ height: `${Math.max(pct, 2)}%` }}
                    />
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block bg-popover border rounded-md px-2 py-1 text-[10px] whitespace-nowrap shadow-lg z-10">
                      <p className="font-medium">{point.date}</p>
                      <p className="text-green-400">${point.revenue.toFixed(2)}</p>
                      <p className="text-muted-foreground">{point.sales} sales</p>
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Date labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-1">
              <span>{trend[0]?.date}</span>
              <span>{trend[trend.length - 1]?.date}</span>
            </div>
          </div>
        ) : (
          <div className="h-32 flex items-center justify-center text-muted-foreground text-xs">
            No sales data for this period
          </div>
        )}
      </Card>

      {/* Bottom Row: Top Products + Recent Sales */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <Card className="p-5">
          <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-500" /> Top Products
          </h4>
          {topProducts.length > 0 ? (
            <div className="space-y-3">
              {topProducts.slice(0, 5).map((p, i) => {
                const barWidth = topProducts[0]?.totalRevenue > 0
                  ? (p.totalRevenue / topProducts[0].totalRevenue) * 100
                  : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium truncate flex-1 mr-2">
                        <span className="text-muted-foreground mr-1">#{i + 1}</span>
                        {p.productName}
                      </span>
                      <span className="text-green-400 font-medium">${p.totalRevenue.toFixed(2)}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full transition-all" style={{ width: `${barWidth}%` }} />
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{p.totalQuantity} sold</span>
                      <span>{p.orderCount} orders</span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-xs">No product data yet</div>
          )}
        </Card>

        {/* Recent Sales */}
        <Card className="p-5">
          <h4 className="font-semibold text-sm mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" /> Recent Sales
          </h4>
          {recentSales.length > 0 ? (
            <div className="space-y-2 max-h-[320px] overflow-y-auto">
              {recentSales.slice(0, 10).map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-2.5 bg-muted/30 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{sale.productName}</p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{sale.buyerEmail || 'Unknown'}</span>
                      <span>·</span>
                      <span>{sale.artistName || 'N/A'}</span>
                      <span>·</span>
                      <span>{new Date(sale.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right ml-3">
                    <p className="text-xs font-bold text-green-400">${sale.saleAmount.toFixed(2)}</p>
                    <Badge className={`text-[9px] px-1.5 py-0 border-0 ${
                      sale.status === 'completed' ? 'bg-green-500/15 text-green-400'
                        : sale.status === 'pending' ? 'bg-amber-500/15 text-amber-400'
                        : sale.status === 'refunded' ? 'bg-red-500/15 text-red-400'
                        : 'bg-gray-500/15 text-gray-400'
                    }`}>{sale.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-muted-foreground text-xs">No sales recorded yet</div>
          )}
        </Card>
      </div>

      {/* Revenue Split by Artist */}
      {revenueSplit?.byArtist && revenueSplit.byArtist.length > 0 && (
        <Card className="p-5">
          <h4 className="font-semibold text-sm mb-4">Revenue Split by Artist</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-xs text-muted-foreground font-medium">Artist</th>
                  <th className="text-right p-2 text-xs text-muted-foreground font-medium">Revenue</th>
                  <th className="text-right p-2 text-xs text-muted-foreground font-medium">Artist Earned</th>
                  <th className="text-right p-2 text-xs text-muted-foreground font-medium">Platform Fee</th>
                  <th className="text-right p-2 text-xs text-muted-foreground font-medium">Sales</th>
                </tr>
              </thead>
              <tbody>
                {revenueSplit.byArtist.map(a => (
                  <tr key={a.artistId} className="border-b hover:bg-muted/20">
                    <td className="p-2 text-xs font-medium">{a.artistName}</td>
                    <td className="p-2 text-xs text-right font-medium">${a.totalRevenue.toFixed(2)}</td>
                    <td className="p-2 text-xs text-right text-green-400">${a.totalArtistEarnings.toFixed(2)}</td>
                    <td className="p-2 text-xs text-right text-orange-400">${a.totalPlatformFees.toFixed(2)}</td>
                    <td className="p-2 text-xs text-right text-muted-foreground">{a.totalSales}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Status Breakdown */}
      {overview?.statusBreakdown && Object.keys(overview.statusBreakdown).length > 0 && (
        <Card className="p-5">
          <h4 className="font-semibold text-sm mb-3">Order Status Breakdown</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(overview.statusBreakdown).map(([status, cnt]) => (
              <div key={status} className="flex items-center gap-2 px-4 py-2 bg-muted/30 rounded-lg">
                <div className={`w-2 h-2 rounded-full ${
                  status === 'completed' ? 'bg-green-500'
                    : status === 'pending' ? 'bg-amber-500'
                    : status === 'refunded' ? 'bg-red-500'
                    : 'bg-gray-500'
                }`} />
                <span className="text-xs capitalize">{status}</span>
                <Badge variant="secondary" className="text-[10px] px-1.5">{cnt}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Empty State */}
      {(at?.totalSales || 0) === 0 && (
        <Card className="p-12 text-center">
          <BarChart3 className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="font-semibold text-lg mb-2">No sales data yet</h3>
          <p className="text-sm text-muted-foreground">
            Sales analytics will populate automatically as customers purchase merchandise through your store.
          </p>
        </Card>
      )}
    </div>
  );
}

// ── KPI Card Helper ──────────────────────────────────────────
function KpiCard({
  icon, title, value, trend, accent,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
  trend?: string;
  accent: string;
}) {
  const trendNum = parseFloat(trend || '0');
  const trendPositive = trendNum > 0;

  return (
    <Card className={`p-4 bg-gradient-to-br from-${accent}-500/10 to-${accent}-500/5 border-${accent}-500/20`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <p className="text-[11px] text-muted-foreground">{title}</p>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-[11px] ${trendPositive ? 'text-green-400' : trendNum < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
          {trendPositive ? <ArrowUpRight className="w-3 h-3" /> : trendNum < 0 ? <ArrowDownRight className="w-3 h-3" /> : null}
          {trendNum !== 0 ? `${trendPositive ? '+' : ''}${trend}%` : 'No change'} vs prev 30d
        </div>
      )}
    </Card>
  );
}
