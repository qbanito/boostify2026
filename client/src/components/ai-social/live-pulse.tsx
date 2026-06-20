/**
 * LivePulse — the "alive" layer of the Boostify social network.
 *
 * One unified, continuously-updating surface that ties together:
 *  - Boostify Radio "now playing"  → streaming
 *  - Autonomous agent activity      → posts / comments / likes / moods / collabs
 *  - Latest news headlines          → news
 *  - Live presence (online / listeners)
 *
 * Data comes from GET /api/ai-social/live-pulse (polled every 10s), but items
 * are revealed progressively (drip feed) so the rail feels continuous and alive
 * instead of dumping a batch every poll.
 */
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import { apiRequest } from '../../lib/queryClient';
import {
  Radio, Sparkles, MessageCircle, Heart, Zap, Users, Music, Globe,
  Newspaper, Play, Pause, Activity, Volume2, ChevronRight, Disc3,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface PulseItem {
  kind: string;
  icon: string;
  artistId: number | null;
  artistName: string;
  artistImage: string | null;
  slug: string | null;
  link: string;
  ts: number;
  text: string;
  detail?: string;
}
interface NowPlaying {
  songId: number;
  title: string;
  artistId: number;
  artistName: string;
  artistImage: string | null;
  coverArt: string | null;
  audioUrl: string;
  genre: string | null;
  slug: string | null;
  isPlaying: boolean;
  totalPlays: number;
  queueLength: number;
}
interface NewsItem {
  id: number; slug: string; title: string; summary?: string;
  coverImageUrl?: string; category?: string; link: string;
}
interface PulseResponse {
  success: boolean;
  pulse: PulseItem[];
  nowPlaying: NowPlaying | null;
  news: NewsItem[];
  stats: { activeArtists: number; postsToday: number; online: number; listeners: number; eventsInBuffer: number; serverTime: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ICONS: Record<string, React.ComponentType<any>> = {
  radio: Radio, sparkles: Sparkles, message: MessageCircle, heart: Heart,
  spark: Zap, users: Users, music: Music, globe: Globe, news: Newspaper,
};
const KIND_COLOR: Record<string, string> = {
  radio: 'text-orange-400 bg-orange-500/10',
  post: 'text-purple-400 bg-purple-500/10',
  song: 'text-pink-400 bg-pink-500/10',
  comment: 'text-blue-400 bg-blue-500/10',
  like: 'text-red-400 bg-red-500/10',
  mood: 'text-yellow-400 bg-yellow-500/10',
  relationship: 'text-emerald-400 bg-emerald-500/10',
  collab: 'text-emerald-400 bg-emerald-500/10',
  world: 'text-cyan-400 bg-cyan-500/10',
  news: 'text-amber-400 bg-amber-500/10',
};

function relTime(ts: number, nowMs: number): string {
  const s = Math.max(0, Math.floor((nowMs - ts) / 1000));
  if (s < 5) return 'now';
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
const itemKey = (p: PulseItem) => `${p.kind}:${p.artistId}:${p.text}:${p.ts}`;

// ─── Now Playing strip (streaming) ───────────────────────────────────────────
function NowPlayingStrip({ track, listeners }: { track: NowPlaying | null; listeners: number }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Stop audio when the track changes
  useEffect(() => {
    setPlaying(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.src = ''; }
  }, [track?.songId]);

  const toggle = useCallback(() => {
    if (!track?.audioUrl) return;
    let el = audioRef.current;
    if (!el) { el = new Audio(); audioRef.current = el; }
    if (playing) { el.pause(); setPlaying(false); return; }
    if (el.src !== track.audioUrl) el.src = track.audioUrl;
    setLoading(true);
    el.play().then(() => { setPlaying(true); setLoading(false); })
      .catch(() => { setPlaying(false); setLoading(false); });
    el.onended = () => setPlaying(false);
  }, [track, playing]);

  if (!track) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-gradient-to-r from-slate-900/80 to-slate-950/80 p-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10">
          <Disc3 className="h-6 w-6 text-orange-400/70" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80">Boostify Radio</p>
          <p className="text-xs text-white/40">Preparing the next live track…</p>
        </div>
        <Link href="/streaming">
          <button className="rounded-lg border border-orange-500/30 px-3 py-1.5 text-xs text-orange-300 hover:bg-orange-500/10">
            Open streaming
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-orange-500/25 bg-gradient-to-r from-orange-950/40 via-slate-950 to-purple-950/40 p-3">
      <div className="absolute inset-0 pointer-events-none opacity-30">
        <motion.div
          className="absolute -left-10 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full bg-orange-500/30 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 4, repeat: Infinity }}
        />
      </div>
      <div className="relative flex items-center gap-3">
        <button onClick={toggle} className="group relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          {track.coverArt ? (
            <img src={track.coverArt} alt={track.title} className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-purple-600" />
          )}
          <div className="absolute inset-0 bg-black/40 transition group-hover:bg-black/55" />
          <span className="relative text-white">
            {loading ? <Activity className="h-6 w-6 animate-spin" />
              : playing ? <Pause className="h-6 w-6 fill-current" />
              : <Play className="h-6 w-6 fill-current" />}
          </span>
        </button>

        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-orange-300">
              <Radio className="h-3 w-3" /> Live
            </span>
            {/* animated equalizer */}
            <span className="flex items-end gap-0.5 h-3">
              {[0, 1, 2, 3].map((i) => (
                <motion.span key={i} className="w-0.5 rounded-full bg-orange-400"
                  animate={{ height: playing ? ['30%', '100%', '50%', '90%', '30%'] : '30%' }}
                  transition={{ duration: 0.9 + i * 0.12, repeat: Infinity, repeatType: 'reverse' }}
                  style={{ height: '30%' }} />
              ))}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-white">{track.title}</p>
          <Link href={track.slug ? `/artist/${track.slug}` : '/streaming'}>
            <p className="truncate text-xs text-white/60 hover:text-orange-300">{track.artistName}{track.genre ? ` · ${track.genre}` : ''}</p>
          </Link>
        </div>

        <div className="hidden sm:flex flex-col items-end gap-1 pr-1">
          <span className="flex items-center gap-1 text-xs text-white/70">
            <Volume2 className="h-3.5 w-3.5 text-orange-400" />
            {listeners.toLocaleString()} listening
          </span>
          <Link href="/streaming">
            <span className="flex items-center gap-0.5 text-[11px] text-orange-300/80 hover:text-orange-200">
              Open radio <ChevronRight className="h-3 w-3" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─── News ticker (news) ──────────────────────────────────────────────────────
function NewsTicker({ news }: { news: NewsItem[] }) {
  if (!news.length) return null;
  const loop = [...news, ...news];
  return (
    <div className="relative flex items-center gap-2 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-950/20 py-2 pl-3">
      <span className="z-10 flex shrink-0 items-center gap-1 rounded-md bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
        <Newspaper className="h-3 w-3" /> News
      </span>
      <div className="relative flex-1 overflow-hidden">
        <motion.div
          className="flex items-center gap-8 whitespace-nowrap"
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: Math.max(24, news.length * 8), repeat: Infinity, ease: 'linear' }}
        >
          {loop.map((n, i) => (
            <Link key={`${n.id}-${i}`} href={n.link}>
              <span className="cursor-pointer text-xs text-amber-100/80 hover:text-amber-200">
                <span className="mr-1 text-amber-400">●</span>{n.title}
              </span>
            </Link>
          ))}
        </motion.div>
      </div>
    </div>
  );
}

// ─── Live activity rail ──────────────────────────────────────────────────────
function ActivityRow({ item, nowMs }: { item: PulseItem; nowMs: number }) {
  const Icon = ICONS[item.icon] || Sparkles;
  const color = KIND_COLOR[item.kind] || 'text-purple-400 bg-purple-500/10';
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -12, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
      className="flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.06]"
    >
      <div className="relative shrink-0">
        {item.artistImage ? (
          <img src={item.artistImage} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${color}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <span className={`absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full ring-2 ring-slate-950 ${color}`}>
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>
      <Link href={item.link} className="min-w-0 flex-1">
        <p className="truncate text-sm text-white/90">{item.text}</p>
        {item.detail && <p className="truncate text-xs text-white/40">{item.detail}</p>}
      </Link>
      <span className="shrink-0 text-[11px] tabular-nums text-white/35">{relTime(item.ts, nowMs)}</span>
    </motion.div>
  );
}

export function LivePulse() {
  const { data } = useQuery({
    queryKey: ['ai-social-live-pulse'],
    queryFn: async () => {
      const r = await apiRequest({ url: '/api/ai-social/live-pulse?limit=40', method: 'GET' });
      return r as PulseResponse;
    },
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
  });

  // Drip-feed reveal: keep a queue of not-yet-shown items, surface one at a time.
  const [visible, setVisible] = useState<PulseItem[]>([]);
  const queueRef = useRef<PulseItem[]>([]);
  const seenRef = useRef<Set<string>>(new Set());
  const [nowMs, setNowMs] = useState(Date.now());

  // Tick the clock every second for live relative timestamps
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // When new data arrives, enqueue items we haven't shown yet
  useEffect(() => {
    if (!data?.pulse) return;
    const fresh = data.pulse.filter((p) => !seenRef.current.has(itemKey(p)));
    if (fresh.length === 0) return;
    // On first load, reveal a handful immediately so it isn't empty
    if (visible.length === 0 && queueRef.current.length === 0) {
      const initial = fresh.slice(0, 6);
      initial.forEach((p) => seenRef.current.add(itemKey(p)));
      setVisible(initial);
      queueRef.current = fresh.slice(6);
    } else {
      queueRef.current = [...fresh, ...queueRef.current];
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drip one queued item into the visible list every ~1.8s
  useEffect(() => {
    const t = setInterval(() => {
      const next = queueRef.current.shift();
      if (!next) return;
      const k = itemKey(next);
      if (seenRef.current.has(k)) return;
      seenRef.current.add(k);
      setVisible((prev) => [next, ...prev].slice(0, 24));
    }, 1800);
    return () => clearInterval(t);
  }, []);

  const stats = data?.stats;

  return (
    <div className="rounded-3xl border border-purple-500/20 bg-gradient-to-b from-slate-900/60 to-slate-950/80 p-4 space-y-3">
      {/* header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
          </span>
          <h3 className="text-sm font-bold text-white">Live Pulse</h3>
        </div>
        {stats && (
          <div className="flex items-center gap-3 text-[11px] text-white/50">
            <span className="flex items-center gap-1"><Users className="h-3 w-3 text-green-400" />{stats.online.toLocaleString()} online</span>
            <span className="hidden sm:flex items-center gap-1"><Sparkles className="h-3 w-3 text-purple-400" />{stats.postsToday} today</span>
          </div>
        )}
      </div>

      {/* now playing — streaming */}
      <NowPlayingStrip track={data?.nowPlaying || null} listeners={stats?.listeners || 0} />

      {/* news ticker — news */}
      <NewsTicker news={data?.news || []} />

      {/* live activity rail */}
      <div className="space-y-1.5">
        <AnimatePresence initial={false}>
          {visible.map((item) => (
            <ActivityRow key={itemKey(item)} item={item} nowMs={nowMs} />
          ))}
        </AnimatePresence>
        {visible.length === 0 && (
          <div className="py-8 text-center text-sm text-white/40">
            <Activity className="mx-auto mb-2 h-6 w-6 animate-pulse text-purple-400" />
            Tuning into the network…
          </div>
        )}
      </div>
    </div>
  );
}

export default LivePulse;
