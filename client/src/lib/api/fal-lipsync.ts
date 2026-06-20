import { logger } from "../logger";
/**
 * FAL AI Lip-Sync Service
 * Sincroniza videos generados con audio para crear movimiento de labios realista
 * Usa Sync Lipsync v3 (SOTA) — native visual intelligence, calidad profesional
 */

interface LipSyncOptions {
  videoUrl: string;
  audioUrl: string;
  syncMode?: 'cut_off' | 'loop' | 'bounce' | 'silence' | 'remap';
  webhookUrl?: string;
}

interface LipSyncResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  requestId?: string;
}

/**
 * Aplica lip-sync a un video usando el audio original de la canción
 * Esto asegura que el artista cante sincronizado con la música
 * 
 * @param options - Configuración del lip-sync
 * @returns Promise con el video sincronizado
 */
export async function applyLipSync(options: LipSyncOptions): Promise<LipSyncResult> {
  try {
    logger.info('🎤 Iniciando lip-sync con Sync Lipsync v3 (SOTA)...');
    logger.info('📹 Video:', options.videoUrl.substring(0, 50));
    logger.info('🎵 Audio:', options.audioUrl.substring(0, 50));
    
    const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY;
    
    if (!FAL_API_KEY) {
      logger.error('❌ FAL_API_KEY no configurada');
      return {
        success: false,
        error: 'FAL_API_KEY no está configurada. Por favor configura la API key en las variables de entorno.'
      };
    }
    
    // Submit job a la cola de FAL AI
    const submitResponse = await fetch('https://queue.fal.run/fal-ai/sync-lipsync/v3', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: options.videoUrl,
        audio_url: options.audioUrl,
        sync_mode: options.syncMode || 'cut_off'
      })
    });
    
    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      logger.error('❌ Error submitting lip-sync job:', errorData);
      return {
        success: false,
        error: `Error submitting lip-sync: ${submitResponse.statusText}`
      };
    }
    
    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;
    
    logger.info(`⏳ Lip-sync job submitted: ${requestId}`);
    logger.info('🔄 Esperando resultado...');
    
    // Poll para obtener el resultado
    let attempts = 0;
    const maxAttempts = 60; // 5 minutos máximo (cada 5 segundos)
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Esperar 5 segundos
      
      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/sync-lipsync/v3/requests/${requestId}/status`,
        {
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`
          }
        }
      );
      
      if (!statusResponse.ok) {
        logger.error('❌ Error checking status');
        attempts++;
        continue;
      }
      
      const statusData = await statusResponse.json();
      
      if (statusData.status === 'COMPLETED') {
        // Obtener el resultado
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/sync-lipsync/v3/requests/${requestId}`,
          {
            headers: {
              'Authorization': `Key ${FAL_API_KEY}`
            }
          }
        );
        
        if (!resultResponse.ok) {
          return {
            success: false,
            error: 'Error retrieving lip-sync result'
          };
        }
        
        const resultData = await resultResponse.json();
        
        logger.info('✅ Lip-sync completado exitosamente!');
        
        return {
          success: true,
          videoUrl: resultData.video?.url || resultData.output?.video?.url,
          requestId
        };
      }
      
      if (statusData.status === 'FAILED') {
        logger.error('❌ Lip-sync job failed:', statusData.error);
        return {
          success: false,
          error: statusData.error || 'Lip-sync processing failed'
        };
      }
      
      // IN_QUEUE o IN_PROGRESS
      logger.info(`⏳ Status: ${statusData.status} (attempt ${attempts + 1}/${maxAttempts})`);
      attempts++;
    }
    
    return {
      success: false,
      error: 'Lip-sync timeout - processing took too long'
    };
    
  } catch (error) {
    logger.error('❌ Error en applyLipSync:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error applying lip-sync'
    };
  }
}

/**
 * Procesa múltiples videos en batch con lip-sync
 * Útil para aplicar lip-sync a todas las escenas de un video musical
 */
export async function batchLipSync(
  videos: Array<{ videoUrl: string; audioUrl: string; sceneId: string }>
): Promise<Map<string, LipSyncResult>> {
  logger.info(`🎬 Procesando ${videos.length} videos con lip-sync...`);
  
  const results = new Map<string, LipSyncResult>();
  
  // Procesar videos secuencialmente para no sobrecargar la API
  for (const video of videos) {
    logger.info(`🎤 Procesando escena ${video.sceneId}...`);
    
    const result = await applyLipSync({
      videoUrl: video.videoUrl,
      audioUrl: video.audioUrl,
      syncMode: 'cut_off'
    });
    
    results.set(video.sceneId, result);
    
    if (result.success) {
      logger.info(`✅ Escena ${video.sceneId} sincronizada`);
    } else {
      logger.error(`❌ Error en escena ${video.sceneId}:`, result.error);
    }
    
    // Pequeño delay entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  logger.info(`🎉 Batch lip-sync completado: ${results.size} escenas procesadas`);
  
  return results;
}
