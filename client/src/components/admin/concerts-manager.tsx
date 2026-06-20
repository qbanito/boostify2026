/**
 * Admin — Concert Command Center Manager
 * Commission slider (10–30%) + per-artist overrides + transaction history + event list.
 */
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import {
  Music2, DollarSign, Ticket, MessageSquare, RefreshCw, Save, Settings2,
  TrendingUp, Users, Calendar, AlertCircle,
} from 'lucide-react';

interface CommissionConfig {
  globalRate: number;
  minRate: number;
  maxRate: number;
  overrides: Record<string, number>;
}

interface OverrideArtist {
  artistId: number;
  name: string;
  rate: number;
}

interface Transaction {
  id: number;
  concertId: number;
  artistId: number;
  buyerEmail: string;
  buyerName: string;
  quantity: number;
  subtotal: string;
  commissionRate: number;
  platformFee: string;
  artistEarning: string;
  currency: string;
  status: string;
  createdAt: string;
  eventTitle: string;
  artistName: string;
}

interface ConcertEvent {
  id: number;
  artistId: number;
  title: string;
  type: string;
  status: string;
  startsAt: string | null;
  venue: string | null;
  location: string | null;
  createdAt: string;
  artistName: string;
}

interface Summary {
  completedOrders: number;
  grossRevenue: number;
  platformRevenue: number;
  artistPayouts: number;
  totalEvents: number;
}

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

const STATUS_COLOR: Record<string, string> = {
  published: 'bg-green-900/40 text-green-300 border-green-700',
  live: 'bg-blue-900/40 text-blue-300 border-blue-700',
  draft: 'bg-gray-700/40 text-gray-400 border-gray-600',
  ended: 'bg-purple-900/40 text-purple-300 border-purple-700',
  cancelled: 'bg-red-900/40 text-red-300 border-red-700',
  completed: 'bg-green-900/40 text-green-300 border-green-700',
  pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700',
};

export function ConcertsManager() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'commission' | 'events' | 'transactions'>('commission');
  const [globalRate, setGlobalRate] = useState<number>(20);
  const [overrideId, setOverrideId] = useState('');
  const [overrideRate, setOverrideRate] = useState('');
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const settingsQ = useQuery<{ config: CommissionConfig; overrideArtists: OverrideArtist[]; bounds: { min: number; max: number; default: number } }>({
    queryKey: ['admin-concerts-settings'],
    queryFn: () => apiFetch('/api/admin/concerts/settings'),
    onSuccess: (data) => {
      if (data?.config?.globalRate != null) setGlobalRate(data.config.globalRate);
    },
  } as any);

  const summaryQ = useQuery<{ summary: Summary }>({
    queryKey: ['admin-concerts-summary'],
    queryFn: () => apiFetch('/api/admin/concerts/summary'),
  });

  const eventsQ = useQuery<{ events: ConcertEvent[] }>({
    queryKey: ['admin-concerts-events'],
    queryFn: () => apiFetch('/api/admin/concerts/events'),
    enabled: tab === 'events',
  });

  const txQ = useQuery<{ transactions: Transaction[] }>({
    queryKey: ['admin-concerts-transactions'],
    queryFn: () => apiFetch('/api/admin/concerts/transactions'),
    enabled: tab === 'transactions',
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: { globalRate?: number; overrides?: Record<string, number> }) =>
      apiFetch('/api/admin/concerts/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }),
    onMutate: () => setSaveStatus('saving'),
    onSuccess: () => {
      setSaveStatus('saved');
      qc.invalidateQueries({ queryKey: ['admin-concerts-settings'] });
      setTimeout(() => setSaveStatus('idle'), 2000);
    },
    onError: () => setSaveStatus('error'),
  });

  const removeMutation = useMutation({
    mutationFn: async (artistId: number) => {
      const overrides: Record<string, null> = {};
      overrides[String(artistId)] = null;
      return apiFetch('/api/admin/concerts/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overrides }) });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-concerts-settings'] }),
  });

  const cfg = settingsQ.data?.config;
  const bounds = settingsQ.data?.bounds || { min: 10, max: 30, default: 20 };
  const overrideArtists = settingsQ.data?.overrideArtists || [];
  const summary = summaryQ.data?.summary;

  const handleAddOverride = () => {
    const id = parseInt(overrideId.trim(), 10);
    const rate = parseInt(overrideRate.trim(), 10);
    if (!id || isNaN(id) || !rate || isNaN(rate)) return;
    const overrides: Record<string, number> = {};
    overrides[String(id)] = rate;
    saveMutation.mutate({ overrides });
    setOverrideId('');
    setOverrideRate('');
  };

  return (
    <div className="space-y-6 p-2">
      {/* KPI summary */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Events', value: summary.totalEvents, icon: Calendar, color: '#a855f7' },
            { label: 'Completed Orders', value: summary.completedOrders, icon: Ticket, color: '#22c55e' },
            { label: 'Gross Revenue', value: `$${Number(summary.grossRevenue).toFixed(2)}`, icon: DollarSign, color: '#f59e0b' },
            { label: 'Platform Revenue', value: `$${Number(summary.platformRevenue).toFixed(2)}`, icon: TrendingUp, color: '#06b6d4' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-gray-900/60 border-gray-700">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-8 w-8 flex-shrink-0" style={{ color }} />
                <div>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-lg font-bold text-white">{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['commission', 'events', 'transactions'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-colors ${tab === t ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Commission tab */}
      {tab === 'commission' && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Settings2 className="h-5 w-5 text-purple-400" />
              Commission Settings
              <Badge className="ml-2 text-xs bg-purple-900/40 text-purple-300 border-purple-700 border">
                Boostify charges {bounds.min}–{bounds.max}%
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {settingsQ.isLoading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : (
              <>
                {/* Global rate slider */}
                <div className="space-y-3">
                  <label className="text-sm text-gray-300 font-medium">
                    Global Commission Rate: <span className="text-purple-300 font-bold">{globalRate}%</span>
                  </label>
                  <input
                    type="range"
                    min={bounds.min}
                    max={bounds.max}
                    step={1}
                    value={globalRate}
                    onChange={(e) => setGlobalRate(Number(e.target.value))}
                    className="w-full accent-purple-500"
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>{bounds.min}% (min)</span>
                    <span>{bounds.default}% (default)</span>
                    <span>{bounds.max}% (max)</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    At {globalRate}%: on a $100 ticket sale — Boostify earns <strong className="text-purple-300">${globalRate}</strong>, artist receives <strong className="text-green-300">${100 - globalRate}</strong>.
                  </p>
                  <Button
                    onClick={() => saveMutation.mutate({ globalRate })}
                    disabled={saveMutation.isPending}
                    className="bg-purple-600 hover:bg-purple-700 text-white"
                    size="sm"
                  >
                    {saveStatus === 'saving' ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                    {saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error — retry' : 'Save Global Rate'}
                  </Button>
                </div>

                {/* Per-artist overrides */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-300">Per-Artist Overrides</h3>
                  {overrideArtists.length > 0 && (
                    <div className="space-y-2">
                      {overrideArtists.map((a) => (
                        <div key={a.artistId} className="flex items-center justify-between p-2 rounded-lg bg-gray-800/60 border border-gray-700">
                          <span className="text-sm text-white">#{a.artistId} — {a.name}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-bold text-purple-300">{a.rate}%</span>
                            <button
                              onClick={() => removeMutation.mutate(a.artistId)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <Input
                      placeholder="Artist ID (e.g. 1417)"
                      value={overrideId}
                      onChange={(e) => setOverrideId(e.target.value)}
                      className="w-40 bg-gray-800 border-gray-600 text-white text-sm"
                    />
                    <Input
                      type="number"
                      placeholder={`Rate (${bounds.min}–${bounds.max})`}
                      value={overrideRate}
                      onChange={(e) => setOverrideRate(e.target.value)}
                      min={bounds.min}
                      max={bounds.max}
                      className="w-32 bg-gray-800 border-gray-600 text-white text-sm"
                    />
                    <Button onClick={handleAddOverride} size="sm" className="bg-gray-700 hover:bg-gray-600 text-white">
                      Add Override
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500">Leave blank to use global rate. Override is always clamped to {bounds.min}–{bounds.max}%.</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Events tab */}
      {tab === 'events' && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Calendar className="h-5 w-5 text-purple-400" />
              All Concert Events ({eventsQ.data?.events?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsQ.isLoading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400 text-left">
                      <th className="pb-2 pr-4">Event</th>
                      <th className="pb-2 pr-4">Artist</th>
                      <th className="pb-2 pr-4">Type</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2 pr-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(eventsQ.data?.events || []).map((ev) => (
                      <tr key={ev.id} className="hover:bg-gray-800/30">
                        <td className="py-2 pr-4 text-white font-medium">{ev.title}</td>
                        <td className="py-2 pr-4 text-gray-300">{ev.artistName || `#${ev.artistId}`}</td>
                        <td className="py-2 pr-4 text-gray-400 capitalize">{ev.type}</td>
                        <td className="py-2 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[ev.status] || ''}`}>
                            {ev.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 text-gray-400">
                          {ev.startsAt ? new Date(ev.startsAt).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    ))}
                    {!(eventsQ.data?.events?.length) && (
                      <tr><td colSpan={5} className="py-8 text-center text-gray-500">No events yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transactions tab */}
      {tab === 'transactions' && (
        <Card className="bg-gray-900/60 border-gray-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-purple-400" />
              Ticket Transactions ({txQ.data?.transactions?.length ?? 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {txQ.isLoading ? (
              <p className="text-gray-400 text-sm">Loading...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400 text-left">
                      <th className="pb-2 pr-3">Event</th>
                      <th className="pb-2 pr-3">Buyer</th>
                      <th className="pb-2 pr-3">Subtotal</th>
                      <th className="pb-2 pr-3">Rate</th>
                      <th className="pb-2 pr-3">Platform</th>
                      <th className="pb-2 pr-3">Artist</th>
                      <th className="pb-2 pr-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {(txQ.data?.transactions || []).map((tx) => (
                      <tr key={tx.id} className="hover:bg-gray-800/30">
                        <td className="py-2 pr-3 text-white">{tx.eventTitle || `#${tx.concertId}`}</td>
                        <td className="py-2 pr-3 text-gray-300">{tx.buyerEmail}</td>
                        <td className="py-2 pr-3 text-gray-300">${Number(tx.subtotal).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-purple-300 font-bold">{tx.commissionRate}%</td>
                        <td className="py-2 pr-3 text-cyan-300">${Number(tx.platformFee).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-green-300">${Number(tx.artistEarning).toFixed(2)}</td>
                        <td className="py-2 pr-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs border ${STATUS_COLOR[tx.status] || ''}`}>
                            {tx.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!(txQ.data?.transactions?.length) && (
                      <tr><td colSpan={7} className="py-8 text-center text-gray-500">No transactions yet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
