// ─── Motion Capture · Mobile camera (Live Link sender) ──────────────────────
// Opened by scanning the QR shown in the desktop Motion Capture studio. Turns
// the phone into a wireless motion-capture camera — no App Store app needed,
// it's just this web page. MediaPipe runs on-device; only the extracted bone
// directions + face blendshapes are streamed over the HoloStage gateway into
// the artist's Live Link room, where the desktop drives & records the avatar.
// The artist can pick a song from their repertoire to perform to (it plays here
// on the phone and tells the desktop which song the take belongs to).

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "wouter";
import { Activity, Camera, CameraOff, FlipHorizontal, Crosshair, Loader2, Music, Wifi, WifiOff, RefreshCw, Play, Pause } from "lucide-react";
import { WebcamMocap } from "../lib/motion/poseMocap";
import type { MocapFrame } from "../lib/motion/liveRetarget";

interface Song {
  id: number;
  title: string;
  audioUrl?: string;
  coverArt?: string;
}

function useQueryParam(name: string): string {
  const [val] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get(name) || "";
  });
  return val;
}

export default function MotionCaptureMobile() {
  const params = useParams();
  const artistId = String(params.artistId || "");
  const token = useQueryParam("s");

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const mocapRef = useRef<WebcamMocap | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSentRef = useRef(0);
  const frameCountRef = useRef(0);
  const pendingCalibrateRef = useRef(false);

  const [pairState, setPairState] = useState<"checking" | "valid" | "invalid">("checking");
  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [fps, setFps] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [playing, setPlaying] = useState(false);

  // 1) Validate the pairing token.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!token) { setPairState("invalid"); return; }
      try {
        const res = await fetch(`/api/motion-capture/pair/${encodeURIComponent(token)}`);
        const data = res.ok ? await res.json() : null;
        if (!active) return;
        if (data?.valid && String(data.artistId) === artistId) {
          setPairState("valid");
          // Tell the desktop the phone arrived.
          fetch(`/api/motion-capture/pair/${encodeURIComponent(token)}/claim`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label: "Phone camera" }),
          }).catch(() => {});
        } else {
          setPairState("invalid");
        }
      } catch {
        if (active) setPairState("invalid");
      }
    })();
    return () => { active = false; };
  }, [token, artistId]);

  // 2) Fetch the artist's repertoire so the performer can sing to a track.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/songs/user/${encodeURIComponent(artistId)}`);
        const data = res.ok ? await res.json() : [];
        if (active && Array.isArray(data)) {
          setSongs(data.filter((s: Song) => s?.audioUrl).map((s: Song) => ({ id: s.id, title: s.title, audioUrl: s.audioUrl, coverArt: s.coverArt })));
        }
      } catch { /* repertoire is optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  useEffect(() => { mocapRef.current?.setMirror(mirror); }, [mirror]);

  const sendCue = useCallback((cue: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "cue", cue })); } catch { /* ignore */ }
    }
  }, []);

  const openSocket = useCallback(() => {
    if (typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const qs = new URLSearchParams({ role: "mocap", artistId, showId: "livelink", label: "phone-camera" });
    const url = `${proto}://${window.location.host}/ws/holostage?${qs.toString()}`;
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { return; }
    wsRef.current = ws;
    ws.onopen = () => {
      setConnected(true);
      if (selectedSong) sendCue({ songId: selectedSong.id, songTitle: selectedSong.title, playing });
    };
    // React to the operator's cues so the music on the phone starts/stops in
    // sync with the capture the studio is recording. The studio sends a
    // flattened cue: { type: "cue", action: "song-play" | "song-stop", ... }.
    ws.onmessage = (ev) => {
      let msg: any;
      try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
      if (!msg || msg.type !== "cue") return;
      const action = msg.action ?? msg.cue?.action;
      const a = audioRef.current;
      if (!a) return;
      if (action === "song-play") {
        const songId = msg.songId ?? msg.cue?.songId;
        const audioUrl = msg.audioUrl ?? msg.cue?.audioUrl ?? songs.find((s) => s.id === songId)?.audioUrl;
        const song = songs.find((s) => s.id === songId) ?? null;
        if (song) setSelectedSong(song);
        if (audioUrl) {
          try {
            if (a.src !== audioUrl) { a.src = audioUrl; a.load(); }
            a.currentTime = 0;
            a.play().then(() => setPlaying(true)).catch(() => { /* autoplay may be blocked */ });
          } catch { /* ignore */ }
        }
      } else if (action === "song-stop") {
        try { a.pause(); setPlaying(false); } catch { /* ignore */ }
      }
    };
    ws.onclose = () => {
      setConnected(false);
      if (mocapRef.current) setTimeout(openSocket, 1500);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }, [artistId, selectedSong, playing, sendCue, songs]);

  const sendFrame = useCallback((frame: MocapFrame) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "mocap", frame })); } catch { /* ignore */ }
    }
  }, []);

  const loop = useCallback(() => {
    const video = videoRef.current;
    const mocap = mocapRef.current;
    if (!video || !mocap) return;
    const now = performance.now();
    const frame = mocap.detect(video, now);
    if (frame) {
      setTracking(true);
      if (pendingCalibrateRef.current) {
        frame.calibrate = true;
        pendingCalibrateRef.current = false;
        setCalibrated(true);
      }
      if (frame.calibrate || now - lastSentRef.current >= 33) {
        sendFrame(frame);
        lastSentRef.current = now;
        frameCountRef.current++;
      }
    } else {
      setTracking(false);
    }
    rafRef.current = requestAnimationFrame(loop);
  }, [sendFrame]);

  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => { setFps(frameCountRef.current); frameCountRef.current = 0; }, 1000);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 720 }, height: { ideal: 1280 }, facingMode: facing },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      const mocap = new WebcamMocap({ mirror });
      mocapRef.current = mocap;
      await mocap.init();

      openSocket();
      setStatus("running");
      lastSentRef.current = 0;
      rafRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(
        err?.name === "NotAllowedError"
          ? "Camera permission denied. Allow camera access in your browser and try again."
          : err?.message || "Couldn't start the camera.",
      );
    }
  }, [mirror, facing, openSocket, loop]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mocapRef.current?.close();
    mocapRef.current = null;
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    audioRef.current?.pause();
    setStatus("idle");
    setConnected(false);
    setTracking(false);
    setCalibrated(false);
    setPlaying(false);
    pendingCalibrateRef.current = false;
    setFps(0);
  }, []);

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mocapRef.current?.close();
    try { wsRef.current?.close(); } catch { /* ignore */ }
  }, []);

  const pickSong = useCallback((song: Song | null) => {
    setSelectedSong(song);
    const a = audioRef.current;
    if (a) {
      a.pause();
      setPlaying(false);
      if (song?.audioUrl) { a.src = song.audioUrl; a.load(); }
    }
    sendCue(song ? { songId: song.id, songTitle: song.title, playing: false } : { songId: null, songTitle: null, playing: false });
  }, [sendCue]);

  const togglePlay = useCallback(async () => {
    const a = audioRef.current;
    if (!a || !selectedSong?.audioUrl) return;
    if (a.paused) {
      try { await a.play(); setPlaying(true); sendCue({ songId: selectedSong.id, songTitle: selectedSong.title, playing: true }); } catch { /* ignore */ }
    } else {
      a.pause(); setPlaying(false); sendCue({ songId: selectedSong.id, songTitle: selectedSong.title, playing: false });
    }
  }, [selectedSong, sendCue]);

  const running = status === "running";

  if (pairState === "invalid") {
    return (
      <div className="min-h-screen w-full flex items-center justify-center text-white p-6" style={{ background: "radial-gradient(circle at 50% 0%, #0a1422, #04070d 70%)" }}>
        <div className="text-center max-w-sm">
          <WifiOff className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h1 className="text-xl font-black mb-2">Pairing link expired</h1>
          <p className="text-zinc-400 text-sm">This QR code is no longer valid. Open the Motion Capture studio on your computer and scan a fresh code.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full text-white flex flex-col" style={{ background: "radial-gradient(circle at 50% 0%, #0a1422, #04070d 70%)" }}>
      <audio ref={audioRef} preload="auto" playsInline />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.35)" }}>
            <Camera className="w-4 h-4 text-cyan-400" />
          </div>
          <div>
            <p className="text-sm font-black leading-tight">Phone Camera · Live Link</p>
            <p className="text-[11px] text-zinc-400 leading-tight">Your motion drives the avatar on the computer</p>
          </div>
        </div>
        {connected ? (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black" style={{ background: "rgba(34,255,155,0.15)", color: "#22ff9b", border: "1px solid rgba(34,255,155,0.4)" }}>
            <Wifi className="w-3 h-3" /> Live
          </span>
        ) : (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(255,255,255,0.08)", color: "#aaa" }}>
            <WifiOff className="w-3 h-3" /> Idle
          </span>
        )}
      </div>

      {/* Camera */}
      <div className="relative flex-1 bg-black mx-4 rounded-2xl overflow-hidden" style={{ minHeight: "45vh" }}>
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: mirror ? "scaleX(-1)" : undefined }}
        />
        {status === "idle" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
            <Camera className="w-10 h-10 text-cyan-400" />
            <p className="text-sm text-zinc-300 max-w-xs">Prop your phone up so your whole body is in frame, then start the camera.</p>
          </div>
        )}
        {status === "loading" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-sm text-zinc-300">Loading motion engine…</p>
          </div>
        )}
        {running && (
          <div className="absolute top-3 left-3 flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase" style={{ background: tracking ? "rgba(34,255,155,0.2)" : "rgba(255,180,0,0.18)", color: tracking ? "#22ff9b" : "#ffb400", border: `1px solid ${tracking ? "rgba(34,255,155,0.5)" : "rgba(255,180,0,0.5)"}` }}>
              <Activity className="w-3 h-3" /> {tracking ? "Tracking" : "No body"}
            </span>
            <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.5)", color: "#9fefff" }}>{fps} fps</span>
          </div>
        )}
      </div>

      {/* Song picker */}
      {songs.length > 0 && (
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2">
            <Music className="w-4 h-4 text-purple-400 shrink-0" />
            <select
              value={selectedSong?.id ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                pickSong(songs.find((s) => s.id === id) || null);
              }}
              className="flex-1 bg-white/5 border border-white/15 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">No track — free performance</option>
              {songs.map((s) => (
                <option key={s.id} value={s.id} className="bg-zinc-900">{s.title}</option>
              ))}
            </select>
            {selectedSong?.audioUrl && (
              <button
                onClick={togglePlay}
                className="flex items-center justify-center w-10 h-10 rounded-lg shrink-0"
                style={{ background: "rgba(168,85,247,0.18)", border: "1px solid rgba(168,85,247,0.5)", color: "#c79bff" }}
                aria-label={playing ? "Pause" : "Play"}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="px-4 py-4 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {!running ? (
            <button
              onClick={start}
              disabled={status === "loading"}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm active:scale-95 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #00f5ff, #8b5cf6)", color: "#001016" }}
            >
              <Camera className="w-4 h-4" /> {status === "loading" ? "Starting…" : "Start camera"}
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-sm active:scale-95"
              style={{ background: "rgba(255,80,80,0.16)", color: "#ff7676", border: "1px solid rgba(255,80,80,0.45)" }}
            >
              <CameraOff className="w-4 h-4" /> Stop
            </button>
          )}
          {running && (
            <button
              onClick={() => { pendingCalibrateRef.current = true; }}
              className="flex items-center justify-center gap-1.5 px-4 py-3.5 rounded-xl font-bold text-xs active:scale-95"
              style={{ border: `1px solid ${calibrated ? "rgba(34,255,155,0.5)" : "rgba(255,200,0,0.5)"}`, color: calibrated ? "#22ff9b" : "#ffd23f", background: calibrated ? "rgba(34,255,155,0.08)" : "rgba(255,200,0,0.08)" }}
            >
              <Crosshair className="w-4 h-4" /> {calibrated ? "Recalibrate" : "Calibrate"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMirror((m) => !m)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs"
            style={{ border: "1px solid rgba(0,245,255,0.35)", color: mirror ? "#00f5ff" : "#9aa" }}
          >
            <FlipHorizontal className="w-4 h-4" /> Mirror {mirror ? "on" : "off"}
          </button>
          <button
            onClick={() => { setFacing((f) => (f === "user" ? "environment" : "user")); if (running) { stop(); } }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl font-bold text-xs"
            style={{ border: "1px solid rgba(168,85,247,0.4)", color: "#c79bff" }}
          >
            <RefreshCw className="w-4 h-4" /> {facing === "user" ? "Front" : "Back"} cam
          </button>
        </div>
        {running && !calibrated && (
          <p className="text-[11px] text-yellow-300/90">
            Stand relaxed facing the phone (arms slightly out, like the avatar) and tap <b>Calibrate</b> so the skeleton lines up.
          </p>
        )}
        {errorMsg && <p className="text-xs text-red-400">{errorMsg}</p>}
        <p className="text-[11px] text-zinc-500 text-center mt-1">Everything runs on your phone — the video never leaves your device, only motion data.</p>
      </div>
    </div>
  );
}
