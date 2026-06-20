/**
 * SectionCard — Reusable wrapper for all profile sections
 * Provides consistent styling, expand/collapse, header layout, and a
 * universal fullscreen toggle (renders the section as an overlay that
 * fills the viewport on both mobile and desktop).
 */
import {
  useEffect,
  useState,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  type LucideIcon,
} from "lucide-react";

export interface SectionCardColors {
  hexAccent: string;
  hexPrimary: string;
  hexBorder: string;
  cardBg: string;
  cardBorder: string;
  shadow: string;
  preview: string[];
}

interface SectionCardProps {
  sectionId: string;
  icon: LucideIcon;
  title: string;
  count?: number | string;
  expanded: boolean;
  onToggleExpand: () => void;
  colors: SectionCardColors;
  headerRight?: ReactNode;
  children: ReactNode;
  className?: string;
  /**
   * If true (default), the card shows a fullscreen toggle button.
   * Disable per-section if a module owns its own fullscreen UX.
   */
  fullscreenable?: boolean;
}

export function SectionCard({
  sectionId,
  icon: Icon,
  title,
  count,
  expanded,
  onToggleExpand,
  colors,
  headerRight,
  children,
  className = "",
  fullscreenable = true,
}: SectionCardProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Esc to exit fullscreen + lock body scroll while open
  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isFullscreen]);

  // When opening fullscreen, ensure section is expanded so content renders.
  useEffect(() => {
    if (isFullscreen && !expanded) onToggleExpand();
  }, [isFullscreen, expanded, onToggleExpand]);

  const glowBorder =
    colors.cardBorder === "glow"
      ? `0 0 15px ${colors.hexAccent}25, inset 0 0 15px ${colors.hexAccent}08`
      : "";

  const cardStyle: React.CSSProperties = {
    background: colors.cardBg,
    borderColor:
      colors.cardBorder === "gradient" ? "transparent" : colors.hexBorder,
    borderWidth: "1px",
    borderStyle: "solid",
    ...(colors.cardBorder === "gradient"
      ? {
          borderImage: `linear-gradient(135deg, ${colors.preview[0]}, ${colors.preview[1]}, ${colors.preview[2]}) 1`,
        }
      : {}),
    ...(glowBorder ? { boxShadow: glowBorder } : {}),
    backdropFilter: "blur(12px)",
  };

  const fsButton = fullscreenable ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setIsFullscreen((v) => !v);
      }}
      className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
      style={{ color: colors.hexAccent }}
      aria-label={isFullscreen ? "Exit full screen" : "Open in full screen"}
      title={isFullscreen ? "Exit full screen" : "Open in full screen"}
      data-testid={`button-fullscreen-${sectionId}`}
    >
      {isFullscreen ? (
        <Minimize2 className="h-4 w-4" />
      ) : (
        <Maximize2 className="h-4 w-4" />
      )}
    </button>
  ) : null;

  // Fullscreen overlay (portaled to body so it escapes any parent overflow)
  const fullscreenOverlay = isFullscreen
    ? createPortal(
        <div
          className="fixed inset-0 z-[55] flex flex-col bg-[#08080c]/95 backdrop-blur-2xl animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label={`${title} — full screen`}
          style={{
            paddingLeft: "env(safe-area-inset-left, 0px)",
            paddingRight: "env(safe-area-inset-right, 0px)",
          }}
        >
          <div
            className="flex items-center gap-3 px-4 sm:px-6 border-b border-white/10"
            style={{
              background: colors.cardBg,
              paddingTop:
                "max(0.75rem, calc(env(safe-area-inset-top, 0px) + 0.5rem))",
              paddingBottom: "0.75rem",
            }}
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${colors.hexAccent}18` }}
            >
              <Icon className="h-5 w-5" style={{ color: colors.hexAccent }} />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white truncate flex-1">
              {title}
            </h2>
            {count !== undefined && count !== null && (
              <span
                className="hidden sm:inline-flex text-[11px] font-medium px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${colors.hexAccent}18`,
                  color: colors.hexAccent,
                }}
              >
                {count}
              </span>
            )}
            <div className="flex items-center gap-2">{headerRight}</div>
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="ml-1 w-9 h-9 rounded-lg flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close full screen"
              title="Close (Esc)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div
            className="flex-1 overflow-y-auto overscroll-contain px-3 sm:px-6 py-4"
            style={{
              paddingBottom:
                "max(8rem, calc(env(safe-area-inset-bottom, 0px) + 6rem))",
            }}
          >
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <div
        className={`rounded-2xl p-5 shadow-lg ${colors.shadow} transition-all duration-300 overflow-hidden ${className}`}
        style={cardStyle}
        data-section-id={sectionId}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            onClick={onToggleExpand}
            className="flex-1 text-left flex items-center gap-2.5 group/header hover:opacity-90 transition-opacity min-w-0"
            data-testid={`button-toggle-section-${sectionId}`}
          >
            <div
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
              style={{ backgroundColor: `${colors.hexAccent}12` }}
            >
              {expanded ? (
                <ChevronDown
                  className="h-4 w-4 transition-transform"
                  style={{ color: colors.hexAccent }}
                />
              ) : (
                <ChevronRight
                  className="h-4 w-4 transition-transform"
                  style={{ color: colors.hexAccent }}
                />
              )}
            </div>
            <Icon
              className="h-[18px] w-[18px] flex-shrink-0"
              style={{ color: colors.hexAccent }}
            />
            <span className="text-[15px] font-semibold text-white truncate">
              {title}
            </span>
            {count !== undefined && count !== null && (
              <span
                className="flex-shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-md"
                style={{
                  backgroundColor: `${colors.hexAccent}12`,
                  color: colors.hexAccent,
                }}
              >
                {count}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {headerRight}
            {fsButton}
          </div>
        </div>

        {expanded && !isFullscreen && (
          <div className="mt-4 animate-in fade-in slide-in-from-top-1 duration-200">
            {children}
          </div>
        )}
      </div>
      {fullscreenOverlay}
    </>
  );
}

/**
 * SectionEmptyState — Consistent empty state for sections
 */
export function SectionEmptyState({
  icon: Icon,
  message,
  hint,
  accentColor,
}: {
  icon: LucideIcon;
  message: string;
  hint?: string;
  accentColor: string;
}) {
  return (
    <div className="text-center py-10">
      <div
        className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3"
        style={{ backgroundColor: `${accentColor}10` }}
      >
        <Icon className="h-6 w-6 opacity-40" style={{ color: accentColor }} />
      </div>
      <p className="text-sm text-gray-400">{message}</p>
      {hint && <p className="text-xs text-gray-600 mt-1.5">{hint}</p>}
    </div>
  );
}
