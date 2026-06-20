import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

/**
 * Endpoint público para verificar el estado de tareas de generación de video
 * Este endpoint está diseñado para ser accesible sin autenticación
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { taskId, provider } = req.query;
    
    console.log('🎬 Verificando estado de video (endpoint público):', { taskId, provider });
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere el ID de la tarea'
      });
    }
    
    if (provider === 'piapi') {
      // Verificar estado en PiAPI
      try {
        // Llamada directa al endpoint de proxy
        const proxyRes = await axios.get(
          `${req.protocol}://${req.get('host')}/api/proxy/piapi/video/status?taskId=${taskId}`
        );
        
        console.log('✅ Respuesta de verificación de estado de video:', proxyRes.data);
        return res.json(proxyRes.data);
      } catch (proxyError: any) {
        console.error('❌ Error al verificar estado en proxy PiAPI:', proxyError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar estado de la tarea de video'
        });
      }
    } else if (provider === 'luma') {
      // Verificar estado en Luma
      try {
        const proxyRes = await axios.get(
          `${req.protocol}://${req.get('host')}/api/proxy/luma/status?taskId=${taskId}`
        );
        
        return res.json(proxyRes.data);
      } catch (proxyError: any) {
        console.error('❌ Error al verificar estado en proxy Luma:', proxyError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar estado de la tarea en Luma'
        });
      }
    } else if (provider === 'kling') {
      // Verificar estado en Kling
      try {
        const proxyRes = await axios.get(
          `${req.protocol}://${req.get('host')}/api/proxy/kling/video/status?taskId=${taskId}`
        );
        
        return res.json(proxyRes.data);
      } catch (proxyError: any) {
        console.error('❌ Error al verificar estado en proxy Kling:', proxyError.message);
        return res.status(500).json({
          success: false,
          error: 'Error al verificar estado de la tarea en Kling'
        });
      }
    } else {
      return res.status(400).json({
        success: false,
        error: `Proveedor no soportado: ${provider}`
      });
    }
  } catch (error: any) {
    console.error('❌ Error al verificar estado de tarea de video:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor'
    });
  }
});

export default router;