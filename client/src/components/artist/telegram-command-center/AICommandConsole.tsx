import { useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Send, Loader2, Mic, Bot, ArrowRight } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader } from './shared';

const SUGGESTIONS = [
  'Hey Boostify, crea una campaña para mi canción nueva',
  'Hey Boostify, abre un canal VIP para mis fans',
  'Hey Boostify, vende tickets para el show del viernes',
  'Hey Boostify, envía mensaje a mis fans VIP',
  'Hey Boostify, inicia un live y avisa a la comunidad',
  'Hey Boostify, revisa mis ingresos',
];

const INTENT_LABEL: Record<string, string> = {
  create_campaign: 'Campaña', sell_tickets: 'Tickets', message_fans: 'Mensaje a fans',
  design_cover: 'Portada', create_video: 'Video musical', create_song: 'Canción',
  check_revenue: 'Ingresos', show_merch: 'Merch', booking: 'Booking',
  wallet_balance: 'Wallet BTF', start_live: 'Live', create_community: 'Comunidad',
  launch_release: 'Lanzamiento', opt_out: 'Opt-out', greeting: 'Saludo', unknown: 'Sin clasificar',
};

/**
 * AI Command Console — type or dictate a natural-language order. The backend
 * classifies the intent, routes it to the right Boostify module and replies.
 */
export function AICommandConsole({ center }: { center: TelegramCenter }) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const last = center.runCommand.data;

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    center.runCommand.mutate(v);
    setText('');
  };

  const dictate = () => {
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => setText(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true); rec.start();
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Sparkles className="h-5 w-5" />}
        title="AI Command Console"
        subtitle="Da órdenes en lenguaje natural. Boostify detecta la intención y ejecuta el módulo."
      />

      <GlassCard className="p-4">
        <div className="relative">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
            placeholder='Ej: "Hey Boostify, abre un canal VIP para mis fans"'
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-3 pr-12 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
          />
          <button
            onClick={dictate}
            title="Dictar"
            className={`absolute right-3 top-3 rounded-lg p-1.5 ${listening ? 'bg-rose-500/20 text-rose-300' : 'text-white/40 hover:text-white'}`}
          >
            <Mic className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-3 flex justify-end">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={submit}
            disabled={!text.trim() || center.runCommand.isPending}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {center.runCommand.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Ejecutar
          </motion.button>
        </div>
      </GlassCard>

      {/* Suggestions */}
      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => setText(s)}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-sky-400/40 hover:text-white"
          >
            {s}
          </button>
        ))}
      </div>

      {/* Last classification */}
      {last && (
        <GlassCard className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="h-4 w-4 text-sky-300" />
            <span className="rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-300">
              {INTENT_LABEL[last.classification?.intent] || last.classification?.intent}
            </span>
            <span className="text-xs text-white/40">
              {Math.round((last.classification?.confidence || 0) * 100)}% confianza
            </span>
          </div>
          <p className="text-sm text-white/85">{last.reply}</p>
          {last.classification?.moduleTarget && last.classification.moduleTarget !== 'none' && (
            <div className="mt-2 flex items-center gap-1 text-xs text-white/50">
              <ArrowRight className="h-3 w-3" /> Módulo: {last.classification.moduleTarget}
            </div>
          )}
        </GlassCard>
      )}

      {/* Command history */}
      {center.commands.length > 0 && (
        <GlassCard className="p-4">
          <h4 className="mb-3 text-sm font-semibold text-white/80">Historial de comandos</h4>
          <div className="space-y-2">
            {center.commands.slice(0, 12).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.03] px-3 py-2">
                <span className="truncate text-sm text-white/70">{c.rawText}</span>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-sky-300/80">
                  {INTENT_LABEL[c.intent] || c.intent}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
