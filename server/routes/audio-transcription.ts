import { Router } from 'express';
import type { Request, Response } from 'express';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { fal } from '@fal-ai/client';
import fs from 'fs';
import path from 'path';
import { isAuthenticated } from '../middleware/clerk-auth';

const router = Router();

// Use Clerk auth middleware
const requireAuth = isAuthenticated;

const openAiApiKey = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

const openai = createTrackedOpenAI({
  apiKey: openAiApiKey
});

// Configurar FAL como fallback
if (process.env.FAL_KEY) {
  fal.config({
    credentials: process.env.FAL_KEY
  });
}

// Ruta de prueba para verificar la API key (con autenticación)
router.get('/test-connection', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('🧪 Probando conexión con OpenAI...');
    console.log('📋 API Key presente:', !!openAiApiKey);
    console.log('📋 Primeros caracteres:', openAiApiKey?.substring(0, 20) + '...');

    if (!openAiApiKey) {
      return res.status(500).json({
        success: false,
        error: 'No hay API key de OpenAI configurada (OPENAI_API_KEY2 u OPENAI_API_KEY)'
      });
    }
    
    // Intentar listar modelos como prueba simple
    const models = await openai.models.list();
    console.log('✅ Conexión exitosa con OpenAI');
    
    return res.json({
      success: true,
      message: 'Conexión exitosa con OpenAI',
      modelCount: models.data.length
    });
  } catch (error: any) {
    console.error('❌ Error probando conexión:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
      type: error.constructor.name
    });
  }
});

// Ruta de prueba para FAL
router.get('/test-fal', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('🧪 Probando FAL...');
    console.log('📋 FAL_KEY presente:', !!process.env.FAL_KEY);
    
    if (!process.env.FAL_KEY) {
      return res.status(500).json({
        success: false,
        error: 'FAL_KEY no configurada',
        fal_configured: false
      });
    }

    // Crear un pequeño audio de prueba (1 segundo de silencio en base64)
    const silenceBase64 = 'SUQzBAAAAAAAI1NUVEUAAAALAAAARGlzcENvcmc/P1RBTEIAAAAACkFMQiBBTEIgQVBQTAEAAAA=';
    
    console.log('🚀 Enviando solicitud de prueba a FAL...');
    
    try {
      const falResult = await fal.subscribe('fal-ai/wizper', {
        input: {
          audio_url: `data:audio/mp3;base64,${silenceBase64}`,
          task: 'transcribe',
          chunk_level: 'segment'
          // Language auto-detected
        },
        logs: true
      });

      console.log('✅ Respuesta de FAL:', falResult);
      
      return res.json({
        success: true,
        message: 'Conexión exitosa con FAL',
        provider: 'fal-ai/wizper',
        result: falResult.data
      });
    } catch (falApiError: any) {
      console.error('❌ Error específico de FAL:', falApiError);
      console.error('📝 Tipo de error:', falApiError.constructor.name);
      console.error('📝 Mensaje:', falApiError.message);
      console.error('📝 Status:', falApiError.status);
      console.error('📝 Response:', falApiError.response);
      
      return res.status(500).json({
        success: false,
        error: 'Error de FAL',
        details: {
          message: falApiError.message,
          type: falApiError.constructor.name,
          status: falApiError.status,
          response: falApiError.response
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Error probando FAL:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      type: error.constructor.name
    });
  }
});

router.post('/transcribe', requireAuth, async (req: Request, res: Response) => {
  // Aumentar el timeout de esta ruta a 15 minutos para archivos grandes
  req.setTimeout(900000); // 15 minutos en milisegundos
  res.setTimeout(900000);
  
  try {
    const userId = (req.user as any)?.id;
    console.log('🎤 Solicitud de transcripción recibida');
    console.log('👤 Usuario:', userId);
    console.log('📋 OpenAI API key configurada:', !!openAiApiKey);
    console.log('📋 FAL key configurada:', !!process.env.FAL_KEY);
    
    if (!openAiApiKey && !process.env.FAL_KEY) {
      console.error('❌ Error: No hay provider de transcripción configurado (FAL/OpenAI)');
      return res.status(500).json({
        success: false,
        error: 'No hay provider de transcripción configurado. Configura FAL_KEY o OPENAI_API_KEY2/OPENAI_API_KEY.'
      });
    }

    if (!req.files || !(req.files as any).audio) {
      return res.status(400).json({
        success: false,
        error: 'No se recibió ningún archivo de audio'
      });
    }

    const filesObj = req.files as any;
    const audioFile = Array.isArray(filesObj.audio) 
      ? filesObj.audio[0] 
      : filesObj.audio;

    const allowedTypes = [
      'audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/mp4', 
      'audio/x-m4a', 'audio/aac', 'audio/flac', 'audio/ogg'
    ];
    const fileType = audioFile.mimetype.toLowerCase();
    const fileName = audioFile.name.toLowerCase();

    const isValidAudio = allowedTypes.includes(fileType) || 
                         fileType.includes('audio') ||
                         fileName.endsWith('.wav') || 
                         fileName.endsWith('.mp3') ||
                         fileName.endsWith('.m4a') ||
                         fileName.endsWith('.aac') ||
                         fileName.endsWith('.flac') ||
                         fileName.endsWith('.ogg');

    if (!isValidAudio) {
      return res.status(400).json({
        success: false,
        error: 'Formato de audio no soportado. Se permiten formatos de audio comunes.'
      });
    }

    const maxSize = 100 * 1024 * 1024; // 100MB
    if (audioFile.size > maxSize) {
      return res.status(400).json({
        success: false,
        error: 'El archivo de audio es demasiado grande. Máximo 100MB.'
      });
    }

    console.log(`🎵 Transcribiendo audio: ${audioFile.name} (${(audioFile.size / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`📁 Archivo temporal en: ${audioFile.tempFilePath}`);
    console.log(`📝 Nombre del archivo: ${audioFile.name}`);
    console.log(`🏷️ MIME type: ${audioFile.mimetype}`);

    // Extraer la extensión del archivo original
    const fileExtension = path.extname(audioFile.name).toLowerCase();
    
    // Crear una ruta temporal con la extensión correcta
    const tempPathWithExtension = audioFile.tempFilePath + fileExtension;
    
    // Renombrar el archivo temporal para que tenga la extensión correcta
    fs.renameSync(audioFile.tempFilePath, tempPathWithExtension);
    
    console.log(`📂 Archivo renombrado a: ${tempPathWithExtension}`);

    let transcription;
    let falError: any = null;
    let openaiError: any = null;

    // INTENTO 1: FAL primero (más rápido - 2x)
    console.log('🚀 Iniciando transcripción con FAL (fal-ai/wizper - el más rápido)...');
    
    if (!process.env.FAL_KEY) {
      console.warn('⚠️ FAL_KEY no configurada, saltando a OpenAI');
    } else {
      try {
        // FAL Wizper - Convertir archivo a buffer para envío directo
        console.log('📊 Preparando archivo para FAL...');
        const audioBuffer = fs.readFileSync(tempPathWithExtension);
        const audioBase64 = audioBuffer.toString('base64');
        
        // Determinar media type basado en la extensión
        let mimeType = 'audio/mpeg';
        if (fileExtension === '.wav') mimeType = 'audio/wav';
        else if (fileExtension === '.m4a') mimeType = 'audio/mp4';
        else if (fileExtension === '.aac') mimeType = 'audio/aac';
        else if (fileExtension === '.flac') mimeType = 'audio/flac';
        else if (fileExtension === '.ogg') mimeType = 'audio/ogg';
        
        const falResult = await fal.subscribe('fal-ai/wizper', {
          input: {
            audio_url: `data:${mimeType};base64,${audioBase64}`,
            task: 'transcribe'
            // Language auto-detected by Wizper for multilingual support
          },
          logs: true
        });

        console.log('✅ Transcripción FAL exitosa');
        console.log('📝 LETRA DE LA CANCIÓN (primeros 500 caracteres):');
        console.log('═'.repeat(60));
        console.log(falResult.data.text?.substring(0, 500) || 'Sin texto');
        console.log('═'.repeat(60));
        console.log('📊 Total caracteres:', falResult.data.text?.length || 0);
        
        // Limpiar el archivo temporal
        if (fs.existsSync(tempPathWithExtension)) {
          fs.unlinkSync(tempPathWithExtension);
        }

        // Detect language from result or let it be auto-detected
        const detectedLanguage = falResult.data.language || 'auto';
        console.log(`🌐 Idioma detectado por FAL Wizper: ${detectedLanguage}`);

        return res.json({
          success: true,
          transcription: {
            text: falResult.data.text,
            duration: null,
            language: detectedLanguage,
            provider: 'fal'
          }
        });

      } catch (error: any) {
        falError = error;
        console.error('❌ FAL Wizper falló:', error.message);
        console.error('📝 Error type:', error.constructor.name);
        console.error('🔄 Intentando fallback con FAL Audio Understanding...');
      }
      
      // INTENTO 1.5: FAL Audio Understanding como fallback de Wizper
      if (falError) {
        try {
          console.log('🎧 Intentando con fal-ai/audio-understanding...');
          const audioBuffer = fs.readFileSync(tempPathWithExtension);
          const audioBase64 = audioBuffer.toString('base64');
          
          let mimeType = 'audio/mpeg';
          if (fileExtension === '.wav') mimeType = 'audio/wav';
          else if (fileExtension === '.m4a') mimeType = 'audio/mp4';
          else if (fileExtension === '.aac') mimeType = 'audio/aac';
          else if (fileExtension === '.flac') mimeType = 'audio/flac';
          else if (fileExtension === '.ogg') mimeType = 'audio/ogg';
          
          const falAudioResult = await fal.subscribe('fal-ai/audio-understanding', {
            input: {
              audio_url: `data:${mimeType};base64,${audioBase64}`,
              task: 'transcription'
            },
            logs: true
          });

          console.log('✅ Transcripción FAL Audio Understanding exitosa');
          
          // Limpiar el archivo temporal
          if (fs.existsSync(tempPathWithExtension)) {
            fs.unlinkSync(tempPathWithExtension);
          }

          // Extraer texto de la respuesta (puede variar según el modelo)
          const transcribedText = falAudioResult.data.text || 
                                  falAudioResult.data.transcription || 
                                  falAudioResult.data.output || 
                                  JSON.stringify(falAudioResult.data);

          return res.json({
            success: true,
            transcription: {
              text: transcribedText,
              duration: null,
              language: 'auto',
              provider: 'fal-audio-understanding'
            }
          });

        } catch (audioError: any) {
          console.error('❌ FAL Audio Understanding también falló:', audioError.message);
          console.error('🔄 Intentando fallback final con OpenAI Whisper...');
        }
      }
    }

    // INTENTO 2: OpenAI como fallback (con reintentos)
    // Verificar tamaño del archivo antes de intentar con OpenAI (límite 25MB)
    const fileStats = fs.statSync(tempPathWithExtension);
    const fileSizeInMB = fileStats.size / (1024 * 1024);
    const openAiMaxSize = 25; // MB
    
    if (fileSizeInMB > openAiMaxSize) {
      console.warn(`⚠️ Archivo demasiado grande para OpenAI: ${fileSizeInMB.toFixed(2)}MB (límite: ${openAiMaxSize}MB)`);
      
      // Limpiar archivo temporal
      if (fs.existsSync(tempPathWithExtension)) {
        fs.unlinkSync(tempPathWithExtension);
      }
      
      return res.status(413).json({
        success: false,
        error: `El archivo de audio (${fileSizeInMB.toFixed(2)}MB) excede el límite de ${openAiMaxSize}MB de OpenAI Whisper.`,
        hint: 'Por favor, comprime el archivo de audio o usa un archivo más corto. FAL también falló como alternativa.',
        providers: {
          fal: falError ? 'failed' : 'not configured',
          openai: 'skipped (file too large)'
        }
      });
    }
    
    if (!openAiApiKey) {
      console.warn('⚠️ OpenAI no configurado. No se puede usar fallback tras fallo de FAL.');

      // Limpiar archivo temporal
      if (fs.existsSync(tempPathWithExtension)) {
        fs.unlinkSync(tempPathWithExtension);
      }

      return res.status(503).json({
        success: false,
        error: 'FAL falló y OpenAI no está configurado para fallback.',
        providers: {
          fal: process.env.FAL_KEY ? 'failed' : 'not configured',
          openai: 'not configured'
        }
      });
    }

    let retries = 5;
    let lastOpenaiError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`🔄 OpenAI Intento ${attempt} de ${retries}...`);

        // Crear un nuevo stream en cada intento
        const fileStream = fs.createReadStream(tempPathWithExtension);

        transcription = await openai.audio.transcriptions.create({
          file: fileStream,
          model: 'whisper-1',
          // Language auto-detected by Whisper for multilingual support
          response_format: 'verbose_json'
        }, {
          timeout: 300000, // 5 minutos de timeout por solicitud
          maxRetries: 0 // Desactivar reintentos internos para controlarlos nosotros
        });

        console.log(`✅ Transcripción OpenAI exitosa en intento ${attempt}`);

        // Limpiar el archivo temporal
        if (fs.existsSync(tempPathWithExtension)) {
          fs.unlinkSync(tempPathWithExtension);
        }

        const whisperLanguage = (transcription as any).language || 'auto';
        console.log(`🌐 Idioma detectado por OpenAI Whisper: ${whisperLanguage}`);

        return res.json({
          success: true,
          transcription: {
            text: transcription.text,
            duration: (transcription as any).duration || null,
            language: whisperLanguage,
            provider: 'openai'
          }
        });

      } catch (error: any) {
        lastOpenaiError = error;
        console.error(`❌ OpenAI Error en intento ${attempt}:`, error.message);
        console.error(`📝 Error code:`, error.code);

        // Si es el último intento, lanzar el error
        if (attempt === retries) {
          openaiError = error;
          throw error;
        }

        // Si es un error de conexión, esperar antes de reintentar
        if (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' ||
            error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' ||
            error.message?.includes('Connection') || error.message?.includes('network')) {
          const waitTime = attempt * 3000; // 3s, 6s, 9s, 12s
          console.log(`⏳ Esperando ${waitTime/1000}s antes de reintentar...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        } else {
          // Si no es error de conexión, no reintentar
          throw error;
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Error en transcripción:', error);
    console.error('📝 Detalles del error:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    let errorMessage = 'Error al transcribir el audio. Tanto FAL como OpenAI Whisper fallaron.';
    if (error.response?.data?.error?.message) {
      errorMessage = error.response.data.error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }

    // Limpiar el archivo temporal si existe
    const fileExtension = path.extname((req.files as any)?.audio?.name || '').toLowerCase();
    const tempPath = (req.files as any)?.audio?.tempFilePath;
    if (tempPath) {
      const tempPathWithExt = tempPath + fileExtension;
      if (fs.existsSync(tempPathWithExt)) {
        fs.unlinkSync(tempPathWithExt);
      }
    }

    // Determinar el estado de los providers basado en el error
    const falStatus = !process.env.FAL_KEY ? 'not configured' : 
                      (errorMessage.includes('FAL') ? 'failed' : 'skipped');
    const openaiStatus = errorMessage.includes('413') || errorMessage.includes('exceeded') 
                        ? 'file too large (max 25MB for OpenAI)' 
                        : 'failed';

    return res.status(500).json({
      success: false,
      error: errorMessage,
      providers: {
        fal: falStatus,
        openai: openaiStatus
      },
      hint: errorMessage.includes('exceeded') 
        ? 'El archivo excede el límite de 25MB de OpenAI. Intenta comprimir el audio o usar un archivo más pequeño.'
        : undefined
    });
  }
});

export default router;
