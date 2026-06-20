/**
 * EARNINGS CHART — Premium Financial Analytics (v2)
 * Glassmorphism stat cards, improved chart styling,
 * gradient area fills, animated counters, and sparkline mini-charts
 */

import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, DollarSign, ShoppingBag, Wallet, ArrowUpRight,
  ArrowDownRight, TrendingDown, Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { motion } from 'framer-motion';

interface EarningsChartProps {
  userId: number;
  days?: number;
}

interface DailyEarning {
  date: string;
  earnings: number;
  sales: number;
}

interface EarningsData {
  dailyEarnings: DailyEarning[];
  totalEarnings: number;
  totalSales: number;
  period: string;
}

interface WalletBalance {
  balance: number;
  totalEarnings: number;
  totalSpent: number;
  currency: string;
}

interface SalesStats {
  totalSales: number;
  pendingSales: number;
  totalRevenue: number;
  totalEarnings: number;
  topProduct: {
    name: string;
    sales: number;
    earnings: number;
  } | null;
}

// ═══════════════════════════════════════════
// MINI SPARKLINE
// ═══════════════════════════════════════════

function MiniSparkline({ data, color, width = 64, height = 28 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const id = `spl-${color.replace(/[^a-z0-9]/gi, '')}`;

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${id})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ═══════════════════════════════════════════
// CUSTOM TOOLTIP 
// ═══════════════════════════════════════════

function CustomTooltip({ active, payload, label, formatCurrency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="px-3 py-2 rounded-xl border border-white/10 shadow-xl" style={{ background: 'rgba(15,15,20,0.95)', backdropFilter: 'blur(12px)' }}>
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-400">{entry.name === 'ganancias' ? 'Earnings' : 'Sales'}:</span>
          <span className="font-bold text-white">
            {entry.name === 'ganancias' ? formatCurrency(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════

export function EarningsChart({ userId, days = 30 }: EarningsChartProps) {
  const { data: earningsData, isLoading: loadingEarnings } = useQuery<{ success: boolean; data: EarningsData }>({
    queryKey: ['/api/artist-wallet/earnings-history', userId, days],
    queryFn: async () => {
      const res = await fetch(`/api/artist-wallet/earnings-history/${userId}?days=${days}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: walletData, isLoading: loadingWallet } = useQuery<{ success: boolean; wallet: WalletBalance }>({
    queryKey: [`/api/artist-wallet/balance/${userId}`],
    enabled: !!userId,
  });

  const { data: statsData, isLoading: loadingStats } = useQuery<{ success: boolean; stats: SalesStats }>({
    queryKey: [`/api/artist-wallet/sales-stats/${userId}`],
    enabled: !!userId,
  });

  if (loadingEarnings || loadingWallet || loadingStats) {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-[88px] rounded-xl" />)}
        </div>
        <Skeleton className="h-[260px] rounded-xl" />
      </div>
    );
  }

  const earnings = earningsData?.data;
  const wallet = walletData?.wallet;
  const stats = statsData?.stats;

  const chartData = earnings?.dailyEarnings.map(item => ({
    date: new Date(item.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' }),
    ganancias: item.earnings,
    ventas: item.sales,
  })) || [];

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: wallet?.currency || 'USD' }).format(value);

  const calculateTrend = () => {
    if (!chartData || chartData.length < 14) return 0;
    const recent = chartData.slice(-7).reduce((s, i) => s + i.ganancias, 0) / 7;
    const prev = chartData.slice(-14, -7).reduce((s, i) => s + i.ganancias, 0) / 7;
    if (prev === 0) return recent > 0 ? 100 : 0;
    return ((recent - prev) / prev) * 100;
  };
  const trend = calculateTrend();

  const earningsSparkline = chartData.slice(-7).map(d => d.ganancias);
  const salesSparkline = chartData.slice(-7).map(d => d.ventas);

  return (
    <div className="space-y-3">
      {/* ───────── STAT CARDS ───────── */}
      <div className="grid grid-cols-2 gap-2">
        {/* Wallet Balance */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          data-testid="card-wallet-balance"
          className="relative overflow-hidden rounded-xl p-3 border border-emerald-500/15 group hover:border-emerald-500/30 transition-all duration-300"
          style={{ background: 'linear-gradient(145deg, rgba(16,185,129,0.08), rgba(0,0,0,0.3))' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-[30px] bg-emerald-500/8 group-hover:bg-emerald-500/12 transition-all" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-emerald-500/15">
                <Wallet className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-md bg-emerald-500/12 text-emerald-400">
                AVAILABLE
              </span>
            </div>
            <div className="text-lg font-black text-white tracking-tight mb-0.5" data-testid="text-balance">
              {formatCurrency(wallet?.balance || 0)}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">
                Total: {formatCurrency(wallet?.totalEarnings || 0)}
              </span>
              <MiniSparkline data={earningsSparkline} color="#10b981" width={40} height={16} />
            </div>
          </div>
        </motion.div>

        {/* Period Earnings */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          data-testid="card-period-earnings"
          className="relative overflow-hidden rounded-xl p-3 border border-blue-500/15 group hover:border-blue-500/30 transition-all duration-300"
          style={{ background: 'linear-gradient(145deg, rgba(59,130,246,0.08), rgba(0,0,0,0.3))' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-[30px] bg-blue-500/8 group-hover:bg-blue-500/12 transition-all" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-blue-500/15">
                <TrendingUp className="h-3.5 w-3.5 text-blue-400" />
              </div>
              {trend !== 0 && (
                <div className={`flex items-center gap-0.5 text-[10px] font-bold ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                  {Math.abs(trend).toFixed(1)}%
                </div>
              )}
            </div>
            <div className="text-lg font-black text-white tracking-tight mb-0.5" data-testid="text-period-earnings">
              {formatCurrency(earnings?.totalEarnings || 0)}
            </div>
            <span className="text-[10px] text-gray-500">
              {earnings?.totalSales || 0} sales · {days}d
            </span>
          </div>
        </motion.div>

        {/* Total Sales */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          data-testid="card-total-sales"
          className="relative overflow-hidden rounded-xl p-3 border border-purple-500/15 group hover:border-purple-500/30 transition-all duration-300"
          style={{ background: 'linear-gradient(145deg, rgba(168,85,247,0.08), rgba(0,0,0,0.3))' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-[30px] bg-purple-500/8 group-hover:bg-purple-500/12 transition-all" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-purple-500/15">
                <ShoppingBag className="h-3.5 w-3.5 text-purple-400" />
              </div>
              {(stats?.pendingSales || 0) > 0 && (
                <span className="text-[8px] font-black tracking-wider px-1.5 py-0.5 rounded-md bg-yellow-500/12 text-yellow-400">
                  {stats?.pendingSales} PENDING
                </span>
              )}
            </div>
            <div className="text-lg font-black text-white tracking-tight mb-0.5" data-testid="text-total-sales">
              {stats?.totalSales || 0}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-gray-500">Completed sales</span>
              <MiniSparkline data={salesSparkline} color="#a855f7" width={40} height={16} />
            </div>
          </div>
        </motion.div>

        {/* Top Product */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          data-testid="card-top-product"
          className="relative overflow-hidden rounded-xl p-3 border border-amber-500/15 group hover:border-amber-500/30 transition-all duration-300"
          style={{ background: 'linear-gradient(145deg, rgba(245,158,11,0.08), rgba(0,0,0,0.3))' }}
        >
          <div className="absolute top-0 right-0 w-20 h-20 rounded-full blur-[30px] bg-amber-500/8 group-hover:bg-amber-500/12 transition-all" />
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-amber-500/15">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" />
              </div>
              <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-md bg-amber-500/12 text-amber-400">
                TOP
              </span>
            </div>
            <div className="text-sm font-bold text-white mb-0.5 truncate" data-testid="text-top-product">
              {stats?.topProduct?.name || 'No sales yet'}
            </div>
            <span className="text-[10px] text-gray-500">
              {stats?.topProduct ? `${stats.topProduct.sales} units · ${formatCurrency(stats.topProduct.earnings)}` : '—'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* ───────── CHARTS ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Earnings Area Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25 }}
          data-testid="card-earnings-chart"
          className="rounded-xl p-4 border border-white/[0.06] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-emerald-500" />
                Earnings Trend
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Last {days} days · 30% commission</p>
            </div>
            {trend !== 0 && (
              <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-lg ${
                trend > 0 ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {trend > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(trend).toFixed(1)}%
              </div>
            )}
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="50%" stopColor="#10b981" stopOpacity={0.08} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                <Area
                  type="monotone"
                  dataKey="ganancias"
                  stroke="#10b981"
                  strokeWidth={2}
                  fill="url(#earnGrad)"
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#10b981', fill: '#111' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
              No earnings data yet
            </div>
          )}
        </motion.div>

        {/* Sales Bar Chart */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl p-4 border border-white/[0.06] overflow-hidden"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.2))' }}
        >
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <div className="w-1.5 h-4 rounded-full bg-blue-500" />
                Sales Volume
              </h3>
              <p className="text-[10px] text-gray-500 mt-0.5">Products sold per day</p>
            </div>
            <div className="text-[10px] text-gray-500 font-mono">
              Total: {stats?.totalSales || 0}
            </div>
          </div>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.3} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#6b7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip formatCurrency={formatCurrency} />} />
                <Bar
                  dataKey="ventas"
                  fill="url(#barGrad)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={24}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-gray-600 text-sm">
              No sales data yet
            </div>
          )}
        </motion.div>
      </div>

      {/* ───────── TREND INDICATOR ───────── */}
      {chartData.length >= 14 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className={`rounded-xl p-3 border flex items-center gap-3 ${
            trend > 0
              ? 'border-green-500/20 bg-green-500/[0.04]'
              : trend < 0
              ? 'border-red-500/20 bg-red-500/[0.04]'
              : 'border-gray-500/20 bg-gray-500/[0.04]'
          }`}
        >
          <div className={`p-2 rounded-lg ${
            trend > 0 ? 'bg-green-500/15' : trend < 0 ? 'bg-red-500/15' : 'bg-gray-500/15'
          }`}>
            {trend > 0 ? (
              <TrendingUp className="h-5 w-5 text-green-400" />
            ) : trend < 0 ? (
              <TrendingDown className="h-5 w-5 text-red-400" />
            ) : (
              <DollarSign className="h-5 w-5 text-gray-400" />
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-lg font-black ${
                trend > 0 ? 'text-green-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
              }`}>
                {trend > 0 ? '+' : ''}{trend.toFixed(1)}%
              </span>
              <span className="text-[10px] text-gray-500">vs previous 7 days</span>
            </div>
            <span className="text-[10px] text-gray-600">
              {trend > 0 ? 'Your sales are growing — keep it up!' :
               trend < 0 ? 'Sales have decreased — consider promoting' :
               'Sales are holding steady'}
            </span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
