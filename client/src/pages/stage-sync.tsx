// ────────────────────────────────────────────────────────────────────
// Boostify StageSync AI — Live Show Production Console
// ────────────────────────────────────────────────────────────────────
// Pixel-faithful recreation of the StageSync dashboard mock.
// Layout: left sidebar (nav + AI agents) + topbar + 3-col grid
// (setlist / visual+multipantalla / live control) + cue timeline +
// transport bar + sync status bar.
// ────────────────────────────────────────────────────────────────────

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Activity, AlertTriangle, Bell, Bot, ChevronDown, Cloud, Cpu, Edit3,
  Gauge, Layers, Library, ListMusic, Music, MonitorSmartphone, Monitor,
  MoreVertical, Pause, Play, Plus, Radio, Settings, Sliders, Sparkles,
  SkipBack, SkipForward, Sun, Tv2, Workflow, Wand2, Lightbulb,
  Mic2, Drum, Megaphone, Hourglass, ChevronRight, FastForward, Loader2,
} from "lucide-react";

// ════════════════════════════════════════════════════════════════════
// MOCK / DEFAULT DATA (matches the screenshot exactly)
// ════════════════════════════════════════════════════════════════════

const SHOW = {
  title: "ROMY ÁLVAREZ LIVE EXPERIENCE",
  date: "21 JUN 2026",
  venue: "ARENA CDMX",
  startTime: "8:00 PM",
  artist: "Romy Alvarez",
  artistRole: "Artist Account",
  mode: "LIVE" as "LIVE" | "REHEARSAL" | "PROGRAM",
  devicesConnected: 12,
};

type Song = {
  id: string;
  position: number;
  title: string;
  duration: string;
  bpm: number;
  key: string;
  thumb: string;
};

const SETLIST: Song[] = [
  { id: "s1", position: 1, title: "LLUVIA DE ORO",   duration: "03:42", bpm: 96,  key: "A minor", thumb: "/stage-sync/song-lluvia-de-oro.png" },
  { id: "s2", position: 2, title: "MAR AZUL",         duration: "04:18", bpm: 92,  key: "G major", thumb: "/stage-sync/song-mar-azul.png" },
  { id: "s3", position: 3, title: "FUEGO INTERIOR",   duration: "03:55", bpm: 120, key: "D minor", thumb: "/stage-sync/song-fuego-interior.png" },
  { id: "s4", position: 4, title: "BAILA CONMIGO",    duration: "03:20", bpm: 128, key: "E minor", thumb: "/stage-sync/song-baila-conmigo.png" },
  { id: "s5", position: 5, title: "DESTINO PERFECTO", duration: "04:05", bpm: 88,  key: "C major", thumb: "/stage-sync/song-destino-perfecto.png" },
  { id: "s6", position: 6, title: "SOMOS LUZ",        duration: "04:30", bpm: 100, key: "A major", thumb: "/stage-sync/song-somos-luz.png" },
];

type SceneKey = "intro" | "verse" | "chorus" | "bridge" | "final";

const SCENES: { key: SceneKey; label: string; sub: string; image: string }[] = [
  { key: "intro",  label: "INTRO",  sub: "SOFT SILK",       image: "/stage-sync/scene-intro-soft-silk.png" },
  { key: "verse",  label: "VERSE",  sub: "GOLDEN WAVES",    image: "/stage-sync/scene-verse-golden-waves.png" },
  { key: "chorus", label: "CHORUS", sub: "GOLD RAIN",       image: "/stage-sync/scene-chorus-gold-rain.png" },
  { key: "bridge", label: "BRIDGE", sub: "ABSTRACT LIGHT",  image: "/stage-sync/scene-bridge-abstract-light.png" },
  { key: "final",  label: "FINAL",  sub: "DIVINE SUNLIGHT", image: "/stage-sync/scene-final-divine-sunlight.png" },
];

type CueLane = { name: string; icon: React.ComponentType<{ className?: string }>; cues: { label: string; from: number; to: number; tone: "blue" | "amber" | "violet" | "rose" | "emerald" | "zinc" }[] };

const TIMELINE_TOTAL_SEC = 4 * 60; // 04:00
const PLAYHEAD_SEC = 84;           // 01:24

const CUE_LANES: CueLane[] = [
  {
    name: "VISUALS", icon: Tv2, cues: [
      { label: "INTRO SOFT SILK",      from: 0,   to: 60,  tone: "violet" },
      { label: "VERSE GOLDEN WAVES",   from: 60,  to: 120, tone: "violet" },
      { label: "CHORUS GOLD RAIN",     from: 120, to: 180, tone: "amber"  },
      { label: "BRIDGE ABSTRACT LIGHT",from: 180, to: 210, tone: "violet" },
      { label: "FINAL DIVINE SUNLIGHT",from: 210, to: 240, tone: "violet" },
    ],
  },
  {
    name: "LIGHTING", icon: Lightbulb, cues: [
      { label: "SOFT BLUE 30%",   from: 0,   to: 60,  tone: "blue"  },
      { label: "WARM GOLD 40%",   from: 60,  to: 120, tone: "blue"  },
      { label: "GOLD INTENSITY 75%", from: 120, to: 180, tone: "amber" },
      { label: "DEEP GOLD 50%",   from: 180, to: 210, tone: "blue"  },
      { label: "BRIGHT WHITE 60%",from: 210, to: 240, tone: "blue"  },
    ],
  },
  {
    name: "SCREEN", icon: Monitor, cues: [
      { label: "MAIN LED",         from: 0,   to: 60,  tone: "emerald" },
      { label: "MAIN + SIDES",     from: 60,  to: 120, tone: "emerald" },
      { label: "ALL SCREENS",      from: 120, to: 180, tone: "amber"   },
      { label: "MAIN + SIDES",     from: 180, to: 210, tone: "emerald" },
      { label: "ALL SCREENS",      from: 210, to: 240, tone: "emerald" },
    ],
  },
  {
    name: "ATMOSPHERE", icon: Cloud, cues: [
      { label: "FOG LOW",    from: 0,   to: 60,  tone: "rose" },
      { label: "FOG MEDIUM", from: 60,  to: 120, tone: "rose" },
      { label: "FOG HIGH",   from: 120, to: 180, tone: "amber" },
      { label: "FOG MEDIUM", from: 180, to: 210, tone: "rose" },
      { label: "FOG LOW",    from: 210, to: 240, tone: "rose" },
    ],
  },
  {
    name: "NOTES", icon: ListMusic, cues: [
      { label: "Entrada artista",   from: 0,   to: 60,  tone: "zinc" },
      { label: "Mirar al publico",  from: 60,  to: 120, tone: "zinc" },
      { label: "Explosión emocional", from: 120, to: 180, tone: "amber" },
      { label: "Bajar intensidad",  from: 180, to: 210, tone: "zinc" },
      { label: "Final épico",       from: 210, to: 240, tone: "zinc" },
    ],
  },
];

const NAV_ITEMS: { id: string; label: string; icon: any; liveBadge?: boolean; href?: string }[] = [
  { id: "dashboard",    label: "DASHBOARD",         icon: Gauge },
  { id: "repertoire",   label: "REPERTORIO",        icon: Music },
  { id: "setlist",      label: "SETLIST BUILDER",   icon: ListMusic },
  { id: "visual",       label: "VISUAL IDENTITY",   icon: Sparkles },
  { id: "song-visual",  label: "SONG VISUAL BUILDER", icon: Wand2, href: "/music-video-creator" },
  { id: "loop",         label: "LOOP GENERATOR",    icon: Workflow, href: "/music-generator" },
  { id: "cue",          label: "CUE TIMELINE",      icon: Layers },
  { id: "live",         label: "LIVE CONTROL",      icon: Radio, liveBadge: true },
  { id: "asset",        label: "ASSET LIBRARY",     icon: Library, href: "/merchandise" },
  { id: "tech-export",  label: "TECHNICAL EXPORT",  icon: Sliders },
  { id: "device",       label: "DEVICE SYNC",       icon: MonitorSmartphone },
  { id: "templates",    label: "SHOW TEMPLATES",    icon: Layers, href: "/video-concepts" },
  { id: "agent",        label: "AGENT ORCHESTRATOR", icon: Bot, href: "/ai-agents" },
];

const AI_AGENTS = [
  { name: "Repertoire Architect",    status: "Activo",      color: "emerald" },
  { name: "Visual Director",         status: "Activo",      color: "emerald" },
  { name: "Loop Generator",          status: "Generando",   color: "amber"   },
  { name: "Stage Technical Director",status: "Activo",      color: "emerald" },
  { name: "Sync Engine",             status: "Sincronizado",color: "emerald" },
  { name: "Emergency Assistant",     status: "En espera",   color: "zinc"    },
];

// ════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════

const fmtTime = (sec: number) => {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
};

const toneClasses: Record<string, string> = {
  blue:    "bg-blue-500/15 border-blue-500/40 text-blue-200",
  amber:   "bg-amber-500/30 border-amber-500/60 text-amber-100 shadow-[0_0_20px_-4px_rgba(245,158,11,0.5)]",
  violet:  "bg-violet-500/15 border-violet-500/40 text-violet-200",
  rose:    "bg-rose-500/15 border-rose-500/40 text-rose-200",
  emerald: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
  zinc:    "bg-zinc-700/40 border-zinc-600/60 text-zinc-300",
};

const dotByColor: Record<string, string> = {
  emerald: "bg-emerald-400",
  amber:   "bg-amber-400",
  zinc:    "bg-zinc-500",
};

// ════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════

export default function StageSyncPage() {
  const [activeNav, setActiveNav]   = useState("dashboard");
  const [activeSongId, setActiveSongId] = useState<string>("s1");
  const [activeScene, setActiveScene]   = useState<SceneKey>("chorus");
  const [playheadSec, setPlayheadSec]   = useState<number>(PLAYHEAD_SEC);
  const [isPlaying, setIsPlaying]       = useState(true);

  const activeSong = useMemo(
    () => SETLIST.find(s => s.id === activeSongId) || SETLIST[0],
    [activeSongId],
  );
  const nextSong = useMemo(() => {
    const i = SETLIST.findIndex(s => s.id === activeSongId);
    return SETLIST[(i + 1) % SETLIST.length];
  }, [activeSongId]);

  // Optional: pull real shows from backend (does not block the UI)
  useQuery({
    queryKey: ["stage-sync-shows-list"],
    queryFn: async () => {
      try {
        const r = await fetch("/api/stage-sync/shows", { credentials: "include" });
        if (!r.ok) return [];
        return r.json();
      } catch { return []; }
    },
    staleTime: 60_000,
  });

  // playhead simulation
  useEffect(() => {
    if (!isPlaying) return;
    const t = setInterval(() => {
      setPlayheadSec(p => (p + 1) % TIMELINE_TOTAL_SEC);
    }, 1000);
    return () => clearInterval(t);
  }, [isPlaying]);

  const playPct = (playheadSec / TIMELINE_TOTAL_SEC) * 100;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0d] text-zinc-100 font-sans antialiased">
      <div className="flex">
        {/* ╔═══════ SIDEBAR ═══════╗ */}
        <Sidebar activeNav={activeNav} setActiveNav={setActiveNav} />

        {/* ╔═══════ MAIN AREA ═══════╗ */}
        <main className="flex-1 min-w-0 flex flex-col">
          <TopBar onRegenerateVisuals={async () => {
            try {
              const r = await fetch('/api/stage-sync/asset-pack/generate', {
                method: 'POST', credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: true }),
              });
              if (r.ok) {
                // Cache-bust by forcing reload
                window.location.reload();
              } else {
                alert('Asset pack generation failed');
              }
            } catch (e: any) { alert('Asset pack error: ' + e?.message); }
          }} />

          <div className="flex-1 grid grid-cols-12 gap-4 p-4">
            {/* Setlist column */}
            <section className="col-span-12 xl:col-span-3">
              <SetlistPanel
                songs={SETLIST}
                activeId={activeSongId}
                onSelect={setActiveSongId}
              />
            </section>

            {/* Visual + Multipantalla */}
            <section className="col-span-12 xl:col-span-6 grid grid-cols-12 gap-4">
              <div className="col-span-12 lg:col-span-7">
                <VisualNowPanel
                  scene={SCENES.find(s => s.key === activeScene)!}
                  playheadSec={playheadSec}
                  totalSec={Number(activeSong.duration.split(":").reduce((a, b) => Number(a) * 60 + Number(b), 0))}
                />
              </div>
              <div className="col-span-12 lg:col-span-5">
                <MultiScreenPanel scene={SCENES.find(s => s.key === activeScene)!} />
              </div>
              <div className="col-span-12">
                <QuickScenes
                  scenes={SCENES}
                  activeScene={activeScene}
                  onSelect={setActiveScene}
                />
              </div>
            </section>

            {/* Live Control */}
            <section className="col-span-12 xl:col-span-3">
              <LiveControlPanel
                song={activeSong}
                next={nextSong}
                playheadSec={playheadSec}
              />
            </section>

            {/* Cue Timeline (full width) */}
            <section className="col-span-12">
              <CueTimeline
                lanes={CUE_LANES}
                playPct={playPct}
                playheadSec={playheadSec}
              />
            </section>

            {/* Transport */}
            <section className="col-span-12">
              <TransportBar
                isPlaying={isPlaying}
                onTogglePlay={() => setIsPlaying(p => !p)}
                onPrev={() => {
                  const i = SETLIST.findIndex(s => s.id === activeSongId);
                  setActiveSongId(SETLIST[(i - 1 + SETLIST.length) % SETLIST.length].id);
                  setPlayheadSec(0);
                }}
                onNext={() => {
                  setActiveSongId(nextSong.id);
                  setPlayheadSec(0);
                }}
                onNextCue={() => {
                  // jump to next 30s tick
                  setPlayheadSec(p => Math.min(TIMELINE_TOTAL_SEC - 1, Math.floor(p / 30) * 30 + 30));
                }}
              />
            </section>

            {/* Sync status bar */}
            <section className="col-span-12">
              <SyncStatusBar />
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SIDEBAR
// ════════════════════════════════════════════════════════════════════

function Sidebar({ activeNav, setActiveNav }: { activeNav: string; setActiveNav: (s: string) => void }) {
  const [, setLocation] = useLocation();
  return (
    <aside className="w-[230px] shrink-0 min-h-screen bg-[#0d0d10] border-r border-zinc-900/80 flex flex-col">
      {/* Logo */}
      <Link href="/" className="px-5 pt-5 pb-4 border-b border-zinc-900/80 block hover:bg-zinc-900/30 transition">
        <div className="text-[15px] font-black tracking-[0.18em] text-white leading-tight">BOOSTIFY</div>
        <div className="text-[10.5px] font-semibold tracking-[0.32em] text-orange-400 mt-0.5">STAGE SYNC AI</div>
      </Link>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = activeNav === item.id;
          const Icon = item.icon;
          const cls = `w-full group flex items-center gap-3 px-3 py-2.5 rounded-lg text-[11.5px] font-bold tracking-[0.12em] transition-all ${
            active
              ? "bg-gradient-to-r from-orange-500/20 to-transparent text-orange-400 border-l-2 border-orange-500"
              : "text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50 border-l-2 border-transparent"
          }`;
          const inner = (
            <>
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-orange-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
              <span className="flex-1 text-left">{item.label}</span>
              {item.liveBadge && (
                <span className="text-[8.5px] font-black tracking-widest px-1.5 py-0.5 rounded bg-rose-600 text-white">LIVE</span>
              )}
            </>
          );
          if (item.href) {
            return (
              <Link key={item.id} href={item.href} className={cls}>
                {inner}
              </Link>
            );
          }
          return (
            <button key={item.id} onClick={() => setActiveNav(item.id)} className={cls}>
              {inner}
            </button>
          );
        })}
      </nav>

      {/* AI Agents block */}
      <div className="px-3 pt-3 pb-2 border-t border-zinc-900/80">
        <div className="px-2 mb-2 text-[9.5px] font-bold tracking-[0.22em] text-orange-400 flex items-center gap-1.5">
          <Sparkles className="h-3 w-3" /> AGENTES IA
        </div>
        <div className="space-y-1">
          {AI_AGENTS.map(a => (
            <div key={a.name} className="flex items-center gap-2 px-2 py-1 text-[10.5px]">
              <span className={`h-1.5 w-1.5 rounded-full ${dotByColor[a.color]} shadow-[0_0_8px_currentColor]`} />
              <span className="text-zinc-300 truncate flex-1">{a.name}</span>
              <span className={`text-[9.5px] ${
                a.color === "emerald" ? "text-emerald-400"
                : a.color === "amber" ? "text-amber-400"
                : "text-zinc-500"
              }`}>{a.status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer logo */}
      <Link href="/" className="px-5 py-4 border-t border-zinc-900/80 text-center block hover:bg-zinc-900/30 transition">
        <div className="text-[14px] font-black tracking-[0.18em] text-white">BOOSTIFY</div>
        <div className="text-[8.5px] font-semibold tracking-[0.45em] text-zinc-500 mt-0.5">M U S I C</div>
      </Link>
    </aside>
  );
}

// ════════════════════════════════════════════════════════════════════
// TOPBAR
// ════════════════════════════════════════════════════════════════════

function TopBar({ onRegenerateVisuals }: { onRegenerateVisuals?: () => void }) {
  const [regenerating, setRegenerating] = useState(false);
  return (
    <header className="h-[78px] shrink-0 bg-[#0d0d10] border-b border-zinc-900/80 px-5 flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-0.5">SHOW ACTUAL</div>
        <div className="flex items-center gap-2">
          <h1 className="text-[19px] font-black tracking-tight text-white truncate">{SHOW.title}</h1>
          <button className="text-zinc-500 hover:text-orange-400 transition"><Edit3 className="h-3.5 w-3.5" /></button>
        </div>
        <div className="text-[11px] text-zinc-500 mt-0.5">
          {SHOW.date} <span className="text-orange-500">•</span> {SHOW.venue} <span className="text-orange-500">•</span> {SHOW.startTime}
        </div>
      </div>

      {/* Modo */}
      <div className="hidden md:flex flex-col items-start">
        <span className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-1">MODO</span>
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 transition">
          <span className="h-2 w-2 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.7)] animate-pulse" />
          <span className="text-[12px] font-bold text-white tracking-wider">{SHOW.mode}</span>
          <ChevronDown className="h-3.5 w-3.5 text-zinc-400" />
        </button>
      </div>

      {/* Dispositivos conectados */}
      <div className="hidden lg:flex flex-col items-start">
        <span className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-1">DISPOSITIVOS CONECTADOS</span>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 relative">
          <Monitor className="h-3.5 w-3.5 text-zinc-300" />
          <Tv2 className="h-3.5 w-3.5 text-zinc-300" />
          <Lightbulb className="h-3.5 w-3.5 text-zinc-300" />
          <Cloud className="h-3.5 w-3.5 text-zinc-300" />
          <span className="ml-1 text-[10px] font-bold text-orange-400 bg-orange-500/15 border border-orange-500/30 rounded px-1.5 py-0.5">{SHOW.devicesConnected}</span>
        </div>
      </div>

      {/* Bell */}
      <button
        onClick={async () => {
          if (!onRegenerateVisuals) return;
          if (!confirm('Regenerate ALL StageSync visuals via OpenAI? (~11 images, ~1-3 min, costs API credits)')) return;
          setRegenerating(true);
          try { await onRegenerateVisuals(); } finally { setRegenerating(false); }
        }}
        className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-orange-500/30 hover:border-orange-500/60 text-orange-400 text-[10.5px] font-bold tracking-wider flex items-center gap-1.5 transition disabled:opacity-50"
        disabled={regenerating}
        title="Regenerate visual asset pack via OpenAI gpt-image-1"
      >
        {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
        REGEN VISUALS
      </button>

      <button className="relative p-2 rounded-lg hover:bg-zinc-900 transition">
        <Bell className="h-4.5 w-4.5 text-zinc-400" />
      </button>

      {/* User */}
      <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-orange-500/40 transition">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-orange-500 to-rose-500 flex items-center justify-center text-[12px] font-black text-white">RA</div>
        <div className="text-left">
          <div className="text-[12px] font-semibold text-white leading-tight">{SHOW.artist}</div>
          <div className="text-[9.5px] text-zinc-500">{SHOW.artistRole}</div>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
      </button>
    </header>
  );
}

// ════════════════════════════════════════════════════════════════════
// SETLIST PANEL
// ════════════════════════════════════════════════════════════════════

function SetlistPanel({ songs, activeId, onSelect }: { songs: Song[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3 h-full flex flex-col">
      <div className="px-1 py-1 mb-2 text-[10px] font-bold tracking-[0.22em] text-zinc-500">SETLIST ACTUAL</div>
      <div className="space-y-2 flex-1">
        {songs.map(s => {
          const active = s.id === activeId;
          return (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-all text-left ${
                active
                  ? "bg-gradient-to-r from-orange-500/20 via-orange-500/5 to-transparent border-orange-500/60 shadow-[0_0_25px_-8px_rgba(249,115,22,0.6)]"
                  : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700"
              }`}
            >
              <span className={`text-[14px] font-black w-5 text-center ${active ? "text-orange-400" : "text-zinc-500"}`}>{s.position}</span>
              <div className="h-11 w-11 rounded-md overflow-hidden bg-zinc-800 shrink-0 ring-1 ring-zinc-800">
                <img src={s.thumb} alt="" className="h-full w-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <div className={`text-[12px] font-bold tracking-wide truncate ${active ? "text-white" : "text-zinc-200"}`}>{s.title}</div>
                <div className="text-[10px] text-zinc-500 mt-0.5">{s.duration} <span className="text-zinc-700">•</span> {s.bpm} BPM <span className="text-zinc-700">•</span> {s.key}</div>
              </div>
              {active ? (
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-0.5 bg-orange-400 rounded animate-[barwave_0.9s_ease-in-out_infinite]" style={{ height: "60%" }} />
                  <span className="w-0.5 bg-orange-400 rounded animate-[barwave_0.7s_ease-in-out_infinite]" style={{ height: "100%" }} />
                  <span className="w-0.5 bg-orange-400 rounded animate-[barwave_1.1s_ease-in-out_infinite]" style={{ height: "40%" }} />
                </div>
              ) : (
                <MoreVertical className="h-3.5 w-3.5 text-zinc-600" />
              )}
            </button>
          );
        })}
      </div>
      <button className="mt-3 w-full py-2.5 rounded-lg border border-dashed border-zinc-800 hover:border-orange-500/40 hover:text-orange-400 text-zinc-500 text-[11px] font-bold tracking-wider flex items-center justify-center gap-2 transition">
        <Plus className="h-3.5 w-3.5" /> AGREGAR CANCIÓN
      </button>
      <style>{`
        @keyframes barwave { 0%,100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VISUAL NOW PANEL (center big preview)
// ════════════════════════════════════════════════════════════════════

function VisualNowPanel({ scene, playheadSec, totalSec }: { scene: typeof SCENES[number]; playheadSec: number; totalSec: number }) {
  const pct = totalSec > 0 ? (playheadSec / totalSec) * 100 : 0;
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3 h-full flex flex-col">
      <div className="px-1 mb-2 text-[10px] font-bold tracking-[0.22em] text-zinc-500">VISUAL ACTUAL</div>
      <div className="relative rounded-lg overflow-hidden flex-1 min-h-[260px] ring-1 ring-amber-500/30 shadow-[0_0_40px_-15px_rgba(245,158,11,0.6)]">
        <img src={scene.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <div className="text-[9.5px] font-bold tracking-[0.22em] text-amber-300 mb-1">ESCENA ACTUAL</div>
          <div className="text-[16px] font-black text-white tracking-wide mb-3">{scene.label} {scene.sub}</div>
          <div className="flex items-center justify-between text-[10px] text-zinc-300 mb-1.5">
            <span className="font-semibold tracking-wider">TIEMPO TRANSCURRIDO</span>
            <span className="font-mono tabular-nums">{fmtTime(playheadSec)} / {fmtTime(totalSec)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-800/80 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
          </div>
        </div>
      </div>

      <div className="mt-3 px-3 py-2.5 rounded-lg bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between">
        <div>
          <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-0.5">SIGUIENTE CUE</div>
          <div className="text-[13px] font-bold text-white tracking-wide">BRIGHT EXPANSION</div>
        </div>
        <div className="text-[15px] font-mono font-black text-orange-400 tabular-nums">00:58</div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MULTI SCREEN PANEL
// ════════════════════════════════════════════════════════════════════

function MultiScreenPanel({ scene }: { scene: typeof SCENES[number] }) {
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <div className="px-1 text-[10px] font-bold tracking-[0.22em] text-zinc-500">VISTA MULTIPANTALLA</div>
        <div className="flex items-center gap-1">
          <button className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"><Monitor className="h-3.5 w-3.5" /></button>
          <button className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"><Tv2 className="h-3.5 w-3.5" /></button>
          <button className="p-1 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"><Layers className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="space-y-3 flex-1">
        <ScreenPreview label="MAIN LED WALL" res="3840x1080" image={scene.image} ratio="3.55/1" online />
        <div className="grid grid-cols-2 gap-3">
          <ScreenPreview label="SIDE SCREEN LEFT"  res="1080x1920" image={scene.image} ratio="9/16" online />
          <ScreenPreview label="SIDE SCREEN RIGHT" res="1080x1920" image={scene.image} ratio="9/16" online />
        </div>
      </div>
    </div>
  );
}

function ScreenPreview({ label, res, image, ratio, online }: { label: string; res: string; image: string; ratio: string; online?: boolean }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[9.5px]">
        <div className="flex items-center gap-1.5">
          {online && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_currentColor]" />}
          <span className="font-bold tracking-[0.16em] text-zinc-300">{label}</span>
        </div>
        <span className="text-zinc-500">{res}</span>
      </div>
      <div className="rounded-md overflow-hidden bg-zinc-950 ring-1 ring-zinc-800" style={{ aspectRatio: ratio }}>
        <img src={image} alt="" className="h-full w-full object-cover" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// QUICK SCENES
// ════════════════════════════════════════════════════════════════════

function QuickScenes({ scenes, activeScene, onSelect }: { scenes: typeof SCENES; activeScene: SceneKey; onSelect: (k: SceneKey) => void }) {
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3">
      <div className="px-1 mb-2 text-[10px] font-bold tracking-[0.22em] text-zinc-500">VISUALES RÁPIDOS</div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {scenes.map(s => {
          const active = s.key === activeScene;
          return (
            <button
              key={s.key}
              onClick={() => onSelect(s.key)}
              className={`relative rounded-lg overflow-hidden aspect-[16/10] ring-1 transition-all ${
                active
                  ? "ring-amber-500 shadow-[0_0_25px_-6px_rgba(245,158,11,0.7)]"
                  : "ring-zinc-800 hover:ring-zinc-600"
              }`}
            >
              <img src={s.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className={`absolute inset-0 ${active ? "bg-gradient-to-t from-amber-900/50 to-transparent" : "bg-gradient-to-t from-black/85 to-black/0"}`} />
              <div className="absolute bottom-1.5 left-1.5 right-1.5 text-left">
                <div className={`text-[9.5px] font-black tracking-wider ${active ? "text-amber-200" : "text-white"}`}>{s.label}</div>
                <div className="text-[8.5px] text-zinc-300/90 tracking-wide">{s.sub}</div>
              </div>
            </button>
          );
        })}
        <button className="rounded-lg aspect-[16/10] border border-dashed border-zinc-800 hover:border-orange-500/40 hover:text-orange-400 text-zinc-500 flex flex-col items-center justify-center gap-1 transition">
          <Plus className="h-4 w-4" />
          <span className="text-[8.5px] font-bold tracking-wider">AGREGAR<br />ESCENA</span>
        </button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// LIVE CONTROL PANEL
// ════════════════════════════════════════════════════════════════════

function LiveControlPanel({ song, next, playheadSec }: { song: Song; next: Song; playheadSec: number }) {
  const totalSec = song.duration.split(":").reduce((a, b) => Number(a) * 60 + Number(b), 0) as number;
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3 h-full flex flex-col">
      <div className="flex items-center justify-between px-1 mb-3">
        <div className="text-[10px] font-bold tracking-[0.22em] text-zinc-500">LIVE CONTROL PANEL</div>
        <div className="flex items-center gap-1.5 text-[9px] font-black tracking-widest text-rose-400">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_8px_currentColor]" /> LIVE
        </div>
      </div>

      {/* Now playing */}
      <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/80 p-3 mb-3">
        <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-1">NOW PLAYING</div>
        <div className="text-[16px] font-black text-orange-400 tracking-wide leading-none">{song.title}</div>
        <div className="text-[10px] text-zinc-500 mt-1.5 font-mono tabular-nums">
          {fmtTime(playheadSec)} / {song.duration} <span className="text-zinc-700">•</span> {song.bpm} BPM <span className="text-zinc-700">•</span> {song.key}
        </div>
        <Waveform progress={playheadSec / totalSec} />
      </div>

      <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/80 p-3 mb-3 flex items-center gap-3">
        <div className="h-12 w-12 rounded-md overflow-hidden bg-zinc-800 ring-1 ring-zinc-800 shrink-0">
          <img src={next.thumb} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500">NEXT SONG</div>
          <div className="text-[13px] font-bold text-white truncate tracking-wide">{next.title}</div>
        </div>
        <div className="text-[11px] font-mono text-zinc-400 tabular-nums">{next.duration}</div>
      </div>

      <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/80 p-3 mb-3 flex items-center justify-between">
        <div>
          <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500">NEXT CUE</div>
          <div className="text-[13px] font-bold text-white tracking-wide">BRIGHT EXPANSION</div>
        </div>
        <div className="text-[14px] font-mono font-black text-orange-400 tabular-nums">00:58</div>
      </div>

      <div className="space-y-2 mb-3">
        <ParamRow icon={Sun}     iconClass="text-amber-400"   label="LIGHTING"    value="WARM GOLD 65%" />
        <ParamRow icon={Monitor} iconClass="text-blue-400"    label="SCREEN"      value="MAIN LED + SIDE SCREENS" />
        <ParamRow icon={Cloud}   iconClass="text-violet-400"  label="ATMOSPHERE"  value="FOG LOW" />
      </div>

      <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/80 p-3 mb-3">
        <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 mb-1.5">NOTES</div>
        <p className="text-[11px] text-zinc-300 leading-relaxed">
          Activar humo suave antes del coro. Transición lenta, evitar cortes rápidos.
        </p>
      </div>

      <button className="mt-auto w-full py-3 rounded-lg bg-gradient-to-b from-rose-600 to-rose-700 hover:from-rose-500 hover:to-rose-600 border border-rose-500/60 text-white text-[12px] font-black tracking-[0.22em] flex items-center justify-center gap-2 transition shadow-[0_0_30px_-8px_rgba(244,63,94,0.7)] disabled:opacity-50"
        onClick={async () => {
          if (!confirm('Trigger EMERGENCY BLACKOUT for current show?')) return;
          try {
            await fetch('/api/stage-sync/agents/emergency', {
              method: 'POST', credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ situation: 'manual blackout from live console', currentSong: song.title }),
            });
          } catch {}
        }}
      >
        <AlertTriangle className="h-4 w-4" />
        EMERGENCY<br />BLACKOUT
      </button>
    </div>
  );
}

function ParamRow({ icon: Icon, iconClass, label, value }: { icon: React.ComponentType<{ className?: string }>; iconClass: string; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/80 px-3 py-2 flex items-center gap-3">
      <Icon className={`h-4 w-4 ${iconClass}`} />
      <div className="flex-1 min-w-0">
        <div className="text-[9.5px] font-bold tracking-[0.22em] text-zinc-500 leading-none">{label}</div>
        <div className="text-[11px] font-bold text-white truncate tracking-wide mt-0.5">{value}</div>
      </div>
    </div>
  );
}

function Waveform({ progress }: { progress: number }) {
  // Pseudo-random but stable bars
  const bars = useMemo(() => Array.from({ length: 56 }, (_, i) => 0.25 + 0.75 * Math.abs(Math.sin(i * 0.7))), []);
  const idxAt = Math.floor(progress * bars.length);
  return (
    <div className="mt-2 flex items-end gap-[2px] h-9">
      {bars.map((h, i) => (
        <span
          key={i}
          className={`flex-1 rounded-sm transition-colors ${i <= idxAt ? "bg-orange-400" : "bg-zinc-700"}`}
          style={{ height: `${h * 100}%` }}
        />
      ))}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// CUE TIMELINE
// ════════════════════════════════════════════════════════════════════

function CueTimeline({ lanes, playPct, playheadSec }: { lanes: CueLane[]; playPct: number; playheadSec: number }) {
  const ticks = [0, 30, 60, 90, 120, 150, 180, 210, 240];
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-bold tracking-[0.22em] text-zinc-500">CUE TIMELINE</div>
      </div>

      {/* Time scale */}
      <div className="grid grid-cols-[80px_1fr] gap-3 mb-1.5">
        <div />
        <div className="relative h-5 border-b border-zinc-800/80">
          {ticks.map(t => (
            <div key={t} className="absolute top-0 -translate-x-1/2 text-[9.5px] font-mono text-zinc-600 tabular-nums" style={{ left: `${(t / TIMELINE_TOTAL_SEC) * 100}%` }}>
              {fmtTime(t)}
            </div>
          ))}
          {/* playhead label */}
          <div className="absolute -top-0.5 -translate-x-1/2 px-1.5 py-0.5 rounded bg-orange-500 text-black text-[9px] font-black font-mono tabular-nums" style={{ left: `${playPct}%` }}>
            {fmtTime(playheadSec)}
          </div>
        </div>
      </div>

      {/* Lanes */}
      <div className="relative">
        <div className="space-y-1.5">
          {lanes.map(lane => {
            const Icon = lane.icon;
            return (
              <div key={lane.name} className="grid grid-cols-[80px_1fr] gap-3 items-center">
                <div className="flex items-center gap-1.5 text-[9.5px] font-bold tracking-[0.16em] text-zinc-500">
                  <Icon className="h-3 w-3" /> {lane.name}
                </div>
                <div className="relative h-7 bg-zinc-900/40 rounded">
                  {lane.cues.map((c, i) => {
                    const left  = (c.from / TIMELINE_TOTAL_SEC) * 100;
                    const width = ((c.to - c.from) / TIMELINE_TOTAL_SEC) * 100;
                    return (
                      <div
                        key={i}
                        className={`absolute top-0.5 bottom-0.5 rounded border px-2 flex items-center text-[9.5px] font-bold tracking-wide truncate ${toneClasses[c.tone]}`}
                        style={{ left: `${left}%`, width: `calc(${width}% - 2px)` }}
                      >
                        {c.label}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Playhead vertical line */}
        <div className="pointer-events-none absolute top-0 bottom-0" style={{ left: `calc(80px + 12px + (100% - 80px - 12px) * ${playPct / 100})` }}>
          <div className="w-px h-full bg-orange-500/80 shadow-[0_0_8px_rgba(249,115,22,0.7)]" />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// TRANSPORT BAR
// ════════════════════════════════════════════════════════════════════

function TransportBar({ isPlaying, onTogglePlay, onPrev, onNext, onNextCue }: { isPlaying: boolean; onTogglePlay: () => void; onPrev?: () => void; onNext?: () => void; onNextCue?: () => void }) {
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 p-2.5 flex items-center justify-center gap-2 flex-wrap">
      <TBtn icon={SkipBack}     label="ATRÁS"        onClick={onPrev} />
      <TBtn icon={ChevronRight} label="SIGUIENTE"    onClick={onNext} />
      <button
        onClick={onTogglePlay}
        className="px-6 py-2.5 rounded-lg bg-gradient-to-b from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 text-white text-[12px] font-black tracking-[0.22em] flex items-center gap-2 shadow-[0_0_25px_-6px_rgba(249,115,22,0.7)]"
      >
        {isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}
        {isPlaying ? "PAUSA" : "PLAY"}
      </button>
      <TBtn icon={FastForward} label="SIGUIENTE CUE" onClick={onNextCue} />
      <TBtn icon={Hourglass}   label="HOLD"          onClick={onTogglePlay} />
      <TBtn icon={Workflow}    label="GO TO CUE" />
      <TBtn icon={Bot}         label="AUTO" sub="MODO" />
      <TBtn icon={Sliders}     label="REHEARSAL MODE" />
      <button
        onClick={async () => {
          if (!confirm('End the live show now?')) return;
          // Best-effort: close any open session for the latest show
          try {
            const r = await fetch('/api/stage-sync/shows', { credentials: 'include' });
            if (r.ok) {
              const j = await r.json();
              const showId = j?.shows?.[0]?.id;
              if (showId) {
                const list = await fetch(`/api/stage-sync/shows/${showId}`, { credentials: 'include' });
                const data = list.ok ? await list.json() : null;
                const session = data?.liveSessions?.find((s: any) => !s.endedAt);
                if (session?.id) {
                  await fetch(`/api/stage-sync/shows/${showId}/sessions/${session.id}/end`, { method: 'POST', credentials: 'include' });
                }
              }
            }
          } catch {}
          alert('Show ended');
        }}
        className="px-4 py-2.5 rounded-lg border border-rose-500/60 bg-rose-600/15 hover:bg-rose-600/25 text-rose-300 text-[11px] font-black tracking-[0.22em] flex items-center gap-2">
        <Megaphone className="h-3.5 w-3.5" /> END SHOW
      </button>
    </div>
  );
}

function TBtn({ icon: Icon, label, sub, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; sub?: string; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-200 text-[10.5px] font-bold tracking-[0.16em] flex items-center gap-1.5 transition">
      <Icon className="h-3.5 w-3.5" />
      <span className="leading-tight text-left">
        {label}
        {sub && <span className="block text-[8.5px] text-zinc-500 font-semibold">{sub}</span>}
      </span>
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════
// SYNC STATUS BAR
// ════════════════════════════════════════════════════════════════════

function SyncStatusBar() {
  return (
    <div className="rounded-xl bg-[#101015] border border-zinc-900/80 px-4 py-2.5 flex items-center gap-5 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_currentColor] animate-pulse" />
        <div>
          <div className="text-[9.5px] font-bold tracking-[0.16em] text-emerald-300">SINCRONIZACIÓN</div>
          <div className="text-[9.5px] font-bold tracking-[0.16em] text-emerald-300">PERFECTA</div>
        </div>
      </div>

      <ProtoBadge name="Ableton Link" />
      <ProtoBadge name="MIDI" />
      <ProtoBadge name="OSC" />
      <ProtoBadge name="ART-NET" />
      <ProtoBadge name="SMPTE" />

      <div className="ml-auto flex items-center gap-4 text-[10px] font-mono">
        <Stat label="CPU" value="32%" tone="emerald" />
        <Stat label="MEM" value="45%" tone="emerald" />
        <Stat label="FPS" value="60"  tone="emerald" />
        <button className="p-1.5 rounded text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900"><Settings className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function ProtoBadge({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-start">
      <div className="text-[10.5px] font-semibold text-zinc-200 tracking-wide">{name}</div>
      <div className="text-[8.5px] font-bold tracking-[0.22em] text-emerald-400">CONECTADO</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: "emerald" | "amber" | "rose" }) {
  const c = tone === "emerald" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-rose-400";
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-zinc-500">{label}:</span>
      <span className={`font-bold ${c} tabular-nums`}>{value}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${c.replace("text-", "bg-")} shadow-[0_0_6px_currentColor]`} />
    </div>
  );
}
