import { useState, useEffect, useRef } from "react";
import { Header } from "../components/layout/header";
import { motion, AnimatePresence } from "framer-motion";
import { PlanTierGuard } from "../components/youtube-views/plan-tier-guard";
import { isAdminEmail } from "../../../shared/constants";
import { useUser } from "@clerk/clerk-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Progress } from "../components/ui/progress";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import {
  ArrowLeft, Shirt, Video, Wand2, Download, Play,
  Loader2, ImageIcon, Sparkles, Camera, X,
  Palette, Eye, Zap, Star, Crown, Film, Search,
  RefreshCw, ExternalLink, ChevronRight, Check, Info
} from "lucide-react";
import { useToast } from "../hooks/use-toast";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../hooks/use-auth";

// Types
type ViewMode = "dashboard" | "tryon" | "video" | "stylist" | "lookgen" | "portfolio" | "imagegen" | "charpack";

interface Artist {
  id: number;
  name: string;
  artistName?: string;
  profileImage?: string;
  coverImage?: string;
  biography?: string;
  genres?: string[];
  country?: string;
  firestoreId?: string;
}

const artistDisplayName = (a: Artist) => a.artistName || a.name || "Artist";

async function uploadImageFile(file: File): Promise<string> {
  const reader = new FileReader();
  return new Promise((resolve, reject) => {
    reader.onload = async (e) => {
      try {
        const base64 = (e.target?.result as string).split(",")[1];
        const res = await fetch("/api/upload-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ imageData: base64, fileName: file.name, folder: "fashion-studio" }),
        });
        const json = await res.json();
        if (json.imageUrl) resolve(json.imageUrl);
        else reject(new Error(json.error || "Upload failed"));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const SESSIONS = [
  {
    key: "imagegen" as ViewMode,
    label: "Image Generator",
    desc: "Create stunning fashion images with Flux Pro AI",
    icon: ImageIcon,
    gradient: "from-fuchsia-600 via-pink-600 to-rose-600",
    glow: "shadow-fuchsia-500/25",
    badge: "FLUX PRO",
  },
  {
    key: "tryon" as ViewMode,
    label: "Virtual Try-On",
    desc: "See artist wearing any outfit with AI",
    icon: Shirt,
    gradient: "from-amber-500 via-orange-500 to-yellow-500",
    glow: "shadow-amber-500/25",
    badge: "IDM-VTON",
  },
  {
    key: "video" as ViewMode,
    label: "Fashion Video",
    desc: "Generate cinematic fashion videos with Kling v3 Pro",
    icon: Film,
    gradient: "from-purple-600 via-violet-600 to-indigo-600",
    glow: "shadow-purple-500/25",
    badge: "KLING V3 PRO",
  },
  {
    key: "stylist" as ViewMode,
    label: "AI Stylist",
    desc: "Color analysis, style score & fashion advice",
    icon: Palette,
    gradient: "from-sky-500 via-cyan-500 to-teal-500",
    glow: "shadow-sky-500/25",
    badge: "GPT-4o VISION",
  },
  {
    key: "lookgen" as ViewMode,
    label: "Look Generator",
    desc: "AI-designed outfits: 4-image set from your style DNA",
    icon: Wand2,
    gradient: "from-emerald-500 via-green-500 to-lime-500",
    glow: "shadow-emerald-500/25",
    badge: "4 IMAGES",
  },
  {
    key: "charpack" as ViewMode,
    label: "Character Pack",
    desc: "Generate 4 signature photos using your artist profile image as reference",
    icon: Camera,
    gradient: "from-cyan-500 via-sky-500 to-blue-600",
    glow: "shadow-cyan-500/25",
    badge: "4 IMAGES · AI",
  },
  {
    key: "portfolio" as ViewMode,
    label: "Portfolio Gallery",
    desc: "Browse all your generated fashion content",
    icon: Star,
    gradient: "from-zinc-500 via-stone-400 to-neutral-400",
    glow: "shadow-zinc-400/20",
    badge: "GALLERY",
  },
] as const;

function FashionBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 z-0">
      <div className="absolute top-[-10%] left-[-10%] w-[700px] h-[700px] rounded-full bg-fuchsia-600/[0.07] blur-[160px]" />
      <div className="absolute bottom-[-15%] right-[-10%] w-[800px] h-[800px] rounded-full bg-amber-500/[0.06] blur-[180px]" />
      <div className="absolute top-[40%] left-[35%] w-[500px] h-[500px] rounded-full bg-rose-500/[0.04] blur-[130px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
    </div>
  );
}

function ArtistSelector({ artists, selectedId, onSelect }: {
  artists: Artist[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const selected = artists.find((a) => a.id === selectedId);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className="text-xs font-semibold text-zinc-500 uppercase tracking-widest hidden sm:block">Artist</span>
      {/* Avatar preview */}
      {selected?.profileImage && (
        <img
          src={selected.profileImage}
          alt={artistDisplayName(selected)}
          className="w-7 h-7 rounded-full object-cover ring-2 ring-fuchsia-500/40 shrink-0"
        />
      )}
      <div className="relative">
        <select
          value={selectedId ?? ''}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="appearance-none bg-white/5 border border-white/10 rounded-full text-sm text-white pl-3 pr-8 py-1.5 focus:outline-none focus:border-fuchsia-500/50 cursor-pointer min-w-[140px]"
        >
          {artists.map((a) => (
            <option key={a.id} value={a.id} style={{ backgroundColor: '#0d0d12', color: '#fff' }}>
              {artistDisplayName(a)}
            </option>
          ))}
        </select>
        <ChevronRight className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 rotate-90 pointer-events-none" />
      </div>
    </div>
  );
}

function UploadZone({ onUpload, label }: { onUpload: (url: string) => void; label: string }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadImageFile(file);
      onUpload(url);
    } catch {
      // silent
    } finally {
      setUploading(false);
    }
  };

  return (
    <div
      onClick={() => fileRef.current?.click()}
      className="relative border-2 border-dashed border-white/15 rounded-xl p-6 cursor-pointer hover:border-fuchsia-500/40 transition-all group text-center min-h-[100px] flex flex-col items-center justify-center"
    >
      {uploading ? (
        <Loader2 className="w-6 h-6 text-fuchsia-400 animate-spin" />
      ) : (
        <Camera className="w-6 h-6 text-zinc-500 group-hover:text-fuchsia-400 transition-colors" />
      )}
      <p className="text-xs text-zinc-500 group-hover:text-zinc-300 mt-2 transition-colors">{label}</p>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
    </div>
  );
}

function DashboardView({ artist, onNav }: { artist: Artist | undefined; onNav: (v: ViewMode) => void }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      {/* ── HERO ── */}
      <div className="relative mb-10 overflow-hidden rounded-3xl border border-white/8 min-h-[220px]">
        {/* Background layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-900/70 via-black/85 to-amber-900/50" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(192,38,211,0.15),transparent_60%)]" />
        {artist?.coverImage && (
          <img src={artist.coverImage} alt="cover" className="absolute inset-0 w-full h-full object-cover opacity-25 scale-105 blur-[2px]" />
        )}
        {/* Decorative glow */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-fuchsia-600/20 blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full bg-amber-500/15 blur-[60px] pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center gap-6 p-8">
          {/* Profile image */}
          <div className="relative shrink-0">
            {artist?.profileImage ? (
              <div className="w-28 h-28 rounded-2xl overflow-hidden ring-2 ring-fuchsia-500/60 shadow-2xl shadow-fuchsia-500/30">
                <img src={artist.profileImage} alt={artistDisplayName(artist)} className="w-full h-full object-cover" />
              </div>
            ) : (
              <div className="w-28 h-28 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-amber-600 flex items-center justify-center shadow-2xl">
                <Crown className="w-12 h-12 text-white" />
              </div>
            )}
            <div className="absolute -bottom-2 -right-2 bg-gradient-to-br from-fuchsia-600 to-pink-600 rounded-full p-1.5 shadow-lg">
              <Sparkles className="w-3.5 h-3.5 text-white" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge className="bg-fuchsia-600/25 text-fuchsia-300 border-fuchsia-500/40 text-[10px] font-bold tracking-wider">✦ AI FASHION STUDIO</Badge>
              {artist?.genres && artist.genres.length > 0 && (
                <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px]">{artist.genres[0]}</Badge>
              )}
              {artist?.country && (
                <Badge className="bg-white/5 text-zinc-400 border-white/10 text-[10px]">{artist.country}</Badge>
              )}
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none">
              {artist ? artistDisplayName(artist) : "Your"}
            </h1>
            <p className="text-fuchsia-300/80 text-sm font-semibold mt-1 tracking-wide">Fashion Studio</p>
            {artist?.biography && (
              <p className="text-zinc-500 text-xs mt-2 leading-relaxed line-clamp-2 max-w-lg">{artist.biography}</p>
            )}
            <p className="text-zinc-500 text-xs mt-3">Select a tool below to create AI-powered fashion content for your artist</p>
          </div>

          {/* Quick CTA */}
          <div className="flex flex-col gap-2 shrink-0">
            <Button
              onClick={() => onNav("charpack")}
              size="sm"
              className="bg-gradient-to-r from-cyan-600 to-sky-600 hover:opacity-90 text-white text-xs font-bold whitespace-nowrap"
            >
              <Camera className="w-3.5 h-3.5 mr-1.5" />Generate 4 Photos
            </Button>
            <Button
              onClick={() => onNav("imagegen")}
              size="sm"
              variant="outline"
              className="border-fuchsia-500/30 text-fuchsia-300 hover:bg-fuchsia-600/10 text-xs font-bold"
            >
              <Sparkles className="w-3.5 h-3.5 mr-1.5" />Fashion Images
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SESSIONS.map((s, i) => (
          <motion.div
            key={s.key}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.07 }}
            onClick={() => onNav(s.key)}
            className={`group cursor-pointer rounded-2xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] p-6 transition-all hover:shadow-xl ${s.glow} hover:border-white/15 relative overflow-hidden`}
          >
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className={`absolute inset-0 bg-gradient-to-br ${s.gradient} opacity-[0.06] rounded-2xl`} />
            </div>
            <div className="relative z-10">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                <s.icon className="w-5 h-5 text-white" />
              </div>
              <Badge className="bg-white/5 text-white/40 border-white/10 text-[9px] font-mono mb-2">{s.badge}</Badge>
              <h3 className="font-bold text-white text-base mb-1">{s.label}</h3>
              <p className="text-zinc-500 text-xs leading-relaxed">{s.desc}</p>
              <div className="flex items-center gap-1 mt-4 text-xs text-zinc-500 group-hover:text-zinc-300 transition-colors">
                Open studio <ChevronRight className="w-3 h-3" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function ImageGeneratorView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [prompt, setPrompt] = useState("");
  const [numImages, setNumImages] = useState(4);
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);

  const PRESETS = [
    "Luxury streetwear editorial shoot, dramatic lighting",
    "Red carpet couture gown, glamorous Hollywood pose",
    "High fashion magazine cover, sharp cinematic lighting",
    "Avant-garde runway look, architectural silhouette",
    "Urban athleisure, golden hour, dynamic pose",
    "Y2K cyber aesthetic, holographic textures, neon",
  ];

  const generate = async () => {
    if (!prompt.trim()) { toast({ title: "Enter a prompt", variant: "destructive" }); return; }
    setLoading(true);
    setImages([]);
    try {
      const res = await fetch("/api/fashion/generate-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          prompt,
          artistId: artist?.id,
          artistName: artist ? artistDisplayName(artist) : undefined,
          numImages,
          imageSize: "portrait_4_3",
          sessionTitle: `${prompt.substring(0, 50)} - ${artist ? artistDisplayName(artist) : "Artist"}`,
        }),
      });
      const data = await res.json();
      if (data.success && data.images?.length > 0) {
        setImages(data.images);
        toast({ title: `${data.images.length} images generated`, description: "Saved to artist gallery" });
      } else {
        toast({ title: "Generation failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-fuchsia-600 to-pink-600 flex items-center justify-center">
          <ImageIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Image Generator</h2>
          <p className="text-xs text-zinc-400">Flux Pro Kontext - Saves to Artist Gallery</p>
        </div>
        <Badge className="ml-auto bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/30 text-[10px]">FLUX PRO</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button key={p} onClick={() => setPrompt(p)} className="text-[11px] px-2.5 py-1 rounded-full border border-white/10 text-zinc-400 hover:border-fuchsia-500/40 hover:text-fuchsia-300 transition-all">
            {p.substring(0, 34)}...
          </button>
        ))}
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the fashion scene, outfit, style, lighting..."
        className="bg-white/5 border-white/10 text-white placeholder:text-zinc-600 min-h-[80px] resize-none focus:border-fuchsia-500/40"
      />

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Images:</span>
          {[1, 2, 4].map((n) => (
            <button key={n} onClick={() => setNumImages(n)} className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${numImages === n ? "bg-fuchsia-600 border-fuchsia-500 text-white" : "border-white/10 text-zinc-400 hover:border-white/20"}`}>{n}</button>
          ))}
        </div>
        <Button onClick={generate} disabled={loading} className="ml-auto bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:opacity-90 text-white font-bold">
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating...</> : <><Sparkles className="w-4 h-4 mr-2" />Generate</>}
        </Button>
      </div>

      {loading && (
        <div className="rounded-xl border border-fuchsia-500/20 bg-fuchsia-950/20 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-fuchsia-400 animate-pulse" />
            <span className="text-sm text-fuchsia-300 font-semibold">Crafting your fashion imagery...</span>
          </div>
          <p className="text-xs text-zinc-500">Flux Pro Kontext - Takes 20-40s</p>
        </div>
      )}

      {images.length > 0 && (
        <div className={`grid gap-3 ${images.length === 1 ? "grid-cols-1 max-w-md" : "grid-cols-2"}`}>
          {images.map((url, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden aspect-[4/3] bg-zinc-900">
              <img src={url} alt={`fashion ${i + 1}`} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <a href={url} download target="_blank" rel="noreferrer">
                  <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white"><Download className="w-3.5 h-3.5 mr-1" />Save</Button>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function VirtualTryOnView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [modelImageUrl, setModelImageUrl] = useState<string>("");
  const [clothingImageUrl, setClothingImageUrl] = useState<string>("");
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (artist?.profileImage && !modelImageUrl) setModelImageUrl(artist.profileImage);
  }, [artist?.profileImage]);

  const runTryOn = async () => {
    if (!modelImageUrl) { toast({ title: "Upload a model photo", variant: "destructive" }); return; }
    if (!clothingImageUrl) { toast({ title: "Upload a clothing photo", variant: "destructive" }); return; }
    setLoading(true);
    setResultUrl(null);
    try {
      const res = await fetch("/api/fashion/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          modelImageUrl,
          clothingImageUrl,
          artistId: artist?.id,
          artistName: artist ? artistDisplayName(artist) : undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.resultImageUrl) {
        setResultUrl(data.resultImageUrl);
        toast({ title: "Try-on complete!", description: "Saved to artist gallery" });
      } else {
        toast({ title: "Try-on failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <Shirt className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Virtual Try-On</h2>
          <p className="text-xs text-zinc-400">IDM-VTON - See artist in any outfit</p>
        </div>
        <Badge className="ml-auto bg-amber-600/20 text-amber-300 border-amber-500/30 text-[10px]">IDM-VTON</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-400 mb-2 font-medium">Model Photo</p>
          {modelImageUrl && (
            <div className="relative mb-2">
              <img src={modelImageUrl} alt="model" className="w-full aspect-[3/4] object-cover rounded-xl ring-1 ring-amber-500/20" />
              <button onClick={() => setModelImageUrl("")} className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
            </div>
          )}
          {!modelImageUrl && <UploadZone onUpload={setModelImageUrl} label="Upload model photo" />}
          {artist?.profileImage && !modelImageUrl && (
            <button onClick={() => setModelImageUrl(artist.profileImage!)} className="mt-2 w-full text-xs text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Use artist profile photo
            </button>
          )}
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-2 font-medium">Clothing Photo</p>
          {clothingImageUrl ? (
            <div className="relative mb-2">
              <img src={clothingImageUrl} alt="clothing" className="w-full aspect-[3/4] object-cover rounded-xl ring-1 ring-amber-500/20" />
              <button onClick={() => setClothingImageUrl("")} className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
            </div>
          ) : (
            <UploadZone onUpload={setClothingImageUrl} label="Upload clothing photo" />
          )}
        </div>
      </div>

      <Button onClick={runTryOn} disabled={loading || !modelImageUrl || !clothingImageUrl} className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white font-bold h-12">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Processing Try-On...</> : <><Shirt className="w-4 h-4 mr-2" />Generate Try-On</>}
      </Button>

      {loading && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 text-center">
          <p className="text-xs text-amber-300">IDM-VTON is dressing your artist... ~30-60s</p>
        </div>
      )}

      {resultUrl && (
        <div className="rounded-xl overflow-hidden ring-1 ring-amber-500/30">
          <img src={resultUrl} alt="try-on result" className="w-full" />
          <div className="flex gap-2 p-3 bg-black/40">
            <a href={resultUrl} download target="_blank" rel="noreferrer" className="flex-1">
              <Button size="sm" variant="outline" className="w-full border-amber-500/30 text-amber-300 hover:bg-amber-500/10">
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function FashionVideoView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [prompt, setPrompt] = useState("Walking confidently down a runway, cinematic lighting, slow motion");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const PRESET_PROMPTS = [
    "Walking confidently down a runway, cinematic lighting, slow motion",
    "Dancing in a fashion studio, fluid movement, dramatic shadows",
    "Spinning slowly, fabrics flowing, golden hour light",
    "Walking through city streets, editorial style, atmospheric haze",
    "Posing dramatically, camera swirling, luxury fashion video",
  ];

  useEffect(() => {
    if (artist?.profileImage && !imageUrl) setImageUrl(artist.profileImage);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [artist?.profileImage]);

  const pollStatus = async (id: string) => {
    try {
      const res = await fetch(`/api/fashion/video-status/${id}`, { credentials: "include" });
      const data = await res.json();
      if (data.status === "completed" && data.videoUrl) {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        setVideoUrl(data.videoUrl);
        toast({ title: "Fashion video ready!", description: "Saved to artist profile videos" });
      } else if (data.status === "failed") {
        if (pollRef.current) clearInterval(pollRef.current);
        setPolling(false);
        toast({ title: "Video generation failed", variant: "destructive" });
      }
    } catch { /* keep polling */ }
  };

  const startVideo = async () => {
    if (!imageUrl) { toast({ title: "Upload a source image", variant: "destructive" }); return; }
    setLoading(true);
    setVideoUrl(null);
    setVideoId(null);
    try {
      const res = await fetch("/api/fashion/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageUrl,
          prompt,
          artistId: artist?.id,
          artistName: artist ? artistDisplayName(artist) : undefined,
          duration: "5",
        }),
      });
      const data = await res.json();
      if (data.success && data.videoId) {
        setVideoId(data.videoId);
        setPolling(true);
        toast({ title: "Video queued", description: "Kling v3 Pro is processing..." });
        pollRef.current = setInterval(() => pollStatus(data.videoId), 6000);
      } else if (data.success && data.videoUrl) {
        setVideoUrl(data.videoUrl);
        toast({ title: "Video ready!", description: "Saved to artist videos" });
      } else {
        toast({ title: "Failed to start video", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
          <Film className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Fashion Video</h2>
          <p className="text-xs text-zinc-400">Kling v3 Pro - Saves to Artist Videos</p>
        </div>
        <Badge className="ml-auto bg-purple-600/20 text-purple-300 border-purple-500/30 text-[10px]">KLING V3 PRO</Badge>
      </div>

      <div>
        <p className="text-xs text-zinc-400 mb-2 font-medium">Source Image</p>
        {imageUrl ? (
          <div className="relative mb-2">
            <img src={imageUrl} alt="source" className="w-full max-w-xs aspect-[3/4] object-cover rounded-xl ring-1 ring-purple-500/20" />
            <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
          </div>
        ) : (
          <UploadZone onUpload={setImageUrl} label="Upload source fashion image" />
        )}
        {artist?.profileImage && !imageUrl && (
          <button onClick={() => setImageUrl(artist.profileImage!)} className="mt-2 text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
            <Check className="w-3 h-3" /> Use artist profile photo
          </button>
        )}
      </div>

      <div>
        <p className="text-xs text-zinc-400 mb-2 font-medium">Motion prompt</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {PRESET_PROMPTS.map((p) => (
            <button key={p} onClick={() => setPrompt(p)} className={`text-[11px] px-2.5 py-1 rounded-full border transition-all ${prompt === p ? "border-purple-500/60 text-purple-300 bg-purple-600/15" : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"}`}>
              {p.substring(0, 40)}...
            </button>
          ))}
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Describe the motion and style..."
          rows={2}
          className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-4 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500/40 resize-none"
        />
      </div>

      <Button onClick={startVideo} disabled={loading || polling || !imageUrl} className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-90 text-white font-bold h-12">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Starting...</> : polling ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating video...</> : <><Film className="w-4 h-4 mr-2" />Generate Fashion Video</>}
      </Button>

      {polling && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            <span className="text-sm text-purple-300 font-semibold">Kling v3 Pro is rendering your fashion video...</span>
          </div>
          <p className="text-xs text-zinc-500">Usually 2-4 minutes - Will appear in artist videos when ready</p>
        </div>
      )}

      {videoUrl && (
        <div className="rounded-xl overflow-hidden ring-1 ring-purple-500/30">
          <video src={videoUrl} controls loop className="w-full" />
          <div className="flex gap-2 p-3 bg-black/40">
            <a href={videoUrl} download target="_blank" rel="noreferrer" className="flex-1">
              <Button size="sm" variant="outline" className="w-full border-purple-500/30 text-purple-300 hover:bg-purple-500/10">
                <Download className="w-3.5 h-3.5 mr-1.5" />Download
              </Button>
            </a>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function AIStylstView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [imageUrl, setImageUrl] = useState<string>("");
  const [analysisNote, setAnalysisNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (artist?.profileImage && !imageUrl) setImageUrl(artist.profileImage);
  }, [artist?.profileImage]);

  const analyze = async () => {
    if (!imageUrl) { toast({ title: "Upload or select an image", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/fashion/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageUrl, artistName: artist ? artistDisplayName(artist) : undefined, notes: analysisNote }),
      });
      const data = await res.json();
      if (data.success || data.analysis) {
        setResult(data.analysis || data);
        toast({ title: "Style analysis complete!" });
      } else {
        toast({ title: "Analysis failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
          <Eye className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">AI Stylist</h2>
          <p className="text-xs text-zinc-400">GPT-4o Vision - Color analysis, style score & advice</p>
        </div>
        <Badge className="ml-auto bg-sky-600/20 text-sky-300 border-sky-500/30 text-[10px]">GPT-4o VISION</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          {imageUrl && (
            <div className="relative mb-2">
              <img src={imageUrl} alt="to analyze" className="w-full aspect-[3/4] object-cover rounded-xl ring-1 ring-sky-500/20" />
              <button onClick={() => setImageUrl("")} className="absolute top-2 right-2 bg-black/60 rounded-full p-1"><X className="w-3 h-3 text-white" /></button>
            </div>
          )}
          {!imageUrl && <UploadZone onUpload={setImageUrl} label="Upload fashion photo" />}
          {artist?.profileImage && (
            <button onClick={() => setImageUrl(artist.profileImage!)} className="mt-2 text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 w-full justify-center">
              <Check className="w-3 h-3" /> Use artist profile photo
            </button>
          )}
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-xs text-zinc-400 mb-2 font-medium">Optional context</p>
            <textarea
              value={analysisNote}
              onChange={(e) => setAnalysisNote(e.target.value)}
              placeholder="Add context: genre, event type, target aesthetic..."
              rows={3}
              className="w-full rounded-xl border border-white/10 bg-white/5 text-white text-sm px-4 py-2.5 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500/40 resize-none"
            />
          </div>
          <Button onClick={analyze} disabled={loading || !imageUrl} className="w-full bg-gradient-to-r from-sky-500 to-teal-500 hover:opacity-90 text-white font-bold">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Analyzing...</> : <><Search className="w-4 h-4 mr-2" />Analyze Style</>}
          </Button>
        </div>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {result.styleScore !== undefined && (
            <div className="rounded-xl border border-sky-500/20 bg-sky-950/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">Style Score</span>
                <span className="text-2xl font-black text-sky-400">{result.styleScore}<span className="text-sm text-zinc-500">/10</span></span>
              </div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-sky-500 to-teal-400 rounded-full" style={{ width: `${(result.styleScore / 10) * 100}%` }} />
              </div>
            </div>
          )}
          {result.colorPalette && result.colorPalette.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold text-zinc-400 mb-3">Color Palette</p>
              <div className="flex gap-2 flex-wrap">
                {result.colorPalette.map((c: string, i: number) => (
                  <div key={i} className="flex items-center gap-1.5 bg-white/5 rounded-full px-2.5 py-1">
                    <div className="w-3.5 h-3.5 rounded-full ring-1 ring-white/20" style={{ backgroundColor: c.startsWith("#") ? c : `#${c}` }} />
                    <span className="text-[11px] text-zinc-300 font-mono">{c}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.suggestions && result.suggestions.length > 0 && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
              <p className="text-xs font-semibold text-zinc-400 mb-3">Stylist Advice</p>
              <ul className="space-y-2">
                {result.suggestions.map((s: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Sparkles className="w-3.5 h-3.5 text-sky-400 mt-0.5 shrink-0" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!result.styleScore && !result.suggestions && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {typeof result === "string" ? result : JSON.stringify(result, null, 2)}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

function LookGeneratorView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [occasion, setOccasion] = useState("Vogue cover editorial");
  const [mood, setMood] = useState("Haute couture, confident");
  const [monochrome, setMonochrome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const OCCASIONS = ["Vogue cover editorial", "Chanel haute couture campaign", "Red carpet couture", "Avant-garde studio editorial", "Album cover"];
  const MOODS = ["Haute couture, confident", "Dark and mysterious", "Soft romantic couture", "Bold and dramatic", "Minimalist quiet luxury"];

  const generate = async () => {
    if (!artist) { toast({ title: "Select an artist first", variant: "destructive" }); return; }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/fashion/generate-complete-look", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          artistName: artistDisplayName(artist),
          biography: artist.biography || "Emerging music artist",
          genre: artist.genres?.[0] || "pop",
          subgenres: artist.genres?.slice(1) || [],
          profileImageUrl: artist.profileImage,
          occasion,
          mood,
          monochrome,
          artistId: artist.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
        toast({ title: "Look generated!", description: `${data.totalGenerated} images - Saved to artist gallery` });
      } else {
        toast({ title: "Look generation failed", description: data.error, variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-lime-500 flex items-center justify-center">
          <Wand2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Look Generator</h2>
          <p className="text-xs text-zinc-400">Vogue / Chanel haute-couture editorial — your artist as a real model (GPT Image 1)</p>
        </div>
        <Badge className="ml-auto bg-emerald-600/20 text-emerald-300 border-emerald-500/30 text-[10px]">4 IMAGES</Badge>
      </div>

      {artist ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-3">
          {artist.profileImage && <img src={artist.profileImage} alt={artistDisplayName(artist)} className="w-10 h-10 rounded-lg object-cover" />}
          <div>
            <p className="text-sm font-semibold text-white">{artistDisplayName(artist)}</p>
            <p className="text-[11px] text-emerald-400/70">{artist.genres?.join(", ") || "Artist"}</p>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center text-zinc-400 text-sm">Select an artist to generate their signature look</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-zinc-400 mb-2 font-medium">Occasion</p>
          <div className="flex flex-wrap gap-2">
            {OCCASIONS.map((o) => (
              <button key={o} onClick={() => setOccasion(o)} className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${occasion === o ? "border-emerald-500/60 text-emerald-300 bg-emerald-600/15" : "border-white/10 text-zinc-500 hover:border-white/20"}`}>{o}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-zinc-400 mb-2 font-medium">Mood / Vibe</p>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => (
              <button key={m} onClick={() => setMood(m)} className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${mood === m ? "border-emerald-500/60 text-emerald-300 bg-emerald-600/15" : "border-white/10 text-zinc-500 hover:border-white/20"}`}>{m}</button>
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setMonochrome((v) => !v)}
        className={`w-full flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${monochrome ? "border-zinc-200/40 bg-white/[0.06]" : "border-white/10 bg-white/[0.02] hover:border-white/20"}`}
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-white">Black &amp; white editorial</p>
          <p className="text-[11px] text-zinc-400">Fine-art monochrome, couture film grain (Vogue Italia style)</p>
        </div>
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${monochrome ? "bg-zinc-100" : "bg-zinc-700"}`}>
          <span className={`inline-block h-5 w-5 transform rounded-full bg-zinc-950 transition-transform ${monochrome ? "translate-x-5" : "translate-x-0.5"}`} />
        </span>
      </button>

      <Button onClick={generate} disabled={loading || !artist} className="w-full bg-gradient-to-r from-emerald-500 to-lime-500 hover:opacity-90 text-black font-bold h-12">
        {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating 4 looks...</> : <><Wand2 className="w-4 h-4 mr-2" />Generate Signature Look</>}
      </Button>

      {loading && (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 text-center">
          <p className="text-sm text-emerald-300 font-semibold mb-1">AI is directing your couture editorial...</p>
          <p className="text-xs text-zinc-500">GPT-4o styling + GPT Image 1 likeness - ~60-120 seconds</p>
        </div>
      )}

      {result && result.images && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          {result.lookJSON?.lookConcept && (
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 mb-4">
              <p className="text-sm font-bold text-white mb-1">{result.lookJSON.lookConcept.theme}</p>
              <p className="text-xs text-zinc-400">{result.lookJSON.lookConcept.mood} - {result.lookJSON.lookConcept.occasion}</p>
              {result.lookJSON.lookConcept.colorPalette && (
                <div className="flex gap-1.5 mt-2">
                  {result.lookJSON.lookConcept.colorPalette.map((c: string, i: number) => (
                    <div key={i} className="w-5 h-5 rounded-full ring-1 ring-white/10" style={{ backgroundColor: c }} title={c} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            {result.images.map((img: any, i: number) =>
              img.success && img.imageUrl ? (
                <div key={i} className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-zinc-900">
                  <img src={img.imageUrl} alt={`look ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <a href={img.imageUrl} download target="_blank" rel="noreferrer">
                      <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white text-xs"><Download className="w-3 h-3 mr-1" />Save</Button>
                    </a>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                    <p className="text-[10px] text-white/70">Look {i + 1}</p>
                  </div>
                </div>
              ) : (
                <div key={i} className="aspect-[3/4] rounded-xl bg-zinc-900/50 border border-white/5 flex items-center justify-center">
                  <X className="w-6 h-6 text-zinc-700" />
                </div>
              )
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function CharacterPackView({ artist }: { artist: Artist | undefined }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<{ url: string; angle: string; label: string }[]>([]);

  const generate = async () => {
    if (!artist?.profileImage) {
      toast({ title: "No profile image", description: "This artist needs a profile photo to generate the character pack.", variant: "destructive" });
      return;
    }
    setLoading(true);
    setImages([]);
    try {
      const res = await fetch("/api/artist-profile/character-pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          artistId: artist.id,
          artistName: artistDisplayName(artist),
          genre: artist.genres?.[0] || "music",
          profileImageUrl: artist.profileImage,
        }),
      });
      const data = await res.json();
      if (data.success && data.images?.length > 0) {
        setImages(data.images);
        toast({ title: `${data.images.length} images generated!`, description: "Your character pack is ready" });
      } else {
        toast({ title: "Generation failed", description: data.error || "Could not generate images", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-sky-600 flex items-center justify-center">
          <Camera className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Character Pack</h2>
          <p className="text-xs text-zinc-400">4 signature photos · AI Identity Transfer</p>
        </div>
        <Badge className="ml-auto bg-cyan-600/20 text-cyan-300 border-cyan-500/30 text-[10px]">4 IMAGES · AI</Badge>
      </div>

      {/* Artist preview + info */}
      {artist?.profileImage ? (
        <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5 flex items-center gap-5">
          <img
            src={artist.profileImage}
            alt={artistDisplayName(artist)}
            className="w-20 h-20 rounded-xl object-cover ring-2 ring-cyan-500/30 shadow-xl shadow-cyan-500/20 shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-base">{artistDisplayName(artist)}</p>
            <p className="text-zinc-400 text-xs mt-0.5">{artist.genres?.[0] || "Music"}</p>
            <p className="text-zinc-600 text-xs mt-2 leading-relaxed">
              This tool generates <span className="text-cyan-400 font-semibold">4 artistic photos</span> of your artist using their profile image as a visual reference — perfect for social media, EPKs, and press kits.
            </p>
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            className="shrink-0 bg-gradient-to-r from-cyan-600 to-sky-600 hover:opacity-90 text-white font-bold"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating…</>
            ) : (
              <><Camera className="w-4 h-4 mr-2" />Generate 4 Photos</>
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-6 text-center">
          <Camera className="w-8 h-8 text-amber-500/50 mx-auto mb-2" />
          <p className="text-amber-300 text-sm font-semibold">No profile image</p>
          <p className="text-zinc-500 text-xs mt-1">Upload a profile photo for this artist first</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/10 p-6 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <div className="flex gap-1">
              {[0,1,2,3].map((i) => (
                <div key={i} className="w-1.5 h-8 rounded-full bg-cyan-500/60 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          </div>
          <p className="text-cyan-300 text-sm font-semibold">Generating your 4-image character pack…</p>
          <p className="text-zinc-600 text-xs mt-1">Using your profile photo as AI reference · Takes 30–60s</p>
        </div>
      )}

      {/* Results grid */}
      {images.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Generated Character Pack</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {images.map((img, i) => (
              <div key={i} className="group relative rounded-xl overflow-hidden aspect-square bg-zinc-900">
                <img src={img.url} alt={img.angle || `char ${i+1}`} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <a href={img.url} download target="_blank" rel="noreferrer">
                    <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white text-xs">
                      <Download className="w-3 h-3 mr-1" />Save
                    </Button>
                  </a>
                </div>
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-[10px] text-cyan-300/80 font-semibold capitalize">{img.angle || `Photo ${i+1}`}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

function PortfolioView({ artist }: { artist: Artist | undefined }) {
  const { data } = useQuery<any>({
    queryKey: [`/api/fashion/portfolio?userId=${artist?.id}&limit=30`],
    enabled: !!artist?.id,
  });

  const items = data?.portfolio || [];

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-500 to-stone-500 flex items-center justify-center">
          <Star className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Portfolio Gallery</h2>
          <p className="text-xs text-zinc-400">All generated fashion content - {items.length} items</p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-12 text-center">
          <ImageIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No fashion content yet</p>
          <p className="text-zinc-600 text-xs mt-1">Generate images, try-ons, or videos to build your portfolio</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {items.map((item: any, i: number) => (
            <div key={item.id || i} className="group relative rounded-xl overflow-hidden aspect-[3/4] bg-zinc-900">
              {(item.imageUrl || (item.images && item.images[0])) && (
                <img src={item.imageUrl || item.images[0]} alt="portfolio item" className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                {item.imageUrl && (
                  <a href={item.imageUrl} download target="_blank" rel="noreferrer">
                    <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white text-xs"><Download className="w-3 h-3 mr-1" />Save</Button>
                  </a>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-[10px] text-white/60 truncate">{item.title || item.resultType || "Fashion"}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SessionHeader({ session, onBack }: { session: typeof SESSIONS[number]; onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-200 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
      </button>
      <span className="text-zinc-700">/</span>
      <span className={`text-xs font-semibold bg-gradient-to-r ${session.gradient} bg-clip-text text-transparent`}>{session.label}</span>
    </div>
  );
}

export default function ArtistImageAdvisorPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { user: clerkUser } = useUser();
  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress || "";
  const isAdmin = isAdminEmail(userEmail);

  const [viewMode, setViewMode] = useState<ViewMode>("dashboard");
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);

  const { data: artistsData } = useQuery<{ success: boolean; artists: Artist[] }>({
    queryKey: ["/api/artist-generator/my-artists"],
    enabled: !!user,
  });

  useEffect(() => {
    const artists = artistsData?.artists || [];
    if (artists.length > 0 && !selectedArtistId) setSelectedArtistId(artists[0].id);
  }, [artistsData, selectedArtistId]);

  const selectedArtist = artistsData?.artists?.find((a) => a.id === selectedArtistId);
  const activeSession = SESSIONS.find((s) => s.key === viewMode);

  const pageContent = (
    <div className="min-h-screen bg-[#070509] relative overflow-hidden">
      <FashionBackground />
      <div className="relative z-10">
        <Header />

        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4 flex-wrap">
          <Button
            variant="ghost"
            onClick={() => (viewMode === "dashboard" ? setLocation("/") : setViewMode("dashboard"))}
            className="text-zinc-500 hover:text-white text-xs"
            size="sm"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
            {viewMode === "dashboard" ? "Back to Home" : "Back to Dashboard"}
          </Button>

          {artistsData?.artists && artistsData.artists.length > 0 && (
            <ArtistSelector
              artists={artistsData.artists}
              selectedId={selectedArtistId}
              onSelect={(id) => setSelectedArtistId(id)}
            />
          )}
        </div>

        <main className="container mx-auto px-4 py-8 max-w-5xl">
          {activeSession && viewMode !== "dashboard" && (
            <SessionHeader session={activeSession} onBack={() => setViewMode("dashboard")} />
          )}

          <AnimatePresence mode="wait">
            {viewMode === "dashboard" && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <DashboardView artist={selectedArtist} onNav={setViewMode} />
              </motion.div>
            )}
            {viewMode === "imagegen" && (
              <motion.div key="imagegen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ImageGeneratorView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "tryon" && (
              <motion.div key="tryon" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <VirtualTryOnView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "video" && (
              <motion.div key="video" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <FashionVideoView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "stylist" && (
              <motion.div key="stylist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <AIStylstView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "lookgen" && (
              <motion.div key="lookgen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <LookGeneratorView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "charpack" && (
              <motion.div key="charpack" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <CharacterPackView artist={selectedArtist} />
              </motion.div>
            )}
            {viewMode === "portfolio" && (
              <motion.div key="portfolio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <PortfolioView artist={selectedArtist} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </div>
  );

  if (!isAdmin) {
    return (
      <PlanTierGuard
        requiredTier="creator"
        featureName="Artist Fashion Studio"
        featureDescription="Generate AI fashion images, virtual try-ons, fashion videos, and style analysis for your artists."
      >
        {pageContent}
      </PlanTierGuard>
    );
  }

  return pageContent;
}
