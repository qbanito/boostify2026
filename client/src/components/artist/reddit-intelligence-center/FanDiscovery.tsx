import { UserPlus, MessageSquare, ExternalLink, Heart } from 'lucide-react';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, Metric, EmptyState, timeAgo } from './shared';

const POT_TONE: Record<string, 'emerald' | 'amber' | 'slate'> = { High: 'emerald', Medium: 'amber', Low: 'slate' };

export function FanDiscovery({ center }: { center: RedditCenter }) {
  const leads = center.fanLeads;
  const high = leads.filter((l) => l.potential === 'High').length;

  return (
    <div className="space-y-4">
      <PanelHeader icon={<UserPlus className="h-5 w-5" />} title="Fan Discovery" subtitle="Personas pidiendo música como la tuya — leads para conectar aportando valor." />

      <div className="flex items-start gap-2 rounded-xl border border-orange-400/15 bg-orange-400/[0.04] px-4 py-2.5 text-[11px] text-orange-200/70">
        <Heart className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Participa de forma auténtica (regla 9:1 de Reddit): responde con valor real antes de mencionar tu música. Nada de spam.</span>
      </div>

      {leads.length === 0 ? (
        <EmptyState icon={<UserPlus className="h-6 w-6" />} title="Sin leads de fans aún" hint="Escanea para encontrar threads donde la gente busca descubrir nuevos artistas de tu género." />
      ) : (
        <>
          <div className="text-xs text-white/50">{leads.length} oportunidades de fans · <span className="text-emerald-300">{high} de alto potencial</span></div>
          <div className="space-y-2">
            {leads.map((l) => (
              <GlassCard key={l.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="orange">r/{l.subreddit}</Badge>
                      <Badge tone={POT_TONE[l.potential]}>{l.potential} match</Badge>
                      <span className="text-[11px] text-white/40">{timeAgo(l.createdUtc)} · u/{l.author}</span>
                    </div>
                    <a href={l.permalink} target="_blank" rel="noreferrer" className="mt-1.5 block text-sm font-medium text-white hover:text-orange-300">{l.title}</a>
                    <div className="mt-2 max-w-[220px]"><Metric label="Match score" value={l.matchScore} tone="emerald" /></div>
                  </div>
                  <a href={l.permalink} target="_blank" rel="noreferrer" className="flex shrink-0 items-center gap-1 rounded-lg border border-orange-400/30 bg-orange-500/10 px-3 py-1.5 text-xs font-semibold text-orange-300 hover:bg-orange-500/20">
                    <MessageSquare className="h-3.5 w-3.5" /> Engage <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </GlassCard>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
