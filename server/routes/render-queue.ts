/**
 * 🎬 Render Queue API Routes
 * Endpoints para gestionar la cola de renderizado de videos
 */

import { Router } from 'express';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { 
  createQueueItem, 
  getQueueStatus, 
  getQueuePosition,
  getQueueStats,
  updateQueueProgress
} from '../services/render-queue/queue-manager';
import { processQueueItem, startQueueProcessor } from '../services/render-queue/video-pipeline';
import { db } from '../db';
import { musicVideoProjects, users } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// Validation schemas
const createQueueSchema = z.object({
  projectId: z.number(),
  userEmail: z.string().email(),
  artistName: z.string().min(1),
  songName: z.string().min(1),
  profileSlug: z.string().min(1),
  notifyByEmail: z.boolean().optional().default(true),
  performanceVideoUrl: z.string().url().optional(),
});

/**
 * POST /api/render-queue/create
 * Crear un nuevo trabajo en la cola de renderizado
 */
router.post('/create', async (req, res) => {
  try {
    logger.log(`📥 [RENDER-QUEUE] Creando nuevo trabajo en cola...`);

    const validatedData = createQueueSchema.parse(req.body);

    // Obtener datos del proyecto
    const [project] = await db.select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.id, validatedData.projectId));

    if (!project) {
      return res.status(404).json({
        success: false,
        error: 'Proyecto no encontrado'
      });
    }

    // Obtener o crear el perfil del artista
    let artistProfileId: number | undefined;

    // Buscar si ya existe un perfil con ese slug
    const [existingProfile] = await db.select()
      .from(users)
      .where(eq(users.slug, validatedData.profileSlug));

    if (existingProfile) {
      artistProfileId = existingProfile.id;
    }

    // Obtener timeline del proyecto
    const timelineData = project.timelineItems || project.scenes || [];
    
    // Obtener thumbnail (primera imagen generada)
    let thumbnailUrl: string | undefined = project.thumbnail ?? undefined;
    if (!thumbnailUrl && Array.isArray(timelineData) && timelineData.length > 0) {
      const firstWithImage = timelineData.find((item: any) => item.imageUrl || item.thumbnail);
      thumbnailUrl = firstWithImage?.imageUrl || firstWithImage?.thumbnail || undefined;
    }

    // Crear item en la cola
    const result = await createQueueItem({
      projectId: validatedData.projectId,
      userEmail: validatedData.userEmail,
      artistName: validatedData.artistName,
      songName: validatedData.songName,
      profileSlug: validatedData.profileSlug,
      artistProfileId,
      timelineData,
      audioUrl: project.audioUrl || '',
      audioDuration: project.audioDuration ? parseFloat(project.audioDuration) : 30,
      thumbnailUrl,
      aspectRatio: project.aspectRatio || '16:9',
      totalClips: Array.isArray(timelineData) ? timelineData.length : 10,
      performanceVideoUrl: validatedData.performanceVideoUrl,
      notifyByEmail: validatedData.notifyByEmail,
    });

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error || 'Error creando trabajo en cola'
      });
    }

    // Actualizar el proyecto con el estado y artistName/songName para que aparezca en el perfil
    await db.update(musicVideoProjects)
      .set({
        status: 'demo_generation',
        artistName: validatedData.artistName,
        songName: validatedData.songName,
        thumbnail: thumbnailUrl,
        lastModified: new Date()
      })
      .where(eq(musicVideoProjects.id, validatedData.projectId));

    // Obtener posición en la cola
    const position = await getQueuePosition(result.queueId!);

    logger.log(`✅ [RENDER-QUEUE] Trabajo creado: ${result.queueId}, posición: ${position}`);

    res.json({
      success: true,
      queueId: result.queueId,
      position,
      estimatedTime: position <= 1 ? '8-12 minutos' : `${position * 10}-${position * 15} minutos`,
      message: 'Tu video está en la cola de procesamiento'
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error:`, error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Datos inválidos',
        details: error.errors
      });
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

/**
 * GET /api/render-queue/status/:queueId
 * Obtener el estado de un trabajo en la cola
 */
router.get('/status/:queueId', async (req, res) => {
  try {
    const queueId = parseInt(req.params.queueId);

    if (isNaN(queueId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cola inválido'
      });
    }

    const status = await getQueueStatus(queueId);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Trabajo no encontrado'
      });
    }

    // Obtener posición si está pendiente
    let position = 0;
    if (status.status === 'pending') {
      position = await getQueuePosition(queueId);
    }

    res.json({
      success: true,
      ...status,
      position
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error obteniendo estado:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

/**
 * POST /api/render-queue/process/:queueId
 * Procesar manualmente un trabajo (para testing/admin)
 */
router.post('/process/:queueId', async (req, res) => {
  try {
    const queueId = parseInt(req.params.queueId);

    if (isNaN(queueId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de cola inválido'
      });
    }

    logger.log(`🎬 [RENDER-QUEUE] Procesando manualmente: ${queueId}`);

    // Procesar en background
    processQueueItem(queueId).catch(err => {
      logger.error(`❌ [RENDER-QUEUE] Error procesando ${queueId}:`, err);
    });

    res.json({
      success: true,
      message: 'Procesamiento iniciado',
      queueId
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

/**
 * GET /api/render-queue/stats
 * Obtener estadísticas de la cola
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getQueueStats();

    res.json({
      success: true,
      ...stats
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error obteniendo stats:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

/**
 * POST /api/render-queue/start-processor
 * Iniciar el procesador de cola (admin)
 */
router.post('/start-processor', async (req, res) => {
  try {
    startQueueProcessor();

    res.json({
      success: true,
      message: 'Procesador de cola iniciado'
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error iniciando procesador:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

/**
 * GET /api/render-queue/by-project/:projectId
 * Obtener estado de renderizado por proyecto
 */
router.get('/by-project/:projectId', async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);

    if (isNaN(projectId)) {
      return res.status(400).json({
        success: false,
        error: 'ID de proyecto inválido'
      });
    }

    // Importar renderQueue aquí para evitar circular dependency
    const { renderQueue } = await import('../../db/schema');
    
    const [queueItem] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.projectId, projectId))
      .orderBy(renderQueue.createdAt);

    if (!queueItem) {
      return res.status(404).json({
        success: false,
        error: 'No hay renderizado para este proyecto'
      });
    }

    const status = await getQueueStatus(queueItem.id);
    let position = 0;
    if (status?.status === 'pending') {
      position = await getQueuePosition(queueItem.id);
    }

    res.json({
      success: true,
      ...status,
      position
    });

  } catch (error: any) {
    logger.error(`❌ [RENDER-QUEUE] Error:`, error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error desconocido'
    });
  }
});

export default router;
