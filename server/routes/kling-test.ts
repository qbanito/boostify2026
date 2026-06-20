/**
 * Rutas de prueba para la API de Kling
 * Estas rutas son temporales y solo para pruebas de verificación de estructura de respuesta
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const router = Router();

/**
 * Función para extraer datos de respuestas anidadas en múltiples formatos
 * 
 * Esta función puede manejar:
 * 1. Respuestas de error 
 * 2. Respuestas directas (formato antiguo de la API)
 * 3. Respuestas anidadas (nuevo formato con { code, message, data })
 * 4. Respuestas de estado procesando
 * 
 * @param response La respuesta completa recibida de la API
 * @returns Un objeto con datos normalizados para cualquier formato
 */
function extractResponseData(response: any) {
  // Inicializar valores predeterminados
  const result = {
    success: false,
    status: '',
    message: '',
    errorCode: '',
    task_id: '',
    progress: 0,
    output: null,
    isCompleted: false,
    isProcessing: false,
    isError: false,
    isValid: false,
    originalResponse: response,
    extractionPath: ''
  };

  try {
    // Caso 1: Respuesta anidada de nuevo formato (Kling API V2)
    // { code: 200, message: "success", data: { status, output, task_id } }
    if (response && response.code !== undefined && response.data) {
      result.success = response.code === 200 && response.message === 'success';
      result.extractionPath = 'anidada.v2';
      
      if (response.data.status) {
        result.status = response.data.status;
        result.task_id = response.data.task_id || '';
        result.isValid = true;
        
        // Verificar si está completada
        if (response.data.status === 'completed' && response.data.output) {
          result.isCompleted = true;
          result.output = response.data.output;
        }
        // Verificar si está procesando
        else if (response.data.status === 'processing' || response.data.status === 'pending') {
          result.isProcessing = true;
          result.progress = response.data.progress || 0;
        }
        // Verificar si es error
        else if (response.data.status === 'failed') {
          result.isError = true;
          result.message = response.data.message || 'Error desconocido';
          result.errorCode = response.data.error_code || 'ERROR';
        }
      }
      
      return result;
    }
    
    // Caso 2: Formato directo antiguo de la API V1
    // { status, output, task_id }
    if (response && response.status) {
      result.status = response.status;
      result.task_id = response.task_id || '';
      result.extractionPath = 'directa.v1';
      result.isValid = true;
      
      // Verificar si está completada
      if (response.status === 'completed' && response.output) {
        result.success = true;
        result.isCompleted = true;
        result.output = response.output;
      }
      // Verificar si está procesando
      else if (response.status === 'processing' || response.status === 'pending') {
        result.success = true;
        result.isProcessing = true;
        result.progress = response.progress || 0;
      }
      // Verificar si es un error
      else if (response.status === 'failed') {
        result.isError = true;
        result.message = response.message || 'Error desconocido';
        result.errorCode = response.error_code || 'ERROR';
      }
      
      return result;
    }
    
    // Caso 3: Respuesta de error especial con formato { status, message, error_code }
    if (response && response.status && response.error_code) {
      result.status = response.status;
      result.isError = true;
      result.task_id = response.task_id || '';
      result.message = response.message || 'Error desconocido';
      result.errorCode = response.error_code;
      result.extractionPath = 'error.detallado';
      result.isValid = true;
      
      return result;
    }
    
    // Caso 4: Formato de error simple { message }
    if (response && response.message && !response.code) {
      result.isError = true;
      result.message = response.message;
      result.extractionPath = 'error.simple';
      result.isValid = true;
      
      return result;
    }
    
    // Caso 5: Formato extraño con resultados dentro de video u otro contenedor
    if (response && response.video) {
      result.success = true;
      result.isCompleted = true;
      result.output = { video: response.video };
      result.extractionPath = 'contenedor.video';
      result.isValid = true;
      
      return result;
    }
    
    // Si no se encontró un formato conocido
    result.extractionPath = 'desconocido';
    result.message = 'Formato de respuesta desconocido';
    result.isError = true;
    
    return result;
  } catch (error) {
    // En caso de error al procesar
    result.isError = true;
    result.message = error instanceof Error ? error.message : 'Error desconocido';
    result.extractionPath = 'excepcion';
    
    return result;
  }
}

/**
 * Endpoint para probar la verificación de estado de una tarea real
 */
router.get('/task-status/:taskId', async (req: Request, res: Response) => {
  const { taskId } = req.params;
  
  if (!taskId) {
    return res.status(400).json({ error: 'Se requiere un ID de tarea' });
  }
  
  try {
    const apiKey = process.env.PIAPI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        error: 'PIAPI_API_KEY no está configurada',
        simulation: true,
        data: {
          status: 'error',
          message: 'API key no configurada'
        }
      });
    }
    
    const response = await axios.get(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: {
        'x-api-key': apiKey
      }
    });
    
    const processed = extractResponseData(response.data);
    
    return res.json({
      original: response.data,
      processed,
      extractionDetails: {
        path: processed.extractionPath,
        isValid: processed.isValid,
        success: processed.success,
        isCompleted: processed.isCompleted,
        isProcessing: processed.isProcessing,
        isError: processed.isError
      }
    });
  } catch (error) {
    let errorMessage = 'Error desconocido';
    let errorData = null;
    
    if (axios.isAxiosError(error)) {
      errorMessage = error.message;
      errorData = error.response?.data;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      error: errorMessage,
      data: errorData
    });
  }
});

/**
 * Endpoint para probar respuestas simuladas tipo 1 (nivel superficial)
 * Simula una respuesta simple donde el status viene en el primer nivel
 */
router.get('/simulate/simple', (req: Request, res: Response) => {
  const simulatedResponse = {
    status: 'completed',
    output: {
      video: 'https://example.com/result.mp4' 
    },
    task_id: '12345-simulated-task-id'
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint para probar respuestas simuladas tipo 2 (estructura anidada)
 * Simula una respuesta donde el resultado viene dentro de una estructura anidada
 * como la que devuelve la nueva versión de la API
 */
router.get('/simulate/nested', (req: Request, res: Response) => {
  const simulatedResponse = {
    code: 200,
    message: 'success',
    data: {
      status: 'completed',
      output: {
        video: 'https://example.com/result.mp4' 
      },
      task_id: '67890-simulated-task-id'
    }
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint para probar respuestas simuladas tipo 3 (error)
 * Simula una respuesta de error
 */
router.get('/simulate/error', (req: Request, res: Response) => {
  const simulatedResponse = {
    status: 'failed',
    message: 'Error procesando la solicitud',
    error_code: 'PROCESSING_ERROR',
    task_id: 'error-task-id'
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint para probar respuestas simuladas tipo 4 (error anidado)
 * Simula una respuesta de error en estructura anidada
 */
router.get('/simulate/nested-error', (req: Request, res: Response) => {
  const simulatedResponse = {
    code: 400,
    message: 'error',
    data: {
      status: 'failed',
      message: 'Error al procesar la imagen',
      error_code: 'IMAGE_PROCESSING_ERROR',
      task_id: 'nested-error-task-id'
    }
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint para probar respuestas simuladas tipo 5 (procesando)
 * Simula una respuesta de tarea en progreso
 */
router.get('/simulate/processing', (req: Request, res: Response) => {
  const simulatedResponse = {
    status: 'processing',
    progress: 65,
    task_id: 'processing-task-id'
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint para probar respuestas simuladas tipo 6 (estructura extraña)
 * Simula una respuesta con estructura no estándar o inesperada
 */
router.get('/simulate/unusual', (req: Request, res: Response) => {
  const simulatedResponse = {
    video: 'https://example.com/unexpected-format.mp4',
    metadata: {
      processed: true,
      timestamp: new Date().toISOString()
    }
  };
  
  res.json({
    rawResponse: simulatedResponse,
    processed: extractResponseData(simulatedResponse)
  });
});

/**
 * Endpoint de verificación general que usa el extractor de datos mejorado
 * Procesa una respuesta simulada usando el mismo código que los endpoints reales
 */
router.post('/verify-extractor', (req: Request, res: Response) => {
  const { responseType } = req.body;
  
  if (!responseType) {
    return res.status(400).json({ error: 'Se requiere un tipo de respuesta' });
  }
  
  let simulatedResponse;
  
  switch (responseType) {
    case 'simple':
      simulatedResponse = {
        status: 'completed',
        output: {
          video: 'https://example.com/result.mp4' 
        },
        task_id: '12345-simulated-task-id'
      };
      break;
      
    case 'nested':
      simulatedResponse = {
        code: 200,
        message: 'success',
        data: {
          status: 'completed',
          output: {
            video: 'https://example.com/result.mp4' 
          },
          task_id: '67890-simulated-task-id'
        }
      };
      break;
      
    case 'error':
      simulatedResponse = {
        status: 'failed',
        message: 'Error procesando la solicitud',
        error_code: 'PROCESSING_ERROR',
        task_id: 'error-task-id'
      };
      break;
      
    case 'nested-error':
      simulatedResponse = {
        code: 400,
        message: 'error',
        data: {
          status: 'failed',
          message: 'Error al procesar la imagen',
          error_code: 'IMAGE_PROCESSING_ERROR',
          task_id: 'nested-error-task-id'
        }
      };
      break;
      
    case 'processing':
      simulatedResponse = {
        status: 'processing',
        progress: 65,
        task_id: 'processing-task-id'
      };
      break;
      
    case 'unusual':
      simulatedResponse = {
        video: 'https://example.com/unexpected-format.mp4',
        metadata: {
          processed: true,
          timestamp: new Date().toISOString()
        }
      };
      break;
      
    default:
      return res.status(400).json({ error: 'Tipo de respuesta desconocido' });
  }
  
  const processed = extractResponseData(simulatedResponse);
  
  return res.json({
    original: simulatedResponse,
    processed,
    extractionDetails: {
      path: processed.extractionPath,
      isValid: processed.isValid,
      success: processed.success,
      isCompleted: processed.isCompleted,
      isProcessing: processed.isProcessing,
      isError: processed.isError
    }
  });
});

export default router;