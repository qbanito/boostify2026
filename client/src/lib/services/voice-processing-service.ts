import { logger } from "../logger";
/**
 * Servicio de procesamiento de voz que integra Revocalize y KITS AI
 * 
 * Este servicio proporciona una capa de abstracción sobre las APIs de Revocalize y KITS,
 * permitiendo un flujo de trabajo sincronizado para:
 * 1. Clonación de voz con Revocalize
 * 2. Aplicación de efectos profesionales con KITS AI
 * 3. Gestión unificada de modelos y conversiones
 */

import { revocalizeAPI } from './api/revocalize-api';
import { kitsAIAPI, AudioProcessingOptions } from './api/kits-ai-api';
import { toast } from '../../hooks/use-toast';
import { VoiceModel, AudioEffect, VoiceConversionRecord } from '../types/voice-model-types';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirestore, collection, addDoc, updateDoc, doc, serverTimestamp, query, where, getDocs, orderBy } from 'firebase/firestore';

class VoiceProcessingService {
  constructor() {
    logger.info('Voice Processing Service initialized with synchronized Revocalize and KITS integration');
  }

  /**
   * Verifica si las APIs están configuradas correctamente
   * @returns boolean indicando si ambas APIs están inicializadas
   */
  public isApiKeyConfigured(): boolean {
    return revocalizeAPI.isApiKeyConfigured() && kitsAIAPI.isApiKeyConfigured();
  }

  /**
   * Configura las claves de API para ambos servicios
   * @param revocalizeKey Clave de API para Revocalize
   * @param kitsKey Clave de API para KITS
   */
  public setApiKeys(revocalizeKey: string, kitsKey: string): void {
    revocalizeAPI.setApiKey(revocalizeKey);
    kitsAIAPI.setApiKey(kitsKey);
    
    toast({
      title: 'APIs configuradas',
      description: 'Las claves de API han sido configuradas correctamente para ambos servicios.'
    });
  }

  /**
   * Obtiene todos los modelos de voz disponibles
   * @returns Lista de modelos de voz
   */
  public async getAvailableModels(): Promise<VoiceModel[]> {
    try {
      return await revocalizeAPI.getAvailableModels();
    } catch (error) {
      logger.error('Error fetching voice models:', error);
      toast({
        title: 'Error al obtener modelos',
        description: 'No se pudieron cargar los modelos de voz.',
        variant: 'destructive'
      });
      return [];
    }
  }

  /**
   * Crea un modelo de voz personalizado
   * @param name Nombre del modelo
   * @param samples Muestras de audio para entrenar el modelo
   * @param options Opciones para la creación del modelo
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
    try {
      // Crear modelo con Revocalize
      const modelId = await revocalizeAPI.createVoiceModel(name, samples, options);
      
      toast({
        title: 'Modelo creado',
        description: `El modelo "${name}" ha sido creado exitosamente.`
      });
      
      return modelId;
    } catch (error) {
      logger.error('Error creating voice model:', error);
      toast({
        title: 'Error al crear modelo',
        description: 'No se pudo crear el modelo de voz.',
        variant: 'destructive'
      });
      throw error;
    }
  }

  /**
   * Proceso unificado de conversión de voz con efectos
   * @param audioFile Archivo de audio a convertir
   * @param modelId ID del modelo de voz a utilizar
   * @param effects Efectos a aplicar al audio
   * @param userId ID del usuario
   * @returns Registro de la conversión
   */
  public async processVoiceWithEffects(
    audioFile: File,
    modelId: string,
    effects: AudioEffect[] = [],
    userId: string
  ): Promise<VoiceConversionRecord> {
    try {
      // Subir archivo original al almacenamiento
      const storage = getStorage();
      const db = getFirestore();
      
      // Crear un registro en Firebase para el seguimiento
      const conversionRecord: Omit<VoiceConversionRecord, 'id'> = {
        taskId: `task-${Date.now()}`,
        userId,
        model: modelId,
        status: 'in_progress',
        inputUrl: '',  // Se actualizará después de subir el archivo
        effects: effects.filter(e => e.enabled),
        // Para compatibilidad con versiones anteriores
        task_id: `task-${Date.now()}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };
      
      const docRef = await addDoc(collection(db, 'voice_conversions'), conversionRecord);
      
      // Subir archivo original
      const originalFileRef = ref(storage, `voice_conversions/${userId}/original_${Date.now()}_${audioFile.name}`);
      await uploadBytes(originalFileRef, audioFile);
      const originalUrl = await getDownloadURL(originalFileRef);
      
      // Actualizar registro con URL del audio original
      await updateDoc(doc(db, 'voice_conversions', docRef.id), {
        inputUrl: originalUrl
      });
      
      // Primer paso: Convertir con Revocalize
      const revocalizeTaksId = await revocalizeAPI.convertAudio(
        audioFile,
        modelId,
        { effects: [] } // No aplicar efectos en esta etapa
      );
      
      // Actualizar ID de tarea en Firestore
      await updateDoc(doc(db, 'voice_conversions', docRef.id), {
        task_id: revocalizeTaksId
      });
      
      // Iniciar proceso de polling para verificar estado y aplicar efectos cuando termine
      this.pollAndProcessWithEffects(revocalizeTaksId, effects, docRef.id, userId);
      
      return {
        id: docRef.id,
        taskId: revocalizeTaksId,
        userId,
        model: modelId,
        status: 'in_progress',
        inputUrl: originalUrl,
        effects: effects.filter(e => e.enabled),
        // Para compatibilidad con versiones anteriores
        task_id: revocalizeTaksId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } catch (error) {
      logger.error('Error in voice processing:', error);
      toast({
        title: 'Error en procesamiento',
        description: 'No se pudo completar el procesamiento de voz.',
        variant: 'destructive'
      });
      throw error;
    }
  }
  
  /**
   * Monitorea el estado de la conversión inicial y aplica efectos cuando termine
   * @param taskId ID de la tarea de Revocalize
   * @param effects Efectos a aplicar con KITS
   * @param docId ID del documento en Firestore
   * @param userId ID del usuario
   */
  private async pollAndProcessWithEffects(
    taskId: string,
    effects: AudioEffect[],
    docId: string,
    userId: string
  ): Promise<void> {
    const db = getFirestore();
    const storage = getStorage();
    
    try {
      // Verificar estado de conversión con Revocalize
      const status = await revocalizeAPI.checkConversionStatus(taskId);
      
      // Actualizar estado en Firestore
      await updateDoc(doc(db, 'voice_conversions', docId), {
        status: status.status === 'completed' ? 'completed' : 'in_progress',
        updatedAt: serverTimestamp()
      });
      
      // Si no está completo, seguir verificando
      if (status.status !== 'completed') {
        setTimeout(() => {
          this.pollAndProcessWithEffects(taskId, effects, docId, userId);
        }, 2000);
        return;
      }
      
      // Si hay efectos habilitados, procesar con KITS
      const enabledEffects = effects.filter(e => e.enabled);
      if (enabledEffects.length > 0 && status.result?.url) {
        // Descargar el archivo convertido
        const response = await fetch(status.result.url);
        const blob = await response.blob();
        const convertedFile = new File([blob], `revocalize_output_${Date.now()}.wav`, {
          type: 'audio/wav'
        });
        
        // Aplicar efectos con KITS
        const kitsTaskId = await kitsAIAPI.applyAudioEffects(convertedFile, enabledEffects);
        
        // Actualizar en Firestore
        await updateDoc(doc(db, 'voice_conversions', docId), {
          status: 'in_progress',
          task_id: kitsTaskId,
          updatedAt: serverTimestamp()
        });
        
        // Monitorear estado de procesamiento de efectos
        this.pollKitsProcessingStatus(kitsTaskId, docId, status.result.url);
      } else if (status.result?.url) {
        // No hay efectos, terminar con el resultado de Revocalize
        await updateDoc(doc(db, 'voice_conversions', docId), {
          status: 'completed',
          outputUrl: status.result.url,
          updatedAt: serverTimestamp()
        });
        
        toast({
          title: 'Procesamiento completado',
          description: 'La conversión de voz se ha completado con éxito.'
        });
      }
    } catch (error) {
      logger.error('Error polling conversion status:', error);
      
      // Actualizar estado de error en Firestore
      await updateDoc(doc(db, 'voice_conversions', docId), {
        status: 'failed',
        updatedAt: serverTimestamp()
      });
      
      toast({
        title: 'Error en procesamiento',
        description: 'No se pudo completar el procesamiento de voz.',
        variant: 'destructive'
      });
    }
  }
  
  /**
   * Monitorea el estado del procesamiento de efectos con KITS
   * @param taskId ID de la tarea de KITS
   * @param docId ID del documento en Firestore
   * @param originalOutputUrl URL del audio convertido original
   */
  private async pollKitsProcessingStatus(
    taskId: string,
    docId: string,
    originalOutputUrl: string
  ): Promise<void> {
    const db = getFirestore();
    
    try {
      // Verificar estado de procesamiento con KITS
      const status = await kitsAIAPI.checkProcessingStatus(taskId);
      
      // Si no está completo, seguir verificando
      if (status.status !== 'completed') {
        setTimeout(() => {
          this.pollKitsProcessingStatus(taskId, docId, originalOutputUrl);
        }, 2000);
        return;
      }
      
      // Si está completo y hay una URL de resultado, actualizar Firestore
      if (status.resultUrl) {
        await updateDoc(doc(db, 'voice_conversions', docId), {
          status: 'completed',
          outputUrl: status.resultUrl, // Usamos la versión con efectos
          updatedAt: serverTimestamp()
        });
        
        toast({
          title: 'Procesamiento completado',
          description: 'La conversión de voz con efectos se ha completado con éxito.'
        });
      } else {
        // No hay URL de resultado, pero está completo, usar la URL original
        await updateDoc(doc(db, 'voice_conversions', docId), {
          status: 'completed',
          outputUrl: originalOutputUrl,
          updatedAt: serverTimestamp()
        });
        
        toast({
          title: 'Procesamiento completado',
          description: 'La conversión de voz se ha completado, pero no se pudieron aplicar algunos efectos.'
        });
      }
    } catch (error) {
      logger.error('Error polling KITS processing status:', error);
      
      // Actualizar estado de error en Firestore, pero mantener la URL original
      await updateDoc(doc(db, 'voice_conversions', docId), {
        status: 'completed',
        outputUrl: originalOutputUrl,
        updatedAt: serverTimestamp()
      });
      
      toast({
        title: 'Error en efectos',
        description: 'La conversión de voz se completó, pero hubo un error al aplicar los efectos.',
        variant: 'destructive'
      });
    }
  }

  /**
   * Verifica el estado de una tarea de conversión
   * @param taskId ID de la tarea
   * @returns Estado actual de la tarea
   */
  public async checkConversionStatus(taskId: string): Promise<{
    status: 'in_progress' | 'completed' | 'failed';
    progress?: number;
    result?: { url: string };
    error?: string;
  }> {
    try {
      // Intentar primero con Revocalize
      try {
        const revocalizeStatus = await revocalizeAPI.checkConversionStatus(taskId);
        return {
          // Mapear los estados de Revocalize a nuestros estados internos
          status: revocalizeStatus.status === 'processing' || revocalizeStatus.status === 'pending' 
                  ? 'in_progress' 
                  : revocalizeStatus.status,
          progress: revocalizeStatus.progress,
          result: revocalizeStatus.result,
          error: revocalizeStatus.error
        };
      } catch (error) {
        // Si falla, puede ser una tarea de KITS
        const kitsStatus = await kitsAIAPI.checkProcessingStatus(taskId);
        return {
          // Mapear los estados de KITS a nuestros estados internos
          status: kitsStatus.status === 'processing' || kitsStatus.status === 'pending' 
                  ? 'in_progress' 
                  : kitsStatus.status,
          progress: kitsStatus.progress,
          result: kitsStatus.resultUrl ? { url: kitsStatus.resultUrl } : undefined,
          error: kitsStatus.error
        };
      }
    } catch (error) {
      logger.error('Error checking conversion status:', error);
      return {
        status: 'failed',
        error: 'No se pudo verificar el estado de la tarea.'
      };
    }
  }
  
  /**
   * Obtiene las conversiones de voz del usuario
   * @param userId ID del usuario
   * @returns Lista de conversiones
   */
  public async getUserConversions(userId: string): Promise<VoiceConversionRecord[]> {
    try {
      const db = getFirestore();
      
      // Consultar conversiones en Firestore
      const querySnapshot = await getDocs(
        query(
          collection(db, 'voice_conversions'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc')
        )
      );
      
      // Mapear resultados
      const conversions: VoiceConversionRecord[] = [];
      querySnapshot.forEach(doc => {
        const data = doc.data();
        conversions.push({
          id: doc.id,
          taskId: data.taskId || data.task_id, // Soporte para ambos formatos
          userId: data.userId,
          model: data.model,
          modelName: data.modelName,
          status: data.status,
          inputUrl: data.inputUrl || data.input_audio_url, // Compatibilidad con registros antiguos
          outputUrl: data.outputUrl || (data.output_audio_urls && data.output_audio_urls.length > 0 ? data.output_audio_urls[0] : undefined),
          effects: data.effects,
          transpose: data.transpose,
          // Para compatibilidad con versiones anteriores
          task_id: data.taskId || data.task_id,
          createdAt: data.createdAt ? new Date(data.createdAt.toDate()) : new Date(),
          updatedAt: data.updatedAt ? new Date(data.updatedAt.toDate()) : new Date()
        });
      });
      
      return conversions;
    } catch (error) {
      logger.error('Error fetching user conversions:', error);
      
      // En modo desarrollo, devolver datos de ejemplo
      if (import.meta.env.DEV) {
        logger.info('Development environment detected - using mock voice conversion data');
        return [
          {
            id: 'conv-001',
            taskId: 'task-001',
            userId,
            model: '2',
            modelName: 'Female Warm Pop',
            status: 'completed',
            inputUrl: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Foriginal_voice_sample.mp3?alt=media&token=12345678-abcd-efgh-ijkl-mnopqrstuvwx',
            outputUrl: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fmastered_audio_sample.mp3?alt=media&token=93a82642-59e3-406c-a7b6-8d4cc3b5c6a8',
            // Para compatibilidad con versiones anteriores
            task_id: 'task-001',
            createdAt: new Date('2025-03-04T15:13:52.445Z'),
            updatedAt: new Date('2025-03-04T15:18:52.445Z')
          },
          {
            id: 'conv-002',
            taskId: 'task-002',
            userId,
            model: '4',
            modelName: 'Male Gritty Rock',
            status: 'completed',
            inputUrl: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Foriginal_voice_sample.mp3?alt=media&token=12345678-abcd-efgh-ijkl-mnopqrstuvwx',
            outputUrl: 'https://firebasestorage.googleapis.com/v0/b/artist-boost.appspot.com/o/demoFiles%2Fmastered_audio_sample.mp3?alt=media&token=93a82642-59e3-406c-a7b6-8d4cc3b5c6a8',
            // Para compatibilidad con versiones anteriores
            task_id: 'task-002',
            createdAt: new Date('2025-03-04T16:13:52.445Z'),
            updatedAt: new Date('2025-03-04T16:18:52.445Z')
          }
        ];
      }
      
      return [];
    }
  }
}

export const voiceProcessingService = new VoiceProcessingService();