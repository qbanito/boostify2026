import { logger } from "../logger";
/**
 * FAL AI MuseTalk Service
 * Genera videos de animación facial (talking head) desde imagen + audio
 * Perfecto para crear clips de artistas cantando
 */

interface MuseTalkOptions {
  imageUrl: string;  // URL de la imagen del artista
  audioUrl: string;  // URL del audio (segmento cortado)
  bbox_shift?: number; // Ajuste del bounding box (default: 5)
  webhookUrl?: string;
}

interface MuseTalkResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  requestId?: string;
  processingTime?: number;
}

/**
 * Genera un video de talking head usando MuseTalk
 * AHORA USA EL BACKEND para seguridad (credenciales no expuestas)
 * 
 * @param options - Configuración de MuseTalk
 * @returns Promise con el video generado
 */
export async function generateTalkingHead(options: MuseTalkOptions): Promise<MuseTalkResult> {
  try {
    logger.info('🎭 Iniciando MuseTalk (Image-to-Video Lip-Sync via Backend)...');
    logger.info('🖼️ Imagen:', options.imageUrl.substring(0, 60));
    logger.info('🎵 Audio:', options.audioUrl.substring(0, 60));
    
    const startTime = Date.now();
    
    // Llamar al backend en lugar de FAL directamente
    const response = await fetch('/api/fal/musetalk', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        imageUrl: options.imageUrl,
        audioUrl: options.audioUrl,
        bbox_shift: options.bbox_shift || 5
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      logger.error('❌ Error from backend:', errorData);
      return {
        success: false,
        error: errorData.error || 'Error from backend'
      };
    }
    
    const result = await response.json();
    const processingTime = (Date.now() - startTime) / 1000;
    
    if (result.success) {
      logger.info(`✅ MuseTalk completado en ${processingTime.toFixed(1)}s!`);
    }
    
    return result;
    
  } catch (error) {
    logger.error('❌ Error en generateTalkingHead:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Procesa múltiples segmentos en batch
 * Ideal para generar todos los clips de performance de una canción
 */
export async function batchGenerateTalkingHeads(
  segments: Array<{
    id: string;
    imageUrl: string;
    audioUrl: string;
  }>
): Promise<Map<string, MuseTalkResult>> {
  logger.info(`🎬 Generando ${segments.length} talking heads...`);
  
  const results = new Map<string, MuseTalkResult>();
  
  // Procesar secuencialmente para no sobrecargar la API
  for (const segment of segments) {
    logger.info(`🎭 Procesando segmento ${segment.id}...`);
    
    const result = await generateTalkingHead({
      imageUrl: segment.imageUrl,
      audioUrl: segment.audioUrl
    });
    
    results.set(segment.id, result);
    
    if (result.success) {
      logger.info(`✅ Segmento ${segment.id} completado`);
    } else {
      logger.error(`❌ Error en segmento ${segment.id}:`, result.error);
    }
    
    // Pequeño delay entre requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  logger.info(`🎉 Batch completado: ${results.size} segmentos procesados`);
  
  return results;
}
