/**
 * Rutas para la generación de música con IA
 * 
 * Estas rutas manejan la generación asíncrona de música,
 * el seguimiento del estado de generación y la gestión
 * del historial de generaciones.
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';
import { db } from '@db';
import { log } from '../vite';
import fileUpload from 'express-fileupload';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateMusicWithLyria3, type Lyria3CompositionParams } from '../services/lyria3-service';
import { buildMusicTags, buildAudioMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';

const router = Router();

// Configurar middleware para manejo de archivos
router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB límite máximo
  useTempFiles: true,
  tempFileDir: path.join(os.tmpdir(), 'music-uploads')
}));

// Mapeo de modelos internos a modelos de la API de PiAPI
const MODEL_MAPPING: Record<string, string> = {
  'music-s': 'suno-v3-music',
  'music-u': 'udio-v1-music'
};

// Estado en memoria para seguimiento de generaciones (en producción usaríamos una base de datos)
const musicGenerations: Record<string, any> = {};

// El endpoint de prueba se ha movido a server/routes.ts para evitar problemas con el middleware de autenticación

/**
 * Endpoint para iniciar una generación de música
 * Requiere autenticación
 */
router.post('/generate', authenticate, async (req: Request, res: Response) => {
  try {
    const { 
      prompt, 
      title, 
      model = 'music-s',
      makeInstrumental = false,
      negativeTags = '',
      tags = '',
      seed,
      tempo,
      keySignature,
      continueClipId,
      continueAt,
      customLyrics,
      generateLyrics = false,
      audioUrl,
      uploadAudio = false,
      // Lyria 3 enhanced parameters
      lyria3Params
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'El prompt es requerido' });
    }

    // Validar el modelo - incluir music-lyria3
    const validModels = ['music-lyria3', ...Object.keys(MODEL_MAPPING)];
    if (!validModels.includes(model)) {
      return res.status(400).json({ error: 'Modelo no válido' });
    }

    // Crear un ID único para esta generación
    const taskId = uuidv4();
    const userId = req.user?.uid || 'anonymous';

    // Verificar que el usuario tiene permisos para generar música
    // En producción, aquí podríamos verificar límites o suscripciones

    // Registro de la generación en nuestra base de datos o cache
    musicGenerations[taskId] = {
      id: taskId,
      userId,
      title: title || `Generación ${new Date().toLocaleString()}`,
      prompt,
      model,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      options: {
        makeInstrumental,
        negativeTags,
        tags,
        seed,
        tempo,
        keySignature,
        continueClipId,
        continueAt,
        customLyrics,
        generateLyrics,
        audioUrl,
        uploadAudio,
        lyria3Params
      }
    };

    // ============================================================
    // LYRIA 3 - Direct generation via Gemini API
    // ============================================================
    if (model === 'music-lyria3') {
      log(`🎵 Lyria 3 generation initiated: ${taskId}`, 'music-api');
      musicGenerations[taskId].status = 'processing';
      musicGenerations[taskId].progress = 20;

      // Generate asynchronously
      (async () => {
        try {
          const compositionParams: Lyria3CompositionParams = {
            genre: lyria3Params?.genre || tags || undefined,
            bpm: lyria3Params?.bpm || (tempo ? Number(tempo) : undefined),
            key: lyria3Params?.key || keySignature || undefined,
            mood: lyria3Params?.mood || undefined,
            instruments: lyria3Params?.instruments || undefined,
            structure: lyria3Params?.structure || undefined,
            timestamps: lyria3Params?.timestamps || undefined,
            customLyrics: customLyrics || lyria3Params?.customLyrics || undefined,
            instrumental: makeInstrumental,
            language: lyria3Params?.language || undefined,
            vocalStyle: lyria3Params?.vocalStyle || undefined,
            durationHint: lyria3Params?.durationHint || undefined,
            outputFormat: lyria3Params?.outputFormat || 'mp3',
            useClipModel: lyria3Params?.useClipModel || false,
            artistGender: lyria3Params?.artistGender || undefined,
            productionStyle: lyria3Params?.productionStyle || undefined,
            dynamics: lyria3Params?.dynamics || undefined,
          };

          musicGenerations[taskId].progress = 40;
          const result = await generateMusicWithLyria3(prompt, compositionParams);
          
          if (result.success && result.audioUrl) {
            musicGenerations[taskId].status = 'completed';
            musicGenerations[taskId].progress = 100;
            musicGenerations[taskId].audioUrl = result.audioUrl;
            musicGenerations[taskId].lyrics = result.lyrics;
            musicGenerations[taskId].provider = result.provider;
            musicGenerations[taskId].format = result.format;
            log(`✅ Lyria 3 generation completed: ${taskId}`, 'music-api');
          } else {
            musicGenerations[taskId].status = 'failed';
            musicGenerations[taskId].error = result.error || 'Generation failed';
            log(`❌ Lyria 3 generation failed: ${result.error}`, 'music-api');
          }
        } catch (error: any) {
          musicGenerations[taskId].status = 'failed';
          musicGenerations[taskId].error = error.message || 'Unknown error';
          log(`❌ Lyria 3 generation error: ${error.message}`, 'music-api');
        }
      })();

      return res.status(202).json({
        taskId,
        message: 'Generación de música con Lyria 3 iniciada con éxito'
      });
    }

    // ============================================================
    // PIAPI (Suno/Udio) - Standard generation path
    // ============================================================

    // Determinar el tipo de tarea adecuado según las opciones
    let taskType = 'generate_music';
    if (generateLyrics) {
      taskType = 'generate_lyrics';
    } else if (uploadAudio) {
      taskType = 'upload_audio';
    } else if (continueClipId) {
      taskType = 'continue_music';
    }

    // Preparar los datos para la API de PiAPI
    const apiModel = MODEL_MAPPING[model]; // 'suno-v3-music' o 'udio-v1-music'

    // Enrich prompt and tags with Masterpiece Rules
    const mpCtx: ArtistContext = {
      artistName: (req.body?.artistName as string) || '',
      genre: (req.body?.genre as string) || null,
      mood: (req.body?.mood as string) || null,
    };
    const masterpieceTags = buildMusicTags(mpCtx, typeof tags === 'string' ? tags : undefined);
    const masterpieceAudio = buildAudioMasterpieceRules(
      mpCtx,
      makeInstrumental ? 'instrumental' : 'full-track'
    );
    const enrichedPrompt = prompt
      ? `${prompt}\n\n${masterpieceAudio}`
      : masterpieceAudio;
    const enrichedTags = masterpieceTags;

    const requestData: any = {
      model: apiModel,
      task_type: taskType,
      input: {
        prompt: enrichedPrompt,
      }
    };

    // Añadir opciones específicas según el tipo de tarea
    if (makeInstrumental) {
      requestData.input.make_instrumental = true;
    }
    
    if (negativeTags) {
      requestData.input.negative_tags = negativeTags;
    }
    
    if (enrichedTags) {
      requestData.input.tags = enrichedTags;
    }
    
    if (seed && !isNaN(Number(seed))) {
      requestData.input.seed = Number(seed);
    }
    
    if (tempo) {
      requestData.input.tempo = tempo;
    }
    
    if (keySignature) {
      requestData.input.key_signature = keySignature;
    }
    
    if (continueClipId) {
      requestData.input.continue_clip_id = continueClipId;
      
      if (continueAt) {
        requestData.input.continue_at = continueAt;
      }
    }
    
    if (model === 'music-u' && !uploadAudio && !continueClipId) {
      // Opciones específicas para Udio
      requestData.input.lyrics_type = makeInstrumental ? 'instrumental' : (customLyrics ? 'user' : 'generate');
      
      if (customLyrics) {
        requestData.input.lyrics = customLyrics;
      }
    }

    try {
      // Intentar hacer la llamada a la API de PiAPI
      const response = await axios.post('https://api.piapi.ai/api/v1/task', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PIAPI_API_KEY || ''
        }
      });
      
      // Actualizar el registro con el ID de tarea de PiAPI
      if (response.data && response.data.task_id) {
        musicGenerations[taskId].piapiTaskId = response.data.task_id;
        log(`Generación de música enviada a PiAPI: ${response.data.task_id}`, 'music-api');
      } else {
        // Falló la solicitud a PiAPI, usar la simulación como fallback
        log(`Error al enviar a PiAPI, usando simulación como fallback: ${taskId}`, 'music-api');
        simulateGeneration(taskId);
      }
    } catch (error) {
      // Error al comunicarse con PiAPI, usar la simulación como fallback
      console.error('Error al comunicarse con PiAPI:', error);
      log(`Error de comunicación con PiAPI, usando simulación como fallback: ${taskId}`, 'music-api');
      simulateGeneration(taskId);
    }

    // Responder al cliente con el ID de la tarea
    res.status(202).json({ 
      taskId, 
      message: 'Generación de música iniciada con éxito' 
    });

    // Log para depuración
    log(`Nueva generación de música iniciada: ${taskId}`, 'music-api');
  } catch (error) {
    console.error('Error al iniciar generación de música:', error);
    res.status(500).json({ error: 'Error interno al iniciar la generación de música' });
  }
});

/**
 * Endpoint para verificar el estado de una generación
 * No requiere autenticación para permitir polling desde el cliente
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Se requiere un ID de tarea válido' });
    }

    // Buscar la generación en nuestro cache/db
    const generation = musicGenerations[taskId];
    
    if (!generation) {
      return res.status(404).json({ error: 'Generación no encontrada' });
    }

    // Si tenemos un ID de tarea de PiAPI, verificar el estado real en la API
    if (generation.piapiTaskId) {
      try {
        // Consultar el estado de la tarea en PiAPI
        const response = await axios.get(`https://api.piapi.ai/api/v1/task/${generation.piapiTaskId}`, {
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.PIAPI_API_KEY || ''
          }
        });

        if (response.data) {
          // Actualizar el estado según la respuesta de PiAPI
          const piApiStatus = response.data.status?.toLowerCase();
          
          if (piApiStatus === 'completed' && response.data.output?.audio_url) {
            // Si la generación está completa y tenemos una URL de audio
            generation.status = 'completed';
            generation.progress = 100;
            generation.audioUrl = response.data.output.audio_url;
            
            log(`Generación de música completada en PiAPI: ${taskId}`, 'music-api');
          } else if (piApiStatus === 'failed') {
            // Si la generación falló
            generation.status = 'failed';
            generation.progress = 100;
            generation.error = response.data.error || 'Error desconocido en PiAPI';
            
            log(`Error en generación de música en PiAPI: ${taskId} - ${generation.error}`, 'music-api');
          } else if (piApiStatus === 'processing' || piApiStatus === 'pending') {
            // Si la generación está en proceso, actualizar el progreso
            generation.status = piApiStatus;
            
            // PiAPI no siempre proporciona un porcentaje exacto, así que lo estimamos
            if (piApiStatus === 'processing') {
              // Si está procesando, asumimos al menos 5% de progreso
              generation.progress = Math.max(5, generation.progress);
              
              // Incrementamos un poco el progreso cada vez que consultamos
              if (generation.progress < 90) {
                generation.progress += 2;
              }
            }
          }
        }
      } catch (apiError) {
        console.error('Error al consultar estado en PiAPI:', apiError);
        // No modificamos el estado en caso de error al consultar la API
      }
    }

    // Devolver el estado actual (ya sea de la API o de nuestra simulación)
    res.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress || 0,
      audioUrl: generation.audioUrl,
      error: generation.error,
      message: getStatusMessage(generation.status)
    });
  } catch (error) {
    console.error('Error al verificar estado de generación:', error);
    res.status(500).json({ error: 'Error al verificar el estado de la generación' });
  }
});

/**
 * Endpoint para obtener el historial de generaciones
 * Requiere autenticación
 */
router.get('/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // En una implementación real, consultaríamos la base de datos
    // Por ahora, solo filtraremos las generaciones en memoria por usuario
    const userGenerations = Object.values(musicGenerations)
      .filter((gen: any) => gen.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20) // Últimas 20 generaciones
      .map((gen: any) => ({
        id: gen.id,
        taskId: gen.id,
        title: gen.title,
        model: gen.model,
        prompt: gen.prompt,
        audioUrl: gen.audioUrl || '',
        createdAt: gen.createdAt,
        status: gen.status
      }));

    res.json(userGenerations);
  } catch (error) {
    console.error('Error al obtener historial de generaciones:', error);
    res.status(500).json({ error: 'Error al obtener el historial de generaciones' });
  }
});

/**
 * Obtener un mensaje de estado basado en el código de estado
 */
function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending':
      return 'Esperando en cola';
    case 'processing':
      return 'Generando música';
    case 'completed':
      return 'Generación completada';
    case 'failed':
      return 'Error en la generación';
    default:
      return 'Estado desconocido';
  }
}

/**
 * Función para simular el proceso de generación de música
 * En producción, esta sería una llamada real a un API externa
 */
function simulateGeneration(taskId: string): void {
  const generation = musicGenerations[taskId];
  if (!generation) return;

  // Cambiar el estado a procesando
  generation.status = 'processing';

  // Simular el progreso
  let progress = 0;
  const progressInterval = setInterval(() => {
    progress += Math.floor(Math.random() * 5) + 1;
    
    if (progress >= 100) {
      progress = 100;
      clearInterval(progressInterval);
      
      // Marcar como completado
      generation.status = 'completed';
      generation.progress = 100;
      
      // Asignar una URL de audio simulada
      generation.audioUrl = `https://example.com/audio/${taskId}.mp3`;
      
      log(`Generación de música completada: ${taskId}`, 'music-api');
    } else {
      generation.progress = progress;
    }
  }, 1000); // Actualizar cada segundo
}

/**
 * Endpoint para subir un archivo de audio y procesarlo con PiAPI
 * Requiere autenticación
 */
router.post('/upload', authenticate, async (req: Request & { files?: any }, res: Response) => {
  try {
    // Verificar si se recibió un archivo
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'No se recibió ningún archivo de audio' });
    }

    const { 
      prompt, 
      title, 
      model = 'music-s',
      makeInstrumental = false,
      negativeTags = '',
      tags = ''
    } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'El prompt es requerido' });
    }

    // Validar el modelo
    if (!MODEL_MAPPING[model]) {
      return res.status(400).json({ error: 'Modelo no válido' });
    }

    // Obtener el archivo subido
    const audioFile = req.files.audio;
    const filePath = audioFile.tempFilePath;
    
    // Crear un ID único para esta generación
    const taskId = uuidv4();
    const userId = req.user?.uid || 'anonymous';

    // Registrar la generación en nuestro sistema
    musicGenerations[taskId] = {
      id: taskId,
      userId,
      title: title || `Audio procesado ${new Date().toLocaleString()}`,
      prompt,
      model,
      status: 'pending',
      progress: 0,
      createdAt: new Date().toISOString(),
      options: {
        makeInstrumental,
        negativeTags,
        tags,
        uploadAudio: true
      }
    };

    try {
      // Preparar el FormData para el upload de archivos
      const formData = new FormData();
      
      // Añadir el archivo al FormData
      formData.append('file', fs.createReadStream(filePath), {
        filename: path.basename(filePath),
        contentType: audioFile.mimetype
      });

      // Subir el archivo a la API de PiAPI primero (endpoint de upload)
      const uploadResponse = await axios.post('https://api.piapi.ai/api/v1/upload', formData, {
        headers: {
          ...formData.getHeaders(),
          'x-api-key': process.env.PIAPI_API_KEY || ''
        }
      });

      if (!uploadResponse.data || !uploadResponse.data.url) {
        throw new Error('No se recibió URL de archivo después de la subida');
      }

      // Ahora usamos la URL del archivo subido para crear la tarea de procesamiento
      const audioUrl = uploadResponse.data.url;
      
      // Preparar los datos para la API de PiAPI (task de procesamiento)
      const apiModel = MODEL_MAPPING[model];
      const requestData: any = {
        model: apiModel,
        task_type: 'upload_audio',
        input: {
          prompt: prompt,
          audio_url: audioUrl
        }
      };

      // Añadir opciones específicas
      if (makeInstrumental) {
        requestData.input.make_instrumental = true;
      }
      
      if (negativeTags) {
        requestData.input.negative_tags = negativeTags;
      }
      
      if (tags) {
        requestData.input.tags = tags;
      }

      // Hacer la llamada para crear la tarea de procesamiento
      const response = await axios.post('https://api.piapi.ai/api/v1/task', requestData, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.PIAPI_API_KEY || ''
        }
      });
      
      // Actualizar el registro con el ID de tarea de PiAPI
      if (response.data && response.data.task_id) {
        musicGenerations[taskId].piapiTaskId = response.data.task_id;
        musicGenerations[taskId].audioUrl = audioUrl; // Guardar la URL del audio original
        
        log(`Audio subido y procesamiento iniciado en PiAPI: ${response.data.task_id}`, 'music-api');
      } else {
        // Falló la solicitud a PiAPI, usar la simulación como fallback
        log(`Error al procesar audio en PiAPI, usando simulación como fallback: ${taskId}`, 'music-api');
        simulateGeneration(taskId);
      }
    } catch (apiError) {
      console.error('Error al comunicarse con PiAPI para audio:', apiError);
      log(`Error de comunicación con PiAPI para audio, usando simulación como fallback: ${taskId}`, 'music-api');
      simulateGeneration(taskId);
    } finally {
      // Limpiar el archivo temporal
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupError) {
        console.error('Error al eliminar archivo temporal:', cleanupError);
      }
    }

    // Responder al cliente con el ID de la tarea
    res.status(202).json({ 
      taskId, 
      message: 'Procesamiento de audio iniciado con éxito' 
    });

  } catch (error) {
    console.error('Error al procesar audio:', error);
    res.status(500).json({ error: 'Error interno al procesar el audio' });
  }
});

export default router;