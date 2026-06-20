/**
 * Music Video Generator
 * Helper para generar scripts JSON con prompts variados
 */

import { generateMusicVideoScript } from "./openrouter";
import { logger } from "../logger";

export interface ScenePrompt {
  scene_id: number;
  start_time: number;
  duration: number;
  prompt: string;
  negative_prompt?: string;
  lyrics_segment?: string;
  // 🎤 Lipsync - Marcar escenas que necesitan sincronización de labios
  needsLipsync?: boolean;
  // Tipo de escena: performance (artista cantando), narrative (historia), visual (abstracto)
  sceneType?: 'performance' | 'narrative' | 'visual';
  // 🎵 Audio segment info para lipsync
  audioSegment?: {
    startTime: number;
    endTime: number;
    hasVocals: boolean;
  };
}

export interface MusicVideoScript {
  title: string;
  total_duration: number;
  total_scenes: number;
  scenes: ScenePrompt[];
}

/**
 * Genera un script con prompts variados para el video musical
 * @param transcription - La letra de la canción transcrita
 * @param audioDuration - Duración total del audio en segundos
 * @param isPaid - Si es un video pagado (30 escenas) o preview gratuito (3-5 escenas)
 * @param directorInfo - Información opcional del director seleccionado
 * @returns Script JSON con escenas y prompts
 */
export async function generateMusicVideoPrompts(
  transcription: string,
  audioDuration: number,
  isPaid: boolean = false,
  directorInfo?: { name: string; specialty: string; style: string },
  editingStyle?: { id: string; name: string; description: string; duration: { min: number; max: number } }
): Promise<MusicVideoScript> {
  
  const targetSceneCount = isPaid ? 30 : Math.min(5, Math.floor(audioDuration / 2));
  const targetDuration = isPaid ? audioDuration : Math.min(10, audioDuration);
  
  logger.info(`🎬 Generando script ${isPaid ? 'COMPLETO' : 'PREVIEW'}:`);
  logger.info(`  - Escenas: ${targetSceneCount}`);
  logger.info(`  - Duración: ${targetDuration}s`);
  logger.info(`  - Estilo de edición: ${editingStyle?.name || 'Phrase-based Editing'}`);
  logger.info(`  - Rango de duración: ${editingStyle?.duration.min || 4}-${editingStyle?.duration.max || 8}s por escena`);
  
  try {
    // Llamar a la API para generar el guion con el número específico de escenas
    const scriptResponse = await generateMusicVideoScript(
      transcription,
      targetSceneCount,
      directorInfo as any, // Type compatibility: simple object to DirectorProfile
      targetDuration,
      editingStyle
    );
    
    // Parsear el JSON del script
    const parsed = JSON.parse(scriptResponse);
    
    // Extraer escenas en el formato correcto
    let scenes: ScenePrompt[] = [];
    if (parsed.scenes && Array.isArray(parsed.scenes)) {
      scenes = parsed.scenes;
    } else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].scene_id) {
      scenes = parsed;
    } else {
      throw new Error('Formato de script inválido');
    }
    
    // Ajustar duraciones para que encajen en el tiempo objetivo
    const adjustedScenes = adjustSceneDurations(scenes, targetDuration);
    
    return {
      title: isPaid ? "Video Musical Completo" : "Vista Previa",
      total_duration: targetDuration,
      total_scenes: adjustedScenes.length,
      scenes: adjustedScenes
    };
  } catch (error) {
    logger.error('Error generando prompts:', error);
    throw error;
  }
}

/**
 * Ajusta las duraciones de las escenas para que encajen exactamente en la duración total
 * También detecta automáticamente qué escenas necesitan lipsync basado en lyrics_segment
 */
function adjustSceneDurations(scenes: ScenePrompt[], targetDuration: number): ScenePrompt[] {
  if (scenes.length === 0) return [];
  
  // Calcular duración total actual
  const currentTotal = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const scaleFactor = targetDuration / currentTotal;
  
  let cumulativeTime = 0;
  const adjusted = scenes.map((scene, index) => {
    const scaledDuration = scene.duration * scaleFactor;
    
    // 🎤 Detectar si la escena necesita lipsync
    // - Tiene lyrics_segment con texto
    // - Es una escena de "performance" (artista cantando)
    const hasLyrics = scene.lyrics_segment && scene.lyrics_segment.trim().length > 0;
    const isPerformance = scene.sceneType === 'performance' || 
                          (scene.prompt && (
                            scene.prompt.toLowerCase().includes('singing') ||
                            scene.prompt.toLowerCase().includes('cantando') ||
                            scene.prompt.toLowerCase().includes('rapper') ||
                            scene.prompt.toLowerCase().includes('performing') ||
                            scene.prompt.toLowerCase().includes('vocalist') ||
                            scene.prompt.toLowerCase().includes('artist face') ||
                            scene.prompt.toLowerCase().includes('close-up face')
                          ));
    
    const adjustedScene: ScenePrompt = {
      ...scene,
      start_time: cumulativeTime,
      duration: scaledDuration,
      // 🎤 Auto-detectar lipsync para escenas con letra y performance
      needsLipsync: scene.needsLipsync ?? (hasLyrics && isPerformance),
      sceneType: scene.sceneType || (isPerformance ? 'performance' : hasLyrics ? 'narrative' : 'visual'),
      // 🎵 Crear segmento de audio para esta escena
      audioSegment: {
        startTime: cumulativeTime,
        endTime: cumulativeTime + scaledDuration,
        hasVocals: hasLyrics || false
      }
    };
    
    cumulativeTime += scaledDuration;
    return adjustedScene;
  });
  
  // Ajustar última escena para que termine exactamente en targetDuration
  if (adjusted.length > 0) {
    const lastScene = adjusted[adjusted.length - 1];
    lastScene.duration = targetDuration - lastScene.start_time;
    if (lastScene.audioSegment) {
      lastScene.audioSegment.endTime = targetDuration;
    }
  }
  
  // Log de escenas con lipsync
  const lipsyncScenes = adjusted.filter(s => s.needsLipsync);
  logger.info(`🎤 [Lipsync] ${lipsyncScenes.length}/${adjusted.length} escenas marcadas para lipsync`);
  
  return adjusted;
}

/**
 * Genera prompts variados para hacer el video más dinámico
 * Añade variaciones de cámara, iluminación y estilo
 */
export function enhancePrompt(
  basePrompt: string,
  sceneIndex: number,
  totalScenes: number
): string {
  const cameraAngles = [
    "wide shot",
    "close-up",
    "medium shot",
    "bird's eye view",
    "low angle",
    "dutch angle",
    "over the shoulder"
  ];
  
  const lighting = [
    "dramatic lighting",
    "soft natural light",
    "neon lights",
    "golden hour",
    "moody shadows",
    "vibrant colors",
    "high contrast"
  ];
  
  const movements = [
    "slow motion",
    "dynamic camera movement",
    "smooth dolly shot",
    "steady tracking shot",
    "cinematic pan",
    "elegant crane shot"
  ];
  
  // Seleccionar variaciones basadas en el índice de escena para diversidad
  const camera = cameraAngles[sceneIndex % cameraAngles.length];
  const light = lighting[Math.floor(sceneIndex / 2) % lighting.length];
  const movement = movements[Math.floor(sceneIndex / 3) % movements.length];
  
  return `${basePrompt}, ${camera}, ${light}, ${movement}, cinematic quality, professional music video`;
}

/**
 * Genera prompts negativos estándar para evitar elementos no deseados
 */
export function getStandardNegativePrompt(): string {
  return "blurry, low quality, distorted, deformed, watermark, text, logo, amateur, poor lighting, grainy";
}

export default {
  generatePrompts: generateMusicVideoPrompts,
  enhancePrompt,
  getNegativePrompt: getStandardNegativePrompt
};
