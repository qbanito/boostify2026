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

interface Props {
  accentColor?: string;
  primaryColor?: string;
}

interface RewardSummary {
  config: { active: boolean; dryRun: boolean; btfPerStream: number; minStreams: number; minClaimBtf: number; btfPriceUsd: number };
  wallet: string | null;
  claimableBtf: number;
  pendingBtf: number;
  paidBtf: number;
  currentWeek: { periodKey: string; validStreams: number; uniqueListeners: number; projectedBtf: number };
  history: Array<{
    id: number; periodKey: string; validStreams: number; uniqueListeners: number;
    baseBtf: number; bonusBtf: number; actionBtf: number; totalBtf: number;
    status: string; txHash: string | null; paidAt: string | null;
  }>;
}

const fmtBtf = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function StreamingRewardsWidget({ accentColor = '#f97316', primaryColor = '#ec4899' }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [walletInput, setWalletInput] = useState('');
  const [editingWallet, setEditingWallet] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const summaryQuery = useQuery<RewardSummary | null>({
    queryKey: ['streaming-rewards-me'],
    queryFn: async () => {
      const res = await apiRequest('/api/streaming-rewards/me', { method: 'GET' });
      return res?.success ? (res as RewardSummary) : null;
    },
    staleTime: 60 * 1000,
  });

  const walletMutation = useMutation({
    mutationFn: async (address: string) =>
      apiRequest('/api/streaming-rewards/wallet', { method: 'POST', data: { address } }),
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
        toast({ title: '¡BTF transferido!', description: `${fmtBtf(res.totalBtf)} BTF enviados a tu wallet. Tx: ${String(res.txHash).slice(0, 14)}…` });
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
  const usdValue = (btf: number) => (btf * config.btfPriceUsd).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
  const canClaim = data.claimableBtf >= config.minClaimBtf && !!data.wallet;

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

      {/* Balances */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Reclamable</p>
          <p className="text-base font-extrabold text-white leading-tight">{fmtBtf(data.claimableBtf)}</p>
          <p className="text-[10px] text-gray-500">{usdValue(data.claimableBtf)}</p>
        </div>
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Pendiente</p>
          <p className="text-base font-extrabold text-gray-300 leading-tight">{fmtBtf(data.pendingBtf)}</p>
          <p className="text-[10px] text-gray-500">en revisión</p>
        </div>
        <div className="rounded-xl p-2.5 bg-white/[0.04] border border-white/10">
          <p className="text-[10px] uppercase tracking-wide text-gray-400">Pagado</p>
          <p className="text-base font-extrabold leading-tight" style={{ color: accentColor }}>{fmtBtf(data.paidBtf)}</p>
          <p className="text-[10px] text-gray-500">{usdValue(data.paidBtf)}</p>
        </div>
      </div>

      {/* Current week live */}
      <div className="flex items-center gap-2 mb-3 text-[11px] text-gray-300">
        <TrendingUp className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
        <span>
          Esta semana: <strong className="text-white">{fmtBtf(currentWeek.validStreams)}</strong> streams válidos ·{' '}
          <strong className="text-white">{currentWeek.uniqueListeners}</strong> oyentes ·{' '}
          proyección <strong style={{ color: accentColor }}>{fmtBtf(currentWeek.projectedBtf)} BTF</strong>
        </span>
      </div>

      {/* Wallet */}
      {!data.wallet || editingWallet ? (
        <div className="flex items-center gap-2 mb-3">
          <input
            value={walletInput}
            onChange={(e) => setWalletInput(e.target.value.trim())}
            placeholder="Tu wallet Polygon (0x…)"
            className="flex-1 min-w-0 bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white placeholder:text-gray-500 focus:outline-none focus:border-white/40"
            aria-label="Dirección de wallet Polygon"
          />
          <button
            onClick={() => walletMutation.mutate(walletInput)}
            disabled={walletMutation.isPending || !/^0x[a-fA-F0-9]{40}$/.test(walletInput)}
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40 cursor-pointer transition-transform hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
          >
            {walletMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wallet className="h-3.5 w-3.5" />}
            Guardar
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 mb-3 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5 min-w-0">
            <Wallet className="h-3.5 w-3.5 flex-shrink-0" style={{ color: accentColor }} />
            <span className="truncate font-mono">{data.wallet.slice(0, 8)}…{data.wallet.slice(-6)}</span>
          </span>
          <button onClick={() => { setWalletInput(data.wallet || ''); setEditingWallet(true); }} className="text-gray-500 hover:text-white underline cursor-pointer">
            Cambiar
          </button>
        </div>
      )}

      {/* Claim */}
      <button
        onClick={() => claimMutation.mutate()}
        disabled={!canClaim || claimMutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40 cursor-pointer transition-transform hover:scale-[1.02]"
        style={{ background: `linear-gradient(135deg, ${primaryColor}, ${accentColor})` }}
        aria-label="Reclamar recompensas BTF"
      >
        {claimMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Coins className="h-4 w-4" />}
        {canClaim
          ? `Reclamar ${fmtBtf(data.claimableBtf)} BTF`
          : !data.wallet
            ? 'Registra tu wallet para reclamar'
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
                    <p className="text-gray-500">{fmtBtf(h.validStreams)} streams · {h.uniqueListeners} oyentes</p>
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
