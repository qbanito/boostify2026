/**
 * Rutas para la generación de videos con PiAPI
 */
import { Router, Request, Response } from 'express';
import { generateVideoWithPiAPI, checkVideoGenerationStatus } from '../services/piapi-direct-service';

const router = Router();

/**
 * Inicia una generación de video usando PiAPI
 * Este endpoint conecta directamente con la API usando axios
 */
router.post('/generate', async (req: Request, res: Response) => {
  try {
    console.log('Recibiendo solicitud de generación de video:', req.body);
    
    const { prompt, model, cameraMovements, imageUrl } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt para generar el video'
      });
    }
    
    // Usar el servicio directo de PiAPI para generar el video
    const result = await generateVideoWithPiAPI(
      prompt,
      model || 't2v-01',
      cameraMovements,
      imageUrl
    );
    
    console.log('Resultado de la generación:', result);
    
    if (result.success && result.taskId) {
      return res.json({
        success: true,
        taskId: result.taskId,
        status: result.status || 'pending'
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error al generar el video'
      });
    }
  } catch (error: any) {
    console.error('Error en la generación de video:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno al procesar la solicitud'
    });
  }
});

/**
 * Verifica el estado de una tarea de generación de video
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un ID de tarea válido'
      });
    }
    
    // Usar el servicio directo de PiAPI para verificar el estado
    const result = await checkVideoGenerationStatus(taskId);
    
    console.log('Estado de la tarea:', result);
    
    return res.json({
      success: true,
      status: result.status,
      url: result.url,
      error: result.error
    });
  } catch (error: any) {
    console.error('Error al verificar estado de video:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error al verificar el estado de la tarea'
    });
  }
});

export default router;