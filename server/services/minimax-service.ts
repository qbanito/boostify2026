import axios from 'axios';

/**
 * MiniMax Video & Music Generation Service
 * Servicio completo para generación de video desde imágenes y música con sincronización
 */

export interface MinimaxVideoOptions {
  firstFrameImage: string; // URL de la imagen inicial
  prompt: string; // Descripción del movimiento/animación
  model?: 'MiniMax-Hailuo-2.3' | 'MiniMax-Hailuo-02' | 'Video-01';
  duration?: number; // 6 o 10 segundos
  resolution?: '720P' | '1080P';
}

export interface MinimaxMusicOptions {
  prompt: string; // Estilo, género, mood (ej: "EDM, energetic, festival vibes")
  lyrics?: string; // Letra con estructura [Verse], [Chorus], etc.
  referenceAudioUrl?: string; // Audio de referencia (opcional)
  duration?: number; // Duración en segundos (máx 60)
}

export interface MinimaxTaskResult {
  success: boolean;
  taskId?: string;
  videoUrl?: string;
  audioUrl?: string;
  error?: string;
  status?: string;
  metadata?: any;
}

/**
 * API Base URL
 */
const MINIMAX_API_BASE = 'https://api.minimax.io/v1';

/**
 * Obtener headers de autenticación
 */
function getAuthHeaders(): Record<string, string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  
  if (!apiKey) {
    throw new Error('MINIMAX_API_KEY no está configurada');
  }
  
  return {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
}

/**
 * Generar video desde imagen (Image-to-Video)
 * PERFECTO PARA MUSIC VIDEOS: Anima las imágenes generadas siguiendo el ritmo
 */
export async function generateImageToVideo(
  options: MinimaxVideoOptions
): Promise<MinimaxTaskResult> {
  try {
    console.log(`🎬 Iniciando generación de video con MiniMax...`);
    console.log(`📸 Imagen: ${options.firstFrameImage}`);
    console.log(`📝 Prompt: ${options.prompt}`);
    
    const response = await axios.post(
      `${MINIMAX_API_BASE}/video_generation`,
      {
        first_frame_image: options.firstFrameImage,
        prompt: options.prompt,
        model: options.model || 'MiniMax-Hailuo-2.3',
        duration: options.duration || 6,
        resolution: options.resolution || '1080P'
      },
      { headers: getAuthHeaders() }
    );
    
    const taskId = response.data.task_id;
    
    console.log(`✅ Tarea de video creada: ${taskId}`);
    
    return {
      success: true,
      taskId,
      status: 'processing',
      metadata: response.data
    };
  } catch (error: any) {
    console.error('❌ Error generando video con MiniMax:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Error desconocido'
    };
  }
}

/**
 * Consultar el estado de una tarea de video
 */
export async function queryVideoTaskStatus(taskId: string): Promise<MinimaxTaskResult> {
  try {
    const response = await axios.get(
      `${MINIMAX_API_BASE}/query/video_generation`,
      {
        params: { task_id: taskId },
        headers: getAuthHeaders()
      }
    );
    
    const data = response.data;
    const status = data.status; // "Success", "Processing", "Failed"
    
    console.log(`📊 Estado de video ${taskId}: ${status}`);
    
    if (status === 'Success' || status === 'Successful') {
      return {
        success: true,
        taskId,
        videoUrl: data.file_id || data.video_url || data.url,
        status: 'completed',
        metadata: data
      };
    } else if (status === 'Failed') {
      return {
        success: false,
        taskId,
        status: 'failed',
        error: data.error?.message || 'Video generation failed'
      };
    }
    
    // Aún en proceso
    return {
      success: true,
      taskId,
      status: 'processing',
      metadata: data
    };
  } catch (error: any) {
    console.error('❌ Error consultando estado de video:', error.response?.data || error.message);
    return {
      success: false,
      error: error.message || 'Error desconocido al consultar estado'
    };
  }
}

/**
 * Esperar a que el video se complete (polling)
 * IMPORTANTE: Puede tardar 2-5 minutos
 */
export async function waitForVideoCompletion(
  taskId: string,
  maxWaitTime: number = 300000, // 5 minutos por defecto
  pollInterval: number = 5000 // Consultar cada 5 segundos
): Promise<MinimaxTaskResult> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitTime) {
    const result = await queryVideoTaskStatus(taskId);
    
    if (!result.success) {
      return result;
    }
    
    if (result.status === 'completed') {
      console.log(`✅ Video completado: ${result.videoUrl}`);
      return result;
    }
    
    if (result.status === 'failed') {
      return result;
    }
    
    // Esperar antes de la siguiente consulta
    console.log(`⏳ Video aún en proceso... esperando ${pollInterval/1000}s`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
  
  return {
    success: false,
    error: 'Timeout: El video tardó demasiado en generarse'
  };
}

/**
 * Generar música con MiniMax Music-2.0
 * IDEAL PARA: Crear música que sigue el mood del video
 */
export async function generateMusic(
  options: MinimaxMusicOptions
): Promise<MinimaxTaskResult> {
  try {
    console.log(`🎵 Iniciando generación de música con MiniMax...`);
    console.log(`📝 Prompt: ${options.prompt}`);
    
    const payload: any = {
      model: 'music-2.0',
      prompt: options.prompt,
      audio_setting: {
        sample_rate: 44100,
        bitrate: 256000,
        format: 'mp3'
      }
    };
    
    if (options.lyrics) {
      payload.lyrics = options.lyrics;
    }
    
    if (options.referenceAudioUrl) {
      payload.reference_audio_url = options.referenceAudioUrl;
    }
    
    const response = await axios.post(
      `${MINIMAX_API_BASE}/music_generation`,
      payload,
      { headers: getAuthHeaders() }
    );
    
    const taskId = response.data.task_id;
    
    console.log(`✅ Tarea de música creada: ${taskId}`);
    
    return {
      success: true,
      taskId,
      status: 'processing',
      metadata: response.data
    };
  } catch (error: any) {
    console.error('❌ Error generando música con MiniMax:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message || 'Error desconocido'
    };
  }
}

/**
 * Generar video en batch desde múltiples imágenes
 * PERFECTO PARA MUSIC VIDEOS: Genera un video por cada escena
 */
export async function generateBatchVideos(
  scenes: Array<{
    imageUrl: string;
    prompt: string;
    duration?: number;
  }>,
  options?: {
    model?: MinimaxVideoOptions['model'];
    resolution?: MinimaxVideoOptions['resolution'];
    onProgress?: (completed: number, total: number) => void;
  }
): Promise<Map<number, MinimaxTaskResult>> {
  const results = new Map<number, MinimaxTaskResult>();
  
  console.log(`🎬 Generando ${scenes.length} videos con MiniMax en batch...`);
  
  // Iniciar todas las tareas
  const taskIds: Array<{ index: number; taskId: string }> = [];
  
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    console.log(`🎬 Iniciando video ${i + 1}/${scenes.length}...`);
    
    const result = await generateImageToVideo({
      firstFrameImage: scene.imageUrl,
      prompt: scene.prompt,
      duration: scene.duration || 6,
      model: options?.model,
      resolution: options?.resolution
    });
    
    if (result.success && result.taskId) {
      taskIds.push({ index: i + 1, taskId: result.taskId });
    } else {
      results.set(i + 1, result);
    }
    
    // Pequeño delay para evitar rate limiting
    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`✅ ${taskIds.length} tareas de video iniciadas, esperando completación...`);
  
  // Esperar a que todas completen (en paralelo)
  const completionPromises = taskIds.map(async ({ index, taskId }) => {
    const result = await waitForVideoCompletion(taskId, 300000, 5000);
    results.set(index, result);
    
    if (options?.onProgress) {
      options.onProgress(results.size, scenes.length);
    }
    
    return result;
  });
  
  await Promise.all(completionPromises);
  
  const successCount = Array.from(results.values()).filter(r => r.success).length;
  console.log(`✅ Generación batch completada: ${successCount}/${scenes.length} videos exitosos`);
  
  return results;
}

/**
 * FUNCIÓN HELPER: Crear prompts optimizados para sincronización musical
 * Basado en análisis de ritmo y tempo
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
  generateImageToVideo,
  queryVideoTaskStatus,
  waitForVideoCompletion,
  generateMusic,
  generateBatchVideos,
  createMusicSyncedPrompt
};
