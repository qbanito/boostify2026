/**
 * Electronic Press Kit (EPK) — Full professional inline viewer.
 * Shows: hero · bio · music tracks · videos · gallery · achievements ·
 *        fact sheet · technical sheet · contacts · social links.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Download, Sparkles, Loader2, ExternalLink,
  Share2, RefreshCcw, CheckCircle2, Play, Pause, Music2,
  Video as VideoIcon, Image as ImageIcon, Users, Globe,
  Instagram, Youtube, Headphones, ChevronDown, ChevronUp,
  Award, BookOpen, Mic2, BarChart3, Info, Mail, Phone, Zap,
  Languages,
} from "lucide-react";
import { apiRequest } from "../../../lib/queryClient";
import { useToast } from "../../../hooks/use-toast";

// ─── i18n ────────────────────────────────────────────────

type EpkLang = "en" | "es";

const STRINGS: Record<EpkLang, Record<string, string>> = {
  en: {
    eyebrow: "Electronic Press Kit",
    emptyTitle: "Electronic Press Kit",
    emptyDesc: "Generate a complete professional press kit with bio, songs, videos, photo gallery and more.",
    generate: "Generate Professional Press Kit",
    generating: "Generating…",
    notPublished: "The press kit hasn't been published yet.",
    loading: "Loading press kit…",
    openPublic: "Open Public EPK",
    downloadPdf: "Download PDF",
    share: "Share",
    regenerate: "Regenerate",
    biography: "Biography",
    music: "Music",
    track: "Track",
    tracks: "Tracks",
    videos: "Videos",
    pressPhotos: "Press Photos & Gallery",
    highlights: "Highlights & Achievements",
    factSheet: "Artist Fact Sheet",
    technicalSheet: "Technical Sheet",
    social: "Social & Streaming",
    contact: "Press & Booking Contact",
    readPress: "Read full press release",
    hidePress: "Hide full press release",
    bandMembers: "Band Members",
    bandSize: "Band Size",
    setDuration: "Set Duration",
    vocalRange: "Vocal Range",
    primaryKey: "Primary Key",
    bpmRange: "BPM Range",
    languagesLabel: "Language(s)",
    venues: "Venues",
    influences: "Influences",
    instrumentation: "Instrumentation",
    technicalRider: "Technical Rider",
    readyTitle: "✨ Press Kit ready",
    readyMaster: "Generated from your Master JSON and images",
    readyAI: "Professional press kit generated with AI",
    errorTitle: "Error",
    errorGen: "Couldn't generate the EPK",
    linkCopied: "Link copied",
    popupBlocked: "Blocked by browser",
    popupBlockedDesc: "Allow popups to download the PDF",
  },
  es: {
    eyebrow: "Electronic Press Kit",
    emptyTitle: "Electronic Press Kit",
    emptyDesc: "Genera un press kit profesional completo con bio, canciones, videos, galería de fotos y más.",
    generate: "Generar Press Kit Profesional",
    generating: "Generando…",
    notPublished: "El press kit aún no ha sido publicado.",
    loading: "Cargando press kit…",
    openPublic: "Abrir EPK público",
    downloadPdf: "Descargar PDF",
    share: "Compartir",
    regenerate: "Regenerar",
    biography: "Biografía",
    music: "Música",
    track: "Pista",
    tracks: "Pistas",
    videos: "Videos",
    pressPhotos: "Fotos de prensa y galería",
    highlights: "Logros y momentos destacados",
    factSheet: "Ficha del artista",
    technicalSheet: "Ficha técnica",
    social: "Redes y streaming",
    contact: "Contacto de prensa y booking",
    readPress: "Leer press release completo",
    hidePress: "Ocultar press release completo",
    bandMembers: "Integrantes",
    bandSize: "Tamaño de banda",
    setDuration: "Duración del set",
    vocalRange: "Registro vocal",
    primaryKey: "Tonalidad",
    bpmRange: "Rango de BPM",
    languagesLabel: "Idioma(s)",
    venues: "Venues",
    influences: "Influencias",
    instrumentation: "Instrumentación",
    technicalRider: "Rider técnico",
    readyTitle: "✨ Press Kit listo",
    readyMaster: "Generado a partir de tu Master JSON e imágenes",
    readyAI: "Press kit profesional generado con IA",
    errorTitle: "Error",
    errorGen: "No se pudo generar el EPK",
    linkCopied: "Enlace copiado",
    popupBlocked: "Bloqueado por el navegador",
    popupBlockedDesc: "Permite ventanas emergentes para descargar el PDF",
  },
};

// ─── Types ─────────────────────────────────────────────────────────

interface EPKTrack {
  title: string;
  audioUrl: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
  isFeatured?: boolean;
}

interface EPKVideo {
  title: string;
  url: string;
  thumbnail?: string;
  description?: string;
  isLoop?: boolean;
}

interface EPKBandMember { name: string; role: string }

interface EPKTechnicalSheet {
  bandSize?: string;
  members?: EPKBandMember[];
  instrumentation?: string[];
  liveSetupDuration?: string;
  vocalRange?: string;
  primaryKey?: string;
  bpmRange?: string;
  language?: string[];
  influencesShort?: string;
  preferredVenues?: string;
  technicalRider?: string[];
  hospitalityRider?: string[];
}

interface EPKContact {
  label: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface EPKDoc {
  artistName: string;
  tagline?: string;
  genre: string[];
  oneLineBio?: string;
  shortBio?: string;
  pressRelease?: string;
  artistQuote?: string;
  achievements?: string[];
  notableMoments?: string[];
  influences?: string[];
  factSheet?: { label: string; value: string }[];
  pressPhotos?: { url: string; caption: string }[];
  gallery?: string[];
  coverImage?: string;
  profileImage?: string;
  tracks?: EPKTrack[];
  videos?: EPKVideo[];
  technicalSheet?: EPKTechnicalSheet;
  contacts?: EPKContact[];
  socialLinks?: {
    spotify?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    youtube?: string;
    website?: string;
  };
  boostifyLinks?: { profile?: string; epk?: string };
  meta?: { generatedAt?: string; builtFromMasterJson?: boolean; language?: EpkLang };
}

interface EpkSectionProps {
  artistId: string | number;
  isOwnProfile: boolean;
  colors: { hexAccent: string; hexPrimary: string };
}

// ─── Small sub-components ──────────────────────────────────────────

function SectionTitle({ icon: Icon, label, accent }: { icon: any; label: string; accent: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${accent}20` }}>
        <Icon className="h-4 w-4" style={{ color: accent }} />
      </div>
      <span className="text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>
        {label}
      </span>
    </div>
  );
}

function Divider({ accent }: { accent: string }) {
  return (
    <div className="my-5 h-px w-full"
      style={{ background: `linear-gradient(90deg, transparent, ${accent}44, transparent)` }} />
  );
}

function LangToggle({ lang, onChange, accent, disabled }: { lang: EpkLang; onChange: (l: EpkLang) => void; accent: string; disabled?: boolean }) {
  return (
    <div className="inline-flex items-center rounded-full border overflow-hidden"
      style={{ borderColor: `${accent}40`, background: "rgba(255,255,255,0.04)" }}>
      <Languages className="h-3.5 w-3.5 ml-2.5 mr-1" style={{ color: accent }} />
      {(["en", "es"] as EpkLang[]).map((l) => {
        const active = lang === l;
        return (
          <button key={l} type="button" disabled={disabled} onClick={() => onChange(l)}
            className="px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide transition-all disabled:opacity-50"
            style={active
              ? { background: accent, color: "#0a0a0f" }
              : { background: "transparent", color: "rgba(255,255,255,0.55)" }}
            data-testid={`button-epk-lang-${l}`}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function EpkSection({ artistId, isOwnProfile, colors }: EpkSectionProps) {
  const { toast } = useToast();
  const [epk, setEpk] = useState<EPKDoc | null>(null);
  const [slug, setSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [playingTrackUrl, setPlayingTrackUrl] = useState<string | null>(null);
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [playingVideoUrl, setPlayingVideoUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [lang, setLang] = useState<EpkLang>("en");
  const t = STRINGS[lang];

  const { hexAccent, hexPrimary } = colors;

  const publicUrl = useMemo(() => {
    if (!slug || typeof window === "undefined") return null;
    return `${window.location.origin}/epk/${slug}`;
  }, [slug]);

  const numericArtistId = useMemo(() => {
    const n = Number.parseInt(String(artistId));
    return Number.isNaN(n) ? null : n;
  }, [artistId]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!numericArtistId) { setLoading(false); return; }
      try {
        const r: any = await apiRequest({ url: `/api/epk/by-artist/${numericArtistId}`, method: "GET" });
        if (cancelled) return;
        if (r?.success && r?.epk) { setEpk(r.epk); setSlug(r.slug || null); setLang(r.epk?.meta?.language === "es" ? "es" : "en"); }
      } catch { /* 404 = not yet generated */ }
      finally { if (!cancelled) setLoading(false); }
    }
    load();
    return () => { cancelled = true; };
  }, [numericArtistId]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  async function handleGenerate(langOverride?: EpkLang) {
    const targetLang = langOverride || lang;
    setGenerating(true);
    try {
      const r: any = await apiRequest({ url: "/api/epk/generate", method: "POST", data: { artistId: String(artistId), language: targetLang } });
      if (r?.success && r?.epk) {
        setEpk(r.epk); setSlug(r.slug || null); setLang(r.epk?.meta?.language === "es" ? "es" : "en");
        toast({ title: STRINGS[targetLang].readyTitle, description: r.epk.meta?.builtFromMasterJson ? STRINGS[targetLang].readyMaster : STRINGS[targetLang].readyAI });
      } else throw new Error(r?.message || STRINGS[targetLang].errorGen);
    } catch (err: any) {
      toast({ title: STRINGS[targetLang].errorTitle, description: err?.message || STRINGS[targetLang].errorGen, variant: "destructive" });
    } finally { setGenerating(false); }
  }

  // Switch UI language. For owners, regenerate the AI content in that language too.
  function switchLanguage(next: EpkLang) {
    if (next === lang) return;
    setLang(next);
    const contentLang: EpkLang = epk?.meta?.language === "es" ? "es" : "en";
    if (isOwnProfile && epk && contentLang !== next && !generating) {
      handleGenerate(next);
    }
  }

  function handleOpen() { if (publicUrl) window.open(publicUrl, "_blank", "noopener"); }

  async function handleShare() {
    if (!publicUrl) return;
    try {
      if ((navigator as any).share) {
        await (navigator as any).share({ title: `${epk?.artistName} — Electronic Press Kit`, url: publicUrl });
      } else {
        await navigator.clipboard.writeText(publicUrl);
        toast({ title: t.linkCopied, description: publicUrl });
      }
    } catch { /* cancelled */ }
  }

  function handleDownloadPdf() {
    if (!publicUrl) return;
    const w = window.open(publicUrl, "_blank");
    if (!w) { toast({ title: t.popupBlocked, description: t.popupBlockedDesc, variant: "destructive" }); return; }
    setTimeout(() => { try { w.focus(); w.print(); } catch { /* user can print manually */ } }, 1200);
  }

  function toggleTrack(url: string) {
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    if (playingTrackUrl === url) {
      audio.pause();
      setPlayingTrackUrl(null);
    } else {
      audio.pause();
      audio.src = url;
      audio.play().catch(() => {});
      setPlayingTrackUrl(url);
    }
    audio.onended = () => setPlayingTrackUrl(null);
  }

  function isYouTube(url: string) { return url.includes('youtube.com') || url.includes('youtu.be'); }

  function youtubeEmbedUrl(url: string) {
    const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://www.youtube.com/embed/${match[1]}?autoplay=1` : null;
  }

  function thumbnailFromYouTube(url: string) {
    const match = url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
    return match ? `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg` : null;
  }

  const cover = epk?.coverImage || epk?.profileImage || epk?.pressPhotos?.[0]?.url;
  const allPhotos = [
    ...(epk?.pressPhotos || []).map((p) => p.url),
    ...(epk?.gallery || []),
  ].filter(Boolean).slice(0, 12);
  const publishedVideos = (epk?.videos || []).filter((v) => !v.isLoop);

  // ─── Loading ────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-white/50 text-sm">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> {t.loading}
      </div>
    );
  }

  // ─── Empty state ─────────────────────────────────────────────────
  if (!epk) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-2xl border p-6 text-center space-y-4"
          style={{ borderColor: `${hexAccent}30`, background: `${hexAccent}08` }}>
          <div className="flex justify-center">
            <LangToggle lang={lang} onChange={switchLanguage} accent={hexAccent} disabled={generating} />
          </div>
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: `${hexAccent}18` }}>
            <FileText className="h-7 w-7" style={{ color: hexAccent }} />
          </div>
          <div>
            <p className="text-white font-semibold text-base mb-1">{t.emptyTitle}</p>
            <p className="text-sm text-white/60 leading-relaxed max-w-sm mx-auto">
              {t.emptyDesc}
            </p>
          </div>
          {isOwnProfile ? (
            <button type="button" onClick={() => handleGenerate()} disabled={generating}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all hover:scale-[1.02] disabled:opacity-60"
              style={{ background: `linear-gradient(135deg, ${hexAccent}, ${hexPrimary})`, color: "#0a0a0f" }}
              data-testid="button-epk-generate">
              {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> {t.generating}</> : <><Sparkles className="h-4 w-4" /> {t.generate}</>}
            </button>
          ) : (
            <p className="text-xs text-white/40 italic">{t.notPublished}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Full EPK Viewer ─────────────────────────────────────────────
  return (
    <div className="space-y-0" data-chrome-keep>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

        {/* ── HERO ─────────────────────────────────────────────── */}
        <div className="relative rounded-2xl overflow-hidden mb-5"
          style={{ aspectRatio: "21/9", minHeight: 180 }}>
          {cover ? (
            <img src={cover} alt={epk.artistName} className="w-full h-full object-cover" />
          ) : (
            <div style={{ background: `linear-gradient(135deg, ${hexPrimary}44, ${hexAccent}22)` }} className="w-full h-full" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
          {epk.meta?.builtFromMasterJson && (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-full"
                style={{ background: `${hexAccent}22`, color: hexAccent, border: `1px solid ${hexAccent}44` }}>
                <CheckCircle2 className="h-3 w-3" /> Master JSON
              </span>
            </div>
          )}
          <div className="absolute left-4 right-4 bottom-4">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/60 mb-1">Electronic Press Kit</div>
            <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.8)' }}>{epk.artistName}</h2>
            {epk.tagline && <p className="text-sm mt-1 text-white/80 italic">"{epk.tagline}"</p>}
            {epk.genre?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {epk.genre.slice(0, 4).map((g) => (
                  <span key={g} className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${hexAccent}30`, color: hexAccent, border: `1px solid ${hexAccent}40` }}>{g}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── ACTION BUTTONS ───────────────────────────────────── */}
        <div className="flex justify-end mb-2">
          <LangToggle lang={lang} onChange={switchLanguage} accent={hexAccent} disabled={generating} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
          <button type="button" onClick={handleOpen}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all hover:scale-[1.02]"
            style={{ background: `linear-gradient(135deg, ${hexAccent}, ${hexPrimary})`, color: "#0a0a0f" }}
            data-testid="button-epk-open">
            <ExternalLink className="h-3.5 w-3.5" /> {t.openPublic}
          </button>
          <button type="button" onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] transition-all"
            data-testid="button-epk-download">
            <Download className="h-3.5 w-3.5" /> {t.downloadPdf}
          </button>
          <button type="button" onClick={handleShare}
            className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] transition-all"
            data-testid="button-epk-share">
            <Share2 className="h-3.5 w-3.5" /> {t.share}
          </button>
          {isOwnProfile && (
            <button type="button" onClick={() => handleGenerate()} disabled={generating}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-semibold border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] transition-all disabled:opacity-60"
              data-testid="button-epk-regenerate">
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCcw className="h-3.5 w-3.5" />}
              {t.regenerate}
            </button>
          )}
        </div>

        {/* ── ARTIST QUOTE ─────────────────────────────────────── */}
        {epk.artistQuote && (
          <div className="relative rounded-xl px-5 py-4 mb-5 border-l-4"
            style={{ borderLeftColor: hexAccent, background: `${hexAccent}0a` }}>
            <Mic2 className="absolute top-3 right-4 h-5 w-5 opacity-20" style={{ color: hexAccent }} />
            <p className="text-sm italic text-white/85 leading-relaxed">"{epk.artistQuote}"</p>
            <p className="text-[11px] mt-1.5 font-semibold" style={{ color: hexAccent }}>— {epk.artistName}</p>
          </div>
        )}

        {/* ── BIO ──────────────────────────────────────────────── */}
        {(epk.oneLineBio || epk.shortBio || epk.pressRelease) && (
          <>
            <SectionTitle icon={BookOpen} label={t.biography} accent={hexAccent} />
            <div className="space-y-3 mb-1">
              {epk.oneLineBio && (
                <p className="text-sm font-semibold" style={{ color: hexAccent }}>{epk.oneLineBio}</p>
              )}
              {epk.shortBio && (
                <p className="text-sm text-white/80 leading-relaxed">{epk.shortBio}</p>
              )}
              {epk.pressRelease && epk.pressRelease !== epk.shortBio && (
                <div>
                  <AnimatePresence>
                    {bioExpanded && (
                      <motion.p key="pressRelease"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="text-sm text-white/70 leading-relaxed whitespace-pre-line">
                        {epk.pressRelease}
                      </motion.p>
                    )}
                  </AnimatePresence>
                  <button type="button" onClick={() => setBioExpanded(!bioExpanded)}
                    className="mt-2 flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-80"
                    style={{ color: hexAccent }}>
                    {bioExpanded ? <><ChevronUp className="h-3.5 w-3.5" /> {t.hidePress}</> : <><ChevronDown className="h-3.5 w-3.5" /> {t.readPress}</>}
                  </button>
                </div>
              )}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── MUSIC TRACKS ─────────────────────────────────────── */}
        {epk.tracks && epk.tracks.length > 0 && (
          <>
            <SectionTitle icon={Music2} label={`${t.music} · ${epk.tracks.length} ${epk.tracks.length !== 1 ? t.tracks : t.track}`} accent={hexAccent} />
            <div className="space-y-2 mb-1">
              {epk.tracks.map((track, i) => {
                const isPlaying = playingTrackUrl === track.audioUrl;
                return (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border transition-all"
                    style={{ borderColor: isPlaying ? `${hexAccent}60` : 'rgba(255,255,255,0.08)', background: isPlaying ? `${hexAccent}12` : 'rgba(255,255,255,0.03)' }}>
                    <div className="relative flex-shrink-0">
                      {track.coverArt ? (
                        <img src={track.coverArt} alt={track.title} className="w-11 h-11 rounded-lg object-cover" />
                      ) : (
                        <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: `${hexAccent}22` }}>
                          <Music2 className="h-5 w-5" style={{ color: hexAccent }} />
                        </div>
                      )}
                      {track.isFeatured && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center" style={{ background: hexAccent }}>
                          <Zap className="h-2.5 w-2.5 text-black" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{track.title}</p>
                      <p className="text-[11px] text-white/50 truncate">
                        {[track.genre, track.duration].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    <button type="button" onClick={() => toggleTrack(track.audioUrl)}
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all hover:scale-110"
                      style={{ background: isPlaying ? hexAccent : `${hexAccent}22` }}>
                      {isPlaying
                        ? <Pause className="h-4 w-4 text-black" fill="black" />
                        : <Play className="h-4 w-4 ml-0.5" style={{ color: hexAccent }} fill={hexAccent} />}
                    </button>
                  </div>
                );
              })}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── VIDEOS ───────────────────────────────────────────── */}
        {publishedVideos.length > 0 && (
          <>
            <SectionTitle icon={VideoIcon} label={`${t.videos} · ${publishedVideos.length}`} accent={hexAccent} />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-1">
              {publishedVideos.map((video, i) => {
                const isYT = isYouTube(video.url);
                const ytThumb = isYT ? thumbnailFromYouTube(video.url) : null;
                const thumb = video.thumbnail || ytThumb || null;
                const isPlaying = playingVideoUrl === video.url;
                const embedUrl = isYT ? youtubeEmbedUrl(video.url) : null;
                return (
                  <div key={i} className="rounded-xl overflow-hidden border" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                    <div className="relative cursor-pointer group"
                      onClick={() => setPlayingVideoUrl(isPlaying ? null : video.url)}
                      style={{ aspectRatio: '16/9' }}>
                      {isPlaying && embedUrl ? (
                        <iframe src={embedUrl} className="w-full h-full"
                          allow="autoplay; encrypted-media" allowFullScreen title={video.title} />
                      ) : isPlaying && !isYT ? (
                        <video src={video.url} className="w-full h-full object-cover" autoPlay controls />
                      ) : (
                        <>
                          {thumb ? (
                            <img src={thumb} alt={video.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center" style={{ background: `${hexPrimary}22` }}>
                              <VideoIcon className="h-10 w-10 opacity-40" style={{ color: hexAccent }} />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: hexAccent }}>
                              <Play className="h-5 w-5 text-black ml-0.5" fill="black" />
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-white truncate">{video.title}</p>
                      {video.description && (
                        <p className="text-[11px] text-white/50 mt-0.5 line-clamp-1">{video.description}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── PRESS PHOTOS + GALLERY ───────────────────────────── */}
        {allPhotos.length > 0 && (
          <>
            <SectionTitle icon={ImageIcon} label={`${t.pressPhotos} · ${allPhotos.length}`} accent={hexAccent} />
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-1">
              {allPhotos.map((url, i) => (
                <div key={i} className="relative rounded-lg overflow-hidden cursor-pointer group"
                  style={{ aspectRatio: '1' }} onClick={() => setLightboxImg(url)}>
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                  {i < (epk.pressPhotos?.length || 0) && epk.pressPhotos?.[i]?.caption && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[9px] text-white truncate">{epk.pressPhotos[i].caption}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── ACHIEVEMENTS ─────────────────────────────────────── */}
        {(epk.achievements?.length || epk.notableMoments?.length) ? (
          <>
            <SectionTitle icon={Award} label={t.highlights} accent={hexAccent} />
            <div className="space-y-2 mb-1">
              {epk.achievements?.map((a, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: `${hexAccent}20` }}>
                    <CheckCircle2 className="h-3 w-3" style={{ color: hexAccent }} />
                  </div>
                  <p className="text-sm text-white/80 leading-snug">{a}</p>
                </div>
              ))}
              {epk.notableMoments?.map((m, i) => (
                <div key={`nm-${i}`} className="flex items-start gap-2.5">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
                    style={{ background: `${hexPrimary}20` }}>
                    <Zap className="h-3 w-3" style={{ color: hexPrimary }} />
                  </div>
                  <p className="text-sm text-white/70 leading-snug">{m}</p>
                </div>
              ))}
            </div>
            <Divider accent={hexAccent} />
          </>
        ) : null}

        {/* ── FACT SHEET ───────────────────────────────────────── */}
        {epk.factSheet && epk.factSheet.length > 0 && (
          <>
            <SectionTitle icon={Info} label={t.factSheet} accent={hexAccent} />
            <div className="rounded-xl border overflow-hidden mb-1" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
              {epk.factSheet.map((row, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5"
                  style={{ borderBottom: i < epk.factSheet!.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                  <span className="text-xs font-semibold w-28 flex-shrink-0 pt-0.5" style={{ color: hexAccent }}>{row.label}</span>
                  <span className="text-xs text-white/75 leading-relaxed">{row.value}</span>
                </div>
              ))}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}



        {/* ── TECHNICAL SHEET ──────────────────────────────────── */}
        {epk.technicalSheet && Object.keys(epk.technicalSheet).length > 0 && (
          <>
            <SectionTitle icon={BarChart3} label={t.technicalSheet} accent={hexAccent} />
            <div className="space-y-3 mb-1">
              {epk.technicalSheet.members && epk.technicalSheet.members.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">{t.bandMembers}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {epk.technicalSheet.members.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <Users className="h-3.5 w-3.5 flex-shrink-0" style={{ color: hexAccent }} />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                          {m.role && <p className="text-[10px] text-white/50 truncate">{m.role}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: t.bandSize, value: epk.technicalSheet.bandSize },
                  { label: t.setDuration, value: epk.technicalSheet.liveSetupDuration },
                  { label: t.vocalRange, value: epk.technicalSheet.vocalRange },
                  { label: t.primaryKey, value: epk.technicalSheet.primaryKey },
                  { label: t.bpmRange, value: epk.technicalSheet.bpmRange },
                  { label: t.languagesLabel, value: epk.technicalSheet.language?.join(', ') },
                  { label: t.venues, value: epk.technicalSheet.preferredVenues },
                  { label: t.influences, value: epk.technicalSheet.influencesShort },
                ].filter((r) => r.value).map((r, i) => (
                  <div key={i} className="p-2.5 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <p className="text-[10px] text-white/40 mb-0.5 uppercase tracking-wide">{r.label}</p>
                    <p className="text-xs text-white/85 font-medium truncate">{r.value}</p>
                  </div>
                ))}
              </div>
              {epk.technicalSheet.instrumentation && epk.technicalSheet.instrumentation.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">{t.instrumentation}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {epk.technicalSheet.instrumentation.map((inst, i) => (
                      <span key={i} className="text-[11px] px-2.5 py-1 rounded-full"
                        style={{ background: `${hexPrimary}18`, color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.1)' }}>
                        {inst}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {epk.technicalSheet.technicalRider && epk.technicalSheet.technicalRider.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-white/40 mb-2">{t.technicalRider}</p>
                  <ul className="space-y-1">
                    {epk.technicalSheet.technicalRider.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-white/65">
                        <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: hexAccent }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── SOCIAL LINKS ─────────────────────────────────────── */}
        {epk.socialLinks && Object.values(epk.socialLinks).some(Boolean) && (
          <>
            <SectionTitle icon={Globe} label={t.social} accent={hexAccent} />
            <div className="flex flex-wrap gap-2 mb-1">
              {epk.socialLinks.spotify && (
                <a href={epk.socialLinks.spotify} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: '#1DB95420', color: '#1DB954', border: '1px solid #1DB95440' }}>
                  <Headphones className="h-3.5 w-3.5" /> Spotify
                </a>
              )}
              {epk.socialLinks.instagram && (
                <a href={epk.socialLinks.instagram} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: '#E114A820', color: '#E114A8', border: '1px solid #E114A840' }}>
                  <Instagram className="h-3.5 w-3.5" /> Instagram
                </a>
              )}
              {epk.socialLinks.youtube && (
                <a href={epk.socialLinks.youtube} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: '#FF000020', color: '#FF0000', border: '1px solid #FF000040' }}>
                  <Youtube className="h-3.5 w-3.5" /> YouTube
                </a>
              )}
              {epk.socialLinks.tiktok && (
                <a href={epk.socialLinks.tiktok} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'white', border: '1px solid rgba(255,255,255,0.15)' }}>
                  <Zap className="h-3.5 w-3.5" /> TikTok
                </a>
              )}
              {epk.socialLinks.website && (
                <a href={epk.socialLinks.website} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all hover:scale-105"
                  style={{ background: `${hexAccent}18`, color: hexAccent, border: `1px solid ${hexAccent}40` }}>
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
            </div>
            <Divider accent={hexAccent} />
          </>
        )}

        {/* ── CONTACTS ─────────────────────────────────────────── */}
        {epk.contacts && epk.contacts.length > 0 && (
          <>
            <SectionTitle icon={Mail} label={t.contact} accent={hexAccent} />
            <div className="space-y-2 mb-1">
              {epk.contacts.map((c, i) => (
                <div key={i} className="rounded-xl border p-3 space-y-1"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                  <p className="text-[11px] uppercase tracking-wide font-semibold" style={{ color: hexAccent }}>{c.label}</p>
                  {c.name && <p className="text-sm text-white font-medium">{c.name}</p>}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── PUBLIC URL ───────────────────────────────────────── */}
        {publicUrl && (
          <div className="mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] text-white/40 text-center truncate font-mono" title={publicUrl}>{publicUrl}</p>
          </div>
        )}

      </motion.div>

      {/* ── LIGHTBOX ─────────────────────────────────────────── */}
      <AnimatePresence>
        {lightboxImg && (
          <motion.div key="lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
            onClick={() => setLightboxImg(null)}>
            <motion.img src={lightboxImg} alt="Press photo"
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
              style={{ maxHeight: '90vh', maxWidth: '90vw' }}
              onClick={(e) => e.stopPropagation()} />
            <button type="button"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
              onClick={() => setLightboxImg(null)}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default EpkSection;
