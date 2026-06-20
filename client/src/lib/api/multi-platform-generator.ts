import axios from 'axios';
import { logger } from "../logger";
import { 
  freepikService, 
  FreepikModel, 
  FreepikAspectRatio, 
  FreepikBaseOptions,
  FreepikMysticOptions,
  FreepikImagen3Options,
  FreepikClassicOptions,
  FreepikFluxDevOptions,
  FreepikGenerationOptions
} from './freepik-service';

// Import Freepik storage service
import { freepikStorageService } from './freepik-storage-service';

// Import Flux service and storage
import { fluxService, FluxModel, FluxTaskType, FluxLoraType, FluxControlNetType } from './flux/flux-service';
import { fluxStorageService } from './flux/flux-storage-service';

import { 
  GenerateImageParams,
  VideoGenerationParams,
  ImageResult as ImportedImageResult,
  VideoResult as ImportedVideoResult, 
  ApiProvider,
  PiapiVideoModel,
  CameraMovementType
} from '../types/model-types';

// Re-export these interfaces so they can be imported from this module
export type ImageResult = ImportedImageResult;
export type VideoResult = ImportedVideoResult;

// Re-export Flux types
export { FluxModel, FluxTaskType, FluxLoraType, FluxControlNetType };

// Configuración para determinar si usar API directa o proxy de servidor
const useDirectApi = {
  freepik: false, // Usar proxy del servidor debido a restricciones CORS
  fal: false,     // Seguir usando proxy para Fal por ahora
  kling: false,   // Seguir usando proxy para Kling por ahora
  luma: false,    // Seguir usando proxy para Luma por ahora
  flux: false,    // Usar proxy del servidor por ahora
};

// Verificar si las claves API están disponibles en el cliente
function hasApiKey(provider: string): boolean {
  switch (provider) {
    case 'freepik':
      return !!import.meta.env.VITE_FREEPIK_KEY;
    case 'fal':
      return !!import.meta.env.VITE_FAL_KEY;
    case 'kling':
      return !!import.meta.env.VITE_KLING_API_KEY;
    case 'luma':
      return !!import.meta.env.VITE_LUMA_API_KEY;
    case 'flux':
      return !!import.meta.env.VITE_PIAPI_API_KEY;
    default:
      return false;
  }
}

/**
 * Generate image using Fal.ai through our server proxy
 * @param params Image generation parameters
 * @returns Promise with generated image result
 */
async function generateWithFal(params: Omit<GenerateImageParams, 'apiProvider'>): Promise<ImageResult> {
  try {
    const enhancedPrompt = enhancePrompt(params.prompt);
    
    // Utilizar el proxy del servidor en lugar de llamar directamente a Fal.ai
    const response = await axios.post(
      '/api/proxy/fal/generate-image',
      {
        prompt: enhancedPrompt,
        negativePrompt: params.negativePrompt || 'blurry, bad quality, distorted, disfigured',
        imageSize: params.imageSize || 'medium',
        imageCount: params.imageCount || 1
      }
    );

    if (response.data && response.data.images && response.data.images.length > 0) {
      return {
        url: response.data.images[0],
        provider: 'fal',
        requestId: response.data.request_id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    // Si no hay imágenes pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback && response.data.fallback.images) {
      return {
        url: response.data.fallback.images[0],
        provider: 'fal (fallback)',
        requestId: response.data.fallback.request_id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate image with Fal.ai');
  } catch (error) {
    logger.error('Error generating image with Fal.ai:', error);
    
    // No usamos fallback automático, solo informamos del error
    logger.info('Error en la generación de imagen con Fal.ai, se recomienda usar Freepik directamente');
    throw new Error('Image generation with Fal.ai failed. Please try again with Freepik.');
  }
}

/**
 * Generate image using Freepik API directly or through server proxy
 * @param params Image generation parameters
 * @returns Promise with generated image result
 */
async function generateWithFreepik(params: Omit<GenerateImageParams, 'apiProvider'>): Promise<ImageResult> {
  // Determinar si se debe usar la API directa o el proxy del servidor
  const shouldUseDirectApi = (params.useDirectApi !== undefined) 
    ? params.useDirectApi 
    : (useDirectApi.freepik && hasApiKey('freepik'));

  // Si tenemos la clave API y está configurado para usar API directo
  if (shouldUseDirectApi) {
    try {
      logger.info('Using direct Freepik API integration');
      
      // Convertir el aspect_ratio a formato de Freepik
      let aspect_ratio: 'square_1_1' | 'classic_4_3' | 'traditional_3_4' | 'widescreen_16_9' | 
                        'social_story_9_16' | 'smartphone_horizontal_20_9' | 'smartphone_vertical_9_20' | 
                        'standard_3_2' | 'portrait_2_3' | 'horizontal_2_1' | 'vertical_1_2' | 
                        'social_5_4' | 'social_post_4_5' = 'square_1_1'; // Default
      
      if (params.aspectRatio) {
        // Mapeo de formatos comunes
        const aspectRatioMap: Record<string, 'square_1_1' | 'classic_4_3' | 'traditional_3_4' | 'widescreen_16_9' | 
                                           'social_story_9_16' | 'smartphone_horizontal_20_9' | 'smartphone_vertical_9_20' | 
                                           'standard_3_2' | 'portrait_2_3' | 'horizontal_2_1' | 'vertical_1_2' | 
                                           'social_5_4' | 'social_post_4_5'> = {
          '1:1': 'square_1_1',
          '4:3': 'classic_4_3',
          '3:4': 'traditional_3_4',
          '16:9': 'widescreen_16_9',
          '9:16': 'social_story_9_16',
          '3:2': 'standard_3_2',
          '2:3': 'portrait_2_3',
          '2:1': 'horizontal_2_1',
          '1:2': 'vertical_1_2',
          '5:4': 'social_5_4',
          '4:5': 'social_post_4_5'
        };
        
        // Si el formato existe en el mapa, usa ese, de lo contrario usa el default
        if (params.aspectRatio in aspectRatioMap) {
          aspect_ratio = aspectRatioMap[params.aspectRatio as keyof typeof aspectRatioMap];
        }
      }
      
      // Determinar el modelo a utilizar
      const freepikModel = params.freepikModel || FreepikModel.MYSTIC;
      
      // Preparar opciones base para todos los modelos
      const baseOptions = {
        prompt: params.prompt,
        aspect_ratio
      };
      
      // Personalizar opciones según el modelo seleccionado
      let modelOptions;
      
      switch (freepikModel) {
        case FreepikModel.IMAGEN3:
          // Create a correctly typed Imagen3 options object
          const imagen3Options: FreepikImagen3Options = {
            ...baseOptions,
            num_images: params.imageCount || 1,
            // Extract style from prompt if present using style_preset instead of styling object
            style_preset: params.prompt.includes('style: ') ? params.prompt.split('style: ')[1].split(',')[0] : undefined,
            person_generation: 'allow_all',
            safety_settings: 'block_none'
          };
          
          modelOptions = imagen3Options;
          break;
          
        case FreepikModel.CLASSIC:
          // Create correctly typed Classic options object
          const classicOptions: FreepikClassicOptions = {
            ...baseOptions,
            negative_prompt: params.negativePrompt,
            guidance_scale: 1.2,
            num_images: params.imageCount || 1,
            seed: Math.floor(Math.random() * 1000000)
          };
          
          modelOptions = classicOptions;
          break;
          
        case FreepikModel.FLUX_DEV:
          // Make sure resolution value follows type constraints
          const fluxResolution: 'high' | 'medium' | 'low' = 
            params.imageSize === 'large' ? 'high' : 
            params.imageSize === 'small' ? 'low' : 'medium';
            
          // Create correctly typed FluxDev options object
          const fluxDevOptions: FreepikFluxDevOptions = {
            ...baseOptions,
            resolution: fluxResolution,
            // Extract style from prompt if present
            style_preset: params.prompt.includes('style: ') ? params.prompt.split('style: ')[1].split(',')[0] : undefined,
            seed: Math.floor(Math.random() * 100000000) + 1
          };
          
          modelOptions = fluxDevOptions;
          break;
          
        default: // MYSTIC
          // Convert general imageSize to Mystic-specific resolution
          const mysticResolution: '4k' | '2k' = (params.imageSize === 'large') ? '4k' : '2k';
          
          // Ensure engine value is correctly typed
          const mysticEngine: 'automatic' | 'magnific_illusio' | 'magnific_sharpy' | 'magnific_sparkle' = 'automatic';
          
          // Create correctly typed Mystic options object
          const mysticOptions: FreepikMysticOptions = {
            ...baseOptions,
            resolution: mysticResolution,
            realism: true,
            creative_detailing: 33,
            engine: mysticEngine,
            fixed_generation: false,
            filter_nsfw: true
          };
          
          modelOptions = mysticOptions;
      }
      
      // Usar nuestro servicio de cliente directo con el modelo seleccionado
      const response = await freepikService.generateImage(modelOptions, freepikModel);

      // La respuesta de Freepik es asíncrona, devuelve un task_id
      if (response.data && response.data.task_id) {
        // Para la primera llamada, no tenemos URL todavía, así que devolvemos un task_id
        // que se puede usar para verificar el estado más adelante
        const imageResult: ImageResult = {
          url: '', // URL estará vacía inicialmente
          provider: `freepik-${freepikModel}`,
          taskId: response.data.task_id,
          status: 'IN_PROGRESS',
          prompt: params.prompt,
          createdAt: new Date()
        };
        
        // Check if we already have this task ID in Firestore
        const existingImage = await freepikStorageService.findImageByTaskId(response.data.task_id);
        if (existingImage && existingImage.url) {
          logger.info('Found existing Freepik image in Firestore for task ID:', response.data.task_id);
          return existingImage;
        }
        
        // No existing image found, store the pending task
        try {
          const firestoreId = await freepikStorageService.saveImage(imageResult);
          return {
            ...imageResult,
            firestoreId
          };
        } catch (storageError) {
          logger.error('Error saving Freepik task to Firestore:', storageError);
          return imageResult;
        }
      }

      throw new Error(`Failed to start image generation with Freepik (${freepikModel})`);
    } catch (error) {
      logger.error('Error generating image with direct Freepik API:', error);
      // Si falla la API directa, intentamos con el proxy del servidor
      logger.info('Falling back to server proxy for Freepik');
    }
  }

  // Si no podemos usar la API directa o falló, usamos el proxy del servidor
  try {
    // Utilizar el proxy del servidor
    const response = await axios.post(
      '/api/proxy/freepik/generate-image',
      {
        prompt: params.prompt,
        negativePrompt: params.negativePrompt || '',
        aspectRatio: params.aspectRatio || '1:1',
        count: params.imageCount || 1
      }
    );

    if (response.data && response.data.images && response.data.images.length > 0) {
      return {
        url: response.data.images[0].url,
        provider: 'freepik',
        requestId: response.data.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    // Si no hay imágenes pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback && response.data.fallback.images) {
      return {
        url: response.data.fallback.images[0].url,
        provider: 'freepik (fallback)',
        requestId: response.data.fallback.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate image with Freepik');
  } catch (error) {
    logger.error('Error generating image with Freepik server proxy:', error);
    // Throw error - no fallback to Unsplash
    throw new Error('Image generation with Freepik failed. Please try again later.');
  }
}

/**
 * Generate image using Kling AI through our server proxy
 * @param params Image generation parameters
 * @returns Promise with generated image result
 */
async function generateWithKling(params: Omit<GenerateImageParams, 'apiProvider'>): Promise<ImageResult> {
  try {
    // Utilizar el proxy del servidor en lugar de llamar directamente a Kling
    const response = await axios.post(
      '/api/proxy/kling/generate-image',
      {
        prompt: params.prompt,
        negative_prompt: params.negativePrompt || '',
        size: params.imageSize || 'medium',
        n: params.imageCount || 1
      }
    );

    if (response.data && response.data.data && response.data.data.length > 0) {
      return {
        url: response.data.data[0].url,
        provider: 'kling',
        requestId: response.data.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    // Si no hay imágenes pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback && response.data.fallback.data) {
      return {
        url: response.data.fallback.data[0].url,
        provider: 'kling (fallback)',
        requestId: response.data.fallback.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate image with Kling');
  } catch (error) {
    logger.error('Error generating image with Kling:', error);
    // No usamos fallback automático, solo informamos del error
    throw new Error('Image generation with Kling failed. Please use Freepik directly for better results.');
  }
}

/**
 * Generate video using Luma API through our server proxy
 * @param params Video generation parameters
 * @returns Promise with generated video result
 */
async function generateVideoWithLuma(params: Omit<VideoGenerationParams, 'apiProvider'>): Promise<VideoResult> {
  try {
    // Utilizar el proxy del servidor en lugar de llamar directamente a Luma
    const response = await axios.post(
      '/api/proxy/luma/generate-video',
      {
        prompt: params.prompt,
        duration: params.duration || 5,
        style: params.style || 'cinematic'
      }
    );

    if (response.data && response.data.id) {
      // Si tenemos respuesta con ID y posiblemente URL
      return {
        url: response.data.output?.url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        provider: 'luma',
        requestId: response.data.id,
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    // Si no hay ID pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback) {
      return {
        url: response.data.fallback.output?.url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        provider: 'luma (fallback)',
        requestId: response.data.fallback.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate video with Luma');
  } catch (error) {
    logger.error('Error generating video with Luma:', error);
    // Fallback garantizado para demos
    return {
      url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      provider: 'luma (error fallback)',
      prompt: params.prompt,
      createdAt: new Date()
    };
  }
}

/**
 * Generate image using Flux API through our server proxy
 * @param params Image generation parameters
 * @returns Promise with generated image result
 */
async function generateWithFlux(params: Omit<GenerateImageParams, 'apiProvider'>): Promise<ImageResult> {
  try {
    // Preparar los parámetros para la solicitud
    const requestParams = {
      prompt: params.prompt,
      modelType: params.fluxModel || 'Qubico/flux1-dev', // Modelo predeterminado
      loraType: params.loraType,
      loraStrength: params.loraStrength,
      controlNetType: params.controlNetType,
      controlNetImage: params.controlNetImage,
      controlNetStrength: params.controlNetStrength,
      negativePrompt: params.negativePrompt || 'blurry, bad quality, distorted, disfigured'
    };

    // Utilizar el proxy del servidor para la generación
    const response = await axios.post(
      '/api/flux/generate-image',
      requestParams
    );

    if (response.data && response.data.task_id) {
      // Para la primera llamada, no tenemos URL todavía, así que devolvemos un task_id
      // que se puede usar para verificar el estado más tarde
      const imageResult: ImageResult = {
        url: '', // URL estará vacía inicialmente
        provider: `flux-${params.fluxModel || 'default'}`,
        taskId: response.data.task_id,
        status: 'IN_PROGRESS',
        prompt: params.prompt,
        createdAt: new Date()
      };
      
      // Guardar el resultado pendiente en Firestore usando fluxStorageService
      try {
        const firestoreId = await fluxStorageService.saveImage(imageResult);
        return {
          ...imageResult,
          firestoreId
        };
      } catch (storageError) {
        logger.error('Error saving Flux task to Firestore:', storageError);
        return imageResult;
      }
    }

    // Si no hay task_id pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback) {
      return {
        url: response.data.fallback.url || '',
        provider: 'flux (fallback)',
        requestId: response.data.fallback.task_id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate image with Flux');
  } catch (error) {
    logger.error('Error generating image with Flux:', error);
    // No usamos fallback automático, solo informamos del error
    throw new Error('Image generation with Flux failed. Please try again later or use a different provider.');
  }
}

/**
 * Generate video using Kling API through our server proxy
 * @param params Video generation parameters
 * @returns Promise with generated video result
 */
async function generateVideoWithKling(params: Omit<VideoGenerationParams, 'apiProvider'>): Promise<VideoResult> {
  try {
    // Utilizar el proxy del servidor en lugar de llamar directamente a Kling
    const response = await axios.post(
      '/api/proxy/kling/generate-video',
      {
        prompt: params.prompt,
        duration: params.duration || 5,
        style: params.style || 'realistic'
      }
    );

    if (response.data && response.data.id) {
      return {
        url: response.data.output?.url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        provider: 'kling',
        requestId: response.data.id,
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    // Si no hay ID pero hay un fallback, utiliza el fallback
    if (response.data && response.data.fallback) {
      return {
        url: response.data.fallback.output?.url || 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        provider: 'kling (fallback)',
        requestId: response.data.fallback.id || '',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }

    throw new Error('Failed to generate video with Kling');
  } catch (error) {
    logger.error('Error generating video with Kling:', error);
    // Fallback garantizado para demos
    return {
      url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      provider: 'kling (error fallback)',
      prompt: params.prompt,
      createdAt: new Date()
    };
  }
}

/**
 * Enhance prompt with additional details for better results
 * @param originalPrompt Original prompt from user
 * @returns Enhanced prompt for better generation results
 */
function enhancePrompt(originalPrompt: string): string {
  if (originalPrompt.includes('detailed instructions:')) {
    return originalPrompt;
  }
  
  // Add quality boosters and details if not already present
  return `${originalPrompt}, high quality, detailed, 4k, professional photography, masterpiece`;
}

/**
 * Generate image using specified provider
 * @param params Generation parameters including provider selection
 * @returns Promise with generated image result
 */
/**
 * Generates an image using the specified provider (Freepik or Flux)
 * Ensures Firestore integration for storage and retrieval
 * 
 * @param params Generation parameters including provider selection
 * @returns Promise with the generated image result
 */
export async function generateImage(params: GenerateImageParams): Promise<ImageResult> {
  // Determine provider to use based on params.apiProvider
  const apiProvider = params.apiProvider || 'freepik';
  logger.info(`Using ${apiProvider} for image generation`);
  
  // First check if we already have similar images in Firestore for the same prompt
  try {
    const existingImages = await freepikStorageService.getImages();
    
    // Look for completed images with the same or very similar prompt
    const similarImage = existingImages.find(img => 
      img.status === 'COMPLETED' && 
      img.url && 
      img.prompt && 
      img.prompt.toLowerCase().includes(params.prompt.toLowerCase().slice(0, 15))
    );
    
    if (similarImage) {
      logger.info(`Found similar existing image in Firestore: ${similarImage.provider}`, similarImage);
      return similarImage;
    }
  } catch (error) {
    logger.error('Error searching existing images in Firestore:', error);
    // Continue with generation if search fails
  }
  
  // Generate new image with the specified provider
  // Extraemos apiProvider para todos los casos y evitar pasarlo a las funciones de generación
  const { apiProvider: _, ...cleanParams } = params;
  
  switch (apiProvider) {
    case 'flux':
      return generateWithFlux(cleanParams);
    case 'fal':
      return generateWithFal(cleanParams);
    case 'kling':
      return generateWithKling(cleanParams);
    case 'freepik':
    default:
      return generateWithFreepik(cleanParams);
  }
}

/**
 * Generate video using specified provider
 * @param params Generation parameters including provider selection
 * @returns Promise with generated video result
 */
/**
 * Generate video using PiAPI/Hailuo API through our server proxy
 * @param params Video generation parameters specific to PiAPI
 * @returns Promise with generated video result
 */
/**
 * Generate video using PiAPI service with direct integration
 * Uses the new simplified endpoint that accesses PiAPI directly
 * @param params Video generation parameters
 * @returns Promise with generated video result
 */
async function generateVideoWithPiAPI(params: Omit<VideoGenerationParams, 'apiProvider'>): Promise<VideoResult> {
  try {
    // Determinar el modelo a utilizar
    const model = params.piapiModel || PiapiVideoModel.T2V_01_DIRECTOR;
    
    // Preparar los parámetros base con enfoque simplificado
    const requestParams: any = {
      prompt: params.prompt,
      model: model
    };
    
    // Si hay movimientos de cámara y es el modelo director, prepararlos
    if (model === PiapiVideoModel.T2V_01_DIRECTOR && params.cameraMovements && params.cameraMovements.length > 0) {
      // Máximo 3 movimientos de cámara
      const cameraMovements = params.cameraMovements.slice(0, 3);
      
      // Si incluye Static shot, no debería tener otros movimientos
      if (cameraMovements.includes('Static shot' as any) && cameraMovements.length > 1) {
        logger.warn('Static shot es mutuamente exclusivo con otros movimientos de cámara. Solo se usará Static shot.');
        requestParams.camera_movement = ['Static shot'];
      } else {
        // Ahora pasamos el array directamente, la API se encargará de formatearlo
        requestParams.camera_movement = cameraMovements;
      }
    }
    
    // Si es un modelo que requiere imagen, incluirla
    if ([PiapiVideoModel.I2V_01, PiapiVideoModel.I2V_01_LIVE, PiapiVideoModel.S2V_01].includes(model as PiapiVideoModel) && params.image_url) {
      requestParams.image_url = params.image_url;
    }
    
    // Llamar al endpoint de generación directa con el modelo axios simplificado
    logger.info('Llamando al nuevo endpoint directo de video con parámetros:', requestParams);
    const response = await axios.post(
      '/api/video-generation/generate',
      requestParams
    );

    // Verificar si tenemos un taskId
    if (response.data && response.data.success && response.data.taskId) {
      const taskId = response.data.taskId;
      
      logger.info('✅ Generación iniciada correctamente con el endpoint directo. TaskId:', taskId);
      
      // Devolver el resultado inicial (sin URL todavía)
      return {
        url: '', // URL se obtendrá después al verificar el estado
        provider: `piapi-direct-${model}`,
        taskId: taskId,
        status: 'processing',
        prompt: params.prompt,
        createdAt: new Date()
      };
    }
    
    throw new Error('Failed to start video generation with direct PiAPI endpoint');
  } catch (error) {
    logger.error('Error en generación de video con endpoint directo:', error);
    
    // Fallback para demos
    return {
      url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      provider: 'piapi-direct (error fallback)',
      prompt: params.prompt,
      createdAt: new Date()
    };
  }
}

/**
 * Check status of a PiAPI video generation task
 * This function polls the status endpoint until the video is ready
 * @param taskId The task ID returned from the initial request
 * @returns Promise resolving to the result with video URL when ready
 */
/**
 * Check status of a PiAPI video generation task using the direct implementation
 * This function polls the status endpoint until the video is ready
 * @param taskId The task ID returned from the initial request
 * @returns Promise resolving to the result with video URL when ready
 */
export async function checkPiapiVideoStatus(taskId: string): Promise<VideoResult | null> {
  try {
    // Llamar al nuevo endpoint directo de status
    const response = await axios.get(`/api/video-generation/status/${taskId}`);
    
    logger.info('Respuesta del endpoint directo de status:', response.data);
    
    // Si la tarea se completó correctamente
    if (response.data && response.data.success && response.data.status === 'completed') {
      return {
        url: response.data.result.url,
        provider: 'piapi-direct',
        taskId: taskId,
        status: 'completed',
        prompt: '', // No tenemos el prompt original aquí
        createdAt: new Date()
      };
    }
    
    // Si todavía está procesando, devolvemos objeto de procesamiento con progreso
    if (response.data && response.data.success && ['processing', 'pending'].includes(response.data.status)) {
      return {
        url: '',
        provider: 'piapi-direct',
        taskId: taskId,
        status: 'processing',
        prompt: '', // No tenemos el prompt original aquí
        progress: response.data.progress || 0,
        createdAt: new Date()
      };
    }
    
    // Si falló, lanzamos error
    if (response.data && !response.data.success) {
      throw new Error(response.data.error || 'Failed to generate video with PiAPI direct endpoint');
    }
    
    // Si no se pudo determinar el estado, devolvemos null para seguir intentando
    return null;
  } catch (error) {
    logger.error('Error checking PiAPI direct video status:', error);
    return null;
  }
}

export async function generateVideo(params: VideoGenerationParams): Promise<VideoResult> {
  switch (params.apiProvider) {
    case 'luma':
      return generateVideoWithLuma(params);
    case 'kling':
      return generateVideoWithKling(params);
    case 'piapi':
      return generateVideoWithPiAPI(params);
    default:
      // Si no se especifica un proveedor válido, usamos PiAPI para t2v-01-director si tiene cameraMovements
      if (params.cameraMovements && params.cameraMovements.length > 0) {
        return generateVideoWithPiAPI({
          ...params,
          piapiModel: PiapiVideoModel.T2V_01_DIRECTOR
        });
      }
      // De lo contrario, usamos Luma como fallback
      return generateVideoWithLuma(params);
  }
}

/**
 * Save generated content to Firestore for later retrieval
 * @param result Generation result (image or video)
 * @param contentType Type of content (image or video)
 * @returns Promise resolving to the ID of the saved record
 */
export async function saveGeneratedContent(
  result: ImageResult | VideoResult, 
  contentType: 'image' | 'video'
): Promise<string> {
  try {
    // Si el resultado ya tiene un ID, simplemente lo devolvemos
    if ('firestoreId' in result && result.firestoreId) {
      return result.firestoreId;
    }
    
    // Usamos las funciones específicas de cada tipo de contenido
    if (contentType === 'image') {
      // Check if this is a Freepik image
      if (result.provider === 'freepik' || result.provider?.startsWith('freepik-')) {
        // Use our specialized Freepik storage service
        logger.info('Using dedicated Freepik storage service for image');
        return await freepikStorageService.saveImage(result as ImageResult);
      } else {
        // Use general storage for non-Freepik images (should not happen with our implementation)
        logger.warn('Using general storage for non-Freepik image');
        const { saveGeneratedImage } = await import('./generated-images-service');
        return await saveGeneratedImage(result as ImageResult);
      }
    } else {
      // For videos, use the standard video storage
      const { saveGeneratedVideo } = await import('./generated-images-service');
      return await saveGeneratedVideo(result as VideoResult);
    }
  } catch (error) {
    logger.error(`Error saving generated ${contentType}:`, error);
    // Devolvemos un ID temporal en caso de error para que la UI siga funcionando
    return `generated-${contentType}-${Date.now()}`;
  }
}

/**
 * Verifica el estado de una tarea asíncrona y obtiene el resultado cuando está listo
 * @param taskId ID de la tarea a verificar
 * @param provider Proveedor de la API utilizada
 * @returns Promise con el resultado de la tarea
 */
export async function checkTaskStatus(taskId: string, provider: string): Promise<ImageResult | VideoResult | null> {
  try {
    // First check in Firestore for provider-specific images
    if (provider === 'freepik' || provider.startsWith('freepik-')) {
      // Try to find the existing image in Firestore
      const existingImage = await freepikStorageService.findImageByTaskId(taskId);
      
      // If the image is already completed in Firestore, return it directly
      if (existingImage && existingImage.url && existingImage.status === 'COMPLETED') {
        logger.info('Found completed Freepik image in Firestore:', existingImage);
        return existingImage;
      }
    } else if (provider === 'flux' || provider.startsWith('flux-')) {
      // Try to find the existing Flux image in Firestore
      const existingImage = await fluxStorageService.findImageByTaskId(taskId);
      
      // If the image is already completed in Firestore, return it directly
      if (existingImage && existingImage.url && existingImage.status === 'COMPLETED') {
        logger.info('Found completed Flux image in Firestore:', existingImage);
        return existingImage;
      }
    }
    
    // Determinar si se debe usar la API directa o el proxy del servidor
    const shouldUseDirectApi = useDirectApi[provider as keyof typeof useDirectApi] && hasApiKey(provider);

    if (provider === 'freepik' && shouldUseDirectApi) {
      // Usar API directa para Freepik
      const response = await freepikService.checkTaskStatus(taskId);
      
      if (response.data) {
        if (response.data.status === 'COMPLETED' && response.data.generated && response.data.generated.length > 0) {
          // Verificar el formato de los datos generados
          let imageUrl = '';
          if (typeof response.data.generated[0] === 'string') {
            imageUrl = response.data.generated[0];
          } else if (response.data.generated[0] && response.data.generated[0].url) {
            imageUrl = response.data.generated[0].url;
          }
          
          logger.info("Freepik direct API URL:", imageUrl);
          
          const completedImage: ImageResult = {
            url: imageUrl,
            provider: 'freepik',
            taskId: taskId,
            status: 'COMPLETED',
            prompt: '',  // No tenemos el prompt en esta respuesta
            createdAt: new Date()
          };
          
          // Store completed image in Firestore for future reference
          try {
            const firestoreId = await freepikStorageService.saveImage(completedImage);
            return {
              ...completedImage,
              firestoreId
            };
          } catch (storageError) {
            logger.error('Error saving completed Freepik image to Firestore:', storageError);
            return completedImage;
          }
        } else if (response.data.status === 'FAILED') {
          throw new Error('Task failed at Freepik');
        } else {
          // Todavía en progreso
          return {
            url: '',
            provider: 'freepik (processing)',
            taskId: taskId,
            status: response.data.status,
            prompt: '',
            createdAt: new Date()
          };
        }
      }
    } else {
      // Usar proxy del servidor para otros proveedores o si no hay clave API
      // Determinar el endpoint correcto según el proveedor
      let endpoint;
      if (provider === 'freepik') {
        endpoint = `/api/proxy/freepik/task/${taskId}`;
      } else if (provider === 'piapi' || provider.startsWith('piapi-')) {
        // Para PiAPI usamos el nuevo endpoint directo
        endpoint = `/api/video-generation/status/${taskId}`;
      } else if (provider === 'piapi-direct' || provider.startsWith('piapi-direct-')) {
        // Para PiAPI directo usamos el nuevo endpoint directo
        endpoint = `/api/video-generation/status/${taskId}`;
      } else {
        endpoint = `/api/proxy/${provider}/task-status/${taskId}`;
      }
      logger.info(`Verificando estado de tarea con ${provider} usando: ${endpoint}`);
      const response = await axios.get(endpoint);
      
      if (response.data) {
        if (response.data.status === 'COMPLETED' || response.data.status === 'completed') {
          // El formato de la respuesta depende del proveedor
          let result: ImageResult | VideoResult = {
            url: '',
            provider,
            taskId,
            status: 'COMPLETED',
            prompt: '',
            createdAt: new Date()
          };
          
          // Tratar diferentes formatos de respuesta según el proveedor
          if (provider === 'freepik') {
            // Manejo especial para Freepik, que puede tener la respuesta anidada en data
            const freepikData = response.data.data || response.data;
            if (freepikData.generated && freepikData.generated.length > 0) {
              // Si es un string, usarlo directamente
              if (typeof freepikData.generated[0] === 'string') {
                result.url = freepikData.generated[0];
              } 
              // Si es un objeto con url, usar esa propiedad
              else if (freepikData.generated[0] && freepikData.generated[0].url) {
                result.url = freepikData.generated[0].url;
              }
              // Si no se cumple ninguna de las anteriores, usar el valor tal cual (podría ser una URL)
              else if (freepikData.generated[0]) {
                result.url = freepikData.generated[0];
              }
              logger.info("Freepik image URL:", result.url);
              
              // If we have a URL, store in Firestore
              if (result.url) {
                // Update completed image status
                result.status = 'COMPLETED';
                
                // Store in Firestore for persistence and future retrieval
                try {
                  const firestoreId = await freepikStorageService.saveImage(result);
                  result.firestoreId = firestoreId;
                } catch (storageError) {
                  logger.error('Error saving Freepik proxy image to Firestore:', storageError);
                }
              }
            }
          } else if (provider === 'kling' && response.data.data) {
            result.url = response.data.data[0]?.url || '';
          } else if ((provider === 'luma' || provider === 'kling') && response.data.output) {
            result.url = response.data.output.url || '';
          } else if (provider === 'piapi-direct' || provider.startsWith('piapi-direct-')) {
            // Manejo específico para el endpoint directo de PiAPI
            if (response.data.result && response.data.result.url) {
              result.url = response.data.result.url;
              logger.info("PiAPI Direct video URL:", result.url);
            }
          } else if (provider === 'flux' || provider.startsWith('flux-')) {
            // Manejo especial para PiAPI Flux
            if (response.data.images && response.data.images.length > 0) {
              // Formato estándar para Flux es un array de imágenes en base64 o URLs
              result.url = response.data.images[0];
            } else if (response.data.url) {
              // Posible formato alternativo
              result.url = response.data.url;
            } else if (response.data.result && response.data.result.images) {
              // Otro formato posible, dependiendo de la respuesta de la API
              result.url = response.data.result.images[0];
            }
            
            // If we have a URL, store in Firestore using the Flux specific service
            if (result.url) {
              // Update completed image status
              result.status = 'COMPLETED';
              
              // Store in Firestore for persistence and future retrieval
              try {
                const firestoreId = await fluxStorageService.saveImage(result);
                result.firestoreId = firestoreId;
              } catch (storageError) {
                logger.error('Error saving Flux image to Firestore:', storageError);
              }
            }
          }
          
          return result;
        } else if (response.data.status === 'FAILED' || response.data.status === 'failed') {
          throw new Error(`Task failed at ${provider}`);
        } else {
          // Todavía en progreso
          return {
            url: '',
            provider: `${provider} (processing)`,
            taskId: taskId,
            status: response.data.status,
            prompt: '',
            createdAt: new Date()
          };
        }
      }
    }
    
    return null;
  } catch (error) {
    logger.error(`Error checking task status for ${provider}:`, error);
    return null;
  }
}

/**
 * Multi-platform content generator service
 */
export const multiPlatformGenerator = {
  generateImage,
  generateVideo,
  saveGeneratedContent,
  checkTaskStatus
};