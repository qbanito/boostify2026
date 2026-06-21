import { Flame, MessageSquare, ArrowUpRight, Zap, ExternalLink } from 'lucide-react';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, ScoreBadge, Badge, EmptyState, fmtCompact } from './shared';

export function ViralOpportunities({ center }: { center: RedditCenter }) {
  const opps = center.opportunities;
  const breaking = opps.filter((o) => o.viralProbability >= 75).length;

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Zap className="h-5 w-5" />} title="Viral Opportunities" subtitle="Posts subiendo AHORA donde participar con valor te da máxima visibilidad." />

      {opps.length === 0 ? (
        <EmptyState icon={<Flame className="h-6 w-6" />} title="Sin oportunidades aún" hint="Escanea para detectar posts con alta probabilidad viral en tu nicho." />
      ) : (
        <>
          <div className="text-xs text-white/50">{opps.length} oportunidades · <span className="text-rose-300">{breaking} explotando ahora</span></div>
          <div className="space-y-2">
            {opps.map((o) => (
              <GlassCard key={o.id} className={`p-4 ${o.viralProbability >= 75 ? 'ring-1 ring-rose-500/30' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="orange">r/{o.subreddit}</Badge>
                      <span className="text-[11px] text-white/45">Velocidad {o.velocity}/h</span>
                    </div>
                    <a href={o.permalink} target="_blank" rel="noreferrer" className="mt-1.5 block text-sm font-medium text-white hover:text-orange-300">{o.title}</a>
                    <p className="mt-1.5 text-[11px] text-orange-200/70">{o.reason}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/50">
                      <span className="inline-flex items-center gap-1"><ArrowUpRight className="h-3.5 w-3.5 text-orange-400" />{fmtCompact(o.score)}</span>
                      <span className="inline-flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{fmtCompact(o.numComments)}</span>
                      <span>Engagement {o.engagement}</span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <ScoreBadge value={o.viralProbability} label="viral" />
                    <a href={o.permalink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-300 hover:text-orange-200">
                      Abrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
