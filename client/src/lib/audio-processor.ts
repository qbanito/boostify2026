/**
 * Audio Processor Engine — Professional audio pipeline for Live Podcast Studio
 * Features: noise gate, compressor, EQ, limiter, gain, level metering
 * Uses Web Audio API for real-time processing
 */

export interface AudioProcessorConfig {
  noiseGateThreshold: number;   // dB (-100 to 0)
  compressorThreshold: number;  // dB (-50 to 0)
  compressorRatio: number;      // 1 to 20
  compressorAttack: number;     // seconds (0.001 to 1)
  compressorRelease: number;    // seconds (0.01 to 1)
  eqLow: number;               // dB gain (-12 to 12) @ 300Hz
  eqMid: number;               // dB gain (-12 to 12) @ 1kHz
  eqHigh: number;              // dB gain (-12 to 12) @ 3kHz
  eqPresence: number;          // dB gain (-12 to 12) @ 5kHz
  limiterThreshold: number;    // dB (-6 to 0)
  gain: number;                // dB (-20 to 20)
  deEsser: boolean;
}

export const DEFAULT_PODCAST_PRESET: AudioProcessorConfig = {
  noiseGateThreshold: -50,
  compressorThreshold: -24,
  compressorRatio: 4,
  compressorAttack: 0.003,
  compressorRelease: 0.25,
  eqLow: -2,        // Slight low cut for cleaner voice
  eqMid: 1,         // Slight warmth
  eqHigh: 2,        // Presence boost
  eqPresence: 3,    // Air/clarity for speech
  limiterThreshold: -1,
  gain: 0,
  deEsser: true,
};

export const PRESETS: Record<string, AudioProcessorConfig> = {
  podcast: DEFAULT_PODCAST_PRESET,
  interview: {
    ...DEFAULT_PODCAST_PRESET,
    compressorThreshold: -20,
    compressorRatio: 3,
    eqHigh: 3,
    eqPresence: 4,
  },
  music: {
    ...DEFAULT_PODCAST_PRESET,
    noiseGateThreshold: -60,
    compressorThreshold: -18,
    compressorRatio: 2,
    eqLow: 2,
    eqMid: 0,
    eqHigh: 1,
    eqPresence: 1,
    gain: 2,
  },
  raw: {
    noiseGateThreshold: -100,
    compressorThreshold: 0,
    compressorRatio: 1,
    compressorAttack: 0.003,
    compressorRelease: 0.25,
    eqLow: 0,
    eqMid: 0,
    eqHigh: 0,
    eqPresence: 0,
    limiterThreshold: 0,
    gain: 0,
    deEsser: false,
  },
};

export interface AudioLevels {
  peak: number;     // 0 to 1
  rms: number;      // 0 to 1
  clipping: boolean;
}

export class AudioProcessor {
  private ctx: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private destinationNode: MediaStreamAudioDestinationNode | null = null;

  // Processing nodes
  private inputGain: GainNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private noiseGate: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  private eqPresence: BiquadFilterNode | null = null;
  private deEsserFilter: BiquadFilterNode | null = null;
  private limiter: DynamicsCompressorNode | null = null;
  private outputGain: GainNode | null = null;

  // Metering
  private analyser: AnalyserNode | null = null;
  private analyserData: Float32Array<ArrayBuffer> | null = null;
  private meterCallback: ((levels: AudioLevels) => void) | null = null;
  private meterInterval: ReturnType<typeof setInterval> | null = null;

  // Noise gate state
  private gateOpen = false;
  private gateAttackTime = 0.005;
  private gateReleaseTime = 0.05;

  private config: AudioProcessorConfig = DEFAULT_PODCAST_PRESET;

  getProcessedStream(inputStream: MediaStream, config?: Partial<AudioProcessorConfig>): MediaStream {
    this.cleanup();

    if (config) {
      this.config = { ...DEFAULT_PODCAST_PRESET, ...config };
    }

    this.ctx = new AudioContext({ sampleRate: 48000 });
    this.sourceNode = this.ctx.createMediaStreamSource(inputStream);
    this.destinationNode = this.ctx.createMediaStreamDestination();

    // Build processing chain
    this.buildChain();

    return this.destinationNode.stream;
  }

  private buildChain(): void {
    if (!this.ctx || !this.sourceNode || !this.destinationNode) return;

    const cfg = this.config;

    // 1. Input gain
    this.inputGain = this.ctx.createGain();
    this.inputGain.gain.value = 1.0;

    // 2. High-pass filter (remove rumble below 80Hz)
    this.highPassFilter = this.ctx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 80;
    this.highPassFilter.Q.value = 0.7;

    // 3. Noise gate (implemented as a gain node controlled by analyser)
    this.noiseGate = this.ctx.createGain();
    this.noiseGate.gain.value = 1.0;

    // 4. Compressor
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = cfg.compressorThreshold;
    this.compressor.ratio.value = cfg.compressorRatio;
    this.compressor.attack.value = cfg.compressorAttack;
    this.compressor.release.value = cfg.compressorRelease;
    this.compressor.knee.value = 6;

    // 5. EQ Band: Low shelf @ 300Hz
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 300;
    this.eqLow.gain.value = cfg.eqLow;

    // 6. EQ Band: Peaking @ 1kHz (warmth)
    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 1000;
    this.eqMid.Q.value = 1.0;
    this.eqMid.gain.value = cfg.eqMid;

    // 7. EQ Band: Peaking @ 3kHz (presence)
    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'peaking';
    this.eqHigh.frequency.value = 3000;
    this.eqHigh.Q.value = 1.0;
    this.eqHigh.gain.value = cfg.eqHigh;

    // 8. EQ Band: High shelf @ 5kHz (air)
    this.eqPresence = this.ctx.createBiquadFilter();
    this.eqPresence.type = 'highshelf';
    this.eqPresence.frequency.value = 5000;
    this.eqPresence.gain.value = cfg.eqPresence;

    // 9. De-esser (narrow notch at 6-8kHz sibilance range)
    this.deEsserFilter = this.ctx.createBiquadFilter();
    this.deEsserFilter.type = 'peaking';
    this.deEsserFilter.frequency.value = 7000;
    this.deEsserFilter.Q.value = 2.0;
    this.deEsserFilter.gain.value = cfg.deEsser ? -6 : 0;

    // 10. Limiter (brick-wall limiter as compressor with high ratio)
    this.limiter = this.ctx.createDynamicsCompressor();
    this.limiter.threshold.value = cfg.limiterThreshold;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.001;
    this.limiter.release.value = 0.01;
    this.limiter.knee.value = 0;

    // 11. Output gain
    this.outputGain = this.ctx.createGain();
    this.outputGain.gain.value = Math.pow(10, cfg.gain / 20); // dB to linear

    // 12. Analyser for metering
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.analyserData = new Float32Array(this.analyser.fftSize) as Float32Array<ArrayBuffer>;

    // Connect chain: source → inputGain → HPF → noiseGate → compressor → EQ → de-esser → limiter → outputGain → analyser → destination
    this.sourceNode.connect(this.inputGain);
    this.inputGain.connect(this.highPassFilter);
    this.highPassFilter.connect(this.noiseGate);
    this.noiseGate.connect(this.compressor);
    this.compressor.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.eqPresence);
    this.eqPresence.connect(this.deEsserFilter);
    this.deEsserFilter.connect(this.limiter);
    this.limiter.connect(this.outputGain);
    this.outputGain.connect(this.analyser);
    this.analyser.connect(this.destinationNode);

    // Start noise gate processing
    this.startNoiseGateProcessing();
  }

  private startNoiseGateProcessing(): void {
    if (!this.ctx || !this.analyser || !this.analyserData || !this.noiseGate) return;

    const threshold = Math.pow(10, this.config.noiseGateThreshold / 20);
    const checkGate = () => {
      if (!this.analyser || !this.analyserData || !this.noiseGate || !this.ctx) return;

      this.analyser.getFloatTimeDomainData(this.analyserData);

      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        sum += this.analyserData[i] * this.analyserData[i];
      }
      const rms = Math.sqrt(sum / this.analyserData.length);

      const now = this.ctx.currentTime;
      if (rms > threshold) {
        if (!this.gateOpen) {
          this.noiseGate.gain.setTargetAtTime(1.0, now, this.gateAttackTime);
          this.gateOpen = true;
        }
      } else {
        if (this.gateOpen) {
          this.noiseGate.gain.setTargetAtTime(0.0, now, this.gateReleaseTime);
          this.gateOpen = false;
        }
      }
    };

    // Check gate at ~60Hz
    this.meterInterval = setInterval(checkGate, 16);
  }

  updateConfig(updates: Partial<AudioProcessorConfig>): void {
    this.config = { ...this.config, ...updates };

    if (this.compressor) {
      this.compressor.threshold.value = this.config.compressorThreshold;
      this.compressor.ratio.value = this.config.compressorRatio;
      this.compressor.attack.value = this.config.compressorAttack;
      this.compressor.release.value = this.config.compressorRelease;
    }
    if (this.eqLow) this.eqLow.gain.value = this.config.eqLow;
    if (this.eqMid) this.eqMid.gain.value = this.config.eqMid;
    if (this.eqHigh) this.eqHigh.gain.value = this.config.eqHigh;
    if (this.eqPresence) this.eqPresence.gain.value = this.config.eqPresence;
    if (this.deEsserFilter) this.deEsserFilter.gain.value = this.config.deEsser ? -6 : 0;
    if (this.limiter) this.limiter.threshold.value = this.config.limiterThreshold;
    if (this.outputGain) {
      this.outputGain.gain.value = Math.pow(10, this.config.gain / 20);
    }
  }

  getConfig(): AudioProcessorConfig {
    return { ...this.config };
  }

  getLevels(): AudioLevels {
    if (!this.analyser || !this.analyserData) {
      return { peak: 0, rms: 0, clipping: false };
    }

    this.analyser.getFloatTimeDomainData(this.analyserData);

    let peak = 0;
    let sum = 0;
    for (let i = 0; i < this.analyserData.length; i++) {
      const abs = Math.abs(this.analyserData[i]);
      if (abs > peak) peak = abs;
      sum += this.analyserData[i] * this.analyserData[i];
    }
    const rms = Math.sqrt(sum / this.analyserData.length);

    return {
      peak: Math.min(peak, 1),
      rms: Math.min(rms, 1),
      clipping: peak >= 0.99,
    };
  }

  onLevels(callback: (levels: AudioLevels) => void): void {
    this.meterCallback = callback;
  }

  cleanup(): void {
    if (this.meterInterval) {
      clearInterval(this.meterInterval);
      this.meterInterval = null;
    }
    [
      this.sourceNode, this.inputGain, this.highPassFilter,
      this.noiseGate, this.compressor, this.eqLow, this.eqMid,
      this.eqHigh, this.eqPresence, this.deEsserFilter,
      this.limiter, this.outputGain, this.analyser,
    ].forEach(node => {
      try { node?.disconnect(); } catch {}
    });

    this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.sourceNode = null;
    this.destinationNode = null;
  }
}
