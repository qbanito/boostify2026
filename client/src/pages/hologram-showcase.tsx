/**
 * Hologram Showcase — Rebuilt
 *  • Header + Framer Motion + lightbox + custom-scene AI generator
 *  • Gallery stats via /stats endpoint
 *  • Cinematic design: scene navigator strip, profile card, download, share
 */

import React, { useEffect, useRef, useState, useCallback, Suspense, lazy } from "react";
import { useParams, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Loader2,
  RefreshCw,
  ArrowLeft,
  Download,
  X,
  Zap,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Wand2,
  Share2,
  Check,
  Maximize2,
  Star,
  Clock,
  Camera,
  Box,
  Mic,
  Radio,
} from "lucide-react";
import { useUser } from "@clerk/clerk-react";
import { apiRequest } from "../lib/queryClient";
import { Header } from "../components/layout/header";
import { useToast } from "../hooks/use-toast";

// ─── Auth guard ────────────────────────────────────────────────────────────
// All hologram generation endpoints require an authenticated session. When a
// logged-out visitor triggers one, the API returns 401 and the raw
// `401: {"message":"User not authenticated"}` string used to leak into the UI.
// This hook gates those actions: it returns `ensureSignedIn()` which shows a
// friendly toast + redirects to /login instead, and `isSignedIn` for rendering.
function useRequireAuth() {
  const { isSignedIn, isLoaded } = useUser();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const ensureSignedIn = useCallback((): boolean => {
    // While Clerk is still loading, optimistically allow — the API still guards.
    if (!isLoaded) return true;
    if (isSignedIn) return true;
    toast({
      title: "Sign in required",
      description: "Log in to your Boostify account to generate your hologram experience.",
    });
    const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";
    navigate(`/login?redirect=${encodeURIComponent(returnTo)}`);
    return false;
  }, [isLoaded, isSignedIn, toast, navigate]);

  return { isSignedIn: !!isSignedIn, isLoaded, ensureSignedIn };
}

// Heavy r3f stage viewer — lazy-loaded so three.js doesn't bloat the initial bundle.
const HologramStageViewer = lazy(() => import("../components/artist/HologramStageViewer"));

// ─── Types ───────────────────────────────────────────────────────────────────

interface HoloImage {
  id: string;
  url: string;
  prompt: string;
  createdAt: string;
  scene?: number;
}

interface HoloGallery {
  id: string;
  artistName: string;
  singleName: string;
  generatedImages: HoloImage[];
  referenceImageUrls: string[];
  createdAt: string;
  updatedAt?: string;
}

interface ArtistInfo {
  name: string;
  genre: string;
  biography: string;
  profileImage: string | null;
  country?: string;
  era?: string;
  archetype?: string;
}

interface HoloAvatar {
  artistId: string;
  artistName: string;
  url: string;
  model: string;
  referenceCount?: number;
  createdAt: string;
}

interface HoloCharacter3D {
  artistId: string;
  artistName: string;
  glbUrl: string;
  fbxUrl?: string | null;
  objUrl?: string | null;
  animatedGlbUrl?: string | null;
  animatedUrl?: string | null;
  animatedFormat?: "glb" | "fbx";
  mixamoReady?: boolean;
  sourceImageUrl?: string;
  thumbnailUrl?: string;
  model: string;
  rigged?: boolean;
  format?: string;
  referenceCount?: number;
  createdAt: string;
  // Tripo auto-rig
  riggedGlbUrl?: string | null;
  rigProvider?: string | null;
  rigSkeleton?: "mixamo" | "tripo" | null;
  rigAnimation?: string | null;
  rigStatus?: "processing" | "ready" | "failed" | null;
  rigStage?: string | null;
  rigError?: string | null;
  // Singing performance (video → motion transfer)
  performanceVideoUrl?: string | null;
  performanceAudioUrl?: string | null;
  performanceClipStart?: number | null;
  performanceClipDuration?: number | null;
  perfMode?: "omnihuman" | "image-to-video" | null;
  perfLipsynced?: boolean | null;
  motionTimeline?: import("../components/artist/HologramStageViewer").MotionTimeline | null;
  perfStatus?: "processing" | "ready" | "failed" | null;
  perfStage?: string | null;
  perfError?: string | null;
  // Reusable performance library (each captured performance = an avatar animation)
  performanceClips?: Array<{
    id: string;
    songTitle?: string;
    videoUrl?: string | null;
    audioUrl?: string | null;
    clipStart?: number;
    clipDuration?: number | null;
    duration?: number;
    frameCount?: number;
    avgEnergy?: number;
    mode?: "omnihuman" | "image-to-video";
    lipsynced?: boolean;
    hasMotion?: boolean;
    motionTimeline?: import("../components/artist/HologramStageViewer").MotionTimeline | null;
    createdAt?: string;
  }>;
  latestPerformanceId?: string | null;
}

// ─── Scene definitions ───────────────────────────────────────────────────────

const SCENES = [
  {
    number: "01",
    title: "HOLOGRAM IDENTITY",
    subtitle: "AI Identity Transfer · Neural Image Synthesis",
    desc: "Your visual identity reconstructed in photonic form. Advanced AI reads your facial structure and defining features — then maps them into a holographic light signature ready for projection.",
    accent: "#00f5ff",
    tag: "Identity · AI Reconstruction",
  },
  {
    number: "02",
    title: "STAGE PRESENCE",
    subtitle: "Full-Body Holographic Projection",
    desc: "Standing 10 meters tall above the stage. Your presence projected across an entire arena — the crowd seeing you from every seat simultaneously.",
    accent: "#a855f7",
    tag: "Arena Scale · Live Projection",
    flip: true,
  },
  {
    number: "03",
    title: "PORTRAIT PROJECTION",
    subtitle: "Close-Up Hologram Display",
    desc: "Every detail captured in light. Your face projected with cinematic precision — every expression, every emotion transmitted to the audience as a glowing, living hologram.",
    accent: "#00f5ff",
    tag: "Expression · Detail · Close-Up",
  },
  {
    number: "04",
    title: "ARENA EXPERIENCE",
    subtitle: "Live Concert Scale · 80,000 Fans",
    desc: "The full production. Your hologram performing for stadiums — from festival main stages to sports arenas. The visual spectacle that defines the next generation of live music.",
    accent: "#10b981",
    tag: "Concert Production · Mega-Scale",
    flip: true,
  },
  {
    number: "05",
    title: "MULTI-FRAME SEQUENCE",
    subtitle: "Parallel Hologram Arrays",
    desc: "Multiple simultaneous projections — your image multiplied across a field of holographic panels. A visual language borrowed from next-generation live productions.",
    accent: "#f59e0b",
    tag: "Multi-Projection · Immersive Art",
  },
  {
    number: "06",
    title: "LIVE PERFORMANCE",
    subtitle: "The Complete Hologram Experience",
    desc: "The culmination. A full concert hologram performance — your movement, your energy, your artistry — projected as a living light sculpture for your audience.",
    accent: "#ec4899",
    tag: "Full Production · Live Ready",
    flip: true,
  },
];

// ─── Global keyframe CSS ─────────────────────────────────────────────────────

const GLOBAL_CSS = `
  @keyframes glitch-a {
    0%, 100% { transform: none; opacity: 1; }
    7%  { transform: skewX(-8deg); opacity: 0.8; }
    10% { transform: none; opacity: 1; }
    27% { transform: skewX(4deg); opacity: 0.85; }
    30% { transform: none; opacity: 1; }
  }
  @keyframes holo-ring {
    0%   { transform: rotate(0deg) scale(1);     opacity: 0.4; }
    50%  { transform: rotate(180deg) scale(1.05); opacity: 0.15; }
    100% { transform: rotate(360deg) scale(1);   opacity: 0.4; }
  }
  @keyframes shimmer {
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
  }
  .glitch-title { animation: glitch-a 5s infinite; }
  .scrollbar-hide::-webkit-scrollbar { display: none; }
  .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
`;

// ─── HoloGrid background ─────────────────────────────────────────────────────

function HoloGrid({ opacity = 0.06 }: { opacity?: number }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <svg className="absolute inset-0 w-full h-full" style={{ opacity }} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="hgrid" width="60" height="60" patternUnits="userSpaceOnUse">
            <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#00f5ff" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hgrid)" />
      </svg>
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(0,245,255,0.07) 0%, transparent 70%)" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 60% 50% at 100% 100%, rgba(168,85,247,0.05) 0%, transparent 60%)" }} />
    </div>
  );
}

// ─── Intersection-observer reveal ────────────────────────────────────────────

function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

// ─── Lightbox ────────────────────────────────────────────────────────────────

function Lightbox({
  images,
  index,
  onClose,
  onNext,
  onPrev,
}: {
  images: HoloImage[];
  index: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const img = images[index];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onNext();
      if (e.key === "ArrowLeft") onPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, onPrev]);

  if (!img) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.95)", backdropFilter: "blur(20px)" }}
      onClick={onClose}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <X className="w-5 h-5" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onPrev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onNext(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-xl flex items-center justify-center text-white/60 hover:text-white transition-colors"
        style={{ background: "rgba(255,255,255,0.08)" }}
      >
        <ChevronRight className="w-6 h-6" />
      </button>

      <motion.div
        key={index}
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="relative max-w-5xl mx-8 w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={img.url}
          alt={`Scene ${index + 1}`}
          className="w-full h-auto max-h-[80vh] object-contain rounded-2xl"
          style={{ boxShadow: "0 0 80px rgba(0,245,255,0.15)" }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 flex items-center justify-between px-5 py-4 rounded-b-2xl"
          style={{ background: "linear-gradient(0deg, rgba(0,0,0,0.85), transparent)" }}
        >
          <div>
            <p className="text-white font-bold text-sm">Scene {index + 1} / {images.length}</p>
            <p className="text-white/40 text-xs mt-0.5">{SCENES[index]?.title ?? ""}</p>
          </div>
          <a
            href={img.url}
            download={`hologram-scene-${index + 1}.jpg`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)" }}
          >
            <Download className="w-3.5 h-3.5" /> Download
          </a>
        </div>
      </motion.div>

      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5">
        {images.map((_, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full transition-all"
            style={{ background: i === index ? "#00f5ff" : "rgba(255,255,255,0.2)", transform: i === index ? "scale(1.4)" : "scale(1)" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ─── Custom Scene Generator ───────────────────────────────────────────────────

function CustomSceneGenerator({ artistId }: { artistId: string }) {
  const { toast } = useToast();
  const { ensureSignedIn } = useRequireAuth();
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [resultLightbox, setResultLightbox] = useState(false);

  const PRESETS = [
    "Performing on a massive LED stage with neon rain falling and 100,000 fans",
    "Holographic portrait floating in deep space surrounded by stars",
    "Giant projection inside a cyberpunk city at night",
    "Underwater hologram surrounded by glowing bioluminescent light",
    "Multiple transparent hologram copies performing synchronized choreography",
  ];

  const generate = async () => {
    if (!prompt.trim()) return;
    if (!ensureSignedIn()) return;
    setIsGenerating(true);
    setResult(null);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/generate-custom`,
        method: "POST",
        data: { prompt: prompt.trim() },
      });
      if (data?.imageUrl) {
        setResult(data.imageUrl);
        toast({ title: "✅ Custom scene generated!" });
      } else {
        toast({ title: "Generation failed", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.14)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)" }}
        >
          <Wand2 className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm">Custom Scene Generator</h3>
          <p className="text-zinc-500 text-xs">Describe your vision → Boostify AI creates it with your identity</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setPrompt(p)}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-zinc-400 border border-white/[0.07] hover:text-cyan-400 hover:border-cyan-400/30 transition-all"
          >
            {p.split(" ").slice(0, 4).join(" ")}…
          </button>
        ))}
      </div>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the hologram scene you want — Boostify AI will preserve your identity…"
        rows={3}
        className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-400/30 resize-none"
      />

      <button
        onClick={generate}
        disabled={!prompt.trim() || isGenerating}
        className="w-full py-3 rounded-xl font-black text-sm text-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40"
        style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 24px rgba(0,245,255,0.18)" }}
      >
        {isGenerating ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Generating with Boostify AI…
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4" /> Generate Custom Scene
          </span>
        )}
      </button>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-xl overflow-hidden group cursor-pointer"
            onClick={() => setResultLightbox(true)}
          >
            <img src={result} alt="Custom scene" className="w-full h-auto rounded-xl" />
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.4)" }}
            >
              <Maximize2 className="w-8 h-8 text-white" />
            </div>
            <div
              className="absolute top-3 left-3 px-2 py-1 rounded-full text-[10px] font-black"
              style={{ background: "rgba(0,245,255,0.18)", border: "1px solid rgba(0,245,255,0.4)", color: "#00f5ff" }}
            >
              CUSTOM · BOOSTIFY AI
            </div>
            <a
              href={result}
              download="custom-hologram.jpg"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all hover:scale-105"
              style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)" }}
            >
              <Download className="w-3 h-3" /> Save
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {resultLightbox && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center p-8"
            style={{ background: "rgba(0,0,0,0.96)" }}
            onClick={() => setResultLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-xl flex items-center justify-center text-white/60 hover:text-white"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={result}
              alt="Custom scene"
              className="max-w-4xl max-h-[85vh] object-contain rounded-2xl"
              style={{ boxShadow: "0 0 80px rgba(0,245,255,0.2)" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 3D Character viewer (model-viewer) ──────────────────────────────────────

function ModelViewer({ src }: { src: string }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if ((window as any).customElements?.get("model-viewer")) {
      setReady(true);
      return;
    }
    if (document.querySelector("script[data-model-viewer]")) {
      const check = setInterval(() => {
        if ((window as any).customElements?.get("model-viewer")) {
          setReady(true);
          clearInterval(check);
        }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement("script");
    script.type = "module";
    script.src = "https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js";
    script.setAttribute("data-model-viewer", "true");
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: "#000" }}>
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    // @ts-ignore — model-viewer web component
    <model-viewer
      src={src}
      alt="3D artist character"
      loading="eager"
      draco-decoder-location="https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
      auto-rotate
      camera-controls
      exposure="1.1"
      shadow-intensity="1"
      style={{ width: "100%", height: "100%", background: "#000" } as React.CSSProperties}
    />
  );
}

// ─── 3D Character block (inside Avatar section) ───────────────────────────────

function Character3DBlock({
  artistId,
  artistName,
  character,
  onGenerated,
  sceneImages = [],
}: {
  artistId: string;
  artistName: string;
  character: HoloCharacter3D | null;
  onGenerated: (c: HoloCharacter3D) => void;
  sceneImages?: string[];
}) {
  const { toast } = useToast();
  const { ensureSignedIn } = useRequireAuth();
  const [, navigate] = useLocation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [pose, setPose] = useState<"a-pose" | "t-pose">("a-pose");
  const [quality, setQuality] = useState<"web" | "balanced" | "hq">("balanced");

  // Fetch the artist's catalog so the avatar can lip-sync & dance to a real song.
  // Routed through the same-origin Firebase proxy so the Web-Audio analyser isn't
  // blocked by cross-origin tainting.
  const [song, setSong] = useState<{ url: string; title: string; rawUrl: string } | null>(null);
  useEffect(() => {
    if (!/^\d+$/.test(String(artistId))) return; // songs endpoint needs a numeric user id
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/songs/user/${artistId}`);
        if (!res.ok) return;
        const list: any[] = await res.json();
        const first = Array.isArray(list) ? list.find((s) => s?.audioUrl) : null;
        if (active && first?.audioUrl) {
          const raw = first.audioUrl as string;
          const proxied =
            raw.includes("firebasestorage.googleapis.com") || raw.includes("storage.googleapis.com")
              ? `/api/proxy/firebase-file?url=${encodeURIComponent(raw)}`
              : raw;
          setSong({ url: proxied, title: first.title || "Untitled", rawUrl: raw });
        }
      } catch { /* optional — local file load still available */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  // Immersive 360° AI environments (equirectangular worlds for the avatar).
  const [environments, setEnvironments] = useState<{ url: string; label?: string; depthUrl?: string | null }[]>([]);
  const [isGenEnv, setIsGenEnv] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/hologram-gallery/${artistId}/environments`);
        if (!res.ok) return;
        const data = await res.json();
        if (active && Array.isArray(data?.environments)) {
          setEnvironments(data.environments.filter((e: any) => e?.url).map((e: any) => ({ url: e.url, label: e.label, depthUrl: e.depthUrl ?? null })));
        }
      } catch { /* optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  const generateEnvironments = async (force = false) => {
    if (!ensureSignedIn()) return;
    setIsGenEnv(true);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/environments/generate`,
        method: "POST",
        data: { forceRegenerate: force },
      });
      if (Array.isArray(data?.environments) && data.environments.length > 0) {
        setEnvironments(data.environments.filter((e: any) => e?.url).map((e: any) => ({ url: e.url, label: e.label, depthUrl: e.depthUrl ?? null })));
        toast({ title: "🌍 Immersive worlds ready!", description: `${data.environments.length} 3D environments generated. Pick one in the "World" control.` });
      } else {
        toast({ title: "Environment generation failed", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenEnv(false);
    }
  };

  const generate = async (force = false) => {
    if (!ensureSignedIn()) return;
    setIsGenerating(true);
    setProgress(4);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 2, 92)), 2500);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/character-3d`,
        method: "POST",
        data: { forceRegenerate: force, pose, quality },
      });
      clearInterval(timer);
      setProgress(100);
      if (data?.character?.glbUrl) {
        onGenerated(data.character);
        toast({ title: "✅ 3D character ready!", description: "Your 3D model is connected to the Hologram Show Engine." });
      } else {
        toast({ title: "3D generation failed", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      clearInterval(timer);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // Open Mixamo with the rig-ready source (FBX preferred, OBJ fallback) downloaded.
  const sendToMixamo = () => {
    const rigUrl = character?.fbxUrl || character?.objUrl;
    if (rigUrl) {
      const a = document.createElement("a");
      a.href = rigUrl;
      a.download = `${artistName}-rig-source`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.open("https://www.mixamo.com/#/?page=1&type=Character", "_blank", "noopener");
    toast({
      title: "Upload to Mixamo",
      description: rigUrl
        ? "Rig source downloaded. In Mixamo: Upload Character → Auto-Rig → pick an animation → Download as FBX (with skin), then click Attach."
        : "Use the downloaded GLB/OBJ to auto-rig in Mixamo, then Attach the animated FBX.",
    });
  };

  // Attach a Mixamo-exported animated FBX/GLB URL to the character.
  const attachAnimated = async () => {
    if (!ensureSignedIn()) return;
    const url = window.prompt("Paste the public URL of your Mixamo animation (.fbx or .glb):");
    if (!url) return;
    if (!/^https?:\/\/.+\.(fbx|glb)(\?.*)?$/i.test(url.trim())) {
      toast({ title: "Invalid URL", description: "Must be a public .fbx or .glb URL.", variant: "destructive" });
      return;
    }
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/character-3d/animated`,
        method: "POST",
        data: { animatedUrl: url.trim() },
      });
      if (data?.character) {
        onGenerated(data.character);
        toast({ title: "✅ Animation attached!", description: "Your character now plays the Mixamo animation." });
      } else {
        toast({ title: "Attach failed", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Tripo AI auto-rig (no manual Mixamo upload) ──
  const [isRigging, setIsRigging] = useState(false);
  const [rigAnim, setRigAnim] = useState<string>("preset:idle");
  const rigPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollRigStatus = useCallback(() => {
    if (rigPollRef.current) clearInterval(rigPollRef.current);
    setIsRigging(true);
    rigPollRef.current = setInterval(async () => {
      try {
        const data: any = await apiRequest({ url: `/api/hologram-gallery/${artistId}/character-3d`, method: "GET" });
        const c = data?.character;
        if (!c) return;
        if (c.rigStatus === "ready") {
          if (rigPollRef.current) clearInterval(rigPollRef.current);
          rigPollRef.current = null;
          setIsRigging(false);
          onGenerated(c);
          toast({
            title: "✅ Auto-rig complete!",
            description: c.rigSkeleton === "mixamo"
              ? "Mixamo-compatible skeleton ready — attach any Mixamo clip."
              : "Your character is rigged and animated.",
          });
        } else if (c.rigStatus === "failed") {
          if (rigPollRef.current) clearInterval(rigPollRef.current);
          rigPollRef.current = null;
          setIsRigging(false);
          onGenerated(c);
          toast({ title: "Auto-rig failed", description: c.rigError || "Please try again.", variant: "destructive" });
        }
      } catch { /* keep polling */ }
    }, 4000);
  }, [artistId, onGenerated, toast]);

  const autoRig = async () => {
    if (!ensureSignedIn()) return;
    try {
      setIsRigging(true);
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/character-3d/auto-rig`,
        method: "POST",
        data: { animation: rigAnim },
      });
      if (data?.success || data?.status === "processing") {
        toast({ title: "🦴 Auto-rigging started", description: "Building skeleton & animation with AI (~2-4 min)…" });
        pollRigStatus();
      } else {
        setIsRigging(false);
        toast({ title: "Couldn't start auto-rig", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      setIsRigging(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Resume polling if a rig job was already running when the page loaded.
  useEffect(() => {
    if (character?.rigStatus === "processing") pollRigStatus();
    return () => { if (rigPollRef.current) clearInterval(rigPollRef.current); };
  }, [character?.rigStatus, pollRigStatus]);

  // ── Meshy rig (rigs the EXISTING GLB directly — no regeneration) ──
  const [meshyAnim, setMeshyAnim] = useState<string>("none");
  const meshyRig = async () => {
    if (!ensureSignedIn()) return;
    try {
      setIsRigging(true);
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/character-3d/meshy-rig`,
        method: "POST",
        data: { animation: meshyAnim },
      });
      if (data?.success || data?.status === "processing") {
        toast({ title: "🦴 Meshy rigging started", description: "Rigging your current model directly (~1-3 min)…" });
        pollRigStatus();
      } else {
        setIsRigging(false);
        toast({ title: "Couldn't start Meshy rig", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      setIsRigging(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // ── Singing performance (AI video → motion transfer) ──
  const [isPerforming, setIsPerforming] = useState(false);
  const perfPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pollPerfStatus = useCallback(() => {
    if (perfPollRef.current) clearInterval(perfPollRef.current);
    setIsPerforming(true);
    perfPollRef.current = setInterval(async () => {
      try {
        const data: any = await apiRequest({ url: `/api/hologram-gallery/${artistId}/character-3d`, method: "GET" });
        const c = data?.character;
        if (!c) return;
        if (c.perfStatus === "ready") {
          if (perfPollRef.current) clearInterval(perfPollRef.current);
          perfPollRef.current = null;
          setIsPerforming(false);
          onGenerated(c);
          toast({
            title: "🎤 Singing performance ready!",
            description: c.motionTimeline
              ? "Press play on the song — your avatar now performs the captured motion."
              : "Video generated. The avatar will use procedural singing motion.",
          });
        } else if (c.perfStatus === "failed") {
          if (perfPollRef.current) clearInterval(perfPollRef.current);
          perfPollRef.current = null;
          setIsPerforming(false);
          onGenerated(c);
          toast({ title: "Performance failed", description: c.perfError || "Please try again.", variant: "destructive" });
        }
      } catch { /* keep polling */ }
    }, 5000);
  }, [artistId, onGenerated, toast]);

  const generatePerformance = async () => {
    if (!ensureSignedIn()) return;
    try {
      setIsPerforming(true);
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/character-3d/singing-performance`,
        method: "POST",
        // Send the raw song URL → backend trims a ≤30s clip and drives OmniHuman
        // (audio-synced lips + body) + sync-lipsync for a perfectly synced video.
        data: song?.rawUrl
          ? { audioUrl: song.rawUrl, startSec: 0, duration: 8, songTitle: song?.title }
          : (song?.title ? { songTitle: song.title } : {}),
      });
      if (data?.success || data?.status === "processing") {
        toast({
          title: song?.rawUrl ? "🎤 Generating lip-synced performance" : "🎬 Generating singing performance",
          description: song?.rawUrl
            ? "OmniHuman is making your artist sing the real song + capturing motion (~3-5 min)…"
            : "Creating the video & capturing motion (~2-4 min)…",
        });
        pollPerfStatus();
      } else {
        setIsPerforming(false);
        toast({ title: "Couldn't start", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      setIsPerforming(false);
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // Resume polling if a performance job was already running when the page loaded.
  useEffect(() => {
    if (character?.perfStatus === "processing") pollPerfStatus();
    return () => { if (perfPollRef.current) clearInterval(perfPollRef.current); };
  }, [character?.perfStatus, pollPerfStatus]);

  // Pick the model to display: animated (Mixamo) takes priority over the static mesh.
  const displaySrc = character?.animatedUrl || character?.animatedGlbUrl || character?.glbUrl || "";
  const displayFormat: "glb" | "fbx" =
    (character?.animatedUrl || character?.animatedGlbUrl)
      ? (character?.animatedFormat || "glb")
      : "glb";

  // When a lip-synced performance exists, play back the EXACT clip OmniHuman used
  // (proxied for the Web-Audio analyser) so the captured motion timeline — whose
  // t=0 is the clip start — stays perfectly aligned with the audio and the video.
  const perfAudio = character?.performanceAudioUrl
    ? `/api/proxy/firebase-file?url=${encodeURIComponent(character.performanceAudioUrl)}`
    : null;

  // Performance library: pick which captured performance drives the avatar.
  const perfClips = character?.performanceClips ?? [];
  const [selectedPerfId, setSelectedPerfId] = useState<string | null>(null);
  const activePerfClip =
    perfClips.find((p) => p.id === selectedPerfId) ??
    perfClips.find((p) => p.id === character?.latestPerformanceId) ??
    perfClips[0] ??
    null;
  const activeMotionTimeline = activePerfClip?.motionTimeline ?? character?.motionTimeline ?? null;
  const activePerfAudio = activePerfClip?.audioUrl
    ? `/api/proxy/firebase-file?url=${encodeURIComponent(activePerfClip.audioUrl)}`
    : perfAudio;
  const activePerfTitle = activePerfClip?.songTitle || song?.title;

  const viewerAudioSrc = activePerfAudio || song?.url;
  const viewerSongTitle = activePerfAudio
    ? (activePerfTitle ? `${activePerfTitle} (performance clip)` : "Performance clip")
    : song?.title;

  return (
    <div
      className="rounded-2xl p-6 mt-6"
      style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.14)" }}
    >
      <div className="flex items-center gap-3 mb-5">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.3)" }}
        >
          <Box className="w-4 h-4 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm">3D Character Model</h3>
          <p className="text-zinc-500 text-xs">A real rotatable 3D model of {artistName} — ready for the virtual stage</p>
        </div>
      </div>

      {character?.glbUrl ? (
        <>
          <div className="relative rounded-xl overflow-hidden mb-4" style={{ aspectRatio: "1/1", border: "1px solid rgba(0,245,255,0.18)" }}>
            <Suspense
              fallback={
                <div className="w-full h-full flex items-center justify-center" style={{ background: "#000" }}>
                  <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
                </div>
              }
            >
              <HologramStageViewer src={displaySrc} format={displayFormat} poster={character.thumbnailUrl || character.sourceImageUrl} backgrounds={sceneImages} environments={environments} audioSrc={viewerAudioSrc} songTitle={viewerSongTitle} motionTimeline={activeMotionTimeline} liveLinkRoom={artistId} />
            </Suspense>
            <div
              className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase pointer-events-none z-10"
              style={{ background: "rgba(0,245,255,0.16)", border: "1px solid rgba(0,245,255,0.4)", color: "#00f5ff", backdropFilter: "blur(8px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00f5ff" }} />
              {character.rigged ? "ANIMATED 3D · DRAG TO ROTATE" : "3D MODEL · DRAG TO ROTATE"}
            </div>
          </div>
          {/* Performance library — pick which captured performance drives the avatar */}
          {perfClips.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-1.5">
                <Mic className="w-3.5 h-3.5 text-pink-400" />
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                  Performance motion ({perfClips.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {perfClips.map((clip) => {
                  const isActive = activePerfClip?.id === clip.id;
                  return (
                    <button
                      key={clip.id}
                      onClick={() => setSelectedPerfId(clip.id)}
                      disabled={!clip.hasMotion}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all disabled:opacity-40"
                      style={isActive
                        ? { background: "#ec4899", color: "#fff", border: "1px solid #ec4899" }
                        : { background: "rgba(236,72,153,0.1)", color: "#f9a8d4", border: "1px solid rgba(236,72,153,0.25)" }}
                      title={clip.hasMotion ? "Drive the avatar with this performance" : "No motion captured for this clip"}
                    >
                      {clip.songTitle || "Performance"}
                      <span className="ml-1 opacity-60">{Math.round(clip.duration || clip.clipDuration || 0)}s</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                Press play on the song to replay the selected performance on your avatar.
              </p>
            </div>
          )}
          {/* Pose + quality controls for (re)generation */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Pose</span>
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                {(["a-pose", "t-pose"] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPose(p)}
                    className="px-3 py-1 rounded-md text-[11px] font-bold transition-all"
                    style={pose === p
                      ? { background: "#00f5ff", color: "#000" }
                      : { color: "rgba(255,255,255,0.6)" }}
                  >
                    {p === "a-pose" ? "A-Pose" : "T-Pose"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Quality</span>
              <div className="flex gap-1 p-1 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                {(["web", "balanced", "hq"] as const).map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuality(q)}
                    className="px-3 py-1 rounded-md text-[11px] font-bold transition-all capitalize"
                    style={quality === q
                      ? { background: "#a855f7", color: "#000" }
                      : { color: "rgba(255,255,255,0.6)" }}
                  >
                    {q === "hq" ? "HQ" : q}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {/* Immersive 360° AI environments — generate cinematic 3D worlds */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(0,245,255,0.06)", border: "1px solid rgba(0,245,255,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Box className="w-4 h-4 text-cyan-400" />
              <span className="text-white font-bold text-xs">
                Immersive 3D Worlds <span className="text-zinc-500 font-normal">· AI-generated 360° stages</span>
              </span>
              {environments.length > 0 && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <Check className="w-3 h-3" /> {environments.length} ready
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-[11px] mb-3 leading-relaxed">
              Generate cinematic arenas, neon clubs, deep space and more — the avatar stands inside a real, light-emitting world. Pick one in the <span className="text-cyan-400 font-semibold">"World"</span> control on the viewer.
            </p>
            <button
              onClick={() => generateEnvironments(environments.length > 0)}
              disabled={isGenEnv}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "#00f5ff", color: "#000" }}
            >
              {isGenEnv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
              {isGenEnv ? "Generating worlds…" : environments.length > 0 ? "Regenerate Worlds" : "Generate 3D Worlds"}
            </button>
          </div>
          {/* Singing Performance — AI video → real motion transferred to the avatar */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(236,72,153,0.06)", border: "1px solid rgba(236,72,153,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-4 h-4 text-pink-400" />
              <span className="text-white font-bold text-xs">
                Singing Performance <span className="text-zinc-500 font-normal">· OmniHuman lip-sync + motion capture</span>
              </span>
              {character.perfStatus === "ready" && character.motionTimeline && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <Check className="w-3 h-3" /> {character.perfMode === "omnihuman" ? "Lip-synced" : "Motion captured"}
                </span>
              )}
            </div>
            <p className="text-zinc-500 text-[11px] mb-3 leading-relaxed">
              Makes {artistName} actually <span className="text-pink-400 font-semibold">sing the real song</span>: OmniHuman drives the lips, face and body from the track's audio, sync-lipsync sharpens the mouth, and the performance motion is transferred onto the 3D avatar — all locked to the same clip so the video, audio and avatar stay in perfect sync. Press <span className="text-pink-400 font-semibold">play</span> in the viewer.
            </p>
            {character.performanceVideoUrl && (
              <video
                src={character.performanceVideoUrl}
                controls
                playsInline
                className="w-full rounded-lg mb-3"
                style={{ maxHeight: 220, background: "#000", border: "1px solid rgba(236,72,153,0.2)" }}
              />
            )}
            <button
              onClick={generatePerformance}
              disabled={isPerforming}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
              style={{ background: "#ec4899", color: "#000" }}
            >
              {isPerforming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
              {isPerforming
                ? (character.perfStage === "audio" ? "Preparing audio…"
                    : character.perfStage === "lipsync" ? "Lip-syncing…"
                    : character.perfStage === "motion" ? "Capturing motion…"
                    : "Generating video…")
                : character.motionTimeline ? "Regenerate Performance" : "Generate Singing Performance"}
            </button>
          </div>
          {/* AI Auto-Rig (Tripo) — API alternative to manual Mixamo upload */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(168,85,247,0.06)", border: "1px solid rgba(168,85,247,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Wand2 className="w-4 h-4 text-purple-400" />
              <span className="text-white font-bold text-xs">
                AI Auto-Rig <span className="text-zinc-500 font-normal">· no Mixamo upload needed</span>
              </span>
              {character.rigStatus === "ready" && character.rigProvider === "tripo" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <Check className="w-3 h-3" /> {character.rigSkeleton === "mixamo" ? "Mixamo-ready" : "Rigged"}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={rigAnim}
                onChange={(e) => setRigAnim(e.target.value)}
                disabled={isRigging}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-black/40 text-white border border-white/10 outline-none disabled:opacity-50"
              >
                <option value="preset:idle">Idle (breathing)</option>
                <option value="preset:walk">Walk</option>
                <option value="preset:run">Run</option>
                <option value="preset:jump">Jump</option>
                <option value="preset:dive">Dive</option>
                <option value="none">Mixamo-ready skeleton (no animation)</option>
              </select>
              <button
                onClick={autoRig}
                disabled={isRigging}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.45)", color: "#c084fc" }}
              >
                {isRigging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {isRigging ? `Rigging…${character.rigStage ? ` (${character.rigStage})` : ""}` : "Auto-Rig with AI"}
              </button>
            </div>
            {isRigging && (
              <p className="text-zinc-500 text-[11px] mt-2">
                Generating riggable mesh → skeleton → animation. Runs in the background — you can leave this page.
              </p>
            )}
          </div>
          {/* Meshy Rig — rigs the EXISTING GLB directly (no regeneration) */}
          <div className="rounded-xl p-4 mb-4" style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Box className="w-4 h-4 text-emerald-400" />
              <span className="text-white font-bold text-xs">
                Meshy Rig <span className="text-zinc-500 font-normal">· rigs your current model, no regeneration</span>
              </span>
              {character.rigStatus === "ready" && character.rigProvider === "meshy" && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <Check className="w-3 h-3" /> Mixamo-ready
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={meshyAnim}
                onChange={(e) => setMeshyAnim(e.target.value)}
                disabled={isRigging}
                className="px-3 py-2 rounded-lg text-xs font-bold bg-black/40 text-white border border-white/10 outline-none disabled:opacity-50"
              >
                <option value="none">Rigged skeleton (no animation)</option>
                <option value="walking">Walking</option>
                <option value="running">Running</option>
              </select>
              <button
                onClick={meshyRig}
                disabled={isRigging}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs transition-all hover:scale-105 disabled:opacity-50"
                style={{ background: "rgba(34,197,94,0.16)", border: "1px solid rgba(34,197,94,0.45)", color: "#4ade80" }}
              >
                {isRigging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Box className="w-4 h-4" />}
                {isRigging ? `Rigging…${character.rigStage ? ` (${character.rigStage})` : ""}` : "Rig with Meshy"}
              </button>
            </div>
            <p className="text-zinc-500 text-[11px] mt-2">
              Rigs the GLB you already generated (Mixamo-compatible skeleton + optional walk/run). Best for clean humanoid meshes facing forward.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => navigate(`/hologram-show-engine?artist=${encodeURIComponent(artistId)}&name=${encodeURIComponent(artistName)}`)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-black transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 30px rgba(0,245,255,0.2)" }}
            >
              <Zap className="w-4 h-4" /> Place in Show Engine
            </button>
            <button
              onClick={() => navigate(`/motion-capture/${encodeURIComponent(artistId)}`)}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{ background: "rgba(34,255,155,0.12)", border: "1px solid rgba(34,255,155,0.45)", color: "#22ff9b" }}
            >
              <Radio className="w-4 h-4" /> Live Motion Capture
            </button>
            <button
              onClick={sendToMixamo}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{ background: "rgba(168,85,247,0.12)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc" }}
            >
              <Zap className="w-4 h-4" /> Rig &amp; Animate on Mixamo
            </button>
            <button
              onClick={attachAnimated}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
            >
              <Download className="w-4 h-4 rotate-180" /> Attach Animation
            </button>
            <button
              onClick={() => generate(true)}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
            >
              {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Regenerate 3D
            </button>
            <a
              href={character.glbUrl}
              download={`${artistName}-3d-character.glb`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
            >
              <Download className="w-4 h-4" /> GLB
            </a>
          </div>
        </>
      ) : isGenerating ? (
        <div className="py-10 text-center">
          <div className="relative w-16 h-16 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-spin" style={{ animationDuration: "3s" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              <Box className="w-6 h-6 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <p className="text-white font-bold text-sm mb-1">Building your 3D character…</p>
          <p className="text-zinc-500 text-xs mb-4">Generating A-pose · reconstructing mesh · texturing (~1-3 min)</p>
          <div className="w-full max-w-xs mx-auto h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00f5ff, #a855f7)" }} />
          </div>
          <p className="text-zinc-600 text-xs mt-2">{progress}%</p>
        </div>
      ) : (
        <div className="py-8 text-center">
          <p className="text-zinc-400 text-sm mb-4 max-w-sm mx-auto">
            Turn {artistName} into a real 3D model — rotate it, project it on a virtual stage, and animate it in the Hologram Show Engine.
          </p>
          <button
            onClick={() => generate(false)}
            className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-black text-sm text-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 30px rgba(0,245,255,0.2)" }}
          >
            <Box className="w-4 h-4" /> Generate 3D Character
          </button>
          <p className="mt-3 text-zinc-600 text-xs">Built from your real photos · rotatable GLB model</p>
        </div>
      )}
    </div>
  );
}

// ─── Holographic Avatar Section ─────────────────────────────────────────────────

function AvatarSection({
  artistId,
  artistName,
  avatar,
  onAvatarGenerated,
  character3d,
  onCharacter3dGenerated,
  sceneImages = [],
}: {
  artistId: string;
  artistName: string;
  avatar: HoloAvatar | null;
  onAvatarGenerated: (a: HoloAvatar) => void;
  character3d: HoloCharacter3D | null;
  onCharacter3dGenerated: (c: HoloCharacter3D) => void;
  sceneImages?: string[];
}) {
  const { toast } = useToast();
  const { ensureSignedIn } = useRequireAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [, navigate] = useLocation();

  const generateAvatar = async (force = false) => {
    if (!ensureSignedIn()) return;
    setIsGenerating(true);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/avatar`,
        method: "POST",
        data: { forceRegenerate: force },
      });
      if (data?.avatar) {
        onAvatarGenerated(data.avatar);
        toast({ title: "✅ Holographic avatar ready!", description: "Your AI avatar is now connected to the Hologram Show Engine." });
      } else {
        toast({ title: "Avatar generation failed", description: data?.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section id="avatar" className="relative py-24 border-t border-white/[0.04] overflow-hidden">
      <HoloGrid opacity={0.04} />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="text-center mb-12">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400 mb-3">Digital Twin Technology</div>
          <h2 className="text-3xl xl:text-4xl font-black text-white mb-2">HOLOGRAPHIC AI AVATAR</h2>
          <p className="text-zinc-500 text-sm max-w-lg mx-auto">
            Your digital twin, generated by Boostify AI from your real photos — the foundation of your virtual concert in the Hologram Show Engine.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-10 items-center">
          {/* Avatar display */}
          <div className="relative mx-auto w-full max-w-sm">
            <div
              className="absolute -inset-3 rounded-3xl pointer-events-none"
              style={{ border: "1px solid rgba(168,85,247,0.2)", boxShadow: "0 0 80px rgba(168,85,247,0.12)" }}
            />
            {avatar ? (
              <div className="relative rounded-2xl overflow-hidden" style={{ aspectRatio: "3/4" }}>
                <img src={avatar.url} alt={`${artistName} holographic avatar`} className="w-full h-full object-cover" />
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(168,85,247,0.02) 3px, rgba(168,85,247,0.02) 4px)" }}
                />
                <div
                  className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase"
                  style={{ background: "rgba(168,85,247,0.16)", border: "1px solid rgba(168,85,247,0.4)", color: "#c084fc", backdropFilter: "blur(8px)" }}
                >
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#c084fc" }} />
                  AI AVATAR · BOOSTIFY
                </div>
              </div>
            ) : (
              <div
                className="rounded-2xl flex items-center justify-center"
                style={{ aspectRatio: "3/4", background: "rgba(168,85,247,0.05)", border: "1px dashed rgba(168,85,247,0.25)" }}
              >
                <div className="text-center px-6">
                  <Sparkles className="w-10 h-10 mx-auto mb-3 text-purple-400/40" />
                  <p className="text-sm text-purple-300/50 font-bold">No avatar yet</p>
                  <p className="text-xs text-zinc-600 mt-1">Generate your holographic digital twin from your real photos</p>
                </div>
              </div>
            )}
          </div>

          {/* Info + actions */}
          <div>
            <h3 className="text-xl font-black text-white mb-3">{artistName}&apos;s Digital Twin</h3>
            <ul className="space-y-3 mb-8">
              {[
                "Generated from your real profile + gallery photos — your exact likeness",
                "Full-body holographic look ready for virtual stage projection",
                "Connected to the Hologram Show Engine for your virtual concert",
                "Stored permanently — reusable across every Boostify production",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-zinc-400">
                  <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: "#c084fc" }} />
                  {t}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => generateAvatar(!!avatar)}
                disabled={isGenerating}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm text-black transition-all hover:scale-105 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #c084fc, #00f5ff)", boxShadow: "0 0 30px rgba(168,85,247,0.2)" }}
              >
                {isGenerating ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Generating avatar…</>
                ) : avatar ? (
                  <><RefreshCw className="w-4 h-4" /> Regenerate Avatar</>
                ) : (
                  <><Sparkles className="w-4 h-4" /> Generate My AI Avatar</>
                )}
              </button>
              {avatar && (
                <button
                  onClick={() => navigate(`/hologram-show-engine?artist=${encodeURIComponent(artistId)}&name=${encodeURIComponent(artistName)}`)}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-black text-sm transition-all hover:scale-105"
                  style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.3)", color: "#00f5ff" }}
                >
                  <Zap className="w-4 h-4" /> Use in Show Engine
                </button>
              )}
            </div>
            {avatar?.referenceCount ? (
              <p className="mt-4 text-xs text-zinc-600">Built from {avatar.referenceCount} real reference photos · {avatar.model}</p>
            ) : null}
          </div>
        </div>

        {/* Real 3D character model */}
        <Character3DBlock
          artistId={artistId}
          artistName={artistName}
          character={character3d}
          onGenerated={onCharacter3dGenerated}
          sceneImages={sceneImages}
        />
      </div>
    </section>
  );
}

// ─── Virtual Concert — sell the project ────────────────────────────────────

function VirtualConcertSection({
  artistId,
  artistName,
  genre,
  heroImage,
}: {
  artistId: string;
  artistName: string;
  genre: string;
  heroImage?: string;
}) {
  const [, navigate] = useLocation();
  const engineUrl = `/hologram-show-engine?artist=${encodeURIComponent(artistId)}&name=${encodeURIComponent(artistName)}`;

  const OFFERS = [
    { title: "Virtual Single Show", desc: "1 song performed by your hologram on a custom virtual stage — perfect for releases and promo events.", accent: "#00f5ff", tag: "ENTRY" },
    { title: "Virtual Concert", desc: "Full 45-60 min hologram concert: custom stage design, light show, and your avatar performing your setlist.", accent: "#a855f7", tag: "MOST POPULAR" },
    { title: "World Hologram Tour", desc: "Simultaneous projections in multiple venues worldwide — your concert everywhere, the same night.", accent: "#ec4899", tag: "PREMIUM" },
  ];

  return (
    <section id="virtual-concert" className="relative py-24 overflow-hidden border-t border-white/[0.04]">
      {heroImage && (
        <div className="absolute inset-0">
          <img src={heroImage} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.08]" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #030308 0%, rgba(3,3,8,0.7) 50%, #030308 100%)" }} />
        </div>
      )}
      <HoloGrid opacity={0.05} />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[11px] font-black uppercase tracking-[0.3em]"
            style={{ background: "rgba(236,72,153,0.08)", border: "1px solid rgba(236,72,153,0.3)", color: "#ec4899" }}
          >
            <span className="w-2 h-2 rounded-full bg-pink-500 animate-pulse" />
            THE FUTURE OF LIVE MUSIC · AVAILABLE NOW
          </div>
          <h2 className="text-3xl xl:text-5xl font-black text-white mb-4 tracking-tight">
            {artistName.toUpperCase()}<br />
            <span style={{ background: "linear-gradient(135deg, #00f5ff, #ec4899)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              VIRTUAL CONCERT
            </span>
          </h2>
          <p className="text-zinc-400 text-sm max-w-2xl mx-auto leading-relaxed">
            Perform anywhere in the world without traveling. Your holographic avatar takes the stage —
            a full {genre} concert experience projected in venues, festivals and immersive spaces,
            powered by the Boostify Hologram Show Engine.
          </p>
        </div>

        {/* Offer cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-12">
          {OFFERS.map((o) => (
            <div
              key={o.title}
              className="relative rounded-2xl p-6 transition-all hover:scale-[1.02] cursor-pointer"
              style={{ background: `${o.accent}07`, border: `1px solid ${o.accent}22` }}
              onClick={() => navigate(engineUrl)}
            >
              <div
                className="inline-flex px-2.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest mb-4"
                style={{ background: `${o.accent}14`, color: o.accent, border: `1px solid ${o.accent}32` }}
              >
                {o.tag}
              </div>
              <h3 className="text-lg font-black text-white mb-2">{o.title}</h3>
              <p className="text-xs text-zinc-500 leading-relaxed mb-4">{o.desc}</p>
              <span className="inline-flex items-center gap-1.5 text-xs font-bold" style={{ color: o.accent }}>
                Request proposal <ChevronRight className="w-3.5 h-3.5" />
              </span>
            </div>
          ))}
        </div>

        {/* Stats + CTA */}
        <div className="flex flex-wrap justify-center gap-10 mb-10">
          <StatBadge value="0 km" label="Travel Required" color="#00f5ff" />
          <StatBadge value="∞" label="Venues at Once" color="#a855f7" />
          <StatBadge value="24/7" label="Show Availability" color="#ec4899" />
          <StatBadge value="4K" label="Projection Quality" color="#f59e0b" />
        </div>
        <div className="text-center">
          <button
            onClick={() => navigate(engineUrl)}
            className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl font-black text-lg text-black transition-all hover:scale-105"
            style={{ background: "linear-gradient(135deg, #00f5ff, #ec4899)", boxShadow: "0 0 50px rgba(236,72,153,0.2)" }}
          >
            <Zap className="w-6 h-6" /> Launch My Virtual Concert
          </button>
          <p className="mt-3 text-zinc-600 text-xs">Opens the Hologram Show Engine with your artist project pre-loaded</p>
        </div>
      </div>
    </section>
  );
}

// ─── Scene Phase Card ─────────────────────────────────────────────────────────

function PhaseCard({
  scene,
  image,
  index,
  onOpenLightbox,
}: {
  scene: typeof SCENES[0];
  image: HoloImage | undefined;
  index: number;
  onOpenLightbox: (i: number) => void;
}) {
  const { ref, visible } = useReveal();
  const flip = !!scene.flip;

  return (
    <div
      ref={ref}
      id={`scene-${index + 1}`}
      className={`relative grid gap-10 xl:grid-cols-2 items-center transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-12"}`}
    >
      {/* Text side */}
      <div className={flip ? "xl:order-2" : ""}>
        <div className="flex items-start gap-4 mb-5">
          <span
            className="text-[72px] font-black leading-none select-none flex-shrink-0 mt-1"
            style={{ color: `${scene.accent}12`, WebkitTextStroke: `1.5px ${scene.accent}28`, fontVariantNumeric: "tabular-nums" } as React.CSSProperties}
          >
            {scene.number}
          </span>
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-widest mb-2"
              style={{ background: `${scene.accent}14`, color: scene.accent, border: `1px solid ${scene.accent}32` }}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: scene.accent }} />
              {scene.tag}
            </div>
            <h2 className="text-2xl xl:text-3xl font-black text-white leading-tight tracking-tight">{scene.title}</h2>
            <p className="text-sm font-bold uppercase tracking-wider mt-1" style={{ color: scene.accent }}>{scene.subtitle}</p>
          </div>
        </div>
        <p className="text-sm text-zinc-400 leading-relaxed max-w-lg">{scene.desc}</p>
        <div className="mt-5 h-px w-20" style={{ background: `linear-gradient(90deg, ${scene.accent}, transparent)` }} />
      </div>

      {/* Image side */}
      <div className={`relative ${flip ? "xl:order-1" : ""}`}>
        <div
          className="absolute -inset-2 rounded-3xl pointer-events-none"
          style={{ boxShadow: `0 0 60px ${scene.accent}10`, border: `1px solid ${scene.accent}16`, borderRadius: "1.25rem" }}
        />
        {image ? (
          <div
            className="relative rounded-2xl overflow-hidden group cursor-pointer"
            onClick={() => onOpenLightbox(index)}
          >
            <img
              src={image.url}
              alt={`${scene.title} — hologram scene ${index + 1}`}
              className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105 rounded-2xl"
              style={{ aspectRatio: "16/9", minHeight: 220 }}
            />
            {/* Scan lines overlay */}
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,245,255,0.013) 3px, rgba(0,245,255,0.013) 4px)" }}
            />
            <div className="absolute inset-0 rounded-2xl" style={{ background: `linear-gradient(180deg, transparent 55%, ${scene.accent}12 100%)` }} />

            {/* Top badge */}
            <div
              className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-black uppercase"
              style={{ background: `${scene.accent}16`, border: `1px solid ${scene.accent}40`, color: scene.accent, backdropFilter: "blur(8px)" }}
            >
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: scene.accent }} />
              SCENE {index + 1}
            </div>

            {/* Expand overlay */}
            <div
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 rounded-2xl"
              style={{ background: "rgba(0,0,0,0.28)", backdropFilter: "blur(3px)" }}
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(0,245,255,0.15)", border: "1px solid rgba(0,245,255,0.4)" }}
              >
                <Maximize2 className="w-6 h-6 text-cyan-400" />
              </div>
            </div>

            {/* Download */}
            <a
              href={image.url}
              download={`hologram-scene-${index + 1}.jpg`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-3 right-3 w-9 h-9 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: "rgba(0,0,0,0.7)", border: `1px solid ${scene.accent}35`, color: scene.accent, backdropFilter: "blur(8px)" }}
            >
              <Download className="w-4 h-4" />
            </a>
          </div>
        ) : (
          <div
            className="rounded-2xl flex items-center justify-center"
            style={{ aspectRatio: "16/9", background: `${scene.accent}06`, border: `1px dashed ${scene.accent}22` }}
          >
            <div className="text-center">
              <ImageIcon className="w-8 h-8 mx-auto mb-2" style={{ color: `${scene.accent}30` }} />
              <p className="text-xs" style={{ color: `${scene.accent}35` }}>Scene {index + 1}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tech Pill ────────────────────────────────────────────────────────────────

function TechPill({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider"
      style={{ background: `${color}10`, border: `1px solid ${color}28`, color }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ─── Stat Badge ───────────────────────────────────────────────────────────────

function StatBadge({ value, label, color, icon: Icon }: { value: string; label: string; color: string; icon?: any }) {
  return (
    <div className="text-center">
      {Icon && <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />}
      <div className="text-2xl xl:text-3xl font-black" style={{ color }}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 mt-0.5">{label}</div>
    </div>
  );
}

// ─── Scene thumbnail strip ────────────────────────────────────────────────────

function SceneStrip({ images, onOpen }: { images: HoloImage[]; onOpen: (i: number) => void }) {
  if (!images.length) return null;
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide">
      {images.map((img, i) => (
        <button
          key={img.id}
          title={`Scene ${i + 1}`}
          onClick={() => {
            onOpen(i);
            document.getElementById(`scene-${i + 1}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
          }}
          className="flex-shrink-0 relative rounded-lg overflow-hidden group transition-all hover:scale-105 focus:outline-none"
          style={{ width: 72, height: 44 }}
        >
          <img src={img.url} alt={`Scene ${i + 1}`} className="w-full h-full object-cover" />
          <div
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[9px] font-black text-white"
            style={{ background: "rgba(0,245,255,0.35)" }}
          >
            S{i + 1}
          </div>
        </button>
      ))}
    </div>
  );
}

// ─── Share Button ─────────────────────────────────────────────────────────────

function ShareButton() {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    toast({ title: "Link copied!" });
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02]"
      style={{
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        color: copied ? "#00f5ff" : "#9ca3af",
      }}
    >
      {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
      <span className="hidden sm:inline">{copied ? "Copied!" : "Share"}</span>
    </button>
  );
}

// ─── Gallery Grid Item ────────────────────────────────────────────────────────

function GalleryGridItem({
  img,
  index,
  accent,
  onOpen,
}: {
  img: HoloImage;
  index: number;
  accent: string;
  onOpen: () => void;
}) {
  const { ref, visible } = useReveal();
  return (
    <div
      ref={ref}
      className={`relative rounded-xl overflow-hidden group cursor-pointer transition-all duration-500 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}
      style={{ transitionDelay: `${index * 50}ms` }}
      onClick={onOpen}
    >
      <img
        src={img.url}
        alt={`Hologram ${index + 1}`}
        className="w-full h-full object-cover aspect-video transition-transform duration-700 group-hover:scale-105"
      />
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.7) 100%)" }}
      />
      <div
        className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[9px] font-black opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `${accent}16`, color: accent, border: `1px solid ${accent}32`, backdropFilter: "blur(6px)" }}
      >
        SCENE {index + 1}
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)" }}
        >
          <Maximize2 className="w-4 h-4 text-white" />
        </div>
      </div>
      <a
        href={img.url}
        download={`hologram-${index + 1}.jpg`}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      >
        <Download className="w-3 h-3 text-white/60" />
      </a>
    </div>
  );
}

// ─── Generating Screen ────────────────────────────────────────────────────────

function GeneratingScreen({ artistName, progress }: { artistName: string; progress: number }) {
  const steps = ["Identity Transfer", "Stage Projection", "Arena Scale", "Portrait Mapping", "Multi-Frame", "Live Performance"];
  return (
    <div className="min-h-screen bg-[#030308] flex items-center justify-center overflow-hidden">
      <HoloGrid />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[600px] h-[600px] rounded-full border border-cyan-500/10 animate-spin" style={{ animationDuration: "12s" }} />
        <div className="absolute w-[400px] h-[400px] rounded-full border border-purple-500/[0.08]" style={{ animation: "spin 8s linear infinite reverse" }} />
      </div>
      <div className="relative z-10 text-center px-6 max-w-xl w-full">
        <div className="relative w-28 h-28 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-spin" style={{ animationDuration: "3s" }} />
          <div className="absolute inset-3 rounded-full border border-purple-500/30 animate-spin" style={{ animationDuration: "2s", animationDirection: "reverse" }} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Sparkles className="w-10 h-10 text-cyan-400 animate-pulse" />
          </div>
        </div>
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-5 text-[11px] font-black uppercase tracking-[0.3em]"
          style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", color: "#00f5ff" }}
        >
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          BOOSTIFY AI · GENERATING
        </div>
        <h2 className="text-3xl xl:text-4xl font-black text-white mb-2 tracking-tight">BUILDING HOLOGRAM GALLERY</h2>
        <p className="text-zinc-400 mb-2 text-sm">Generating 6 cinematic scenes for</p>
        <p className="text-2xl font-black mb-8" style={{ color: "#00f5ff" }}>{artistName}</p>
        <div className="w-full h-1.5 rounded-full mb-2" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all duration-1000"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg, #00f5ff, #a855f7)" }}
          />
        </div>
        <p className="text-zinc-600 text-xs mb-8">{progress}% · Boostify AI image processing…</p>
        <div className="flex flex-wrap justify-center gap-2">
          {steps.map((step, i) => (
            <div
              key={step}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all duration-500"
              style={{
                background: progress > (i + 1) * 14 ? "rgba(0,245,255,0.1)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${progress > (i + 1) * 14 ? "rgba(0,245,255,0.3)" : "rgba(255,255,255,0.06)"}`,
                color: progress > (i + 1) * 14 ? "#00f5ff" : "#4b5563",
              }}
            >
              {progress > (i + 1) * 14 ? "✓" : "○"} {step}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function HologramShowcasePage() {
  const { artistId } = useParams<{ artistId: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { isSignedIn, isLoaded: authLoaded, ensureSignedIn } = useRequireAuth();

  const [gallery, setGallery] = useState<HoloGallery | null>(null);
  const [artistInfo, setArtistInfo] = useState<ArtistInfo>({ name: "", genre: "", biography: "", profileImage: null });
  const [avatar, setAvatar] = useState<HoloAvatar | null>(null);
  const [character3d, setCharacter3d] = useState<HoloCharacter3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // Animated scan line
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

  // Load gallery + stats
  useEffect(() => {
    if (!artistId) return;
    loadGallery();
  }, [artistId]);

  const loadGallery = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: any = await apiRequest({ url: `/api/hologram-gallery/${artistId}/gallery`, method: "GET" });
      if (data?.artistInfo) setArtistInfo(data.artistInfo);
      if (data?.gallery) {
        setGallery(data.gallery);
        if (data.gallery.artistName) {
          setArtistInfo((prev) => ({ ...prev, name: data.gallery.artistName }));
        }
      }
    } catch (err: any) {
      console.warn("[HoloShowcase] Load error:", err.message);
    } finally {
      setLoading(false);
    }
    // Load holographic avatar (non-blocking)
    try {
      const av: any = await apiRequest({ url: `/api/hologram-gallery/${artistId}/avatar`, method: "GET" });
      if (av?.avatar) setAvatar(av.avatar);
    } catch { /* avatar optional */ }
    // Load 3D character (non-blocking)
    try {
      const ch: any = await apiRequest({ url: `/api/hologram-gallery/${artistId}/character-3d`, method: "GET" });
      if (ch?.character?.glbUrl) setCharacter3d(ch.character);
    } catch { /* 3D character optional */ }
  };

  const generateGallery = async (force = false) => {
    if (!ensureSignedIn()) return;
    setGenerating(true);
    setGenerationProgress(5);
    setError(null);
    const timer = setInterval(() => {
      setGenerationProgress((p) => Math.min(p + 3, 88));
    }, 3500);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${artistId}/generate`,
        method: "POST",
        data: { forceRegenerate: force },
      });
      clearInterval(timer);
      setGenerationProgress(100);
      if (data?.gallery) {
        setGallery(data.gallery);
        if (data.gallery.artistName) {
          setArtistInfo((prev) => ({ ...prev, name: data.gallery.artistName }));
        }
        toast({ title: "✅ Hologram gallery ready!", description: `${data.gallery.generatedImages?.length ?? 0} scenes generated.` });
      } else {
        setError(data?.error || "Generation failed");
      }
    } catch (err: any) {
      clearInterval(timer);
      setError(err?.message || "Generation failed");
    } finally {
      setGenerating(false);
      setGenerationProgress(0);
    }
  };

  const images = gallery?.generatedImages ?? [];
  const displayName = artistInfo.name || gallery?.artistName || artistId || "Artist";
  const createdDate = gallery?.createdAt
    ? new Date(gallery.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  // Lightbox helpers
  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);
  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const nextImage = useCallback(() => setLightboxIndex((i) => (i === null ? 0 : (i + 1) % images.length)), [images.length]);
  const prevImage = useCallback(() => setLightboxIndex((i) => (i === null ? 0 : (i - 1 + images.length) % images.length)), [images.length]);

  // ── Generating screen ────────────────────────────────────────────────────
  if (generating) return <GeneratingScreen artistName={displayName} progress={generationProgress} />;

  // ── Empty state — no gallery yet ─────────────────────────────────────────
  if (!loading && !gallery) {
    return (
      <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden">
        <style>{GLOBAL_CSS}</style>
        <Header />
        <HoloGrid />

        <div className="relative z-10 min-h-[calc(100vh-4rem)] flex items-center justify-center px-6">
          {/* Orbit rings */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-[500px] h-[500px] rounded-full border border-cyan-500/10 animate-spin" style={{ animationDuration: "14s" }} />
            <div className="absolute w-[360px] h-[360px] rounded-full border border-purple-500/[0.07] animate-spin" style={{ animationDuration: "9s", animationDirection: "reverse" }} />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-2xl w-full"
          >
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-[11px] font-black uppercase tracking-[0.35em]"
              style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", color: "#00f5ff" }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              BOOSTIFY HOLOGRAM EXPERIENCE
            </div>
            <h1
              className="text-[14vw] xl:text-[120px] font-black leading-none tracking-tighter mb-4 uppercase"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #00f5ff 40%, #a855f7 70%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              HOLO
            </h1>
            <h2 className="text-xl xl:text-2xl font-black text-zinc-200 tracking-wide mb-3">AI HOLOGRAM SHOW GENERATOR</h2>
            <p className="text-zinc-500 mb-8 text-sm leading-relaxed max-w-md mx-auto">
              Generate 6 cinematic hologram show images using your artist profile photo.
              Boostify AI preserves your identity while applying professional holographic effects.
            </p>
            {error && (
              <div className="mb-6 px-4 py-3 rounded-xl text-sm text-red-300 text-left max-w-md mx-auto"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                {error}
              </div>
            )}
            {authLoaded && !isSignedIn ? (
              <>
                <button
                  onClick={() => navigate(`/login?redirect=${encodeURIComponent(`/hologram-showcase/${artistId}`)}`)}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-lg text-black transition-all hover:scale-105 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 50px rgba(0,245,255,0.2)" }}
                >
                  <Sparkles className="w-6 h-6" />
                  Sign in to Generate
                </button>
                <p className="mt-3 text-zinc-600 text-xs">Log in to your Boostify account · 6 AI scenes · Saved to your profile</p>
              </>
            ) : (
              <>
                <button
                  onClick={() => generateGallery(false)}
                  className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-lg text-black transition-all hover:scale-105 active:scale-[0.98]"
                  style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 50px rgba(0,245,255,0.2)" }}
                >
                  <Sparkles className="w-6 h-6" />
                  Generate My Hologram Gallery
                </button>
                <p className="mt-3 text-zinc-600 text-xs">~2 minutes · 6 AI scenes · Saved to your profile</p>
              </>
            )}
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <TechPill label="Boostify AI Engine" color="#00f5ff" />
              <TechPill label="Identity Preservation" color="#a855f7" />
              <TechPill label="Holographic Effects" color="#ec4899" />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  // ── Full Showcase ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#030308] text-white overflow-x-hidden">
      <style>{GLOBAL_CSS}</style>
      <Header />

      {/* ─── Fixed navigation bar ─── */}
      <div
        className="fixed top-16 left-0 right-0 z-40 flex items-center justify-between px-5 py-2.5"
        style={{ background: "rgba(3,3,8,0.88)", backdropFilter: "blur(18px)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}
      >
        <button
          onClick={() => navigate(-1 as any)}
          className="flex items-center gap-2 text-sm font-semibold text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Back</span>
        </button>

        {/* Scene thumbnail strip */}
        <div className="hidden md:flex flex-1 justify-center px-8 max-w-lg">
          <SceneStrip images={images} onOpen={openLightbox} />
        </div>

        <div className="flex items-center gap-2">
          <ShareButton />
          <button
            onClick={() => generateGallery(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Regen</span>
          </button>
        </div>
      </div>

      {/* ─── HERO ─── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden pt-32">
        {/* Hero BG */}
        {images[0] && (
          <div className="absolute inset-0">
            <img src={images[0].url} alt="" className="absolute inset-0 w-full h-full object-cover opacity-[0.14]" />
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(3,3,8,0.6) 0%, rgba(3,3,8,0.15) 40%, rgba(3,3,8,0.98) 100%)" }} />
          </div>
        )}
        <HoloGrid />

        {/* Animated scan line */}
        <div
          className="absolute left-0 right-0 h-36 pointer-events-none"
          style={{ top: `${scanY}%`, background: "linear-gradient(180deg, transparent, rgba(0,245,255,0.03), transparent)" }}
        />

        {/* Orbit rings */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[700px] h-[700px] rounded-full border border-cyan-500/[0.07]" style={{ animation: "holo-ring 14s linear infinite" }} />
          <div className="absolute w-[500px] h-[500px] rounded-full border border-purple-500/[0.07]" style={{ animation: "holo-ring 9s linear infinite reverse" }} />
        </div>

        <div className="relative z-10 text-center px-6 max-w-4xl w-full">
          {/* Artist profile image */}
          {artistInfo.profileImage && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="flex justify-center mb-8"
            >
              <div className="relative">
                <div
                  className="w-24 h-24 rounded-full overflow-hidden"
                  style={{ border: "2px solid rgba(0,245,255,0.4)", boxShadow: "0 0 40px rgba(0,245,255,0.18)" }}
                >
                  <img src={artistInfo.profileImage} alt={displayName} className="w-full h-full object-cover" />
                </div>
                <div
                  className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)" }}
                >
                  <Sparkles className="w-3.5 h-3.5 text-black" />
                </div>
              </div>
            </motion.div>
          )}

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <div
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-6 text-[11px] font-black uppercase tracking-[0.35em]"
              style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", color: "#00f5ff" }}
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              BOOSTIFY HOLOGRAM EXPERIENCE · AI
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }} className="relative mb-4">
            <h1
              className="text-[9vw] xl:text-[108px] font-black leading-none tracking-tighter glitch-title uppercase"
              style={{
                background: "linear-gradient(135deg, #ffffff 0%, #00f5ff 40%, #a855f7 70%, #ffffff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              {displayName.toUpperCase()}
            </h1>
            {/* Ghost */}
            <h1
              className="absolute inset-0 text-[9vw] xl:text-[108px] font-black leading-none tracking-tighter uppercase select-none pointer-events-none"
              style={{ color: "transparent", WebkitTextStroke: "1px rgba(0,245,255,0.12)", transform: "translate(3px, 2px)" }}
              aria-hidden
            >
              {displayName.toUpperCase()}
            </h1>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}>
            <p className="text-lg xl:text-xl font-bold text-zinc-300 tracking-wide mb-2">HOLOGRAM LIVE EXPERIENCE</p>
            {artistInfo.genre && (
              <p className="text-sm font-bold uppercase tracking-[0.3em] mb-2" style={{ color: "#00f5ff" }}>
                {artistInfo.genre}
              </p>
            )}
            {artistInfo.biography && (
              <p className="text-sm text-zinc-500 max-w-xl mx-auto mb-4 leading-relaxed">{artistInfo.biography}</p>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap justify-center gap-10 mb-10">
            <StatBadge value={String(images.length)} label="AI Scenes" color="#00f5ff" icon={Camera} />
            <StatBadge value="AI" label="Boostify" color="#a855f7" icon={Sparkles} />
            <StatBadge value="4K" label="Quality" color="#f59e0b" icon={Star} />
            {createdDate && <StatBadge value={createdDate} label="Generated" color="#10b981" icon={Clock} />}
          </motion.div>

          <div className="flex flex-col items-center gap-2 text-zinc-600 animate-bounce">
            <span className="text-[10px] uppercase tracking-widest">Scroll to explore</span>
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>
      </section>

      {/* ─── PROCESS BANNER ─── */}
      <section className="relative border-y border-white/[0.04] py-7" style={{ background: "#050510" }}>
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-center gap-6">
          {[
            { label: "Artist Photo", icon: "📸" },
            { label: "→" },
            { label: "Boostify AI Engine", icon: "⚡" },
            { label: "→" },
            { label: "Identity Preserved", icon: "🎭" },
            { label: "→" },
            { label: "Holographic FX", icon: "✨" },
            { label: "→" },
            { label: "Profile Gallery", icon: "🗄️" },
          ].map((item, i) =>
            item.label === "→" ? (
              <span key={i} className="text-zinc-700 text-lg hidden xl:block">→</span>
            ) : (
              <div key={i} className="flex items-center gap-2 text-sm font-bold text-zinc-400">
                <span>{item.icon}</span>{item.label}
              </div>
            ),
          )}
        </div>
      </section>

      {/* ─── SCENES ─── */}
      <section className="mx-auto max-w-7xl px-6 py-24 space-y-32">
        {SCENES.map((scene, i) => (
          <PhaseCard key={scene.number} scene={scene} image={images[i]} index={i} onOpenLightbox={openLightbox} />
        ))}
      </section>

      {/* ─── HOLOGRAPHIC AI AVATAR ─── */}
      {artistId && (
        <AvatarSection
          artistId={artistId}
          artistName={displayName}
          avatar={avatar}
          onAvatarGenerated={setAvatar}
          character3d={character3d}
          onCharacter3dGenerated={setCharacter3d}
          sceneImages={images.map((i) => i.url).filter(Boolean)}
        />
      )}

      {/* ─── VIRTUAL CONCERT — SELL THE PROJECT ─── */}
      {artistId && (
        <VirtualConcertSection
          artistId={artistId}
          artistName={displayName}
          genre={artistInfo.genre || "music"}
          heroImage={images[3]?.url || images[0]?.url}
        />
      )}

      {/* ─── CUSTOM SCENE GENERATOR ─── */}
      <section className="relative py-20 border-t border-white/[0.04]">
        <HoloGrid opacity={0.04} />
        <div className="relative mx-auto max-w-3xl px-6">
          <div className="text-center mb-10">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-3">Powered by Boostify AI</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white mb-2">GENERATE A CUSTOM SCENE</h2>
            <p className="text-zinc-500 text-sm max-w-md mx-auto">
              Describe any hologram concept — your identity is preserved via image-to-image conditioning
            </p>
          </div>
          {artistId && <CustomSceneGenerator artistId={artistId} />}
        </div>
      </section>

      {/* ─── FULL GALLERY GRID ─── */}
      <section className="relative py-24 overflow-hidden" style={{ background: "linear-gradient(180deg, #030308, #050514, #030308)" }}>
        <HoloGrid opacity={0.05} />
        <div className="relative mx-auto max-w-7xl px-6">
          <div className="text-center mb-12">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-3">Complete Collection</div>
            <h2 className="text-3xl xl:text-4xl font-black text-white">HOLOGRAM GALLERY</h2>
            <p className="text-zinc-500 mt-2 text-sm">
              {images.length} AI-generated scenes · Saved to {displayName}&apos;s artist profile
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {images.map((img, i) => (
              <GalleryGridItem
                key={img.id}
                img={img}
                index={i}
                accent={SCENES[i]?.accent ?? "#00f5ff"}
                onOpen={() => openLightbox(i)}
              />
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <TechPill label="Boostify AI Engine" color="#00f5ff" />
            <TechPill label="Identity Preservation" color="#a855f7" />
            <TechPill label="6 Unique Scenes" color="#10b981" />
            <TechPill label="Cloud Storage" color="#f59e0b" />
          </div>
        </div>
      </section>

      {/* ─── TECH STACK ─── */}
      <section className="py-16 border-t border-white/[0.04]">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-10">
            <div className="text-[10px] font-black uppercase tracking-[0.4em] text-purple-400 mb-2">Technology</div>
            <h2 className="text-2xl xl:text-3xl font-black text-white">PRODUCTION STACK</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {[
              { name: "Boostify AI", role: "Hologram Engine", color: "#00f5ff", icon: "⚡" },
              { name: "Neural ID", role: "Identity Transfer", color: "#a855f7", icon: "🎭" },
              { name: "Image Synthesis", role: "Scene Generation", color: "#f59e0b", icon: "🔬" },
              { name: "Cloud Gallery", role: "Gallery Storage", color: "#10b981", icon: "🗄️" },
              { name: "Boostify", role: "Artist Platform", color: "#ec4899", icon: "🚀" },
            ].map(({ name, role, color, icon }, i) => (
              <div
                key={i}
                className="p-4 rounded-2xl text-center transition-all hover:scale-[1.03] cursor-default"
                style={{ background: `${color}07`, border: `1px solid ${color}18` }}
              >
                <div className="text-3xl mb-2">{icon}</div>
                <p className="font-black text-white text-sm">{name}</p>
                <p className="text-zinc-500 text-xs mt-0.5">{role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER CTA ─── */}
      <section className="relative py-20 overflow-hidden border-t border-white/[0.04]">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 80% 50% at 50% 50%, rgba(0,245,255,0.04) 0%, transparent 70%)" }} />
        <div className="relative mx-auto max-w-2xl px-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.4em] text-cyan-400 mb-3">Next Steps</div>
          <h2 className="text-2xl xl:text-3xl font-black text-white mb-3">BRING YOUR HOLOGRAM TO LIFE</h2>
          <p className="text-zinc-500 mb-8 text-sm leading-relaxed">
            These AI images are the visual concept. The next step is a full hologram production — motion capture, virtual stage build, and live Pepper&apos;s Ghost projection setup.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => navigate(`/hologram-show-engine?artist=${encodeURIComponent(artistId || "")}&name=${encodeURIComponent(displayName)}`)}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-base text-black transition-all hover:scale-105"
              style={{ background: "linear-gradient(135deg, #00f5ff, #a855f7)", boxShadow: "0 0 40px rgba(0,245,255,0.14)" }}
            >
              <Zap className="w-5 h-5" /> Start Your Project
            </button>
            <button
              onClick={() => generateGallery(true)}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-base transition-all hover:scale-105"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#9ca3af" }}
            >
              <RefreshCw className="w-5 h-5" /> Regenerate All
            </button>
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-zinc-600 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            Gallery saved to your profile · Powered by Boostify AI
          </div>
        </div>
      </section>

      {/* ─── LIGHTBOX ─── */}
      <AnimatePresence>
        {lightboxIndex !== null && (
          <Lightbox
            images={images}
            index={lightboxIndex}
            onClose={closeLightbox}
            onNext={nextImage}
            onPrev={prevImage}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
