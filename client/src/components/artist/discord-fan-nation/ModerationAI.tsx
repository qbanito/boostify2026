import { useState } from 'react';
import { ShieldAlert, Loader2, ScanText, AlertTriangle } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCTextarea, Badge, EmptyState, timeAgo } from './shared';

const ACTION_TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'fuchsia'> = {
  allow: 'emerald', warn: 'amber', delete: 'rose', escalate: 'fuchsia',
};

export default function ModerationAI({ dc }: { dc: DiscordCenter }) {
  const [sample, setSample] = useState('');
  const [result, setResult] = useState<DiscordCenter['moderation'][number] | null>(null);

  const check = async () => {
    if (!sample.trim()) return;
    const r = await dc.checkModeration.mutateAsync({ text: sample.trim() });
    setResult(r?.result ?? r ?? null);
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<ShieldAlert className="h-5 w-5" />} title="AI Moderator"
        subtitle="Detecta spam, estafas, enlaces peligrosos e insultos automáticamente en tu servidor." />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-5">
          <h4 className="text-sm font-semibold text-white">Probar moderación</h4>
          <DCTextarea rows={3} placeholder="Pega un mensaje sospechoso para analizarlo…" value={sample} onChange={(e) => setSample(e.target.value)} />
          <DCButton onClick={check} disabled={!sample.trim() || dc.checkModeration.isPending} className="w-full">
            {dc.checkModeration.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanText className="h-4 w-4" />} Analizar mensaje
          </DCButton>
          {result && (
            <div className="space-y-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="flex items-center gap-2">
                <Badge tone={result.flagged ? 'rose' : 'emerald'}>{result.flagged ? 'Marcado' : 'Limpio'}</Badge>
                <Badge tone={ACTION_TONE[result.action] ?? 'slate'}>{result.action}</Badge>
              </div>
              {result.categories?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {result.categories.map((c) => <Badge key={c} tone="amber">{c}</Badge>)}
                </div>
              )}
              {result.reason && <p className="text-[11px] text-white/55">{result.reason}</p>}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-white">Registro de moderación</h4>
          {dc.moderation.length > 0 ? (
            <div className="space-y-2">
              {dc.moderation.slice(0, 10).map((m) => (
                <div key={m.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm text-white/80">{m.text}</span>
                    <Badge tone={ACTION_TONE[m.action] ?? 'slate'}>{m.action}</Badge>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/45">
                    {m.categories?.slice(0, 3).map((c) => <Badge key={c} tone="amber">{c}</Badge>)}
                    <span className="ml-auto">{timeAgo(m.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<AlertTriangle className="h-6 w-6" />} title="Sin incidencias" hint="Cuando el bot modere mensajes aparecerán aquí." />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
