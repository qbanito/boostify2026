/**
 * Restricciones para el timeline de producción de vídeos musicales
 * 
 * Este archivo define las funciones y restricciones que se aplican
 * al editor de timeline para asegurar que se cumplan los requisitos específicos:
 * - Clips de máximo 5 segundos
 * - Imágenes generadas solo en la capa 7 (IA_GENERADA)
 * - No solapamiento de imágenes
 */

import { TimelineClip, LayerType, ClipType } from '../../../interfaces/timeline';
import { MAX_CLIP_DURATION } from '../../../constants/timeline-constants';

/**
 * Re-exportar MAX_CLIP_DURATION desde aquí para compatibilidad con professional-editor.tsx
 */
export { MAX_CLIP_DURATION };

/**
 * Enumerar los tipos de capas disponibles
 * (Esta es una adaptación para compatibilidad con professional-editor.tsx)
 */
export const LAYER_TYPES = {
  AUDIO: 5,              // Capa de audio
  VIDEO_IMAGE: 1,        // Capa de video/imagen principal
  TEXT: 4,               // Capa de texto
  AI_GENERATED: 7        // Capa de imágenes generadas por IA
};

/**
 * Aplica todas las restricciones a un conjunto de clips en el timeline.
 * Esta función garantiza que se cumplan todas las reglas definidas:
 * - Duración máxima de clips (5 segundos)
 * - Restricción de capa para imágenes generadas por IA (solo capa 7)
 * - No solapamiento de clips en la misma capa
 * 
 * @param clips Lista de clips a validar y ajustar
 * @returns Lista de clips con las restricciones aplicadas
 */
export function enforceAllConstraints(clips: TimelineClip[]): TimelineClip[] {
  // Aplicamos restricciones a cada clip individualmente
  return clips.map(clip => {
    // 1. Restricción de duración máxima (5 segundos)
    if (clip.duration > MAX_CLIP_DURATION) {
      clip = {
        ...clip,
        duration: MAX_CLIP_DURATION
      };
      console.log(`Clip [${clip.id}] ajustado a duración máxima de ${MAX_CLIP_DURATION} segundos`);
    }
    
    // 2. Restricción de capa para imágenes generadas por IA (solo en capa 7)
    if (clip.type === 'image' && clip.imagePrompt && clip.layer !== LAYER_TYPES.AI_GENERATED) {
      clip = {
        ...clip,
        layer: LAYER_TYPES.AI_GENERATED
      };
      console.log(`Clip generado [${clip.id}] movido a la capa IA [${LAYER_TYPES.AI_GENERATED}]`);
    }
    
    return clip;
  }).map((currentClip, index, updatedClips) => {
    // 3. Restricción de no solapamiento
    // Para cada clip, verificamos si hay colisión con los clips previos
    // y lo movemos si es necesario
    
    // Buscar clips de la misma capa
    const sameLayerClips = updatedClips.filter((c, i) => 
      i !== index && c.layer === currentClip.layer
    );
    
    let adjustedClip = { ...currentClip };
    let needsAdjustment = false;
    
    // Verificar colisiones
    for (const otherClip of sameLayerClips) {
      const currentStart = adjustedClip.start;
      const currentEnd = currentStart + adjustedClip.duration;
      const otherStart = otherClip.start;
      const otherEnd = otherStart + otherClip.duration;
      
      // Si hay solapamiento
      if (currentStart < otherEnd && currentEnd > otherStart) {
        needsAdjustment = true;
        // Mover después del clip existente
        adjustedClip.start = otherEnd + 0.1; // Pequeño margen para evitar solapamientos exactos
        console.log(`Clip [${adjustedClip.id}] reposicionado para evitar solapamiento con [${otherClip.id}]`);
      }
    }
    
    return needsAdjustment ? adjustedClip : currentClip;
  });
}

/**
 * Valida la duración máxima de un clip (máximo 5 segundos)
 * @param duration Duración del clip en segundos
 * @returns True si es válida, false si excede el límite
 */
export function validateClipDuration(duration: number): boolean {
  return duration <= MAX_CLIP_DURATION;
}

/**
 * Valida que las imágenes generadas por IA solo estén en la capa IA_GENERADA (capa 7)
 * @param clip Clip a validar
 * @param layerType Tipo de capa donde se quiere colocar
 * @returns True si es una colocación válida según restricciones
 */
export function validateGeneratedImageLayer(clip: TimelineClip, layerType: LayerType): boolean {
  // Si es una imagen generada pero no está en la capa IA_GENERADA, no es válido
  if (clip.type === ClipType.GENERATED_IMAGE && layerType !== LayerType.IA_GENERADA) {
    return false;
  }
  
  // Si es otro tipo de clip, no hay restricción de capa específica
  return true;
}

/**
 * Verifica si hay colisión entre un clip y otro clip existente
 * @param newClip Nuevo clip o clip a mover
 * @param existingClip Clip existente en el timeline
 * @returns True si hay solapamiento, false si no colisionan
 */
export function checkClipOverlap(newClip: TimelineClip, existingClip: TimelineClip): boolean {
  // Si no están en la misma capa, no pueden solaparse
  if (newClip.layerId !== existingClip.layerId) {
    return false;
  }
  
  // Verificar si hay solapamiento temporal
  const newStart = newClip.start;
  const newEnd = newClip.start + newClip.duration;
  const existingStart = existingClip.start;
  const existingEnd = existingClip.start + existingClip.duration;
  
  // Comprueba si el nuevo clip comienza antes de que termine el existente
  // y termina después de que comience el existente
  return (newStart < existingEnd && newEnd > existingStart);
}

/**
 * Valida la colocación de un clip en el timeline según restricciones
 * @param clip Clip a validar
 * @param clips Lista de clips existentes en el timeline
 * @param layerType Tipo de capa donde se quiere colocar
 * @returns True si cumple todas las restricciones, false si alguna falla
 */
export function validateClipPlacement(
  clip: TimelineClip, 
  clips: TimelineClip[], 
  layerType: LayerType
): boolean {
  // Validar duración máxima
  if (!validateClipDuration(clip.duration)) {
    console.warn('Clip excede la duración máxima permitida (5 segundos)');
    return false;
  }
  
  // Validar restricción de capa para imágenes generadas
  if (!validateGeneratedImageLayer(clip, layerType)) {
    console.warn('Las imágenes generadas solo pueden colocarse en la capa 7 (IA_GENERADA)');
    return false;
  }
  
  // Validar no solapamiento con otros clips en la misma capa
  for (const existingClip of clips) {
    // Ignorar el mismo clip (para casos de movimiento)
    if (existingClip.id === clip.id) {
      continue;
    }
    
    // Si hay solapamiento y están en la misma capa, no es válido
    if (checkClipOverlap(clip, existingClip)) {
      console.warn('No se permite el solapamiento de clips en la misma capa');
      return false;
    }
  }
  
  // Si pasa todas las validaciones, es una colocación válida
  return true;
}