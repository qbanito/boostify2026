/**
 * Componente TimelineLayers - Gestiona y muestra las capas del timeline
 * 
 * Este componente es responsable de renderizar las diferentes capas del timeline
 * y manejar las interacciones del usuario con ellas, como arrastrar clips, etc.
 */
import React, { useState, useEffect } from 'react';
import { LayerRow } from './LayerRow';
import { LayerType, TimelineClip, LayerConfig } from '../../../interfaces/timeline';
import { 
  DEFAULT_LAYER_HEIGHT, 
  LAYER_NAMES, 
  LAYER_COLORS 
} from '../../../constants/timeline-constants';

import type { SnapResult } from '../../../hooks/useTimelineEngine';
import { useCallback } from 'react';

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

type Tool = 'select' | 'razor' | 'trim' | 'hand';

interface TimelineLayersProps extends ClipActionHandlers {
  clips: TimelineClip[];
  currentTime: number;
  duration: number;
  zoom: number;
  tool?: Tool;
  snapEnabled?: boolean;
  onSelectClip: (clipId: number | null) => void;
  selectedClipId: number | null;
  onMoveClip?: (clipId: number, newStart: number, newLayerId: number) => void;
  onResizeClip?: (clipId: number, newStart: number, newDuration: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
  onTimelineClick?: (time: number) => void;
  onRazorClick?: (clipId: number, time: number) => void;
  onDeleteClip?: (clipId: number) => void;
  showBeatGrid?: boolean;
  beatMarkers?: { time: number }[];
  layerLabelWidth?: number;
  onMuteLayer?: (layerId: number, muted: boolean) => void;
  onConvertAllToVideo?: (layerId: number) => void;
  onUpdateImageFit?: (clipId: number, fit: string) => void;
  /** Snap query for visual indicators during drag/resize */
  onSnapQuery?: (time: number, excludeClipId?: number) => SnapResult;
  /** Active snap indicator */
  activeSnap?: SnapResult | null;
}

/**
 * Professional Timeline Layers Component
 */
export const TimelineLayers: React.FC<TimelineLayersProps> = ({
  clips,
  currentTime,
  duration,
  zoom,
  tool = 'select',
  snapEnabled = false,
  onSelectClip,
  selectedClipId,
  onMoveClip,
  onResizeClip,
  onDragStart,
  onDragEnd,
  onResizeStart,
  onResizeEnd,
  onTimelineClick,
  onRazorClick,
  onDeleteClip,
  showBeatGrid = false,
  beatMarkers = [],
  layerLabelWidth = 100,
  onMuteLayer,
  onConvertAllToVideo,
  onUpdateImageFit,
  // Snap engine
  onSnapQuery,
  activeSnap,
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
}) => {
  // Estado para las configuraciones de capas
  const [layers, setLayers] = useState<LayerConfig[]>([]);
  
  // Inicializa las capas al montar el componente
  // BOOSTIFY: 3 capas - Imágenes Generadas, Audio Principal, y Segmentos Lipsync
  useEffect(() => {
    // 3 capas: Imágenes generadas, Audio principal, y Segmentos de audio para lipsync
    const defaultLayers: LayerConfig[] = [
      {
        id: 1,
        name: '🎬 Video/Imágenes',
        type: LayerType.IMAGEN,
        locked: false,
        visible: true,
        height: DEFAULT_LAYER_HEIGHT,
        color: LAYER_COLORS[LayerType.IMAGEN]
      },
      {
        id: 2,
        name: '🎵 Audio Principal',
        type: LayerType.AUDIO,
        locked: false,
        visible: true,
        height: DEFAULT_LAYER_HEIGHT,
        color: LAYER_COLORS[LayerType.AUDIO]
      },
      {
        id: 3,
        name: '🎤 Lipsync Segments',
        type: LayerType.AUDIO,
        locked: false,
        visible: true,
        height: DEFAULT_LAYER_HEIGHT,
        color: '#f97316' // Naranja para lipsync
      }
    ];
    
    setLayers(defaultLayers);
  }, []);

  // ── Track management handlers ──

  const handleAddTrack = useCallback((afterLayerId: number, type: 'video' | 'audio') => {
    setLayers(prev => {
      const maxId = Math.max(...prev.map(l => l.id), 0);
      const newId = maxId + 1;
      const isAudio = type === 'audio';
      const layerType = isAudio ? LayerType.AUDIO : LayerType.IMAGEN;
      const count = prev.filter(l => isAudio ? l.type === LayerType.AUDIO : l.type !== LayerType.AUDIO).length + 1;

      const newLayer: LayerConfig = {
        id: newId,
        name: isAudio ? `🎵 Audio Track ${count}` : `🎬 Video Track ${count}`,
        type: layerType,
        locked: false,
        visible: true,
        height: DEFAULT_LAYER_HEIGHT,
        color: isAudio ? LAYER_COLORS[LayerType.AUDIO] : LAYER_COLORS[LayerType.IMAGEN],
      };

      const idx = prev.findIndex(l => l.id === afterLayerId);
      const insertIdx = idx >= 0 ? idx + 1 : prev.length;
      const next = [...prev];
      next.splice(insertIdx, 0, newLayer);
      return next;
    });
  }, []);

  const handleDeleteTrack = useCallback((layerId: number) => {
    setLayers(prev => {
      if (prev.length <= 1) return prev; // Always keep at least 1 track
      return prev.filter(l => l.id !== layerId);
    });
  }, []);

  const handleRenameTrack = useCallback((layerId: number, newName: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, name: newName } : l));
  }, []);

  const handleDuplicateTrack = useCallback((layerId: number) => {
    setLayers(prev => {
      const source = prev.find(l => l.id === layerId);
      if (!source) return prev;
      const maxId = Math.max(...prev.map(l => l.id), 0);
      const newLayer: LayerConfig = {
        ...source,
        id: maxId + 1,
        name: `${source.name} (copy)`,
      };
      const idx = prev.findIndex(l => l.id === layerId);
      const next = [...prev];
      next.splice(idx + 1, 0, newLayer);
      return next;
    });
  }, []);

  // ── Track reorder (drag & drop) ──
  const [draggingTrackId, setDraggingTrackId] = useState<number | null>(null);
  const [dropTargetId, setDropTargetId] = useState<number | null>(null);

  const handleTrackDragStart = useCallback((layerId: number) => {
    setDraggingTrackId(layerId);
  }, []);

  const handleTrackDragOver = useCallback((layerId: number) => {
    setDropTargetId(layerId);
  }, []);

  const handleTrackDragEnd = useCallback(() => {
    if (draggingTrackId != null && dropTargetId != null && draggingTrackId !== dropTargetId) {
      setLayers(prev => {
        const next = [...prev];
        const fromIdx = next.findIndex(l => l.id === draggingTrackId);
        const toIdx = next.findIndex(l => l.id === dropTargetId);
        if (fromIdx < 0 || toIdx < 0) return prev;
        const [moved] = next.splice(fromIdx, 1);
        next.splice(toIdx, 0, moved);
        return next;
      });
    }
    setDraggingTrackId(null);
    setDropTargetId(null);
  }, [draggingTrackId, dropTargetId]);

  const handleReorderTrack = useCallback((layerId: number, direction: 'up' | 'down') => {
    setLayers(prev => {
      const idx = prev.findIndex(l => l.id === layerId);
      if (idx < 0) return prev;
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  }, []);

  // Handler para click en el timeline (mover playhead)
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onTimelineClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left - layerLabelWidth;
    if (clickX >= 0) {
      const time = clickX / zoom;
      onTimelineClick(Math.max(0, Math.min(duration, time)));
    }
  };

  return (
    <div 
      className="timeline-layers"
      style={{
        position: 'relative',
        minWidth: '100%',
        height: '100%',
        // FIXED: Removed overflowX/overflowY — parent timelineScrollRef handles horizontal scroll.
        // CSS spec quirk: if one axis is auto/scroll/hidden, the other can't be 'visible' and becomes 'auto'.
        // This was creating a nested scroll container that prevented full timeline scrolling.
        background: 'linear-gradient(180deg, #0d0d0d 0%, #111111 50%, #0a0a0a 100%)',
        cursor: 'pointer',
        borderRadius: '6px',
      }}
      onClick={handleContainerClick}
    >
      {/* Grid de marcadores de tiempo (beats) */}
      {showBeatGrid && beatMarkers && beatMarkers.length > 0 && (
        <div 
          className="beat-grid"
          style={{
            position: 'absolute',
            top: 0,
            left: `${layerLabelWidth}px`,
            width: `calc(100% - ${layerLabelWidth}px)`,
            height: '100%',
            pointerEvents: 'none',
            zIndex: 1
          }}
        >
          {beatMarkers.map((marker, index) => (
            <div
              key={`beat-${index}`}
              className="beat-marker"
              style={{
                position: 'absolute',
                left: `${marker.time * zoom}px`,
                top: 0,
                width: '1px',
                height: '100%',
                backgroundColor: 'rgba(249, 115, 22, 0.15)',
                pointerEvents: 'none'
              }}
            />
          ))}
        </div>
      )}
      
      {/* Render timeline layers */}
      <div className="layers-container" style={{ minHeight: '100%', minWidth: `${layerLabelWidth + duration * zoom + 40}px` }}>
        {layers.map((layer, idx) => (
          <LayerRow 
            key={layer.id}
            layer={layer}
            clips={clips}
            zoom={zoom}
            currentTime={currentTime}
            duration={duration}
            tool={tool}
            onSelectClip={onSelectClip}
            selectedClipId={selectedClipId}
            onMoveClip={onMoveClip}
            onResizeClip={onResizeClip}
            onRazorClick={onRazorClick}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onResizeStart={onResizeStart}
            onResizeEnd={onResizeEnd}
            layerLabelWidth={layerLabelWidth}
            onMuteLayer={onMuteLayer}
            onConvertAllToVideo={onConvertAllToVideo}
            onUpdateImageFit={onUpdateImageFit}
            // Snap engine
            onSnapQuery={onSnapQuery}
            activeSnap={activeSnap}
            // Track management
            onAddTrack={handleAddTrack}
            onDeleteTrack={handleDeleteTrack}
            onRenameTrack={handleRenameTrack}
            onDuplicateTrack={handleDuplicateTrack}
            canDeleteTrack={layers.length > 1}
            // Track reorder
            onReorderTrack={handleReorderTrack}
            onTrackDragStart={handleTrackDragStart}
            onTrackDragOver={handleTrackDragOver}
            onTrackDragEnd={handleTrackDragEnd}
            isDraggingThis={draggingTrackId === layer.id}
            isDropTarget={dropTargetId === layer.id && draggingTrackId !== layer.id}
            layerIndex={idx}
            totalLayers={layers.length}
            // Clip actions
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
            onClipHoverStart={onClipHoverStart}
            onClipHoverEnd={onClipHoverEnd}
          />
        ))}
      </div>
      
      {/* Estilos para scrollbar personalizados */}
      <style dangerouslySetInnerHTML={{ __html: `
        .timeline-layers {
          border-radius: 6px;
          scrollbar-width: thin;
          scrollbar-color: #3f3f46 #18181b;
          background: linear-gradient(180deg, #0a0a0a 0%, #141414 100%);
        }
        
        .timeline-layers::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .timeline-layers::-webkit-scrollbar-track {
          background: #2a2a2a;
          border-radius: 4px;
        }
        
        .timeline-layers::-webkit-scrollbar-thumb {
          background: #555;
          border-radius: 4px;
        }
        
        .timeline-layers::-webkit-scrollbar-thumb:hover {
          background: #666;
        }
        
        @media (max-width: 640px) {
          .timeline-layers::-webkit-scrollbar {
            width: 4px;
            height: 4px;
          }
        }
      `}} />
    </div>
  );
};