import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Header } from "../components/layout/header";
import {
  Zap, Monitor, Cpu, Globe, Music, Star, ChevronDown, ChevronUp,
  Check, ArrowRight, Play, X, Users, Building2, Radio, Crown,
  Sparkles, Eye, Layers, Mic2, Video, Award, Film, Phone,
  Mail, MessageSquare, Clock, DollarSign, BarChart3, Shield,
  Loader2, Send, AlertCircle, CheckCircle2,
  Download, FileText, Maximize2, Gamepad2, Activity, Box
} from "lucide-react";
import { HoloStageDashboard } from "../modules/holostage/HoloStageDashboard";
import HologauzeConcertSection from "../modules/holostage/HologauzeConcertSection";
import type { CharacterAsset } from "../schemas/holostage/character.schema";

// ─── Inline 3D model preview (model-viewer loaded on demand) ──────────────────

function ArtistModelPreview({ src }: { src: string }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if ((window as any).customElements?.get('model-viewer')) { setReady(true); return; }
    if (document.querySelector('script[data-model-viewer]')) {
      const check = setInterval(() => {
        if ((window as any).customElements?.get('model-viewer')) { setReady(true); clearInterval(check); }
      }, 200);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js';
    script.setAttribute('data-model-viewer', 'true');
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  if (!ready) {
    return (
      <div className="w-full h-full flex items-center justify-center" style={{ background: '#000' }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#00d4ff' }} />
      </div>
    );
  }
  return (
    // @ts-ignore — model-viewer web component
    <model-viewer
      src={src}
      alt="Artist 3D hologram character"
      loading="eager"
      draco-decoder-location="https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
      auto-rotate
      camera-controls
      autoplay
      exposure="1.1"
      shadow-intensity="1"
      style={{ width: '100%', height: '100%', background: '#000' } as React.CSSProperties}
    />
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface HologramAssets {
  assets: Record<string, { type: string; url: string }>;
}

interface LeadFormData {
  name: string;
  email: string;
  phone: string;
  companyOrArtist: string;
  clientType: string;
  experienceType: string;
  numberOfSongs: number;
  hasAvatar: boolean;
  needsAvatarCreation: boolean;
  budgetRange: string;
  timeline: string;
  message: string;
}

const FALLBACK_HOLOGRAM_ASSETS: HologramAssets['assets'] = {
  hero_hologram_stage: {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c84/kjTSjLBB-rJBtndnQ72kK_45c2ecaf5af54eac833fd7e9a3568cd2.jpg',
  },
  unreal_engine_virtual_stage: {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c87/Q-bFvBDs21j-iU-x0uQXW_288ab94a31894399953232c1de2ca5de.jpg',
  },
  '3d_avatar_creation': {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c89/7ARS_kNWqPNgs7psV_F46_862a9f986e274ae3a17cae6643b75528.jpg',
  },
  festival_hologram_crowd: {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c8c/sFiSHAZKLKdE5T5H5FJX4_cb1596a170ff4005afe20b4931ffb454.jpg',
  },
  virtual_stage_design: {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c90/ynpxQCRAU4c_gCiFtDzF2_fcbff9092c8249ddbbc70b409e07534e.jpg',
  },
  catalog_revival_performance: {
    type: 'image',
    url: 'https://v3b.fal.media/files/b/0a990c94/oEaag7wIlt6JDmW65r4RL_718145652fb949e192e8080bdd2f31da.jpg',
  },
  hologram_artist_performance: {
    type: 'video',
    url: 'https://v3b.fal.media/files/b/0a990cbb/ZBrL1XKJ5Ge_a7g0j4L50_output.mp4',
  },
  virtual_stage_transformation: {
    type: 'video',
    url: 'https://v3b.fal.media/files/b/0a990cc4/9c-NHGuyZE8FBTyD8wOTe_output.mp4',
  },
  avatar_in_motion: {
    type: 'video',
    url: 'https://v3b.fal.media/files/b/0a990ccc/9eHqv0ZaBofs_phKX_A1l_output.mp4',
  },
};

// ─── Holographic animated background ─────────────────────────────────────────

function HoloGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Perspective grid floor */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[60%]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,212,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,212,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          transform: 'perspective(600px) rotateX(60deg)',
          transformOrigin: 'bottom center',
        }}
      />
      {/* Ambient glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FF7A00 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 right-1/4 w-80 h-80 rounded-full opacity-8 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00D4FF 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 left-1/2 w-72 h-72 rounded-full opacity-6 blur-3xl"
        style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
    </div>
  );
}

// ─── Floating particle component ──────────────────────────────────────────────

function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            background: i % 3 === 0 ? '#FF7A00' : i % 3 === 1 ? '#00D4FF' : '#8B5CF6',
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.7, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 3 + Math.random() * 4,
            repeat: Infinity,
            delay: Math.random() * 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Glassy card ──────────────────────────────────────────────────────────────

function GlassCard({ children, className = "", glowColor = "rgba(255,122,0,0.15)" }: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 backdrop-blur-sm ${className}`}
      style={{
        background: 'rgba(5,5,5,0.7)',
        boxShadow: `0 0 40px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

function SectionHeading({ eyebrow, title, subtitle }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="text-center mb-10 sm:mb-16 px-2">
      <span className="inline-block text-[10px] sm:text-xs font-semibold tracking-[0.22em] uppercase mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border"
        style={{ color: '#FF7A00', borderColor: 'rgba(255,122,0,0.3)', background: 'rgba(255,122,0,0.08)' }}>
        {eyebrow}
      </span>
      <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 sm:mb-6 leading-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
        {title}
      </h2>
      {subtitle && (
        <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">{subtitle}</p>
      )}
    </div>
  );
}

// ─── Hologram demo video card ─────────────────────────────────────────────────

function DemoVideoCard({ url, posterUrl, label }: { url?: string; posterUrl?: string; label: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <GlassCard className="overflow-hidden group" glowColor="rgba(0,212,255,0.12)">
      <div className="relative aspect-video bg-black">
        {url ? (
          <>
            <video
              ref={videoRef}
              src={url}
              poster={posterUrl}
              muted
              loop
              playsInline
              className="w-full h-full object-cover"
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />
            {!isPlaying && (
              <button
                onClick={handlePlay}
                className="absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity group-hover:bg-black/20"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center border-2 border-white/60 bg-black/50 transition-transform group-hover:scale-110">
                  <Play className="w-6 h-6 text-white ml-1" fill="white" />
                </div>
              </button>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(139,92,246,0.1) 50%, rgba(255,122,0,0.1) 100%)' }}>
            <div className="text-center">
              <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center mx-auto mb-3"
                style={{ background: 'rgba(0,212,255,0.1)' }}>
                <Film className="w-7 h-7 text-white/40" />
              </div>
              <p className="text-white/30 text-sm">Demo video</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="text-white/70 text-sm font-medium">{label}</p>
      </div>
    </GlassCard>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────

const FEATURES = [
  { icon: Cpu, title: "Photorealistic 3D Avatar", desc: "Your artist's face, expressions, and movements — reconstructed in hyper-realistic 3D from photos and video references.", color: "#00D4FF" },
  { icon: Monitor, title: "Boostify XR Render Stage", desc: "Cinematic-grade virtual environments built inside Boostify's proprietary XR engine — custom lighting, particles, architecture, and atmosphere.", color: "#8B5CF6" },
  { icon: Layers, title: "Multi-Format Virtual Stage", desc: "Deploy shows to holographic screens, LED walls, extended reality venues, and digital-first streaming arenas.", color: "#FF7A00" },
  { icon: Zap, title: "Hologram-Ready Output", desc: "Exports optimized for holographic projection systems (Peppers Ghost, Holobox, transparent OLED) and XR tech.", color: "#00D4FF" },
  { icon: Music, title: "Music-Synced Visuals", desc: "AI analyzes your catalog and auto-syncs visual effects, stage transitions, and avatar choreography to every beat.", color: "#8B5CF6" },
  { icon: BarChart3, title: "AI Performance Planning", desc: "Our AI plans the full setlist, transitions, crowd moments, and pacing — optimized for digital audience engagement.", color: "#FF7A00" },
  { icon: Video, title: "Live Show Control System", desc: "Real-time director controls for lighting, camera angles, effects, and avatar interactions during live performances.", color: "#00D4FF" },
  { icon: Film, title: "Catalog Revival Engine", desc: "Bring back timeless music with remastered visuals. Honor legends or revisit your own classic era in stunning fidelity.", color: "#8B5CF6" },
];

// ─── How it works steps ───────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  { step: "01", title: "Upload Your References", desc: "Provide photos, videos, and audio recordings. Our team collects everything needed to build your digital identity.", icon: Upload },
  { step: "02", title: "3D Avatar Construction", desc: "Our artists and AI build a photorealistic 3D avatar — face, body, expressions, and movement library.", icon: Cpu },
  { step: "03", title: "Virtual Stage Design", desc: "You choose from our templates or commission a custom stage — every light, pixel, and particle is crafted for you.", icon: Monitor },
  { step: "04", title: "Performance Programming", desc: "AI syncs visuals to your catalog. Directors program choreography, effects, and crowd-reactive moments.", icon: Music },
  { step: "05", title: "Technical Integration", desc: "We export the show in the format your venue or platform requires — Hologram, LED wall, XR, or streaming.", icon: Zap },
  { step: "06", title: "Go Live Worldwide", desc: "Perform simultaneously across multiple venues, time zones, and platforms — one show, unlimited reach.", icon: Globe },
];

function Upload(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  );
}

// ─── Packages ─────────────────────────────────────────────────────────────────

const PACKAGES = [
  {
    name: "Digital Premiere",
    price: "$12,500",
    period: "one-time",
    description: "Perfect for independent artists making their first move into virtual performance.",
    features: [
      "Basic 3D avatar (photo-based)",
      "1 pre-built virtual stage template",
      "Up to 5 songs in the setlist",
      "Music-synced visual effects",
      "720p/1080p export",
      "Streaming-ready format",
      "14-day production timeline",
      "Dedicated onboarding call",
    ],
    highlight: false,
    color: "#00D4FF",
    badge: null,
  },
  {
    name: "Hologram Pro",
    price: "$27,500",
    period: "one-time",
    description: "For artists ready to headline digital venues and build their virtual touring brand.",
    features: [
      "Photorealistic 3D avatar + expression library",
      "Custom virtual stage design",
      "Up to 12 songs + full setlist design",
      "AI performance choreography",
      "4K export + hologram-ready output",
      "LED wall & Holobox ready",
      "Live show control system",
      "30-day production timeline",
    ],
    highlight: true,
    color: "#FF7A00",
    badge: "Most Popular",
  },
  {
    name: "Arena Edition",
    price: "$55,000",
    period: "one-time",
    description: "Full-scale virtual arena productions for established artists and major events.",
    features: [
      "Ultra-photorealistic avatar (motion capture)",
      "Fully custom Boostify XR stage",
      "Unlimited songs + live director team",
      "Real-time performance adaptation",
      "8K output + multi-format hologram",
      "Multi-venue simultaneous deployment",
      "Dedicated production team",
      "45-day production timeline",
    ],
    highlight: false,
    color: "#8B5CF6",
    badge: null,
  },
  {
    name: "Legacy & Legends",
    price: "$150,000+",
    period: "custom",
    description: "For estates, brands, and cultural institutions bringing iconic artists back to the world.",
    features: [
      "Estate-approved archival reconstruction",
      "Full catalog integration",
      "Custom worldwide tour infrastructure",
      "Legal & rights clearance support",
      "Museum-quality fidelity",
      "Hybrid physical + digital deployments",
      "Dedicated legal and production team",
      "Timeline: fully customized",
    ],
    highlight: false,
    color: "#FF7A00",
    badge: "Exclusive",
  },
];

// ─── Target clients ───────────────────────────────────────────────────────────

const TARGET_CLIENTS = [
  { icon: Mic2, label: "Recording Artists", desc: "Expand your reach beyond physical venues" },
  { icon: Building2, label: "Entertainment Companies", desc: "Build proprietary virtual IP" },
  { icon: Crown, label: "Music Estates & Labels", desc: "Preserve and monetize legendary catalogs" },
  { icon: Globe, label: "Festival Organizers", desc: "Book world-class headliners without logistics" },
  { icon: Radio, label: "Streaming Platforms", desc: "Host exclusive digital-first concerts" },
  { icon: Film, label: "Film & TV Productions", desc: "Commission custom virtual performances" },
  { icon: Award, label: "Brand & Corporate Events", desc: "Elevate launches with live hologram entertainment" },
  { icon: Star, label: "NFT & Web3 Projects", desc: "Mint virtual show experiences as digital collectibles" },
  { icon: Users, label: "Talent Agencies", desc: "Offer clients unlimited venue reach" },
  { icon: Eye, label: "Theme Parks & Attractions", desc: "Permanent holographic performance installations" },
  { icon: Shield, label: "Government & Tourism", desc: "Cultural showcase events at scale" },
  { icon: Sparkles, label: "Educators & Museums", desc: "Historical and cultural performance experiences" },
];

// ─── Tech stack ───────────────────────────────────────────────────────────────

const TECH_STACK = [
  { name: "Boostify XR Engine", category: "Rendering", color: "#00D4FF" },
  { name: "FAL AI", category: "Image/Video AI", color: "#FF7A00" },
  { name: "Boostify Motion AI", category: "Motion AI", color: "#8B5CF6" },
  { name: "FLUX Pro Kontext", category: "Image Generation", color: "#00D4FF" },
  { name: "Motion Capture", category: "Avatar Animation", color: "#FF7A00" },
  { name: "WebGL / Three.js", category: "Web Rendering", color: "#8B5CF6" },
  { name: "Peppers Ghost", category: "Hologram Hardware", color: "#00D4FF" },
  { name: "Holobox / Axiom", category: "Hologram Display", color: "#FF7A00" },
  { name: "NDI Protocol", category: "Live Signal Routing", color: "#8B5CF6" },
  { name: "WebRTC", category: "Real-time Streaming", color: "#00D4FF" },
  { name: "Dolby Atmos", category: "Spatial Audio", color: "#FF7A00" },
  { name: "Boostify AI Core", category: "Orchestration Layer", color: "#8B5CF6" },
];

// ─── Artist Scale Presets ─────────────────────────────────────────────────────

const SCALE_PRESETS = [
  {
    name: "Real Size",
    multiplier: "1.0×",
    label: "True Human Scale",
    barWidth: "33%",
    color: "#00D4FF",
    desc: "The artist appears at their exact real height — every proportion correct. The audience believes their physical presence. Perfect for ballads, intimate fan moments, and mid-show connection.",
    scenes: ["Intro / opening ballad", "Mid-show intimate moment", "Audience interaction song"],
  },
  {
    name: "Hero Size",
    multiplier: "1.5×",
    label: "Stage-Commanding Presence",
    barWidth: "60%",
    color: "#8B5CF6",
    desc: "Larger than life but still believable — commands the full stage without breaking immersion. Perfect for power anthems and peak crowd energy moments.",
    scenes: ["Main chorus climax", "High-energy anthem", "Crowd peak engagement"],
  },
  {
    name: "Giant Finale",
    multiplier: "3.0×+",
    label: "Monumental / Arena-Filling",
    barWidth: "100%",
    color: "#FF7A00",
    desc: "Absolute visual domination. The artist fills the entire venue in a larger-than-human presence. Unforgettable for finales, encores, and climactic moments.",
    scenes: ["Grand opening reveal", "Epic finale song", "Show-closing encore"],
  },
];

// ─── Show Scene Progression ───────────────────────────────────────────────────

const SHOW_SCENES = [
  {
    number: "01",
    title: "Real Size Entrance",
    scale: "1.0×",
    desc: "The artist materializes at human scale — credible, present, powerful. The crowd freezes.",
    color: "#00D4FF",
    imageKey: "hero_hologram_stage",
  },
  {
    number: "02",
    title: "Hero Expansion",
    scale: "1.5×",
    desc: "The artist grows. Stage energy explodes. Every eye in the venue tracks the transformation.",
    color: "#8B5CF6",
    imageKey: "unreal_engine_virtual_stage",
  },
  {
    number: "03",
    title: "Intimate Return",
    scale: "1.0×",
    desc: "Back to human scale. The most personal song. Front-row fans feel they could reach out.",
    color: "#00D4FF",
    imageKey: "festival_hologram_crowd",
  },
  {
    number: "04",
    title: "Monumental Finale",
    scale: "3.0×+",
    desc: "Absolute domination. The artist is a titan. Every screen, every pixel, every emotion — maximum.",
    color: "#FF7A00",
    imageKey: "catalog_revival_performance",
  },
];

// ─── Hologram Display Technologies ───────────────────────────────────────────

const HOLO_TECHNOLOGIES = [
  {
    name: "LED Transparent",
    icon: "🔆",
    tagline: "Best for Concerts & Arenas",
    color: "#00D4FF",
    pros: [
      "Real size + giant scale both possible",
      "High brightness — works in ambient light",
      "Multi-venue simultaneous deployment",
      "Maximum visual impact at any scale",
    ],
    limitation: null,
    recommended: true,
  },
  {
    name: "Hologauze / Mesh",
    icon: "👻",
    tagline: "Best for Theatre & Drama",
    color: "#8B5CF6",
    pros: [
      "Elegant ghost / phantom effect",
      "Perfect for dramatic entrances and exits",
      "Very cinematic and theatrical",
    ],
    limitation: "Depends heavily on lighting control and mounting precision",
    recommended: false,
  },
  {
    name: "Pepper's Ghost",
    icon: "🪞",
    tagline: "Classic Illusion Effect",
    color: "#FF7A00",
    pros: [
      "Most realistic physical illusion",
      "Iconic technology (Tupac, ABBA, Whitney)",
      "Audience feels artist is truly present",
    ],
    limitation: "Requires complex mounting — less flexible for touring",
    recommended: false,
  },
  {
    name: "LED Wall",
    icon: "📺",
    tagline: "Maximum Reach & Impact",
    color: "#FFB347",
    pros: [
      "Works in any venue worldwide",
      "Strongest raw visual power",
      "Cost-effective at scale",
      "No special mounting required",
    ],
    limitation: "Less immersive hologram experience — screen is visible",
    recommended: false,
  },
];

// ─── Production Pipeline ──────────────────────────────────────────────────────

const PIPELINE_STEPS = [
  { step: "01", name: "Character Creator", detail: "Base mesh from reference photos and body scan data", color: "#00D4FF" },
  { step: "02", name: "Boostify Sculpt Engine", detail: "Facial sculpting, skin detail, custom expression shapes", color: "#8B5CF6" },
  { step: "03", name: "Rig + Textures + Animation", detail: "Full body rig, PBR materials, motion capture library", color: "#FF7A00" },
  { step: "04", name: "Boostify XR Stage", detail: "Virtual stage, cinematic lighting, physics, geometry detail", color: "#00D4FF" },
  { step: "05", name: "Multi-Scale Scene Setup", detail: "Scale presets per scene, cue automation, director controls", color: "#8B5CF6" },
  { step: "06", name: "Output to Hologram Company", detail: "SDI/NDI signal routing, technical file delivery, calibration", color: "#FF7A00" },
  { step: "07", name: "Physical Mount at Venue", detail: "LED Transparent / Hologauze / Pepper's Ghost installation", color: "#00D4FF" },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Is this a real hologram?",
    a: "We use multiple immersive display technologies — from Peppers Ghost projection (the classic hologram illusion used by Tupac, ABBA, and Whitney Houston) to modern transparent OLED Holobox displays, to full LED wall volumetric rendering. The right technology depends on your venue and budget. All options deliver a jaw-dropping visual presence.",
  },
  {
    q: "Can you bring back a deceased artist?",
    a: "Yes, subject to proper legal clearance from estates and rights holders. Our Legacy & Legends package includes full legal and rights support, and we work directly with estates to ensure the presentation is respectful, accurate, and approved. We do not proceed without explicit estate consent.",
  },
  {
    q: "How long does production take?",
    a: "Timeline depends on the package. Digital Premiere takes 14 days, Hologram Pro takes 30 days, Arena Edition takes 45 days, and Legacy & Legends is fully customized. We can accommodate rush production for a fee.",
  },
  {
    q: "Can one hologram show perform in multiple cities simultaneously?",
    a: "Yes — this is one of the most powerful features of the system. The same digital performance can be broadcast simultaneously to venues in Tokyo, New York, London, and São Paulo. This is how artists can multiply their earning potential without physically moving.",
  },
  {
    q: "What do I need to provide to get started?",
    a: "We need high-resolution photos (at least 50, multiple angles), video footage of the artist performing (optional but strongly recommended), audio stems or masters, and any creative direction you have. For avatar enhancement, we can arrange a motion capture session.",
  },
  {
    q: "Is this legal and ethically produced?",
    a: "All live artists maintain full creative control and ownership. For estate/legacy productions, we require documented consent from rights holders before any production begins. Our contracts are transparent about usage rights, revenue sharing, and intellectual property. We are committed to ethical, consent-first hologram production.",
  },
];

// ─── Technical Brief Document ─────────────────────────────────────────────────

function openTechnicalBrief() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Hologram Show Technical Brief — Boostify Music</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #080808; color: #e5e5e5; font-family: 'Segoe UI', system-ui, sans-serif; max-width: 860px; margin: 0 auto; padding: 48px 32px; }
    h1 { font-size: 2.2rem; font-weight: 900; color: #FF7A00; margin-bottom: 8px; }
    h2 { font-size: 1.25rem; font-weight: 800; color: #fff; margin: 40px 0 14px; border-left: 3px solid #FF7A00; padding-left: 14px; }
    h3 { font-size: 0.95rem; font-weight: 700; color: #00D4FF; margin: 18px 0 8px; }
    p { color: #999; line-height: 1.75; margin-bottom: 10px; font-size: 0.9rem; }
    .badge { display: inline-block; background: rgba(255,122,0,0.12); border: 1px solid rgba(255,122,0,0.35); color: #FF7A00; padding: 4px 14px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; margin-bottom: 28px; letter-spacing: 0.14em; text-transform: uppercase; }
    .section { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 14px; padding: 24px 28px; margin-bottom: 18px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 16px; }
    .card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; padding: 18px; }
    .card h4 { font-size: 0.9rem; font-weight: 700; color: #fff; margin-bottom: 6px; }
    .card p { font-size: 0.82rem; color: #777; margin: 0; }
    ul { padding-left: 18px; color: #999; font-size: 0.86rem; line-height: 1.85; }
    ul li { margin-bottom: 4px; }
    .code-block { background: #111; border: 1px solid rgba(255,255,255,0.09); border-radius: 8px; padding: 16px 20px; font-family: 'Consolas', monospace; font-size: 0.82rem; color: #00D4FF; white-space: pre; margin: 12px 0; overflow-x: auto; }
    .preset { display: flex; align-items: center; gap: 16px; padding: 14px 18px; background: rgba(255,255,255,0.03); border-radius: 10px; margin-bottom: 10px; border: 1px solid rgba(255,255,255,0.06); }
    .preset-num { font-size: 1.6rem; font-weight: 900; min-width: 64px; }
    .preset-bar-wrap { flex: 1; background: rgba(255,255,255,0.06); border-radius: 4px; height: 6px; overflow: hidden; max-width: 140px; }
    .preset-bar { height: 100%; border-radius: 4px; }
    .tech-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
    .tech-card { border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 18px; }
    .tech-card h4 { font-size: 0.9rem; font-weight: 800; color: #fff; margin-bottom: 6px; }
    .pro { color: #4ade80; font-size: 0.82rem; margin-bottom: 3px; }
    .con { color: #fb923c; font-size: 0.82rem; margin-top: 8px; }
    .pipe-step { display: flex; align-items: flex-start; gap: 14px; margin-bottom: 12px; }
    .pipe-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px; }
    .pipe-content h4 { font-size: 0.88rem; font-weight: 700; color: #fff; margin-bottom: 2px; }
    .pipe-content p { font-size: 0.8rem; color: #666; margin: 0; }
    .message-box { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.2); border-radius: 10px; padding: 20px 24px; margin: 14px 0; }
    .message-box p { color: #b8e8f5; font-style: italic; font-size: 0.9rem; line-height: 1.7; margin: 0; }
    .footer { margin-top: 56px; padding-top: 24px; border-top: 1px solid rgba(255,255,255,0.06); text-align: center; color: #333; font-size: 0.78rem; }
    .rec-badge { background: rgba(0,212,255,0.12); border: 1px solid rgba(0,212,255,0.3); color: #00D4FF; padding: 3px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; display: inline-block; margin-top: 10px; }
    @media print { body { background: #fff; color: #111; } .section { border-color: #ddd; background: #fafafa; } h1 { color: #c05000; } h2 { border-color: #c05000; } }
  </style>
</head>
<body>
  <div class="badge">Boostify Hologram Studio — Technical Brief</div>
  <h1>Artist Scale &amp; Hologram Technology Guide</h1>
  <p style="color:#555;font-size:0.82rem;margin-bottom:36px">Prepared by Boostify Music &nbsp;·&nbsp; boostifymusic.com &nbsp;·&nbsp; vr@boostifymusic.com</p>

  <h2>1. Can the Artist Appear at Real Size?</h2>
  <div class="section">
    <p>Yes — the artist can appear <strong style="color:#fff">at any size you define</strong>, including true human scale in specific moments of the show. Achieving this requires two aligned components working together:</p>
    <div class="grid-2">
      <div class="card">
        <h4>Digital Scale (Boostify XR Engine)</h4>
        <p>Configured inside Boostify's XR Stage system. 1 unit = 1 cm. A 180cm artist is built at exactly 180 units.</p>
      </div>
      <div class="card">
        <h4>Perceived Scale (Physical System)</h4>
        <p>What the audience actually sees depends on the display technology, screen size, and how it is mounted at the venue.</p>
      </div>
    </div>
  </div>

  <h2>2. Scale Preset System</h2>
  <div class="section">
    <p>We recommend building the show with three scale presets, allowing each song or scene to trigger a different visual scale of the artist.</p>
    <div style="margin-top:18px">
      <div class="preset">
        <span class="preset-num" style="color:#00D4FF">1.0×</span>
        <div style="flex:1">
          <div style="font-weight:700;color:#fff;font-size:0.88rem;margin-bottom:4px">Real Size</div>
          <p style="margin:0;font-size:0.8rem">True human height — intimate, credible, powerful. Ideal for ballads and audience interaction.</p>
        </div>
        <div class="preset-bar-wrap"><div class="preset-bar" style="width:33%;background:#00D4FF"></div></div>
      </div>
      <div class="preset">
        <span class="preset-num" style="color:#8B5CF6">1.5×</span>
        <div style="flex:1">
          <div style="font-weight:700;color:#fff;font-size:0.88rem;margin-bottom:4px">Hero Size</div>
          <p style="margin:0;font-size:0.8rem">Stage-commanding presence. Used for high-energy anthems and chorus peaks.</p>
        </div>
        <div class="preset-bar-wrap"><div class="preset-bar" style="width:58%;background:#8B5CF6"></div></div>
      </div>
      <div class="preset">
        <span class="preset-num" style="color:#FF7A00">3.0×+</span>
        <div style="flex:1">
          <div style="font-weight:700;color:#fff;font-size:0.88rem;margin-bottom:4px">Giant Finale</div>
          <p style="margin:0;font-size:0.8rem">Monumental. Full-arena domination for openers, finales, and climactic moments.</p>
        </div>
        <div class="preset-bar-wrap"><div class="preset-bar" style="width:100%;background:#FF7A00"></div></div>
      </div>
    </div>
  </div>

  <h2>3. Recommended Show Scene Structure</h2>
  <div class="section">
    <div class="code-block">Scene 01 → Real Size Entrance   (1.0×)  — Credible, present, human
Scene 02 → Hero Expansion       (1.5×)  — Stage domination, energy peak
Scene 03 → Intimate Return      (1.0×)  — Personal song, fan connection
Scene 04 → Monumental Finale    (3.0×+) — Epic close, unforgettable moment</div>
    <p>This structure creates a dynamic arc — the audience experiences the artist at different scales throughout the show, making each transition a visual and emotional event.</p>
  </div>

  <h2>4. Boostify XR Engine Configuration</h2>
  <div class="section">
    <h3>Key Rule</h3>
    <div class="code-block">1 Boostify Unit = 1 cm
Artist height 180 cm = 180 units in Boostify XR Stage</div>
    <h3>Scale Preset Implementation</h3>
    <div class="code-block">Preset 1: Real Size    → Actor Scale 1.0
Preset 2: Hero Size    → Actor Scale 1.5
Preset 3: Giant Finale → Actor Scale 3.0 or higher</div>
    <h3>Factors That Control Perceived Scale</h3>
    <div class="code-block">Artist scale in Unreal
+ Camera angle and field of view
+ Perspective and depth setup
+ Physical display surface size
+ Mounting position and distance
+ Ambient light in the venue
+ Audience distance from screen</div>
  </div>

  <h2>5. Display Technology Comparison</h2>
  <div class="section">
    <div class="tech-grid">
      <div class="tech-card" style="border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.04)">
        <div style="font-size:1.4rem;margin-bottom:8px">🔆</div>
        <h4 style="color:#00D4FF">LED Transparent</h4>
        <p style="font-size:0.78rem;color:#555;margin-bottom:10px">Best for concerts &amp; arenas</p>
        <div class="pro">✓ Real size + giant scale both possible</div>
        <div class="pro">✓ High brightness — works in ambient light</div>
        <div class="pro">✓ Multi-venue simultaneous deployment</div>
        <div class="pro">✓ Maximum visual impact</div>
        <div class="rec-badge">⭐ Recommended</div>
      </div>
      <div class="tech-card">
        <div style="font-size:1.4rem;margin-bottom:8px">👻</div>
        <h4>Hologauze / Mesh</h4>
        <p style="font-size:0.78rem;color:#555;margin-bottom:10px">Best for theatrical appearances</p>
        <div class="pro">✓ Elegant ghost / phantom effect</div>
        <div class="pro">✓ Perfect for dramatic entrances</div>
        <div class="pro">✓ Very cinematic and theatrical</div>
        <div class="con">⚠ Depends heavily on lighting &amp; mounting precision</div>
      </div>
      <div class="tech-card">
        <div style="font-size:1.4rem;margin-bottom:8px">🪞</div>
        <h4>Pepper's Ghost</h4>
        <p style="font-size:0.78rem;color:#555;margin-bottom:10px">Classic hologram illusion</p>
        <div class="pro">✓ Most realistic physical illusion</div>
        <div class="pro">✓ Iconic (Tupac, ABBA, Whitney)</div>
        <div class="pro">✓ Audience feels artist is truly present</div>
        <div class="con">⚠ Complex mounting — less flexible for touring</div>
      </div>
      <div class="tech-card">
        <div style="font-size:1.4rem;margin-bottom:8px">📺</div>
        <h4>LED Wall</h4>
        <p style="font-size:0.78rem;color:#555;margin-bottom:10px">Maximum reach &amp; impact</p>
        <div class="pro">✓ Works in any venue worldwide</div>
        <div class="pro">✓ Strongest raw visual power</div>
        <div class="pro">✓ No special mounting required</div>
        <div class="con">⚠ Less immersive — screen visible to audience</div>
      </div>
    </div>
  </div>

  <h2>6. Technical Message for Your Venue / Provider</h2>
  <div class="message-box">
    <p>"The virtual artist must be able to appear at true human scale in certain moments of the show, and at enlarged scale in others. We need a visualization system capable of representing a 3D character at real size in a credible way, as well as amplifying their visual presence during specific cues in the repertoire."</p>
  </div>

  <h2>7. Full Production Pipeline</h2>
  <div class="section">
    <div class="pipe-step"><div class="pipe-dot" style="background:#00D4FF"></div><div class="pipe-content"><h4>Character Creator</h4><p>Base mesh from reference photos and body scan data</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#8B5CF6"></div><div class="pipe-content"><h4>Boostify Sculpt Engine</h4><p>Facial sculpting, skin detail, custom expression shapes</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#FF7A00"></div><div class="pipe-content"><h4>Rig + Textures + Animation</h4><p>Full body rig, PBR materials, motion capture library</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#00D4FF"></div><div class="pipe-content"><h4>Boostify XR Stage</h4><p>Virtual stage, cinematic lighting, physics, geometry detail</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#8B5CF6"></div><div class="pipe-content"><h4>Multi-Scale Scene Setup</h4><p>Scale presets per scene, cue automation, director controls</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#FF7A00"></div><div class="pipe-content"><h4>Output to Hologram Company</h4><p>SDI/NDI signal routing, technical file delivery, calibration</p></div></div>
    <div class="pipe-step"><div class="pipe-dot" style="background:#00D4FF"></div><div class="pipe-content"><h4>Physical Mount at Venue</h4><p>LED Transparent / Hologauze / Pepper's Ghost installation</p></div></div>
    <div style="margin-top:18px;padding:16px 20px;background:rgba(255,122,0,0.08);border:1px solid rgba(255,122,0,0.25);border-radius:10px;text-align:center">
      <span style="font-weight:900;font-size:1.1rem;color:#FF7A00">🌐 GO LIVE WORLDWIDE</span>
      <p style="margin:4px 0 0;font-size:0.8rem;color:#666">195+ countries · Unlimited simultaneous venues · Any format</p>
    </div>
  </div>

  <h2>8. Pre-Event Checklist</h2>
  <div class="section">
    <div class="grid-2">
      <div>
        <h3>Artist Info</h3>
        <ul>
          <li>Exact artist height (e.g. 1.78 m)</li>
          <li>Reference photos (50+, all angles)</li>
          <li>Performance video footage</li>
          <li>Audio stems / masters</li>
        </ul>
      </div>
      <div>
        <h3>Show Design</h3>
        <ul>
          <li>Full setlist &amp; song order</li>
          <li>Real-scale moments (which songs)</li>
          <li>Giant-scale moments (which songs)</li>
          <li>Special effect cue list</li>
        </ul>
      </div>
      <div>
        <h3>Technology</h3>
        <ul>
          <li>Display type (LED / Hologauze / Pepper's)</li>
          <li>Venue dimensions &amp; screen size</li>
          <li>Audience distance from screen</li>
          <li>Ambient light conditions</li>
        </ul>
      </div>
      <div>
        <h3>Realism Factors</h3>
        <ul>
          <li>Correct character proportions</li>
          <li>Shadow / ground contact integration</li>
          <li>Correct camera angles per scene</li>
          <li>Stage lighting contrast calibration</li>
        </ul>
      </div>
    </div>
  </div>

  <div class="footer">
    <p>Boostify Music &nbsp;·&nbsp; Hologram Live Show Engine &nbsp;·&nbsp; boostifymusic.com</p>
    <p style="margin-top:6px">Production inquiries: vr@boostifymusic.com</p>
  </div>
</body>
</html>`;
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// ─── Sticky Navigation ────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  { id: 'features', label: 'Features' },
  { id: 'character-creation', label: '3D Avatar' },
  { id: 'hologram-tech', label: 'Display' },
  { id: 'holosuit', label: 'HoloSuit' },
  { id: 'how-it-works', label: 'Process' },
  { id: 'scale-system', label: 'Scale' },
  { id: 'pipeline', label: 'Pipeline' },
  { id: 'packages', label: 'Pricing' },
  { id: 'xr-studio', label: 'XR Studio' },
  { id: 'hologauze', label: 'Hologauze' },
  { id: 'request-demo', label: 'Get Demo' },
] as const;

function StickyNav({ onOpenStudio }: { onOpenStudio: () => void }) {
  const [visible, setVisible] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const obs = NAV_SECTIONS.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const o = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setActive(id); },
        { rootMargin: '-35% 0px -55% 0px' }
      );
      o.observe(el);
      return o;
    });
    return () => obs.forEach((o) => o?.disconnect());
  }, []);

  const goto = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <AnimatePresence>
      {visible && (
        <motion.nav
          initial={{ y: -56, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -56, opacity: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
          className="fixed top-0 left-0 right-0 z-[100] h-12 flex items-center gap-3 px-3 sm:px-5"
          style={{
            background: 'rgba(5,5,5,0.94)',
            backdropFilter: 'blur(20px) saturate(1.5)',
            borderBottom: '1px solid rgba(255,255,255,0.07)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          }}
        >
          {/* Brand mark */}
          <div className="flex items-center gap-2 flex-shrink-0 mr-1">
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#FF7A00,#FFB347)', boxShadow: '0 0 12px rgba(255,122,0,0.5)' }}
            >
              <Zap className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="text-[10px] font-black tracking-[0.18em] uppercase text-white/70 hidden lg:block">
              Hologram Engine
            </span>
          </div>

          {/* Scrollable section links */}
          <div
            className="flex-1 flex items-center gap-0.5 overflow-x-auto min-w-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            {NAV_SECTIONS.map(({ id, label }) => {
              const isActive = active === id;
              return (
                <button
                  key={id}
                  onClick={() => goto(id)}
                  className="relative flex-shrink-0 px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors duration-150"
                  style={{ color: isActive ? '#FF7A00' : 'rgba(255,255,255,0.42)' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      className="absolute inset-0 rounded-md"
                      style={{ background: 'rgba(255,122,0,0.13)', border: '1px solid rgba(255,122,0,0.32)' }}
                      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={onOpenStudio}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold border"
              style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.32)', background: 'rgba(249,115,22,0.07)' }}
            >
              <Monitor className="w-3 h-3" />
              Studio
            </button>
            <a
              href="#request-demo"
              className="flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-black text-black leading-none"
              style={{ background: 'linear-gradient(135deg,#FF7A00,#FFB347)', boxShadow: '0 0 14px rgba(255,122,0,0.38)' }}
            >
              Get Demo
            </a>
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}

// ─── Chapter Break — cinematic section divider ───────────────────────────────

function ChapterBreak({ text, sub, accent = '#FF7A00' }: {
  text: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="relative py-16 sm:py-24 px-6 text-center overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at center, ${accent}0b 0%, transparent 65%)` }}
      />
      {/* Thin scan line */}
      <div
        className="absolute left-0 right-0 top-1/2 h-px pointer-events-none"
        style={{ background: `linear-gradient(90deg, transparent 0%, ${accent}18 25%, ${accent}50 50%, ${accent}18 75%, transparent 100%)` }}
      />
      {/* Side decorative lines */}
      <div className="absolute left-0 top-0 bottom-0 w-px pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent 0%, ${accent}20 40%, ${accent}20 60%, transparent 100%)` }} />
      <div className="absolute right-0 top-0 bottom-0 w-px pointer-events-none"
        style={{ background: `linear-gradient(to bottom, transparent 0%, ${accent}20 40%, ${accent}20 60%, transparent 100%)` }} />

      <div className="relative z-10 max-w-5xl mx-auto">
        <motion.h2
          className="text-4xl sm:text-5xl lg:text-[3.75rem] xl:text-7xl font-black leading-[1.05] tracking-tight"
          style={{
            background: `linear-gradient(135deg, #ffffff 0%, ${accent} 42%, rgba(255,255,255,0.78) 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.75 }}
        >
          {text}
        </motion.h2>
        {sub && (
          <motion.p
            className="mt-5 text-base sm:text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed"
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            {sub}
          </motion.p>
        )}
      </div>
    </div>
  );
}

// ─── CharacterShaderShowcase ──────────────────────────────────────────────────
const SHADER_CHANNELS = [
  { id: 'albedo',    label: 'Base Color',  sub: 'Albedo',       color: '#E8926A', gradient: 'linear-gradient(135deg,#c8856c,#9a6545,#c48a66)', patternType: 'noise' },
  { id: 'normal',    label: 'Normal Map',  sub: 'Tangent-Space',color: '#7A9FD6', gradient: 'linear-gradient(135deg,#7a9fd6,#5472b8,#8b6fc0)', patternType: 'lines' },
  { id: 'roughness', label: 'Roughness',   sub: 'Microsurface', color: '#AAAAAA', gradient: 'linear-gradient(135deg,#333,#686868,#4a4a4a,#7a7a7a)', patternType: 'noise' },
  { id: 'metallic',  label: 'Metallic',    sub: 'PBR Metalness',color: '#C0C0C0', gradient: 'linear-gradient(135deg,#0a0a0a,#1a1a1a,#0d0d0d)', patternType: 'sheen' },
  { id: 'ao',        label: 'Ambient OCC', sub: 'AO Map',       color: '#D8D8D8', gradient: 'linear-gradient(135deg,#d0d0d0,#888,#c0c0c0)', patternType: 'noise' },
  { id: 'emission',  label: 'Emission',    sub: 'Self-Illumin', color: '#00D4FF', gradient: 'linear-gradient(135deg,#030303,#0a1a2a,#020202)', patternType: 'glow' },
  { id: 'sss',       label: 'Subsurface',  sub: 'SSS Scatter',  color: '#FF6644', gradient: 'linear-gradient(135deg,#8B1A1A,#c0402a,#8b2010)', patternType: 'radial' },
  { id: 'height',    label: 'Height Map',  sub: 'Displacement', color: '#999999', gradient: 'linear-gradient(135deg,#111,#555,#999,#777)', patternType: 'stripes' },
];

function CharacterShaderShowcase() {
  const [activeShader, setActiveShader] = React.useState<string | null>(null);
  const active = SHADER_CHANNELS.find(s => s.id === activeShader);

  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.7 }}
      className="mb-12 rounded-2xl border overflow-hidden"
      style={{ borderColor: 'rgba(139,92,246,0.22)', background: 'linear-gradient(180deg,#09090f 0%,#070709 100%)' }}
    >
      <div className="flex flex-col lg:flex-row">

        {/* ── Left: character viewport ── */}
        <div
          className="lg:w-[44%] relative flex items-center justify-center p-8"
          style={{ minHeight: 460, background: 'radial-gradient(ellipse 70% 70% at 50% 50%,rgba(139,92,246,0.1) 0%,transparent 70%)' }}
        >
          {/* Grid */}
          <div className="absolute inset-0 opacity-[0.035]"
            style={{ backgroundImage: 'linear-gradient(rgba(139,92,246,1) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,1) 1px,transparent 1px)', backgroundSize: '28px 28px' }} />
          {/* Corner labels */}
          <span className="absolute top-3 left-3 text-[9px] font-mono" style={{ color: 'rgba(139,92,246,0.45)' }}>BOOSTIFY_CC_v4</span>
          <span className="absolute top-3 right-3 text-[9px] font-mono" style={{ color: 'rgba(0,212,255,0.45)' }}>BASE_MESH · PBR</span>
          <span className="absolute bottom-3 left-3 text-[9px] font-mono" style={{ color: 'rgba(255,122,0,0.45)' }}>POLY: 142,880</span>
          <span className="absolute bottom-3 right-3 text-[9px] font-mono" style={{ color: 'rgba(255,122,0,0.45)' }}>BONES: 256</span>

          {/* Character figure */}
          <div className="relative" style={{ width: 210, height: 370 }}>
            {/* Scan line */}
            <motion.div
              className="absolute left-0 right-0 h-px z-20 pointer-events-none"
              style={{ background: 'linear-gradient(90deg,transparent,rgba(0,212,255,0.7),transparent)' }}
              animate={{ top: ['2%', '98%', '2%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
            />
            {/* Ground glow */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-3 rounded-full blur-md opacity-50"
              style={{ background: 'radial-gradient(ellipse,rgba(139,92,246,0.9) 0%,transparent 70%)' }} />

            <svg viewBox="0 0 210 370" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
              <defs>
                <linearGradient id="cc_skin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#c98b68" />
                  <stop offset="45%" stopColor="#9a6545" />
                  <stop offset="100%" stopColor="#c48a66" />
                </linearGradient>
                <linearGradient id="cc_suit" x1="0%" y1="0%" x2="60%" y2="100%">
                  <stop offset="0%" stopColor="#1a1a2e" />
                  <stop offset="40%" stopColor="#16213e" />
                  <stop offset="75%" stopColor="#0f3460" />
                  <stop offset="100%" stopColor="#1a1a2e" />
                </linearGradient>
                <linearGradient id="cc_rim" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(139,92,246,0.8)" />
                  <stop offset="50%" stopColor="rgba(0,212,255,0)" />
                  <stop offset="100%" stopColor="rgba(0,212,255,0.6)" />
                </linearGradient>
                <linearGradient id="cc_sheen" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.35" />
                  <stop offset="50%" stopColor="#00D4FF" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.25" />
                </linearGradient>
                <filter id="cc_glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
                <filter id="cc_softglow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="1.5" result="b" />
                  <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* ── HAIR ── */}
              <path d="M77 22 Q105 6 133 22 Q134 29 131 32 Q116 18 105 17 Q94 18 79 32 Q76 29 77 22Z" fill="#140e04" />
              {/* ── HEAD ── */}
              <ellipse cx="105" cy="42" rx="28" ry="34" fill="url(#cc_skin)" />
              <ellipse cx="105" cy="42" rx="28" ry="34" fill="none" stroke="url(#cc_rim)" strokeWidth="1.8" opacity="0.55" />
              {/* Ears */}
              <ellipse cx="77" cy="42" rx="5" ry="8" fill="url(#cc_skin)" />
              <ellipse cx="133" cy="42" rx="5" ry="8" fill="url(#cc_skin)" />
              {/* Eyes */}
              <ellipse cx="95" cy="38" rx="5.5" ry="6" fill="#111" />
              <ellipse cx="115" cy="38" rx="5.5" ry="6" fill="#111" />
              <ellipse cx="95" cy="38" rx="3.5" ry="4" fill="#0a0a0a" />
              <ellipse cx="115" cy="38" rx="3.5" ry="4" fill="#0a0a0a" />
              <ellipse cx="96.5" cy="36.5" rx="1.5" ry="1.5" fill="white" opacity="0.85" />
              <ellipse cx="116.5" cy="36.5" rx="1.5" ry="1.5" fill="white" opacity="0.85" />
              {/* Nose */}
              <path d="M102 46 Q105 51 108 46" stroke="#7a4a2a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              {/* Mouth */}
              <path d="M98 53 Q105 58 112 53" stroke="#8a4a3a" strokeWidth="1.5" fill="none" strokeLinecap="round" />
              {/* ── NECK ── */}
              <rect x="97" y="74" width="16" height="18" rx="4" fill="url(#cc_skin)" />
              {/* ── COLLAR ── */}
              <path d="M75 90 Q105 82 135 90 L139 108 Q105 100 71 108Z" fill="url(#cc_suit)" />
              {/* ── TORSO ── */}
              <rect x="72" y="106" width="66" height="96" rx="9" fill="url(#cc_suit)" />
              <rect x="72" y="106" width="66" height="96" rx="9" fill="url(#cc_sheen)" />
              <rect x="72" y="106" width="66" height="96" rx="9" fill="none" stroke="url(#cc_rim)" strokeWidth="1.5" opacity="0.35" />
              {/* Center seam */}
              <line x1="105" y1="108" x2="105" y2="200" stroke="rgba(0,212,255,0.18)" strokeWidth="1" strokeDasharray="3 5" />
              {/* Horizontal panel lines */}
              <line x1="72" y1="148" x2="138" y2="148" stroke="rgba(0,212,255,0.1)" strokeWidth="0.8" />
              {/* Chest emblem */}
              <circle cx="105" cy="142" r="11" fill="none" stroke="rgba(139,92,246,0.45)" strokeWidth="1.5" />
              <circle cx="105" cy="142" r="7" fill="rgba(139,92,246,0.12)" />
              <circle cx="105" cy="142" r="3.5" fill="rgba(0,212,255,0.55)" filter="url(#cc_softglow)" />
              {/* ── BELT ── */}
              <rect x="72" y="198" width="66" height="10" rx="2" fill="#080812" />
              <rect x="95" y="200" width="20" height="6" rx="1.5" fill="rgba(139,92,246,0.5)" />
              {/* ── LEFT ARM ── */}
              <rect x="40" y="106" width="30" height="84" rx="11" fill="url(#cc_suit)" />
              <rect x="40" y="106" width="30" height="84" rx="11" fill="url(#cc_sheen)" />
              <rect x="40" y="106" width="30" height="84" rx="11" fill="none" stroke="url(#cc_rim)" strokeWidth="1.5" opacity="0.28" />
              {/* Left hand */}
              <ellipse cx="55" cy="198" rx="13" ry="11" fill="url(#cc_skin)" />
              <path d="M44 192 Q41 183 43 178" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M49 189 Q47 180 49 175" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M55 188 Q54 179 56 174" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M61 189 Q61 180 63 175" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M66 192 Q68 185 70 181" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              {/* ── RIGHT ARM ── */}
              <rect x="140" y="106" width="30" height="84" rx="11" fill="url(#cc_suit)" />
              <rect x="140" y="106" width="30" height="84" rx="11" fill="url(#cc_sheen)" />
              <rect x="140" y="106" width="30" height="84" rx="11" fill="none" stroke="url(#cc_rim)" strokeWidth="1.5" opacity="0.28" />
              {/* Right hand */}
              <ellipse cx="155" cy="198" rx="13" ry="11" fill="url(#cc_skin)" />
              <path d="M144 192 Q141 183 143 178" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M149 189 Q147 180 149 175" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M155 188 Q154 179 156 174" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M161 189 Q161 180 163 175" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              <path d="M166 192 Q168 185 170 181" stroke="url(#cc_skin)" strokeWidth="6" strokeLinecap="round" />
              {/* ── LEFT LEG ── */}
              <rect x="74" y="206" width="28" height="100" rx="11" fill="url(#cc_suit)" />
              <rect x="74" y="206" width="28" height="100" rx="11" fill="url(#cc_sheen)" />
              <rect x="74" y="206" width="28" height="100" rx="11" fill="none" stroke="url(#cc_rim)" strokeWidth="1.5" opacity="0.25" />
              <rect x="68" y="302" width="38" height="16" rx="5" fill="#0b0b16" />
              {/* ── RIGHT LEG ── */}
              <rect x="108" y="206" width="28" height="100" rx="11" fill="url(#cc_suit)" />
              <rect x="108" y="206" width="28" height="100" rx="11" fill="url(#cc_sheen)" />
              <rect x="108" y="206" width="28" height="100" rx="11" fill="none" stroke="url(#cc_rim)" strokeWidth="1.5" opacity="0.25" />
              <rect x="104" y="302" width="38" height="16" rx="5" fill="#0b0b16" />
              {/* ── WIREFRAME EDGES (subtle) ── */}
              <rect x="72" y="106" width="66" height="96" rx="9" fill="none" stroke="rgba(0,212,255,0.045)" strokeWidth="0.6" />
              <ellipse cx="105" cy="42" rx="28" ry="34" fill="none" stroke="rgba(0,212,255,0.045)" strokeWidth="0.6" />
              <line x1="72" y1="106" x2="40" y2="106" stroke="rgba(0,212,255,0.04)" strokeWidth="0.5" />
              <line x1="138" y1="106" x2="170" y2="106" stroke="rgba(0,212,255,0.04)" strokeWidth="0.5" />
              {/* ── Active shader tint overlay ── */}
              {active && (
                <rect x="0" y="0" width="210" height="370"
                  fill={active.color}
                  fillOpacity="0.07"
                  style={{ mixBlendMode: 'screen' }}
                />
              )}
            </svg>

            {/* Info tags */}
            <div className="absolute top-4 -right-1 flex flex-col gap-1.5">
              {['Rig · 256 bones', '52 blend shapes', 'LOD · 5 levels'].map(t => (
                <div key={t} className="px-2 py-0.5 rounded text-[8px] font-mono whitespace-nowrap"
                  style={{ background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(0,212,255,0.18)', color: 'rgba(0,212,255,0.65)' }}>
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: shader stack ── */}
        <div className="lg:w-[56%] p-6 flex flex-col justify-center border-t lg:border-t-0 lg:border-l"
          style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
          <div className="mb-4">
            <p className="text-[10px] font-bold tracking-[0.22em] uppercase" style={{ color: 'rgba(139,92,246,0.8)' }}>
              PBR Material Channels
            </p>
            <p className="text-white font-black text-xl mt-0.5">Shader Stack</p>
            <p className="text-gray-600 text-xs mt-1">8 channels · 4096² textures · Physically-Based Rendering</p>
          </div>

          {/* 4×2 shader grid */}
          <div className="grid grid-cols-4 gap-2">
            {SHADER_CHANNELS.map((s, i) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.055 }}
                onHoverStart={() => setActiveShader(s.id)}
                onHoverEnd={() => setActiveShader(null)}
                className="cursor-pointer"
              >
                <div className="rounded-xl overflow-hidden border transition-all duration-200"
                  style={{
                    borderColor: activeShader === s.id ? s.color : 'rgba(255,255,255,0.07)',
                    boxShadow: activeShader === s.id ? `0 0 18px ${s.color}35` : 'none',
                    transform: activeShader === s.id ? 'scale(1.04)' : 'scale(1)',
                  }}>
                  {/* Preview tile */}
                  <div className="relative" style={{ aspectRatio: '1/1' }}>
                    <div className="absolute inset-0" style={{ background: s.gradient }} />
                    {/* Pattern variants */}
                    {s.patternType === 'lines' && (
                      <div className="absolute inset-0"
                        style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(255,255,255,0.05) 0px,rgba(255,255,255,0.05) 1px,transparent 1px,transparent 7px)' }} />
                    )}
                    {s.patternType === 'stripes' && (
                      <div className="absolute inset-0"
                        style={{ backgroundImage: 'repeating-linear-gradient(0deg,transparent 0px,transparent 3px,rgba(255,255,255,0.06) 3px,rgba(255,255,255,0.06) 4px)' }} />
                    )}
                    {s.patternType === 'sheen' && (
                      <div className="absolute inset-0"
                        style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 45%,rgba(255,255,255,0.15) 100%)' }} />
                    )}
                    {s.patternType === 'glow' && (
                      <>
                        <div className="absolute" style={{ top:'30%',left:'52%',transform:'translate(-50%,-50%)',width:9,height:9,borderRadius:'50%',background:'#00D4FF',filter:'blur(4px)',opacity:0.9 }} />
                        <div className="absolute" style={{ top:'68%',left:'34%',transform:'translate(-50%,-50%)',width:6,height:6,borderRadius:'50%',background:'#8B5CF6',filter:'blur(3px)',opacity:0.7 }} />
                      </>
                    )}
                    {s.patternType === 'radial' && (
                      <div className="absolute inset-0"
                        style={{ background: 'radial-gradient(ellipse at 50% 45%,rgba(255,120,80,0.65) 0%,transparent 68%)' }} />
                    )}
                    {/* Hover tint */}
                    {activeShader === s.id && (
                      <div className="absolute inset-0" style={{ background: `${s.color}25` }} />
                    )}
                    {/* Sub label */}
                    <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5"
                      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}>
                      <p className="text-center text-[7px] font-bold uppercase tracking-wide truncate" style={{ color: s.color }}>
                        {s.sub}
                      </p>
                    </div>
                  </div>
                  {/* Name row */}
                  <div className="px-1.5 py-1" style={{ background: 'rgba(0,0,0,0.55)' }}>
                    <p className="text-[8px] text-gray-500 font-medium text-center truncate">{s.label}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Inspector bar */}
          <div className="mt-3 rounded-xl border px-4 py-3 transition-all duration-300 min-h-[52px] flex items-center"
            style={{ borderColor: active ? `${active.color}40` : 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.35)' }}>
            {active ? (
              <div className="flex items-center gap-3 w-full">
                <div className="w-8 h-8 rounded-lg flex-shrink-0 border"
                  style={{ background: active.gradient, borderColor: `${active.color}50` }} />
                <div>
                  <p className="text-xs font-black text-white">{active.label}</p>
                  <p className="text-[10px] text-gray-500 mt-0.5">{active.sub} · 4096×4096 · Linear · sRGB</p>
                </div>
                <div className="ml-auto flex-shrink-0 w-2 h-2 rounded-full animate-pulse" style={{ background: active.color }} />
              </div>
            ) : (
              <p className="text-[10px] text-gray-700 w-full text-center">Hover a channel to inspect</p>
            )}
          </div>

          {/* Stats row */}
          <div className="mt-2 grid grid-cols-4 gap-2">
            {[['Tex Res','4096²'],['Mat Slots','12'],['LOD','5 levels'],['UV Sets','3']].map(([k,v]) => (
              <div key={k} className="rounded-lg py-1.5 text-center"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="text-xs font-black text-white">{v}</div>
                <div className="text-[8px] text-gray-600 uppercase tracking-wide">{k}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </motion.div>
  );
}

// ─── Main page component ──────────────────────────────────────────────────────

export default function HologramShowEnginePage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [studioOpen, setStudioOpen] = useState(false);
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [formData, setFormData] = useState<LeadFormData>({
    name: '', email: '', phone: '', companyOrArtist: '', clientType: '',
    experienceType: '', numberOfSongs: 1, hasAvatar: false, needsAvatarCreation: false,
    budgetRange: '', timeline: '', message: '',
  });

  // ── Artist project connection (arriving from Hologram Showcase) ──
  // /hologram-show-engine?artist=<id>&name=<artistName>
  const [artistProject, setArtistProject] = useState<{
    name: string;
    genre: string;
    profileImage: string | null;
    avatarUrl: string | null;
    glbUrl: string | null;
  } | null>(null);
  const [artistCharacter, setArtistCharacter] = useState<CharacterAsset | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const artistParam = params.get('artist');
    const artistNameParam = params.get('name');
    if (!artistParam) return;

    (async () => {
      try {
        const [galleryRes, avatarRes, characterRes] = await Promise.all([
          fetch(`/api/hologram-gallery/${encodeURIComponent(artistParam)}/gallery`).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/hologram-gallery/${encodeURIComponent(artistParam)}/avatar`).then((r) => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/hologram-gallery/${encodeURIComponent(artistParam)}/character-3d`).then((r) => r.ok ? r.json() : null).catch(() => null),
        ]);
        const info = galleryRes?.artistInfo;
        const avatarUrl = avatarRes?.avatar?.url || null;
        const char3d = characterRes?.character;
        // Prefer the rigged/animated GLB (Tripo auto-rig) so the avatar arrives on
        // stage with its animation clips; fall back to the static GLB.
        const animatedGlb = char3d?.animatedFormat === 'glb'
          ? (char3d?.animatedGlbUrl || char3d?.animatedUrl || null)
          : null;
        const glbUrl = animatedGlb || char3d?.riggedGlbUrl || char3d?.glbUrl || null;
        const name = info?.name || artistNameParam || 'Artist';
        setArtistProject({
          name,
          genre: info?.genre || 'Music',
          profileImage: info?.profileImage || null,
          avatarUrl,
          glbUrl,
        });
        // Build a stage-ready 3D character so the artist's hologram loads on the virtual stage
        if (glbUrl) {
          setArtistCharacter({
            id: `artist-${artistParam}`,
            name,
            glbUrl,
            thumbnailUrl: char3d?.thumbnailUrl || info?.profileImage || undefined,
            importedAt: new Date().toISOString(),
            transform: { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scale: 1.0 },
            idleAnimation: 'idle',
            // Real clip names are discovered from the GLB at load time by HologramRenderer
            availableAnimations: [],
            rigType: 'humanoid',
            source: 'url',
            format: 'glb',
          });
        }
        // Pre-fill the proposal form with the artist's project
        setFormData((prev) => ({
          ...prev,
          companyOrArtist: prev.companyOrArtist || name,
          clientType: prev.clientType || 'recording_artist',
          experienceType: prev.experienceType || 'hologram_stage',
          hasAvatar: !!avatarUrl,
          needsAvatarCreation: !avatarUrl,
          message: prev.message || `I want to launch a virtual hologram concert for ${name} (${info?.genre || 'music'} artist). My AI hologram gallery${avatarUrl ? ' and holographic avatar are' : ' is'} already generated on Boostify.`,
        }));
      } catch { /* optional personalization */ }
    })();
  }, []);

  const { data: assetsData, isLoading: assetsLoading } = useQuery<HologramAssets>({
    queryKey: ['/api/hologram-show/assets'],
    staleTime: 5 * 60 * 1000,
  });

  const assets = assetsLoading
    ? FALLBACK_HOLOGRAM_ASSETS
    : { ...FALLBACK_HOLOGRAM_ASSETS, ...(assetsData?.assets ?? {}) };

  const generateAssetsMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/hologram-show/generate-assets', {}),
  });

  const leadMutation = useMutation({
    mutationFn: (data: LeadFormData) =>
      apiRequest('POST', '/api/hologram-show/leads', data),
    onSuccess: () => setFormStatus('success'),
    onError: () => setFormStatus('error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.email.trim()) return;
    setFormStatus('sending');
    leadMutation.mutate(formData);
  };

  const updateForm = (field: keyof LeadFormData, value: string | number | boolean) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  // Scroll-reveal animations
  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' } },
  };

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505', fontFamily: "'Inter', sans-serif" }}>

      <Header />
      <StickyNav onOpenStudio={() => setStudioOpen(true)} />

      {/* ─── ARTIST PROJECT BANNER (arriving from Hologram Showcase) ───── */}
      {artistProject && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-30 mx-auto max-w-5xl px-4 sm:px-6 mt-24 -mb-12"
        >
          <div
            className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl p-5"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(139,92,246,0.08))',
              border: '1px solid rgba(0,212,255,0.25)',
              backdropFilter: 'blur(12px)',
            }}
          >
            {artistProject.glbUrl ? (
              <div className="relative flex-shrink-0">
                <div
                  className="w-28 h-28 sm:w-32 sm:h-32 rounded-2xl overflow-hidden"
                  style={{ border: '2px solid rgba(0,212,255,0.5)', boxShadow: '0 0 30px rgba(0,212,255,0.25)' }}
                >
                  <ArtistModelPreview src={artistProject.glbUrl} />
                </div>
                <div
                  className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black"
                  style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)', color: '#000' }}
                >
                  3D MODEL
                </div>
              </div>
            ) : (artistProject.avatarUrl || artistProject.profileImage) && (
              <div className="relative flex-shrink-0">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden"
                  style={{ border: '2px solid rgba(0,212,255,0.5)', boxShadow: '0 0 30px rgba(0,212,255,0.25)' }}
                >
                  <img
                    src={artistProject.avatarUrl || artistProject.profileImage || ''}
                    alt={artistProject.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                {artistProject.avatarUrl && (
                  <div
                    className="absolute -bottom-1.5 -right-1.5 px-1.5 py-0.5 rounded text-[8px] font-black"
                    style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)', color: '#000' }}
                  >
                    AI AVATAR
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 text-center sm:text-left">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] mb-1" style={{ color: '#00d4ff' }}>
                Artist Project Loaded
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">{artistProject.name}</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {artistProject.genre} · {artistProject.glbUrl
                  ? '3D hologram character ready — loads onto the virtual stage'
                  : artistProject.avatarUrl
                    ? 'Holographic avatar ready — connected from Hologram Showcase'
                    : 'Avatar pending — we can create it as part of your production'}
              </p>
            </div>
            <a
              href="#request-demo"
              onClick={(e) => { e.preventDefault(); document.getElementById('request-demo')?.scrollIntoView({ behavior: 'smooth' }); }}
              className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #8b5cf6)' }}
            >
              <Send className="w-4 h-4" /> Get My Proposal
            </a>
          </div>
        </motion.div>
      )}

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 pb-16">
        <HoloGrid />
        <FloatingParticles />

        {/* Hero background VIDEO */}
        <div className="absolute inset-0 z-0">
          <video
            autoPlay
            muted
            loop
            playsInline
            poster={assets['hero_hologram_stage']?.url}
            className="w-full h-full object-cover opacity-30"
            style={{ objectPosition: 'center center' }}
          >
            <source src={assets['hologram_artist_performance']?.url} type="video/mp4" />
          </video>
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,5,5,0.55) 0%, rgba(5,5,5,0.25) 45%, rgba(5,5,5,0.92) 100%)'
          }} />
          {/* Side vignettes for mobile */}
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(5,5,5,0.7) 100%)'
          }} />
        </div>

        <div className="relative z-10 text-center max-w-5xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold tracking-[0.22em] uppercase mb-5 sm:mb-6 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full border"
              style={{ color: '#FF7A00', borderColor: 'rgba(255,122,0,0.4)', background: 'rgba(255,122,0,0.08)' }}>
              <Zap className="w-3 h-3" />
              Powered by Boostify AI
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.05] mb-6 sm:mb-8"
          >
            <span className="block text-white">Hologram</span>
            <span className="block"
              style={{ background: 'linear-gradient(135deg, #FF7A00 0%, #FFB347 40%, #00D4FF 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Live Show Engine
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-base sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          >
            Your artist. Every stage. Simultaneously. Boostify's Hologram Live Show Engine creates photorealistic digital performances — powered by Boostify's proprietary XR Engine and AI — that can perform anywhere in the world at once.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
          >
            <a
              href="#request-demo"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-105 active:scale-95 text-black w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB347)', boxShadow: '0 0 30px rgba(255,122,0,0.35)' }}
            >
              Request a Hologram Show Demo
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg border border-white/20 text-white backdrop-blur-sm hover:border-white/40 transition-all w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Play className="w-4 h-4 sm:w-5 sm:h-5" />
              See How It Works
            </a>
            <button
              onClick={() => setStudioOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg border transition-all hover:scale-105 w-full sm:w-auto"
              style={{ background: 'rgba(249,115,22,0.1)', borderColor: 'rgba(249,115,22,0.5)', color: '#f97316' }}
            >
              <Monitor className="w-4 h-4 sm:w-5 sm:h-5" />
              Abrir HoloStage Studio
            </button>
          </motion.div>

          {/* Stats bar */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-y-5 gap-x-8 sm:gap-x-12 mt-12 sm:mt-16 text-center"
          >
            {[
              { label: "Countries Ready", value: "195+" },
              { label: "Simultaneous Venues", value: "∞" },
              { label: "Production Days", value: "14–45" },
              { label: "Output Formats", value: "12+" },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-black" style={{ color: '#FF7A00' }}>{s.value}</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── AVATAR DEMO VIDEO ────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl opacity-15"
            style={{ background: 'radial-gradient(circle, #FF7A00 0%, #8B5CF6 50%, transparent 70%)' }} />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          {/* Left — copy */}
          <motion.div
            className="flex-1 text-center lg:text-left"
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
          >
            <span className="inline-block text-xs font-semibold tracking-[0.25em] uppercase mb-5 px-4 py-1.5 rounded-full border"
              style={{ color: '#FF7A00', borderColor: 'rgba(255,122,0,0.35)', background: 'rgba(255,122,0,0.07)' }}>
              Live Avatar Preview
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-white leading-tight mb-6">
              This Is What Your<br />
              <span style={{ background: 'linear-gradient(135deg, #FF7A00, #00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Artist Looks Like
              </span>
            </h2>
            <p className="text-gray-400 text-lg leading-relaxed mb-8 max-w-md">
              A photorealistic 3D avatar — built from reference photos, animated with AI, and ready to perform on any holographic surface in the world.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              {[
                { label: "Photorealistic Skin Detail", color: "#00D4FF" },
                { label: "AI-Driven Expressions", color: "#8B5CF6" },
                { label: "Boostify XR Render", color: "#FF7A00" },
              ].map((chip) => (
                <span key={chip.label} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{ borderColor: `${chip.color}35`, color: chip.color, background: `${chip.color}0d` }}>
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: chip.color }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  {chip.label}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — vertical video */}
          <motion.div
            className="flex-shrink-0"
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.15, ease: 'easeOut' }}
          >
            {/* Outer glow ring */}
            <motion.div
              className="absolute inset-0 rounded-3xl pointer-events-none"
              style={{ boxShadow: '0 0 80px rgba(255,122,0,0.25), 0 0 160px rgba(139,92,246,0.12)' }}
              animate={{ boxShadow: [
                '0 0 60px rgba(255,122,0,0.2), 0 0 120px rgba(139,92,246,0.1)',
                '0 0 100px rgba(255,122,0,0.35), 0 0 200px rgba(139,92,246,0.18)',
                '0 0 60px rgba(255,122,0,0.2), 0 0 120px rgba(139,92,246,0.1)',
              ]}}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Phone/portrait frame */}
            <div
              className="relative rounded-3xl overflow-hidden border"
              style={{
                width: '280px',
                aspectRatio: '9 / 16',
                borderColor: 'rgba(255,122,0,0.4)',
                background: '#000',
                boxShadow: '0 0 60px rgba(255,122,0,0.2), 0 30px 80px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}
            >
              {/* iframe fills the frame */}
              <iframe
                src="https://app.heygen.com/embeds/0dd3a2937fcd46dab1c5014e10f9c496"
                title="Avatar Video"
                frameBorder="0"
                allow="encrypted-media; fullscreen;"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                style={{ border: 'none' }}
              />

              {/* Bottom gradient — covers the HeyGen logo */}
              <div
                className="absolute bottom-0 left-0 right-0 h-[22%] pointer-events-none"
                style={{
                  background: 'linear-gradient(to top, #000000 0%, rgba(0,0,0,0.92) 40%, transparent 100%)',
                }}
              />

              {/* Corner accent dots */}
              <div className="absolute top-3 left-3 w-2 h-2 rounded-full" style={{ background: '#FF7A00', boxShadow: '0 0 8px #FF7A00' }} />
              <div className="absolute top-3 right-3 w-2 h-2 rounded-full" style={{ background: '#00D4FF', boxShadow: '0 0 8px #00D4FF' }} />

              {/* Live indicator */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-red-500"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                />
                <span className="text-white text-[10px] font-bold tracking-widest uppercase">Live Avatar</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── PROBLEM ──────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={sectionVariants}
          >
            <SectionHeading
              eyebrow="The Problem"
              title="Physical Tours Are Limiting Your Potential"
            />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: Globe, title: "Geographic Ceiling", desc: "You can only be in one city per night. Every sold-out show in Tokyo is a missed show in New York." },
                { icon: DollarSign, title: "Enormous Logistics Costs", desc: "Production, travel, crews, venues. World tours routinely cost $10M+ before a single ticket is sold." },
                { icon: Clock, title: "Artist Fatigue & Risk", desc: "Touring exhausts artists. Health issues, cancellations, and delays cost millions and damage fan relationships." },
              ].map((item) => (
                <GlassCard key={item.title} className="p-6" glowColor="rgba(255,122,0,0.1)">
                  <item.icon className="w-10 h-10 mb-4" style={{ color: '#FF7A00' }} />
                  <h3 className="text-xl font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 leading-relaxed">{item.desc}</p>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SOLUTION / FEATURES ──────────────────────────────────────────── */}
      <section id="features" className="py-14 sm:py-24 px-4 sm:px-6 relative" style={{ background: 'rgba(0,212,255,0.02)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="The Solution"
              title="8 Systems. One Infinite Stage."
              subtitle="Every component of the Boostify Hologram Live Show Engine works together to create world-class digital performances."
            />
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              >
                <GlassCard className="p-5 h-full" glowColor={`${f.color}18`}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${f.color}15`, border: `1px solid ${f.color}30` }}>
                    <f.icon className="w-5 h-5" style={{ color: f.color }} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-2">{f.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed">{f.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── 3D CHARACTER PROCESS ─────────────────────────────────────────── */}
      <section id="character-creation" className="py-16 sm:py-14 sm:py-24 px-4 sm:px-6 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="3D Character Creation"
              title="How We Build Your Artist"
              subtitle="From your first photo to a fully rigged photorealistic avatar — the complete 6-step process behind every Boostify hologram."
            />
          </motion.div>

          {/* Full-bleed image grid with text overlays */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {[
              {
                key: '3d_avatar_creation',
                step: '01',
                title: 'Reference & Body Scan',
                desc: 'High-res photos, video reference, precise body measurements — the data foundation of your digital identity.',
                color: '#00D4FF',
                tag: 'Foundation',
              },
              {
                key: 'unreal_engine_virtual_stage',
                step: '02',
                title: 'Boostify Sculpt Engine',
                desc: 'Facial topology, skin micro-detail, custom expression shapes. Every pore sculpted with museum-quality precision inside Boostify’s proprietary pipeline.',
                color: '#8B5CF6',
                tag: 'Sculpt',
              },
              {
                key: 'festival_hologram_crowd',
                step: '03',
                title: 'Rigging & Animation',
                desc: 'Full skeleton rig, PBR materials, and a motion library built from your actual performance footage.',
                color: '#FF7A00',
                tag: 'Motion',
              },
              {
                key: 'hero_hologram_stage',
                step: '04',
                title: 'Boostify XR Stage',
                desc: 'Your avatar enters Boostify’s proprietary virtual stage — cinematic lights, volumetric particles, real-time physics.',
                color: '#00D4FF',
                tag: 'Stage Build',
              },
              {
                key: 'virtual_stage_design',
                step: '05',
                title: 'Scale & Lighting Presets',
                desc: 'Real Size, Hero Size, Giant Finale — each scene is programmed with scale cues that fire on every beat.',
                color: '#8B5CF6',
                tag: 'Presets',
              },
              {
                key: 'catalog_revival_performance',
                step: '06',
                title: 'Live Global Deployment',
                desc: 'SDI/NDI output to the hologram company. Your artist performs simultaneously in every city on earth.',
                color: '#FF7A00',
                tag: 'Go Live',
              },
            ].map(({ key, step, title, desc, color, tag }, i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.08 }}
                className="group relative overflow-hidden rounded-2xl"
                style={{ aspectRatio: '16/10', minHeight: '220px' }}
              >
                {/* Background image */}
                {assets[key] && (
                  <img
                    src={assets[key].url}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                )}

                {/* Gradient overlay */}
                <div className="absolute inset-0"
                  style={{ background: `linear-gradient(to bottom, rgba(5,5,5,0.05) 0%, rgba(5,5,5,0.3) 30%, rgba(5,5,5,0.88) 75%, rgba(5,5,5,0.97) 100%)` }} />

                {/* Color tint at top */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500"
                  style={{ background: `linear-gradient(135deg, ${color}, transparent)` }} />

                {/* Step badge — top left */}
                <div className="absolute top-4 left-4">
                  <span className="text-3xl sm:text-4xl font-black leading-none"
                    style={{ color: `${color}50`, textShadow: `0 0 20px ${color}` }}>
                    {step}
                  </span>
                </div>

                {/* Tag — top right */}
                <div className="absolute top-3.5 right-3.5">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase"
                    style={{ background: `${color}20`, color, border: `1px solid ${color}40`, backdropFilter: 'blur(8px)' }}>
                    {tag}
                  </span>
                </div>

                {/* Text bottom */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                  <h3 className="font-black text-white text-sm sm:text-base mb-1.5 leading-tight">{title}</h3>
                  <p className="text-gray-400 text-xs leading-relaxed opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">{desc}</p>
                  {/* Always-visible short label on mobile */}
                  <p className="text-gray-500 text-[11px] sm:hidden leading-snug">{desc.split('—')[0]}</p>
                </div>

                {/* Bottom glow line */}
                <motion.div
                  className="absolute bottom-0 left-0 h-[2px] w-0 group-hover:w-full transition-all duration-700"
                  style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
                />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <ChapterBreak
        text="Your face. Every screen. Everywhere."
        sub="Four display technologies, one perfect illusion — choose the one that fits your stage."
        accent="#00D4FF"
      />

      {/* ─── HOW HOLOGRAM TECH WORKS ──────────────────────────────────────── */}
      <section id="hologram-tech" className="py-16 sm:py-14 sm:py-24 px-4 sm:px-6 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.018)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 15% 50%, rgba(0,212,255,0.04) 0%, transparent 55%)' }} />

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="How It Works"
              title="Inside the Hologram"
              subtitle="Four display technologies — four different visual experiences. Choose the one that fits your stage, your venue, and your vision."
            />
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-5">
            {[
              {
                key: 'hero_hologram_stage',
                icon: '🔆',
                title: 'LED Transparent Screen',
                subtitle: 'Best for Concerts & Arenas',
                color: '#00D4FF',
                steps: ['Light from projector passes through transparent LED mesh', 'Artist image appears to float in mid-air', 'Audience sees artist from front — background is visible through screen', 'Works in full ambient light — no dark room required'],
                recommended: true,
              },
              {
                key: 'festival_hologram_crowd',
                icon: '👻',
                title: 'Hologauze / Mesh',
                subtitle: 'Best for Theatre & Drama',
                color: '#8B5CF6',
                steps: ['Fine-grain transparent mesh stretched across stage opening', 'High-lumen projection hits mesh at 90° angle', 'Image appears to glow and float inside the space', 'Controlled lighting environment enhances ghost effect'],
                recommended: false,
              },
              {
                key: 'unreal_engine_virtual_stage',
                icon: '🪞',
                title: "Pepper's Ghost",
                subtitle: 'Classic Illusion Effect',
                color: '#FF7A00',
                steps: ['Hidden screen below stage shows artist at an angle', 'Large angled piece of glass reflects the image upward', 'Audience perceives the reflection as a 3D ghost on stage', 'Same technique used for Tupac (2012) and ABBA Voyage'],
                recommended: false,
              },
              {
                key: 'virtual_stage_design',
                icon: '📺',
                title: 'LED Wall',
                subtitle: 'Maximum Impact & Reach',
                color: '#FFB347',
                steps: ['High-resolution LED panels assembled behind / around stage', 'Artist rendered in real-time inside the virtual environment', 'Camera tracking blends artist with physical stage elements', 'Deployable to any venue worldwide — no special install'],
                recommended: false,
              },
            ].map(({ key, icon, title, subtitle, color, steps, recommended }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.1 }}
                className="group relative overflow-hidden rounded-2xl"
                style={{ minHeight: '340px' }}
              >
                {/* Background image */}
                {assets[key] && (
                  <img
                    src={assets[key].url}
                    alt={title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    style={{ filter: 'brightness(1.25) contrast(1.05)' }}
                  />
                )}

                {/* Gradient overlay — light top, darker only at bottom for text */}
                <div className="absolute inset-0"
                  style={{ background: `linear-gradient(to bottom, rgba(5,5,5,0.12) 0%, rgba(5,5,5,0.35) 40%, rgba(5,5,5,0.88) 72%)` }} />

                {/* Recommended badge */}
                {recommended && (
                  <div className="absolute top-4 right-4">
                    <motion.span
                      className="px-2.5 py-1 rounded-full text-[10px] font-black text-black"
                      style={{ background: color, boxShadow: `0 0 16px ${color}80` }}
                      animate={{ boxShadow: [`0 0 12px ${color}60`, `0 0 24px ${color}CC`, `0 0 12px ${color}60`] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                    >
                      ⭐ RECOMMENDED
                    </motion.span>
                  </div>
                )}

                {/* Content */}
                <div className="absolute inset-0 p-5 sm:p-6 flex flex-col justify-end">
                  <div className="text-3xl mb-3">{icon}</div>
                  <h3 className="font-black text-white text-lg sm:text-xl mb-0.5">{title}</h3>
                  <p className="text-xs font-semibold mb-4" style={{ color: `${color}CC` }}>{subtitle}</p>

                  <ol className="space-y-1.5">
                    {steps.map((step, si) => (
                      <li key={si} className="flex items-start gap-2.5 text-xs text-gray-400 leading-relaxed">
                        <span className="font-black flex-shrink-0 mt-0.5 tabular-nums" style={{ color: `${color}80` }}>{String(si + 1).padStart(2, '0')}</span>
                        {step}
                      </li>
                    ))}
                  </ol>

                  {/* Bottom accent */}
                  <div className="mt-4 h-px w-full opacity-30" style={{ background: `linear-gradient(90deg, ${color}, transparent)` }} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── DEMO VIDEOS ──────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Demo Showcase"
              title="See the Technology in Motion"
              subtitle="AI-generated preview videos showcasing the Boostify Hologram experience."
            />
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            <DemoVideoCard
              url={assets['hologram_artist_performance']?.url}
              posterUrl={assets['hero_hologram_stage']?.url}
              label="Artist Hologram Performance"
            />
            <DemoVideoCard
              url={assets['virtual_stage_transformation']?.url}
              posterUrl={assets['unreal_engine_virtual_stage']?.url}
              label="Virtual Stage Transformation"
            />
            <DemoVideoCard
              url={assets['avatar_in_motion']?.url}
              posterUrl={assets['3d_avatar_creation']?.url}
              label="3D Avatar in Motion"
            />
          </div>
        </div>
      </section>

      {/* ─── HOLOSUIT ─────────────────────────────────────────────────────── */}
      <ChapterBreak
        text="The suit behind the show."
        sub="Real-time motion capture powered by Boostify HoloSuit — plug-and-play, sub-17ms latency."
        accent="#FF7A00"
      />

      <section id="holosuit" className="py-16 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(249,115,22,0.02)' }}>
        {/* glow */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 70% 50%, rgba(249,115,22,0.07) 0%, transparent 60%)' }} />
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          {/* Heading */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants} className="text-center mb-14">
            <span style={{ display: 'inline-block', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.35)', color: '#FF7A00', padding: '4px 14px', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 20 }}>Hardware</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white mb-4">Boostify HoloSuit</h2>
            <p className="text-gray-400 text-lg max-w-2xl mx-auto">The motion capture suit that feeds every hologram performance in real time — wireless, ultra-low latency, and designed for the stage.</p>
          </motion.div>

          {/* Stats row */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-14">
            {[
              { value: '<17ms', label: 'Motion Latency' },
              { value: '120fps', label: 'Capture Rate' },
              { value: '97%', label: 'Joint Accuracy' },
              { value: 'IP54', label: 'Stage Rated' },
            ].map(stat => (
              <div key={stat.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: 14, padding: '20px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 900, color: '#FF7A00', lineHeight: 1 }}>{stat.value}</div>
                <div style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 6, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{stat.label}</div>
              </div>
            ))}
          </motion.div>

          {/* Image + Features split */}
          <div className="grid lg:grid-cols-2 gap-12 items-center mb-14">
            {/* Image */}
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
              <div style={{ borderRadius: 20, overflow: 'hidden', border: '1px solid rgba(249,115,22,0.2)', background: '#0a0a0a', aspectRatio: '4/3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src="/holosuit/ec0bf471-5309-45bd-830d-b839ed56c7d9.png"
                  alt="Boostify HoloSuit Pro Body"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
            </motion.div>

            {/* Feature list */}
            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, delay: 0.1 }}>
              <h3 className="text-2xl font-bold text-white mb-8">Built for live performance</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { icon: Zap, title: 'Sub-17ms End-to-End', desc: 'From body movement to on-screen hologram — imperceptible to any audience.' },
                  { icon: Activity, title: 'Full-Body Skeleton Tracking', desc: '72 joint nodes covering torso, limbs, hands and facial micro-expressions.' },
                  { icon: Radio, title: 'Wireless 5G / Wi-Fi 6', desc: 'Stage-grade wireless. No cables. Works in arenas, clubs, and outdoor festivals.' },
                  { icon: Shield, title: 'IP54 Sweat & Dust Proof', desc: 'Built to survive the most intense live performances night after night.' },
                  { icon: Cpu, title: 'On-Suit Edge Processing', desc: 'AI preprocessing directly on the suit chip — no cloud dependency on stage.' },
                ].map(({ icon: Icon, title, desc }) => (
                  <div key={title} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{ flexShrink: 0, width: 36, height: 36, borderRadius: 10, background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon className="w-4 h-4" style={{ color: '#FF7A00' }} />
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>{title}</div>
                      <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 2, lineHeight: 1.5 }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Components row */}
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
            {[
              { img: '/holosuit/ec0bf471-5309-45bd-830d-b839ed56c7d9.png', name: 'HoloSuit Pro Body', desc: '54-node full-body suit. Core motion & spine tracking.' },
              { img: '/holosuit/a26ff5e6-044c-411c-9ab3-df1716221b6a.png', name: 'HoloGloves', desc: 'Finger & wrist articulation — 18 sensors per hand.' },
              { img: '/holosuit/5a8b4e05-4fdc-4dd9-b8d7-1ac7b30b53f4.png', name: 'HoloFace', desc: 'Facial expression capture. Syncs with AI avatar rendering.' },
            ].map(c => (
              <div key={c.name} style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(249,115,22,0.12)', borderRadius: 16, overflow: 'hidden' }}>
                <div style={{ aspectRatio: '4/3', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img src={c.img} alt={c.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ padding: '16px 18px' }}>
                  <div style={{ color: '#FF7A00', fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>{c.name}</div>
                  <div style={{ color: '#6b7280', fontSize: '0.82rem', lineHeight: 1.5 }}>{c.desc}</div>
                </div>
              </div>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.2 }} className="text-center">
            <a
              href="/holosuit"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 10, background: 'linear-gradient(135deg, #f97316, #ea580c)', color: '#fff', fontWeight: 700, fontSize: '1rem', padding: '14px 32px', borderRadius: 12, textDecoration: 'none', boxShadow: '0 0 30px rgba(249,115,22,0.3)', transition: 'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 45px rgba(249,115,22,0.5)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLAnchorElement).style.boxShadow = '0 0 30px rgba(249,115,22,0.3)'; }}
            >
              <Box className="w-5 h-5" /> Explore HoloSuit Full Page
            </a>
            <p style={{ color: '#4b5563', fontSize: '0.82rem', marginTop: 12 }}>Pre-order open · Ships Q3 2026 · Limited beta units available</p>
          </motion.div>
        </div>
      </section>

      {/* ─── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <ChapterBreak
        text="Six steps. One infinite stage."
        sub="From your first reference photo to performing live in every city on earth."
        accent="#8B5CF6"
      />

      <section id="how-it-works" className="py-14 sm:py-24 px-4 sm:px-6 relative" style={{ background: 'rgba(139,92,246,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Process"
              title="From Concept to Worldwide Stage"
              subtitle="Six precision-engineered steps — from your first reference upload to performing live in every city."
            />
          </motion.div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
              >
                <GlassCard className="p-6 h-full" glowColor="rgba(139,92,246,0.1)">
                  <div className="flex items-start gap-4">
                    <span className="text-4xl font-black leading-none flex-shrink-0"
                      style={{ color: 'rgba(139,92,246,0.3)' }}>{step.step}</span>
                    <div>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                        style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)' }}>
                        <step.icon className="w-4 h-4" style={{ color: '#8B5CF6' }} />
                      </div>
                      <h3 className="font-bold text-white mb-2">{step.title}</h3>
                      <p className="text-gray-500 text-sm leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOLOGAUZE CONCERT SYSTEM ─────────────────────────────────────── */}
      <div id="hologauze"><HologauzeConcertSection /></div>

      {/* ─── ARTIST SCALE SYSTEM ──────────────────────────────────────────── */}
      <section id="scale-system" className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(0,212,255,0.025)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 25% 50%, rgba(0,212,255,0.06) 0%, transparent 60%)' }} />
          {/* Animated size rings */}
          {[1, 1.5, 3].map((scale, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full border"
              style={{
                width: `${60 + i * 60}px`,
                height: `${60 + i * 60}px`,
                right: `${8 + i * 4}%`,
                top: '50%',
                borderColor: i === 0 ? 'rgba(0,212,255,0.15)' : i === 1 ? 'rgba(139,92,246,0.15)' : 'rgba(255,122,0,0.12)',
                transform: 'translateY(-50%)',
              }}
              animate={{ scale: [1, 1.04, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 3 + i * 0.8, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
            />
          ))}
        </div>

        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Scale System"
              title="Your Artist. Any Size. Any Moment."
              subtitle="Boostify's XR Stage Engine lets you configure the artist's scale per scene — from true human height to arena-filling monumental presence. Every transition is a visual event."
            />
          </motion.div>

          {/* Scale Presets */}
          <div className="grid md:grid-cols-3 gap-6 mb-20">
            {SCALE_PRESETS.map((preset, i) => (
              <motion.div
                key={preset.name}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.65, delay: i * 0.14 }}
              >
                <GlassCard className="p-6 h-full group hover:border-white/20 transition-colors" glowColor={`${preset.color}18`}>
                  {/* Scale multiplier — animated count-up feel */}
                  <motion.div
                    className="flex items-baseline gap-3 mb-3"
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: i * 0.14 + 0.3 }}
                  >
                    <span className="text-6xl font-black leading-none" style={{ color: preset.color }}>{preset.multiplier}</span>
                  </motion.div>
                  <div className="text-xs font-semibold tracking-widest uppercase mb-4" style={{ color: `${preset.color}90` }}>{preset.label}</div>

                  {/* Animated scale bar */}
                  <div className="relative h-1.5 bg-white/5 rounded-full mb-5 overflow-hidden">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{ background: `linear-gradient(90deg, ${preset.color}60, ${preset.color})` }}
                      initial={{ width: 0 }}
                      whileInView={{ width: preset.barWidth }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.4, delay: i * 0.14 + 0.4, ease: 'easeOut' }}
                    />
                  </div>

                  <h3 className="text-xl font-black text-white mb-3">{preset.name}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed mb-5">{preset.desc}</p>

                  <div className="space-y-2 pt-4 border-t border-white/5">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: `${preset.color}70` }}>Ideal for</div>
                    {preset.scenes.map((scene) => (
                      <div key={scene} className="flex items-center gap-2.5 text-xs text-gray-500">
                        <motion.div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: preset.color }}
                          animate={{ scale: [1, 1.4, 1] }}
                          transition={{ duration: 2, repeat: Infinity, delay: Math.random() * 2 }}
                        />
                        {scene}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* 4-Scene Show Arc */}
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <div className="text-center mb-12">
              <span className="inline-block text-xs font-semibold tracking-[0.22em] uppercase px-4 py-1.5 rounded-full border mb-4"
                style={{ color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.3)', background: 'rgba(139,92,246,0.07)' }}>
                Recommended Show Arc
              </span>
              <h3 className="text-3xl font-black text-white">4-Scene Scale Progression</h3>
              <p className="text-gray-500 text-sm mt-3 max-w-xl mx-auto">Design your show with intentional scale transitions — each shift creates a visceral moment the audience never forgets.</p>
            </div>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SHOW_SCENES.map((scene, i) => (
              <motion.div
                key={scene.number}
                initial={{ opacity: 0, scale: 0.88 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.12 }}
              >
                <GlassCard className="overflow-hidden group h-full cursor-default" glowColor={`${scene.color}15`}>
                  {assets[scene.imageKey] && (
                    <div className="relative h-40 overflow-hidden">
                      <img
                        src={assets[scene.imageKey].url}
                        alt={scene.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      />
                      <div className="absolute inset-0"
                        style={{ background: `linear-gradient(to bottom, transparent 20%, rgba(5,5,5,0.97) 100%)` }} />
                      {/* Scale badge */}
                      <div className="absolute top-3 right-3">
                        <motion.span
                          className="px-2 py-0.5 rounded-full text-xs font-black"
                          style={{ background: `${scene.color}22`, color: scene.color, border: `1px solid ${scene.color}45` }}
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                        >
                          {scene.scale}
                        </motion.span>
                      </div>
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-3xl font-black" style={{ color: `${scene.color}35` }}>{scene.number}</span>
                      <h4 className="font-black text-white text-sm leading-tight">{scene.title}</h4>
                    </div>
                    <p className="text-gray-500 text-xs leading-relaxed">{scene.desc}</p>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Connector arrows between scenes */}
          <div className="hidden lg:flex justify-center items-center gap-0 mt-4 px-8">
            {SHOW_SCENES.map((_, i) => i < SHOW_SCENES.length - 1 && (
              <React.Fragment key={i}>
                <div className="flex-1" />
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.6 + i * 0.1 }}
                  className="text-gray-700 text-lg font-bold mx-2"
                >
                  →
                </motion.div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOLOGRAM TECHNOLOGY GUIDE ────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 70% 50%, rgba(139,92,246,0.05) 0%, transparent 55%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Technology Guide"
              title="Choose Your Display Technology"
              subtitle="The right technology for your hologram show depends on venue type, audience size, and artistic vision. Here is the complete breakdown."
            />
          </motion.div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-12">
            {HOLO_TECHNOLOGIES.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, y: 35 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.11 }}
              >
                <GlassCard
                  className="p-6 h-full relative"
                  glowColor={tech.recommended ? `${tech.color}28` : `${tech.color}0e`}
                >
                  {tech.recommended && (
                    <motion.div
                      className="absolute -top-3 left-1/2 -translate-x-1/2"
                      animate={{ y: [0, -2, 0] }}
                      transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                      <span className="px-3 py-1 rounded-full text-xs font-bold text-black whitespace-nowrap"
                        style={{ background: tech.color, boxShadow: `0 0 20px ${tech.color}60` }}>
                        ⭐ Recommended
                      </span>
                    </motion.div>
                  )}

                  <div className="text-4xl mb-4 mt-2">{tech.icon}</div>
                  <h3 className="font-black text-base mb-1"
                    style={{ color: tech.recommended ? tech.color : '#fff' }}>{tech.name}</h3>
                  <p className="text-xs mb-5 font-medium" style={{ color: `${tech.color}80` }}>{tech.tagline}</p>

                  <ul className="space-y-2.5 mb-4">
                    {tech.pros.map((pro) => (
                      <li key={pro} className="flex items-start gap-2 text-xs text-gray-300">
                        <span className="text-green-400 flex-shrink-0 mt-0.5 font-bold">✓</span>
                        {pro}
                      </li>
                    ))}
                  </ul>

                  {tech.limitation && (
                    <div className="mt-auto pt-4 border-t border-white/5">
                      <p className="text-xs text-yellow-700/80 flex items-start gap-1.5 leading-relaxed">
                        <span className="flex-shrink-0 mt-0.5">⚠</span>
                        {tech.limitation}
                      </p>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* Technical message + Open Brief button */}
          <motion.div
            initial={{ opacity: 0, y: 25 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, delay: 0.3 }}
          >
            <GlassCard className="p-6 md:p-8" glowColor="rgba(0,212,255,0.14)">
              <div className="flex flex-col md:flex-row gap-6 md:items-center">
                <div className="flex-1">
                  <div className="text-xs font-bold tracking-[0.2em] uppercase mb-4" style={{ color: '#00D4FF' }}>
                    Technical Message — Copy & Send to Your Venue / Provider
                  </div>
                  <blockquote className="text-gray-300 text-sm leading-relaxed italic border-l-2 pl-4"
                    style={{ borderColor: 'rgba(0,212,255,0.4)' }}>
                    "The virtual artist must be able to appear at true human scale in certain moments of the show, and at enlarged scale in others. We need a visualization system capable of representing a 3D character at real size in a credible way, as well as amplifying their visual presence during specific cues in the repertoire."
                  </blockquote>
                </div>
                <div className="flex flex-col gap-3 flex-shrink-0">
                  <motion.button
                    onClick={openTechnicalBrief}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.97 }}
                    className="inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl font-bold text-sm text-black shadow-lg"
                    style={{
                      background: 'linear-gradient(135deg, #00D4FF, #0099CC)',
                      boxShadow: '0 0 30px rgba(0,212,255,0.3)',
                    }}
                  >
                    <FileText className="w-4 h-4" />
                    Open Technical Brief
                  </motion.button>
                  <p className="text-center text-gray-600 text-xs">Opens full guide in new tab</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ─── PRODUCTION PIPELINE ──────────────────────────────────────────── */}
      <section id="pipeline" className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.025)' }}>
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(139,92,246,0.06) 0%, transparent 50%)' }} />
        </div>
        <div className="max-w-4xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Production Pipeline"
              title="Complete Technical Workflow"
              subtitle="From your first photo reference to going live in any venue on earth — this is every step of the production path."
            />
          </motion.div>

          <div className="relative">
            {/* Vertical connecting line */}
            <motion.div
              className="absolute left-[31px] top-4 bottom-4 w-px hidden md:block"
              style={{ background: 'linear-gradient(to bottom, rgba(0,212,255,0.4), rgba(255,122,0,0.2), transparent)' }}
              initial={{ scaleY: 0, originY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />

            <div className="space-y-3">
              {PIPELINE_STEPS.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.09 }}
                  className="flex items-center gap-5"
                >
                  {/* Step dot */}
                  <div className="hidden md:flex w-16 justify-center flex-shrink-0">
                    <motion.div
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0 relative z-10"
                      style={{ borderColor: step.color, background: `${step.color}20` }}
                      whileInView={{ scale: [0, 1.4, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.09 + 0.2 }}
                    >
                      <motion.div
                        className="absolute inset-1 rounded-full"
                        style={{ background: step.color }}
                        animate={{ opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}
                      />
                    </motion.div>
                  </div>

                  <GlassCard className="flex-1 px-5 py-4 flex items-center gap-4" glowColor={`${step.color}10`}>
                    <span className="text-xs font-black flex-shrink-0 w-6" style={{ color: `${step.color}55` }}>
                      {step.step}
                    </span>
                    <div className="w-px h-7 flex-shrink-0" style={{ background: `${step.color}25` }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">{step.name}</div>
                      <div className="text-gray-500 text-xs mt-0.5 truncate">{step.detail}</div>
                    </div>
                    <motion.div
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: step.color }}
                      animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                    />
                  </GlassCard>
                </motion.div>
              ))}
            </div>

            {/* Final GO LIVE badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.75 }}
              className="mt-8 md:ml-20"
            >
              <motion.div
                className="text-center py-7 rounded-2xl border"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,122,0,0.1), rgba(139,92,246,0.07))',
                  borderColor: 'rgba(255,122,0,0.35)',
                  boxShadow: '0 0 40px rgba(255,122,0,0.1)',
                }}
                animate={{ boxShadow: ['0 0 30px rgba(255,122,0,0.1)', '0 0 60px rgba(255,122,0,0.2)', '0 0 30px rgba(255,122,0,0.1)'] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <div className="text-4xl mb-2">🌐</div>
                <div className="font-black text-2xl text-white">LIVE WORLDWIDE</div>
                <div className="text-gray-500 text-sm mt-2">195+ countries · Unlimited simultaneous venues · Any format</div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      <ChapterBreak
        text="Every world-class show starts with one decision."
        sub="Choose your production package. We handle everything from here."
        accent="#FF7A00"
      />

      {/* ─── PACKAGES ─────────────────────────────────────────────────────── */}
      <section id="packages" className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Pricing"
              title="Choose Your Show Package"
              subtitle="From independent artist premieres to full arena legacy productions."
            />
          </motion.div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {PACKAGES.map((pkg, i) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
                className="flex flex-col"
              >
                <div
                  className={`relative rounded-2xl border flex flex-col h-full ${pkg.highlight ? 'border-orange-500/60' : 'border-white/10'}`}
                  style={{
                    background: pkg.highlight
                      ? 'linear-gradient(135deg, rgba(255,122,0,0.12) 0%, rgba(5,5,5,0.9) 100%)'
                      : 'rgba(5,5,5,0.7)',
                    boxShadow: pkg.highlight ? '0 0 60px rgba(255,122,0,0.2)' : 'none',
                  }}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full text-xs font-bold text-black"
                        style={{ background: pkg.highlight ? '#FF7A00' : pkg.color }}>
                        {pkg.badge}
                      </span>
                    </div>
                  )}
                  <div className="p-6 flex flex-col h-full">
                    <h3 className="text-lg font-black text-white mb-1">{pkg.name}</h3>
                    <p className="text-gray-500 text-xs mb-4 leading-relaxed">{pkg.description}</p>
                    <div className="mb-6">
                      <span className="text-4xl font-black" style={{ color: pkg.color }}>{pkg.price}</span>
                      <span className="text-gray-500 text-sm ml-2">{pkg.period}</span>
                    </div>
                    <ul className="space-y-2.5 flex-1 mb-6">
                      {pkg.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5 text-sm text-gray-300">
                          <Check className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: pkg.color }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <a href="#request-demo"
                      className={`block text-center py-3 px-4 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 ${pkg.highlight ? 'text-black' : 'text-white border border-current'}`}
                      style={pkg.highlight
                        ? { background: '#FF7A00' }
                        : { borderColor: `${pkg.color}60`, color: pkg.color, background: `${pkg.color}0a` }}>
                      Get Started
                    </a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── TARGET CLIENTS ───────────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative" style={{ background: 'rgba(0,212,255,0.02)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Who Is This For"
              title="Built for Every Stage of the Industry"
              subtitle="The Hologram Live Show Engine serves artists, estates, brands, platforms, and cultural institutions."
            />
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {TARGET_CLIENTS.map((client, i) => (
              <motion.div
                key={client.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
              >
                <GlassCard className="p-4 text-center h-full hover:border-white/20 transition-colors" glowColor="rgba(0,212,255,0.06)">
                  <client.icon className="w-7 h-7 mx-auto mb-2.5" style={{ color: '#00D4FF' }} />
                  <p className="font-semibold text-white text-sm mb-1">{client.label}</p>
                  <p className="text-gray-600 text-xs leading-tight">{client.desc}</p>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── BOOSTIFY ADVANTAGE ───────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Why Boostify"
              title="The Boostify Advantage"
              subtitle="We are the only platform that combines AI artist development, distribution, monetization, AND hologram live show production in one integrated ecosystem."
            />
            <div className="grid md:grid-cols-2 gap-6">
              {[
                { title: "Full-Stack Music Infrastructure", desc: "Your hologram show connects directly to Boostify's distribution, analytics, fan engagement, and monetization tools. Every performance feeds back into your career.", icon: Layers, color: "#FF7A00" },
                { title: "AI-Native Production", desc: "Boostify's proprietary production pipeline integrates FAL AI, FLUX, and our in-house motion AI — cutting production time and cost versus traditional agencies.", icon: Cpu, color: "#00D4FF" },
                { title: "Rights-First Approach", desc: "Our legal and ethics protocols protect artists and estates. Every production starts with proper consent, and IP ownership always stays with you.", icon: Shield, color: "#8B5CF6" },
                { title: "Global Venue Network", desc: "Through our partnerships, your hologram show can be deployed to venues, platforms, and events worldwide — without you lifting a finger.", icon: Globe, color: "#FF7A00" },
              ].map((item) => (
                <GlassCard key={item.title} className="p-6 flex gap-5" glowColor={`${item.color}10`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}28` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <div>
                    <h3 className="font-bold text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── TECH STACK ───────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.02)' }}>
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Technology"
              title="The Stack Behind the Magic"
            />
          </motion.div>
          <div className="flex flex-wrap justify-center gap-3">
            {TECH_STACK.map((tech, i) => (
              <motion.div
                key={tech.name}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
              >
                <div className="px-4 py-2.5 rounded-lg border text-center"
                  style={{
                    borderColor: `${tech.color}30`,
                    background: `${tech.color}08`,
                  }}>
                  <div className="font-bold text-white text-sm">{tech.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: tech.color }}>{tech.category}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading eyebrow="FAQ" title="Frequently Asked Questions" />
          </motion.div>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <GlassCard className="overflow-hidden" glowColor="rgba(255,122,0,0.05)">
                  <button
                    className="w-full flex items-center justify-between p-5 text-left gap-4"
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  >
                    <span className="font-semibold text-white text-sm">{faq.q}</span>
                    {faqOpen === i
                      ? <ChevronUp className="w-5 h-5 text-orange-400 flex-shrink-0" />
                      : <ChevronDown className="w-5 h-5 text-gray-500 flex-shrink-0" />}
                  </button>
                  <AnimatePresence>
                    {faqOpen === i && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <p className="px-5 pb-5 text-gray-400 text-sm leading-relaxed">{faq.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── ARTIST PROFILE CTA ───────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={sectionVariants}
          >
            <div
              className="rounded-2xl overflow-hidden relative"
              style={{
                background: 'linear-gradient(135deg, rgba(255,122,0,0.08) 0%, rgba(139,92,246,0.08) 50%, rgba(0,212,255,0.06) 100%)',
                border: '1px solid rgba(255,122,0,0.25)',
                boxShadow: '0 0 60px rgba(255,122,0,0.08)',
              }}
            >
              {/* Glow blobs */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-12 -left-12 w-48 h-48 rounded-full blur-3xl opacity-20"
                  style={{ background: '#FF7A00' }} />
                <div className="absolute -bottom-12 -right-12 w-48 h-48 rounded-full blur-3xl opacity-15"
                  style={{ background: '#8B5CF6' }} />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 p-8 sm:p-10">
                {/* Icon side */}
                <div className="flex-shrink-0 flex flex-col items-center gap-3">
                  <div
                    className="w-20 h-20 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,122,0,0.12)', border: '1px solid rgba(255,122,0,0.3)' }}
                  >
                    <Monitor className="w-10 h-10" style={{ color: '#FF7A00' }} />
                  </div>
                  <div className="flex gap-1.5">
                    {['#FF7A00', '#8B5CF6', '#00D4FF'].map((c) => (
                      <div key={c} className="w-2 h-2 rounded-full" style={{ background: c }} />
                    ))}
                  </div>
                </div>

                {/* Text side */}
                <div className="flex-1 text-center md:text-left">
                  <p className="text-xs font-bold tracking-widest uppercase mb-2"
                    style={{ color: '#FF7A00' }}>
                    For Boostify Artists
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-3 leading-tight">
                    Launch Your Hologram Project{' '}
                    <span style={{ background: 'linear-gradient(135deg,#FF7A00,#FFB347)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      Directly from Your Profile
                    </span>
                  </h3>
                  <p className="text-gray-400 text-sm sm:text-base leading-relaxed mb-6 max-w-lg">
                    Already on Boostify? Head to your Artist Profile, open the{' '}
                    <strong className="text-white">Hologram Live Show</strong> section, capture your reference
                    photos, configure your production, and connect straight to this page — all pre-filled
                    with your artist data.
                  </p>

                  {/* Feature pills */}
                  <div className="flex flex-wrap gap-2 mb-6 justify-center md:justify-start">
                    {[
                      { label: '📸 Photo capture tools', color: '#FF7A00' },
                      { label: '⚡ Auto artist pre-fill', color: '#8B5CF6' },
                      { label: '🎭 Package configurator', color: '#00D4FF' },
                    ].map((pill) => (
                      <span
                        key={pill.label}
                        className="px-3 py-1 rounded-full text-xs font-semibold"
                        style={{ background: `${pill.color}14`, color: pill.color, border: `1px solid ${pill.color}30` }}
                      >
                        {pill.label}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                    <a
                      href="/dashboard"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-black transition-all hover:scale-105 active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB347)', boxShadow: '0 0 24px rgba(255,122,0,0.3)' }}
                    >
                      <Star className="w-4 h-4" />
                      Go to My Artist Profile
                    </a>
                    <a
                      href="#request-demo"
                      className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border text-white transition-all hover:border-white/30"
                      style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }}
                    >
                      Or fill the form below
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── XR STUDIO GATEWAY ────────────────────────────────────────────── */}
      <section id="xr-studio" className="py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.025)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 60% 40%, rgba(139,92,246,0.1) 0%, transparent 60%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <div className="text-center mb-10">
              <span className="inline-block text-[10px] sm:text-xs font-semibold tracking-[0.22em] uppercase mb-3 px-3 py-1.5 rounded-full border"
                style={{ color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)' }}>
                Boostify XR Studio
              </span>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
                VR · Motion Capture · Character Creation · Boostify XR Engine
              </h2>
              <p className="text-base sm:text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
                Beyond the hologram stage — our full XR Studio gives artists the complete toolkit to dominate every dimension of digital entertainment.
              </p>
            </div>
          </motion.div>

          {/* Character Shader Showcase */}
          <CharacterShaderShowcase />

          {/* 6 XR service preview cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {[
              {
                icon: Gamepad2,
                color: "#8B5CF6",
                title: "Virtual Reality Experiences",
                desc: "Immersive VR concerts, fan meet-and-greets, and metaverse performance arenas — accessible from anywhere on earth.",
                stat: "1M+ fans simultaneously",
              },
              {
                icon: Activity,
                color: "#00D4FF",
                title: "Full-Body Motion Capture",
                desc: "Professional optical MoCap sessions — 60+ marker full-body and facial capture. Your performance library, preserved forever.",
                stat: "200+ animations",
                badge: "Most Requested",
              },
              {
                icon: Box,
                color: "#FF7A00",
                title: "Character Creation",
                desc: "Photorealistic 3D digital avatar built inside Boostify's proprietary pipeline — custom sculpt, PBR textures, full body rig, and 52+ expression shapes.",
                stat: "Boostify studio fidelity",
              },
              {
                icon: Monitor,
                color: "#8B5CF6",
                title: "Boostify XR Render Engine",
                desc: "Cinematic real-time virtual environments, volumetric lighting, particle systems, and multi-screen output — built and operated 100% inside Boostify's own render stack.",
                stat: "Up to 8K output",
              },
              {
                icon: Eye,
                color: "#00D4FF",
                title: "XR Live Performances",
                desc: "Mixed reality broadcasts, AR in-venue fan experiences, and LED volume stage productions — all orchestrated through Boostify's live show control system.",
                stat: "Broadcast-quality output",
              },
              {
                icon: Sparkles,
                color: "#FF7A00",
                title: "AI-Powered Animation",
                desc: "Generate music videos, animated stage content, and performance visuals at scale using Boostify's proprietary AI animation pipeline.",
                stat: "Days, not months",
              },
            ].map((svc, i) => (
              <motion.div
                key={svc.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              >
                <GlassCard className="p-5 h-full relative" glowColor={`${svc.color}10`}>
                  {svc.badge && (
                    <div className="absolute -top-3 left-4">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: svc.color, color: '#000' }}>
                        {svc.badge}
                      </span>
                    </div>
                  )}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${svc.color}15`, border: `1px solid ${svc.color}30` }}>
                    <svc.icon className="w-5 h-5" style={{ color: svc.color }} />
                  </div>
                  <h3 className="font-bold text-white text-sm mb-1.5">{svc.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-3">{svc.desc}</p>
                  <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: svc.color }}>
                    <motion.div className="w-1.5 h-1.5 rounded-full" style={{ background: svc.color }}
                      animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 2, repeat: Infinity }} />
                    {svc.stat}
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>

          {/* CTA to full XR Studio page */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-center"
          >
            <div
              className="inline-block rounded-2xl p-px"
              style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.6), rgba(0,212,255,0.4), rgba(255,122,0,0.3))' }}
            >
              <div className="rounded-2xl px-8 py-6 text-center" style={{ background: '#070707' }}>
                <p className="text-gray-400 text-sm mb-4">
                  Ready to dominate the XR market? Explore the full suite of services →
                </p>
                <a
                  href="/vr-studio"
                  className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl font-bold text-base text-white transition-all hover:scale-105 active:scale-95"
                  style={{
                    background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)',
                    boxShadow: '0 0 40px rgba(139,92,246,0.4)',
                  }}
                >
                  <Sparkles className="w-5 h-5" />
                  Open XR Studio — Full Service Suite
                  <ArrowRight className="w-5 h-5" />
                </a>
                <p className="text-gray-700 text-xs mt-3">VR · Motion Capture · Character Creation · Boostify XR Engine · AI Animation</p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── LEAD CAPTURE FORM ────────────────────────────────────────────── */}
      <section id="request-demo" className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,122,0,0.07) 0%, transparent 70%)' }} />
        </div>
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Let's Build Your Show"
              title="Request a Hologram Show Demo"
              subtitle="Fill out the form below and our production team will contact you within 24 hours to discuss your project."
            />
          </motion.div>

          {formStatus === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <CheckCircle2 className="w-16 h-16 mx-auto mb-6" style={{ color: '#22c55e' }} />
              <h3 className="text-2xl font-black text-white mb-4">Request Received</h3>
              <p className="text-gray-400 text-lg">Our production team will contact you within 24 hours to discuss your Hologram Show project.</p>
            </motion.div>
          ) : (
            <GlassCard className="p-8" glowColor="rgba(255,122,0,0.15)">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => updateForm('name', e.target.value)}
                      placeholder="Artist or contact name"
                      required
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors focus:border-orange-500/60"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => updateForm('email', e.target.value)}
                      placeholder="your@email.com"
                      required
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors focus:border-orange-500/60"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => updateForm('phone', e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Artist or Company Name</label>
                    <input
                      type="text"
                      value={formData.companyOrArtist}
                      onChange={(e) => updateForm('companyOrArtist', e.target.value)}
                      placeholder="Your artist or organization"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">I Am A...</label>
                    <select
                      value={formData.clientType}
                      onChange={(e) => updateForm('clientType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">Select client type</option>
                      <option value="recording_artist">Recording Artist</option>
                      <option value="music_estate">Music Estate / Legacy</option>
                      <option value="record_label">Record Label</option>
                      <option value="entertainment_company">Entertainment Company</option>
                      <option value="festival_organizer">Festival Organizer</option>
                      <option value="streaming_platform">Streaming Platform</option>
                      <option value="brand_agency">Brand / Agency</option>
                      <option value="film_tv">Film / TV Production</option>
                      <option value="talent_agency">Talent Agency</option>
                      <option value="theme_park">Theme Park / Attraction</option>
                      <option value="museum_institution">Museum / Institution</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Experience Type</label>
                    <select
                      value={formData.experienceType}
                      onChange={(e) => updateForm('experienceType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">Select experience type</option>
                      <option value="hologram_stage">Hologram Stage Show</option>
                      <option value="led_wall_show">LED Wall Virtual Performance</option>
                      <option value="streaming_only">Streaming-Only Digital Concert</option>
                      <option value="multi_venue_tour">Multi-Venue Simultaneous Tour</option>
                      <option value="catalog_revival">Catalog Revival (Legacy Artist)</option>
                      <option value="brand_event">Brand / Corporate Event</option>
                      <option value="museum_installation">Permanent Installation</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Number of Songs in Setlist</label>
                    <input
                      type="number"
                      value={formData.numberOfSongs}
                      onChange={(e) => updateForm('numberOfSongs', parseInt(e.target.value) || 1)}
                      min={1}
                      max={100}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Budget Range</label>
                    <select
                      value={formData.budgetRange}
                      onChange={(e) => updateForm('budgetRange', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">Select budget range</option>
                      <option value="under_5k">Under $5,000</option>
                      <option value="5k_15k">$5,000 – $15,000</option>
                      <option value="15k_50k">$15,000 – $50,000</option>
                      <option value="50k_100k">$50,000 – $100,000</option>
                      <option value="over_100k">$100,000+</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Timeline</label>
                    <select
                      value={formData.timeline}
                      onChange={(e) => updateForm('timeline', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                      <option value="">Select timeline</option>
                      <option value="asap">As soon as possible</option>
                      <option value="1_month">Within 1 month</option>
                      <option value="3_months">Within 3 months</option>
                      <option value="6_months">Within 6 months</option>
                      <option value="planning">Early planning stage</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-3 pt-2">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hasAvatar}
                        onChange={(e) => updateForm('hasAvatar', e.target.checked)}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-gray-300 text-sm">We already have a 3D avatar</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.needsAvatarCreation}
                        onChange={(e) => updateForm('needsAvatarCreation', e.target.checked)}
                        className="w-4 h-4 rounded accent-orange-500"
                      />
                      <span className="text-gray-300 text-sm">We need avatar creation</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Tell Us About Your Project</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => updateForm('message', e.target.value)}
                    placeholder="Describe your vision, the artist, any existing assets, or specific requirements..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>

                {formStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/30 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Something went wrong. Please try again or contact us directly.
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formStatus === 'sending' || !formData.name.trim() || !formData.email.trim()}
                  className="w-full py-4 rounded-xl font-bold text-base text-black flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB347)' }}
                >
                  {formStatus === 'sending' ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending Request...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Submit Request — Our Team Will Contact You in 24h
                    </>
                  )}
                </button>

                <p className="text-center text-gray-600 text-xs">
                  By submitting, you agree to our{' '}
                  <a href="/terms" className="text-gray-500 hover:text-gray-400 underline">Terms of Service</a>.
                  {' '}We never share your information.
                </p>
              </form>
            </GlassCard>
          )}
        </div>
      </section>

      {/* ─── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 text-center relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(255,122,0,0.08) 0%, transparent 60%)' }} />
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-4xl mb-6">⚡</div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            The Future of Live Music Is Digital
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Don't wait for technology to overtake you. Build your holographic presence now and own the next era of entertainment.
          </p>
          <a
            href="#request-demo"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 text-black"
            style={{ background: 'linear-gradient(135deg, #FF7A00, #FFB347)' }}
          >
            Start Your Hologram Show
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ─── HoloStage Studio Overlay ──────────────────────────────────── */}
      {studioOpen && (
        <div
          className="fixed inset-0 z-50"
          style={{ background: '#000' }}
        >
          <HoloStageDashboard onExit={() => setStudioOpen(false)} initialCharacter={artistCharacter} />
        </div>
      )}

      {/* ─── Admin: FAL Asset Regeneration Widget ─────────────────────── */}
      {typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('admin') === 'true' && (
        <div
          className="fixed bottom-6 right-6 z-50 flex flex-col gap-3"
          style={{ maxWidth: 280 }}
        >
          {/* Asset status */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold"
            style={{
              background: 'rgba(5,5,5,0.92)',
              border: `1px solid ${assetsData?.assets && Object.keys(assetsData.assets).length > 0 ? 'rgba(74,222,128,0.4)' : 'rgba(255,122,0,0.4)'}`,
              color: assetsData?.assets && Object.keys(assetsData.assets).length > 0 ? '#4ade80' : '#FF7A00',
              backdropFilter: 'blur(12px)',
            }}
          >
            <div
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{
                background: assetsData?.assets && Object.keys(assetsData.assets).length > 0 ? '#4ade80' : '#FF7A00',
                boxShadow: `0 0 6px ${assetsData?.assets && Object.keys(assetsData.assets).length > 0 ? '#4ade80' : '#FF7A00'}`,
              }}
            />
            {assetsLoading ? 'Loading assets…' : assetsData?.assets && Object.keys(assetsData.assets).length > 0
              ? `FAL Assets: ${Object.keys(assetsData.assets).length} cached`
              : 'FAL Assets: using fallback'}
          </div>

          {/* Regenerate button */}
          <button
            onClick={() => generateAssetsMutation.mutate()}
            disabled={generateAssetsMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: generateAssetsMutation.isPending
                ? 'rgba(255,122,0,0.2)'
                : 'linear-gradient(135deg,#FF7A00,#FFB347)',
              color: generateAssetsMutation.isPending ? '#FF7A00' : '#000',
              border: '1px solid rgba(255,122,0,0.4)',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 0 20px rgba(255,122,0,0.25)',
            }}
          >
            {generateAssetsMutation.isPending ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Generating with FAL AI…
              </>
            ) : generateAssetsMutation.isSuccess ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                Generation Started!
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Regenerate AI Assets
              </>
            )}
          </button>
          <p className="text-[9px] text-gray-700 text-right">
            Admin panel · ?admin=true
          </p>
        </div>
      )}

    </div>
  );
}
