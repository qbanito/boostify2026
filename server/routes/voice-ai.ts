/**
 * Voice AI Routes - API para clonación y transformación de voz
 * 
 * Endpoints:
 * POST /api/voice-ai/clone - Clonar voz desde audio
 * POST /api/voice-ai/tts - Text-to-Speech con voz clonada
 * POST /api/voice-ai/change-voice - Cambiar voz en audio existente
 * POST /api/voice-ai/separate - Separar vocals/instrumental
 * POST /api/voice-ai/enhance - Mejorar calidad de audio
 * POST /api/voice-ai/create-song - Workflow completo: canción con tu voz
 * POST /api/voice-ai/design-voice - Crear voz desde descripción
 */

import express, { Router, Request, Response } from 'express';
import { UploadedFile } from 'express-fileupload';
import { logger } from '../utils/logger';
import VoiceAIService from '../services/voice-ai-service';

const router: Router = express.Router();

// Helper para validar archivos de audio
function isValidAudioFile(file: UploadedFile): boolean {
  const allowedMimes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/m4a', 'audio/x-m4a'];
  return allowedMimes.includes(file.mimetype) || file.mimetype.startsWith('audio/');
}

// Tipo para los archivos de express-fileupload
interface FileUploadRequest {
  audio?: UploadedFile | UploadedFile[];
}

// Helper para obtener archivo de audio de la request
function getAudioFile(req: Request): UploadedFile | null {
  const files = req.files as FileUploadRequest | null | undefined;
  if (!files || !files.audio) return null;
  const file = files.audio;
  // express-fileupload puede devolver array o single file
  return Array.isArray(file) ? file[0] : file;
}

/**
 * POST /api/voice-ai/clone
 * Clona la voz del usuario desde un audio de referencia
 * 
 * Body: { audioUrl: string, referenceText?: string }
 * O File upload: audio file + referenceText en body
 */
router.post('/clone', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /clone');
    
    let audioUrl = req.body.audioUrl;
    const referenceText = req.body.referenceText;
    const voiceName = req.body.voiceName || 'my_voice';
    
    // Si se subió un archivo via express-fileupload
    const audioFile = getAudioFile(req);
    if (audioFile) {
      // Validar tipo de archivo
      if (!isValidAudioFile(audioFile)) {
        return res.status(400).json({
          success: false,
          error: 'Solo se permiten archivos de audio (wav, mp3, ogg, webm, m4a)',
        });
      }
      
      logger.info(`[VoiceAI API] Archivo recibido: ${audioFile.name} (${audioFile.size} bytes)`);
      audioUrl = await VoiceAIService.uploadAudioToStorage(
        audioFile.data,
        audioFile.mimetype,
        'voice-samples'
      );
    }
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere audioUrl o archivo de audio',
      });
    }
    
    const result = await VoiceAIService.cloneVoice(audioUrl, referenceText);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /clone:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/tts
 * Text-to-Speech con voz clonada
 * 
 * Body: { text: string, speakerEmbeddingUrl: string, language?: string, referenceText?: string }
 */
router.post('/tts', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /tts');
    
    const { text, speakerEmbeddingUrl, voiceId, language, referenceText } = req.body;
    
    // Aceptar tanto speakerEmbeddingUrl como voiceId para compatibilidad
    const embeddingUrl = speakerEmbeddingUrl || voiceId;
    
    if (!text || !embeddingUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere text y speakerEmbeddingUrl (o voiceId)',
      });
    }
    
    const result = await VoiceAIService.textToSpeechWithVoice(text, embeddingUrl, {
      language,
      referenceText,
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /tts:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/change-voice
 * Cambia la voz en un audio existente
 * 
 * Body: { audioUrl: string, targetVoiceId: string }
 * O File upload: audio file + targetVoiceId en body
 */
router.post('/change-voice', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /change-voice');
    
    let audioUrl = req.body.audioUrl;
    const targetVoiceId = req.body.targetVoiceId;
    
    // Si se subió un archivo via express-fileupload
    const audioFile = getAudioFile(req);
    if (audioFile) {
      if (!isValidAudioFile(audioFile)) {
        return res.status(400).json({
          success: false,
          error: 'Solo se permiten archivos de audio',
        });
      }
      
      audioUrl = await VoiceAIService.uploadAudioToStorage(
        audioFile.data,
        audioFile.mimetype,
        'songs-to-convert'
      );
    }
    
    if (!audioUrl || !targetVoiceId) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere audioUrl y targetVoiceId',
      });
    }
    
    const result = await VoiceAIService.changeVoice(audioUrl, targetVoiceId);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /change-voice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/separate
 * Separa vocals e instrumental de un audio
 * 
 * Body: { audioUrl: string, target?: string }
 */
router.post('/separate', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /separate');
    
    const { audioUrl, target = 'vocals' } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere audioUrl',
      });
    }
    
    const result = await VoiceAIService.separateAudio(audioUrl, target);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /separate:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/enhance
 * Mejora la calidad del audio
 * 
 * Body: { audioUrl: string }
 */
router.post('/enhance', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /enhance');
    
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere audioUrl',
      });
    }
    
    const result = await VoiceAIService.enhanceAudio(audioUrl);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /enhance:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/create-song
 * Workflow completo: Crear canción con la voz del usuario
 * 
 * Este es el endpoint principal que hace TODO el proceso:
 * 1. Separa la canción en vocals + instrumental
 * 2. Transcribe los vocals para obtener la letra
 * 3. Genera nuevos vocals con TU voz clonada
 * 4. Devuelve instrumental + nuevos vocals para mezclar
 * 
 * Body: { 
 *   songUrl: string,           // URL de la canción generada con AI
 *   speakerEmbeddingUrl: string, // URL del speaker_embedding de tu voz clonada
 *   language?: string,         // Idioma (Auto, English, Spanish)
 *   enhanceOutput?: boolean    // Mejorar calidad del audio final
 * }
 */
router.post('/create-song', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /create-song - WORKFLOW COMPLETO');
    
    const { songUrl, speakerEmbeddingUrl, userVoiceId, language, enhanceOutput } = req.body;
    
    // Aceptar tanto speakerEmbeddingUrl como userVoiceId para compatibilidad
    const embeddingUrl = speakerEmbeddingUrl || userVoiceId;
    
    if (!songUrl || !embeddingUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere songUrl y speakerEmbeddingUrl (la URL de tu voz clonada)',
      });
    }
    
    const result = await VoiceAIService.createSongWithUserVoice(songUrl, embeddingUrl, {
      language: language || 'Auto',
      enhanceOutput: enhanceOutput || false,
    });
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /create-song:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/transcribe
 * Transcribe audio a texto
 * 
 * Body: { audioUrl: string }
 */
router.post('/transcribe', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /transcribe');
    
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere audioUrl',
      });
    }
    
    const result = await VoiceAIService.transcribeAudio(audioUrl);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /transcribe:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/voice-ai/design-voice
 * Crea una voz personalizada desde descripción de texto
 * 
 * Body: { description: string }
 */
router.post('/design-voice', async (req: Request, res: Response) => {
  try {
    logger.info('[VoiceAI API] POST /design-voice');
    
    const { description } = req.body;
    
    if (!description) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere description',
      });
    }
    
    const result = await VoiceAIService.designVoice(description);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error: any) {
    logger.error('[VoiceAI API] Error en /design-voice:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/voice-ai/models
 * Lista los modelos de Voice AI disponibles
 */
router.get('/models', (req: Request, res: Response) => {
  res.json({
    success: true,
    models: VoiceAIService.VOICE_AI_MODELS,
    features: [
      { id: 'clone', name: 'Clonar Voz', description: 'Clona tu voz desde un audio de 30 segundos' },
      { id: 'tts', name: 'Text-to-Speech', description: 'Genera audio con tu voz clonada' },
      { id: 'change', name: 'Voice Changer', description: 'Cambia la voz en cualquier canción' },
      { id: 'separate', name: 'Separar Audio', description: 'Extrae vocals o instrumental' },
      { id: 'enhance', name: 'Mejorar Audio', description: 'Mejora la calidad del audio a 48kHz' },
    ],
  });
});

export default router;
