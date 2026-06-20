// ─── Audio Sync Engine ────────────────────────────────────────────────────────
// Handles audio playback sync with the show timeline using Web Audio API.

export interface AudioSyncState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  bpm: number;
  beat: number;        // current beat count
  bar: number;         // current bar (4 beats)
  progress: number;    // 0-1
}

class AudioSyncEngine {
  private audioContext: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private startTime = 0;
  private pauseOffset = 0;
  private isPlaying = false;
  private bpm = 120;
  private volume = 0.8;

  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  async loadAudioUrl(url: string): Promise<boolean> {
    try {
      const ctx = this.ensureContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.currentBuffer = await ctx.decodeAudioData(arrayBuffer);
      return true;
    } catch {
      return false;
    }
  }

  play(offset = 0): void {
    if (!this.currentBuffer) return;
    const ctx = this.ensureContext();
    this.stop();

    this.gainNode = ctx.createGain();
    this.gainNode.gain.value = this.volume;
    this.gainNode.connect(ctx.destination);

    this.source = ctx.createBufferSource();
    this.source.buffer = this.currentBuffer;
    this.source.connect(this.gainNode);
    this.source.start(0, offset);

    this.startTime = ctx.currentTime - offset;
    this.pauseOffset = offset;
    this.isPlaying = true;
  }

  pause(): void {
    if (!this.isPlaying || !this.audioContext || !this.source) return;
    this.pauseOffset = this.audioContext.currentTime - this.startTime;
    this.source.stop();
    this.isPlaying = false;
  }

  resume(): void {
    this.play(this.pauseOffset);
  }

  stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch { /* already stopped */ }
      this.source = null;
    }
    this.pauseOffset = 0;
    this.isPlaying = false;
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.gainNode) {
      this.gainNode.gain.value = this.volume;
    }
  }

  setBpm(bpm: number): void {
    this.bpm = bpm;
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) return this.pauseOffset;
    return this.audioContext.currentTime - this.startTime;
  }

  getDuration(): number {
    return this.currentBuffer?.duration ?? 0;
  }

  getState(): AudioSyncState {
    const currentTime = this.getCurrentTime();
    const duration = this.getDuration();
    const beatInterval = 60 / this.bpm;
    const beat = Math.floor(currentTime / beatInterval);
    return {
      isPlaying: this.isPlaying,
      currentTime,
      duration,
      volume: this.volume,
      bpm: this.bpm,
      beat,
      bar: Math.floor(beat / 4),
      progress: duration > 0 ? currentTime / duration : 0,
    };
  }
}

export const audioSyncEngine = new AudioSyncEngine();

/**
 * Formats seconds to MM:SS
 */
export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
