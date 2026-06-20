import { memo } from "react";

interface ModuleSkeletonProps {
  /** Optional label shown faintly while the module chunk downloads. */
  label?: string;
  /** Approximate height of the placeholder. Defaults to a medium card. */
  height?: number;
  /** Render a compact (sidebar-widget) skeleton instead of a full section. */
  compact?: boolean;
}

/**
 * ModuleSkeleton
 *
 * Elegant, theme-consistent shimmer placeholder shown while a lazily-loaded
 * Artist Profile module downloads its JS chunk (via React.lazy + Suspense).
 *
 * Pure presentational + memoized so it never causes parent re-renders.
 */
function ModuleSkeletonBase({ label, height, compact = false }: ModuleSkeletonProps) {
  const h = height ?? (compact ? 160 : 280);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label ? `Loading ${label}` : "Loading module"}
      className="relative w-full overflow-hidden rounded-2xl border border-white/5"
      style={{
        minHeight: h,
        background:
          "linear-gradient(180deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.015) 100%)",
      }}
    >
      {/* Moving shimmer sweep */}
      <div
        className="absolute inset-0 -translate-x-full"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.06) 50%, transparent 100%)",
          animation: "boostify-skeleton-sweep 1.4s ease-in-out infinite",
        }}
      />

      <div className="relative p-4 sm:p-5 space-y-4">
        {/* Header row */}
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-white/5" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-1/3 rounded-full bg-white/5" />
            <div className="h-2.5 w-1/2 rounded-full bg-white/[0.04]" />
          </div>
        </div>

        {/* Body blocks */}
        {!compact && (
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 rounded-xl bg-white/[0.04]" />
            <div className="h-20 rounded-xl bg-white/[0.04]" />
          </div>
        )}

        <div className="space-y-2">
          <div className="h-2.5 w-full rounded-full bg-white/[0.04]" />
          <div className="h-2.5 w-5/6 rounded-full bg-white/[0.04]" />
          <div className="h-2.5 w-2/3 rounded-full bg-white/[0.04]" />
        </div>

        {label && (
          <p className="pt-1 text-[10px] font-medium uppercase tracking-wider text-white/25">
            {label}
          </p>
        )}
      </div>

      {/* Keyframes are injected once; scoped by unique animation name. */}
      <style>{`
        @keyframes boostify-skeleton-sweep {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

export const ModuleSkeleton = memo(ModuleSkeletonBase);
export default ModuleSkeleton;
