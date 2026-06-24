/**
 * Credit Pricing & Treasury Admin
 * ===============================
 * Admin control panel for the credit system:
 *  - Global markup multiplier (e.g. 5x / 4x) — raise/lower all prices at once
 *  - Per-operation markup overrides
 *  - 30-day cost vs revenue vs profit analytics
 *  - Provider treasury: reserve pool, provider balances, top-ups & low-balance alerts
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../lib/queryClient';
import { useToast } from '../../hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  DollarSign, Zap, TrendingUp, Save, RefreshCw, Loader2, Banknote,
  AlertTriangle, ShieldCheck, Percent, Plus,
} from 'lucide-react';

interface PricingRow {
  type: string;
  name: string;
  category: string;
  provider: string;
  internalCostUsd: number;
  markupMultiplier: number;
  creditCost: number;
  userPriceUsd: string;
  hasOverride: boolean;
}

interface PricingResponse {
  globalMarkup: number;
  defaultMarkup: number;
  totalOperations: number;
  pricingTable: PricingRow[];
  creditPackages: any[];
}

interface TreasuryProvider {
  provider: string;
  reservedUsd: number;
  spentUsd: number;
  externalBalanceUsd: number;
  lowBalanceThresholdUsd: number;
  autoRechargeEnabled: boolean;
  autoRechargeAmountUsd: number;
  status: string;
}

interface TreasuryResponse {
  pool: { reservedUsd: number; spentUsd: number };
  providers: TreasuryProvider[];
  recentTransactions: Array<{ provider: string; type: string; amountUsd: number; source: string | null; description: string | null; createdAt: string }>;
  last30Days: { reservedUsd: number; spentUsd: number };
}

const money = (n: number) => `$${(Number(n) || 0).toFixed(2)}`;

export function CreditPricingAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [markupInput, setMarkupInput] = useState<string>('');
  const [opEdits, setOpEdits] = useState<Record<string, string>>({});
  const [topupProvider, setTopupProvider] = useState('');
  const [topupAmount, setTopupAmount] = useState('');

  const pricingQuery = useQuery<PricingResponse>({
    queryKey: ['admin-pricing'],
    queryFn: async () => apiRequest('/api/admin/pricing', { method: 'GET' }),
  });

  const analyticsQuery = useQuery({
    queryKey: ['admin-pricing-analytics'],
    queryFn: async () => apiRequest('/api/admin/pricing/analytics', { method: 'GET' }),
  });

  const treasuryQuery = useQuery<TreasuryResponse>({
    queryKey: ['admin-treasury'],
    queryFn: async () => apiRequest('/api/admin/treasury', { method: 'GET' }),
  });

  const globalMarkup = pricingQuery.data?.globalMarkup ?? 5;

  const setGlobalMarkup = useMutation({
    mutationFn: async (multiplier: number) =>
      apiRequest('/api/admin/pricing/global-markup', { method: 'POST', data: { multiplier } }),
    onSuccess: (_d, m) => {
      toast({ title: 'Global markup updated', description: `All prices now at ${m}x cost.` });
      setMarkupInput('');
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
    },
    onError: (e: any) => toast({ title: 'Update failed', description: e?.message, variant: 'destructive' }),
  });

  const setOpMarkup = useMutation({
    mutationFn: async ({ operationType, markupMultiplier }: { operationType: string; markupMultiplier: number }) =>
      apiRequest('/api/admin/pricing/operation', { method: 'POST', data: { operationType, markupMultiplier } }),
    onSuccess: (_d, v) => {
      toast({ title: 'Operation price updated', description: `${v.operationType} → ${v.markupMultiplier}x` });
      setOpEdits((p) => { const n = { ...p }; delete n[v.operationType]; return n; });
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
    },
    onError: (e: any) => toast({ title: 'Update failed', description: e?.message, variant: 'destructive' }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => apiRequest('/api/admin/pricing/seed', { method: 'POST', data: {} }),
    onSuccess: (d: any) => {
      toast({ title: 'Pricing seeded', description: `${d?.seeded ?? 'All'} operations written to DB.` });
      queryClient.invalidateQueries({ queryKey: ['admin-pricing'] });
    },
    onError: (e: any) => toast({ title: 'Seed failed', description: e?.message, variant: 'destructive' }),
  });

  const topupMutation = useMutation({
    mutationFn: async () =>
      apiRequest('/api/admin/treasury/topup', { method: 'POST', data: { provider: topupProvider, amountUsd: parseFloat(topupAmount) } }),
    onSuccess: () => {
      toast({ title: 'Top-up recorded', description: `${topupProvider} balance updated.` });
      setTopupProvider(''); setTopupAmount('');
      queryClient.invalidateQueries({ queryKey: ['admin-treasury'] });
    },
    onError: (e: any) => toast({ title: 'Top-up failed', description: e?.message, variant: 'destructive' }),
  });

  const configureMutation = useMutation({
    mutationFn: async (v: { provider: string; lowBalanceThresholdUsd?: number; autoRechargeEnabled?: boolean }) =>
      apiRequest('/api/admin/treasury/configure', { method: 'POST', data: v }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-treasury'] }),
    onError: (e: any) => toast({ title: 'Update failed', description: e?.message, variant: 'destructive' }),
  });

  const rows = pricingQuery.data?.pricingTable || [];
  const grouped = useMemo(() => {
    const m = new Map<string, PricingRow[]>();
    for (const r of rows) {
      if (!m.has(r.category)) m.set(r.category, []);
      m.get(r.category)!.push(r);
    }
    return Array.from(m.entries());
  }, [rows]);

  const analytics = analyticsQuery.data;
  const treasury = treasuryQuery.data;

  return (
    <div className="space-y-6">
      {/* Header + global markup */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-950/20 to-black/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <DollarSign className="h-5 w-5 text-amber-400" /> Credit Pricing & Markup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div>
              <label className="text-xs text-gray-400">Global markup multiplier (1–20x)</label>
              <div className="flex items-center gap-2 mt-1">
                <div className="px-3 py-2 rounded-lg bg-black/40 border border-amber-500/30 text-amber-300 font-bold text-lg min-w-[64px] text-center">
                  {globalMarkup}x
                </div>
                <Input
                  type="number" min={1} max={20} step={0.5}
                  placeholder="e.g. 5"
                  value={markupInput}
                  onChange={(e) => setMarkupInput(e.target.value)}
                  className="w-28 bg-black/40 border-white/15 text-white"
                />
                <Button
                  onClick={() => {
                    const v = parseFloat(markupInput);
                    if (!Number.isFinite(v) || v < 1 || v > 20) {
                      toast({ title: 'Invalid value', description: 'Enter a number between 1 and 20.', variant: 'destructive' });
                      return;
                    }
                    setGlobalMarkup.mutate(v);
                  }}
                  disabled={setGlobalMarkup.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white gap-2"
                >
                  {setGlobalMarkup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Apply
                </Button>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                Users pay {globalMarkup}× the real provider cost. Raise to increase margin, lower to be more competitive.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} className="gap-2 border-white/15 text-white">
                {seedMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Seed DB
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 30-day analytics */}
      {analytics && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatTile icon={<Banknote className="h-4 w-4" />} label="API cost (30d)" value={money(analytics?.profitMargin?.internalCostUsd || analytics?.apiCosts?.totalUsd || 0)} tone="neutral" />
          <StatTile icon={<TrendingUp className="h-4 w-4" />} label="Credit revenue (30d)" value={money(analytics?.profitMargin?.revenueUsd || 0)} tone="good" />
          <StatTile icon={<DollarSign className="h-4 w-4" />} label="Profit (30d)" value={money(analytics?.profitMargin?.profitUsd || 0)} tone="good" />
          <StatTile icon={<Percent className="h-4 w-4" />} label="Effective markup" value={String(analytics?.profitMargin?.markupEffective || '—')} tone="neutral" />
        </div>
      )}

      {/* Provider Treasury */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-black/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <ShieldCheck className="h-5 w-5 text-emerald-400" /> Provider Treasury
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile icon={<Banknote className="h-4 w-4" />} label="Reserve pool" value={money(treasury?.pool?.reservedUsd || 0)} tone="good" />
            <StatTile icon={<Zap className="h-4 w-4" />} label="Pool spent" value={money(treasury?.pool?.spentUsd || 0)} tone="neutral" />
            <StatTile icon={<Plus className="h-4 w-4" />} label="Reserved (30d)" value={money(treasury?.last30Days?.reservedUsd || 0)} tone="good" />
            <StatTile icon={<TrendingUp className="h-4 w-4" />} label="Spent (30d)" value={money(treasury?.last30Days?.spentUsd || 0)} tone="neutral" />
          </div>

          {/* Manual top-up */}
          <div className="flex flex-col sm:flex-row sm:items-end gap-2 p-3 rounded-lg bg-black/30 border border-white/10">
            <div className="flex-1">
              <label className="text-xs text-gray-400">Record provider top-up</label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="provider (e.g. fal)" value={topupProvider} onChange={(e) => setTopupProvider(e.target.value)} className="bg-black/40 border-white/15 text-white" />
                <Input type="number" placeholder="USD" value={topupAmount} onChange={(e) => setTopupAmount(e.target.value)} className="w-28 bg-black/40 border-white/15 text-white" />
                <Button
                  onClick={() => topupMutation.mutate()}
                  disabled={topupMutation.isPending || !topupProvider || !(parseFloat(topupAmount) > 0)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
                >
                  {topupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Record
                </Button>
              </div>
            </div>
          </div>

          {/* Provider accounts */}
          <div className="space-y-2">
            {(treasury?.providers || []).length === 0 && (
              <p className="text-sm text-gray-500">No provider activity yet. Accounts appear as AI operations run.</p>
            )}
            {(treasury?.providers || []).map((p) => (
              <div key={p.provider} className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg bg-black/30 border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white capitalize">{p.provider}</span>
                  <Badge
                    className={
                      p.status === 'critical' ? 'bg-red-500/20 text-red-300 border-red-500/30'
                      : p.status === 'low' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }
                  >
                    {p.status !== 'healthy' && <AlertTriangle className="h-3 w-3 mr-1" />}
                    {p.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-300">
                  <span>Balance: <strong className="text-white">{money(p.externalBalanceUsd)}</strong></span>
                  <span>Spent: {money(p.spentUsd)}</span>
                  <span>Alert &lt; {money(p.lowBalanceThresholdUsd)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-operation pricing */}
      <Card className="border-white/10 bg-black/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="h-5 w-5 text-amber-400" /> Per-operation pricing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {pricingQuery.isLoading && <Loader2 className="h-5 w-5 animate-spin text-gray-400" />}
          {grouped.map(([category, items]) => (
            <div key={category}>
              <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-2">{category.replace(/_/g, ' ')}</h4>
              <div className="space-y-1.5">
                {items.map((r) => (
                  <div key={r.type} className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
                    <div className="min-w-0">
                      <p className="text-sm text-white truncate">{r.name}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.provider} · cost {money(r.internalCostUsd)} → <strong className="text-amber-300">{r.creditCost} credits</strong> (${r.userPriceUsd})
                        {r.hasOverride && <Badge className="ml-2 bg-amber-500/15 text-amber-300 border-amber-500/30">override</Badge>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400">{r.markupMultiplier}x</span>
                      <Input
                        type="number" min={1} max={20} step={0.5}
                        placeholder={String(r.markupMultiplier)}
                        value={opEdits[r.type] ?? ''}
                        onChange={(e) => setOpEdits((p) => ({ ...p, [r.type]: e.target.value }))}
                        className="w-20 h-8 bg-black/40 border-white/15 text-white text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-white/15 text-white"
                        disabled={setOpMarkup.isPending}
                        onClick={() => {
                          const v = parseFloat(opEdits[r.type]);
                          if (!Number.isFinite(v) || v < 1 || v > 20) {
                            toast({ title: 'Invalid value', description: '1–20 only.', variant: 'destructive' });
                            return;
                          }
                          setOpMarkup.mutate({ operationType: r.type, markupMultiplier: v });
                        }}
                      >
                        <Save className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatTile({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: 'good' | 'neutral' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-400' : tone === 'bad' ? 'text-red-400' : 'text-white';
  return (
    <div className="rounded-xl p-3 bg-black/30 border border-white/10">
      <div className="flex items-center gap-1.5 text-gray-400 text-[11px]">{icon}<span>{label}</span></div>
      <div className={`mt-1 text-lg font-extrabold ${color}`}>{value}</div>
    </div>
  );
}

export default CreditPricingAdmin;
