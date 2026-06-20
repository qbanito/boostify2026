import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { DollarSign, TrendingUp, Users, CreditCard, Download } from 'lucide-react';

interface AccountingStats {
  period: string;
  totals: {
    totalRevenue: string;
    totalGross: string;
    totalTransactions: number;
    completedTransactions: number;
    totalTax: string;
    totalDiscount: string;
    avgTransactionValue: string;
  };
  revenueByType: Array<{
    type: string;
    count: number;
    total: string;
    gross: string;
    tax: string;
    discount: string;
  }>;
  dailyTrend: Array<{
    date: string;
    total: string;
    count: number;
  }>;
  topCustomers: Array<{
    userId: number | null;
    userName: string | null;
    userEmail: string | null;
    totalSpent: string;
    transactionCount: number;
  }>;
  paymentMethods: Array<{
    method: string | null;
    count: number;
    total: string;
  }>;
}

interface Transaction {
  id: number;
  type: string;
  description: string;
  amount: string;
  netAmount: string;
  paymentStatus: string;
  paymentMethod: string | null;
  userName: string | null;
  userEmail: string | null;
  createdAt: string;
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
const TYPE_COLORS: Record<string, string> = {
  subscription: '#3B82F6',
  product_purchase: '#10B981',
  course_purchase: '#F59E0B',
  service_fee: '#EF4444',
  refund: '#8B5CF6',
  payment: '#EC4899'
};

export function AccountingDashboard() {
  const [stats, setStats] = useState<AccountingStats | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState('30');

  useEffect(() => {
    loadData();
  }, [days]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsRes, transRes] = await Promise.all([
        fetch(`/api/admin/accounting/stats?days=${days}`),
        fetch(`/api/admin/accounting/transactions?limit=20`)
      ]);

      const statsData = await statsRes.json();
      const transData = await transRes.json();

      setStats(statsData);
      setTransactions(transData.transactions || []);
    } catch (error) {
      console.error('Error loading accounting data:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    window.location.href = `/api/admin/accounting/export/csv?days=${days}`;
  };

  if (loading) {
    return (
      <div className="w-full h-96 flex items-center justify-center text-slate-400">
        Loading accounting data...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full p-6">
        <Card className="bg-slate-900/50 border-slate-700">
          <CardContent className="pt-6">
            <p className="text-slate-400">No accounting data available yet.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalRevenue = parseFloat(stats.totals.totalRevenue || '0');
  const totalTransactions = stats.totals.totalTransactions || 0;
  const avgValue = parseFloat(stats.totals.avgTransactionValue || '0');
  const completionRate = totalTransactions > 0 ? ((stats.totals.completedTransactions / totalTransactions) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row gap-3 md:gap-0 md:items-center md:justify-between">
        <h2 className="text-xl md:text-2xl font-bold text-white">Accounting & Revenue</h2>
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger className="w-full sm:w-40 bg-slate-800 border-slate-600 text-xs sm:text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport} variant="outline" size="sm" className="w-full sm:w-auto text-xs sm:text-sm">
            <Download className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />Export CSV
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Total Revenue</p>
                <p className="text-xl sm:text-3xl font-bold text-white">${totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>
              </div>
              <DollarSign className="h-8 w-8 sm:h-12 sm:w-12 text-green-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Transactions</p>
                <p className="text-xl sm:text-3xl font-bold text-white">{totalTransactions.toLocaleString()}</p>
              </div>
              <CreditCard className="h-8 w-8 sm:h-12 sm:w-12 text-blue-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Avg Transaction</p>
                <p className="text-xl sm:text-3xl font-bold text-white">${avgValue.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 sm:h-12 sm:w-12 text-purple-400 opacity-20" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-xs sm:text-sm mb-1">Completion Rate</p>
                <p className="text-xl sm:text-3xl font-bold text-white">{completionRate}%</p>
              </div>
              <Users className="h-8 w-8 sm:h-12 sm:w-12 text-orange-400 opacity-20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Daily Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyTrend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
                <XAxis dataKey="date" stroke="#888" />
                <YAxis stroke="#888" />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value: any) => `$${parseFloat(value).toFixed(2)}`}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Revenue by Type */}
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Revenue by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={stats.revenueByType || []}
                  dataKey="total"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {(stats.revenueByType || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={TYPE_COLORS[entry.type] || COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }}
                  formatter={(value: any) => `$${parseFloat(value).toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by Type Table */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Revenue Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="text-left p-3 text-slate-400">Type</th>
                  <th className="text-right p-3 text-slate-400">Count</th>
                  <th className="text-right p-3 text-slate-400">Gross</th>
                  <th className="text-right p-3 text-slate-400">Tax</th>
                  <th className="text-right p-3 text-slate-400">Discount</th>
                  <th className="text-right p-3 text-slate-400">Net</th>
                </tr>
              </thead>
              <tbody>
                {(stats.revenueByType || []).map((type) => (
                  <tr key={type.type} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-3 text-white capitalize font-medium">{type.type.replace('_', ' ')}</td>
                    <td className="p-3 text-right text-slate-300">{type.count}</td>
                    <td className="p-3 text-right text-slate-300">${parseFloat(type.gross).toFixed(2)}</td>
                    <td className="p-3 text-right text-orange-300">${parseFloat(type.tax).toFixed(2)}</td>
                    <td className="p-3 text-right text-red-300">${parseFloat(type.discount).toFixed(2)}</td>
                    <td className="p-3 text-right text-green-300 font-semibold">${parseFloat(type.total).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top Customers */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Top Customers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stats.topCustomers || []).map((customer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <p className="text-white font-medium">{customer.userName || 'Anonymous'}</p>
                  <p className="text-xs text-slate-400">{customer.userEmail}</p>
                </div>
                <div className="text-right">
                  <p className="text-white font-semibold">${parseFloat(customer.totalSpent).toFixed(2)}</p>
                  <p className="text-xs text-slate-400">{customer.transactionCount} transactions</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card className="bg-slate-900/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr>
                  <th className="text-left p-3 text-slate-400">Date</th>
                  <th className="text-left p-3 text-slate-400">Type</th>
                  <th className="text-left p-3 text-slate-400">Description</th>
                  <th className="text-left p-3 text-slate-400">Customer</th>
                  <th className="text-right p-3 text-slate-400">Amount</th>
                  <th className="text-center p-3 text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {(transactions || []).map((trans) => (
                  <tr key={trans.id} className="border-b border-slate-800 hover:bg-slate-800/50">
                    <td className="p-3 text-slate-300 text-xs">
                      {new Date(trans.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-slate-300 capitalize">{trans.type.replace('_', ' ')}</td>
                    <td className="p-3 text-white">{trans.description}</td>
                    <td className="p-3 text-slate-400">{trans.userName || 'N/A'}</td>
                    <td className="p-3 text-right text-white font-semibold">${parseFloat(trans.netAmount).toFixed(2)}</td>
                    <td className="p-3 text-center">
                      <Badge
                        variant={trans.paymentStatus === 'completed' ? 'default' : 'secondary'}
                        className={trans.paymentStatus === 'completed' ? 'bg-green-500/20 text-green-300' : 'bg-yellow-500/20 text-yellow-300'}
                      >
                        {trans.paymentStatus}
                      </Badge>
                    </td>
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
