// ─── MotionSourceSetup ────────────────────────────────────────────────────────
// Configure and test motion capture sources.
// Supports: HoloSuit Studio (primary), future: Xsens, Perception Neuron, ARKit

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Wifi, WifiOff, Settings, Play, Square, CheckCircle, AlertTriangle,
  Radio, Zap, Clock, Signal, RefreshCw, Info, Activity, Layers,
} from 'lucide-react';
import type { HoloSuitConfig } from '../../schemas/holostage/motionSource.schema';
import { DEFAULT_HOLOSUIT_CONFIG } from '../../schemas/holostage/motionSource.schema';
import { holosuitAdapter } from '../../services/holostage/holosuitAdapter';
import type { AdapterStatus, AdapterStats } from '../../services/holostage/holosuitAdapter';

// ─── Types / constants ────────────────────────────────────────────────────────

interface MotionSourceSetupProps {
  config: HoloSuitConfig;
  onConfigChange: (config: HoloSuitConfig) => void;
}

const STATUS_CONFIG: Record<AdapterStatus, { color: string; label: string; dot: string }> = {
  disconnected:    { color: 'rgba(255,255,255,0.35)', label: 'Disconnected',   dot: 'rgba(255,255,255,0.2)' },
  connecting:      { color: '#facc15',                label: 'Connecting…',    dot: '#facc15' },
  connected:       { color: '#22c55e',                label: 'Connected',      dot: '#22c55e' },
  receiving_body:  { color: '#22c55e',                label: 'Receiving Body', dot: '#22c55e' },
  receiving_hands: { color: '#22c55e',                label: 'Body + Hands',   dot: '#22c55e' },
  receiving_face:  { color: '#22c55e',                label: 'Full Capture',   dot: '#22c55e' },
  unstable:        { color: '#f97316',                label: 'Unstable',       dot: '#f97316' },
  lost_signal:     { color: '#ef4444',                label: 'Signal Lost',    dot: '#ef4444' },
  fallback_active: { color: '#a78bfa',                label: 'Fallback Active',dot: '#a78bfa' },
  error:           { color: '#ef4444',                label: 'Error',          dot: '#ef4444' },
};

const PROVIDER_OPTIONS = [
  { id: 'holosuit',          label: 'HoloSuit Studio',   defaultPort: 14043, available: true,
    desc: 'Full-body suit + Smartgloves + Face Capture' },
  { id: 'xsens',             label: 'Xsens MVN',         defaultPort: 9763,  available: false,
    desc: 'Xsens body suit via MVN Analyze' },
  { id: 'perception_neuron', label: 'Perception Neuron', defaultPort: 7001,  available: false,
    desc: 'Axis Neuron Studio streaming' },
  { id: 'arkit',             label: 'ARKit Face (iOS)',  defaultPort: 11111, available: false,
    desc: 'Face capture from iPhone' },
];

const FPS_OPTIONS = [30, 60, 90, 120] as const;
const SPARKLINE_SAMPLES = 40;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatBadge({
  label, value, unit = '', warn = false, ok = false,
}: { label: string; value: string | number; unit?: string; warn?: boolean; ok?: boolean }) {
  const color = warn ? '#ef4444' : ok ? '#22c55e' : '#f97316';
  return (
    <div className="flex flex-col items-center p-2 rounded-lg"
      style={{
        background: warn ? 'rgba(239,68,68,0.08)' : ok ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${warn ? 'rgba(239,68,68,0.25)' : ok ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
      }}>
      <span className="text-[10px] font-bold tracking-widest uppercase"
        style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</span>
      <span className="text-xl font-mono font-black leading-tight" style={{ color }}>
        {value}
      </span>
      {unit && <span className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.3)' }}>{unit}</span>}
    </div>
  );
}

function SignalBar({ active, label, sub }: { active: boolean; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2">
      <div className="flex items-end gap-0.5 shrink-0">
        {[0.4, 0.65, 0.85, 1].map((h, i) => (
          <div key={i} className="w-1.5 rounded-sm transition-all duration-300"
            style={{ height: `${h * 18}px`, background: active ? '#22c55e' : 'rgba(255,255,255,0.12)' }} />
        ))}
      </div>
      <div className="flex-1">
        <div className="text-sm font-medium" style={{ color: active ? 'white' : 'rgba(255,255,255,0.45)' }}>{label}</div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.28)' }}>{sub}</div>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full transition-all"
          style={{ background: active ? '#22c55e' : 'rgba(255,255,255,0.15)', boxShadow: active ? '0 0 6px #22c55e' : 'none' }} />
        <span className="text-xs font-bold w-16 text-right"
          style={{ color: active ? '#22c55e' : 'rgba(255,255,255,0.25)' }}>
          {active ? 'RECEIVING' : 'NO SIGNAL'}
        </span>
      </div>
    </div>
  );
}

function FpsSparkline({ samples }: { samples: number[] }) {
  const max = Math.max(...samples, 1);
  const w = 100 / Math.max(SPARKLINE_SAMPLES - 1, 1);
  const points = samples.map((v, i) => `${i * w},${28 - (v / max) * 26}`).join(' ');
  return (
    <svg width="100%" height="30" viewBox={`0 0 ${100} 30`} preserveAspectRatio="none"
      style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke="#f97316" strokeWidth="1.5"
        strokeLinejoin="round" opacity={0.7} />
      {samples.length > 0 && (
        <circle cx={(samples.length - 1) * w} cy={28 - (samples[samples.length - 1] / max) * 26}
          r="2.5" fill="#f97316" />
      )}
    </svg>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <p className="text-[10px] font-bold tracking-widest uppercase mb-2"
      style={{ color: 'rgba(255,255,255,0.28)' }}>{text}</p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MotionSourceSetup({ config, onConfigChange }: MotionSourceSetupProps) {
  const [status, setStatus]           = useState<AdapterStatus>('disconnected');
  const [stats, setStats]             = useState<AdapterStats>({ fps: 0, latencyMs: 0, packetLoss: 0, frameCount: 0, lastFrameAt: 0 });
  const [localConfig, setLocalConfig] = useState<HoloSuitConfig>({ ...DEFAULT_HOLOSUIT_CONFIG, ...config });
  const [activeTab, setActiveTab]     = useState<'setup' | 'monitor' | 'advanced' | 'info'>('setup');
  const [fpsSamples, setFpsSamples]   = useState<number[]>(Array(SPARKLINE_SAMPLES).fill(0));
  const [latSamples, setLatSamples]   = useState<number[]>(Array(SPARKLINE_SAMPLES).fill(0));
  const [saved, setSaved]             = useState(false);
  const [previewProvider, setPreviewProvider] = useState('holosuit');
  const unsubRef      = useRef<(() => void) | null>(null);
  const sparkTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsRef      = useRef(stats);
  statsRef.current    = stats;

  useEffect(() => {
    unsubRef.current = holosuitAdapter.onStatus((s, st) => {
      setStatus(s);
      setStats(st);
    });
    sparkTimerRef.current = setInterval(() => {
      setFpsSamples(prev => [...prev.slice(1), statsRef.current.fps]);
      setLatSamples(prev => [...prev.slice(1), statsRef.current.latencyMs]);
    }, 500);
    return () => {
      unsubRef.current?.();
      holosuitAdapter.disconnect();
      if (sparkTimerRef.current) clearInterval(sparkTimerRef.current);
    };
  }, []);

  const isConnected = status !== 'disconnected' && status !== 'error';
  const isReceiving = status.startsWith('receiving_');
  const sc = STATUS_CONFIG[status] ?? STATUS_CONFIG.disconnected;

  const update = useCallback(<K extends keyof HoloSuitConfig>(key: K, val: HoloSuitConfig[K]) => {
    setLocalConfig(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  }, []);

  const handleConnect = useCallback(() => {
    const adapterProtocol = localConfig.simulationMode ? 'mock' : 'websocket';
    holosuitAdapter.configure({
      protocol: adapterProtocol,
      ip: localConfig.host,
      port: localConfig.port,
      reconnectIntervalMs: localConfig.reconnectIntervalMs ?? 3000,
      maxReconnectAttempts: localConfig.maxReconnectAttempts ?? 10,
      latencyCompensationMs: 40,
    });
    holosuitAdapter.connect();
    const next = { ...localConfig, streamingEnabled: true };
    setLocalConfig(next);
    onConfigChange(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [localConfig, onConfigChange]);

  const handleDisconnect = useCallback(() => {
    holosuitAdapter.disconnect();
    const next = { ...localConfig, streamingEnabled: false };
    setLocalConfig(next);
    onConfigChange(next);
  }, [localConfig, onConfigChange]);

  const TABS = [
    { id: 'setup',   label: 'Setup',    Icon: Settings  },
    { id: 'monitor', label: 'Monitor',  Icon: Activity  },
    { id: 'advanced',label: 'Advanced', Icon: Layers    },
    { id: 'info',    label: 'Info',     Icon: Info      },
  ] as const;

  const TPOSE_STEPS_INFO = [
    `Default streaming port: UDP ${localConfig.port}`,
    `Nancy HTTP API: port ${localConfig.localApiPort ?? 14053} (actor list, battery, sensor status)`,
    'Custom Streaming emits JSON with bone rotations per frame',
    'Team Sharing (MQTT/WS) supports multiple actors simultaneously',
    'Smartgloves stream on the same channel',
    'Face capture requires HoloFace app on iOS device (same LAN)',
  ];

  return (
    <div className="h-full flex flex-col gap-4 overflow-y-auto p-4"
      style={{ background: '#0a0a0a', color: 'white' }}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-5 h-5 text-orange-400" />
          <div>
            <h3 className="text-base font-bold text-white">Motion Source Setup</h3>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {localConfig.simulationMode ? '🎭 Simulation Mode' : `ws://${localConfig.host}:${localConfig.port}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: 'rgba(255,255,255,0.05)', color: sc.color, border: `1px solid ${sc.color}30` }}>
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: sc.dot }} />
          {sc.label}
        </div>
      </div>

      {/* Live stats strip */}
      {isConnected && (
        <div className="grid grid-cols-4 gap-2">
          <StatBadge label="FPS"     value={stats.fps}     warn={stats.fps > 0 && stats.fps < 30} ok={stats.fps >= 55} />
          <StatBadge label="Latency" value={stats.latencyMs} unit="ms" warn={stats.latencyMs > 120} ok={stats.latencyMs <= 40} />
          <StatBadge label="Frames"  value={stats.frameCount > 99999 ? '99K+' : stats.frameCount} />
          <StatBadge label="Loss"    value={stats.packetLoss.toFixed(1)} unit="%" warn={stats.packetLoss > 5} ok={stats.packetLoss === 0} />
        </div>
      )}

      {/* Tab bar */}
      <div className="grid grid-cols-4 gap-0.5 p-1 rounded-lg"
        style={{ background: 'rgba(255,255,255,0.04)' }}>
        {TABS.map(tabItem => {
          const Icon = tabItem.Icon;
          return (
            <button key={tabItem.id} onClick={() => setActiveTab(tabItem.id)}
              className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium rounded transition-colors"
              style={{
                background: activeTab === tabItem.id ? 'rgba(249,115,22,0.2)' : 'transparent',
                color: activeTab === tabItem.id ? '#f97316' : 'rgba(255,255,255,0.4)',
              }}>
              <Icon className="w-3.5 h-3.5" />
              {tabItem.label}
            </button>
          );
        })}
      </div>

      {/* ══ SETUP ══════════════════════════════════════════════════════════ */}
      {activeTab === 'setup' && (
        <div className="space-y-5">
          {/* Provider */}
          <div>
            <SectionLabel text="Motion Provider" />
            <div className="space-y-1.5">
              {PROVIDER_OPTIONS.map(p => {
                const active = p.id === previewProvider;
                return (
                  <button key={p.id} disabled={!p.available}
                    onClick={() => { setPreviewProvider(p.id); update('port', p.defaultPort); }}
                    className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all"
                    style={{
                      background: active ? 'rgba(249,115,22,0.1)' : 'rgba(255,255,255,0.02)',
                      border: active ? '1px solid rgba(249,115,22,0.3)' : '1px solid rgba(255,255,255,0.06)',
                      opacity: p.available ? 1 : 0.38,
                    }}>
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: active ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.06)' }}>
                      <Zap className="w-4 h-4" style={{ color: active ? '#f97316' : 'rgba(255,255,255,0.3)' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-white flex items-center gap-2">
                        {p.label}
                        {active && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-bold"
                            style={{ background: 'rgba(249,115,22,0.2)', color: '#f97316' }}>ACTIVE</span>
                        )}
                        {!p.available && (
                          <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>coming soon</span>
                        )}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: 'rgba(255,255,255,0.35)' }}>{p.desc}</div>
                    </div>
                    {active && <CheckCircle className="w-4 h-4 text-orange-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Source mode */}
          <div>
            <SectionLabel text="Source Mode" />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => update('simulationMode', true)}
                className="py-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1"
                style={{
                  background: localConfig.simulationMode ? 'rgba(249,115,22,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${localConfig.simulationMode ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.08)'}`,
                  color: localConfig.simulationMode ? '#f97316' : 'rgba(255,255,255,0.4)',
                }}>
                <span className="text-base">🎭</span>Simulation
              </button>
              <button onClick={() => update('simulationMode', false)}
                className="py-3 rounded-lg text-xs font-bold transition-all flex flex-col items-center gap-1"
                style={{
                  background: !localConfig.simulationMode ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${!localConfig.simulationMode ? 'rgba(34,197,94,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  color: !localConfig.simulationMode ? '#22c55e' : 'rgba(255,255,255,0.4)',
                }}>
                <span className="text-base">🔌</span>Live Hardware
              </button>
            </div>
          </div>

          {/* Simulation intensity */}
          {localConfig.simulationMode && (
            <div className="space-y-1.5">
              <div className="flex justify-between">
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Simulation Intensity</span>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(249,115,22,0.15)', color: '#f97316' }}>
                  {(localConfig.simulationIntensity * 100).toFixed(0)}%
                </span>
              </div>
              <input type="range" min={0} max={1} step={0.01}
                value={localConfig.simulationIntensity}
                onChange={e => update('simulationIntensity', parseFloat(e.target.value))}
                className="w-full" style={{ accentColor: '#f97316' }} />
              <div className="flex justify-between text-[10px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                <span>Subtle</span><span>Extreme</span>
              </div>
            </div>
          )}

          {/* Network (live only) */}
          {!localConfig.simulationMode && (
            <div>
              <SectionLabel text="Network" />
              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Host / IP</label>
                  <input type="text" value={localConfig.host}
                    onChange={e => update('host', e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none focus:border-orange-500"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                    placeholder="127.0.0.1" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Port</label>
                  <input type="number" value={localConfig.port}
                    onChange={e => update('port', parseInt(e.target.value) || 14043)}
                    className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
                </div>
              </div>
            </div>
          )}

          {/* Capture channels */}
          <div>
            <SectionLabel text="Capture Channels" />
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'captureBody'  as const, emoji: '🦴', label: 'Body',  sub: 'Full skeleton' },
                { key: 'captureHands' as const, emoji: '🖐', label: 'Hands', sub: 'Smartgloves' },
                { key: 'captureFace'  as const, emoji: '😶', label: 'Face',  sub: 'Expression' },
              ]).map(({ key, emoji, label, sub }) => {
                const active = localConfig[key];
                return (
                  <button key={key} onClick={() => update(key, !active)}
                    className="flex flex-col items-center py-3 px-2 rounded-lg transition-all"
                    style={{
                      background: active ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                      border: active ? '1px solid rgba(34,197,94,0.3)' : '1px solid rgba(255,255,255,0.07)',
                    }}>
                    <span className="text-lg">{emoji}</span>
                    <span className="text-xs font-bold mt-1"
                      style={{ color: active ? '#22c55e' : 'rgba(255,255,255,0.5)' }}>{label}</span>
                    <span className="text-[10px] mt-0.5" style={{ color: 'rgba(255,255,255,0.25)' }}>{sub}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actor name */}
          <div className="space-y-1">
            <label className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.4)' }}>Actor Name</label>
            <input type="text" value={localConfig.actorName}
              onChange={e => update('actorName', e.target.value)}
              className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none focus:border-orange-500"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
              placeholder="BoostifyActor" />
          </div>

          {/* FPS target */}
          <div>
            <SectionLabel text="Target FPS" />
            <div className="grid grid-cols-4 gap-2">
              {FPS_OPTIONS.map(f => (
                <button key={f} onClick={() => update('fps', f)}
                  className="py-2 rounded text-xs font-bold transition-all"
                  style={{
                    background: localConfig.fps === f ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                    border: localConfig.fps === f ? '1px solid rgba(249,115,22,0.4)' : '1px solid rgba(255,255,255,0.07)',
                    color: localConfig.fps === f ? '#f97316' : 'rgba(255,255,255,0.4)',
                  }}>
                  {f}fps
                </button>
              ))}
            </div>
          </div>

          {/* Connect/Disconnect */}
          <button
            onClick={isConnected ? handleDisconnect : handleConnect}
            className="w-full py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: isConnected ? 'rgba(239,68,68,0.12)' : saved ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.12)',
              border: isConnected ? '1px solid rgba(239,68,68,0.35)' : saved ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(249,115,22,0.35)',
              color: isConnected ? '#ef4444' : saved ? '#22c55e' : '#f97316',
            }}>
            {isConnected
              ? <><Square className="w-4 h-4" /> Disconnect</>
              : saved
                ? <><CheckCircle className="w-4 h-4" /> Connected!</>
                : <><Play className="w-4 h-4" />{localConfig.simulationMode ? 'Start Simulation' : 'Connect to HoloSuit'}</>
            }
          </button>
        </div>
      )}

      {/* ══ MONITOR ════════════════════════════════════════════════════════ */}
      {activeTab === 'monitor' && (
        <div className="space-y-4">
          {!isConnected ? (
            <div className="flex flex-col items-center gap-3 py-10"
              style={{ color: 'rgba(255,255,255,0.2)' }}>
              <WifiOff className="w-10 h-10" />
              <p className="text-sm">Not connected — go to Setup to connect.</p>
            </div>
          ) : (
            <>
              {/* Channel signal bars */}
              <div className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center gap-1.5 mb-3">
                  <Signal className="w-3.5 h-3.5 text-orange-400" />
                  <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>Signal Channels</p>
                </div>
                <SignalBar active={isReceiving} label="Body Tracking"
                  sub={`${stats.fps}fps · ${stats.frameCount} frames received`} />
                <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                <SignalBar active={status === 'receiving_hands' || status === 'receiving_face'} label="Hand Tracking"
                  sub="Smartgloves finger data" />
                <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }} />
                <SignalBar active={status === 'receiving_face'} label="Face Capture"
                  sub="Blendshapes + head pose" />
              </div>

              {/* FPS sparkline */}
              <div className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-orange-400" />
                    <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>FPS History</p>
                  </div>
                  <span className="text-sm font-mono font-bold" style={{ color: '#f97316' }}>{stats.fps} fps</span>
                </div>
                <FpsSparkline samples={fpsSamples} />
                <div className="flex justify-between text-[10px] mt-1" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  <span>20s ago</span><span>now</span>
                </div>
              </div>

              {/* Latency sparkline */}
              <div className="p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-orange-400" />
                    <p className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.35)' }}>Latency History</p>
                  </div>
                  <span className="text-sm font-mono font-bold"
                    style={{ color: stats.latencyMs > 120 ? '#ef4444' : '#22c55e' }}>
                    {stats.latencyMs}ms
                  </span>
                </div>
                <FpsSparkline samples={latSamples} />
              </div>

              {/* Warnings */}
              {stats.fps > 0 && stats.fps < 30 && (
                <div className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400">
                    <p className="font-bold">Low FPS ({stats.fps}fps)</p>
                    <p className="opacity-70 mt-0.5">Check network or use Simulation mode for testing.</p>
                  </div>
                </div>
              )}
              {stats.latencyMs > 250 && (
                <div className="flex items-start gap-2 p-3 rounded-lg"
                  style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div className="text-xs text-red-400">
                    <p className="font-bold">Critical Latency ({stats.latencyMs}ms)</p>
                    <p className="opacity-70 mt-0.5">Fallback animation will activate above 250ms.</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══ ADVANCED ═══════════════════════════════════════════════════════ */}
      {activeTab === 'advanced' && (
        <div className="space-y-4">
          <div className="p-3 rounded-lg space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionLabel text="Connection Resilience" />
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Reconnect Interval (ms)</label>
              <input type="number" value={localConfig.reconnectIntervalMs ?? 3000}
                onChange={e => update('reconnectIntervalMs', parseInt(e.target.value) || 3000)}
                className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Max Reconnect Attempts (0 = infinite)</label>
              <input type="number" value={localConfig.maxReconnectAttempts ?? 10}
                onChange={e => update('maxReconnectAttempts', parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <div>
                <p className="text-sm font-medium text-white">Auto-Reconnect</p>
                <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>Reconnect automatically on signal loss</p>
              </div>
              <button onClick={() => update('autoReconnect', !localConfig.autoReconnect)}
                className="relative w-11 h-6 rounded-full transition-colors shrink-0"
                style={{ background: localConfig.autoReconnect ? '#f97316' : 'rgba(255,255,255,0.12)' }}>
                <div className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                  style={{ left: localConfig.autoReconnect ? '22px' : '2px' }} />
              </button>
            </div>
          </div>

          <div className="p-3 rounded-lg space-y-3"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionLabel text="API Ports" />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Streaming Port</label>
                <input type="number" value={localConfig.port}
                  onChange={e => update('port', parseInt(e.target.value) || 14043)}
                  className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              </div>
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>API Port (HTTP)</label>
                <input type="number" value={localConfig.localApiPort ?? 14053}
                  onChange={e => update('localApiPort', parseInt(e.target.value) || 14053)}
                  className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none"
                  style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }} />
              </div>
            </div>
          </div>

          <div className="p-3 rounded-lg space-y-2"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <SectionLabel text="Multi-Actor (Team Sharing)" />
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Selected Actor (empty = first in stream)</label>
              <input type="text" value={localConfig.selectedActorName ?? ''}
                onChange={e => update('selectedActorName', e.target.value || null)}
                className="w-full px-2.5 py-1.5 rounded text-sm font-mono outline-none focus:border-orange-500"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'white' }}
                placeholder="(auto-select first actor)" />
            </div>
            <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
              HoloSuit Studio Team Sharing streams multiple actors. Enter an actor name to bind to a specific performer.
            </p>
          </div>

          <button
            onClick={() => { onConfigChange(localConfig); setSaved(true); setTimeout(() => setSaved(false), 2000); }}
            className="w-full py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition-all"
            style={{
              background: saved ? 'rgba(34,197,94,0.12)' : 'rgba(249,115,22,0.1)',
              border: saved ? '1px solid rgba(34,197,94,0.35)' : '1px solid rgba(249,115,22,0.3)',
              color: saved ? '#22c55e' : '#f97316',
            }}>
            {saved ? <><CheckCircle className="w-4 h-4" /> Saved!</> : <><RefreshCw className="w-4 h-4" /> Save Advanced Settings</>}
          </button>
        </div>
      )}

      {/* ══ INFO ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'info' && (
        <div className="space-y-4">
          <div className="p-4 rounded-lg"
            style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <div className="flex items-start gap-2 mb-3">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-sm font-bold text-blue-400">HoloSuit Studio — Custom Streaming Setup</p>
            </div>
            <ol className="space-y-2 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {[
                'Open HoloSuit Studio on this machine or the same LAN',
                'Go to: Live Streaming → Custom Streaming',
                `Enable streaming, set Port to ${localConfig.port}`,
                'Select format: JSON',
                'Click "Start Streaming" in HoloSuit Studio FIRST',
                'Then click "Connect to HoloSuit" in the Setup tab',
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-4 h-4 rounded-full text-[10px] font-bold shrink-0 mt-0.5 flex items-center justify-center"
                    style={{ background: 'rgba(59,130,246,0.2)', color: '#60a5fa' }}>{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </div>

          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-bold text-white mb-2">Config Snapshot</p>
            {[
              ['Mode',       localConfig.simulationMode ? 'Simulation' : 'Live Hardware'],
              ['Host',       localConfig.host],
              ['Port',       localConfig.port.toString()],
              ['API Port',   (localConfig.localApiPort ?? 14053).toString()],
              ['Actor',      localConfig.actorName],
              ['FPS target', `${localConfig.fps}fps`],
              ['Body',       localConfig.captureBody  ? '✓ on' : '✗ off'],
              ['Hands',      localConfig.captureHands ? '✓ on' : '✗ off'],
              ['Face',       localConfig.captureFace  ? '✓ on' : '✗ off'],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-xs py-0.5">
                <span style={{ color: 'rgba(255,255,255,0.35)' }}>{k}</span>
                <span className="font-mono" style={{ color: 'rgba(255,255,255,0.65)' }}>{v}</span>
              </div>
            ))}
          </div>

          <div className="p-3 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-bold text-white mb-2">Protocol Notes</p>
            <ul className="space-y-1 text-xs" style={{ color: 'rgba(255,255,255,0.35)' }}>
              {TPOSE_STEPS_INFO.map((n, i) => <li key={i}>• {n}</li>)}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
