/**
 * Visual Style Templates
 * Templates predefinidos de estilos visuales para videos musicales
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';

export interface VisualStyleTemplate {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  settings: StyleSettings;
  examples: string[];
}

export interface StyleSettings {
  transitions: TransitionStyle[];
  colorGrading: ColorGradingPreset;
  pacing: 'slow' | 'medium' | 'fast' | 'dynamic';
  effects: VisualEffect[];
  clipDuration: {
    min: number;
    max: number;
  };
}

export interface TransitionStyle {
  type: 'fade' | 'dissolve' | 'wipe' | 'zoom' | 'slide' | 'whip-pan' | 'glitch';
  duration: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export interface ColorGradingPreset {
  name: string;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 (cool) to 100 (warm)
  tint: number; // -100 (green) to 100 (magenta)
  vignette: number; // 0 to 100
}

export interface VisualEffect {
  type: 'grain' | 'glow' | 'blur' | 'chromatic-aberration' | 'lens-flare' | 'motion-blur';
  intensity: number; // 0 to 100
}

/**
 * Templates predefinidos
 */
export const VISUAL_TEMPLATES: VisualStyleTemplate[] = [
  {
    id: 'cinematic',
    name: 'Cinematográfico',
    description: 'Estética de película con iluminación profesional y transiciones suaves',
    thumbnail: '🎬',
    examples: ['Blockbuster', 'Drama', 'Épico'],
    settings: {
      transitions: [
        { type: 'fade', duration: 1.0, easing: 'ease-in-out' },
        { type: 'dissolve', duration: 1.5, easing: 'ease-in-out' }
      ],
      colorGrading: {
        name: 'Warm Cinematic',
        brightness: -5,
        contrast: 15,
        saturation: -10,
        temperature: 15,
        tint: -5,
        vignette: 30
      },
      pacing: 'slow',
      effects: [
        { type: 'grain', intensity: 15 },
        { type: 'lens-flare', intensity: 25 }
      ],
      clipDuration: { min: 4, max: 8 }
    }
  },
  {
    id: 'energetic',
    name: 'Energético',
    description: 'Cortes rápidos, colores vibrantes y alta energía',
    thumbnail: '⚡',
    examples: ['EDM', 'Hip-Hop', 'Pop'],
    settings: {
      transitions: [
        { type: 'whip-pan', duration: 0.3, easing: 'ease-out' },
        { type: 'zoom', duration: 0.5, easing: 'ease-in-out' },
        { type: 'glitch', duration: 0.2, easing: 'linear' }
      ],
      colorGrading: {
        name: 'Vibrant',
        brightness: 10,
        contrast: 25,
        saturation: 40,
        temperature: 5,
        tint: 0,
        vignette: 0
      },
      pacing: 'fast',
      effects: [
        { type: 'glow', intensity: 40 },
        { type: 'chromatic-aberration', intensity: 20 }
      ],
      clipDuration: { min: 1, max: 3 }
    }
  },
  {
    id: 'dreamy',
    name: 'Soñador',
    description: 'Suave, etéreo y romántico con transiciones fluidas',
    thumbnail: '✨',
    examples: ['Indie', 'R&B', 'Soul'],
    settings: {
      transitions: [
        { type: 'dissolve', duration: 2.0, easing: 'ease-in-out' },
        { type: 'fade', duration: 1.5, easing: 'ease-in-out' }
      ],
      colorGrading: {
        name: 'Dreamy Pastel',
        brightness: 15,
        contrast: -10,
        saturation: -20,
        temperature: 10,
        tint: 10,
        vignette: 40
      },
      pacing: 'slow',
      effects: [
        { type: 'glow', intensity: 60 },
        { type: 'blur', intensity: 15 }
      ],
      clipDuration: { min: 5, max: 10 }
    }
  },
  {
    id: 'retro',
    name: 'Retro',
    description: 'Estética vintage de los 80s con grano y colores nostálgicos',
    thumbnail: '📼',
    examples: ['Synthwave', 'Vaporwave', 'Disco'],
    settings: {
      transitions: [
        { type: 'wipe', duration: 0.8, easing: 'linear' },
        { type: 'slide', duration: 0.6, easing: 'ease-in-out' }
      ],
      colorGrading: {
        name: 'VHS',
        brightness: -10,
        contrast: 20,
        saturation: 30,
        temperature: -15,
        tint: 15,
        vignette: 50
      },
      pacing: 'medium',
      effects: [
        { type: 'grain', intensity: 50 },
        { type: 'chromatic-aberration', intensity: 30 }
      ],
      clipDuration: { min: 3, max: 6 }
    }
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Limpio, simple y enfocado en lo esencial',
    thumbnail: '⚪',
    examples: ['Ambient', 'Classical', 'Jazz'],
    settings: {
      transitions: [
        { type: 'fade', duration: 1.0, easing: 'linear' }
      ],
      colorGrading: {
        name: 'Clean',
        brightness: 5,
        contrast: 10,
        saturation: -30,
        temperature: 0,
        tint: 0,
        vignette: 0
      },
      pacing: 'slow',
      effects: [],
      clipDuration: { min: 6, max: 12 }
    }
  },
  {
    id: 'urban',
    name: 'Urbano',
    description: 'Estilo callejero con alto contraste y sombras dramáticas',
    thumbnail: '🏙️',
    examples: ['Trap', 'Rap', 'Grime'],
    settings: {
      transitions: [
        { type: 'glitch', duration: 0.3, easing: 'linear' },
        { type: 'whip-pan', duration: 0.4, easing: 'ease-out' }
      ],
      colorGrading: {
        name: 'Urban Grit',
        brightness: -15,
        contrast: 40,
        saturation: 10,
        temperature: -10,
        tint: -10,
        vignette: 35
      },
      pacing: 'fast',
      effects: [
        { type: 'grain', intensity: 30 },
        { type: 'chromatic-aberration', intensity: 15 }
      ],
      clipDuration: { min: 2, max: 4 }
    }
  },
  {
    id: 'psychedelic',
    name: 'Psicodélico',
    description: 'Colores intensos, efectos trippy y transiciones creativas',
    thumbnail: '🌀',
    examples: ['Psychedelic Rock', 'Trance', 'Experimental'],
    settings: {
      transitions: [
        { type: 'zoom', duration: 1.0, easing: 'ease-in-out' },
        { type: 'dissolve', duration: 1.5, easing: 'ease-in-out' },
        { type: 'glitch', duration: 0.5, easing: 'linear' }
      ],
      colorGrading: {
        name: 'Psychedelic',
        brightness: 20,
        contrast: 30,
        saturation: 80,
        temperature: 0,
        tint: 0,
        vignette: 20
      },
      pacing: 'dynamic',
      effects: [
        { type: 'chromatic-aberration', intensity: 50 },
        { type: 'glow', intensity: 70 }
      ],
      clipDuration: { min: 2, max: 6 }
    }
  }
];

/**
 * Aplicar template a clips del timeline
 */
export function applyTemplateToClips(
  clips: TimelineClip[],
  template: VisualStyleTemplate,
  duration: number
): TimelineClip[] {
  const settings = template.settings;
  const visualClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  const audioClips = clips.filter(c => c.type === 'audio');

  // Ajustar duraciones según el pacing
  let adjustedClips = adjustClipDurations(visualClips, settings, duration);

  // Agregar metadatos de estilo
  adjustedClips = adjustedClips.map((clip, index) => ({
    ...clip,
    metadata: {
      ...clip.metadata,
      template: template.id,
      transition: getTransitionForIndex(index, settings.transitions),
      colorGrading: settings.colorGrading,
      effects: settings.effects
    }
  }));

  return [...adjustedClips, ...audioClips];
}

/**
 * Ajustar duraciones de clips según pacing
 */
function adjustClipDurations(
  clips: TimelineClip[],
  settings: StyleSettings,
  totalDuration: number
): TimelineClip[] {
  const { min, max } = settings.clipDuration;
  const targetDuration = (min + max) / 2;

  // Calcular cuántos clips necesitamos
  const targetClipCount = Math.floor(totalDuration / targetDuration);

  // Si tenemos menos clips, extenderlos
  if (clips.length < targetClipCount) {
    return extendClips(clips, targetClipCount, totalDuration);
  }

  // Si tenemos más clips, ajustar duraciones
  return clips.map((clip, index) => {
    const start = (index / clips.length) * totalDuration;
    const duration = Math.min(max, Math.max(min, totalDuration / clips.length));

    return {
      ...clip,
      start,
      duration
    };
  });
}

/**
 * Extender clips para llenar la duración
 */
function extendClips(
  clips: TimelineClip[],
  targetCount: number,
  totalDuration: number
): TimelineClip[] {
  const extended: TimelineClip[] = [];
  let currentTime = 0;

  for (let i = 0; i < targetCount; i++) {
    const originalClip = clips[i % clips.length];
    const duration = totalDuration / targetCount;

    extended.push({
      ...originalClip,
      id: `${originalClip.id}-${i}`,
      start: currentTime,
      duration
    });

    currentTime += duration;
  }

  return extended;
}

/**
 * Obtener transición para un índice específico
 */
function getTransitionForIndex(
  index: number,
  transitions: TransitionStyle[]
): TransitionStyle {
  return transitions[index % transitions.length];
}

/**
 * Obtener template por ID
 */
export function getTemplateById(id: string): VisualStyleTemplate | undefined {
  return VISUAL_TEMPLATES.find(t => t.id === id);
}

/**
 * Recomendar template basado en el género musical
 */
export function recommendTemplate(genre?: string): VisualStyleTemplate {
  const genreLower = genre?.toLowerCase() || '';

  if (genreLower.includes('edm') || genreLower.includes('electronic')) {
    return VISUAL_TEMPLATES.find(t => t.id === 'energetic')!;
  }
  if (genreLower.includes('hip') || genreLower.includes('trap')) {
    return VISUAL_TEMPLATES.find(t => t.id === 'urban')!;
  }
  if (genreLower.includes('indie') || genreLower.includes('soul')) {
    return VISUAL_TEMPLATES.find(t => t.id === 'dreamy')!;
  }
  if (genreLower.includes('retro') || genreLower.includes('80')) {
    return VISUAL_TEMPLATES.find(t => t.id === 'retro')!;
  }

  // Default
  return VISUAL_TEMPLATES.find(t => t.id === 'cinematic')!;
}

export default {
  VISUAL_TEMPLATES,
  applyTemplateToClips,
  getTemplateById,
  recommendTemplate
};
