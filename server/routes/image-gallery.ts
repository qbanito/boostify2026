/**
 * Rutas para gestión de galerías de imágenes de artista
 * Migrado a FAL nano-banana para mayor eficiencia
 */
import { Router, Request, Response } from 'express';
import { 
  generateImageWithNanoBanana, 
  editImageWithNanoBanana,
  type FalImageResult
} from '../services/fal-service';
import type { 
  CreateGalleryRequest, 
  GenerateImagesRequest,
  ImageGallery,
  GeneratedImage 
} from '../types/image-gallery';

const router = Router();

/**
 * Crea una nueva galería y genera 6 imágenes profesionales
 * Usa FAL nano-banana para mantener la identidad del artista
 */
router.post('/create-and-generate', async (req: Request, res: Response) => {
  try {
    const { 
      singleName, 
      artistName, 
      basePrompt, 
      styleInstructions, 
      referenceImages 
    }: CreateGalleryRequest = req.body;

    if (!singleName || !artistName || !referenceImages || referenceImages.length < 1) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere singleName, artistName y al menos 1 imagen de referencia'
      });
    }

    if (referenceImages.length > 3) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 3 imágenes de referencia permitidas'
      });
    }

    console.log(`🎨 Creando galería para "${singleName}" de ${artistName} con FAL nano-banana`);
    console.log(`📸 Referencias faciales: ${referenceImages.length}`);

    // Generar 6 variaciones de imágenes profesionales
    const imagePrompts = [
      `${basePrompt}. ${styleInstructions}. Close-up portrait shot, dramatic lighting, studio photography, looking at camera.`,
      `${basePrompt}. ${styleInstructions}. Medium shot, performing on stage with professional lighting, energetic atmosphere.`,
      `${basePrompt}. ${styleInstructions}. Full body shot, urban location, modern fashion, cinematic composition.`,
      `${basePrompt}. ${styleInstructions}. Artistic portrait with creative lighting, experimental angles, bold colors.`,
      `${basePrompt}. ${styleInstructions}. Lifestyle shot, natural setting, authentic moment, professional photography.`,
      `${basePrompt}. ${styleInstructions}. Editorial style photo, high fashion aesthetic, magazine quality, striking pose.`
    ];

    const generatedImages: GeneratedImage[] = [];
    let successCount = 0;

    // Generar las 6 imágenes en paralelo (en grupos de 3 para evitar rate limiting)
    const batchSize = 3;
    for (let batchStart = 0; batchStart < imagePrompts.length; batchStart += batchSize) {
      const batchEnd = Math.min(batchStart + batchSize, imagePrompts.length);
      const batchPromises = [];
      
      for (let i = batchStart; i < batchEnd; i++) {
        console.log(`📷 Iniciando generación de imagen ${i + 1}/6 con FAL nano-banana...`);
        
        batchPromises.push(
          (async () => {
            try {
              // Usar FAL nano-banana/edit para mantener referencias
              console.log(`🔄 Generando imagen ${i + 1} con FAL nano-banana...`);
              const result = await editImageWithNanoBanana(
                referenceImages.slice(0, 3),
                imagePrompts[i]
              );
              
              console.log(`📊 Resultado de FAL para imagen ${i + 1}:`, {
                success: result.success,
                hasImageUrl: !!result.imageUrl,
                error: result.error
              });

              if (result.success && result.imageUrl) {
                console.log(`✅ Imagen ${i + 1} generada exitosamente`);
                return {
                  index: i,
                  image: {
                    id: `img-${Date.now()}-${i}`,
                    url: result.imageUrl,
                    prompt: imagePrompts[i],
                    createdAt: new Date().toISOString(),
                    isVideo: false
                  }
                };
              } else {
                console.error(`❌ Error generando imagen ${i + 1}:`, result.error);
                console.error(`❌ Resultado completo:`, result);
                return null;
              }
            } catch (error: any) {
              console.error(`❌ Excepción generando imagen ${i + 1}:`, error.message);
              console.error(`❌ Stack:`, error.stack);
              return null;
            }
          })()
        );
      }
      
      // Esperar a que termine el batch actual
      const batchResults = await Promise.all(batchPromises);
      
      // Agregar imágenes exitosas al array
      for (const result of batchResults) {
        if (result && result.image) {
          generatedImages.push(result.image);
          successCount++;
        }
      }
      
      // Delay entre batches (excepto después del último)
      if (batchEnd < imagePrompts.length) {
        console.log(`⏸️ Pausa de 2 segundos antes del siguiente batch...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Ordenar las imágenes por su índice original
    generatedImages.sort((a, b) => {
      const indexA = parseInt(a.id.split('-').pop() || '0');
      const indexB = parseInt(b.id.split('-').pop() || '0');
      return indexA - indexB;
    });

    // Crear objeto de galería (será guardado en Firestore por el cliente)
    const gallery = {
      singleName,
      artistName,
      basePrompt,
      styleInstructions,
      referenceImageUrls: referenceImages,
      generatedImages,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isPublic: true
    };

    return res.json({
      success: true,
      gallery,
      successCount,
      totalImages: imagePrompts.length,
      message: `Se generaron ${successCount}/${imagePrompts.length} imágenes exitosamente`
    });

  } catch (error: any) {
    console.error('Error creating gallery:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al crear galería'
    });
  }
});

/**
 * Regenera una imagen específica de la galería
 * Usa FAL nano-banana para consistencia
 */
router.post('/regenerate-image', async (req: Request, res: Response) => {
  try {
    const { prompt, referenceImages } = req.body;

    if (!prompt || !referenceImages || referenceImages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere prompt y referenceImages'
      });
    }

    console.log('🔄 Regenerando imagen con FAL nano-banana...');

    // Usar FAL nano-banana/edit para regenerar con referencias
    const result = await editImageWithNanoBanana(
      referenceImages.slice(0, 3), 
      prompt
    );

    if (result.success && result.imageUrl) {
      return res.json({
        success: true,
        image: {
          id: `img-${Date.now()}`,
          url: result.imageUrl,
          prompt,
          createdAt: new Date().toISOString(),
          isVideo: false
        }
      });
    }

    return res.status(500).json({
      success: false,
      error: result.error || 'Error al regenerar imagen'
    });

  } catch (error: any) {
    console.error('Error regenerating image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al regenerar imagen'
    });
  }
});

/**
 * Convierte una imagen de la galería en video usando Gemini Video
 * TODO: Implementar cuando Gemini Video esté disponible
 */
router.post('/convert-to-video', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt } = req.body;

    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere imageUrl'
      });
    }

    // Por ahora retornar error, implementar cuando Gemini Video esté disponible
    return res.status(501).json({
      success: false,
      error: 'Conversión a video estará disponible próximamente'
    });

  } catch (error: any) {
    console.error('Error converting to video:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al convertir a video'
    });
  }
});

export default router;
