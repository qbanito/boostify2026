// ─── CaptureDevicesPanel ─────────────────────────────────────────────────────
// Unified capture device management — HoloSuit + Phone/Webcam + Face + Diagnostics.
// Self-contained: manages streaming state internally via holosuitBridge.
// Wired to: holosuitBridge (sensor polling), phoneCaptureService (MediaPipe),
//           holosuitPing (studio API reachability).

import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense, lazy } from 'react';
import {
  WifiOff, Camera, Smartphone, Monitor,
  Square, RefreshCw, ChevronDown, ChevronRight,
  Activity, CheckCircle, AlertCircle,
  Eye, EyeOff, Play, Cpu, Radio, Layers, Disc3,
  User, Loader2, Wand2,
} from 'lucide-react';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import { holosuitPing } from '../../services/holostage/holosuitLocalAPI';
import MotionTakesLibrary from '../../components/motion/MotionTakesLibrary';
import { WebcamMocap } from '../../lib/motion/poseMocap';
import type { MocapFrame } from '../../lib/motion/liveRetarget';
import {
  phoneCaptureService,
  type PhoneCaptureStatus,
  type PhoneCaptureStats,
  type PhoneCaptureConfig,
  DEFAULT_PHONE_CONFIG,
} from '../../services/holostage/phoneCaptureService';
import type { HoloSuitSensorStatus, HoloSuitActorInfo } from '../../schemas/holostage/motionSource.schema';

// Lazy-loaded so the heavy 3D bundle (three.js / R3F) only loads when an artist
// actually has a 3D character to drive in the capture session.
const HologramStageViewer = lazy(() => import('../../components/artist/HologramStageViewer'));

/** Minimal shape of the artist's stored 3D character (hologram-gallery). */
interface Character3D {
  glbUrl?: string;
  animatedUrl?: string;
  animatedGlbUrl?: string;
  animatedFormat?: 'glb' | 'fbx';
  thumbnailUrl?: string;
  sourceImageUrl?: string;
}

// ─── Sensor silhouette positions ─────────────────────────────────────────────

const SENSOR_POSITIONS: { id: string; label: string; cx: number; cy: number }[] = [
  { id: 'Head',          label: 'Head',          cx: 60,  cy: 14  },
  { id: 'Chest',         label: 'Chest',         cx: 60,  cy: 44  },
  { id: 'LeftShoulder',  label: 'L.Shoulder',    cx: 35,  cy: 36  },
  { id: 'RightShoulder', label: 'R.Shoulder',    cx: 85,  cy: 36  },
  { id: 'LeftUpperArm',  label: 'L.Upper Arm',   cx: 22,  cy: 52  },
  { id: 'RightUpperArm', label: 'R.Upper Arm',   cx: 98,  cy: 52  },
  { id: 'LeftLowerArm',  label: 'L.Lower Arm',   cx: 14,  cy: 68  },
  { id: 'RightLowerArm', label: 'R.Lower Arm',   cx: 106, cy: 68  },
  { id: 'LeftHand',      label: 'L.Hand',        cx: 8,   cy: 82  },
  { id: 'RightHand',     label: 'R.Hand',        cx: 112, cy: 82  },
  { id: 'Hip',           label: 'Hip',           cx: 60,  cy: 76  },
  { id: 'LeftUpperLeg',  label: 'L.Upper Leg',   cx: 44,  cy: 100 },
  { id: 'RightUpperLeg', label: 'R.Upper Leg',   cx: 76,  cy: 100 },
  { id: 'LeftKnee',      label: 'L.Knee',        cx: 43,  cy: 126 },
  { id: 'RightKnee',     label: 'R.Knee',        cx: 77,  cy: 126 },
  { id: 'LeftLowerLeg',  label: 'L.Lower Leg',   cx: 42,  cy: 150 },
  { id: 'RightLowerLeg', label: 'R.Lower Leg',   cx: 78,  cy: 150 },
  { id: 'LeftFoot',      label: 'L.Foot',        cx: 41,  cy: 172 },
  { id: 'RightFoot',     label: 'R.Foot',        cx: 79,  cy: 172 },
];

function sensorDot(s?: HoloSuitSensorStatus): string {
  if (!s || !s.connected)        return '#ef4444';
  if (s.batteryPercent < 20 || s.signalStrength < 40) return '#f59e0b';
  return '#22c55e';
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BodySilhouette({ sensors }: { sensors: HoloSuitSensorStatus[] }) {
  const byId = Object.fromEntries(sensors.map(s => [s.sensorId, s]));
  return (
    <svg viewBox="0 0 120 190" style={{ width: '100%', maxHeight: 190 }}>
      <ellipse cx="60" cy="14" rx="12" ry="13" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      <rect x="36" y="27" width="48" height="50" rx="4" fill="none" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="36" y1="34" x2="23" y2="55" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="23" y1="55" x2="14" y2="74" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="14" y1="74" x2="8" y2="87" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="84" y1="34" x2="97" y2="55" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="97" y1="55" x2="106" y2="74" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="106" y1="74" x2="112" y2="87" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="50" y1="77" x2="45" y2="108" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="45" y1="108" x2="43" y2="138" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="43" y1="138" x2="41" y2="165" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="70" y1="77" x2="75" y2="108" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="75" y1="108" x2="77" y2="138" stroke="#2a2a2a" strokeWidth="1.5" />
      <line x1="77" y1="138" x2="79" y2="165" stroke="#2a2a2a" strokeWidth="1.5" />
      {SENSOR_POSITIONS.map(sp => {
        const color = sensorDot(byId[sp.id]);
        return (
          <rect key={sp.id} x={sp.cx - 5} y={sp.cy - 5} width={10} height={10} rx={2}
            fill={color} opacity={byId[sp.id] ? 0.9 : 0.2}>
            <title>{sp.label}: {byId[sp.id]
              ? `${byId[sp.id].signalStrength.toFixed(0)}% signal · ${byId[sp.id].batteryPercent.toFixed(0)}% batt`
              : 'Not connected'}
            </title>
          </rect>
        );
      })}
    </svg>
  );
}

function QualityBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  const color = value > 0.7 ? '#22c55e' : value > 0.4 ? '#f59e0b' : '#ef4444';
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] w-16 shrink-0" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-7 text-right" style={{ color }}>{pct}%</span>
    </div>
  );
}

function Dot({ active, pulse }: { active: boolean; pulse?: boolean }) {
  return (
    <div className={`w-2 h-2 rounded-full shrink-0 ${pulse && active ? 'animate-pulse' : ''}`}
      style={{
        background: active ? '#22c55e' : 'rgba(255,255,255,0.12)',
        boxShadow: active ? '0 0 5px #22c55e' : 'none',
      }} />
  );
}

function StatChip({ label, value, warn, ok }: { label: string; value: string | number; warn?: boolean; ok?: boolean }) {
  const color = warn ? '#ef4444' : ok ? '#22c55e' : '#f97316';
  return (
    <div className="flex flex-col items-center p-2 rounded-lg"
      style={{ background: `${color}0d`, border: `1px solid ${color}22` }}>
      <span className="text-[9px] font-bold tracking-widest uppercase"
        style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
      <span className="text-base font-mono font-black" style={{ color }}>{value}</span>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function CaptureDevicesPanel({ artistId }: { artistId?: string } = {}) {
  const [tab, setTab] = useState<'holosuit' | 'phone' | 'face' | 'takes' | 'diagnostics'>('holosuit');

  // ── HoloSuit state ───────────────────────────────────────────────────────
  const [isSimulating, setIsSimulating]       = useState(false);
  const [studioReachable, setStudioReachable] = useState<boolean | null>(null);
  const [pinging, setPinging]                 = useState(false);
  const [sensors, setSensors]                 = useState<HoloSuitSensorStatus[]>([]);
  const [actors, setActors]                   = useState<HoloSuitActorInfo[]>([]);
  const [holoFps, setHoloFps]                 = useState(0);
  const [holoFrames, setHoloFrames]           = useState(0);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  // ── Phone capture state ──────────────────────────────────────────────────
  const [captureStatus, setCaptureStatus] = useState<PhoneCaptureStatus>('idle');
  const [captureStats,  setCaptureStats]  = useState<PhoneCaptureStats | null>(null);
  const [captureConfig, setCaptureConfig] = useState<PhoneCaptureConfig>(DEFAULT_PHONE_CONFIG);
  const [showPreview,   setShowPreview]   = useState(true);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');

  // ── Live avatar (reacts to capture via the HoloStage Live Link) ───────────
  const [character, setCharacter] = useState<Character3D | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(true);
  const [driveAvatar, setDriveAvatar] = useState(true);
  const [liveDriving, setLiveDriving] = useState(false);

  const videoRef  = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fpsRef    = useRef<number[]>([]);
  const holoUnsubRef = useRef<(() => void) | null>(null);

  // Live Link sender refs (webcam → MoCap frames → avatar).
  const liveWsRef       = useRef<WebSocket | null>(null);
  const liveMocapRef    = useRef<WebcamMocap | null>(null);
  const liveRafRef      = useRef<number>(0);
  const liveLastSentRef = useRef<number>(0);

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = setInterval(() => {
      setSensors(holosuitBridge.getSensorStatuses());
      setActors(holosuitBridge.getActors());
    }, 800);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      const ok = await holosuitPing();
      if (!cancelled) setStudioReachable(ok);
    };
    ping();
    const id = setInterval(ping, 5000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  useEffect(() => {
    const unsub = phoneCaptureService.onStatus((status, stats) => {
      setCaptureStatus(status);
      setCaptureStats({ ...stats });
    });
    return unsub;
  }, []);

  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then(devs => {
      setAvailableDevices(devs.filter(d => d.kind === 'videoinput'));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      holoUnsubRef.current?.();
      holosuitBridge.stopSimulation();
      phoneCaptureService.stop();
    };
  }, []);

  // Fetch the artist's 3D character so the capture session can show a live
  // avatar that reacts to whatever is driving the room (webcam / phone / take).
  useEffect(() => {
    if (!artistId) { setCharacter(null); return; }
    let active = true;
    (async () => {
      try {
        const res = await fetch(`/api/hologram-gallery/${encodeURIComponent(artistId)}/character-3d`);
        const data = res.ok ? await res.json() : null;
        if (active && data?.character?.glbUrl) setCharacter(data.character);
        else if (active) setCharacter(null);
      } catch { /* avatar preview is optional */ }
    })();
    return () => { active = false; };
  }, [artistId]);

  // ── HoloSuit simulation ──────────────────────────────────────────────────
  const startSim = useCallback(() => {
    setIsSimulating(true);
    holosuitBridge.startSimulation(30, 0.5);
    holoUnsubRef.current = holosuitBridge.onFrame(() => {
      const now = Date.now();
      fpsRef.current = [...fpsRef.current.filter(ts => now - ts < 1000), now];
      setHoloFps(fpsRef.current.length);
      setHoloFrames(c => c + 1);
    });
  }, []);

  const stopSim = useCallback(() => {
    setIsSimulating(false);
    holosuitBridge.stopSimulation();
    holoUnsubRef.current?.();
    holoUnsubRef.current = null;
    setHoloFps(0);
  }, []);

  // ── Phone capture ─────────────────────────────────────────────────────────
  const startPhoneCapture = useCallback(async () => {
    phoneCaptureService.configure(captureConfig);
    await phoneCaptureService.start(videoRef.current ?? undefined, canvasRef.current ?? undefined);
  }, [captureConfig]);

  const stopPhoneCapture = useCallback(() => {
    phoneCaptureService.stop();
  }, []);

  const handleManualPing = async () => {
    setPinging(true);
    const ok = await holosuitPing();
    setStudioReachable(ok);
    setPinging(false);
  };

  const isCapturing = captureStatus === 'running';
  const isLoading   = captureStatus === 'requesting' || captureStatus === 'loading_model';

  // Source for the live avatar: prefer an animated/rigged GLB, fall back to the
  // base mesh. Matches the motion-capture studio's preview resolution logic.
  const previewSrc = useMemo(
    () => character?.animatedUrl || character?.animatedGlbUrl || character?.glbUrl || '',
    [character],
  );
  const previewFormat: 'glb' | 'fbx' =
    (character?.animatedUrl || character?.animatedGlbUrl) ? (character?.animatedFormat || 'glb') : 'glb';
  const hasAvatar = !!(artistId && previewSrc);

  // ── Live Link sender: webcam → MoCap → avatar ─────────────────────────────
  // While the Camera tab is actively capturing, run the same on-device pose
  // tracker as the motion-capture studio and stream bone directions to the
  // HoloStage room (`<artistId>:livelink`, role "mocap"). The embedded avatar
  // (HologramStageViewer with liveLinkRoom={artistId}) joins as an operator and
  // reacts in real time — no extra hardware needed.
  useEffect(() => {
    if (!hasAvatar || !driveAvatar || !isCapturing || typeof window === 'undefined') {
      setLiveDriving(false);
      return;
    }
    let cancelled = false;

    const openSocket = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const qs = new URLSearchParams({ role: 'mocap', artistId: String(artistId), showId: 'livelink', label: 'holostage-camera' });
      let ws: WebSocket;
      try { ws = new WebSocket(`${proto}://${window.location.host}/ws/holostage?${qs.toString()}`); }
      catch { return; }
      liveWsRef.current = ws;
      ws.onclose = () => { if (!cancelled) setTimeout(openSocket, 1500); };
      ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
    };

    const sendFrame = (frame: MocapFrame) => {
      const ws = liveWsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        try { ws.send(JSON.stringify({ type: 'mocap', frame })); } catch { /* socket dying */ }
      }
    };

    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const mocap = liveMocapRef.current;
      if (video && mocap) {
        const now = performance.now();
        const frame = mocap.detect(video, now);
        // Cap the stream to ~30 fps to stay light over the socket.
        if (frame && now - liveLastSentRef.current >= 33) {
          sendFrame(frame);
          liveLastSentRef.current = now;
        }
      }
      liveRafRef.current = requestAnimationFrame(loop);
    };

    (async () => {
      try {
        const mocap = new WebcamMocap({ mirror: true });
        await mocap.init();
        if (cancelled) return;
        liveMocapRef.current = mocap;
        openSocket();
        setLiveDriving(true);
        liveRafRef.current = requestAnimationFrame(loop);
      } catch {
        if (!cancelled) setLiveDriving(false);
      }
    })();

    return () => {
      cancelled = true;
      setLiveDriving(false);
      cancelAnimationFrame(liveRafRef.current);
      try { liveWsRef.current?.close(); } catch { /* ignore */ }
      liveWsRef.current = null;
      liveMocapRef.current = null;
    };
  }, [hasAvatar, driveAvatar, isCapturing, artistId]);

  const TABS = [
    { id: 'holosuit'    as const, label: 'HoloSuit', Icon: Radio    },
    { id: 'phone'       as const, label: 'Camera',   Icon: Camera   },
    { id: 'face'        as const, label: 'Face',     Icon: Cpu      },
    { id: 'takes'       as const, label: 'Takes',    Icon: Disc3    },
    { id: 'diagnostics' as const, label: 'Diag',     Icon: Activity },
  ];

  return (
    <div className="h-full flex flex-col overflow-y-auto"
      style={{ background: '#0a0a0a', color: 'white' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-orange-400" />
          <div>
            <h3 className="text-base font-bold text-white">Capture Devices</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {isSimulating ? `HoloSuit sim · ${holoFps}fps` :
               isCapturing  ? `Camera · ${captureStats?.fps ?? 0}fps` :
               'No active capture'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-full"
          style={{
            background: isSimulating || isCapturing ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isSimulating || isCapturing ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.08)'}`,
            color: isSimulating || isCapturing ? '#22c55e' : 'rgba(255,255,255,0.3)',
          }}>
          <Dot active={isSimulating || isCapturing} pulse />
          {isSimulating ? 'LIVE SIM' : isCapturing ? 'CAPTURING' : 'IDLE'}
        </div>
      </div>

      {/* ── Live avatar stage ───────────────────────────────────────────── */}
      {hasAvatar && (
        <div className="mx-4 mb-4 rounded-xl overflow-hidden shrink-0"
          style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={() => setAvatarOpen(o => !o)}
            className="w-full flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span className="text-xs font-bold text-white">Live Avatar</span>
              {liveDriving && (
                <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <Dot active pulse /> DRIVING
                </span>
              )}
            </div>
            {avatarOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
          </button>

          {avatarOpen && (
            <div className="px-3 pb-3">
              <div className="relative rounded-lg overflow-hidden"
                style={{ height: 280, background: '#050505', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Suspense fallback={
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                  </div>
                }>
                  <HologramStageViewer
                    src={previewSrc}
                    format={previewFormat}
                    liveLinkRoom={artistId}
                    poster={character?.thumbnailUrl || character?.sourceImageUrl}
                    compact
                    style={{ width: '100%', height: '100%' }}
                  />
                </Suspense>
              </div>

              <div className="flex items-center justify-between mt-2.5">
                <p className="text-[10px] leading-snug" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Reacts to webcam, paired phone &amp; replayed takes in real time.
                </p>
                <button onClick={() => setDriveAvatar(d => !d)}
                  className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded-md shrink-0 transition-colors"
                  style={driveAvatar
                    ? { background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' }
                    : { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  <Wand2 className="w-3 h-3" />
                  {driveAvatar ? 'Camera drive ON' : 'Camera drive OFF'}
                </button>
              </div>
              {driveAvatar && !isCapturing && (
                <p className="text-[10px] mt-1.5" style={{ color: 'rgba(249,115,22,0.7)' }}>
                  Start the Camera capture to drive the avatar from this device.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-0.5 mx-4 mb-4 p-1 rounded-lg shrink-0"
        style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex flex-col items-center gap-0.5 py-2 rounded text-[10px] font-medium transition-colors"
            style={{
              background: tab === id ? 'rgba(249,115,22,0.18)' : 'transparent',
              color: tab === id ? '#f97316' : 'rgba(255,255,255,0.35)',
            }}>
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ══ HOLOSUIT tab ═══════════════════════════════════════════════════ */}
      {tab === 'holosuit' && (
        <div className="px-4 pb-6 space-y-4">

          {/* HoloSuit Pro card */}
          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: isSimulating ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.06)' }}>
                <Radio className="w-4 h-4" style={{ color: isSimulating ? '#22c55e' : 'rgba(255,255,255,0.3)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">HoloSuit Pro</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  19-sensor full-body suit · Smartgloves
                </p>
              </div>
              <Dot active={isSimulating} pulse />
            </div>

            {isSimulating && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <StatChip label="FPS"    value={holoFps}     ok={holoFps >= 25} warn={holoFps > 0 && holoFps < 15} />
                <StatChip label="Frames" value={holoFrames > 99999 ? '99K+' : holoFrames} />
                <StatChip label="Actors" value={actors.length} ok={actors.length > 0} />
              </div>
            )}

            <button
              onClick={isSimulating ? stopSim : startSim}
              className="w-full py-2 rounded text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
              style={isSimulating
                ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                : { background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }
              }>
              {isSimulating
                ? <><Square className="w-3.5 h-3.5" /> Stop Simulation</>
                : <><Play className="w-3.5 h-3.5" /> Start Simulation</>
              }
            </button>
          </div>

          {/* Studio app status */}
          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.35)' }} />
                <p className="text-xs font-bold text-white">HoloSuit Studio App</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <Dot active={studioReachable === true} />
                  <span className="text-[10px] font-bold"
                    style={{ color: studioReachable === true ? '#22c55e' : studioReachable === false ? '#ef4444' : 'rgba(255,255,255,0.25)' }}>
                    {studioReachable === null ? 'Checking…' : studioReachable ? 'ONLINE' : 'OFFLINE'}
                  </span>
                </div>
                <button onClick={handleManualPing} disabled={pinging}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold disabled:opacity-50 transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <RefreshCw className={`w-2.5 h-2.5 ${pinging ? 'animate-spin' : ''}`} />
                  Ping
                </button>
              </div>
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Nancy HTTP API at port 14053 · Custom Streaming UDP 14043
            </p>
          </div>

          {/* Active Actors */}
          {actors.length > 0 && (
            <div>
              <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
                style={{ color: 'rgba(255,255,255,0.28)' }}>Active Actors</p>
              <div className="space-y-1.5">
                {actors.map(a => (
                  <div key={a.actorName}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <Dot active={a.isActive} pulse />
                    <span className="flex-1 text-xs font-mono font-bold text-white">{a.actorName}</span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.28)' }}>
                      {a.frameRate}fps
                    </span>
                    {a.hasBody  && <span className="text-[9px] font-bold px-1 rounded"
                      style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e' }}>BODY</span>}
                    {a.hasFace  && <span className="text-[9px] font-bold px-1 rounded"
                      style={{ background: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>FACE</span>}
                    {a.hasHands && <span className="text-[9px] font-bold px-1 rounded"
                      style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>HANDS</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!isSimulating && actors.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-6"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <WifiOff className="w-8 h-8" />
              <p className="text-xs text-center">No HoloSuit devices found.<br />Use Camera tab as fallback.</p>
            </div>
          )}
        </div>
      )}

      {/* ══ PHONE / WEBCAM tab ═════════════════════════════════════════════ */}
      {tab === 'phone' && (
        <div className="px-4 pb-6 space-y-4">
          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
            MediaPipe Pose — full-body capture from any camera. No HoloSuit required.
            Frames are injected into the bridge automatically.
          </p>

          {availableDevices.length > 0 && (
            <div className="space-y-1">
              <label className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>Camera Device</label>
              <select value={selectedDeviceId}
                onChange={e => setSelectedDeviceId(e.target.value)}
                disabled={isCapturing}
                className="w-full px-2.5 py-2 rounded text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="">System default</option>
                {availableDevices.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 8)}`}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>Facing</label>
              <select value={captureConfig.facingMode}
                onChange={e => setCaptureConfig(c => ({ ...c, facingMode: e.target.value as 'user' | 'environment' }))}
                disabled={isCapturing}
                className="w-full px-2 py-1.5 rounded text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="user">Front (selfie)</option>
                <option value="environment">Back / Webcam</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold tracking-widest uppercase"
                style={{ color: 'rgba(255,255,255,0.3)' }}>Quality</label>
              <select value={captureConfig.quality}
                onChange={e => setCaptureConfig(c => ({ ...c, quality: e.target.value as 'fast' | 'balanced' | 'accurate' }))}
                disabled={isCapturing}
                className="w-full px-2 py-1.5 rounded text-xs text-white outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="fast">Fast</option>
                <option value="balanced">Balanced</option>
                <option value="accurate">Accurate</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Target FPS</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[15, 24, 30, 60].map(f => (
                <button key={f} onClick={() => setCaptureConfig(c => ({ ...c, fps: f }))}
                  disabled={isCapturing}
                  className="py-1.5 rounded text-[10px] font-bold transition-all disabled:opacity-40"
                  style={{
                    background: captureConfig.fps === f ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                    border: captureConfig.fps === f ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    color: captureConfig.fps === f ? '#f97316' : 'rgba(255,255,255,0.35)',
                  }}>
                  {f}fps
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.3)' }}>Capture Mode</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(['body', 'body+face', 'face'] as const).map(mode => (
                <button key={mode}
                  onClick={() => setCaptureConfig(c => ({ ...c, mode }))}
                  disabled={isCapturing}
                  className="py-1.5 px-1 rounded text-[10px] font-bold transition-all disabled:opacity-40"
                  style={{
                    background: captureConfig.mode === mode ? 'rgba(249,115,22,0.18)' : 'rgba(255,255,255,0.04)',
                    border: captureConfig.mode === mode ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    color: captureConfig.mode === mode ? '#f97316' : 'rgba(255,255,255,0.35)',
                  }}>
                  {mode === 'body' ? 'Body' : mode === 'face' ? 'Face' : 'Body+Face'}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={isCapturing ? stopPhoneCapture : startPhoneCapture}
            disabled={isLoading}
            className="w-full py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            style={isCapturing
              ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
              : isLoading
              ? { background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.1)' }
              : { background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }
            }>
            {isLoading ? (
              <><RefreshCw className="w-3.5 h-3.5 animate-spin" />
                {captureStatus === 'requesting' ? 'Requesting camera…' : 'Loading MediaPipe…'}</>
            ) : isCapturing ? (
              <><Square className="w-3.5 h-3.5" /> Stop Capture</>
            ) : (
              <><Camera className="w-3.5 h-3.5" /> Start Camera Capture</>
            )}
          </button>

          {isCapturing && captureStats && (
            <>
              <div className="grid grid-cols-3 gap-2">
                <StatChip label="FPS"  value={captureStats.fps}  ok={captureStats.fps >= 20} warn={captureStats.fps > 0 && captureStats.fps < 10} />
                <StatChip label="ms"   value={captureStats.latencyMs} warn={captureStats.latencyMs > 200} ok={captureStats.latencyMs < 50} />
                <StatChip label="CONF" value={`${Math.round(captureStats.poseConfidence * 100)}%`}
                  ok={captureStats.poseConfidence > 0.75} warn={captureStats.poseConfidence < 0.4} />
              </div>

              <div className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>Body Part Visibility</p>
                <div className="space-y-1.5">
                  {Object.entries(captureStats.visibilityByPart).map(([part, val]) => (
                    <QualityBar key={part} label={part} value={val} />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
                <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <p className="text-xs" style={{ color: '#22c55e' }}>
                  Frames injected into HoloSuit bridge · actor: <span className="font-mono font-bold">PhoneCapture</span>
                </p>
              </div>
            </>
          )}

          {isCapturing && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] font-bold tracking-widest uppercase"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>Preview</span>
                <button onClick={() => setShowPreview(v => !v)} className="hover:opacity-70 transition-opacity">
                  {showPreview
                    ? <EyeOff className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    : <Eye    className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.35)' }} />
                  }
                </button>
              </div>
              {showPreview && (
                <div className="relative rounded-lg overflow-hidden"
                  style={{ background: '#000', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <video ref={videoRef} playsInline muted className="w-full block"
                    style={{ transform: captureConfig.facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                  <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none"
                    style={{ transform: captureConfig.facingMode === 'user' ? 'scaleX(-1)' : 'none' }} />
                </div>
              )}
            </div>
          )}

          {captureStatus === 'error' && (
            <div className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">
                Camera access denied or MediaPipe failed to load.<br />
                Check browser permissions and try again.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ TAKES tab — saved repertoire-synced motion takes ══════════════ */}
      {tab === 'takes' && (
        <div className="px-4 pb-6">
          {artistId ? (
            <>
              <div className="p-3 rounded-lg mb-3"
                style={{ background: 'rgba(0,245,255,0.04)', border: '1px solid rgba(0,245,255,0.18)' }}>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
                  Recorded performances from this artist's phone or webcam. Hit <b style={{ color: '#7df9ff' }}>Play on avatar</b> to replay a take on the stage character in real time.
                </p>
              </div>
              <MotionTakesLibrary artistId={artistId} compact />
            </>
          ) : (
            <div className="p-4 rounded-lg text-center"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <Disc3 className="w-6 h-6 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.25)' }} />
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                Open the studio from an artist's Hologram Showcase to load their saved motion takes here.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ FACE tab ═══════════════════════════════════════════════════════ */}
      {tab === 'face' && (
        <div className="px-4 pb-6 space-y-4">

          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.3), rgba(168,85,247,0.3))' }}>
                <Cpu className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">Face Capture (Webcam)</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  52 ARKit blendshapes via MediaPipe Face Mesh
                </p>
              </div>
            </div>
            <p className="text-xs mb-3" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Enable "body+face" or "face" mode in Camera tab to capture face blendshapes alongside body pose.
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['body', 'body+face', 'face'] as const).map(mode => (
                <button key={mode}
                  onClick={() => { setCaptureConfig(c => ({ ...c, mode })); setTab('phone'); }}
                  className="py-2 px-2 rounded text-[10px] font-bold transition-all"
                  style={{
                    background: captureConfig.mode === mode ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                    border: captureConfig.mode === mode ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(255,255,255,0.07)',
                    color: captureConfig.mode === mode ? '#f97316' : 'rgba(255,255,255,0.45)',
                  }}>
                  {mode === 'body' ? 'Body only' : mode === 'face' ? 'Face only' : 'Body + Face'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,255,255,0.06)' }}>
                <Smartphone className="w-4 h-4" style={{ color: 'rgba(255,255,255,0.3)' }} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-white">HoloFace (iOS App)</p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  iPhone ARKit · 52 blendshapes · Same LAN
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Dot active={false} />
                <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>Not found</span>
              </div>
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Connect iPhone to same Wi-Fi, open HoloFace app, then click Connect in HoloSuit Studio.
            </p>
          </div>

          {isCapturing && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
              style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <p className="text-xs text-emerald-400">
                Camera capture active. Current mode: <span className="font-mono font-bold">{captureConfig.mode}</span>
              </p>
            </div>
          )}

          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)' }}>
            <p className="text-xs font-bold mb-1.5" style={{ color: '#60a5fa' }}>Setup Guide</p>
            <ol className="space-y-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
              <li>1. For webcam face: select "Body + Face" or "Face" in Camera tab</li>
              <li>2. For iPhone ARKit: install HoloFace from App Store</li>
              <li>3. Connect iPhone + PC to same Wi-Fi network</li>
              <li>4. In HoloSuit Studio → Live Streaming → Face Capture → Connect</li>
            </ol>
          </div>
        </div>
      )}

      {/* ══ DIAGNOSTICS tab ════════════════════════════════════════════════ */}
      {tab === 'diagnostics' && (
        <div className="px-4 pb-6 space-y-4">

          {isSimulating && sensors.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-white">HoloSuit Pro Sensors</p>
                <span className="text-xs font-mono"
                  style={{ color: sensors.filter(s => s.connected).length === sensors.length ? '#22c55e' : '#f59e0b' }}>
                  {sensors.filter(s => s.connected).length}/{sensors.length} connected
                </span>
              </div>

              <BodySilhouette sensors={sensors} />

              <div className="flex gap-4 justify-center">
                {[{ color: '#22c55e', label: 'OK' }, { color: '#f59e0b', label: 'Warning' }, { color: '#ef4444', label: 'Lost' }].map(l => (
                  <div key={l.label} className="flex items-center gap-1.5 text-[10px]"
                    style={{ color: 'rgba(255,255,255,0.4)' }}>
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: l.color }} />
                    {l.label}
                  </div>
                ))}
              </div>

              {sensors.filter(s => !s.connected || s.signalStrength < 40 || s.batteryPercent < 20).length > 0 && (
                <div className="p-3 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
                    style={{ color: '#f59e0b' }}>Needs Attention</p>
                  <div className="space-y-1.5">
                    {sensors
                      .filter(s => !s.connected || s.signalStrength < 40 || s.batteryPercent < 20)
                      .map(s => (
                        <div key={s.sensorId} className="flex items-center gap-2 text-xs">
                          <AlertCircle className="w-3 h-3 shrink-0"
                            style={{ color: !s.connected ? '#ef4444' : '#f59e0b' }} />
                          <span className="flex-1 text-white">{s.placement}</span>
                          {s.batteryPercent < 20 && (
                            <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
                              🔋{s.batteryPercent.toFixed(0)}%
                            </span>
                          )}
                          {s.signalStrength < 40 && (
                            <span className="text-[10px] font-mono" style={{ color: '#f59e0b' }}>
                              📶{s.signalStrength.toFixed(0)}%
                            </span>
                          )}
                          {!s.connected && (
                            <span className="text-[10px] font-bold" style={{ color: '#ef4444' }}>LOST</span>
                          )}
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}

              {sensors.every(s => s.connected && s.signalStrength >= 40 && s.batteryPercent >= 20) && (
                <div className="flex items-center gap-2 p-3 rounded-lg"
                  style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.2)' }}>
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-400 font-bold">All sensors healthy</p>
                </div>
              )}
            </>
          ) : isCapturing && captureStats ? (
            <>
              <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                MediaPipe body part tracking quality:
              </p>
              <div className="p-3 rounded-lg space-y-2"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
                {Object.entries(captureStats.visibilityByPart).map(([part, val]) => (
                  <QualityBar key={part} label={part} value={val} />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <StatChip label="Frames" value={captureStats.frameCount} />
                <StatChip label="Latency" value={`${captureStats.latencyMs}ms`}
                  warn={captureStats.latencyMs > 150} ok={captureStats.latencyMs < 50} />
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-12"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <Activity className="w-10 h-10" />
              <p className="text-xs text-center">
                Start HoloSuit simulation or camera capture<br />to see diagnostics.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
