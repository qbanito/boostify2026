/**
 * Parallel Image Generator
 * Genera imágenes de 4 en 4 en paralelo usando Gemini Flash 2.5
 * Mucho más rápido que generación secuencial
 */

import { logger } from "../logger";

export interface ParallelImageBatch {
  sceneIndex: number;
  description: string;
  prompt: string;
}

export interface ImageResult {
  sceneIndex: number;
  success: boolean;
  imageUrl?: string;
  error?: string;
  generatedAt: number;
}

/**
 * Genera imágenes de 4 en 4 en paralelo
 * @param batches Lotes de 4 escenas a generar
 * @param onProgress Callback de progreso
 * @returns Array de resultados
 */
export async function generateImagesInParallel(
  batches: ParallelImageBatch[],
  model: 'gemini-2.5-flash' | 'gemini-pro-3.0' = 'gemini-2.5-flash',
  onProgress?: (completed: number, total: number, currentBatch: ImageResult[]) => void
): Promise<ImageResult[]> {
  logger.info(`🚀 [PARALLEL] Iniciando generación de ${batches.length} imágenes en paralelo (modelo: ${model})`);
  
  const results: ImageResult[] = [];
  const BATCH_SIZE = 4; // Generar 4 imágenes simultáneamente

  // Dividir en lotes de 4
  for (let i = 0; i < batches.length; i += BATCH_SIZE) {
    const batchSlice = batches.slice(i, i + BATCH_SIZE);
    
    logger.info(`⚙️ [PARALLEL] Procesando lote ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(batches.length / BATCH_SIZE)} (${batchSlice.length} imágenes)`);
    
    // Ejecutar todas las imágenes del lote en paralelo
    const batchResults = await Promise.all(
      batchSlice.map(batch =>
        generateSingleImageWithRetry(batch, model).catch(error => ({
          sceneIndex: batch.sceneIndex,
          success: false,
          error: error.message,
          generatedAt: Date.now()
        }))
      )
    );

    results.push(...batchResults);
    
    // Notificar progreso
    onProgress?.(results.length, batches.length, batchResults);
    
    logger.info(`✅ [PARALLEL] Lote completado: ${results.length}/${batches.length} imágenes`);
  }

  return results;
}

/**
 * Genera una imagen individual con reintentos automáticos
 */
async function generateSingleImageWithRetry(
  batch: ParallelImageBatch,
  model: 'gemini-2.5-flash' | 'gemini-pro-3.0',
  retries: number = 2
): Promise<ImageResult> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logger.info(`🎨 [IMG ${batch.sceneIndex}] Intento ${attempt + 1}/${retries + 1} (modelo: ${model})`);

      const response = await fetch('/api/gemini-image/generate-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: [{
            scene: batch.description,
            style: 'cinematic',
            index: batch.sceneIndex
          }],
          model: model,
          narrativeSummary: 'Music video scene',
          directorStyle: 'Professional'
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.success && data.images && data.images[0]?.url) {
        logger.info(`✅ [IMG ${batch.sceneIndex}] Generada exitosamente`);
        return {
          sceneIndex: batch.sceneIndex,
          success: true,
          imageUrl: data.images[0].url,
          generatedAt: Date.now()
        };
      }

      throw new Error(data.error || 'No image URL returned');
    } catch (error: any) {
      if (attempt === retries) {
        logger.error(`❌ [IMG ${batch.sceneIndex}] Error final:`, error.message);
        return {
          sceneIndex: batch.sceneIndex,
          success: false,
          error: error.message,
          generatedAt: Date.now()
        };
      }
      logger.warn(`⚠️ [IMG ${batch.sceneIndex}] Reintentando (${attempt + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }

  return {
    sceneIndex: batch.sceneIndex,
    success: false,
    error: 'Max retries exceeded',
    generatedAt: Date.now()
  };
}

/**
 * Convierte imágenes secuenciales a lotes paralelos
 */
export function createParallelBatches(
  scenes: Array<{ description: string; [key: string]: any }>,
  startIndex: number = 0
): ParallelImageBatch[] {
  return scenes.map((scene, idx) => ({
    sceneIndex: startIndex + idx + 1,
    description: scene.description || '',
    prompt: scene.prompt || buildDefaultPrompt(scene)
  }));
}

function buildDefaultPrompt(scene: any): string {
  return `Music video scene: ${scene.description || 'Cinematic scene'}. 
Style: ${scene.style || 'cinematic'}, 
Mood: ${scene.mood || 'dramatic'},
Camera: ${scene.camera || 'dynamic'}`;
}
