import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { AlertCircle, TrendingUp, DollarSign, Zap } from 'lucide-react';

interface ApiStats {
  period: string;
  totals: {
    totalRequests: number;
    totalTokens: number;
    totalCost: string;
    avgCost: string;
  };
  providerStats: Array<{
    provider: string;
    count: number;
    totalTokens: number;
    totalCost: string;
    successRate: number;
  }>;
  dailyTrend: Array<{
    date: string;
    count: number;
    totalCost: string;
  }>;
  topModels: Array<{
    model: string;
    count: number;
    totalTokens: number;
    totalCost: string;
  }>;
  errorStats: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
}

interface RecentCall {
  id: number;
  provider: string;
  model: string;
  tokensUsed: number;
  cost: string;
  status: string;
  responseTime: number;
  createdAt: string;
  userName: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

export function ApiUsageDashboard() {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [recentCalls, setRecentCalls] = useState<RecentCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, recentRes] = await Promise.all([
        fetch(`/api/admin/api-usage/stats?days=${days}`),
        fetch('/api/admin/api-usage/recent?limit=20')
      ]);

      const statsData = await statsRes.json();
      const recentData = await recentRes.json();

      setStats(statsData);
      setRecentCalls(recentData.calls || []);
    } catch (error) {
      console.error('Error loading API usage data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-slate-400">
        Loading API usage data...
      </div>
    );
  }

  if (!stats || !stats.totals) {
    return (
      <div className="w-full p-6">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <p className="text-slate-400">No API usage data available yet. Start making API calls to see statistics here.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalCost = parseFloat(String(stats.totals?.totalCost || '0'));

  return (
    <div className="space-y-6">
      {/* Header with Period Selector */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
        <h2 className="text-xl sm:text-2xl font-bold text-white">API Usage Monitor</h2>
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-600">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Total Requests</p>
                <p className="text-xl sm:text-3xl font-bold text-white">{(stats.totals?.totalRequests || 0).toLocaleString()}</p>
              </div>
              <Zap className="h-8 w-8 sm:h-12 sm:w-12 text-blue-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Total Tokens</p>
                <p className="text-xl sm:text-3xl font-bold text-white">{((stats.totals?.totalTokens || 0) / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K</p>
              </div>
              <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-green-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Total Cost</p>
                <p className="text-xl sm:text-3xl font-bold text-white">${totalCost.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 sm:h-12 sm:w-12 text-purple-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Avg Cost/Request</p>
                <p className="text-xl sm:text-3xl font-bold text-white">${parseFloat(String(stats.totals?.avgCost || '0')).toFixed(4)}</p>
              </div>
              <AlertCircle className="h-8 w-8 sm:h-12 sm:w-12 text-orange-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Cost Trend */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Daily Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569'
                  }}
                  formatter={(value: any) => `$${parseFloat(String(value)).toFixed(2)}`}
                />
                <Line
                  type="monotone"
                  dataKey="totalCost"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Provider Usage Pie */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Usage by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.providerStats || []}
                  dataKey="count"
                  nameKey="provider"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(stats.providerStats || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Provider Stats Table */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Provider Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="text-left p-3 text-slate-400">Provider</th>
                  <th className="text-right p-3 text-slate-400">Requests</th>
                  <th className="text-right p-3 text-slate-400">Tokens</th>
                  <th className="text-right p-3 text-slate-400">Cost</th>
                  <th className="text-right p-3 text-slate-400">Success Rate</th>
                </tr>
              </thead>
              <tbody>
                {(stats.providerStats || []).map((stat) => (
                  <tr key={stat.provider} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-3 text-white capitalize font-medium">{stat.provider}</td>
                    <td className="p-3 text-right text-slate-300">{stat.count || 0}</td>
                    <td className="p-3 text-right text-slate-300">{((stat.totalTokens || 0) / 1000).toFixed(1)}K</td>
                    <td className="p-3 text-right text-white font-semibold">${parseFloat(String(stat.totalCost || '0')).toFixed(2)}</td>
                    <td className="p-3 text-right">
                      <Badge
                        variant={Number(stat.successRate || 0) >= 95 ? 'default' : 'secondary'}
                        className={Number(stat.successRate || 0) >= 95 ? 'bg-green-500/20 text-green-300' : 'bg-orange-500/20 text-orange-300'}
                      >
                        {Number(stat.successRate || 0).toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Models */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Top Models Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats.topModels || []).slice(0, 5).map((model, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-slate-800/50 rounded-lg">
                <span className="text-white font-medium truncate">{model.model || 'Unknown'}</span>
                <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm flex-shrink-0">
                  <span className="text-slate-400">{model.count || 0} calls</span>
                  <span className="text-slate-400">{((model.totalTokens || 0) / 1000).toFixed(1)}K tokens</span>
                  <span className="text-purple-300 font-semibold">${parseFloat(String(model.totalCost || '0')).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Calls */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent API Calls</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="text-left p-3 text-slate-400">User</th>
                  <th className="text-left p-3 text-slate-400">Provider</th>
                  <th className="text-left p-3 text-slate-400">Model</th>
                  <th className="text-right p-3 text-slate-400">Tokens</th>
                  <th className="text-right p-3 text-slate-400">Cost</th>
                  <th className="text-center p-3 text-slate-400">Status</th>
                  <th className="text-right p-3 text-slate-400">Time</th>
                </tr>
              </thead>
              <tbody>
                {(recentCalls || []).slice(0, 10).map((call) => (
                  <tr key={call.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-3 text-white">{call.userName || 'API'}</td>
                    <td className="p-3 text-slate-300 capitalize">{call.provider || 'unknown'}</td>
                    <td className="p-3 text-slate-400 text-xs">{call.model || '-'}</td>
                    <td className="p-3 text-right text-slate-300">{call.tokensUsed || 0}</td>
                    <td className="p-3 text-right text-white font-semibold">${parseFloat(String(call.cost || '0')).toFixed(4)}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={call.status === 'success' ? 'default' : 'secondary'}
                        className={call.status === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}
                      >
                        {call.status || 'unknown'}
                      </Badge>
                    </td>
                    <td className="p-3 text-right text-slate-400 text-xs">{call.responseTime || 0}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
