/**
 * 🎯 Render Queue Manager
 * Gestiona la cola de renderizado de videos musicales
 */

import { db } from '../../db';
import { renderQueue, musicVideoProjects, users } from '../../db/schema';
import { eq, and, isNull, asc, desc } from 'drizzle-orm';
import { logger } from '../../utils/logger';
import { sendPendingWebhook, sendCompletedWebhook, sendFailedWebhook, VideoWebhookData } from '../video-webhook-service';

export interface CreateQueueItemParams {
  projectId: number;
  userEmail: string;
  artistName: string;
  songName: string;
  profileSlug: string;
  artistProfileId?: number;
  timelineData: any[];
  audioUrl: string;
  audioDuration: number;
  thumbnailUrl?: string;
  aspectRatio?: string;
  totalClips?: number;
  performanceVideoUrl?: string;
  notifyByEmail?: boolean;
}

export interface QueueStatus {
  queueId: number;
  status: string;
  progress: number;
  currentStep: string;
  processedClips: number;
  totalClips: number;
  estimatedTimeRemaining?: string;
  finalVideoUrl?: string;
  error?: string;
}

/**
 * Crear un nuevo item en la cola de renderizado
 */
export async function createQueueItem(params: CreateQueueItemParams): Promise<{ success: boolean; queueId?: number; error?: string }> {
  try {
    logger.log(`📥 [QUEUE] Creando nuevo item en cola...`);
    logger.log(`   Proyecto: ${params.projectId}`);
    logger.log(`   Artista: ${params.artistName}`);
    logger.log(`   Canción: ${params.songName}`);

    // Insertar en la cola
    const [newQueueItem] = await db.insert(renderQueue).values({
      projectId: params.projectId,
      artistProfileId: params.artistProfileId,
      userEmail: params.userEmail,
      artistName: params.artistName,
      songName: params.songName,
      profileSlug: params.profileSlug,
      status: 'pending',
      currentStep: 'En cola',
      progress: 0,
      totalClips: params.totalClips || 10,
      processedClips: 0,
      timelineData: params.timelineData,
      audioUrl: params.audioUrl,
      audioDuration: String(params.audioDuration),
      thumbnailUrl: params.thumbnailUrl,
      aspectRatio: params.aspectRatio || '16:9',
      performanceVideoUrl: params.performanceVideoUrl || null,
      pendingWebhookSent: false,
      completedWebhookSent: false,
      retryCount: 0,
      maxRetries: 3,
    }).returning();

    if (!newQueueItem) {
      throw new Error('Failed to create queue item');
    }

    logger.log(`✅ [QUEUE] Item creado con ID: ${newQueueItem.id}`);

    // Enviar webhook de pendiente
    const profileUrl = `${process.env.BASE_URL || 'https://boostify.com'}/artist/${params.profileSlug}`;
    
    const webhookData: VideoWebhookData = {
      queueId: newQueueItem.id,
      projectId: params.projectId,
      email: params.userEmail,
      artistName: params.artistName,
      songName: params.songName,
      profileUrl,
      thumbnailUrl: params.thumbnailUrl,
      status: 'pending',
      totalScenes: params.totalClips || 10,
      estimatedTime: '8-12 minutos',
      notifyByEmail: params.notifyByEmail !== false,
      createdAt: new Date().toISOString()
    };

    const webhookResult = await sendPendingWebhook(webhookData);

    // Actualizar estado del webhook
    await db.update(renderQueue)
      .set({
        pendingWebhookSent: webhookResult.success,
        pendingWebhookSentAt: webhookResult.success ? new Date() : null,
        updatedAt: new Date()
      })
      .where(eq(renderQueue.id, newQueueItem.id));

    return { 
      success: true, 
      queueId: newQueueItem.id 
    };

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error creando item:`, error);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

/**
 * Obtener el estado de un item de la cola
 */
export async function getQueueStatus(queueId: number): Promise<QueueStatus | null> {
  try {
    const [item] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.id, queueId));

    if (!item) {
      return null;
    }

    // Calcular tiempo restante estimado
    let estimatedTimeRemaining: string | undefined;
    if (item.status === 'generating_videos' || item.status === 'rendering') {
      const remaining = (item.totalClips || 10) - (item.processedClips || 0);
      const secsPerClip = 30; // Estimado
      const totalSecs = remaining * secsPerClip;
      estimatedTimeRemaining = formatTime(totalSecs);
    }

    return {
      queueId: item.id,
      status: item.status,
      progress: item.progress || 0,
      currentStep: item.currentStep || 'En cola',
      processedClips: item.processedClips || 0,
      totalClips: item.totalClips || 10,
      estimatedTimeRemaining,
      finalVideoUrl: item.finalVideoUrl || undefined,
      error: item.errorMessage || undefined
    };

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error obteniendo estado:`, error);
    return null;
  }
}

/**
 * Obtener el siguiente item pendiente para procesar
 */
export async function getNextPendingItem(): Promise<typeof renderQueue.$inferSelect | null> {
  try {
    const [item] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.status, 'pending'))
      .orderBy(asc(renderQueue.createdAt))
      .limit(1);

    return item || null;

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error obteniendo siguiente item:`, error);
    return null;
  }
}

/**
 * Actualizar el progreso de un item
 */
export async function updateQueueProgress(
  queueId: number,
  updates: {
    status?: 'pending' | 'generating_videos' | 'rendering' | 'uploading' | 'completed' | 'failed';
    currentStep?: string;
    progress?: number;
    processedClips?: number;
    errorMessage?: string;
    errorStep?: string;
  }
): Promise<boolean> {
  try {
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (updates.status) updateData.status = updates.status;
    if (updates.currentStep) updateData.currentStep = updates.currentStep;
    if (updates.progress !== undefined) updateData.progress = updates.progress;
    if (updates.processedClips !== undefined) updateData.processedClips = updates.processedClips;
    if (updates.errorMessage) updateData.errorMessage = updates.errorMessage;
    if (updates.errorStep) updateData.errorStep = updates.errorStep;
    
    await db.update(renderQueue)
      .set(updateData)
      .where(eq(renderQueue.id, queueId));

    logger.log(`📊 [QUEUE] Progreso actualizado para ${queueId}: ${updates.currentStep || ''} (${updates.progress || 0}%)`);
    return true;

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error actualizando progreso:`, error);
    return false;
  }
}

/**
 * Marcar un item como completado y enviar webhook
 */
export async function markAsCompleted(
  queueId: number,
  finalVideoUrl: string,
  firebaseVideoUrl: string
): Promise<boolean> {
  try {
    // Obtener datos del item
    const [item] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.id, queueId));

    if (!item) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    // Actualizar en DB
    await db.update(renderQueue)
      .set({
        status: 'completed',
        currentStep: '¡Video completado!',
        progress: 100,
        finalVideoUrl,
        firebaseVideoUrl,
        completedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(renderQueue.id, queueId));

    // Actualizar el proyecto original también con video final y thumbnail
    if (item.projectId) {
      const projectUpdate: any = {
        finalVideoUrl: firebaseVideoUrl,
        status: 'completed',
        lastModified: new Date()
      };
      
      // Guardar thumbnail si existe (imagen de portada)
      if (item.thumbnailUrl) {
        projectUpdate.thumbnail = item.thumbnailUrl;
      }
      
      await db.update(musicVideoProjects)
        .set(projectUpdate)
        .where(eq(musicVideoProjects.id, item.projectId));
    }

    logger.log(`✅ [QUEUE] Item ${queueId} marcado como completado`);

    // Enviar webhook de completado
    const profileUrl = `${process.env.BASE_URL || 'https://boostify.com'}/artist/${item.profileSlug}`;
    
    const webhookData: VideoWebhookData = {
      queueId: item.id,
      projectId: item.projectId || 0,
      email: item.userEmail,
      artistName: item.artistName,
      songName: item.songName,
      profileUrl,
      thumbnailUrl: item.thumbnailUrl || undefined,
      videoUrl: firebaseVideoUrl,
      status: 'completed',
      createdAt: item.createdAt.toISOString(),
      completedAt: new Date().toISOString()
    };

    const webhookResult = await sendCompletedWebhook(webhookData);

    // Actualizar estado del webhook
    await db.update(renderQueue)
      .set({
        completedWebhookSent: webhookResult.success,
        completedWebhookSentAt: webhookResult.success ? new Date() : null
      })
      .where(eq(renderQueue.id, queueId));

    return true;

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error marcando como completado:`, error);
    return false;
  }
}

/**
 * Marcar un item como fallido
 */
export async function markAsFailed(
  queueId: number,
  errorMessage: string,
  errorStep: string
): Promise<boolean> {
  try {
    // Obtener datos del item
    const [item] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.id, queueId));

    if (!item) {
      throw new Error(`Queue item ${queueId} not found`);
    }

    // Verificar si podemos reintentar
    const newRetryCount = (item.retryCount || 0) + 1;
    const maxRetries = item.maxRetries || 3;

    if (newRetryCount < maxRetries) {
      // Reintentar
      await db.update(renderQueue)
        .set({
          status: 'pending',
          retryCount: newRetryCount,
          errorMessage,
          errorStep,
          updatedAt: new Date()
        })
        .where(eq(renderQueue.id, queueId));

      logger.log(`🔄 [QUEUE] Item ${queueId} reintentando (${newRetryCount}/${maxRetries})`);
      return true;
    }

    // Marcar como fallido definitivamente
    await db.update(renderQueue)
      .set({
        status: 'failed',
        currentStep: 'Error',
        errorMessage,
        errorStep,
        retryCount: newRetryCount,
        updatedAt: new Date()
      })
      .where(eq(renderQueue.id, queueId));

    // Actualizar proyecto original
    if (item.projectId) {
      await db.update(musicVideoProjects)
        .set({
          status: 'failed',
          lastModified: new Date()
        })
        .where(eq(musicVideoProjects.id, item.projectId));
    }

    logger.log(`❌ [QUEUE] Item ${queueId} marcado como fallido`);

    // Enviar webhook de error
    const profileUrl = `${process.env.BASE_URL || 'https://boostify.com'}/artist/${item.profileSlug}`;
    
    await sendFailedWebhook({
      queueId: item.id,
      projectId: item.projectId || 0,
      email: item.userEmail,
      artistName: item.artistName,
      songName: item.songName,
      profileUrl,
      status: 'failed',
      createdAt: item.createdAt.toISOString(),
      errorMessage
    });

    return true;

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error marcando como fallido:`, error);
    return false;
  }
}

/**
 * Obtener posición en la cola
 */
export async function getQueuePosition(queueId: number): Promise<number> {
  try {
    const [item] = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.id, queueId));

    if (!item || item.status !== 'pending') {
      return 0;
    }

    // Contar cuántos items pendientes hay antes de este
    const pendingItems = await db.select()
      .from(renderQueue)
      .where(eq(renderQueue.status, 'pending'))
      .orderBy(asc(renderQueue.createdAt));

    const position = pendingItems.findIndex(p => p.id === queueId) + 1;
    return position;

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error obteniendo posición:`, error);
    return 0;
  }
}

/**
 * Obtener estadísticas de la cola
 */
export async function getQueueStats(): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}> {
  try {
    const all = await db.select().from(renderQueue);
    
    return {
      pending: all.filter(i => i.status === 'pending').length,
      processing: all.filter(i => ['generating_videos', 'rendering', 'uploading'].includes(i.status)).length,
      completed: all.filter(i => i.status === 'completed').length,
      failed: all.filter(i => i.status === 'failed').length
    };

  } catch (error: any) {
    logger.error(`❌ [QUEUE] Error obteniendo estadísticas:`, error);
    return { pending: 0, processing: 0, completed: 0, failed: 0 };
  }
}

// Helper para formatear tiempo
function formatTime(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return `${mins}m ${secs}s`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ${mins % 60}m`;
}

export default {
  createQueueItem,
  getQueueStatus,
  getNextPendingItem,
  updateQueueProgress,
  markAsCompleted,
  markAsFailed,
  getQueuePosition,
  getQueueStats
};
