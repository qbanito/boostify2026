/**
 * /artist-growth-engine
 * Dashboard interno (gated 'pro') que muestra el estado de cada Artist Growth Unit:
 * confirmedSales / 2, ROAS, leads/wizards/checkouts, aprobaciones de expansión y ledger.
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Loader2, TrendingUp, Wallet, Users, Sparkles, ShieldCheck, ArrowUpRight, RefreshCw } from "lucide-react";

interface UnitRow {
  id: number;
  slug: string;
  artistName: string;
  status: string;
  confirmedSales: number;
  grossRevenueCents: number;
  adSpendCents: number;
  roas: number;
  leads: number;
  wizards: number;
  checkouts: number;
  refunds: number;
  isReady: boolean;
}

interface DashboardResponse {
  success: boolean;
  totals: {
    confirmedSales: number;
    grossRevenueCents: number;
    adSpendCents: number;
    netCents: number;
    roas: number;
    units: number;
  };
  units: UnitRow[];
  approvals: any[];
  ledger: any[];
  rules: { requiredSales: number; requiredRevenueCents: number; reserveCents: number; priceUsdCents: number };
}

const fmtCents = (c: number) => `$${(c / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  active: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  validated: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  expansion_locked: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  expanded: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  paused: "bg-rose-500/15 text-rose-300 border-rose-500/30",
};

export default function ArtistGrowthEngineDashboardPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, refetch, isFetching } = useQuery<DashboardResponse>({
    queryKey: ["age-dashboard", refreshKey],
    queryFn: async () => {
      const res = await apiRequest("/api/age/dashboard");
      return res as DashboardResponse;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <Loader2 className="h-8 w-8 animate-spin text-orange-300" />
      </div>
    );
  }

  if (!data?.success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-400">
        No se pudo cargar el dashboard.
      </div>
    );
  }

  const { totals, units, approvals, ledger, rules } = data;

  return (
    <div className="min-h-screen bg-gradient-to-b from-black via-zinc-950 to-zinc-900 text-white">
      <header className="border-b border-white/5 bg-black/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-300">Boostify</p>
            <h1 className="text-xl font-black text-white">Artist Growth Engine</h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshKey((k) => k + 1);
              refetch();
            }}
            disabled={isFetching}
            className="border-white/10 bg-white/5 text-white hover:bg-white/10"
          >
            {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refrescar
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-10 px-6 py-10">
        {/* Totals strip */}
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Stat label="Ventas confirmadas" value={String(totals.confirmedSales)} icon={Sparkles} />
          <Stat label="Ingresos brutos" value={fmtCents(totals.grossRevenueCents)} icon={TrendingUp} />
          <Stat label="Gasto en ads" value={fmtCents(totals.adSpendCents)} icon={Wallet} />
          <Stat label="Net" value={fmtCents(totals.netCents)} icon={ShieldCheck} accent />
          <Stat label="ROAS global" value={`${totals.roas.toFixed(2)}x`} icon={ArrowUpRight} />
        </section>

        {/* Rules banner */}
        <section className="rounded-2xl border border-orange-500/20 bg-orange-500/[0.06] p-5">
          <p className="text-xs font-black uppercase tracking-widest text-orange-300">Regla inviolable</p>
          <p className="mt-1 text-sm font-bold text-white">
            {rules.requiredSales} ventas confirmadas (= {fmtCents(rules.requiredRevenueCents)}) liberan {fmtCents(rules.reserveCents)} para crear un nuevo artista.
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Ningún artista se expande sin ventas verificadas. Reembolsos revierten aprobaciones automáticamente.
          </p>
        </section>

        {/* Units table */}
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="text-lg font-black text-white">Artist Growth Units ({units.length})</h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Artista</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Ventas</th>
                  <th className="px-4 py-3 text-right">Revenue</th>
                  <th className="px-4 py-3 text-right">Spend</th>
                  <th className="px-4 py-3 text-right">ROAS</th>
                  <th className="px-4 py-3 text-right">Leads</th>
                  <th className="px-4 py-3 text-right">Wizards</th>
                  <th className="px-4 py-3 text-right">Checkouts</th>
                  <th className="px-4 py-3 text-right">Refunds</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {units.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
                      Aún no hay unidades. Crea la primera con POST /api/age/units.
                    </td>
                  </tr>
                )}
                {units.map((u) => {
                  const meterPct = Math.min(100, (u.confirmedSales / rules.requiredSales) * 100);
                  return (
                    <tr key={u.id} className="hover:bg-white/[0.02]">
                      <td className="px-4 py-4">
                        <div className="font-bold text-white">{u.artistName}</div>
                        <div className="text-xs text-zinc-500">/{u.slug}</div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${STATUS_STYLES[u.status] || STATUS_STYLES.draft}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="font-black text-white">{u.confirmedSales} / {rules.requiredSales}</div>
                        <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/5">
                          <div
                            className={`h-full ${u.isReady ? "bg-emerald-500" : "bg-orange-500"}`}
                            style={{ width: `${meterPct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right font-mono text-emerald-300">{fmtCents(u.grossRevenueCents)}</td>
                      <td className="px-4 py-4 text-right font-mono text-rose-300">{fmtCents(u.adSpendCents)}</td>
                      <td className="px-4 py-4 text-right font-mono text-white">{u.roas.toFixed(2)}x</td>
                      <td className="px-4 py-4 text-right text-zinc-300">{u.leads}</td>
                      <td className="px-4 py-4 text-right text-zinc-300">{u.wizards}</td>
                      <td className="px-4 py-4 text-right text-zinc-300">{u.checkouts}</td>
                      <td className="px-4 py-4 text-right text-zinc-500">{u.refunds}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Approvals */}
        <section>
          <h2 className="mb-4 text-lg font-black text-white">Aprobaciones de expansión ({approvals.length})</h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">ID</th>
                  <th className="px-4 py-3 text-left">Source unit</th>
                  <th className="px-4 py-3 text-right">Reservado</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">New unit</th>
                  <th className="px-4 py-3 text-left">Aprobado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {approvals.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Aún sin aprobaciones.</td>
                  </tr>
                )}
                {approvals.map((a: any) => (
                  <tr key={a.id}>
                    <td className="px-4 py-3 font-mono text-zinc-300">#{a.id}</td>
                    <td className="px-4 py-3 text-zinc-200">{a.sourceUnitId}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-300">{fmtCents(a.reservedAmountCents)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-300">{a.status}</span>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{a.newUnitId || "—"}</td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{a.approvedAt ? new Date(a.approvedAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Ledger */}
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-white">
            <Users className="h-5 w-5 text-orange-300" /> Ledger (últimos 50)
          </h2>
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.03] text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                <tr>
                  <th className="px-4 py-3 text-left">Fecha</th>
                  <th className="px-4 py-3 text-left">Unit</th>
                  <th className="px-4 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-right">Monto</th>
                  <th className="px-4 py-3 text-left">Nota</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-zinc-500">Sin movimientos.</td>
                  </tr>
                )}
                {ledger.map((row: any) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 text-xs text-zinc-400">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-4 py-3 text-zinc-300">{row.unitId || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] uppercase text-zinc-300">{row.type}</span>
                    </td>
                    <td className={`px-4 py-3 text-right font-mono ${row.amountCents >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {row.amountCents >= 0 ? "+" : ""}{fmtCents(row.amountCents)}
                    </td>
                    <td className="px-4 py-3 text-xs text-zinc-500">{row.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Stat({ label, value, icon: Icon, accent }: { label: string; value: string; icon: any; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ${accent ? "border-orange-500/30 bg-gradient-to-br from-orange-500/10 to-rose-500/5" : "border-white/10 bg-white/[0.03]"}`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{label}</p>
        <Icon className={`h-4 w-4 ${accent ? "text-orange-300" : "text-zinc-500"}`} />
      </div>
      <p className="mt-3 text-2xl font-black text-white">{value}</p>
    </div>
  );
}
