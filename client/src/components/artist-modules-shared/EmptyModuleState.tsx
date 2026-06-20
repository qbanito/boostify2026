/**
 * EmptyModuleState — reusable onboarding/empty-state CTA for artist modules.
 * Matches the Boostify Apple-minimal preset.
 */
import type { ReactNode } from 'react';
import { TOKENS } from './tokens';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  testId?: string;
}

export function EmptyModuleState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  testId,
}: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-3 px-6 py-12 rounded-xl"
      style={{ background: TOKENS.SURFACE_2, border: `1px dashed ${TOKENS.BORDER}` }}
      data-testid={testId || 'module-empty-state'}
    >
      {icon && (
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: TOKENS.ORANGE_SOFT, color: TOKENS.ORANGE_GLOW }}
        >
          {icon}
        </div>
      )}
      <div className="text-[15px] font-semibold" style={{ color: TOKENS.TEXT }}>
        {title}
      </div>
      {description && (
        <div className="text-[12.5px] max-w-md leading-relaxed" style={{ color: TOKENS.MUTED }}>
          {description}
        </div>
      )}
      {(actionLabel || secondaryLabel) && (
        <div className="flex items-center gap-2 mt-2">
          {actionLabel && onAction && (
            <button
              onClick={onAction}
              className="px-4 py-2 rounded-lg text-[12.5px] font-semibold transition"
              style={{
                background: TOKENS.ORANGE,
                color: '#050505',
                boxShadow: `0 0 24px ${TOKENS.ORANGE_RING}`,
              }}
              data-testid={testId ? `${testId}-action` : 'module-empty-action'}
            >
              {actionLabel}
            </button>
          )}
          {secondaryLabel && onSecondary && (
            <button
              onClick={onSecondary}
              className="px-4 py-2 rounded-lg text-[12.5px] font-semibold transition"
              style={{
                background: 'transparent',
                color: TOKENS.TEXT,
                border: `1px solid ${TOKENS.BORDER}`,
              }}
              data-testid={testId ? `${testId}-secondary` : 'module-empty-secondary'}
            >
              {secondaryLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
