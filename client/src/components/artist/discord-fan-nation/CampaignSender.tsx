import { useState } from 'react';
import { Send, Loader2, Megaphone, Link2, Image as ImageIcon } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, DCTextarea, Badge, EmptyState, timeAgo, fmtCompact } from './shared';

export default function CampaignSender({ dc }: { dc: DiscordCenter }) {
  const [channelId, setChannelId] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [btnLabel, setBtnLabel] = useState('');
  const [btnUrl, setBtnUrl] = useState('');

  const channels = dc.channels;
  const canSend = !!channelId && message.trim().length > 0 && !dc.sendCampaign.isPending;

  const send = () => {
    const buttons = btnLabel.trim() && btnUrl.trim() ? [{ label: btnLabel.trim(), url: btnUrl.trim() }] : undefined;
    dc.sendCampaign.mutate({ name: name.trim() || 'Campaña', channelId, message: message.trim(), mediaUrl: mediaUrl.trim() || undefined, buttons }, {
      onSuccess: () => { setMessage(''); setMediaUrl(''); setBtnLabel(''); setBtnUrl(''); setName(''); },
    });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Megaphone className="h-5 w-5" />} title="Enviar campaña"
        subtitle="Difunde drops, lanzamientos y promos a tu comunidad con botones de acción." />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-5">
          <DCInput placeholder="Nombre de la campaña" value={name} onChange={(e) => setName(e.target.value)} />
          <select value={channelId} onChange={(e) => setChannelId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#5865F2]/60">
            <option value="">Selecciona un canal…</option>
            {channels.map((c) => <option key={c.channelId} value={c.channelId}>#{c.name}</option>)}
          </select>
          <DCTextarea rows={4} placeholder="Tu mensaje… (soporta markdown de Discord)" value={message} onChange={(e) => setMessage(e.target.value)} />
          <div className="flex items-center gap-2"><ImageIcon className="h-4 w-4 text-white/40" /><DCInput placeholder="URL de imagen (opcional)" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <DCInput placeholder="Texto del botón" value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} />
            <div className="flex items-center gap-1.5"><Link2 className="h-4 w-4 text-white/40" /><DCInput placeholder="URL del botón" value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} /></div>
          </div>
          <DCButton onClick={send} disabled={!canSend} className="w-full">
            {dc.sendCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar campaña
          </DCButton>
          {!channels.length && <p className="text-xs text-amber-300/80">Crea canales primero (asistente de configuración).</p>}
        </GlassCard>

        <GlassCard className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-white">Campañas recientes</h4>
          {dc.campaigns.length > 0 ? (
            <div className="space-y-2">
              {dc.campaigns.slice(0, 8).map((c) => (
                <div key={c.id} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-white">{c.name}</span>
                    <Badge tone={c.status === 'sent' ? 'emerald' : 'rose'}>{c.status}</Badge>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-white/55">{c.message}</p>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-white/45">
                    <span>{timeAgo(c.sentAt || 0)}</span>
                    <span>{fmtCompact(c.clickCount || 0)} clics</span>
                    <span>{fmtCompact(c.conversionCount || 0)} conv.</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={<Megaphone className="h-6 w-6" />} title="Sin campañas aún" hint="Tu primera campaña aparecerá aquí." />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
