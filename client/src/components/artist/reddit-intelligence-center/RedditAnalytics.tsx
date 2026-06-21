import { BarChart3, Users, Flame, UserPlus, Hash, TrendingUp } from 'lucide-react';
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, CartesianGrid } from 'recharts';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, StatTile, Metric, EmptyState, fmtCompact, RD_ORANGE } from './shared';

export function RedditAnalytics({ center }: { center: RedditCenter }) {
  const a = center.analytics;

  if (!a) {
    return (
      <div className="space-y-4">
        <PanelHeader icon={<BarChart3 className="h-5 w-5" />} title="Analytics" subtitle="Visión general del rendimiento de tu inteligencia de Reddit." />
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Sin analíticas aún" hint="Ejecuta un escaneo para ver tu resumen de inteligencia." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PanelHeader icon={<BarChart3 className="h-5 w-5" />} title="Analytics" subtitle="Visión general del rendimiento de tu inteligencia de Reddit." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Comunidades" value={a.totalCommunities} accent="sky" />
        <StatTile label="Alcance" value={fmtCompact(a.totalReach)} accent="orange" />
        <StatTile label="Trends" value={a.trendsTracked} accent="emerald" />
        <StatTile label="Oportunidades" value={a.opportunitiesFound} accent="rose" />
        <StatTile label="Fan leads" value={a.fanLeads} accent="violet" />
        <StatTile label="Viral medio" value={a.avgViral} accent="amber" />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60"><TrendingUp className="h-4 w-4 text-orange-400" /> Menciones (7 días)</div>
          {a.timeline?.length > 0 ? (
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={a.timeline} margin={{ top: 4, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                  <Line type="monotone" dataKey="mentions" stroke={RD_ORANGE} strokeWidth={2.5} dot={{ r: 3, fill: RD_ORANGE }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="py-8 text-center text-sm text-white/40">Sin datos de timeline.</p>}
        </GlassCard>

        <GlassCard className="space-y-3 p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-white/60"><BarChart3 className="h-4 w-4 text-orange-400" /> Salud de inteligencia</div>
          <Metric label="Audience match medio" value={a.avgMatchScore} tone="orange" />
          <Metric label="Sentimiento de audiencia" value={a.sentiment?.score || 50} tone="emerald" />
          <Metric label="Probabilidad viral media" value={a.avgViral} tone="amber" />
          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div><div className="text-lg font-bold text-emerald-300">{a.sentiment?.positive ?? 0}</div><div className="text-[10px] uppercase text-white/40">Positivos</div></div>
            <div><div className="text-lg font-bold text-white/60">{a.sentiment?.neutral ?? 0}</div><div className="text-[10px] uppercase text-white/40">Neutrales</div></div>
            <div><div className="text-lg font-bold text-rose-300">{a.sentiment?.negative ?? 0}</div><div className="text-[10px] uppercase text-white/40">Negativos</div></div>
          </div>
        </GlassCard>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlassCard className="flex items-center gap-3 p-4"><Users className="h-5 w-5 text-sky-400" /><div><div className="text-sm font-bold text-white">{a.totalCommunities}</div><div className="text-[10px] uppercase text-white/40">Comunidades</div></div></GlassCard>
        <GlassCard className="flex items-center gap-3 p-4"><Flame className="h-5 w-5 text-rose-400" /><div><div className="text-sm font-bold text-white">{a.opportunitiesFound}</div><div className="text-[10px] uppercase text-white/40">Oportunidades</div></div></GlassCard>
        <GlassCard className="flex items-center gap-3 p-4"><UserPlus className="h-5 w-5 text-violet-400" /><div><div className="text-sm font-bold text-white">{a.fanLeads}</div><div className="text-[10px] uppercase text-white/40">Fan leads</div></div></GlassCard>
        <GlassCard className="flex items-center gap-3 p-4"><Hash className="h-5 w-5 text-orange-400" /><div><div className="text-sm font-bold text-white">{a.trendsTracked}</div><div className="text-[10px] uppercase text-white/40">Trends</div></div></GlassCard>
      </div>
    </div>
  );
}
