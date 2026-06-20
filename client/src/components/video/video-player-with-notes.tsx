import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Trash2, Edit3, X, MessageSquarePlus, Lock, Check, Play, Maximize, Minimize } from 'lucide-react';
import {
  useVideoNotes,
  formatTimecode,
  parseTimecode,
  type VideoNote,
} from '../../hooks/use-video-notes';
import { useAuth } from '../../hooks/use-auth';

export interface VideoPlayerWithNotesProps {
  videoId: string;
  videoUrl: string;
  title?: string;
  posterUrl?: string | null;
  /** Start playback immediately when the modal opens from a video-card click. */
  autoPlayOnOpen?: boolean;
  /** Owner of the video (artist) — used for permissions on notes. */
  ownerUserId?: number | null;
  /** Accent color (match artist palette). */
  accentColor?: string;
  onClose?: () => void;
  /** Optional extra UI rendered below the video title (e.g. a "View Script" button). */
  extraActions?: React.ReactNode;
  /** Fires when playback reaches the end (used by parent to autoplay next). */
  onEnded?: () => void;
}

function getYouTubeVideoId(url: string): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return parsed.pathname.split('/').filter(Boolean)[0] || null;
    if (host.endsWith('youtube.com')) {
      const watchId = parsed.searchParams.get('v');
      if (watchId) return watchId;
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (['embed', 'shorts', 'live'].includes(parts[0])) return parts[1] || null;
    }
  } catch {
    const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    return match?.[1] || null;
  }
  return null;
}

function getYouTubeEmbedUrl(url: string, autoplay: boolean): string | null {
  const videoId = getYouTubeVideoId(url);
  if (!videoId) return null;
  const params = new URLSearchParams({
    autoplay: autoplay ? '1' : '0',
    playsinline: '1',
    rel: '0',
    modestbranding: '1',
    cc_load_policy: '0',
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
}

/**
 * Full-screen video player with time-coded notes.
 *
 * Mobile-first: on narrow viewports the notes panel becomes a bottom sheet
 * that can be collapsed; on wide viewports it's a side panel.
 */
export function VideoPlayerWithNotes({
  videoId,
  videoUrl,
  title,
  posterUrl,
  autoPlayOnOpen = true,
  ownerUserId,
  accentColor = '#f97316',
  onClose,
  extraActions,
  onEnded,
}: VideoPlayerWithNotesProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const youtubeEmbedUrl = useMemo(() => getYouTubeEmbedUrl(videoUrl, autoPlayOnOpen), [videoUrl, autoPlayOnOpen]);
  const isYouTube = !!youtubeEmbedUrl;
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  // Buffering state — true while the browser is waiting for more data.
  // Drives a lightweight spinner overlay so the user knows the network is
  // catching up instead of perceiving the player as "frozen".
  const [isBuffering, setIsBuffering] = useState(false);
  // On mobile portrait the panel is hidden by default so the vertical
  // video isn't covered. The user opens it via a small floating icon.
  // On desktop (md+) the side panel is visible from the start.
  const [panelOpen, setPanelOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(min-width: 768px)').matches;
  });
  // Composer is always visible for authenticated users so they immediately
  // see where to write a note (was hidden-until-click before).
  const [composerOpen, setComposerOpen] = useState(true);
  const [composerTc, setComposerTc] = useState('00:00');
  const [composerText, setComposerText] = useState('');
  const [composerPrivate, setComposerPrivate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  // Guest name (persisted locally so we don't ask every time)
  const [guestName, setGuestName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('boostify_guest_name') || '';
  });

  const { user } = useAuth();
  const isAuthenticated = !!user;

  const {
    notes,
    activeNote,
    createNoteAsync,
    updateNote,
    deleteNote,
    isCreating,
  } = useVideoNotes(videoId, currentMs);

  // ---- Adaptive preload based on connection quality -------------------
  // On slow / data-saver connections we avoid pre-buffering metadata or the
  // first segment so the page itself loads quickly; the user can still hit
  // play and the browser will start fetching on demand.
  const preloadStrategy = useMemo<'none' | 'metadata' | 'auto'>(() => {
    if (typeof navigator === 'undefined') return 'metadata';
    const conn = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    if (!conn) return 'metadata';
    if (conn.saveData) return 'none';
    const eff = (conn.effectiveType as string | undefined) || '';
    if (eff === 'slow-2g' || eff === '2g') return 'none';
    if (eff === '3g') return 'metadata';
    return 'metadata';
  }, []);

  useEffect(() => {
    setIframeLoaded(false);
    setCurrentMs(0);
    setDurationMs(0);
    setIsPlaying(false);
    setIsBuffering(!isYouTube && autoPlayOnOpen);
  }, [videoUrl, isYouTube, autoPlayOnOpen]);

  // ---- Video element lifecycle ---------------------------------------
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onTime = () => setCurrentMs(Math.round(vid.currentTime * 1000));
    const onDuration = () => {
      if (isFinite(vid.duration)) setDurationMs(Math.round(vid.duration * 1000));
    };
    const onPlay = () => { setIsPlaying(true); setIsBuffering(false); };
    const onPause = () => setIsPlaying(false);
    const onEndedHandler = () => {
      setIsPlaying(false);
      try { onEnded?.(); } catch { /* ignore */ }
    };
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => setIsBuffering(false);
    const onStalled = () => setIsBuffering(true);

    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('loadedmetadata', onDuration);
    vid.addEventListener('durationchange', onDuration);
    vid.addEventListener('play', onPlay);
    vid.addEventListener('pause', onPause);
    vid.addEventListener('ended', onEndedHandler);
    vid.addEventListener('waiting', onWaiting);
    vid.addEventListener('playing', onPlaying);
    vid.addEventListener('canplay', onCanPlay);
    vid.addEventListener('stalled', onStalled);

    return () => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('loadedmetadata', onDuration);
      vid.removeEventListener('durationchange', onDuration);
      vid.removeEventListener('play', onPlay);
      vid.removeEventListener('pause', onPause);
      vid.removeEventListener('ended', onEndedHandler);
      vid.removeEventListener('waiting', onWaiting);
      vid.removeEventListener('playing', onPlaying);
      vid.removeEventListener('canplay', onCanPlay);
      vid.removeEventListener('stalled', onStalled);
    };
  }, [onEnded]);

  useEffect(() => {
    const vid = videoRef.current;
    if (!vid || isYouTube || !autoPlayOnOpen) return;

    const play = async () => {
      try {
        setIsBuffering(true);
        await vid.play();
      } catch {
        setIsBuffering(false);
        setIsPlaying(false);
      }
    };

    void play();
  }, [videoUrl, isYouTube, autoPlayOnOpen]);

  // ---- Hide floating widgets (support chat, etc.) while player is open --
  useEffect(() => {
    document.body.dataset.videoPlayerOpen = 'true';
    document.body.style.overflow = 'hidden';
    return () => {
      delete document.body.dataset.videoPlayerOpen;
      document.body.style.overflow = '';
    };
  }, []);

  // ---- Auto fullscreen on mobile landscape orientation ----------------
  // On phones we hide the notes panel and expand the video when the user
  // rotates the device to landscape. In portrait we keep the notes panel
  // so the user can read/write comments below the video.
  const [isLandscape, setIsLandscape] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(orientation: landscape) and (max-width: 900px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape) and (max-width: 900px)');
    const handler = (e: MediaQueryListEvent) => setIsLandscape(e.matches);
    // Safari < 14 doesn't support addEventListener on MediaQueryList
    if (mq.addEventListener) mq.addEventListener('change', handler);
    else (mq as any).addListener(handler);
    setIsLandscape(mq.matches);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', handler);
      else (mq as any).removeListener(handler);
    };
  }, []);

  // ---- Fullscreen helpers ---------------------------------------------
  // True device fullscreen via Fullscreen API. iOS Safari doesn't support
  // fullscreen on arbitrary elements, only on <video> via webkitEnterFullscreen.
  const enterFullscreen = useCallback(async () => {
    const vid = videoRef.current as any;
    const wrap = videoWrapRef.current as any;
    const iframe = iframeRef.current as any;

    try {
      // 1) YouTube iframe path — try to fullscreen the iframe itself
      if (isYouTube && iframe) {
        const req = iframe.requestFullscreen || iframe.webkitRequestFullscreen || iframe.msRequestFullscreen;
        if (req) { await req.call(iframe); return; }
      }

      // 2) iOS Safari: only <video>.webkitEnterFullscreen works reliably.
      // We enable native controls just-in-time and disable them on the
      // ended/webkitendfullscreen events so the CC/AirPlay icons don't
      // flash above our custom UI when fullscreen exits.
      if (vid && typeof vid.webkitEnterFullscreen === 'function') {
        vid.controls = true;
        const restore = () => {
          vid.controls = false;
          vid.removeEventListener('webkitendfullscreen', restore);
          vid.removeEventListener('ended', restore);
        };
        vid.addEventListener('webkitendfullscreen', restore);
        vid.addEventListener('ended', restore);
        vid.webkitEnterFullscreen();
        return;
      }

      // 3) Standard Fullscreen API on the video wrapper (keeps our custom UI)
      const target = wrap || vid;
      if (!target) return;
      const req =
        target.requestFullscreen ||
        target.webkitRequestFullscreen ||
        target.mozRequestFullScreen ||
        target.msRequestFullscreen;
      if (req) await req.call(target);
    } catch (err) {
      console.warn('[VideoPlayer] fullscreen request failed', err);
    }
  }, [isYouTube]);

  const exitFullscreen = useCallback(async () => {
    try {
      const doc = document as any;
      const exit =
        doc.exitFullscreen ||
        doc.webkitExitFullscreen ||
        doc.mozCancelFullScreen ||
        doc.msExitFullscreen;
      if (exit && (doc.fullscreenElement || doc.webkitFullscreenElement)) {
        await exit.call(document);
      }
      const vid = videoRef.current as any;
      if (vid && typeof vid.webkitExitFullscreen === 'function') {
        vid.webkitExitFullscreen();
      }
    } catch (err) {
      console.warn('[VideoPlayer] exit fullscreen failed', err);
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) exitFullscreen();
    else enterFullscreen();
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Track native fullscreen state (incl. iOS webkit events on the video tag)
  useEffect(() => {
    const onChange = () => {
      const doc = document as any;
      const vid = videoRef.current as any;
      const active =
        !!doc.fullscreenElement ||
        !!doc.webkitFullscreenElement ||
        !!doc.mozFullScreenElement ||
        !!doc.msFullscreenElement ||
        !!(vid && vid.webkitDisplayingFullscreen);
      setIsFullscreen(active);
    };
    document.addEventListener('fullscreenchange', onChange);
    document.addEventListener('webkitfullscreenchange', onChange);
    document.addEventListener('mozfullscreenchange', onChange);
    document.addEventListener('MSFullscreenChange', onChange);
    const vid = videoRef.current;
    if (vid) {
      vid.addEventListener('webkitbeginfullscreen', onChange);
      vid.addEventListener('webkitendfullscreen', onChange);
    }
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      document.removeEventListener('webkitfullscreenchange', onChange);
      document.removeEventListener('mozfullscreenchange', onChange);
      document.removeEventListener('MSFullscreenChange', onChange);
      if (vid) {
        vid.removeEventListener('webkitbeginfullscreen', onChange);
        vid.removeEventListener('webkitendfullscreen', onChange);
      }
    };
  }, []);

  // Auto-fullscreen when the user rotates to landscape on a phone.
  // Only triggers once per rotation (not on every re-render) and only if
  // the video is actually playing / visible.
  useEffect(() => {
    if (!isLandscape) return;
    // iOS Safari blocks programmatic fullscreen without a user gesture, but
    // orientationchange counts as one on most devices. We try silently and
    // ignore failures — the manual button is always available.
    const id = window.setTimeout(() => { enterFullscreen(); }, 150);
    return () => window.clearTimeout(id);
  }, [isLandscape, enterFullscreen]);

  // ---- Keyboard shortcuts (desktop) ----------------------------------
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ignore when typing in input/textarea
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        openComposer();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  // ---- Helpers -------------------------------------------------------
  const seekTo = useCallback((ms: number) => {
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = Math.max(0, ms / 1000);
  }, []);

  const togglePlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) vid.play().catch(() => {});
    else vid.pause();
  }, []);

  const openComposer = useCallback(() => {
    const vid = videoRef.current;
    if (vid && !vid.paused) vid.pause();
    setComposerTc(formatTimecode(vid ? Math.round(vid.currentTime * 1000) : currentMs));
    setComposerText('');
    setComposerPrivate(false);
    setEditingId(null);
    setComposerOpen(true);
    setPanelOpen(true);
  }, [currentMs]);

  const openEditor = useCallback((n: VideoNote) => {
    setComposerTc(formatTimecode(n.timecodeMs));
    setComposerText(n.text);
    setComposerPrivate(n.isPrivate);
    setEditingId(n.id);
    setComposerOpen(true);
    setPanelOpen(true);
  }, []);

  const submitComposer = useCallback(async () => {
    const text = composerText.trim();
    if (!text) return;
    const tcMs = parseTimecode(composerTc);
    if (tcMs == null) return;

    // Guests must provide a name.
    const trimmedGuestName = guestName.trim();
    if (!isAuthenticated && !trimmedGuestName) {
      alert('Please enter your name to comment.');
      return;
    }

    try {
      if (editingId != null) {
        updateNote(editingId, { timecodeMs: tcMs, text, isPrivate: composerPrivate });
      } else {
        if (!isAuthenticated) {
          localStorage.setItem('boostify_guest_name', trimmedGuestName);
        }
        await createNoteAsync({
          timecodeMs: tcMs,
          text,
          isPrivate: isAuthenticated ? composerPrivate : false,
          ownerUserId: ownerUserId ?? undefined,
          guestName: isAuthenticated ? undefined : trimmedGuestName,
        });
      }
      // Keep composer visible, just reset fields for the next note.
      setComposerText('');
      setEditingId(null);
      setComposerTc(formatTimecode(
        videoRef.current ? Math.round(videoRef.current.currentTime * 1000) : currentMs,
      ));
    } catch (err) {
      console.error('Failed to save note', err);
    }
  }, [composerText, composerTc, composerPrivate, editingId, ownerUserId, createNoteAsync, updateNote, currentMs, guestName, isAuthenticated]);

  // ---- Timeline markers ---------------------------------------------
  const markers = useMemo(() => {
    if (!durationMs || !notes.length) return [];
    return notes.map((n) => ({
      id: n.id,
      note: n,
      pct: Math.min(100, Math.max(0, (n.timecodeMs / durationMs) * 100)),
    }));
  }, [notes, durationMs]);

  // ---- Render --------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/95 flex flex-col md:flex-row"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      {/* Video area */}
      <div className="relative flex-1 flex flex-col min-h-0 md:justify-center">
        {/* Close button — placed inside safe-area so it never overlaps the
            iOS notch or YouTube's own CC/fullscreen icons. */}
        {onClose && (
          <button
            onClick={onClose}
            className="absolute z-30 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-black/70 hover:bg-black/90 backdrop-blur flex items-center justify-center text-white shadow-lg ring-1 ring-white/15 transition-colors"
            style={{
              top: 'calc(env(safe-area-inset-top) + 12px)',
              right: 'calc(env(safe-area-inset-right) + 12px)',
            }}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        )}

        <div ref={videoWrapRef} className={`relative w-full bg-black flex-1 md:flex-initial flex items-center justify-center md:max-h-[70vh] ${isLandscape ? 'max-h-full' : ''}`}>
          {isYouTube ? (
            // Notas deshabilitadas para YouTube (no podemos leer timecode del embed nativo sin API)
            <iframe
              ref={iframeRef}
              key={youtubeEmbedUrl}
              src={youtubeEmbedUrl || videoUrl}
              className={`w-full h-full md:max-h-[70vh] ${isLandscape ? 'max-h-full' : 'max-h-[70vh]'}`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              onLoad={() => setIframeLoaded(true)}
              title={title || 'Video'}
            />
          ) : (
            <video
              ref={videoRef}
              src={videoUrl}
              poster={posterUrl || undefined}
              className={`w-full h-full md:max-h-[70vh] object-contain bg-black ${isLandscape ? 'max-h-full' : 'max-h-[70vh]'}`}
              autoPlay={autoPlayOnOpen}
              playsInline
              controls={false}
              preload={preloadStrategy}
              disableRemotePlayback
              {...({ 'webkit-playsinline': 'true', 'x-webkit-airplay': 'allow' } as any)}
            />
          )}

          {isYouTube && !iframeLoaded && (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-950 bg-cover bg-center"
              style={posterUrl ? { backgroundImage: `url(${posterUrl})` } : undefined}
            >
              <div className="absolute inset-0 bg-black/45" />
              <div className="relative w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin" />
            </div>
          )}

          {/* Buffering spinner overlay — visible while the network catches up or autoplay starts */}
          {isBuffering && !isYouTube && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
              <div
                className="w-12 h-12 rounded-full border-2 border-white/20 border-t-white animate-spin"
                aria-label="Buffering"
              />
            </div>
          )}

          {!isYouTube && !isPlaying && !isBuffering && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 z-10 flex items-center justify-center bg-black/35 text-white"
              aria-label="Play video"
            >
              <span
                className="w-16 h-16 rounded-full flex items-center justify-center shadow-xl"
                style={{ backgroundColor: accentColor }}
              >
                <Play className="h-8 w-8 ml-1" fill="white" />
              </span>
            </button>
          )}

          {/* No floating fullscreen pill for YouTube — its iframe already
              renders the native CC, settings and fullscreen controls in the
              bottom-right of the player, so adding our own caused them to
              overlap visually. HTML5 video has its own fullscreen button in
              the custom controls bar below. */}
        </div>

        {/* Custom controls + timeline (only for HTML5 video, not YouTube) */}
        {!isYouTube && (
          <div className="bg-black/80 backdrop-blur p-3 sm:p-4 select-none">
            {/* Timeline with note markers */}
            <div className="relative h-2 mb-3">
              <input
                type="range"
                min={0}
                max={durationMs || 0}
                value={currentMs}
                onChange={(e) => seekTo(parseInt(e.target.value, 10))}
                className="absolute inset-0 w-full h-2 appearance-none bg-white/10 rounded-full cursor-pointer"
                style={{
                  touchAction: 'none',
                  accentColor,
                }}
                aria-label="Seek"
              />
              {/* Markers overlay */}
              <div className="pointer-events-none absolute inset-0">
                {markers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => seekTo(m.note.timecodeMs)}
                    className="pointer-events-auto absolute -top-1 -translate-x-1/2 w-3 h-4 rounded-sm shadow-lg transition-transform hover:scale-125 focus:scale-125"
                    style={{
                      left: `${m.pct}%`,
                      background: m.note.color || accentColor,
                      // Larger invisible hit area (≥44px) for mobile
                      boxShadow: `0 0 0 18px rgba(0,0,0,0)`,
                    }}
                    aria-label={`Jump to note at ${formatTimecode(m.note.timecodeMs)}`}
                    title={m.note.text.slice(0, 60)}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={togglePlay}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: accentColor }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" fill="white" />}
              </button>
              <div className="text-white/80 text-xs font-mono tabular-nums">
                {formatTimecode(currentMs)} / {formatTimecode(durationMs)}
              </div>
              <div className="flex-1" />
              <button
                onClick={toggleFullscreen}
                className="w-11 h-11 rounded-full flex items-center justify-center text-white bg-white/10 hover:bg-white/20 active:scale-95 transition-transform"
                aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                title="Fullscreen"
                data-testid="button-video-fullscreen-bar"
              >
                {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
              </button>
              <button
                onClick={openComposer}
                className="h-11 px-3 sm:px-4 rounded-full text-white text-sm font-semibold flex items-center gap-1.5 active:scale-95 transition-transform"
                style={{ backgroundColor: accentColor }}
                title="Add note at current time"
              >
                <MessageSquarePlus className="h-4 w-4" />
                <span className="hidden sm:inline">Note at {formatTimecode(currentMs)}</span>
                <span className="sm:hidden">Note</span>
              </button>
            </div>

            {/* Active note banner */}
            {activeNote && (
              <div
                className="mt-3 px-3 py-2 rounded-lg bg-white/5 border-l-4 text-sm text-white/90"
                style={{ borderColor: activeNote.color || accentColor }}
              >
                <div className="text-xs text-white/60 mb-0.5 flex items-center gap-1.5">
                  <span className="font-mono tabular-nums">{formatTimecode(activeNote.timecodeMs)}</span>
                  {activeNote.author?.name && <span>· {activeNote.author.name}</span>}
                  {activeNote.isPrivate && <Lock className="h-3 w-3" />}
                </div>
                <div className="line-clamp-2">{activeNote.text}</div>
              </div>
            )}
          </div>
        )}

        {title && (
          <div className="bg-black/80 px-3 sm:px-4 pb-3 text-white">
            {extraActions && <div className="mt-2">{extraActions}</div>}
            <h3 className="font-semibold text-base sm:text-lg truncate">{title}</h3>
          </div>
        )}
      </div>

      {/* ─── Floating toggle to open the notes panel on mobile ─── */}
      {/* Visible only on mobile portrait when the panel is closed so the */}
      {/* vertical video can use the full available space. */}
      {!panelOpen && !isLandscape && (
        <button
          type="button"
          onClick={() => setPanelOpen(true)}
          className="md:hidden fixed bottom-4 right-4 z-[90] w-12 h-12 rounded-full bg-black/80 hover:bg-black/90 backdrop-blur border border-white/15 shadow-lg flex items-center justify-center text-white"
          aria-label="Open notes"
          style={{ marginBottom: 'env(safe-area-inset-bottom)' }}
        >
          <MessageSquarePlus className="h-5 w-5" style={{ color: accentColor }} />
          {notes.length > 0 && (
            <span
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[10px] font-bold flex items-center justify-center"
              style={{ color: accentColor }}
            >
              {notes.length}
            </span>
          )}
        </button>
      )}

      {/* ─── Notes panel (right on desktop, bottom sheet on mobile) ─── */}
      {/* Hidden when the phone is rotated to landscape so the video can */}
      {/* take the full screen. On mobile portrait the panel is fully     */}
      {/* hidden when closed (toggled via the floating icon above) so the */}
      {/* vertical video isn't covered.                                    */}
      <aside
        className={`
          bg-neutral-900 border-neutral-800 text-white flex flex-col
          md:w-[360px] md:border-l md:h-full md:max-h-full md:flex
          border-t md:border-t-0
          transition-[max-height] duration-300 ease-out
          ${panelOpen ? 'max-h-[60vh] flex' : 'max-h-0 hidden md:flex'}
          md:max-h-full
          overflow-hidden
          ${isLandscape ? 'hidden' : ''}
        `}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-neutral-800 sticky top-0 bg-neutral-900 z-10">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="h-4 w-4" style={{ color: accentColor }} />
            <h4 className="font-semibold text-sm">
              Notes <span className="text-white/50">({notes.length})</span>
            </h4>
          </div>
          <button
            type="button"
            onClick={() => setPanelOpen(false)}
            className="md:hidden w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-white/80"
            aria-label="Close notes"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {panelOpen && (
          <>
            <div className="flex-1 overflow-y-auto overscroll-contain p-3 space-y-2" style={{ WebkitOverflowScrolling: 'touch' as any }}>
              {notes.length === 0 && (
                <div className="text-center text-white/40 text-sm py-6 px-4">
                  No comments yet. Be the first to leave one!
                </div>
              )}
              {notes.map((n) => (
                <NoteRow
                  key={n.id}
                  note={n}
                  accentColor={accentColor}
                  isActive={activeNote?.id === n.id}
                  onJump={() => seekTo(n.timecodeMs)}
                  onEdit={() => openEditor(n)}
                  onDelete={() => {
                    if (window.confirm('Delete this note? This cannot be undone.')) {
                      deleteNote(n.id);
                    }
                  }}
                />
              ))}
            </div>

            {/* Composer */}
            {composerOpen && (
              <div className="border-t border-neutral-800 bg-neutral-950 p-3 space-y-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
                {editingId != null && (
                  <div
                    className="flex items-center justify-between text-xs px-2 py-1 rounded"
                    style={{ backgroundColor: `${accentColor}22`, color: accentColor }}
                  >
                    <span className="flex items-center gap-1.5">
                      <Edit3 className="h-3 w-3" /> Editing note
                    </span>
                  </div>
                )}
                {!isAuthenticated && editingId == null && (
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Your name"
                    maxLength={60}
                    className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:ring-2"
                    style={{ boxShadow: 'none' }}
                  />
                )}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-white/60">At</label>
                  <input
                    type="text"
                    value={composerTc}
                    onChange={(e) => setComposerTc(e.target.value)}
                    placeholder="mm:ss"
                    inputMode="numeric"
                    className="w-20 bg-neutral-800 border border-neutral-700 rounded px-2 py-1 text-sm font-mono tabular-nums text-white focus:outline-none focus:ring-2"
                    style={{ boxShadow: 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setComposerTc(formatTimecode(currentMs))}
                    className="text-xs text-white/60 hover:text-white underline"
                  >
                    now
                  </button>
                  <div className="flex-1" />
                  {isAuthenticated && (
                    <label className="flex items-center gap-1.5 text-xs text-white/60 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={composerPrivate}
                        onChange={(e) => setComposerPrivate(e.target.checked)}
                        className="accent-current"
                        style={{ accentColor }}
                      />
                      Private
                    </label>
                  )}
                </div>
                <textarea
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  placeholder="Write a note…"
                  rows={2}
                  maxLength={2000}
                  className="w-full bg-neutral-800 border border-neutral-700 rounded px-3 py-2 text-sm text-white resize-none focus:outline-none"
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                      e.preventDefault();
                      submitComposer();
                    }
                  }}
                  autoFocus
                />
                <div className="flex items-center justify-end gap-2">
                  {editingId != null && (
                    <button
                      onClick={() => { setEditingId(null); setComposerText(''); }}
                      className="px-3 py-1.5 text-sm text-white/70 hover:text-white"
                    >
                      Cancel edit
                    </button>
                  )}
                  <button
                    onClick={submitComposer}
                    disabled={!composerText.trim() || isCreating}
                    className="px-4 py-1.5 rounded-full text-sm font-semibold text-white disabled:opacity-50 flex items-center gap-1"
                    style={{ backgroundColor: accentColor }}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {editingId != null ? 'Save' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

// ─── Single note row ──────────────────────────────────────────────────
function NoteRow({
  note,
  accentColor,
  isActive,
  onJump,
  onEdit,
  onDelete,
}: {
  note: VideoNote;
  accentColor: string;
  isActive: boolean;
  onJump: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`
        rounded-lg px-3 py-2 transition-colors border
        ${isActive ? 'bg-white/10 border-white/20' : 'bg-neutral-800/60 border-transparent hover:bg-neutral-800'}
      `}
      style={isActive ? { borderLeft: `3px solid ${note.color || accentColor}` } : undefined}
    >
      <div className="flex items-start gap-2">
        <button
          onClick={onJump}
          className="font-mono tabular-nums text-xs px-1.5 py-0.5 rounded shrink-0 mt-0.5"
          style={{ backgroundColor: `${accentColor}33`, color: accentColor }}
          aria-label={`Jump to ${formatTimecode(note.timecodeMs)}`}
        >
          {formatTimecode(note.timecodeMs)}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-white whitespace-pre-wrap break-words">{note.text}</div>
          <div className="mt-1 flex items-center gap-2 text-[11px] text-white/50">
            {note.author?.name && <span>{note.author.name}</span>}
            {note.isOwnerNote && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white"
                style={{ backgroundColor: accentColor }}
              >
                Creator
              </span>
            )}
            {note.isPrivate && <Lock className="h-3 w-3" />}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {note.canEdit && (
            <button
              onClick={onEdit}
              className="w-8 h-8 rounded flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10"
              aria-label="Edit note"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          )}
          {note.canDelete && (
            <button
              onClick={onDelete}
              className="w-8 h-8 rounded flex items-center justify-center text-white/50 hover:text-red-400 hover:bg-white/10"
              aria-label="Delete note"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default VideoPlayerWithNotes;
