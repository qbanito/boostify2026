/**
 * Servicio para procesar imágenes y agregar movimiento usando PiAPI/Kling
 * Este servicio maneja la comunicación con el backend para aplicar movimientos
 * a imágenes estáticas y convertirlas en videos con movimiento sincronizado.
 */

import { apiRequest } from "../queryClient";
import { logger } from "../logger";

export interface MovementPattern {
  name: string;
  description: string;
  prompt: string;
  intensity: number;
  tempo: 'slow' | 'medium' | 'fast';
  suitable: string[]; // Secciones adecuadas (coro, verso, etc.)
}

export interface MovementApplication {
  clipId: number;
  imageUrl: string;
  movementPattern: string;
  intensity: number;
  section: string;
  startTime: number;
  endTime: number;
}

export interface MovementProcessingResult {
  success: boolean;
  taskId?: string;
  error?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
}

/**
 * Biblioteca de patrones de movimiento predefinidos
 * Estos patrones se pueden aplicar a imágenes para crear diferentes efectos
 */
export const movementPatterns: MovementPattern[] = [
  {
    name: "Zoom Suave",
    description: "Acercamiento lento hacia el sujeto principal",
    prompt: "smooth zoom in effect, gradually focusing on the main subject, cinematic movement",
    intensity: 20,
    tempo: 'slow',
    suitable: ['Introducción', 'Verso', 'Final']
  },
  {
    name: "Rotación Lenta",
    description: "Rotación suave en sentido horario",
    prompt: "slow clockwise rotation, subtle spinning effect, slight camera movement",
    intensity: 30,
    tempo: 'slow',
    suitable: ['Verso', 'Puente']
  },
  {
    name: "Pulso Rítmico",
    description: "Efecto de pulso siguiendo el ritmo",
    prompt: "rhythmic pulsing effect in sync with beat, slight in and out motion",
    intensity: 40,
    tempo: 'medium',
    suitable: ['Coro', 'Solo']
  },
  {
    name: "Desplazamiento Lateral",
    description: "Movimiento horizontal suave",
    prompt: "smooth lateral pan from left to right, cinematic drift",
    intensity: 35,
    tempo: 'medium',
    suitable: ['Verso', 'Puente', 'Solo']
  },
  {
    name: "Expansión Enérgica",
    description: "Expansión rápida desde el centro",
    prompt: "energetic expansion from center, dynamic growth effect",
    intensity: 60,
    tempo: 'fast',
    suitable: ['Coro', 'Solo', 'Final']
  },
  {
    name: "Vibración Intensa",
    description: "Efecto de vibración rápida siguiendo el ritmo",
    prompt: "intense vibration effect following beat, fast subtle shaking",
    intensity: 70,
    tempo: 'fast',
    suitable: ['Coro', 'Solo']
  },
  {
    name: "Ondulación Suave",
    description: "Movimiento ondulante sutil",
    prompt: "subtle wave-like motion, gentle ripple effect across the image",
    intensity: 25,
    tempo: 'slow',
    suitable: ['Introducción', 'Verso', 'Final']
  },
  {
    name: "Giro Completo",
    description: "Rotación completa 360°",
    prompt: "complete 360 degree rotation, full spin effect",
    intensity: 65,
    tempo: 'fast',
    suitable: ['Coro', 'Final']
  }
];

/**
 * Obtiene los patrones de movimiento adecuados para una sección específica
 * @param section Sección del video (Coro, Verso, etc.)
 * @param tempo Tempo deseado (opcional)
 * @returns Lista de patrones adecuados para la sección
 */
export function getMovementPatternsForSection(section: string, tempo?: 'slow' | 'medium' | 'fast'): MovementPattern[] {
  let patterns = movementPatterns.filter(pattern => pattern.suitable.includes(section));
  
  if (tempo) {
    patterns = patterns.filter(pattern => pattern.tempo === tempo);
  }
  
  return patterns;
}

/**
 * Inicia el procesamiento de una imagen para aplicar un movimiento
 * @param imageUrl URL de la imagen a procesar
 * @param movementPrompt Descripción del movimiento a aplicar
 * @param intensity Intensidad del movimiento (1-100)
 * @returns Resultado del procesamiento con taskId para seguimiento
 */
export async function processImageWithMovement(
  imageUrl: string,
  movementPrompt: string,
  intensity: number
): Promise<MovementProcessingResult> {
  try {
    // Aplicar la intensidad al prompt para ajustar el movimiento
    const adjustedPrompt = `${movementPrompt}, intensity level ${intensity}%`;
    
    // Enviar solicitud al endpoint en el servidor
    const response = await apiRequest('/api/proxy/kling/effects/start', 'POST', {
      imageUrl,
      prompt: adjustedPrompt,
      intensity,
      effect: 'movement' // Tipo de efecto a aplicar
    });
    
    if (response.success && response.taskId) {
      return {
        success: true,
        taskId: response.taskId,
        status: 'pending'
      };
    } else {
      throw new Error(response.error || 'Error al iniciar el procesamiento de movimiento');
    }
  } catch (error: any) {
    logger.error('Error en processImageWithMovement:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al procesar la imagen'
    };
  }
}

/**
 * Verifica el estado de un proceso de aplicación de movimiento
 * @param taskId ID de la tarea a verificar
 * @returns Estado actualizado del procesamiento
 */
export async function checkMovementProcessingStatus(taskId: string): Promise<MovementProcessingResult> {
  try {
    const response = await apiRequest(`/api/proxy/kling/effects/status?taskId=${taskId}`, 'GET');
    
    if (response.success) {
      return {
        success: true,
        taskId,
        status: response.status,
        resultUrl: response.url
      };
    } else {
      return {
        success: false,
        taskId,
        status: response.status || 'failed',
        error: response.error || 'Error al verificar el estado del procesamiento'
      };
    }
  } catch (error: any) {
    logger.error('Error en checkMovementProcessingStatus:', error);
    return {
      success: false,
      taskId,
      status: 'failed',
      error: error.message || 'Error desconocido al verificar el estado'
    };
  }
}

/**
 * Guarda un resultado de procesamiento de movimiento
 * @param taskId ID de la tarea completada
 * @param resultUrl URL del video resultante
 * @param metadata Metadatos adicionales del procesamiento, incluyendo videoId opcional para asociar con un video específico
 * @returns Resultado de la operación de guardado
 */
export async function saveMovementResult(
  taskId: string,
  resultUrl: string,
  metadata: {
    clipId: number,
    section: string,
    patternName: string,
    intensity: number,
    videoId?: string
  }
): Promise<{ success: boolean, id?: string, error?: string }> {
  try {
    const response = await apiRequest('/api/proxy/kling/save-result', 'POST', {
      taskId,
      resultUrl,
      type: 'movement', // Cambiado de 'effects' a 'movement' para manejarlo específicamente en el servidor
      result: {
        url: resultUrl,
        ...metadata
      },
      videoId: metadata.videoId // Pasar el videoId en el nivel superior para validación de compra
    });
    
    return {
      success: response.success,
      id: response.id,
      error: response.error
    };
  } catch (error: any) {
    logger.error('Error en saveMovementResult:', error);
    return {
      success: false,
      error: error.message || 'Error desconocido al guardar el resultado'
    };
  }
}

/**
 * Sincroniza los movimientos con el ritmo musical basado en un análisis de audio
 * @param audioBuffer Buffer de audio para analizar
 * @param section Sección musical (coro, verso, etc.)
 * @returns Recomendaciones de patrones y tiempos de movimiento
 */
export function synchronizeMovementsWithAudio(
  audioBuffer: AudioBuffer | null,
  section: string
): { 
  recommendedPattern: MovementPattern | null,
  recommendedIntensity: number,
  beatTimings: number[]
} {
  // Por defecto, si no hay análisis de audio disponible
  if (!audioBuffer) {
    const patterns = getMovementPatternsForSection(section);
    return {
      recommendedPattern: patterns.length > 0 ? patterns[0] : null,
      recommendedIntensity: 50,
      beatTimings: []
    };
  }
  
  // En una implementación real, aquí analizaríamos el AudioBuffer para:
  // 1. Detectar el BPM (tempo)
  // 2. Identificar beats y transiciones
  // 3. Mapear beats a tiempos específicos
  
  // Simulación simple basada en la duración del audio
  const duration = audioBuffer.duration;
  const estimatedBPM = 120; // BPM fijo para demostración
  const secondsPerBeat = 60 / estimatedBPM;
  
  const beatTimings: number[] = [];
  let currentTime = 0;
  
  // Generar tiempos de beat aproximados
  while (currentTime < duration) {
    beatTimings.push(currentTime);
    currentTime += secondsPerBeat;
  }
  
  // Determinar el tempo basado en el BPM estimado
  let tempo: 'slow' | 'medium' | 'fast' = 'medium';
  if (estimatedBPM < 100) tempo = 'slow';
  else if (estimatedBPM > 140) tempo = 'fast';
  
  // Seleccionar un patrón adecuado basado en el tempo y la sección
  const patterns = getMovementPatternsForSection(section, tempo);
  const recommendedPattern = patterns.length > 0 
    ? patterns[Math.floor(Math.random() * patterns.length)] 
    : null;
  
  // Determinar intensidad basada en el volumen promedio
  // (En una implementación real, analizaríamos el RMS del AudioBuffer)
  const recommendedIntensity = tempo === 'slow' ? 30 : (tempo === 'medium' ? 50 : 70);
  
  return {
    recommendedPattern,
    recommendedIntensity,
    beatTimings
  };
}