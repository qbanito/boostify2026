/**
 * Performance Segments API Routes
 * Maneja la creación y procesamiento de segmentos de performance
 * con generación automática de lip-sync usando FAL AI MuseTalk
 */

import { Router } from 'express';
import { db } from '../db';
import { performanceSegments } from '../../db/schema';
import { eq, and } from 'drizzle-orm';
import type { Request, Response } from 'express';

const router = Router();

/**
 * GET /api/performance-segments/:projectId
 * Obtiene todos los segmentos de un proyecto
 */
router.get('/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    const segments = await db
      .select()
      .from(performanceSegments)
      .where(eq(performanceSegments.projectId, projectId));
    
    res.json({ success: true, segments });
  } catch (error) {
    console.error('Error fetching performance segments:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching performance segments'
    });
  }
});

/**
 * POST /api/performance-segments
 * Crea un nuevo segmento de performance
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      sceneId,
      startTime,
      endTime,
      duration,
      lyrics,
      shotType,
      audioSegmentUrl,
      artistImageUrl
    } = req.body;
    
    const [segment] = await db
      .insert(performanceSegments)
      .values({
        projectId,
        sceneId,
        startTime: String(startTime),
        endTime: String(endTime),
        duration: String(duration),
        lyrics,
        shotType,
        audioSegmentUrl,
        artistImageUrl,
        status: 'pending'
      })
      .returning();
    
    res.json({ success: true, segment });
  } catch (error) {
    console.error('Error creating performance segment:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating performance segment'
    });
  }
});

/**
 * POST /api/performance-segments/batch
 * Crea múltiples segmentos en batch
 */
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const { segments } = req.body;
    
    if (!Array.isArray(segments) || segments.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'segments must be a non-empty array'
      });
    }
    
    const createdSegments = await db
      .insert(performanceSegments)
      .values(segments.map((seg: any) => ({
        projectId: seg.projectId,
        sceneId: seg.sceneId,
        startTime: String(seg.startTime),
        endTime: String(seg.endTime),
        duration: String(seg.duration),
        lyrics: seg.lyrics,
        shotType: seg.shotType,
        audioSegmentUrl: seg.audioSegmentUrl,
        artistImageUrl: seg.artistImageUrl,
        status: 'pending' as const
      })))
      .returning();
    
    res.json({
      success: true,
      segments: createdSegments,
      count: createdSegments.length
    });
  } catch (error) {
    console.error('Error creating batch performance segments:', error);
    res.status(500).json({
      success: false,
      error: 'Error creating batch performance segments'
    });
  }
});

/**
 * PATCH /api/performance-segments/:id
 * Actualiza un segmento (principalmente para actualizar status y URLs)
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const updates = req.body;
    
    const [updatedSegment] = await db
      .update(performanceSegments)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(performanceSegments.id, id))
      .returning();
    
    if (!updatedSegment) {
      return res.status(404).json({
        success: false,
        error: 'Segment not found'
      });
    }
    
    res.json({ success: true, segment: updatedSegment });
  } catch (error) {
    console.error('Error updating performance segment:', error);
    res.status(500).json({
      success: false,
      error: 'Error updating performance segment'
    });
  }
});

/**
 * GET /api/performance-segments/pending/:projectId
 * Obtiene segmentos pendientes de procesamiento
 */
router.get('/pending/:projectId', async (req: Request, res: Response) => {
  try {
    const projectId = parseInt(req.params.projectId);
    
    const pendingSegments = await db
      .select()
      .from(performanceSegments)
      .where(
        and(
          eq(performanceSegments.projectId, projectId),
          eq(performanceSegments.status, 'pending')
        )
      );
    
    res.json({
      success: true,
      segments: pendingSegments,
      count: pendingSegments.length
    });
  } catch (error) {
    console.error('Error fetching pending segments:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching pending segments'
    });
  }
});

/**
 * DELETE /api/performance-segments/:id
 * Elimina un segmento
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    await db
      .delete(performanceSegments)
      .where(eq(performanceSegments.id, id));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting performance segment:', error);
    res.status(500).json({
      success: false,
      error: 'Error deleting performance segment'
    });
  }
});

export default router;
