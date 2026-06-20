/**
 * Color Grading Service
 * Ajustes de color en tiempo real
 */

import type { TimelineClip } from '../../components/professional-editor/EnhancedTimeline';
import { logger } from "../logger";

export interface ColorGradingSettings {
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  temperature: number; // -100 (cool) to 100 (warm)
  tint: number; // -100 (green) to 100 (magenta)
  exposure: number; // -100 to 100
  highlights: number; // -100 to 100
  shadows: number; // -100 to 100
  vibrance: number; // -100 to 100
  vignette: number; // 0 to 100
  grain: number; // 0 to 100
  sharpen: number; // 0 to 100
}

export interface ColorGradingPreset {
  id: string;
  name: string;
  description: string;
  settings: ColorGradingSettings;
  thumbnail?: string;
}

/**
 * Configuración por defecto
 */
export const DEFAULT_COLOR_GRADING: ColorGradingSettings = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  tint: 0,
  exposure: 0,
  highlights: 0,
  shadows: 0,
  vibrance: 0,
  vignette: 0,
  grain: 0,
  sharpen: 0
};

/**
 * Presets de color grading
 */
export const COLOR_GRADING_PRESETS: ColorGradingPreset[] = [
  {
    id: 'natural',
    name: 'Natural',
    description: 'Sin ajustes, colores naturales',
    settings: DEFAULT_COLOR_GRADING
  },
  {
    id: 'cinematic-warm',
    name: 'Cinematográfico Cálido',
    description: 'Tonos cálidos con alto contraste',
    settings: {
      brightness: -5,
      contrast: 20,
      saturation: -10,
      temperature: 20,
      tint: -5,
      exposure: 5,
      highlights: -10,
      shadows: -15,
      vibrance: 10,
      vignette: 25,
      grain: 10,
      sharpen: 15
    }
  },
  {
    id: 'cinematic-cool',
    name: 'Cinematográfico Frío',
    description: 'Tonos fríos estilo thriller',
    settings: {
      brightness: -10,
      contrast: 25,
      saturation: -15,
      temperature: -20,
      tint: 5,
      exposure: 0,
      highlights: -15,
      shadows: -20,
      vibrance: 5,
      vignette: 30,
      grain: 15,
      sharpen: 20
    }
  },
  {
    id: 'vibrant',
    name: 'Vibrante',
    description: 'Colores saturados y vivos',
    settings: {
      brightness: 10,
      contrast: 25,
      saturation: 40,
      temperature: 5,
      tint: 0,
      exposure: 10,
      highlights: 10,
      shadows: 5,
      vibrance: 50,
      vignette: 0,
      grain: 0,
      sharpen: 25
    }
  },
  {
    id: 'pastel',
    name: 'Pastel Soñador',
    description: 'Colores suaves y etéreos',
    settings: {
      brightness: 15,
      contrast: -15,
      saturation: -25,
      temperature: 10,
      tint: 10,
      exposure: 15,
      highlights: 20,
      shadows: 10,
      vibrance: -20,
      vignette: 35,
      grain: 5,
      sharpen: 0
    }
  },
  {
    id: 'vintage',
    name: 'Vintage',
    description: 'Estilo retro con grano',
    settings: {
      brightness: -5,
      contrast: 15,
      saturation: 20,
      temperature: 15,
      tint: 5,
      exposure: 0,
      highlights: -5,
      shadows: -10,
      vibrance: 15,
      vignette: 40,
      grain: 35,
      sharpen: 10
    }
  },
  {
    id: 'bw-contrast',
    name: 'Blanco y Negro Alto Contraste',
    description: 'Monocromático dramático',
    settings: {
      brightness: 0,
      contrast: 40,
      saturation: -100,
      temperature: 0,
      tint: 0,
      exposure: 5,
      highlights: -20,
      shadows: -25,
      vibrance: 0,
      vignette: 20,
      grain: 20,
      sharpen: 30
    }
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    description: 'Luz cálida de atardecer',
    settings: {
      brightness: 5,
      contrast: 15,
      saturation: 10,
      temperature: 35,
      tint: -10,
      exposure: 10,
      highlights: 15,
      shadows: -5,
      vibrance: 20,
      vignette: 15,
      grain: 5,
      sharpen: 15
    }
  },
  {
    id: 'moody',
    name: 'Moody',
    description: 'Oscuro y atmosférico',
    settings: {
      brightness: -20,
      contrast: 30,
      saturation: -5,
      temperature: -10,
      tint: 10,
      exposure: -15,
      highlights: -25,
      shadows: -30,
      vibrance: 10,
      vignette: 45,
      grain: 25,
      sharpen: 20
    }
  }
];

/**
 * Aplicar color grading a clips
 */
export function applyColorGrading(
  clips: TimelineClip[],
  settings: ColorGradingSettings
): TimelineClip[] {
  return clips.map(clip => {
    // Solo aplicar a clips visuales
    if (clip.type !== 'video' && clip.type !== 'image') {
      return clip;
    }

    return {
      ...clip,
      metadata: {
        ...clip.metadata,
        colorGrading: settings
      }
    };
  });
}

/**
 * Aplicar preset de color grading
 */
export function applyColorGradingPreset(
  clips: TimelineClip[],
  presetId: string
): TimelineClip[] {
  const preset = COLOR_GRADING_PRESETS.find(p => p.id === presetId);
  
  if (!preset) {
    logger.warn(`Preset "${presetId}" no encontrado`);
    return clips;
  }

  return applyColorGrading(clips, preset.settings);
}

/**
 * Convertir settings a filtros CSS
 */
export function settingsToCSSFilters(settings: ColorGradingSettings): string {
  const filters: string[] = [];

  // Brightness
  if (settings.brightness !== 0) {
    const value = 1 + (settings.brightness / 100);
    filters.push(`brightness(${value})`);
  }

  // Contrast
  if (settings.contrast !== 0) {
    const value = 1 + (settings.contrast / 100);
    filters.push(`contrast(${value})`);
  }

  // Saturation
  if (settings.saturation !== 0) {
    const value = 1 + (settings.saturation / 100);
    filters.push(`saturate(${value})`);
  }

  // Sharpen (usando contrast como aproximación)
  if (settings.sharpen > 0) {
    const value = 1 + (settings.sharpen / 200);
    filters.push(`contrast(${value})`);
  }

  return filters.join(' ');
}

/**
 * Interpolar entre dos configuraciones
 */
export function interpolateSettings(
  from: ColorGradingSettings,
  to: ColorGradingSettings,
  progress: number // 0 to 1
): ColorGradingSettings {
  const interpolate = (a: number, b: number) => a + (b - a) * progress;

  return {
    brightness: interpolate(from.brightness, to.brightness),
    contrast: interpolate(from.contrast, to.contrast),
    saturation: interpolate(from.saturation, to.saturation),
    temperature: interpolate(from.temperature, to.temperature),
    tint: interpolate(from.tint, to.tint),
    exposure: interpolate(from.exposure, to.exposure),
    highlights: interpolate(from.highlights, to.highlights),
    shadows: interpolate(from.shadows, to.shadows),
    vibrance: interpolate(from.vibrance, to.vibrance),
    vignette: interpolate(from.vignette, to.vignette),
    grain: interpolate(from.grain, to.grain),
    sharpen: interpolate(from.sharpen, to.sharpen)
  };
}

/**
 * Obtener configuración de color grading de un clip
 */
export function getClipColorGrading(
  clip: TimelineClip
): ColorGradingSettings {
  return clip.metadata?.colorGrading || DEFAULT_COLOR_GRADING;
}

/**
 * Resetear color grading
 */
export function resetColorGrading(clips: TimelineClip[]): TimelineClip[] {
  return applyColorGrading(clips, DEFAULT_COLOR_GRADING);
}

export default {
  DEFAULT_COLOR_GRADING,
  COLOR_GRADING_PRESETS,
  applyColorGrading,
  applyColorGradingPreset,
  settingsToCSSFilters,
  interpolateSettings,
  getClipColorGrading,
  resetColorGrading
};
