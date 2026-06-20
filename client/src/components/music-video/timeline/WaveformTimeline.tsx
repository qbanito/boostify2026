/**
import { logger } from "../../lib/logger";
 * Componente de línea de tiempo avanzado con waveform
 * Utiliza wavesurfer.js para renderizar forma de onda de audio
 * e implementa un timeline más preciso con detección de colisiones
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Button } from '../../ui/button';
import { ScrollArea } from '../../ui/scroll-area';
import { cn } from '../../../lib/utils';
import { Play, Pause, ZoomIn, ZoomOut } from 'lucide-react';
import { TimelineClip } from '../../../interfaces/timeline';

interface WaveformTimelineProps {
  audioUrl?: string;
  duration: number;
  currentTime: number;
  clips: TimelineClip[];
  onClipUpdate: (clipId: number, updates: Partial<TimelineClip>) => void;
  onTimeUpdate: (time: number) => void;
  isPlaying: boolean;
  onPlayPause: () => void;
}

/**
 * Componente de línea de tiempo con forma de onda y detección de colisiones entre clips
 */
export function WaveformTimeline({
  audioUrl,
  duration,
  currentTime,
  clips,
  onClipUpdate,
  onTimeUpdate,
  isPlaying,
  onPlayPause
}: WaveformTimelineProps) {
  // Referencias para los elementos DOM
  const waveformRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  
  // Estados locales
  const [zoom, setZoom] = useState(1);
  const [isWaveSurferReady, setIsWaveSurferReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragData, setDragData] = useState<{
    clipId: number;
    type: 'move' | 'resize-start' | 'resize-end';
    startX: number;
    startTime: number;
    clipStartPosition: number;
    clipDuration: number;
  } | null>(null);
  
  // Estado para el drag de la cabeza de reproducción
  const [draggingPlayhead, setDraggingPlayhead] = useState(false);
  
  // Factor de conversión de tiempo a píxeles (y viceversa)
  const pixelsPerSecond = 100 * zoom;
  const timeToPixels = useCallback((time: number) => time * pixelsPerSecond, [pixelsPerSecond]);
  const pixelsToTime = useCallback((pixels: number) => pixels / pixelsPerSecond, [pixelsPerSecond]);
  
  // Inicialización de WaveSurfer
  useEffect(() => {
    if (!waveformRef.current) return;
    
    let isMounted = true;
    let wavesurferInstance: WaveSurfer | null = null;
    
    // Crear instancia de WaveSurfer si no existe
    if (!wavesurferRef.current) {
      const wavesurfer = WaveSurfer.create({
        container: waveformRef.current,
        waveColor: 'rgba(249, 115, 22, 0.4)',
        progressColor: 'rgba(249, 115, 22, 0.8)',
        cursorColor: '#f97316',
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 60,
        normalize: true,
      });
      
      // Configurar eventos
      wavesurfer.on('ready', () => {
        if (isMounted) {
          logger.info('WaveSurfer está listo');
          setIsWaveSurferReady(true);
        }
      });
      
      wavesurfer.on('interaction', (time) => {
        if (isMounted) {
          onTimeUpdate(time);
        }
      });
      
      // Al destruirse, marcar como no listo
      wavesurfer.on('destroy', () => {
        setIsWaveSurferReady(false);
      });
      
      wavesurferRef.current = wavesurfer;
      wavesurferInstance = wavesurfer;
    }
    
    // Cargar audio si hay URL - proxy Firebase Storage URLs to avoid CORS
    if (audioUrl && wavesurferRef.current && isMounted) {
      setIsWaveSurferReady(false); // Marcar como no listo mientras carga
      const isFirebaseUrl = audioUrl.includes('storage.googleapis.com') || 
                            audioUrl.includes('firebasestorage.googleapis.com');
      const loadUrl = isFirebaseUrl 
        ? `/api/proxy/firebase-file?url=${encodeURIComponent(audioUrl)}`
        : audioUrl;
      wavesurferRef.current.load(loadUrl).catch(() => {
        // Silenciar errores de carga durante cleanup
        setIsWaveSurferReady(false);
      });
    }
    
    // Limpiar al desmontar
    return () => {
      isMounted = false;
      setIsWaveSurferReady(false);
      
      // Limpiar la instancia local primero
      if (wavesurferInstance) {
        const ws = wavesurferInstance;
        wavesurferInstance = null;
        
        // Usar setTimeout para dar tiempo a que se completen las operaciones pendientes
        setTimeout(() => {
          try {
            // Remover todos los listeners antes de destruir
            ws.unAll();
            ws.destroy();
          } catch (err) {
            // Silenciar completamente el error de "signal is aborted"
          }
        }, 0);
      }
      
      // Limpiar la referencia
      if (wavesurferRef.current) {
        wavesurferRef.current = null;
      }
    };
  }, [audioUrl, onTimeUpdate]);
  
  // Actualizar zoom en WaveSurfer
  useEffect(() => {
    if (wavesurferRef.current && isWaveSurferReady) {
      try {
        wavesurferRef.current.zoom(zoom * 50);
      } catch (err) {
        // Silenciar errores si el audio no está cargado
        logger.warn('No se pudo aplicar zoom:', err);
      }
    }
  }, [zoom, isWaveSurferReady]);
  
  // Sincronizar el progreso de WaveSurfer con el tiempo actual
  useEffect(() => {
    if (wavesurferRef.current && isWaveSurferReady && !draggingPlayhead && duration > 0) {
      try {
        wavesurferRef.current.seekTo(currentTime / duration);
      } catch (err) {
        // Silenciar errores si el audio no está cargado
        logger.warn('No se pudo buscar posición:', err);
      }
    }
  }, [currentTime, duration, draggingPlayhead, isWaveSurferReady]);
  
  // Sincronizar el estado de reproducción
  useEffect(() => {
    if (wavesurferRef.current && isWaveSurferReady) {
      try {
        if (isPlaying) {
          wavesurferRef.current.play();
        } else {
          wavesurferRef.current.pause();
        }
      } catch (err) {
        // Silenciar errores si el audio no está cargado
        logger.warn('No se pudo cambiar estado de reproducción:', err);
      }
    }
  }, [isPlaying, isWaveSurferReady]);
  
  // Función para iniciar el arrastre de un clip
  const handleClipMouseDown = (
    e: React.MouseEvent, 
    clipId: number, 
    handle: 'body' | 'start' | 'end'
  ) => {
    e.preventDefault();
    const clip = clips.find(c => c.id === clipId);
    if (!clip) return;
    
    setDragging(true);
    
    let dragType: 'move' | 'resize-start' | 'resize-end';
    switch (handle) {
      case 'start':
        dragType = 'resize-start';
        break;
      case 'end':
        dragType = 'resize-end';
        break;
      default:
        dragType = 'move';
    }
    
    setDragData({
      clipId,
      type: dragType,
      startX: e.clientX,
      startTime: currentTime,
      clipStartPosition: clip.start,
      clipDuration: clip.duration
    });
    
    // Agregar manejadores globales
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };
  
  // Función para manejar el movimiento durante el arrastre
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !dragData || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const deltaX = e.clientX - dragData.startX;
    const deltaTime = pixelsToTime(deltaX);
    
    const clip = clips.find(c => c.id === dragData.clipId);
    if (!clip) return;
    
    // Clips en la misma capa (para detección de colisiones)
    const otherClipsInLayer = clips.filter(c => 
      c.layerId === clip.layerId && c.id !== clip.id
    );
    
    switch (dragData.type) {
      case 'move': {
        // Mover el clip completo
        let newStart = Math.max(0, dragData.clipStartPosition + deltaTime);
        const clipEnd = newStart + clip.duration;
        
        // Comprobar si hay colisión con otros clips al mover
        const wouldCollide = otherClipsInLayer.some(otherClip => {
          const otherClipEnd = otherClip.start + otherClip.duration;
          return (
            (newStart < otherClipEnd && clipEnd > otherClip.start) ||
            (newStart === otherClip.start) // Evitar que dos clips empiecen exactamente en el mismo punto
          );
        });
        
        if (!wouldCollide) {
          onClipUpdate(clip.id, { start: newStart });
        }
        break;
      }
      
      case 'resize-start': {
        // Redimensionar desde el inicio (cambiar start y duration simultáneamente)
        const originalEnd = dragData.clipStartPosition + dragData.clipDuration;
        let newStart = Math.max(0, dragData.clipStartPosition + deltaTime);
        // Limitar para no hacer el clip menor que 0.1 segundos
        newStart = Math.min(newStart, originalEnd - 0.1);
        
        // Duración actualizada (limitar a 5 segundos como máximo)
        let newDuration = Math.min(5, originalEnd - newStart);
        
        // Comprobar colisiones al redimensionar desde el inicio
        const wouldCollide = otherClipsInLayer.some(otherClip => {
          return (
            newStart < otherClip.start + otherClip.duration && 
            otherClip.start < dragData.clipStartPosition
          );
        });
        
        if (!wouldCollide) {
          onClipUpdate(clip.id, {
            start: newStart,
            duration: newDuration
          });
        }
        break;
      }
      
      case 'resize-end': {
        // Redimensionar desde el final (solo cambiar duration)
        // Limitar duración máxima a 5 segundos
        let newDuration = Math.min(5, Math.max(0.1, dragData.clipDuration + deltaTime));
        
        // Comprobar colisiones al redimensionar desde el final
        const newEnd = clip.start + newDuration;
        const wouldCollide = otherClipsInLayer.some(otherClip => {
          return (
            newEnd > otherClip.start && 
            otherClip.start > clip.start
          );
        });
        
        if (!wouldCollide) {
          onClipUpdate(clip.id, { duration: newDuration });
        }
        break;
      }
    }
  }, [dragging, dragData, clips, pixelsToTime, onClipUpdate]);
  
  // Función para finalizar el arrastre
  const handleMouseUp = useCallback(() => {
    setDragging(false);
    setDragData(null);
    
    // Eliminar manejadores globales
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseMove]);
  
  // Manejar clic en la línea de tiempo para actualizar la posición actual
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (dragging || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, pixelsToTime(clickX)));
    
    onTimeUpdate(newTime);
  }, [dragging, duration, pixelsToTime, onTimeUpdate]);
  
  // Manejar arrastre de la cabeza de reproducción
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    setDraggingPlayhead(true);
    
    document.addEventListener('mousemove', handlePlayheadMove);
    document.addEventListener('mouseup', handlePlayheadUp);
  }, []);
  
  // Mover la cabeza de reproducción durante el arrastre
  const handlePlayheadMove = useCallback((e: MouseEvent) => {
    if (!draggingPlayhead || !timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const newTime = Math.max(0, Math.min(duration, pixelsToTime(x)));
    
    onTimeUpdate(newTime);
  }, [draggingPlayhead, duration, pixelsToTime, onTimeUpdate]);
  
  // Finalizar el arrastre de la cabeza de reproducción
  const handlePlayheadUp = useCallback(() => {
    setDraggingPlayhead(false);
    
    document.removeEventListener('mousemove', handlePlayheadMove);
    document.removeEventListener('mouseup', handlePlayheadUp);
  }, [handlePlayheadMove]);
  
  // Agrupar clips por capa para facilitar el renderizado
  const clipsByLayer = clips.reduce((grouped, clip) => {
    const layer = clip.layerId || 0;
    if (!grouped[layer]) grouped[layer] = [];
    grouped[layer].push(clip);
    return grouped;
  }, {} as Record<number, TimelineClip[]>);
  
  // Renderizar marcas de tiempo
  const renderTimeMarkers = () => {
    const markers = [];
    const interval = zoom < 0.5 ? 10 : zoom < 1 ? 5 : zoom < 2 ? 1 : 0.5;
    
    for (let i = 0; i <= Math.ceil(duration); i += interval) {
      const position = timeToPixels(i);
      
      markers.push(
        <div 
          key={`marker-${i}`}
          className="absolute top-0 bottom-0 border-l border-gray-700"
          style={{ left: `${position}px` }}
        >
          <div className="text-xs text-gray-400 bg-gray-900 px-1 py-0.5 rounded-sm">
            {formatTime(i)}
          </div>
        </div>
      );
    }
    
    return markers;
  };
  
  // Renderizar la cabeza de reproducción
  const renderPlayhead = () => {
    const position = timeToPixels(currentTime);
    
    return (
      <div 
        className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20"
        style={{ left: `${position}px` }}
      >
        {/* Mango de la playhead para arrastrar */}
        <div 
          className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-red-500 cursor-pointer z-30"
          onMouseDown={handlePlayheadMouseDown}
        />
        
        {/* Información del tiempo actual */}
        <div className="absolute -top-8 -translate-x-1/2 bg-gray-900 text-white text-xs px-1 py-0.5 rounded">
          {formatTime(currentTime)}
        </div>
      </div>
    );
  };
  
  // Función para formatear tiempo en formato mm:ss.ms
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms}`;
  };
  
  // Obtener el color para una capa basado en su índice
  const getLayerColor = (layer: number) => {
    const colors = [
      { bg: '#3730a3', border: '#4338ca' }, // Audio
      { bg: '#0369a1', border: '#0284c7' }, // Video
      { bg: '#15803d', border: '#16a34a' }, // Texto
      { bg: '#9f1239', border: '#be123c' }, // Efectos
      { bg: '#7e22ce', border: '#9333ea' }, // Reservada
      { bg: '#b91c1c', border: '#dc2626' }, // Reservada
      { bg: '#854d0e', border: '#a16207' }, // Reservada
      { bg: '#f97316', border: '#fb923c' }  // Imágenes generadas
    ];
    
    return colors[layer % colors.length];
  };
  
  return (
    <div className="flex flex-col h-full border rounded-md bg-gray-900 text-white overflow-hidden">
      {/* Controles superiores */}
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          {/* Controles de reproducción */}
          <Button
            size="sm"
            variant={isPlaying ? "destructive" : "default"}
            onClick={onPlayPause}
          >
            {isPlaying ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
            {isPlaying ? "Pausar" : "Reproducir"}
          </Button>
          
          {/* Controles de zoom */}
          <Button
            size="icon"
            variant="outline"
            onClick={() => setZoom(Math.max(0.5, zoom - 0.5))}
            disabled={zoom <= 0.5}
            title="Alejar"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          
          <Button
            size="icon"
            variant="outline"
            onClick={() => setZoom(Math.min(5, zoom + 0.5))}
            disabled={zoom >= 5}
            title="Acercar"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="text-xs text-gray-400">
            Zoom: {zoom.toFixed(1)}x
          </div>
        </div>
        
        {/* Tiempo actual / duración */}
        <div className="text-sm font-medium">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
      </div>
      
      {/* Área de la forma de onda */}
      <div className="h-16 border-b border-gray-700 bg-gray-800 relative">
        <div ref={waveformRef} className="w-full h-full" />
      </div>
      
      {/* Área principal del timeline */}
      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div 
            ref={timelineRef}
            className="relative"
            style={{ 
              width: `${timeToPixels(duration) + 100}px`, 
              minHeight: `${Object.keys(clipsByLayer).length * 50 + 20}px`,
              minWidth: '100%'
            }}
            onClick={handleTimelineClick}
          >
            {/* Marcadores de tiempo */}
            <div className="h-6 border-b border-gray-700 relative">
              {renderTimeMarkers()}
            </div>
            
            {/* Capas con clips */}
            <div className="relative">
              {Object.keys(clipsByLayer).length > 0 ? (
                Object.keys(clipsByLayer)
                  .map(Number)
                  .sort((a, b) => a - b)
                  .map(layerId => {
                    const layerColor = getLayerColor(layerId);
                    const layerName = 
                      layerId === 0 ? 'Audio' :
                      layerId === 1 ? 'Video' :
                      layerId === 2 ? 'Texto' :
                      layerId === 3 ? 'Efectos' :
                      layerId === 7 ? 'IA Generativa' :
                      `Capa ${layerId}`;
                    
                    return (
                      <div 
                        key={`layer-${layerId}`}
                        className="relative h-12 mb-1 border-t border-gray-800"
                      >
                        {/* Etiqueta de la capa */}
                        <div 
                          className="absolute left-0 top-0 bottom-0 w-24 bg-gray-800 z-10 flex items-center justify-center text-xs"
                          style={{ 
                            backgroundColor: layerId === 7 ? '#7c2d12' : layerColor.bg,
                            borderRight: `2px solid ${layerColor.border}`
                          }}
                        >
                          {layerName}
                          {layerId === 7 && (
                            <span className="absolute top-0 right-0 text-amber-500 text-[8px] font-bold px-1">
                              ★ IA
                            </span>
                          )}
                        </div>
                        
                        {/* Fondo de la capa */}
                        <div 
                          className="absolute left-24 right-0 top-0 bottom-0"
                          style={{
                            backgroundColor: layerId % 2 === 0 ? 'rgba(30, 30, 30, 0.6)' : 'rgba(20, 20, 20, 0.8)'
                          }}
                        />
                        
                        {/* Clips en esta capa */}
                        {clipsByLayer[layerId].map(clip => (
                          <div
                            key={`clip-${clip.id}`}
                            className={cn(
                              "absolute top-1 rounded overflow-hidden border",
                              clip.locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                            )}
                            style={{
                              left: `${timeToPixels(clip.start) + 24}px`,
                              width: `${timeToPixels(clip.duration)}px`,
                              height: '40px',
                              backgroundColor: layerId === 7 ? 'rgba(249, 115, 22, 0.7)' : `${layerColor.bg}AA`,
                              borderColor: layerColor.border,
                            }}
                            onMouseDown={(e) => !clip.locked && handleClipMouseDown(e, clip.id, 'body')}
                          >
                            {/* Manijas para redimensionar */}
                            {!clip.locked && (
                              <>
                                <div
                                  className="absolute left-0 top-0 w-2 h-full bg-gray-800 bg-opacity-50 cursor-ew-resize z-10"
                                  onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'start')}
                                />
                                <div
                                  className="absolute right-0 top-0 w-2 h-full bg-gray-800 bg-opacity-50 cursor-ew-resize z-10"
                                  onMouseDown={(e) => handleClipMouseDown(e, clip.id, 'end')}
                                />
                              </>
                            )}
                            
                            {/* Título del clip */}
                            <div className="absolute inset-0 flex items-center justify-center text-white text-xs font-medium">
                              {clip.title || `Clip ${clip.id}`}
                              {clip.duration > 5 && (
                                <span className="absolute bottom-0 right-0 text-red-300 text-[8px] px-1">
                                  Excede 5s
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
              ) : (
                <div className="flex items-center justify-center h-32 text-gray-500 italic">
                  No hay clips para mostrar
                </div>
              )}
            </div>
            
            {/* Playhead */}
            {renderPlayhead()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}