/**
 * Módulo de rutas para la API de Kling - Versión simplificada
 * 
 * Este archivo proporciona endpoints proxy simplificados para la API de Kling
 * Enfoque: Virtual Try-On con manejo de errores mejorado
 */

import { Router } from 'express';
import axios from 'axios';
import { processImageForKling } from '../utils/image-processor';

const router = Router();
const PIAPI_API_KEY = process.env.PIAPI_API_KEY;
const KLING_API_URL = 'https://api.piapi.ai/api/v1/task';

/**
 * Verificar que la clave API esté configurada
 */
if (!PIAPI_API_KEY) {
  console.error('⚠️ PIAPI_API_KEY no está configurada en las variables de entorno');
}

/**
 * Endpoint para iniciar un proceso de Virtual Try-On
 * Conecta directamente con la API de Kling
 */
router.post('/try-on/start', async (req, res) => {
  try {
    console.log('Recibida solicitud para iniciar Virtual Try-On', JSON.stringify(req.body));
    
    // Extraer datos de la solicitud con manejo mejorado de estructura
    // Estructura esperada: { model: "kling", task_type: "ai_try_on", input: { ... } }
    const { model, task_type, input } = req.body || {};
    
    // Estructura asumida si el frontend envía directamente model_input y dress_input
    // Esta es una compatibilidad con versiones anteriores del cliente
    if (!input && req.body.model_input && req.body.dress_input) {
      console.log('Detectada estructura antigua, adaptando automáticamente');
      
      // MEJORA CRÍTICA: Procesar ambas imágenes para asegurar compatibilidad con Kling API
      console.log('Procesando imagen del modelo (formato antiguo) para compatibilidad con Kling API...');
      const processedModelResult = await processImageForKling(req.body.model_input);
      if (!processedModelResult.isValid) {
        console.error('Error al procesar imagen del modelo:', processedModelResult.errorMessage);
        return res.status(400).json({
          success: false,
          error: `Error al procesar imagen del modelo: ${processedModelResult.errorMessage}`
        });
      }
      
      console.log('Procesando imagen de la prenda (formato antiguo) para compatibilidad con Kling API...');
      const processedDressResult = await processImageForKling(req.body.dress_input);
      if (!processedDressResult.isValid) {
        console.error('Error al procesar imagen de la prenda:', processedDressResult.errorMessage);
        return res.status(400).json({
          success: false,
          error: `Error al procesar imagen de la prenda: ${processedDressResult.errorMessage}`
        });
      }
      
      console.log('Ambas imágenes procesadas correctamente (formato antiguo), enviando a Kling API');
      
      // Reconfigurar para mantener compatibilidad con cliente anterior, usando imágenes procesadas
      const klingRequest = {
        model: "kling",
        task_type: "ai_try_on", // Valor correcto verificado mediante pruebas directas con la API
        input: {
          model_input: processedModelResult.normalizedUrl,
          dress_input: processedDressResult.normalizedUrl,
          batch_size: req.body.batch_size || 1
        }
      };
      
      // Realizar la llamada a la API de Kling
      const response = await axios.post(KLING_API_URL, klingRequest, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PIAPI_API_KEY
        }
      });
      
      // Procesar respuesta
      if (response.data && response.data.task_id) {
        console.log(`✅ Try-On (estructura antigua) iniciado con éxito: ${response.data.task_id}`);
        return res.json({
          success: true,
          taskId: response.data.task_id
        });
      } else {
        throw new Error('Formato de respuesta inesperado de la API de Kling');
      }
    }
    
    // Validar requerimientos básicos
    if (!model || !task_type || !input) {
      console.error('Estructura de solicitud inválida');
      return res.status(400).json({ 
        success: false, 
        error: 'Estructura de solicitud inválida. Se requiere: model, task_type, input'
      });
    }
    
    // Extraer y validar inputs específicos
    const { model_input, dress_input, batch_size = 1 } = input;
    
    if (!model_input || !dress_input) {
      console.error('Faltan imágenes requeridas para Virtual Try-On');
      return res.status(400).json({ 
        success: false, 
        error: 'Se requieren imágenes del modelo y la prenda en el objeto input'
      });
    }
    
    // Validar tipo de tarea
    if (task_type !== 'ai_try_on' && task_type !== 'ai_try') {
      console.error(`Tipo de tarea inválido: ${task_type}`);
      return res.status(400).json({
        success: false,
        error: 'El tipo de tarea debe ser ai_try_on o ai_try para este endpoint'
      });
    }
    
    // Asegurarnos de usar el tipo de tarea correcto para la API de Kling
    // Según nuestras pruebas directas con la API, debe ser "ai_try_on"
    const correctedTaskType = 'ai_try_on';
    
    console.log('Datos validados, procesando imágenes para compatibilidad con Kling API');
    
    // MEJORA CRÍTICA: Procesar ambas imágenes para asegurar compatibilidad con Kling API
    console.log('Procesando imagen del modelo para compatibilidad con Kling API...');
    const processedModelResult = await processImageForKling(model_input);
    if (!processedModelResult.isValid) {
      console.error('Error al procesar imagen del modelo:', processedModelResult.errorMessage);
      return res.status(400).json({
        success: false,
        error: `Error al procesar imagen del modelo: ${processedModelResult.errorMessage}`
      });
    }
    
    console.log('Procesando imagen de la prenda para compatibilidad con Kling API...');
    const processedDressResult = await processImageForKling(dress_input);
    if (!processedDressResult.isValid) {
      console.error('Error al procesar imagen de la prenda:', processedDressResult.errorMessage);
      return res.status(400).json({
        success: false,
        error: `Error al procesar imagen de la prenda: ${processedDressResult.errorMessage}`
      });
    }
    
    console.log('Ambas imágenes procesadas correctamente, enviando a Kling API');

    // Configuración de la solicitud a Kling API con imágenes procesadas
    const klingRequest = {
      model,
      task_type: correctedTaskType, // Usar el tipo de tarea corregido
      input: {
        // Usar las imágenes procesadas en lugar de las originales
        model_input: processedModelResult.normalizedUrl,
        dress_input: processedDressResult.normalizedUrl,
        batch_size
      }
    };
    
    console.log('Enviando solicitud a Kling API:', JSON.stringify({
      url: KLING_API_URL,
      model: klingRequest.model,
      task_type: klingRequest.task_type,
      input_structure: {
        model_input: 'data:image/jpeg;base64,...', // Truncado para logs
        dress_input: 'data:image/jpeg;base64,...',  // Truncado para logs
        batch_size: klingRequest.input.batch_size
      }
    }));

    // Realizar la llamada a la API de Kling
    const response = await axios.post(KLING_API_URL, klingRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIAPI_API_KEY
      }
    });

    // Procesar respuesta exitosa - versión optimizada para estructuras variadas de respuesta
    console.log('Respuesta completa de Kling API:', JSON.stringify(response.data));
    
    if (response.data) {
      // 1. Extraer el task_id de cualquier ubicación posible en la respuesta
      let taskId = null;
      
      // Caso 1: task_id en la raíz de la respuesta
      if (response.data.task_id) {
        taskId = response.data.task_id;
      }
      // Caso 2: task_id en un objeto data anidado (formato observado)
      else if (response.data.data && response.data.data.task_id) {
        taskId = response.data.data.task_id;
      }
      
      // 2. Si encontramos un task_id válido, la solicitud fue exitosa
      if (taskId) {
        console.log(`✅ Try-On iniciado con éxito (taskId: ${taskId})`);
        return res.json({
          success: true,
          taskId: taskId
        });
      }
      
      // 3. Si la respuesta tiene mensaje de éxito pero no encontramos un task_id,
      // intentemos extraer más información de diagnóstico
      if (response.data.message === 'success') {
        console.log(`⚠️ Respuesta indica éxito pero sin task_id claro`);
        
        // Revisar si podemos encontrar alguna información útil en la estructura
        const dataInfo = response.data.data ? JSON.stringify(response.data.data) : 'No hay datos anidados';
        console.log(`Información de diagnóstico - data: ${dataInfo}`);
        
        // Si la respuesta tiene código 200, asumimos que el request fue procesado
        // en este caso específico podríamos intentar extraer el task_id de otra forma
        if (response.data.code === 200 && response.data.data) {
          // Última verificación si hay task_id en algún lugar de la estructura
          if (response.data.data.task_id) {
            console.log(`✅ Encontrado task_id en estructura anidada: ${response.data.data.task_id}`);
            return res.json({
              success: true,
              taskId: response.data.data.task_id
            });
          }
        }
      }
      
      // Si llegamos aquí, no encontramos un task_id válido en ninguna estructura
      console.error('❌ Error en respuesta de Kling (sin task_id):', JSON.stringify(response.data));
      return res.status(500).json({
        success: false,
        error: 'No se encontró un ID de tarea en la respuesta de Kling API',
        details: response.data
      });
    } else {
      // Respuesta vacía o inválida
      console.error('❌ Error en respuesta de Kling (respuesta vacía)');
      return res.status(500).json({
        success: false,
        error: 'Respuesta vacía o inválida de Kling API'
      });
    }
  } catch (error: any) {
    console.error('❌ Error al conectar con Kling API:', error.message);
    if (error.response) {
      console.error('❌ Detalles de error en respuesta:', JSON.stringify(error.response.data || {}));
    }
    
    // Detect authentication errors specifically
    if (error.response?.status === 401 || 
        error.response?.data?.message?.includes('API key') || 
        error.response?.data?.error?.includes('API key') ||
        error.message?.toLowerCase().includes('authentication') ||
        error.message?.toLowerCase().includes('api key')) {
      
      console.error('⛔ Authentication error detected with Kling API');
      return res.status(401).json({
        success: false,
        status: 'failed',
        error: 'Authentication error: Invalid API key or insufficient permissions',
        details: {
          message: 'Please verify your API key is valid and has the required permissions',
          originalError: error.response?.data?.message || error.message
        }
      });
    }
    
    // Handle other errors descriptively
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || {}
    });
  }
});

/**
 * Endpoint para verificar el estado de un proceso de Virtual Try-On
 * 
 * Este endpoint maneja la compleja estructura de respuestas anidadas de la API de Kling
 * y proporciona un formato de respuesta unificado y simplificado.
 */
router.post('/try-on/status', async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un ID de tarea' 
      });
    }

    console.log(`Verificando estado de tarea Try-On: ${taskId}`);

    // Verificar estado en Kling API
    const response = await axios.get(`${KLING_API_URL}/${taskId}`, {
      headers: {
        'x-api-key': PIAPI_API_KEY
      }
    });

    console.log('Respuesta bruta de verificación de estado:', JSON.stringify(response.data));
    
    // Estrategia de extracción de datos en múltiples capas
    // 1. Primero intentamos manejar el caso donde la respuesta tiene un formato anidado
    let statusData = response.data;
    let detailedLog = {};
    
    // Caso 1: Estructura anidada con código 200, mensaje success y objeto data
    if (response.data && response.data.code === 200 && response.data.data && response.data.message === 'success') {
      statusData = response.data.data;
      detailedLog = {
        extractionPath: 'response.data.data',
        nestedFormat: true,
        statusSource: 'normalizedResponse'
      };
      console.log('Usando datos anidados para verificación de estado:', JSON.stringify(statusData));
    } 
    // Caso 2: Estructura donde el status viene directamente en el primer nivel
    else if (response.data && response.data.status) {
      detailedLog = {
        extractionPath: 'response.data',
        nestedFormat: false,
        statusSource: 'directResponse'
      };
      console.log('Usando datos directos para verificación de estado');
    }
    // Caso 3: Estructura antigua donde la respuesta contiene directamente output sin status
    else if (response.data && response.data.output && response.data.output.images) {
      statusData = { 
        status: 'success',  // Asumimos éxito si hay imágenes
        output: response.data.output
      };
      detailedLog = {
        extractionPath: 'response.data.output',
        nestedFormat: false,
        statusSource: 'inferredFromOutput',
        hasImages: true
      };
      console.log('Inferido estado success a partir de la presencia de imágenes de salida');
    }
    // Caso 4: Estructura de error con mensaje pero sin status específico
    else if (response.data && response.data.message && !response.data.status) {
      // Si el mensaje es 'success' pero no hay status, asumimos que está pendiente
      if (response.data.message === 'success') {
        statusData = { 
          status: 'processing',
          message: 'Task is still processing'
        };
        detailedLog = {
          extractionPath: 'message=success',
          nestedFormat: false,
          statusSource: 'inferredFromMessage',
          message: response.data.message
        };
        console.log('Inferido estado processing a partir del mensaje success sin datos de salida');
      }
      // Si es otro mensaje, asumimos error
      else {
        statusData = { 
          status: 'failed',
          message: response.data.message || 'Unknown error'
        };
        detailedLog = {
          extractionPath: 'message=error',
          nestedFormat: false,
          statusSource: 'inferredFromErrorMessage',
          message: response.data.message
        };
        console.log(`Inferido estado failed a partir del mensaje: ${response.data.message}`);
      }
    }
    
    console.log('Estrategia de extracción de datos:', detailedLog);
    
    // Procesar respuesta según estado extraído
    if (statusData && statusData.status) {
      const status = statusData.status;
      
      // Caso Kling API: status puede ser "pending", "processing", "success", "failed"
      if (status === 'success') {
        // Extraer imágenes resultantes, pueden estar en diferentes ubicaciones según la respuesta
        const resultImages = statusData.output?.images || 
                             statusData.images || 
                             (statusData.output ? [statusData.output] : []);
        
        // Extraer URL de imagen principal si existe
        let resultImageUrl = null;
        if (resultImages && resultImages.length > 0) {
          if (typeof resultImages[0] === 'string') {
            resultImageUrl = resultImages[0];
          } else if (resultImages[0].url) {
            resultImageUrl = resultImages[0].url;
          }
        }
        
        // Tarea completada con éxito
        console.log(`✅ Tarea Try-On completada: ${taskId}`);
        return res.json({
          success: true,
          status: 'completed',
          images: resultImages,
          resultImage: resultImageUrl, // Para mantener compatibilidad con el cliente
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else if (status === 'failed') {
        // Tarea falló - extraer mensaje de error
        let errorMsg = statusData.message || 
                      statusData.errorMessage || 
                      statusData.error || 
                      'task failed';
        
        // Asegurar que el mensaje de error sea siempre un string
        if (typeof errorMsg === 'object') {
          try {
            errorMsg = JSON.stringify(errorMsg);
          } catch (e) {
            errorMsg = 'Error durante el procesamiento (no se pudo convertir el objeto de error)';
          }
        }
        
        console.error(`❌ Tarea fallida. Mensaje de error: ${errorMsg}`);
        return res.json({
          success: false,
          status: 'failed',
          errorMessage: errorMsg,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else if (status === 'pending' || status === 'processing') {
        // Calcular progreso si está disponible
        let progress = 0;
        if (statusData.progress) {
          progress = typeof statusData.progress === 'number' ? 
            statusData.progress : 
            (parseInt(statusData.progress) || 0);
        }
        
        // Tarea en progreso
        console.log(`⏳ Tarea Try-On en proceso: ${taskId} (${status}, progreso: ${progress}%)`);
        return res.json({
          success: true,
          status: 'processing',
          progress: progress,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else {
        // Estado desconocido - tratamos como processing para evitar bloqueos en el cliente
        console.log(`⚠️ Estado desconocido para tarea: ${status}`);
        return res.json({
          success: true,
          status: 'processing',
          message: `Estado actual: ${status}`,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      }
    } else {
      // Respuesta sin estado - considerar como procesando si no hay señales claras de error
      if (response.data && response.data.message === 'success') {
        console.log(`⏳ Tarea sin estado pero con mensaje='success'. Asumiendo procesamiento: ${taskId}`);
        return res.json({
          success: true,
          status: 'processing',
          message: 'No status information available yet',
          requestId: taskId
        });
      }
      
      // Respuesta inesperada
      console.error('❌ Respuesta inesperada de Kling API:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Respuesta inesperada de Kling API',
        details: response.data,
        requestId: taskId
      });
    }
  } catch (error: any) {
    console.error('❌ Error al verificar estado en Kling API:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || {}
    });
  }
});

/**
 * Endpoint para procesar imágenes y asegurar compatibilidad con Kling API
 * Este endpoint es clave para la unificación del procesamiento de imágenes
 */
router.post('/process-image', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    
    if (!imageDataUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una imagen en formato data URL'
      });
    }
    
    console.log('Procesando imagen para compatibilidad con Kling API');
    
    // Usar la función unificada para procesar la imagen
    const result = await processImageForKling(imageDataUrl);
    
    if (result.isValid) {
      console.log(`✅ Imagen procesada correctamente: ${result.width}x${result.height}`);
      
      return res.json({
        success: true,
        processedImage: result.processedImage || result.normalizedUrl,
        width: result.width,
        height: result.height,
        originalFormat: result.originalFormat,
        sizeInMB: result.sizeInMB
      });
    } else {
      console.error(`❌ Error al procesar imagen: ${result.errorMessage}`);
      
      return res.status(400).json({
        success: false,
        error: result.errorMessage,
        details: {
          width: result.width,
          height: result.height,
          originalFormat: result.originalFormat,
          sizeInMB: result.sizeInMB
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Error en el procesamiento de imagen:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor al procesar la imagen'
    });
  }
});

/**
 * Endpoint para validar imágenes para Kling API
 * Este endpoint verifica si una imagen cumple con los requisitos para ser usada
 * con la API de Kling y devuelve información detallada sobre la imagen.
 */
router.post('/validate-image', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    
    if (!imageDataUrl) {
      return res.status(400).json({
        isValid: false,
        errorMessage: 'Se requiere una imagen en formato data URL'
      });
    }
    
    console.log('Validando imagen para compatibilidad con Kling API');
    
    // Usar la función unificada para validar la imagen
    const result = await processImageForKling(imageDataUrl);
    
    // Adaptamos la respuesta al formato esperado por el cliente
    return res.json({
      isValid: result.isValid,
      errorMessage: result.errorMessage || null,
      width: result.width,
      height: result.height,
      originalFormat: result.originalFormat,
      sizeInMB: result.sizeInMB,
      processedImage: result.isValid ? (result.processedImage || result.normalizedUrl) : null
    });
  } catch (error: any) {
    console.error('❌ Error en la validación de imagen:', error);
    
    return res.status(500).json({
      isValid: false,
      errorMessage: error.message || 'Error interno del servidor al validar la imagen'
    });
  }
});

/**
 * Endpoint para iniciar una tarea de Lipsync
 * Conecta directamente con la API de Kling
 */
router.post('/lipsync/start', async (req, res) => {
  try {
    console.log('Recibida solicitud para iniciar Lipsync', req.body);
    const { videoSource, audioSource, textContent, settings } = req.body;

    if (!videoSource || (!audioSource && !textContent)) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una fuente de video y audio o texto para el lipsync'
      });
    }

    console.log('Datos validados, enviando a Kling API');

    // Configuración de la solicitud a Kling API
    const klingRequest = {
      model: "kling",
      task_type: "lipsync",
      input: {
        video_input: videoSource,
        audio_input: audioSource,
        text_input: textContent,
        settings: settings || {}
      }
    };

    // Realizar la llamada a la API de Kling
    const response = await axios.post(KLING_API_URL, klingRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIAPI_API_KEY
      }
    });

    // Procesar respuesta exitosa
    if (response.data && response.data.task_id) {
      console.log(`✅ Lipsync iniciado con éxito: ${response.data.task_id}`);
      return res.json({
        success: true,
        taskId: response.data.task_id
      });
    } else {
      // Error en respuesta
      console.error('❌ Error en respuesta de Kling Lipsync:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Error en la respuesta de Kling API',
        details: response.data
      });
    }
  } catch (error: any) {
    console.error('❌ Error al conectar con Kling API para Lipsync:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data
    });
  }
});

/**
 * Endpoint para verificar el estado de una tarea de Lipsync
 */
router.post('/lipsync/status', async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un ID de tarea' 
      });
    }

    // Verificar estado en Kling API
    const response = await axios.get(`${KLING_API_URL}/${taskId}`, {
      headers: {
        'x-api-key': PIAPI_API_KEY
      }
    });

    // Procesar respuesta según estado
    if (response.data && response.data.status) {
      const status = response.data.status;
      
      if (status === 'success') {
        // Tarea completada con éxito
        console.log(`✅ Tarea Lipsync completada: ${taskId}`);
        return res.json({
          success: true,
          status: 'completed',
          resultVideo: response.data.output?.video || response.data.video || response.data.output_url
        });
      } else if (status === 'failed') {
        // Tarea falló
        console.error(`❌ Tarea Lipsync fallida. Mensaje: ${response.data.message || 'No hay mensaje de error'}`);
        return res.json({
          success: false,
          status: 'failed',
          errorMessage: response.data.message || response.data.errorMessage || 'task failed'
        });
      } else {
        // Tarea en progreso
        return res.json({
          success: true,
          status: 'processing'
        });
      }
    } else {
      // Respuesta inesperada
      console.error('❌ Respuesta inesperada de Kling API:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Respuesta inesperada de Kling API',
        details: response.data
      });
    }
  } catch (error: any) {
    console.error('❌ Error al verificar estado de Lipsync en Kling API:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data
    });
  }
});

/**
 * Endpoint para iniciar una tarea de efectos (Effects)
 * Conecta directamente con la API de Kling
 */
router.post('/effects/start', async (req, res) => {
  try {
    console.log('Recibida solicitud para iniciar Effects', req.body);
    const { sourceImage, effectType, settings, customEffect } = req.body;

    if (!sourceImage || !effectType) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere una imagen y un tipo de efecto'
      });
    }

    console.log('Datos validados, enviando a Kling API');

    // Configuración de la solicitud a Kling API
    const klingRequest = {
      model: "kling",
      task_type: "effects",
      input: {
        image_input: sourceImage,
        effect_type: effectType,
        settings: settings || {},
        custom_effect: customEffect
      }
    };

    // Realizar la llamada a la API de Kling
    const response = await axios.post(KLING_API_URL, klingRequest, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIAPI_API_KEY
      }
    });

    // Procesar respuesta exitosa
    if (response.data && response.data.task_id) {
      console.log(`✅ Effects iniciado con éxito: ${response.data.task_id}`);
      return res.json({
        success: true,
        taskId: response.data.task_id
      });
    } else {
      // Error en respuesta
      console.error('❌ Error en respuesta de Kling Effects:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Error en la respuesta de Kling API',
        details: response.data
      });
    }
  } catch (error: any) {
    console.error('❌ Error al conectar con Kling API para Effects:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data
    });
  }
});

/**
 * Endpoint para verificar el estado de una tarea de Effects
 * 
 * Utiliza la misma estrategia de extracción que try-on/status para manejar
 * las respuestas anidadas de la API de Kling.
 */
router.post('/effects/status', async (req, res) => {
  try {
    const { taskId } = req.body;

    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un ID de tarea' 
      });
    }

    console.log(`Verificando estado de tarea Effects: ${taskId}`);

    // Verificar estado en Kling API
    const response = await axios.get(`${KLING_API_URL}/${taskId}`, {
      headers: {
        'x-api-key': PIAPI_API_KEY
      }
    });

    console.log('Respuesta bruta de verificación de estado Effects:', JSON.stringify(response.data));
    
    // Estrategia de extracción de datos en múltiples capas
    let statusData = response.data;
    let detailedLog = {};
    
    // Caso 1: Estructura anidada con código 200, mensaje success y objeto data
    if (response.data && response.data.code === 200 && response.data.data && response.data.message === 'success') {
      statusData = response.data.data;
      detailedLog = {
        extractionPath: 'response.data.data',
        nestedFormat: true
      };
      console.log('Usando datos anidados para verificación de estado de Effects:', JSON.stringify(statusData));
    } 
    // Caso 2: Estructura donde el status viene directamente en el primer nivel
    else if (response.data && response.data.status) {
      detailedLog = {
        extractionPath: 'response.data',
        nestedFormat: false
      };
      console.log('Usando datos directos para verificación de estado de Effects');
    }
    // Caso 3: Estructura antigua donde la respuesta contiene directamente output sin status
    else if (response.data && (response.data.output?.video || response.data.video || response.data.output_url)) {
      statusData = { 
        status: 'success',  // Asumimos éxito si hay video
        output: {
          video: response.data.output?.video || response.data.video || response.data.output_url
        }
      };
      detailedLog = {
        extractionPath: 'response.data.output/video/output_url',
        nestedFormat: false,
        statusSource: 'inferredFromVideoOutput'
      };
      console.log('Inferido estado success a partir de la presencia de video de salida');
    }
    // Caso 4: Estructura de error con mensaje pero sin status específico
    else if (response.data && response.data.message && !response.data.status) {
      // Si el mensaje es 'success' pero no hay status, asumimos que está pendiente
      if (response.data.message === 'success') {
        statusData = { 
          status: 'processing',
          message: 'Task is still processing'
        };
        detailedLog = {
          extractionPath: 'message=success',
          statusSource: 'inferredFromMessage'
        };
        console.log('Inferido estado processing a partir del mensaje success sin datos de salida');
      }
      // Si es otro mensaje, asumimos error
      else {
        statusData = { 
          status: 'failed',
          message: response.data.message || 'Unknown error'
        };
        detailedLog = {
          extractionPath: 'message=error',
          statusSource: 'inferredFromErrorMessage'
        };
        console.log(`Inferido estado failed a partir del mensaje: ${response.data.message}`);
      }
    }
    
    console.log('Estrategia de extracción de datos Effects:', detailedLog);
    
    // Procesar respuesta según estado extraído
    if (statusData && statusData.status) {
      const status = statusData.status;
      
      if (status === 'success') {
        // Extraer URL de video resultante, pueden estar en diferentes ubicaciones según la respuesta
        const resultVideoUrl = statusData.output?.video || 
                              statusData.video || 
                              statusData.output_url ||
                              (statusData.output ? statusData.output : null);
        
        // Tarea completada con éxito
        console.log(`✅ Tarea Effects completada: ${taskId}`);
        return res.json({
          success: true,
          status: 'completed',
          resultVideo: resultVideoUrl,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else if (status === 'failed') {
        // Tarea falló - extraer mensaje de error
        const errorMsg = statusData.message || 
                        statusData.errorMessage || 
                        statusData.error || 
                        'task failed';
        
        console.error(`❌ Tarea Effects fallida. Mensaje de error: ${errorMsg}`);
        return res.json({
          success: false,
          status: 'failed',
          errorMessage: errorMsg,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else if (status === 'pending' || status === 'processing') {
        // Calcular progreso si está disponible
        let progress = 0;
        if (statusData.progress) {
          progress = typeof statusData.progress === 'number' ? 
            statusData.progress : 
            (parseInt(statusData.progress) || 0);
        }
        
        // Tarea en progreso
        console.log(`⏳ Tarea Effects en proceso: ${taskId} (${status}, progreso: ${progress}%)`);
        return res.json({
          success: true,
          status: 'processing',
          progress: progress,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      } else {
        // Estado desconocido - tratamos como processing para evitar bloqueos en el cliente
        console.log(`⚠️ Estado desconocido para tarea Effects: ${status}`);
        return res.json({
          success: true,
          status: 'processing',
          message: `Estado actual: ${status}`,
          requestId: taskId // Para mantener compatibilidad con el cliente
        });
      }
    } else {
      // Respuesta sin estado - considerar como procesando si no hay señales claras de error
      if (response.data && response.data.message === 'success') {
        console.log(`⏳ Tarea Effects sin estado pero con mensaje='success'. Asumiendo procesamiento: ${taskId}`);
        return res.json({
          success: true,
          status: 'processing',
          message: 'No status information available yet',
          requestId: taskId
        });
      }
      
      // Respuesta inesperada
      console.error('❌ Respuesta inesperada de Kling API para Effects:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Respuesta inesperada de Kling API',
        details: response.data,
        requestId: taskId
      });
    }
  } catch (error: any) {
    console.error('❌ Error al verificar estado de Effects en Kling API:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || {}
    });
  }
});

/**
 * Endpoint para guardar resultados
 * Guarda los resultados generados por Kling API en Firebase
 */
router.post('/save-result', async (req, res) => {
  try {
    const { type, result } = req.body;
    
    if (!type || !result) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un tipo y un resultado para guardar'
      });
    }
    
    // Aquí implementaríamos la lógica para guardar en Firebase
    // Simularemos una respuesta exitosa por ahora
    console.log(`Guardando resultado de ${type} en Firebase:`, result);
    
    // Generar un ID único para el resultado
    const resultId = `result_${Date.now()}`;
    
    return res.json({
      success: true,
      id: resultId,
      message: `Resultado de ${type} guardado con éxito`
    });
  } catch (error: any) {
    console.error('❌ Error al guardar resultado:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor al guardar el resultado'
    });
  }
});

/**
 * Endpoint para obtener resultados guardados
 */
router.get('/results', async (req, res) => {
  try {
    const type = req.query.type as string || 'all';
    
    // Aquí implementaríamos la lógica para obtener resultados de Firebase
    // Simularemos una respuesta con resultados ficticios por ahora
    console.log(`Obteniendo resultados de tipo: ${type}`);
    
    // Resultados de ejemplo (esto sería reemplazado por datos reales de Firebase)
    const mockResults: any[] = [];
    
    return res.json({
      success: true,
      results: mockResults
    });
  } catch (error: any) {
    console.error('❌ Error al obtener resultados:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Error interno del servidor al obtener los resultados'
    });
  }
});

/**
 * Endpoint para generar imágenes con Kling API
 * 
 * Permite generar imágenes usando el modelo de generación de imágenes de Kling
 */
router.post('/generate-image', async (req, res) => {
  try {
    const { prompt, negative_prompt, num_inference_steps, guidance_scale, seed } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt para generar la imagen'
      });
    }
    
    console.log('Iniciando generación de imagen con Kling:', prompt);
    
    // Configuración de la solicitud a Kling API
    const requestData = {
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "url",
      negative_prompt: negative_prompt || '',
      num_inference_steps: num_inference_steps || 30,
      guidance_scale: guidance_scale || 7.5,
      seed: seed || Math.floor(Math.random() * 1000000)
    };
    
    console.log(`Usando API URL para generación de imagen: ${KLING_API_URL}`);
    
    // Realizar la llamada a la API de Kling (diferentes endpoints para cada servicio)
    const response = await axios.post('https://api.piapi.ai/api/v1/task', {
      model: "sdxl",
      task_type: "text_to_image",
      input: requestData
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIAPI_API_KEY
      }
    });
    
    // Procesar respuesta exitosa
    if (response.data && response.data.task_id) {
      console.log(`✅ Generación de imagen iniciada con éxito: ${response.data.task_id}`);
      return res.json({
        success: true,
        taskId: response.data.task_id
      });
    } else {
      // Error en respuesta
      console.error('❌ Error en respuesta de PiAPI Image Generation:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Error en la respuesta de PiAPI',
        details: response.data
      });
    }
  } catch (error: any) {
    console.error('❌ Error al conectar con PiAPI para generación de imagen:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data
    });
  }
});

/**
 * Endpoint para generar videos con PiAPI
 * 
 * Permite generar videos usando el modelo de generación de videos de PiAPI
 */
router.post('/generate-video', async (req, res) => {
  try {
    const { prompt, negative_prompt, init_image, model_type, num_inference_steps, guidance_scale, seed } = req.body;
    
    if (!prompt) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un prompt para generar el video'
      });
    }
    
    console.log('Iniciando generación de video con PiAPI:', prompt);
    
    // Configuración de la solicitud a PiAPI
    const requestData = {
      model: "t2v-01", // Modelo por defecto de PiAPI
      task_type: "text_to_video",
      input: {
        prompt,
        negative_prompt: negative_prompt || '',
        init_image: init_image || null,
        model_type: model_type || "base",
        num_inference_steps: num_inference_steps || 30,
        guidance_scale: guidance_scale || 7.5,
        seed: seed || Math.floor(Math.random() * 1000000)
      }
    };
    
    console.log(`Usando API URL para generación de video: ${KLING_API_URL}`);
    
    // Realizar la llamada a la API de PiAPI
    const response = await axios.post(KLING_API_URL, requestData, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PIAPI_API_KEY
      }
    });
    
    // Procesar respuesta exitosa
    if (response.data && response.data.task_id) {
      console.log(`✅ Generación de video iniciada con éxito: ${response.data.task_id}`);
      return res.json({
        success: true,
        taskId: response.data.task_id
      });
    } else {
      // Error en respuesta
      console.error('❌ Error en respuesta de PiAPI Video Generation:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Error en la respuesta de PiAPI',
        details: response.data
      });
    }
  } catch (error: any) {
    console.error('❌ Error al conectar con PiAPI para generación de video:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data
    });
  }
});

/**
 * Endpoint general para verificar el estado de una tarea
 * Funciona para cualquier tipo de tarea: try-on, lipsync, effects, text_to_image, text_to_video
 * 
 * Utiliza la misma estrategia de extracción de datos anidados para manejar
 * las múltiples estructuras de respuesta de la API de Kling/PiAPI.
 */
router.get('/task-status/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un ID de tarea' 
      });
    }

    console.log(`Verificando estado de tarea general: ${taskId}`);

    // Verificar estado en Kling API
    const response = await axios.get(`${KLING_API_URL}/${taskId}`, {
      headers: {
        'x-api-key': PIAPI_API_KEY
      }
    });

    console.log('Respuesta bruta de verificación de estado general:', JSON.stringify(response.data));
    
    // Extraer datos usando la estrategia de múltiples capas
    let statusData = response.data;
    
    // Caso 1: Estructura anidada con código 200, mensaje success y objeto data
    if (response.data && response.data.code === 200 && response.data.data && response.data.message === 'success') {
      statusData = response.data.data;
      console.log('Usando datos anidados para verificación de estado general:', JSON.stringify(statusData));
    }
    
    // Procesar respuesta según estado extraído
    if (statusData && statusData.status) {
      const status = statusData.status;
      
      if (status === 'success') {
        // Extraer resultados, que pueden estar en diferentes ubicaciones según el tipo de tarea
        const resultData = statusData.output || 
                           statusData.images || 
                           statusData.videos || 
                           statusData.result ||
                           statusData;
        
        // Tarea completada con éxito
        console.log(`✅ Tarea completada: ${taskId}`);
        return res.json({
          success: true,
          status: 'completed',
          result: resultData,
          requestId: taskId
        });
      } else if (status === 'failed') {
        // Tarea falló - extraer mensaje de error
        const errorMsg = statusData.message || 
                        statusData.errorMessage || 
                        statusData.error || 
                        'task failed';
        
        console.error(`❌ Tarea fallida. Mensaje de error: ${errorMsg}`);
        return res.json({
          success: false,
          status: 'failed',
          errorMessage: errorMsg,
          requestId: taskId
        });
      } else if (status === 'pending' || status === 'processing') {
        // Calcular progreso si está disponible
        let progress = 0;
        if (statusData.progress) {
          progress = typeof statusData.progress === 'number' ? 
            statusData.progress : 
            (parseInt(statusData.progress) || 0);
        }
        
        // Tarea en progreso
        console.log(`⏳ Tarea en proceso: ${taskId} (${status}, progreso: ${progress}%)`);
        return res.json({
          success: true,
          status: 'processing',
          progress: progress,
          requestId: taskId
        });
      } else {
        // Estado desconocido
        console.log(`⚠️ Estado desconocido para tarea: ${status}`);
        return res.json({
          success: true,
          status: 'processing',
          message: `Estado actual: ${status}`,
          requestId: taskId
        });
      }
    } else {
      // Si no hay status explícito pero hay mensaje de éxito, considerar como en progreso
      if (response.data && response.data.message === 'success') {
        console.log(`⏳ Tarea sin estado pero con mensaje='success'. Asumiendo procesamiento: ${taskId}`);
        return res.json({
          success: true,
          status: 'processing',
          message: 'No status information available yet',
          requestId: taskId
        });
      }
      
      // Respuesta inesperada
      console.error('❌ Respuesta inesperada de Kling API para verificación general:', response.data);
      return res.status(500).json({
        success: false,
        error: 'Respuesta inesperada de Kling API',
        details: response.data,
        requestId: taskId
      });
    }
  } catch (error: any) {
    console.error('❌ Error al verificar estado en Kling API:', error);
    
    // Manejar errores de forma descriptiva
    const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
    return res.status(500).json({
      success: false,
      error: errorMessage,
      details: error.response?.data || {}
    });
  }
});

export default router;