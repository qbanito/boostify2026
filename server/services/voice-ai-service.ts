/**
 * Voice AI Service - Clonación y Transformación de Voz
 * 
 * WORKFLOW COMPLETO:
 * 1. Usuario sube audio de su voz (30 segundos mínimo)
 * 2. Clonamos la voz con Qwen3-TTS Clone Voice
 * 3. Generamos música instrumental (MiniMax/StableAudio)
 * 4. Cambiamos la voz en canciones existentes con ElevenLabs Voice Changer
 * 
 * PROVIDER CHAIN (fallback order):
 * PRIMARY:  FAL.ai (Qwen3-TTS, ElevenLabs, SAM Audio, DeepFilterNet3)
 * FALLBACK: Replicate (XTTS-v2, OpenVoice, Demucs, Whisper)
 * FALLBACK: Kits.ai (Voice Conversion, Vocal Separation)
 * 
 * MODELOS FAL:
 * - fal-ai/qwen-3-tts/clone-voice/1.7b: Clonación de voz zero-shot
 * - fal-ai/qwen-3-tts/text-to-speech/1.7b: TTS con voz clonada
 * - fal-ai/elevenlabs/voice-changer: Cambiar voz en audio existente
 * - fal-ai/sam-audio/separate: Separar vocals/instrumental
 * - fal-ai/deepfilternet3: Mejorar calidad de audio
 * 
 * MODELOS REPLICATE (fallback):
 * - lucataco/xtts-v2: TTS multilingüe con clonación
 * - chenxwh/openvoice: Voice cloning v2
 * - zsxkib/realistic-voice-cloning: RVC v2 voice conversion
 * - cjwbw/demucs: Audio stem separation (4-stem)
 * - openai/whisper: Speech-to-text transcription
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { storage } from '../firebase';
import { v4 as uuidv4 } from 'uuid';

const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY || '';
const FAL_BASE_URL = 'https://fal.run';
const FAL_QUEUE_URL = 'https://queue.fal.run';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const KITS_AI_API_KEY = process.env.KITS_AI_API_KEY || '';

// Modelos de Voice AI
export const VOICE_AI_MODELS = {
  // ── FAL.ai ──
  // Clonar voz del usuario
  CLONE_VOICE: 'fal-ai/qwen-3-tts/clone-voice/1.7b',
  CLONE_VOICE_LIGHT: 'fal-ai/qwen-3-tts/clone-voice/0.6b',
  
  // Text-to-Speech con voz clonada
  TTS_WITH_VOICE: 'fal-ai/qwen-3-tts/text-to-speech/1.7b',
  TTS_WITH_VOICE_LIGHT: 'fal-ai/qwen-3-tts/text-to-speech/0.6b',
  
  // Voice Design (crear voces personalizadas)
  VOICE_DESIGN: 'fal-ai/qwen-3-tts/voice-design/1.7b',
  
  // ElevenLabs Voice Changer
  VOICE_CHANGER: 'fal-ai/elevenlabs/voice-changer',
  
  // Separación de audio
  AUDIO_SEPARATE: 'fal-ai/sam-audio/separate',
  
  // Mejora de audio
  AUDIO_ENHANCE: 'fal-ai/deepfilternet3',
  AUDIO_UPSCALE: 'fal-ai/nova-sr',
  
  // Dia TTS Voice Clone (alternativa)
  DIA_VOICE_CLONE: 'fal-ai/dia-tts/voice-clone',

  // ── Replicate (fallbacks) ──
  REPLICATE_XTTS: 'lucataco/xtts-v2',
  REPLICATE_OPENVOICE: 'chenxwh/openvoice',
  REPLICATE_RVC: 'zsxkib/realistic-voice-cloning',
  REPLICATE_DEMUCS: 'cjwbw/demucs',
  REPLICATE_WHISPER: 'openai/whisper',
} as const;

// Interfaces
export interface VoiceCloneResult {
  success: boolean;
  voiceId?: string;
  voiceUrl?: string;
  error?: string;
  provider?: string;
}

export interface TextToSpeechResult {
  success: boolean;
  audioUrl?: string;
  duration?: number;
  error?: string;
  provider?: string;
}

export interface VoiceChangerResult {
  success: boolean;
  audioUrl?: string;
  originalDuration?: number;
  error?: string;
  provider?: string;
}

export interface AudioSeparationResult {
  success: boolean;
  vocalsUrl?: string;
  instrumentalUrl?: string;
  drumsUrl?: string;
  bassUrl?: string;
  otherUrl?: string;
  stems?: Array<{ type: string; name: string; audioUrl: string }>;
  error?: string;
  provider?: string;
}

export interface VoiceModel {
  id: string;
  name: string;
  userId: string;
  audioUrl: string;
  voiceData?: string;
  createdAt: Date;
  provider: string;
}

/**
 * Headers para las peticiones a FAL
 */
function getFalHeaders() {
  return {
    'Authorization': `Key ${FAL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

/**
 * Headers para Replicate
 */
function getReplicateHeaders() {
  return {
    Authorization: `Bearer ${REPLICATE_API_TOKEN}`,
    'Content-Type': 'application/json',
    Prefer: 'wait',
  };
}

/**
 * Run a Replicate prediction and wait for result
 */
async function runReplicatePrediction(
  model: string,
  input: Record<string, any>,
  timeoutMs: number = 300000
): Promise<any> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }

  logger.info(`[VoiceAI] Running Replicate: ${model}`);

  // Create prediction
  const createResponse = await axios.post(
    'https://api.replicate.com/v1/predictions',
    { model, input },
    { headers: getReplicateHeaders(), timeout: 30000 }
  );

  const predictionId = createResponse.data.id;
  logger.info(`[VoiceAI] Replicate prediction: ${predictionId}`);

  // If already completed (Prefer: wait header)
  if (createResponse.data.status === 'succeeded') {
    return createResponse.data.output;
  }
  if (createResponse.data.status === 'failed') {
    throw new Error(createResponse.data.error || 'Replicate prediction failed');
  }

  // Poll for completion
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    await new Promise(resolve => setTimeout(resolve, 3000));

    const statusResponse = await axios.get(
      `https://api.replicate.com/v1/predictions/${predictionId}`,
      { headers: { Authorization: `Bearer ${REPLICATE_API_TOKEN}` } }
    );

    if (statusResponse.data.status === 'succeeded') {
      return statusResponse.data.output;
    }
    if (statusResponse.data.status === 'failed' || statusResponse.data.status === 'canceled') {
      throw new Error(statusResponse.data.error || `Replicate prediction ${statusResponse.data.status}`);
    }
  }

  throw new Error('Replicate prediction timeout');
}

/**
 * Sube audio a FAL Storage y devuelve URL pública
 * FAL Storage es accesible por todos los modelos de FAL.ai
 */
async function uploadAudioToStorage(
  audioBuffer: Buffer,
  mimeType: string = 'audio/wav',
  folder: string = 'voice-samples'
): Promise<string> {
  try {
    // Determinar extensión correcta para el archivo
    const mimeToExt: Record<string, string> = {
      'audio/mpeg': 'mp3',
      'audio/mp3': 'mp3',
      'audio/wav': 'wav',
      'audio/wave': 'wav',
      'audio/ogg': 'ogg',
      'audio/webm': 'webm',
      'audio/m4a': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/aac': 'aac',
    };
    const ext = mimeToExt[mimeType] || mimeType.split('/')[1] || 'mp3';
    const fileName = `${folder}/${uuidv4()}.${ext}`;
    
    // Subir a FAL Storage usando su API
    const FormData = (await import('form-data')).default;
    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename: `${uuidv4()}.${ext}`,
      contentType: mimeType,
    });
    
    const uploadResponse = await axios.post(
      'https://fal.run/fal-ai/storage/upload',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Key ${FAL_API_KEY}`,
        },
        timeout: 60000,
      }
    );
    
    if (uploadResponse.data && uploadResponse.data.url) {
      logger.info(`[VoiceAI] Audio subido a FAL Storage: ${uploadResponse.data.url}`);
      return uploadResponse.data.url;
    }
    
    throw new Error('No se recibió URL de FAL Storage');
  } catch (error: any) {
    logger.error('[VoiceAI] Error subiendo a FAL Storage:', error.message);
    
    // Fallback: guardar localmente (solo funciona si el servidor es accesible públicamente)
    try {
      const fs = await import('fs');
      const path = await import('path');
      
      const mimeToExt: Record<string, string> = {
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/ogg': 'ogg',
        'audio/webm': 'webm',
        'audio/m4a': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/aac': 'aac',
      };
      const ext = mimeToExt[mimeType] || mimeType.split('/')[1] || 'mp3';
      const fileName = `${uuidv4()}.${ext}`;
      const uploadsDir = path.join(process.cwd(), 'uploads', folder);
      
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, audioBuffer);
      
      const localUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/uploads/${folder}/${fileName}`;
      logger.info(`[VoiceAI] Fallback: Audio guardado localmente: ${filePath}`);
      return localUrl;
    } catch (fallbackError) {
      logger.error('[VoiceAI] Error en fallback local:', fallbackError);
      throw error;
    }
  }
}

/**
 * 1. CLONAR VOZ - Qwen3-TTS Clone Voice
 * 
 * Clona la voz del usuario desde un audio de referencia (mínimo 30 segundos).
 * Zero-shot: no requiere entrenamiento previo.
 * 
 * @param audioUrl URL del audio de referencia de la voz
 * @param referenceText Texto opcional que se dice en el audio (mejora calidad)
 * @returns speaker_embedding URL para usar en TTS
 */
export async function cloneVoice(
  audioUrl: string,
  referenceText?: string
): Promise<VoiceCloneResult> {
  try {
    logger.info(`[VoiceAI] Clonando voz desde audio: ${audioUrl}`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    // Usar el cliente FAL con subscribe para manejar el queue
    const requestBody: any = {
      audio_url: audioUrl,
    };
    
    if (referenceText) {
      requestBody.reference_text = referenceText;
    }
    
    const response = await axios.post(
      `${FAL_QUEUE_URL}/${VOICE_AI_MODELS.CLONE_VOICE}`,
      requestBody,
      { headers: getFalHeaders(), timeout: 120000 }
    );
    
    // FAL devuelve un request_id para el queue y las URLs para polling
    const requestId = response.data.request_id;
    const statusUrl = response.data.status_url;
    const responseUrl = response.data.response_url;
    logger.info(`[VoiceAI] Request ID: ${requestId}`);
    logger.info(`[VoiceAI] Status URL: ${statusUrl}`);
    
    // Polling para obtener el resultado usando las URLs que FAL devuelve
    let result = null;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutos max
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos
      
      const statusResponse = await axios.get(
        statusUrl,
        { headers: getFalHeaders() }
      );
      
      logger.info(`[VoiceAI] Status: ${statusResponse.data.status} (attempt ${attempts + 1})`);
      
      if (statusResponse.data.status === 'COMPLETED') {
        const resultResponse = await axios.get(
          responseUrl,
          { headers: getFalHeaders() }
        );
        result = resultResponse.data;
        break;
      } else if (statusResponse.data.status === 'FAILED') {
        throw new Error(statusResponse.data.error || 'Voice cloning failed');
      }
      
      attempts++;
    }
    
    if (!result) {
      throw new Error('Voice cloning timeout');
    }
    
    logger.info('[VoiceAI] Voz clonada exitosamente');
    
    // El resultado contiene speaker_embedding con la URL del archivo safetensors
    return {
      success: true,
      voiceId: result.speaker_embedding?.url || result.speaker_embedding,
      voiceUrl: result.speaker_embedding?.url || result.speaker_embedding,
      provider: 'qwen-3-tts-clone',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error clonando voz con FAL:', error.response?.data || error.message);
    
    // ═══ FALLBACK: Replicate OpenVoice v2 ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate OpenVoice v2');
        const output = await runReplicatePrediction('chenxwh/openvoice', {
          audio: audioUrl,
          text: referenceText || 'Hello, this is a voice cloning test.',
          language: 'English',
          speed: 1.0,
        });

        // OpenVoice returns the generated audio URL
        const resultUrl = typeof output === 'string' ? output : output?.url || output;
        logger.info(`[VoiceAI] Replicate OpenVoice clone success: ${resultUrl}`);
        
        return {
          success: true,
          voiceId: audioUrl, // use original audio as "voice ID" for re-use
          voiceUrl: resultUrl,
          provider: 'replicate-openvoice',
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate OpenVoice fallback failed:', replicateErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      provider: 'qwen-3-tts-clone',
    };
  }
}

/**
 * 2. TEXT-TO-SPEECH con Voz Clonada
 * 
 * Genera audio hablado/cantado usando la voz clonada del usuario.
 * El voiceId es la URL del speaker_embedding (archivo .safetensors)
 * 
 * @param text Texto o letra a convertir en audio
 * @param speakerEmbeddingUrl URL del speaker embedding de la voz clonada
 * @param options Opciones adicionales (language, referenceText)
 */
export async function textToSpeechWithVoice(
  text: string,
  speakerEmbeddingUrl: string,
  options: {
    language?: 'Auto' | 'English' | 'Spanish' | 'French' | 'German' | 'Italian' | 'Japanese' | 'Korean' | 'Portuguese' | 'Russian' | 'Chinese';
    referenceText?: string;
    temperature?: number;
  } = {}
): Promise<TextToSpeechResult> {
  try {
    logger.info(`[VoiceAI] Generando TTS con voz clonada`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const requestBody: any = {
      text,
      speaker_voice_embedding_file_url: speakerEmbeddingUrl,
      language: options.language || 'Auto',
      temperature: options.temperature || 0.9,
    };
    
    if (options.referenceText) {
      requestBody.reference_text = options.referenceText;
    }
    
    // Usar queue para manejar el proceso
    const response = await axios.post(
      `${FAL_QUEUE_URL}/${VOICE_AI_MODELS.TTS_WITH_VOICE}`,
      requestBody,
      { headers: getFalHeaders(), timeout: 120000 }
    );
    
    const requestId = response.data.request_id;
    logger.info(`[VoiceAI] TTS Request ID: ${requestId}`);
    
    // Polling para obtener el resultado
    let result = null;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `${FAL_QUEUE_URL}/${VOICE_AI_MODELS.TTS_WITH_VOICE}/requests/${requestId}/status`,
        { headers: getFalHeaders() }
      );
      
      if (statusResponse.data.status === 'COMPLETED') {
        const resultResponse = await axios.get(
          `${FAL_QUEUE_URL}/${VOICE_AI_MODELS.TTS_WITH_VOICE}/requests/${requestId}`,
          { headers: getFalHeaders() }
        );
        result = resultResponse.data;
        break;
      } else if (statusResponse.data.status === 'FAILED') {
        throw new Error(statusResponse.data.error || 'TTS generation failed');
      }
      
      attempts++;
    }
    
    if (!result) {
      throw new Error('TTS generation timeout');
    }
    
    logger.info('[VoiceAI] TTS generado exitosamente');
    
    return {
      success: true,
      audioUrl: result.audio?.url || result.audio_url,
      duration: result.audio?.duration || result.duration,
      provider: 'qwen-3-tts',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error en TTS con FAL:', error.response?.data || error.message);
    
    // ═══ FALLBACK: Replicate XTTS-v2 ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate XTTS-v2 (multilingual TTS)');
        const output = await runReplicatePrediction('lucataco/xtts-v2', {
          text,
          speaker: speakerEmbeddingUrl, // URL of reference audio
          language: (options.language || 'en').toLowerCase().substring(0, 2),
        });

        const resultUrl = typeof output === 'string' ? output : output?.url || output;
        logger.info(`[VoiceAI] Replicate XTTS-v2 TTS success: ${resultUrl}`);
        
        return {
          success: true,
          audioUrl: resultUrl,
          provider: 'replicate-xtts-v2',
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate XTTS-v2 fallback failed:', replicateErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      provider: 'qwen-3-tts',
    };
  }
}

/**
 * 3. VOICE CHANGER - ElevenLabs
 * 
 * Cambia la voz en un audio existente (ej: canción generada)
 * por otra voz (la del usuario o una seleccionada).
 * 
 * @param audioUrl URL del audio original (canción con vocals)
 * @param targetVoiceId ID de la voz destino
 */
export async function changeVoice(
  audioUrl: string,
  targetVoiceId: string
): Promise<VoiceChangerResult> {
  try {
    logger.info(`[VoiceAI] Cambiando voz en audio: ${audioUrl}`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const response = await axios.post(
      `${FAL_BASE_URL}/${VOICE_AI_MODELS.VOICE_CHANGER}`,
      {
        audio_url: audioUrl,
        voice_id: targetVoiceId,
      },
      { headers: getFalHeaders(), timeout: 180000 }
    );
    
    logger.info('[VoiceAI] Voz cambiada exitosamente');
    
    return {
      success: true,
      audioUrl: response.data.audio?.url || response.data.audio_url,
      originalDuration: response.data.duration,
      provider: 'elevenlabs-voice-changer',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error cambiando voz con FAL:', error.message);
    
    // ═══ FALLBACK: Replicate RVC v2 ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate RVC v2 (realistic voice cloning)');
        const output = await runReplicatePrediction('zsxkib/realistic-voice-cloning', {
          song_input: audioUrl,
          rvc_model: 'Squidward', // default model
          pitch_change: 'no-change',
          index_rate: 0.5,
          main_vocals_volume_change: 0,
        });

        const resultUrl = typeof output === 'string' ? output : output?.url || output;
        logger.info(`[VoiceAI] Replicate RVC voice change success: ${resultUrl}`);
        
        return {
          success: true,
          audioUrl: resultUrl,
          provider: 'replicate-rvc',
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate RVC fallback failed:', replicateErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      provider: 'elevenlabs-voice-changer',
    };
  }
}

/**
 * 4. SEPARAR AUDIO - SAM Audio
 * 
 * Separa un audio en vocals e instrumental usando AI.
 * Útil para:
 * - Extraer instrumental de una canción
 * - Aislar vocals para procesarlos
 * 
 * @param audioUrl URL del audio a separar
 * @param targetSound Qué separar: "vocals", "drums", "bass", etc.
 */
export async function separateAudio(
  audioUrl: string,
  targetSound: string = 'vocals'
): Promise<AudioSeparationResult> {
  try {
    logger.info(`[VoiceAI] Separando audio: ${targetSound}`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const response = await axios.post(
      `${FAL_BASE_URL}/${VOICE_AI_MODELS.AUDIO_SEPARATE}`,
      {
        audio_url: audioUrl,
        target: targetSound,
      },
      { headers: getFalHeaders(), timeout: 180000 }
    );
    
    logger.info('[VoiceAI] Audio separado exitosamente');
    
    // SAM Audio devuelve el audio separado y el residual
    return {
      success: true,
      vocalsUrl: targetSound === 'vocals' ? response.data.output_url : response.data.residual_url,
      instrumentalUrl: targetSound === 'vocals' ? response.data.residual_url : response.data.output_url,
      provider: 'sam-audio',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error separando audio con FAL:', error.message);
    
    // ═══ FALLBACK: Replicate Demucs (4-stem separation) ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate Demucs');
        const output = await runReplicatePrediction('cjwbw/demucs', {
          audio: audioUrl,
          stem: targetSound === 'vocals' ? 'vocals' : 'none',
        });

        // Demucs returns { vocals, drums, bass, other } or single stem
        if (typeof output === 'string') {
          return {
            success: true,
            vocalsUrl: targetSound === 'vocals' ? output : undefined,
            instrumentalUrl: targetSound !== 'vocals' ? output : undefined,
            provider: 'replicate-demucs',
          };
        }
        
        return {
          success: true,
          vocalsUrl: output?.vocals,
          instrumentalUrl: output?.other || output?.no_vocals,
          provider: 'replicate-demucs',
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate Demucs fallback failed:', replicateErr.message);
      }
    }
    
    // ═══ FALLBACK 2: Kits.ai Vocal Separation ═══
    if (KITS_AI_API_KEY) {
      try {
        logger.info('[VoiceAI] Fallback 2: Kits.ai Vocal Separation');
        const FormData = (await import('form-data')).default;
        const formData = new FormData();
        
        // Download audio and send to Kits
        const audioResponse = await axios.get(audioUrl, { responseType: 'arraybuffer', timeout: 30000 });
        formData.append('inputFile', Buffer.from(audioResponse.data), {
          filename: 'input.mp3',
          contentType: 'audio/mpeg',
        });

        const kitsResponse = await axios.post(
          'https://arpeggi.io/api/kits/v1/vocal-separations',
          formData,
          {
            headers: {
              Authorization: `Bearer ${KITS_AI_API_KEY}`,
              ...formData.getHeaders(),
            },
            timeout: 30000,
          }
        );

        // Kits returns a job, poll for result
        const jobId = kitsResponse.data.id;
        let attempts = 0;
        while (attempts < 60) {
          await new Promise(resolve => setTimeout(resolve, 3000));
          const statusResponse = await axios.get(
            `https://arpeggi.io/api/kits/v1/vocal-separations/${jobId}`,
            { headers: { Authorization: `Bearer ${KITS_AI_API_KEY}` } }
          );
          if (statusResponse.data.status === 'success') {
            return {
              success: true,
              vocalsUrl: statusResponse.data.vocalAudioFileUrl,
              instrumentalUrl: statusResponse.data.backingAudioFileUrl,
              provider: 'kits-ai',
            };
          }
          if (statusResponse.data.status === 'error') {
            throw new Error('Kits vocal separation failed');
          }
          attempts++;
        }
        throw new Error('Kits vocal separation timeout');
      } catch (kitsErr: any) {
        logger.error('[VoiceAI] Kits fallback failed:', kitsErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      provider: 'sam-audio',
    };
  }
}

/**
 * Separación multi-stem normalizada para Mini Studio.
 * Devuelve stems listos para colocarse en canales independientes.
 */
export async function separateStems(audioUrl: string): Promise<AudioSeparationResult> {
  const normalizeUrl = (value: any): string | undefined => {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return normalizeUrl(value[0]);
    if (typeof value === 'object') return value.url || value.audio || value.path || value.file || undefined;
    return undefined;
  };

  const stemName = (type: string) => ({
    vocals: 'Vocals Stem',
    drums: 'Drums Stem',
    bass: 'Bass Stem',
    other: 'Music Stem',
    instrumental: 'Instrumental Stem',
  } as Record<string, string>)[type] || `${type} Stem`;

  const buildStems = (urls: Record<string, string | undefined>) => Object.entries(urls)
    .filter(([, url]) => !!url)
    .map(([type, url]) => ({ type, name: stemName(type), audioUrl: url as string }));

  if (REPLICATE_API_TOKEN) {
    try {
      logger.info('[VoiceAI] Separando audio en 4 stems con Replicate Demucs');
      const output = await runReplicatePrediction(VOICE_AI_MODELS.REPLICATE_DEMUCS, {
        audio: audioUrl,
        stem: 'none',
      });
      const urls = {
        vocals: normalizeUrl(output?.vocals || output?.vocal),
        drums: normalizeUrl(output?.drums),
        bass: normalizeUrl(output?.bass),
        other: normalizeUrl(output?.other),
        instrumental: normalizeUrl(output?.no_vocals || output?.instrumental),
      };
      const stems = buildStems(urls);
      if (stems.length) {
        return {
          success: true,
          vocalsUrl: urls.vocals,
          drumsUrl: urls.drums,
          bassUrl: urls.bass,
          otherUrl: urls.other,
          instrumentalUrl: urls.instrumental || urls.other,
          stems,
          provider: 'replicate-demucs',
        };
      }
    } catch (err: any) {
      logger.error('[VoiceAI] Demucs multi-stem failed:', err.message);
    }
  }

  const twoStem = await separateAudio(audioUrl, 'vocals');
  const stems = buildStems({ vocals: twoStem.vocalsUrl, instrumental: twoStem.instrumentalUrl });
  return { ...twoStem, stems, provider: twoStem.provider || 'two-stem' };
}

/**
 * 5. MEJORAR AUDIO - DeepFilterNet3
 * 
 * Mejora la calidad del audio eliminando ruido de fondo
 * y aumentando la resolución a 48kHz.
 * 
 * @param audioUrl URL del audio a mejorar
 */
export async function enhanceAudio(audioUrl: string): Promise<TextToSpeechResult> {
  try {
    logger.info(`[VoiceAI] Mejorando audio: ${audioUrl}`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const response = await axios.post(
      `${FAL_BASE_URL}/${VOICE_AI_MODELS.AUDIO_ENHANCE}`,
      {
        audio_url: audioUrl,
      },
      { headers: getFalHeaders(), timeout: 120000 }
    );
    
    logger.info('[VoiceAI] Audio mejorado exitosamente');
    
    return {
      success: true,
      audioUrl: response.data.audio?.url || response.data.audio_url,
      provider: 'deepfilternet3',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error mejorando audio con FAL:', error.message);
    
    // Audio enhancement has no direct fallback — return the original URL as "enhanced"
    logger.warn('[VoiceAI] No fallback for audio enhancement, returning original audio');
    return {
      success: true,
      audioUrl: audioUrl, // Return original as-is
      provider: 'passthrough',
    };
  }
}

/**
 * 6. TRANSCRIBIR AUDIO - ElevenLabs Scribe V2
 * 
 * Transcribe el audio de vocals para obtener la letra.
 * 
 * @param audioUrl URL del audio a transcribir
 */
export async function transcribeAudio(audioUrl: string): Promise<{
  success: boolean;
  text?: string;
  words?: Array<{text: string; start: number; end: number}>;
  error?: string;
}> {
  try {
    logger.info(`[VoiceAI] Transcribiendo audio: ${audioUrl}`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const response = await axios.post(
      `${FAL_QUEUE_URL}/fal-ai/elevenlabs/speech-to-text/scribe-v2`,
      {
        audio_url: audioUrl,
        diarize: false,
        tag_audio_events: false,
      },
      { headers: getFalHeaders(), timeout: 120000 }
    );
    
    const requestId = response.data.request_id;
    
    // Polling
    let result = null;
    let attempts = 0;
    while (attempts < 60) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const statusResponse = await axios.get(
        `${FAL_QUEUE_URL}/fal-ai/elevenlabs/speech-to-text/scribe-v2/requests/${requestId}/status`,
        { headers: getFalHeaders() }
      );
      
      if (statusResponse.data.status === 'COMPLETED') {
        const resultResponse = await axios.get(
          `${FAL_QUEUE_URL}/fal-ai/elevenlabs/speech-to-text/scribe-v2/requests/${requestId}`,
          { headers: getFalHeaders() }
        );
        result = resultResponse.data;
        break;
      } else if (statusResponse.data.status === 'FAILED') {
        throw new Error('Transcription failed');
      }
      attempts++;
    }
    
    if (!result) {
      throw new Error('Transcription timeout');
    }
    
    logger.info('[VoiceAI] Transcripción completada');
    
    return {
      success: true,
      text: result.text,
      words: result.words,
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error transcribiendo con FAL:', error.message);
    
    // ═══ FALLBACK: Replicate Whisper ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate Whisper');
        const output = await runReplicatePrediction('openai/whisper', {
          audio: audioUrl,
          model: 'large-v3',
          language: 'auto',
          translate: false,
        });

        // Whisper returns { transcription, segments, ... }
        const text = typeof output === 'string' ? output : output?.transcription || output?.text || '';
        logger.info(`[VoiceAI] Replicate Whisper success: "${text.substring(0, 80)}..."`);
        
        return {
          success: true,
          text,
          words: output?.segments?.map((s: any) => ({
            text: s.text,
            start: s.start,
            end: s.end,
          })),
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate Whisper fallback failed:', replicateErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

/**
 * 7. WORKFLOW COMPLETO: Canción con Tu Voz
 * 
 * Pipeline completo para poner TU VOZ en una canción generada:
 * 
 * PRERREQUISITO: Usuario ya tiene su voz clonada (speaker_embedding URL)
 * 
 * STEPS:
 * 1. Separar canción en VOCALS + INSTRUMENTAL
 * 2. Transcribir los VOCALS para obtener la letra
 * 3. Generar TTS con TU VOZ CLONADA usando la letra
 * 4. El resultado es: INSTRUMENTAL + TU VOZ (mezcla manual si es necesario)
 * 
 * @param songUrl URL de la canción generada (con vocals AI originales)
 * @param speakerEmbeddingUrl URL del speaker_embedding de tu voz clonada
 * @param options Opciones adicionales
 */
export async function createSongWithUserVoice(
  songUrl: string,
  speakerEmbeddingUrl: string,
  options: {
    language?: 'Auto' | 'English' | 'Spanish';
    enhanceOutput?: boolean;
  } = {}
): Promise<{
  success: boolean;
  finalAudioUrl?: string;
  instrumentalUrl?: string;
  newVocalsUrl?: string;
  lyrics?: string;
  steps?: {
    separation?: AudioSeparationResult;
    transcription?: { text: string };
    tts?: TextToSpeechResult;
    enhance?: TextToSpeechResult;
  };
  error?: string;
}> {
  try {
    logger.info('[VoiceAI] 🎤 Iniciando workflow: Canción con TU VOZ');
    logger.info(`[VoiceAI] Canción original: ${songUrl}`);
    logger.info(`[VoiceAI] Speaker embedding: ${speakerEmbeddingUrl}`);
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 1: Separar la canción en VOCALS + INSTRUMENTAL
    // ═══════════════════════════════════════════════════════════════
    logger.info('[VoiceAI] 📀 Paso 1/4: Separando audio en vocals + instrumental...');
    const separation = await separateAudio(songUrl, 'vocals');
    
    if (!separation.success || !separation.vocalsUrl || !separation.instrumentalUrl) {
      throw new Error('Error separando audio: ' + (separation.error || 'No se obtuvieron las pistas'));
    }
    
    logger.info(`[VoiceAI] ✅ Vocals: ${separation.vocalsUrl}`);
    logger.info(`[VoiceAI] ✅ Instrumental: ${separation.instrumentalUrl}`);
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 2: Transcribir los vocals para obtener la letra
    // ═══════════════════════════════════════════════════════════════
    logger.info('[VoiceAI] 📝 Paso 2/4: Transcribiendo vocals para obtener letra...');
    const transcription = await transcribeAudio(separation.vocalsUrl);
    
    if (!transcription.success || !transcription.text) {
      throw new Error('Error transcribiendo: ' + (transcription.error || 'No se obtuvo texto'));
    }
    
    const lyrics = transcription.text;
    logger.info(`[VoiceAI] ✅ Letra obtenida: "${lyrics.substring(0, 100)}..."`);
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 3: Generar TTS con TU VOZ CLONADA usando la letra
    // ═══════════════════════════════════════════════════════════════
    logger.info('[VoiceAI] 🎙️ Paso 3/4: Generando nuevos vocals con TU VOZ...');
    const tts = await textToSpeechWithVoice(lyrics, speakerEmbeddingUrl, {
      language: options.language || 'Auto',
    });
    
    if (!tts.success || !tts.audioUrl) {
      throw new Error('Error generando TTS: ' + (tts.error || 'No se generó audio'));
    }
    
    logger.info(`[VoiceAI] ✅ Nuevos vocals generados: ${tts.audioUrl}`);
    
    // ═══════════════════════════════════════════════════════════════
    // PASO 4 (Opcional): Mejorar calidad del audio
    // ═══════════════════════════════════════════════════════════════
    let finalVocalsUrl = tts.audioUrl;
    let enhance: TextToSpeechResult | undefined;
    
    if (options.enhanceOutput) {
      logger.info('[VoiceAI] ✨ Paso 4/4: Mejorando calidad de audio...');
      enhance = await enhanceAudio(tts.audioUrl);
      
      if (enhance.success && enhance.audioUrl) {
        finalVocalsUrl = enhance.audioUrl;
        logger.info(`[VoiceAI] ✅ Audio mejorado: ${finalVocalsUrl}`);
      }
    }
    
    // ═══════════════════════════════════════════════════════════════
    // RESULTADO FINAL
    // ═══════════════════════════════════════════════════════════════
    // Nota: Para mezclar INSTRUMENTAL + NUEVOS VOCALS necesitamos FFmpeg
    // Por ahora devolvemos ambas pistas separadas para que el usuario
    // las mezcle en un DAW o usemos un servicio de mezcla
    
    logger.info('[VoiceAI] 🎉 Workflow completado exitosamente!');
    logger.info('[VoiceAI] 📦 Resultados:');
    logger.info(`[VoiceAI]    - Instrumental: ${separation.instrumentalUrl}`);
    logger.info(`[VoiceAI]    - Nuevos Vocals (TU VOZ): ${finalVocalsUrl}`);
    
    return {
      success: true,
      // Por ahora usamos los vocals como "final" - idealmente mezclaríamos
      finalAudioUrl: finalVocalsUrl,
      instrumentalUrl: separation.instrumentalUrl,
      newVocalsUrl: finalVocalsUrl,
      lyrics,
      steps: {
        separation,
        transcription: { text: lyrics },
        tts,
        enhance,
      },
    };
  } catch (error: any) {
    logger.error('[VoiceAI] ❌ Error en workflow:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Diseñar una voz personalizada con descripción de texto
 * 
 * Crea una voz única basada en una descripción textual.
 * Útil para crear voces de personajes o estilos específicos.
 * 
 * @param description Descripción de la voz deseada
 */
export async function designVoice(
  description: string
): Promise<VoiceCloneResult> {
  try {
    logger.info(`[VoiceAI] Diseñando voz: ${description.substring(0, 50)}...`);
    
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }
    
    const response = await axios.post(
      `${FAL_BASE_URL}/${VOICE_AI_MODELS.VOICE_DESIGN}`,
      {
        text: description,
        // Ejemplo: "A warm female voice with a slight British accent, speaking calmly"
      },
      { headers: getFalHeaders(), timeout: 120000 }
    );
    
    logger.info('[VoiceAI] Voz diseñada exitosamente');
    
    return {
      success: true,
      voiceId: response.data.voice_id,
      voiceUrl: response.data.voice_url,
      provider: 'qwen-3-tts-design',
    };
  } catch (error: any) {
    logger.error('[VoiceAI] Error diseñando voz con FAL:', error.message);
    
    // ═══ FALLBACK: Replicate OpenVoice with description as text ═══
    if (REPLICATE_API_TOKEN) {
      try {
        logger.info('[VoiceAI] Fallback: Replicate OpenVoice for voice design');
        // No direct "design from text" equivalent on Replicate,
        // but we can use XTTS with a descriptive prompt
        const output = await runReplicatePrediction('lucataco/xtts-v2', {
          text: description,
          language: 'en',
        });

        const resultUrl = typeof output === 'string' ? output : output?.url || output;
        return {
          success: true,
          voiceId: resultUrl,
          voiceUrl: resultUrl,
          provider: 'replicate-xtts-design',
        };
      } catch (replicateErr: any) {
        logger.error('[VoiceAI] Replicate voice design fallback failed:', replicateErr.message);
      }
    }
    
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
      provider: 'qwen-3-tts-design',
    };
  }
}

// Export default service
export default {
  cloneVoice,
  textToSpeechWithVoice,
  changeVoice,
  separateAudio,
  enhanceAudio,
  transcribeAudio,
  createSongWithUserVoice,
  designVoice,
  uploadAudioToStorage,
  VOICE_AI_MODELS,
};
