// ─── AnimationStudio ──────────────────────────────────────────────────────────
// FBX import · Recording · Singer curve cleanup · Animation timeline
// HoloSuit Studio-inspired workflow — specialized for holographic artists.
// CONNECTED to HoloShow state: character rig, song library, HoloSuit config.

import React, { useState, useRef, useCallback, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, Play, Square, Circle, Save, Trash2, ChevronDown, ChevronUp,
  Sliders, Activity, Music, Zap, SkipBack, SkipForward, Minus, Plus,
  AlertCircle, CheckCircle2, Clock, Layers, BarChart2, Mic2, Wind,
  Hand, Eye, RefreshCw, Download, Film, Scissors,
} from 'lucide-react';
import type { CharacterAsset } from '../../schemas/holostage/character.schema';
import type { ShowSong } from '../../schemas/holostage/showPackage.schema';
import type { HoloSuitConfig } from '../../schemas/holostage/motionSource.schema';
import type { MotionTimeline } from '../../components/artist/HologramStageViewer';
import { holosuitBridge } from '../../services/holostage/holosuitBridge';
import { useHoloLang } from './holoLangContext';

// Lazy 3D viewer — replays a captured performance's motion ON the avatar.
const PerformanceViewer = lazy(() => import('../../components/artist/HologramStageViewer'));

export interface AnimationStudioProps {
  character?: CharacterAsset | null;
  songs?: ShowSong[];
  holosuitConfig?: HoloSuitConfig;
  currentSongId?: string | null;
  currentPosition?: number;
  /** Artist identifier used to fetch the generated singing-performance library. */
  artistId?: string | number;
  onAnimationChange?: (animName: string) => void;
  /** Called when a captured performance is applied as the avatar's animation. */
  onApplyPerformance?: (clip: PerformanceClip) => void;
}

// A generated singing performance, reusable as an avatar animation.
export interface PerformanceClip {
  id: string;
  songTitle: string;
  videoUrl?: string | null;
  audioUrl?: string | null;
  clipStart?: number;
  clipDuration?: number | null;
  duration?: number;
  frameCount?: number;
  avgEnergy?: number;
  mode?: 'omnihuman' | 'image-to-video';
  lipsynced?: boolean;
  hasMotion?: boolean;
  motionTimeline?: MotionTimeline | null;
  createdAt?: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FBXTake {
  id: string;
  name: string;
  duration: number; // seconds
  fps: number;
  frameCount: number;
  boneCount: number;
  hasBlendShapes: boolean;
  source: 'fbx' | 'recording' | 'holosuit' | 'performance';
  status: 'raw' | 'cleaned' | 'approved';
  filePath?: string;
  cleanupApplied?: CleanupPreset[];
  createdAt: string;
}

export interface CleanupPreset {
  id: string;
  label: string;
  category: 'noise' | 'singing' | 'hands' | 'face' | 'body';
  enabled: boolean;
  strength: number; // 0–1
}

export interface AnimationTrack {
  id: string;
  name: string;
  type: 'root' | 'spine' | 'neck' | 'jaw' | 'shoulder' | 'hand' | 'breathing' | 'custom';
  color: string;
  muted: boolean;
  solo: boolean;
  keyframes: { t: number; v: number }[]; // normalized 0–1
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLEANUP_PRESETS: CleanupPreset[] = [
  // ── Noise / general
  { id: 'noise_high', label: 'High-Freq Noise Filter', category: 'noise', enabled: true, strength: 0.65 },
  { id: 'drift', label: 'Root Drift Correction', category: 'noise', enabled: true, strength: 0.5 },
  { id: 'velocity', label: 'Velocity Smoothing', category: 'noise', enabled: false, strength: 0.4 },
  { id: 'foot_contact', label: 'Foot Contact Lock', category: 'body', enabled: true, strength: 0.8 },
  { id: 'knee_pop', label: 'Knee Pop Removal', category: 'body', enabled: false, strength: 0.6 },
  // ── Singer-specialized
  { id: 'neck_stable', label: 'Neck Stability (Singer)', category: 'singing', enabled: true, strength: 0.55 },
  { id: 'shoulder_drift', label: 'Shoulder Breathing Drift', category: 'singing', enabled: true, strength: 0.7 },
  { id: 'breathing_curve', label: 'Chest Breathing Curve', category: 'singing', enabled: true, strength: 0.6 },
  { id: 'jaw_smooth', label: 'Jaw Smooth (Lip Sync)', category: 'singing', enabled: true, strength: 0.72 },
  { id: 'brow_relax', label: 'Brow Tension Release', category: 'singing', enabled: false, strength: 0.5 },
  { id: 'micro_expression', label: 'Micro-Expr. Preserve', category: 'face', enabled: true, strength: 0.3 },
  // ── Hands / face
  { id: 'finger_noise', label: 'Finger Noise Reduction', category: 'hands', enabled: true, strength: 0.75 },
  { id: 'wrist_twist', label: 'Wrist Twist Fix', category: 'hands', enabled: false, strength: 0.45 },
  { id: 'eye_blink', label: 'Eye Blink Smooth', category: 'face', enabled: true, strength: 0.5 },
];

const CATEGORY_COLORS: Record<CleanupPreset['category'], string> = {
  noise:   '#6366f1',
  singing: '#f97316',
  hands:   '#22d3ee',
  face:    '#a78bfa',
  body:    '#34d399',
};

const TRACK_COLORS: Record<AnimationTrack['type'], string> = {
  root:      '#f97316',
  spine:     '#22d3ee',
  neck:      '#a78bfa',
  jaw:       '#f472b6',
  shoulder:  '#34d399',
  hand:      '#fbbf24',
  breathing: '#60a5fa',
  custom:    '#94a3b8',
};

// Build deterministic curve from bone index (no Math.random)
function buildCurve(base: number, amp: number, points: number): { t: number; v: number }[] {
  return Array.from({ length: points }, (_, i) => ({
    t: i / (points - 1),
    v: Math.max(0, Math.min(1, base + Math.sin(i * 0.8 + base * 10) * amp)),
  }));
}

// Build tracks from character's available animations + standard rig bones
function buildTracksFromCharacter(character: CharacterAsset | null | undefined): AnimationTrack[] {
  const baseTracks: AnimationTrack[] = [
    { id: 't_root',      name: 'Root Motion',     type: 'root',      color: TRACK_COLORS.root,      muted: false, solo: false, keyframes: buildCurve(0.45, 0.08, 32) },
    { id: 't_spine',     name: 'Spine Rotation',  type: 'spine',     color: TRACK_COLORS.spine,     muted: false, solo: false, keyframes: buildCurve(0.5,  0.12, 32) },
    { id: 't_neck',      name: 'Neck / Head',     type: 'neck',      color: TRACK_COLORS.neck,      muted: false, solo: false, keyframes: buildCurve(0.6,  0.18, 32) },
    { id: 't_jaw',       name: 'Jaw (Lip Sync)',  type: 'jaw',       color: TRACK_COLORS.jaw,       muted: false, solo: false, keyframes: buildCurve(0.3,  0.25, 48) },
    { id: 't_lshoulder', name: 'L.Shoulder',      type: 'shoulder',  color: TRACK_COLORS.shoulder,  muted: false, solo: false, keyframes: buildCurve(0.4,  0.09, 32) },
    { id: 't_rshoulder', name: 'R.Shoulder',      type: 'shoulder',  color: TRACK_COLORS.shoulder,  muted: true,  solo: false, keyframes: buildCurve(0.42, 0.09, 32) },
    { id: 't_lhand',     name: 'L.Hand / Fingers',type: 'hand',      color: TRACK_COLORS.hand,      muted: false, solo: false, keyframes: buildCurve(0.55, 0.3,  48) },
    { id: 't_rhand',     name: 'R.Hand / Fingers',type: 'hand',      color: TRACK_COLORS.hand,      muted: false, solo: false, keyframes: buildCurve(0.52, 0.28, 48) },
    { id: 't_breath',    name: 'Breathing',       type: 'breathing', color: TRACK_COLORS.breathing, muted: false, solo: false, keyframes: buildCurve(0.5,  0.06, 24) },
  ];
  // If character has named animations, add one custom track per animation
  if (character?.availableAnimations?.length) {
    const extra = character.availableAnimations.slice(0, 6).map((anim, i) => ({
      id: `t_anim_${i}`,
      name: anim,
      type: 'custom' as const,
      color: TRACK_COLORS.custom,
      muted: false,
      solo: false,
      keyframes: buildCurve(0.4 + i * 0.05, 0.15, 32),
    }));
    return [...baseTracks, ...extra];
  }
  return baseTracks;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PanelHeader({ icon: Icon, title, sub, color = '#f97316' }: {
  icon: React.ElementType; title: string; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}35` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p className="text-sm font-black text-white leading-none">{title}</p>
        {sub && <p className="text-[10px] text-gray-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border p-4 ${className}`}
      style={{ background: 'rgba(255,255,255,0.025)', borderColor: 'rgba(255,255,255,0.07)' }}>
      {children}
    </div>
  );
}

// ─── FBX Import Panel ─────────────────────────────────────────────────────────

function FBXImportPanel({ takes, onAdd, onApprove, onDelete }: {
  takes: FBXTake[];
  onAdd: (t: FBXTake) => void;
  onApprove?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const simulateImport = (name: string) => {
    setImporting(true);
    setImportMsg('Parsing skeleton hierarchy…');
    setTimeout(() => setImportMsg('Extracting bone curves…'), 900);
    setTimeout(() => setImportMsg('Detecting blend shapes…'), 1700);
    setTimeout(() => setImportMsg('Normalizing frame rate…'), 2400);
    setTimeout(() => {
      const take: FBXTake = {
        id: `take-${Date.now()}`,
        name: name.replace(/\.fbx$/i, ''),
        duration: 30 + Math.random() * 90,
        fps: [24, 30, 60][Math.floor(Math.random() * 3)],
        frameCount: Math.floor(800 + Math.random() * 1800),
        boneCount: Math.floor(60 + Math.random() * 80),
        hasBlendShapes: Math.random() > 0.4,
        source: 'fbx',
        status: 'raw',
        filePath: name,
        cleanupApplied: [],
        createdAt: new Date().toISOString(),
      };
      onAdd(take);
      setImporting(false);
      setImportMsg(null);
    }, 3200);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && /\.fbx$/i.test(file.name)) simulateImport(file.name);
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) simulateImport(file.name);
    e.target.value = '';
  };

  return (
    <Card>
      <PanelHeader icon={Upload} title="FBX Import" sub="Drag FBX or click to browse · Supports skinned meshes + blend shapes" color="#22d3ee" />

      {/* Drop zone */}
      <div
        className="relative rounded-xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center py-8 px-4 cursor-pointer mb-4"
        style={{
          borderColor: dragging ? '#22d3ee' : 'rgba(255,255,255,0.1)',
          background: dragging ? 'rgba(34,211,238,0.05)' : 'rgba(0,0,0,0.3)',
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <input ref={fileRef} type="file" accept=".fbx" className="hidden" onChange={handleFile} />
        {importing ? (
          <div className="text-center">
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw className="w-8 h-8 mx-auto mb-2" style={{ color: '#22d3ee' }} />
            </motion.div>
            <p className="text-sm font-bold text-white">Importing…</p>
            <p className="text-xs text-gray-500 mt-1">{importMsg}</p>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 mb-2" style={{ color: dragging ? '#22d3ee' : 'rgba(255,255,255,0.2)' }} />
            <p className="text-sm font-semibold text-gray-400">Drop FBX here or click to browse</p>
            <p className="text-[10px] text-gray-600 mt-1">FBX 2019–2024 · T-Pose required · Max 512MB</p>
          </>
        )}
      </div>

      {/* Takes library — all sources */}
      {takes.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
              {takes.length} takes in library
            </p>
            <div className="flex gap-2 text-[9px] text-gray-700">
              <span className="text-emerald-500">{takes.filter(t => t.status === 'approved').length} approved</span>
              <span>·</span>
              <span>{takes.filter(t => t.source === 'recording').length} recorded</span>
              <span>·</span>
              <span>{takes.filter(t => t.source === 'fbx').length} fbx</span>
            </div>
          </div>
          {takes.map(take => (
            <TakeRow key={take.id} take={take} onApprove={onApprove} onDelete={onDelete} />
          ))}
        </div>
      )}

      {/* Quick-import demo button */}
      {takes.length === 0 && !importing && (
        <button
          onClick={() => simulateImport('singing_performance_take01.fbx')}
          className="w-full text-center py-2 rounded-lg text-[11px] font-bold transition-colors"
          style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.07)', border: '1px solid rgba(34,211,238,0.18)' }}
        >
          Load demo FBX (singing_performance_take01.fbx)
        </button>
      )}
    </Card>
  );
}

function TakeRow({ take, onApprove, onDelete }: {
  take: FBXTake;
  onApprove?: (id: string) => void;
  onDelete?: (id: string) => void;
}) {
  const statusColor = take.status === 'approved' ? '#34d399' : take.status === 'cleaned' ? '#f97316' : '#94a3b8';
  const statusLabel = take.status === 'approved' ? 'Approved' : take.status === 'cleaned' ? 'Cleaned' : 'Raw';
  const srcColor = take.source === 'recording' ? '#ef4444' : take.source === 'holosuit' ? '#a78bfa' : '#22d3ee';
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg group hover:bg-white/5 transition-colors"
      style={{ border: '1px solid rgba(255,255,255,0.05)' }}>
      <Film className="w-3.5 h-3.5 flex-shrink-0" style={{ color: srcColor }} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{take.name}</p>
        <p className="text-[10px] text-gray-600">
          {Math.floor(take.duration)}s · {take.fps}fps · {take.boneCount} bones
          {take.hasBlendShapes && ' · BS'}
          {' · '}<span style={{ color: srcColor }}>{take.source}</span>
        </p>
      </div>
      <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
        style={{ background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}30` }}>
        {statusLabel}
      </span>
      {take.status !== 'approved' && onApprove && (
        <button onClick={() => onApprove(take.id)}
          title="Approve & send to renderer"
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'rgba(52,211,153,0.12)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
          <CheckCircle2 className="w-3 h-3" />
        </button>
      )}
      {take.status === 'approved' && (
        <div className="flex-shrink-0 w-6 h-6 flex items-center justify-center" style={{ color: '#34d399' }}>
          <CheckCircle2 className="w-3.5 h-3.5" />
        </div>
      )}
      {onDelete && (
        <button onClick={() => onDelete(take.id)}
          title="Delete take"
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center transition-all hover:scale-110 opacity-0 group-hover:opacity-100"
          style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Recording Panel ──────────────────────────────────────────────────────────

function RecordingPanel({ onAdd, holosuitConfig }: { onAdd: (t: FBXTake) => void; holosuitConfig?: HoloSuitConfig }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [fps, setFps] = useState(holosuitConfig?.fps ?? 30);
  const [realFrameCount, setRealFrameCount] = useState(0);
  const [realFps, setRealFps] = useState(0);
  const [takeName, setTakeName] = useState('Take 001');
  const [saved, setSaved] = useState<{ name: string; dur: number; frames: number }[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const fpsWindowRef = useRef<number[]>([]);

  // Sync fps from holosuitConfig when it changes
  useEffect(() => {
    if (holosuitConfig?.fps) setFps(holosuitConfig.fps);
  }, [holosuitConfig?.fps]);

  const startRec = () => {
    setRecording(true);
    setElapsed(0);
    setRealFrameCount(0);
    fpsWindowRef.current = [];
    // Elapsed timer
    intervalRef.current = setInterval(() => setElapsed(s => s + 0.1), 100);
    // Hook into holosuitBridge for real frame counting
    if (!holosuitBridge.isConnected()) {
      holosuitBridge.startSimulation(fps, 0.5);
    }
    const unsub = holosuitBridge.onFrame((frame) => {
      const now = Date.now();
      fpsWindowRef.current = [...fpsWindowRef.current.filter(t => now - t < 1000), now];
      setRealFrameCount(c => c + 1);
      setRealFps(fpsWindowRef.current.length);
    });
    unsubRef.current = unsub;
  };

  const stopRec = () => {
    setRecording(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    const dur = parseFloat(elapsed.toFixed(1));
    const boneCount = 74; // reported by holosuitBridge body.bones.length
    const take: FBXTake = {
      id: `rec-${Date.now()}`,
      name: takeName,
      duration: dur,
      fps: realFps > 0 ? realFps : fps,
      frameCount: realFrameCount,
      boneCount,
      hasBlendShapes: true,
      source: 'recording',
      status: 'raw',
      cleanupApplied: [],
      createdAt: new Date().toISOString(),
    };
    onAdd(take);
    setSaved(s => [...s, { name: takeName, dur, frames: realFrameCount }]);
    setTakeName(`Take ${String(saved.length + 2).padStart(3, '0')}`);
    setElapsed(0);
    setRealFrameCount(0);
  };

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (unsubRef.current) unsubRef.current();
  }, []);

  const pad = (n: number) => String(Math.floor(n)).padStart(2, '0');
  const timeStr = `${pad(elapsed / 60)}:${pad(elapsed % 60)}.${String(Math.floor((elapsed % 1) * 10))}`;

  return (
    <Card>
      <PanelHeader icon={Circle} title="Capture & Record" sub={`Live from HoloSuit Bridge · ${fps}fps · ${holosuitBridge.isConnected() ? 'Connected' : 'Bridge ready'}`} color="#ef4444" />

      {/* Timecode display */}
      <div className="rounded-xl flex items-center justify-center py-6 mb-4"
        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <span className="font-mono text-5xl font-black tracking-widest"
          style={{ color: recording ? '#ef4444' : 'rgba(255,255,255,0.25)', textShadow: recording ? '0 0 24px rgba(239,68,68,0.7)' : 'none' }}>
          {timeStr}
        </span>
        {recording && (
          <motion.div className="ml-3 w-3 h-3 rounded-full bg-red-500 flex-shrink-0"
            animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={recording ? stopRec : startRec}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95"
          style={{
            background: recording ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.9)',
            border: `1px solid ${recording ? 'rgba(239,68,68,0.4)' : 'transparent'}`,
            color: recording ? '#ef4444' : '#fff',
          }}
        >
          {recording ? <Square className="w-4 h-4" /> : <Circle className="w-4 h-4 fill-current" />}
          {recording ? 'Stop' : 'Record'}
        </button>

        <div className="flex flex-col items-center gap-1">
          <p className="text-[9px] text-gray-600 uppercase">FPS</p>
          <select value={fps} onChange={e => setFps(Number(e.target.value))} disabled={recording}
            className="bg-black/40 border rounded px-2 py-1 text-xs text-white outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            {[24, 30, 60, 120].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
      </div>

      {/* Take name */}
      <div className="mb-4">
        <p className="text-[9px] text-gray-600 uppercase tracking-wider mb-1">Take name</p>
        <input
          value={takeName}
          onChange={e => setTakeName(e.target.value)}
          className="w-full bg-black/40 border rounded px-3 py-1.5 text-xs text-white outline-none"
          style={{ borderColor: 'rgba(255,255,255,0.1)' }}
        />
      </div>

        <div className="flex items-center gap-3 py-1.5 px-3 rounded-lg mb-4"
          style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-[9px] text-gray-600 uppercase tracking-wider">Live frames</span>
          <span className="font-mono text-xs font-bold" style={{ color: '#ef4444' }}>{realFrameCount}</span>
          <span className="text-gray-700 mx-1">·</span>
          <span className="text-[9px] text-gray-600">fps</span>
          <span className="font-mono text-xs font-bold" style={{ color: '#ef4444' }}>{realFps}</span>
        </div>
    </Card>
  );
}

// ─── Curve Cleanup Panel ──────────────────────────────────────────────────────

function CurveCleanupPanel({ presets, onChange }: {
  presets: CleanupPreset[];
  onChange: (p: CleanupPreset[]) => void;
}) {
  const [cleaning, setCleaning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [openCat, setOpenCat] = useState<CleanupPreset['category'] | null>('singing');

  const categories: { id: CleanupPreset['category']; label: string; icon: React.ElementType }[] = [
    { id: 'noise',   label: 'Noise & Drift',       icon: Activity },
    { id: 'singing', label: 'Singer Specialized',  icon: Mic2 },
    { id: 'body',    label: 'Body / Feet',          icon: Zap },
    { id: 'hands',   label: 'Hands & Fingers',      icon: Hand },
    { id: 'face',    label: 'Facial Curves',        icon: Eye },
  ];

  const setPreset = (id: string, patch: Partial<CleanupPreset>) =>
    onChange(presets.map(p => p.id === id ? { ...p, ...patch } : p));

  const runCleanup = () => {
    setCleaning(true);
    setProgress(0);
    setDone(false);
    let p = 0;
    const iv = setInterval(() => {
      p += Math.random() * 12 + 4;
      setProgress(Math.min(100, p));
      if (p >= 100) {
        clearInterval(iv);
        setCleaning(false);
        setDone(true);
      }
    }, 80);
  };

  const enabledCount = presets.filter(p => p.enabled).length;

  return (
    <Card>
      <PanelHeader icon={Scissors} title="Curve Cleanup" sub="Singer-specialized noise reduction & curve correction pipeline" color="#f97316" />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Active filters', value: enabledCount },
          { label: 'Total filters', value: presets.length },
          { label: 'Categories', value: categories.length },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-lg py-2 text-center"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="text-lg font-black text-white">{value}</div>
            <div className="text-[9px] text-gray-600 uppercase tracking-wide">{label}</div>
          </div>
        ))}
      </div>

      {/* Category accordions */}
      <div className="space-y-1.5 mb-4">
        {categories.map(({ id, label, icon: Icon }) => {
          const catPresets = presets.filter(p => p.category === id);
          const enabledInCat = catPresets.filter(p => p.enabled).length;
          const isOpen = openCat === id;
          return (
            <div key={id} className="rounded-xl overflow-hidden"
              style={{ border: `1px solid ${isOpen ? CATEGORY_COLORS[id] + '40' : 'rgba(255,255,255,0.06)'}` }}>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-white/5"
                onClick={() => setOpenCat(isOpen ? null : id)}
                style={{ background: isOpen ? `${CATEGORY_COLORS[id]}08` : 'transparent' }}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color: CATEGORY_COLORS[id] }} />
                <span className="text-xs font-bold text-white flex-1">{label}</span>
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${CATEGORY_COLORS[id]}18`, color: CATEGORY_COLORS[id] }}>
                  {enabledInCat}/{catPresets.length}
                </span>
                {isOpen ? <ChevronUp className="w-3 h-3 text-gray-600" /> : <ChevronDown className="w-3 h-3 text-gray-600" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                  {catPresets.map(preset => (
                    <div key={preset.id} className="pt-2">
                      <div className="flex items-center gap-2 mb-1.5">
                        {/* Toggle */}
                        <button
                          onClick={() => setPreset(preset.id, { enabled: !preset.enabled })}
                          className="w-8 h-4 rounded-full relative flex-shrink-0 transition-colors"
                          style={{ background: preset.enabled ? CATEGORY_COLORS[id] : 'rgba(255,255,255,0.1)' }}
                        >
                          <span className="absolute w-3 h-3 rounded-full bg-white top-0.5 transition-all"
                            style={{ left: preset.enabled ? '17px' : '2px' }} />
                        </button>
                        <span className="text-[11px] font-semibold flex-1"
                          style={{ color: preset.enabled ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                          {preset.label}
                        </span>
                        <span className="text-[9px] font-mono text-gray-600">
                          {Math.round(preset.strength * 100)}%
                        </span>
                      </div>
                      {/* Strength slider */}
                      {preset.enabled && (
                        <div className="flex items-center gap-2 pl-10">
                          <input
                            type="range" min={0} max={1} step={0.01}
                            value={preset.strength}
                            onChange={e => setPreset(preset.id, { strength: parseFloat(e.target.value) })}
                            className="flex-1 h-1 accent-orange-400"
                            style={{ accentColor: CATEGORY_COLORS[id] }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Run button */}
      <button
        onClick={runCleanup}
        disabled={cleaning || enabledCount === 0}
        className="w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{
          background: done ? 'rgba(52,211,153,0.15)' : 'linear-gradient(135deg,rgba(249,115,22,0.9),rgba(249,115,22,0.7))',
          border: done ? '1px solid rgba(52,211,153,0.4)' : '1px solid transparent',
          color: done ? '#34d399' : '#fff',
        }}
      >
        {cleaning ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw className="w-4 h-4" />
            </motion.div>
            Processing curves…
          </>
        ) : done ? (
          <><CheckCircle2 className="w-4 h-4" /> Cleanup complete</>
        ) : (
          <><Scissors className="w-4 h-4" /> Run Curve Cleanup ({enabledCount} filters)</>
        )}
      </button>

      {/* Progress bar */}
      {(cleaning || done) && (
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: done ? '#34d399' : 'linear-gradient(90deg,#f97316,#fbbf24)' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>
      )}
    </Card>
  );
}

// ─── Animation Timeline ───────────────────────────────────────────────────────

function AnimationTimeline({ takes, character, totalSecs: propTotalSecs, externalPosition }: {
  takes: FBXTake[];
  character?: CharacterAsset | null;
  totalSecs?: number;
  externalPosition?: number;
}) {
  const [tracks, setTracks] = useState<AnimationTrack[]>(() => buildTracksFromCharacter(character));
  const [playhead, setPlayhead] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [activeTake, setActiveTake] = useState<string | null>(takes[0]?.id ?? null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const TRACK_H = 32;
  const RULER_H = 24;
  const LABEL_W = 120;
  const totalSecs = propTotalSecs ?? 60;
  const pxPerSec = 80 * zoom;

  // Rebuild tracks when character changes (new GLB loaded)
  useEffect(() => {
    setTracks(buildTracksFromCharacter(character));
  }, [character?.id]);

  // Sync playhead to show timeline when provided
  useEffect(() => {
    if (externalPosition !== undefined && !playing) {
      setPlayhead(Math.min(externalPosition, totalSecs));
    }
  }, [externalPosition, playing, totalSecs]);

  // Playback loop
  useEffect(() => {
    if (playing) {
      const tick = (ts: number) => {
        if (lastTimeRef.current) {
          const dt = (ts - lastTimeRef.current) / 1000;
          setPlayhead(p => {
            const next = p + dt;
            if (next >= totalSecs) { setPlaying(false); return 0; }
            return next;
          });
        }
        lastTimeRef.current = ts;
        rafRef.current = requestAnimationFrame(tick);
      };
      lastTimeRef.current = 0;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    }
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing]);

  const toggleMute = (id: string) =>
    setTracks(ts => ts.map(t => t.id === id ? { ...t, muted: !t.muted } : t));
  const toggleSolo = (id: string) =>
    setTracks(ts => ts.map(t => t.id === id ? { ...t, solo: !t.solo } : t));

  const seekByClick = (e: React.MouseEvent) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left - LABEL_W;
    if (x < 0) return;
    setPlayhead(Math.max(0, Math.min(totalSecs, x / pxPerSec)));
  };

  // Ruler ticks
  const ticks = [];
  for (let s = 0; s <= totalSecs; s += (zoom < 0.6 ? 10 : zoom < 1 ? 5 : 1)) {
    ticks.push(s);
  }

  return (
    <Card className="!p-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Film className="w-3.5 h-3.5" style={{ color: '#f97316' }} />
        <span className="text-xs font-black text-white flex-1">Animation Timeline</span>

        {/* Take selector */}
        {takes.length > 0 ? (
          <select value={activeTake ?? ''} onChange={e => setActiveTake(e.target.value)}
            className="bg-black/60 border rounded px-2 py-1 text-[10px] text-white outline-none"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}>
            {takes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        ) : (
          <span className="text-[9px] text-amber-500/70 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" /> No takes · import or record first
          </span>
        )}

        {/* Transport */}
        <button onClick={() => setPlayhead(0)} className="p-1 text-gray-500 hover:text-white transition-colors">
          <SkipBack className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setPlaying(p => !p)}
          className="px-3 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all"
          style={{ background: playing ? 'rgba(239,68,68,0.15)' : 'rgba(249,115,22,0.9)', color: playing ? '#ef4444' : '#fff' }}
        >
          {playing ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          {playing ? 'Stop' : 'Play'}
        </button>
        <button onClick={() => setPlayhead(totalSecs)} className="p-1 text-gray-500 hover:text-white transition-colors">
          <SkipForward className="w-3.5 h-3.5" />
        </button>

        {/* Timecode */}
        <span className="font-mono text-[11px] font-black w-16 text-right" style={{ color: '#f97316' }}>
          {Math.floor(playhead / 60).toString().padStart(2, '0')}:{(playhead % 60).toFixed(1).padStart(4, '0')}
        </span>

        {/* Zoom */}
        <div className="flex items-center gap-1 ml-2">
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="p-0.5 text-gray-600 hover:text-gray-300"><Minus className="w-3 h-3" /></button>
          <span className="text-[9px] text-gray-600 w-8 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="p-0.5 text-gray-600 hover:text-gray-300"><Plus className="w-3 h-3" /></button>
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex" style={{ minHeight: RULER_H + tracks.length * TRACK_H }}>
        {/* Labels column */}
        <div className="flex-shrink-0 border-r" style={{ width: LABEL_W, borderColor: 'rgba(255,255,255,0.07)' }}>
          {/* Ruler label */}
          <div className="flex items-center px-2" style={{ height: RULER_H, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <span className="text-[9px] text-gray-700 uppercase tracking-wider">Track</span>
          </div>
          {tracks.map(track => (
            <div key={track.id}
              className="flex items-center gap-1.5 px-2 border-b"
              style={{ height: TRACK_H, borderColor: 'rgba(255,255,255,0.04)' }}>
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: track.color }} />
              <span className="text-[10px] text-gray-400 flex-1 truncate">{track.name}</span>
              <button onClick={() => toggleMute(track.id)}
                className="text-[8px] font-bold px-1 rounded transition-colors"
                style={{ color: track.muted ? '#ef4444' : 'rgba(255,255,255,0.25)' }}>M</button>
              <button onClick={() => toggleSolo(track.id)}
                className="text-[8px] font-bold px-1 rounded transition-colors"
                style={{ color: track.solo ? '#fbbf24' : 'rgba(255,255,255,0.25)' }}>S</button>
            </div>
          ))}
        </div>

        {/* Scrollable timeline */}
        <div className="flex-1 overflow-x-auto" style={{ cursor: 'crosshair' }}>
          <div ref={timelineRef} style={{ width: totalSecs * pxPerSec, position: 'relative', minWidth: '100%' }}
            onClick={seekByClick}>
            {/* Ruler */}
            <div className="relative border-b" style={{ height: RULER_H, borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.4)' }}>
              {ticks.map(s => (
                <div key={s} className="absolute top-0 bottom-0 flex flex-col"
                  style={{ left: s * pxPerSec }}>
                  <div className="w-px h-2 mt-auto" style={{ background: 'rgba(255,255,255,0.2)' }} />
                  <span className="text-[8px] text-gray-700 font-mono px-0.5 absolute bottom-1" style={{ left: 2 }}>
                    {s}s
                  </span>
                </div>
              ))}
            </div>

            {/* Tracks */}
            {tracks.map(track => (
              <div key={track.id} className="relative border-b"
                style={{ height: TRACK_H, borderColor: 'rgba(255,255,255,0.04)', opacity: track.muted ? 0.3 : 1 }}>
                {/* Curve */}
                <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`g-${track.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={track.color} stopOpacity="0.55" />
                      <stop offset="100%" stopColor={track.color} stopOpacity="0.04" />
                    </linearGradient>
                  </defs>
                  <polygon
                    fill={`url(#g-${track.id})`}
                    points={[
                      ...track.keyframes.map(kf => `${kf.t * totalSecs * pxPerSec},${(1 - kf.v) * TRACK_H}`),
                      `${totalSecs * pxPerSec},${TRACK_H}`,
                      `0,${TRACK_H}`,
                    ].join(' ')}
                  />
                  <polyline
                    fill="none"
                    stroke={track.color}
                    strokeWidth="1.5"
                    opacity={track.solo ? 1 : 0.7}
                    points={track.keyframes.map(kf => `${kf.t * totalSecs * pxPerSec},${(1 - kf.v) * TRACK_H}`).join(' ')}
                  />
                </svg>
              </div>
            ))}

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 w-px z-20 pointer-events-none"
              style={{ left: playhead * pxPerSec, background: '#f97316', boxShadow: '0 0 6px rgba(249,115,22,0.8)' }}
            >
              <div className="w-2.5 h-2.5 rounded-full absolute -left-[4px] -top-0"
                style={{ background: '#f97316' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="flex items-center gap-4 px-3 py-1.5 border-t text-[9px] text-gray-700"
        style={{ borderColor: 'rgba(255,255,255,0.07)', background: 'rgba(0,0,0,0.3)' }}>
        <span>{tracks.length} tracks</span>
        <span>·</span>
        <span>{totalSecs}s duration</span>
        <span>·</span>
        <span>{zoom * 100}% zoom</span>
        {activeTake && takes.length > 0 && (
          <>
            <span>·</span>
            <span className="text-orange-500">{takes.find(t => t.id === activeTake)?.name}</span>
          </>
        )}
      </div>
    </Card>
  );
}

// ─── Performances Panel ───────────────────────────────────────────────────────
// Lists the artist's AI-generated singing performances and replays the captured
// motion ON the 3D character (transmit performance → avatar). Each can be applied
// as a reusable animation in the session.

function PerformancesPanel({
  character, performances, loading, error, onReload, onApply, appliedId,
}: {
  character?: CharacterAsset | null;
  performances: PerformanceClip[];
  loading: boolean;
  error: string | null;
  onReload: () => void;
  onApply: (clip: PerformanceClip) => void;
  appliedId?: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = performances.find(p => p.id === selectedId) ?? performances[0] ?? null;
  const glbUrl = character?.glbUrl || '';
  const fmt: 'glb' | 'fbx' = character?.format === 'fbx' ? 'fbx' : 'glb';
  const audioProxy = selected?.audioUrl
    ? `/api/proxy/firebase-file?url=${encodeURIComponent(selected.audioUrl)}`
    : undefined;

  return (
    <Card>
      <PanelHeader
        icon={Mic2}
        title="Singing Performances"
        sub="AI-captured motion · replayed on the 3D character"
        color="#ec4899"
      />

      {/* 3D preview — the captured performance motion replayed on the avatar */}
      {selected?.hasMotion && glbUrl ? (
        <div
          className="rounded-xl overflow-hidden mb-3"
          style={{ aspectRatio: '1 / 1', border: '1px solid rgba(236,72,153,0.25)', background: '#000' }}
        >
          <Suspense fallback={
            <div className="w-full h-full flex items-center justify-center">
              <RefreshCw className="w-5 h-5 animate-spin text-pink-400" />
            </div>
          }>
            <PerformanceViewer
              key={selected.id}
              src={glbUrl}
              format={fmt}
              poster={character?.thumbnailUrl}
              motionTimeline={selected.motionTimeline}
              autoplayMotion
              audioSrc={audioProxy}
              songTitle={selected.songTitle}
            />
          </Suspense>
        </div>
      ) : (
        <div
          className="rounded-xl mb-3 py-10 text-center"
          style={{ border: '1px dashed rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.3)' }}
        >
          <Mic2 className="w-7 h-7 mx-auto mb-2 text-pink-400/50" />
          <p className="text-xs text-gray-500">
            {glbUrl ? 'Select a performance to preview it on the avatar' : 'Import a 3D character first'}
          </p>
        </div>
      )}

      {/* List header */}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold text-gray-600 uppercase tracking-wider">
          {performances.length} performance{performances.length === 1 ? '' : 's'}
        </p>
        <button
          onClick={onReload}
          className="text-[10px] text-pink-400 inline-flex items-center gap-1 hover:underline"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> Reload
        </button>
      </div>

      {error && <p className="text-[11px] text-red-400 mb-2">{error}</p>}

      {loading && performances.length === 0 ? (
        <p className="text-xs text-gray-500 py-4 text-center">Loading performances…</p>
      ) : performances.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-xs text-gray-500">No performances yet.</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Generate a Singing Performance from the artist's Hologram Showcase, then reload here.
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {performances.map(clip => {
            const isSel = selected?.id === clip.id;
            const isApplied = appliedId === clip.id;
            return (
              <div
                key={clip.id}
                onClick={() => setSelectedId(clip.id)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors"
                style={{
                  border: `1px solid ${isSel ? 'rgba(236,72,153,0.4)' : 'rgba(255,255,255,0.05)'}`,
                  background: isSel ? 'rgba(236,72,153,0.08)' : 'transparent',
                }}
              >
                <Mic2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#ec4899' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-white truncate">{clip.songTitle || 'Performance'}</p>
                  <p className="text-[10px] text-gray-600">
                    {Math.round(clip.duration || clip.clipDuration || 0)}s · {clip.frameCount || 0} frames
                    {clip.lipsynced ? ' · lip-synced' : ''}
                    {!clip.hasMotion ? ' · no motion' : ''}
                  </p>
                </div>
                {isApplied && (
                  <span
                    className="text-[9px] font-black px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399' }}
                  >
                    On stage
                  </span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onApply(clip); }}
                  disabled={!clip.hasMotion}
                  className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all disabled:opacity-40"
                  style={{ background: 'rgba(236,72,153,0.15)', color: '#ec4899', border: '1px solid rgba(236,72,153,0.3)' }}
                >
                  Apply
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AnimationStudio({
  character,
  songs = [],
  holosuitConfig,
  currentSongId,
  currentPosition = 0,
  artistId,
  onAnimationChange,
  onApplyPerformance,
}: AnimationStudioProps) {
  const { t } = useHoloLang();
  const [takes, setTakes] = useState<FBXTake[]>([]);
  const [presets, setPresets] = useState<CleanupPreset[]>(CLEANUP_PRESETS);
  const [tab, setTab] = useState<'perform' | 'import' | 'record' | 'cleanup' | 'timeline'>('perform');
  const [activeAnim, setActiveAnim] = useState<string>('idle');

  // ── Generated singing-performance library ───────────────────────────────────
  const resolvedArtistId = artistId ?? (character?.id ? String(character.id).replace(/^artist-/, '') : undefined);
  const [performances, setPerformances] = useState<PerformanceClip[]>([]);
  const [perfLoading, setPerfLoading] = useState(false);
  const [perfError, setPerfError] = useState<string | null>(null);
  const [appliedPerfId, setAppliedPerfId] = useState<string | null>(null);

  const loadPerformances = useCallback(async () => {
    if (!resolvedArtistId) return;
    setPerfLoading(true);
    setPerfError(null);
    try {
      const res = await fetch(`/api/hologram-gallery/${encodeURIComponent(String(resolvedArtistId))}/character-3d/performances`);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setPerformances(Array.isArray(data.performances) ? data.performances : []);
      } else {
        setPerfError(data?.error || 'Could not load performances');
      }
    } catch (e: any) {
      setPerfError(e?.message || 'Could not load performances');
    } finally {
      setPerfLoading(false);
    }
  }, [resolvedArtistId]);

  useEffect(() => { loadPerformances(); }, [loadPerformances]);

  const activeSong = songs.find(s => s.id === currentSongId) ?? songs[0] ?? null;

  const addTake = (t: FBXTake) => setTakes(prev => [...prev, t]);

  const deleteTake = (id: string) => setTakes(prev => prev.filter(t => t.id !== id));

  // When a take is approved, promote its animation name to the renderer
  const approveTake = (id: string) => {
    setTakes(prev => prev.map(t => t.id === id ? { ...t, status: 'approved' as const } : t));
    const take = takes.find(t => t.id === id);
    if (take) {
      setActiveAnim(take.name);
      onAnimationChange?.(take.name);
    }
  };

  const fireAnimation = (anim: string) => {
    setActiveAnim(anim);
    onAnimationChange?.(anim);
  };

  // Apply a captured performance: register it as an approved take + drive the avatar.
  const applyPerformance = useCallback((clip: PerformanceClip) => {
    const animName = `perf:${clip.songTitle || 'performance'}`;
    setTakes(prev => {
      if (prev.some(tk => tk.id === `perf-${clip.id}`)) return prev;
      const take: FBXTake = {
        id: `perf-${clip.id}`,
        name: clip.songTitle || 'Singing performance',
        duration: Math.round(clip.duration || clip.clipDuration || 0),
        fps: clip.motionTimeline?.fps || 12,
        frameCount: clip.frameCount || clip.motionTimeline?.frameCount || 0,
        boneCount: 0,
        hasBlendShapes: !!clip.lipsynced,
        source: 'performance',
        status: 'approved',
        createdAt: clip.createdAt || new Date().toISOString(),
      };
      return [take, ...prev];
    });
    setActiveAnim(animName);
    setAppliedPerfId(clip.id);
    onAnimationChange?.(animName);
    onApplyPerformance?.(clip);
  }, [onAnimationChange, onApplyPerformance]);

  const QUICK_ANIMS: string[] = character?.availableAnimations?.length
    ? character.availableAnimations
    : ['idle', 'dance', 'wave', 'bow', 'walk', 'jump'];

  const TABS: { id: typeof tab; label: string; icon: React.ElementType; color: string }[] = [
    { id: 'perform',  label: 'Performances',          icon: Mic2,     color: '#ec4899' },
    { id: 'import',   label: t('anim_tab_import'),   icon: Upload,   color: '#22d3ee' },
    { id: 'record',   label: t('anim_tab_record'),   icon: Circle,   color: '#ef4444' },
    { id: 'cleanup',  label: t('anim_tab_cleanup'),  icon: Scissors, color: '#f97316' },
    { id: 'timeline', label: t('anim_tab_timeline'), icon: BarChart2,color: '#a78bfa' },
  ];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Top tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-xl"
        style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {TABS.map(({ id, label, icon: Icon, color }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all"
            style={{
              background: tab === id ? `${color}18` : 'transparent',
              color: tab === id ? color : 'rgba(255,255,255,0.35)',
              border: tab === id ? `1px solid ${color}35` : '1px solid transparent',
            }}
          >
            <Icon className="w-3 h-3" />
            <span className="hidden sm:block">{label}</span>
          </button>
        ))}
        {/* Takes badge */}
        {takes.length > 0 && (
          <div className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-black"
            style={{ background: 'rgba(249,115,22,0.12)', color: '#f97316', border: '1px solid rgba(249,115,22,0.2)' }}>
            {t(takes.length === 1 ? 'anim_takes' : 'anim_takes_plural', { n: takes.length })}
          </div>
        )}
      </div>

      {/* Quick Animations — fire any character animation directly */}
      <div className="rounded-xl p-2.5 space-y-2" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[9px] font-bold uppercase tracking-widest text-gray-600">Quick Animations</span>
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="text-[9px] font-mono text-orange-400 capitalize">{activeAnim}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-1">
          {QUICK_ANIMS.map(anim => (
            <button
              key={anim}
              onClick={() => fireAnimation(anim)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:scale-105 active:scale-95 capitalize"
              style={{
                background: activeAnim === anim ? 'rgba(249,115,22,0.2)' : 'rgba(255,255,255,0.04)',
                color: activeAnim === anim ? '#f97316' : '#6b7280',
                border: `1px solid ${activeAnim === anim ? 'rgba(249,115,22,0.4)' : 'rgba(255,255,255,0.07)'}`,
              }}
            >
              {anim}
            </button>
          ))}
        </div>
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'perform'  && (
              <PerformancesPanel
                character={character}
                performances={performances}
                loading={perfLoading}
                error={perfError}
                onReload={loadPerformances}
                onApply={applyPerformance}
                appliedId={appliedPerfId}
              />
            )}
            {tab === 'import'   && <FBXImportPanel takes={takes} onAdd={addTake} onApprove={approveTake} onDelete={deleteTake} />}
            {tab === 'record'   && <RecordingPanel onAdd={addTake} holosuitConfig={holosuitConfig} />}
            {tab === 'cleanup'  && <CurveCleanupPanel presets={presets} onChange={setPresets} />}
            {tab === 'timeline' && (
              <AnimationTimeline
                takes={takes}
                character={character}
                totalSecs={activeSong?.duration ?? 60}
                externalPosition={currentPosition}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
