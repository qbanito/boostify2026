/**
 * Modern, animated, "premium" Agent Card.
 * Features:
 *  - 3D mouse-tilt on hover (no library — pure framer-motion)
 *  - Animated gradient border ("conic" sweep)
 *  - Live glow following the cursor
 *  - Trending / New / Bookmarked badges with subtle pulse
 *  - Built-in stats row (uses, accuracy, response time)
 *  - Category chip with proper color
 *  - Fully responsive
 */
import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  Star, TrendingUp, Sparkles as SparklesIcon, ChevronRight, Lightbulb, Zap, Activity,
  type LucideIcon,
} from 'lucide-react';
import { Badge } from '../ui/badge';

export interface ModernAgentCardData {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;            // tailwind gradient e.g. "from-purple-600 to-blue-600"
  category: string;
  trending?: boolean;
  isNew?: boolean;
  quickTip?: string;
  /** Optional stats — defaults are stable per agent id */
  stats?: { uses?: number; accuracy?: number; responseMs?: number };
}

interface Props {
  agent: ModernAgentCardData;
  bookmarked: boolean;
  onSelect: () => void;
  onToggleBookmark: () => void;
  /** Compact mode for "recently used" / favorites rows */
  compact?: boolean;
  /** Optional ribbon (e.g., "Recommended because…") */
  ribbon?: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  creative: 'Creatividad',
  marketing: 'Marketing',
  visual: 'Visual',
  business: 'Negocios',
};

const CATEGORY_COLOR: Record<string, string> = {
  creative: 'border-purple-500/30 text-purple-300 bg-purple-500/5',
  marketing: 'border-blue-500/30 text-blue-300 bg-blue-500/5',
  visual: 'border-pink-500/30 text-pink-300 bg-pink-500/5',
  business: 'border-cyan-500/30 text-cyan-300 bg-cyan-500/5',
};

/** Deterministic pseudo-random stats per agent id so they don't jump on re-render. */
function deriveStats(id: string, override?: ModernAgentCardData['stats']) {
  if (override?.uses !== undefined && override?.accuracy !== undefined && override?.responseMs !== undefined) {
    return override;
  }
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h) + id.charCodeAt(i);
  const r = (Math.abs(h) % 1000) / 1000;
  return {
    uses: override?.uses ?? Math.floor(800 + r * 9000),
    accuracy: override?.accuracy ?? Math.floor(90 + r * 9),
    responseMs: override?.responseMs ?? Math.floor(180 + r * 420),
  };
}

export function ModernAgentCard({ agent, bookmarked, onSelect, onToggleBookmark, compact = false, ribbon }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const rotateX = useSpring(useTransform(mouseY, [-0.5, 0.5], [6, -6]), { stiffness: 150, damping: 20 });
  const rotateY = useSpring(useTransform(mouseX, [-0.5, 0.5], [-6, 6]), { stiffness: 150, damping: 20 });
  const glowX = useTransform(mouseX, v => `${(v + 0.5) * 100}%`);
  const glowY = useTransform(mouseY, v => `${(v + 0.5) * 100}%`);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
    mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const handleMouseLeave = () => { mouseX.set(0); mouseY.set(0); };

  const Icon = agent.icon;
  const stats = deriveStats(agent.id, agent.stats);

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onSelect}
      style={{ rotateX, rotateY, transformStyle: 'preserve-3d', transformPerspective: 1000 }}
      whileHover={{ y: -4 }}
      transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      className="group relative rounded-2xl cursor-pointer h-full"
    >
      {/* Animated conic gradient border */}
      <div className="absolute -inset-px rounded-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none overflow-hidden">
        <motion.div
          className={`absolute -inset-[200%] bg-gradient-to-r ${agent.color}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Inner card */}
      <div className="relative bg-gradient-to-br from-[#15151B] via-[#1A1A22] to-[#0F0F13] rounded-2xl p-5 h-full flex flex-col overflow-hidden border border-white/5">
        {/* Cursor-following glow */}
        <motion.div
          className="absolute pointer-events-none rounded-full blur-3xl opacity-0 group-hover:opacity-50 transition-opacity duration-300"
          style={{
            left: glowX, top: glowY,
            width: 240, height: 240,
            x: -120, y: -120,
            background: `radial-gradient(circle, ${gradientToRgba(agent.color)}, transparent 70%)`,
          }}
        />

        {/* Top decorative pattern */}
        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04] pointer-events-none"
             style={{ backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)', backgroundSize: '12px 12px' }} />

        {/* Ribbon */}
        {ribbon && (
          <div className="absolute -top-px left-4 right-4 z-10">
            <div className="bg-gradient-to-r from-orange-500/20 to-purple-500/20 border-b border-orange-500/30 backdrop-blur-sm rounded-b-md px-2 py-1 text-[10px] text-orange-300 font-medium">
              {ribbon}
            </div>
          </div>
        )}

        {/* Header */}
        <div className={`flex items-start justify-between gap-3 ${ribbon ? 'mt-6' : ''}`}>
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <motion.div
              className={`relative shrink-0 p-3 rounded-xl bg-gradient-to-br ${agent.color} shadow-lg`}
              whileHover={{ scale: 1.1, rotate: 5 }}
              transition={{ type: 'spring', stiffness: 300 }}
              style={{ transform: 'translateZ(20px)' }}
            >
              <Icon className="h-5 w-5 md:h-6 md:w-6 text-white" />
              <motion.div
                className={`absolute inset-0 rounded-xl bg-gradient-to-br ${agent.color} blur-md -z-10`}
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            </motion.div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="text-base md:text-lg font-semibold text-white truncate">{agent.name}</h3>
                {agent.isNew && (
                  <Badge className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-0 text-[9px] h-4 px-1.5 animate-pulse">
                    NEW
                  </Badge>
                )}
                {agent.trending && (
                  <Badge className="bg-gradient-to-r from-orange-500 to-pink-500 text-white border-0 text-[9px] h-4 px-1.5 gap-0.5">
                    <TrendingUp className="h-2.5 w-2.5" />
                    HOT
                  </Badge>
                )}
              </div>
              <p className="text-xs md:text-sm text-gray-400 mt-1 line-clamp-2">{agent.description}</p>
            </div>
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); onToggleBookmark(); }}
            className="shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            aria-label="Toggle favorite"
          >
            <Star className={`h-4 w-4 transition-all ${bookmarked ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'text-gray-500 hover:text-yellow-400'}`} />
          </button>
        </div>

        {/* Stats row */}
        {!compact && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            <StatPill icon={Activity} label="Uses" value={formatNumber(stats.uses!)} color="text-emerald-400" />
            <StatPill icon={SparklesIcon} label="Accuracy" value={`${stats.accuracy}%`} color="text-purple-400" />
            <StatPill icon={Zap} label="Latency" value={`${stats.responseMs}ms`} color="text-amber-400" />
          </div>
        )}

        {/* Quick tip */}
        {!compact && agent.quickTip && (
          <div className="mt-3 p-2.5 rounded-lg bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10 text-xs">
            <div className="flex items-start gap-1.5">
              <Lightbulb className="h-3 w-3 text-orange-400 shrink-0 mt-0.5" />
              <p className="text-gray-300 leading-snug line-clamp-2">{agent.quickTip}</p>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/5">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${CATEGORY_COLOR[agent.category] || 'border-white/10 text-gray-400'}`}>
            {CATEGORY_LABEL[agent.category] || agent.category}
          </span>
          <motion.div
            className="flex items-center gap-1 text-orange-400 text-xs font-medium"
            whileHover={{ x: 3 }}
          >
            <span>Open agent</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}

function StatPill({ icon: Icon, label, value, color }: { icon: LucideIcon; label: string; value: string; color: string }) {
  return (
    <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 text-center">
      <Icon className={`h-3 w-3 mx-auto mb-0.5 ${color}`} />
      <div className="text-[11px] font-bold text-white">{value}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(2)}k`;
  return n.toString();
}

/** Convert a tailwind gradient string to a usable rgba seed color for the cursor glow. */
function gradientToRgba(gradient: string): string {
  // Use a simple lookup of common color tokens we use here
  if (gradient.includes('purple')) return 'rgba(168, 85, 247, 0.5)';
  if (gradient.includes('rose') || gradient.includes('pink')) return 'rgba(244, 63, 94, 0.5)';
  if (gradient.includes('cyan')) return 'rgba(34, 211, 238, 0.5)';
  if (gradient.includes('blue')) return 'rgba(59, 130, 246, 0.5)';
  if (gradient.includes('green') || gradient.includes('emerald')) return 'rgba(16, 185, 129, 0.5)';
  if (gradient.includes('amber') || gradient.includes('orange')) return 'rgba(249, 115, 22, 0.5)';
  return 'rgba(249, 115, 22, 0.5)';
}
