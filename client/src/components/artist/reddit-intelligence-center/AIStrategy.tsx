import { Sparkles, Loader2, Lightbulb, Target, CalendarDays, CheckCircle2 } from 'lucide-react';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, EmptyState } from './shared';

export function AIStrategy({ center }: { center: RedditCenter }) {
  const report = center.generateStrategy.data?.report || center.reports[0] || null;
  const pending = center.generateStrategy.isPending;

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Sparkles className="h-5 w-5" />} title="AI Strategy" subtitle="Plan de crecimiento ético generado desde tu inteligencia de Reddit."
        action={
          <button onClick={() => center.generateStrategy.mutate({ genre: center.config?.genre })} disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-40">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generar
          </button>
        }
      />

      {!report ? (
        <EmptyState icon={<Sparkles className="h-6 w-6" />} title="Sin estrategia todavía" hint="Genera un plan de crecimiento con IA basado en trends, comunidades y sentimiento detectados." />
      ) : (
        <div className="space-y-3">
          <GlassCard className="p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-orange-300">
              <Sparkles className="h-4 w-4" /> Resumen estratégico
              <Badge tone={report.source === 'llm' ? 'emerald' : 'slate'}>{report.source === 'llm' ? 'IA' : 'heurístico'}</Badge>
            </div>
            <p className="text-sm leading-relaxed text-white/80">{report.summary}</p>
          </GlassCard>

          {report.recommendations?.length > 0 && (
            <GlassCard className="p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Recomendaciones</div>
              <ul className="space-y-1.5">
                {report.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2 text-sm text-white/70"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-orange-400" />{r}</li>
                ))}
              </ul>
            </GlassCard>
          )}

          {report.contentIdeas?.length > 0 && (
            <GlassCard className="p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70"><Lightbulb className="h-4 w-4 text-amber-400" /> Ideas de contenido</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {report.contentIdeas.map((c, i) => (
                  <div key={i} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone="orange">{c.subreddit.startsWith('r/') ? c.subreddit : `r/${c.subreddit}`}</Badge>
                      <Badge tone="slate">{c.format}</Badge>
                    </div>
                    <p className="mt-1.5 text-sm font-medium text-white">{c.title}</p>
                    <p className="mt-0.5 text-[11px] text-white/45">{c.angle}</p>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          <div className="grid gap-3 md:grid-cols-2">
            {report.targetCommunities?.length > 0 && (
              <GlassCard className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70"><Target className="h-4 w-4 text-sky-400" /> Comunidades objetivo</div>
                <div className="flex flex-wrap gap-1.5">
                  {report.targetCommunities.map((t, i) => <Badge key={i} tone="sky">{t.startsWith('r/') ? t : `r/${t}`}</Badge>)}
                </div>
              </GlassCard>
            )}
            {report.dailyPlan?.length > 0 && (
              <GlassCard className="p-4">
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-white/70"><CalendarDays className="h-4 w-4 text-violet-400" /> Plan diario</div>
                <ol className="space-y-1.5">
                  {report.dailyPlan.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-white/70">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-500/15 text-[10px] font-bold text-orange-300">{i + 1}</span>{p}
                    </li>
                  ))}
                </ol>
              </GlassCard>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
