import React, { 
  createContext, 
  useContext, 
  useState, 
  useCallback, 
  ReactNode, 
  useEffect 
} from 'react';
import { logger } from "../logger";
import { v4 as uuidv4 } from 'uuid';
import { 
  Project,
  Track,
  Clip,
  AudioClip,
  TextClip,
  VisualEffect,
  CameraMovement,
  Transcription,
  Beat,
  Section,
  PlayheadPosition,
  TimelineViewState,
  EditorError,
  ProjectSaveStatus,
  ThumbnailData
} from '../professional-editor-types';

// Definimos una interfaz para WorkflowData para mayor tipado
export interface WorkflowData {
  steps?: { id: string; status: 'pending' | 'in-progress' | 'completed' | 'skipped'; timestamp?: Date }[];
  activeTimeline?: boolean;
  timelineProgress?: number;
  [key: string]: any; // Para permitir campos adicionales específicos
}

// Tipo para el contexto del editor
export interface EditorContextType {
  // Estado global
  state: {
    project: Project | null;
    playhead: PlayheadPosition;
    timelineView: TimelineViewState;
    selectedTrackId: string | null;
    selectedClipId: string | null;
    selectedEffectId: string | null;
    errors: EditorError[];
    history: {
      undoStack: any[];
      redoStack: any[];
      canUndo: boolean;
      canRedo: boolean;
    };
    saveStatus: ProjectSaveStatus;
    lastSaved: Date | null;
  };
  
  // Acciones - Proyecto
  createProject: (projectData: Partial<Project>) => Promise<Project>;
  loadProject: (projectId: string) => Promise<Project | null>;
  saveProject: () => Promise<boolean>;
  exportProject: () => Promise<string>;
  
  // Acciones - Reproducción
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  
  // Acciones - Historial
  undo: () => void;
  redo: () => void;
  
  // Acciones - Pistas
  addTrack: (track: Omit<Track, 'id'>) => void;
  updateTrack: (trackId: string, updates: Partial<Track>) => void;
  removeTrack: (trackId: string) => void;
  setSelectedTrack: (trackId: string | null) => void;
  reorderTracks: (startIndex: number, endIndex: number) => void;
  
  // Acciones - Clips
  addClip: (clip: Omit<Clip, 'id'>) => void;
  updateClip: (clipId: string, updates: Partial<Clip>) => void;
  removeClip: (clipId: string) => void;
  setSelectedClip: (clipId: string | null) => void;
  
  // Acciones - Audio Clips
  addAudioClip: (clip: Omit<AudioClip, 'id'>) => void;
  updateAudioClip: (clipId: string, updates: Partial<AudioClip>) => void;
  removeAudioClip: (clipId: string) => void;
  
  // Acciones - Text Clips
  addTextClip: (clip: Omit<TextClip, 'id'>) => void;
  updateTextClip: (clipId: string, updates: Partial<TextClip>) => void;
  removeTextClip: (clipId: string) => void;
  
  // Acciones - Efectos
  addEffect: (effect: Omit<VisualEffect, 'id'>) => void;
  updateEffect: (effectId: string, updates: Partial<VisualEffect>) => void;
  removeEffect: (effectId: string) => void;
  setSelectedEffect: (effectId: string | null) => void;
  
  // Acciones - Movimientos de cámara
  addCameraMovement: (movement: Omit<CameraMovement, 'id'>) => void;
  updateCameraMovement: (movementId: string, updates: Partial<CameraMovement>) => void;
  removeCameraMovement: (movementId: string) => void;
  
  // Acciones - Transcripciones
  addTranscription: (transcription: Omit<Transcription, 'id'>) => void;
  updateTranscription: (transcriptionId: string, updates: Partial<Transcription>) => void;
  removeTranscription: (transcriptionId: string) => void;
  
  // Acciones - Beats
  addBeat: (beat: Omit<Beat, 'id'>) => void;
  updateBeat: (beatId: string, updates: Partial<Beat>) => void;
  removeBeat: (beatId: string) => void;
  updateBeats: (beats: Beat[]) => void;
  
  // Acciones - Secciones
  addSection: (section: Omit<Section, 'id'>) => void;
  updateSection: (sectionId: string, updates: Partial<Section>) => void;
  removeSection: (sectionId: string) => void;
  updateSections: (sections: Section[]) => void;
  
  // Acciones - Timeline
  setTimelineView: (updates: Partial<TimelineViewState>) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  
  // Acciones - Errores
  addError: (error: Omit<EditorError, 'timestamp'>) => void;
  clearErrors: () => void;
  
  // Acciones para Workflow UI
  setCurrentStep: (step: number) => void;
  markStepAsCompleted: (step: number) => void;
  updateWorkflowData: (data: Partial<WorkflowData>) => void;
  workflowData: WorkflowData; // Estado de datos del workflow
  
  // Control de reproducción avanzado
  setCurrentPlaybackTime: (time: number) => void;
  setPlaybackState: (isPlaying: boolean) => void;
}

// Estado inicial del editor
const initialEditorState = {
  project: null,
  playhead: {
    time: 0,
    isPlaying: false,
    speed: 1
  },
  timelineView: {
    scale: 1,
    offset: 0,
    visibleStartTime: 0,
    visibleEndTime: 60
  },
  selectedTrackId: null,
  selectedClipId: null,
  selectedEffectId: null,
  errors: [],
  history: {
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false
  },
  saveStatus: ProjectSaveStatus.SAVED,
  lastSaved: null
};

// Crear contexto
const EditorContext = createContext<EditorContextType | null>(null);

// Proveedor del contexto
export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialEditorState);
  
  // Estado para manejar datos del workflow separados del estado principal
  const [workflowData, setWorkflowData] = useState<WorkflowData>({});
  
  // Actualizar el estado
  const updateState = useCallback((updates: Partial<typeof state>) => {
    setState(prevState => ({
      ...prevState,
      ...updates
    }));
  }, []);
  
  // Actualizar el proyecto
  const updateProject = useCallback((updates: Partial<Project> | ((prevProject: Project | null) => Project | null)) => {
    setState(prevState => {
      let updatedProject: Project | null;
      
      if (typeof updates === 'function') {
        updatedProject = updates(prevState.project);
      } else {
        updatedProject = prevState.project 
          ? { ...prevState.project, ...updates, updatedAt: new Date() } 
          : null;
      }
      
      return {
        ...prevState,
        project: updatedProject,
        saveStatus: updatedProject ? ProjectSaveStatus.UNSAVED : prevState.saveStatus
      };
    });
  }, []);
  
  // === ACCIONES DE PROYECTO ===
  
  // Crear un nuevo proyecto
  const createProject = useCallback(async (projectData: Partial<Project>): Promise<Project> => {
    const now = new Date();
    const newProject: Project = {
      id: uuidv4(),
      name: projectData.name || 'Untitled Project',
      duration: projectData.duration || 60, // 60 segundos por defecto
      resolution: projectData.resolution || { width: 1920, height: 1080 },
      frameRate: projectData.frameRate || 30,
      audioSampleRate: projectData.audioSampleRate || 48000,
      language: projectData.language || 'es',
      
      // Flujo de trabajo
      currentStep: projectData.currentStep || 0,
      completedSteps: projectData.completedSteps || [],
      
      tracks: projectData.tracks || [],
      clips: projectData.clips || [],
      audioClips: projectData.audioClips || [],
      textClips: projectData.textClips || [],
      effects: projectData.effects || [],
      cameraMovements: projectData.cameraMovements || [],
      transcriptions: projectData.transcriptions || [],
      beats: projectData.beats || [],
      sections: projectData.sections || [],
      
      exportOptions: projectData.exportOptions || {
        startTime: 0,
        endTime: projectData.duration || 60,
        format: 'mp4',
        quality: 'high',
        resolution: '1080p',
        frameRate: projectData.frameRate || 30,
        includeAudio: true,
        includeSubtitles: false,
        watermark: false,
        effects: true,
        metadata: {}
      },
      
      createdAt: now,
      updatedAt: now,
      version: '1.0.0',
    };
    
    // Crear una pista por defecto si no hay ninguna
    if (newProject.tracks.length === 0) {
      newProject.tracks.push({
        id: uuidv4(),
        name: 'Video Track 1',
        type: 'video',
        position: 0,
        visible: true,
        locked: false,
        muted: false,
        solo: false,
        color: '#4B91F7',
        createdAt: now
      });
    }
    
    setState(prevState => ({
      ...prevState,
      project: newProject,
      saveStatus: ProjectSaveStatus.UNSAVED,
      lastSaved: null
    }));
    
    return newProject;
  }, []);
  
  // Cargar un proyecto existente
  const loadProject = useCallback(async (projectId: string): Promise<Project | null> => {
    try {
      // En un caso real, aquí se cargaría el proyecto desde el servidor
      // Por ahora, solo simularemos una carga exitosa
      
      const now = new Date();
      const loadedProject: Project = {
        id: projectId,
        name: 'Loaded Project',
        duration: 60,
        resolution: { width: 1920, height: 1080 },
        frameRate: 30,
        audioSampleRate: 48000,
        language: 'es',
        
        // Flujo de trabajo
        currentStep: 0,
        completedSteps: [],
        
        tracks: [
          {
            id: uuidv4(),
            name: 'Video Track 1',
            type: 'video',
            position: 0,
            visible: true,
            locked: false,
            muted: false,
            solo: false,
            color: '#4B91F7',
            createdAt: now
          }
        ],
        clips: [],
        audioClips: [],
        textClips: [],
        effects: [],
        cameraMovements: [],
        transcriptions: [],
        beats: [],
        sections: [],
        
        exportOptions: {
          startTime: 0,
          endTime: 60,
          format: 'mp4',
          quality: 'high',
          resolution: '1080p',
          frameRate: 30,
          includeAudio: true,
          includeSubtitles: false,
          watermark: false,
          effects: true,
          metadata: {}
        },
        
        createdAt: now,
        updatedAt: now,
        version: '1.0.0',
      };
      
      setState(prevState => ({
        ...prevState,
        project: loadedProject,
        saveStatus: ProjectSaveStatus.SAVED,
        lastSaved: now
      }));
      
      return loadedProject;
    } catch (error) {
      logger.error('Error al cargar el proyecto:', error);
      
      addError({
        code: 'LOAD_PROJECT_ERROR',
        message: `Error al cargar el proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
      
      return null;
    }
  }, []);
  
  // Guardar el proyecto actual
  const saveProject = useCallback(async (): Promise<boolean> => {
    if (!state.project) {
      addError({
        code: 'SAVE_PROJECT_ERROR',
        message: 'No hay un proyecto para guardar'
      });
      return false;
    }
    
    try {
      // Actualizar el estado para indicar que se está guardando
      updateState({
        saveStatus: ProjectSaveStatus.SAVING
      });
      
      // En un caso real, aquí se guardaría el proyecto en el servidor
      // Por ahora, solo simularemos un guardado exitoso después de un breve retraso
      
      const now = new Date();
      
      // Simular retraso de red
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Actualizar el proyecto con la nueva fecha de actualización
      updateProject(prevProject => {
        if (!prevProject) return null;
        
        return {
          ...prevProject,
          updatedAt: now
        };
      });
      
      // Actualizar el estado para indicar que se ha guardado correctamente
      updateState({
        saveStatus: ProjectSaveStatus.SAVED,
        lastSaved: now
      });
      
      return true;
    } catch (error) {
      logger.error('Error al guardar el proyecto:', error);
      
      // Actualizar el estado para indicar que ha habido un error
      updateState({
        saveStatus: ProjectSaveStatus.ERROR
      });
      
      addError({
        code: 'SAVE_PROJECT_ERROR',
        message: `Error al guardar el proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
      
      return false;
    }
  }, [state.project, updateState, updateProject]);
  
  // Exportar el proyecto
  const exportProject = useCallback(async (): Promise<string> => {
    if (!state.project) {
      throw new Error('No hay un proyecto para exportar');
    }
    
    try {
      // En un caso real, aquí se exportaría el proyecto a un archivo de video
      // Por ahora, solo simularemos una exportación exitosa después de un retraso
      
      // Simular retraso de procesamiento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // URL simulada al video exportado
      const exportedUrl = `https://example.com/videos/${state.project.id}.mp4`;
      
      return exportedUrl;
    } catch (error) {
      logger.error('Error al exportar el proyecto:', error);
      
      addError({
        code: 'EXPORT_PROJECT_ERROR',
        message: `Error al exportar el proyecto: ${error instanceof Error ? error.message : 'Error desconocido'}`
      });
      
      throw error;
    }
  }, [state.project]);
  
  // === ACCIONES DE REPRODUCCIÓN ===
  
  // Iniciar reproducción
  const play = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      playhead: {
        ...prevState.playhead,
        isPlaying: true
      }
    }));
  }, []);
  
  // Pausar reproducción
  const pause = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      playhead: {
        ...prevState.playhead,
        isPlaying: false
      }
    }));
  }, []);
  
  // Buscar una posición específica
  const seek = useCallback((time: number) => {
    setState(prevState => ({
      ...prevState,
      playhead: {
        ...prevState.playhead,
        time: Math.max(0, Math.min(time, prevState.project?.duration || 60))
      }
    }));
  }, []);
  
  // === ACCIONES DE HISTORIAL ===
  
  // Deshacer la última acción
  const undo = useCallback(() => {
    // Implementación básica - en un caso real, necesitaríamos un sistema más robusto
    setState(prevState => {
      if (prevState.history.undoStack.length === 0) {
        return prevState;
      }
      
      const lastAction = prevState.history.undoStack[prevState.history.undoStack.length - 1];
      
      // Aquí implementaríamos la lógica para deshacer la acción
      // Por ahora, solo actualizamos el estado del historial
      
      return {
        ...prevState,
        history: {
          undoStack: prevState.history.undoStack.slice(0, -1),
          redoStack: [...prevState.history.redoStack, lastAction],
          canUndo: prevState.history.undoStack.length > 1,
          canRedo: true
        }
      };
    });
  }, []);
  
  // Rehacer la última acción deshecha
  const redo = useCallback(() => {
    // Implementación básica - en un caso real, necesitaríamos un sistema más robusto
    setState(prevState => {
      if (prevState.history.redoStack.length === 0) {
        return prevState;
      }
      
      const nextAction = prevState.history.redoStack[prevState.history.redoStack.length - 1];
      
      // Aquí implementaríamos la lógica para rehacer la acción
      // Por ahora, solo actualizamos el estado del historial
      
      return {
        ...prevState,
        history: {
          undoStack: [...prevState.history.undoStack, nextAction],
          redoStack: prevState.history.redoStack.slice(0, -1),
          canUndo: true,
          canRedo: prevState.history.redoStack.length > 1
        }
      };
    });
  }, []);
  
  // === ACCIONES DE PISTAS ===
  
  // Añadir una nueva pista
  const addTrack = useCallback((track: Omit<Track, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newTrack: Track = {
        ...track,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        tracks: [...prevProject.tracks, newTrack]
      };
    });
  }, [updateProject]);
  
  // Actualizar una pista existente
  const updateTrack = useCallback((trackId: string, updates: Partial<Track>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        tracks: prevProject.tracks.map(track => 
          track.id === trackId
            ? { ...track, ...updates, updatedAt: new Date() }
            : track
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar una pista
  const removeTrack = useCallback((trackId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const tracksWithoutRemoved = prevProject.tracks.filter(track => track.id !== trackId);
      
      // Ajustar las posiciones de las pistas restantes
      const updatedTracks = tracksWithoutRemoved.map((track, index) => ({
        ...track,
        position: index
      }));
      
      return {
        ...prevProject,
        tracks: updatedTracks,
        // También eliminar clips asociados a esta pista
        clips: prevProject.clips.filter(clip => clip.trackId !== trackId),
        audioClips: prevProject.audioClips.filter(clip => clip.trackId !== trackId),
        textClips: prevProject.textClips.filter(clip => clip.trackId !== trackId),
        effects: prevProject.effects.filter(effect => effect.trackId !== trackId),
        cameraMovements: prevProject.cameraMovements.filter(movement => movement.trackId !== trackId)
      };
    });
    
    // Si la pista eliminada era la seleccionada, deseleccionarla
    setState(prevState => {
      if (prevState.selectedTrackId === trackId) {
        return {
          ...prevState,
          selectedTrackId: null
        };
      }
      return prevState;
    });
  }, [updateProject]);
  
  // Seleccionar una pista
  const setSelectedTrack = useCallback((trackId: string | null) => {
    setState(prevState => ({
      ...prevState,
      selectedTrackId: trackId
    }));
  }, []);
  
  // Reordenar pistas
  const reorderTracks = useCallback((startIndex: number, endIndex: number) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const tracks = [...prevProject.tracks];
      
      // Eliminar la pista de la posición original
      const [removedTrack] = tracks.splice(startIndex, 1);
      
      // Insertar la pista en la nueva posición
      tracks.splice(endIndex, 0, removedTrack);
      
      // Actualizar las posiciones de todas las pistas
      const updatedTracks = tracks.map((track, index) => ({
        ...track,
        position: index
      }));
      
      return {
        ...prevProject,
        tracks: updatedTracks
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE CLIPS ===
  
  // Añadir un nuevo clip
  const addClip = useCallback((clip: Omit<Clip, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newClip: Clip = {
        ...clip,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        clips: [...prevProject.clips, newClip]
      };
    });
  }, [updateProject]);
  
  // Actualizar un clip existente
  const updateClip = useCallback((clipId: string, updates: Partial<Clip>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        clips: prevProject.clips.map(clip => 
          clip.id === clipId
            ? { ...clip, ...updates, updatedAt: new Date() }
            : clip
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un clip
  const removeClip = useCallback((clipId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        clips: prevProject.clips.filter(clip => clip.id !== clipId)
      };
    });
    
    // Si el clip eliminado era el seleccionado, deseleccionarlo
    setState(prevState => {
      if (prevState.selectedClipId === clipId) {
        return {
          ...prevState,
          selectedClipId: null
        };
      }
      return prevState;
    });
  }, [updateProject]);
  
  // Seleccionar un clip
  const setSelectedClip = useCallback((clipId: string | null) => {
    setState(prevState => ({
      ...prevState,
      selectedClipId: clipId
    }));
  }, []);
  
  // === ACCIONES DE AUDIO CLIPS ===
  
  // Añadir un nuevo clip de audio
  const addAudioClip = useCallback((clip: Omit<AudioClip, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newClip: AudioClip = {
        ...clip,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        audioClips: [...prevProject.audioClips, newClip]
      };
    });
  }, [updateProject]);
  
  // Actualizar un clip de audio existente
  const updateAudioClip = useCallback((clipId: string, updates: Partial<AudioClip>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        audioClips: prevProject.audioClips.map(clip => 
          clip.id === clipId
            ? { ...clip, ...updates, updatedAt: new Date() }
            : clip
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un clip de audio
  const removeAudioClip = useCallback((clipId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        audioClips: prevProject.audioClips.filter(clip => clip.id !== clipId)
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE TEXT CLIPS ===
  
  // Añadir un nuevo clip de texto
  const addTextClip = useCallback((clip: Omit<TextClip, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newClip: TextClip = {
        ...clip,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        textClips: [...prevProject.textClips, newClip]
      };
    });
  }, [updateProject]);
  
  // Actualizar un clip de texto existente
  const updateTextClip = useCallback((clipId: string, updates: Partial<TextClip>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        textClips: prevProject.textClips.map(clip => 
          clip.id === clipId
            ? { ...clip, ...updates, updatedAt: new Date() }
            : clip
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un clip de texto
  const removeTextClip = useCallback((clipId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        textClips: prevProject.textClips.filter(clip => clip.id !== clipId)
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE EFECTOS ===
  
  // Añadir un nuevo efecto
  const addEffect = useCallback((effect: Omit<VisualEffect, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newEffect: VisualEffect = {
        ...effect,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        effects: [...prevProject.effects, newEffect]
      };
    });
  }, [updateProject]);
  
  // Actualizar un efecto existente
  const updateEffect = useCallback((effectId: string, updates: Partial<VisualEffect>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        effects: prevProject.effects.map(effect => 
          effect.id === effectId
            ? { ...effect, ...updates, updatedAt: new Date() }
            : effect
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un efecto
  const removeEffect = useCallback((effectId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        effects: prevProject.effects.filter(effect => effect.id !== effectId)
      };
    });
    
    // Si el efecto eliminado era el seleccionado, deseleccionarlo
    setState(prevState => {
      if (prevState.selectedEffectId === effectId) {
        return {
          ...prevState,
          selectedEffectId: null
        };
      }
      return prevState;
    });
  }, [updateProject]);
  
  // Seleccionar un efecto
  const setSelectedEffect = useCallback((effectId: string | null) => {
    setState(prevState => ({
      ...prevState,
      selectedEffectId: effectId
    }));
  }, []);
  
  // === ACCIONES DE MOVIMIENTOS DE CÁMARA ===
  
  // Añadir un nuevo movimiento de cámara
  const addCameraMovement = useCallback((movement: Omit<CameraMovement, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newMovement: CameraMovement = {
        ...movement,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        cameraMovements: [...prevProject.cameraMovements, newMovement]
      };
    });
  }, [updateProject]);
  
  // Actualizar un movimiento de cámara existente
  const updateCameraMovement = useCallback((movementId: string, updates: Partial<CameraMovement>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        cameraMovements: prevProject.cameraMovements.map(movement => 
          movement.id === movementId
            ? { ...movement, ...updates, updatedAt: new Date() }
            : movement
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un movimiento de cámara
  const removeCameraMovement = useCallback((movementId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        cameraMovements: prevProject.cameraMovements.filter(movement => movement.id !== movementId)
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE TRANSCRIPCIONES ===
  
  // Añadir una nueva transcripción
  const addTranscription = useCallback((transcription: Omit<Transcription, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newTranscription: Transcription = {
        ...transcription,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        transcriptions: [...prevProject.transcriptions, newTranscription]
      };
    });
  }, [updateProject]);
  
  // Actualizar una transcripción existente
  const updateTranscription = useCallback((transcriptionId: string, updates: Partial<Transcription>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        transcriptions: prevProject.transcriptions.map(transcription => 
          transcription.id === transcriptionId
            ? { ...transcription, ...updates, updatedAt: new Date() }
            : transcription
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar una transcripción
  const removeTranscription = useCallback((transcriptionId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        transcriptions: prevProject.transcriptions.filter(transcription => transcription.id !== transcriptionId)
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE BEATS ===
  
  // Añadir un nuevo beat
  const addBeat = useCallback((beat: Omit<Beat, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newBeat: Beat = {
        ...beat,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        beats: [...prevProject.beats, newBeat]
      };
    });
  }, [updateProject]);
  
  // Actualizar un beat existente
  const updateBeat = useCallback((beatId: string, updates: Partial<Beat>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        beats: prevProject.beats.map(beat => 
          beat.id === beatId
            ? { ...beat, ...updates, updatedAt: new Date() }
            : beat
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar un beat
  const removeBeat = useCallback((beatId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        beats: prevProject.beats.filter(beat => beat.id !== beatId)
      };
    });
  }, [updateProject]);
  
  // Actualizar todos los beats (por ejemplo, después de un análisis)
  const updateBeats = useCallback((beats: Beat[]) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        beats
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE SECCIONES ===
  
  // Añadir una nueva sección
  const addSection = useCallback((section: Omit<Section, 'id'>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      const newSection: Section = {
        ...section,
        id: uuidv4()
      };
      
      return {
        ...prevProject,
        sections: [...prevProject.sections, newSection]
      };
    });
  }, [updateProject]);
  
  // Actualizar una sección existente
  const updateSection = useCallback((sectionId: string, updates: Partial<Section>) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        sections: prevProject.sections.map(section => 
          section.id === sectionId
            ? { ...section, ...updates, updatedAt: new Date() }
            : section
        )
      };
    });
  }, [updateProject]);
  
  // Eliminar una sección
  const removeSection = useCallback((sectionId: string) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        sections: prevProject.sections.filter(section => section.id !== sectionId)
      };
    });
  }, [updateProject]);
  
  // Actualizar todas las secciones
  const updateSections = useCallback((sections: Section[]) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      return {
        ...prevProject,
        sections
      };
    });
  }, [updateProject]);
  
  // === ACCIONES DE TIMELINE ===
  
  // Actualizar la vista de la línea de tiempo
  const setTimelineView = useCallback((updates: Partial<TimelineViewState>) => {
    setState(prevState => ({
      ...prevState,
      timelineView: {
        ...prevState.timelineView,
        ...updates
      }
    }));
  }, []);
  
  // Acercar el zoom
  const zoomIn = useCallback(() => {
    setTimelineView(prevView => ({
      scale: prevView.scale * 1.2
    }));
  }, [setTimelineView]);
  
  // Alejar el zoom
  const zoomOut = useCallback(() => {
    setTimelineView(prevView => ({
      scale: prevView.scale / 1.2
    }));
  }, [setTimelineView]);
  
  // === ACCIONES DE ERRORES ===
  
  // Añadir un error
  const addError = useCallback((error: Omit<EditorError, 'timestamp'>) => {
    setState(prevState => ({
      ...prevState,
      errors: [
        ...prevState.errors,
        {
          ...error,
          timestamp: new Date()
        }
      ]
    }));
  }, []);
  
  // Limpiar todos los errores
  const clearErrors = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      errors: []
    }));
  }, []);
  
  // === ACCIONES PARA WORKFLOW UI ===
  
  // Establecer el paso actual del workflow
  const setCurrentStep = useCallback((step: number) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      // Si tenemos la nueva estructura de workflow, usarla
      if (prevProject.workflowData && prevProject.workflowData.steps) {
        const workflowSteps = [...prevProject.workflowData.steps];
        const stepId = workflowSteps[step]?.id || '';
        
        // Actualizar el estado de cada paso
        const updatedSteps = workflowSteps.map(s => {
          // Si es el paso actual, marcarlo como 'in-progress'
          if (s.id === stepId) {
            return { ...s, status: 'in-progress' as const };
          }
          // Mantener el estado de los demás pasos
          return s;
        });
        
        return {
          ...prevProject,
          workflowData: {
            ...prevProject.workflowData,
            steps: updatedSteps
          },
          // Mantener retrocompatibilidad con la versión antigua
          currentStep: step
        };
      }
      
      // Fallback para la estructura antigua
      return {
        ...prevProject,
        currentStep: step
      };
    });
  }, [updateProject]);
  
  // Marcar un paso como completado
  const markStepAsCompleted = useCallback((step: number) => {
    updateProject(prevProject => {
      if (!prevProject) return null;
      
      // Si tenemos la nueva estructura de workflow, usarla
      if (prevProject.workflowData && prevProject.workflowData.steps) {
        const workflowSteps = [...prevProject.workflowData.steps];
        const stepId = workflowSteps[step]?.id || '';
        
        // Actualizar el estado del paso específico
        const updatedSteps = workflowSteps.map(s => {
          if (s.id === stepId) {
            return { 
              ...s, 
              status: 'completed' as const,
              timestamp: new Date()
            };
          }
          return s;
        });
        
        return {
          ...prevProject,
          workflowData: {
            ...prevProject.workflowData,
            steps: updatedSteps
          },
          // Mantener retrocompatibilidad con la versión antigua
          completedSteps: [
            ...(prevProject.completedSteps || []),
            ...(prevProject.completedSteps?.includes(step) ? [] : [step])
          ]
        };
      }
      
      // Fallback para la estructura antigua
      const completedSteps = prevProject.completedSteps || [];
      
      if (!completedSteps.includes(step)) {
        return {
          ...prevProject,
          completedSteps: [...completedSteps, step]
        };
      }
      
      return prevProject;
    });
  }, [updateProject]);
  
  /**
   * Actualiza los datos del flujo de trabajo
   * @param data Datos del flujo de trabajo a actualizar
   */
  const updateWorkflowData = useCallback((data: Partial<WorkflowData>) => {
    // Utilizamos una función de actualización de estado para evitar problemas de referencias
    setWorkflowData(prevData => {
      // Combinar los datos anteriores con los nuevos
      const updatedData = {
        ...prevData,
        ...data
      };
      
      logger.info("WorkflowData actualizado:", updatedData);
      
      // Si hay pasos en los datos nuevos, asegurarnos de mantener el formato correcto
      if (data.steps) {
        updatedData.steps = data.steps.map(step => ({
          ...step,
          // Asegurar que timestamp sea un Date si no lo es
          timestamp: step.timestamp instanceof Date ? step.timestamp : new Date()
        }));
      }
      
      return updatedData;
    });
    
    // También actualizamos los datos en el proyecto si es necesario
    if (state.project) {
      updateProject(prevProject => {
        if (!prevProject) return null;
        
        // Creamos una copia segura del proyecto
        return {
          ...prevProject,
          // Añadimos un objeto workflowData al proyecto con la información actualizada
          workflowData: {
            ...(prevProject.workflowData || {}),
            ...data
          }
        };
      });
    }
  }, [updateProject, state.project]);
  
  // === EFECTOS ===
  
  // Auto-guardar periódicamente si hay cambios pendientes
  useEffect(() => {
    if (state.saveStatus === ProjectSaveStatus.UNSAVED) {
      const timer = setTimeout(() => {
        saveProject();
      }, 60000); // Auto-guardar después de 1 minuto sin guardar
      
      return () => clearTimeout(timer);
    }
  }, [state.saveStatus, saveProject]);
  
  // Actualizar la posición del playhead durante la reproducción
  useEffect(() => {
    if (state.playhead.isPlaying) {
      const timer = setInterval(() => {
        setState(prevState => {
          const newTime = prevState.playhead.time + (0.1 * prevState.playhead.speed);
          
          // Si llegamos al final del proyecto, detener la reproducción
          if (prevState.project && newTime >= prevState.project.duration) {
            return {
              ...prevState,
              playhead: {
                ...prevState.playhead,
                time: prevState.project.duration,
                isPlaying: false
              }
            };
          }
          
          return {
            ...prevState,
            playhead: {
              ...prevState.playhead,
              time: newTime
            }
          };
        });
      }, 100); // Actualizar cada 100ms
      
      return () => clearInterval(timer);
    }
  }, [state.playhead.isPlaying, state.playhead.speed]);
  
  // === FUNCIONES DE WORKFLOW Y REPRODUCCIÓN AVANZADAS ===

  // Control avanzado de reproducción
  const setCurrentPlaybackTime = useCallback((time: number) => {
    setState(prevState => ({
      ...prevState,
      playhead: {
        ...prevState.playhead,
        time: Math.max(0, Math.min(time, prevState.project?.duration || 60))
      }
    }));
  }, []);

  // Establecer estado de reproducción
  const setPlaybackState = useCallback((isPlaying: boolean) => {
    setState(prevState => ({
      ...prevState,
      playhead: {
        ...prevState.playhead,
        isPlaying
      }
    }));
  }, []);

  // === VALOR DEL CONTEXTO ===
  
  const contextValue: EditorContextType = {
    state,
    
    // Acciones - Proyecto
    createProject,
    loadProject,
    saveProject,
    exportProject,
    
    // Acciones - Reproducción
    play,
    pause,
    seek,
    
    // Acciones - Historial
    undo,
    redo,
    
    // Acciones - Pistas
    addTrack,
    updateTrack,
    removeTrack,
    setSelectedTrack,
    reorderTracks,
    
    // Acciones - Clips
    addClip,
    updateClip,
    removeClip,
    setSelectedClip,
    
    // Acciones - Audio Clips
    addAudioClip,
    updateAudioClip,
    removeAudioClip,
    
    // Acciones - Text Clips
    addTextClip,
    updateTextClip,
    removeTextClip,
    
    // Acciones - Efectos
    addEffect,
    updateEffect,
    removeEffect,
    setSelectedEffect,
    
    // Acciones - Movimientos de cámara
    addCameraMovement,
    updateCameraMovement,
    removeCameraMovement,
    
    // Acciones - Transcripciones
    addTranscription,
    updateTranscription,
    removeTranscription,
    
    // Acciones - Beats
    addBeat,
    updateBeat,
    removeBeat,
    updateBeats,
    
    // Acciones - Secciones
    addSection,
    updateSection,
    removeSection,
    updateSections,
    
    // Acciones - Timeline
    setTimelineView,
    zoomIn,
    zoomOut,
    
    // Acciones - Errores
    addError,
    clearErrors,
    
    // Acciones para Workflow UI
    setCurrentStep,
    markStepAsCompleted,
    updateWorkflowData,
    workflowData,
    
    // Control de reproducción avanzado
    setCurrentPlaybackTime,
    setPlaybackState
  };
  
  return (
    <EditorContext.Provider value={contextValue}>
      {children}
    </EditorContext.Provider>
  );
}

// Hook personalizado para usar el contexto
export function useEditor() {
  const context = useContext(EditorContext);
  
  if (!context) {
    throw new Error('useEditor debe ser usado dentro de un EditorProvider');
  }
  
  return context;
}