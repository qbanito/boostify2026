import { useState } from 'react';
import { Shield, Plus, Loader2, UserPlus } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, RoleBadge, Badge, EmptyState } from './shared';

const COLOR_OPTIONS = [
  { label: 'Blurple', value: 0x5865f2 }, { label: 'Fuchsia', value: 0xeb459e }, { label: 'Verde', value: 0x57f287 },
  { label: 'Oro', value: 0xf1c40f }, { label: 'Rojo', value: 0xe74c3c }, { label: 'Gris', value: 0x95a5a6 },
];

export default function RoleManager({ dc }: { dc: DiscordCenter }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(0x5865f2);
  const [accessLevel, setAccessLevel] = useState('free');

  const create = () => {
    if (!name.trim()) return;
    dc.createRole.mutate({ name: name.trim(), color, accessLevel });
    setName('');
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Shield className="h-5 w-5" />} title="Gestor de roles"
        subtitle="Crea y administra los roles que definen el acceso de tus fans." />

      <GlassCard className="space-y-3 p-5">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <DCInput placeholder="Nombre del rol (ej. VIP Fan)" value={name} onChange={(e) => setName(e.target.value)} />
          <DCButton onClick={create} disabled={!name.trim() || !dc.connected || dc.createRole.isPending}>
            {dc.createRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear rol
          </DCButton>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] uppercase tracking-wide text-white/40">Color</span>
          {COLOR_OPTIONS.map((c) => (
            <button key={c.value} onClick={() => setColor(c.value)}
              className={`h-6 w-6 rounded-full border-2 transition ${color === c.value ? 'border-white' : 'border-transparent'}`}
              style={{ backgroundColor: `#${c.value.toString(16).padStart(6, '0')}` }} title={c.label} />
          ))}
          <span className="ml-3 text-[11px] uppercase tracking-wide text-white/40">Acceso</span>
          {['free', 'vip', 'token', 'staff'].map((a) => (
            <button key={a} onClick={() => setAccessLevel(a)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium capitalize transition ${accessLevel === a ? 'bg-[#5865F2] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{a}</button>
          ))}
        </div>
      </GlassCard>

      {dc.roles.length > 0 ? (
        <GlassCard className="p-5">
          <h4 className="mb-3 text-sm font-semibold text-white">Roles activos · {dc.roles.length}</h4>
          <div className="space-y-2">
            {dc.roles.map((r) => (
              <div key={r.roleId} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <RoleBadge name={r.roleName} color={r.color} />
                <div className="flex items-center gap-2">
                  <Badge tone="slate">{r.accessLevel}</Badge>
                  <Badge tone="blurple">{r.ruleType}</Badge>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <EmptyState icon={<UserPlus className="h-6 w-6" />} title="Aún no hay roles"
          hint="Crea roles o ejecuta el asistente de configuración para generar la jerarquía recomendada." />
      )}
    </div>
  );
}
