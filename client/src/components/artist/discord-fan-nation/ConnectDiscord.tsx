import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plug, ExternalLink, CheckCircle2, Server, Loader2, ShieldCheck } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, Badge, StatusDot } from './shared';

export default function ConnectDiscord({ dc }: { dc: DiscordCenter }) {
  const [guilds, setGuilds] = useState<Array<{ id: string; name: string; icon?: string | null; owner?: boolean }>>([]);
  const [oauthCode, setOauthCode] = useState('');

  const handleConnectSim = async () => {
    const res = await dc.connectOAuth.mutateAsync({ simulated: true });
    setGuilds(res?.guilds || []);
  };
  const handleConnectReal = async () => {
    const res = await dc.connectOAuth.mutateAsync({ code: oauthCode.trim() });
    setGuilds(res?.guilds || []);
  };
  const handleInstall = async () => {
    const res = await dc.getInstallUrl.mutateAsync();
    if (res?.url) window.open(res.url, '_blank', 'noopener');
  };
  const selectGuild = (g: { id: string; name: string }) =>
    dc.connectGuild.mutate({ guildId: g.id, guildName: g.name });

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Plug className="h-5 w-5" />} title="Conecta tu servidor de Discord"
        subtitle="Autoriza el bot de Boostify y elige el servidor que quieres convertir en tu Fan Nation."
        action={<div className="flex items-center gap-2 text-xs text-white/55"><StatusDot active={dc.connected} />{dc.connected ? 'Conectado' : 'Sin conectar'}</div>} />

      {dc.simulated && (
        <Badge tone="amber">Modo simulación · configura las credenciales de Discord para producción</Badge>
      )}

      {dc.connected && dc.guild ? (
        <GlassCard className="flex items-center gap-4 p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#a5adfb]">
            <Server className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="truncate text-base font-semibold text-white">{dc.guild.guildName}</h4>
              <Badge tone={dc.guild.botInstalled ? 'emerald' : 'rose'}>{dc.guild.botInstalled ? 'Bot activo' : 'Bot sin permisos'}</Badge>
            </div>
            <p className="text-sm text-white/55">{dc.guild.memberCount ?? 0} miembros · estado: {dc.guild.status}</p>
          </div>
          <CheckCircle2 className="h-6 w-6 text-emerald-400" />
        </GlassCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <GlassCard className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-[#a5adfb]" /> 1 · Instala el bot</div>
            <p className="text-sm text-white/55">Abre Discord y autoriza el bot de Boostify con los permisos mínimos necesarios.</p>
            <DCButton onClick={handleInstall} disabled={dc.getInstallUrl.isPending}>
              {dc.getInstallUrl.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              Instalar bot en Discord
            </DCButton>
          </GlassCard>
          <GlassCard className="space-y-3 p-5">
            <div className="flex items-center gap-2 text-sm font-semibold text-white"><Plug className="h-4 w-4 text-[#a5adfb]" /> 2 · Conecta tu cuenta</div>
            <p className="text-sm text-white/55">Pega el código OAuth devuelto por Discord, o prueba el flujo en modo demo.</p>
            <DCInput placeholder="Código OAuth (opcional)" value={oauthCode} onChange={(e) => setOauthCode(e.target.value)} />
            <div className="flex gap-2">
              <DCButton onClick={handleConnectReal} disabled={dc.connectOAuth.isPending || !oauthCode.trim()}>
                {dc.connectOAuth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Conectar
              </DCButton>
              <DCButton variant="ghost" onClick={handleConnectSim} disabled={dc.connectOAuth.isPending}>Probar demo</DCButton>
            </div>
          </GlassCard>
        </div>
      )}

      {guilds.length > 0 && !dc.connected && (
        <GlassCard className="space-y-2 p-5">
          <h4 className="text-sm font-semibold text-white">Elige un servidor</h4>
          <div className="grid gap-2 sm:grid-cols-2">
            {guilds.map((g) => (
              <motion.button key={g.id} whileHover={{ scale: 1.02 }} onClick={() => selectGuild(g)}
                className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3 text-left hover:border-[#5865F2]/50">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#5865F2]/15 text-[#a5adfb]"><Server className="h-4 w-4" /></div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-white">{g.name}</div>
                  {g.owner && <div className="text-[11px] text-white/45">Propietario</div>}
                </div>
              </motion.button>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
