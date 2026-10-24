import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  FolderSearch,
  Globe2,
  Languages,
  Loader2,
  LockKeyhole,
  Search,
} from "lucide-react";
import { apiRequest } from "../lib/queryClient";
import { useAuth } from "../hooks/use-auth";
import { useLocation } from "wouter";
import CatalogResurrectionDashboard from "./legacy-catalog-resurrection-dashboard";

type Lang = "en" | "es";

type QueryPayload = {
  title: string;
  artistName: string;
  isrc?: string;
};

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
  researchId?: number;
};

type SavedResearch = {
  id: number;
  kind: string;
  query: QueryPayload | null;
  analysis: LegacyAnalysis | null;
  artifact: LegacyActionArtifact | null;
  createdAt: string;
};

const fallbackAnalysis: LegacyAnalysis = {
  query: { title: "", artistName: "" },
  source: {
    spotifyConfigured: false,
    appleMusicPublicSearch: true,
    deezerPublicSearch: true,
    musicBrainzRegistry: true,
    platformsMatched: [],
    platformsChecked: ["spotify", "apple_music", "deezer", "musicbrainz"],
    platformsSkipped: [],
  },
  catalog: {
    canonicalTitle: "",
    canonicalArtist: "",
    canonicalIsrc: null,
    matchCount: 0,
    revivedTracks: [],
  },
  rightsStack: [],
};

const copy = {
  en: { searchTitle: "Catalog lookup", track: "Track title", artist: "Artist name", isrc: "ISRC optional", scan: "Search catalog", openEngine: "Open research" },
  es: { searchTitle: "Busqueda de catalogo", track: "Titulo", artist: "Artista", isrc: "ISRC opcional", scan: "Buscar catalogo", openEngine: "Abrir investigacion" },
} as const;

function platformLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function LanguageToggle({ lang, setLang }: { lang: Lang; setLang: (lang: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-white/10 bg-black/30 p-1 text-[10px] font-black uppercase">
      <Languages className="ml-1 h-3.5 w-3.5 text-zinc-400" />
      <button onClick={() => setLang("en")} className={`rounded px-2 py-1 ${lang === "en" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"}`}>EN</button>
      <button onClick={() => setLang("es")} className={`rounded px-2 py-1 ${lang === "es" ? "bg-orange-500 text-white" : "text-zinc-400 hover:text-white"}`}>ES</button>
    </div>
  );
}

function CatalogSearch({ t, query, setQuery, onSubmit, loading }: { t: typeof copy.en | typeof copy.es; query: QueryPayload; setQuery: (query: QueryPayload) => void; onSubmit: () => void; loading: boolean }) {
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();
  };

  const suggestions: Array<{ title: string; artistName: string; tag: string }> = [
    { title: "My Girl", artistName: "The Temptations", tag: "Classic soul" },
    { title: "Ain't No Sunshine", artistName: "Bill Withers", tag: "Soul 70s" },
    { title: "Dreams", artistName: "Fleetwood Mac", tag: "Rock 70s" },
    { title: "Killing Me Softly", artistName: "Roberta Flack", tag: "Soul 70s" },
    { title: "Africa", artistName: "Toto", tag: "Pop 80s" },
    { title: "Tu Carcel", artistName: "Los Bukis", tag: "Latin 80s" },
  ];

  return (
    <form onSubmit={submit} className="rounded-lg border border-white/10 bg-[#11161c]/95 p-3 shadow-[0_16px_40px_rgba(0,0,0,0.24)]">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-black uppercase text-zinc-300">
        <FolderSearch className="h-4 w-4 text-orange-400" />
        {t.searchTitle}
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_0.8fr_auto]">
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">{t.track}</span>
          <input value={query.title} onChange={event => setQuery({ ...query, title: event.target.value, isrc: undefined })} placeholder="My Girl" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">{t.artist}</span>
          <input value={query.artistName} onChange={event => setQuery({ ...query, artistName: event.target.value, isrc: undefined })} placeholder="The Temptations" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">{t.isrc}</span>
          <input value={query.isrc || ""} onChange={event => setQuery({ ...query, isrc: event.target.value })} placeholder="USMO16400001" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <button type="submit" disabled={loading || (!query.isrc?.trim() && (!query.title.trim() || !query.artistName.trim()))} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md bg-orange-600 px-4 text-xs font-black uppercase text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50 md:mt-5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {t.scan}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[9px] font-black uppercase text-zinc-500">Quick picks</span>
        {suggestions.map(item => (
          <button
            key={`${item.title}-${item.artistName}`}
            type="button"
            onClick={() => setQuery({ title: item.title, artistName: item.artistName })}
            className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] font-bold text-zinc-300 transition hover:border-orange-500/50 hover:bg-orange-500/10 hover:text-orange-100"
          >
            {item.title} <span className="text-zinc-500">· {item.artistName}</span>
          </button>
        ))}
      </div>
    </form>
  );
}


function HomeView({ lang, setLang, analysis, query, setQuery, onSearch, onOpenEngine, loading, searchError }: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  analysis: LegacyAnalysis;
  query: QueryPayload;
  setQuery: (query: QueryPayload) => void;
  onSearch: () => void;
  onOpenEngine: () => void;
  loading: boolean;
  searchError?: string | null;
}) {
  const t = lang === "es" ? copy.es : copy.en;
  const sources = [
    ["Spotify", analysis.source.spotifyConfigured],
    ["Apple Music", analysis.source.appleMusicPublicSearch],
    ["Deezer", analysis.source.deezerPublicSearch],
    ["MusicBrainz", analysis.source.musicBrainzRegistry],
  ] as const;

  return <main className="min-h-screen bg-[#07090c] text-zinc-100">
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-[#07090c]/95 px-5 backdrop-blur-xl lg:px-10">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-orange-500 text-black"><Archive className="h-5 w-5" /></span><div><div className="text-sm font-black tracking-wide">BOOSTIFY</div><div className="text-[9px] font-bold uppercase tracking-[.2em] text-zinc-500">Catalog Research</div></div></div>
      <div className="flex items-center gap-3"><LanguageToggle lang={lang} setLang={setLang} /><button onClick={onOpenEngine} className="rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-black uppercase text-black hover:bg-orange-400">{t.openEngine}</button></div>
    </header>
    <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.1fr_.9fr] lg:px-10 lg:py-20">
      <section className="flex flex-col justify-center">
        <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-orange-200"><Globe2 className="h-3.5 w-3.5" /> Public catalog metadata search</div>
        <h1 className="max-w-3xl text-4xl font-black leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">Find recordings.<br /><span className="text-orange-400">Save the research.</span></h1>
        <p className="mt-5 max-w-xl text-sm leading-7 text-zinc-400">Search public music sources for recording matches, preview links, and identifiers. Results and generated working documents are saved to your Boostify account. Ownership and clearance still require direct verification.</p>
        <button onClick={onOpenEngine} className="mt-7 inline-flex w-fit items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black uppercase text-zinc-200 hover:border-orange-500/40"><FolderSearch className="h-4 w-4 text-orange-300" /> Open saved research <ArrowRight className="h-4 w-4" /></button>
      </section>
      <section className="rounded-2xl border border-white/10 bg-[#10151b] p-4 shadow-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4"><div><div className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Catalog lookup</div><h2 className="mt-1 text-xl font-black">Search a recording</h2></div><Search className="h-5 w-5 text-orange-300" /></div>
        <CatalogSearch t={t} query={query} setQuery={setQuery} onSubmit={onSearch} loading={loading} />
        {searchError && <div role="alert" className="mt-3 rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-200">{searchError}</div>}
        <div className="mt-5 grid gap-2 sm:grid-cols-2">{sources.map(([label, enabled]) => <div key={label} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 px-3 py-2.5"><span className="text-xs font-semibold text-zinc-300">{label}</span><span className={`text-[9px] font-black uppercase ${enabled ? "text-emerald-300" : "text-zinc-500"}`}>{enabled ? (label === "Spotify" ? "Configured" : "Public API") : "Not configured"}</span></div>)}</div>
        <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-lg bg-white/[0.03] p-3"><div className="text-[9px] font-black uppercase text-zinc-500">Matches in current search</div><div className="mt-1 text-2xl font-black">{analysis.query.isrc || analysis.query.title ? analysis.catalog.matchCount : "—"}</div></div><div className="rounded-lg bg-white/[0.03] p-3"><div className="text-[9px] font-black uppercase text-zinc-500">Matched platforms</div><div className="mt-1 truncate text-sm font-black">{analysis.source.platformsMatched.length ? analysis.source.platformsMatched.map(platformLabel).join(", ") : "Run a search"}</div></div></div>
      </section>
    </div>
    <footer className="border-t border-white/10 px-5 py-5 text-center text-[10px] text-zinc-600">Boostify Catalog Research. Public metadata does not establish ownership or clearance.</footer>
  </main>;
}

export default function LegacyCatalogResurrectionPage() {
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  const [lang, setLang] = useState<Lang>("en");
  const [view, setView] = useState<"home" | "engine">("home");
  const [query, setQuery] = useState<QueryPayload>(fallbackAnalysis.query);
  const [analysis, setAnalysis] = useState<LegacyAnalysis>(fallbackAnalysis);
  const [selectedResearchId, setSelectedResearchId] = useState<number | null>(null);
  const [actionArtifact, setActionArtifact] = useState<LegacyActionArtifact | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: ["legacy-catalog-resurrection-bootstrap"],
    queryFn: async () => apiRequest("/api/legacy-catalog-resurrection/bootstrap") as Promise<{ success: boolean; data: LegacyAnalysis }>,
    enabled: isAuthenticated,
    retry: false,
  });

  const historyQuery = useQuery({
    queryKey: ["legacy-catalog-resurrection-history"],
    queryFn: async () => apiRequest("/api/legacy-catalog-resurrection/history") as Promise<{ success: boolean; records: SavedResearch[] }>,
    enabled: isAuthenticated,
    retry: false,
  });

  useEffect(() => {
    if (bootstrapQuery.data?.data) {
      setAnalysis(bootstrapQuery.data.data);
      setQuery(bootstrapQuery.data.data.query);
    }
  }, [bootstrapQuery.data]);

  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrapQuery.isError) setSearchError("Catalog services are temporarily unavailable. Try again in a moment.");
  }, [bootstrapQuery.isError]);

  const searchMutation = useMutation({
    mutationFn: async (payload: QueryPayload) => apiRequest("/api/legacy-catalog-resurrection/search", { method: "POST", data: payload }) as Promise<{ success: boolean; data: LegacyAnalysis; researchId: number }>,
    onMutate: payload => {
      setActionArtifact(null);
      setSelectedResearchId(null);
      setAnalysis({
        ...fallbackAnalysis,
        query: payload,
        catalog: { ...fallbackAnalysis.catalog, canonicalTitle: payload.title, canonicalArtist: payload.artistName, canonicalIsrc: payload.isrc || null },
      });
    },
    onSuccess: response => {
      setSearchError(null);
      setAnalysis(response.data);
      setSelectedResearchId(response.researchId);
      queryClient.invalidateQueries({ queryKey: ["legacy-catalog-resurrection-history"] });
    },
    onError: (err: any, payload) => {
      setAnalysis({
        ...fallbackAnalysis,
        query: payload,
        catalog: { ...fallbackAnalysis.catalog, canonicalTitle: payload.title, canonicalArtist: payload.artistName, canonicalIsrc: payload.isrc || null },
      });
      setSearchError(err?.message || "Search failed. Please try again.");
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, track }: { action: string; track?: LegacyTrack }) => apiRequest("/api/legacy-catalog-resurrection/action", { method: "POST", data: { action, track, researchId: selectedResearchId } }) as Promise<{ success: boolean; artifact: LegacyActionArtifact }>,
    onSuccess: response => {
      setActionArtifact(response.artifact);
      setSearchError(null);
      queryClient.invalidateQueries({ queryKey: ["legacy-catalog-resurrection-history"] });
    },
    onError: (err: any) => setSearchError(err?.message || "Could not prepare this draft. Try again."),
    onSettled: () => setPendingAction(null),
  });

  const runSearch = (submittedQuery: QueryPayload = query) => {
    const normalizedQuery = { ...submittedQuery, title: submittedQuery.title.trim(), artistName: submittedQuery.artistName.trim(), isrc: submittedQuery.isrc?.trim() || undefined };
    if (!normalizedQuery.isrc && (!normalizedQuery.title || !normalizedQuery.artistName)) {
      setSearchError("Enter both a track title and artist, or search directly by ISRC.");
      return;
    }
    setQuery(normalizedQuery);
    setSearchError(null);
    searchMutation.mutate(normalizedQuery);
    setView("engine");
  };

  const runAction = (action: string, track?: LegacyTrack) => {
    if (!track || !selectedResearchId) return;
    setPendingAction(action);
    actionMutation.mutate({ action, track });
  };

  if (authLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#07090c] text-sm text-zinc-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Checking your secure session…</div>;
  }

  if (!isAuthenticated) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07090c] px-5 text-zinc-100">
        <section className="w-full max-w-md rounded-2xl border border-white/10 bg-[#10151b] p-8 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-xl border border-orange-500/30 bg-orange-500/10"><LockKeyhole className="h-6 w-6 text-orange-300" /></div>
          <p className="mt-5 text-xs font-black uppercase tracking-[0.22em] text-orange-300">Boostify Catalog Lab</p>
          <h1 className="mt-2 text-2xl font-black">Sign in to continue</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-400">Your catalog searches, rights research, and generated briefs are available to signed-in Boostify members.</p>
          <button onClick={() => setLocation(`/login?redirect_url=${encodeURIComponent("/legacy-catalog-resurrection")}`)} className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 text-sm font-black text-black transition hover:bg-orange-400">
            <LockKeyhole className="h-4 w-4" /> Sign in securely <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => setLocation("/")} className="mt-3 text-xs font-bold text-zinc-500 hover:text-white">Back to Boostify</button>
        </section>
      </main>
    );
  }

  if (view === "home") {
    return (
      <HomeView
        lang={lang}
        setLang={setLang}
        analysis={analysis}
        query={query}
        setQuery={setQuery}
        onSearch={runSearch}
        onOpenEngine={() => setView("engine")}
        loading={searchMutation.isPending || bootstrapQuery.isFetching}
        searchError={searchError}
      />
    );
  }

  return (
    <CatalogResurrectionDashboard
      onHome={() => setView("home")}
      analysis={analysis ?? undefined}
      selectedResearchId={selectedResearchId}
      query={query}
      setQuery={setQuery}
      onSearch={runSearch}
      searchLoading={searchMutation.isPending}
      onRunAction={runAction}
      actionLoading={actionMutation.isPending}
      pendingAction={pendingAction}
      actionArtifact={actionArtifact}
      lang={lang}
      setLang={setLang}
      searchError={searchError}
      savedResearch={historyQuery.data?.records || []}
      historyLoading={historyQuery.isLoading}
      historyError={historyQuery.isError}
      onRestoreResearch={(record) => {
        if (record.analysis) setAnalysis(record.analysis);
        if (record.query) setQuery(record.query);
        if (record.artifact) setActionArtifact(record.artifact);
        setSelectedResearchId(record.kind === "search" ? record.id : record.artifact?.researchId || null);
      }}
    />
  );
}
