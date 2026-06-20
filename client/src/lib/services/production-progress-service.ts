import { logger } from "../logger";
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDocs, 
  getDoc,
  orderBy,
  serverTimestamp,
  Timestamp 
} from "firebase/firestore";
import { db } from "../firebase";

// Interfaces
export interface ProductionProject {
  id: string;
  name: string;
  description?: string;
  startDate: Date;
  targetCompletionDate?: Date;
  status: "on-track" | "at-risk" | "delayed" | "completed";
  currentPhaseId?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  collaborators?: Record<string, boolean>;
}

export interface ProductionPhase {
  id: string;
  projectId: string;
  name: string;
  status: "completed" | "in-progress" | "pending" | "delayed";
  progress: number;
  eta?: string;
  notes?: string[];
  startDate?: Date;
  completionDate?: Date;
  priority?: "low" | "medium" | "high";
  dependencies?: string[]; // IDs of phases that must be completed first
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  collaborators?: Record<string, boolean>;
}

export interface ProductionTask {
  id: string;
  phaseId: string;
  projectId: string;
  name: string;
  completed: boolean;
  assignedTo?: string;
  dueDate?: Date;
  notes?: string;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductionNote {
  id: string;
  phaseId: string;
  projectId: string;
  content: string;
  createdBy: string;
  createdByName: string;
  createdAt: Date;
}

export interface ProductionCollaborator {
  id: string;
  userId: string;
  projectId: string;
  name: string;
  role: string;
  email?: string;
  createdAt: Date;
}

class ProductionProgressService {
  private projectsCollection = "production_projects";
  private phasesCollection = "production_phases";
  private tasksCollection = "production_tasks";
  private notesCollection = "production_notes";
  private collaboratorsCollection = "production_collaborators";

  // Project methods
  async getProjects(userId: string): Promise<ProductionProject[]> {
    try {
      // First try with simple query without ordering to avoid index requirements
      const projectsQuery = query(
        collection(db, this.projectsCollection),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(projectsQuery);
      const projects: ProductionProject[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert Firestore timestamps to Date objects
        const project: ProductionProject = {
          id: doc.id,
          name: data.name,
          description: data.description,
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate),
          targetCompletionDate: data.targetCompletionDate ? 
            (data.targetCompletionDate instanceof Timestamp ? 
              data.targetCompletionDate.toDate() : 
              new Date(data.targetCompletionDate)
            ) : undefined,
          status: data.status,
          currentPhaseId: data.currentPhaseId,
          userId: data.userId,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          collaborators: data.collaborators
        };
        
        projects.push(project);
      });
      
      return projects;
    } catch (error) {
      logger.error("Error getting projects:", error);
      throw error;
    }
  }

  async getProjectById(projectId: string): Promise<ProductionProject | null> {
    try {
      const projectDoc = doc(db, this.projectsCollection, projectId);
      const projectSnapshot = await getDoc(projectDoc);
      
      if (!projectSnapshot.exists()) {
        return null;
      }
      
      const data = projectSnapshot.data();
      
      const project: ProductionProject = {
        id: projectSnapshot.id,
        name: data.name,
        description: data.description,
        startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : new Date(data.startDate),
        targetCompletionDate: data.targetCompletionDate ? 
          (data.targetCompletionDate instanceof Timestamp ? 
            data.targetCompletionDate.toDate() : 
            new Date(data.targetCompletionDate)
          ) : undefined,
        status: data.status,
        currentPhaseId: data.currentPhaseId,
        userId: data.userId,
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
        updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
        collaborators: data.collaborators
      };
      
      return project;
    } catch (error) {
      logger.error(`Error getting project with ID ${projectId}:`, error);
      throw error;
    }
  }

  async createProject(projectData: Omit<ProductionProject, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      const projectToCreate = {
        ...projectData,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, this.projectsCollection), projectToCreate);
      return docRef.id;
    } catch (error) {
      logger.error("Error creating project:", error);
      throw error;
    }
  }

  async updateProject(projectId: string, updates: Partial<ProductionProject>): Promise<void> {
    try {
      const projectRef = doc(db, this.projectsCollection, projectId);
      
      // Add updated timestamp
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(projectRef, updatedData);
    } catch (error) {
      logger.error(`Error updating project with ID ${projectId}:`, error);
      throw error;
    }
  }

  async deleteProject(projectId: string): Promise<void> {
    try {
      // Delete related data first
      await this.deleteRelatedData(projectId);
      
      // Then delete the project
      const projectRef = doc(db, this.projectsCollection, projectId);
      await deleteDoc(projectRef);
    } catch (error) {
      logger.error(`Error deleting project with ID ${projectId}:`, error);
      throw error;
    }
  }

  private async deleteRelatedData(projectId: string): Promise<void> {
    try {
      // Get all phases for the project
      const phases = await this.getPhasesByProjectId(projectId);
      
      // Delete tasks, notes, and phases
      for (const phase of phases) {
        // Delete tasks
        const tasksQuery = query(
          collection(db, this.tasksCollection),
          where("phaseId", "==", phase.id)
        );
        const taskSnapshot = await getDocs(tasksQuery);
        const taskPromises = taskSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(taskPromises);
        
        // Delete notes
        const notesQuery = query(
          collection(db, this.notesCollection),
          where("phaseId", "==", phase.id)
        );
        const notesSnapshot = await getDocs(notesQuery);
        const notesPromises = notesSnapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(notesPromises);
        
        // Delete the phase
        const phaseRef = doc(db, this.phasesCollection, phase.id);
        await deleteDoc(phaseRef);
      }
      
      // Delete collaborators
      const collaboratorsQuery = query(
        collection(db, this.collaboratorsCollection),
        where("projectId", "==", projectId)
      );
      const collaboratorsSnapshot = await getDocs(collaboratorsQuery);
      const collaboratorPromises = collaboratorsSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(collaboratorPromises);
    } catch (error) {
      logger.error(`Error deleting related data for project ${projectId}:`, error);
      throw error;
    }
  }

  // Phase methods
  async getPhasesByProjectId(projectId: string): Promise<ProductionPhase[]> {
    try {
      const phasesQuery = query(
        collection(db, this.phasesCollection),
        where("projectId", "==", projectId)
      );
      
      const querySnapshot = await getDocs(phasesQuery);
      const phases: ProductionPhase[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        const phase: ProductionPhase = {
          id: doc.id,
          projectId: data.projectId,
          name: data.name,
          status: data.status,
          progress: data.progress,
          eta: data.eta,
          notes: data.notes,
          startDate: data.startDate instanceof Timestamp ? data.startDate.toDate() : 
            data.startDate ? new Date(data.startDate) : undefined,
          completionDate: data.completionDate instanceof Timestamp ? data.completionDate.toDate() : 
            data.completionDate ? new Date(data.completionDate) : undefined,
          priority: data.priority,
          dependencies: data.dependencies,
          userId: data.userId,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt),
          collaborators: data.collaborators
        };
        
        phases.push(phase);
      });
      
      return phases;
    } catch (error) {
      logger.error(`Error getting phases for project ${projectId}:`, error);
      throw error;
    }
  }

  async createPhase(phaseData: Omit<ProductionPhase, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      const phaseToCreate = {
        ...phaseData,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, this.phasesCollection), phaseToCreate);
      return docRef.id;
    } catch (error) {
      logger.error("Error creating phase:", error);
      throw error;
    }
  }

  async updatePhase(phaseId: string, updates: Partial<ProductionPhase>): Promise<void> {
    try {
      const phaseRef = doc(db, this.phasesCollection, phaseId);
      
      // Add updated timestamp
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(phaseRef, updatedData);
    } catch (error) {
      logger.error(`Error updating phase with ID ${phaseId}:`, error);
      throw error;
    }
  }

  async deletePhase(phaseId: string): Promise<void> {
    try {
      // Delete related tasks and notes first
      await this.deleteTasksAndNotesByPhaseId(phaseId);
      
      // Then delete the phase
      const phaseRef = doc(db, this.phasesCollection, phaseId);
      await deleteDoc(phaseRef);
    } catch (error) {
      logger.error(`Error deleting phase with ID ${phaseId}:`, error);
      throw error;
    }
  }

  private async deleteTasksAndNotesByPhaseId(phaseId: string): Promise<void> {
    try {
      // Delete tasks
      const tasksQuery = query(
        collection(db, this.tasksCollection),
        where("phaseId", "==", phaseId)
      );
      const taskSnapshot = await getDocs(tasksQuery);
      const taskPromises = taskSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(taskPromises);
      
      // Delete notes
      const notesQuery = query(
        collection(db, this.notesCollection),
        where("phaseId", "==", phaseId)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const notesPromises = notesSnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(notesPromises);
    } catch (error) {
      logger.error(`Error deleting tasks and notes for phase ${phaseId}:`, error);
      throw error;
    }
  }

  // Task methods
  async getTasksByPhaseId(phaseId: string): Promise<ProductionTask[]> {
    try {
      const tasksQuery = query(
        collection(db, this.tasksCollection),
        where("phaseId", "==", phaseId)
      );
      
      const querySnapshot = await getDocs(tasksQuery);
      const tasks: ProductionTask[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        const task: ProductionTask = {
          id: doc.id,
          phaseId: data.phaseId,
          projectId: data.projectId,
          name: data.name,
          completed: data.completed,
          assignedTo: data.assignedTo,
          dueDate: data.dueDate instanceof Timestamp ? data.dueDate.toDate() : 
            data.dueDate ? new Date(data.dueDate) : undefined,
          notes: data.notes,
          userId: data.userId,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt instanceof Timestamp ? data.updatedAt.toDate() : new Date(data.updatedAt)
        };
        
        tasks.push(task);
      });
      
      return tasks;
    } catch (error) {
      logger.error(`Error getting tasks for phase ${phaseId}:`, error);
      throw error;
    }
  }

  async createTask(taskData: Omit<ProductionTask, "id" | "createdAt" | "updatedAt">): Promise<string> {
    try {
      const now = new Date();
      const taskToCreate = {
        ...taskData,
        createdAt: now,
        updatedAt: now
      };
      
      const docRef = await addDoc(collection(db, this.tasksCollection), taskToCreate);
      return docRef.id;
    } catch (error) {
      logger.error("Error creating task:", error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: Partial<ProductionTask>): Promise<void> {
    try {
      const taskRef = doc(db, this.tasksCollection, taskId);
      
      // Add updated timestamp
      const updatedData = {
        ...updates,
        updatedAt: new Date()
      };
      
      await updateDoc(taskRef, updatedData);
    } catch (error) {
      logger.error(`Error updating task with ID ${taskId}:`, error);
      throw error;
    }
  }

  async deleteTask(taskId: string): Promise<void> {
    try {
      const taskRef = doc(db, this.tasksCollection, taskId);
      await deleteDoc(taskRef);
    } catch (error) {
      logger.error(`Error deleting task with ID ${taskId}:`, error);
      throw error;
    }
  }

  // Note methods
  async getNotesByPhaseId(phaseId: string): Promise<ProductionNote[]> {
    try {
      const notesQuery = query(
        collection(db, this.notesCollection),
        where("phaseId", "==", phaseId)
      );
      
      const querySnapshot = await getDocs(notesQuery);
      const notes: ProductionNote[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        const note: ProductionNote = {
          id: doc.id,
          phaseId: data.phaseId,
          projectId: data.projectId,
          content: data.content,
          createdBy: data.createdBy,
          createdByName: data.createdByName,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
        };
        
        notes.push(note);
      });
      
      return notes;
    } catch (error) {
      logger.error(`Error getting notes for phase ${phaseId}:`, error);
      throw error;
    }
  }

  async createNote(noteData: Omit<ProductionNote, "id" | "createdAt">): Promise<string> {
    try {
      const noteToCreate = {
        ...noteData,
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, this.notesCollection), noteToCreate);
      return docRef.id;
    } catch (error) {
      logger.error("Error creating note:", error);
      throw error;
    }
  }

  async deleteNote(noteId: string): Promise<void> {
    try {
      const noteRef = doc(db, this.notesCollection, noteId);
      await deleteDoc(noteRef);
    } catch (error) {
      logger.error(`Error deleting note with ID ${noteId}:`, error);
      throw error;
    }
  }

  // Collaborator methods
  async getCollaboratorsByProjectId(projectId: string): Promise<ProductionCollaborator[]> {
    try {
      const collaboratorsQuery = query(
        collection(db, this.collaboratorsCollection),
        where("projectId", "==", projectId)
      );
      
      const querySnapshot = await getDocs(collaboratorsQuery);
      const collaborators: ProductionCollaborator[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        const collaborator: ProductionCollaborator = {
          id: doc.id,
          userId: data.userId,
          projectId: data.projectId,
          name: data.name,
          role: data.role,
          email: data.email,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(data.createdAt)
        };
        
        collaborators.push(collaborator);
      });
      
      return collaborators;
    } catch (error) {
      logger.error(`Error getting collaborators for project ${projectId}:`, error);
      throw error;
    }
  }

  async addCollaborator(collaboratorData: Omit<ProductionCollaborator, "id" | "createdAt">): Promise<string> {
    try {
      const collaboratorToCreate = {
        ...collaboratorData,
        createdAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, this.collaboratorsCollection), collaboratorToCreate);
      return docRef.id;
    } catch (error) {
      logger.error("Error adding collaborator:", error);
      throw error;
    }
  }

  async removeCollaborator(collaboratorId: string, projectId: string, userId: string): Promise<void> {
    try {
      // Verify the user has permission to remove this collaborator
      const projectRef = doc(db, this.projectsCollection, projectId);
      const projectSnapshot = await getDoc(projectRef);
      
      if (!projectSnapshot.exists() || projectSnapshot.data().userId !== userId) {
        throw new Error("Unauthorized action");
      }
      
      const collaboratorRef = doc(db, this.collaboratorsCollection, collaboratorId);
      await deleteDoc(collaboratorRef);
    } catch (error) {
      logger.error(`Error removing collaborator with ID ${collaboratorId}:`, error);
      throw error;
    }
  }

  // Helper functions
  calculatePhaseCompletion(tasks: ProductionTask[]): number {
    if (tasks.length === 0) return 0;
    
    const completedTasks = tasks.filter(task => task.completed).length;
    return Math.round((completedTasks / tasks.length) * 100);
  }

  calculateProjectProgress(phases: ProductionPhase[]): number {
    if (phases.length === 0) return 0;
    
    // Calculate weighted progress based on each phase
    const totalProgress = phases.reduce((sum, phase) => sum + phase.progress, 0);
    return Math.round(totalProgress / phases.length);
  }
}

export const productionProgressService = new ProductionProgressService();