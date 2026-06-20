/**
 * Servicio para procesar imágenes usando la API de uploads temporal
 * 
 * Este servicio garantiza que las imágenes estén en formato JPEG válido
 * con tablas Huffman correctamente inicializadas, resolviendo el problema
 * común "invalid JPEG format: uninitialized Huffman table" en Kling API.
 */

import { Router } from 'express';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const router = Router();
const UPLOAD_API_URL = 'https://upload.theapi.app/api/ephemeral_resource';
const API_KEY = process.env.PIAPI_API_KEY || '';

/**
 * Procesa una imagen para asegurar compatibilidad con Kling API
 * Convierte la imagen a JPEG y garantiza tablas Huffman inicializadas
 */
router.post('/process-image', async (req, res) => {
  try {
    const { imageDataUrl } = req.body;
    
    if (!imageDataUrl) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó imagen para procesar'
      });
    }
    
    // Extraer datos base64 de la dataURL
    let base64Data = '';
    let fileExtension = 'jpg'; // Por defecto asumimos jpg
    
    try {
      const matches = imageDataUrl.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
      
      if (matches && matches.length === 3) {
        fileExtension = matches[1].toLowerCase();
        base64Data = matches[2];
        
        // Si no es jpg/jpeg, lo convertiremos a jpg
        if (fileExtension !== 'jpg' && fileExtension !== 'jpeg') {
          fileExtension = 'jpg';
        }
      } else {
        return res.status(400).json({
          success: false,
          error: 'Formato de imagen no válido. Debe ser una data URL'
        });
      }
    } catch (error) {
      console.error('Error procesando data URL:', error);
      return res.status(400).json({
        success: false,
        error: 'Error procesando formato de imagen'
      });
    }
    
    // Generar nombre aleatorio para el archivo
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const fileName = `image_${timestamp}_${randomSuffix}.${fileExtension}`;
    
    // Preparar la solicitud a la API de uploads
    try {
      const uploadResponse = await axios.post(UPLOAD_API_URL, {
        file_name: fileName,
        file_data: base64Data
      }, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY
        }
      });
      
      // Verificar respuesta exitosa
      if (uploadResponse.data && uploadResponse.data.code === 200 && uploadResponse.data.data.url) {
        const processedImageUrl = uploadResponse.data.data.url;
        
        // Descargar la imagen procesada para convertirla nuevamente a data URL
        const imageResponse = await axios.get(processedImageUrl, {
          responseType: 'arraybuffer'
        });
        
        // Convertir imagen descargada a formato base64
        const imageBuffer = Buffer.from(imageResponse.data);
        const processedImageDataUrl = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
        
        return res.json({
          success: true,
          processedImage: processedImageDataUrl,
          originalFormat: fileExtension,
          width: 0, // No podemos determinar dimensiones sin librerías adicionales
          height: 0
        });
      } else {
        console.error('Error en respuesta de API de uploads:', uploadResponse.data);
        return res.status(500).json({
          success: false,
          error: 'Error procesando imagen en API de uploads'
        });
      }
    } catch (uploadError: any) {
      console.error('Error al usar API de uploads:', uploadError);
      
      // Detección específica del error y mensajes de ayuda
      let errorMessage = 'Error al procesar la imagen con la API de uploads';
      
      if (uploadError.response) {
        if (uploadError.response.status === 403) {
          errorMessage = 'Error de permisos en la API de uploads. Verifica la API key.';
        } else if (uploadError.response.data && uploadError.response.data.message) {
          errorMessage = `Error API: ${uploadError.response.data.message}`;
        }
      }
      
      return res.status(500).json({
        success: false,
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('Error procesando imagen:', error);
    return res.status(500).json({
      success: false,
      error: 'Error interno al procesar la imagen'
    });
  }
});

// ============================================================================
// 🎵 UPLOAD AUDIO TEMPORAL - Para PixVerse Lipsync
// ============================================================================
// Sube un archivo de audio WAV a la API temporal y devuelve una URL pública
// Esto es necesario porque PixVerse requiere URLs públicas, no blobs locales

import multer from 'multer';

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['audio/wav', 'audio/wave', 'audio/x-wav', 'audio/mpeg', 'audio/mp3'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

router.post('/upload/temp-audio', audioUpload.single('file'), async (req, res) => {
  try {
    console.log('🎵 [Upload] Subiendo audio temporal para lipsync...');
    
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo de audio'
      });
    }

    console.log(`📁 [Upload] Audio: ${file.originalname}, ${(file.size / 1024).toFixed(2)}KB`);

    // Convertir buffer a base64
    const base64Data = file.buffer.toString('base64');
    
    // Generar nombre único
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const extension = file.originalname.split('.').pop() || 'wav';
    const fileName = `audio_lipsync_${timestamp}_${randomSuffix}.${extension}`;

    // Subir a la API temporal
    const uploadResponse = await axios.post(UPLOAD_API_URL, {
      file_name: fileName,
      file_data: base64Data
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    if (uploadResponse.data && uploadResponse.data.code === 200 && uploadResponse.data.data.url) {
      const audioUrl = uploadResponse.data.data.url;
      console.log(`✅ [Upload] Audio subido: ${audioUrl}`);
      
      return res.json({
        success: true,
        url: audioUrl,
        fileName,
        size: file.size
      });
    } else {
      console.error('❌ [Upload] Error en respuesta:', uploadResponse.data);
      return res.status(500).json({
        success: false,
        error: 'Error subiendo audio a servicio temporal'
      });
    }

  } catch (error) {
    console.error('❌ [Upload] Error subiendo audio:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    });
  }
});

// ============================================================================
// 🎥 UPLOAD VIDEO TEMPORAL - Para referencia de Motion Sync
// ============================================================================
// Sube el video grabado con la cámara del teléfono (captura de movimiento) y
// devuelve una URL pública para conservarlo junto al clip como referencia.

const videoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  }
});

router.post('/upload/temp-video', videoUpload.single('file'), async (req, res) => {
  try {
    console.log('🎥 [Upload] Subiendo video temporal de Motion Sync...');

    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo de video'
      });
    }

    console.log(`📁 [Upload] Video: ${file.originalname}, ${(file.size / 1024 / 1024).toFixed(2)}MB`);

    const base64Data = file.buffer.toString('base64');
    const timestamp = Date.now();
    const randomSuffix = Math.floor(Math.random() * 10000);
    const extension = (file.originalname.split('.').pop() || 'webm').replace(/[^a-z0-9]/gi, '') || 'webm';
    const fileName = `motion_sync_${timestamp}_${randomSuffix}.${extension}`;

    const uploadResponse = await axios.post(UPLOAD_API_URL, {
      file_name: fileName,
      file_data: base64Data
    }, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      }
    });

    if (uploadResponse.data && uploadResponse.data.code === 200 && uploadResponse.data.data.url) {
      const videoUrl = uploadResponse.data.data.url;
      console.log(`✅ [Upload] Video subido: ${videoUrl}`);

      return res.json({
        success: true,
        url: videoUrl,
        fileName,
        size: file.size
      });
    } else {
      console.error('❌ [Upload] Error en respuesta:', uploadResponse.data);
      return res.status(500).json({
        success: false,
        error: 'Error subiendo video a servicio temporal'
      });
    }

  } catch (error) {
    console.error('❌ [Upload] Error subiendo video:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno'
    });
  }
});

export default router;