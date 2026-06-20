// ─── DMX Engine (Mock) ────────────────────────────────────────────────────────
// Simulates DMX universe output. MVP2: connect to real DMX-USB interface.

import type { DMXScene, DMXChannel } from '../../schemas/holostage/dmx.schema';

export interface DMXUniverseState {
  channels: Uint8Array;     // 512 channels, 0-255 each
  activeScene: DMXScene | null;
  fadingFrom: DMXScene | null;
  fadeProgress: number;     // 0-1
  masterDimmer: number;     // 0-1
  blackout: boolean;
}

type DMXUpdateCallback = (state: DMXUniverseState) => void;

class DMXEngine {
  private state: DMXUniverseState = {
    channels: new Uint8Array(512),
    activeScene: null,
    fadingFrom: null,
    fadeProgress: 1,
    masterDimmer: 1,
    blackout: false,
  };
  private callbacks: DMXUpdateCallback[] = [];
  private fadeInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Scene Control ────────────────────────────────────────────────────────

  activateScene(scene: DMXScene, immediate = false): void {
    if (this.state.blackout) return;
    this.state.fadingFrom = this.state.activeScene;
    this.state.activeScene = scene;
    this.state.fadeProgress = immediate ? 1 : 0;

    if (immediate || scene.fadeIn <= 0) {
      this.applyScene(scene);
      this.state.fadeProgress = 1;
      this.emit();
      return;
    }

    // Animate fade
    this.startFade(scene, scene.fadeIn);
  }

  blackoutOn(): void {
    this.state.blackout = true;
    this.state.channels.fill(0);
    this.emit();
  }

  blackoutOff(): void {
    this.state.blackout = false;
    if (this.state.activeScene) {
      this.applyScene(this.state.activeScene);
    }
    this.emit();
  }

  setMasterDimmer(value: number): void {
    this.state.masterDimmer = Math.max(0, Math.min(1, value));
    if (this.state.activeScene && !this.state.blackout) {
      this.applyScene(this.state.activeScene);
    }
    this.emit();
  }

  setChannel(channel: number, value: number): void {
    if (channel < 1 || channel > 512) return;
    this.state.channels[channel - 1] = Math.max(0, Math.min(255, Math.round(value * this.state.masterDimmer)));
    this.emit();
  }

  // ─── State ────────────────────────────────────────────────────────────────

  getState(): DMXUniverseState {
    return { ...this.state, channels: new Uint8Array(this.state.channels) };
  }

  getChannelValue(channel: number): number {
    if (channel < 1 || channel > 512) return 0;
    return this.state.channels[channel - 1];
  }

  onChange(cb: DMXUpdateCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private applyScene(scene: DMXScene): void {
    for (const ch of scene.channels) {
      if (ch.channel >= 1 && ch.channel <= 512) {
        this.state.channels[ch.channel - 1] = Math.round(ch.value * this.state.masterDimmer * scene.intensity);
      }
    }
  }

  private startFade(targetScene: DMXScene, durationMs: number): void {
    if (this.fadeInterval) clearInterval(this.fadeInterval);

    const steps = Math.ceil(durationMs / 16); // ~60fps
    let step = 0;
    const fromChannels = new Uint8Array(this.state.channels);

    const targetChannels = new Uint8Array(512);
    for (const ch of targetScene.channels) {
      if (ch.channel >= 1 && ch.channel <= 512) {
        targetChannels[ch.channel - 1] = Math.round(ch.value * this.state.masterDimmer * targetScene.intensity);
      }
    }

    this.fadeInterval = setInterval(() => {
      step++;
      const progress = Math.min(step / steps, 1);
      this.state.fadeProgress = progress;

      for (let i = 0; i < 512; i++) {
        this.state.channels[i] = Math.round(fromChannels[i] + (targetChannels[i] - fromChannels[i]) * progress);
      }

      this.emit();

      if (progress >= 1) {
        clearInterval(this.fadeInterval!);
        this.fadeInterval = null;
      }
    }, 16);
  }

  private emit(): void {
    this.callbacks.forEach(cb => cb(this.getState()));
  }
}

export const dmxEngine = new DMXEngine();

/**
 * Get a preview color for a set of DMX channels (reads R, G, B channels 1-3).
 */
export function getScenePreviewColor(scene: DMXScene): string {
  return scene.color || '#f97316';
}
