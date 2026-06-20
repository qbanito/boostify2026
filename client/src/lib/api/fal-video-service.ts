import { fal } from "@fal-ai/client";
import { logger } from "../logger";

/**
 * FAL Video Generation Service
 * Integración completa con múltiples modelos de generación de video
 * 
 * WORKFLOW RECOMENDADO PARA MUSIC VIDEOS:
 * 1. Generar imagen con nano-banana (Text-to-Image) - $0.039/imagen
 * 2. Convertir a video con Grok Imagine Video - $0.05/segundo ($0.30/6s video)
 * 3. Editar video con Grok Edit - $0.06/segundo input+output
 */

// Configurar FAL con la clave de API
if (import.meta.env.FAL_API_KEY) {
  fal.config({
    credentials: import.meta.env.FAL_API_KEY
  });
}

export interface VideoGenerationOptions {
  prompt: string;
  imageUrl?: string;
  referenceImages?: string[]; // Para O1 reference-to-video (imágenes del artista)
  duration?: "5" | "6" | "10";
  aspectRatio?: "16:9" | "9:16" | "1:1" | "auto";
  negativePrompt?: string;
  cfgScale?: number;
  resolution?: "480p" | "720p";
}

export interface VideoGenerationResult {
  success: boolean;
  videoUrl?: string;
  error?: string;
  metadata?: any;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
}

/**
 * Modelos disponibles en FAL para generación de video
 */
export const FAL_VIDEO_MODELS = {
  // ========== GROK IMAGINE VIDEO (xAI) - PRINCIPAL ==========
  GROK_IMAGE_TO_VIDEO: {
    id: "xai/grok-imagine-video/image-to-video",
    name: "Grok Imagine Video ⭐",
    description: "xAI's Grok - Genera videos de alta calidad desde imágenes con audio nativo",
    type: "image-to-video",
    maxDuration: 6,
    pricing: "$0.30/6seg",
    recommended: true
  },
  
  GROK_EDIT_VIDEO: {
    id: "xai/grok-imagine-video/edit-video",
    name: "Grok Edit Video",
    description: "Edita videos existentes con prompts de texto (colorizar, estilizar)",
    type: "video-to-video",
    maxDuration: 8,
    pricing: "$0.06/seg"
  },
  
  // Google Veo 3.1 - Most advanced Google model with audio
  VEO_3_1_T2V: {
    id: "fal-ai/veo3.1",
    name: "Google Veo 3.1 ⭐",
    description: "Modelo más avanzado de Google con audio nativo integrado",
    type: "text-to-video",
    maxDuration: 8,
    pricing: "Premium"
  },
  
  VEO_3_1_I2V: {
    id: "fal-ai/veo3.1/image-to-video",
    name: "Google Veo 3.1 (Image-to-Video)",
    description: "Genera video desde imagen con Google Veo 3.1",
    type: "image-to-video",
    maxDuration: 8,
    pricing: "Premium"
  },
  
  VEO_3_1_FAST_T2V: {
    id: "fal-ai/veo3.1/fast",
    name: "Google Veo 3.1 Fast",
    description: "Versión rápida y más económica de Veo 3.1",
    type: "text-to-video",
    maxDuration: 8,
    pricing: "Medio"
  },
  
  VEO_3_1_FAST_I2V: {
    id: "fal-ai/veo3.1/fast/image-to-video",
    name: "Google Veo 3.1 Fast (Image-to-Video)",
    description: "Veo 3.1 Fast desde imagen - menor latencia",
    type: "image-to-video",
    maxDuration: 8,
    pricing: "Medio"
  },
  
  // KLING 2.5 Turbo Pro - Top-tier cinematic
  KLING_2_5_TURBO_PRO_T2V: {
    id: "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
    name: "KLING 2.5 Turbo Pro (Text-to-Video)",
    description: "Máxima calidad cinematográfica, fluidez de movimiento excepcional",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  KLING_2_5_TURBO_PRO_I2V: {
    id: "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",
    name: "KLING 2.5 Turbo Pro (Image-to-Video)",
    description: "Animación cinematográfica de imágenes",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  // KLING 2.1 Master - Premium tier
  KLING_2_1_MASTER_T2V: {
    id: "fal-ai/kling-video/v2.1/master/text-to-video",
    name: "KLING 2.1 Master (Text-to-Video)",
    description: "Calidad premium con fluidez de movimiento sin igual",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "$1.40/5seg"
  },
  
  KLING_2_1_MASTER_I2V: {
    id: "fal-ai/kling-video/v2.1/master/image-to-video",
    name: "KLING 2.1 Master (Image-to-Video)",
    description: "Animación premium de imágenes estáticas",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$1.40/5seg"
  },
  
  // KLING 2.1 Pro - Professional grade
  KLING_2_1_PRO_T2V: {
    id: "fal-ai/kling-video/v2.1/pro/text-to-video",
    name: "KLING 2.1 Pro (Text-to-Video)",
    description: "Grado profesional con fidelidad visual mejorada",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "$0.45/5seg"
  },
  
  KLING_2_1_PRO_I2V: {
    id: "fal-ai/kling-video/v2.1/pro/image-to-video",
    name: "KLING 2.1 Pro (Image-to-Video)",
    description: "Animación profesional con movimientos de cámara precisos",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.45/5seg"
  },
  
  // KLING 2.1 Standard - Cost-efficient
  KLING_2_1_STANDARD_T2V: {
    id: "fal-ai/kling-video/v2.1/standard/text-to-video",
    name: "KLING 2.1 Standard (Text-to-Video)",
    description: "Alta calidad a precio accesible",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "$0.25/5seg"
  },
  
  KLING_2_1_STANDARD_I2V: {
    id: "fal-ai/kling-video/v2.1/standard/image-to-video",
    name: "KLING 2.1 Standard (Image-to-Video)",
    description: "Animación de calidad a precio económico",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.25/5seg"
  },
  
  // KLING O1 - NEW! Reference-to-Video (mejor consistencia de personajes)
  KLING_O1_STANDARD_REF2V: {
    id: "fal-ai/kling-video/o1/standard/reference-to-video",
    name: "KLING O1 Reference-to-Video ⭐",
    description: "Mantiene identidad consistente de personajes, objetos y entornos - IDEAL para Music Videos",
    type: "reference-to-video",
    maxDuration: 10,
    pricing: "$0.30/5seg"
  },
  
  KLING_O1_STANDARD_I2V: {
    id: "fal-ai/kling-video/o1/standard/image-to-video",
    name: "KLING O1 Image-to-Video",
    description: "Genera video animando transición entre frames con guía de texto",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.30/5seg"
  },
  
  KLING_O1_V2V_REFERENCE: {
    id: "fal-ai/kling-video/o1/standard/video-to-video/reference",
    name: "KLING O1 Video Reference",
    description: "Genera nuevos planos guiados por video de referencia preservando continuidad",
    type: "video-to-video",
    maxDuration: 10,
    pricing: "$0.35/5seg"
  },
  
  // KLING 2.6 Pro - Newest tier with audio
  KLING_2_6_PRO_T2V: {
    id: "fal-ai/kling-video/v2.6/pro/text-to-video",
    name: "KLING 2.6 Pro (Text-to-Video)",
    description: "Top-tier con visuales cinematográficos, movimiento fluido y audio nativo",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Premium+"
  },
  
  KLING_2_6_PRO_I2V: {
    id: "fal-ai/kling-video/v2.6/pro/image-to-video",
    name: "KLING 2.6 Pro (Image-to-Video)",
    description: "Top-tier image-to-video con audio nativo generado",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium+"
  },
  
  // Hunyuan Video (Tencent) - Open-source de alta calidad
  HUNYUAN_VIDEO: {
    id: "fal-ai/hunyuan-video",
    name: "Hunyuan Video (Tencent)",
    description: "Open-source de alta calidad visual y diversidad de movimiento",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Medio"
  },
  
  // Wan 2.2 A14B - Image-to-Video de alta calidad (open-source)
  WAN_2_2_I2V: {
    id: "fal-ai/wan/v2.2-a14b/image-to-video",
    name: "Wan 2.2 A14B (Image-to-Video)",
    description: "Alta calidad visual y diversidad de movimiento — open-source",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.40/video"
  },
  
  // Luma Dream Machine
  LUMA_DREAM_MACHINE: {
    id: "fal-ai/luma-dream-machine",
    name: "Luma Dream Machine",
    description: "Movimiento realista de alta calidad",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Medio"
  },
  
  // MiniMax Hailuo-02
  MINIMAX_HAILUO: {
    id: "fal-ai/minimax/hailuo-02/standard/image-to-video",
    name: "MiniMax Hailuo-02",
    description: "Video de alta resolución (768p/512p) desde imagen",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Medio"
  },
  
  // Framepack - Autoregressive generation
  FRAMEPACK: {
    id: "fal-ai/framepack",
    name: "Framepack",
    description: "Generación autoregresiva hasta 180 frames",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.0333/seg"
  },

  // ========== KLING O3 - LATEST GENERATION ==========
  KLING_O3_4K_REF2V: {
    id: "fal-ai/kling-video/o3/4k/reference-to-video",
    name: "KLING O3 4K Reference-to-Video ⭐⭐",
    description: "Native 4K — TRUE face embedding via elements[], máxima consistencia de identidad",
    type: "reference-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  KLING_O3_4K_I2V: {
    id: "fal-ai/kling-video/o3/4k/image-to-video",
    name: "KLING O3 4K (Image-to-Video)",
    description: "Genera video 4K nativo directamente, sin upscaling en post-producción",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  KLING_O3_4K_T2V: {
    id: "fal-ai/kling-video/o3/4k/text-to-video",
    name: "KLING O3 4K (Text-to-Video)",
    description: "Genera video 4K nativo desde texto, calidad cinematográfica",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  KLING_O3_STD_I2V: {
    id: "fal-ai/kling-video/o3/standard/image-to-video",
    name: "KLING O3 Standard (Image-to-Video)",
    description: "O3 Standard — anima transición entre frame inicial y final con guía de texto",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "$0.30/5seg"
  },

  // ========== MOTION TRANSFER & LIPSYNC MODELS ==========
  DREAMACTOR_V2: {
    id: "fal-ai/bytedance/dreamactor/v2",
    name: "DreamActor v2 (Motion Transfer) 🎭",
    description: "Transfiere movimiento, expresiones y lip-sync de video de referencia a imagen del artista",
    type: "motion-transfer",
    maxDuration: 30,
    pricing: "Premium"
  },

  OMNIHUMAN_V1_5: {
    id: "fal-ai/bytedance/omnihuman/v1.5",
    name: "OmniHuman v1.5 (Lipsync + Body) 🎤",
    description: "Genera video con lip-sync y movimiento corporal natural desde imagen + audio",
    type: "lipsync",
    maxDuration: 60,
    pricing: "Premium"
  },

  CREATIFY_AURORA: {
    id: "fal-ai/creatify/aurora",
    name: "Creatify Aurora (Singing) 🎵",
    description: "Genera video de artista cantando directamente desde imagen + audio - estudio quality",
    type: "lipsync",
    maxDuration: 30,
    pricing: "Premium"
  },

  SYNC_LIPSYNC_V2: {
    id: "fal-ai/sync-lipsync/v2",
    name: "Sync Lipsync v2 (Post-process)",
    description: "Aplica lip-sync post-proceso a video existente - rápido y preciso",
    type: "video-to-video",
    maxDuration: 30,
    pricing: "Medio"
  },

  // ========== NEW 2025 SOTA MODELS ==========
  
  // Kling v3 Pro — top-tier with native audio
  KLING_V3_PRO_I2V: {
    id: "fal-ai/kling-video/v3/pro/image-to-video",
    name: "KLING v3 Pro (Image-to-Video) 🏆",
    description: "Kling 3.0 Pro — visuales cinematográficos, movimiento fluido y audio nativo",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium",
    recommended: true
  },

  KLING_V3_PRO_T2V: {
    id: "fal-ai/kling-video/v3/pro/text-to-video",
    name: "KLING v3 Pro (Text-to-Video)",
    description: "Kling 3.0 Pro — generación desde texto con audio nativo",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },
  
  KLING_V3_4K_I2V: {
    id: "fal-ai/kling-video/v3/4k/image-to-video",
    name: "KLING v3 4K (Image-to-Video)",
    description: "Kling 3.0 Native 4K — la más alta resolución disponible",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },

  // Seedance 2.0 — ByteDance SOTA with native audio
  SEEDANCE_2_I2V: {
    id: "bytedance/seedance-2.0/image-to-video",
    name: "Seedance 2.0 (Image-to-Video) ⭐",
    description: "Modelo más avanzado de ByteDance — audio nativo, física real, control de cámara cinematográfico",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Premium",
    recommended: true
  },

  SEEDANCE_2_T2V: {
    id: "bytedance/seedance-2.0/text-to-video",
    name: "Seedance 2.0 (Text-to-Video)",
    description: "ByteDance SOTA — audio nativo, edición multi-plano, física real",
    type: "text-to-video",
    maxDuration: 10,
    pricing: "Premium"
  },

  SEEDANCE_2_REF2V: {
    id: "bytedance/seedance-2.0/reference-to-video",
    name: "Seedance 2.0 Reference-to-Video ⭐",
    description: "Hasta 9 imágenes + 3 videos + 3 clips de audio — consistencia de personajes ideal para music videos",
    type: "reference-to-video",
    maxDuration: 10,
    pricing: "Premium",
    recommended: true
  },

  SEEDANCE_2_FAST_I2V: {
    id: "bytedance/seedance-2.0/fast/image-to-video",
    name: "Seedance 2.0 Fast (Image-to-Video)",
    description: "Seedance 2.0 versión rápida — menor latencia y costo con la misma calidad",
    type: "image-to-video",
    maxDuration: 10,
    pricing: "Medio"
  },

  // PixVerse V6 — lifelike physics and striking visuals
  PIXVERSE_V6: {
    id: "fal-ai/pixverse/v6/image-to-video",
    name: "PixVerse V6 (Image-to-Video)",
    description: "Física realista y visuales impresionantes — ideal para contenido artístico y musical",
    type: "image-to-video",
    maxDuration: 8,
    pricing: "Medio"
  },

  // Alibaba Happy Horse — 1080p with native audio & lipsync
  HAPPY_HORSE_I2V: {
    id: "alibaba/happy-horse/image-to-video",
    name: "Happy Horse (Image-to-Video) 🐎",
    description: "Alibaba #1-ranked — 1080p con audio nativo y lip-sync multilingüe",
    type: "image-to-video",
    maxDuration: 15,
    pricing: "Medio"
  },

  HAPPY_HORSE_T2V: {
    id: "alibaba/happy-horse/text-to-video",
    name: "Happy Horse (Text-to-Video)",
    description: "Genera 1080p con audio nativo desde texto — Alibaba",
    type: "text-to-video",
    maxDuration: 15,
    pricing: "Medio"
  },

  HAPPY_HORSE_REF2V: {
    id: "alibaba/happy-horse/reference-to-video",
    name: "Happy Horse Reference-to-Video",
    description: "1080p con audio nativo desde referencias de imagen y video",
    type: "reference-to-video",
    maxDuration: 15,
    pricing: "Medio"
  },

  // Sync Lipsync v3 — most powerful lipsync with native visual intelligence
  SYNC_LIPSYNC_V3: {
    id: "fal-ai/sync-lipsync/v3",
    name: "Sync Lipsync v3 (SOTA) 💋",
    description: "sync-3: el modelo lipsync más poderoso con inteligencia visual nativa — calidad profesional",
    type: "video-to-video",
    maxDuration: 60,
    pricing: "Premium"
  },

  // HeyGen v3 Lipsync — precision and speed tiers
  HEYGEN_V3_PRECISION: {
    id: "fal-ai/heygen/v3/lipsync/precision",
    name: "HeyGen v3 Precision Lipsync 🎯",
    description: "Lip-sync de alta precisión con inferencia de avatar — ideal para presentaciones y music videos",
    type: "video-to-video",
    maxDuration: 60,
    pricing: "Premium"
  },

  HEYGEN_V3_SPEED: {
    id: "fal-ai/heygen/v3/lipsync/speed",
    name: "HeyGen v3 Speed Lipsync ⚡",
    description: "Doblaje de audio rápido con lip-sync — menor latencia",
    type: "video-to-video",
    maxDuration: 60,
    pricing: "Medio"
  }
};

/**
 * Generar video usando modelo de FAL
 */
export async function generateVideoWithFAL(
  modelId: string,
  options: VideoGenerationOptions
): Promise<VideoGenerationResult> {
  try {
    logger.info(`🎬 Generando video con modelo: ${modelId}`);
    logger.info('Opciones:', options);

    const input: any = {
      prompt: options.prompt,
      duration: options.duration || "5"
    };

    // Detectar tipo de modelo
    const isReferenceToVideo = modelId.includes('reference-to-video');
    const isO3Model = modelId.includes('/o3/');
    
    // 🎬 O3 Pro uses 'elements' array for face embedding (different from O1 reference_images)
    if (isO3Model && options.referenceImages && options.referenceImages.length > 0) {
      input.elements = options.referenceImages.map(url => ({ image_url: url }));
      logger.info(`🎬 Using O3 elements[] with ${options.referenceImages.length} face embeddings`);
    } else if (isReferenceToVideo && options.referenceImages && options.referenceImages.length > 0) {
      // O1 reference-to-video format
      input.reference_images = options.referenceImages;
      logger.info(`🎨 Using ${options.referenceImages.length} reference images for character consistency`);
    }
    
    // Para image-to-video, usar image_url
    if (options.imageUrl) {
      input.image_url = options.imageUrl;
    }

    // Aspect ratio
    if (options.aspectRatio) {
      input.aspect_ratio = options.aspectRatio;
    }

    // 🎬 Negative prompt — always send a default to reduce artifacts
    input.negative_prompt = options.negativePrompt || 'blur, distort, low quality, static, frozen, morphing, deformed';

    // 🎬 CFG Scale — default 0.5 for balanced adherence
    input.cfg_scale = options.cfgScale ?? 0.5;
    
    logger.info(`🎬 FAL Video input: model=${modelId}, duration=${input.duration}, cfg=${input.cfg_scale}, negative=${input.negative_prompt.substring(0, 40)}...`);

    // Suscribirse al modelo y esperar resultado
    const result = await fal.subscribe(modelId, {
      input,
      logs: true,
      onQueueUpdate: (update) => {
        logger.info('📊 Estado de generación:', update.status);
      }
    });

    logger.info('✅ Video generado exitosamente');

    // Extraer URL del video del resultado
    let videoUrl = '';
    if (result.data?.video?.url) {
      videoUrl = result.data.video.url;
    } else if (result.data?.output_url) {
      videoUrl = result.data.output_url;
    } else if (result.data?.url) {
      videoUrl = result.data.url;
    }

    if (!videoUrl) {
      throw new Error('No se pudo obtener URL del video generado');
    }

    return {
      success: true,
      videoUrl,
      metadata: result.data
    };
  } catch (error: any) {
    logger.error('❌ Error generando video con FAL:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al generar video'
    };
  }
}

/**
 * Generar múltiples videos en paralelo
 * @param modelId - ID del modelo FAL a usar
 * @param scenes - Array de escenas con prompt e imagen
 * @param referenceImages - Imágenes de referencia del artista para O1 reference-to-video
 */
export async function generateMultipleVideos(
  modelId: string,
  scenes: Array<{ prompt: string; imageUrl?: string }>,
  referenceImages?: string[]
): Promise<VideoGenerationResult[]> {
  logger.info(`🎬 Generando ${scenes.length} videos en paralelo...`);
  
  const isReferenceModel = modelId.includes('reference-to-video');
  if (isReferenceModel && referenceImages?.length) {
    logger.info(`🎨 Usando modelo O1 reference-to-video con ${referenceImages.length} imágenes de referencia`);
  }
  
  const promises = scenes.map((scene, index) => 
    generateVideoWithFAL(modelId, {
      prompt: scene.prompt,
      imageUrl: scene.imageUrl,
      duration: "5", // 5 segundos por defecto
      aspectRatio: "16:9",
      // Pasar imágenes de referencia para consistencia de personajes
      referenceImages: isReferenceModel ? referenceImages : undefined
    }).then(result => {
      logger.info(`✅ Video ${index + 1}/${scenes.length} completado`);
      return result;
    })
  );

  return Promise.all(promises);
}

/**
 * Obtener modelos recomendados según el tipo de generación
 * @param type - Tipo de generación: 'text-to-video', 'image-to-video', 'reference-to-video', 'video-to-video'
 */
export function getRecommendedModels(type: 'text-to-video' | 'image-to-video' | 'reference-to-video' | 'video-to-video' = 'image-to-video') {
  return Object.values(FAL_VIDEO_MODELS)
    .filter(model => {
      // Para reference-to-video y image-to-video, incluir ambos tipos + Grok
      if (type === 'image-to-video' || type === 'reference-to-video') {
        return model.type === 'image-to-video' || model.type === 'reference-to-video';
      }
      if (type === 'video-to-video') {
        return model.type === 'video-to-video';
      }
      return model.type === type || model.type === 'text-to-video';
    })
    .sort((a, b) => {
      // Ordenar: Grok primero, luego O1 reference-to-video, luego por calidad
      const aIsGrok = a.id.includes('grok') ? -2 : 0;
      const bIsGrok = b.id.includes('grok') ? -2 : 0;
      if (aIsGrok !== bIsGrok) return aIsGrok - bIsGrok;
      
      const isAReference = a.type === 'reference-to-video' ? -1 : 0;
      const isBReference = b.type === 'reference-to-video' ? -1 : 0;
      if (isAReference !== isBReference) return isAReference - isBReference;
      
      const order = { 'Premium': 0, 'Premium+': 1, 'Medio': 2, '$0.25/5seg': 3, '$0.30/5seg': 4, '$0.30/6seg': 5 };
      return (order[a.pricing as keyof typeof order] || 99) - (order[b.pricing as keyof typeof order] || 99);
    });
}

/**
 * Obtener modelos recomendados para Music Videos
 * Prioriza: Grok Imagine > O1 reference-to-video > otros image-to-video
 */
export function getMusicVideoModels() {
  return Object.values(FAL_VIDEO_MODELS)
    .filter(model => model.type === 'image-to-video' || model.type === 'reference-to-video')
    .sort((a, b) => {
      // Grok primero (recomendado para Music Videos)
      const aIsGrok = a.id.includes('grok') ? -2 : 0;
      const bIsGrok = b.id.includes('grok') ? -2 : 0;
      if (aIsGrok !== bIsGrok) return aIsGrok - bIsGrok;
      
      // O1 Reference-to-video segundo (mantiene consistencia del artista)
      if (a.type === 'reference-to-video' && b.type !== 'reference-to-video') return -1;
      if (b.type === 'reference-to-video' && a.type !== 'reference-to-video') return 1;
      return 0;
    });
}

/**
 * Obtener modelo por ID o nombre
 */
export function getModelById(id: string) {
  return Object.values(FAL_VIDEO_MODELS).find(model => model.id === id);
}

/**
 * Verificar si un modelo es de tipo reference-to-video
 */
export function isReferenceToVideoModel(modelId: string): boolean {
  return modelId.includes('reference-to-video');
}

/**
 * Verificar si un modelo es Grok
 */
export function isGrokModel(modelId: string): boolean {
  return modelId.includes('grok-imagine-video');
}

/**
 * Generar video usando el workflow recomendado (Grok Imagine)
 * Primero genera imagen con nano-banana, luego la convierte a video
 */
export async function generateMusicVideoSceneWithGrok(
  imagePrompt: string,
  motionPrompt: string,
  options: {
    aspectRatio?: "16:9" | "9:16" | "1:1";
    duration?: "6";
    resolution?: "480p" | "720p";
    editStyle?: string; // Opcional: estilo de post-producción
  } = {}
): Promise<{
  success: boolean;
  imageUrl?: string;
  videoUrl?: string;
  editedVideoUrl?: string;
  error?: string;
}> {
  try {
    logger.info(`🎬 [Grok Workflow] Generando escena de Music Video...`);
    
    // Este endpoint llama al servidor que tiene el workflow completo
    const response = await fetch('/api/fal/music-video-scene', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imagePrompt,
        motionPrompt,
        aspectRatio: options.aspectRatio || '16:9',
        duration: options.duration || '6',
        resolution: options.resolution || '720p',
        editStyle: options.editStyle
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Error generando escena');
    }
    
    return result;
  } catch (error: any) {
    logger.error('❌ [Grok Workflow] Error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  models: FAL_VIDEO_MODELS,
  generate: generateVideoWithFAL,
  generateMultiple: generateMultipleVideos,
  generateMusicVideoScene: generateMusicVideoSceneWithGrok,
  getRecommended: getRecommendedModels,
  getMusicVideo: getMusicVideoModels,
  getById: getModelById,
  isReferenceModel: isReferenceToVideoModel,
  isGrokModel: isGrokModel
};
