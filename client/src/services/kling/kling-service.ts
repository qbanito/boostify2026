/**
 * Servicio para integración con la API de Kling
 * 
 * Este servicio proporciona funciones para realizar operaciones con la API de Kling,
 * específicamente para Virtual Try-On y otras funcionalidades relacionadas con imagen.
 */

import axios from 'axios';

// Definición de tipos para las respuestas de la API
export interface TryOnResult {
  success: boolean;
  taskId?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  resultImage?: string;
  errorMessage?: string;
}

// Clase principal del servicio
class KlingService {
  /**
   * Inicia un proceso de Try-On con Kling API
   * @param modelImage Imagen de la persona (modelo)
   * @param clothingImage Imagen de la prenda de ropa
   * @returns Resultado del inicio del proceso
   */
  async startTryOn(modelImage: string, clothingImage: string): Promise<TryOnResult> {
    try {
      const response = await axios.post('/api/kling/try-on/start', {
        modelImage,
        clothingImage
      });
      
      return {
        success: response.data.success,
        taskId: response.data.taskId,
        status: response.data.status || 'pending',
        progress: response.data.progress || 0,
        errorMessage: response.data.errorMessage
      };
    } catch (error: any) {
      console.error('Error iniciando try-on:', error);
      return {
        success: false,
        status: 'failed',
        errorMessage: error.response?.data?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Verifica el estado de un proceso de Try-On
   * @param taskId ID de la tarea a verificar
   * @returns Estado actualizado del proceso
   */
  async checkTryOnStatus(taskId: string): Promise<TryOnResult> {
    try {
      const response = await axios.get(`/api/kling/try-on/status?taskId=${taskId}`);
      
      return {
        success: response.data.success,
        taskId: response.data.taskId,
        status: response.data.status,
        progress: response.data.progress || 0,
        resultImage: response.data.resultImage,
        errorMessage: response.data.errorMessage
      };
    } catch (error: any) {
      console.error('Error verificando estado de try-on:', error);
      return {
        success: false,
        taskId,
        status: 'failed',
        errorMessage: error.response?.data?.message || error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Procesa una imagen para asegurar compatibilidad con Kling API
   * @param imageDataUrl URL de datos de la imagen (data URL)
   * @returns Imagen procesada y validada
   */
  async processImage(imageDataUrl: string): Promise<any> {
    try {
      const response = await axios.post('/api/kling/process-image', {
        imageDataUrl
      });
      
      return response.data;
    } catch (error: any) {
      console.error('Error procesando imagen:', error);
      throw new Error(error.response?.data?.message || error.message || 'Error procesando imagen');
    }
  }
}

// Exportamos una instancia única para usar en toda la aplicación
export const klingService = new KlingService();