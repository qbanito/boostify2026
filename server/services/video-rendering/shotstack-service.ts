/**
 * Shotstack Video Rendering Service
 * Combina múltiples clips de video con audio en un video final
 * 
 * Configuración:
 * - SHOTSTACK_API_KEY: API key de Shotstack
 * - SHOTSTACK_ENV: 'sandbox' (desarrollo) o 'production' (producción)
 * - SHOTSTACK_OWNER_ID: ID del propietario (opcional, para referencia)
 */

import axios from 'axios';
import { logger } from '../../utils/logger';

const SHOTSTACK_API_KEY = process.env.SHOTSTACK_API_KEY || '';
const SHOTSTACK_ENV = process.env.SHOTSTACK_ENV || 'sandbox'; // 'sandbox' o 'production'
const SHOTSTACK_OWNER_ID = process.env.SHOTSTACK_OWNER_ID || '';

// URL base según el entorno
const SHOTSTACK_API_URL = SHOTSTACK_ENV === 'production' 
  ? 'https://api.shotstack.io/v1'
  : 'https://api.shotstack.io/stage';

export interface TimelineClipData {
  id: string;
  videoUrl?: string;
  imageUrl?: string;
  start: number;
  duration: number;
  transition?: 'fade' | 'slide' | 'wipe' | 'none';
  loop?: boolean; // 🔧 FIX: Para clips > 5s que necesitan repetir el video
}

export interface RenderRequest {
  clips: TimelineClipData[];
  audioUrl?: string;
  audioDuration?: number;
  resolution?: '480p' | '720p' | '1080p' | '4k';
  fps?: 25 | 30 | 60;
  quality?: 'low' | 'medium' | 'high';
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface RenderResponse {
  success: boolean;
  renderId?: string;
  status?: 'queued' | 'processing' | 'done' | 'failed';
  url?: string;
  error?: string;
  progress?: number;
}

/**
 * Inicia el renderizado de un video usando Shotstack
 */
export async function startVideoRender(request: RenderRequest): Promise<RenderResponse> {
  try {
    if (!SHOTSTACK_API_KEY) {
      throw new Error('SHOTSTACK_API_KEY no está configurado');
    }

    logger.log(`🎬 [SHOTSTACK] Iniciando renderizado de video... (ENV: ${SHOTSTACK_ENV})`);
    logger.log(`📊 [SHOTSTACK] Clips: ${request.clips.length}, Audio: ${request.audioUrl ? 'Sí' : 'No'}`);
    logger.log(`🔗 [SHOTSTACK] API URL: ${SHOTSTACK_API_URL}`);

    // Construir el timeline de Shotstack
    const timeline = buildShotstackTimeline(request);

    // Configurar resolución basada en aspect ratio
    let outputSize: { width: number; height: number } | undefined;
    if (request.aspectRatio === '9:16') {
      outputSize = { width: 1080, height: 1920 }; // Vertical (TikTok/Reels)
    } else if (request.aspectRatio === '1:1') {
      outputSize = { width: 1080, height: 1080 }; // Cuadrado (Instagram)
    }
    // 16:9 usa la resolución por defecto

    // Configurar output
    const output: any = {
      format: 'mp4',
      resolution: request.resolution || '1080p',
      fps: request.fps || 30,
      quality: request.quality || 'high',
    };

    // Agregar size solo si no es 16:9
    if (outputSize) {
      output.size = outputSize;
    }

    const payload = {
      timeline,
      output,
    };

    logger.log('📤 [SHOTSTACK] Enviando request a Shotstack API...');

    // Enviar a Shotstack
    const response = await axios.post(
      `${SHOTSTACK_API_URL}/render`,
      payload,
      {
        headers: {
          'x-api-key': SHOTSTACK_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const renderId = response.data?.response?.id;

    if (!renderId) {
      throw new Error('No se recibió ID de renderizado de Shotstack');
    }

    logger.log(`✅ [SHOTSTACK] Renderizado iniciado: ${renderId}`);

    return {
      success: true,
      renderId,
      status: 'queued',
      progress: 0,
    };
  } catch (error: any) {
    logger.error('❌ [SHOTSTACK] Error iniciando renderizado:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Error desconocido',
    };
  }
}

/**
 * Verifica el estado de un renderizado en Shotstack
 */
export async function checkRenderStatus(renderId: string): Promise<RenderResponse> {
  try {
    if (!SHOTSTACK_API_KEY) {
      throw new Error('SHOTSTACK_API_KEY no está configurado');
    }

    logger.log(`🔍 [SHOTSTACK] Verificando estado de renderizado: ${renderId}`);

    const response = await axios.get(
      `${SHOTSTACK_API_URL}/render/${renderId}`,
      {
        headers: {
          'x-api-key': SHOTSTACK_API_KEY,
        },
      }
    );

    const data = response.data?.response;

    if (!data) {
      throw new Error('Respuesta inválida de Shotstack');
    }

    const status = data.status;
    const url = data.url;
    const progress = calculateProgress(status);

    logger.log(`📊 [SHOTSTACK] Estado: ${status}, Progreso: ${progress}%`);

    return {
      success: true,
      renderId,
      status: mapShotstackStatus(status),
      url,
      progress,
    };
  } catch (error: any) {
    logger.error('❌ [SHOTSTACK] Error verificando estado:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Error desconocido',
    };
  }
}

/**
 * Construye el timeline de Shotstack desde los clips
 */
function buildShotstackTimeline(request: RenderRequest) {
  const { clips, audioUrl } = request;

  // Track de video principal
  const videoClips = clips.map((clip, index) => {
    const asset: any = clip.videoUrl
      ? { type: 'video' as const, src: clip.videoUrl }
      : { type: 'image' as const, src: clip.imageUrl || '' };

    // 🔧 FIX: Si el clip tiene loop=true, configurar el video para que se repita
    // Shotstack soporta loop automático cuando el video es más corto que length
    // Pero podemos forzarlo con la propiedad 'loop' en el asset
    if (clip.loop && clip.videoUrl) {
      asset.loop = true;
      logger.log(`🔁 [SHOTSTACK] Clip ${index + 1} configurado con loop para duración ${clip.duration}s`);
    }

    const shotstackClip: any = {
      asset,
      start: clip.start,
      length: clip.duration,
    };

    // Agregar transición si no es el primer clip
    if (index > 0 && clip.transition && clip.transition !== 'none') {
      shotstackClip.transition = {
        in: clip.transition,
        out: clip.transition,
      };
    }

    return shotstackClip;
  });

  // Construir tracks
  const tracks: any[] = [
    {
      clips: videoClips,
    },
  ];

  // Agregar audio track si existe
  if (audioUrl) {
    tracks.push({
      clips: [
        {
          asset: {
            type: 'audio',
            src: audioUrl,
          },
          start: 0,
          length: request.audioDuration || 'auto',
        },
      ],
    });
  }

  return {
    soundtrack: audioUrl
      ? {
          src: audioUrl,
          effect: 'fadeOut',
          volume: 1.0,
        }
      : undefined,
    tracks,
  };
}

/**
 * Mapea el estado de Shotstack a nuestro formato
 */
function mapShotstackStatus(
  status: string
): 'queued' | 'processing' | 'done' | 'failed' {
  switch (status) {
    case 'queued':
    case 'fetching':
      return 'queued';
    case 'rendering':
    case 'saving':
      return 'processing';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    default:
      return 'queued';
  }
}

/**
 * Calcula el progreso basado en el estado
 */
function calculateProgress(status: string): number {
  switch (status) {
    case 'queued':
      return 10;
    case 'fetching':
      return 20;
    case 'rendering':
      return 60;
    case 'saving':
      return 90;
    case 'done':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

export default {
  startVideoRender,
  checkRenderStatus,
};
