/**
 * StreamingRewardsWidget
 * ======================
 * Owner-only BTF rewards card for the artist profile. Shows claimable /
 * pending / paid BTF earned from streams + platform actions, live stats for
 * the current week, Polygon wallet registration and a Claim button that
 * triggers the real on-chain BTF transfer (dry-run aware).
 *
 * API: /api/streaming-rewards (me, wallet, claim)
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Coins, Wallet, Loader2, TrendingUp, CheckCircle2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useWeb3 } from '@/hooks/use-web3';
import { invalidateBTFBalanceCache } from '@/hooks/use-btf-token';

interface Props {
  accentColor?: string;
  primaryColor?: string;
}

interface RewardSummary {
  requiredTermsVersion: string;
  config: { active: boolean; dryRun: boolean; btfPerStream: number; minStreams: number; minClaimBtf: number };
  wallet: string | null;
  termsAccepted: boolean;
  termsVersion: string | null;
  claimableBtf: number;
  pendingBtf: number;
  paidBtf: number;
  currentWeek: { periodKey: string; validStreams: number; uniqueListeners: number; projectedBtf: number };
  history: Array<{
    id: number; periodKey: string; validStreams: number; uniqueListeners: number;
    baseBtf: number; bonusBtf: number; actionBtf: number; totalBtf: number;
    status: string; txHash: string | null; paidAt: string | null;
    activity: Array<{ actionKey: string; qty: number; btfAmount: number }>;
  }>;
}

const fmtBtf = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });
const actionLabels: Record<string, string> = {
  publish_song: 'cancion publicada',
  merch_sale: 'venta merch',
  fan_content_purchase: 'compra de contenido',
  fan_tip: 'propina de fan',
  follower_growth: 'nuevos seguidores',
};

export default function StreamingRewardsWidget({ accentColor = '#f97316', primaryColor = '#ec4899' }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingWallet, setEditingWallet] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { address, isConnected, signMessage } = useWeb3();

  const summaryQuery = useQuery<RewardSummary | null>({
    queryKey: ['streaming-rewards-me'],
    queryFn: async () => {
      const res = await apiRequest('/api/streaming-rewards/me', { method: 'GET' });
      return res?.success ? (res as RewardSummary) : null;
    },
    staleTime: 60 * 1000,
  });

  const termsMutation = useMutation({
    mutationFn: async () => apiRequest('/api/streaming-rewards/terms/accept', {
      method: 'POST',
      data: { accepted: true, termsVersion: summaryQuery.data?.requiredTermsVersion },
    }),
    onSuccess: () => {
      setAcceptedTerms(false);
      toast({ title: 'Términos aceptados', description: 'La aceptación quedó registrada en tu cuenta.' });
      queryClient.invalidateQueries({ queryKey: ['streaming-rewards-me'] });
    },
    onError: (e: any) => toast({ title: 'No se pudo registrar', description: e?.message || 'Inténtalo de nuevo.', variant: 'destructive' }),
  });

  const walletMutation = useMutation({
    mutationFn: async () => {
      if (!isConnected || !address || !signMessage) throw new Error('Conecta tu wallet para verificarla.');
      if (!data?.termsAccepted) throw new Error('Lee y acepta los términos del programa antes de vincular la wallet.');
      const challenge = await apiRequest('/api/streaming-rewards/wallet/challenge', { method: 'POST', data: { address } });
      const signature = await signMessage(challenge.message);
      return apiRequest('/api/streaming-rewards/wallet/verify', {
        method: 'POST',
        data: { challengeId: challenge.challengeId, signature },
      });
    },
    onSuccess: () => {
      toast({ title: 'Wallet guardada', description: 'Tus recompensas BTF se enviarán a esta dirección.' });
      setEditingWallet(false);
      queryClient.invalidateQueries({ queryKey: ['streaming-rewards-me'] });
    },
    onError: (e: any) => toast({ title: 'Wallet inválida', description: e?.message || 'Usa una dirección Polygon 0x…', variant: 'destructive' }),
  });

  const claimMutation = useMutation({
    mutationFn: async () => apiRequest('/api/streaming-rewards/claim', { method: 'POST', data: {} }),
    onSuccess: (res: any) => {
      if (res?.claimed) {
        invalidateBTFBalanceCache(data?.wallet || undefined);
        toast({ title: '¡BTF transferido!', description: `${fmtBtf(res.totalBtf)} BTF enviados a tu wallet. Tx: ${String(res.txHash).slice(0, 14)}…` });
      } else if (res?.txHash) {
        toast({ title: 'Transacción en confirmación', description: `${res.message} Tx: ${String(res.txHash).slice(0, 14)}…` });
      } else {
        toast({ title: res?.simulated ? 'Simulación (dry-run)' : 'No se pudo reclamar', description: res?.message || 'Inténtalo más tarde.' });
      }
      queryClient.invalidateQueries({ queryKey: ['streaming-rewards-me'] });
    },
    onError: (e: any) => toast({ title: 'Error al reclamar', description: e?.message || 'Inténtalo más tarde.', variant: 'destructive' }),
  });

  const data = summaryQuery.data;
  if (summaryQuery.isLoading || !data || !data.config.active) return null;

  const { config, currentWeek } = data;
  const canClaim = !config.dryRun && data.claimableBtf >= config.minClaimBtf && !!data.wallet && data.termsAccepted;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 shadow-lg overflow-hidden relative"
      style={{
        background: 'linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 100%)',
        border: `1px solid ${accentColor}55`,
        boxShadow: `0 0 24px ${accentColor}22, inset 0 1px 0 ${accentColor}22`,
        backdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}33, ${accentColor}33)`, border: `1px solid ${accentColor}55` }}
          >
            <Coins className="h-5 w-5" style={{ color: accentColor }} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Recompensas BTF</p>
            <p className="text-[11px] text-gray-400">Gana BTF por tus streams y actividad</p>
          </div>
        </div>
        {config.dryRun && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
            Modo prueba
          </span>
        )}
      </div>

      <p className="mb-3 text-[10px] leading-relaxed text-gray-500">
        Las recompensas no estan garantizadas y pueden requerir revision. BTF no equivale a USD ni a regalias o participacion en ingresos. <a href="/terms#btf-rewards" className="text-orange-300 underline">Terminos del programa</a>
      </p>

      {/* Balances */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Reclamable</p>
          <p className="text-base font-extrabold text-white leading-tight">{fmtBtf(data.claimableBtf)}</p>
          <p className="text-[10px] text-gray-500">BTF aprobados</p>
        </div>
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Pendiente</p>
          <p className="text-base font-extrabold text-gray-300 leading-tight">{fmtBtf(data.pendingBtf)}</p>
          <p className="text-[10px] text-gray-500">en revisión</p>
        </div>
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Pagado</p>
          <p className="text-base font-extrabold leading-tight" style={{ color: accentColor }}>{fmtBtf(data.paidBtf)}</p>
          <p className="text-[10px] text-gray-500">BTF transferidos</p>
        </div>
      </div>

      {/* Current week live */}
      <div className="flex items-center gap-2 mb-3 text-[11px] text-gray-300">
        <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span>
          Esta semana: <strong className="text-white">{fmtBtf(currentWeek.validStreams)}</strong> streams válidos ·{' '}
          <strong className="text-white">{currentWeek.uniqueListeners}</strong> oyentes ·{' '}
          proyección por streams <strong style={{ color: accentColor }}>{fmtBtf(currentWeek.projectedBtf)} BTF</strong>
        </span>
      </div>

      {!data.termsAccepted && (
        <div className="mb-3 space-y-2">
          <label className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/[0.03] p-2.5 text-[11px] leading-relaxed text-gray-300">
            <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} className="mt-0.5 accent-orange-500" />
            <span>
              He leido y acepto los <a href="/terms#btf-rewards" target="_blank" rel="noreferrer" className="text-orange-300 underline">Terminos de Recompensas BTF</a>. Entiendo que las recompensas son variables, estan sujetas a verificacion y se pagan en BTF; no son ingresos en USD ni una participacion en ventas o regalias.
            </span>
          </label>
          <button
            onClick={() => termsMutation.mutate()}
            disabled={!acceptedTerms || termsMutation.isPending}
            className="w-full rounded-lg border border-white/15 bg-white/[0.05] px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
          >
            {termsMutation.isPending ? 'Guardando aceptación...' : 'Aceptar términos del programa'}
          </button>
        </div>
      )}

      {/* Wallet */}
      {!data.wallet || editingWallet ? (
        <div className="mb-3 space-y-2">
          {!isConnected ? (
            <a href="/btf-wallet" className="flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2.5 text-xs font-semibold text-white hover:bg-white/10">
              <Wallet className="h-3.5 w-3.5" /> Conecta una wallet para continuar
            </a>
          ) : (
            <button
              onClick={() => walletMutation.mutate()}
              disabled={walletMutation.isPending || !data.termsAccepted}
              className="w-full flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-white disabled:opacity-40 cursor-pointer"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
            >
              {walletMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
              Verificar {address?.slice(0, 6)}...{address?.slice(-4)}
            </button>
          )}
          <p className="text-[10px] leading-relaxed text-gray-500">La firma solo demuestra que controlas esta direccion. No autoriza transferencias ni comparte tu clave privada. Los reclamos se envian en Polygon.</p>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5 min-w-0">
            <Wallet className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="truncate font-mono">Verificada - {data.wallet.slice(0, 8)}...{data.wallet.slice(-6)}</span>
          </span>
          <button onClick={() => setEditingWallet(true)} className="text-gray-500 hover:text-white underline cursor-pointer">
            Cambiar wallet
          </button>
        </div>
      )}
      <p className="mb-3 text-[10px] leading-relaxed text-gray-500">
        Los ingresos por ventas de canciones tokenizadas se registran aparte en <a href="/tokenization" className="text-orange-300 underline">Tokenization</a>; no se mezclan con recompensas BTF.
      </p>

      {/* Claim */}
      {config.dryRun && (
        <p className="mb-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          Modo prueba activo: no se transfieren BTF reales. El administrador debe habilitar los pagos reales.
        </p>
      )}
      <button
        onClick={() => claimMutation.mutate()}
        disabled={!canClaim || claimMutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 cursor-pointer transition-transform hover:scale-[1.02]"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
        aria-label="Reclamar recompensas BTF"
      >
        {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        {config.dryRun
          ? 'Reclamos desactivados en modo prueba'
          : canClaim
          ? `Reclamar ${fmtBtf(data.claimableBtf)} BTF`
          : !data.wallet
            ? 'Registra tu wallet para reclamar'
            : !data.termsAccepted
              ? 'Acepta los términos para reclamar'
            : `Mínimo ${fmtBtf(config.minClaimBtf)} BTF para reclamar`}
      </button>

      {/* History */}
      {data.history.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white cursor-pointer"
          >
            {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Historial ({data.history.length})
          </button>
          {showHistory && (
            <div className="mt-2 space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {data.history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-2 text-[11px] rounded-lg px-2.5 py-1.5 bg-white/[0.03] border border-white/10">
                  <div className="min-w-0">
                    <p className="text-gray-300">Semana {h.periodKey}</p>
                    <p className="text-gray-500">{fmtBtf(h.validStreams)} streams · {h.uniqueListeners} oyentes · actividad {fmtBtf(h.actionBtf)} BTF</p>
                    {h.activity.length > 0 && (
                      <p className="text-gray-500">
                        {h.activity.map((item) => `${actionLabels[item.actionKey] || item.actionKey.replaceAll('_', ' ')}: ${item.qty} (+${fmtBtf(item.btfAmount)} BTF)`).join(' · ')}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-white">{fmtBtf(h.totalBtf)} BTF</span>
                    {h.status === 'paid' && h.txHash ? (
                      <a
                        href={`https://polygonscan.com/tx/${h.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300"
                        aria-label="Ver transacción en Polygonscan"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className={h.status === 'approved' ? 'text-amber-400' : 'text-gray-500'}>
                        {h.status === 'approved' ? 'reclamable' : h.status === 'pending' ? 'en revisión' : h.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
