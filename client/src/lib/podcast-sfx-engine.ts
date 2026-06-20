/**
 * Podcast SFX Engine
 * Uses Tone.js for high-quality synthesized effects (zero file payload)
 * + Howler.js for any uploaded/external audio files.
 * All sounds run through a master chain (reverb + compressor + limiter)
 * for a polished, "broadcast-ready" feel.
 */
import * as Tone from 'tone';
import { Howl, Howler } from 'howler';

export type SFXCategory =
  | 'transition'
  | 'reaction'
  | 'comedy'
  | 'ambient'
  | 'stinger'
  | 'musical';

export interface SFXDefinition {
  id: string;
  name: string;
  emoji: string;
  category: SFXCategory;
  /** Duration in seconds, used for UI feedback */
  duration: number;
  /** If provided, plays a real file via Howler, else synthesized via Tone */
  file?: string;
  description?: string;
}

/**
 * Curated catalog. 28 effects across 6 categories.
 * No external assets required — all synthesized with Tone.js.
 */
export const SFX_CATALOG: SFXDefinition[] = [
  // ── Transitions ──
  { id: 'whoosh',      name: 'Whoosh',       emoji: '💨', category: 'transition', duration: 0.6, description: 'Smooth transition sweep' },
  { id: 'riser',       name: 'Riser',        emoji: '⬆️', category: 'transition', duration: 1.2, description: 'Building tension riser' },
  { id: 'downer',      name: 'Downer',       emoji: '⬇️', category: 'transition', duration: 1.0 },
  { id: 'page-turn',   name: 'Page Turn',    emoji: '📄', category: 'transition', duration: 0.4 },
  { id: 'tape-stop',   name: 'Tape Stop',    emoji: '⏹️', category: 'transition', duration: 0.8 },

  // ── Reactions ──
  { id: 'airhorn',     name: 'Air Horn',     emoji: '📯', category: 'reaction',   duration: 1.0 },
  { id: 'applause',    name: 'Applause',     emoji: '👏', category: 'reaction',   duration: 2.5 },
  { id: 'cheer',       name: 'Cheer',        emoji: '🎉', category: 'reaction',   duration: 2.0 },
  { id: 'boo',         name: 'Boo',          emoji: '👎', category: 'reaction',   duration: 1.2 },
  { id: 'gasp',        name: 'Gasp',         emoji: '😮', category: 'reaction',   duration: 0.8 },
  { id: 'mind-blown',  name: 'Mind Blown',   emoji: '🤯', category: 'reaction',   duration: 1.5 },

  // ── Comedy ──
  { id: 'rimshot',     name: 'Rimshot',      emoji: '🥁', category: 'comedy',     duration: 0.8 },
  { id: 'crickets',    name: 'Crickets',     emoji: '🦗', category: 'comedy',     duration: 3.0 },
  { id: 'sad-trombone',name: 'Sad Trombone', emoji: '🎺', category: 'comedy',     duration: 2.2 },
  { id: 'laugh-track', name: 'Laugh Track',  emoji: '😂', category: 'comedy',     duration: 2.0 },
  { id: 'error',       name: 'Error',        emoji: '❌', category: 'comedy',     duration: 0.5 },
  { id: 'record-scratch', name: 'Record Scratch', emoji: '💿', category: 'comedy', duration: 0.7 },

  // ── Stingers ──
  { id: 'ding',        name: 'Ding',         emoji: '🔔', category: 'stinger',    duration: 0.6 },
  { id: 'chime',       name: 'Chime',        emoji: '🎵', category: 'stinger',    duration: 1.5 },
  { id: 'bell',        name: 'Bell',         emoji: '🛎️', category: 'stinger',    duration: 1.8 },
  { id: 'success',     name: 'Success',      emoji: '✅', category: 'stinger',    duration: 1.0 },
  { id: 'level-up',    name: 'Level Up',     emoji: '⭐', category: 'stinger',    duration: 1.4 },

  // ── Ambient ──
  { id: 'suspense',    name: 'Suspense',     emoji: '😱', category: 'ambient',    duration: 4.0 },
  { id: 'heartbeat',   name: 'Heartbeat',    emoji: '💓', category: 'ambient',    duration: 3.0 },
  { id: 'static',      name: 'Static',       emoji: '📻', category: 'ambient',    duration: 1.5 },

  // ── Musical ──
  { id: 'fanfare',     name: 'Fanfare',      emoji: '🎺', category: 'musical',    duration: 2.5 },
  { id: 'jingle',      name: 'Jingle',       emoji: '🎶', category: 'musical',    duration: 2.0 },
  { id: 'bass-drop',   name: 'Bass Drop',    emoji: '🔊', category: 'musical',    duration: 1.8 },
];

class PodcastSFXEngine {
  private initialized = false;
  private masterGain: Tone.Gain | null = null;
  private masterCompressor: Tone.Compressor | null = null;
  private masterReverb: Tone.Reverb | null = null;
  private masterLimiter: Tone.Limiter | null = null;
  private duckGain: Tone.Gain | null = null;
  private muted = false;
  private volume = 0.7;
  private duckActive = false;
  private duckTimeout: ReturnType<typeof setTimeout> | null = null;
  private onDuck?: (ducked: boolean) => void;
  private fileCache = new Map<string, Howl>();

  /** Must be called from a user gesture (click). */
  async ensureStarted() {
    if (this.initialized) return;
    await Tone.start();

    // Build master chain: synth → duckGain → reverb → compressor → limiter → gain → out
    this.masterGain = new Tone.Gain(this.volume);
    this.masterLimiter = new Tone.Limiter(-1);
    this.masterCompressor = new Tone.Compressor({ threshold: -18, ratio: 3, attack: 0.005, release: 0.1 });
    this.masterReverb = new Tone.Reverb({ decay: 1.2, wet: 0.12, preDelay: 0.01 });
    this.duckGain = new Tone.Gain(1);

    await this.masterReverb.ready;

    this.duckGain.chain(this.masterReverb, this.masterCompressor, this.masterLimiter, this.masterGain, Tone.getDestination());
    this.initialized = true;
  }

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.masterGain) this.masterGain.gain.rampTo(this.muted ? 0 : this.volume, 0.05);
    Howler.volume(this.muted ? 0 : this.volume);
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.masterGain) this.masterGain.gain.rampTo(m ? 0 : this.volume, 0.05);
    Howler.volume(m ? 0 : this.volume);
  }

  /** Subscribe to ducking changes (when host voice should auto-lower behind SFX). */
  onDuckingChange(cb: (ducked: boolean) => void) {
    this.onDuck = cb;
  }

  private setDucking(ducked: boolean) {
    if (ducked === this.duckActive) return;
    this.duckActive = ducked;
    this.onDuck?.(ducked);
  }

  /** Trigger sidechain-style auto duck for `ms` then release. */
  private autoDuck(ms: number) {
    this.setDucking(true);
    if (this.duckTimeout) clearTimeout(this.duckTimeout);
    this.duckTimeout = setTimeout(() => this.setDucking(false), ms);
  }

  async play(id: string): Promise<void> {
    await this.ensureStarted();
    const def = SFX_CATALOG.find(s => s.id === id);
    if (!def) return;
    this.autoDuck(def.duration * 1000 + 150);

    if (def.file) {
      let howl = this.fileCache.get(def.file);
      if (!howl) {
        howl = new Howl({ src: [def.file], volume: this.muted ? 0 : this.volume });
        this.fileCache.set(def.file, howl);
      }
      howl.volume(this.muted ? 0 : this.volume);
      howl.play();
      return;
    }

    this.synth(id);
  }

  /** Play any external audio URL (e.g. user-uploaded jingle). */
  async playUrl(url: string, durationSec = 2): Promise<void> {
    await this.ensureStarted();
    let howl = this.fileCache.get(url);
    if (!howl) {
      howl = new Howl({ src: [url], volume: this.muted ? 0 : this.volume, html5: true });
      this.fileCache.set(url, howl);
    }
    howl.volume(this.muted ? 0 : this.volume);
    howl.play();
    this.autoDuck(durationSec * 1000);
  }

  // ──────────────────────────────────────────────────────────────────
  // Synthesized effects (Tone.js). Routed through this.duckGain.
  // ──────────────────────────────────────────────────────────────────
  private synth(id: string) {
    const dest = this.duckGain!;
    const now = Tone.now();
    switch (id) {
      // ─── Transitions ───
      case 'whoosh': {
        const noise = new Tone.Noise('pink').start(now).stop(now + 0.6);
        const filter = new Tone.Filter({ type: 'bandpass', Q: 4 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0.4, sustain: 0, release: 0.2 }).connect(dest);
        noise.chain(filter, env);
        filter.frequency.setValueAtTime(200, now);
        filter.frequency.exponentialRampToValueAtTime(8000, now + 0.5);
        env.triggerAttackRelease(0.5, now);
        this.cleanup([noise, filter, env], now + 0.8);
        break;
      }
      case 'riser': {
        const osc = new Tone.Oscillator(80, 'sawtooth').start(now).stop(now + 1.2);
        const filter = new Tone.Filter({ type: 'lowpass', frequency: 200, Q: 2 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 1.1, sustain: 0, release: 0.05 }).connect(dest);
        osc.chain(filter, env);
        osc.frequency.exponentialRampTo(2000, 1.1);
        filter.frequency.exponentialRampTo(6000, 1.1);
        env.triggerAttackRelease(1.15, now);
        this.cleanup([osc, filter, env], now + 1.4);
        break;
      }
      case 'downer': {
        const osc = new Tone.Oscillator(800, 'sine').start(now).stop(now + 1);
        const env = new Tone.AmplitudeEnvelope({ attack: 0.02, decay: 1, sustain: 0, release: 0.05 }).connect(dest);
        osc.connect(env);
        osc.frequency.exponentialRampTo(60, 0.95);
        env.triggerAttackRelease(0.95, now);
        this.cleanup([osc, env], now + 1.2);
        break;
      }
      case 'page-turn': {
        const noise = new Tone.Noise('white').start(now).stop(now + 0.4);
        const filter = new Tone.Filter({ type: 'highpass', frequency: 2000 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.35, sustain: 0, release: 0.05 }).connect(dest);
        noise.chain(filter, env);
        env.triggerAttackRelease(0.35, now);
        this.cleanup([noise, filter, env], now + 0.6);
        break;
      }
      case 'tape-stop': {
        const osc = new Tone.Oscillator(440, 'sawtooth').start(now).stop(now + 0.8);
        const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.7, sustain: 0, release: 0.1 }).connect(dest);
        osc.connect(env);
        osc.frequency.exponentialRampTo(40, 0.7);
        env.triggerAttackRelease(0.75, now);
        this.cleanup([osc, env], now + 1);
        break;
      }

      // ─── Reactions ───
      case 'airhorn': {
        const osc1 = new Tone.Oscillator(330, 'sawtooth').start(now).stop(now + 1);
        const osc2 = new Tone.Oscillator(220, 'square').start(now).stop(now + 1);
        const dist = new Tone.Distortion(0.3);
        const env = new Tone.AmplitudeEnvelope({ attack: 0.02, decay: 0.05, sustain: 0.9, release: 0.15 }).connect(dest);
        osc1.connect(dist); osc2.connect(dist); dist.connect(env);
        env.triggerAttackRelease(0.85, now);
        this.cleanup([osc1, osc2, dist, env], now + 1.2);
        break;
      }
      case 'applause': {
        const noise = new Tone.Noise('pink').start(now).stop(now + 2.5);
        const filter = new Tone.Filter({ type: 'bandpass', frequency: 2500, Q: 1 });
        const tremolo = new Tone.Tremolo({ frequency: 18, depth: 0.6 }).start();
        const env = new Tone.AmplitudeEnvelope({ attack: 0.2, decay: 1, sustain: 0.6, release: 1 }).connect(dest);
        noise.chain(filter, tremolo, env);
        env.triggerAttackRelease(2, now);
        this.cleanup([noise, filter, tremolo, env], now + 2.8);
        break;
      }
      case 'cheer': {
        const noise = new Tone.Noise('pink').start(now).stop(now + 2);
        const filter = new Tone.Filter({ type: 'bandpass', frequency: 1500, Q: 0.7 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.3, decay: 0.5, sustain: 0.7, release: 0.7 }).connect(dest);
        noise.chain(filter, env);
        filter.frequency.exponentialRampTo(2500, 1.5);
        env.triggerAttackRelease(1.5, now);
        this.cleanup([noise, filter, env], now + 2.3);
        break;
      }
      case 'boo': {
        const osc = new Tone.Oscillator(180, 'sawtooth').start(now).stop(now + 1.2);
        const filter = new Tone.Filter({ type: 'lowpass', frequency: 400 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.1, decay: 0.4, sustain: 0.5, release: 0.6 }).connect(dest);
        osc.chain(filter, env);
        osc.frequency.exponentialRampTo(120, 1);
        env.triggerAttackRelease(1, now);
        this.cleanup([osc, filter, env], now + 1.4);
        break;
      }
      case 'gasp': {
        const noise = new Tone.Noise('pink').start(now).stop(now + 0.8);
        const filter = new Tone.Filter({ type: 'highpass', frequency: 800 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.15, decay: 0.5, sustain: 0, release: 0.1 }).connect(dest);
        noise.chain(filter, env);
        filter.frequency.exponentialRampTo(3500, 0.5);
        env.triggerAttackRelease(0.6, now);
        this.cleanup([noise, filter, env], now + 1);
        break;
      }
      case 'mind-blown': {
        // Riser → boom
        this.synth('riser');
        setTimeout(() => {
          const osc = new Tone.Oscillator(60, 'sine').start().stop(`+0.5`);
          const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.5, sustain: 0, release: 0.05 }).connect(dest);
          osc.connect(env);
          env.triggerAttackRelease(0.5);
          this.cleanup([osc, env], Tone.now() + 0.7);
        }, 1200);
        break;
      }

      // ─── Comedy ───
      case 'rimshot': {
        const drum = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 6 }).connect(dest);
        drum.triggerAttackRelease('C2', '8n', now);
        drum.triggerAttackRelease('C2', '8n', now + 0.12);
        const cymbal = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.4, release: 0.05 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).connect(dest);
        cymbal.triggerAttackRelease('C5', '16n', now + 0.25);
        this.cleanup([drum, cymbal], now + 1);
        break;
      }
      case 'crickets': {
        const osc = new Tone.Oscillator(4500, 'sine').start(now).stop(now + 3);
        const tremolo = new Tone.Tremolo({ frequency: 12, depth: 1 }).start();
        const env = new Tone.AmplitudeEnvelope({ attack: 0.3, decay: 0, sustain: 0.3, release: 0.5 }).connect(dest);
        osc.chain(tremolo, env);
        env.triggerAttackRelease(2.5, now);
        this.cleanup([osc, tremolo, env], now + 3.2);
        break;
      }
      case 'sad-trombone': {
        const synth = new Tone.Synth({ oscillator: { type: 'sawtooth' }, envelope: { attack: 0.05, decay: 0.2, sustain: 0.7, release: 0.3 } }).connect(dest);
        const notes = ['C4', 'B3', 'A#3', 'A3'];
        notes.forEach((n, i) => synth.triggerAttackRelease(n, 0.45, now + i * 0.5));
        this.cleanup([synth], now + 2.4);
        break;
      }
      case 'laugh-track': {
        const noise = new Tone.Noise('pink').start(now).stop(now + 2);
        const filter = new Tone.Filter({ type: 'bandpass', frequency: 600, Q: 2 });
        const tremolo = new Tone.Tremolo({ frequency: 6, depth: 0.8 }).start();
        const env = new Tone.AmplitudeEnvelope({ attack: 0.1, decay: 0.5, sustain: 0.7, release: 0.5 }).connect(dest);
        noise.chain(filter, tremolo, env);
        env.triggerAttackRelease(1.5, now);
        this.cleanup([noise, filter, tremolo, env], now + 2.3);
        break;
      }
      case 'error': {
        const synth = new Tone.Synth({ oscillator: { type: 'square' } }).connect(dest);
        synth.triggerAttackRelease('A3', 0.15, now);
        synth.triggerAttackRelease('E3', 0.25, now + 0.18);
        this.cleanup([synth], now + 0.6);
        break;
      }
      case 'record-scratch': {
        const osc = new Tone.Oscillator(800, 'sawtooth').start(now).stop(now + 0.7);
        const filter = new Tone.Filter({ type: 'bandpass', frequency: 2000, Q: 8 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 0.6, sustain: 0, release: 0.05 }).connect(dest);
        osc.chain(filter, env);
        osc.frequency.linearRampTo(200, 0.3);
        osc.frequency.linearRampTo(1500, 0.5);
        osc.frequency.linearRampTo(100, 0.7);
        env.triggerAttackRelease(0.65, now);
        this.cleanup([osc, filter, env], now + 0.9);
        break;
      }

      // ─── Stingers ───
      case 'ding': {
        const synth = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.001, decay: 0.4, sustain: 0, release: 0.2 } }).connect(dest);
        synth.triggerAttackRelease('C6', 0.4, now);
        this.cleanup([synth], now + 0.7);
        break;
      }
      case 'chime': {
        const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 1.2, sustain: 0, release: 0.5 } }).connect(dest);
        synth.triggerAttackRelease(['C5', 'E5', 'G5'], 1.2, now);
        this.cleanup([synth], now + 1.6);
        break;
      }
      case 'bell': {
        const synth = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 1.5, release: 0.3 }, harmonicity: 8, modulationIndex: 20, resonance: 2000, octaves: 1.5 }).connect(dest);
        synth.triggerAttackRelease('C5', 1.5, now);
        this.cleanup([synth], now + 2);
        break;
      }
      case 'success': {
        const synth = new Tone.Synth({ oscillator: { type: 'triangle' }, envelope: { attack: 0.005, decay: 0.2, sustain: 0.4, release: 0.3 } }).connect(dest);
        synth.triggerAttackRelease('C5', 0.15, now);
        synth.triggerAttackRelease('E5', 0.15, now + 0.18);
        synth.triggerAttackRelease('G5', 0.4, now + 0.36);
        this.cleanup([synth], now + 1.1);
        break;
      }
      case 'level-up': {
        const synth = new Tone.Synth({ oscillator: { type: 'square' }, envelope: { attack: 0.005, decay: 0.1, sustain: 0.4, release: 0.2 } }).connect(dest);
        const notes = ['C5', 'E5', 'G5', 'C6'];
        notes.forEach((n, i) => synth.triggerAttackRelease(n, 0.12, now + i * 0.12));
        this.cleanup([synth], now + 1.5);
        break;
      }

      // ─── Ambient ───
      case 'suspense': {
        const osc = new Tone.Oscillator(55, 'sine').start(now).stop(now + 4);
        const tremolo = new Tone.Tremolo({ frequency: 0.7, depth: 0.5 }).start();
        const env = new Tone.AmplitudeEnvelope({ attack: 0.5, decay: 0.5, sustain: 0.7, release: 1 }).connect(dest);
        osc.chain(tremolo, env);
        env.triggerAttackRelease(3, now);
        this.cleanup([osc, tremolo, env], now + 4.2);
        break;
      }
      case 'heartbeat': {
        const drum = new Tone.MembraneSynth({ pitchDecay: 0.1, octaves: 4 }).connect(dest);
        for (let i = 0; i < 4; i++) {
          drum.triggerAttackRelease('A1', '16n', now + i * 0.7);
          drum.triggerAttackRelease('A1', '16n', now + i * 0.7 + 0.18);
        }
        this.cleanup([drum], now + 3.2);
        break;
      }
      case 'static': {
        const noise = new Tone.Noise('white').start(now).stop(now + 1.5);
        const filter = new Tone.Filter({ type: 'highpass', frequency: 1500 });
        const env = new Tone.AmplitudeEnvelope({ attack: 0.05, decay: 0.5, sustain: 0.4, release: 0.3 }).connect(dest);
        noise.chain(filter, env);
        env.triggerAttackRelease(1.2, now);
        this.cleanup([noise, filter, env], now + 1.7);
        break;
      }

      // ─── Musical ───
      case 'fanfare': {
        const synth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sawtooth' }, envelope: { attack: 0.01, decay: 0.3, sustain: 0.5, release: 0.4 } }).connect(dest);
        synth.triggerAttackRelease(['C4', 'E4', 'G4'], 0.3, now);
        synth.triggerAttackRelease(['C4', 'E4', 'G4'], 0.3, now + 0.4);
        synth.triggerAttackRelease(['C4', 'E4', 'G4', 'C5'], 1.2, now + 0.8);
        this.cleanup([synth], now + 2.7);
        break;
      }
      case 'jingle': {
        const synth = new Tone.Synth({ oscillator: { type: 'triangle' } }).connect(dest);
        const seq: [string, number][] = [['E5', 0.15], ['G5', 0.15], ['C6', 0.3], ['B5', 0.15], ['G5', 0.15], ['C6', 0.5]];
        let t = now;
        seq.forEach(([note, dur]) => { synth.triggerAttackRelease(note, dur, t); t += dur; });
        this.cleanup([synth], now + 2.2);
        break;
      }
      case 'bass-drop': {
        const osc = new Tone.Oscillator(200, 'sine').start(now).stop(now + 1.8);
        const dist = new Tone.Distortion(0.4);
        const env = new Tone.AmplitudeEnvelope({ attack: 0.005, decay: 1.5, sustain: 0.3, release: 0.3 }).connect(dest);
        osc.chain(dist, env);
        osc.frequency.exponentialRampTo(35, 0.6);
        env.triggerAttackRelease(1.5, now);
        this.cleanup([osc, dist, env], now + 2);
        break;
      }

      default: {
        const synth = new Tone.Synth().connect(dest);
        synth.triggerAttackRelease('C5', '8n', now);
        this.cleanup([synth], now + 0.5);
      }
    }
  }

  private cleanup(nodes: { dispose: () => void }[], at: number) {
    const ms = Math.max(0, (at - Tone.now()) * 1000) + 100;
    setTimeout(() => nodes.forEach(n => { try { n.dispose(); } catch {} }), ms);
  }
}

export const podcastSFX = new PodcastSFXEngine();
