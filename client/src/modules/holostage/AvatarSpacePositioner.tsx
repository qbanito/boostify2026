// ─── AvatarSpacePositioner ────────────────────────────────────────────────────
// Elegant 3D VR environment for avatar stage positioning.
// Orbit camera · Floor grid · T-pose reference · Axis gizmos · Floor snap · Fullscreen

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Maximize2, Minimize2, RotateCcw, Grid3X3, User, ArrowDownToLine, Scan,
} from 'lucide-react';
import { useHoloLang } from './holoLangContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AvatarSpaceTransform {
  x: number;     // world X (meters, +right)
  y: number;     // world Y (meters, +up, 0 = floor)
  z: number;     // world Z (meters, +forward)
  rotY: number;  // Y-axis rotation (degrees)
  scale: number; // uniform scale (0.5–2.0)
}

interface CamState {
  azimuth: number;   // horizontal orbit angle (radians)
  elevation: number; // vertical orbit angle (radians)
  distance: number;  // distance from target (meters)
  panX: number;      // target world X
  panZ: number;      // target world Z
}

export interface AvatarSpacePositionerProps {
  transform?: AvatarSpaceTransform;
  onChange?: (t: AvatarSpaceTransform) => void;
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEF_TRANSFORM: AvatarSpaceTransform = { x: 0, y: 0, z: 0, rotY: 0, scale: 1 };
const DEF_CAM: CamState = { azimuth: 0.45, elevation: 0.52, distance: 4.8, panX: 0, panZ: 0 };

// ─── T-Pose Skeleton (model space, meters, origin at foot center) ─────────────

type V3 = [number, number, number];

const J: Record<string, V3> = {
  HEEL_L:  [-0.10,  0.02, -0.06], HEEL_R:  [ 0.10,  0.02, -0.06],
  TOE_L:   [-0.10,  0.01,  0.14], TOE_R:   [ 0.10,  0.01,  0.14],
  ANKLE_L: [-0.10,  0.08,  0.00], ANKLE_R: [ 0.10,  0.08,  0.00],
  KNEE_L:  [-0.10,  0.50,  0.00], KNEE_R:  [ 0.10,  0.50,  0.00],
  HIP_L:   [-0.10,  0.94,  0.00], HIP_R:   [ 0.10,  0.94,  0.00],
  PELVIS:  [ 0.00,  0.94,  0.00],
  SPN_A:   [ 0.00,  1.08,  0.00], SPN_B:   [ 0.00,  1.24,  0.00],
  CHEST:   [ 0.00,  1.40,  0.00],
  NECK:    [ 0.00,  1.52,  0.00],
  HEAD_C:  [ 0.00,  1.66,  0.00], // drawn as circle
  SHL_L:   [-0.18,  1.40,  0.00], SHL_R:   [ 0.18,  1.40,  0.00],
  ELB_L:   [-0.44,  1.40,  0.00], ELB_R:   [ 0.44,  1.40,  0.00],
  WST_L:   [-0.70,  1.40,  0.00], WST_R:   [ 0.70,  1.40,  0.00],
};

type BoneGroup = 'spine' | 'arm' | 'leg';

const BONES: Array<[string, string, BoneGroup]> = [
  ['HEEL_L', 'ANKLE_L', 'leg'], ['TOE_L',  'ANKLE_L', 'leg'],
  ['HEEL_R', 'ANKLE_R', 'leg'], ['TOE_R',  'ANKLE_R', 'leg'],
  ['ANKLE_L', 'KNEE_L', 'leg'], ['KNEE_L', 'HIP_L',   'leg'],
  ['ANKLE_R', 'KNEE_R', 'leg'], ['KNEE_R', 'HIP_R',   'leg'],
  ['HIP_L',  'PELVIS', 'spine'], ['HIP_R', 'PELVIS', 'spine'],
  ['PELVIS', 'SPN_A',  'spine'], ['SPN_A', 'SPN_B',  'spine'],
  ['SPN_B',  'CHEST',  'spine'], ['CHEST', 'NECK',   'spine'],
  ['NECK',   'HEAD_C', 'spine'],
  ['CHEST', 'SHL_L', 'arm'], ['SHL_L', 'ELB_L', 'arm'], ['ELB_L', 'WST_L', 'arm'],
  ['CHEST', 'SHL_R', 'arm'], ['SHL_R', 'ELB_R', 'arm'], ['ELB_R', 'WST_R', 'arm'],
];

const BONE_COLOR: Record<BoneGroup, string> = {
  spine: '#94a3b8',
  arm:   '#38bdf8',
  leg:   '#818cf8',
};

// ─── 3-D Projection ───────────────────────────────────────────────────────────

function proj(p: V3, cam: CamState, W: number, H: number): [number, number, number] {
  const dx = p[0] - cam.panX, dy = p[1], dz = p[2] - cam.panZ;
  const cosA = Math.cos(cam.azimuth),  sinA = Math.sin(cam.azimuth);
  const cosE = Math.cos(cam.elevation), sinE = Math.sin(cam.elevation);
  const rx   = dx * cosA - dz * sinA;
  const rz0  = dx * sinA + dz * cosA;
  const ry   = dy * cosE - rz0 * sinE;
  const rz   = dy * sinE + rz0 * cosE;
  const depth = cam.distance - rz;
  if (depth <= 0.05) return [W * 0.5, H * 0.5, -1];
  const f = Math.min(W, H) * 0.5 / Math.tan(27 * Math.PI / 180);
  return [W * 0.5 + (rx / depth) * f, H * 0.5 - (ry / depth) * f, depth];
}

function tformJoint(j: V3, t: AvatarSpaceTransform): V3 {
  const [mx, my, mz] = j;
  const sx = mx * t.scale, sy = my * t.scale, sz = mz * t.scale;
  const r = t.rotY * (Math.PI / 180);
  const c = Math.cos(r), s = Math.sin(r);
  return [sx * c - sz * s + t.x, sy + t.y, sx * s + sz * c + t.z];
}

// ─── Scene Renderer ───────────────────────────────────────────────────────────

const GRID_HALF = 3.5;
const GRID_STEP = 0.5;
const STAGE_R   = 1.5;

function drawScene(
  canvas: HTMLCanvasElement,
  cam: CamState,
  tf: AvatarSpaceTransform,
  showGrid: boolean,
  showTPose: boolean,
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;

  // ── Background ──
  ctx.clearRect(0, 0, W, H);
  const bg = ctx.createRadialGradient(W * 0.5, H * 0.6, 0, W * 0.5, H * 0.55, Math.max(W, H) * 0.75);
  bg.addColorStop(0, '#10101a');
  bg.addColorStop(1, '#050508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle center glow (Boostify brand)
  const glow = ctx.createRadialGradient(W * 0.5, H * 0.65, 0, W * 0.5, H * 0.65, W * 0.42);
  glow.addColorStop(0, 'rgba(249,115,22,0.04)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Floor Grid ──
  if (showGrid) {
    ctx.save();
    const steps = Math.round((GRID_HALF * 2) / GRID_STEP);
    for (let i = 0; i <= steps; i++) {
      const v = -GRID_HALF + i * GRID_STEP;
      const normT = Math.abs(v) / GRID_HALF;
      const fade = Math.max(0.02, 1 - normT * normT);
      const isMain = Math.abs(v) < 0.001;
      const isMeter = Math.abs(v % 1) < 0.001 && !isMain;
      const alpha = isMain ? 0.55 : isMeter ? fade * 0.20 : fade * 0.08;
      const color = isMain
        ? `rgba(249,115,22,${alpha})`
        : `rgba(160,180,220,${alpha})`;
      ctx.strokeStyle = color;
      ctx.lineWidth = isMain ? 1.1 : 0.6;

      const a = proj([v, 0, -GRID_HALF], cam, W, H);
      const b = proj([v, 0,  GRID_HALF], cam, W, H);
      if (a[2] > 0 && b[2] > 0) {
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
      }
      const c2 = proj([-GRID_HALF, 0, v], cam, W, H);
      const d2 = proj([ GRID_HALF, 0, v], cam, W, H);
      if (c2[2] > 0 && d2[2] > 0) {
        ctx.beginPath(); ctx.moveTo(c2[0], c2[1]); ctx.lineTo(d2[0], d2[1]); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // ── Stage Circle (dashed performance area) ──
  {
    const segs = 64;
    ctx.save();
    ctx.strokeStyle = 'rgba(249,115,22,0.20)';
    ctx.lineWidth = 1.1;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    let first = true;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const sp = proj([Math.cos(a) * STAGE_R, 0, Math.sin(a) * STAGE_R], cam, W, H);
      if (sp[2] <= 0) { first = true; continue; }
      first ? ctx.moveTo(sp[0], sp[1]) : ctx.lineTo(sp[0], sp[1]);
      first = false;
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── Origin Cross ──
  {
    const o = proj([0, 0.002, 0], cam, W, H);
    if (o[2] > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(249,115,22,0.55)';
      ctx.lineWidth = 1.2;
      const s = 7;
      ctx.beginPath();
      ctx.moveTo(o[0] - s, o[1]); ctx.lineTo(o[0] + s, o[1]);
      ctx.moveTo(o[0], o[1] - s); ctx.lineTo(o[0], o[1] + s);
      ctx.stroke();
      ctx.restore();
    }
  }

  // ── Avatar Floor Glow ──
  {
    const fp = proj([tf.x, 0.002, tf.z], cam, W, H);
    if (fp[2] > 0) {
      const g = ctx.createRadialGradient(fp[0], fp[1], 0, fp[0], fp[1], 40 * tf.scale);
      g.addColorStop(0, 'rgba(249,115,22,0.14)');
      g.addColorStop(1, 'transparent');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(fp[0], fp[1], 36 * tf.scale, 11, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ── T-Pose Avatar ──
  if (showTPose) {
    const sp: Record<string, [number, number, number]> = {};
    for (const [name, jv] of Object.entries(J)) {
      sp[name] = proj(tformJoint(jv, tf), cam, W, H);
    }

    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';

    // Bones
    for (const [from, to, grp] of BONES) {
      const a = sp[from], b = sp[to];
      if (!a || !b || a[2] <= 0 || b[2] <= 0) continue;
      const avgDepth = (a[2] + b[2]) * 0.5;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]);
      ctx.strokeStyle = BONE_COLOR[grp];
      ctx.lineWidth = Math.max(1, 4 / (avgDepth * 0.28));
      ctx.globalAlpha = 0.88;
      ctx.stroke();
    }

    // Joint dots
    ctx.globalAlpha = 1;
    for (const [name, sj] of Object.entries(sp)) {
      if (name === 'HEAD_C' || sj[2] <= 0) continue;
      const r = Math.max(1.5, 4 / (sj[2] * 0.28));
      ctx.beginPath(); ctx.arc(sj[0], sj[1], r, 0, Math.PI * 2);
      ctx.fillStyle = '#e2e8f0'; ctx.fill();
    }

    // Head circle
    const hc = sp['HEAD_C'];
    if (hc && hc[2] > 0) {
      const r = Math.max(6, (15 * tf.scale) / (hc[2] * 0.26));
      ctx.beginPath(); ctx.arc(hc[0], hc[1], r, 0, Math.PI * 2);
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = 1.8; ctx.globalAlpha = 0.9; ctx.stroke();
      ctx.fillStyle = 'rgba(249,115,22,0.07)'; ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ── Avatar XYZ Position Gizmo ──
  {
    const root = proj([tf.x, tf.y, tf.z], cam, W, H);
    if (root[2] > 0) {
      const len = 0.44 * tf.scale;
      const axes: Array<[V3, string, string]> = [
        [[tf.x + len, tf.y, tf.z],       '#ef4444', 'X'],
        [[tf.x,       tf.y + len, tf.z], '#22c55e', 'Y'],
        [[tf.x,       tf.y, tf.z + len], '#60a5fa', 'Z'],
      ];
      ctx.save(); ctx.lineCap = 'round';
      for (const [end3, color, label] of axes) {
        const ep = proj(end3, cam, W, H);
        if (ep[2] <= 0) continue;
        ctx.beginPath(); ctx.moveTo(root[0], root[1]); ctx.lineTo(ep[0], ep[1]);
        ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(ep[0], ep[1], 3.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.font = 'bold 9px "SF Mono",ui-monospace,monospace';
        ctx.fillStyle = color;
        ctx.fillText(label, ep[0] + 4, ep[1] - 3);
      }
      // Root dot
      ctx.beginPath(); ctx.arc(root[0], root[1], 4.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249,115,22,0.75)'; ctx.fill();
      ctx.restore();
    }
  }

  // ── Corner Orientation Gizmo (bottom-right) ──
  {
    const cx = W - 42, cy = H - 42, L = 22;
    ctx.save();
    // Background disc
    ctx.beginPath(); ctx.arc(cx, cy, L + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(5,5,10,0.72)'; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.1)'; ctx.lineWidth = 0.5; ctx.stroke();

    const origin = proj([0, 0, 0], cam, W, H);
    const axesDef: Array<[V3, string, string]> = [
      [[0.6, 0, 0], '#ef4444', 'X'],
      [[0, 0.6, 0], '#22c55e', 'Y'],
      [[0, 0, 0.6], '#60a5fa', 'Z'],
    ];
    const projected = axesDef.map(([dir, color, label]) => {
      const sp2 = proj(dir, cam, W, H);
      const ddx = sp2[0] - origin[0], ddy = sp2[1] - origin[1];
      const mag = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
      return { ex: cx + (ddx / mag) * L, ey: cy + (ddy / mag) * L, color, label, depth: sp2[2] };
    });
    projected.sort((a, b) => b.depth - a.depth); // farthest first

    ctx.lineCap = 'round';
    for (const { ex, ey, color, label, depth } of projected) {
      const opacity = depth > 0 ? 1 : 0.4;
      ctx.globalAlpha = opacity;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.stroke();
      ctx.beginPath(); ctx.arc(ex, ey, 3, 0, Math.PI * 2);
      ctx.fillStyle = color; ctx.fill();
      const dx = ex - cx, dy = ey - cy, d = Math.sqrt(dx * dx + dy * dy) || 1;
      ctx.font = 'bold 7px "SF Mono",ui-monospace,monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, ex + (dx / d) * 5, ey + (dy / d) * 5 + 2);
    }
    ctx.globalAlpha = 1;
    // Center dot
    ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e2e8f0'; ctx.fill();
    ctx.restore();
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AxisSlider({ label, color, value, min, max, step, unit = '', onChange }: {
  label: string; color: string; value: number;
  min: number; max: number; step: number; unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-black w-3 shrink-0" style={{ color }}>{label}</span>
        <input
          type="range" min={min} max={max} step={step} value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1"
          style={{ accentColor: color }}
        />
        <input
          type="number"
          value={step < 0.1 ? value.toFixed(2) : value.toFixed(0)}
          step={step}
          onChange={e => {
            const v = parseFloat(e.target.value);
            if (!isNaN(v)) onChange(Math.max(min, Math.min(max, v)));
          }}
          className="text-xs font-mono text-right bg-transparent border-b outline-none"
          style={{ width: 46, color: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.10)' }}
        />
        <span className="text-xs shrink-0 w-4" style={{ color: 'rgba(255,255,255,0.28)' }}>{unit}</span>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p
        className="mb-2 tracking-widest uppercase"
        style={{ fontSize: 9, fontWeight: 800, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em' }}
      >
        {label}
      </p>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AvatarSpacePositioner({ transform: extTf, onChange }: AvatarSpacePositionerProps) {
  const { t } = useHoloLang();

  const [tf, setTfState]      = useState<AvatarSpaceTransform>(extTf ?? DEF_TRANSFORM);
  const [cam, setCam]         = useState<CamState>(DEF_CAM);
  const [showGrid, setShowGrid]   = useState(true);
  const [showTPose, setShowTPose] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const wrapperRef  = useRef<HTMLDivElement>(null);

  // Live refs to avoid stale closures in rAF
  const camRef    = useRef(cam);
  const tfRef     = useRef(tf);
  const gridRef   = useRef(showGrid);
  const tposeRef  = useRef(showTPose);
  const dragRef   = useRef<{ type: 'orbit' | 'pan'; sx: number; sy: number; startCam: CamState } | null>(null);

  camRef.current   = cam;
  tfRef.current    = tf;
  gridRef.current  = showGrid;
  tposeRef.current = showTPose;

  useEffect(() => { if (extTf) setTfState(extTf); }, [extTf]);

  const setTf = useCallback((v: AvatarSpaceTransform) => {
    setTfState(v);
    onChange?.(v);
  }, [onChange]);

  const render = useCallback(() => {
    const c = canvasRef.current;
    if (c) drawScene(c, camRef.current, tfRef.current, gridRef.current, tposeRef.current);
  }, []);

  // Fit canvas to container via ResizeObserver
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      const c = canvasRef.current;
      if (!c) return;
      const r = el.getBoundingClientRect();
      c.width  = Math.floor(r.width)  || 400;
      c.height = Math.floor(r.height) || 500;
      render();
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [render]);

  useEffect(() => { render(); }, [cam, tf, showGrid, showTPose, render]);

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, []);

  // ── Mouse Handlers ──────────────────────────────────────────────────────────

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = {
      type: e.button === 2 ? 'pan' : 'orbit',
      sx: e.clientX, sy: e.clientY,
      startCam: { ...camRef.current },
    };
    setIsDragging(true);
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const dx = e.clientX - drag.sx;
    const dy = e.clientY - drag.sy;
    if (drag.type === 'orbit') {
      setCam(c => ({
        ...c,
        azimuth:   drag.startCam.azimuth   + dx * 0.007,
        elevation: Math.max(0.05, Math.min(1.45, drag.startCam.elevation + dy * 0.006)),
      }));
    } else {
      const cos = Math.cos(drag.startCam.azimuth);
      const sin = Math.sin(drag.startCam.azimuth);
      const s   = drag.startCam.distance * 0.0018;
      setCam(c => ({
        ...c,
        panX: drag.startCam.panX - (dx * cos - dy * sin) * s,
        panZ: drag.startCam.panZ - (dx * sin + dy * cos) * s,
      }));
    }
  }, []);

  const onMouseUp    = useCallback(() => { dragRef.current = null; setIsDragging(false); }, []);
  const onDblClick   = useCallback(() => setCam(DEF_CAM), []);
  const onContextMenu = useCallback((e: React.MouseEvent) => e.preventDefault(), []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setCam(c => ({ ...c, distance: Math.max(0.6, Math.min(16, c.distance * (1 + e.deltaY * 0.001))) }));
  }, []);

  // ── Actions ─────────────────────────────────────────────────────────────────

  const snapToFloor = useCallback(() => setTf({ ...tfRef.current, y: 0 }), [setTf]);
  const resetAll    = useCallback(() => { setTf({ ...DEF_TRANSFORM }); setCam(DEF_CAM); }, [setTf]);
  const upd = (k: keyof AvatarSpaceTransform) => (v: number) => setTf({ ...tfRef.current, [k]: v });

  const toggleFullscreen = useCallback(async () => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen().catch(() => {});
    } else {
      await document.exitFullscreen().catch(() => {});
    }
  }, []);

  // ── Toolbar button style ─────────────────────────────────────────────────────

  const tbBtn = (active?: boolean): React.CSSProperties => ({
    padding: '5px 9px',
    borderRadius: 6,
    border: `1px solid ${active ? 'rgba(249,115,22,0.45)' : 'rgba(255,255,255,0.08)'}`,
    background: active ? 'rgba(249,115,22,0.13)' : 'rgba(0,0,0,0.35)',
    color: active ? '#f97316' : '#6b7280',
    cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 4,
    fontSize: 11, fontWeight: 600,
    transition: 'all 0.14s',
    backdropFilter: 'blur(4px)',
  });

  // ── Reference heights ────────────────────────────────────────────────────────

  const refHeights = [
    { label: '1.80 m', desc: t('vr_ref_adult'),  color: '#f97316' },
    { label: '1.50 m', desc: t('vr_ref_stage'),  color: '#60a5fa' },
    { label: '0.00 m', desc: t('vr_ref_floor'),  color: '#22c55e' },
  ];

  return (
    <div
      ref={wrapperRef}
      style={{
        display: 'flex', flexDirection: 'column',
        height: isFullscreen ? '100vh' : 'calc(100vh - 116px)',
        minHeight: 520,
        background: '#060608',
        borderRadius: isFullscreen ? 0 : 16,
        border: isFullscreen ? 'none' : '1px solid rgba(255,255,255,0.07)',
        overflow: 'hidden',
      }}
    >
      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 14px',
          background: '#0a0a0e',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}
      >
        <Scan style={{ width: 14, height: 14, color: '#f97316', flexShrink: 0 }} />
        <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#f97316' }}>
          {t('vr_header')}
        </span>
        <div style={{ flex: 1 }} />
        <button style={tbBtn(showGrid)} onClick={() => setShowGrid(g => !g)}>
          <Grid3X3 style={{ width: 12, height: 12 }} />
          {t('vr_grid')}
        </button>
        <button style={tbBtn(showTPose)} onClick={() => setShowTPose(p => !p)}>
          <User style={{ width: 12, height: 12 }} />
          {t('vr_tpose')}
        </button>
        <button style={tbBtn()} onClick={resetAll}>
          <RotateCcw style={{ width: 12, height: 12 }} />
        </button>
        <button style={tbBtn(isFullscreen)} onClick={toggleFullscreen}>
          {isFullscreen
            ? <Minimize2 style={{ width: 12, height: 12 }} />
            : <Maximize2 style={{ width: 12, height: 12 }} />}
        </button>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Canvas Viewport */}
        <div
          ref={viewportRef}
          style={{ flex: 1, position: 'relative', overflow: 'hidden', minWidth: 0 }}
        >
          <canvas
            ref={canvasRef}
            style={{
              display: 'block', width: '100%', height: '100%',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
            onDoubleClick={onDblClick}
            onContextMenu={onContextMenu}
          />

          {/* Live transform readout (top-left overlay) */}
          <div
            style={{
              position: 'absolute', top: 12, left: 12,
              padding: '6px 10px', borderRadius: 8,
              background: 'rgba(0,0,0,0.60)',
              border: '1px solid rgba(255,255,255,0.07)',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'none',
            }}
          >
            <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: 'ui-monospace,monospace', color: 'rgba(255,255,255,0.5)' }}>
              <span><span style={{ color: '#ef4444' }}>X</span>{tf.x >= 0 ? '+' : ''}{tf.x.toFixed(2)}</span>
              <span><span style={{ color: '#22c55e' }}>Y</span>{tf.y >= 0 ? '+' : ''}{tf.y.toFixed(2)}</span>
              <span><span style={{ color: '#60a5fa' }}>Z</span>{tf.z >= 0 ? '+' : ''}{tf.z.toFixed(2)}</span>
              <span style={{ color: '#a78bfa' }}>↺{tf.rotY.toFixed(0)}°</span>
              <span style={{ color: '#fb923c' }}>⇲{tf.scale.toFixed(2)}×</span>
            </div>
          </div>

          {/* Camera hint (bottom-left overlay) */}
          <div style={{ position: 'absolute', bottom: 10, left: 14, pointerEvents: 'none' }}>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', fontFamily: 'ui-monospace,monospace' }}>
              {t('vr_orbit_hint')}
            </span>
          </div>

          {/* Corner bracket decorations */}
          {(['top:8px;left:8px', 'top:8px;right:8px', 'bottom:8px;left:8px', 'bottom:8px;right:8px'] as const).map((pos, i) => {
            const style: React.CSSProperties = {
              position: 'absolute', width: 14, height: 14, pointerEvents: 'none', opacity: 0.25,
              ...(i === 0 ? { top: 8, left: 8 } : i === 1 ? { top: 8, right: 8 } : i === 2 ? { bottom: 8, left: 8 } : { bottom: 8, right: 8 }),
            };
            return (
              <div key={i} style={style}>
                <svg viewBox="0 0 14 14" fill="none" stroke="#f97316" strokeWidth={1.5}>
                  {i === 0 && <polyline points="0,7 0,0 7,0" />}
                  {i === 1 && <polyline points="7,0 14,0 14,7" />}
                  {i === 2 && <polyline points="0,7 0,14 7,14" />}
                  {i === 3 && <polyline points="7,14 14,14 14,7" />}
                </svg>
              </div>
            );
          })}
        </div>

        {/* ── Right Controls Panel ──────────────────────────────────────── */}
        <div
          style={{
            width: 224, flexShrink: 0,
            background: '#08080e',
            borderLeft: '1px solid rgba(255,255,255,0.06)',
            overflowY: 'auto',
            padding: '16px 14px 24px',
          }}
        >
          {/* Position */}
          <Section label={t('vr_pos')}>
            <AxisSlider label="X" color="#ef4444" value={tf.x}    min={-5}   max={5}   step={0.01} unit="m" onChange={upd('x')} />
            <AxisSlider label="Y" color="#22c55e" value={tf.y}    min={-0.5} max={3}   step={0.01} unit="m" onChange={upd('y')} />
            <AxisSlider label="Z" color="#60a5fa" value={tf.z}    min={-5}   max={5}   step={0.01} unit="m" onChange={upd('z')} />
          </Section>

          {/* Rotation */}
          <Section label={t('vr_rot')}>
            <AxisSlider label="Y" color="#a78bfa" value={tf.rotY} min={-180} max={180} step={1}    unit="°" onChange={upd('rotY')} />
          </Section>

          {/* Scale */}
          <Section label={t('vr_scale')}>
            <AxisSlider label="S" color="#fb923c" value={tf.scale} min={0.5} max={2.0} step={0.01} unit="×" onChange={upd('scale')} />
          </Section>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0 14px' }} />

          {/* Snap to floor */}
          <button
            onClick={snapToFloor}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '8px 0', borderRadius: 10, marginBottom: 8,
              background: 'rgba(249,115,22,0.10)',
              color: '#f97316',
              border: '1px solid rgba(249,115,22,0.28)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            <ArrowDownToLine style={{ width: 13, height: 13 }} />
            {t('vr_floor_snap')}
          </button>

          {/* Reset */}
          <button
            onClick={resetAll}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, padding: '7px 0', borderRadius: 10, marginBottom: 14,
              background: 'rgba(255,255,255,0.03)',
              color: '#6b7280',
              border: '1px solid rgba(255,255,255,0.07)',
              fontSize: 12, cursor: 'pointer',
            }}
          >
            <RotateCcw style={{ width: 12, height: 12 }} />
            {t('vr_reset')}
          </button>

          {/* Divider */}
          <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '0 0 14px' }} />

          {/* Floor anchor status */}
          <div
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 10px', borderRadius: 8, marginBottom: 14,
              background: tf.y === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${tf.y === 0 ? 'rgba(34,197,94,0.22)' : 'rgba(255,255,255,0.06)'}`,
            }}
          >
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: tf.y === 0 ? '#22c55e' : '#374151',
                boxShadow: tf.y === 0 ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
              }}
            />
            <span style={{ fontSize: 11, color: tf.y === 0 ? '#22c55e' : '#4b5563' }}>
              {t('vr_floor_anchored')}
            </span>
          </div>

          {/* Reference heights */}
          <div
            style={{
              padding: '10px 12px', borderRadius: 10,
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <p
              style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.25)', marginBottom: 8 }}
            >
              {t('vr_ref_heights')}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {refHeights.map(({ label, desc, color }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: 'ui-monospace,monospace', color, minWidth: 46 }}>{label}</span>
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.30)' }}>{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Double-click tip */}
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', marginTop: 12, lineHeight: 1.5 }}>
            {t('vr_dblclick_tip')}
          </p>
        </div>
      </div>
    </div>
  );
}
