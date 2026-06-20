import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bot,
  CalendarDays,
  Camera,
  CameraOff,
  CircleDot,
  Copy,
  CreditCard,
  Disc3,
  Eye,
  Globe2,
  Heart,
  Headphones,
  Image,
  Layers3,
  Loader2,
  Lock,
  Menu,
  Mic2,
  Music2,
  Pause,
  Play,
  Radio,
  Repeat2,
  Save,
  Send,
  Settings,
  Share2,
  ShieldCheck,
  ShoppingBag,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  ArrowRight,
  Check,
  Home as HomeIcon,
  Users,
  Wand2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";
import { useAuth } from "../hooks/use-auth";
import { useDjEngine, type DeckTrack } from "../lib/crowdsync/useDjEngine";

const crowdImage = "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1400&q=80";
const beachDjImage = "https://images.unsplash.com/photo-1540039155733-5bb30b53aa14?auto=format&fit=crop&w=900&q=80";
const stageImage = "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=900&q=80";
const artistImage = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80";
const agentImage = "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80";

type Lang = "en" | "es";
type CrowdMood = "Euforico" | "Subiendo" | "Intenso" | "Elegante";
type CameraStatus = "offline" | "active" | "stopped" | "error" | "permission_denied";
type CameraDetails = {
  deviceLabel?: string | null;
  facingMode?: string | null;
  width?: number;
  height?: number;
  aspectRatio?: number;
  frameRate?: number;
};
type EventConfig = {
  eventName: string;
  eventType: string;
  city: string;
  venue: string;
  people: string;
  duration: string;
  genres: string;
  artist: string;
  visualStyle: string;
  djMode: string;
};
type CrowdSyncFullEvent = {
  event?: any;
  sessions?: any[];
  cameraSessions?: any[];
  readings?: any[];
  actions?: any[];
  generatedAssets?: any[];
  reports?: any[];
};
type NetworkPost = {
  id?: string;
  name: string;
  role: string;
  title: string;
  location: string;
  views: string;
  likes: number;
  image?: string | null;
};
type CrowdSyncDj = {
  id: string;
  name: string;
  style?: string | null;
  city?: string | null;
  genres?: string[] | null;
  image?: string | null;
  eventsCount?: number;
  posts?: number;
  likes?: number;
  lastSetTitle?: string | null;
  lastSetLocation?: string | null;
  score?: number;
};
type BoostifyArtist = {
  id: number;
  name: string;
  artistName?: string | null;
  genre?: string | null;
  genres?: string[] | null;
  image?: string | null;
  country?: string | null;
  isAIGenerated?: boolean;
};
type BoostifySong = {
  id: number;
  userId: number;
  title: string;
  audioUrl: string;
  genre?: string | null;
  mood?: string | null;
  coverArt?: string | null;
  artistName?: string | null;
  artistImage?: string | null;
  aiProvider?: string | null;
  generatedWithAI?: boolean;
  plays?: number;
};
type CrowdSyncProduct = {
  id: string;
  name: string;
  mode: "subscription" | "payment";
  amount: number;
  interval?: string | null;
  description: string;
};

const initialEvent: EventConfig = {
  eventName: "Golden Ocean Night",
  eventType: "Luxury private party",
  city: "Miami",
  venue: "Private Beach Villa",
  people: "250",
  duration: "5 hours",
  genres: "Deep house, Latin house, Afro house",
  artist: "Romy Alvarez",
  visualStyle: "Ocean gold, white silk, blue sky",
  djMode: "Autonomous agent",
};

const tx = {
  en: {
    top: ["Events", "DJ Network", "Artists", "Analytics", "Pricing"],
    side: ["Live Dashboard", "Current Event", "Music Generator", "DJ Agent", "Boostify Artists", "DJ Network", "My Events", "Analytics", "Content", "Settings"],
    liveCrowd: "Live Crowd Intelligence",
    liveAnalysis: "Live analysis",
    nextDrop: "Next drop in",
    genreResponse: "Genre response",
    visualSync: "Visual sync",
    energy: "Energy score",
    dance: "Dance activity",
    density: "Crowd density",
    mood: "Crowd mood",
    bpm: "Current BPM",
    recommended: "Recommended action",
    raiseEnergy: "Raise energy",
    createDrop: "Create drop",
    musicEngine: "AI Music Engine",
    generatorLive: "Live generation engine",
    waveform: "Waveform & Mixer",
    agent: "DJ Agent Control",
    autonomous: "Autonomous DJ",
    artistConnected: "Boostify Artist Connected",
    liveVisuals: "Live Visuals",
    quickActions: "Quick Actions",
    network: "Boostify DJ Network",
    feed: "Feed",
    live: "Live",
    topDjs: "Top DJs",
    currentEvent: "Current Event",
    details: "View Event Details",
    remaining: "Time Remaining",
    finish: "End Event",
    connected: "Connected",
    active: "Active",
    inviteArtists: "Invite Artists",
    inviteDjs: "Invite DJs",
    shareEvent: "Share Event",
    saveMoment: "Save Moment",
    publishClip: "Publish Clip",
    more: "More Options",
    useVoice: "Use Voice",
    createRemix: "Create Remix",
    visuals: "Visuals",
    promote: "Promote",
    generateNext: "Generate Next Track",
    remixLive: "Live Remix",
    upEnergy: "Raise Energy",
    downEnergy: "Lower Energy",
    changeBpm: "Change BPM",
    artistVoice: "Add Artist Voice",
    loop: "Create Loop",
    transition: "Transition",
    saveEvent: "Save Event",
    report: "Generate Report",
    sync: "Synced to music",
    mobileCamera: "Mobile Camera",
    cameraSession: "Camera Session",
    activateCamera: "Activate Camera",
    stopCamera: "Stop Camera",
    scanCrowd: "Scan Crowd",
    copyMobileLink: "Copy Mobile Link",
    cameraActive: "Camera active",
    cameraOffline: "Camera offline",
    cameraPermission: "Camera permission needed",
    mobileReady: "Open this page on your phone and activate the camera.",
    linkCopied: "Mobile camera link copied",
    cameraSaved: "Camera session synced",
    payments: "Stripe Payments",
    activatePro: "Activate Pro",
    eventPass: "Event Pass",
    creditPack: "AI Credit Pack",
    billingActive: "Billing active",
    musicLibrary: "Boostify Music Library",
    artistCatalog: "Artist catalog",
    generateMinimax: "Generate MiniMax Track",
    connectedCharts: "Connected Charts",
    playSong: "Play Song",
    noSongs: "No songs yet",
    generationReady: "Track generated and saved",
    checkoutReady: "Redirecting to Stripe",
  },
  es: {
    top: ["Eventos", "Red de DJs", "Artistas", "Analytics", "Precios"],
    side: ["Panel en Vivo", "Evento Actual", "Generador de Musica", "DJ Agente", "Artistas Boostify", "Red de DJs", "Mis Eventos", "Analytics", "Contenido", "Configuracion"],
    liveCrowd: "Inteligencia del Publico",
    liveAnalysis: "Analisis en tiempo real",
    nextDrop: "Proximo drop en",
    genreResponse: "Respuesta por genero",
    visualSync: "Sincronia visual",
    energy: "Energia",
    dance: "Actividad de baile",
    density: "Densidad del publico",
    mood: "Mood del publico",
    bpm: "BPM actual",
    recommended: "Accion recomendada",
    raiseEnergy: "Subir energia",
    createDrop: "Crear drop",
    musicEngine: "Motor Musical IA",
    generatorLive: "Motor de generacion en vivo",
    waveform: "Waveform y Mixer",
    agent: "Control del DJ Agente",
    autonomous: "DJ autonomo",
    artistConnected: "Artista Boostify Conectado",
    liveVisuals: "Visuales en Vivo",
    quickActions: "Acciones Rapidas",
    network: "Red Boostify DJ",
    feed: "Feed",
    live: "En Vivo",
    topDjs: "Top DJs",
    currentEvent: "Evento Actual",
    details: "Ver detalles del evento",
    remaining: "Tiempo restante",
    finish: "Finalizar evento",
    connected: "Conectado",
    active: "Activo",
    inviteArtists: "Invitar Artistas",
    inviteDjs: "Invitar DJs",
    shareEvent: "Compartir Evento",
    saveMoment: "Guardar Momento",
    publishClip: "Publicar Clip",
    more: "Mas Opciones",
    useVoice: "Usar Voz",
    createRemix: "Crear Remix",
    visuals: "Visuales",
    promote: "Promocionar",
    generateNext: "Generar Proxima Cancion",
    remixLive: "Remix en Vivo",
    upEnergy: "Subir Energia",
    downEnergy: "Bajar Energia",
    changeBpm: "Cambiar BPM",
    artistVoice: "Agregar Voz Artista",
    loop: "Crear Loop",
    transition: "Transicion",
    saveEvent: "Guardar Evento",
    report: "Generar Reporte",
    sync: "Sincronizado con la musica",
    mobileCamera: "Camara Movil",
    cameraSession: "Sesion de Camara",
    activateCamera: "Activar Camara",
    stopCamera: "Detener Camara",
    scanCrowd: "Escanear Publico",
    copyMobileLink: "Copiar Link Movil",
    cameraActive: "Camara activa",
    cameraOffline: "Camara offline",
    cameraPermission: "Permiso de camara requerido",
    mobileReady: "Abre esta pagina en tu movil y activa la camara.",
    linkCopied: "Link de camara movil copiado",
    cameraSaved: "Sesion de camara sincronizada",
    payments: "Pagos Stripe",
    activatePro: "Activar Pro",
    eventPass: "Pase Evento",
    creditPack: "Pack Creditos IA",
    billingActive: "Pago activo",
    musicLibrary: "Biblioteca Musical Boostify",
    artistCatalog: "Catalogo del artista",
    generateMinimax: "Generar Track MiniMax",
    connectedCharts: "Graficas Conectadas",
    playSong: "Reproducir Cancion",
    noSongs: "Sin canciones todavia",
    generationReady: "Track generado y guardado",
    checkoutReady: "Redirigiendo a Stripe",
  },
} as const;

const moodLabel: Record<Lang, Record<CrowdMood, string>> = {
  en: { Euforico: "Euphoric", Subiendo: "Rising", Intenso: "Intense", Elegante: "Elegant" },
  es: { Euforico: "Euforico", Subiendo: "Subiendo", Intenso: "Intenso", Elegante: "Elegante" },
};

const sidebarTargets = [
  "live-dashboard",
  "current-event",
  "music-generator",
  "dj-agent",
  "boostify-artists",
  "dj-network",
  "my-events",
  "analytics",
  "content",
  "settings",
];

const fallbackPosts: NetworkPost[] = [
  { name: "DJ Nova Lux", role: "Streaming live", title: "Sunset Vibes Session", location: "Miami, FL", views: "2.4K", likes: 320, image: stageImage },
  { name: "LUXA VIBE (AI)", role: "Published a new remix", title: "Golden Ocean Remix", location: "Romy Alvarez", views: "1.8K", likes: 215, image: beachDjImage },
  { name: "DJ ElectraMinds", role: "Live event", title: "Tech House Experience", location: "Berlin, Germany", views: "1.2K", likes: 98, image: crowdImage },
];

const visualAssets = [
  { name: "Gold Rain", image: "https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-images%2F1781234660385_vhm6j5.png?alt=media" },
  { name: "Blue Tunnel", image: "https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-images%2F1781234716715_6ml2yg.png?alt=media" },
  { name: "LED Grid", image: "https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-images%2F1781234775701_01b1di.png?alt=media" },
  { name: "Solar Drop", image: "https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/artist-images%2F1781234827185_nnj7ch.png?alt=media" },
];

const fmt = (date = new Date()) => date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function Panel({ title, icon: Icon, children, right, className = "", id }: { title: string; icon: any; children: ReactNode; right?: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`overflow-hidden rounded-lg border border-white/10 bg-[#101418] shadow-[0_12px_35px_rgba(0,0,0,0.35)] ${className}`}>
      <div className="flex h-9 items-center justify-between border-b border-white/10 bg-black/20 px-3">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase text-white">
          <Icon className="h-3.5 w-3.5 text-orange-400" />
          {title}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function MiniWave({ color = "orange", bars = 36 }: { color?: "orange" | "green" | "blue" | "purple"; bars?: number }) {
  const cls = color === "green" ? "bg-emerald-400" : color === "blue" ? "bg-sky-400" : color === "purple" ? "bg-fuchsia-500" : "bg-orange-500";
  return (
    <div className="flex h-full items-end gap-px">
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={`flex-1 rounded-t ${cls}`}
          style={{ height: `${18 + ((index * 19) % 72)}%`, opacity: 0.45 + ((index * 11) % 45) / 100 }}
        />
      ))}
    </div>
  );
}

function MetricTile({ label, value, sub, color = "green" }: { label: string; value: string; sub: string; color?: "green" | "blue" | "purple" | "orange" }) {
  return (
    <div className="min-h-[95px] rounded-md border border-white/10 bg-[#0d1116] p-3">
      <div className="text-[10px] font-bold uppercase text-zinc-400">{label}</div>
      <div className="mt-1 flex items-end justify-between gap-2">
        <div className="min-w-0 break-words text-2xl font-black leading-none text-white sm:text-3xl">{value}</div>
        <span className="text-[10px] text-zinc-300">{sub}</span>
      </div>
      <div className="mt-3 h-5"><MiniWave color={color} bars={34} /></div>
    </div>
  );
}

function IconButton({ icon: Icon, onClick, active = false }: { icon: any; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-md border ${active ? "border-orange-500 bg-orange-500/20 text-orange-200" : "border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white"}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ActionButton({ icon: Icon, label, onClick, active = false }: { icon: any; label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex min-h-[62px] flex-col items-center justify-center gap-1.5 overflow-hidden rounded-xl border px-1 py-2.5 text-center transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 ${active ? "border-orange-500/70 bg-gradient-to-b from-orange-500/30 to-orange-500/[0.08] text-orange-50 shadow-[0_6px_20px_-6px_rgba(249,115,22,0.6)]" : "border-white/10 bg-white/[0.04] text-zinc-200 hover:border-orange-500/40 hover:bg-white/[0.07]"}`}
    >
      <span className="pointer-events-none absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-orange-400/60 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-orange-200" : "text-orange-400 group-hover:text-orange-300"}`} />
      <span className="line-clamp-2 block w-full px-0.5 text-[8.5px] font-bold uppercase leading-[1.1] tracking-tight">{label}</span>
    </button>
  );
}

function ToggleLine({ label, enabled, onClick }: { label: string; enabled: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center justify-between gap-2 text-left">
      <span className="text-[10px] font-bold uppercase text-zinc-400">{label}</span>
      <span className={`h-4 w-8 rounded-full p-0.5 ${enabled ? "bg-emerald-500" : "bg-zinc-700"}`}>
        <span className={`block h-3 w-3 rounded-full bg-white transition ${enabled ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function Sidebar({ t, activeSection, onNavigate, eventTimeLeft, eventName, eventCity, onHome }: { t: typeof tx.en; activeSection: string; onNavigate: (value: string) => void; eventTimeLeft: string; eventName: string; eventCity: string; onHome?: () => void }) {
  const icons = [Activity, CalendarDays, Music2, Bot, Mic2, Users, CalendarDays, BarChart3, Image, Settings];
  return (
    <aside className="hidden w-[244px] shrink-0 flex-col border-r border-white/10 bg-[#090c10] xl:flex">
      <div className="h-16 border-b border-white/10 px-5 py-3">
        <div className="text-2xl font-black tracking-wide text-orange-500">BOOSTIFY</div>
        <div className="text-[10px] uppercase tracking-[0.42em] text-zinc-500">Network</div>
      </div>
      <div className="px-3 py-4">
        {onHome && (
          <button
            onClick={onHome}
            className="mb-3 flex h-9 w-full items-center gap-3 rounded-md border border-white/[0.08] px-3 text-left text-xs text-zinc-500 hover:bg-white/[0.04] hover:text-white transition"
          >
            <HomeIcon className="h-4 w-4" /> Home
          </button>
        )}
        <div className="mb-4 flex items-center gap-2 px-2 text-[10px] font-black uppercase text-orange-400">
          <Disc3 className="h-4 w-4" /> CrowdSync DJ
        </div>
        <div className="space-y-1">
          {t.side.map((item, index) => {
            const id = sidebarTargets[index];
            const Icon = icons[index] || Menu;
            const active = activeSection === id;
            return (
              <button
                key={id}
                onClick={() => onNavigate(id)}
                className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-xs ${active ? "bg-orange-500/25 text-orange-100 shadow-[inset_3px_0_0_#f97316]" : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"}`}
              >
                <Icon className="h-4 w-4" />
                {item}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-auto space-y-3 p-3">
        <div className="rounded-lg border border-white/10 bg-[#101418] p-3">
          <div className="text-[10px] font-black uppercase text-zinc-500">{t.currentEvent}</div>
          <div className="mt-2 flex gap-2">
            <img src={stageImage} alt="Current event" className="h-12 w-12 rounded object-cover" />
            <div className="min-w-0">
              <div className="truncate text-xs font-bold text-white">{eventName || "Golden Ocean Night"}</div>
              <div className="truncate text-[10px] text-zinc-500">{eventCity || "Miami Beach, FL"}</div>
              <div className="mt-1 flex items-center gap-1 text-[9px] font-bold text-red-400">
                <CircleDot className="h-2.5 w-2.5 fill-red-500" /> LIVE
              </div>
            </div>
          </div>
          <button onClick={() => onNavigate("current-event")} className="mt-3 h-8 w-full rounded-md border border-orange-500/40 text-[10px] font-bold text-orange-300 hover:bg-orange-500/10">
            {t.details}
          </button>
        </div>
        <div className="rounded-lg border border-white/10 bg-[#101418] p-3">
          <div className="text-[10px] font-black uppercase text-zinc-500">{t.remaining}</div>
          <div className="mt-2 font-mono text-2xl font-black tabular-nums text-white">{eventTimeLeft}</div>
          <div className="mt-2 h-1 rounded-full bg-white/10"><div className="h-full w-[55%] rounded-full bg-orange-500" /></div>
        </div>
      </div>
    </aside>
  );
}

function TopBar({ t, lang, setLang, onNavigate, onCopyMobileLink, onHome }: { t: typeof tx.en; lang: Lang; setLang: (lang: Lang) => void; onNavigate: (value: string) => void; onCopyMobileLink: () => void; onHome?: () => void }) {
  const targets = ["current-event", "dj-network", "boostify-artists", "analytics", "pricing"];
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 overflow-x-auto border-b border-white/10 bg-[#07090c] px-3 xl:px-6">
      <div className="flex shrink-0 items-center gap-4 xl:gap-8">
        {onHome && (
          <button
            onClick={onHome}
            className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-black text-zinc-400 hover:text-white transition shrink-0"
          >
            <HomeIcon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{lang === 'es' ? 'Inicio' : 'Home'}</span>
          </button>
        )}
        <div className="flex items-center gap-2 text-orange-400">
          <Activity className="h-4 w-4" />
          <span className="text-xs font-black">CrowdSync DJ</span>
        </div>
        <nav className="hidden items-center gap-8 text-xs font-bold text-zinc-500 lg:flex">
          {t.top.map((item, index) => (
            <button key={item} onClick={() => onNavigate(targets[index])} className={index === 0 ? "text-orange-400" : "hover:text-white"}>
              {item}
            </button>
          ))}
        </nav>
      </div>
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1 text-[10px] font-black">
          <button onClick={() => setLang("en")} className={`rounded px-2 py-1 ${lang === "en" ? "bg-orange-500 text-white" : "text-zinc-400"}`}>EN</button>
          <button onClick={() => setLang("es")} className={`rounded px-2 py-1 ${lang === "es" ? "bg-orange-500 text-white" : "text-zinc-400"}`}>ES</button>
        </div>
        <IconButton icon={Radio} onClick={() => onNavigate("music-generator")} />
        <IconButton icon={Globe2} onClick={() => onNavigate("dj-network")} />
        <IconButton icon={Smartphone} onClick={onCopyMobileLink} />
        <img src={beachDjImage} alt="DJ Nova Lux" className="h-9 w-9 rounded-full object-cover ring-2 ring-orange-500/60" />
        <div className="hidden text-right sm:block">
          <div className="text-xs font-bold text-white">DJ Nova Lux</div>
          <div className="text-[10px] text-zinc-500">Pro DJ</div>
        </div>
      </div>
    </header>
  );
}

// ─────────────────────────────────────────────
//  HOMEPAGE — landing view before dashboard
// ─────────────────────────────────────────────
function HomePage({ onLaunch, lang, setLang }: { onLaunch: () => void; lang: Lang; setLang: (v: Lang) => void }) {
  const en = lang === "en";
  return (
    <div className="min-h-screen overflow-auto bg-[#07090c] text-zinc-100">

      {/* ── Sticky top nav ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#07090c]/95 px-4 backdrop-blur-md xl:px-8">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black tracking-wide text-orange-500">BOOSTIFY</span>
          <span className="hidden text-white/20 sm:inline">·</span>
          <span className="hidden items-center gap-2 text-orange-400 sm:flex">
            <Disc3 className="h-4 w-4" />
            <span className="text-sm font-black">CrowdSync DJ</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-white/[0.04] p-1 text-[10px] font-black">
            <button onClick={() => setLang("en")} className={`rounded px-2 py-1 transition ${lang === "en" ? "bg-orange-500 text-white" : "text-zinc-400"}`}>EN</button>
            <button onClick={() => setLang("es")} className={`rounded px-2 py-1 transition ${lang === "es" ? "bg-orange-500 text-white" : "text-zinc-400"}`}>ES</button>
          </div>
          <nav className="hidden items-center gap-6 text-xs font-bold text-zinc-500 md:flex">
            {[
              [en ? "Features" : "Funciones", "#features"],
              [en ? "How It Works" : "Cómo Funciona", "#how"],
              [en ? "Network" : "Red", "#network"],
              [en ? "Pricing" : "Precios", "#pricing"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="hover:text-white transition">{label}</a>
            ))}
          </nav>
          <button
            onClick={onLaunch}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-black uppercase text-white transition hover:bg-orange-500 shadow-[0_0_20px_rgba(249,115,22,0.3)]"
          >
            <Zap className="h-3.5 w-3.5" />
            {en ? "Launch Dashboard" : "Abrir Dashboard"}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pb-24 pt-16 xl:px-8">
        {/* background glows */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-32 -top-32 h-[550px] w-[550px] rounded-full bg-orange-500/8 blur-[130px]" />
          <div className="absolute left-1/4 top-1/2 h-[300px] w-[300px] rounded-full bg-fuchsia-500/6 blur-[100px]" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/25 to-transparent" />
        </div>

        <div className="relative mx-auto max-w-6xl">
          <div className="grid items-center gap-14 xl:grid-cols-[1fr_460px]">

            {/* Left copy */}
            <div className="space-y-7">
              {/* Live badge */}
              <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-300">
                <CircleDot className="h-2.5 w-2.5 fill-orange-400" />
                {en ? "AI-Powered DJ Intelligence · Live" : "Inteligencia DJ con IA · En Vivo"}
              </div>

              <h1 className="text-5xl font-black leading-[0.92] tracking-tight text-white xl:text-[72px]">
                CrowdSync<br />
                <span className="text-orange-500">DJ</span>
              </h1>

              <p className="max-w-[520px] text-base leading-relaxed text-zinc-400">
                {en
                  ? "The AI platform that reads your crowd in real-time, generates tracks on-demand, and lets LUXA VIBE — your autonomous DJ agent — keep the floor alive all night."
                  : "La plataforma IA que lee al público en tiempo real, genera pistas bajo demanda y deja que LUXA VIBE — tu agente DJ autónomo — mantenga el piso vivo toda la noche."}
              </p>

              {/* CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={onLaunch}
                  className="flex items-center gap-2 rounded-xl bg-orange-600 px-7 py-3.5 text-sm font-black uppercase tracking-wide text-white shadow-[0_0_40px_rgba(249,115,22,0.4)] transition hover:bg-orange-500"
                >
                  <Play className="h-4 w-4" />
                  {en ? "Start Live Event" : "Iniciar Evento en Vivo"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  onClick={onLaunch}
                  className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.04] px-7 py-3.5 text-sm font-black uppercase tracking-wide text-zinc-300 transition hover:border-white/30 hover:text-white"
                >
                  <Eye className="h-4 w-4" />
                  {en ? "Open Dashboard" : "Ver Dashboard"}
                </button>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-6 pt-1">
                {[
                  { icon: Users, value: "2,400+", label: en ? "Active DJs" : "DJs Activos" },
                  { icon: CalendarDays, value: "12,800+", label: en ? "Events" : "Eventos" },
                  { icon: Activity, value: "98%", label: en ? "Accuracy" : "Precisión" },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 text-orange-400" />
                    <b className="text-white">{value}</b>
                    <span className="text-zinc-500">{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — hero card */}
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101418] shadow-[0_32px_80px_rgba(0,0,0,0.7)]">
                <div className="relative">
                  <img src={stageImage} alt="CrowdSync DJ Live" className="h-64 w-full object-cover opacity-80 xl:h-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101418] via-[#101418]/20 to-transparent" />
                  {/* LIVE badge */}
                  <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-red-500/30 bg-black/80 px-3 py-1.5 backdrop-blur-sm">
                    <CircleDot className="h-2.5 w-2.5 fill-red-500" />
                    <span className="text-xs font-black text-white">LIVE</span>
                    <span className="text-xs text-zinc-400">Golden Ocean Night</span>
                  </div>
                  {/* Energy badge */}
                  <div className="absolute right-4 top-4 rounded-lg border border-emerald-500/30 bg-black/80 px-3 py-2 text-center backdrop-blur-sm">
                    <div className="text-xl font-black text-white">87</div>
                    <div className="text-[9px] font-bold uppercase text-emerald-400">Energy</div>
                  </div>
                </div>
                {/* Footer of card */}
                <div className="p-4">
                  <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#0d1116] p-3">
                    <img src={beachDjImage} alt="DJ" className="h-10 w-10 rounded-lg object-cover" />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-black text-white">LUXA VIBE • AI DJ Agent</div>
                      <div className="text-[10px] text-zinc-500">122 BPM • Euphoric • Latin House</div>
                    </div>
                    <div className="h-8 w-20 shrink-0"><MiniWave color="orange" bars={20} /></div>
                  </div>
                </div>
              </div>

              {/* Floating metric */}
              <div className="absolute -right-4 top-16 hidden xl:block">
                <div className="rounded-xl border border-white/10 bg-[#101418] p-4 shadow-2xl">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">Next Drop</div>
                  <div className="mt-1 text-3xl font-black text-white">48<span className="text-sm text-zinc-500">s</span></div>
                  <div className="mt-2 h-px w-full bg-gradient-to-r from-orange-500 to-fuchsia-500" />
                  <div className="mt-2 text-[9px] text-emerald-300">⚡ Energy rising</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-y border-white/10 bg-white/[0.02] px-4 py-8 xl:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 sm:grid-cols-4">
          {[
            { value: "2,400+", label: en ? "Active DJs" : "DJs Activos", color: "text-orange-400" },
            { value: "12,800+", label: en ? "Live Events" : "Eventos en Vivo", color: "text-emerald-400" },
            { value: "98%", label: en ? "Crowd Accuracy" : "Precisión del Crowd", color: "text-sky-400" },
            { value: "50+", label: en ? "Genres Supported" : "Géneros Soportados", color: "text-fuchsia-400" },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-center">
              <div className={`text-3xl font-black ${color}`}>{value}</div>
              <div className="mt-1 text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              {en ? "Everything You Need" : "Todo lo que Necesitas"}
            </div>
            <h2 className="text-3xl font-black text-white xl:text-4xl">
              {en ? "The Complete DJ Intelligence Suite" : "La Suite Completa de Inteligencia DJ"}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[
              {
                icon: Activity,
                title: en ? "AI Crowd Intelligence" : "Inteligencia de Público IA",
                desc: en ? "Real-time crowd energy, mood, and density analysis via mobile camera. Know what your audience feels before they do." : "Análisis en tiempo real de energía, mood y densidad del público via cámara móvil.",
                color: "text-emerald-400",
                badge: en ? "Real-time" : "Tiempo Real",
              },
              {
                icon: Bot,
                title: en ? "LUXA VIBE DJ Agent" : "Agente DJ LUXA VIBE",
                desc: en ? "Autonomous AI DJ that reads the crowd, adapts the setlist, and calibrates energy all night without missing a beat." : "DJ autónomo que lee el público, adapta el setlist y calibra la energía toda la noche.",
                color: "text-fuchsia-400",
                badge: en ? "Autonomous" : "Autónomo",
              },
              {
                icon: Music2,
                title: en ? "AI Music Generation" : "Generación Musical IA",
                desc: en ? "Generate custom tracks on-demand, create live remixes, and produce artist-branded drops — all in real-time." : "Genera pistas personalizadas, remixes en vivo y drops con marca del artista en tiempo real.",
                color: "text-orange-400",
                badge: en ? "On-demand" : "Bajo demanda",
              },
              {
                icon: Camera,
                title: en ? "Mobile Camera Sync" : "Sync Cámara Móvil",
                desc: en ? "Turn any phone into a crowd intelligence scanner. Capture energy, faces, and moments wirelessly from the floor." : "Convierte cualquier teléfono en escáner de inteligencia del público.",
                color: "text-sky-400",
                badge: en ? "Wireless" : "Inalámbrico",
              },
              {
                icon: Globe2,
                title: en ? "Global DJ Network" : "Red Global de DJs",
                desc: en ? "Connect with 2,400+ DJs worldwide. Publish live sets, discover top artists, and grow your audience." : "Conecta con más de 2,400 DJs a nivel global. Publica sets en vivo y crece tu audiencia.",
                color: "text-orange-400",
                badge: "2,400+ DJs",
              },
              {
                icon: BarChart3,
                title: en ? "Live Analytics" : "Analytics en Vivo",
                desc: en ? "BPM tracking, genre response curves, energy heatmaps, and post-event reports — all powered by live crowd data." : "Seguimiento de BPM, curvas de respuesta por género y reportes post-evento.",
                color: "text-yellow-400",
                badge: en ? "Post-event reports" : "Reportes post-evento",
              },
            ].map(({ icon: Icon, title, desc, color, badge }) => (
              <div
                key={title}
                className="group rounded-xl border border-white/10 bg-[#101418] p-5 transition hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className={`rounded-lg border border-white/10 bg-black/40 p-2.5 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase text-zinc-400">
                    {badge}
                  </span>
                </div>
                <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" className="border-y border-white/10 bg-white/[0.015] px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              {en ? "Simple 3-Step Setup" : "Configuración en 3 Pasos"}
            </div>
            <h2 className="text-3xl font-black text-white xl:text-4xl">
              {en ? "How It Works" : "Cómo Funciona"}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                step: "01",
                icon: CalendarDays,
                title: en ? "Configure Your Event" : "Configura tu Evento",
                desc: en
                  ? "Set your venue, artist, genres, crowd size, and DJ mode. Connect your Boostify music library in seconds."
                  : "Configura venue, artista, géneros y modo DJ. Conecta tu biblioteca Boostify en segundos.",
              },
              {
                step: "02",
                icon: Camera,
                title: en ? "Activate AI Intelligence" : "Activa la IA",
                desc: en
                  ? "Open the mobile camera link on your phone. Point it at the crowd. LUXA VIBE starts reading energy immediately."
                  : "Abre el link de cámara en tu móvil. Apúntalo al público. LUXA VIBE empieza a leer la energía de inmediato.",
              },
              {
                step: "03",
                icon: Bot,
                title: en ? "Let LUXA VIBE Drive" : "Deja que LUXA VIBE Maneje",
                desc: en
                  ? "Your AI DJ adapts BPM, generates drops, syncs visuals, and keeps the crowd euphoric — autonomously."
                  : "Tu agente DJ adapta BPM, genera drops, sincroniza visuales y mantiene al público eufórico — de forma autónoma.",
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div key={step} className="rounded-xl border border-white/10 bg-[#101418] p-6 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-orange-500/40 bg-orange-500/10">
                  <Icon className="h-6 w-6 text-orange-400" />
                </div>
                <div className="mb-1 text-5xl font-black text-white/8 leading-none">{step}</div>
                <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DJ Network preview ── */}
      <section id="network" className="px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 xl:grid-cols-[1fr_440px]">
            <div className="space-y-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
                {en ? "Global Community" : "Comunidad Global"}
              </div>
              <h2 className="text-3xl font-black text-white xl:text-4xl">
                {en ? "Join the Boostify DJ Network" : "Únete a la Red Boostify DJ"}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                {en
                  ? "Share live sets, discover trending artists, connect with promoters and venues, and grow your brand inside the fastest-growing DJ intelligence community."
                  : "Comparte sets en vivo, descubre artistas tendencia, conecta con promotores y venues, y crece tu marca en la comunidad DJ más grande."}
              </p>
              <div className="space-y-3">
                {(en
                  ? ["Publish sets directly to 2,400+ DJs", "Collaborate with Boostify artists", "Get discovered by venues and promoters"]
                  : ["Publica sets directamente a 2,400+ DJs", "Colabora con artistas Boostify", "Sé descubierto por venues y promotores"]
                ).map((text) => (
                  <div key={text} className="flex items-center gap-3 text-sm text-zinc-300">
                    <div className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-orange-500/20 text-orange-400">
                      <Check className="h-3 w-3" />
                    </div>
                    {text}
                  </div>
                ))}
              </div>
              <button
                onClick={onLaunch}
                className="flex items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-5 py-2.5 text-sm font-black text-orange-300 transition hover:bg-orange-500/20"
              >
                <Globe2 className="h-4 w-4" />
                {en ? "Join the Network" : "Unirme a la Red"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              {fallbackPosts.map((post) => (
                <div key={post.title} className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#101418] p-3 transition hover:border-white/20">
                  <img src={post.image || stageImage} alt={post.name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xs font-black text-white">{post.name}</div>
                    <div className="truncate text-[10px] text-zinc-500">{post.title} · {post.location}</div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-500 shrink-0">
                    <span><Eye className="inline h-3 w-3 mr-1" />{post.views}</span>
                    <span><Heart className="inline h-3 w-3 mr-1" />{post.likes}</span>
                  </div>
                </div>
              ))}
              <div className="text-center text-[10px] text-zinc-600">+ 2,397 {en ? "more DJs active" : "DJs más activos"}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-t border-white/10 bg-white/[0.015] px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              {en ? "Simple Pricing" : "Precios Simples"}
            </div>
            <h2 className="text-3xl font-black text-white xl:text-4xl">
              {en ? "Start Free. Scale Live." : "Empieza Gratis. Escala en Vivo."}
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            {[
              {
                name: en ? "Free" : "Gratis",
                price: "$0",
                period: "",
                desc: en ? "Explore the dashboard, basic crowd metrics, and the DJ network feed." : "Explora el dashboard, métricas básicas y el feed de la red DJ.",
                features: en
                  ? ["Live Dashboard", "DJ Network Feed", "Basic Analytics", "1 Event / Month"]
                  : ["Dashboard en Vivo", "Feed Red DJ", "Analytics Básico", "1 Evento / Mes"],
                cta: en ? "Get Started Free" : "Comenzar Gratis",
                highlighted: false,
              },
              {
                name: en ? "CrowdSync Pro" : "Pro",
                price: "$29",
                period: en ? "/month" : "/mes",
                desc: en ? "Full AI intelligence suite with autonomous DJ agent, music generation, and mobile camera sync." : "Suite completa de IA con agente DJ autónomo, generación musical y sync de cámara.",
                features: en
                  ? ["Unlimited Events", "AI Music Generation", "LUXA VIBE Agent", "Mobile Camera Sync", "Live Analytics", "Priority Network"]
                  : ["Eventos Ilimitados", "Generación Musical IA", "Agente LUXA VIBE", "Sync Cámara Móvil", "Analytics en Vivo", "Red Prioritaria"],
                cta: en ? "Start Pro" : "Iniciar Pro",
                highlighted: true,
              },
              {
                name: en ? "Event Pass" : "Pase Evento",
                price: "$49",
                period: en ? "/event" : "/evento",
                desc: en ? "All Pro features for a single event. No subscription — perfect for one-off shows." : "Todas las funciones Pro para un solo evento. Sin suscripción.",
                features: en
                  ? ["All Pro Features", "Single Event", "Post-event Report", "Social Clips Export"]
                  : ["Todas las funciones Pro", "Evento único", "Reporte post-evento", "Export de Clips"],
                cta: en ? "Buy Event Pass" : "Comprar Pase",
                highlighted: false,
              },
            ].map(({ name, price, period, desc, features, cta, highlighted }) => (
              <div
                key={name}
                className={`relative rounded-2xl border p-6 ${
                  highlighted
                    ? "border-orange-500/60 bg-orange-500/5 shadow-[0_0_50px_rgba(249,115,22,0.15)]"
                    : "border-white/10 bg-[#101418]"
                }`}
              >
                {highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-600 px-4 py-1 text-[10px] font-black uppercase text-white">
                    {en ? "Most Popular" : "Más Popular"}
                  </div>
                )}
                <div className="mb-1 text-sm font-black text-white">{name}</div>
                <div className="mb-1 flex items-baseline gap-1">
                  <span className="text-4xl font-black text-white">{price}</span>
                  <span className="text-sm text-zinc-500">{period}</span>
                </div>
                <p className="mb-5 text-[11px] leading-relaxed text-zinc-500">{desc}</p>
                <div className="mb-5 space-y-2">
                  {features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-zinc-300">
                      <div className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-orange-500/20 text-orange-400">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
                <button
                  onClick={onLaunch}
                  className={`w-full rounded-lg py-2.5 text-xs font-black uppercase transition ${
                    highlighted
                      ? "bg-orange-600 text-white shadow-[0_0_20px_rgba(249,115,22,0.3)] hover:bg-orange-500"
                      : "border border-white/15 bg-white/[0.04] text-zinc-200 hover:border-white/30 hover:text-white"
                  }`}
                >
                  {cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="relative overflow-hidden px-4 py-20 xl:px-8">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-orange-500/5 to-transparent" />
          <div className="absolute left-1/2 top-1/2 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/8 blur-[100px]" />
        </div>
        <div className="relative mx-auto max-w-2xl space-y-6 text-center">
          <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
            {en ? "Ready to Drop?" : "¿Listo para el Drop?"}
          </div>
          <h2 className="text-4xl font-black text-white xl:text-5xl">
            {en ? "Launch Your First Live Event" : "Lanza tu Primer Evento en Vivo"}
          </h2>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-zinc-500">
            {en
              ? "Your AI crowd intelligence dashboard is ready. Configure your event in under 2 minutes and let LUXA VIBE take the decks."
              : "Tu dashboard de inteligencia de crowd está listo. Configura tu evento en menos de 2 minutos y deja que LUXA VIBE tome los decks."}
          </p>
          <button
            onClick={onLaunch}
            className="mx-auto flex items-center gap-3 rounded-xl bg-orange-600 px-8 py-4 text-base font-black uppercase tracking-wide text-white shadow-[0_0_50px_rgba(249,115,22,0.4)] transition hover:bg-orange-500"
          >
            <Zap className="h-5 w-5" />
            {en ? "Launch CrowdSync DJ" : "Lanzar CrowdSync DJ"}
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-4 py-6 xl:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-orange-500">BOOSTIFY</span>
            <span className="text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-600">CrowdSync DJ Platform</span>
          </div>
          <span className="text-[10px] text-zinc-700">© {new Date().getFullYear()} Boostify Music. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

// ─── CrowdSync DJ Waitlist Page (non-admin gate) ─────────────────────────────
const LAUNCH_DATE = new Date('2026-08-01T12:00:00.000Z');

function useCountdown(target: Date) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const diff = target.getTime() - Date.now();
    return diff > 0 ? diff : 0;
  });
  useEffect(() => {
    const id = window.setInterval(() => {
      const diff = target.getTime() - Date.now();
      setTimeLeft(diff > 0 ? diff : 0);
    }, 1000);
    return () => window.clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const days = Math.floor(timeLeft / 86400000);
  const hours = Math.floor((timeLeft % 86400000) / 3600000);
  const minutes = Math.floor((timeLeft % 3600000) / 60000);
  const seconds = Math.floor((timeLeft % 60000) / 1000);
  return { days, hours, minutes, seconds };
}

function CrowdSyncWaitlistGate() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiRequest('/api/crowdsync-dj/waitlist', {
        method: 'POST',
        data: { email: email.trim(), name: name.trim() || undefined },
      });
      if ((res as any).success) {
        setSubmitted(true);
        toast({ title: "You're on the waitlist!", description: "Check your inbox for a confirmation email." });
      } else {
        setError((res as any).error || 'Something went wrong, please try again.');
      }
    } catch (err: any) {
      // Extract clean message from "500: {...json...}" error strings
      let msg: string = err?.message || 'Network error, please try again.';
      try {
        const jsonStart = msg.indexOf('{');
        if (jsonStart !== -1) {
          const parsed = JSON.parse(msg.slice(jsonStart));
          if (parsed?.error) msg = parsed.error;
        }
      } catch { /* ignore parse failures */ }
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-auto bg-[#07090c]"
      style={{ background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,140,0,0.10) 0%, transparent 70%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(168,85,247,0.08) 0%, transparent 60%), #07090c' }}>
      {/* Lock badge */}
      <div className="mb-6 flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5">
        <Lock className="h-3.5 w-3.5 text-orange-400" />
        <span className="text-xs font-bold uppercase tracking-widest text-orange-400">Early Access — Waitlist</span>
      </div>

      {/* Logo / Title */}
      <div className="mb-2 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-600 shadow-lg shadow-orange-900/40">
          <Headphones className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">CrowdSync <span className="text-orange-400">DJ</span></h1>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Powered by Boostify Music</p>
        </div>
      </div>

      <p className="mb-8 max-w-md text-center text-base text-zinc-400">
        The AI-powered live crowd intelligence platform for DJs is launching soon.<br />
        <span className="font-semibold text-zinc-200">Join the waitlist and be first to access it.</span>
      </p>

      {/* Countdown */}
      <div className="mb-8 flex gap-3">
        {[{ value: pad(days), label: 'Days' }, { value: pad(hours), label: 'Hours' }, { value: pad(minutes), label: 'Min' }, { value: pad(seconds), label: 'Sec' }].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl border border-orange-500/20 bg-gradient-to-b from-zinc-800 to-zinc-900 text-2xl font-black tabular-nums text-orange-300 shadow-inner shadow-black/50">
              {value}
            </div>
            <span className="mt-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500">{label}</span>
          </div>
        ))}
      </div>

      {/* Form */}
      {submitted ? (
        <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/30 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20">
            <Check className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-black text-white">You're on the list!</h2>
          <p className="text-sm text-zinc-400">We sent a confirmation to <span className="font-semibold text-zinc-200">{email}</span>. Stay tuned for launch-day access.</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl backdrop-blur-sm">
          <h2 className="mb-1 text-lg font-black text-white">Reserve your spot</h2>
          <div className="flex flex-col gap-2">
            <input
              type="text"
              placeholder="Your name (optional)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
            <input
              type="email"
              required
              placeholder="Your email address *"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); }}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-orange-500/60 focus:ring-1 focus:ring-orange-500/30"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-red-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-orange-900/40 transition hover:from-orange-400 hover:to-red-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Zap className="h-4 w-4" /> Join the Waitlist</>}
          </button>
          <p className="text-center text-[11px] text-zinc-600">No spam. Unsubscribe anytime. Launch: {LAUNCH_DATE.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
        </form>
      )}

      {/* Features teaser */}
      <div className="mt-10 grid max-w-lg grid-cols-2 gap-3 px-4 sm:grid-cols-4">
        {[
          { icon: Activity, label: 'Live Crowd AI' },
          { icon: Music2, label: 'Music Generator' },
          { icon: Bot, label: 'DJ Agent' },
          { icon: Globe2, label: 'DJ Network' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 text-center">
            <Icon className="h-5 w-5 text-orange-400" />
            <span className="text-xs font-semibold text-zinc-400">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CrowdSyncDJPage() {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const mainRef = useRef<HTMLElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [view, setView] = useState<'home' | 'dashboard'>('home');
  const t = tx[lang];
  const [activeSection, setActiveSection] = useState("live-dashboard");
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [hydratedEventId, setHydratedEventId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [energy, setEnergy] = useState(87);
  const [bpm, setBpm] = useState(122);
  const [drop, setDrop] = useState(48);
  const [mood, setMood] = useState<CrowdMood>("Euforico");
  const [danceActivity, setDanceActivity] = useState(76);
  const [crowdDensity, setCrowdDensity] = useState(78);
  const [creative, setCreative] = useState(88);
  const [sensitivity, setSensitivity] = useState(92);
  const [config, setConfig] = useState<EventConfig>(initialEvent);
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [currentTrack, setCurrentTrack] = useState<BoostifySong | null>(null);
  const [isGeneratingMusic, setIsGeneratingMusic] = useState(false);
  const musicPollRef = useRef<number | null>(null);
  const [toggles, setToggles] = useState({ voice: true, visuals: true, autonomous: true, human: true });
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("offline");
  const [cameraSessionId, setCameraSessionId] = useState<string | null>(null);
  const [cameraDetails, setCameraDetails] = useState<CameraDetails>({ facingMode: "environment" });
  const [cameraPermission, setCameraPermission] = useState<string | null>(null);
  const [log, setLog] = useState<Array<{ id: number; label: string; detail: string; time: string }>>([{ id: 1, label: "Crowd analysis", detail: "Energy 87, mood euphoric", time: fmt() }]);
  const [activeNetworkTab, setActiveNetworkTab] = useState<"feed" | "live" | "top">("feed");
  const [inviteEmail, setInviteEmail] = useState("");
  const [eventTimeLeft, setEventTimeLeft] = useState("--:--:--");

  const bootstrapQuery = useQuery({
    queryKey: ["crowdsync-dj-bootstrap"],
    queryFn: () => apiRequest("/api/crowdsync-dj/bootstrap"),
    retry: 2,
    staleTime: 30_000,
  });

  const djsQuery = useQuery({
    queryKey: ["crowdsync-djs"],
    queryFn: () => apiRequest("/api/crowdsync-dj/djs"),
    retry: 1,
    staleTime: 60_000,
  });
  const topDjs: CrowdSyncDj[] = djsQuery.data?.djs || [];

  const artists: BoostifyArtist[] = bootstrapQuery.data?.musicLibrary?.artists || [];
  const librarySongs: BoostifySong[] = bootstrapQuery.data?.musicLibrary?.songs || [];
  const billingProducts: CrowdSyncProduct[] = bootstrapQuery.data?.billing?.products || [];
  const selectedArtist = artists.find((artist) => Number(artist.id) === Number(selectedArtistId)) || artists[0] || null;
  const artistSongs = useMemo(
    () => (selectedArtist ? librarySongs.filter((song) => Number(song.userId) === Number(selectedArtist.id)) : librarySongs),
    [librarySongs, selectedArtist?.id],
  );
  const selectedSong = artistSongs.find((song) => Number(song.id) === Number(selectedSongId)) || artistSongs[0] || null;
  const activeFullEvent = bootstrapQuery.data?.activeEvent as CrowdSyncFullEvent | undefined;

  const mobileCameraUrl = useMemo(() => {
    if (typeof window === "undefined") return "/boostify-crowdsync-dj?camera=mobile";
    return `${window.location.origin}/boostify-crowdsync-dj?camera=mobile`;
  }, []);

  const eventJson = useMemo(() => ({
    event_name: config.eventName,
    event_type: config.eventType,
    location: { city: config.city, venue: config.venue },
    audience_profile: {
      estimated_people: Number(config.people) || 0,
      preferred_genres: config.genres.split(",").map((genre) => genre.trim()),
      current_energy: energy,
      current_mood: moodLabel.en[mood],
      current_bpm: bpm,
    },
    dj_mode: {
      type: config.djMode,
      agent_name: "LUXA VIBE",
      creativity_level: creative,
      crowd_sensitivity: sensitivity,
      voice_interaction: toggles.voice,
      visual_sync: toggles.visuals,
      human_override: toggles.human,
      autonomous: toggles.autonomous,
    },
    camera_session: {
      enabled: cameraStatus === "active",
      status: cameraStatus,
      session_id: cameraSessionId,
      source: "mobile-camera",
      ...cameraDetails,
    },
    boostify_artist_connection: {
      enabled: true,
      featured_artist: selectedArtist?.name || config.artist,
      selected_artist_id: selectedArtist?.id || selectedArtistId,
      selected_song_id: selectedSong?.id || selectedSongId,
      current_track: currentTrack?.title || selectedSong?.title || null,
      visual_theme: config.visualStyle,
    },
    post_event_outputs: { generate_report: true, generate_social_clips: true, generate_playlist: true, publish_to_boostify_network: true },
  }), [bpm, cameraDetails, cameraSessionId, cameraStatus, config, creative, currentTrack, energy, mood, selectedArtist, selectedArtistId, selectedSong, selectedSongId, sensitivity, toggles]);

  const apiSnapshot = () => ({
    config: { ...config, artist: selectedArtist?.name || config.artist, selectedArtistId, selectedSongId, currentTrackTitle: currentTrack?.title || selectedSong?.title },
    agent: { name: "LUXA VIBE", style: "AI luxury deep house DJ", creative, sensitivity, toggles },
    currentState: { energy, bpm, mood, drop },
    cameraSession: { enabled: cameraStatus === "active", status: cameraStatus, sessionId: cameraSessionId, source: "mobile-camera", ...cameraDetails },
  });

  const refetchCrowdSync = () => queryClient.invalidateQueries({ queryKey: ["crowdsync-dj-bootstrap"] });

  const syncFromFullEvent = (full?: CrowdSyncFullEvent | null) => {
    if (!full?.event) return;
    const event = full.event;
    setActiveEventId(event.id || null);
    if (event.config) {
      setConfig({ ...initialEvent, ...event.config });
      if (event.config.selectedArtistId) setSelectedArtistId(Number(event.config.selectedArtistId));
      if (event.config.selectedSongId) setSelectedSongId(Number(event.config.selectedSongId));
    }
    if (event.agent) {
      if (typeof event.agent.creative === "number") setCreative(event.agent.creative);
      if (typeof event.agent.sensitivity === "number") setSensitivity(event.agent.sensitivity);
      if (event.agent.toggles) setToggles({ voice: true, visuals: true, autonomous: true, human: true, ...event.agent.toggles });
    }
    if (event.currentState) {
      if (typeof event.currentState.energy === "number") setEnergy(event.currentState.energy);
      if (typeof event.currentState.bpm === "number") setBpm(event.currentState.bpm);
      if (event.currentState.mood) setMood(event.currentState.mood);
      if (typeof event.currentState.drop === "number") setDrop(event.currentState.drop);
    }
    if (event.cameraSession) {
      setCameraSessionId(event.cameraSession.sessionId || null);
      setCameraStatus(event.cameraSession.status || "offline");
      setCameraDetails({
        facingMode: event.cameraSession.facingMode || "environment",
        deviceLabel: event.cameraSession.deviceLabel || null,
        ...(event.cameraSession.dimensions || {}),
      });
    }
  };

  useEffect(() => {
    const active = bootstrapQuery.data?.activeEvent as CrowdSyncFullEvent | undefined;
    const id = active?.event?.id || bootstrapQuery.data?.activeEventId || null;
    if (id && hydratedEventId !== id) {
      syncFromFullEvent(active);
      setHydratedEventId(id);
    }
  }, [bootstrapQuery.data, hydratedEventId]);

  useEffect(() => {
    if (!selectedArtistId && artists[0]?.id) setSelectedArtistId(Number(artists[0].id));
  }, [artists, selectedArtistId]);

  useEffect(() => {
    if (selectedSongId || !selectedSong?.id) return;
    setSelectedSongId(Number(selectedSong.id));
    setCurrentTrack(selectedSong);
  }, [selectedSong, selectedSongId]);

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => setDrop((value) => (value <= 1 ? 48 : value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    const durationHours = parseFloat(config.duration) || 5;
    const totalSecs = Math.round(durationHours * 3600);
    let elapsed = 0;
    setEventTimeLeft(`${String(Math.floor(durationHours)).padStart(2, "0")}:00:00`);
    const timer = window.setInterval(() => {
      elapsed += 1;
      const remaining = Math.max(0, totalSecs - elapsed);
      const h = Math.floor(remaining / 3600).toString().padStart(2, "0");
      const m = Math.floor((remaining % 3600) / 60).toString().padStart(2, "0");
      const s = (remaining % 60).toString().padStart(2, "0");
      setEventTimeLeft(`${h}:${m}:${s}`);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [config.duration]);

  useEffect(() => {
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = cameraStream;
  }, [cameraStream]);

  useEffect(() => {
    if (cameraStatus !== "active" || !activeEventId || !cameraSessionId) return;
    const timer = window.setInterval(() => {
      void apiRequest(`/api/crowdsync-dj/events/${activeEventId}/camera-session`, {
        method: "POST",
        data: { status: "active", sessionId: cameraSessionId, source: "mobile-camera", permissionState: "granted", ...cameraDetails, userAgent: navigator.userAgent },
      }).catch(() => undefined);
    }, 15000);
    return () => window.clearInterval(timer);
  }, [activeEventId, cameraDetails, cameraSessionId, cameraStatus]);

  useEffect(() => () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => () => {
    if (musicPollRef.current) window.clearInterval(musicPollRef.current);
  }, []);

  const createEventMutation = useMutation({
    mutationFn: () => apiRequest("/api/crowdsync-dj/events", { method: "POST", data: apiSnapshot() }),
    onSuccess: (res: any) => {
      setActiveEventId(res.eventId || res.event?.id || null);
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: lang === "en" ? "CrowdSync created" : "CrowdSync creado", description: lang === "en" ? "Event saved to Firestore." : "Evento guardado en Firestore." });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const ensureEvent = async () => {
    if (activeEventId) return activeEventId;
    const created: any = await createEventMutation.mutateAsync();
    const id = created.eventId || created.event?.id;
    if (!id) throw new Error("CrowdSync event could not be created");
    setActiveEventId(id);
    return id;
  };

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}`, { method: "PATCH", data: { ...apiSnapshot(), status: isPlaying ? "live" : "draft" } });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: lang === "en" ? "Event synced" : "Evento sincronizado", description: lang === "en" ? "Settings and blueprint saved." : "Configuracion y blueprint guardados." });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const cameraSessionMutation = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/camera-session`, { method: "POST", data: payload });
    },
    onSuccess: (res: any) => {
      setCameraSessionId(res.cameraSessionId || res.cameraSession?.sessionId || null);
      if (res.cameraSession?.status) setCameraStatus(res.cameraSession.status);
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: t.cameraSession, description: t.cameraSaved });
    },
    onError: (error: any) => toast({ title: t.cameraSession, description: error.message, variant: "destructive" }),
  });

  const sessionMutation = useMutation({
    mutationFn: async (status: "live" | "paused") => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/live-session`, { method: "POST", data: { status, metrics: { energy, bpm, mood, drop } } });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      refetchCrowdSync();
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const captureCameraFrame = (): string | null => {
    const video = cameraVideoRef.current;
    if (!video || cameraStatus !== "active" || !video.videoWidth) return null;
    try {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 640 / video.videoWidth);
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.6);
    } catch {
      return null;
    }
  };

  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/analyze`, {
        method: "POST",
        data: { energy, bpm, mood, source: cameraStatus === "active" ? "mobile-camera" : "console", frame: captureCameraFrame() },
      });
    },
    onSuccess: (res: any) => {
      if (res.currentState) {
        setEnergy(res.currentState.energy);
        setBpm(res.currentState.bpm);
        setMood(res.currentState.mood);
        setDrop(res.currentState.drop || 48);
      }
      if (res.reading) {
        if (typeof res.reading.danceActivity === "number") setDanceActivity(res.reading.danceActivity);
        if (typeof res.reading.crowdDensity === "number") setCrowdDensity(res.reading.crowdDensity);
      }
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: lang === "en" ? "Analysis saved" : "Analisis guardado", description: res.reading?.recommendation || "Crowd reading synced." });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const actionMutation = useMutation({
    mutationFn: async ({ label, detail, type = "action", action, bpmDelta }: { label: string; detail: string; type?: string; action?: string; bpmDelta?: number }) => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/actions`, { method: "POST", data: { label, detail, type, action, bpmDelta, payload: { eventJson, cameraSessionId } } });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      refetchCrowdSync();
      if (res.asset) toast({ title: lang === "en" ? "Asset ready" : "Asset listo", description: `${res.asset.title} synced.` });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const saveAgentMutation = useMutation({
    mutationFn: async () => apiRequest("/api/crowdsync-dj/agents/current", { method: "PUT", data: { ...apiSnapshot().agent, eventId: activeEventId } }),
    onSuccess: () => {
      refetchCrowdSync();
      toast({ title: lang === "en" ? "Agent synced" : "Agente sincronizado", description: "LUXA VIBE saved." });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const networkMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/network-posts`, { method: "POST", data: { name: "DJ Nova Lux", title: config.eventName, location: `${config.city}, ${config.venue}`, image: stageImage } });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: lang === "en" ? "Set published" : "Set publicado", description: "Boostify DJ Network synced." });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/reports`, { method: "POST" });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      refetchCrowdSync();
      toast({ title: lang === "en" ? "Report generated" : "Reporte generado", description: `Peak energy ${res.report?.peakEnergy || energy}.` });
    },
    onError: (error: any) => toast({ title: "CrowdSync", description: error.message, variant: "destructive" }),
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ type, email }: { type: "dj" | "artist"; email: string }) => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/invite`, { method: "POST", data: { type, email } });
    },
    onSuccess: (res: any, variables) => {
      setInviteEmail("");
      refetchCrowdSync();
      toast({
        title: variables.type === "dj" ? t.inviteDjs : t.inviteArtists,
        description: res.alreadyInvited
          ? (lang === "en" ? "Already invited to this event." : "Ya estaba invitado a este evento.")
          : (lang === "en" ? `Invitation emailed to ${variables.email}.` : `Invitacion enviada a ${variables.email}.`),
      });
    },
    onError: (error: any) => toast({ title: t.network, description: error.message, variant: "destructive" }),
  });

  const checkoutMutation = useMutation({
    mutationFn: async (product: string) => {
      const id = await ensureEvent();
      return apiRequest("/api/crowdsync-dj/checkout", { method: "POST", data: { product, eventId: id } });
    },
    onSuccess: (res: any) => {
      toast({ title: t.payments, description: t.checkoutReady });
      if (res.url) window.location.assign(res.url);
    },
    onError: (error: any) => toast({ title: t.payments, description: error.message, variant: "destructive" }),
  });

  const verifyCheckoutMutation = useMutation({
    mutationFn: (sessionId: string) => apiRequest("/api/crowdsync-dj/checkout/verify", { method: "POST", data: { sessionId } }),
    onSuccess: (res: any) => {
      refetchCrowdSync();
      if (res.paid) toast({ title: t.payments, description: t.billingActive });
    },
  });

  const generateMusicMutation = useMutation({
    mutationFn: async () => {
      const id = await ensureEvent();
      return apiRequest(`/api/crowdsync-dj/events/${id}/generate-music`, {
        method: "POST",
        data: {
          artistId: selectedArtist?.id,
          songId: selectedSong?.id,
          genre: selectedSong?.genre || selectedArtist?.genre || config.genres.split(",")[0],
          mood: selectedSong?.mood || moodLabel.en[mood],
          bpm,
          energy,
          creative,
          sensitivity,
        },
      });
    },
    onSuccess: (res: any) => {
      syncFromFullEvent(res);
      // The server generates in the background (FAL MiniMax can exceed the
      // request timeout). It returns a processing asset + jobId that we poll
      // until the track is ready, then auto-cue it into the engine.
      const jobId: string | undefined = res?.jobId || res?.asset?.id;
      const eventId: string | undefined = res?.event?.id || activeEventId || undefined;
      if (jobId && eventId) {
        setIsGeneratingMusic(true);
        pollMusicJob(eventId, jobId);
        toast({ title: t.musicEngine, description: lang === "en" ? "Generating track…" : "Generando pista…" });
      } else {
        refetchCrowdSync();
        toast({ title: t.musicEngine, description: t.generationReady });
      }
    },
    onError: (error: any) => toast({ title: t.musicEngine, description: error.message, variant: "destructive" }),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    if (params.get("payment") === "success" && sessionId && !verifyCheckoutMutation.isPending && !verifyCheckoutMutation.isSuccess) {
      verifyCheckoutMutation.mutate(sessionId);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [verifyCheckoutMutation]);

  const addLog = (label: string, detail: string) => setLog((items) => [{ id: Date.now(), label, detail, time: fmt() }, ...items].slice(0, 6));
  const runAction = (label: string, detail: string, type = "action") => {
    addLog(label, detail);
    actionMutation.mutate({ label, detail, type });
  };

  // ── Real DJ playback / auto-mix engine ───────────────────────────────────
  // Turns the artist's catalogue into a live, autonomous DJ set that actually
  // plays audio and crossfades between tracks. The engine adapts to the crowd
  // (energy/mood) and auto-mixes the next track when the current one ends.
  const energyForMood = (m?: string | null): number => {
    const v = String(m || "").toLowerCase();
    if (/euf|eufor|peak|hype|hard|drop/.test(v)) return 95;
    if (/sub|rising|build|up/.test(v)) return 82;
    if (/inten|deep|dark|techno/.test(v)) return 74;
    if (/eleg|lounge|chill|smooth|soul/.test(v)) return 62;
    return 76;
  };
  const djPlaylist = useMemo<DeckTrack[]>(
    () =>
      artistSongs
        .filter((song) => !!song.audioUrl)
        .map((song) => ({
          id: song.id,
          title: song.title,
          artistName: song.artistName || selectedArtist?.name || config.artist,
          audioUrl: song.audioUrl,
          genre: song.genre,
          mood: song.mood,
          coverArt: song.coverArt,
          energy: energyForMood(song.mood || song.genre),
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [artistSongs, selectedArtist?.name, config.artist],
  );
  const { state: dj, controls: djc } = useDjEngine({
    playlist: djPlaylist,
    referenceBpm: 122,
    crossfadeSeconds: 6,
    onAction: (label, detail) => addLog(label, detail),
    onTrackChange: (track) => {
      const match = librarySongs.find((song) => String(song.id) === String(track.id));
      if (match) {
        setCurrentTrack(match);
        setSelectedSongId(Number(match.id));
      }
    },
  });

  // Keep the engine's BPM in sync with the crowd-driven BPM state.
  useEffect(() => {
    djc.setBpm(bpm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bpm]);

  // Mirror the engine's transport into the legacy isPlaying flag used elsewhere.
  useEffect(() => {
    setIsPlaying(dj.isPlaying);
  }, [dj.isPlaying]);

  // Autonomous mode toggles the auto-mix tail behaviour.
  useEffect(() => {
    djc.setAutoMix(toggles.autonomous);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggles.autonomous]);

  // ── Automatic crowd-mood detection loop ──────────────────────────────────
  // While the set is live (playing) or the camera is on, CrowdSync keeps reading
  // the room every ~18s: it captures a camera frame (when active) and runs the
  // AI analysis, which updates energy/BPM/mood and drives the auto-mix below.
  useEffect(() => {
    const live = dj.isPlaying || cameraStatus === "active";
    if (view !== "dashboard" || !toggles.autonomous || !live) return;
    const interval = window.setInterval(() => {
      if (!analyzeMutation.isPending) analyzeMutation.mutate();
    }, 18000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, toggles.autonomous, dj.isPlaying, cameraStatus, activeEventId]);

  // ── Mood-driven auto-mix ──────────────────────────────────────────────────
  // When the detected crowd mood changes during a live autonomous set, the
  // engine mixes toward a track whose energy matches the new reading.
  const lastAutoMoodRef = useRef<CrowdMood>(mood);
  useEffect(() => {
    if (!toggles.autonomous || !dj.isPlaying) {
      lastAutoMoodRef.current = mood;
      return;
    }
    if (lastAutoMoodRef.current === mood) return;
    lastAutoMoodRef.current = mood;
    const target = djc.pickNext(energy >= 84 ? "energyUp" : energy <= 70 ? "energyDown" : "shuffle", energy);
    if (target && String(target.id) !== String(dj.current?.id)) {
      void djc.crossfadeTo(target);
      addLog(lang === "en" ? "Mood-driven mix" : "Mezcla por mood", `${moodLabel.en[mood]} → ${target.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mood]);

  const handleTransport = () => {
    const goingLive = !dj.isPlaying;
    if (goingLive) {
      // Make sure the selected song is cued on the live deck before playing.
      if (selectedSong?.audioUrl && String(dj.current?.id) !== String(selectedSong.id)) {
        djc.loadTrack(
          {
            id: selectedSong.id,
            title: selectedSong.title,
            artistName: selectedArtist?.name || config.artist,
            audioUrl: selectedSong.audioUrl,
            genre: selectedSong.genre,
            mood: selectedSong.mood,
            coverArt: selectedSong.coverArt,
            energy: energyForMood(selectedSong.mood || selectedSong.genre),
          },
          false,
        );
      }
      void djc.play();
    } else {
      djc.pause();
    }
    sessionMutation.mutate(goingLive ? "live" : "paused");
  };

  // Persist an action to the backend without re-logging locally (used when the
  // DJ engine already added its own log line).
  const persistAction = (label: string, detail: string, type = "music", action?: string, bpmDelta?: number) =>
    actionMutation.mutate({ label, detail, type, action, bpmDelta });

  // Route the music-engine buttons to real audio behaviour.
  const handleMusicAction = (index: number, apiLabel: string, detail: string) => {
    switch (index) {
      case 0: // Generate next track (AI)
        generateMusicMutation.mutate();
        return;
      case 1: // Live remix → mix into another catalogue track now
        djc.next("shuffle");
        persistAction(apiLabel, detail, "music", "live_remix");
        return;
      case 2: // Raise energy
        djc.raiseEnergy(energy);
        setEnergy((v) => Math.min(99, v + 5));
        persistAction(apiLabel, detail, "music", "raise_energy");
        return;
      case 3: // Lower energy
        djc.lowerEnergy(energy);
        setEnergy((v) => Math.max(55, v - 7));
        persistAction(apiLabel, detail, "music", "lower_energy");
        return;
      case 4: { // Change BPM
        const nb = Math.min(135, bpm + 2);
        setBpm(nb);
        persistAction(apiLabel, detail, "music", "set_bpm", 2);
        return;
      }
      case 6: // Create drop
        djc.triggerDrop();
        persistAction(apiLabel, detail, "music", "create_drop");
        return;
      case 7: // Loop
        djc.toggleLoop();
        persistAction(apiLabel, detail, "music", "create_loop");
        return;
      case 8: // Transition → crossfade into the next track now
        djc.next("next");
        persistAction(apiLabel, detail, "music", "live_remix");
        return;
      default: // Artist voice / save moment / publish clip / more — log + persist
        runAction(apiLabel, detail, "music");
    }
  };

  // Cue a catalogue song onto the engine deck (used by the song picker + Play).
  const cueSong = (song: BoostifySong | null, autoplay = false) => {
    if (!song) return;
    setSelectedSongId(Number(song.id));
    setCurrentTrack(song);
    djc.loadTrack(
      {
        id: song.id,
        title: song.title,
        artistName: song.artistName || selectedArtist?.name || config.artist,
        audioUrl: song.audioUrl,
        genre: song.genre,
        mood: song.mood,
        coverArt: song.coverArt,
        energy: energyForMood(song.mood || song.genre),
      },
      autoplay,
    );
  };

  const fmtClock = (s: number) =>
    Number.isFinite(s) && s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "0:00";

  // Poll a background music-generation job until its asset is ready/failed, then
  // auto-cue the finished track into the engine (mood → create → auto-mix).
  const pollMusicJob = (eventId: string, jobId: string) => {
    if (musicPollRef.current) window.clearInterval(musicPollRef.current);
    let attempts = 0;
    const finish = () => {
      if (musicPollRef.current) window.clearInterval(musicPollRef.current);
      musicPollRef.current = null;
      setIsGeneratingMusic(false);
    };
    const check = async () => {
      attempts += 1;
      if (attempts > 90) {
        finish();
        toast({ title: t.musicEngine, description: lang === "en" ? "Generation is taking longer than expected." : "La generación está tardando más de lo esperado.", variant: "destructive" });
        return;
      }
      try {
        const res: any = await apiRequest(`/api/crowdsync-dj/events/${eventId}`, { method: "GET" });
        const asset = (res?.generatedAssets || []).find((a: any) => a.id === jobId);
        if (!asset) return;
        if (asset.status === "failed") {
          finish();
          toast({ title: t.musicEngine, description: asset.error || (lang === "en" ? "Generation failed." : "Falló la generación."), variant: "destructive" });
          return;
        }
        if (asset.status === "ready" && asset.audioUrl) {
          finish();
          refetchCrowdSync();
          if (asset.songId) setSelectedSongId(Number(asset.songId));
          const deckTrack: DeckTrack = {
            id: asset.songId || jobId,
            title: asset.title,
            artistName: asset.artistName || selectedArtist?.name || config.artist,
            audioUrl: asset.audioUrl,
            genre: asset.genre,
            mood: asset.mood,
            energy: typeof asset.energy === "number" ? asset.energy : energyForMood(asset.mood),
          };
          setCurrentTrack({ id: deckTrack.id, title: deckTrack.title, audioUrl: asset.audioUrl, artistName: deckTrack.artistName, genre: asset.genre, mood: asset.mood } as BoostifySong);
          if (dj.isPlaying) void djc.crossfadeTo(deckTrack);
          else djc.loadTrack(deckTrack, false);
          toast({ title: t.musicEngine, description: t.generationReady });
        }
      } catch {
        /* transient — keep polling */
      }
    };
    void check();
    musicPollRef.current = window.setInterval(check, 4000);
  };

  // Deterministic harmonic key label derived from the live BPM (Camelot-ish),
  // so the mixer readout reflects the set instead of a hardcoded value.
  const DJ_KEYS = ["Am", "Em", "Bm", "F#m", "C#m", "G#m", "D#m", "A#m", "Fm", "Cm", "Gm", "Dm"];
  const djKey = DJ_KEYS[Math.abs(Math.round(bpm)) % DJ_KEYS.length];
  const toggleAgent = (key: keyof typeof toggles) => {
    const next = { ...toggles, [key]: !toggles[key] };
    setToggles(next);
    runAction(`${key} ${next[key] ? "enabled" : "disabled"}`, "DJ agent setting updated", "agent");
  };
  const copyMobileCameraLink = async () => {
    try {
      await navigator.clipboard?.writeText(mobileCameraUrl);
      toast({ title: t.linkCopied, description: mobileCameraUrl });
    } catch {
      toast({ title: t.mobileCamera, description: mobileCameraUrl });
    }
  };
  const navigateSection = (target: string) => {
    if (target === "pricing") {
      setActiveSection("current-event");
      const el = document.getElementById("section-payments");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    setActiveSection(target);
    const el = document.getElementById(`section-${target}`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const endEvent = () => {
    setIsPlaying(false);
    reportMutation.mutate();
    runAction(
      lang === "en" ? "Event ended" : "Evento finalizado",
      lang === "en" ? "Report generated and event archived" : "Reporte generado y evento archivado",
      "event",
    );
    if (activeEventId) {
      void apiRequest(`/api/crowdsync-dj/events/${activeEventId}`, {
        method: "PATCH",
        data: { status: "ended", ...apiSnapshot() },
      }).catch(() => undefined);
    }
  };
  const startMobileCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("error");
      setCameraPermission("Camera API is not available in this browser.");
      toast({ title: t.cameraSession, description: "Camera API is not available in this browser.", variant: "destructive" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      const track = stream.getVideoTracks()[0];
      const settings = track?.getSettings?.() || {};
      const details: CameraDetails = {
        deviceLabel: track?.label || "Mobile camera",
        facingMode: String(settings.facingMode || "environment"),
        width: settings.width,
        height: settings.height,
        aspectRatio: settings.aspectRatio,
        frameRate: settings.frameRate,
      };
      setCameraPermission(null);
      setCameraStream(stream);
      setCameraStatus("active");
      setCameraDetails(details);
      const response = await cameraSessionMutation.mutateAsync({ status: "active", source: "mobile-camera", permissionState: "granted", ...details, userAgent: navigator.userAgent });
      setCameraSessionId(response.cameraSessionId || response.cameraSession?.sessionId || null);
    } catch (error: any) {
      const denied = error?.name === "NotAllowedError" || error?.name === "PermissionDeniedError";
      const status: CameraStatus = denied ? "permission_denied" : "error";
      setCameraStatus(status);
      setCameraPermission(error?.message || t.cameraPermission);
      void cameraSessionMutation.mutateAsync({ status, source: "mobile-camera", permissionState: denied ? "denied" : "error", userAgent: navigator.userAgent }).catch(() => undefined);
      toast({ title: t.cameraSession, description: error?.message || t.cameraPermission, variant: "destructive" });
    }
  };
  const stopMobileCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraStatus("stopped");
    cameraSessionMutation.mutate({ status: "stopped", sessionId: cameraSessionId, source: "mobile-camera", permissionState: "stopped", ...cameraDetails, userAgent: navigator.userAgent });
  };
  const captureCameraMoment = () => {
    if (!cameraStream) {
      void startMobileCamera();
      return;
    }
    runAction("Camera snapshot", "Mobile camera frame marked for crowd intelligence and recap assets", "camera");
    analyzeMutation.mutate();
  };

  // Auto-activate camera when ?camera=mobile is present in URL (mobile device flow)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("camera") !== "mobile") return;
    const timer = window.setTimeout(() => void startMobileCamera(), 1200);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apiNetworkPosts: NetworkPost[] = (bootstrapQuery.data?.networkPosts || []).map((post: any) => ({
    id: post.id,
    name: post.name || "DJ Nova Lux",
    role: post.role || "Set published",
    title: post.title || "CrowdSync Live Set",
    location: post.location || "Live",
    views: post.views || "0",
    likes: Number(post.likes || 0),
    image: post.image || stageImage,
  }));
  const visibleNetworkPosts = apiNetworkPosts.length ? apiNetworkPosts : fallbackPosts;
  const filteredNetworkPosts =
    activeNetworkTab === "live"
      ? visibleNetworkPosts.filter((_, i) => i === 2)
      : activeNetworkTab === "top"
        ? [...visibleNetworkPosts].sort((a, b) => b.likes - a.likes)
        : visibleNetworkPosts;
  const readingChartData = useMemo(() => {
    const readings = [...(activeFullEvent?.readings || [])].reverse();
    if (!readings.length) {
      return [0, 1, 2, 3, 4, 5].map((index) => ({
        name: `${index + 1}`,
        energy: Math.max(55, Math.min(99, energy - 10 + index * 3)),
        bpm: Math.max(90, Math.min(140, bpm - 5 + index * 2)),
        density: Math.max(35, Math.min(99, energy - 18 + index * 4)),
      }));
    }
    return readings.map((reading: any, index) => ({
      name: reading.createdAt ? new Date(reading.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : `${index + 1}`,
      energy: Number(reading.energy || energy),
      bpm: Number(reading.bpm || bpm),
      density: Number(reading.crowdDensity || reading.density || energy - 8),
    }));
  }, [activeFullEvent?.readings, bpm, energy]);
  const genreChartData = useMemo(() => {
    const genres = (config.genres || "Deep house, Latin house, Afro house")
      .split(",")
      .map((genre) => genre.trim())
      .filter(Boolean);
    return genres.slice(0, 5).map((genre, index) => ({
      genre,
      response: Math.max(35, Math.min(96, energy - index * 7 + (selectedSong?.genre?.toLowerCase().includes(genre.toLowerCase()) ? 8 : 0))),
    }));
  }, [config.genres, energy, selectedSong]);
  const musicActions = [
    [Wand2, t.generateNext, "Generated next track", "New generative track queued for the next drop"],
    [Shuffle, t.remixLive, "Live remix", "Live remix prepared with rising energy"],
    [Zap, t.upEnergy, "Raise energy", "BPM and percussion intensity increased"],
    [Activity, t.downEnergy, "Lower energy", "Controlled lounge transition prepared"],
    [SlidersHorizontal, t.changeBpm, "Change BPM", "BPM adapted to floor response"],
    [Mic2, t.artistVoice, "Artist voice", "Romy Alvarez vocal chop inserted"],
    [Sparkles, t.createDrop, "Create drop", "Custom drop prepared"],
    [Layers3, t.loop, "Create loop", "Eight-bar loop synchronized"],
    [Repeat2, t.transition, "Transition", "Transition rendered for the next cue"],
    [Save, t.saveMoment, "Save moment", "Moment saved for post-event recap"],
    [Send, t.publishClip, "Publish clip", "Clip sent to Boostify DJ Network"],
    [Menu, t.more, "More options", "Advanced CrowdSync options opened"],
  ] as const;

  // Non-admin users see only the waitlist gate
  if (!isAdmin) {
    return <CrowdSyncWaitlistGate />;
  }

  if (view === 'home') {
    return <HomePage onLaunch={() => setView('dashboard')} lang={lang} setLang={setLang} />;
  }

  return (
    <div className="fixed inset-0 z-40 flex overflow-hidden bg-[#07090c] text-zinc-100">
      <Sidebar t={t} activeSection={activeSection} onNavigate={navigateSection} eventTimeLeft={eventTimeLeft} eventName={config.eventName} eventCity={config.city} onHome={() => setView('home')} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar t={t} lang={lang} setLang={setLang} onNavigate={navigateSection} onCopyMobileLink={copyMobileCameraLink} onHome={() => setView('home')} />
        <main ref={mainRef} className="min-h-0 flex-1 overflow-auto p-2 pb-24 xl:p-3">
          <div className="grid gap-2 2xl:grid-cols-[1fr_360px]">
            <div className="space-y-2">
              <Panel
                id="section-live-dashboard"
                title={t.liveCrowd}
                icon={Activity}
                right={(
                  <button onClick={() => analyzeMutation.mutate()} className="flex items-center gap-1 text-[10px] font-bold uppercase text-emerald-300">
                    <CircleDot className="h-2.5 w-2.5 fill-emerald-400" /> {t.liveAnalysis}
                  </button>
                )}
              >
                <div className="grid gap-2 p-2 xl:grid-cols-[330px_1fr_170px]">
                  <div className="relative min-h-[220px] overflow-hidden rounded-md bg-black">
                    {cameraStream ? (
                      <video ref={cameraVideoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <img src={crowdImage} alt="Crowd analysis" className="absolute inset-0 h-full w-full object-cover opacity-75" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/20" />
                    <div className="absolute left-8 top-8 h-10 w-10 border-l-2 border-t-2 border-white/70" />
                    <div className="absolute right-8 top-8 h-10 w-10 border-r-2 border-t-2 border-white/70" />
                    <div className="absolute bottom-8 left-8 h-10 w-10 border-b-2 border-l-2 border-white/70" />
                    <div className="absolute bottom-8 right-8 h-10 w-10 border-b-2 border-r-2 border-white/70" />
                    <div className={`absolute left-3 top-3 flex items-center gap-2 rounded px-2 py-1 text-[10px] font-bold ${cameraStatus === "active" ? "bg-emerald-500/20 text-emerald-200" : "bg-black/70 text-zinc-300"}`}>
                      {cameraStatus === "active" ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {cameraStatus === "active" ? t.cameraActive : t.cameraOffline}
                    </div>
                    <div className="absolute right-3 top-3 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-300">
                      {cameraDetails.width && cameraDetails.height ? `${cameraDetails.width}x${cameraDetails.height}` : t.mobileCamera}
                    </div>
                    {cameraPermission && (
                      <div className="absolute left-3 right-3 top-11 rounded border border-red-500/30 bg-red-950/70 px-2 py-1 text-[10px] text-red-100">
                        {cameraPermission}
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center gap-2">
                      <button onClick={cameraStatus === "active" ? stopMobileCamera : startMobileCamera} className="flex h-8 items-center gap-2 rounded bg-orange-600 px-3 text-[10px] font-black uppercase text-white hover:bg-orange-500">
                        {cameraStatus === "active" ? <CameraOff className="h-3.5 w-3.5" /> : <Camera className="h-3.5 w-3.5" />}
                        {cameraStatus === "active" ? t.stopCamera : t.activateCamera}
                      </button>
                      <button onClick={captureCameraMoment} className="flex h-8 items-center gap-2 rounded border border-emerald-500/40 bg-black/70 px-3 text-[10px] font-black uppercase text-emerald-200">
                        <Eye className="h-3.5 w-3.5" /> {t.scanCrowd}
                      </button>
                      <button onClick={copyMobileCameraLink} className="ml-auto flex h-8 items-center gap-2 rounded border border-white/10 bg-black/70 px-3 text-[10px] font-black uppercase text-zinc-200">
                        <Copy className="h-3.5 w-3.5" /> {t.copyMobileLink}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                    <MetricTile label={t.energy} value={`${energy}`} sub={energy > 84 ? "High" : "Stable"} color="green" />
                    <MetricTile label={t.dance} value={`${danceActivity}%`} sub={danceActivity > 75 ? "High" : "Medium"} color="green" />
                    <MetricTile label={t.mood} value={moodLabel[lang][mood]} sub="" color="purple" />
                    <MetricTile label={t.density} value={`${crowdDensity}%`} sub={crowdDensity > 75 ? "High" : "Medium"} color="green" />
                    <MetricTile label={t.bpm} value={`${bpm}`} sub="BPM" color="blue" />
                    <div className="rounded-md border border-white/10 bg-[#0d1116] p-3">
                      <div className="mb-1 text-[10px] font-bold uppercase text-zinc-400">{t.energy} <span className="text-orange-300">{energy}</span></div>
                      <input
                        type="range" min="55" max="99" value={energy}
                        onChange={(ev) => setEnergy(Number(ev.target.value))}
                        onMouseUp={() => analyzeMutation.mutate()}
                        className="w-full accent-orange-500"
                      />
                      <div className="mt-2 flex flex-wrap gap-1">
                        {(["Euforico", "Subiendo", "Intenso", "Elegante"] as CrowdMood[]).map((m) => (
                          <button
                            key={m}
                            onClick={() => { setMood(m); runAction("Mood change", `Crowd mood set to ${m}`, "analysis"); }}
                            className={`rounded px-2 py-0.5 text-[9px] font-black transition ${mood === m ? "bg-orange-500 text-white" : "border border-white/10 text-zinc-400 hover:text-white"}`}
                          >
                            {moodLabel[lang][m]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-lg border border-orange-500/40 bg-black/40 p-3 text-center">
                      <div className="text-[10px] font-black uppercase text-zinc-400">{t.nextDrop}</div>
                      <button onClick={() => { djc.triggerDrop(); persistAction(t.createDrop, "Manual drop triggered", "music", "create_drop"); }} className="mx-auto mt-3 grid h-24 w-24 place-items-center rounded-full border-4 border-orange-500 bg-[#161a1f] shadow-[0_0_30px_rgba(249,115,22,0.45)]">
                        <span><b className="block text-3xl text-white">{drop}</b><span className="text-[9px] text-zinc-500">SEC</span></span>
                      </button>
                    </div>
                    <div className="rounded-md border border-white/10 bg-[#0d1116] p-3">
                      <div className="mb-2 text-[10px] font-black uppercase text-zinc-400">{t.genreResponse}</div>
                      {genreChartData.map(({ genre, response }) => (
                        <div key={genre} className="mb-1 grid grid-cols-[75px_1fr_28px] items-center gap-2 text-[9px] text-zinc-400">
                          <span className="truncate">{genre}</span>
                          <span className="h-1 rounded bg-white/10"><span className="block h-full rounded bg-orange-500" style={{ width: `${response}%` }} /></span>
                          <b>{response}%</b>
                        </div>
                      ))}
                      <div className="mt-2 flex items-center gap-2 text-[10px] text-emerald-300">
                        <ShieldCheck className="h-3 w-3" /> {t.visualSync}
                        <div className="h-5 flex-1"><MiniWave color="green" bars={22} /></div>
                      </div>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel id="section-analytics" title={t.connectedCharts} icon={BarChart3} right={<span className="text-[9px] uppercase text-zinc-500">Live sync</span>}>
                <div className="grid gap-2 p-3 lg:grid-cols-[1.2fr_0.8fr]">
                  <div className="h-56 rounded-md border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase text-zinc-400">
                      <span>Energy / BPM</span>
                      <span className="text-emerald-300">{activeFullEvent?.readings?.length || 0} readings</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <LineChart data={readingChartData} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "#fff" }} />
                        <Line type="monotone" dataKey="energy" stroke="#22c55e" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="bpm" stroke="#38bdf8" strokeWidth={2.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="h-56 rounded-md border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between text-[10px] font-black uppercase text-zinc-400">
                      <span>{t.genreResponse}</span>
                      <span className="text-orange-300">{selectedArtist?.name || config.artist}</span>
                    </div>
                    <ResponsiveContainer width="100%" height="88%">
                      <BarChart data={genreChartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="genre" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "#fff" }} />
                        <Bar dataKey="response" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </Panel>

              <div id="section-music-generator" className="grid gap-2 xl:grid-cols-[250px_1fr_300px]">
                <Panel title={t.musicEngine} icon={Music2} right={<span className="text-[9px] uppercase text-zinc-500">{t.generatorLive}</span>}>
                  <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                    {musicActions.map(([Icon, label, apiLabel, detail], index) => (
                      <ActionButton
                        key={label}
                        icon={index === 0 && (generateMusicMutation.isPending || isGeneratingMusic) ? Loader2 : Icon}
                        label={index === 0 && (generateMusicMutation.isPending || isGeneratingMusic) ? "Generating" : label}
                        active={(index === 0 && (generateMusicMutation.isPending || isGeneratingMusic)) || (index === 7 && dj.loop)}
                        onClick={() => handleMusicAction(index, apiLabel, detail)}
                      />
                    ))}
                  </div>
                </Panel>

                <Panel title={t.waveform} icon={Activity} right={<button onClick={() => saveEventMutation.mutate()} className="text-[10px] font-bold text-zinc-400 hover:text-white">{t.saveEvent}</button>}>
                  <div className="space-y-3 p-3">
                    <div className="rounded-md bg-black/30 p-3">
                      <div className="mb-2 flex justify-between gap-3 text-[10px] text-zinc-400"><b className="truncate">{dj.current?.title || currentTrack?.title || selectedSong?.title || "No track cued"}</b><span className="truncate">{dj.current?.artistName || selectedArtist?.name || config.artist}</span><span className="shrink-0 text-orange-400">{bpm} BPM</span></div>
                      <div className="h-12"><MiniWave color="orange" bars={130} /></div>
                      <div className="mt-2 h-1 overflow-hidden rounded bg-white/10"><div className="h-full rounded bg-orange-500 transition-[width] duration-300" style={{ width: `${Math.round(dj.position * 100)}%` }} /></div>
                      <div className="mt-1 flex justify-between text-[9px] text-zinc-500"><span>{fmtClock(dj.currentTime)}</span><span className={dj.isPlaying ? "text-emerald-300" : ""}>{dj.crossfading ? (lang === "en" ? "Mixing…" : "Mezclando…") : dj.isPlaying ? (lang === "en" ? "Live" : "En vivo") : (lang === "en" ? "Paused" : "Pausa")}</span><span>{fmtClock(dj.duration)}</span></div>
                    </div>
                    <div className="rounded-md bg-black/30 p-3">
                      <div className="mb-2 flex justify-between gap-3 text-[10px] text-zinc-400"><b className="truncate">{dj.crossfading ? (lang === "en" ? "Incoming mix" : "Entrando") : (lang === "en" ? "Next up (auto-mix)" : "Siguiente (auto-mix)")}</b><span className="truncate">{(dj.crossfading ? dj.current : djc.pickNext("next"))?.title || (lang === "en" ? "Queue empty" : "Cola vacía")}</span><span className="shrink-0 text-fuchsia-400">{toggles.autonomous ? "AUTO" : "MANUAL"}</span></div>
                      <div className="h-12 opacity-70"><MiniWave color="purple" bars={130} /></div>
                    </div>
                  </div>
                </Panel>

                <Panel id="section-dj-agent" title={t.agent} icon={Bot} right={<button onClick={() => saveAgentMutation.mutate()} className="text-[9px] uppercase text-zinc-500 hover:text-white">{t.autonomous}</button>}>
                  <div className="p-3">
                    <div className="flex gap-3">
                      <img src={agentImage} alt="LUXA VIBE" className="h-20 w-20 rounded-full object-cover ring-2 ring-fuchsia-500/50" />
                      <div>
                        <div className="text-lg font-black text-white">LUXA VIBE</div>
                        <div className="text-[10px] text-zinc-500">AI DJ Agent</div>
                        <div className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-400"><CircleDot className="h-2.5 w-2.5 fill-emerald-400" /> {t.active}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-3">
                      <label className="block"><div className="mb-1 flex justify-between text-[10px] text-zinc-400"><span>Creative Level</span><b>{creative}%</b></div><input type="range" min="0" max="100" value={creative} onChange={(event) => setCreative(Number(event.target.value))} onMouseUp={() => saveAgentMutation.mutate()} className="w-full accent-orange-500" /></label>
                      <label className="block"><div className="mb-1 flex justify-between text-[10px] text-zinc-400"><span>Crowd Sensitivity</span><b>{sensitivity}%</b></div><input type="range" min="0" max="100" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} onMouseUp={() => saveAgentMutation.mutate()} className="w-full accent-orange-500" /></label>
                      <ToggleLine label="Voice Enabled" enabled={toggles.voice} onClick={() => toggleAgent("voice")} />
                      <ToggleLine label="Visuals Enabled" enabled={toggles.visuals} onClick={() => toggleAgent("visuals")} />
                      <ToggleLine label="Autonomous Mode" enabled={toggles.autonomous} onClick={() => toggleAgent("autonomous")} />
                    </div>
                  </div>
                </Panel>
              </div>

              <div id="section-boostify-artists" className="grid gap-2 xl:grid-cols-[1fr_1fr_300px]">
                <Panel className="cs-rise relative" title={t.artistConnected} icon={Mic2} right={<span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-emerald-400"><span className="cs-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />{t.connected}</span>}>
                  <div className="grid gap-3 p-3 lg:grid-cols-[260px_1fr]">
                    <div className="space-y-3">
                      <div className="relative flex items-center gap-3 overflow-hidden rounded-xl border border-white/10 bg-black/25 p-2.5">
                        <div className="cs-holo pointer-events-none absolute inset-0 opacity-40" />
                        <div className="cs-ring relative shrink-0 rounded-lg">
                          <img src={selectedArtist?.image || artistImage} alt={selectedArtist?.name || config.artist} className="relative h-16 w-16 rounded-lg object-cover" />
                        </div>
                        <div className="relative flex min-w-0 flex-col justify-center gap-0.5">
                          <div className="truncate text-sm font-black leading-tight text-white">{selectedArtist?.name || config.artist}</div>
                          {(selectedArtist?.genre || selectedArtist?.genres?.[0]) && (
                            <div className="truncate text-[10px] uppercase tracking-wide text-zinc-400">{selectedArtist.genre || selectedArtist.genres![0]}</div>
                          )}
                          <div className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                            <span className="cs-live-dot h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            {t.connected}
                          </div>
                        </div>
                      </div>
                      <select
                        value={selectedArtist?.id != null ? String(selectedArtist.id) : ""}
                        onChange={(event) => {
                          const nextId = Number(event.target.value);
                          setSelectedArtistId(nextId);
                          const firstSong = librarySongs.find((song) => Number(song.userId) === nextId) || null;
                          setSelectedSongId(firstSong?.id || null);
                          setCurrentTrack(firstSong);
                          const nextArtist = artists.find((artist) => Number(artist.id) === nextId);
                          if (nextArtist) setConfig({ ...config, artist: nextArtist.name });
                        }}
                        className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-white outline-none transition focus:border-orange-500"
                      >
                        {artists.length ? artists.map((artist) => <option key={artist.id} value={String(artist.id)}>{artist.name}</option>) : <option value="">{bootstrapQuery.isLoading ? "Loading artists…" : "No artists found"}</option>}
                      </select>
                      <select
                        value={selectedSong?.id != null ? String(selectedSong.id) : ""}
                        onChange={(event) => {
                          const nextId = Number(event.target.value);
                          const nextSong = librarySongs.find((song) => Number(song.id) === nextId) || null;
                          if (!nextSong) return;
                          if (dj.isPlaying && nextSong.audioUrl) {
                            setSelectedSongId(nextId);
                            setCurrentTrack(nextSong);
                            void djc.crossfadeTo({
                              id: nextSong.id,
                              title: nextSong.title,
                              artistName: nextSong.artistName || selectedArtist?.name || config.artist,
                              audioUrl: nextSong.audioUrl,
                              genre: nextSong.genre,
                              mood: nextSong.mood,
                              coverArt: nextSong.coverArt,
                              energy: energyForMood(nextSong.mood || nextSong.genre),
                            });
                          } else {
                            cueSong(nextSong, false);
                          }
                        }}
                        className="h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-xs text-white outline-none transition focus:border-orange-500"
                      >
                        {artistSongs.length ? artistSongs.map((song) => <option key={song.id} value={String(song.id)}>{song.title}</option>) : <option value="">{t.noSongs}</option>}
                      </select>
                    </div>
                    <div className="flex flex-col gap-3">
                      {artistSongs.length === 0 ? (
                        <div className="grid flex-1 min-h-[88px] place-items-center rounded-xl border border-dashed border-white/10 bg-black/20 text-[11px] text-zinc-500">{t.noSongs}</div>
                      ) : (
                        <div className="cs-scanline relative overflow-hidden rounded-xl border border-white/10 bg-black/25 p-3">
                          <div className="mb-2 flex items-center justify-between gap-3 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                            <span className="flex min-w-0 items-center gap-2">
                              {dj.isPlaying && String(dj.current?.id) === String(selectedSong?.id) && (
                                <span className="flex h-3 shrink-0 items-end gap-[2px]">
                                  {[0, 1, 2, 3].map((i) => (
                                    <span key={i} className="cs-eq-bar w-[2px] rounded-full bg-orange-400" style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />
                                  ))}
                                </span>
                              )}
                              <span className="truncate text-white/90">{currentTrack?.title || selectedSong?.title}</span>
                            </span>
                            {(currentTrack?.genre || selectedSong?.genre) && (
                              <span className="shrink-0 rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-300">{currentTrack?.genre || selectedSong?.genre}</span>
                            )}
                          </div>
                          {(currentTrack?.audioUrl || selectedSong?.audioUrl) ? (
                            <audio controls src={currentTrack?.audioUrl || selectedSong?.audioUrl} className="relative h-9 w-full" />
                          ) : (
                            <div className="grid h-9 place-items-center rounded-lg border border-dashed border-white/10 text-[10px] text-zinc-500">{t.noSongs}</div>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                        <ActionButton icon={dj.isPlaying && String(dj.current?.id) === String(selectedSong?.id) ? Pause : Headphones} label={dj.isPlaying && String(dj.current?.id) === String(selectedSong?.id) ? (lang === "en" ? "Pause" : "Pausa") : (lang === "en" ? "Play" : "Play")} active={dj.isPlaying && String(dj.current?.id) === String(selectedSong?.id)} onClick={() => { if (dj.isPlaying && String(dj.current?.id) === String(selectedSong?.id)) { djc.pause(); } else { cueSong(selectedSong, true); } }} />
                        <ActionButton icon={generateMusicMutation.isPending || isGeneratingMusic ? Loader2 : Wand2} label={generateMusicMutation.isPending || isGeneratingMusic ? (lang === "en" ? "Generating" : "Generando") : (lang === "en" ? "AI Track" : "IA Track")} onClick={() => generateMusicMutation.mutate()} active={generateMusicMutation.isPending || isGeneratingMusic} />
                        <ActionButton icon={Mic2} label={lang === "en" ? "Voice" : "Voz"} onClick={() => runAction("Artist voice", `${selectedArtist?.name || config.artist} voice activated`, "artist")} />
                        <ActionButton icon={Repeat2} label={lang === "en" ? "Remix" : "Remix"} onClick={() => runAction("Artist remix", "Artist catalog remix created", "artist")} />
                        <ActionButton icon={ShoppingBag} label={t.promote} onClick={() => runAction("Merch promotion", "Merch and music QR prepared", "commerce")} />
                      </div>
                    </div>
                  </div>
                </Panel>

                <Panel id="section-content" title={t.liveVisuals} icon={Image} right={<span className="text-[9px] text-zinc-500">{t.sync}</span>}>
                  <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-4">
                    {visualAssets.map((asset) => (
                      <button key={asset.name} onClick={() => runAction(asset.name, `${asset.name} visual synced to music`, "visual")} className="cs-scanline group relative overflow-hidden rounded-xl border border-white/10 bg-black/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-500/40 hover:shadow-[0_8px_22px_-8px_rgba(249,115,22,0.55)]">
                        <img src={asset.image} alt={asset.name} className="h-24 w-full object-cover opacity-90 transition-transform duration-500 group-hover:scale-105" />
                        <div className="cs-holo pointer-events-none absolute inset-0 opacity-30 mix-blend-screen transition-opacity duration-300 group-hover:opacity-50" />
                        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wide text-white">{asset.name}</div>
                      </button>
                    ))}
                  </div>
                </Panel>

                <Panel title={t.quickActions} icon={Zap}>
                  <div className="grid grid-cols-2 gap-2 p-3">
                    <ActionButton icon={Camera} label={cameraStatus === "active" ? t.stopCamera : t.activateCamera} onClick={cameraStatus === "active" ? stopMobileCamera : startMobileCamera} active={cameraStatus === "active"} />
                    <ActionButton icon={Eye} label={t.scanCrowd} onClick={captureCameraMoment} />
                    <ActionButton icon={Share2} label={t.shareEvent} onClick={() => networkMutation.mutate()} />
                    <ActionButton icon={BarChart3} label={t.report} onClick={() => reportMutation.mutate()} />
                    <button onClick={endEvent} className="col-span-2 h-11 rounded-md bg-orange-600 text-xs font-black uppercase text-white hover:bg-orange-500">{t.finish}</button>
                  </div>
                </Panel>
              </div>

              {log.length > 0 && (
                <Panel id="section-settings" title={lang === "en" ? "Action Log" : "Registro de Acciones"} icon={Activity} right={<span className="text-[9px] uppercase text-zinc-500">{log.length} events</span>}>
                  <div className="space-y-1 p-3">
                    {log.map((item) => (
                      <div key={item.id} className="flex items-start gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                        <CircleDot className="mt-0.5 h-2 w-2 shrink-0 text-orange-400" />
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-white">{item.label}</div>
                          <div className="truncate text-[10px] text-zinc-400">{item.detail}</div>
                        </div>
                        <span className="shrink-0 text-[9px] text-zinc-500">{item.time}</span>
                      </div>
                    ))}
                  </div>
                </Panel>
              )}
            </div>

            <aside className="space-y-2">
              <Panel id="section-dj-network" title={t.network} icon={Globe2} right={<button onClick={() => networkMutation.mutate()} className="text-[10px] font-bold uppercase text-orange-400">{t.feed}</button>}>
                <div className="grid grid-cols-3 border-b border-white/10 text-center text-[10px] font-black uppercase text-zinc-400">
                  <button onClick={() => setActiveNetworkTab("feed")} className={`py-2 ${activeNetworkTab === "feed" ? "border-b-2 border-orange-500 text-orange-400" : "hover:text-white"}`}>{t.feed}</button>
                  <button onClick={() => setActiveNetworkTab("live")} className={`py-2 ${activeNetworkTab === "live" ? "border-b-2 border-orange-500 text-orange-400" : "hover:text-white"}`}>{t.live}</button>
                  <button onClick={() => setActiveNetworkTab("top")} className={`py-2 ${activeNetworkTab === "top" ? "border-b-2 border-orange-500 text-orange-400" : "hover:text-white"}`}>{t.topDjs}</button>
                </div>
                {activeNetworkTab === "top" ? (
                  <div className="space-y-2 p-3">
                    {djsQuery.isLoading ? (
                      <div className="grid h-20 place-items-center text-[10px] text-zinc-500">Loading DJs…</div>
                    ) : topDjs.length === 0 ? (
                      <div className="grid h-20 place-items-center rounded-md border border-dashed border-white/10 text-center text-[10px] text-zinc-500">
                        {lang === "en" ? "No DJs registered yet. Invite DJs below." : "Aun no hay DJs registrados. Invita DJs abajo."}
                      </div>
                    ) : (
                      topDjs.slice(0, 6).map((dj, index) => (
                        <div key={dj.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 px-3 py-2">
                          <span className={`w-5 shrink-0 text-center text-xs font-black ${index === 0 ? "text-orange-400" : index === 1 ? "text-zinc-300" : "text-zinc-500"}`}>#{index + 1}</span>
                          <img src={dj.image || agentImage} alt={dj.name} className="h-9 w-9 shrink-0 rounded-full object-cover" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-xs font-bold text-white">{dj.name}</div>
                            <div className="truncate text-[10px] text-zinc-500">{dj.lastSetTitle || dj.style || (dj.genres || []).slice(0, 2).join(", ") || "CrowdSync DJ"}</div>
                          </div>
                          <div className="shrink-0 text-right text-[9px] text-zinc-400">
                            <div className="font-bold text-orange-300">{dj.eventsCount || 0} {lang === "en" ? "events" : "eventos"}</div>
                            <div className="flex items-center justify-end gap-1"><Heart className="h-2.5 w-2.5" />{dj.likes || 0}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                <div className="space-y-3 p-3">
                  {filteredNetworkPosts.slice(0, 3).map((post, index) => (
                    <article key={post.id || post.title} className="border-b border-white/10 pb-3 last:border-b-0">
                      <div className="mb-2 flex items-center gap-2">
                        <img src={post.image || stageImage} alt={post.name} className="h-8 w-8 rounded-full object-cover" />
                        <div className="min-w-0 flex-1"><div className="truncate text-xs font-bold text-white">{post.name}</div><div className="truncate text-[10px] text-zinc-500">{post.role}</div></div>
                        <span className="text-[9px] text-zinc-500">2h</span>
                      </div>
                      <div className="relative overflow-hidden rounded-md bg-black">
                        <img src={post.image || stageImage} alt={post.title} className="h-28 w-full object-cover opacity-85" />
                        {index === 2 && <span className="absolute left-2 top-2 rounded bg-red-600 px-2 py-1 text-[9px] font-black text-white">LIVE</span>}
                        <button onClick={() => runAction("Play network set", `${post.title} loaded`, "network")} className="absolute inset-0 m-auto grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white"><Play className="h-4 w-4" /></button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div><div className="text-xs font-black text-white">{post.title}</div><div className="text-[10px] text-zinc-500">{post.location}</div></div>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-400"><Eye className="h-3 w-3" />{post.views}<Heart className="h-3 w-3" />{post.likes}</div>
                      </div>
                    </article>
                  ))}
                </div>
                )}
                <div className="border-t border-white/10 p-3">
                  <div className="mb-2 text-[9px] font-black uppercase text-zinc-500">{lang === "en" ? "Invite to this event" : "Invitar a este evento"}</div>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    placeholder={lang === "en" ? "email@example.com" : "correo@ejemplo.com"}
                    className="mb-2 h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-[11px] text-white outline-none focus:border-orange-500"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => inviteMutation.mutate({ type: "dj", email: inviteEmail.trim() })}
                      disabled={inviteMutation.isPending || !inviteEmail.includes("@")}
                      className="flex h-8 items-center justify-center gap-1 rounded-md bg-orange-600 text-[10px] font-black uppercase text-white hover:bg-orange-500 disabled:opacity-40"
                    >
                      {inviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />} {t.inviteDjs}
                    </button>
                    <button
                      onClick={() => inviteMutation.mutate({ type: "artist", email: inviteEmail.trim() })}
                      disabled={inviteMutation.isPending || !inviteEmail.includes("@")}
                      className="flex h-8 items-center justify-center gap-1 rounded-md border border-orange-500/50 bg-black/30 text-[10px] font-black uppercase text-orange-300 hover:bg-orange-500/10 disabled:opacity-40"
                    >
                      {inviteMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mic2 className="h-3 w-3" />} {t.inviteArtists}
                    </button>
                  </div>
                </div>
              </Panel>

              <Panel id="section-payments" title={t.payments} icon={CreditCard} right={<span className="text-[9px] font-bold uppercase text-emerald-400">{bootstrapQuery.data?.billing?.plan || "free"}</span>}>
                <div className="space-y-2 p-3">
                  {(billingProducts.length ? billingProducts : [
                    { id: "crowdsync_pro", name: t.activatePro, mode: "subscription", amount: 2900, interval: "month", description: "" },
                    { id: "crowdsync_event_pass", name: t.eventPass, mode: "payment", amount: 4900, description: "" },
                    { id: "crowdsync_credit_pack", name: t.creditPack, mode: "payment", amount: 2500, description: "" },
                  ] as CrowdSyncProduct[]).map((product) => (
                    <button
                      key={product.id}
                      onClick={() => checkoutMutation.mutate(product.id.replace("crowdsync_", "") === "credit_pack" ? "credit_pack" : product.id.replace("crowdsync_", ""))}
                      className="flex w-full items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 p-3 text-left hover:border-orange-500/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-black text-white">{product.name}</span>
                        <span className="text-[10px] uppercase text-zinc-500">{product.mode === "subscription" ? "Monthly" : "One-time"}</span>
                      </span>
                      <span className="shrink-0 text-lg font-black text-orange-300">${(product.amount / 100).toFixed(0)}</span>
                    </button>
                  ))}
                  <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3 text-[10px] text-emerald-200">
                    {bootstrapQuery.data?.billing?.stripeConfigured ? (lang === "en" ? "Stripe ready" : "Stripe listo") : "Stripe offline"}
                  </div>
                </div>
              </Panel>

              <Panel id="section-current-event" title={t.currentEvent} icon={CalendarDays} right={<button onClick={() => saveEventMutation.mutate()} className="text-[10px] font-bold text-orange-400">{t.saveEvent}</button>}>
                <div className="grid gap-2 p-3 sm:grid-cols-2 2xl:grid-cols-1">
                  {(Object.entries(config) as Array<[keyof EventConfig, string]>).slice(0, 8).map(([key, value]) => (
                    <label key={key} className="block">
                      <span className="mb-1 block text-[9px] font-black uppercase text-zinc-500">{key}</span>
                      <input value={value} onChange={(event) => setConfig({ ...config, [key]: event.target.value })} className="h-8 w-full rounded border border-white/10 bg-black/30 px-2 text-[11px] text-white outline-none focus:border-orange-500" />
                    </label>
                  ))}
                </div>
              </Panel>

              <Panel title="Master JSON" icon={Save} right={<button onClick={() => saveEventMutation.mutate()} className="text-[10px] font-bold text-zinc-400 hover:text-white">{t.saveEvent}</button>}>
                <pre className="max-h-[170px] overflow-auto p-3 text-[9px] leading-4 text-emerald-200">{JSON.stringify(eventJson, null, 2)}</pre>
              </Panel>

              {(bootstrapQuery.data?.events as any[] || []).length > 0 && (
                <Panel id="section-my-events" title={t.side[6]} icon={CalendarDays} right={<span className="text-[9px] uppercase text-zinc-500">{(bootstrapQuery.data?.events as any[]).length} events</span>}>
                  <div className="space-y-1 p-3">
                    {(bootstrapQuery.data?.events as any[]).slice(0, 6).map((ev: any) => (
                      <button
                        key={ev.id}
                        onClick={() => {
                          syncFromFullEvent({ event: ev });
                          setActiveEventId(ev.id);
                          toast({ title: lang === "en" ? "Event loaded" : "Evento cargado", description: ev.name || "CrowdSync Event" });
                        }}
                        className={`flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition hover:border-orange-500/40 ${ev.id === activeEventId ? "border-orange-500/50 bg-orange-500/10" : "border-white/10 bg-black/20"}`}
                      >
                        <CircleDot className={`h-2 w-2 shrink-0 ${ev.status === "live" ? "fill-red-500 text-red-500" : "text-zinc-600"}`} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-white">{ev.name || "CrowdSync Event"}</div>
                          <div className="truncate text-[10px] text-zinc-500">{ev.config?.city || ev.config?.venue || "—"}</div>
                        </div>
                        <span className={`shrink-0 text-[9px] font-bold ${ev.status === "live" ? "text-red-400" : ev.status === "ended" ? "text-zinc-600" : "text-zinc-500"}`}>{ev.status || "draft"}</span>
                      </button>
                    ))}
                  </div>
                </Panel>
              )}
            </aside>
          </div>
        </main>

        <footer className="absolute bottom-0 left-0 right-0 z-50 h-20 border-t border-white/10 bg-[#090c10]/95 backdrop-blur xl:left-[244px]">
          <div className="flex h-full items-center gap-4 px-4">
            <img src={currentTrack?.coverArt || selectedSong?.coverArt || stageImage} alt="Current track" className="h-12 w-12 rounded-md object-cover" />
            <div className="hidden min-w-[180px] sm:block"><div className="truncate text-xs font-bold text-white">{currentTrack?.title || selectedSong?.title || "Golden Ocean Drop 03"}</div><div className="truncate text-[10px] text-zinc-500">LUXA VIBE & {currentTrack?.artistName || selectedArtist?.name || config.artist}</div></div>
            <div className="hidden h-9 flex-1 md:block"><MiniWave color="orange" bars={120} /></div>
            <div className="flex items-center gap-2">
              <IconButton icon={SkipBack} onClick={() => { djc.next("prev"); persistAction("Previous track", "Previous cue loaded", "transport"); }} />
              <button onClick={handleTransport} className="grid h-12 w-12 place-items-center rounded-full border-2 border-orange-500 bg-orange-500/15 text-white shadow-[0_0_24px_rgba(249,115,22,0.45)]">
                {dj.isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              </button>
              <IconButton icon={SkipForward} onClick={() => { djc.next("next"); persistAction("Next track", "Next cue loaded", "transport"); }} />
              <IconButton icon={Shuffle} onClick={() => { djc.shuffle(); persistAction("Shuffle", "Smart shuffle enabled", "transport"); }} />
            </div>
            <div className="hidden items-center gap-6 lg:flex">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => { setBpm((b) => Math.max(90, b - 2)); persistAction("BPM decreased", "BPM lowered", "transport"); }}
                  className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-sm font-black text-zinc-300 hover:text-white"
                >−</button>
                <div className="min-w-[52px] text-center">
                  <div className="text-2xl font-black text-white">{bpm}</div>
                  <div className="text-[9px] text-zinc-500">BPM</div>
                </div>
                <button
                  onClick={() => { setBpm((b) => Math.min(135, b + 2)); persistAction("BPM increased", "BPM raised", "transport"); }}
                  className="grid h-7 w-7 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-sm font-black text-zinc-300 hover:text-white"
                >+</button>
              </div>
              <div><div className="text-xl font-black text-white">{djKey}</div><div className="text-[9px] text-zinc-500">KEY</div></div>
            </div>
            <div className="ml-auto hidden items-center gap-3 xl:flex">
              <span className="text-[10px] uppercase text-zinc-500">Volume</span>
              <input type="range" min="0" max="100" value={Math.round(dj.volume * 100)} onChange={(ev) => djc.setVolume(Number(ev.target.value) / 100)} className="w-36 accent-orange-500" />
              <button onClick={() => analyzeMutation.mutate()} className="rounded-md border border-emerald-500/40 px-3 py-2 text-[10px] font-black uppercase text-emerald-300">AI Analysis {analyzeMutation.isPending ? "..." : "On"}</button>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}