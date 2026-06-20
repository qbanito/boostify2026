/**
 * Rutas para el servicio de upscaling de video con Qubico
 * 
 * Este módulo implementa endpoints para mejorar la calidad de videos
 * utilizando el modelo Qubico/video-toolkit a través de PiAPI.
 */

import express, { Request, Response, Router } from 'express';
import { authenticate } from '../middleware/auth';
import axios from 'axios';
import { db } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const PIAPI_API_KEY = process.env.PIAPI_API_KEY;
const KLING_API_KEY = process.env.KLING_API_KEY;

/**
 * Objeto global para almacenar el estado de las tareas de upscaling activas
 */
interface UpscaleTask {
  taskId: string;
  userId: string;
  videoUrl: string;
  options: {
    resolution: string;
    quality: string;
    framerate: number;
    stabilization: boolean;
  };
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  result?: {
    url?: string;
    originalWidth?: number;
    originalHeight?: number;
    newWidth?: number;
    newHeight?: number;
  };
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

const activeUpscaleTasks = new Map<string, UpscaleTask>();

/**
 * Verificar que las claves API requeridas estén configuradas
 */
function verifyApiKeys() {
  if (!PIAPI_API_KEY && !KLING_API_KEY) {
    console.error('Ninguna clave API está configurada para el servicio de upscaling de video');
    return false;
  }
  return true;
}

/**
 * Endpoint para iniciar una tarea de upscaling de video
 * 
 * Este endpoint recibe un video y lo mejora utilizando el modelo Qubico/video-toolkit
 */
router.post('/upscale/start', authenticate, async (req: Request, res: Response) => {
  if (!verifyApiKeys()) {
    return res.status(500).json({
      success: false,
      error: 'Las claves API de PiAPI o Kling no están configuradas'
    });
  }

  try {
    const { videoUrl, options } = req.body;

    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una URL de video'
      });
    }

    // Generar un ID único para la tarea
    const taskId = uuidv4();
    
    // Crear una nueva tarea de upscaling
    const upscaleTask: UpscaleTask = {
      taskId,
      userId: req.user?.uid || 'anonymous',
      videoUrl,
      options: {
        resolution: options?.resolution || '1080p',
        quality: options?.quality || 'high',
        framerate: options?.framerate || 30,
        stabilization: options?.stabilization !== undefined ? options.stabilization : true
      },
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Guardar la tarea en el mapa de tareas activas
    activeUpscaleTasks.set(taskId, upscaleTask);
    
    // Iniciar el proceso de upscaling en segundo plano
    setImmediate(() => {
      startUpscaling(taskId)
        .catch(error => {
          console.error(`Error en proceso de upscaling para tarea ${taskId}:`, error);
          
          const task = activeUpscaleTasks.get(taskId);
          if (task) {
            task.status = 'failed';
            task.error = error.message || 'Error desconocido en el proceso de upscaling';
            task.updatedAt = new Date();
            activeUpscaleTasks.set(taskId, task);
          }
        });
    });
    
    // Responder con el ID de la tarea para que el cliente pueda verificar el estado
    res.status(200).json({
      success: true,
      taskId,
      message: 'Tarea de upscaling iniciada correctamente'
    });
    
  } catch (error) {
    console.error('Error iniciando tarea de upscaling:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al iniciar el upscaling'
    });
  }
});

/**
 * Endpoint para verificar el estado de una tarea de upscaling
 */
router.get('/upscale/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un ID de tarea válido'
      });
    }
    
    // Obtener la tarea del mapa de tareas activas
    const task = activeUpscaleTasks.get(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Tarea no encontrada'
      });
    }
    
    // Responder con el estado actual de la tarea
    res.status(200).json({
      success: true,
      taskId: task.taskId,
      status: task.status,
      progress: task.progress || 0,
      url: task.result?.url,
      originalWidth: task.result?.originalWidth,
      originalHeight: task.result?.originalHeight,
      newWidth: task.result?.newWidth,
      newHeight: task.result?.newHeight,
      error: task.error
    });
    
  } catch (error) {
    console.error('Error verificando estado de tarea de upscaling:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al verificar el estado'
    });
  }
});

/**
 * Endpoint para guardar un video mejorado en Firestore
 */
router.post('/save', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoUrl, metadata } = req.body;
    const userId = req.user?.uid;
    
    if (!videoUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una URL de video'
      });
    }
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }
    
    // Guardar el video en Firestore
    const videoRef = db.collection('enhanced_videos');
    const docRef = await videoRef.add({
      url: videoUrl,
      userId,
      title: metadata?.title || 'Video mejorado',
      description: metadata?.description || '',
      originalVideoId: metadata?.originalVideoId || null,
      upscaleOptions: metadata?.upscaleOptions || null,
      createdAt: new Date(),
      thumbnailUrl: metadata?.thumbnailUrl || null
    });
    
    res.status(200).json({
      success: true,
      videoId: docRef.id,
      message: 'Video guardado correctamente'
    });
    
  } catch (error) {
    console.error('Error guardando video mejorado:', error);
    
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al guardar el video'
    });
  }
});

/**
 * Función para iniciar el proceso de upscaling en segundo plano
 * 
 * @param taskId ID de la tarea de upscaling
 */
async function startUpscaling(taskId: string): Promise<void> {
  // Obtener la tarea del mapa de tareas activas
  const task = activeUpscaleTasks.get(taskId);
  
  if (!task) {
    throw new Error(`Tarea ${taskId} no encontrada`);
  }
  
  try {
    // Actualizar el estado de la tarea
    task.status = 'processing';
    task.progress = 0;
    task.updatedAt = new Date();
    activeUpscaleTasks.set(taskId, task);
    
    // Configurar opciones de upscaling basadas en las preferencias del usuario
    const resolutionMap: Record<string, { width: number, height: number }> = {
      '720p': { width: 1280, height: 720 },
      '1080p': { width: 1920, height: 1080 },
      '4k': { width: 3840, height: 2160 }
    };
    
    const qualityMap: Record<string, number> = {
      'standard': 75,
      'high': 85,
      'ultra': 95
    };
    
    const selectedResolution = resolutionMap[task.options.resolution] || resolutionMap['1080p'];
    const selectedQuality = qualityMap[task.options.quality] || qualityMap['high'];
    
    // Preparar los parámetros para la API de PiAPI/Qubico
    const params = {
      model: "Qubico/flux1-dev", // Para upscaling de video se usa el modelo Qubico
      task_type: "video_upscale",
      input_url: task.videoUrl,
      target_width: selectedResolution.width,
      target_height: selectedResolution.height,
      quality: selectedQuality,
      framerate: task.options.framerate,
      stabilize_video: task.options.stabilization
    };
    
    // Primera actualización de progreso
    task.progress = 5;
    task.updatedAt = new Date();
    activeUpscaleTasks.set(taskId, task);
    
    // Iniciar el proceso de upscaling con PiAPI o Kling
    let apiResponse;
    
    if (PIAPI_API_KEY) {
      // Usar PiAPI si está disponible
      apiResponse = await axios.post('https://api.piapi.ai/api/v1/task', params, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PIAPI_API_KEY}`
        }
      });
    } else if (KLING_API_KEY) {
      // Usar Kling como alternativa
      apiResponse = await axios.post('https://kling.vip/api/v1/task', params, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${KLING_API_KEY}`
        }
      });
    } else {
      throw new Error('No se encontró una clave API válida para el servicio de upscaling');
    }
    
    // Verificar la respuesta de la API
    const apiTask = apiResponse.data;
    
    if (!apiTask.task_id) {
      throw new Error('No se recibió un ID de tarea válido de la API de upscaling');
    }
    
    // Actualizar el progreso
    task.progress = 15;
    task.updatedAt = new Date();
    activeUpscaleTasks.set(taskId, task);
    
    // Comprobar el estado de la tarea de upscaling
    let finalResult;
    let isCompleted = false;
    let retries = 0;
    const MAX_RETRIES = 30;
    const POLLING_INTERVAL = 5000;
    
    while (!isCompleted && retries < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL));
      
      retries++;
      
      // Actualizar progreso basado en el número de intentos
      // Limitamos a 85% máximo para dejar margen para la finalización
      const progressIncrement = (85 - 15) / MAX_RETRIES;
      task.progress = Math.min(85, 15 + (progressIncrement * retries));
      task.updatedAt = new Date();
      activeUpscaleTasks.set(taskId, task);
      
      try {
        // Verificar el estado de la tarea con la API correspondiente
        let statusResponse;
        
        if (PIAPI_API_KEY) {
          // Verificar con PiAPI
          statusResponse = await axios.get(`https://api.piapi.ai/api/v1/task/${apiTask.task_id}`, {
            headers: {
              'Authorization': `Bearer ${PIAPI_API_KEY}`
            }
          });
        } else {
          // Verificar con Kling
          statusResponse = await axios.get(`https://kling.vip/api/v1/task/${apiTask.task_id}`, {
            headers: {
              'Authorization': `Bearer ${KLING_API_KEY}`
            }
          });
        }
        
        // Extraer el resultado del estado
        let statusData = statusResponse.data;
        
        // Manejar estructura anidada (común en estas APIs)
        if (statusData.data && typeof statusData.data === 'object') {
          statusData = statusData.data;
        }
        
        if (statusData.status === 'completed' || statusData.status === 'success') {
          // La tarea se ha completado con éxito
          isCompleted = true;
          finalResult = statusData;
          
          // Extraer la URL del video mejorado
          let resultUrl = null;
          
          if (statusData.result && statusData.result.url) {
            resultUrl = statusData.result.url;
          } else if (statusData.url) {
            resultUrl = statusData.url;
          } else if (statusData.output_url) {
            resultUrl = statusData.output_url;
          }
          
          if (!resultUrl) {
            throw new Error('No se encontró una URL válida en el resultado del upscaling');
          }
          
          // Actualizar la tarea con el resultado
          task.status = 'completed';
          task.progress = 100;
          task.result = {
            url: resultUrl,
            originalWidth: statusData.original_width || statusData.input_width || 0,
            originalHeight: statusData.original_height || statusData.input_height || 0,
            newWidth: selectedResolution.width,
            newHeight: selectedResolution.height
          };
          task.updatedAt = new Date();
          activeUpscaleTasks.set(taskId, task);
          
          break;
        } else if (statusData.status === 'failed' || statusData.status === 'error') {
          // La tarea ha fallado
          throw new Error(statusData.error || 'Error desconocido en el proceso de upscaling');
        }
        
        // Si no está completada ni fallida, continuar esperando
        console.log(`Tarea de upscaling ${taskId} en proceso, intento ${retries}/${MAX_RETRIES}`);
        
      } catch (error) {
        console.error(`Error verificando estado de upscaling (intento ${retries}/${MAX_RETRIES}):`, error);
        
        // En caso de error de verificación, continuamos intentando
        // Solo fallamos si se agotan todos los intentos
        if (retries >= MAX_RETRIES) {
          throw error;
        }
      }
    }
    
    // Verificar si se completó exitosamente o se agotaron los intentos
    if (!isCompleted) {
      throw new Error(`Tiempo de espera agotado para la tarea de upscaling ${taskId}`);
    }
    
    // Si llegamos aquí, la tarea se completó exitosamente
    console.log(`Tarea de upscaling ${taskId} completada exitosamente`);
    
  } catch (error) {
    // En caso de error, actualizar el estado de la tarea
    console.error(`Error en proceso de upscaling para tarea ${taskId}:`, error);
    
    task.status = 'failed';
    task.error = error instanceof Error ? error.message : 'Error desconocido en el proceso de upscaling';
    task.updatedAt = new Date();
    activeUpscaleTasks.set(taskId, task);
    
    throw error;
  }
}

export default router;