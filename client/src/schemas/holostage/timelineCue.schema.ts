// ─── Timeline Cue Schema ──────────────────────────────────────────────────────

export type CueType = 'animation' | 'dmx' | 'camera' | 'effect' | 'transition' | 'blackout' | 'fallback';

export interface AnimationCueData {
  animationName: string;
  looping: boolean;
  blendDuration: number; // ms
  speed: number;
}

export interface DMXCueData {
  sceneId: string;
  fadeIn: number;  // ms
  fadeOut: number; // ms
}

export interface CameraCueData {
  angle: 'front' | 'side' | 'top' | 'custom';
  fov: number;
  tilt: number;
  pan: number;
  zoom: number;
}

export interface EffectCueData {
  type: 'scanlines' | 'glitch' | 'vignette' | 'hologram_flicker' | 'color_shift';
  intensity: number;   // 0-1
  duration: number;    // ms
}

export interface TransitionCueData {
  type: 'fade' | 'wipe' | 'dissolve' | 'slide';
  duration: number;    // ms
  toSongId?: string;
}

export interface TimelineCue {
  id: string;
  songId: string;
  timestamp: number;   // seconds from song start
  type: CueType;
  name: string;
  data: AnimationCueData | DMXCueData | CameraCueData | EffectCueData | TransitionCueData | Record<string, unknown>;
  enabled: boolean;
  color: string;       // hex color for display
  locked: boolean;
}

export const CUE_TYPE_COLORS: Record<CueType, string> = {
  animation: '#f97316',  // orange
  dmx: '#a855f7',        // purple
  camera: '#3b82f6',     // blue
  effect: '#10b981',     // green
  transition: '#f59e0b', // amber
  blackout: '#1a1a1a',   // near-black
  fallback: '#ef4444',   // red
};

export const CUE_TYPE_LABELS: Record<CueType, string> = {
  animation: 'Animación',
  dmx: 'DMX / Luces',
  camera: 'Cámara',
  effect: 'Efecto Visual',
  transition: 'Transición',
  blackout: 'Blackout',
  fallback: 'Fallback',
};
