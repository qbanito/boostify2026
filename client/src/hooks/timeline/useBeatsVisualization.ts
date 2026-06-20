import { useMemo } from 'react';
import { BeatMap, BeatData } from '../../components/music-video/timeline-editor';

interface UseBeatsVisualizationProps {
  beatsData?: BeatMap;
  timeToPixels: (time: number) => number;
  duration: number;
  zoom: number;
}

interface BeatVisualization {
  left: number;
  type: string;
  intensity: number;
  isDownbeat: boolean;
  time: number;
  timecode: string;
}

interface UseBeatsVisualizationResult {
  visibleBeats: BeatVisualization[];
  hasBeats: boolean;
  bpmInfo: string | null;
}

/**
 * Hook para gestionar la visualización de beats en el timeline
 * Calcula las posiciones y estilos de los marcadores de beats
 */
export function useBeatsVisualization({
  beatsData,
  timeToPixels,
  duration,
  zoom
}: UseBeatsVisualizationProps): UseBeatsVisualizationResult {
  
  // Calcular los beats visibles y sus propiedades de visualización
  const visibleBeats = useMemo(() => {
    if (!beatsData || !beatsData.beats || beatsData.beats.length === 0) {
      return [];
    }
    
    // Filtrar solo beats dentro del rango visible
    return beatsData.beats
      .filter(beat => beat.time <= duration)
      .map(beat => ({
        left: timeToPixels(beat.time),
        type: beat.type,
        intensity: beat.intensity,
        isDownbeat: beat.isDownbeat,
        time: beat.time,
        timecode: beat.timecode
      }));
  }, [beatsData, timeToPixels, duration, zoom]);
  
  // Generar información formateada sobre el BPM
  const bpmInfo = useMemo(() => {
    if (!beatsData || !beatsData.metadata || !beatsData.metadata.bpm) {
      return null;
    }
    
    const { bpm, timeSignature, key } = beatsData.metadata;
    
    let info = `BPM: ${bpm.toFixed(1)}`;
    
    if (timeSignature) {
      info += ` | ${timeSignature}`;
    }
    
    if (key) {
      info += ` | Key: ${key}`;
    }
    
    return info;
  }, [beatsData]);

  return {
    visibleBeats,
    hasBeats: visibleBeats.length > 0,
    bpmInfo
  };
}