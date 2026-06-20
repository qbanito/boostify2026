import { ReactNode } from 'react';
import { TOKENS } from './tokens';

interface SectionCardProps {
  number?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function SectionCard({
  number,
  title,
  action,
  children,
  className = '',
  bodyClassName = '',
}: SectionCardProps) {
  return (
    <div
      className={`rounded-2xl flex flex-col ${className}`}
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 32px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-3.5"
        style={{ borderBottom: `1px solid ${TOKENS.BORDER_SOFT}` }}
      >
        <h3
          className="text-[13.5px] font-semibold tracking-wide flex items-center gap-2"
          style={{ color: TOKENS.TEXT }}
        >
          {number && (
            <span
              className="text-[11px] font-mono"
              style={{ color: TOKENS.MUTED_2 }}
            >
              {number}
            </span>
          )}
          <span>{title}</span>
        </h3>
        {action}
      </div>
      <div className={`p-5 flex-1 ${bodyClassName}`}>{children}</div>
    </div>
  );
}
