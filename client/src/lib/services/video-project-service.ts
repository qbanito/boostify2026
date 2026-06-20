import { logger } from "../logger";
/**
 * Servicio frontend para gestionar proyectos de video musical
 * Maneja el almacenamiento en Firebase Storage y Firestore
 */
import { db, storage } from '../firebase';
import { collection, addDoc, doc, getDoc, getDocs, query, where, orderBy, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import type { MusicVideoScene } from '../../types/music-video-scene';

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
 */
export async function uploadImageToStorage(
  imageData: string,
  projectId: string,
  sceneId: string,
  userId: string
): Promise<{ storageUrl: string; publicUrl: string }> {
  try {
    logger.info(`📤 Subiendo imagen para escena ${sceneId} al proyecto ${projectId}`);

    let imageBlob: Blob;

    // Convertir la imagen a blob según el formato
    if (imageData.startsWith('data:')) {
      // Es base64 con prefijo data:image/...
      const response = await fetch(imageData);
      imageBlob = await response.blob();
    } else if (imageData.startsWith('http')) {
      // Es una URL, descargar la imagen
      const response = await fetch(imageData, { mode: 'cors' });
      imageBlob = await response.blob();
    } else {
      // Asumir que es base64 puro
      const byteString = atob(imageData);
      const arrayBuffer = new ArrayBuffer(byteString.length);
      const uint8Array = new Uint8Array(arrayBuffer);
      for (let i = 0; i < byteString.length; i++) {
        uint8Array[i] = byteString.charCodeAt(i);
      }
      imageBlob = new Blob([uint8Array], { type: 'image/png' });
    }

    // Referencia al archivo en Storage
    const fileName = `video-projects/${userId}/${projectId}/scenes/${sceneId}.png`;
    const storageRef = ref(storage, fileName);

    // Subir el archivo
    await uploadBytes(storageRef, imageBlob, {
      contentType: 'image/png',
      customMetadata: {
        projectId,
        sceneId,
        userId,
        uploadedAt: new Date().toISOString()
      }
    });

    // Obtener URL pública
    const publicUrl = await getDownloadURL(storageRef);
    const storageUrl = `gs://${storage.app.options.storageBucket}/${fileName}`;

    logger.info(`✅ Imagen subida exitosamente: ${publicUrl}`);

    return { storageUrl, publicUrl };
  } catch (error) {
    logger.error('Error subiendo imagen a Storage:', error);
    throw new Error(`Failed to upload image: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Sube múltiples imágenes en batch a Firebase Storage
 */
export async function uploadMultipleImages(
  images: { sceneId: string; imageData: string }[],
  projectId: string,
  userId: string,
  onProgress?: (progress: number) => void
): Promise<{ sceneId: string; storageUrl: string; publicUrl: string }[]> {
  logger.info(`📤 Subiendo ${images.length} imágenes en batch...`);

  const results: { sceneId: string; storageUrl: string; publicUrl: string }[] = [];
  
  for (let i = 0; i < images.length; i++) {
    const { sceneId, imageData } = images[i];
    const { storageUrl, publicUrl } = await uploadImageToStorage(imageData, projectId, sceneId, userId);
    results.push({ sceneId, storageUrl, publicUrl });
    
    if (onProgress) {
      onProgress(((i + 1) / images.length) * 100);
    }
  }

  logger.info(`✅ ${results.length} imágenes subidas exitosamente`);
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
    logger.info(`📝 Creando proyecto de video: ${name}`);

    const projectData = {
      name,
      userId,
      script,
      images: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'draft' as const,
      metadata: metadata || {}
    };

    const docRef = await addDoc(collection(db, 'videoProjects'), projectData);
    logger.info(`✅ Proyecto creado con ID: ${docRef.id}`);

    return docRef.id;
  } catch (error) {
    logger.error('Error creando proyecto:', error);
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
    logger.info(`🔄 Actualizando ${images.length} imágenes en proyecto ${projectId}`);

    const imageRecords = images.map(img => ({
      ...img,
      uploadedAt: new Date()
    }));

    const projectRef = doc(db, 'videoProjects', projectId);
    await updateDoc(projectRef, {
      images: imageRecords,
      updatedAt: serverTimestamp(),
      status: 'completed'
    });

    logger.info(`✅ Imágenes actualizadas en proyecto ${projectId}`);
  } catch (error) {
    logger.error('Error actualizando imágenes del proyecto:', error);
    throw new Error(`Failed to update project images: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Obtiene un proyecto por ID
 */
export async function getVideoProject(projectId: string): Promise<VideoProject | null> {
  try {
    const docRef = doc(db, 'videoProjects', projectId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    return {
      id: docSnap.id,
      ...data,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
      images: data.images?.map((img: any) => ({
        ...img,
        uploadedAt: img.uploadedAt instanceof Date ? img.uploadedAt : new Date(img.uploadedAt)
      })) || []
    } as VideoProject;
  } catch (error) {
    logger.error('Error obteniendo proyecto:', error);
    throw new Error(`Failed to get project: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Obtiene todos los proyectos de un usuario
 */
export async function getUserProjects(userId: string): Promise<VideoProject[]> {
  try {
    const q = query(
      collection(db, 'videoProjects'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
        images: data.images?.map((img: any) => ({
          ...img,
          uploadedAt: img.uploadedAt instanceof Date ? img.uploadedAt : new Date(img.uploadedAt)
        })) || []
      } as VideoProject;
    });
  } catch (error) {
    logger.error('Error obteniendo proyectos del usuario:', error);
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
    const projectRef = doc(db, 'videoProjects', projectId);
    await updateDoc(projectRef, {
      script,
      updatedAt: serverTimestamp()
    });

    logger.info(`✅ Script actualizado en proyecto ${projectId}`);
  } catch (error) {
    logger.error('Error actualizando script:', error);
    throw new Error(`Failed to update script: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Elimina un proyecto y sus imágenes
 */
export async function deleteVideoProject(projectId: string, userId: string): Promise<void> {
  try {
    logger.info(`🗑️ Eliminando proyecto ${projectId}`);

    // Verificar que el proyecto pertenece al usuario
    const project = await getVideoProject(projectId);
    if (!project || project.userId !== userId) {
      throw new Error('Project not found or access denied');
    }

    // Eliminar archivos de Storage
    const folderRef = ref(storage, `video-projects/${userId}/${projectId}/scenes`);
    try {
      const fileList = await listAll(folderRef);
      await Promise.all(fileList.items.map(item => deleteObject(item)));
    } catch (error) {
      logger.warn('No hay archivos para eliminar o error eliminando:', error);
    }

    // Eliminar documento de Firestore
    await deleteDoc(doc(db, 'videoProjects', projectId));

    logger.info(`✅ Proyecto ${projectId} eliminado completamente`);
  } catch (error) {
    logger.error('Error eliminando proyecto:', error);
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
  metadata?: any,
  onProgress?: (progress: number, status: string) => void
): Promise<{ projectId: string; project: VideoProject }> {
  try {
    logger.info(`🎬 Creando proyecto completo: ${name}`);

    // 1. Crear el proyecto
    onProgress?.(10, 'Creando proyecto...');
    const projectId = await createVideoProject(name, userId, script, metadata);

    // 2. Subir todas las imágenes a Storage
    onProgress?.(20, 'Subiendo imágenes...');
    const uploadedImages = await uploadMultipleImages(
      generatedImages,
      projectId,
      userId,
      (uploadProgress) => {
        const totalProgress = 20 + (uploadProgress * 0.6); // 20% -> 80%
        onProgress?.(totalProgress, `Subiendo imágenes... ${Math.round(uploadProgress)}%`);
      }
    );

    // 3. Actualizar el proyecto con las URLs de las imágenes
    onProgress?.(90, 'Guardando información...');
    await updateProjectImages(projectId, uploadedImages);

    // 4. Obtener el proyecto completo
    onProgress?.(95, 'Finalizando...');
    const project = await getVideoProject(projectId);

    if (!project) {
      throw new Error('Failed to retrieve created project');
    }

    onProgress?.(100, 'Proyecto creado exitosamente');
    logger.info(`✅ Proyecto completo creado: ${projectId}`);

    return { projectId, project };
  } catch (error) {
    logger.error('Error en flujo completo de creación:', error);
    throw new Error(`Failed to create project with images: ${error instanceof Error ? error.message : String(error)}`);
  }
}
