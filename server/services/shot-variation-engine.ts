/**
 * 🎥 Shot Variation Engine - Generador de variaciones de plano
 * 
 * Usa fal-ai/nano-banana/edit para generar múltiples planos desde una imagen base:
 * - Wide Shot (plano general)
 * - Medium Shot (plano medio)
 * - Close-Up (primer plano)
 * - Detail Shot (detalle)
 * - Dutch Angle (ángulo holandés)
 * - POV (punto de vista)
 * - etc.
 * 
 * Cada escena base puede generar 2-6 variaciones para crear dinamismo visual
 * sincronizado con los beats de la música.
 * 
 * 🎬 INTEGRACIÓN Director+DP: Los edit_prompts ahora pueden venir de los
 * perfiles cinematográficos de Director+DP para coherencia visual.
 */

import { logger } from '../utils/logger';
import { generateImageWithEdit } from './fal-service';
import { 
  ShotVariation, 
  GenreEditingProfile, 
  getEditingProfile 
} from './genre-editing-profiles';
import {
  getProfileOrDefault,
  getVariationEditPrompts,
  type DirectorDPProfile,
} from './cinematography-service';

// ========== INTERFACES ==========

export interface GeneratedVariation {
  type: ShotVariation['type'];
  imageUrl: string;
  duration: number;        // En beats
  durationMs: number;      // En milisegundos
  editPrompt: string;
  beatStart: number;
  beatEnd: number;
  success: boolean;
  error?: string;
}

export interface SceneWithVariations {
  originalSceneId: string;
  baseImageUrl: string;
  section: string;
  energy: string;
  variations: GeneratedVariation[];
  totalDurationBeats: number;
  totalDurationMs: number;
}

export interface VariationGenerationOptions {
  maxVariations?: number;     // Máximo de variaciones a generar (default: 4)
  minVariations?: number;     // Mínimo de variaciones (default: 1)
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:3' | '3:4';
  includeOriginal?: boolean;  // Incluir imagen original como primera variación
  parallelGeneration?: boolean; // Generar en paralelo (default: true)
}

// ========== UTILIDADES ==========

/**
 * Genera número aleatorio entre min y max (inclusive)
 */
function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Selecciona items de un array basado en pesos de probabilidad
 */
function selectByWeight<T extends { weight: number }>(
  pool: T[], 
  count: number
): T[] {
  if (pool.length === 0) return [];
  if (count >= pool.length) return [...pool];
  
  const selected: T[] = [];
  const totalWeight = pool.reduce((sum, item) => sum + item.weight, 0);
  
  // Evitar repeticiones seguidas del mismo tipo
  const usedTypes = new Set<string>();
  
  for (let i = 0; i < count; i++) {
    let random = Math.random() * totalWeight;
    
    for (const item of pool) {
      random -= item.weight;
      if (random <= 0) {
        selected.push(item);
        break;
      }
    }
    
    // Si no seleccionó nada, tomar el primero
    if (selected.length <= i) {
      selected.push(pool[i % pool.length]);
    }
  }
  
  return selected;
}

/**
 * Selecciona pool de variaciones según contexto
 */
function selectVariationPool(
  section: string,
  energy: string,
  profile: GenreEditingProfile
): ShotVariation[] {
  const { shotVariations } = profile;
  
  // En momentos de alta energía/climax
  if (energy === 'peak' || section === 'drop' || section === 'climax' || section === 'breakdown') {
    return [
      ...shotVariations.climax,
      ...shotVariations.performance.slice(0, 2)
    ];
  }
  
  // En secciones de performance (verso, coro)
  if (['verse', 'chorus', 'pre-chorus', 'hook'].includes(section.toLowerCase())) {
    // Mezcla 60% performance, 40% B-roll
    const performanceCount = Math.ceil(shotVariations.performance.length * 0.6);
    const bRollCount = Math.ceil(shotVariations.bRoll.length * 0.4);
    return [
      ...shotVariations.performance.slice(0, performanceCount),
      ...shotVariations.bRoll.slice(0, bRollCount)
    ];
  }
  
  // En intro/outro/bridge, más B-roll cinematográfico
  if (['intro', 'outro', 'bridge', 'instrumental'].includes(section.toLowerCase())) {
    return [
      ...shotVariations.bRoll,
      ...shotVariations.performance.slice(0, 1)
    ];
  }
  
  // Default: mezcla balanceada
  return [
    ...shotVariations.performance.slice(0, 2),
    ...shotVariations.bRoll.slice(0, 2)
  ];
}

/**
 * Construye prompt enriquecido para edición de imagen
 */
function buildEditPrompt(
  basePrompt: string, 
  section: string, 
  energy: string,
  additionalContext?: string
): string {
  const energyModifiers: Record<string, string> = {
    'low': 'soft diffused lighting, calm serene atmosphere, subtle gentle movement',
    'medium': 'balanced professional lighting, moderate controlled energy',
    'high': 'dramatic high contrast lighting, dynamic composition, strong shadows',
    'peak': 'explosive maximum intensity lighting, cinematic impact, lens flares'
  };
  
  const sectionModifiers: Record<string, string> = {
    'intro': 'establishing shot feel, mysterious anticipation, reveal moment',
    'verse': 'narrative storytelling focus, character development, progression',
    'pre-chorus': 'building tension, rising energy, anticipation of chorus',
    'chorus': 'catchy memorable visual, hook moment, maximum appeal',
    'bridge': 'contemplative pause, emotional reflection, transitional',
    'drop': 'bass drop impact moment, explosive energy release, chaos',
    'outro': 'resolution closure, fading elegance, final statement',
    'breakdown': 'stripped back moment, intimate, building again',
    'climax': 'peak emotional moment, maximum visual impact'
  };
  
  let prompt = basePrompt;
  
  // Añadir modificador de energía
  const energyMod = energyModifiers[energy.toLowerCase()] || energyModifiers['medium'];
  prompt += `. ${energyMod}`;
  
  // Añadir modificador de sección
  const sectionMod = sectionModifiers[section.toLowerCase()] || '';
  if (sectionMod) {
    prompt += `. ${sectionMod}`;
  }
  
  // Contexto adicional si existe
  if (additionalContext) {
    prompt += `. ${additionalContext}`;
  }
  
  // Calidad final
  prompt += '. Professional music video quality, 4K cinematic, sharp focus.';
  
  return prompt;
}

// ========== FUNCIÓN PRINCIPAL ==========

/**
 * Genera múltiples variaciones de plano desde una imagen base
 * usando fal-ai/nano-banana/edit
 * 
 * @param baseImageUrl URL de la imagen base de la escena
 * @param section Tipo de sección musical (verse, chorus, etc.)
 * @param energy Nivel de energía (low, medium, high, peak)
 * @param profile Perfil de edición del género
 * @param durationInBeats Duración total de la escena en beats
 * @param beatDurationMs Duración de un beat en milisegundos
 * @param options Opciones adicionales
 */
export async function generateShotVariations(
  baseImageUrl: string,
  section: string,
  energy: string,
  profile: GenreEditingProfile,
  durationInBeats: number,
  beatDurationMs: number,
  options: VariationGenerationOptions = {}
): Promise<GeneratedVariation[]> {
  
  const {
    maxVariations = 4,
    minVariations = 1,
    aspectRatio = '16:9',
    includeOriginal = true,
    parallelGeneration = true
  } = options;

  logger.log(`[ShotVariation] 🎬 Generando variaciones para sección "${section}" (energía: ${energy})`);
  logger.log(`[ShotVariation]    Duración: ${durationInBeats} beats (${Math.round(durationInBeats * beatDurationMs)}ms)`);

  // 1. Seleccionar pool de variaciones según contexto
  const variationPool = selectVariationPool(section, energy, profile);
  
  if (variationPool.length === 0) {
    logger.warn('[ShotVariation] ⚠️ Pool de variaciones vacío, usando fallback');
    return [{
      type: 'medium',
      imageUrl: baseImageUrl,
      duration: durationInBeats,
      durationMs: durationInBeats * beatDurationMs,
      editPrompt: 'original',
      beatStart: 0,
      beatEnd: durationInBeats,
      success: true
    }];
  }

  // 2. Calcular cuántas variaciones necesitamos
  const avgDuration = variationPool.reduce(
    (sum, v) => sum + (v.minDuration + v.maxDuration) / 2, 0
  ) / variationPool.length;
  
  let targetVariations = Math.ceil(durationInBeats / avgDuration);
  targetVariations = Math.max(minVariations, Math.min(maxVariations, targetVariations));
  
  logger.log(`[ShotVariation]    Target variaciones: ${targetVariations}`);

  // 3. Seleccionar variaciones por peso/probabilidad
  const selectedVariations = selectByWeight(variationPool, targetVariations);

  // 4. Generar imágenes
  const variations: GeneratedVariation[] = [];
  
  // Si incluir original como primera variación
  if (includeOriginal && selectedVariations.length > 0) {
    const firstVariation = selectedVariations[0];
    const duration = Math.min(
      randomBetween(firstVariation.minDuration, firstVariation.maxDuration),
      durationInBeats / targetVariations
    );
    
    variations.push({
      type: firstVariation.type,
      imageUrl: baseImageUrl,
      duration: duration,
      durationMs: duration * beatDurationMs,
      editPrompt: 'original base image',
      beatStart: 0,
      beatEnd: duration,
      success: true
    });
    
    // Remover la primera del array a procesar
    selectedVariations.shift();
  }

  // 5. Generar las variaciones restantes con fal-ai/nano-banana/edit
  const generateVariation = async (
    variation: ShotVariation, 
    index: number
  ): Promise<GeneratedVariation> => {
    // Calcular duración de esta variación
    const remainingBeats = durationInBeats - variations.reduce((sum, v) => sum + v.duration, 0);
    const remainingVariations = selectedVariations.length - index;
    const maxDurationForThis = remainingBeats / Math.max(1, remainingVariations);
    
    const duration = Math.min(
      randomBetween(variation.minDuration, variation.maxDuration),
      maxDurationForThis
    );
    
    // Construir prompt enriquecido
    const editPrompt = buildEditPrompt(variation.editPrompt, section, energy);
    
    try {
      logger.log(`[ShotVariation]    Generando ${variation.type}...`);
      
      const result = await generateImageWithEdit(
        baseImageUrl, // Primera imagen como referencia
        editPrompt,   // Prompt de edición
        { aspectRatio: aspectRatio as any }
      );
      
      if (result.success && result.imageUrl) {
        logger.log(`[ShotVariation]    ✅ ${variation.type} generado`);
        return {
          type: variation.type,
          imageUrl: result.imageUrl,
          duration: duration,
          durationMs: duration * beatDurationMs,
          editPrompt: editPrompt,
          beatStart: 0, // Se asigna después
          beatEnd: duration,
          success: true
        };
      } else {
        throw new Error(result.error || 'No image generated');
      }
    } catch (error: any) {
      logger.warn(`[ShotVariation]    ⚠️ Error ${variation.type}: ${error.message}`);
      // Fallback: usar imagen original
      return {
        type: variation.type,
        imageUrl: baseImageUrl,
        duration: duration,
        durationMs: duration * beatDurationMs,
        editPrompt: editPrompt,
        beatStart: 0,
        beatEnd: duration,
        success: false,
        error: error.message
      };
    }
  };

  // Ejecutar generación (en paralelo o secuencial)
  if (parallelGeneration) {
    const generatedVariations = await Promise.all(
      selectedVariations.map((v, i) => generateVariation(v, i))
    );
    variations.push(...generatedVariations);
  } else {
    for (let i = 0; i < selectedVariations.length; i++) {
      const generated = await generateVariation(selectedVariations[i], i);
      variations.push(generated);
    }
  }

  // 6. Asignar beats consecutivos
  let currentBeat = 0;
  const finalVariations = variations.map(v => {
    const updated = {
      ...v,
      beatStart: currentBeat,
      beatEnd: currentBeat + v.duration
    };
    currentBeat += v.duration;
    return updated;
  });

  // 7. Ajustar última variación para cubrir duración total
  if (finalVariations.length > 0) {
    const totalAssigned = finalVariations.reduce((sum, v) => sum + v.duration, 0);
    const diff = durationInBeats - totalAssigned;
    
    if (Math.abs(diff) > 0.1) {
      const last = finalVariations[finalVariations.length - 1];
      last.duration += diff;
      last.durationMs = last.duration * beatDurationMs;
      last.beatEnd = durationInBeats;
    }
  }

  const successCount = finalVariations.filter(v => v.success).length;
  logger.log(`[ShotVariation] ✅ Generadas ${successCount}/${finalVariations.length} variaciones`);

  return finalVariations;
}

/**
 * Genera variaciones para múltiples escenas en batch
 */
export async function generateBatchVariations(
  scenes: Array<{
    sceneId: string;
    imageUrl: string;
    section: string;
    energy: string;
    durationBeats: number;
  }>,
  profile: GenreEditingProfile,
  beatDurationMs: number,
  options: VariationGenerationOptions = {}
): Promise<SceneWithVariations[]> {
  
  logger.log(`[ShotVariation] 🎬 Batch: Procesando ${scenes.length} escenas`);
  
  const results: SceneWithVariations[] = [];
  
  // Procesar secuencialmente para evitar rate limiting
  for (const scene of scenes) {
    try {
      const variations = await generateShotVariations(
        scene.imageUrl,
        scene.section,
        scene.energy,
        profile,
        scene.durationBeats,
        beatDurationMs,
        options
      );
      
      const totalDurationBeats = variations.reduce((sum, v) => sum + v.duration, 0);
      
      results.push({
        originalSceneId: scene.sceneId,
        baseImageUrl: scene.imageUrl,
        section: scene.section,
        energy: scene.energy,
        variations: variations,
        totalDurationBeats: totalDurationBeats,
        totalDurationMs: totalDurationBeats * beatDurationMs
      });
    } catch (error: any) {
      logger.error(`[ShotVariation] ❌ Error en escena ${scene.sceneId}: ${error.message}`);
      
      // Fallback: usar imagen original
      results.push({
        originalSceneId: scene.sceneId,
        baseImageUrl: scene.imageUrl,
        section: scene.section,
        energy: scene.energy,
        variations: [{
          type: 'medium',
          imageUrl: scene.imageUrl,
          duration: scene.durationBeats,
          durationMs: scene.durationBeats * beatDurationMs,
          editPrompt: 'fallback original',
          beatStart: 0,
          beatEnd: scene.durationBeats,
          success: false,
          error: error.message
        }],
        totalDurationBeats: scene.durationBeats,
        totalDurationMs: scene.durationBeats * beatDurationMs
      });
    }
  }
  
  logger.log(`[ShotVariation] ✅ Batch completado: ${results.length} escenas procesadas`);
  return results;
}

/**
 * Obtiene tipos de plano disponibles para un género
 */
export function getAvailableShotTypes(genre: string, mood: string[] = []): string[] {
  const profile = getEditingProfile(genre, mood);
  const allShots = [
    ...profile.shotVariations.performance,
    ...profile.shotVariations.bRoll,
    ...profile.shotVariations.climax
  ];
  
  const uniqueTypes = Array.from(new Set(allShots.map(s => s.type)));
  return uniqueTypes;
}

/**
 * Genera un prompt de edición personalizado
 */
export function buildCustomEditPrompt(
  shotType: string,
  section: string,
  energy: string,
  customDescription?: string
): string {
  const basePrompts: Record<string, string> = {
    'wide': 'wide establishing shot showing full environment and context',
    'medium': 'medium shot waist-up capturing action and expression',
    'close-up': 'tight close-up portrait emphasizing emotion and detail',
    'extreme-close-up': 'extreme close-up filling frame with specific detail',
    'detail': 'macro detail shot focusing on specific element',
    'dutch-angle': 'dutch angle tilted 15-20 degrees for dynamic tension',
    'over-shoulder': 'over shoulder shot implying secondary subject',
    'low-angle': 'low angle looking up conveying power and dominance',
    'high-angle': 'high angle looking down showing scale or vulnerability',
    'pov': 'first person point of view immersive perspective'
  };
  
  const base = basePrompts[shotType] || basePrompts['medium'];
  const fullPrompt = customDescription 
    ? `${base}, ${customDescription}`
    : base;
    
  return buildEditPrompt(fullPrompt, section, energy);
}

// ========== DIRECTOR+DP INTEGRATION ==========

/**
 * 🎬 Genera variaciones de plano usando el perfil Director+DP
 * Los edit_prompts vienen directamente del shot_library del director
 * para mantener coherencia visual con el estilo cinematográfico.
 * 
 * @param baseImageUrl URL de la imagen base
 * @param sceneDescription Descripción de la escena original
 * @param directorName Nombre del director (ej: "Spike Jonze")
 * @param maxVariations Máximo de variaciones a generar
 */
export async function generateDirectorStyleVariations(
  baseImageUrl: string,
  sceneDescription: string,
  directorName: string,
  maxVariations: number = 4
): Promise<GeneratedVariation[]> {
  logger.log(`[ShotVariation] 🎬 Generando variaciones estilo ${directorName}`);
  
  // Obtener edit prompts del perfil Director+DP
  const variationPrompts = getVariationEditPrompts(sceneDescription, directorName);
  
  if (variationPrompts.length === 0) {
    logger.warn(`[ShotVariation] ⚠️ No hay variaciones disponibles para ${directorName}`);
    return [];
  }
  
  // Limitar a maxVariations
  const promptsToUse = variationPrompts.slice(0, maxVariations);
  
  logger.log(`[ShotVariation] 📷 Generando ${promptsToUse.length} variaciones Director+DP...`);
  
  const variations: GeneratedVariation[] = [];
  
  for (const prompt of promptsToUse) {
    try {
      logger.log(`[ShotVariation]    → ${prompt.shot_type}: ${prompt.edit_prompt.substring(0, 50)}...`);
      
      const result = await generateImageWithEdit(
        baseImageUrl,
        prompt.edit_prompt,
        '16:9'
      );
      
      if (result.success && result.imageUrl) {
        variations.push({
          type: prompt.shot_type as ShotVariation['type'],
          imageUrl: result.imageUrl,
          duration: 2, // 2 beats default
          durationMs: 1000, // Will be calculated by caller
          editPrompt: prompt.edit_prompt,
          beatStart: 0,
          beatEnd: 2,
          success: true,
        });
        
        logger.log(`[ShotVariation] ✅ Variación ${prompt.shot_type} generada`);
      } else {
        logger.warn(`[ShotVariation] ⚠️ Fallo en variación ${prompt.shot_type}: ${result.error}`);
      }
    } catch (error: any) {
      logger.error(`[ShotVariation] ❌ Error en variación ${prompt.shot_type}:`, error.message);
    }
    
    // Pequeño delay para evitar rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  logger.log(`[ShotVariation] ✅ ${variations.length}/${promptsToUse.length} variaciones Director+DP completadas`);
  
  return variations;
}

/**
 * Obtiene los shot types disponibles del perfil Director+DP
 */
export function getDirectorShotTypes(directorName: string): string[] {
  const profile = getProfileOrDefault(directorName);
  return Object.keys(profile.shot_library);
}
