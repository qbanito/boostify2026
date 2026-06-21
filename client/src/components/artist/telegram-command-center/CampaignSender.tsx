import { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Loader2, ShieldCheck, BarChart3, Link2 } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader } from './shared';

const SEGMENT_OPTIONS = [
  { value: 'all', label: 'Todos los fans' },
  { value: 'vip', label: 'Fans VIP' },
  { value: 'buyers', label: 'Compradores' },
  { value: 'top', label: 'Top supporters' },
  { value: 'new', label: 'Fans nuevos' },
  { value: 'city', label: 'Por ciudad' },
];

/**
 * Campaign Sender — broadcast a message to a segment with safe pacing + consent.
 * Backend skips opted-out subscribers and rate-limits sends to avoid bans.
 * Optional inline button (text + url) is attached to every broadcast.
 */
export function CampaignSender({ center }: { center: TelegramCenter }) {
  const [name, setName] = useState('');
  const [segment, setSegment] = useState('all');
  const [city, setCity] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [btnText, setBtnText] = useState('');
  const [btnUrl, setBtnUrl] = useState('');

  const send = () => {
    if (!message.trim()) return;
    const buttons = btnText.trim() && btnUrl.trim() ? [{ text: btnText.trim(), url: btnUrl.trim() }] : undefined;
    center.sendCampaign.mutate({
      name: name.trim() || 'Campaña', segment, city: segment === 'city' ? city.trim() : undefined,
      message: message.trim(), mediaUrl: mediaUrl.trim() || undefined, buttons,
    });
    setMessage('');
  };

  return (
    <div className="space-y-5">
      <PanelHeader
        icon={<Megaphone className="h-5 w-5" />}
        title="Campañas"
        subtitle="Envía mensajes masivos por segmento, con consentimiento y límites seguros."
      />

      <GlassCard className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Nombre de la campaña"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
          />
          <select
            value={segment} onChange={(e) => setSegment(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white focus:border-sky-400/50 focus:outline-none"
          >
            {SEGMENT_OPTIONS.map((s) => <option key={s.value} value={s.value} className="bg-[#0b0f14]">{s.label}</option>)}
          </select>
        </div>
        {segment === 'city' && (
          <input
            value={city} onChange={(e) => setCity(e.target.value)}
            placeholder="Ciudad (ej. CDMX)"
            className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
          />
        )}
        <textarea
          value={message} onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="Mensaje de la campaña… incluye tu smart link 🔗"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
        />
        <input
          value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)}
          placeholder="URL de imagen/poster (opcional)"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
            <input
              value={btnText} onChange={(e) => setBtnText(e.target.value)}
              placeholder="Texto del botón (opcional)"
              className="w-full rounded-xl border border-white/10 bg-black/40 py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
            />
          </div>
          <input
            value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)}
            placeholder="URL del botón (opcional)"
            className="rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200/80">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Solo se envía a fans con consentimiento. Quienes escriban /stop / SALIR / CANCELAR quedan fuera automáticamente.
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={send}
          disabled={!center.isConnected || !message.trim() || center.sendCampaign.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {center.sendCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Enviar campaña
        </motion.button>
      </GlassCard>

      {/* Campaign history */}
      <GlassCard className="p-4">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-white/80">
          <BarChart3 className="h-4 w-4 text-sky-300" /> Campañas recientes
        </h4>
        {center.campaigns.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Todavía no has enviado campañas.</p>
        ) : (
          <div className="space-y-2">
            {center.campaigns.map((c) => (
              <div key={c.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{c.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${
                    c.status === 'completed' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
                  }`}>{c.status}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/50">
                  <span>Segmento: {c.segment}</span>
                  <span>Enviados: {c.sentCount}/{c.targetCount ?? c.sentCount}</span>
                  <span>Respuestas: {c.responseCount}</span>
                  <span>Ingresos: ${c.revenue?.toFixed?.(2) ?? '0.00'}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
