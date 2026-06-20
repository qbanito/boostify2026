/**
 * BOOSTIFY NODE FLOW — VideoInputNode
 *
 * Two modes:
 *  - "url"      : paste an existing video URL directly
 *  - "generate" : AI video generation from a text prompt via
 *                 POST /api/video-generation/generate  (PiAPI Hailuo)
 *                 Poll: GET /api/video-generation/status?taskId=…
 *
 * Output contract: { videoUrl, title, thumbnailUrl, model, duration }
 * All downstream nodes (PromoClip, SocialPost…) receive these fields.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video,
  Wand2,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDot,
  Play,
  Film,
  Sparkles,
  Camera,
  Monitor,
  ChevronDown,
} from 'lucide-react';
import type { NodeFlowData, NodeStatus } from '../useFlowStore';
import { useFlowStore } from '../useFlowStore';

// ─── Video models ─────────────────────────────────────────────────────────────

const MODELS = [
  { id: 't2v-01',          label: 'T2V Standard', badge: '🎬', color: '#6366f1', desc: 'Texto → Video' },
  { id: 't2v-01-director', label: 'T2V Director',  badge: '🎥', color: '#ec4899', desc: 'Con movimientos de cámara' },
] as const;

const CAMERA_MOVES = [
  'zoom_in', 'zoom_out', 'pan_left', 'pan_right', 'tilt_up', 'tilt_down',
  'tracking_shot', 'aerial_shot', 'crane_up', 'crane_down',
] as const;

const RESOLUTION_OPTIONS = [
  { id: '720p',  label: '720p'  },
  { id: '1080p', label: '1080p' },
] as const;

// ─── Progress steps ───────────────────────────────────────────────────────────

const GEN_STEPS = [
  { pct: 8,  label: 'Iniciando generación de video…',           color: '#6366f1' },
  { pct: 22, label: 'Analizando prompt y composición…',          color: '#8b5cf6' },
  { pct: 42, label: 'Generando fotogramas clave…',               color: '#a855f7' },
  { pct: 60, label: 'Animando secuencias visuales…',             color: '#ec4899' },
  { pct: 78, label: 'Aplicando movimientos de cámara…',          color: '#f59e0b' },
  { pct: 92, label: 'Renderizando y comprimiendo video…',        color: '#10b981' },
];

// ─── CSS animations (injected once) ──────────────────────────────────────────

let _injected = false;
function injectAnim() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes vidRingRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes vidGlowPulse  { 0%,100%{opacity:.85} 50%{opacity:.4} }
    @keyframes vidScan       { 0%{left:-40%} 100%{left:120%} }
    @keyframes vidPing       { 0%{transform:scale(1);opacity:1} 100%{transform:scale(2.2);opacity:0} }
  `;
  document.head.appendChild(s);
}

// ─── Animated border ring ─────────────────────────────────────────────────────

const RING_CFG: Record<NodeStatus, { active: boolean; color: string; glow: string; speed: string }> = {
  idle:    { active: false, color: '',        glow: '',                      speed: '0s' },
  running: { active: true,  color: '#a855f7', glow: 'rgba(168,85,247,0.7)', speed: '1.5s' },
  done:    { active: true,  color: '#22c55e', glow: 'rgba(34,197,94,0.7)',  speed: '2.4s' },
  error:   { active: true,  color: '#ef4444', glow: 'rgba(239,68,68,0.75)', speed: '0.9s' },
};

function BorderRing({ color, glow, speed }: { color: string; glow: string; speed: string }) {
  injectAnim();
  return (
    <>
      <div style={{ position: 'absolute', inset: -4, borderRadius: 16, boxShadow: `0 0 18px 4px ${glow},0 0 36px 8px ${glow}40`, pointerEvents: 'none', zIndex: 0, animation: `vidGlowPulse ${speed} ease-in-out infinite` }} />
      <div style={{ position: 'absolute', inset: -2, borderRadius: 14, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%', background: `conic-gradient(from 0deg,transparent 0deg,transparent 240deg,${color}cc 300deg,${color} 340deg,${color}cc 360deg)`, animation: `vidRingRotate ${speed} linear infinite`, transformOrigin: '50% 50%' }} />
        <div style={{ position: 'absolute', inset: 2, borderRadius: 12, background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)' }} />
      </div>
    </>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children, color = '#6366f1' }: {
  active: boolean; onClick: () => void; children: React.ReactNode; color?: string;
}) {
  return (
    <button type="button" className="nodrag" onClick={onClick} style={{
      padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
      cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
      background: active ? `${color}22` : 'rgba(255,255,255,0.04)',
      border: active ? `1px solid ${color}60` : '1px solid rgba(255,255,255,0.08)',
      color: active ? color : '#64748b',
    }}>
      {children}
    </button>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function VideoInputNode(props: NodeProps<NodeFlowData>) {
  const { id: nodeId, selected, data } = props;
  const updateNodeData = useFlowStore(s => s.updateNodeData);

  // Persistent config (stored on node data)
  const mode            = (data.videoMode        as 'url' | 'generate') || 'url';
  const status          = (data.status           as NodeStatus) || 'idle';
  const generatedVideo  = (data.generatedVideo   as any) || null;

  const manualUrl       = (data.videoUrl         as string) || '';
  const videoTitle      = (data.videoTitle       as string) || '';

  const genPrompt       = (data.vidGenPrompt     as string) || '';
  const genModel        = (data.vidGenModel      as string) || 't2v-01';
  const genResolution   = (data.vidGenResolution as string) || '1080p';
  const genImageUrl     = (data.vidGenImageUrl   as string) || '';
  const genCameraMoves  = (data.vidGenCameraMoves as string[]) || [];
  const genTitle        = (data.vidGenTitle      as string) || '';

  // Local UI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPct,       setGenPct]       = useState(0);
  const [genStep,      setGenStep]      = useState(GEN_STEPS[0]);
  const [taskId,       setTaskId]       = useState<string | null>(null);
  const [genError,     setGenError]     = useState<string | null>(null);
  const [showCamPanel, setShowCamPanel] = useState(false);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current)   { clearInterval(pollRef.current);   pollRef.current   = null; }
    if (fakeTimer.current) { clearInterval(fakeTimer.current); fakeTimer.current = null; }
  }, []);

  const set = useCallback((field: string, value: unknown) => {
    updateNodeData(nodeId, { [field]: value });
  }, [nodeId, updateNodeData]);

  // ── Toggle camera movement ─────────────────────────────────────────────────

  const toggleCam = useCallback((move: string) => {
    const cur = (data.vidGenCameraMoves as string[]) || [];
    const next = cur.includes(move) ? cur.filter(m => m !== move) : [...cur, move];
    set('vidGenCameraMoves', next);
  }, [data.vidGenCameraMoves, set]);

  // ── Poll status ───────────────────────────────────────────────────────────

  const startPolling = useCallback((tid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/video-generation/status?taskId=${encodeURIComponent(tid)}`);
        if (!res.ok) return;
        const resp = await res.json() as any;

        const st = resp.status;
        if (st === 'completed' || st === 'done' || resp.url) {
          stopTimers();
          setIsGenerating(false);
          setGenPct(100);
          const video = {
            taskId:       tid,
            title:        genTitle || `AI Video — ${new Date().toLocaleTimeString()}`,
            videoUrl:     resp.url   || resp.videoUrl || '',
            thumbnailUrl: resp.thumbnailUrl || '',
          };
          set('generatedVideo', video);
          set('status', 'done');
          set('output', { videoUrl: video.videoUrl, title: video.title, thumbnailUrl: video.thumbnailUrl });
        } else if (st === 'failed' || st === 'error') {
          stopTimers();
          setIsGenerating(false);
          setGenError(resp.error || 'Generation failed');
          set('status', 'error');
        }
      } catch (_e) {
        // transient error — keep polling
      }
    }, 4000);
  }, [genTitle, set, stopTimers]);

  // ── Fake progress bar ─────────────────────────────────────────────────────

  const startFakeProgress = useCallback(() => {
    let idx = 0;
    fakeTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, GEN_STEPS.length - 1);
      setGenStep(GEN_STEPS[idx]);
      setGenPct(GEN_STEPS[idx].pct);
      if (idx >= GEN_STEPS.length - 1) {
        if (fakeTimer.current) clearInterval(fakeTimer.current);
      }
    }, 6000);
  }, []);

  // ── Generate handler ──────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!genPrompt.trim()) return;
    stopTimers();
    setIsGenerating(true);
    setGenPct(0);
    setGenStep(GEN_STEPS[0]);
    setGenError(null);
    set('status', 'running');
    set('generatedVideo', null);

    try {
      const payload: Record<string, unknown> = {
        prompt: genPrompt,
        model:  genModel,
      };
      if (genImageUrl.trim()) payload.imageUrl = genImageUrl.trim();
      if (genModel === 't2v-01-director' && genCameraMoves.length > 0) {
        payload.cameraMovements = genCameraMoves;
      }

      const res = await fetch('/api/video-generation/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const body = await res.json() as any;
      if (!res.ok || !body.success) throw new Error(body.error || `HTTP ${res.status}`);

      const tid = body.taskId || body.id;
      if (!tid) throw new Error('No taskId returned from API');

      setTaskId(tid);
      startFakeProgress();
      startPolling(tid);
    } catch (err: any) {
      stopTimers();
      setIsGenerating(false);
      setGenError(err.message || 'Request failed');
      set('status', 'error');
    }
  }, [genPrompt, genModel, genImageUrl, genCameraMoves, set, startPolling, startFakeProgress, stopTimers]);

  // Cleanup on unmount
  useEffect(() => () => stopTimers(), [stopTimers]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const ring        = RING_CFG[status];
  const currentMdl  = MODELS.find(m => m.id === genModel) ?? MODELS[0];
  const accentColor = status === 'running' ? '#a855f7' : status === 'done' ? '#22c55e' : status === 'error' ? '#ef4444' : '#6366f1';
  const showProgress = isGenerating || status === 'running';
  const videoReady   = !!generatedVideo?.videoUrl;

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{ position: 'relative', width: 290 }}
    >
      {ring.active && <BorderRing color={ring.color} glow={ring.glow} speed={ring.speed} />}

      {/* ── Card ── */}
      <div style={{
        background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)',
        border: `1px solid ${selected ? '#6366f1' : accentColor + '40'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: selected ? '0 0 14px rgba(99,102,241,0.35)' : 'none',
        position: 'relative', zIndex: 2,
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 12px 8px',
          background: 'rgba(99,102,241,0.08)',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'rgba(99,102,241,0.18)', border: '1px solid rgba(99,102,241,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Film size={14} style={{ color: '#818cf8' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              VIDEO INPUT
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              {mode === 'generate'
                ? <><span style={{ color: currentMdl.color, fontWeight: 700 }}>{currentMdl.badge}</span> {currentMdl.label} · AI</>
                : <>🔗 URL manual</>}
            </div>
          </div>
          {status === 'idle'    && <CircleDot size={13} style={{ color: '#475569' }} />}
          {status === 'running' && <Loader2 size={13} style={{ color: '#a855f7', animation: 'spin 1s linear infinite' }} />}
          {status === 'done'    && <CheckCircle2 size={13} style={{ color: '#22c55e' }} />}
          {status === 'error'   && <XCircle size={13} style={{ color: '#ef4444' }} />}
        </div>

        {/* ── Mode tabs ── */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {([['url', '🔗', 'URL / Upload'], ['generate', '🎬', 'Generar IA']] as const).map(([m, icon, label]) => (
            <button
              key={m}
              type="button"
              className="nodrag"
              onClick={() => set('videoMode', m)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                background: mode === m ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
                border: mode === m ? '1px solid rgba(99,102,241,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: mode === m ? '#818cf8' : '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── URL mode ── */}
        {mode === 'url' && (
          <div style={{ padding: '10px 12px' }}>
            <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
              <Link2 size={9} /> Título del Video
            </label>
            <input
              className="nodrag"
              type="text"
              value={videoTitle}
              onChange={e => set('videoTitle', e.target.value)}
              placeholder="Ej: Official Music Video"
              style={{
                width: '100%', boxSizing: 'border-box', marginBottom: 8,
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.border = '1px solid rgba(99,102,241,0.5)')}
              onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
            />
            <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
              URL del Video
            </label>
            <input
              className="nodrag"
              type="text"
              value={manualUrl}
              onChange={e => set('videoUrl', e.target.value)}
              placeholder="https://…/video.mp4"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e => (e.target.style.border = '1px solid rgba(99,102,241,0.5)')}
              onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
            />
            {manualUrl && (
              <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 5 }}>
                <CheckCircle2 size={9} style={{ color: '#22c55e', flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: '#4ade80' }}>URL cargada → listo para conectar</span>
              </div>
            )}
          </div>
        )}

        {/* ── GENERATE mode ── */}
        {mode === 'generate' && (
          <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>

            {/* Title */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                Título
              </label>
              <input
                className="nodrag"
                type="text"
                value={genTitle}
                onChange={e => set('vidGenTitle', e.target.value)}
                placeholder="Ej: Midnight Neon Drive…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.border = '1px solid rgba(99,102,241,0.5)')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Prompt */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Wand2 size={9} /> Prompt de Video
              </label>
              <textarea
                className="nodrag"
                value={genPrompt}
                onChange={e => set('vidGenPrompt', e.target.value)}
                placeholder="Ej: Neon-lit city at night, rain on streets, cinematic slow motion, a lone artist walking away from camera…"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#cbd5e1',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                }}
                onFocus={e => (e.target.style.border = '1px solid rgba(99,102,241,0.5)')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Model */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <Sparkles size={9} /> Modelo
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {MODELS.map(m => (
                  <Pill key={m.id} active={genModel === m.id} onClick={() => set('vidGenModel', m.id)} color={m.color}>
                    {m.badge} {m.label}
                  </Pill>
                ))}
              </div>
            </div>

            {/* Resolution + Image URL */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
                  <Monitor size={9} /> Resolución
                </label>
                <div style={{ display: 'flex', gap: 4 }}>
                  {RESOLUTION_OPTIONS.map(r => (
                    <Pill key={r.id} active={genResolution === r.id} onClick={() => set('vidGenResolution', r.id)} color="#6366f1">
                      {r.label}
                    </Pill>
                  ))}
                </div>
              </div>
            </div>

            {/* Image URL (optional) */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                Imagen base (opcional, img→video)
              </label>
              <input
                className="nodrag"
                type="text"
                value={genImageUrl}
                onChange={e => set('vidGenImageUrl', e.target.value)}
                placeholder="https://…/cover.jpg"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.border = '1px solid rgba(99,102,241,0.5)')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Camera movements (Director mode only) */}
            {genModel === 't2v-01-director' && (
              <div>
                <button
                  type="button"
                  className="nodrag"
                  onClick={() => setShowCamPanel(p => !p)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '5px 8px', borderRadius: 6,
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                    color: '#94a3b8', fontSize: 10, fontWeight: 700, cursor: 'pointer', outline: 'none',
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Camera size={9} /> Movimientos de cámara
                    {genCameraMoves.length > 0 && (
                      <span style={{ background: '#6366f1', color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>
                        {genCameraMoves.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown size={9} style={{ transform: showCamPanel ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
                </button>
                <AnimatePresence>
                  {showCamPanel && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      style={{ overflow: 'hidden' }}
                    >
                      <div style={{ paddingTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {CAMERA_MOVES.map(mv => (
                          <Pill
                            key={mv}
                            active={genCameraMoves.includes(mv)}
                            onClick={() => toggleCam(mv)}
                            color="#ec4899"
                          >
                            {mv.replace(/_/g, ' ')}
                          </Pill>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Generate button */}
            <button
              type="button"
              className="nodrag"
              onClick={handleGenerate}
              disabled={isGenerating || !genPrompt.trim()}
              style={{
                width: '100%', padding: '8px 0', borderRadius: 8, fontWeight: 800, fontSize: 11,
                cursor: isGenerating || !genPrompt.trim() ? 'not-allowed' : 'pointer',
                outline: 'none', transition: 'all 0.15s',
                background: isGenerating || !genPrompt.trim()
                  ? 'rgba(255,255,255,0.06)'
                  : 'linear-gradient(135deg,#4f46e5,#7c3aed)',
                border: isGenerating || !genPrompt.trim()
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(124,58,237,0.5)',
                color: isGenerating || !genPrompt.trim() ? '#475569' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: !isGenerating && genPrompt.trim() ? '0 0 18px rgba(79,70,229,0.35)' : 'none',
              }}
            >
              {isGenerating
                ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
                : <><Video size={11} /> Generar Video</>}
            </button>

          </div>
        )}

        {/* ── Progress bar ── */}
        <AnimatePresence>
          {mode === 'generate' && showProgress && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative', marginBottom: 6 }}>
                  <motion.div
                    animate={{ width: `${genPct}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg,${genStep.color},#a855f7)`,
                      boxShadow: `0 0 6px ${genStep.color}80`,
                    }}
                  />
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%',
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)',
                    animation: 'vidScan 2s linear infinite',
                  }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: genStep.color, fontWeight: 700, flex: 1, marginRight: 6 }}>
                    {genStep.label}
                  </span>
                  <span style={{ fontSize: 9, color: '#475569', fontWeight: 700 }}>{genPct}%</span>
                </div>
                {taskId && (
                  <p style={{ fontSize: 8, color: '#334155', margin: '4px 0 0' }}>
                    Task: {taskId.slice(0, 16)}…
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error message ── */}
        {genError && mode === 'generate' && (
          <div style={{ padding: '7px 12px', background: 'rgba(239,68,68,0.08)', borderTop: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: 9, color: '#f87171', margin: 0 }}>⚠ {genError.slice(0, 100)}</p>
          </div>
        )}

        {/* ── Generated video result ── */}
        <AnimatePresence>
          {mode === 'generate' && videoReady && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={{ overflow: 'hidden' }}
            >
              <div style={{
                padding: '8px 12px',
                background: 'rgba(34,197,94,0.06)',
                borderTop: '1px solid rgba(34,197,94,0.2)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                  <CheckCircle2 size={10} style={{ color: '#22c55e', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {generatedVideo.title || 'Video Ready'}
                  </span>
                </div>
                {generatedVideo.videoUrl && (
                  <a
                    href={generatedVideo.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nodrag"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 9, color: '#6ee7b7', textDecoration: 'none',
                      padding: '3px 7px', borderRadius: 4,
                      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                    }}
                  >
                    <Play size={8} /> Ver video
                  </a>
                )}
                <p style={{ fontSize: 8, color: '#334155', margin: '5px 0 0' }}>
                  ✓ Listo para PromoClip · Social Post · Share Card
                </p>
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
          background: '#6366f1', width: 10, height: 10,
          border: '2px solid #0d0d1a', right: -6, zIndex: 10,
          boxShadow: '0 0 6px #6366f1',
        }}
      />
    </motion.div>
  );
}
