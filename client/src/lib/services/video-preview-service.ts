/**
 * Video Preview Service
 * Preview en tiempo real del timeline sin exportar
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';
import { logger } from "../logger";

export interface PreviewFrame {
  time: number;
  clipId: string;
  imageUrl: string;
}

export interface PreviewOptions {
  quality: 'low' | 'medium' | 'high';
  fps: number;
  resolution: { width: number; height: number };
}

/**
 * Obtener el clip activo en un momento específico
 */
export function getActiveClipAtTime(clips: TimelineClip[], time: number): TimelineClip | null {
  // Filtrar solo clips de video/imagen
  const visualClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  
  // Encontrar clip que contiene este tiempo
  const activeClip = visualClips.find(clip => {
    const clipEnd = clip.start + clip.duration;
    return time >= clip.start && time < clipEnd;
  });

  return activeClip || null;
}

/**
 * Generar preview frame para un tiempo específico
 */
export async function generatePreviewFrame(
  clips: TimelineClip[],
  time: number,
  options: PreviewOptions = {
    quality: 'medium',
    fps: 30,
    resolution: { width: 1920, height: 1080 }
  }
): Promise<PreviewFrame | null> {
  const activeClip = getActiveClipAtTime(clips, time);
  
  if (!activeClip) {
    return null;
  }

  // Si es imagen, usar directamente
  if (activeClip.type === 'image') {
    return {
      time,
      clipId: activeClip.id,
      imageUrl: activeClip.url
    };
  }

  // Si es video, extraer frame en el tiempo relativo
  if (activeClip.type === 'video') {
    const relativeTime = time - activeClip.start;
    const frameUrl = await extractVideoFrame(activeClip.url, relativeTime, options);
    
    return {
      time,
      clipId: activeClip.id,
      imageUrl: frameUrl
    };
  }

  return null;
}

/**
 * Extraer frame de un video en un tiempo específico
 */
async function extractVideoFrame(
  videoUrl: string,
  time: number,
  options: PreviewOptions
): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;

    video.addEventListener('loadedmetadata', () => {
      // Asegurar que el tiempo está dentro del rango
      const seekTime = Math.min(time, video.duration - 0.1);
      video.currentTime = seekTime;
    });

    video.addEventListener('seeked', () => {
      try {
        const canvas = document.createElement('canvas');
        
        // Ajustar resolución según calidad
        const scale = options.quality === 'low' ? 0.5 : options.quality === 'medium' ? 0.75 : 1;
        canvas.width = options.resolution.width * scale;
        canvas.height = options.resolution.height * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No se pudo obtener contexto de canvas'));
          return;
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const frameUrl = canvas.toDataURL('image/jpeg', options.quality === 'low' ? 0.6 : 0.85);
        
        resolve(frameUrl);
      } catch (error) {
        reject(error);
      }
    });

    video.addEventListener('error', (e) => {
      reject(new Error('Error cargando video'));
    });
  });
}

/**
 * Generar thumbnails para scrubbing en el timeline
 */
export async function generateTimelineThumbnails(
  clips: TimelineClip[],
  duration: number,
  interval: number = 1 // thumbnail cada segundo
): Promise<PreviewFrame[]> {
  const thumbnails: PreviewFrame[] = [];
  const times = [];

  // Generar tiempos para thumbnails
  for (let t = 0; t < duration; t += interval) {
    times.push(t);
  }

  // Generar thumbnails en batch
  for (const time of times) {
    try {
      const frame = await generatePreviewFrame(clips, time, {
        quality: 'low',
        fps: 30,
        resolution: { width: 160, height: 90 } // Thumbnails pequeños
      });

      if (frame) {
        thumbnails.push(frame);
      }
    } catch (error) {
      logger.error(`Error generando thumbnail en ${time}s:`, error);
    }
  }

  return thumbnails;
}

/**
 * Cachear frames para preview rápido
 */
class PreviewCache {
  private cache = new Map<string, PreviewFrame>();
  private maxSize = 100;

  getCacheKey(time: number): string {
    return `frame-${time.toFixed(2)}`;
  }

  get(time: number): PreviewFrame | null {
    const key = this.getCacheKey(time);
    return this.cache.get(key) || null;
  }

  set(frame: PreviewFrame): void {
    const key = this.getCacheKey(frame.time);
    
    // Limpiar cache si está lleno
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, frame);
  }

  clear(): void {
    this.cache.clear();
  }
}

export const previewCache = new PreviewCache();

/**
 * Generar preview con cache
 */
export async function generateCachedPreviewFrame(
  clips: TimelineClip[],
  time: number,
  options?: PreviewOptions
): Promise<PreviewFrame | null> {
  // Intentar obtener del cache primero
  const cached = previewCache.get(time);
  if (cached) {
    return cached;
  }

  // Generar nuevo frame
  const frame = await generatePreviewFrame(clips, time, options);
  
  if (frame) {
    previewCache.set(frame);
  }

  return frame;
}

export default {
  getActiveClipAtTime,
  generatePreviewFrame,
  generateCachedPreviewFrame,
  generateTimelineThumbnails,
  previewCache
};
