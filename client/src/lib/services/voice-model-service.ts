import { logger } from "../logger";
/**
 * Servicio para gestionar modelos de voz
 * 
 * Proporciona funcionalidades para:
 * - Listar modelos de voz disponibles
 * - Crear modelos personalizados
 * - Convertir audio con modelos
 * - Gestionar historial de conversiones
 */

import { 
  VoiceModel, 
  AudioEffect, 
  TrainingStatus, 
  VoiceConversionRecord,
  VoiceConversionResponse,
  VoiceConversionRequest 
} from '../types/voice-model-types';
import { voiceProcessingService } from './voice-processing-service';
import { revocalizeAPI } from './api/revocalize-api';
import { kitsAIAPI } from './api/kits-ai-api';
import { toast } from '../../hooks/use-toast';

class VoiceModelService {
  constructor() {
    logger.info('Voice Model Service initialized with synchronized API integration');
  }
  
  /**
   * Verifica si al menos una de las APIs tiene clave configurada
   * @returns true si al menos una API está configurada
   */
  public isApiKeyConfigured(): boolean {
    return revocalizeAPI.isApiKeyConfigured() || kitsAIAPI.isApiKeyConfigured();
  }

  /**
   * Verifica el estado de configuración de las APIs
   * @returns Estado de las claves API
   */
  public async checkApiKeysStatus(): Promise<{
    revocalize: boolean;
    kits: boolean;
    both: boolean;
  }> {
    const revocalizeStatus = revocalizeAPI.isApiKeyConfigured();
    const kitsStatus = kitsAIAPI.isApiKeyConfigured();
    
    return {
      revocalize: revocalizeStatus,
      kits: kitsStatus,
      both: revocalizeStatus && kitsStatus
    };
  }

  /**
   * Obtiene modelos de voz disponibles
   * @returns Lista de modelos de voz
   */
  public async getAvailableModels(): Promise<VoiceModel[]> {
    try {
      return await revocalizeAPI.getAvailableModels();
    } catch (error) {
      logger.error('Error fetching voice models:', error);
      toast({
        title: 'Error al obtener modelos',
        description: 'No se pudieron cargar los modelos de voz disponibles.',
        variant: 'destructive'
      });
      return [];
    }
  }

  /**
   * Crea un modelo de voz personalizado
   * @param name Nombre del modelo
   * @param samples Archivos de audio para entrenar el modelo
   * @param options Opciones de creación
   * @returns ID del modelo creado
   */
  public async createCustomModel(
    name: string,
    samples: File[],
    options: {
      enhanceFidelity?: boolean;
      reduceNoise?: boolean;
      description?: string;
    } = {}
  ): Promise<string> {
    try {
      return await revocalizeAPI.createVoiceModel(name, samples, options);
    } catch (error) {
      logger.error('Error creating custom voice model:', error);
      toast({
        title: 'Error al crear modelo',
        description: 'No se pudo crear el modelo de voz personalizado.',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Verifica el estado de entrenamiento de un modelo
   * @param modelId ID del modelo
   * @returns Estado del entrenamiento
   */
  public async checkTrainingStatus(modelId: string): Promise<TrainingStatus> {
    try {
      const status = await revocalizeAPI.checkTrainingStatus(modelId);
      return {
        status: status.status,
        model_id: modelId,
        current_epoch: status.progress,
        error: status.error
      };
    } catch (error) {
      logger.error('Error checking training status:', error);
      return {
        status: 'failed',
        model_id: modelId,
        error: 'No se pudo verificar el estado del entrenamiento.'
      };
    }
  }

  /**
   * Convierte un archivo de audio usando un modelo de voz
   * @param audioFile Archivo de audio a convertir
   * @param modelId ID del modelo a utilizar
   * @param options Opciones adicionales
   * @param userId ID del usuario
   * @returns ID de la tarea de conversión
   */
  public async convertAudio(
    audioFile: File,
    modelId: string,
    options: {
      transpose?: number;
      effects?: AudioEffect[];
    } = {},
    userId: string
  ): Promise<VoiceConversionResponse> {
    try {
      const effects = options.effects || [];
      const result = await voiceProcessingService.processVoiceWithEffects(
        audioFile,
        modelId,
        effects,
        userId
      );
      
      // Extraer el taskId del resultado (que es un objeto VoiceConversionRecord)
      return {
        taskId: result.taskId || result.task_id || '',
        recordId: result.id || ''  // Usamos el ID del documento como recordId
      };
    } catch (error) {
      logger.error('Error converting audio:', error);
      toast({
        title: 'Error en conversión',
        description: 'No se pudo iniciar la conversión de voz.',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Verifica el estado de una conversión
   * @param taskId ID de la tarea
   * @returns Estado actual de la tarea
   */
  public async checkConversionStatus(taskId: string): Promise<{
    status: 'in_progress' | 'completed' | 'failed';
    progress?: number;
    result?: { url: string };
    error?: string;
  }> {
    return await voiceProcessingService.checkConversionStatus(taskId);
  }

  /**
   * Obtiene el historial de conversiones de un usuario
   * @param userId ID del usuario
   * @returns Lista de conversiones realizadas
   */
  public async getUserVoiceConversions(userId: string): Promise<VoiceConversionRecord[]> {
    return await voiceProcessingService.getUserConversions(userId);
  }

  /**
   * Obtiene un preset de efectos para un género musical
   * @param genre Género musical
   * @param intensity Intensidad de los efectos (0-100)
   * @returns Lista de efectos configurados
   */
  public getGenreEffectsPreset(genre: string, intensity: number = 50): AudioEffect[] {
    return kitsAIAPI.createGenrePreset(genre, intensity);
  }

  /**
   * Obtiene la lista de efectos de audio disponibles
   * @returns Lista de efectos con sus parámetros
   */
  public async getAvailableEffects(): Promise<any[]> {
    try {
      return await kitsAIAPI.getAvailableEffects();
    } catch (error) {
      logger.error('Error fetching audio effects:', error);
      toast({
        title: 'Error al obtener efectos',
        description: 'No se pudieron cargar los efectos de audio disponibles.',
        variant: 'destructive'
      });
      return [];
    }
  }
}

export const voiceModelService = new VoiceModelService();