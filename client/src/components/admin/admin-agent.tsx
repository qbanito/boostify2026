import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { apiRequest } from '../../lib/queryClient';
import { 
  Sparkles, Loader, TrendingUp, TrendingDown, AlertCircle, CheckCircle, 
  Lightbulb, DollarSign, CreditCard, Activity, BarChart3, ArrowUpRight, ArrowDownRight,
  Wallet, Zap, Clock, Users, ShoppingBag, Video, Coins, RefreshCw, Percent
} from 'lucide-react';

interface Breakdown {
  byType: { type: string; count: number; amount: string }[];
  byPaymentStatus: { status: string; count: number; amount: string }[];
  byPlan: { plan: string; count: number; revenue: string }[];
  byApiProvider: { provider: string; cost: string; calls: number }[];
  byPlatformRevType?: { type: string; amount: string; count: number }[];
  topModels?: { model: string; cost: string; calls: number }[];
}

interface RecentTx {
  type: string;
  description: string;
  amount: string;
  status: string;
  date: string;
}

interface ChartPoint {
  day: string;
  value: string;
}

interface Analysis {
  analysis: string;
  metrics: {
    totalRevenue: string;
    totalExpenses: string;
    netProfit: string;
    profitMargin: string;
    completionRate: string;
    transactionCount: number;
    revenueGrowth: string;
    mrr: string;
    activeSubscriptions: number;
    apiCalls: number;
    apiTokens: number;
    newUsers: number;
    totalUsers: number;
    creditsPurchased: number;
    creditsSpent: number;
    creditTxCount: number;
    totalCreditsInCirculation: number;
    creditHolders: number;
    platformRevenueTotal: string;
    merchSalesTotal: string;
    merchPlatformFees: string;
    merchSalesCount: number;
    videoRevenueTotal: string;
    videoInternalCost: string;
    videoProfit: string;
    videoCount: number;
    affiliatePayouts: string;
    affiliatePending: string;
  };
  breakdowns?: Breakdown;
  charts?: { dailyRevenue: ChartPoint[]; dailyApiCost: ChartPoint[] };
  recentTransactions?: RecentTx[];
  period?: { days: number; startDate: string; endDate: string };
}

// Minimal sparkline bar chart
function MiniBarChart({ data, color = 'bg-orange-400', height = 40 }: { data: number[]; color?: string; height?: number }) {
  if (!data.length) return null;
  const max = Math.max(...data, 0.01);
  return (
    <div className="flex items-end gap-[2px]" style={{ height }}>
      {data.map((v, i) => (
        <div
          key={i}
          className={`${color} rounded-t-sm opacity-80 hover:opacity-100 transition-opacity min-w-[3px] flex-1`}
          style={{ height: `${Math.max(2, (v / max) * height)}px` }}
          title={`${v.toFixed(2)}`}
        />
      ))}
    </div>
  );
}

export function AdminAgent() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState('30');
  const [lastRun, setLastRun] = useState<string | null>(null);

  const runAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/api/admin/agent/analyze', {
        method: 'POST',
        data: { days },
      });
      if (data.success && data.metrics) {
        setAnalysis(data);
        setLastRun(new Date().toLocaleTimeString());
      } else {
        setError(data.error || 'Invalid response format from server');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to run analysis. Please try again.');
      console.error('Error running analysis:', error);
    } finally {
      setLoading(false);
    }
  }, [days]);

  // Auto-run on first mount
  useEffect(() => { runAnalysis(); }, []);

  const parseAnalysis = (text: string) => {
    const sections = text.split(/\*\*([^*]+)\*\*/);
    const parsed: { title: string; content: string }[] = [];
    for (let i = 1; i < sections.length; i += 2) {
      const content = sections[i + 1]?.trim() || '';
      if (content) parsed.push({ title: sections[i], content });
    }
    return parsed;
  };

  const fmt = (v: string | number) => {
    const n = typeof v === 'string' ? parseFloat(v) : v;
    if (isNaN(n)) return '$0.00';
    return n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(2)}`;
  };

  const sectionIcon = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('alert') || t.includes('risk')) return <AlertCircle className="h-5 w-5 text-red-400" />;
    if (t.includes('growth') || t.includes('opportunit')) return <TrendingUp className="h-5 w-5 text-green-400" />;
    if (t.includes('health') || t.includes('score')) return <CheckCircle className="h-5 w-5 text-blue-400" />;
    if (t.includes('revenue') || t.includes('insight')) return <BarChart3 className="h-5 w-5 text-purple-400" />;
    if (t.includes('cost') || t.includes('optim')) return <TrendingDown className="h-5 w-5 text-red-400" />;
    if (t.includes('action')) return <Activity className="h-5 w-5 text-orange-400" />;
    if (t.includes('credit')) return <Coins className="h-5 w-5 text-yellow-400" />;
    return <Lightbulb className="h-5 w-5 text-yellow-400" />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-6 w-6 md:h-8 md:w-8 text-orange-400" />
            Financial AI Agent
          </h2>
          <p className="text-slate-400 mt-1 text-sm">
            AI-powered analysis from real platform data
            {analysis?.period && (
              <span className="text-orange-400 ml-2">
                ({analysis.period.startDate.split('T')[0]} → {analysis.period.endDate.split('T')[0]})
              </span>
            )}
            {lastRun && <span className="text-slate-500 ml-2">· Updated {lastRun}</span>}
          </p>
        </div>
        <div className="flex gap-2 flex-col sm:flex-row w-full md:w-auto">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-orange-500/20 hover:border-orange-500/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={runAnalysis} disabled={loading} className="bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 w-full sm:w-auto">
            {loading ? (
              <>
                <Loader className="h-4 w-4 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Analysis
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="pt-6 flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <div>
              <p className="text-red-400 font-medium">Analysis failed</p>
              <p className="text-red-400/80 text-sm">{error}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ KEY METRICS — Row 1: Core P&L ═══ */}
      {analysis?.metrics && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Revenue */}
            <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">Revenue</p>
                  <DollarSign className="h-4 w-4 text-green-400" />
                </div>
                <p className="text-xl font-bold text-green-400">{fmt(analysis.metrics.totalRevenue)}</p>
                {parseFloat(analysis.metrics.revenueGrowth) !== 0 && (
                  <div className={`flex items-center gap-1 mt-1 text-xs ${parseFloat(analysis.metrics.revenueGrowth) >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {parseFloat(analysis.metrics.revenueGrowth) >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {analysis.metrics.revenueGrowth}% vs prev
                  </div>
                )}
              </CardContent>
            </Card>

            {/* API Costs */}
            <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">API Costs</p>
                  <Zap className="h-4 w-4 text-red-400" />
                </div>
                <p className="text-xl font-bold text-red-400">{fmt(analysis.metrics.totalExpenses)}</p>
                <p className="text-xs text-slate-500 mt-1">{analysis.metrics.apiCalls.toLocaleString()} calls</p>
              </CardContent>
            </Card>

            {/* Net Profit */}
            <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">Net Profit</p>
                  <Wallet className="h-4 w-4 text-blue-400" />
                </div>
                <p className={`text-xl font-bold ${parseFloat(analysis.metrics.netProfit) >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                  {fmt(analysis.metrics.netProfit)}
                </p>
                <p className="text-xs text-slate-500 mt-1">{analysis.metrics.profitMargin}% margin</p>
              </CardContent>
            </Card>

            {/* MRR */}
            <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">MRR</p>
                  <Activity className="h-4 w-4 text-purple-400" />
                </div>
                <p className="text-xl font-bold text-purple-400">{fmt(analysis.metrics.mrr)}</p>
                <p className="text-xs text-slate-500 mt-1">{analysis.metrics.activeSubscriptions} subs</p>
              </CardContent>
            </Card>

            {/* Users */}
            <Card className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border-cyan-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">Users</p>
                  <Users className="h-4 w-4 text-cyan-400" />
                </div>
                <p className="text-xl font-bold text-cyan-400">{analysis.metrics.totalUsers.toLocaleString()}</p>
                <p className="text-xs text-green-400 mt-1">+{analysis.metrics.newUsers} new</p>
              </CardContent>
            </Card>

            {/* Transactions */}
            <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-slate-400 text-xs">Transactions</p>
                  <CreditCard className="h-4 w-4 text-yellow-400" />
                </div>
                <p className="text-xl font-bold text-yellow-400">{analysis.metrics.transactionCount}</p>
                <p className="text-xs text-slate-500 mt-1">{analysis.metrics.completionRate}% completed</p>
              </CardContent>
            </Card>
          </div>

          {/* ═══ Row 2: Revenue Streams mini cards ═══ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShoppingBag className="h-4 w-4 text-pink-400" />
                  <p className="text-slate-400 text-xs">Merch Sales</p>
                </div>
                <p className="text-lg font-bold text-white">{fmt(analysis.metrics.merchSalesTotal)}</p>
                <p className="text-xs text-slate-500">{analysis.metrics.merchSalesCount} orders · {fmt(analysis.metrics.merchPlatformFees)} fees</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Video className="h-4 w-4 text-indigo-400" />
                  <p className="text-slate-400 text-xs">Video Production</p>
                </div>
                <p className="text-lg font-bold text-white">{fmt(analysis.metrics.videoRevenueTotal)}</p>
                <p className="text-xs text-slate-500">{analysis.metrics.videoCount} projects · {fmt(analysis.metrics.videoProfit)} profit</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Coins className="h-4 w-4 text-amber-400" />
                  <p className="text-slate-400 text-xs">Credits Economy</p>
                </div>
                <p className="text-lg font-bold text-white">{analysis.metrics.creditsPurchased.toLocaleString()}</p>
                <p className="text-xs text-slate-500">{analysis.metrics.creditsSpent.toLocaleString()} used · {analysis.metrics.totalCreditsInCirculation.toLocaleString()} in circulation</p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-slate-700">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-2 mb-2">
                  <Percent className="h-4 w-4 text-teal-400" />
                  <p className="text-slate-400 text-xs">Affiliate Payouts</p>
                </div>
                <p className="text-lg font-bold text-white">{fmt(analysis.metrics.affiliatePayouts)}</p>
                <p className="text-xs text-slate-500">{fmt(analysis.metrics.affiliatePending)} pending</p>
              </CardContent>
            </Card>
          </div>

          {/* ═══ Charts Row ═══ */}
          {analysis.charts && (analysis.charts.dailyRevenue.length > 1 || analysis.charts.dailyApiCost.length > 1) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analysis.charts.dailyRevenue.length > 1 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-green-400 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Daily Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={analysis.charts.dailyRevenue.map(d => parseFloat(d.value))}
                      color="bg-green-400"
                      height={60}
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>{analysis.charts.dailyRevenue[0]?.day.slice(5)}</span>
                      <span>{analysis.charts.dailyRevenue[analysis.charts.dailyRevenue.length - 1]?.day.slice(5)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
              {analysis.charts.dailyApiCost.length > 1 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-red-400 flex items-center gap-2">
                      <TrendingDown className="h-4 w-4" /> Daily API Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <MiniBarChart
                      data={analysis.charts.dailyApiCost.map(d => parseFloat(d.value))}
                      color="bg-red-400"
                      height={60}
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                      <span>{analysis.charts.dailyApiCost[0]?.day.slice(5)}</span>
                      <span>{analysis.charts.dailyApiCost[analysis.charts.dailyApiCost.length - 1]?.day.slice(5)}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ Breakdowns Row ═══ */}
          {analysis.breakdowns && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Revenue by Type */}
              {analysis.breakdowns.byType.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" /> Revenue by Type
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.breakdowns.byType.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 capitalize">{t.type.replace(/_/g, ' ')}</span>
                        <div className="text-right">
                          <span className="text-white font-medium">${t.amount}</span>
                          <span className="text-slate-500 text-xs ml-2">({t.count})</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Subscriptions by Plan */}
              {analysis.breakdowns.byPlan.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Subscriptions by Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.breakdowns.byPlan.map((p, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <Badge variant="outline" className="text-xs border-orange-500/30 capitalize">{p.plan}</Badge>
                        <div className="text-right">
                          <span className="text-white font-medium">${p.revenue}/mo</span>
                          <span className="text-slate-500 text-xs ml-2">({p.count})</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* API Costs by Provider */}
              {analysis.breakdowns.byApiProvider.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                      <Zap className="h-4 w-4" /> API Cost by Provider
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.breakdowns.byApiProvider.map((a, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 capitalize">{a.provider}</span>
                        <div className="text-right">
                          <span className="text-white font-medium">${a.cost}</span>
                          <span className="text-slate-500 text-xs ml-2">({a.calls} calls)</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ Row: Top Models + Platform Revenue ═══ */}
          {analysis.breakdowns && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Top Models by Cost */}
              {analysis.breakdowns.topModels && analysis.breakdowns.topModels.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                      <Zap className="h-4 w-4" /> Top Models by Cost
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.breakdowns.topModels.map((m, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 truncate max-w-[120px] sm:max-w-[180px]" title={m.model}>{m.model}</span>
                        <div className="text-right shrink-0">
                          <span className="text-white font-medium">${m.cost}</span>
                          <span className="text-slate-500 text-xs ml-2">({m.calls})</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Platform Revenue Streams */}
              {analysis.breakdowns.byPlatformRevType && analysis.breakdowns.byPlatformRevType.length > 0 && (
                <Card className="bg-slate-900/50 border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Platform Revenue Streams
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analysis.breakdowns.byPlatformRevType.map((r, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-slate-300 capitalize truncate max-w-[120px] sm:max-w-[180px]">{r.type.replace(/_/g, ' ')}</span>
                        <div className="text-right shrink-0">
                          <span className="text-white font-medium">${r.amount}</span>
                          <span className="text-slate-500 text-xs ml-2">({r.count})</span>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ═══ Recent Transactions ═══ */}
          {analysis.recentTransactions && analysis.recentTransactions.length > 0 && (
            <Card className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
                  <Clock className="h-4 w-4" /> Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {analysis.recentTransactions.map((tx, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 border-b border-slate-800 last:border-0 text-sm gap-1 sm:gap-3">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <Badge variant="outline" className={`text-xs capitalize shrink-0 ${
                          tx.status === 'completed' ? 'border-green-500/40 text-green-400' : 
                          tx.status === 'pending' ? 'border-yellow-500/40 text-yellow-400' : 
                          'border-red-500/40 text-red-400'
                        }`}>
                          {tx.status}
                        </Badge>
                        <div className="min-w-0">
                          <p className="text-slate-200 text-xs truncate">{tx.description || '—'}</p>
                          <p className="text-slate-500 text-xs capitalize">{tx.type?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                      <div className="text-right sm:text-right text-left pl-8 sm:pl-0 shrink-0">
                        <p className="text-white font-medium">${tx.amount}</p>
                        <p className="text-slate-500 text-xs">{tx.date ? new Date(tx.date).toLocaleDateString() : '—'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* ═══ AI Analysis Results ═══ */}
      {analysis?.analysis && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-orange-400" />
            AI Analysis
          </h3>
          {parseAnalysis(analysis.analysis).map((section, idx) => (
            <Card key={idx} className="bg-slate-900/50 border-slate-700">
              <CardHeader className="pb-2">
                <CardTitle className="text-white flex items-center gap-2 text-base">
                  {sectionIcon(section.title)}
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-slate-300 whitespace-pre-wrap text-sm leading-relaxed">
                  {section.content}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ═══ Empty State ═══ */}
      {!analysis && !loading && !error && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-8 pb-8 text-center">
            <Sparkles className="h-12 w-12 text-orange-400 mx-auto mb-4 opacity-50" />
            <p className="text-slate-400 mb-1">Click "Run Analysis" to get AI-powered insights</p>
            <p className="text-slate-500 text-sm">Uses real data from transactions, subscriptions, credits, merch, and API usage</p>
          </CardContent>
        </Card>
      )}

      {/* Loading skeleton */}
      {loading && !analysis && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-700 animate-pulse">
                <CardContent className="pt-5 pb-4">
                  <div className="h-3 bg-slate-700 rounded w-16 mb-3" />
                  <div className="h-6 bg-slate-700 rounded w-20 mb-2" />
                  <div className="h-2 bg-slate-800 rounded w-12" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="bg-slate-900/50 border-slate-700 animate-pulse">
                <CardContent className="pt-4 pb-3">
                  <div className="h-3 bg-slate-700 rounded w-20 mb-3" />
                  <div className="h-5 bg-slate-700 rounded w-16 mb-2" />
                  <div className="h-2 bg-slate-800 rounded w-24" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
