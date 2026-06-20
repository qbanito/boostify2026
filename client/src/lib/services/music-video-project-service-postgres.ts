import type { TimelineItem } from '../../components/timeline/TimelineClipUnified';
import { logger } from "../logger";

/**
 * Interface for Music Video Project (PostgreSQL version)
 */
export interface MusicVideoProjectPostgres {
  id: number;
  userEmail: string;
  projectName: string;
  artistName?: string;
  songName?: string;
  thumbnail?: string;
  audioUrl?: string;
  audioDuration?: number;
  transcription?: string;
  scriptContent?: string;
  timelineItems: any[];
  selectedDirector?: {
    id: string;
    name: string;
    specialty: string;
    style: string;
    experience: string;
  };
  videoStyle?: {
    cameraFormat: string;
    mood: string;
    characterStyle: string;
    colorPalette: string;
    visualIntensity: number;
    narrativeIntensity: number;
    selectedDirector: any;
  };
  artistReferenceImages?: string[];
  selectedEditingStyle?: {
    id: string;
    name: string;
    description: string;
    duration: { min: number; max: number };
  };
  generatedConcepts?: any[];
  selectedConcept?: any;
  status: "draft" | "generating_script" | "generating_images" | "generating_videos" | "completed";
  progress?: {
    scriptGenerated: boolean;
    imagesGenerated: number;
    totalImages: number;
    videosGenerated: number;
    totalVideos: number;
  };
  lastModified: string;
  createdAt: string;
  tags?: string[];
}

/**
 * Music Video Project Service (PostgreSQL Backend)
 */
class MusicVideoProjectServicePostgres {
  private baseUrl = '/api/music-video-projects';

  /**
   * Save a project to PostgreSQL
   */
  async saveProject(projectData: {
    userEmail: string;
    projectName: string;
    artistName?: string;
    songName?: string;
    thumbnail?: string;
    audioUrl?: string;
    audioDuration?: number;
    transcription?: string;
    scriptContent?: string;
    timelineItems: TimelineItem[];
    selectedDirector?: any;
    videoStyle?: any;
    artistReferenceImages?: string[];
    selectedEditingStyle?: any;
    generatedConcepts?: any[];
    selectedConcept?: any;
    status?: "draft" | "generating_script" | "generating_images" | "generating_videos" | "completed";
    progress?: {
      scriptGenerated: boolean;
      imagesGenerated: number;
      totalImages: number;
      videosGenerated: number;
      totalVideos: number;
    };
    tags?: string[];
  }): Promise<{ success: boolean; project: MusicVideoProjectPostgres; isNew: boolean }> {
    try {
      logger.info('💾 Guardando proyecto:', projectData.projectName);
      
      const response = await fetch(`${this.baseUrl}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectData),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info('✅ Proyecto guardado:', result.project.id);
      
      return result;
    } catch (error) {
      logger.error('❌ Error guardando proyecto:', error);
      throw error;
    }
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userEmail: string): Promise<MusicVideoProjectPostgres[]> {
    try {
      logger.info('📋 Cargando proyectos para userEmail:', userEmail);
      
      const response = await fetch(`${this.baseUrl}/list/${userEmail}`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info(`✅ Encontrados ${result.projects.length} proyectos`);
      
      return result.projects;
    } catch (error) {
      logger.error('❌ Error cargando proyectos:', error);
      throw error;
    }
  }

  /**
   * Load a specific project
   */
  async getProject(projectId: number): Promise<MusicVideoProjectPostgres | null> {
    try {
      logger.info('📂 Cargando proyecto:', projectId);
      
      const response = await fetch(`${this.baseUrl}/load/${projectId}`);

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info('✅ Proyecto cargado:', result.project.projectName);
      
      return result.project;
    } catch (error) {
      logger.error('❌ Error cargando proyecto:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: number): Promise<void> {
    try {
      logger.info('🗑️ Eliminando proyecto:', projectId);
      
      const response = await fetch(`${this.baseUrl}/delete/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      logger.info('✅ Proyecto eliminado');
    } catch (error) {
      logger.error('❌ Error eliminando proyecto:', error);
      throw error;
    }
  }

  /**
   * Rename a project
   */
  async renameProject(
    projectId: number,
    newName: string,
    userEmail: string
  ): Promise<{ success: boolean; project: MusicVideoProjectPostgres }> {
    try {
      logger.info('✏️ Renombrando proyecto:', projectId, 'a:', newName);
      
      const response = await fetch(`${this.baseUrl}/rename`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          projectId: projectId.toString(),
          newName,
          userEmail,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      logger.info('✅ Proyecto renombrado exitosamente');
      
      return result;
    } catch (error) {
      logger.error('❌ Error renombrando proyecto:', error);
      throw error;
    }
  }

  /**
   * Auto-save project (debounced)
   */
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  autoSave(
    projectData: Parameters<typeof this.saveProject>[0],
    delay = 5000
  ): void {
    const key = `${projectData.userEmail}-${projectData.projectName}`;
    
    // Clear existing timer
    if (this.autoSaveTimers.has(key)) {
      clearTimeout(this.autoSaveTimers.get(key)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.saveProject(projectData)
        .then(() => logger.info('✅ Auto-guardado exitoso:', projectData.projectName))
        .catch(err => logger.error('❌ Error en auto-guardado:', err));
      this.autoSaveTimers.delete(key);
    }, delay);

    this.autoSaveTimers.set(key, timer);
  }
}

export const musicVideoProjectServicePostgres = new MusicVideoProjectServicePostgres();
