// ─── CrowdSync DJ Engine ──────────────────────────────────────────────────────
// A real, autonomous DJ playback engine for the CrowdSync page. It drives two
// HTMLAudio "decks" and crossfades between them by ramping their volumes, so it
// plays and auto-mixes the artist's catalogue with NO external dependency and no
// CORS/Web-Audio constraints (works with remote Firebase/CDN audio URLs).
//
// Capabilities used by the page:
//  - play / pause / toggle the current deck
//  - next / prev / shuffle through the playlist
//  - crossfadeTo(track): beat-agnostic volume crossfade between decks
//  - autonomous auto-mix: when the current track nears its end (or on demand),
//    it crossfades into the next track chosen by an injected selector so the
//    set never stops and adapts to the crowd mood/energy
//  - raiseEnergy / lowerEnergy: nudge tempo (playbackRate) + jump toward a
//    higher/lower energy track
//  - setBpm: adapt tempo via playbackRate relative to a reference BPM
//  - setVolume (master), toggleLoop, triggerDrop (filter-less volume swell)
//
// The engine reports live state (position, currentTime, duration, current/next
// track, crossfading flag) so the UI can render a true progress/waveform.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface DeckTrack {
  id: number | string;
  title: string;
  artistName?: string | null;
  audioUrl?: string | null;
  genre?: string | null;
  mood?: string | null;
  coverArt?: string | null;
  /** Relative crowd energy this track suits best (0-100). Optional. */
  energy?: number | null;
}

export interface DjEngineState {
  current: DeckTrack | null;
  next: DeckTrack | null;
  isPlaying: boolean;
  /** 0..1 progress of the current track. */
  position: number;
  currentTime: number;
  duration: number;
  /** Master volume 0..1. */
  volume: number;
  /** Target BPM the engine is adapting playback rate toward. */
  bpm: number;
  playbackRate: number;
  crossfading: boolean;
  loop: boolean;
  autoMix: boolean;
  ready: boolean;
}

interface UseDjEngineOptions {
  playlist: DeckTrack[];
  /** Reference BPM that a playbackRate of 1.0 corresponds to. */
  referenceBpm?: number;
  /** Crossfade duration in seconds. */
  crossfadeSeconds?: number;
  /** Auto-mix into the next track when this many seconds remain. */
  autoMixTailSeconds?: number;
  /** Fired when the engine switches to a new track. */
  onTrackChange?: (track: DeckTrack) => void;
  /** Optional human-readable event reporter (drives the action log). */
  onAction?: (label: string, detail: string) => void;
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function useDjEngine(options: UseDjEngineOptions) {
  const {
    playlist,
    referenceBpm = 122,
    crossfadeSeconds = 6,
    autoMixTailSeconds = 8,
    onTrackChange,
    onAction,
  } = options;

  // Two decks (A=0, B=1) plus which one is currently "live".
  const decksRef = useRef<HTMLAudioElement[] | null>(null);
  const activeRef = useRef(0);
  const fadeRafRef = useRef<number>(0);
  const tickRafRef = useRef<number>(0);
  const autoMixGuardRef = useRef(false);
  const playlistRef = useRef<DeckTrack[]>(playlist);
  const targetBpmRef = useRef(referenceBpm);
  const volumeRef = useRef(0.75);
  const autoMixRef = useRef(true);

  // ── Optional Web Audio EQ layer (CORS-gated) ──────────────────────────────
  // Real low/high-pass filter sweeps for energy moves. We only route a deck
  // through Web Audio when its audio source is CORS-accessible — otherwise
  // createMediaElementSource would silence remote tracks. When the source
  // isn't CORS-safe we simply fall back to the playbackRate/volume moves, so
  // playback can never break.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nodeMapRef = useRef<Map<HTMLAudioElement, { lp: BiquadFilterNode; hp: BiquadFilterNode }>>(new Map());
  const corsCacheRef = useRef<Map<string, boolean>>(new Map());
  const triedSourceRef = useRef<WeakSet<HTMLAudioElement>>(new WeakSet());

  const [state, setState] = useState<DjEngineState>({
    current: playlist[0] || null,
    next: playlist[1] || null,
    isPlaying: false,
    position: 0,
    currentTime: 0,
    duration: 0,
    volume: 0.75,
    bpm: referenceBpm,
    playbackRate: 1,
    crossfading: false,
    loop: false,
    autoMix: true,
    ready: false,
  });

  // Keep the latest playlist reachable from callbacks without re-binding them.
  useEffect(() => {
    playlistRef.current = playlist;
    setState((s) => {
      const nextCurrent =
        s.current && playlist.some((t) => String(t.id) === String(s.current?.id)) ? s.current : playlist[0] || null;
      const nextNext = s.next && playlist.some((t) => String(t.id) === String(s.next?.id)) ? s.next : playlist[1] || null;
      // Bail out (return the same state) when nothing changed so a playlist
      // array whose identity churns every render can't trigger a render loop.
      if (nextCurrent === s.current && nextNext === s.next) return s;
      return { ...s, current: nextCurrent, next: nextNext };
    });
  }, [playlist]);

  // Lazily create the two <audio> decks (browser only).
  const decks = (): HTMLAudioElement[] => {
    if (decksRef.current) return decksRef.current;
    if (typeof window === "undefined") return [];
    const a = new Audio();
    const b = new Audio();
    [a, b].forEach((el) => {
      el.preload = "auto";
      // NOTE: do NOT set crossOrigin="anonymous". We play remote Firebase/CDN
      // audio with plain <audio> (no Web Audio graph), so CORS is not required;
      // forcing crossOrigin would make tracks fail to load on buckets that
      // don't return Access-Control-Allow-Origin.
      el.volume = 0;
    });
    decksRef.current = [a, b];
    return decksRef.current;
  };

  const liveDeck = () => decks()[activeRef.current];
  const idleDeck = () => decks()[activeRef.current === 0 ? 1 : 0];

  const applyRate = useCallback(
    (el: HTMLAudioElement) => {
      const rate = clamp(targetBpmRef.current / referenceBpm, 0.85, 1.15);
      try {
        el.playbackRate = rate;
      } catch {
        /* some browsers cap playbackRate */
      }
      return rate;
    },
    [referenceBpm],
  );

  const cancelFade = () => {
    if (fadeRafRef.current) cancelAnimationFrame(fadeRafRef.current);
    fadeRafRef.current = 0;
  };

  // Animate a volume ramp on one deck; resolves when done.
  const rampVolume = (el: HTMLAudioElement, from: number, to: number, seconds: number, onDone?: () => void) => {
    const start = performance.now();
    const dur = Math.max(60, seconds * 1000);
    const step = (now: number) => {
      const k = clamp((now - start) / dur, 0, 1);
      el.volume = clamp(from + (to - from) * k, 0, 1);
      if (k < 1) {
        fadeRafRef.current = requestAnimationFrame(step);
      } else {
        onDone?.();
      }
    };
    fadeRafRef.current = requestAnimationFrame(step);
  };

  // Lazily create / resume the shared AudioContext.
  const ensureCtx = (): AudioContext | null => {
    if (typeof window === "undefined") return null;
    if (!audioCtxRef.current) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      try {
        audioCtxRef.current = new Ctx();
      } catch {
        return null;
      }
    }
    if (audioCtxRef.current?.state === "suspended") audioCtxRef.current.resume().catch(() => undefined);
    return audioCtxRef.current;
  };

  // Probe whether a URL is CORS-accessible (cached per origin). Same-origin is
  // always OK; cross-origin requires Access-Control-Allow-Origin on a HEAD.
  const corsOk = async (url: string): Promise<boolean> => {
    let origin = "";
    try {
      origin = new URL(url, window.location.href).origin;
    } catch {
      return false;
    }
    if (origin === window.location.origin) return true;
    if (corsCacheRef.current.has(origin)) return corsCacheRef.current.get(origin)!;
    try {
      const r = await fetch(url, { method: "HEAD", mode: "cors" });
      const ok = r.ok || r.type === "cors";
      corsCacheRef.current.set(origin, ok);
      return ok;
    } catch {
      corsCacheRef.current.set(origin, false);
      return false;
    }
  };

  // Route a deck through a high-pass → low-pass chain once it's CORS-safe.
  // Returns the filter record, or null when Web Audio can't be used (the deck
  // then keeps its plain HTMLAudio output untouched).
  const ensureDeckGraph = (el: HTMLAudioElement): { lp: BiquadFilterNode; hp: BiquadFilterNode } | null => {
    if (nodeMapRef.current.has(el)) return nodeMapRef.current.get(el)!;
    if (triedSourceRef.current.has(el)) return null;
    const ctx = ensureCtx();
    if (!ctx) return null;
    triedSourceRef.current.add(el);
    try {
      const source = ctx.createMediaElementSource(el);
      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 0; // fully open (no low cut)
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = ctx.sampleRate / 2; // fully open (no high cut)
      source.connect(hp);
      hp.connect(lp);
      lp.connect(ctx.destination);
      const rec = { lp, hp };
      nodeMapRef.current.set(el, rec);
      return rec;
    } catch {
      return null;
    }
  };

  // Audible filter sweep for energy moves / drops. No-op (returns false) when
  // the deck has no Web Audio graph — callers keep their playbackRate fallback.
  const filterSweep = (el: HTMLAudioElement | undefined, kind: "open" | "lowpass" | "dip", seconds: number): boolean => {
    if (!el) return false;
    const rec = nodeMapRef.current.get(el);
    const ctx = audioCtxRef.current;
    if (!rec || !ctx) return false;
    const now = ctx.currentTime;
    const nyq = ctx.sampleRate / 2;
    const lpStart = rec.lp.frequency.value || nyq;
    const hpStart = rec.hp.frequency.value || 0;
    try {
      if (kind === "lowpass") {
        // Muffle the floor: sweep the low-pass down then settle slightly open.
        rec.lp.frequency.cancelScheduledValues(now);
        rec.lp.frequency.setValueAtTime(lpStart, now);
        rec.lp.frequency.exponentialRampToValueAtTime(600, now + seconds * 0.4);
        rec.lp.frequency.exponentialRampToValueAtTime(2500, now + seconds);
      } else if (kind === "open") {
        // Brighten + lift: open the low-pass, briefly high-pass the lows then release.
        rec.lp.frequency.cancelScheduledValues(now);
        rec.lp.frequency.setValueAtTime(lpStart, now);
        rec.lp.frequency.exponentialRampToValueAtTime(nyq, now + seconds);
        rec.hp.frequency.cancelScheduledValues(now);
        rec.hp.frequency.setValueAtTime(Math.max(hpStart, 1), now);
        rec.hp.frequency.exponentialRampToValueAtTime(400, now + seconds * 0.5);
        rec.hp.frequency.exponentialRampToValueAtTime(1, now + seconds);
      } else {
        // Drop: quick low-pass dip then snap back open.
        rec.lp.frequency.cancelScheduledValues(now);
        rec.lp.frequency.setValueAtTime(nyq, now);
        rec.lp.frequency.exponentialRampToValueAtTime(300, now + 0.4);
        rec.lp.frequency.exponentialRampToValueAtTime(nyq, now + 1.4);
      }
      return true;
    } catch {
      return false;
    }
  };

  const findIndex = (id?: number | string | null) =>
    id == null ? -1 : playlistRef.current.findIndex((t) => String(t.id) === String(id));

  // Load a track onto a deck and (optionally) start it.
  const loadDeck = (el: HTMLAudioElement, track: DeckTrack, startPlaying: boolean, startVolume: number): Promise<void> => {
    return new Promise((resolve) => {
      if (!track.audioUrl) {
        resolve();
        return;
      }
      const url = track.audioUrl;
      // Decide CORS up-front: only request with crossOrigin when the source is
      // CORS-safe, so we can later tap it with Web Audio without muting it.
      void corsOk(url).then((ok) => {
        try {
          if (ok && !triedSourceRef.current.has(el)) el.crossOrigin = "anonymous";
          else if (!ok) el.crossOrigin = null;
        } catch {
          /* ignore */
        }
        el.src = url;
        el.loop = false;
        el.volume = clamp(startVolume, 0, 1);
        applyRate(el);
        const onReady = () => {
          el.removeEventListener("canplay", onReady);
          applyRate(el);
          if (ok) ensureDeckGraph(el); // safe no-op if it can't attach
          if (startPlaying) el.play().catch(() => undefined);
          resolve();
        };
        el.addEventListener("canplay", onReady);
        try {
          el.load();
        } catch {
          /* ignore */
        }
        // Safety: resolve even if canplay never fires (e.g. cached / blocked).
        window.setTimeout(() => {
          el.removeEventListener("canplay", onReady);
          if (ok) ensureDeckGraph(el);
          if (startPlaying && el.paused) el.play().catch(() => undefined);
          resolve();
        }, 1500);
      });
    });
  };

  // ── Public controls ──────────────────────────────────────────────────────

  const play = useCallback(async () => {
    const el = liveDeck();
    if (!el) return;
    const cur = state.current || playlistRef.current[0];
    if (!cur?.audioUrl) {
      onAction?.("Playback", "The selected track has no audio file yet.");
      return;
    }
    if (!el.src || findIndex(cur.id) < 0 || el.src === window.location.href) {
      await loadDeck(el, cur, false, volumeRef.current);
    }
    ensureCtx(); // resume Web Audio on this user gesture (if available)
    applyRate(el);
    el.volume = volumeRef.current;
    try {
      await el.play();
      setState((s) => ({ ...s, isPlaying: true, current: cur, ready: true }));
    } catch {
      onAction?.("Playback", "Tap play again — the browser blocked autoplay.");
    }
  }, [state.current, onAction, applyRate]);

  const pause = useCallback(() => {
    decks().forEach((d) => {
      try {
        d.pause();
      } catch {
        /* ignore */
      }
    });
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const toggle = useCallback(() => {
    if (state.isPlaying) pause();
    else void play();
  }, [state.isPlaying, pause, play]);

  // Crossfade from the live deck into `track` on the idle deck.
  const crossfadeTo = useCallback(
    async (track: DeckTrack | null, opts?: { seconds?: number; report?: boolean }) => {
      if (!track?.audioUrl) {
        onAction?.("Transition", "Next track has no audio to mix into.");
        return;
      }
      const seconds = opts?.seconds ?? crossfadeSeconds;
      cancelFade();
      const live = liveDeck();
      const idle = idleDeck();
      await loadDeck(idle, track, true, 0);
      applyRate(idle);
      setState((s) => ({ ...s, crossfading: true, next: null }));
      const fromLive = live?.volume ?? volumeRef.current;
      // Fade the incoming deck up.
      rampVolume(idle, 0, volumeRef.current, seconds);
      // Fade the outgoing deck down in parallel (separate rAF via timeout chain).
      const outStart = performance.now();
      const outDur = Math.max(60, seconds * 1000);
      const fadeOut = (now: number) => {
        const k = clamp((now - outStart) / outDur, 0, 1);
        if (live) live.volume = clamp(fromLive * (1 - k), 0, 1);
        if (k < 1) {
          requestAnimationFrame(fadeOut);
        } else {
          try {
            live?.pause();
          } catch {
            /* ignore */
          }
          activeRef.current = activeRef.current === 0 ? 1 : 0;
          autoMixGuardRef.current = false;
          setState((s) => ({ ...s, crossfading: false, isPlaying: true, current: track }));
          onTrackChange?.(track);
          if (opts?.report !== false) onAction?.("Transition", `Mixed into ${track.title}.`);
        }
      };
      requestAnimationFrame(fadeOut);
    },
    [crossfadeSeconds, onAction, onTrackChange, applyRate],
  );

  const pickNext = useCallback(
    (mode: "next" | "prev" | "shuffle" | "energyUp" | "energyDown", energyHint?: number): DeckTrack | null => {
      const list = playlistRef.current.filter((t) => t.audioUrl);
      if (!list.length) return null;
      const curId = state.current?.id;
      const curIdx = list.findIndex((t) => String(t.id) === String(curId));
      if (mode === "shuffle") {
        if (list.length === 1) return list[0];
        let r = curIdx;
        while (r === curIdx) r = Math.floor(Math.random() * list.length);
        return list[r];
      }
      if (mode === "energyUp" || mode === "energyDown") {
        // Prefer tracks whose suited energy is higher/lower than the hint.
        const target = energyHint ?? 80;
        const scored = list
          .filter((t) => String(t.id) !== String(curId))
          .map((t) => ({ t, e: typeof t.energy === "number" ? t.energy : 75 }))
          .sort((a, b) => (mode === "energyUp" ? b.e - a.e : a.e - b.e));
        const matched = scored.find((s) => (mode === "energyUp" ? s.e >= target : s.e <= target));
        return (matched || scored[0])?.t || list[(curIdx + 1) % list.length];
      }
      const delta = mode === "prev" ? -1 : 1;
      const idx = curIdx < 0 ? 0 : (curIdx + delta + list.length) % list.length;
      return list[idx];
    },
    [state.current],
  );

  const next = useCallback(
    (mode: "next" | "prev" | "shuffle" = "next") => {
      const target = pickNext(mode);
      if (target) void crossfadeTo(target, { seconds: state.isPlaying ? crossfadeSeconds : 0.4 });
    },
    [pickNext, crossfadeTo, state.isPlaying, crossfadeSeconds],
  );

  const shuffle = useCallback(() => next("shuffle"), [next]);

  const setVolume = useCallback((v: number) => {
    const vol = clamp(v, 0, 1);
    volumeRef.current = vol;
    const live = liveDeck();
    if (live && !state.crossfading) live.volume = vol;
    setState((s) => ({ ...s, volume: vol }));
  }, [state.crossfading]);

  const setBpm = useCallback(
    (bpm: number) => {
      const target = clamp(bpm, 90, 140);
      targetBpmRef.current = target;
      const rate = applyRate(liveDeck());
      applyRate(idleDeck());
      setState((s) => ({ ...s, bpm: target, playbackRate: rate }));
    },
    [applyRate],
  );

  const raiseEnergy = useCallback(
    (energyHint?: number) => {
      setBpm(clamp(targetBpmRef.current + 3, 90, 140));
      filterSweep(liveDeck(), "open", 2.5); // audible brighten when Web Audio is available
      const target = pickNext("energyUp", energyHint);
      if (target && String(target.id) !== String(state.current?.id)) {
        void crossfadeTo(target, { seconds: crossfadeSeconds });
      }
      onAction?.("Raise energy", "Tempo nudged up and energy track queued.");
    },
    [setBpm, pickNext, crossfadeTo, crossfadeSeconds, state.current, onAction],
  );

  const lowerEnergy = useCallback(
    (energyHint?: number) => {
      setBpm(clamp(targetBpmRef.current - 4, 90, 140));
      filterSweep(liveDeck(), "lowpass", 3); // audible muffle when Web Audio is available
      const target = pickNext("energyDown", energyHint);
      if (target && String(target.id) !== String(state.current?.id)) {
        void crossfadeTo(target, { seconds: crossfadeSeconds + 2 });
      }
      onAction?.("Lower energy", "Tempo eased down for a smoother floor.");
    },
    [setBpm, pickNext, crossfadeTo, crossfadeSeconds, state.current, onAction],
  );

  const toggleLoop = useCallback(() => {
    const live = liveDeck();
    const nextLoop = !state.loop;
    if (live) live.loop = nextLoop;
    setState((s) => ({ ...s, loop: nextLoop }));
    onAction?.("Loop", nextLoop ? "Loop engaged on the live deck." : "Loop released.");
  }, [state.loop, onAction]);

  const triggerDrop = useCallback(() => {
    const live = liveDeck();
    if (!live) return;
    cancelFade();
    const base = volumeRef.current;
    filterSweep(live, "dip", 1.4); // low-pass dip alongside the volume duck
    // Quick duck then swell — a simple, reliable "drop" without Web Audio.
    rampVolume(live, base, base * 0.25, 0.5, () => {
      rampVolume(live, base * 0.25, base, 1.1);
    });
    onAction?.("Create drop", "Energy drop fired on the live deck.");
  }, [onAction]);

  const loadTrack = useCallback(
    (track: DeckTrack | null, autoplay = false) => {
      if (!track) return;
      const live = liveDeck();
      setState((s) => ({ ...s, current: track }));
      if (live) void loadDeck(live, track, autoplay && volumeRef.current > 0 ? true : false, volumeRef.current).then(() => {
        if (autoplay) setState((s) => ({ ...s, isPlaying: !live.paused }));
      });
    },
    [],
  );

  const setAutoMix = useCallback((on: boolean) => {
    autoMixRef.current = on;
    setState((s) => ({ ...s, autoMix: on }));
  }, []);

  // ── Live tick: progress + autonomous auto-mix tail trigger ────────────────
  useEffect(() => {
    const tick = () => {
      const live = decksRef.current?.[activeRef.current];
      if (live && Number.isFinite(live.duration) && live.duration > 0) {
        const position = clamp(live.currentTime / live.duration, 0, 1);
        setState((s) =>
          s.currentTime === live.currentTime && s.duration === live.duration
            ? s
            : { ...s, position, currentTime: live.currentTime, duration: live.duration },
        );
        const remaining = live.duration - live.currentTime;
        if (
          autoMixRef.current &&
          !live.loop &&
          !autoMixGuardRef.current &&
          !live.paused &&
          remaining > 0 &&
          remaining <= autoMixTailSeconds
        ) {
          autoMixGuardRef.current = true;
          const target = pickNext("next");
          if (target) void crossfadeTo(target, { seconds: Math.min(autoMixTailSeconds, crossfadeSeconds) });
        }
      }
      tickRafRef.current = requestAnimationFrame(tick);
    };
    tickRafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(tickRafRef.current);
  }, [autoMixTailSeconds, crossfadeSeconds, pickNext, crossfadeTo]);

  // Cleanup on unmount.
  useEffect(
    () => () => {
      cancelFade();
      cancelAnimationFrame(tickRafRef.current);
      decksRef.current?.forEach((d) => {
        try {
          d.pause();
          d.src = "";
        } catch {
          /* ignore */
        }
      });
      decksRef.current = null;
    },
    [],
  );

  // Close the AudioContext on unmount (kept separate so deck cleanup above
  // stays focused on the HTMLAudio elements).
  useEffect(
    () => () => {
      try {
        void audioCtxRef.current?.close();
      } catch {
        /* ignore */
      }
      audioCtxRef.current = null;
      nodeMapRef.current.clear();
    },
    [],
  );

  const controls = useMemo(
    () => ({
      play,
      pause,
      toggle,
      next,
      shuffle,
      crossfadeTo,
      setVolume,
      setBpm,
      raiseEnergy,
      lowerEnergy,
      toggleLoop,
      triggerDrop,
      loadTrack,
      setAutoMix,
      pickNext,
    }),
    [play, pause, toggle, next, shuffle, crossfadeTo, setVolume, setBpm, raiseEnergy, lowerEnergy, toggleLoop, triggerDrop, loadTrack, setAutoMix, pickNext],
  );

  return { state, controls };
}
