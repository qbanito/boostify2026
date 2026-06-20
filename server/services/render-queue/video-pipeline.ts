/**
 * 🎬 Video Pipeline Service
 * Pipeline completo: Imágenes → Videos con Lipsync → Render Final
 */

import { logger } from '../../utils/logger';
import { 
  updateQueueProgress, 
  markAsCompleted, 
  markAsFailed,
  getNextPendingItem 
} from './queue-manager';
import { startVideoRender, checkRenderStatus } from '../video-rendering/shotstack-service';
import { uploadVideoToFirebaseStorage } from '../video-upload-firebase';
import { cutAudioSegmentFromUrl, uploadAudioSegmentToFirebase } from '../audio-segment-service';
import { generateMotionTransferVideo, generateOmniHumanVideo } from '../video-segment-service';
import { db } from '../../db';
import { renderQueue, musicVideoProjects } from '../../db/schema';
import { eq } from 'drizzle-orm';

// Constantes de configuración
const CLIP_DURATION = 3; // segundos por clip
const LIPSYNC_TIMEOUT = 120000; // 2 minutos timeout para lipsync
const RENDER_POLL_INTERVAL = 5000; // 5 segundos entre checks
const MAX_RENDER_WAIT = 600000; // 10 minutos máximo de espera
const MAX_KLING_DURATION = 5; // Kling soporta máximo 5 segundos

interface TimelineClip {
  id: string;
  imageUrl?: string;
  videoUrl?: string;
  generatedVideo?: string;
  start_time: number;
  duration: number;
  shotCategory?: 'PERFORMANCE' | 'B-ROLL' | 'STORY';
  hasLipsync?: boolean;
  audioSegmentUrl?: string; // URL del segmento de audio cortado para lipsync
  lipsyncVideoUrl?: string; // URL del video con lipsync ya aplicado
  motionVideoUrl?: string; // 🎭 URL del video con motion transfer (DreamActor v2)
}

interface PipelineResult {
  success: boolean;
  videoUrl?: string;
  firebaseUrl?: string;
  error?: string;
}

/**
 * 🎤 PRE-PROCESO: Generar audioSegmentUrl para clips PERFORMANCE que no lo tienen
 * Esta función asegura que todos los clips de PERFORMANCE tengan su segmento de audio
 */
async function ensureAudioSegmentsForPerformanceClips(
  clips: TimelineClip[],
  audioUrl: string,
  userEmail: string,
  projectId: string
): Promise<TimelineClip[]> {
  logger.log(`🎤 [AUDIO-SEGMENTS] Verificando audioSegmentUrl para clips PERFORMANCE...`);
  
  const performanceClips = clips.filter(c => c.shotCategory === 'PERFORMANCE' && !c.audioSegmentUrl && !c.lipsyncVideoUrl);
  
  if (performanceClips.length === 0) {
    logger.log(`✅ [AUDIO-SEGMENTS] Todos los clips PERFORMANCE ya tienen audioSegmentUrl o lipsyncVideoUrl`);
    return clips;
  }
  
  logger.log(`🎤 [AUDIO-SEGMENTS] ${performanceClips.length} clips PERFORMANCE necesitan audioSegmentUrl`);
  
  // Procesar cada clip que necesita segmento
  for (const clip of performanceClips) {
    try {
      logger.log(`   ✂️ Cortando audio para clip ${clip.id}: ${clip.start_time}s - ${clip.start_time + clip.duration}s`);
      
      // Cortar el segmento de audio
      const segmentResult = await cutAudioSegmentFromUrl(
        audioUrl,
        clip.start_time,
        clip.start_time + clip.duration
      );
      
      if (segmentResult.success && segmentResult.audioBlob) {
        // Subir a Firebase
        const uploadResult = await uploadAudioSegmentToFirebase(
          segmentResult.audioBlob,
          userEmail,
          projectId,
          clip.id
        );
        
        if (uploadResult.success && uploadResult.url) {
          clip.audioSegmentUrl = uploadResult.url;
          logger.log(`   ✅ Audio segment subido: ${uploadResult.url.substring(0, 60)}...`);
        } else {
          logger.warn(`   ⚠️ Error subiendo audio segment para clip ${clip.id}: ${uploadResult.error}`);
        }
      } else {
        logger.warn(`   ⚠️ Error cortando audio para clip ${clip.id}: ${segmentResult.error}`);
      }
    } catch (error: any) {
      logger.error(`   ❌ Error procesando audio para clip ${clip.id}:`, error.message);
    }
  }
  
  const processedCount = clips.filter(c => c.shotCategory === 'PERFORMANCE' && c.audioSegmentUrl).length;
  logger.log(`🎤 [AUDIO-SEGMENTS] ${processedCount} clips PERFORMANCE ahora tienen audioSegmentUrl`);
  
  return clips;
}

/**
 * Procesar un item de la cola
 * Este es el entry point principal del pipeline
 */
export async function processQueueItem(queueId: number): Promise<PipelineResult> {
  logger.log(`🎬 [PIPELINE] Iniciando procesamiento de queue ${queueId}...`);

  try {
    // 1. Obtener datos de la cola
    const [queueItem] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.id, queueId));

    if (!queueItem) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    let timelineData = queueItem.timelineData as TimelineClip[] || [];
    const totalClips = timelineData.length || 10;

    // 2. Actualizar estado a "generating_videos"
    await updateQueueProgress(queueId, {
      status: 'generating_videos',
      currentStep: 'Pre-procesando clips PERFORMANCE...',
      progress: 5
    });

    // 2.5 🔧 PRE-PROCESO: Asegurar audioSegmentUrl para todos los clips PERFORMANCE
    // Esto resuelve el problema crítico de clips sin audio antes del pipeline
    const audioUrl = queueItem.audioUrl; // URL del audio completo
    if (audioUrl) {
      const userEmail = queueItem.email || 'anonymous';
      const projectId = queueItem.id.toString();
      timelineData = await ensureAudioSegmentsForPerformanceClips(
        timelineData,
        audioUrl,
        userEmail,
        projectId
      );
      logger.log(`✅ [PIPELINE] Pre-procesamiento completado: ${timelineData.filter(c => c.audioSegmentUrl).length} clips con audioSegmentUrl`);
    } else {
      logger.warn(`⚠️ [PIPELINE] No hay audioUrl en queueItem, no se pueden generar segments`);
    }

    await updateQueueProgress(queueId, {
      currentStep: 'Convirtiendo imágenes a video...',
      progress: 10
    });

    // 3. Procesar cada clip (convertir imágenes a video)
    const processedClips: Array<{
      id: string;
      videoUrl: string;
      start: number;
      duration: number;
      requiresLoop?: boolean; // 🔧 FIX: Para clips > 5s que necesitan loop
      actualDuration?: number; // Duración real del video generado
    }> = [];

    for (let i = 0; i < timelineData.length; i++) {
      const clip = timelineData[i];
      const clipIndex = i + 1;

      await updateQueueProgress(queueId, {
        currentStep: `Procesando clip ${clipIndex}/${totalClips}...`,
        progress: 10 + Math.round((i / totalClips) * 40), // 10-50%
        processedClips: i
      });

      try {
        // Determinar qué URL usar para el video
        let videoUrl: string | undefined = clip.videoUrl || clip.generatedVideo || undefined;
        let requiresLoop = false;
        let actualDuration = clip.duration || CLIP_DURATION;

        // Si es PERFORMANCE y no tiene video, necesita lipsync
        if (!videoUrl && clip.imageUrl && clip.shotCategory === 'PERFORMANCE') {
          // 🎤 PERFORMANCE: Usar audioSegmentUrl del clip (ya cortado y subido a Firebase)
          // Si ya tiene lipsyncVideoUrl, usarlo directamente
          if (clip.lipsyncVideoUrl) {
            videoUrl = clip.lipsyncVideoUrl;
            logger.log(`✅ [PIPELINE] Clip ${clipIndex} ya tiene lipsync: ${videoUrl.substring(0, 60)}...`);
          } else if (clip.motionVideoUrl) {
            // 🎭 Ya tiene motion transfer aplicado
            videoUrl = clip.motionVideoUrl;
            logger.log(`✅ [PIPELINE] Clip ${clipIndex} ya tiene motion transfer: ${videoUrl.substring(0, 60)}...`);
          } else if (queueItem.performanceVideoUrl && clip.imageUrl) {
            // 🎭 MOTION TRANSFER: Usar DreamActor v2 con el video de performance del artista
            logger.log(`🎭 [PIPELINE] Clip ${clipIndex} PERFORMANCE - usando DreamActor v2 motion transfer`);
            const motionResult = await generateMotionTransferVideo(
              clip.imageUrl,
              queueItem.performanceVideoUrl,
              { trimFirstSecond: true }
            );
            if (motionResult.success && motionResult.videoUrl) {
              videoUrl = motionResult.videoUrl;
              logger.log(`✅ [PIPELINE] Motion transfer completado para clip ${clipIndex}`);
            } else {
              // Fallback: intentar OmniHuman con audio
              logger.warn(`⚠️ [PIPELINE] DreamActor falló para clip ${clipIndex}, fallback a lipsync...`);
              if (clip.audioSegmentUrl) {
                const omniResult = await generateOmniHumanVideo(
                  clip.imageUrl,
                  clip.audioSegmentUrl,
                  { prompt: queueItem.artistName ? `${queueItem.artistName} singing performance` : undefined }
                );
                if (omniResult.success && omniResult.videoUrl) {
                  videoUrl = omniResult.videoUrl;
                  logger.log(`✅ [PIPELINE] OmniHuman fallback exitoso para clip ${clipIndex}`);
                }
              }
            }
          } else if (clip.audioSegmentUrl) {
            // Generar lipsync con el segmento de audio específico de este clip
            logger.log(`🎤 [PIPELINE] Clip ${clipIndex} PERFORMANCE - usando audioSegmentUrl`);
            const lipsyncResult = await generateLipsyncVideo(
              clip.imageUrl,
              clip.audioSegmentUrl, // ✅ CORRECTO: usar segmento, no audio completo
              clip.start_time,
              clip.duration || CLIP_DURATION,
              queueItem.artistName // 🎭 FACE CONSISTENCY: Pass artist name for enriched Kling prompt
            );
            if (lipsyncResult) {
              videoUrl = lipsyncResult.videoUrl;
              requiresLoop = lipsyncResult.requiresLoop;
              actualDuration = lipsyncResult.actualDuration;
              
              if (requiresLoop) {
                logger.log(`🔁 [PIPELINE] Clip ${clipIndex} requiere loop: ${actualDuration}s → ${clip.duration || CLIP_DURATION}s`);
              }
            }
          } else {
            logger.warn(`⚠️ [PIPELINE] Clip ${clipIndex} PERFORMANCE sin audioSegmentUrl, saltando lipsync`);
          }
        }

        // Si aún no tiene video, usar imagen como video estático
        if (!videoUrl && clip.imageUrl) {
          videoUrl = clip.imageUrl; // Shotstack puede usar imágenes directamente
        }

        if (videoUrl) {
          processedClips.push({
            id: clip.id,
            videoUrl,
            start: clip.start_time || (i * CLIP_DURATION),
            duration: clip.duration || CLIP_DURATION,
            requiresLoop,
            actualDuration
          });
        }

      } catch (clipError: any) {
        logger.error(`❌ [PIPELINE] Error procesando clip ${clipIndex}:`, clipError);
        // Continuar con los demás clips
        if (clip.imageUrl) {
          processedClips.push({
            id: clip.id,
            videoUrl: clip.imageUrl,
            start: clip.start_time || (i * CLIP_DURATION),
            duration: clip.duration || CLIP_DURATION
          });
        }
      }
    }

    // 4. Actualizar estado a "rendering"
    await updateQueueProgress(queueId, {
      status: 'rendering',
      currentStep: 'Renderizando video final...',
      progress: 55,
      processedClips: totalClips
    });

    // 5. Preparar clips para Shotstack
    const shotstackClips = processedClips.map(clip => ({
      id: clip.id,
      imageUrl: clip.videoUrl, // Shotstack acepta tanto videos como imágenes
      videoUrl: clip.videoUrl.includes('.mp4') ? clip.videoUrl : undefined,
      start: clip.start,
      duration: clip.duration,
      transition: 'fade' as const,
      // 🔧 FIX: Para clips > 5s, indicar que el video debe hacer loop
      loop: clip.requiresLoop || false,
      // Si requiere loop, Shotstack repetirá el video hasta cubrir la duración
      // Ejemplo: video de 5s con duration 8s = 1.6 loops automáticos
    }));

    // Log de clips con loop
    const loopClips = shotstackClips.filter(c => c.loop);
    if (loopClips.length > 0) {
      logger.log(`🔁 [PIPELINE] ${loopClips.length} clips requieren loop para cubrir duración completa`);
    }

    // 6. Iniciar renderizado con Shotstack
    const renderResult = await startVideoRender({
      clips: shotstackClips,
      audioUrl: queueItem.audioUrl || undefined,
      audioDuration: queueItem.audioDuration ? parseFloat(queueItem.audioDuration) : undefined,
      resolution: '1080p',
      fps: 30,
      quality: 'high',
      aspectRatio: (queueItem.aspectRatio || '16:9') as any
    });

    if (!renderResult.success || !renderResult.renderId) {
      throw new Error(renderResult.error || 'Failed to start Shotstack render');
    }

    logger.log(`📹 [PIPELINE] Renderizado iniciado: ${renderResult.renderId}`);

    // Guardar el render ID
    await db.update(renderQueue)
      .set({
        shotstackRenderId: renderResult.renderId,
        updatedAt: new Date()
      })
      .where(eq(renderQueue.id, queueId));

    // 7. Esperar a que el renderizado termine
    await updateQueueProgress(queueId, {
      currentStep: 'Esperando renderizado...',
      progress: 70
    });

    const finalVideoUrl = await waitForRender(renderResult.renderId, queueId);

    if (!finalVideoUrl) {
      throw new Error('Render failed or timed out');
    }

    // 8. Subir a Firebase
    await updateQueueProgress(queueId, {
      status: 'uploading',
      currentStep: 'Subiendo video a la nube...',
      progress: 90
    });

    const firebaseResult = await uploadVideoToFirebaseStorage(
      finalVideoUrl,
      queueItem.userEmail,
      String(queueItem.projectId)
    );

    if (!firebaseResult.success || !firebaseResult.firebaseUrl) {
      logger.warn(`⚠️ [PIPELINE] Error subiendo a Firebase, usando URL de Shotstack`);
    }

    const firebaseUrl = firebaseResult.firebaseUrl || finalVideoUrl;

    // 9. Marcar como completado
    await markAsCompleted(queueId, finalVideoUrl, firebaseUrl);

    logger.log(`✅ [PIPELINE] Video completado: ${firebaseUrl}`);

    return {
      success: true,
      videoUrl: finalVideoUrl,
      firebaseUrl
    };

  } catch (error: any) {
    logger.error(`❌ [PIPELINE] Error en pipeline:`, error);
    
    await markAsFailed(queueId, error.message, 'pipeline');
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generar video con lipsync usando PixVerse
 * FLUJO: Imagen → Video (Kling) → Lipsync (PixVerse)
 * 
 * PixVerse requiere VIDEO (MP4/MOV), no imagen
 */
async function generateLipsyncVideo(
  imageUrl: string,
  audioUrl: string,
  startTime: number,
  duration: number,
  artistDescription?: string
): Promise<{ videoUrl: string; requiresLoop: boolean; actualDuration: number } | null> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  
  if (!FAL_API_KEY) {
    logger.error(`❌ [LIPSYNC] FAL_API_KEY no configurada`);
    return null;
  }

  // 🔧 FIX: Manejar clips > 5 segundos
  const requiresLoop = duration > MAX_KLING_DURATION;
  const klingDuration = Math.min(duration, MAX_KLING_DURATION);
  
  if (requiresLoop) {
    logger.log(`⚠️ [LIPSYNC] Clip de ${duration}s > ${MAX_KLING_DURATION}s, generando ${klingDuration}s con loop habilitado`);
  }

  try {
    // ====== PASO 1: Convertir imagen a video con Kling v2.5 Turbo Pro ======
    logger.log(`🎬 [LIPSYNC] Paso 1: Convirtiendo imagen a video con Kling v2.5 Turbo Pro...`);
    logger.log(`🖼️ [LIPSYNC] Imagen: ${imageUrl.substring(0, 60)}...`);
    logger.log(`🎧 [LIPSYNC] Audio segmento: ${audioUrl.substring(0, 60)}...`);
    logger.log(`⏱️ [LIPSYNC] Duración solicitada: ${duration}s, Kling generará: ${klingDuration}s`);
    
    const klingResponse = await fetch('https://queue.fal.run/fal-ai/kling-video/v2.5-turbo/pro/image-to-video', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: artistDescription 
          ? `${artistDescription} singing with natural mouth movement, subtle head motion, maintaining exact facial identity and features, professional music video style`
          : "Artist singing with natural mouth movement, subtle head motion, maintaining exact facial identity and features from the image, professional music video style",
        duration: klingDuration, // 🔧 Usar la duración calculada
        aspect_ratio: "16:9"
      })
    });

    if (!klingResponse.ok) {
      const errorData = await klingResponse.json().catch(() => ({}));
      logger.error(`❌ [LIPSYNC] Kling error:`, errorData);
      return null;
    }

    const klingData = await klingResponse.json();
    const klingRequestId = klingData.request_id;
    logger.log(`⏳ [LIPSYNC] Kling request enviado: ${klingRequestId}`);

    // Esperar a que Kling termine (polling)
    let videoUrl: string | null = null;
    const maxAttempts = 60; // 5 minutos máximo
    
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 5 segundos entre checks
      
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/kling-video/requests/${klingRequestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'COMPLETED') {
        // Obtener resultado
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/kling-video/requests/${klingRequestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        videoUrl = resultData.video?.url || resultData.video_url;
        logger.log(`✅ [LIPSYNC] Video de Kling listo: ${videoUrl?.substring(0, 60)}...`);
        break;
      } else if (statusData.status === 'FAILED') {
        logger.error(`❌ [LIPSYNC] Kling falló:`, statusData);
        return null;
      }
      
      logger.log(`⏳ [LIPSYNC] Kling procesando... (${i + 1}/${maxAttempts})`);
    }

    if (!videoUrl) {
      logger.error(`❌ [LIPSYNC] Timeout esperando Kling`);
      return null;
    }

    // ====== PASO 2: Aplicar lipsync con PixVerse ======
    logger.log(`🎤 [LIPSYNC] Paso 2: Aplicando lipsync con PixVerse...`);
    
    const pixverseResponse = await fetch('https://queue.fal.run/fal-ai/pixverse/lipsync', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: videoUrl,
        audio_url: audioUrl
        // No usamos voice_id ni text porque queremos el audio real
      })
    });

    if (!pixverseResponse.ok) {
      const errorData = await pixverseResponse.json().catch(() => ({}));
      logger.error(`❌ [LIPSYNC] PixVerse error:`, errorData);
      // Si PixVerse falla, retornar el video sin lipsync
      return { videoUrl, requiresLoop, actualDuration: klingDuration };
    }

    const pixverseData = await pixverseResponse.json();
    const pixverseRequestId = pixverseData.request_id;
    logger.log(`⏳ [LIPSYNC] PixVerse request enviado: ${pixverseRequestId}`);

    // Esperar a que PixVerse termine
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000));
      
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/pixverse/requests/${pixverseRequestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/pixverse/requests/${pixverseRequestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const lipsyncVideoUrl = resultData.video?.url || resultData.video_url;
        
        if (lipsyncVideoUrl) {
          logger.log(`✅ [LIPSYNC] Video con lipsync listo: ${lipsyncVideoUrl.substring(0, 60)}...`);
          return { videoUrl: lipsyncVideoUrl, requiresLoop, actualDuration: klingDuration };
        }
      } else if (statusData.status === 'FAILED') {
        logger.error(`❌ [LIPSYNC] PixVerse falló:`, statusData);
        // Si falla, retornar el video de Kling sin lipsync
        return { videoUrl, requiresLoop, actualDuration: klingDuration };
      }
    }

    // Si timeout, retornar video sin lipsync
    logger.warn(`⚠️ [LIPSYNC] Timeout en PixVerse, usando video sin lipsync`);
    return { videoUrl, requiresLoop, actualDuration: klingDuration };

  } catch (error: any) {
    logger.error(`❌ [LIPSYNC] Error:`, error);
    return null;
  }
}

/**
 * Esperar a que el renderizado de Shotstack termine
 */
async function waitForRender(renderId: string, queueId: number): Promise<string | null> {
  const startTime = Date.now();
  let lastProgress = 70;

  while (Date.now() - startTime < MAX_RENDER_WAIT) {
    try {
      const status = await checkRenderStatus(renderId);

      if (status.status === 'done' && status.url) {
        logger.log(`✅ [RENDER] Video listo: ${status.url}`);
        return status.url;
      }

      if (status.status === 'failed') {
        throw new Error(`Shotstack render failed: ${status.error || 'Unknown error'}`);
      }

      // Actualizar progreso estimado
      if (status.progress) {
        const newProgress = 70 + Math.round(status.progress * 0.2); // 70-90%
        if (newProgress > lastProgress) {
          lastProgress = newProgress;
          await updateQueueProgress(queueId, {
            progress: lastProgress,
            currentStep: `Renderizando (${status.progress}%)...`
          });
        }
      }

      // Esperar antes del siguiente check
      await new Promise(resolve => setTimeout(resolve, RENDER_POLL_INTERVAL));

    } catch (error: any) {
      logger.error(`❌ [RENDER] Error checking status:`, error);
      throw error;
    }
  }

  throw new Error('Render timed out after 10 minutes');
}

/**
 * Iniciar el procesador de cola (background worker)
 */
let isProcessing = false;
let processingInterval: NodeJS.Timeout | null = null;

export function startQueueProcessor(): void {
  if (processingInterval) {
    logger.warn(`⚠️ [PROCESSOR] Queue processor already running`);
    return;
  }

  logger.log(`🚀 [PROCESSOR] Starting queue processor...`);

  processingInterval = setInterval(async () => {
    if (isProcessing) return;

    try {
      const nextItem = await getNextPendingItem();
      
      if (nextItem) {
        isProcessing = true;
        logger.log(`📦 [PROCESSOR] Processing queue item ${nextItem.id}...`);
        
        await processQueueItem(nextItem.id);
        
        isProcessing = false;
      }

    } catch (error: any) {
      logger.error(`❌ [PROCESSOR] Error:`, error);
      isProcessing = false;
    }
  }, 10000); // Check every 10 seconds
}

export function stopQueueProcessor(): void {
  if (processingInterval) {
    clearInterval(processingInterval);
    processingInterval = null;
    logger.log(`⏹️ [PROCESSOR] Queue processor stopped`);
  }
}

export default {
  processQueueItem,
  startQueueProcessor,
  stopQueueProcessor
};
