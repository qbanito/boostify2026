import { useState } from 'react';
import { Radio, Send, Loader2, Hash } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCTextarea, Badge, StatusDot } from './shared';

export default function LiveChatPanel({ dc }: { dc: DiscordCenter }) {
  const [channelId, setChannelId] = useState('');
  const [message, setMessage] = useState('');

  const liveChannel = dc.channels.find((c) => /live|event/i.test(c.name));
  const targetChannel = channelId || liveChannel?.channelId || '';

  const announce = () => {
    if (!targetChannel || !message.trim()) return;
    dc.sendCampaign.mutate({ name: 'Live update', channelId: targetChannel, message: message.trim() }, { onSuccess: () => setMessage('') });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Radio className="h-5 w-5" />} title="Live Chat"
        subtitle="Conecta tu transmisión en vivo y empuja mensajes al chat de Discord en tiempo real."
        action={<div className="flex items-center gap-2 text-xs text-white/55"><StatusDot active={dc.connected} />{dc.connected ? 'Listo' : 'Sin conectar'}</div>} />

      <GlassCard className="space-y-3 p-5">
        <div className="flex items-center gap-2 text-sm text-white/70">
          <Hash className="h-4 w-4 text-[#a5adfb]" />
          Canal de directo:
          <select value={targetChannel} onChange={(e) => setChannelId(e.target.value)}
            className="rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-sm text-white outline-none focus:border-[#5865F2]/60">
            <option value="">Selecciona…</option>
            {dc.channels.map((c) => <option key={c.channelId} value={c.channelId}>#{c.name}</option>)}
          </select>
          {liveChannel && <Badge tone="emerald">auto: #{liveChannel.name}</Badge>}
        </div>
        <DCTextarea rows={3} placeholder="Mensaje para el chat en vivo (ej. '¡Empezamos en 5 minutos! 🎶')" value={message} onChange={(e) => setMessage(e.target.value)} />
        <DCButton onClick={announce} disabled={!targetChannel || !message.trim() || dc.sendCampaign.isPending}>
          {dc.sendCampaign.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Enviar al chat en vivo
        </DCButton>
      </GlassCard>

      <GlassCard className="p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">Cómo funciona</h4>
        <ul className="space-y-2 text-sm text-white/55">
          <li className="flex gap-2"><span className="text-[#a5adfb]">1.</span> Inicia tu live (HoloStage, YouTube, Twitch o lo que uses).</li>
          <li className="flex gap-2"><span className="text-[#a5adfb]">2.</span> Empuja avisos y enlaces al canal #live-events para llevar a tus fans al stream.</li>
          <li className="flex gap-2"><span className="text-[#a5adfb]">3.</span> El bot modera el chat automáticamente mientras estás en vivo (pestaña AI Moderator).</li>
        </ul>
      </GlassCard>
    </div>
  );
}
