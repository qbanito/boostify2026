/**
 * Sistema de tipos para el editor profesional de videos
 * 
 * Este archivo contiene todas las definiciones de tipos necesarias para
 * el editor profesional, incluyendo proyectos, pistas, clips, efectos,
 * y otras entidades del editor.
 */

// Estado de guardado del proyecto
export enum ProjectSaveStatus {
  SAVED = 'saved',
  SAVING = 'saving',
  UNSAVED = 'unsaved',
  ERROR = 'error'
}

// Modo de persistencia
export type PersistenceMode = 'LOCAL' | 'CLOUD' | 'HYBRID';

// Tipo de etiqueta para categorizar elementos
export type EditorTag = 
  | 'video' 
  | 'audio' 
  | 'text' 
  | 'overlay' 
  | 'effect' 
  | 'transition'
  | 'music'
  | 'voiceover'
  | 'ambient'
  | 'sfx'
  | 'title'
  | 'subtitle'
  | 'caption'
  | 'graphic';

// Tipo de pista
export type TrackType = 
  | 'video'
  | 'audio'
  | 'text'
  | 'overlay'
  | 'image-sequence';  // Secuencia de imágenes (tipo especializado para videos musicales)

// Tipos de plano para clips de video e imagen
export type ShotType = 
  | 'close-up'      // Primer plano
  | 'medium'        // Plano medio  
  | 'wide'          // Plano general
  | 'transition'    // Transición visual
  | 'normal';       // Plano normal (por defecto)

// Tipos de transición entre clips
export type TransitionType = 
  | 'cut'           // Corte directo
  | 'crossfade'     // Fundido cruzado
  | 'fade'          // Fundido a negro/blanco
  | 'wipe'          // Barrido 
  | 'slide'         // Deslizamiento
  | 'zoom'          // Zoom in/out
  | 'dissolve'      // Disolución
  | 'custom';       // Transición personalizada

// Patrones de movimiento de cámara
export type CameraMovementPattern = 
  | 'static'        // Sin movimiento
  | 'pan-left'      // Paneo hacia la izquierda
  | 'pan-right'     // Paneo hacia la derecha
  | 'tilt-up'       // Inclinación hacia arriba
  | 'tilt-down'     // Inclinación hacia abajo
  | 'zoom-in'       // Acercamiento
  | 'zoom-out'      // Alejamiento
  | 'dolly'         // Movimiento hacia adelante/atrás
  | 'track'         // Seguimiento lateral
  | 'custom';       // Movimiento personalizado

// Definición de un proyecto
export interface Project {
  id: string;
  name: string;
  duration: number; // En segundos
  resolution: {
    width: number;
    height: number;
  };
  frameRate: number;
  audioSampleRate: number;
  language: 'es' | 'en';
  
  // Flujo de trabajo
  currentStep?: number;
  completedSteps: number[];
  
  // Datos del flujo de trabajo para videos musicales (opcional)
  workflowData?: {
    steps?: {
      id: string;
      status: 'pending' | 'in-progress' | 'completed' | 'skipped';
      timestamp?: Date;
    }[];
    activeTimeline?: boolean;
    timelineProgress?: number;
  };
  
  // Colecciones
  tracks: Track[];
  clips: Clip[];
  audioClips: AudioClip[];
  textClips: TextClip[];
  effects: VisualEffect[];
  cameraMovements: CameraMovement[];
  transcriptions: Transcription[];
  beats: Beat[];
  sections: Section[];
  timelineClips?: TimelineClip[];
  
  // Opciones de exportación
  exportOptions: ExportOptions;
  
  // Metadata
  createdAt: Date;
  updatedAt: Date;
  version: string;
}

// Opciones de exportación
export interface ExportOptions {
  startTime: number;
  endTime: number;
  format: 'mp4' | 'webm' | 'gif';
  quality: 'low' | 'medium' | 'high';
  resolution: '720p' | '1080p' | '4k';
  frameRate: number;
  includeAudio: boolean;
  includeSubtitles: boolean;
  watermark: boolean;
  effects: boolean;
  metadata: Record<string, any>;
}

// Definición de una pista (track)
export interface Track {
  id: string;
  name: string;
  type: TrackType;
  position: number;
  visible: boolean;
  locked: boolean;
  muted: boolean;
  solo: boolean;
  volume?: number; // 0-100, solo para pistas de audio y video
  color: string; // Color para identificar visualmente la pista
  createdAt: Date;
  updatedAt?: Date;
}

// Definición base para un clip
export interface Clip {
  id: string;
  trackId: string;
  name: string;
  source: string; // URL o ruta al recurso original
  startTime: number; // Tiempo de inicio en la línea de tiempo (segundos)
  duration: number; // Duración en segundos
  trimStart: number; // Punto de inicio en el clip original (segundos)
  trimEnd: number; // Punto final en el clip original (segundos)
  tags?: EditorTag[];
  createdAt: Date;
  updatedAt?: Date;
}

// Clip de audio específico
export interface AudioClip extends Omit<Clip, 'source'> {
  source: string; // URL o ruta al archivo de audio
  volume: number; // 0-100
  fadeIn: number; // Duración del fade in en segundos
  fadeOut: number; // Duración del fade out en segundos
  looped: boolean; // Si el audio debe repetirse
  pitch?: number; // Ajuste de tono
  tempo?: number; // Ajuste de velocidad
  waveform?: number[]; // Datos de la forma de onda para visualización
}

// Clip de texto específico
export interface TextClip extends Omit<Clip, 'source'> {
  text: string; // Contenido del texto
  font: string; // Tipo de letra
  size: number; // Tamaño del texto
  color: string; // Color del texto (hex)
  backgroundColor?: string; // Color de fondo (hex)
  position: {
    x: number; // 0-100 (porcentaje del ancho)
    y: number; // 0-100 (porcentaje del alto)
    anchor: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  };
  animation?: {
    type: 'fade' | 'slide' | 'zoom' | 'none';
    duration: number; // Duración de la animación en segundos
    delay: number; // Retraso antes de comenzar la animación
  };
  style?: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    uppercase: boolean;
    spacing: number; // Espaciado entre letras
    lineHeight: number; // Altura de línea
  };
}

// Tipo de efecto visual
export type EffectType = 
  | 'filter' 
  | 'transition' 
  | 'overlay' 
  | 'blur'
  | 'crop'
  | 'custom';

// Efecto visual
export interface VisualEffect {
  id: string;
  trackId: string;
  name: string;
  type: EffectType;
  startTime: number; // Tiempo de inicio en segundos
  endTime: number; // Tiempo de finalización en segundos
  duration: number; // Duración en segundos (endTime - startTime)
  intensity?: number; // Intensidad del efecto (0-100)
  parameters: Record<string, any>; // Parámetros específicos del efecto
  createdAt: Date;
  updatedAt?: Date;
}

// Tipo de movimiento de cámara
export type CameraMovementType = 
  | 'pan' 
  | 'tilt' 
  | 'zoom' 
  | 'dolly';

// Movimiento de cámara
export interface CameraMovement {
  id: string;
  trackId: string; // Track al que está asociado
  type: CameraMovementType;
  startTime: number; // Tiempo de inicio en segundos
  endTime: number; // Tiempo de finalización en segundos
  duration: number; // Duración en segundos
  parameters?: Record<string, number>; // Parámetros específicos del movimiento
  createdAt: Date;
  updatedAt?: Date;
}

// Tipo de transcripción
export type TranscriptionType = 
  | 'dialogue' 
  | 'lyrics';

// Transcripción (diálogos, letras, etc.)
export interface Transcription {
  id: string;
  text: string; // Texto de la transcripción
  type: TranscriptionType;
  startTime: number; // Tiempo de inicio en segundos
  endTime: number; // Tiempo de finalización en segundos
  duration: number; // Duración en segundos
  speakerId?: string; // ID del hablante (si aplica)
  createdAt: Date;
  updatedAt?: Date;
}

// Información de ritmo (beat)
export interface Beat {
  id: string;
  time: number; // Tiempo en segundos
  strength: number; // Intensidad del beat (0-1)
  type: 'downbeat' | 'upbeat';
  createdAt: Date;
  updatedAt?: Date;
}

// Tipo de sección
export type SectionType = 
  | 'intro' 
  | 'verse' 
  | 'chorus' 
  | 'bridge' 
  | 'outro' 
  | 'breakdown'
  | 'custom';

// Sección (parte de la canción o video)
export interface Section {
  id: string;
  name: string;
  type: SectionType;
  startTime: number; // Tiempo de inicio en segundos
  endTime: number; // Tiempo de finalización en segundos
  duration: number; // Duración en segundos
  color: string; // Color para visualizar la sección
  createdAt: Date;
  updatedAt?: Date;
}

// Posición del cursor de reproducción (playhead)
export interface PlayheadPosition {
  time: number; // Tiempo actual en segundos
  isPlaying: boolean;
  speed: number; // Velocidad de reproducción (1 = normal)
}

// Estado de visualización de la línea de tiempo
export interface TimelineViewState {
  scale: number; // Factor de escala (zoom)
  offset: number; // Desplazamiento horizontal
  visibleStartTime: number; // Tiempo de inicio visible
  visibleEndTime: number; // Tiempo final visible
}

// Configuración de módulos para personalización del editor
export interface ModuleConfig {
  id: string;          // Identificador único del módulo
  name: string;        // Nombre para mostrar
  type: 'panel' | 'tool' | 'widget'; // Tipo de módulo
  enabled: boolean;    // Si está habilitado en la configuración
  visible: boolean;    // Si está visible actualmente 
  position: number;    // Orden en la interfaz
  defaultSize?: number; // Tamaño predeterminado (para paneles)
  minSize?: number;    // Tamaño mínimo (para paneles)
  maxSize?: number;    // Tamaño máximo (para paneles)
  icon?: string;       // Nombre del icono (para herramientas)
}

// Especificación de error
export interface EditorError {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

// Historia de acciones (para undo/redo)
export interface ActionHistory {
  id: string;
  action: string; // Tipo de acción
  payload: any; // Datos asociados a la acción
  timestamp: Date;
}

// Configuración del editor
export interface EditorConfig {
  language: 'es' | 'en';
  theme: 'light' | 'dark' | 'system';
  shortcuts: Record<string, string>;
  autoSave: boolean;
  autoSaveInterval: number; // En segundos
  audioWaveforms: boolean;
  thumbnailsQuality: 'low' | 'medium' | 'high';
  renderPreview: boolean;
  defaultTrackHeight: number;
  showTimecodes: boolean;
}

// Configuración de exportación avanzada
export interface AdvancedExportSettings extends ExportOptions {
  codec: string;
  bitrate: number;
  audioCodec: string;
  audioBitrate: number;
  customCommand?: string;
}

// Estado del proceso de exportación
export interface ExportProgress {
  status: 'idle' | 'preparing' | 'processing' | 'finalizing' | 'completed' | 'error';
  progress: number; // 0-100
  currentFrame: number;
  totalFrames: number;
  timeRemaining?: number; // En segundos
  error?: string;
  outputUrl?: string;
}

// Tipo para las miniaturas de la línea de tiempo
export interface ThumbnailData {
  time: number;
  url: string;
  width: number;
  height: number;
}

// Clip específico para la línea de tiempo (simplificado para la interfaz visual)
export interface TimelineClip {
  id: string;
  trackId: string;
  name: string;
  type: 'video' | 'image' | 'audio' | 'text' | 'transition';
  startTime: number;
  duration: number;
  color?: string;
  thumbnailUrl?: string;
  selected?: boolean;
  mediaUrl?: string; // URL del medio asociado al clip
}

// Metadatos del clip para información adicional
export interface ClipMetadata {
  fileName: string;
  filePath: string;
  fileSize: number;
  dateCreated: Date;
  dateModified: Date;
  duration: number;
  resolution?: {
    width: number;
    height: number;
  };
  bitrate?: number;
  frameRate?: number;
  codec?: string;
  audioCodec?: string;
  audioBitrate?: number;
  audioChannels?: number;
  audioSampleRate?: number;
  tags?: Record<string, string>;
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  camera?: {
    make: string;
    model: string;
    settings?: string;
  };
}