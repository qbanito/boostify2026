import { z } from "zod";
import { logger } from "../logger";

// Definición de esquema para las respuestas de ElevenLabs
export const ElevenLabsResponseSchema = z.object({
  audio: z.string(), // Base64 encoded audio
  metadata: z.object({
    modelId: z.string(),
    voiceId: z.string(),
    durationMs: z.number().optional(),
    characterCount: z.number(),
    voiceSettings: z.record(z.any()).optional()
  }).optional()
});

export type ElevenLabsResponse = z.infer<typeof ElevenLabsResponseSchema>;

// Configuración de ElevenLabs
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY;
const BASE_URL = 'https://api.elevenlabs.io/v1';

// Voice ID por defecto — voz masculina principal para artistas
const DEFAULT_VOICE_ID = 'MyPsCU77MauIyEn2QAFP';
// Voz femenina por defecto
const DEFAULT_FEMALE_VOICE_ID = 'EXAVITQu4vr4xnSDxMaL';

export const elevenLabsService = {
  // Función para convertir texto a voz
  textToSpeech: async (
    text: string,
    voiceId: string = DEFAULT_VOICE_ID
  ): Promise<ElevenLabsResponse> => {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key is not configured');
    }

    try {
      // Parámetros para la generación de voz
      const options = {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true
          }
        })
      };

      logger.info(`Generating speech for text of length ${text.length}`);
      const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Convertir la respuesta a un Blob y luego a Base64
      const audioBlob = await response.blob();
      const audioBase64 = await blobToBase64(audioBlob);

      return {
        audio: audioBase64.split(',')[1], // Eliminar el prefijo data:audio/mpeg;base64,
        metadata: {
          modelId: 'eleven_multilingual_v2',
          voiceId,
          characterCount: text.length,
          voiceSettings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        }
      };
    } catch (error) {
      logger.error('Error in textToSpeech:', error);
      throw error;
    }
  },

  // Función para obtener voces disponibles
  getAvailableVoices: async () => {
    if (!ELEVENLABS_API_KEY) {
      throw new Error('ElevenLabs API key is not configured');
    }

    try {
      const response = await fetch(`${BASE_URL}/voices`, {
        method: 'GET',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Error fetching available voices:', error);
      throw error;
    }
  }
};

// Función auxiliar para convertir un Blob a Base64
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default elevenLabsService;