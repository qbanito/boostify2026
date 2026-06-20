/**
 * Transition Service
 * Sistema de transiciones entre clips (con opción de activar/desactivar)
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';

export type TransitionType = 
  | 'none'
  | 'fade'
  | 'dissolve'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'whip-pan'
  | 'glitch'
  | 'cross-dissolve';

export type TransitionEasing = 
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out';

export interface Transition {
  id: string;
  type: TransitionType;
  duration: number; // seconds
  easing: TransitionEasing;
  enabled: boolean;
}

export interface ClipWithTransition extends TimelineClip {
  transition?: Transition;
}

/**
 * Transiciones predefinidas
 */
export const TRANSITION_PRESETS: Record<TransitionType, { 
  name: string; 
  description: string;
  icon: string;
  defaultDuration: number;
}> = {
  'none': {
    name: 'Sin Transición',
    description: 'Corte directo sin efecto',
    icon: '✂️',
    defaultDuration: 0
  },
  'fade': {
    name: 'Fade',
    description: 'Fundido a negro',
    icon: '🌑',
    defaultDuration: 0.5
  },
  'dissolve': {
    name: 'Dissolve',
    description: 'Fundido cruzado suave',
    icon: '✨',
    defaultDuration: 1.0
  },
  'cross-dissolve': {
    name: 'Cross Dissolve',
    description: 'Fundido cruzado clásico',
    icon: '🔀',
    defaultDuration: 1.5
  },
  'wipe': {
    name: 'Wipe',
    description: 'Barrido de pantalla',
    icon: '➡️',
    defaultDuration: 0.8
  },
  'slide': {
    name: 'Slide',
    description: 'Deslizamiento lateral',
    icon: '⏩',
    defaultDuration: 0.6
  },
  'zoom': {
    name: 'Zoom',
    description: 'Acercamiento/alejamiento',
    icon: '🔍',
    defaultDuration: 1.0
  },
  'whip-pan': {
    name: 'Whip Pan',
    description: 'Movimiento rápido de cámara',
    icon: '💨',
    defaultDuration: 0.3
  },
  'glitch': {
    name: 'Glitch',
    description: 'Efecto de interferencia',
    icon: '⚡',
    defaultDuration: 0.2
  }
};

/**
 * Aplicar transiciones automáticas a clips
 */
export function applyAutoTransitions(
  clips: TimelineClip[],
  transitionType: TransitionType = 'dissolve',
  options: {
    enabled?: boolean;
    duration?: number;
    easing?: TransitionEasing;
    skipFirst?: boolean;
    skipLast?: boolean;
  } = {}
): ClipWithTransition[] {
  const {
    enabled = true,
    duration = TRANSITION_PRESETS[transitionType].defaultDuration,
    easing = 'ease-in-out',
    skipFirst = true,
    skipLast = false
  } = options;

  // Solo aplicar a clips visuales
  const visualClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  const audioClips = clips.filter(c => c.type === 'audio');
  const textClips = clips.filter(c => c.type === 'text');

  const clipsWithTransitions = visualClips.map((clip, index) => {
    // Skip first/last si está configurado
    const isFirst = index === 0;
    const isLast = index === visualClips.length - 1;
    
    if ((skipFirst && isFirst) || (skipLast && isLast)) {
      return {
        ...clip,
        transition: {
          id: `transition-${clip.id}`,
          type: 'none' as TransitionType,
          duration: 0,
          easing: 'linear' as TransitionEasing,
          enabled: false
        }
      };
    }

    return {
      ...clip,
      transition: {
        id: `transition-${clip.id}`,
        type: transitionType,
        duration,
        easing,
        enabled
      }
    };
  });

  // Combinar con clips de audio y texto sin transiciones
  return [
    ...clipsWithTransitions,
    ...audioClips.map(c => ({ ...c, transition: undefined })),
    ...textClips.map(c => ({ ...c, transition: undefined }))
  ];
}

/**
 * Aplicar transiciones basadas en template
 */
export function applyTemplateTransitions(
  clips: TimelineClip[],
  templateTransitions: Array<{
    type: TransitionType;
    duration: number;
    easing: TransitionEasing;
  }>,
  enabled: boolean = true
): ClipWithTransition[] {
  const visualClips = clips.filter(c => c.type === 'video' || c.type === 'image');
  const otherClips = clips.filter(c => c.type !== 'video' && c.type !== 'image');

  const clipsWithTransitions = visualClips.map((clip, index) => {
    // Ciclar a través de las transiciones del template
    const transitionConfig = templateTransitions[index % templateTransitions.length];

    return {
      ...clip,
      transition: {
        id: `transition-${clip.id}`,
        type: transitionConfig.type,
        duration: transitionConfig.duration,
        easing: transitionConfig.easing,
        enabled
      }
    };
  });

  return [...clipsWithTransitions, ...otherClips];
}

/**
 * Toggle transiciones on/off
 */
export function toggleTransitions(
  clips: ClipWithTransition[],
  enabled: boolean
): ClipWithTransition[] {
  return clips.map(clip => {
    if (!clip.transition) return clip;

    return {
      ...clip,
      transition: {
        ...clip.transition,
        enabled
      }
    };
  });
}

/**
 * Actualizar transición específica de un clip
 */
export function updateClipTransition(
  clips: ClipWithTransition[],
  clipId: string,
  transition: Partial<Transition>
): ClipWithTransition[] {
  return clips.map(clip => {
    if (clip.id !== clipId) return clip;

    return {
      ...clip,
      transition: clip.transition 
        ? { ...clip.transition, ...transition }
        : undefined
    };
  });
}

/**
 * Remover transición de un clip
 */
export function removeClipTransition(
  clips: ClipWithTransition[],
  clipId: string
): ClipWithTransition[] {
  return clips.map(clip => {
    if (clip.id !== clipId) return clip;

    return {
      ...clip,
      transition: {
        id: `transition-${clip.id}`,
        type: 'none' as TransitionType,
        duration: 0,
        easing: 'linear' as TransitionEasing,
        enabled: false
      }
    };
  });
}

/**
 * Obtener duración total incluyendo transiciones
 */
export function getTotalDurationWithTransitions(
  clips: ClipWithTransition[]
): number {
  if (clips.length === 0) return 0;

  let totalDuration = 0;

  clips.forEach((clip, index) => {
    totalDuration += clip.duration;

    // Restar overlap de transición (excepto último clip)
    if (index < clips.length - 1 && clip.transition?.enabled) {
      totalDuration -= clip.transition.duration;
    }
  });

  return Math.max(0, totalDuration);
}

/**
 * Validar compatibilidad de transiciones
 */
export function validateTransitions(
  clips: ClipWithTransition[]
): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  clips.forEach((clip, index) => {
    if (!clip.transition || !clip.transition.enabled) return;

    // Verificar que la transición no sea más larga que el clip
    if (clip.transition.duration > clip.duration) {
      errors.push(
        `Clip "${clip.title}": la transición (${clip.transition.duration}s) es más larga que el clip (${clip.duration}s)`
      );
    }

    // Advertir si la transición es muy larga
    if (clip.transition.duration > clip.duration * 0.5) {
      warnings.push(
        `Clip "${clip.title}": la transición ocupa más del 50% del clip`
      );
    }

    // Verificar overlap con clip siguiente
    if (index < clips.length - 1) {
      const nextClip = clips[index + 1];
      const gap = nextClip.start - (clip.start + clip.duration);
      
      if (gap < 0 && Math.abs(gap) < clip.transition.duration) {
        warnings.push(
          `Posible overlap entre "${clip.title}" y "${nextClip.title}"`
        );
      }
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

export default {
  TRANSITION_PRESETS,
  applyAutoTransitions,
  applyTemplateTransitions,
  toggleTransitions,
  updateClipTransition,
  removeClipTransition,
  getTotalDurationWithTransitions,
  validateTransitions
};
