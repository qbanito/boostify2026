import React from "react";
import { motion } from "framer-motion";

interface SpinningVinylProps {
  /** 1000×1000 cover image URL — shown as center label on the disc */
  coverImage: string;
  /** Title text shown below the vinyl */
  title?: string;
  /** Subtitle (artist name / edition) */
  subtitle?: string;
  /** Whether the disc should spin (default: true) */
  spinning?: boolean;
  /** Size in px — disc + sleeve container (default: 280) */
  size?: number;
  /** Color of the vinyl: black | colored | picture-disc */
  vinylColor?: "black" | "colored" | "picture";
  /** Accent color hex for the sleeve gradient (default: #7c3aed) */
  accentColor?: string;
}

export function SpinningVinyl({
  coverImage,
  title,
  subtitle,
  spinning = true,
  size = 280,
  vinylColor = "black",
  accentColor = "#7c3aed",
}: SpinningVinylProps) {
  const discSize = size;
  const labelSize = Math.round(discSize * 0.36);
  const labelOffset = Math.round((discSize - labelSize) / 2);
  const grooveCount = 14;

  // Build groove colors based on vinyl type
  const baseVinyl =
    vinylColor === "black"
      ? "#111"
      : vinylColor === "colored"
      ? "#1a0a2e"
      : "transparent";
  const grooveBase =
    vinylColor === "black"
      ? "#222"
      : vinylColor === "colored"
      ? "#2d1060"
      : "rgba(255,255,255,0.08)";

  return (
    <div
      className="relative flex flex-col items-center select-none"
      style={{ width: discSize }}
    >
      {/* ── Disc shadow / glow ───────────────────────────────────────────── */}
      <div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: discSize,
          height: discSize,
          background: `radial-gradient(circle, ${accentColor}22 0%, transparent 70%)`,
          filter: "blur(24px)",
          transform: "translateY(12px)",
        }}
      />

      {/* ── Spinning disc ────────────────────────────────────────────────── */}
      <motion.div
        animate={spinning ? { rotate: 360 } : { rotate: 0 }}
        transition={
          spinning
            ? { duration: 3.6, repeat: Infinity, ease: "linear" }
            : { duration: 0.4 }
        }
        style={{
          width: discSize,
          height: discSize,
          borderRadius: "50%",
          position: "relative",
          background:
            vinylColor === "picture"
              ? `url(${coverImage}) center/cover`
              : baseVinyl,
          boxShadow: "0 4px 40px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.06)",
          overflow: "hidden",
        }}
      >
        {/* Groove rings */}
        {vinylColor !== "picture" &&
          Array.from({ length: grooveCount }).map((_, i) => {
            const r = 20 + i * (42 / grooveCount);
            return (
              <div
                key={i}
                className="absolute rounded-full pointer-events-none"
                style={{
                  top: `${r}%`,
                  left: `${r}%`,
                  right: `${r}%`,
                  bottom: `${r}%`,
                  border: `1px solid ${grooveBase}`,
                  opacity: 0.6 + i * 0.025,
                }}
              />
            );
          })}

        {/* Reflection arc */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "8%",
            left: "8%",
            width: "34%",
            height: "34%",
            borderRadius: "0 50% 50% 50%",
            background:
              "linear-gradient(135deg, rgba(255,255,255,0.18) 0%, transparent 60%)",
            transform: "rotate(-30deg)",
          }}
        />

        {/* Center label (for non-picture-disc) */}
        {vinylColor !== "picture" && (
          <div
            className="absolute rounded-full overflow-hidden"
            style={{
              width: labelSize,
              height: labelSize,
              top: labelOffset,
              left: labelOffset,
              boxShadow: "inset 0 0 12px rgba(0,0,0,0.5), 0 0 0 2px rgba(255,255,255,0.08)",
            }}
          >
            {coverImage ? (
              <img
                src={coverImage}
                alt={title || "vinyl label"}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white/40 text-xs"
                style={{ background: `linear-gradient(135deg, ${accentColor}88, #000)` }}
              >
                SIDE A
              </div>
            )}

            {/* Spindle hole */}
            <div
              className="absolute rounded-full bg-black"
              style={{
                width: Math.round(labelSize * 0.11),
                height: Math.round(labelSize * 0.11),
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                boxShadow: "0 0 0 2px rgba(255,255,255,0.15)",
              }}
            />
          </div>
        )}

        {/* Picture-disc spindle */}
        {vinylColor === "picture" && (
          <div
            className="absolute rounded-full bg-black"
            style={{
              width: Math.round(discSize * 0.04),
              height: Math.round(discSize * 0.04),
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              boxShadow: "0 0 0 2px rgba(255,255,255,0.2)",
            }}
          />
        )}
      </motion.div>

      {/* ── Caption ──────────────────────────────────────────────────────── */}
      {(title || subtitle) && (
        <div className="mt-4 text-center">
          {title && (
            <p className="text-white font-bold text-sm leading-tight">{title}</p>
          )}
          {subtitle && (
            <p className="text-zinc-400 text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
      )}
    </div>
  );
}
