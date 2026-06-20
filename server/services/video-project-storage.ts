/**
 * Servicio para guardar proyectos de video musical en Firebase Storage y Firestore
 * Maneja el almacenamiento permanente de imágenes y proyectos completos
 */
import { Storage } from '@google-cloud/storage';
import { db } from '../firebase';
import type { MusicVideoScene } from '../../client/src/types/music-video-scene';

const storage = new Storage({
  projectId: process.env.FIREBASE_PROJECT_ID,
  credentials: process.env.FIREBASE_ADMIN_KEY ? JSON.parse(process.env.FIREBASE_ADMIN_KEY) : undefined
});

const bucketName = process.env.FIREBASE_STORAGE_BUCKET || `${process.env.FIREBASE_PROJECT_ID}.appspot.com`;

export interface VideoProject {
  id: string;
  name: string;
  userId: string;
  script: {
    scenes: MusicVideoScene[];
    duration: number;
    sceneCount: number;
  };
  images: {
    sceneId: string;
    storageUrl: string;
    publicUrl: string;
    uploadedAt: Date;
  }[];
  audioUrl?: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'generating' | 'completed' | 'error';
  metadata?: {
    director?: string;
    editingStyle?: string;
    concept?: any;
  };
}

/**
 * Sube una imagen generada a Firebase Storage
 * @param imageData Base64 o URL de la imagen
 * @param projectId ID del proyecto
 * @param sceneId ID de la escena
 * @param userId ID del usuario
 * @returns URL pública de la imagen
 */
export async function uploadImageToStorage(
  imageData: string,
  projectId: string,
  sceneId: string,
  userId: string
): Promise<{ storageUrl: string; publicUrl: string }> {
  try {
    console.log(`📤 Subiendo imagen para escena ${sceneId} al proyecto ${projectId}`);

    const bucket = storage.bucket(bucketName);
    const fileName = `video-projects/${userId}/${projectId}/scenes/${sceneId}.png`;
    const file = bucket.file(fileName);

    let imageBuffer: Buffer;

    // Convertir la imagen a buffer según el formato
    if (imageData.startsWith('data:')) {
      // Es base64 con prefijo data:image/...
      const base64Data = imageData.split(',')[1];
      imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (imageData.startsWith('http')) {
      // Es una URL, descargar la imagen
      const axios = (await import('axios')).default;
      const response = await axios.get(imageData, { responseType: 'arraybuffer' });
      imageBuffer = Buffer.from(response.data);
    } else {
      // Asumir que es base64 puro
      imageBuffer = Buffer.from(imageData, 'base64');
    }

    // Subir el archivo
    await file.save(imageBuffer, {
      metadata: {
        contentType: 'image/png',
        metadata: {
          projectId,
          sceneId,
          userId,
          uploadedAt: new Date().toISOString()
        }
      },
      public: true // Hacer la imagen pública
    });

    // Obtener URL pública
    const publicUrl = `https://storage.googleapis.com/${bucketName}/${fileName}`;
    const storageUrl = `gs://${bucketName}/${fileName}`;

    console.log(`✅ Imagen subida exitosamente: ${publicUrl}`);

    return { storageUrl, publicUrl };
  } catch (error) {
    console.error('Error subiendo imagen a Storage:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sube múltiples imágenes en batch a Firebase Storage
 */
export async function uploadMultipleImages(
  images: { sceneId: string; imageData: string }[],
  projectId: string,
  userId: string
): Promise<{ sceneId: string; storageUrl: string; publicUrl: string }[]> {
  console.log(`📤 Subiendo ${images.length} imágenes en batch...`);

  const uploadPromises = images.map(({ sceneId, imageData }) =>
    uploadImageToStorage(imageData, projectId, sceneId, userId)
      .then(({ storageUrl, publicUrl }) => ({ sceneId, storageUrl, publicUrl }))
  );

  const results = await Promise.all(uploadPromises);
  console.log(`✅ ${results.length} imágenes subidas exitosamente`);

  return results;
}

/**
 * Crea un nuevo proyecto de video musical en Firestore
 */
export async function createVideoProject(
  name: string,
  userId: string,
  script: { scenes: MusicVideoScene[]; duration: number; sceneCount: number },
  metadata?: any
): Promise<string> {
  try {
    console.log(`📝 Creando proyecto de video: ${name}`);

    const projectData: Omit<VideoProject, 'id'> = {
      name,
      userId,
      script,
      images: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      metadata
    };

    const docRef = await db.collection('videoProjects').add(projectData);
    console.log(`✅ Proyecto creado con ID: ${docRef.id}`);

    return docRef.id;
  } catch (error) {
    console.error('Error creando proyecto:', error);
    throw new Error(`Failed to create project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Actualiza las URLs de imágenes en un proyecto
 */
export async function updateProjectImages(
  projectId: string,
  images: { sceneId: string; storageUrl: string; publicUrl: string }[]
): Promise<void> {
  try {
    console.log(`🔄 Actualizando ${images.length} imágenes en proyecto ${projectId}`);

    const imageRecords = images.map(img => ({
      ...img,
      uploadedAt: new Date()
    }));

    await db.collection('videoProjects').doc(projectId).update({
      images: imageRecords,
      updatedAt: new Date(),
      status: 'completed'
    });

    console.log(`✅ Imágenes actualizadas en proyecto ${projectId}`);
  } catch (error) {
    console.error('Error actualizando imágenes del proyecto:', error);
    throw new Error(`Failed to update project images: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Obtiene un proyecto por ID
 */
export async function getVideoProject(projectId: string): Promise<VideoProject | null> {
  try {
    const doc = await db.collection('videoProjects').doc(projectId).get();

    if (!doc.exists) {
      return null;
    }

    return { id: doc.id, ...doc.data() } as VideoProject;
  } catch (error) {
    console.error('Error obteniendo proyecto:', error);
    throw new Error(`Failed to get project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Obtiene todos los proyectos de un usuario
 */
export async function getUserProjects(userId: string): Promise<VideoProject[]> {
  try {
    const snapshot = await db.collection('videoProjects')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data()
    } as VideoProject));
  } catch (error) {
    console.error('Error obteniendo proyectos del usuario:', error);
    throw new Error(`Failed to get user projects: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Actualiza el script de un proyecto
 */
export async function updateProjectScript(
  projectId: string,
  script: { scenes: MusicVideoScene[]; duration: number; sceneCount: number }
): Promise<void> {
  try {
    await db.collection('videoProjects').doc(projectId).update({
      script,
      updatedAt: new Date()
    });

    console.log(`✅ Script actualizado en proyecto ${projectId}`);
  } catch (error) {
    console.error('Error actualizando script:', error);
    throw new Error(`Failed to update script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Elimina un proyecto y sus imágenes
 */
export async function deleteVideoProject(projectId: string, userId: string): Promise<void> {
  try {
    console.log(`🗑️ Eliminando proyecto ${projectId}`);

    // Verificar que el proyecto pertenece al usuario
    const project = await getVideoProject(projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Eliminar archivos de Storage
    const bucket = storage.bucket(bucketName);
    const prefix = `video-projects/${userId}/${projectId}/`;
    
    const [files] = await bucket.getFiles({ prefix });
    await Promise.all(files.map(file => file.delete()));

    // Eliminar documento de Firestore
    await db.collection('videoProjects').doc(projectId).delete();

    console.log(`✅ Proyecto ${projectId} eliminado completamente`);
  } catch (error) {
    console.error('Error eliminando proyecto:', error);
    throw new Error(`Failed to delete project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Flujo completo: Crea proyecto y sube imágenes generadas
 */
export async function createProjectWithImages(
  name: string,
  userId: string,
  script: { scenes: MusicVideoScene[]; duration: number; sceneCount: number },
  generatedImages: { sceneId: string; imageData: string }[],
  metadata?: any
): Promise<{ projectId: string; project: VideoProject }> {
  try {
    console.log(`🎬 Creando proyecto completo: ${name}`);

    // 1. Crear el proyecto
    const projectId = await createVideoProject(name, userId, script, metadata);

    // 2. Subir todas las imágenes a Storage
    const uploadedImages = await uploadMultipleImages(generatedImages, projectId, userId);

    // 3. Actualizar el proyecto con las URLs de las imágenes
    await updateProjectImages(projectId, uploadedImages);

    // 4. Obtener el proyecto completo
    const project = await getVideoProject(projectId);

    if (!project) {
      throw new Error('Failed to retrieve created project');
    }

    console.log(`✅ Proyecto completo creado: ${projectId}`);

    return { projectId, project };
  } catch (error) {
    console.error('Error en flujo completo de creación:', error);
    throw new Error(`Failed to create project with images: ${error instanceof Error ? error.message : String(error)}`);
  }
}
