/**
 * Servicio para generar videos usando la API de Hailuo a través de PiAPI
 * 
 * Este servicio se encarga de:
 * 1. Convertir imágenes estáticas en videos animados
 * 2. Generar videos a partir de texto descriptivo
 * 3. Combinar imágenes con texto para generar videos con contexto
 * 4. Aplicar movimientos de cámara para lograr efectos cinematográficos
 */

import { apiRequest } from "../queryClient";
import { logger } from "../logger";

export interface HailuoVideoOptions {
  // Opciones comunes
  model: 't2v-01' | 't2v-01-director' | 'i2v-01' | 'i2v-01-live' | 's2v-01';
  expandPrompt?: boolean;
  
  // Opciones específicas para cada modelo
  prompt?: string;
  imageUrl?: string;
  
  // Opciones para cámara (solo para t2v-01-director)
  cameraMovement?: string | string[];
  useCinematicMovements?: boolean;
}

/**
 * Tipos de movimientos de cámara disponibles para el modelo t2v-01-director
 */
export type CameraMovementType = 
  // Movimientos básicos
  | 'Truck left' | 'Truck right'        // Movimiento horizontal
  | 'Pan left' | 'Pan right'            // Rotación horizontal
  | 'Push in' | 'Push out'              // Acercamiento/alejamiento
  | 'Pedestal up' | 'Pedestal down'     // Movimiento vertical
  | 'Tilt up' | 'Tilt down'             // Rotación vertical
  | 'Zoom in' | 'Zoom out'              // Zoom
  | 'Shake'                             // Efecto de temblor
  | 'Tracking shot'                     // Seguimiento
  | 'Static shot';                      // Cámara fija (excluyente de otros movimientos)

/**
 * Biblioteca de movimientos de cámara disponibles
 */
export const CAMERA_MOVEMENTS: CameraMovementType[] = [
  'Truck left', 'Truck right',
  'Pan left', 'Pan right',
  'Push in', 'Push out',
  'Pedestal up', 'Pedestal down',
  'Tilt up', 'Tilt down',
  'Zoom in', 'Zoom out',
  'Shake',
  'Tracking shot',
  'Static shot'
];

/**
 * Combinaciones cinematográficas predefinidas de movimientos de cámara
 */
export const CINEMATIC_MOVEMENT_COMBINATIONS = [
  ['Push in', 'Tilt up'],               // Movimiento dramático de revelación
  ['Push in', 'Zoom in'],               // Enfoque intenso en el sujeto
  ['Pan right', 'Tilt down'],           // Movimiento de descubrimiento
  ['Pan left', 'Push out'],             // Movimiento de alejamiento contextual
  ['Tracking shot', 'Pedestal up'],     // Seguimiento con elevación
  ['Zoom out', 'Pan right'],            // Revelar el entorno
  ['Push in', 'Pan left'],              // Acercamiento con contextualización
  ['Tilt up', 'Zoom out'],              // Revelación de escala
  ['Static shot'],                      // Toma estática para momentos de contemplación
  ['Truck right', 'Push in'],           // Movimiento lateral con acercamiento
  ['Pedestal down', 'Zoom in'],         // Descenso con enfoque
  ['Push out', 'Tilt down']             // Alejamiento con descenso
];

export interface VideoGenerationResult {
  success: boolean;
  taskId?: string;
  error?: string;
}

export interface VideoStatusResult {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  resultUrl?: string;
  error?: string;
  progress?: number;
}

/**
 * Genera movimientos de cámara aleatorios basados en el prompt y contexto
 * 
 * @param prompt Texto descriptivo del video
 * @param useCinematic Si se deben usar combinaciones cinematográficas predefinidas
 * @returns Formato de movimientos de cámara para incluir en el prompt
 */
export function generateCameraMovements(prompt: string, useCinematic: boolean = true): string {
  // Si se solicita movimiento cinematográfico, usar combinaciones predefinidas
  if (useCinematic) {
    // Elegir una combinación basada en el contenido del prompt
    let combinationIndex = 0;
    
    const promptLower = prompt.toLowerCase();
    
    // Analizar el contenido del prompt para elegir movimientos adecuados
    if (promptLower.includes('reveal') || promptLower.includes('dramatic')) {
      combinationIndex = 0; // ['Push in', 'Tilt up'] - Movimiento dramático de revelación
    } else if (promptLower.includes('focus') || promptLower.includes('close')) {
      combinationIndex = 1; // ['Push in', 'Zoom in'] - Enfoque intenso en el sujeto
    } else if (promptLower.includes('discover') || promptLower.includes('find')) {
      combinationIndex = 2; // ['Pan right', 'Tilt down'] - Movimiento de descubrimiento
    } else if (promptLower.includes('context') || promptLower.includes('environment')) {
      combinationIndex = 3; // ['Pan left', 'Push out'] - Movimiento de alejamiento contextual
    } else if (promptLower.includes('follow') || promptLower.includes('track')) {
      combinationIndex = 4; // ['Tracking shot', 'Pedestal up'] - Seguimiento con elevación
    } else if (promptLower.includes('wide') || promptLower.includes('scene')) {
      combinationIndex = 5; // ['Zoom out', 'Pan right'] - Revelar el entorno
    } else if (promptLower.includes('approach') || promptLower.includes('move')) {
      combinationIndex = 6; // ['Push in', 'Pan left'] - Acercamiento con contextualización
    } else if (promptLower.includes('grand') || promptLower.includes('epic')) {
      combinationIndex = 7; // ['Tilt up', 'Zoom out'] - Revelación de escala
    } else if (promptLower.includes('still') || promptLower.includes('quiet') || promptLower.includes('calm')) {
      combinationIndex = 8; // ['Static shot'] - Toma estática para momentos de contemplación
    } else if (promptLower.includes('side') || promptLower.includes('passing')) {
      combinationIndex = 9; // ['Truck right', 'Push in'] - Movimiento lateral con acercamiento
    } else if (promptLower.includes('down') || promptLower.includes('descend')) {
      combinationIndex = 10; // ['Pedestal down', 'Zoom in'] - Descenso con enfoque
    } else if (promptLower.includes('back') || promptLower.includes('away')) {
      combinationIndex = 11; // ['Push out', 'Tilt down'] - Alejamiento con descenso
    } else {
      // Si no hay coincidencias claras, elegir una combinación aleatoria
      combinationIndex = Math.floor(Math.random() * CINEMATIC_MOVEMENT_COMBINATIONS.length);
    }
    
    const selectedMovements = CINEMATIC_MOVEMENT_COMBINATIONS[combinationIndex];
    return `[${selectedMovements.join(',')}]`;
  } 
  // Si no, generar movimientos aleatorios (máximo 2-3)
  else {
    // Elegir 1-3 movimientos aleatorios, excluyendo 'Static shot' inicialmente
    const availableMovements = CAMERA_MOVEMENTS.filter(m => m !== 'Static shot');
    const numMovements = Math.floor(Math.random() * 2) + 1; // 1 o 2 movimientos
    
    // 10% de probabilidad de usar Static shot (que debe estar solo)
    if (Math.random() < 0.1) {
      return '[Static shot]';
    }
    
    // Seleccionar movimientos aleatorios
    const selectedMovements: string[] = [];
    for (let i = 0; i < numMovements; i++) {
      const randomIndex = Math.floor(Math.random() * availableMovements.length);
      const movement = availableMovements[randomIndex];
      
      // Evitar añadir el mismo movimiento dos veces
      if (!selectedMovements.includes(movement)) {
        selectedMovements.push(movement);
      }
      
      // Remover movimientos opuestos para evitar combinaciones ilógicas
      if (movement.includes('left')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('right'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      } else if (movement.includes('right')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('left'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      } else if (movement.includes('in')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('out'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      } else if (movement.includes('out')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('in') && !m.includes('out'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      } else if (movement.includes('up')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('down'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      } else if (movement.includes('down')) {
        const oppositeIndex = availableMovements.findIndex(m => m.includes('up'));
        if (oppositeIndex >= 0) availableMovements.splice(oppositeIndex, 1);
      }
    }
    
    return `[${selectedMovements.join(',')}]`;
  }
}

/**
 * Genera un video usando la API de Hailuo
 * 
 * @param options Opciones de generación de video
 * @returns Resultado de la generación con taskId para verificar estado
 */
export async function generateVideo(options: HailuoVideoOptions): Promise<VideoGenerationResult> {
  try {
    // Validar opciones según el modelo seleccionado
    validateOptions(options);
    
    // Preparar datos para la solicitud
    const requestData: any = {
      model: options.model,
      expand_prompt: options.expandPrompt ?? true
    };
    
    // Si estamos usando el modelo director, aplicar movimientos de cámara al prompt
    let finalPrompt = options.prompt || '';
    
    if (options.model === 't2v-01-director') {
      // Si hay movimientos de cámara explícitos, usarlos
      if (options.cameraMovement) {
        if (Array.isArray(options.cameraMovement)) {
          // Si es un array, convertirlo a string para el formato [mov1,mov2]
          const movementString = `[${options.cameraMovement.join(',')}]`;
          finalPrompt = `${movementString}${finalPrompt}`;
        } else if (typeof options.cameraMovement === 'string') {
          // Si ya es un string, verificar que tenga el formato correcto [mov1,mov2]
          if (!options.cameraMovement.startsWith('[')) {
            finalPrompt = `[${options.cameraMovement}]${finalPrompt}`;
          } else {
            finalPrompt = `${options.cameraMovement}${finalPrompt}`;
          }
        }
      } 
      // Si no hay movimientos explícitos pero se solicitan movimientos cinematográficos
      else if (options.useCinematicMovements !== false && finalPrompt) {
        // Generar movimientos apropiados basados en el prompt
        const movementString = generateCameraMovements(finalPrompt, true);
        finalPrompt = `${movementString}${finalPrompt}`;
      }
    }
    
    // Actualizar el prompt con los movimientos
    if (finalPrompt) {
      requestData.prompt = finalPrompt;
    }
    
    // Agregar URL de imagen si está disponible
    if (options.imageUrl) {
      requestData.image_url = options.imageUrl;
    }
    
    logger.info('Enviando solicitud de generación de video:', requestData);
    
    // Realizar la solicitud al endpoint proxy
    const response = await apiRequest('/api/proxy/piapi/video/start', {
      method: 'POST',
      body: JSON.stringify(requestData)
    } as any);
    
    if (response.success && response.taskId) {
      return {
        success: true,
        taskId: response.taskId
      };
    } else {
      return {
        success: false,
        error: response.error || 'Error desconocido al generar video'
      };
    }
  } catch (error) {
    logger.error('Error en generación de video con Hailuo:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado en la generación de video'
    };
  }
}

/**
 * Verifica el estado de una tarea de generación de video
 * 
 * @param taskId ID de la tarea a verificar
 * @returns Estado actual de la generación de video
 */
export async function checkVideoStatus(taskId: string): Promise<VideoStatusResult> {
  try {
    const response = await apiRequest(`/api/proxy/piapi/video/status?taskId=${taskId}`, {
      method: 'GET'
    } as any);
    
    // Procesar la respuesta para tener un formato consistente
    return {
      id: taskId,
      status: response.status || 'failed',
      resultUrl: response.resultUrl || response.url,
      error: response.error || response.error_info,
      progress: calculateProgress(response.status)
    };
  } catch (error) {
    logger.error('Error verificando estado de video:', error);
    return {
      id: taskId,
      status: 'failed',
      error: error instanceof Error ? error.message : 'Error inesperado al verificar estado'
    };
  }
}

/**
 * Guarda un video generado en la base de datos
 * 
 * @param taskId ID de la tarea completada
 * @param videoUrl URL del video generado
 * @param metadata Metadatos adicionales para el video
 * @returns Resultado de la operación de guardado
 */
export async function saveGeneratedVideo(
  taskId: string, 
  videoUrl: string, 
  metadata: {
    prompt?: string;
    model: string;
    userId?: string;
    imageSourceUrl?: string;
  }
): Promise<{success: boolean, id?: string, error?: string}> {
  try {
    const response = await apiRequest('/api/proxy/piapi/video/save', {
      method: 'POST',
      body: JSON.stringify({
        taskId,
        videoUrl,
        ...metadata
      })
    } as any);
    
    return {
      success: response.success,
      id: response.id,
      error: response.error
    };
  } catch (error) {
    logger.error('Error guardando video generado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error inesperado al guardar video'
    };
  }
}

/**
 * Convierte clips de la línea de tiempo en videos animados
 * 
 * @param clips Array de clips para convertir en videos
 * @returns Resultado de la operación con IDs de tareas iniciadas
 */
export async function convertTimelineClipsToVideos(
  clips: Array<{
    id: number;
    imageUrl: string;
    prompt?: string;
    type: string;
  }>
): Promise<{
  success: boolean;
  tasks: Array<{clipId: number, taskId: string}>;
  errors: Array<{clipId: number, error: string}>;
}> {
  const tasks: Array<{clipId: number, taskId: string}> = [];
  const errors: Array<{clipId: number, error: string}> = [];
  
  for (const clip of clips) {
    // Solo procesar clips de tipo imagen
    if (clip.type !== 'image' || !clip.imageUrl) {
      errors.push({
        clipId: clip.id,
        error: 'Clip no válido para conversión a video (debe ser imagen)'
      });
      continue;
    }
    
    try {
      // Determinar el modelo adecuado
      // Usamos i2v-01 para imágenes sin personas
      // Usamos s2v-01 para imágenes con personas (más caro pero mejor calidad)
      const model = clip.prompt?.toLowerCase().includes('person') || 
                  clip.prompt?.toLowerCase().includes('face') || 
                  clip.prompt?.toLowerCase().includes('people') 
                  ? 's2v-01' : 'i2v-01';
      
      const result = await generateVideo({
        model,
        imageUrl: clip.imageUrl,
        prompt: clip.prompt || 'convert image to smooth video',
        expandPrompt: true
      });
      
      if (result.success && result.taskId) {
        tasks.push({
          clipId: clip.id,
          taskId: result.taskId
        });
      } else {
        errors.push({
          clipId: clip.id,
          error: result.error || 'Error desconocido'
        });
      }
    } catch (error) {
      errors.push({
        clipId: clip.id,
        error: error instanceof Error ? error.message : 'Error inesperado'
      });
    }
  }
  
  return {
    success: tasks.length > 0,
    tasks,
    errors
  };
}

// Función auxiliar para validar opciones según el modelo
function validateOptions(options: HailuoVideoOptions): void {
  const { model, prompt, imageUrl } = options;
  
  // Validar modelos de texto a video
  if (model === 't2v-01' || model === 't2v-01-director') {
    if (!prompt) {
      throw new Error(`El modelo ${model} requiere un prompt de texto`);
    }
    if (imageUrl) {
      throw new Error(`El modelo ${model} no acepta imágenes de entrada`);
    }
  }
  
  // Validar modelos de imagen a video
  else if (model === 'i2v-01' || model === 'i2v-01-live') {
    if (!imageUrl) {
      throw new Error(`El modelo ${model} requiere una URL de imagen`);
    }
  }
  
  // Validar modelo de referencia de sujeto
  else if (model === 's2v-01') {
    if (!imageUrl) {
      throw new Error('El modelo s2v-01 requiere una URL de imagen con rostro humano');
    }
    if (!prompt) {
      throw new Error('El modelo s2v-01 requiere un prompt de texto');
    }
  }
}

// Función auxiliar para calcular progreso basado en estado
function calculateProgress(status: string): number {
  switch (status) {
    case 'pending':
      return 10;
    case 'processing':
      return 50;
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}