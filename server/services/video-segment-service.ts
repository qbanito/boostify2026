/**
 * 🎬 Video Segment Service
 * Servicio del servidor para manejar segmentos de video de performance
 * Usado por el pipeline para cortar el video de performance grabado por el artista
 * y aplicar motion transfer (DreamActor v2) a clips PERFORMANCE
 * 
 * FLUJO:
 * 1. El artista graba un video completo cantando su canción (onboarding Step 3)
 * 2. El video se sube a Firebase Storage
 * 3. Cuando el pipeline procesa un clip PERFORMANCE, este servicio:
 *    a) Descarga el video de performance
 *    b) Corta el segmento correspondiente al clip (por timestamps)
 *    c) Lo sube a Firebase como segmento individual
 *    d) Retorna la URL para uso con DreamActor v2
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { storage } from '../firebase';

export interface VideoSegmentResult {
  success: boolean;
  videoBuffer?: Buffer;
  error?: string;
}

export interface VideoUploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Descarga video desde URL y retorna el buffer completo
 * El corte por timestamps lo manejará DreamActor v2 con el parámetro de duración
 * 
 * NOTA: Para corte preciso de video se necesitaría ffmpeg en el servidor.
 * Por ahora, descargamos el video completo y dejamos que DreamActor v2
 * maneje la sincronización con su parámetro trim_first_second.
 * El pipeline pasará las timestamps para que cada clip use la porción correcta.
 */
export async function downloadPerformanceVideo(
  videoUrl: string
): Promise<VideoSegmentResult> {
  try {
    logger.log(`📥 [VIDEO-SEG] Descargando video de performance...`);
    
    const response = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 120000, // 2 minutos timeout (video puede ser grande)
      maxContentLength: 200 * 1024 * 1024 // Max 200MB
    });
    
    const videoBuffer = Buffer.from(response.data);
    logger.log(`✅ [VIDEO-SEG] Video descargado: ${(videoBuffer.length / 1024 / 1024).toFixed(2)}MB`);
    
    return {
      success: true,
      videoBuffer
    };
    
  } catch (error: any) {
    logger.error(`❌ [VIDEO-SEG] Error descargando video:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sube un segmento de video a Firebase Storage
 */
export async function uploadVideoSegmentToFirebase(
  videoBuffer: Buffer,
  userEmail: string,
  projectId: string,
  clipId: string,
  startTime: number,
  endTime: number
): Promise<VideoUploadResult> {
  try {
    if (!storage) {
      logger.error(`❌ [VIDEO-SEG] Firebase Storage no disponible`);
      return {
        success: false,
        error: 'Firebase Storage not available'
      };
    }
    
    const timestamp = Date.now();
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `video-segments/${sanitizedEmail}/${projectId}/clip-${clipId}-${startTime}s-${endTime}s-${timestamp}.webm`;
    
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    
    await file.save(videoBuffer, {
      metadata: {
        contentType: 'video/webm',
        metadata: {
          projectId,
          clipId,
          userEmail,
          startTime: startTime.toString(),
          endTime: endTime.toString()
        }
      },
      validation: false
    });
    
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
    
    logger.log(`✅ [VIDEO-SEG] Segmento de video subido: ${publicUrl.substring(0, 60)}...`);
    
    return {
      success: true,
      url: publicUrl
    };
    
  } catch (error: any) {
    logger.error(`❌ [VIDEO-SEG] Error subiendo a Firebase:`, error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * 🎭 Genera motion transfer video usando DreamActor v2
 * Toma una imagen del artista + video de performance (driving video) 
 * y genera un video con la misma pose/expresiones/lip-sync
 * 
 * API: fal-ai/bytedance/dreamactor/v2
 * Input: image_url (artista) + video_url (driving video de performance)
 * Output: video con motion transfer aplicado
 * Max: 30 segundos de video
 */
export async function generateMotionTransferVideo(
  artistImageUrl: string,
  drivingVideoUrl: string,
  options?: {
    trimFirstSecond?: boolean;
  }
): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  
  if (!FAL_API_KEY) {
    logger.error(`❌ [DREAMACTOR] FAL_API_KEY no configurada`);
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    logger.log(`🎭 [DREAMACTOR] Iniciando motion transfer...`);
    logger.log(`   🖼️ Artist image: ${artistImageUrl.substring(0, 60)}...`);
    logger.log(`   🎬 Driving video: ${drivingVideoUrl.substring(0, 60)}...`);

    // Submit to DreamActor v2 queue
    const submitResponse = await fetch('https://queue.fal.run/fal-ai/bytedance/dreamactor/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: artistImageUrl,
        video_url: drivingVideoUrl,
        trim_first_second: options?.trimFirstSecond ?? true
      })
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      logger.error(`❌ [DREAMACTOR] Submit error:`, errorData);
      return { success: false, error: `DreamActor submit failed: ${submitResponse.status}` };
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;
    logger.log(`⏳ [DREAMACTOR] Request enviado: ${requestId}`);

    // Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 5s between checks

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );

      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const videoUrl = resultData.video?.url || resultData.video_url;

        if (videoUrl) {
          logger.log(`✅ [DREAMACTOR] Motion transfer completado: ${videoUrl.substring(0, 60)}...`);
          return { success: true, videoUrl };
        } else {
          logger.error(`❌ [DREAMACTOR] No video URL in response:`, resultData);
          return { success: false, error: 'No video URL in DreamActor response' };
        }
      } else if (statusData.status === 'FAILED') {
        logger.error(`❌ [DREAMACTOR] Request failed:`, statusData);
        return { success: false, error: `DreamActor processing failed` };
      }

      logger.log(`⏳ [DREAMACTOR] Processing... (${i + 1}/${maxAttempts})`);
    }

    logger.error(`❌ [DREAMACTOR] Timeout waiting for result`);
    return { success: false, error: 'DreamActor timeout' };

  } catch (error: any) {
    logger.error(`❌ [DREAMACTOR] Error:`, error);
    return { success: false, error: error.message };
  }
}

/**
 * 🎤 Genera video con lipsync usando OmniHuman v1.5
 * Toma una imagen del artista + audio y genera video con body movement + lipsync
 * 
 * API: fal-ai/bytedance/omnihuman/v1.5
 * Input: image_url (artista) + audio_url (segmento de audio)
 * Output: video con lip-sync y movimiento corporal natural
 * Max: 30s @1080p, 60s @720p
 */
export async function generateOmniHumanVideo(
  artistImageUrl: string,
  audioUrl: string,
  options?: {
    prompt?: string;
    turboMode?: boolean;
    resolution?: '720p' | '1080p';
  }
): Promise<{ success: boolean; videoUrl?: string; duration?: number; error?: string }> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  
  if (!FAL_API_KEY) {
    logger.error(`❌ [OMNIHUMAN] FAL_API_KEY no configurada`);
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    logger.log(`🎤 [OMNIHUMAN] Iniciando generación lipsync+body...`);
    logger.log(`   🖼️ Artist image: ${artistImageUrl.substring(0, 60)}...`);
    logger.log(`   🎧 Audio: ${audioUrl.substring(0, 60)}...`);

    const submitResponse = await fetch('https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: artistImageUrl,
        audio_url: audioUrl,
        prompt: options?.prompt || 'Professional music artist singing performance, natural body movement',
        turbo_mode: options?.turboMode ?? false,
        resolution: options?.resolution || '720p'
      })
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      logger.error(`❌ [OMNIHUMAN] Submit error:`, errorData);
      return { success: false, error: `OmniHuman submit failed: ${submitResponse.status}` };
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;
    logger.log(`⏳ [OMNIHUMAN] Request enviado: ${requestId}`);

    // Poll for completion (max 5 minutes)
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );

      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const videoUrl = resultData.video?.url || resultData.video_url;
        const duration = resultData.duration;

        if (videoUrl) {
          logger.log(`✅ [OMNIHUMAN] Video generado: ${videoUrl.substring(0, 60)}... (${duration}s)`);
          return { success: true, videoUrl, duration };
        }
      } else if (statusData.status === 'FAILED') {
        logger.error(`❌ [OMNIHUMAN] Request failed:`, statusData);
        return { success: false, error: 'OmniHuman processing failed' };
      }

      logger.log(`⏳ [OMNIHUMAN] Processing... (${i + 1}/${maxAttempts})`);
    }

    return { success: false, error: 'OmniHuman timeout' };

  } catch (error: any) {
    logger.error(`❌ [OMNIHUMAN] Error:`, error);
    return { success: false, error: error.message };
  }
}

export default {
  downloadPerformanceVideo,
  uploadVideoSegmentToFirebase,
  generateMotionTransferVideo,
  generateOmniHumanVideo
};
