import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Mic, Play, Pause, Download, Upload, Youtube,
  Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Sparkles, Settings, Eye, RefreshCw, X, Wand2, Palette,
  Image as ImageIcon, Trash2, TrendingUp,
} from 'lucide-react';
import { LyricsVideoComposition } from '../../../../remotion/LyricsVideoComposition';
import type { LyricsVideoProps, LyricsSegment } from '../../../../remotion/LyricsVideoComposition';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Song {
  id: number;
  title: string;
  audioUrl: string;
  coverArt?: string;
}

interface TranscribeResponse {
  jobId: number;
  text: string;
  language: string;
  duration: number;
  segments: LyricsSegment[];
  words: Array<{ word: string; start: number; end: number }>;
}

interface RenderStatus {
  id: number;
  status: 'pending' | 'transcribed' | 'rendering' | 'done' | 'failed';
  progress: number;
  output_url?: string;
  youtube_url?: string;
  error_msg?: string;
  log?: string;
  song_title?: string;
  artist_name?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme presets
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_PRESETS = [
  { name: 'Purple', color: '#7c3aed' },
  { name: 'Cyan', color: '#06b6d4' },
  { name: 'Gold', color: '#f59e0b' },
  { name: 'Rose', color: '#f43f5e' },
  { name: 'Lime', color: '#84cc16' },
  { name: 'Sky', color: '#38bdf8' },
  { name: 'White', color: '#f8fafc' },
  { name: 'Coral', color: '#fb923c' },
];

const FONT_OPTIONS = [
  { label: 'Inter', value: 'Inter' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Bebas Neue', value: 'Bebas Neue' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Syne', value: 'Syne' },
  { label: 'Josefin Sans', value: 'Josefin Sans' },
];

// Estilos de letra modernos para el video lírico (mapeados a presets de
// tipografía + animación en remotion/lyric-fonts.ts).
const LYRIC_STYLE_OPTIONS = [
  { value: 'auto', label: 'Auto (por género)', desc: 'Elige el estilo ideal según tu música', emoji: '✨' },
  { value: 'glow', label: 'Glow', desc: 'Moderno y luminoso (Outfit)', emoji: '🌟' },
  { value: 'kinetic', label: 'Kinetic', desc: 'Dinámico palabra a palabra (Sora)', emoji: '⚡' },
  { value: 'neon', label: 'Neon Club', desc: 'Impacto electrónico (Unbounded)', emoji: '🔮' },
  { value: 'elegant', label: 'Elegante', desc: 'Serif refinada (Playfair)', emoji: '🕊️' },
  { value: 'bold', label: 'Bold Urbano', desc: 'Fuerte tipo trap/rap (Anton)', emoji: '🔥' },
  { value: 'clean', label: 'Clean', desc: 'Minimalista nítido (Montserrat)', emoji: '◻️' },
] as const;

type LyricStyleValue = (typeof LYRIC_STYLE_OPTIONS)[number]['value'];


// Safe JSON — the dev server restarts (tsx watch) and proxies (502/504) can
// return an EMPTY or non-JSON body. A raw res.json() then throws the cryptic
// "Unexpected end of JSON input". Read the text first and parse defensively.
async function readJsonSafe<T = any>(res: Response): Promise<T | null> {
  let text: string;
  try { text = await res.text(); } catch { return null; }
  if (!text || !text.trim()) return null;
  try { return JSON.parse(text) as T; } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Staged upload progress — the YouTube publish pipeline runs SEO → thumbnail →
// upload → finalize sequentially in one request, so we animate descriptive
// stages on a timer and snap to 100% on success.
// ─────────────────────────────────────────────────────────────────────────────

const UPLOAD_STAGES = [
  { label: 'Preparing your track', target: 12 },
  { label: 'Writing competitive SEO with AI', target: 38 },
  { label: 'Designing your AI thumbnail', target: 64 },
  { label: 'Uploading to YouTube', target: 88 },
  { label: 'Setting thumbnail & finishing', target: 96 },
];

const StagedUploadProgress: React.FC<{ active: boolean; done?: boolean }> = ({ active, done }) => {
  const [pct, setPct] = useState(0);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (done) { setPct(100); return; }
    if (!active) { setPct(0); setStage(0); return; }
    let p = 0;
    let s = 0;
    setPct(0);
    setStage(0);
    const id = setInterval(() => {
      const target = UPLOAD_STAGES[s]?.target ?? 96;
      p = Math.min(p + Math.random() * 3 + 0.6, target);
      setPct(Math.round(p));
      if (p >= target && s < UPLOAD_STAGES.length - 1) { s += 1; setStage(s); }
    }, 320);
    return () => clearInterval(id);
  }, [active, done]);

  const label = done ? 'Published to YouTube 🎉' : (UPLOAD_STAGES[stage]?.label ?? 'Working…');
  const shown = done ? 100 : pct;

  return (
    <div className="space-y-2 rounded-xl bg-black/30 border border-white/10 p-3">
      <div className="flex items-center gap-2 text-xs">
        {done
          ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          : <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-400" />}
        <span className={done ? 'text-emerald-300 font-medium' : 'text-zinc-100 font-medium'}>{label}</span>
        <span className="ml-auto font-mono text-zinc-400">{shown}%</span>
      </div>
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className={`h-full rounded-full ${done
            ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
            : 'bg-gradient-to-r from-rose-600 via-red-500 to-orange-400'}`}
          animate={{ width: `${shown}%` }}
          transition={{ duration: 0.4 }}
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Hook: poll render status
// ─────────────────────────────────────────────────────────────────────────────

function useRenderStatus(jobId: number | null, enabled: boolean) {
  return useQuery<RenderStatus>({
    queryKey: ['lyricsVideoStatus', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/lyrics-video/${jobId}/status`);
      const data = await readJsonSafe<RenderStatus>(res);
      // Empty/non-JSON body or non-200 = server momentarily down (restart) —
      // throw so React Query keeps the last data and retries on the interval.
      if (!res.ok || !data) throw new Error('Status temporarily unavailable');
      return data;
    },
    enabled: !!jobId && enabled,
    // TanStack Query v5: refetchInterval callback receives the Query object.
    // Access the actual render-job status via query.state.data.status.
    refetchInterval: (query) => {
      const jobStatus = (query as any)?.state?.data?.status as string | undefined;
      if (jobStatus === 'done' || jobStatus === 'failed') return false;
      return 2000; // Keep polling every 2s for any non-terminal state
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = ['Configure', 'Preview', 'Render & Export'];

const StepIndicator: React.FC<{ current: number }> = ({ current }) => (
  <div className="flex items-center gap-2 mb-8">
    {STEPS.map((label, i) => (
      <React.Fragment key={i}>
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i < current
                ? 'bg-violet-600 text-white'
                : i === current
                ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-2 ring-offset-zinc-900'
                : 'bg-zinc-700 text-zinc-400'
            }`}
          >
            {i < current ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
          </div>
          <span
            className={`text-sm font-medium ${
              i === current ? 'text-white' : i < current ? 'text-violet-400' : 'text-zinc-500'
            }`}
          >
            {label}
          </span>
        </div>
        {i < STEPS.length - 1 && (
          <div className={`flex-1 h-px mx-1 ${i < current ? 'bg-violet-600' : 'bg-zinc-700'}`} />
        )}
      </React.Fragment>
    ))}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Step 1 — Configure
// ─────────────────────────────────────────────────────────────────────────────

interface Step1Props {
  songs: Song[];
  artistId?: number;
  artistName?: string;
  onDone: (data: TranscribeResponse & { songTitle: string; artistName: string; coverArtUrl?: string }) => void;
}

const Step1Configure: React.FC<Step1Props> = ({ songs, artistId, artistName: artistNameProp, onDone }) => {
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);

  const selectedSong = songs.find(s => s.id === selectedSongId);
  // Artist name comes from the artist profile, cover art from the selected
  // song — the user no longer types these by hand.
  const resolvedArtistName = (artistNameProp || '').trim() || 'Artist';
  const resolvedCover = selectedSong?.coverArt;

  const transcribeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSong) throw new Error('Select a song first');
      const res = await fetch('/api/lyrics-video/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          audioUrl: selectedSong.audioUrl,
          songId: selectedSong.id,
          songTitle: selectedSong.title,
          artistName: resolvedArtistName,
          coverArtUrl: resolvedCover || undefined,
          artistId: artistId ?? undefined,
        }),
      });
      const data = await readJsonSafe<any>(res);
      if (!res.ok) {
        throw new Error(
          data?.error ?? (res.status >= 500
            ? 'The server is busy or just restarted. Wait a few seconds and try again.'
            : 'Transcription failed'),
        );
      }
      if (!data) throw new Error('Empty server response (likely a restart). Please try again.');
      return data as TranscribeResponse;
    },
    onSuccess: (data) => {
      onDone({
        ...data,
        songTitle: selectedSong!.title,
        artistName: resolvedArtistName,
        coverArtUrl: resolvedCover,
      });
    },
  });

  return (
    <div className="space-y-6">
      {/* Song selector */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Select Song</label>
        <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
          {songs.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedSongId(s.id)}
              className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                selectedSongId === s.id
                  ? 'bg-violet-600/30 border border-violet-500'
                  : 'bg-zinc-800/60 border border-zinc-700 hover:border-zinc-500'
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-700 flex-shrink-0 overflow-hidden">
                {s.coverArt ? (
                  <img src={s.coverArt} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Music className="w-5 h-5 m-2.5 text-zinc-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{s.title}</div>
              </div>
              {selectedSongId === s.id && <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-derived metadata — artist name from the profile, cover from the song */}
      <div className="flex items-center gap-3 bg-zinc-800/40 border border-zinc-700 rounded-xl px-4 py-3">
        <div className="w-10 h-10 rounded-lg bg-zinc-700 flex-shrink-0 overflow-hidden">
          {resolvedCover ? (
            <img src={resolvedCover} alt="" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-5 h-5 m-2.5 text-zinc-400" />
          )}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white truncate">{resolvedArtistName}</div>
          <div className="text-[11px] text-zinc-500 truncate">
            {selectedSong ? 'Cover art taken from the selected song' : 'Select a song to use its cover art'}
          </div>
        </div>
      </div>

      {transcribeMutation.isError && (
        <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-xl px-4 py-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {(transcribeMutation.error as Error).message}
        </div>
      )}

      <button
        onClick={() => transcribeMutation.mutate()}
        disabled={!selectedSongId || transcribeMutation.isPending}
        className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3.5 transition-all"
      >
        {transcribeMutation.isPending ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Transcribing with Whisper AI...
          </>
        ) : (
          <>
            <Mic className="w-5 h-5" />
            Transcribe & Sync Lyrics
          </>
        )}
      </button>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 2 — Preview (Remotion Player + style controls)
// ─────────────────────────────────────────────────────────────────────────────

interface Step2Props {
  transcription: TranscribeResponse;
  songTitle: string;
  artistName: string;
  coverArtUrl?: string;
  onNext: (opts: StyleOptions) => void;
  onBack: () => void;
}

interface StyleOptions {
  theme: 'dark' | 'light' | 'gradient' | 'blur';
  accentColor: string;
  fontFamily: string;
  lyricStyle: LyricStyleValue;
  layout: 'center' | 'side';
  showProgressBar: boolean;
  showWatermark: boolean;
}

const Step2Preview: React.FC<Step2Props> = ({
  transcription,
  songTitle,
  artistName,
  coverArtUrl,
  onNext,
  onBack,
}) => {
  const [theme, setTheme] = useState<'dark' | 'light' | 'gradient' | 'blur'>('dark');
  const [accentColor, setAccentColor] = useState('#7c3aed');
  const [fontFamily, setFontFamily] = useState('Inter');
  const [lyricStyle, setLyricStyle] = useState<LyricStyleValue>('auto');
  const [layout, setLayout] = useState<'center' | 'side'>('center');
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [editingSegments, setEditingSegments] = useState<LyricsSegment[]>(transcription.segments);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const durationSecs = transcription.duration || 180;
  const durationFrames = Math.ceil(durationSecs * 30) + 30;

  // En el preview 'auto' no resuelve género (eso lo hace el server) → usamos
  // 'glow' como representación visual por defecto.
  const previewLyricStyle = lyricStyle === 'auto' ? 'glow' : lyricStyle;

  const compositionProps: LyricsVideoProps = {
    audioUrl: transcription.segments.length > 0 ? '' : '', // no audio in preview (CORS)
    coverArt: coverArtUrl,
    artistName,
    songTitle,
    segments: editingSegments,
    theme,
    accentColor,
    fontFamily,
    lyricStyle: previewLyricStyle,
    layout,
    showProgressBar,
    showWatermark,
    durationSecs,
  };

  // Inject Google Fonts for selected font
  useEffect(() => {
    const id = 'lv-preview-font';
    let link = document.getElementById(id) as HTMLLinkElement | null;
    if (!link) { link = document.createElement('link'); link.id = id; link.rel = 'stylesheet'; document.head.appendChild(link); }
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@400;500;700;800&display=swap`;
  }, [fontFamily]);

  return (
    <div className="space-y-6">
      {/* Remotion Player preview */}
      <div className="rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 shadow-2xl">
        <div className="bg-zinc-900 px-4 py-2 flex items-center gap-2 border-b border-zinc-800">
          <Eye className="w-4 h-4 text-violet-400" />
          <span className="text-xs font-medium text-zinc-300">Live Preview — 1920×1080</span>
        </div>
        <div style={{ width: '100%', aspectRatio: '16/9' }}>
          <Player
            ref={playerRef}
            component={LyricsVideoComposition as any}
            compositionWidth={1920}
            compositionHeight={1080}
            durationInFrames={durationFrames}
            fps={30}
            inputProps={compositionProps as any}
            style={{ width: '100%', height: '100%' }}
            controls
            clickToPlay
            loop
          />
        </div>
      </div>

      {/* Style controls */}
      <div className="grid grid-cols-2 gap-4">
        {/* Theme */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700">
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Theme</label>
          <div className="grid grid-cols-2 gap-2">
            {(['dark', 'gradient', 'blur', 'light'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`py-2 px-3 rounded-lg text-xs font-medium capitalize transition-all ${
                  theme === t ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Accent color */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700">
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Accent Color</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {ACCENT_PRESETS.map(p => (
              <button
                key={p.color}
                onClick={() => setAccentColor(p.color)}
                title={p.name}
                style={{ background: p.color }}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  accentColor === p.color ? 'border-white scale-110' : 'border-transparent hover:scale-105'
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)}
              className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
            <span className="text-xs text-zinc-400 font-mono">{accentColor}</span>
          </div>
        </div>

        {/* Font */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700">
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Font</label>
          <select
            value={fontFamily}
            onChange={e => setFontFamily(e.target.value)}
            className="w-full bg-zinc-700 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-violet-500"
          >
            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>

        {/* Estilo de letra (tipografía + animación modernas) */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700 md:col-span-2">
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">
            Estilo de letra ✨
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {LYRIC_STYLE_OPTIONS.map(s => (
              <button
                key={s.value}
                onClick={() => setLyricStyle(s.value)}
                className={`text-left rounded-lg px-3 py-2 border transition-all ${
                  lyricStyle === s.value
                    ? 'border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/50'
                    : 'border-zinc-600 bg-zinc-700/40 hover:border-zinc-500'
                }`}
              >
                <div className="text-sm font-semibold text-white flex items-center gap-1">
                  <span>{s.emoji}</span>{s.label}
                </div>
                <div className="text-[10px] text-zinc-400 leading-tight mt-0.5">{s.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Composición / layout */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700">
          <label className="block text-xs font-medium text-zinc-400 mb-3 uppercase tracking-wider">Composición</label>
          <div className="grid grid-cols-2 gap-2">
            {([
              { value: 'center', label: 'Centrado', desc: 'Letras grandes al centro' },
              { value: 'side', label: 'Clásico', desc: 'Portada + lista' },
            ] as const).map(l => (
              <button
                key={l.value}
                onClick={() => setLayout(l.value)}
                className={`text-left rounded-lg px-3 py-2 border transition-all ${
                  layout === l.value
                    ? 'border-violet-500 bg-violet-500/15 ring-1 ring-violet-500/50'
                    : 'border-zinc-600 bg-zinc-700/40 hover:border-zinc-500'
                }`}
              >
                <div className="text-sm font-semibold text-white">{l.label}</div>
                <div className="text-[10px] text-zinc-400 leading-tight mt-0.5">{l.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Toggles */}
        <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700 space-y-3">
          <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Options</label>
          {[
            { label: 'Progress Bar', value: showProgressBar, set: setShowProgressBar },
            { label: 'Watermark', value: showWatermark, set: setShowWatermark },
          ].map(({ label, value, set }) => (
            <label key={label} className="flex items-center justify-between cursor-pointer">
              <span className="text-sm text-zinc-300">{label}</span>
              <button
                onClick={() => set(!value)}
                className={`w-11 h-6 rounded-full transition-all ${value ? 'bg-violet-600' : 'bg-zinc-600'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white mx-1 transition-transform ${value ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {/* Lyrics editor toggle */}
      <button
        onClick={() => setShowLyricsEditor(!showLyricsEditor)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
      >
        <Settings className="w-4 h-4" />
        {showLyricsEditor ? 'Hide' : 'Edit'} Lyrics / Timestamps
        <ChevronRight className={`w-4 h-4 transition-transform ${showLyricsEditor ? 'rotate-90' : ''}`} />
      </button>

      <AnimatePresence>
        {showLyricsEditor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-zinc-800/60 rounded-xl p-4 border border-zinc-700 space-y-2 max-h-72 overflow-y-auto">
              <p className="text-xs text-zinc-500 mb-3">Edit text or adjust start/end times (seconds)</p>
              {editingSegments.map((seg, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    value={seg.start}
                    onChange={e => {
                      const next = [...editingSegments];
                      next[i] = { ...next[i], start: parseFloat(e.target.value) };
                      setEditingSegments(next);
                    }}
                    className="w-20 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                  />
                  <span className="text-zinc-500 text-xs">—</span>
                  <input
                    type="number"
                    step="0.1"
                    value={seg.end}
                    onChange={e => {
                      const next = [...editingSegments];
                      next[i] = { ...next[i], end: parseFloat(e.target.value) };
                      setEditingSegments(next);
                    }}
                    className="w-20 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                  />
                  <input
                    value={seg.text}
                    onChange={e => {
                      const next = [...editingSegments];
                      next[i] = { ...next[i], text: e.target.value };
                      setEditingSegments(next);
                    }}
                    className="flex-1 bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-xs text-white focus:outline-none"
                  />
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transcription info */}
      <div className="bg-zinc-800/40 rounded-xl p-4 border border-zinc-700 flex items-center gap-4 text-xs text-zinc-400">
        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
        <span>
          <span className="text-white font-medium">{editingSegments.length} lines</span> transcribed
          · Language: <span className="text-white font-medium">{transcription.language.toUpperCase()}</span>
          · Duration: <span className="text-white font-medium">{Math.round(durationSecs)}s</span>
          · Job ID: <span className="text-white font-mono">#{transcription.jobId}</span>
        </span>
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 transition-all text-sm">
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          onClick={() => onNext({ theme, accentColor, fontFamily, lyricStyle, layout, showProgressBar, showWatermark })}
          className="flex-1 flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold rounded-xl py-3 transition-all text-sm"
        >
          <Wand2 className="w-4 h-4" />
          Looks good — Render Video
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Step 3 — Render & Export
// ─────────────────────────────────────────────────────────────────────────────

interface Step3Props {
  jobId: number;
  styleOpts: StyleOptions;
  songTitle: string;
  artistName: string;
  onBack: () => void;
  onReset: () => void;
}

const Step3Render: React.FC<Step3Props> = ({ jobId, styleOpts, songTitle, artistName, onBack, onReset }) => {
  const [renderStarted, setRenderStarted] = useState(false);
  const [ytTitle, setYtTitle] = useState(`${songTitle} — ${artistName} (Lyrics Video)`);
  const [ytDesc, setYtDesc] = useState(`${songTitle} by ${artistName}\n\n#LyricsVideo #Music #Boostify`);
  const [ytPrivacy, setYtPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [accessToken, setAccessToken] = useState('');
  const [ytUploading, setYtUploading] = useState(false);
  const [ytError, setYtError] = useState('');

  // Tendencias de búsqueda reales (autocompletado de YouTube/Google) para este tema.
  const [trends, setTrends] = useState<string[]>([]);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [trendsLoaded, setTrendsLoaded] = useState(false);

  const fetchTrends = async () => {
    setTrendsLoading(true);
    try {
      const params = new URLSearchParams({ jobId: String(jobId), songTitle, artistName });
      const res = await fetch(`/api/lyrics-video/search-trends?${params.toString()}`, { credentials: 'include' });
      const data = await readJsonSafe<any>(res);
      setTrends(Array.isArray(data?.trends) ? data.trends : []);
    } catch {
      setTrends([]);
    } finally {
      setTrendsLoading(false);
      setTrendsLoaded(true);
    }
  };

  const addTrendKeyword = (kw: string) => {
    setYtDesc((prev) => (prev.toLowerCase().includes(kw.toLowerCase()) ? prev : `${prev} ${kw}`.trim()));
  };

  const queryClient = useQueryClient();
  const { data: status } = useRenderStatus(jobId, renderStarted);

  const renderMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lyrics-video/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ jobId, ...styleOpts }),
      });
      const data = await readJsonSafe<any>(res);
      if (!res.ok) {
        throw new Error(
          data?.error ?? (res.status >= 500
            ? 'The server is busy or just restarted. Wait a few seconds and retry the render.'
            : 'Render failed'),
        );
      }
      return data ?? { status: 'rendering' };
    },
    onSuccess: () => {
      setRenderStarted(true);
      queryClient.invalidateQueries({ queryKey: ['lyricsVideoStatus', jobId] });
    },
  });

  const uploadToYouTube = async () => {
    if (!accessToken) { setYtError('Paste your Google OAuth2 access token'); return; }
    setYtUploading(true);
    setYtError('');
    try {
      const res = await fetch(`/api/lyrics-video/${jobId}/upload-youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: ytTitle,
          description: ytDesc,
          tags: ['lyrics', 'music', 'karaoke', artistName],
          privacyStatus: ytPrivacy,
          accessToken,
        }),
      });
      const data = await readJsonSafe<any>(res);
      if (!res.ok) throw new Error(data?.error ?? 'Upload failed');
      queryClient.invalidateQueries({ queryKey: ['lyricsVideoStatus', jobId] });
    } catch (err: any) {
      setYtError(err.message);
    } finally {
      setYtUploading(false);
    }
  };

  const isRendering = status?.status === 'rendering' || renderMutation.isPending;
  const isDone = status?.status === 'done';
  const isFailed = status?.status === 'failed';
  const progress = status?.progress ?? 0;

  return (
    <div className="space-y-6">
      {/* Render trigger */}
      {!renderStarted && !renderMutation.isPending && (
        <div className="bg-zinc-800/60 rounded-2xl p-6 border border-zinc-700 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-violet-600/20 flex items-center justify-center mx-auto">
            <Wand2 className="w-8 h-8 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white mb-1">Ready to Render</h3>
            <p className="text-sm text-zinc-400">
              Remotion will render a full-quality 1920×1080 MP4 with your karaoke lyrics.
              Render time ≈ 1–3 min per minute of audio.
            </p>
          </div>
          {renderMutation.isError && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              {(renderMutation.error as Error).message}
            </div>
          )}
          <button
            onClick={() => renderMutation.mutate()}
            className="flex items-center gap-2 mx-auto bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl px-8 py-3.5 transition-all"
          >
            <Play className="w-5 h-5" />
            Start Render
          </button>
        </div>
      )}

      {/* Progress */}
      {(isRendering || renderMutation.isPending) && (
        <div className="bg-zinc-800/60 rounded-2xl p-6 border border-zinc-700 space-y-4">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
            <span className="text-white font-semibold">Rendering…</span>
            <span className="ml-auto text-violet-400 font-mono font-bold">{progress}%</span>
          </div>
          <div className="h-3 bg-zinc-700 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          {status?.log && (
            <p className="text-xs text-zinc-500 font-mono truncate">{status.log}</p>
          )}
        </div>
      )}

      {/* Done */}
      {isDone && (
        <div className="space-y-4">
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-6 text-center space-y-3">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Render Complete!</h3>
            {status?.youtube_url ? (
              <a href={status.youtube_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 justify-center text-red-400 hover:text-red-300 text-sm font-medium">
                <Youtube className="w-5 h-5" /> Watch on YouTube
              </a>
            ) : (
              <a
                href={status?.output_url ?? '#'}
                download={`${songTitle}-lyrics-video.mp4`}
                className="inline-flex items-center gap-2 bg-zinc-700 hover:bg-zinc-600 text-white font-semibold rounded-xl px-6 py-3 transition-all text-sm"
              >
                <Download className="w-4 h-4" /> Download MP4
              </a>
            )}
          </div>

          {/* YouTube upload panel */}
          {!status?.youtube_url && (
            <div className="bg-zinc-800/60 rounded-2xl p-5 border border-zinc-700 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Youtube className="w-5 h-5 text-red-400" />
                <h4 className="text-sm font-semibold text-white">Upload to YouTube</h4>
              </div>
              <p className="text-xs text-zinc-500">
                Requires a Google OAuth2 access token with <code>youtube.upload</code> scope.
                Sign in with Google in your browser's dev console, or use the OAuth Playground at
                <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer"
                  className="text-violet-400 ml-1">developers.google.com/oauthplayground</a>.
              </p>

              {/* Tendencias de búsqueda reales (YouTube/Google autocomplete) */}
              <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-700/70 space-y-2">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-semibold text-white">Tendencias de búsqueda</span>
                  <button
                    type="button"
                    onClick={fetchTrends}
                    disabled={trendsLoading}
                    className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                  >
                    {trendsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    {trendsLoaded ? 'Actualizar' : 'Detectar'}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  Lo que la gente busca ahora mismo en YouTube/Google. Toca una para añadirla a la descripción.
                </p>
                {trends.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {trends.map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => addTrendKeyword(t)}
                        className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-[11px] hover:bg-emerald-500/20 transition-colors"
                        title="Añadir a la descripción"
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                ) : trendsLoaded && !trendsLoading ? (
                  <p className="text-[11px] text-zinc-500">
                    Sin tendencias para este término todavía. Igual aplicamos keywords del género al publicar.
                  </p>
                ) : null}
              </div>

              <input value={ytTitle} onChange={e => setYtTitle(e.target.value)}
                placeholder="Video title"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
              <textarea value={ytDesc} onChange={e => setYtDesc(e.target.value)} rows={3}
                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500 resize-none" />
              <div className="flex gap-3">
                {(['public', 'unlisted', 'private'] as const).map(p => (
                  <button key={p} onClick={() => setYtPrivacy(p)}
                    className={`flex-1 py-2 rounded-lg text-xs font-medium capitalize transition-all ${
                      ytPrivacy === p ? 'bg-violet-600 text-white' : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                    }`}>{p}</button>
                ))}
              </div>
              <input value={accessToken} onChange={e => setAccessToken(e.target.value)}
                type="password"
                placeholder="Google OAuth2 access token"
                className="w-full bg-zinc-700 border border-zinc-600 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-violet-500" />
              {ytError && <p className="text-red-400 text-xs">{ytError}</p>}
              <button onClick={uploadToYouTube} disabled={ytUploading}
                className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-semibold rounded-xl py-3 transition-all text-sm">
                {ytUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {ytUploading ? 'Uploading to YouTube…' : 'Upload to YouTube'}
              </button>
              {ytUploading && <StagedUploadProgress active />}
            </div>
          )}

          <button onClick={onReset} className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors">
            <RefreshCw className="w-4 h-4" /> Create another video
          </button>
        </div>
      )}

      {/* Failed */}
      {isFailed && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span className="font-semibold">Render Failed</span>
          </div>
          <p className="text-sm text-zinc-400">{status?.error_msg ?? 'Unknown error'}</p>
          <div className="flex gap-3">
            <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 rounded-xl border border-zinc-700 text-zinc-300 hover:border-zinc-500 text-sm transition-all">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button onClick={() => renderMutation.mutate()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-all">
              <RefreshCw className="w-4 h-4" /> Retry Render
            </button>
          </div>
        </div>
      )}

      {!renderStarted && !renderMutation.isPending && (
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Preview
        </button>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Album Autopilot — genera lyric videos de TODO el álbum en 2do plano
// ─────────────────────────────────────────────────────────────────────────────

interface AlbumSongEntry {
  songId: number | string | null;
  title: string;
  audioUrl: string;
  coverArt?: string | null;
  status: 'pending' | 'transcribing' | 'rendering' | 'done' | 'failed';
  jobId?: number;
  outputUrl?: string;
  youtubeUrl?: string;
  uploadError?: string;
  error?: string;
}

interface YtConnection {
  connected: boolean;
  channelTitle?: string;
  thumbnailUrl?: string;
  canManageChannel?: boolean;
}

interface AlbumStatus {
  id: number;
  status: 'processing' | 'done' | 'failed';
  total_songs: number;
  completed_songs: number;
  songs_json: AlbumSongEntry[];
  email?: string;
  email_sent?: boolean;
}

const SONG_STATUS_META: Record<AlbumSongEntry['status'], { label: string; cls: string }> = {
  pending: { label: 'Queued', cls: 'text-zinc-500' },
  transcribing: { label: 'Transcribing…', cls: 'text-sky-400' },
  rendering: { label: 'Rendering…', cls: 'text-violet-400' },
  done: { label: 'Ready', cls: 'text-emerald-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
};

const AlbumAutopilot: React.FC<{ songs: Song[] }> = ({ songs }) => {
  const [albumId, setAlbumId] = useState<number | null>(null);
  const [autoUpload, setAutoUpload] = useState(true);
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const eligible = songs.filter((s) => !!s.audioUrl);
  const queryClient = useQueryClient();

  // Estado de conexión de YouTube del artista
  const { data: yt, refetch: refetchYt } = useQuery<YtConnection>({
    queryKey: ['ytConnection'],
    queryFn: async () => {
      const res = await fetch('/api/auth/youtube/connection');
      const data = await readJsonSafe<any>(res);
      const c = data?.connection;
      return {
        connected: !!data?.connected,
        channelTitle: c?.channelTitle,
        thumbnailUrl: c?.thumbnailUrl,
        canManageChannel: !!c?.canManageChannel,
      };
    },
    staleTime: 30_000,
  });

  const connectYoutube = async (switchAccount = false) => {
    try {
      const res = await fetch(`/api/auth/youtube/connect${switchAccount ? '?switch=1' : ''}`);
      const data = await readJsonSafe<{ authUrl?: string; error?: string }>(res);
      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'noopener');
      } else {
        alert(data?.error || 'Could not start the YouTube connection');
      }
    } catch { alert('Could not connect to YouTube'); }
  };

  // YouTube no permite CREAR canales por API: abrimos el conmutador de canales de
  // Google para que el artista cree uno nuevo y luego lo conecte aquí.
  const createNewChannel = () => {
    window.open('https://www.youtube.com/channel_switcher', '_blank', 'noopener');
  };

  const setupChannelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lyrics-video/youtube/setup-channel', { method: 'POST' });
      const data = await readJsonSafe<any>(res);
      if (!res.ok || !data) throw new Error(data?.error || 'Could not set up the channel');
      return data;
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => {
      if (!albumId) throw new Error('No album');
      const res = await fetch(`/api/lyrics-video/album/${albumId}/retry`, { method: 'POST' });
      const data = await readJsonSafe<{ success: boolean; retryCount?: number }>(res);
      if (!res.ok || !data?.success) throw new Error('Could not retry');
      return data;
    },
    onSuccess: () => {
      // Reabre el polling del estado (se había detenido al quedar 'failed').
      queryClient.invalidateQueries({ queryKey: ['lyricsAlbumStatus', albumId] });
    },
  });

  // Reconecta con un álbum en proceso al recargar la página
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/lyrics-video/albums');
        const data = await readJsonSafe<{ albums: AlbumStatus[] }>(res);
        if (cancelled || !data?.albums?.length) return;
        const active = data.albums.find((a) => a.status === 'processing');
        if (active) setAlbumId(active.id);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/lyrics-video/album/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          songs: eligible.map((s) => ({
            songId: s.id,
            title: s.title || 'Untitled',
            audioUrl: s.audioUrl,
            coverArt: s.coverArt || undefined,
          })),
          autoUpload: autoUpload && !!yt?.connected,
          privacyStatus: privacy,
        }),
      });
      const data = await readJsonSafe<{ albumId: number; totalSongs: number }>(res);
      if (!res.ok || !data) throw new Error('Could not start the album');
      return data;
    },
    onSuccess: (d) => setAlbumId(d.albumId),
  });

  const { data: album } = useQuery<AlbumStatus>({
    queryKey: ['lyricsAlbumStatus', albumId],
    queryFn: async () => {
      const res = await fetch(`/api/lyrics-video/album/${albumId}/status`);
      const data = await readJsonSafe<AlbumStatus>(res);
      if (!res.ok || !data) throw new Error('status unavailable');
      return data;
    },
    enabled: !!albumId,
    refetchInterval: (query) => {
      const st = (query as any)?.state?.data?.status as string | undefined;
      return st === 'done' || st === 'failed' ? false : 4000;
    },
  });

  const isRunning = album?.status === 'processing' || startMutation.isPending;
  const albumSongs: AlbumSongEntry[] = album?.songs_json ?? [];
  const completed = album?.completed_songs ?? 0;
  const total = album?.total_songs ?? eligible.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/10 via-fuchsia-600/5 to-transparent p-5 sm:p-6 mb-6 shadow-xl">
      <div className="pointer-events-none absolute -top-24 -right-16 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/20 ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
          <Wand2 className="w-5 h-5 text-violet-200" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-white">Full Album on Autopilot</h3>
          <p className="text-xs text-zinc-400">
            We generate lyric videos for every song in the background and email you the moment they're ready for YouTube.
          </p>
        </div>
        {!isRunning && (
          <button
            onClick={() => startMutation.mutate()}
            disabled={eligible.length === 0 || startMutation.isPending}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold flex items-center gap-2 flex-shrink-0 transition-all shadow-lg shadow-violet-900/30"
          >
            {startMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Generate Album ({eligible.length})
          </button>
        )}
      </div>

      {startMutation.isError && (
        <p className="mt-3 text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {(startMutation.error as Error)?.message || 'Failed to start'}
        </p>
      )}

      {/* ── YouTube: connection + auto-upload + channel branding ── */}
      <div className="relative mt-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Youtube className="w-4 h-4 text-red-500 flex-shrink-0" />
          {yt?.connected ? (
            <span className="text-xs text-zinc-300">
              Connected channel: <span className="font-semibold text-white">{yt.channelTitle || 'YouTube'}</span>
            </span>
          ) : (
            <span className="text-xs text-zinc-400">Connect your channel to upload videos automatically.</span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {!yt?.connected ? (
              <button onClick={() => connectYoutube(false)} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center gap-1.5">
                <Youtube className="w-3.5 h-3.5" /> Connect YouTube
              </button>
            ) : (
              <>
                <button onClick={() => refetchYt()} className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs" title="Refresh connection">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => connectYoutube(true)}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold flex items-center gap-1.5"
                  title="Connect or switch to another channel by choosing a different Google account"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Switch Channel
                </button>
                <button
                  onClick={() => setupChannelMutation.mutate()}
                  disabled={setupChannelMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-violet-600/80 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5"
                  title="Generate channel banner, description and keywords with AI"
                >
                  {setupChannelMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Palette className="w-3.5 h-3.5" />}
                  Set Up Channel
                </button>
              </>
            )}
          </div>
        </div>

        {/* Create a new channel (the YouTube API can't create one: we open YouTube) */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={createNewChannel}
            className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-zinc-200 text-[11px] font-medium flex items-center gap-1.5"
            title="Create a new channel on YouTube, then connect it with 'Switch Channel'"
          >
            <Youtube className="w-3 h-3" /> Create New Channel
          </button>
          <span className="text-[10px] text-zinc-500">
            Create the channel on YouTube and come back here to connect it with “Switch Channel”.
          </span>
        </div>

        {yt?.connected && (
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none">
              <input type="checkbox" checked={autoUpload} onChange={(e) => setAutoUpload(e.target.checked)} className="accent-violet-500 w-3.5 h-3.5" />
              Auto-upload to YouTube when each video finishes
            </label>
            {autoUpload && (
              <div className="flex items-center gap-1">
                {(['public', 'unlisted', 'private'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPrivacy(p)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${
                      privacy === p ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
                    }`}
                  >
                    {p === 'public' ? 'Public' : p === 'unlisted' ? 'Unlisted' : 'Private'}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {setupChannelMutation.isSuccess && (
          <p className="mt-2 text-[11px] text-emerald-400">
            {(setupChannelMutation.data as any)?.needsReconnect
              ? 'Reconnect YouTube to grant channel management permission.'
              : `Channel updated${(setupChannelMutation.data as any)?.bannerSet ? ' (new banner)' : ''}.`}
          </p>
        )}
        {setupChannelMutation.isError && (
          <p className="mt-2 text-[11px] text-red-400">{(setupChannelMutation.error as Error)?.message}</p>
        )}
      </div>

      {albumId && album && (
        <div className="relative mt-4">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-300 font-medium">
              {album.status === 'done'
                ? '✅ Album complete'
                : album.status === 'failed'
                ? '⚠️ Finished with errors'
                : `Processing… ${completed}/${total}`}
            </span>
            <span className="text-zinc-500">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all" style={{ width: `${pct}%` }} />
          </div>

          {album.status === 'done' && album.email_sent && (
            <p className="mt-2 text-[11px] text-emerald-400">
              We sent you a confirmation email{album.email ? ` to ${album.email}` : ''}.
            </p>
          )}

          {album.status !== 'processing' && albumSongs.some((s) => s.status === 'failed') && (
            <button
              onClick={() => retryMutation.mutate()}
              disabled={retryMutation.isPending}
              className="mt-3 px-3 py-1.5 rounded-lg bg-amber-600/90 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Retry only the songs that failed (e.g. due to an AWS limit)"
            >
              {retryMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              Retry Failed ({albumSongs.filter((s) => s.status === 'failed').length})
            </button>
          )}

          <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {albumSongs.map((s, i) => {
              const meta = SONG_STATUS_META[s.status];
              return (
                <div key={`${s.songId ?? i}-${i}`} className="flex items-center gap-2 text-xs">
                  {s.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                  ) : s.status === 'failed' ? (
                    <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                  ) : s.status === 'pending' ? (
                    <Music className="w-3.5 h-3.5 text-zinc-600 flex-shrink-0" />
                  ) : (
                    <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin flex-shrink-0" />
                  )}
                  <span className="text-zinc-300 truncate flex-1">{s.title}</span>
                  {s.youtubeUrl && (
                    <a href={s.youtubeUrl} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300" title="Watch on YouTube">
                      <Youtube className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {s.outputUrl && (
                    <a href={s.outputUrl} target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">
                      <Download className="w-3.5 h-3.5" />
                    </a>
                  )}
                  <span className={`flex-shrink-0 ${meta.cls}`}>{meta.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// My Videos — galería de lyric videos ya generados (vista del owner)
// ─────────────────────────────────────────────────────────────────────────────

interface MyVideoJob {
  id: number;
  status: string;
  output_url?: string;
  youtube_url?: string;
  song_title?: string;
  artist_name?: string;
  cover_art_url?: string;
  thumbnail_url?: string;
  created_at?: string;
}

const MyVideosGallery: React.FC<{ refreshKey?: number }> = ({ refreshKey }) => {
  const queryClient = useQueryClient();
  const [privacy, setPrivacy] = useState<'public' | 'unlisted' | 'private'>('public');
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string>('');
  const [uploadNotice, setUploadNotice] = useState<string>('');
  const [thumbingId, setThumbingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery<MyVideoJob[]>({
    queryKey: ['lyricsVideoMyJobs', refreshKey],
    queryFn: async () => {
      const res = await fetch('/api/lyrics-video/my-jobs');
      const json = await readJsonSafe<{ jobs: MyVideoJob[] }>(res);
      if (!res.ok || !json) return [];
      return json.jobs ?? [];
    },
    refetchInterval: 15_000,
  });

  // Estado de conexión de YouTube (se comparte por key con AlbumAutopilot).
  const { data: yt } = useQuery<YtConnection>({
    queryKey: ['ytConnection'],
    queryFn: async () => {
      const res = await fetch('/api/auth/youtube/connection');
      const d = await readJsonSafe<any>(res);
      const c = d?.connection;
      return {
        connected: !!d?.connected,
        channelTitle: c?.channelTitle,
        thumbnailUrl: c?.thumbnailUrl,
        canManageChannel: !!c?.canManageChannel,
      };
    },
    staleTime: 30_000,
  });

  const connectYoutube = async () => {
    try {
      const res = await fetch('/api/auth/youtube/connect');
      const d = await readJsonSafe<{ authUrl?: string; error?: string }>(res);
      if (d?.authUrl) window.open(d.authUrl, '_blank', 'noopener');
      else alert(d?.error || 'Could not connect to YouTube');
    } catch { alert('Could not connect to YouTube'); }
  };

  const uploadJob = async (jobId: number) => {
    setUploadingId(jobId);
    setUploadError('');
    setUploadNotice('');
    try {
      const res = await fetch(`/api/lyrics-video/${jobId}/upload-youtube`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        // auto:true → the server generates advanced SEO (GLM-5.2) + an AI thumbnail.
        body: JSON.stringify({ auto: true, generateThumbnail: true, privacyStatus: privacy }),
      });
      const d = await readJsonSafe<any>(res);
      if (!res.ok) {
        if (d?.needsConnect) { setUploadError('Connect your YouTube channel first.'); return; }
        throw new Error(d?.error || 'Could not upload the video');
      }
      // Non-blocking notice: custom thumbnails need a verified YouTube channel.
      if (d?.thumbnailSet === false) {
        setUploadNotice(
          /verif|enabled|forbidden/i.test(d?.thumbnailError || '')
            ? 'Video uploaded. The custom thumbnail needs a verified YouTube channel — verify at youtube.com/verify and re-upload.'
            : 'Video uploaded, but the custom thumbnail could not be set.',
        );
      }
      queryClient.invalidateQueries({ queryKey: ['lyricsVideoMyJobs'] });
    } catch (err: any) {
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setUploadingId(null);
    }
  };

  // Regenerate a cinematic poster thumbnail (Netflix-style, title + BOOSTIFY).
  const updateThumbnail = async (jobId: number) => {
    setThumbingId(jobId);
    setUploadError('');
    setUploadNotice('');
    try {
      const res = await fetch(`/api/lyrics-video/${jobId}/thumbnail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const d = await readJsonSafe<any>(res);
      if (!res.ok || !d?.thumbnailUrl) throw new Error(d?.error || 'Could not update the thumbnail');
      setUploadNotice('New cinematic thumbnail ready.');
      queryClient.invalidateQueries({ queryKey: ['lyricsVideoMyJobs'] });
    } catch (err: any) {
      setUploadError(err?.message || 'Thumbnail update failed');
    } finally {
      setThumbingId(null);
    }
  };

  // Delete a rendered video (DB row + storage cleanup).
  const deleteJob = async (jobId: number) => {
    if (!window.confirm('Delete this video permanently? This cannot be undone.')) return;
    setDeletingId(jobId);
    setUploadError('');
    setUploadNotice('');
    try {
      const res = await fetch(`/api/lyrics-video/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const d = await readJsonSafe<any>(res);
      if (!res.ok) throw new Error(d?.error || 'Could not delete the video');
      queryClient.invalidateQueries({ queryKey: ['lyricsVideoMyJobs'] });
    } catch (err: any) {
      setUploadError(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const done = (data ?? []).filter((j) => j.status === 'done' && j.output_url);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-zinc-500 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading your videos…
      </div>
    );
  }
  if (done.length === 0) return null;

  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-5 sm:p-6">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="w-8 h-8 rounded-xl bg-violet-500/20 ring-1 ring-white/10 flex items-center justify-center">
          <Music className="w-4 h-4 text-violet-300" />
        </div>
        <h3 className="text-base font-bold text-white">My Videos ({done.length})</h3>
        {/* Privacy selector for manual uploads */}
        <div className="ml-auto flex items-center gap-1">
          <Youtube className="w-3.5 h-3.5 text-red-500" />
          {(['public', 'unlisted', 'private'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPrivacy(p)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                privacy === p ? 'bg-violet-600 text-white' : 'bg-white/5 text-zinc-400 hover:bg-white/10'
              }`}
            >
              {p === 'public' ? 'Public' : p === 'unlisted' ? 'Unlisted' : 'Private'}
            </button>
          ))}
        </div>
      </div>
      {!yt?.connected && (
        <button
          onClick={connectYoutube}
          className="mb-3 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
        >
          <Youtube className="w-3.5 h-3.5" /> Connect YouTube to upload
        </button>
      )}
      {uploadError && (
        <p className="mb-3 text-xs text-red-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" /> {uploadError}
        </p>
      )}
      {uploadNotice && (
        <p className="mb-3 text-xs text-amber-400 flex items-start gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" /> {uploadNotice}
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {done.map((job) => (
          <div key={job.id} className="group rounded-2xl overflow-hidden bg-white/[0.04] border border-white/10 hover:border-violet-500/30 p-3 flex flex-col gap-2 transition-all">
            <div className="flex items-center gap-2 min-w-0">
              <Music className="w-3.5 h-3.5 text-violet-400 flex-shrink-0" />
              <span className="text-sm font-semibold text-white truncate">{job.song_title || 'Lyrics Video'}</span>
            </div>
            <video src={job.output_url} controls playsInline className="w-full rounded-lg max-h-52 bg-black" />
            {/* Cinematic YouTube thumbnail (Netflix-style poster) */}
            <div className="rounded-lg overflow-hidden border border-white/10 bg-black/40">
              <div className="flex items-center gap-1.5 px-2 py-1.5 text-[11px] text-zinc-400">
                <ImageIcon className="w-3 h-3 text-fuchsia-400" /> YouTube thumbnail
              </div>
              <div className="relative aspect-video bg-zinc-900">
                {(job.thumbnail_url || job.cover_art_url) ? (
                  <img
                    src={job.thumbnail_url || job.cover_art_url}
                    alt="thumbnail"
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-[11px]">
                    No thumbnail yet
                  </div>
                )}
                {thumbingId === job.id && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white text-xs gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating poster…
                  </div>
                )}
              </div>
              <button
                onClick={() => updateThumbnail(job.id)}
                disabled={thumbingId === job.id}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-fuchsia-200 bg-fuchsia-500/15 hover:bg-fuchsia-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                title="Generate a cinematic poster (title + BOOSTIFY) based on the lyrics"
              >
                {thumbingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                {thumbingId === job.id ? 'Generating…' : (job.thumbnail_url ? 'Update thumbnail' : 'Generate thumbnail')}
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <a href={job.output_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-violet-400 hover:text-violet-300">
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              {job.youtube_url ? (
                <a href={job.youtube_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-red-400 hover:text-red-300">
                  <Youtube className="w-3.5 h-3.5" /> On YouTube
                </a>
              ) : (
                <button
                  onClick={() => uploadJob(job.id)}
                  disabled={uploadingId === job.id || !yt?.connected}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold transition-colors"
                  title={yt?.connected ? 'Generate SEO + AI thumbnail and upload to your channel' : 'Connect your YouTube channel first'}
                >
                  {uploadingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {uploadingId === job.id ? 'Uploading…' : 'Upload to YouTube'}
                </button>
              )}
              <button
                onClick={() => deleteJob(job.id)}
                disabled={deletingId === job.id}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
                title="Delete this video"
              >
                {deletingId === job.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
            {uploadingId === job.id && (
              <StagedUploadProgress active />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Module
// ─────────────────────────────────────────────────────────────────────────────

interface LyricsVideoModuleProps {
  songs: Song[];
  artistId?: number;
  artistName?: string;
  isOwner?: boolean;
}

export const LyricsVideoModule: React.FC<LyricsVideoModuleProps> = ({ songs, artistId, artistName, isOwner = false }) => {
  const [step, setStep] = useState(0);
  const [transcription, setTranscription] = useState<TranscribeResponse | null>(null);
  const [songMeta, setSongMeta] = useState<{ songTitle: string; artistName: string; coverArtUrl?: string } | null>(null);
  const [styleOpts, setStyleOpts] = useState<StyleOptions | null>(null);

  // Fetch completed jobs for the public (visitor) view
  const { data: publicJobs } = useQuery<RenderStatus[]>({
    queryKey: ['lyricsVideoPublicJobs', artistId],
    queryFn: async () => {
      const res = await fetch(`/api/lyrics-video/public-videos?artistId=${artistId}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.jobs ?? [];
    },
    enabled: !isOwner && !!artistId,
    staleTime: 60_000,
  });

  const handleTranscribeDone = useCallback((data: TranscribeResponse & { songTitle: string; artistName: string; coverArtUrl?: string }) => {
    setTranscription(data);
    setSongMeta({ songTitle: data.songTitle, artistName: data.artistName, coverArtUrl: data.coverArtUrl });
    setStep(1);
  }, []);

  const handleStyleNext = useCallback((opts: StyleOptions) => {
    setStyleOpts(opts);
    setStep(2);
  }, []);

  const handleReset = useCallback(() => {
    setStep(0);
    setTranscription(null);
    setSongMeta(null);
    setStyleOpts(null);
  }, []);

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* ── Visitor (non-owner) view: show finished videos only ── */}
      {!isOwner && (
        <div className="space-y-4">
          {(!publicJobs || publicJobs.length === 0) ? (
            <div className="text-center py-10 text-zinc-500 text-sm">
              No lyrics videos yet.
            </div>
          ) : (
            publicJobs.map(job => (
              <div
                key={job.id}
                className="rounded-xl overflow-hidden bg-white/[0.03] border border-white/8 p-4 flex flex-col gap-3"
              >
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-violet-400 flex-shrink-0" />
                  <span className="text-sm font-semibold text-white">{job.song_title || 'Lyrics Video'}</span>
                  {job.artist_name && <span className="text-xs text-zinc-500">· {job.artist_name}</span>}
                </div>
                {job.output_url && (
                  <video
                    src={job.output_url}
                    controls
                    className="w-full rounded-lg max-h-64 bg-black"
                    playsInline
                  />
                )}
                {job.youtube_url && (
                  <a
                    href={job.youtube_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Youtube className="w-3.5 h-3.5" />
                    Watch on YouTube
                  </a>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── Owner view: full studio ── */}
      {isOwner && (
        <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-b from-zinc-900/80 via-zinc-950/90 to-black p-5 sm:p-7 shadow-2xl backdrop-blur">
          {/* ambient glows */}
          <div className="pointer-events-none absolute -top-32 -left-24 h-64 w-64 rounded-full bg-violet-600/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -right-24 h-64 w-64 rounded-full bg-fuchsia-600/10 blur-3xl" />

          {/* Header */}
          <div className="relative flex items-center gap-3.5 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Lyrics Video Studio</h2>
              <p className="text-sm text-zinc-400">AI transcription · Karaoke 1920×1080 · One-click YouTube publishing</p>
            </div>
          </div>

          <div className="relative">
            <AlbumAutopilot songs={songs} />

            <StepIndicator current={step} />

            <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step1Configure songs={songs} artistId={artistId} artistName={artistName} onDone={handleTranscribeDone} />
              </motion.div>
            )}
            {step === 1 && transcription && songMeta && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step2Preview
                  transcription={transcription}
                  songTitle={songMeta.songTitle}
                  artistName={songMeta.artistName}
                  coverArtUrl={songMeta.coverArtUrl}
                  onNext={handleStyleNext}
                  onBack={() => setStep(0)}
                />
              </motion.div>
            )}
            {step === 2 && transcription && songMeta && styleOpts && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step3Render
                  jobId={transcription.jobId}
                  styleOpts={styleOpts}
                  songTitle={songMeta.songTitle}
                  artistName={songMeta.artistName}
                  onBack={() => setStep(1)}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>

            <MyVideosGallery />
          </div>
        </div>
      )}
    </div>
  );
};

export default LyricsVideoModule;
