import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { logger } from "../logger";
import { db } from '../firebase';
import type { TimelineItem } from '../../components/timeline/TimelineClipUnified';
import type { TimelineClip } from '../../interfaces/timeline';
import { ClipType } from '../../interfaces/timeline';

/**
 * Interface for Music Video Project
 */
export interface MusicVideoProject {
  id: string;
  name: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  // Project data
  audioUrl: string;
  audioFile?: File;
  timelineItems: TimelineItem[];
  artistReferences: string[];
  editingStyle: string;
  // Metadata
  totalScenes: number;
  generatedImages: number;
  generatedVideos: number;
  duration: number;
}

/**
 * Music Video Project Service
 * Handles saving and loading projects from Firestore
 */
class MusicVideoProjectService {
  private collectionName = 'musicVideoProjects';

  /**
   * Save a project to Firestore
   */
  async saveProject(
    userId: string,
    projectName: string,
    projectData: {
      audioUrl: string;
      timelineItems: TimelineItem[];
      artistReferences: string[];
      editingStyle: string;
      duration: number;
    },
    projectId?: string
  ): Promise<string> {
    try {
      const id = projectId || doc(collection(db, this.collectionName)).id;
      const now = new Date();

      // Count generated images and videos
      const generatedImages = projectData.timelineItems.filter(
        item => item.generatedImage || item.firebaseUrl
      ).length;
      
      const generatedVideos = projectData.timelineItems.filter(
        item => item.videoUrl || item.metadata?.lipsync?.videoUrl
      ).length;

      const project: MusicVideoProject = {
        id,
        name: projectName,
        userId,
        createdAt: projectId ? (await this.getProject(projectId))?.createdAt || now : now,
        updatedAt: now,
        audioUrl: projectData.audioUrl,
        timelineItems: projectData.timelineItems,
        artistReferences: projectData.artistReferences,
        editingStyle: projectData.editingStyle,
        totalScenes: projectData.timelineItems.length,
        generatedImages,
        generatedVideos,
        duration: projectData.duration
      };

      await setDoc(doc(db, this.collectionName, id), {
        ...project,
        createdAt: Timestamp.fromDate(project.createdAt),
        updatedAt: Timestamp.fromDate(project.updatedAt)
      });

      logger.info(`✅ Project saved: ${projectName} (${id})`);
      return id;
    } catch (error) {
      logger.error('Error saving project:', error);
      throw error;
    }
  }

  /**
   * Load a project from Firestore
   */
  async getProject(projectId: string): Promise<MusicVideoProject | null> {
    try {
      const docRef = doc(db, this.collectionName, projectId);
      const docSnap = await getDoc(docRef);

      if (!docSnap.exists()) {
        return null;
      }

      const data = docSnap.data();
      return {
        ...data,
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date()
      } as MusicVideoProject;
    } catch (error) {
      logger.error('Error loading project:', error);
      throw error;
    }
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<MusicVideoProject[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('userId', '==', userId),
        orderBy('updatedAt', 'desc')
      );

      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date()
        } as MusicVideoProject;
      });
    } catch (error) {
      logger.error('Error getting user projects:', error);
      throw error;
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, this.collectionName, projectId));
      logger.info(`✅ Project deleted: ${projectId}`);
    } catch (error) {
      logger.error('Error deleting project:', error);
      throw error;
    }
  }

  /**
   * Auto-save project (debounced)
   */
  private autoSaveTimers: Map<string, NodeJS.Timeout> = new Map();

  autoSave(
    userId: string,
    projectName: string,
    projectData: Parameters<typeof this.saveProject>[2],
    projectId?: string,
    delay = 5000
  ): void {
    const key = projectId || 'temp';
    
    // Clear existing timer
    if (this.autoSaveTimers.has(key)) {
      clearTimeout(this.autoSaveTimers.get(key)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.saveProject(userId, projectName, projectData, projectId)
        .then(() => logger.info('✅ Auto-saved project'))
        .catch(err => logger.error('Error auto-saving:', err));
      this.autoSaveTimers.delete(key);
    }, delay);

    this.autoSaveTimers.set(key, timer);
  }

  /**
   * Convert TimelineItem (old format) to TimelineClip (new format)
   * Used for loading AI Video Creator projects into Professional Editor
   */
  convertTimelineItemToClip(item: TimelineItem): TimelineClip {
    // Determine ClipType from TimelineItem
    let clipType: ClipType = ClipType.IMAGE;
    if (item.videoUrl || item.lipsyncVideoUrl) {
      clipType = ClipType.VIDEO;
    } else if (item.audioUrl) {
      clipType = ClipType.AUDIO;
    } else if (item.type === 'text') {
      clipType = ClipType.TEXT;
    } else if (item.type === 'transition') {
      clipType = ClipType.TRANSITION;
    }

    // Determine layer ID (group represents layer in old format)
    const layerId = typeof item.group === 'number' ? item.group : parseInt(String(item.group)) || 1;

    const clip: TimelineClip = {
      id: typeof item.id === 'number' ? item.id : parseInt(String(item.id)) || 0,
      layerId: layerId,
      type: clipType,
      start: item.start_time / 1000, // Convert ms to seconds
      duration: (item.end_time - item.start_time) / 1000, // Convert ms to seconds
      title: item.title || `Scene ${item.id}`,
      url: item.videoUrl || item.imageUrl || item.audioUrl,
      thumbnailUrl: item.thumbnail || item.imageUrl,
      metadata: {
        ...item.metadata,
        imagePrompt: item.imagePrompt,
        shotType: item.shotType,
        section: item.section,
        firebaseUrl: item.firebaseUrl,
        isGeneratedImage: !!item.generatedImage,
        lipsync: item.lipsyncApplied ? {
          applied: true,
          videoUrl: item.lipsyncVideoUrl,
          progress: item.lipsyncProgress,
        } : undefined,
        faceSwapApplied: item.faceSwapApplied,
        movementApplied: item.movementApplied,
        movementPattern: item.movementPattern,
        movementIntensity: item.movementIntensity,
      },
      locked: false,
      generatedImage: !!item.generatedImage,
    };

    return clip;
  }

  /**
   * Convert array of TimelineItems to TimelineClips
   */
  convertTimelineItemsToClips(items: TimelineItem[]): TimelineClip[] {
    return items.map(item => this.convertTimelineItemToClip(item));
  }

  /**
   * Convert TimelineClip back to TimelineItem
   * Used when saving from Professional Editor
   */
  convertClipToTimelineItem(clip: TimelineClip): TimelineItem {
    const item: TimelineItem = {
      id: clip.id,
      group: clip.layerId,
      start_time: clip.start * 1000, // Convert seconds to ms
      end_time: (clip.start + clip.duration) * 1000, // Convert seconds to ms
      duration: clip.duration * 1000,
      title: clip.title,
      thumbnail: clip.thumbnailUrl,
      imageUrl: clip.type === ClipType.IMAGE ? clip.url : undefined,
      videoUrl: clip.type === ClipType.VIDEO ? clip.url : undefined,
      audioUrl: clip.type === ClipType.AUDIO ? clip.url : undefined,
      type: clip.type.toLowerCase(),
      imagePrompt: clip.metadata?.imagePrompt,
      shotType: clip.metadata?.shotType,
      section: clip.metadata?.section,
      generatedImage: clip.generatedImage || clip.metadata?.isGeneratedImage,
      firebaseUrl: clip.metadata?.firebaseUrl,
      lipsyncApplied: clip.metadata?.lipsync?.applied,
      lipsyncVideoUrl: clip.metadata?.lipsync?.videoUrl,
      lipsyncProgress: clip.metadata?.lipsync?.progress,
      faceSwapApplied: clip.metadata?.faceSwapApplied,
      movementApplied: clip.metadata?.movementApplied,
      movementPattern: clip.metadata?.movementPattern,
      movementIntensity: clip.metadata?.movementIntensity,
      metadata: clip.metadata,
    };

    return item;
  }

  /**
   * Convert array of TimelineClips to TimelineItems
   */
  convertClipsToTimelineItems(clips: TimelineClip[]): TimelineItem[] {
    return clips.map(clip => this.convertClipToTimelineItem(clip));
  }
}

export const musicVideoProjectService = new MusicVideoProjectService();
