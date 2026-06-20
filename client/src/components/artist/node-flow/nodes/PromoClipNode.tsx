/**
 * BOOSTIFY NODE FLOW — PromoClipNode
 *
 * Rich creative-workflow node for generating promo clips.
 * - Shows a 5-step creative flow sequence (mini visual pipeline)
 * - Full config: style, model, fps, color mood, instructions, duration
 * - Dynamic multi-step progress bar during execution
 * - Animated traveling-light border (reused from BaseNode pattern)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDot,
  Clapperboard,
  Wand2,
  Palette,
  Sparkles,
  Upload,
  Sliders,
} from 'lucide-react';
import type { NodeFlowData, NodeStatus } from '../useFlowStore';
import { useFlowStore } from '../useFlowStore';

// ─── Creative-flow step definitions ─────────────────────────────────────────

const FLOW_STEPS = [
  { id: 'analyze',  label: 'Análisis',     icon: '🎵', color: '#3b82f6', desc: 'Song + artist metadata' },
  { id: 'style',    label: 'Estilo',        icon: '🎨', color: '#8b5cf6', desc: 'Visual style frames' },
  { id: 'generate', label: 'Generación',   icon: '🎬', color: '#ec4899', desc: 'Scene synthesis' },
  { id: 'fx',       label: 'FX & Color',   icon: '✨', color: '#f59e0b', desc: 'Grade & effects' },
  { id: 'export',   label: 'Exportar',     icon: '📤', color: '#10b981', desc: 'Encode & deliver' },
] as const;

// ─── Config options ──────────────────────────────────────────────────────────

const STYLES = [
  { id: 'cinematic',   label: 'Cinemático',    icon: '🎞️' },
  { id: 'musicvideo',  label: 'Music Video',   icon: '🎤' },
  { id: 'lyricvideo',  label: 'Lyric Video',   icon: '📝' },
  { id: 'vfx',         label: 'VFX',           icon: '⚡' },
  { id: 'minimal',     label: 'Minimal',       icon: '⬛' },
  { id: 'vintage',     label: 'Vintage',       icon: '📽️' },
] as const;

const MODELS = [
  { id: 'auto',     label: 'Auto',      badge: '✨' },
  { id: 'seedance', label: 'Seedance',  badge: '🌱' },
  { id: 'kling',    label: 'Kling',     badge: '⚡' },
  { id: 'runway',   label: 'Runway',    badge: '🛫' },
  { id: 'hailuo',   label: 'Hailuo',    badge: '🌊' },
] as const;

const FPS_OPTIONS = ['24', '30', '60'] as const;
const DURATION_OPTIONS = ['5s', '10s', '15s', '30s'] as const;

const COLOR_MOODS = [
  { id: 'warm',   label: 'Cálido',      hex: '#f97316' },
  { id: 'cold',   label: 'Frío',        hex: '#38bdf8' },
  { id: 'neon',   label: 'Neon',        hex: '#a855f7' },
  { id: 'dark',   label: 'Oscuro',      hex: '#1e293b' },
  { id: 'pastel', label: 'Pastel',      hex: '#f0abfc' },
  { id: 'mono',   label: 'Monocromático', hex: '#94a3b8' },
] as const;

// ─── Execution progress steps ────────────────────────────────────────────────

const EXEC_STEPS = [
  { pct: 8,  label: 'Analizando metadatos de la canción…',        color: '#3b82f6' },
  { pct: 22, label: 'Generando frames de estilo visual…',          color: '#8b5cf6' },
  { pct: 38, label: 'Procesando instrucciones creativas…',         color: '#a855f7' },
  { pct: 55, label: 'Sintetizando escenas con el modelo de IA…',   color: '#ec4899' },
  { pct: 70, label: 'Aplicando color mood y efectos visuales…',    color: '#f59e0b' },
  { pct: 85, label: 'Codificando video con configuración FPS…',    color: '#10b981' },
  { pct: 95, label: 'Empaquetando y optimizando el clip…',         color: '#22c55e' },
];

// ─── Animated border ring (same pattern as BaseNode) ─────────────────────────

const BORDER_ANIM: Record<NodeStatus, { active: boolean; color: string; glow: string; speed: string }> = {
  idle:    { active: false, color: '',        glow: '',                       speed: '0s' },
  running: { active: true,  color: '#fbbf24', glow: 'rgba(251,191,36,0.7)',  speed: '1.6s' },
  done:    { active: true,  color: '#22c55e', glow: 'rgba(34,197,94,0.7)',   speed: '2.4s' },
  error:   { active: true,  color: '#ef4444', glow: 'rgba(239,68,68,0.75)',  speed: '0.9s' },
};

let _animInjected = false;
function injectAnim() {
  if (_animInjected || typeof document === 'undefined') return;
  _animInjected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes promoRingRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    @keyframes promoGlowPulse  { 0%,100% { opacity:.85; } 50% { opacity:.4; } }
    @keyframes promoScanBar    { 0% { left:-40%; } 100% { left:120%; } }
  `;
  document.head.appendChild(s);
}

function BorderRing({ color, glow, speed }: { color: string; glow: string; speed: string }) {
  injectAnim();
  return (
    <>
      <div style={{
        position: 'absolute', inset: -4, borderRadius: 16,
        boxShadow: `0 0 18px 4px ${glow}, 0 0 36px 8px ${glow}40`,
        pointerEvents: 'none', zIndex: 0,
        animation: `promoGlowPulse ${speed} ease-in-out infinite`,
      }} />
      <div style={{
        position: 'absolute', inset: -2, borderRadius: 14, overflow: 'hidden',
        pointerEvents: 'none', zIndex: 1,
      }}>
        <div style={{
          position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%',
          background: `conic-gradient(from 0deg,transparent 0deg,transparent 240deg,${color}cc 300deg,${color} 340deg,${color}cc 360deg)`,
          animation: `promoRingRotate ${speed} linear infinite`,
          transformOrigin: '50% 50%',
        }} />
        <div style={{
          position: 'absolute', inset: 2, borderRadius: 12,
          background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)',
        }} />
      </div>
    </>
  );
}

// ─── Pill button helper ───────────────────────────────────────────────────────

function Pill({
  active, onClick, children, color = '#8b5cf6',
}: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="nodrag"
      style={{
        padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
        cursor: 'pointer', transition: 'all 0.15s',
        background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
        border: active ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.08)',
        color: active ? color : '#64748b',
        outline: 'none',
      }}
    >
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PromoClipNode(props: NodeProps<NodeFlowData>) {
  const { id: nodeId, selected, data } = props;

  const updateNodeData = useFlowStore(s => s.updateNodeData);

  // Shorthand getters with defaults
  const promoStyle      = (data.promoStyle      as string) || 'cinematic';
  const promoModel      = (data.promoModel      as string) || 'auto';
  const frameRate       = (data.frameRate       as string) || '30';
  const colorMood       = (data.colorMood       as string) || 'dark';
  const promoInstructions = (data.promoInstructions as string) || '';
  const promoDuration   = (data.promoDuration   as string) || '10s';
  const status          = (data.status          as NodeStatus) || 'idle';
  const videoUrl        = (data.output as any)?.videoUrl as string | undefined;

  const [isExpanded, setIsExpanded] = useState(false);

  // ── Progress simulation ────────────────────────────────────────────────────
  const [execPct,    setExecPct]    = useState(0);
  const [execStep,   setExecStep]   = useState(EXEC_STEPS[0]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => {
    if (status === 'running') {
      setExecPct(0);
      setExecStep(EXEC_STEPS[0]);
      let stepIdx = 0;

      timerRef.current = setInterval(() => {
        stepIdx = Math.min(stepIdx + 1, EXEC_STEPS.length - 1);
        setExecStep(EXEC_STEPS[stepIdx]);
        setExecPct(EXEC_STEPS[stepIdx].pct);
        if (stepIdx >= EXEC_STEPS.length - 1) clearTimer();
      }, 3000);

      return clearTimer;
    } else {
      clearTimer();
      if (status === 'done')  setExecPct(100);
      if (status === 'idle')  setExecPct(0);
      if (status === 'error') setExecPct(0);
    }
  }, [status, clearTimer]);

  // ── Config helpers ─────────────────────────────────────────────────────────

  const set = useCallback((field: string, value: string) => {
    updateNodeData(nodeId, { [field]: value });
  }, [nodeId, updateNodeData]);

  // ── Style ──────────────────────────────────────────────────────────────────

  const borderAnim = BORDER_ANIM[status];
  const currentModel = MODELS.find(m => m.id === promoModel) ?? MODELS[0];
  const currentStyle = STYLES.find(s => s.id === promoStyle) ?? STYLES[0];
  const currentMood  = COLOR_MOODS.find(m => m.id === colorMood) ?? COLOR_MOODS[3];

  const accentColor =
    status === 'running' ? '#fbbf24'
    : status === 'done'  ? '#22c55e'
    : status === 'error' ? '#ef4444'
    : '#8b5cf6';

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{ position: 'relative', width: 290 }}
    >
      {/* Animated border ring */}
      {borderAnim.active && <BorderRing color={borderAnim.color} glow={borderAnim.glow} speed={borderAnim.speed} />}

      {/* Input handle */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          background: '#8b5cf6', width: 10, height: 10,
          border: '2px solid #0d0d1a', left: -6, zIndex: 10,
          boxShadow: '0 0 6px #8b5cf6',
        }}
      />

      {/* Main card */}
      <div style={{
        background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)',
        border: `1px solid ${selected ? '#8b5cf6' : accentColor + '40'}`,
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: selected ? '0 0 14px rgba(139,92,246,0.35)' : 'none',
        position: 'relative', zIndex: 2,
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 12px 8px',
          background: 'rgba(139,92,246,0.08)',
          borderBottom: `1px solid rgba(139,92,246,0.15)`,
        }}>
          {/* Icon */}
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'rgba(139,92,246,0.18)', border: '1px solid rgba(139,92,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Video size={14} style={{ color: '#a78bfa' }} />
          </div>

          {/* Title + subtitle */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              PROMO CLIP
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: currentMood.hex, fontWeight: 700 }}>●</span>
              {currentStyle.icon} {currentStyle.label} · {currentModel.badge} {currentModel.label} · {frameRate}fps
            </div>
          </div>

          {/* Status icon */}
          <div>
            {status === 'idle'    && <CircleDot size={13} style={{ color: '#475569' }} />}
            {status === 'running' && <Loader2 size={13} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />}
            {status === 'done'    && <CheckCircle2 size={13} style={{ color: '#22c55e' }} />}
            {status === 'error'   && <XCircle size={13} style={{ color: '#ef4444' }} />}
          </div>
        </div>

        {/* ── Progress bar (shown when running or just done) ── */}
        <AnimatePresence>
          {(status === 'running' || (status === 'done' && execPct === 100)) && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                {/* Step mini-flow row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 8, overflowX: 'hidden' }}>
                  {FLOW_STEPS.map((step, i) => {
                    const stepThreshold = (i + 1) * (100 / FLOW_STEPS.length);
                    const isActive  = execPct >= stepThreshold - (100 / FLOW_STEPS.length);
                    const isDone    = execPct >= stepThreshold;
                    return (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{
                          display: 'flex', flexDirection: 'column', alignItems: 'center',
                          padding: '4px 5px', borderRadius: 6, fontSize: 9, fontWeight: 700,
                          background: isDone ? `${step.color}25` : isActive ? `${step.color}12` : 'rgba(255,255,255,0.04)',
                          border: `1px solid ${isDone ? step.color + '60' : isActive ? step.color + '30' : 'rgba(255,255,255,0.08)'}`,
                          color: isDone ? step.color : isActive ? step.color + 'aa' : '#334155',
                          transition: 'all 0.4s',
                          flex: 1,
                        }}>
                          <span style={{ fontSize: 11, lineHeight: 1 }}>{isDone ? '✓' : step.icon}</span>
                          <span style={{ marginTop: 2, fontSize: 8, textAlign: 'center', lineHeight: 1.1 }}>{step.label}</span>
                        </div>
                        {i < FLOW_STEPS.length - 1 && (
                          <div style={{
                            width: 8, height: 1, flexShrink: 0,
                            background: isDone ? step.color : 'rgba(255,255,255,0.08)',
                            transition: 'background 0.4s',
                          }} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative' }}>
                  <motion.div
                    animate={{ width: `${status === 'done' ? 100 : execPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg, ${execStep.color}, ${accentColor})`,
                      boxShadow: `0 0 6px ${execStep.color}80`,
                    }}
                  />
                  {/* Scanning highlight */}
                  {status === 'running' && (
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: '40%',
                      background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                      animation: 'promoScanBar 1.8s linear infinite',
                    }} />
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5 }}>
                  <span style={{ fontSize: 9, color: execStep.color, fontWeight: 700 }}>
                    {status === 'done' ? '✓ Clip generado' : execStep.label}
                  </span>
                  <span style={{ fontSize: 9, color: '#475569', fontWeight: 700 }}>
                    {status === 'done' ? '100%' : `${execPct}%`}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error state ── */}
        {status === 'error' && (data.error as string) && (
          <div style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.08)', borderBottom: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: 9, color: '#f87171', margin: 0 }}>⚠ {String(data.error).slice(0, 80)}</p>
          </div>
        )}

        {/* ── Video output (when done) ── */}
        {status === 'done' && videoUrl && (
          <div style={{ padding: '8px 12px', borderBottom: '1px solid rgba(34,197,94,0.15)', background: 'rgba(34,197,94,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <CheckCircle2 size={11} style={{ color: '#22c55e', flexShrink: 0 }} />
              <a
                href={videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="nodrag"
                style={{ fontSize: 9, color: '#4ade80', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              >
                {videoUrl.length > 40 ? videoUrl.slice(0, 40) + '…' : videoUrl}
              </a>
            </div>
          </div>
        )}

        {/* ── Expand toggle ── */}
        <button
          type="button"
          className="nodrag"
          onClick={() => setIsExpanded(v => !v)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 12px', background: 'transparent', border: 'none',
            cursor: 'pointer', color: '#64748b',
            borderTop: isExpanded ? 'none' : '1px solid rgba(255,255,255,0.04)',
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#a78bfa')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#64748b')}
        >
          <span style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sliders size={9} />
            Configuración creativa
          </span>
          {isExpanded
            ? <ChevronUp size={11} />
            : <ChevronDown size={11} />}
        </button>

        {/* ── Expanded config panel ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>

                {/* ── Creative flow sequence ── */}
                <div style={{
                  borderRadius: 8, padding: '8px 10px',
                  background: 'rgba(139,92,246,0.06)',
                  border: '1px solid rgba(139,92,246,0.15)',
                }}>
                  <p style={{ fontSize: 9, fontWeight: 800, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 7px', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Clapperboard size={9} /> Flujo Creativo
                  </p>
                  <div style={{ display: 'flex', alignItems: 'stretch', gap: 3 }}>
                    {FLOW_STEPS.map((step, i) => (
                      <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: 1, minWidth: 0 }}>
                        <div style={{
                          flex: 1, borderRadius: 6, padding: '5px 4px', textAlign: 'center',
                          background: `${step.color}12`, border: `1px solid ${step.color}35`,
                        }}>
                          <div style={{ fontSize: 13, lineHeight: 1 }}>{step.icon}</div>
                          <div style={{ fontSize: 8, fontWeight: 700, color: step.color, marginTop: 2, lineHeight: 1.2 }}>{step.label}</div>
                          <div style={{ fontSize: 7, color: '#475569', marginTop: 1, lineHeight: 1.2 }}>{step.desc}</div>
                        </div>
                        {i < FLOW_STEPS.length - 1 && (
                          <div style={{ fontSize: 9, color: '#334155', flexShrink: 0 }}>→</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* ── Style ── */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <Wand2 size={9} /> Estilo Visual
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {STYLES.map(s => (
                      <Pill key={s.id} active={promoStyle === s.id} onClick={() => set('promoStyle', s.id)} color="#8b5cf6">
                        {s.icon} {s.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* ── Model ── */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <Sparkles size={9} /> Modelo IA
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {MODELS.map(m => (
                      <Pill key={m.id} active={promoModel === m.id} onClick={() => set('promoModel', m.id)} color="#a855f7">
                        {m.badge} {m.label}
                      </Pill>
                    ))}
                  </div>
                </div>

                {/* ── FPS + Duration (row) ── */}
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
                      FPS
                    </label>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {FPS_OPTIONS.map(f => (
                        <Pill key={f} active={frameRate === f} onClick={() => set('frameRate', f)} color="#f59e0b">
                          {f}
                        </Pill>
                      ))}
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 5 }}>
                      Duración
                    </label>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {DURATION_OPTIONS.map(d => (
                        <Pill key={d} active={promoDuration === d} onClick={() => set('promoDuration', d)} color="#f59e0b">
                          {d}
                        </Pill>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ── Color Mood ── */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <Palette size={9} /> Color Mood
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {COLOR_MOODS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        className="nodrag"
                        onClick={() => set('colorMood', m.id)}
                        style={{
                          padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                          cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                          background: colorMood === m.id ? `${m.hex}22` : 'rgba(255,255,255,0.04)',
                          border: colorMood === m.id ? `1px solid ${m.hex}60` : '1px solid rgba(255,255,255,0.08)',
                          color: colorMood === m.id ? m.hex : '#64748b',
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.hex, flexShrink: 0, display: 'inline-block' }} />
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* ── Instructions ── */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                    <Upload size={9} /> Instrucciones IA
                  </label>
                  <textarea
                    className="nodrag"
                    value={promoInstructions}
                    onChange={e => set('promoInstructions', e.target.value)}
                    placeholder="Ej: Cámara lenta, transiciones glitch, close-ups del artista, ambiente futurista…"
                    rows={3}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#cbd5e1',
                      resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                      lineHeight: 1.5,
                    }}
                    onFocus={e => (e.target.style.border = '1px solid rgba(139,92,246,0.5)')}
                    onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                  />
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          background: '#8b5cf6', width: 10, height: 10,
          border: '2px solid #0d0d1a', right: -6, zIndex: 10,
          boxShadow: '0 0 6px #8b5cf6',
        }}
      />
    </motion.div>
  );
}
