import axios from 'axios';
import { logger } from "../logger";
import { UpscaleOptions } from '../../components/music-video/final-rendering';

/**
 * Interfaz para los resultados de las operaciones de video
 */
export interface VideoOperationResult {
  success: boolean;
  taskId?: string;
  url?: string;
  error?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
}

/**
 * Interfaz para las operaciones de upscaling de video
 */
export interface VideoUpscaleResult extends VideoOperationResult {
  originalWidth?: number;
  originalHeight?: number;
  newWidth?: number;
  newHeight?: number;
  qualityImprovement?: string;
}

/**
 * Mejora la calidad de un video utilizando el servicio de upscaling de Qubico
 * 
 * @param videoUrl URL del video a mejorar
 * @param options Opciones de upscaling (resolución, calidad, etc.)
 * @returns Promesa con el resultado de la operación
 */
export async function upscaleVideo(
  videoUrl: string, 
  options: UpscaleOptions
): Promise<VideoUpscaleResult> {
  try {
    // Llamada a la API para iniciar el proceso de upscaling
    const response = await axios.post('/api/video/upscale/start', {
      videoUrl,
      options
    });
    
    const { taskId } = response.data;
    
    if (!taskId) {
      throw new Error('No se recibió un ID de tarea válido para el upscaling');
    }
    
    // Función para verificar el estado del upscaling
    const checkStatus = async (): Promise<VideoUpscaleResult> => {
      const statusResponse = await axios.get(`/api/video/upscale/status?taskId=${taskId}`);
      const result = statusResponse.data;
      
      if (result.status === 'failed') {
        throw new Error(result.error || 'Error en el proceso de upscaling');
      }
      
      if (result.status === 'completed' && result.url) {
        return {
          success: true,
          taskId,
          url: result.url,
          status: 'completed',
          originalWidth: result.originalWidth,
          originalHeight: result.originalHeight,
          newWidth: result.newWidth,
          newHeight: result.newHeight,
          qualityImprovement: result.qualityImprovement
        };
      }
      
      // Si aún está procesando, esperar y verificar de nuevo
      await new Promise(resolve => setTimeout(resolve, 2000));
      return checkStatus();
    };
    
    // Iniciar verificación de estado
    return checkStatus();
    
  } catch (error) {
    logger.error('Error en upscaleVideo:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido en el proceso de upscaling',
      status: 'failed'
    };
  }
}

/**
 * Guarda un video mejorado en Firestore y Storage
 * 
 * @param videoUrl URL del video mejorado
 * @param userId ID del usuario
 * @param metadata Metadatos del video (título, descripción, etc.)
 * @returns Promesa con el resultado de la operación
 */
export async function saveEnhancedVideo(
  videoUrl: string,
  userId: string,
  metadata: {
    title: string;
    description?: string;
    originalVideoId?: string;
    upscaleOptions?: UpscaleOptions;
  }
): Promise<{
  success: boolean;
  videoId?: string;
  error?: string;
}> {
  try {
    const response = await axios.post('/api/video/save', {
      videoUrl,
      userId,
      metadata
    });
    
    return {
      success: true,
      videoId: response.data.videoId
    };
    
  } catch (error) {
    logger.error('Error guardando video mejorado:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al guardar el video'
    };
  }
}

/**
 * Obtiene la lista de videos mejorados del usuario
 * 
 * @param userId ID del usuario
 * @returns Promesa con la lista de videos
 */
export async function getEnhancedVideos(userId: string): Promise<{
  success: boolean;
  videos?: Array<{
    id: string;
    title: string;
    url: string;
    thumbnailUrl?: string;
    createdAt: Date;
    metadata?: any;
  }>;
  error?: string;
}> {
  try {
    const response = await axios.get(`/api/video/enhanced?userId=${userId}`);
    
    return {
      success: true,
      videos: response.data.videos
    };
    
  } catch (error) {
    logger.error('Error obteniendo videos mejorados:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al obtener los videos'
    };
  }
}

/**
 * Verifica el estado actual de una tarea de procesamiento de video
 * 
 * @param taskId ID de la tarea a verificar
 * @returns Resultado del estado actual de la tarea
 */
export async function checkVideoStatus(taskId: string): Promise<VideoOperationResult> {
  try {
    const response = await axios.get(`/api/video/status?taskId=${taskId}`);
    
    return {
      success: true,
      taskId,
      status: response.data.status,
      url: response.data.url,
      error: response.data.error
    };
  } catch (error) {
    logger.error('Error verificando estado del video:', error);
    
    return {
      success: false,
      taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Error desconocido al verificar el estado'
    };
  }
}

/**
 * Interfaz para opciones de generación de video
 */
export interface VideoGenerationOptions {
  prompt: string;
  model?: string;
  cameraMovements?: string[];
  imageUrl?: string;
}

/**
 * Interfaz para respuesta del estado de video
 */
export interface VideoStatusResponse extends VideoOperationResult {
  progress?: number;
}

/**
 * Genera un video usando el servicio de PiAPI/Hailuo
 * 
 * @param options Opciones para la generación del video
 * @returns Promesa con el resultado de la operación
 */
export async function generateVideo(options: VideoGenerationOptions): Promise<VideoOperationResult> {
  try {
    const response = await axios.post('/api/proxy/piapi/video/start', options);
    
    return {
      success: true,
      taskId: response.data.taskId,
      status: 'pending'
    };
  } catch (error) {
    logger.error('Error generando video:', error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al generar el video',
      status: 'failed'
    };
  }
}