import { db } from '../../firebase';
import { logger } from "../logger";
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  Timestamp, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../../firebase';

// Definición de tipos para el editor profesional
export interface EditorProject {
  id: string;
  name: string;
  description?: string;
  userId: string;
  duration: number;
  clips: Clip[];
  audioTracks: AudioTrack[];
  visualEffects: VisualEffect[];
  transcriptions: Transcription[];
  beats: Beat[];
  sections: Section[];
  cameraMovements: CameraMovement[];
  isPublic: boolean;
  thumbnailUrl?: string;
  createdAt: Date | Timestamp;
  updatedAt: Date | Timestamp;
  lastSavedAt?: Date | Timestamp;
}

export interface Clip {
  id: string;
  name: string;
  type: 'video' | 'image';
  source: string;
  startTime: number;
  endTime: number;
  duration?: number;
  thumbnail?: string;
  effects?: VisualEffect[];
  metadata?: Record<string, any>;
}

export interface AudioTrack {
  id: string;
  name: string;
  source: string;
  type: 'music' | 'vocal' | 'sfx' | 'ambience';
  startTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  waveform: number[];
  metadata?: Record<string, any>;
}

export interface VisualEffect {
  id: string;
  name: string;
  type: 'filter' | 'overlay' | 'transition' | 'zoom' | 'crop' | 'blur' | 'custom';
  startTime: number;
  duration: number;
  intensity: number;
  parameters?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface Transcription {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom';
  language?: string;
  style?: {
    color: string;
    fontSize: number;
    fontWeight: string;
    position: 'top' | 'center' | 'bottom';
  };
  metadata?: Record<string, any>;
}

export interface Beat {
  id: string;
  time: number;
  type: 'beat' | 'bar';
  intensity: number;
  label?: string;
  bpm?: number;
  metadata?: Record<string, any>;
}

export interface Section {
  id: string;
  name: string;
  startTime: number;
  endTime: number;
  type: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'breakdown' | 'custom';
  color: string;
  metadata?: Record<string, any>;
}

export interface CameraMovement {
  id: string;
  name: string;
  type: 'track' | 'zoom' | 'pan' | 'tilt' | 'dolly';
  startTime: number;
  duration: number;
  start: number;
  end: number;
  parameters?: Record<string, number>;
  metadata?: Record<string, any>;
}

/**
 * Guarda un proyecto en Firestore
 * @param project Proyecto a guardar
 * @returns ID del proyecto guardado
 */
export async function saveProject(project: EditorProject): Promise<string> {
  try {
    // Asegurarse de que el proyecto tiene un ID
    const projectId = project.id || `project-${Date.now()}`;
    
    // Crear una referencia al documento del proyecto
    const projectRef = doc(db, 'editorProjects', projectId);
    
    // Preparar datos para guardar, transformando fechas a Timestamp
    const projectToSave = {
      ...project,
      id: projectId,
      updatedAt: serverTimestamp(),
      lastSavedAt: serverTimestamp()
    };
    
    // Guardar en Firestore
    await setDoc(projectRef, projectToSave, { merge: true });
    
    logger.info('Proyecto guardado correctamente en Firestore:', projectId);
    return projectId;
  } catch (error) {
    logger.error('Error guardando proyecto en Firestore:', error);
    throw new Error('Error al guardar el proyecto');
  }
}

/**
 * Obtiene un proyecto de Firestore por su ID
 * @param projectId ID del proyecto a obtener
 * @returns Proyecto obtenido
 */
export async function getProject(projectId: string): Promise<EditorProject | null> {
  try {
    // Crear una referencia al documento del proyecto
    const projectRef = doc(db, 'editorProjects', projectId);
    
    // Obtener el documento
    const projectSnap = await getDoc(projectRef);
    
    if (projectSnap.exists()) {
      // Transformar datos de Firestore a formato local
      const projectData = projectSnap.data();
      
      // Convertir Timestamps a Date
      const processedProject = {
        ...projectData,
        createdAt: projectData.createdAt?.toDate?.() || new Date(),
        updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
        lastSavedAt: projectData.lastSavedAt?.toDate?.() || undefined
      };
      
      return processedProject as EditorProject;
    }
    
    return null;
  } catch (error) {
    logger.error('Error obteniendo proyecto de Firestore:', error);
    throw new Error('Error al obtener el proyecto');
  }
}

/**
 * Obtiene todos los proyectos de un usuario
 * @param userId ID del usuario
 * @returns Lista de proyectos del usuario
 */
export async function getUserProjects(userId: string): Promise<EditorProject[]> {
  try {
    // Crear una consulta para obtener los proyectos del usuario
    const projectsQuery = query(
      collection(db, 'editorProjects'),
      where('userId', '==', userId),
      orderBy('updatedAt', 'desc')
    );
    
    // Obtener los documentos
    const projectsSnap = await getDocs(projectsQuery);
    
    if (projectsSnap.empty) {
      return [];
    }
    
    // Transformar datos de Firestore a formato local
    const projects = projectsSnap.docs.map(doc => {
      const projectData = doc.data();
      
      // Convertir Timestamps a Date
      return {
        ...projectData,
        createdAt: projectData.createdAt?.toDate?.() || new Date(),
        updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
        lastSavedAt: projectData.lastSavedAt?.toDate?.() || undefined
      } as EditorProject;
    });
    
    return projects;
  } catch (error) {
    logger.error('Error obteniendo proyectos de Firestore:', error);
    
    // Intentar con una consulta más simple si hay error de índice
    try {
      logger.info('Intentando consulta alternativa debido a error de índice');
      
      const simpleQuery = query(
        collection(db, 'editorProjects'),
        where('userId', '==', userId)
      );
      
      const simpleQuerySnap = await getDocs(simpleQuery);
      
      if (simpleQuerySnap.empty) {
        return [];
      }
      
      // Transformar datos y ordenar manualmente
      const projects = simpleQuerySnap.docs
        .map(doc => {
          const projectData = doc.data();
          
          return {
            ...projectData,
            createdAt: projectData.createdAt?.toDate?.() || new Date(),
            updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
            lastSavedAt: projectData.lastSavedAt?.toDate?.() || undefined
          } as EditorProject;
        })
        .sort((a, b) => {
          const dateA = a.updatedAt instanceof Date ? a.updatedAt : new Date(0);
          const dateB = b.updatedAt instanceof Date ? b.updatedAt : new Date(0);
          return dateB.getTime() - dateA.getTime();
        });
      
      return projects;
    } catch (alternativeError) {
      logger.error('Error en consulta alternativa:', alternativeError);
      throw new Error('Error al obtener los proyectos del usuario');
    }
  }
}

/**
 * Elimina un proyecto de Firestore
 * @param projectId ID del proyecto a eliminar
 */
export async function deleteProject(projectId: string): Promise<void> {
  try {
    // Crear una referencia al documento del proyecto
    const projectRef = doc(db, 'editorProjects', projectId);
    
    // Eliminar el documento
    await deleteDoc(projectRef);
    
    logger.info('Proyecto eliminado correctamente:', projectId);
  } catch (error) {
    logger.error('Error eliminando proyecto de Firestore:', error);
    throw new Error('Error al eliminar el proyecto');
  }
}

/**
 * Obtiene proyectos compartidos públicamente
 * @param limit Límite de proyectos a obtener (por defecto 10)
 * @returns Lista de proyectos públicos
 */
export async function getPublicProjects(limitCount: number = 10): Promise<EditorProject[]> {
  try {
    // Crear una consulta para obtener proyectos públicos
    const projectsQuery = query(
      collection(db, 'editorProjects'),
      where('isPublic', '==', true),
      orderBy('updatedAt', 'desc'),
      limit(limitCount)
    );
    
    // Obtener los documentos
    const projectsSnap = await getDocs(projectsQuery);
    
    if (projectsSnap.empty) {
      return [];
    }
    
    // Transformar datos de Firestore a formato local
    const projects = projectsSnap.docs.map(doc => {
      const projectData = doc.data();
      
      // Convertir Timestamps a Date
      return {
        ...projectData,
        createdAt: projectData.createdAt?.toDate?.() || new Date(),
        updatedAt: projectData.updatedAt?.toDate?.() || new Date(),
        lastSavedAt: projectData.lastSavedAt?.toDate?.() || undefined
      } as EditorProject;
    });
    
    return projects;
  } catch (error) {
    logger.error('Error obteniendo proyectos públicos:', error);
    throw new Error('Error al obtener proyectos públicos');
  }
}

/**
 * Exporta un proyecto a un archivo JSON
 * @param project Proyecto a exportar
 * @returns Blob con los datos del proyecto
 */
export function exportProjectToJson(project: EditorProject): Blob {
  try {
    // Crear una copia del proyecto para exportar
    const exportData = {
      ...project,
      exportedAt: new Date(),
      version: '1.0.0'
    };
    
    // Convertir a JSON
    const jsonString = JSON.stringify(exportData, null, 2);
    
    // Crear un Blob
    const blob = new Blob([jsonString], { type: 'application/json' });
    
    return blob;
  } catch (error) {
    logger.error('Error exportando proyecto a JSON:', error);
    throw new Error('Error al exportar el proyecto');
  }
}

/**
 * Importa un proyecto desde un archivo JSON
 * @param jsonFile Archivo JSON con los datos del proyecto
 * @returns Proyecto importado
 */
export function importProjectFromJson(jsonFile: File): Promise<EditorProject> {
  return new Promise((resolve, reject) => {
    try {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        try {
          if (!event.target?.result) {
            throw new Error('Error al leer el archivo');
          }
          
          // Parsear el JSON
          const jsonData = JSON.parse(event.target.result as string);
          
          // Validar que sea un proyecto válido
          if (!jsonData.id || !jsonData.name || !jsonData.clips) {
            throw new Error('El archivo no contiene un proyecto válido');
          }
          
          // Crear un nuevo ID para el proyecto importado
          const importedProject: EditorProject = {
            ...jsonData,
            id: `project-${Date.now()}`,
            updatedAt: new Date(),
            createdAt: new Date(),
            lastSavedAt: undefined
          };
          
          resolve(importedProject);
        } catch (parseError) {
          logger.error('Error parseando JSON:', parseError);
          reject(new Error('Error al parsear el archivo JSON'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Error al leer el archivo'));
      };
      
      reader.readAsText(jsonFile);
    } catch (error) {
      logger.error('Error importando proyecto desde JSON:', error);
      reject(new Error('Error al importar el proyecto'));
    }
  });
}

/**
 * Compartir un proyecto (hacerlo público)
 * @param projectId ID del proyecto a compartir
 * @param isPublic Estado público del proyecto
 */
export async function shareProject(projectId: string, isPublic: boolean): Promise<void> {
  try {
    // Crear una referencia al documento del proyecto
    const projectRef = doc(db, 'editorProjects', projectId);
    
    // Actualizar el estado público del proyecto
    await setDoc(projectRef, { isPublic, updatedAt: serverTimestamp() }, { merge: true });
    
    logger.info(`Proyecto ${isPublic ? 'compartido' : 'privado'} correctamente:`, projectId);
  } catch (error) {
    logger.error('Error cambiando estado público del proyecto:', error);
    throw new Error('Error al compartir el proyecto');
  }
}

/**
 * Sube una miniatura para un proyecto
 * @param projectId ID del proyecto
 * @param thumbnailDataUrl Data URL de la miniatura
 * @returns URL de la miniatura subida
 */
export async function uploadProjectThumbnail(projectId: string, thumbnailDataUrl: string): Promise<string> {
  try {
    // Extraer la parte base64 de la data URL
    const base64Data = thumbnailDataUrl.split(',')[1];
    
    // Crear una referencia al almacenamiento
    const thumbnailRef = ref(storage, `project-thumbnails/${projectId}.jpg`);
    
    // Subir la imagen
    await uploadString(thumbnailRef, base64Data, 'base64');
    
    // Obtener la URL de descarga
    const downloadUrl = await getDownloadURL(thumbnailRef);
    
    // Actualizar el proyecto con la URL de la miniatura
    const projectRef = doc(db, 'editorProjects', projectId);
    await setDoc(projectRef, { thumbnailUrl: downloadUrl, updatedAt: serverTimestamp() }, { merge: true });
    
    return downloadUrl;
  } catch (error) {
    logger.error('Error subiendo miniatura del proyecto:', error);
    throw new Error('Error al subir la miniatura del proyecto');
  }
}

/**
 * Crea un nuevo proyecto vacío
 * @param userId ID del usuario
 * @param name Nombre del proyecto
 * @returns Proyecto creado
 */
export function createEmptyProject(userId: string, name: string = 'Nuevo Proyecto'): EditorProject {
  const now = new Date();
  const projectId = `project-${Date.now()}`;
  
  return {
    id: projectId,
    name,
    description: '',
    userId,
    duration: 180, // 3 minutos por defecto
    clips: [],
    audioTracks: [],
    visualEffects: [],
    transcriptions: [],
    beats: [],
    sections: [],
    cameraMovements: [],
    isPublic: false,
    createdAt: now,
    updatedAt: now
  };
}

/**
 * Genera una miniatura del proyecto a partir del contenido de la línea de tiempo
 * @param project Proyecto para generar la miniatura
 * @returns Data URL de la miniatura generada
 */
export function generateProjectThumbnail(project: EditorProject): Promise<string> {
  return new Promise((resolve) => {
    // Crear un canvas
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 360;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      // Resolver con una miniatura por defecto
      resolve('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=');
      return;
    }
    
    // Dibujar un fondo negro
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar el nombre del proyecto
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(project.name, canvas.width / 2, canvas.height / 2 - 12);
    
    // Dibujar la fecha
    const dateStr = new Date().toLocaleDateString();
    ctx.font = '16px Arial';
    ctx.fillText(dateStr, canvas.width / 2, canvas.height / 2 + 20);
    
    // Dibujar la duración
    const minutes = Math.floor(project.duration / 60);
    const seconds = project.duration % 60;
    const durationStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    ctx.fillText(`Duración: ${durationStr}`, canvas.width / 2, canvas.height / 2 + 50);
    
    // Convertir a data URL
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    resolve(dataUrl);
  });
}