import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { apiRequest } from '@/lib/queryClient';
import { getAuthToken } from '@/lib/auth';
import { X, Maximize, Minimize, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Mic2, Loader2, Film, Youtube, Sparkles, Check, ExternalLink } from 'lucide-react';
import { useAudioPlayer } from '@/contexts/audio-player-context';
import { useKaraokeSync, type KaraokeLine } from '@/hooks/use-karaoke-sync';

interface Song {
  id: number | string;
  title: string;
  audioUrl: string;
  coverArt?: string;
  duration?: string;
  genre?: string;
}

interface KaraokePlayerProps {
  song: Song;
  artistName: string;
  artistProfileImage?: string;
  onClose: () => void;
  /** Pre-fetched lines from the module — skips the fetch and opens instantly. */
  initialLines?: KaraokeLine[];
}

export function KaraokePlayer({ song, artistName, artistProfileImage, onClose, initialLines }: KaraokePlayerProps) {
  const {
    isPlaying,
    isMuted,
    volume,
    progress,
    duration,
    currentTrack,
    playQueue,
    toggle,
    toggleMuted,
    setVolume,
    seek,
    next,
    prev,
  } = useAudioPlayer();

  const [lines, setLines] = useState<KaraokeLine[]>(initialLines ?? []);
  const [karaokeStatus, setKaraokeStatus] = useState<'idle' | 'loading' | 'ready' | 'generating' | 'failed'>(
    initialLines && initialLines.length > 0 ? 'ready' : 'loading'
  );
  const [isTrueFullscreen, setIsTrueFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // ── Lyric-video render + YouTube publishing state ──────────────────────────
  type VideoStage = 'idle' | 'creating' | 'rendering' | 'done' | 'error';
  const [videoPanelOpen, setVideoPanelOpen] = useState(false);
  const [videoStage, setVideoStage] = useState<VideoStage>('idle');
  const [videoProgress, setVideoProgress] = useState(0);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [videoJobId, setVideoJobId] = useState<number | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTheme, setVideoTheme] = useState<'blur' | 'dark' | 'gradient' | 'light'>('blur');
  const [ytConnected, setYtConnected] = useState(false);
  const [ytConfigured, setYtConfigured] = useState(false);
  const [ytChannel, setYtChannel] = useState<string>('');
  const [ytUploading, setYtUploading] = useState(false);
  const [ytUrl, setYtUrl] = useState<string | null>(null);
  const videoPollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const videoPollStopRef = useRef(false);


  const sync = useKaraokeSync(lines, progress);
  const isCurrentSong = currentTrack?.id === String(song.id);

  // ── Fetch karaoke data (skipped when initialLines are provided) ────────────────────
  useEffect(() => {
    if (initialLines && initialLines.length > 0) return; // already have data
    let cancelled = false;
    setKaraokeStatus('loading');

    apiRequest({ url: `/api/karaoke/${song.id}`, method: 'GET' })
      .then((data: any) => {
        if (cancelled) return;
        if (data.exists && data.karaoke?.status === 'ready' && data.karaoke?.syncedLyrics) {
          setLines(data.karaoke.syncedLyrics as KaraokeLine[]);
          setKaraokeStatus('ready');
        } else {
          setKaraokeStatus('idle');
        }
      })
      .catch(() => { if (!cancelled) setKaraokeStatus('idle'); });

    return () => { cancelled = true; };
  }, [song.id]);

  // ── Start playing this song if not already ────────────────────────────────
  useEffect(() => {
    if (!isCurrentSong) {
      playQueue([
        {
          id: String(song.id),
          title: song.title,
          artist: artistName,
          url: song.audioUrl,
          coverUrl: song.coverArt,
        },
      ], { startIndex: 0, autoplay: true });
    }
  }, [song.id]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); toggle(); }
      if (e.key === 'm') toggleMuted();
      if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 5));
      if (e.key === 'ArrowRight') seek(Math.min(duration, progress + 5));
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [toggle, toggleMuted, seek, progress, duration, onClose]);

  // ── Auto-scroll lyrics ────────────────────────────────────────────────────
  useEffect(() => {
    const idx = sync.currentLineIndex;
    if (idx < 0) return;
    const lineEl = lineRefs.current[idx];
    const container = lyricsContainerRef.current;
    if (!lineEl || !container) return;

    const lineTop = lineEl.offsetTop;
    const containerHeight = container.clientHeight;
    const lineHeight = lineEl.clientHeight;
    const target = lineTop - containerHeight / 2 + lineHeight / 2;

    container.scrollTo({ top: target, behavior: 'smooth' });
  }, [sync.currentLineIndex]);

  // ── Native fullscreen toggle ──────────────────────────────────────────────
  const toggleTrueFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsTrueFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsTrueFullscreen(false)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsTrueFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // ── Generate karaoke ──────────────────────────────────────────────────────
  const handleGenerate = async () => {
    setKaraokeStatus('generating');
    try {
      const token = await getAuthToken();
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
      const data: any = await apiRequest({ url: `/api/karaoke/${song.id}/generate`, method: 'POST', headers: authHeaders });
      if (data.success && data.karaoke?.syncedLyrics?.length > 0) {
        setLines(data.karaoke.syncedLyrics as KaraokeLine[]);
        setKaraokeStatus('ready');
      } else {
        setKaraokeStatus('failed');
      }
    } catch {
      setKaraokeStatus('failed');
    }
  };

  // ── Lyric video: helpers ───────────────────────────────────────────────────
  const authedRequest = useCallback(async (url: string, method: string, body?: any) => {
    const token = await getAuthToken();
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    return apiRequest({ url, method, headers, ...(body ? { body } : {}) });
  }, []);

  // Check the artist's YouTube connection status (configured + connected).
  const refreshYoutubeStatus = useCallback(async () => {
    try {
      const data: any = await authedRequest('/api/auth/youtube/connection', 'GET');
      setYtConfigured(!!data?.configured);
      setYtConnected(!!data?.connected);
      setYtChannel(data?.connection?.channelTitle || '');
    } catch {
      setYtConfigured(false);
      setYtConnected(false);
    }
  }, [authedRequest]);

  // Poll a render job until it finishes.
  const pollVideoJob = useCallback((jobId: number) => {
    // Self-scheduling poll: only fire the next request AFTER the previous one
    // resolves. setInterval would pile up requests when responses are slow,
    // saturating the server and blocking unrelated endpoints (e.g. karaoke).
    if (videoPollRef.current) clearTimeout(videoPollRef.current);
    videoPollStopRef.current = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 150; // ~7.5 min at 3s spacing — stop polling a stuck job

    const tick = async () => {
      if (videoPollStopRef.current) return;
      attempts += 1;
      try {
        const data: any = await authedRequest(`/api/lyrics-video/${jobId}/status`, 'GET');
        if (videoPollStopRef.current) return;
        if (typeof data?.progress === 'number') setVideoProgress(data.progress);
        if (data?.status === 'done' && data?.output_url) {
          videoPollStopRef.current = true;
          setVideoUrl(data.output_url);
          setVideoProgress(100);
          setVideoStage('done');
          return;
        } else if (data?.status === 'error' || data?.status === 'failed') {
          videoPollStopRef.current = true;
          setVideoError(data?.error_msg || 'Render failed.');
          setVideoStage('error');
          return;
        }
      } catch {
        /* transient — keep polling */
      }
      if (videoPollStopRef.current) return;
      if (attempts >= MAX_ATTEMPTS) {
        videoPollStopRef.current = true;
        setVideoError('Render timed out. Please try again.');
        setVideoStage('error');
        return;
      }
      videoPollRef.current = setTimeout(tick, 3000);
    };

    tick();
  }, [authedRequest]);

  // Create the lyric-video job from the synced karaoke lyrics, then render it.
  const handleCreateLyricVideo = useCallback(async () => {
    setVideoPanelOpen(true);
    setVideoError(null);
    setVideoUrl(null);
    setYtUrl(null);
    setVideoProgress(0);
    setVideoStage('creating');
    try {
      const created: any = await authedRequest(`/api/karaoke/${song.id}/create-lyric-video`, 'POST', {
        artistName,
        coverArt: song.coverArt,
        theme: videoTheme,
      });
      if (!created?.success || !created?.jobId) {
        throw new Error(created?.message || 'Could not create lyric video job.');
      }
      const jobId = created.jobId as number;
      setVideoJobId(jobId);
      setVideoStage('rendering');

      await authedRequest(`/api/lyrics-video/render`, 'POST', {
        jobId,
        theme: videoTheme,
        showWatermark: true,
      });
      pollVideoJob(jobId);
    } catch (err: any) {
      setVideoError(err?.message || 'Something went wrong.');
      setVideoStage('error');
    }
  }, [authedRequest, song.id, song.coverArt, artistName, videoTheme, pollVideoJob]);

  // Connect YouTube (opens Google consent in a new tab) or upload if connected.
  const handleYoutube = useCallback(async () => {
    if (!ytConnected) {
      try {
        const data: any = await authedRequest('/api/auth/youtube/connect', 'GET');
        if (data?.authUrl) {
          window.open(data.authUrl, '_blank', 'noopener,noreferrer');
        } else {
          setVideoError(data?.instructions || 'YouTube is not configured on the server.');
        }
      } catch (err: any) {
        setVideoError(err?.message || 'YouTube connect failed.');
      }
      return;
    }
    if (!videoJobId || videoStage !== 'done') return;
    setYtUploading(true);
    setVideoError(null);
    try {
      const data: any = await authedRequest(`/api/lyrics-video/${videoJobId}/upload-youtube`, 'POST', {
        title: `${song.title} — ${artistName} (Lyric Video)`,
        description: `${song.title} by ${artistName}. Lyric video created with Boostify.`,
        tags: [artistName, song.title, 'lyric video', 'karaoke'],
        privacyStatus: 'public',
      });
      if (data?.youtubeUrl) {
        setYtUrl(data.youtubeUrl);
      } else if (data?.needsConnect) {
        setYtConnected(false);
        setVideoError('Connect your YouTube channel first.');
      } else {
        setVideoError(data?.error || 'Upload failed.');
      }
    } catch (err: any) {
      setVideoError(err?.message || 'Upload failed.');
    } finally {
      setYtUploading(false);
    }
  }, [ytConnected, videoJobId, videoStage, authedRequest, song.title, artistName]);

  // Load YouTube status when the video panel opens; clean up poller on unmount.
  useEffect(() => {
    if (videoPanelOpen) refreshYoutubeStatus();
  }, [videoPanelOpen, refreshYoutubeStatus]);

  useEffect(() => {
    return () => { videoPollStopRef.current = true; if (videoPollRef.current) clearTimeout(videoPollRef.current); };
  }, []);

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const bgImage = artistProfileImage || song.coverArt;

  // ── Render a lyric line ────────────────────────────────────────────────────
  const renderLine = (lineIdx: number, variant: 'prev' | 'current' | 'next') => {
    const line = lines[lineIdx];
    if (!line) return null;

    const isCurrent = variant === 'current';
    const isNext = variant === 'next';

    if (isCurrent && line.words && line.words.length > 0) {
      return (
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1">
          {line.words.map((w, wi) => {
            const isPast = wi < sync.currentWordIndex;
            const isActiveWord = wi === sync.currentWordIndex;
            return (
              <motion.span
                key={wi}
                animate={isActiveWord ? { scale: 1.12, color: '#f0abfc' } : isPast ? { color: '#e9d5ff' } : { color: 'rgba(255,255,255,0.7)' }}
                transition={{ duration: 0.15 }}
                className="inline-block font-bold"
                style={{
                  textShadow: isActiveWord
                    ? '0 0 20px rgba(240,171,252,0.9), 0 0 40px rgba(168,85,247,0.7)'
                    : isPast
                    ? '0 0 10px rgba(233,213,255,0.4)'
                    : 'none',
                }}
              >
                {w.word}
              </motion.span>
            );
          })}
        </div>
      );
    }

    return (
      <span
        style={{
          color: isCurrent ? 'white' : isNext ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.3)',
          filter: isCurrent ? 'none' : 'blur(0.5px)',
          textShadow: isCurrent
            ? '0 0 30px rgba(255,255,255,0.6), 0 0 60px rgba(168,85,247,0.5)'
            : 'none',
        }}
      >
        {line.text}
      </span>
    );
  };

  // ── Portal overlay ─────────────────────────────────────────────────────────
  const overlay = (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="fixed inset-0 z-[200] flex flex-col select-none overflow-hidden"
      data-testid="karaoke-player"
    >
      {/* ── Background: blurred artist photo ────────────────────────────── */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        {bgImage ? (
          <>
            <img
              src={bgImage}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110"
              style={{ filter: 'blur(32px) brightness(0.35) saturate(1.4)' }}
              draggable={false}
            />
            {/* Radial vignette */}
            <div
              className="absolute inset-0"
              style={{ background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.65) 100%)' }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-[#06040f]" />
        )}
        {/* Animated gradient shimmer */}
        <motion.div
          className="absolute inset-0 opacity-20"
          animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'linear' }}
          style={{
            backgroundSize: '400% 400%',
            backgroundImage: 'linear-gradient(135deg, #7c3aed22, #db277722, #0ea5e922, #7c3aed22)',
          }}
        />
      </div>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 sm:px-6 pb-2"
        style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
      >
        {/* Artist info */}
        <div className="flex items-center gap-3 min-w-0">
          {artistProfileImage && (
            <img
              src={artistProfileImage}
              alt={artistName}
              className="w-9 h-9 rounded-full object-cover border-2 border-purple-400/40 flex-shrink-0"
            />
          )}
          <div className="min-w-0">
            <p className="text-white/50 text-xs uppercase tracking-widest">Now Singing</p>
            <p className="text-white font-semibold text-sm truncate leading-tight">{song.title}</p>
            <p className="text-purple-300 text-xs truncate">{artistName}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mic badge */}
          <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/20 border border-purple-500/30">
            <Mic2 className="w-3 h-3 text-purple-300" />
            <span className="text-purple-200 text-xs font-medium">Karaoke</span>
          </div>

          {/* Create lyric video — only when synced lyrics are ready */}
          {karaokeStatus === 'ready' && lines.length > 0 && (
            <button
              onClick={() => setVideoPanelOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold hover:opacity-90 transition-opacity"
              title="Create a lyric video and publish to YouTube"
            >
              <Film className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Lyric Video</span>
            </button>
          )}

          <button
            onClick={toggleTrueFullscreen}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title={isTrueFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isTrueFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── Lyrics area ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-12 overflow-hidden">
        {karaokeStatus === 'loading' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4">
            <Loader2 className="w-10 h-10 text-purple-400 animate-spin" />
            <p className="text-white/50 text-sm">Loading karaoke...</p>
          </motion.div>
        )}

        {karaokeStatus === 'generating' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
            <div className="relative">
              <Loader2 className="w-12 h-12 text-purple-400 animate-spin" />
              <Mic2 className="absolute inset-0 m-auto w-5 h-5 text-white" />
            </div>
            <p className="text-white font-semibold text-lg">Generating Karaoke</p>
            <p className="text-white/50 text-sm max-w-xs">
              AI is analyzing the audio and syncing lyrics. This takes 30–60 seconds and only happens once.
            </p>
          </motion.div>
        )}

        {karaokeStatus === 'idle' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-6 text-center">
            <div className="p-5 rounded-2xl bg-purple-500/10 border border-purple-500/20">
              <Mic2 className="w-14 h-14 text-purple-300 mx-auto" />
            </div>
            <div>
              <p className="text-white font-bold text-xl mb-2">No karaoke yet for this song</p>
              <p className="text-white/50 text-sm max-w-xs">
                Generate synced lyrics with AI — runs once and is cached for future plays.
              </p>
            </div>
            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleGenerate}
              className="px-8 py-3 rounded-2xl font-semibold text-white text-base"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7, #db2777)',
                boxShadow: '0 0 30px rgba(168,85,247,0.4)',
              }}
            >
              ✨ Generate Karaoke
            </motion.button>
          </motion.div>
        )}

        {karaokeStatus === 'failed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 text-center">
            <p className="text-red-400 font-semibold">Generation failed. Please try again.</p>
            <button
              onClick={handleGenerate}
              className="px-6 py-2.5 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 hover:bg-red-500/30 transition-colors"
            >
              Retry
            </button>
          </motion.div>
        )}

        {karaokeStatus === 'ready' && lines.length > 0 && (
          <div
            ref={lyricsContainerRef}
            className="w-full max-w-3xl h-full overflow-hidden flex flex-col items-center justify-center gap-0 py-4"
            style={{ maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)' }}
          >
            {/* Prev line */}
            <AnimatePresence mode="popLayout">
              {sync.prevLineIndex >= 0 && (
                <motion.div
                  key={`prev-${sync.prevLineIndex}`}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.35 }}
                  className="text-center mb-3 px-4 font-medium leading-snug"
                  style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                >
                  {renderLine(sync.prevLineIndex, 'prev')}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Current line — biggest, glowing */}
            <AnimatePresence mode="popLayout">
              {sync.currentLineIndex >= 0 && (
                <motion.div
                  key={`cur-${sync.currentLineIndex}`}
                  initial={{ opacity: 0, scale: 0.94, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="text-center px-4 font-black leading-tight tracking-tight"
                  ref={el => { lineRefs.current[sync.currentLineIndex] = el; }}
                  style={{
                    fontSize: 'clamp(1.5rem, 5vw, 3.5rem)',
                    lineHeight: 1.2,
                  }}
                >
                  {renderLine(sync.currentLineIndex, 'current')}

                  {/* Line progress bar */}
                  <motion.div
                    className="mt-3 mx-auto h-0.5 rounded-full overflow-hidden"
                    style={{ width: 'min(80%, 400px)', background: 'rgba(255,255,255,0.15)' }}
                  >
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        width: `${sync.lineProgress * 100}%`,
                        background: 'linear-gradient(90deg, #a855f7, #f0abfc)',
                        boxShadow: '0 0 8px rgba(168,85,247,0.8)',
                      }}
                    />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Waiting for first line */}
            {sync.currentLineIndex === -1 && karaokeStatus === 'ready' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-center"
              >
                <div className="flex gap-2 justify-center">
                  {[0, 1, 2].map(i => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full bg-purple-400"
                      animate={{ y: [0, -8, 0] }}
                      transition={{ duration: 0.8, delay: i * 0.15, repeat: Infinity }}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* Next line */}
            <AnimatePresence mode="popLayout">
              {sync.nextLineIndex >= 0 && (
                <motion.div
                  key={`next-${sync.nextLineIndex}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.35 }}
                  className="text-center mt-3 px-4 font-medium leading-snug"
                  style={{ fontSize: 'clamp(0.9rem, 2.5vw, 1.25rem)' }}
                >
                  {renderLine(sync.nextLineIndex, 'next')}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Player controls ────────────────────────────────────────────────── */}
      <div
        className="px-4 sm:px-8 pt-2"
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Progress bar */}
        <div className="mb-4 flex items-center gap-3">
          <span className="text-white/40 text-xs tabular-nums w-10 text-right">{fmt(progress)}</span>
          <div
            className="flex-1 h-1.5 rounded-full overflow-hidden cursor-pointer group relative"
            style={{ background: 'rgba(255,255,255,0.12)' }}
            onClick={e => {
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              seek(ratio * duration);
            }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                width: duration > 0 ? `${(progress / duration) * 100}%` : '0%',
                background: 'linear-gradient(90deg, #7c3aed, #a855f7, #db2777)',
                boxShadow: '0 0 12px rgba(168,85,247,0.7)',
              }}
            />
          </div>
          <span className="text-white/40 text-xs tabular-nums w-10">{fmt(duration)}</span>
        </div>

        {/* Buttons row */}
        <div className="flex items-center justify-center gap-6">
          <button
            onClick={prev}
            className="text-white/50 hover:text-white transition-colors"
            title="Previous"
          >
            <SkipBack className="w-5 h-5" />
          </button>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.93 }}
            onClick={toggle}
            className="w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl"
            style={{
              background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
              boxShadow: '0 0 28px rgba(168,85,247,0.5)',
            }}
            title={isPlaying && isCurrentSong ? 'Pause' : 'Play'}
          >
            {isPlaying && isCurrentSong ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </motion.button>

          <button
            onClick={next}
            className="text-white/50 hover:text-white transition-colors"
            title="Next"
          >
            <SkipForward className="w-5 h-5" />
          </button>
        </div>

        {/* Volume */}
        <div className="mt-4 flex items-center justify-center gap-3">
          <button onClick={toggleMuted} className="text-white/40 hover:text-white transition-colors">
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={isMuted ? 0 : volume}
            onChange={e => setVolume(parseFloat(e.target.value))}
            className="w-24 accent-purple-500 cursor-pointer"
            style={{ accentColor: '#a855f7' }}
          />
        </div>
      </div>

      {/* ── Lyric Video studio panel ───────────────────────────────────────── */}
      <AnimatePresence>
        {videoPanelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[210] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
            onClick={() => { if (videoStage !== 'rendering' && videoStage !== 'creating') setVideoPanelOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl p-6 border border-white/10"
              style={{ background: 'linear-gradient(160deg, #1a1030, #0d0820)' }}
            >
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Film className="w-5 h-5 text-pink-400" />
                  <h3 className="text-white font-bold text-lg">Lyric Video Studio</h3>
                </div>
                <button
                  onClick={() => { if (videoStage !== 'rendering' && videoStage !== 'creating') setVideoPanelOpen(false); }}
                  className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Theme picker */}
              <div className="mb-5">
                <p className="text-white/50 text-xs uppercase tracking-wider mb-2">Background style</p>
                <div className="grid grid-cols-4 gap-2">
                  {([
                    { id: 'blur', label: 'Blur' },
                    { id: 'gradient', label: 'Gradient' },
                    { id: 'dark', label: 'Dark' },
                    { id: 'light', label: 'Light' },
                  ] as const).map(t => (
                    <button
                      key={t.id}
                      disabled={videoStage === 'rendering' || videoStage === 'creating'}
                      onClick={() => setVideoTheme(t.id)}
                      className={`py-2 rounded-xl text-xs font-medium transition-all ${
                        videoTheme === t.id
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stage content */}
              {videoStage === 'idle' && (
                <button
                  onClick={handleCreateLyricVideo}
                  className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #db2777)', boxShadow: '0 0 24px rgba(168,85,247,0.4)' }}
                >
                  <Sparkles className="w-4 h-4" />
                  Render Lyric Video
                </button>
              )}

              {(videoStage === 'creating' || videoStage === 'rendering') && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <Loader2 className="w-8 h-8 text-pink-400 animate-spin" />
                  <p className="text-white/80 text-sm font-medium">
                    {videoStage === 'creating' ? 'Preparing your video…' : 'Rendering frames…'}
                  </p>
                  <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${videoProgress}%`, background: 'linear-gradient(90deg, #a855f7, #f0abfc)' }}
                    />
                  </div>
                  <p className="text-white/40 text-xs">{videoProgress}%</p>
                </div>
              )}

              {videoStage === 'done' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 text-green-400 text-sm font-medium justify-center">
                    <Check className="w-4 h-4" /> Video ready!
                  </div>
                  {videoUrl && (
                    <video
                      src={videoUrl}
                      controls
                      className="w-full rounded-xl border border-white/10"
                      style={{ maxHeight: 200 }}
                    />
                  )}
                  <div className="flex gap-2">
                    {videoUrl && (
                      <a
                        href={videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium flex items-center justify-center gap-1.5"
                      >
                        <ExternalLink className="w-4 h-4" /> Open
                      </a>
                    )}
                    {ytUrl ? (
                      <a
                        href={ytUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      >
                        <Check className="w-4 h-4" /> View on YouTube
                      </a>
                    ) : (
                      <button
                        onClick={handleYoutube}
                        disabled={ytUploading}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-1.5"
                      >
                        {ytUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Youtube className="w-4 h-4" />
                        )}
                        {ytConnected ? 'Upload to YouTube' : 'Connect YouTube'}
                      </button>
                    )}
                  </div>
                  {ytConnected && ytChannel && (
                    <p className="text-white/40 text-xs text-center">Publishing to: {ytChannel}</p>
                  )}
                  {!ytConfigured && (
                    <p className="text-amber-400/80 text-xs text-center">
                      YouTube publishing needs server setup (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET).
                    </p>
                  )}
                </div>
              )}

              {videoStage === 'error' && (
                <div className="flex flex-col items-center gap-3">
                  <p className="text-red-400 text-sm text-center">{videoError || 'Something went wrong.'}</p>
                  <button
                    onClick={handleCreateLyricVideo}
                    className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm"
                  >
                    Try again
                  </button>
                </div>
              )}

              {videoError && videoStage !== 'error' && (
                <p className="text-red-400/80 text-xs text-center mt-3">{videoError}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(
    <AnimatePresence mode="wait">{overlay}</AnimatePresence>,
    document.body
  );
}
