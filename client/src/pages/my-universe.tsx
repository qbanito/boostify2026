import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  if (s.includes(":")) return s;
  const n = parseFloat(s);
  if (isNaN(n)) return s;
  const m = Math.floor(n / 60);
  const sec = Math.floor(n % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

// ─── Background layers ────────────────────────────────────────────────────────

function CosmicBackground({ coverImages: _coverImages }: { coverImages: string[] }) {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" style={{ background: "radial-gradient(ellipse at 80% 0%, rgba(85, 49, 130, 0.18), transparent 45%), linear-gradient(180deg, #100c15 0%, #09080d 65%, #07070a 100%)" }} />
  );
}

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
        aria-label={`${isPlaying ? "Pause" : "Play"} ${song.title}`}
        className="w-11 h-11 rounded-full border border-white/25 bg-white/5 flex items-center justify-center hover:bg-violet-500 transition-colors shrink-0"
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

function ArtistCard({ artist, songs, onSongPlay, playingId, index }: {
  artist: ArtistEntry; songs: SongEntry[]; onSongPlay: (song: SongEntry) => void; playingId: number | null; index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<"discography" | "sessions">("discography");
  const visible = expanded ? songs : songs.slice(0, 4);
  const stories = songs.filter(song => song.description || song.lyrics);
  const cover = artist.coverImage || artist.profileImage;
  return (
    <motion.article initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35, delay: Math.min(index * 0.04, 0.2) }} className="grid gap-5 border-b border-white/10 py-7 sm:grid-cols-[160px_minmax(0,1fr)] lg:grid-cols-[190px_minmax(0,1fr)_minmax(280px,0.95fr)] lg:gap-7 lg:py-9">
      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-[#181522] sm:aspect-[4/5] lg:aspect-square">{cover ? <img src={cover} alt={artistName(artist)} loading="lazy" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-violet-950 to-[#17111e]"><Music className="h-9 w-9 text-white/35" /></div>}</div>
      <div className="min-w-0 sm:pr-2">
        <h3 className="font-serif text-3xl tracking-tight text-white sm:text-4xl">{artistName(artist)}</h3>
        {(artist.genres?.length || artist.country) ? <p className="mt-2 text-sm text-zinc-400">{[...(artist.genres || []).slice(0, 2), artist.country].filter(Boolean).join(' ? ')}</p> : null}
        {artist.biography && <p className="mt-4 line-clamp-3 text-sm leading-6 text-zinc-400">{artist.biography}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {artist.slug && <a href={`/artist/${artist.slug}`} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/25 px-4 text-sm font-medium text-white transition hover:border-violet-300 hover:bg-white/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-400">Visit profile <ChevronRight className="h-4 w-4" /></a>}
          {artist.spotifyUrl && <a href={artist.spotifyUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm text-zinc-400 hover:text-white">Spotify <ExternalLink className="h-3.5 w-3.5" /></a>}
        </div>
      </div>
      <div className="min-w-0 sm:col-span-2 lg:col-span-1">
        {songs.length > 0 ? <>
          <div role="tablist" aria-label={`${artistName(artist)} music`} className="flex rounded-xl border border-white/10 bg-white/[0.035] p-1">{([{ key: 'discography', label: 'Discography', count: songs.length }, { key: 'sessions', label: 'Sessions', count: stories.length }] as const).map(item => <button key={item.key} role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)} className={`min-h-10 flex-1 rounded-lg px-3 text-xs font-semibold transition ${tab === item.key ? 'bg-violet-500 text-white' : 'text-zinc-400 hover:text-white'}`}>{item.label} <span className="ml-1 opacity-70">{item.count}</span></button>)}</div>
          {tab === 'discography' ? <div className="mt-2">{visible.map(song => <div key={song.id} className={`border-b border-white/[0.06] px-1 py-2.5 ${playingId === song.id ? 'bg-violet-500/10' : ''}`}><MiniPlayer song={song} isPlaying={playingId === song.id} onToggle={() => onSongPlay(song)} /></div>)}{songs.length > 4 && <button onClick={() => setExpanded(v => !v)} className="mt-3 min-h-10 text-xs font-semibold text-violet-300 hover:text-white">{expanded ? 'Show less' : `Show ${songs.length - 4} more tracks`}</button>}</div> : <div className="mt-3 space-y-2">{stories.length ? stories.map(song => <SessionCard key={song.id} song={song} />) : <p className="py-6 text-sm text-zinc-500">No track stories available yet.</p>}</div>}
        </> : <p className="py-4 text-sm text-zinc-500">No tracks available yet.</p>}
      </div>
    </motion.article>
  );
}

export default function MyUniversePage() {
  const { userId } = useParams<{ userId: string }>();
  const [, setLocation] = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [playbackError, setPlaybackError] = useState("");
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
    setPlaybackError("");
    if (!song.audioUrl) {
      setPlayingId(null);
      setPlaybackError("This track is currently unavailable.");
      return;
    }
    const audio = new Audio(song.audioUrl);
    audioRef.current = audio;
    audio.onended = () => { if (audioRef.current === audio) setPlayingId(null); };
    audio.onerror = () => { if (audioRef.current === audio) { setPlayingId(null); setPlaybackError("This track could not be played. Please try again."); } };
    audio.play().then(() => { if (audioRef.current === audio) setPlayingId(song.id); }).catch(() => {
      if (audioRef.current === audio) { setPlayingId(null); setPlaybackError("This track could not be played. Please try again."); }
    });
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
    <div className="min-h-screen bg-[#0a0b0d] text-white overflow-x-hidden">
      <CosmicBackground coverImages={coverImages} />


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

      <section ref={heroRef} className="relative z-10 mx-auto grid max-w-6xl gap-8 px-5 pb-10 pt-28 sm:px-8 sm:pb-14 sm:pt-32 lg:min-h-[460px] lg:grid-cols-2 lg:items-center lg:gap-14">
        <div className="relative z-10 max-w-xl">
          <h1 className="font-serif text-5xl leading-[1.02] tracking-tight text-white sm:text-6xl lg:text-7xl">{pageTitle}</h1>
          {settings.bio && <p className="mt-5 max-w-lg text-base leading-7 text-zinc-400">{settings.bio}</p>}
          <div className="mt-7 flex items-center gap-7 text-sm text-zinc-400"><span><strong className="mr-1 font-serif text-2xl font-normal text-white">{totalArtists}</strong> Artist{totalArtists !== 1 ? 's' : ''}</span><span className="h-8 w-px bg-white/15" /><span><strong className="mr-1 font-serif text-2xl font-normal text-white">{totalSongs}</strong> Track{totalSongs !== 1 ? 's' : ''}</span></div>
          {artists.length > 0 && <a href="#universe-artists" className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-500 px-5 text-sm font-semibold text-white transition hover:bg-violet-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300">Explore artists <ChevronRight className="h-4 w-4" /></a>}
        </div>
        <div className="relative h-56 overflow-hidden rounded-2xl bg-[#17131e] sm:h-72 lg:h-96">
          {artists[0]?.coverImage || artists[0]?.profileImage ? <img src={artists[0].coverImage || artists[0].profileImage || ''} alt={artistName(artists[0])} className="h-full w-full object-cover object-center" /> : <div className="grid h-full place-items-center bg-gradient-to-br from-violet-950 to-[#17111e]"><Music className="h-12 w-12 text-white/25" /></div>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </div>
      </section>

      {/* Artist filter tabs */}
      {artists.length > 1 && (
        <div className="relative z-10 sticky top-[68px] bg-[#0a0b0d]/90 backdrop-blur-xl border-y border-white/10 py-3">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 flex gap-2 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveArtist(null)}
              className={`flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all shrink-0 ${
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
                className={`flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap border transition-all shrink-0 ${
                  activeArtist === a.id
                    ? "bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300"
                    : "border-white/10 text-zinc-500 hover:border-white/20 hover:text-zinc-300"
                }`}
              >
                {a.profileImage && (
                  <img src={a.profileImage} alt="" className="w-4 h-4 rounded-full object-cover" />
                )}
                {artistName(a)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Artists grid */}
      <div id="universe-artists" className="relative z-10 mx-auto max-w-6xl scroll-mt-32 px-5 pb-16 sm:px-8">
        {playbackError && <p role="alert" className="mt-5 rounded-xl border border-red-400/25 bg-red-950/40 px-4 py-3 text-sm text-red-100">{playbackError}</p>}
        {artists.length === 0 ? (
          <div className="text-center py-24">
            <Crown className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500 text-lg font-medium">No artists in this universe yet</p>
          </div>
        ) : (
          <div>
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
                          className={`flex min-h-11 items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
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
