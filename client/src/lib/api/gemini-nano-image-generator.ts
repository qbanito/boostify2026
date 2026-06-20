/**
 * Gemini 2.5 Flash Image (Nano Banana Pro)
 * Generador de imágenes ultrarrápido para escenas de videos musicales
 * Usa Replit AI Integrations para acceso sin API key
 */

import { logger } from "../logger";

export interface ImageGenerationParams {
  prompt: string;
  shotType?: string;
  cinematicStyle?: string;
  mood?: string;
  duration?: number;
  sceneNumber?: number;
  referenceImages?: string[]; // Referencias faciales base64 para consistencia
  directorStyle?: string;
}

export interface GeneratedImage {
  success: boolean;
  imageUrl?: string;
  imageBase64?: string;
  prompt?: string;
  error?: string;
  generatedAt?: number;
}

/**
 * Genera una imagen para una escena del video musical usando Gemini 2.5 Flash Image
 * Optimizado para velocidad y coherencia visual
 */
export async function generateSceneImageWithGemini(
  params: ImageGenerationParams
): Promise<GeneratedImage> {
  try {
    logger.info(`🎨 [Gemini Image] Generando imagen para escena ${params.sceneNumber}...`);

    // Enriquecer el prompt con contexto cinematográfico
    const enrichedPrompt = buildCinematicPrompt(params);

    const response = await fetch('/api/gemini/generate-image', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: enrichedPrompt,
        sceneNumber: params.sceneNumber,
        shotType: params.shotType,
        mood: params.mood,
        cinematicStyle: params.cinematicStyle,
        directorStyle: params.directorStyle,
        referenceImages: params.referenceImages || [], // Pasar referencias para consistencia facial
        model: 'gemini-2.5-flash', // ⚡ Flash 2.5 - Ultra rápido y eficiente
        imageSize: 'landscape_4_3', // 1024x768 - Óptimo para música
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error || `Error ${response.status} generando imagen`
      );
    }

    const data = await response.json();

    if (data.success && data.imageUrl) {
      logger.info(`✅ [Gemini Image] Imagen generada exitosamente (escena ${data.sceneNumber})`);
      return {
        success: true,
        imageUrl: data.imageUrl,
        prompt: enrichedPrompt,
        generatedAt: Date.now(),
      };
    }

    throw new Error(data.error || 'Respuesta vacía del servidor');
  } catch (error: any) {
    logger.error(`❌ [Gemini Image] Error:`, error.message);
    return {
      success: false,
      error: error.message || 'Error desconocido generando imagen',
    };
  }
}

/**
 * Genera múltiples imágenes en paralelo para escenas
 * Optimizado para velocidad con Gemini Flash
 */
export async function generateBatchSceneImages(
  scenesParams: ImageGenerationParams[]
): Promise<GeneratedImage[]> {
  try {
    logger.info(`🎨 [Gemini Batch] Generando ${scenesParams.length} imágenes en paralelo...`);

    const promises = scenesParams.map((params) =>
      generateSceneImageWithGemini(params)
        .then((result) => ({
          ...result,
          sceneNumber: params.sceneNumber,
        }))
        .catch((error) => ({
          success: false,
          error: error.message,
          sceneNumber: params.sceneNumber,
        }))
    );

    const results = await Promise.all(promises);
    const successCount = results.filter((r) => r.success).length;

    logger.info(
      `✅ [Gemini Batch] Generadas ${successCount}/${results.length} imágenes`
    );

    return results as GeneratedImage[];
  } catch (error: any) {
    logger.error(`❌ [Gemini Batch] Error:`, error.message);
    throw error;
  }
}

/**
 * Construye un prompt cinematográfico enriquecido para Gemini
 * Optimizado para coherencia visual en videos musicales
 */
function buildCinematicPrompt(params: ImageGenerationParams): string {
  const parts: string[] = [];

  // Base del prompt
  parts.push(params.prompt);

  // Agregar contexto cinematográfico si está disponible
  if (params.shotType) {
    const shotMap: Record<string, string> = {
      ECU: 'extreme close-up',
      CU: 'close-up facial shot',
      MCU: 'medium close-up',
      MS: 'medium shot full body',
      LS: 'long shot',
      WS: 'wide establishing shot',
      EWS: 'extreme wide shot landscape',
      OTS: 'over-the-shoulder perspective',
      POV: 'first-person POV',
      HIGH: 'high angle shot looking down',
      LOW: 'low angle shot looking up',
      DUTCH: 'tilted Dutch angle composition',
    };
    parts.push(`Shot: ${shotMap[params.shotType] || params.shotType}`);
  }

  // Agregar estilo cinematográfico
  if (params.cinematicStyle) {
    parts.push(`Visual style: ${params.cinematicStyle}`);
  }

  // Agregar mood/emoción
  if (params.mood) {
    const moodDescriptors: Record<string, string> = {
      happy: 'joyful, bright, vibrant, energetic lighting',
      sad: 'melancholic, soft shadows, cool tones, introspective',
      angry: 'intense, dramatic shadows, high contrast, red tones',
      peaceful: 'serene, soft lighting, natural colors, calm',
      dark: 'moody, shadows, noir lighting, mysterious',
      epic: 'grand, cinematic, dramatic composition, majestic',
    };
    parts.push(`Mood: ${moodDescriptors[params.mood] || params.mood}`);
  }

  // Agregar especificaciones técnicas
  parts.push('Film stock: Kodak Alexa Cinema, professional color grading');
  parts.push('Composition: 16:9 widescreen cinematic format');
  parts.push('Quality: 4K broadcast ready, sharp focus, professional lighting');

  // Unir todo el prompt
  const finalPrompt = parts.join('. ');

  logger.debug(`📝 [Prompt] ${finalPrompt.substring(0, 100)}...`);

  return finalPrompt;
}

/**
 * Verifica si una imagen fue generada correctamente y descarga si es necesario
 */
export async function validateGeneratedImage(
  imageUrl: string
): Promise<boolean> {
  try {
    const response = await fetch(imageUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Convierte imagen URL a base64 para almacenamiento
 */
export async function imageUrlToBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();

    return new Promise((resolve, reject) => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    logger.error('Error convirtiendo imagen a base64:', error);
    throw error;
  }
}
