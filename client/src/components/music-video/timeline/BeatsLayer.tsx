import React from 'react';
import { logger } from "../../lib/logger";
import { cn } from '../../../lib/utils';

interface Beat {
  left: number;
  type: string;
  intensity: number;
  isDownbeat: boolean;
  time: number;
  timecode: string;
}

interface BeatsLayerProps {
  visibleBeats: Beat[];
  hasBeats: boolean;
  bpmInfo: string | null;
  height?: number;
}

/**
 * Componente para visualizar la capa de beats y marcadores de ritmo
 */
export function BeatsLayer({
  visibleBeats,
  hasBeats,
  bpmInfo,
  height = 20
}: BeatsLayerProps) {
  if (!hasBeats) {
    return (
      <div className="flex h-5 w-full items-center justify-center bg-card/10 text-xs text-muted-foreground">
        No beat data available
      </div>
    );
  }
  
  return (
    <div className="relative w-full" style={{ height: `${height}px` }}>
      {/* Fondo para la capa de beats */}
      <div className="absolute inset-0 bg-card/10" />
      
      {/* Info de BPM */}
      {bpmInfo && (
        <div className="absolute left-2 top-0 z-10 text-xs font-medium text-muted-foreground">
          {bpmInfo}
        </div>
      )}
      
      {/* Marcadores de beats */}
      {visibleBeats.map((beat, index) => {
        // Determinar el tipo y estilo de marcador según el tipo de beat
        const isDownbeat = beat.isDownbeat;
        const isQuarterBeat = beat.type === 'quarter';
        const isEighthBeat = beat.type === 'eighth';
        
        // Altura basada en tipo de beat
        const beatHeight = isDownbeat ? height : isQuarterBeat ? height * 0.75 : height * 0.5;
        
        // Color basado en tipo e intensidad
        const beatColor = isDownbeat 
          ? 'bg-orange-500' 
          : isQuarterBeat 
            ? 'bg-orange-400/70' 
            : 'bg-orange-300/50';
        
        return (
          <div
            key={`beat-${index}`}
            className={cn(
              "absolute top-0 w-px",
              beatColor,
              "transform transition-opacity duration-200"
            )}
            style={{
              left: `${beat.left}px`,
              height: `${beatHeight}px`,
              opacity: 0.5 + (beat.intensity * 0.5)
            }}
            title={`Beat at ${beat.timecode}`}
          />
        );
      })}
    </div>
  );
}