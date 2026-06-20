import { Router } from 'express';
import { generateImageWithNanoBanana } from '../services/fal-service';
import { logger } from '../utils/logger';
import fetch from 'node-fetch';

const router = Router();

const CAMERA_ANGLES = [
  {
    id: 'close-up',
    name: 'Close-Up',
    emoji: '🔍',
    description: 'Extreme close-up shot, intimate detail',
    prompt: 'Close-up shot, tight framing on subject, shallow depth of field, intimate perspective, detailed facial features visible'
  },
  {
    id: 'wide',
    name: 'Wide Shot',
    emoji: '🌐',
    description: 'Wide establishing shot',
    prompt: 'Wide shot, full scene visible, establishing perspective, show environment and context, distant view'
  },
  {
    id: 'medium',
    name: 'Medium Shot',
    emoji: '👤',
    description: 'Medium framing',
    prompt: 'Medium shot, waist up framing, balanced composition, standard cinematic framing'
  },
  {
    id: 'low-angle',
    name: 'Low Angle (Jib)',
    emoji: '⬆️',
    description: 'Looking up at subject',
    prompt: 'Low angle shot, camera looking up from below, dramatic perspective, heroic framing, powerful composition'
  }
];

/**
 * Genera imagen con Nano Banana 2 (fal-ai/nano-banana-2)
 * Optimizado para cinematografía
 */
async function generateWithFLUXContext(prompt: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY;
  
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_KEY not configured' };
  }

  try {
    const response = await fetch('https://fal.run/fal-ai/nano-banana-2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
        num_inference_steps: 30,
        guidance_scale: 3.5,
        enable_safety_checker: false
      })
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error('FLUX API error:', error);
      return { success: false, error: `FLUX API error: ${response.status}` };
    }

    const result = await response.json() as any;
    
    if (result.images && result.images.length > 0) {
      return {
        success: true,
        imageUrl: result.images[0].url
      };
    }
    
    return { success: false, error: 'No images generated' };
  } catch (error: any) {
    logger.error('FLUX Context generation error:', error.message);
    return { success: false, error: error.message };
  }
}

router.post('/api/clips/generate-camera-angles', async (req, res) => {
  try {
    const { originalPrompt, clipId } = req.body;

    if (!originalPrompt) {
      return res.status(400).json({ 
        success: false, 
        error: 'Original prompt is required' 
      });
    }

    logger.log(`📷 Generating 4 camera angle variations for clip ${clipId}`);
    logger.log(`📝 Original prompt: ${originalPrompt.substring(0, 100)}...`);

    // Generate all 4 angles in parallel
    const generationPromises = CAMERA_ANGLES.map(async (angle) => {
      try {
        const enhancedPrompt = `${originalPrompt}

CAMERA ANGLE: ${angle.prompt}

CRITICAL INSTRUCTIONS:
- Keep the EXACT same scene, characters, mood, lighting, and setting
- ONLY change the camera angle and framing
- Maintain consistency with the original concept
- Use the camera angle to create visual variety while preserving the story`;

        logger.log(`📸 Generating ${angle.name} variation (FLUX Context first)...`);
        
        // INTENTO 1: FLUX Context (más rápido - 2x) 
        try {
          const fluxResult = await generateWithFLUXContext(enhancedPrompt);
          if (fluxResult.success && fluxResult.imageUrl) {
            logger.log(`✅ ${angle.name} generated with FLUX Context (fast!)`);
            return {
              angle: angle.id,
              name: angle.name,
              emoji: angle.emoji,
              success: true,
              imageUrl: fluxResult.imageUrl,
              prompt: enhancedPrompt,
              provider: 'flux-context'
            };
          }
        } catch (fluxError: any) {
          logger.warn(`⚠️ FLUX Context falló para ${angle.name}:`, fluxError.message);
          logger.log(`🔄 Intentando fallback con Gemini 2.5 Flash Image...`);
        }
        
        // INTENTO 2: Gemini 2.5 Flash Image (fallback)
        const result = await generateCinematicImage(enhancedPrompt);

        if (!result.success || !result.imageUrl) {
          logger.error(`❌ Failed to generate ${angle.name}:`, result.error);
          return {
            angle: angle.id,
            name: angle.name,
            emoji: angle.emoji,
            success: false,
            error: result.error || 'Generation failed',
            imageUrl: null
          };
        }

        logger.log(`✅ ${angle.name} generated with Gemini fallback`);
        
        return {
          angle: angle.id,
          name: angle.name,
          emoji: angle.emoji,
          success: true,
          imageUrl: result.imageUrl,
          prompt: enhancedPrompt,
          provider: 'gemini-fallback'
        };
      } catch (error: any) {
        logger.error(`❌ Error generating ${angle.name}:`, error);
        return {
          angle: angle.id,
          name: angle.name,
          emoji: angle.emoji,
          success: false,
          error: error.message,
          imageUrl: null
        };
      }
    });

    const variations = await Promise.all(generationPromises);

    const successCount = variations.filter(v => v.success).length;
    logger.log(`✅ Generated ${successCount}/4 camera angle variations`);

    res.json({
      success: true,
      variations,
      totalGenerated: successCount,
      clipId
    });
  } catch (error: any) {
    logger.error('Error generating camera angles:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message || 'Failed to generate camera angles' 
    });
  }
});

router.get('/api/clips/camera-angles/list', (req, res) => {
  res.json({
    success: true,
    angles: CAMERA_ANGLES
  });
});

export default router;
