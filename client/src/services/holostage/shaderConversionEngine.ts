// ─── Shader Conversion Engine ─────────────────────────────────────────────────
// Converts Character Creator material params to hologram-optimized shaders.
// MVP1: returns CSS filter strings. MVP2: builds WebGL/Three.js shaders.

export interface HologramShaderParams {
  // Color grade
  hue: number;            // 0-360
  saturation: number;     // 0-2
  brightness: number;     // 0-2
  contrast: number;       // 0-2
  // Hologram effects
  scanlineOpacity: number;      // 0-1
  scanlineFrequency: number;    // lines per pixel
  flickerRate: number;          // Hz
  edgeGlowColor: string;        // hex
  edgeGlowIntensity: number;    // 0-1
  chromaticAberration: number;  // pixels
  // Transparency
  opacity: number;        // 0-1
  hologramMode: boolean;
}

export const DEFAULT_HOLOGRAM_PARAMS: HologramShaderParams = {
  hue: 190,
  saturation: 1.3,
  brightness: 1.4,
  contrast: 1.2,
  scanlineOpacity: 0.15,
  scanlineFrequency: 0.025,
  flickerRate: 0.3,
  edgeGlowColor: '#00e5ff',
  edgeGlowIntensity: 0.7,
  chromaticAberration: 2,
  opacity: 0.92,
  hologramMode: true,
};

/**
 * Generates a CSS filter string from shader params.
 */
export function buildCSSFilter(params: HologramShaderParams): string {
  const parts: string[] = [
    `brightness(${params.brightness})`,
    `contrast(${params.contrast})`,
    `saturate(${params.saturation})`,
    `hue-rotate(${params.hue - 180}deg)`,
  ];
  return parts.join(' ');
}

/**
 * Generates inline CSS variables for the hologram overlay effect.
 */
export function buildHologramOverlayVars(params: HologramShaderParams): Record<string, string> {
  return {
    '--holo-scanline-opacity': String(params.scanlineOpacity),
    '--holo-scanline-freq': String(params.scanlineFrequency),
    '--holo-glow': params.edgeGlowColor,
    '--holo-glow-intensity': String(params.edgeGlowIntensity),
    '--holo-opacity': String(params.opacity),
    '--holo-aberration': `${params.chromaticAberration}px`,
  };
}

/**
 * Preset: Classic cyan hologram (Tupac-style)
 */
export const PRESET_CYAN_HOLOGRAM: HologramShaderParams = {
  ...DEFAULT_HOLOGRAM_PARAMS,
  hue: 195,
  saturation: 0.6,
  edgeGlowColor: '#00e5ff',
  scanlineOpacity: 0.2,
};

/**
 * Preset: Orange Boostify hologram
 */
export const PRESET_ORANGE_BOOSTIFY: HologramShaderParams = {
  ...DEFAULT_HOLOGRAM_PARAMS,
  hue: 25,
  saturation: 1.8,
  edgeGlowColor: '#f97316',
  scanlineOpacity: 0.12,
  brightness: 1.5,
};

/**
 * Preset: White clean hologram
 */
export const PRESET_WHITE_CLEAN: HologramShaderParams = {
  ...DEFAULT_HOLOGRAM_PARAMS,
  hue: 180,
  saturation: 0.1,
  edgeGlowColor: '#ffffff',
  scanlineOpacity: 0.08,
  brightness: 1.6,
  chromaticAberration: 1,
};
