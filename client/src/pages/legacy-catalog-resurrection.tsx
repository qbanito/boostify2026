import { ComponentType, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Archive,
  ArrowRight,
  BadgeDollarSign,
  BarChart3,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Disc3,
  Download,
  FileText,
  Filter,
  FolderSearch,
  Globe2,
  Image as ImageIcon,
  Landmark,
  Languages,
  LibraryBig,
  Loader2,
  LockKeyhole,
  Music2,
  Play,
  Radio,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  TrendingUp,
  UnlockKeyhole,
  Wand2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiRequest } from "../lib/queryClient";
import CatalogResurrectionDashboard from "./legacy-catalog-resurrection-dashboard";

type Lang = "en" | "es";

type QueryPayload = {
  title: string;
  artistName: string;
  isrc?: string;
};

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

type CatalogTab = "recordings" | "photos" | "documents";

const heroImage = "/restoraction/lGIKCxZ0YRg_erD6tJGbi_56e9766019154d34923306ebfc756e82.jpg";
const tapeImage = "/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg";
const vinylImage = "/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg";
const archiveImage = "/restoraction/lMajT7_qGBXNZaHTWulg5_a30e087828ee4aa89c1a9defb1945f59.jpg";

const defaultBackgroundVisual: LegacyVisual = {
  id: "default-resurrection-background",
  title: "Archive Resurrection Background",
  prompt: "OpenAI-ready legacy catalog archive background with master tapes, vinyl, rights ledgers, and premium analytics glass.",
  imageUrl: "/restoraction/lGIKCxZ0YRg_erD6tJGbi_56e9766019154d34923306ebfc756e82.jpg",
  provider: "curated-openai-fallback",
};

const fallbackAnalysis: LegacyAnalysis = {
  query: { title: "My Girl", artistName: "The Temptations" },
  source: {
    spotifyConfigured: false,
    appleMusicPublicSearch: true,
    deezerPublicSearch: true,
    musicBrainzRegistry: true,
    platformsMatched: ["apple_music", "deezer"],
    platformsChecked: ["spotify", "apple_music", "deezer", "musicbrainz"],
    platformsSkipped: [],
  },
  catalog: {
    name: "Boostify Catalog Resurrection Engine",
    archiveReference: "Boostify archive metadata discovery workflow",
    referenceUrl: "/api/legacy-catalog-resurrection/brief.html",
    canonicalTitle: "My Girl",
    canonicalArtist: "The Temptations",
    canonicalIsrc: null,
    matchCount: 0,
    revivedTracks: [
      {
        id: "demo-a1",
        title: "My Girl",
        artistName: "The Temptations",
        era: "1960s soul",
        releaseDate: "1964-12-21",
        archiveId: "BCE-TEMPT-MYGIRL",
        rightsStatus: "Needs master + publishing verification",
        revivalScore: 94,
        syncFit: "Family film, luxury nostalgia campaign, sports documentary",
        imageUrl: archiveImage,
        platform: "Demo archive",
        confidence: "sample",
      },
      {
        id: "demo-b2",
        title: "Basement Tape No. 7",
        artistName: "Unattributed house band",
        era: "1970s funk vault",
        releaseDate: "1973-05-14",
        archiveId: "VAULT-FUNK-073",
        rightsStatus: "Estate outreach required",
        revivalScore: 87,
        syncFit: "Streetwear drop, car launch, limited vinyl pressing",
        imageUrl: tapeImage,
        platform: "Demo archive",
        confidence: "sample",
      },
      {
        id: "demo-c3",
        title: "Midnight Side B",
        artistName: "Legacy vocal group",
        era: "1980s quiet storm",
        releaseDate: "1982-10-02",
        archiveId: "CAT-RNB-182",
        rightsStatus: "Cleared for research pitch",
        revivalScore: 81,
        syncFit: "Streaming playlist revival, boutique hotel licensing",
        imageUrl: vinylImage,
        platform: "Demo archive",
        confidence: "sample",
      },
    ],
  },
  metrics: {
    resurrectionScore: 94,
    rightsReadiness: 78,
    syncDemand: 91,
    archiveCompleteness: 84,
    projectedAnnualValue: 296600,
    clearanceDays: 26,
  },
  rightsStack: [
    { label: "Master owner", status: "verify", confidence: 74 },
    { label: "Publishing split", status: "review", confidence: 68 },
    { label: "Estate contact", status: "outreach", confidence: 61 },
    { label: "Sync clearance", status: "ready", confidence: 82 },
  ],
  opportunities: [
    { channel: "Film and television sync", value: "$42K-$180K", priority: "High", fit: 91 },
    { channel: "Luxury nostalgia campaign", value: "$65K-$240K", priority: "High", fit: 88 },
    { channel: "Collector vinyl drop", value: "$18K-$95K", priority: "Medium", fit: 76 },
    { channel: "Editorial streaming revival", value: "$8K-$36K", priority: "Medium", fit: 72 },
  ],
  timeline: [
    { phase: "Discover", days: 3, status: "active" },
    { phase: "Clear rights", days: 21, status: "queued" },
    { phase: "Package proof", days: 7, status: "queued" },
    { phase: "Pitch revival", days: 14, status: "queued" },
  ],
  visuals: [
    {
      id: "vault-console",
      title: "Vault Console",
      prompt: "Premium archive control room with analog tape reels and amber glass.",
      imageUrl: "/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "lacquer-room",
      title: "Lacquer Room",
      prompt: "Vintage vinyl masters and handwritten metadata cards.",
      imageUrl: "/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "rights-ledger",
      title: "Rights Ledger",
      prompt: "Museum-grade music catalog archive with rights ledgers.",
      imageUrl: "/restoraction/lMajT7_qGBXNZaHTWulg5_a30e087828ee4aa89c1a9defb1945f59.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "master-tape-vault",
      title: "Master Tape Vault",
      prompt: "Analog studio tape machine with spinning reels and amber VU meters.",
      imageUrl: "/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "sync-pitch-room",
      title: "Sync Pitch Room",
      prompt: "Dark luxury boardroom with holographic licensing timeline.",
      imageUrl: "/restoraction/lGIKCxZ0YRg_erD6tJGbi_56e9766019154d34923306ebfc756e82.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "vinyl-lacquer-macro",
      title: "Vinyl Lacquer Macro",
      prompt: "Macro photo of vinyl needle on record grooves under studio rim light.",
      imageUrl: "/restoraction/j976BmLltlMcbb-cPScOW_6599e86a4b794d549ebce7ea24eb06b7.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "archive-poster",
      title: "Archive Poster",
      prompt: "Gold vinyl record with handwritten lyrics and tape reels.",
      imageUrl: "/restoraction/FLwRoyboP40R-A6q46NbH_11d6fe955148489d97a89d6ac6a6367b.jpg",
      provider: "curated-archive-visual",
    },
    {
      id: "studio-session",
      title: "Rights Registry",
      prompt: "Leather-bound catalog registry with ISRC barcodes and brass key.",
      imageUrl: "/restoraction/lMajT7_qGBXNZaHTWulg5_a30e087828ee4aa89c1a9defb1945f59.jpg",
      provider: "curated-archive-visual",
    },
  ],
};

const copy = {
  en: {
    navHome: "Home",
    navEngine: "Engine",
    navCatalog: "Catalog",
    navRights: "Rights",
    navDeals: "Deals",
    pdf: "PDF Brief",
    title: "Boostify Catalog Resurrection Engine",
    eyebrow: "Legacy catalog intelligence",
    subtitle: "Revive dormant recordings with streaming discovery, rights signals, sync demand, visual packaging, and deal-ready proof.",
    searchTitle: "Catalog lookup",
    track: "Track title",
    artist: "Artist name",
    isrc: "ISRC optional",
    scan: "Scan Catalog",
    openEngine: "Open Engine",
    archiveReference: "Archive reference",
    sourceLabel: "Connected sources",
    dashboard: "Resurrection command center",
    score: "Resurrection score",
    rights: "Rights readiness",
    demand: "Sync demand",
    completeness: "Archive completeness",
    projected: "Projected annual value",
    clearance: "Clearance days",
    revivedSongs: "Revived song candidates",
    rightsStack: "Rights stack",
    opportunities: "Commercial opportunities",
    timeline: "Revival timeline",
    visuals: "Generated visual pack",
    generateVisuals: "Generate Visual Pack",
    packageOffer: "Package Offer",
    buildPitch: "Build Sync Pitch",
    prepareEstate: "Prepare Estate Outreach",
    listeningRoom: "Archive listening room",
    platform: "Platform",
    confidence: "Confidence",
    status: "Status",
    fit: "Fit",
    value: "Value",
    priority: "Priority",
    days: "days",
    sourceLive: "API connected",
    sourceFallback: "Demo fallback",
    generateBackground: "Generate Background",
    recordings: "Recordings",
    photos: "Photos",
    documents: "Documents",
    actionResult: "Action result",
    nextSteps: "Next steps",
    openPreview: "Open Preview",
    generatedByOpenAI: "OpenAI image model",
    spanish: "Spanish",
    english: "English",
  },
  es: {
    navHome: "Inicio",
    navEngine: "Motor",
    navCatalog: "Catalogo",
    navRights: "Derechos",
    navDeals: "Deals",
    pdf: "Brief",
    title: "Boostify Catalog Resurrection Engine",
    eyebrow: "Inteligencia para catalogos legacy",
    subtitle: "Revive grabaciones dormidas con busqueda streaming, senales de derechos, demanda sync, visuales y prueba lista para negociar.",
    searchTitle: "Busqueda de catalogo",
    track: "Titulo",
    artist: "Artista",
    isrc: "ISRC opcional",
    scan: "Escanear Catalogo",
    openEngine: "Abrir Motor",
    archiveReference: "Referencia archivo",
    sourceLabel: "Fuentes conectadas",
    dashboard: "Centro de resurreccion",
    score: "Score de resurreccion",
    rights: "Derechos listos",
    demand: "Demanda sync",
    completeness: "Archivo completo",
    projected: "Valor anual proyectado",
    clearance: "Dias de clearance",
    revivedSongs: "Canciones candidatas",
    rightsStack: "Mapa de derechos",
    opportunities: "Oportunidades comerciales",
    timeline: "Timeline revival",
    visuals: "Pack visual generado",
    generateVisuals: "Generar Visuales",
    packageOffer: "Preparar Oferta",
    buildPitch: "Crear Pitch Sync",
    prepareEstate: "Contactar Estate",
    listeningRoom: "Sala de escucha",
    platform: "Plataforma",
    confidence: "Confianza",
    status: "Estado",
    fit: "Fit",
    value: "Valor",
    priority: "Prioridad",
    days: "dias",
    sourceLive: "API conectada",
    sourceFallback: "Demo fallback",
    generateBackground: "Generar Fondo",
    recordings: "Grabaciones",
    photos: "Fotos",
    documents: "Documentos",
    actionResult: "Resultado",
    nextSteps: "Siguientes pasos",
    openPreview: "Abrir Preview",
    generatedByOpenAI: "Modelo de imagen OpenAI",
    spanish: "Espanol",
    english: "Ingles",
  },
} as const;

function money(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

function platformLabel(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, letter => letter.toUpperCase());
}

function Panel({ title, icon: Icon, right, children, className = "" }: { title: string; icon: typeof Archive; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-white/10 bg-[#11161c] shadow-[0_18px_50px_rgba(0,0,0,0.28)] ${className}`}>
      <div className="flex min-h-11 items-center justify-between gap-3 border-b border-white/10 bg-black/25 px-4">
        <div className="flex min-w-0 items-center gap-2 text-[11px] font-black uppercase text-zinc-200">
          <Icon className="h-4 w-4 shrink-0 text-orange-400" />
          <span className="truncate">{title}</span>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function ProgressLine({ value, color = "orange" }: { value: number; color?: "orange" | "emerald" | "cyan" | "fuchsia" }) {
  const colorClass = color === "emerald" ? "bg-emerald-400" : color === "cyan" ? "bg-cyan-400" : color === "fuchsia" ? "bg-fuchsia-400" : "bg-orange-400";
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function MiniWave({ bars = 48, color = "orange" }: { bars?: number; color?: "orange" | "emerald" | "cyan" | "fuchsia" }) {
  const colorClass = color === "emerald" ? "bg-emerald-400" : color === "cyan" ? "bg-cyan-400" : color === "fuchsia" ? "bg-fuchsia-400" : "bg-orange-400";
  return (
    <div className="flex h-full items-end gap-px">
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={`flex-1 rounded-t ${colorClass}`}
          style={{ height: `${18 + ((index * 23) % 76)}%`, opacity: 0.35 + ((index * 7) % 45) / 100 }}
        />
      ))}
    </div>
  );
}

function ScoreDial({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid place-items-center rounded-lg border border-white/10 bg-black/25 p-4">
      <div
        className="grid h-28 w-28 place-items-center rounded-full"
        style={{ background: `conic-gradient(#f97316 ${value * 3.6}deg, rgba(255,255,255,0.08) 0deg)` }}
      >
        <div className="grid h-[86px] w-[86px] place-items-center rounded-full bg-[#0b0f14] text-center">
          <span className="text-3xl font-black text-white">{value}</span>
        </div>
      </div>
      <div className="mt-3 text-center text-[10px] font-black uppercase text-zinc-400">{label}</div>
    </div>
  );
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
          <input value={query.title} onChange={event => setQuery({ ...query, title: event.target.value })} placeholder="My Girl" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">{t.artist}</span>
          <input value={query.artistName} onChange={event => setQuery({ ...query, artistName: event.target.value })} placeholder="The Temptations" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-[10px] font-bold uppercase text-zinc-500">{t.isrc}</span>
          <input value={query.isrc || ""} onChange={event => setQuery({ ...query, isrc: event.target.value })} placeholder="USMO16400001" className="h-10 w-full rounded-md border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-orange-500" />
        </label>
        <button type="submit" disabled={loading || !query.title.trim() || !query.artistName.trim()} className="mt-4 flex h-10 items-center justify-center gap-2 rounded-md bg-orange-600 px-4 text-xs font-black uppercase text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50 md:mt-5">
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

function BriefHtml({ analysis, compact = false }: { analysis: LegacyAnalysis; compact?: boolean }) {
  const leadTrack = analysis.catalog.revivedTracks[0];
  const metricItems = [
    ["Resurrection", analysis.metrics.resurrectionScore, "text-orange-300"],
    ["Rights", analysis.metrics.rightsReadiness, "text-emerald-300"],
    ["Sync", analysis.metrics.syncDemand, "text-cyan-300"],
    ["Archive", analysis.metrics.archiveCompleteness, "text-fuchsia-300"],
  ];
  const briefSections = [
    ["Catalog target", `${analysis.catalog.canonicalArtist} - ${analysis.catalog.canonicalTitle}`],
    ["Commercial thesis", leadTrack?.syncFit || "Sync, vinyl, editorial streaming, and brand campaign revival"],
    ["Rights path", "Verify master owner, publishing split, estate/contact route, and approval window before buyer outreach."],
    ["Sources checked", analysis.source.platformsChecked.map(platformLabel).join(" / ")],
  ];

  return (
    <div className="rounded-lg border border-white/10 bg-[#10151b] p-4 text-left">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase text-orange-300"><FileText className="h-4 w-4" /> HTML Brief</div>
          <h2 className="mt-2 text-2xl font-black text-white">Boostify Catalog Resurrection Brief</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">{analysis.catalog.archiveReference}</p>
        </div>
        <div className="rounded-md border border-orange-500/20 bg-orange-500/10 px-3 py-2 text-right">
          <div className="text-[9px] font-black uppercase text-orange-200">Projected annual value</div>
          <div className="text-xl font-black text-white">{money(analysis.metrics.projectedAnnualValue)}</div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        {metricItems.map(([label, value, color]) => (
          <div key={String(label)} className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="text-[9px] font-black uppercase text-zinc-500">{String(label)}</div>
            <div className={`mt-1 text-2xl font-black ${color}`}>{Number(value)}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {briefSections.map(([label, value]) => (
          <section key={label} className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="text-[9px] font-black uppercase text-zinc-500">{label}</div>
            <div className="mt-2 text-sm leading-6 text-zinc-200">{value}</div>
          </section>
        ))}
      </div>

      {!compact && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <section className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="text-[10px] font-black uppercase text-zinc-500">Revival plan</div>
            <div className="mt-3 space-y-2">
              {analysis.timeline.map(item => (
                <div key={item.phase} className="flex items-center justify-between gap-3 rounded border border-white/10 bg-white/[0.03] px-3 py-2 text-xs">
                  <span className="font-bold text-white">{item.phase}</span>
                  <span className="text-zinc-400">{item.days} days</span>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-md border border-white/10 bg-black/25 p-3">
            <div className="text-[10px] font-black uppercase text-zinc-500">Buyer angles</div>
            <div className="mt-3 space-y-2">
              {analysis.opportunities.slice(0, 4).map(item => (
                <div key={item.channel} className="rounded border border-white/10 bg-white/[0.03] px-3 py-2">
                  <div className="flex items-center justify-between gap-3 text-xs"><span className="font-bold text-white">{item.channel}</span><span className="text-orange-300">{item.value}</span></div>
                  <ProgressLine value={item.fit} color="orange" />
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/api/legacy-catalog-resurrection/brief.html" target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-[10px] font-black uppercase text-black hover:bg-orange-200"><FileText className="h-3.5 w-3.5" /> Open HTML</a>
        <a href="/api/legacy-catalog-resurrection/brief.pdf?download=1" download className="inline-flex h-9 items-center gap-2 rounded-md border border-white/10 bg-white/[0.04] px-3 text-[10px] font-black uppercase text-zinc-200 hover:border-orange-500/50"><Download className="h-3.5 w-3.5" /> Download original PDF</a>
      </div>
    </div>
  );
}

function HomeView({ lang, setLang, analysis, query, setQuery, onSearch, onOpenEngine, loading, backgroundVisual, onGenerateVisuals, generatingVisuals, searchError }: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  analysis: LegacyAnalysis;
  query: QueryPayload;
  setQuery: (query: QueryPayload) => void;
  onSearch: () => void;
  onOpenEngine: () => void;
  loading: boolean;
  backgroundVisual: LegacyVisual;
  onGenerateVisuals?: () => void;
  generatingVisuals?: boolean;
  searchError?: string | null;
}) {
  const featuredTracks = analysis.catalog.revivedTracks.slice(0, 3);
  const en = lang === "en";

  const features = [
    { icon: FolderSearch, title: en ? "AI Archive Discovery" : "Descubrimiento IA de Archivo", desc: en ? "Cross-platform search across Spotify, Apple Music, Deezer, and MusicBrainz to surface dormant recordings from any era." : "Búsqueda multi-plataforma para encontrar grabaciones dormidas de cualquier era.", color: "text-orange-400", badge: en ? "4 Platforms" : "4 Plataformas" },
    { icon: ShieldCheck, title: en ? "Rights Intelligence Stack" : "Mapa de Derechos", desc: en ? "Automated master ownership, publishing splits, estate contacts, and sync clearance scoring for every catalog item." : "Propiedad de masters, splits de publishing y scoring de clearance automáticos.", color: "text-emerald-400", badge: en ? "Automated" : "Automático" },
    { icon: Radio, title: en ? "Sync Demand Scoring" : "Score de Demanda Sync", desc: en ? "Real-time sync fit scoring across film, TV, ads, editorial playlists, and luxury brand campaigns." : "Score de fit sync en tiempo real para film, TV, ads y campañas de marca.", color: "text-cyan-400", badge: en ? "Real-time" : "Tiempo Real" },
    { icon: Wand2, title: en ? "Visual Pack Generator" : "Generador de Visuales", desc: en ? "AI-generated visual identity packs — album art, pitch decks, and promo assets — ready in seconds for any catalog." : "Packs visuales generados por IA: arte, pitch decks y assets de promo listos en segundos.", color: "text-fuchsia-400", badge: "OpenAI" },
    { icon: BadgeDollarSign, title: en ? "Deal Package Builder" : "Constructor de Deals", desc: en ? "One-click pitch packets, estate outreach letters, sync licenses, and commercial opportunity briefs for buyers." : "Paquetes de pitch, cartas de estate y briefs de oportunidades con un clic.", color: "text-amber-400", badge: en ? "Deal-Ready" : "Listo para Deal" },
    { icon: BarChart3, title: en ? "Projected Value Analytics" : "Analytics de Valor", desc: en ? "Annual revenue projections across streaming, sync, vinyl, merch, and fan revenue streams with clearance timelines." : "Proyecciones de ingresos anuales con timelines de clearance.", color: "text-sky-400", badge: en ? "Projections" : "Proyecciones" },
  ];

  const steps = [
    { n: "01", icon: FolderSearch, title: en ? "Scan the Catalog" : "Escanear el Catálogo", desc: en ? "Enter a track title, artist name, or ISRC. The engine searches 4+ platforms and the MusicBrainz registry simultaneously." : "Ingresa título, artista o ISRC. El motor busca en 4+ plataformas y MusicBrainz simultáneamente." },
    { n: "02", icon: ShieldCheck, title: en ? "Analyze Rights & Demand" : "Analizar Derechos y Demanda", desc: en ? "Get a full rights stack analysis, sync demand score, archive completeness, and commercial fit across buyer channels." : "Obtén análisis completo de derechos, score sync, completeness del archivo y fit comercial." },
    { n: "03", icon: BadgeDollarSign, title: en ? "Package & Pitch" : "Empaquetar y Pitchear", desc: en ? "Generate AI-powered pitch packets, visual packs, estate outreach letters, and deal-ready briefs for music supervisors." : "Genera paquetes de pitch con IA, packs visuales, cartas de estate y briefs listos para negociar." },
  ];

  return (
    <div className="min-h-screen overflow-auto bg-[#07090c] text-zinc-100">

      {/* ── Sticky header ── */}
      <header className="sticky top-0 z-50 flex h-16 items-center justify-between gap-4 border-b border-white/10 bg-[#07090c]/95 px-4 backdrop-blur-md xl:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-8 w-8 place-items-center rounded-md border border-orange-500/40 bg-orange-500/15">
            <Archive className="h-4 w-4 text-orange-400" />
          </div>
          <span className="text-sm font-black tracking-wide text-orange-500">BOOSTIFY</span>
          <span className="hidden text-zinc-700 sm:inline">·</span>
          <span className="hidden text-xs font-black uppercase tracking-wider text-zinc-500 sm:inline">Catalog Lab</span>
        </div>
        <nav className="hidden items-center gap-6 text-xs font-bold text-zinc-500 md:flex">
          {([
            [en ? "Features" : "Funciones", "#lcr-features"],
            [en ? "How It Works" : "Cómo Funciona", "#lcr-how"],
            [en ? "Catalog" : "Catálogo", "#lcr-catalog"],
            [en ? "Revenue" : "Ingresos", "#lcr-revenue"],
          ] as [string, string][]).map(([label, href]) => (
            <a key={href} href={href} className="transition hover:text-white">{label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageToggle lang={lang} setLang={setLang} />
          <button
            onClick={onOpenEngine}
            className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(249,115,22,0.3)] transition hover:bg-orange-500"
          >
            <Wand2 className="h-3.5 w-3.5" />
            {en ? "Open Engine" : "Abrir Motor"}
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(135deg, rgba(7,9,12,0.97) 0%, rgba(7,9,12,0.85) 50%, rgba(7,9,12,0.68) 100%), url(${backgroundVisual.imageUrl})` }}
        />
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -right-40 -top-40 h-[600px] w-[600px] rounded-full bg-orange-500/8 blur-[140px]" />
          <div className="absolute -bottom-20 left-1/4 h-[400px] w-[400px] rounded-full bg-amber-500/6 blur-[120px]" />
          <div className="absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-orange-500/30 to-transparent" />
        </div>

        <div className="relative px-4 pb-20 pt-16 xl:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 xl:grid-cols-[1fr_460px]">

              {/* Left copy */}
              <div className="space-y-7">
                <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-xs font-bold text-orange-300">
                  <CircleDot className="h-2.5 w-2.5 fill-orange-400" />
                  {en ? "AI-Powered Legacy Catalog Intelligence" : "Inteligencia de Catálogo Legacy con IA"}
                </div>

                <h1 className="text-5xl font-black leading-[0.9] tracking-tight text-white xl:text-[72px]">
                  {en ? <><span>Resurrect</span><br /><span className="text-orange-500">Your Catalog</span></> : <><span>Resucita</span><br /><span className="text-orange-500">Tu Catálogo</span></>}
                </h1>

                <p className="max-w-[540px] text-base leading-relaxed text-zinc-400">
                  {en
                    ? "Discover dormant recordings, analyze rights stacks, score sync demand, and package deal-ready pitches — all powered by AI. Unlock the hidden revenue in forgotten music."
                    : "Descubre grabaciones dormidas, analiza derechos, evalúa demanda sync y prepara pitches — todo con IA. Desbloquea el ingreso oculto en música olvidada."}
                </p>

                {/* Inline search */}
                <div className="max-w-xl space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      value={query.title}
                      onChange={e => setQuery({ ...query, title: e.target.value })}
                      placeholder={en ? "Track title (e.g. My Girl)" : "Título (ej. My Girl)"}
                      className="h-11 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                    />
                    <input
                      value={query.artistName}
                      onChange={e => setQuery({ ...query, artistName: e.target.value })}
                      placeholder={en ? "Artist name" : "Artista"}
                      className="h-11 flex-1 rounded-lg border border-white/15 bg-white/[0.06] px-4 text-sm text-white placeholder:text-zinc-600 focus:border-orange-500 focus:outline-none"
                    />
                    <button
                      onClick={onSearch}
                      disabled={loading || !query.title.trim() || !query.artistName.trim()}
                      className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-orange-600 px-5 text-xs font-black uppercase text-white shadow-[0_0_30px_rgba(249,115,22,0.3)] transition hover:bg-orange-500 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                      {en ? "Scan" : "Escanear"}
                    </button>
                  </div>
                  {searchError && (
                    <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-300">
                      <RefreshCcw className="h-3.5 w-3.5 shrink-0" /> {searchError}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black uppercase text-zinc-600">{en ? "Try:" : "Prueba:"}</span>
                    {[
                      { title: "My Girl", artistName: "The Temptations" },
                      { title: "Ain't No Sunshine", artistName: "Bill Withers" },
                      { title: "Africa", artistName: "Toto" },
                    ].map(s => (
                      <button
                        key={s.title}
                        onClick={() => setQuery({ title: s.title, artistName: s.artistName })}
                        className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] font-bold text-zinc-400 transition hover:border-orange-500/40 hover:text-orange-100"
                      >
                        {s.title} <span className="text-zinc-600">· {s.artistName}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Secondary CTAs */}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={onOpenEngine}
                    className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/[0.06] px-6 py-3 text-sm font-black uppercase text-zinc-200 transition hover:border-white/30 hover:text-white"
                  >
                    <BarChart3 className="h-4 w-4 text-orange-400" />
                    {en ? "Open Full Dashboard" : "Abrir Dashboard Completo"}
                  </button>
                  <a
                    href="/api/legacy-catalog-resurrection/brief.html"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3 text-sm font-black uppercase text-zinc-400 transition hover:text-white"
                  >
                    <FileText className="h-4 w-4 text-cyan-400" />
                    {en ? "View Sample Brief" : "Ver Brief de Muestra"}
                  </a>
                </div>

                {/* Trust metrics */}
                <div className="flex flex-wrap items-center gap-6">
                  {[
                    { icon: LibraryBig, value: "2,800+", label: en ? "Catalogs Revived" : "Catálogos Revividos", color: "text-orange-400" },
                    { icon: BadgeDollarSign, value: "$48M+", label: en ? "Revenue Unlocked" : "Ingresos Desbloqueados", color: "text-emerald-400" },
                    { icon: Globe2, value: "4+", label: en ? "Platforms Searched" : "Plataformas Buscadas", color: "text-cyan-400" },
                  ].map(({ icon: Icon, value, label, color }) => (
                    <div key={label} className="flex items-center gap-2 text-sm">
                      <Icon className={`h-4 w-4 ${color}`} />
                      <b className="text-white">{value}</b>
                      <span className="text-zinc-500">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right — live analysis card */}
              <div className="relative">
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101418] shadow-[0_32px_80px_rgba(0,0,0,0.6)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-400">
                      <Archive className="h-4 w-4 text-orange-400" />
                      {en ? "Live Analysis Preview" : "Vista Previa en Vivo"}
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${analysis.catalog.matchCount > 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-zinc-500/15 text-zinc-400"}`}>
                      {analysis.catalog.matchCount > 0 ? "Live" : "Demo"}
                    </span>
                  </div>

                  {featuredTracks[0] && (
                    <div className="relative">
                      <img src={featuredTracks[0].imageUrl} alt={featuredTracks[0].title} className="h-52 w-full object-cover opacity-75" />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#101418] via-[#101418]/30 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <div className="text-xs font-black text-white">{featuredTracks[0].title}</div>
                        <div className="text-[10px] text-zinc-400">{featuredTracks[0].artistName} · {featuredTracks[0].era}</div>
                      </div>
                      <div className="absolute right-3 top-3 rounded-lg border border-orange-500/40 bg-black/80 px-3 py-2 text-center backdrop-blur-sm">
                        <div className="text-2xl font-black text-orange-400">{featuredTracks[0].revivalScore}</div>
                        <div className="text-[9px] font-bold uppercase text-zinc-400">Score</div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-px bg-white/5 p-px">
                    {[
                      { label: en ? "Resurrection" : "Resurrección", display: String(analysis.metrics.resurrectionScore), color: "text-orange-400" },
                      { label: en ? "Rights Ready" : "Derechos", display: String(analysis.metrics.rightsReadiness), color: "text-emerald-400" },
                      { label: en ? "Sync Demand" : "Demanda Sync", display: String(analysis.metrics.syncDemand), color: "text-cyan-400" },
                      { label: en ? "Annual Value" : "Valor Anual", display: money(analysis.metrics.projectedAnnualValue), color: "text-amber-400" },
                    ].map(({ label, display, color }) => (
                      <div key={label} className="bg-[#101418] px-4 py-3">
                        <div className="text-[9px] font-black uppercase text-zinc-500">{label}</div>
                        <div className={`mt-0.5 text-xl font-black ${color}`}>{display}</div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between px-4 py-3 text-xs">
                    <span className="text-zinc-500">{en ? "Clearance timeline" : "Tiempo de clearance"}</span>
                    <span className="font-black text-white">{analysis.metrics.clearanceDays} {en ? "days avg" : "días prom"}</span>
                  </div>

                  <div className="px-4 pb-4">
                    <button
                      onClick={onOpenEngine}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(249,115,22,0.25)] transition hover:bg-orange-500"
                    >
                      <Wand2 className="h-4 w-4" />
                      {en ? "Open Full Engine" : "Abrir Motor Completo"}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Floating sync badge */}
                <div className="absolute -left-4 top-24 hidden xl:block">
                  <div className="rounded-xl border border-white/10 bg-[#101418] p-3 shadow-2xl">
                    <div className="text-[9px] font-black uppercase text-zinc-500">{en ? "Top Sync Fit" : "Mejor Fit Sync"}</div>
                    <div className="mt-1 text-xs font-black text-white">{(analysis.opportunities[0]?.channel || "Film & TV Sync").split(" ").slice(0, 3).join(" ")}</div>
                    <div className="mt-1 text-sm font-black text-emerald-400">{analysis.opportunities[0]?.value || "$42K–$180K"}</div>
                  </div>
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
            { value: "2,800+", label: en ? "Catalogs Revived" : "Catálogos Revividos", color: "text-orange-400" },
            { value: "$48M+", label: en ? "Revenue Unlocked" : "Ingresos Desbloqueados", color: "text-emerald-400" },
            { value: "26", label: en ? "Days Avg. Clearance" : "Días Prom. Clearance", color: "text-cyan-400" },
            { value: "4+", label: en ? "Platforms Searched" : "Plataformas Buscadas", color: "text-amber-400" },
          ].map(({ value, label, color }) => (
            <div key={label} className="text-center">
              <div className={`text-3xl font-black ${color}`}>{value}</div>
              <div className="mt-1 text-xs text-zinc-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features grid ── */}
      <section id="lcr-features" className="px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              {en ? "Everything You Need" : "Todo lo que Necesitas"}
            </div>
            <h2 className="text-3xl font-black text-white xl:text-4xl">
              {en ? "Complete Catalog Intelligence Suite" : "Suite Completa de Inteligencia de Catálogo"}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, color, badge }) => (
              <div key={title} className="group rounded-xl border border-white/10 bg-[#101418] p-5 transition hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]">
                <div className="mb-4 flex items-start justify-between">
                  <div className={`rounded-lg border border-white/10 bg-black/40 p-2.5 ${color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[9px] font-black uppercase text-zinc-400">{badge}</span>
                </div>
                <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section id="lcr-how" className="border-y border-white/10 bg-white/[0.015] px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <div className="mb-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
              {en ? "Simple 3-Step Process" : "Proceso en 3 Pasos"}
            </div>
            <h2 className="text-3xl font-black text-white xl:text-4xl">
              {en ? "How It Works" : "Cómo Funciona"}
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {steps.map(({ n, icon: Icon, title, desc }) => (
              <div key={n} className="rounded-xl border border-white/10 bg-[#101418] p-6 text-center">
                <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full border border-orange-500/40 bg-orange-500/10">
                  <Icon className="h-6 w-6 text-orange-400" />
                </div>
                <div className="mb-1 text-5xl font-black leading-none text-white/8">{n}</div>
                <h3 className="mb-2 text-sm font-black text-white">{title}</h3>
                <p className="text-xs leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Catalog preview ── */}
      <section id="lcr-catalog" className="px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <div className="mb-2 text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
                {en ? "Sample Catalog" : "Catálogo de Muestra"}
              </div>
              <h2 className="text-3xl font-black text-white xl:text-4xl">
                {en ? "Revived Recordings" : "Grabaciones Revividas"}
              </h2>
            </div>
            <button
              onClick={onOpenEngine}
              className="hidden items-center gap-2 rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-2 text-xs font-black text-orange-300 transition hover:bg-orange-500/20 sm:flex"
            >
              {en ? "Scan Your Catalog" : "Escanear Tu Catálogo"}
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {featuredTracks.map(track => (
              <div key={track.id} className="overflow-hidden rounded-xl border border-white/10 bg-[#101418] transition hover:border-white/20">
                <div className="relative">
                  <img src={track.imageUrl} alt={track.title} className="h-48 w-full object-cover opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#101418] via-transparent to-transparent" />
                  <div className="absolute right-3 top-3">
                    <div className="rounded-lg border border-orange-500/40 bg-black/80 px-3 py-1.5 text-center backdrop-blur-sm">
                      <div className="text-lg font-black text-orange-400">{track.revivalScore}</div>
                      <div className="text-[9px] uppercase text-zinc-400">Score</div>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  <div className="text-sm font-black text-white">{track.title}</div>
                  <div className="mt-1 text-[10px] text-zinc-500">{track.artistName} · {track.era}</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold uppercase text-zinc-400">{track.archiveId}</span>
                    <span className="rounded-full border border-orange-500/20 bg-orange-500/10 px-2.5 py-1 text-[9px] font-bold uppercase text-orange-300">{track.platform || "Archive"}</span>
                  </div>
                  <div className="mt-3 line-clamp-2 text-[10px] leading-relaxed text-zinc-600">{track.syncFit}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Revenue opportunities ── */}
      <section id="lcr-revenue" className="border-t border-white/10 bg-white/[0.015] px-4 py-16 xl:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-10 xl:grid-cols-[1fr_400px]">
            <div className="space-y-5">
              <div className="text-[10px] font-black uppercase tracking-[0.3em] text-orange-400">
                {en ? "Commercial Intelligence" : "Inteligencia Comercial"}
              </div>
              <h2 className="text-3xl font-black text-white xl:text-4xl">
                {en ? "Unlock the Hidden Revenue" : "Desbloquea el Ingreso Oculto"}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-500">
                {en
                  ? "Every dormant catalog hides revenue across film, luxury campaigns, vinyl collectors, and editorial streaming. Our engine surfaces and packages these opportunities automatically."
                  : "Cada catálogo dormido esconde ingresos en film, campañas de lujo, coleccionistas de vinyl y streaming editorial. Nuestro motor los detecta automáticamente."}
              </p>
              <div className="space-y-3">
                {analysis.opportunities.map(({ channel, value, priority, fit }) => (
                  <div key={channel} className="rounded-xl border border-white/10 bg-[#101418] p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="text-sm font-black text-white">{channel}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black uppercase ${priority === "High" ? "text-emerald-300" : "text-cyan-300"}`}>{priority}</span>
                        <span className="text-sm font-black text-orange-300">{value}</span>
                      </div>
                    </div>
                    <ProgressLine value={fit} color="orange" />
                  </div>
                ))}
              </div>
            </div>

            {/* Deal snapshot */}
            <div className="rounded-2xl border border-white/10 bg-[#101418] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
              <div className="mb-5 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-orange-500/15">
                  <BadgeDollarSign className="h-6 w-6 text-orange-400" />
                </div>
                <div>
                  <div className="text-sm font-black text-white">{en ? "Deal Snapshot" : "Resumen del Deal"}</div>
                  <div className="text-[10px] text-zinc-500">{analysis.catalog.canonicalArtist} · {analysis.catalog.canonicalTitle}</div>
                </div>
              </div>
              <div className="mb-5 text-center">
                <div className="text-[10px] font-black uppercase text-zinc-500">{en ? "Projected Annual Value" : "Valor Anual Proyectado"}</div>
                <div className="mt-1 text-4xl font-black text-white">{money(analysis.metrics.projectedAnnualValue)}</div>
                <div className="mt-2 text-[10px] text-zinc-500">{analysis.metrics.clearanceDays} {en ? "days est. clearance" : "días est. de clearance"}</div>
              </div>
              <div className="mb-5 space-y-2">
                {[
                  { label: en ? "Rights Readiness" : "Derechos Listos", value: analysis.metrics.rightsReadiness, color: "emerald" as const },
                  { label: en ? "Sync Demand" : "Demanda Sync", value: analysis.metrics.syncDemand, color: "cyan" as const },
                  { label: en ? "Archive Completeness" : "Completeness", value: analysis.metrics.archiveCompleteness, color: "fuchsia" as const },
                ].map(({ label, value, color }) => (
                  <div key={label}>
                    <div className="mb-1 flex justify-between text-[10px]">
                      <span className="text-zinc-500">{label}</span>
                      <span className="font-black text-white">{value}</span>
                    </div>
                    <ProgressLine value={value} color={color} />
                  </div>
                ))}
              </div>
              <button
                onClick={onOpenEngine}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-orange-600 py-3 text-xs font-black uppercase text-white shadow-[0_0_20px_rgba(249,115,22,0.25)] transition hover:bg-orange-500"
              >
                {en ? "Build Deal Package" : "Construir Paquete de Deal"}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
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
            {en ? "Ready to Revive?" : "¿Listo para Revivir?"}
          </div>
          <h2 className="text-4xl font-black text-white xl:text-5xl">
            {en ? "Resurrect Your First Catalog" : "Resucita Tu Primer Catálogo"}
          </h2>
          <p className="mx-auto max-w-lg text-sm leading-relaxed text-zinc-500">
            {en
              ? "Scan any track in seconds. Get full rights analysis, sync demand score, and a deal-ready brief — powered by AI and live platform data."
              : "Escanea cualquier pista en segundos. Obtén análisis de derechos, score sync y un brief listo para negociar — con IA y datos en vivo."}
          </p>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={onOpenEngine}
              className="flex items-center gap-3 rounded-xl bg-orange-600 px-8 py-4 text-base font-black uppercase tracking-wide text-white shadow-[0_0_50px_rgba(249,115,22,0.4)] transition hover:bg-orange-500"
            >
              <Archive className="h-5 w-5" />
              {en ? "Start Free Scan" : "Iniciar Escaneo Gratis"}
              <ArrowRight className="h-5 w-5" />
            </button>
            <a
              href="/api/legacy-catalog-resurrection/brief.html"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-xl border border-white/15 px-6 py-4 text-sm font-black uppercase text-zinc-300 transition hover:border-white/30 hover:text-white"
            >
              <Download className="h-4 w-4" />
              {en ? "Download Sample Brief" : "Descargar Brief de Muestra"}
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/10 px-4 py-6 xl:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black text-orange-500">BOOSTIFY</span>
            <span className="text-zinc-600">·</span>
            <span className="text-[10px] text-zinc-600">Catalog Resurrection Engine</span>
          </div>
          <span className="text-[10px] text-zinc-700">© {new Date().getFullYear()} Boostify Music. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}

function DashboardView({ lang, setLang, analysis, query, setQuery, onSearch, searchLoading, onHome, visualPack, backgroundVisual, actionArtifact, onRunAction, actionLoading, pendingAction }: {
  lang: Lang;
  setLang: (lang: Lang) => void;
  analysis: LegacyAnalysis;
  query: QueryPayload;
  setQuery: (query: QueryPayload) => void;
  onSearch: () => void;
  searchLoading: boolean;
  onHome: () => void;
  visualPack: LegacyVisual[];
  backgroundVisual: LegacyVisual;
  actionArtifact: LegacyActionArtifact | null;
  onRunAction: (action: string, track?: LegacyTrack) => void;
  actionLoading: boolean;
  pendingAction: string | null;
}) {
  const t = copy[lang];
  const [selectedTrackId, setSelectedTrackId] = useState(analysis.catalog.revivedTracks[0]?.id || "");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("recordings");
  const selectedTrack = analysis.catalog.revivedTracks.find(track => track.id === selectedTrackId) || analysis.catalog.revivedTracks[0];

  useEffect(() => {
    setSelectedTrackId(analysis.catalog.revivedTracks[0]?.id || "");
  }, [analysis.catalog.revivedTracks]);

  const opportunityChart = useMemo(() => analysis.opportunities.map(item => ({ name: item.channel.split(" ").slice(0, 2).join(" "), fit: item.fit })), [analysis.opportunities]);
  const timelineChart = useMemo(() => analysis.timeline.map((item, index) => ({ phase: item.phase, days: item.days, value: 25 + index * 18 })), [analysis.timeline]);

  const scrollToSection = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const playPreview = () => {
    if (!selectedTrack) return;
    if (selectedTrack.previewUrl) {
      new Audio(selectedTrack.previewUrl).play().catch(() => window.open(selectedTrack.previewUrl, "_blank", "noopener,noreferrer"));
    } else if (selectedTrack.streamUrl) {
      window.open(selectedTrack.streamUrl, "_blank", "noopener,noreferrer");
    }
    onRunAction("preview", selectedTrack);
  };

  const openArtifactCta = () => {
    if (!actionArtifact) return;
    if (actionArtifact.action === "archive-reference") {
      setCatalogTab("documents");
      scrollToSection("catalog");
      return;
    }
    if (actionArtifact.action === "preview") {
      playPreview();
      return;
    }
    window.open("/api/legacy-catalog-resurrection/brief.html", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="flex min-h-screen bg-[#070a0e] bg-cover bg-fixed bg-center text-zinc-100" style={{ backgroundImage: `linear-gradient(180deg, rgba(7,10,14,0.94), rgba(7,10,14,0.98)), url(${backgroundVisual.imageUrl})` }}>
      <aside className="hidden w-[250px] shrink-0 border-r border-white/10 bg-[#090d12] xl:block">
        <div className="border-b border-white/10 p-5">
          <div className="text-2xl font-black text-orange-500">BOOSTIFY</div>
          <div className="text-[10px] font-bold uppercase tracking-[0.38em] text-zinc-500">Archive Lab</div>
        </div>
        <nav className="space-y-1 p-3 text-xs font-bold">
          {[
            [BarChart3, t.navEngine, "engine", true],
            [LibraryBig, t.navCatalog, "catalog", false],
            [LockKeyhole, t.navRights, "rights", false],
            [BadgeDollarSign, t.navDeals, "deals", false],
            [ImageIcon, t.visuals, "visuals", false],
          ].map(([IconComp, label, sectionId, active]) => {
            const Icon = IconComp as unknown as ComponentType<{ className?: string }>;
            return (
              <button key={String(label)} onClick={() => scrollToSection(String(sectionId))} className={`flex h-10 w-full items-center gap-3 rounded-md px-3 text-left ${active ? "bg-orange-500/20 text-orange-100 shadow-[inset_3px_0_0_#f97316]" : "text-zinc-500 hover:bg-white/[0.04] hover:text-white"}`}>
                <Icon className="h-4 w-4" /> {String(label)}
              </button>
            );
          })}
        </nav>
        <div className="m-3 rounded-lg border border-white/10 bg-black/25 p-3">
          <div className="text-[10px] font-black uppercase text-zinc-500">{t.listeningRoom}</div>
          <div className="mt-3 h-24 rounded-md bg-black/30 p-3"><MiniWave bars={70} color="orange" /></div>
          <div className="mt-3 truncate text-sm font-black text-white">{selectedTrack?.title}</div>
          <div className="truncate text-[10px] text-zinc-500">{selectedTrack?.artistName}</div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-white/10 bg-[#070a0e]/95 px-3 backdrop-blur lg:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <button onClick={onHome} className="grid h-9 w-9 place-items-center rounded-md border border-white/10 bg-white/[0.04] text-zinc-300 hover:text-white">
              <Archive className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <div className="truncate text-sm font-black text-white">{t.dashboard}</div>
              <div className="truncate text-[10px] font-bold uppercase text-zinc-500">{analysis.catalog.canonicalArtist} · {analysis.catalog.canonicalTitle}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a href="/api/legacy-catalog-resurrection/brief.html" target="_blank" rel="noreferrer" className="hidden h-9 items-center gap-2 rounded-md border border-white/10 px-3 text-[10px] font-black uppercase text-zinc-200 hover:border-orange-500/50 md:flex">
              <Download className="h-3.5 w-3.5 text-orange-300" /> {t.pdf}
            </a>
            <LanguageToggle lang={lang} setLang={setLang} />
          </div>
        </header>

        <main className="space-y-3 p-3 lg:p-4">
          <CatalogSearch t={t} query={query} setQuery={setQuery} onSubmit={onSearch} loading={searchLoading} />

          <section id="engine" className="scroll-mt-20 grid gap-3 2xl:grid-cols-[1fr_370px]">
            <div className="grid gap-3 xl:grid-cols-[280px_1fr]">
              <ScoreDial value={analysis.metrics.resurrectionScore} label={t.score} />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  [t.rights, analysis.metrics.rightsReadiness, ShieldCheck, "emerald"],
                  [t.demand, analysis.metrics.syncDemand, TrendingUp, "cyan"],
                  [t.completeness, analysis.metrics.archiveCompleteness, Archive, "fuchsia"],
                  [t.clearance, analysis.metrics.clearanceDays, UnlockKeyhole, "orange"],
                ].map(([label, value, IconComp, color]) => {
                  const Icon = IconComp as unknown as ComponentType<{ className?: string }>;
                  return (
                    <div key={String(label)} className="rounded-lg border border-white/10 bg-[#11161c] p-4">
                      <div className="mb-4 flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-zinc-500">{String(label)}</span>
                        <Icon className="h-4 w-4 text-orange-300" />
                      </div>
                      <div className="text-3xl font-black text-white">{Number(value)}</div>
                      <div className="mt-3"><ProgressLine value={String(label) === t.clearance ? Math.max(0, 100 - Number(value) * 2) : Number(value)} color={color as "orange" | "emerald" | "cyan" | "fuchsia"} /></div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Panel title={t.sourceLabel} icon={Globe2} right={<span className="text-[9px] font-black uppercase text-emerald-300">{analysis.catalog.matchCount > 0 ? t.sourceLive : t.sourceFallback}</span>}>
              <div className="space-y-3 p-4">
                {[
                  ["Spotify", analysis.source.spotifyConfigured],
                  ["Apple Music", analysis.source.appleMusicPublicSearch],
                  ["Deezer", analysis.source.deezerPublicSearch],
                  ["MusicBrainz", analysis.source.musicBrainzRegistry],
                ].map(([label, enabled]) => (
                  <div key={String(label)} className="flex items-center justify-between gap-3 rounded-md border border-white/10 bg-black/25 px-3 py-2">
                    <span className="text-xs font-bold text-zinc-200">{String(label)}</span>
                    {enabled ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <RefreshCcw className="h-4 w-4 text-zinc-500" />}
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="catalog" className="scroll-mt-20 grid gap-3 xl:grid-cols-[1.05fr_0.95fr]">
            <Panel title={t.revivedSongs} icon={LibraryBig} right={
              <div className="flex items-center gap-1">
                <Filter className="hidden h-4 w-4 text-zinc-500 sm:block" />
                {([
                  ["recordings", t.recordings],
                  ["photos", t.photos],
                  ["documents", t.documents],
                ] as Array<[CatalogTab, string]>).map(([tab, label]) => (
                  <button key={tab} onClick={() => setCatalogTab(tab)} className={`rounded px-2 py-1 text-[9px] font-black uppercase ${catalogTab === tab ? "bg-orange-500 text-white" : "text-zinc-500 hover:bg-white/[0.06] hover:text-white"}`}>{label}</button>
                ))}
              </div>
            }>
              {catalogTab === "recordings" && (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="border-b border-white/10 bg-black/20 text-[10px] uppercase text-zinc-500">
                      <tr>
                        <th className="px-3 py-3">Title</th>
                        <th className="px-3 py-3">Era</th>
                        <th className="px-3 py-3">{t.platform}</th>
                        <th className="px-3 py-3">{t.confidence}</th>
                        <th className="px-3 py-3">Score</th>
                        <th className="px-3 py-3">{t.status}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysis.catalog.revivedTracks.map(track => (
                        <tr key={track.id} onClick={() => setSelectedTrackId(track.id)} className={`cursor-pointer border-b border-white/10 hover:bg-white/[0.03] ${selectedTrack?.id === track.id ? "bg-orange-500/10" : ""}`}>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-3">
                              <img src={track.imageUrl} alt={track.title} className="h-10 w-10 rounded object-cover" />
                              <div className="min-w-0"><div className="truncate font-black text-white">{track.title}</div><div className="truncate text-[10px] text-zinc-500">{track.artistName}</div></div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-zinc-300">{track.era}</td>
                          <td className="px-3 py-3 text-zinc-300">{track.platform || "Archive"}</td>
                          <td className="px-3 py-3"><span className="rounded bg-emerald-500/10 px-2 py-1 text-[10px] font-black uppercase text-emerald-300">{track.confidence || "review"}</span></td>
                          <td className="px-3 py-3 font-black text-orange-300">{track.revivalScore}</td>
                          <td className="px-3 py-3 text-zinc-300">{track.rightsStatus}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {catalogTab === "photos" && (
                <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                  {visualPack.map(visual => (
                    <button key={visual.id} onClick={() => window.open(visual.imageUrl, "_blank", "noopener,noreferrer")} className="overflow-hidden rounded-lg border border-white/10 bg-black/25 text-left hover:border-orange-500/50">
                      <img src={visual.imageUrl} alt={visual.title} className="h-36 w-full object-cover" />
                      <div className="p-3">
                        <div className="truncate text-xs font-black text-white">{visual.title}</div>
                        <div className="mt-1 text-[9px] font-black uppercase text-orange-300">Catalog visual</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {catalogTab === "documents" && (
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <BriefHtml analysis={analysis} />
                  {actionArtifact && (
                    <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <div className="text-sm font-black text-white">{actionArtifact.title}</div>
                      <div className="mt-2 text-xs leading-5 text-zinc-300">{actionArtifact.summary}</div>
                    </div>
                  )}
                </div>
              )}
            </Panel>

            <Panel title={t.listeningRoom} icon={Disc3} right={selectedTrack?.streamUrl ? <a href={selectedTrack.streamUrl} target="_blank" rel="noreferrer" className="text-[10px] font-black uppercase text-cyan-300">Open</a> : null}>
              <div className="grid gap-4 p-4 lg:grid-cols-[170px_1fr]">
                <img src={selectedTrack?.imageUrl || archiveImage} alt={selectedTrack?.title || "Archive track"} className="h-44 w-full rounded-lg object-cover" />
                <div className="min-w-0 space-y-4">
                  <div>
                    <div className="truncate text-2xl font-black text-white">{selectedTrack?.title}</div>
                    <div className="truncate text-sm text-zinc-400">{selectedTrack?.artistName} · {selectedTrack?.releaseDate}</div>
                  </div>
                  {selectedTrack?.previewUrl ? (
                    <audio controls autoPlay={false} preload="none" src={selectedTrack.previewUrl} className="w-full" />
                  ) : (
                    <div className="rounded-md border border-white/10 bg-black/25 p-3 text-[10px] font-bold uppercase text-zinc-500">
                      No preview available · {selectedTrack?.streamUrl ? <a href={selectedTrack.streamUrl} target="_blank" rel="noreferrer" className="text-cyan-300">Open on platform</a> : "link in pipeline"}
                    </div>
                  )}
                  <div className="h-12 rounded-md border border-white/10 bg-black/25 p-2"><MiniWave bars={110} color="orange" /></div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <button onClick={playPreview} className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-black uppercase text-zinc-200 hover:border-orange-500/50"><Play className="h-3.5 w-3.5 text-orange-300" /> Preview</button>
                    <button onClick={() => selectedTrack && onRunAction("package-offer", selectedTrack)} className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-black uppercase text-zinc-200 hover:border-emerald-500/50">
                      {pendingAction === "package-offer" && actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-300" /> : <ReceiptText className="h-3.5 w-3.5 text-emerald-300" />} {t.packageOffer}
                    </button>
                    <button onClick={() => selectedTrack && onRunAction("ai-memo", selectedTrack)} className="flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/[0.04] text-[10px] font-black uppercase text-zinc-200 hover:border-cyan-500/50">
                      {pendingAction === "ai-memo" && actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" /> : <Bot className="h-3.5 w-3.5 text-cyan-300" />} AI Memo
                    </button>
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">{selectedTrack?.syncFit}</p>
                </div>
              </div>
            </Panel>
          </section>

          <section id="rights" className="scroll-mt-20 grid gap-3 2xl:grid-cols-[0.95fr_0.8fr_0.9fr]">
            <Panel title={t.rightsStack} icon={ShieldCheck}>
              <div className="space-y-3 p-4">
                {analysis.rightsStack.map((item, index) => (
                  <div key={item.label} className="rounded-md border border-white/10 bg-black/25 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-xs">
                      <span className="font-black text-white">{item.label}</span>
                      <span className="rounded bg-white/[0.06] px-2 py-1 text-[9px] font-black uppercase text-zinc-300">{item.status}</span>
                    </div>
                    <ProgressLine value={item.confidence} color={index === 3 ? "emerald" : index === 2 ? "cyan" : "orange"} />
                  </div>
                ))}
              </div>
            </Panel>

            <div id="deals" className="scroll-mt-20">
              <Panel title={t.opportunities} icon={BadgeDollarSign}>
                <div className="h-72 p-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={opportunityChart} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "#fff" }} />
                      <Bar dataKey="fit" fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Panel>
            </div>

            <Panel title={t.timeline} icon={SlidersHorizontal}>
              <div className="h-72 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineChart} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                    <XAxis dataKey="phase" tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#a1a1aa", fontSize: 10 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,.12)", borderRadius: 6, color: "#fff" }} />
                    <Area type="monotone" dataKey="value" stroke="#22d3ee" fill="rgba(34,211,238,0.18)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </section>

          <section id="visuals" className="scroll-mt-20 grid gap-3 xl:grid-cols-[1fr_360px]">
            <Panel title={t.visuals} icon={ImageIcon} right={<span className="flex items-center gap-2 text-[10px] font-black uppercase text-orange-300"><Sparkles className="h-3.5 w-3.5" /> {t.visuals}</span>}>
              <div className="grid gap-3 p-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-3">
                {visualPack.map(visual => (
                  <article key={visual.id} className="overflow-hidden rounded-lg border border-white/10 bg-black/25">
                    <img src={visual.imageUrl} alt={visual.title} className="h-48 w-full object-cover" />
                    <div className="p-3">
                      <div className="text-sm font-black text-white">{visual.title}</div>
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-zinc-500">{visual.prompt}</div>
                      <div className="mt-3 text-[9px] font-black uppercase text-orange-300">Catalog visual</div>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>

            <Panel title="Command Center" icon={Sparkles}>
              <div className="grid gap-2 p-4">
                {[
                  [FileText, t.buildPitch, "sync-pitch"],
                  [Landmark, t.prepareEstate, "estate-outreach"],
                  [Tags, t.packageOffer, "package-offer"],
                  [BookOpen, t.archiveReference, "archive-reference"],
                ].map(([Icon, label, action]) => (
                  <button key={String(label)} onClick={() => selectedTrack && onRunAction(String(action), selectedTrack)} className="flex h-12 items-center justify-between rounded-md border border-white/10 bg-white/[0.04] px-3 text-left text-xs font-black uppercase text-zinc-200 hover:border-orange-500/50">
                    <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-orange-300" /> {String(label)}</span>
                    {pendingAction === action && actionLoading ? <Loader2 className="h-4 w-4 animate-spin text-orange-300" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  </button>
                ))}
                <div className="rounded-md border border-white/10 bg-black/25 p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="text-[10px] font-black uppercase text-zinc-500">{t.actionResult}</div>
                    {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-orange-300" />}
                  </div>
                  {actionArtifact ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-black text-white">{actionArtifact.title}</div>
                        <div className="mt-1 text-[10px] font-black uppercase text-emerald-300">{actionArtifact.status}</div>
                      </div>
                      <p className="text-xs leading-5 text-zinc-300">{actionArtifact.summary}</p>
                      <div className="grid gap-2">
                        {actionArtifact.sections.map(section => (
                          <div key={section.label} className="rounded border border-white/10 bg-white/[0.03] p-2">
                            <div className="text-[9px] font-black uppercase text-zinc-500">{section.label}</div>
                            <div className="mt-1 text-xs text-zinc-200">{section.value}</div>
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="mb-2 text-[10px] font-black uppercase text-zinc-500">{t.nextSteps}</div>
                        <div className="space-y-1">
                          {actionArtifact.nextSteps.map(step => <div key={step} className="text-[11px] leading-5 text-zinc-400">- {step}</div>)}
                        </div>
                      </div>
                      <button onClick={openArtifactCta} className="flex h-9 w-full items-center justify-center gap-2 rounded-md bg-orange-600 text-[10px] font-black uppercase text-white hover:bg-orange-500">
                        {actionArtifact.cta} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="text-xs leading-5 text-zinc-500">Select any command to generate a live packet from the connected catalog data.</div>
                  )}
                </div>
                <div className="mt-2 rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                  <div className="text-[10px] font-black uppercase text-emerald-300">{t.projected}</div>
                  <div className="mt-1 text-3xl font-black text-white">{money(analysis.metrics.projectedAnnualValue)}</div>
                </div>
              </div>
            </Panel>
          </section>
        </main>
      </div>
    </div>
  );
}

export default function LegacyCatalogResurrectionPage() {
  const [lang, setLang] = useState<Lang>("en");
  const [view, setView] = useState<"home" | "engine">("home");
  const [query, setQuery] = useState<QueryPayload>(fallbackAnalysis.query);
  const [analysis, setAnalysis] = useState<LegacyAnalysis>(fallbackAnalysis);
  // Show curated images instantly; replace with AI-generated once loaded from server
  const [visualPack, setVisualPack] = useState<LegacyVisual[]>(fallbackAnalysis.visuals);
  const [backgroundVisual, setBackgroundVisual] = useState<LegacyVisual>(defaultBackgroundVisual);
  const [actionArtifact, setActionArtifact] = useState<LegacyActionArtifact | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const bootstrapQuery = useQuery({
    queryKey: ["legacy-catalog-resurrection-bootstrap"],
    queryFn: async () => apiRequest("/api/legacy-catalog-resurrection/bootstrap") as Promise<{ success: boolean; data: LegacyAnalysis }>,
    retry: false,
  });

  useEffect(() => {
    if (bootstrapQuery.data?.data) {
      setAnalysis(bootstrapQuery.data.data);
      setQuery(bootstrapQuery.data.data.query);
    }
  }, [bootstrapQuery.data]);

  // Fetch AI visuals from server (Flux Pro Kontext → Firebase Storage = permanent URLs).
  // Server generates once and caches to disk. We poll until ready.
  const [visualsPending, setVisualsPending] = useState(false);
  const visualsQuery = useQuery({
    queryKey: ["catalog-resurrection-visuals"],
    queryFn: async () => apiRequest("/api/legacy-catalog-resurrection/visuals") as Promise<{
      success: boolean; visuals?: LegacyVisual[]; background?: LegacyVisual;
      fallback?: boolean; pending?: boolean; cached?: boolean;
    }>,
    retry: false,
    staleTime: Infinity,
    refetchInterval: (query) => {
      // Keep polling every 8s while server is still generating
      const data = query.state.data as any;
      return data?.pending ? 8000 : false;
    },
  });

  useEffect(() => {
    if (!visualsQuery.data) return;
    if (visualsQuery.data.pending) {
      setVisualsPending(true);
      return;
    }
    setVisualsPending(false);
    if (!visualsQuery.data.fallback && visualsQuery.data.visuals && visualsQuery.data.visuals.length > 0) {
      setVisualPack(visualsQuery.data.visuals);
    }
    if (!visualsQuery.data.fallback && visualsQuery.data.background?.imageUrl) {
      setBackgroundVisual(visualsQuery.data.background);
    }
  }, [visualsQuery.data]);

  const [searchError, setSearchError] = useState<string | null>(null);

  const searchMutation = useMutation({
    mutationFn: async (payload: QueryPayload) => apiRequest("/api/legacy-catalog-resurrection/search", { method: "POST", data: payload }) as Promise<{ success: boolean; data: LegacyAnalysis }>,
    onSuccess: response => {
      setSearchError(null);
      setAnalysis(response.data);
    },
    onError: (err: any) => {
      setSearchError(err?.message || "Search failed. Please try again.");
    },
  });

  const actionMutation = useMutation({
    mutationFn: async ({ action, track }: { action: string; track?: LegacyTrack }) => apiRequest("/api/legacy-catalog-resurrection/action", { method: "POST", data: { action, track, analysis } }) as Promise<{ success: boolean; artifact: LegacyActionArtifact }>,
    onSuccess: response => setActionArtifact(response.artifact),
    onSettled: () => setPendingAction(null),
  });

  const runSearch = () => {
    searchMutation.mutate(query);
    setView("engine");
  };

  const runAction = (action: string, track?: LegacyTrack) => {
    setPendingAction(action);
    actionMutation.mutate({ action, track });
  };

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
        backgroundVisual={backgroundVisual}
        searchError={searchError}
      />
    );
  }

  return (
    <CatalogResurrectionDashboard
      onHome={() => setView("home")}
      catalogPosterUrl={backgroundVisual?.imageUrl || visualPack[0]?.imageUrl}
      artistAvatarUrl={visualPack[1]?.imageUrl || visualPack[0]?.imageUrl}
      analysis={analysis ?? undefined}
      query={query}
      setQuery={setQuery}
      onSearch={runSearch}
      searchLoading={searchMutation.isPending}
      onRunAction={runAction}
      actionLoading={actionMutation.isPending}
      pendingAction={pendingAction}
      actionArtifact={actionArtifact}
      visualPack={visualPack}
      visualsPending={visualsPending}
      lang={lang}
      setLang={setLang}
    />
  );
}