/**
 * Rutas para generación de imágenes con FAL AI Nano Banana
 * Migrado de Gemini a FAL para mayor eficiencia y consistencia
 * Mantiene la misma API para compatibilidad con el resto del sistema
 */
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { 
  generateImageWithNanoBanana, 
  editImageWithNanoBanana,
  type FalImageResult,
  type NanoBananaAspectRatio
} from '../services/fal-service';

const router = Router();

// Función helper para generar imagen cinematográfica (reemplaza generateCinematicImage)
async function generateCinematicImage(prompt: string, aspectRatio: NanoBananaAspectRatio = '16:9'): Promise<FalImageResult> {
  const cinematicPrompt = `Cinematic professional shot: ${prompt}. High quality, studio lighting, professional photography.`;
  return generateImageWithNanoBanana(cinematicPrompt, { aspectRatio });
}

// Función helper para generar con referencias (reemplaza generateImageWithMultipleFaceReferences)
async function generateWithFaceReferences(prompt: string, referenceImages: string[]): Promise<FalImageResult> {
  if (referenceImages.length === 0) {
    return generateImageWithNanoBanana(prompt);
  }
  return editImageWithNanoBanana(referenceImages, prompt);
}

/**
 * Edita una imagen existente con instrucciones específicas
 */
router.post('/edit-image', async (req: Request, res: Response) => {
  try {
    const { imageUrl, editInstructions, originalPrompt } = req.body;
    
    if (!imageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una imagen (imageUrl)'
      });
    }
    
    if (!editInstructions) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren instrucciones de edición (editInstructions)'
      });
    }
    
    console.log(`✏️ Editando imagen con FAL nano-banana: ${editInstructions.substring(0, 100)}...`);
    
    const result = await editImageWithNanoBanana([imageUrl], editInstructions);
    
    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error al editar imagen'
      });
    }
    
    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      prompt: editInstructions,
      provider: 'fal-nano-banana'
    });
  } catch (error: any) {
    console.error('Error en /edit-image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al editar imagen'
    });
  }
});

/**
 * Genera una imagen simple desde un prompt
 * Opcionalmente acepta imágenes de referencia para mantener identidad facial
 */
router.post('/generate-simple', async (req: Request, res: Response) => {
  try {
    const { prompt, referenceImages, seed } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt'
      });
    }
    
    // Si hay imágenes de referencia, usar la función con múltiples referencias
    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      console.log(`🎨 Generando imagen con FAL nano-banana + ${referenceImages.length} referencias`);
      const result = await generateWithFaceReferences(prompt, referenceImages);
      return res.json(result);
    }
    
    // Sin referencias, usar generación simple
    console.log('🎨 Generando imagen con FAL nano-banana');
    const result = await generateImageWithNanoBanana(prompt);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error en /generate-simple:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imagen'
    });
  }
});

/**
 * Genera una imagen desde una escena cinematográfica completa
 */
router.post('/generate-scene', async (req: Request, res: Response) => {
  try {
    const scene = req.body;
    
    if (!scene.scene || !scene.camera || !scene.lighting || !scene.style || !scene.movement) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren todos los campos de la escena cinematográfica'
      });
    }
    
    // Construir prompt desde la escena
    const scenePrompt = `${scene.scene}. Camera: ${scene.camera}. Lighting: ${scene.lighting}. Style: ${scene.style}. Movement: ${scene.movement}. ${scene.emotion || ''} ${scene.colorGrading || ''}`;
    const result = await generateCinematicImage(scenePrompt);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error en /generate-scene:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imagen'
    });
  }
});

/**
 * Genera múltiples imágenes en lote
 */
router.post('/generate-batch', async (req: Request, res: Response) => {
  try {
    const { scenes } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de escenas'
      });
    }
    
    const resultsObj: Record<number, any> = {};
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const scenePrompt = `${scene.scene}. Camera: ${scene.camera}. Lighting: ${scene.lighting}. Style: ${scene.style}.`;
      const result = await generateImageWithNanoBanana(scenePrompt);
      resultsObj[i] = result;
    }
    
    return res.json({
      success: true,
      results: resultsObj
    });
  } catch (error: any) {
    console.error('Error en /generate-batch:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imágenes'
    });
  }
});

/**
 * Genera una imagen adaptando rostro de imagen de referencia
 */
router.post('/generate-with-face', async (req: Request, res: Response) => {
  try {
    const { prompt, referenceImageBase64 } = req.body;
    
    if (!prompt || !referenceImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere prompt y referenceImageBase64'
      });
    }
    
    const result = await editImageWithNanoBanana([referenceImageBase64], prompt);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error en /generate-with-face:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imagen con rostro'
    });
  }
});

// Nuevo endpoint para generar UNA imagen con MÚLTIPLES referencias faciales
router.post('/generate-single-with-multiple-faces', async (req: Request, res: Response) => {
  try {
    const { prompt, referenceImagesBase64, seed, scene, sceneId } = req.body;

    if (!prompt || !referenceImagesBase64 || !Array.isArray(referenceImagesBase64)) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren "prompt" y "referenceImagesBase64" (array)'
      });
    }

    console.log(`🎬 Generando imagen con FAL nano-banana + ${referenceImagesBase64.length} referencias`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Usar FAL nano-banana/edit para mantener referencias
    const result = await editImageWithNanoBanana(
      referenceImagesBase64.slice(0, 3), // Máximo 3 referencias
      prompt
    );

    if (result.success && result.imageUrl) {
      console.log('✅ Imagen generada con FAL nano-banana');
      return res.json({
        success: true,
        imageUrl: result.imageUrl,
        provider: 'fal-nano-banana'
      });
    }

    throw new Error(result.error || 'Error generando imagen');

  } catch (error: any) {
    console.error('Error generating single image with multiple faces:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error generando imagen'
    });
  }
});

/**
 * Genera múltiples imágenes en lote con referencia facial
 */
router.post('/generate-batch-with-face', async (req: Request, res: Response) => {
  try {
    const { scenes, referenceImageBase64 } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de escenas'
      });
    }
    
    if (!referenceImageBase64) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una imagen de referencia'
      });
    }
    
    const resultsObj: Record<number, any> = {};
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const scenePrompt = `${scene.scene}. Camera: ${scene.camera}. Lighting: ${scene.lighting}. Style: ${scene.style}.`;
      const result = await editImageWithNanoBanana([referenceImageBase64], scenePrompt);
      resultsObj[i] = result;
    }
    
    return res.json({
      success: true,
      results: resultsObj
    });
  } catch (error: any) {
    console.error('Error en /generate-batch-with-face:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imágenes con rostro'
    });
  }
});

/**
 * Genera múltiples imágenes en lote con MÚLTIPLES referencias faciales (hasta 3)
 * Ideal para videos musicales con consistencia facial usando varias fotos del artista
 */
router.post('/generate-batch-with-multiple-faces', async (req: Request, res: Response) => {
  try {
    const { scenes, referenceImagesBase64, useFallback = true } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de escenas'
      });
    }
    
    if (!referenceImagesBase64 || !Array.isArray(referenceImagesBase64) || referenceImagesBase64.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de imágenes de referencia (1-10 imágenes)'
      });
    }

    if (referenceImagesBase64.length > 10) {
      return res.status(400).json({
        success: false,
        error: 'Máximo 10 imágenes de referencia permitidas'
      });
    }
    
    console.log(`🎨 Generando ${scenes.length} escenas con FAL nano-banana + ${referenceImagesBase64.length} referencias`);
    
    const resultsObj: Record<number, any> = {};
    let successCount = 0;
    
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      const scenePrompt = `${scene.scene}. Camera: ${scene.camera}. Lighting: ${scene.lighting}. Style: ${scene.style}.`;
      const result = await editImageWithNanoBanana(
        referenceImagesBase64.slice(0, 3), 
        scenePrompt
      );
      resultsObj[i] = { ...result, provider: 'fal-nano-banana' };
      if (result.success) successCount++;
    }
    
    return res.json({
      success: true,
      results: resultsObj,
      totalScenes: scenes.length,
      totalReferences: referenceImagesBase64.length,
      successCount,
      quotaExceeded: false,
      geminiCount: 0,
      falCount: successCount,
      usedFallback: false,
      message: `Se generaron ${successCount}/${scenes.length} imágenes con FAL nano-banana.`
    });
  } catch (error: any) {
    console.error('Error en /generate-batch-with-multiple-faces:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imágenes con múltiples rostros'
    });
  }
});

/**
 * Genera Master Character con FAL Nano Banana
 * Combina análisis facial + generación de personaje consistente
 */
router.post('/generate-master-character', async (req: Request, res: Response) => {
  try {
    const { referenceImagesBase64, prompt, directorStyle } = req.body;

    if (!referenceImagesBase64 || !Array.isArray(referenceImagesBase64) || referenceImagesBase64.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren imágenes de referencia'
      });
    }

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt para el Master Character'
      });
    }

    console.log(`🎭 Generando Master Character con FAL Nano Banana`);
    console.log(`📸 Referencias: ${referenceImagesBase64.length}`);
    console.log(`🎬 Estilo: ${directorStyle || 'default'}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Construir prompt optimizado para Master Character
    const masterPrompt = `PROFESSIONAL MASTER CHARACTER PORTRAIT:

${prompt}

Style: ${directorStyle || 'cinematic'}

CRITICAL REQUIREMENTS:
- High-quality professional portrait
- Perfect facial consistency from reference images
- Maintain exact identity, features, and skin tone
- Cinematic lighting and composition
- Production-ready quality
- 8K resolution clarity`;

    // Generar con FAL nano-banana/edit usando múltiples referencias
    const result = await editImageWithNanoBanana(
      referenceImagesBase64.slice(0, 3),
      masterPrompt
    );

    if (!result.success) {
      console.error('❌ Error generando Master Character:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Error generando Master Character'
      });
    }

    console.log('✅ Master Character generado exitosamente con FAL Nano Banana');

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      provider: 'fal-nano-banana'
    });

  } catch (error: any) {
    console.error('❌ Error en /generate-master-character:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar Master Character'
    });
  }
});

/**
 * POST /api/gemini/generate-image
 * Genera imagen para escena del timeline respetando el guión JSON y referencias faciales
 * Ahora usa FAL nano-banana
 */
router.post('/generate-image', async (req: Request, res: Response) => {
  try {
    const { 
      prompt,
      referenceImages,
      sceneNumber,
      shotType,
      mood,
      cinematicStyle,
      directorStyle
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un prompt' 
      });
    }

    console.log(`🎬 [Timeline] Generando imagen para escena ${sceneNumber || '?'} con FAL nano-banana`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Si hay referencias faciales, usar edición para mantener consistencia
    if (referenceImages && Array.isArray(referenceImages) && referenceImages.length > 0) {
      console.log(`📸 Usando ${referenceImages.length} referencias faciales para consistencia`);
      
      const result = await editImageWithNanoBanana(
        referenceImages.slice(0, 3),
        prompt
      );

      if (result.success && result.imageUrl) {
        console.log(`✅ Imagen generada con referencias faciales`);
        return res.json({
          success: true,
          imageUrl: result.imageUrl,
          imageBase64: result.imageBase64,
          provider: 'fal-nano-banana',
          sceneNumber
        });
      }

      // Si falla con referencias, intentar sin ellas
      console.warn(`⚠️ Generación con referencias falló, intentando sin referencias...`);
    }

    // Generación simple (sin referencias o como fallback)
    const result = await generateImageWithNanoBanana(prompt);

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error generando imagen',
        sceneNumber
      });
    }

    console.log(`✅ Imagen generada para escena ${sceneNumber || '?'}`);
    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      provider: 'fal-nano-banana',
      sceneNumber
    });

  } catch (error: any) {
    console.error('❌ Error en /generate-image:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar imagen'
    });
  }
});

/**
 * Genera poster cinematográfico estilo Hollywood para un concepto
 */
router.post('/generate-hollywood-poster', async (req: Request, res: Response) => {
  try {
    const { conceptTitle, conceptDescription, artistReferenceImages, directorName } = req.body;

    if (!conceptTitle || !conceptDescription) {
      return res.status(400).json({
        success: false,
        error: 'Se requieren conceptTitle y conceptDescription'
      });
    }

    console.log(`🎬 Generando poster Hollywood con FAL nano-banana: "${conceptTitle}"`);

    // Construir prompt para poster
    const posterPrompt = `Hollywood movie poster for "${conceptTitle}": ${conceptDescription}. 
    Directed by ${directorName || 'Director'}. 
    Cinematic typography, dramatic lighting, professional movie poster composition, 
    2:3 vertical aspect ratio, high quality, theatrical release style.`;

    let result;
    
    if (artistReferenceImages && Array.isArray(artistReferenceImages) && artistReferenceImages.length > 0) {
      result = await editImageWithNanoBanana(
        artistReferenceImages.slice(0, 3),
        posterPrompt,
        { aspectRatio: '2:3' }
      );
    } else {
      result = await generateImageWithNanoBanana(posterPrompt, { aspectRatio: '2:3' });
    }

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error generando poster'
      });
    }

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      provider: 'fal-nano-banana'
    });

  } catch (error: any) {
    console.error('❌ Error en /generate-hollywood-poster:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar poster'
    });
  }
});

/**
 * Genera Casting Headshot para miembros del elenco
 * Usado por master-character-generator para generar headshots de casting
 */
router.post('/generate-casting-headshot', async (req: Request, res: Response) => {
  try {
    const { prompt, role } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt para el casting headshot'
      });
    }

    console.log(`🎬 Generando Casting Headshot con FAL Nano Banana`);
    console.log(`👤 Role: ${role || 'unknown'}`);
    console.log(`📝 Prompt: ${prompt.substring(0, 100)}...`);

    // Construir prompt optimizado para headshots de casting
    const headsthotPrompt = `PROFESSIONAL CASTING HEADSHOT:

${prompt}

CRITICAL REQUIREMENTS:
- Professional studio headshot
- Clean neutral/white background
- 3/4 or front-facing pose
- Professional wardrobe (black/neutral clothing)
- Cinematic studio lighting (key, fill, back light)
- Sharp focus on face
- 8K resolution photorealistic quality
- Movie production casting style`;

    // Generar con FAL nano-banana
    const result = await generateImageWithNanoBanana(headsthotPrompt, {
      aspectRatio: '1:1' // Square format for headshots
    });

    if (!result.success) {
      console.error('❌ Error generando Casting Headshot:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error || 'Error generando Casting Headshot'
      });
    }

    console.log(`✅ Casting Headshot generado exitosamente para role: ${role || 'unknown'}`);

    return res.json({
      success: true,
      imageUrl: result.imageUrl,
      imageBase64: result.imageBase64,
      role: role,
      provider: 'fal-nano-banana'
    });

  } catch (error: any) {
    console.error('❌ Error en /generate-casting-headshot:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al generar Casting Headshot'
    });
  }
});

export default router;
