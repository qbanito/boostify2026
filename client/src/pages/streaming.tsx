import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Search,
  Play,
  Plus,
  Sparkles,
  TrendingUp,
  Clock,
  Music2,
  ListMusic,
  Crown,
  Trash2,
  X,
  Loader2,
  Star,
  Wand2,
  CheckCircle2,
  Share2,
  Code2,
  Copy,
  Check,
  Heart,
  Flame,
  UserPlus,
  UserCheck,
  Disc3,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useAudioPlayer, type AudioTrack } from "@/contexts/audio-player-context";
import { useToast } from "@/hooks/use-toast";

// ─── Types (mirror server/routes/streaming.ts shapes) ────────────────────────
interface StreamArtist {
  id: number;
  name: string;
  slug: string | null;
  genre: string | null;
  country: string | null;
  biography: string | null;
  image: string | null;
  cover: string | null;
  isAIGenerated: boolean;
  songCount: number;
  totalPlays: number;
  featured: boolean;
  featuredOrder: number | null;
  badge: string | null;
  aiScore: number | null;
  aiReason?: string | null;
}

interface StreamSong {
  id: number;
  title: string;
  description: string | null;
  audioUrl: string | null;
  coverArt: string | null;
  genre: string | null;
  mood: string | null;
  duration: string | null;
  plays: number;
  createdAt: string | null;
  artist: {
    id: number;
    name: string;
    slug: string | null;
    image: string | null;
  };
}

interface StreamHome {
  featured: StreamArtist[];
  trending: StreamSong[];
  recent: StreamSong[];
  genres: { genre: string; count: number }[];
}

interface Playlist {
  id: number;
  title: string;
  description: string | null;
  coverArt: string | null;
  isPublic: boolean;
  songCount: number;
  createdAt: string | null;
}

interface PlaylistDetail extends Playlist {
  songs: StreamSong[];
}

interface MadeForYouMix {
  id: string;
  title: string;
  genre: string;
  songs: StreamSong[];
}

interface ChartsResult {
  top: StreamSong[];
  viral: StreamSong[];
}

interface SearchPlaylist {
  id: number;
  title: string;
  description: string | null;
  coverArt: string | null;
  songCount: number;
  ownerName: string | null;
}

interface SearchAllResult {
  artists: StreamArtist[];
  songs: StreamSong[];
  playlists: SearchPlaylist[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function songToTrack(s: StreamSong): AudioTrack {
  return {
    id: s.id,
    title: s.title,
    artist: s.artist?.name,
    audioUrl: s.audioUrl || "",
    coverArt: s.coverArt || s.artist?.image || null,
    duration: s.duration,
    sourceHref: s.artist?.slug ? `/artist/${s.artist.slug}` : undefined,
  };
}

function initials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Imagen con respaldo: si la URL falta o falla la carga, muestra el fallback
// (icono / iniciales) en lugar de dejar una imagen rota.
function SmartImage({
  src,
  alt,
  className,
  fallback,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallback: React.ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return <>{fallback}</>;
  }
  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Panel "Compartir / Insertar" para una playlist (estilo Spotify).
// El enlace y el iframe apuntan al widget público /embed/playlist/:id
function PlaylistSharePanel({
  playlistId,
  title,
  onCopied,
}: {
  playlistId: number;
  title: string;
  onCopied: (msg: string) => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}/embed/playlist/${playlistId}`;
  const embedCode = `<iframe src="${shareUrl}" width="100%" height="420" frameborder="0" loading="lazy" allow="autoplay; encrypted-media" style="border-radius:16px;max-width:480px"></iframe>`;
  const shareText = `🎧 Escucha mi playlist "${title}" en Boostify Stream`;

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedEmbed, setCopiedEmbed] = useState(false);

  async function copy(text: string, which: "link" | "embed") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* noop */
    }
    if (which === "link") {
      setCopiedLink(true);
      onCopied("¡Enlace copiado!");
      setTimeout(() => setCopiedLink(false), 1800);
    } else {
      setCopiedEmbed(true);
      onCopied("¡Código de inserción copiado!");
      setTimeout(() => setCopiedEmbed(false), 1800);
    }
  }

  const socials: { label: string; href: string; bg: string }[] = [
    { label: "X", href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`, bg: "#000000" },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`, bg: "#1877F2" },
    { label: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(shareText + " " + shareUrl)}`, bg: "#25D366" },
    { label: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`, bg: "#229ED9" },
  ];

  return (
    <div className="mb-5 p-4 rounded-2xl bg-white/[0.04] border border-orange-400/20 space-y-4">
      <div className="flex items-center gap-2">
        <Share2 className="w-4 h-4 text-orange-400" />
        <h3 className="font-semibold text-sm">Compartir esta playlist</h3>
      </div>

      {/* Enlace */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Enlace del widget</label>
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={shareUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-xs text-white/80 focus:outline-none focus:border-orange-400/50 truncate"
          />
          <button
            onClick={() => copy(shareUrl, "link")}
            className="px-3 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-black text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedLink ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Código embed */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 flex items-center gap-1">
          <Code2 className="w-3 h-3" /> Insertar (como Spotify)
        </label>
        <div className="flex items-start gap-2">
          <textarea
            readOnly
            value={embedCode}
            onFocus={(e) => e.currentTarget.select()}
            rows={3}
            className="flex-1 px-3 py-2 rounded-lg bg-black/30 border border-white/10 text-[11px] font-mono text-white/70 focus:outline-none focus:border-orange-400/50 resize-none"
          />
          <button
            onClick={() => copy(embedCode, "embed")}
            className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
          >
            {copiedEmbed ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedEmbed ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Redes sociales */}
      <div>
        <label className="text-xs text-white/40 mb-1.5 block">Compartir en redes</label>
        <div className="flex flex-wrap gap-2">
          {socials.map((s) => (
            <a
              key={s.label}
              href={s.href}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-white text-xs font-semibold transition hover:opacity-90"
              style={{ background: s.bg }}
            >
              {s.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function StreamingPage() {
  const { isAdmin, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const player = useAudioPlayer();
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [view, setView] = useState<"home" | "search" | "library" | "admin">("home");
  const [openPlaylistId, setOpenPlaylistId] = useState<number | null>(null);
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<StreamSong | null>(null);
  const [sharePlaylistOpen, setSharePlaylistOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<"artists" | "songs" | "playlists">("artists");

  // ─── Home feed ─────────────────────────────────────────────────────────────
  const { data: home } = useQuery<StreamHome>({
    queryKey: ["/api/streaming/home"],
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/home");
      return (
        r?.featured || r?.trending
          ? { featured: r.featured || [], trending: r.trending || [], recent: r.recent || [], genres: r.genres || [] }
          : { featured: [], trending: [], recent: [], genres: [] }
      );
    },
  });

  // ─── Artist search ─────────────────────────────────────────────────────────
  const { data: searchResults = [], isFetching: searching } = useQuery<StreamArtist[]>({
    queryKey: ["/api/streaming/artists", search, activeGenre],
    enabled: view === "search" || !!search || !!activeGenre,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (activeGenre) params.set("genre", activeGenre);
      params.set("limit", "40");
      const r = await apiRequest(`/api/streaming/artists?${params.toString()}`);
      return r?.artists || [];
    },
  });

  // ─── Playlists ─────────────────────────────────────────────────────────────
  const { data: playlists = [] } = useQuery<Playlist[]>({
    queryKey: ["/api/streaming/playlists"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/playlists");
      return r?.playlists || [];
    },
  });

  const { data: openPlaylist } = useQuery<PlaylistDetail | null>({
    queryKey: ["/api/streaming/playlists", openPlaylistId],
    enabled: !!openPlaylistId,
    queryFn: async () => {
      if (!openPlaylistId) return null;
      const r = await apiRequest(`/api/streaming/playlists/${openPlaylistId}`);
      const pl = r?.playlist;
      if (!pl) return null;
      // El backend devuelve `songs` como hermano de `playlist`, no dentro de él.
      const songs = Array.isArray(r?.songs) ? r.songs : (Array.isArray(pl.songs) ? pl.songs : []);
      return { ...pl, songs } as PlaylistDetail;
    },
  });

  // ─── Social / personalization ──────────────────────────────────────────────
  const { data: likedData } = useQuery<{ ids: number[] }>({
    queryKey: ["/api/streaming/likes/ids"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/likes/ids");
      return { ids: Array.isArray(r?.ids) ? r.ids : [] };
    },
  });
  const likedIds = useMemo(() => new Set<number>(likedData?.ids ?? []), [likedData]);

  const { data: likedSongs = [] } = useQuery<StreamSong[]>({
    queryKey: ["/api/streaming/likes"],
    enabled: isAuthenticated && view === "library",
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/likes");
      return r?.songs || [];
    },
  });

  const { data: followData } = useQuery<{ ids: number[] }>({
    queryKey: ["/api/streaming/follows/ids"],
    enabled: isAuthenticated,
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/follows/ids");
      return { ids: Array.isArray(r?.ids) ? r.ids : [] };
    },
  });
  const followIds = useMemo(() => new Set<number>(followData?.ids ?? []), [followData]);

  const { data: recentPlayed = [] } = useQuery<StreamSong[]>({
    queryKey: ["/api/streaming/recent"],
    enabled: isAuthenticated && view === "home",
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/recent");
      return r?.songs || [];
    },
  });

  const { data: madeForYou = [] } = useQuery<MadeForYouMix[]>({
    queryKey: ["/api/streaming/made-for-you"],
    enabled: isAuthenticated && view === "home",
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/made-for-you");
      return r?.mixes || [];
    },
  });

  const { data: followingFeed = [] } = useQuery<StreamSong[]>({
    queryKey: ["/api/streaming/following/feed"],
    enabled: isAuthenticated && view === "home",
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/following/feed");
      return r?.songs || [];
    },
  });

  const { data: charts } = useQuery<ChartsResult>({
    queryKey: ["/api/streaming/charts"],
    enabled: view === "home",
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/charts");
      return { top: r?.top || [], viral: r?.viral || [] };
    },
  });

  const { data: fullSearch, isFetching: fullSearching } = useQuery<SearchAllResult>({
    queryKey: ["/api/streaming/search", search],
    enabled: view === "search" && search.trim().length > 0,
    queryFn: async () => {
      const r = await apiRequest(`/api/streaming/search?q=${encodeURIComponent(search.trim())}`);
      return { artists: r?.artists || [], songs: r?.songs || [], playlists: r?.playlists || [] };
    },
  });

  const likeMutation = useMutation({
    mutationFn: async ({ songId, like }: { songId: number; like: boolean }) =>
      apiRequest(`/api/streaming/likes/${songId}`, { method: like ? "POST" : "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/likes/ids"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/likes"] });
    },
    onError: () => toast({ title: "Inicia sesión para guardar tus me gusta", variant: "destructive" }),
  });

  const followMutation = useMutation({
    mutationFn: async ({ artistId, follow }: { artistId: number; follow: boolean }) =>
      apiRequest(`/api/streaming/follows/${artistId}`, { method: follow ? "POST" : "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/follows/ids"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/following/feed"] });
    },
    onError: () => toast({ title: "Inicia sesión para seguir artistas", variant: "destructive" }),
  });

  const toggleLike = useCallback(
    (songId: number) => {
      if (!isAuthenticated) {
        toast({ title: "Inicia sesión para guardar tus me gusta", variant: "destructive" });
        return;
      }
      likeMutation.mutate({ songId, like: !likedIds.has(songId) });
    },
    [isAuthenticated, likedIds, likeMutation, toast],
  );

  const toggleFollow = useCallback(
    (artistId: number) => {
      if (!isAuthenticated) {
        toast({ title: "Inicia sesión para seguir artistas", variant: "destructive" });
        return;
      }
      followMutation.mutate({ artistId, follow: !followIds.has(artistId) });
    },
    [isAuthenticated, followIds, followMutation, toast],
  );

  // ─── Mutations ─────────────────────────────────────────────────────────────
  const createPlaylist = useMutation({
    mutationFn: async (title: string) =>
      apiRequest("/api/streaming/playlists", { method: "POST", data: { title } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists"] });
      toast({ title: "Playlist creada" });
    },
    onError: () => toast({ title: "Inicia sesión para crear playlists", variant: "destructive" }),
  });

  const deletePlaylist = useMutation({
    mutationFn: async (id: number) => apiRequest(`/api/streaming/playlists/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists"] });
      setOpenPlaylistId(null);
    },
  });

  const addSong = useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: number; songId: number }) =>
      apiRequest(`/api/streaming/playlists/${playlistId}/songs`, { method: "POST", data: { songId } }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists", v.playlistId] });
      setAddToPlaylistSong(null);
      toast({ title: "Añadida a la playlist" });
    },
    onError: () => toast({ title: "No se pudo añadir", variant: "destructive" }),
  });

  const removeSong = useMutation({
    mutationFn: async ({ playlistId, songId }: { playlistId: number; songId: number }) =>
      apiRequest(`/api/streaming/playlists/${playlistId}/songs/${songId}`, { method: "DELETE" }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists", v.playlistId] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/playlists"] });
    },
  });

  // ─── Playback ──────────────────────────────────────────────────────────────
  const playSong = useCallback(
    (song: StreamSong, list: StreamSong[]) => {
      if (!song.audioUrl) {
        toast({ title: "Sin audio disponible", variant: "destructive" });
        return;
      }
      const playable = list.filter((s) => s.audioUrl);
      const startIndex = Math.max(0, playable.findIndex((s) => s.id === song.id));
      player.playQueue(playable.map(songToTrack), { startIndex, autoplay: true });
    },
    [player, toast],
  );

  const genres = home?.genres || [];

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white pb-32">
      {/* ─── Top bar ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#0a0a0c]/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <img src="/assets/boostify-logo.svg" alt="Boostify" className="w-9 h-9 rounded-full" />
            <span className="font-bold text-lg tracking-tight hidden sm:block">Boostify Stream</span>
          </div>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                if (e.target.value) setView("search");
              }}
              onFocus={() => setView("search")}
              placeholder="Buscar artistas…"
              className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-400/50 focus:bg-white/[0.08] transition"
            />
          </div>
          <nav className="hidden md:flex items-center gap-1 ml-auto text-sm">
            <TabBtn active={view === "home"} onClick={() => setView("home")} icon={<Sparkles className="w-4 h-4" />}>
              Inicio
            </TabBtn>
            <TabBtn active={view === "library"} onClick={() => setView("library")} icon={<ListMusic className="w-4 h-4" />}>
              Mi Biblioteca
            </TabBtn>
            {isAdmin && (
              <TabBtn active={view === "admin"} onClick={() => setView("admin")} icon={<Crown className="w-4 h-4 text-amber-400" />}>
                Admin
              </TabBtn>
            )}
          </nav>
        </div>
        {/* mobile tabs */}
        <div className="md:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto text-sm">
          <TabBtn active={view === "home"} onClick={() => setView("home")} icon={<Sparkles className="w-4 h-4" />}>Inicio</TabBtn>
          <TabBtn active={view === "search"} onClick={() => setView("search")} icon={<Search className="w-4 h-4" />}>Buscar</TabBtn>
          <TabBtn active={view === "library"} onClick={() => setView("library")} icon={<ListMusic className="w-4 h-4" />}>Biblioteca</TabBtn>
          {isAdmin && <TabBtn active={view === "admin"} onClick={() => setView("admin")} icon={<Crown className="w-4 h-4 text-amber-400" />}>Admin</TabBtn>}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-10">
        {/* ─── Genre chips ──────────────────────────────────────────────── */}
        {genres.length > 0 && view !== "admin" && (
          <div className="flex flex-wrap gap-2">
            <GenreChip active={!activeGenre} onClick={() => setActiveGenre(null)}>
              Todos
            </GenreChip>
            {genres.map((g) => (
              <GenreChip
                key={g.genre}
                active={activeGenre === g.genre}
                onClick={() => {
                  setActiveGenre(activeGenre === g.genre ? null : g.genre);
                  setView("search");
                }}
              >
                {g.genre}
              </GenreChip>
            ))}
          </div>
        )}

        {/* ─── HOME ─────────────────────────────────────────────────────── */}
        {view === "home" && (
          <>
            {(home?.featured?.length ?? 0) > 0 && (
              <section>
                <SectionHeader icon={<Star className="w-5 h-5 text-amber-400" />} title="Artistas destacados" subtitle="Curados por el algoritmo de IA + el equipo" />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {home!.featured.map((a) => (
                    <ArtistCard
                      key={a.id}
                      artist={a}
                      following={isAuthenticated ? followIds.has(a.id) : undefined}
                      onToggleFollow={isAuthenticated ? toggleFollow : undefined}
                    />
                  ))}
                </div>
              </section>
            )}

            {madeForYou.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Sparkles className="w-5 h-5 text-violet-400" />}
                  title="Hecho para ti"
                  subtitle="Mixes generados a partir de lo que escuchas"
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {madeForYou.map((mix) => (
                    <MixCard key={mix.id} mix={mix} onPlay={() => playSong(mix.songs[0], mix.songs)} />
                  ))}
                </div>
              </section>
            )}

            <SongRow
              icon={<Clock className="w-5 h-5 text-emerald-400" />}
              title="Reproducido recientemente"
              songs={recentPlayed}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />

            <SongRow
              icon={<Sparkles className="w-5 h-5 text-pink-400" />}
              title="Novedades de tus artistas"
              songs={followingFeed}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />

            <SongRow
              icon={<TrendingUp className="w-5 h-5 text-amber-400" />}
              title="Top 50 Boostify"
              songs={(charts?.top || []).slice(0, 15)}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />

            <SongRow
              icon={<Flame className="w-5 h-5 text-red-400" />}
              title="Virales esta semana"
              songs={(charts?.viral || []).slice(0, 15)}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />

            <SongRow
              icon={<TrendingUp className="w-5 h-5 text-orange-400" />}
              title="Tendencias ahora"
              songs={home?.trending || []}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />

            <SongRow
              icon={<Clock className="w-5 h-5 text-sky-400" />}
              title="Recién añadidas"
              songs={home?.recent || []}
              onPlay={playSong}
              onAdd={isAuthenticated ? setAddToPlaylistSong : undefined}
              likedIds={likedIds}
              onToggleLike={toggleLike}
            />
          </>
        )}

        {/* ─── SEARCH ───────────────────────────────────────────────────── */}
        {view === "search" && (
          <section>
            <SectionHeader
              icon={<Search className="w-5 h-5 text-white/60" />}
              title={search ? `Resultados para "${search}"` : activeGenre ? `Género: ${activeGenre}` : "Explora artistas"}
            />

            {search.trim().length > 0 ? (
              <>
                {/* result tabs */}
                <div className="flex items-center gap-2 mb-5">
                  {([
                    ["artists", `Artistas${fullSearch ? ` · ${fullSearch.artists.length}` : ""}`],
                    ["songs", `Canciones${fullSearch ? ` · ${fullSearch.songs.length}` : ""}`],
                    ["playlists", `Playlists${fullSearch ? ` · ${fullSearch.playlists.length}` : ""}`],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setSearchTab(key)}
                      className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
                        searchTab === key ? "bg-white text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/10"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {fullSearching ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-white/40" />
                  </div>
                ) : searchTab === "artists" ? (
                  (fullSearch?.artists.length ?? 0) === 0 ? (
                    <p className="text-white/40 text-sm py-10 text-center">No se encontraron artistas.</p>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                      {fullSearch!.artists.map((a) => (
                        <ArtistCard
                          key={a.id}
                          artist={a}
                          following={isAuthenticated ? followIds.has(a.id) : undefined}
                          onToggleFollow={isAuthenticated ? toggleFollow : undefined}
                        />
                      ))}
                    </div>
                  )
                ) : searchTab === "songs" ? (
                  (fullSearch?.songs.length ?? 0) === 0 ? (
                    <p className="text-white/40 text-sm py-10 text-center">No se encontraron canciones.</p>
                  ) : (
                    <div className="space-y-1">
                      {fullSearch!.songs.map((s, i) => (
                        <SongListItem
                          key={s.id}
                          index={i + 1}
                          song={s}
                          onPlay={() => playSong(s, fullSearch!.songs)}
                          onAdd={isAuthenticated ? () => setAddToPlaylistSong(s) : undefined}
                          liked={likedIds.has(s.id)}
                          onToggleLike={() => toggleLike(s.id)}
                        />
                      ))}
                    </div>
                  )
                ) : (fullSearch?.playlists.length ?? 0) === 0 ? (
                  <p className="text-white/40 text-sm py-10 text-center">No se encontraron playlists.</p>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    {fullSearch!.playlists.map((p) => (
                      <a
                        key={p.id}
                        href={`/embed/playlist/${p.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition border border-white/5"
                      >
                        <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-yellow-500/30 grid place-items-center">
                          <SmartImage
                            src={p.coverArt}
                            alt={p.title}
                            className="w-full h-full object-cover"
                            fallback={<ListMusic className="w-8 h-8 text-white/60" />}
                          />
                        </div>
                        <p className="font-semibold text-sm truncate">{p.title}</p>
                        <p className="text-white/40 text-xs truncate mt-0.5">
                          {p.ownerName ? `${p.ownerName} · ` : ""}{p.songCount} canciones
                        </p>
                      </a>
                    ))}
                  </div>
                )}
              </>
            ) : searching ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-white/40 text-sm py-10 text-center">No se encontraron artistas.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {searchResults.map((a) => (
                  <ArtistCard
                    key={a.id}
                    artist={a}
                    following={isAuthenticated ? followIds.has(a.id) : undefined}
                    onToggleFollow={isAuthenticated ? toggleFollow : undefined}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* ─── LIBRARY ──────────────────────────────────────────────────── */}
        {view === "library" && (
          <LibraryView
            playlists={playlists}
            isAuthenticated={isAuthenticated}
            onOpen={setOpenPlaylistId}
            onCreate={(t) => createPlaylist.mutate(t)}
            creating={createPlaylist.isPending}
            likedSongs={likedSongs}
            onPlay={playSong}
            onAdd={setAddToPlaylistSong}
            likedIds={likedIds}
            onToggleLike={toggleLike}
          />
        )}

        {/* ─── ADMIN ────────────────────────────────────────────────────── */}
        {view === "admin" && isAdmin && <AdminPanel />}
      </main>

      {/* ─── Playlist detail modal ────────────────────────────────────────── */}
      {openPlaylistId && openPlaylist && (
        <Modal onClose={() => { setOpenPlaylistId(null); setSharePlaylistOpen(false); }}>
          <div className="flex items-start justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-bold">{openPlaylist.title}</h2>
              <p className="text-white/50 text-sm mt-1">{openPlaylist.songCount} canciones</p>
            </div>
            <div className="flex items-center gap-2">
              {(openPlaylist.songs ?? []).some((s) => s.audioUrl) && (
                <button
                  onClick={() => playSong((openPlaylist.songs ?? []).find((s) => s.audioUrl)!, openPlaylist.songs ?? [])}
                  className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm flex items-center gap-2 transition"
                >
                  <Play className="w-4 h-4 fill-black" /> Reproducir
                </button>
              )}
              <button
                onClick={() => setSharePlaylistOpen((v) => !v)}
                className={`p-2 rounded-full transition ${
                  sharePlaylistOpen
                    ? "bg-orange-500 text-black"
                    : "bg-white/5 hover:bg-orange-500/20 text-white/60 hover:text-orange-400"
                }`}
                title="Compartir / Insertar"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => deletePlaylist.mutate(openPlaylist.id)}
                className="p-2 rounded-full bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition"
                title="Eliminar playlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          {sharePlaylistOpen && (
            <PlaylistSharePanel
              playlistId={openPlaylist.id}
              title={openPlaylist.title}
              onCopied={(msg) => toast({ title: msg })}
            />
          )}
          {(openPlaylist.songs ?? []).length === 0 ? (
            <p className="text-white/40 text-sm py-8 text-center">Esta playlist está vacía. Añade canciones desde Inicio.</p>
          ) : (
            <div className="space-y-1">
              {(openPlaylist.songs ?? []).map((s, i) => (
                <SongListItem
                  key={s.id}
                  index={i + 1}
                  song={s}
                  onPlay={() => playSong(s, openPlaylist.songs ?? [])}
                  onRemove={() => removeSong.mutate({ playlistId: openPlaylist.id, songId: s.id })}
                  liked={likedIds.has(s.id)}
                  onToggleLike={() => toggleLike(s.id)}
                />
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ─── Add to playlist modal ────────────────────────────────────────── */}
      {addToPlaylistSong && (
        <Modal onClose={() => setAddToPlaylistSong(null)}>
          <h2 className="text-xl font-bold mb-1">Añadir a playlist</h2>
          <p className="text-white/50 text-sm mb-5 truncate">{addToPlaylistSong.title}</p>
          {playlists.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-white/40 text-sm mb-4">No tienes playlists todavía.</p>
              <button
                onClick={() => createPlaylist.mutate("Mi playlist")}
                className="px-4 py-2 rounded-full bg-orange-500 hover:bg-orange-400 text-black font-semibold text-sm"
              >
                Crear una
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {playlists.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addSong.mutate({ playlistId: p.id, songId: addToPlaylistSong.id })}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] transition text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/30 to-amber-500/30 grid place-items-center">
                    <ListMusic className="w-5 h-5 text-white/70" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{p.title}</p>
                    <p className="text-white/40 text-xs">{p.songCount} canciones</p>
                  </div>
                  <Plus className="w-4 h-4 text-orange-400" />
                </button>
              ))}
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Sub-components
// ═════════════════════════════════════════════════════════════════════════════
function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full whitespace-nowrap transition ${
        active ? "bg-white text-black font-semibold" : "text-white/60 hover:text-white hover:bg-white/5"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function GenreChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${
        active ? "bg-orange-500 text-black" : "bg-white/[0.06] text-white/70 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function SectionHeader({ icon, title, subtitle }: { icon?: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {subtitle && <p className="text-white/40 text-sm mt-0.5">{subtitle}</p>}
    </div>
  );
}

function ArtistCard({
  artist,
  following,
  onToggleFollow,
}: {
  artist: StreamArtist;
  following?: boolean;
  onToggleFollow?: (artistId: number) => void;
}) {
  const href = artist.slug ? `/artist/${artist.slug}` : `/artist/${artist.id}`;
  return (
    <Link href={href}>
      <div className="group cursor-pointer p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition border border-white/5">
        <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-white/10 to-white/5">
          <SmartImage
            src={artist.image}
            alt={artist.name}
            className="w-full h-full object-cover"
            fallback={
              <div className="w-full h-full grid place-items-center text-2xl font-bold text-white/30">{initials(artist.name)}</div>
            }
          />
          {artist.badge && (
            <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-400 text-black text-[10px] font-bold uppercase tracking-wide">
              {artist.badge}
            </span>
          )}
          {onToggleFollow && (
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleFollow(artist.id);
              }}
              className={`absolute top-2 right-2 p-2 rounded-full backdrop-blur-md transition shadow-lg ${
                following
                  ? "bg-orange-500 text-black"
                  : "bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"
              }`}
              title={following ? "Siguiendo" : "Seguir artista"}
              aria-label={following ? "Dejar de seguir" : "Seguir"}
            >
              {following ? <UserCheck className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
            </button>
          )}
          <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-orange-500 grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition shadow-lg">
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          </div>
        </div>
        <p className="font-semibold text-sm truncate">{artist.name}</p>
        <p className="text-white/40 text-xs truncate mt-0.5">
          {artist.genre || "Artista"} · {artist.songCount} {artist.songCount === 1 ? "tema" : "temas"}
        </p>
      </div>
    </Link>
  );
}

function MixCard({ mix, onPlay }: { mix: MadeForYouMix; onPlay: () => void }) {
  const cover = mix.songs.find((s) => s.coverArt)?.coverArt || mix.songs[0]?.artist?.image || null;
  return (
    <button
      onClick={onPlay}
      className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition border border-white/5 text-left"
    >
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3 bg-gradient-to-br from-violet-500/30 via-fuchsia-500/20 to-orange-500/20">
        <SmartImage
          src={cover}
          alt={mix.title}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full grid place-items-center">
              <Disc3 className="w-10 h-10 text-white/40" />
            </div>
          }
        />
        <div className="absolute bottom-2 right-2 w-10 h-10 rounded-full bg-orange-500 grid place-items-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition shadow-lg">
          <Play className="w-5 h-5 fill-black text-black ml-0.5" />
        </div>
      </div>
      <p className="font-semibold text-sm truncate">{mix.title}</p>
      <p className="text-white/40 text-xs truncate mt-0.5">{mix.songs.length} canciones</p>
    </button>
  );
}

function SongRow({
  icon,
  title,
  songs,
  onPlay,
  onAdd,
  likedIds,
  onToggleLike,
}: {
  icon: React.ReactNode;
  title: string;
  songs: StreamSong[];
  onPlay: (song: StreamSong, list: StreamSong[]) => void;
  onAdd?: (song: StreamSong) => void;
  likedIds?: Set<number>;
  onToggleLike?: (songId: number) => void;
}) {
  if (songs.length === 0) return null;
  return (
    <section>
      <SectionHeader icon={icon} title={title} />
      <div className="space-y-1">
        {songs.map((s, i) => (
          <SongListItem
            key={s.id}
            index={i + 1}
            song={s}
            onPlay={() => onPlay(s, songs)}
            onAdd={onAdd ? () => onAdd(s) : undefined}
            liked={likedIds?.has(s.id)}
            onToggleLike={onToggleLike ? () => onToggleLike(s.id) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

function SongListItem({
  index,
  song,
  onPlay,
  onAdd,
  onRemove,
  liked,
  onToggleLike,
}: {
  index: number;
  song: StreamSong;
  onPlay: () => void;
  onAdd?: () => void;
  onRemove?: () => void;
  liked?: boolean;
  onToggleLike?: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/[0.05] transition">
      <button onClick={onPlay} className="relative w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/10 grid place-items-center">
        <SmartImage
          src={song.coverArt || song.artist?.image || ""}
          alt={song.title}
          className="w-full h-full object-cover"
          fallback={<Music2 className="w-5 h-5 text-white/40" />}
        />
        <div className="absolute inset-0 bg-black/50 grid place-items-center opacity-0 group-hover:opacity-100 transition">
          <Play className="w-5 h-5 fill-white text-white ml-0.5" />
        </div>
      </button>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
        <p className="font-medium text-sm truncate">{song.title}</p>
        <p className="text-white/40 text-xs truncate">
          {song.artist?.name}
          {song.genre ? ` · ${song.genre}` : ""}
        </p>
      </div>
      <span className="text-white/30 text-xs hidden sm:block tabular-nums">{song.plays.toLocaleString()} ▶</span>
      {onToggleLike && (
        <button
          onClick={onToggleLike}
          className={`p-2 rounded-full transition ${
            liked ? "text-orange-500" : "text-white/40 hover:text-orange-400 hover:bg-white/5"
          }`}
          title={liked ? "Quitar de Me gusta" : "Añadir a Me gusta"}
        >
          <Heart className={`w-4 h-4 ${liked ? "fill-orange-500" : ""}`} />
        </button>
      )}
      {onAdd && (
        <button onClick={onAdd} className="p-2 rounded-full text-white/40 hover:text-orange-400 hover:bg-white/5 transition" title="Añadir a playlist">
          <Plus className="w-4 h-4" />
        </button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="p-2 rounded-full text-white/40 hover:text-red-400 hover:bg-white/5 transition" title="Quitar">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function LibraryView({
  playlists,
  isAuthenticated,
  onOpen,
  onCreate,
  creating,
  likedSongs,
  onPlay,
  onAdd,
  likedIds,
  onToggleLike,
}: {
  playlists: Playlist[];
  isAuthenticated: boolean;
  onOpen: (id: number) => void;
  onCreate: (title: string) => void;
  creating: boolean;
  likedSongs: StreamSong[];
  onPlay: (song: StreamSong, list: StreamSong[]) => void;
  onAdd: (song: StreamSong) => void;
  likedIds: Set<number>;
  onToggleLike: (songId: number) => void;
}) {
  const [newTitle, setNewTitle] = useState("");
  const [showLiked, setShowLiked] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="text-center py-20">
        <ListMusic className="w-12 h-12 text-white/20 mx-auto mb-4" />
        <p className="text-white/50">Inicia sesión para crear y gestionar tus playlists.</p>
      </div>
    );
  }

  return (
    <section>
      {/* Canciones que te gustan */}
      <button
        onClick={() => setShowLiked((v) => !v)}
        className="w-full flex items-center gap-4 mb-6 p-4 rounded-2xl bg-gradient-to-r from-orange-500/20 via-amber-500/10 to-transparent border border-orange-400/20 hover:border-orange-400/40 transition text-left"
      >
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 grid place-items-center shrink-0">
          <Heart className="w-7 h-7 text-black fill-black" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold">Canciones que te gustan</p>
          <p className="text-white/50 text-sm">{likedSongs.length} canciones · pulsa para {showLiked ? "ocultar" : "ver"}</p>
        </div>
        {likedSongs.some((s) => s.audioUrl) && (
          <span
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              const first = likedSongs.find((s) => s.audioUrl);
              if (first) onPlay(first, likedSongs);
            }}
            className="w-11 h-11 rounded-full bg-orange-500 hover:bg-orange-400 grid place-items-center shrink-0 transition cursor-pointer"
            title="Reproducir tus me gusta"
          >
            <Play className="w-5 h-5 fill-black text-black ml-0.5" />
          </span>
        )}
      </button>

      {showLiked && (
        <div className="mb-8">
          {likedSongs.length === 0 ? (
            <p className="text-white/40 text-sm py-4 text-center">
              Aún no has dado me gusta a ninguna canción. Pulsa el corazón ♥ en cualquier tema.
            </p>
          ) : (
            <div className="space-y-1">
              {likedSongs.map((s, i) => (
                <SongListItem
                  key={s.id}
                  index={i + 1}
                  song={s}
                  onPlay={() => onPlay(s, likedSongs)}
                  onAdd={() => onAdd(s)}
                  liked={likedIds.has(s.id)}
                  onToggleLike={() => onToggleLike(s.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <SectionHeader icon={<ListMusic className="w-5 h-5 text-orange-400" />} title="Mis Playlists" />
      <div className="flex gap-2 mb-6 max-w-md">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && newTitle.trim()) {
              onCreate(newTitle.trim());
              setNewTitle("");
            }
          }}
          placeholder="Nombre de la nueva playlist…"
          className="flex-1 px-4 py-2.5 rounded-full bg-white/[0.06] border border-white/10 text-sm placeholder:text-white/40 focus:outline-none focus:border-orange-400/50"
        />
        <button
          disabled={!newTitle.trim() || creating}
          onClick={() => {
            onCreate(newTitle.trim());
            setNewTitle("");
          }}
          className="px-4 py-2.5 rounded-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-black font-semibold text-sm flex items-center gap-1.5"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Crear
        </button>
      </div>
      {playlists.length === 0 ? (
        <p className="text-white/40 text-sm py-8">Aún no tienes playlists. ¡Crea la primera!</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="group p-4 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] transition border border-white/5 text-left"
            >
              <div className="aspect-square rounded-xl mb-3 bg-gradient-to-br from-orange-500/30 via-amber-500/20 to-yellow-500/30 grid place-items-center">
                <ListMusic className="w-8 h-8 text-white/60" />
              </div>
              <p className="font-semibold text-sm truncate">{p.title}</p>
              <p className="text-white/40 text-xs mt-0.5">{p.songCount} canciones</p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Admin curation panel ─────────────────────────────────────────────────────
function AdminPanel() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: featured = [], isLoading } = useQuery<StreamArtist[]>({
    queryKey: ["/api/streaming/admin/featured"],
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/admin/featured");
      return r?.featured || [];
    },
  });

  const { data: allArtists = [] } = useQuery<StreamArtist[]>({
    queryKey: ["/api/streaming/artists", "admin-all"],
    queryFn: async () => {
      const r = await apiRequest("/api/streaming/artists?limit=60");
      return r?.artists || [];
    },
  });

  const saveFeatured = useMutation({
    mutationFn: async (items: { artistId: number; featuredOrder?: number; badge?: string; isFeatured?: boolean }[]) =>
      apiRequest("/api/streaming/admin/featured", { method: "POST", data: { items } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/admin/featured"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/home"] });
      toast({ title: "Curación guardada" });
    },
  });

  const removeFeatured = useMutation({
    mutationFn: async (artistId: number) => apiRequest(`/api/streaming/admin/featured/${artistId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/admin/featured"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/home"] });
    },
  });

  const runAgent = useMutation({
    mutationFn: async () => apiRequest("/api/streaming/admin/run-agent", { method: "POST", data: { topN: 8 } }),
    onSuccess: (r: any) => {
      qc.invalidateQueries({ queryKey: ["/api/streaming/admin/featured"] });
      qc.invalidateQueries({ queryKey: ["/api/streaming/home"] });
      toast({ title: "Algoritmo IA ejecutado", description: `${r?.ranked?.length || 0} artistas re-rankeados.` });
    },
    onError: () => toast({ title: "El agente IA falló", variant: "destructive" }),
  });

  const featuredIds = useMemo(() => new Set(featured.map((a) => a.id)), [featured]);
  const candidates = allArtists.filter((a) => !featuredIds.has(a.id));

  return (
    <div className="space-y-8">
      {/* AI agent */}
      <section className="p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border border-violet-400/20">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-violet-400" /> Algoritmo de ranking con IA
            </h2>
            <p className="text-white/50 text-sm mt-1 max-w-xl">
              Los agentes IA analizan reproducciones + engagement de la Red Social (seguidores, posts, likes) y re-ordenan los
              destacados. Tu curación manual siempre tiene prioridad.
            </p>
          </div>
          <button
            onClick={() => runAgent.mutate()}
            disabled={runAgent.isPending}
            className="px-5 py-2.5 rounded-full bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-semibold text-sm flex items-center gap-2 shrink-0"
          >
            {runAgent.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Ejecutar agente IA
          </button>
        </div>
      </section>

      {/* Currently featured */}
      <section>
        <SectionHeader icon={<Star className="w-5 h-5 text-amber-400" />} title="Destacados actuales" subtitle="Orden de aparición en la página de Inicio" />
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-white/40" />
        ) : featured.length === 0 ? (
          <p className="text-white/40 text-sm">Ningún artista destacado. Añade abajo o ejecuta el agente IA.</p>
        ) : (
          <div className="space-y-2">
            {featured.map((a, i) => (
              <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.04] border border-white/5">
                <span className="w-7 h-7 rounded-full bg-white/10 grid place-items-center text-xs font-bold shrink-0">{i + 1}</span>
                <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 grid place-items-center shrink-0">
                  <SmartImage src={a.image} alt={a.name} className="w-full h-full object-cover" fallback={<span className="text-xs font-bold text-white/40">{initials(a.name)}</span>} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{a.name}</p>
                  <p className="text-white/40 text-xs truncate">
                    {a.aiScore != null && <span className="text-violet-400">IA {a.aiScore}</span>}
                    {a.aiReason ? ` · ${a.aiReason}` : a.badge ? ` · ${a.badge}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => removeFeatured.mutate(a.id)}
                  className="p-2 rounded-full text-white/40 hover:text-red-400 hover:bg-white/5 transition shrink-0"
                  title="Quitar de destacados"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add candidates */}
      <section>
        <SectionHeader icon={<Plus className="w-5 h-5 text-orange-400" />} title="Añadir a destacados" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[480px] overflow-y-auto pr-1">
          {candidates.map((a) => (
            <button
              key={a.id}
              onClick={() =>
                saveFeatured.mutate([{ artistId: a.id, featuredOrder: featured.length, isFeatured: true }])
              }
              disabled={saveFeatured.isPending}
              className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-orange-500/10 border border-white/5 hover:border-orange-400/30 transition text-left disabled:opacity-50"
            >
              <div className="w-10 h-10 rounded-lg overflow-hidden bg-white/10 grid place-items-center shrink-0">
                <SmartImage src={a.image} alt={a.name} className="w-full h-full object-cover" fallback={<span className="text-xs font-bold text-white/40">{initials(a.name)}</span>} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{a.name}</p>
                <p className="text-white/40 text-xs truncate">
                  {a.genre || "Artista"} · {a.songCount} temas · {a.totalPlays} ▶
                </p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-orange-400 opacity-0 group-hover:opacity-100" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Generic modal ────────────────────────────────────────────────────────────
function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl bg-[#15151a] border border-white/10 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="float-right p-1.5 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition">
          <X className="w-5 h-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
