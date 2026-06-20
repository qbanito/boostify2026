import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { db } from '../firebase';
import { neon } from '@neondatabase/serverless';

const router = Router();
const sql = neon(process.env.DATABASE_URL!);

/**
 * Guardar un video generado en la base de datos
 */
router.post('/save', authenticate, async (req: Request, res: Response) => {
  try {
    const { songName, videoUrl, thumbnailUrl, duration, isPaid, paymentIntentId, amount, metadata, status } = req.body;
    const userId = req.user?.uid;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!songName || !videoUrl || !duration) {
      return res.status(400).json({ 
        success: false, 
        message: 'Faltan campos requeridos: songName, videoUrl, duration' 
      });
    }

    // Insertar el video en la base de datos
    const result = await sql`
      INSERT INTO generated_videos (
        user_id, song_name, video_url, thumbnail_url, duration, 
        is_paid, payment_intent_id, amount, metadata, status
      )
      VALUES (
        ${userId}, ${songName}, ${videoUrl}, ${thumbnailUrl || null}, ${duration},
        ${isPaid || false}, ${paymentIntentId || null}, ${amount || null}, 
        ${metadata ? JSON.stringify(metadata) : null}, ${status || 'completed'}
      )
      RETURNING *
    `;

    res.json({ 
      success: true, 
      video: result[0],
      message: 'Video guardado exitosamente' 
    });
  } catch (error: any) {
    console.error('Error al guardar video:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al guardar video'
    });
  }
});

/**
 * Obtener todos los videos generados del usuario actual
 */
router.get('/my-videos', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const isAdmin = req.user?.isAdmin;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Si es admin, ver todos los videos, si no solo los del usuario
    const videos = isAdmin
      ? await sql`SELECT * FROM generated_videos ORDER BY created_at DESC`
      : await sql`SELECT * FROM generated_videos WHERE user_id = ${userId} ORDER BY created_at DESC`;

    res.json({ 
      success: true, 
      videos,
      count: videos.length
    });
  } catch (error: any) {
    console.error('Error al obtener videos:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener videos'
    });
  }
});

/**
 * Obtener un video específico por ID
 */
router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id);
    const userId = req.user?.uid;
    const isAdmin = req.user?.isAdmin;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'ID de video inválido' });
    }

    const result = await sql`SELECT * FROM generated_videos WHERE id = ${videoId}`;
    
    if (result.length === 0) {
      return res.status(404).json({ success: false, message: 'Video no encontrado' });
    }

    const video = result[0];

    // Verificar que el video pertenece al usuario (excepto admin)
    if (!isAdmin && video.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para ver este video' });
    }

    res.json({ 
      success: true, 
      video
    });
  } catch (error: any) {
    console.error('Error al obtener video:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al obtener video'
    });
  }
});

/**
 * Eliminar un video generado (solo admin o propietario)
 */
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id);
    const userId = req.user?.uid;
    const isAdmin = req.user?.isAdmin;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'ID de video inválido' });
    }

    // Verificar que el video existe y pertenece al usuario (excepto admin)
    const checkResult = await sql`SELECT * FROM generated_videos WHERE id = ${videoId}`;
    
    if (checkResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Video no encontrado' });
    }

    const video = checkResult[0];

    if (!isAdmin && video.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para eliminar este video' });
    }

    // Eliminar el video
    await sql`DELETE FROM generated_videos WHERE id = ${videoId}`;

    res.json({ 
      success: true, 
      message: 'Video eliminado exitosamente'
    });
  } catch (error: any) {
    console.error('Error al eliminar video:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al eliminar video'
    });
  }
});

/**
 * Actualizar el estado de un video
 */
router.patch('/:id/status', authenticate, async (req: Request, res: Response) => {
  try {
    const videoId = parseInt(req.params.id);
    const { status } = req.body;
    const userId = req.user?.uid;
    const isAdmin = req.user?.isAdmin;
    
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (isNaN(videoId)) {
      return res.status(400).json({ success: false, message: 'ID de video inválido' });
    }

    if (!['generating', 'completed', 'failed'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido' });
    }

    // Verificar que el video existe y pertenece al usuario (excepto admin)
    const checkResult = await sql`SELECT * FROM generated_videos WHERE id = ${videoId}`;
    
    if (checkResult.length === 0) {
      return res.status(404).json({ success: false, message: 'Video no encontrado' });
    }

    const video = checkResult[0];

    if (!isAdmin && video.user_id !== userId) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar este video' });
    }

    // Actualizar el estado
    const result = await sql`
      UPDATE generated_videos 
      SET status = ${status}, updated_at = NOW() 
      WHERE id = ${videoId}
      RETURNING *
    `;

    res.json({ 
      success: true, 
      video: result[0],
      message: 'Estado actualizado exitosamente'
    });
  } catch (error: any) {
    console.error('Error al actualizar estado:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error al actualizar estado'
    });
  }
});

export default router;
