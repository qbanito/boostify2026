// ─── MotionTakesLibrary ───────────────────────────────────────────────────────
// Modern, self-contained library + player for an artist's recorded motion-capture
// takes. Saved takes live in the `motion_capture_takes` table (Firebase Storage
// JSON + Postgres row). This component fetches them, renders a sleek player with a
// live progress bar, and "plays" a take by streaming its frames back into the
// artist's Live Link room (`${artistId}:livelink`) as mocap — so the avatar in the
// studio, the showcase, AND the HoloStudio stage all replay the performance.
//
// Used by both the Motion Capture Studio and the HoloStage dashboard so the
// repertoire-synced takes are connected everywhere.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Play, Square, Trash2, Music, Disc3, Loader2, RefreshCw, Radio,
  Smartphone, Webcam, Shirt, ScanFace, Clock,
} from "lucide-react";
import { apiRequest } from "../../lib/queryClient";

export interface MotionTake {
  id: number;
  title: string;
  songId?: number | null;
  songTitle?: string | null;
  source: string;
  motionUrl: string;
  durationMs: number;
  frameCount: number;
  fps: number;
  hasFace: boolean;
  thumbnailUrl?: string | null;
  createdAt: string;
}

interface MocapFrameLike {
  t?: number;
  [k: string]: unknown;
}

interface Props {
  artistId: string | number;
  /** Bump this number to force a refetch (e.g. after saving a new take). */
  reloadSignal?: number;
  /** Compact layout for narrow side panels (HoloStudio). */
  compact?: boolean;
  /** Surface a status / error message to the host page. */
  onNotice?: (msg: string) => void;
  className?: string;
}

const SOURCE_META: Record<string, { label: string; Icon: React.ComponentType<{ className?: string }>; color: string }> = {
  phone: { label: "Phone", Icon: Smartphone, color: "#22d3ee" },
  webcam: { label: "Webcam", Icon: Webcam, color: "#a78bfa" },
  suit: { label: "MoCap suit", Icon: Shirt, color: "#fbbf24" },
};

function fmtTime(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function MotionTakesLibrary({ artistId, reloadSignal = 0, compact = false, onNotice, className }: Props) {
  const [takes, setTakes] = useState<MotionTake[]>([]);
  const [loading, setLoading] = useState(true);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0); // 0..1
  const [elapsed, setElapsed] = useState(0); // ms
  const [busyId, setBusyId] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const timersRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const playStartRef = useRef(0);
  const playDurRef = useRef(0);
  // Backing audio element + songId→audioUrl map so a take that was recorded
  // against a song replays its music in sync with the motion.
  const audioRef = useRef<HTMLAudioElement>(null);
  const [songAudio, setSongAudio] = useState<Record<number, string>>({});

  const notify = useCallback((m: string) => onNotice?.(m), [onNotice]);

  const loadTakes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/motion-capture/${encodeURIComponent(String(artistId))}/takes`);
      const data = res.ok ? await res.json() : null;
      if (data?.success && Array.isArray(data.takes)) setTakes(data.takes);
      else setTakes([]);
    } catch {
      setTakes([]);
    } finally {
      setLoading(false);
    }
  }, [artistId]);

  useEffect(() => { loadTakes(); }, [loadTakes, reloadSignal]);

  // Build a songId→audioUrl map from the artist's repertoire so playback can
  // line the music up with the recorded motion.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/songs/user/${encodeURIComponent(String(artistId))}`);
        const data = res.ok ? await res.json() : [];
        if (active && Array.isArray(data)) {
          const map: Record<number, string> = {};
          for (const s of data) if (s?.id != null && s?.audioUrl) map[s.id] = s.audioUrl;
          setSongAudio(map);
        }
      } catch { /* repertoire is optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  const stopPlayback = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    const a = audioRef.current;
    if (a) { try { a.pause(); } catch { /* ignore */ } }
    setPlayingId(null);
    setProgress(0);
    setElapsed(0);
  }, []);

  // Smooth progress bar driven by elapsed wall-clock time vs the take duration.
  const tickProgress = useCallback(() => {
    const dur = playDurRef.current || 1;
    const e = performance.now() - playStartRef.current;
    setElapsed(Math.min(e, dur));
    setProgress(Math.min(1, e / dur));
    if (e < dur) rafRef.current = requestAnimationFrame(tickProgress);
  }, []);

  const playTake = useCallback(async (take: MotionTake) => {
    stopPlayback();
    try {
      const res = await fetch(take.motionUrl);
      const data = res.ok ? await res.json() : null;
      const frames: MocapFrameLike[] = Array.isArray(data?.frames) ? data.frames : [];
      if (!frames.length) { notify("This take has no motion data."); return; }

      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const qs = new URLSearchParams({ role: "mocap", artistId: String(artistId), showId: "livelink", label: "take-playback" });
      const ws = new WebSocket(`${proto}://${window.location.host}/ws/holostage?${qs.toString()}`);
      wsRef.current = ws;
      setPlayingId(take.id);
      const dur = take.durationMs || (frames[frames.length - 1]?.t as number) || 0;
      playDurRef.current = dur;

      ws.onopen = () => {
        playStartRef.current = performance.now();
        // Start the song from the top in sync with the motion playback.
        const audioUrl = take.songId != null ? songAudio[take.songId] : undefined;
        const a = audioRef.current;
        if (a && audioUrl) {
          try {
            if (a.src !== audioUrl) { a.src = audioUrl; a.load(); }
            a.currentTime = 0;
            a.play().catch(() => { /* autoplay may be blocked */ });
          } catch { /* ignore */ }
        }
        rafRef.current = requestAnimationFrame(tickProgress);
        frames.forEach((f) => {
          const at = Math.max(0, (f.t as number) || 0);
          const timer = window.setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              const { t, ...frame } = f;
              try { ws.send(JSON.stringify({ type: "mocap", frame })); } catch { /* ignore */ }
            }
          }, at);
          timersRef.current.push(timer);
        });
        const endTimer = window.setTimeout(() => stopPlayback(), dur + 600);
        timersRef.current.push(endTimer);
      };
      ws.onerror = () => { notify("Live Link connection failed."); stopPlayback(); };
    } catch (e: any) {
      notify(e?.message || "Could not play this take.");
      stopPlayback();
    }
  }, [artistId, stopPlayback, tickProgress, notify, songAudio]);

  const deleteTake = useCallback(async (take: MotionTake) => {
    setBusyId(take.id);
    try {
      if (playingId === take.id) stopPlayback();
      await apiRequest({ url: `/api/motion-capture/takes/${take.id}`, method: "DELETE" });
      setTakes((prev) => prev.filter((t) => t.id !== take.id));
    } catch (e: any) {
      notify(e?.message || "Could not delete the take.");
    } finally {
      setBusyId(null);
    }
  }, [playingId, stopPlayback, notify]);

  // Clean up on unmount.
  useEffect(() => () => {
    timersRef.current.forEach((t) => clearTimeout(t));
    cancelAnimationFrame(rafRef.current);
    try { wsRef.current?.close(); } catch { /* ignore */ }
  }, []);

  const nowPlaying = useMemo(() => takes.find((t) => t.id === playingId) || null, [takes, playingId]);

  return (
    <div className={className}>
      {/* Hidden audio element — plays the take's song in sync during playback. */}
      <audio ref={audioRef} preload="auto" />
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Disc3 className={`w-4 h-4 text-cyan-400 ${playingId ? "animate-spin" : ""}`} />
        <h3 className="text-sm font-black text-white">Motion takes</h3>
        <span className="text-[11px] text-zinc-500">{takes.length} saved</span>
        <button
          onClick={loadTakes}
          className="ml-auto p-1.5 rounded-lg transition-colors hover:bg-white/10 text-zinc-400 hover:text-cyan-300"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Now-playing bar */}
      {nowPlaying && (
        <div
          className="mb-4 rounded-2xl p-3 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(0,245,255,0.12), rgba(139,92,246,0.12))", border: "1px solid rgba(0,245,255,0.35)" }}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(0,0,0,0.4)" }}>
              {nowPlaying.thumbnailUrl
                ? <img src={nowPlaying.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                : <Music className="w-5 h-5 text-cyan-300" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full" style={{ background: "rgba(0,245,255,0.2)", color: "#7df9ff" }}>
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> On air
                </span>
                <p className="text-sm font-bold text-white truncate">{nowPlaying.title}</p>
              </div>
              {nowPlaying.songTitle && <p className="text-[11px] text-cyan-200/80 truncate">🎵 {nowPlaying.songTitle}</p>}
            </div>
            <button
              onClick={stopPlayback}
              className="p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 shrink-0"
              style={{ background: "rgba(255,80,80,0.18)", color: "#ff7676", border: "1px solid rgba(255,80,80,0.45)" }}
              title="Stop"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>
          </div>
          {/* Progress */}
          <div className="mt-3 flex items-center gap-2">
            <span className="text-[10px] font-mono text-cyan-200/80 tabular-nums">{fmtTime(elapsed)}</span>
            <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.12)" }}>
              <div className="h-full rounded-full transition-[width] duration-100" style={{ width: `${progress * 100}%`, background: "linear-gradient(90deg, #00f5ff, #8b5cf6)" }} />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 tabular-nums">{fmtTime(playDurRef.current)}</span>
          </div>
        </div>
      )}

      {/* Body */}
      {loading && takes.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
        </div>
      ) : takes.length === 0 ? (
        <p className="text-xs text-zinc-500 leading-relaxed py-2">
          No takes yet. Record a performance from the phone or webcam — pick a song, hit <b>Stop &amp; save</b>, and it appears here ready to play on the avatar.
        </p>
      ) : (
        <div className={compact ? "flex flex-col gap-2" : "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"}>
          {takes.map((take) => {
            const isPlaying = playingId === take.id;
            const src = SOURCE_META[take.source] || { label: take.source, Icon: Webcam, color: "#9aa" };
            const SrcIcon = src.Icon;
            return (
              <div
                key={take.id}
                className="rounded-xl p-3 flex flex-col gap-2.5 transition-all"
                style={{
                  background: isPlaying ? "rgba(0,245,255,0.08)" : "rgba(0,0,0,0.28)",
                  border: `1px solid ${isPlaying ? "rgba(0,245,255,0.4)" : "rgba(255,255,255,0.1)"}`,
                }}
              >
                <div className="flex items-start gap-2.5">
                  <div className="w-11 h-11 rounded-lg overflow-hidden flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,0.05)" }}>
                    {take.thumbnailUrl
                      ? <img src={take.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      : <Music className="w-4 h-4 text-zinc-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">{take.title}</p>
                    {take.songTitle && <p className="text-[10px] text-purple-300/80 truncate">🎵 {take.songTitle}</p>}
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: `${src.color}1a`, color: src.color }}>
                        <SrcIcon className="w-2.5 h-2.5" /> {src.label}
                      </span>
                      <span className="flex items-center gap-1 text-[9px] text-zinc-500"><Clock className="w-2.5 h-2.5" /> {fmtTime(take.durationMs)}</span>
                      {take.hasFace && (
                        <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,255,155,0.12)", color: "#22ff9b" }}>
                          <ScanFace className="w-2.5 h-2.5" /> Face
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => (isPlaying ? stopPlayback() : playTake(take))}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg font-bold text-xs transition-all hover:scale-[1.02] active:scale-95"
                    style={{
                      background: isPlaying ? "rgba(255,80,80,0.16)" : "linear-gradient(135deg, rgba(0,245,255,0.16), rgba(139,92,246,0.16))",
                      color: isPlaying ? "#ff7676" : "#7df9ff",
                      border: `1px solid ${isPlaying ? "rgba(255,80,80,0.4)" : "rgba(0,245,255,0.35)"}`,
                    }}
                  >
                    {isPlaying ? <><Square className="w-3.5 h-3.5 fill-current" /> Stop</> : <><Play className="w-3.5 h-3.5 fill-current" /> Play on avatar</>}
                  </button>
                  <button
                    onClick={() => deleteTake(take)}
                    disabled={busyId === take.id}
                    className="p-2 rounded-lg transition-all hover:bg-red-500/10 disabled:opacity-50"
                    style={{ border: "1px solid rgba(255,80,80,0.3)", color: "#ff7676" }}
                    title="Delete take"
                  >
                    {busyId === take.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
