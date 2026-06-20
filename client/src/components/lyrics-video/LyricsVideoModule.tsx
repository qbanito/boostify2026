import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Mic, Play, Pause, Download, Upload, Youtube,
  Loader2, CheckCircle2, AlertCircle, ChevronRight, ChevronLeft,
  Sparkles, Settings, Eye, RefreshCw, X, Wand2, Palette,
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

// ─────────────────────────────────────────────────────────────────────────────
// Hook: poll render status
// ─────────────────────────────────────────────────────────────────────────────

function useRenderStatus(jobId: number | null, enabled: boolean) {
  return useQuery<RenderStatus>({
    queryKey: ['lyricsVideoStatus', jobId],
    queryFn: async () => {
      const res = await fetch(`/api/lyrics-video/${jobId}/status`);
      if (!res.ok) throw new Error('Status fetch failed');
      return res.json();
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
  onDone: (data: TranscribeResponse & { songTitle: string; artistName: string; coverArtUrl?: string }) => void;
}

const Step1Configure: React.FC<Step1Props> = ({ songs, artistId, onDone }) => {
  const [selectedSongId, setSelectedSongId] = useState<number | null>(null);
  const [artistName, setArtistName] = useState('');
  const [coverUrl, setCoverUrl] = useState('');

  const selectedSong = songs.find(s => s.id === selectedSongId);

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
          artistName: artistName || undefined,
          coverArtUrl: coverUrl || selectedSong.coverArt || undefined,
          artistId: artistId ?? undefined,
        }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Transcription failed'); }
      return res.json() as Promise<TranscribeResponse>;
    },
    onSuccess: (data) => {
      onDone({
        ...data,
        songTitle: selectedSong!.title,
        artistName: artistName || 'Artist',
        coverArtUrl: coverUrl || selectedSong!.coverArt,
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

      {/* Artist name */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Artist Name</label>
        <input
          value={artistName}
          onChange={e => setArtistName(e.target.value)}
          placeholder="Your artist name"
          className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Cover Art URL override */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">Cover Art URL <span className="text-zinc-500">(optional — uses song cover if blank)</span></label>
        <input
          value={coverUrl}
          onChange={e => setCoverUrl(e.target.value)}
          placeholder="https://..."
          className="w-full bg-zinc-800/60 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-violet-500"
        />
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
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showWatermark, setShowWatermark] = useState(true);
  const [editingSegments, setEditingSegments] = useState<LyricsSegment[]>(transcription.segments);
  const [showLyricsEditor, setShowLyricsEditor] = useState(false);
  const playerRef = useRef<PlayerRef>(null);

  const durationSecs = transcription.duration || 180;
  const durationFrames = Math.ceil(durationSecs * 30) + 30;

  const compositionProps: LyricsVideoProps = {
    audioUrl: transcription.segments.length > 0 ? '' : '', // no audio in preview (CORS)
    coverArt: coverArtUrl,
    artistName,
    songTitle,
    segments: editingSegments,
    theme,
    accentColor,
    fontFamily,
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
          onClick={() => onNext({ theme, accentColor, fontFamily, showProgressBar, showWatermark })}
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
      if (!res.ok) { const e = await res.json(); throw new Error(e.error ?? 'Render failed'); }
      return res.json();
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Upload failed');
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
// Main Module
// ─────────────────────────────────────────────────────────────────────────────

interface LyricsVideoModuleProps {
  songs: Song[];
  artistId?: number;
  isOwner?: boolean;
}

export const LyricsVideoModule: React.FC<LyricsVideoModuleProps> = ({ songs, artistId, isOwner = false }) => {
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
        <div>
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Lyrics Video Generator</h2>
              <p className="text-sm text-zinc-400">AI transcription · Karaoke 1920×1080 · YouTube ready</p>
            </div>
          </div>

          <StepIndicator current={step} />

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step1Configure songs={songs} artistId={artistId} onDone={handleTranscribeDone} />
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
        </div>
      )}
    </div>
  );
};

export default LyricsVideoModule;
