import { Users, ExternalLink, Shield } from 'lucide-react';
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis, Cell } from 'recharts';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, Metric, EmptyState, fmtCompact, RD_ORANGE } from './shared';

const COMP_TONE: Record<string, 'emerald' | 'amber' | 'rose'> = { Low: 'emerald', Medium: 'amber', High: 'rose' };
const POT_TONE: Record<string, 'emerald' | 'amber' | 'slate'> = { High: 'emerald', Medium: 'amber', Low: 'slate' };

export function SubredditExplorer({ center }: { center: RedditCenter }) {
  const communities = center.communities;
  const chartData = communities.slice(0, 8).map((c) => ({ name: `r/${c.name}`.slice(0, 14), match: c.matchScore }));

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Users className="h-5 w-5" />} title="Community Explorer" subtitle="Subreddits donde tu audiencia vive — clasificados por afinidad y competencia." />

      {chartData.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 text-xs font-medium text-white/60">Audience match por comunidad</div>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 9 }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={40} />
                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Bar dataKey="match" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => (
                    <Cell key={i} fill={d.match >= 66 ? '#34d399' : d.match >= 40 ? RD_ORANGE : '#64748b'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {communities.length === 0 ? (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Sin comunidades aún" hint="Escanea para descubrir los subreddits más relevantes para tu música." />
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {communities.map((c) => (
            <GlassCard key={c.name} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <a href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-sm font-semibold text-white hover:text-orange-300">
                    r/{c.name} <ExternalLink className="h-3 w-3 opacity-50" />
                  </a>
                  <p className="mt-0.5 line-clamp-2 text-[11px] text-white/45">{c.description || c.title}</p>
                </div>
                <Badge tone={POT_TONE[c.fanPotential]}>{c.fanPotential}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                <Metric label="Audience match" value={c.matchScore} tone="orange" />
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{fmtCompact(c.subscribers)} miembros</span>
                  <span className="inline-flex items-center gap-1"><Shield className="h-3.5 w-3.5" /> Competencia <Badge tone={COMP_TONE[c.competitionLevel]}>{c.competitionLevel}</Badge></span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
