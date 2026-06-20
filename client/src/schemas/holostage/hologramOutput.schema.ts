// ─── Hologram Output Schema ───────────────────────────────────────────────────

export type OutputFormat = '16:9' | '9:16' | '4:3' | '1:1' | 'peppers_ghost';
export type HologramEffect = 'none' | 'scanlines' | 'crt' | 'holographic' | 'phosphor';
export type BackgroundMode = 'pure_black' | 'grid' | 'stage' | 'transparent';
export type OutputType = 'preview' | 'fullscreen' | 'peppers_ghost' | 'led_volume' | 'ndi_streaming';

export interface HologramOutputSettings {
  // ── Output destination ────────────────────────────────────────
  outputType: OutputType;
  outputDisplay: number;          // monitor index (0 = primary)
  fullscreenOnPlay: boolean;
  loopShow: boolean;

  // ── Resolution & format ───────────────────────────────────────
  resolution: { width: number; height: number };
  format: OutputFormat;
  fps: number;

  // ── Environment ───────────────────────────────────────────────
  background: BackgroundMode;

  // ── Hologram effect ───────────────────────────────────────────
  hologramEffect: HologramEffect;
  effectIntensity: number;        // 0–1

  // ── Color grade ───────────────────────────────────────────────
  brightness: number;             // 0–2
  contrast: number;               // 0–2
  saturation: number;             // 0–2
  hueShift: number;               // degrees -180 to 180

  // ── Post-process ──────────────────────────────────────────────
  chromaticAberration: boolean;
  chromaticAberrationStrength: number; // 0–5 pixels
  bloomEnabled: boolean;
  bloomIntensity: number;         // 0–1
  vignetteEnabled: boolean;
  vignetteStrength: number;       // 0–1
  mirrorMode: boolean;            // horizontal flip for Pepper's Ghost
  glitchEnabled: boolean;         // random glitch pulses
  glitchIntensity: number;        // 0–1
}

export const DEFAULT_OUTPUT_SETTINGS: HologramOutputSettings = {
  outputType: 'preview',
  outputDisplay: 0,
  fullscreenOnPlay: false,
  loopShow: false,

  resolution: { width: 1920, height: 1080 },
  format: '16:9',
  fps: 60,

  background: 'pure_black',

  hologramEffect: 'holographic',
  effectIntensity: 0.6,

  brightness: 1.2,
  contrast: 1.1,
  saturation: 0.9,
  hueShift: 0,

  chromaticAberration: true,
  chromaticAberrationStrength: 2,
  bloomEnabled: true,
  bloomIntensity: 0.4,
  vignetteEnabled: true,
  vignetteStrength: 0.6,
  mirrorMode: false,
  glitchEnabled: false,
  glitchIntensity: 0.3,
};
