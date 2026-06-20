/**
 * Flux API Proxy
 * 
 * Proxy especializado para la API de PiAPI Flux, que facilita la generación 
 * de imágenes con modelos avanzados como Qubico/flux1-dev y variantes.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { log } from '../vite';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const PIAPI_API_KEY = process.env.PIAPI_API_KEY || '';
const PIAPI_BASE_URL = 'https://api.piapi.ai/api/v1';

// Verificar si la API key está configurada
if (!PIAPI_API_KEY) {
  log('⚠️ PIAPI_API_KEY no está configurada en las variables de entorno', 'flux-api');
}

/**
 * Endpoint para iniciar una tarea de generación de imagen con texto
 */
router.post('/flux/generate-image', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      negativePrompt,
      steps = 28,
      guidance_scale = 2.5,
      width = 512,
      height = 512,
      model = 'Qubico/flux1-dev',
      taskType = 'txt2img'
    } = req.body;

    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Prompt is required'
      });
    }

    // Configurar los datos de la solicitud según la documentación de PiAPI
    const requestData = {
      model,
      task_type: taskType,
      input: {
        prompt,
        negative_prompt: negativePrompt,
        steps,
        guidance_scale,
        width,
        height
      },
      config: {
        webhook_config: {
          endpoint: "",
          secret: ""
        },
        service_mode: ""
      }
    };

    log(`Iniciando generación de imagen con Flux: ${model}`, 'flux-api');
    
    // Realizar la solicitud a PiAPI
    const response = await axios({
      method: 'post',
      url: `${PIAPI_BASE_URL}/task`,
      headers: {
        'X-API-Key': PIAPI_API_KEY,
        'Content-Type': 'application/json'
      },
      data: requestData
    });

    // Estructurar la respuesta para que sea compatible con la API de Flux
    const responseData = response.data;
    log(`Respuesta de generación de imagen Flux: ${JSON.stringify(responseData)}`, 'flux-api');

    return res.json(responseData);
  } catch (error: any) {
    log(`Error en generación de imagen Flux: ${error.message}`, 'flux-api');
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error generating image with Flux API',
      code: 500,
      data: {
        task_id: `error-${Date.now()}`,
        status: 'failed',
        error: {
          message: error.message || 'Unknown error'
        }
      }
    });
  }
});

/**
 * Endpoint para verificar el estado de una tarea de generación
 */
router.get('/flux/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }

    log(`Verificando estado de tarea Flux: ${taskId}`, 'flux-api');

    // Realizar la solicitud a PiAPI
    const response = await axios({
      method: 'get',
      url: `${PIAPI_BASE_URL}/task/${taskId}`,
      headers: {
        'X-API-Key': PIAPI_API_KEY,
        'Accept': 'application/json'
      }
    });

    // Extraer y devolver los datos de respuesta
    const responseData = response.data;
    log(`Respuesta de estado Flux: ${JSON.stringify(responseData)}`, 'flux-api');

    return res.json(responseData);
  } catch (error: any) {
    log(`Error en verificación de estado Flux: ${error.message}`, 'flux-api');
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error checking task status with Flux API',
      code: 500,
      data: {
        task_id: req.query.taskId as string,
        status: 'failed',
        error: {
          message: error.message || 'Unknown error'
        }
      }
    });
  }
});

/**
 * Endpoint para iniciar una tarea de generación de imagen a partir de otra imagen
 */
router.post('/flux/image-to-image', async (req: Request, res: Response) => {
  try {
    const {
      prompt,
      negativePrompt,
      image,
      denoise = 0.7,
      guidance_scale = 2.5,
      model = 'Qubico/flux1-dev',
      taskType = 'img2img'
    } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({
        success: false,
        error: 'Prompt and image are required'
      });
    }

    // Configurar los datos de la solicitud según la documentación de PiAPI
    const requestData = {
      model,
      task_type: taskType,
      input: {
        prompt,
        negative_prompt: negativePrompt,
        image,
        denoise,
        guidance_scale
      },
      config: {
        webhook_config: {
          endpoint: "",
          secret: ""
        },
        service_mode: ""
      }
    };

    log(`Iniciando conversión image-to-image con Flux: ${model}`, 'flux-api');
    
    // Realizar la solicitud a PiAPI
    const response = await axios({
      method: 'post',
      url: `${PIAPI_BASE_URL}/task`,
      headers: {
        'X-API-Key': PIAPI_API_KEY,
        'Content-Type': 'application/json'
      },
      data: requestData
    });

    // Estructurar la respuesta para que sea compatible con la API de Flux
    const responseData = response.data;
    log(`Respuesta de image-to-image Flux: ${JSON.stringify(responseData)}`, 'flux-api');

    return res.json(responseData);
  } catch (error: any) {
    log(`Error en image-to-image Flux: ${error.message}`, 'flux-api');
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error generating image-to-image with Flux API',
      code: 500,
      data: {
        task_id: `error-${Date.now()}`,
        status: 'failed',
        error: {
          message: error.message || 'Unknown error'
        }
      }
    });
  }
});

export default router;