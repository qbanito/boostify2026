import { Crown, Gem, Lock, Sparkles } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, Badge, StatTile, RoleBadge, fmtMoney } from './shared';

export default function VIPAccess({ dc }: { dc: DiscordCenter }) {
  const vipMembers = dc.members.filter((m) => m.isVip || (m.tier && m.tier !== 'Fan'));
  const vipRoles = dc.roles.filter((r) => r.accessLevel === 'vip' || r.accessLevel === 'token' || /vip|super|founder|btf/i.test(r.roleName));
  const vipRevenue = vipMembers.reduce((s, m) => s + (m.totalSpent || 0), 0);

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Crown className="h-5 w-5" />} title="Acceso VIP"
        subtitle="Tus fans de mayor valor y los canales/roles exclusivos que desbloquean." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Fans VIP" value={vipMembers.length} accent="blurple" />
        <StatTile label="Roles exclusivos" value={vipRoles.length} accent="fuchsia" />
        <StatTile label="Ingresos VIP" value={fmtMoney(vipRevenue)} accent="emerald" />
        <StatTile label="Retención VIP" value={`${dc.analytics?.vipRetention ?? 0}%`} accent="amber" />
      </div>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Gem className="h-4 w-4 text-fuchsia-300" /> Roles que dan acceso premium</div>
        {vipRoles.length > 0 ? (
          <div className="flex flex-wrap gap-2">{vipRoles.map((r) => <RoleBadge key={r.roleId} name={r.roleName} color={r.color} />)}</div>
        ) : (
          <p className="text-sm text-white/50">Crea un rol VIP en el Gestor de roles o usa la pestaña BTF Token Gate para gating automático.</p>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Sparkles className="h-4 w-4 text-[#a5adfb]" /> Miembros VIP</div>
        {vipMembers.length > 0 ? (
          <div className="space-y-2">
            {vipMembers.slice(0, 15).map((m) => (
              <div key={m.discordUserId} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-fuchsia-500/15 text-fuchsia-300 text-xs font-bold">
                    {(m.username || 'F').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm text-white/90">{m.username || m.discordUserId}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="amber">{(m.btfBalance || 0).toLocaleString()} $BTF</Badge>
                  <Badge tone="emerald">{fmtMoney(m.totalSpent || 0)}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-sm text-white/50"><Lock className="h-4 w-4" /> Aún no hay miembros VIP. Importa fans o conéctalos vía token gate.</div>
        )}
      </GlassCard>
    </div>
  );
}
