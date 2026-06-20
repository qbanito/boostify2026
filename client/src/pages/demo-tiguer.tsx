import React, { useEffect, useRef, useState } from "react";

// ─── Asset helpers ────────────────────────────────────────────────────────────
const B = "/demo-tiguer/";
const p = (f: string) => `${B}${encodeURIComponent(f)}`;

const IMG = {
  charSheet: p("fa66dadf-8ab4-4e59-bb5e-4574698453bf.png"),
  av1: p("3fa060a9-52e4-4f8b-acff-406ee91a2885.png"),
  av2: p("46899e83-6e65-48ee-87ea-f056c0e1b6dd.png"),
  av3: p("725722e3-67a0-4998-a1fc-3493bb170a1b.png"),
  stage1: p("84261439-4080-4661-95c6-bde8621f7fa8.png"),
  stage2: p("9ff74ca2-4eb9-479a-994d-ba4d3d968f2a.png"),
  detail: p("ac33948f-bb14-43c5-ac78-06a1a434933b.png"),
  perf1: p("e419a1e5-498f-4a19-b22c-d73a74d6d088.png"),
  perf2: p("f58ea016-9f68-4766-8257-95d06fc3fd6e.png"),
};
const VID = {
  v1: p("V1.mp4"),
  artist: p("artist-clip-1.mp4"),
  shot: p("artist-clip-2.mp4"),
};

// ─── Animated video loop helper ───────────────────────────────────────────────
function LoopVideo({ src, className = "" }: { src: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    v.loop = true;
    v.play().catch(() => {});
  }, [src]);
  return <video ref={ref} src={src} muted playsInline loop className={className} />;
}

// ─── Intersection-observer reveal hook ───────────────────────────────────────
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Holographic grid background ─────────────────────────────────────────────
function HoloGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Grid lines */}
      <svg className="absolute inset-0 w-full h-full opacity-[0.07]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00f5ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      {/* Scan line */}
      <div
        className="absolute left-0 right-0 h-px"
        style={{ background: "linear-gradient(90deg, transparent, #00f5ff88, transparent)", animation: "scanLine 4s linear infinite", top: 0 }}
      />
      {/* Radial glow */}
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,245,255,0.06) 0%, transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 100% 100%, rgba(168,85,247,0.05) 0%, transparent 60%)" }} />
    </div>
  );
}

// ─── Phase card ───────────────────────────────────────────────────────────────
interface PhaseProps {
  number: string;
  title: string;
  subtitle: string;
  desc: string;
  accent: string;
  tag: string;
  children: React.ReactNode;
  flip?: boolean;
}
function PhaseCard({ number, title, subtitle, desc, accent, tag, children, flip }: PhaseProps) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative grid gap-10 xl:grid-cols-2 items-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
    >
      <div className={flip ? "xl:order-2" : ""}>
        <div className="flex items-center gap-3 mb-4">
          <span
            className="text-[80px] font-black leading-none select-none"
            style={{ color: `${accent}15`, fontVariantNumeric: "tabular-nums", WebkitTextStroke: `1px ${accent}30` }}
          >
            {number}
          </span>
          <div>
            <div
              className="inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }}
            >
              {tag}
            </div>
            <h2 className="text-3xl xl:text-4xl font-black text-white leading-tight tracking-tight">{title}</h2>
            <p className="text-sm font-bold uppercase tracking-widest mt-1" style={{ color: accent }}>{subtitle}</p>
          </div>
        </div>
        <p className="text-base text-zinc-400 leading-relaxed max-w-lg">{desc}</p>
        {/* Accent line */}
        <div className="mt-6 h-px w-24" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      </div>
      <div className={`relative ${flip ? "xl:order-1" : ""}`}>
        {/* Glow frame */}
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{ boxShadow: `0 0 60px ${accent}20, inset 0 0 30px ${accent}08`, border: `1px solid ${accent}25` }}
        />
        {children}
      </div>
    </div>
  );
}

// ─── Stat counter ─────────────────────────────────────────────────────────────
function StatBadge({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="text-center">
      <div className="text-3xl xl:text-4xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{label}</div>
    </div>
  );
}

// ─── Tech pill ────────────────────────────────────────────────────────────────
function TechPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider"
      style={{ background: `${color}12`, border: `1px solid ${color}35`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: color }} />
      {label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DemoTiguerPage() {
  const [scanY, setScanY] = useState(0);

  useEffect(() => {
    let raf: number;
    let t = 0;
    const animate = () => {
      t = (t + 0.003) % 1;
      setScanY(t * 100);
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden">

      {/* ── Global custom CSS ── */}
      <style>{`
        @keyframes scanLine {
          0%   { top: -2px; }
          100% { top: 100%; }
        }
        @keyframes glitch-a {
          0%, 100% { transform: none; opacity: 1; }
          7%  { transform: skewX(-10deg); opacity: 0.75; }
          10% { transform: skewX(0deg); opacity: 1; }
          27% { transform: none; }
          28% { transform: skewX(5deg); opacity: 0.8; }
          30% { transform: none; opacity: 1; }
          97% { transform: none; }
          98% { transform: skewX(-5deg); opacity: 0.75; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-14px); }
        }
        @keyframes holo-ring {
          0%   { transform: rotate(0deg) scale(1);   opacity: 0.4; }
          50%  { transform: rotate(180deg) scale(1.06); opacity: 0.15; }
          100% { transform: rotate(360deg) scale(1);  opacity: 0.4; }
        }
        @keyframes radar {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(30px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0; }
          100% { background-position:  200% 0; }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 20px rgba(0,245,255,0.25); }
          50%       { box-shadow: 0 0 50px rgba(0,245,255,0.55); }
        }
        @keyframes borderRun {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
        .glitch-title {
          animation: glitch-a 4s infinite;
        }
        .float-anim {
          animation: float 5s ease-in-out infinite;
        }
        .shimmer-text {
          background: linear-gradient(90deg, #fff 0%, #00f5ff 30%, #a855f7 60%, #fff 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .holo-border {
          position: relative;
        }
        .holo-border::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(135deg, #00f5ff, #a855f7, #00f5ff);
          background-size: 200% 200%;
          -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          animation: borderRun 3s linear infinite;
          pointer-events: none;
        }
      `}</style>

      {/* ══════════════════════════ HERO ══════════════════════════ */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden">
        {/* Video BG */}
        <div className="absolute inset-0">
          <LoopVideo src={VID.v1} className="absolute inset-0 w-full h-full object-cover opacity-30" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(3,3,8,0.6) 0%, rgba(3,3,8,0.4) 50%, rgba(3,3,8,0.9) 100%)" }} />
        </div>

        <HoloGrid />

        {/* Animated rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[600px] rounded-full border border-cyan-500/10" style={{ animation: "holo-ring 12s linear infinite" }} />
          <div className="absolute w-[400px] h-[400px] rounded-full border border-purple-500/10" style={{ animation: "holo-ring 8s linear infinite reverse" }} />
        </div>

        {/* Scan line overlay */}
        <div
          className="absolute left-0 right-0 h-32 pointer-events-none"
          style={{
            top: `${scanY}%`,
            background: "linear-gradient(180deg, transparent, rgba(0,245,255,0.04), transparent)",
          }}
        />

        {/* Hero content */}
        <div className="relative z-10 text-center px-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-black uppercase tracking-[0.35em]"
            style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", color: "#00f5ff" }}
          >
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            BOOSTIFY HOLOGRAM EXPERIENCE · DEMO EXCLUSIVO
          </div>

          <div className="relative mb-6">
            <h1
              className="text-[10vw] xl:text-[140px] font-black leading-none tracking-tighter glitch-title uppercase"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #00f5ff 40%, #a855f7 70%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              TIGER
            </h1>
            {/* Glitch ghost */}
            <h1
              className="absolute inset-0 text-[10vw] xl:text-[140px] font-black leading-none tracking-tighter uppercase select-none pointer-events-none"
              style={{
                color: "transparent",
                WebkitTextStroke: "1px rgba(0,245,255,0.2)",
                transform: "translate(3px, 2px)",
              }}
              aria-hidden
            >
              TIGER
            </h1>
          </div>

          <p className="text-xl xl:text-2xl font-bold text-zinc-200 tracking-wide mb-3">
            HOLOGRAM LIVE EXPERIENCE
          </p>
          <p className="text-sm text-zinc-500 uppercase tracking-[0.4em] mb-12">
            POWERED BY BOOSTIFY MUSIC · CONFIDENTIAL DEMO
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap justify-center gap-12 mb-12">
            <StatBadge value="5" label="Production Phases" color="#00f5ff" />
            <StatBadge value="8K" label="Resolution" color="#a855f7" />
            <StatBadge value="4D" label="Motion Capture" color="#f59e0b" />
            <StatBadge value="LIVE" label="Hologram Ready" color="#10b981" />
          </div>

          {/* Scroll cue */}
          <div className="flex flex-col items-center gap-2 text-zinc-600 animate-bounce">
            <span className="text-[10px] uppercase tracking-widest">Scroll para ver el proceso</span>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ══════════════════════ INTRO BANNER ══════════════════════ */}
      <section className="relative border-y border-white/5 bg-[#050510] py-8 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, rgba(0,245,255,0.03), rgba(168,85,247,0.03), transparent)" }} />
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-center gap-8">
          {[
            { label: "Character Design", icon: "🎨" },
            { label: "→" },
            { label: "Avatar · ZBrush", icon: "⚡" },
            { label: "→" },
            { label: "Motion Capture", icon: "🎬" },
            { label: "→" },
            { label: "Virtual Stage", icon: "🏟️" },
            { label: "→" },
            { label: "Live Hologram", icon: "✨" },
          ].map((item, i) =>
            item.label === "→" ? (
              <span key={i} className="text-zinc-700 text-xl font-thin hidden xl:block">→</span>
            ) : (
              <div key={i} className="flex items-center gap-2 text-sm font-bold text-zinc-300">
                <span className="text-base">{item.icon}</span>
                {item.label}
              </div>
            )
          )}
        </div>
      </section>

      {/* ══════════════════════ PHASES ══════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-6 py-24 space-y-32">

        {/* PHASE 01 — CHARACTER DESIGN */}
        <PhaseCard
          number="01"
          title="CHARACTER DESIGN"
          subtitle="ZBrush · Maya · Boostify Software"
          desc="El proceso comienza con la construcción detallada del personaje digital en ZBrush y Maya. Cada elemento visual — rasgos faciales, tatuajes, outfits, accesorios — se esculpe con precisión milimétrica. Esta base es el ADN visual del avatar que será proyectado en vivo."
          accent="#00f5ff"
          tag="Concept & Design"
        >
          <div className="relative rounded-2xl overflow-hidden group">
            <img
              src={IMG.charSheet}
              alt="Character Design Sheet"
              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div
              className="absolute bottom-4 left-4 right-4 px-4 py-3 rounded-xl text-sm font-bold text-white"
              style={{ background: "rgba(0,245,255,0.1)", border: "1px solid rgba(0,245,255,0.25)", backdropFilter: "blur(10px)" }}
            >
              ⟨ Character Reference Sheet — Complete visual identity document ⟩
            </div>
          </div>
        </PhaseCard>

        {/* PHASE 02 — AVATAR GENERATION */}
        <PhaseCard
          number="02"
          title="AVATAR GENERATION"
          subtitle="ZBrush · Maya · Boostify Software"
          desc="Con el modelo 3D base, Boostify Software y Maya generan renders fotorrealistas de alta resolución del artista en múltiples poses y contextos. La identidad visual se mantiene perfectamente consistente — el mismo artista, en cualquier escenario."
          accent="#a855f7"
          tag="3D Character Production"
          flip
        >
          <div className="grid grid-cols-3 gap-3">
            {[IMG.av1, IMG.av2, IMG.av3].map((src, i) => (
              <div key={i} className="relative rounded-xl overflow-hidden group aspect-[9/16]">
                <img src={src} alt={`Avatar render ${i + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            ))}
          </div>
        </PhaseCard>

        {/* PHASE 03 — MOTION GENERATION */}
        <PhaseCard
          number="03"
          title="MOTION CAPTURE"
          subtitle="HoloSuit · Maya · Boostify Software"
          desc="El avatar cobra vida con Motion Capture HoloSuit. Se registran secuencias de movimiento cinematográficas que capturan el flow, la energía y el estilo único del artista en movimiento. Cada toma es retargetada y optimizada para proyección holográfica en vivo."
          accent="#f59e0b"
          tag="Motion Capture Production"
        >
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {([
                { src: VID.artist, label: "Face & Expression", sublabel: "Identity · Presence · Detail", pos: "object-top" },
                { src: VID.shot, label: "Full Body Motion", sublabel: "Pose · Movement · Energy", pos: "object-center" },
              ] as { src: string; label: string; sublabel: string; pos: string }[]).map(({ src, label, sublabel, pos }, i) => (
                <div key={i} className="relative rounded-xl overflow-hidden bg-black" style={{ boxShadow: "0 0 30px rgba(245,158,11,0.15)", aspectRatio: "9/16", maxHeight: "320px" }}>
                  <LoopVideo src={src} className={`w-full h-full object-cover ${pos}`} />
                  <div
                    className="absolute bottom-0 left-0 right-0 px-3 py-2"
                    style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)" }}
                  >
                    <div className="text-white text-[11px] font-black uppercase tracking-wide leading-tight">{label}</div>
                    <div className="text-amber-400/70 text-[9px] uppercase tracking-widest">{sublabel}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-xl overflow-hidden aspect-video bg-black relative" style={{ boxShadow: "0 0 40px rgba(245,158,11,0.2)" }}>
              <LoopVideo src={VID.v1} className="w-full h-full object-cover" />
              <div
                className="absolute inset-0 flex items-end p-4"
                style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)" }}
              >
                <div>
                  <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: "#f59e0b" }}>MASTER DEMO CLIP</div>
                  <div className="text-white font-bold text-sm mt-0.5">Full Performance · Ready for Projection</div>
                </div>
              </div>
            </div>
          </div>
        </PhaseCard>

        {/* PHASE 04 — VIRTUAL STAGE */}
        <PhaseCard
          number="04"
          title="VIRTUAL STAGE"
          subtitle="Unreal Engine 5 · Boostify Software"
          desc="Se construye el escenario virtual en Unreal Engine 5 — iluminación dinámica en tiempo real, efectos de humo volumétrico, laser grids y diseño de escenario personalizado para cada presentación. El entorno se combina con el hologram para crear una experiencia visual total."
          accent="#10b981"
          tag="Virtual Production"
          flip
        >
          <div className="grid grid-cols-2 gap-3">
            {[IMG.stage1, IMG.stage2, IMG.perf1, IMG.perf2].map((src, i) => (
              <div key={i} className={`relative rounded-xl overflow-hidden group ${i === 0 ? "col-span-2 aspect-video" : "aspect-square"}`}>
                <img src={src} alt={`Stage ${i + 1}`} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-900/30 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div
                  className="absolute top-2 right-2 px-2 py-0.5 rounded text-[9px] font-black"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }}
                >
                  STAGE {i + 1}
                </div>
              </div>
            ))}
          </div>
        </PhaseCard>

        {/* PHASE 05 — LIVE HOLOGRAM */}
        <PhaseCard
          number="05"
          title="LIVE HOLOGRAM PROJECTION"
          subtitle="Pepper's Ghost Technology · Live Experience"
          desc="La culminación del proceso: el avatar digital se proyecta en vivo usando tecnología Pepper's Ghost, creando la ilusión perfecta de una presencia holográfica frente a la audiencia. Eventos, festivales, lanzamientos de álbum, residencias — tu artista aparece donde quieras."
          accent="#ec4899"
          tag="Live Performance"
        >
          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden group">
              <img src={IMG.detail} alt="Hologram Stage" className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105" />
              {/* Hologram scan overlay */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(236,72,153,0.03) 3px, rgba(236,72,153,0.03) 4px)",
                }}
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(180deg, transparent 50%, rgba(236,72,153,0.15) 100%)" }}
              />
              {/* Live badge */}
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase"
                style={{ background: "rgba(236,72,153,0.2)", border: "1px solid rgba(236,72,153,0.5)", color: "#ec4899" }}
              >
                <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
                LIVE READY
              </div>
            </div>

            {/* Floating tech badges */}
            <div className="mt-4 flex flex-wrap gap-2">
              <TechPill label="Pepper's Ghost" color="#ec4899" />
              <TechPill label="4K Projection" color="#ec4899" />
              <TechPill label="Real-time Sync" color="#ec4899" />
            </div>
          </div>
        </PhaseCard>
      </section>

      {/* ══════════════════════ FULL IMAGE GALLERY ══════════════════ */}
      <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #030308, #050514, #030308)" }}>
        <HoloGrid />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-14">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-3">Visual Identity · Complete Pack</div>
            <h2 className="text-4xl xl:text-5xl font-black text-white">ASSET GALLERY</h2>
            <p className="text-zinc-500 mt-3 text-sm">Todos los renders generados · Listos para producción</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {Object.values(IMG).map((src, i) => (
              <GalleryItem key={i} src={src} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ TECH STACK ══════════════════════════ */}
      <section className="relative py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-12">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400 mb-3">Powered By</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white">PRODUCTION TECHNOLOGY STACK</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
            {[
              { name: "ZBrush", role: "3D Character Sculpting", color: "#00f5ff", icon: "🗿" },
              { name: "Maya", role: "Rigging & Animation", color: "#a855f7", icon: "🎭" },
              { name: "HoloSuit", role: "Motion Capture", color: "#f59e0b", icon: "🎬" },
              { name: "Unreal Engine 5", role: "Virtual Stage", color: "#10b981", icon: "🏟️" },
              { name: "Boostify Software", role: "Show Pipeline", color: "#ec4899", icon: "⚡" },
            ].map(({ name, role, color, icon }, i) => (
              <TechCard key={i} name={name} role={role} color={color} icon={icon} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ DELIVERABLES ════════════════════════ */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 50%, rgba(168,85,247,0.05) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-5xl px-6">
          <div className="text-center mb-12">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400 mb-3">What You Get</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white">ENTREGABLES DEL PROYECTO</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              { icon: "🎨", title: "Character Reference Pack", desc: "Hoja de referencia completa del personaje con outfits, tattoos, accesorios y especificaciones técnicas.", color: "#00f5ff" },
              { icon: "🖼️", title: "Avatar 3D Pack", desc: "20+ renders de alta resolución (4K) del avatar en diferentes poses, outfits y contextos de escenario producidos en Maya y ZBrush.", color: "#a855f7" },
              { icon: "🎬", title: "Motion Capture Videos", desc: "10–15 clips de performance capturados con HoloSuit del artista en acción, retargetados y listos para proyección holográfica.", color: "#f59e0b" },
              { icon: "🏟️", title: "Virtual Stage Design", desc: "Diseño completo del escenario virtual en 3D con iluminación, efectos y branding del artista integrado.", color: "#10b981" },
              { icon: "✨", title: "Hologram Show Package", desc: "Setup completo de proyección Pepper's Ghost con configuración técnica, operación y soporte en vivo.", color: "#ec4899" },
              { icon: "📱", title: "Social Content Pack", desc: "Behind-the-scenes content, clips para redes sociales, promo material para el evento holográfico.", color: "#06b6d4" },
            ].map(({ icon, title, desc, color }, i) => (
              <DeliverableCard key={i} icon={icon} title={title} desc={desc} color={color} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ VIDEO SHOWCASE FULL ═════════════════ */}
      <section className="relative py-20 bg-[#050510]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-400 mb-3">Demo Footage</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white">DEMO DE PRODUCCIÓN</h2>
            <p className="text-zinc-500 mt-3 text-sm">Motion Capture · Loop continuo</p>
          </div>

          <div className="grid xl:grid-cols-3 gap-6">
            {[
              { src: VID.v1, title: "Master Demo", label: "FULL PERFORMANCE", color: "#00f5ff" },
              { src: VID.artist, title: "El Artista", label: "HOLOSUIT MOCAP · TOMA 1", color: "#a855f7" },
              { src: VID.shot, title: "Shot 1", label: "HOLOSUIT MOCAP · TOMA 2", color: "#f59e0b" },
            ].map(({ src, title, label, color }, i) => (
              <VideoShowcase key={i} src={src} title={title} label={label} color={color} />
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════ TIMELINE ════════════════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <HoloGrid />
        <div className="relative mx-auto max-w-3xl px-6">
          <div className="text-center mb-16">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-3">Project Timeline</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white">CRONOGRAMA DE PRODUCCIÓN</h2>
          </div>
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-8 top-0 bottom-0 w-px" style={{ background: "linear-gradient(180deg, #00f5ff40, #a855f740, #00f5ff40)" }} />
            <div className="space-y-10">
              {[
                { week: "Semana 1", phase: "Concept & Character Design", desc: "Sesión de briefing, definición del personaje, diseño de la hoja de referencia.", color: "#00f5ff" },
                { week: "Semana 2", phase: "3D Avatar Production", desc: "Modelado y rigging del personaje en ZBrush y Maya — múltiples looks, poses y variaciones.", color: "#a855f7" },
                { week: "Semana 3", phase: "Motion Capture Session", desc: "Sesión de captura con HoloSuit — 10–15 tomas de performance de alta calidad retargetadas al avatar.", color: "#f59e0b" },
                { week: "Semana 4", phase: "Virtual Stage Design", desc: "Construcción del escenario virtual y branding del show holográfico.", color: "#10b981" },
                { week: "Semana 5", phase: "Live Hologram Setup", desc: "Instalación del equipo Pepper's Ghost, pruebas técnicas y ensayo general.", color: "#ec4899" },
                { week: "Show Day", phase: "🚀 GO LIVE", desc: "Presentación holográfica en vivo frente a la audiencia.", color: "#fff" },
              ].map(({ week, phase, desc, color }, i) => (
                <TimelineItem key={i} week={week} phase={phase} desc={desc} color={color} index={i} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════ CTA ══════════════════════════════════ */}
      <section className="relative py-28 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 90% 60% at 50% 50%, rgba(0,245,255,0.07) 0%, transparent 65%)" }} />
          <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 70% 50% at 80% 20%, rgba(168,85,247,0.06) 0%, transparent 55%)" }} />
        </div>

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.5em] text-cyan-400 mb-6">Ready to Go Live?</div>
          <h2 className="text-5xl xl:text-7xl font-black leading-tight mb-6">
            <span className="shimmer-text">TU ARTISTA.</span>
            <br />
            <span className="text-white">EN TODOS LADOS.</span>
          </h2>
          <p className="text-zinc-400 text-lg max-w-2xl mx-auto mb-12 leading-relaxed">
            Desde el concepto hasta el show en vivo — Boostify convierte la identidad del artista en
            una experiencia holográfica de alto impacto que escala sin límites.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:hello@boostifymusic.com?subject=Hologram%20Demo%20-%20TIGER&body=Hola%2C%20vi%20el%20demo%20y%20quiero%20saber%20m%C3%A1s%20sobre%20el%20proyecto%20hologram%20para%20TIGER."
              className="holo-border inline-flex items-center gap-3 px-8 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-white transition-all duration-300 hover:scale-105"
              style={{ background: "linear-gradient(135deg, rgba(0,245,255,0.15), rgba(168,85,247,0.15))", backdropFilter: "blur(10px)" }}
            >
              <span>📩</span> Contactar Boostify
            </a>
            <a
              href="/hologram-show-engine"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-xl text-sm font-black uppercase tracking-widest text-zinc-300 border border-white/10 hover:border-white/30 hover:text-white transition-all duration-300"
            >
              <span>🏟️</span> Ver Hologram Engine
            </a>
          </div>

          {/* Bottom badge */}
          <div className="mt-16 flex items-center justify-center gap-3 text-zinc-700">
            <span className="text-xs uppercase tracking-widest">Boostify Music</span>
            <span>·</span>
            <span className="text-xs uppercase tracking-widest">Hologram Live Experience</span>
            <span>·</span>
            <span className="text-xs uppercase tracking-widest">Confidential Demo</span>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────
function GalleryItem({ src, index }: { src: string; index: number }) {
  const { ref, visible } = useReveal();
  const isWide = index === 0;
  return (
    <div
      ref={ref}
      className={`relative rounded-xl overflow-hidden group cursor-zoom-in ${isWide ? "col-span-2 md:col-span-1 xl:col-span-2" : ""} aspect-square transition-all duration-500`}
      style={{
        transitionDelay: `${index * 60}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
      }}
    >
      <img src={src} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
        style={{ boxShadow: "inset 0 0 30px rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.2)" }}
      />
      <div
        className="absolute bottom-2 right-2 px-2 py-0.5 rounded text-[9px] font-black uppercase opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.8)", color: "#00f5ff" }}
      >
        RENDER {index + 1}
      </div>
    </div>
  );
}

function TechCard({ name, role, color, icon }: { name: string; role: string; color: string; icon: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="rounded-xl p-5 text-center transition-all duration-500 hover:scale-105"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}25`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
      }}
    >
      <div className="text-3xl mb-3">{icon}</div>
      <div className="text-sm font-black text-white mb-1">{name}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider" style={{ color: `${color}90` }}>{role}</div>
    </div>
  );
}

function DeliverableCard({ icon, title, desc, color }: { icon: string; title: string; desc: string; color: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="rounded-xl p-5 transition-all duration-500 hover:scale-[1.02] group"
      style={{
        background: `${color}06`,
        border: `1px solid ${color}20`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
      }}
    >
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: `${color}15`, border: `1px solid ${color}30` }}
        >
          {icon}
        </div>
        <div>
          <div className="text-sm font-black text-white mb-1 group-hover:text-opacity-90">{title}</div>
          <div className="text-xs text-zinc-500 leading-relaxed">{desc}</div>
        </div>
      </div>
    </div>
  );
}

function VideoShowcase({ src, title, label, color }: { src: string; title: string; label: string; color: string }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="rounded-2xl overflow-hidden group transition-all duration-500 hover:scale-[1.02]"
      style={{
        border: `1px solid ${color}25`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateY(20px)",
      }}
    >
      <div className="relative aspect-video bg-black">
        <LoopVideo src={src} className="w-full h-full object-cover" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.01) 2px, rgba(255,255,255,0.01) 3px)" }}
        />
      </div>
      <div
        className="px-4 py-3 flex items-center justify-between"
        style={{ background: `${color}08` }}
      >
        <div>
          <div className="text-sm font-black text-white">{title}</div>
          <div className="text-[9px] font-black uppercase tracking-widest mt-0.5" style={{ color }}>{label}</div>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}
        >
          <span style={{ color }}>▶</span>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ week, phase, desc, color, index }: { week: string; phase: string; desc: string; color: string; index: number }) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className="flex gap-6 transition-all duration-500"
      style={{
        transitionDelay: `${index * 80}ms`,
        opacity: visible ? 1 : 0,
        transform: visible ? "none" : "translateX(-20px)",
      }}
    >
      {/* Dot */}
      <div className="relative flex-shrink-0 mt-1">
        <div
          className="w-4 h-4 rounded-full border-2 z-10 relative"
          style={{ background: `${color}30`, borderColor: color, boxShadow: `0 0 12px ${color}60` }}
        />
      </div>
      <div className="pb-2">
        <div className="text-[10px] font-black uppercase tracking-widest mb-1" style={{ color }}>{week}</div>
        <div className="text-base font-black text-white mb-1">{phase}</div>
        <div className="text-sm text-zinc-500">{desc}</div>
      </div>
    </div>
  );
}
