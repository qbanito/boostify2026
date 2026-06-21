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
import { db } from "../../firebase";
import { collection, query, where, getDocs } from "firebase/firestore";

interface ListeningExperienceProps {
  /** Artist brand primary color (hex). */
  primary?: string;
  /** Artist brand accent color (hex). */
  accent?: string;
  artistName?: string;
  /** Circular artist image shown at the center. */
  artistImageUrl?: string;
  /** Looping background video (e.g. artist.loopVideoUrl), shown blurred behind the effect. */
  videoUrl?: string;
  /** Artist ids used to lazily load gallery images for the blurred backdrop. */
  pgId?: string | number;
  artistId?: string | number;
  /** Seconds of playback before the experience triggers. */
  triggerSeconds?: number;
  /** Auto-dismiss after this many ms (0 = stays until the user taps). */
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

/**
 * Route remote audio through the same-origin proxy so we can tap it with
 * Web Audio (cross-origin Firebase/CDN audio without CORS would taint the
 * AnalyserNode and produce silence/zeros). The proxy adds ACAO:* + Content-Length.
 */
function proxiedAudio(url?: string): string {
  if (!url) return "";
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (/^https?:\/\//i.test(url)) {
    return `/api/proxy/firebase-file?url=${encodeURIComponent(url)}`;
  }
  return url; // relative / same-origin
}

export function ListeningExperience({
  primary = "#7C3AED",
  accent = "#22D3EE",
  artistName = "",
  artistImageUrl,
  videoUrl,
  pgId,
  artistId,
  triggerSeconds = 60,
  autoDismissMs = 0,
}: ListeningExperienceProps) {
  const player = useAudioPlayer();
  const { currentTrack, isPlaying, progress, duration } = player;

  const [active, setActive] = useState(false);
  const shownIdsRef = useRef<Set<string>>(new Set());
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const avatarRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // ── Real-time audio analysis (decoded copy of the track, silent) ─────────
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const freqRef = useRef<Uint8Array | null>(null);
  const energyRef = useRef({ bass: 0, mid: 0, treble: 0, overall: 0 });
  const beatAvgRef = useRef(0);
  const lastAudioBeatRef = useRef(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;
  const audioUrl = currentTrack?.audioUrl || "";

  // Keep latest colors in refs so the animation loop doesn't restart on change.
  const primaryRgb = useMemo(() => hexToRgb(primary), [primary]);
  const accentRgb = useMemo(() => hexToRgb(accent), [accent]);
  const colorsRef = useRef({ primaryRgb, accentRgb });
  colorsRef.current = { primaryRgb, accentRgb };

  const trackId = currentTrack ? String(currentTrack.id) : null;

  // ── Blurred media backdrop (loop video base → gallery images over it) ─────
  const isMobileLayout =
    typeof window !== "undefined" && window.innerWidth < 768;
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  // When a loop video exists it stays ALWAYS playing as the base layer and the
  // gallery images fade in/out on top of it (so the video stays visible
  // between images). Without a video the gallery just cross-fades continuously.
  const [galleryVisible, setGalleryVisible] = useState(false);

  // Lazily pull the artist's gallery images from Firestore the first time the
  // experience opens, so the backdrop can slowly cross-fade through them.
  useEffect(() => {
    if (!active || galleryImages.length) return;
    let cancelled = false;
    (async () => {
      try {
        const ids = new Set<string | number>();
        [pgId, artistId].forEach((v) => {
          if (v === undefined || v === null) return;
          ids.add(String(v));
          const n = Number(v);
          if (!Number.isNaN(n)) ids.add(n);
        });
        if (!ids.size) return;
        const ref = collection(db, "image_galleries");
        const urls: string[] = [];
        for (const uid of ids) {
          const snap = await getDocs(query(ref, where("userId", "==", uid)));
          snap.docs.forEach((d) => {
            const data = d.data() as any;
            (data?.generatedImages || []).forEach((g: any) => {
              if (g && !g.isVideo && typeof g.url === "string") urls.push(g.url);
            });
          });
          if (urls.length) break;
        }
        if (!cancelled && urls.length) setGalleryImages(urls.slice(0, 12));
      } catch {
        /* gallery is optional decoration — ignore failures */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, pgId, artistId, galleryImages.length]);

  // Drive the gallery overlay while the experience is open.
  useEffect(() => {
    if (!active) {
      setBgIndex(0);
      setGalleryVisible(false);
      return;
    }
    if (galleryImages.length === 0) {
      setGalleryVisible(false);
      return;
    }
    if (!videoUrl) {
      // No video → keep the gallery on screen and cross-fade through it.
      setGalleryVisible(true);
      if (galleryImages.length <= 1) return;
      const id = setInterval(
        () => setBgIndex((i) => (i + 1) % galleryImages.length),
        7000,
      );
      return () => clearInterval(id);
    }
    // With a video base → alternate: show an image, then fade it out so the
    // loop video shows through, then bring in the next image.
    setGalleryVisible(true);
    let visible = true;
    const id = setInterval(() => {
      visible = !visible;
      setGalleryVisible(visible);
      if (visible) setBgIndex((i) => (i + 1) % galleryImages.length);
    }, 4500);
    return () => clearInterval(id);
  }, [active, videoUrl, galleryImages.length]);

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
    if (autoDismissMs > 0) {
      setActive(false);
      clearDismissTimer();
    }
  }, [trackId, autoDismissMs]);

  // Arm auto-dismiss whenever it becomes active (only when enabled).
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

  // ── Real audio frequency analysis ────────────────────────────────────────
  // Fetches a copy of the playing track (through the same-origin proxy),
  // decodes it and plays it SILENTLY (gain 0) through an AnalyserNode so we can
  // read live frequency data without ever touching/muting the main global
  // player. Using fetch + AbortController (instead of an <audio> element) means
  // cleanup aborts are caught explicitly and never surface as runtime errors.
  useEffect(() => {
    if (!active || !audioUrl) return;
    let cancelled = false;
    const controller = new AbortController();
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let buffer: AudioBuffer | null = null;
    let srcNode: AudioBufferSourceNode | null = null;
    let startCtxTime = 0;
    let startOffset = 0;
    let syncTimer: ReturnType<typeof setInterval> | null = null;

    const startSource = (offset: number) => {
      if (!ctx || !buffer || !analyser) return;
      try {
        if (srcNode) {
          srcNode.stop();
          srcNode.disconnect();
        }
      } catch {}
      const node = ctx.createBufferSource();
      node.buffer = buffer;
      node.connect(analyser);
      const off = Math.max(0, Math.min(offset, buffer.duration - 0.05));
      startCtxTime = ctx.currentTime;
      startOffset = off;
      try {
        node.start(0, off);
      } catch {}
      srcNode = node;
    };

    (async () => {
      try {
        const AC: typeof AudioContext | undefined =
          window.AudioContext || (window as any).webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        analyser = ctx.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.82;
        const silent = ctx.createGain();
        silent.gain.value = 0;
        analyser.connect(silent);
        silent.connect(ctx.destination);
        analyserRef.current = analyser;
        freqRef.current = new Uint8Array(analyser.frequencyBinCount);
        audioCtxRef.current = ctx;

        const res = await fetch(proxiedAudio(audioUrl), { signal: controller.signal });
        if (cancelled || !res.ok) return;
        const arr = await res.arrayBuffer();
        if (cancelled) return;
        buffer = await ctx.decodeAudioData(arr);
        if (cancelled) return;
        try {
          if (ctx.state === "suspended") await ctx.resume();
        } catch {}
        startSource(progressRef.current || 0);
        // Keep the silent analysis copy aligned with the real player position.
        syncTimer = setInterval(() => {
          if (cancelled || !ctx || !buffer) return;
          const pos = startOffset + (ctx.currentTime - startCtxTime);
          if (
            Math.abs(progressRef.current - pos) > 0.6 &&
            progressRef.current < buffer.duration
          ) {
            startSource(progressRef.current);
          }
        }, 1000);
      } catch {
        // AbortError on cleanup / decode failure → visuals fall back to the
        // synthetic beat envelope. Never throws to the host.
      }
    })();

    return () => {
      cancelled = true;
      try {
        controller.abort();
      } catch {}
      if (syncTimer) clearInterval(syncTimer);
      analyserRef.current = null;
      freqRef.current = null;
      audioCtxRef.current = null;
      energyRef.current = { bass: 0, mid: 0, treble: 0, overall: 0 };
      beatAvgRef.current = 0;
      try {
        if (srcNode) {
          srcNode.stop();
          srcNode.disconnect();
        }
      } catch {}
      try {
        ctx?.close();
      } catch {}
    };
  }, [active, audioUrl]);

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

    // Mobile devices choke on the full effect, so we run lighter: fewer
    // particles, a lower pixel ratio and a ~30fps cap. Combined with the
    // delta-time motion below this stops animations from "piling up".
    const isMobile =
      typeof window !== "undefined" &&
      (window.innerWidth < 768 ||
        !!window.matchMedia?.("(pointer: coarse)").matches);

    let w = 0;
    let h = 0;
    let dpr = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, isMobile ? 1.4 : 2);
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
    let lastFrame = start; // for delta-time + fps cap
    const minDelta = isMobile ? 32 : 0; // ~30fps on mobile

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

    const sparkCount = reduceMotion ? 0 : isMobile ? 26 : 70;
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
      // Frame-rate cap (mobile) + delta-time so motion is independent of fps.
      const elapsed = now - lastFrame;
      if (elapsed < minDelta) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }
      const dt = Math.min(0.05, elapsed / 1000); // clamp big gaps (tab switch)
      const dtScale = dt * 60; // 1.0 at 60fps
      lastFrame = now;
      const t = (now - start) / 1000; // seconds since open
      const { primaryRgb: P, accentRgb: A } = colorsRef.current;
      const cx = w / 2;
      const cy = h / 2;

      // ── Read live audio frequency data (if the analyser is ready) ─────────
      const an = analyserRef.current;
      const fr = freqRef.current;
      let audioActive = false;
      if (an && fr) {
        an.getByteFrequencyData(fr as Uint8Array<ArrayBuffer>);
        const n = fr.length;
        const bassEnd = Math.max(2, Math.floor(n * 0.1));
        const midEnd = Math.floor(n * 0.45);
        let bs = 0, ms = 0, ts = 0, all = 0;
        for (let i = 0; i < n; i++) {
          const v = fr[i];
          all += v;
          if (i < bassEnd) bs += v;
          else if (i < midEnd) ms += v;
          else ts += v;
        }
        const bass = bs / (bassEnd * 255);
        const mid = ms / ((midEnd - bassEnd) * 255);
        const treble = ts / ((n - midEnd) * 255);
        const overall = all / (n * 255);
        if (overall > 0.0015) {
          audioActive = true;
          const e = energyRef.current;
          e.bass = e.bass * 0.65 + bass * 0.35;
          e.mid = e.mid * 0.65 + mid * 0.35;
          e.treble = e.treble * 0.65 + treble * 0.35;
          e.overall = e.overall * 0.65 + overall * 0.35;
        }
      }

      // Beat envelope: real bass energy when available, else a synthetic BPM pulse.
      const beatPos = (t * BPM) / 60;
      const beatIndex = Math.floor(beatPos);
      const beatFrac = beatPos - beatIndex;
      const syntheticPulse = Math.pow(1 - beatFrac, 3);
      const e = energyRef.current;
      const pulse = audioActive ? Math.min(1, e.bass * 1.7) : syntheticPulse;

      if (audioActive) {
        // Onset detection on the bass band → shockwave rings + spark bursts.
        beatAvgRef.current = beatAvgRef.current * 0.92 + e.bass * 0.08;
        const since = t - lastAudioBeatRef.current;
        if (e.bass > beatAvgRef.current * 1.3 && e.bass > 0.26 && since > 0.16) {
          lastAudioBeatRef.current = t;
          rings.push({ r: 0, life: 0, maxLife: e.bass > 0.5 ? 1.4 : 1.0 });
          if (!reduceMotion && e.bass > 0.42) {
            const burst = isMobile ? 8 : 16;
            for (let i = 0; i < burst; i++) {
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
      } else if (beatIndex !== lastBeat) {
        // Fallback: synthetic metronome.
        lastBeat = beatIndex;
        const downbeat = beatIndex % 4 === 0;
        rings.push({ r: 0, life: 0, maxLife: downbeat ? 1.4 : 1.0 });
        if (!reduceMotion && downbeat) {
          const burst = isMobile ? 8 : 16;
          for (let i = 0; i < burst; i++) {
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

      // 1) Base wash — clear, then lay a translucent dark veil so the blurred
      //    media backdrop behind the canvas stays faintly visible.
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, w, h);
      const base = ctx.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, `rgba(6,6,12,0.42)`);
      base.addColorStop(1, `rgba(2,2,6,0.54)`);
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);

      // 2) Aurora blobs — large soft radial gradients drifting (screen blend).
      ctx.globalCompositeOperation = "screen";
      const blobs = isMobile
        ? [
            { c: P, ph: 0 },
            { c: A, ph: 2.1 },
          ]
        : [
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
        const spokes = isMobile ? 30 : 64;
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
        r.life += dt;
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

      // 5) Central glow halo behind the artist avatar.
      const coreR = Math.min(w, h) * (0.05 + pulse * 0.035);
      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 5);
      core.addColorStop(0, `rgba(${A[0]},${A[1]},${A[2]},${0.28 + pulse * 0.3})`);
      core.addColorStop(0.4, `rgba(${P[0]},${P[1]},${P[2]},0.18)`);
      core.addColorStop(1, `rgba(${P[0]},${P[1]},${P[2]},0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 5, 0, Math.PI * 2);
      ctx.fill();

      // Drive the HTML avatar pulse in sync with the same beat.
      const av = avatarRef.current;
      if (av) {
        const s = 1 + pulse * 0.07 + 0.02 * Math.sin(t * 1.6);
        av.style.transform = `scale(${s.toFixed(3)})`;
        av.style.boxShadow = `0 0 ${24 + pulse * 60}px ${Math.round(
          6 + pulse * 14,
        )}px rgba(${A[0]},${A[1]},${A[2]},${(0.25 + pulse * 0.45).toFixed(3)})`;
      }

      // 5b) Circular frequency spectrum hugging the artist avatar.
      if (an && fr && audioActive) {
        const bars = isMobile ? 40 : 80;
        const n = fr.length;
        const baseR = 104; // just outside the 176px avatar circle
        ctx.globalCompositeOperation = "lighter";
        ctx.lineCap = "round";
        for (let i = 0; i < bars; i++) {
          // Mirror the spectrum across the vertical axis for symmetry.
          const half = i < bars / 2 ? i : bars - 1 - i;
          const bin = Math.floor((half / (bars / 2)) * (n * 0.62));
          const v = fr[bin] / 255;
          const ang = (i / bars) * Math.PI * 2 - Math.PI / 2 + t * 0.05;
          const r0 = baseR + 4;
          const r1 = r0 + 6 + v * v * 90;
          const col = v > 0.55 ? A : P;
          ctx.strokeStyle = `rgba(${col[0]},${col[1]},${col[2]},${0.12 + v * 0.6})`;
          ctx.lineWidth = 2 + v * 2.5;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
          ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
          ctx.stroke();
        }
        ctx.globalCompositeOperation = "source-over";
      }

      // 6) Sparks.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt / s.maxLife;
        s.x += s.vx * dtScale;
        s.y += s.vy * dtScale;
        s.vx *= Math.pow(0.99, dtScale);
        s.vy = s.vy * Math.pow(0.99, dtScale) - 0.01 * dtScale; // slight upward drift
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
      vig.addColorStop(1, "rgba(0,0,0,0.4)");
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

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="listening-experience"
          className="fixed inset-0 z-[90] flex items-center justify-center overflow-hidden cursor-pointer select-none bg-[#05060a]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45 } }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          onClick={dismiss}
          role="button"
          aria-label="Cerrar experiencia de escucha"
        >
          {/* Blurred media backdrop: the loop video stays playing as the base
              layer and gallery images fade in/out over it, so the video keeps
              showing through without breaking the animation style. */}
          {(videoUrl || galleryImages.length > 0) && (
            <div className="absolute inset-0 overflow-hidden">
              {videoUrl && (
                <video
                  src={videoUrl}
                  autoPlay
                  muted
                  loop
                  playsInline
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{
                    opacity: 0.72,
                    transform: "scale(1.1)",
                    filter: `blur(${isMobileLayout ? 10 : 16}px)`,
                  }}
                />
              )}
              {galleryImages.length > 0 && (
                <AnimatePresence>
                  {galleryVisible && (
                    <motion.img
                      key={bgIndex}
                      src={galleryImages[bgIndex % galleryImages.length]}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover"
                      style={{ filter: `blur(${isMobileLayout ? 14 : 24}px)` }}
                      initial={{ opacity: 0, scale: 1.05 }}
                      animate={{ opacity: 0.42, scale: 1.13 }}
                      exit={{ opacity: 0 }}
                      transition={{
                        opacity: { duration: 1.5, ease: "easeInOut" },
                        scale: { duration: 6, ease: "linear" },
                      }}
                    />
                  )}
                </AnimatePresence>
              )}
              {/* Dark veil keeps the neon visuals readable over the media. */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "radial-gradient(circle at 50% 45%, rgba(4,4,10,0.18), rgba(2,2,6,0.7))",
                }}
              />
            </div>
          )}

          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* Center content */}
          <motion.div
            className="relative z-10 flex flex-col items-center px-6 text-center"
            initial={{ scale: 0.92, y: 12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.1, ease: "easeOut" }}
          >
            {/* Circular artist avatar with rotating brand ring, pulsing to the beat */}
            <div className="relative mb-9 flex items-center justify-center">
              {/* Rotating conic ring */}
              <motion.div
                className="absolute rounded-full"
                style={{
                  width: 192,
                  height: 192,
                  background: `conic-gradient(from 0deg, ${primary}, ${accent}, ${primary})`,
                  filter: "blur(2px)",
                  opacity: 0.85,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
              />
              {/* Avatar (scaled/glowed each frame by the canvas loop) */}
              <div
                ref={avatarRef}
                className="relative h-44 w-44 overflow-hidden rounded-full border border-white/20 bg-black/40 will-change-transform"
                style={{ transformOrigin: "center" }}
              >
                {artistImageUrl ? (
                  <img
                    src={artistImageUrl}
                    alt={artistName}
                    className="h-full w-full object-cover"
                    draggable={false}
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-5xl font-light text-white/80"
                    style={{ background: `linear-gradient(135deg, ${primary}33, ${accent}33)` }}
                  >
                    {(artistName || "♪").slice(0, 1).toUpperCase()}
                  </div>
                )}
                {/* subtle inner sheen */}
                <div className="pointer-events-none absolute inset-0 rounded-full ring-1 ring-inset ring-white/10" />
              </div>
            </div>

            {/* Elegant counter */}
            <div
              className="text-[10px] font-medium uppercase tracking-[0.55em]"
              style={{ color: accent }}
            >
              En vivo
            </div>
            <div
              className="mt-3 font-extralight tabular-nums leading-none"
              style={{
                fontSize: "clamp(2.75rem, 9vw, 5rem)",
                letterSpacing: "0.08em",
                color: "#fff",
                textShadow: `0 0 26px ${accent}66`,
              }}
            >
              {fmtClock(progress)}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <span className="h-px w-8" style={{ background: `${accent}66` }} />
              <span className="text-[10px] font-medium uppercase tracking-[0.45em] text-white/55">
                Escuchando
              </span>
              <span className="h-px w-8" style={{ background: `${accent}66` }} />
            </div>

            {artistName && (
              <div className="mt-5 text-sm font-light uppercase tracking-[0.3em] text-white/70">
                {artistName}
              </div>
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
