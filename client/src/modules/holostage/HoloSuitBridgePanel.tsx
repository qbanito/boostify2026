// ─── HoloSuitBridgePanel ─────────────────────────────────────────────────────
// HoloSuit Studio bridge — simulation + real streaming + REST API remote control.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, Radio, Cpu, Settings, PlayCircle, StopCircle, Wifi, WifiOff,
  User, Battery, Signal, AlertTriangle, Circle, CheckCircle2, Video,
  Bell, BellOff, X, Zap, RefreshCw, CheckCircle, ChevronRight,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import {
  holosuitCalibrate, holosuitStartRecording, holosuitStopRecording, holosuitPing,
} from '../../services/holostage/holosuitLocalAPI';
import type {
  HoloSuitMotionFrame, HoloSuitSensorStatus, HoloSuitActorInfo, HoloSuitNotification,
} from '../../schemas/holostage/motionSource.schema';
import type { HoloSuitConfig } from '../../schemas/holostage/motionSource.schema';
import { DEFAULT_HOLOSUIT_CONFIG } from '../../schemas/holostage/motionSource.schema';

interface HoloSuitBridgePanelProps {
  config: HoloSuitConfig;
  onConfigChange: (config: HoloSuitConfig) => void;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BoneBar({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  const pct = Math.min(Math.abs(value) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono w-20 shrink-0"
        style={{ color: highlight ? '#f97316' : 'rgba(255,255,255,0.35)' }}>{label}</span>
      <div className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-75"
          style={{ width: `${pct}%`, background: value > 0 ? '#f97316' : '#3b82f6' }} />
      </div>
      <span className="text-[10px] font-mono w-11 text-right"
        style={{ color: 'rgba(255,255,255,0.28)' }}>{value.toFixed(3)}</span>
    </div>
  );
}

function SensorCard({ sensor }: { sensor: HoloSuitSensorStatus }) {
  const battColor =
    sensor.batteryPercent < 15 ? '#ef4444' :
    sensor.batteryPercent < 30 ? '#f59e0b' : '#22c55e';
  const sigColor =
    sensor.signalStrength < 25 ? '#ef4444' :
    sensor.signalStrength < 50 ? '#f59e0b' : '#22c55e';
  return (
    <div className="p-2 rounded-lg"
      style={{
        background: !sensor.connected ? 'rgba(239,68,68,0.08)' :
          sensor.batteryPercent < 15 ? 'rgba(245,158,11,0.06)' : 'rgba(255,255,255,0.025)',
        border: `1px solid ${!sensor.connected ? 'rgba(239,68,68,0.25)' :
          sensor.batteryPercent < 15 ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.06)'}`,
      }}>
      <p className="text-[9px] font-bold tracking-wider truncate mb-1.5"
        style={{ color: 'rgba(255,255,255,0.4)' }}>{sensor.placement}</p>
      <div className="flex items-center gap-1 mb-0.5">
        <Battery className="w-2.5 h-2.5 shrink-0" style={{ color: battColor }} />
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full" style={{ width: `${sensor.batteryPercent ?? 0}%`, background: battColor }} />
        </div>
        <span className="text-[9px] font-mono shrink-0" style={{ color: battColor }}>
          {(sensor.batteryPercent ?? 0).toFixed(0)}%
        </span>
      </div>
      <div className="flex items-center gap-1">
        <Signal className="w-2.5 h-2.5 shrink-0" style={{ color: sigColor }} />
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <div className="h-full rounded-full" style={{ width: `${sensor.signalStrength ?? 0}%`, background: sigColor }} />
        </div>
        <span className="text-[9px] font-mono shrink-0" style={{ color: sigColor }}>
          {(sensor.signalStrength ?? 0).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function NotifCard({
  notif, onDismiss,
}: { notif: HoloSuitNotification; onDismiss: (id: string) => void }) {
  const colors: Record<string, string> = {
    battery_critical: '#ef4444',
    battery_low:      '#f59e0b',
    signal_weak:      '#f59e0b',
    connection_lost:  '#ef4444',
    connection_ok:    '#22c55e',
    calibration_done: '#22c55e',
    recording_started:'#3b82f6',
    recording_stopped:'#a78bfa',
  };
  const color = colors[notif.type] ?? 'rgba(255,255,255,0.5)';
  const ago = Math.round((Date.now() - notif.timestamp) / 1000);
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg"
      style={{ background: `${color}0d`, border: `1px solid ${color}28` }}>
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-snug" style={{ color }}>
          {notif.message}
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>
          {ago < 60 ? `${ago}s ago` : `${Math.round(ago / 60)}m ago`}
          {notif.actorName ? ` · ${notif.actorName}` : ''}
        </p>
      </div>
      <button onClick={() => onDismiss(notif.id)} className="shrink-0 mt-0.5 hover:opacity-70 transition-opacity">
        <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.25)' }} />
      </button>
    </div>
  );
}

function FingerCurlBar({ finger, curl }: { finger: string; curl: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono w-10 shrink-0 capitalize" style={{ color: 'rgba(255,255,255,0.35)' }}>
        {finger.slice(0, 5)}
      </span>
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className="h-full rounded-full transition-all duration-75"
          style={{ width: `${Math.min(curl * 100, 100)}%`, background: 'linear-gradient(to right, #a855f7, #f97316)' }} />
      </div>
      <span className="text-[9px] font-mono w-7 text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>
        {(curl * 100).toFixed(0)}
      </span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HoloSuitBridgePanel({ config = DEFAULT_HOLOSUIT_CONFIG, onConfigChange }: HoloSuitBridgePanelProps) {
  const { t } = useHoloLang();

  // Simulation state
  const [isSimulating, setIsSimulating]   = useState(false);
  const [lastFrame, setLastFrame]         = useState<HoloSuitMotionFrame | null>(null);
  const [frameCount, setFrameCount]       = useState(0);
  const [fps, setFps]                     = useState(0);

  // Tab
  const [tab, setTab] = useState<'stream' | 'hands' | 'face' | 'actors' | 'remote' | 'notifs'>('stream');

  // Hardware state
  const [actors, setActors]               = useState<HoloSuitActorInfo[]>([]);
  const [selectedActor, setSelectedActor] = useState<string | null>(null);
  const [sensors, setSensors]             = useState<HoloSuitSensorStatus[]>([]);

  // Notifications
  const [notifications, setNotifications] = useState<HoloSuitNotification[]>([]);
  const [unreadCount, setUnreadCount]      = useState(0);

  // API remote
  const [takeName, setTakeName]     = useState('HoloStage_Take');
  const [isRecording, setIsRecording] = useState(false);
  const [apiLoading, setApiLoading] = useState<string | null>(null);
  const [apiMessage, setApiMessage] = useState('');
  const [apiStatus, setApiStatus]   = useState<'idle' | 'ok' | 'error'>('idle');
  const [pingStatus, setPingStatus] = useState<'unknown' | 'reachable' | 'unreachable'>('unknown');
  const [pinging, setPinging]       = useState(false);
  const [savedConfig, setSavedConfig] = useState(false);

  const fpsRef   = useRef<number[]>([]);
  const unsubFrameRef = useRef<(() => void) | null>(null);
  const unsubNotifRef = useRef<(() => void) | null>(null);

  // Subscribe to notifications once on mount
  useEffect(() => {
    unsubNotifRef.current = holosuitBridge.onNotification(notif => {
      setNotifications(prev => [notif, ...prev].slice(0, 50));
      setUnreadCount(c => c + 1);
    });
    return () => {
      unsubNotifRef.current?.();
      unsubFrameRef.current?.();
      holosuitBridge.stopSimulation();
    };
  }, []);

  // Poll actors + sensors while simulating
  useEffect(() => {
    if (!isSimulating) return;
    const id = setInterval(() => {
      setActors(holosuitBridge.getActors());
      setSensors(holosuitBridge.getSensorStatuses());
      setSelectedActor(holosuitBridge.getSelectedActorName());
    }, 500);
    return () => clearInterval(id);
  }, [isSimulating]);

  const startSim = useCallback(() => {
    setIsSimulating(true);
    holosuitBridge.startSimulation(config.fps, config.simulationIntensity);
    unsubFrameRef.current = holosuitBridge.onFrame(frame => {
      setLastFrame(frame);
      setFrameCount(c => c + 1);
      const now = Date.now();
      fpsRef.current = [...fpsRef.current.filter(ts => now - ts < 1000), now];
      setFps(fpsRef.current.length);
    });
  }, [config.fps, config.simulationIntensity]);

  const stopSim = useCallback(() => {
    setIsSimulating(false);
    holosuitBridge.stopSimulation();
    unsubFrameRef.current?.();
    unsubFrameRef.current = null;
    setActors([]);
    setSensors([]);
    setLastFrame(null);
    setFps(0);
  }, []);

  // ─── API handlers ────────────────────────────────────────────────────────────
  const apiCfg = { host: config.host, apiPort: config.localApiPort ?? 14053 };

  const handlePing = async () => {
    setPinging(true);
    const ok = await holosuitPing(apiCfg);
    setPingStatus(ok ? 'reachable' : 'unreachable');
    setPinging(false);
  };

  const handleCalibrate = async () => {
    setApiLoading('calibrate');
    setApiMessage('');
    const result = await holosuitCalibrate(apiCfg);
    setApiLoading(null);
    setApiStatus(result.ok ? 'ok' : 'error');
    setApiMessage(result.ok ? (result.message ?? 'Calibration triggered') : (result.error ?? 'Error'));
  };

  const handleStartRecording = async () => {
    setApiLoading('rec');
    setApiMessage('');
    const result = await holosuitStartRecording(apiCfg, takeName || 'HoloStage_Take');
    setApiLoading(null);
    if (result.ok) { setIsRecording(true); setApiStatus('ok'); setApiMessage(result.message ?? 'Recording started'); }
    else { setApiStatus('error'); setApiMessage(result.error ?? 'Error'); }
  };

  const handleStopRecording = async () => {
    setApiLoading('rec');
    setApiMessage('');
    const result = await holosuitStopRecording(apiCfg);
    setApiLoading(null);
    setIsRecording(false);
    setApiStatus(result.ok ? 'ok' : 'error');
    setApiMessage(result.ok ? (result.message ?? 'Recording stopped') : (result.error ?? 'Error'));
  };

  const handleDismissNotif = useCallback((id: string) => {
    holosuitBridge.dismissNotification(id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const handleClearNotifs = useCallback(() => {
    notifications.forEach(n => holosuitBridge.dismissNotification(n.id));
    setNotifications([]);
    setUnreadCount(0);
  }, [notifications]);

  const handleTabClick = (t: typeof tab) => {
    setTab(t);
    if (t === 'notifs') setUnreadCount(0);
  };

  const TABS = [
    { id: 'stream' as const, label: 'Stream' },
    { id: 'hands'  as const, label: 'Hands'  },
    { id: 'face'   as const, label: 'Face'   },
    { id: 'actors' as const, label: 'Actors' },
    { id: 'remote' as const, label: 'Remote' },
    { id: 'notifs' as const, label: 'Alerts', badge: unreadCount },
  ];

  const activeBones = lastFrame?.body.bones ?? [];
  const BONE_COLS = [activeBones.slice(0, 10), activeBones.slice(10)];

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-4"
      style={{ background: '#0a0a0a', color: 'white' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-400" />
          <div>
            <h3 className="text-base font-bold text-white">HoloSuit Bridge</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
              {config.simulationMode ? '🎭 Simulation' : `ws://${config.host}:${config.port}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isSimulating && (
            <div className="flex items-center gap-1.5 text-xs font-bold"
              style={{ color: '#22c55e' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {fps}fps · {frameCount.toLocaleString()} frames
            </div>
          )}
          <button
            onClick={isSimulating ? stopSim : startSim}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={isSimulating
              ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
              : { background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.3)' }
            }>
            {isSimulating
              ? <><StopCircle className="w-3.5 h-3.5" /> Stop</>
              : <><PlayCircle className="w-3.5 h-3.5" /> Start</>
            }
          </button>
        </div>
      </div>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex gap-0.5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(tabItem => (
          <button key={tabItem.id} onClick={() => handleTabClick(tabItem.id)}
            className="relative flex-1 py-1.5 text-[10px] font-bold tracking-wider uppercase rounded transition-colors"
            style={{
              background: tab === tabItem.id ? 'rgba(249,115,22,0.18)' : 'transparent',
              color: tab === tabItem.id ? '#f97316' : 'rgba(255,255,255,0.35)',
            }}>
            {tabItem.label}
            {tabItem.badge != null && tabItem.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-black flex items-center justify-center"
                style={{ background: '#ef4444', color: 'white' }}>
                {tabItem.badge > 9 ? '9+' : tabItem.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ STREAM tab ═════════════════════════════════════════════════════ */}
      {tab === 'stream' && (
        <div className="space-y-3">
          {!lastFrame ? (
            <div className="flex flex-col items-center gap-3 py-10"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <Radio className="w-10 h-10" />
              <p className="text-sm">Press Start to begin simulation stream</p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'FPS',        v: fps,                           ok: fps >= 55, warn: fps > 0 && fps < 30 },
                  { label: 'Confidence', v: `${(lastFrame.body.confidence * 100).toFixed(0)}%`, ok: lastFrame.body.confidence > 0.85, warn: lastFrame.body.confidence < 0.6 },
                  { label: 'Velocity',   v: `${lastFrame.body.velocity.toFixed(2)}m/s`, ok: false, warn: false },
                ].map(({ label, v, ok, warn }) => (
                  <div key={label} className="p-2 rounded-lg flex flex-col items-center"
                    style={{
                      background: warn ? 'rgba(239,68,68,0.07)' : ok ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${warn ? 'rgba(239,68,68,0.2)' : ok ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                    <span className="text-[10px] font-bold uppercase tracking-widest"
                      style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                    <span className="text-lg font-mono font-black"
                      style={{ color: warn ? '#ef4444' : ok ? '#22c55e' : '#f97316' }}>{v}</span>
                  </div>
                ))}
              </div>

              {/* Bone rotations */}
              <div className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>Body Bones · Y Rotation</p>
                <div className="grid grid-cols-1 gap-1">
                  {lastFrame.body.bones.map(bone => (
                    <BoneBar key={bone.bone} label={bone.bone} value={bone.rotation.y} />
                  ))}
                </div>
              </div>

              {/* Root position */}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(['x', 'y', 'z'] as const).map(ax => (
                  <div key={ax} className="p-2 rounded" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p style={{ color: 'rgba(255,255,255,0.35)' }}>Root {ax.toUpperCase()}</p>
                    <p className="font-mono" style={{ color: '#f97316' }}>{lastFrame.body.rootPosition[ax].toFixed(4)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ HANDS tab ══════════════════════════════════════════════════════ */}
      {tab === 'hands' && (
        <div className="space-y-3">
          {!lastFrame ? (
            <p className="text-xs text-center py-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Start simulation to see hand data
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {(['left', 'right'] as const).map(side => (
                <div key={side} className="p-3 rounded-lg space-y-2"
                  style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[10px] font-bold tracking-widest uppercase"
                    style={{ color: 'rgba(249,115,22,0.7)' }}>
                    {side === 'left' ? '← Left' : 'Right →'}
                  </p>
                  <div className="text-[9px] font-mono mb-1" style={{ color: 'rgba(255,255,255,0.25)' }}>
                    Wrist Y: {lastFrame.hands[side].wrist.y.toFixed(3)}
                  </div>
                  <div className="space-y-1.5">
                    {lastFrame.hands[side].fingers.map(f => (
                      <FingerCurlBar key={f.finger} finger={f.finger} curl={f.curl} />
                    ))}
                  </div>
                  <div className="flex justify-between text-[9px] pt-1"
                    style={{ color: 'rgba(255,255,255,0.2)' }}>
                    <span>Spread: {lastFrame.hands[side].fingers[1]?.spread.toFixed(2) ?? '—'}</span>
                    <span className="text-emerald-400">
                      {lastFrame.hands[side].active ? 'ACTIVE' : 'IDLE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ FACE tab ═══════════════════════════════════════════════════════ */}
      {tab === 'face' && (
        <div className="space-y-3">
          {!lastFrame ? (
            <p className="text-xs text-center py-10" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Start simulation to see face data
            </p>
          ) : (
            <>
              {/* Head stats */}
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'Head Yaw',  v: `${(lastFrame.face.headRotation.y * 57.3).toFixed(1)}°` },
                  { label: 'Confidence', v: `${(lastFrame.face.confidence * 100).toFixed(0)}%` },
                ].map(({ label, v }) => (
                  <div key={label} className="p-2 rounded"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                    <p className="text-sm font-mono font-bold" style={{ color: '#f97316' }}>{v}</p>
                  </div>
                ))}
              </div>

              {/* Blendshapes */}
              <div className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
                  style={{ color: 'rgba(255,255,255,0.28)' }}>Blendshapes</p>
                <div className="space-y-1.5">
                  {lastFrame.face.blendshapes.map(bs => (
                    <BoneBar key={bs.name} label={bs.name.substring(0, 16)} value={bs.value} />
                  ))}
                </div>
              </div>

              {/* Eye gaze */}
              <div className="grid grid-cols-2 gap-2">
                {(['eyeGazeLeft', 'eyeGazeRight'] as const).map(side => (
                  <div key={side} className="p-2 rounded"
                    style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-[10px] mb-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {side === 'eyeGazeLeft' ? 'Left Gaze' : 'Right Gaze'}
                    </p>
                    <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.55)' }}>
                      X:{lastFrame.face[side].x.toFixed(2)} Y:{lastFrame.face[side].y.toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══ ACTORS tab ═════════════════════════════════════════════════════ */}
      {tab === 'actors' && (
        <div className="space-y-4">
          {/* Actor selector */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              <User className="w-3 h-3" /> Actors
            </p>
            {actors.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                Start simulation to see actors
              </p>
            ) : (
              <div className="space-y-1.5">
                {actors.map(actor => (
                  <button key={actor.actorName}
                    onClick={() => { holosuitBridge.selectActor(actor.actorName); setSelectedActor(actor.actorName); }}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs transition-all"
                    style={
                      selectedActor === actor.actorName
                        ? { background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316' }
                        : { background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }
                    }>
                    <User className="w-3 h-3 shrink-0" />
                    <span className="flex-1 font-mono text-left font-bold">{actor.actorName}</span>
                    <span className="flex items-center gap-1">
                      {actor.hasBody  && <span className="text-[9px] font-bold px-1 rounded"
                        style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>BODY</span>}
                      {actor.hasFace  && <span className="text-[9px] font-bold px-1 rounded"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>FACE</span>}
                      {actor.hasHands && <span className="text-[9px] font-bold px-1 rounded"
                        style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>HANDS</span>}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      {actor.frameRate}fps
                    </span>
                    {selectedActor === actor.actorName && (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" style={{ color: '#f97316' }} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sensor health grid */}
          <div>
            <p className="text-[10px] font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5"
              style={{ color: 'rgba(255,255,255,0.28)' }}>
              <Activity className="w-3 h-3" /> Sensor Health ({sensors.length} sensors)
            </p>
            {sensors.length === 0 ? (
              <p className="text-xs py-3 text-center" style={{ color: 'rgba(255,255,255,0.2)' }}>
                No sensors — start simulation
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {sensors.map(s => <SensorCard key={s.sensorId} sensor={s} />)}
              </div>
            )}
          </div>

          {/* Low-battery warning callout */}
          {sensors.some(s => s.batteryPercent < 20) && (
            <div className="flex items-start gap-2 p-3 rounded-lg"
              style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-400">
                {sensors.filter(s => s.batteryPercent < 20).length} sensor(s) below 20% battery.
                Charge before next session.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ══ REMOTE tab ═════════════════════════════════════════════════════ */}
      {tab === 'remote' && (
        <div className="space-y-4">
          {/* API ping status */}
          <div className="p-3 rounded-lg flex items-center justify-between"
            style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <div>
              <p className="text-xs font-bold text-white">HoloSuit Studio API</p>
              <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.35)' }}>
                http://{config.host}:{config.localApiPort ?? 14053}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full"
                style={{
                  background: pingStatus === 'reachable' ? '#22c55e' :
                    pingStatus === 'unreachable' ? '#ef4444' : 'rgba(255,255,255,0.15)',
                  boxShadow: pingStatus === 'reachable' ? '0 0 6px #22c55e' : 'none',
                }} />
              <span className="text-[10px] font-bold"
                style={{ color: pingStatus === 'reachable' ? '#22c55e' : pingStatus === 'unreachable' ? '#ef4444' : 'rgba(255,255,255,0.3)' }}>
                {pingStatus === 'reachable' ? 'ONLINE' : pingStatus === 'unreachable' ? 'OFFLINE' : 'UNKNOWN'}
              </span>
              <button onClick={handlePing} disabled={pinging}
                className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold transition-all disabled:opacity-50"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)' }}>
                <RefreshCw className={`w-2.5 h-2.5 ${pinging ? 'animate-spin' : ''}`} />
                Ping
              </button>
            </div>
          </div>

          {/* Config (host / api port) */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Host</label>
              <input type="text" value={config.host}
                onChange={e => onConfigChange({ ...config, host: e.target.value })}
                className="w-full px-2.5 py-1.5 rounded text-xs font-mono outline-none focus:border-orange-500"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>API Port</label>
              <input type="number" value={config.localApiPort ?? 14053}
                onChange={e => onConfigChange({ ...config, localApiPort: parseInt(e.target.value) || 14053 })}
                className="w-full px-2.5 py-1.5 rounded text-xs font-mono outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
          </div>

          {/* Calibrate */}
          <button onClick={handleCalibrate} disabled={!!apiLoading}
            className="w-full py-2.5 text-xs font-bold tracking-wider uppercase rounded-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.28)' }}>
            <Zap className="w-3.5 h-3.5" />
            {apiLoading === 'calibrate' ? 'Calibrating…' : 'Calibrate Suit (T-Pose)'}
          </button>

          {/* Recording */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.28)' }}>Recording</p>
            <div className="flex gap-2">
              <input value={takeName} onChange={e => setTakeName(e.target.value)}
                placeholder="Take name…"
                className="flex-1 px-2.5 py-1.5 rounded text-xs text-white outline-none focus:border-orange-500"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
              <button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                disabled={!!apiLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold tracking-wider uppercase rounded-lg transition-all shrink-0 disabled:opacity-50"
                style={isRecording
                  ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }
                  : { background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.28)' }
                }>
                {isRecording
                  ? <><Video className="w-3 h-3" /> Stop</>
                  : apiLoading === 'rec' ? '…'
                  : <><Circle className="w-3 h-3" style={{ color: '#ef4444' }} /> Rec</>
                }
              </button>
            </div>
            {isRecording && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: '#ef4444' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Recording "{takeName}"…
              </div>
            )}
          </div>

          {/* API message */}
          {apiMessage && (
            <div className="flex items-start gap-2 p-2.5 rounded"
              style={{
                background: apiStatus === 'ok' ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                border: `1px solid ${apiStatus === 'ok' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)'}`,
              }}>
              {apiStatus === 'ok'
                ? <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                : <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
              }
              <p className="text-xs" style={{ color: apiStatus === 'ok' ? '#22c55e' : '#ef4444' }}>
                {apiMessage}
              </p>
            </div>
          )}

          {/* Sim config */}
          <div className="pt-2 space-y-2" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[10px] font-bold tracking-widest uppercase"
              style={{ color: 'rgba(255,255,255,0.28)' }}>Simulation Config</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>FPS</label>
                <select value={config.fps}
                  onChange={e => onConfigChange({ ...config, fps: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 rounded text-xs text-white outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {[15, 30, 60, 90, 120].map(f => <option key={f} value={f}>{f} FPS</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Intensity: {(config.simulationIntensity * 100).toFixed(0)}%
                </label>
                <input type="range" min={0.1} max={1} step={0.05}
                  value={config.simulationIntensity}
                  onChange={e => onConfigChange({ ...config, simulationIntensity: parseFloat(e.target.value) })}
                  className="w-full" style={{ accentColor: '#f97316' }} />
              </div>
            </div>
            <button
              onClick={() => { setSavedConfig(true); setTimeout(() => setSavedConfig(false), 2000); }}
              className="w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5"
              style={{
                background: savedConfig ? 'rgba(34,197,94,0.1)' : 'rgba(249,115,22,0.08)',
                border: savedConfig ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(249,115,22,0.2)',
                color: savedConfig ? '#22c55e' : '#f97316',
              }}>
              {savedConfig ? <><CheckCircle className="w-3 h-3" /> Saved!</> : 'Save Config'}
            </button>
          </div>
        </div>
      )}

      {/* ══ ALERTS tab ═════════════════════════════════════════════════════ */}
      {tab === 'notifs' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-orange-400" />
              <p className="text-xs font-bold text-white">System Alerts</p>
              {notifications.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button onClick={handleClearNotifs}
                className="text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 transition-all hover:opacity-70"
                style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.35)' }}>
                <X className="w-2.5 h-2.5" /> Clear all
              </button>
            )}
          </div>

          {notifications.filter(n => !n.dismissed).length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10"
              style={{ color: 'rgba(255,255,255,0.18)' }}>
              <BellOff className="w-8 h-8" />
              <p className="text-xs">No alerts — start simulation to see sensor events</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications
                .filter(n => !n.dismissed)
                .map(n => (
                  <NotifCard key={n.id} notif={n} onDismiss={handleDismissNotif} />
                ))
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
}
