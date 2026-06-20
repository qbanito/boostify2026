import { Router, Request, Response } from 'express';
import { 
  Timestamp, 
  DocumentData,
  FieldValue 
} from 'firebase-admin/firestore';
import { db, storage } from '../firebase';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate } from '../middleware/auth';

// Configurar multer para subidas temporales
const upload = multer({ 
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      const uploadDir = path.join(__dirname, '../../uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB máximo
  }
});

// Crear el router
const router = Router();

/**
 * Endpoint para guardar un proyecto en Firestore
 * Este endpoint requiere autenticación
 */
router.post('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const { project } = req.body;
    const userId = req.user?.uid;

    if (!project || !userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'Se requiere un proyecto y autenticación' 
      });
    }

    // Asignar ID al proyecto si no tiene uno
    const projectId = project.id || `project-${Date.now()}`;
    const projectRef = db.collection('editorProjects').doc(projectId);

    // Preparar datos para guardar
    const projectToSave = {
      ...project,
      id: projectId,
      userId,
      updatedAt: FieldValue.serverTimestamp(),
      lastSavedAt: FieldValue.serverTimestamp()
    };

    // Guardar en Firestore
    await projectRef.set(projectToSave, { merge: true });

    res.status(200).json({
      success: true,
      projectId,
      message: 'Proyecto guardado correctamente'
    });
  } catch (error: any) {
    console.error('Error guardando proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al guardar el proyecto: ${error.message}`
    });
  }
});

/**
 * Endpoint para obtener un proyecto específico
 * Este endpoint requiere autenticación
 */
router.get('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    // Verificar que haya un ID de proyecto
    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de proyecto'
      });
    }

    // Obtener el proyecto
    const projectRef = db.collection('editorProjects').doc(projectId);
    const projectSnap = await projectRef.get();

    // Verificar que el proyecto exista
    if (!projectSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar que el usuario sea propietario del proyecto o que el proyecto sea público
    const projectData = projectSnap.data();
    if (projectData && projectData.userId !== userId && !projectData.isPublic) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para ver este proyecto'
      });
    }

    // Devolver el proyecto
    res.status(200).json({
      success: true,
      project: {
        ...projectData,
        createdAt: projectData?.createdAt?.toDate?.() || null,
        updatedAt: projectData?.updatedAt?.toDate?.() || null,
        lastSavedAt: projectData?.lastSavedAt?.toDate?.() || null
      }
    });
  } catch (error: any) {
    console.error('Error obteniendo proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al obtener el proyecto: ${error.message}`
    });
  }
});

/**
 * Endpoint para obtener todos los proyectos de un usuario
 * Este endpoint requiere autenticación
 */
router.get('/projects', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para ver tus proyectos'
      });
    }

    // Crear query para obtener los proyectos del usuario
    try {
      // Intentar query con ordenamiento
      const projectsRef = db.collection('editorProjects');
      const projectsSnap = await projectsRef
        .where('userId', '==', userId)
        .orderBy('updatedAt', 'desc')
        .get();

      // Transformar los proyectos
      const projects = projectsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          lastSavedAt: data.lastSavedAt?.toDate?.() || null
        };
      });

      res.status(200).json({
        success: true,
        projects
      });
    } catch (indexError: any) {
      // Si hay error de índice, intentar sin ordenamiento
      console.error('Error con la consulta indexada, intentando alternativa:', indexError);
      
      const projectsRef = db.collection('editorProjects');
      const projectsSnap = await projectsRef
        .where('userId', '==', userId)
        .get();
      
      // Transformar y ordenar manualmente
      const projects = projectsSnap.docs
        .map(doc => {
          const data = doc.data();
          return {
            ...data,
            createdAt: data.createdAt?.toDate?.() || null,
            updatedAt: data.updatedAt?.toDate?.() || null,
            lastSavedAt: data.lastSavedAt?.toDate?.() || null
          };
        })
        .sort((a, b) => {
          const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(0);
          const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      
      res.status(200).json({
        success: true,
        projects,
        note: 'Usando consulta alternativa debido a error de índice'
      });
    }
  } catch (error: any) {
    console.error('Error obteniendo proyectos:', error);
    res.status(500).json({
      success: false,
      message: `Error al obtener los proyectos: ${error.message}`
    });
  }
});

/**
 * Endpoint para eliminar un proyecto
 * Este endpoint requiere autenticación
 */
router.delete('/projects/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!projectId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de proyecto y autenticación'
      });
    }

    // Obtener el proyecto para verificar que el usuario sea el propietario
    const projectRef = db.collection('editorProjects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar que el usuario sea el propietario
    const projectData = projectSnap.data();
    if (!projectData || projectData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para eliminar este proyecto'
      });
    }

    // Eliminar la miniatura si existe
    if (projectData.thumbnailUrl) {
      try {
        const thumbnailRef = storage.bucket().file(`project-thumbnails/${projectId}.jpg`);
        await thumbnailRef.delete();
      } catch (deleteError) {
        console.log('Error eliminando miniatura, posiblemente no exista:', deleteError);
      }
    }

    // Eliminar el proyecto
    await projectRef.delete();

    res.status(200).json({
      success: true,
      message: 'Proyecto eliminado correctamente'
    });
  } catch (error: any) {
    console.error('Error eliminando proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al eliminar el proyecto: ${error.message}`
    });
  }
});

/**
 * Endpoint para compartir un proyecto (hacerlo público o privado)
 * Este endpoint requiere autenticación
 */
router.put('/projects/:projectId/share', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { isPublic } = req.body;
    const userId = req.user?.uid;

    if (!projectId || userId === undefined || isPublic === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de proyecto, estado de compartido y autenticación'
      });
    }

    // Obtener el proyecto para verificar que el usuario sea el propietario
    const projectRef = db.collection('editorProjects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar que el usuario sea el propietario
    const projectData = projectSnap.data();
    if (!projectData || projectData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para compartir este proyecto'
      });
    }

    // Actualizar el estado de compartido
    await projectRef.update({
      isPublic: isPublic,
      updatedAt: Timestamp.now()
    });

    res.status(200).json({
      success: true,
      message: `Proyecto ${isPublic ? 'compartido' : 'hecho privado'} correctamente`
    });
  } catch (error: any) {
    console.error('Error compartiendo proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al compartir el proyecto: ${error.message}`
    });
  }
});

/**
 * Endpoint para obtener proyectos públicos
 * Este endpoint no requiere autenticación
 */
router.get('/projects/public/list', async (req: Request, res: Response) => {
  try {
    const { limit: limitStr = '10' } = req.query;
    const limitCount = parseInt(limitStr as string, 10);

    // Crear query para obtener proyectos públicos
    try {
      const projectsRef = db.collection('editorProjects');
      const projectsSnap = await projectsRef
        .where('isPublic', '==', true)
        .orderBy('updatedAt', 'desc')
        .limit(limitCount)
        .get();

      // Transformar los proyectos
      const projects = projectsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          lastSavedAt: data.lastSavedAt?.toDate?.() || null
        };
      });

      res.status(200).json({
        success: true,
        projects
      });
    } catch (indexError: any) {
      // Manejar errores específicos de índice con un enfoque alternativo
      console.error('Error con índice en consulta de proyectos públicos:', indexError);
      
      // Intentar obtener todos y filtrar manualmente
      const projectsRef = db.collection('editorProjects');
      const projectsSnap = await projectsRef
        .where('isPublic', '==', true)
        .get();
      
      // Transformar y ordenar manualmente
      const allProjects = projectsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          createdAt: data.createdAt?.toDate?.() || null,
          updatedAt: data.updatedAt?.toDate?.() || null,
          lastSavedAt: data.lastSavedAt?.toDate?.() || null
        };
      });
      
      // Ordenar por fecha actualización (más recientes primero)
      allProjects.sort((a, b) => {
        const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(0);
        const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      
      // Aplicar límite manualmente
      const projects = allProjects.slice(0, limitCount);
      
      res.status(200).json({
        success: true,
        projects,
        note: 'Usando consulta alternativa debido a error de índice'
      });
    }
  } catch (error: any) {
    console.error('Error obteniendo proyectos públicos:', error);
    res.status(500).json({
      success: false,
      message: `Error al obtener proyectos públicos: ${error.message}`
    });
  }
});

/**
 * Endpoint para subir una miniatura del proyecto
 * Este endpoint requiere autenticación
 */
router.post('/projects/:projectId/thumbnail', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { thumbnailDataUrl } = req.body;
    const userId = req.user?.uid;

    if (!projectId || !thumbnailDataUrl || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de proyecto, miniatura y autenticación'
      });
    }

    // Verificar que el usuario sea propietario del proyecto
    const projectRef = db.collection('editorProjects').doc(projectId);
    const projectSnap = await projectRef.get();

    if (!projectSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    const projectData = projectSnap.data();
    if (!projectData || projectData.userId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permiso para modificar este proyecto'
      });
    }

    // Extraer la parte base64 del data URL
    const matches = thumbnailDataUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    
    if (!matches || matches.length !== 3) {
      return res.status(400).json({
        success: false,
        message: 'Formato de miniatura inválido'
      });
    }
    
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const contentType = 'image/jpeg';

    // Subir la miniatura a Storage
    const thumbnailPath = `project-thumbnails/${projectId}.jpg`;
    const file = storage.bucket().file(thumbnailPath);
    
    // Subir buffer a Storage
    await file.save(buffer, {
      metadata: {
        contentType: contentType
      }
    });

    // Obtener la URL de descarga
    const bucketName = storage.bucket().name;
    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(thumbnailPath)}?alt=media`;

    // Actualizar el proyecto con la URL de la miniatura
    await projectRef.update({
      thumbnailUrl: downloadUrl,
      updatedAt: Timestamp.now()
    });

    res.status(200).json({
      success: true,
      thumbnailUrl: downloadUrl,
      message: 'Miniatura subida correctamente'
    });
  } catch (error: any) {
    console.error('Error subiendo miniatura:', error);
    res.status(500).json({
      success: false,
      message: `Error al subir la miniatura: ${error.message}`
    });
  }
});

/**
 * Endpoint para subir un clip de video
 * Este endpoint requiere autenticación
 */
router.post('/clips/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const file = req.file;

    if (!file || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un archivo y autenticación'
      });
    }

    // Generar un ID único para el clip
    const clipId = `clip-${Date.now()}-${uuidv4()}`;
    
    // Determinar el tipo MIME y extensión
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === '.mp4') contentType = 'video/mp4';
    else if (fileExtension === '.webm') contentType = 'video/webm';
    else if (fileExtension === '.jpg' || fileExtension === '.jpeg') contentType = 'image/jpeg';
    else if (fileExtension === '.png') contentType = 'image/png';
    
    try {
      // Leer el archivo del disco
      const fileBuffer = fs.readFileSync(file.path);
      
      // Crear ruta y referencia en Firebase Storage
      const filePath = `editor-clips/${userId}/${clipId}${fileExtension}`;
      const storageFile = storage.bucket().file(filePath);
      
      // Opciones para la subida
      const options = {
        metadata: {
          contentType: contentType
        }
      };
      
      // Subir el archivo a Storage
      await storageFile.save(fileBuffer, options);
      
      // Obtener la URL de descarga
      const bucketName = storage.bucket().name;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(filePath)}?alt=media`;
      
      // Guardar los metadatos del clip en Firestore
      const clipData = {
        id: clipId,
        userId,
        name: file.originalname,
        url: downloadUrl,
        type: contentType.startsWith('video') ? 'video' : 'image',
        size: file.size,
        contentType,
        extension: fileExtension,
        createdAt: Timestamp.now()
      };
      
      await db.collection('editorClips').doc(clipId).set(clipData);
      
      // Limpiar el archivo temporal
      fs.unlinkSync(file.path);
      
      // Responder con la URL del clip
      res.status(200).json({
        success: true,
        clipId,
        url: downloadUrl,
        name: file.originalname,
        type: contentType.startsWith('video') ? 'video' : 'image',
        message: 'Clip subido correctamente'
      });
    } catch (uploadError: any) {
      console.error('Error subiendo clip:', uploadError);
      
      // Limpiar el archivo temporal si existe
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      res.status(500).json({
        success: false,
        message: `Error al subir el clip: ${uploadError.message}`
      });
    }
  } catch (error: any) {
    console.error('Error en el proceso de subida:', error);
    
    // Limpiar el archivo temporal si existe
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: `Error al procesar la subida: ${error.message}`
    });
  }
});

/**
 * Endpoint para subir un archivo de audio
 * Este endpoint requiere autenticación
 */
router.post('/audio/upload', authenticate, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const file = req.file;

    if (!file || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un archivo y autenticación'
      });
    }

    // Generar un ID único para el audio
    const audioId = `audio-${Date.now()}-${uuidv4()}`;
    
    // Determinar el tipo MIME y extensión
    const fileExtension = path.extname(file.originalname).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (fileExtension === '.mp3') contentType = 'audio/mpeg';
    else if (fileExtension === '.wav') contentType = 'audio/wav';
    else if (fileExtension === '.ogg') contentType = 'audio/ogg';
    
    try {
      // Leer el archivo del disco
      const fileBuffer = fs.readFileSync(file.path);
      
      // Crear ruta y referencia en Firebase Storage
      const filePath = `editor-audio/${userId}/${audioId}${fileExtension}`;
      const storageFile = storage.bucket().file(filePath);
      
      // Opciones para la subida
      const options = {
        metadata: {
          contentType: contentType
        }
      };
      
      // Subir el archivo a Storage
      await storageFile.save(fileBuffer, options);
      
      // Obtener la URL de descarga
      const bucketNameAudio = storage.bucket().name;
      const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketNameAudio)}/o/${encodeURIComponent(filePath)}?alt=media`;
      
      // Guardar los metadatos del audio en Firestore
      const audioData = {
        id: audioId,
        userId,
        name: file.originalname,
        url: downloadUrl,
        size: file.size,
        contentType,
        extension: fileExtension,
        createdAt: Timestamp.now()
      };
      
      await db.collection('editorAudio').doc(audioId).set(audioData);
      
      // Limpiar el archivo temporal
      fs.unlinkSync(file.path);
      
      // Responder con la URL del audio
      res.status(200).json({
        success: true,
        audioId,
        url: downloadUrl,
        name: file.originalname,
        message: 'Audio subido correctamente'
      });
    } catch (uploadError: any) {
      console.error('Error subiendo audio:', uploadError);
      
      // Limpiar el archivo temporal si existe
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      
      res.status(500).json({
        success: false,
        message: `Error al subir el audio: ${uploadError.message}`
      });
    }
  } catch (error: any) {
    console.error('Error en el proceso de subida de audio:', error);
    
    // Limpiar el archivo temporal si existe
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      message: `Error al procesar la subida: ${error.message}`
    });
  }
});

/**
 * Endpoint para obtener los clips de un usuario
 * Este endpoint requiere autenticación
 */
router.get('/clips', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;
    const { type } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para ver tus clips'
      });
    }

    try {
      // Consultar clips según el tipo (si se especifica)
      let clipsRef = db.collection('editorClips').where('userId', '==', userId);
      
      if (type && (type === 'video' || type === 'image')) {
        clipsRef = clipsRef.where('type', '==', type);
      }
      
      // Intentar ordenar por fecha de creación
      try {
        const clipsSnap = await clipsRef.orderBy('createdAt', 'desc').get();
        
        // Transformar los documentos
        const clips = clipsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || null
          };
        });
        
        res.status(200).json({
          success: true,
          clips
        });
      } catch (orderError: any) {
        // Error al intentar ordenar (probablemente problema de índice)
        console.error('Error al ordenar clips:', orderError);
        
        // Consultar sin ordenar y ordenar manualmente
        const clipsSnap = await clipsRef.get();
        
        // Transformar y filtrar manualmente
        let clips = clipsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || null
          };
        });
        
        // Ordenar por fecha de creación (más recientes primero)
        clips.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        res.status(200).json({
          success: true,
          clips,
          note: 'Usando ordenación alternativa debido a error de índice'
        });
      }
    } catch (queryError: any) {
      console.error('Error en la consulta de clips:', queryError);
      res.status(500).json({
        success: false,
        message: `Error al consultar clips: ${queryError.message}`
      });
    }
  } catch (error: any) {
    console.error('Error obteniendo clips:', error);
    res.status(500).json({
      success: false,
      message: `Error al obtener los clips: ${error.message}`
    });
  }
});

/**
 * Endpoint para obtener los archivos de audio de un usuario
 * Este endpoint requiere autenticación
 */
router.get('/audio', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.uid;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Debes iniciar sesión para ver tus archivos de audio'
      });
    }

    try {
      // Consultar archivos de audio
      let audioRef = db.collection('editorAudio').where('userId', '==', userId);
      
      // Intentar ordenar por fecha de creación
      try {
        const audioSnap = await audioRef.orderBy('createdAt', 'desc').get();
        
        // Transformar los documentos
        const audioFiles = audioSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || null
          };
        });
        
        res.status(200).json({
          success: true,
          audioFiles
        });
      } catch (orderError: any) {
        // Error al intentar ordenar (probablemente problema de índice)
        console.error('Error al ordenar archivos de audio:', orderError);
        
        // Consultar sin ordenar y ordenar manualmente
        const audioSnap = await audioRef.get();
        
        // Transformar y filtrar manualmente
        let audioFiles = audioSnap.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id,
            createdAt: data.createdAt?.toDate?.() || null
          };
        });
        
        // Ordenar por fecha de creación (más recientes primero)
        audioFiles.sort((a, b) => {
          const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(0);
          const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
        
        res.status(200).json({
          success: true,
          audioFiles,
          note: 'Usando ordenación alternativa debido a error de índice'
        });
      }
    } catch (queryError: any) {
      console.error('Error en la consulta de archivos de audio:', queryError);
      res.status(500).json({
        success: false,
        message: `Error al consultar archivos de audio: ${queryError.message}`
      });
    }
  } catch (error: any) {
    console.error('Error obteniendo archivos de audio:', error);
    res.status(500).json({
      success: false,
      message: `Error al obtener los archivos de audio: ${error.message}`
    });
  }
});

/**
 * Endpoint para importar un proyecto
 * Este endpoint requiere autenticación
 */
router.post('/projects/import', authenticate, async (req: Request, res: Response) => {
  try {
    const { importData } = req.body;
    const userId = req.user?.uid;

    if (!importData || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requieren datos de importación y autenticación'
      });
    }

    if (!importData.project) {
      return res.status(400).json({
        success: false,
        message: 'Formato de importación inválido'
      });
    }

    // Validar versión para compatibilidad
    const version = importData.version || '1.0.0';
    console.log(`Importando proyecto versión ${version}`);

    // Generar nuevo ID para el proyecto importado
    const projectId = `project-${Date.now()}`;
    const projectRef = db.collection('editorProjects').doc(projectId);

    // Preparar datos para guardar
    const projectToSave = {
      id: projectId,
      name: importData.project.name || 'Proyecto importado',
      timeline: typeof importData.project.timeline === 'string' 
        ? importData.project.timeline 
        : JSON.stringify(importData.project.timeline || []),
      effects: typeof importData.project.effects === 'string' 
        ? importData.project.effects 
        : JSON.stringify(importData.project.effects || []),
      settings: typeof importData.project.settings === 'string' 
        ? importData.project.settings 
        : JSON.stringify(importData.project.settings || {}),
      userId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastSavedAt: FieldValue.serverTimestamp(),
      isPublic: false,
      isImported: true,
      importedAt: FieldValue.serverTimestamp(),
      importSource: importData.source || 'manual',
      importVersion: version,
    };

    // Guardar en Firestore
    await projectRef.set(projectToSave);

    res.status(200).json({
      success: true,
      projectId,
      project: {
        ...projectToSave,
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSavedAt: new Date(),
        importedAt: new Date(),
      },
      message: 'Proyecto importado correctamente'
    });
  } catch (error: any) {
    console.error('Error importando proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al importar el proyecto: ${error.message}`
    });
  }
});

/**
 * Endpoint para exportar un proyecto
 * Este endpoint requiere autenticación
 */
router.get('/projects/:projectId/export', authenticate, async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const userId = req.user?.uid;

    if (!projectId || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Se requiere un ID de proyecto y autenticación'
      });
    }

    // Obtener el proyecto
    const projectRef = db.collection('editorProjects').doc(projectId);
    const projectSnap = await projectRef.get();

    // Verificar que el proyecto exista
    if (!projectSnap.exists) {
      return res.status(404).json({
        success: false,
        message: 'Proyecto no encontrado'
      });
    }

    // Verificar que el usuario sea propietario del proyecto
    const projectData = projectSnap.data();
    if (projectData && projectData.userId !== userId) {
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
        timeline: typeof projectData?.timeline === 'string' 
          ? JSON.parse(projectData.timeline) 
          : projectData?.timeline || [],
        effects: typeof projectData?.effects === 'string' 
          ? JSON.parse(projectData.effects) 
          : projectData?.effects || [],
        settings: typeof projectData?.settings === 'string' 
          ? JSON.parse(projectData.settings) 
          : projectData?.settings || {},
        // No incluimos datos sensibles como userId o IDs internos
      }
    };

    res.status(200).json({
      success: true,
      exportData,
      message: 'Proyecto exportado correctamente'
    });
  } catch (error: any) {
    console.error('Error exportando proyecto:', error);
    res.status(500).json({
      success: false,
      message: `Error al exportar el proyecto: ${error.message}`
    });
  }
});

// Exportar el router
export default router;