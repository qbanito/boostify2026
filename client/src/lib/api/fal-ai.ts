/**
 * Módulo para interactuar con la API de Fal.AI para generación de imágenes y audio
 */

import axios from 'axios';
import { logger } from "../logger";

/**
 * Interfaz para los parámetros de generación de imágenes con Fal AI
 */
export interface GenerateImageParams {
  prompt: string;
  negative_prompt?: string;
  height?: number;
  width?: number;
  num_images?: number;
  model?: string;
  negativePrompt?: string;  // Alias para compatibilidad
  imageSize?: 'square' | 'portrait' | 'landscape' | 'landscape_16_9';
}

/**
 * Interfaz para los resultados de generación de imágenes
 */
export interface GeneratedImageResult {
  success: boolean;
  images?: string[];
  error?: string;
  data?: any;  // Para mantener compatibilidad con la estructura completa
}

/**
 * Interfaz para los parámetros de generación de audio con Fal AI
 */
export interface GenerateAudioParams {
  prompt: string;
  duration?: number;
  model?: string;
  seed?: number;
}

/**
 * Interfaz para los resultados de generación de audio
 */
export interface GeneratedAudioResult {
  success: boolean;
  audioUrl?: string;
  error?: string;
}

/**
 * Genera imágenes utilizando la API de Fal AI a través de nuestro proxy
 * 
 * @param params Parámetros para la generación de imágenes
 * @returns Respuesta con las imágenes generadas o error
 */
export async function generateImageWithFal(params: GenerateImageParams): Promise<GeneratedImageResult> {
  try {
    // Manejar los parámetros de tamaño personalizado
    let width = params.width || 512;
    let height = params.height || 512;
    
    // Convertir imageSize a dimensiones concretas si se proporciona
    if (params.imageSize) {
      switch (params.imageSize) {
        case 'square':
          width = 1024;
          height = 1024;
          break;
        case 'portrait':
          width = 768;
          height = 1024;
          break;
        case 'landscape':
          width = 1024;
          height = 768;
          break;
        case 'landscape_16_9':
          width = 1280;
          height = 720;
          break;
      }
    }
    
    // Usar nuestro proxy para acceder a la API de Fal.AI
    const response = await axios.post('/api/proxy/fal/generate', {
      prompt: params.prompt,
      negative_prompt: params.negative_prompt || params.negativePrompt || '',
      height: height,
      width: width,
      num_images: params.num_images || 1,
      model: params.model || 'stable-diffusion'
    });

    // Verificar si la respuesta contiene imágenes
    if (response.data && response.data.images) {
      return {
        success: true,
        images: response.data.images,
        data: response.data
      };
    } else if (response.data && response.data.fallback && response.data.fallback.images) {
      // Manejar el caso de fallback
      return {
        success: true,
        images: response.data.fallback.images,
        data: response.data
      };
    } else {
      // Respuesta válida pero sin imágenes
      return {
        success: false,
        error: 'No se generaron imágenes'
      };
    }
  } catch (error) {
    logger.error('Error al generar imágenes con Fal AI:', error);
    
    // Extraer mensaje de error
    let errorMessage = 'Error desconocido al generar imágenes';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.error || error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

/**
 * Genera audio utilizando la API de Fal AI a través de nuestro proxy
 * 
 * @param params Parámetros para la generación de audio
 * @returns Respuesta con la URL del audio generado o error
 */
export async function generateAudioWithFal(params: GenerateAudioParams): Promise<GeneratedAudioResult> {
  try {
    // Usar nuestro proxy para acceder a la API de Fal.AI para audio
    const response = await axios.post('/api/proxy/fal/generate-audio', {
      prompt: params.prompt,
      duration: params.duration || 10,
      model: params.model || 'musicgen',
      seed: params.seed || Math.floor(Math.random() * 1000000)
    });

    // Verificar si la respuesta contiene URL de audio
    if (response.data && response.data.audioUrl) {
      return {
        success: true,
        audioUrl: response.data.audioUrl
      };
    } else {
      // Respuesta válida pero sin audio
      return {
        success: false,
        error: 'No se generó el audio'
      };
    }
  } catch (error) {
    logger.error('Error al generar audio con Fal AI:', error);
    
    // Extraer mensaje de error
    let errorMessage = 'Error desconocido al generar audio';
    if (axios.isAxiosError(error) && error.response) {
      errorMessage = error.response.data?.error || error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
    };
  }
}