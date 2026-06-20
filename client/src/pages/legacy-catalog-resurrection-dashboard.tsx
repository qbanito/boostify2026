import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  Bell,
  Bot,
  ChevronDown,
  ChevronsLeft,
  Disc3,
  DollarSign,
  Headphones,
  Home,
  LayoutGrid,
  Loader2,
  Megaphone,
  Menu,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  Settings as SettingsIcon,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Users2,
  Video,
  Wand2,
  X,
  Zap,
  Scissors,
  Shirt,
  FileText,
  ListMusic,
  Languages,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────
type Lang = "en" | "es";
type QueryPayload = { title: string; artistName: string; isrc?: string };

type LegacyVisual = {
  id: string;
  title: string;
  prompt: string;
  imageUrl: string;
  provider: string;
};

type LegacyTrack = {
  id: string;
  title: string;
  artistName: string;
  albumName?: string;
  era: string;
  releaseDate: string;
  archiveId: string;
  rightsStatus: string;
  revivalScore: number;
  syncFit: string;
  imageUrl: string;
  platform?: string;
  confidence?: string;
  streamUrl?: string;
  previewUrl?: string;
  isrc?: string;
};

type LegacyAnalysis = {
  query: QueryPayload;
  source: {
    spotifyConfigured: boolean;
    appleMusicPublicSearch: boolean;
    deezerPublicSearch: boolean;
    musicBrainzRegistry: boolean;
    platformsMatched: string[];
    platformsChecked: string[];
    platformsSkipped: string[];
  };
  catalog: {
    name: string;
    archiveReference: string;
    referenceUrl: string;
    canonicalTitle: string;
    canonicalArtist: string;
    canonicalIsrc?: string | null;
    matchCount: number;
    revivedTracks: LegacyTrack[];
  };
  metrics: {
    resurrectionScore: number;
    rightsReadiness: number;
    syncDemand: number;
    archiveCompleteness: number;
    projectedAnnualValue: number;
    clearanceDays: number;
  };
  rightsStack: Array<{ label: string; status: string; confidence: number }>;
  opportunities: Array<{ channel: string; value: string; priority: string; fit: number }>;
  timeline: Array<{ phase: string; days: number; status: string }>;
  visuals: LegacyVisual[];
};

type LegacyActionArtifact = {
  id: string;
  action: string;
  title: string;
  status: string;
  summary: string;
  cta: string;
  createdAt: string;
  sections: Array<{ label: string; value: string }>;
  nextSteps: string[];
};

type Props = {
  onHome?: () => void;
  catalogPosterUrl?: string;
  artistAvatarUrl?: string;
  analysis?: LegacyAnalysis;
  query?: QueryPayload;
  setQuery?: (q: QueryPayload) => void;
  onSearch?: () => void;
  searchLoading?: boolean;
  onRunAction?: (action: string, track?: LegacyTrack) => void;
  actionLoading?: boolean;
  pendingAction?: string | null;
  actionArtifact?: LegacyActionArtifact | null;
  visualPack?: LegacyVisual[];
  visualsPending?: boolean;
  lang?: Lang;
  setLang?: (l: Lang) => void;
  onGenerateVisuals?: () => void;
  generateVisualsLoading?: boolean;
};

export type { Props as CatalogResurrectionDashboardProps };

// ─── Constants ──────────────────────────────────────────────────────────────
const navItems: Array<{ label: string; icon: any; sectionId?: string; active?: boolean }> = [
  { label: "Dashboard", icon: LayoutGrid, sectionId: "hero", active: true },
  { label: "Catalog Intake", icon: ListMusic, sectionId: "catalog" },
  { label: "Resurrection Engine", icon: Wand2, sectionId: "score" },
  { label: "Digital Artists", icon: Users2, sectionId: "artist" },
  { label: "Content Pipeline", icon: Video, sectionId: "pipeline" },
  { label: "Sync & Licensing", icon: BadgeDollarSign, sectionId: "rights" },
  { label: "Campaigns", icon: Megaphone, sectionId: "agents" },
  { label: "Revenue", icon: DollarSign, sectionId: "revenue" },
  { label: "Settings", icon: SettingsIcon, sectionId: "settings" },
];

const sidebarSparkline = [3, 5, 4, 7, 6, 9, 8, 11, 10, 13, 12, 15];

const pipelineDefault: Array<{ n: number; label: string; status: "COMPLETED" | "IN PROGRESS" | "SCHEDULED"; date: string; icon: any }> = [
  { n: 1, label: "Remastered Original", status: "COMPLETED", date: "Phase 1", icon: Disc3 },
  { n: 2, label: "Deep House Remix", status: "IN PROGRESS", date: "Phase 2", icon: Headphones },
  { n: 3, label: "Lyric Video", status: "IN PROGRESS", date: "Phase 3", icon: Video },
  { n: 4, label: "Short-form Clips", status: "SCHEDULED", date: "Phase 4", icon: Scissors },
  { n: 5, label: "Merch Drop", status: "SCHEDULED", date: "Phase 5", icon: Shirt },
  { n: 6, label: "Sync Pitch", status: "SCHEDULED", date: "Phase 6", icon: Target },
];

const revenueChartDefault = [
  { month: "Jun", streaming: 38, sync: 18, merch: 10, collectibles: 6, fans: 4 },
  { month: "Jul", streaming: 42, sync: 20, merch: 11, collectibles: 6, fans: 5 },
  { month: "Aug", streaming: 45, sync: 22, merch: 13, collectibles: 7, fans: 5 },
  { month: "Sep", streaming: 48, sync: 24, merch: 14, collectibles: 7, fans: 6 },
  { month: "Oct", streaming: 52, sync: 26, merch: 15, collectibles: 8, fans: 6 },
  { month: "Nov", streaming: 55, sync: 27, merch: 16, collectibles: 8, fans: 6 },
  { month: "Dec", streaming: 58, sync: 28, merch: 17, collectibles: 9, fans: 7 },
  { month: "Jan", streaming: 60, sync: 29, merch: 17, collectibles: 9, fans: 7 },
  { month: "Feb", streaming: 56, sync: 28, merch: 16, collectibles: 9, fans: 7 },
  { month: "Mar", streaming: 58, sync: 29, merch: 17, collectibles: 9, fans: 7 },
  { month: "Apr", streaming: 60, sync: 30, merch: 18, collectibles: 10, fans: 7 },
  { month: "May", streaming: 62, sync: 31, merch: 19, collectibles: 10, fans: 8 },
];

const agents = [
  { label: "Content Agent", desc: "Creating & optimizing content assets", icon: Wand2 },
  { label: "Remix Agent", desc: "Generating remixes & alternative versions", icon: Disc3 },
  { label: "Marketing Agent", desc: "Running campaigns & community growth", icon: Megaphone },
  { label: "Licensing Agent", desc: "Finding sync opportunities & managing deals", icon: BadgeDollarSign },
];

const fmtMoney = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

// ─── UI Helpers ─────────────────────────────────────────────────────────────
function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/30 p-1 text-[10px] font-black uppercase">
      <Languages className="ml-1 h-3.5 w-3.5 text-zinc-400" />
      <button onClick={() => setLang("en")} className={`rounded px-2 py-1 ${lang === "en" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"}`}>EN</button>
      <button onClick={() => setLang("es")} className={`rounded px-2 py-1 ${lang === "es" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"}`}>ES</button>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <div className={`relative h-5 w-9 rounded-full transition-colors ${on ? "bg-orange-500" : "bg-zinc-700"}`}>
      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
    </div>
  );
}

function MiniSpark({ data, color = "#22d3ee" }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / Math.max(1, data.length - 1)) * 100},${100 - (v / max) * 90 - 5}`).join(" ");
  return (
    <svg viewBox="0 0 100 50" preserveAspectRatio="none" className="h-8 w-20">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

function Waveform({ bars = 36, color = "#71717a" }: { bars?: number; color?: string }) {
  return (
    <div className="flex h-5 w-full items-end gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => {
        const h = 30 + Math.abs(Math.sin(i * 0.7)) * 70;
        return <span key={i} style={{ height: `${h}%`, background: color }} className="w-[2px] rounded-sm opacity-80" />;
      })}
    </div>
  );
}

function ScoreDial({ value, label = "Very High Potential" }: { value: number; label?: string }) {
  const r = 60;
  const c = 2 * Math.PI * r;
  const off = c - (Math.max(0, Math.min(100, value)) / 100) * c;
  return (
    <div className="relative h-36 w-36 sm:h-44 sm:w-44">
      <svg viewBox="0 0 160 160" className="h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        <circle cx="80" cy="80" r={r} fill="none" stroke="url(#dialGrad)" strokeWidth="14" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={off} />
        <defs>
          <linearGradient id="dialGrad" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#fb923c" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2 text-center">
        <div className="text-4xl font-black text-white sm:text-5xl">{value}</div>
        <div className="mt-1 rounded bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-orange-300">{label}</div>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    LIVE: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    "IN PROGRESS": "bg-orange-500/15 text-orange-300 border-orange-500/30",
    SCHEDULED: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    COMPLETED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CLEARED: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    CONDITIONAL: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    REVIEW: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    EXACT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    HIGH: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    MEDIUM: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    LOW: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    SAMPLE: "bg-white/10 text-zinc-300 border-white/10",
  };
  const key = s?.toUpperCase?.() ?? "";
  return <span className={`inline-block rounded border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${map[key] || "bg-white/10 text-white border-white/10"}`}>{s}</span>;
}

function Panel({ title, right, children, id }: { title: string; right?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="scroll-mt-20 overflow-hidden rounded-2xl border border-white/5 bg-[#10161d] shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
      <header className="flex items-center justify-between gap-3 border-b border-white/5 px-3 py-3 sm:px-4">
        <div className="text-sm font-black text-white">{title}</div>
        {right}
      </header>
      {children}
    </section>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-black/20 p-2">
      <div className="text-[9px] font-black uppercase text-zinc-500">{label}</div>
      <div className="mt-0.5 truncate text-xs font-black text-white">{value}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[9px] font-black uppercase text-zinc-500">{k}</div>
      <div className="truncate text-xs font-black text-white">{v}</div>
    </div>
  );
}

function Legend({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2 w-2 rounded-full" style={{ background: dot }} />
      <span className="text-zinc-400">{label}</span>
      <span className="ml-auto font-black text-white">{value}</span>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CatalogResurrectionDashboard({
  onHome,
  catalogPosterUrl,
  artistAvatarUrl,
  analysis,
  query,
  setQuery,
  onSearch,
  searchLoading,
  onRunAction,
  actionLoading,
  pendingAction,
  actionArtifact,
  visualPack,
  visualsPending,
  lang: langProp,
  setLang: setLangProp,
  onGenerateVisuals,
  generateVisualsLoading,
}: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string>(analysis?.catalog?.revivedTracks?.[0]?.id || "");
  const [searchOpen, setSearchOpen] = useState(false);
  const [internalQuery, setInternalQuery] = useState<QueryPayload>(query || { title: "", artistName: "" });
  const [lang, setLangState] = useState<Lang>(langProp ?? "en");
  const setLang = (l: Lang) => { setLangState(l); setLangProp?.(l); };
  const [revenueRange, setRevenueRange] = useState<"6m" | "12m">("12m");
  const [notifOpen, setNotifOpen] = useState(false);
  const [activeNavSection, setActiveNavSection] = useState("hero");

  useEffect(() => {
    if (query) setInternalQuery(query);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query?.title, query?.artistName, query?.isrc]);

  useEffect(() => {
    if (!selectedTrackId && analysis?.catalog?.revivedTracks?.[0]?.id) {
      setSelectedTrackId(analysis.catalog.revivedTracks[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis?.catalog?.revivedTracks?.length]);

  // Cleanup audio on unmount
  useEffect(() => () => { previewAudio?.pause(); }, [previewAudio]);

  // Sync langProp changes from parent
  useEffect(() => { if (langProp && langProp !== lang) setLangState(langProp); }, [langProp, lang]);

  // Track active section via IntersectionObserver
  useEffect(() => {
    const sectionIds = navItems.map(i => i.sectionId).filter(Boolean) as string[];
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveNavSection(entry.target.id);
        }
      },
      { threshold: 0.25, rootMargin: "-60px 0px -40% 0px" }
    );
    sectionIds.forEach(id => { const el = document.getElementById(id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, []);

  const tracks = analysis?.catalog?.revivedTracks || [];
  const selectedTrack: LegacyTrack | undefined =
    tracks.find(t => t.id === selectedTrackId) || tracks[0];

  const heroPoster = catalogPosterUrl || selectedTrack?.imageUrl ||
    "/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg";
  const heroAvatar = artistAvatarUrl || visualPack?.[1]?.imageUrl || visualPack?.[0]?.imageUrl ||
    "/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg";

  const canonicalTitle = analysis?.catalog?.canonicalTitle || "Catalog Target";
  const canonicalArtist = analysis?.catalog?.canonicalArtist || "Artist";
  const score = analysis?.metrics?.resurrectionScore ?? 87;
  const rightsReadiness = analysis?.metrics?.rightsReadiness ?? 0;
  const syncDemand = analysis?.metrics?.syncDemand ?? 0;
  const archiveCompleteness = analysis?.metrics?.archiveCompleteness ?? 0;
  const projectedAnnual = analysis?.metrics?.projectedAnnualValue ?? 0;
  const matchCount = analysis?.catalog?.matchCount ?? 0;

  const totalTracks = tracks.length;

  // Resurrection metrics derived from analysis
  const resurrectionMetrics = useMemo(() => [
    { label: "Viral Potential", value: Math.min(100, Math.round((syncDemand + score) / 2)), icon: Zap, color: "#f97316" },
    { label: "Remix Potential", value: Math.min(100, Math.round((score + 10) * 0.95)), icon: Disc3, color: "#a855f7" },
    { label: "Nostalgia Value", value: Math.min(100, Math.round(archiveCompleteness * 0.9 + 10)), icon: Sparkles, color: "#eab308" },
    { label: "Sync Potential", value: syncDemand || 75, icon: BadgeDollarSign, color: "#22d3ee" },
    { label: "Merch Potential", value: Math.min(100, Math.round((rightsReadiness + score) / 2 - 5)), icon: Shirt, color: "#ec4899" },
  ], [score, syncDemand, archiveCompleteness, rightsReadiness]);

  // Rights derived from analysis.rightsStack
  const rights = useMemo(() => {
    if (!analysis?.rightsStack?.length) {
      return [
        { label: "Master Recording", status: "REVIEW" as const, on: false },
        { label: "Publishing Split", status: "REVIEW" as const, on: false },
        { label: "Estate Outreach", status: "REVIEW" as const, on: false },
        { label: "Sync Clearance", status: "REVIEW" as const, on: false },
      ];
    }
    return analysis.rightsStack.map(r => ({
      label: r.label,
      status: (r.confidence >= 80 ? "CLEARED" : r.confidence >= 50 ? "CONDITIONAL" : "REVIEW") as "CLEARED" | "CONDITIONAL" | "REVIEW",
      on: r.confidence >= 50,
    }));
  }, [analysis?.rightsStack]);

  // Pipeline derived from analysis.timeline
  const pipeline = useMemo(() => {
    if (!analysis?.timeline?.length) return pipelineDefault;
    const icons = [Disc3, Headphones, Video, Scissors, Shirt, Target];
    return analysis.timeline.slice(0, 6).map((t, i) => ({
      n: i + 1,
      label: t.phase,
      status: (t.status?.toUpperCase?.() === "COMPLETED" ? "COMPLETED" :
              t.status?.toUpperCase?.() === "IN PROGRESS" ? "IN PROGRESS" : "SCHEDULED") as
              "COMPLETED" | "IN PROGRESS" | "SCHEDULED",
      date: `${t.days}d`,
      icon: icons[i % icons.length],
    }));
  }, [analysis?.timeline]);

  // Revenue chart — scale to projectedAnnual when available
  const revenueChart = useMemo(() => {
    const annual = projectedAnnual || 1_280_000;
    const monthlyBase = annual / 12 / 1000;
    const factor = monthlyBase / 90;
    return revenueChartDefault.map(row => ({
      month: row.month,
      streaming: Math.max(1, Math.round(row.streaming * factor)),
      sync: Math.max(1, Math.round(row.sync * factor)),
      merch: Math.max(1, Math.round(row.merch * factor)),
      collectibles: Math.max(1, Math.round(row.collectibles * factor)),
      fans: Math.max(1, Math.round(row.fans * factor)),
    }));
  }, [projectedAnnual]);

  // Quick actions wired to real handlers
  const quickActions: Array<{ label: string; icon: any; onClick: () => void }> = [
    { label: "New Catalog Intake", icon: Plus, onClick: () => { setSearchOpen(true); setMobileNavOpen(false); } },
    { label: "Run Catalog Analysis", icon: Activity, onClick: () => { onSearch?.(); } },
    { label: "Build Sync Pitch", icon: Target, onClick: () => onRunAction?.("sync-pitch", selectedTrack) },
    { label: "Package Offer", icon: BadgeDollarSign, onClick: () => onRunAction?.("package-offer", selectedTrack) },
    { label: "Open HTML Brief", icon: FileText, onClick: () => window.open("/api/legacy-catalog-resurrection/brief.html", "_blank", "noopener,noreferrer") },
  ];

  // Play/pause global mini-player
  const togglePlay = () => {
    if (!selectedTrack?.previewUrl) {
      if (selectedTrack?.streamUrl) window.open(selectedTrack.streamUrl, "_blank", "noopener,noreferrer");
      return;
    }
    if (playing && previewAudio) {
      previewAudio.pause();
      setPlaying(false);
      return;
    }
    const audio = previewAudio ?? new Audio(selectedTrack.previewUrl);
    if (!previewAudio) setPreviewAudio(audio);
    audio.play().then(() => setPlaying(true)).catch(() => {
      if (selectedTrack.streamUrl) window.open(selectedTrack.streamUrl, "_blank", "noopener,noreferrer");
    });
    audio.onended = () => setPlaying(false);
  };

  // Track preview from table row
  const playTrackPreview = (track: LegacyTrack) => {
    setSelectedTrackId(track.id);
    if (previewAudio) { previewAudio.pause(); setPlaying(false); }
    if (track.previewUrl) {
      const a = new Audio(track.previewUrl);
      setPreviewAudio(a);
      a.play().then(() => setPlaying(true)).catch(() => {
        if (track.streamUrl) window.open(track.streamUrl, "_blank", "noopener,noreferrer");
      });
      a.onended = () => setPlaying(false);
    } else if (track.streamUrl) {
      window.open(track.streamUrl, "_blank", "noopener,noreferrer");
    }
  };

  const scrollTo = (sectionId?: string) => {
    if (!sectionId) return;
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setMobileNavOpen(false);
  };

  const submitSearch = (e: FormEvent) => {
    e.preventDefault();
    if (setQuery) setQuery(internalQuery);
    onSearch?.();
    setSearchOpen(false);
  };

  // Sidebar content (shared between desktop sidebar and mobile drawer)
  const SidebarBody = ({ closeMobile }: { closeMobile?: () => void }) => (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-white/5 px-4 py-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500">
              <Music2 className="h-5 w-5 text-black" />
            </div>
            <div>
              <div className="text-sm font-black tracking-tight">Boostify</div>
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-zinc-500">Music</div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-1">
          {closeMobile && (
            <button onClick={closeMobile} className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white lg:hidden" aria-label="Close menu">
              <X className="h-4 w-4" />
            </button>
          )}
          <button onClick={() => setCollapsed(!collapsed)} className="hidden rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white lg:block" aria-label="Collapse sidebar">
            <ChevronsLeft className={`h-4 w-4 transition-transform ${collapsed ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {navItems.map((item) => {
          const isActive = activeNavSection === item.sectionId;
          return (
            <button
              key={item.label}
              onClick={() => scrollTo(item.sectionId)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold transition-colors ${
                isActive ? "bg-orange-500/15 text-orange-300" : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {isActive && !collapsed && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-orange-400" />}
            </button>
          );
        })}
        {onHome && (
          <button onClick={() => { onHome(); closeMobile?.(); }} className="mt-2 flex w-full items-center gap-3 rounded-lg border border-white/5 px-3 py-2.5 text-sm font-bold text-zinc-400 hover:bg-white/5 hover:text-white">
            <Home className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to Home</span>}
          </button>
        )}
      </nav>

      {!collapsed && (
        <div className="m-3 rounded-xl border border-white/5 bg-gradient-to-br from-orange-500/10 to-amber-500/5 p-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-orange-300">Catalogs Under Resurrection</div>
          <div className="mt-2 flex items-end justify-between gap-2">
            <div className="text-3xl font-black text-white">{totalTracks || 23}</div>
            <div className="h-8 w-20"><MiniSpark data={sidebarSparkline} color="#f97316" /></div>
          </div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Total Matches</span><span className="font-black text-white">{matchCount || tracks.length}</span></div>
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Potential Revenue</span><span className="font-black text-emerald-300">{fmtMoney(projectedAnnual || 12_400_000)}</span></div>
            <div className="h-px w-full bg-white/5" />
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Resurrection Score</span><span className="font-black text-orange-300">{score}</span></div>
          </div>
          <button onClick={() => scrollTo("catalog")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 text-[11px] font-black uppercase tracking-wider text-black hover:bg-orange-400">
            View All Catalogs <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Mini player */}
      {!collapsed && selectedTrack && (
        <div className="m-3 mt-0 flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-2">
          <img src={selectedTrack.imageUrl || heroPoster} alt="now playing" className="h-10 w-10 rounded-md object-cover" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-black text-white">{selectedTrack.title}</div>
            <div className="truncate text-[10px] text-zinc-500">{selectedTrack.artistName}</div>
          </div>
          <div className="hidden w-10 sm:block"><Waveform bars={10} color={playing ? "#f97316" : "#71717a"} /></div>
          <button onClick={togglePlay} className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-black hover:bg-orange-400" aria-label={playing ? "Pause" : "Play"}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen w-full bg-[#0a0d12] text-white">
      {/* MOBILE DRAWER */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
          <aside className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-white/5 bg-[#0c1116]">
            <SidebarBody closeMobile={() => setMobileNavOpen(false)} />
          </aside>
        </div>
      )}

      {/* DESKTOP SIDEBAR */}
      <aside className={`relative hidden shrink-0 flex-col border-r border-white/5 bg-[#0c1116] transition-all lg:flex ${collapsed ? "w-16" : "w-64"}`}>
        <SidebarBody />
      </aside>

      {/* MAIN */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/5 bg-[#0c1116]/90 px-3 py-3 backdrop-blur sm:px-4 lg:gap-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              className="rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-300 hover:text-white lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <button className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-black text-zinc-300 hover:border-orange-500/40 sm:flex" onClick={() => scrollTo("catalog")}>
              <ListMusic className="h-3.5 w-3.5 text-orange-300" /> Legacy Catalogs <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="relative flex max-w-md flex-1 items-center justify-end sm:justify-start">
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-400 hover:text-white sm:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>
            <form onSubmit={submitSearch} className="relative hidden w-full sm:block">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                value={internalQuery.title}
                onChange={e => setInternalQuery({ ...internalQuery, title: e.target.value })}
                placeholder={`Search "${canonicalTitle}" or another title...`}
                className="w-full rounded-lg border border-white/10 bg-white/[0.03] py-2 pl-9 pr-16 text-xs text-white placeholder:text-zinc-500 focus:border-orange-500/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searchLoading || !internalQuery.title.trim()}
                className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded bg-orange-500 px-2 py-1 text-[10px] font-black text-black hover:bg-orange-400 disabled:opacity-40"
              >
                {searchLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Scan"}
              </button>
            </form>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <div className="relative">
              <button onClick={() => setNotifOpen(o => !o)} className="relative hidden rounded-lg border border-white/10 bg-white/[0.03] p-2 text-zinc-400 hover:text-white sm:block" aria-label="Notifications">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-400" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-xl border border-white/10 bg-[#0c1116] p-3 shadow-2xl">
                  <div className="mb-2 flex items-center justify-between gap-2 text-[10px] font-black uppercase text-zinc-400">
                    <span>Notifications</span>
                    <button onClick={() => setNotifOpen(false)} className="text-zinc-500 hover:text-white"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  {[{ t: "New catalog match found", d: `${canonicalArtist} matched on 2 platforms`, dot: "bg-emerald-400" },
                    { t: "Rights review required", d: "Publishing split needs verification", dot: "bg-orange-400" },
                    { t: "Sync pitch ready", d: "Packet built for music supervisor outreach", dot: "bg-cyan-400" }].map(n => (
                    <div key={n.t} className="flex items-start gap-2 rounded-lg border border-white/5 bg-black/20 p-2 text-xs">
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.dot}`} />
                      <div><div className="font-bold text-white">{n.t}</div><div className="text-[10px] text-zinc-500">{n.d}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <LanguageToggle lang={lang} setLang={setLang} />
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-black text-black">B</div>
              <div className="hidden lg:block">
                <div className="text-xs font-black leading-tight text-white">Boostify Admin</div>
                <div className="text-[9px] uppercase text-zinc-500">Admin</div>
              </div>
              <ChevronDown className="hidden h-3.5 w-3.5 text-zinc-500 lg:block" />
            </div>
          </div>
        </header>

        {/* Mobile search modal */}
        {searchOpen && (
          <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/70 p-4 backdrop-blur-sm sm:p-8" onClick={() => setSearchOpen(false)}>
            <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-[#10161d] p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-sm font-black text-white">Catalog Search</div>
                <button onClick={() => setSearchOpen(false)} className="rounded p-1 text-zinc-500 hover:bg-white/5 hover:text-white"><X className="h-4 w-4" /></button>
              </div>
              <form onSubmit={submitSearch} className="grid gap-3">
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Track</span>
                  <input value={internalQuery.title} onChange={e => setInternalQuery({ ...internalQuery, title: e.target.value })} placeholder="My Girl" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Artist</span>
                  <input value={internalQuery.artistName} onChange={e => setInternalQuery({ ...internalQuery, artistName: e.target.value })} placeholder="The Temptations" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">ISRC (optional)</span>
                  <input value={internalQuery.isrc || ""} onChange={e => setInternalQuery({ ...internalQuery, isrc: e.target.value })} placeholder="USMO16400001" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <button type="submit" disabled={searchLoading || !internalQuery.title.trim() || !internalQuery.artistName.trim()} className="flex h-11 items-center justify-center gap-2 rounded-md bg-orange-500 text-sm font-black uppercase text-black hover:bg-orange-400 disabled:opacity-40">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Scan Catalog
                </button>
              </form>
            </div>
          </div>
        )}

        <main className="space-y-4 p-3 sm:p-4 lg:p-6">
          {/* HERO */}
          <section id="hero" className="relative overflow-hidden rounded-2xl border border-white/5 bg-gradient-to-br from-[#0f1520] via-[#10161d] to-[#0c1116] p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-12 left-1/3 h-48 w-48 rounded-full bg-amber-500/8 blur-2xl" />
            <div className="relative grid items-center gap-5 sm:gap-6 lg:grid-cols-[auto_1fr_auto]">
              <div className="relative mx-auto flex h-24 w-24 items-center justify-center sm:h-32 sm:w-32 lg:mx-0">
                <div className="absolute inset-0 rounded-full border-2 border-orange-500/15" />
                <div className="absolute inset-3 rounded-full border-2 border-orange-500/25" />
                <div className="absolute inset-6 rounded-full border-2 border-orange-500/35" />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30 sm:h-16 sm:w-16">
                  <Disc3 className="h-7 w-7 text-black sm:h-9 sm:w-9" style={{ animation: "spin 8s linear infinite" }} />
                </div>
              </div>

              <div className="text-center lg:text-left">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase text-orange-300">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                  {matchCount > 0 ? `Live · ${matchCount} matches` : "Demo Mode · Sample Data"}
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">Catalog Resurrection Engine</h1>
                <p className="mt-1.5 text-xs text-zinc-400 sm:text-sm">AI-powered resurrection of dormant catalogs.</p>
                <p className="text-xs font-bold text-zinc-300 sm:text-sm">Reimagine. Reconnect. Reignite Revenue.</p>
                {analysis && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="rounded-md bg-orange-500/15 px-2 py-1 text-[10px] font-black uppercase text-orange-300">Now: {canonicalArtist} — {canonicalTitle}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 text-center sm:gap-6">
                {[
                  { v: String(totalTracks || 23), l: "Tracks Found", icon: Activity },
                  { v: String(matchCount || 0), l: "Live Matches", icon: Music2 },
                  { v: fmtMoney(projectedAnnual || 12_400_000), l: "Revenue Potential", icon: DollarSign },
                ].map((s) => (
                  <div key={s.l} className="space-y-1">
                    <s.icon className="mx-auto h-4 w-4 text-orange-400" />
                    <div className="text-lg font-black text-white sm:text-2xl">{s.v}</div>
                    <div className="text-[9px] font-black uppercase tracking-wider text-zinc-500 sm:text-[10px]">{s.l}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ROW 1 */}
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]">
            <Panel title="Catalog Analysis" id="catalog">
              <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[150px_1fr]">
                <img src={heroPoster} alt={canonicalArtist} className="h-44 w-full rounded-lg object-cover md:h-44" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-xl font-black text-white">{canonicalArtist}</div>
                    <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-orange-300">SELECTED</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{selectedTrack?.era || "Catalog era"} · {selectedTrack?.releaseDate || ""}</div>
                  <div className="mt-1 truncate text-xs text-zinc-400">Featured: <span className="font-bold text-white">{canonicalTitle}</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <Cell label="Total Matches" value={String(matchCount)} />
                    <Cell label="Total Tracks" value={String(totalTracks)} />
                    <Cell label="Era" value={selectedTrack?.era || "Vintage"} />
                    <Cell label="Confidence" value={selectedTrack?.confidence || "—"} />
                  </div>
                </div>
              </div>
              <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 sm:px-4">Top Catalog Tracks</div>
              <div className="space-y-1 px-2 pb-3">
                {tracks.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => playTrackPreview(t)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5 ${selectedTrack?.id === t.id ? "bg-orange-500/10" : ""}`}
                  >
                    {playing && selectedTrack?.id === t.id ? <Pause className="h-3.5 w-3.5 shrink-0 text-orange-300" /> : <Play className="h-3.5 w-3.5 shrink-0 text-orange-300" />}
                    <span className="w-24 shrink-0 truncate text-xs font-bold text-white sm:w-32">{t.title}</span>
                    <div className="min-w-0 flex-1"><Waveform bars={32} color={selectedTrack?.id === t.id ? "#f97316" : "#71717a"} /></div>
                    <span className="hidden text-[10px] text-zinc-500 sm:inline">{t.platform || "—"}</span>
                  </button>
                ))}
                {tracks.length === 0 && (
                  <div className="px-3 py-4 text-center text-[11px] text-zinc-500">Run a search to populate the catalog.</div>
                )}
              </div>
              <div className="border-t border-white/5 px-3 py-3 text-xs sm:px-4">
                <button onClick={() => scrollTo("songs")} className="flex items-center gap-1 font-black text-orange-300 hover:text-orange-200">
                  View All Tracks ({totalTracks}) <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Panel>

            <Panel title="Resurrection Score" id="score">
              <div className="flex flex-col items-center p-4">
                <ScoreDial value={score} label={score >= 85 ? "Very High Potential" : score >= 70 ? "High Potential" : score >= 50 ? "Moderate" : "Needs Work"} />
                <div className="mt-4 w-full space-y-2">
                  {resurrectionMetrics.map((m) => (
                    <div key={m.label} className="flex items-center gap-2 text-xs">
                      <m.icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
                      <span className="flex-1 truncate text-zinc-300">{m.label}</span>
                      <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-white/5 sm:w-20">
                        <div className="h-full rounded-full" style={{ width: `${m.value}%`, background: m.color }} />
                      </div>
                      <span className="w-7 text-right font-black text-white">{m.value}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex w-full items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 p-3 text-[11px] leading-5 text-orange-200">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {score >= 80
                    ? "This catalog has exceptional potential across multiple monetization vectors."
                    : score >= 60
                      ? "Strong revival candidate; prioritize sync and remaster pipelines."
                      : "Run a deeper search or try an ISRC for higher confidence."}
                </div>
              </div>
            </Panel>

            <div className="grid gap-4 lg:col-span-2 xl:col-span-1">
              <Panel title="Rights & Permissions" id="rights">
                <div className="space-y-2 p-3 sm:p-4">
                  {rights.map((r) => (
                    <div key={r.label} className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 transition ${r.on ? "border-emerald-500/20 bg-emerald-500/5" : "border-white/5 bg-black/20"}`}>
                      <div className="flex items-center gap-2 text-xs font-bold text-white">
                        <ShieldCheck className={`h-3.5 w-3.5 ${r.on ? "text-emerald-400" : "text-zinc-600"}`} />
                        <span className="truncate">{r.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge s={r.status} />
                        <Toggle on={r.on} />
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => onRunAction?.("estate-outreach", selectedTrack)}
                    className="mt-2 flex items-center gap-1 text-[11px] font-black text-orange-300 transition hover:text-orange-200"
                  >
                    {pendingAction === "estate-outreach" && actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Prepare Estate Outreach <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </Panel>

              <Panel title="Digital Artist Version" id="artist">
                <div className="grid gap-3 p-3 sm:p-4 sm:grid-cols-[110px_1fr]">
                  <div className="relative">
                    <img src={heroAvatar} alt="Digital Artist" className="h-32 w-full rounded-lg object-cover" />
                    <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-[9px] font-black uppercase text-orange-300">v1.0</span>
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-base font-black text-white">{canonicalArtist}</div>
                    <div className="text-[10px] font-black uppercase text-zinc-500">Digital Legacy Artist</div>
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                      <KV k="Era" v={selectedTrack?.era || "Vintage"} />
                      <KV k="Status" v={selectedTrack?.confidence || "Review"} />
                      <KV k="Sources" v={String(analysis?.source?.platformsMatched?.length || 0)} />
                      <KV k="Score" v={String(score)} />
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/5 p-3">
                  <button
                    onClick={() => onRunAction?.("ai-memo", selectedTrack)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] py-2 text-[11px] font-black uppercase text-zinc-200 hover:border-orange-500/40 hover:text-white"
                  >
                    {pendingAction === "ai-memo" && actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bot className="h-3 w-3" />}
                    Generate AI Memo <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </Panel>
            </div>
          </section>

          {/* ROW 2 */}
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1fr_1.2fr_1fr]">
            <Panel
              id="pipeline"
              title="Content Pipeline"
              right={<button onClick={() => scrollTo("songs")} className="hidden items-center gap-1 text-[10px] font-black uppercase text-orange-300 sm:flex">View All Tracks <ArrowRight className="h-3 w-3" /></button>}
            >
              <div className="grid grid-cols-3 gap-3 p-3 sm:p-4">
                {pipeline.map((p) => (
                  <div key={p.n} className="relative flex flex-col items-center text-center">
                    <div className="relative mb-2 flex h-12 w-12 items-center justify-center rounded-full border-2 border-orange-500/30 bg-black/40 sm:h-14 sm:w-14">
                      <p.icon className="h-4 w-4 text-orange-300 sm:h-5 sm:w-5" />
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-black text-black">{p.n}</span>
                    </div>
                    <div className="text-[10px] font-black leading-tight text-white">{p.label}</div>
                    <div className="mt-1"><StatusBadge s={p.status} /></div>
                    <div className="mt-1 text-[9px] text-zinc-500">{p.date}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              id="revenue"
              title="Revenue / Monetization"
              right={
                <button onClick={() => setRevenueRange(r => r === "12m" ? "6m" : "12m")} className="hidden items-center gap-1 rounded border border-white/10 bg-white/[0.03] px-2 py-1 text-[10px] font-black text-zinc-400 hover:border-orange-500/40 hover:text-white sm:flex">
                  Last {revenueRange === "12m" ? "12 Months" : "6 Months"} <ChevronDown className="h-3 w-3" />
                </button>
              }
            >
              <div className="px-3 pt-3 sm:px-4">
                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-end">
                  <div>
                    <div className="text-[10px] font-black uppercase text-zinc-500">Total Revenue</div>
                    <div className="text-2xl font-black text-white sm:text-3xl">{fmtMoney(projectedAnnual || 1_280_000)}</div>
                    <div className="mt-1 flex items-center gap-1 text-[11px] font-black text-emerald-300"><TrendingUp className="h-3 w-3" /> 142% vs prior 12 months</div>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:w-auto sm:grid-cols-1">
                    <Legend dot="#22d3ee" label="Streaming" value={fmtMoney((projectedAnnual || 1_280_000) * 0.48)} />
                    <Legend dot="#a855f7" label="Sync" value={fmtMoney((projectedAnnual || 1_280_000) * 0.24)} />
                    <Legend dot="#22c55e" label="Merch" value={fmtMoney((projectedAnnual || 1_280_000) * 0.14)} />
                    <Legend dot="#eab308" label="Collectibles" value={fmtMoney((projectedAnnual || 1_280_000) * 0.08)} />
                    <Legend dot="#ec4899" label="Fan Membership" value={fmtMoney((projectedAnnual || 1_280_000) * 0.06)} />
                  </div>
                </div>
              </div>
              <div className="h-52 p-3 sm:p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueRange === "6m" ? revenueChart.slice(-6) : revenueChart} margin={{ top: 10, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#71717a", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}K`} />
                    <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "#fff", fontSize: 11 }} />
                    <Line type="monotone" dataKey="streaming" stroke="#22d3ee" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="sync" stroke="#a855f7" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="merch" stroke="#22c55e" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="collectibles" stroke="#eab308" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="fans" stroke="#ec4899" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Panel>

            <Panel id="agents" title="AI Agent Command Center" right={<button onClick={() => onRunAction?.("sync-pitch", selectedTrack)} className="hidden items-center gap-1 text-[10px] font-black uppercase text-orange-300 sm:flex">Run Pitch <ArrowRight className="h-3 w-3" /></button>}>
              <div className="grid grid-cols-2 gap-3 p-3 sm:p-4">
                {agents.map((a) => {
                  const action = a.label === "Content Agent" ? "ai-memo"
                    : a.label === "Remix Agent" ? "package-offer"
                    : a.label === "Marketing Agent" ? "sync-pitch"
                    : "estate-outreach";
                  const isRunning = pendingAction === action && actionLoading;
                  return (
                    <button
                      key={a.label}
                      onClick={() => onRunAction?.(action, selectedTrack)}
                      className="rounded-xl border border-white/5 bg-black/25 p-3 text-left transition hover:border-orange-500/30 hover:bg-orange-500/5"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition sm:h-9 sm:w-9 ${isRunning ? "bg-orange-500/30 shadow-[0_0_12px_rgba(249,115,22,0.3)]" : "bg-orange-500/15"}`}>
                          {isRunning ? <Loader2 className="h-4 w-4 animate-spin text-orange-300" /> : <a.icon className="h-4 w-4 text-orange-300" />}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-white">{a.label}</div>
                          <div className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-300">
                            <span className={`h-1.5 w-1.5 rounded-full ${isRunning ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`} />
                            {isRunning ? "Running..." : "Active"}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 line-clamp-2 text-[10px] leading-4 text-zinc-500">{a.desc}</div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </section>

          {/* ROW 3 */}
          <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <Panel id="songs" title={`Revived Songs (${tracks.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead className="border-b border-white/5 bg-black/20 text-[10px] uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-3 sm:px-4">Title</th>
                      <th className="px-3 py-3">Era</th>
                      <th className="hidden px-3 py-3 md:table-cell">Platform</th>
                      <th className="px-3 py-3">Confidence</th>
                      <th className="hidden px-3 py-3 md:table-cell">Score</th>
                      <th className="px-3 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tracks.map((s) => (
                      <tr
                        key={s.id}
                        onClick={() => setSelectedTrackId(s.id)}
                        className={`cursor-pointer border-b border-white/5 hover:bg-white/[0.02] ${selectedTrack?.id === s.id ? "bg-orange-500/10" : ""}`}
                      >
                        <td className="px-3 py-3 sm:px-4">
                          <div className="flex items-center gap-3">
                            <img src={s.imageUrl} alt={s.title} className="h-9 w-9 rounded-md object-cover" />
                            <div className="min-w-0">
                              <div className="truncate font-black text-white">{s.title}</div>
                              <div className="truncate text-[10px] text-zinc-500">{s.artistName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-300">{s.era}</td>
                        <td className="hidden px-3 py-3 text-zinc-300 md:table-cell">{s.platform || "Archive"}</td>
                        <td className="px-3 py-3"><StatusBadge s={s.confidence || "review"} /></td>
                        <td className="hidden px-3 py-3 font-black text-orange-300 md:table-cell">{s.revivalScore}</td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5 text-zinc-500">
                            <button onClick={(e) => { e.stopPropagation(); playTrackPreview(s); }} className="rounded p-1.5 hover:bg-white/5 hover:text-white" title="Play preview">
                              {playing && selectedTrack?.id === s.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onRunAction?.("ai-memo", s); }} className="rounded p-1.5 hover:bg-white/5 hover:text-white" title="AI memo">
                              <Bot className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); window.open(s.streamUrl || "/api/legacy-catalog-resurrection/brief.html", "_blank", "noopener,noreferrer"); }} className="rounded p-1.5 hover:bg-white/5 hover:text-white" title={s.streamUrl ? "Open on platform" : "Open catalog brief"}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tracks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[11px] text-zinc-500">
                          No revived tracks yet. Use the search bar above to scan a catalog.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="border-t border-white/5 px-3 py-3 text-right text-xs sm:px-4">
                <button onClick={() => onSearch?.()} className="inline-flex items-center gap-1 font-black text-orange-300 hover:text-orange-200">
                  Re-scan catalog <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </Panel>

            <Panel id="settings" title="Quick Actions">
              <div className="space-y-2 p-3">
                {quickActions.map((q) => (
                  <button
                    key={q.label}
                    onClick={q.onClick}
                    className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5 text-left text-xs font-bold text-zinc-200 transition hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-white"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-orange-500/15"><q.icon className="h-4 w-4 text-orange-300" /></div>
                    <span className="flex-1 truncate">{q.label}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  </button>
                ))}
              </div>
              {actionArtifact && (
                <div className="border-t border-white/5 p-3">
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <div className="text-xs font-black text-white">{actionArtifact.title}</div>
                    <div className="mt-1 text-[10px] font-black uppercase text-emerald-300">{actionArtifact.status}</div>
                    <p className="mt-2 text-[11px] leading-5 text-zinc-300">{actionArtifact.summary}</p>
                    {actionArtifact.nextSteps?.length > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {actionArtifact.nextSteps.slice(0, 3).map(step => (
                          <div key={step} className="text-[10px] leading-4 text-zinc-400">· {step}</div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </Panel>
          </section>

          {visualPack && visualPack.length > 0 && (
            <section>
              <Panel
                title="Catalog Visuals"
                right={
                  <div className="flex items-center gap-2">
                    {visualsPending && (
                      <span className="flex items-center gap-1 text-[9px] font-black uppercase text-amber-400">
                        <Loader2 className="h-3 w-3 animate-spin" /> Generating visuals…
                      </span>
                    )}
                  </div>
                }
              >
                <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4 md:grid-cols-3 xl:grid-cols-4">
                  {visualPack.filter((v, i, arr) => arr.findIndex(x => x.imageUrl === v.imageUrl) === i).map(v => (
                    <button
                      key={v.id}
                      onClick={() => window.open(v.imageUrl, "_blank", "noopener,noreferrer")}
                      className="group overflow-hidden rounded-lg border border-white/10 bg-black/25 text-left hover:border-orange-500/50"
                    >
                      <div className="relative">
                        <img src={v.imageUrl} alt={v.title} className="h-36 w-full object-cover transition group-hover:scale-105 sm:h-40" loading="lazy" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 transition group-hover:opacity-100" />
                      </div>
                      <div className="p-3">
                        <div className="truncate text-xs font-black text-white">{v.title}</div>
                        <div className="mt-1 line-clamp-2 text-[10px] text-zinc-500">{v.prompt}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </Panel>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
