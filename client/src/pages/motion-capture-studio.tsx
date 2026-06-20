// ─── Motion Capture Studio (Live Link sender) ───────────────────────────────
// Turns the device webcam into a live motion source for an artist's 3D avatar —
// the browser equivalent of Rokoko Studio's Live Link. MediaPipe BlazePose runs
// on-device, the extracted bone directions are streamed over the HoloStage
// gateway (`/ws/holostage`, role "mocap"), and the avatar — here in a live
// preview and on any open /hologram-showcase page in the same room — moves in
// real time. No video ever leaves the device.

import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { useParams, Link } from "wouter";
import { Activity, Camera, CameraOff, FlipHorizontal, Radio, ArrowLeft, Wifi, WifiOff, Loader2, Crosshair, QrCode, Smartphone, Music, Circle, Square, Check } from "lucide-react";
import QRCode from "react-qr-code";
import { WebcamMocap } from "../lib/motion/poseMocap";
import type { MocapFrame } from "../lib/motion/liveRetarget";
import { apiRequest } from "../lib/queryClient";
import MotionTakesLibrary from "../components/motion/MotionTakesLibrary";

const HologramStageViewer = lazy(() => import("../components/artist/HologramStageViewer"));

interface Character3D {
  glbUrl?: string;
  animatedUrl?: string;
  animatedGlbUrl?: string;
  animatedFormat?: "glb" | "fbx";
  thumbnailUrl?: string;
  sourceImageUrl?: string;
}

interface Song {
  id: number;
  title: string;
  audioUrl?: string;
  coverArt?: string;
}

interface RecordedFrame extends MocapFrame {
  /** Relative time from the start of the recording (ms). */
  t: number;
}

export default function MotionCaptureStudio() {
  const params = useParams();
  const artistId = String(params.artistId || "");

  const videoRef = useRef<HTMLVideoElement>(null);
  const mocapRef = useRef<WebcamMocap | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastSentRef = useRef(0);
  const frameCountRef = useRef(0);
  const pendingCalibrateRef = useRef(false);

  // Recorder (operator) socket — receives every mocap frame in the room (from
  // this computer's webcam OR a paired phone OR a Rokoko suit) so a take can be
  // recorded centrally, and tracks presence to know when the phone connects.
  const recorderWsRef = useRef<WebSocket | null>(null);
  const recordingRef = useRef(false);
  const recordStartRef = useRef(0);
  const recordedFramesRef = useRef<RecordedFrame[]>([]);
  const recordHasFaceRef = useRef(false);
  // Backing audio element for the selected song — playback is started in sync
  // with the capture so the recorded motion lines up with the music timeline.
  const audioRef = useRef<HTMLAudioElement>(null);

  const [status, setStatus] = useState<"idle" | "loading" | "running" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [mirror, setMirror] = useState(true);
  const [fps, setFps] = useState(0);
  const [tracking, setTracking] = useState(false);
  const [calibrated, setCalibrated] = useState(false);
  const [character, setCharacter] = useState<Character3D | null>(null);

  // Phone pairing (QR).
  const [pairing, setPairing] = useState<{ token: string; code: string; url: string } | null>(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [phoneConnected, setPhoneConnected] = useState(false);

  // Repertoire + recording.
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSongId, setSelectedSongId] = useState<number | "">("");
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [saving, setSaving] = useState(false);
  const [takesReload, setTakesReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSong = songs.find((s) => s.id === selectedSongId) || null;

  // Fetch the artist's 3D character for the live preview.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/hologram-gallery/${encodeURIComponent(artistId)}/character-3d`);
        const data = res.ok ? await res.json() : null;
        if (active && data?.character?.glbUrl) setCharacter(data.character);
      } catch { /* preview is optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  const previewSrc = character?.animatedUrl || character?.animatedGlbUrl || character?.glbUrl || "";
  const previewFormat: "glb" | "fbx" =
    (character?.animatedUrl || character?.animatedGlbUrl) ? (character?.animatedFormat || "glb") : "glb";

  // Fetch the artist's repertoire so a performance can be recorded against a song.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/songs/user/${encodeURIComponent(artistId)}`);
        const data = res.ok ? await res.json() : [];
        if (active && Array.isArray(data)) {
          setSongs(data.map((s: Song) => ({ id: s.id, title: s.title, audioUrl: s.audioUrl, coverArt: s.coverArt })));
        }
      } catch { /* repertoire optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);


  // Recorder socket: an operator peer that receives every mocap frame in the
  // room (webcam / phone / suit), records them when armed, and watches presence
  // to know when the phone camera is connected. Stays open while mounted.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let closed = false;
    let ws: WebSocket | null = null;
    const connect = () => {
      const proto = window.location.protocol === "https:" ? "wss" : "ws";
      const qs = new URLSearchParams({ role: "operator", artistId, showId: "livelink", label: "studio-recorder" });
      try { ws = new WebSocket(`${proto}://${window.location.host}/ws/holostage?${qs.toString()}`); } catch { return; }
      recorderWsRef.current = ws;
      ws.onmessage = (ev) => {
        let msg: any;
        try { msg = JSON.parse(typeof ev.data === "string" ? ev.data : ""); } catch { return; }
        if (!msg) return;
        if (msg.type === "presence" && Array.isArray(msg.peers)) {
          setPhoneConnected(msg.peers.some((p: any) => p.role === "mocap"));
        } else if (msg.type === "mocap" && msg.frame) {
          if (recordingRef.current) {
            const f = msg.frame as MocapFrame;
            if (f.face) recordHasFaceRef.current = true;
            recordedFramesRef.current.push({ ...f, t: performance.now() - recordStartRef.current });
          }
        }
      };
      ws.onclose = () => { if (!closed) setTimeout(connect, 1500); };
      ws.onerror = () => { try { ws?.close(); } catch { /* ignore */ } };
    };
    connect();
    return () => { closed = true; try { ws?.close(); } catch { /* ignore */ } };
  }, [artistId]);

  // Keep the mirror flag in sync with the running detector.
  useEffect(() => {
    mocapRef.current?.setMirror(mirror);
  }, [mirror]);

  // ── Phone pairing (QR) ──────────────────────────────────────────────────────
  const createPairing = useCallback(async () => {
    setPairLoading(true);
    setNotice(null);
    try {
      const data: any = await apiRequest({
        url: `/api/motion-capture/${encodeURIComponent(artistId)}/pair`,
        method: "POST",
        data: { showId: "livelink" },
      });
      if (data?.success && data.path) {
        setPairing({ token: data.token, code: data.code, url: `${window.location.origin}${data.path}` });
      } else {
        setNotice("Couldn't create a pairing link.");
      }
    } catch (e: any) {
      setNotice(e?.message || "Couldn't create a pairing link (are you signed in as this artist?).");
    } finally {
      setPairLoading(false);
    }
  }, [artistId]);

  // ── Recording ───────────────────────────────────────────────────────────────
  // Broadcast a cue to everyone in the room (phone camera + any open viewer) so
  // they can mirror the song's play/stop state and stay in sync.
  const sendCue = useCallback((cue: Record<string, unknown>) => {
    const ws = recorderWsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "cue", ...cue })); } catch { /* ignore */ }
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (!phoneConnected && status !== "running") {
      setNotice("Connect your phone (QR) or start this computer's webcam first.");
      return;
    }
    recordedFramesRef.current = [];
    recordHasFaceRef.current = false;

    // Start the music from the top in sync with the capture. The recorded frame
    // timestamps (`t`) are measured from `recordStartRef`, so by anchoring that
    // moment to audio position 0 the motion take aligns with the song timeline.
    const audio = audioRef.current;
    if (audio && selectedSong?.audioUrl) {
      try {
        audio.currentTime = 0;
        await audio.play();
      } catch { /* autoplay may be blocked — recording still proceeds */ }
    }

    recordStartRef.current = performance.now();
    recordingRef.current = true;
    setRecording(true);
    setRecordSecs(0);
    setNotice(null);

    if (selectedSong) {
      sendCue({ action: "song-play", songId: selectedSong.id, songTitle: selectedSong.title, audioUrl: selectedSong.audioUrl ?? null, at: 0 });
    }
  }, [phoneConnected, status, selectedSong, sendCue]);

  const cancelRecording = useCallback(() => {
    recordingRef.current = false;
    recordedFramesRef.current = [];
    const audio = audioRef.current;
    if (audio) { try { audio.pause(); } catch { /* ignore */ } }
    setRecording(false);
    setRecordSecs(0);
    sendCue({ action: "song-stop" });
  }, [sendCue]);

  const stopAndSave = useCallback(async () => {
    recordingRef.current = false;
    setRecording(false);
    const audio = audioRef.current;
    if (audio) { try { audio.pause(); } catch { /* ignore */ } }
    sendCue({ action: "song-stop" });
    const frames = recordedFramesRef.current;
    const durationMs = Math.round(performance.now() - recordStartRef.current);
    if (!frames.length) {
      setNotice("No motion was captured — make sure tracking is active, then try again.");
      setRecordSecs(0);
      return;
    }
    setSaving(true);
    try {
      const data: any = await apiRequest({
        url: `/api/motion-capture/${encodeURIComponent(artistId)}/takes`,
        method: "POST",
        data: {
          title: selectedSong ? selectedSong.title : `Take · ${new Date().toLocaleString()}`,
          songId: selectedSong?.id ?? null,
          songTitle: selectedSong?.title ?? null,
          source: phoneConnected ? "phone" : "webcam",
          fps: 30,
          durationMs,
          hasFace: recordHasFaceRef.current,
          frames,
          thumbnailUrl: character?.thumbnailUrl || character?.sourceImageUrl,
        },
      });
      if (data?.success) {
        setNotice(`Saved take "${data.take.title}" (${frames.length} frames).`);
        recordedFramesRef.current = [];
        setRecordSecs(0);
        setTakesReload((n) => n + 1);
      } else {
        setNotice("Could not save the take.");
      }
    } catch (e: any) {
      setNotice(e?.message || "Could not save the take.");
    } finally {
      setSaving(false);
    }
  }, [artistId, selectedSong, phoneConnected, character]);

  // Recording timer.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setRecordSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  const openSocket = useCallback(() => {
    if (typeof window === "undefined") return;
    const proto = window.location.protocol === "https:" ? "wss" : "ws";
    const qs = new URLSearchParams({ role: "mocap", artistId, showId: "livelink", label: "webcam" });
    const url = `${proto}://${window.location.host}/ws/holostage?${qs.toString()}`;
    let ws: WebSocket;
    try { ws = new WebSocket(url); } catch { return; }
    wsRef.current = ws;
    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      // Reconnect while the studio is still running.
      if (status === "running") setTimeout(openSocket, 1500);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  }, [artistId, status]);

  const sendFrame = useCallback((frame: MocapFrame) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      try { ws.send(JSON.stringify({ type: "mocap", frame })); } catch { /* socket dying */ }
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
      // A pending calibration flag rides the next good frame so the receiver
      // snapshots this pose as neutral.
      if (pendingCalibrateRef.current) {
        frame.calibrate = true;
        pendingCalibrateRef.current = false;
        setCalibrated(true);
      }
      // Cap the stream to ~30 fps to stay light over the socket — but always
      // send a calibration frame immediately.
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

  // FPS meter.
  useEffect(() => {
    if (status !== "running") return;
    const id = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => clearInterval(id);
  }, [status]);

  const start = useCallback(async () => {
    setStatus("loading");
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
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
          ? "Camera permission denied. Allow camera access and try again."
          : err?.message || "Couldn't start the camera / motion engine.",
      );
    }
  }, [mirror, openSocket, loop]);

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mocapRef.current?.close();
    mocapRef.current = null;
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    setStatus("idle");
    setConnected(false);
    setTracking(false);
    setCalibrated(false);
    pendingCalibrateRef.current = false;
    setFps(0);
  }, []);

  // Clean up on unmount.
  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    mocapRef.current?.close();
    try { wsRef.current?.close(); } catch { /* ignore */ }
    try { recorderWsRef.current?.close(); } catch { /* ignore */ }
  }, []);

  const running = status === "running";
  const canRecord = phoneConnected || running;
  const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="min-h-screen w-full text-white" style={{ background: "radial-gradient(circle at 50% 0%, #0a1422, #04070d 70%)" }}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link href={`/hologram-showcase/${artistId}`} className="flex items-center gap-1.5 text-cyan-400 text-sm font-bold hover:text-cyan-300">
              <ArrowLeft className="w-4 h-4" /> Back to showcase
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            {connected ? (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(34,255,155,0.15)", color: "#22ff9b", border: "1px solid rgba(34,255,155,0.4)" }}>
                <Wifi className="w-3.5 h-3.5" /> Gateway connected
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.08)", color: "#aaa", border: "1px solid rgba(255,255,255,0.15)" }}>
                <WifiOff className="w-3.5 h-3.5" /> Not streaming
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(0,245,255,0.12)", border: "1px solid rgba(0,245,255,0.35)" }}>
            <Radio className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-black">Motion Capture · Live Link</h1>
            <p className="text-zinc-400 text-sm">Drive the avatar with your webcam or your phone — capture your show motion and save it to your repertoire.</p>
          </div>
        </div>

        {/* Phone camera via QR + repertoire-synced recording */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Connect phone (QR) */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.18)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-black">Use your phone as the camera</h2>
              <span className={`ml-auto flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-black ${phoneConnected ? "" : "opacity-70"}`} style={{ background: phoneConnected ? "rgba(34,255,155,0.15)" : "rgba(255,255,255,0.06)", color: phoneConnected ? "#22ff9b" : "#9aa", border: `1px solid ${phoneConnected ? "rgba(34,255,155,0.4)" : "rgba(255,255,255,0.12)"}` }}>
                {phoneConnected ? <><Check className="w-3 h-3" /> Phone connected</> : <>Phone not connected</>}
              </span>
            </div>
            {!pairing ? (
              <div className="flex flex-col items-start gap-3">
                <p className="text-xs text-zinc-400 leading-relaxed">
                  No App Store download needed. Generate a QR, scan it with your phone, and its camera drives the avatar over the network — point it at yourself and perform your repertoire.
                </p>
                <button
                  onClick={createPairing}
                  disabled={pairLoading}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #00f5ff, #8b5cf6)", color: "#001016" }}
                >
                  {pairLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />} Generate QR
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4 flex-wrap">
                <div className="bg-white p-2.5 rounded-xl">
                  <QRCode value={pairing.url} size={128} />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <p className="text-xs text-zinc-400 mb-1">Scan with your phone's camera, or open this link on the phone:</p>
                  <a href={pairing.url} className="text-cyan-400 text-xs font-mono break-all hover:underline">{pairing.url}</a>
                  <p className="text-[11px] text-zinc-500 mt-2">Pairing code <span className="font-mono font-black text-zinc-300 tracking-widest">{pairing.code}</span></p>
                  <button onClick={createPairing} className="mt-2 text-[11px] text-cyan-400 font-bold hover:text-cyan-300">Generate a new code</button>
                </div>
              </div>
            )}
          </div>

          {/* Repertoire + record */}
          <div className="rounded-2xl p-4" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.22)" }}>
            <div className="flex items-center gap-2 mb-3">
              <Music className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-black">Record a performance for your repertoire</h2>
            </div>
            <label className="block text-[11px] font-bold text-zinc-400 mb-1">Song from your repertoire</label>
            <select
              value={selectedSongId}
              onChange={(e) => setSelectedSongId(e.target.value ? Number(e.target.value) : "")}
              className="w-full mb-3 px-3 py-2.5 rounded-xl text-sm font-bold outline-none"
              style={{ background: "rgba(0,0,0,0.4)", border: "1px solid rgba(168,85,247,0.3)", color: "#eee" }}
            >
              <option value="">{songs.length ? "Free performance (no song)" : "No songs in repertoire yet"}</option>
              {songs.map((s) => (
                <option key={s.id} value={s.id}>{s.title}</option>
              ))}
            </select>
            {selectedSong?.audioUrl && (
              <audio ref={audioRef} controls src={selectedSong.audioUrl} className="w-full mb-3 h-9" style={{ filter: "invert(0.9) hue-rotate(180deg)" }} />
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {!recording ? (
                <button
                  onClick={startRecording}
                  disabled={!canRecord}
                  className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  style={{ background: "rgba(255,80,80,0.16)", color: "#ff7676", border: "1px solid rgba(255,80,80,0.45)" }}
                  title={canRecord ? "Start recording the motion stream" : "Connect your phone or start the webcam first"}
                >
                  <Circle className="w-4 h-4 fill-current" /> Record
                </button>
              ) : (
                <>
                  <button
                    onClick={stopAndSave}
                    disabled={saving}
                    className="flex-1 min-w-[130px] flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                    style={{ background: "linear-gradient(135deg, #00f5ff, #8b5cf6)", color: "#001016" }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />} Stop & save · {mmss(recordSecs)}
                  </button>
                  <button
                    onClick={cancelRecording}
                    disabled={saving}
                    className="px-3 py-2.5 rounded-xl font-bold text-xs hover:bg-white/5 disabled:opacity-60"
                    style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#aaa" }}
                  >
                    Cancel
                  </button>
                </>
              )}
            </div>
            <p className="text-[11px] text-zinc-500 mt-2">
              {recording
                ? <span className="text-red-400 font-bold">● Recording the live motion stream…</span>
                : phoneConnected ? "Capturing from your phone." : running ? "Capturing from this computer's webcam." : "Connect your phone (QR) or start the webcam below to record."}
            </p>
          </div>
        </div>

        {notice && (
          <div className="mt-3 rounded-xl px-4 py-2.5 text-xs font-semibold" style={{ background: "rgba(0,245,255,0.08)", border: "1px solid rgba(0,245,255,0.25)", color: "#9fefff" }}>
            {notice}
          </div>
        )}

        {/* Studio grid: camera (sender) + avatar (receiver preview) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6">
          {/* Camera panel */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(0,245,255,0.04)", border: "1px solid rgba(0,245,255,0.15)" }}>
            <div className="relative bg-black" style={{ aspectRatio: "4/3" }}>
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
                  <p className="text-sm text-zinc-300 max-w-xs">Start your camera to capture full-body motion. Stand back so your whole body is visible.</p>
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
                    <Activity className="w-3 h-3" /> {tracking ? "Tracking" : "No body detected"}
                  </span>
                  <span className="px-2 py-1 rounded-full text-[10px] font-bold" style={{ background: "rgba(0,0,0,0.5)", color: "#9fefff" }}>{fps} fps</span>
                </div>
              )}
            </div>
            <div className="p-4 flex items-center gap-2 flex-wrap">
              {!running ? (
                <button
                  onClick={start}
                  disabled={status === "loading"}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-60"
                  style={{ background: "linear-gradient(135deg, #00f5ff, #8b5cf6)", color: "#001016" }}
                >
                  <Camera className="w-4 h-4" /> {status === "loading" ? "Starting…" : "Start motion capture"}
                </button>
              ) : (
                <button
                  onClick={stop}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all hover:scale-[1.02] active:scale-95"
                  style={{ background: "rgba(255,80,80,0.16)", color: "#ff7676", border: "1px solid rgba(255,80,80,0.45)" }}
                >
                  <CameraOff className="w-4 h-4" /> Stop
                </button>
              )}
              <button
                onClick={() => setMirror((m) => !m)}
                className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-bold text-xs transition-all hover:bg-white/5"
                style={{ border: "1px solid rgba(0,245,255,0.35)", color: mirror ? "#00f5ff" : "#9aa" }}
                title="Mirror the camera (selfie view)"
              >
                <FlipHorizontal className="w-4 h-4" /> Mirror {mirror ? "on" : "off"}
              </button>
              {running && (
                <button
                  onClick={() => { pendingCalibrateRef.current = true; }}
                  className="flex items-center justify-center gap-1.5 px-3 py-3 rounded-xl font-bold text-xs transition-all hover:scale-[1.02] active:scale-95"
                  style={{ border: `1px solid ${calibrated ? "rgba(34,255,155,0.5)" : "rgba(255,200,0,0.5)"}`, color: calibrated ? "#22ff9b" : "#ffd23f", background: calibrated ? "rgba(34,255,155,0.08)" : "rgba(255,200,0,0.08)" }}
                  title="Stand relaxed (arms slightly out, like the avatar) and tap to set your neutral pose"
                >
                  <Crosshair className="w-4 h-4" /> {calibrated ? "Recalibrate" : "Calibrate pose"}
                </button>
              )}
            </div>
            {running && !calibrated && (
              <p className="px-4 pb-1 text-[11px] text-yellow-300/90">
                Tip: stand relaxed facing the camera (arms slightly away from your body, like the avatar) and tap <b>Calibrate pose</b> so the skeleton lines up.
              </p>
            )}
            {errorMsg && <p className="px-4 pb-4 text-xs text-red-400">{errorMsg}</p>}
          </div>

          {/* Avatar preview panel (receives the same Live Link stream) */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(168,85,247,0.05)", border: "1px solid rgba(168,85,247,0.2)" }}>
            <div className="relative" style={{ aspectRatio: "4/3", background: "#04070d" }}>
              {previewSrc ? (
                <Suspense fallback={<div className="absolute inset-0 flex items-center justify-center"><Loader2 className="w-6 h-6 text-purple-400 animate-spin" /></div>}>
                  <HologramStageViewer
                    src={previewSrc}
                    format={previewFormat}
                    poster={character?.thumbnailUrl || character?.sourceImageUrl}
                    liveLinkRoom={artistId}
                    compact
                  />
                </Suspense>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center p-6">
                  <p className="text-sm text-zinc-400">No 3D character yet for this artist.</p>
                  <Link href={`/hologram-showcase/${artistId}`} className="text-purple-400 text-xs font-bold hover:text-purple-300">Generate one on the showcase →</Link>
                </div>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs text-zinc-400">
                This avatar mirrors your motion live. Open{" "}
                <Link href={`/hologram-showcase/${artistId}`} className="text-purple-400 font-bold hover:text-purple-300">the showcase</Link>{" "}
                on another screen — it moves there too, in the same room.
              </p>
            </div>
          </div>
        </div>

        {/* Recorded takes (repertoire-synced motion) — modern player + library */}
        <div className="mt-6 rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <MotionTakesLibrary artistId={artistId} reloadSignal={takesReload} onNotice={setNotice} />
        </div>

        {/* Help */}
        <div className="mt-6 rounded-2xl p-4 text-xs text-zinc-400 leading-relaxed" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
          <p className="font-bold text-zinc-200 mb-1">Tips for best tracking</p>
          <ul className="list-disc pl-5 space-y-0.5">
            <li>Stand 2–3 m back so your whole body is in frame, with even lighting.</li>
            <li>The avatar follows your arms, legs, torso, hands and face. Facial expression needs an avatar with face blendshapes (e.g. Ready Player Me); Tripo-rigged characters are rigid-faced.</li>
            <li>Everything runs on your device — the camera feed is never uploaded.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
