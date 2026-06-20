import { logger } from "../logger";
/**
 * Servicio para comunicación con API RESTful del Editor Profesional
 * 
 * Este servicio consume las APIs basadas en Firebase Admin SDK implementadas
 * en el servidor para operaciones CRUD de proyectos de edición profesional
 */

import { apiRequest } from '../queryClient';
import { EditorState } from '../professional-editor-types';

// Interfaz para compatibilidad con la API del servidor
interface ProjectResponse {
  success: boolean;
  project?: any;
  projects?: any[];
  message?: string;
}

const API_BASE_URL = '/api/editor';

/**
 * Obtiene todos los proyectos del usuario actual
 * @returns Lista de proyectos
 */
export async function fetchUserProjects(): Promise<any[]> {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects`);
    return response.projects || [];
  } catch (error) {
    logger.error('Error fetching user projects:', error);
    // Intentar obtener desde el cliente Firebase como fallback
    logger.info('Attempting to fetch projects from Firestore client as fallback');
    const { getUserProjects } = await import('./professional-editor-service');
    // @ts-ignore - Ignoramos error de tipo porque sabemos que el usuario está autenticado
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return await getUserProjects(user.uid);
  }
}

/**
 * Obtiene un proyecto específico por su ID
 * @param projectId ID del proyecto
 * @returns Proyecto específico
 */
export async function fetchProject(projectId: string): Promise<any | null> {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects/${projectId}`);
    return response.project || null;
  } catch (error) {
    logger.error('Error fetching project:', error);
    // Intentar obtener desde el cliente Firebase como fallback
    logger.info('Attempting to fetch project from Firestore client as fallback');
    const { getProject } = await import('./professional-editor-service');
    return await getProject(projectId);
  }
}

/**
 * Guarda un proyecto en el servidor
 * @param project Proyecto a guardar
 * @returns Proyecto guardado
 */
export async function saveProjectToServer(project: any): Promise<any> {
  try {
    // Para proyectos nuevos, usamos POST; para existentes, PUT
    const method = project.id.startsWith('project-') ? 'POST' : 'PUT';
    const endpoint = method === 'PUT' ? `${API_BASE_URL}/projects/${project.id}` : `${API_BASE_URL}/projects`;
    
    logger.info(`Saving project with ${method} to ${endpoint}`);
    
    const response = await apiRequest(endpoint, method, {
      data: project
    });
    
    return response.project || project;
  } catch (error) {
    logger.error('Error saving project to server:', error);
    // Intentar guardar mediante cliente Firebase como fallback
    logger.info('Attempting to save project using Firestore client as fallback');
    const { saveProject } = await import('./professional-editor-service');
    const savedId = await saveProject(project);
    return { ...project, id: savedId };
  }
}

/**
 * Elimina un proyecto del servidor
 * @param projectId ID del proyecto a eliminar
 * @returns Resultado de la operación
 */
export async function deleteProjectFromServer(projectId: string): Promise<boolean> {
  try {
    await apiRequest(`${API_BASE_URL}/projects/${projectId}`, 'DELETE');
    return true;
  } catch (error) {
    logger.error('Error deleting project from server:', error);
    // Intentar eliminar mediante cliente Firebase como fallback
    logger.info('Attempting to delete project using Firestore client as fallback');
    const { deleteProject } = await import('./professional-editor-service');
    await deleteProject(projectId);
    return true;
  }
}

/**
 * Comparte un proyecto (cambia su estado público)
 * @param projectId ID del proyecto
 * @param isPublic Estado público del proyecto
 * @returns Resultado de la operación
 */
export async function shareProjectApi(projectId: string, isPublic: boolean): Promise<boolean> {
  try {
    await apiRequest(`${API_BASE_URL}/projects/${projectId}/share`, 'PUT', {
      data: { isPublic }
    });
    return true;
  } catch (error) {
    logger.error('Error sharing project:', error);
    // Intentar mediante cliente Firebase como fallback
    logger.info('Attempting to share project using Firestore client as fallback');
    const { shareProject } = await import('./professional-editor-service');
    await shareProject(projectId, isPublic);
    return true;
  }
}

/**
 * Obtiene proyectos públicos
 * @param limit Límite de proyectos a obtener
 * @returns Lista de proyectos públicos
 */
export async function fetchPublicProjects(limit: number = 10): Promise<any[]> {
  try {
    const response = await apiRequest(`${API_BASE_URL}/projects/public/list?limit=${limit}`);
    return response.projects || [];
  } catch (error) {
    logger.error('Error fetching public projects:', error);
    // Intentar mediante cliente Firebase como fallback
    logger.info('Attempting to fetch public projects using Firestore client as fallback');
    const { getPublicProjects } = await import('./professional-editor-service');
    return await getPublicProjects(limit);
  }
}

/**
 * Exporta un proyecto a un formato JSON descargable
 * @param projectId ID del proyecto a exportar
 * @returns Objeto con el proyecto para exportar
 */
export async function exportProject(projectId: string): Promise<any> {
  try {
    // Primero, obtener el proyecto completo
    const project = await fetchProject(projectId);
    
    if (!project) {
      throw new Error('Proyecto no encontrado');
    }
    
    // Preparar los datos para exportación
    const exportData = {
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      project: {
        name: project.name,
        timeline: typeof project.timeline === 'string' ? JSON.parse(project.timeline) : project.timeline,
        effects: typeof project.effects === 'string' ? JSON.parse(project.effects) : project.effects,
        settings: typeof project.settings === 'string' ? JSON.parse(project.settings) : project.settings,
        // No incluimos datos sensibles como userId o IDs internos
      }
    };
    
    return exportData;
  } catch (error) {
    logger.error('Error exporting project:', error);
    throw new Error('Error al exportar el proyecto');
  }
}

/**
 * Importa un proyecto desde un archivo JSON
 * @param importData Datos del proyecto a importar
 * @returns Proyecto creado/importado
 */
export async function importProject(importData: any): Promise<any> {
  try {
    if (!importData || !importData.project) {
      throw new Error('Formato de importación inválido');
    }
    
    // Validar versión para compatibilidad
    const version = importData.version || '1.0.0';
    logger.info(`Importando proyecto versión ${version}`);
    
    // Preparar datos para guardar
    const projectData = {
      id: `project-${Date.now()}`, // Generar nuevo ID
      name: importData.project.name || 'Proyecto importado',
      timeline: JSON.stringify(importData.project.timeline || []),
      effects: JSON.stringify(importData.project.effects || []),
      settings: JSON.stringify(importData.project.settings || {}),
    };
    
    // Guardar como nuevo proyecto
    return await saveProjectToServer(projectData);
  } catch (error) {
    logger.error('Error importing project:', error);
    throw new Error('Error al importar el proyecto');
  }
}

/**
 * Guarda el proyecto actual (usado directamente por el editor)
 * @param projectData Datos del proyecto actual a guardar
 * @returns Resultado de la operación
 */
export async function saveProject(projectData: any): Promise<{success: boolean, error?: string}> {
  try {
    // Verificar que tenemos datos necesarios para guardar
    if (!projectData || !projectData.name) {
      return { 
        success: false, 
        error: 'Datos de proyecto incompletos' 
      };
    }
    
    // Preparar datos para guardar
    const projectToSave = {
      id: projectData.id || `project-${Date.now()}`, // Usar ID existente o generar uno nuevo
      name: projectData.name,
      timeline: typeof projectData.timeline === 'string' 
        ? projectData.timeline 
        : JSON.stringify(projectData.timeline || []),
      effects: typeof projectData.effects === 'string'
        ? projectData.effects
        : JSON.stringify(projectData.effects || []),
      settings: typeof projectData.settings === 'string'
        ? projectData.settings
        : JSON.stringify(projectData.settings || {})
    };
    
    // Guardar el proyecto en el servidor
    const savedProject = await saveProjectToServer(projectToSave);
    
    return {
      success: true,
      project: savedProject
    };
  } catch (error) {
    logger.error('Error al guardar el proyecto:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al guardar'
    };
  }
}

/**
 * Sube un archivo multimedia (audio, video, imagen) para un proyecto
 * @param projectId ID del proyecto
 * @param file Archivo a subir
 * @param type Tipo de archivo (audio, video, image)
 * @returns URL del archivo subido
 */
export async function uploadMediaFile(
  projectId: string,
  file: File,
  type: 'audio' | 'video' | 'image'
): Promise<string> {
  try {
    // Crear un FormData para subir el archivo
    const formData = new FormData();
    formData.append('file', file);
    formData.append('projectId', projectId);
    formData.append('type', type);
    
    // Realizar la solicitud a la API
    const response = await fetch(`${API_BASE_URL}/media/upload`, {
      method: 'POST',
      body: formData,
      // No incluir 'Content-Type' para que el navegador establezca el boundary correcto
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.url;
  } catch (error) {
    logger.error('Error uploading media file:', error);
    throw new Error('Error al subir el archivo multimedia');
  }
}

/**
 * Actualiza la miniatura de un proyecto
 * @param projectId ID del proyecto
 * @param thumbnailDataUrl Data URL de la miniatura
 * @returns URL de la miniatura actualizada
 */
export async function updateProjectThumbnail(
  projectId: string,
  thumbnailDataUrl: string
): Promise<string> {
  try {
    // Convertir data URL a Blob
    const response = await fetch(thumbnailDataUrl);
    const blob = await response.blob();
    
    // Crear un objeto File a partir del Blob
    const file = new File([blob], `thumbnail-${projectId}.jpg`, { type: 'image/jpeg' });
    
    // Usar la función uploadMediaFile para subir la miniatura
    return await uploadMediaFile(projectId, file, 'image');
  } catch (error) {
    logger.error('Error updating project thumbnail:', error);
    
    // Intentar mediante cliente Firebase como fallback
    logger.info('Attempting to update thumbnail using Firestore client as fallback');
    const { uploadProjectThumbnail } = await import('./professional-editor-service');
    return await uploadProjectThumbnail(projectId, thumbnailDataUrl);
  }
}