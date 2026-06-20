import { fal } from "@fal-ai/client";
import { logger } from "../logger";
import { z } from "zod";
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { env } from '../../env';

// Schema validation for FAL.AI responses
export const FalResponseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  musicUrl: z.string(),
  parameters: z.object({
    prompt: z.string(),
    reference_audio_url: z.string().optional(),
  }),
  timestamp: z.date(),
  metadata: z.record(z.any()).optional()
});

export type FalResponse = z.infer<typeof FalResponseSchema>;

// Initialize FAL client
fal.config({
  credentials: env.VITE_FAL_API_KEY
});

export const falService = {
  generateMusic: async (
    params: {
      genre: string;
      tempo: number;
      mood: string;
      theme: string;
      language: string;
      structure: string;
    },
    userId: string,
    prompt: string
  ): Promise<FalResponse> => {
    try {
      logger.info('Iniciando generación de música con FAL.AI:', {
        ...params,
        userId,
        prompt
      });

      // Truncar y formatear el prompt para cumplir con el límite de 600 caracteres
      const truncatedPrompt = prompt.length > 590 ? 
        prompt.substring(0, 590) + '##' : 
        prompt;

      logger.info('Prompt truncado:', truncatedPrompt);

      const result = await fal.subscribe("fal-ai/minimax-music", {
        input: {
          prompt: truncatedPrompt,
          reference_audio_url: "https://fal.media/files/lion/OOTBTSlxKMH_E8H6hoSlb.mpga"
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            update.logs.map((log) => log.message).forEach(console.log);
          }
        },
      });

      logger.info('Respuesta de FAL.AI:', result);

      if (!result.data?.audio?.url) {
        throw new Error('No se recibió URL de audio en la respuesta');
      }

      const response: FalResponse = {
        id: result.requestId || crypto.randomUUID(),
        userId,
        musicUrl: result.data.audio.url,
        parameters: {
          prompt: truncatedPrompt,
          reference_audio_url: "https://fal.media/files/lion/OOTBTSlxKMH_E8H6hoSlb.mpga"
        },
        timestamp: new Date(),
        metadata: {
          model: 'minimax-music',
          contentType: result.data.audio.content_type,
          fileName: result.data.audio.file_name,
          fileSize: result.data.audio.file_size
        }
      };

      // Guardar en la colección AI_Music_Composer
      try {
        const musicComposerRef = collection(db, 'AI_Music_Composer');
        await addDoc(musicComposerRef, {
          ...response,
          originalParameters: params,
          timestamp: serverTimestamp(),
          lyrics: prompt.split('##')[1], // Extraer las letras del prompt
          format: {
            version: '1.0',
            sections: ['Lyrics', 'Music'],
            audioFormat: result.data.audio.content_type
          }
        });
        logger.info('Composición guardada en AI_Music_Composer collection');
      } catch (error) {
        logger.error('Error guardando en Firestore:', error);
        // No propagamos el error para que no afecte la funcionalidad principal
      }

      return response;
    } catch (error) {
      logger.error('Error en generateMusic:', error);
      throw error;
    }
  }
};

export default falService;