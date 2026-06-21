import { useState } from 'react';
import { Coins, Loader2, ShieldCheck, Save } from 'lucide-react';
import type { DiscordCenter } from '../../../hooks/use-discord-nation';
import { GlassCard, PanelHeader, DCButton, DCInput, Badge } from './shared';

export default function BTFTokenGate({ dc }: { dc: DiscordCenter }) {
  const gate = dc.config?.tokenGate;
  const [minBtf, setMinBtf] = useState(gate?.minBtf ?? 1000);
  const [minSpent, setMinSpent] = useState(gate?.minSpent ?? 0);
  const [requireVip, setRequireVip] = useState(gate?.requireVip ?? false);
  const [roleId, setRoleId] = useState(gate?.roleId ?? '');
  const [testUser, setTestUser] = useState('');
  const [testBtf, setTestBtf] = useState(1000);
  const [testResult, setTestResult] = useState<{ qualifies: boolean; roleAssigned: boolean } | null>(null);

  const save = () => dc.saveConfig.mutate({ tokenGate: { minBtf, minSpent, requireVip, roleId: roleId || null } });
  const test = async () => {
    if (!testUser.trim()) return;
    const r = await dc.verifyTokenGate.mutateAsync({ userId: testUser.trim(), btfBalance: testBtf, isVip: false });
    setTestResult({ qualifies: !!r?.qualifies, roleAssigned: !!r?.roleAssigned });
  };

  return (
    <div className="space-y-4">
      <PanelHeader icon={<Coins className="h-5 w-5" />} title="BTF Token Gate"
        subtitle="Desbloquea canales y roles exclusivos sólo para holders de $BTF y compradores." />

      <div className="grid gap-4 lg:grid-cols-2">
        <GlassCard className="space-y-3 p-5">
          <h4 className="text-sm font-semibold text-white">Reglas de acceso</h4>
          <label className="block text-[11px] uppercase tracking-wide text-white/40">Mínimo de $BTF</label>
          <DCInput type="number" min={0} value={minBtf} onChange={(e) => setMinBtf(Number(e.target.value))} />
          <label className="block text-[11px] uppercase tracking-wide text-white/40">Gasto mínimo ($)</label>
          <DCInput type="number" min={0} value={minSpent} onChange={(e) => setMinSpent(Number(e.target.value))} />
          <label className="flex items-center gap-2 text-sm text-white/70">
            <input type="checkbox" checked={requireVip} onChange={(e) => setRequireVip(e.target.checked)} className="accent-[#5865F2]" />
            Requerir estatus VIP
          </label>
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-[#5865F2]/60">
            <option value="">Rol a otorgar al calificar…</option>
            {dc.roles.map((r) => <option key={r.roleId} value={r.roleId}>{r.roleName}</option>)}
          </select>
          <DCButton onClick={save} disabled={dc.saveConfig.isPending} className="w-full">
            {dc.saveConfig.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Guardar reglas
          </DCButton>
        </GlassCard>

        <GlassCard className="space-y-3 p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-white"><ShieldCheck className="h-4 w-4 text-[#a5adfb]" /> Verificar un fan</div>
          <DCInput placeholder="Discord User ID" value={testUser} onChange={(e) => setTestUser(e.target.value)} />
          <label className="block text-[11px] uppercase tracking-wide text-white/40">Balance $BTF del fan</label>
          <DCInput type="number" min={0} value={testBtf} onChange={(e) => setTestBtf(Number(e.target.value))} />
          <DCButton onClick={test} disabled={!testUser.trim() || dc.verifyTokenGate.isPending} className="w-full">
            {dc.verifyTokenGate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />} Verificar acceso
          </DCButton>
          {testResult && (
            <div className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <Badge tone={testResult.qualifies ? 'emerald' : 'rose'}>{testResult.qualifies ? 'Califica' : 'No califica'}</Badge>
              {testResult.roleAssigned && <Badge tone="blurple">Rol asignado</Badge>}
            </div>
          )}
          <p className="text-[11px] text-white/45">El balance on-chain se valida en producción; aquí puedes simular cualquier valor.</p>
        </GlassCard>
      </div>
    </div>
  );
}
