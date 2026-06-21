import { useState } from 'react';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, Badge, EmptyState, timeAgo } from './shared';

const SUGGESTIONS = [
  '/drop nuevo single este viernes',
  '¿Cuándo es el próximo concierto?',
  'Quiero comprar merch',
  'Muéstrame los beneficios VIP',
];

export default function ConciergeAI({ dc }: { dc: DiscordCenter }) {
  const [text, setText] = useState('');
  const [last, setLast] = useState<DiscordCenter['aiCommands'][number] | null>(null);

  const run = async () => {
    if (!text.trim()) return;
    const r = await dc.runAICommand.mutateAsync(text.trim());
    setLast(r?.command ?? null);
    setText('');
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Bot className="h-5 w-5" />} title="AI Concierge"
        subtitle="Tu asistente IA responde slash-commands y lenguaje natural, y enruta a cada módulo." />

      <GlassCard className="space-y-3 p-5">
        <div className="flex gap-2">
          <DCInput placeholder="/drop, /vip, /tour… o escribe en lenguaje natural" value={text}
            onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && run()} />
          <DCButton onClick={run} disabled={!text.trim() || dc.runAICommand.isPending}>
            {dc.runAICommand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </DCButton>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => setText(s)}
              className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60 transition hover:bg-white/10">{s}</button>
          ))}
        </div>
        {last && (
          <div className="space-y-2 rounded-xl border border-[#5865F2]/30 bg-[#5865F2]/[0.06] p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#a5adfb]" />
              <Badge tone="blurple">{last.intent}</Badge>
              <Badge tone="sky">{last.moduleTarget}</Badge>
              <span className="ml-auto text-[11px] text-white/40">{(last.confidence * 100).toFixed(0)}% · {last.source}</span>
            </div>
            <p className="text-sm text-white/85">{last.reply}</p>
          </div>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">Comandos recientes</h4>
        {dc.aiCommands.length > 0 ? (
          <div className="space-y-2">
            {dc.aiCommands.slice(0, 10).map((c) => (
              <div key={c.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm text-white/80">{c.rawText}</span>
                  <Badge tone="blurple">{c.intent}</Badge>
                </div>
                <div className="mt-1 flex items-center gap-2 text-[11px] text-white/45">
                  <span className="truncate">{c.reply}</span>
                  <span className="ml-auto whitespace-nowrap">{timeAgo(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState icon={<Bot className="h-6 w-6" />} title="Sin comandos aún" hint="Prueba un slash-command o una pregunta arriba." />
        )}
      </GlassCard>
    </div>
  );
}
