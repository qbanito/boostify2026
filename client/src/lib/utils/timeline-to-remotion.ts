/**
 * Adaptador que convierte TimelineClip[] del editor existente 
 * a RemotionClip[] para el Player de Remotion.
 * 
 * Este archivo es el ÚNICO puente entre el timeline existente y Remotion.
 * No modifica ninguna estructura existente.
 */

import type { MusicVideoProps, RemotionClip } from '../../../../remotion/Composition';

// Tipo compatible con el TimelineClip existente del editor
interface TimelineClipInput {
  id: number;
  type?: string;
  start: number;
  duration: number;
  url?: string;
  imageUrl?: string;
  image_url?: string;
  generatedImageUrl?: string;
  publicUrl?: string;
  firebaseUrl?: string;
  videoUrl?: string;
  text?: string;
  title?: string;
  volume?: number;
  opacity?: number;
  scale?: number;
  position?: { x: number; y: number };
  transition?: {
    type: string;
    duration: number;
  };
  shotCategory?: string;
  lyricsSegment?: string;
  [key: string]: any;
}

/**
 * Resuelve la URL del media de un clip, buscando en todos los 
 * campos posibles del TimelineClip existente
 */
function resolveClipUrl(clip: TimelineClipInput): string | undefined {
  return (
    clip.url ||
    clip.videoUrl ||
    clip.imageUrl ||
    clip.image_url ||
    clip.generatedImageUrl ||
    clip.publicUrl ||
    clip.firebaseUrl ||
    undefined
  );
}

/**
 * Mapea el tipo de clip del timeline existente al tipo de Remotion
 */
function mapClipType(type?: string): RemotionClip['type'] {
  if (!type) return 'IMAGE';
  const normalized = type.toUpperCase();
  switch (normalized) {
    case 'VIDEO':
      return 'VIDEO';
    case 'AUDIO':
      return 'AUDIO';
    case 'TEXT':
      return 'TEXT';
    case 'IMAGE':
    case 'GENERATED_IMAGE':
    case 'PLACEHOLDER':
    default:
      return 'IMAGE';
  }
}

/**
 * Determina si un clip tiene contenido de video (URL de video generado)
 */
function hasVideoContent(clip: TimelineClipInput): boolean {
  return !!(clip.videoUrl && clip.videoUrl.length > 0);
}

/**
 * Convierte los clips del timeline existente a props para MusicVideoComposition de Remotion.
 * Esta es la función principal del adaptador.
 */
export function convertClipsToRemotionProps(
  clips: TimelineClipInput[],
  audioUrl?: string,
  options?: {
    audioVolume?: number;
    backgroundColor?: string;
    title?: string;
    artistName?: string;
  }
): MusicVideoProps {
  const remotionClips: RemotionClip[] = clips
    .filter(clip => {
      // Filtrar clips sin contenido visual útil
      const type = mapClipType(clip.type);
      if (type === 'TEXT') return !!(clip.text || clip.title);
      if (type === 'AUDIO') return false; // Audio se maneja aparte
      return !!resolveClipUrl(clip);
    })
    .map(clip => {
      const type = hasVideoContent(clip) ? 'VIDEO' : mapClipType(clip.type);
      const url = type === 'VIDEO' ? clip.videoUrl : resolveClipUrl(clip);

      const remotionClip: RemotionClip = {
        id: clip.id,
        type,
        start: clip.start,
        duration: clip.duration,
        url,
        volume: clip.volume,
        opacity: clip.opacity,
        scale: clip.scale,
        position: clip.position,
      };

      // Transiciones
      if (clip.transition) {
        const transType = clip.transition.type?.toLowerCase();
        remotionClip.transition = {
          type: (transType === 'fade' || transType === 'slide' || transType === 'wipe')
            ? transType
            : 'fade',
          duration: clip.transition.duration || 0.5,
        };
      }

      // Ken Burns automático para imágenes (deterministic per clip id — no Math.random)
      if (type === 'IMAGE') {
        const seed = (n: number, offset: number) => {
          const x = Math.sin(n * 9301 + offset * 49297 + 233) * 100000;
          return x - Math.floor(x);
        };
        remotionClip.kenBurns = {
          startScale: 1.0,
          endScale: 1.12,
          startX: 46 + seed(clip.id, 0) * 8,
          startY: 46 + seed(clip.id, 1) * 8,
          endX: 46 + seed(clip.id, 2) * 8,
          endY: 46 + seed(clip.id, 3) * 8,
        };
      }

      // Texto
      if (type === 'TEXT') {
        remotionClip.text = clip.text || clip.title || '';
        remotionClip.textStyle = {
          fontSize: 48,
          fontFamily: 'Inter, sans-serif',
          color: '#ffffff',
          position: 'bottom',
          animation: 'fadeIn',
        };
      }

      return remotionClip;
    })
    .sort((a, b) => a.start - b.start);

  return {
    clips: remotionClips,
    audioUrl,
    audioVolume: options?.audioVolume ?? 1,
    backgroundColor: options?.backgroundColor ?? '#000000',
    title: options?.title,
    artistName: options?.artistName,
  };
}

/**
 * Calcula la duración total en frames para el Player de Remotion
 */
export function calculateDurationInFrames(
  clips: TimelineClipInput[],
  audioDuration: number,
  fps: number = 30
): number {
  const maxClipEnd = clips.reduce((max, clip) => {
    const end = clip.start + clip.duration;
    return end > max ? end : max;
  }, 0);

  const totalDuration = Math.max(maxClipEnd, audioDuration, 1);
  return Math.ceil(totalDuration * fps);
}
