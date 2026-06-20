import React, { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Cpu, Globe, Zap, Star, ChevronDown, ChevronUp,
  Check, ArrowRight, Play, Users, Layers, Mic2, Video,
  Film, Phone, Mail, Send, AlertCircle, CheckCircle2,
  Loader2, Eye, Shield, BarChart3, Sparkles, Monitor,
  Camera, Box, Gamepad2, Activity, Calculator, X, Link,
  Headphones, Wifi, Radio,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VRLeadFormData {
  name: string;
  email: string;
  phone: string;
  companyOrArtist: string;
  serviceInterest: string;
  projectType: string;
  budgetRange: string;
  timeline: string;
  message: string;
}

// ─── Background FX ────────────────────────────────────────────────────────────

function VRGrid() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      {/* Hex-style grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139,92,246,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139,92,246,0.06) 1px, transparent 1px)
          `,
          backgroundSize: '80px 80px',
        }}
      />
      {/* Diagonal scan line */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(transparent 40%, rgba(139,92,246,0.04) 50%, transparent 60%)',
        }}
        animate={{ backgroundPositionY: ['0%', '100%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
      {/* Ambient glows */}
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #8B5CF6 0%, transparent 70%)' }} />
      <div className="absolute top-1/2 right-1/5 w-96 h-96 rounded-full opacity-8 blur-3xl"
        style={{ background: 'radial-gradient(circle, #00D4FF 0%, transparent 70%)' }} />
      <div className="absolute bottom-1/4 left-1/2 w-80 h-80 rounded-full opacity-6 blur-3xl"
        style={{ background: 'radial-gradient(circle, #FF7A00 0%, transparent 70%)' }} />
    </div>
  );
}

function FloatingOrbs() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${(i * 17 + 7) % 100}%`,
            top: `${(i * 23 + 11) % 100}%`,
            width: i % 4 === 0 ? '3px' : '1.5px',
            height: i % 4 === 0 ? '3px' : '1.5px',
            background: i % 3 === 0 ? '#8B5CF6' : i % 3 === 1 ? '#00D4FF' : '#FF7A00',
          }}
          animate={{
            y: [0, -40, 0],
            opacity: [0, 0.8, 0],
            scale: [0, 1, 0],
          }}
          transition={{
            duration: 3 + (i % 4),
            repeat: Infinity,
            delay: (i * 0.37) % 5,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  );
}

// ─── Reusable components ──────────────────────────────────────────────────────

function GlassCard({ children, className = "", glowColor = "rgba(139,92,246,0.15)" }: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 backdrop-blur-sm ${className}`}
      style={{
        background: 'rgba(5,5,5,0.75)',
        boxShadow: `0 0 40px ${glowColor}, inset 0 1px 0 rgba(255,255,255,0.05)`,
      }}
    >
      {children}
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle, accentColor = "#8B5CF6" }: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  accentColor?: string;
}) {
  return (
    <div className="text-center mb-10 sm:mb-16 px-2">
      <span
        className="inline-block text-[10px] sm:text-xs font-semibold tracking-[0.22em] uppercase mb-3 sm:mb-4 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full border"
        style={{ color: accentColor, borderColor: `${accentColor}50`, background: `${accentColor}10` }}
      >
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

// ─── Service Data ─────────────────────────────────────────────────────────────

const CORE_SERVICES = [
  {
    id: "vr",
    icon: Gamepad2,
    color: "#8B5CF6",
    title: "Virtual Reality Experiences",
    tagline: "Immersive worlds. Zero physical limits.",
    desc: "Build fully immersive VR concerts, fan meet-and-greets, backstage tours, and metaverse performance arenas that fans can enter from anywhere on earth — with a headset or through WebXR in a browser.",
    features: [
      "VR concert halls & metaverse stages",
      "Multi-user fan interaction rooms",
      "Immersive music video environments",
      "WebXR browser-compatible (no headset required)",
      "Quest / PSVR / Valve Index support",
      "Spatial audio with Dolby Atmos integration",
      "Live event streaming into VR space",
      "NFT-gated VIP VR experiences",
    ],
    deliverables: ["VR app build (Meta Quest + WebXR)", "360° concert film", "Spatial audio mix", "Fan interaction system"],
    highlight: false,
  },
  {
    id: "mocap",
    icon: Activity,
    color: "#00D4FF",
    title: "Motion Capture",
    tagline: "Your body. Your performance. Digital forever.",
    desc: "Professional full-body and facial motion capture sessions that translate your artist's unique movement, energy, and expression into a digital performance library — used for avatars, holograms, animated videos, and real-time shows.",
    features: [
      "Full-body optical MoCap (60+ marker suit)",
      "Facial capture (performance-grade FACS)",
      "Hand & finger tracking",
      "Live MoCap preview in Boostify Engine",
      "Custom animation library (50–200 moves)",
      "Dance choreography capture",
      "Real-time re-targeting to any 3D rig",
      "AI-enhanced motion cleanup & retiming",
    ],
    deliverables: ["BVH / FBX animation library", "Facial FACS data", "Boostify HoloStage exports", "Character control rig"],
    highlight: true,
  },
  {
    id: "character",
    icon: Box,
    color: "#FF7A00",
    title: "Character Creation",
    tagline: "Your digital identity. Built to last forever.",
    desc: "We craft photorealistic 3D digital artist avatars from scratch — face scans, body references, custom clothing, and a full expression library. Your digital twin, ready for every platform, show, and media format.",
    features: [
      "Photorealistic face mesh (ZBrush sculpt)",
      "Skin detail: pores, subsurface, micro-normal",
      "Custom expression shapes (52+ FACS blendshapes)",
      "Hair simulation (Strand-based or card)",
      "Full body rig with IK/FK controls",
      "PBR texture maps (Albedo, Normal, Roughness, SSS)",
      "Custom wardrobe & stage outfits",
      "Multiple age/era variants (catalog revival)",
    ],
    deliverables: ["High-poly + game-res mesh", "Full texture sets", "Rigged .FBX/.GLB", "Expression library"],
    highlight: false,
  },
  {
    id: "boostify-engine",
    icon: Cpu,
    color: "#8B5CF6",
    title: "Boostify AI Production Engine",
    tagline: "Boostify's proprietary AI visual production system.",
    desc: "Boostify's own AI Production Engine powers real-time virtual stages, cinematic sequences, and live XR shows — fully self-contained, no third-party engine dependency. Built to run on our cloud infrastructure and HoloStage platform at any scale.",
    features: [
      "Boostify HoloStage real-time renderer",
      "AI-driven dynamic lighting & atmosphere",
      "Procedural stage generation from prompts",
      "Virtual camera system & cinematics",
      "Physics simulation (cloth, hair, particles)",
      "Dynamic environment & weather systems",
      "Real-time ray tracing & reflections",
      "Multi-screen & LED volume output system",
    ],
    deliverables: ["Boostify HoloStage show package", "Pre-rendered 4K/8K sequences", "Multi-screen output config", "Real-time show build"],
    highlight: false,
  },
  {
    id: "xr",
    icon: Eye,
    color: "#00D4FF",
    title: "XR Live Performances",
    tagline: "Mixed reality that rewrites what a show can be.",
    desc: "Extended Reality live shows blend the physical and digital worlds in real time — holographic overlays over live performers, AR fan phone experiences, mixed reality broadcast productions, and LED volume stage integration.",
    features: [
      "Mixed Reality (MR) live broadcast",
      "AR phone experience for in-venue fans",
      "LED volume stage virtual production",
      "In-camera VFX (no green screen needed)",
      "Real-time world-tracking anchoring",
      "Synchronized multi-device AR shows",
      "Broadcast-quality output (SDI/NDI/HDMI)",
      "4K streaming-ready XR pipeline",
    ],
    deliverables: ["MR broadcast package", "AR app / WebAR experience", "LED volume content", "Broadcast signal chain"],
    highlight: false,
  },
  {
    id: "ai-animation",
    icon: Sparkles,
    color: "#FF7A00",
    title: "AI-Powered Animation",
    tagline: "Generate limitless performance content at scale.",
    desc: "Using cutting-edge AI tools, we generate animated performance content, music video scenes, and stage visuals at a fraction of traditional cost — photorealistic output delivered in days, not months.",
    features: [
      "AI video generation (Kling, Sora, Pika)",
      "Style-consistent animated music videos",
      "AI crowd & environment population",
      "AI-driven lyric video & visualizer creation",
      "Prompt-to-scene virtual stage generation",
      "AI upscaling to 4K/8K output",
      "Batch content production (albums, singles)",
      "Music-reactive AI visual engine",
    ],
    deliverables: ["Animated music videos", "AI stage content pack", "Lyric video", "Social short-form content"],
    highlight: false,
  },
];

// ─── Process Steps ────────────────────────────────────────────────────────────

const PRODUCTION_PROCESS = [
  {
    step: "01", color: "#8B5CF6",
    title: "Discovery & Vision Session",
    desc: "We start with a deep creative brief — understanding your artist identity, target experience, technical requirements, and commercial goals.",
    icon: Users,
  },
  {
    step: "02", color: "#00D4FF",
    title: "3D Reference & Body Scan",
    desc: "We collect photographic references, perform body scanning, and record your artist's performance footage as the data foundation.",
    icon: Camera,
  },
  {
    step: "03", color: "#FF7A00",
    title: "Character Build & Rigging",
    desc: "Our team sculpts the 3D character in ZBrush, textures in Substance Painter, and builds a production-ready rig for animation.",
    icon: Box,
  },
  {
    step: "04", color: "#8B5CF6",
    title: "Motion Capture Session",
    desc: "Full-body and facial MoCap recorded, cleaned, and retargeted to the character rig — creating a custom performance library.",
    icon: Activity,
  },
  {
    step: "05", color: "#00D4FF",
    title: "Boostify AI Stage Build",
    desc: "Your virtual world is assembled in Boostify's proprietary AI Production Engine — environments, lighting, particles, physics, and real-time systems built and deployed on our infrastructure.",
    icon: Cpu,
  },
  {
    step: "06", color: "#FF7A00",
    title: "XR / VR Integration",
    desc: "The performance environment is prepared for its target platform — VR headset app, mixed reality broadcast, or LED volume stage.",
    icon: Eye,
  },
  {
    step: "07", color: "#8B5CF6",
    title: "QA, Polish & Export",
    desc: "Full quality review, performance optimization, and multi-format export: show package, video renders, VR app, AR package.",
    icon: Shield,
  },
  {
    step: "08", color: "#00D4FF",
    title: "Launch & Global Deploy",
    desc: "Your XR experience goes live — distributed to venues, VR platforms, streaming services, and directly to fans worldwide.",
    icon: Globe,
  },
];

// ─── Packages ─────────────────────────────────────────────────────────────────

const VR_PACKAGES = [
  {
    name: "XR Starter",
    price: "$8,500",
    period: "one-time",
    color: "#00D4FF",
    highlight: false,
    badge: null,
    description: "Essential VR/XR production for independent artists entering the immersive space.",
    features: [
      "Photo-based 3D avatar (semi-realistic)",
      "1 VR environment / virtual stage",
      "30-minute MoCap session",
      "20-move animation library",
      "WebXR web experience",
      "1 AI-animated music video",
      "1080p/4K export",
      "14-day delivery",
    ],
  },
  {
    name: "Motion Pro",
    price: "$22,000",
    period: "one-time",
    color: "#8B5CF6",
    highlight: false,
    badge: null,
    description: "Full motion capture production + photorealistic avatar for artists ready to own their digital presence.",
    features: [
      "Full ZBrush photorealistic avatar",
      "Full-day MoCap session (body + face)",
      "80-move custom animation library",
      "3 VR environments / stage builds",
      "Boostify AI cinematic sequence (up to 3 min)",
      "2 AI-animated music videos",
      "4K export + AR experience",
      "30-day delivery",
    ],
  },
  {
    name: "Boostify Studio",
    price: "$45,000",
    period: "one-time",
    color: "#FF7A00",
    highlight: true,
    badge: "Most Powerful",
    description: "Complete AI virtual production suite — the full pipeline for artists and labels dominating the XR market with Boostify's proprietary engine.",
    features: [
      "Ultra-photorealistic avatar (cinema-grade)",
      "2-day full MoCap (200+ animation library)",
      "Custom Boostify AI virtual world",
      "AI dynamic lighting + procedural geometry",
      "Full XR live show build",
      "VR app (Meta Quest + WebXR)",
      "Mixed reality broadcast package",
      "LED volume stage content",
      "8K export + multi-format delivery",
      "45-day delivery",
    ],
  },
  {
    name: "XR Domination",
    price: "$120,000+",
    period: "custom",
    color: "#8B5CF6",
    highlight: false,
    badge: "Enterprise",
    description: "End-to-end XR empire — for labels, estates, and artists building permanent digital franchises.",
    features: [
      "Full Boostify AI digital twin",
      "Multi-day MoCap + library of 400+ moves",
      "Multiple AI virtual worlds + virtual tour",
      "Permanent VR fan platform / app",
      "Global XR live event infrastructure",
      "AR experiences for venue & mobile",
      "AI content engine (ongoing generation)",
      "Dedicated XR production team",
      "Fully custom timeline",
    ],
  },
];

// ─── Tech Stack ───────────────────────────────────────────────────────────────

const TECH_STACK = [
  { name: "Boostify AI Engine", category: "Proprietary Platform", color: "#8B5CF6" },
  { name: "Boostify HoloStage", category: "Live Show System", color: "#00D4FF" },
  { name: "Vicon / OptiTrack", category: "Optical MoCap", color: "#FF7A00" },
  { name: "ZBrush", category: "3D Sculpting", color: "#8B5CF6" },
  { name: "Substance Painter", category: "PBR Texturing", color: "#00D4FF" },
  { name: "Maya", category: "Rigging & Animation", color: "#FF7A00" },
  { name: "Kling / Sora AI", category: "AI Video Gen", color: "#8B5CF6" },
  { name: "FAL AI / FLUX", category: "Image AI", color: "#00D4FF" },
  { name: "WebXR API", category: "Browser VR/AR", color: "#FF7A00" },
  { name: "Meta Quest SDK", category: "VR Platform", color: "#8B5CF6" },
  { name: "LED Volume Output", category: "Stage Integration", color: "#00D4FF" },
  { name: "Dolby Atmos", category: "Spatial Audio", color: "#FF7A00" },
  { name: "NDI / SDI", category: "Live Signal Routing", color: "#8B5CF6" },
  { name: "Boostify AI Core", category: "Orchestration", color: "#00D4FF" },
];

// ─── Comparison Table ────────────────────────────────────────────────────────

const XR_COMPARISON = [
  { type: "VR", fullName: "Virtual Reality", color: "#8B5CF6", icon: Gamepad2, device: "Headset / WebXR", immersion: "100%", liveShow: true, avatar: true, fanAccess: "Global (headset or browser)", revenue: "Tickets · NFT gating · Merch" },
  { type: "AR", fullName: "Augmented Reality", color: "#00D4FF", icon: Eye, device: "Smartphone / Tablet", immersion: "Overlay", liveShow: true, avatar: false, fanAccess: "In-venue + mobile", revenue: "In-venue AR · Social filters" },
  { type: "MR", fullName: "Mixed Reality", color: "#FF7A00", icon: Monitor, device: "Broadcast / LED stage", immersion: "Blended", liveShow: true, avatar: true, fanAccess: "TV / Stream audience", revenue: "Broadcast · Sponsorship" },
  { type: "XR", fullName: "Extended Reality (All)", color: "#22c55e", icon: Layers, device: "All platforms", immersion: "Full stack", liveShow: true, avatar: true, fanAccess: "Universal (all devices)", revenue: "Full XR revenue stack" },
];

// ─── Project Estimator Data ──────────────────────────────────────────────────

const ESTIMATOR_OPTIONS = {
  service: [
    { id: "vr", label: "VR Experience", base: 8500 },
    { id: "mocap", label: "Motion Capture", base: 9500 },
    { id: "character", label: "3D Avatar / Character", base: 12000 },
    { id: "xr", label: "XR Live Show", base: 22000 },
    { id: "ai_animation", label: "AI Animation", base: 5000 },
    { id: "full_bundle", label: "Full XR Bundle", base: 45000 },
  ],
  quality: [
    { id: "starter", label: "Starter", mult: 1.0 },
    { id: "pro", label: "Professional", mult: 1.8 },
    { id: "cinema", label: "Cinema Grade", mult: 3.2 },
  ],
  extras: [
    { id: "vr_app", label: "Meta Quest VR App", add: 4500 },
    { id: "facial", label: "Facial FACS Capture", add: 3000 },
    { id: "holostage", label: "Boostify HoloStage Export", add: 2500 },
    { id: "webxr", label: "WebXR Browser Experience", add: 3500 },
    { id: "led_volume", label: "LED Volume Stage Output", add: 7500 },
  ],
};

// ─── Stats ────────────────────────────────────────────────────────────────────

const STATS = [
  { value: "8K", label: "Max Output Resolution" },
  { value: "200+", label: "MoCap Animations Included" },
  { value: "14–45", label: "Day Delivery Range" },
  { value: "6", label: "XR Service Categories" },
];

// ─── FAQ ──────────────────────────────────────────────────────────────────────

const FAQS = [
  {
    q: "Do I need to come to a physical studio for motion capture?",
    a: "For our full MoCap packages, we recommend an in-studio session at our production facility or one of our partner studios worldwide. However, for basic movement capture and AI-driven animation enhancement, remote video-based capture is available. Our team will advise the best approach for your project.",
  },
  {
    q: "What is the difference between VR and XR (Extended Reality)?",
    a: "VR (Virtual Reality) is a fully digital immersive experience — the user wears a headset and is transported to a virtual world. XR (Extended Reality) is an umbrella term that includes VR, AR (Augmented Reality, where digital elements overlay the physical world), and MR (Mixed Reality, which blends both). We offer all three under our XR services.",
  },
  {
    q: "Can a fan experience the show without a VR headset?",
    a: "Yes. All our VR environments are built with WebXR, meaning they can be experienced directly in a web browser in 2D or 3D on any device — no headset required. For the full immersive experience, any Meta Quest, PSVR, or SteamVR headset works.",
  },
  {
    q: "What do I need to provide for character creation?",
    a: "A minimum of 100 high-resolution reference photos from multiple angles, video footage of the artist in motion (performance, speaking, natural movement), and any specific costume or styling references. A 3D body scan is optional but significantly improves accuracy. We provide a full intake checklist at project start.",
  },
  {
    q: "Can I use the 3D avatar and MoCap data for other projects?",
    a: "Yes. You own 100% of your character assets and animation library. They can be used for music videos, games, NFTs, metaverse experiences, social media content, and any future productions — not just the initial project.",
  },
  {
    q: "How does the LED volume stage work?",
    a: "An LED volume stage is a large curved LED wall (and optionally LED ceiling/floor) that displays real-time 3D environments driven by Boostify's AI Engine. The artist performs in front of it, and cameras with real-time tracking blend the physical performer with the virtual world seamlessly — eliminating the need for green screen and enabling fully in-camera compositing.",
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

// ─── Project Estimator Component ────────────────────────────────────────────

function ProjectEstimator({ onClose }: { onClose: () => void }) {
  const [selectedService, setSelectedService] = useState('vr');
  const [selectedQuality, setSelectedQuality] = useState('pro');
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const svc = ESTIMATOR_OPTIONS.service.find(s => s.id === selectedService)!;
  const qual = ESTIMATOR_OPTIONS.quality.find(q => q.id === selectedQuality)!;
  const extrasTotal = selectedExtras.reduce((sum, id) => {
    return sum + (ESTIMATOR_OPTIONS.extras.find(e => e.id === id)?.add ?? 0);
  }, 0);
  const estimate = Math.round((svc.base * qual.mult + extrasTotal) / 500) * 500;

  const toggleExtra = (id: string) => {
    setSelectedExtras(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 30 }}
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-xl rounded-2xl p-6 overflow-y-auto max-h-[90vh]"
        style={{ background: '#0a0a0a', border: '1px solid rgba(139,92,246,0.3)', boxShadow: '0 0 60px rgba(139,92,246,0.2)' }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-white"><X className="w-5 h-5" /></button>
        <div className="flex items-center gap-3 mb-6">
          <Calculator className="w-5 h-5" style={{ color: '#8B5CF6' }} />
          <h3 className="text-xl font-black text-white">Project Cost Estimator</h3>
        </div>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: '#8B5CF6' }}>1. Select Service</label>
            <div className="grid grid-cols-2 gap-2">
              {ESTIMATOR_OPTIONS.service.map(s => (
                <button key={s.id} onClick={() => setSelectedService(s.id)}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold text-left transition-all"
                  style={selectedService === s.id
                    ? { background: 'rgba(139,92,246,0.2)', color: '#8B5CF6', border: '1px solid rgba(139,92,246,0.5)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: '#00D4FF' }}>2. Quality Tier</label>
            <div className="grid grid-cols-3 gap-2">
              {ESTIMATOR_OPTIONS.quality.map(q => (
                <button key={q.id} onClick={() => setSelectedQuality(q.id)}
                  className="px-3 py-2.5 rounded-xl text-sm font-semibold text-center transition-all"
                  style={selectedQuality === q.id
                    ? { background: 'rgba(0,212,255,0.15)', color: '#00D4FF', border: '1px solid rgba(0,212,255,0.5)' }
                    : { background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {q.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest mb-2 block" style={{ color: '#FF7A00' }}>3. Add-Ons (Optional)</label>
            <div className="space-y-1.5">
              {ESTIMATOR_OPTIONS.extras.map(ex => (
                <button key={ex.id} onClick={() => toggleExtra(ex.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={selectedExtras.includes(ex.id)
                    ? { background: 'rgba(255,122,0,0.12)', color: '#FF7A00', border: '1px solid rgba(255,122,0,0.4)' }
                    : { background: 'rgba(255,255,255,0.03)', color: '#666', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <span>{ex.label}</span>
                  <span className="font-bold">+${ex.add.toLocaleString()}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/10 text-center">
            <div className="text-xs text-gray-600 mb-1">Estimated Investment</div>
            <motion.div
              key={estimate}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-4xl font-black mb-1"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              ${estimate.toLocaleString()}
            </motion.div>
            <p className="text-xs text-gray-600 mb-5">Rough estimate · Final quote requires project brief</p>
            <a href="#contact" onClick={onClose}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 24px rgba(139,92,246,0.35)' }}>
              Request Exact Quote
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function VRStudioPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [activeService, setActiveService] = useState<string>("vr");
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [formTouched, setFormTouched] = useState(false);
  const [formData, setFormData] = useState<VRLeadFormData>({
    name: '', email: '', phone: '', companyOrArtist: '',
    serviceInterest: '', projectType: '', budgetRange: '', timeline: '', message: '',
  });
  const [showStickyCTA, setShowStickyCTA] = useState(false);
  const [showEstimator, setShowEstimator] = useState(false);

  // AI Image Showcase state
  const [showcaseImages, setShowcaseImages] = useState<Record<string, string | null>>({});
  const [loadingImages, setLoadingImages] = useState<Record<string, boolean>>({});
  const [showcaseStarted, setShowcaseStarted] = useState(false);
  const showcaseSectionRef = useRef<HTMLElement>(null);

  const AI_IMAGE_PROMPTS: Record<string, string> = {
    vr: "futuristic VR concert stage with holographic visuals, artist performing in immersive virtual arena, purple and cyan neon lighting, cinematic sci-fi atmosphere",
    mocap: "motion capture studio with glowing tracking markers on a performer, blue data streams visualizing body movement, dark professional environment",
    character: "photorealistic 3D digital artist avatar, hyper-detailed face with subsurface skin, studio lighting, floating holographic interface panels",
    "boostify-engine": "AI-powered virtual stage construction in real time, procedural digital architecture building itself, glowing purple neural network visuals",
    xr: "mixed reality live performance, holographic overlay on real stage, LED wall with XR visuals, crowd watching artist in extended reality",
    "ai-animation": "AI-generated animated music video scene, abstract digital art style, vibrant colors, cinematic frame with motion blur effects",
  };

  const generateShowcaseImages = useCallback(async () => {
    if (showcaseStarted) return;
    setShowcaseStarted(true);
    const serviceIds = CORE_SERVICES.map(s => s.id);
    for (let i = 0; i < serviceIds.length; i++) {
      const id = serviceIds[i];
      const prompt = AI_IMAGE_PROMPTS[id];
      if (!prompt) continue;
      setLoadingImages(prev => ({ ...prev, [id]: true }));
      await new Promise(r => setTimeout(r, i * 400));
      try {
        const data = await apiRequest('POST', '/api/vr-studio/generate-preview', { prompt, serviceId: id });
        if (data?.imageUrl) {
          setShowcaseImages(prev => ({ ...prev, [id]: data.imageUrl }));
        }
      } catch {
        // silently fail for showcase - just leave skeleton
      } finally {
        setLoadingImages(prev => ({ ...prev, [id]: false }));
      }
    }
  }, [showcaseStarted]);

  // Scroll listener for sticky CTA
  useEffect(() => {
    const onScroll = () => setShowStickyCTA(window.scrollY > 700);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Auto-trigger AI showcase when section is in view
  useEffect(() => {
    if (showcaseStarted) return;
    const el = showcaseSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        generateShowcaseImages();
        obs.disconnect();
      }
    }, { threshold: 0.15 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [showcaseStarted, generateShowcaseImages]);

  const leadMutation = useMutation({
    mutationFn: (data: VRLeadFormData) =>
      apiRequest('POST', '/api/vr-studio/leads', data),
    onSuccess: () => setFormStatus('success'),
    onError: () => setFormStatus('error'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormTouched(true);
    if (!formData.name.trim() || !formData.email.trim()) return;
    setFormStatus('sending');
    leadMutation.mutate(formData);
  };

  const updateForm = (field: keyof VRLeadFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const sectionVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: 'easeOut' as const } },
  };

  const activeServiceData = CORE_SERVICES.find(s => s.id === activeService) ?? CORE_SERVICES[0];

  // inline validation border style
  const fieldBorder = (val: string) => {
    if (!formTouched) return 'rgba(255,255,255,0.1)';
    return val.trim() ? 'rgba(139,92,246,0.5)' : 'rgba(239,68,68,0.6)';
  };

  return (
    <div className="min-h-screen text-white" style={{ background: '#050505', fontFamily: "'Inter', sans-serif" }}>

      {/* ─── STICKY CTA ─────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showStickyCTA && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-6 right-4 sm:right-6 z-40 flex flex-col gap-2"
          >
            <button
              onClick={() => setShowEstimator(true)}
              className="flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
              style={{ background: 'rgba(10,10,10,0.92)', border: '1px solid rgba(139,92,246,0.5)', boxShadow: '0 0 24px rgba(139,92,246,0.3)', backdropFilter: 'blur(16px)' }}
            >
              <Calculator className="w-4 h-4" style={{ color: '#8B5CF6' }} />
              Estimate My Project
            </button>
            <a href="#contact"
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold text-sm text-white shadow-2xl transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 24px rgba(139,92,246,0.4)' }}
            >
              <Send className="w-4 h-4" />
              Book XR Session
            </a>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── PROJECT ESTIMATOR MODAL ────────────────────────────────────────── */}
      <AnimatePresence>
        {showEstimator && <ProjectEstimator onClose={() => setShowEstimator(false)} />}
      </AnimatePresence>

      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] flex items-center justify-center overflow-hidden px-4 sm:px-6 pt-20 pb-16">
        <VRGrid />
        <FloatingOrbs />

        {/* Hero gradient bg */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0" style={{
            background: 'radial-gradient(ellipse at 30% 40%, rgba(139,92,246,0.18) 0%, transparent 55%), radial-gradient(ellipse at 70% 60%, rgba(0,212,255,0.12) 0%, transparent 50%)',
          }} />
          <div className="absolute inset-0" style={{
            background: 'linear-gradient(to bottom, rgba(5,5,5,0.4) 0%, rgba(5,5,5,0.15) 50%, rgba(5,5,5,0.95) 100%)',
          }} />
        </div>

        <div className="relative z-10 text-center max-w-5xl mx-auto w-full">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 text-[10px] sm:text-xs font-semibold tracking-[0.22em] uppercase mb-5 sm:mb-6 px-3 sm:px-4 py-1.5 rounded-full border"
              style={{ color: '#8B5CF6', borderColor: 'rgba(139,92,246,0.4)', background: 'rgba(139,92,246,0.08)' }}>
              <Zap className="w-3 h-3" />
              Boostify XR Studio
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-8xl font-black leading-[1.05] mb-6 sm:mb-8"
          >
            <span className="block text-white">VR · Motion Capture</span>
            <span className="block"
              style={{ background: 'linear-gradient(135deg, #8B5CF6 0%, #00D4FF 50%, #FF7A00 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Character Creation · AI Engine
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="text-base sm:text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-8 sm:mb-10 leading-relaxed px-2"
          >
            Boostify's XR Studio is where artists become legends in every dimension — VR concerts, photorealistic digital avatars, full-body motion capture, and Boostify AI-powered virtual worlds that dominate the next era of entertainment.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center"
          >
            <a href="#services"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg transition-all hover:scale-105 active:scale-95 text-white w-full sm:w-auto"
              style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 30px rgba(139,92,246,0.4)' }}
            >
              Explore Services
              <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
            </a>
            <a href="#contact"
              className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-base sm:text-lg border border-white/20 text-white backdrop-blur-sm hover:border-white/40 transition-all w-full sm:w-auto"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <Phone className="w-4 h-4 sm:w-5 sm:h-5" />
              Talk to Our Team
            </a>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.7 }}
            className="grid grid-cols-2 sm:flex sm:flex-wrap justify-center gap-y-5 gap-x-8 sm:gap-x-12 mt-12 sm:mt-16 text-center"
          >
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-black" style={{ color: '#8B5CF6' }}>{s.value}</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── WHY XR / INTRO ───────────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.02)' }}>
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="The Opportunity"
              title="The $250B XR Market Is Yours to Own"
              subtitle="Extended Reality is the fastest-growing sector in entertainment. Artists who build their XR presence now will control the next generation of fan experience — and the revenue that comes with it."
            />
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  icon: Globe,
                  color: "#8B5CF6",
                  title: "Global Reach Without Logistics",
                  desc: "A VR concert can be experienced by 1 million fans simultaneously — in Tokyo, São Paulo, and Lagos — with zero travel, zero crew overhead, and infinite scalability.",
                },
                {
                  icon: BarChart3,
                  color: "#00D4FF",
                  title: "New Revenue Streams",
                  desc: "VR tickets, NFT-gated experiences, branded XR sponsorships, avatar merchandise, AI content licensing — the XR economy creates revenue channels that don't exist in the physical world.",
                },
                {
                  icon: Star,
                  color: "#FF7A00",
                  title: "Permanent Digital Legacy",
                  desc: "A photorealistic 3D avatar and motion capture library means your artist's performance exists forever — available for new media, future generations, and platform-independent distribution.",
                },
              ].map((item) => (
                <GlassCard key={item.title} className="p-6" glowColor={`${item.color}15`}>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                    style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}>
                    <item.icon className="w-6 h-6" style={{ color: item.color }} />
                  </div>
                  <h3 className="text-lg font-bold text-white mb-3">{item.title}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{item.desc}</p>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── SERVICES EXPLORER ────────────────────────────────────────────── */}
      <section id="services" className="py-14 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Our Services"
              title="Six Pillars of XR Dominance"
              subtitle="Every service is a weapon in your arsenal. Deploy one or build the full stack."
            />
          </motion.div>

          {/* Service selector tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {CORE_SERVICES.map((svc) => (
              <button
                key={svc.id}
                onClick={() => setActiveService(svc.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all"
                style={activeService === svc.id
                  ? { background: `${svc.color}22`, color: svc.color, border: `1px solid ${svc.color}60`, boxShadow: `0 0 20px ${svc.color}25` }
                  : { background: 'rgba(255,255,255,0.04)', color: '#666', border: '1px solid rgba(255,255,255,0.08)' }
                }
              >
                <svc.icon className="w-4 h-4" />
                {svc.title.split(' ')[0] === 'AI-Powered' ? 'AI Animation' : svc.title.split(' ').slice(0, 2).join(' ')}
              </button>
            ))}
          </div>

          {/* Active service detail */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeService}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Left — description */}
                <GlassCard className="p-8" glowColor={`${activeServiceData.color}20`}>
                  <div className="flex items-start gap-4 mb-6">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `${activeServiceData.color}15`, border: `1px solid ${activeServiceData.color}35` }}>
                      <activeServiceData.icon className="w-7 h-7" style={{ color: activeServiceData.color }} />
                    </div>
                    <div>
                      <h3 className="text-2xl font-black text-white leading-tight">{activeServiceData.title}</h3>
                      <p className="text-sm font-medium mt-1" style={{ color: `${activeServiceData.color}CC` }}>{activeServiceData.tagline}</p>
                    </div>
                  </div>

                  <p className="text-gray-300 leading-relaxed mb-6">{activeServiceData.desc}</p>

                  <div>
                    <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: `${activeServiceData.color}80` }}>
                      What's Included
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      {activeServiceData.features.map((f) => (
                        <div key={f} className="flex items-start gap-2 text-sm text-gray-300">
                          <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: activeServiceData.color }} />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>

                {/* Right — deliverables + CTA */}
                <div className="flex flex-col gap-6">
                  <GlassCard className="p-6" glowColor={`${activeServiceData.color}15`}>
                    <div className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: `${activeServiceData.color}80` }}>
                      Deliverables
                    </div>
                    <div className="space-y-3">
                      {activeServiceData.deliverables.map((d, i) => (
                        <div key={d} className="flex items-center gap-3 p-3 rounded-xl"
                          style={{ background: `${activeServiceData.color}08`, border: `1px solid ${activeServiceData.color}20` }}>
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black"
                            style={{ background: `${activeServiceData.color}20`, color: activeServiceData.color }}>
                            {i + 1}
                          </div>
                          <span className="text-white font-medium text-sm">{d}</span>
                        </div>
                      ))}
                    </div>
                  </GlassCard>

                  {/* Visual representation */}
                  <GlassCard className="p-6 flex-1 flex flex-col items-center justify-center min-h-[200px]"
                    glowColor={`${activeServiceData.color}12`}>
                    <motion.div
                      className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                      style={{ background: `${activeServiceData.color}15`, border: `1px solid ${activeServiceData.color}30` }}
                      animate={{ boxShadow: [`0 0 20px ${activeServiceData.color}20`, `0 0 50px ${activeServiceData.color}40`, `0 0 20px ${activeServiceData.color}20`] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <activeServiceData.icon className="w-10 h-10" style={{ color: activeServiceData.color }} />
                    </motion.div>
                    <p className="text-gray-500 text-sm text-center">Ready to start your</p>
                    <p className="text-white font-bold text-center">{activeServiceData.title} project?</p>
                    <a href="#contact"
                      className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-105 text-white"
                      style={{ background: `linear-gradient(135deg, ${activeServiceData.color}, ${activeServiceData.color}99)`, boxShadow: `0 0 20px ${activeServiceData.color}30` }}>
                      Request a Quote
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  </GlassCard>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* All 6 service cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
            {CORE_SERVICES.map((svc, i) => (
              <motion.div
                key={svc.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.07 }}
              >
                <GlassCard
                  className={`p-5 h-full cursor-pointer transition-all hover:border-white/20 ${activeService === svc.id ? 'border-white/25' : ''}`}
                  glowColor={activeService === svc.id ? `${svc.color}20` : `${svc.color}08`}
                >
                  <button className="w-full text-left" onClick={() => { setActiveService(svc.id); document.getElementById('services')?.scrollIntoView({ behavior: 'smooth' }); }}>
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3"
                      style={{ background: `${svc.color}15`, border: `1px solid ${svc.color}30` }}>
                      <svc.icon className="w-5 h-5" style={{ color: svc.color }} />
                    </div>
                    {svc.highlight && (
                      <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mb-2"
                        style={{ background: `${svc.color}20`, color: svc.color, border: `1px solid ${svc.color}40` }}>
                        Most Requested
                      </span>
                    )}
                    <h3 className="font-bold text-white text-sm mb-1.5">{svc.title}</h3>
                    <p className="text-gray-500 text-xs leading-relaxed line-clamp-2">{svc.desc}</p>
                    <div className="flex items-center gap-1 mt-3 text-xs font-semibold" style={{ color: svc.color }}>
                      Learn more <ArrowRight className="w-3 h-3" />
                    </div>
                  </button>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── XR COMPARISON TABLE ──────────────────────────────────────────── */}
      <section className="py-14 sm:py-20 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.35)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 100%, rgba(0,212,255,0.05) 0%, transparent 60%)' }} />
        <div className="max-w-5xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="XR Explained"
              title="VR vs AR vs MR vs XR"
              accentColor="#00D4FF"
              subtitle="Not sure which reality format is right for your project? Here's how each one works and what it delivers."
            />
          </motion.div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-3 px-4 text-gray-600 font-semibold text-xs uppercase tracking-wider">Attribute</th>
                  {XR_COMPARISON.map(x => (
                    <th key={x.type} className="py-3 px-4 text-center">
                      <div className="inline-flex flex-col items-center gap-1">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${x.color}15`, border: `1px solid ${x.color}40` }}>
                          <x.icon className="w-4 h-4" style={{ color: x.color }} />
                        </div>
                        <span className="font-black text-white text-sm">{x.type}</span>
                        <span className="text-[10px] font-medium" style={{ color: x.color }}>{x.fullName.split(' ')[0]}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  { label: 'Device', key: 'device' as const },
                  { label: 'Immersion', key: 'immersion' as const },
                  { label: 'Fan Access', key: 'fanAccess' as const },
                  { label: 'Revenue Model', key: 'revenue' as const },
                ].map(row => (
                  <tr key={row.label} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wide">{row.label}</td>
                    {XR_COMPARISON.map(x => (
                      <td key={x.type} className="py-3 px-4 text-center text-gray-300 text-xs">{x[row.key]}</td>
                    ))}
                  </tr>
                ))}
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wide">Live Show</td>
                  {XR_COMPARISON.map(x => (
                    <td key={x.type} className="py-3 px-4 text-center">
                      <Check className="w-4 h-4 mx-auto" style={{ color: x.color }} />
                    </td>
                  ))}
                </tr>
                <tr className="hover:bg-white/[0.02] transition-colors">
                  <td className="py-3 px-4 text-gray-500 font-medium text-xs uppercase tracking-wide">Digital Avatar</td>
                  {XR_COMPARISON.map(x => (
                    <td key={x.type} className="py-3 px-4 text-center">
                      {x.avatar
                        ? <Check className="w-4 h-4 mx-auto" style={{ color: x.color }} />
                        : <span className="text-gray-700 text-xs">—</span>}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─── AI IMAGE SHOWCASE ────────────────────────────────────────────── */}
      <section ref={showcaseSectionRef} className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(139,92,246,0.06) 0%, transparent 65%)' }} />
        <div className="max-w-7xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="AI-Generated Previews"
              title="Visualized by Boostify's AI"
              subtitle="Every service, rendered in real time by our Flux Pro image generation engine. Click to generate unique AI previews of each experience."
            />
          </motion.div>

          {/* Loading indicator (auto-started) */}
          {!showcaseStarted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-center mb-10"
            >
              <div className="flex items-center gap-3 px-6 py-3 rounded-xl border border-purple-500/20"
                style={{ background: 'rgba(139,92,246,0.06)' }}>
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#8B5CF6' }} />
                <span className="text-sm text-gray-500">Loading AI previews...</span>
              </div>
            </motion.div>
          )}

          {showcaseStarted && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {CORE_SERVICES.map((svc, i) => {
                const img = showcaseImages[svc.id];
                const loading = loadingImages[svc.id] ?? true;
                return (
                  <motion.div
                    key={svc.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.08 }}
                  >
                    <div className="relative rounded-2xl overflow-hidden border border-white/10 group"
                      style={{ boxShadow: `0 0 30px ${svc.color}18` }}>
                      {/* Image area */}
                      <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                        {loading && !img && (
                          <div className="absolute inset-0 rounded-t-2xl overflow-hidden">
                            <motion.div
                              className="absolute inset-0"
                              style={{ background: `linear-gradient(90deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.03) 100%)` }}
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
                            />
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                              style={{ background: `${svc.color}0a` }}>
                              <motion.div
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ background: `${svc.color}20`, border: `1px solid ${svc.color}40` }}
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                              >
                                <Sparkles className="w-6 h-6" style={{ color: svc.color }} />
                              </motion.div>
                              <span className="text-xs font-medium" style={{ color: `${svc.color}99` }}>Generating...</span>
                            </div>
                          </div>
                        )}
                        {img && (
                          <motion.img
                            src={img}
                            alt={`${svc.title} AI preview`}
                            className="absolute inset-0 w-full h-full object-cover"
                            initial={{ opacity: 0, scale: 1.05 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                          />
                        )}
                        {/* Overlay gradient */}
                        <div className="absolute inset-0 pointer-events-none"
                          style={{ background: 'linear-gradient(to top, rgba(5,5,5,0.85) 0%, transparent 50%)' }} />
                      </div>

                      {/* Card info */}
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                            style={{ background: `${svc.color}25`, border: `1px solid ${svc.color}40` }}>
                            <svc.icon className="w-3.5 h-3.5" style={{ color: svc.color }} />
                          </div>
                          <span className="font-bold text-white text-sm">{svc.title}</span>
                        </div>
                        <p className="text-gray-400 text-xs leading-relaxed">{svc.tagline}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: svc.color }} />
                          <span className="text-[10px] font-medium" style={{ color: svc.color }}>AI-Generated Preview</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* Process animation: generation pipeline */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={sectionVariants}
            className="mt-14"
          >
            <div className="text-center mb-8">
              <span className="text-xs font-bold uppercase tracking-widest text-gray-500">How Boostify generates your visuals</span>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-0">
              {[
                { step: "01", label: "Your Brief", icon: Mic2, color: "#8B5CF6" },
                { step: "02", label: "AI Prompt Build", icon: Cpu, color: "#00D4FF" },
                { step: "03", label: "Flux Pro Engine", icon: Sparkles, color: "#FF7A00" },
                { step: "04", label: "Image Delivery", icon: Film, color: "#8B5CF6" },
                { step: "05", label: "Production Ready", icon: Star, color: "#00D4FF" },
              ].map((item, i) => (
                <React.Fragment key={item.step}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.4, delay: i * 0.12 }}
                    className="flex flex-col items-center gap-2 px-4 py-3"
                  >
                    <motion.div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center"
                      style={{ background: `${item.color}15`, border: `1px solid ${item.color}40` }}
                      animate={{ boxShadow: [`0 0 10px ${item.color}20`, `0 0 30px ${item.color}50`, `0 0 10px ${item.color}20`] }}
                      transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
                    >
                      <item.icon className="w-6 h-6" style={{ color: item.color }} />
                    </motion.div>
                    <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: `${item.color}99` }}>{item.step}</span>
                    <span className="text-xs font-semibold text-white text-center">{item.label}</span>
                  </motion.div>
                  {i < 4 && (
                    <motion.div
                      className="hidden sm:block w-8 h-px"
                      style={{ background: `linear-gradient(90deg, ${item.color}60, ${[
                        "#8B5CF6", "#00D4FF", "#FF7A00", "#8B5CF6", "#00D4FF"
                      ][i + 1]}60)` }}
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: i * 0.12 + 0.3 }}
                    />
                  )}
                </React.Fragment>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── MOTION CAPTURE DEEP DIVE ─────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(0,212,255,0.02)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(0,212,255,0.06) 0%, transparent 50%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Motion Capture"
              title="Capture the Soul of the Performance"
              accentColor="#00D4FF"
              subtitle="Motion capture doesn't just record movement — it preserves the essence of an artist's unique performance style forever."
            />
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-12">
            {[
              { icon: Activity, color: "#00D4FF", title: "Full-Body Optical", desc: "60+ retro-reflective markers. Sub-millimeter precision. Every movement preserved at professional broadcast quality." },
              { icon: Camera, color: "#8B5CF6", title: "Facial FACS Capture", desc: "Performance-grade facial rig captures 52+ expression shapes — micro-expressions, lip sync, eye movement." },
              { icon: Sparkles, color: "#FF7A00", title: "AI Motion Cleanup", desc: "Our AI removes noise, fills gaps, and retimes motion data for cinematic-grade output." },
              { icon: Layers, color: "#00D4FF", title: "Universal Re-targeting", desc: "Animation data re-targeted to any 3D rig — ready for Boostify HoloStage, Unity, Maya, Blender, or any pipeline." },
            ].map((item) => (
              <GlassCard key={item.title} className="p-5" glowColor={`${item.color}15`}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}>
                  <item.icon className="w-5 h-5" style={{ color: item.color }} />
                </div>
                <h3 className="font-bold text-white text-sm mb-2">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </GlassCard>
            ))}
          </div>

          {/* Session types */}
          <div className="grid md:grid-cols-3 gap-5">
            {[
              { color: "#8B5CF6", title: "Starter Session", duration: "2 Hours", moves: "30–50 animations", ideal: "Basic performance library for digital avatar", price: "From $3,500" },
              { color: "#00D4FF", title: "Full Day Session", duration: "8 Hours", moves: "80–120 animations", ideal: "Complete performance + interaction library", price: "From $9,500" },
              { color: "#FF7A00", title: "Full Production", duration: "2+ Days", moves: "200+ animations", ideal: "Entire show choreography + catalog revival", price: "From $18,000" },
            ].map((session) => (
              <GlassCard key={session.title} className="p-6" glowColor={`${session.color}18`}>
                <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: session.color }}>
                  {session.title}
                </div>
                <div className="text-3xl font-black text-white mb-1">{session.duration}</div>
                <div className="text-sm text-gray-400 mb-4">{session.moves}</div>
                <div className="text-xs text-gray-600 mb-5 leading-relaxed">{session.ideal}</div>
                <div className="pt-4 border-t border-white/5">
                  <span className="text-lg font-black" style={{ color: session.color }}>{session.price}</span>
                </div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CHARACTER CREATION PIPELINE ──────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Character Creation"
              title="Your Digital Twin, Built to Last"
              accentColor="#FF7A00"
              subtitle="From scan data to screen-ready digital artist — our 5-stage pipeline produces cinema-grade characters that perform flawlessly on any platform."
            />
          </motion.div>

          <div className="relative">
            <div className="grid md:grid-cols-5 gap-3">
              {[
                { step: "01", color: "#8B5CF6", title: "Scan & Reference", detail: "Photo capture (100+ angles), body scan, expression video reference, style guides" },
                { step: "02", color: "#00D4FF", title: "ZBrush Sculpt", detail: "High-poly facial mesh, skin micro-detail, eye, teeth, hair geometry" },
                { step: "03", color: "#FF7A00", title: "Texturing", detail: "PBR maps: Albedo, Normal, Roughness, Subsurface Scattering, Cavity" },
                { step: "04", color: "#8B5CF6", title: "Rigging & Blend", detail: "Full body skeleton rig, FACS blendshapes, IK/FK chain, hand controls" },
                { step: "05", color: "#00D4FF", title: "Platform Export", detail: "FBX, GLTF/GLB for VR/WebXR, Boostify HoloStage format, optimized game-res variant" },
              ].map((stage, i) => (
                <motion.div
                  key={stage.step}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                >
                  <GlassCard className="p-5 text-center h-full" glowColor={`${stage.color}15`}>
                    <motion.div
                      className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-sm font-black"
                      style={{ background: `${stage.color}15`, border: `2px solid ${stage.color}40`, color: stage.color }}
                      animate={{ boxShadow: [`0 0 0px ${stage.color}00`, `0 0 20px ${stage.color}40`, `0 0 0px ${stage.color}00`] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
                    >
                      {stage.step}
                    </motion.div>
                    <h4 className="font-black text-white text-sm mb-2">{stage.title}</h4>
                    <p className="text-gray-600 text-xs leading-relaxed">{stage.detail}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── BOOSTIFY AI ENGINE CAPABILITIES ──────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.025)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 75% 40%, rgba(139,92,246,0.08) 0%, transparent 50%)' }} />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Boostify AI Engine"
              title="Our Own Engine. Our Own Rules."
              accentColor="#8B5CF6"
              subtitle="Boostify's proprietary AI Production Engine is a fully self-contained visual system — built and operated in-house to power real-time virtual shows, cinematic sequences, and multi-platform XR experiences."
            />
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
            {[
              { color: "#8B5CF6", title: "AI Dynamic Lighting", desc: "Fully AI-driven global illumination — every light, shadow, and atmospheric effect generated and adapted in real time to the performance." },
              { color: "#00D4FF", title: "Procedural Stage Generation", desc: "Describe a stage concept in natural language. Boostify's AI generates the environment, geometry, and layout — ready for live deployment in minutes." },
              { color: "#FF7A00", title: "Boostify Character Engine", desc: "Our photorealistic character pipeline renders your artist's digital twin with cinema-grade skin, hair, and expression quality on any platform." },
              { color: "#8B5CF6", title: "AI Virtual Camera System", desc: "Intelligent camera paths, real-time color grading, depth of field, and cinematic lens simulation — fully automated or manually controlled." },
              { color: "#00D4FF", title: "Multi-Screen Output", desc: "Output simultaneously to LED volume stages, holographic systems, curved screens, and streaming platforms — from one Boostify show file." },
              { color: "#FF7A00", title: "Real-Time AI Ray Tracing", desc: "Boostify's AI ray tracing engine delivers accurate reflections, shadows, and light transport that matches physical reality at high frame rates." },
            ].map((item) => (
              <GlassCard key={item.title} className="p-5 h-full" glowColor={`${item.color}12`}>
                <motion.div
                  className="w-2 h-10 rounded-full mb-4"
                  style={{ background: `linear-gradient(to bottom, ${item.color}, ${item.color}30)` }}
                  animate={{ scaleY: [0.7, 1, 0.7] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <h3 className="font-bold text-white text-sm mb-2">{item.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{item.desc}</p>
              </GlassCard>
            ))}
          </div>

          {/* Boostify engine output specs */}
          <GlassCard className="p-6 md:p-8" glowColor="rgba(139,92,246,0.18)">
            <div className="text-xs font-bold uppercase tracking-widest mb-5 text-center" style={{ color: '#8B5CF6' }}>
              Boostify AI Engine Output Capabilities
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Resolution", value: "Up to 8K" },
                { label: "Frame Rate", value: "Up to 120 FPS" },
                { label: "HDR", value: "Dolby Vision" },
                { label: "Audio", value: "Dolby Atmos" },
                { label: "Signal Out", value: "SDI / NDI / HDMI" },
                { label: "VR Output", value: "Quest / WebXR" },
                { label: "Streaming", value: "WebRTC / HLS" },
                { label: "Record", value: "ProRes / EXR / H.265" },
              ].map((spec) => (
                <div key={spec.label} className="text-center p-3 rounded-xl"
                  style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)' }}>
                  <div className="text-lg font-black text-white">{spec.value}</div>
                  <div className="text-xs text-gray-600 mt-0.5">{spec.label}</div>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ─── PRODUCTION PROCESS ───────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="How We Work"
              title="Your XR Project in 8 Precise Steps"
              subtitle="From creative brief to global launch — every step engineered for speed, quality, and maximum impact."
            />
          </motion.div>

          <div className="relative">
            {/* Connecting line */}
            <motion.div
              className="absolute left-[31px] top-4 bottom-4 w-px hidden md:block"
              style={{ background: 'linear-gradient(to bottom, rgba(139,92,246,0.5), rgba(0,212,255,0.3), transparent)' }}
              initial={{ scaleY: 0, originY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />

            <div className="space-y-3">
              {PRODUCTION_PROCESS.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -40 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="flex items-center gap-5"
                >
                  <div className="hidden md:flex w-16 justify-center flex-shrink-0">
                    <motion.div
                      className="w-4 h-4 rounded-full border-2 flex-shrink-0 relative z-10"
                      style={{ borderColor: step.color, background: `${step.color}20` }}
                      whileInView={{ scale: [0, 1.4, 1] }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.08 + 0.2 }}
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
                    <span className="text-xs font-black flex-shrink-0 w-6" style={{ color: `${step.color}55` }}>{step.step}</span>
                    <div className="w-px h-7 flex-shrink-0" style={{ background: `${step.color}25` }} />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: `${step.color}12`, border: `1px solid ${step.color}25` }}>
                      <step.icon className="w-4 h-4" style={{ color: step.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-white text-sm">{step.title}</div>
                      <div className="text-gray-500 text-xs mt-0.5 hidden sm:block">{step.desc}</div>
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
          </div>
        </div>
      </section>

      {/* ─── PACKAGES ─────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(0,212,255,0.015)' }}>
        <div className="max-w-6xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Packages"
              title="Choose Your XR Level"
              subtitle="From your first VR experience to full-scale XR empire — there is a package for every ambition."
            />
          </motion.div>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-6">
            {VR_PACKAGES.map((pkg, i) => (
              <motion.div
                key={pkg.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.55, delay: i * 0.1 }}
              >
                <div
                  className={`relative rounded-2xl border flex flex-col h-full ${pkg.highlight ? '' : 'border-white/10'}`}
                  style={{
                    background: pkg.highlight
                      ? 'linear-gradient(135deg, rgba(255,122,0,0.12) 0%, rgba(5,5,5,0.9) 100%)'
                      : 'rgba(5,5,5,0.7)',
                    borderColor: pkg.highlight ? `${pkg.color}60` : undefined,
                    boxShadow: pkg.highlight ? `0 0 60px ${pkg.color}25` : 'none',
                  }}
                >
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 rounded-full text-xs font-bold text-white"
                        style={{ background: pkg.color }}>
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
                    <a href="#contact"
                      className={`block text-center py-3 px-4 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 ${pkg.highlight ? 'text-black' : 'text-white border border-current'}`}
                      style={pkg.highlight
                        ? { background: pkg.color }
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

      {/* ─── TECH STACK ───────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 relative overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Technology"
              title="Industry-Leading XR Stack"
              subtitle="Every tool in our pipeline is the professional standard used by AAA games studios, Hollywood VFX houses, and world-class live entertainment."
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
                  style={{ borderColor: `${tech.color}30`, background: `${tech.color}08` }}>
                  <div className="font-bold text-white text-sm">{tech.name}</div>
                  <div className="text-xs mt-0.5" style={{ color: tech.color }}>{tech.category}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── HOLOSUIT INTEGRATION ─────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <div className="grid md:grid-cols-3 gap-5">
              {[
                {
                  href: "/holosuit",
                  icon: Radio,
                  color: "#00D4FF",
                  eyebrow: "Hardware",
                  title: "Boostify HoloSuit",
                  desc: "Real-time full-body motion capture wearable. Stream your performance live into any XR environment — 60 FPS, sub-20ms latency.",
                  cta: "View HoloSuit",
                },
                {
                  href: "/hologram-show-engine",
                  icon: Layers,
                  color: "#8B5CF6",
                  eyebrow: "Engine",
                  title: "Hologram Show Engine",
                  desc: "Live hologram broadcast system. Deploy your XR Studio assets into full-scale holographic live events in 195+ countries.",
                  cta: "View Show Engine",
                },
                {
                  href: "/holostage",
                  icon: Monitor,
                  color: "#FF7A00",
                  eyebrow: "Platform",
                  title: "Boostify HoloStage",
                  desc: "The live show OS. 12 preset show types, DMX control, real-time avatars, mixed reality broadcast — all wired to your XR assets.",
                  cta: "View HoloStage",
                },
              ].map(item => (
                <GlassCard key={item.title} className="p-6" glowColor={`${item.color}15`}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                    style={{ background: `${item.color}12`, border: `1px solid ${item.color}30` }}>
                    <item.icon className="w-5 h-5" style={{ color: item.color }} />
                  </div>
                  <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: item.color }}>{item.eyebrow}</div>
                  <h3 className="font-black text-white text-base mb-2">{item.title}</h3>
                  <p className="text-gray-500 text-xs leading-relaxed mb-4">{item.desc}</p>
                  <a href={item.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold transition-all hover:gap-2.5"
                    style={{ color: item.color }}>
                    {item.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </GlassCard>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ─── HOLOGRAM CTA ─────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-16 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <GlassCard className="p-6 md:p-10 relative overflow-hidden" glowColor="rgba(139,92,246,0.18)">
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="absolute -top-8 -right-8 w-48 h-48 rounded-full blur-3xl opacity-20"
                  style={{ background: '#8B5CF6' }} />
                <div className="absolute -bottom-8 -left-8 w-48 h-48 rounded-full blur-3xl opacity-15"
                  style={{ background: '#00D4FF' }} />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
                <div className="flex-1 text-center md:text-left">
                  <span className="text-xs font-bold tracking-widest uppercase" style={{ color: '#8B5CF6' }}>
                    Connected to Boostify Hologram
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white mt-2 mb-3 leading-tight">
                    XR Studio + Hologram Show Engine
                    <span className="block" style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      The Complete Pipeline
                    </span>
                  </h3>
                  <p className="text-gray-400 text-sm leading-relaxed max-w-lg">
                    Combine XR Studio services with our Hologram Live Show Engine for the most complete digital artist production pipeline in the world — from 3D character creation to live hologram performances in 195+ countries.
                  </p>
                </div>
                <div className="flex flex-col gap-3 flex-shrink-0">
                  <a href="/hologram-show-engine"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm text-white transition-all hover:scale-105"
                    style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 24px rgba(139,92,246,0.35)' }}>
                    View Hologram Show Engine
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a href="#contact"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-sm border text-white transition-all hover:border-white/30"
                    style={{ background: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.15)' }}>
                    Bundle Both Services
                  </a>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────────────────────── */}
      <section className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden" style={{ background: 'rgba(139,92,246,0.02)' }}>
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
                <GlassCard className="overflow-hidden" glowColor="rgba(139,92,246,0.06)">
                  <button
                    className="w-full flex items-center justify-between p-5 text-left gap-4"
                    onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  >
                    <span className="font-semibold text-white text-sm">{faq.q}</span>
                    {faqOpen === i
                      ? <ChevronUp className="w-5 h-5 text-purple-400 flex-shrink-0" />
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

      {/* ─── CONTACT FORM ─────────────────────────────────────────────────── */}
      <section id="contact" className="py-14 sm:py-24 px-4 sm:px-6 relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(139,92,246,0.08) 0%, transparent 70%)' }} />
        <div className="max-w-2xl mx-auto relative z-10">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={sectionVariants}>
            <SectionHeading
              eyebrow="Start Your XR Project"
              title="Let's Build Your XR Empire"
              subtitle="Tell us about your project. Our XR production team will respond within 24 hours with a custom proposal."
            />
          </motion.div>

          {formStatus === 'success' ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-16"
            >
              <CheckCircle2 className="w-16 h-16 mx-auto mb-6" style={{ color: '#22c55e' }} />
              <h3 className="text-2xl font-black text-white mb-4">Project Request Received</h3>
              <p className="text-gray-400 text-lg">Our XR Studio team will contact you within 24 hours with a detailed project proposal.</p>
            </motion.div>
          ) : (
            <GlassCard className="p-8" glowColor="rgba(139,92,246,0.18)">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Your Name *</label>
                    <input type="text" value={formData.name} onChange={(e) => updateForm('name', e.target.value)}
                      placeholder="Artist or contact name" required
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${fieldBorder(formData.name)}` }} />
                    {formTouched && !formData.name.trim() && <p className="text-red-400 text-xs mt-1">Name is required</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address *</label>
                    <input type="email" value={formData.email} onChange={(e) => updateForm('email', e.target.value)}
                      placeholder="your@email.com" required
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-colors"
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${fieldBorder(formData.email)}` }} />
                    {formTouched && !formData.email.trim() && <p className="text-red-400 text-xs mt-1">Email is required</p>}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Phone Number</label>
                    <input type="tel" value={formData.phone} onChange={(e) => updateForm('phone', e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Artist or Company</label>
                    <input type="text" value={formData.companyOrArtist} onChange={(e) => updateForm('companyOrArtist', e.target.value)}
                      placeholder="Your artist or organization"
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Primary Service Interest</label>
                    <select value={formData.serviceInterest} onChange={(e) => updateForm('serviceInterest', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">Select service</option>
                      <option value="vr">Virtual Reality (VR) Experience</option>
                      <option value="mocap">Motion Capture</option>
                      <option value="character">Character Creation / 3D Avatar</option>
                      <option value="boostify_engine">Boostify AI Production</option>
                      <option value="xr">XR Live Performance</option>
                      <option value="ai_animation">AI-Powered Animation</option>
                      <option value="full_bundle">Full XR Bundle</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Project Type</label>
                    <select value={formData.projectType} onChange={(e) => updateForm('projectType', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">Select project type</option>
                      <option value="music_video">Music Video</option>
                      <option value="vr_concert">VR Concert / Experience</option>
                      <option value="digital_avatar">Digital Artist Avatar</option>
                      <option value="virtual_tour">Virtual Tour Production</option>
                      <option value="led_volume">LED Volume Stage Content</option>
                      <option value="metaverse">Metaverse / Platform Build</option>
                      <option value="catalog_revival">Catalog Revival / Legacy</option>
                      <option value="brand_xr">Brand XR Experience</option>
                    </select>
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Budget Range</label>
                    <select value={formData.budgetRange} onChange={(e) => updateForm('budgetRange', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">Select range</option>
                      <option value="under_10k">Under $10,000</option>
                      <option value="10k_25k">$10,000 – $25,000</option>
                      <option value="25k_50k">$25,000 – $50,000</option>
                      <option value="50k_100k">$50,000 – $100,000</option>
                      <option value="over_100k">$100,000+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Timeline</label>
                    <select value={formData.timeline} onChange={(e) => updateForm('timeline', e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none"
                      style={{ background: 'rgba(20,20,20,0.9)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <option value="">Select timeline</option>
                      <option value="asap">As soon as possible</option>
                      <option value="1_month">Within 1 month</option>
                      <option value="3_months">Within 3 months</option>
                      <option value="6_months">Within 6 months</option>
                      <option value="planning">Early planning stage</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">Describe Your Project</label>
                  <textarea value={formData.message} onChange={(e) => updateForm('message', e.target.value)}
                    placeholder="Tell us about your artist, your vision, what you want to create, and any technical requirements..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none resize-none"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>

                {formStatus === 'error' && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-800/30 rounded-xl p-3">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Something went wrong. Please try again or email us at xr@boostifymusic.com
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formStatus === 'sending' || !formData.name.trim() || !formData.email.trim()}
                  className="w-full py-4 rounded-xl font-bold text-base text-white flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 30px rgba(139,92,246,0.3)' }}
                >
                  {formStatus === 'sending' ? (
                    <><Loader2 className="w-5 h-5 animate-spin" /> Sending Request...</>
                  ) : (
                    <><Send className="w-5 h-5" /> Submit — We'll Respond in 24 Hours</>
                  )}
                </button>

                <div className="flex flex-col sm:flex-row gap-3 justify-center text-center text-gray-600 text-xs">
                  <span className="flex items-center justify-center gap-1.5"><Mail className="w-3 h-3" /> vr@boostifymusic.com</span>
                  <span className="hidden sm:block">·</span>
                  <span className="flex items-center justify-center gap-1.5"><Calculator className="w-3 h-3" />
                    <button type="button" onClick={() => setShowEstimator(true)} className="underline hover:text-gray-400 transition-colors">Estimate project cost</button>
                  </span>
                </div>
              </form>
            </GlassCard>
          )}
        </div>
      </section>

      {/* ─── FOOTER CTA ───────────────────────────────────────────────────── */}
      <section className="py-12 sm:py-20 px-4 sm:px-6 text-center relative overflow-hidden border-t border-white/5">
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 50% 0%, rgba(139,92,246,0.1) 0%, transparent 60%)' }} />
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="text-4xl mb-6">🥽</div>
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            The Next Dimension of Music Is Here
          </h2>
          <p className="text-gray-400 text-lg mb-8">
            Build your VR presence, capture your motion library, and create a digital twin that performs forever — before your competition gets there first.
          </p>
          <a
            href="#contact"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all hover:scale-105 active:scale-95 text-white"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #00D4FF)', boxShadow: '0 0 40px rgba(139,92,246,0.35)' }}
          >
            Start Your XR Journey
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

    </div>
  );
}
