/**
 * Componente LayerRow - Professional Timeline Layer Row
 * 
 * NLE-grade layer with RAF-optimized drag/resize, magnetic snap,
 * overlap prevention, and visual snap indicators.
 * 
 * BOOSTIFY 2025 - Premiere/DaVinci Level
 */
import React, { useState } from 'react';
import { 
  LayerConfig, 
  TimelineClip,
  ClipType,
  LayerType
} from '../../../interfaces/timeline';
import { 
  LAYER_HEADER_WIDTH, 
  DEFAULT_LAYER_HEIGHT,
  MAX_CLIP_DURATION,
  MIN_CLIP_DURATION,
  SNAP_THRESHOLD_PX
} from '../../../constants/timeline-constants';
import { ClipItem } from './ClipItem';
import { 
  Volume2, VolumeX, Film, ChevronDown, ChevronUp, 
  Lock, Unlock, Eye, EyeOff, GripVertical,
  Plus, Trash2, Pencil, Music, Video, Copy,
  ArrowUp, ArrowDown
} from 'lucide-react';
import type { SnapResult } from '../../../hooks/useTimelineEngine';

type Tool = 'select' | 'razor' | 'trim' | 'hand';

// Props de acciones para clips
interface ClipActionHandlers {
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
  onClipHoverStart?: (clip: TimelineClip, position: { x: number; y: number }) => void;
  onClipHoverEnd?: () => void;
}

interface LayerRowProps extends ClipActionHandlers {
  layer: LayerConfig;
  clips: TimelineClip[];
  zoom: number;
  currentTime: number;
  duration: number;
  tool?: Tool;
  onSelectClip: (clipId: number | null) => void;
  selectedClipId: number | null;
  onMoveClip?: (clipId: number, newStart: number, newLayerId: number) => void;
  onResizeClip?: (clipId: number, newStart: number, newDuration: number, edge?: 'start' | 'end') => void;
  onRazorClick?: (clipId: number, time: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  layerLabelWidth?: number;
  onMuteLayer?: (layerId: number, muted: boolean) => void;
  onConvertAllToVideo?: (layerId: number) => void;
  onUpdateImageFit?: (clipId: number, fit: string) => void;
  onDeleteClip?: (clipId: number) => void;
  /** Snap function from useTimelineEngine for real-time snap indicators */
  onSnapQuery?: (time: number, excludeClipId?: number) => SnapResult;
  /** Active snap indicator for visual feedback */
  activeSnap?: SnapResult | null;
  /** Track management callbacks */
  onAddTrack?: (afterLayerId: number, type: 'video' | 'audio') => void;
  onDeleteTrack?: (layerId: number) => void;
  onRenameTrack?: (layerId: number, newName: string) => void;
  onDuplicateTrack?: (layerId: number) => void;
  canDeleteTrack?: boolean;
  /** Drag reorder callbacks */
  onReorderTrack?: (layerId: number, direction: 'up' | 'down') => void;
  onTrackDragStart?: (layerId: number) => void;
  onTrackDragOver?: (layerId: number) => void;
  onTrackDragEnd?: () => void;
  isDropTarget?: boolean;
  isDraggingThis?: boolean;
  layerIndex?: number;
  totalLayers?: number;
}

/**
 * Professional timeline layer component
 */
export const LayerRow: React.FC<LayerRowProps> = ({
  layer,
  clips,
  zoom,
  currentTime,
  duration,
  tool = 'select',
  onSelectClip,
  selectedClipId,
  onMoveClip,
  onResizeClip,
  onRazorClick,
  onDragStart: onDragStartCallback,
  onDragEnd: onDragEndCallback,
  onResizeStart: onResizeStartCallback,
  onResizeEnd: onResizeEndCallback,
  layerLabelWidth = 100,
  // Acciones de clip
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
  onClipHoverStart,
  onClipHoverEnd,
  onMuteLayer,
  onConvertAllToVideo,
  onUpdateImageFit,
  onDeleteClip,
  onSnapQuery,
  activeSnap,
  onAddTrack,
  onDeleteTrack,
  onRenameTrack,
  onDuplicateTrack,
  canDeleteTrack = true,
  onReorderTrack,
  onTrackDragStart,
  onTrackDragOver,
  onTrackDragEnd,
  isDropTarget = false,
  isDraggingThis = false,
  layerIndex = 0,
  totalLayers = 1,
}) => {
  // Filtrar clips que pertenecen a esta capa
  const layerClips = clips.filter(clip => clip.layerId === layer.id);
  const isAudioLayer = layer.type === LayerType.AUDIO;
  
  // Layer state
  const [layerHeight, setLayerHeight] = useState(layer.height || DEFAULT_LAYER_HEIGHT);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);
  const [isResizingHeight, setIsResizingHeight] = useState(false);
  const [isLocked, setIsLocked] = useState(layer.locked || false);
  const [isVisible, setIsVisible] = useState(layer.visible !== false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(layer.name);
  const renameInputRef = React.useRef<HTMLInputElement>(null);

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);

  // Close context menu on outside click
  React.useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    window.addEventListener('contextmenu', handler);
    return () => {
      window.removeEventListener('click', handler);
      window.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  // Rename handlers
  const startRename = () => {
    setRenameValue(layer.name);
    setIsRenaming(true);
    closeContextMenu();
    setTimeout(() => renameInputRef.current?.focus(), 50);
  };

  const submitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== layer.name) {
      onRenameTrack?.(layer.id, trimmed);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setRenameValue(layer.name);
    setIsRenaming(false);
  };
  
  // Estado para el arrastre de clips
  const [draggedClipId, setDraggedClipId] = React.useState<number | null>(null);
  const [resizingClipId, setResizingClipId] = React.useState<number | null>(null);
  const [resizeDirection, setResizeDirection] = React.useState<'start' | 'end' | null>(null);
  
  // Refs para evitar closures obsoletos
  const dragStateRef = React.useRef({
    clipId: null as number | null,
    startX: 0,
    originalStart: 0,
    currentDeltaX: 0, // Para tracking del delta actual
    clipElement: null as HTMLElement | null, // Referencia al elemento DOM
    rafId: null as number | null, // Para requestAnimationFrame
    lastClientX: 0, // Para detectar layer destino (cross-layer drag)
    lastClientY: 0,
  });
  
  const resizeStateRef = React.useRef({
    clipId: null as number | null,
    direction: null as 'start' | 'end' | null,
    startX: 0,
    originalData: null as { start: number; duration: number } | null,
    clipElement: null as HTMLElement | null,
    rafId: null as number | null,
    currentDeltaX: 0 // Para tracking del delta actual
  });
  
  // Referencia al contenedor para calcular posiciones
  const containerRef = React.useRef<HTMLDivElement>(null);
  
  // Ref para clips actuales — evita stale closures en document event listeners
  const clipsRef = React.useRef(clips);
  clipsRef.current = clips;
  
  // Refs que siempre apuntan a los handlers más recientes
  const latestDragMoveRef = React.useRef<(e: MouseEvent) => void>(() => {});
  const latestDragEndRef = React.useRef<() => void>(() => {});
  const latestResizeMoveRef = React.useRef<(e: MouseEvent) => void>(() => {});
  const latestResizeEndRef = React.useRef<() => void>(() => {});
  
  // Wrappers estables — identidad fija, delegan al handler más reciente vía ref
  const stableDragMove = React.useCallback((e: MouseEvent) => latestDragMoveRef.current(e), []);
  const stableDragEnd = React.useCallback(() => latestDragEndRef.current(), []);
  const stableResizeMove = React.useCallback((e: MouseEvent) => latestResizeMoveRef.current(e), []);
  const stableResizeEnd = React.useCallback(() => latestResizeEndRef.current(), []);
  
  // Validaciones específicas para esta capa
  const validateClipPlacement = (clip: TimelineClip, newStart: number, newDuration?: number): boolean => {
    // Comprobar si es una imagen generada por IA (solo permitida en capa 7)
    if (clip.type === ClipType.GENERATED_IMAGE && layer.id !== 7) {
      return false;
    }
    
    // Comprobar duración máxima (audio clips are exempt — songs can be minutes long)
    const clipDuration = newDuration || clip.duration;
    const clipIsAudio = clip.type === ClipType.AUDIO || clip.layerId === 2;
    if (!clipIsAudio && clipDuration > MAX_CLIP_DURATION) {
      return false;
    }
    
    // Comprobar duración mínima
    if (clipDuration < 0.1) {
      return false;
    }
    
    // Comprobar límites del timeline
    if (newStart < 0 || newStart + clipDuration > duration) {
      return false;
    }
    
    return true;
  };
  
  // ====== ARRASTRAR CLIPS (OPTIMIZADO CON RAF + SNAP ENGINE) ======
  const handleDragMove = React.useCallback((e: MouseEvent) => {
    const state = dragStateRef.current;
    if (!state.clipId) {
      return;
    }
    
    // Guardar el delta actual y posición del mouse para cross-layer
    state.currentDeltaX = e.clientX - state.startX;
    state.lastClientX = e.clientX;
    state.lastClientY = e.clientY;
    
    // Usar requestAnimationFrame para rendimiento fluido
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    
    state.rafId = requestAnimationFrame(() => {
      const clipElement = state.clipElement;
      if (!clipElement) {
        return;
      }
      
      // Calculate snap-aware position for visual feedback
      if (onSnapQuery && state.clipId) {
        const rawNewStart = state.originalStart + (state.currentDeltaX / zoom);
        const snapResult = onSnapQuery(rawNewStart, state.clipId);
        // If snapped, adjust the visual offset to match
        if (snapResult.didSnap) {
          const snappedDeltaX = (snapResult.time - state.originalStart) * zoom;
          clipElement.style.transform = `translateX(${snappedDeltaX}px)`;
        } else {
          clipElement.style.transform = `translateX(${state.currentDeltaX}px)`;
        }
      } else {
        // Aplicar transform CSS directamente (sin re-render React)
        clipElement.style.transform = `translateX(${state.currentDeltaX}px)`;
      }
      clipElement.style.transition = 'none';
      clipElement.style.zIndex = '100';
    });
  }, [zoom, onSnapQuery]);
  
  const handleDragEnd = React.useCallback(() => {
    const state = dragStateRef.current;
    const clipId = state.clipId;
    const deltaX = state.currentDeltaX;
    const originalStart = state.originalStart;
    const clipElement = state.clipElement;
    
    // Cancelar cualquier RAF pendiente
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    
    // Restaurar estilos del elemento
    if (clipElement) {
      clipElement.style.transform = '';
      clipElement.style.transition = '';
      clipElement.style.zIndex = '';
    }
    
    // Calcular posición final y actualizar estado React UNA sola vez
    if (clipId && deltaX !== 0) {
      const deltaTime = deltaX / zoom;
      const clip = clipsRef.current.find(c => c.id === clipId);
      const clipDur = clip?.duration || 0;
      const isAudio = clip?.type === ClipType.AUDIO || clip?.layerId === 2;
      
      // Audio clips: only clamp start >= 0 (can extend past timeline end)
      // Video/image clips: must fit within timeline bounds
      const newStart = isAudio
        ? Math.max(0, originalStart + deltaTime)
        : Math.max(0, Math.min(duration - clipDur, originalStart + deltaTime));
      
      // Detect target layer via DOM (cross-layer drag & drop)
      let targetLayerId = layer.id;
      const elements = document.elementsFromPoint(state.lastClientX, state.lastClientY);
      const layerContentEl = elements.find(el =>
        el instanceof HTMLElement && el.dataset.layerId
      ) as HTMLElement | undefined;
      if (layerContentEl?.dataset.layerId) {
        targetLayerId = parseInt(layerContentEl.dataset.layerId) || layer.id;
      }
      
      onMoveClip?.(clipId, newStart, targetLayerId);
    }
    
    // Limpiar estado
    dragStateRef.current = { 
      clipId: null, 
      startX: 0, 
      originalStart: 0, 
      currentDeltaX: 0, 
      clipElement: null, 
      rafId: null,
      lastClientX: 0,
      lastClientY: 0,
    };
    setDraggedClipId(null);
    document.removeEventListener('mousemove', stableDragMove);
    document.removeEventListener('mouseup', stableDragEnd);
    document.body.style.cursor = '';
    
    // Notificar al editor que terminó el drag para guardar en historial
    onDragEndCallback?.();
  }, [zoom, duration, layer.id, onMoveClip, stableDragMove, stableDragEnd, onDragEndCallback]);
  
  const handleDragStart = React.useCallback((clipId: number, e: React.MouseEvent) => {
    if (isLocked && !isAudioLayer) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    
    const clip = clipsRef.current.find(c => c.id === clipId);
    if (!clip) {
      return;
    }
    
    // Notificar al editor que empieza un drag para guardar estado inicial
    onDragStartCallback?.();
    
    // Buscar el elemento DOM del clip usando el selector de data-clip-id
    // Usar querySelector en lugar de closest para mayor confiabilidad
    const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`) as HTMLElement;
    
    if (!clipElement) {
      return;
    }
    
    // Guardar estado en ref para evitar closures obsoletos
    dragStateRef.current = {
      clipId: clipId,
      startX: e.clientX,
      originalStart: clip.start,
      currentDeltaX: 0,
      clipElement: clipElement,
      rafId: null,
      lastClientX: e.clientX,
      lastClientY: e.clientY,
    };
    setDraggedClipId(clipId);
    
    // Añadir listeners globales (stable wrappers — nunca cambian de identidad)
    document.addEventListener('mousemove', stableDragMove);
    document.addEventListener('mouseup', stableDragEnd);
    document.body.style.cursor = 'grabbing';
  }, [isLocked, isAudioLayer, stableDragMove, stableDragEnd, onDragStartCallback]);
  
  // ====== REDIMENSIONAR CLIPS (OPTIMIZADO CON RAF + SNAP ENGINE) ======
  const handleResizeMove = React.useCallback((e: MouseEvent) => {
    const state = resizeStateRef.current;
    if (!state.clipId || !state.originalData || !state.direction) return;
    
    const deltaX = e.clientX - state.startX;
    
    // Guardar el delta actual en el ref
    state.currentDeltaX = deltaX;
    
    // Usar requestAnimationFrame para rendimiento fluido
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    
    state.rafId = requestAnimationFrame(() => {
      const clipElement = state.clipElement;
      if (!clipElement || !state.originalData) return;
      
      const originalWidthPx = state.originalData.duration * zoom;
      
      // Calculate snap-aware resize for visual feedback
      let visualDelta = deltaX;
      if (onSnapQuery && state.clipId) {
        if (state.direction === 'start') {
          const rawNewStart = state.originalData.start + (deltaX / zoom);
          const snapResult = onSnapQuery(rawNewStart, state.clipId);
          if (snapResult.didSnap) {
            visualDelta = (snapResult.time - state.originalData.start) * zoom;
          }
        } else {
          const rawNewEnd = state.originalData.start + state.originalData.duration + (deltaX / zoom);
          const snapResult = onSnapQuery(rawNewEnd, state.clipId);
          if (snapResult.didSnap) {
            visualDelta = (snapResult.time - (state.originalData.start + state.originalData.duration)) * zoom;
          }
        }
      }
      
      // Determine if this is an audio clip (no max duration limit)
      const resizingClipData = clipsRef.current.find(c => c.id === state.clipId);
      const resizingIsAudio = resizingClipData?.type === ClipType.AUDIO || resizingClipData?.layerId === 2;

      if (state.direction === 'start') {
        // Redimensionar desde el inicio: mover y cambiar ancho
        let clampedDelta = visualDelta;
        const minWidthPx = (MIN_CLIP_DURATION || 0.1) * zoom;
        const maxWidthPx = resizingIsAudio 
          ? (duration * zoom) // Audio: allow full timeline width
          : (MAX_CLIP_DURATION * zoom);
        const maxDeltaX = originalWidthPx - minWidthPx;
        const minDeltaX = -(state.originalData.start * zoom);
        
        clampedDelta = Math.max(minDeltaX, Math.min(maxDeltaX, clampedDelta));
        
        // Enforce max clip duration (skip for audio)
        const newWidth = originalWidthPx - clampedDelta;
        if (!resizingIsAudio && newWidth > maxWidthPx) {
          clampedDelta = originalWidthPx - maxWidthPx;
        }
        
        clipElement.style.transform = `translateX(${clampedDelta}px)`;
        clipElement.style.width = `${Math.max(minWidthPx, originalWidthPx - clampedDelta)}px`;
      } else {
        // Redimensionar desde el final: solo cambiar ancho
        let newWidth = originalWidthPx + visualDelta;
        const minWidthPx = (MIN_CLIP_DURATION || 0.1) * zoom;
        const maxWidthPx = resizingIsAudio
          ? ((duration - state.originalData.start) * zoom) // Audio: only limited by timeline end
          : Math.min(
              (duration - state.originalData.start) * zoom,
              MAX_CLIP_DURATION * zoom
            );
        
        newWidth = Math.max(minWidthPx, Math.min(maxWidthPx, newWidth));
        
        clipElement.style.width = `${newWidth}px`;
      }
      
      clipElement.style.transition = 'none';
      clipElement.style.zIndex = '100';
    });
  }, [zoom, duration, onSnapQuery]);
  
  const handleResizeEnd = React.useCallback(() => {
    const state = resizeStateRef.current;
    const clipId = state.clipId;
    const direction = state.direction;
    const originalData = state.originalData;
    const clipElement = state.clipElement;
    const currentDeltaX = state.currentDeltaX;
    
    // Cancelar cualquier RAF pendiente
    if (state.rafId) {
      cancelAnimationFrame(state.rafId);
    }
    
    // Restaurar estilos del elemento
    if (clipElement) {
      clipElement.style.transform = '';
      clipElement.style.width = '';
      clipElement.style.transition = '';
      clipElement.style.zIndex = '';
    }
    
    // Calcular valores finales y actualizar estado React UNA sola vez
    if (clipId && originalData && currentDeltaX !== 0) {
      const deltaTime = currentDeltaX / zoom;
      const resizedClip = clipsRef.current.find(c => c.id === clipId);
      const resizedIsAudio = resizedClip?.type === ClipType.AUDIO || resizedClip?.layerId === 2;
      
      let newStart = originalData.start;
      let newDuration = originalData.duration;
      
      if (direction === 'start') {
        newStart = originalData.start + deltaTime;
        newDuration = originalData.duration - deltaTime;
        
        if (newStart < 0) {
          newStart = 0;
          newDuration = originalData.start + originalData.duration;
        }
        if (newDuration < (MIN_CLIP_DURATION || 0.1)) {
          newDuration = MIN_CLIP_DURATION || 0.1;
          newStart = originalData.start + originalData.duration - newDuration;
        }
        // Enforce max clip duration (skip for audio — songs can be minutes long)
        if (!resizedIsAudio && newDuration > MAX_CLIP_DURATION) {
          newStart = originalData.start + originalData.duration - MAX_CLIP_DURATION;
          newDuration = MAX_CLIP_DURATION;
        }
      } else {
        newDuration = originalData.duration + deltaTime;
        if (newDuration < (MIN_CLIP_DURATION || 0.1)) newDuration = MIN_CLIP_DURATION || 0.1;
        if (!resizedIsAudio && newDuration > MAX_CLIP_DURATION) newDuration = MAX_CLIP_DURATION;
        if (newStart + newDuration > duration) newDuration = duration - newStart;
      }
      
      // Pass edge direction to parent for engine-level snap/overlap handling
      onResizeClip?.(clipId, newStart, newDuration, direction as 'start' | 'end');
    }
    
    // Limpiar estado
    resizeStateRef.current = { 
      clipId: null, 
      direction: null, 
      startX: 0, 
      originalData: null,
      clipElement: null,
      rafId: null,
      currentDeltaX: 0
    };
    setResizingClipId(null);
    document.removeEventListener('mousemove', stableResizeMove);
    document.removeEventListener('mouseup', stableResizeEnd);
    document.body.style.cursor = '';
    onResizeEndCallback?.();
  }, [zoom, duration, onResizeClip, stableResizeMove, stableResizeEnd, onResizeEndCallback]);
  
  const handleResizeStart = React.useCallback((clipId: number, direction: 'start' | 'end', e: React.MouseEvent) => {
    if (isLocked && !isAudioLayer) return;
    e.preventDefault();
    e.stopPropagation();
    
    const clip = clipsRef.current.find(c => c.id === clipId);
    if (!clip) return;
    
    // Notificar al editor que empieza un resize para guardar estado inicial
    onResizeStartCallback?.();
    
    // Buscar el elemento DOM del clip
    const clipElement = (e.target as HTMLElement).closest('[data-clip-id]') as HTMLElement;
    
    // Guardar estado en ref
    resizeStateRef.current = {
      clipId: clipId,
      direction: direction,
      startX: e.clientX,
      originalData: { start: clip.start, duration: clip.duration },
      clipElement: clipElement,
      rafId: null,
      currentDeltaX: 0
    };
    setResizingClipId(clipId);
    
    document.addEventListener('mousemove', stableResizeMove);
    document.addEventListener('mouseup', stableResizeEnd);
    document.body.style.cursor = 'ew-resize';
  }, [isLocked, isAudioLayer, stableResizeMove, stableResizeEnd, onResizeStartCallback]);
  
  // Cleanup en unmount — usa wrappers estables, solo se ejecuta al desmontar
  React.useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', stableDragMove);
      document.removeEventListener('mouseup', stableDragEnd);
      document.removeEventListener('mousemove', stableResizeMove);
      document.removeEventListener('mouseup', stableResizeEnd);
      if (dragStateRef.current.rafId) {
        cancelAnimationFrame(dragStateRef.current.rafId);
      }
      if (resizeStateRef.current.rafId) {
        cancelAnimationFrame(resizeStateRef.current.rafId);
      }
    };
  }, [stableDragMove, stableDragEnd, stableResizeMove, stableResizeEnd]);
  
  // Mantener refs sincronizados con handlers más recientes (cada render)
  latestDragMoveRef.current = handleDragMove;
  latestDragEndRef.current = handleDragEnd;
  latestResizeMoveRef.current = handleResizeMove;
  latestResizeEndRef.current = handleResizeEnd;
  
  // Estilo para la línea de tiempo actual (playhead needle)
  // z-index 25 ensures it renders ABOVE clips (z:1-10) but below overlays (z:30)
  const currentTimeIndicatorStyle = {
    left: `${currentTime * zoom}px`,
    height: '100%',
    position: 'absolute' as const,
    top: 0,
    width: '2px',
    backgroundColor: '#f97316', // orange-500
    zIndex: 25,
    boxShadow: '0 0 6px rgba(249, 115, 22, 0.7)',
    pointerEvents: 'none' as const, // No bloquear eventos de mouse
  };

  // Height resize handlers
  const handleHeightResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingHeight(true);
    const startY = e.clientY;
    const startHeight = layerHeight;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const newHeight = Math.max(40, Math.min(200, startHeight + deltaY));
      setLayerHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingHeight(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Toggle mute for audio layer
  const handleToggleMute = () => {
    setIsMuted(!isMuted);
    onMuteLayer?.(layer.id, !isMuted);
  };

  // Toggle lock state
  const handleToggleLock = () => {
    if (isAudioLayer) return;
    setIsLocked(!isLocked);
  };

  // Toggle visibility
  const handleToggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  // Convert all images to video
  const handleConvertAllToVideo = () => {
    onConvertAllToVideo?.(layer.id);
  };

  // Determine layer icon and color based on type
  const isVideoLayer = layer.type === LayerType.IMAGEN;

  // Professional gray color palette
  const headerBgColor = isAudioLayer 
    ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' 
    : 'linear-gradient(135deg, #18181b 0%, #27272a 100%)';
  
  const contentBgColor = isAudioLayer 
    ? (isMuted ? '#1a1a2e' : '#0f172a')
    : '#171717';

  const accentColor = isAudioLayer ? '#3b82f6' : '#f97316';
  
  return (
    <div 
      className={`timeline-layer group relative ${isDraggingThis ? 'opacity-40' : ''} ${isDropTarget ? 'ring-2 ring-blue-500/50 ring-inset' : ''}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        marginBottom: '2px',
        position: 'relative',
        transition: 'opacity 0.15s, box-shadow 0.15s',
      }}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; onTrackDragOver?.(layer.id); }}
      onDrop={(e) => { e.preventDefault(); onTrackDragEnd?.(); }}
    >
      {/* Main Row */}
      <div 
        className="flex w-full transition-all duration-200"
        style={{ height: isExpanded ? `${layerHeight}px` : '32px' }}
      >
        {/* Layer Header - Professional Design */}
        <div 
          className="layer-header flex-shrink-0 relative group/header"
          onContextMenu={handleContextMenu}
          style={{
            width: `${layerLabelWidth}px`,
            minWidth: '80px',
            maxWidth: '200px',
            background: headerBgColor,
            color: 'white',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            padding: '4px 6px',
            position: 'sticky',
            left: 0,
            zIndex: 5,
            borderRight: `2px solid ${accentColor}`,
            borderRadius: '4px 0 0 4px',
          }}
        >
          {/* Top: Layer name & expand */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1.5 min-w-0">
              {/* Drag handle for reordering */}
              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', String(layer.id));
                  onTrackDragStart?.(layer.id);
                }}
                onDragEnd={() => onTrackDragEnd?.()}
                className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-white/10 transition-colors flex-shrink-0"
                title="Arrastra para reordenar"
              >
                <GripVertical size={10} className="text-white/30 hover:text-white/60" />
              </div>
              <div 
                className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${isLocked ? 'ring-1 ring-yellow-400' : ''}`}
                style={{ backgroundColor: isVisible ? accentColor : '#6b7280' }}
              />
              <span 
                className="font-medium truncate cursor-default"
                style={{ 
                  fontSize: layerLabelWidth < 100 ? '9px' : '10px',
                  opacity: isVisible ? 1 : 0.5 
                }}
                title={layer.name}
                onDoubleClick={startRename}
              >
                {isRenaming ? null : (isAudioLayer ? 'Audio Track' : 'Video Track')}
                {!isRenaming && isLocked && ' 🔒'}
              </span>
              {isRenaming && (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={e => setRenameValue(e.target.value)}
                  onBlur={submitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') submitRename();
                    if (e.key === 'Escape') cancelRename();
                  }}
                  className="bg-white/10 border border-white/20 rounded px-1 py-0 text-white outline-none w-full"
                  style={{ fontSize: layerLabelWidth < 100 ? '9px' : '10px' }}
                  maxLength={30}
                />
              )}
            </div>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-0.5 rounded hover:bg-white/10 transition-colors flex-shrink-0"
              title={isExpanded ? 'Collapse' : 'Expand'}
            >
              {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>

          {/* Bottom: Controls (visible when expanded) */}
          {isExpanded && (
            <div className="flex items-center justify-between gap-1 mt-1">
              {/* Left controls */}
              <div className="flex items-center gap-0.5">
                {/* Audio: Mute button */}
                {isAudioLayer && (
                  <button
                    onClick={handleToggleMute}
                    className={`p-1 rounded transition-all ${
                      isMuted 
                        ? 'bg-red-500/30 text-red-400' 
                        : 'hover:bg-white/10 text-blue-400'
                    }`}
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted ? <VolumeX size={11} /> : <Volume2 size={11} />}
                  </button>
                )}

                {/* Video: Convert all to video */}
                {isVideoLayer && (
                  <button
                    onClick={handleConvertAllToVideo}
                    className="p-1 rounded hover:bg-orange-500/20 text-orange-400 transition-all"
                    title="Convert All to Video"
                  >
                    <Film size={11} />
                  </button>
                )}

                {/* Lock toggle */}
                <button
                  onClick={handleToggleLock}
                  disabled={isAudioLayer}
                  className={`p-1 rounded transition-all ${
                    isAudioLayer
                      ? 'opacity-40 cursor-not-allowed'
                      : isLocked 
                        ? 'bg-yellow-500/20 text-yellow-400' 
                        : 'hover:bg-white/10 text-white/40'
                  }`}
                  title={isAudioLayer ? 'Audio layer always editable' : (isLocked ? 'Unlock Layer' : 'Lock Layer')}
                >
                  {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                </button>

                {/* Visibility toggle */}
                <button
                  onClick={handleToggleVisibility}
                  className={`p-1 rounded transition-all ${
                    !isVisible 
                      ? 'bg-gray-500/20 text-gray-500' 
                      : 'hover:bg-white/10 text-white/40'
                  }`}
                  title={isVisible ? 'Hide Layer' : 'Show Layer'}
                >
                  {isVisible ? <Eye size={10} /> : <EyeOff size={10} />}
                </button>
              </div>

              {/* Clip count badge */}
              <div 
                className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ 
                  backgroundColor: `${accentColor}20`,
                  color: accentColor 
                }}
                title={`${layerClips.length} clip${layerClips.length !== 1 ? 's' : ''}`}
              >
                {layerClips.length}
              </div>
            </div>
          )}
        </div>
      
        {/* Layer Content (clips) */}
        <div 
          className={`layer-content relative flex-1 overflow-visible transition-all ${isLocked && !isAudioLayer ? 'pointer-events-none' : ''}`}
          data-layer-id={layer.id}
          style={{
            height: '100%',
            backgroundColor: contentBgColor,
            opacity: isVisible ? (isMuted && isAudioLayer ? 0.6 : 1) : 0.3,
            borderBottom: '1px solid rgba(255,255,255,0.03)',
            backgroundImage: isAudioLayer 
              ? 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(59,130,246,0.03) 10px, rgba(59,130,246,0.03) 11px)'
              : 'repeating-linear-gradient(90deg, transparent, transparent 10px, rgba(249,115,22,0.02) 10px, rgba(249,115,22,0.02) 11px)',
            filter: isLocked ? 'grayscale(0.5)' : 'none',
          }}
        >
          {/* Locked overlay */}
          {isLocked && !isAudioLayer && (
            <div className="absolute inset-0 bg-yellow-900/20 z-20 flex items-center justify-center">
              <div className="flex items-center gap-1 text-yellow-400 bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">
                <Lock size={12} />
                <span className="text-[10px] font-medium">LOCKED</span>
              </div>
            </div>
          )}

          {/* Hidden overlay */}
          {!isVisible && (
            <div className="absolute inset-0 bg-gray-900/60 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1 text-gray-400 bg-gray-500/10 px-2 py-1 rounded border border-gray-500/20">
                <EyeOff size={12} />
                <span className="text-[10px] font-medium">HIDDEN</span>
              </div>
            </div>
          )}

          {/* Muted overlay for audio */}
          {isMuted && isAudioLayer && isVisible && !isLocked && (
            <div className="absolute inset-0 bg-gray-900/50 z-20 flex items-center justify-center pointer-events-none">
              <div className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-1 rounded">
                <VolumeX size={12} />
                <span className="text-[10px] font-medium">MUTED</span>
              </div>
            </div>
          )}

          {/* Current time indicator */}
          <div style={currentTimeIndicatorStyle} />

          {/* Snap indicator line - shows magnetic snap targets */}
          {activeSnap?.didSnap && (
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30"
              style={{
                left: `${activeSnap.time * zoom}px`,
                width: '2px',
                background: activeSnap.targetType === 'beat' 
                  ? '#a855f7'  // purple for beats
                  : activeSnap.targetType === 'clip-start' || activeSnap.targetType === 'clip-end'
                  ? '#22c55e'  // green for clip edges
                  : activeSnap.targetType === 'playhead'
                  ? '#f97316'  // orange for playhead
                  : '#3b82f6', // blue for others
                boxShadow: `0 0 6px ${
                  activeSnap.targetType === 'beat' ? 'rgba(168,85,247,0.6)' :
                  activeSnap.targetType === 'clip-start' || activeSnap.targetType === 'clip-end' ? 'rgba(34,197,94,0.6)' :
                  'rgba(59,130,246,0.6)'
                }`,
              }}
            />
          )}
        
          {/* Render clips */}
          {layerClips.map(clip => (
            <ClipItem
              key={clip.id}
              clip={clip}
              timeScale={zoom}
              isSelected={selectedClipId === clip.id}
              tool={tool}
              onSelect={(id) => {
                if (!isLocked || isAudioLayer) onSelectClip(id);
              }}
              onMoveStart={(id, e) => {
                if (!isLocked || isAudioLayer) handleDragStart(id, e);
              }}
              onResizeStart={(id, direction, e) => {
                if (!isLocked || isAudioLayer) handleResizeStart(id, direction, e);
              }}
              onRazorClick={onRazorClick}
              onUpdateImageFit={onUpdateImageFit}
              isDragging={draggedClipId === clip.id}
              isResizing={resizingClipId === clip.id}
              onEditImage={onEditImage}
              onAddMusician={onAddMusician}
              onCameraAngles={onCameraAngles}
              onRegenerateImage={onRegenerateImage}
              onGenerateVideo={onGenerateVideo}
              onUseAsReference={onUseAsReference}
              onUseAsStyle={onUseAsStyle}
              onVariations={onVariations}
              onUpscale={onUpscale}
              onLike={onLike}
              onChoreography={onChoreography}
              onDeleteClip={onDeleteClip}
              onHoverStart={onClipHoverStart}
              onHoverEnd={onClipHoverEnd}
            />
          ))}

          {/* Empty state */}
          {layerClips.length === 0 && isExpanded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-white/20 italic">
                {isAudioLayer ? 'Drop audio here' : 'Drop clips here'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Resize Handle - Bottom edge */}
      {isExpanded && (
        <div
          className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize group/resize z-10"
          onMouseDown={handleHeightResizeStart}
        >
          <div 
            className={`absolute inset-x-0 bottom-0 h-0.5 transition-all ${
              isResizingHeight 
                ? 'bg-orange-500' 
                : 'bg-transparent group-hover/resize:bg-white/20'
            }`}
          />
          <div 
            className={`absolute left-1/2 -translate-x-1/2 bottom-0 transition-opacity ${
              isResizingHeight ? 'opacity-100' : 'opacity-0 group-hover/resize:opacity-100'
            }`}
          >
            <GripVertical size={10} className="text-white/40 rotate-90" />
          </div>
        </div>
      )}

      {/* Right-click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <div className="bg-[#1a1a2e] border border-white/15 rounded-lg shadow-2xl shadow-black/80 py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="px-3 py-1.5 border-b border-white/10">
              <span className="text-[9px] uppercase tracking-wider text-white/30 font-medium">
                {isAudioLayer ? '🎵 Audio Track' : '🎬 Video Track'}
              </span>
            </div>

            {/* Rename */}
            <button
              onClick={startRename}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
            >
              <Pencil size={12} className="text-blue-400" />
              Renombrar Track
            </button>

            {/* Duplicate */}
            <button
              onClick={() => { onDuplicateTrack?.(layer.id); closeContextMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
            >
              <Copy size={12} className="text-cyan-400" />
              Duplicar Track
            </button>

            {/* Separator */}
            <div className="border-t border-white/10 my-1" />

            {/* Move Up */}
            <button
              onClick={() => { onReorderTrack?.(layer.id, 'up'); closeContextMenu(); }}
              disabled={layerIndex === 0}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                layerIndex === 0 ? 'text-white/20 cursor-not-allowed' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <ArrowUp size={12} className="text-emerald-400" />
              Mover Arriba
            </button>

            {/* Move Down */}
            <button
              onClick={() => { onReorderTrack?.(layer.id, 'down'); closeContextMenu(); }}
              disabled={layerIndex === totalLayers - 1}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                layerIndex === totalLayers - 1 ? 'text-white/20 cursor-not-allowed' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <ArrowDown size={12} className="text-emerald-400" />
              Mover Abajo
            </button>

            {/* Separator */}
            <div className="border-t border-white/10 my-1" />

            {/* Add Video Track */}
            <button
              onClick={() => { onAddTrack?.(layer.id, 'video'); closeContextMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
            >
              <Video size={12} className="text-orange-400" />
              Añadir Video Track
            </button>

            {/* Add Audio Track */}
            <button
              onClick={() => { onAddTrack?.(layer.id, 'audio'); closeContextMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-[11px] text-white/80 hover:bg-white/10 transition-colors"
            >
              <Music size={12} className="text-blue-400" />
              Añadir Audio Track
            </button>

            {/* Separator */}
            <div className="border-t border-white/10 my-1" />

            {/* Delete */}
            <button
              onClick={() => { onDeleteTrack?.(layer.id); closeContextMenu(); }}
              disabled={!canDeleteTrack}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] transition-colors ${
                canDeleteTrack
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-white/20 cursor-not-allowed'
              }`}
            >
              <Trash2 size={12} />
              Eliminar Track
              {!canDeleteTrack && <span className="ml-auto text-[9px] text-white/20">mín. 1</span>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};