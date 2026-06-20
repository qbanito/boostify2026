import { useState, useRef, useCallback, useEffect, Suspense, lazy } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Upload,
  Camera,
  X,
  ChevronRight,
  ChevronDown,
  Check,
  Sparkles,
  Globe,
  Monitor,
  Music,
  Film,
  Zap,
  ExternalLink,
  AlertCircle,
  ImagePlus,
  ArrowRight,
  Box,
} from "lucide-react";
import { useLocation } from "wouter";
import { apiRequest } from "../../lib/queryClient";
import { useToast } from "../../hooks/use-toast";

// Heavy r3f stage viewer (shaders + Mixamo animations) — lazy so three.js stays out of the initial bundle.
const HologramStageViewer = lazy(() => import("./HologramStageViewer"));

// ─── Types ────────────────────────────────────────────────────────────────────

interface CapturedPhoto {
  id: string;
  file: File;
  previewUrl: string;
  angle: "front" | "side" | "threequarter" | "fullbody" | "other";
}

interface HologramProjectPanelProps {
  artistId: string;
  artistName: string;
  artistGenre?: string;
  artistSlug?: string;
  profileImage?: string | null;
  isOwnProfile: boolean;
  colors: {
    hexAccent: string;
    hexPrimary: string;
    hexBorder?: string;
    cardBg?: string;
    cardBorder?: string;
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PACKAGES = [
  { id: "digital-premiere", label: "Digital Premiere", price: "$4,997", color: "#00D4FF", desc: "2 songs · Virtual-only" },
  { id: "hologram-pro",     label: "Hologram Pro",     price: "$14,997", color: "#8B5CF6", desc: "5 songs · Stage-ready", highlight: true },
  { id: "arena-edition",   label: "Arena Edition",    price: "$34,997", color: "#FF7A00", desc: "10 songs · Full production" },
  { id: "legacy",          label: "Legacy Revival",   price: "Custom",  color: "#FFB347", desc: "Catalog revival & estates" },
] as const;

const DISPLAY_TECHS = [
  { id: "transparent-led", label: "LED Transparent", badge: "Recommended", color: "#00D4FF" },
  { id: "hologauze",       label: "Hologauze",        badge: "Best Quality", color: "#8B5CF6" },
  { id: "peppers-ghost",   label: "Pepper's Ghost",   badge: "Classic",    color: "#FF7A00" },
  { id: "led-wall",        label: "LED Wall Mapping",  badge: "Versatile",  color: "#22C55E" },
] as const;

const ANGLE_LABELS: Record<CapturedPhoto["angle"], string> = {
  front:        "Front",
  side:         "Side (90°)",
  threequarter: "3/4 Turn",
  fullbody:     "Full Body",
  other:        "Other",
};

const TARGET_PHOTOS = 50;

// ─── 3D Artist Hologram (rotating model-viewer) ───────────────────────────────

interface HoloCharacter3D {
  glbUrl: string;
  fbxUrl?: string | null;
  objUrl?: string | null;
  animatedGlbUrl?: string | null;
  animatedUrl?: string | null;
  animatedFormat?: "glb" | "fbx";
  mixamoReady?: boolean;
  rigged?: boolean;
  thumbnailUrl?: string;
  artistName?: string;
}

function ArtistHologram3D({
  artistId,
  artistName,
  accent,
  profileImage,
  isOwnProfile,
}: {
  artistId: string;
  artistName: string;
  accent: string;
  profileImage?: string | null;
  isOwnProfile?: boolean;
}) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [character, setCharacter] = useState<HoloCharacter3D | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerReady, setViewerReady] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Generate the 3D character from the artist's photos (FAL Hunyuan 3D v3.1 Pro).
  const generate3D = useCallback(async () => {
    setGenerating(true);
    setProgress(4);
    const timer = setInterval(() => setProgress((p) => Math.min(p + 2, 92)), 2500);
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${encodeURIComponent(artistId)}/character-3d`,
        method: "POST",
        data: { forceRegenerate: false },
      });
      clearInterval(timer);
      setProgress(100);
      if (data?.character?.glbUrl) {
        setCharacter(data.character);
        toast({ title: "✅ 3D hologram ready!", description: "Your rotatable 3D model is now live on your profile." });
      } else {
        toast({ title: "3D generation failed", description: data?.error || "Please try again.", variant: "destructive" });
      }
    } catch (err: any) {
      clearInterval(timer);
      toast({ title: "Error", description: err?.message || "3D generation failed", variant: "destructive" });
    } finally {
      setGenerating(false);
      setProgress(0);
    }
  }, [artistId, toast]);

  // ── Mixamo bridge ───────────────────────────────────────────────────────────
  // Mixamo has no public API, so we hand off the Mixamo-ready FBX (auto-rig +
  // 1-click animations) and open mixamo.com. The artist exports an animated GLB
  // and pastes it back via "Attach animated model".
  const sendToMixamo = useCallback(() => {
    const downloadUrl = character?.fbxUrl || character?.objUrl;
    if (downloadUrl) {
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${artistName.replace(/\s+/g, "-")}-3d.${character?.fbxUrl ? "fbx" : "obj"}`;
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    window.open("https://www.mixamo.com/#/?page=1&type=Character", "_blank");
    toast({
      title: "📦 Model ready for Mixamo",
      description: downloadUrl
        ? "FBX downloaded. Upload it to Mixamo, auto-rig it, pick an animation, then attach the exported GLB back here."
        : "Open Mixamo and upload your model to auto-rig + animate it.",
    });
  }, [character?.fbxUrl, character?.objUrl, artistName, toast]);

  const attachAnimated = useCallback(async () => {
    const url = window.prompt("Paste the public URL of your Mixamo animation (.fbx with skin, or .glb):");
    if (!url) return;
    if (!/^https?:\/\/.+\.(fbx|glb)(\?.*)?$/i.test(url.trim())) {
      toast({ title: "Invalid URL", description: "Provide a direct .fbx (Mixamo, with skin) or .glb URL.", variant: "destructive" });
      return;
    }
    try {
      const data: any = await apiRequest({
        url: `/api/hologram-gallery/${encodeURIComponent(artistId)}/character-3d/animated`,
        method: "POST",
        data: { animatedUrl: url.trim() },
      });
      if (data?.character?.glbUrl) {
        setCharacter(data.character);
        toast({ title: "✅ Animated hologram attached!", description: "Your rigged Mixamo animation now plays on your profile." });
      } else {
        toast({ title: "Failed to attach", description: data?.error || "Try again.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to attach animated model", variant: "destructive" });
    }
  }, [artistId, toast]);

  // Fetch the artist's generated 3D character
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/hologram-gallery/${encodeURIComponent(artistId)}/character-3d`);
        const data = res.ok ? await res.json() : null;
        if (active && data?.character?.glbUrl) setCharacter(data.character);
      } catch { /* optional */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [artistId]);

  // The r3f stage viewer renders the model directly — just flag ready when a model exists.
  useEffect(() => {
    if (character?.glbUrl) setViewerReady(true);
  }, [character?.glbUrl]);

  if (loading) {
    return (
      <div
        className="rounded-xl mb-5 flex items-center justify-center"
        style={{ aspectRatio: "1/1", maxHeight: 320, background: "#000", border: `1px solid ${accent}20` }}
      >
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
      </div>
    );
  }

  // No 3D model yet — graceful fallback (with inline generation for the owner)
  if (!character?.glbUrl) {
    if (!profileImage && !isOwnProfile) return null;
    return (
      <div
        className="relative rounded-xl mb-5 overflow-hidden group"
        style={{ aspectRatio: "1/1", maxHeight: 320, border: `1px solid ${accent}20`, background: "#05080d" }}
      >
        {profileImage && (
          <img src={profileImage} alt={artistName} className="w-full h-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(0,0,0,0.4), #000 95%)` }} />
        <div className="absolute inset-0 flex flex-col items-center justify-end p-4 text-center">
          <p className="text-white text-sm font-bold">{artistName}</p>
          {generating ? (
            <div className="w-full max-w-[220px] mt-3">
              <div className="flex items-center justify-center gap-2 mb-2">
                <span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
                <p className="text-xs font-semibold" style={{ color: accent }}>Building 3D model… {progress}%</p>
              </div>
              <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: `${accent}20` }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: accent }} />
              </div>
              <p className="text-gray-500 text-[10px] mt-2">FAL Hunyuan 3D v3.1 Pro · this can take 1–3 min</p>
            </div>
          ) : isOwnProfile ? (
            <button
              type="button"
              onClick={generate3D}
              className="mt-3 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all hover:scale-[1.03] active:scale-95"
              style={{ background: `linear-gradient(135deg, ${accent}, #8B5CF6)`, color: "#000", boxShadow: `0 0 20px ${accent}33` }}
            >
              <Box className="w-4 h-4" />
              Generate 3D Hologram
            </button>
          ) : (
            <p className="text-gray-400 text-xs mt-0.5">3D hologram not generated yet</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <div
      className="relative rounded-xl mb-3 overflow-hidden mx-auto w-full"
      style={{ aspectRatio: "4/5", maxWidth: 360, maxHeight: 440, background: "radial-gradient(circle at 50% 38%, #0a1420, #000 82%)", border: `1px solid ${accent}30`, boxShadow: `0 0 30px ${accent}14` }}
    >
      {viewerReady ? (
        <Suspense
          fallback={
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
            </div>
          }
        >
          <HologramStageViewer
            src={character.animatedUrl || character.animatedGlbUrl || character.glbUrl}
            format={(character.animatedUrl || character.animatedGlbUrl) ? (character.animatedFormat || "glb") : "glb"}
            colorA={accent}
            poster={character.thumbnailUrl}
            compact
          />
        </Suspense>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${accent}40`, borderTopColor: accent }} />
        </div>
      )}
      {/* Holographic scanline overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: `repeating-linear-gradient(0deg, ${accent}08 0px, transparent 2px, transparent 4px)`, mixBlendMode: "screen" }}
      />
      <div
        className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider pointer-events-none"
        style={{ background: `${accent}18`, border: `1px solid ${accent}40`, color: accent, backdropFilter: "blur(6px)" }}
      >
        <span className="w-1 h-1 rounded-full animate-pulse" style={{ background: accent }} />
        {character.animatedGlbUrl ? "Animated 3D" : "3D Hologram"}
      </div>
    </div>

    {/* ── Mixamo rig & animate bridge (owner only) ── */}
    {isOwnProfile && (
      <div className="flex flex-wrap items-center gap-2 mb-5 mx-auto w-full" style={{ maxWidth: 360 }}>
        <button
          type="button"
          onClick={sendToMixamo}
          className="flex-1 min-w-[160px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-xs transition-all hover:scale-[1.02] active:scale-95"
          style={{ background: "linear-gradient(135deg, #00C2FF, #8B5CF6)", color: "#000", boxShadow: "0 0 18px rgba(0,194,255,0.25)" }}
        >
          <Zap className="w-3.5 h-3.5" />
          Rig &amp; Animate on Mixamo
        </button>
        <button
          type="button"
          onClick={attachAnimated}
          className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs transition-all hover:bg-white/5"
          style={{ border: `1px solid ${accent}40`, color: accent }}
          title="Attach the animated GLB you exported from Mixamo"
        >
          <Upload className="w-3.5 h-3.5" />
          Attach
        </button>
      </div>
    )}
    </>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export function HologramProjectPanel({
  artistId,
  artistName,
  artistGenre,
  artistSlug,
  profileImage,
  isOwnProfile,
  colors,
}: HologramProjectPanelProps) {
  const [, navigate] = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1 — photos
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [selectedAngle, setSelectedAngle] = useState<CapturedPhoto["angle"]>("front");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 2 — project info
  const [heightCm, setHeightCm] = useState("");
  const [performanceUrl, setPerformanceUrl] = useState("");
  const [styleNotes, setStyleNotes] = useState("");

  // Step 3 — config
  const [selectedPackage, setSelectedPackage] = useState<string>("hologram-pro");
  const [selectedTech, setSelectedTech] = useState<string>("transparent-led");
  const [targetDate, setTargetDate] = useState("");

  const accent = colors.hexAccent || "#FF7A00";

  // ── Photo handlers ──────────────────────────────────────────────────────────

  const addFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    const newPhotos: CapturedPhoto[] = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, TARGET_PHOTOS - photos.length)
      .map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        angle: selectedAngle,
      }));
    setPhotos((prev) => [...prev, ...newPhotos]);
  }, [photos.length, selectedAngle]);

  const removePhoto = (id: string) => {
    setPhotos((prev) => {
      const photo = prev.find((p) => p.id === id);
      if (photo) URL.revokeObjectURL(photo.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  // ── Connect to hologram engine ──────────────────────────────────────────────

  const openHologramEngine = () => {
    const pkg = PACKAGES.find((p) => p.id === selectedPackage);
    const params = new URLSearchParams({
      name:    artistName,
      artist:  artistName,
      genre:   artistGenre || "",
      package: pkg?.label || "",
      photos:  String(photos.length),
      height:  heightCm,
      tech:    selectedTech,
      notes:   styleNotes,
      ...(artistSlug ? { slug: artistSlug } : {}),
    });
    window.open(`/hologram-show-engine#request-demo?${params.toString()}`, "_blank");
  };

  const photoProgress = Math.min(100, (photos.length / TARGET_PHOTOS) * 100);
  const canProceedStep1 = photos.length >= 5;
  const canProceedStep2 = true; // all optional beyond photos
  const canLaunch = selectedPackage && selectedTech;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        background: "linear-gradient(135deg, #050508 0%, #0a0a12 100%)",
        borderColor: `${accent}28`,
        boxShadow: isExpanded ? `0 0 40px ${accent}12` : "none",
      }}
    >
      {/* ── Header (always visible) ── */}
      <button
        type="button"
        className="w-full flex items-center gap-4 p-5 text-left transition-all hover:bg-white/[0.02]"
        onClick={() => setIsExpanded((v) => !v)}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${accent}14`, border: `1px solid ${accent}30` }}
        >
          <Cpu className="w-6 h-6" style={{ color: accent }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-bold text-base leading-tight">Hologram Live Show</h3>
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-bold"
              style={{ background: `${accent}18`, color: accent, border: `1px solid ${accent}30` }}
            >
              NEW
            </span>
          </div>
          <p className="text-gray-500 text-xs mt-0.5 truncate">
            {isOwnProfile
              ? "Create your hologram performance project"
              : `${artistName}'s Hologram Project`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {photos.length > 0 && (
            <span
              className="text-xs font-semibold px-2 py-1 rounded-full"
              style={{ background: `${accent}18`, color: accent }}
            >
              {photos.length} photos
            </span>
          )}
          {isExpanded
            ? <ChevronDown className="w-5 h-5 text-gray-400" />
            : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>
      </button>

      {/* ── Expanded content ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-6">
              {/* ── Rotating 3D hologram of the artist ── */}
              <ArtistHologram3D
                artistId={artistId}
                artistName={artistName}
                accent={accent}
                profileImage={profileImage}
                isOwnProfile={isOwnProfile}
              />

              {/* ── AI Hologram Gallery CTA — visible to everyone ── */}
              <button
                type="button"
                onClick={() => navigate(`/hologram-showcase/${artistId}`)}
                className="w-full flex items-center justify-center gap-2 py-3 mb-5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] active:scale-98"
                style={{
                  background: "linear-gradient(135deg, #00D4FF, #8B5CF6)",
                  color: "#000",
                  boxShadow: "0 0 24px rgba(0,212,255,0.2)",
                }}
              >
                <Sparkles className="w-4 h-4" />
                View AI Hologram Gallery
                <ExternalLink className="w-4 h-4" />
              </button>

              {/* ── Visitor CTA (non-owner) ── */}
              {!isOwnProfile && (
                <div
                  className="rounded-xl p-5 text-center"
                  style={{ background: `${accent}08`, border: `1px solid ${accent}20` }}
                >
                  <Sparkles className="w-8 h-8 mx-auto mb-3" style={{ color: accent }} />
                  <h4 className="text-white font-bold mb-2">Hologram Show Engine</h4>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                    {artistName} is setting up a Hologram Live Show. Discover what
                    photorealistic digital performances look like — powered by Unreal Engine 5 and AI.
                  </p>
                  <a
                    href="/hologram-show-engine"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-black transition-all hover:scale-105"
                    style={{ background: `linear-gradient(135deg, ${accent}, #FFB347)` }}
                  >
                    Explore the Hologram Engine
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}

              {/* ── Owner flow ── */}
              {isOwnProfile && (
                <>
                  {/* Step tabs */}
                  <div className="flex gap-1 mb-5 rounded-xl p-1" style={{ background: "rgba(255,255,255,0.04)" }}>
                    {([1, 2, 3] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setStep(s)}
                        className="flex-1 py-2 rounded-lg text-xs font-bold transition-all"
                        style={
                          step === s
                            ? { background: `${accent}22`, color: accent, border: `1px solid ${accent}40` }
                            : { color: "#6b7280" }
                        }
                      >
                        {s === 1 && "1. Photos"}
                        {s === 2 && "2. Details"}
                        {s === 3 && "3. Launch"}
                      </button>
                    ))}
                  </div>

                  {/* ── Step 1: Photo capture ── */}
                  {step === 1 && (
                    <div>
                      <p className="text-gray-400 text-xs mb-4 leading-relaxed">
                        Upload reference photos of{" "}
                        <span className="text-white font-semibold">{artistName}</span>. Target{" "}
                        <span style={{ color: accent }}>50+ photos</span> for best hologram quality —
                        include multiple angles, outfits, and lighting conditions.
                      </p>

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-500">{photos.length} / {TARGET_PHOTOS} photos</span>
                          <span style={{ color: accent }}>
                            {photos.length >= TARGET_PHOTOS ? "Ready!" : `${TARGET_PHOTOS - photos.length} more recommended`}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${photoProgress}%`,
                              background: photoProgress >= 100
                                ? "#22C55E"
                                : `linear-gradient(90deg, ${accent}, #8B5CF6)`,
                            }}
                          />
                        </div>
                      </div>

                      {/* Angle selector */}
                      <div className="mb-3">
                        <p className="text-gray-500 text-xs mb-2">Photo angle label</p>
                        <div className="flex flex-wrap gap-2">
                          {(Object.keys(ANGLE_LABELS) as CapturedPhoto["angle"][]).map((angle) => (
                            <button
                              key={angle}
                              type="button"
                              onClick={() => setSelectedAngle(angle)}
                              className="px-3 py-1 rounded-lg text-xs font-medium transition-all"
                              style={
                                selectedAngle === angle
                                  ? { background: `${accent}20`, color: accent, border: `1px solid ${accent}40` }
                                  : { background: "rgba(255,255,255,0.04)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.08)" }
                              }
                            >
                              {ANGLE_LABELS[angle]}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Upload buttons */}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => addFiles(e.target.files)}
                      />
                      <div className="flex gap-2 mb-4">
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.removeAttribute("capture");
                              fileInputRef.current.click();
                            }
                          }}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ background: `${accent}16`, color: accent, border: `1px solid ${accent}30` }}
                        >
                          <Upload className="w-4 h-4" />
                          Upload Photos
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (fileInputRef.current) {
                              fileInputRef.current.setAttribute("capture", "environment");
                              fileInputRef.current.click();
                            }
                          }}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
                          style={{ background: "rgba(255,255,255,0.05)", color: "#9ca3af", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <Camera className="w-4 h-4" />
                          Camera
                        </button>
                      </div>

                      {/* Drop zone */}
                      <div
                        className="rounded-xl border-2 border-dashed p-6 text-center mb-4 transition-colors cursor-pointer hover:bg-white/[0.02]"
                        style={{ borderColor: `${accent}25` }}
                        onClick={() => {
                          if (fileInputRef.current) {
                            fileInputRef.current.removeAttribute("capture");
                            fileInputRef.current.click();
                          }
                        }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          addFiles(e.dataTransfer.files);
                        }}
                      >
                        <ImagePlus className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                        <p className="text-gray-500 text-xs">Drag & drop photos here</p>
                      </div>

                      {/* Photo grid */}
                      {photos.length > 0 && (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4 max-h-64 overflow-y-auto pr-1">
                          {photos.map((photo) => (
                            <div key={photo.id} className="relative aspect-square group">
                              <img
                                src={photo.previewUrl}
                                alt="reference"
                                className="w-full h-full object-cover rounded-lg"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => removePhoto(photo.id)}
                                  className="w-6 h-6 rounded-full bg-red-500/80 flex items-center justify-center"
                                >
                                  <X className="w-3 h-3 text-white" />
                                </button>
                              </div>
                              <div
                                className="absolute bottom-0.5 left-0.5 right-0.5 rounded text-[8px] text-center font-bold truncate px-0.5"
                                style={{ background: `${accent}cc`, color: "#000" }}
                              >
                                {ANGLE_LABELS[photo.angle]}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {!canProceedStep1 && photos.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-yellow-400/80 mb-3">
                          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                          Add at least 5 photos to continue
                        </div>
                      )}

                      <button
                        type="button"
                        disabled={!canProceedStep1}
                        onClick={() => setStep(2)}
                        className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2"
                        style={canProceedStep1
                          ? { background: `linear-gradient(135deg, ${accent}, #FFB347)`, color: "#000" }
                          : { background: "rgba(255,255,255,0.06)", color: "#6b7280" }}
                      >
                        Continue to Details
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}

                  {/* ── Step 2: Project details ── */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <p className="text-gray-400 text-xs mb-1 leading-relaxed">
                        These details help calibrate the Unreal Engine 5 avatar and production style.
                        All fields are optional.
                      </p>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Artist height (cm)</label>
                        <input
                          type="number"
                          placeholder="e.g. 178"
                          value={heightCm}
                          onChange={(e) => setHeightCm(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${accent}25`,
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">
                          Performance video URL{" "}
                          <span className="text-gray-700">(YouTube, Vimeo, etc.)</span>
                        </label>
                        <input
                          type="url"
                          placeholder="https://youtube.com/watch?v=..."
                          value={performanceUrl}
                          onChange={(e) => setPerformanceUrl(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${accent}25`,
                          }}
                        />
                      </div>

                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">
                          Creative direction / style notes
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Stage vibe, outfit style, color palette, movement references..."
                          value={styleNotes}
                          onChange={(e) => setStyleNotes(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 resize-none focus:outline-none"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${accent}25`,
                          }}
                        />
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setStep(1)}
                          className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-400 transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep(3)}
                          className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2"
                          style={{ background: `linear-gradient(135deg, ${accent}, #FFB347)`, color: "#000" }}
                        >
                          Configure Project
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* ── Step 3: Package & Launch ── */}
                  {step === 3 && (
                    <div className="space-y-5">
                      {/* Package selection */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                          Select Package
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {PACKAGES.map((pkg) => (
                            <button
                              key={pkg.id}
                              type="button"
                              onClick={() => setSelectedPackage(pkg.id)}
                              className="relative rounded-xl p-3 text-left transition-all hover:scale-[1.02] border"
                              style={
                                selectedPackage === pkg.id
                                  ? { background: `${pkg.color}18`, borderColor: `${pkg.color}60`, boxShadow: `0 0 20px ${pkg.color}20` }
                                  : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }
                              }
                            >
                              {selectedPackage === pkg.id && (
                                <div
                                  className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                                  style={{ background: pkg.color }}
                                >
                                  <Check className="w-2.5 h-2.5 text-black" />
                                </div>
                              )}
                              <p className="font-bold text-white text-xs leading-tight">{pkg.label}</p>
                              <p className="font-black mt-0.5 text-sm" style={{ color: pkg.color }}>{pkg.price}</p>
                              <p className="text-gray-600 text-[10px] mt-0.5 leading-tight">{pkg.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Display technology */}
                      <div>
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">
                          Display Technology
                        </p>
                        <div className="space-y-2">
                          {DISPLAY_TECHS.map((tech) => (
                            <button
                              key={tech.id}
                              type="button"
                              onClick={() => setSelectedTech(tech.id)}
                              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left"
                              style={
                                selectedTech === tech.id
                                  ? { background: `${tech.color}14`, borderColor: `${tech.color}50` }
                                  : { background: "rgba(255,255,255,0.03)", borderColor: "rgba(255,255,255,0.08)" }
                              }
                            >
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-2 h-2 rounded-full"
                                  style={{ background: selectedTech === tech.id ? tech.color : "#374151" }}
                                />
                                <span className="text-white text-xs font-semibold">{tech.label}</span>
                                <span
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                  style={{ background: `${tech.color}18`, color: tech.color }}
                                >
                                  {tech.badge}
                                </span>
                              </div>
                              {selectedTech === tech.id && (
                                <Check className="w-3.5 h-3.5" style={{ color: tech.color }} />
                              )}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Target date */}
                      <div>
                        <label className="block text-xs text-gray-500 mb-1.5">Target show date (optional)</label>
                        <input
                          type="date"
                          value={targetDate}
                          onChange={(e) => setTargetDate(e.target.value)}
                          className="w-full rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                          style={{
                            background: "rgba(255,255,255,0.05)",
                            border: `1px solid ${accent}25`,
                            colorScheme: "dark",
                          }}
                        />
                      </div>

                      {/* Summary */}
                      <div
                        className="rounded-xl p-4"
                        style={{ background: `${accent}09`, border: `1px solid ${accent}20` }}
                      >
                        <p className="text-xs text-gray-500 mb-2 font-semibold uppercase tracking-wide">Project Summary</p>
                        <div className="space-y-1">
                          {[
                            { icon: Music,   label: "Artist",    value: artistName },
                            { icon: Film,    label: "Photos",    value: `${photos.length} reference photos captured` },
                            { icon: Zap,     label: "Package",   value: PACKAGES.find((p) => p.id === selectedPackage)?.label ?? "—" },
                            { icon: Monitor, label: "Display",   value: DISPLAY_TECHS.find((t) => t.id === selectedTech)?.label ?? "—" },
                            ...(artistGenre ? [{ icon: Globe, label: "Genre", value: artistGenre }] : []),
                          ].map(({ icon: Icon, label, value }) => (
                            <div key={label} className="flex items-center gap-2 text-xs">
                              <Icon className="w-3.5 h-3.5 flex-shrink-0 text-gray-600" />
                              <span className="text-gray-500 w-16 flex-shrink-0">{label}</span>
                              <span className="text-white font-medium truncate">{value}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setStep(2)}
                          className="flex-1 py-2.5 rounded-xl font-semibold text-sm text-gray-400 transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          onClick={openHologramEngine}
                          disabled={!canLaunch}
                          className="flex-2 flex-1 py-2.5 px-4 rounded-xl font-black text-sm transition-all hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:scale-100 flex items-center justify-center gap-2"
                          style={canLaunch
                            ? { background: `linear-gradient(135deg, ${accent}, #FFB347)`, color: "#000", boxShadow: `0 0 24px ${accent}40` }
                            : { background: "rgba(255,255,255,0.06)", color: "#6b7280" }}
                        >
                          <Sparkles className="w-4 h-4" />
                          Start My Hologram Project
                          <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
