/**
 * Music Video Timeline Integration Service
 * Conecta el flujo completo de generación de videos musicales con el timeline
 * 
 * Flujo completo:
 * 1. Subir imagen artista + canción
 * 2. Seleccionar director (opcional)
 * 3. Transcribir canción
 * 4. Generar guion (script JSON con escenas y timing)
 * 5. Generar imágenes para cada escena
 * 6. Cargar imágenes en timeline
 * 7. Generar videos desde imágenes con IA
 * 8. Exportar MP4 final
 */

import type { TimelineClip, TimelineTrack } from '../../components/professional-editor/EnhancedTimeline';
import type { ScenePrompt, MusicVideoScript } from '../api/music-video-generator';
import { logger } from '../logger';
import { generateMusicVideoPrompts } from '../api/music-video-generator';
import { 
  generateBatchVideosFromClips,
  type VideoModel 
} from './timeline-video-generation-service';
import {
  exportTimelineToMP4,
  type ExportOptions
} from './timeline-export-service';

export interface MusicVideoProject {
  id: string;
  title: string;
  artistName?: string;
  artistImageUrl?: string;
  audioUrl: string;
  audioDuration: number;
  transcription?: string;
  script?: MusicVideoScript;
  generatedImages?: Array<{
    sceneId: number;
    imageUrl: string;
    prompt: string;
  }>;
  timelineClips?: TimelineClip[];
  finalVideoUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScriptToTimelineOptions {
  script: MusicVideoScript;
  audioUrl: string;
  trackId?: string;
}

export interface GenerateImagesOptions {
  script: MusicVideoScript;
  artistImageUrl?: string;
  style?: string;
  onProgress?: (progress: { current: number; total: number; scene: ScenePrompt }) => void;
}

export interface GenerateVideosOptions {
  clips: TimelineClip[];
  model: VideoModel;
  onProgress?: (progress: { current: number; total: number; videoUrl?: string }) => void;
}

/**
 * Convertir script JSON a clips del timeline
 * Incluye clips de audio segmentados para cada escena que necesita lipsync
 */
export function convertScriptToTimelineClips(
  options: ScriptToTimelineOptions
): { clips: TimelineClip[]; tracks: TimelineTrack[] } {
  const { script, audioUrl, trackId = 'video-track' } = options;

  // Crear tracks
  const tracks: TimelineTrack[] = [
    {
      id: 'video-track',
      name: 'Video Principal',
      type: 'video',
      visible: true,
      locked: false
    },
    {
      id: 'audio-track',
      name: 'Audio Principal',
      type: 'audio',
      visible: true,
      locked: false
    },
    {
      id: 'audio-segments-track',
      name: 'Audio Segments (Lipsync)',
      type: 'audio',
      visible: true,
      locked: false
    }
  ];

  // Convertir escenas a clips de video
  const clips: TimelineClip[] = script.scenes.map((scene, index) => ({
    id: `scene-${scene.scene_id || index}`,
    title: scene.needsLipsync 
      ? `🎤 Escena ${scene.scene_id || index + 1}` 
      : `Escena ${scene.scene_id || index + 1}`,
    type: 'image' as const,
    start: scene.start_time,
    duration: scene.duration,
    trackId: 'video-track',
    url: '', // Se llenará con las imágenes generadas
    color: scene.needsLipsync ? '#f97316' : getColorForScene(index, script.scenes.length), // Naranja para lipsync
    locked: false,
    metadata: {
      prompt: scene.prompt,
      negativePrompt: scene.negative_prompt,
      lyrics: scene.lyrics_segment,
      sceneId: scene.scene_id || index,
      // 🎤 Info de lipsync
      needsLipsync: scene.needsLipsync || false,
      sceneType: scene.sceneType || 'visual',
      audioSegment: scene.audioSegment,
      hasVocals: scene.audioSegment?.hasVocals || false
    }
  }));

  // 🎵 Agregar clip de audio principal (track completo)
  clips.push({
    id: 'audio-main',
    title: '🎵 Audio Principal',
    type: 'audio',
    start: 0,
    duration: script.total_duration,
    trackId: 'audio-track',
    url: audioUrl,
    color: '#22c55e',
    locked: false,
    metadata: {
      isMainAudio: true,
      totalDuration: script.total_duration
    }
  });

  // 🎤 Crear segmentos de audio para cada escena que necesita lipsync
  const lipsyncScenes = script.scenes.filter(s => s.needsLipsync);
  logger.info(`🎤 [Timeline] Creando ${lipsyncScenes.length} segmentos de audio para lipsync`);
  
  lipsyncScenes.forEach((scene, index) => {
    clips.push({
      id: `audio-segment-${scene.scene_id || index}`,
      title: `🎤 Vocal ${scene.scene_id || index + 1}`,
      type: 'audio',
      start: scene.start_time,
      duration: scene.duration,
      trackId: 'audio-segments-track',
      url: audioUrl, // Mismo audio, diferente segmento
      color: '#f97316', // Naranja para lipsync
      locked: false,
      metadata: {
        isLipsyncSegment: true,
        parentSceneId: scene.scene_id || index,
        lyrics: scene.lyrics_segment,
        // Puntos de entrada/salida en el audio original
        inPoint: scene.start_time,
        outPoint: scene.start_time + scene.duration,
        hasVocals: true
      }
    });
  });

  return { clips, tracks };
}

/**
 * Generar imágenes para todas las escenas del script
 */
export async function generateImagesForScript(
  options: GenerateImagesOptions
): Promise<Array<{ sceneId: number; imageUrl: string; prompt: string }>> {
  const { script, artistImageUrl, style, onProgress } = options;
  
  const generatedImages: Array<{ sceneId: number; imageUrl: string; prompt: string }> = [];

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    
    onProgress?.({
      current: i + 1,
      total: script.scenes.length,
      scene
    });

    try {
      // Generar imagen usando el servicio de generación de imágenes
      const imageUrl = await generateSceneImage({
        prompt: scene.prompt,
        negativePrompt: scene.negative_prompt,
        artistImageUrl,
        style
      });

      generatedImages.push({
        sceneId: scene.scene_id,
        imageUrl,
        prompt: scene.prompt
      });

    } catch (error) {
      logger.error(`Error generando imagen para escena ${scene.scene_id}:`, error);
      // Continuar con la siguiente escena
    }
  }

  return generatedImages;
}

/**
 * Actualizar clips del timeline con imágenes generadas
 */
export function updateTimelineClipsWithImages(
  clips: TimelineClip[],
  generatedImages: Array<{ sceneId: number; imageUrl: string; prompt: string }>
): TimelineClip[] {
  return clips.map(clip => {
    if (clip.type === 'image' && clip.metadata?.sceneId !== undefined) {
      const image = generatedImages.find(img => img.sceneId === clip.metadata.sceneId);
      if (image) {
        return {
          ...clip,
          url: image.imageUrl
        };
      }
    }
    return clip;
  });
}

/**
 * Generar imagen individual para una escena
 */
async function generateSceneImage(options: {
  prompt: string;
  negativePrompt?: string;
  artistImageUrl?: string;
  style?: string;
}): Promise<string> {
  const { prompt, negativePrompt, artistImageUrl, style } = options;

  // Llamar al servicio de generación de imágenes
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      prompt,
      negativePrompt,
      referenceImage: artistImageUrl,
      style: style || 'cinematic',
      aspectRatio: '16:9'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error generando imagen');
  }

  const result = await response.json();
  
  if (!result.success || !result.imageUrl) {
    throw new Error('No se pudo generar la imagen');
  }

  return result.imageUrl;
}

/**
 * Flujo completo: Script → Timeline → Videos → Export
 */
export async function createMusicVideoFromScript(
  project: Partial<MusicVideoProject>,
  options: {
    videoModel: VideoModel;
    exportQuality: 'low' | 'medium' | 'high' | 'ultra';
    onProgress?: (stage: string, progress: number, message: string) => void;
  }
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const { videoModel, exportQuality, onProgress } = options;

  try {
    if (!project.script || !project.audioUrl) {
      throw new Error('Script y audio son requeridos');
    }

    // Paso 1: Convertir script a clips del timeline
    onProgress?.('script-to-timeline', 10, 'Convirtiendo script a timeline...');
    const { clips: initialClips, tracks } = convertScriptToTimelineClips({
      script: project.script,
      audioUrl: project.audioUrl
    });

    // Paso 2: Generar imágenes para las escenas
    onProgress?.('generating-images', 20, 'Generando imágenes para escenas...');
    const generatedImages = await generateImagesForScript({
      script: project.script,
      artistImageUrl: project.artistImageUrl,
      onProgress: (imgProgress) => {
        const progress = 20 + (imgProgress.current / imgProgress.total) * 30;
        onProgress?.('generating-images', progress, `Generando imagen ${imgProgress.current}/${imgProgress.total}`);
      }
    });

    // Paso 3: Actualizar clips con imágenes
    onProgress?.('updating-timeline', 50, 'Actualizando timeline con imágenes...');
    const clipsWithImages = updateTimelineClipsWithImages(initialClips, generatedImages);

    // Paso 4: Generar videos desde imágenes
    onProgress?.('generating-videos', 55, 'Generando videos con IA...');
    const videoClips = clipsWithImages.filter(c => c.type === 'image' && c.url);
    
    const videoResults = await generateBatchVideosFromClips({
      clips: videoClips,
      model: videoModel,
      onProgress: (vidProgress) => {
        const progress = 55 + (vidProgress.progress * 0.3);
        onProgress?.('generating-videos', progress, 'Generando videos...');
      }
    });

    // Actualizar clips con videos generados
    const finalClips = clipsWithImages.map(clip => {
      const videoResult = videoResults.find(r => r.clipId === clip.id);
      if (videoResult && videoResult.status === 'completed' && videoResult.videoUrl) {
        return {
          ...clip,
          type: 'video' as const,
          url: videoResult.videoUrl
        };
      }
      return clip;
    });

    // Paso 5: Exportar a MP4
    onProgress?.('exporting', 85, 'Exportando video final...');
    const exportResult = await exportTimelineToMP4({
      clips: finalClips,
      tracks,
      duration: project.script.total_duration,
      quality: exportQuality,
      includeAudio: true,
      audioUrl: project.audioUrl
    }, (exportProgress) => {
      const progress = 85 + (exportProgress.progress * 0.15);
      onProgress?.('exporting', progress, exportProgress.message);
    });

    if (!exportResult.success || !exportResult.videoUrl) {
      throw new Error(exportResult.error || 'Error exportando video');
    }

    onProgress?.('completed', 100, 'Video musical completado!');

    return {
      success: true,
      videoUrl: exportResult.videoUrl
    };

  } catch (error: any) {
    logger.error('Error en flujo completo:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Obtener color para escena basado en su posición
 */
function getColorForScene(index: number, total: number): string {
  const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#f59e0b', // amber
    '#10b981', // green
    '#06b6d4', // cyan
    '#f97316', // orange
    '#6366f1', // indigo
  ];
  
  return colors[index % colors.length];
}

/**
 * Guardar proyecto en Firestore
 */
export async function saveMusicVideoProject(
  project: MusicVideoProject
): Promise<{ success: boolean; projectId?: string; error?: string }> {
  try {
    const response = await fetch('/api/music-video-projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(project)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error guardando proyecto');
    }

    const result = await response.json();
    return {
      success: true,
      projectId: result.projectId
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Cargar proyecto desde Firestore
 */
export async function loadMusicVideoProject(
  projectId: string
): Promise<{ success: boolean; project?: MusicVideoProject; error?: string }> {
  try {
    const response = await fetch(`/api/music-video-projects/${projectId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error cargando proyecto');
    }

    const project = await response.json();
    return {
      success: true,
      project
    };

  } catch (error: any) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  convertScriptToTimelineClips,
  generateImagesForScript,
  updateTimelineClipsWithImages,
  createMusicVideoFromScript,
  saveMusicVideoProject,
  loadMusicVideoProject
};
