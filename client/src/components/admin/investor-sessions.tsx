import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { TrendingUp, Send, Percent, Calendar, RefreshCw, Loader2, Database } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { apiRequest } from '../../lib/queryClient';

interface InvestorPayment {
  id: number;
  investorId: number | null;
  investorName: string | null;
  investorEmail: string | null;
  investmentType: string;
  investmentAmount: string;
  investmentDate: string;
  expectedReturn: string;
  expectedReturnAmount: string;
  interestRate: string;
  totalPaidOut: string;
  pendingPayment: string;
  lastPaymentDate: string | null;
  nextPaymentDate: string | null;
  paymentMethod: string | null;
  paymentStatus: string;
  paymentFrequency: string | null;
  status: string;
  notes: string | null;
}

interface InvestorStats {
  totalInvested: number;
  totalPaidOut: number;
  totalPending: number;
  expectedReturns: number;
  activeCount: number;
  completedCount: number;
  totalInvestors: number;
}

export function InvestorSessions() {
  const [selectedInvestor, setSelectedInvestor] = useState<InvestorPayment | null>(null);
  const [payments, setPayments] = useState<InvestorPayment[]>([]);
  const [stats, setStats] = useState<InvestorStats | null>(null);
  const [chartData, setChartData] = useState<Array<{ month: string; invested: number; paid: number; earned: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsRes, paymentsRes] = await Promise.all([
        apiRequest('GET', '/api/admin/investor-payments/stats'),
        apiRequest('GET', '/api/admin/investor-payments'),
      ]);
      if (statsRes.success) {
        setStats(statsRes.stats);
        setChartData(statsRes.chartData || []);
      }
      if (paymentsRes.success) setPayments(paymentsRes.payments || []);
    } catch (err: any) {
      console.error('[INVESTOR ADMIN]', err);
      setError(err.message || 'Error loading investor data');
    } finally {
      setLoading(false);
    }
  };

  const seedData = async () => {
    setSeeding(true);
    try {
      const res = await apiRequest('POST', '/api/admin/investor-payments/seed');
      if (res.success) {
        await fetchData();
      }
    } catch (err: any) {
      console.error('[INVESTOR SEED]', err);
      setError(err.message || 'Error seeding data');
    } finally {
      setSeeding(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const totalInvested = stats?.totalInvested || 0;
  const totalPaidOut = stats?.totalPaidOut || 0;
  const totalPending = stats?.totalPending || 0;
  const expectedReturns = stats?.expectedReturns || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-500/20 text-green-300';
      case 'pending':
        return 'bg-yellow-500/20 text-yellow-300';
      case 'partial':
        return 'bg-blue-500/20 text-blue-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'equity':
        return 'bg-purple-500/20 text-purple-300';
      case 'debt':
        return 'bg-red-500/20 text-red-300';
      case 'revenue_share':
        return 'bg-green-500/20 text-green-300';
      case 'loan':
        return 'bg-blue-500/20 text-blue-300';
      default:
        return 'bg-slate-500/20 text-slate-300';
    }
  };

  const formatAmount = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(0)}k`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Refresh & Seed */}
      <div className="flex justify-end gap-2">
        {payments.length === 0 && !loading && (
          <Button size="sm" variant="outline" onClick={seedData} disabled={seeding} className="text-purple-400 border-purple-500/30">
            {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
            Seed $1M Investment
          </Button>
        )}
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
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Total Invested</p>
            <p className="text-2xl md:text-3xl font-bold text-purple-400">{formatAmount(totalInvested)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Paid Out</p>
            <p className="text-2xl md:text-3xl font-bold text-green-400">{formatAmount(totalPaidOut)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-yellow-500/10 to-yellow-500/5 border-yellow-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Pending</p>
            <p className="text-2xl md:text-3xl font-bold text-yellow-400">{formatAmount(totalPending)}</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4 md:pt-6 text-center">
            <p className="text-slate-400 text-xs md:text-sm mb-2">Expected Returns</p>
            <p className="text-2xl md:text-3xl font-bold text-blue-400">{formatAmount(expectedReturns)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Investment Growth Chart */}
      {chartData.length > 0 && (
      <Card className="bg-slate-900/50 border-slate-700 w-full">
        <CardHeader>
          <CardTitle className="text-orange-400 text-sm md:text-base">Investment Growth & Payouts</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          <div className="w-full overflow-x-auto">
            <ResponsiveContainer width="100%" height={200} minHeight={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#404040" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} formatter={(value: any) => `$${Number(value).toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="invested" stroke="#8B5CF6" strokeWidth={2} name="Total Invested" />
              <Line type="monotone" dataKey="paid" stroke="#10B981" strokeWidth={2} name="Paid Out" />
              <Line type="monotone" dataKey="earned" stroke="#F59E0B" strokeWidth={2} name="Earnings" />
            </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Investors Table */}
      <Card className="bg-slate-900/50 border-slate-700 w-full">
        <CardHeader>
          <CardTitle className="text-orange-400 text-sm md:text-base">Investor Payments ({payments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-2 md:p-6">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-purple-400" /></div>
          ) : payments.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-slate-400 mb-3">No investor payments recorded yet</p>
              <Button size="sm" onClick={seedData} disabled={seeding} className="bg-purple-600 hover:bg-purple-700">
                {seeding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Database className="h-4 w-4 mr-1" />}
                Seed Initial $1M Investment
              </Button>
            </div>
          ) : (
          <div className="overflow-x-auto -mx-2 md:mx-0">
            <table className="w-full min-w-[600px] text-xs md:text-sm">
              <thead className="border-b border-slate-700 bg-slate-800/30">
                <tr>
                  <th className="text-left p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Investor</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Type</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Investment</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Paid</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Pending</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Expected</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Freq</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Status</th>
                  <th className="text-center p-2 md:p-3 text-slate-400 whitespace-nowrap text-xs md:text-sm">Details</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-800 hover:bg-slate-800/50 cursor-pointer" onClick={() => setSelectedInvestor(inv)}>
                    <td className="p-2 md:p-3 text-white font-medium text-xs md:text-sm whitespace-nowrap">{inv.investorName || 'N/A'}</td>
                    <td className="p-2 md:p-3 text-center">
                      <Badge className={`${getTypeColor(inv.investmentType)} text-xs`} variant="outline">
                        {inv.investmentType.substring(0, 3)}
                      </Badge>
                    </td>
                    <td className="p-2 md:p-3 text-center text-white font-semibold text-xs md:text-sm whitespace-nowrap">{formatAmount(Number(inv.investmentAmount))}</td>
                    <td className="p-2 md:p-3 text-center text-green-300 text-xs md:text-sm whitespace-nowrap">{formatAmount(Number(inv.totalPaidOut))}</td>
                    <td className="p-2 md:p-3 text-center text-yellow-300 text-xs md:text-sm whitespace-nowrap">{formatAmount(Number(inv.pendingPayment))}</td>
                    <td className="p-2 md:p-3 text-center text-blue-300 text-xs md:text-sm whitespace-nowrap">{formatAmount(Number(inv.expectedReturnAmount))}</td>
                    <td className="p-2 md:p-3 text-center text-slate-300 capitalize text-xs whitespace-nowrap">{(inv.paymentFrequency || '').substring(0, 4)}</td>
                    <td className="p-2 md:p-3 text-center">
                      <Badge className={`${getStatusColor(inv.paymentStatus)} text-xs`}>
                        {inv.paymentStatus}
                      </Badge>
                    </td>
                    <td className="p-2 md:p-3 text-center">
                      <Button size="sm" variant="ghost" className="text-orange-400 hover:bg-orange-500/10 p-1" onClick={(e) => { e.stopPropagation(); setSelectedInvestor(inv); }}>
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

      {/* Investor Details */}
      {selectedInvestor && (
        <Card className="bg-gradient-to-br from-slate-900/80 to-slate-900/40 border border-orange-500/20">
          <CardHeader>
            <CardTitle className="text-orange-400 text-sm md:text-base">Investment Details: {selectedInvestor.investorName}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm">Email</p>
                <p className="text-white font-mono">{selectedInvestor.investorEmail || 'N/A'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Investment Type</p>
                <Badge className={getTypeColor(selectedInvestor.investmentType)}>
                  {selectedInvestor.investmentType}
                </Badge>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Payment Method</p>
                <Badge className="bg-blue-500/20 text-blue-300 capitalize">{selectedInvestor.paymentMethod || 'N/A'}</Badge>
              </div>
              {Number(selectedInvestor.interestRate) > 0 && (
                <div>
                  <p className="text-slate-400 text-sm">Interest Rate</p>
                  <p className="text-white text-lg font-bold flex items-center gap-2">
                    <Percent className="h-5 w-5 text-orange-400" />
                    {Number(selectedInvestor.interestRate)}%
                  </p>
                </div>
              )}
              {selectedInvestor.notes && (
                <div>
                  <p className="text-slate-400 text-sm">Notes</p>
                  <p className="text-slate-300 text-sm">{selectedInvestor.notes}</p>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm">Expected Return</p>
                <p className="text-white text-lg font-bold flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  {Number(selectedInvestor.expectedReturn)}%
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Payment Frequency</p>
                <p className="text-white font-mono capitalize flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-orange-400" />
                  {selectedInvestor.paymentFrequency || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Investment Date</p>
                <p className="text-white font-mono">{new Date(selectedInvestor.investmentDate).toLocaleDateString()}</p>
              </div>
              <Button className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600">
                <Send className="h-4 w-4 mr-2" />
                Send Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
