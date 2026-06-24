/**
 * PAYOUTS PANEL — Unified artist earnings + withdrawals
 * Reads /api/artist-wallet/overview and /payouts.
 * Lets the artist configure a payout method and request a withdrawal of their
 * available wallet balance (music unlocks/memberships, merch, shows, etc.).
 */
import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Wallet, Banknote, Clock, CheckCircle2, AlertCircle, Loader2, PiggyBank,
} from 'lucide-react';

interface PayoutsPanelProps {
  /** Optional brand colors for accenting. */
  accent?: string;
}

interface OverviewKpis {
  availableBalance: number;
  pendingPayouts: number;
  totalEarnings: number;
  totalPaidOut: number;
  salesCount: number;
  windowEarnings: number;
  windowDays: number;
  currency: string;
}
interface SourceRow { source: string; label: string; amount: number; count: number; }
interface SaleRow { id: number; productName: string; amount: number; earning: number; quantity: number; status: string; buyerEmail?: string | null; createdAt: string; }
interface PayoutRow { id: number; amount: number; currency: string; method?: string | null; status: string; reference?: string | null; requestedAt: string; paidAt?: string | null; }
interface OverviewResponse {
  success: boolean;
  overview: {
    kpis: OverviewKpis;
    payoutMethod: string | null;
    payoutAccount: string | null;
    minPayout: number;
    bySource: SourceRow[];
    dailyEarnings: { date: string; earnings: number; sales: number }[];
    recentSales: SaleRow[];
    payouts: PayoutRow[];
  };
}

const fmt = (n: number) => `$${(n ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_STYLE: Record<string, string> = {
  requested: 'text-amber-400 bg-amber-500/10',
  approved: 'text-sky-400 bg-sky-500/10',
  paid: 'text-emerald-400 bg-emerald-500/10',
  rejected: 'text-rose-400 bg-rose-500/10',
};

export function PayoutsPanel({ accent = '#22c55e' }: PayoutsPanelProps) {
  const qc = useQueryClient();
  const [method, setMethod] = useState('paypal');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState('');
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading } = useQuery<OverviewResponse>({
    queryKey: ['/api/artist-wallet/overview'],
    queryFn: async () => {
      const res = await fetch('/api/artist-wallet/overview?days=30', { credentials: 'include' });
      if (!res.ok) throw new Error('overview failed');
      return res.json();
    },
    staleTime: 30_000,
  });

  const ov = data?.overview;
  const k = ov?.kpis;

  // Seed the form from the saved method once loaded.
  useMemo(() => {
    if (ov?.payoutMethod) setMethod(ov.payoutMethod);
    if (ov?.payoutAccount) setAccount(ov.payoutAccount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ov?.payoutMethod, ov?.payoutAccount]);

  const saveMethod = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/artist-wallet/payout-method', {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ method, account }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo guardar');
      return json;
    },
    onSuccess: () => { setMsg({ kind: 'ok', text: 'Método de pago guardado' }); qc.invalidateQueries({ queryKey: ['/api/artist-wallet/overview'] }); },
    onError: (e: any) => setMsg({ kind: 'err', text: e.message }),
  });

  const requestPayout = useMutation({
    mutationFn: async () => {
      const body: any = {};
      if (amount.trim()) body.amount = Number(amount);
      const res = await fetch('/api/artist-wallet/payouts/request', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'No se pudo solicitar el retiro');
      return json;
    },
    onSuccess: () => { setMsg({ kind: 'ok', text: 'Retiro solicitado. Te pagaremos a tu cuenta.' }); setAmount(''); qc.invalidateQueries({ queryKey: ['/api/artist-wallet/overview'] }); },
    onError: (e: any) => setMsg({ kind: 'err', text: e.message }),
  });

  if (isLoading) {
    return <div className="py-10 flex items-center justify-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Cargando estadísticas…</div>;
  }
  if (!ov || !k) {
    return <p className="text-center text-xs text-gray-600 py-6">Aún no hay datos de ventas.</p>;
  }

  const kpiCards = [
    { label: 'Disponible para retirar', value: fmt(k.availableBalance), icon: Wallet, color: accent },
    { label: 'Ganado (histórico)', value: fmt(k.totalEarnings), icon: PiggyBank, color: '#a78bfa' },
    { label: 'Pendiente de pago', value: fmt(k.pendingPayouts), icon: Clock, color: '#f59e0b' },
    { label: 'Ya retirado', value: fmt(k.totalPaidOut), icon: CheckCircle2, color: '#34d399' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpiCards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 backdrop-blur"
          >
            <c.icon className="w-4 h-4 mb-2" style={{ color: c.color }} />
            <div className="text-lg font-bold text-white">{c.value}</div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-0.5">{c.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Breakdown by source */}
      {ov.bySource.length > 0 && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">Ingresos por fuente</div>
          <div className="space-y-2">
            {ov.bySource.map((s) => {
              const total = ov.bySource.reduce((a, b) => a + b.amount, 0) || 1;
              const pct = Math.round((s.amount / total) * 100);
              return (
                <div key={s.source}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-300">{s.label} <span className="text-gray-600">· {s.count}</span></span>
                    <span className="text-white font-medium">{fmt(s.amount)}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payout method + request */}
      <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10 space-y-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400">
          <Banknote className="w-4 h-4" /> Cobrar a tu cuenta
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <select
            value={method} onChange={(e) => setMethod(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
          >
            <option value="paypal">PayPal</option>
            <option value="bank">Transferencia bancaria</option>
            <option value="wise">Wise</option>
            <option value="stripe">Stripe</option>
          </select>
          <input
            value={account} onChange={(e) => setAccount(e.target.value)}
            placeholder="Email / IBAN / cuenta"
            className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600"
          />
        </div>
        <button
          onClick={() => { setMsg(null); saveMethod.mutate(); }}
          disabled={saveMethod.isPending || !account.trim()}
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white disabled:opacity-40"
        >
          {saveMethod.isPending ? 'Guardando…' : 'Guardar método'}
        </button>

        <div className="border-t border-white/10 pt-3 flex flex-wrap items-end gap-2">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] uppercase tracking-wide text-gray-500">Monto (mín ${ov.minPayout})</label>
            <input
              value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder={`${k.availableBalance.toFixed(2)} (todo)`} inputMode="decimal"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 mt-1"
            />
          </div>
          <button
            onClick={() => { setMsg(null); requestPayout.mutate(); }}
            disabled={requestPayout.isPending || k.availableBalance < ov.minPayout}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-black disabled:opacity-40"
            style={{ background: accent }}
          >
            {requestPayout.isPending ? 'Solicitando…' : 'Solicitar retiro'}
          </button>
        </div>
        {k.availableBalance < ov.minPayout && (
          <p className="text-[11px] text-gray-500">Necesitas al menos {fmt(ov.minPayout)} disponibles para retirar.</p>
        )}
        {msg && (
          <div className={`flex items-center gap-1.5 text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {msg.kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
            {msg.text}
          </div>
        )}
      </div>

      {/* Payout history */}
      {ov.payouts.length > 0 && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">Historial de retiros</div>
          <div className="space-y-1.5">
            {ov.payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400">{new Date(p.requestedAt).toLocaleDateString()} · {p.method || '—'}</span>
                <span className="text-white font-medium">{fmt(p.amount)}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_STYLE[p.status] || 'text-gray-400 bg-white/5'}`}>{p.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent sales */}
      {ov.recentSales.length > 0 && (
        <div className="rounded-2xl p-4 bg-white/[0.03] border border-white/10">
          <div className="text-xs uppercase tracking-wide text-gray-400 mb-3">Ventas recientes</div>
          <div className="space-y-1.5">
            {ov.recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-300 truncate max-w-[55%]">{s.productName}{s.quantity > 1 ? ` ×${s.quantity}` : ''}</span>
                <span className="text-gray-500">{fmt(s.amount)}</span>
                <span className="text-emerald-400 font-medium">+{fmt(s.earning)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default PayoutsPanel;
