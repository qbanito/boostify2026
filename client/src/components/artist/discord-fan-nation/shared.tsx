import { ReactNode } from 'react';

/** Discord brand "blurple" palette. */
export const DC_BLURPLE = '#5865F2';
export const DC_GREEN = '#57F287';
export const DC_FUCHSIA = '#EB459E';

/** Glassmorphism card used across every Discord panel. */
export function GlassCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl shadow-[0_8px_40px_rgba(0,0,0,0.45)] ${className}`}>
      {children}
    </div>
  );
}

/** Live status dot — blurple when connected, slate when idle. */
export function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5">
      {active && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#5865F2] opacity-70" />}
      <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${active ? 'bg-[#5865F2]' : 'bg-slate-500'}`} />
    </span>
  );
}

const ACCENT_TEXT: Record<string, string> = {
  blurple: 'text-[#a5adfb]', indigo: 'text-indigo-300', emerald: 'text-emerald-300',
  sky: 'text-sky-300', rose: 'text-rose-300', violet: 'text-violet-300',
  amber: 'text-amber-300', fuchsia: 'text-fuchsia-300',
};
export function StatTile({ label, value, accent = 'blurple', sub }: { label: string; value: ReactNode; accent?: string; sub?: ReactNode }) {
  return (
    <GlassCard className="p-4">
      <div className={`text-2xl font-bold ${ACCENT_TEXT[accent] || ACCENT_TEXT.blurple}`}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-white/50">{label}</div>
      {sub && <div className="mt-1 text-xs text-white/45">{sub}</div>}
    </GlassCard>
  );
}

export function PanelHeader({ icon, title, subtitle, action }: { icon: ReactNode; title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5865F2]/15 text-[#a5adfb]">{icon}</div>
      <div className="min-w-0 flex-1">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {subtitle && <p className="text-sm text-white/55">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Colored badge for scores / labels. */
export function Badge({ children, tone = 'blurple' }: { children: ReactNode; tone?: 'blurple' | 'emerald' | 'amber' | 'rose' | 'slate' | 'sky' | 'fuchsia' }) {
  const tones: Record<string, string> = {
    blurple: 'border-[#5865F2]/30 bg-[#5865F2]/10 text-[#a5adfb]',
    emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
    slate: 'border-white/15 bg-white/5 text-white/60',
    sky: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
    fuchsia: 'border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-300',
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tones[tone]}`}>{children}</span>;
}

/** Discord role chip — colored from the role's integer color. */
export function RoleBadge({ name, color }: { name: string; color?: number }) {
  const hex = color && color > 0 ? `#${color.toString(16).padStart(6, '0')}` : '#99aab5';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium"
      style={{ borderColor: `${hex}55`, backgroundColor: `${hex}1a`, color: hex }}>
      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: hex }} />
      {name}
    </span>
  );
}

const TIER_TONE: Record<string, 'fuchsia' | 'blurple' | 'emerald' | 'slate'> = {
  'Super Fan': 'fuchsia', 'VIP Fan': 'blurple', 'Active Fan': 'emerald', Fan: 'slate',
};
export function TierBadge({ tier }: { tier?: string }) {
  return <Badge tone={TIER_TONE[tier || 'Fan'] || 'slate'}>{tier || 'Fan'}</Badge>;
}

/** Thin progress bar (0..100). */
export function Metric({ label, value, max = 100, tone = 'blurple' }: { label: string; value: number; max?: number; tone?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const bars: Record<string, string> = {
    blurple: 'from-[#5865F2] to-indigo-500', emerald: 'from-emerald-500 to-teal-500',
    sky: 'from-sky-500 to-blue-500', amber: 'from-amber-500 to-orange-500',
    fuchsia: 'from-fuchsia-500 to-pink-500',
  };
  return (
    <div>
      <div className="mb-1 flex justify-between text-[11px] text-white/55">
        <span>{label}</span><span className="text-white/70">{Math.round(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
        <div className={`h-full rounded-full bg-gradient-to-r ${bars[tone] || bars.blurple}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Primary blurple button. */
export function DCButton({ children, onClick, disabled, variant = 'primary', className = '', type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit';
}) {
  const variants: Record<string, string> = {
    primary: 'bg-[#5865F2] hover:bg-[#4752c4] text-white shadow-[0_4px_20px_rgba(88,101,242,0.35)]',
    ghost: 'bg-white/5 hover:bg-white/10 text-white/80 border border-white/10',
    danger: 'bg-rose-500/90 hover:bg-rose-500 text-white',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

/** Text / textarea input shell. */
export function DCInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-[#5865F2]/60 ${props.className || ''}`} />;
}
export function DCTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder-white/35 outline-none focus:border-[#5865F2]/60 ${props.className || ''}`} />;
}

export function fmtCompact(n: number): string {
  return Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
}
export function fmtMoney(n: number): string {
  return `$${Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Math.round(n || 0))}`;
}
export function timeAgo(ms: number): string {
  if (!ms) return '—';
  const diff = (Date.now() - ms) / 1000;
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.round(diff / 60)}m`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h`;
  return `${Math.round(diff / 86400)}d`;
}

/** Empty state shown before connecting / first action. */
export function EmptyState({ icon, title, hint, action }: { icon: ReactNode; title: string; hint?: string; action?: ReactNode }) {
  return (
    <GlassCard className="flex flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/10 text-[#a5adfb]">{icon}</div>
      <h4 className="text-base font-semibold text-white">{title}</h4>
      {hint && <p className="max-w-sm text-sm text-white/50">{hint}</p>}
      {action}
    </GlassCard>
  );
}
