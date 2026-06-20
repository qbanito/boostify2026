import { logger } from "../../logger";
/**
 * API Client para servicios de KITS AI
 * 
 * Este servicio proporciona una interfaz para interactuar con la API de KITS AI,
 * que ofrece servicios de procesamiento de audio profesional con efectos avanzados.
 * 
 * API Docs: https://docs.kits-ai.com/reference/api-reference
 */

import { AudioEffect } from '../../types/voice-model-types';
import axios from 'axios';

/**
 * Opciones para el procesamiento de audio
 */
export interface AudioProcessingOptions {
  effects: AudioEffect[];
  mastering?: boolean;
  stereo_width?: number;
  normalize?: boolean;
  target_loudness?: number;
}

/**
 * Cliente para la API de KITS AI
 */
class KitsAIAPI {
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.kits-ai.com/v1';
  
  /**
   * Constructor
   */
  constructor() {
    // Intentar cargar la clave de API desde las variables de entorno si está disponible
    if (import.meta.env.VITE_KITS_AI_API_KEY) {
      this.apiKey = import.meta.env.VITE_KITS_AI_API_KEY;
      logger.info('KITS AI API key initialized from environment variables');
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
      logger.error('KITS AI API request error:', error);
      
      // Si es un error de Axios, extraemos el mensaje de error de la respuesta
      if (axios.isAxiosError(error) && error.response?.data) {
        throw new Error(`KITS AI API error: ${error.response.data.message || error.response.data}`);
      }
      
      throw error;
    }
  }

  /**
   * Aplica efectos profesionales de audio a un archivo
   * @param audioFile Archivo de audio a procesar
   * @param effects Lista de efectos a aplicar
   * @param options Opciones adicionales de procesamiento
   * @returns ID de la tarea de procesamiento
   */
  public async applyAudioEffects(
    audioFile: File,
    effects: AudioEffect[],
    options: {
      mastering?: boolean;
      normalize?: boolean;
      target_loudness?: number;
      stereo_width?: number;
    } = {}
  ): Promise<string> {
    const formData = new FormData();
    formData.append('audio_file', audioFile);
    
    // Convertir efectos a formato API
    const effectsData = effects.filter(e => e.enabled).map(effect => ({
      name: effect.name,
      parameters: effect.settings
    }));
    
    formData.append('effects', JSON.stringify(effectsData));
    
    // Añadir opciones adicionales si se proporcionan
    if (options.mastering !== undefined) {
      formData.append('apply_mastering', options.mastering.toString());
    }
    
    if (options.normalize !== undefined) {
      formData.append('normalize', options.normalize.toString());
    }
    
    if (options.target_loudness !== undefined) {
      formData.append('target_loudness', options.target_loudness.toString());
    }
    
    if (options.stereo_width !== undefined) {
      formData.append('stereo_width', options.stereo_width.toString());
    }
    
    try {
      const response = await this.request('/audio/process', 'POST', formData, 'multipart/form-data');
      return response.task_id;
    } catch (error) {
      logger.error('Error applying audio effects:', error);
      
      // En ambiente de desarrollo, devolver un mock ID de tarea
      if (import.meta.env.DEV) {
        return `mock-task-${Date.now()}`;
      }
      
      throw error;
    }
  }
  
  /**
   * Verifica el estado de una tarea de procesamiento de audio
   * @param taskId ID de la tarea
   * @returns Estado actual y URL del resultado (si está completado)
   */
  public async checkProcessingStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress?: number;
    resultUrl?: string;
    error?: string;
  }> {
    try {
      const response = await this.request(`/task/${taskId}`);
      
      return {
        status: response.status,
        progress: response.progress || 0,
        resultUrl: response.output_url,
        error: response.error
      };
    } catch (error) {
      logger.error('Error checking processing status:', error);
      
      // En desarrollo, simular una respuesta después de un tiempo
      if (import.meta.env.DEV && taskId.startsWith('mock-task-')) {
        return await new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              status: 'completed',
              progress: 100,
              resultUrl: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fprocessed_with_effects.mp3?alt=media&token=abcdef12-3456-7890-abcd-ef1234567890'
            });
          }, 3000);
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Obtiene la lista de efectos disponibles
   * @returns Lista de efectos disponibles con sus parámetros
   */
  public async getAvailableEffects(): Promise<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      default: number | boolean | string;
      min?: number;
      max?: number;
      options?: string[];
    }>;
  }[]> {
    try {
      const response = await this.request('/audio/effects');
      return response.effects;
    } catch (error) {
      logger.error('Error fetching available effects:', error);
      
      // En ambiente de desarrollo, devolver efectos predefinidos
      if (import.meta.env.DEV) {
        return this.getMockEffects();
      }
      
      throw error;
    }
  }
  
  /**
   * Crea una configuración de efectos profesional basada en el género musical
   * @param genre Género musical (pop, rock, electronic, etc.)
   * @param intensity Intensidad de los efectos (0-100)
   * @returns Lista de efectos configurados
   */
  public createGenrePreset(genre: string, intensity: number = 50): AudioEffect[] {
    // Normalizar intensidad entre 0 y 100
    const normalizedIntensity = Math.max(0, Math.min(100, intensity)) / 100;
    
    switch (genre.toLowerCase()) {
      case 'pop':
        return [
          {
            name: 'Compression',
            enabled: true,
            settings: {
              threshold: -24 + (6 * normalizedIntensity),
              ratio: 2 + (2 * normalizedIntensity),
              attack: 20,
              release: 200,
              makeup_gain: 3 + (3 * normalizedIntensity)
            }
          },
          {
            name: 'EQ',
            enabled: true,
            settings: {
              low_shelf_gain: 1 + (normalizedIntensity * 2),
              low_shelf_frequency: 200,
              high_shelf_gain: 2 + (normalizedIntensity * 3),
              high_shelf_frequency: 8000,
              mid_peak_gain: -1 - (normalizedIntensity * 2),
              mid_peak_frequency: 800,
              mid_peak_q: 1.2
            }
          },
          {
            name: 'Reverb',
            enabled: true,
            settings: {
              room_size: 0.2 + (normalizedIntensity * 0.1),
              damping: 0.5,
              wet_level: 0.15 + (normalizedIntensity * 0.1),
              dry_level: 0.85 - (normalizedIntensity * 0.05)
            }
          }
        ];
        
      case 'rock':
        return [
          {
            name: 'Distortion',
            enabled: true,
            settings: {
              drive: 0.2 + (normalizedIntensity * 0.3),
              tone: 0.7,
              level: 0.9
            }
          },
          {
            name: 'Compression',
            enabled: true,
            settings: {
              threshold: -30 + (5 * normalizedIntensity),
              ratio: 3 + (3 * normalizedIntensity),
              attack: 10,
              release: 150,
              makeup_gain: 5 + (5 * normalizedIntensity)
            }
          },
          {
            name: 'EQ',
            enabled: true,
            settings: {
              low_shelf_gain: 3 + (normalizedIntensity * 3),
              low_shelf_frequency: 150,
              high_shelf_gain: 2 + (normalizedIntensity * 3),
              high_shelf_frequency: 5000,
              mid_peak_gain: 2 + (normalizedIntensity * 3),
              mid_peak_frequency: 2000,
              mid_peak_q: 1.5
            }
          }
        ];
        
      case 'electronic':
        return [
          {
            name: 'Compression',
            enabled: true,
            settings: {
              threshold: -25 + (5 * normalizedIntensity),
              ratio: 4 + (4 * normalizedIntensity),
              attack: 5,
              release: 100,
              makeup_gain: 3 + (3 * normalizedIntensity)
            }
          },
          {
            name: 'EQ',
            enabled: true,
            settings: {
              low_shelf_gain: 3 + (normalizedIntensity * 3),
              low_shelf_frequency: 100,
              high_shelf_gain: 4 + (normalizedIntensity * 3),
              high_shelf_frequency: 10000,
              mid_peak_gain: -2 - (normalizedIntensity * 2),
              mid_peak_frequency: 400,
              mid_peak_q: 2.0
            }
          },
          {
            name: 'Delay',
            enabled: true,
            settings: {
              time: 0.125,
              feedback: 0.3 + (normalizedIntensity * 0.2),
              wet_level: 0.2 + (normalizedIntensity * 0.3),
              dry_level: 0.8 - (normalizedIntensity * 0.1)
            }
          },
          {
            name: 'Phaser',
            enabled: true,
            settings: {
              rate: 0.5 + (normalizedIntensity * 1.5),
              depth: 0.7 + (normalizedIntensity * 0.3),
              feedback: 0.5 + (normalizedIntensity * 0.4),
              stereo_phase: 180
            }
          }
        ];
        
      case 'jazz':
        return [
          {
            name: 'Compression',
            enabled: true,
            settings: {
              threshold: -20 + (5 * normalizedIntensity),
              ratio: 2 + (normalizedIntensity),
              attack: 30,
              release: 300,
              makeup_gain: 2 + (2 * normalizedIntensity)
            }
          },
          {
            name: 'EQ',
            enabled: true,
            settings: {
              low_shelf_gain: 1 + (normalizedIntensity),
              low_shelf_frequency: 250,
              high_shelf_gain: 1 + (normalizedIntensity),
              high_shelf_frequency: 5000,
              mid_peak_gain: 1 + (normalizedIntensity),
              mid_peak_frequency: 1000,
              mid_peak_q: 1.0
            }
          },
          {
            name: 'Reverb',
            enabled: true,
            settings: {
              room_size: 0.4 + (normalizedIntensity * 0.3),
              damping: 0.4,
              wet_level: 0.25 + (normalizedIntensity * 0.2),
              dry_level: 0.75 - (normalizedIntensity * 0.1)
            }
          }
        ];
        
      // Configuración genérica para otros géneros no especificados
      default:
        return [
          {
            name: 'Compression',
            enabled: true,
            settings: {
              threshold: -24 + (4 * normalizedIntensity),
              ratio: 2.5 + (normalizedIntensity * 1.5),
              attack: 15,
              release: 250,
              makeup_gain: 3 + (normalizedIntensity * 2)
            }
          },
          {
            name: 'EQ',
            enabled: true,
            settings: {
              low_shelf_gain: 2 + (normalizedIntensity * 2),
              low_shelf_frequency: 200,
              high_shelf_gain: 2 + (normalizedIntensity * 2),
              high_shelf_frequency: 7000,
              mid_peak_gain: 0,
              mid_peak_frequency: 1500,
              mid_peak_q: 1.0
            }
          },
          {
            name: 'Reverb',
            enabled: true,
            settings: {
              room_size: 0.3 + (normalizedIntensity * 0.2),
              damping: 0.5,
              wet_level: 0.2 + (normalizedIntensity * 0.2),
              dry_level: 0.8 - (normalizedIntensity * 0.1)
            }
          }
        ];
    }
  }
  
  /**
   * Devuelve lista de efectos simulada para desarrollo
   * @returns Lista de efectos disponibles simulada
   */
  private getMockEffects(): Array<{
    name: string;
    description: string;
    parameters: Array<{
      name: string;
      type: string;
      default: number | boolean | string;
      min?: number;
      max?: number;
      options?: string[];
    }>;
  }> {
    return [
      {
        name: 'Compression',
        description: 'Dynamic range compression to even out volume levels',
        parameters: [
          {
            name: 'threshold',
            type: 'number',
            default: -24,
            min: -60,
            max: 0
          },
          {
            name: 'ratio',
            type: 'number',
            default: 2.5,
            min: 1,
            max: 20
          },
          {
            name: 'attack',
            type: 'number',
            default: 15,
            min: 0.1,
            max: 100
          },
          {
            name: 'release',
            type: 'number',
            default: 250,
            min: 10,
            max: 1000
          },
          {
            name: 'makeup_gain',
            type: 'number',
            default: 3,
            min: 0,
            max: 20
          }
        ]
      },
      {
        name: 'EQ',
        description: 'Equalizer to shape frequency response',
        parameters: [
          {
            name: 'low_shelf_gain',
            type: 'number',
            default: 2,
            min: -12,
            max: 12
          },
          {
            name: 'low_shelf_frequency',
            type: 'number',
            default: 200,
            min: 20,
            max: 1000
          },
          {
            name: 'high_shelf_gain',
            type: 'number',
            default: 2,
            min: -12,
            max: 12
          },
          {
            name: 'high_shelf_frequency',
            type: 'number',
            default: 7000,
            min: 2000,
            max: 20000
          },
          {
            name: 'mid_peak_gain',
            type: 'number',
            default: 0,
            min: -12,
            max: 12
          },
          {
            name: 'mid_peak_frequency',
            type: 'number',
            default: 1500,
            min: 200,
            max: 5000
          },
          {
            name: 'mid_peak_q',
            type: 'number',
            default: 1.0,
            min: 0.1,
            max: 10
          }
        ]
      },
      {
        name: 'Reverb',
        description: 'Simulates acoustic space ambience',
        parameters: [
          {
            name: 'room_size',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            name: 'damping',
            type: 'number',
            default: 0.5,
            min: 0,
            max: 1
          },
          {
            name: 'wet_level',
            type: 'number',
            default: 0.2,
            min: 0,
            max: 1
          },
          {
            name: 'dry_level',
            type: 'number',
            default: 0.8,
            min: 0,
            max: 1
          }
        ]
      },
      {
        name: 'Delay',
        description: 'Creates echo effects',
        parameters: [
          {
            name: 'time',
            type: 'number',
            default: 0.125,
            min: 0.01,
            max: 2
          },
          {
            name: 'feedback',
            type: 'number',
            default: 0.4,
            min: 0,
            max: 0.99
          },
          {
            name: 'wet_level',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            name: 'dry_level',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1
          }
        ]
      },
      {
        name: 'Distortion',
        description: 'Adds harmonic distortion to the signal',
        parameters: [
          {
            name: 'drive',
            type: 'number',
            default: 0.3,
            min: 0,
            max: 1
          },
          {
            name: 'tone',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1
          },
          {
            name: 'level',
            type: 'number',
            default: 0.9,
            min: 0,
            max: 1
          }
        ]
      },
      {
        name: 'Phaser',
        description: 'Creates sweeping filter effects',
        parameters: [
          {
            name: 'rate',
            type: 'number',
            default: 1.0,
            min: 0.1,
            max: 10
          },
          {
            name: 'depth',
            type: 'number',
            default: 0.7,
            min: 0,
            max: 1
          },
          {
            name: 'feedback',
            type: 'number',
            default: 0.6,
            min: 0,
            max: 0.99
          },
          {
            name: 'stereo_phase',
            type: 'number',
            default: 180,
            min: 0,
            max: 360
          }
        ]
      },
      {
        name: 'AutoTune',
        description: 'Corrects pitch to nearest notes',
        parameters: [
          {
            name: 'key',
            type: 'string',
            default: 'C',
            options: ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
          },
          {
            name: 'scale',
            type: 'string',
            default: 'major',
            options: ['major', 'minor', 'chromatic']
          },
          {
            name: 'strength',
            type: 'number',
            default: 0.5,
            min: 0,
            max: 1
          },
          {
            name: 'speed',
            type: 'number',
            default: 0.5,
            min: 0.1,
            max: 1
          }
        ]
      }
    ];
  }
}

// Exportar una instancia única
export const kitsAIAPI = new KitsAIAPI();