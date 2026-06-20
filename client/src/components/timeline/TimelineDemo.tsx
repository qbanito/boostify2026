/**
 * Componente de demostración del Timeline Editor
 * 
 * Este componente integra todos los elementos del editor de línea de tiempo
 * en una demostración funcional, incluyendo capas, clips, y operaciones.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ZoomIn, 
  ZoomOut, 
  Play, 
  Pause, 
  PlusCircle, 
  SkipBack,
  SkipForward
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Slider } from '../../components/ui/slider';
import { LayerType } from '../../interfaces/timeline';
import { ClipOperation } from '../../constants/timeline-constants';
import { useToast } from '../../hooks/use-toast';
import LayerManager from './LayerManager';
import { useTimelineLayers } from '../../hooks/useTimelineLayers';
import { useIsolatedLayers } from '../../hooks/useIsolatedLayers';
import { TimelineClip } from './TimelineClip';

/**
 * Propiedades para el componente TimelineDemo
 */
interface TimelineDemoProps {
  initialClips?: TimelineClip[];
  mode?: 'view' | 'edit';
  onTimelineUpdate?: (clips: TimelineClip[]) => void;
}

/**
 * Componente demo que muestra y permite interactuar con la línea de tiempo
 */
const TimelineDemo: React.FC<TimelineDemoProps> = ({
  initialClips = [],
  mode = 'edit',
  onTimelineUpdate
}) => {
  // Referencias
  const timelineRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  
  // Estado
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [selectedClipId, setSelectedClipId] = useState<number | null>(null);
  const [draggingClipId, setDraggingClipId] = useState<number | null>(null);
  const [resizingClipId, setResizingClipId] = useState<number | null>(null);
  const [resizeHandle, setResizeHandle] = useState<'start' | 'end' | null>(null);
  const [dragStartX, setDragStartX] = useState<number>(0);
  const [clipStartPosition, setClipStartPosition] = useState<number>(0);
  const [clipDuration, setClipDuration] = useState<number>(0);
  const [duration, setDuration] = useState<number>(60); // 60 segundos por defecto
  const [zoom, setZoom] = useState<number>(1);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackInterval, setPlaybackInterval] = useState<NodeJS.Timeout | null>(null);
  
  const { toast } = useToast();
  
  // Constantes
  const PIXELS_PER_SECOND = 100;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 5.0;
  
  // Configuración de capas aisladas
  const isolatedLayerTypes = [LayerType.AUDIO];
  
  // Hooks personalizados
  const {
    layers,
    visibleLayers,
    lockedLayers,
    selectedLayerId,
    addLayer,
    removeLayer,
    toggleLayerVisibility,
    toggleLayerLock,
    selectLayer
  } = useTimelineLayers([], {
    createDefaultLayers: true,
    isolatedLayerTypes
  });
  
  const {
    validateClipOperation,
    getLastError,
    clearError
  } = useIsolatedLayers({
    restrictedLayerTypes: isolatedLayerTypes,
    maxAIPlaceholderDuration: 5,
    allowOverlap: false
  });
  
  // Convertir tiempo a píxeles
  const timeToPixels = useCallback((time: number) => {
    return time * PIXELS_PER_SECOND * zoom;
  }, [zoom]);
  
  // Convertir píxeles a tiempo
  const pixelsToTime = useCallback((pixels: number) => {
    return pixels / (PIXELS_PER_SECOND * zoom);
  }, [zoom]);
  
  // Ancho total de la línea de tiempo en píxeles
  const timelineWidth = timeToPixels(duration);
  
  // Obtener un clip por su ID
  const getClipById = useCallback((id: number) => {
    return clips.find(clip => clip.id === id) || null;
  }, [clips]);
  
  // Ajustar zoom
  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, MAX_ZOOM));
  };
  
  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev * 0.8, MIN_ZOOM));
  };
  
  // Reproducción
  const handlePlay = () => {
    if (isPlaying) {
      // Pausar
      if (playbackInterval) {
        clearInterval(playbackInterval);
        setPlaybackInterval(null);
      }
      setIsPlaying(false);
    } else {
      // Reproducir
      const interval = setInterval(() => {
        setCurrentTime(prev => {
          if (prev >= duration) {
            clearInterval(interval);
            setPlaybackInterval(null);
            setIsPlaying(false);
            return 0;
          }
          return prev + 0.1;
        });
      }, 100);
      setPlaybackInterval(interval);
      setIsPlaying(true);
    }
  };
  
  const handleSeek = (time: number) => {
    if (time < 0) time = 0;
    if (time > duration) time = duration;
    setCurrentTime(time);
  };
  
  // Limpiar intervalo al desmontar
  useEffect(() => {
    return () => {
      if (playbackInterval) {
        clearInterval(playbackInterval);
      }
    };
  }, [playbackInterval]);
  
  // Manejar operaciones de clips
  const handleAddClip = (type: string, layerId: number) => {
    const layer = layers.find(l => l.id === layerId);
    if (!layer) return;
    
    // Generar ID único para el nuevo clip
    const maxId = Math.max(0, ...clips.map(c => c.id));
    const newId = maxId + 1;
    
    // Crear clip en la posición actual
    const newClip: TimelineClip = {
      id: newId,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} ${newId}`,
      type: type,
      layer: layerId,
      start: currentTime,
      duration: type === LayerType.AI_PLACEHOLDER ? 5 : 10,
      metadata: {
        isAIGenerated: type === LayerType.AI_PLACEHOLDER
      }
    };
    
    // Validar operación
    const validationResult = validateClipOperation(newClip, clips, ClipOperation.ADD);
    if (!validationResult.isValid) {
      toast({
        title: 'Error al añadir clip',
        description: validationResult.error || 'No se puede añadir el clip en esta posición',
        variant: 'destructive'
      });
      return;
    }
    
    // Agregar clip
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newId);
    
    // Notificar cambios
    if (onTimelineUpdate) {
      onTimelineUpdate([...clips, newClip]);
    }
  };
  
  const handleSelectClip = (id: number, multiSelect: boolean = false) => {
    if (mode === 'view') return;
    
    // Si el clip está en una capa bloqueada, no seleccionar
    const clip = getClipById(id);
    if (clip && lockedLayers[clip.layer]) {
      return;
    }
    
    setSelectedClipId(id);
  };
  
  const handleDeleteClip = (id: number) => {
    if (mode === 'view') return;
    
    // Obtener el clip
    const clip = getClipById(id);
    if (!clip) return;
    
    // Validar operación
    const validationResult = validateClipOperation(clip, clips, ClipOperation.DELETE);
    if (!validationResult.isValid) {
      toast({
        title: 'Error al eliminar clip',
        description: validationResult.error || 'No se puede eliminar este clip',
        variant: 'destructive'
      });
      return;
    }
    
    // Eliminar clip
    setClips(prev => prev.filter(c => c.id !== id));
    
    // Deseleccionar si era el seleccionado
    if (selectedClipId === id) {
      setSelectedClipId(null);
    }
    
    // Notificar cambios
    if (onTimelineUpdate) {
      onTimelineUpdate(clips.filter(c => c.id !== id));
    }
  };
  
  const handleDuplicateClip = (id: number) => {
    if (mode === 'view') return;
    
    // Obtener el clip a duplicar
    const clip = getClipById(id);
    if (!clip) return;
    
    // Generar nuevo ID para el duplicado
    const maxId = Math.max(0, ...clips.map(c => c.id));
    const newId = maxId + 1;
    
    // Crear duplicado con posición ajustada
    const newClip: TimelineClip = {
      ...clip,
      id: newId,
      title: `${clip.title} (copia)`,
      start: clip.start + clip.duration + 0.5 // Colocar justo después del original
    };
    
    // Validar operación
    const validationResult = validateClipOperation(newClip, clips, ClipOperation.ADD);
    if (!validationResult.isValid) {
      toast({
        title: 'Error al duplicar clip',
        description: validationResult.error || 'No se puede duplicar el clip en esta posición',
        variant: 'destructive'
      });
      return;
    }
    
    // Agregar duplicado y seleccionarlo
    setClips(prev => [...prev, newClip]);
    setSelectedClipId(newId);
    
    // Notificar cambios
    if (onTimelineUpdate) {
      onTimelineUpdate([...clips, newClip]);
    }
  };
  
  const handleSplitClip = (id: number, splitTime: number) => {
    if (mode === 'view') return;
    
    // Obtener el clip a dividir
    const clip = getClipById(id);
    if (!clip) return;
    
    // Validar operación
    const validationResult = validateClipOperation(clip, clips, ClipOperation.SPLIT);
    if (!validationResult.isValid) {
      toast({
        title: 'Error al dividir clip',
        description: validationResult.error || 'No se puede dividir este clip',
        variant: 'destructive'
      });
      return;
    }
    
    // Asegurarse que el punto de división está dentro del clip
    if (splitTime <= clip.start || splitTime >= clip.start + clip.duration) {
      toast({
        title: 'Error al dividir clip',
        description: 'El punto de división debe estar dentro del clip',
        variant: 'destructive'
      });
      return;
    }
    
    // Generar nuevo ID para el segundo clip
    const maxId = Math.max(0, ...clips.map(c => c.id));
    const newId = maxId + 1;
    
    // Crear primer parte del clip (clip original modificado)
    const firstClip: TimelineClip = {
      ...clip,
      duration: splitTime - clip.start
    };
    
    // Crear segunda parte del clip
    const secondClip: TimelineClip = {
      ...clip,
      id: newId,
      title: `${clip.title} (parte 2)`,
      start: splitTime,
      duration: (clip.start + clip.duration) - splitTime
    };
    
    // Actualizar clips
    setClips(prev => [
      ...prev.filter(c => c.id !== id),
      firstClip,
      secondClip
    ]);
    
    // Seleccionar segundo clip
    setSelectedClipId(newId);
    
    // Notificar cambios
    if (onTimelineUpdate) {
      onTimelineUpdate([
        ...clips.filter(c => c.id !== id),
        firstClip,
        secondClip
      ]);
    }
  };
  
  const handleStartDragClip = (e: React.MouseEvent, clipId: number, handle?: 'start' | 'end' | 'body') => {
    if (mode === 'view') return;
    
    const clip = getClipById(clipId);
    if (!clip || lockedLayers[clip.layer]) return;
    
    // Obtener posición inicial
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    if (!timelineRect) return;
    
    const mouseX = e.clientX - timelineRect.left;
    
    // Iniciar arrastre o redimensionamiento
    if (handle === 'start' || handle === 'end') {
      // Iniciar redimensionamiento
      setResizingClipId(clipId);
      setResizeHandle(handle);
      setDragStartX(mouseX);
      setClipStartPosition(clip.start);
      setClipDuration(clip.duration);
    } else {
      // Iniciar arrastre
      setDraggingClipId(clipId);
      setDragStartX(mouseX);
      setClipStartPosition(clip.start);
    }
    
    // Seleccionar el clip
    setSelectedClipId(clipId);
    
    // Agregar event listeners
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  const handleMouseMove = useCallback((e: MouseEvent) => {
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    if (!timelineRect) return;
    
    const mouseX = e.clientX - timelineRect.left;
    const deltaPixels = mouseX - dragStartX;
    const deltaTime = pixelsToTime(deltaPixels);
    
    if (draggingClipId !== null) {
      // Mover clip
      const clip = getClipById(draggingClipId);
      if (!clip) return;
      
      let newStart = clipStartPosition + deltaTime;
      
      // Asegurar que el clip no salga del timeline
      if (newStart < 0) newStart = 0;
      if (newStart + clip.duration > duration) {
        newStart = duration - clip.duration;
      }
      
      // Verificar validez
      const updatedClip = { ...clip, start: newStart };
      const validationResult = validateClipOperation(
        updatedClip, 
        clips.filter(c => c.id !== draggingClipId),
        ClipOperation.MOVE
      );
      
      if (validationResult.isValid) {
        // Aplicar movimiento
        setClips(prev => prev.map(c => 
          c.id === draggingClipId 
            ? { ...c, start: newStart } 
            : c
        ));
      }
    } else if (resizingClipId !== null && resizeHandle !== null) {
      // Redimensionar clip
      const clip = getClipById(resizingClipId);
      if (!clip) return;
      
      let newStart = clip.start;
      let newDuration = clip.duration;
      
      if (resizeHandle === 'start') {
        // Ajustar inicio del clip
        newStart = clipStartPosition + deltaTime;
        newDuration = clipDuration - deltaTime;
        
        // Restricciones
        if (newStart < 0) {
          newStart = 0;
          newDuration = clipStartPosition + clipDuration;
        }
        if (newDuration < 0.5) {
          newDuration = 0.5;
          newStart = clipStartPosition + clipDuration - 0.5;
        }
      } else if (resizeHandle === 'end') {
        // Ajustar duración del clip
        newDuration = clipDuration + deltaTime;
        
        // Restricciones
        if (newDuration < 0.5) newDuration = 0.5;
        if (newStart + newDuration > duration) {
          newDuration = duration - newStart;
        }
      }
      
      // Validar operación
      const updatedClip = { ...clip, start: newStart, duration: newDuration };
      const resizeOp = resizeHandle === 'start' ? ClipOperation.RESIZE_START : ClipOperation.RESIZE_END;
      const validationResult = validateClipOperation(
        updatedClip, 
        clips.filter(c => c.id !== resizingClipId),
        resizeOp
      );
      
      if (validationResult.isValid) {
        // Aplicar redimensionamiento
        setClips(prev => prev.map(c => 
          c.id === resizingClipId 
            ? { ...c, start: newStart, duration: newDuration } 
            : c
        ));
      }
    }
  }, [
    draggingClipId, 
    resizingClipId, 
    resizeHandle, 
    dragStartX, 
    clipStartPosition, 
    clipDuration, 
    pixelsToTime, 
    getClipById, 
    validateClipOperation, 
    clips,
    duration
  ]);
  
  const handleMouseUp = useCallback(() => {
    // Finalizar arrastre o redimensionamiento
    if (draggingClipId !== null || resizingClipId !== null) {
      // Notificar cambios
      if (onTimelineUpdate) {
        onTimelineUpdate(clips);
      }
    }
    
    setDraggingClipId(null);
    setResizingClipId(null);
    setResizeHandle(null);
    
    // Quitar event listeners
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [
    draggingClipId, 
    resizingClipId, 
    clips, 
    handleMouseMove, 
    onTimelineUpdate
  ]);
  
  const handlePreviewClip = (id: number) => {
    const clip = getClipById(id);
    if (!clip) return;
    
    // Mover playhead al inicio del clip
    setCurrentTime(clip.start);
    
    // Iniciar reproducción si no está reproduciendo
    if (!isPlaying) {
      handlePlay();
    }
  };
  
  const handleTimelineClick = (e: React.MouseEvent) => {
    const timelineRect = timelineRef.current?.getBoundingClientRect();
    if (!timelineRect) return;
    
    const clickX = e.clientX - timelineRect.left;
    const clickTime = pixelsToTime(clickX);
    
    handleSeek(clickTime);
  };
  
  return (
    <div className="timeline-demo flex flex-col h-full p-4 bg-background">
      {/* Controles superiores */}
      <div className="timeline-controls flex justify-between items-center p-2 mb-4 bg-secondary rounded-md">
        <div className="playback-controls flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleSeek(0)}
            title="Inicio"
          >
            <SkipBack className="h-4 w-4" />
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlay}
            title={isPlaying ? "Pausar" : "Reproducir"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => handleSeek(duration)}
            title="Final"
          >
            <SkipForward className="h-4 w-4" />
          </Button>
          
          <div className="time-display ml-2 text-sm">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        
        <div className="zoom-controls flex items-center space-x-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <div className="zoom-level text-sm">
            {Math.round(zoom * 100)}%
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Área principal con capas y línea de tiempo */}
      <div className="timeline-container flex flex-1 overflow-hidden">
        {/* Panel de capas */}
        <div className="layers-panel w-60 mr-2 flex flex-col">
          <div className="panel-header px-3 py-2 bg-secondary rounded-t-md font-medium">
            Capas
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <LayerManager
              layers={layers}
              clips={clips}
              visibleLayers={visibleLayers}
              lockedLayers={lockedLayers}
              selectedLayerId={selectedLayerId}
              onAddLayer={(type) => {
                if (mode === 'edit') {
                  addLayer(type);
                }
              }}
              onRemoveLayer={(id) => {
                if (mode === 'edit') {
                  removeLayer(id);
                }
              }}
              onToggleLayerVisibility={toggleLayerVisibility}
              onToggleLayerLock={toggleLayerLock}
              onSelectLayer={selectLayer}
            />
          </div>
          
          {mode === 'edit' && (
            <div className="panel-footer p-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => addLayer('effect')}
              >
                <PlusCircle className="h-4 w-4 mr-1" />
                Añadir Capa
              </Button>
            </div>
          )}
        </div>
        
        {/* Área de línea de tiempo */}
        <div className="timeline-area flex-1 overflow-hidden flex flex-col">
          {/* Regla de tiempo */}
          <div className="time-ruler h-6 bg-secondary rounded-t-md relative">
            <div 
              className="ruler-marks" 
              style={{ width: `${timelineWidth}px` }}
            >
              {/* Marcas de tiempo (cada segundo) */}
              {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                <div 
                  key={i}
                  className="absolute bottom-0 h-3 border-l border-primary/60"
                  style={{ left: `${timeToPixels(i)}px` }}
                >
                  {i % 5 === 0 && (
                    <div className="absolute -translate-x-1/2 text-xs">
                      {formatTime(i)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          {/* Contenedor de la línea de tiempo */}
          <div 
            className="timeline-content flex-1 bg-background rounded-b-md overflow-auto relative"
            ref={timelineRef}
            onClick={handleTimelineClick}
          >
            {/* Área extensible para el timeline */}
            <div 
              className="timeline-canvas"
              style={{ width: `${timelineWidth}px`, minHeight: '100%' }}
            >
              {/* Grid de fondo */}
              <div className="grid-lines absolute inset-0 pointer-events-none">
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div 
                    key={i}
                    className={`absolute top-0 bottom-0 border-l ${
                      i % 5 === 0 ? 'border-gray-400' : 'border-gray-200'
                    }`}
                    style={{ left: `${timeToPixels(i)}px` }}
                  />
                ))}
              </div>
              
              {/* Renderizar clips por capa */}
              {layers.map((layer) => (
                <div 
                  key={layer.id}
                  className={`layer-track relative mb-1 ${
                    !visibleLayers[layer.id] ? 'opacity-50' : ''
                  }`}
                  style={{ height: `${layer.height}px` }}
                >
                  {clips.filter(c => c.layer === layer.id).map((clip) => (
                    <TimelineClip
                      key={clip.id}
                      clip={clip}
                      selected={selectedClipId === clip.id}
                      onSelect={() => handleSelectClip(clip.id)}
                      onDelete={() => handleDeleteClip(clip.id)}
                      onDuplicate={() => handleDuplicateClip(clip.id)}
                      onPreview={() => handlePreviewClip(clip.id)}
                      onDragStart={(e, handle) => handleStartDragClip(e, clip.id, handle)}
                      timeToPixels={timeToPixels}
                      disabled={lockedLayers[layer.id]}
                    />
                  ))}
                </div>
              ))}
              
              {/* Indicador de tiempo actual (playhead) */}
              <div 
                ref={playheadRef}
                className="playhead absolute top-0 bottom-0 w-0.5 bg-red-500 z-10"
                style={{ left: `${timeToPixels(currentTime)}px` }}
              >
                <div className="playhead-handle w-3 h-3 bg-red-500 -ml-1 rounded-full" />
              </div>
            </div>
          </div>
          
          {/* Control deslizante para la línea de tiempo */}
          <div className="timeline-slider mt-2">
            <Slider 
              value={[currentTime]} 
              min={0} 
              max={duration} 
              step={0.01}
              onValueChange={(value) => handleSeek(value[0])}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Formatea segundos a formato mm:ss
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export { TimelineClip };
export default TimelineDemo;