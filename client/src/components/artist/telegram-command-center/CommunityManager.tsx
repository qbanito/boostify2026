import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Plus, Link2, Copy, Check, Info } from 'lucide-react';
import type { TelegramCenter } from '../../../hooks/use-telegram-center';
import { GlassCard, PanelHeader } from './shared';

/**
 * CommunityManager — shared UI for Telegram channels and VIP groups. The
 * Telegram Bot API cannot CREATE channels/groups (that needs a user account),
 * so the flow is: the artist creates the channel/group in Telegram, adds the
 * bot as admin, pastes the chatId here, and we register it + mint an invite link.
 */
export function CommunityManager({
  center, type, icon, title, subtitle, kindLabel,
}: {
  center: TelegramCenter;
  type: 'channel' | 'group';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  kindLabel: string;
}) {
  const [name, setName] = useState('');
  const [chatId, setChatId] = useState('');
  const [description, setDescription] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const communities = center.communities.filter((c) => c.type === type);

  const create = () => {
    if (!name.trim()) return;
    center.createCommunity.mutate({ type, name: name.trim(), chatId: chatId.trim() || undefined, description: description.trim() || undefined });
    setName(''); setChatId(''); setDescription('');
  };

  const copy = (link: string, id: string) => {
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    }).catch(() => {});
  };

  return (
    <div className="space-y-5">
      <PanelHeader icon={icon} title={title} subtitle={subtitle} />

      <GlassCard className="space-y-3 p-4">
        <input
          value={name} onChange={(e) => setName(e.target.value)}
          placeholder={`Nombre del ${kindLabel}`}
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
        />
        <input
          value={chatId} onChange={(e) => setChatId(e.target.value)}
          placeholder="chatId donde el bot es admin (ej. -1001234567890) — opcional"
          className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
        />
        <textarea
          value={description} onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Descripción (opcional)"
          className="w-full resize-none rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-sky-400/50 focus:outline-none"
        />
        <div className="flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/5 p-3 text-xs text-sky-200/80">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Crea el {kindLabel} en Telegram, añade tu bot como administrador y pega su chatId para generar el link de invitación automáticamente.
        </div>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={create}
          disabled={!center.isConnected || !name.trim() || center.createCommunity.isPending}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-40"
        >
          {center.createCommunity.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Registrar {kindLabel}
        </motion.button>
      </GlassCard>

      <GlassCard className="p-4">
        <h4 className="mb-3 text-sm font-semibold text-white/80">Tus {title.toLowerCase()}</h4>
        {communities.length === 0 ? (
          <p className="py-4 text-center text-sm text-white/40">Aún no tienes {kindLabel}s registrados.</p>
        ) : (
          <div className="space-y-2">
            {communities.map((c) => (
              <div key={c.id} className="rounded-xl bg-white/[0.03] p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-white">{c.name}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] ${
                    c.status === 'active' ? 'bg-sky-500/15 text-sky-300' : 'bg-amber-500/15 text-amber-300'
                  }`}>{c.status}</span>
                </div>
                {c.description && <p className="mt-1 text-xs text-white/50">{c.description}</p>}
                {c.inviteLink ? (
                  <div className="mt-2 flex items-center gap-2">
                    <a
                      href={c.inviteLink} target="_blank" rel="noreferrer"
                      className="flex min-w-0 items-center gap-1.5 truncate text-xs text-sky-300 hover:text-sky-200"
                    >
                      <Link2 className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{c.inviteLink}</span>
                    </a>
                    <button
                      onClick={() => copy(c.inviteLink!, c.id)}
                      className="shrink-0 rounded-lg border border-white/10 bg-white/5 p-1.5 text-white/60 hover:text-white"
                      title="Copiar link"
                    >
                      {copied === c.id ? <Check className="h-3.5 w-3.5 text-sky-300" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  c.note && <p className="mt-2 text-[11px] text-amber-200/70">{c.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
