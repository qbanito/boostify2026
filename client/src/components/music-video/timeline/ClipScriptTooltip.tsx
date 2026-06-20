/**
 * ClipScriptTooltip - Tooltip cinematográfico estilo guion profesional
 * Se muestra al hacer hover sobre un clip en el timeline.
 * Incluye: thumbnail, script info, acciones rápidas, estado de generación,
 * navegación entre clips, metadata de video, microcortes, posición en canción.
 * Responsive: se adapta a móvil y PC.
 */
import React, { useRef, useLayoutEffect, useState } from 'react';
import { TimelineClip, getImageUrl } from '../../../interfaces/timeline';
import { generateClipScript } from '../../../lib/services/director-ai-service';
import type { DirectorProfile } from '../../../data/directors/director-schema';
import {
  Film, Camera, Clock, Lightbulb, Clapperboard, MessageSquare, Mic,
  Pencil, RefreshCw, Video, ChevronLeft, ChevronRight, Zap,
  CheckCircle2, Loader2, AlertCircle, Music,
} from 'lucide-react';

interface ClipScriptTooltipProps {
  clip: TimelineClip;
  director?: DirectorProfile;
  clipIndex?: number;
  totalClips?: number;
  songDuration?: number;
  position: { x: number; y: number };
  onOpenChat?: (clip: TimelineClip) => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  // Quick actions
  onEditImage?: (clip: TimelineClip) => void;
  onRegenerateImage?: (clip: TimelineClip) => void;
  onGenerateVideo?: (clip: TimelineClip) => void;
  onCameraAngles?: (clip: TimelineClip) => void;
  // Navigation
  onNavigateClip?: (direction: 'prev' | 'next') => void;
}

const ClipScriptTooltip: React.FC<ClipScriptTooltipProps> = ({
  clip,
  director,
  clipIndex,
  totalClips,
  songDuration,
  position,
  onOpenChat,
  onMouseEnter,
  onMouseLeave,
  onEditImage,
  onRegenerateImage,
  onGenerateVideo,
  onCameraAngles,
  onNavigateClip,
}) => {
  const script = generateClipScript(clip, director, clipIndex);

  // Category badge colors
  const catColor = script.shotCategory === 'PERFORMANCE'
    ? { bg: 'rgba(249,115,22,0.2)', border: '#f97316', text: '#fb923c' }
    : script.shotCategory === 'B-ROLL'
      ? { bg: 'rgba(59,130,246,0.2)', border: '#3b82f6', text: '#60a5fa' }
      : { bg: 'rgba(34,197,94,0.2)', border: '#22c55e', text: '#4ade80' };

  // Ref-based measurement for accurate positioning
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  useLayoutEffect(() => {
    if (tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      setMeasured({ w: rect.width, h: rect.height });
    }
  }, [clip.id, director?.name]);

  const viewW = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const viewH = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isMobile = viewW < 640;
  const tooltipW = isMobile ? Math.min(300, viewW - 24) : 360;
  const tooltipH = measured?.h || 420;
  const pad = 12;

  // Smart positioning strategy:
  // 1. Try placing ABOVE the mouse (clips are typically at the bottom)
  // 2. If not enough space above, try BELOW
  // 3. Clamp to viewport edges so it's always fully visible
  let left = position.x - tooltipW / 2;
  let top: number;

  const spaceAbove = position.y - pad;
  const spaceBelow = viewH - position.y - pad;

  if (spaceAbove >= tooltipH + pad) {
    // Fits above — preferred
    top = position.y - tooltipH - pad;
  } else if (spaceBelow >= tooltipH + pad) {
    // Fits below
    top = position.y + pad;
  } else {
    // Neither fits fully — pin to the side that has more space and align to top/bottom edge
    if (spaceAbove > spaceBelow) {
      top = pad;
    } else {
      top = viewH - tooltipH - pad;
    }
    // Shift tooltip to the right of the cursor so it doesn't cover the clip
    left = position.x + 20;
  }

  // Horizontal clamping — always fully visible
  if (left + tooltipW > viewW - pad) left = viewW - tooltipW - pad;
  if (left < pad) left = pad;
  // Vertical clamping
  if (top < pad) top = pad;
  if (top + tooltipH > viewH - pad) top = Math.max(pad, viewH - tooltipH - pad);

  // Image/video data
  const imageUrl = getImageUrl(clip);
  const hasVideo = !!(clip.metadata?.videoUrl || clip.metadata?.hasVideo || clip.videoUrl);
  const videoModel = clip.metadata?.videoModel || clip.metadata?.model;
  const videoResolution = clip.metadata?.videoResolution || clip.metadata?.resolution;

  // Generation status
  const genStatus = clip.generationStatus || (hasVideo ? 'done' : imageUrl ? 'done' : undefined);

  // MicroCuts info
  const microCuts = clip.metadata?.microCutsEnabled && clip.metadata?.microCutsEffects?.length > 0
    ? clip.metadata.microCutsEffects as string[]
    : null;

  // Song position
  const songDur = songDuration || 1;
  const clipStartPct = (clip.start / songDur) * 100;
  const clipEndPct = ((clip.start + clip.duration) / songDur) * 100;

  // Clip index display
  const sceneNum = clipIndex !== undefined ? clipIndex + 1 : clip.id;
  const totalDisplay = totalClips || 0;

  return (
    <div
      ref={tooltipRef}
      className="cst-root"
      style={{
        position: 'fixed',
        left,
        top,
        width: tooltipW,
        maxHeight: Math.min(520, viewH - 2 * pad),
        zIndex: 100000,
        pointerEvents: 'auto',
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* ===== CONNECTION ARROW (points down toward clip) ===== */}
      <svg
        className="cst-arrow"
        width="16" height="8" viewBox="0 0 16 8"
        style={{
          position: 'absolute',
          bottom: -7,
          left: '50%',
          transform: 'translateX(-50%)',
          filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.4))',
        }}
      >
        <polygon points="0,0 16,0 8,8" fill="rgba(12,12,16,0.98)" stroke="rgba(249,115,22,0.3)" strokeWidth="1" />
      </svg>

      {/* ===== THUMBNAIL + OVERLAY HEADER ===== */}
      <div className="cst-thumb-wrap">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="cst-thumb-img" draggable={false} />
        ) : (
          <div className="cst-thumb-placeholder">
            <Film size={20} style={{ opacity: 0.3 }} />
          </div>
        )}
        {/* Generation Status Badge */}
        <div className="cst-gen-badge" data-status={genStatus || 'none'}>
          {genStatus === 'generating' && <><Loader2 size={10} className="cst-spin" /> Generando...</>}
          {genStatus === 'done' && hasVideo && <><CheckCircle2 size={10} /> Video Listo</>}
          {genStatus === 'done' && !hasVideo && imageUrl && <><CheckCircle2 size={10} /> Imagen</>}
          {genStatus === 'error' && <><AlertCircle size={10} /> Error</>}
          {genStatus === 'pending' && <><Clock size={10} /> Pendiente</>}
        </div>
        {/* Video indicator overlay */}
        {hasVideo && (
          <div className="cst-video-overlay">
            <Video size={14} />
          </div>
        )}
        {/* Scene + Category on thumb */}
        <div className="cst-thumb-top">
          <div className="cst-scene-num">
            <Clapperboard size={9} />
            <span>SCENE {sceneNum}</span>
            {totalDisplay > 0 && <span className="cst-total">/{totalDisplay}</span>}
          </div>
          <div className="cst-cat" style={{ background: catColor.bg, border: `1px solid ${catColor.border}`, color: catColor.text }}>
            {script.shotCategory === 'PERFORMANCE' ? '🎤' : script.shotCategory === 'B-ROLL' ? '🎬' : '📖'}{' '}
            {script.shotCategory}
          </div>
        </div>

        {/* Navigation arrows on thumbnail */}
        {onNavigateClip && (
          <>
            <button
              className="cst-nav cst-nav-prev"
              onMouseDown={(e) => { e.stopPropagation(); onNavigateClip('prev'); }}
              title="Clip anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="cst-nav cst-nav-next"
              onMouseDown={(e) => { e.stopPropagation(); onNavigateClip('next'); }}
              title="Siguiente clip"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>

      {/* ===== SONG POSITION BAR ===== */}
      <div className="cst-song-bar">
        <Music size={8} style={{ color: 'rgba(249,115,22,0.5)', flexShrink: 0 }} />
        <div className="cst-song-track">
          <div className="cst-song-fill" style={{ left: `${clipStartPct}%`, width: `${Math.max(2, clipEndPct - clipStartPct)}%` }} />
        </div>
        <span className="cst-song-time">{clip.start.toFixed(1)}s</span>
      </div>

      {/* ===== QUICK ACTIONS BAR ===== */}
      <div className="cst-actions">
        {onEditImage && (
          <button className="cst-act" title="Editar Imagen" onMouseDown={(e) => { e.stopPropagation(); onEditImage(clip); }}>
            <Pencil size={12} /> <span>Editar</span>
          </button>
        )}
        {onRegenerateImage && (
          <button className="cst-act" title="Regenerar" onMouseDown={(e) => { e.stopPropagation(); onRegenerateImage(clip); }}>
            <RefreshCw size={12} /> <span>Regenerar</span>
          </button>
        )}
        {onGenerateVideo && !hasVideo && imageUrl && (
          <button className="cst-act cst-act-video" title="Generar Video" onMouseDown={(e) => { e.stopPropagation(); onGenerateVideo(clip); }}>
            <Video size={12} /> <span>Video</span>
          </button>
        )}
        {onCameraAngles && script.shotCategory === 'PERFORMANCE' && (
          <button className="cst-act" title="Camera Angles" onMouseDown={(e) => { e.stopPropagation(); onCameraAngles(clip); }}>
            <Camera size={12} /> <span>Angles</span>
          </button>
        )}
      </div>

      {/* ===== SCRIPT BODY ===== */}
      <div className="cst-body">
        {/* Timecode */}
        <div className="cst-row cst-row-tc">
          <Clock size={10} />
          <span className="cst-lbl">TC</span>
          <span className="cst-val cst-mono">{script.timecode}</span>
          <span className="cst-dur">{script.duration}</span>
        </div>
        {/* Shot + Camera */}
        <div className="cst-row">
          <Camera size={10} />
          <span className="cst-lbl">SHOT</span>
          <span className="cst-val">{script.shotType}</span>
          <span className="cst-sep">|</span>
          <span className="cst-val">{script.cameraMovement}</span>
        </div>
        {/* Lens + Lighting */}
        <div className="cst-row">
          <Lightbulb size={10} />
          <span className="cst-lbl">LENS</span>
          <span className="cst-val">{script.lens}</span>
          <span className="cst-sep">|</span>
          <span className="cst-val">{script.lighting}</span>
        </div>
        {/* Transition */}
        <div className="cst-row">
          <Film size={10} />
          <span className="cst-lbl">CUT</span>
          <span className="cst-val">{script.transition}</span>
        </div>

        {/* Video Metadata */}
        {hasVideo && (videoModel || videoResolution) && (
          <>
            <div className="cst-divider" />
            <div className="cst-video-meta">
              <Video size={9} />
              {videoModel && <span className="cst-meta-tag">{videoModel}</span>}
              {videoResolution && <span className="cst-meta-tag">{videoResolution}</span>}
              {clip.duration && <span className="cst-meta-tag">{clip.duration.toFixed(1)}s</span>}
            </div>
          </>
        )}

        {/* MicroCuts */}
        {microCuts && (
          <>
            <div className="cst-divider" />
            <div className="cst-microcuts">
              <Zap size={9} />
              {microCuts.map((fx, i) => (
                <span key={i} className="cst-fx-tag">{fx}</span>
              ))}
            </div>
          </>
        )}

        <div className="cst-divider" />

        {/* Lyrics */}
        {script.lyrics !== '—' && (
          <div className="cst-lyrics">
            <Mic size={10} />
            <span>"{script.lyrics}"</span>
          </div>
        )}

        {/* Prompt */}
        <div className="cst-prompt">
          <span className="cst-prompt-lbl">INT./EXT. — VISUAL DESCRIPTION</span>
          <p>{script.prompt}</p>
        </div>

        {/* Director notes */}
        {director && (
          <div className="cst-director">
            <span className="cst-dir-lbl">📝 {director.name.toUpperCase()} NOTES:</span>
            <p>{script.directorNotes}</p>
          </div>
        )}
      </div>

      {/* ===== FOOTER ===== */}
      {onOpenChat && director && (
        <div className="cst-footer">
          <button
            className="cst-chat-btn"
            onMouseDown={(e) => { e.stopPropagation(); onOpenChat(clip); }}
          >
            <MessageSquare size={11} />
            <span>Hablar con {director.name}</span>
          </button>
        </div>
      )}

      {/* ===== STYLES ===== */}
      <style>{`
        .cst-root {
          background: linear-gradient(160deg, rgba(18,18,22,0.98), rgba(12,12,16,0.98));
          border: 1px solid rgba(249,115,22,0.3);
          border-radius: 12px;
          backdrop-filter: blur(24px);
          box-shadow: 0 20px 60px rgba(0,0,0,0.7), 0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06);
          font-family: 'Courier New', Courier, monospace;
          animation: cstIn 0.15s cubic-bezier(0.16,1,0.3,1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        @keyframes cstIn {
          from { opacity: 0; transform: scale(0.96) translateY(4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes cstSpin { to { transform: rotate(360deg); } }
        .cst-spin { animation: cstSpin 1s linear infinite; }

        /* ---- Thumbnail ---- */
        .cst-thumb-wrap {
          position: relative;
          width: 100%;
          aspect-ratio: 16/9;
          max-height: 140px;
          overflow: hidden;
          background: #0a0a0e;
          flex-shrink: 0;
        }
        .cst-thumb-img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
        }
        .cst-thumb-placeholder {
          width: 100%; height: 100%;
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.15);
        }
        .cst-thumb-top {
          position: absolute; top: 0; left: 0; right: 0;
          display: flex; align-items: center; justify-content: space-between;
          padding: 6px 8px;
          background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
        }
        .cst-scene-num {
          display: flex; align-items: center; gap: 4px;
          font-size: 10px; font-weight: 800; color: #f97316;
          letter-spacing: 0.06em; text-transform: uppercase;
        }
        .cst-total { color: rgba(255,255,255,0.35); font-weight: 500; }
        .cst-cat {
          font-size: 8px; font-weight: 700; padding: 2px 6px;
          border-radius: 3px; letter-spacing: 0.04em;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        /* Gen status */
        .cst-gen-badge {
          position: absolute; bottom: 6px; left: 8px;
          display: flex; align-items: center; gap: 4px;
          font-size: 9px; font-weight: 600; padding: 2px 7px;
          border-radius: 4px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .cst-gen-badge[data-status="generating"] { background: rgba(168,85,247,0.25); color: #c084fc; border: 1px solid rgba(168,85,247,0.4); }
        .cst-gen-badge[data-status="done"] { background: rgba(34,197,94,0.2); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); }
        .cst-gen-badge[data-status="error"] { background: rgba(239,68,68,0.2); color: #f87171; border: 1px solid rgba(239,68,68,0.3); }
        .cst-gen-badge[data-status="pending"] { background: rgba(234,179,8,0.2); color: #fbbf24; border: 1px solid rgba(234,179,8,0.3); }
        .cst-gen-badge[data-status="none"] { display: none; }

        /* Video overlay */
        .cst-video-overlay {
          position: absolute; bottom: 6px; right: 8px;
          display: flex; align-items: center; justify-content: center;
          width: 26px; height: 26px; border-radius: 50%;
          background: rgba(249,115,22,0.85); color: white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        }

        /* Nav arrows */
        .cst-nav {
          position: absolute; top: 50%; transform: translateY(-50%);
          width: 28px; height: 28px; border-radius: 50%;
          background: rgba(0,0,0,0.5); color: rgba(255,255,255,0.7);
          border: 1px solid rgba(255,255,255,0.15);
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; opacity: 0; transition: opacity 0.15s, background 0.15s;
          backdrop-filter: blur(4px);
        }
        .cst-root:hover .cst-nav { opacity: 1; }
        .cst-nav:hover { background: rgba(249,115,22,0.6); color: white; border-color: rgba(249,115,22,0.8); }
        .cst-nav-prev { left: 6px; }
        .cst-nav-next { right: 6px; }

        /* ---- Song position bar ---- */
        .cst-song-bar {
          display: flex; align-items: center; gap: 6px;
          padding: 4px 10px;
          background: rgba(0,0,0,0.25);
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .cst-song-track {
          flex: 1; height: 3px; border-radius: 2px;
          background: rgba(255,255,255,0.08); position: relative; overflow: hidden;
        }
        .cst-song-fill {
          position: absolute; top: 0; bottom: 0; border-radius: 2px;
          background: linear-gradient(90deg, #f97316, #fb923c);
        }
        .cst-song-time {
          font-size: 8px; color: rgba(255,255,255,0.35);
          font-variant-numeric: tabular-nums; min-width: 28px; text-align: right;
        }

        /* ---- Quick actions ---- */
        .cst-actions {
          display: flex; gap: 3px; padding: 5px 8px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          flex-wrap: wrap;
        }
        .cst-act {
          display: flex; align-items: center; gap: 4px;
          padding: 3px 8px; border-radius: 5px;
          font-size: 10px; font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.65);
          border: 1px solid rgba(255,255,255,0.08);
          cursor: pointer; transition: all 0.12s;
          white-space: nowrap;
        }
        .cst-act:hover { background: rgba(249,115,22,0.15); color: #fb923c; border-color: rgba(249,115,22,0.3); }
        .cst-act-video { background: rgba(59,130,246,0.1); color: #60a5fa; border-color: rgba(59,130,246,0.2); }
        .cst-act-video:hover { background: rgba(59,130,246,0.2); color: #93c5fd; border-color: rgba(59,130,246,0.4); }

        /* ---- Script body ---- */
        .cst-body {
          padding: 8px 10px;
          display: flex; flex-direction: column; gap: 4px;
          overflow-y: auto; max-height: 240px;
          flex: 1; min-height: 0;
        }
        .cst-row {
          display: flex; align-items: center; gap: 5px;
          font-size: 10px; color: rgba(255,255,255,0.7);
        }
        .cst-row svg { color: rgba(249,115,22,0.6); flex-shrink: 0; }
        .cst-row-tc { padding-bottom: 3px; border-bottom: 1px dashed rgba(255,255,255,0.06); }
        .cst-lbl {
          font-size: 8px; font-weight: 800; color: rgba(255,255,255,0.3);
          letter-spacing: 0.1em; min-width: 30px; text-transform: uppercase;
        }
        .cst-val { color: rgba(255,255,255,0.85); font-weight: 600; }
        .cst-mono { font-variant-numeric: tabular-nums; }
        .cst-dur {
          margin-left: auto; font-size: 9px; font-weight: 700; color: #f97316;
          background: rgba(249,115,22,0.12); padding: 1px 5px; border-radius: 3px;
        }
        .cst-sep { color: rgba(255,255,255,0.15); margin: 0 1px; }
        .cst-divider {
          height: 1px; margin: 3px 0;
          background: linear-gradient(90deg, transparent, rgba(249,115,22,0.15), transparent);
        }

        /* Video metadata */
        .cst-video-meta {
          display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .cst-video-meta svg { color: rgba(59,130,246,0.6); }
        .cst-meta-tag {
          font-size: 8px; font-weight: 600; padding: 1px 5px;
          border-radius: 3px; background: rgba(59,130,246,0.1);
          color: #60a5fa; border: 1px solid rgba(59,130,246,0.15);
        }

        /* MicroCuts */
        .cst-microcuts {
          display: flex; align-items: center; gap: 4px; flex-wrap: wrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }
        .cst-microcuts svg { color: rgba(234,179,8,0.7); }
        .cst-fx-tag {
          font-size: 8px; font-weight: 700; padding: 1px 5px;
          border-radius: 3px; background: rgba(234,179,8,0.12);
          color: #fbbf24; border: 1px solid rgba(234,179,8,0.2);
          text-transform: uppercase; letter-spacing: 0.03em;
        }

        /* Lyrics */
        .cst-lyrics {
          display: flex; align-items: flex-start; gap: 5px;
          font-size: 10px; font-style: italic; color: rgba(168,85,247,0.9);
          padding: 5px 7px; background: rgba(168,85,247,0.06);
          border-left: 2px solid rgba(168,85,247,0.3);
          border-radius: 0 4px 4px 0; line-height: 1.35;
        }
        .cst-lyrics svg { color: rgba(168,85,247,0.5); flex-shrink: 0; margin-top: 1px; }

        /* Prompt */
        .cst-prompt { font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.35; }
        .cst-prompt-lbl {
          display: block; font-size: 8px; font-weight: 800;
          color: rgba(255,255,255,0.25); letter-spacing: 0.08em;
          text-transform: uppercase; margin-bottom: 2px;
        }
        .cst-prompt p { margin: 0; max-height: 40px; overflow-y: auto; }

        /* Director notes */
        .cst-director {
          padding: 5px 7px; background: rgba(249,115,22,0.04);
          border-left: 2px solid rgba(249,115,22,0.2);
          border-radius: 0 4px 4px 0; font-size: 9px;
          color: rgba(255,255,255,0.5); line-height: 1.35;
        }
        .cst-dir-lbl {
          display: block; font-size: 8px; font-weight: 800;
          color: rgba(249,115,22,0.6); letter-spacing: 0.06em; margin-bottom: 2px;
        }
        .cst-director p { margin: 0; }

        /* ---- Footer ---- */
        .cst-footer {
          padding: 6px 10px;
          border-top: 1px solid rgba(255,255,255,0.06);
          background: rgba(0,0,0,0.2);
        }
        .cst-chat-btn {
          display: flex; align-items: center; gap: 5px; width: 100%;
          padding: 5px 9px; border: 1px solid rgba(249,115,22,0.25);
          border-radius: 6px; background: rgba(249,115,22,0.08);
          color: #fb923c; font-size: 10px; font-weight: 600;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          cursor: pointer; transition: all 0.15s;
        }
        .cst-chat-btn:hover {
          background: rgba(249,115,22,0.18); border-color: rgba(249,115,22,0.5); color: #f97316;
        }

        /* ---- Mobile responsive ---- */
        @media (max-width: 639px) {
          .cst-thumb-wrap { max-height: 100px; }
          .cst-act span { display: none; }
          .cst-act { padding: 4px 6px; }
          .cst-body { padding: 6px 8px; max-height: 180px; }
          .cst-row { font-size: 9px; gap: 4px; }
          .cst-lbl { font-size: 7px; min-width: 24px; }
          .cst-dur { font-size: 8px; padding: 1px 4px; }
          .cst-lyrics { font-size: 9px; padding: 4px 6px; }
          .cst-prompt { font-size: 8px; }
          .cst-prompt p { max-height: 32px; }
          .cst-song-bar { padding: 3px 8px; }
          .cst-nav { width: 24px; height: 24px; }
          .cst-footer { padding: 5px 8px; }
          .cst-chat-btn { font-size: 9px; padding: 4px 7px; }
        }
      `}</style>
    </div>
  );
};

export default ClipScriptTooltip;
