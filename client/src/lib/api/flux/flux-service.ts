import { logger } from "../../logger";
/**
 * Servicio para interactuar con la API de Flux
 * 
 * Este servicio proporciona métodos para generar imágenes con Flux API
 * a través de nuestro proxy del servidor.
 */

import axios from 'axios';
import { fluxLocalStorageService } from './flux-local-storage-service';

// Modelos disponibles en Flux
export enum FluxModel {
  FLUX1_DEV = 'Qubico/flux1-dev',
  FLUX1_SCHNELL = 'Qubico/flux1-schnell',
  FLUX1_DEV_ADVANCED = 'Qubico/flux1-dev-advanced'
}

// Tipos de tareas disponibles
export enum FluxTaskType {
  TXT2IMG = 'txt2img',
  IMG2IMG = 'img2img',
  TXT2IMG_LORA = 'txt2img-lora',
  IMG2IMG_LORA = 'img2img-lora',
  CONTROLNET_LORA = 'controlnet-lora',
  FILL_INPAINT = 'fill-inpaint',
  FILL_OUTPAINT = 'fill-outpaint',
  REDUX_VARIATION = 'redux-variation'
}

// Tipos de LoRA disponibles para Flux
export enum FluxLoraType {
  ANIME = 'anime',
  ART = 'art',
  DISNEY = 'disney',
  FURRY = 'furry',
  MJV6 = 'mjv6',
  REALISM = 'realism',
  SCENERY = 'scenery',
  COLLAGE_ARTSTYLE = 'collage_artstyle',
  CREEPYCUTE = 'creepycute',
  CYBERPUNK_ANIME = 'cyberpunk_anime',
  DECO_PULSE = 'deco_pulse',
  DEEP_SEA = 'deep_sea',
  FAETASTIC = 'faetastic',
  FRACTAL = 'fractal',
  GALACTIXY = 'galactixy',
  GEOMETRIC_WOMAN = 'geometric_woman',
  GRAPHIC_PORTRAIT = 'graphic_portrait',
  MAT_MILLER = 'mat_miller',
  MOEBIUS = 'moebius',
  ISOMETRIC = 'isometric',
  PAPER_QUILLING = 'paper_quilling'
}

export interface FluxGenerationParams {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  guidance_scale?: number;
  steps?: number;
  model?: string;
  taskType?: string;
}

export interface FluxImageToImageParams extends Omit<FluxGenerationParams, 'width' | 'height'> {
  image: string; // Base64 o URL de la imagen
  denoise?: number;
}

export interface FluxTaskResult {
  success: boolean;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  url?: string;
  images?: string[];
  code?: number;
  data?: any;
  message?: string;
  model?: string; // Agregamos el campo model para alojar el modelo usado
}

/**
 * Servicio principal para interactuar con la API de Flux
 */
export const fluxService = {
  /**
   * Genera una imagen a partir de un texto usando la API de Flux
   * 
   * @param params Parámetros para la generación de la imagen
   * @returns Resultado de la operación con taskId para verificar posteriormente
   */
  async generateImage(params: FluxGenerationParams): Promise<FluxTaskResult> {
    try {
      logger.info('Enviando solicitud a Flux API:', params);
      
      // Ruta del endpoint en el servidor - verifique que coincida con server/routes/flux-api-proxy.ts
      const response = await axios.post('/api/flux/generate-image', params);
      
      logger.info('Respuesta de Flux API:', response.data);
      
      // La respuesta puede venir en dos formatos diferentes dependiendo del endpoint
      // 1. Formato antiguo: { code: 200, message: "success", data: { task_id: "..." } }
      // 2. Formato directo: { task_id: "...", status: "processing", model: "..." }
      
      // Detectar el formato y normalizarlo
      if (response.data.code === 200 && response.data.message === "success") {
        // Formato antiguo estructurado
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: response.data.data?.task_id,
          status: response.data.data?.status || 'pending',
          code: response.data.code,
          message: response.data.message,
          data: response.data.data
        };
        
        // Guardar en el servicio de almacenamiento local
        fluxLocalStorageService.saveTask(taskResult);
        
        return taskResult;
      } else if (response.data.task_id) {
        // Formato directo desde PiAPI
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: response.data.task_id,
          status: response.data.status || 'pending',
          model: response.data.model,
          message: "Task created successfully",
          data: response.data
        };
        
        // Guardar en el servicio de almacenamiento local
        fluxLocalStorageService.saveTask(taskResult);
        
        return taskResult;
      }
      
      return {
        success: false,
        error: response.data.message || 'Unknown error',
        code: response.data.code
      };
    } catch (error: any) {
      logger.error('Error al generar imagen con Flux:', error);
      return {
        success: false,
        error: error.message || 'Error en la generación de imagen'
      };
    }
  },
  
  /**
   * Genera una imagen a partir de otra imagen usando la API de Flux (img2img)
   * 
   * @param params Parámetros para la generación incluyendo la imagen base
   * @returns Resultado de la operación con taskId para verificar posteriormente
   */
  async generateImageFromImage(params: FluxImageToImageParams): Promise<FluxTaskResult> {
    try {
      logger.info('Enviando solicitud img2img a Flux API:', params);
      
      const response = await axios.post('/api/flux/image-to-image', params);
      
      logger.info('Respuesta de Flux API (img2img):', response.data);
      
      // La respuesta puede venir en dos formatos diferentes dependiendo del endpoint
      // 1. Formato antiguo: { code: 200, message: "success", data: { task_id: "..." } }
      // 2. Formato directo: { task_id: "...", status: "processing", model: "..." }
      
      // Detectar el formato y normalizarlo
      if (response.data.code === 200 && response.data.message === "success") {
        // Formato antiguo estructurado
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: response.data.data?.task_id,
          status: response.data.data?.status || 'pending',
          code: response.data.code,
          message: response.data.message,
          data: response.data.data
        };
        
        // Guardar en el servicio de almacenamiento local
        fluxLocalStorageService.saveTask(taskResult);
        
        return taskResult;
      } else if (response.data.task_id) {
        // Formato directo desde PiAPI
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: response.data.task_id,
          status: response.data.status || 'pending',
          model: response.data.model,
          message: "Task created successfully",
          data: response.data
        };
        
        // Guardar en el servicio de almacenamiento local
        fluxLocalStorageService.saveTask(taskResult);
        
        return taskResult;
      }
      
      return {
        success: false,
        error: response.data.message || 'Unknown error',
        code: response.data.code
      };
    } catch (error: any) {
      logger.error('Error al generar imagen con Flux (img2img):', error);
      return {
        success: false,
        error: error.message || 'Error en la generación de imagen desde imagen'
      };
    }
  },
  
  /**
   * Verifica el estado de una tarea de generación de imagen
   * 
   * @param taskId ID de la tarea a verificar
   * @returns Estado actual de la tarea
   */
  async checkTaskStatus(taskId: string): Promise<FluxTaskResult> {
    try {
      logger.info('Verificando estado de tarea Flux:', taskId);
      
      const response = await axios.get(`/api/flux/status?taskId=${taskId}`);
      
      logger.info('Respuesta de verificación de estado:', response.data);
      
      // Procesar y normalizar la respuesta
      // Puede venir en formato antiguo o directo desde PiAPI
      if (response.data.code === 200) {
        // Formato antiguo estructurado
        const taskData = response.data.data;
        
        // Extraer URLs de imágenes si la tarea está completa
        let images: string[] | undefined;
        let url: string | undefined;
        
        if (taskData.status === 'completed' && taskData.output) {
          if (Array.isArray(taskData.output.images)) {
            images = taskData.output.images;
          } else if (taskData.output.image) {
            url = taskData.output.image;
            images = [taskData.output.image];
          } else if (taskData.output.image_url) {
            // Nueva estructura de respuesta en el ejemplo proporcionado
            url = taskData.output.image_url;
            images = [taskData.output.image_url];
            logger.info('Imagen encontrada en output.image_url (formato antiguo):', url);
          } else if (typeof taskData.output === 'string') {
            // Caso donde output es directamente la URL como string
            url = taskData.output;
            images = [taskData.output];
            logger.info('Imagen encontrada directamente en output como string:', url);
          }
        }
        
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: taskData.task_id,
          status: taskData.status,
          images,
          url,
          code: response.data.code,
          message: response.data.message,
          data: taskData
        };
        
        // Actualizar en el almacenamiento local
        fluxLocalStorageService.updateTask(taskResult);
        
        return taskResult;
      } else if (response.data.status) {
        // Formato directo desde PiAPI
        // Extraer URLs de imágenes si la tarea está completa
        let images: string[] | undefined;
        let url: string | undefined;
        
        if (response.data.status === 'completed' && response.data.output) {
          if (Array.isArray(response.data.output.images)) {
            images = response.data.output.images;
          } else if (response.data.output.image) {
            url = response.data.output.image;
            images = [response.data.output.image];
          } else if (response.data.output.image_url) {
            // Nueva estructura de respuesta en el ejemplo proporcionado
            url = response.data.output.image_url;
            images = [response.data.output.image_url];
            logger.info('Imagen encontrada en output.image_url:', url);
          } else if (typeof response.data.output === 'string') {
            // Caso donde output es directamente la URL como string
            url = response.data.output;
            images = [response.data.output];
            logger.info('Imagen encontrada directamente en output como string:', url);
          }
        }
        
        const taskResult: FluxTaskResult = {
          success: true,
          taskId: response.data.task_id,
          status: response.data.status,
          images,
          url,
          data: response.data
        };
        
        // Actualizar en el almacenamiento local
        fluxLocalStorageService.updateTask(taskResult);
        
        return taskResult;
      }
      
      return {
        success: false,
        taskId,
        error: response.data.message || 'Error al verificar estado',
        code: response.data.code
      };
    } catch (error: any) {
      logger.error('Error al verificar estado de tarea Flux:', error);
      return {
        success: false,
        taskId,
        error: error.message || 'Error en la verificación de estado'
      };
    }
  },
  
  /**
   * Obtiene las tareas recientes del almacenamiento local
   * 
   * @returns Lista de tareas recientes
   */
  getRecentTasks(): FluxTaskResult[] {
    return fluxLocalStorageService.getTasks();
  },
  
  /**
   * Obtiene una tarea específica del almacenamiento local
   * 
   * @param taskId ID de la tarea a obtener
   * @returns La tarea si existe, undefined en caso contrario
   */
  getTask(taskId: string): FluxTaskResult | undefined {
    return fluxLocalStorageService.getTask(taskId);
  }
};

/**
 * Verifica si el usuario puede usar Flux directamente sin proxy
 * basado en las credenciales disponibles
 * 
 * @returns true si puede usar Flux directamente, false si debe usar el proxy
 */
export function canUseFluxDirectly(): boolean {
  // Por ahora, siempre usamos el proxy para mantener la seguridad de las claves API
  return false;
}

export default fluxService;