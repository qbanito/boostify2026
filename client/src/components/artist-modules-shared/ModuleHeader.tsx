/**
 * ModuleHeader — unified header for the 6 Artist modules.
 * Left: emoji + module label + description; right: status pill + actions.
 */
import type { ReactNode } from 'react';
import { TOKENS, MODULE_META, type ModuleId } from './tokens';

interface Props {
  moduleId: ModuleId;
  healthy?: boolean;
  subtitle?: string;
  actions?: ReactNode;
}

export function ModuleHeader({ moduleId, healthy, subtitle, actions }: Props) {
  const meta = MODULE_META[moduleId];
  const statusColor = healthy === false ? TOKENS.DANGER : healthy === true ? TOKENS.POSITIVE : TOKENS.MUTED_2;
  const statusLabel = healthy === false ? 'Issue' : healthy === true ? 'Healthy' : 'Loading';

  return (
    <div
      className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl"
      style={{
        background: `linear-gradient(135deg, ${meta.gradient[0]}14, ${meta.gradient[1]}0a)`,
        border: `1px solid ${TOKENS.BORDER}`,
      }}
      data-testid={`module-header-${moduleId}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className="w-10 h-10 flex items-center justify-center rounded-lg text-xl"
          style={{
            background: `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`,
            boxShadow: `0 0 24px ${meta.gradient[0]}55`,
          }}
          aria-hidden="true"
        >
          {meta.emoji}
        </div>
        <div className="min-w-0">
          <div className="text-[15px] font-semibold truncate" style={{ color: TOKENS.TEXT }}>
            {meta.label}
          </div>
          <div className="text-[11.5px] truncate" style={{ color: TOKENS.MUTED }}>
            {subtitle || meta.description}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span
          className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
          style={{
            background: `${statusColor}1a`,
            color: statusColor,
            border: `1px solid ${statusColor}55`,
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
          {statusLabel}
        </span>
        {actions}
      </div>
    </div>
  );
}
