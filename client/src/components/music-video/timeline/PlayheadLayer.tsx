import React from 'react';
import { logger } from "../../lib/logger";
import { cn } from '../../../lib/utils';

interface PlayheadLayerProps {
  currentTime: number;
  timeToPixels: (time: number) => number;
  duration: number;
  setCurrentTime: (time: number) => void;
  isPlaying: boolean;
  zoom: number;
}

/**
 * Componente para renderizar la línea de tiempo y el playhead
 */
export function PlayheadLayer({
  currentTime,
  timeToPixels,
  duration,
  setCurrentTime,
  isPlaying,
  zoom
}: PlayheadLayerProps) {
  const playheadRef = React.useRef<HTMLDivElement>(null);
  const timelineWidth = timeToPixels(duration);
  
  // Determinar las marcas de tiempo para mostrar en la regla
  const getTimeMarkers = () => {
    const markers = [];
    // Ajustar la densidad de marcadores según el zoom
    const interval = zoom > 5 ? 0.1 : zoom > 2 ? 0.25 : zoom > 1 ? 0.5 : 1;
    const maxMarkers = Math.min(500, Math.ceil(duration / interval) + 1);
    
    for (let i = 0; i < maxMarkers; i++) {
      const time = i * interval;
      if (time <= duration) {
        const major = time % 1 === 0;  // Marcadores principales en segundos enteros
        markers.push({
          time,
          position: timeToPixels(time),
          major,
          label: formatTime(time)
        });
      } else {
        break;
      }
    }
    
    return markers;
  };
  
  // Formatear tiempo (mm:ss.ms)
  const formatTime = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    const milliseconds = Math.floor((timeInSeconds % 1) * 10);
    
    if (zoom > 2) {
      // Con zoom alto, mostrar más detalle
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds}`;
    } else {
      // Con zoom bajo, formato más simple
      return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
  };
  
  // Manejar clic en la línea de tiempo para mover el playhead
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (playheadRef.current) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickTime = clickX / timeToPixels(1);
      
      // Limitar el tiempo al rango válido
      const newTime = Math.max(0, Math.min(duration, clickTime));
      setCurrentTime(newTime);
    }
  };
  
  return (
    <div className="relative w-full">
      {/* Regla de tiempo */}
      <div 
        className="relative h-6 w-full bg-card/20 text-xs text-muted-foreground"
        onClick={handleTimelineClick}
      >
        {/* Líneas de la regla */}
        {getTimeMarkers().map((marker) => (
          <div
            key={`marker-${marker.time}`}
            className={cn(
              "absolute top-0 h-6 w-px",
              marker.major ? "bg-gray-400/30" : "bg-gray-400/15"
            )}
            style={{ left: `${marker.position}px` }}
          >
            {/* Etiqueta de tiempo solo para marcadores principales */}
            {marker.major && (
              <div className="absolute -left-6 top-1 w-12 text-center text-[10px]">
                {marker.label}
              </div>
            )}
          </div>
        ))}
        
        {/* Playhead */}
        <div
          ref={playheadRef}
          className={cn(
            "pointer-events-none absolute top-0 h-full w-0.5 bg-orange-500",
            "before:absolute before:-left-[7px] before:top-0 before:h-0 before:w-0",
            "before:border-l-[7px] before:border-r-[7px] before:border-t-[7px]",
            "before:border-l-transparent before:border-r-transparent before:border-t-orange-500",
            isPlaying ? "animate-pulse" : ""
          )}
          style={{ left: `${timeToPixels(currentTime)}px` }}
        />
      </div>
      
      {/* Línea vertical del playhead que se extiende por toda la altura del timeline */}
      <div 
        className="absolute top-6 w-0.5 bg-orange-500/40 pointer-events-none"
        style={{ 
          left: `${timeToPixels(currentTime)}px`,
          height: 'calc(100vh - 6rem)'  // Se extenderá por todo el resto del timeline
        }}
      />
    </div>
  );
}