import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence, useScroll, useTransform, useSpring } from "framer-motion";
import {
  Play, Pause, Music, ExternalLink, Globe, Crown,
  ChevronDown, Sparkles, Star, Disc3, Instagram,
  Twitter, Youtube, ArrowLeft, Share2, Check,
  BookOpen, FileText, Mic2, ChevronRight,
  Wand2, X, RefreshCw, Copy,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { useAuth } from "../hooks/use-auth";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ArtistEntry {
  id: number;
  artistName: string | null;
  name: string | null;
  slug: string | null;
  profileImage: string | null;
  coverImage: string | null;
  biography: string | null;
  genres: string[] | null;
  country: string | null;
  spotifyUrl: string | null;
}

interface SongEntry {
  id: number;
  title: string;
  userId: number;
  coverArt: string | null;
  audioUrl: string;
  genre: string | null;
  duration: string | null;
  plays: number;
  isSingle: boolean;
  description: string | null;
  lyrics: string | null;
}

interface UniverseData {
  success: boolean;
  settings: { title: string; bio: string; theme: string };
  owner: { id: number; artistName: string | null; profileImage: string | null; slug: string | null } | null;
  artists: ArtistEntry[];
  discography: SongEntry[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function artistName(a: ArtistEntry) {
  return a.artistName || a.name || "Artist";
}

function formatDuration(s?: string | null) {
  if (!s) return "";
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  const m = Math.floor(n / 60);
  const sec = Math.floor(n % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Background layers ────────────────────────────────────────────────────────

function FloatingParticles() {
  const particles = Array.from({ length: 24 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2.5,
    duration: 8 + Math.random() * 16,
    delay: Math.random() * 8,
    opacity: 0.15 + Math.random() * 0.4,
  }));
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-fuchsia-400"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.opacity }}
          animate={{ y: [0, -40, 0], x: [0, 15 * (p.id % 2 === 0 ? 1 : -1), 0], opacity: [p.opacity, p.opacity * 1.6, p.opacity] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function CosmicBackground({ coverImages }: { coverImages: string[] }) {
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {coverImages.slice(0, 3).map((img, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.10 }}
          transition={{ delay: i * 0.4, duration: 1.2 }}
          style={{
            backgroundImage: `url(${img})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            filter: "blur(90px) saturate(1.6)",
            transform: `scale(1.4) rotate(${i * 8}deg)`,
          }}
        />
      ))}
      {/* Deep space gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#03010a] via-[#08030f]/95 to-[#03010a]" />
      {/* Animated orbs */}
      <motion.div
        className="absolute top-[-15%] left-[-10%] w-[900px] h-[900px] rounded-full bg-violet-700/[0.08] blur-[200px]"
        animate={{ scale: [1, 1.1, 1], x: [0, 30, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-[-20%] right-[-10%] w-[1100px] h-[1100px] rounded-full bg-fuchsia-700/[0.06] blur-[220px]"
        animate={{ scale: [1, 1.08, 1], y: [0, -40, 0] }}
        transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute top-[40%] left-[40%] w-[600px] h-[600px] rounded-full bg-rose-600/[0.04] blur-[160px]" />
      {/* Star field */}
      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: "radial-gradient(1px 1px at 10% 15%, rgba(255,255,255,0.6) 0%, transparent 100%), radial-gradient(1px 1px at 30% 45%, rgba(255,255,255,0.4) 0%, transparent 100%), radial-gradient(1.5px 1.5px at 55% 20%, rgba(255,255,255,0.5) 0%, transparent 100%), radial-gradient(1px 1px at 75% 70%, rgba(255,255,255,0.3) 0%, transparent 100%), radial-gradient(1px 1px at 90% 35%, rgba(255,255,255,0.5) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}

// ─── Audio player atom ────────────────────────────────────────────────────────

function MiniPlayer({ song, isPlaying, onToggle }: { song: SongEntry; isPlaying: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center gap-3">
      {song.coverArt ? (
        <img src={song.coverArt} alt={song.title} className="w-10 h-10 rounded-lg object-cover ring-1 ring-white/10 shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center shrink-0">
          <Music className="w-4 h-4 text-white" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white truncate">{song.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {song.isSingle && <Badge className="bg-fuchsia-600/20 text-fuchsia-300 border-fuchsia-500/30 text-[9px] py-0">SINGLE</Badge>}
          {song.genre && <span className="text-[11px] text-zinc-500">{song.genre}</span>}
          {song.duration && <span className="text-[11px] text-zinc-600">{formatDuration(song.duration)}</span>}
        </div>
      </div>
      <button
        onClick={onToggle}
        className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-fuchsia-500/20 hover:scale-105 transition-transform shrink-0"
      >
        {isPlaying ? <Pause className="w-4 h-4 text-white" /> : <Play className="w-4 h-4 text-white ml-0.5" />}
      </button>
    </div>
  );
}

// ─── Artist card ──────────────────────────────────────────────────────────────

// ─── Session card (per-song description) ────────────────────────────────────

function SessionCard({ song }: { song: SongEntry }) {
  const [open, setOpen] = useState(false);
  const hasDescription = !!song.description?.trim();
  const hasLyrics = !!song.lyrics?.trim();
  const excerpt = hasDescription
    ? song.description!
    : hasLyrics
    ? song.lyrics!.substring(0, 200) + (song.lyrics!.length > 200 ? "…" : "")
    : null;

  return (
    <motion.div
      layout
      className={`rounded-xl border p-3 transition-all ${
        hasDescription
          ? "border-violet-500/30 bg-violet-600/5 shadow-[0_0_20px_rgba(139,92,246,0.08)]"
          : "border-white/8 bg-white/[0.015]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Cover */}
        <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0">
          {song.coverArt ? (
            <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-pink-700 flex items-center justify-center">
              <Music className="w-4 h-4 text-white/60" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-white truncate">{song.title}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {song.genre && (
                  <Badge className="bg-white/8 border-white/10 text-zinc-400 text-[9px]">{song.genre}</Badge>
                )}
                {song.isSingle && (
                  <Badge className="bg-fuchsia-600/15 border-fuchsia-500/20 text-fuchsia-400 text-[9px]">Single</Badge>
                )}
                {hasDescription && (
                  <Badge className="bg-violet-600/15 border-violet-500/20 text-violet-400 text-[9px]">
                    <Sparkles className="w-2 h-2 mr-0.5 inline" />story
                  </Badge>
                )}
              </div>
            </div>
            {excerpt && (
              <button
                onClick={() => setOpen((v) => !v)}
                className="shrink-0 text-zinc-500 hover:text-fuchsia-400 transition-colors mt-0.5"
              >
                <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${open ? "rotate-90" : ""}`} />
              </button>
            )}
          </div>

          <AnimatePresence>
            {open && excerpt && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="overflow-hidden"
              >
                <div className="mt-2.5 pt-2.5 border-t border-white/8">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    {hasDescription ? (
                      <BookOpen className="w-3 h-3 text-violet-400" />
                    ) : (
                      <Mic2 className="w-3 h-3 text-fuchsia-400" />
                    )}
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
                      {hasDescription ? "About this track" : "Lyrics excerpt"}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-line">{excerpt}</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {!excerpt && (
            <p className="text-[11px] text-zinc-600 mt-1.5 italic">No description available</p>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Artist card ─────────────────────────────────────────────────────────────

function ArtistCard({
  artist,
  songs,
  onSongPlay,
  playingId,
  index,
}: {
  artist: ArtistEntry;
  songs: SongEntry[];
  onSongPlay: (song: SongEntry) => void;
  playingId: number | null;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"discography" | "sessions">("discography");
  const visible = expanded ? songs : songs.slice(0, 4);

  const sessionableSongs = songs.filter((s) => s.description || s.lyrics);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.7, delay: index * 0.1 }}
      className="rounded-3xl border border-white/8 bg-white/[0.025] overflow-hidden backdrop-blur-sm"
    >
      {/* Cover hero */}
      <div className="relative h-48 sm:h-64 overflow-hidden bg-black">
        {artist.coverImage || artist.profileImage ? (
          <>
            {/* Blurred backdrop so vertical/portrait images don't leave empty bars */}
            <div
              className="absolute inset-0 scale-110"
              style={{
                backgroundImage: `url(${artist.coverImage || artist.profileImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center top',
                filter: 'blur(22px) brightness(0.55) saturate(1.2)',
              }}
            />
            <motion.img
              src={artist.coverImage || artist.profileImage!}
              alt={artistName(artist)}
              className="relative z-10 w-full h-full object-contain"
              whileHover={{ scale: 1.04 }}
              transition={{ duration: 0.6 }}
            />
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-violet-800 via-fuchsia-900 to-pink-900" />
        )}
        <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

        {/* Profile bubble */}
        <div className="absolute bottom-4 left-5 z-30 flex items-end gap-3">
          {artist.profileImage ? (
            <img src={artist.profileImage} alt={artistName(artist)} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/20 shadow-xl" />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-pink-600 flex items-center justify-center ring-2 ring-white/20">
              <Crown className="w-7 h-7 text-white" />
            </div>
          )}
          <div>
            <h3 className="text-xl font-black text-white tracking-tight drop-shadow-lg">{artistName(artist)}</h3>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {artist.genres?.slice(0, 2).map((g) => (
                <Badge key={g} className="bg-white/10 text-white/70 border-white/10 text-[10px] backdrop-blur">{g}</Badge>
              ))}
              {artist.country && (
                <span className="text-[11px] text-white/50">{artist.country}</span>
              )}
            </div>
          </div>
        </div>

        {/* Social links */}
        <div className="absolute top-3 right-3 z-30 flex gap-1.5">
          {artist.spotifyUrl && (
            <a href={artist.spotifyUrl} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors">
              <Music className="w-3.5 h-3.5 text-white" />
            </a>
          )}
          {artist.slug && (
            <a href={`/artist/${artist.slug}`} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-black/40 backdrop-blur flex items-center justify-center hover:bg-black/60 transition-colors">
              <ExternalLink className="w-3.5 h-3.5 text-white" />
            </a>
          )}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Biography */}
        {artist.biography && (
          <p className="text-sm text-zinc-400 leading-relaxed line-clamp-3">{artist.biography}</p>
        )}

        {/* Tab switcher */}
        {songs.length > 0 && (
          <div className="border-b border-white/8 flex gap-0">
            {[
              { key: "discography", label: "Discography", icon: Disc3, count: songs.length },
              { key: "sessions", label: "Sessions", icon: BookOpen, count: sessionableSongs.length },
            ].map(({ key, label, icon: Icon, count }) => (
              <button
                key={key}
                onClick={() => setTab(key as any)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold border-b-2 transition-all -mb-px ${
                  tab === key
                    ? "border-fuchsia-500 text-fuchsia-400"
                    : "border-transparent text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
                <span className={`text-[9px] rounded-full px-1 py-0.5 ${tab === key ? "bg-fuchsia-600/20 text-fuchsia-400" : "bg-white/8 text-zinc-600"}`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === "discography" && songs.length > 0 && (
            <motion.div
              key="discography"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
            >
              <div className="space-y-2">
                {visible.map((song, i) => (
                  <motion.div
                    key={song.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    whileHover={{ scale: 1.015, boxShadow: "0 0 18px rgba(168,85,247,0.15)" }}
                    className={`rounded-xl p-2.5 transition-colors cursor-pointer ${
                      playingId === song.id
                        ? "bg-fuchsia-600/15 ring-1 ring-fuchsia-500/40"
                        : "hover:bg-white/5"
                    }`}
                    onClick={() => onSongPlay(song)}
                  >
                    <MiniPlayer
                      song={song}
                      isPlaying={playingId === song.id}
                      onToggle={() => onSongPlay(song)}
                    />
                  </motion.div>
                ))}
              </div>
              {songs.length > 4 && (
                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="mt-2 text-xs text-fuchsia-400 hover:text-fuchsia-300 flex items-center gap-1 transition-colors"
                >
                  {expanded ? "Show less" : `Show ${songs.length - 4} more`}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </motion.div>
          )}

          {tab === "sessions" && (
            <motion.div
              key="sessions"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25 }}
              className="space-y-2.5"
            >
              {songs.length === 0 ? (
                <p className="text-xs text-zinc-600 text-center py-4">No tracks yet</p>
              ) : (
                <>
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-medium pb-1">
                    What each track is about
                  </p>
                  {songs.map((song) => (
                    <SessionCard key={song.id} song={song} />
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyUniversePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeArtist, setActiveArtist] = useState<number | null>(null);

  // ── AI Bio Generator ────────────────────────────────────────────────────────
  const { user, isAuthenticated } = useAuth();
  const [bioPanel, setBioPanel] = useState(false);
  const [bioTone, setBioTone] = useState<string>('press_release');
  const [bioLang, setBioLang] = useState<string>('es');
  const [bioArtistId, setBioArtistId] = useState<number | null>(null);
  const [generatedBio, setGeneratedBio] = useState<string>('');
  const [editableBio, setEditableBio] = useState<string>('');
  const [bioCopied, setBioCopied] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 400], [1, 1.08]);

  const { data, isLoading, error } = useQuery<UniverseData>({
    queryKey: [`/api/my-universe/public/${userId}`],
    enabled: !!userId,
    retry: false,
  });

  // Handle audio
  const handleSongPlay = (song: SongEntry) => {
    if (playingId === song.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(song.audioUrl);
    audio.play().catch(() => {});
    audio.onended = () => setPlayingId(null);
    audioRef.current = audio;
    setPlayingId(song.id);
  };

  useEffect(() => {
    return () => { audioRef.current?.pause(); };
  }, []);

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── AI Bio: generate mutation ───────────────────────────────────────────────
  // NOTE: These useMutation hooks MUST be declared before any early returns to
  // satisfy the Rules of Hooks (consistent call order every render).
  const generateBioMutation = useMutation({
    mutationFn: async () => {
      const targetArtistId = bioArtistId ?? data?.owner?.id;
      const r = await fetch('/api/my-universe/generate-bio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ artistId: targetArtistId, tone: bioTone, lang: bioLang }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Generation failed');
      return d.bio as string;
    },
    onSuccess: (bio) => {
      setGeneratedBio(bio);
      setEditableBio(bio);
    },
  });

  // ── AI Bio: apply (save as universe bio) mutation ───────────────────────────
  const saveBioMutation = useMutation({
    mutationFn: async (bioText: string) => {
      const r = await fetch('/api/my-universe/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ ...data?.settings, bio: bioText }),
      });
      if (!r.ok) throw new Error('Save failed');
      return r.json();
    },
    onSuccess: () => {
      setBioPanel(false);
      window.location.reload(); // Refresh to show updated bio
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#03010a] flex items-center justify-center">
        <CosmicBackground coverImages={[]} />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-600 mx-auto mb-4 flex items-center justify-center shadow-xl shadow-fuchsia-500/20 animate-pulse">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-bold text-lg">Loading Universe...</p>
          <p className="text-zinc-500 text-sm mt-1">Gathering stars</p>
        </motion.div>
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="min-h-screen bg-[#03010a] flex items-center justify-center">
        <CosmicBackground coverImages={[]} />
        <div className="relative z-10 text-center">
          <p className="text-white font-bold text-xl mb-2">Universe not found</p>
          <p className="text-zinc-500 text-sm mb-6">This universe may be private or doesn't exist</p>
          <Button onClick={() => setLocation("/")} variant="outline" className="border-white/10 text-zinc-300">
            <ArrowLeft className="w-4 h-4 mr-2" />Go Home
          </Button>
        </div>
      </div>
    );
  }

  const { settings, artists, discography, owner } = data;
  const isOwner = isAuthenticated && !!user && !!owner && Number(owner.id) === Number(user.id);
  const coverImages = artists
    .map((a) => a.coverImage || a.profileImage)
    .filter(Boolean) as string[];

  const pageTitle = settings.title || (owner?.artistName ? `${owner.artistName}'s Universe` : "My Universe");

  // Group songs by artist
  const songsByArtist: Record<number, SongEntry[]> = {};
  discography.forEach((s) => {
    if (!songsByArtist[s.userId]) songsByArtist[s.userId] = [];
    songsByArtist[s.userId].push(s);
  });

  const totalSongs = discography.length;
  const totalArtists = artists.length;

  return (
    <div className="min-h-screen bg-[#03010a] text-white overflow-x-hidden">
      <CosmicBackground coverImages={coverImages} />
      <FloatingParticles />

      {/* Floating nav bar */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="mx-auto max-w-5xl px-4 pt-3">
          <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-black/60 backdrop-blur-xl px-4 py-2.5 shadow-xl">
            <button onClick={() => setLocation("/")} className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-xs">
              <ArrowLeft className="w-3.5 h-3.5" />
              Boostify
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
                <Globe className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-bold text-white hidden sm:block">My Universe</span>
            </div>
            <button onClick={handleShare} className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors">
              {copied ? <><Check className="w-3.5 h-3.5 text-emerald-400" />Copied!</> : <><Share2 className="w-3.5 h-3.5" />Share</>}
            </button>
          </div>
        </div>
      </div>

      {/* Hero section */}
      <div ref={heroRef} className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-16">
        {/* Primary artist cover as cinematic backdrop */}
        {(() => {
          const heroImg = artists[0]?.coverImage || artists[0]?.profileImage;
          if (!heroImg) return null;
          return (
            <motion.div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1.8 }}
            >
              <div
                className="absolute inset-0 scale-110"
                style={{
                  backgroundImage: `url(${heroImg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center top",
                  filter: "blur(40px) saturate(1.4) brightness(0.25)",
                }}
              />
              {/* vignette */}
              <div className="absolute inset-0 bg-gradient-to-b from-[#03010a]/60 via-transparent to-[#03010a]/80" />
            </motion.div>
          );
        })()}

        <motion.div
          style={{ opacity: heroOpacity, scale: heroScale }}
          className="text-center max-w-4xl mx-auto"
        >
          {/* ── Cinematic Constellation Hero ─────────────────────────────── */}
          {(() => {
            const primaryArtist = artists[0];
            const heroImg = primaryArtist?.coverImage || primaryArtist?.profileImage;
            const orbitArtists = artists.slice(0, 8);
            const ORBIT_DURATION = 30; // seconds

            return (
              <div className="relative mx-auto mb-10" style={{ width: 320, height: 320 }}>
                {/* Outer radial glow */}
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(circle, rgba(168,85,247,0.30) 0%, rgba(217,70,239,0.14) 45%, transparent 72%)",
                    filter: "blur(8px)",
                  }}
                />

                {/* Orbit track (dashed ring) */}
                <div
                  className="absolute rounded-full border border-dashed border-fuchsia-500/20 pointer-events-none"
                  style={{ inset: 10 }}
                />

                {/* Orbiting artist avatars + counter-rotation to stay upright */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }}
                >
                  {orbitArtists.map((a, i) => {
                    const angle = (i / orbitArtists.length) * 2 * Math.PI;
                    const r = 140; // orbit radius
                    const cx = 160 + r * Math.cos(angle);
                    const cy = 160 + r * Math.sin(angle);
                    const img = a.coverImage || a.profileImage;
                    return (
                      <div
                        key={a.id}
                        className="absolute"
                        style={{ left: cx - 18, top: cy - 18, width: 36, height: 36 }}
                      >
                        <motion.div
                          className="w-full h-full rounded-full overflow-hidden ring-2 ring-fuchsia-500/70 shadow-lg shadow-fuchsia-900/60"
                          animate={{ rotate: -360 }}
                          transition={{ duration: ORBIT_DURATION, repeat: Infinity, ease: "linear" }}
                        >
                          {img ? (
                            <img
                              src={img}
                              alt={a.artistName || a.name || ""}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-violet-700 to-fuchsia-700 flex items-center justify-center">
                              <Music className="w-4 h-4 text-white/70" />
                            </div>
                          )}
                        </motion.div>
                      </div>
                    );
                  })}
                </motion.div>

                {/* Inner counter-rotating arc dots */}
                <motion.div
                  className="absolute"
                  style={{ inset: 26 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                >
                  {[0, 60, 120, 180, 240, 300].map((deg, i) => (
                    <div
                      key={i}
                      className="absolute w-1.5 h-1.5 rounded-full bg-violet-400/40"
                      style={{
                        top: `${50 + 48 * Math.sin((deg * Math.PI) / 180)}%`,
                        left: `${50 + 48 * Math.cos((deg * Math.PI) / 180)}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  ))}
                </motion.div>

                {/* Spinning conic gradient border */}
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  style={{
                    inset: 34,
                    background:
                      "conic-gradient(from 0deg, #7c3aed 0%, #c026d3 30%, #ec4899 60%, #a855f7 80%, #7c3aed 100%)",
                    padding: 3,
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="w-full h-full rounded-full bg-[#03010a]" />
                </motion.div>

                {/* Center image */}
                <div
                  className="absolute rounded-full overflow-hidden shadow-2xl shadow-fuchsia-900/60"
                  style={{ inset: 40 }}
                >
                  {heroImg ? (
                    <img
                      src={heroImg}
                      alt={primaryArtist?.artistName || primaryArtist?.name || "Artist"}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-violet-700 via-fuchsia-700 to-pink-700 flex items-center justify-center">
                      <Crown className="w-14 h-14 text-white/80" />
                    </div>
                  )}
                  {/* Soft inner glow */}
                  <div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    style={{ boxShadow: "inset 0 0 32px rgba(192,96,252,0.35)" }}
                  />
                </div>
              </div>
            );
          })()}

          {/* Featured artist name badge */}
          {(() => {
            const pa = artists[0];
            const paName = pa?.artistName || pa?.name;
            if (!paName) return null;
            return (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6 }}
                className="flex items-center justify-center gap-2 mb-4"
              >
                <span className="text-[11px] uppercase tracking-[0.22em] text-fuchsia-400/70 font-semibold">
                  Featured Artist
                </span>
                <span className="w-1 h-1 rounded-full bg-fuchsia-500/50" />
                <span className="text-sm font-bold text-white/90">{paName}</span>
              </motion.div>
            );
          })()}

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
            className="text-5xl sm:text-7xl font-black tracking-tighter mb-4"
            style={{
              background: "linear-gradient(135deg, #fff 20%, #c084fc 50%, #f472b6 80%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {pageTitle}
          </motion.h1>

          {settings.bio && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-lg text-zinc-400 max-w-2xl mx-auto leading-relaxed"
            >
              {settings.bio}
            </motion.p>
          )}

          {/* Stats pills */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-center gap-3 mt-6 flex-wrap"
          >
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-4 py-1.5 text-sm">
              <Crown className="w-3.5 h-3.5 text-fuchsia-400" />
              <span className="text-zinc-300 font-medium">{totalArtists} Artist{totalArtists !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-4 py-1.5 text-sm">
              <Music className="w-3.5 h-3.5 text-violet-400" />
              <span className="text-zinc-300 font-medium">{totalSongs} Track{totalSongs !== 1 ? "s" : ""}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/5 border border-white/8 rounded-full px-4 py-1.5 text-sm">
              <Star className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-zinc-300 font-medium">Powered by Boostify</span>
            </div>
          </motion.div>

          {/* Scroll cue */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-16 flex flex-col items-center gap-2"
          >
            <span className="text-xs text-zinc-600 uppercase tracking-widest">Explore</span>
            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
            >
              <ChevronDown className="w-5 h-5 text-zinc-600" />
            </motion.div>
          </motion.div>
        </motion.div>
      </div>

      {/* Artist filter tabs */}
      {artists.length > 1 && (
        <div className="relative z-10 sticky top-[68px] bg-[#03010a]/80 backdrop-blur-xl border-b border-white/5 py-3">
          <div className="max-w-5xl mx-auto px-4 flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveArtist(null)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all shrink-0 ${
                activeArtist === null
                  ? "bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300"
                  : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
              }`}
            >
              <Sparkles className="w-3 h-3" />
              All Artists
            </button>
            {artists.map((a) => (
              <button
                key={a.id}
                onClick={() => setActiveArtist(a.id === activeArtist ? null : a.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all shrink-0 ${
                  activeArtist === a.id
                    ? "bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                {a.profileImage && (
                  <img src={a.profileImage} alt={artistName(a)} className="w-4 h-4 rounded-full object-cover" />
                )}
                {artistName(a)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Artists grid */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-12">
        {artists.length === 0 ? (
          <div className="text-center py-24">
            <Crown className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg font-medium">No artists in this universe yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {artists
              .filter((a) => activeArtist === null || a.id === activeArtist)
              .map((artist, index) => (
                <ArtistCard
                  key={artist.id}
                  artist={artist}
                  songs={songsByArtist[artist.id] || []}
                  onSongPlay={handleSongPlay}
                  playingId={playingId}
                  index={index}
                />
              ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="relative z-10 border-t border-white/5 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center">
            <Globe className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-bold text-white">Boostify Music</span>
        </div>
        <p className="text-xs text-zinc-600">Create your own universe at boostifymusic.com</p>
      </div>

      {/* ── AI Bio Generator FAB (owner only) ─────────────────────────────── */}
      {isOwner && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14, delay: 1 }}
          onClick={() => { setBioPanel(true); setBioArtistId(owner?.id ?? null); setGeneratedBio(''); setEditableBio(''); }}
          className="fixed bottom-24 right-5 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl shadow-2xl shadow-fuchsia-900/60 text-sm font-semibold text-white"
          style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}
          title="AI Biography Generator"
        >
          <Wand2 className="w-4 h-4" />
          <span className="hidden sm:inline">AI Bio</span>
        </motion.button>
      )}

      {/* ── AI Bio Panel ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {bioPanel && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
              onClick={() => setBioPanel(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 22, stiffness: 260 }}
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-md flex flex-col border-l border-white/10 bg-[#0d0919]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3)" }}>
                    <Wand2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">AI Biography Generator</h2>
                    <p className="text-[10px] text-zinc-500">Uses your artist profile as context</p>
                  </div>
                </div>
                <button onClick={() => setBioPanel(false)} className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Form */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

                {/* Artist selector */}
                {artists.length > 1 && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Artist</label>
                    <div className="flex flex-wrap gap-2">
                      {artists.map((a) => (
                        <button
                          key={a.id}
                          onClick={() => setBioArtistId(a.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                            (bioArtistId ?? owner?.id) === a.id
                              ? "bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300"
                              : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                          }`}
                        >
                          {a.profileImage && <img src={a.profileImage} className="w-4 h-4 rounded-full object-cover" alt="" />}
                          {a.artistName || a.name || "Artist"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Current biography context */}
                {(() => {
                  const selectedArtist = artists.find(a => a.id === (bioArtistId ?? owner?.id)) || artists[0];
                  return selectedArtist?.biography ? (
                    <div className="rounded-xl border border-violet-500/20 bg-violet-600/5 p-3 space-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <BookOpen className="w-3 h-3 text-violet-400" />
                        <span className="text-[10px] font-semibold text-violet-400 uppercase tracking-wider">Profile biography (context)</span>
                      </div>
                      <p className="text-xs text-zinc-300 leading-relaxed line-clamp-4">{selectedArtist.biography}</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-3">
                      <p className="text-xs text-zinc-500">No biography on profile yet — AI will use genres, songs and name as context.</p>
                    </div>
                  );
                })()}

                {/* Tone */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Tone</label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'press_release', label: '📋 Press Release', desc: 'Professional, third-person' },
                      { value: 'casual',        label: '😊 Casual',        desc: 'Warm and friendly' },
                      { value: 'epic',          label: '🎭 Epic',          desc: 'Cinematic & poetic' },
                      { value: 'minimal',       label: '✂️ Minimal',       desc: 'Short and punchy' },
                      { value: 'social',        label: '📱 Social Media',  desc: 'For IG / Twitter bio' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBioTone(opt.value)}
                        className={`flex flex-col items-start p-2.5 rounded-xl border text-left transition-all ${
                          bioTone === opt.value
                            ? "border-fuchsia-500/60 bg-fuchsia-600/10 text-white"
                            : "border-white/8 bg-white/[0.02] text-zinc-400 hover:border-white/15 hover:text-zinc-300"
                        }`}
                      >
                        <span className="text-xs font-semibold">{opt.label}</span>
                        <span className="text-[10px] text-zinc-600 mt-0.5">{opt.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Language</label>
                  <div className="flex gap-2">
                    {[{ value: 'es', label: '🇪🇸 Español' }, { value: 'en', label: '🇺🇸 English' }, { value: 'pt', label: '🇧🇷 Português' }].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setBioLang(opt.value)}
                        className={`flex-1 py-2 rounded-xl border text-xs font-semibold transition-all ${
                          bioLang === opt.value
                            ? "border-fuchsia-500/60 bg-fuchsia-600/10 text-fuchsia-300"
                            : "border-white/8 bg-white/[0.02] text-zinc-500 hover:text-zinc-300"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate button */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => generateBioMutation.mutate()}
                  disabled={generateBioMutation.isPending}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
                  style={{ background: "linear-gradient(135deg, #7c3aed, #c026d3, #ec4899)" }}
                >
                  {generateBioMutation.isPending ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" />{generatedBio ? 'Regenerate' : 'Generate Biography'}</>
                  )}
                </motion.button>

                {generateBioMutation.isError && (
                  <p className="text-xs text-red-400 text-center">{(generateBioMutation.error as any)?.message || 'Generation failed. Try again.'}</p>
                )}

                {/* Generated bio preview + editor */}
                {editableBio && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Generated biography</span>
                      <button
                        onClick={async () => {
                          await navigator.clipboard.writeText(editableBio);
                          setBioCopied(true);
                          setTimeout(() => setBioCopied(false), 2000);
                        }}
                        className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-fuchsia-400 transition-colors"
                      >
                        {bioCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        {bioCopied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <textarea
                      value={editableBio}
                      onChange={(e) => setEditableBio(e.target.value)}
                      rows={6}
                      className="w-full rounded-xl border border-white/10 bg-white/[0.04] text-sm text-zinc-200 leading-relaxed p-3 resize-none focus:outline-none focus:border-fuchsia-500/50 transition-colors"
                      placeholder="Your generated biography..."
                    />
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={() => saveBioMutation.mutate(editableBio)}
                      disabled={saveBioMutation.isPending || !editableBio.trim()}
                      className="w-full py-3 rounded-2xl text-sm font-bold text-white disabled:opacity-60 transition-opacity"
                      style={{ background: "linear-gradient(135deg, #059669, #10b981)" }}
                    >
                      {saveBioMutation.isPending ? 'Saving...' : '✓ Apply to Universe'}
                    </motion.button>
                    {saveBioMutation.isError && (
                      <p className="text-xs text-red-400 text-center">Save failed. Try again.</p>
                    )}
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating now-playing bar */}
      <AnimatePresence>
        {playingId !== null && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", damping: 20 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-3"
          >
            <div className="max-w-2xl mx-auto rounded-2xl border border-white/10 bg-black/80 backdrop-blur-xl px-4 py-3 shadow-2xl shadow-black/60">
              {(() => {
                const song = discography.find((s) => s.id === playingId);
                if (!song) return null;
                return (
                  <MiniPlayer
                    song={song}
                    isPlaying
                    onToggle={() => handleSongPlay(song)}
                  />
                );
              })()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
