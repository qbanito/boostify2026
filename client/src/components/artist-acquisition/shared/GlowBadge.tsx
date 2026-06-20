import { ReactNode } from 'react';
import { TOKENS } from './tokens';

interface GlowBadgeProps {
  children: ReactNode;
  variant?: 'orange' | 'positive' | 'neutral';
  className?: string;
}

export function GlowBadge({
  children,
  variant = 'orange',
  className = '',
}: GlowBadgeProps) {
  const styles =
    variant === 'orange'
      ? {
          color: TOKENS.ORANGE_GLOW,
          background: TOKENS.ORANGE_SOFT,
          border: `1px solid ${TOKENS.ORANGE_RING}`,
        }
      : variant === 'positive'
      ? {
          color: TOKENS.POSITIVE,
          background: 'rgba(34,197,94,0.1)',
          border: '1px solid rgba(34,197,94,0.3)',
        }
      : {
          color: TOKENS.MUTED,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${TOKENS.BORDER}`,
        };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium ${className}`}
      style={styles}
    >
      {children}
    </span>
  );
}
