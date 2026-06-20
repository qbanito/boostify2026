import { logger } from "../../logger";
/**
 * API Client para servicios de Revocalize
 * 
 * Este servicio proporciona una interfaz para interactuar con la API de Revocalize,
 * que ofrece servicios de clonación de voz y modelos pre-entrenados.
 * 
 * API Docs: https://docs.revocalize.ai/reference/api-reference
 */

import { VoiceModel, AudioEffect, VoiceConversionResponse } from '../../types/voice-model-types';
import axios from 'axios';

/**
 * Opciones para la conversión de audio
 */
interface ConversionOptions {
  transpose?: number;
  effects?: AudioEffect[];
  generations_count?: number;
}

/**
 * Cliente para la API de Revocalize
 */
class RevocalizeAPI {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.revocalize.ai/v1';
  
  /**
   * Constructor
   */
  constructor() {
    // Intentar cargar la clave de API desde las variables de entorno si está disponible
    if (import.meta.env.VITE_REVOCALIZE_API_KEY) {
      this.apiKey = import.meta.env.VITE_REVOCALIZE_API_KEY;
      logger.info('Revocalize API key initialized from environment variables');
    }
  }
  
  /**
   * Establece la clave de API
   * @param apiKey Clave de API
   */
  public setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
  
  /**
   * Verifica si la clave de API está configurada
   * @returns true si la clave está configurada
   */
  public isApiKeyConfigured(): boolean {
    return !!this.apiKey;
  }
  
  /**
   * Obtiene el encabezado de autorización
   * @returns Objeto con el encabezado de autorización
   */
  private getAuthHeader() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Obtiene el encabezado para upload de archivos
   * @returns Objeto con el encabezado de autorización y tipo de contenido
   */
  private getFileUploadHeader() {
    return {
      'Authorization': `Bearer ${this.apiKey}`,
      'Content-Type': 'multipart/form-data'
    };
  }
  
  /**
   * Realiza una solicitud a la API
   * @param endpoint Endpoint de la API
   * @param method Método HTTP
   * @param data Datos a enviar (opcional)
   * @param contentType Tipo de contenido (opcional, por defecto 'application/json')
   * @returns Respuesta de la API
   */
  private async request(
    endpoint: string, 
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any,
    contentType: 'application/json' | 'multipart/form-data' = 'application/json'
  ): Promise<any> {
    if (!this.apiKey) {
      throw new Error('API key is required');
    }
    
    try {
      const headers = contentType === 'multipart/form-data' 
        ? this.getFileUploadHeader() 
        : this.getAuthHeader();
      
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers,
        data: data || undefined
      });
      
      return response.data;
    } catch (error) {
      logger.error('Revocalize API request error:', error);
      
      // Si es un error de Axios, extraemos el mensaje de error de la respuesta
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(`Revocalize API error: ${error.response.data.message || error.response.data}`);
      }
      
      throw error;
    }
  }
  
  /**
   * Obtiene todos los modelos disponibles
   * @returns Lista de modelos
   */
  public async getAvailableModels(): Promise<VoiceModel[]> {
    try {
      const response = await this.request('/voice-models');
      
      // Transformar respuesta de la API al formato interno
      return response.models.map((model: any) => ({
        id: model.id,
        name: model.name,
        description: model.description || 'Pre-trained model',
        type: model.type || 'inference',
        gender: model.gender || 'neutral',
        language: model.language || 'en-US',
        tags: model.tags || [],
        samples: model.samples || [],
        isCustom: false,
        isReady: true
      }));
    } catch (error) {
      // Si estamos en desarrollo y no hay clave de API, devolver datos de ejemplo
      if ((error as Error).message.includes('API key') && process.env.NODE_ENV === 'development') {
        logger.info('Using mock models data for development');
        return this.getMockModels();
      }
      
      throw error;
    }
  }
  
  /**
   * Crea un modelo de voz personalizado
   * @param name Nombre del modelo
   * @param samples Archivos de audio para entrenar el modelo
   * @param options Opciones adicionales
   * @returns ID del modelo creado
   */
  public async createVoiceModel(
    name: string, 
    samples: File[],
    options: {
      enhanceFidelity?: boolean;
      reduceNoise?: boolean;
      description?: string;
    } = {}
  ): Promise<string> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', options.description || `Custom voice model for ${name}`);
    
    // Añadir opciones
    if (options.enhanceFidelity !== undefined) {
      formData.append('enhance_fidelity', options.enhanceFidelity.toString());
    }
    
    if (options.reduceNoise !== undefined) {
      formData.append('reduce_noise', options.reduceNoise.toString());
    }
    
    // Añadir archivos de audio
    samples.forEach((file, index) => {
      formData.append(`sample_${index}`, file);
    });
    
    const response = await this.request('/voice-models/create', 'POST', formData, 'multipart/form-data');
    return response.model_id;
  }
  
  /**
   * Verifica el estado del entrenamiento de un modelo
   * @param modelId ID del modelo
   * @returns Estado del entrenamiento
   */
  public async checkTrainingStatus(modelId: string): Promise<{
    status: 'pending' | 'training' | 'completed' | 'failed';
    progress?: number;
    error?: string;
  }> {
    const response = await this.request(`/voice-models/${modelId}/status`);
    
    return {
      status: response.status,
      progress: response.progress,
      error: response.error
    };
  }
  
  /**
   * Convierte un archivo de audio usando un modelo de voz
   * @param audioFile Archivo de audio a convertir
   * @param modelId ID del modelo de voz
   * @param options Opciones de conversión
   * @returns ID de la tarea de conversión
   */
  public async convertAudio(
    audioFile: File,
    modelId: string,
    options: ConversionOptions = {}
  ): Promise<string> {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    formData.append('model', modelId);
    
    // Añadir opciones
    if (options.transpose !== undefined) {
      formData.append('transpose', options.transpose.toString());
    }
    
    if (options.generations_count !== undefined) {
      formData.append('generations_count', options.generations_count.toString());
    }
    
    // Efectos de audio (si se proporcionan)
    if (options.effects && options.effects.length > 0) {
      formData.append('effects', JSON.stringify(options.effects));
    }
    
    const response = await this.request('/convert', 'POST', formData, 'multipart/form-data') as VoiceConversionResponse;
    // Retornamos solo el taskId para mantener retrocompatibilidad
    return response.taskId;
  }
  
  /**
   * Verifica el estado de una tarea de conversión de voz
   * @param taskId ID de la tarea
   * @returns Estado de la tarea y URLs de los archivos generados (si está completa)
   */
  public async checkConversionStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    result?: { url: string };
    error?: string;
  }> {
    try {
      const response = await this.request(`/task/${taskId}`);
      
      return {
        status: response.status,
        progress: response.progress || 0,
        result: response.outputUrl ? { url: response.outputUrl } : undefined,
        error: response.error
      };
    } catch (error) {
      logger.error('Error checking conversion status:', error);
      
      // En desarrollo, simular una respuesta después de un tiempo
      if (process.env.NODE_ENV === 'development') {
        return await new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 'completed',
              progress: 100,
              result: {
                url: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fmastered_audio_sample.mp3?alt=media&token=93a82642-59e3-406c-a7b6-8d4cc3b5c6a8'
              }
            });
          }, 2000);
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Obtiene modelos simulados para desarrollo
   * @returns Lista de modelos de ejemplo
   */
  private getMockModels(): VoiceModel[] {
    return [
      {
        id: '1',
        name: 'Male Smooth Pop',
        description: 'A smooth male voice perfect for pop music',
        type: 'inference',
        gender: 'male',
        language: 'en-US',
        tags: ['pop', 'smooth', 'male'],
        samples: ['https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fsample-male-pop.mp3?alt=media&token=12345'],
        isCustom: false,
        isReady: true
      },
      {
        id: '2',
        name: 'Female Warm Pop',
        description: 'A warm female voice for contemporary pop music',
        type: 'inference',
        gender: 'female',
        language: 'en-US',
        tags: ['pop', 'warm', 'female', 'contemporary'],
        samples: ['https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fsample-female-pop.mp3?alt=media&token=67890'],
        isCustom: false,
        isReady: true
      },
      {
        id: '3',
        name: 'Female LoFi',
        description: 'Relaxed female voice with lofi characteristics',
        type: 'inference',
        gender: 'female',
        language: 'en-US',
        tags: ['lofi', 'relaxed', 'female', 'chill'],
        samples: ['https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fsample-female-lofi.mp3?alt=media&token=24680'],
        isCustom: false,
        isReady: true
      },
      {
        id: '4',
        name: 'Male Gritty Rock',
        description: 'Powerful male voice with gritty rock texture',
        type: 'inference',
        gender: 'male',
        language: 'en-US',
        tags: ['rock', 'gritty', 'male', 'powerful'],
        samples: ['https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fsample-male-rock.mp3?alt=media&token=13579'],
        isCustom: false,
        isReady: true
      },
      {
        id: '5',
        name: 'Custom Voice (Demo)',
        description: 'Demo of a custom trained voice model',
        type: 'custom',
        gender: 'male',
        language: 'en-US',
        tags: ['custom', 'demo'],
        samples: ['https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fsample-custom.mp3?alt=media&token=97531'],
        isCustom: true,
        isReady: true
      }
    ];
  }
}

// Exportar una instancia única
export const revocalizeAPI = new RevocalizeAPI();