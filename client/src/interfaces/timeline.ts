/**
 * Interfaces para el editor de timeline
 * 
 * Este archivo define las interfaces principales utilizadas por el editor de 
 * línea de tiempo para vídeos musicales.
 */

/**
 * Tipos de capas disponibles en el timeline
 */
export enum LayerType {
  VIDEO_PRINCIPAL = 'VIDEO_PRINCIPAL',   // Capa principal de video
  VIDEO_SECUNDARIO = 'VIDEO_SECUNDARIO', // Videos secundarios o B-roll
  IMAGEN = 'IMAGEN',                     // Imágenes estáticas
  TEXTO = 'TEXTO',                       // Textos y títulos
  AUDIO = 'AUDIO',                       // Pistas de audio
  EFECTOS = 'EFECTOS',                   // Efectos visuales
  IA_GENERADA = 'IA_GENERADA',           // Imágenes generadas por IA (capa 7)
  TRANSICIONES = 'TRANSICIONES'          // Transiciones entre clips
}

/**
 * Tipos de clips que pueden agregarse al timeline
 */
export enum ClipType {
  VIDEO = 'VIDEO',                     // Clips de vídeo
  IMAGE = 'IMAGE',                     // Imágenes
  AUDIO = 'AUDIO',                     // Audio
  TEXT = 'TEXT',                       // Texto
  EFFECT = 'EFFECT',                   // Efecto
  GENERATED_IMAGE = 'GENERATED_IMAGE', // Imagen generada por IA
  TRANSITION = 'TRANSITION',           // Transición
  PLACEHOLDER = 'PLACEHOLDER'          // Marcador de posición
}

/**
 * Configuración de una capa en el timeline
 */
export interface LayerConfig {
  id: number;              // ID único de la capa
  name: string;            // Nombre de la capa
  type: LayerType;         // Tipo de capa
  color: string;           // Color de la capa en la UI
  visible: boolean;        // Si la capa es visible
  locked: boolean;         // Si la capa está bloqueada
  height?: number;         // Altura opcional de la capa (píxeles)
  collapsible?: boolean;   // Si la capa puede colapsarse
  collapsed?: boolean;     // Si la capa está colapsada
}

/**
 * Clip de timeline (elemento colocable en una capa)
 */
export interface TimelineClip {
  id: number;               // ID único del clip
  layerId: number;          // ID de la capa donde está el clip
  type: ClipType;           // Tipo de clip
  start: number;            // Tiempo de inicio (segundos)
  duration: number;         // Duración (segundos)
  url?: string;             // URL del recurso (vídeo, audio, imagen)
  // Alias de URL para compatibilidad con diferentes fuentes de datos
  image_url?: string;       // Alias: usado en MusicVideoScene
  imageUrl?: string;        // Alias: usado en respuestas del servidor
  generatedImageUrl?: string; // Alias: URL de imagen generada
  publicUrl?: string;       // Alias: URL pública de Firebase
  firebaseUrl?: string;     // Alias: URL de Firebase Storage
  text?: string;            // Texto (para clips de tipo TEXT)
  color?: string;           // Color personalizado
  title?: string;           // Título descriptivo del clip
  effects?: ClipEffect[];   // Efectos aplicados al clip
  metadata?: any;           // Metadatos adicionales
  thumbnailUrl?: string;    // URL de la miniatura
  transition?: {            // Configuración de transición
    type: string;           // Tipo de transición
    duration: number;       // Duración de la transición
  };
  volume?: number;          // Volumen para clips de audio o vídeo (0.0 - 1.0)
  opacity?: number;         // Opacidad (0.0 - 1.0)
  scale?: number;           // Escala (1.0 = 100%)
  position?: {              // Posición dentro del frame
    x: number;              // Posición X (0-1)
    y: number;              // Posición Y (0-1)
  };
  locked?: boolean;         // Si el clip está bloqueado
  generated?: boolean;      // Si fue generado automáticamente
  generatedImage?: boolean; // Si es una imagen generada por IA
  generationStatus?: 'pending' | 'generating' | 'done' | 'error'; // Estado de generación progresiva
  videoUrl?: string;        // URL del video generado desde imagen (Grok Imagine)
  
  // Propiedades de edición/recorte de video
  sourceStart?: number;     // Punto de inicio dentro del clip fuente (para recortar)
  in?: number;              // Punto de entrada (alias de sourceStart, segundos)
  out?: number;             // Punto de salida del clip fuente (segundos)
  
  // Propiedades de generación progresiva (propagadas desde TimelineItem)
  shotCategory?: 'PERFORMANCE' | 'B-ROLL' | 'STORY'; // Categoría de plano
  lyricsSegment?: string;   // Letra correspondiente a esta escena
  shotType?: string;        // Tipo de plano
}

/**
 * Efecto aplicable a un clip
 */
export interface ClipEffect {
  id: string;               // ID único del efecto
  type: string;             // Tipo de efecto
  params: any;              // Parámetros del efecto
  start: number;            // Tiempo de inicio relativo al clip (0.0 - 1.0)
  end: number;              // Tiempo de fin relativo al clip (0.0 - 1.0)
  intensity: number;        // Intensidad del efecto (0.0 - 1.0)
}

/**
 * Proyecto de timeline
 */
export interface TimelineProject {
  id: string;                // ID único del proyecto
  name: string;              // Nombre del proyecto
  duration: number;          // Duración total (segundos)
  layers: LayerConfig[];     // Capas del proyecto
  clips: TimelineClip[];     // Clips en el timeline
  resolution: {              // Resolución del proyecto
    width: number;           // Ancho en píxeles
    height: number;          // Alto en píxeles
  };
  frameRate: number;         // Tasa de frames por segundo
  audioTracks: AudioTrack[]; // Pistas de audio
  metadata: any;             // Metadatos adicionales
  createdAt: Date;           // Fecha de creación
  updatedAt: Date;           // Fecha de última modificación
}

/**
 * Pista de audio en el proyecto
 */
export interface AudioTrack {
  id: string;                // ID único de la pista
  name: string;              // Nombre de la pista
  url: string;               // URL del archivo de audio
  volume: number;            // Volumen (0.0 - 1.0)
  muted: boolean;            // Si está silenciada
  start: number;             // Tiempo de inicio (segundos)
  duration: number;          // Duración (segundos)
}

/**
 * Helper function to extract image URL from any clip/scene object
 * Handles inconsistent field naming across different parts of the system
 */
export function getImageUrl(item: any): string | undefined {
  if (!item) return undefined;
  
  // Check all possible field names in order of preference
  return item.url 
    || item.generatedImage 
    || item.image_url 
    || item.imageUrl 
    || item.publicUrl 
    || item.firebaseUrl 
    || item.generatedImageUrl
    || item.thumbnailUrl
    || undefined;
}

/**
 * Normalizes a clip object to ensure url field is populated
 * from any of the possible image URL fields
 */
export function normalizeClipUrl(clip: any): any {
  if (!clip) return clip;
  
  const imageUrl = getImageUrl(clip);
  if (imageUrl && !clip.url) {
    return { ...clip, url: imageUrl };
  }
  return clip;
}

/**
 * Marcador en la línea de tiempo
 */
export interface TimelineMarker {
  id: string;                // ID único del marcador
  time: number;              // Tiempo en segundos
  label: string;             // Etiqueta del marcador
  color: string;             // Color del marcador
  type: string;              // Tipo de marcador
}