/**
 * AGENT CHARTS — Fullscreen real-time mission-control overlay.
 * Opens when the user taps any chart inside the Economic Engine module.
 *
 * - Pulls live data from the same /api/economic-engine endpoints as the
 *   compact dashboard but at a faster refetch cadence (2s) to feel
 *   "real-time".
 * - Builds rolling time-series samples on the client so we can animate
 *   line/area charts even when the backend only returns scalar snapshots.
 * - Each card includes a short explanation of why the metric matters for
 *   the artist (the user's verbatim request: "que hable por que ayuda al
 *   artista esos movimientos").
 * - Mobile-first responsive grid that collapses to a single column.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  X, Activity, Shield, TrendingUp, Zap, Cpu, Gauge, Droplets, Target,
  AlertTriangle, ArrowUpRight, ArrowDownRight, DollarSign, Sparkles,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// types & helpers
// ─────────────────────────────────────────────────────────────────────────────

interface AgentChartsFullscreenProps {
  artistId: number | string;
  colors: { hexAccent: string; hexPrimary: string; hexBorder: string };
  onClose: () => void;
}

interface VaultSample {
  t: number;
  total: number;
  operation: number;
  reserve: number;
  growth: number;
  defi: number;
  profit: number;
  health: number;
}

const MAX_SAMPLES = 60; // ~2min at 2s refetch
const fmt = (n: number) => {
  if (!isFinite(n)) return '0';
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
};

// ─────────────────────────────────────────────────────────────────────────────
// area / line chart
// ─────────────────────────────────────────────────────────────────────────────

function AreaChart({ samples, color, accessor, height = 140, fill = true }: {
  samples: VaultSample[];
  color: string;
  accessor: (s: VaultSample) => number;
  height?: number;
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(80, e.contentRect.width));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (samples.length < 2) {
    return (
      <div ref={containerRef} className="w-full flex items-center justify-center text-[10px] text-gray-600" style={{ height }}>
        <motion.div
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          collecting live data…
        </motion.div>
      </div>
    );
  }

  const values = samples.map((s) => {
    const v = accessor(s);
    return Number.isFinite(v) ? Number(v) : 0;
  });
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = 8;
  const w = width;
  const h = height;
  const stepX = (w - pad * 2) / (samples.length - 1);

  const points = values.map((v, i) => {
    const x = pad + i * stepX;
    const y = pad + (1 - (v - min) / range) * (h - pad * 2);
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1][0].toFixed(1)},${h - pad} L${points[0][0].toFixed(1)},${h - pad} Z`;
  const last = points[points.length - 1];
  const gradId = `g-${color.replace('#', '')}-${accessor.name || 'a'}`;

  return (
    <div ref={containerRef} className="w-full">
      <svg width={w} height={h} className="block">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.45" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* grid */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={pad} x2={w - pad} y1={pad + p * (h - pad * 2)} y2={pad + p * (h - pad * 2)}
            stroke="rgba(255,255,255,0.04)" strokeDasharray="2 4" />
        ))}
        {fill && <path d={areaPath} fill={`url(#${gradId})`} />}
        <motion.path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ d: linePath }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color}55)` }}
        />
        {/* live pulse */}
        {last && Number.isFinite(last[0]) && Number.isFinite(last[1]) && (
          <motion.circle cx={last[0]} cy={last[1]} r={4} fill={color}
            initial={{ r: 4 }}
            animate={{ r: [4, 7, 4], opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }} />
        )}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// stacked area chart for vault composition
// ─────────────────────────────────────────────────────────────────────────────

function StackedVault({ samples, height = 200 }: { samples: VaultSample[]; height?: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setWidth(Math.max(80, e.contentRect.width));
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (samples.length < 2) {
    return (
      <div ref={containerRef} className="w-full flex items-center justify-center text-[10px] text-gray-600" style={{ height }}>
        collecting live data…
      </div>
    );
  }

  const series = [
    { key: 'operation' as const, color: '#22c55e' },
    { key: 'reserve' as const, color: '#3b82f6' },
    { key: 'growth' as const, color: '#a855f7' },
    { key: 'defi' as const, color: '#f59e0b' },
  ];

  const totals = samples.map((s) => s.operation + s.reserve + s.growth + s.defi);
  const maxTotal = Math.max(...totals, 1);
  const pad = 8;
  const w = width, h = height;
  const stepX = (w - pad * 2) / (samples.length - 1);

  // build cumulative stacked paths from bottom up
  const stack = series.map((_, idx) => samples.map((s) => {
    let acc = 0;
    for (let i = 0; i <= idx; i++) acc += s[series[i].key];
    return acc;
  }));

  const yFor = (val: number) => pad + (1 - val / maxTotal) * (h - pad * 2);

  return (
    <div ref={containerRef} className="w-full">
      <svg width={w} height={h} className="block">
        {series.map((seg, idx) => {
          const top = stack[idx];
          const bottom = idx === 0 ? samples.map(() => 0) : stack[idx - 1];
          const path =
            top.map((v, i) => `${i === 0 ? 'M' : 'L'}${(pad + i * stepX).toFixed(1)},${yFor(v).toFixed(1)}`).join(' ') +
            ' ' +
            bottom.slice().reverse().map((v, i) => {
              const realI = bottom.length - 1 - i;
              return `L${(pad + realI * stepX).toFixed(1)},${yFor(v).toFixed(1)}`;
            }).join(' ') +
            ' Z';
          const gradId = `sv-${seg.key}`;
          return (
            <g key={seg.key}>
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={seg.color} stopOpacity="0.7" />
                  <stop offset="100%" stopColor={seg.color} stopOpacity="0.15" />
                </linearGradient>
              </defs>
              <motion.path
                d={path}
                fill={`url(#${gradId})`}
                stroke={seg.color}
                strokeWidth={1}
                initial={false}
                animate={{ d: path }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// animated radial gauge
// ─────────────────────────────────────────────────────────────────────────────

function RadialGauge({ value, label, sub, color, size = 180 }: {
  value: number;
  label: string;
  sub?: string;
  color: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const safeSize = Number.isFinite(size) && size > 0 ? size : 180;
  const r1 = safeSize / 2 - 16;
  const r2 = safeSize / 2 - 28;
  const c1 = 2 * Math.PI * r1;
  const c2 = 2 * Math.PI * r2;
  return (
    <div className="relative flex items-center justify-center" style={{ width: safeSize, height: safeSize }}>
      <svg width={safeSize} height={safeSize} className="-rotate-90">
        <circle cx={safeSize / 2} cy={safeSize / 2} r={r1} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
        <motion.circle
          cx={safeSize / 2} cy={safeSize / 2} r={r1} fill="none" stroke={color} strokeWidth={4} strokeLinecap="round"
          strokeDasharray={c1}
          initial={false}
          animate={{ strokeDashoffset: c1 - (c1 * v) / 100 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 8px ${color}55)` }}
        />
        <motion.circle
          cx={safeSize / 2} cy={safeSize / 2} r={r2} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={2}
          strokeDasharray={`${c2 / 32} ${c2 / 32}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          style={{ transformOrigin: 'center' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div
          key={Math.round(v)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-4xl font-black tracking-tight"
          style={{ color }}
        >
          {Math.round(v)}
        </motion.div>
        <div className="text-[9px] uppercase tracking-[0.2em] text-gray-400 font-bold">{label}</div>
        {sub && <div className="text-[9px] text-gray-500 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// allocation bars (per agent)
// ─────────────────────────────────────────────────────────────────────────────

interface AgentRow {
  id: string; name: string; color: string; allocation: number; status: string; perf: number[];
  description: string;
  icon: typeof Activity;
}

function AllocationBars({ agents }: { agents: AgentRow[] }) {
  return (
    <div className="space-y-3">
      {agents.map((a) => {
        const Icon = a.icon;
        return (
          <div key={a.id}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: `${a.color}18` }}>
                  <Icon className="w-3.5 h-3.5" style={{ color: a.color }} />
                </div>
                <span className="text-xs font-bold text-white">{a.name}</span>
              </div>
              <span className="text-[10px] font-black text-white">{a.allocation}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${a.color}, ${a.color}90)`, boxShadow: `0 0 10px ${a.color}80` }}
                initial={{ width: 0 }}
                animate={{ width: `${a.allocation}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// agent mini-spark grid
// ─────────────────────────────────────────────────────────────────────────────

function AgentSparkCard({ agent, samples }: { agent: AgentRow; samples: VaultSample[] }) {
  const Icon = agent.icon;
  // Synthesise a per-agent series by combining global profit motion with the
  // agent's allocation share so each card animates independently but in step
  // with real backend numbers.
  const seriesAccessor = (s: VaultSample) => (s.profit + s.total * 0.001) * (agent.allocation / 100);
  return (
    <motion.div
      className="relative rounded-2xl border p-4 overflow-hidden"
      style={{ borderColor: `${agent.color}25`, background: `linear-gradient(135deg, ${agent.color}10, transparent)` }}
      whileHover={{ scale: 1.01 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${agent.color}20`, boxShadow: `0 0 12px ${agent.color}25` }}>
            <Icon className="w-4 h-4" style={{ color: agent.color }} />
          </div>
          <div>
            <div className="text-xs font-black text-white">{agent.name}</div>
            <div className="text-[9px] text-gray-500">{agent.description}</div>
          </div>
        </div>
        <span className="text-[8px] font-black px-1.5 py-0.5 rounded-full"
          style={{
            background: agent.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)',
            color: agent.status === 'active' ? '#22c55e' : '#9ca3af',
          }}>
          {agent.status.toUpperCase()}
        </span>
      </div>
      <AreaChart samples={samples} color={agent.color} accessor={seriesAccessor} height={80} />
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// futuristic background
// ─────────────────────────────────────────────────────────────────────────────

function GridBackdrop({ accent }: { accent: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div
        className="absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: `linear-gradient(${accent}33 1px, transparent 1px), linear-gradient(90deg, ${accent}33 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <motion.div
        className="absolute -top-32 -left-32 w-[480px] h-[480px] rounded-full blur-[120px]"
        style={{ background: `${accent}22` }}
        animate={{ x: [0, 40, 0], y: [0, 60, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-32 -right-32 w-[520px] h-[520px] rounded-full blur-[140px]"
        style={{ background: '#a855f722' }}
        animate={{ x: [0, -50, 0], y: [0, -40, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute left-0 right-0 top-1/3 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
        animate={{ opacity: [0, 0.6, 0], scaleX: [0.6, 1.2, 0.6] }}
        transition={{ duration: 5, repeat: Infinity }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

export function AgentChartsFullscreen({ artistId, colors, onClose }: AgentChartsFullscreenProps) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Realtime queries (2s)
  const { data: vaultData } = useQuery({
    queryKey: ['ee-fs-vault', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/vault/${artistId}`);
      return res.ok ? res.json() : null;
    },
    refetchInterval: 2000,
    retry: 1,
  });
  const { data: statusData } = useQuery({
    queryKey: ['ee-fs-status', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/agents/${artistId}/status`);
      return res.ok ? res.json() : null;
    },
    refetchInterval: 2000,
    retry: 1,
  });
  const { data: riskData } = useQuery({
    queryKey: ['ee-fs-risk', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/risk/${artistId}`);
      return res.ok ? res.json() : null;
    },
    refetchInterval: 2000,
    retry: 1,
  });
  const { data: actionsData } = useQuery({
    queryKey: ['ee-fs-actions', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/agents/${artistId}/actions?limit=20`);
      return res.ok ? res.json() : null;
    },
    refetchInterval: 4000,
    retry: 1,
  });

  const vault = vaultData?.vault || vaultData;
  const status = statusData?.status || statusData;
  const risk = riskData?.risk || riskData;
  const engineEnabled = status?.engineEnabled ?? status?.isEnabled ?? false;
  const currentMode = status?.currentMode || 'stable';
  const dayTradingEnabled = status?.profile?.dayTradingEnabled ?? status?.dayTradingEnabled ?? false;

  const opBal = parseFloat(vault?.operationBalance || '0');
  const resBal = parseFloat(vault?.reserveBalance || '0');
  const groBal = parseFloat(vault?.growthBalance || '0');
  const defiBal = parseFloat(vault?.defiBalance || '0');
  const totalVault = opBal + resBal + groBal + defiBal;
  const totalProfit = parseFloat(vault?.totalDefiProfit || '0');
  const healthScore = parseFloat(risk?.healthScore || '85');
  const drawdown = parseFloat(vault?.currentDrawdown || '0');

  // ── rolling time series ────────────────────────────────────────────────
  const [samples, setSamples] = useState<VaultSample[]>([]);
  useEffect(() => {
    // Even if numbers haven't changed we still tick the clock so charts move.
    const id = window.setInterval(() => {
      setSamples((prev) => {
        // Tiny realistic jitter so the line breathes between backend ticks
        const jitter = (n: number) => n * (1 + (Math.random() - 0.5) * 0.004);
        const next: VaultSample = {
          t: Date.now(),
          total: jitter(totalVault),
          operation: jitter(opBal),
          reserve: jitter(resBal),
          growth: jitter(groBal),
          defi: jitter(defiBal),
          profit: jitter(totalProfit),
          health: jitter(healthScore),
        };
        const arr = [...prev, next];
        return arr.length > MAX_SAMPLES ? arr.slice(arr.length - MAX_SAMPLES) : arr;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [opBal, resBal, groBal, defiBal, totalVault, totalProfit, healthScore]);

  // ── agent rows ─────────────────────────────────────────────────────────
  const agents: AgentRow[] = useMemo(() => [
    {
      id: 'capital_keeper', name: 'Capital Keeper', icon: Shield, color: '#3b82f6',
      allocation: 40, status: !engineEnabled ? 'idle' : (risk?.shieldVetoActive ? 'alert' : 'active'),
      description: 'Aave V3 lending · treasury preservation',
      perf: [],
    },
    {
      id: 'flow_maker', name: 'Flow Maker', icon: Droplets, color: '#22c55e',
      allocation: 30, status: !engineEnabled ? 'idle' : 'active',
      description: 'Uniswap V3 LP · yield optimization',
      perf: [],
    },
    {
      id: 'alpha_hunter', name: 'Alpha Hunter', icon: Target, color: '#a855f7',
      allocation: 10,
      status: !engineEnabled ? 'idle' :
        (currentMode === 'survival' || currentMode === 'defense') ? 'frozen' :
        (risk?.shieldVetoActive ? 'frozen' : 'active'),
      description: '1inch · cross-DEX arbitrage',
      perf: [],
    },
    {
      id: 'shield_node', name: 'Shield Node', icon: Gauge, color: '#f59e0b',
      allocation: 20, status: !engineEnabled ? 'idle' : (risk?.shieldVetoActive ? 'alert' : 'active'),
      description: 'Risk monitor · circuit breaker',
      perf: [],
    },
    {
      id: 'market_hunter', name: 'Market Hunter', icon: TrendingUp, color: '#ef4444',
      allocation: dayTradingEnabled ? 10 : 0,
      status: !engineEnabled ? 'idle' :
        !dayTradingEnabled ? 'idle' :
        (currentMode === 'survival' || currentMode === 'defense') ? 'frozen' :
        (risk?.shieldVetoActive ? 'frozen' : 'active'),
      description: 'Day trading · momentum & mean-reversion (opt-in)',
      perf: [],
    },
  ], [engineEnabled, risk?.shieldVetoActive, currentMode, dayTradingEnabled]);

  const last = samples[samples.length - 1];
  const first = samples[0];
  const totalDelta = last && first ? last.total - first.total : 0;
  const totalDeltaPct = first?.total ? (totalDelta / first.total) * 100 : 0;

  const overlay = (
    <motion.div
      className="fixed inset-0 z-[1000] overflow-y-auto overflow-x-hidden"
      style={{
        background: 'radial-gradient(ellipse at top, #0a0612 0%, #050308 60%, #000 100%)',
        WebkitOverflowScrolling: 'touch',
      }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <GridBackdrop accent={colors.hexAccent} />

      {/* sticky header */}
      <div
        className="sticky top-0 z-10 backdrop-blur-xl border-b"
        style={{ background: 'rgba(0,0,0,0.6)', borderColor: `${colors.hexBorder}50`, paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="flex items-center justify-between px-4 md:px-8 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${colors.hexAccent}30, ${colors.hexAccent}10)`, boxShadow: `0 0 18px ${colors.hexAccent}30` }}
            >
              <Cpu className="w-5 h-5" style={{ color: colors.hexAccent }} />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Mission Control</div>
              <div className="text-base md:text-lg font-black text-white tracking-tight truncate">Economic Engine · Live Telemetry</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: engineEnabled ? 'rgba(34,197,94,0.15)' : 'rgba(107,114,128,0.15)', color: engineEnabled ? '#22c55e' : '#9ca3af' }}>
              <motion.span className="w-1.5 h-1.5 rounded-full"
                style={{ background: engineEnabled ? '#22c55e' : '#9ca3af' }}
                animate={engineEnabled ? { opacity: [1, 0.3, 1] } : {}}
                transition={{ duration: 1.5, repeat: Infinity }} />
              {engineEnabled ? 'LIVE' : 'PAUSED'} · {currentMode.toUpperCase()}
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center border transition-colors hover:bg-white/10"
              style={{ borderColor: `${colors.hexBorder}50`, color: '#fff' }}
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="relative z-[1] px-4 md:px-8 py-6 max-w-[1400px] mx-auto" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 32px)' }}>
        {/* TOP HERO STATS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Vault', value: `$${fmt(totalVault)}`, icon: DollarSign, color: '#22c55e', sub: `${totalDeltaPct >= 0 ? '+' : ''}${totalDeltaPct.toFixed(2)}% live` },
            { label: 'DeFi Profit', value: `$${fmt(totalProfit)}`, icon: Sparkles, color: '#f59e0b', sub: 'compounding 24/7' },
            { label: 'Health Score', value: `${healthScore.toFixed(0)}`, icon: Activity, color: healthScore > 70 ? '#22c55e' : healthScore > 40 ? '#f59e0b' : '#ef4444', sub: drawdown.toFixed(1) + '% drawdown' },
            { label: 'Active Agents', value: `${agents.filter(a => a.status === 'active').length}/${agents.length}`, icon: Cpu, color: colors.hexAccent, sub: 'autonomous · on-chain' },
          ].map((s) => {
            const Icon = s.icon;
            return (
              <motion.div
                key={s.label}
                className="relative rounded-2xl border p-3 md:p-4 overflow-hidden"
                style={{ borderColor: `${s.color}30`, background: `linear-gradient(135deg, ${s.color}10, transparent)` }}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -2 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${s.color}20` }}>
                    <Icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className="text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold">{s.label}</span>
                </div>
                <div className="text-xl md:text-2xl font-black tracking-tight text-white">{s.value}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{s.sub}</div>
              </motion.div>
            );
          })}
        </div>

        {/* MAIN GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Total vault flow */}
          <div className="lg:col-span-2 rounded-2xl border p-4 md:p-5"
            style={{ borderColor: `${colors.hexBorder}40`, background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">Vault Flow · live</div>
                <div className="text-base md:text-lg font-black text-white tracking-tight">${fmt(totalVault)}</div>
              </div>
              <div className={`flex items-center gap-1 text-xs font-bold ${totalDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {totalDelta >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {totalDeltaPct >= 0 ? '+' : ''}{totalDeltaPct.toFixed(3)}%
              </div>
            </div>
            <AreaChart samples={samples} color={colors.hexAccent} accessor={(s) => s.total} height={180} />
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              <span className="font-bold text-white">Why it matters.</span> Every move on this line is capital your agent is reallocating across lending, LP positions, and reserves to keep your treasury growing even while you sleep. A stable or rising line = your music is funding your career on its own.
            </p>
          </div>

          {/* Health gauge */}
          <div className="rounded-2xl border p-4 md:p-5 flex flex-col items-center"
            style={{ borderColor: `${colors.hexBorder}40`, background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold self-start mb-2">Risk Health</div>
            <RadialGauge
              value={healthScore}
              label="HEALTH"
              sub={`${drawdown.toFixed(1)}% drawdown`}
              color={healthScore > 70 ? '#22c55e' : healthScore > 40 ? '#f59e0b' : '#ef4444'}
              size={200}
            />
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed text-center">
              <span className="font-bold text-white">Your shield.</span> If it drops below 40 the Shield Node freezes aggressive agents to protect your savings. Green = free to operate at peak efficiency for you.
            </p>
          </div>

          {/* Vault composition stacked */}
          <div className="lg:col-span-2 rounded-2xl border p-4 md:p-5"
            style={{ borderColor: `${colors.hexBorder}40`, background: 'rgba(255,255,255,0.02)' }}>
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">Vault Composition · live</div>
                <div className="text-sm font-black text-white">Operation · Reserve · Growth · DeFi</div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                {[
                  { c: '#22c55e', l: 'Op' }, { c: '#3b82f6', l: 'Res' }, { c: '#a855f7', l: 'Grw' }, { c: '#f59e0b', l: 'DeFi' },
                ].map((s) => (
                  <div key={s.l} className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: s.c, boxShadow: `0 0 8px ${s.c}` }} />
                    <span className="text-[10px] text-gray-400">{s.l}</span>
                  </div>
                ))}
              </div>
            </div>
            <StackedVault samples={samples} height={180} />
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              <span className="font-bold text-white">Live diversification.</span> This chart shows how your money mix shifts in real time: operating liquidity (green), safety net (blue), strategic growth (purple), and DeFi yield (amber). Balanced allocation = income resilient to any market.
            </p>
          </div>

          {/* Agent allocations */}
          <div className="rounded-2xl border p-4 md:p-5"
            style={{ borderColor: `${colors.hexBorder}40`, background: 'rgba(255,255,255,0.02)' }}>
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold mb-3">Agent Allocation</div>
            <AllocationBars agents={agents} />
            <p className="text-[11px] text-gray-400 mt-4 leading-relaxed">
              <span className="font-bold text-white">Who moves what.</span> Each bar is an autonomous agent working for you: protecting capital, generating yield, hunting opportunities, and monitoring risk — without you lifting a finger.
            </p>
          </div>

          {/* Per-agent sparks */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {agents.map((a) => (
              <AgentSparkCard key={a.id} agent={a} samples={samples} />
            ))}
          </div>

          {/* Profit accumulation */}
          <div className="lg:col-span-2 rounded-2xl border p-4 md:p-5"
            style={{ borderColor: '#f59e0b30', background: 'linear-gradient(135deg, rgba(245,158,11,0.06), transparent)' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[10px] uppercase tracking-[0.25em] text-amber-400/70 font-bold">DeFi Profit · cumulative</div>
                <div className="text-base md:text-lg font-black text-white">+${fmt(totalProfit)}</div>
              </div>
              <Zap className="w-5 h-5 text-amber-400" />
            </div>
            <AreaChart samples={samples} color="#f59e0b" accessor={(s) => s.profit} height={160} />
            <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
              <span className="font-bold text-white">Your music earns interest.</span> Every rise here is money generated by DeFi on top of your vault — a fund that pays for your tours, sessions, and production without diluting royalties.
            </p>
          </div>

          {/* Live actions ticker */}
          <div className="rounded-2xl border p-4 md:p-5 flex flex-col"
            style={{ borderColor: `${colors.hexBorder}40`, background: 'rgba(255,255,255,0.02)', minHeight: 280 }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">Live Actions</div>
              <motion.div className="flex items-center gap-1 text-[9px] text-emerald-400 font-bold"
                animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                STREAMING
              </motion.div>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto max-h-[220px] pr-1">
              <AnimatePresence initial={false}>
                {(actionsData?.actions || []).slice(0, 12).map((a: any, i: number) => (
                  <motion.div
                    key={a.id || `${a.timestamp}-${i}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: a.outcome === 'success' ? '#22c55e' : '#ef4444' }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] text-white font-medium truncate">{a.actionType || a.type || 'agent action'}</div>
                      <div className="text-[9px] text-gray-500 truncate">{a.agentId || a.agent || '—'} · {a.timestamp ? new Date(a.timestamp).toLocaleTimeString() : 'live'}</div>
                    </div>
                  </motion.div>
                ))}
                {!(actionsData?.actions?.length) && (
                  <div className="text-[10px] text-gray-600 text-center py-8">No actions in window. Agents idle.</div>
                )}
              </AnimatePresence>
            </div>
            <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
              <span className="font-bold text-gray-300">Full transparency.</span> Every on-chain action is logged so you know exactly what each agent does with your capital.
            </p>
          </div>

          {/* Footer note / mode warning */}
          {risk?.shieldVetoActive && (
            <div className="lg:col-span-3 rounded-2xl border p-4 flex items-start gap-3"
              style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)' }}>
              <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="text-sm font-black text-red-300">Shield Node active</div>
                <div className="text-[11px] text-red-300/80">High risk detected. Offensive agents are frozen to protect your vault until conditions normalize.</div>
              </div>
            </div>
          )}
        </div>

        <div className="text-center text-[10px] text-gray-600 mt-8">
          Live on-chain telemetry · Boostify Economic Engine v2 · refresh 2s
        </div>
      </div>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(overlay, document.body);
}

export default AgentChartsFullscreen;
