/**
 * Rutas para la generaciÃ³n de mÃºsica con IA
 * 
 * Estas rutas manejan la generaciÃ³n asÃ­ncrona de mÃºsica,
 * el seguimiento del estado de generaciÃ³n y la gestiÃ³n
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
import { generateMusicWithLyria3, isLyriaConfigured, type Lyria3CompositionParams } from '../services/lyria3-service';
import { buildMusicTags, buildAudioMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';
import { db as firebaseDb, storage as firebaseStorage } from '../firebase';

const router = Router();

router.get('/providers', authenticate, (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const googleConfigured = isLyriaConfigured();
  const lyriaReady = googleConfigured && Boolean(firebaseStorage) && Boolean(firebaseDb);
  const falKeyConfigured = Boolean(process.env.FAL_KEY || process.env.FAL_API_KEY);
  const falConfigured = falKeyConfigured && Boolean(firebaseDb);
  const notConfigured = (name: string) => `${name} API credentials are not configured`;
  res.json({ success: true, models: {
    'music-lyria3': { available: lyriaReady, provider: 'Google Lyria 3.5', modelId: 'lyria-3.5', reason: !googleConfigured ? 'Google API key is missing' : !firebaseStorage ? 'Firebase Storage is required to persist generated audio' : !firebaseDb ? 'Firebase Firestore is required to save generation status' : undefined },
    'music-lyria-clip': { available: lyriaReady, provider: 'Google Lyria Clip', modelId: 'lyria-3-clip-preview', reason: !googleConfigured ? 'Google API key is missing' : !firebaseStorage ? 'Firebase Storage is required to persist generated audio' : !firebaseDb ? 'Firebase Firestore is required to save generation status' : undefined },
    'music-fal': { available: falConfigured, provider: 'MiniMax Music 3', modelId: 'minimax/music-3', reason: !falKeyConfigured ? notConfigured('FAL') : !firebaseDb ? 'Firebase Firestore is required to track generation status' : undefined },
    'music-stable': { available: falConfigured, provider: 'Stable Audio 2.5', modelId: 'fal-ai/stable-audio-25/text-to-audio', reason: !falKeyConfigured ? notConfigured('FAL') : !firebaseDb ? 'Firebase Firestore is required to track generation status' : undefined },
  } });
});

// Configurar middleware para manejo de archivos
router.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB lÃ­mite mÃ¡ximo
  useTempFiles: true,
  tempFileDir: path.join(os.tmpdir(), 'music-uploads')
}));

// Mapeo de modelos internos a modelos de la API de PiAPI
const MODEL_MAPPING: Record<string, string> = {
  'music-s': 'suno-v3-music',
  'music-u': 'udio-v1-music'
};

// Estado en memoria para seguimiento de generaciones (en producciÃ³n usarÃ­amos una base de datos)
const musicGenerations: Record<string, any> = {};

// El endpoint de prueba se ha movido a server/routes.ts para evitar problemas con el middleware de autenticaciÃ³n

/**
 * Endpoint para iniciar una generaciÃ³n de mÃºsica
 * Requiere autenticaciÃ³n
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
      return res.status(400).json({ error: 'Modelo no vÃ¡lido' });
    }

    // Crear un ID Ãºnico para esta generaciÃ³n
    const taskId = uuidv4();
    const userId = req.user?.uid || 'anonymous';

    // Verificar que el usuario tiene permisos para generar mÃºsica
    // En producciÃ³n, aquÃ­ podrÃ­amos verificar lÃ­mites o suscripciones

    // Registro de la generaciÃ³n en nuestra base de datos o cache
    musicGenerations[taskId] = {
      id: taskId,
      userId,
      title: title || `GeneraciÃ³n ${new Date().toLocaleString()}`,
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
      log(`ðŸŽµ Lyria 3 generation initiated: ${taskId}`, 'music-api');
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
            log(`âœ… Lyria 3 generation completed: ${taskId}`, 'music-api');
          } else {
            musicGenerations[taskId].status = 'failed';
            musicGenerations[taskId].error = result.error || 'Generation failed';
            log(`âŒ Lyria 3 generation failed: ${result.error}`, 'music-api');
          }
        } catch (error: any) {
          musicGenerations[taskId].status = 'failed';
          musicGenerations[taskId].error = error.message || 'Unknown error';
          log(`âŒ Lyria 3 generation error: ${error.message}`, 'music-api');
        }
      })();

      return res.status(202).json({
        taskId,
        message: 'GeneraciÃ³n de mÃºsica con Lyria 3 iniciada con Ã©xito'
      });
    }

    // ============================================================
    // PIAPI (Suno/Udio) - Standard generation path
    // ============================================================

    // Determinar el tipo de tarea adecuado segÃºn las opciones
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

    // AÃ±adir opciones especÃ­ficas segÃºn el tipo de tarea
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
      // Opciones especÃ­ficas para Udio
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
        log(`GeneraciÃ³n de mÃºsica enviada a PiAPI: ${response.data.task_id}`, 'music-api');
      } else {
        // FallÃ³ la solicitud a PiAPI, usar la simulaciÃ³n como fallback
        log(`Error al enviar a PiAPI, usando simulaciÃ³n como fallback: ${taskId}`, 'music-api');
        simulateGeneration(taskId);
      }
    } catch (error) {
      // Error al comunicarse con PiAPI, usar la simulaciÃ³n como fallback
      console.error('Error al comunicarse con PiAPI:', error);
      log(`Error de comunicaciÃ³n con PiAPI, usando simulaciÃ³n como fallback: ${taskId}`, 'music-api');
      simulateGeneration(taskId);
    }

    // Responder al cliente con el ID de la tarea
    res.status(202).json({ 
      taskId, 
      message: 'GeneraciÃ³n de mÃºsica iniciada con Ã©xito'
    });

    // Log para depuraciÃ³n
    log(`Nueva generaciÃ³n de mÃºsica iniciada: ${taskId}`, 'music-api');
  } catch (error) {
    console.error('Error al iniciar generaciÃ³n de mÃºsica:', error);
    res.status(500).json({ error: 'Error interno al iniciar la generaciÃ³n de mÃºsica' });
  }
});

/**
 * Endpoint para verificar el estado de una generaciÃ³n
 * No requiere autenticaciÃ³n para permitir polling desde el cliente
 */
router.get('/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;

    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({ error: 'Se requiere un ID de tarea vÃ¡lido' });
    }

    // Buscar la generaciÃ³n en nuestro cache/db
    const generation = musicGenerations[taskId];
    if (!generation) return res.status(404).json({ error: 'Generation not found' });
    if (String(generation.userId) !== String(req.user?.uid || req.user?.id)) {
      return res.status(403).json({ error: 'This generation belongs to another account' });
    }
    
    if (!generation) {
      return res.status(404).json({ error: 'GeneraciÃ³n no encontrada' });
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
          // Actualizar el estado segÃºn la respuesta de PiAPI
          const piApiStatus = response.data.status?.toLowerCase();
          
          if (piApiStatus === 'completed' && response.data.output?.audio_url) {
            // Si la generaciÃ³n estÃ¡ completa y tenemos una URL de audio
            generation.status = 'completed';
            generation.progress = 100;
            generation.audioUrl = response.data.output.audio_url;
            
            log(`GeneraciÃ³n de mÃºsica completada en PiAPI: ${taskId}`, 'music-api');
          } else if (piApiStatus === 'failed') {
            // Si la generaciÃ³n fallÃ³
            generation.status = 'failed';
            generation.progress = 100;
            generation.error = response.data.error || 'Error desconocido en PiAPI';
            
            log(`Error en generaciÃ³n de mÃºsica en PiAPI: ${taskId} - ${generation.error}`, 'music-api');
          } else if (piApiStatus === 'processing' || piApiStatus === 'pending') {
            // Si la generaciÃ³n estÃ¡ en proceso, actualizar el progreso
            generation.status = piApiStatus;
            
            // PiAPI no siempre proporciona un porcentaje exacto, asÃ­ que lo estimamos
            if (piApiStatus === 'processing') {
              // Si estÃ¡ procesando, asumimos al menos 5% de progreso
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

    // Devolver el estado actual (ya sea de la API o de nuestra simulaciÃ³n)
    res.json({
      id: generation.id,
      status: generation.status,
      progress: generation.progress || 0,
      audioUrl: generation.audioUrl,
      error: generation.error,
      message: getStatusMessage(generation.status)
    });
  } catch (error) {
    console.error('Error al verificar estado de generaciÃ³n:', error);
    res.status(500).json({ error: 'Error al verificar el estado de la generaciÃ³n' });
  }
});

/**
 * Endpoint para obtener el historial de generaciones
 * Requiere autenticaciÃ³n
 */
router.get('/recent', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // En una implementaciÃ³n real, consultarÃ­amos la base de datos
    // Por ahora, solo filtraremos las generaciones en memoria por usuario
    const userGenerations = Object.values(musicGenerations)
      .filter((gen: any) => gen.userId === userId)
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20) // Ãšltimas 20 generaciones
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
 * Obtener un mensaje de estado basado en el cÃ³digo de estado
 */
function getStatusMessage(status: string): string {
  switch (status) {
    case 'pending':
      return 'Esperando en cola';
    case 'processing':
      return 'Generando mÃºsica';
    case 'completed':
      return 'GeneraciÃ³n completada';
    case 'failed':
      return 'Error en la generaciÃ³n';
    default:
      return 'Estado desconocido';
  }
}

/**
 * FunciÃ³n para simular el proceso de generaciÃ³n de mÃºsica
 * En producciÃ³n, esta serÃ­a una llamada real a un API externa
 */
function simulateGeneration(taskId: string): void {
  const generation = musicGenerations[taskId];
  if (!generation) return;
  generation.status = 'failed';
  generation.progress = 100;
  generation.error = 'The music provider did not return a real generation. Check the provider connection and try again.';
}

/**
 * Endpoint para subir un archivo de audio y procesarlo con PiAPI
 * Requiere autenticaciÃ³n
 */
router.post('/upload', authenticate, async (req: Request & { files?: any }, res: Response) => {
  try {
    // Verificar si se recibiÃ³ un archivo
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'No se recibiÃ³ ningÃºn archivo de audio' });
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
      return res.status(400).json({ error: 'Modelo no vÃ¡lido' });
    }

    // Obtener el archivo subido
    const audioFile = req.files.audio;
    const filePath = audioFile.tempFilePath;
    
    // Crear un ID Ãºnico para esta generaciÃ³n
    const taskId = uuidv4();
    const userId = req.user?.uid || 'anonymous';

    // Registrar la generaciÃ³n en nuestro sistema
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
      
      // AÃ±adir el archivo al FormData
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
        throw new Error('No se recibiÃ³ URL de archivo despuÃ©s de la subida');
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

      // AÃ±adir opciones especÃ­ficas
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
        // FallÃ³ la solicitud a PiAPI, usar la simulaciÃ³n como fallback
        log(`Error al procesar audio en PiAPI, usando simulaciÃ³n como fallback: ${taskId}`, 'music-api');
        simulateGeneration(taskId);
      }
    } catch (apiError) {
      console.error('Error al comunicarse con PiAPI para audio:', apiError);
      log(`Error de comunicaciÃ³n con PiAPI para audio, usando simulaciÃ³n como fallback: ${taskId}`, 'music-api');
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
      message: 'Procesamiento de audio iniciado con Ã©xito'
    });

  } catch (error) {
    console.error('Error al procesar audio:', error);
    res.status(500).json({ error: 'Error interno al procesar el audio' });
  }
});

export default router;
