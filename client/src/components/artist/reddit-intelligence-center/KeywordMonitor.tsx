import { useState } from 'react';
import { Hash, Plus, Loader2 } from 'lucide-react';
import type { RedditCenter } from '../../../hooks/use-reddit-center';
import { GlassCard, PanelHeader, Badge, GrowthIndicator, SentimentPill, EmptyState, fmtCompact } from './shared';

export function KeywordMonitor({ center }: { center: RedditCenter }) {
  const [kw, setKw] = useState('');
  const keywords = center.keywords;
  const configured = center.config?.keywords || [];
  const pending = center.addKeyword.isPending;

  const onAdd = () => {
    const v = kw.trim();
    if (!v) return;
    center.addKeyword.mutate(v, { onSuccess: () => setKw('') });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Hash className="h-5 w-5" />} title="Keyword Monitor" subtitle="Sigue tu nombre, canciones y términos clave — menciones, crecimiento y sentimiento." />

      <GlassCard className="p-3">
        <div className="flex gap-2">
          <input value={kw} onChange={(e) => setKw(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onAdd()}
            placeholder="Añadir keyword (tu nombre, single, etc.)"
            className="flex-1 rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-orange-400/50 focus:outline-none" />
          <button onClick={onAdd} disabled={pending || !kw.trim()}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-40">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Añadir
          </button>
        </div>
        {configured.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {configured.map((k) => <Badge key={k} tone="slate">{k}</Badge>)}
          </div>
        )}
        <p className="mt-2 text-[11px] text-white/40">Re-escanea tras añadir para recopilar menciones.</p>
      </GlassCard>

      {keywords.length === 0 ? (
        <EmptyState icon={<Hash className="h-6 w-6" />} title="Sin datos de keywords" hint="Añade términos y escanea para monitorear su actividad en Reddit." />
      ) : (
        <div className="space-y-2">
          {keywords.map((k) => (
            <GlassCard key={k.keyword} className="p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">{k.keyword}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-white/50">
                    <span>{fmtCompact(k.mentions)} menciones</span>
                    <SentimentPill label={k.sentiment} />
                  </div>
                  {k.topSubreddits.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {k.topSubreddits.map((s) => <Badge key={s.subreddit} tone="orange">r/{s.subreddit} · {s.count}</Badge>)}
                    </div>
                  )}
                </div>
                <GrowthIndicator value={k.growth} />
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}
