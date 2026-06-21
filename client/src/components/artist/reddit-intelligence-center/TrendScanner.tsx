import { TrendingUp, MessageSquare, ArrowUpRight, Activity } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, ScoreBadge, SentimentPill, Badge, EmptyState, fmtCompact, timeAgo, RD_ORANGE } from './shared';

export function TrendScanner({ center }: { center: RedditCenter }) {
  const trends = center.trends;
  const timeline = center.analytics?.timeline || [];

  return (
    <div className="space-y-4">
      <PanelHeader icon={<TrendingUp className="h-5 w-5" />} title="Trend Scanner" subtitle="Posts ganando tracción en tu nicho — ordenados por trending score." />

      {timeline.length > 0 && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-medium text-white/60"><Activity className="h-4 w-4 text-orange-400" /> Menciones (7 días)</div>
          <div className="h-28 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="rdTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RD_ORANGE} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={RD_ORANGE} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#0c0c0e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, fontSize: 12 }} labelStyle={{ color: '#fff' }} />
                <Area type="monotone" dataKey="mentions" stroke={RD_ORANGE} strokeWidth={2} fill="url(#rdTrend)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      )}

      {trends.length === 0 ? (
        <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="Sin trends todavía" hint="Ejecuta un escaneo para detectar los posts que están subiendo en las comunidades de tu género." />
      ) : (
        <div className="space-y-2">
          {trends.map((t) => (
            <GlassCard key={t.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone="orange">r/{t.subreddit}</Badge>
                    <SentimentPill label={t.sentiment} />
                    <span className="text-[11px] text-white/40">{timeAgo(t.createdUtc)} · u/{t.author}</span>
                  </div>
                  <a href={t.permalink} target="_blank" rel="noreferrer" className="mt-1.5 block text-sm font-medium text-white hover:text-orange-300">
                    {t.title}
                  </a>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
                    <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5 text-orange-400" />{fmtCompact(t.score)}</span>
                    <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{fmtCompact(t.numComments)}</span>
                    <span>Velocidad {t.velocity}/h</span>
                    <span>Engagement {t.engagement}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <ScoreBadge value={t.viralProbability} label="viral" />
                  <span className="text-[10px] uppercase tracking-wide text-white/40">trend {t.trendingScore}</span>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
