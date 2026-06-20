/**
 * Timeline Export Service
 * Sistema completo para exportar timelines a MP4
 * Soporta combinación de múltiples clips, audio y transiciones
 */

import type { TimelineClip, TimelineTrack } from '../../components/professional-editor/EnhancedTimeline';
import { logger } from "../logger";

export interface ExportOptions {
  clips: TimelineClip[];
  tracks: TimelineTrack[];
  duration: number;
  resolution?: '720p' | '1080p' | '4k';
  fps?: 24 | 30 | 60;
  format?: 'mp4' | 'mov' | 'webm';
  quality?: 'low' | 'medium' | 'high' | 'ultra';
  includeAudio?: boolean;
  audioUrl?: string;
}

export interface ExportProgress {
  stage: 'preparing' | 'rendering' | 'encoding' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  videoUrl?: string;
  error?: string;
}

export interface ExportResult {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  fileSize?: number;
  error?: string;
}

/**
 * Exportar timeline completo a MP4
 */
export async function exportTimelineToMP4(
  options: ExportOptions,
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  try {
    // Validar clips
    if (options.clips.length === 0) {
      throw new Error('No hay clips para exportar');
    }

    // Progreso: Preparando
    onProgress?.({
      stage: 'preparing',
      progress: 0,
      message: 'Preparando clips para exportación...'
    });

    // Ordenar clips por tiempo de inicio
    const sortedClips = [...options.clips].sort((a, b) => a.start - b.start);

    // Separar clips por tipo
    const videoClips = sortedClips.filter(c => c.type === 'video' || c.type === 'image');
    const audioClips = sortedClips.filter(c => c.type === 'audio');

    // Construir secuencia de video
    const videoSequence = buildVideoSequence(videoClips, options.duration);

    onProgress?.({
      stage: 'preparing',
      progress: 20,
      message: `${videoSequence.length} clips preparados...`
    });

    // Enviar al servidor para renderizar
    const exportRequest = {
      clips: videoSequence,
      audioClips: options.includeAudio ? audioClips : [],
      duration: options.duration,
      resolution: options.resolution || '1080p',
      fps: options.fps || 30,
      format: options.format || 'mp4',
      quality: options.quality || 'high',
      audioUrl: options.audioUrl
    };

    onProgress?.({
      stage: 'rendering',
      progress: 30,
      message: 'Enviando al servidor para renderizar...'
    });

    const response = await fetch('/api/timeline/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(exportRequest)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error exportando video');
    }

    const result = await response.json();

    if (!result.success || !result.taskId) {
      throw new Error(result.error || 'No se pudo iniciar la exportación');
    }

    // Polling para el progreso
    const finalResult = await pollExportStatus(
      result.taskId,
      (progress) => {
        // Mapear progreso del servidor
        const mappedProgress: ExportProgress = {
          stage: progress.stage || 'rendering',
          progress: Math.min(30 + (progress.progress * 0.7), 100),
          message: progress.message || 'Renderizando video...'
        };
        onProgress?.(mappedProgress);
      }
    );

    if (finalResult.success && finalResult.videoUrl) {
      onProgress?.({
        stage: 'completed',
        progress: 100,
        message: 'Exportación completada!',
        videoUrl: finalResult.videoUrl
      });

      return {
        success: true,
        videoUrl: finalResult.videoUrl,
        duration: options.duration,
        fileSize: finalResult.fileSize
      };
    }

    throw new Error(finalResult.error || 'Error desconocido durante la exportación');

  } catch (error: any) {
    logger.error('Error exportando timeline:', error);

    const errorProgress: ExportProgress = {
      stage: 'failed',
      progress: 0,
      message: 'Error en la exportación',
      error: error.message
    };
    onProgress?.(errorProgress);

    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Construir secuencia de video desde clips
 */
function buildVideoSequence(clips: TimelineClip[], totalDuration: number) {
  const sequence = [];
  
  for (const clip of clips) {
    sequence.push({
      id: clip.id,
      url: clip.url,
      start: clip.start,
      duration: clip.duration,
      type: clip.type,
      title: clip.title
    });
  }

  // Llenar gaps con frames negros si es necesario
  const gaps = findTimelineGaps(clips, totalDuration);
  for (const gap of gaps) {
    sequence.push({
      id: `gap-${gap.start}`,
      url: '', // Frame negro
      start: gap.start,
      duration: gap.duration,
      type: 'black' as any,
      title: 'Gap'
    });
  }

  return sequence.sort((a, b) => a.start - b.start);
}

/**
 * Encontrar gaps en el timeline
 */
function findTimelineGaps(clips: TimelineClip[], totalDuration: number) {
  const gaps: Array<{ start: number; duration: number }> = [];
  
  // Ordenar clips por tiempo de inicio
  const sorted = [...clips].sort((a, b) => a.start - b.start);
  
  let currentTime = 0;
  
  for (const clip of sorted) {
    if (clip.start > currentTime) {
      // Hay un gap
      gaps.push({
        start: currentTime,
        duration: clip.start - currentTime
      });
    }
    currentTime = Math.max(currentTime, clip.start + clip.duration);
  }

  // Gap al final si no llega a la duración total
  if (currentTime < totalDuration) {
    gaps.push({
      start: currentTime,
      duration: totalDuration - currentTime
    });
  }

  return gaps;
}

/**
 * Polling para estado de exportación
 */
async function pollExportStatus(
  taskId: string,
  onProgress?: (progress: any) => void
): Promise<any> {
  const maxAttempts = 60; // 5 minutos con polling cada 5 segundos
  const pollInterval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`/api/timeline/export/status/${taskId}`);
      
      if (!response.ok) {
        throw new Error('Error consultando estado de exportación');
      }

      const status = await response.json();

      onProgress?.(status);

      if (status.status === 'completed') {
        return {
          success: true,
          videoUrl: status.videoUrl,
          fileSize: status.fileSize
        };
      }

      if (status.status === 'failed') {
        return {
          success: false,
          error: status.error || 'Error durante la exportación'
        };
      }

      // Esperar antes del siguiente poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error: any) {
      logger.error('Error en polling:', error);
      // Continuar intentando a menos que sea el último intento
      if (attempt === maxAttempts - 1) {
        return {
          success: false,
          error: 'Timeout: La exportación tardó demasiado'
        };
      }
    }
  }

  return {
    success: false,
    error: 'Timeout: La exportación tardó demasiado'
  };
}

/**
 * Exportación rápida (solo descarga de clips actuales sin renderizar)
 */
export async function quickExportTimeline(clips: TimelineClip[]): Promise<void> {
  // Para desarrollo: simplemente descargar los clips individuales
  for (const clip of clips) {
    if (clip.url && (clip.type === 'video' || clip.type === 'image')) {
      const a = document.createElement('a');
      a.href = clip.url;
      a.download = `${clip.title || clip.id}.${clip.type === 'video' ? 'mp4' : 'png'}`;
      a.click();
    }
  }
}

/**
 * Generar preview del timeline (sin exportar)
 */
export function generateTimelinePreview(clips: TimelineClip[], duration: number) {
  // Generar una estructura JSON del timeline para preview
  return {
    duration,
    totalClips: clips.length,
    videoClips: clips.filter(c => c.type === 'video').length,
    audioClips: clips.filter(c => c.type === 'audio').length,
    imageClips: clips.filter(c => c.type === 'image').length,
    timeline: clips.map(clip => ({
      id: clip.id,
      title: clip.title,
      type: clip.type,
      start: clip.start,
      end: clip.start + clip.duration,
      duration: clip.duration
    })).sort((a, b) => a.start - b.start)
  };
}

/**
 * Calcular tamaño estimado del video final
 */
export function estimateExportSize(
  duration: number,
  resolution: string = '1080p',
  quality: string = 'high'
): { size: number; sizeText: string } {
  // Bitrates aproximados en Mbps
  const bitrates: Record<string, Record<string, number>> = {
    '720p': { low: 2, medium: 4, high: 8, ultra: 12 },
    '1080p': { low: 4, medium: 8, high: 16, ultra: 24 },
    '4k': { low: 20, medium: 40, high: 80, ultra: 120 }
  };

  const bitrate = bitrates[resolution]?.[quality] || 8;
  const sizeInMB = (bitrate * duration) / 8; // Convertir de Mbps a MB

  return {
    size: sizeInMB,
    sizeText: sizeInMB > 1000 
      ? `${(sizeInMB / 1000).toFixed(2)} GB` 
      : `${sizeInMB.toFixed(2)} MB`
  };
}

export default {
  exportTimelineToMP4,
  quickExportTimeline,
  generateTimelinePreview,
  estimateExportSize
};
