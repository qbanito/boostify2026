import { ReactNode, useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Loader2 } from 'lucide-react';
import type { WhatsAppCenter } from '../../../hooks/use-whatsapp-center';

/** Glassmorphism card used across every panel. */
export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] ${className}`}
    >
      {children}
    </div>
  );
}

/** Connection status dot — green when connected, red otherwise. */
export function StatusDot({ connected }: { connected: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {connected && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
      )}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-rose-500'}`} />
    </span>
  );
}

/** Small KPI tile. */
const ACCENT_TEXT: Record<string, string> = {
  emerald: 'text-emerald-300', amber: 'text-amber-300', sky: 'text-sky-300',
  violet: 'text-violet-300', rose: 'text-rose-300',
};
export function StatTile({ label, value, accent = 'emerald' }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <GlassCard className="p-4">
      <div className={`text-2xl font-bold ${ACCENT_TEXT[accent] || ACCENT_TEXT.emerald}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/50">{label}</div>
    </GlassCard>
  );
}

export function PanelHeader({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-300">
        {icon}
      </div>
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/55">{subtitle}</p>}
      </div>
    </div>
  );
}

/**
 * ConciergeComposer — reusable "send a message to one fan/contact" form used by
 * the Tickets, Merch, Booking, Live Gifts and Wallet concierge panels.
 */
export function ConciergeComposer({
  center, placeholder, defaultMessage = '', ctaLabel = 'Enviar por WhatsApp',
}: {
  center: WhatsAppCenter; placeholder: string; defaultMessage?: string; ctaLabel?: string;
}) {
  const [to, setTo] = useState('');
  const [message, setMessage] = useState(defaultMessage);
  const [mediaUrl, setMediaUrl] = useState('');
  const disabled = !center.isConnected || !to.trim() || !message.trim();

  const onSend = () => {
    if (disabled) return;
    if (mediaUrl.trim()) {
      center.sendMedia.mutate({ to: to.trim(), mediaUrl: mediaUrl.trim(), caption: message.trim() });
    } else {
      center.sendMessage.mutate({ to: to.trim(), message: message.trim() });
    }
  };

  const pending = center.sendMessage.isPending || center.sendMedia.isPending;

  return (
    <div className="space-y-3">
      <input
        value={to}
        onChange={(e) => setTo(e.target.value)}
        placeholder="Número del fan (ej. 521555…)"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
      />
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
      />
      <input
        value={mediaUrl}
        onChange={(e) => setMediaUrl(e.target.value)}
        placeholder="URL de imagen/media (opcional)"
        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
      />
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={onSend}
        disabled={disabled || pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 px-4 py-3 text-sm font-semibold text-black transition disabled:opacity-40"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {ctaLabel}
      </motion.button>
      {!center.isConnected && (
        <p className="text-center text-xs text-amber-300/80">Conecta WhatsApp para enviar mensajes.</p>
      )}
    </div>
  );
}
