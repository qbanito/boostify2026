import { useState } from 'react';
import { Gift, Loader2, Trophy, Plus } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, Badge, RoleBadge, EmptyState, timeAgo } from './shared';

const REWARD_TYPES = [
  { value: 'role', label: 'Rol' }, { value: 'token', label: '$BTF' },
  { value: 'merch', label: 'Merch' }, { value: 'ticket', label: 'Entrada' }, { value: 'shoutout', label: 'Shoutout' },
];

export default function RewardsCenter({ dc }: { dc: DiscordCenter }) {
  const [name, setName] = useState('');
  const [type, setType] = useState('role');
  const [roleId, setRoleId] = useState('');
  const [topCount, setTopCount] = useState(10);

  const createReward = () => {
    if (!name.trim()) return;
    dc.createReward.mutate({ name: name.trim(), type, roleId: roleId || undefined, trigger: 'manual' }, { onSuccess: () => setName('') });
  };
  const rewardTop = () => dc.rewardTopFans.mutate({ count: topCount, roleId: roleId || undefined });

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Gift className="h-5 w-5" />} title="Centro de recompensas"
        subtitle="Premia la lealtad: roles, tokens, merch y entradas para tus fans más activos." />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-5">
          <h4 className="text-sm font-semibold text-white">Nueva recompensa</h4>
          <DCInput placeholder="Nombre (ej. Pase VIP backstage)" value={name} onChange={(e) => setName(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {REWARD_TYPES.map((t) => (
              <button key={t.value} onClick={() => setType(t.value)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${type === t.value ? 'bg-[#5865F2] text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}>{t.label}</button>
            ))}
          </div>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#5865F2]/60">
            <option value="">Rol a otorgar (opcional)…</option>
            {dc.roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
          </select>
          <DCButton onClick={createReward} disabled={!name.trim() || dc.createReward.isPending} className="w-full">
            {dc.createReward.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Crear recompensa
          </DCButton>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><Trophy className="h-4 w-4 text-amber-300" /> Premiar a los top fans</div>
          <p className="text-sm text-white/55">Otorga un rol de golpe a tus fans más activos según su engagement.</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-white/50">Top</span>
            <DCInput type="number" min={1} max={50} value={topCount} onChange={(e) => setTopCount(Number(e.target.value))} className="w-20" />
            <span className="text-xs text-white/50">fans</span>
          </div>
          <DCButton onClick={rewardTop} disabled={dc.rewardTopFans.isPending} className="w-full">
            {dc.rewardTopFans.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trophy className="h-4 w-4" />} Recompensar top {topCount}
          </DCButton>
          {!roleId && <p className="text-[11px] text-amber-300/80">Elige un rol arriba para asignarlo automáticamente.</p>}
        </GlassCard>
      </div>

      <GlassCard className="p-5">
        <h4 className="mb-3 text-sm font-semibold text-white">Recompensas activas</h4>
        {dc.rewards.length > 0 ? (
          <div className="space-y-2">
            {dc.rewards.slice(0, 10).map((r) => {
              const role = dc.roles.find((x) => x.roleId === r.roleId);
              return (
                <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Gift className="h-4 w-4 text-[#a5adfb]" />
                    <span className="text-sm text-white/90">{r.name}</span>
                    {role && <RoleBadge name={role.roleName} color={role.color} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="blurple">{r.type}</Badge>
                    <Badge tone={r.status === 'active' || r.status === 'granted' ? 'emerald' : 'slate'}>{r.status}</Badge>
                    <span className="text-[11px] text-white/40">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={<Gift className="h-6 w-6" />} title="Sin recompensas aún" hint="Crea recompensas para incentivar la actividad de tu comunidad." />
        )}
      </GlassCard>
    </div>
  );
}
