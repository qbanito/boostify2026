/**
 * Servicio FAL AI para generación de imágenes y música
 * 
 * MODELOS PRINCIPALES DE LA PLATAFORMA:
 * 
 * 🎨 GENERACIÓN DE IMÁGENES (Text-to-Image):
 *    - fal-ai/nano-banana-2: Nano Banana 2 - alta calidad, coherencia visual superior
 *    - Parámetros: prompt, image_size, num_images, output_format
 * 
 * ✏️ EDICIÓN DE IMÁGENES (Image-to-Image):
 *    - fal-ai/nano-banana-2/edit: Misma calidad superior con image_url para referencia
 *    - Parámetros: prompt, image_url, image_size, num_images
 * 
 * 🎵 GENERACIÓN DE MÚSICA CON LETRAS:
 *    - fal-ai/minimax-music/v2: Canciones completas con voces - $0.03/generación
 *    - Parámetros: prompt (estilo/mood), lyrics_prompt (letras con [verse][chorus])
 *    - Genera canciones de duración completa con voces y letras
 */
import axios from 'axios';
import sharp from 'sharp';
import { createRequire } from 'module';
import { logger } from '../utils/logger';
import { storage } from '../firebase';
import { buildImageMasterpieceRules } from '../utils/masterpiece-rules';

const nodeRequire = createRequire(import.meta.url);

// Configuración de FAL API
const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';
const FAL_BASE_URL = 'https://fal.run';

/**
 * MODELOS FAL PRINCIPALES - NANO BANANA 2, GROK IMAGINE VIDEO & MINIMAX MUSIC
 * 
 * WORKFLOW RECOMENDADO PARA MUSIC VIDEOS:
 * 1. Generar imagen con Nano Banana 2 (Text-to-Image)
 * 2. Convertir a video con Grok Imagine Video - $0.05/segundo ($0.30/6s video)
 * 3. Editar video con Grok Edit - $0.06/segundo input+output
 */
export const FAL_MODELS = {
  // ========== IMÁGENES - NANO BANANA 2 ==========
  // Generación Text-to-Image (solo prompt) - PRINCIPAL
  IMAGE_GENERATION: 'fal-ai/nano-banana-2',
  // Edición Image-to-Image (con image_url para referencia)
  IMAGE_EDIT: 'fal-ai/nano-banana-2/edit',
  // Merchandise (alias de edición)
  MERCHANDISE_EDIT: 'fal-ai/nano-banana-2/edit',
  // FLUX family for lower-cost, high-quality generation/editing
  FLUX_DEV: 'fal-ai/flux/dev',
  FLUX_KONTEXT: 'fal-ai/flux-pro/kontext',
  
  // ========== VIDEO - GROK IMAGINE (xAI) - PRINCIPAL ==========
  // Grok Imagine Video: Image-to-Video de alta calidad con audio
  // Duración: 6 segundos, Resolución: 480p/720p, Incluye audio nativo
  GROK_IMAGE_TO_VIDEO: 'xai/grok-imagine-video/image-to-video',
  // Grok Edit Video: Video-to-Video para ediciones y transformaciones
  // Edita videos existentes con prompts de texto (colorizar, estilizar, etc.)
  GROK_EDIT_VIDEO: 'xai/grok-imagine-video/edit-video',
  
  // ========== VIDEO - HAPPY HORSE (Alibaba) - VIRAL CONTENT ==========
  // Image-to-Video: convierte una imagen estática en video viral hasta 15s
  HAPPY_HORSE_I2V: 'alibaba/happy-horse/image-to-video',
  // Reference-to-Video: usa imagen(es) como referencia (producto, persona, escena)
  // y genera un video viral promocional
  HAPPY_HORSE_R2V: 'alibaba/happy-horse/reference-to-video',
  
  // ========== IMAGEN - GPT-IMAGE-2 EDIT (OpenAI vía FAL) ==========
  // Edición premium con coherencia de marca/identidad
  GPT_IMAGE_2_EDIT: 'fal-ai/openai/gpt-image-2/edit',
  
  // ========== VIDEO - FALLBACK ==========
  // Wan 2.6 Image-to-Video: Convierte imágenes estáticas a videos animados
  // Duración: ~5 segundos, resolución 480p/720p
  IMAGE_TO_VIDEO: 'fal-ai/wan/v2.6/image-to-video',
  IMAGE_TO_VIDEO_FALLBACK: 'fal-ai/wan/v2.6/image-to-video',
  
  // ========== MÚSICA ==========
  // MiniMax Music V2: Canciones completas con voces y letras
  // Requiere: prompt (estilo) + lyrics_prompt (letras con [verse][chorus])
  MUSIC_GENERATION: 'fal-ai/minimax-music/v2',
  
  // ========== LEGACY (mantener compatibilidad) ==========
  FLUX_SCHNELL: 'fal-ai/flux/schnell',
  STABLE_AUDIO: 'fal-ai/stable-audio', // Legacy - usar MUSIC_GENERATION
  
  // ========== FLUX PRO KONTEXT (text-to-image) ==========
  // Premium text-to-image generation — highest quality for marketing visuals
  FLUX_KONTEXT_PRO_T2I: 'fal-ai/flux-pro/kontext/text-to-image',

  // ========== PROMO CLIPS — LIPSYNC ENGINE (100% FAL, sin PiAPI) ==========
  // OmniHuman v1.5 (ByteDance): Image + Audio → Video con lipsync emocional en 1 paso
  // Captura respiración, intensidad vocal, movimiento corporal sincronizado
  OMNIHUMAN_V15: 'fal-ai/bytedance/omnihuman/v1.5',
  // Sync Lipsync v3 (Sync Labs): El modelo de lipsync más potente — video-to-video
  // "native visual intelligence" — entiende el contexto visual antes de sincronizar
  SYNC_LIPSYNC_V3: 'fal-ai/sync-lipsync/v3',
  // Kling v3 Pro Image-to-Video: Video cinematográfico premium para base del lipsync
  KLING_V3_PRO_I2V: 'fal-ai/kling-video/v3/pro/image-to-video',
  // Kling v3 Standard Image-to-Video: mejor balance calidad/precio para base del lipsync
  KLING_V3_STANDARD_I2V: 'fal-ai/kling-video/v3/standard/image-to-video',
  // Kling v2.1 Standard Image-to-Video: opción económica para previews y low-tier
  KLING_V21_STANDARD_I2V: 'fal-ai/kling-video/v2.1/standard/image-to-video',
  // Seedance 2.0 Fast Reference-to-Video: performance musical rítmica con imagen + audio de referencia
  SEEDANCE_2_FAST_R2V: 'bytedance/seedance-2.0/fast/reference-to-video',
  // Happy Horse (Alibaba): Lipsync nativo multilingüe + audio sync, 1080p, 3-15s
  HAPPY_HORSE_I2V_LIPSYNC: 'alibaba/happy-horse/image-to-video',
  // Topaz Video Upscale: Upscale profesional del video final antes de exportar
  TOPAZ_VIDEO_UPSCALE: 'fal-ai/topaz/upscale/video',
} as const;

// Aspect ratios soportados — se mapean a image_size de flux-2-pro
export const NANO_BANANA_ASPECT_RATIOS = [
  '21:9', '16:9', '3:2', '4:3', '5:4', '1:1', '4:5', '3:4', '2:3', '9:16'
] as const;

export type NanoBananaAspectRatio = typeof NANO_BANANA_ASPECT_RATIOS[number];

// Helper: convert aspect ratio to flux-2-pro image_size format
function mapAspectToImageSize(ar: string): string {
  const mapping: Record<string, string> = {
    '16:9': 'landscape_16_9',
    '9:16': 'portrait_16_9',
    '1:1': 'square_hd',
    '4:3': 'landscape_4_3',
    '3:4': 'portrait_4_3',
    '21:9': 'landscape_16_9',
    '3:2': 'landscape_4_3',
    '2:3': 'portrait_4_3',
    '5:4': 'square_hd',
    '4:5': 'square_hd',
  };
  return mapping[ar] || 'landscape_16_9';
}

// Helper: convert aspect ratio to OpenAI gpt-image-1 supported size.
// gpt-image-1 only supports 1024x1024 (square), 1536x1024 (landscape) y 1024x1536 (portrait).
function mapAspectToGptImageSize(ar?: string): '1024x1024' | '1536x1024' | '1024x1536' {
  const portrait = new Set(['9:16', '3:4', '2:3', '4:5']);
  const landscape = new Set(['16:9', '4:3', '3:2', '21:9']);
  if (ar && portrait.has(ar)) return '1024x1536';
  if (ar && landscape.has(ar)) return '1536x1024';
  return '1024x1024';
}

export interface FalImageResult {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  error?: string;
  provider?: string;
}

type FluxDevImageSize = 'portrait_4_3' | 'portrait_16_9' | 'square_hd' | 'landscape_4_3' | 'landscape_16_9';

async function generateImageWithFluxDevForFolder(
  prompt: string,
  options: {
    imageSize?: FluxDevImageSize;
    outputFolder?: string;
    numImages?: number;
  } = {},
): Promise<FalImageResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY no configurada' };
  }

  try {
    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.FLUX_DEV}`,
      {
        prompt,
        image_size: options.imageSize || 'square_hd',
        num_images: options.numImages || 1,
        enable_safety_checker: false,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      },
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      },
    );

    const tempUrl = response.data?.images?.[0]?.url;
    if (!tempUrl) {
      return { success: false, error: 'Flux Dev no devolvió imagen' };
    }

    const downloaded = await downloadImageAsBase64(tempUrl);
    if (!downloaded) {
      return { success: true, imageUrl: tempUrl, provider: 'fal-flux-dev' };
    }

    const permanentUrl = await uploadBase64ToStorage(
      downloaded.base64,
      downloaded.mimeType,
      options.outputFolder || 'generated-images',
    );

    return {
      success: true,
      imageUrl: permanentUrl,
      imageBase64: downloaded.base64,
      provider: 'fal-flux-dev',
    };
  } catch (error: any) {
    logger.warn(`[FAL] Flux Dev failed: ${error.response?.data?.detail || error.message}`);
    return { success: false, error: error.message };
  }
}

async function editImageWithFluxKontext(
  imageUrl: string,
  prompt: string,
  options: {
    aspectRatio?: NanoBananaAspectRatio;
    outputFolder?: string;
  } = {},
): Promise<FalImageResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY no configurada' };
  }

  try {
    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.FLUX_KONTEXT}`,
      {
        prompt,
        image_url: imageUrl,
        image_size: mapAspectToImageSize(options.aspectRatio || '1:1'),
        output_format: 'png',
        guidance_scale: 3.5,
        num_inference_steps: 28,
      },
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      },
    );

    const tempUrl = response.data?.images?.[0]?.url;
    if (!tempUrl) {
      return { success: false, error: 'Flux Kontext no devolvió imagen' };
    }

    const downloaded = await downloadImageAsBase64(tempUrl);
    if (!downloaded) {
      return { success: true, imageUrl: tempUrl, provider: 'fal-flux-kontext' };
    }

    const permanentUrl = await uploadBase64ToStorage(
      downloaded.base64,
      downloaded.mimeType,
      options.outputFolder || 'artist-images-edited',
    );

    return {
      success: true,
      imageUrl: permanentUrl,
      imageBase64: downloaded.base64,
      provider: 'fal-flux-kontext',
    };
  } catch (error: any) {
    logger.warn(`[FAL] Flux Kontext failed: ${error.response?.data?.detail || error.message}`);
    return { success: false, error: error.message };
  }
}

// ─── Replicate API (Fallback: Flux Schnell / SDXL) ───
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// ─── FHDR Uncensored: Cloud (HF Inference Endpoint) + Local (GPU) ───
import { logApiUsage } from '../utils/api-logger';
const LOCAL_FHDR_SERVER_URL = process.env.LOCAL_AI_MODEL_SERVER_URL || 'http://127.0.0.1:9000';
const HF_FHDR_ENDPOINT_URL = process.env.HF_FHDR_ENDPOINT_URL || ''; // e.g. https://xxx.us-east-1.aws.endpoints.huggingface.cloud
const HF_TOKEN = process.env.HUGGINGFACE_TOKEN || '';

/**
 * Generate image using HuggingFace Inference Endpoint (cloud GPU).
 * This is a dedicated endpoint running FHDR_Uncensored on HF infrastructure.
 * Set HF_FHDR_ENDPOINT_URL env var to enable.
 * Supports scale-to-zero (cold start ~60-120s on first request).
 */
export async function generateImageWithFHDRCloud(
  prompt: string,
  options: {
    numInferenceSteps?: number;
    guidanceScale?: number;
  } = {}
): Promise<FalImageResult> {
  if (!HF_FHDR_ENDPOINT_URL) {
    return { success: false, error: 'HF_FHDR_ENDPOINT_URL not configured' };
  }
  if (!HF_TOKEN) {
    return { success: false, error: 'HUGGINGFACE_TOKEN not configured' };
  }

  try {
    logger.log(`[FHDR-Cloud] ☁️ Generando imagen con HF Inference Endpoint...`);
    logger.log(`[FHDR-Cloud] Endpoint: ${HF_FHDR_ENDPOINT_URL}`);
    logger.log(`[FHDR-Cloud] Prompt: ${prompt.substring(0, 100)}...`);

    const payload: Record<string, any> = {
      inputs: prompt,
      parameters: {
        num_inference_steps: options.numInferenceSteps || 20,
        guidance_scale: options.guidanceScale || 4.0,
      },
    };

    // First attempt (may trigger cold start)
    let response = await axios.post(HF_FHDR_ENDPOINT_URL, payload, {
      headers: {
        'Authorization': `Bearer ${HF_TOKEN}`,
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 300000, // 5 min (includes cold start time)
    });

    // If model is loading (503), wait and retry
    if (response.status === 503) {
      const retryData = JSON.parse(Buffer.from(response.data).toString());
      const waitTime = Math.min(retryData.estimated_time || 60, 120);
      logger.log(`[FHDR-Cloud] ⏳ Endpoint loading, waiting ${waitTime}s...`);
      await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
      response = await axios.post(HF_FHDR_ENDPOINT_URL, payload, {
        headers: {
          'Authorization': `Bearer ${HF_TOKEN}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
        timeout: 300000,
      });
    }

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
      const text = Buffer.from(response.data).toString().substring(0, 300);
      throw new Error(`Unexpected response: ${contentType} — ${text}`);
    }

    // Convert to base64 and upload to Firebase
    const imageBase64 = Buffer.from(response.data).toString('base64');
    logger.log(`[FHDR-Cloud] ✅ Imagen recibida del endpoint (${(response.data.byteLength / 1024).toFixed(0)}KB)`);

    try {
      const permanentUrl = await uploadBase64ToStorage(
        imageBase64,
        'image/png',
        'fhdr-generated'
      );
      return {
        success: true,
        imageUrl: permanentUrl,
        imageBase64,
        provider: 'fhdr-cloud',
      };
    } catch (uploadErr: any) {
      logger.warn(`[FHDR-Cloud] Firebase upload failed: ${uploadErr.message}`);
      // Return as data URL if Firebase fails
      return {
        success: true,
        imageUrl: `data:image/png;base64,${imageBase64}`,
        imageBase64,
        provider: 'fhdr-cloud',
      };
    }
  } catch (error: any) {
    const status = error.response?.status;
    let msg: string;
    if (status === 503) {
      msg = 'HF Endpoint is loading (cold start). Try again in ~60s.';
    } else if (status === 401 || status === 403) {
      msg = 'HF auth failed. Check HUGGINGFACE_TOKEN.';
    } else {
      msg = error.message;
    }
    logger.error(`[FHDR-Cloud] ❌ HF Endpoint failed: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Generate image using local FHDR_Uncensored model via Python FastAPI server.
 * Used as final fallback when FAL and Gemini both fail.
 * Requires ai_model_server.py running on port 9000 with CUDA GPU.
 */
export async function generateImageWithFHDR(
  prompt: string,
  options: {
    width?: number;
    height?: number;
    numInferenceSteps?: number;
    guidanceScale?: number;
  } = {}
): Promise<FalImageResult> {
  try {
    logger.log(`[FHDR] 🔥 Intentando generación local con FHDR_Uncensored...`);
    logger.log(`[FHDR] Prompt: ${prompt.substring(0, 100)}...`);

    const response = await axios.post(
      `${LOCAL_FHDR_SERVER_URL}/generate-fhdr`,
      {
        prompt,
        width: options.width || 768,
        height: options.height || 768,
        num_inference_steps: options.numInferenceSteps || 20,
        guidance_scale: options.guidanceScale || 4.0,
      },
      { timeout: 300000 } // 5 min timeout for local GPU generation
    );

    if (response.data?.status === 'ok' && (response.data?.resultUrl || response.data?.imageBase64)) {
      const resultUrl = response.data.resultUrl;
      const imageBase64 = response.data.imageBase64;
      logger.log(`[FHDR] ✅ Imagen generada localmente (backend: ${response.data.backend})`);

      // Prefer base64 from response (no extra download needed)
      if (imageBase64) {
        try {
          const permanentUrl = await uploadBase64ToStorage(
            imageBase64,
            'image/png',
            'fhdr-generated'
          );
          return {
            success: true,
            imageUrl: permanentUrl,
            imageBase64: imageBase64,
            provider: 'fhdr-local',
          };
        } catch (uploadErr: any) {
          logger.warn(`[FHDR] Firebase upload failed: ${uploadErr.message}`);
        }
      }

      // Fallback: Download from local server URL and upload to Firebase
      try {
        const fullUrl = resultUrl.startsWith('http') ? resultUrl : `${LOCAL_FHDR_SERVER_URL}${resultUrl}`;
        const downloaded = await downloadImageAsBase64(fullUrl);
        if (downloaded) {
          const permanentUrl = await uploadBase64ToStorage(
            downloaded.base64,
            downloaded.mimeType,
            'fhdr-generated'
          );
          return {
            success: true,
            imageUrl: permanentUrl,
            imageBase64: downloaded.base64,
            provider: 'fhdr-local',
          };
        }
      } catch (uploadErr: any) {
        logger.warn(`[FHDR] Firebase upload failed, using local URL: ${uploadErr.message}`);
      }

      // Last resort: return local file path as URL
      return {
        success: true,
        imageUrl: resultUrl,
        provider: 'fhdr-local',
      };
    }

    throw new Error(response.data?.detail || 'No image returned from FHDR server');
  } catch (error: any) {
    const msg = error.code === 'ECONNREFUSED'
      ? 'FHDR server not running (ai_model_server.py on port 9000)'
      : error.response?.data?.detail || error.message;
    logger.error(`[FHDR] ❌ Local FHDR generation failed: ${msg}`);
    return { success: false, error: msg };
  }
}

export interface FalVideoResult {
  success: boolean;
  videoUrl?: string;
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  numFrames?: number;
  error?: string;
  provider?: 'fal-grok-image-to-video' | 'fal-grok-edit-video' | 'fal-wan-image-to-video';
}

export interface FalMusicResult {
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  duration?: number;
  lyrics?: string;
  error?: string;
  provider?: 'fal-minimax-music-v2' | 'fal-stable-audio' | 'lyria-3-pro' | 'lyria-3-clip';
}

/**
 * Sube un archivo base64 a Firebase Storage y devuelve su URL pública
 */
async function uploadBase64ToStorage(
  base64Data: string,
  mimeType: string = 'image/png',
  folder: string = 'fal-generated'
): Promise<string> {
  try {
    // Tolerar data-URLs: quitar el prefijo "data:...;base64," si viene incluido
    // (si no, Buffer.from lo decodifica como basura y el archivo queda corrupto).
    const commaIdx = base64Data.startsWith('data:') ? base64Data.indexOf(',') : -1;
    if (commaIdx >= 0) base64Data = base64Data.slice(commaIdx + 1);

    if (!storage) {
      logger.warn('[FAL] Firebase Storage no disponible, usando data URL');
      return `data:${mimeType};base64,${base64Data}`;
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const extension = mimeType.split('/')[1] || 'png';
    const fileName = `${folder}/${timestamp}_${randomId}.${extension}`;

    const imageBuffer = Buffer.from(base64Data, 'base64');
    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(imageBuffer, {
      metadata: { contentType: mimeType },
      validation: false,
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
    
    logger.log(`[FAL] Archivo subido a Storage: ${publicUrl}`);
    return publicUrl;
  } catch (error: any) {
    logger.error('[FAL] Error subiendo a Storage:', error.message);
    return `data:${mimeType};base64,${base64Data}`;
  }
}

/**
 * Descarga una imagen desde URL y la convierte a base64
 */
async function downloadImageAsBase64(imageUrl: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000
    });
    const base64 = Buffer.from(response.data).toString('base64');
    const mimeType = response.headers['content-type'] || 'image/png';
    return { base64, mimeType };
  } catch (error: any) {
    logger.error('[FAL] Error descargando imagen:', error.message);
    return null;
  }
}

// ─── Vision-based artist description (cached) ───────────────────────────
// Extracts gender presentation, ethnicity/skin tone, hair, age range and
// overall style from the artist's profile photo so the merch generator
// never drifts to a different gender or aesthetic. Cached in-memory per URL.
const artistDescriptionCache = new Map<string, string>();
async function describeArtistFromPhoto(imageUrl: string): Promise<string> {
  if (!imageUrl) return '';
  if (artistDescriptionCache.has(imageUrl)) return artistDescriptionCache.get(imageUrl)!;
  try {
    const dl = await downloadImageAsBase64(imageUrl);
    if (!dl) return '';
    const apiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY2 || process.env.AI_INTEGRATIONS_GEMINI_API_KEY;
    if (!apiKey) return '';
    const { GoogleGenAI } = await import('@google/genai');
    const ai = new GoogleGenAI({ apiKey });
    const resp: any = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: dl.mimeType, data: dl.base64 } },
          { text: 'You are a stylist briefing a photographer. Describe the person in this photo in 2 short English sentences (max 90 words total) for a merchandise photoshoot brief. Sentence 1 = identity: perceived gender presentation (male/female/androgynous), approximate age range, ethnicity/skin tone, hair (length/color/style), facial hair, build. Sentence 2 = wardrobe & style: ALL visible accessories (hat/cap type+color, sunglasses, chains, earrings, jewelry, tattoos), the EXACT clothing they wear (garment type, color, fit, fabric, visible prints/logos), and the overall fashion subculture / aesthetic vibe (e.g. urban streetwear, latin reggaeton, gothic, minimalist, etc). Be precise about every garment and accessory. Output ONLY the two sentences, no preface, no quotes, no labels.' }
        ]
      }],
    } as any);
    const text = String(resp?.text || '').trim().replace(/^["'`]|["'`]$/g, '').slice(0, 400);
    if (text) artistDescriptionCache.set(imageUrl, text);
    return text;
  } catch (e: any) {
    logger.warn(`[FAL] describeArtistFromPhoto failed: ${e.message}`);
    return '';
  }
}


/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES - Replicate (Fallback: Flux Schnell / SDXL)
 * ============================================================
 * Uses Replicate's API to run Flux Schnell (fast, ~1-2s) or SDXL as fallback.
 * Cost: ~$0.003 per image (Flux Schnell)
 * Requires REPLICATE_API_TOKEN env variable.
 */
export async function generateImageWithReplicate(
  prompt: string,
  options: {
    aspectRatio?: string;
    numOutputs?: number;
  } = {}
): Promise<FalImageResult> {
  if (!REPLICATE_API_TOKEN) {
    return { success: false, error: 'REPLICATE_API_TOKEN not configured' };
  }

  // Map aspect ratios to Replicate format
  const arMap: Record<string, string> = {
    '1:1': '1:1', '16:9': '16:9', '9:16': '9:16',
    '4:3': '4:3', '3:4': '3:4', '3:2': '3:2', '2:3': '2:3',
    '21:9': '16:9', '5:4': '4:3', '4:5': '3:4',
  };
  const ar = arMap[options.aspectRatio || '1:1'] || '1:1';

  // Try Flux Schnell first (fast ~1-2s), then SDXL as internal fallback
  const models = [
    { owner: 'black-forest-labs', name: 'flux-schnell', label: 'Flux Schnell' },
    { owner: 'stability-ai', name: 'sdxl', label: 'SDXL' },
  ];

  for (const model of models) {
    try {
      logger.log(`[REPLICATE] 🎨 Generando imagen con ${model.label}...`);
      logger.log(`[REPLICATE] Prompt: ${prompt.substring(0, 100)}...`);

      // Use the official models API for predictions
      const createResponse = await axios.post(
        `https://api.replicate.com/v1/models/${model.owner}/${model.name}/predictions`,
        {
          input: {
            prompt: prompt,
            aspect_ratio: ar,
            num_outputs: options.numOutputs || 1,
            output_format: 'png',
            go_fast: true,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json',
            'Prefer': 'wait',
          },
          timeout: 120000,
        }
      );

      let prediction = createResponse.data;

      // If not completed yet, poll for result
      if (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
        const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const pollRes = await axios.get(pollUrl, {
            headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
            timeout: 15000,
          });
          prediction = pollRes.data;
          if (prediction.status === 'succeeded' || prediction.status === 'failed') break;
        }
      }

      if (prediction.status === 'failed') {
        throw new Error(prediction.error || `${model.label} prediction failed`);
      }

      // Get image URL from output (array of URLs or single URL)
      const output = prediction.output;
      const imageUrl = Array.isArray(output) ? output[0] : output;

      if (!imageUrl) {
        throw new Error(`No image URL in ${model.label} response`);
      }

      logger.log(`[REPLICATE] ✅ Imagen generada con ${model.label}`);

      // Log API usage
      logApiUsage({
        apiProvider: 'other',
        endpoint: `${model.owner}/${model.name}`,
        model: model.name,
        status: 'success',
        metadata: { function: 'generateImageWithReplicate' },
      }).catch(() => {});

      // Download and upload to Firebase Storage for permanent URL
      const downloaded = await downloadImageAsBase64(imageUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(
          downloaded.base64,
          downloaded.mimeType,
          'replicate-generated'
        );
        return {
          success: true,
          imageUrl: permanentUrl,
          imageBase64: downloaded.base64,
          provider: 'replicate-flux',
        };
      }

      // If download fails, return the temporary Replicate URL
      return {
        success: true,
        imageUrl,
        provider: 'replicate-flux',
      };
    } catch (error: any) {
      logger.error(`[REPLICATE] ❌ ${model.label} failed:`, error.response?.data || error.message);
      // Continue to next model
    }
  }

  return { success: false, error: 'All Replicate models failed (Flux Schnell + SDXL)' };
}

/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES - OpenAI DALL-E 3 (Fallback)
 * ============================================================
 * Uses OpenAI's DALL-E 3 model as a fallback when FAL and Gemini fail.
 * Requires OPENAI_API_KEY env variable.
 */
export async function generateImageWithOpenAI(
  prompt: string,
  options: {
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
  } = {}
): Promise<FalImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  try {
    logger.log('[OPENAI] 🎨 Generating image with DALL-E 3...');
    logger.log(`[OPENAI] Prompt: ${prompt.substring(0, 100)}...`);

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'standard',
        response_format: 'url',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 60000,
      }
    );

    const imageUrl = response.data?.data?.[0]?.url;
    if (!imageUrl) {
      throw new Error('No image URL in DALL-E response');
    }

    logger.log('[OPENAI] ✅ Image generated with DALL-E 3');

    // Download and upload to Firebase Storage for permanent URL
    const downloaded = await downloadImageAsBase64(imageUrl);
    if (downloaded) {
      const permanentUrl = await uploadBase64ToStorage(
        downloaded.base64,
        downloaded.mimeType,
        'artist-images'
      );

      return {
        success: true,
        imageUrl: permanentUrl,
        imageBase64: downloaded.base64,
        provider: 'gemini-fallback' as any, // reusing type
      };
    }

    // If download/upload fails, return the temporary DALL-E URL
    return {
      success: true,
      imageUrl,
      provider: 'gemini-fallback' as any,
    };
  } catch (error: any) {
    logger.error('[OPENAI] ❌ DALL-E generation failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES - Flux Pro Kontext (Text-to-Image)
 * ============================================================
 * Modelo: fal-ai/flux-pro/kontext/text-to-image
 * Premium text-to-image via FAL.ai — highest quality photorealistic images.
 * Requiere FAL_API_KEY.
 */
export async function generateImageWithFluxKontextPro(
  prompt: string,
  options: {
    aspectRatio?: '21:9' | '16:9' | '4:3' | '1:1' | '3:4' | '9:16' | '3:2' | '2:3';
    outputFolder?: string;
  } = {}
): Promise<FalImageResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  const aspectRatio = options.aspectRatio || '16:9';

  try {
    logger.log('[FAL] 🎨 Generating image with Flux Pro Kontext (text-to-image)...');
    logger.log(`[FAL] Prompt: ${prompt.substring(0, 150)}...`);

    const input = {
      prompt,
      aspect_ratio: aspectRatio,
      output_format: 'jpeg',
      safety_tolerance: '6',
      num_images: 1,
    };

    let response: any;
    try {
      response = await axios.post(
        `${FAL_BASE_URL}/${FAL_MODELS.FLUX_KONTEXT_PRO_T2I}`,
        input,
        {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        }
      );
    } catch (error: any) {
      if (error?.response?.status !== 405) throw error;
      logger.warn('[FAL] Flux Kontext Pro sync endpoint returned 405; falling back to queue API');
      const submitRes = await axios.post(
        `${FAL_QUEUE_URL}/${FAL_MODELS.FLUX_KONTEXT_PRO_T2I}`,
        input,
        {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );
      const requestId = submitRes.data?.request_id;
      const statusUrl = submitRes.data?.status_url || `${FAL_QUEUE_URL}/${FAL_MODELS.FLUX_KONTEXT_PRO_T2I}/requests/${requestId}/status`;
      const resultUrl = submitRes.data?.response_url || `${FAL_QUEUE_URL}/${FAL_MODELS.FLUX_KONTEXT_PRO_T2I}/requests/${requestId}`;
      if (!requestId) throw new Error(`No request_id returned from Flux Kontext Pro queue — response: ${JSON.stringify(submitRes.data)}`);
      response = { data: await pollFalQueueResult(statusUrl, resultUrl, { tag: 'Flux Kontext Pro T2I' }) };
    }

    const tempUrl = response.data?.images?.[0]?.url;
    if (!tempUrl) {
      return { success: false, error: 'Flux Kontext Pro returned no image' };
    }

    logger.log('[FAL] ✅ Image generated with Flux Pro Kontext');
    const downloaded = await downloadImageAsBase64(tempUrl);
    if (!downloaded) {
      return { success: true, imageUrl: tempUrl, provider: 'fal-flux-kontext-pro' as any };
    }

    const permanentUrl = await uploadBase64ToStorage(
      downloaded.base64,
      downloaded.mimeType,
      options.outputFolder || 'financial-images'
    );

    return {
      success: true,
      imageUrl: permanentUrl,
      imageBase64: downloaded.base64,
      provider: 'fal-flux-kontext-pro' as any,
    };
  } catch (error: any) {
    logger.warn(`[FAL] Flux Kontext Pro failed: ${error.response?.data?.detail || error.message}`);
    return { success: false, error: error.response?.data?.detail || error.message };
  }
}

/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES - OpenAI GPT Image 1 (Modelo más avanzado)
 * ============================================================
 * Modelo: gpt-image-1 — El modelo de generación de imágenes más avanzado de OpenAI.
 * Genera imágenes fotorrealistas de altísima calidad, ideal para retratos de artistas.
 * Usa la API de OpenAI directamente (NO a través de FAL).
 * Requiere OPENAI_API_KEY.
 */
export async function generateImageWithGPTImage1(
  prompt: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
    quality?: 'low' | 'medium' | 'high';
  } = {}
): Promise<FalImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  try {
    logger.log('[OPENAI] 🎨 Generating image with GPT Image 1 (most advanced model)...');
    logger.log(`[OPENAI] Prompt: ${prompt.substring(0, 150)}...`);

    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'high',
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );

    // gpt-image-1 returns b64_json by default
    const b64Data = response.data?.data?.[0]?.b64_json;
    const imageUrl = response.data?.data?.[0]?.url;

    if (b64Data) {
      logger.log('[OPENAI] ✅ Image generated with GPT Image 1 (base64)');
      const base64WithPrefix = `data:image/png;base64,${b64Data}`;
      const permanentUrl = await uploadBase64ToStorage(
        b64Data,
        'image/png',
        'artist-images'
      );
      return {
        success: true,
        imageUrl: permanentUrl,
        imageBase64: base64WithPrefix,
        provider: 'gemini-fallback' as any,
      };
    } else if (imageUrl) {
      logger.log('[OPENAI] ✅ Image generated with GPT Image 1 (url)');
      const downloaded = await downloadImageAsBase64(imageUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(
          downloaded.base64,
          downloaded.mimeType,
          'artist-images'
        );
        return {
          success: true,
          imageUrl: permanentUrl,
          imageBase64: downloaded.base64,
          provider: 'gemini-fallback' as any,
        };
      }
      return { success: true, imageUrl, provider: 'gemini-fallback' as any };
    }

    throw new Error('No image data in GPT Image 1 response');
  } catch (error: any) {
    logger.error('[OPENAI] ❌ GPT Image 1 generation failed:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * ============================================================
 * EDICIÓN DE IMÁGENES - OpenAI gpt-image-1 (image edit / referencia)
 * ============================================================
 * Usa el endpoint /v1/images/edits con gpt-image-1, pasando una o varias
 * imágenes de referencia (la foto del artista + logo maestro). Esto mantiene
 * la coherencia visual del producto con la identidad del artista, a diferencia
 * de la generación text-to-image pura. Sube el resultado a Firebase Storage.
 * Requiere OPENAI_API_KEY. Usa la API de OpenAI directamente (NO a través de FAL).
 */
export async function editImageWithGPTImage1(
  referenceImageUrls: string | string[],
  prompt: string,
  options: {
    size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
    quality?: 'low' | 'medium' | 'high' | 'auto';
    outputFolder?: string;
  } = {}
): Promise<FalImageResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { success: false, error: 'OPENAI_API_KEY not configured' };
  }

  const refs = (Array.isArray(referenceImageUrls) ? referenceImageUrls : [referenceImageUrls])
    .filter((u) => !!u && !u.includes('placeholder'))
    .slice(0, 4); // gpt-image-1 edit accepts multiple reference images
  if (refs.length === 0) {
    return { success: false, error: 'No reference image for gpt-image-1 edit' };
  }

  try {
    logger.log(`[OPENAI] ✏️ gpt-image-1 EDIT con ${refs.length} referencia(s)...`);

    // Build a multipart/form-data request with the reference image(s).
    const form = new FormData();
    form.append('model', 'gpt-image-1');
    form.append('prompt', prompt);
    form.append('size', options.size || '1024x1024');
    form.append('quality', options.quality || 'high');
    form.append('n', '1');

    for (let i = 0; i < refs.length; i++) {
      const dl = await downloadImageAsBase64(refs[i]);
      if (!dl) continue;
      const ext = (dl.mimeType.split('/')[1] || 'png').replace('jpeg', 'jpg');
      const blob = new Blob([Buffer.from(dl.base64, 'base64')], { type: dl.mimeType });
      // OpenAI accepts repeated `image[]` fields for multi-reference edits.
      form.append('image[]', blob, `ref_${i}.${ext}`);
    }

    const response = await axios.post(
      'https://api.openai.com/v1/images/edits',
      form,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        timeout: 180000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
      }
    );

    const b64Data = response.data?.data?.[0]?.b64_json;
    const directUrl = response.data?.data?.[0]?.url;
    const folder = options.outputFolder || 'merchandise-images';

    if (b64Data) {
      logger.log('[OPENAI] ✅ gpt-image-1 edit OK (base64)');
      const permanentUrl = await uploadBase64ToStorage(b64Data, 'image/png', folder);
      return {
        success: true,
        imageUrl: permanentUrl,
        imageBase64: `data:image/png;base64,${b64Data}`,
        provider: 'openai-gpt-image-1-edit' as any,
      };
    }
    if (directUrl) {
      const downloaded = await downloadImageAsBase64(directUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(downloaded.base64, downloaded.mimeType, folder);
        return { success: true, imageUrl: permanentUrl, imageBase64: downloaded.base64, provider: 'openai-gpt-image-1-edit' as any };
      }
      return { success: true, imageUrl: directUrl, provider: 'openai-gpt-image-1-edit' as any };
    }

    throw new Error('No image data in gpt-image-1 edit response');
  } catch (error: any) {
    logger.error('[OPENAI] ❌ gpt-image-1 edit failed:', error.response?.data?.error?.message || error.message);
    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
    };
  }
}

/**
 * ============================================================
 * DECORACIÓN DE BOUTIQUE 3D - OpenAI gpt-image-1
 * ============================================================
 * Genera un set de obras de arte mural para la tienda virtual 3D del artista
 * (boutique de lujo). Cada pieza se cuelga en las paredes del entorno 3D para
 * crear una experiencia de venta inmersiva y coherente con la identidad del
 * artista. Usa el modo EDICIÓN (con la foto del artista + logo maestro como
 * referencia) para mantener coherencia visual; si no hay referencias o falla,
 * cae a text-to-image puro. Las piezas se generan EN PARALELO.
 */
export interface BoutiqueDecorPiece {
  role: 'hero' | 'gallery-left' | 'gallery-right' | 'banner' | 'wall-texture' | 'floor-texture';
  label: string;
  imageUrl: string;
  provider?: string;
}

export async function generateBoutiqueDecorSet(
  artistName: string,
  genre: string,
  referenceImages: string[],
  brandColors?: { primary?: string; secondary?: string; accent?: string }
): Promise<BoutiqueDecorPiece[]> {
  const refs = (referenceImages || [])
    .filter((u) => !!u && typeof u === 'string' && /^https?:\/\//i.test(u) && !u.includes('placeholder'))
    .slice(0, 3);

  const palette = [brandColors?.primary, brandColors?.secondary, brandColors?.accent]
    .filter(Boolean)
    .join(', ') || 'deep neon brand tones';

  const styleBase =
    `Ultra high-end luxury fashion boutique wall art for the music artist "${artistName}" (${genre || 'music'} genre). ` +
    `Cohesive brand color palette: ${palette}. Futuristic premium gallery aesthetic, cinematic studio lighting, ` +
    `museum-grade editorial quality, designed to be framed and hung on the wall of a flagship designer store. ` +
    `IMPORTANT: this is decorative wall art only — no text watermarks, no UI, no borders, fill the whole frame.`;

  const pieces: Array<{ role: BoutiqueDecorPiece['role']; label: string; size: '1024x1536' | '1536x1024' | '1024x1024'; prompt: string; useRefs: boolean }> = [
    {
      role: 'hero',
      label: 'Hero Portrait',
      size: '1024x1536',
      useRefs: true,
      prompt:
        `${styleBase} HERO FEATURE WALL: a breathtaking large-format fashion-editorial portrait poster of this exact artist, ` +
        `striking confident pose, dramatic rim lighting, haute-couture wardrobe inspired by their brand, ` +
        `the artist's face and identity must remain perfectly recognizable. Vertical poster composition.`,
    },
    {
      role: 'gallery-left',
      label: 'Gallery Left',
      size: '1024x1536',
      useRefs: true,
      prompt:
        `${styleBase} GALLERY ARTWORK: an artistic black-and-white-meets-neon editorial photograph of this exact artist ` +
        `in a moody atmospheric setting, fashion magazine cover energy, the artist recognizable. Vertical composition.`,
    },
    {
      role: 'gallery-right',
      label: 'Gallery Right',
      size: '1024x1536',
      useRefs: false,
      prompt:
        `${styleBase} ABSTRACT BRAND ART: a luxurious abstract art panel — flowing liquid metal, light ribbons and ` +
        `geometric facets in the brand palette, no people, elegant and expensive looking, gallery centerpiece. Vertical composition.`,
    },
    {
      role: 'banner',
      label: 'Brand Banner',
      size: '1536x1024',
      useRefs: false,
      prompt:
        `${styleBase} BRAND BANNER: a sleek wide horizontal brand backdrop — soft gradient of the brand colors with ` +
        `subtle volumetric light, fine particles and a faint luxury monogram texture, no readable text, elegant negative space. Horizontal composition.`,
    },
    {
      role: 'wall-texture',
      label: 'Wall Material',
      size: '1024x1024',
      useRefs: false,
      prompt:
        `SEAMLESS TILEABLE TEXTURE (the four edges must tile perfectly when repeated): luxury flagship boutique interior WALL material ` +
        `for the music artist "${artistName}" (${genre || 'music'} genre). Dark sophisticated designer wall — fluted wood/stone panels or ` +
        `quilted leather or brushed dark metal with subtle inlays in the brand palette (${palette}). Perfectly flat frontal view, ` +
        `completely even diffuse lighting, no perspective, no shadows from objects, no people, no text, no logos, no frames. ` +
        `Photorealistic PBR-style albedo texture, repeating pattern, fills the entire frame edge to edge.`,
    },
    {
      role: 'floor-texture',
      label: 'Floor Material',
      size: '1024x1024',
      useRefs: false,
      prompt:
        `SEAMLESS TILEABLE TEXTURE (the four edges must tile perfectly when repeated): luxury boutique FLOOR material — ` +
        `large-format polished dark marble with elegant veining, subtle hints of the brand palette (${palette}) in the mineral veins, ` +
        `high-end flagship store flooring. Perfectly flat top-down view, completely even diffuse lighting, no perspective, ` +
        `no reflections of objects, no people, no text. Photorealistic PBR-style albedo texture, fills the entire frame edge to edge.`,
    },
  ];

  const results = await Promise.all(
    pieces.map(async (p) => {
      try {
        let r: FalImageResult = { success: false };
        if (p.useRefs && refs.length > 0) {
          r = await editImageWithGPTImage1(refs, p.prompt, {
            size: p.size,
            quality: 'high',
            outputFolder: 'boutique-decor',
          });
        }
        if (!r.success || !r.imageUrl) {
          r = await generateImageWithGPTImage1(p.prompt, { size: p.size, quality: 'high' });
        }
        if (r.success && r.imageUrl) {
          return { role: p.role, label: p.label, imageUrl: r.imageUrl, provider: r.provider } as BoutiqueDecorPiece;
        }
      } catch (err: any) {
        logger.error(`[BOUTIQUE-DECOR] piece "${p.role}" failed:`, err?.message || err);
      }
      return null;
    })
  );

  return results.filter((x): x is BoutiqueDecorPiece => !!x);
}

/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES - FAL AI NANO BANANA 2 (Text-to-Image)
 * ============================================================
 * Modelo: fal-ai/nano-banana-2
 * 
 * @param prompt - Descripción de la imagen a generar
 * @param options - Opciones adicionales (aspectRatio, numImages, outputFormat)
 */
export async function generateImageWithNanoBanana(
  prompt: string,
  options: {
    aspectRatio?: NanoBananaAspectRatio;
    numImages?: number;
    outputFormat?: 'jpeg' | 'png' | 'webp';
  } = {}
): Promise<FalImageResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🎨 Generando imagen con Nano Banana 2 (Text-to-Image)...`);
    logger.log(`[FAL] Prompt: ${prompt.substring(0, 100)}...`);

    // Parámetros para nano-banana-2: usa aspect_ratio directamente (no image_size)
    const requestBody = {
      prompt: prompt,
      num_images: options.numImages || 1,
      aspect_ratio: options.aspectRatio || '1:1',
      output_format: options.outputFormat || 'png',
    };

    logger.log(`[FAL] Request a nano-banana-2:`, JSON.stringify(requestBody));

    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.IMAGE_GENERATION}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    if (response.data?.images?.[0]?.url) {
      const tempUrl = response.data.images[0].url;
      logger.log(`[FAL] ✅ Imagen generada con Nano Banana 2`);

      // Log API usage
      logApiUsage({
        apiProvider: 'fal',
        endpoint: `fal-ai/nano-banana-2`,
        model: 'nano-banana-2',
        status: 'success',
        metadata: { function: 'generateImageWithNanoBanana' },
      }).catch(() => {});

      // Descargar y subir a Firebase Storage
      const downloaded = await downloadImageAsBase64(tempUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(
          downloaded.base64,
          downloaded.mimeType,
          'artist-images'
        );

        return {
          success: true,
          imageUrl: permanentUrl,
          imageBase64: downloaded.base64,
          provider: 'fal-flux-2-pro'
        };
      }
    }

    throw new Error('No se recibió imagen en la respuesta');
  } catch (error: any) {
    logger.error('[FAL] Error generando imagen con Flux 2 Pro:', error.response?.data || error.message);

    // 🤖 FALLBACK PRINCIPAL: OpenAI GPT Image 1 (modelo de imágenes de OpenAI).
    // Requisito del producto: si FAL falla, SIEMPRE usar el modelo de imágenes de OpenAI.
    logger.log('[FAL] 🤖 Intentando fallback con OpenAI GPT Image 1...');
    try {
      const gptImageResult = await generateImageWithGPTImage1(prompt, {
        size: mapAspectToGptImageSize(options.aspectRatio),
        quality: 'high',
      });
      if (gptImageResult.success && gptImageResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback OpenAI GPT Image 1 exitoso');
        return { ...gptImageResult, provider: 'openai-gpt-image-1' as any };
      }
    } catch (gptImageError: any) {
      logger.error('[FAL] ❌ Fallback OpenAI GPT Image 1 falló:', gptImageError.message);
    }

    // 🔧 FALLBACK: Intentar con Gemini cuando OpenAI también falla
    logger.log('[FAL] 🔄 Intentando fallback con Gemini...');
    try {
      const geminiService = await import('./gemini-image-service');
      const geminiResult = await geminiService.generateCinematicImage(prompt);
      
      if (geminiResult.success && geminiResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback Gemini exitoso');
        return {
          success: true,
          imageUrl: geminiResult.imageUrl,
          imageBase64: geminiResult.imageBase64,
          provider: 'gemini-fallback'
        };
      }
    } catch (geminiError: any) {
      logger.error('[FAL] ❌ Fallback Gemini también falló:', geminiError.message);
    }

    // 🤖 FALLBACK: OpenAI DALL-E 3 (por si la cuenta tuviera dall-e-3 habilitado)
    logger.log('[FAL] 🤖 Intentando fallback con OpenAI DALL-E 3...');
    try {
      const dalleResult = await generateImageWithOpenAI(prompt);
      if (dalleResult.success && dalleResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback OpenAI DALL-E exitoso');
        return dalleResult;
      }
    } catch (dalleError: any) {
      logger.error('[FAL] ❌ Fallback OpenAI DALL-E falló:', dalleError.message);
    }

    // � FALLBACK: Replicate (Flux Schnell / SDXL)
    logger.log('[FAL] 🔄 Intentando fallback con Replicate (Flux Schnell)...');
    try {
      const replicateResult = await generateImageWithReplicate(prompt, {
        aspectRatio: options.aspectRatio || '1:1',
      });
      if (replicateResult.success && replicateResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback Replicate exitoso');
        return replicateResult;
      }
    } catch (replicateError: any) {
      logger.error('[FAL] ❌ Fallback Replicate falló:', replicateError.message);
    }

    // �🔥 FALLBACK: FHDR Cloud (HF Inference Endpoint)
    logger.log('[FAL] ☁️ Intentando fallback con FHDR Cloud (HF Endpoint)...');
    try {
      const fhdrCloudResult = await generateImageWithFHDRCloud(prompt);
      if (fhdrCloudResult.success && fhdrCloudResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback FHDR Cloud exitoso');
        return fhdrCloudResult;
      }
    } catch (fhdrCloudError: any) {
      logger.error('[FAL] ❌ Fallback FHDR Cloud falló:', fhdrCloudError.message);
    }

    // 🔥 FALLBACK FINAL: FHDR Uncensored local (GPU)
    logger.log('[FAL] 🔥 Intentando fallback final con FHDR local...');
    try {
      const fhdrResult = await generateImageWithFHDR(prompt);
      if (fhdrResult.success && fhdrResult.imageUrl) {
        logger.log('[FAL] ✅ Fallback FHDR local exitoso');
        return fhdrResult;
      }
    } catch (fhdrError: any) {
      logger.error('[FAL] ❌ Fallback FHDR local también falló:', fhdrError.message);
    }

    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * ============================================================
 * POSTER GENERATION - FAL AI FLUX DEV (Alta Calidad)
 * ============================================================
 * Model: fal-ai/flux/dev
 * Cost: $0.025 per image (~5s generation)
 * 
 * Optimized for high-quality concept poster generation.
 * Uses Flux Dev for superior quality on first-impression posters.
 * Falls back to nano-banana-2 if Flux Dev fails.
 */
export async function generateFastPoster(
  prompt: string,
  options: {
    imageSize?: 'portrait_4_3' | 'portrait_16_9' | 'square' | 'landscape_4_3' | 'landscape_16_9';
    numImages?: number;
  } = {}
): Promise<FalImageResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🎬 Generando póster con Flux Dev (alta calidad)...`);

    const requestBody = {
      prompt: prompt,
      image_size: options.imageSize || 'portrait_4_3',
      num_images: options.numImages || 1,
      enable_safety_checker: false,
      num_inference_steps: 28,
      guidance_scale: 3.5,
    };

    const response = await axios.post(
      `${FAL_BASE_URL}/fal-ai/flux/dev`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000 // 60s timeout for Flux Dev (~5-10s per image)
      }
    );

    if (response.data?.images?.[0]?.url) {
      const tempUrl = response.data.images[0].url;
      logger.log(`[FAL] 🎬 ¡Póster generado con Flux Dev (alta calidad)!`);

      // Download and upload to Firebase Storage for permanence
      const downloaded = await downloadImageAsBase64(tempUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(
          downloaded.base64,
          downloaded.mimeType,
          'concept-posters'
        );

        return {
          success: true,
          imageUrl: permanentUrl,
          imageBase64: downloaded.base64,
          provider: 'fal-flux-dev'
        };
      }
    }

    // Fallback to nano-banana if Flux Dev fails
    logger.log('[FAL] 🔄 Flux Dev no devolvió imagen, fallback a nano-banana-2...');
    return generateImageWithNanoBanana(prompt, { aspectRatio: '3:4' });
  } catch (error: any) {
    logger.error('[FAL] Error con Flux Dev, fallback a nano-banana-2:', error.message);
    const nanoBananaResult = await generateImageWithNanoBanana(prompt, { aspectRatio: '3:4' });
    if (nanoBananaResult.success) return nanoBananaResult;

    // � FALLBACK: Replicate (Flux Schnell / SDXL)
    logger.log('[FAL] 🔄 Intentando Replicate (Flux Schnell)...');
    try {
      const replicateResult = await generateImageWithReplicate(prompt, { aspectRatio: '3:4' });
      if (replicateResult.success) return replicateResult;
    } catch (repErr: any) {
      logger.error('[FAL] ❌ Replicate falló:', repErr.message);
    }

    // �🔥 FALLBACK FINAL: FHDR Uncensored local si todo FAL + Gemini falló
    logger.log('[FAL] ☁️ Intentando FHDR Cloud (HF Endpoint)...');
    const fhdrCloudResult = await generateImageWithFHDRCloud(prompt);
    if (fhdrCloudResult.success) return fhdrCloudResult;

    logger.log('[FAL] 🔥 FHDR Cloud también falló, intentando FHDR local...');
    return generateImageWithFHDR(prompt);
  }
}

/**
 * ============================================================
 * EDICIÓN DE IMÁGENES - FAL AI NANO BANANA 2 EDIT (Image-to-Image)
 * ============================================================
 * Modelo: fal-ai/nano-banana-2/edit
 * 
 * @param imageUrls - Array de URLs de imágenes a usar como referencia
 * @param editPrompt - Instrucciones de edición
 * @param options - Opciones adicionales (aspectRatio, numImages)
 */
export async function editImageWithNanoBanana(
  imageUrls: string | string[],
  editPrompt: string,
  options: {
    aspectRatio?: NanoBananaAspectRatio;
    numImages?: number;
    outputFormat?: 'jpeg' | 'png' | 'webp';
    strength?: number; // 0.0 = keep original, 1.0 = fully new (default: ~0.85)
  } = {}
): Promise<FalImageResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] ✏️ Editando imagen con Nano Banana 2 (Image-to-Image)...`);
    logger.log(`[FAL] Prompt: ${editPrompt.substring(0, 100)}...`);
    if (options.strength !== undefined) {
      logger.log(`[FAL] Strength: ${options.strength}`);
    }

    // Convertir a array si es string único
    const imageUrlsArray = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    
    logger.log(`[FAL] Imágenes de referencia: ${imageUrlsArray.length}`);

    // nano-banana-2/edit usa image_urls (array) y aspect_ratio
    const requestBody: Record<string, any> = {
      prompt: editPrompt,
      image_urls: imageUrlsArray,
      num_images: options.numImages || 1,
      aspect_ratio: options.aspectRatio || '1:1',
      output_format: options.outputFormat || 'png',
    };

    // strength controls how much the AI changes the original (lower = preserve more)
    if (options.strength !== undefined) {
      requestBody.strength = options.strength;
    }

    logger.log(`[FAL] Request a nano-banana-2/edit:`, JSON.stringify(requestBody));

    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.IMAGE_EDIT}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      }
    );

    if (response.data?.images?.[0]?.url) {
      const tempUrl = response.data.images[0].url;
      logger.log(`[FAL] ✅ Imagen editada con Nano Banana 2 Edit`);

      const downloaded = await downloadImageAsBase64(tempUrl);
      if (downloaded) {
        const permanentUrl = await uploadBase64ToStorage(
          downloaded.base64,
          downloaded.mimeType,
          'artist-images-edited'
        );

        return {
          success: true,
          imageUrl: permanentUrl,
          imageBase64: downloaded.base64,
          provider: 'fal-flux-2-pro'
        };
      }
    }

    throw new Error('No se recibió imagen editada en la respuesta');
  } catch (error: any) {
    logger.error('[FAL] Error editando imagen con Flux 2 Pro:', error.response?.data || error.message);
    
    // 🎭 CONSISTENCY FIX: Retry with single reference before falling back without any reference
    const imageUrlsArray = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
    if (imageUrlsArray.length > 1) {
      logger.warn('[FAL] 🔄 Retrying with single reference image (first only)...');
      try {
        const retryResult = await editImageWithNanoBanana(
          [imageUrlsArray[0]], // Use only the first/frontal reference
          editPrompt,
          options
        );
        if (retryResult.success) {
          logger.log('[FAL] ✅ Retry with single reference succeeded');
          return retryResult;
        }
      } catch (retryError: any) {
        logger.warn('[FAL] ❌ Single reference retry also failed:', retryError.message);
      }
    }
    
    // Final fallback: generate without reference (LOGS WARNING for tracking)
    logger.warn('[FAL] ⚠️ FALLBACK: Generating WITHOUT face reference - consistency may be lost');
    return generateImageWithNanoBanana(editPrompt, { 
      aspectRatio: options.aspectRatio || '1:1' 
    });
  }
}

/**
 * Alias para editImageWithNanoBanana - usado por shot-variation-engine
 */
export const generateImageWithEdit = editImageWithNanoBanana;

/**
 * ============================================================
 * GENERACIÓN CON REFERENCIA FACIAL - FLUX 2 PRO
 * ============================================================
 * Usa Flux 2 Pro con image_url para mantener consistencia del rostro
 * 
 * @param prompt - Descripción de la imagen a generar
 * @param referenceImageUrl - URL de la imagen de referencia (rostro del artista)
 * @param options - Opciones adicionales
 */
export async function generateImageWithFaceReference(
  prompt: string,
  referenceImageUrl: string,
  options: {
    aspectRatio?: NanoBananaAspectRatio;
  } = {}
): Promise<FalImageResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 👤 Generando imagen con referencia facial usando Flux 2 Pro...`);

    // Verificar que la URL de referencia sea accesible
    if (!referenceImageUrl || referenceImageUrl.includes('placeholder')) {
      logger.warn('[FAL] No hay imagen de referencia válida, usando Flux 2 Pro (generación)');
      return generateImageWithNanoBanana(prompt, { aspectRatio: options.aspectRatio || '16:9' });
    }

    // Mejorar prompt para mantener la identidad facial
    const enhancedPrompt = `${prompt}. Maintain exact facial features and identity from the reference image. Same face, same person, same skin tone.`;

    // Usar Flux 2 Pro con la imagen de referencia
    return editImageWithNanoBanana(
      [referenceImageUrl],
      enhancedPrompt,
      { aspectRatio: options.aspectRatio || '16:9' }
    );

  } catch (error: any) {
    logger.error('[FAL] Error generando imagen con referencia:', error.response?.data || error.message);
    
    // Fallback: generar sin referencia
    return generateImageWithNanoBanana(prompt, { aspectRatio: options.aspectRatio || '16:9' });
  }
}

/**
 * ============================================================
 * GENERACIÓN DE MÚSICA - FAL AI MINIMAX MUSIC V2
 * ============================================================
 * Modelo: fal-ai/minimax-music/v2
 * Genera canciones completas con voces y letras
 * Precio: $0.03 por generación
 * 
 * @param stylePrompt - Descripción del estilo/género/mood (10-300 caracteres)
 *                      Ejemplo: "Pop, upbeat, energetic, catchy hooks, modern production"
 * @param lyricsPrompt - Letras de la canción con tags (10-3000 caracteres)
 *                       Tags soportados: [verse], [chorus], [bridge], [intro], [outro]
 *                       Ejemplo: "[verse]Walking down the street...\n[chorus]We are the champions..."
 * @param options - Opciones adicionales de audio
 */
export async function generateMusicWithMiniMax(
  stylePrompt: string,
  lyricsPrompt: string,
  options: {
    sampleRate?: 44100 | 32000 | 24000; // Sample rate (default: 44100)
    bitrate?: 32000 | 64000 | 128000 | 256000; // Bitrate (default: 128000)
    format?: 'mp3' | 'wav' | 'flac'; // Formato de salida (default: mp3)
  } = {}
): Promise<FalMusicResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] Generando música con MiniMax Music V2...`);
    logger.log(`[FAL] Estilo: ${stylePrompt.substring(0, 100)}...`);
    logger.log(`[FAL] Letras: ${lyricsPrompt.substring(0, 100)}...`);

    // Validar longitudes según API
    if (stylePrompt.length < 10 || stylePrompt.length > 300) {
      throw new Error('El prompt de estilo debe tener entre 10 y 300 caracteres');
    }
    if (lyricsPrompt.length < 10 || lyricsPrompt.length > 3000) {
      throw new Error('Las letras deben tener entre 10 y 3000 caracteres');
    }

    // Construir request body según API de minimax-music/v2
    const requestBody: any = {
      prompt: stylePrompt,
      lyrics_prompt: lyricsPrompt,
    };

    // Configuración de audio - SIEMPRE usar máxima calidad
    requestBody.audio_setting = {
      sample_rate: options.sampleRate || 44100,
      bitrate: options.bitrate || 256000, // Máximo bitrate disponible
      format: options.format || 'mp3'
    };

    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.MUSIC_GENERATION}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 600000 // 10 minutos para generación de música completa
      }
    );

    // MiniMax Music V2 devuelve audio.url
    const audioUrl = response.data?.audio?.url || response.data?.audio_url;
    if (audioUrl) {
      logger.log(`[FAL] Música generada exitosamente: ${audioUrl}`);

      // Log API usage
      logApiUsage({
        apiProvider: 'fal',
        endpoint: `fal-ai/minimax-music/v2`,
        model: 'minimax-music-v2',
        status: 'success',
        metadata: { function: 'generateMusicWithFAL' },
      }).catch(() => {});

      // Descargar audio y subir a Firebase Storage
      try {
        const audioResponse = await axios.get(audioUrl, {
          responseType: 'arraybuffer',
          timeout: 120000 // 2 minutos para descargar
        });
        const audioBase64 = Buffer.from(audioResponse.data).toString('base64');
        const mimeType = audioResponse.headers['content-type'] || 'audio/mpeg';

        // Subir a Firebase Storage
        const permanentUrl = await uploadBase64ToStorage(
          audioBase64,
          mimeType,
          'artist-music'
        );

        return {
          success: true,
          audioUrl: permanentUrl,
          audioBase64: audioBase64,
          lyrics: lyricsPrompt,
          provider: 'fal-minimax-music-v2'
        };
      } catch (uploadError: any) {
        logger.warn('[FAL] Error subiendo audio a Storage, usando URL temporal:', uploadError.message);
        return {
          success: true,
          audioUrl: audioUrl,
          lyrics: lyricsPrompt,
          provider: 'fal-minimax-music-v2'
        };
      }
    }

    throw new Error('No se recibió audio en la respuesta: ' + JSON.stringify(response.data));
  } catch (error: any) {
    logger.error('[FAL] Error generando música:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.detail || error.message
    };
  }
}

/**
 * ============================================================
 * GENERACIÓN DE IMÁGENES ULTRA-REALISTAS PARA ARTISTA
 * ============================================================
 * Pipeline: FAL Nano Banana 2 → Fallback: OpenAI GPT Image 1 (API directa)
 * 
 * Genera imágenes de perfil y portada con prompts de nivel fotográfico profesional.
 * Los prompts incluyen especificaciones técnicas de cámara, lente, iluminación
 * y dirección artística para producir resultados de nivel editorial.
 */
export async function generateArtistImagesWithFAL(
  artistDescription: string,
  artistName: string,
  genre: string
): Promise<{ profileUrl: string; coverUrl: string }> {
  logger.log(`[ARTIST-IMG] 🎨 Generando imágenes ultra-realistas para: ${artistName} (${genre})`);

  // ═══════════════════════════════════════════════════════════════
  // ESTÉTICA VISUAL POR GÉNERO — dirección artística completa
  // ═══════════════════════════════════════════════════════════════
  const genreStyles: Record<string, {
    visual: string;
    lighting: string;
    mood: string;
    camera: string;
    environment: string;
    wardrobe: string;
  }> = {
    'pop': {
      visual: 'clean, modern, high-fashion editorial',
      lighting: 'Profoto B10 beauty dish with white fill card, Rembrandt lighting pattern, subtle rim light separation',
      mood: 'confident, approachable, magnetic star quality',
      camera: 'Canon EOS R5, RF 85mm f/1.2L USM, f/2.0, ISO 100',
      environment: 'minimalist studio with seamless white/gradient backdrop',
      wardrobe: 'designer contemporary fashion, tailored fit, statement piece'
    },
    'hip-hop': {
      visual: 'bold, luxurious, powerful presence',
      lighting: 'dramatic Paramount lighting with strong shadows, two strip softboxes for edge definition, tungsten warmth',
      mood: 'commanding, intense, unapologetic self-assurance',
      camera: 'Sony A7R V, 85mm GM f/1.4, f/1.8, ISO 200',
      environment: 'dark textured concrete wall or luxury car interior',
      wardrobe: 'designer streetwear, chains, premium watch, luxury brand visible'
    },
    'rap': {
      visual: 'gritty, urban, raw authenticity mixed with luxury',
      lighting: 'harsh side lighting with neon color gel accents (magenta/cyan), deep shadows, cinematic contrast ratio 4:1',
      mood: 'intense, fearless, street royalty, alpha energy',
      camera: 'Nikon Z9, 50mm f/1.2 S, f/1.4, ISO 400, slight grain',
      environment: 'urban rooftop at twilight, city skyline bokeh, or studio with smoke haze',
      wardrobe: 'oversized designer, heavy chains, grillz optional, face tattoos if edgy'
    },
    'electronic': {
      visual: 'futuristic, sleek, cyberpunk-adjacent',
      lighting: 'LED strip lights in ultraviolet and electric blue, volumetric haze, backlit silhouette edges',
      mood: 'mysterious, visionary, otherworldly transcendence',
      camera: 'Sony A1, 35mm f/1.4 GM, f/2.0, ISO 800, cool white balance 4200K',
      environment: 'dark studio with projected geometric light patterns, fog machine atmosphere',
      wardrobe: 'tech-wear, reflective materials, angular sunglasses, minimal jewelry'
    },
    'rock': {
      visual: 'edgy, raw, rebellious with classic rock DNA',
      lighting: 'single harsh tungsten key light, deep shadows, high contrast black and white optional',
      mood: 'rebellious, untamed, dangerous charisma',
      camera: 'Leica SL2, Summilux 50mm f/1.4, f/2.0, ISO 400, crushed blacks',
      environment: 'dimly lit rehearsal space, exposed brick, vintage amplifiers in background',
      wardrobe: 'worn leather jacket, band tee or open shirt, silver rings, messy styled hair'
    },
    'indie': {
      visual: 'artistic, authentic, film photography aesthetic',
      lighting: 'natural window light, golden hour warmth, soft diffused shadows',
      mood: 'introspective, genuine, poetically vulnerable',
      camera: 'Fujifilm GFX 100S, GF 80mm f/1.7, f/2.2, Kodak Portra 400 film simulation',
      environment: 'cozy room with plants and vinyl records, or outdoor field at golden hour',
      wardrobe: 'vintage thrift store finds, earth tones, layered textures, hand-crafted accessories'
    },
    'r&b': {
      visual: 'sensual, elegant, warm luxury',
      lighting: 'warm 3200K key light through silk diffusion, subtle hair light, golden reflector fill',
      mood: 'seductive, soulful, effortlessly sophisticated',
      camera: 'Hasselblad X2D 100C, XCD 90mm f/2.5, f/2.5, ISO 100, rich skin tones',
      environment: 'luxury penthouse, velvet curtains, warm ambient candle-like lighting',
      wardrobe: 'silk shirt or elegant minimal outfit, gold jewelry, immaculate grooming'
    },
    'jazz': {
      visual: 'timeless, sophisticated, classic elegance',
      lighting: 'warm tungsten spotlight from above, smoky atmosphere, chiaroscuro reminiscent of Blue Note album covers',
      mood: 'wise, elegant, deeply soulful',
      camera: 'Leica M11, Noctilux 50mm f/0.95, f/1.4, ISO 800, classic black and white processing',
      environment: 'intimate jazz club stage, microphone stand, warm wood tones, low-key ambience',
      wardrobe: 'tailored suit or classic dress, fedora optional, vintage watch, refined elegance'
    },
    'country': {
      visual: 'authentic, warm, American heartland beauty',
      lighting: 'golden hour natural sunlight, warm fill from reflector, sun flares',
      mood: 'genuine, warm-hearted, storyteller with soul',
      camera: 'Canon EOS R5, RF 85mm f/1.2L, f/1.8, ISO 200, warm tones 5800K',
      environment: 'rustic barn doorway, open field, or porch with rocking chair, natural landscape',
      wardrobe: 'denim jacket, boots, cowboy hat optional, flannel, genuine worn-in look'
    },
    'latin': {
      visual: 'vibrant, passionate, sun-kissed tropical elegance',
      lighting: 'warm natural Caribbean light, golden reflections, colorful rim lights in orange and gold',
      mood: 'passionate, joyful, magnetic tropical energy',
      camera: 'Sony A7 IV, 85mm f/1.4 GM, f/1.8, ISO 200, vivid color science',
      environment: 'colorful Havana-style wall, palm trees, tropical sunset backdrop',
      wardrobe: 'linen shirt or flowing dress, gold jewelry, colorful accents, effortless tropical style'
    },
    'reggaeton': {
      visual: 'bold, flashy, urban Latin luxury',
      lighting: 'neon club lighting in pink/purple/blue, dramatic rim lights, party atmosphere dark key',
      mood: 'party king/queen, magnetic, unstoppable confidence',
      camera: 'Sony A7R V, 50mm f/1.2 GM, f/1.4, ISO 800, punchy contrast',
      environment: 'VIP club booth, neon signs, luxury car hood, or nighttime rooftop with city lights',
      wardrobe: 'designer streetwear, heavy chains, designer sunglasses, flashy watch, bold colors'
    },
    'afrobeat': {
      visual: 'vibrant, cultural, powerful African contemporary',
      lighting: 'warm golden light with colorful gel accents, natural sun mixed with studio',
      mood: 'joyful, powerful, culturally rooted royalty',
      camera: 'Canon EOS R5, RF 85mm f/1.2L, f/1.8, ISO 200, rich warm tones',
      environment: 'colorful African textile backdrop or outdoor with tropical vegetation',
      wardrobe: 'contemporary African fashion, bold prints, gold accessories, cultural pride'
    },
    'trap': {
      visual: 'dark, moody, menacing luxury',
      lighting: 'low-key dramatic side lighting, red or purple gel accents, heavy shadows',
      mood: 'stoic, dangerous, untouchable',
      camera: 'Sony A1, 35mm f/1.4 GM, f/1.4, ISO 1600, crushed blacks, slight grain',
      environment: 'dark studio with smoke, or nighttime parking garage with headlights',
      wardrobe: 'all black designer, face mask optional, diamond jewelry, lean aesthetic'
    },
  };

  const style = genreStyles[genre.toLowerCase()] || genreStyles['pop'];

  // ═══════════════════════════════════════════════════════════════
  // PROFILE IMAGE — Retrato ultra-realista nivel editorial
  // ═══════════════════════════════════════════════════════════════
  const profilePrompt = [
    `Ultra-photorealistic editorial portrait photograph of a real ${genre} music artist.`,
    `Physical appearance: ${artistDescription}.`,
    `Shot on ${style.camera}.`,
    `Lighting: ${style.lighting}.`,
    `Environment: ${style.environment}.`,
    `Wardrobe & styling: ${style.wardrobe}.`,
    `Expression and mood: ${style.mood}.`,
    `Composition: tight headshot to upper chest, shallow depth of field with creamy bokeh background,`,
    `subject perfectly sharp on the eyes, catchlight visible in both pupils.`,
    `Style: ${style.visual}.`,
    `This must look like a real photograph taken by Annie Leibovitz or Tim Walker for Rolling Stone magazine cover.`,
    `Absolutely photorealistic — real human skin texture with visible pores, natural skin imperfections,`,
    `individual hair strands, realistic eye reflections, natural subsurface scattering on skin.`,
    `NOT illustration, NOT digital art, NOT anime, NOT 3D render. A real photograph of a real person.`,
    `Professional retouching: subtle frequency separation, dodge and burn contouring, clean but natural skin.`,
  ].join(' ');

  // ═══════════════════════════════════════════════════════════════
  // COVER IMAGE — Foto editorial cinematográfica
  // ═══════════════════════════════════════════════════════════════
  const coverPrompt = [
    `Cinematic widescreen editorial photograph of a real ${genre} music artist in a dynamic pose.`,
    `Physical appearance: ${artistDescription}.`,
    `Shot on ${style.camera} — wide composition, 16:9 aspect ratio.`,
    `Lighting: ${style.lighting}.`,
    `Environment: ${style.environment} — full environmental context visible.`,
    `Wardrobe & styling: ${style.wardrobe}.`,
    `The artist appears natural, mid-action or candid moment — NOT posing stiffly.`,
    `Medium to full body framing, environmental portrait with depth.`,
    `Mood and atmosphere: ${style.mood}. ${style.visual} aesthetic.`,
    `This looks like a real behind-the-scenes photograph for Vogue, GQ, or Billboard editorial spread.`,
    `Photorealistic: real human with natural skin texture, visible pores, real fabric wrinkles,`,
    `environmental lighting interaction, authentic shadow casting, real photographic lens characteristics.`,
    `NOT illustration, NOT AI-looking, NOT plastic skin. A genuine editorial photograph.`,
  ].join(' ');

  logger.log(`[ARTIST-IMG] 📸 Profile prompt (${profilePrompt.length} chars)`);
  logger.log(`[ARTIST-IMG] 📸 Cover prompt (${coverPrompt.length} chars)`);

  // ═══════════════════════════════════════════════════════════════
  // PIPELINE: FAL Nano Banana 2 → Fallback → OpenAI GPT Image 1
  // ═══════════════════════════════════════════════════════════════
  let profileUrl: string | undefined;
  let coverUrl: string | undefined;

  // --- PROFILE IMAGE ---
  try {
    logger.log('[ARTIST-IMG] 🔵 Intentando perfil con FAL Nano Banana 2...');
    const profileResult = await generateImageWithNanoBanana(profilePrompt, { aspectRatio: '1:1' });
    if (profileResult.success && profileResult.imageUrl) {
      profileUrl = profileResult.imageUrl;
      logger.log('[ARTIST-IMG] ✅ Perfil generado con FAL Nano Banana 2');
    }
  } catch (falError: any) {
    logger.warn(`[ARTIST-IMG] ⚠️ FAL falló para perfil: ${falError.message}`);
  }

  if (!profileUrl) {
    logger.log('[ARTIST-IMG] 🟠 Fallback → OpenAI GPT Image 1 para perfil...');
    const openaiResult = await generateImageWithGPTImage1(profilePrompt, {
      size: '1024x1024',
      quality: 'high'
    });
    if (openaiResult.success && openaiResult.imageUrl) {
      profileUrl = openaiResult.imageUrl;
      logger.log('[ARTIST-IMG] ✅ Perfil generado con OpenAI GPT Image 1');
    } else {
      throw new Error(`Error generando perfil — FAL y OpenAI fallaron: ${openaiResult.error}`);
    }
  }

  // Pequeño delay para evitar rate limiting
  await new Promise(resolve => setTimeout(resolve, 2000));

  // --- COVER IMAGE ---
  try {
    logger.log('[ARTIST-IMG] 🔵 Intentando cover con FAL Nano Banana 2...');
    const coverResult = await generateImageWithNanoBanana(coverPrompt, { aspectRatio: '16:9' });
    if (coverResult.success && coverResult.imageUrl) {
      coverUrl = coverResult.imageUrl;
      logger.log('[ARTIST-IMG] ✅ Cover generado con FAL Nano Banana 2');
    }
  } catch (falError: any) {
    logger.warn(`[ARTIST-IMG] ⚠️ FAL falló para cover: ${falError.message}`);
  }

  if (!coverUrl) {
    logger.log('[ARTIST-IMG] 🟠 Fallback → OpenAI GPT Image 1 para cover...');
    const openaiResult = await generateImageWithGPTImage1(coverPrompt, {
      size: '1536x1024',
      quality: 'high'
    });
    if (openaiResult.success && openaiResult.imageUrl) {
      coverUrl = openaiResult.imageUrl;
      logger.log('[ARTIST-IMG] ✅ Cover generado con OpenAI GPT Image 1');
    } else {
      throw new Error(`Error generando cover — FAL y OpenAI fallaron: ${openaiResult.error}`);
    }
  }

  logger.log(`[ARTIST-IMG] 🎉 Imágenes completas para ${artistName} — perfil + cover generados`);
  return { profileUrl, coverUrl };
}

/**
 * ============================================================
 * GENERACIÓN DE CANCIÓN PARA ARTISTA - MINIMAX MUSIC V2
 * ============================================================
 * Genera una canción completa con voces y letras para un artista tokenizado
 * Modelo: fal-ai/minimax-music/v2 - $0.03 por generación
 * Calidad: Bitrate 256kbps (máximo) - Letras profesionales
 * 
 * @param artistName - Nombre del artista
 * @param songTitle - Título de la canción
 * @param genre - Género musical (pop, hip-hop, rap, electronic, rock, etc.)
 * @param mood - Estado de ánimo (energetic, melancholic, upbeat, etc.)
 * @param artistGender - Género del artista: 'male' | 'female' (para tipo de voz)
 * @param customLyrics - Letras personalizadas (opcional, si no se proporciona se generan con AI)
 * @param artistBio - Biografía del artista (opcional, solo para estilo vocal)
 * @param artistDNA - Identidad artística completa para coherencia en generación
 */
export async function generateArtistSongWithFAL(
  artistName: string,
  songTitle: string,
  genre: string,
  mood?: string,
  artistGender: 'male' | 'female' = 'male',
  customLyrics?: string,
  artistBio?: string,
  artistDNA?: { biography?: string; musicGenres?: string[]; moodVibe?: string; lookDescription?: string; influences?: string[]; vocalStyle?: string; productionStyle?: string; signatureSound?: string; moodKeywords?: string[]; lyricThemes?: string[] }
): Promise<FalMusicResult> {
  logger.log(`[FAL] 🎵 HIT MACHINE: Generando hit mundial "${songTitle}" para ${artistName} (${genre}) - Voz: ${artistGender}`);

  // Importar el generador de letras con IA
  const { generateHitLyrics, getProductionPrompt } = await import('./ai-lyrics-generator');

  const songMood = mood || 'energetic';
  
  // Mapear tipo de voz según género del artista (para el prompt de producción)
  const vocalStyles: Record<string, { male: string; female: string }> = {
    'pop': { 
      male: 'clear powerful male tenor vocals, smooth falsetto, emotional delivery',
      female: 'bright powerful female vocals, crystal clear high notes, expressive delivery'
    },
    'hip-hop': { 
      male: 'confident male rapper, melodic trap vocals, smooth delivery with ad-libs',
      female: 'fierce female rapper, powerful flow, commanding presence'
    },
    'rap': { 
      male: 'aggressive male rapper, rapid-fire flow, powerful delivery, lyrical precision',
      female: 'fierce female MC, switching flows, confident and bold delivery'
    },
    'electronic': { 
      male: 'ethereal male vocals, processed harmonies, emotional electronic',
      female: 'angelic female vocals, soaring high notes, euphoric delivery'
    },
    'rock': { 
      male: 'powerful male rock vocals, raw emotional delivery, soaring melodies',
      female: 'fierce female rock vocals, powerful range, passionate delivery'
    },
    'indie': { 
      male: 'soft introspective male vocals, falsetto, vulnerable delivery, emotional nuance',
      female: 'ethereal female vocals, delicate delivery, haunting beauty'
    },
    'r&b': { 
      male: 'smooth soulful male vocals, falsetto runs, romantic and sensual delivery',
      female: 'sultry female R&B vocals, melismatic runs, passionate and commanding'
    },
    'jazz': { 
      male: 'smooth male jazz vocals, sophisticated phrasing, elegant delivery',
      female: 'sultry female jazz vocals, intimate phrasing, smoky elegance'
    },
    'country': { 
      male: 'authentic male country vocals, storytelling delivery, heartfelt emotion',
      female: 'powerful female country vocals, emotional range, genuine delivery'
    },
    'latin': { 
      male: 'passionate male Latin vocals, rhythmic flow, charismatic delivery',
      female: 'fiery female Latin vocals, passionate delivery, rhythmic precision'
    },
    'reggaeton': { 
      male: 'energetic male reggaeton vocals, catchy hooks, party energy with swagger',
      female: 'fierce female reggaeton vocals, powerful hooks, commanding presence'
    },
    'reggae': {
      male: 'smooth Jamaican male vocals, roots reggae toasting, laid-back island delivery with patois inflections',
      female: 'warm female reggae vocals, melodic island delivery, soulful roots style'
    },
    'soul': {
      male: 'powerful male soul vocals, gospel-influenced runs, raw emotional delivery with falsetto',
      female: 'powerhouse female soul vocals, melismatic runs, Aretha-level emotional intensity'
    },
    'blues': {
      male: 'gritty male blues vocals, raspy emotional delivery, storytelling growl with authority',
      female: 'powerful female blues vocals, raw emotional grit, soulful and commanding'
    },
    'gospel': {
      male: 'powerful male gospel vocals, praise shouts, soaring runs, congregational energy',
      female: 'soaring female gospel vocals, spirit-filled runs, powerful praise delivery'
    },
    'afrobeat': {
      male: 'smooth male Afrobeats vocals, melodic flow, Wizkid-style delivery with Yoruba inflections',
      female: 'sweet female Afrobeats vocals, melodic and rhythmic, Tems-style ethereal delivery'
    },
    'trap': {
      male: 'dark male trap vocals, aggressive ad-libs, autotune melodic delivery, Atlanta style',
      female: 'fierce female trap vocals, hard-hitting flow, confident delivery with ad-libs'
    },
    'k-pop': {
      male: 'crisp male K-pop vocals, precise pitch, rap-to-singing switches, high energy dance pop delivery',
      female: 'sweet powerful female K-pop vocals, perfectly tuned, cute to fierce range, dance pop delivery'
    },
    'dancehall': {
      male: 'energetic male dancehall vocals, Jamaican patois toasting, rhythmic and bouncy delivery',
      female: 'fierce female dancehall vocals, confident patois flow, commanding party energy'
    },
    'lo-fi': {
      male: 'soft whispered male vocals, intimate bedroom recording feel, gentle and dreamy',
      female: 'soft breathy female vocals, intimate whisper delivery, lo-fi warmth'
    },
    'house': {
      male: 'soulful male house vocals, diva-style hooks, uplifting and groovy delivery',
      female: 'powerful female house diva vocals, soaring hooks, euphoric dance delivery'
    },
    'techno': {
      male: 'minimal processed male vocals, spoken word fragments, robotic and hypnotic',
      female: 'ethereal processed female vocals, mantra-like repetition, dark and hypnotic'
    },
    'ambient': {
      male: 'ethereal whispered male vocals, processed vocal textures, atmospheric and spacious',
      female: 'angelic female vocal pads, whispered textures, dissolving into atmosphere'
    },
    'disco': {
      male: 'smooth funky male disco vocals, falsetto hooks, groovy Saturday night delivery',
      female: 'powerful female disco diva vocals, commanding hooks, glamorous and funky'
    },
    'funk': {
      male: 'groovy male funk vocals, James Brown energy, rhythmic shouts and grunts, tight delivery',
      female: 'fierce funky female vocals, rhythmic precision, sassy and groovy delivery'
    },
    'metal': {
      male: 'powerful male metal vocals, screaming to clean contrast, aggressive and epic delivery',
      female: 'fierce female metal vocals, symphonic power, screaming to operatic range'
    },
    'punk': {
      male: 'raw shouting male punk vocals, fast aggressive delivery, no-frills attitude',
      female: 'fierce female punk vocals, shouting energy, rebellious and raw delivery'
    },
  };

  // Smart fallback: map similar genres before defaulting to pop
  const GENRE_FALLBACK: Record<string, string> = {
    'r&b': 'r&b', 'rnb': 'r&b', 'neo-soul': 'soul', 'neo soul': 'soul',
    'bedroom pop': 'lo-fi', 'dream pop': 'indie', 'synth-pop': 'electronic',
    'synthpop': 'electronic', 'edm': 'electronic', 'dance': 'house',
    'deep house': 'house', 'tech house': 'house', 'progressive house': 'electronic',
    'dubstep': 'electronic', 'drum and bass': 'electronic', 'dnb': 'electronic',
    'hard rock': 'rock', 'alt rock': 'rock', 'alternative': 'indie',
    'grunge': 'rock', 'emo': 'rock', 'pop rock': 'rock', 'pop-rock': 'rock',
    'hip hop': 'hip-hop', 'hiphop': 'hip-hop', 'boom bap': 'hip-hop',
    'old school hip hop': 'hip-hop', 'conscious rap': 'rap',
    'latin pop': 'latin', 'latin trap': 'trap', 'latin urban': 'reggaeton',
    'salsa': 'latin', 'bachata': 'latin', 'cumbia': 'latin', 'merengue': 'latin',
    'bossa nova': 'jazz', 'smooth jazz': 'jazz', 'acid jazz': 'jazz',
    'ska': 'reggae', 'dub': 'reggae', 'roots reggae': 'reggae',
    'afro pop': 'afrobeat', 'afropop': 'afrobeat', 'afrobeats': 'afrobeat',
    'amapiano': 'afrobeat', 'grime': 'trap',
    'death metal': 'metal', 'heavy metal': 'metal', 'thrash metal': 'metal',
    'metalcore': 'metal', 'deathcore': 'metal',
    'pop punk': 'punk', 'hardcore': 'punk', 'post-punk': 'punk',
    'nu metal': 'metal', 'post-rock': 'rock',
    'classical': 'ambient', 'new age': 'ambient', 'chillout': 'lo-fi',
    'chill': 'lo-fi', 'lofi': 'lo-fi',
    'motown': 'soul', 'neo r&b': 'r&b',
  };

  const resolveGenre = (g: string): string => {
    const lower = g.toLowerCase().trim();
    // Direct match first
    if (vocalStyles[lower]) return lower;
    // Fallback map
    const mapped = GENRE_FALLBACK[lower];
    if (mapped && vocalStyles[mapped]) return mapped;
    // Default
    return 'pop';
  };

  const resolvedGenre = resolveGenre(genre);
  // If blueprint provides a custom vocal style, use it; otherwise fall back to the genre table
  const vocalStyle = artistDNA?.vocalStyle || vocalStyles[resolvedGenre][artistGender];

  if (resolvedGenre !== genre.toLowerCase()) {
    logger.log(`[FAL] 🎵 Genre mapping: "${genre}" → "${resolvedGenre}"`);
  }
  
  let lyricsPrompt: string;
  let stylePrompt: string;
  
  if (customLyrics) {
    // Usar letras personalizadas, asegurando que tengan tags
    lyricsPrompt = customLyrics.includes('[verse]') || customLyrics.includes('[chorus]') 
      ? customLyrics 
      : `[verse]\n${customLyrics}`;
    // Blueprint production style overrides the generic prompt when available
    const baseProduction = artistDNA?.productionStyle || getProductionPrompt(resolvedGenre, songMood);
    const signatureAddOn = artistDNA?.signatureSound ? `, ${artistDNA.signatureSound}` : '';
    stylePrompt = `${baseProduction}${signatureAddOn}, ${vocalStyle}`.substring(0, 300);
  } else {
    // 🎵 GENERAR LETRAS CON IA - HIT MACHINE
    logger.log(`[FAL] 🤖 Generando letras con AI Hit Machine...`);
    
    try {
      const hitResult = await generateHitLyrics({
        artistName,
        songTitle,
        genre: resolvedGenre,
        mood: songMood,
        artistGender,
        artistBio,
        artistDNA
      });
      
      lyricsPrompt = hitResult.lyrics;
      // Blueprint production style overrides the generic prompt when available
      const baseProduction = artistDNA?.productionStyle || hitResult.productionPrompt;
      const signatureAddOn = artistDNA?.signatureSound ? `, ${artistDNA.signatureSound}` : '';
      stylePrompt = `${baseProduction}${signatureAddOn}, ${vocalStyle}`.substring(0, 300);
      
      logger.log(`[FAL] ✅ Hit generado - Tema: "${hitResult.theme}"`);
      logger.log(`[FAL] 🎤 Hook: "${hitResult.hookLine.substring(0, 50)}..."`);
    } catch (aiError) {
      logger.warn(`[FAL] ⚠️ AI lyrics failed, using fallback:`, aiError);
      lyricsPrompt = generateLyricsForGenreFallback(artistName, songTitle, resolvedGenre, songMood, artistGender, customLyrics);
      const baseProduction = artistDNA?.productionStyle || getProductionPrompt(resolvedGenre, songMood);
      stylePrompt = `${baseProduction}, ${vocalStyle}`.substring(0, 300);
    }
  }

  // Asegurar que las letras cumplen el mínimo de 10 caracteres
  if (lyricsPrompt.length < 10) {
    lyricsPrompt = `[verse]\nThis is the story of ${artistName}\n[chorus]\n${songTitle}, yeah ${songTitle}`;
  }

  // Truncar letras a 3000 caracteres (límite de MiniMax)
  if (lyricsPrompt.length > 3000) {
    lyricsPrompt = lyricsPrompt.substring(0, 2990) + '\n[outro]';
  }

  logger.log(`[FAL] 🎹 Estilo de producción: ${stylePrompt.substring(0, 100)}...`);
  logger.log(`[FAL] 📝 Letras (${lyricsPrompt.length} chars): ${lyricsPrompt.substring(0, 150)}...`);

  return generateMusicWithMiniMax(stylePrompt, lyricsPrompt);
}

/**
 * Fallback lyrics generator (cuando falla OpenAI)
 * 🔧 FIX: Ahora acepta customLyrics para usar la letra real si existe
 */
function generateLyricsForGenreFallback(
  artistName: string,
  songTitle: string,
  genre: string,
  mood: string,
  artistGender: 'male' | 'female',
  customLyrics?: string // 🔧 Nuevo parámetro opcional
): string {
  // 🔧 Si hay letras personalizadas, formatearlas y usarlas
  if (customLyrics && customLyrics.trim().length > 20) {
    logger.log(`[FAL] 📝 Usando letras personalizadas en fallback (${customLyrics.length} chars)`);
    
    // Asegurar formato básico si no tiene tags
    if (!customLyrics.includes('[verse]') && !customLyrics.includes('[chorus]')) {
      // Dividir la letra en secciones estimadas
      const lines = customLyrics.split('\n').filter(l => l.trim());
      const linesPerSection = Math.ceil(lines.length / 4);
      
      let formatted = `[intro]\n${artistName}\n\n`;
      formatted += `[verse]\n${lines.slice(0, linesPerSection).join('\n')}\n\n`;
      formatted += `[chorus]\n${lines.slice(linesPerSection, linesPerSection * 2).join('\n')}\n\n`;
      formatted += `[verse]\n${lines.slice(linesPerSection * 2, linesPerSection * 3).join('\n')}\n\n`;
      formatted += `[outro]\n${lines.slice(linesPerSection * 3).join('\n') || songTitle}`;
      
      return formatted;
    }
    
    return customLyrics;
  }

  // Fallback genérico si no hay letras personalizadas
  const hooks: Record<string, string[]> = {
    'pop': ['tonight', 'forever', 'one more time', 'never let go'],
    'hip-hop': ['on top', 'made it', 'real ones', 'we up'],
    'rap': ['legend', 'untouchable', 'king', 'history'],
    'electronic': ['feel it', 'higher', 'together', 'let go'],
    'rock': ['we are', 'stand up', 'never back down', 'alive'],
    'r&b': ['all night', 'close to me', 'feel you', 'only you'],
    'reggaeton': ['dale', 'baila', 'toda la noche', 'fuego'],
    'latin': ['corazón', 'bailamos', 'mi amor', 'contigo'],
    'indie': ['remember when', 'quietly', 'fade away', 'stay'],
    'country': ['this town', 'back home', 'friday nights', 'true love'],
    'jazz': ['in your arms', 'dance with me', 'moonlight', 'forever yours']
  };
  
  const hook = hooks[genre.toLowerCase()]?.[Math.floor(Math.random() * 4)] || 'tonight';
  
  return `[intro]
${artistName}

[verse]
In the ${mood} night we come alive
Every moment feels like the first time
Chasing dreams through the city lights
With you everything just feels right

[pre-chorus]
Can you feel it rising up inside
There's no way to hide what we feel tonight

[chorus]
${songTitle}, ${hook}
We're taking over, can't be stopped now
${songTitle}, this is our time
${hook}, we're gonna shine

[verse]
Every heartbeat leads us to this place
Look into my eyes, feel the embrace
Nothing compares to what we share
A connection beyond compare

[chorus]
${songTitle}, ${hook}
We're taking over, can't be stopped now
${songTitle}, this is our time
${hook}, we're gonna shine

[bridge]
When the world tries to bring us down
We'll rise up and wear the crown
Nothing's gonna stop us now
This is ${songTitle}

[outro]
${songTitle}... ${hook}
Yeah, ${artistName}`;
}

// ============================================================
// NOTA: La generación de letras ahora se hace con AI en:
// server/services/ai-lyrics-generator.ts (generateHitLyrics)
// La función generateLyricsForGenreFallback arriba es el fallback
// ============================================================

/**
 * ============================================================
 * GENERACIÓN DE MERCHANDISE - NANO BANANA / NANO BANANA EDIT
 * ============================================================
 * Si hay imagen del artista: usa nano-banana/edit (Image-to-Image)
 * Si no hay imagen: usa nano-banana (Text-to-Image)
 * 
 * @param artistName - Nombre del artista
 * @param productType - Tipo de producto (T-Shirt, Hoodie, Cap, etc.)
 * @param artistImageUrl - URL de imagen del artista (opcional)
 * @param genre - Género musical para estilo visual
 */

/**
 * ============================================================
 * MASTER BRAND MARK GENERATION — LOGO/EMBLEM FOR MERCHANDISE
 * ============================================================
 * Genera un LOGO/MARCA profesional listo para imprimir.
 * NO es una foto del artista superpuesta — es un emblema vectorial-feel,
 * fondo transparente (o casi negro plano), centrado, con tipografía
 * integrada del nombre del artista. Funciona idéntico en t-shirt, hoodie,
 * gorra, mug, poster, phone case porque está aislado y centrado.
 *
 * Estrategia:
 * 1. SIEMPRE text-to-image (no usar edit-mode con la foto del artista)
 * 2. Prompt explícito: logo, transparent bg, isolated, centered, vector style
 * 3. Paleta extraída del género o pasada por el caller (brandColors)
 * 4. Output 4:5 aspect (cabe sin distorsión en el área de impresión típica)
 */
export async function generateMasterDesign(
  artistName: string,
  artistImageUrl: string,
  genre: string,
  brandColors?: { primary?: string; secondary?: string; accent?: string }
): Promise<FalImageResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🎨 Generating BRAND MARK for ${artistName} (${genre})...`);

    // Paleta visual por género — define la "vibe" del logo, no del producto
    const genreVibes: Record<string, string> = {
      'pop':       'colorful gradient pastels, playful geometric shapes, modern y2k aesthetic',
      'hip-hop':   'bold sans-serif typography, gold and black, urban graffiti edges, sharp lines',
      'rap':       'gothic blackletter or chrome typography, dark with metallic accents, drip effect',
      'trap':      'distorted retro typography, cyber purple and chrome, glitch art elements',
      'electronic':'futuristic neon line-art, cyan and magenta, geometric grid patterns, synthwave',
      'edm':       'glowing neon emblem, vibrant gradient, rave energy, abstract sound waves',
      'rock':      'distressed vintage typography, black and red, grunge texture, skull or wings motif',
      'metal':     'gothic metal logo, sharp angular typography, blood red on black, ornate emblem',
      'indie':     'hand-drawn illustration, muted earth tones, vintage botanical or moon motifs',
      'r&b':       'elegant serif typography, gold on cream, smooth flowing curves, art-deco frame',
      'soul':      'warm vintage typography, sepia tones, retro 70s emblem style',
      'jazz':      'classic art-deco emblem, gold and black, geometric sunburst, vintage record motif',
      'latin':     'tropical bold typography, red yellow blue, palm or sun motifs, vibrant',
      'reggaeton': 'urban latin emblem, neon green and pink, bold display font, party energy',
      'reggae':    'rasta colors red gold green, lion or palm motif, hand-drawn style',
      'country':   'western typography, brown and tan, vintage badge with rope or star',
      'folk':      'minimalist line-art, earthy palette, mountain or feather motif',
      'classical': 'elegant serif monogram, gold leaf, ornate frame, timeless emblem',
      'k-pop':     'kawaii pastel emblem, glitter and stars, soft gradients, holographic',
    };

    const vibe = genreVibes[genre.toLowerCase()] || 'modern bold music brand emblem, high-contrast, iconic';

    // Color hint — usa la paleta del artista si la tenemos, si no fallback al género
    const colorHint = brandColors?.primary
      ? `Brand palette: primary ${brandColors.primary}, ${brandColors.secondary ? `secondary ${brandColors.secondary},` : ''} ${brandColors.accent ? `accent ${brandColors.accent}` : ''}.`
      : '';

    // Pick a random logo "format" so each artist gets a distinctive composition
    const logoFormats = [
      'circular badge / emblem with the artist name wrapping around a central icon',
      'stacked wordmark with the artist name split into two layered lines and a graphic divider',
      'monogram lockup using the artist initials inside a custom shield or geometric shape',
      'horizontal wordmark with one signature graphic element flanking the type',
      'vertical poster-style lockup with the artist name as the dominant typographic block',
      'sticker-style die-cut emblem with the artist name and an iconic motif inside',
    ];
    const formatHint = logoFormats[Math.floor(Math.random() * logoFormats.length)];

    // Masterpiece rules block for logo/emblem excellence
    const masterpieceBlock = buildImageMasterpieceRules(
      { artistName, genre } as any,
      'merch-logo'
    );

    // PROMPT — diseñado para logo/emblem, sin caras nunca
    const prompt = `Professional merchandise brand logo / band mark for music artist "${artistName}". ${vibe}. ${colorHint}
Format: ${formatHint}.
The artist's name "${artistName}" MUST be rendered prominently as bold custom display typography — it is the hero of the composition, not a watermark.
Combine the typography with ONE signature emblem element (an abstract symbol, icon, or graphic motif relevant to the genre — NEVER a human face, NEVER a portrait, NEVER an animal mascot copied from a known brand).
Visual rules:
- flat vector illustration style, screen-print ready, hard clean edges
- solid colors only on type (no gradients on letters)
- isolated subject on a pure WHITE background with generous margin (crops cleanly)
- composition occupies roughly 70% of the canvas, perfectly centered
- treat it as a final t-shirt / vinyl / merch graphic — iconic and recognizable at any scale
HARD NEGATIVES: no human faces, no portraits, no realistic photographs, no 3D rendering, no drop shadows, no soft glow, no AI-watermarks, no extra fingers, no celebrity look-alikes, no logos that copy real existing brands, no random stock imagery, no busy background, no blurry edges.

${masterpieceBlock}`;

    logger.log(`[FAL] 🖋️  Generating brand mark (format=${formatHint.slice(0, 40)}…)`);

    const result = await generateImageWithNanoBanana(prompt, {
      aspectRatio: '4:5', // closest to 4500×5400 print canvas
    });

    if (result.success && result.imageBase64) {
      const permanentUrl = await uploadBase64ToStorage(
        result.imageBase64,
        'image/png',
        'master-designs'
      );
      logger.log(`[FAL] ✅ Brand mark generated → ${permanentUrl}`);
      return {
        ...result,
        imageUrl: permanentUrl,
      };
    }

    if (result.success && result.imageUrl) {
      logger.log(`[FAL] ✅ Brand mark generated → ${result.imageUrl}`);
      return result;
    }

    // FAL no resolvió el logo → fallback a OpenAI gpt-image-1 (text-to-image)
    logger.log('[FAL] 🔄 Brand mark: FAL no resolvió, fallback a OpenAI gpt-image-1...');
    return await generateMasterDesignWithOpenAI(prompt);
  } catch (error: any) {
    logger.log(`[FAL] ❌ Error generating brand mark con FAL: ${error.message}`);
    // Último recurso: OpenAI gpt-image-1
    try {
      const openaiLogo = await generateMasterDesignWithOpenAI(
        `Professional merchandise brand logo / band mark for music artist "${artistName}". ${genre} aesthetic. Bold custom display typography of the artist name as the hero, ONE signature emblem element (abstract symbol/icon, never a human face), flat vector illustration style, screen-print ready, solid colors, isolated on a pure WHITE background with generous margin, perfectly centered, iconic at any scale. No human faces, no portraits, no photographs, no 3D, no drop shadows, no busy background.`
      );
      if (openaiLogo.success) return openaiLogo;
    } catch (oaiErr: any) {
      logger.log(`[FAL] ❌ OpenAI brand mark fallback también falló: ${oaiErr.message}`);
    }
    return {
      success: false,
      imageUrl: '',
      error: error.message,
    };
  }
}

/**
 * Genera el LOGO/MARCA con OpenAI gpt-image-1 (text-to-image) y lo sube a
 * Firebase Storage en master-designs/. Fallback cuando FAL no está disponible
 * o no resuelve. Usa formato portrait 1024x1536 (≈ 4:5) para el área de
 * impresión típica del merchandise.
 */
async function generateMasterDesignWithOpenAI(prompt: string): Promise<FalImageResult> {
  const gpt = await generateImageWithGPTImage1(prompt, {
    size: '1024x1536',
    quality: 'high',
  });
  if (gpt.success && gpt.imageBase64) {
    const b64 = gpt.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const permanentUrl = await uploadBase64ToStorage(b64, 'image/png', 'master-designs');
    logger.log(`[FAL] ✅ Brand mark (OpenAI gpt-image-1) → ${permanentUrl}`);
    return { success: true, imageUrl: permanentUrl, imageBase64: gpt.imageBase64, provider: 'openai-gpt-image-1-logo' as any };
  }
  if (gpt.success && gpt.imageUrl) {
    logger.log(`[FAL] ✅ Brand mark (OpenAI gpt-image-1) → ${gpt.imageUrl}`);
    return { ...gpt, provider: 'openai-gpt-image-1-logo' as any };
  }
  return { success: false, imageUrl: '', error: gpt.error || 'OpenAI brand mark generation failed' };
}

export async function generateMerchandiseImage(
  artistName: string,
  productType: string,
  artistImageUrl: string,
  genre: string,
  /**
   * Optional brand DNA + master logo.
   * When provided, the prompt is anchored on the brand profile and the
   * master logo is sent as an additional reference image alongside the
   * artist photo (multi-reference) so the generated product is coherent
   * with the artist's visual identity.
   */
  options?: {
    brandProfile?: import('./artist-brand-profile').ArtistBrandProfile;
    masterDesignUrl?: string;
    modelWithArtist?: boolean;
    /** OpenAI gpt-image-1 quality. Defaults to 'medium' (~$0.042/img). 'high' is ~4x more expensive (~$0.167/img). */
    openaiQuality?: 'low' | 'medium' | 'high' | 'auto';
    /** OpenAI gpt-image-1 size. Defaults to '1024x1024'. */
    openaiSize?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  }
): Promise<FalImageResult> {
  let strictIdentityMode = false;
  const enableOpenAIMerchFallbacks = process.env.ENABLE_OPENAI_MERCH_FALLBACKS !== '0';
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🛍️ Generando merchandise ${productType} para ${artistName}...`);

    // Mapear género a estilo visual para coherencia (legacy fallback when no brand profile)
    const genreStyles: Record<string, string> = {
      'pop': 'premium contemporary pop editorial, clean luxury styling',
      'hip-hop': 'high-end urban editorial, premium street-lux styling',
      'rap': 'dark premium trap editorial, sharp luxury styling',
      'electronic': 'minimal futuristic editorial, controlled accent lighting',
      'rock': 'moody premium editorial, refined dark styling',
      'indie': 'clean artisan editorial, understated premium styling',
      'r&b': 'elegant premium editorial, smooth luxury aesthetics',
      'jazz': 'timeless luxury editorial, refined classic styling',
      'latin': 'premium latin editorial, elegant warm-toned styling',
      'reggaeton': 'urban luxury editorial, bold but refined styling',
    };

    const style = genreStyles[genre.toLowerCase()] || 'modern music artist aesthetic';

    // Per-product photographic specs (composition, angle, background)
    const modelWithArtist = options?.modelWithArtist !== false;
    // strictIdentityMode used to lock the model's face to the artist's reference
    // photo. We no longer want that \u2014 the model is an anonymous professional
    // fashion model, NOT the artist. Keep this disabled so OpenAI edits can fall
    // back to the FAL/text-to-image cascade if needed without aborting.
    strictIdentityMode = false;
    const realismConstraints =
      'PHOTOREALISM ANCHORS (highest priority): shot on a 35mm full-frame mirrorless camera with an 85mm f/1.4 prime, Kodak Portra 400 / Fuji 400H film color science, fine natural film grain, micro-texture visible on skin (pores, peach fuzz, light catchlights in iris), real fabric weave visible up close, soft natural skin oils, no airbrushing, no smoothing, no plastic AI sheen, no waxy faces, no symmetrical AI features, no overexposed highlights, no flat lifeless skin. Hair shows individual strands and flyaways. Realistic depth of field with a creamy out-of-focus background. Absolutely NO animation, NO cartoon, NO anime, NO illustration, NO painting, NO vector art, NO CGI, NO 3D render.';
    const premiumDirection =
      'Premium commercial/editorial direction only. Composition must be clean and minimal: one main product focus, neutral studio background, controlled lighting, realistic shadows, physically plausible materials. Avoid childish or toy-like aesthetics: no candy colors, no rainbow gradients, no playful stickers, no hearts/icons pattern flood, no emoji look, no collage-heavy graphics.';
    // Strict typography rule: NO text on wearable garments (shirts/hoodies/caps).
    // Mug/poster/sticker pack may carry the artist name. Wearables = logo mark only.
    // Banning gibberish words eliminates the "UNSPECIFIED / GENERAIC / 4K"
    // hallucinations the model loves to print on shirts and mugs.
    const safeArtistText = String(artistName || '').toUpperCase().replace(/[^A-Z0-9 &.\-]/g, '').trim();
    // Co-brand wordmark: BOOSTIFY × <ARTIST>. This is the heart of the new
    // luxury fashion-house aesthetic — Boostify and the artist appear as
    // a co-brand on every garment, label and hangtag, the way Adidas × Prada
    // or Louis Vuitton × Supreme work in real fashion.
    const coBrand = safeArtistText
      ? `BOOSTIFY \u00D7 ${safeArtistText}`
      : 'BOOSTIFY';
    // Luxury fashion-house direction shared across all 6 products. References
    // top houses to push the model toward Prada / Saint Laurent / Bottega
    // Veneta / The Row campaign quality (couture-grade fabrics, hand-finished
    // construction, custom woven labels, hangtag detail, runway lookbook feel).
    const luxuryHouseDirection =
      `LUXURY FASHION HOUSE DIRECTION: This is a "Boostify \u00D7 ${safeArtistText || 'ARTIST'}" capsule \u2014 a real co-brand collaboration between Boostify (the music platform) and the artist, executed at the level of Prada, Saint Laurent, Bottega Veneta, The Row, Loewe and Lemaire. The garment must feel like a $400-$1200 ready-to-wear piece, NOT a printed band-merch tee. ` +
      `Construction details: heavyweight compact cotton jersey (240-280 gsm) for tees, brushed organic French terry (450 gsm) with garment-dye finish for hoodies, herringbone twill or felted wool for caps, hand-finished seams, reinforced ribbed collar/cuffs, drop-needle stitching visible up close. ` +
      `Branding details: a custom WOVEN INNER NECK LABEL reading "BOOSTIFY \u00D7 ${safeArtistText || 'ARTIST'}" in clean small caps, a printed care label, and a small hangtag attached with cotton string \u2014 these tiny luxury markers must be visible/implied. ` +
      `Photographic direction: editorial campaign or runway lookbook feel \u2014 think Prada FW campaign by Steven Meisel or David Sims, Saint Laurent campaign by Juergen Teller, Bottega Veneta campaign by Tyrone Lebon. Cinematic key + soft fill + slight rim, controlled deep shadows, fine fabric texture, no plastic skin, accurate film color science, 35mm or 85mm lens feel. ` +
      `Color and styling decisions must be derived from analyzing the artist's reference photo and visual brief: dominant wardrobe palette, subculture, era and accessories of the artist drive the entire capsule line.`;
    // GRAPHIC IDENTITY SYSTEM \u2014 the actual designed mark that prints on every product.
    // This is NOT just "the artist's name in a font" \u2014 it is a real graphic identity
    // system the way Prada has its triangle plaque, YSL has its Cassandre monogram, and
    // Bottega has its woven serif wordmark. Three coherent elements that work together.
    const graphicIdentitySystem =
      `GRAPHIC IDENTITY SYSTEM (must be designed with intent, NOT generic text-on-shirt): The capsule has a real designed identity, made of THREE coherent elements that always appear together as a system, the way Prada's triangle plaque + Bodoni wordmark, or YSL's Cassandre monogram + Helvetica wordmark, or Bottega's woven serif + leather plaque work as systems. ` +
      `(1) PRIMARY WORDMARK \u2014 "BOOSTIFY \u00D7 ${safeArtistText || 'ARTIST'}" set in ONE refined custom-feeling luxury-fashion typeface chosen to match the artist's brief (didone serif like Bodoni / Didot for elegant artists, tall condensed grotesque like Inter Tight / Roobert / GT Sectra for modern artists, vintage script for bolero/jazz, art-deco display for tropical/latin), kerned tight, perfectly horizontal, monochromatic, with the \u00D7 glyph the SAME weight and height as the letterforms (true multiplication-sign, not the letter X). ` +
      `(2) MONOGRAM / ANCHOR MARK \u2014 a small geometric anchor mark sitting beside or beneath the wordmark: a refined ligature of the artist's initials inside a thin geometric frame (oval, shield, lozenge, square plaque, art-deco crest), or a discreet symbolic icon coherent with the artist's genre (a refined microphone silhouette, a single wave line, a sun arc, a palm silhouette, a star octagon \u2014 chosen via the artist brief). The mark uses the same single ink color as the wordmark and feels like a real luxury-house emblem (Prada triangle / Hermes carriage / Loewe anagram). ` +
      `(3) TYPOGRAPHIC TAG \u2014 a tiny secondary line of small caps reading either "FW CAPSULE \u2014 CHAPTER 01", "EDITION 001", "MADE IN COLLABORATION" or the artist's city/year, set in a clean grotesque at ~30% the scale of the wordmark, used to anchor the composition the way fashion houses tag a season. ` +
      `Composition rules: the three elements lock into a single tight stacked composition with consistent vertical rhythm and generous negative space around them. Mono-color or two-tone ONLY (one ink on garment color), high-contrast, premium screen-print or embroidery finish (raised satin stitch on caps, soft-hand water-based discharge on tees/hoodies, foil-stamped on hangtags). NO clipart, NO emoji, NO sparkles, NO hearts, NO multiple competing graphics, NO drop-shadow effects, NO gradients, NO 3D bevel, NO photo-on-shirt. The system must look like it was designed by a real fashion-house art director.`;
    const isWearable = ['T-Shirt', 'Hoodie', 'Cap'].includes(productType);
    const typographyRule = isWearable
      ? `STRICT TYPOGRAPHY RULES: The ONLY text allowed on the garment is the LITERAL co-brand wordmark "${coBrand}" \u2014 spelled letter-for-letter exactly as ${coBrand.split('').join(' ')}. The "\u00D7" symbol between BOOSTIFY and ${safeArtistText || 'ARTIST'} is a real multiplication-sign glyph, NEVER the letter X. Do NOT print the generic English word "ARTIST" or "ARTIST NAME" or any placeholder. Render it as ONE tasteful luxury-fashion-grade typeface that matches the artist's genre and visual brief (elegant didone serif like Bodoni / Didot, tall condensed sans like Inter Tight or Roobert, vintage script, art-deco display, or refined small caps \u2014 NEVER cartoon, NEVER bubble, NEVER Comic Sans, NEVER kawaii, NEVER Y2K). Wordmark perfectly centered (chest for tops, front panel for caps), well-kerned, monochromatic or two-tone with high contrast on the garment color, executed as a true premium screen-print or embroidery. NO additional words, NO slogans, NO watermarks, NO resolution tags ("4K", "HD"), NO placeholder labels, NO "UNSPECIFIED", NO "PROFESSIONAL", NO lorem ipsum, NO fake brand names, NO random gibberish letters, NO emoji.`
      : safeArtistText
        ? `STRICT TYPOGRAPHY RULES: The ONLY text allowed anywhere in the image is the exact co-brand wordmark "${coBrand}" (spelled letter-for-letter, in clean luxury-fashion typography, on-brand color). The "\u00D7" symbol is a real multiplication-sign glyph, NEVER the letter X. Do NOT invent, hallucinate, or stylize any other text, words, slogans, brand names, watermarks, labels, taglines, numbers, resolution tags, "4K", "UNSPECIFIED", "PROFESSIONAL", "GRADE", "PREMIUM", placeholder lorem-ipsum, fake brand names, or random gibberish letters. NO pink/neon decorative text. If you cannot render "${coBrand}" correctly and legibly, render the product with NO text at all (logo mark only).`
        : `STRICT TYPOGRAPHY RULES: Render the product with NO text, NO words, NO letters, NO numbers, NO watermarks, NO resolution tags ("4K", "HD"), NO labels and NO slogans. Logo/graphic mark only. Do NOT invent any brand names or random gibberish letters.`;
    // ── PROFESSIONAL FASHION MODELS (NOT THE ARTIST) ──
    // The artist's reference photo is used ONLY as a brand-DNA mood reference
    // (palette, subculture, era, energy). The person actually wearing the
    // garment is an ANONYMOUS PROFESSIONAL FASHION MODEL, the same way Prada,
    // Saint Laurent and Bottega Veneta cast professional models for their
    // capsule lookbooks \u2014 NOT the founding designer.
    const productSpecs: Record<string, string> = modelWithArtist ? {
      'T-Shirt':      `LUXURY FASHION-HOUSE LOOKBOOK PHOTOGRAPH for the "${coBrand}" capsule. The model is an ANONYMOUS PROFESSIONAL FASHION MODEL (the kind cast for Prada / Saint Laurent / Bottega Veneta FW campaigns) \u2014 NOT the artist from the reference photo. The artist's reference image is used ONLY as a MOOD/STYLING REFERENCE (palette, subculture, era, energy) to drive the casting decision: the casting director picks a real fashion model whose look, ethnicity range, age range and styling are coherent with the artist's brand DNA. The model wears a heavyweight compact cotton jersey t-shirt (240-280 gsm) cut in a clean ready-to-wear silhouette, with the GRAPHIC IDENTITY SYSTEM printed on the chest as a tight, intentional locked composition (primary co-brand wordmark + monogram anchor mark + tiny capsule tag), monochromatic or two-tone, premium soft-hand screen-print finish. Hip-up framing on a 35mm or 85mm lens, confident editorial pose, eyes can be partially obscured (sunglasses, hair, downward gaze). MOODY CINEMATIC BACKDROP (deep charcoal / near-black / dark teal / dark burgundy / smoky gradient / shadowed concrete wall) OR a luxury fashion-house environment coherent with the artist's brief (atelier, marble showroom, minimalist gallery, dimly lit hotel suite). Cinematic key + soft fill + slight rim, fine fabric texture, natural skin pores, no plastic AI skin. A small WOVEN INNER NECK LABEL reading "${coBrand}" is implied. NO face of the artist, NO photo-of-the-artist printed on the shirt.`,
      'Hoodie':       `LUXURY FASHION-HOUSE LOOKBOOK PHOTOGRAPH for the "${coBrand}" capsule. The composition is a campaign group shot featuring TWO ANONYMOUS PROFESSIONAL FASHION MODELS (NOT the artist) \u2014 a mixed cast styled the way Prada / Saint Laurent / Bottega Veneta cast their FW lookbooks. The casting reflects the artist's brand DNA (palette, subculture, era) but the people are real fashion models, NOT the artist. The hero model wears a premium hoodie cut from brushed organic French terry (~450 gsm) with garment-dye finish, kangaroo pocket, ribbed cuffs and hem, tonal drawstrings with custom metal aglets engraved "${coBrand}". The secondary model wears a complementary piece from the same capsule (different colorway or a coordinated tee/cap), slightly out of focus or one step behind. The chest of the hoodie carries the GRAPHIC IDENTITY SYSTEM (primary wordmark + monogram anchor + capsule tag) as a single intentional locked composition, monochromatic or two-tone, premium screen-print finish. Front 3/4 stance, hood down, MOODY CINEMATIC BACKDROP coherent with the artist's brief or a luxury fashion-house environment (atelier, dimly lit gallery, smoky concrete loft). Editorial directional key/fill/rim, crisp textile detail. NO artist face, NO photo-of-artist printed on the garment, NO generic streetwear cliches.`,
      'Cap':          `LUXURY FASHION-HOUSE LOOKBOOK PORTRAIT for the "${coBrand}" capsule. The model is an ANONYMOUS PROFESSIONAL FASHION MODEL (NOT the artist) cast to reflect the artist's brand DNA. The cap is built from herringbone twill, felted wool or fine cotton drill in a silhouette that fits the artist's fashion subculture (6-panel structured / 5-panel unstructured / fedora-leaning shape). The front panel carries the GRAPHIC IDENTITY SYSTEM in fine tonal embroidery: primary co-brand wordmark + small monogram anchor mark, raised satin stitch, perfectly legible. A small custom woven label is visible at the back strap. 3/4 head-and-shoulders crop on an 85mm lens, natural confident expression, slight directional gaze, eyes can be partially obscured. MOODY CINEMATIC BACKDROP (deep charcoal / near-black / dark teal / dark burgundy / smoky gradient) OR a refined fashion-house environment coherent with the artist's brief. Premium fashion-product lighting (Lemaire / The Row / Dries van Noten feel). NO artist face, NO photo-of-artist printed on the cap.`,
      'Poster':       `LUXURY FASHION-HOUSE CAMPAIGN POSTER for the "${coBrand}" capsule \u2014 a real lookbook poster the way Prada / Saint Laurent / Bottega Veneta release a printed campaign poster each season. The poster ARTWORK is dominated by the GRAPHIC IDENTITY SYSTEM (primary co-brand wordmark + monogram anchor mark + capsule tag) used as a real designed composition, with generous negative space, tight kerning, and a single strong supporting visual element (a high-contrast monochrome portrait of an ANONYMOUS PROFESSIONAL FASHION MODEL whose styling reflects the artist's brand DNA, OR a single bold abstract/photographic motif coherent with the artist's brief: art-deco frame, palm/sun silhouette, retro microphone, geometric bauhaus, tropical engraving). The poster is shot as a flat-lay or wall-pinned print on a moody dark textured surface (walnut wood, charcoal concrete, deep velvet, vintage paper, smoky marble) \u2014 NEVER pure white background. Monochromatic or two-tone risograph / screen-print finish, premium A1 / A2 fine-art paper feel, visible paper grain. NO artist face, NO photo-of-artist on the poster.`,
      'Sticker Pack': `LUXURY EDITORIAL STUDIO TABLETOP PHOTOGRAPH for the "${coBrand}" capsule \u2014 a kiss-cut vinyl sticker pack of 6\u20138 stickers laid out as an intentional graphic system (NOT random clipart). Each sticker is one element from the capsule's graphic identity system: (1) primary co-brand wordmark, (2) monogram anchor mark, (3) capsule tag "FW CAPSULE 01", (4) a single supporting motif coherent with the artist's brief (art-deco emblem, vintage line illustration, halftone, palm / sun / microphone / guitar silhouette, geometric flourish), (5\u20138) tonal variations of the above. Each sticker is monochromatic or two-tone, premium screen-print aesthetic, NEVER cartoon, NEVER kawaii, NEVER pink/y2k. Stickers arranged with intent on a rich textured surface coherent with the artist's brief (dark walnut wood, charcoal concrete, deep velvet, vintage paper, smoky marble) alongside a small printed hangtag reading "${coBrand}". MOODY EDITORIAL LIGHTING with soft shadows, fine-art product photography. NEVER pure white seamless background. NO human face in frame.`,
      'Mug':          `LUXURY EDITORIAL PRODUCT PHOTOGRAPH for the "${coBrand}" capsule. A premium 11oz matte ceramic mug with the GRAPHIC IDENTITY SYSTEM wrapped around it (primary co-brand wordmark + monogram anchor + capsule tag locked into a tight composition), monochromatic or two-tone, premium ceramic-decal aesthetic that reads as a real luxury-house homeware piece (the way Hermes / Loewe / Aesop branded objects feel). 3/4 angle on a moody dark textured backdrop coherent with the artist's brief (charcoal concrete, dark walnut, smoky gradient, marble showroom). Editorial directional lighting, physically accurate reflections, sharp print detail, fine-art product photography. NEVER pure white seamless background, NEVER cartoon/kawaii design, NO human in frame.`,
    } : {
      'T-Shirt':      `LUXURY EDITORIAL E-COMMERCE PRODUCT PHOTOGRAPH for the "${coBrand}" capsule. A heavyweight compact cotton jersey t-shirt (240-280 gsm) in a clean ready-to-wear silhouette, with a CREATIVE artistic chest print rooted in the artist's brand DNA (LITERAL co-brand wordmark "${coBrand}" in luxury-fashion typography paired with ONE motif: vintage illustration, art-deco frame, palm silhouette, retro microphone, geometric flourish; monochromatic or two-tone screen-print finish). A custom WOVEN INNER NECK LABEL reading "${coBrand}" is visible at the collar; a small printed hangtag with the same wordmark hangs from the side seam. Front view, hung on a refined wooden hanger or laid flat on a moody dark textured backdrop coherent with the brand DNA (charcoal concrete, dark linen, deep walnut, smoky gradient, fine-art paper). Editorial softbox + rim lighting, sharp fabric texture, premium fashion-house product photography (Prada / The Row / Lemaire feel) \u2014 NEVER pure white background, NEVER cartoon design.`,
      'Hoodie':       `LUXURY EDITORIAL PRODUCT PHOTOGRAPH for the "${coBrand}" capsule. A premium hoodie cut from brushed organic French terry (~450 gsm) with garment-dye finish, ribbed cuffs/hem, tonal drawstrings with custom metal aglets engraved "${coBrand}". CREATIVE artistic chest print rooted in the artist's brand DNA (LITERAL co-brand wordmark "${coBrand}" + one premium motif, monochromatic or two-tone screen-print style). A custom woven inner neck label and a small printed hangtag are visible. 3/4 view, hood down, on a moody dark textured backdrop coherent with the brand DNA (charcoal concrete, dark walnut, smoky gradient). Editorial lighting, fabric texture visible, fine-art fashion-house product photography. NEVER pure white background, NEVER cartoon design.`,
      'Cap':          `LUXURY EDITORIAL PRODUCT PHOTOGRAPH for the "${coBrand}" capsule. A premium cap built from herringbone twill, felted wool or fine cotton drill, with the LITERAL co-brand wordmark "${coBrand}" finely embroidered (raised satin stitch) on the front panel in fashion-grade typography. A small custom woven label is visible at the back strap. 3/4 angle on a moody dark textured backdrop coherent with the brand DNA (charcoal, dark wood, smoky gradient). Editorial lighting, sharp stitching detail, fine-art product photography. NEVER pure white background.`,
      'Poster':       `CREATIVE GALLERY-GRADE FASHION-HOUSE CAMPAIGN POSTER for the "${coBrand}" capsule, anchored on the LITERAL co-brand wordmark "${coBrand}" in bold luxury-fashion typography combined with one striking artistic motif rooted in the artist's brief and genre (high-contrast monochrome portrait, art-deco frame, palm/sun silhouette, retro microphone, geometric bauhaus). A discreet collection tag like "FW CAPSULE" or "CHAPTER 01". Monochromatic or two-tone risograph/screen-print finish, premium A1/A2 fine-art print aesthetic. Flat lay on a moody dark textured surface (walnut wood, charcoal concrete, vintage paper, smoky marble). NEVER pure white background, NEVER cartoon/kawaii/y2k design.`,
      'Sticker Pack': `LUXURY EDITORIAL FLAT LAY for the "${coBrand}" capsule: a kiss-cut vinyl sticker pack with 6\u20138 stickers, each a CREATIVE artistic concept rooted in the artist's brand DNA (LITERAL co-brand wordmark "${coBrand}", art-deco emblem, vintage line illustration, halftone, palm / sun / microphone / guitar silhouette, geometric flourish). Monochromatic or two-tone, premium screen-print aesthetic. Overhead shot on a moody dark textured surface (charcoal concrete, dark walnut, deep velvet) alongside a small printed hangtag reading "${coBrand}". Soft editorial shadows, fine-art product photography. NEVER pure white background, NEVER cartoon/kawaii design.`,
      'Mug':          `LUXURY EDITORIAL PRODUCT PHOTOGRAPH for the "${coBrand}" capsule. A premium 11oz matte ceramic mug with a CREATIVE wrap design (LITERAL co-brand wordmark "${coBrand}" + one premium motif, monochromatic or two-tone screen-print aesthetic). 3/4 angle, on a moody dark textured backdrop (charcoal concrete, dark walnut, smoky gradient). Editorial lighting, sharp print detail, fine-art product photography. NEVER pure white background, NEVER cartoon/kawaii design.`,
    };
    const productSpec = productSpecs[productType] ||
      `LUXURY EDITORIAL PRODUCT PHOTOGRAPH for the "${coBrand}" capsule featuring ${productType} with a creative artistic design rooted in the artist's brand DNA. ${style}. Moody dark textured backdrop coherent with the brand DNA, fine-art product photography. ${premiumDirection}`;

    // ── PROMPT BUILDING ──
    // If brandProfile is provided, build a fully brand-anchored prompt.
    // Otherwise fall back to the legacy genre-styled prompt.
    let editPrompt: string;
    let basePrompt: string;
    // The artist is NEVER the model. The artist photo is a brand-DNA reference
    // (palette, subculture, energy) for the casting director. The model wearing
    // the product is an anonymous professional fashion model.
    const identityLock = modelWithArtist
      ? `CASTING RULE (highest priority): The model wearing the product is an ANONYMOUS PROFESSIONAL FASHION MODEL — NOT the artist. Do NOT generate a face that resembles the artist. Do NOT print a photo of the artist's face on the garment. The artist's identity flows in only as a TEXT brand-DNA brief (palette, fashion subculture, era, energy). The casting director picks a real fashion model whose look feels coherent with that brand DNA but is a clearly DIFFERENT person from the artist (different facial structure, different bone structure, different hairline). The model can be shown with eyes obscured (sunglasses, hair, downward gaze, partial crop) for a stronger editorial feel. Realistic, hyperrealistic skin texture and natural anatomy, no plastic AI face.`
      : '';

    // 🔍 Vision describe artist (gender / ethnicity / style) — prevents drift
    let artistDescription = '';
    if (modelWithArtist && artistImageUrl && !artistImageUrl.includes('placeholder')) {
      artistDescription = await describeArtistFromPhoto(artistImageUrl);
      if (artistDescription) {
        logger.log(`[FAL] 👤 Artist visual brief: ${artistDescription}`);
      }
    }
    const genderLock = artistDescription
      ? `ARTIST BRAND-DNA BRIEF (drives casting + styling, NOT a face copy): ${artistDescription}. Use this brief to cast a PROFESSIONAL FASHION MODEL (NOT the artist) whose look is coherent with that brand DNA: matching gender expression range, matching ethnicity range, matching age range, matching subculture, matching fashion era, matching energy. The MODEL'S WARDROBE and styling must clearly belong to the same fashion world as the brief (palette, silhouettes, accessories like hats, sunglasses, chains can be referenced as STYLING choices on the model when coherent with the brief). The model is a DIFFERENT person than the artist. Do NOT print the artist's face on the garment, do NOT photo-clone the artist's face onto the model.`
      : '';
    if (options?.brandProfile) {
      // Sanitize brand DNA at runtime: strip childish/y2k/kawaii motifs and hot-pink palettes
      // unless the artist visual brief explicitly mentions pink/pop/kawaii. This prevents
      // legacy cached profiles (default pop fallback with hearts/sparkles/#FF3D7F) from
      // contaminating non-pop artists.
      const briefLc = (artistDescription || '').toLowerCase();
      const briefMentionsPop = /\b(k-?pop|j-?pop|pastel|kawaii|cute|playful|y2k|bubblegum|hyperpop|pink wardrobe|pink outfit|pink dress|pink jacket)\b/.test(briefLc);
      const bannedMotifs = ['hearts', 'sparkles', 'rainbows', 'bubble shapes', 'stars', 'glitter'];
      const bp = options.brandProfile;
      const motifsHaveBanned = (bp.motifs || []).some(m => bannedMotifs.includes(String(m).toLowerCase()));
      const palettePink = /^#(ff[0-9a-f]{2}[0-9a-f]{0,2}|f[0-9a-f]3d7f|ffb6e1)/i.test(bp.brandColors?.primary || '') || /pink|magenta|hot pink|neon/i.test(bp.visualStyle || '');
      if (!briefMentionsPop && (motifsHaveBanned || palettePink)) {
        const neutral = ['minimalist line motif', 'art-deco frame', 'palm silhouette', 'retro microphone', 'geometric flourish'];
        bp.motifs = (bp.motifs || []).filter(m => !bannedMotifs.includes(String(m).toLowerCase()));
        if (bp.motifs.length === 0) bp.motifs = neutral;
        if (palettePink) {
          bp.brandColors = { primary: '#101014', secondary: '#D9D2C5', accent: '#A47148' };
          bp.visualStyle = (bp.visualStyle || '').replace(/(y2k|kawaii|cute|playful|pink|magenta|hot[- ]pink|neon|pastel|bubblegum)/gi, 'editorial premium');
        }
        bp.moodKeywords = (bp.moodKeywords || []).filter(k => !/cute|playful|kawaii|dreamy|pastel/i.test(k));
        if (bp.moodKeywords.length === 0) bp.moodKeywords = ['premium', 'editorial', 'timeless'];
        logger.log(`[FAL] 🧹 Sanitized brand DNA: stripped childish motifs / pink palette for non-pop artist`);
      }

      const { buildProductPromptFromProfile } = await import('./artist-brand-profile');
      basePrompt = buildProductPromptFromProfile(bp, productType, productSpec);
      // For wearables, suppress the brand-profile motif/typography/signature lines
      // to avoid the model inventing kitsch pink hearts/sparkles/cartoon text on garments.
      // We keep brand DNA only as palette guidance via productSpec, not as garment graphics.
      if (isWearable) {
        basePrompt = productSpec; // ignore brand DNA prompt-prefix for wearable garments
      }
      const hasMasterLogo = !!options.brandProfile?.referenceImages?.masterLogo;
      const wearableGraphicRule = isWearable
        ? (hasMasterLogo
            ? `${graphicIdentitySystem} The garment carries the master logo from reference image #2 as the MONOGRAM ANCHOR MARK inside the graphic identity system, locked together with the primary co-brand wordmark "${coBrand}" and the small capsule tag in a single tight composition on the chest. Do NOT enlarge the master logo across the whole chest \u2014 it is one of three locked elements. Premium screen-print finish. NO additional text, NO hearts, NO sparkles, NO cartoon shapes, NO neon decorative blobs, NO photo-on-shirt.`
            : `${graphicIdentitySystem}`)
        : '';
      const wearableBackgroundRule = isWearable
        ? `BACKGROUND: a moody, cinematic dark backdrop (deep charcoal, near-black, dark teal, dark burgundy, smoky gradient, shadowed concrete wall) OR a luxury fashion-house environment coherent with the artist's brief (atelier, marble showroom, minimalist gallery, dimly lit hotel suite). Cinematic key + soft fill + slight rim lighting, premium fashion-campaign atmosphere reminiscent of a Prada / Saint Laurent FW campaign. NO pure-white seamless background for wearables.`
        : '';
      editPrompt = `MANDATORY BANS (highest priority, must NOT appear anywhere): NO childish / infantile / kids / cartoon-toy aesthetic, NO candy colors, NO hot-pink/magenta/neon-pink/pastel-pink garment OR product, NO cartoon hearts, NO sparkles/stars graphics, NO rainbow gradients, NO yellow circle blobs, NO childish bubble typography, NO Comic Sans / kawaii / Y2K cartoon style, NO emoji-style icons, NO collage stickers, NO multiple competing graphics, NO generic band-merch boxy tee aesthetic, NO photo of the artist's face printed on the garment, NO face-clone of the artist on the model. ${luxuryHouseDirection} ${wearableGraphicRule} ${wearableBackgroundRule}\n${basePrompt}\n    ${hasMasterLogo ? 'REFERENCE IMAGE: the artist\'s master brand logo \u2014 use it AS the monogram anchor mark inside the graphic identity system on the product (locked with the wordmark + capsule tag), keep colors and shapes intact, do NOT redraw it, do NOT enlarge it across the whole chest.' : ''}\n    ${modelWithArtist ? 'The final image must look like a Prada / Saint Laurent / Bottega Veneta FW lookbook shot. The hero is a professional fashion model that is clearly a DIFFERENT person from the artist. For Hoodie shots include ONE additional professional fashion model styled in coordinated pieces from the same "' + coBrand + '" capsule (different colorway or complementary item, slightly behind or out of focus). The artist is NOT in the frame.' : 'The product is photographed on a moody dark textured backdrop coherent with the artist brand DNA (charcoal concrete, dark walnut, smoky gradient, fine-art paper) \u2014 NOT on pure white seamless background. Include subtle luxury markers: custom woven inner neck label "' + coBrand + '", printed care label, cotton-string hangtag.'} ${genderLock} ${identityLock} ${realismConstraints} ${premiumDirection} ${typographyRule}`;
      logger.log(`[FAL] 🧬 Using brand profile DNA (genre=${options.brandProfile.genre}, palette=${options.brandProfile.brandColors.primary}/${options.brandProfile.brandColors.secondary}/${options.brandProfile.brandColors.accent})${isWearable ? ' [wearable: brand DNA prompt-prefix suppressed]' : ''}`);
    } else {
      const wearableGraphicRule = isWearable
        ? `${graphicIdentitySystem}`
        : '';
      const wearableBackgroundRule = isWearable
        ? `BACKGROUND: moody cinematic dark backdrop (charcoal, near-black, dark teal, dark burgundy, smoky gradient) OR a luxury fashion-house environment coherent with the artist's brief (atelier, marble showroom, minimalist gallery). Editorial directional lighting, Prada / Saint Laurent campaign atmosphere. NO pure white seamless background.`
        : '';
      basePrompt = `${productSpec} ${style}. ${realismConstraints} ${premiumDirection} ${typographyRule}`;
      editPrompt = modelWithArtist
        ? `MANDATORY BANS (highest priority, must NOT appear anywhere): NO childish / infantile / kids / cartoon-toy aesthetic, NO candy colors, NO hot-pink/magenta/neon-pink/pastel-pink garment OR product, NO cartoon hearts, NO sparkles/stars graphics, NO rainbow gradients, NO yellow circle blobs, NO childish bubble typography, NO Comic Sans / kawaii / Y2K cartoon style, NO emoji-style icons, NO collage stickers, NO printing the generic word "ARTIST" or "ARTIST NAME" on the garment, NO photo of the artist's face printed on the garment, NO face-clone of the artist on the model. ${luxuryHouseDirection} ${wearableGraphicRule} ${wearableBackgroundRule} ${basePrompt} ${genderLock} ${identityLock} The model wearing the product is an ANONYMOUS PROFESSIONAL FASHION MODEL that is a clearly DIFFERENT person from the artist. For Hoodie shots include ONE additional professional fashion model styled in coordinated pieces from the same "${coBrand}" capsule (different colorway or complementary item, slightly behind or out of focus). Prada / Saint Laurent / Bottega Veneta FW lookbook quality, realistic lighting and clean composition.`
        : `${luxuryHouseDirection} ${graphicIdentitySystem} ${basePrompt} The reference photograph is used ONLY to extract the artist's brand DNA (palette, energy, mood, fashion subculture, era) and translate it into the merchandise design. Do NOT paste the artist's literal face on the product. Photograph the product on a moody dark textured backdrop coherent with the brand DNA — NOT on pure white seamless background. Include subtle luxury markers: custom woven inner neck label "${coBrand}", printed care label, cotton-string hangtag.`;
    }

    // Build reference image array.
    // The artist's photo IS passed as a visual reference, but only as a
    // PHOTOGRAPHIC MOOD-BOARD (lighting, skin texture, fabric texture, film
    // grain, color science) \u2014 NOT as an identity lock. This is critical
    // for realism: without any ref the OpenAI edit endpoint slides into a
    // synthetic illustrated look. With the photo as a "tear sheet" reference
    // we keep photoreal texture quality, while the prompt + castingArchetype
    // force a different face.
    const referenceImages: string[] = [];
    if (options?.brandProfile) {
      const masterLogo = options.brandProfile.referenceImages?.masterLogo;
      const profileArtistPhoto = options.brandProfile.referenceImages?.artistPhoto || artistImageUrl;
      if (profileArtistPhoto && !profileArtistPhoto.includes('placeholder')) referenceImages.push(profileArtistPhoto);
      if (masterLogo) referenceImages.push(masterLogo);
    } else {
      if (artistImageUrl && !artistImageUrl.includes('placeholder')) referenceImages.push(artistImageUrl);
      if (options?.masterDesignUrl) referenceImages.push(options.masterDesignUrl);
    }
    // Per-product casting variation: each product gets a different model
    // archetype so the 6-product capsule looks like a real lookbook with a
    // varied cast, not the same person 6 times.
    const castingArchetypes = [
      'a male model with sharp angular bone structure, sun-kissed olive skin, dark wavy mid-length hair, mid-twenties',
      'a female model with soft round bone structure, warm caramel skin, sleek straight dark hair, mid-twenties',
      'a non-binary androgynous model with delicate features, fair porcelain skin, platinum buzzcut, late-twenties',
      'a male model with athletic build, deep brown skin, short coily hair and a trimmed beard, early-thirties',
      'a female model with strong runway features, light brown skin, voluminous dark curls, early-twenties',
      'a male model with refined editorial features, pale Nordic skin, ash-blond crop, late-twenties',
      'a female model with elongated runway proportions, cool ivory skin, dark slick-back bun, mid-twenties',
      'a male model with mediterranean features, tanned skin, salt-and-pepper short hair, mid-thirties',
    ];
    const castingSeed = Math.floor(Math.random() * castingArchetypes.length);
    const castingArchetype = castingArchetypes[castingSeed];
    const castingVariation = `CAST FOR THIS SHOT (variation ${castingSeed}): ${castingArchetype}. The model's gender presentation, ethnicity range, age range and overall styling must remain coherent with the artist brand-DNA brief above, but the FACE, FACIAL STRUCTURE, SKIN TONE, HAIR and BODY of this model must be visibly DIFFERENT from the artist in reference image #1 \u2014 a real fashion model, NOT the artist. Each product in the capsule is shot with a DIFFERENT model, the way real fashion-house lookbooks rotate cast across pieces.`;
    // Reference-usage rule: the artist photo is a TEAR SHEET / MOOD BOARD,
    // not an identity lock. We want the model to inherit ONLY the realism
    // anchors (lighting, skin pore detail, fabric texture, film grain, color
    // science) while replacing the face with the casting archetype.
    const referenceUsageRule = `REFERENCE IMAGE USAGE: Reference image #1 (the artist's photo) is a PHOTOGRAPHIC TEAR-SHEET / MOOD-BOARD reference \u2014 use it ONLY to inherit the realism anchors: real-world camera optics, lighting quality, skin pore micro-texture, fabric weave, film grain, color science, editorial mood. Do NOT copy the face, do NOT copy the bone structure, do NOT copy the hairstyle. Replace the person entirely with the casting archetype defined above. Treat the reference the way a fashion magazine treats a tear sheet pinned on a moodboard.`;
    if (isWearable && modelWithArtist) {
      editPrompt = `${castingVariation} ${referenceUsageRule} ${editPrompt}`;
    }

    // ── ESTRATEGIA EDIT MODE (al menos una referencia disponible) ──
    // Cascada barata/calidad: flux-kontext → nano-banana edit
    if (referenceImages.length > 0) {
      logger.log(`[FAL] ✏️ EDIT mode con ${referenceImages.length} referencia(s): ${referenceImages.map(u => u.substring(0, 60) + '…').join(' | ')}`);

      const kontextResult = await editImageWithFluxKontext(referenceImages[0], editPrompt, {
        aspectRatio: '1:1',
        outputFolder: 'merchandise-images',
      });
      if (kontextResult.success && kontextResult.imageUrl) {
        logger.log('[FAL] ✅ Merchandise via Flux Kontext');
        return kontextResult;
      }
      logger.log('[FAL] 🔄 Flux Kontext no resolvió la imagen, fallback a nano-banana edit...');

      if (strictIdentityMode) {
        logger.warn('[FAL] ⚠️ Flux Kontext falló en strictIdentityMode; se aborta para no perder coherencia visual');
        return {
          success: false,
          imageUrl: '',
          error: 'Flux Kontext edit failed in strict artist identity mode',
        };
      }

      // 3. nano-banana edit (existente) — accepts multi-image array
      logger.log(`[FAL] 🥈 Fallback a nano-banana-2/edit con ${referenceImages.length} refs...`);
      const nanoEdit = await editImageWithNanoBanana(
        referenceImages,
        editPrompt,
        { aspectRatio: '1:1' }
      );
      if (nanoEdit.success && nanoEdit.imageUrl) {
        return nanoEdit;
      }

      // 4. OpenAI gpt-image-1 EDIT (coherente con la foto del artista) —
      //    último recurso en modo EDIT antes de la cascada text-to-image.
      if (enableOpenAIMerchFallbacks) {
        logger.log(`[FAL] 🥉 Fallback a OpenAI gpt-image-1/edit con ${referenceImages.length} refs...`);
        const openaiEdit = await editImageWithGPTImage1(referenceImages, editPrompt, {
          size: options?.openaiSize || '1024x1024',
          quality: options?.openaiQuality || 'high',
          outputFolder: 'merchandise-images',
        });
        if (openaiEdit.success && openaiEdit.imageUrl) {
          logger.log('[FAL] ✅ Merchandise via OpenAI gpt-image-1 edit (coherente)');
          return openaiEdit;
        }
        logger.log('[FAL] 🔄 gpt-image-1 edit no resolvió la imagen, continúa la cascada...');
      }

      // EDIT mode agotado — dejar que el catch aplique la cascada text-to-image.
      throw new Error('All edit-mode providers failed for merchandise');
    }

    const prompt = basePrompt;

    // Sin imagen del artista: usar Flux Dev (mejor calidad/coste que OpenAI)
    logger.log(`[FAL] 🎨 Usando Flux Dev (generación) para ${productType}`);

    const result = await generateImageWithFluxDevForFolder(prompt, {
      imageSize: 'square_hd',
      outputFolder: 'merchandise-images',
    });

    if (result.success && result.imageUrl) {
      return result;
    }

    // FAL falló — aplicar cadena de fallbacks completa
    throw new Error(result.error || 'FAL merchandise generation returned no image');
  } catch (error: any) {
    logger.log(`[FAL] ⚠️ Merchandise primary generation failed: ${error.message}`);

    if (strictIdentityMode) {
      logger.warn('[FAL] 🚫 strictIdentityMode: se omiten fallbacks no deterministas para proteger la coherencia del rostro');
      return {
        success: false,
        imageUrl: '',
        error: 'Strict artist identity mode prevented non-OpenAI fallbacks',
      };
    }

    const merchPrompt =
      `Professional hyperrealistic studio product photo of ${artistName} ${productType} merchandise. Modern music aesthetic. White seamless background, 4K commercial photography. Hyperrealistic studio photograph with real-world camera optics and natural skin/material texture. Absolutely no animation, no cartoon, no anime, no illustration, no painting, no vector art, no CGI, no 3D render, and no plastic/airbrushed AI look. Premium commercial/editorial direction only. Clean minimal composition with one focal product. No childish/toy-like styling, no candy colors, no rainbow gradients, no playful stickers or hearts pattern flood, no collage-heavy graphics.`;

    // Build product-specific prompts for fallbacks
    const genreStyles: Record<string, string> = {
      'pop': 'premium contemporary pop editorial, clean luxury styling',
      'hip-hop': 'high-end urban editorial, premium street-lux styling',
      'rap': 'dark premium trap editorial, sharp luxury styling',
      'electronic': 'minimal futuristic editorial, controlled accent lighting',
      'rock': 'moody premium editorial, refined dark styling',
      'indie': 'clean artisan editorial, understated premium styling',
      'r&b': 'elegant premium editorial, smooth luxury aesthetics',
      'jazz': 'timeless luxury editorial, refined classic styling',
      'latin': 'premium latin editorial, elegant warm-toned styling',
      'reggaeton': 'urban luxury editorial, bold but refined styling',
    };
    const fallbackStyle = genreStyles[genre.toLowerCase()] || 'modern music artist aesthetic';
    const fallbackPrompt = `Professional hyperrealistic studio product photo of ${artistName} ${productType} merchandise. ${fallbackStyle}. Orange and black branding. White seamless background, 4K quality. Hyperrealistic studio photograph with real-world camera optics and natural skin/material texture. Absolutely no animation, no cartoon, no anime, no illustration, no painting, no vector art, no CGI, no 3D render, and no plastic/airbrushed AI look. Premium commercial/editorial direction only. Clean minimal composition with one focal product. No childish/toy-like styling, no candy colors, no rainbow gradients, no playful stickers or hearts pattern flood, no collage-heavy graphics.`;

    // 🔄 FALLBACK 1: Gemini
    logger.log(`[FAL] 🔄 Merchandise fallback 1: Gemini for ${productType}...`);
    try {
      const geminiService = await import('./gemini-image-service');
      const geminiResult = await geminiService.generateCinematicImage(fallbackPrompt);
      if (geminiResult.success && geminiResult.imageUrl) {
        // Re-upload to merchandise folder
        if (geminiResult.imageBase64) {
          const permanentUrl = await uploadBase64ToStorage(geminiResult.imageBase64, 'image/png', 'merchandise-images');
          logger.log(`[FAL] ✅ Merchandise Gemini fallback success for ${productType}`);
          return { success: true, imageUrl: permanentUrl, imageBase64: geminiResult.imageBase64, provider: 'gemini-merch-fallback' };
        }
        logger.log(`[FAL] ✅ Merchandise Gemini fallback success for ${productType}`);
        return { success: true, imageUrl: geminiResult.imageUrl, provider: 'gemini-merch-fallback' };
      }
    } catch (geminiErr: any) {
      logger.error(`[FAL] ❌ Gemini merch fallback failed: ${geminiErr.message}`);
    }

    // 🤖 FALLBACK 2: OpenAI gpt-image-1 (coherente con la foto del artista) → DALL-E 3 (texto)
    if (enableOpenAIMerchFallbacks) {
      // Reconstruir las referencias del artista (la foto + logo maestro) para
      // mantener la coherencia visual del producto con la identidad del artista.
      const catchRefs: string[] = [];
      const bpRefs = options?.brandProfile?.referenceImages;
      const catchArtistPhoto = bpRefs?.artistPhoto || artistImageUrl;
      const catchMasterLogo = bpRefs?.masterLogo || options?.masterDesignUrl;
      if (catchArtistPhoto && !catchArtistPhoto.includes('placeholder')) catchRefs.push(catchArtistPhoto);
      if (catchMasterLogo && !catchMasterLogo.includes('placeholder')) catchRefs.push(catchMasterLogo);

      // 2a. gpt-image-1 EDIT con la referencia del artista → coherente.
      if (catchRefs.length > 0) {
        logger.log(`[FAL] 🤖 Merchandise fallback 2a: OpenAI gpt-image-1 EDIT (coherente, ${catchRefs.length} refs) for ${productType}...`);
        try {
          const openaiEdit = await editImageWithGPTImage1(catchRefs, fallbackPrompt, {
            size: options?.openaiSize || '1024x1024',
            quality: options?.openaiQuality || 'high',
            outputFolder: 'merchandise-images',
          });
          if (openaiEdit.success && openaiEdit.imageUrl) {
            logger.log(`[FAL] ✅ Merchandise OpenAI gpt-image-1 edit fallback success for ${productType}`);
            return { ...openaiEdit, provider: 'openai-gpt-image-1-merch-fallback' as any };
          }
        } catch (openaiEditErr: any) {
          logger.error(`[FAL] ❌ OpenAI gpt-image-1 edit merch fallback failed: ${openaiEditErr.message}`);
        }
      }

      // 2b. gpt-image-1 text-to-image (sin referencia disponible / edit falló).
      logger.log(`[FAL] 🤖 Merchandise fallback 2b: OpenAI gpt-image-1 text-to-image for ${productType}...`);
      try {
        const gptResult = await generateImageWithGPTImage1(fallbackPrompt, { size: options?.openaiSize === 'auto' ? '1024x1024' : (options?.openaiSize || '1024x1024'), quality: 'high' });
        if (gptResult.success && gptResult.imageUrl) {
          // Re-subir a la carpeta de merchandise si hay base64 disponible.
          if (gptResult.imageBase64) {
            const b64 = gptResult.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const permanentUrl = await uploadBase64ToStorage(b64, 'image/png', 'merchandise-images');
            logger.log(`[FAL] ✅ Merchandise OpenAI gpt-image-1 t2i fallback success for ${productType}`);
            return { success: true, imageUrl: permanentUrl, imageBase64: gptResult.imageBase64, provider: 'openai-gpt-image-1-merch-fallback' as any };
          }
          logger.log(`[FAL] ✅ Merchandise OpenAI gpt-image-1 t2i fallback success for ${productType}`);
          return { success: true, imageUrl: gptResult.imageUrl, provider: 'openai-gpt-image-1-merch-fallback' as any };
        }
      } catch (gptErr: any) {
        logger.error(`[FAL] ❌ OpenAI gpt-image-1 t2i merch fallback failed: ${gptErr.message}`);
      }

      // 2c. OpenAI DALL-E 3 (último recurso OpenAI).
      logger.log(`[FAL] 🤖 Merchandise fallback 2c: OpenAI DALL-E 3 for ${productType}...`);
      try {
        const dalleResult = await generateImageWithOpenAI(fallbackPrompt);
        if (dalleResult.success && dalleResult.imageUrl) {
          // Re-upload to merchandise folder if base64 available
          if (dalleResult.imageBase64) {
            const b64 = dalleResult.imageBase64.replace(/^data:image\/\w+;base64,/, '');
            const permanentUrl = await uploadBase64ToStorage(b64, 'image/png', 'merchandise-images');
            logger.log(`[FAL] ✅ Merchandise DALL-E fallback success for ${productType}`);
            return { success: true, imageUrl: permanentUrl, imageBase64: dalleResult.imageBase64, provider: 'openai-dalle-merch-fallback' };
          }
          logger.log(`[FAL] ✅ Merchandise DALL-E fallback success for ${productType}`);
          return { success: true, imageUrl: dalleResult.imageUrl, provider: 'openai-dalle-merch-fallback' };
        }
      } catch (dalleErr: any) {
        logger.error(`[FAL] ❌ DALL-E merch fallback failed: ${dalleErr.message}`);
      }
    } else {
      logger.log(`[FAL] ⏭️ Merchandise OpenAI fallbacks skipped for ${productType} (ENABLE_OPENAI_MERCH_FALLBACKS=0)`);
    }

    // 🔄 FALLBACK 3: Replicate (Flux Schnell / SDXL)
    logger.log(`[FAL] 🔄 Merchandise fallback 3: Replicate for ${productType}...`);
    try {
      const replicateResult = await generateImageWithReplicate(fallbackPrompt, { aspectRatio: '1:1' });
      if (replicateResult.success && replicateResult.imageUrl) {
        logger.log(`[FAL] ✅ Merchandise Replicate fallback success for ${productType}`);
        return { success: true, imageUrl: replicateResult.imageUrl, imageBase64: replicateResult.imageBase64, provider: 'replicate-flux' };
      }
    } catch (replicateErr: any) {
      logger.error(`[FAL] ❌ Replicate merch fallback failed: ${replicateErr.message}`);
    }

    // ☁️ FALLBACK 5: FHDR Cloud
    logger.log(`[FAL] ☁️ Merchandise fallback 5: FHDR Cloud for ${productType}...`);
    try {
      const fhdrCloudResult = await generateImageWithFHDRCloud(fallbackPrompt);
      if (fhdrCloudResult.success && fhdrCloudResult.imageUrl) {
        logger.log(`[FAL] ✅ Merchandise FHDR Cloud fallback success for ${productType}`);
        return { success: true, imageUrl: fhdrCloudResult.imageUrl, provider: 'fhdr-cloud-merch-fallback' };
      }
    } catch (fhdrCloudErr: any) {
      logger.error(`[FAL] ❌ FHDR Cloud merch fallback failed: ${fhdrCloudErr.message}`);
    }

    // 🔥 FALLBACK 6: FHDR Local
    logger.log(`[FAL] 🔥 Merchandise fallback 6: FHDR Local for ${productType}...`);
    try {
      const fhdrResult = await generateImageWithFHDR(fallbackPrompt);
      if (fhdrResult.success && fhdrResult.imageUrl) {
        logger.log(`[FAL] ✅ Merchandise FHDR local fallback success for ${productType}`);
        return { success: true, imageUrl: fhdrResult.imageUrl, provider: 'fhdr-local-merch-fallback' };
      }
    } catch (fhdrErr: any) {
      logger.error(`[FAL] ❌ FHDR local merch fallback failed: ${fhdrErr.message}`);
    }

    logger.log(`[FAL] ❌ ALL merchandise fallbacks failed for ${productType}`);
    return {
      success: false,
      imageUrl: '',
      error: `All image generation providers failed for ${productType}`
    };
  }
}

/**
 * ============================================================
 * DESIGN PACK SYSTEM — 6 DISEÑOS PRINT-READY PARA PRINTFUL
 * ============================================================
 * Genera 6 diseños artísticos únicos optimizados para impresión:
 *   1. Logo Emblem    (1:1)  → T-Shirt, Stickers
 *   2. Album Art      (3:4)  → Hoodie
 *   3. Typography     (16:9) → Cap
 *   4. Abstract Vibe  (1:1)  → Poster
 *   5. Iconic Portrait(3:4)  → T-Shirt premium, Poster alt
 *   6. Pattern Motif  (16:9) → Mug (full wrap)
 *
 * Cada diseño es una OBRA DE ARTE plana, sin mockup de producto.
 * Printful recibe el arte y lo imprime en el producto real.
 */

import type { DesignType, DesignSpec } from '../config/printful-product-map';
import { DESIGN_SPECS, DESIGN_TYPES, PRODUCT_MAP } from '../config/printful-product-map';

export interface DesignPackResult {
  designType: DesignType;
  displayName: string;
  imageUrl: string;
  aspectRatio: string;
  success: boolean;
  error?: string;
}

/**
 * Construye el prompt de generación print-ready para cada tipo de diseño.
 * Son diseños PLANOS (flat artwork), NO fotos de producto.
 */
function buildDesignPrompt(
  designType: DesignType,
  artistName: string,
  genre: string,
  style: string
): string {
  const prompts: Record<DesignType, string> = {
    logo_emblem: `Flat graphic emblem logo design for music artist "${artistName}". ${style}. Bold iconic symbol, clean vector-style edges, high contrast. Centered composition on solid dark background. No text, no mockup, no product — only the artwork. Suitable for screen printing on apparel. Professional graphic design, 4K quality.`,

    album_art: `Album cover artwork for music artist "${artistName}". ${style}. Cinematic, rich colors, emotional depth. Vertical composition. Abstract-meets-figurative art, dramatic lighting, layered textures. No text overlay, no product mockup — pure artwork for printing. Magazine-quality illustration, 4K.`,

    typography: `Bold typographic design featuring the name "${artistName}". ${style}. Modern display font, wide horizontal layout. Creative lettering with artistic flourishes. Orange and white on dark background. Minimal, impactful, clean edges for embroidery. No photos, no mockup — flat graphic design only. 4K.`,

    abstract_vibe: `Large format abstract art inspired by ${genre} music and artist "${artistName}". ${style}. Vivid colors, flowing shapes, dynamic energy. Square composition perfect for poster. Painterly textures mixed with digital precision. No text, no product — pure art print. Museum-quality, 4K, 300 DPI feel.`,

    iconic_portrait: `Stylized artistic portrait inspired by music artist "${artistName}". ${style}. Pop-art meets modern illustration. Bold outlines, vibrant color blocks, expressive. Vertical composition for apparel print. No photo-realism — graphic art style. Clean background, print-ready. 4K quality.`,

    pattern_motif: `Seamless repeating pattern design for music artist "${artistName}". ${style}. Wide panoramic format for mug wrap-around print. Interlocking motifs with musical elements, artist branding shapes, genre-inspired symbols. Orange, black, white palette. Tileable, no seams visible. No product mockup — flat pattern artwork only. 4K.`,
  };

  return prompts[designType];
}

/**
 * Genera un único diseño print-ready del Design Pack
 */
async function generateSingleDesign(
  designType: DesignType,
  artistName: string,
  artistImageUrl: string,
  genre: string,
  style: string
): Promise<DesignPackResult> {
  const spec = DESIGN_SPECS[designType];
  const prompt = buildDesignPrompt(designType, artistName, genre, style);

  logger.log(`[FAL] 🎨 Design Pack: Generating "${spec.displayName}" (${spec.aspectRatio})...`);

  try {
    let result: FalImageResult;

    // For iconic_portrait, prefer image-to-image if artist image available
    if (designType === 'iconic_portrait' && artistImageUrl && !artistImageUrl.includes('placeholder')) {
      result = await editImageWithNanoBanana(
        [artistImageUrl],
        prompt,
        { aspectRatio: spec.aspectRatio as any }
      );
    } else {
      result = await generateImageWithNanoBanana(prompt, {
        aspectRatio: spec.aspectRatio as any,
      });
    }

    // Upload to design-pack-specific folder
    if (result.success && result.imageBase64) {
      const permanentUrl = await uploadBase64ToStorage(
        result.imageBase64,
        'image/png',
        spec.storageFolder
      );
      return {
        designType,
        displayName: spec.displayName,
        imageUrl: permanentUrl,
        aspectRatio: spec.aspectRatio,
        success: true,
      };
    }

    if (result.success && result.imageUrl) {
      return {
        designType,
        displayName: spec.displayName,
        imageUrl: result.imageUrl,
        aspectRatio: spec.aspectRatio,
        success: true,
      };
    }

    throw new Error(result.error || 'No image returned');
  } catch (error: any) {
    logger.error(`[FAL] ⚠️ Design "${spec.displayName}" primary failed: ${error.message}. Trying fallbacks...`);

    // FALLBACK: Use generateImageWithNanoBanana which has the full chain (FAL→Gemini→DALL-E→FHDR)
    try {
      const fallbackResult = await generateImageWithNanoBanana(prompt, {
        aspectRatio: spec.aspectRatio as any,
      });
      if (fallbackResult.success && fallbackResult.imageBase64) {
        const permanentUrl = await uploadBase64ToStorage(fallbackResult.imageBase64, 'image/png', spec.storageFolder);
        logger.log(`[FAL] ✅ Design "${spec.displayName}" recovered via fallback chain (${fallbackResult.provider})`);
        return { designType, displayName: spec.displayName, imageUrl: permanentUrl, aspectRatio: spec.aspectRatio, success: true };
      }
      if (fallbackResult.success && fallbackResult.imageUrl) {
        logger.log(`[FAL] ✅ Design "${spec.displayName}" recovered via fallback chain (${fallbackResult.provider})`);
        return { designType, displayName: spec.displayName, imageUrl: fallbackResult.imageUrl, aspectRatio: spec.aspectRatio, success: true };
      }
    } catch (fallbackErr: any) {
      logger.error(`[FAL] ❌ Design "${spec.displayName}" all fallbacks failed: ${fallbackErr.message}`);
    }

    return {
      designType,
      displayName: spec.displayName,
      imageUrl: '',
      aspectRatio: spec.aspectRatio,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Genera el Design Pack completo: 6 diseños print-ready para un artista.
 * Retorna los diseños generados + el mapeo a productos.
 */
export async function generateArtistDesignPack(
  artistName: string,
  artistImageUrl: string,
  genre: string
): Promise<{
  designs: DesignPackResult[];
  products: Array<{ type: string; name: string; price: number; imageUrl: string; designType: DesignType }>;
}> {
  logger.log(`[FAL] 🎨 ═══════════════════════════════════════════════`);
  logger.log(`[FAL] 🎨 DESIGN PACK: Generating 6 unique prints for ${artistName}`);
  logger.log(`[FAL] 🎨 Genre: ${genre} | Artist image: ${artistImageUrl ? 'yes' : 'no'}`);
  logger.log(`[FAL] 🎨 ═══════════════════════════════════════════════`);

  // Genre → visual style mapping
  const genreStyles: Record<string, string> = {
    'pop': 'colorful, vibrant, modern pop aesthetic, bright gradients',
    'hip-hop': 'urban streetwear, bold graffiti-inspired, hip-hop culture',
    'rap': 'urban, street style, trap aesthetic, dark luxury',
    'electronic': 'futuristic, neon glow, cyberpunk, digital art vibes',
    'rock': 'edgy, dark, grungy, rock and roll rebellion aesthetic',
    'indie': 'vintage, artistic, bohemian, hand-drawn feel',
    'r&b': 'smooth, elegant, silk textures, warm gold tones',
    'jazz': 'classic, sophisticated, art deco, timeless cool',
    'latin': 'vibrant, tropical, passionate fiery colors',
    'reggaeton': 'urban latin, flashy, neon party, bold typography',
    'country': 'rustic, warm earth tones, Americana, natural textures',
    'metal': 'dark, aggressive, detailed skulls, sharp angular forms',
  };
  const style = genreStyles[genre.toLowerCase()] || 'modern music artist aesthetic, bold and creative';

  // Generate all 6 designs sequentially (rate limiting)
  const designs: DesignPackResult[] = [];
  for (const designType of DESIGN_TYPES) {
    const design = await generateSingleDesign(designType, artistName, artistImageUrl, genre, style);
    designs.push(design);
    // Rate limit pause between generations
    await new Promise(resolve => setTimeout(resolve, 2500));
  }

  const successCount = designs.filter(d => d.success).length;
  logger.log(`[FAL] 🎨 Design Pack complete: ${successCount}/${designs.length} designs generated`);

  // Build design lookup for product mapping
  const designLookup = new Map<DesignType, string>();
  for (const d of designs) {
    if (d.success && d.imageUrl) {
      designLookup.set(d.designType, d.imageUrl);
    }
  }

  // Map designs to products: each product gets its assigned design
  const productEntries = Object.values(PRODUCT_MAP);
  const products = productEntries.map(mapping => {
    const designUrl = designLookup.get(mapping.designType) || '';
    const placeholder = `https://storage.googleapis.com/boostify-music/placeholders/${mapping.boostifyType.toLowerCase().replace(' ', '-')}.png`;
    return {
      type: mapping.boostifyType,
      name: `${artistName} ${mapping.displayName}`,
      price: mapping.retailPrice,
      imageUrl: designUrl || placeholder,
      designType: mapping.designType,
    };
  });

  return { designs, products };
}

/**
 * ============================================================
 * GENERACIÓN COMPLETA DE MERCHANDISE - 6 PRODUCTOS (Legacy)
 * ============================================================
 * Ahora usa el Design Pack system internamente.
 * Mantiene la interfaz original para compatibilidad.
 */
export async function generateArtistMerchandise(
  artistName: string,
  artistImageUrl: string,
  genre: string
): Promise<Array<{ type: string; name: string; price: number; imageUrl: string }>> {
  logger.log(`[FAL] 🛍️ generateArtistMerchandise → delegating to Design Pack system`);

  const { products } = await generateArtistDesignPack(artistName, artistImageUrl, genre);

  // Return in legacy format (without designType)
  return products.map(({ type, name, price, imageUrl }) => ({ type, name, price, imageUrl }));
}

// URL para queue de FAL (operaciones que toman tiempo)
const FAL_QUEUE_URL = 'https://queue.fal.run';

/**
 * ============================================================
 * GENERACIÓN DE VIDEO - GROK IMAGINE VIDEO (xAI) - PRINCIPAL
 * ============================================================
 * Modelo: xai/grok-imagine-video/image-to-video
 * Genera videos de alta calidad desde imágenes con audio nativo
 * Precio: $0.05/segundo ($0.30 para video de 6s)
 * 
 * WORKFLOW RECOMENDADO PARA MUSIC VIDEOS:
 * 1. Generar imagen con nano-banana
 * 2. Convertir a video con Grok Imagine
 * 3. Editar/estilizar con Grok Edit Video
 * 
 * @param imageUrl - URL de la imagen a convertir en video
 * @param prompt - Descripción del movimiento/estilo deseado
 * @param options - Opciones: duration (6s), resolution (480p/720p), aspect_ratio
 */
export async function generateVideoWithGrok(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: number; // segundos (default 6)
    resolution?: '480p' | '720p';
    aspectRatio?: 'auto' | '16:9' | '4:3' | '3:2' | '1:1' | '2:3' | '3:4' | '9:16';
  } = {}
): Promise<FalVideoResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🎬 Generando video con Grok Imagine Video (xAI)...`);
    logger.log(`[FAL] Image URL: ${imageUrl.substring(0, 80)}...`);
    logger.log(`[FAL] Motion Prompt: ${prompt.substring(0, 100)}...`);

    // Parámetros para xai/grok-imagine-video/image-to-video
    const requestBody = {
      prompt: prompt,
      image_url: imageUrl,
      duration: options.duration || 6, // Default 6 segundos
      resolution: options.resolution || '720p', // Alta calidad por defecto
      aspect_ratio: options.aspectRatio || 'auto'
    };

    logger.log(`[FAL] Request a Grok Imagine:`, JSON.stringify(requestBody));

    // Usar queue para operaciones largas
    const response = await axios.post(
      `${FAL_QUEUE_URL}/${FAL_MODELS.GROK_IMAGE_TO_VIDEO}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000 // 30s para el submit
      }
    );

    // FAL devuelve request_id, status_url y response_url
    const requestId = response.data.request_id;
    const statusUrl = response.data.status_url;
    const responseUrl = response.data.response_url;
    
    logger.log(`[FAL] Grok Request ID: ${requestId}`);

    // Polling para obtener el resultado
    let result = null;
    let attempts = 0;
    const maxAttempts = 120; // 4 minutos max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 segundos

      const statusResponse = await axios.get(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      });

      logger.log(`[FAL] Grok Status: ${statusResponse.data.status} (attempt ${attempts + 1})`);

      if (statusResponse.data.status === 'COMPLETED') {
        const resultResponse = await axios.get(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_API_KEY}` }
        });
        result = resultResponse.data;
        break;
      } else if (statusResponse.data.status === 'FAILED') {
        throw new Error(statusResponse.data.error || 'Grok video generation failed');
      }

      attempts++;
    }

    if (!result) {
      throw new Error('Grok video generation timeout');
    }

    // Extraer datos del video
    const videoData = result.video;
    if (!videoData?.url) {
      throw new Error('No se recibió URL de video de Grok');
    }

    logger.log(`[FAL] ✅ Video Grok generado: ${videoData.url.substring(0, 80)}...`);

    // Log API usage - Grok video is expensive
      logApiUsage({
      apiProvider: 'fal',
      endpoint: `xai/grok-imagine-video`,
      model: 'grok-imagine-video',
      status: 'success',
      metadata: { function: 'generateVideoWithGrok' },
    }).catch(() => {});

    // Subir a Firebase Storage para URL permanente
    try {
      const videoResponse = await axios.get(videoData.url, {
        responseType: 'arraybuffer',
        timeout: 120000
      });

      if (storage) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const fileName = `grok-videos/${timestamp}_${randomId}.mp4`;

        const bucket = storage.bucket();
        const file = bucket.file(fileName);

        await file.save(Buffer.from(videoResponse.data), {
          metadata: { contentType: 'video/mp4' },
          validation: false,
        });

        const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

        logger.log(`[FAL] ✅ Video Grok subido a Storage: ${permanentUrl}`);

        return {
          success: true,
          videoUrl: permanentUrl,
          duration: videoData.duration || options.duration || 6,
          width: videoData.width,
          height: videoData.height,
          fps: videoData.fps,
          numFrames: videoData.num_frames,
          provider: 'fal-grok-image-to-video'
        };
      }
    } catch (uploadError: any) {
      logger.warn(`[FAL] ⚠️ Error subiendo video Grok a Storage: ${uploadError.message}`);
    }

    return {
      success: true,
      videoUrl: videoData.url,
      duration: videoData.duration || options.duration || 6,
      width: videoData.width,
      height: videoData.height,
      fps: videoData.fps,
      numFrames: videoData.num_frames,
      provider: 'fal-grok-image-to-video'
    };

  } catch (error: any) {
    logger.error('[FAL] Error generando video con Grok:', error.message);
    
    // Fallback 1: Intentar con Wan 2.6
    logger.warn('[FAL] 🔄 Intentando fallback con Wan 2.6...');
    try {
      const wanResult = await generateVideoFromImageWithWan(imageUrl, prompt, {
        resolution: options.resolution,
        aspectRatio: options.aspectRatio === 'auto' ? '16:9' : options.aspectRatio as any,
        duration: options.duration
      });
      
      if (wanResult.success) {
        return wanResult;
      }
    } catch (wanError: any) {
      logger.error('[FAL] ❌ Fallback Wan también falló:', wanError.message);
    }
    
    // Fallback 2: Intentar con Gemini Veo 3
    logger.warn('[FAL] 🔄 Intentando fallback con Gemini Veo 3...');
    try {
      const geminiService = await import('./gemini-image-service');
      const veoResult = await geminiService.generateVideoWithGeminiVeo(imageUrl, prompt, {
        duration: options.duration || 5,
        aspectRatio: options.aspectRatio === 'auto' ? '16:9' : options.aspectRatio as any
      });
      
      if (veoResult.success && veoResult.videoUrl) {
        logger.log('[FAL] ✅ Fallback Gemini Veo 3 exitoso');
        return {
          success: true,
          videoUrl: veoResult.videoUrl,
          duration: options.duration || 5,
          provider: 'gemini-veo-3-fallback' as any
        };
      }
    } catch (veoError: any) {
      logger.error('[FAL] ❌ Fallback Gemini Veo 3 también falló:', veoError.message);
    }
    
    // Si todos fallan, retornar error
    return {
      success: false,
      error: error.message,
      provider: 'fal-grok-image-to-video'
    };
  }
}

/**
 * ============================================================
 * EDICIÓN DE VIDEO - GROK IMAGINE VIDEO EDIT (xAI)
 * ============================================================
 * Modelo: xai/grok-imagine-video/edit-video
 * Edita videos existentes con instrucciones de texto
 * Casos de uso: colorizar, estilizar, transformar
 * Precio: $0.06/segundo (input + output)
 * 
 * @param videoUrl - URL del video a editar (max 8 segundos, 854x480)
 * @param editPrompt - Instrucciones de edición (ej: "Colorize the video", "Add cyberpunk style")
 * @param options - Opciones de resolución
 */
export async function editVideoWithGrok(
  videoUrl: string,
  editPrompt: string,
  options: {
    resolution?: 'auto' | '480p' | '720p';
  } = {}
): Promise<FalVideoResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] ✏️ Editando video con Grok Edit Video (xAI)...`);
    logger.log(`[FAL] Video URL: ${videoUrl.substring(0, 80)}...`);
    logger.log(`[FAL] Edit Prompt: ${editPrompt}`);

    // Parámetros para xai/grok-imagine-video/edit-video
    const requestBody = {
      prompt: editPrompt,
      video_url: videoUrl,
      resolution: options.resolution || 'auto'
    };

    logger.log(`[FAL] Request a Grok Edit:`, JSON.stringify(requestBody));

    // Usar queue para operaciones largas
    const response = await axios.post(
      `${FAL_QUEUE_URL}/${FAL_MODELS.GROK_EDIT_VIDEO}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    const requestId = response.data.request_id;
    const statusUrl = response.data.status_url;
    const responseUrl = response.data.response_url;

    logger.log(`[FAL] Grok Edit Request ID: ${requestId}`);

    // Polling para obtener el resultado
    let result = null;
    let attempts = 0;
    const maxAttempts = 120;

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const statusResponse = await axios.get(statusUrl, {
        headers: { 'Authorization': `Key ${FAL_API_KEY}` }
      });

      logger.log(`[FAL] Grok Edit Status: ${statusResponse.data.status} (attempt ${attempts + 1})`);

      if (statusResponse.data.status === 'COMPLETED') {
        const resultResponse = await axios.get(responseUrl, {
          headers: { 'Authorization': `Key ${FAL_API_KEY}` }
        });
        result = resultResponse.data;
        break;
      } else if (statusResponse.data.status === 'FAILED') {
        throw new Error(statusResponse.data.error || 'Grok video edit failed');
      }

      attempts++;
    }

    if (!result) {
      throw new Error('Grok video edit timeout');
    }

    const videoData = result.video;
    if (!videoData?.url) {
      throw new Error('No se recibió URL de video editado de Grok');
    }

    logger.log(`[FAL] ✅ Video editado con Grok: ${videoData.url.substring(0, 80)}...`);

    // Subir a Firebase Storage
    try {
      const videoResponse = await axios.get(videoData.url, {
        responseType: 'arraybuffer',
        timeout: 120000
      });

      if (storage) {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const fileName = `grok-edited-videos/${timestamp}_${randomId}.mp4`;

        const bucket = storage.bucket();
        const file = bucket.file(fileName);

        await file.save(Buffer.from(videoResponse.data), {
          metadata: { contentType: 'video/mp4' },
          validation: false,
        });

        const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

        return {
          success: true,
          videoUrl: permanentUrl,
          duration: videoData.duration,
          width: videoData.width,
          height: videoData.height,
          fps: videoData.fps,
          provider: 'fal-grok-edit-video'
        };
      }
    } catch (uploadError: any) {
      logger.warn(`[FAL] ⚠️ Error subiendo video editado a Storage: ${uploadError.message}`);
    }

    return {
      success: true,
      videoUrl: videoData.url,
      duration: videoData.duration,
      width: videoData.width,
      height: videoData.height,
      fps: videoData.fps,
      provider: 'fal-grok-edit-video'
    };

  } catch (error: any) {
    logger.error('[FAL] Error editando video con Grok:', error.message);
    return {
      success: false,
      error: error.message || 'Error editando video con Grok',
      provider: 'fal-grok-edit-video'
    };
  }
}

/**
 * ============================================================
 * WORKFLOW COMPLETO: Imagen → Video con Grok
 * ============================================================
 * Genera imagen con nano-banana y la convierte a video con Grok
 * 
 * @param imagePrompt - Prompt para generar la imagen
 * @param motionPrompt - Prompt para el movimiento del video
 * @param options - Opciones de aspecto ratio, duración, etc.
 */
export async function generateMusicVideoScene(
  imagePrompt: string,
  motionPrompt: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: number;
    resolution?: '480p' | '720p';
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
    logger.log('[FAL] 🎬 Generando escena completa de Music Video...');
    logger.log(`[FAL] Image Prompt: ${imagePrompt.substring(0, 100)}...`);
    logger.log(`[FAL] Motion Prompt: ${motionPrompt.substring(0, 100)}...`);

    // Paso 1: Generar imagen con nano-banana
    const nanoBananaAspect = options.aspectRatio === '9:16' ? '9:16' : 
                             options.aspectRatio === '1:1' ? '1:1' : '16:9';
    
    const imageResult = await generateImageWithNanoBanana(imagePrompt, {
      aspectRatio: nanoBananaAspect as NanoBananaAspectRatio
    });

    if (!imageResult.success || !imageResult.imageUrl) {
      throw new Error(`Error generando imagen: ${imageResult.error}`);
    }

    logger.log(`[FAL] ✅ Imagen generada: ${imageResult.imageUrl.substring(0, 60)}...`);

    // Paso 2: Convertir a video con Grok Imagine
    const videoResult = await generateVideoWithGrok(imageResult.imageUrl, motionPrompt, {
      duration: options.duration || 6,
      resolution: options.resolution || '720p',
      aspectRatio: options.aspectRatio || '16:9'
    });

    if (!videoResult.success || !videoResult.videoUrl) {
      throw new Error(`Error generando video: ${videoResult.error}`);
    }

    logger.log(`[FAL] ✅ Video generado: ${videoResult.videoUrl.substring(0, 60)}...`);

    // Paso 3 (Opcional): Editar/estilizar con Grok Edit
    let editedVideoUrl: string | undefined;
    if (options.editStyle) {
      const editResult = await editVideoWithGrok(videoResult.videoUrl, options.editStyle);
      if (editResult.success && editResult.videoUrl) {
        editedVideoUrl = editResult.videoUrl;
        logger.log(`[FAL] ✅ Video editado: ${editedVideoUrl.substring(0, 60)}...`);
      }
    }

    return {
      success: true,
      imageUrl: imageResult.imageUrl,
      videoUrl: videoResult.videoUrl,
      editedVideoUrl
    };

  } catch (error: any) {
    logger.error('[FAL] Error en workflow de Music Video Scene:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * ============================================================
 * GENERACIÓN DE VIDEO - FAL AI WAN 2.6 (Image-to-Video) - FALLBACK
 * ============================================================
 * Modelo: fal-ai/wan/v2.6/image-to-video
 * Convierte una imagen estática en un video animado
 * Usado como fallback cuando Grok falla
 * 
 * @param imageUrl - URL de la imagen a convertir en video
 * @param prompt - Descripción del movimiento/animación deseada
 * @param options - Opciones adicionales (resolution, duration, etc.)
 */
export async function generateVideoFromImageWithWan(
  imageUrl: string,
  prompt: string,
  options: {
    resolution?: '480p' | '720p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: number;
  } = {}
): Promise<FalVideoResult> {
  try {
    if (!FAL_API_KEY) {
      throw new Error('FAL_API_KEY no configurada');
    }

    logger.log(`[FAL] 🎬 Generando video con Wan 2.6 (Fallback)...`);
    logger.log(`[FAL] Image URL: ${imageUrl.substring(0, 80)}...`);

    const requestBody = {
      image_url: imageUrl,
      prompt: prompt,
      negative_prompt: "blurry, distorted, low quality, deformed face, ugly, gibberish text, fake brand names, misspelled words, random letters, watermark, '4K' label, 'UNSPECIFIED', 'PROFESSIONAL GRADE', placeholder text, lorem ipsum, garbled typography, hallucinated logos",  
      num_frames: options.duration ? options.duration * 8 : 40,
      resolution: options.resolution || '480p',
      aspect_ratio: options.aspectRatio || '1:1',
      seed: Math.floor(Math.random() * 1000000)
    };

    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.IMAGE_TO_VIDEO_FALLBACK}`,
      requestBody,
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }
    );

    let videoUrl = response.data?.video?.url ||
                   response.data?.video_url ||
                   response.data?.output?.video_url;

    if (videoUrl) {
      logger.log(`[FAL] ✅ Video Wan generado: ${videoUrl.substring(0, 80)}...`);

      // Subir a Firebase Storage
      try {
        const videoResponse = await axios.get(videoUrl, {
          responseType: 'arraybuffer',
          timeout: 60000
        });

        if (storage) {
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substring(7);
          const fileName = `wan-videos/${timestamp}_${randomId}.mp4`;

          const bucket = storage.bucket();
          const file = bucket.file(fileName);

          await file.save(Buffer.from(videoResponse.data), {
            metadata: { contentType: 'video/mp4' },
            validation: false,
          });

          const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

          return {
            success: true,
            videoUrl: permanentUrl,
            duration: options.duration || 5,
            provider: 'fal-wan-image-to-video'
          };
        }
      } catch (uploadError: any) {
        logger.warn(`[FAL] ⚠️ Error subiendo video Wan a Storage: ${uploadError.message}`);
      }

      return {
        success: true,
        videoUrl: videoUrl,
        duration: options.duration || 5,
        provider: 'fal-wan-image-to-video'
      };
    }

    throw new Error('No se recibió URL de video en la respuesta de Wan');

  } catch (error: any) {
    logger.error('[FAL] Error generando video con Wan:', error.message);
    return {
      success: false,
      error: error.message,
      provider: 'fal-wan-image-to-video'
    };
  }
}

/**
 * ============================================================
 * GENERACIÓN DE VIDEO - WRAPPER PRINCIPAL
 * ============================================================
 * Usa Grok como primario y Wan como fallback
 * 
 * @param imageUrl - URL de la imagen a convertir en video
 * @param prompt - Descripción del movimiento/animación deseada
 * @param options - Opciones adicionales (resolution, duration, etc.)
 */
export async function generateVideoFromImage(
  imageUrl: string,
  prompt: string,
  options: {
    resolution?: '480p' | '720p';
    aspectRatio?: '16:9' | '9:16' | '1:1';
    duration?: number; // segundos (default 6 para Grok, 5 para Wan)
    useGrok?: boolean; // true por defecto - usa Grok como primario
  } = {}
): Promise<FalVideoResult> {
  // Por defecto usar Grok Imagine Video como primario
  const useGrokPrimary = options.useGrok !== false;
  
  if (useGrokPrimary) {
    logger.log(`[FAL] 🎬 Usando Grok Imagine Video como primario...`);
    return generateVideoWithGrok(imageUrl, prompt, {
      duration: options.duration || 6,
      resolution: options.resolution || '720p',
      aspectRatio: options.aspectRatio || '16:9'
    });
  } else {
    // Fallback directo a Wan
    logger.log(`[FAL] 🎬 Usando Wan 2.6 directamente...`);
    return generateVideoFromImageWithWan(imageUrl, prompt, options);
  }
}

/**
 * Genera prompts de performing específicos por género musical
 * Cada género tiene su estilo artístico y movimientos característicos
 */
function getGenrePerformingPrompt(artistName: string, genre: string): string {
  const genreLower = genre.toLowerCase();
  
  // Prompts de performing artístico específicos por género
  const genrePrompts: Record<string, string> = {
    // 🎸 Rock / Metal
    'rock': `${artistName} performing intensely, headbanging with passion, playing air guitar, dramatic rock star pose, stage lights flashing, powerful energy, rebellious attitude, leather jacket vibes, epic rock concert atmosphere`,
    'metal': `${artistName} performing aggressively, intense headbanging, devil horns gesture, screaming with power, dark dramatic lighting, metal concert energy, fierce expression, flames and smoke atmosphere`,
    'punk': `${artistName} performing with raw energy, jumping and moshing, rebellious punk attitude, DIY aesthetic, aggressive movements, spitting fire, underground club vibes`,
    'alternative': `${artistName} performing with artistic intensity, emotional expressions, dramatic gestures, moody lighting, alternative rock stage presence`,
    
    // 🎤 Hip-Hop / Rap / Trap
    'hip-hop': `${artistName} performing on stage, confident swagger, hand gestures to the crowd, gold chains swinging, dropping bars with attitude, hip-hop dance moves, DJ lights behind, urban concert vibes`,
    'rap': `${artistName} rapping with intensity, mic in hand, aggressive hand gestures, confident posture, trap lights, stage smoke, dropping verses with flow, street credibility`,
    'trap': `${artistName} performing trap music, lean movements, ice dripping, hood up, dark purple lights, smoke effects, bass heavy atmosphere, street king energy`,
    'drill': `${artistName} performing drill, masked up aesthetic, aggressive stance, street energy, dark lighting, menacing but artistic presence`,
    
    // 🎹 Electronic / EDM
    'electronic': `${artistName} DJ performing at festival, hands on mixer, neon lights pulsing, LED screens behind, crowd going wild, euphoric electronic music atmosphere, laser beams`,
    'edm': `${artistName} DJ dropping the beat, massive festival stage, confetti explosion, LED pyramid, hands up moment, peak time energy, electronic dance music euphoria`,
    'house': `${artistName} DJ in underground club, deep house vibes, intimate atmosphere, disco ball reflections, smooth groove movements, sophisticated electronic aesthetic`,
    'techno': `${artistName} performing techno, industrial warehouse setting, strobe lights, hypnotic movements, dark and minimal aesthetic, berlin club vibes`,
    
    // 🎷 Jazz / Blues / Soul
    'jazz': `${artistName} performing jazz, smooth movements, eyes closed feeling the music, saxophone or piano nearby, blue spotlight, smoky jazz club atmosphere, sophisticated elegance`,
    'blues': `${artistName} performing blues with soul, emotional expressions, guitar solo moment, dim warm lighting, intimate blues bar setting, raw emotional performance`,
    'soul': `${artistName} singing with deep emotion, gospel-style gestures, powerful vocal performance, warm golden lights, touching hearts, soul music passion`,
    'r&b': `${artistName} performing R&B sensually, smooth dance moves, romantic lighting, silky movements, seductive stage presence, modern R&B vibes`,
    
    // 🌴 Reggae / Latin
    'reggae': `${artistName} performing reggae, rastafari vibes, peaceful movements, red gold green lights, smoke effects, chill island atmosphere, one love energy`,
    'reggaeton': `${artistName} performing reggaeton, perreo dance moves, latin party energy, neon club lights, sensual movements, puerto rico vibes, dembow rhythm`,
    'latin': `${artistName} performing latin music, passionate dance moves, salsa energy, colorful stage, Latin pride, fiery performance, hispanic celebration`,
    
    // 🎻 Classical / Orchestra
    'classical': `${artistName} conducting orchestra, elegant movements, dramatic gestures, concert hall grandeur, tuxedo formal, symphonic excellence, maestro energy`,
    'opera': `${artistName} performing opera, dramatic theatrical pose, powerful vocal expression, grand stage, spotlight solo, classical magnificence`,
    
    // 🌊 Chill / Ambient
    'lofi': `${artistName} creating lofi beats, relaxed vibe, headphones on, nostalgic aesthetic, anime-style lighting, cozy room atmosphere, study session energy`,
    'ambient': `${artistName} in meditative state, ethereal movements, soft glowing lights, peaceful expression, floating sensation, transcendental atmosphere`,
    'chill': `${artistName} relaxed performance, laid-back vibes, sunset colors, beach atmosphere, acoustic session, warm peaceful energy`,
    
    // 🎵 Pop / Mainstream
    'pop': `${artistName} performing pop concert, energetic dance choreography, colorful stage production, backup dancers, confetti falling, mainstream star energy, arena tour vibes`,
    'k-pop': `${artistName} performing K-pop, precise choreography, synchronized dance, colorful neon aesthetics, perfect styling, idol energy, Korean pop star vibes`,
    'indie': `${artistName} performing indie music, authentic artistic expression, vintage microphone, intimate venue, fairy lights, hipster aesthetic, genuine connection`,
    
    // 🌍 World / Folk
    'folk': `${artistName} performing folk music, acoustic guitar, storytelling expression, campfire atmosphere, rustic setting, authentic roots vibes`,
    'country': `${artistName} performing country, cowboy aesthetic, acoustic guitar, stadium lights, American heartland vibes, storytelling passion`,
    'afrobeat': `${artistName} performing afrobeat, vibrant African dance moves, colorful traditional elements, drums and percussion energy, celebration of culture`,
  };

  // Buscar coincidencia exacta o parcial
  for (const [key, prompt] of Object.entries(genrePrompts)) {
    if (genreLower.includes(key) || key.includes(genreLower)) {
      return prompt;
    }
  }

  // Prompt por defecto para géneros no especificados
  return `${artistName} performing ${genre} music passionately on stage, dynamic artistic movements, professional lighting, concert atmosphere, genuine musical expression, captivating stage presence, artistic performance matching their ${genre} style`;
}

/**
 * Genera un video de loop para el perfil de un artista
 * Crea un performing artístico dinámico basado en el género musical
 * 
 * @param profileImageUrl - URL de la imagen de perfil del artista
 * @param artistName - Nombre del artista (para prompt)
 * @param genre - Género musical (para estilo del performing)
 */
export async function generateArtistProfileVideo(
  profileImageUrl: string,
  artistName: string,
  genre: string = 'pop'
): Promise<FalVideoResult> {
  try {
    logger.log(`[FAL] 🎬 Generando video de performing para ${artistName} (${genre})...`);

    // Obtener prompt de performing específico para el género
    const performingStyle = getGenrePerformingPrompt(artistName, genre);

    // Prompt completo con instrucciones técnicas de video
    const motionPrompt = `${performingStyle}. 
Cinematic quality video, smooth fluid motion, professional music video aesthetic.
Maintain exact facial features and appearance from the image.
Dynamic camera angles, concert-quality lighting effects.
Seamless loop, high production value, artistic music performance.`;

    logger.log(`[FAL] 🎭 Prompt de performing: ${performingStyle.substring(0, 100)}...`);

    const result = await generateVideoFromImage(
      profileImageUrl,
      motionPrompt,
      {
        resolution: '480p', // Óptimo para loop videos de perfil
        aspectRatio: '1:1', // Cuadrado para perfil
        duration: 5 // 5 segundos loop
      }
    );

    if (result.success) {
      logger.log(`[FAL] ✅ Video de performing generado para ${artistName}: ${result.videoUrl?.substring(0, 60)}...`);
    } else {
      logger.warn(`[FAL] ⚠️ No se pudo generar video de performing: ${result.error}`);
    }

    return result;

  } catch (error: any) {
    logger.error(`[FAL] ❌ Error generando video de performing:`, error.message);
    return {
      success: false,
      error: error.message || 'Error generando video de performing',
      provider: 'fal-wan-image-to-video'
    };
  }
}

// ═══════════════════════════════════════════════════════════
// VIRAL PRODUCT PROMO - Image + Video generation for TikTok
// ═══════════════════════════════════════════════════════════

/**
 * Generate a promotional image: artist HOLDING the product
 * 
 * Pipeline:
 * 1. Downloads both images (artist profile + product)
 * 2. Creates a composite with sharp — artist as background, product placed at
 *    chest/hands level (center of torso area) so the AI can blend them naturally
 * 3. Sends composite to Nano Banana 2 Edit to blend the product into the person's hands
 * 4. If AI fails → returns the raw composite as fallback (still shows both images)
 */
export async function generateProductPromoImage(
  artistImageUrl: string,
  productImageUrl: string,
  productName: string,
  options: { aspectRatio?: NanoBananaAspectRatio } = {}
): Promise<FalImageResult> {
  const shortName = productName.length > 60 ? productName.substring(0, 60) : productName;
  
  logger.log(`[FAL] 🛍️ Generating product promo: artist holding "${shortName}"`);
  logger.log(`[FAL] Artist: ${artistImageUrl.substring(0, 80)}`);
  logger.log(`[FAL] Product: ${productImageUrl.substring(0, 80)}`);
  
  // Helper to persist a FAL temp URL to Firebase
  const persistImage = async (tempUrl: string): Promise<FalImageResult> => {
    const downloaded = await downloadImageAsBase64(tempUrl);
    if (downloaded) {
      const permanentUrl = await uploadBase64ToStorage(
        downloaded.base64, downloaded.mimeType, 'viral-promo-images'
      );
      return { success: true, imageUrl: permanentUrl, imageBase64: downloaded.base64, provider: 'fal-flux-2-pro' };
    }
    return { success: true, imageUrl: tempUrl, provider: 'fal-flux-2-pro' };
  };
  
  // ═══════════════════════════════════════════════════════════════
  // STRATEGY 1: GPT Image 1.5 Edit — BEST for multi-image merging
  // Accepts BOTH images as separate inputs → AI merges intelligently
  // ═══════════════════════════════════════════════════════════════
  try {
    logger.log(`[FAL] 🎯 Strategy 1: GPT Image 1.5 Edit (multi-image merge)...`);
    
    const gptPrompt = `Create a professional product endorsement photo. The person from the first image is naturally holding and presenting the product shown in the second image. The person holds the product at chest level with both hands, showing it to the camera. Keep the EXACT same person, same face, same identity from the first image. The product must be the EXACT same product from the second image. Professional studio lighting, commercial photography style, clean background, photorealistic, high quality. No text, no watermarks, no logos.`;
    
    const gptResponse = await axios.post(
      `${FAL_BASE_URL}/fal-ai/gpt-image-1.5/edit`,
      {
        prompt: gptPrompt,
        image_urls: [artistImageUrl, productImageUrl],
        image_size: '1024x1536', // Portrait
        quality: 'high',
        input_fidelity: 'high',
        num_images: 1,
        output_format: 'png',
      },
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 180000,
      }
    );
    
    const gptImageUrl = gptResponse.data?.images?.[0]?.url;
    if (gptImageUrl) {
      logger.log(`[FAL] ✅ GPT Image 1.5 Edit succeeded!`);
      return persistImage(gptImageUrl);
    }
  } catch (gptError: any) {
    logger.warn(`[FAL] ⚠️ GPT Image 1.5 failed: ${gptError.response?.data?.detail || gptError.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STRATEGY 2: Flux Kontext — contextual editing on artist image
  // Sends ONLY the artist image + text describing the product
  // Kontext preserves the face and naturally adds a product
  // ═══════════════════════════════════════════════════════════════
  try {
    logger.log(`[FAL] 🔄 Strategy 2: Flux Kontext (artist image + product description)...`);
    
    const kontextPrompt = `Make this person hold a "${shortName}" product in their hands at chest level. They are presenting and endorsing the product for a commercial photo. Add the product naturally into their hands. Keep the exact same person, same face, same clothing. Professional product endorsement photography, studio lighting, clean, no text, no watermarks`;
    
    const kontextResponse = await axios.post(
      `${FAL_BASE_URL}/fal-ai/flux-pro/kontext`,
      {
        prompt: kontextPrompt,
        image_url: artistImageUrl,
        guidance_scale: 4.0,
        num_images: 1,
        output_format: 'jpeg',
        safety_tolerance: '5',
        aspect_ratio: '9:16',
      },
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );
    
    const kontextImageUrl = kontextResponse.data?.images?.[0]?.url;
    if (kontextImageUrl) {
      logger.log(`[FAL] ✅ Flux Kontext succeeded!`);
      return persistImage(kontextImageUrl);
    }
  } catch (kontextError: any) {
    logger.warn(`[FAL] ⚠️ Flux Kontext failed: ${kontextError.response?.data?.detail || kontextError.message}`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // STRATEGY 3: Bria Embed Product — pixel-perfect product overlay
  // Places the exact product image on top of the artist scene
  // ═══════════════════════════════════════════════════════════════
  try {
    logger.log(`[FAL] 🔄 Strategy 3: Bria Embed Product...`);
    
    const artistRes = await axios.get(artistImageUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const artistMeta = await sharp(Buffer.from(artistRes.data)).metadata();
    const imgW = artistMeta.width || 1024;
    const imgH = artistMeta.height || 1024;
    
    const productW = Math.floor(imgW * 0.30);
    const productH = Math.floor(imgH * 0.25);
    const productX = Math.floor((imgW - productW) / 2);
    const productY = Math.floor(imgH * 0.50);
    
    const briaResponse = await axios.post(
      `${FAL_BASE_URL}/bria/embed-product`,
      {
        image_source: artistImageUrl,
        products: [{
          image_source: productImageUrl,
          coordinates: { x: productX, y: productY, width: productW, height: productH },
        }],
        seed: Math.floor(Math.random() * 10000),
        sync_mode: true,
      },
      {
        headers: {
          'Authorization': `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 120000,
      }
    );
    
    const briaImageUrl = briaResponse.data?.image?.url;
    if (briaImageUrl) {
      logger.log(`[FAL] ✅ Bria Embed Product succeeded!`);
      return persistImage(briaImageUrl);
    }
  } catch (briaError: any) {
    logger.warn(`[FAL] ⚠️ Bria failed: ${briaError.response?.data?.detail || briaError.message}`);
  }

  // ═══════════════════════════════════════════════════════════════
  // STRATEGY 3.5: OpenAI gpt-image-1 Edit — fallback OpenAI obligatorio.
  // Requisito: si FAL falla, SIEMPRE usar el modelo de imágenes de OpenAI.
  // gpt-image-1 fusiona ambas referencias (artista + producto) de forma
  // inteligente, muy superior al composite crudo de abajo.
  // ═══════════════════════════════════════════════════════════════
  if (process.env.OPENAI_API_KEY) {
    try {
      logger.log(`[FAL] 🤖 Strategy 3.5: OpenAI gpt-image-1 Edit (artista + producto)...`);
      const openaiPrompt = `Professional product endorsement photo. The exact same person from the first reference image is naturally holding and presenting the product from the second reference image at chest level with both hands, showing it to the camera. Keep the EXACT same person, same face and identity. The product must be the EXACT same "${shortName}". Commercial studio lighting, photorealistic, clean background. No text, no watermarks, no logos.`;
      const openaiResult = await editImageWithGPTImage1(
        [artistImageUrl, productImageUrl],
        openaiPrompt,
        { size: '1024x1536', quality: 'high', outputFolder: 'viral-promo-images' }
      );
      if (openaiResult.success && openaiResult.imageUrl) {
        logger.log(`[FAL] ✅ OpenAI gpt-image-1 Edit succeeded!`);
        return { ...openaiResult, provider: 'openai-gpt-image-1-edit' };
      }
    } catch (openaiError: any) {
      logger.warn(`[FAL] ⚠️ OpenAI gpt-image-1 Edit failed: ${openaiError.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STRATEGY 4: Raw sharp composite (last resort)
  // ═══════════════════════════════════════════════════════════════
  try {
    logger.log(`[FAL] ⚠️ All AI models failed — building raw composite`);
    
    const [artistResFb, productResFb] = await Promise.all([
      axios.get(artistImageUrl, { responseType: 'arraybuffer', timeout: 30000 }),
      axios.get(productImageUrl, { responseType: 'arraybuffer', timeout: 30000 }),
    ]);
    
    const W = 720, H = 1280;
    const artistLayer = await sharp(Buffer.from(artistResFb.data))
      .resize(W, H, { fit: 'cover', position: 'top' }).toBuffer();
    
    const productSize = Math.floor(W * 0.35);
    const productResized = await sharp(Buffer.from(productResFb.data))
      .resize(productSize, productSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toBuffer();
    
    const prodMeta = await sharp(productResized).metadata();
    const prodLeft = Math.floor((W - (prodMeta.width || productSize)) / 2);
    const prodTop = Math.floor(H * 0.50);
    
    const compositeBuffer = await sharp(artistLayer)
      .composite([{ input: productResized, left: prodLeft, top: prodTop }])
      .jpeg({ quality: 93 }).toBuffer();
    
    const compositeBase64 = compositeBuffer.toString('base64');
    const compositeUrl = await uploadBase64ToStorage(compositeBase64, 'image/jpeg', 'viral-composites');
    
    return { success: true, imageUrl: compositeUrl, imageBase64: compositeBase64, provider: 'fal-flux-2-pro' };
  } catch (fbError: any) {
    logger.error(`[FAL] ❌ Even composite fallback failed:`, fbError.message);
    return { success: false, error: `Promo generation failed: ${fbError.message}` };
  }
}

/**
 * Generate a TikTok-style promotional video from a promo image
 * Uses Grok Imagine Video for 6s vertical video
 */
export async function generateProductPromoVideo(
  promoImageUrl: string,
  productName: string,
  artistName: string = 'Artist',
  artistGenre: string = 'pop',
): Promise<FalVideoResult> {
  const shortName = productName.length > 50 ? productName.substring(0, 50) : productName;
  
  // Genre-aware creative prompts for TikTok viral style
  const genreVibes: Record<string, string> = {
    'hip-hop': 'confident swagger, urban backdrop with neon city lights, beat-synchronized head nods, slow-mo flex with the product, cinematic lens flare, dark moody atmosphere with vivid accent colors',
    'rap': 'hard flex energy, dramatic shadows, gold-toned lighting, slow motion product reveal, bass-heavy vibes, luxury aesthetic',
    'trap': 'dark moody atmosphere, red and purple neon lighting, smoke effects, intense close-ups, bass drop transition effects, glitch aesthetics',
    'pop': 'bright colorful aesthetic, playful energy, smooth transitions, confetti particles, upbeat movement, clean modern studio lighting',
    'k-pop': 'pastel dreamscape aesthetic, smooth choreographed movement, sparkle effects, soft lighting with color shifts, cute close-up expressions',
    'rock': 'gritty raw energy, dramatic guitar-riff timing, flames and sparks, dark backdrop with spotlights, high contrast, headbang reveals',
    'indie': 'warm golden-hour lighting, vintage film grain, artistic slow-motion, soft bokeh background, contemplative aesthetic',
    'electronic': 'pulsing LED light trails, futuristic holographic effects, beat-synchronized visuals, cyberpunk atmosphere, glowing particle effects',
    'edm': 'high-energy strobe effects, festival-style lighting, drop-moment slow-motion, laser beams, euphoric crowd energy feel',
    'r&b': 'silky smooth camera movement, warm amber lighting, sensual slow pan, candlelit atmosphere, velvet textures',
    'jazz': 'elegant noir aesthetic, warm spotlight, sophisticated camera angles, film grain, smoky lounge atmosphere, golden tones',
    'reggaeton': 'tropical heat, perreo energy, vibrant colors, dynamic camera shake, fiesta atmosphere, sunset golden light',
    'latin': 'fiery passion, vibrant warm colors, rhythmic camera movement, golden hour glow, festive energy',
    'country': 'golden sunset backdrop, rustic warm lighting, open field aesthetic, authentic Americana vibes, dust particles in light',
    'metal': 'fire and brimstone, intense strobing, aggressive camera angles, dark atmosphere, chains and sparks, raw power',
    'reggae': 'tropical island vibes, green gold red color palette, laid-back smooth movement, sunshine through palm trees',
    'soul': 'warm soulful lighting, gospel-inspired radiance, emotional close-ups, golden spotlight, vintage warmth',
    'lofi': 'cozy room aesthetic, warm desk lamp glow, soft rain on window, gentle camera drift, lo-fi purple tones',
  };

  const normalizedGenre = artistGenre.toLowerCase().trim();
  const genreVibe = genreVibes[normalizedGenre] || genreVibes['pop'];

  const prompt = `Cinematic TikTok product advertisement. ${artistName} showcases "${shortName}" with magnetic charisma. ${genreVibe}. Dynamic camera movement — starts wide then smoothly pushes into a dramatic close-up of the product. Professional commercial lighting. Micro-expressions of excitement and satisfaction. The product is the star — held up, examined, revealed with impact. Vertical format optimized for mobile. Ultra-smooth 24fps motion. No text, no watermarks, no logos, no captions.`;
  
  logger.log(`[FAL] 🎬 Generating product promo video for "${shortName}" (genre: ${artistGenre})...`);
  
  return generateVideoWithGrok(promoImageUrl, prompt, {
    duration: 6,
    resolution: '720p',
    aspectRatio: '9:16',
  });
}

// ============================================================
// 🔥 VIRAL CONTENT STUDIO — Happy Horse (Alibaba) + GPT-Image-2
// ============================================================
// Modelos especializados para generar contenido viral de redes sociales.
// Pipeline: prompt viral → imagen optimizada → edición opcional → video corto (≤15s).
// Casos de uso: promocionar canción, video, merchandise, o el servicio Boostify.

/**
 * Edita una imagen existente con OpenAI GPT-Image-2 (vía FAL BYOK).
 * Coste interno: ~$0.08 por imagen (1024x1024 high quality).
 */
export async function editImageWithGPTImage2(
  imageUrls: string[],
  prompt: string,
  options: {
    aspectRatio?: '1:1' | '9:16' | '16:9' | 'auto';
    quality?: 'low' | 'medium' | 'high';
  } = {}
): Promise<FalImageResult> {
  if (!imageUrls.length) {
    return { success: false, error: 'Se requiere al menos una imagen de referencia' };
  }

  // Fallback directo a OpenAI gpt-image-1 (edición) — requisito: si FAL falla,
  // SIEMPRE editar con el modelo de imágenes de OpenAI.
  const openaiEditFallback = async (reason: string): Promise<FalImageResult> => {
    if (!process.env.OPENAI_API_KEY) {
      return { success: false, error: `${reason} · OPENAI_API_KEY no configurada` };
    }
    logger.log(`[FAL][ViralStudio] 🤖 Fallback edición OpenAI gpt-image-1 (${reason})...`);
    const r = await editImageWithGPTImage1(imageUrls, prompt, {
      size: mapAspectToGptImageSize(options.aspectRatio),
      quality: options.quality || 'high',
      outputFolder: 'viral-studio-images',
    });
    if (r.success && r.imageUrl) {
      logger.log('[FAL][ViralStudio] ✅ Fallback OpenAI gpt-image-1 edit exitoso');
      return { ...r, provider: 'openai-gpt-image-1-edit' as any };
    }
    return { success: false, error: r.error || reason };
  };

  // Si no hay FAL key, vamos directo a OpenAI.
  if (!FAL_API_KEY) {
    return openaiEditFallback('FAL_API_KEY no configurada');
  }
  // gpt-image-2 vía FAL necesita la OpenAI key (BYOK); si no existe, usa OpenAI directo.
  if (!process.env.OPENAI_API_KEY) {
    return { success: false, error: 'OPENAI_API_KEY no configurada (requerida para edición de imágenes)' };
  }

  try {
    const openaiKey = process.env.OPENAI_API_KEY;

    logger.log(`[FAL][ViralStudio] 🎨 GPT-Image-2 Edit: ${imageUrls.length} ref(s) | "${prompt.substring(0, 80)}..."`);

    const response = await axios.post(
      `${FAL_BASE_URL}/${FAL_MODELS.GPT_IMAGE_2_EDIT}`,
      {
        prompt,
        image_urls: imageUrls,
        aspect_ratio: options.aspectRatio || '1:1',
        quality: options.quality || 'high',
        openai_api_key: openaiKey,
      },
      {
        headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 240_000,
      }
    );

    const url: string | undefined = response.data?.images?.[0]?.url || response.data?.image?.url;
    if (!url) throw new Error('GPT-Image-2 no devolvió URL de imagen');

    let permanentUrl = url;
    let imageBase64: string | undefined;
    try {
      const dl = await downloadImageAsBase64(url);
      if (dl) {
        permanentUrl = await uploadBase64ToStorage(dl.base64, dl.mimeType, 'viral-studio-images');
        imageBase64 = dl.base64;
      }
    } catch (e: any) {
      logger.warn(`[FAL][ViralStudio] No se pudo persistir imagen: ${e.message}`);
    }

    logApiUsage({
      apiProvider: 'fal',
      endpoint: FAL_MODELS.GPT_IMAGE_2_EDIT,
      model: 'gpt-image-2-edit',
      status: 'success',
      metadata: { function: 'editImageWithGPTImage2' },
    }).catch(() => {});

    return { success: true, imageUrl: permanentUrl, imageBase64, provider: 'fal:openai/gpt-image-2/edit' };
  } catch (error: any) {
    const msg = error.response?.data?.detail || error.response?.data?.error || error.message;
    logger.error(`[FAL][ViralStudio] GPT-Image-2 edit falló: ${msg} — usando fallback OpenAI`);
    // 🤖 FALLBACK: edición directa con OpenAI gpt-image-1.
    return openaiEditFallback(`FAL gpt-image-2 falló: ${msg}`);
  }
}

// Helper interno: polling FAL queue
async function pollFalQueueResult(
  statusUrl: string,
  responseUrl: string,
  options: { maxAttempts?: number; intervalMs?: number; tag?: string } = {}
): Promise<any> {
  const maxAttempts = options.maxAttempts ?? 180;
  const intervalMs = options.intervalMs ?? 2000;
  const tag = options.tag || 'FAL';
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    const statusRes = await axios.get(statusUrl, { headers: { Authorization: `Key ${FAL_API_KEY}` } });
    if (i % 5 === 0) logger.log(`[${tag}] status=${statusRes.data.status} (${i + 1}/${maxAttempts})`);
    if (statusRes.data.status === 'COMPLETED') {
      const resultRes = await axios.get(responseUrl, { headers: { Authorization: `Key ${FAL_API_KEY}` } });
      return resultRes.data;
    }
    if (statusRes.data.status === 'FAILED') {
      throw new Error(statusRes.data.error || 'FAL job FAILED');
    }
  }
  throw new Error('FAL job timeout');
}

// Helper interno: persiste video remoto en Firebase Storage
async function persistVideoToStorage(remoteUrl: string, folder: string): Promise<string> {
  try {
    if (!storage) return remoteUrl;
    const videoResponse = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 180_000 });
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const fileName = `${folder}/${timestamp}_${randomId}.mp4`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(Buffer.from(videoResponse.data), { metadata: { contentType: 'video/mp4' }, validation: false });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (e: any) {
    logger.warn(`[FAL][ViralStudio] No se pudo persistir video: ${e.message}`);
    return remoteUrl;
  }
}

/**
 * Image-to-Video viral con Happy Horse (Alibaba). Hasta 15 segundos.
 * Coste interno: ~$0.15/segundo.
 */
export async function generateVideoWithHappyHorse(
  imageUrl: string,
  prompt: string,
  options: {
    duration?: 5 | 10 | 15;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    resolution?: '480p' | '720p' | '1080p';
  } = {}
): Promise<FalVideoResult> {
  try {
    if (!FAL_API_KEY) throw new Error('FAL_API_KEY no configurada');
    if (!imageUrl) return { success: false, error: 'imageUrl requerida' };

    const duration = Math.min(15, Math.max(5, options.duration ?? 10));
    logger.log(`[FAL][ViralStudio] 🐎 Happy Horse I2V — ${duration}s | "${prompt.substring(0, 80)}..."`);

    const submitRes = await axios.post(
      `${FAL_QUEUE_URL}/${FAL_MODELS.HAPPY_HORSE_I2V}`,
      {
        prompt,
        image_url: imageUrl,
        duration,
        aspect_ratio: options.aspectRatio || '9:16',
        resolution: options.resolution || '720p',
      },
      {
        headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30_000,
      }
    );

    const { status_url, response_url, request_id } = submitRes.data;
    logger.log(`[FAL][ViralStudio] 🐎 Request ID: ${request_id}`);

    const result = await pollFalQueueResult(status_url, response_url, {
      maxAttempts: 240,
      intervalMs: 2500,
      tag: 'FAL:HappyHorse',
    });

    const videoUrl: string | undefined = result.video?.url || result.output?.url;
    if (!videoUrl) throw new Error('Happy Horse I2V no devolvió URL de video');

    const permanentUrl = await persistVideoToStorage(videoUrl, 'viral-studio-videos');

    logApiUsage({
      apiProvider: 'fal',
      endpoint: FAL_MODELS.HAPPY_HORSE_I2V,
      model: 'happy-horse-i2v',
      status: 'success',
      metadata: { function: 'generateVideoWithHappyHorse', duration },
    }).catch(() => {});

    return {
      success: true,
      videoUrl: permanentUrl,
      duration,
      width: result.video?.width,
      height: result.video?.height,
      fps: result.video?.fps,
      provider: 'fal-grok-image-to-video',
    };
  } catch (error: any) {
    const msg = error.response?.data?.detail || error.response?.data?.error || error.message;
    logger.error(`[FAL][ViralStudio] Happy Horse I2V falló: ${msg}`);
    return { success: false, error: msg };
  }
}

/**
 * Reference-to-Video viral (producto / referencias múltiples) con Happy Horse.
 * Hasta 15 segundos. Coste interno: ~$0.18/segundo.
 */
export async function generateVideoFromReferenceWithHappyHorse(
  referenceImageUrls: string[],
  prompt: string,
  options: {
    duration?: 5 | 10 | 15;
    aspectRatio?: '9:16' | '16:9' | '1:1';
    resolution?: '480p' | '720p' | '1080p';
  } = {}
): Promise<FalVideoResult> {
  try {
    if (!FAL_API_KEY) throw new Error('FAL_API_KEY no configurada');
    if (!referenceImageUrls?.length) {
      return { success: false, error: 'Se requiere al menos una imagen de referencia' };
    }

    const duration = Math.min(15, Math.max(5, options.duration ?? 10));
    logger.log(`[FAL][ViralStudio] 🐎 Happy Horse R2V — ${duration}s | ${referenceImageUrls.length} ref(s)`);

    const submitRes = await axios.post(
      `${FAL_QUEUE_URL}/${FAL_MODELS.HAPPY_HORSE_R2V}`,
      {
        prompt,
        reference_image_urls: referenceImageUrls,
        image_urls: referenceImageUrls,
        duration,
        aspect_ratio: options.aspectRatio || '9:16',
        resolution: options.resolution || '720p',
      },
      {
        headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 30_000,
      }
    );

    const { status_url, response_url, request_id } = submitRes.data;
    logger.log(`[FAL][ViralStudio] 🐎 R2V Request ID: ${request_id}`);

    const result = await pollFalQueueResult(status_url, response_url, {
      maxAttempts: 240,
      intervalMs: 2500,
      tag: 'FAL:HappyHorseR2V',
    });

    const videoUrl: string | undefined = result.video?.url || result.output?.url;
    if (!videoUrl) throw new Error('Happy Horse R2V no devolvió URL de video');

    const permanentUrl = await persistVideoToStorage(videoUrl, 'viral-studio-videos');

    logApiUsage({
      apiProvider: 'fal',
      endpoint: FAL_MODELS.HAPPY_HORSE_R2V,
      model: 'happy-horse-r2v',
      status: 'success',
      metadata: { function: 'generateVideoFromReferenceWithHappyHorse', duration, refs: referenceImageUrls.length },
    }).catch(() => {});

    return {
      success: true,
      videoUrl: permanentUrl,
      duration,
      width: result.video?.width,
      height: result.video?.height,
      fps: result.video?.fps,
      provider: 'fal-grok-image-to-video',
    };
  } catch (error: any) {
    const msg = error.response?.data?.detail || error.response?.data?.error || error.message;
    logger.error(`[FAL][ViralStudio] Happy Horse R2V falló: ${msg}`);
    return { success: false, error: msg };
  }
}

// Exportar todas las funciones
export default {
  // Imágenes
  generateImageWithNanoBanana,
  editImageWithNanoBanana,
  editImageWithGPTImage2,
  generateImageWithFaceReference,

  // 🔥 Viral Content Studio
  generateVideoWithHappyHorse,
  generateVideoFromReferenceWithHappyHorse,
  
  // Videos - Grok Imagine (Principal)
  generateVideoWithGrok,
  editVideoWithGrok,
  generateMusicVideoScene,
  
  // Videos - Wan (Fallback)
  generateVideoFromImageWithWan,
  
  // Videos - Wrapper (usa Grok con fallback a Wan)
  generateVideoFromImage,
  generateArtistProfileVideo,
  
  // Viral Product Promos
  generateProductPromoImage,
  generateProductPromoVideo,
  
  // Música
  generateMusicWithMiniMax,
  generateArtistSongWithFAL,
  
  // Artistas
  generateArtistImagesWithFAL,
  generateMerchandiseImage,
  generateArtistMerchandise,
  
  // Fallback providers
  generateImageWithReplicate,
  
  // Constantes
  FAL_MODELS,

  // Promo Clips — LipSync Engine
  generateOmniHumanLipsync,
  generateSyncLipsyncV3,
  generateKlingV3ProVideo,
  generateSeedanceFastReferenceVideo,
  replaceVideoAudioWithOriginalSong,
  pollFalJobStatus,
};

// ============================================================
// PROMO CLIPS — LIPSYNC ENGINE (100% FAL, sin PiAPI)
// ============================================================

export interface OmniHumanResult {
  success: boolean;
  videoUrl?: string;
  requestId?: string;
  statusUrl?: string;
  resultUrl?: string;
  error?: string;
}

async function uploadBufferToFalStorage(buffer: Buffer, filename: string, contentType: string): Promise<string> {
  const initRes = await axios.post(
    'https://rest.alpha.fal.ai/storage/upload/initiate',
    { file_name: filename, content_type: contentType },
    { headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10000 }
  );
  const fileUrl: string = initRes.data?.file_url;
  const uploadUrl: string = initRes.data?.upload_url;
  if (!fileUrl || !uploadUrl) throw new Error('No upload_url returned from FAL storage initiate');

  await axios.put(uploadUrl, buffer, {
    headers: { 'Content-Type': contentType },
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
  });

  logger.log(`[FAL Storage] ✅ Uploaded ${filename} (${buffer.length} bytes) → ${fileUrl.substring(0, 70)}`);
  return fileUrl;
}

/**
 * Uploads a remote audio/image URL to FAL CDN storage so OmniHuman can download it.
 * FAL workers can reliably fetch files from fal.media but may fail with Firebase/GCS URLs.
 * Returns the fal.media URL, or the original URL if upload fails (best-effort).
 */
async function uploadUrlToFalStorage(remoteUrl: string, filename = 'audio.mp3'): Promise<string> {
  // Skip re-upload if already on FAL CDN
  if (remoteUrl.includes('fal.media') || remoteUrl.includes('v3b.fal.media')) return remoteUrl;
  try {
    // Download the file as a buffer
    const dlRes = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const buf = Buffer.from(dlRes.data);
    const contentType = (dlRes.headers['content-type'] as string) || 'audio/mpeg';
    // Derive extension from content-type
    const ext = contentType.includes('wav') ? '.wav'
      : contentType.includes('ogg') ? '.ogg'
      : contentType.includes('m4a') || contentType.includes('mp4') ? '.m4a'
      : '.mp3';
    const fname = filename.includes('.') ? filename : filename + ext;

    // Step 1: Initiate upload — get presigned upload_url + final file_url
    const initRes = await axios.post(
      'https://rest.alpha.fal.ai/storage/upload/initiate',
      { file_name: fname, content_type: contentType },
      { headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const fileUrl: string = initRes.data?.file_url;
    const uploadUrl: string = initRes.data?.upload_url;
    if (!fileUrl || !uploadUrl) throw new Error('No upload_url returned from FAL storage initiate');

    // Step 2: PUT the binary to the presigned URL
    await axios.put(uploadUrl, buf, {
      headers: { 'Content-Type': contentType },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    logger.log(`[FAL Storage] ✅ Uploaded ${fname} (${buf.length} bytes) → ${fileUrl.substring(0, 70)}`);
    return fileUrl;
  } catch (e: any) {
    logger.warn(`[FAL Storage] Upload failed, using original URL. Error: ${e?.response?.data?.detail || e.message}`);
  }
  return remoteUrl;
}

/**
 * Downloads audio from remoteUrl, trims it to maxDurationSec (default 30s) using ffmpeg,
 * then uploads the trimmed buffer to FAL CDN storage. OmniHuman limit is 60s.
 */
async function trimAndUploadAudioToFal(remoteUrl: string, maxDurationSec = 30, startSeconds = 0): Promise<string> {
  const os = nodeRequire('os') as typeof import('os');
  const path = nodeRequire('path') as typeof import('path');
  const fs = nodeRequire('fs') as typeof import('fs');
  const ffmpeg = nodeRequire('fluent-ffmpeg');
  const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);

  try {
    // Download raw audio
    const safeStartSeconds = Math.max(0, Number.isFinite(startSeconds) ? startSeconds : 0);
    logger.log(`[OmniHuman] Downloading audio for trim: ${remoteUrl.substring(0, 80)}`);
    const dlRes = await axios.get(remoteUrl, { responseType: 'arraybuffer', timeout: 30000 });
    const rawBuf = Buffer.from(dlRes.data);
    const contentType = (dlRes.headers['content-type'] as string) || 'audio/mpeg';
    logger.log(`[OmniHuman] Audio downloaded: ${rawBuf.length} bytes`);

    // Write to temp file
    const tmpDir = os.tmpdir();
    const inputPath = path.join(tmpDir, `omni_in_${Date.now()}.mp3`);
    const outputPath = path.join(tmpDir, `omni_out_${Date.now()}.mp3`);
    fs.writeFileSync(inputPath, rawBuf);

    // Trim with ffmpeg
    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(safeStartSeconds)
        .duration(maxDurationSec)
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    const trimmedBuf = fs.readFileSync(outputPath);
    // Cleanup temp files
    try { fs.unlinkSync(inputPath); fs.unlinkSync(outputPath); } catch (_) {}
    logger.log(`[OmniHuman] Trimmed ${maxDurationSec}s from ${safeStartSeconds}s: ${trimmedBuf.length} bytes`);

    // Upload trimmed buffer to FAL CDN
    const initRes = await axios.post(
      'https://rest.alpha.fal.ai/storage/upload/initiate',
      { file_name: 'audio_trimmed.mp3', content_type: 'audio/mpeg' },
      { headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' }, timeout: 10000 }
    );
    const fileUrl: string = initRes.data?.file_url;
    const uploadUrl: string = initRes.data?.upload_url;
    if (!fileUrl || !uploadUrl) throw new Error('No upload_url from FAL storage');

    await axios.put(uploadUrl, trimmedBuf, {
      headers: { 'Content-Type': 'audio/mpeg' },
      timeout: 60000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });
    logger.log(`[OmniHuman] ✅ Trimmed audio uploaded → ${fileUrl.substring(0, 70)}`);
    return fileUrl;
  } catch (e: any) {
    logger.warn(`[OmniHuman] Audio trim/upload failed, attempting direct upload. Error: ${e.message}`);
    // Fallback: upload original without trimming
    return uploadUrlToFalStorage(remoteUrl, 'audio.mp3');
  }
}

/**
 * OmniHuman v1.5 (ByteDance) — Image + Audio → Video con lipsync emocional en 1 paso.
 * Endpoint: fal-ai/bytedance/omnihuman/v1.5
 * Input: image_url (artista) + audio_url (segmento vocal)
 * Output: video con labios sincronizados + movimiento corporal emocional
 */
export async function generateOmniHumanLipsync(params: {
  imageUrl: string;
  audioUrl: string;
  drivingType?: 'audio';
}): Promise<OmniHumanResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }
  try {
    // Trim audio to 30s max (OmniHuman limit=60s) and upload to FAL CDN
    // Firebase/GCS signed URLs are not accessible from FAL workers
    logger.log(`[OmniHuman] Trimming & uploading audio: ${params.audioUrl.substring(0, 80)}`);
    const falAudioUrl = await trimAndUploadAudioToFal(params.audioUrl, 30);
    logger.log(`[OmniHuman] Audio ready at: ${falAudioUrl.substring(0, 80)}`);

    // Also ensure the image is hosted on FAL CDN (in case it's a Firebase URL)
    const falImageUrl = await uploadUrlToFalStorage(params.imageUrl, 'image.jpg');
    logger.log(`[OmniHuman] Image ready at: ${falImageUrl.substring(0, 80)}`);

    // Submit to queue — OmniHuman v1.5 schema: image_url, audio_url, turbo_mode, resolution
    const submitRes = await axios.post(
      `https://queue.fal.run/${FAL_MODELS.OMNIHUMAN_V15}`,
      {
        image_url: falImageUrl,
        audio_url: falAudioUrl,
        turbo_mode: false,
        resolution: '720p',
      },
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const requestId: string = submitRes.data?.request_id;
    if (!requestId) throw new Error(`No request_id returned from OmniHuman queue — response: ${JSON.stringify(submitRes.data)}`);
    const statusUrl: string = submitRes.data?.status_url || '';
    const resultUrl: string = submitRes.data?.response_url || '';
    logger.log(`[OmniHuman] ✅ Queued lipsync request ${requestId} | statusUrl: ${statusUrl}`);
    return { success: true, requestId, statusUrl, resultUrl };
  } catch (err: any) {
    const falDetail = err?.response?.data?.detail || '';
    const httpStatus = err?.response?.status;
    logger.error(`[OmniHuman] Submit error (HTTP ${httpStatus}):`, falDetail || err.message);
    if (httpStatus === 403 && falDetail?.toLowerCase().includes('balance')) {
      return { success: false, error: '💳 Saldo FAL agotado — recarga en fal.ai/dashboard/billing para continuar generando videos.' };
    }
    if (httpStatus === 403) {
      return { success: false, error: `FAL acceso denegado (403): ${falDetail || 'verifica la API key en fal.ai/dashboard'}` };
    }
    if (httpStatus === 422) {
      return { success: false, error: `FAL parámetros inválidos (422): ${falDetail}` };
    }
    return { success: false, error: falDetail || err.message };
  }
}

export interface SyncLipsyncResult {
  success: boolean;
  videoUrl?: string;
  requestId?: string;
  statusUrl?: string;
  resultUrl?: string;
  referenceAudioUrl?: string;
  error?: string;
}

/**
 * Sync Lipsync v3 (Sync Labs) — video-to-video lipsync profesional.
 * Endpoint: fal-ai/sync-lipsync/v3
 * Input: video_url (base generada con Kling/OmniHuman) + audio_url (segmento vocal)
 * Output: video con lipsync de máxima calidad ("native visual intelligence")
 */
export async function generateSyncLipsyncV3(params: {
  videoUrl: string;
  audioUrl: string;
  clipStartSeconds?: number;
  duration?: number;
  syncMode?: 'cut_off' | 'loop' | 'bounce';
}): Promise<SyncLipsyncResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }
  try {
    const useTrimmedAudio = params.duration !== undefined || (params.clipStartSeconds || 0) > 0;
    const syncAudioUrl = useTrimmedAudio
      ? await trimAndUploadAudioToFal(params.audioUrl, Math.max(4, Math.min(15, Number(params.duration || 5))), Math.max(0, Number(params.clipStartSeconds || 0)))
      : await uploadUrlToFalStorage(params.audioUrl, 'sync3-audio.mp3');

    const submitRes = await axios.post(
      `https://queue.fal.run/${FAL_MODELS.SYNC_LIPSYNC_V3}`,
      {
        video_url: params.videoUrl,
        audio_url: syncAudioUrl,
        sync_mode: params.syncMode || 'cut_off',
      },
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const requestId: string = submitRes.data?.request_id;
    if (!requestId) throw new Error('No request_id returned from SyncLipsync queue');
    const statusUrl: string = submitRes.data?.status_url || '';
    const resultUrl: string = submitRes.data?.response_url || '';
    logger.log(`[SyncLipsync v3] Queued request ${requestId}`);
    return { success: true, requestId, statusUrl, resultUrl, referenceAudioUrl: syncAudioUrl };
  } catch (err: any) {
    logger.error('[SyncLipsync v3] Submit error:', err?.response?.data || err.message);
    return { success: false, error: err?.response?.data?.detail || err.message };
  }
}

export interface KlingV3ProResult {
  success: boolean;
  videoUrl?: string;
  requestId?: string;
  error?: string;
}

/**
 * Kling v3 Pro Image-to-Video — video cinematográfico 9:16 desde imagen.
 * Endpoint: fal-ai/kling-video/v3/pro/image-to-video
 * Input: image_url + prompt cinematográfico
 * Output: video 9:16, duración 5-10s, máxima calidad visual
 */
export async function generateKlingV3ProVideo(params: {
  imageUrl: string;
  prompt: string;
  duration?: 5 | 10;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  negativePrompt?: string;
  modelPath?: string;
  modelLabel?: string;
}): Promise<KlingV3ProResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }
  try {
    const modelPath = params.modelPath || FAL_MODELS.KLING_V3_PRO_I2V;
    const modelLabel = params.modelLabel || 'Kling v3 Pro';
    const isV3 = modelPath.includes('/v3/');
    const negativePrompt = params.negativePrompt || 'blurry, low quality, distorted face, deformed mouth, unnatural movement, text, watermark';
    const input = isV3
      ? {
          start_image_url: params.imageUrl,
          prompt: params.prompt,
          duration: String(params.duration || 5),
          generate_audio: false,
          negative_prompt: negativePrompt,
        }
      : {
          image_url: params.imageUrl,
          prompt: params.prompt,
          duration: String(params.duration || 5),
          aspect_ratio: params.aspectRatio || '9:16',
          negative_prompt: negativePrompt,
          cfg_scale: 0.5,
        };

    const submitRes = await axios.post(
      `https://queue.fal.run/${modelPath}`,
      input,
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );
    const requestId: string = submitRes.data?.request_id;
    if (!requestId) throw new Error(`No request_id returned from ${modelLabel} queue`);
    logger.log(`[${modelLabel}] Queued request ${requestId}`);
    return { success: true, requestId };
  } catch (err: any) {
    logger.error('[Kling I2V] Submit error:', err?.response?.data || err.message);
    return { success: false, error: err?.response?.data?.detail || err.message };
  }
}

export interface SeedanceReferenceVideoResult {
  success: boolean;
  videoUrl?: string;
  requestId?: string;
  statusUrl?: string;
  resultUrl?: string;
  referenceAudioUrl?: string;
  error?: string;
}

function buildSeedanceSingerPrompt(params: {
  prompt?: string;
  hasIdentityReference?: boolean;
  lyricsExcerpt?: string;
  mood?: string;
  energyLevel?: number;
  bpmFeel?: string;
  segmentType?: string;
  songTitle?: string;
}): string {
  const energy = Math.max(1, Math.min(10, Number(params.energyLevel || 6)));
  const energyLabel = energy >= 8 ? 'high-energy' : energy >= 5 ? 'mid-tempo expressive' : 'intimate restrained';
  const lyricsLine = params.lyricsExcerpt?.trim()
    ? `The visible singing should feel like this lyric phrase: "${params.lyricsExcerpt.trim().slice(0, 220)}".`
    : 'The visible singing should follow the vocal phrasing in the audio.';
  const creativeDirection = params.prompt?.trim()
    ? `Creative direction: ${params.prompt.trim().slice(0, 500)}`
    : 'Creative direction: realistic vertical music promo performance, emotionally connected to the song.';
  const identityDirection = params.hasIdentityReference
    ? '@Image1 is the canonical artist profile photo and must define the exact identity. Preserve the same face, facial proportions, skin tone, age, hairstyle, facial hair, eyes, nose, lips, jawline, and overall likeness from @Image1. @Image2 is only the selected visual scene/style reference for wardrobe, lighting, composition and background. Do not merge identities, do not invent a new person, do not beautify into a different face, and do not morph the face away from @Image1.'
    : '@Image1 is the same artist reference and must define the identity. Preserve the same face, facial proportions, skin tone, hairstyle, age and overall likeness. Do not invent a new person or morph the face.';

  return [
    identityDirection,
    'Create a believable short-form music video where the artist performs the real song heard in @Audio1 like a professional singer.',
    'Use @Audio1 as the exact timing, phoneme, syllable, beat, and performance reference. The mouth must open, close, hold vowels, hit consonants, breathe, and change jaw intensity exactly with the vocal phrasing in @Audio1. Head nods, shoulder accents, hand gestures, and body weight shifts must land on the beat, downbeats, vocal phrasing, and emotional rises in the music. Do not compose a new song, do not change the melody, do not change the lyrics, do not change the language, and do not change the singer voice.',
    'Wardrobe continuity lock: use the clothing, headwear, jewelry, microphone, glasses, and accessories visible in @Image2 as fixed props for the entire clip. If a hat or headwear is not clearly visible in @Image2, do not add any hat or headwear. If a hat is visible, keep the exact same hat visible and stable in every frame. Never add, remove, toggle, morph, flicker, or change accessories between frames.',
    `Performance feel: ${energyLabel}, ${params.bpmFeel || 'natural beat'}, ${params.mood || 'song-driven emotion'}, ${params.segmentType || 'hook'} section${params.songTitle ? ` of "${params.songTitle}"` : ''}.`,
    lyricsLine,
    creativeDirection,
    'Make the artist feel like a real singer: natural breath before phrases, focused eyes, subtle facial micro-expressions, human timing imperfections, confident stage presence, and rhythmic body language that reacts to the groove.',
    'Camera and motion: vertical 9:16, realistic handheld music-video camera, gentle push-ins and small reframes only when they match the rhythm. Natural speed, no slow motion, no frozen pose, no robotic movement, no exaggerated dance, no drifting mannequin motion.',
    'Photorealistic skin texture, stable identity, realistic mouth and teeth, natural hands, no animation, no cartoon, no text, no subtitles, no watermark.',
  ].join(' ');
}

/**
 * Seedance 2.0 Fast Reference-to-Video — Image + short song audio → rhythmic singing performance.
 * Default duration is 5s to maximize timing, natural motion and cost control.
 */
export async function generateSeedanceFastReferenceVideo(params: {
  imageUrl: string;
  identityImageUrl?: string;
  audioUrl: string;
  prompt?: string;
  duration?: 5 | 10 | 15;
  clipStartSeconds?: number;
  lyricsExcerpt?: string;
  mood?: string;
  energyLevel?: number;
  bpmFeel?: string;
  segmentType?: string;
  songTitle?: string;
}): Promise<SeedanceReferenceVideoResult> {
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    const duration = Math.min(15, Math.max(4, params.duration || 5)) as 5 | 10 | 15;
    const clipStartSeconds = Math.max(0, params.clipStartSeconds || 0);

    logger.log(`[Seedance 2.0] Preparing 5s rhythmic singer clip | start=${clipStartSeconds}s`);
    const falAudioUrl = await trimAndUploadAudioToFal(params.audioUrl, duration, clipStartSeconds);
    const falSceneImageUrl = await uploadUrlToFalStorage(params.imageUrl, 'seedance-scene-reference.jpg');
    const falIdentityImageUrl = params.identityImageUrl
      ? await uploadUrlToFalStorage(params.identityImageUrl, 'seedance-artist-profile-identity.jpg')
      : falSceneImageUrl;
    const imageUrls = falIdentityImageUrl === falSceneImageUrl
      ? [falSceneImageUrl]
      : [falIdentityImageUrl, falSceneImageUrl];
    const prompt = buildSeedanceSingerPrompt({ ...params, hasIdentityReference: imageUrls.length > 1 });

    const submitRes = await axios.post(
      `${FAL_QUEUE_URL}/${FAL_MODELS.SEEDANCE_2_FAST_R2V}`,
      {
        prompt,
        image_urls: imageUrls,
        audio_urls: [falAudioUrl],
        resolution: '720p',
        duration: String(duration),
        aspect_ratio: '9:16',
        // Keep Seedance's internal audio engine on so visual mouth/body timing follows @Audio1.
        // The returned audio is still discarded later and replaced with the exact original clip.
        generate_audio: true,
      },
      {
        headers: {
          Authorization: `Key ${FAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const requestId: string = submitRes.data?.request_id;
    if (!requestId) throw new Error(`No request_id returned from Seedance queue — response: ${JSON.stringify(submitRes.data)}`);
    const statusUrl: string = submitRes.data?.status_url || '';
    const resultUrl: string = submitRes.data?.response_url || '';
    logger.log(`[Seedance 2.0] ✅ Queued rhythmic singer request ${requestId}`);
    return { success: true, requestId, statusUrl, resultUrl, referenceAudioUrl: falAudioUrl };
  } catch (err: any) {
    const falDetail = err?.response?.data?.detail || '';
    const httpStatus = err?.response?.status;
    logger.error(`[Seedance 2.0] Submit error (HTTP ${httpStatus}):`, falDetail || err.message);
    if (httpStatus === 403 && falDetail?.toLowerCase().includes('balance')) {
      return { success: false, error: '💳 Saldo FAL agotado — recarga en fal.ai/dashboard/billing para continuar generando videos.' };
    }
    if (httpStatus === 422) {
      return { success: false, error: `FAL parámetros inválidos (422): ${JSON.stringify(falDetail)}` };
    }
    return { success: false, error: falDetail || err.message };
  }
}

export async function replaceVideoAudioWithOriginalSong(params: {
  videoUrl: string;
  audioUrl: string;
  clipStartSeconds?: number;
  duration?: number;
}): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const os = nodeRequire('os') as typeof import('os');
  const path = nodeRequire('path') as typeof import('path');
  const fs = nodeRequire('fs') as typeof import('fs');
  const ffmpeg = nodeRequire('fluent-ffmpeg');
  const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path;
  ffmpeg.setFfmpegPath(ffmpegPath);

  const safeStartSeconds = Math.max(0, Number.isFinite(params.clipStartSeconds || 0) ? Number(params.clipStartSeconds || 0) : 0);
  const safeDuration = Math.max(4, Math.min(15, Number(params.duration || 5)));
  const tmpDir = os.tmpdir();
  const stamp = `${Date.now()}_${Math.round(Math.random() * 100000)}`;
  const inputVideoPath = path.join(tmpDir, `seedance_video_${stamp}.mp4`);
  const inputAudioPath = path.join(tmpDir, `seedance_audio_${stamp}.mp3`);
  const outputPath = path.join(tmpDir, `seedance_locked_${stamp}.mp4`);

  try {
    logger.log(`[Seedance 2.0] Locking final audio to original song | start=${safeStartSeconds}s duration=${safeDuration}s`);
    const [videoRes, audioRes] = await Promise.all([
      axios.get(params.videoUrl, { responseType: 'arraybuffer', timeout: 60000 }),
      axios.get(params.audioUrl, { responseType: 'arraybuffer', timeout: 60000 }),
    ]);
    fs.writeFileSync(inputVideoPath, Buffer.from(videoRes.data));
    fs.writeFileSync(inputAudioPath, Buffer.from(audioRes.data));

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inputVideoPath)
        .input(inputAudioPath)
        .complexFilter([
          `[1:a]atrim=start=${safeStartSeconds}:duration=${safeDuration},asetpts=PTS-STARTPTS[a]`,
        ])
        .outputOptions([
          '-map 0:v:0',
          '-map [a]',
          '-c:v copy',
          '-c:a aac',
          '-b:a 192k',
          '-movflags +faststart',
          '-shortest',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => reject(err))
        .run();
    });

    const finalBuffer = fs.readFileSync(outputPath);
    const finalUrl = await uploadBufferToFalStorage(finalBuffer, 'seedance_original_song_locked.mp4', 'video/mp4');
    logger.log(`[Seedance 2.0] ✅ Final video audio locked to original song → ${finalUrl.substring(0, 70)}`);
    return { success: true, videoUrl: finalUrl };
  } catch (err: any) {
    logger.error('[Seedance 2.0] Audio replacement failed:', err?.message || err);
    return { success: false, error: err?.message || 'Failed to replace Seedance audio with original song' };
  } finally {
    try {
      [inputVideoPath, inputAudioPath, outputPath].forEach((filePath) => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
    } catch (_) {}
  }
}

export async function stitchPromoSceneVideosWithOriginalAudio(params: {
  scenes: Array<{ id?: string; videoUrl: string; startTime?: number; duration?: number; sourceOffset?: number }>;
  audioUrl: string;
  clipStartSeconds?: number;
  totalDuration?: number;
}): Promise<{ success: boolean; videoUrl?: string; error?: string }> {
  const os = nodeRequire('os') as typeof import('os');
  const path = nodeRequire('path') as typeof import('path');
  const fs = nodeRequire('fs') as typeof import('fs');
  const { execFile } = nodeRequire('child_process') as typeof import('child_process');
  const { promisify } = nodeRequire('util') as typeof import('util');
  const ffmpegPath = nodeRequire('@ffmpeg-installer/ffmpeg').path as string;
  const execFileAsync = promisify(execFile);

  const safeScenes = (params.scenes || [])
    .filter(scene => scene?.videoUrl)
    .sort((a, b) => Number(a.startTime || 0) - Number(b.startTime || 0));
  const safeTotalDuration = Math.max(5, Math.min(180, Number(params.totalDuration || 30)));
  const safeAudioStart = Math.max(0, Number.isFinite(params.clipStartSeconds || 0) ? Number(params.clipStartSeconds || 0) : 0);

  if (safeScenes.length === 0) {
    return { success: false, error: 'No scene videos provided for narrative render' };
  }

  const tmpDir = path.join(os.tmpdir(), `boostify_narrative_${Date.now()}_${Math.round(Math.random() * 100000)}`);
  const inputPaths: string[] = [];
  const normalizedPaths: string[] = [];
  const audioPath = path.join(tmpDir, 'master_audio.mp3');
  const concatListPath = path.join(tmpDir, 'concat.txt');
  const outputPath = path.join(tmpDir, 'narrative_30s_final.mp4');

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    logger.log(`[NarrativePromo] Stitching ${safeScenes.length} scenes with original song audio | start=${safeAudioStart}s duration=${safeTotalDuration}s`);

    await Promise.all(safeScenes.map(async (scene, index) => {
      const inputPath = path.join(tmpDir, `scene_${index}.mp4`);
      const response = await axios.get(scene.videoUrl, { responseType: 'arraybuffer', timeout: 120000 });
      fs.writeFileSync(inputPath, Buffer.from(response.data));
      inputPaths[index] = inputPath;
    }));

    const audioRes = await axios.get(params.audioUrl, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(audioPath, Buffer.from(audioRes.data));

    for (let index = 0; index < safeScenes.length; index++) {
      const scene = safeScenes[index];
      const sceneDuration = Math.max(1, Math.min(15, Number(scene.duration || 5)));
      const sourceOffset = Math.max(0, Math.min(14, Number(scene.sourceOffset || 0)));
      const normalizedPath = path.join(tmpDir, `scene_${index}_normalized.mp4`);
      await execFileAsync(ffmpegPath, [
        '-y',
        ...(sourceOffset > 0 ? ['-ss', String(sourceOffset)] : []),
        '-i', inputPaths[index],
        '-t', String(sceneDuration),
        '-vf', 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,format=yuv420p',
        '-an',
        '-c:v', 'libx264',
        '-preset', 'veryfast',
        '-crf', '20',
        '-movflags', '+faststart',
        normalizedPath,
      ], { timeout: 180000 });
      normalizedPaths.push(normalizedPath);
    }

    const concatList = normalizedPaths
      .map(filePath => `file '${filePath.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
      .join('\n');
    fs.writeFileSync(concatListPath, concatList);

    await execFileAsync(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-i', audioPath,
      '-filter_complex', `[1:a]atrim=start=${safeAudioStart}:duration=${safeTotalDuration},asetpts=PTS-STARTPTS[a]`,
      '-map', '0:v:0',
      '-map', '[a]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-shortest',
      outputPath,
    ], { timeout: 240000 });

    const finalBuffer = fs.readFileSync(outputPath);
    const finalUrl = await uploadBufferToFalStorage(finalBuffer, 'boostify_narrative_30s.mp4', 'video/mp4');
    logger.log(`[NarrativePromo] ✅ Final 30s narrative video rendered → ${finalUrl.substring(0, 70)}`);
    return { success: true, videoUrl: finalUrl };
  } catch (err: any) {
    logger.error('[NarrativePromo] Stitch/render failed:', err?.stderr || err?.message || err);
    return { success: false, error: err?.stderr || err?.message || 'Failed to stitch narrative video' };
  } finally {
    try {
      [...inputPaths, ...normalizedPaths, audioPath, concatListPath, outputPath].forEach(filePath => {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      });
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

/**
 * Poll FAL queue for any model result (single-poll, non-blocking).
 * Works for OmniHuman, SyncLipsync v3, Kling v3 Pro, and any queued FAL request.
 */
export async function pollFalJobStatus(params: {
  modelPath: string;
  requestId: string;
  maxWaitMs?: number;
  intervalMs?: number;
}): Promise<{ success: boolean; result?: any; error?: string }> {
  if (!FAL_API_KEY) return { success: false, error: 'FAL_API_KEY not configured' };
  const { modelPath, requestId, maxWaitMs = 300000, intervalMs = 5000 } = params;
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const statusRes = await axios.get(
        `https://queue.fal.run/${modelPath}/requests/${requestId}/status`,
        { headers: { Authorization: `Key ${FAL_API_KEY}` }, timeout: 15000 }
      );
      const status = statusRes.data?.status;
      if (status === 'COMPLETED') {
        const resultRes = await axios.get(
          `https://queue.fal.run/${modelPath}/requests/${requestId}`,
          { headers: { Authorization: `Key ${FAL_API_KEY}` }, timeout: 15000 }
        );
        return { success: true, result: resultRes.data };
      }
      if (status === 'FAILED') {
        return { success: false, error: statusRes.data?.error || 'FAL job failed' };
      }
    } catch (e: any) {
      logger.error('[pollFalJobStatus] Poll error:', e?.message);
    }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { success: false, error: 'FAL queue polling timed out' };
}

// ─────────────────────────────────────────────────────────────────────────────
// ARTIST CHARACTER PACK — 4 Studio Reference Images from Profile Photo
// ─────────────────────────────────────────────────────────────────────────────
// Generates 4 professional studio reference images of the artist from different
// angles using Flux Kontext (image-to-image). These images are saved to the
// gallery and database to feed downstream AI modules (merch, video, EPK, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export interface CharacterPackImage {
  id: string;
  url: string;
  angle: string;
  prompt: string;
  createdAt: string;
}

export interface CharacterPackResult {
  success: boolean;
  images: CharacterPackImage[];
  error?: string;
}

const CHARACTER_PACK_ANGLES = [
  {
    angle: 'front',
    label: 'Front — Face Direct',
    prompt: (name: string, genre: string) =>
      `The same person from the reference photo as a professional studio portrait. Full frontal face, looking directly at camera, neutral and confident expression, slight hint of personality. ` +
      `Studio setup: clean medium gray seamless backdrop (#808080), soft box main light from front-left, fill light right, rim light behind. ` +
      `Subject framed from upper chest to top of head. Shoulders relaxed, natural posture. ` +
      `Wardrobe: minimal solid-tone clothing in dark neutral, no patterns or branding. ` +
      `Shot with 85mm portrait lens, shallow depth of field, CRISP eye focus, photorealistic, editorial quality. ` +
      `Artist name: ${name}. Genre context: ${genre}. ` +
      `Do NOT alter the person's face, skin tone, hair, or distinguishing features from the reference.`,
  },
  {
    angle: 'three-quarter-left',
    label: '3/4 Left — Signature Angle',
    prompt: (name: string, genre: string) =>
      `The same person from the reference photo in a professional studio three-quarter portrait. Face turned approximately 45 degrees to their left, chin slightly down, strong jawline definition. ` +
      `Studio setup: clean medium gray seamless backdrop (#808080), Rembrandt lighting with key light from left, soft fill right, subtle rim light. ` +
      `Upper body framed from mid-chest upward. Confident, composed posture. ` +
      `Wardrobe: minimal solid-tone dark clothing. ` +
      `Shot with 85mm lens, shallow DOF, sharp eye closest to camera, photorealistic, editorial. ` +
      `Artist: ${name}. Genre: ${genre}. ` +
      `Preserve exact facial features, skin tone, hair, and physical characteristics from the reference.`,
  },
  {
    angle: 'side-profile',
    label: 'Side Profile — Clean Left',
    prompt: (name: string, genre: string) =>
      `The same person from the reference photo in a precise side profile portrait, facing left. Perfect 90-degree profile, clean jawline to forehead silhouette visible. ` +
      `Studio setup: pure medium gray seamless backdrop (#808080), bright side-light from the front creating a clean edge, slight hair light from behind. ` +
      `Framed from shoulder to above head. Neutral, composed expression. ` +
      `Wardrobe: simple dark solid clothing, no patterns. ` +
      `Shot with 85mm lens, tack-sharp profile, photorealistic, character reference sheet quality. ` +
      `Artist: ${name}. Genre: ${genre}. ` +
      `Maintain exact physical likeness, hair, facial features from the reference photo.`,
  },
  {
    angle: 'three-quarter-right',
    label: '3/4 Right — Power Pose',
    prompt: (name: string, genre: string) =>
      `The same person from the reference photo in a professional studio three-quarter portrait. Face turned 45 degrees to their right, slight chin tilt up, powerful and self-assured expression. ` +
      `Studio setup: clean medium gray seamless backdrop (#808080), loop lighting with key light right, subtle fill left, hair rim light. ` +
      `Upper body from mid-chest up. Strong, commanding posture with a sense of presence. ` +
      `Wardrobe: minimal solid-tone dark clothing, no logos. ` +
      `Shot with 85mm portrait lens, crisp focus, photorealistic, press-kit editorial quality. ` +
      `Artist: ${name}. Genre: ${genre}. ` +
      `Do NOT change any facial features, hair color, skin tone, or physical characteristics from the reference.`,
  },
] as const;

/**
 * Generates a 4-image character reference pack from the artist's profile photo.
 * Uses Flux Kontext (image-to-image) to preserve the person's likeness while
 * creating professional studio shots from different angles.
 *
 * @param profileImageUrl - Public URL of the artist's profile photo
 * @param artistName - Artist's display name
 * @param genre - Artist's music genre (used to tune visual energy in prompt)
 * @param outputFolder - Firebase Storage folder for permanent URLs
 */
export async function generateArtistCharacterPack(
  profileImageUrl: string,
  artistName: string,
  genre: string = 'music',
  outputFolder: string = 'artist-character-packs',
): Promise<CharacterPackResult> {
  if (!FAL_API_KEY) {
    return { success: false, images: [], error: 'FAL_API_KEY not configured' };
  }

  if (!profileImageUrl) {
    return { success: false, images: [], error: 'Profile image URL is required' };
  }

  logger.log(`[FAL] 🎭 Generating Character Pack for "${artistName}" (${genre})…`);
  logger.log(`[FAL] Reference image: ${profileImageUrl.substring(0, 80)}…`);

  const results: CharacterPackImage[] = [];
  const errors: string[] = [];

  // Generate all 4 angles in parallel with a small stagger to avoid rate limits
  const generationTasks = CHARACTER_PACK_ANGLES.map(async (shot, index) => {
    // Stagger start times: 0ms, 400ms, 800ms, 1200ms
    await new Promise(r => setTimeout(r, index * 400));

    const prompt = shot.prompt(artistName, genre);
    logger.log(`[FAL] 📸 Generating angle ${index + 1}/4: ${shot.label}`);

    try {
      const response = await axios.post(
        `${FAL_BASE_URL}/${FAL_MODELS.FLUX_KONTEXT}`,
        {
          prompt,
          image_url: profileImageUrl,
          image_size: 'square_hd',   // 1024×1024 — ideal for character references
          output_format: 'jpeg',
          guidance_scale: 3.5,
          num_inference_steps: 28,
          safety_tolerance: '6',
        },
        {
          headers: {
            Authorization: `Key ${FAL_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 120000,
        },
      );

      const tempUrl: string | undefined = response.data?.images?.[0]?.url;
      if (!tempUrl) {
        errors.push(`Angle ${shot.angle}: No image returned`);
        return null;
      }

      // Upload to permanent Firebase Storage
      const downloaded = await downloadImageAsBase64(tempUrl);
      let finalUrl = tempUrl;

      if (downloaded) {
        const timestamp = Date.now();
        const slug = artistName.toLowerCase().replace(/[^a-z0-9]/g, '-').substring(0, 30);
        const folder = `${outputFolder}/${slug}`;
        finalUrl = await uploadBase64ToStorage(downloaded.base64, downloaded.mimeType, folder);
      }

      logger.log(`[FAL] ✅ Angle ${index + 1} done: ${shot.label}`);
      return {
        id: `char-${Date.now()}-${index}`,
        url: finalUrl,
        angle: shot.angle,
        prompt,
        createdAt: new Date().toISOString(),
      } as CharacterPackImage;
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.message || 'Unknown error';
      logger.warn(`[FAL] ⚠️ Angle ${shot.angle} failed: ${msg}`);
      errors.push(`Angle ${shot.angle}: ${msg}`);
      return null;
    }
  });

  const settled = await Promise.all(generationTasks);
  settled.forEach(img => { if (img) results.push(img); });

  if (results.length === 0) {
    return {
      success: false,
      images: [],
      error: `All angles failed. Errors: ${errors.join('; ')}`,
    };
  }

  logger.log(`[FAL] 🎉 Character Pack complete: ${results.length}/4 images generated`);
  return { success: true, images: results };
}
