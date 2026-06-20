/**
 * Global Audio Player Context
 * - Single shared <audio> element so playback persists across navigation.
 * - Queue of tracks with auto-advance on `ended`.
 * - Muted-by-default support for browser autoplay policies; user can unmute
 *   via MiniPlayer or any UI button.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

export interface AudioTrack {
  id: string | number;
  title: string;
  artist?: string;
  audioUrl: string;
  coverArt?: string | null;
  duration?: string | null;
  /** Optional href to deep-link back to the source (artist profile, etc.) */
  sourceHref?: string;
  /**
   * When set, playback is capped at this many seconds (free preview). The
   * player pauses at the limit and emits a `boostify:preview-ended` event so
   * the UI can prompt the listener to unlock the full catalog.
   */
  previewLimitSeconds?: number;
}

interface PlayQueueOptions {
  startIndex?: number;
  autoplay?: boolean;
  muted?: boolean;
}

export type RepeatMode = 'off' | 'all' | 'one';

interface AudioPlayerCtx {
  currentTrack: AudioTrack | null;
  queue: AudioTrack[];
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  progress: number; // seconds
  duration: number; // seconds
  shuffle: boolean;
  repeat: RepeatMode;
  playTrack: (track: AudioTrack) => void;
  playQueue: (tracks: AudioTrack[], opts?: PlayQueueOptions) => void;
  next: () => void;
  prev: () => void;
  pause: () => void;
  resume: () => void;
  toggle: () => void;
  setMuted: (muted: boolean) => void;
  toggleMuted: () => void;
  setVolume: (v: number) => void;
  seek: (seconds: number) => void;
  stop: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  jumpTo: (index: number) => void;
}

const AudioPlayerContext = createContext<AudioPlayerCtx | null>(null);

const PREF_KEY = 'boostify-audio-prefs-v1';

interface Prefs {
  muted: boolean;
  volume: number;
  /** User explicitly disabled profile autoplay. */
  autoplayDisabled?: boolean;
  shuffle?: boolean;
  repeat?: RepeatMode;
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    if (!raw) return { muted: false, volume: 0.8 };
    const parsed = JSON.parse(raw);
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : false,
      volume: typeof parsed.volume === 'number' ? parsed.volume : 0.8,
      autoplayDisabled: !!parsed.autoplayDisabled,
      shuffle: !!parsed.shuffle,
      repeat: parsed.repeat === 'all' || parsed.repeat === 'one' ? parsed.repeat : 'off',
    };
  } catch {
    return { muted: false, volume: 0.8 };
  }
}

function savePrefs(p: Partial<Prefs>) {
  try {
    const cur = loadPrefs();
    localStorage.setItem(PREF_KEY, JSON.stringify({ ...cur, ...p }));
  } catch {
    /* ignore */
  }
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  if (typeof window !== 'undefined' && !audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = 'metadata';
  }

  const [queue, setQueue] = useState<AudioTrack[]>([]);
  const [index, setIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const initialPrefs = useRef<Prefs>(loadPrefs());
  const [isMuted, setIsMutedState] = useState<boolean>(initialPrefs.current.muted);
  const [volume, setVolumeState] = useState<number>(initialPrefs.current.volume);
  const [shuffle, setShuffle] = useState<boolean>(!!initialPrefs.current.shuffle);
  const [repeat, setRepeat] = useState<RepeatMode>(initialPrefs.current.repeat || 'off');

  const currentTrack = index >= 0 && index < queue.length ? queue[index] : null;

  // Keep live refs so the (rarely re-bound) audio event listeners read the
  // latest values without stale closures.
  const currentTrackRef = useRef<AudioTrack | null>(currentTrack);
  currentTrackRef.current = currentTrack;
  const queueRef = useRef<AudioTrack[]>(queue);
  queueRef.current = queue;
  const indexRef = useRef<number>(index);
  indexRef.current = index;
  const shuffleRef = useRef<boolean>(shuffle);
  shuffleRef.current = shuffle;
  const repeatRef = useRef<RepeatMode>(repeat);
  repeatRef.current = repeat;
  // Whether the current track already emitted a scrobble (a meaningful play).
  const scrobbledRef = useRef<boolean>(false);

  // Pick the next index honoring shuffle + repeat. Returns -1 when playback
  // should stop (end of queue with repeat off).
  const computeNextIndex = useCallback((auto: boolean): number => {
    const q = queueRef.current;
    const i = indexRef.current;
    if (q.length === 0) return -1;
    if (shuffleRef.current && q.length > 1) {
      let r = i;
      while (r === i) r = Math.floor(Math.random() * q.length);
      return r;
    }
    if (i + 1 < q.length) return i + 1;
    // End of queue.
    if (repeatRef.current === 'all') return 0;
    return auto ? -1 : i;
  }, []);

  // Hook up audio element listeners (once)
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    a.muted = isMuted;
    a.volume = volume;

    const onTime = () => {
      const cur = a.currentTime || 0;
      setProgress(cur);
      const track = currentTrackRef.current;
      // Scrobble a meaningful play once: after 30s (or 50% for short tracks).
      if (track && !scrobbledRef.current) {
        const dur = a.duration || 0;
        const threshold = dur > 0 ? Math.min(30, dur * 0.5) : 30;
        if (cur >= threshold && threshold > 0) {
          scrobbledRef.current = true;
          try {
            window.dispatchEvent(
              new CustomEvent('boostify:scrobble', {
                detail: { track, msPlayed: Math.round(cur * 1000) },
              }),
            );
          } catch {
            /* ignore */
          }
        }
      }
      // Enforce free-preview limit: pause at the cap and notify the UI.
      const limit = track?.previewLimitSeconds;
      if (typeof limit === 'number' && limit > 0 && cur >= limit) {
        a.pause();
        a.currentTime = 0;
        setProgress(0);
        try {
          window.dispatchEvent(
            new CustomEvent('boostify:preview-ended', { detail: { track } }),
          );
        } catch {
          /* ignore */
        }
      }
    };
    const onMeta = () => setDuration(a.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      // Repeat-one: replay the same track.
      if (repeatRef.current === 'one') {
        a.currentTime = 0;
        a.play().catch(() => setIsPlaying(false));
        return;
      }
      const nextIdx = computeNextIndex(true);
      if (nextIdx < 0) {
        setIsPlaying(false);
        return;
      }
      setIndex(nextIdx);
    };

    a.addEventListener('timeupdate', onTime);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('play', onPlay);
    a.addEventListener('pause', onPause);
    a.addEventListener('ended', onEnded);
    return () => {
      a.removeEventListener('timeupdate', onTime);
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('play', onPlay);
      a.removeEventListener('pause', onPause);
      a.removeEventListener('ended', onEnded);
    };
  }, [queue.length, isMuted, volume]);

  // Load src whenever the index changes
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    // New track loaded → allow a fresh scrobble.
    scrobbledRef.current = false;
    if (!currentTrack) {
      a.pause();
      a.removeAttribute('src');
      a.load();
      return;
    }
    if (a.src !== currentTrack.audioUrl) {
      a.src = currentTrack.audioUrl;
      a.load();
    }
    // Try to play with the user's current muted preference first. If the
    // browser blocks autoplay-with-sound (no user gesture yet), fall back
    // to muted playback so the track at least loads — a single user click
    // anywhere on the page will then unmute via the existing controls.
    a.play().catch(() => {
      if (!a.muted) {
        a.muted = true;
        a.play().catch(() => setIsPlaying(false));
      } else {
        setIsPlaying(false);
      }
    });
  }, [currentTrack]);

  const playTrack = useCallback((track: AudioTrack) => {
    setQueue([track]);
    setIndex(0);
  }, []);

  const playQueue = useCallback((tracks: AudioTrack[], opts: PlayQueueOptions = {}) => {
    if (!tracks.length) return;
    const start = Math.max(0, Math.min(opts.startIndex ?? 0, tracks.length - 1));
    if (typeof opts.muted === 'boolean') {
      setIsMutedState(opts.muted);
      savePrefs({ muted: opts.muted });
      if (audioRef.current) audioRef.current.muted = opts.muted;
    }
    setQueue(tracks);
    setIndex(start);
  }, []);

  const next = useCallback(() => {
    const nextIdx = computeNextIndex(false);
    if (nextIdx >= 0) setIndex(nextIdx);
  }, [computeNextIndex]);

  const prev = useCallback(() => {
    // Restart current track if we're past 3s, else go to previous.
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      setProgress(0);
      return;
    }
    setIndex((i) => (i > 0 ? i - 1 : i));
  }, []);

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const nv = !s;
      savePrefs({ shuffle: nv });
      return nv;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeat((r) => {
      const nv: RepeatMode = r === 'off' ? 'all' : r === 'all' ? 'one' : 'off';
      savePrefs({ repeat: nv });
      return nv;
    });
  }, []);

  const jumpTo = useCallback((i: number) => {
    setIndex((cur) => {
      const q = queueRef.current;
      if (i >= 0 && i < q.length) return i;
      return cur;
    });
  }, []);

  const pause = useCallback(() => audioRef.current?.pause(), []);
  const resume = useCallback(() => {
    audioRef.current?.play().catch(() => setIsPlaying(false));
  }, []);
  const toggle = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setIsPlaying(false));
    else a.pause();
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    setIsMutedState(muted);
    savePrefs({ muted });
    if (audioRef.current) audioRef.current.muted = muted;
  }, []);
  const toggleMuted = useCallback(() => setMuted(!isMuted), [isMuted, setMuted]);

  const setVolume = useCallback((v: number) => {
    const clamped = Math.max(0, Math.min(1, v));
    setVolumeState(clamped);
    savePrefs({ volume: clamped });
    if (audioRef.current) audioRef.current.volume = clamped;
  }, []);

  const seek = useCallback((seconds: number) => {
    const a = audioRef.current;
    if (a && Number.isFinite(seconds)) {
      a.currentTime = Math.max(0, Math.min(seconds, a.duration || seconds));
      setProgress(a.currentTime);
    }
  }, []);

  const stop = useCallback(() => {
    audioRef.current?.pause();
    setQueue([]);
    setIndex(-1);
    setIsPlaying(false);
    setProgress(0);
  }, []);

  const value = useMemo<AudioPlayerCtx>(
    () => ({
      currentTrack,
      queue,
      isPlaying,
      isMuted,
      volume,
      progress,
      duration,
      shuffle,
      repeat,
      playTrack,
      playQueue,
      next,
      prev,
      pause,
      resume,
      toggle,
      setMuted,
      toggleMuted,
      setVolume,
      seek,
      stop,
      toggleShuffle,
      cycleRepeat,
      jumpTo,
    }),
    [
      currentTrack,
      queue,
      isPlaying,
      isMuted,
      volume,
      progress,
      duration,
      shuffle,
      repeat,
      playTrack,
      playQueue,
      next,
      prev,
      pause,
      resume,
      toggle,
      setMuted,
      toggleMuted,
      setVolume,
      seek,
      stop,
      toggleShuffle,
      cycleRepeat,
      jumpTo,
    ],
  );

  return <AudioPlayerContext.Provider value={value}>{children}</AudioPlayerContext.Provider>;
}

export function useAudioPlayer(): AudioPlayerCtx {
  const ctx = useContext(AudioPlayerContext);
  if (!ctx) {
    throw new Error('useAudioPlayer must be used inside <AudioPlayerProvider>');
  }
  return ctx;
}

export function getAutoplayPreference(): boolean {
  // true = allowed, false = user disabled
  return !loadPrefs().autoplayDisabled;
}

export function setAutoplayPreference(enabled: boolean) {
  savePrefs({ autoplayDisabled: !enabled });
}
