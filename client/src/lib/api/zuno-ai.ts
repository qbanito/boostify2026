/**
 * Servicio para interactuar con la API de generación de música Zuno AI
 * 
 * Este servicio maneja la comunicación con los endpoints de la API
 * para generar música, verificar el estado de generaciones y obtener
 * el historial de generaciones.
 */
import { getAuthToken } from '../auth';
import { logger } from "../logger";

/**
 * Interfaz para las opciones de generación de música
 */
export interface MusicGenerationOptions {
  prompt: string;
  title?: string;
  model: string;
  modelName?: string; // Legacy alias for model
  makeInstrumental?: boolean;
  negativeTags?: string;
  tags?: string;
  seed?: number;
  tempo?: number;
  keySignature?: string;
  continueClipId?: string;
  continueAt?: number;
  customLyrics?: string;
  generateLyrics?: boolean;
  audioUrl?: string;
  uploadAudio?: boolean;
  /** Lyria 3 enhanced composition parameters */
  lyria3Params?: {
    genre?: string;
    bpm?: number;
    key?: string;
    mood?: string;
    instruments?: string[];
    structure?: string;
    timestamps?: { start: string; end: string; description: string }[];
    customLyrics?: string;
    instrumental?: boolean;
    language?: string;
    vocalStyle?: string;
    durationHint?: string;
    outputFormat?: "mp3" | "wav";
    useClipModel?: boolean;
    artistGender?: "male" | "female";
    productionStyle?: string;
    dynamics?: string;
  };
}

/**
 * Interfaz para el estado de generación de música
 */
export interface MusicGenerationStatus {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  audioUrl?: string;
  message: string;
  error?: string; // Campo adicional para mensajes de error específicos
}

/**
 * Interfaz para un elemento en el historial de generaciones
 */
export interface MusicGenerationHistoryItem {
  id: string;
  taskId: string;
  title: string;
  model: string;
  prompt: string;
  audioUrl: string;
  createdAt: string;
  status: 'completed' | 'failed' | 'processing' | 'pending';
}

/**
 * Genera música utilizando la API de Zuno AI
 * @param options Opciones para la generación de música
 * @returns Objeto con el ID de la tarea iniciada
 */
export async function generateMusic(options: MusicGenerationOptions): Promise<{ taskId: string }> {
  try {
    // Simular generación para pruebas sin backend
    if (process.env.NODE_ENV === 'development' && false) {
      logger.info('Generación simulada:', options);
      return { taskId: `sim_${Date.now()}` };
    }

    // Obtener el token de autenticación
    const authToken = await getAuthToken();
    
    // Configuración de los headers para la solicitud
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    // Añadir el token de autenticación si está disponible
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch('/api/music/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify(options),
      credentials: 'include', // Incluir cookies en la solicitud
    });

    if (!response.ok) {
      logger.error('Error en la generación de música:', response.status, response.statusText);
      
      // Manejar específicamente los errores de autenticación
      if (response.status === 401) {
        throw new Error('401 - Necesitas iniciar sesión para generar música');
      } else if (response.status === 403) {
        throw new Error('403 - No tienes permiso para acceder a este recurso');
      } else {
        // Intentar obtener un mensaje de error más detallado del servidor
        try {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error generando música');
        } catch (parseError) {
          throw new Error(`Error ${response.status}: Error generando música`);
        }
      }
    }

    const data = await response.json();
    return { taskId: data.taskId };
  } catch (error) {
    logger.error('Error en la generación de música:', error);
    // Propagar el error original para mantener la información detallada
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error generando música');
  }
}

/**
 * Verifica el estado de una generación de música en progreso
 * @param taskId ID de la tarea de generación
 * @returns Estado actual de la generación
 * @throws Error con mensaje descriptivo si hay un problema
 */
export async function checkGenerationStatus(taskId: string): Promise<MusicGenerationStatus> {
  try {
    // Simular estado para pruebas sin backend
    if (process.env.NODE_ENV === 'development' && false) {
      logger.info('Verificación simulada de estado:', taskId);
      
      // Para simular diferentes estados basados en el tiempo
      const now = Date.now();
      const taskStartTime = parseInt(taskId.split('_')[1]);
      const elapsedSeconds = (now - taskStartTime) / 1000;
      
      if (elapsedSeconds < 5) {
        return { id: taskId, status: 'pending', message: 'Tarea en cola' };
      } else if (elapsedSeconds < 20) {
        return { 
          id: taskId, 
          status: 'processing', 
          progress: Math.min(Math.floor((elapsedSeconds - 5) * 6), 90),
          message: 'Generando música' 
        };
      } else {
        return { 
          id: taskId, 
          status: 'completed', 
          audioUrl: 'https://example.com/sample-audio.mp3', 
          message: 'Generación completada' 
        };
      }
    }
    
    // Obtener el token de autenticación
    const authToken = await getAuthToken();
    
    // Configuración de los headers para la solicitud
    const headers: HeadersInit = {};
    
    // Añadir el token de autenticación si está disponible
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch(`/api/music/status?taskId=${taskId}`, {
      headers,
      credentials: 'include', // Incluir cookies en la solicitud
    });
    
    if (!response.ok) {
      logger.error('Error verificando estado:', response.status, response.statusText);
      
      // Manejar específicamente los errores de autenticación
      if (response.status === 401) {
        throw new Error('401 - Necesitas iniciar sesión para verificar el estado');
      } else if (response.status === 403) {
        throw new Error('403 - No tienes permiso para acceder a este recurso');
      } else if (response.status === 404) {
        throw new Error('404 - La tarea de generación no fue encontrada');
      }
      
      // Intentar obtener un mensaje de error más detallado del servidor
      try {
        const errorData = await response.json();
        throw new Error(errorData.error || `Error ${response.status}: Error verificando estado`);
      } catch (parseError) {
        throw new Error(`Error ${response.status}: Error verificando el estado de la generación`);
      }
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error verificando estado:', error);
    
    // Propagar el error original para mantener la información detallada
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Error verificando el estado de la generación');
  }
}

/**
 * Obtiene el historial de generaciones recientes
 * @returns Lista de generaciones recientes
 * @throws Error con mensaje descriptivo si hay un problema de autenticación
 */
export async function getRecentGenerations(): Promise<MusicGenerationHistoryItem[]> {
  try {
    // Simular historial para pruebas sin backend
    if (process.env.NODE_ENV === 'development' && false) {
      logger.info('Obteniendo historial simulado');
      return [
        {
          id: 'sim_1',
          taskId: 'sim_task_1',
          title: 'Canción Pop Electrónica',
          model: 'music-s',
          prompt: 'Una canción pop con elementos electrónicos, ritmo bailable y voces femeninas',
          audioUrl: 'https://example.com/sample1.mp3',
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'completed'
        },
        {
          id: 'sim_2',
          taskId: 'sim_task_2',
          title: 'Balada Romántica',
          model: 'music-u',
          prompt: 'Una balada romántica con piano, strings y voces emotivas',
          audioUrl: 'https://example.com/sample2.mp3',
          createdAt: new Date(Date.now() - 172800000).toISOString(),
          status: 'completed'
        }
      ];
    }
    
    // Obtener el token de autenticación
    const authToken = await getAuthToken();
    
    // Configuración de los headers para la solicitud
    const headers: HeadersInit = {};
    
    // Añadir el token de autenticación si está disponible
    if (authToken) {
      headers['Authorization'] = `Bearer ${authToken}`;
    }

    const response = await fetch('/api/music/recent', {
      headers,
      credentials: 'include', // Incluir cookies en la solicitud
    });
    
    if (!response.ok) {
      logger.error('Error obteniendo historial:', response.status, response.statusText);
      
      // Manejar específicamente los errores de autenticación
      if (response.status === 401) {
        throw new Error('401 - Necesitas iniciar sesión para ver tu historial');
      } else if (response.status === 403) {
        throw new Error('403 - No tienes permiso para acceder a este recurso');
      }
      
      throw new Error(`Error ${response.status}: No se pudo obtener el historial de generaciones`);
    }
    
    return await response.json();
  } catch (error) {
    logger.error('Error obteniendo historial:', error);
    
    // Propagar errores específicos de autenticación
    if (error instanceof Error && 
        (error.message.includes('401') || error.message.includes('403'))) {
      throw error;
    }
    
    // Para otros errores, devolver array vacío
    return [];
  }
}