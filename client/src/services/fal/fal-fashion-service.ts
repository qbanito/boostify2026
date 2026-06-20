/**
 * FAL Fashion Service
 * 
 * Servicio completo para Artist Fashion Studio usando FAL AI:
 * - Virtual Try-On de alta calidad
 * - Generación de diseños de ropa
 * - Video con Kling (artista modelando)
 * - Background removal
 */

import * as fal from "@fal-ai/serverless-client";

// Configurar FAL_KEY
fal.config({
  credentials: import.meta.env.VITE_FAL_KEY || ''
});

export interface FalTryOnParams {
  modelImage: string | File;
  clothingImage: string | File;
  category?: 'tops' | 'bottoms' | 'full-body';
  autoMask?: boolean;
  autoCrop?: boolean;
}

export interface FalTryOnResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
}

export interface FalGenerationParams {
  prompt: string;
  negativePrompt?: string;
  imageSize?: 'square_hd' | 'square' | 'portrait_4_3' | 'portrait_16_9' | 'landscape_4_3' | 'landscape_16_9';
  numImages?: number;
  style?: string;
}

export interface FalGenerationResult {
  success: boolean;
  images?: string[];
  error?: string;
}

export interface FalVideoParams {
  imageUrl: string;
  prompt: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface FalVideoResult {
  success: boolean;
  videoUrl?: string;
  thumbnailUrl?: string;
  taskId?: string;
  status?: 'processing' | 'completed' | 'failed';
  error?: string;
}

export class FalFashionService {
  /**
   * Virtual Try-On de alta calidad con FAL IDM-VTON
   */
  async virtualTryOn(params: FalTryOnParams): Promise<FalTryOnResult> {
    try {
      console.log('🎨 Iniciando Virtual Try-On con FAL...');

      const result: any = await fal.subscribe("fal-ai/idm-vton", {
        input: {
          human_image_url: params.modelImage,
          garment_image_url: params.clothingImage,
          category: params.category || 'tops',
          auto_mask: params.autoMask !== false,
          auto_crop: params.autoCrop !== false,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log('⏳ Try-On en progreso...');
          }
        },
      });

      if (result.image && result.image.url) {
        console.log('✅ Try-On completado exitosamente');
        return {
          success: true,
          imageUrl: result.image.url
        };
      }

      return {
        success: false,
        error: 'No se generó imagen en el resultado'
      };

    } catch (error: any) {
      console.error('❌ Error en Virtual Try-On:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido en Try-On'
      };
    }
  }

  /**
   * Generación de diseños de ropa con FLUX
   */
  async generateFashionDesign(params: FalGenerationParams): Promise<FalGenerationResult> {
    try {
      console.log('✨ Generando diseño de moda con FLUX...');

      const result: any = await fal.subscribe("fal-ai/nano-banana-2", {
        input: {
          prompt: params.prompt,
          negative_prompt: params.negativePrompt || 'blurry, low quality, deformed, ugly',
          image_size: params.imageSize || 'square_hd',
          num_images: params.numImages || 1,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log('⏳ Generación en progreso...');
          }
        },
      });

      if (result.images && result.images.length > 0) {
        console.log('✅ Diseño generado exitosamente');
        const imageUrls = result.images.map((img: any) => img.url);
        return {
          success: true,
          images: imageUrls
        };
      }

      return {
        success: false,
        error: 'No se generaron imágenes'
      };

    } catch (error: any) {
      console.error('❌ Error generando diseño:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido en generación'
      };
    }
  }

  /**
   * Generación de video con Kling mostrando al artista modelando ropa
   * ¡NUEVO! Video AI con movimiento realista
   */
  async generateFashionVideo(params: FalVideoParams): Promise<FalVideoResult> {
    try {
      console.log('🎬 Generando video fashion con Kling...');

      const result: any = await fal.subscribe("fal-ai/kling-video/v1/standard/image-to-video", {
        input: {
          image_url: params.imageUrl,
          prompt: params.prompt,
          duration: params.duration || 5,
          aspect_ratio: params.aspectRatio || '16:9',
          cfg_scale: 0.5,
        },
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === "IN_PROGRESS") {
            console.log('⏳ Video en progreso... Esto puede tardar 2-3 minutos');
          }
        },
      });

      if (result.video && result.video.url) {
        console.log('✅ Video generado exitosamente');
        return {
          success: true,
          videoUrl: result.video.url,
          thumbnailUrl: result.video.thumbnail_url,
          status: 'completed'
        };
      }

      return {
        success: false,
        error: 'No se generó video en el resultado',
        status: 'failed'
      };

    } catch (error: any) {
      console.error('❌ Error generando video:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido en generación de video',
        status: 'failed'
      };
    }
  }

  /**
   * Remover fondo de imagen (útil para productos)
   */
  async removeBackground(imageUrl: string): Promise<FalTryOnResult> {
    try {
      console.log('🖼️ Removiendo fondo de imagen...');

      const result: any = await fal.subscribe("fal-ai/imageutils/rembg", {
        input: {
          image_url: imageUrl,
        },
        logs: true,
      });

      if (result.image && result.image.url) {
        console.log('✅ Fondo removido exitosamente');
        return {
          success: true,
          imageUrl: result.image.url
        };
      }

      return {
        success: false,
        error: 'No se procesó la imagen'
      };

    } catch (error: any) {
      console.error('❌ Error removiendo fondo:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Crear variaciones de una imagen de moda
   */
  async createVariations(imageUrl: string, prompt: string): Promise<FalGenerationResult> {
    try {
      console.log('🎨 Creando variaciones...');

      const result: any = await fal.subscribe("fal-ai/nano-banana-2/edit", {
        input: {
          prompt: `${prompt}, fashion variation, high quality`,
          image_url: imageUrl,
          strength: 0.75, // 75% similar a la original
          num_images: 4,
        },
        logs: true,
      });

      if (result.images && result.images.length > 0) {
        const imageUrls = result.images.map((img: any) => img.url);
        return {
          success: true,
          images: imageUrls
        };
      }

      return {
        success: false,
        error: 'No se generaron variaciones'
      };

    } catch (error: any) {
      console.error('❌ Error creando variaciones:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }

  /**
   * Upscale de imagen (mejorar calidad para impresión)
   */
  async upscaleImage(imageUrl: string): Promise<FalTryOnResult> {
    try {
      console.log('📈 Mejorando calidad de imagen...');

      const result: any = await fal.subscribe("fal-ai/clarity-upscaler", {
        input: {
          image_url: imageUrl,
        },
        logs: true,
      });

      if (result.image && result.image.url) {
        console.log('✅ Imagen mejorada exitosamente');
        return {
          success: true,
          imageUrl: result.image.url
        };
      }

      return {
        success: false,
        error: 'No se procesó la imagen'
      };

    } catch (error: any) {
      console.error('❌ Error mejorando imagen:', error);
      return {
        success: false,
        error: error.message || 'Error desconocido'
      };
    }
  }
}

// Exportar instancia única del servicio
export const falFashionService = new FalFashionService();
