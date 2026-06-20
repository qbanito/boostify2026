/**
 * Definiciones de tipos para el editor de línea de tiempo de música/video
 */

/**
 * Tipos de capas disponibles en el editor
 */
export enum LayerType {
  AUDIO = 'audio',     // Capa 0: Audio (aislada y bloqueada por defecto)
  IMAGE = 'image',     // Capa 1: Imágenes (soporta marcadores IA de 5 segundos)
  TEXT = 'text',       // Capa 2: Texto (capa de edición estándar)
  EFFECTS = 'effects', // Capa 3: Efectos (capa avanzada para efectos especiales)
  VIDEO = 'video'      // Tipo adicional para soporte de video
}

/**
 * Estado de un clip en la línea de tiempo
 */
export interface TimelineClip {
  id: string;           // Identificador único del clip
  type: LayerType;      // Tipo de clip (audio, imagen, texto, efectos, video)
  layer: number;        // Número de capa (0=audio, 1=imagen, 2=texto, 3=efectos)
  startTime: number;    // Tiempo de inicio en la línea de tiempo (segundos)
  endTime: number;      // Tiempo de fin en la línea de tiempo (segundos)
  url?: string;         // URL del recurso (audio, imagen o video)
  name?: string;        // Nombre descriptivo del clip
  text?: string;        // Texto para clips de tipo texto
  isIsolated?: boolean; // Indica si el clip está aislado y no puede mezclarse
  maxDuration?: number; // Duración máxima en segundos (5s para clips IA)
  
  // Propiedades de edición avanzada
  sourceStart?: number; // Tiempo de inicio dentro del clip fuente (para recortar)
  in?: number;          // Punto de entrada (alias de sourceStart para compatibilidad)
  out?: number;         // Punto de salida del clip fuente
  duration?: number;    // Duración total del clip (calculada como endTime - startTime)
  
  // Metadatos adicionales dependiendo del tipo
  metadata?: {
    // Para clips de audio
    audioMetadata?: {
      volume?: number;       // Volumen (0-1)
      muted?: boolean;       // Si está silenciado
      fadeIn?: number;       // Fade in en segundos
      fadeOut?: number;      // Fade out en segundos
      loop?: boolean;        // Si debe repetirse
      bpm?: number;          // Beats por minuto
      timeSignature?: string; // Compás (4/4, 3/4, etc.)
      key?: string;          // Tonalidad musical
      isAIGenerated?: boolean; // Si fue generado por IA
    };
    
    // Para clips de imagen
    imageMetadata?: {
      opacity?: number;      // Opacidad (0-1)
      scale?: number;        // Escala (1 = 100%)
      position?: {x: number, y: number}; // Posición relativa
      rotation?: number;     // Rotación en grados
      effects?: string[];    // Efectos aplicados
      isAIGenerated?: boolean; // Si fue generado por IA
    };
    
    // Para clips de texto
    textMetadata?: {
      fontSize?: number;     // Tamaño de fuente
      fontFamily?: string;   // Familia de fuente
      color?: string;        // Color (hex, rgba)
      alignment?: 'left' | 'center' | 'right'; // Alineación
      effects?: string[];    // Efectos de texto
      animation?: string;    // Tipo de animación
    };
    
    // Para clips de efectos
    effectMetadata?: {
      intensity?: number;    // Intensidad del efecto (0-1) 
      parameters?: Record<string, any>; // Parámetros específicos del efecto
      preset?: string;       // Preset predefinido de efectos
    };
    
    // Para sincronización con ritmo
    beatSync?: {
      enabled: boolean;      // Si está sincronizado con el ritmo
      pattern?: string;      // Patrón de sincronización
      intensity?: number;    // Intensidad de sincronización (0-1)
      offset?: number;       // Desplazamiento en segundos
    };
  };
}

/**
 * Configuración de una capa completa
 */
export interface TimelineLayer {
  id: number;           // ID único de la capa
  type: LayerType;      // Tipo de capa
  name: string;         // Nombre descriptivo de la capa
  visible: boolean;     // Si es visible
  locked: boolean;      // Si está bloqueada para edición
  clips: TimelineClip[]; // Clips en esta capa
  height?: number;      // Altura personalizada de la capa
  isIsolated?: boolean; // Si la capa está aislada (ej: capa de audio)
  colorCode?: string;   // Código de color para identificación visual
}

/**
 * Estado completo del editor de línea de tiempo
 */
export interface TimelineState {
  layers: TimelineLayer[];   // Capas disponibles
  currentTime: number;       // Posición actual del playhead (segundos)
  duration: number;          // Duración total de la línea de tiempo (segundos)
  selectedClipIds: string[]; // IDs de clips seleccionados
  zoomLevel: number;         // Nivel de zoom (1 = 100%)
  isPlaying: boolean;        // Si está reproduciendo
  markers: TimelineMarker[]; // Marcadores en la línea de tiempo
  history: TimelineHistory;  // Historial para deshacer/rehacer
}

/**
 * Marcador en la línea de tiempo
 */
export interface TimelineMarker {
  id: string;           // ID único del marcador
  time: number;         // Posición en segundos
  label: string;        // Etiqueta descriptiva
  color?: string;       // Color del marcador
  type?: 'beat' | 'section' | 'custom'; // Tipo de marcador
}

/**
 * Historial para deshacer/rehacer acciones
 */
export interface TimelineHistory {
  past: TimelineState[];     // Estados anteriores
  future: TimelineState[];   // Estados para rehacer
  currentIndex: number;      // Índice actual en el historial
}