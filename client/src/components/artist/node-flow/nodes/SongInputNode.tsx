/**
 * BOOSTIFY NODE FLOW — SongInputNode
 *
 * Two modes:
 *  - "select": uses an existing songId (classic behavior)
 *  - "generate": AI song generation from a prompt via POST /api/music/generate
 *    Polls GET /api/music/status?taskId= until done.
 *    Result (title, audioUrl) flows to downstream nodes (promoClip, karaoke…).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music2,
  Wand2,
  List,
  Loader2,
  CheckCircle2,
  XCircle,
  CircleDot,
  Play,
  Mic2,
  Sparkles,
  Timer,
} from 'lucide-react';
import type { NodeFlowData, NodeStatus } from '../useFlowStore';
import { useFlowStore } from '../useFlowStore';

// ─── Models ──────────────────────────────────────────────────────────────────

const MODELS = [
  { id: 'music-s',      label: 'Suno v3',   badge: '🎵', color: '#a855f7' },
  { id: 'music-u',      label: 'Udio',      badge: '🎧', color: '#3b82f6' },
  { id: 'music-lyria3', label: 'Lyria 3',   badge: '✨', color: '#ec4899' },
] as const;

// ─── Generation progress steps ───────────────────────────────────────────────

const GEN_STEPS = [
  { pct: 10, label: 'Iniciando generación musical…',         color: '#3b82f6' },
  { pct: 25, label: 'Analizando prompt y parámetros…',       color: '#8b5cf6' },
  { pct: 45, label: 'Componiendo estructura musical…',        color: '#a855f7' },
  { pct: 65, label: 'Generando melodía y arreglos…',         color: '#ec4899' },
  { pct: 80, label: 'Mezclando audio y masterizando…',       color: '#f59e0b' },
  { pct: 92, label: 'Procesando audio final…',               color: '#10b981' },
];

// ─── Animation CSS ────────────────────────────────────────────────────────────

let _injected = false;
function injectAnim() {
  if (_injected || typeof document === 'undefined') return;
  _injected = true;
  const s = document.createElement('style');
  s.textContent = `
    @keyframes songRingRotate { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    @keyframes songGlowPulse  { 0%,100%{opacity:.85} 50%{opacity:.4} }
    @keyframes songScan       { 0%{left:-40%} 100%{left:120%} }
    @keyframes songWave       { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
  `;
  document.head.appendChild(s);
}

// ─── Animated border ring (running = amber, done = green, error = red) ────────

const RING_CFG: Record<NodeStatus, { active: boolean; color: string; glow: string; speed: string }> = {
  idle:    { active: false, color: '',        glow: '',                      speed: '0s' },
  running: { active: true,  color: '#fbbf24', glow: 'rgba(251,191,36,0.7)', speed: '1.6s' },
  done:    { active: true,  color: '#22c55e', glow: 'rgba(34,197,94,0.7)',  speed: '2.4s' },
  error:   { active: true,  color: '#ef4444', glow: 'rgba(239,68,68,0.75)', speed: '0.9s' },
};

function BorderRing({ color, glow, speed }: { color: string; glow: string; speed: string }) {
  injectAnim();
  return (
    <>
      <div style={{ position: 'absolute', inset: -4, borderRadius: 16, boxShadow: `0 0 18px 4px ${glow},0 0 36px 8px ${glow}40`, pointerEvents: 'none', zIndex: 0, animation: `songGlowPulse ${speed} ease-in-out infinite` }} />
      <div style={{ position: 'absolute', inset: -2, borderRadius: 14, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
        <div style={{ position: 'absolute', width: '200%', height: '200%', top: '-50%', left: '-50%', background: `conic-gradient(from 0deg,transparent 0deg,transparent 240deg,${color}cc 300deg,${color} 340deg,${color}cc 360deg)`, animation: `songRingRotate ${speed} linear infinite`, transformOrigin: '50% 50%' }} />
        <div style={{ position: 'absolute', inset: 2, borderRadius: 12, background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)' }} />
      </div>
    </>
  );
}

// ─── Sound-wave animation (shown when audio is ready) ─────────────────────────

function SoundWave({ color }: { color: string }) {
  injectAnim();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: 14 }}>
      {[1, 2, 3, 4, 3].map((h, i) => (
        <div key={i} style={{
          width: 2, height: h * 3, borderRadius: 1, background: color,
          animation: `songWave 1s ease-in-out infinite`,
          animationDelay: `${i * 0.12}s`,
        }} />
      ))}
    </div>
  );
}

// ─── Pill ─────────────────────────────────────────────────────────────────────

function Pill({ active, onClick, children, color = '#3b82f6' }: {
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

export function SongInputNode(props: NodeProps<NodeFlowData>) {
  const { id: nodeId, selected, data } = props;
  const updateNodeData = useFlowStore(s => s.updateNodeData);

  // Node data fields
  const mode              = (data.songMode as 'select' | 'generate') || 'select';
  const status            = (data.status   as NodeStatus) || 'idle';
  const generatedSong     = (data.generatedSong as any) || null;

  // Generation config
  const genPrompt         = (data.genPrompt         as string) || '';
  const genTitle          = (data.genTitle          as string) || '';
  const genModel          = (data.genModel          as string) || 'music-s';
  const genTags           = (data.genTags           as string) || '';
  const genTempo          = (data.genTempo          as string) || '';
  const genInstrumental   = !!(data.genInstrumental as boolean);

  // Local state
  const [isGenerating, setIsGenerating] = useState(false);
  const [genPct,       setGenPct]       = useState(0);
  const [genStep,      setGenStep]      = useState(GEN_STEPS[0]);
  const [taskId,       setTaskId]       = useState<string | null>(null);
  const [genError,     setGenError]     = useState<string | null>(null);

  const pollRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopTimers = useCallback(() => {
    if (pollRef.current)   { clearInterval(pollRef.current);   pollRef.current   = null; }
    if (fakeTimer.current) { clearInterval(fakeTimer.current); fakeTimer.current = null; }
  }, []);

  // Setters
  const set = useCallback((field: string, value: unknown) => {
    updateNodeData(nodeId, { [field]: value });
  }, [nodeId, updateNodeData]);

  // ── Polling: check /api/music/status?taskId= ──────────────────────────────

  const startPolling = useCallback((tid: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/music/status?taskId=${encodeURIComponent(tid)}`);
        if (!res.ok) return;
        const data = await res.json() as any;

        if (data.status === 'completed' || data.status === 'done') {
          stopTimers();
          setIsGenerating(false);
          setGenPct(100);
          const song = {
            taskId: tid,
            title:    data.title    || data.song?.title    || genTitle || 'AI Song',
            audioUrl: data.audioUrl || data.song?.audioUrl || data.url  || '',
            coverArt: data.coverArt || data.song?.coverArt || '',
            songId:   data.songId   || data.id             || null,
          };
          set('generatedSong', song);
          set('status', 'done');
          set('output',  { songId: song.songId, title: song.title, audioUrl: song.audioUrl, coverArt: song.coverArt });
        } else if (data.status === 'failed' || data.status === 'error') {
          stopTimers();
          setIsGenerating(false);
          setGenError(data.error || 'Generation failed');
          set('status', 'error');
        }
        // else still processing — keep polling
      } catch (e) {
        // transient network error — keep polling
      }
    }, 3500);
  }, [genTitle, set, stopTimers]);

  // ── Fake progress bar while waiting for poll completion ───────────────────

  const startFakeProgress = useCallback(() => {
    let idx = 0;
    fakeTimer.current = setInterval(() => {
      idx = Math.min(idx + 1, GEN_STEPS.length - 1);
      setGenStep(GEN_STEPS[idx]);
      setGenPct(GEN_STEPS[idx].pct);
      if (idx >= GEN_STEPS.length - 1) {
        if (fakeTimer.current) clearInterval(fakeTimer.current);
      }
    }, 5000);
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
    set('generatedSong', null);

    try {
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          prompt:           genPrompt,
          title:            genTitle || undefined,
          model:            genModel,
          tags:             genTags  || undefined,
          makeInstrumental: genInstrumental,
          tempo:            genTempo || undefined,
        }),
      });

      const body = await res.json() as any;
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);

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
  }, [genPrompt, genTitle, genModel, genTags, genInstrumental, genTempo, set, startPolling, startFakeProgress, stopTimers]);

  // Cleanup on unmount
  useEffect(() => () => stopTimers(), [stopTimers]);

  // ── Derived ───────────────────────────────────────────────────────────────

  const ring      = RING_CFG[status];
  const currentModel = MODELS.find(m => m.id === genModel) ?? MODELS[0];
  const accentColor  = status === 'running' ? '#fbbf24' : status === 'done' ? '#22c55e' : status === 'error' ? '#ef4444' : '#3b82f6';
  const showProgress = isGenerating || (status === 'running');
  const songReady    = !!generatedSong?.audioUrl;

  return (
    <motion.div
      initial={{ scale: 0.92, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      style={{ position: 'relative', width: 280 }}
    >
      {ring.active && <BorderRing color={ring.color} glow={ring.glow} speed={ring.speed} />}

      {/* Card */}
      <div style={{
        background: 'linear-gradient(135deg,#0d0d1a 0%,#111827 100%)',
        border: `1px solid ${selected ? '#3b82f6' : accentColor + '40'}`,
        borderRadius: 12, overflow: 'hidden',
        boxShadow: selected ? '0 0 14px rgba(59,130,246,0.35)' : 'none',
        position: 'relative', zIndex: 2,
      }}>

        {/* ── Header ── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: '9px 12px 8px',
          background: 'rgba(59,130,246,0.08)',
          borderBottom: '1px solid rgba(59,130,246,0.15)',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: 'rgba(59,130,246,0.18)', border: '1px solid rgba(59,130,246,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Music2 size={14} style={{ color: '#60a5fa' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#e2e8f0', letterSpacing: '0.04em' }}>
              SONG INPUT
            </div>
            <div style={{ fontSize: 9, color: '#64748b', marginTop: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              {mode === 'generate'
                ? <><span style={{ color: currentModel.color, fontWeight: 700 }}>{currentModel.badge}</span> {currentModel.label} · AI</>
                : <>📋 Canción seleccionada</>}
            </div>
          </div>
          {/* Status icon */}
          {status === 'idle'    && <CircleDot size={13} style={{ color: '#475569' }} />}
          {status === 'running' && <Loader2 size={13} style={{ color: '#fbbf24', animation: 'spin 1s linear infinite' }} />}
          {status === 'done'    && <CheckCircle2 size={13} style={{ color: '#22c55e' }} />}
          {status === 'error'   && <XCircle size={13} style={{ color: '#ef4444' }} />}
        </div>

        {/* ── Mode tabs ── */}
        <div style={{ display: 'flex', gap: 4, padding: '8px 12px 6px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {([['select', '📋', 'Seleccionar'], ['generate', '✨', 'Generar IA']] as const).map(([m, icon, label]) => (
            <button
              key={m}
              type="button"
              className="nodrag"
              onClick={() => set('songMode', m)}
              style={{
                flex: 1, padding: '4px 0', borderRadius: 6, fontSize: 10, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s', outline: 'none',
                background: mode === m ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)',
                border: mode === m ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                color: mode === m ? '#60a5fa' : '#475569',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              }}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* ── SELECT mode ── */}
        {mode === 'select' && (
          <div style={{ padding: '8px 12px 10px' }}>
            {data.songId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <Music2 size={10} style={{ color: '#60a5fa', flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: '#93c5fd' }}>Song ID: {String(data.songId)}</span>
              </div>
            ) : (
              <p style={{ fontSize: 10, color: '#475569', fontStyle: 'italic', margin: 0 }}>
                Ninguna canción seleccionada. Conecta desde el inspector o usa el modo Generar IA.
              </p>
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
                onChange={e => set('genTitle', e.target.value)}
                placeholder="Ej: Midnight Drive…"
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                  outline: 'none', fontFamily: 'inherit',
                }}
                onFocus={e => (e.target.style.border = '1px solid rgba(59,130,246,0.5)')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Prompt */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <Wand2 size={9} /> Prompt musical
              </label>
              <textarea
                className="nodrag"
                value={genPrompt}
                onChange={e => set('genPrompt', e.target.value)}
                placeholder="Ej: Dark trap beat, heavy 808 bass, cinematic strings, aggressive energy, perfect for a late night drive…"
                rows={3}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6, padding: '6px 8px', fontSize: 10, color: '#cbd5e1',
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                }}
                onFocus={e => (e.target.style.border = '1px solid rgba(59,130,246,0.5)')}
                onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
              />
            </div>

            {/* Model */}
            <div>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
                <Sparkles size={9} /> Modelo IA
              </label>
              <div style={{ display: 'flex', gap: 4 }}>
                {MODELS.map(m => (
                  <Pill key={m.id} active={genModel === m.id} onClick={() => set('genModel', m.id)} color={m.color}>
                    {m.badge} {m.label}
                  </Pill>
                ))}
              </div>
            </div>

            {/* Tags + Tempo row */}
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 2 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 4 }}>
                  Géneros / Tags
                </label>
                <input
                  className="nodrag"
                  type="text"
                  value={genTags}
                  onChange={e => set('genTags', e.target.value)}
                  placeholder="trap, dark, cinematic"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.target.style.border = '1px solid rgba(59,130,246,0.5)')}
                  onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 3, marginBottom: 4 }}>
                  <Timer size={9} /> BPM
                </label>
                <input
                  className="nodrag"
                  type="text"
                  value={genTempo}
                  onChange={e => set('genTempo', e.target.value)}
                  placeholder="140"
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6, padding: '5px 8px', fontSize: 10, color: '#cbd5e1',
                    outline: 'none', fontFamily: 'inherit',
                  }}
                  onFocus={e => (e.target.style.border = '1px solid rgba(59,130,246,0.5)')}
                  onBlur={e => (e.target.style.border = '1px solid rgba(255,255,255,0.1)')}
                />
              </div>
            </div>

            {/* Instrumental toggle */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ fontSize: 9, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mic2 size={9} /> Instrumental (sin voz)
              </label>
              <button
                type="button"
                className="nodrag"
                onClick={() => set('genInstrumental', !genInstrumental)}
                style={{
                  width: 34, height: 18, borderRadius: 9, cursor: 'pointer', outline: 'none',
                  background: genInstrumental ? '#3b82f6' : 'rgba(255,255,255,0.1)',
                  border: genInstrumental ? '1px solid #60a5fa' : '1px solid rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'all 0.2s',
                }}
              >
                <div style={{
                  width: 12, height: 12, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 2,
                  left: genInstrumental ? 18 : 2,
                  transition: 'left 0.2s',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                }} />
              </button>
            </div>

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
                  : 'linear-gradient(135deg,#2563eb,#7c3aed)',
                border: isGenerating || !genPrompt.trim()
                  ? '1px solid rgba(255,255,255,0.1)'
                  : '1px solid rgba(124,58,237,0.5)',
                color: isGenerating || !genPrompt.trim() ? '#475569' : '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                boxShadow: !isGenerating && genPrompt.trim() ? '0 0 18px rgba(124,58,237,0.3)' : 'none',
              }}
            >
              {isGenerating
                ? <><Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> Generando…</>
                : <><Wand2 size={11} /> Generar Canción</>}
            </button>

          </div>
        )}

        {/* ── Progress bar (generate mode, while generating) ── */}
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
                {/* Progress bar track */}
                <div style={{ height: 4, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden', position: 'relative', marginBottom: 6 }}>
                  <motion.div
                    animate={{ width: `${genPct === 100 ? 100 : genPct}%` }}
                    transition={{ duration: 0.7, ease: 'easeOut' }}
                    style={{
                      height: '100%', borderRadius: 3,
                      background: `linear-gradient(90deg,${genStep.color},#a855f7)`,
                      boxShadow: `0 0 6px ${genStep.color}80`,
                    }}
                  />
                  {/* Scan shine */}
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '40%',
                    background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.3),transparent)',
                    animation: 'songScan 1.8s linear infinite',
                  }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, color: genStep.color, fontWeight: 700, flex: 1, marginRight: 6 }}>
                    {genStep.label}
                  </span>
                  <span style={{ fontSize: 9, color: '#475569', fontWeight: 700, flexShrink: 0 }}>{genPct}%</span>
                </div>

                {taskId && (
                  <p style={{ fontSize: 8, color: '#334155', marginTop: 4, margin: '4px 0 0' }}>
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

        {/* ── Generated song result ── */}
        <AnimatePresence>
          {mode === 'generate' && songReady && (
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <CheckCircle2 size={10} style={{ color: '#22c55e', flexShrink: 0 }} />
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#4ade80' }}>
                      {generatedSong.title || 'Song Ready'}
                    </span>
                  </div>
                  <SoundWave color="#22c55e" />
                </div>
                {generatedSong.audioUrl && (
                  <a
                    href={generatedSong.audioUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nodrag"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 9, color: '#6ee7b7', textDecoration: 'none',
                      padding: '3px 7px', borderRadius: 4,
                      background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)',
                      transition: 'all 0.15s',
                    }}
                  >
                    <Play size={8} /> Escuchar audio
                  </a>
                )}
                <p style={{ fontSize: 8, color: '#334155', marginTop: 4, margin: '4px 0 0' }}>
                  ✓ Listo para conectar a PromoClip · Karaoke · Social
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
          background: '#3b82f6', width: 10, height: 10,
          border: '2px solid #0d0d1a', right: -6, zIndex: 10,
          boxShadow: '0 0 6px #3b82f6',
        }}
      />
    </motion.div>
  );
}

