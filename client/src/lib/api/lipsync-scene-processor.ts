/**
 * Lip-Sync Scene Processor
 * Procesa lip-sync por escena individual usando PixVerse (video-to-video)
 * 
 * 🎤 MODELO: fal-ai/pixverse/lipsync ($0.04/segundo)
 * 
 * Flow:
 * 1. Recibe: audioBuffer completo + timelineItems con videos generados
 * 2. Filtra clips de PERFORMANCE (shotCategory o shot type + context)
 * 3. Para cada clip:
 *    a. Extrae audio segmentado [start:end]
 *    b. Sube audio segmentado a Firebase
 *    c. Ya debe tener videoUrl del paso anterior (Kling O1)
 *    d. Aplica PixVerse lip-sync: video + audio segmentado
 *    e. Guarda lipsyncVideoUrl en timeline
 */

import { logger } from '../logger';
import { applyPixVerseLipsync } from './pixverse-lipsync';
import { cutAudioSegments } from '../services/audio-segmentation';
import { uploadImageFromUrl } from '../firebase-storage';

export interface SceneLipsyncConfig {
  sceneId: number;
  imageUrl: string;
  videoUrl?: string; // 🆕 Video ya generado por Kling O1 (preferido)
  startTime: number;
  endTime: number;
  duration: number;
  shotType: string;
  shotCategory?: 'PERFORMANCE' | 'B-ROLL' | 'STORY'; // 🆕 Del script JSON
}

export interface SceneLipsyncResult {
  sceneId: number;
  success: boolean;
  lipsyncVideoUrl?: string;
  error?: string;
  duration: number;
}

/**
 * Extrae un segmento de audio del AudioBuffer
 * @param buffer AudioBuffer completo
 * @param startTime Tiempo inicial en segundos
 * @param endTime Tiempo final en segundos
 * @returns AudioBuffer segmentado
 */
export function extractAudioSegment(
  buffer: AudioBuffer,
  startTime: number,
  endTime: number
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const startSample = Math.floor(startTime * sampleRate);
  const endSample = Math.floor(endTime * sampleRate);
  const segmentLength = endSample - startSample;

  // Crear nuevo AudioBuffer con la duración del segmento
  const segmentBuffer = new AudioContext().createBuffer(
    buffer.numberOfChannels,
    segmentLength,
    sampleRate
  );

  // Copiar datos del segmento
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const sourceData = buffer.getChannelData(channel);
    const segmentData = segmentBuffer.getChannelData(channel);
    segmentData.set(sourceData.subarray(startSample, endSample));
  }

  return segmentBuffer;
}

/**
 * Convierte AudioBuffer a Blob
 */
export function audioBufferToBlob(buffer: AudioBuffer): Blob {
  const numberOfChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 'audio/wav';

  // Preparar datos WAV
  const channelData: Float32Array[] = [];
  for (let i = 0; i < numberOfChannels; i++) {
    channelData.push(buffer.getChannelData(i));
  }

  // Crear WAV
  const frameLength = buffer.length * numberOfChannels * 2 + 36;
  const arrayBuffer = new ArrayBuffer(44 + frameLength);
  const view = new DataView(arrayBuffer);

  // RIFF chunk
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + frameLength, true);
  writeString(8, 'WAVE');

  // FMT chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2 * numberOfChannels, true);
  view.setUint16(32, numberOfChannels * 2, true);
  view.setUint16(34, 16, true);

  // DATA chunk
  writeString(36, 'data');
  view.setUint32(40, frameLength, true);

  // Escribir audio samples
  let offset = 44;
  const volume = 0.8;

  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: format });
}

/**
 * Genera video de una imagen estática con zoom/pan suave usando FAL
 * Simula movimiento de cámara durante la duración especificada
 * 
 * @param imageUrl URL de la imagen
 * @param duration Duración del video en segundos (max 10)
 * @param shotType Tipo de plano (para determinar movimiento)
 * @returns URL del video generado
 */
export async function generateImageVideo(
  imageUrl: string,
  duration: number,
  shotType: string
): Promise<string> {
  try {
    logger.info(
      `🎬 Generando video de imagen: ${shotType}, duración: ${duration}s`
    );

    const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY;
    if (!FAL_API_KEY) {
      logger.warn('⚠️ FAL_API_KEY no configurada, usando imagen como fallback');
      return imageUrl;
    }

    // Determinar escala de movimiento basado en shot type
    const motionScaleMap: { [key: string]: number } = {
      cu: 0.3, // Close-up: movimiento pequeño
      ecu: 0.2, // Extreme close-up: movimiento mínimo
      mcu: 0.5, // Medium close-up: movimiento moderado
      ms: 0.7, // Medium shot: movimiento normal
      'close-up': 0.3,
      'closeup': 0.3,
      'medium-close-up': 0.5,
      'medium close-up': 0.5,
      'medium-shot': 0.7,
      'medium shot': 0.7,
    };

    const shotTypeNorm = (shotType || '').toLowerCase();
    const motionScale =
      Object.entries(motionScaleMap).find(([key]) =>
        shotTypeNorm.includes(key)
      )?.[1] || 0.5;

    // Llamar a FAL image-to-video
    const videoDuration = Math.max(2, Math.min(duration, 10)); // FAL soporta 2-10 segundos

    const response = await fetch(
      'https://queue.fal.run/fal-ai/image-to-video-v3',
      {
        method: 'POST',
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image_url: imageUrl,
          duration: videoDuration,
          motion_scale: motionScale,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error('❌ FAL image-to-video error:', errorData);
      logger.warn('⚠️ Usando imagen como fallback');
      return imageUrl;
    }

    const data = await response.json();
    const requestId = data.request_id;

    logger.info(
      `⏳ FAL video generation job submitted: ${requestId}`
    );

    // Poll para obtener el resultado
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 5000)); // Esperar 5 segundos

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/image-to-video-v3/requests/${requestId}/status`,
        {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
          },
        }
      );

      if (!statusResponse.ok) {
        attempts++;
        continue;
      }

      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/image-to-video-v3/requests/${requestId}`,
          {
            headers: {
              Authorization: `Key ${FAL_API_KEY}`,
            },
          }
        );

        if (!resultResponse.ok) {
          logger.warn('⚠️ Error obteniendo resultado, usando imagen como fallback');
          return imageUrl;
        }

        const resultData = await resultResponse.json();
        const videoUrl = resultData.output?.video?.url;

        if (!videoUrl) {
          logger.warn('⚠️ No video URL en respuesta, usando imagen como fallback');
          return imageUrl;
        }

        logger.info(`✅ Video generado exitosamente: ${videoUrl.substring(0, 50)}...`);
        return videoUrl;
      }

      if (statusData.status === 'FAILED') {
        logger.error('❌ FAL video generation failed:', statusData.error);
        logger.warn('⚠️ Usando imagen como fallback');
        return imageUrl;
      }

      logger.info(
        `⏳ Status: ${statusData.status} (attempt ${attempts + 1}/${maxAttempts})`
      );
      attempts++;
    }

    logger.warn('⚠️ FAL video generation timeout, usando imagen como fallback');
    return imageUrl;
  } catch (error) {
    logger.error(`❌ Error generando video de imagen:`, error);
    logger.warn('⚠️ Usando imagen como fallback');
    return imageUrl; // Fallback seguro
  }
}

/**
 * 🎤 Procesa lip-sync para una escena individual usando PixVerse
 * 
 * PREFERENCIA DE VIDEO:
 * 1. Si sceneConfig.videoUrl existe (Kling O1 video) → Usar directamente
 * 2. Si no, generar video desde imagen con generateImageVideo()
 * 
 * @param sceneConfig Configuración de la escena (con videoUrl preferido)
 * @param audioBuffer AudioBuffer completo de la canción
 * @param userId ID del usuario
 * @param projectName Nombre del proyecto
 * @returns Resultado del procesamiento con lipsyncVideoUrl
 */
export async function processSceneLipsync(
  sceneConfig: SceneLipsyncConfig,
  audioBuffer: AudioBuffer,
  userId: string,
  projectName: string
): Promise<SceneLipsyncResult> {
  try {
    logger.info(`🎤 [PIXVERSE SCENE ${sceneConfig.sceneId}] Iniciando lip-sync...`);
    logger.info(`   Shot Category: ${sceneConfig.shotCategory || 'UNKNOWN'}`);
    logger.info(`   Has Video: ${!!sceneConfig.videoUrl}`);

    // Paso 1: Extraer audio segmentado
    logger.info(
      `✂️ [SCENE ${sceneConfig.sceneId}] Extrayendo audio [${sceneConfig.startTime.toFixed(2)}s - ${sceneConfig.endTime.toFixed(2)}s]`
    );

    const segmentedAudio = extractAudioSegment(
      audioBuffer,
      sceneConfig.startTime,
      sceneConfig.endTime
    );

    const audioBlob = audioBufferToBlob(segmentedAudio);

    // Paso 2: Subir audio a Firebase
    logger.info(`📤 [SCENE ${sceneConfig.sceneId}] Subiendo audio segmentado...`);

    const audioUrl = URL.createObjectURL(audioBlob);
    const permanentAudioUrl = await uploadImageFromUrl(
      audioUrl,
      userId,
      `${projectName}/scenes/${sceneConfig.sceneId}/audio`
    );
    URL.revokeObjectURL(audioUrl);

    logger.info(`✅ [SCENE ${sceneConfig.sceneId}] Audio subido: ${permanentAudioUrl.substring(0, 60)}...`);

    // Paso 3: Obtener video para lip-sync
    // PREFERIR videoUrl de Kling O1 si existe
    let videoUrl: string;
    
    if (sceneConfig.videoUrl && sceneConfig.videoUrl.startsWith('http')) {
      logger.info(`🎬 [SCENE ${sceneConfig.sceneId}] Usando video existente (Kling O1)`);
      videoUrl = sceneConfig.videoUrl;
    } else if (sceneConfig.imageUrl) {
      logger.info(`🎬 [SCENE ${sceneConfig.sceneId}] Generando video desde imagen...`);
      videoUrl = await generateImageVideo(
        sceneConfig.imageUrl,
        sceneConfig.duration,
        sceneConfig.shotType
      );
    } else {
      throw new Error('No video or image URL available for lip-sync');
    }

    // Paso 4: Aplicar PixVerse lip-sync (video-to-video)
    logger.info(
      `🎤 [SCENE ${sceneConfig.sceneId}] Aplicando PixVerse lip-sync...`
    );

    const lipsyncResult = await applyPixVerseLipsync({
      videoUrl: videoUrl,
      audioUrl: permanentAudioUrl
    });

    if (!lipsyncResult.success) {
      logger.error(
        `❌ [SCENE ${sceneConfig.sceneId}] PixVerse lip-sync fallido:`,
        lipsyncResult.error
      );
      return {
        sceneId: sceneConfig.sceneId,
        success: false,
        error: lipsyncResult.error,
        duration: sceneConfig.duration,
      };
    }

    logger.info(
      `✅ [SCENE ${sceneConfig.sceneId}] Lip-sync completado: ${lipsyncResult.videoUrl?.substring(0, 50)}...`
    );

    return {
      sceneId: sceneConfig.sceneId,
      success: true,
      lipsyncVideoUrl: lipsyncResult.videoUrl,
      duration: sceneConfig.duration,
    };
  } catch (error) {
    logger.error(`❌ [SCENE ${sceneConfig.sceneId}] Error:`, error);
    return {
      sceneId: sceneConfig.sceneId,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: sceneConfig.duration,
    };
  }
}

/**
 * Procesa lip-sync para múltiples escenas secuencialmente
 * 
 * @param sceneConfigs Array de configuraciones de escenas
 * @param audioBuffer AudioBuffer completo
 * @param userId ID del usuario
 * @param projectName Nombre del proyecto
 * @param onProgress Callback para reportar progreso
 * @returns Map de resultados por sceneId
 */
export async function batchProcessSceneLipsync(
  sceneConfigs: SceneLipsyncConfig[],
  audioBuffer: AudioBuffer,
  userId: string,
  projectName: string,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Map<number, SceneLipsyncResult>> {
  const results = new Map<number, SceneLipsyncResult>();
  const total = sceneConfigs.length;

  logger.info(`🎬 Procesando ${total} escenas con lip-sync...`);

  for (let i = 0; i < sceneConfigs.length; i++) {
    const sceneConfig = sceneConfigs[i];
    const current = i + 1;

    onProgress?.(
      current,
      total,
      `Procesando escena ${current}/${total}: ${sceneConfig.shotType}`
    );

    const result = await processSceneLipsync(
      sceneConfig,
      audioBuffer,
      userId,
      projectName
    );

    results.set(sceneConfig.sceneId, result);

    // Delay entre escenas para no sobrecargar FAL
    if (i < sceneConfigs.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  logger.info(`✅ Procesamiento completado: ${results.size} escenas`);
  return results;
}
