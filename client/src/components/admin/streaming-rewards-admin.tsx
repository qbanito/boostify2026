/**
 * StreamingRewardsAdmin
 * =====================
 * Admin panel for the BTF streaming rewards system:
 *  - Economics config (rate, pool cap, thresholds, dry-run, kill switch)
 *  - Action reward rules (publish song, merch sale, credit purchase, followers)
 *  - Epochs: calculate → review entries → approve (makes them claimable)
 *  - Treasury BTF balance
 *
 * API: /api/streaming-rewards/admin/*
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Coins, Loader2, Play, CheckCircle2, RefreshCw, Wallet, ShieldAlert } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

interface EpochRow {
  id: number; periodKey: string; status: string; totalValidStreams: number;
  totalBtf: number; prorateFactor: number; artistCount: number;
  calculatedAt: string | null; approvedAt: string | null; approvedBy: string | null;
}

const fmt = (n: number) => Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });

export function StreamingRewardsAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEpoch, setSelectedEpoch] = useState<number | null>(null);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});

  const overviewQuery = useQuery({
    queryKey: ['streaming-rewards-admin'],
    queryFn: async () => (await apiRequest('/api/streaming-rewards/admin/overview', { method: 'GET' })) || null,
    staleTime: 30 * 1000,
  });

  const entriesQuery = useQuery({
    queryKey: ['streaming-rewards-entries', selectedEpoch],
    queryFn: async () => {
      if (!selectedEpoch) return null;
      return (await apiRequest(`/api/streaming-rewards/admin/epochs/${selectedEpoch}/entries`, { method: 'GET' })) || null;
    },
    enabled: !!selectedEpoch,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['streaming-rewards-admin'] });
    queryClient.invalidateQueries({ queryKey: ['streaming-rewards-entries'] });
  };

  const configMutation = useMutation({
    mutationFn: async (patch: Record<string, any>) =>
      apiRequest('/api/streaming-rewards/admin/config', { method: 'PATCH', data: patch }),
    onSuccess: () => { toast({ title: 'Config updated' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Config update failed', description: e?.message, variant: 'destructive' }),
  });

  const ruleMutation = useMutation({
    mutationFn: async ({ key, patch }: { key: string; patch: Record<string, any> }) =>
      apiRequest(`/api/streaming-rewards/admin/rules/${key}`, { method: 'PATCH', data: patch }),
    onSuccess: () => { toast({ title: 'Rule updated' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Rule update failed', description: e?.message, variant: 'destructive' }),
  });

  const calculateMutation = useMutation({
    mutationFn: async () => apiRequest('/api/streaming-rewards/admin/epochs/calculate', { method: 'POST', data: {} }),
    onSuccess: (res: any) => {
      toast({ title: 'Epoch calculated', description: `${res.artistCount} artists · ${fmt(res.totalBtf)} BTF (${res.periodKey})` });
      invalidate();
    },
    onError: (e: any) => toast({ title: 'Calculation failed', description: e?.message, variant: 'destructive' }),
  });

  const approveMutation = useMutation({
    mutationFn: async (epochId: number) =>
      apiRequest(`/api/streaming-rewards/admin/epochs/${epochId}/approve`, { method: 'POST', data: {} }),
    onSuccess: () => { toast({ title: 'Epoch approved — rewards are now claimable' }); invalidate(); },
    onError: (e: any) => toast({ title: 'Approval failed', description: e?.message, variant: 'destructive' }),
  });

  const data = overviewQuery.data;
  if (overviewQuery.isLoading) {
    return <div className="flex items-center gap-2 text-gray-400 p-8"><Loader2 className="h-5 w-5 animate-spin" /> Loading rewards…</div>;
  }
  if (!data?.success) {
    return <div className="text-gray-400 p-8">Could not load streaming rewards overview.</div>;
  }

  const { config, rules, epochs, treasuryBtf, btfPriceUsd } = data;

  const numField = (key: string, label: string, value: number, step = '0.1') => (
    <div key={key}>
      <label className="text-[11px] uppercase tracking-wide text-gray-400">{label}</label>
      <div className="flex gap-1.5 mt-1">
        <Input
          type="number"
          step={step}
          className="h-8 text-sm bg-black/30"
          value={configDraft[key] ?? String(value)}
          onChange={(e) => setConfigDraft((d) => ({ ...d, [key]: e.target.value }))}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 px-2"
          disabled={configDraft[key] === undefined || configMutation.isPending}
          onClick={() => configMutation.mutate({ [key]: Number(configDraft[key]) })}
        >
          Set
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header + treasury */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Coins className="h-6 w-6 text-orange-400" />
          <div>
            <h2 className="text-lg font-bold text-white">Streaming Rewards (BTF)</h2>
            <p className="text-xs text-gray-400">Weekly BTF rewards for artist streams + platform actions</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-gray-400 flex items-center gap-1 justify-end"><Wallet className="h-3 w-3" /> Treasury</p>
            <p className="text-sm font-bold text-white">
              {treasuryBtf == null ? '— (wallet not configured)' : `${fmt(treasuryBtf)} BTF`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={() => invalidate()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Kill switches */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { key: 'active', label: 'System active', value: config.active, hint: 'Master switch — disables calc & claims' },
          { key: 'dryRun', label: 'Dry-run (no on-chain transfers)', value: config.dryRun, hint: 'Claims are simulated only' },
          { key: 'autoCalculate', label: 'Auto-calculate weekly', value: config.autoCalculate, hint: 'Hourly check for the last complete week' },
        ].map((s) => (
          <div key={s.key} className="rounded-xl p-3 bg-white/[0.03] border border-white/10 flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white">{s.label}</p>
              <p className="text-[11px] text-gray-500">{s.hint}</p>
            </div>
            <Switch checked={!!s.value} onCheckedChange={(v) => configMutation.mutate({ [s.key]: v })} />
          </div>
        ))}
      </div>

      {config.dryRun && (
        <div className="flex items-center gap-2 text-amber-400 text-xs rounded-lg px-3 py-2 bg-amber-500/10 border border-amber-500/30">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          Dry-run is ON: artists see rewards but claims are simulated. Turn it off to enable real BTF transfers.
        </div>
      )}

      {/* Economics */}
      <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
        <h3 className="text-sm font-bold text-white mb-3">Economics · 1 BTF ≈ ${btfPriceUsd}</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {numField('btfPerStream', 'BTF / stream', config.btfPerStream)}
          {numField('bonusPerListener', 'BTF / listener', config.bonusPerListener)}
          {numField('poolBtfPerEpoch', 'Pool / week', config.poolBtfPerEpoch, '1000')}
          {numField('minStreams', 'Min streams', config.minStreams, '1')}
          {numField('minClaimBtf', 'Min claim BTF', config.minClaimBtf, '10')}
          {numField('maxStreamsPerListenerDay', 'Cap /listener/day', config.maxStreamsPerListenerDay, '1')}
        </div>
      </div>

      {/* Action rules */}
      <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
        <h3 className="text-sm font-bold text-white mb-3">Action rewards</h3>
        <div className="space-y-2">
          {(rules || []).map((r: any) => (
            <div key={r.actionKey} className="flex flex-wrap items-center gap-3 text-sm rounded-lg px-3 py-2 bg-black/20 border border-white/10">
              <Switch checked={!!r.active} onCheckedChange={(v) => ruleMutation.mutate({ key: r.actionKey, patch: { active: v } })} />
              <span className="flex-1 min-w-[160px] text-gray-200">{r.label}</span>
              <span className="text-[11px] text-gray-500 font-mono">{r.actionKey}</span>
              <label className="text-[11px] text-gray-400">BTF</label>
              <Input
                type="number"
                className="h-7 w-24 text-xs bg-black/30"
                defaultValue={r.btfAmount}
                onBlur={(e) => Number(e.target.value) !== r.btfAmount && ruleMutation.mutate({ key: r.actionKey, patch: { btfAmount: Number(e.target.value) } })}
              />
              <label className="text-[11px] text-gray-400">max/week</label>
              <Input
                type="number"
                className="h-7 w-16 text-xs bg-black/30"
                defaultValue={r.maxPerEpoch}
                onBlur={(e) => Number(e.target.value) !== r.maxPerEpoch && ruleMutation.mutate({ key: r.actionKey, patch: { maxPerEpoch: Number(e.target.value) } })}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Epochs */}
      <div className="rounded-xl p-4 bg-white/[0.03] border border-white/10">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-sm font-bold text-white">Epochs</h3>
          <Button size="sm" onClick={() => calculateMutation.mutate()} disabled={calculateMutation.isPending} className="gap-1.5">
            {calculateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Calculate last week
          </Button>
        </div>
        {(epochs || []).length === 0 ? (
          <p className="text-xs text-gray-500">No epochs yet — run a calculation.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 border-b border-white/10">
                  <th className="py-2 pr-3">Week</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Artists</th>
                  <th className="py-2 pr-3">Valid streams</th>
                  <th className="py-2 pr-3">Total BTF</th>
                  <th className="py-2 pr-3">Pro-rate</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {(epochs as EpochRow[]).map((e) => (
                  <tr key={e.id} className="border-b border-white/5 text-gray-300">
                    <td className="py-2 pr-3 font-mono">{e.periodKey}</td>
                    <td className="py-2 pr-3">
                      <span className={
                        e.status === 'paid' ? 'text-emerald-400' :
                        e.status === 'approved' ? 'text-amber-400' : 'text-gray-400'
                      }>{e.status}</span>
                    </td>
                    <td className="py-2 pr-3">{e.artistCount}</td>
                    <td className="py-2 pr-3">{fmt(e.totalValidStreams)}</td>
                    <td className="py-2 pr-3 font-bold text-white">{fmt(e.totalBtf)}</td>
                    <td className="py-2 pr-3">{Number(e.prorateFactor) < 1 ? `×${Number(e.prorateFactor).toFixed(3)}` : '—'}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setSelectedEpoch(selectedEpoch === e.id ? null : e.id)}>
                        {selectedEpoch === e.id ? 'Hide' : 'Entries'}
                      </Button>
                      {e.status === 'calculated' && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1 ml-1" disabled={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(e.id)}>
                          <CheckCircle2 className="h-3 w-3" /> Approve
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Entries drill-down */}
        {selectedEpoch && entriesQuery.data?.entries && (
          <div className="mt-4 rounded-lg bg-black/20 border border-white/10 p-3">
            <h4 className="text-xs font-bold text-white mb-2">Entries — epoch #{selectedEpoch}</h4>
            {entriesQuery.data.entries.length === 0 ? (
              <p className="text-xs text-gray-500">No qualifying artists in this epoch.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-white/10">
                      <th className="py-1.5 pr-3">Artist</th>
                      <th className="py-1.5 pr-3">Streams</th>
                      <th className="py-1.5 pr-3">Listeners</th>
                      <th className="py-1.5 pr-3">Base</th>
                      <th className="py-1.5 pr-3">Bonus</th>
                      <th className="py-1.5 pr-3">Actions</th>
                      <th className="py-1.5 pr-3">Total BTF</th>
                      <th className="py-1.5 pr-3">Status</th>
                      <th className="py-1.5">Tx</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entriesQuery.data.entries.map((en: any) => (
                      <tr key={en.id} className="border-b border-white/5 text-gray-300">
                        <td className="py-1.5 pr-3">{en.artistName || `#${en.artistId}`}</td>
                        <td className="py-1.5 pr-3">{fmt(en.validStreams)}</td>
                        <td className="py-1.5 pr-3">{en.uniqueListeners}</td>
                        <td className="py-1.5 pr-3">{fmt(en.baseBtf)}</td>
                        <td className="py-1.5 pr-3">{fmt(en.bonusBtf)}</td>
                        <td className="py-1.5 pr-3">{fmt(en.actionBtf)}</td>
                        <td className="py-1.5 pr-3 font-bold text-white">{fmt(en.totalBtf)}</td>
                        <td className="py-1.5 pr-3">{en.status}</td>
                        <td className="py-1.5">
                          {en.txHash ? (
                            <a href={`https://polygonscan.com/tx/${en.txHash}`} target="_blank" rel="noopener noreferrer" className="text-emerald-400 underline">view</a>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
