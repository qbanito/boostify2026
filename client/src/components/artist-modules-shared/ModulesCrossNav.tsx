/**
 * ModulesCrossNav — horizontal pill bar to hop between the 6 Artist modules.
 * Drop into any module panel to give artists one-click navigation.
 *
 * Uses a controlled `activeModule` + `onChange` pattern so the parent
 * decides whether to scroll-to-section, route-change, or swap modal tabs.
 */
import { MODULE_IDS, MODULE_META, TOKENS, type ModuleId } from './tokens';

interface Props {
  active: ModuleId;
  onChange: (id: ModuleId) => void;
  health?: Partial<Record<ModuleId, boolean>>;
}

export function ModulesCrossNav({ active, onChange, health }: Props) {
  return (
    <nav
      className="flex items-center gap-1.5 px-2 py-1.5 rounded-xl overflow-x-auto"
      style={{
        background: TOKENS.SURFACE_2,
        border: `1px solid ${TOKENS.BORDER}`,
      }}
      data-testid="artist-modules-cross-nav"
      aria-label="Artist modules"
    >
      {MODULE_IDS.map((id) => {
        const meta = MODULE_META[id];
        const isActive = id === active;
        const isHealthy = health?.[id];
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-semibold whitespace-nowrap transition"
            style={{
              background: isActive
                ? `linear-gradient(135deg, ${meta.gradient[0]}, ${meta.gradient[1]})`
                : 'transparent',
              color: isActive ? '#050505' : TOKENS.TEXT,
              border: isActive ? 'none' : `1px solid ${TOKENS.BORDER_SOFT}`,
              boxShadow: isActive ? `0 0 18px ${meta.gradient[0]}55` : 'none',
            }}
            data-testid={`cross-nav-${id}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <span aria-hidden="true">{meta.emoji}</span>
            <span>{meta.short}</span>
            {isHealthy === false && (
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: TOKENS.DANGER }}
                aria-label="module unhealthy"
              />
            )}
          </button>
        );
      })}
    </nav>
  );
}
