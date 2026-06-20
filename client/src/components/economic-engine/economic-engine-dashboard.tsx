/**
 * ECONOMIC ENGINE DASHBOARD â€” Layer 3 Control Panel (v2)
 * Premium glassmorphism design with animated vault donut chart,
 * sparkline agent performance, and real-time neural network visualization
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Activity, Shield, Zap, Brain, TrendingUp, DollarSign,
  Power, ChevronRight, ChevronDown, BarChart3, Lock, Unlock, AlertTriangle,
  Satellite, Cpu, Layers, ArrowUpRight, ArrowDownRight,
  Eye, EyeOff, Settings, RefreshCw, Circle, Wallet, Send, CheckCircle2,
  Loader2, ExternalLink, Droplets, Target, Gauge, CreditCard
} from 'lucide-react';
import { useToast } from '../../hooks/use-toast';
import { AgentChartsFullscreen } from './agent-charts-fullscreen';
import { CexTradingPanel } from './cex-trading-panel';

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// TYPES
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

interface AgentNode {
  id: string;
  name: string;
  icon: typeof Activity;
  status: 'active' | 'idle' | 'frozen' | 'alert';
  description: string;
  allocation: number;
  color: string;
  sparkline?: number[];
}

interface DashboardProps {
  artistId: number | string;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder: string;
  };
  isAdmin?: boolean;
}

const safeNum = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANIMATED BACKGROUND MESH
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function GlowMesh({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full blur-[80px]"
        style={{ background: `${color}08` }}
        animate={{ rotate: [0, 360] }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute -bottom-1/3 -left-1/3 w-2/3 h-2/3 rounded-full blur-[60px]"
        style={{ background: `${color}06` }}
        animate={{ rotate: [360, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SPARKLINE MINI CHART
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function Sparkline({ data, color, width = 60, height = 24 }: {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}) {
  if (!data.length) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={`spark-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill={`url(#spark-${color.replace('#', '')})`}
      />
    </svg>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VAULT DONUT CHART
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function VaultDonut({ segments, totalValue, accent }: {
  segments: { label: string; value: number; color: string }[];
  totalValue: number;
  accent: string;
}) {
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 52;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;

  let currentOffset = 0;
  const arcs = segments.map((seg) => {
    const pct = totalValue > 0 ? seg.value / totalValue : 0;
    const dashLength = pct * circumference;
    const gap = circumference - dashLength;
    const offset = -currentOffset;
    currentOffset += dashLength;
    return { ...seg, pct, dashLength, gap, offset };
  });

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Background ring */}
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={strokeWidth} />

        {/* Segment arcs */}
        {arcs.map((arc, i) => (
          <motion.circle
            key={arc.label}
            cx={cx} cy={cy} r={radius}
            fill="none"
            stroke={arc.color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arc.dashLength} ${arc.gap}`}
            strokeDashoffset={arc.offset}
            transform={`rotate(-90 ${cx} ${cy})`}
            initial={{ strokeDasharray: `0 ${circumference}` }}
            animate={{ strokeDasharray: `${arc.dashLength} ${arc.gap}` }}
            transition={{ duration: 1, delay: i * 0.15, ease: 'easeOut' }}
            style={{ filter: `drop-shadow(0 0 4px ${arc.color}40)` }}
          />
        ))}

        {/* Inner glow */}
        <circle cx={cx} cy={cy} r={radius - strokeWidth / 2 - 2} fill="none" stroke={`${accent}10`} strokeWidth="1" />
      </svg>

      {/* Center label */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-lg font-black text-white tracking-tight"
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
        >
          ${totalValue >= 1000 ? `${(totalValue / 1000).toFixed(1)}k` : totalValue.toFixed(0)}
        </motion.span>
        <span className="text-[9px] text-gray-500 uppercase tracking-widest">Total Vault</span>
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// NEURAL NETWORK VISUALIZATION (improved)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function NeuralNetwork({ agents, accent, primary }: {
  agents: AgentNode[];
  accent: string;
  primary: string;
}) {
  const centerX = 130;
  const centerY = 80;
  const radius = 58;

  const positions = agents.map((_, i) => {
    const angle = (i / agents.length) * Math.PI * 2 - Math.PI / 2;
    return {
      x: safeNum(centerX + Math.cos(angle) * radius, centerX),
      y: safeNum(centerY + Math.sin(angle) * radius, centerY),
    };
  });

  return (
    <svg viewBox="0 0 260 160" className="w-full h-auto" style={{ maxHeight: 145 }}>
      <defs>
        <radialGradient id="ng2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.2" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Central glow orb */}
      <circle cx={centerX} cy={centerY} r="40" fill="url(#ng2)" />

      {/* Connection lines */}
      {positions.map((pos, i) => (
        <motion.line
          key={`ln-${i}`}
          x1={centerX} y1={centerY} x2={pos.x} y2={pos.y}
          stroke={`${primary}40`}
          strokeWidth="1"
          strokeDasharray="3 4"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 1.2, delay: i * 0.2 }}
        />
      ))}

      {/* Cross connections */}
      {positions.map((pos, i) => {
        const next = positions[(i + 1) % positions.length];
        return (
          <motion.line
            key={`cr-${i}`}
            x1={pos.x} y1={pos.y} x2={next.x} y2={next.y}
            stroke={`${primary}15`} strokeWidth="0.7"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, delay: 0.8 + i * 0.1 }}
          />
        );
      })}

      {/* Data pulses */}
      {positions.map((pos, i) => {
        if (agents[i]?.status !== 'active') return null;
        const pulseX = safeNum(pos?.x, centerX);
        const pulseY = safeNum(pos?.y, centerY);
        return (
          <motion.circle
            key={`p-${i}`}
            cx={centerX} cy={centerY} r={2.5}
            fill={accent} filter="url(#glow2)"
            initial={{ x: 0, y: 0, opacity: 1 }}
            animate={{ x: [0, pulseX - centerX], y: [0, pulseY - centerY], opacity: [1, 0] }}
            transition={{ duration: 2, delay: i * 0.8, ease: 'easeOut' }}
          />
        );
      })}

      {/* Center node */}
      <motion.circle
        cx={centerX} cy={centerY} r="16"
        fill="none" stroke={accent} strokeWidth="1.5"
        initial={{ strokeOpacity: 0.4 }}
        animate={{ strokeOpacity: 1 }}
        transition={{ duration: 1 }}
      />
      <motion.circle
        cx={centerX} cy={centerY} r={10}
        fill={`${accent}18`} stroke={accent} strokeWidth="0.5"
      />
      <text x={centerX} y={centerY + 1} textAnchor="middle" dominantBaseline="middle"
        fill={accent} fontSize="8" fontWeight="800" fontFamily="monospace">
        L3
      </text>

      {/* Agent nodes */}
      {positions.map((pos, i) => {
        const agent = agents[i];
        const sc = agent.status === 'active' ? '#22c55e' : agent.status === 'alert' ? '#f59e0b' : agent.status === 'frozen' ? '#6b7280' : '#3b82f6';
        const nodeX = safeNum(pos?.x, centerX);
        const nodeY = safeNum(pos?.y, centerY);
        return (
          <g key={`nd-${i}`}>
            {/* Outer glow */}
            <motion.circle
              cx={nodeX} cy={nodeY} r="20"
              fill={`${agent.color}08`} stroke={`${agent.color}30`} strokeWidth="0.5"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.3 + i * 0.12 }}
            />
            {/* Main circle */}
            <motion.circle
              cx={nodeX} cy={nodeY} r="14"
              fill={`${agent.color}12`} stroke={agent.color} strokeWidth="1.2"
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: 'spring', delay: 0.35 + i * 0.12 }}
            />
            {/* Status dot */}
            <motion.circle
              cx={safeNum(nodeX + 10, centerX + 10)} cy={safeNum(nodeY - 10, centerY - 10)} r={3}
              fill={sc} stroke="#111" strokeWidth="0.5"
            />
            {/* Label */}
            <text x={nodeX} y={safeNum(nodeY + 1, centerY + 1)} textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="6.5" fontWeight="700" fontFamily="system-ui">
              {agent.id.split('_').map(w => w[0]?.toUpperCase()).join('')}
            </text>
            <text x={nodeX} y={safeNum(nodeY + 26, centerY + 26)} textAnchor="middle"
              fill="rgba(255,255,255,0.5)" fontSize="5.5">
              {agent.name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AGENT CARD (Glassmorphism row)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function AgentCard({ agent, accent, onClick }: { agent: AgentNode; accent: string; onClick?: () => void }) {
  const Icon = agent.icon;
  const statusMap = {
    active: { color: '#22c55e', label: 'LIVE', bg: 'rgba(34,197,94,0.1)' },
    idle: { color: '#3b82f6', label: 'IDLE', bg: 'rgba(59,130,246,0.1)' },
    frozen: { color: '#6b7280', label: 'OFF', bg: 'rgba(107,114,128,0.1)' },
    alert: { color: '#f59e0b', label: 'ALERT', bg: 'rgba(245,158,11,0.1)' },
  };
  const st = statusMap[agent.status];

  return (
    <motion.div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`relative flex items-center gap-3 p-3 rounded-xl border backdrop-blur-sm overflow-hidden group ${onClick ? 'cursor-pointer' : ''}`}
      style={{
        borderColor: `${agent.color}15`,
        background: `linear-gradient(135deg, ${agent.color}06, transparent)`,
      }}
      whileHover={{ scale: 1.01, borderColor: `${agent.color}30` }}
      transition={{ duration: 0.15 }}
    >
      {/* Agent icon */}
      <div className="relative flex-shrink-0">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${agent.color}15`, boxShadow: `0 0 12px ${agent.color}15` }}
        >
          <Icon className="w-4.5 h-4.5" style={{ color: agent.color }} />
        </div>
        <motion.div
          className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
          style={{ background: st.color, borderColor: '#111' }}
          animate={agent.status === 'active' ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs font-bold text-white">{agent.name}</span>
          <span
            className="text-[8px] px-1.5 py-0.5 rounded-full font-black tracking-wider"
            style={{ background: st.bg, color: st.color }}
          >
            {st.label}
          </span>
        </div>
        <div className="text-[10px] text-gray-500 truncate">{agent.description}</div>
      </div>

      {/* Sparkline + allocation */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {agent.sparkline && <Sparkline data={agent.sparkline} color={agent.color} width={48} height={20} />}
        <div className="text-right">
          <span className="text-[10px] font-bold text-white">{agent.allocation}%</span>
          <span className="block text-[8px] text-gray-600">SHARE</span>
        </div>
      </div>
    </motion.div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// VAULT BALANCE CARD
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function VaultBalanceCard({ label, value, icon: Icon, color, subtext }: {
  label: string;
  value: string;
  icon: typeof DollarSign;
  color: string;
  subtext?: string;
}) {
  return (
    <motion.div
      className="relative p-3 rounded-xl border backdrop-blur-sm overflow-hidden"
      style={{
        borderColor: `${color}15`,
        background: `linear-gradient(145deg, ${color}08, transparent)`,
      }}
      whileHover={{ scale: 1.02, y: -1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-2 mb-1">
        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: `${color}15` }}>
          <Icon className="w-3.5 h-3.5" style={{ color }} />
        </div>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="text-sm font-black text-white tracking-tight">{value}</div>
      {subtext && <div className="text-[9px] text-gray-600 mt-0.5">{subtext}</div>}
    </motion.div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// OPERATING MODE SELECTOR (redesigned)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const MODES = [
  { id: 'survival', label: 'Survival', color: '#ef4444', icon: AlertTriangle, desc: 'Preservar capital' },
  { id: 'defense', label: 'Defense', color: '#f59e0b', icon: Shield, desc: 'Reducir riesgo' },
  { id: 'stable', label: 'Stable', color: '#3b82f6', icon: Activity, desc: 'Crecimiento balanceado' },
  { id: 'expansion', label: 'Expansion', color: '#22c55e', icon: TrendingUp, desc: 'Enfoque crecimiento' },
  { id: 'aggressive', label: 'Aggressive', color: '#a855f7', icon: Zap, desc: 'Max yield' },
] as const;

function ModeSelector({ currentMode, accent, onChange, disabled }: {
  currentMode: string;
  accent: string;
  onChange: (mode: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {MODES.map((mode) => {
        const isActive = currentMode === mode.id;
        const Icon = mode.icon;
        return (
          <motion.button
            key={mode.id}
            onClick={() => !disabled && onChange(mode.id)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-all border ${
              disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
            }`}
            style={{
              borderColor: isActive ? `${mode.color}60` : 'rgba(255,255,255,0.06)',
              background: isActive ? `${mode.color}18` : 'transparent',
              color: isActive ? mode.color : '#6b7280',
              boxShadow: isActive ? `0 0 12px ${mode.color}15` : 'none',
            }}
            whileHover={!disabled ? { scale: 1.05 } : {}}
            whileTap={!disabled ? { scale: 0.95 } : {}}
          >
            <Icon className="w-3 h-3" />
            {mode.label}
          </motion.button>
        );
      })}
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// ANIMATED HEALTH GAUGE
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function HealthGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = Math.min(Math.max(value, 0), 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: `linear-gradient(90deg, ${color}80, ${color})` }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </div>
      <span className="text-[10px] font-bold text-white w-8 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// METAMASK FUND VAULT (compact)
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const POLYGON_CHAIN_ID = '0x89';
const POLYGON_USDC_ADDRESS = '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359';

function FundVaultPanel({ artistId, accent, onDeposit }: {
  artistId: number | string;
  accent: string;
  onDeposit?: () => void;
}) {
  const { toast } = useToast();
  const [fundMethod, setFundMethod] = useState<'crypto' | 'card'>('crypto');
  const [step, setStep] = useState<'idle' | 'connecting' | 'amount' | 'sending' | 'confirming' | 'done'>('idle');
  const [walletAddress, setWalletAddress] = useState('');
  const [treasuryAddress, setTreasuryAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [selectedToken, setSelectedToken] = useState<'MATIC' | 'USDC'>('MATIC');
  const [txHash, setTxHash] = useState('');
  const [error, setError] = useState('');
  const [swapperLoading, setSwapperLoading] = useState(false);

  const USDC_ADDRESS = POLYGON_USDC_ADDRESS;
  const USDC_DECIMALS = 6;

  const [cardAmount, setCardAmount] = useState('50');

  // Open Stripe Checkout for card deposit
  const openStripeCheckout = useCallback(async () => {
    const numAmount = parseFloat(cardAmount);
    if (isNaN(numAmount) || numAmount < 5 || numAmount > 10000) {
      setError('Amount must be between $5 and $10,000');
      return;
    }
    setSwapperLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/economic-engine/wallet/create-checkout/${artistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ amount: numAmount }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        setError(data.message || 'Failed to create checkout session');
      }
    } catch (err: any) {
      setError('Failed to start payment. Please try again.');
      console.error('Stripe checkout error:', err);
    } finally {
      setSwapperLoading(false);
    }
  }, [cardAmount, artistId]);

  // Auto-confirm vault deposit after Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('vault_deposit') === 'success' && params.get('session_id')) {
      const sessionId = params.get('session_id')!;
      fetch('/api/economic-engine/wallet/confirm-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sessionId }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.success) {
            toast({ title: 'Deposit Confirmed', description: `$${d.deposit?.amount?.toFixed(2) || ''} deposited to your vault` });
            onDeposit?.();
          }
          // Clean URL params
          const url = new URL(window.location.href);
          url.searchParams.delete('vault_deposit');
          url.searchParams.delete('session_id');
          window.history.replaceState({}, '', url.toString());
        })
        .catch(() => {});
    }
  }, [toast, onDeposit]);

  useEffect(() => {
    fetch('/api/economic-engine/wallet/treasury-address')
      .then(r => r.json())
      .then(d => { if (d.success) setTreasuryAddress(d.address); })
      .catch(() => {});
  }, []);

  const connectMetaMask = async () => {
    setError('');
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      setError('Install MetaMask to fund your vault.');
      return;
    }
    try {
      setStep('connecting');
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      setWalletAddress(accounts[0]);
      try {
        await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: POLYGON_CHAIN_ID }] });
      } catch (switchErr: any) {
        if (switchErr.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: POLYGON_CHAIN_ID,
              chainName: 'Polygon Mainnet',
              nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
              rpcUrls: ['https://polygon-rpc.com'],
              blockExplorerUrls: ['https://polygonscan.com'],
            }],
          });
        }
      }
      setStep('amount');
    } catch (err: any) {
      setError(err.message || 'Failed to connect');
      setStep('idle');
    }
  };

  const sendTransaction = async () => {
    const ethereum = (window as any).ethereum;
    if (!ethereum || !walletAddress) return;
    if (!treasuryAddress) {
      setError('Treasury not configured');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Enter a valid amount');
      return;
    }
    setError('');
    setStep('sending');

    try {
      let hash: string;
      if (selectedToken === 'MATIC') {
        const weiValue = '0x' + BigInt(Math.floor(numAmount * 1e18)).toString(16);
        hash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: treasuryAddress, value: weiValue }],
        });
      } else {
        const usdcAmount = BigInt(Math.floor(numAmount * 10 ** USDC_DECIMALS));
        const transferData = '0xa9059cbb' +
          treasuryAddress.slice(2).padStart(64, '0') +
          usdcAmount.toString(16).padStart(64, '0');
        hash = await ethereum.request({
          method: 'eth_sendTransaction',
          params: [{ from: walletAddress, to: USDC_ADDRESS, data: transferData }],
        });
      }

      setTxHash(hash);
      setStep('confirming');

      const res = await fetch(`/api/economic-engine/wallet/record-deposit/${artistId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ txHash: hash, amount: numAmount.toString(), token: selectedToken, senderAddress: walletAddress }),
      });

      const data = await res.json();
      if (data.success) {
        setStep('done');
        toast({ title: 'Deposit Recorded', description: `$${numAmount.toFixed(2)} ${selectedToken} deposited` });
        onDeposit?.();
      } else {
        setError(data.message || 'Failed to record');
        setStep('amount');
      }
    } catch (err: any) {
      setError(err.code === 4001 ? 'Transaction rejected' : err.message || 'Transaction failed');
      setStep('amount');
    }
  };

  const reset = () => { setStep('idle'); setAmount(''); setTxHash(''); setError(''); };

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: `${accent}15`, background: 'rgba(255,255,255,0.02)' }}>
      <div className="p-3">
        <div className="flex items-center gap-2 mb-2.5">
          <Wallet className="w-3.5 h-3.5" style={{ color: accent }} />
          <span className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Fund Vault</span>
          <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 font-mono">Polygon</span>
        </div>

        {/* Funding method selector */}
        <div className="flex gap-1.5 mb-3">
          {([{ id: 'crypto', label: 'MetaMask', icon: Wallet }, { id: 'card', label: 'Card / Fiat', icon: CreditCard }] as const).map(m => (
            <button
              key={m.id}
              onClick={() => { setFundMethod(m.id as 'crypto' | 'card'); setError(''); }}
              className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg text-[10px] font-bold border transition-all"
              style={{
                borderColor: fundMethod === m.id ? accent : 'rgba(255,255,255,0.06)',
                background: fundMethod === m.id ? `${accent}12` : 'transparent',
                color: fundMethod === m.id ? accent : '#6b7280',
              }}
            >
              <m.icon className="w-3 h-3" />
              {m.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* === CARD DEPOSIT via Stripe Checkout === */}
          {fundMethod === 'card' && (
            <motion.div key="card" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="text-[10px] text-gray-500 mb-2 leading-relaxed">
                Deposit with Visa, Mastercard or any card. Funds go directly into your vault.
              </div>
              {/* Amount selector */}
              <div className="flex gap-1.5 mb-2.5">
                {['25', '50', '100', '250'].map(preset => (
                  <button
                    key={preset}
                    onClick={() => setCardAmount(preset)}
                    className="flex-1 text-[10px] font-bold py-1.5 rounded-lg border transition-all"
                    style={{
                      borderColor: cardAmount === preset ? accent : 'rgba(255,255,255,0.06)',
                      background: cardAmount === preset ? `${accent}12` : 'transparent',
                      color: cardAmount === preset ? accent : '#6b7280',
                    }}
                  >
                    ${preset}
                  </button>
                ))}
              </div>
              <div className="relative mb-2.5">
                <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                <input
                  type="number"
                  min="5"
                  max="10000"
                  value={cardAmount}
                  onChange={e => setCardAmount(e.target.value)}
                  className="w-full bg-black/40 border rounded-lg pl-7 pr-3 py-2 text-xs text-white font-mono focus:outline-none"
                  style={{ borderColor: `${accent}30` }}
                  placeholder="Custom amount"
                />
              </div>
              <motion.button
                onClick={openStripeCheckout}
                disabled={swapperLoading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all disabled:opacity-40"
                style={{ background: `linear-gradient(135deg, ${accent}40, ${accent}20)`, border: `1px solid ${accent}30` }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {swapperLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {swapperLoading ? 'Redirecting...' : `Deposit $${cardAmount || '0'} with Card`}
              </motion.button>
              <div className="flex items-center gap-1.5 mt-2 text-[9px] text-gray-600">
                <Shield className="w-3 h-3" />
                Secured by Stripe — PCI-DSS compliant
              </div>
            </motion.div>
          )}

          {/* === CRYPTO via MetaMask === */}
          {fundMethod === 'crypto' && step === 'idle' && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.button
                onClick={connectMetaMask}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white transition-all"
                style={{ background: `linear-gradient(135deg, ${accent}25, ${accent}10)`, border: `1px solid ${accent}30` }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <Wallet className="w-4 h-4" />
                Connect MetaMask
              </motion.button>
              {treasuryAddress && (
                <div className="mt-2 text-[9px] text-gray-600 text-center font-mono truncate">
                  Treasury: {treasuryAddress.slice(0, 10)}...{treasuryAddress.slice(-6)}
                </div>
              )}
            </motion.div>
          )}

          {fundMethod === 'crypto' && step === 'connecting' && (
            <motion.div key="conn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-3 text-xs text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: accent }} />
              Connecting...
            </motion.div>
          )}

          {fundMethod === 'crypto' && step === 'amount' && (
            <motion.div key="amt" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </div>
              <div className="flex gap-1.5">
                {(['MATIC', 'USDC'] as const).map(t => (
                  <button key={t} onClick={() => setSelectedToken(t)}
                    className="flex-1 px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-all"
                    style={{
                      borderColor: selectedToken === t ? accent : 'rgba(255,255,255,0.06)',
                      background: selectedToken === t ? `${accent}12` : 'transparent',
                      color: selectedToken === t ? accent : '#6b7280',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder={`Amount in ${selectedToken}`} min="0" step="0.01"
                  className="w-full px-3 py-2 bg-black/30 border rounded-lg text-sm text-white placeholder:text-gray-600 focus:outline-none"
                  style={{ borderColor: `${accent}25` }}
                />
              </div>
              <motion.button
                onClick={sendTransaction} disabled={!amount || parseFloat(amount) <= 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(34,197,94,0.1))', border: '1px solid rgba(34,197,94,0.3)' }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              >
                <Send className="w-3.5 h-3.5" />
                {amount ? `Send ${amount} ${selectedToken}` : 'Send Funds'}
              </motion.button>
            </motion.div>
          )}

          {fundMethod === 'crypto' && step === 'sending' && (
            <motion.div key="send" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 animate-spin text-yellow-500" />
              <span className="text-xs text-gray-400">Confirm in MetaMask...</span>
            </motion.div>
          )}

          {fundMethod === 'crypto' && step === 'confirming' && (
            <motion.div key="conf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-4">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: accent }} />
              <span className="text-xs text-gray-400">Recording deposit...</span>
              {txHash && (
                <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] hover:underline" style={{ color: accent }}>
                  View on PolygonScan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

          {fundMethod === 'crypto' && step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-2 py-3">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}>
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </motion.div>
              <span className="text-xs font-bold text-green-400">Deposit Successful!</span>
              <span className="text-[10px] text-gray-500">{amount} {selectedToken} added to vault</span>
              {txHash && (
                <a href={`https://polygonscan.com/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] hover:underline" style={{ color: accent }}>
                  View tx <ExternalLink className="w-3 h-3" />
                </a>
              )}
              <button onClick={reset} className="text-[10px] mt-1 px-3 py-1 rounded-md hover:bg-white/5 text-gray-400">Fund Again</button>
            </motion.div>
          )}
        </AnimatePresence>

        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="mt-2 px-2 py-1.5 rounded text-[10px] text-red-400 bg-red-500/10 border border-red-500/20">
            {error}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MAIN DASHBOARD COMPONENT
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// ═════════════════════════════════════════════════
// TRADER INTELLIGENCE PANEL — institutional KPIs + macro signal
// ═════════════════════════════════════════════════

function KpiTile({ label, value, tone, hint }: {
  label: string;
  value: string;
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  hint?: string;
}) {
  const toneColor = tone === 'good' ? '#22c55e' : tone === 'warn' ? '#f59e0b' : tone === 'bad' ? '#ef4444' : '#94a3b8';
  return (
    <div
      className="rounded-lg px-2.5 py-2 min-w-0"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}
      title={hint}
    >
      <div className="text-[8px] text-gray-500 uppercase tracking-wider font-bold truncate">{label}</div>
      <div className="text-sm font-black tracking-tight truncate" style={{ color: toneColor }}>{value}</div>
    </div>
  );
}

function TraderIntelligencePanel({ artistId, accent }: { artistId: number | string; accent: string }) {
  const { data: analyticsData, isLoading: kpisLoading } = useQuery({
    queryKey: ['economic-engine-analytics', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/${artistId}/analytics`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 120000,
    retry: 1,
  });

  const { data: macroData } = useQuery({
    queryKey: ['economic-engine-macro', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/${artistId}/macro`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 300000,
    retry: 1,
  });

  const k = analyticsData?.kpis;
  const macro = macroData?.macro;
  const macroLevel = safeNum(macro?.level, -1);
  const macroColor = macroLevel < 0 ? '#6b7280' : macroLevel >= 70 ? '#ef4444' : macroLevel >= 45 ? '#f59e0b' : '#22c55e';

  const fmt = (v: unknown, digits = 2) => {
    const n = safeNum(v, NaN);
    return Number.isFinite(n) ? n.toFixed(digits) : '—';
  };
  const ratioTone = (v: unknown, good: number, ok: number): 'good' | 'warn' | 'bad' | 'neutral' => {
    const n = safeNum(v, NaN);
    if (!Number.isFinite(n)) return 'neutral';
    return n >= good ? 'good' : n >= ok ? 'warn' : 'bad';
  };

  const hasTrades = safeNum(k?.totalTrades, 0) > 0;
  const winRatePct = safeNum(k?.winRate, 0) <= 1 ? safeNum(k?.winRate, 0) * 100 : safeNum(k?.winRate, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold flex items-center gap-1.5">
          <Brain className="w-3 h-3" style={{ color: accent }} />
          Trader Intelligence
        </div>
        {k?.periodDays != null && (
          <span className="text-[8px] text-gray-600 font-mono flex-shrink-0">{k.periodDays}d window</span>
        )}
      </div>

      {/* Macro risk strip */}
      <div
        className="rounded-xl px-3 py-2.5 mb-2"
        style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${macroColor}25` }}
      >
        <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <Satellite className="w-3 h-3" style={{ color: macroColor }} />
            Macro Risk
          </span>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] font-black capitalize" style={{ color: macroColor }}>
              {macro?.riskLabel || 'loading…'}
            </span>
            {macroLevel >= 0 && (
              <span className="text-[9px] font-mono text-gray-500">{macroLevel}/100</span>
            )}
            {macro?.recommendedMode && (
              <span className="text-[8px] px-1.5 py-0.5 rounded-md font-bold uppercase" style={{ background: `${macroColor}15`, color: macroColor }}>
                → {macro.recommendedMode}
              </span>
            )}
          </div>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: macroColor }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.max(macroLevel, 0)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        {Array.isArray(macro?.factors) && macro.factors.length > 0 && (
          <p className="text-[8px] text-gray-600 mt-1.5 leading-tight line-clamp-2">
            {macro.factors.slice(0, 3).join(' · ')}
          </p>
        )}
      </div>

      {/* Institutional KPI grid */}
      {kpisLoading ? (
        <div className="flex items-center gap-2 px-3 py-3 text-[10px] text-gray-500">
          <Loader2 className="w-3 h-3 animate-spin" /> Computing institutional KPIs…
        </div>
      ) : k ? (
        <>
          <div className="grid grid-cols-2 min-[360px]:grid-cols-3 sm:grid-cols-4 gap-1.5">
            <KpiTile label="Sharpe" value={fmt(k.sharpeRatio)} tone={ratioTone(k.sharpeRatio, 1.5, 0.8)} hint="Risk-adjusted return (>1.5 elite)" />
            <KpiTile label="Sortino" value={fmt(k.sortinoRatio)} tone={ratioTone(k.sortinoRatio, 2, 1)} hint="Downside-risk-adjusted return" />
            <KpiTile label="Calmar" value={fmt(k.calmarRatio)} tone={ratioTone(k.calmarRatio, 1, 0.5)} hint="Return vs max drawdown" />
            <KpiTile label="Win Rate" value={hasTrades ? `${winRatePct.toFixed(0)}%` : '—'} tone={hasTrades ? ratioTone(winRatePct, 55, 45) : 'neutral'} hint="Winning trades %" />
            <KpiTile label="Profit Factor" value={hasTrades ? fmt(k.profitFactor) : '—'} tone={hasTrades ? ratioTone(k.profitFactor, 1.6, 1.1) : 'neutral'} hint="Gross profit / gross loss (>1.6 strong)" />
            <KpiTile label="Max DD" value={`${fmt(k.maxDrawdownPct, 1)}%`} tone={safeNum(k.maxDrawdownPct, 0) <= 8 ? 'good' : safeNum(k.maxDrawdownPct, 0) <= 15 ? 'warn' : 'bad'} hint="Worst peak-to-trough loss" />
            <KpiTile label="Volatility" value={`${fmt(k.volatilityPct, 1)}%`} tone="neutral" hint="Annualized volatility" />
            <KpiTile label="Expectancy" value={hasTrades ? `$${fmt(k.expectancy)}` : '—'} tone={hasTrades ? (safeNum(k.expectancy, 0) > 0 ? 'good' : 'bad') : 'neutral'} hint="Expected $ per trade" />
          </div>
          <div className="flex items-center justify-between gap-2 mt-1.5 px-1 flex-wrap">
            <span className="text-[8px] text-gray-600">
              {safeNum(k.totalTrades, 0)} trades · P&L ${fmt(k.totalReturnUsd)} ({fmt(k.totalReturnPct, 1)}%)
            </span>
            <span className="text-[8px] text-gray-600 font-mono">ATR stops · trailing · vol-sized</span>
          </div>
        </>
      ) : (
        <p className="text-[9px] text-gray-600 px-1">No analytics yet — KPIs appear after the first trades.</p>
      )}
    </div>
  );
}

export function EconomicEngineDashboard({ artistId, colors, isAdmin }: DashboardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [localMode, setLocalMode] = useState('stable');
  const [chartsOpen, setChartsOpen] = useState(false);

  // Fetch engine status
  const { data: statusData } = useQuery({
    queryKey: ['economic-engine-status', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/agents/${artistId}/status`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch vault data
  const { data: vaultData } = useQuery({
    queryKey: ['economic-engine-vault', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/vault/${artistId}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch risk state
  const { data: riskData } = useQuery({
    queryKey: ['economic-engine-risk', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/risk/${artistId}`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch recent agent actions
  const { data: actionsData } = useQuery({
    queryKey: ['economic-engine-actions', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/economic-engine/agents/${artistId}/actions?limit=5`);
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 60000,
    retry: 1,
  });

  // Mode change mutation
  const modeMutation = useMutation({
    mutationFn: async (mode: string) => {
      const res = await fetch(`/api/economic-engine/admin/set-mode/${artistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, reason: 'Dashboard mode change' }),
      });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['economic-engine-status', artistId] });
      queryClient.invalidateQueries({ queryKey: ['economic-engine-risk', artistId] });
      toast({ title: 'Mode updated', description: `Mode â†’ ${localMode}` });
    },
  });

  // Toggle engine mutation
  const toggleMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/economic-engine/admin/toggle/${artistId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['economic-engine-status', artistId] });
      toast({
        title: data.isEnabled ? 'Engine Activated' : 'Engine Paused',
        description: data.isEnabled ? 'Autonomous treasury management is live' : 'Funds are safe â€” engine paused',
      });
    },
  });

  // Toggle Day Trading (Market Hunter) mutation
  const toggleDayTradingMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/economic-engine/admin/toggle-day-trading/${artistId}`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['economic-engine-status', artistId] });
      toast({
        title: data.dayTradingEnabled ? 'Day Trading Activated' : 'Day Trading Paused',
        description: data.dayTradingEnabled
          ? '⚠️ Modo direccional activo · stop-loss -3% · take-profit +5%'
          : 'Market Hunter detenido — solo yield estable activo',
      });
    },
  });

  const vault = vaultData?.vault;
  const risk = riskData?.riskState;
  const engineEnabled = statusData?.isEnabled ?? false;
  const currentMode = statusData?.currentMode || risk?.currentMode || 'stable';
  const realModeActive = statusData?.realMode?.active ?? false;
  const dayTradingEnabled = statusData?.profile?.dayTradingEnabled ?? false;

  useEffect(() => { setLocalMode(currentMode); }, [currentMode]);

  // Generate fake sparklines for agents (would come from real data in production)
  const generateSparkline = (base: number, volatility: number) =>
    Array.from({ length: 12 }, () => base + (Math.random() - 0.5) * volatility);

  const agents: AgentNode[] = useMemo(() => [
    {
      id: 'capital_keeper', name: 'Capital Keeper', icon: Shield,
      status: !engineEnabled ? 'idle' : (risk?.shieldVetoActive ? 'alert' : 'active'),
      description: 'Aave V3 Lending Â· Treasury preservation',
      allocation: 40, color: '#3b82f6',
      sparkline: generateSparkline(60, 15),
    },
    {
      id: 'flow_maker', name: 'Flow Maker', icon: Droplets,
      status: !engineEnabled ? 'idle' : 'active',
      description: 'Uniswap V3 LP Â· Yield optimization',
      allocation: 30, color: '#22c55e',
      sparkline: generateSparkline(45, 20),
    },
    {
      id: 'alpha_hunter', name: 'Alpha Hunter', icon: Target,
      status: !engineEnabled ? 'idle' :
        (currentMode === 'survival' || currentMode === 'defense') ? 'frozen' :
        (risk?.shieldVetoActive ? 'frozen' : 'active'),
      description: '1inch Aggregator Â· Cross-DEX arbitrage',
      allocation: 10, color: '#a855f7',
      sparkline: generateSparkline(25, 30),
    },
    {
      id: 'shield_node', name: 'Shield Node', icon: Gauge,
      status: !engineEnabled ? 'idle' : (risk?.shieldVetoActive ? 'alert' : 'active'),
      description: 'Risk monitor Â· Circuit breaker',
      allocation: 20, color: '#f59e0b',
      sparkline: generateSparkline(80, 8),
    },
    {
      id: 'market_hunter', name: 'Market Hunter', icon: TrendingUp,
      status: !engineEnabled ? 'idle' :
        !dayTradingEnabled ? 'idle' :
        (currentMode === 'survival' || currentMode === 'defense') ? 'frozen' :
        (risk?.shieldVetoActive ? 'frozen' : 'active'),
      description: 'Day trading · Momentum & mean-reversion',
      allocation: dayTradingEnabled ? 10 : 0, color: '#ef4444',
      sparkline: generateSparkline(50, 35),
    },
  ], [engineEnabled, risk?.shieldVetoActive, currentMode, dayTradingEnabled]);

  // Vault calculation
  const opBal = parseFloat(vault?.operationBalance || '0');
  const resBal = parseFloat(vault?.reserveBalance || '0');
  const groBal = parseFloat(vault?.growthBalance || '0');
  const defiBal = parseFloat(vault?.defiBalance || '0');
  const totalVault = opBal + resBal + groBal + defiBal;
  const totalProfit = parseFloat(vault?.totalDefiProfit || '0');
  const healthScore = parseFloat(risk?.healthScore || '85');
  const drawdown = parseFloat(vault?.currentDrawdown || '0');

  const donutSegments = [
    { label: 'Operation', value: opBal, color: '#22c55e' },
    { label: 'Reserve', value: resBal, color: '#3b82f6' },
    { label: 'Growth', value: groBal, color: '#a855f7' },
    { label: 'DeFi', value: defiBal, color: '#f59e0b' },
  ];

  const modeConfig = MODES.find(m => m.id === currentMode);
  const activeAgents = agents.filter(a => a.status === 'active').length;

  return (
    <motion.div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        borderColor: `${colors.hexBorder}80`,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.3) 100%)',
        backdropFilter: 'blur(20px)',
      }}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <GlowMesh color={colors.hexAccent} />

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ HEADER â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className="relative z-10 px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <motion.div
              className="w-9 h-9 rounded-xl flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${colors.hexAccent}20, ${colors.hexAccent}08)`,
                boxShadow: engineEnabled ? `0 0 20px ${colors.hexAccent}15` : 'none',
              }}
              animate={engineEnabled ? { rotate: [0, 3, -3, 0] } : {}}
              transition={{ duration: 5, repeat: Infinity }}
            >
              <Cpu className="w-4.5 h-4.5" style={{ color: colors.hexAccent }} />
              {engineEnabled && (
                <motion.div
                  className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border border-black"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              )}
            </motion.div>
            <div>
              <h3 className="text-sm font-black text-white flex items-center gap-2 tracking-tight">
                Economic Engine
                <span className="text-[8px] px-2 py-0.5 rounded-full font-black tracking-widest" style={{
                  background: engineEnabled ? 'rgba(34,197,94,0.12)' : 'rgba(107,114,128,0.12)',
                  color: engineEnabled ? '#22c55e' : '#6b7280',
                  boxShadow: engineEnabled ? '0 0 8px rgba(34,197,94,0.15)' : 'none',
                }}>
                  {engineEnabled ? 'LIVE' : 'OFF'}
                </span>
                {engineEnabled && (
                  <span
                    className="text-[8px] px-2 py-0.5 rounded-full font-black tracking-widest ml-1"
                    title={realModeActive
                      ? 'Treasury wallet configured — running real Polygon operations'
                      : 'Simulation mode — set TREASURY_WALLET_PRIVATE_KEY in Render to go live on-chain'}
                    style={{
                      background: realModeActive ? 'rgba(168,85,247,0.15)' : 'rgba(245,158,11,0.12)',
                      color: realModeActive ? '#a855f7' : '#f59e0b',
                      boxShadow: realModeActive ? '0 0 8px rgba(168,85,247,0.2)' : 'none',
                    }}
                  >
                    {realModeActive ? 'REAL' : 'SIM'}
                  </span>
                )}
              </h3>
              <p className="text-[10px] text-gray-500 flex items-center gap-1.5">
                Layer 3 Â· Autonomous Treasury
                {modeConfig && (
                  <span className="px-1.5 py-0.5 rounded-md text-[8px] font-bold" style={{ background: `${modeConfig.color}15`, color: modeConfig.color }}>
                    {modeConfig.label}
                  </span>
                )}
              </p>
            </div>
          </div>

          {isAdmin && (
            <motion.button
              onClick={() => toggleMutation.mutate()}
              className="relative w-11 h-6 rounded-full transition-all"
              style={{
                background: engineEnabled
                  ? `linear-gradient(135deg, ${colors.hexAccent}50, ${colors.hexAccent}25)`
                  : 'rgba(107,114,128,0.2)',
                border: `1px solid ${engineEnabled ? colors.hexAccent + '40' : 'rgba(107,114,128,0.3)'}`,
              }}
              whileTap={{ scale: 0.95 }}
              disabled={toggleMutation.isPending}
            >
              <motion.div
                className="absolute top-0.5 w-5 h-5 rounded-full"
                style={{ background: engineEnabled ? colors.hexAccent : '#6b7280' }}
                animate={{ left: engineEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          )}
        </div>

        {/* ───────── DAY TRADING TOGGLE (admin opt-in, separate switch) ───────── */}
        {isAdmin && engineEnabled && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between gap-3 mb-4 px-3 py-2 rounded-lg"
            style={{
              background: dayTradingEnabled ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${dayTradingEnabled ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp size={14} style={{ color: dayTradingEnabled ? '#ef4444' : '#94a3b8' }} />
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wider" style={{ color: dayTradingEnabled ? '#ef4444' : '#94a3b8' }}>
                  DAY TRADING · MARKET HUNTER
                </p>
                <p className="text-[9px] opacity-70 leading-tight">
                  {dayTradingEnabled
                    ? '⚠️ Modo direccional activo · SL/TP dinámicos por ATR · trailing stop · max 2 trades · 10% del DeFi vault'
                    : 'Capa opcional de trading direccional (alto riesgo, opt-in)'}
                </p>
              </div>
            </div>
            <motion.button
              onClick={() => toggleDayTradingMutation.mutate()}
              className="relative w-11 h-6 rounded-full transition-all flex-shrink-0"
              style={{
                background: dayTradingEnabled
                  ? 'linear-gradient(135deg, rgba(239,68,68,0.5), rgba(239,68,68,0.25))'
                  : 'rgba(107,114,128,0.2)',
                border: `1px solid ${dayTradingEnabled ? 'rgba(239,68,68,0.4)' : 'rgba(107,114,128,0.3)'}`,
              }}
              whileTap={{ scale: 0.95 }}
              disabled={toggleDayTradingMutation.isPending}
            >
              <motion.div
                className="absolute top-0.5 w-5 h-5 rounded-full"
                style={{ background: dayTradingEnabled ? '#ef4444' : '#6b7280' }}
                animate={{ left: dayTradingEnabled ? 22 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </motion.div>
        )}

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ NEURAL NETWORK â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        
        {/* CEX TRADING — Funding Rate Arbitrage */}
        <div className="rounded-xl overflow-hidden mb-4 p-4" style={{ background: 'rgba(59,130,246,0.04)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <CexTradingPanel artistId={Number(artistId)} colors={{ hexAccent: colors.hexAccent }} />
        </div>
<motion.div
          className="rounded-xl overflow-hidden mb-4"
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: `1px solid ${colors.hexBorder}40`,
          }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <NeuralNetwork agents={agents} accent={colors.hexAccent} primary={colors.hexPrimary} />
        </motion.div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ VAULT DONUT + BALANCES â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="flex flex-col min-[420px]:flex-row items-center min-[420px]:items-start gap-3 mb-4 cursor-pointer"
          role="button"
          tabIndex={0}
          onClick={() => setChartsOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChartsOpen(true); } }}
          title="Open live mission control"
        >
          {/* Donut */}
          <div className="flex-shrink-0">
            <VaultDonut segments={donutSegments} totalValue={totalVault} accent={colors.hexAccent} />
            {/* Legend */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2">
              {donutSegments.map(seg => (
                <div key={seg.label} className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: seg.color }} />
                  <span className="text-[8px] text-gray-500">{seg.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Balance cards grid */}
          <div className="flex-1 w-full min-w-0 grid grid-cols-2 gap-1.5">
            <VaultBalanceCard label="Operation" value={`$${opBal.toFixed(0)}`} icon={DollarSign} color="#22c55e" subtext="Active liquidity" />
            <VaultBalanceCard label="Reserve" value={`$${resBal.toFixed(0)}`} icon={Shield} color="#3b82f6" subtext="Safety net" />
            <VaultBalanceCard label="Growth" value={`$${groBal.toFixed(0)}`} icon={TrendingUp} color="#a855f7" subtext="Strategic" />
            <VaultBalanceCard label="DeFi" value={`$${defiBal.toFixed(0)}`} icon={Zap} color="#f59e0b" subtext={`+$${totalProfit.toFixed(0)} profit`} />
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ HEALTH GAUGES â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <div
          className="space-y-2 mb-4 p-3 rounded-xl cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${colors.hexBorder}20` }}
          role="button"
          tabIndex={0}
          onClick={() => setChartsOpen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setChartsOpen(true); } }}
          title="Open live mission control"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider font-bold">System Health</span>
            <span className="text-[10px] font-bold" style={{ color: activeAgents === agents.length ? '#22c55e' : '#f59e0b' }}>
              {activeAgents}/{agents.length} agents
            </span>
          </div>
          <div className="space-y-1.5">
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-500">Health Score</span>
              </div>
              <HealthGauge value={healthScore} label="Health" color={healthScore > 70 ? '#22c55e' : healthScore > 40 ? '#f59e0b' : '#ef4444'} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-500">Stability (Drawdown)</span>
              </div>
              <HealthGauge value={100 - drawdown} label="Stability" color={colors.hexAccent} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-gray-500">DeFi ROI</span>
              </div>
              <HealthGauge value={totalVault > 0 ? Math.min((totalProfit / totalVault) * 100 * 10, 100) : 0} label="ROI" color="#a855f7" />
            </div>
          </div>
        </div>

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ FUND VAULT (admin) â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        {isAdmin && (
          <div className="mb-3">
            <FundVaultPanel
              artistId={artistId}
              accent={colors.hexAccent}
              onDeposit={() => {
                queryClient.invalidateQueries({ queryKey: ['economic-engine-vault', artistId] });
                queryClient.invalidateQueries({ queryKey: ['economic-engine-status', artistId] });
              }}
            />
          </div>
        )}

        {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ EXPAND BUTTON â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
        <motion.button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-bold rounded-xl transition-all hover:bg-white/[0.03]"
          style={{ color: colors.hexAccent, border: `1px solid ${colors.hexBorder}20` }}
        >
          {expanded ? 'Hide Controls' : 'Agent Controls & Details'}
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </motion.button>
      </div>

      {/* â”€â”€â”€â”€â”€â”€â”€â”€â”€ EXPANDED SECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Operating Mode */}
              {isAdmin && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">Operating Mode</div>
                  <ModeSelector
                    currentMode={localMode}
                    accent={colors.hexAccent}
                    onChange={(mode) => { setLocalMode(mode); modeMutation.mutate(mode); }}
                    disabled={!engineEnabled || modeMutation.isPending}
                  />
                </div>
              )}

              {!isAdmin && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border" style={{ borderColor: `${colors.hexAccent}15` }}>
                  <span className="text-[10px] text-gray-500">Mode:</span>
                  <span className="text-xs font-black capitalize" style={{ color: modeConfig?.color || colors.hexAccent }}>
                    {currentMode}
                  </span>
                  <span className="text-[9px] text-gray-600 ml-auto">{modeConfig?.desc}</span>
                </div>
              )}

              {/* Agent Cards */}
              <div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">DeFi Agents</div>
                <div className="space-y-2">
                  {agents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} accent={colors.hexAccent} onClick={() => setChartsOpen(true)} />
                  ))}
                </div>
              </div>

              {/* Trader Intelligence — institutional KPIs + macro signal */}
              <TraderIntelligencePanel artistId={artistId} accent={colors.hexAccent} />

              {/* Recent Activity */}
              {actionsData?.actions && actionsData.actions.length > 0 && (
                <div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-2 font-bold">Recent Activity</div>
                  <div className="space-y-1">
                    {actionsData.actions.slice(0, 5).map((action: any, idx: number) => (
                      <motion.div
                        key={action.id || idx}
                        className="flex items-start gap-2 px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.02)' }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.08 }}
                      >
                        <div className="mt-1 flex-shrink-0">
                          <div
                            className="w-1.5 h-1.5 rounded-full"
                            style={{ background: action.outcome === 'success' ? '#22c55e' : '#ef4444' }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[10px] text-gray-400 block truncate">{action.reason}</span>
                        </div>
                        <span className="text-[9px] text-gray-600 flex-shrink-0 font-mono">
                          {action.agentType?.replace('_', ' ').split(' ').map((w: string) => w[0]?.toUpperCase()).join('')}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Shield Veto Warning */}
              {risk?.shieldVetoActive && (
                <motion.div
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-yellow-500/25 bg-yellow-500/8"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                  <div className="text-[10px]">
                    <span className="font-bold text-yellow-400">Shield Veto Active</span>
                    <span className="block text-yellow-500/70 mt-0.5">{risk.shieldVetoReason || 'Risk threshold exceeded'}</span>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen real-time mission control */}
      <AnimatePresence>
        {chartsOpen && (
          <AgentChartsFullscreen
            artistId={artistId}
            colors={colors}
            onClose={() => setChartsOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
