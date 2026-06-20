/**
 * 🎤 PixVerse Lipsync Service - MAESTRO INTEGRATION
 * Video-to-video lipsync using fal-ai/pixverse/lipsync model
 * 
 * ✅ IDEAL PARA: Escenas de PERFORMANCE donde el artista canta
 * ❌ NO USAR EN: B-roll, story scenes sin vocalización
 * 
 * Costo: $0.04/segundo de video
 * Max video duration: ~30 segundos
 * 
 * Input:
 *   - video_url: URL del video con el artista (generado por Kling O1)
 *   - audio_url: Segmento de audio correspondiente a esa escena
 * 
 * Output:
 *   - video.url: Video con labios sincronizados
 */

import { logger } from "../logger";

// Constantes del modelo
const PIXVERSE_LIPSYNC_MODEL = 'fal-ai/pixverse/lipsync';
const COST_PER_SECOND = 0.04; // USD por segundo de video
const MAX_POLL_ATTEMPTS = 120; // 10 minutos máximo (cada 5 segundos)
const POLL_INTERVAL_MS = 5000;

export interface PixVerseLipsyncOptions {
  videoUrl: string;
  audioUrl: string;
  // El audio_url es requerido para lip-sync de música
  // Si no se proporciona, PixVerse usaría TTS que NO queremos
}

export interface PixVerseLipsyncResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  requestId?: string;
  processingTime?: number; // ms
  estimatedCost?: number; // USD
}

/**
 * 🎤 Aplica lip-sync a un video usando PixVerse
 * El artista en el video moverá los labios sincronizado con el audio
 * 
 * IMPORTANTE: 
 * - El video debe tener una cara claramente visible (close-up, medium shot)
 * - El audio debe ser el segmento correspondiente a ese clip
 * 
 * @param options - video_url y audio_url
 * @returns Video con labios sincronizados
 */
export async function applyPixVerseLipsync(
  options: PixVerseLipsyncOptions
): Promise<PixVerseLipsyncResult> {
  const startTime = Date.now();
  
  try {
    logger.info('🎤 [PIXVERSE] Iniciando lip-sync con PixVerse...');
    logger.info(`📹 Video: ${options.videoUrl.substring(0, 80)}...`);
    logger.info(`🎵 Audio: ${options.audioUrl.substring(0, 80)}...`);
    
    const FAL_API_KEY = import.meta.env.VITE_FAL_API_KEY;
    
    if (!FAL_API_KEY) {
      logger.error('❌ [PIXVERSE] FAL_API_KEY no configurada');
      return {
        success: false,
        error: 'FAL_API_KEY no está configurada. Configura la API key en las variables de entorno.'
      };
    }
    
    // === PASO 1: Submit job a la cola de FAL ===
    const submitResponse = await fetch(`https://queue.fal.run/${PIXVERSE_LIPSYNC_MODEL}`, {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: options.videoUrl,
        audio_url: options.audioUrl
        // NO usamos voice_id ni text porque queremos audio real, no TTS
      })
    });
    
    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('❌ [PIXVERSE] Error submitting job:', errorData);
      return {
        success: false,
        error: `Error submitting PixVerse lipsync: ${errorData.error || submitResponse.statusText}`
      };
    }
    
    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;
    
    logger.info(`⏳ [PIXVERSE] Job submitted: ${requestId}`);
    
    // === PASO 2: Poll para resultado ===
    let attempts = 0;
    
    while (attempts < MAX_POLL_ATTEMPTS) {
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      
      const statusResponse = await fetch(
        `https://queue.fal.run/${PIXVERSE_LIPSYNC_MODEL}/requests/${requestId}/status`,
        {
          headers: {
            'Authorization': `Key ${FAL_API_KEY}`
          }
        }
      );
      
      if (!statusResponse.ok) {
        logger.warn(`⚠️ [PIXVERSE] Error checking status (attempt ${attempts + 1})`);
        attempts++;
        continue;
      }
      
      const statusData = await statusResponse.json();
      
      // === COMPLETED ===
      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/${PIXVERSE_LIPSYNC_MODEL}/requests/${requestId}`,
          {
            headers: {
              'Authorization': `Key ${FAL_API_KEY}`
            }
          }
        );
        
        if (!resultResponse.ok) {
          return {
            success: false,
            error: 'Error retrieving PixVerse lipsync result',
            requestId
          };
        }
        
        const resultData = await resultResponse.json();
        const videoUrl = resultData.video?.url;
        
        if (!videoUrl) {
          logger.error('❌ [PIXVERSE] No video URL in response:', resultData);
          return {
            success: false,
            error: 'No video URL returned by PixVerse',
            requestId
          };
        }
        
        const processingTime = Date.now() - startTime;
        
        logger.info(`✅ [PIXVERSE] Lip-sync completado en ${Math.round(processingTime / 1000)}s`);
        logger.info(`🎥 Output: ${videoUrl.substring(0, 80)}...`);
        
        return {
          success: true,
          videoUrl,
          requestId,
          processingTime
        };
      }
      
      // === FAILED ===
      if (statusData.status === 'FAILED') {
        logger.error('❌ [PIXVERSE] Job failed:', statusData.error);
        return {
          success: false,
          error: statusData.error || 'PixVerse processing failed',
          requestId
        };
      }
      
      // === IN_QUEUE o IN_PROGRESS ===
      if (attempts % 12 === 0) { // Log cada minuto
        logger.info(`⏳ [PIXVERSE] Status: ${statusData.status} (${Math.round((attempts * POLL_INTERVAL_MS) / 1000)}s elapsed)`);
      }
      
      attempts++;
    }
    
    // Timeout
    return {
      success: false,
      error: 'PixVerse lipsync timeout - processing took too long (10+ min)',
      requestId,
      processingTime: Date.now() - startTime
    };
    
  } catch (error) {
    logger.error('❌ [PIXVERSE] Error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error in PixVerse lipsync',
      processingTime: Date.now() - startTime
    };
  }
}

/**
 * 🎬 Procesa múltiples escenas de PERFORMANCE con lip-sync
 * 
 * @param scenes - Array de escenas con video y audio URLs
 * @param onProgress - Callback para reportar progreso
 * @returns Map de resultados por sceneId
 */
export async function batchPixVerseLipsync(
  scenes: Array<{
    sceneId: number;
    videoUrl: string;
    audioUrl: string;
    duration: number;
  }>,
  onProgress?: (current: number, total: number, sceneId: number, status: string) => void
): Promise<Map<number, PixVerseLipsyncResult>> {
  const results = new Map<number, PixVerseLipsyncResult>();
  const total = scenes.length;
  
  // Calcular costo estimado
  const totalDuration = scenes.reduce((acc, s) => acc + s.duration, 0);
  const estimatedCost = totalDuration * COST_PER_SECOND;
  
  logger.info(`🎬 [PIXVERSE BATCH] Procesando ${total} escenas de performance`);
  logger.info(`💰 Costo estimado: $${estimatedCost.toFixed(2)} (${totalDuration}s total @ $${COST_PER_SECOND}/s)`);
  
  // Procesar SECUENCIALMENTE para no saturar la API
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const current = i + 1;
    
    logger.info(`🎤 [PIXVERSE ${current}/${total}] Procesando escena ${scene.sceneId}...`);
    onProgress?.(current, total, scene.sceneId, 'processing');
    
    const result = await applyPixVerseLipsync({
      videoUrl: scene.videoUrl,
      audioUrl: scene.audioUrl
    });
    
    // Agregar costo estimado
    result.estimatedCost = scene.duration * COST_PER_SECOND;
    
    results.set(scene.sceneId, result);
    
    if (result.success) {
      logger.info(`✅ [PIXVERSE ${current}/${total}] Escena ${scene.sceneId} sincronizada`);
      onProgress?.(current, total, scene.sceneId, 'completed');
    } else {
      logger.error(`❌ [PIXVERSE ${current}/${total}] Error en escena ${scene.sceneId}:`, result.error);
      onProgress?.(current, total, scene.sceneId, 'failed');
    }
    
    // Delay entre escenas para no saturar
    if (i < scenes.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Resumen final
  const successful = Array.from(results.values()).filter(r => r.success).length;
  const actualCost = Array.from(results.values())
    .filter(r => r.success)
    .reduce((acc, r) => acc + (r.estimatedCost || 0), 0);
  
  logger.info(`🎉 [PIXVERSE BATCH] Completado: ${successful}/${total} escenas`);
  logger.info(`💰 Costo real: ~$${actualCost.toFixed(2)}`);
  
  return results;
}

/**
 * 🎯 Determina si una escena es candidata para lip-sync
 * Usa los campos del script/timeline para decidir
 * 
 * CRITERIA:
 * 1. shotCategory === 'PERFORMANCE' (del script)
 * 2. O tiene shot_type close-up/medium y es escena de cantando
 * 3. useArtistReference !== false
 */
export function isLipsyncCandidate(scene: {
  shotCategory?: string;
  shotType?: string;
  useArtistReference?: boolean;
  referenceUsage?: string;
  description?: string;
}): boolean {
  // 1. Criterio principal: shotCategory del script
  if (scene.shotCategory === 'PERFORMANCE') {
    return true;
  }
  
  // 2. Si explícitamente no usar referencia, no es candidato
  if (scene.useArtistReference === false) {
    return false;
  }
  
  // 3. Criterio secundario: shot type compatible
  const shotType = (scene.shotType || '').toLowerCase();
  const validShots = ['cu', 'ecu', 'mcu', 'ms', 'close', 'medium'];
  const excludedShots = ['ws', 'ews', 'wide', 'full', 'long', 'establishing'];
  
  // Excluir shots amplios
  if (excludedShots.some(ex => shotType.includes(ex))) {
    return false;
  }
  
  // Incluir shots cercanos
  if (validShots.some(v => shotType.includes(v))) {
    // Verificar contexto de performance en description
    const desc = (scene.description || '').toLowerCase();
    const performanceWords = ['sing', 'perform', 'vocal', 'lip', 'mouth'];
    if (performanceWords.some(w => desc.includes(w))) {
      return true;
    }
  }
  
  return false;
}

/**
 * 🔧 Helper: Estima el costo de lip-sync para un conjunto de escenas
 */
export function estimateLipsyncCost(scenes: Array<{ duration: number }>): {
  totalSeconds: number;
  estimatedCost: number;
  costPerSecond: number;
} {
  const totalSeconds = scenes.reduce((acc, s) => acc + s.duration, 0);
  return {
    totalSeconds,
    estimatedCost: totalSeconds * COST_PER_SECOND,
    costPerSecond: COST_PER_SECOND
  };
}
