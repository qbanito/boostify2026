import { useState } from 'react';
import { Radar as RadarIcon, Plus, Loader2 } from 'lucide-react';
import { RadarChart, PolarGrid, PolarAngleAxis, Radar, ResponsiveContainer, Tooltip } from 'recharts';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, GrowthIndicator, SentimentPill, EmptyState, fmtCompact, RD_ORANGE } from './shared';

export function CompetitorRadar({ center }: { center: RedditCenter }) {
  const [name, setName] = useState('');
  const competitors = center.competitors;
  const radarData = competitors.slice(0, 8).map((c) => ({ artist: c.artistName.slice(0, 12), mentions: c.mentions }));
  const pending = center.addCompetitor.isPending;

  const onAdd = () => {
    const v = name.trim();
    if (!v) return;
    center.addCompetitor.mutate(v, { onSuccess: () => setName('') });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<RadarIcon className="h-5 w-5" />} title="Competitor Radar" subtitle="Cómo se mueven artistas similares en Reddit — menciones, crecimiento y sentimiento." />

      <GlassCard className="p-3">
        <div className="flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            placeholder="Añadir artista similar a vigilar"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none" />
          <button onClick={onAdd} disabled={pending || !name.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">Re-escanea tras añadir para recopilar sus menciones.</p>
      </GlassCard>

      {radarData.length >= 3 && (
        <GlassCard className="p-4">
          <div className="mb-2 text-xs font-medium text-white/60">Volumen de menciones</div>
          <div className="h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} outerRadius="72%">
                <PolarGrid stroke="rgba(255,255,255,0.1)" />
                <PolarAngleAxis dataKey="artist" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Radar dataKey="mentions" stroke={RD_ORANGE} fill={RD_ORANGE} fillOpacity={0.35} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {competitors.length === 0 ? (
        <EmptyState icon={<RadarIcon className="h-6 w-6" />} title="Sin competidores aún" hint="Añade artistas similares y escanea para comparar tu presencia en Reddit." />
      ) : (
        <div className="space-y-2">
          {competitors.map((c) => (
            <GlassCard key={c.artistName} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{c.artistName}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                    <span>{fmtCompact(c.mentions)} menciones</span>
                    <SentimentPill label={c.sentiment} />
                    {c.avgViral > 0 && <Badge tone="orange">viral medio {c.avgViral}</Badge>}
                  </div>
                  {c.topSubreddits.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {c.topSubreddits.map((s) => <Badge key={s.subreddit} tone="slate">r/{s.subreddit}</Badge>)}
                    </div>
                  )}
                </div>
                <GrowthIndicator value={c.growth} />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
