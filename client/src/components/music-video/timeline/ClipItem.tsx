/**
 * Componente ClipItem para el editor de timeline
 * Representa un clip individual en la línea de tiempo
 * 
 * BOOSTIFY 2025 - Menú contextual de acciones (clic derecho):
 * - Edit Image (Nano Banana AI)
 * - Add Musician
 * - Camera Angles
 * - Regenerar Imagen
 * - Generar Video
 */
import React, { MouseEvent, useState, useEffect, useLayoutEffect, useRef, useCallback, useContext } from 'react';
import { createPortal } from 'react-dom';
import { ClipType, TimelineClip } from '../../../interfaces/timeline';
import { PortalContainerContext } from '../../../contexts/portal-container-context';
import { extractWaveformPeaks } from '../../../lib/audio-waveform';
import { 
  Pencil, Guitar, Camera, RefreshCw, Video as VideoIcon, Sparkles, X,
  Maximize, Minimize2, RectangleHorizontal, Layers,
  Heart, Shuffle, ArrowUpCircle, Palette, Copy, Download, Trash2, Music
} from 'lucide-react';

// Props para acciones sobre el clip
interface ClipActionProps {
  onEditImage?: (clip: TimelineClip) => void;
  onAddMusician?: (clip: TimelineClip) => void;
  onCameraAngles?: (clip: TimelineClip) => void;
  onRegenerateImage?: (clip: TimelineClip) => void;
  onGenerateVideo?: (clip: TimelineClip) => void;
  onUseAsReference?: (clip: TimelineClip) => void;
  onUseAsStyle?: (clip: TimelineClip) => void;
  onVariations?: (clip: TimelineClip) => void;
  onUpscale?: (clip: TimelineClip) => void;
  onLike?: (clip: TimelineClip) => void;
  onChoreography?: (clip: TimelineClip) => void;
  onDeleteClip?: (clipId: number) => void;
}

type Tool = 'select' | 'razor' | 'trim' | 'hand';

const CLIP_TYPE_COLORS: Record<ClipType, string> = {
  [ClipType.VIDEO]: '#5E35B1',
  [ClipType.IMAGE]: '#43A047',
  [ClipType.AUDIO]: '#FB8C00',
  [ClipType.TEXT]: '#F4511E',
  [ClipType.EFFECT]: '#8E24AA',
  [ClipType.GENERATED_IMAGE]: '#D81B60',
  [ClipType.TRANSITION]: '#546E7A',
  [ClipType.PLACEHOLDER]: '#64748b',
};

interface ClipItemProps extends ClipActionProps {
  clip: TimelineClip;
  timeScale: number;
  isSelected: boolean;
  tool?: Tool;
  onSelect: (clipId: number) => void;
  onMoveStart: (clipId: number, e: MouseEvent) => void;
  onResizeStart: (clipId: number, direction: 'start' | 'end', e: MouseEvent) => void;
  onRazorClick?: (clipId: number, time: number) => void;
  onUpdateImageFit?: (clipId: number, fit: string) => void;
  isDragging: boolean;
  isResizing: boolean;
  /** Real waveform peaks (0-1 normalized) extracted from audio — renders accurate visualization */
  waveformPeaks?: number[];
  /** Hover tooltip: callback to show/hide script tooltip */
  onHoverStart?: (clip: TimelineClip, position: { x: number; y: number }) => void;
  onHoverEnd?: () => void;
  /** Clip index in the image layer for scene numbering */
  clipIndex?: number;
}

/**
 * Obtiene la URL de imagen del clip buscando en todos los campos posibles
 */
const getClipImageUrl = (clip: TimelineClip): string | null => {
  return clip.imageUrl || clip.thumbnailUrl || clip.url || 
         (typeof clip.generatedImage === 'string' ? clip.generatedImage : null) ||
         clip.image_url || clip.publicUrl || clip.firebaseUrl || null;
};

/**
 * Clip individual en el timeline con botones de acción
 */
const ClipItem: React.FC<ClipItemProps> = ({
  clip,
  timeScale,
  isSelected,
  tool = 'select',
  onSelect,
  onMoveStart,
  onResizeStart,
  onRazorClick,
  onUpdateImageFit,
  isDragging,
  isResizing,
  waveformPeaks,
  onHoverStart,
  onHoverEnd,
  clipIndex,
  // Acciones
  onEditImage,
  onAddMusician,
  onCameraAngles,
  onRegenerateImage,
  onGenerateVideo,
  onUseAsReference,
  onUseAsStyle,
  onVariations,
  onUpscale,
  onLike,
  onChoreography,
  onDeleteClip,
}) => {
  // Portal container context — renders inside fullscreen container when active
  const portalContainer = useContext(PortalContainerContext);
  
  // Estado para el menú contextual - usar coordenadas de pantalla
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number }>({
    visible: false,
    x: 0,
    y: 0,
  });
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Detectar tipo de clip
  const isAudioClip = clip.type === 'AUDIO' || clip.layerId === 2;
  
  // 🔊 Auto-extract real waveform peaks from audio URL
  const [extractedPeaks, setExtractedPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    if (!isAudioClip || !clip.url) return;
    let cancelled = false;
    extractWaveformPeaks(clip.url, 200).then(peaks => {
      if (!cancelled) setExtractedPeaks(peaks);
    });
    return () => { cancelled = true; };
  }, [isAudioClip, clip.url]);
  
  // Use passed peaks or self-extracted
  const resolvedPeaks = waveformPeaks || extractedPeaks;
  
  // 🎬 Extract filmstrip thumbnails from imported video clips
  // Generates multiple frames for professional NLE filmstrip view
  const [videoThumbnails, setVideoThumbnails] = useState<string[]>([]);
  const [videoThumbnail, setVideoThumbnail] = useState<string | null>(null);
  const isVideoClip = clip.type === 'VIDEO';
  useEffect(() => {
    if (!isVideoClip || !clip.url) return;
    // Already have a dedicated thumbnailUrl or imageUrl — skip extraction
    if (clip.thumbnailUrl || clip.imageUrl) return;
    let cancelled = false;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';
    
    const frames: string[] = [];
    const MAX_FRAMES = 12; // Up to 12 filmstrip frames
    let totalDur = 0;
    let seekIdx = 0;
    
    video.onloadedmetadata = () => {
      totalDur = video.duration || 6;
      const numFrames = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(totalDur / 1))); // 1 frame per second max
      seekIdx = 0;
      // Seek to first frame
      video.currentTime = Math.min(0.1, totalDur * 0.05);
    };
    
    video.onseeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          frames.push(dataUrl);
          
          // Set first frame as single thumbnail immediately
          if (frames.length === 1) {
            setVideoThumbnail(dataUrl);
          }
          
          // Seek to next frame
          seekIdx++;
          const numFrames = Math.min(MAX_FRAMES, Math.max(1, Math.ceil(totalDur / 1)));
          if (seekIdx < numFrames && !cancelled) {
            const nextTime = (seekIdx / numFrames) * totalDur;
            video.currentTime = Math.min(nextTime, totalDur - 0.01);
          } else {
            // All frames extracted
            if (!cancelled) setVideoThumbnails([...frames]);
          }
        }
      } catch { 
        // CORS or other error — stop extraction
        if (frames.length > 0 && !cancelled) setVideoThumbnails([...frames]);
      }
    };
    video.onerror = () => {};
    video.src = clip.url;
    return () => { cancelled = true; };
  }, [isVideoClip, clip.url, clip.thumbnailUrl, clip.imageUrl]);

  // Obtener URL de imagen si existe
  const rawImageUrl = getClipImageUrl(clip);
  // For video clips, prefer extracted thumbnail over blob video URL
  const imageUrl = isVideoClip ? (videoThumbnail || clip.thumbnailUrl || clip.imageUrl || null) : rawImageUrl;
  // hasImage: verificar todos los tipos que pueden tener imagen
  const hasImage = !isAudioClip && !!imageUrl && (
    clip.type === 'IMAGE' || 
    clip.type === 'VIDEO' || 
    clip.type === 'GENERATED_IMAGE' ||
    clip.generatedImage ||
    clip.layerId === 1 // Capa 1 siempre son imágenes generadas
  );
  const isImageClip = clip.type === 'IMAGE' || clip.type === 'GENERATED_IMAGE' || hasImage;
  const musicianType = (clip.metadata as any)?.musicianData?.musicianType as string | undefined;
  const hasMusician = Boolean((clip.metadata as any)?.musicianIntegrated && musicianType);

  // Calcular ancho mínimo para mostrar botones
  const clipWidth = clip.duration * timeScale;
  
  // Cerrar menú al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };
    
    if (contextMenu.visible) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu.visible]);
  
  // Handler para menú contextual (clic derecho)
  const handleContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isImageClip) return;
    
    // Dismiss hover tooltip immediately so they never overlap
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    onHoverEnd?.();
    
    // Store raw click position — actual repositioning happens in useLayoutEffect
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    onSelect(clip.id);
  };

  // After render, measure the menu and reposition to keep it fully on-screen
  useLayoutEffect(() => {
    if (!contextMenu.visible || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pad = 12;
    let x = contextMenu.x;
    let y = contextMenu.y;

    // Prefer opening ABOVE the click point (clips are at the bottom of screen)
    if (y - rect.height - pad > pad) {
      y = y - rect.height - pad;
    } else if (y + rect.height + pad > vh - pad) {
      // If it doesn't fit below either, clamp to top
      y = Math.max(pad, vh - rect.height - pad);
    }

    // Horizontal: keep within viewport
    if (x + rect.width > vw - pad) x = vw - rect.width - pad;
    if (x < pad) x = pad;

    // Only update if position changed to avoid infinite loop
    if (Math.abs(menuRef.current.offsetLeft - x) > 1 || Math.abs(menuRef.current.offsetTop - y) > 1) {
      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y]);
  
  // Cerrar menú
  const closeContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0 });
  };

  // Color específico para audio con patrón de onda
  const audioClipColor = '#3b82f6'; // Azul para audio
  
  // Determinar cursor basado en la herramienta seleccionada
  const getCursor = (): string => {
    if (isDragging) return 'grabbing';
    if (isResizing) return 'ew-resize';
    switch (tool) {
      case 'razor':
        return 'crosshair'; // Cursor de corte
      case 'trim':
        return 'ew-resize'; // Cursor de redimensión
      case 'hand':
        return 'grab'; // Cursor de mano para mover
      case 'select':
      default:
        return 'grab'; // Cambiado a grab para indicar que se puede arrastrar
    }
  };

  // Calcula el estilo del clip basado en su posición y duración
  // For video clips with filmstrip, don't use backgroundImage (filmstrip div handles it)
  const hasFilmstrip = isVideoClip && videoThumbnails.length > 0;
  const clipStyle: React.CSSProperties = {
    left: `${clip.start * timeScale}px`,
    width: `${clipWidth}px`,
    backgroundColor: isAudioClip 
      ? audioClipColor 
      : hasFilmstrip
        ? '#1a1a2e' // Dark bg behind filmstrip
        : hasImage 
          ? 'transparent' 
          : (clip.color || CLIP_TYPE_COLORS[clip.type] || '#64748b'),
    opacity: clip.opacity !== undefined ? clip.opacity : 1,
    cursor: getCursor(),
    backgroundImage: (hasImage && !hasFilmstrip) ? `url(${imageUrl})` : 'none',
    backgroundSize: (clip.metadata?.imageFit as string) || 'cover',
    backgroundPosition: 'center',
    transition: 'background-image 0.4s ease-in-out, background-color 0.3s ease',
  };

  // Ref para el clip container
  const clipRef = useRef<HTMLDivElement>(null);

  // Hover tooltip — delay before showing for smooth UX
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleMouseEnter = useCallback((e: React.MouseEvent) => {
    if (!onHoverStart || isAudioClip || isDragging || isResizing || contextMenu.visible) return;
    // Capture coordinates eagerly — event may be recycled by the time timeout fires
    const x = e.clientX;
    const y = e.clientY;
    hoverTimerRef.current = setTimeout(() => {
      onHoverStart(clip, { x, y });
    }, 400);
  }, [onHoverStart, clip, isAudioClip, isDragging, isResizing, contextMenu.visible]);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    onHoverEnd?.();
  }, [onHoverEnd]);

  // Clean up hover timer on unmount
  useEffect(() => {
    return () => { if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current); };
  }, []);

  // Handler para click según la herramienta activa
  const handleClipClick = (e: MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    
    // Si estamos arrastrando o redimensionando, ignorar
    if (isDragging || isResizing) {
      return;
    }
    
    // Si es la herramienta cuchilla/razor
    if (tool === 'razor' && onRazorClick) {
      // Usar el ref del clip para obtener el rect correctamente
      const clipElement = clipRef.current;
      if (!clipElement) {
        return;
      }
      
      const rect = clipElement.getBoundingClientRect();
      const clickX = e.clientX - rect.left; // Posición X relativa al clip
      const clickTime = clip.start + (clickX / timeScale); // Tiempo global donde se hizo click
      
      // Verificar que el click está dentro del clip
      if (clickTime > clip.start && clickTime < clip.start + clip.duration) {
        onRazorClick(clip.id, clickTime);
      }
      return;
    }
    
    // Para otras herramientas, solo seleccionar
    onSelect(clip.id);
  };

  // Maneja el inicio del redimensionamiento
  const handleResizeStart = (direction: 'start' | 'end', e: MouseEvent) => {
    // Si es herramienta razor, no permitir resize
    if (tool === 'razor') {
      return;
    }
    
    // Seleccionar el clip primero
    onSelect(clip.id);
    // Luego iniciar el resize
    onResizeStart(clip.id, direction, e);
  };

  const formatDuration = (seconds: number): string => {
    return `${seconds.toFixed(1)}s`;
  };

  // Handler para botones de acción
  const handleActionClick = (e: MouseEvent, action?: (clip: TimelineClip) => void) => {
    e.stopPropagation();
    e.preventDefault();
    closeContextMenu();
    if (action) action(clip);
  };

  return (
    <div
      ref={clipRef}
      data-clip-id={clip.id}
      className={`clip-item ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''} ${isAudioClip ? 'audio-clip' : ''} tool-${tool}`}
      style={clipStyle}
      onContextMenu={handleContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={(e) => {
        // Ignorar si el click fue en un resize handle (ya tienen su propio handler)
        const target = e.target as HTMLElement;
        if (target.closest('.resize-handle')) {
          return;
        }
        
        e.stopPropagation();
        e.preventDefault();
        
        // Seleccionar el clip siempre
        onSelect(clip.id);
        
        // Si es herramienta razor, no iniciar drag (esperar click)
        if (tool === 'razor') {
          return;
        }
        
        // Si es herramienta trim, no iniciar drag desde el body del clip
        if (tool === 'trim') {
          return;
        }
        
        // Para select y hand: iniciar drag inmediatamente
        onMoveStart(clip.id, e);
      }}
      onClick={handleClipClick}
    >
      {/* Overlay oscuro para legibilidad del texto sobre imagen */}
      {hasImage && !isVideoClip && (
        <div className="clip-image-overlay" />
      )}
      
      {/* 🎬 PLACEHOLDER: Visual para clips sin imagen generada aún */}
      {!hasImage && !isAudioClip && clip.layerId === 1 && (
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none z-0"
          style={{
            background: clip.shotCategory === 'PERFORMANCE' 
              ? 'linear-gradient(135deg, rgba(249,115,22,0.35), rgba(234,88,12,0.2))'
              : clip.shotCategory === 'B-ROLL'
                ? 'linear-gradient(135deg, rgba(59,130,246,0.35), rgba(37,99,235,0.2))'
                : 'linear-gradient(135deg, rgba(34,197,94,0.35), rgba(22,163,74,0.2))',
            borderLeft: clip.shotCategory === 'PERFORMANCE' 
              ? '3px solid rgba(249,115,22,0.7)' 
              : clip.shotCategory === 'B-ROLL'
                ? '3px solid rgba(59,130,246,0.7)'
                : '3px solid rgba(34,197,94,0.7)',
          }}
        >
          {/* Animated border for generating state */}
          {clip.generationStatus === 'generating' && (
            <div 
              className="absolute inset-0 pointer-events-none"
              style={{
                border: '2px solid transparent',
                borderImage: 'linear-gradient(90deg, rgba(168,85,247,0.8), rgba(59,130,246,0.8), rgba(168,85,247,0.8)) 1',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          
          {/* Error state indicator */}
          {clip.generationStatus === 'error' && (
            <div className="absolute top-0 right-0 w-3 h-3 rounded-full bg-red-500 m-1" 
              style={{ zIndex: 2 }} 
            />
          )}
          
          {/* Scene info text */}
          <div className="flex flex-col items-center justify-center h-full px-1 gap-0.5">
            <span style={{ 
              fontSize: '8px', 
              fontWeight: 700, 
              color: 'rgba(255,255,255,0.9)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              lineHeight: 1,
            }}>
              {clip.shotCategory === 'PERFORMANCE' ? '🎤' : clip.shotCategory === 'B-ROLL' ? '🎬' : '📖'}{' '}
              {clip.title || `Scene ${clip.id}`}
            </span>
            {clip.lyricsSegment && clipWidth > 60 && (
              <span style={{ 
                fontSize: '7px', 
                color: 'rgba(255,255,255,0.6)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '90%',
                lineHeight: 1,
              }}>
                "{clip.lyricsSegment.substring(0, 40)}"
              </span>
            )}
            {clip.generationStatus === 'generating' && (
              <span style={{ 
                fontSize: '7px', 
                color: 'rgba(168,85,247,0.9)',
                lineHeight: 1,
              }}>
                ⏳ generando...
              </span>
            )}
            {clip.generationStatus === 'error' && (
              <span style={{ 
                fontSize: '7px', 
                color: 'rgba(239,68,68,0.9)',
                lineHeight: 1,
              }}>
                ❌ error
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* 🎬 Video Filmstrip — professional NLE style with multiple frame thumbnails */}
      {isVideoClip && videoThumbnails.length > 0 && (
        <div 
          className="absolute inset-0 overflow-hidden pointer-events-none z-0"
          style={{ display: 'flex', flexDirection: 'row' }}
        >
          {(() => {
            // Calculate how many thumbnail slots fit at current zoom
            const thumbAspect = 16 / 9;
            const clipH = 45; // DEFAULT_LAYER_HEIGHT approx
            const thumbW = clipH * thumbAspect; // Each thumbnail visual width
            const numSlots = Math.max(1, Math.ceil(clipWidth / thumbW));
            const slots: React.ReactNode[] = [];
            
            for (let i = 0; i < numSlots; i++) {
              // Pick the most appropriate frame from extracted thumbnails
              const frameIdx = Math.min(
                videoThumbnails.length - 1,
                Math.round((i / Math.max(1, numSlots - 1)) * (videoThumbnails.length - 1))
              );
              const slotWidth = i < numSlots - 1 
                ? thumbW 
                : clipWidth - (numSlots - 1) * thumbW; // Last slot gets remaining width
              
              slots.push(
                <div
                  key={i}
                  style={{
                    width: `${Math.max(1, slotWidth)}px`,
                    height: '100%',
                    flexShrink: 0,
                    backgroundImage: `url(${videoThumbnails[frameIdx]})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    borderRight: i < numSlots - 1 ? '1px solid rgba(0,0,0,0.3)' : 'none',
                  }}
                />
              );
            }
            return slots;
          })()}
          {/* Dark overlay for text legibility */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/40" />
        </div>
      )}
      
      {/* Waveform visual para clips de audio — SVG path scales perfectly with zoom */}
      {isAudioClip && (
        <div className="audio-waveform" style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: 1,
        }}>
          {(() => {
            const peaks = resolvedPeaks;
            const hasPeaks = peaks && peaks.length > 0;
            // SVG viewBox uses 1000 virtual units wide, maps to 100% of clip
            const vW = 1000;
            const vH = 100;
            const padding = 6; // top/bottom padding in viewBox units
            const minAmp = 0.05; // minimum amplitude so silent parts still show a line

            // Build array of amplitudes (200 points for smooth curve)
            const numPoints = 200;
            const amps: number[] = [];
            for (let i = 0; i < numPoints; i++) {
              if (hasPeaks) {
                const peakIdx = (i / numPoints) * peaks.length;
                const low = Math.floor(peakIdx);
                const high = Math.min(low + 1, peaks.length - 1);
                const frac = peakIdx - low;
                amps.push(peaks[low] * (1 - frac) + peaks[high] * frac);
              } else {
                const pseudo = Math.abs(Math.sin(i * 12.9898 + 0.5) * 43758.5453) % 1;
                amps.push(0.15 + pseudo * 0.6);
              }
            }

            // Build mirrored waveform path (top half + bottom half)
            const midY = vH / 2;
            const maxAmpH = midY - padding;
            
            // Top edge (left to right)
            let topPath = '';
            for (let i = 0; i < numPoints; i++) {
              const x = (i / (numPoints - 1)) * vW;
              const a = Math.max(minAmp, amps[i]);
              const y = midY - a * maxAmpH;
              topPath += (i === 0 ? `M ${x},${y}` : ` L ${x},${y}`);
            }
            // Bottom edge (right to left, mirrored)
            let bottomPath = '';
            for (let i = numPoints - 1; i >= 0; i--) {
              const x = (i / (numPoints - 1)) * vW;
              const a = Math.max(minAmp, amps[i]);
              const y = midY + a * maxAmpH;
              bottomPath += ` L ${x},${y}`;
            }
            const fullPath = topPath + bottomPath + ' Z';

            // Center line
            const centerLine = `M 0,${midY} L ${vW},${midY}`;

            return (
              <svg
                viewBox={`0 0 ${vW} ${vH}`}
                preserveAspectRatio="none"
                style={{ width: '100%', height: '100%', display: 'block' }}
              >
                <defs>
                  <linearGradient id={`waveGrad-${clip.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={hasPeaks ? 'rgba(251,146,60,0.9)' : 'rgba(255,255,255,0.5)'} />
                    <stop offset="50%" stopColor={hasPeaks ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)'} />
                    <stop offset="100%" stopColor={hasPeaks ? 'rgba(251,146,60,0.9)' : 'rgba(255,255,255,0.5)'} />
                  </linearGradient>
                </defs>
                {/* Filled waveform shape */}
                <path
                  d={fullPath}
                  fill={`url(#waveGrad-${clip.id})`}
                  stroke="none"
                />
                {/* Center line */}
                <path
                  d={centerLine}
                  fill="none"
                  stroke={hasPeaks ? 'rgba(251,146,60,0.4)' : 'rgba(255,255,255,0.2)'}
                  strokeWidth="0.5"
                />
              </svg>
            );
          })()}
        </div>
      )}
      
      {/* Manejador de redimensionamiento (inicio) */}
      <div
        className="resize-handle left"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleResizeStart('start', e);
        }}
        title="Arrastrar para cambiar inicio"
      >
        <div className="resize-handle-indicator" />
      </div>
      
      {/* Manejador de redimensionamiento (fin) */}
      <div
        className="resize-handle right"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          handleResizeStart('end', e);
        }}
        title="Arrastrar para cambiar duración"
      >
        <div className="resize-handle-indicator" />
      </div>

      {/* Indicador visual de arrastre - solo visual, sin eventos */}
      <div className="clip-drag-indicator" style={{ pointerEvents: 'none' }}>
        <div className="drag-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="9" cy="5" r="1" fill="currentColor"/>
            <circle cx="9" cy="12" r="1" fill="currentColor"/>
            <circle cx="9" cy="19" r="1" fill="currentColor"/>
            <circle cx="15" cy="5" r="1" fill="currentColor"/>
            <circle cx="15" cy="12" r="1" fill="currentColor"/>
            <circle cx="15" cy="19" r="1" fill="currentColor"/>
          </svg>
        </div>
      </div>

      {/* Contenido del clip */}
      <div className="clip-content">
        <div className="clip-title" title={clip.title || (isAudioClip ? '🎵 Audio Track' : '')}>
          {isAudioClip ? '🎵 Audio' : clip.title}
        </div>
        <div className="clip-duration">
          {formatDuration(clip.duration)}
        </div>
        
        {/* Indicador de clip generado por IA */}
        {clip.generatedImage && (
          <div className="clip-ai-badge" title="Imagen generada por IA">
            <Sparkles size={8} /> IA
          </div>
        )}

        {/* Musician badge */}
        {hasMusician && (
          <div
            title={`Musician: ${musicianType}`}
            style={{
              position: 'absolute',
              top: '2px',
              left: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '3px',
              padding: '1px 5px',
              borderRadius: '4px',
              background: 'rgba(249, 115, 22, 0.22)',
              border: '1px solid rgba(249, 115, 22, 0.45)',
              color: '#fed7aa',
              fontSize: '8px',
              fontWeight: 700,
              lineHeight: 1,
              zIndex: 6,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}
          >
            <Guitar size={8} />
            {musicianType}
          </div>
        )}
        
        {/* Indicador de video */}
        {(clip.type === 'VIDEO' || clip.videoUrl || clip.metadata?.videoUrl || clip.metadata?.hasVideo) && (
          <div className="clip-video-badge" title={clip.type === 'VIDEO' ? 'Video importado' : 'Video generado'}>
            <VideoIcon size={8} /> Video
          </div>
        )}

        {/* ⚡ Indicador de MicroCuts aplicados */}
        {clip.metadata?.microCutsEnabled && clip.metadata?.microCutsEffects?.length > 0 && (
          <div 
            className="clip-microcuts-badge" 
            title={`⚡ MicroCuts: ${clip.metadata.microCutsEffects.join(', ')} (${clip.metadata.microCutsIntensity})`}
            style={{
              position: 'absolute',
              bottom: '2px',
              right: '2px',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              padding: '1px 4px',
              borderRadius: '3px',
              background: 'rgba(234, 179, 8, 0.25)',
              border: '1px solid rgba(234, 179, 8, 0.4)',
              color: '#fbbf24',
              fontSize: '7px',
              fontWeight: 600,
              lineHeight: 1,
              zIndex: 5,
            }}
          >
            ⚡ {clip.metadata.microCutsEffects.length}fx
          </div>
        )}
      </div>

      {/* ===== MENÚ CONTEXTUAL (PORTAL - CLIC DERECHO) ===== */}
      {isImageClip && contextMenu.visible && createPortal(
        <div
          ref={menuRef}
          className="boostify-context-menu"
          style={{
            position: 'fixed',
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Header del menú */}
          <div className="context-menu-header">
            <span className="context-menu-title">⚡ Acciones</span>
            <button className="context-menu-close" onClick={closeContextMenu}>
              <X size={12} />
            </button>
          </div>
          
          {/* Opciones del menú */}
          <div className="context-menu-options">
            {/* Like */}
            {onLike && (
              <button
                className="context-menu-item like"
                onClick={(e) => handleActionClick(e, onLike)}
              >
                <Heart size={14} />
                <span>Like</span>
              </button>
            )}

            {/* Variations */}
            {onVariations && hasImage && (
              <button
                className="context-menu-item variations"
                onClick={(e) => handleActionClick(e, onVariations)}
              >
                <Shuffle size={14} />
                <span>Variations</span>
              </button>
            )}
            
            {/* Camera Angles - Change Camera */}
            {onCameraAngles && clip.shotCategory === 'PERFORMANCE' && (
              <button
                className="context-menu-item camera"
                onClick={(e) => handleActionClick(e, onCameraAngles)}
              >
                <Camera size={14} />
                <span>Change Camera</span>
              </button>
            )}

            {/* Recreate */}
            {onRegenerateImage && (
              <button
                className="context-menu-item regenerate"
                onClick={(e) => handleActionClick(e, onRegenerateImage)}
              >
                <RefreshCw size={14} />
                <span>Recreate</span>
              </button>
            )}

            <div className="context-menu-divider" />

            {/* Use as reference */}
            {onUseAsReference && hasImage && (
              <button
                className="context-menu-item reference"
                onClick={(e) => handleActionClick(e, onUseAsReference)}
              >
                <Layers size={14} />
                <span>Use as reference</span>
              </button>
            )}

            {/* Use as style */}
            {onUseAsStyle && hasImage && (
              <button
                className="context-menu-item style-ref"
                onClick={(e) => handleActionClick(e, onUseAsStyle)}
              >
                <Sparkles size={14} />
                <span>Use as style</span>
              </button>
            )}

            {/* Upscale */}
            {onUpscale && hasImage && (
              <button
                className="context-menu-item upscale"
                onClick={(e) => handleActionClick(e, onUpscale)}
              >
                <ArrowUpCircle size={14} />
                <span>Upscale</span>
              </button>
            )}
            
            <div className="context-menu-divider" />
            
            {/* Edit Image - Nano Banana AI */}
            {onEditImage && (
              <button
                className="context-menu-item edit"
                onClick={(e) => handleActionClick(e, onEditImage)}
              >
                <Pencil size={14} />
                <span>Edit image</span>
                <span className="shortcut">AI</span>
              </button>
            )}
            
            {/* Create video */}
            {onGenerateVideo && (
              <button
                className="context-menu-item video"
                onClick={(e) => handleActionClick(e, onGenerateVideo)}
              >
                <VideoIcon size={14} />
                <span>Create video</span>
                <span className="shortcut">5s</span>
              </button>
            )}

            {/* Apply Choreography */}
            {onChoreography && hasImage && (
              <button
                className="context-menu-item choreography"
                onClick={(e) => handleActionClick(e, onChoreography)}
              >
                <Music size={14} />
                <span>Choreography</span>
                <span className="shortcut">💃</span>
              </button>
            )}

            {/* Copy Image */}
            {hasImage && (
              <button
                className="context-menu-item copy-img"
                onClick={(e) => {
                  e.stopPropagation();
                  const imgUrl = getClipImageUrl(clip);
                  if (imgUrl) {
                    navigator.clipboard.writeText(imgUrl).then(() => {
                      // Copy URL to clipboard 
                    }).catch(() => {});
                  }
                  closeContextMenu();
                }}
              >
                <Copy size={14} />
                <span>Copy Image</span>
              </button>
            )}

            {/* Download */}
            {hasImage && (
              <button
                className="context-menu-item download"
                onClick={(e) => {
                  e.stopPropagation();
                  const imgUrl = getClipImageUrl(clip);
                  if (imgUrl) {
                    const a = document.createElement('a');
                    a.href = imgUrl;
                    a.download = `clip-${clip.id}.jpg`;
                    a.target = '_blank';
                    a.rel = 'noopener noreferrer';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                  }
                  closeContextMenu();
                }}
              >
                <Download size={14} />
                <span>Download</span>
              </button>
            )}

            <div className="context-menu-divider" />

            {/* Move to trash */}
            {onDeleteClip && (
              <button
                className="context-menu-item trash"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteClip(clip.id);
                  closeContextMenu();
                }}
              >
                <Trash2 size={14} />
                <span>Move to trash</span>
              </button>
            )}
            
            {/* Ajustar Imagen (Image Fit) */}
            {onUpdateImageFit && hasImage && (
              <>
                <div className="context-menu-divider" />
                <div style={{ padding: '4px 12px 2px', fontSize: '10px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  📐 Ajustar Imagen
                </div>
                {[
                  { value: 'cover', label: 'Cubrir', icon: <Maximize size={13} />, desc: 'Recorta para llenar' },
                  { value: 'contain', label: 'Contener', icon: <Minimize2 size={13} />, desc: 'Muestra completa' },
                  { value: '100% 100%', label: 'Estirar', icon: <RectangleHorizontal size={13} />, desc: 'Rellena todo' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    className={`context-menu-item ${(clip.metadata?.imageFit || 'cover') === opt.value ? 'active-fit' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateImageFit(clip.id, opt.value);
                      closeContextMenu();
                    }}
                    style={(clip.metadata?.imageFit || 'cover') === opt.value ? { background: 'rgba(251,146,60,0.15)', borderLeft: '2px solid rgba(251,146,60,0.8)' } : {}}
                  >
                    {opt.icon}
                    <span>{opt.label}</span>
                    <span className="shortcut" style={{ fontSize: '9px', opacity: 0.5 }}>{opt.desc}</span>
                  </button>
                ))}
              </>
            )}
          </div>
          
          {/* Estilos inline del menú contextual */}
          <style>{`
            .boostify-context-menu {
              min-width: 200px;
              max-width: 240px;
              max-height: calc(100vh - 24px);
              background: linear-gradient(145deg, rgba(28, 28, 30, 0.98), rgba(20, 20, 22, 0.98));
              border-radius: 12px;
              backdrop-filter: blur(20px);
              border: 1px solid rgba(255, 255, 255, 0.15);
              box-shadow: 
                0 12px 40px rgba(0, 0, 0, 0.6),
                0 4px 12px rgba(0, 0, 0, 0.4),
                inset 0 1px 0 rgba(255, 255, 255, 0.1);
              animation: contextMenuIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);
              overflow: hidden;
              display: flex;
              flex-direction: column;
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            @keyframes contextMenuIn {
              from { 
                opacity: 0; 
                transform: scale(0.95) translateY(-6px); 
              }
              to { 
                opacity: 1; 
                transform: scale(1) translateY(0); 
              }
            }
            
            .boostify-context-menu .context-menu-header {
              display: flex;
              align-items: center;
              justify-content: space-between;
              padding: 8px 12px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
              background: rgba(255, 255, 255, 0.04);
              flex-shrink: 0;
            }
            
            .boostify-context-menu .context-menu-title {
              font-size: 12px;
              font-weight: 700;
              color: rgba(255, 255, 255, 0.9);
              letter-spacing: 0.02em;
            }
            
            .boostify-context-menu .context-menu-close {
              display: flex;
              align-items: center;
              justify-content: center;
              width: 20px;
              height: 20px;
              border: none;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 6px;
              color: rgba(255, 255, 255, 0.6);
              cursor: pointer;
              transition: all 0.15s ease;
            }
            
            .boostify-context-menu .context-menu-close:hover {
              background: rgba(239, 68, 68, 0.4);
              color: #ef4444;
            }
            
            .boostify-context-menu .context-menu-options {
              padding: 6px;
              overflow-y: auto;
              flex: 1;
              min-height: 0;
            }
            
            .boostify-context-menu .context-menu-divider {
              height: 1px;
              margin: 3px 8px;
              background: rgba(255, 255, 255, 0.08);
              flex-shrink: 0;
            }
            
            .boostify-context-menu .context-menu-item {
              display: flex;
              align-items: center;
              gap: 10px;
              width: 100%;
              padding: 7px 12px;
              border: none;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.12s ease;
              color: rgba(255, 255, 255, 0.9);
              background: transparent;
              text-align: left;
            }
            
            .boostify-context-menu .context-menu-item span:first-of-type {
              flex: 1;
            }
            
            .boostify-context-menu .context-menu-item .shortcut {
              font-size: 10px;
              font-weight: 600;
              padding: 3px 8px;
              border-radius: 5px;
              background: rgba(255, 255, 255, 0.12);
              color: rgba(255, 255, 255, 0.6);
            }
            
            .boostify-context-menu .context-menu-item:hover {
              background: rgba(255, 255, 255, 0.1);
            }
            
            .boostify-context-menu .context-menu-item.edit:hover {
              background: rgba(249, 115, 22, 0.2);
              color: #fb923c;
            }
            .boostify-context-menu .context-menu-item.edit:hover .shortcut {
              background: rgba(249, 115, 22, 0.35);
              color: #fb923c;
            }
            
            .boostify-context-menu .context-menu-item.musician:hover {
              background: rgba(34, 197, 94, 0.2);
              color: #4ade80;
            }
            
            .boostify-context-menu .context-menu-item.camera:hover {
              background: rgba(234, 179, 8, 0.2);
              color: #facc15;
            }
            
            .boostify-context-menu .context-menu-item.regenerate:hover {
              background: rgba(168, 85, 247, 0.2);
              color: #c084fc;
            }
            
            .boostify-context-menu .context-menu-item.video:hover {
              background: rgba(59, 130, 246, 0.2);
              color: #60a5fa;
            }
            .boostify-context-menu .context-menu-item.video:hover .shortcut {
              background: rgba(59, 130, 246, 0.35);
              color: #60a5fa;
            }
            
            .boostify-context-menu .context-menu-item.like:hover {
              background: rgba(239, 68, 68, 0.2);
              color: #f87171;
            }
            
            .boostify-context-menu .context-menu-item.variations:hover {
              background: rgba(168, 85, 247, 0.2);
              color: #c084fc;
            }
            
            .boostify-context-menu .context-menu-item.reference:hover {
              background: rgba(167, 139, 250, 0.2);
              color: #a78bfa;
            }
            
            .boostify-context-menu .context-menu-item.style-ref:hover {
              background: rgba(251, 191, 36, 0.2);
              color: #fbbf24;
            }
            
            .boostify-context-menu .context-menu-item.upscale:hover {
              background: rgba(34, 211, 238, 0.2);
              color: #22d3ee;
            }
            
            .boostify-context-menu .context-menu-item.copy-img:hover {
              background: rgba(255, 255, 255, 0.12);
              color: rgba(255, 255, 255, 0.95);
            }
            
            .boostify-context-menu .context-menu-item.download:hover {
              background: rgba(255, 255, 255, 0.12);
              color: rgba(255, 255, 255, 0.95);
            }
            
            .boostify-context-menu .context-menu-item.trash:hover {
              background: rgba(239, 68, 68, 0.15);
              color: #f87171;
            }
          `}</style>
        </div>,
        portalContainer || document.body
      )}

      {/* Estilos del componente */}
      <style dangerouslySetInnerHTML={{ __html: `
        .clip-item {
          position: absolute;
          height: calc(100% - 4px);
          margin: 2px 0;
          border-radius: 6px;
          overflow: visible;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
          user-select: none;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          align-items: stretch;
          color: white;
          font-size: 11px;
          transition: box-shadow 0.15s ease;
          border: 1px solid rgba(255,255,255,0.15);
          will-change: transform, width, left;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        
        @media (min-width: 640px) {
          .clip-item {
            font-size: 13px;
            border-radius: 8px;
          }
        }
        
        .clip-image-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            to bottom, 
            rgba(0,0,0,0.2) 0%, 
            rgba(0,0,0,0.1) 30%,
            rgba(0,0,0,0.5) 100%
          );
          pointer-events: none;
          z-index: 1;
          border-radius: inherit;
        }
        
        .clip-item.selected {
          box-shadow: 0 0 0 3px #f97316, 0 4px 16px rgba(249, 115, 22, 0.6);
          z-index: 10;
          border-color: #f97316;
        }
        
        .clip-item.dragging {
          opacity: 0.95;
          z-index: 100 !important;
          box-shadow: 0 0 0 3px #22c55e, 0 8px 24px rgba(34, 197, 94, 0.5);
          cursor: grabbing !important;
          /* Sin transición durante el drag para movimiento inmediato */
          transition: none !important;
        }
        
        .clip-item.resizing {
          z-index: 100 !important;
          box-shadow: 0 0 0 3px #3b82f6, 0 8px 24px rgba(59, 130, 246, 0.5);
          /* Sin transición durante el resize para movimiento inmediato */
          transition: none !important;
        }
        
        /* Herramienta Trim activa - mostrar handles más prominentes */
        .clip-item.tool-trim .resize-handle {
          background: rgba(59, 130, 246, 0.3);
        }
        
        .clip-item.tool-trim .resize-handle:hover {
          background: rgba(59, 130, 246, 0.6);
        }
        
        /* Indicador visual de arrastre */
        .clip-drag-indicator {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          z-index: 5;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        
        .drag-indicator {
          opacity: 0;
          color: rgba(255, 255, 255, 0.5);
          transition: opacity 0.2s ease;
          background: rgba(0, 0, 0, 0.5);
          padding: 4px;
          border-radius: 4px;
        }
        
        .clip-item:hover .drag-indicator {
          opacity: 0.7;
        }
        
        .clip-item.selected .drag-indicator {
          opacity: 0.9;
          color: rgba(249, 115, 22, 0.8);
        }
        
        .clip-content {
          flex: 1;
          padding: 4px 6px;
          display: flex;
          flex-direction: column;
          justify-content: flex-end;
          position: relative;
          z-index: 2;
          overflow: hidden;
          gap: 2px;
          pointer-events: none;
        }
        
        @media (min-width: 640px) {
          .clip-content {
            padding: 6px 10px;
            gap: 3px;
          }
          .clip-drag-zone {
            left: 24px;
            right: 24px;
          }
        }
        
        .clip-title {
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-shadow: 
            0 1px 3px rgba(0, 0, 0, 0.9),
            0 0 8px rgba(0, 0, 0, 0.7);
          font-size: 11px;
          letter-spacing: 0.02em;
          line-height: 1.2;
        }
        
        @media (min-width: 640px) {
          .clip-title {
            font-size: 13px;
          }
        }
        
        .clip-duration {
          font-size: 10px;
          font-weight: 600;
          opacity: 0.95;
          text-shadow: 
            0 1px 2px rgba(0, 0, 0, 0.8),
            0 0 6px rgba(0, 0, 0, 0.6);
          background: rgba(0, 0, 0, 0.4);
          padding: 1px 4px;
          border-radius: 3px;
          width: fit-content;
        }
        
        @media (min-width: 640px) {
          .clip-duration {
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 4px;
          }
        }
        
        .resize-handle {
          position: absolute;
          top: 0;
          width: 14px;
          height: 100%;
          cursor: ew-resize;
          z-index: 30;
          background: transparent;
          transition: all 0.15s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .resize-handle.left {
          left: 0;
          border-radius: 6px 0 0 6px;
        }
        
        .resize-handle.right {
          right: 0;
          border-radius: 0 6px 6px 0;
        }
        
        .resize-handle:hover,
        .resize-handle:active {
          background: rgba(59, 130, 246, 0.6);
        }
        
        /* Modo Trim: resize handles más visibles siempre */
        .clip-item.tool-trim .resize-handle {
          background: rgba(59, 130, 246, 0.25);
          width: 18px;
        }
        
        .clip-item.tool-trim .resize-handle:hover {
          background: rgba(59, 130, 246, 0.7);
        }
        
        .clip-item.tool-trim .resize-handle .resize-handle-indicator {
          background: rgba(255, 255, 255, 0.7);
        }
        }
        
        .resize-handle-indicator {
          width: 4px;
          height: 40%;
          min-height: 16px;
          max-height: 40px;
          background: rgba(255, 255, 255, 0.4);
          border-radius: 2px;
          transition: all 0.15s ease;
        }
        
        .resize-handle:hover .resize-handle-indicator,
        .resize-handle:active .resize-handle-indicator {
          background: #fff;
          width: 5px;
          box-shadow: 0 0 8px rgba(249, 115, 22, 0.8);
        }
        
        @media (min-width: 640px) {
          .resize-handle {
            width: 20px;
          }
          .resize-handle-indicator {
            width: 5px;
          }
        }
        
        .resize-handle.left {
          left: 0;
          border-radius: 6px 0 0 6px;
        }
        
        .resize-handle.right {
          right: 0;
          border-radius: 0 6px 6px 0;
        }
        
        /* Badges */
        .clip-ai-badge,
        .clip-video-badge {
          position: absolute;
          font-size: 8px;
          font-weight: 800;
          padding: 2px 5px;
          border-radius: 4px;
          text-shadow: 0 1px 2px rgba(0,0,0,0.5);
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          letter-spacing: 0.05em;
          display: flex;
          align-items: center;
          gap: 2px;
          z-index: 5;
          color: #fff;
        }
        
        .clip-ai-badge {
          top: 3px;
          right: 3px;
          background: linear-gradient(135deg, #f97316, #ea580c);
        }
        
        .clip-video-badge {
          top: 3px;
          left: 3px;
          background: linear-gradient(135deg, #3b82f6, #2563eb);
        }
        
        @media (min-width: 640px) {
          .clip-ai-badge,
          .clip-video-badge {
            font-size: 9px;
            padding: 3px 6px;
          }
          .clip-ai-badge { top: 4px; right: 4px; }
          .clip-video-badge { top: 4px; left: 4px; }
        }
      `}} />
    </div>
  );
};

export { ClipItem };
export default ClipItem;