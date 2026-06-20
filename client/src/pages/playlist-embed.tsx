// ─────────────────────────────────────────────────────────────────────────────
// Boostify — Embeddable / shareable playlist widget (Spotify-style)
// Public route: /embed/playlist/:id   (no chrome, works inside an <iframe>)
// Reads the public endpoint GET /api/streaming/playlists/:id/public
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Music2,
  Loader2,
  ExternalLink,
  Instagram,
  Youtube,
  Facebook,
  Twitter,
  Globe,
  Clapperboard,
} from "lucide-react";

interface SocialLinks {
  spotify: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  facebook: string | null;
  twitter: string | null;
  website: string | null;
}
interface EmbedArtist {
  id: number;
  name: string;
  slug: string | null;
  image: string | null;
  video?: string | null;
  social?: SocialLinks | null;
}
interface EmbedSong {
  id: number;
  title: string;
  audioUrl: string | null;
  coverArt: string | null;
  duration: string | null;
  artist: EmbedArtist;
}
interface EmbedPlaylist {
  id: number;
  title: string;
  description: string | null;
  coverArt: string | null;
  ownerName: string;
  ownerSlug: string | null;
  ownerImage: string | null;
  ownerCover: string | null;
  ownerVideo: string | null;
  ownerBio: string | null;
  social: SocialLinks | null;
}

const ORANGE = "#f97316";

function fmt(sec: number) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function initials(name: string) {
  return (name || "")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Cover({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div className={`grid place-items-center bg-gradient-to-br from-orange-500/30 to-amber-500/20 ${className || ""}`}>
        <Music2 className="w-1/3 h-1/3 text-white/40" />
      </div>
    );
  }
  return <img src={src} alt={alt} onError={() => setFailed(true)} className={`object-cover ${className || ""}`} loading="lazy" />;
}

// Brand glyphs not available in lucide ──────────────────────────────────────
function SpotifyGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.586 14.424a.623.623 0 0 1-.857.207c-2.348-1.435-5.304-1.76-8.785-.964a.623.623 0 1 1-.277-1.215c3.808-.87 7.076-.495 9.712 1.116a.623.623 0 0 1 .207.856Zm1.223-2.722a.78.78 0 0 1-1.072.257c-2.687-1.652-6.785-2.13-9.965-1.166a.78.78 0 1 1-.452-1.493c3.633-1.1 8.147-.564 11.232 1.332a.78.78 0 0 1 .257 1.07Zm.105-2.835c-3.223-1.914-8.54-2.09-11.616-1.156a.935.935 0 1 1-.542-1.79c3.532-1.072 9.404-.865 13.115 1.337a.936.936 0 0 1-.957 1.609Z" />
    </svg>
  );
}
function TikTokGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.1v12.4a2.59 2.59 0 1 1-2.59-2.59c.27 0 .53.04.78.12V9.66a5.7 5.7 0 0 0-.78-.05 5.69 5.69 0 1 0 5.69 5.69V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.28 4.28 0 0 1-3.24-1.48Z" />
    </svg>
  );
}

// Social network links row — connects the widget to the artist's socials ────
function SocialBar({ social }: { social: SocialLinks | null }) {
  if (!social) return null;
  const items: { key: string; href: string; label: string; node: React.ReactNode }[] = [];
  if (social.spotify) items.push({ key: "spotify", href: social.spotify, label: "Spotify", node: <SpotifyGlyph className="w-4 h-4" /> });
  if (social.instagram) items.push({ key: "instagram", href: social.instagram, label: "Instagram", node: <Instagram className="w-4 h-4" /> });
  if (social.tiktok) items.push({ key: "tiktok", href: social.tiktok, label: "TikTok", node: <TikTokGlyph className="w-4 h-4" /> });
  if (social.youtube) items.push({ key: "youtube", href: social.youtube, label: "YouTube", node: <Youtube className="w-4 h-4" /> });
  if (social.facebook) items.push({ key: "facebook", href: social.facebook, label: "Facebook", node: <Facebook className="w-4 h-4" /> });
  if (social.twitter) items.push({ key: "twitter", href: social.twitter, label: "X", node: <Twitter className="w-4 h-4" /> });
  if (social.website) items.push({ key: "website", href: social.website, label: "Web", node: <Globe className="w-4 h-4" /> });
  if (items.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          target="_blank"
          rel="noopener noreferrer"
          title={it.label}
          aria-label={it.label}
          className="w-8 h-8 rounded-full grid place-items-center bg-white/10 hover:bg-white/20 text-white/80 hover:text-white border border-white/10 transition hover:scale-110"
        >
          {it.node}
        </a>
      ))}
    </div>
  );
}

export default function PlaylistEmbedPage() {
  const [, params] = useRoute("/embed/playlist/:id");
  const playlistId = params?.id;

  const [playlist, setPlaylist] = useState<EmbedPlaylist | null>(null);
  const [songs, setSongs] = useState<EmbedSong[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [brokenVideo, setBrokenVideo] = useState<string | null>(null);

  // Fetch public playlist
  useEffect(() => {
    if (!playlistId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/streaming/playlists/${playlistId}/public`)
      .then(async (r) => {
        const json = await r.json().catch(() => null);
        if (!r.ok || !json?.success) throw new Error(json?.error || "No se pudo cargar la playlist");
        return json;
      })
      .then((json) => {
        if (cancelled) return;
        setPlaylist(json.playlist);
        setSongs((json.songs || []).filter((s: EmbedSong) => !!s.audioUrl));
        setError(null);
      })
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  const current = currentIndex >= 0 ? songs[currentIndex] : null;

  // The widget spotlights the currently-playing artist (or the playlist owner
  // when idle): their photo, loop video and social network all flow from here.
  // When idle and the owner has no rich media, spotlight the first track artist
  // that brings a video or a social presence so the widget never looks empty.
  const spotlight = useMemo<EmbedArtist>(() => {
    if (current?.artist) return current.artist;
    const owner: EmbedArtist = {
      id: 0,
      name: playlist?.ownerName || "Boostify",
      slug: playlist?.ownerSlug || null,
      image: playlist?.ownerImage || null,
      video: playlist?.ownerVideo || null,
      social: playlist?.social || null,
    };
    if (owner.video || owner.social) return owner;
    const rich = songs.find((s) => s.artist?.video || s.artist?.social)?.artist;
    return rich || owner;
  }, [current, playlist, songs]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const spotlightHref = spotlight.slug ? `${origin}/artist/${spotlight.slug}` : null;

  // Active loop video = spotlight's video, then owner's, then any track artist's.
  const activeVideo = useMemo(
    () => spotlight.video || playlist?.ownerVideo || songs.find((s) => s.artist?.video)?.artist?.video || null,
    [spotlight, playlist, songs]
  );
  const activeCover = useMemo(
    () =>
      current?.coverArt ||
      current?.artist?.image ||
      playlist?.coverArt ||
      playlist?.ownerImage ||
      songs[0]?.coverArt ||
      songs[0]?.artist?.image ||
      null,
    [current, playlist, songs]
  );
  const showVideo = !!activeVideo && brokenVideo !== activeVideo;
  const socialLinks = spotlight.social || playlist?.social || null;

  function playIndex(i: number) {
    if (i < 0 || i >= songs.length) return;
    const el = audioRef.current;
    if (!el) return;
    if (i === currentIndex) {
      if (el.paused) el.play().catch(() => {});
      else el.pause();
      return;
    }
    setCurrentIndex(i);
    const url = songs[i].audioUrl || "";
    el.src = url;
    el.play().catch(() => {});
  }

  function togglePlay() {
    if (currentIndex < 0) {
      playIndex(0);
      return;
    }
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) el.play().catch(() => {});
    else el.pause();
  }

  function next() {
    if (songs.length === 0) return;
    playIndex(currentIndex < 0 ? 0 : (currentIndex + 1) % songs.length);
  }
  function prev() {
    if (songs.length === 0) return;
    playIndex(currentIndex <= 0 ? songs.length - 1 : currentIndex - 1);
  }

  // Audio element listeners
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTime = () => setPosition(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => next();
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnded);
    return () => {
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [songs, currentIndex]);

  function seek(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current;
    if (!el || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = ratio * duration;
  }

  const boostifyHref = `${typeof window !== "undefined" ? window.location.origin : ""}/streaming`;

  return (
    <div className="min-h-screen w-full bg-[#0a0a0c] text-white flex items-center justify-center p-3 sm:p-4">
      <audio ref={audioRef} preload="none" crossOrigin="anonymous" />
      <div className="w-full max-w-md rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10">
          <img src="/assets/boostify-logo.svg" alt="Boostify" className="w-7 h-7 rounded-full" />
          <span className="font-bold text-sm tracking-tight">Boostify Stream</span>
          <a
            href={boostifyHref}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-xs text-white/50 hover:text-orange-400 inline-flex items-center gap-1 transition"
          >
            Abrir <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {loading ? (
          <div className="grid place-items-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400" />
          </div>
        ) : error ? (
          <div className="px-5 py-16 text-center">
            <Music2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 text-sm">{error}</p>
          </div>
        ) : (
          <>
            {/* Hero — immersive artist video / cover backdrop */}
            <div className="relative overflow-hidden">
              <div className="absolute inset-0">
                {showVideo ? (
                  <video
                    key={activeVideo as string}
                    src={activeVideo as string}
                    muted
                    loop
                    autoPlay
                    playsInline
                    onError={() => setBrokenVideo(activeVideo)}
                    className="w-full h-full object-cover scale-105"
                  />
                ) : (
                  <Cover src={activeCover} alt="" className="w-full h-full scale-110 blur-2xl opacity-50" />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/55 to-[#0a0a0c]" />

              <div className="relative px-5 pt-6 pb-4 flex flex-col items-center text-center">
                <div className="relative">
                  <Cover
                    src={activeCover}
                    alt={playlist?.title || "Playlist"}
                    className="w-36 h-36 sm:w-40 sm:h-40 rounded-2xl shadow-2xl ring-1 ring-white/15"
                  />
                  {showVideo && (
                    <span className="absolute bottom-1.5 right-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/65 backdrop-blur text-[9px] font-semibold text-orange-300">
                      <Clapperboard className="w-3 h-3" /> Video
                    </span>
                  )}
                </div>

                <p className="mt-3 text-[10px] uppercase tracking-[0.22em] text-orange-400 font-bold">Playlist</p>
                <h1 className="text-xl font-extrabold leading-tight px-2 truncate max-w-full">{playlist?.title}</h1>

                {spotlightHref ? (
                  <a
                    href={spotlightHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-2 group"
                  >
                    <Cover src={spotlight.image} alt={spotlight.name} className="w-6 h-6 rounded-full ring-1 ring-white/20" />
                    <span className="text-sm font-medium text-white/80 group-hover:text-orange-400 transition truncate max-w-[220px]">
                      {currentIndex >= 0 ? "▶ " : ""}
                      {spotlight.name}
                    </span>
                  </a>
                ) : (
                  <div className="mt-1.5 inline-flex items-center gap-2">
                    <Cover src={spotlight.image} alt={spotlight.name} className="w-6 h-6 rounded-full ring-1 ring-white/20" />
                    <span className="text-sm font-medium text-white/80 truncate max-w-[220px]">{spotlight.name}</span>
                  </div>
                )}

                <p className="text-white/45 text-xs mt-0.5">
                  {songs.length} {songs.length === 1 ? "tema" : "temas"}
                </p>

                <SocialBar social={socialLinks} />

                <div className="mt-4 flex items-center gap-5">
                  <button onClick={prev} disabled={songs.length === 0} className="text-white/70 hover:text-white disabled:opacity-30 transition">
                    <SkipBack className="w-5 h-5 fill-current" />
                  </button>
                  <button
                    onClick={togglePlay}
                    disabled={songs.length === 0}
                    className="w-14 h-14 rounded-full grid place-items-center text-black disabled:opacity-40 transition hover:scale-105 shadow-lg shadow-orange-500/30"
                    style={{ background: ORANGE }}
                    aria-label={isPlaying ? "Pausar" : "Reproducir"}
                  >
                    {isPlaying ? <Pause className="w-6 h-6 fill-black" /> : <Play className="w-6 h-6 fill-black ml-0.5" />}
                  </button>
                  <button onClick={next} disabled={songs.length === 0} className="text-white/70 hover:text-white disabled:opacity-30 transition">
                    <SkipForward className="w-5 h-5 fill-current" />
                  </button>
                </div>
              </div>
            </div>

            {/* Now playing progress */}
            {current && (
              <div className="px-4 pb-2">
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1">
                  <span className="truncate pr-2">{current.title} — {current.artist?.name}</span>
                  <span className="shrink-0">{fmt(position)} / {fmt(duration)}</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 cursor-pointer overflow-hidden" onClick={seek}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${duration ? (position / duration) * 100 : 0}%`, background: ORANGE }}
                  />
                </div>
              </div>
            )}

            {/* Track list */}
            <div className="max-h-72 overflow-y-auto px-2 pb-3">
              {songs.length === 0 ? (
                <p className="text-white/40 text-sm py-10 text-center">Esta playlist está vacía.</p>
              ) : (
                songs.map((s, i) => {
                  const active = i === currentIndex;
                  return (
                    <button
                      key={s.id}
                      onClick={() => playIndex(i)}
                      className={`w-full flex items-center gap-3 p-2 rounded-lg text-left transition ${
                        active ? "bg-orange-500/15" : "hover:bg-white/[0.05]"
                      }`}
                    >
                      <div className="relative w-12 h-12 rounded-md overflow-hidden shrink-0">
                        <Cover src={s.coverArt || s.artist?.image} alt={s.title} className="w-full h-full" />
                        {s.artist?.video && !(active && isPlaying) && (
                          <span className="absolute bottom-0 right-0 bg-black/70 rounded-tl px-0.5 py-0.5">
                            <Clapperboard className="w-2.5 h-2.5 text-orange-300" />
                          </span>
                        )}
                        {active && isPlaying && (
                          <div className="absolute inset-0 bg-black/50 grid place-items-center">
                            <Pause className="w-4 h-4 text-orange-400 fill-orange-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm truncate ${active ? "text-orange-400 font-semibold" : "font-medium"}`}>{s.title}</p>
                        <p className="text-white/40 text-xs truncate">{s.artist?.name}</p>
                      </div>
                      <span className="text-white/30 text-xs shrink-0">{s.duration || ""}</span>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <a
              href={boostifyHref}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-xs text-white/40 hover:text-orange-400 py-2.5 border-t border-white/10 transition"
            >
              Escuchar en Boostify Stream
            </a>
          </>
        )}
      </div>
    </div>
  );
}
