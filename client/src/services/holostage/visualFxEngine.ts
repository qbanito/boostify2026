// ─── Visual FX Engine ─────────────────────────────────────────────────────────
// Dispatches visual effects triggered by timeline cues.
// Effects are rendered as CSS/Canvas overlays on the HologramRenderer.

import type { TimelineCue } from '../../schemas/holostage/timelineCue.schema';

// ─── Effect Types ─────────────────────────────────────────────────────────────

export type FXEffectType =
  | 'fade_in_character'
  | 'fade_out_character'
  | 'energy_wave'
  | 'color_flash'
  | 'particle_burst'
  | 'slow_fade_out_particles'
  | 'scan_lines'
  | 'glitch'
  | 'vignette'
  | 'chromatic_aberration'
  | 'hologram_flicker'
  | 'shockwave'
  | 'spotlight'
  | 'blackout'
  | 'none';

export interface FXEffect {
  id: string;
  type: FXEffectType;
  intensity: number;        // 0-1
  duration: number;         // seconds
  color?: string;           // hex
  startTime: number;        // performance.now() when started
  onComplete?: () => void;
}

export interface FXState {
  activeEffects: FXEffect[];
  characterOpacity: number;   // 0-1, for fade in/out
  overlayColor: string;       // for color flash
  overlayAlpha: number;       // 0-1
  glitchIntensity: number;
  flickerIntensity: number;
  scanlineAlpha: number;
  vignette: number;
  chromaticAberration: number;
}

type FXStateCallback = (state: FXState) => void;

// ─── Visual FX Engine Class ────────────────────────────────────────────────────

class VisualFxEngine {
  private state: FXState = this.defaultState();
  private callbacks: FXStateCallback[] = [];
  private rafId: number | null = null;
  private lastTick = 0;

  private defaultState(): FXState {
    return {
      activeEffects: [],
      characterOpacity: 1,
      overlayColor: '#000000',
      overlayAlpha: 0,
      glitchIntensity: 0,
      flickerIntensity: 0,
      scanlineAlpha: 0,
      vignette: 0,
      chromaticAberration: 0,
    };
  }

  // ─── Cue Dispatcher ───────────────────────────────────────────────────────

  handleCue(cue: TimelineCue): void {
    if (cue.type !== 'visual_fx') return;
    const action = cue.action as string;
    const payload = (cue.payload ?? {}) as Record<string, unknown>;

    this.triggerEffect(action as FXEffectType, {
      intensity: (payload['intensity'] as number) ?? 0.8,
      duration: (payload['duration'] as number) ?? 2,
      color: (payload['color'] as string) ?? '#ff6600',
    });
  }

  triggerEffect(type: FXEffectType, opts: { intensity?: number; duration?: number; color?: string } = {}): void {
    const effect: FXEffect = {
      id: `fx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      intensity: opts.intensity ?? 0.8,
      duration: opts.duration ?? 2,
      color: opts.color ?? '#ff6600',
      startTime: performance.now(),
    };
    this.state.activeEffects.push(effect);
    this.startTick();
    this.emit();
  }

  // ─── Preset shortcuts ─────────────────────────────────────────────────────

  fadeInCharacter(duration = 3): void {
    this.state.characterOpacity = 0;
    this.triggerEffect('fade_in_character', { duration, intensity: 1 });
  }

  fadeOutCharacter(duration = 3): void {
    this.triggerEffect('fade_out_character', { duration, intensity: 1 });
  }

  flashColor(color: string, intensity = 1, duration = 0.3): void {
    this.triggerEffect('color_flash', { intensity, duration, color });
  }

  energyWave(color = 'orange', intensity = 0.9): void {
    this.triggerEffect('energy_wave', { intensity, duration: 2, color });
  }

  hologramFlicker(intensity = 0.4): void {
    this.triggerEffect('hologram_flicker', { intensity, duration: 1.5 });
  }

  blackoutFX(duration = 0.1): void {
    this.triggerEffect('blackout', { intensity: 1, duration });
  }

  // ─── RAF Tick ─────────────────────────────────────────────────────────────

  private startTick(): void {
    if (this.rafId !== null) return;
    this.lastTick = performance.now();
    const tick = (now: number) => {
      this.processTick(now);
      if (this.state.activeEffects.length > 0) {
        this.rafId = requestAnimationFrame(tick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(tick);
  }

  private processTick(now: number): void {
    const completed: string[] = [];

    // Reset computed values
    let characterOpacity = this.state.characterOpacity;
    let overlayAlpha = 0;
    let overlayColor = '#000000';
    let glitch = 0;
    let flicker = 0;
    let scan = 0;
    let vignette = 0;
    let chroma = 0;

    for (const effect of this.state.activeEffects) {
      const elapsed = (now - effect.startTime) / 1000;
      const progress = Math.min(1, elapsed / effect.duration);

      // Easing: ease-in-out quad
      const eased = progress < 0.5
        ? 2 * progress * progress
        : -1 + (4 - 2 * progress) * progress;

      switch (effect.type) {
        case 'fade_in_character':
          characterOpacity = eased * effect.intensity;
          break;
        case 'fade_out_character':
          characterOpacity = (1 - eased) * effect.intensity;
          break;
        case 'color_flash': {
          // Flash: ramp up 20%, ramp down 80%
          const flashCurve = progress < 0.2
            ? progress / 0.2
            : 1 - ((progress - 0.2) / 0.8);
          overlayAlpha = Math.max(overlayAlpha, flashCurve * effect.intensity * 0.6);
          overlayColor = effect.color ?? '#ff6600';
          break;
        }
        case 'energy_wave':
          // Shockwave ring effect — handled via CSS variable
          overlayAlpha = Math.max(overlayAlpha, (1 - eased) * 0.3 * effect.intensity);
          overlayColor = effect.color ?? '#ff6600';
          chroma = Math.max(chroma, (1 - eased) * 4 * effect.intensity);
          break;
        case 'slow_fade_out_particles':
          overlayAlpha = Math.max(overlayAlpha, eased * 0.15 * effect.intensity);
          break;
        case 'hologram_flicker':
          flicker = Math.max(flicker, (Math.random() > 0.85 ? effect.intensity : 0));
          scan = Math.max(scan, 0.15 * effect.intensity);
          break;
        case 'glitch':
          glitch = Math.max(glitch, effect.intensity * (Math.random() > 0.7 ? 1 : 0));
          chroma = Math.max(chroma, 6 * effect.intensity);
          break;
        case 'scan_lines':
          scan = Math.max(scan, 0.3 * effect.intensity);
          break;
        case 'vignette':
          vignette = Math.max(vignette, effect.intensity * eased);
          break;
        case 'chromatic_aberration':
          chroma = Math.max(chroma, 8 * effect.intensity * eased);
          break;
        case 'blackout':
          characterOpacity = 0;
          overlayAlpha = 1;
          overlayColor = '#000000';
          break;
        case 'shockwave':
          vignette = Math.max(vignette, (1 - eased) * 0.8 * effect.intensity);
          chroma = Math.max(chroma, (1 - eased) * 6 * effect.intensity);
          break;
        case 'spotlight':
          vignette = Math.max(vignette, 0.6 * effect.intensity);
          break;
      }

      if (progress >= 1) {
        completed.push(effect.id);
        effect.onComplete?.();
      }
    }

    // Remove completed effects
    this.state.activeEffects = this.state.activeEffects.filter(e => !completed.includes(e.id));

    // Update state
    this.state.characterOpacity = characterOpacity;
    this.state.overlayAlpha = overlayAlpha;
    this.state.overlayColor = overlayColor;
    this.state.glitchIntensity = glitch;
    this.state.flickerIntensity = flicker;
    this.state.scanlineAlpha = scan;
    this.state.vignette = vignette;
    this.state.chromaticAberration = chroma;

    this.emit();
  }

  // ─── State & Subscription ─────────────────────────────────────────────────

  getState(): FXState {
    return { ...this.state, activeEffects: [...this.state.activeEffects] };
  }

  onState(cb: FXStateCallback): () => void {
    this.callbacks.push(cb);
    return () => { this.callbacks = this.callbacks.filter(c => c !== cb); };
  }

  reset(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.state = this.defaultState();
    this.emit();
  }

  private emit(): void {
    this.callbacks.forEach(cb => cb(this.getState()));
  }
}

export const visualFxEngine = new VisualFxEngine();
