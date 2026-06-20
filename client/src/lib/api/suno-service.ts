import { z } from "zod";
import { logger } from "../logger";
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, limit, getDocs, serverTimestamp } from 'firebase/firestore';
import { env } from '../../env';
import { generateMusicWithSuno, checkMusicGenerationStatus } from './piapi-music';

/**
 * AVISO: Este servicio ahora funciona exclusivamente a través de PiAPI
 * Todo el funcionamiento de generación de música ahora utiliza el servicio
 * de PiAPI en lugar de comunicarse directamente con Suno/Luma.
 */

// Definición de tipos para las respuestas de agentes
export const AgentResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  musicUrl: z.string(),
  parameters: z.object({
    genre: z.string(),
    tempo: z.number(),
    mood: z.string(),
    structure: z.string().optional()
  }),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

export type AgentResponse = z.infer<typeof AgentResponseSchema>;

export const sunoService = {
  generateMusic: async (
    params: {
      genre: string;
      tempo: number;
      mood: string;
      structure?: string;
    },
    userId: string
  ): Promise<AgentResponse> => {
    try {
      logger.info('Iniciando generación de música con PiAPI:', {
        ...params,
        userId
      });

      // Crear un prompt descriptivo basado en los parámetros
      const description = `Generate a ${params.mood} ${params.genre} track with a tempo of ${params.tempo} BPM. Use a ${params.structure || 'verse-chorus'} structure.`;

      // Usar PiAPI para generar la música
      const result = await generateMusicWithSuno({
        model: "music-s",
        description,
        makeInstrumental: false,
        tags: params.genre
      });

      logger.info('Tarea de generación de música iniciada con PiAPI:', result);

      // Esperar hasta que la música esté generada
      let status;
      let retries = 0;
      const maxRetries = 30; // Máximo 5 minutos (10 segundos x 30 intentos)
      
      do {
        await new Promise(resolve => setTimeout(resolve, 10000)); // Esperar 10 segundos entre verificaciones
        status = await checkMusicGenerationStatus(result.taskId);
        logger.info(`Verificación ${++retries}/${maxRetries}:`, status);
        
        if (status.status === 'failed') {
          throw new Error(`La generación de música falló: ${status.error || 'Error desconocido'}`);
        }
        
      } while (status.status !== 'completed' && retries < maxRetries);
      
      if (retries >= maxRetries) {
        throw new Error('Se agotó el tiempo de espera para la generación de música');
      }

      // Construir respuesta en el formato esperado
      const sunoResponse: AgentResponse = {
        id: crypto.randomUUID(),
        userId,
        musicUrl: status.audioUrl || '/assets/music-samples/fallback-music.mp3', 
        parameters: params,
        timestamp: new Date(),
        metadata: {
          model: 'music-s-via-piapi',
          taskId: result.taskId
        }
      };

      // Intentar guardar en Firestore, pero no bloquear si falla
      try {
        const agentResponsesRef = collection(db, 'agentResponses');
        await addDoc(agentResponsesRef, {
          ...sunoResponse,
          timestamp: serverTimestamp()
        });
        logger.info('Respuesta guardada en Firestore exitosamente');
      } catch (error) {
        logger.error('Error guardando en Firestore:', error);
        // No propagamos el error para que no afecte la funcionalidad principal
      }

      return sunoResponse;
    } catch (error) {
      logger.error('Error en generateMusic:', error);
      
      // Proporcionar respuesta de fallback para no romper la UI
      return {
        id: crypto.randomUUID(),
        userId,
        musicUrl: '/assets/music-samples/fallback-music.mp3',
        parameters: params,
        timestamp: new Date(),
        metadata: {
          isError: true,
          errorMessage: error instanceof Error ? error.message : 'Error desconocido'
        }
      };
    }
  }
};

export default sunoService;