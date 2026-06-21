import { Users, Trophy, Upload, Loader2 } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, StatTile, TierBadge, Badge, Metric, EmptyState, DCButton, fmtMoney, fmtCompact } from './shared';

export default function FanCommunity({ dc }: { dc: DiscordCenter }) {
  const seedDemo = () => {
    const names = ['LunaWave', 'BeatHunter', 'VinylSoul', 'NeonRider', 'EchoFan', 'MidnightMia', 'BassDrop', 'SkylarV', 'RhythmKid', 'VioletNova'];
    const members = names.map((n, i) => ({
      discordUserId: `demo-${i}-${Date.now()}`, username: n, isVip: i < 3,
      btfBalance: Math.round((10 - i) * 420 + Math.random() * 300),
      totalSpent: Math.round((10 - i) * 18 + Math.random() * 40),
      messagesCount: Math.round((10 - i) * 30 + Math.random() * 60),
      joinedAt: Date.now() - i * 86400000, lastActiveAt: Date.now() - i * 3600000,
    }));
    dc.importMembers.mutate(members);
  };

  const top = dc.topFans;
  const maxScore = Math.max(100, ...top.map((m) => m.score || 0));

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Users className="h-5 w-5" />} title="Fan Community"
        subtitle="Ranking de tus fans más activos y valiosos, listos para recompensar."
        action={<DCButton variant="ghost" onClick={seedDemo} disabled={dc.importMembers.isPending}>
          {dc.importMembers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Cargar fans demo
        </DCButton>} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Miembros" value={fmtCompact(dc.memberTotal)} accent="blurple" />
        <StatTile label="Activos" value={dc.analytics?.activeMembers ?? 0} accent="emerald" />
        <StatTile label="Nuevos (30d)" value={dc.analytics?.newMembers ?? 0} accent="sky" />
        <StatTile label="ARPU" value={fmtMoney(dc.analytics?.arpu ?? 0)} accent="amber" />
      </div>

      {top.length > 0 ? (
        <GlassCard className="p-5">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white"><Trophy className="h-4 w-4 text-amber-300" /> Top fans</div>
          <div className="space-y-2.5">
            {top.map((m, i) => (
              <div key={m.discordUserId} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${i < 3 ? 'bg-amber-400/20 text-amber-300' : 'bg-white/5 text-white/50'}`}>{i + 1}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-white">{m.username || m.discordUserId}</span>
                    <TierBadge tier={m.tier} />
                  </div>
                  <div className="mt-1"><Metric label="Engagement" value={m.score || 0} max={maxScore} tone={i < 3 ? 'fuchsia' : 'blurple'} /></div>
                </div>
                <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <Badge tone="amber">{fmtCompact(m.btfBalance || 0)} $BTF</Badge>
                  <Badge tone="emerald">{fmtMoney(m.totalSpent || 0)}</Badge>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      ) : (
        <EmptyState icon={<Users className="h-6 w-6" />} title="Aún no hay datos de fans"
          hint="Importa tu comunidad o deja que el bot registre la actividad. Usa 'Cargar fans demo' para previsualizar el ranking." />
      )}
    </div>
  );
}
