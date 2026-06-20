import { logger } from "../logger";
/**
 * Timeline Video Generation Service
 * Sistema completo para generar videos desde imágenes en el timeline
 * Soporta múltiples modelos de generación de video
 */

import { FAL_VIDEO_MODELS } from '../api/fal-video-service';
import { generateVideoFromImage as generateMinimaxVideo, waitForVideoCompletion } from '../api/minimax-video';
import type { MinimaxVideoRequest } from '../api/minimax-video';
import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';

export type VideoModel = 
  | 'kling-2.5-pro-i2v'
  | 'kling-2.1-master-i2v'
  | 'kling-2.1-pro-i2v'
  | 'kling-2.1-standard-i2v'
  | 'luma-dream-machine'
  | 'minimax-hailuo-2.3'
  | 'minimax-hailuo-02'
  // PixVerse models
  | 'pixverse-v6'
  | 'pixverse-v6-pro'
  | 'pixverse-c1'
  | 'pixverse-sora-2'
  | 'pixverse-veo-3.1-fast'
  | 'pixverse-seedance-2.0-fast';

export interface VideoGenerationRequest {
  imageUrl: string;
  prompt: string;
  model: VideoModel;
  duration?: number; // en segundos
  clipId?: string;
}

export interface VideoGenerationProgress {
  clipId?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  videoUrl?: string;
  error?: string;
}

export interface BatchVideoGenerationRequest {
  clips: TimelineClip[];
  model: VideoModel;
  duration?: number;
  onProgress?: (progress: VideoGenerationProgress) => void;
}

/**
 * Generar un video individual desde una imagen
 */
export async function generateVideoFromClip(
  request: VideoGenerationRequest,
  onProgress?: (progress: VideoGenerationProgress) => void
): Promise<VideoGenerationProgress> {
  const { imageUrl, prompt, model, duration = 5, clipId } = request;

  try {
    // Progreso inicial
    onProgress?.({
      clipId,
      status: 'queued',
      progress: 0
    });

    // Determinar qué servicio usar según el modelo
    if (model.startsWith('minimax-')) {
      return await generateWithMinimax({ imageUrl, prompt, model, duration, clipId }, onProgress);
    } else if (model.startsWith('pixverse-')) {
      return await generateWithPixVerse({ imageUrl, prompt, model, duration, clipId }, onProgress);
    } else if (model.startsWith('kling-') || model.startsWith('luma-')) {
      return await generateWithFAL({ imageUrl, prompt, model, duration, clipId }, onProgress);
    }

    throw new Error(`Modelo no soportado: ${model}`);
  } catch (error: any) {
    const errorProgress: VideoGenerationProgress = {
      clipId,
      status: 'failed',
      progress: 0,
      error: error.message || 'Error desconocido'
    };
    onProgress?.(errorProgress);
    return errorProgress;
  }
}

/**
 * Generar video usando FAL (KLING, Runway, Luma)
 */
async function generateWithFAL(
  request: VideoGenerationRequest,
  onProgress?: (progress: VideoGenerationProgress) => void
): Promise<VideoGenerationProgress> {
  const { imageUrl, prompt, model, duration, clipId } = request;

  try {
    onProgress?.({
      clipId,
      status: 'processing',
      progress: 20
    });

    // Mapear modelo al ID de FAL
    const modelId = getFALModelId(model);

    const response = await fetch('/api/fal/video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        imageUrl,
        prompt,
        duration: duration.toString()
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error generando video con FAL');
    }

    const result = await response.json();

    if (result.success && result.videoUrl) {
      const successProgress: VideoGenerationProgress = {
        clipId,
        status: 'completed',
        progress: 100,
        videoUrl: result.videoUrl
      };
      onProgress?.(successProgress);
      return successProgress;
    }

    throw new Error(result.error || 'No se pudo generar el video');
  } catch (error: any) {
    throw error;
  }
}

/**
 * Generar video usando MiniMax
 */
async function generateWithMinimax(
  request: VideoGenerationRequest,
  onProgress?: (progress: VideoGenerationProgress) => void
): Promise<VideoGenerationProgress> {
  const { imageUrl, prompt, model, duration, clipId } = request;

  try {
    onProgress?.({
      clipId,
      status: 'processing',
      progress: 20
    });

    // Mapear modelo al nombre de MiniMax
    const minimaxModel = model === 'minimax-hailuo-2.3' 
      ? 'MiniMax-Hailuo-2.3' 
      : 'MiniMax-Hailuo-02';

    const minimaxRequest: MinimaxVideoRequest = {
      imageUrl,
      prompt,
      model: minimaxModel as any,
      duration: duration || 6,
      resolution: '1080P'
    };

    const result = await generateMinimaxVideo(minimaxRequest);

    if (!result.success || !result.taskId) {
      throw new Error(result.error || 'Error iniciando generación de video');
    }

    // Esperar a que se complete con polling
    onProgress?.({
      clipId,
      status: 'processing',
      progress: 40
    });

    const finalResult = await waitForVideoCompletion(
      result.taskId,
      (status) => {
        // Actualizar progreso según el estado
        let progress = 40;
        if (status === 'processing') progress = 70;
        if (status === 'completed') progress = 100;

        onProgress?.({
          clipId,
          status: status === 'completed' ? 'completed' : 'processing',
          progress
        });
      }
    );

    if (finalResult.success && finalResult.videoUrl) {
      const successProgress: VideoGenerationProgress = {
        clipId,
        status: 'completed',
        progress: 100,
        videoUrl: finalResult.videoUrl
      };
      onProgress?.(successProgress);
      return successProgress;
    }

    throw new Error(finalResult.error || 'No se pudo generar el video');
  } catch (error: any) {
    throw error;
  }
}

/**
 * Generar videos en batch desde múltiples clips
 */
export async function generateBatchVideosFromClips(
  request: BatchVideoGenerationRequest
): Promise<VideoGenerationProgress[]> {
  const { clips, model, duration, onProgress } = request;
  
  const results: VideoGenerationProgress[] = [];

  // Filtrar solo clips de tipo imagen que tengan URL
  const imageClips = clips.filter(clip => 
    (clip.type === 'image' || clip.type === 'video') && clip.url
  );

  if (imageClips.length === 0) {
    throw new Error('No hay clips de imagen para generar videos');
  }

  // Generar videos secuencialmente (para evitar sobrecarga)
  for (let i = 0; i < imageClips.length; i++) {
    const clip = imageClips[i];
    
    try {
      const videoRequest: VideoGenerationRequest = {
        imageUrl: clip.url,
        prompt: clip.title || 'Animar esta imagen',
        model,
        duration: duration || clip.duration || 5,
        clipId: clip.id
      };

      const result = await generateVideoFromClip(videoRequest, (progress) => {
        // Reportar progreso global
        const globalProgress = Math.round(((i / imageClips.length) * 100) + (progress.progress / imageClips.length));
        onProgress?.({
          ...progress,
          progress: globalProgress
        });
      });

      results.push(result);

    } catch (error: any) {
      logger.error(`Error generando video para clip ${clip.id}:`, error);
      results.push({
        clipId: clip.id,
        status: 'failed',
        progress: 0,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Mapear nombre de modelo a ID de FAL
 */
function getFALModelId(model: VideoModel): string {
  const mapping: Record<string, string> = {
    'kling-2.5-pro-i2v': FAL_VIDEO_MODELS.KLING_2_5_TURBO_PRO_I2V.id,
    'kling-2.1-master-i2v': FAL_VIDEO_MODELS.KLING_2_1_MASTER_I2V.id,
    'kling-2.1-pro-i2v': FAL_VIDEO_MODELS.KLING_2_1_PRO_I2V.id,
    'kling-2.1-standard-i2v': FAL_VIDEO_MODELS.KLING_2_1_STANDARD_I2V.id,
    'luma-dream-machine': FAL_VIDEO_MODELS.LUMA_DREAM_MACHINE.id
  };

  return mapping[model] || FAL_VIDEO_MODELS.KLING_2_1_PRO_I2V.id;
}

// PixVerse model id → API model name
const PIXVERSE_MODEL_NAMES: Partial<Record<VideoModel, string>> = {
  'pixverse-v6':               'v6',
  'pixverse-v6-pro':           'v6',
  'pixverse-c1':               'pixverse-c1',
  'pixverse-sora-2':           'sora-2',
  'pixverse-veo-3.1-fast':     'veo-3.1-fast',
  'pixverse-seedance-2.0-fast':'seedance-2.0-fast',
};

/**
 * Generar video usando PixVerse (start task → poll status)
 */
async function generateWithPixVerse(
  request: VideoGenerationRequest,
  onProgress?: (progress: VideoGenerationProgress) => void
): Promise<VideoGenerationProgress> {
  const { imageUrl, prompt, model, duration, clipId } = request;

  try {
    onProgress?.({ clipId, status: 'processing', progress: 10 });

    const pixverseModel = PIXVERSE_MODEL_NAMES[model] ?? 'v6';
    const startRes = await fetch('/api/fal/pixverse-video/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageUrl, prompt, model: pixverseModel, duration, aspectRatio: '9:16' }),
    });

    if (!startRes.ok) {
      const err = await startRes.json();
      throw new Error(err.error || 'PixVerse start failed');
    }

    const startData = await startRes.json();
    const taskId: string = startData.taskId;
    if (!taskId) throw new Error('PixVerse: no taskId returned');

    onProgress?.({ clipId, status: 'processing', progress: 20 });

    // Poll with exponential backoff
    let attempts = 0;
    let delay = 8000;
    const maxAttempts = 36; // ~8 min max

    while (attempts < maxAttempts) {
      await new Promise(r => setTimeout(r, delay));
      attempts++;

      const pollRes = await fetch(`/api/fal/pixverse-video/${taskId}`);
      const pollData = await pollRes.json();
      const pct = Math.min(20 + Math.round((attempts / maxAttempts) * 75), 95);
      onProgress?.({ clipId, status: 'processing', progress: pct });

      if (pollData.status === 'completed' && pollData.videoUrl) {
        const done: VideoGenerationProgress = { clipId, status: 'completed', progress: 100, videoUrl: pollData.videoUrl };
        onProgress?.(done);
        return done;
      }
      if (pollData.status === 'failed') {
        throw new Error(pollData.error || 'PixVerse task failed');
      }
      delay = Math.min(delay * 1.4, 30000);
    }

    throw new Error('PixVerse task timed out');
  } catch (error: any) {
    throw error;
  }
}

/**
 * Obtener información de modelos disponibles
 */
export function getAvailableVideoModels() {
  return [
    {
      id: 'kling-2.5-pro-i2v',
      name: 'KLING 2.5 Pro',
      description: 'Máxima calidad cinematográfica',
      pricing: 'Premium',
      maxDuration: 10
    },
    {
      id: 'kling-2.1-master-i2v',
      name: 'KLING 2.1 Master',
      description: 'Calidad premium con fluidez superior',
      pricing: '$1.40/5seg',
      maxDuration: 10
    },
    {
      id: 'kling-2.1-pro-i2v',
      name: 'KLING 2.1 Pro',
      description: 'Grado profesional recomendado',
      pricing: '$0.45/5seg',
      maxDuration: 10
    },
    {
      id: 'kling-2.1-standard-i2v',
      name: 'KLING 2.1 Standard',
      description: 'Alta calidad económica',
      pricing: '$0.25/5seg',
      maxDuration: 10
    },
    {
      id: 'luma-dream-machine',
      name: 'Luma Dream Machine',
      description: 'Balance calidad-velocidad',
      pricing: 'Medium',
      maxDuration: 5
    },
    {
      id: 'minimax-hailuo-2.3',
      name: 'MiniMax Hailuo 2.3',
      description: 'Última versión de MiniMax',
      pricing: 'Económico',
      maxDuration: 10
    },
    {
      id: 'minimax-hailuo-02',
      name: 'MiniMax Hailuo 02',
      description: 'Versión estable y rápida',
      pricing: 'Económico',
      maxDuration: 6
    }
  ];
}

export default {
  generateVideoFromClip,
  generateBatchVideosFromClips,
  getAvailableVideoModels
};
