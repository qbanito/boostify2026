import { Globe, Sparkles, Loader2, Users, Clock } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, StatTile, Badge, EmptyState, fmtCompact } from './shared';

const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export function AudienceMap({ center }: { center: RedditCenter }) {
  const audience = center.audience;
  const summary = center.audienceSummary.data?.summary;
  const pendingSummary = center.audienceSummary.isPending;

  if (!audience) {
    return (
      <div className="space-y-4">
        <PanelHeader icon={<Globe className="h-5 w-5" />} title="Audience Map" subtitle="Dónde vive tu audiencia en Reddit y cómo se siente." />
        <EmptyState icon={<Globe className="h-6 w-6" />} title="Sin mapa de audiencia" hint="Escanea para construir el perfil de audiencia, sentimiento y horarios activos." />
      </div>
    );
  }

  const s = audience.sentiment;
  const pie = [
    { name: 'Positivo', value: s.positive, color: '#34d399' },
    { name: 'Neutral', value: s.neutral, color: '#64748b' },
    { name: 'Negativo', value: s.negative, color: '#f43f5e' },
  ].filter((d) => d.value > 0);

  // Heatmap: max value for normalization
  const maxHeat = Math.max(1, ...audience.heatmap.map((h) => h.value));
  const heatAt = (day: number, hourBucket: number) => {
    // hourBucket spans 4 hours; sum values inside
    let v = 0;
    for (const h of audience.heatmap) if (h.day === day && Math.floor(h.hour / 4) === hourBucket) v += h.value;
    return v;
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Globe className="h-5 w-5" />} title="Audience Map" subtitle="Dónde vive tu audiencia en Reddit y cómo se siente."
        action={
          <button onClick={() => center.audienceSummary.mutate({ genre: center.config?.genre })} disabled={pendingSummary}
            className="flex items-center gap-1.5 rounded-xl border border-orange-400/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300 transition hover:bg-orange-500/20 disabled:opacity-40">
            {pendingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Resumen IA
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Alcance total" value={fmtCompact(audience.totalReach)} accent="orange" />
        <StatTile label="Comunidades" value={audience.communityCount} accent="sky" />
        <StatTile label="Sentimiento" value={`${s.score}`} accent={s.score >= 60 ? 'emerald' : s.score <= 40 ? 'rose' : 'amber'} sub={s.label} />
        <StatTile label="Positivos" value={s.positive} accent="emerald" />
      </div>

      {summary && (
        <GlassCard className="p-4">
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-orange-300"><Sparkles className="h-4 w-4" /> Resumen de audiencia</div>
          <p className="text-sm leading-relaxed text-white/75">{summary}</p>
        </GlassCard>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {pie.length > 0 && (
          <GlassCard className="p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60"><Users className="h-4 w-4 text-orange-400" /> Distribución de sentimiento</div>
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pie} dataKey="value" nameKey="name" innerRadius={42} outerRadius={64} paddingAngle={3}>
                    {pie.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-3 text-[11px] text-white/55">
              {pie.map((d) => <span key={d.name} className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: d.color }} />{d.name}</span>)}
            </div>
          </GlassCard>
        )}

        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60"><Clock className="h-4 w-4 text-orange-400" /> Actividad (día × franja horaria UTC)</div>
          <div className="space-y-1">
            <div className="flex gap-1 pl-9 text-[8px] text-white/35">
              {['0-4', '4-8', '8-12', '12-16', '16-20', '20-24'].map((h) => <div key={h} className="flex-1 text-center">{h}</div>)}
            </div>
            {DAYS.map((d, di) => (
              <div key={d} className="flex items-center gap-1">
                <div className="w-8 text-[9px] text-white/40">{d}</div>
                {[0, 1, 2, 3, 4, 5].map((hb) => {
                  const v = heatAt(di, hb);
                  const intensity = v / maxHeat;
                  return <div key={hb} className="h-5 flex-1 rounded-sm" style={{ background: `rgba(255,69,0,${0.08 + intensity * 0.85})` }} title={`${v}`} />;
                })}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-white/35">Más naranja = más actividad. Úsalo para programar tu participación.</p>
        </GlassCard>
      </div>

      {center.topCommunities.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 text-xs font-medium text-white/60">Comunidades núcleo</div>
          <div className="flex flex-wrap gap-1.5">
            {center.topCommunities.map((c) => <Badge key={c.name} tone="orange">r/{c.name} · {fmtCompact(c.subscribers)}</Badge>)}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
