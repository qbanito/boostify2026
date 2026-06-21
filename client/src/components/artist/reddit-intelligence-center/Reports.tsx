import { FileText } from 'lucide-react';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, EmptyState } from './shared';

export function Reports({ center }: { center: RedditCenter }) {
  const reports = center.reports;

  return (
    <div className="space-y-4">
      <PanelHeader icon={<FileText className="h-5 w-5" />} title="Reports" subtitle="Historial de estrategias e informes de inteligencia generados." />

      {reports.length === 0 ? (
        <EmptyState icon={<FileText className="h-6 w-6" />} title="Sin informes aún" hint="Genera una estrategia en la pestaña AI Strategy para empezar tu historial." />
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <GlassCard key={r.id} className="p-4">
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge tone="orange">{r.reportType || 'strategy'}</Badge>
                  <Badge tone={r.source === 'llm' ? 'emerald' : 'slate'}>{r.source === 'llm' ? 'IA' : 'heurístico'}</Badge>
                </div>
                <span className="text-[11px] text-white/40">{new Date(r.createdAt).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              </div>
              <p className="text-sm text-white/75">{r.summary}</p>
              {r.recommendations?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="text-[11px] text-white/40">{r.recommendations.length} recomendaciones ·</span>
                  <span className="text-[11px] text-white/40">{r.contentIdeas?.length || 0} ideas ·</span>
                  <span className="text-[11px] text-white/40">{r.targetCommunities?.length || 0} comunidades</span>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
