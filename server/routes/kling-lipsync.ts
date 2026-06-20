/**
 * Rutas específicas para el manejo de LipSync con la API de PiAPI/Kling
 * 
 * Este módulo proporciona endpoints especializados para la sincronización
 * de labios en videos usando la tecnología de Kling a través de PiAPI.
 */

import express, { Request, Response } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { db } from '../firebase';
import { authenticate } from '../middleware/auth';
import axios from 'axios';
import FormData from 'form-data';

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

// Obtener la clave API de PiAPI desde las variables de entorno
const PIAPI_API_KEY = process.env.PIAPI_API_KEY;

// Verificar que la clave API esté configurada
if (!PIAPI_API_KEY) {
  console.warn('⚠️ PIAPI_API_KEY no está configurado. La funcionalidad de LipSync no estará disponible.');
}

/**
 * Endpoint para iniciar un proceso de LipSync
 * Este endpoint recibe un archivo de audio o texto para sincronizar
 * con los labios de un video específico
 */
router.post('/lipsync/start', authenticate, upload.single('audioFile'), async (req: Request, res: Response) => {
  try {
    // Verificar autenticación y parámetros
    if (!req.user?.uid) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    const { videoTaskId, clipId, method, voiceTimbre, voiceSpeed, lyrics } = req.body;
    const audioFile = req.file;
    const userId = req.user.uid;

    if (!videoTaskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere el ID de la tarea de video (videoTaskId)' 
      });
    }

    // Verificar si el video fue comprado por el usuario
    const purchasesRef = db.collection('purchases');
    const purchaseQuery = await purchasesRef
      .where('userId', '==', userId)
      .where('videoId', '==', videoTaskId)
      .where('status', '==', 'completed')
      .get();
    
    // También verificar si el video pertenece al usuario
    const videoRef = db.collection('video_generations').doc(videoTaskId);
    const videoDoc = await videoRef.get();
    
    if (!videoDoc.exists) {
      console.warn(`Video ${videoTaskId} no encontrado`);
      return res.status(404).json({
        success: false,
        error: 'El video especificado no existe'
      });
    }
    
    const videoData = videoDoc.data();
    
    // Comprobar si el usuario es dueño del video
    const isOwner = videoData?.userId === userId;
    
    // Determinar si el video fue comprado o tiene acceso premium
    const isPurchased = !purchaseQuery.empty || videoData?.isPurchased === true || videoData?.premiumAccess === true;
    
    if (!isOwner) {
      console.warn(`El usuario ${userId} no es propietario del video ${videoTaskId}`);
      return res.status(403).json({
        success: false,
        error: 'No tienes permiso para modificar este video'
      });
    }
    
    if (!isPurchased) {
      console.warn(`El usuario ${userId} no ha comprado el video ${videoTaskId}`);
      return res.status(402).json({
        success: false,
        error: 'Necesitas comprar el video completo para usar la función de LipSync',
        requiresPurchase: true
      });
    }
    
    console.log(`Verificación de compra exitosa para el video ${videoTaskId} del usuario ${userId}`);

    if (method !== 'audio' && method !== 'lyrics') {
      return res.status(400).json({ 
        success: false, 
        error: 'Método no válido. Debe ser "audio" o "lyrics".' 
      });
    }

    if (method === 'audio' && !audioFile) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere un archivo de audio para el método "audio".' 
      });
    }

    if (method === 'lyrics' && !lyrics) {
      return res.status(400).json({ 
        success: false, 
        error: 'Se requiere texto para el método "lyrics".' 
      });
    }

    // Preparar el cuerpo de la solicitud según la estructura de PiAPI
    const requestBody: any = {
      model: "kling",
      task_type: "lip_sync",
      input: {
        origin_task_id: videoTaskId
      }
    };

    // Configurar según el método seleccionado
    if (method === 'audio' && audioFile) {
      try {
        // Leer el archivo de audio
        const fileData = fs.readFileSync(audioFile.path);
        
        // Crear un FormData para subir el archivo directamente a PiAPI
        const formData = new FormData();
        formData.append('file', fileData, {
          filename: audioFile.originalname,
          contentType: audioFile.mimetype || 'audio/mp3'
        });
        
        // Subir el archivo a PiAPI para obtener la URL
        const uploadResponse = await axios.post(
          'https://api.piapi.ai/api/v1/uploads/file',
          formData,
          {
            headers: {
              'Authorization': `Bearer ${PIAPI_API_KEY}`,
              ...formData.getHeaders()
            }
          }
        );
        
        if (!uploadResponse.data.success) {
          throw new Error('Error al subir el archivo de audio a PiAPI');
        }
        
        const audioUrl = uploadResponse.data.url;
        
        // Configurar para usar el archivo de audio
        requestBody.input.local_dubbing_url = audioUrl;
        // Estos campos deben estar vacíos cuando usamos un archivo de audio
        requestBody.input.tts_text = "";
        requestBody.input.tts_timbre = "";
        requestBody.input.tts_speed = 1;
        
        // Eliminar el archivo temporal después de subirlo
        fs.unlinkSync(audioFile.path);
      } catch (error) {
        console.error('Error al procesar el archivo de audio:', error);
        return res.status(500).json({
          success: false,
          error: 'Error al procesar el archivo de audio. Intenta con un formato diferente.'
        });
      }
    } else if (method === 'lyrics') {
      // Configurar para generar voz con el texto proporcionado
      requestBody.input.tts_text = lyrics;
      requestBody.input.tts_timbre = voiceTimbre || "Rock"; // Timbre por defecto
      requestBody.input.tts_speed = parseFloat(voiceSpeed) || 1;
      requestBody.input.local_dubbing_url = "";
    }

    console.log('Enviando solicitud a PiAPI para LipSync:', JSON.stringify(requestBody, null, 2));

    // Enviar la solicitud a la API de PiAPI
    const apiResponse = await axios.post('https://api.piapi.ai/api/v1/task', requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PIAPI_API_KEY}`
      }
    });

    console.log('Respuesta de PiAPI:', apiResponse.data);

    // Verificar respuesta y extraer taskId
    let taskId = '';
    if (apiResponse.data && apiResponse.data.task_id) {
      taskId = apiResponse.data.task_id;
    } else if (apiResponse.data && apiResponse.data.data && apiResponse.data.data.task_id) {
      taskId = apiResponse.data.data.task_id;
    } else {
      throw new Error('No se pudo obtener el taskId de la respuesta de la API');
    }

    // Guardar información de la tarea en Firestore para seguimiento
    await db.collection('lipsync_tasks').doc(taskId).set({
      userId: req.user.uid,
      videoTaskId,
      method,
      ...(method === 'lyrics' ? { 
        lyrics, 
        voiceTimbre: voiceTimbre || "Rock",
        voiceSpeed: parseFloat(voiceSpeed) || 1
      } : {}),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Enviar respuesta con el taskId para seguimiento
    res.status(200).json({
      success: true,
      taskId,
      message: 'Proceso de LipSync iniciado correctamente'
    });

  } catch (error) {
    console.error('Error al iniciar proceso de LipSync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor al procesar la solicitud'
    });

    // Eliminar el archivo temporal en caso de error si se subió uno
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
  }
});

/**
 * Endpoint para verificar el estado de un proceso de LipSync
 */
router.get('/lipsync/status', async (req: Request, res: Response) => {
  try {
    const { taskId } = req.query;
    
    if (!taskId || typeof taskId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un taskId válido'
      });
    }

    // Verificar el estado en Firestore primero
    const taskDoc = await db.collection('lipsync_tasks').doc(taskId).get();
    
    if (!taskDoc.exists) {
      return res.status(404).json({
        success: false,
        error: 'Tarea no encontrada'
      });
    }

    const taskData = taskDoc.data();
    
    // Si la tarea ya está completada o falló, devolver el estado guardado
    if (taskData?.status === 'completed' || taskData?.status === 'failed') {
      return res.status(200).json({
        success: true,
        status: taskData.status,
        progress: taskData.status === 'completed' ? 100 : 0,
        videoUrl: taskData.videoUrl || null,
        error: taskData.error || null
      });
    }

    // Consultar el estado directamente a la API de PiAPI
    const statusResponse = await axios.get(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: {
        'Authorization': `Bearer ${PIAPI_API_KEY}`,
        'Accept': 'application/json'
      }
    });

    // Extraer la información relevante de la respuesta
    let status = 'processing';
    let progress = 0;
    let videoUrl = null;
    let error = null;

    // Manejar la estructura de respuesta anidada
    let responseData = statusResponse.data;
    
    // Verificar si la respuesta tiene una estructura anidada
    if (responseData.data && typeof responseData.data === 'object') {
      responseData = responseData.data;
    }
    
    // Determinar el estado basado en la respuesta
    if (responseData.status === 'completed' || responseData.status === 'success') {
      status = 'completed';
      progress = 100;
      
      // Extraer la URL del video resultante
      if (responseData.result && responseData.result.video_url) {
        videoUrl = responseData.result.video_url;
      } else if (responseData.video_url) {
        videoUrl = responseData.video_url;
      }
      
      // Actualizar en Firestore
      await db.collection('lipsync_tasks').doc(taskId).update({
        status: 'completed',
        progress: 100,
        videoUrl,
        updatedAt: new Date()
      });
      
    } else if (responseData.status === 'failed' || responseData.error) {
      status = 'failed';
      error = responseData.error || 'Error desconocido en el proceso de LipSync';
      
      // Actualizar en Firestore
      await db.collection('lipsync_tasks').doc(taskId).update({
        status: 'failed',
        error,
        updatedAt: new Date()
      });
      
    } else {
      // Calcular el progreso estimado
      progress = responseData.progress || Math.min((Date.now() - new Date(taskData?.createdAt?.toDate()).getTime()) / (3 * 60 * 1000) * 100, 95);
      
      // Actualizar en Firestore
      await db.collection('lipsync_tasks').doc(taskId).update({
        progress,
        updatedAt: new Date()
      });
    }

    // Enviar respuesta al cliente
    res.status(200).json({
      success: true,
      status,
      progress,
      videoUrl,
      error
    });
    
  } catch (error) {
    console.error('Error al verificar estado de LipSync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor al verificar el estado'
    });
  }
});

/**
 * Endpoint para obtener historial de tareas de LipSync del usuario
 */
router.get('/lipsync/history', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user?.uid) {
      return res.status(401).json({ success: false, error: 'Usuario no autenticado' });
    }

    // Obtener las tareas del usuario ordenadas por fecha
    const tasksSnapshot = await db.collection('lipsync_tasks')
      .where('userId', '==', req.user.uid)
      .orderBy('createdAt', 'desc')
      .limit(20) // Limitar a las 20 más recientes
      .get();
    
    const tasks = tasksSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    res.status(200).json({
      success: true,
      tasks
    });
    
  } catch (error) {
    console.error('Error al obtener historial de LipSync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error interno del servidor'
    });
  }
});

export default router;