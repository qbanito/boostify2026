/**
 * Rutas para el Editor Profesional de Video Musical
 * 
 * Estas rutas manejan todas las operaciones relacionadas con el editor profesional:
 * - Gestión de proyectos
 * - Guardado y carga de clips
 * - Exportación y compartición
 * 
 * Utiliza exclusivamente Firebase Admin SDK para mantener la coherencia
 * y evitar conflictos entre versiones de cliente y servidor.
 */

import { Router, Request, Response } from 'express';
import { db, storage } from '../../firebase';
import { authenticate } from '../../middleware/auth';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

// Crear router
const router = Router();

/**
 * Guardar un proyecto en Firestore
 * Este endpoint requiere autenticación
 */
router.post('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const { name, timeline, effects, settings, thumbnailUrl } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Validar datos requeridos
    if (!name || !timeline) {
      return res.status(400).json({ success: false, message: 'Nombre y timeline son obligatorios' });
    }

    // Crear fecha actual con Timestamp de Firebase Admin
    const now = Timestamp.now();

    // Crear estructura del proyecto
    const projectData = {
      name,
      timeline: JSON.stringify(timeline),
      effects: effects ? JSON.stringify(effects) : JSON.stringify([]),
      settings: settings ? JSON.stringify(settings) : JSON.stringify({}),
      thumbnailUrl: thumbnailUrl || '',
      userId,
      createdAt: now,
      updatedAt: now,
      isPublic: false
    };

    // Si no hay un ID de proyecto, crear uno nuevo
    if (!req.body.id) {
      // Crear un nuevo documento con ID generado
      const projectRef = db.collection('video_editor_projects').doc();
      await projectRef.set(projectData);
      
      console.log(`Proyecto de editor creado: ${projectRef.id}`);
      
      // Devolver el nuevo proyecto con su ID
      return res.status(201).json({
        success: true,
        message: 'Proyecto creado exitosamente',
        project: {
          id: projectRef.id,
          ...projectData,
          timeline: timeline, // Devolvemos el objeto parseado para el cliente
          effects: effects || [],
          settings: settings || {}
        }
      });
    } else {
      // Actualizar proyecto existente
      const projectId = req.body.id;
      
      // Verificar que el proyecto pertenece al usuario
      const projectRef = db.collection('video_editor_projects').doc(projectId);
      const projectDoc = await projectRef.get();
      
      if (!projectDoc.exists) {
        return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
      }
      
      const projectData = projectDoc.data();
      if (projectData?.userId !== userId) {
        return res.status(403).json({ 
          success: false, 
          message: 'No tienes permiso para editar este proyecto' 
        });
      }
      
      // Actualizar el proyecto
      await projectRef.update({
        name,
        timeline: JSON.stringify(timeline),
        effects: effects ? JSON.stringify(effects) : JSON.stringify([]),
        settings: settings ? JSON.stringify(settings) : JSON.stringify({}),
        thumbnailUrl: thumbnailUrl || projectData.thumbnailUrl,
        updatedAt: now
      });
      
      console.log(`Proyecto de editor actualizado: ${projectId}`);
      
      // Devolver el proyecto actualizado
      return res.status(200).json({
        success: true,
        message: 'Proyecto actualizado exitosamente',
        project: {
          id: projectId,
          name,
          timeline,
          effects: effects || [],
          settings: settings || {},
          thumbnailUrl: thumbnailUrl || projectData.thumbnailUrl,
          userId,
          createdAt: projectData.createdAt,
          updatedAt: now,
          isPublic: projectData.isPublic
        }
      });
    }
  } catch (error) {
    console.error('Error al guardar proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al guardar el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener un proyecto específico
 * Este endpoint requiere autenticación
 */
router.get('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Obtener el proyecto
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    
    // Verificar si el usuario tiene acceso al proyecto
    if (projectData?.userId !== userId && !projectData?.isPublic) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para ver este proyecto' 
      });
    }
    
    // Formatear el proyecto para devolverlo
    return res.status(200).json({
      success: true,
      project: {
        id: projectId,
        name: projectData?.name,
        timeline: JSON.parse(projectData?.timeline || '[]'),
        effects: JSON.parse(projectData?.effects || '[]'),
        settings: JSON.parse(projectData?.settings || '{}'),
        thumbnailUrl: projectData?.thumbnailUrl,
        userId: projectData?.userId,
        createdAt: projectData?.createdAt,
        updatedAt: projectData?.updatedAt,
        isPublic: projectData?.isPublic
      }
    });
  } catch (error) {
    console.error('Error al obtener proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener todos los proyectos de un usuario
 * Este endpoint requiere autenticación
 */
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Consultar proyectos del usuario
    const projectsRef = db.collection('video_editor_projects')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc');
      
    const projectsSnapshot = await projectsRef.get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).json({ success: true, projects: [] });
    }
    
    // Formatear los proyectos
    const projects = projectsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name,
        thumbnailUrl: data.thumbnailUrl,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isPublic: data.isPublic
      };
    });
    
    return res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error('Error al obtener proyectos:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener la lista de proyectos',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Eliminar un proyecto
 * Este endpoint requiere autenticación
 */
router.delete('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Verificar que el proyecto pertenece al usuario
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para eliminar este proyecto' 
      });
    }
    
    // Eliminar el proyecto
    await projectRef.delete();
    
    console.log(`Proyecto eliminado: ${projectId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Proyecto eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Compartir un proyecto (hacerlo público o privado)
 * Este endpoint requiere autenticación
 */
router.put('/projects/:projectId/share', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { isPublic } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Verificar que el proyecto pertenece al usuario
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para compartir este proyecto' 
      });
    }
    
    // Actualizar el estado público del proyecto
    await projectRef.update({
      isPublic: Boolean(isPublic),
      updatedAt: Timestamp.now()
    });
    
    console.log(`Proyecto ${isPublic ? 'compartido' : 'privatizado'}: ${projectId}`);
    
    return res.status(200).json({
      success: true,
      message: isPublic 
        ? 'Proyecto compartido exitosamente' 
        : 'Proyecto establecido como privado'
    });
  } catch (error) {
    console.error('Error al compartir proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al cambiar la visibilidad del proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener proyectos públicos
 * Este endpoint no requiere autenticación
 */
router.get('/projects/public/list', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    
    // Consultar proyectos públicos
    const projectsRef = db.collection('video_editor_projects')
      .where('isPublic', '==', true)
      .orderBy('updatedAt', 'desc')
      .limit(limit);
      
    const projectsSnapshot = await projectsRef.get();
    
    if (projectsSnapshot.empty) {
      return res.status(200).json({ success: true, projects: [] });
    }
    
    // Obtener información de los usuarios para mostrar nombres
    const userIds = new Set<string>();
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.userId) userIds.add(data.userId);
    });
    
    // Obtener información de usuarios en paralelo
    const userMap: Record<string, any> = {};
    if (userIds.size > 0) {
      const userPromises = Array.from(userIds).map(async (userId) => {
        try {
          const userDoc = await db.collection('users').doc(userId).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            userMap[userId] = {
              displayName: userData?.displayName || 'Usuario',
              photoURL: userData?.photoURL || ''
            };
          }
        } catch (err) {
          console.error(`Error obteniendo usuario ${userId}:`, err);
        }
      });
      
      await Promise.all(userPromises);
    }
    
    // Formatear los proyectos con información de usuario
    const projects = projectsSnapshot.docs.map(doc => {
      const data = doc.data();
      const userData = userMap[data.userId] || { 
        displayName: 'Usuario desconocido', 
        photoURL: '' 
      };
      
      return {
        id: doc.id,
        name: data.name,
        thumbnailUrl: data.thumbnailUrl,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        userId: data.userId,
        user: {
          displayName: userData.displayName,
          photoURL: userData.photoURL
        }
      };
    });
    
    return res.status(200).json({ success: true, projects });
  } catch (error) {
    console.error('Error al obtener proyectos públicos:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener la lista de proyectos públicos',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Exportar un proyecto a formato JSON
 * Este endpoint requiere autenticación
 */
router.get('/projects/:projectId/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Obtener el proyecto
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    
    // Verificar si el usuario tiene acceso al proyecto
    if (projectData?.userId !== userId && !projectData?.isPublic) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para exportar este proyecto' 
      });
    }
    
    // Preparar los datos para exportación
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      project: {
        name: projectData?.name || 'Proyecto sin nombre',
        timeline: JSON.parse(projectData?.timeline || '[]'),
        effects: JSON.parse(projectData?.effects || '[]'),
        settings: JSON.parse(projectData?.settings || '{}'),
        // No incluimos datos sensibles como userId o IDs internos
      }
    };
    
    // Registrar actividad de exportación
    try {
      await db.collection('editor_activities').add({
        userId,
        projectId,
        action: 'export',
        timestamp: Timestamp.now(),
        details: {
          exportVersion: exportData.version
        }
      });
    } catch (activityError) {
      console.error('Error al registrar actividad de exportación:', activityError);
      // No detenemos el flujo por errores en registro de actividad
    }
    
    return res.status(200).json({
      success: true,
      exportData
    });
  } catch (error) {
    console.error('Error al exportar proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al exportar el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Importar un proyecto desde formato JSON
 * Este endpoint requiere autenticación
 */
router.post('/projects/import', authenticate, async (req: Request, res: Response) => {
  try {
    const { importData } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }
    
    // Validar datos de importación
    if (!importData || !importData.project) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos de importación inválidos o incompletos' 
      });
    }
    
    // Validar versión para compatibilidad
    const version = importData.version || '1.0.0';
    
    // Generar ID único para el proyecto importado
    const projectId = `imported_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Crear fecha actual
    const now = Timestamp.now();
    
    // Preparar datos del proyecto
    const projectData = {
      name: importData.project.name || 'Proyecto importado',
      timeline: JSON.stringify(importData.project.timeline || []),
      effects: JSON.stringify(importData.project.effects || []),
      settings: JSON.stringify(importData.project.settings || {}),
      thumbnailUrl: '',
      userId,
      createdAt: now,
      updatedAt: now,
      isPublic: false,
      importedFrom: {
        version,
        date: importData.exportDate || new Date().toISOString()
      }
    };
    
    // Guardar el proyecto importado
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    await projectRef.set(projectData);
    
    // Registrar actividad de importación
    try {
      await db.collection('editor_activities').add({
        userId,
        projectId,
        action: 'import',
        timestamp: now,
        details: {
          importVersion: version
        }
      });
    } catch (activityError) {
      console.error('Error al registrar actividad de importación:', activityError);
      // No detenemos el flujo por errores en registro de actividad
    }
    
    // Devolver el proyecto importado
    return res.status(201).json({
      success: true,
      message: 'Proyecto importado exitosamente',
      project: {
        id: projectId,
        ...projectData,
        timeline: importData.project.timeline || [],
        effects: importData.project.effects || [],
        settings: importData.project.settings || {}
      }
    });
  } catch (error) {
    console.error('Error al importar proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al importar el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Subir un clip de audio/video al proyecto
 * Este endpoint requiere autenticación
 */
router.post('/clips/upload', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId, clipData, mediaData } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!projectId || !clipData || !mediaData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos de clip incompletos' 
      });
    }

    // Verificar que el proyecto existe y pertenece al usuario
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para editar este proyecto' 
      });
    }

    // Generar ID único para el clip
    const clipId = `clip_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Decodificar los datos media (base64)
    const matches = mediaData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Formato de datos media inválido' 
      });
    }

    const mediaType = matches[1];
    const mediaBuffer = Buffer.from(matches[2], 'base64');
    
    // Determinar extensión de archivo basada en el tipo MIME
    let fileExtension = '.mp4';
    if (mediaType.startsWith('audio/')) {
      fileExtension = '.mp3';
    } else if (mediaType.startsWith('image/')) {
      fileExtension = '.jpg';
    }
    
    // Ruta de almacenamiento en Firebase Storage
    const storagePath = `editor_clips/${userId}/${projectId}/${clipId}${fileExtension}`;
    
    // Subir a Firebase Storage usando Admin SDK
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    // Subir contenido
    await file.save(mediaBuffer, {
      metadata: {
        contentType: mediaType
      }
    });
    
    // Generar URL pública (con tiempo de expiración si es necesario)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 año
    });
    
    // Guardar información del clip en Firestore
    const clipRef = db.collection('editor_clips').doc(clipId);
    await clipRef.set({
      id: clipId,
      projectId,
      userId,
      type: clipData.type,
      name: clipData.name,
      duration: clipData.duration,
      url: url,
      storagePath,
      createdAt: Timestamp.now()
    });
    
    console.log(`Clip de editor subido: ${clipId} para proyecto ${projectId}`);
    
    // Devolver el clip con su URL
    return res.status(201).json({
      success: true,
      message: 'Clip subido exitosamente',
      clip: {
        id: clipId,
        projectId,
        type: clipData.type,
        name: clipData.name,
        duration: clipData.duration,
        url
      }
    });
  } catch (error) {
    console.error('Error al subir clip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al subir el clip',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener clips de un proyecto
 * Este endpoint requiere autenticación
 */
router.get('/clips/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Verificar que el proyecto existe y el usuario tiene acceso
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId && !projectData?.isPublic) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para ver los clips de este proyecto' 
      });
    }

    // Consultar clips del proyecto
    const clipsRef = db.collection('editor_clips')
      .where('projectId', '==', projectId)
      .orderBy('createdAt', 'desc');
      
    const clipsSnapshot = await clipsRef.get();
    
    if (clipsSnapshot.empty) {
      return res.status(200).json({ success: true, clips: [] });
    }
    
    // Formatear los clips
    const clips = clipsSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        projectId: data.projectId,
        type: data.type,
        name: data.name,
        duration: data.duration,
        url: data.url
      };
    });
    
    return res.status(200).json({ success: true, clips });
  } catch (error) {
    console.error('Error al obtener clips:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener los clips del proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Eliminar un clip
 * Este endpoint requiere autenticación
 */
router.delete('/clips/:clipId', authenticate, async (req: Request, res: Response) => {
  try {
    const { clipId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Verificar que el clip existe y pertenece al usuario
    const clipRef = db.collection('editor_clips').doc(clipId);
    const clipDoc = await clipRef.get();
    
    if (!clipDoc.exists) {
      return res.status(404).json({ success: false, message: 'Clip no encontrado' });
    }
    
    const clipData = clipDoc.data();
    if (clipData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para eliminar este clip' 
      });
    }

    // Eliminar el archivo de Firebase Storage
    if (clipData?.storagePath) {
      try {
        const bucket = storage.bucket();
        await bucket.file(clipData.storagePath).delete();
      } catch (storageError) {
        console.error('Error al eliminar archivo del storage:', storageError);
        // Continuamos con la eliminación del registro aunque falle el storage
      }
    }
    
    // Eliminar el registro de Firestore
    await clipRef.delete();
    
    console.log(`Clip eliminado: ${clipId}`);
    
    return res.status(200).json({
      success: true,
      message: 'Clip eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar clip:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al eliminar el clip',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Generar y guardar miniatura para un proyecto
 * Este endpoint requiere autenticación
 */
router.post('/thumbnails/upload', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId, thumbnailData } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!projectId || !thumbnailData) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos de miniatura incompletos' 
      });
    }

    // Verificar que el proyecto existe y pertenece al usuario
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para editar este proyecto' 
      });
    }

    // Generar ID único para la miniatura
    const thumbnailId = `thumb_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Decodificar los datos de la miniatura (base64)
    const matches = thumbnailData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ 
        success: false, 
        message: 'Formato de datos de miniatura inválido' 
      });
    }

    const mediaType = matches[1];
    const mediaBuffer = Buffer.from(matches[2], 'base64');
    
    // Determinar extensión de archivo basada en el tipo MIME
    let fileExtension = '.jpg';
    if (mediaType.includes('png')) {
      fileExtension = '.png';
    }
    
    // Ruta de almacenamiento en Firebase Storage
    const storagePath = `editor_thumbnails/${userId}/${projectId}/${thumbnailId}${fileExtension}`;
    
    // Subir a Firebase Storage usando Admin SDK
    const bucket = storage.bucket();
    const file = bucket.file(storagePath);
    
    // Subir contenido
    await file.save(mediaBuffer, {
      metadata: {
        contentType: mediaType
      }
    });
    
    // Generar URL pública (con tiempo de expiración si es necesario)
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24 * 365 // 1 año
    });
    
    // Actualizar el proyecto con la nueva miniatura
    await projectRef.update({
      thumbnailUrl: url,
      updatedAt: Timestamp.now()
    });
    
    console.log(`Miniatura de proyecto actualizada: ${projectId}`);
    
    // Devolver la URL de la miniatura
    return res.status(200).json({
      success: true,
      message: 'Miniatura subida exitosamente',
      thumbnailUrl: url
    });
  } catch (error) {
    console.error('Error al subir miniatura:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al subir la miniatura',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Exportar un proyecto (simulación)
 * Este endpoint requiere autenticación
 */
router.post('/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId, format, quality, duration } = req.body;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    if (!projectId || !format) {
      return res.status(400).json({ 
        success: false, 
        message: 'Datos de exportación incompletos' 
      });
    }

    // Verificar que el proyecto existe y pertenece al usuario
    const projectRef = db.collection('video_editor_projects').doc(projectId);
    const projectDoc = await projectRef.get();
    
    if (!projectDoc.exists) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado' });
    }
    
    const projectData = projectDoc.data();
    if (projectData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para exportar este proyecto' 
      });
    }

    // Generar ID único para la exportación
    const exportId = `export_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    
    // Registrar la tarea de exportación
    const exportRef = db.collection('editor_exports').doc(exportId);
    await exportRef.set({
      id: exportId,
      projectId,
      userId,
      format,
      quality: quality || 'medium',
      status: 'processing',
      progress: 0,
      duration: duration || 0,
      startedAt: Timestamp.now(),
      completedAt: null,
      downloadUrl: null
    });
    
    // Simular proceso de exportación (en producción, esto sería un proceso asíncrono)
    setTimeout(async () => {
      try {
        // Actualizar a estado completado
        await exportRef.update({
          status: 'completed',
          progress: 100,
          completedAt: Timestamp.now(),
          downloadUrl: `https://example.com/simulated-export/${exportId}.${format}`
        });
        
        console.log(`Exportación completada (simulación): ${exportId}`);
      } catch (error) {
        console.error(`Error en simulación de exportación: ${exportId}`, error);
        
        // Actualizar a estado fallido
        await exportRef.update({
          status: 'failed',
          progress: 0,
          completedAt: Timestamp.now(),
          error: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }, 3000); // Simulamos 3 segundos de procesamiento
    
    // Devolver el ID de la tarea de exportación para seguimiento
    return res.status(200).json({
      success: true,
      message: 'Exportación iniciada',
      exportId
    });
  } catch (error) {
    console.error('Error al exportar proyecto:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al exportar el proyecto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener estado de exportación
 * Este endpoint requiere autenticación
 */
router.get('/export/:exportId', authenticate, async (req: Request, res: Response) => {
  try {
    const { exportId } = req.params;
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Obtener estado de la exportación
    const exportRef = db.collection('editor_exports').doc(exportId);
    const exportDoc = await exportRef.get();
    
    if (!exportDoc.exists) {
      return res.status(404).json({ success: false, message: 'Exportación no encontrada' });
    }
    
    const exportData = exportDoc.data();
    
    // Verificar que la exportación pertenece al usuario
    if (exportData?.userId !== userId) {
      return res.status(403).json({ 
        success: false, 
        message: 'No tienes permiso para ver esta exportación' 
      });
    }
    
    // Devolver el estado de la exportación
    return res.status(200).json({
      success: true,
      export: {
        id: exportId,
        projectId: exportData?.projectId,
        status: exportData?.status,
        progress: exportData?.progress,
        format: exportData?.format,
        quality: exportData?.quality,
        startedAt: exportData?.startedAt,
        completedAt: exportData?.completedAt,
        downloadUrl: exportData?.downloadUrl,
        error: exportData?.error
      }
    });
  } catch (error) {
    console.error('Error al obtener estado de exportación:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener el estado de la exportación',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener estadísticas de editor (uso, proyectos, etc.)
 * Este endpoint requiere autenticación
 */
router.get('/stats', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Contar proyectos del usuario
    const projectsRef = db.collection('video_editor_projects').where('userId', '==', userId);
    const projectsSnapshot = await projectsRef.get();
    const projectCount = projectsSnapshot.size;
    
    // Contar clips del usuario
    const clipsRef = db.collection('editor_clips').where('userId', '==', userId);
    const clipsSnapshot = await clipsRef.get();
    const clipCount = clipsSnapshot.size;
    
    // Contar exportaciones del usuario
    const exportsRef = db.collection('editor_exports').where('userId', '==', userId);
    const exportsSnapshot = await exportsRef.get();
    const exportCount = exportsSnapshot.size;
    
    // Calcular espacio total utilizado (en MB)
    let totalStorageUsed = 0;
    clipsSnapshot.forEach(doc => {
      const data = doc.data();
      // Simulamos un tamaño de archivo si no está disponible
      totalStorageUsed += data.fileSize || 5; // 5MB por defecto si no hay dato
    });
    
    // Espacio total disponible (simulado, en MB)
    const totalStorageAvailable = 1000; // 1GB
    
    return res.status(200).json({
      success: true,
      stats: {
        projectCount,
        clipCount,
        exportCount,
        storageUsed: totalStorageUsed,
        storageAvailable: totalStorageAvailable,
        lastActivity: Timestamp.now()
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener estadísticas',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

/**
 * Obtener historial de actividad del editor
 * Este endpoint requiere autenticación
 */
router.get('/activity', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const limit = parseInt(req.query.limit as string) || 10;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Usuario no autenticado' });
    }

    // Proyectos actualizados recientemente
    const projectsRef = db.collection('video_editor_projects')
      .where('userId', '==', userId)
      .orderBy('updatedAt', 'desc')
      .limit(limit);
      
    const projectsSnapshot = await projectsRef.get();
    
    // Exportaciones recientes
    const exportsRef = db.collection('editor_exports')
      .where('userId', '==', userId)
      .orderBy('startedAt', 'desc')
      .limit(limit);
      
    const exportsSnapshot = await exportsRef.get();
    
    // Formatear actividades
    const activities = [];
    
    // Agregar proyectos actualizados
    projectsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'project_update',
        projectId: doc.id,
        projectName: data.name,
        timestamp: data.updatedAt,
        details: 'Proyecto actualizado'
      });
    });
    
    // Agregar exportaciones
    exportsSnapshot.forEach(doc => {
      const data = doc.data();
      activities.push({
        type: 'export',
        exportId: doc.id,
        projectId: data.projectId,
        timestamp: data.startedAt,
        status: data.status,
        details: `Exportación ${data.status === 'completed' ? 'completada' : 
                  data.status === 'failed' ? 'fallida' : 'en proceso'}`
      });
    });
    
    // Ordenar por timestamp descendente
    activities.sort((a, b) => {
      return b.timestamp.toMillis() - a.timestamp.toMillis();
    });
    
    // Limitar al número solicitado
    const limitedActivities = activities.slice(0, limit);
    
    return res.status(200).json({
      success: true,
      activities: limitedActivities
    });
  } catch (error) {
    console.error('Error al obtener actividad:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Error al obtener el historial de actividad',
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
});

export default router;