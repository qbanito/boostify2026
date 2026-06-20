import { Router, Request, Response } from 'express';
import * as minimaxService from '../services/minimax-service';

const router = Router();

/**
 * POST /api/minimax/video/generate
 * Generar video desde imagen usando MiniMax
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { imageUrl, prompt, model, duration, resolution } = req.body;
    
    if (!imageUrl || !prompt) {
      return res.status(400).json({
        error: 'imageUrl y prompt son requeridos'
      });
    }
    
    console.log(`🎬 Solicitud de generación de video MiniMax recibida`);
    console.log(`📸 Imagen: ${imageUrl}`);
    console.log(`📝 Prompt: ${prompt}`);
    
    const result = await minimaxService.generateImageToVideo({
      firstFrameImage: imageUrl,
      prompt,
      model,
      duration,
      resolution
    });
    
    if (!result.success) {
      return res.status(500).json({
        error: result.error
      });
    }
    
    res.json({
      success: true,
      taskId: result.taskId,
      message: 'Video generation started. Use /status endpoint to check progress.'
    });
    
  } catch (error: any) {
    console.error('❌ Error en endpoint de generación de video:', error);
    res.status(500).json({
      error: error.message || 'Error desconocido al generar video'
    });
  }
});

/**
 * GET /api/minimax/video/status/:taskId
 * Consultar estado de generación de video
 */
router.get('/status/:taskId', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    const result = await minimaxService.queryVideoTaskStatus(taskId);
    
    res.json(result);
    
  } catch (error: any) {
    console.error('❌ Error consultando estado de video:', error);
    res.status(500).json({
      error: error.message || 'Error desconocido al consultar estado'
    });
  }
});

/**
 * POST /api/minimax/video/generate-batch
 * Generar múltiples videos en batch (para music videos)
 */
router.post('/generate-batch', async (req: Request, res: Response) => {
  try {
    const { scenes, model, resolution } = req.body;
    
    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return res.status(400).json({
        error: 'scenes array es requerido y debe tener al menos 1 escena'
      });
    }
    
    console.log(`🎬 Solicitud de generación batch: ${scenes.length} videos`);
    
    // Iniciar generación en background y retornar task IDs inmediatamente
    const taskIds: string[] = [];
    
    for (const scene of scenes) {
      const result = await minimaxService.generateImageToVideo({
        firstFrameImage: scene.imageUrl,
        prompt: scene.prompt,
        duration: scene.duration || 6,
        model,
        resolution
      });
      
      if (result.success && result.taskId) {
        taskIds.push(result.taskId);
      }
      
      // Pequeño delay entre requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    res.json({
      success: true,
      taskIds,
      count: taskIds.length,
      message: 'Batch video generation started. Use /status/:taskId to check each video.'
    });
    
  } catch (error: any) {
    console.error('❌ Error en generación batch:', error);
    res.status(500).json({
      error: error.message || 'Error desconocido al generar batch'
    });
  }
});

/**
 * POST /api/minimax/music/generate
 * Generar música con MiniMax Music-2.0
 */
router.post('/music/generate', async (req: Request, res: Response) => {
  try {
    const { prompt, lyrics, referenceAudioUrl } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        error: 'prompt es requerido'
      });
    }
    
    console.log(`🎵 Solicitud de generación de música MiniMax recibida`);
    console.log(`📝 Prompt: ${prompt}`);
    
    const result = await minimaxService.generateMusic({
      prompt,
      lyrics,
      referenceAudioUrl
    });
    
    if (!result.success) {
      return res.status(500).json({
        error: result.error
      });
    }
    
    res.json({
      success: true,
      taskId: result.taskId,
      message: 'Music generation started.'
    });
    
  } catch (error: any) {
    console.error('❌ Error en endpoint de generación de música:', error);
    res.status(500).json({
      error: error.message || 'Error desconocido al generar música'
    });
  }
});

export default router;
