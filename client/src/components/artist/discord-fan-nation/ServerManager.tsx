import { Hash, Megaphone, Mic, Sparkles, Loader2, Wand2, Plus } from 'lucide-react';
import { useState } from 'react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, Badge, RoleBadge, EmptyState } from './shared';

const RECOMMENDED_CHANNELS = [
  { name: 'announcements', type: 'announcement', description: 'Drops & noticias oficiales' },
  { name: 'new-releases', type: 'text', description: 'Cada nueva canción, video y proyecto' },
  { name: 'vip-fans', type: 'text', description: 'Sala privada para VIP & Super Fans' },
  { name: 'general-chat', type: 'text', description: 'Convive con la comunidad' },
  { name: 'ticket-support', type: 'text', description: 'Ayuda con entradas y pases' },
  { name: 'merch-drops', type: 'text', description: 'Merch limitado y restocks' },
  { name: 'live-events', type: 'text', description: 'Watch parties, lives y Q&As' },
  { name: 'btf-holders', type: 'text', description: 'Canal token-gated para holders de $BTF' },
  { name: 'backstage', type: 'text', description: 'Contenido tras bambalinas' },
  { name: 'fan-challenges', type: 'text', description: 'Misiones, concursos y giveaways' },
];
const RECOMMENDED_ROLES = [
  { name: 'Fan', color: 0x95a5a6 }, { name: 'VIP Fan', color: 0x5865f2 }, { name: 'Super Fan', color: 0xeb459e },
  { name: 'BTF Holder', color: 0xf1c40f }, { name: 'Ticket Buyer', color: 0x57f287 }, { name: 'Merch Buyer', color: 0xe67e22 },
  { name: 'Moderator', color: 0x3498db }, { name: 'Artist Team', color: 0x9b59b6 }, { name: 'Founder Fan', color: 0xe74c3c },
];

function channelIcon(type: string) {
  if (type === 'announcement') return <Megaphone className="h-4 w-4" />;
  if (type === 'voice' || type === 'stage') return <Mic className="h-4 w-4" />;
  return <Hash className="h-4 w-4" />;
}

export default function ServerManager({ dc }: { dc: DiscordCenter }) {
  const [newChannel, setNewChannel] = useState('');
  const hasStructure = dc.channels.length > 0 || dc.roles.length > 0;

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Wand2 className="h-5 w-5" />} title="Asistente de configuración del servidor"
        subtitle="Crea de golpe la estructura recomendada de canales y roles para una Fan Nation premium."
        action={<DCButton onClick={() => dc.setupServer.mutate({})} disabled={!dc.connected || dc.setupServer.isPending}>
          {dc.setupServer.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Crear estructura recomendada
        </DCButton>} />

      {!dc.connected && <Badge tone="amber">Conecta un servidor primero para ejecutar el asistente.</Badge>}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Channels */}
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Canales {dc.channels.length > 0 && <span className="text-white/40">· {dc.channels.length}</span>}</h4>
          </div>
          <div className="mb-3 flex gap-2">
            <DCInput placeholder="nombre-de-canal" value={newChannel} onChange={(e) => setNewChannel(e.target.value)} />
            <DCButton variant="ghost" disabled={!newChannel.trim() || !dc.connected || dc.createChannel.isPending}
              onClick={() => { dc.createChannel.mutate({ name: newChannel.trim().toLowerCase().replace(/\s+/g, '-') }); setNewChannel(''); }}>
              <Plus className="h-4 w-4" />
            </DCButton>
          </div>
          <div className="space-y-1.5">
            {(dc.channels.length > 0 ? dc.channels : RECOMMENDED_CHANNELS).map((ch: any, i) => (
              <div key={ch.channelId || i} className="flex items-center gap-2.5 rounded-lg border border-white/8 bg-white/[0.03] px-3 py-2">
                <span className="text-[#a5adfb]">{channelIcon(ch.type)}</span>
                <span className="text-sm font-medium text-white/90">{ch.name}</span>
                <span className="truncate text-[11px] text-white/40">{ch.description}</span>
                {!dc.channels.length && <Badge tone="slate">sugerido</Badge>}
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Roles */}
        <GlassCard className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-white">Roles {dc.roles.length > 0 && <span className="text-white/40">· {dc.roles.length}</span>}</h4>
          <div className="flex flex-wrap gap-2">
            {(dc.roles.length > 0
              ? dc.roles.map((r) => ({ name: r.roleName, color: r.color }))
              : RECOMMENDED_ROLES
            ).map((r, i) => <RoleBadge key={i} name={r.name} color={r.color} />)}
          </div>
          {!dc.roles.length && <p className="mt-3 text-xs text-white/45">Roles sugeridos · se crean al ejecutar el asistente.</p>}
        </GlassCard>
      </div>

      {!hasStructure && dc.connected && (
        <EmptyState icon={<Wand2 className="h-6 w-6" />} title="Tu servidor está vacío"
          hint="Ejecuta el asistente para crear 10 canales y 9 roles optimizados para convertir fans en compradores." />
      )}
    </div>
  );
}
