// ─── Hologram Output Manager ──────────────────────────────────────────────────
// Controls the hologram renderer window/fullscreen and output settings.

import type React from 'react';
import type { HologramOutputSettings } from '../../schemas/holostage/hologramOutput.schema';

export interface OutputManagerState {
  isFullscreen: boolean;
  currentSettings: HologramOutputSettings;
  rendererReady: boolean;
  fps: number;
  frameCount: number;
}

type OutputStateCallback = (state: OutputManagerState) => void;

class HologramOutputManager {
  private state: OutputManagerState;
  private callbacks: OutputStateCallback[] = [];
  private fpsFrames: number[] = [];
  private lastFpsCalc = performance.now();

  constructor(settings: HologramOutputSettings) {
    this.state = {
      isFullscreen: false,
      currentSettings: settings,
      rendererReady: false,
      fps: 0,
      frameCount: 0,
    };

    // Listen for fullscreen changes
    document.addEventListener('fullscreenchange', () => {
      this.state.isFullscreen = !!document.fullscreenElement;
      this.emit();
    });
  }

  // ─── Fullscreen ───────────────────────────────────────────────────────────

  async requestFullscreen(element: HTMLElement): Promise<boolean> {
    try {
      await element.requestFullscreen();
      return true;
    } catch {
      return false;
    }
  }

  async exitFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  updateSettings(partial: Partial<HologramOutputSettings>): void {
    this.state.currentSettings = { ...this.state.currentSettings, ...partial };
    this.emit();
  }

  getSettings(): HologramOutputSettings {
    return { ...this.state.currentSettings };
  }

  // ─── Renderer State ───────────────────────────────────────────────────────

  setRendererReady(ready: boolean): void {
    this.state.rendererReady = ready;
    this.emit();
  }

  tickFrame(): void {
    this.state.frameCount++;
    const now = performance.now();
    this.fpsFrames.push(now);
    this.fpsFrames = this.fpsFrames.filter(t => now - t < 1000);
    if (now - this.lastFpsCalc > 500) {
      this.state.fps = this.fpsFrames.length;
      this.lastFpsCalc = now;
    }
  }

  // ─── CSS Filter String ────────────────────────────────────────────────────

  buildFilterCSS(settings: HologramOutputSettings): string {
    const parts: string[] = [];
    if (settings.brightness !== 1) parts.push(`brightness(${settings.brightness})`);
    if (settings.contrast !== 1) parts.push(`contrast(${settings.contrast})`);
    if (settings.saturation !== 1) parts.push(`saturate(${settings.saturation})`);
    if (settings.hueShift !== 0) parts.push(`hue-rotate(${settings.hueShift}deg)`);
    return parts.join(' ') || 'none';
  }

  // ─── Chromatic Aberration style ───────────────────────────────────────────
  // Returns a style object for the CA wrapper element using CSS text-shadow trick
  buildCAStyle(settings: HologramOutputSettings): React.CSSProperties | null {
    if (!settings.chromaticAberration) return null;
    const s = settings.chromaticAberrationStrength ?? 2;
    // Use drop-shadow with opposite channel-like colors to approximate CA
    return {
      filter: `drop-shadow(${s}px 0 0 rgba(255,0,100,0.4)) drop-shadow(-${s}px 0 0 rgba(0,220,255,0.4))`,
    };
  }

  // ─── Mirror style ─────────────────────────────────────────────────────────
  buildMirrorStyle(settings: HologramOutputSettings): React.CSSProperties {
    return settings.mirrorMode ? { transform: 'scaleX(-1)' } : {};
  }

  // ─── Output type label ────────────────────────────────────────────────────
  getOutputLabel(settings: HologramOutputSettings): string {
    const labels: Record<string, string> = {
      preview: 'Preview',
      fullscreen: 'Fullscreen',
      peppers_ghost: "Pepper's Ghost",
      led_volume: 'LED Volume',
      ndi_streaming: 'NDI Streaming',
    };
    return labels[settings.outputType] ?? 'Preview';
  }

  // ─── Events ───────────────────────────────────────────────────────────────

  onChange(cb: OutputStateCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  getState(): OutputManagerState {
    return { ...this.state };
  }

  private emit(): void {
    this.callbacks.forEach(cb => cb(this.getState()));
  }
}

// Lazy singleton — created on first import
import { DEFAULT_OUTPUT_SETTINGS } from '../../schemas/holostage/hologramOutput.schema';
export const hologramOutputManager = new HologramOutputManager(DEFAULT_OUTPUT_SETTINGS);
