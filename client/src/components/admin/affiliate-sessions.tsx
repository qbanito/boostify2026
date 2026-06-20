import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TrendingUp, Send, Users, Percent, RefreshCw, Loader2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../../lib/queryClient';

interface AffiliateData {
  id: number;
  fullName: string;
  email: string;
  commissionRate: string;
  status: string;
  totalClicks: number;
  totalConversions: number;
  totalEarnings: string;
  pendingPayment: string;
  paidAmount: string;
  level: string;
  paymentMethod: string;
  createdAt: string;
}

interface AffiliateStats {
  totalAffiliates: number;
  totalEarnings: number;
  totalPendingPayments: number;
  totalPaidOut: number;
  totalClicks: number;
  totalConversions: number;
  conversionRate: string;
  topPerformers: Array<{ id: number; name: string; email: string; level: string; conversions: number; earnings: number }>;
}

export function AffiliateSessions() {
  const [selectedAffiliate, setSelectedAffiliate] = useState<AffiliateData | null>(null);
  const [affiliates, setAffiliates] = useState<AffiliateData[]>([]);
  const [stats, setStats] = useState<AffiliateStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, affiliatesRes] = await Promise.all([
        apiRequest('GET', '/api/affiliate/admin/stats'),
        apiRequest('GET', '/api/affiliate/admin/all'),
      ]);
      if (statsRes.success) setStats(statsRes.stats);
      if (affiliatesRes.success) setAffiliates(affiliatesRes.affiliates || []);
    } catch (err: any) {
      console.error('[AFFILIATE ADMIN]', err);
      setError(err.message || 'Error loading affiliate data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalCommission = stats?.totalEarnings || 0;
  const totalPaid = stats?.totalPaidOut || 0;
  const totalPending = stats?.totalPendingPayments || 0;
  const totalReferrals = stats?.totalConversions || 0;

  // Build chart data from real affiliates by grouping by month
  const chartData = (() => {
    const monthMap: Record<string, { sales: number; commission: number; paid: number }> = {};
    for (const aff of affiliates) {
      const date = new Date(aff.createdAt);
      const month = date.toLocaleString('en', { month: 'short' });
      if (!monthMap[month]) monthMap[month] = { sales: 0, commission: 0, paid: 0 };
      monthMap[month].commission += Number(aff.totalEarnings);
      monthMap[month].paid += Number(aff.paidAmount);
      monthMap[month].sales += Number(aff.totalEarnings) / (Number(aff.commissionRate) / 100 || 0.1);
    }
    return Object.entries(monthMap).map(([month, data]) => ({ month, ...data }));
  })();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': case 'approved':
        return 'bg-green-500/20 text-green-300';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'rejected': case 'suspended':
        return 'bg-red-500/20 text-red-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Refresh */}
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={fetchData} disabled={loading} className="text-orange-400 border-orange-500/30">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="bg-red-500/10 border-red-500/30">
          <CardContent className="py-3 text-red-300 text-sm">{error}</CardContent>
        </Card>
      )}

      {/* Header Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Total Commission</p>
            <p className="text-2xl md:text-3xl font-bold text-orange-400">${totalCommission >= 1000 ? (totalCommission / 1000).toFixed(1) + 'k' : totalCommission.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Paid Out</p>
            <p className="text-2xl md:text-3xl font-bold text-green-400">${totalPaid >= 1000 ? (totalPaid / 1000).toFixed(1) + 'k' : totalPaid.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Pending</p>
            <p className="text-2xl md:text-3xl font-bold text-yellow-400">${totalPending >= 1000 ? (totalPending / 1000).toFixed(1) + 'k' : totalPending.toFixed(0)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Referrals</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-400">{totalReferrals}</p>
          </CardContent>
        </Card>
      </div>

      {/* Sales & Commission Chart */}
      {chartData.length > 0 && (
      <Card className="bg-slate-900/50 border-slate-700 w-full">
        <CardHeader>
          <CardTitle className="text-orange-400 text-sm md:text-base">Affiliate Sales & Commissions</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <div className="w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height={200} minHeight={200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
              <Legend />
              <Bar dataKey="sales" fill="#FF8C00" name="Sales" />
              <Bar dataKey="commission" fill="#10B981" name="Commission" />
              <Bar dataKey="paid" fill="#3B82F6" name="Paid Out" />
            </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Affiliates Table */}
      <Card className="bg-slate-900/50 border-slate-700 w-full">
        <CardHeader>
          <CardTitle className="text-orange-400 text-sm md:text-base">Affiliate Payouts ({affiliates.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-orange-400" /></div>
          ) : affiliates.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No affiliates registered yet</p>
          ) : (
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full min-w-[640px] text-xs md:text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/30">
                <tr>
                  <th className="text-left p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Affiliate</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Comm%</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Clicks</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Earned</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Paid</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Pending</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Conv</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Status</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Details</th>
                </tr>
              </thead>
              <tbody>
                {affiliates.map((aff) => (
                  <tr key={aff.id} className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedAffiliate(aff)}>
                    <td className="p-2 md:p-3 text-white font-medium text-xs md:text-sm whitespace-nowrap">{aff.fullName}</td>
                    <td className="p-2 md:p-3 text-center"><Badge className="bg-orange-500/20 text-orange-300 text-xs">{Number(aff.commissionRate)}%</Badge></td>
                    <td className="p-2 md:p-3 text-center text-white text-xs md:text-sm whitespace-nowrap">{aff.totalClicks}</td>
                    <td className="p-2 md:p-3 text-center text-white font-semibold text-xs md:text-sm whitespace-nowrap">${Number(aff.totalEarnings).toLocaleString()}</td>
                    <td className="p-2 md:p-3 text-center text-green-300 text-xs md:text-sm whitespace-nowrap">${Number(aff.paidAmount).toLocaleString()}</td>
                    <td className="p-2 md:p-3 text-center text-yellow-300 text-xs md:text-sm whitespace-nowrap">${Number(aff.pendingPayment).toLocaleString()}</td>
                    <td className="p-2 md:p-3 text-center text-blue-300 font-bold text-xs md:text-sm">{aff.totalConversions}</td>
                    <td className="p-2 md:p-3 text-center">
                      <Badge className={`${getStatusColor(aff.status)} text-xs`}>
                        {aff.status}
                      </Badge>
                    </td>
                    <td className="p-2 md:p-3 text-center">
                      <Button size="sm" variant="ghost" className="text-orange-400 hover:bg-orange-500/10 p-1" onClick={(e) => { e.stopPropagation(); setSelectedAffiliate(aff); }}>
                        <Send className="h-3 w-3 md:h-4 md:w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          )}
        </CardContent>
      </Card>

      {/* Affiliate Details */}
      {selectedAffiliate && (
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-orange-400 text-sm md:text-base">Affiliate Details: {selectedAffiliate.fullName}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
            <div className="space-y-3">
              <div>
                <p className="text-slate-400 text-sm">Email</p>
                <p className="text-white font-mono text-xs">{selectedAffiliate.email}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Commission Rate</p>
                <p className="text-white font-bold flex items-center gap-2">
                  <Percent className="h-5 w-5 text-orange-400" />
                  {Number(selectedAffiliate.commissionRate)}%
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Level</p>
                <Badge className="bg-purple-500/20 text-purple-300">{selectedAffiliate.level}</Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-slate-400 text-sm">Total Clicks</p>
                <p className="text-white text-2xl font-bold flex items-center gap-2">
                  <Users className="h-6 w-6 text-blue-400" />
                  {selectedAffiliate.totalClicks}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Conversions</p>
                <p className="text-white text-lg font-bold">{selectedAffiliate.totalConversions}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Payment Method</p>
                <Badge className="bg-blue-500/20 text-blue-300 capitalize">{selectedAffiliate.paymentMethod || 'N/A'}</Badge>
              </div>
            </div>
            <div className="space-y-3">
              <div className="p-4 bg-green-500/10 rounded-lg border border-green-500/20">
                <p className="text-green-300 text-sm">Total Earned</p>
                <p className="text-2xl font-bold text-green-400">${Number(selectedAffiliate.totalEarnings).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                <p className="text-yellow-300 text-sm">Pending Payout</p>
                <p className="text-2xl font-bold text-yellow-400">${Number(selectedAffiliate.pendingPayment).toLocaleString()}</p>
              </div>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                <Send className="h-4 w-4 mr-2" />
                Send Payout
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
