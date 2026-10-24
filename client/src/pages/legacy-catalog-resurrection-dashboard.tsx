import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Archive,
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeDollarSign,
  ChevronsLeft,
  Disc3,
  Home,
  LayoutGrid,
  Loader2,
  Menu,
  Music2,
  Pause,
  Play,
  Plus,
  Search,
  ShieldCheck,
  Target,
  X,
  FileText,
  ListMusic,
  Languages,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────
type Lang = "en" | "es";
type QueryPayload = { title: string; artistName: string; isrc?: string };

type LegacyTrack = {
  id: string;
  title: string;
  artistName: string;
  albumName?: string;
  era: string;
  releaseDate: string;
  rightsStatus: string;
  imageUrl?: string;
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
    canonicalTitle: string;
    canonicalArtist: string;
    canonicalIsrc?: string | null;
    matchCount: number;
    revivedTracks: LegacyTrack[];
  };
  rightsStack: Array<{ label: string; status: string }>;
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
  recordId?: number;
  researchId?: number;
};

type SavedResearch = { id: number; kind: string; query: QueryPayload | null; analysis: LegacyAnalysis | null; artifact: LegacyActionArtifact | null; createdAt: string };

type Props = {
  onHome?: () => void;
  analysis?: LegacyAnalysis;
  selectedResearchId?: number | null;
  query?: QueryPayload;
  setQuery?: (q: QueryPayload) => void;
  onSearch?: (query?: QueryPayload) => void;
  searchLoading?: boolean;
  onRunAction?: (action: string, track?: LegacyTrack) => void;
  actionLoading?: boolean;
  pendingAction?: string | null;
  actionArtifact?: LegacyActionArtifact | null;
  lang?: Lang;
  setLang?: (l: Lang) => void;
  searchError?: string | null;
  savedResearch?: SavedResearch[];
  historyLoading?: boolean;
  historyError?: boolean;
  onRestoreResearch?: (record: SavedResearch) => void;
};

export type { Props as CatalogResurrectionDashboardProps };

// ─── Constants ──────────────────────────────────────────────────────────────
const navItems: Array<{ label: string; icon: any; sectionId?: string; active?: boolean }> = [
  { label: "Dashboard", icon: LayoutGrid, sectionId: "hero", active: true },
  { label: "Catalog Intake", icon: ListMusic, sectionId: "catalog" },
  { label: "Match Evidence", icon: Activity, sectionId: "score" },
  { label: "Rights Verification", icon: BadgeDollarSign, sectionId: "rights" },
  { label: "Saved Research", icon: Archive, sectionId: "saved-research" },
  { label: "Tracks", icon: ListMusic, sectionId: "songs" },
  { label: "Quick Actions", icon: FileText, sectionId: "settings" },
];



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

function StatusBadge({ s }: { s: string }) {
  const map: Record<string, string> = {
    EXACT: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    HIGH: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    MEDIUM: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    LOW: "bg-amber-500/15 text-amber-300 border-amber-500/30",
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

// ─── Main Component ─────────────────────────────────────────────────────────
export default function CatalogResurrectionDashboard({
  onHome,
  analysis,
  selectedResearchId,
  query,
  setQuery,
  onSearch,
  searchLoading,
  onRunAction,
  actionLoading,
  pendingAction,
  actionArtifact,
  lang: langProp,
  setLang: setLangProp,
  searchError,
  savedResearch = [],
  historyLoading = false,
  historyError = false,
  onRestoreResearch,
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
  const canPlaySelectedTrack = Boolean(selectedTrack?.previewUrl || selectedTrack?.streamUrl);

  const canonicalTitle = analysis?.catalog?.canonicalTitle || "No recording selected";
  const canonicalArtist = analysis?.catalog?.canonicalArtist || "Search to begin";
  const matchCount = analysis?.catalog?.matchCount ?? 0;
  const hasSearched = Boolean(analysis?.query?.isrc || (analysis?.query?.title && analysis?.query?.artistName));

  const totalTracks = tracks.length;
  const matchedSources = new Set(tracks.map(track => track.platform).filter(Boolean)).size;
  const exactMatches = tracks.filter(track => track.confidence === "exact").length;
  const playablePreviews = tracks.filter(track => Boolean(track.previewUrl)).length;


  // Rights derived from analysis.rightsStack
  const rights = useMemo(() => {
    if (!analysis?.rightsStack?.length) return [];
    return analysis.rightsStack.map(r => ({ label: r.label, status: r.status.toUpperCase(), on: false }));
  }, [analysis?.rightsStack]);


  const buildBriefUrl = (track?: LegacyTrack) => {
    const params = new URLSearchParams();
    if (selectedResearchId) params.set("researchId", String(selectedResearchId));
    if (track) params.set("trackId", track.id);
    return `/api/legacy-catalog-resurrection/brief.html?${params.toString()}`;
  };

  // Quick actions wired to real handlers
  const quickActions: Array<{ label: string; icon: any; onClick: () => void; disabled?: boolean }> = [
    { label: "New Catalog Intake", icon: Plus, onClick: () => { setSearchOpen(true); setMobileNavOpen(false); } },
    { label: "Run Catalog Search", icon: Activity, onClick: () => { onSearch?.(); }, disabled: searchLoading || (!query?.isrc?.trim() && (!query?.title.trim() || !query?.artistName.trim())) },
    { label: "Save Sync Pitch Draft", icon: Target, onClick: () => onRunAction?.("sync-pitch", selectedTrack), disabled: !selectedTrack || actionLoading },
    { label: "Save Offer Outline", icon: BadgeDollarSign, onClick: () => onRunAction?.("package-offer", selectedTrack), disabled: !selectedTrack || actionLoading },
    { label: "Open Track Brief", icon: FileText, onClick: () => window.open(buildBriefUrl(selectedTrack), "_blank", "noopener,noreferrer"), disabled: !selectedTrack },
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
    onSearch?.(internalQuery);
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
        <div className="m-3 rounded-xl border border-white/5 bg-black/20 p-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Current Search</div>
          <div className="mt-2 text-2xl font-black text-white">{totalTracks}</div>
          <div className="text-[10px] text-zinc-500">Matched recordings</div>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Sources matched</span><span className="font-black text-white">{matchedSources}</span></div>
            <div className="flex items-center justify-between text-[11px]"><span className="text-zinc-500">Exact matches</span><span className="font-black text-white">{exactMatches}</span></div>
          </div>
          <button onClick={() => scrollTo("catalog")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 py-2 text-[11px] font-black uppercase tracking-wider text-black hover:bg-orange-400">
            Open Catalog Intake <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Mini player */}
      {!collapsed && selectedTrack && (
        <div className="m-3 mt-0 flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 p-2">
          {selectedTrack.imageUrl ? <img src={selectedTrack.imageUrl} alt={selectedTrack.title} className="h-10 w-10 rounded-md object-cover" /> : <div className="grid h-10 w-10 place-items-center rounded-md bg-white/5"><Music2 className="h-4 w-4 text-zinc-500" /></div>}
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-black text-white">{selectedTrack.title}</div>
            <div className="truncate text-[10px] text-zinc-500">{selectedTrack.artistName}</div>
          </div>
          <button onClick={togglePlay} disabled={!canPlaySelectedTrack} className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500 text-black hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40" aria-label={playing ? "Pause" : "Play"} title={canPlaySelectedTrack ? "Play preview or open source" : "No public preview or source link"}>
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
              <ListMusic className="h-3.5 w-3.5 text-orange-300" /> Catalog Intake
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
            <button onClick={() => setSearchOpen(true)} className="hidden w-full items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-zinc-500 hover:border-orange-500/40 sm:flex">
              <Search className="h-3.5 w-3.5" /> Search by title, artist, or ISRC
            </button>
          </div>

          <div className="flex items-center gap-2 lg:gap-3">
            <LanguageToggle lang={lang} setLang={setLang} />
            <div className="px-2 py-1.5 text-xs font-bold text-zinc-400">
              <div className="hidden lg:block">
                Catalog Research
              </div>
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
                  <input value={internalQuery.title} onChange={e => setInternalQuery({ ...internalQuery, title: e.target.value, isrc: undefined })} placeholder="My Girl" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">Artist</span>
                  <input value={internalQuery.artistName} onChange={e => setInternalQuery({ ...internalQuery, artistName: e.target.value, isrc: undefined })} placeholder="The Temptations" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <label className="block">
                  <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">ISRC (optional)</span>
                  <input value={internalQuery.isrc || ""} onChange={e => setInternalQuery({ ...internalQuery, isrc: e.target.value })} placeholder="USMO16400001" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-orange-500" />
                </label>
                <button type="submit" disabled={searchLoading || (!internalQuery.isrc?.trim() && (!internalQuery.title.trim() || !internalQuery.artistName.trim()))} className="flex h-11 items-center justify-center gap-2 rounded-md bg-orange-500 text-sm font-black uppercase text-black hover:bg-orange-400 disabled:opacity-40">
                  {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Scan Catalog
                </button>
              </form>
            </div>
          </div>
        )}

        <main className="space-y-4 p-3 sm:p-4 lg:p-6">
          <Panel title="Saved catalog research" id="saved-research">
            {historyError ? <div role="alert" className="px-4 py-5 text-xs text-red-300">Saved catalog research is unavailable. Refresh the page to reconnect to your account database.</div> : historyLoading ? <div className="flex items-center gap-2 px-4 py-5 text-xs text-zinc-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading saved research…</div> : savedResearch.length ? <div className="max-h-80 divide-y divide-white/5 overflow-y-auto">
              {savedResearch.map(record => {
                const recordQuery = record.query || record.analysis?.query;
                const label = recordQuery ? `${recordQuery.artistName || "Unknown artist"} · ${recordQuery.title || recordQuery.isrc || "ISRC search"}` : record.artifact?.title || "Saved document";
                return <button key={record.id} onClick={() => onRestoreResearch?.(record)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-white/[0.04]">
                  <span className={`rounded px-2 py-1 text-[9px] font-black uppercase ${record.kind === "search" ? "bg-cyan-500/10 text-cyan-300" : "bg-orange-500/10 text-orange-300"}`}>{record.kind === "search" ? "Search" : "Document"}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-zinc-200">{label}</span>
                  <time className="shrink-0 text-[10px] text-zinc-500">{new Date(record.createdAt).toLocaleDateString()}</time>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
                </button>;
              })}
            </div> : <div className="px-4 py-5 text-xs text-zinc-500">No saved searches or documents yet. Search a recording to save its results to your account.</div>}
          </Panel>
          {/* HERO */}
          <section id="hero" className="rounded-2xl border border-white/5 bg-[#10161d] p-5 sm:p-6">
            <div className="relative grid items-center gap-5 sm:gap-6 lg:grid-cols-[auto_1fr_auto]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-orange-500/10 lg:mx-0">
                <Disc3 className="h-8 w-8 text-orange-300" />
              </div>

              <div className="text-center lg:text-left">
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase text-orange-300">
                  {matchCount > 0 ? `${matchCount} public matches` : hasSearched ? "No matches returned" : "Catalog research"}
                </div>
                <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl lg:text-4xl">Legacy Catalog Research</h1>
                <p className="mt-1.5 text-xs text-zinc-400 sm:text-sm">Search recording metadata across connected public music sources and save your research.</p>
                {searchError && <div role="alert" className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{searchError}</div>}
                {analysis && (
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
                    <span className="rounded-md bg-orange-500/15 px-2 py-1 text-[10px] font-black uppercase text-orange-300">Now: {canonicalArtist} — {canonicalTitle}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-center sm:gap-6">
                {[
                  { v: String(matchedSources), l: "Sources Matched", icon: Activity },
                  { v: String(totalTracks), l: "Recordings Found", icon: Music2 },
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
          <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-[1.2fr_1fr]">
            <Panel title="Catalog Analysis" id="catalog">
              <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[150px_1fr]">
                {selectedTrack?.imageUrl ? <img src={selectedTrack.imageUrl} alt={`${canonicalArtist} - ${canonicalTitle}`} className="h-44 w-full rounded-lg object-cover md:h-44" /> : <div className="grid h-44 w-full place-items-center rounded-lg border border-white/5 bg-black/25 text-center"><div><Music2 className="mx-auto h-7 w-7 text-zinc-600" /><span className="mt-2 block text-[10px] text-zinc-600">Artwork appears when a source provides it</span></div></div>}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-xl font-black text-white">{canonicalArtist}</div>
                    {selectedTrack && <span className="rounded bg-orange-500/15 px-2 py-0.5 text-[9px] font-black uppercase text-orange-300">SELECTED</span>}
                  </div>
                  <div className="mt-1 truncate text-xs text-zinc-500">{selectedTrack?.releaseDate || "Release date not available"}</div>
                  <div className="mt-1 truncate text-xs text-zinc-400">Featured: <span className="font-bold text-white">{canonicalTitle}</span></div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <Cell label="Total Matches" value={String(matchCount)} />
                    <Cell label="Total Tracks" value={String(totalTracks)} />
                    <Cell label="Era" value={selectedTrack?.era || "Not available"} />
                    <Cell label="Confidence" value={selectedTrack?.confidence || "—"} />
                  </div>
                </div>
              </div>
              <div className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 sm:px-4">Matched Recordings</div>
              <div className="space-y-1 px-2 pb-3">
                {tracks.slice(0, 5).map((t) => (
                  <button
                    key={t.id}
                    onClick={() => playTrackPreview(t)}
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-white/5 ${selectedTrack?.id === t.id ? "bg-orange-500/10" : ""}`}
                  >
                    {playing && selectedTrack?.id === t.id ? <Pause className="h-3.5 w-3.5 shrink-0 text-orange-300" /> : <Play className="h-3.5 w-3.5 shrink-0 text-orange-300" />}
                    <span className="w-24 shrink-0 truncate text-xs font-bold text-white sm:w-32">{t.title}</span>
                    <span className="min-w-0 flex-1 truncate text-[10px] text-zinc-500">{t.artistName}{t.albumName ? ` · ${t.albumName}` : ""}</span>
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

            <Panel title="Match evidence" id="score">
              <div className="grid h-full content-center gap-3 p-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                {[
                  ["Matched sources", String(matchedSources)],
                  ["Exact recording matches", String(exactMatches)],
                  ["Playable previews", String(playablePreviews)],
                ].map(([label, value]) => <div key={label} className="rounded-lg border border-white/5 bg-black/20 p-4">
                  <div className="text-[10px] font-black uppercase tracking-wider text-zinc-500">{label}</div>
                  <div className="mt-2 text-3xl font-black text-white">{value}</div>
                </div>)}
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
                      </div>
                    </div>
                  ))}
                  {rights.length === 0 && <p className="rounded-lg border border-white/5 bg-black/20 px-3 py-4 text-xs text-zinc-500">No matched recording yet. Rights status is never inferred from streaming matches.</p>}
                  <button
                    onClick={() => onRunAction?.("estate-outreach", selectedTrack)}
                    disabled={!selectedTrack}
                    className="mt-2 flex items-center gap-1 text-[11px] font-black text-orange-300 transition hover:text-orange-200 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {pendingAction === "estate-outreach" && actionLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Save Rights Verification Checklist <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </Panel>

            </div>
          </section>
          {/* ROW 3 */}
          <section className="grid gap-4 xl:grid-cols-[1fr_280px]">
            <Panel id="songs" title={`Matched Recordings (${tracks.length})`}>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead className="border-b border-white/5 bg-black/20 text-[10px] uppercase text-zinc-500">
                    <tr>
                      <th className="px-3 py-3 sm:px-4">Title</th>
                      <th className="px-3 py-3">Era</th>
                      <th className="hidden px-3 py-3 md:table-cell">Platform</th>
                      <th className="px-3 py-3">Confidence</th>
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
                            {s.imageUrl ? <img src={s.imageUrl} alt={s.title} className="h-9 w-9 rounded-md object-cover" /> : <span className="grid h-9 w-9 place-items-center rounded-md bg-white/5"><Music2 className="h-4 w-4 text-zinc-500" /></span>}
                            <div className="min-w-0">
                              <div className="truncate font-black text-white">{s.title}</div>
                              <div className="truncate text-[10px] text-zinc-500">{s.artistName}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-zinc-300">{s.era}</td>
                        <td className="hidden px-3 py-3 text-zinc-300 md:table-cell">{s.platform || "Unknown source"}</td>
                        <td className="px-3 py-3"><StatusBadge s={s.confidence || "review"} /></td>
                        <td className="px-3 py-3">
                          <div className="flex items-center justify-end gap-1.5 text-zinc-500">
                            <button onClick={(e) => { e.stopPropagation(); playTrackPreview(s); }} disabled={!s.previewUrl && !s.streamUrl} className="rounded p-1.5 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-30" title={s.previewUrl ? "Play preview" : s.streamUrl ? "Open source" : "No public preview or source link"}>
                              {playing && selectedTrack?.id === s.id ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onRunAction?.("archive-reference", s); }} className="rounded p-1.5 hover:bg-white/5 hover:text-white" title="Save metadata summary">
                              <FileText className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); window.open(s.streamUrl || buildBriefUrl(s), "_blank", "noopener,noreferrer"); }} className="rounded p-1.5 hover:bg-white/5 hover:text-white" title={s.streamUrl ? "Open on platform" : "Open track research brief"}>
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {tracks.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-[11px] text-zinc-500">
                          No matched recordings yet. Search by title and artist or by ISRC.
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
                    disabled={q.disabled}
                    className="flex w-full items-center gap-3 rounded-lg border border-white/5 bg-black/20 px-3 py-2.5 text-left text-xs font-bold text-zinc-200 transition hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
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
                    {selectedTrack && <button onClick={() => window.open(buildBriefUrl(selectedTrack), "_blank", "noopener,noreferrer")} className="mt-3 flex w-full items-center justify-center gap-2 rounded-md bg-orange-500 px-3 py-2 text-[10px] font-black uppercase text-black hover:bg-orange-400">Open track brief <ArrowUpRight className="h-3.5 w-3.5" /></button>}
                  </div>
                </div>
              )}
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}
