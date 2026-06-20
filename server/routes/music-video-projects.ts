import { Router } from 'express';
import { db } from '../db';
import { musicVideoProjects } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { logger } from '../utils/logger';

const router = Router();

const saveProjectSchema = z.object({
  userEmail: z.string().email(),
  projectName: z.string().min(1),
  artistName: z.string().optional(),
  songName: z.string().optional(),
  thumbnail: z.string().optional(),
  audioUrl: z.string().optional(),
  audioDuration: z.number().optional(),
  transcription: z.string().optional(),
  scriptContent: z.string().optional(),
  timelineItems: z.array(z.any()).default([]),
  selectedDirector: z.any().optional(),
  videoStyle: z.any().optional(),
  artistReferenceImages: z.array(z.string()).default([]),
  selectedEditingStyle: z.any().optional(),
  status: z.enum(["draft", "generating_script", "generating_images", "generating_videos", "demo_generation", "demo_completed", "payment_pending", "full_generation", "completed", "failed"]).default("draft"),
  progress: z.object({
    scriptGenerated: z.boolean(),
    imagesGenerated: z.number(),
    totalImages: z.number(),
    videosGenerated: z.number(),
    totalVideos: z.number()
  }).optional(),
  tags: z.array(z.string()).default([]),
  // Payment fields
  isPaid: z.boolean().optional(),
  paidAt: z.string().datetime().optional(),
  paidAmount: z.number().optional(),
  stripePaymentId: z.string().optional()
});

router.post('/save', async (req, res) => {
  try {
    logger.log('📥 [SAVE PROJECT] Recibiendo proyecto para guardar...');
    
    const validatedData = saveProjectSchema.parse(req.body);
    logger.log('✅ [SAVE PROJECT] Datos validados:', {
      userEmail: validatedData.userEmail,
      projectName: validatedData.projectName,
      artistName: validatedData.artistName,
      songName: validatedData.songName,
      timelineItemsCount: validatedData.timelineItems?.length || 0
    });
    
    // Convert audioDuration number to string for decimal field
    // Build dbData, only including fields that have values to avoid PostgreSQL array literal errors
    const dbData: any = {
      userEmail: validatedData.userEmail,
      projectName: validatedData.projectName,
      status: validatedData.status
    };
    
    // Artist info and thumbnail
    if (validatedData.artistName) dbData.artistName = validatedData.artistName;
    if (validatedData.songName) dbData.songName = validatedData.songName;
    if (validatedData.thumbnail) dbData.thumbnail = validatedData.thumbnail;
    
    // Only include optional fields if they have truthy values
    if (validatedData.audioUrl) dbData.audioUrl = validatedData.audioUrl;
    if (validatedData.audioDuration !== undefined) dbData.audioDuration = String(validatedData.audioDuration);
    if (validatedData.transcription) dbData.transcription = validatedData.transcription;
    if (validatedData.scriptContent) dbData.scriptContent = validatedData.scriptContent;
    
    // Always set array fields to empty array if not provided (never undefined/null for JSON fields)
    dbData.timelineItems = validatedData.timelineItems && validatedData.timelineItems.length > 0 ? validatedData.timelineItems : [];
    dbData.artistReferenceImages = validatedData.artistReferenceImages && validatedData.artistReferenceImages.length > 0 ? validatedData.artistReferenceImages : [];
    dbData.tags = validatedData.tags && validatedData.tags.length > 0 ? validatedData.tags : [];
    
    // Only include JSON objects if they exist
    if (validatedData.selectedDirector) dbData.selectedDirector = validatedData.selectedDirector;
    if (validatedData.videoStyle) dbData.videoStyle = validatedData.videoStyle;
    if (validatedData.selectedEditingStyle) dbData.selectedEditingStyle = validatedData.selectedEditingStyle;
    if (validatedData.progress) dbData.progress = validatedData.progress;
    
    // Payment fields
    if (validatedData.isPaid !== undefined) dbData.isPaid = validatedData.isPaid;
    if (validatedData.paidAt) dbData.paidAt = new Date(validatedData.paidAt);
    if (validatedData.paidAmount !== undefined) dbData.paidAmount = String(validatedData.paidAmount);
    if (validatedData.stripePaymentId) dbData.stripePaymentId = validatedData.stripePaymentId;
    
    const existingProject = await db
      .select()
      .from(musicVideoProjects)
      .where(
        and(
          eq(musicVideoProjects.userEmail, validatedData.userEmail),
          eq(musicVideoProjects.projectName, validatedData.projectName)
        )
      )
      .limit(1);
    
    if (existingProject.length > 0) {
      logger.log('🔄 [SAVE PROJECT] Actualizando proyecto existente:', existingProject[0].id);
      
      const [updated] = await db
        .update(musicVideoProjects)
        .set({
          ...dbData,
          lastModified: new Date()
        })
        .where(eq(musicVideoProjects.id, existingProject[0].id))
        .returning();
      
      logger.log('✅ [SAVE PROJECT] Proyecto actualizado exitosamente');
      res.json({ success: true, project: updated, isNew: false });
    } else {
      logger.log('➕ [SAVE PROJECT] Creando nuevo proyecto...');
      
      const [newProject] = await db
        .insert(musicVideoProjects)
        .values(dbData)
        .returning();
      
      logger.log('✅ [SAVE PROJECT] Nuevo proyecto creado:', newProject.id);
      res.json({ success: true, project: newProject, isNew: true });
    }
  } catch (error) {
    logger.error('❌ [SAVE PROJECT] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

router.get('/list/:userEmail', async (req, res) => {
  try {
    const { userEmail } = req.params;
    logger.log('📋 [LIST PROJECTS] Listando proyectos para userEmail:', userEmail);
    
    const projects = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.userEmail, userEmail))
      .orderBy(desc(musicVideoProjects.lastModified));
    
    logger.log(`✅ [LIST PROJECTS] Encontrados ${projects.length} proyectos`);
    res.json({ success: true, projects });
  } catch (error) {
    logger.error('❌ [LIST PROJECTS] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

router.post('/create-empty', async (req, res) => {
  try {
    const { projectName, artistName = 'Unknown Artist', songName = 'Untitled' } = req.body;
    
    if (!projectName) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectName es requerido' 
      });
    }
    
    logger.log('✨ [CREATE EMPTY] Creando proyecto vacío:', projectName);
    
    // Crear proyecto vacío con timelineItems de ejemplo
    const emptyTimelineItems = [
      {
        id: 1,
        start_time: 0,
        end_time: 3000,
        duration: 3000,
        title: 'Intro',
        imagePrompt: 'Cinematic intro shot with dramatic lighting',
        shotType: 'Wide Shot',
        mood: 'Mysterious',
        generatedImage: null
      },
      {
        id: 2,
        start_time: 3000,
        end_time: 6000,
        duration: 3000,
        title: 'Verse 1',
        imagePrompt: 'Close-up of main character with cinematic lighting',
        shotType: 'Close-Up',
        mood: 'Emotional',
        generatedImage: null
      },
      {
        id: 3,
        start_time: 6000,
        end_time: 10000,
        duration: 4000,
        title: 'Chorus',
        imagePrompt: 'Dynamic wide shot with energy and movement',
        shotType: 'Wide Shot',
        mood: 'Energetic',
        generatedImage: null
      },
      {
        id: 4,
        start_time: 10000,
        end_time: 13000,
        duration: 3000,
        title: 'Verse 2',
        imagePrompt: 'Medium shot with subtle camera movement',
        shotType: 'Medium Shot',
        mood: 'Thoughtful',
        generatedImage: null
      },
      {
        id: 5,
        start_time: 13000,
        end_time: 17000,
        duration: 4000,
        title: 'Bridge',
        imagePrompt: 'Epic wide shot with dramatic composition',
        shotType: 'Wide Shot',
        mood: 'Epic',
        generatedImage: null
      },
      {
        id: 6,
        start_time: 17000,
        end_time: 21000,
        duration: 4000,
        title: 'Final Chorus',
        imagePrompt: 'Intense close-up with professional lighting',
        shotType: 'Close-Up',
        mood: 'Climactic',
        generatedImage: null
      }
    ];
    
    const [newProject] = await db
      .insert(musicVideoProjects)
      .values({
        projectName: projectName,
        artistName: artistName,
        songName: songName,
        userEmail: 'demo@timeline-editor.local',
        status: 'draft',
        timelineItems: emptyTimelineItems,
        artistReferenceImages: [],
        tags: []
      })
      .returning();
    
    logger.log('✅ [CREATE EMPTY] Proyecto vacío creado:', newProject.id);
    res.json({ 
      success: true, 
      project: newProject,
      projectId: newProject.id 
    });
  } catch (error) {
    logger.error('❌ [CREATE EMPTY] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

router.get('/load/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    logger.log('📂 [LOAD PROJECT] Cargando proyecto:', projectId);
    
    const [project] = await db
      .select()
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.id, parseInt(projectId)))
      .limit(1);
    
    if (!project) {
      logger.log('❌ [LOAD PROJECT] Proyecto no encontrado');
      return res.status(404).json({ 
        success: false, 
        error: 'Proyecto no encontrado' 
      });
    }
    
    logger.log('✅ [LOAD PROJECT] Proyecto cargado exitosamente');
    res.json({ success: true, project });
  } catch (error) {
    logger.error('❌ [LOAD PROJECT] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

router.delete('/delete/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    logger.log('🗑️ [DELETE PROJECT] Eliminando proyecto:', projectId);
    
    await db
      .delete(musicVideoProjects)
      .where(eq(musicVideoProjects.id, parseInt(projectId)));
    
    logger.log('✅ [DELETE PROJECT] Proyecto eliminado exitosamente');
    res.json({ success: true });
  } catch (error) {
    logger.error('❌ [DELETE PROJECT] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

const renameProjectSchema = z.object({
  projectId: z.string(),
  newName: z.string().min(1, "Project name cannot be empty"),
  userEmail: z.string().email()
});

router.post('/rename', async (req, res) => {
  try {
    const validatedData = renameProjectSchema.parse(req.body);
    logger.log('✏️ [RENAME PROJECT] Renombrando proyecto:', validatedData.projectId);
    
    // Verificar que el proyecto existe y pertenece al usuario
    const [existingProject] = await db
      .select()
      .from(musicVideoProjects)
      .where(
        and(
          eq(musicVideoProjects.id, parseInt(validatedData.projectId)),
          eq(musicVideoProjects.userEmail, validatedData.userEmail)
        )
      )
      .limit(1);
    
    if (!existingProject) {
      logger.log('❌ [RENAME PROJECT] Proyecto no encontrado o no pertenece al usuario');
      return res.status(404).json({ 
        success: false, 
        error: 'Proyecto no encontrado' 
      });
    }
    
    // Verificar que no exista otro proyecto con el mismo nombre
    const [duplicateProject] = await db
      .select()
      .from(musicVideoProjects)
      .where(
        and(
          eq(musicVideoProjects.userEmail, validatedData.userEmail),
          eq(musicVideoProjects.projectName, validatedData.newName)
        )
      )
      .limit(1);
    
    if (duplicateProject && duplicateProject.id !== parseInt(validatedData.projectId)) {
      logger.log('❌ [RENAME PROJECT] Ya existe un proyecto con ese nombre');
      return res.status(400).json({ 
        success: false, 
        error: 'Ya existe un proyecto con ese nombre' 
      });
    }
    
    // Actualizar el nombre del proyecto
    const [updatedProject] = await db
      .update(musicVideoProjects)
      .set({
        projectName: validatedData.newName,
        lastModified: new Date()
      })
      .where(eq(musicVideoProjects.id, parseInt(validatedData.projectId)))
      .returning();
    
    logger.log('✅ [RENAME PROJECT] Proyecto renombrado exitosamente');
    res.json({ success: true, project: updatedProject });
  } catch (error) {
    logger.error('❌ [RENAME PROJECT] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * POST /api/music-video-projects/update-timeline
 * Actualiza solo los timelineItems de un proyecto
 */
router.post('/update-timeline', async (req, res) => {
  try {
    const { projectId, timelineItems, status } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId es requerido' 
      });
    }

    logger.log('📝 [UPDATE TIMELINE] Actualizando timeline para proyecto:', projectId);
    
    const updateData: any = {
      timelineItems: timelineItems || [],
      lastModified: new Date()
    };

    if (status) {
      updateData.status = status;
    }

    const [updated] = await db
      .update(musicVideoProjects)
      .set(updateData)
      .where(eq(musicVideoProjects.id, parseInt(projectId)))
      .returning();
    
    if (!updated) {
      logger.log('❌ [UPDATE TIMELINE] Proyecto no encontrado');
      return res.status(404).json({ 
        success: false, 
        error: 'Proyecto no encontrado' 
      });
    }

    logger.log('✅ [UPDATE TIMELINE] Timeline actualizado exitosamente');
    res.json({ success: true, project: updated });
  } catch (error) {
    logger.error('❌ [UPDATE TIMELINE] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * POST /mark-paid
 * Mark a project as paid after successful Stripe payment
 */
router.post('/mark-paid', async (req, res) => {
  try {
    const { projectId, userEmail, paidAmount, stripePaymentId } = req.body;
    
    if (!projectId) {
      return res.status(400).json({ 
        success: false, 
        error: 'projectId es requerido' 
      });
    }

    logger.log('💳 [MARK PAID] Marcando proyecto como pagado:', projectId);
    
    const updateData: any = {
      isPaid: true,
      paidAt: new Date(),
      status: 'full_generation',
      lastModified: new Date()
    };
    
    if (paidAmount !== undefined) {
      updateData.paidAmount = String(paidAmount);
    }
    
    if (stripePaymentId) {
      updateData.stripePaymentId = stripePaymentId;
    }

    const [updated] = await db
      .update(musicVideoProjects)
      .set(updateData)
      .where(eq(musicVideoProjects.id, parseInt(projectId)))
      .returning();
    
    if (!updated) {
      logger.log('❌ [MARK PAID] Proyecto no encontrado');
      return res.status(404).json({ 
        success: false, 
        error: 'Proyecto no encontrado' 
      });
    }

    logger.log('✅ [MARK PAID] Proyecto marcado como pagado exitosamente');
    res.json({ success: true, project: updated });
  } catch (error) {
    logger.error('❌ [MARK PAID] Error:', error);
    res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Error desconocido' 
    });
  }
});

/**
 * GET /by-artist/:artistIdOrSlug
 * Obtiene todos los proyectos de música de un artista por su slug o ID
 * Usado para mostrar videos completados en el perfil del artista
 */
router.get('/by-artist/:artistIdOrSlug', async (req, res) => {
  try {
    const { artistIdOrSlug } = req.params;
    logger.log(`🎬 [BY-ARTIST] Buscando proyectos para artista: ${artistIdOrSlug}`);
    
    if (!artistIdOrSlug) {
      return res.json({
        success: true,
        projects: []
      });
    }
    
    // Check if it's a numeric ID
    const isNumericId = /^\d+$/.test(artistIdOrSlug);
    
    // If numeric ID, try to find the artist first
    let artistName: string | null = null;
    if (isNumericId) {
      try {
        const { users } = await import('../db/schema');
        const [artist] = await db
          .select({ artistName: users.artistName, username: users.username })
          .from(users)
          .where(eq(users.id, parseInt(artistIdOrSlug)))
          .limit(1);
        
        if (artist) {
          artistName = artist.artistName || artist.username || null;
        }
      } catch (e) {
        logger.log(`⚠️ [BY-ARTIST] Could not find artist by ID: ${artistIdOrSlug}`);
      }
    }
    
    // Buscar proyectos que coincidan con el artistName transformado a slug
    const allProjects = await db
      .select({
        id: musicVideoProjects.id,
        artistName: musicVideoProjects.artistName,
        songName: musicVideoProjects.songName,
        finalVideoUrl: musicVideoProjects.finalVideoUrl,
        thumbnail: musicVideoProjects.thumbnail,
        status: musicVideoProjects.status,
        createdAt: musicVideoProjects.createdAt
      })
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.status, 'completed'))
      .orderBy(desc(musicVideoProjects.createdAt));
    
    // Filtrar por slug generado del artistName
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
    };
    
    const matchingProjects = allProjects.filter(project => {
      if (!project.artistName) return false;
      const projectSlug = generateSlug(project.artistName);
      
      // Match by slug
      if (projectSlug === artistIdOrSlug || 
          project.artistName.toLowerCase() === artistIdOrSlug.toLowerCase()) {
        return true;
      }
      
      // Match by artist name from DB lookup
      if (artistName && 
          (project.artistName.toLowerCase() === artistName.toLowerCase() ||
           generateSlug(project.artistName) === generateSlug(artistName))) {
        return true;
      }
      
      return false;
    });
    
    logger.log(`✅ [BY-ARTIST] Encontrados ${matchingProjects.length} proyectos para ${artistIdOrSlug}`);
    
    res.json({
      success: true,
      projects: matchingProjects
    });
    
  } catch (error) {
    logger.error('❌ [BY-ARTIST] Error:', error);
    // Return empty array instead of 500
    res.json({
      success: true,
      projects: []
    });
  }
});

export default router;
