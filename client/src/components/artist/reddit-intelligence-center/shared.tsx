import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus, Flame } from 'lucide-react';

/** Reddit brand orange palette. */
export const RD_ORANGE = '#FF4500';

/** Glassmorphism card used across every Reddit panel. */
export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] ${className}`}>
      {children}
    </div>
  );
}

/** Live status dot — orange when data is fresh, slate when idle. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-500 opacity-70" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? 'bg-orange-500' : 'bg-slate-500'}`} />
    </span>
  );
}

const ACCENT_TEXT: Record<string, string> = {
  orange: 'text-orange-400', amber: 'text-amber-300', emerald: 'text-emerald-300',
  sky: 'text-sky-300', rose: 'text-rose-300', violet: 'text-violet-300',
};
export function StatTile({ label, value, accent = 'orange', sub }: { label: string; value: ReactNode; accent?: string; sub?: ReactNode }) {
  return (
    <GlassCard className="p-4">
      <div className={`text-2xl font-bold ${ACCENT_TEXT[accent] || ACCENT_TEXT.orange}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      {sub && <div className="mt-1 text-xs text-white/45">{sub}</div>}
    </GlassCard>
  );
}

export function PanelHeader({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/15 text-orange-400">{icon}</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Colored badge for scores / labels. */
export function Badge({ children, tone = 'orange' }: { children: ReactNode; tone?: 'orange' | 'emerald' | 'amber' | 'rose' | 'slate' | 'sky' }) {
  const tones: Record<string, string> = {
    orange: 'border-orange-400/30 bg-orange-400/10 text-orange-300',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    slate: 'border-white/15 bg-white/5 text-white/60',
    sky: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

/** Viral / match score chip with a flame icon, color-graded by value. */
export function ScoreBadge({ value, label = 'viral' }: { value: number; label?: string }) {
  const tone = value >= 75 ? 'rose' : value >= 55 ? 'orange' : value >= 35 ? 'amber' : 'slate';
  const colors: Record<string, string> = {
    rose: 'border-rose-400/40 bg-rose-500/15 text-rose-300',
    orange: 'border-orange-400/40 bg-orange-500/15 text-orange-300',
    amber: 'border-amber-400/40 bg-amber-500/15 text-amber-300',
    slate: 'border-white/15 bg-white/5 text-white/55',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold ${colors[tone]}`}>
      <Flame className="h-3.5 w-3.5" /> {value}
      <span className="text-[9px] font-medium uppercase opacity-70">{label}</span>
    </span>
  );
}

/** Growth indicator with up/down/flat arrow. */
export function GrowthIndicator({ value }: { value: number }) {
  if (value > 2) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400"><TrendingUp className="h-3.5 w-3.5" />+{value}%</span>;
  if (value < -2) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-400"><TrendingDown className="h-3.5 w-3.5" />{value}%</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-white/45"><Minus className="h-3.5 w-3.5" />{value}%</span>;
}

/** Thin progress bar (0..100). */
export function Metric({ label, value, max = 100, tone = 'orange' }: { label: string; value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bars: Record<string, string> = {
    orange: 'from-orange-500 to-red-500', emerald: 'from-emerald-500 to-teal-500',
    sky: 'from-sky-500 to-blue-500', amber: 'from-amber-500 to-orange-500',
  };
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span><span className="text-white/70">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full bg-gradient-to-r ${bars[tone] || bars.orange}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function SentimentPill({ label }: { label: string }) {
  const tone = label === 'positive' ? 'emerald' : label === 'negative' ? 'rose' : 'slate';
  return <Badge tone={tone as any}>{label}</Badge>;
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}

export function timeAgo(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

/** Empty state shown before the first scan. */
export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-2 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 text-orange-400">{icon}</div>
      <h4 className="text-base font-semibold text-white">{title}</h4>
      {hint && <p className="max-w-sm text-sm text-white/50">{hint}</p>}
    </GlassCard>
  );
}
