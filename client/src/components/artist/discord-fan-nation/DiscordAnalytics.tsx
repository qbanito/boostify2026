import { BarChart3, Users, TrendingUp, DollarSign, Crown } from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from 'recharts';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, StatTile, TierBadge, EmptyState, fmtCompact, fmtMoney, DC_BLURPLE, DC_GREEN } from './shared';

export default function DiscordAnalytics({ dc }: { dc: DiscordCenter }) {
  const a = dc.analytics;

  if (!a) {
    return (
      <div className="space-y-4">
        <PanelHeader icon={<BarChart3 className="h-5 w-5" />} title="Analytics" subtitle="Métricas de comunidad, retención e ingresos." />
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Sin datos todavía" hint="Conecta tu servidor e importa miembros para ver analytics." />
      </div>
    );
  }

  const timeline = a.timeline || [];

  return (
    <div className="space-y-4">
      <PanelHeader icon={<BarChart3 className="h-5 w-5" />} title="Analytics"
        subtitle="Métricas de comunidad, retención e ingresos de tu Discord." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Miembros" value={fmtCompact(a.totalMembers)} accent="blurple" sub={`${a.activeMembers} activos`} />
        <StatTile label="Nuevos" value={fmtCompact(a.newMembers)} accent="emerald" sub={`${(a.activeRate * 100).toFixed(0)}% activos`} />
        <StatTile label="Retención VIP" value={`${(a.vipRetention * 100).toFixed(0)}%`} accent="fuchsia" sub={`churn ${(a.churnRate * 100).toFixed(0)}%`} />
        <StatTile label="Ingresos" value={fmtMoney(a.totalRevenue)} accent="amber" sub={`ARPU ${fmtMoney(a.arpu)}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Conversiones" value={fmtCompact(a.conversions)} accent="sky" />
        <StatTile label="Campañas" value={fmtCompact(a.campaignsSent)} accent="blurple" />
        <StatTile label="Eventos" value={fmtCompact(a.eventsCreated)} accent="emerald" />
        <StatTile label="Tickets" value={fmtCompact(a.ticketsSold)} accent="fuchsia" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="p-5">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><TrendingUp className="h-4 w-4 text-[#a5adfb]" /> Actividad diaria</h4>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={timeline}>
                <defs>
                  <linearGradient id="dcActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={DC_BLURPLE} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={DC_BLURPLE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1b26', border: '1px solid rgba(88,101,242,0.4)', borderRadius: 12, color: '#fff' }} />
                <Area type="monotone" dataKey="active" stroke={DC_BLURPLE} fill="url(#dcActive)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Sin actividad" />}
        </GlassCard>

        <GlassCard className="p-5">
          <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Users className="h-4 w-4 text-[#57F287]" /> Nuevos miembros</h4>
          {timeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1a1b26', border: '1px solid rgba(87,242,135,0.4)', borderRadius: 12, color: '#fff' }} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="joined" fill={DC_GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState icon={<Users className="h-6 w-6" />} title="Sin altas" />}
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Crown className="h-4 w-4 text-amber-300" /> Top fans</h4>
        {a.topFans?.length > 0 ? (
          <div className="space-y-2">
            {a.topFans.slice(0, 10).map((f, i) => (
              <div key={f.discordUserId || i} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-5 text-center text-xs font-bold text-white/40">#{i + 1}</span>
                  <span className="text-sm text-white/90">{f.username || f.discordUserId}</span>
                  <TierBadge tier={f.tier} />
                </div>
                <div className="flex items-center gap-3 text-[11px] text-white/50">
                  <span className="inline-flex items-center gap-1"><DollarSign className="h-3 w-3" />{fmtMoney(f.totalSpent || 0)}</span>
                  <span>{fmtCompact(f.messagesCount || 0)} msgs</span>
                </div>
              </div>
            ))}
          </div>
        ) : <EmptyState icon={<Crown className="h-6 w-6" />} title="Sin ranking aún" hint="Importa miembros para generar el ranking." />}
      </GlassCard>
    </div>
  );
}
