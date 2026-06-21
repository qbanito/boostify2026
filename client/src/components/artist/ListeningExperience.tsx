/**
 * ListeningExperience — full-screen "spectacular" futuristic visualizer that
 * appears as a reward moment while a fan is listening to a song on the artist
 * profile (default: at the 1-minute mark). Tap anywhere to dismiss; it also
 * auto-fades so it never gets in the way.
 *
 * Design notes:
 *  - Pure <canvas> 2D, no Web Audio / AnalyserNode. The global profile player
 *    streams cross-origin Firebase/CDN audio that lacks CORS headers; routing
 *    it through createMediaElementSource() would MUTE playback. So the visuals
 *    are driven by a synthetic musical beat (BPM envelope) + playback time,
 *    which looks reactive without touching the audio graph.
 *  - Colors come from the artist's active brand palette (primary/accent).
 *  - Shows once per song per page session so it doesn't nag.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAudioPlayer } from "../../contexts/audio-player-context";

interface ListeningExperienceProps {
  /** Artist brand primary color (hex). */
  primary?: string;
  /** Artist brand accent color (hex). */
  accent?: string;
  artistName?: string;
  /** Seconds of playback before the experience triggers. */
  triggerSeconds?: number;
  /** Auto-dismiss after this many ms (0 = never). */
  autoDismissMs?: number;
}

function hexToRgb(hex?: string): [number, number, number] {
  const fallback: [number, number, number] = [124, 92, 255]; // violet
  if (!hex) return fallback;
  let h = hex.replace("#", "").trim();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return fallback;
  const n = parseInt(h, 16);
  if (Number.isNaN(n)) return fallback;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function fmtClock(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function ListeningExperience({
  primary = "#7C3AED",
  accent = "#22D3EE",
  artistName = "",
  triggerSeconds = 60,
  autoDismissMs = 11000,
}: ListeningExperienceProps) {
  const player = useAudioPlayer();
  const { currentTrack, isPlaying, progress, duration } = player;

  const [active, setActive] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Keep latest colors in refs so the animation loop doesn't restart on change.
  const primaryRgb = useMemo(() => hexToRgb(primary), [primary]);
  const accentRgb = useMemo(() => hexToRgb(accent), [accent]);
  const colorsRef = useRef({ primaryRgb, accentRgb });
  colorsRef.current = { primaryRgb, accentRgb };

  const trackId = currentTrack ? String(currentTrack.id) : null;

  const clearDismissTimer = () => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = null;
    }
  };

  const dismiss = () => {
    clearDismissTimer();
    setActive(false);
  };

  // ── Trigger logic ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trackId || !isPlaying || active) return;
    if (shownIdsRef.current.has(trackId)) return;
    // Skip very short tracks / previews where the moment wouldn't land well.
    if (duration > 0 && duration < triggerSeconds + 6) return;
    if (progress >= triggerSeconds) {
      shownIdsRef.current.add(trackId);
      setActive(true);
    }
  }, [trackId, isPlaying, progress, duration, triggerSeconds, active]);

  // Hide when the song changes.
  useEffect(() => {
    setActive(false);
    clearDismissTimer();
  }, [trackId]);

  // Arm auto-dismiss whenever it becomes active.
  useEffect(() => {
    if (!active) return;
    if (autoDismissMs > 0) {
      dismissTimerRef.current = setTimeout(() => setActive(false), autoDismissMs);
    }
    return clearDismissTimer;
  }, [active, autoDismissMs]);

  // Allow Escape to close.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // ── Canvas animation ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!active) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const BPM = 120;
    const start = performance.now();

    // Persistent particle systems.
    interface Spark {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      size: number;
      hueMix: number;
    }
    interface Ring {
      r: number;
      life: number;
      maxLife: number;
    }
    const sparks: Spark[] = [];
    const rings: Ring[] = [];
    let lastBeat = -1;

    const sparkCount = reduceMotion ? 0 : 70;
    for (let i = 0; i < sparkCount; i++) {
      sparks.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -0.25 - Math.random() * 0.5,
        life: Math.random(),
        maxLife: 1,
        size: 0.6 + Math.random() * 2.2,
        hueMix: Math.random(),
      });
    }

    const draw = (now: number) => {
      const t = (now - start) / 1000; // seconds since open
      const { primaryRgb: P, accentRgb: A } = colorsRef.current;
      const cx = w / 2;
      const cy = h / 2;

      // Beat envelope: sharp decaying pulse on each beat.
      const beatPos = (t * BPM) / 60;
      const beatIndex = Math.floor(beatPos);
      const beatFrac = beatPos - beatIndex;
      const pulse = Math.pow(1 - beatFrac, 3); // 1 -> 0 each beat
      const downbeat = beatIndex % 4 === 0;
      if (beatIndex !== lastBeat) {
        lastBeat = beatIndex;
        rings.push({ r: 0, life: 0, maxLife: downbeat ? 1.4 : 1.0 });
        // Emit a burst of sparks from center on downbeats.
        if (!reduceMotion && downbeat) {
          for (let i = 0; i < 16; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 2 + Math.random() * 4;
            sparks.push({
              x: cx,
              y: cy,
              vx: Math.cos(ang) * spd,
              vy: Math.sin(ang) * spd,
              life: 0,
              maxLife: 0.9 + Math.random() * 0.6,
              size: 1 + Math.random() * 2,
              hueMix: Math.random(),
            });
            if (sparks.length > 220) sparks.shift();
          }
        }
      }

      // 1) Base wash — dark, faintly tinted.
      ctx.globalCompositeOperation = "source-over";
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, `rgba(6,6,12,0.92)`);
      base.addColorStop(1, `rgba(2,2,6,0.96)`);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // 2) Aurora blobs — large soft radial gradients drifting (screen blend).
      ctx.globalCompositeOperation = "screen";
      const blobs = [
        { c: P, ph: 0 },
        { c: A, ph: 2.1 },
        { c: P, ph: 4.2 },
      ];
      blobs.forEach((b, i) => {
        const bx = cx + Math.cos(t * 0.25 + b.ph) * w * 0.28;
        const by = cy + Math.sin(t * 0.31 + b.ph * 1.3) * h * 0.26;
        const rad = Math.min(w, h) * (0.42 + 0.06 * Math.sin(t * 0.7 + i)) * (1 + pulse * 0.08);
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
        g.addColorStop(0, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0.40)`);
        g.addColorStop(0.5, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0.12)`);
        g.addColorStop(1, `rgba(${b.c[0]},${b.c[1]},${b.c[2]},0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      });

      // 3) Hyperspace warp lines from center.
      if (!reduceMotion) {
        const spokes = 64;
        const maxLen = Math.hypot(cx, cy);
        ctx.lineCap = "round";
        for (let i = 0; i < spokes; i++) {
          const ang = (i / spokes) * Math.PI * 2 + t * 0.06;
          const seed = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          const wob = 0.5 + 0.5 * Math.sin(t * 1.5 + i * 0.7);
          const inner = maxLen * (0.16 + pulse * 0.05);
          const outer = inner + maxLen * (0.12 + 0.5 * wob) * (0.6 + pulse * 0.7);
          const x1 = cx + Math.cos(ang) * inner;
          const y1 = cy + Math.sin(ang) * inner;
          const x2 = cx + Math.cos(ang) * Math.min(outer, maxLen);
          const y2 = cy + Math.sin(ang) * Math.min(outer, maxLen);
          const col = seed > 0.5 ? P : A;
          const alpha = 0.05 + 0.18 * wob + pulse * 0.12;
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
          ctx.lineWidth = 0.6 + wob * 1.6;
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }

      // 4) Shockwave rings.
      for (let i = rings.length - 1; i >= 0; i--) {
        const r = rings[i];
        r.life += 1 / 60;
        const p = r.life / r.maxLife;
        if (p >= 1) {
          rings.splice(i, 1);
          continue;
        }
        const radius = p * Math.min(w, h) * 0.55;
        const alpha = (1 - p) * 0.5;
        const col = i % 2 === 0 ? A : P;
        ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${alpha})`;
        ctx.lineWidth = 2 + (1 - p) * 3;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      }

      // 5) Central pulsing core.
      const coreR = Math.min(w, h) * (0.05 + pulse * 0.035);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 4);
      core.addColorStop(0, `rgba(255,255,255,${0.5 + pulse * 0.4})`);
      core.addColorStop(0.25, `rgba(${A[0]},${A[1]},${A[2]},0.55)`);
      core.addColorStop(1, `rgba(${A[0]},${A[1]},${A[2]},0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 4, 0, Math.PI * 2);
      ctx.fill();

      // 6) Sparks.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += 1 / 60 / s.maxLife;
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= 0.99;
        s.vy = s.vy * 0.99 - 0.01; // slight upward drift
        if (s.life >= 1 || s.x < -20 || s.x > w + 20 || s.y < -20) {
          // Recycle ambient sparks, drop burst sparks.
          if (i < sparkCount) {
            s.x = Math.random() * w;
            s.y = h + 10;
            s.life = 0;
            s.vx = (Math.random() - 0.5) * 0.25;
            s.vy = -0.25 - Math.random() * 0.5;
          } else {
            sparks.splice(i, 1);
            continue;
          }
        }
        const col = s.hueMix > 0.5 ? P : A;
        const a = Math.sin(Math.min(s.life, 1) * Math.PI) * 0.9;
        ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * (1 + pulse * 0.4), 0, Math.PI * 2);
        ctx.fill();
      }

      // 7) Vignette to keep center readable.
      ctx.globalCompositeOperation = "source-over";
      const vig = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.2, cx, cy, Math.max(w, h) * 0.75);
      vig.addColorStop(0, "rgba(0,0,0,0)");
      vig.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active]);

  const title = currentTrack?.title || "";
  const subtitle = currentTrack?.artist || artistName || "";

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="listening-experience"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden cursor-pointer select-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onClick={dismiss}
          role="button"
          aria-label="Cerrar experiencia de escucha"
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* Center content */}
          <motion.div
            className="relative z-10 flex flex-col items-center px-6 text-center"
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          >
            <div
              className="mb-3 text-[11px] font-semibold uppercase tracking-[0.5em]"
              style={{ color: accent, textShadow: `0 0 18px ${accent}` }}
            >
              En vivo
            </div>

            <div
              className="font-mono text-6xl font-black tabular-nums leading-none sm:text-8xl"
              style={{
                color: "#fff",
                textShadow: `0 0 30px ${primary}, 0 0 60px ${accent}55`,
              }}
            >
              {fmtClock(progress)}
            </div>

            <div
              className="mt-2 text-[11px] font-medium uppercase tracking-[0.4em] text-white/60"
            >
              Escuchando
            </div>

            {title && (
              <motion.div
                className="mt-8 max-w-[90vw]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.35 }}
              >
                <div
                  className="truncate text-xl font-bold text-white sm:text-3xl"
                  style={{ textShadow: `0 0 22px ${primary}88` }}
                >
                  {title}
                </div>
                {subtitle && (
                  <div className="mt-1 truncate text-sm text-white/65 sm:text-base">
                    {subtitle}
                  </div>
                )}
              </motion.div>
            )}

            <motion.div
              className="mt-12 text-[10px] uppercase tracking-[0.3em] text-white/35"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.8 }}
            >
              Toca para cerrar
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ListeningExperience;
