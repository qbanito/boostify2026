import { logger } from "../logger";
/**
 * MiniMax Video Generation Client
 * Cliente para generar videos desde imágenes usando MiniMax Image-to-Video API
 */

export interface MinimaxVideoRequest {
  imageUrl: string;
  prompt: string;
  model?: 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-02' | 'Video-01';
  duration?: number; // 6 o 10 segundos
  resolution?: '720P' | '1080P';
}

export interface MinimaxBatchRequest {
  scenes: Array<{
    imageUrl: string;
    prompt: string;
    duration?: number;
  }>;
  model?: MinimaxVideoRequest['model'];
  resolution?: MinimaxVideoRequest['resolution'];
}

export interface MinimaxTaskStatus {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  status?: 'processing' | 'completed' | 'failed';
  error?: string;
  metadata?: any;
}

/**
 * Generar video individual desde imagen
 */
export async function generateVideoFromImage(
  request: MinimaxVideoRequest
): Promise<MinimaxTaskStatus> {
  try {
    const response = await fetch('/api/minimax/video/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error generating video');
    }

    return await response.json();
  } catch (error: any) {
    logger.error('Error generando video con MiniMax:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Consultar estado de generación de video
 */
export async function queryVideoStatus(taskId: string): Promise<MinimaxTaskStatus> {
  try {
    const response = await fetch(`/api/minimax/video/status/${taskId}`);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error querying video status');
    }

    return await response.json();
  } catch (error: any) {
    logger.error('Error consultando estado de video:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Esperar a que el video se complete (con polling)
 */
export async function waitForVideoCompletion(
  taskId: string,
  onProgress?: (status: string) => void,
  maxWaitTime: number = 300000 // 5 minutos
): Promise<MinimaxTaskStatus> {
  const startTime = Date.now();
  const pollInterval = 5000; // 5 segundos

  while (Date.now() - startTime < maxWaitTime) {
    const status = await queryVideoStatus(taskId);

    if (onProgress && status.status) {
      onProgress(status.status);
    }

    if (status.status === 'completed') {
      return status;
    }

    if (status.status === 'failed' || !status.success) {
      return status;
    }

    // Esperar antes de siguiente poll
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return {
    success: false,
    error: 'Timeout: El video tardó demasiado en generarse'
  };
}

/**
 * Generar múltiples videos en batch
 */
export async function generateBatchVideos(
  request: MinimaxBatchRequest
): Promise<{ success: boolean; taskIds: string[]; error?: string }> {
  try {
    const response = await fetch('/api/minimax/video/generate-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error generating batch videos');
    }

    return await response.json();
  } catch (error: any) {
    logger.error('Error generando batch de videos:', error);
    return {
      success: false,
      taskIds: [],
      error: error.message || 'Error desconocido'
    };
  }
}

/**
 * Helper: Crear prompt optimizado para sincronización musical
 */
export function createMusicSyncedPrompt(
  basePrompt: string,
  musicAnalysis: {
    tempo?: 'slow' | 'medium' | 'fast' | 'very-fast';
    energy?: 'calm' | 'moderate' | 'energetic' | 'intense';
    genre?: string;
  }
): string {
  const movements: Record<string, string> = {
    'slow': '[Slow dolly zoom, Gentle pan]',
    'medium': '[Smooth tracking shot, Medium pan]',
    'fast': '[Dynamic camera movement, Quick cuts]',
    'very-fast': '[Rapid zoom, Fast panning, Energetic motion]'
  };

  const energy: Record<string, string> = {
    'calm': 'subtle motion, smooth transitions',
    'moderate': 'steady movement, balanced energy',
    'energetic': 'dynamic action, lively motion',
    'intense': 'explosive motion, high-energy movements'
  };

  const cameraMovement = movements[musicAnalysis.tempo || 'medium'];
  const motionStyle = energy[musicAnalysis.energy || 'moderate'];

  return `${basePrompt}. ${cameraMovement}. Cinematic ${motionStyle}, professional music video aesthetics.`;
}

export default {
  generateVideoFromImage,
  queryVideoStatus,
  waitForVideoCompletion,
  generateBatchVideos,
  createMusicSyncedPrompt
};
