// ────────────────────────────────────────────────────────────────────────
// Mini Studio — real Web Audio DSP engine
// A self-contained, framework-agnostic audio layer used by MiniStudio.tsx.
// Provides per-channel DSP strips (HP filter, 3-band EQ, compressor,
// saturation, reverb, delay, limiter, pan, gain) with per-channel metering,
// plus master loudness measurement and offline WAV export.
// ────────────────────────────────────────────────────────────────────────

export type PluginKind =
  | 'eq' | 'compressor' | 'reverb' | 'delay'
  | 'pitch' | 'noise' | 'saturation' | 'limiter';

export interface PluginLike {
  type: PluginKind;
  enabled: boolean;
  params: Record<string, number | string>;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
const num = (v: number | string | undefined, fallback: number): number => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n as number) ? (n as number) : fallback;
};

// Convert a tempo-relative note value (e.g. "1/4") into seconds.
export function noteToSeconds(note: number | string | undefined, bpm: number): number {
  const beat = 60 / Math.max(1, bpm);
  if (typeof note === 'number') return clamp(note, 0.01, 2);
  switch (String(note)) {
    case '1/2': return beat * 2;
    case '1/4': return beat;
    case '1/8': return beat / 2;
    case '1/8d': return (beat / 2) * 1.5;
    case '1/16': return beat / 4;
    case '1/4t': return (beat * 2) / 3;
    default: return beat; // default quarter note
  }
}

// Soft-clipping curve for the saturation/warmth stage.
function makeSaturationCurve(driveAmount: number): Float32Array {
  const k = clamp(driveAmount, 0, 100) * 0.6; // 0..60
  const n = 1024;
  const curve = new Float32Array(n);
  const deg = Math.PI / 180;
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}

// Synthetic exponential-decay impulse response for the convolution reverb.
function makeImpulseResponse(ctx: BaseAudioContext, seconds: number, decay: number): AudioBuffer {
  const rate = ctx.sampleRate;
  const length = Math.max(1, Math.floor(rate * clamp(seconds, 0.1, 8)));
  const impulse = ctx.createBuffer(2, length, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = impulse.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, clamp(decay, 0.5, 8));
    }
  }
  return impulse;
}

export interface ChannelStripOptions {
  bpm?: number;
  withAnalyser?: boolean;
}

// A full DSP channel strip. The input node is what you connect a source to;
// the output node is what you connect to the master bus (or destination).
export class ChannelStrip {
  readonly input: GainNode;
  readonly output: GainNode;
  readonly analyser: AnalyserNode | null;

  private ctx: BaseAudioContext;
  private bpm: number;

  private hp: BiquadFilterNode;
  private eqLow: BiquadFilterNode;
  private eqMid: BiquadFilterNode;
  private eqHigh: BiquadFilterNode;
  private comp: DynamicsCompressorNode;
  private saturator: WaveShaperNode;
  private satMakeup: GainNode;
  private dry: GainNode;
  private reverb: ConvolverNode;
  private reverbWet: GainNode;
  private delay: DelayNode;
  private delayFeedback: GainNode;
  private delayWet: GainNode;
  private sum: GainNode;
  private limiter: DynamicsCompressorNode;
  private limiterMakeup: GainNode;
  private panner: StereoPannerNode;
  private channelGain: GainNode;

  private reverbDecayCache = -1;
  private reverbSizeCache = -1;

  constructor(ctx: BaseAudioContext, opts: ChannelStripOptions = {}) {
    this.ctx = ctx;
    this.bpm = opts.bpm ?? 120;

    this.input = ctx.createGain();
    this.hp = ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 20;
    this.eqLow = ctx.createBiquadFilter(); this.eqLow.type = 'lowshelf'; this.eqLow.frequency.value = 120;
    this.eqMid = ctx.createBiquadFilter(); this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1000; this.eqMid.Q.value = 0.9;
    this.eqHigh = ctx.createBiquadFilter(); this.eqHigh.type = 'highshelf'; this.eqHigh.frequency.value = 8000;
    this.comp = ctx.createDynamicsCompressor();
    this.saturator = ctx.createWaveShaper(); this.saturator.curve = null; this.saturator.oversample = '2x';
    this.satMakeup = ctx.createGain();
    this.dry = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverbWet = ctx.createGain(); this.reverbWet.gain.value = 0;
    this.delay = ctx.createDelay(2.0);
    this.delayFeedback = ctx.createGain(); this.delayFeedback.gain.value = 0;
    this.delayWet = ctx.createGain(); this.delayWet.gain.value = 0;
    this.sum = ctx.createGain();
    this.limiter = ctx.createDynamicsCompressor();
    this.limiter.ratio.value = 20; this.limiter.attack.value = 0.003; this.limiter.release.value = 0.08;
    this.limiterMakeup = ctx.createGain();
    this.panner = ctx.createStereoPanner();
    this.channelGain = ctx.createGain();
    this.output = ctx.createGain();
    this.analyser = opts.withAnalyser !== false ? ctx.createAnalyser() : null;
    if (this.analyser) this.analyser.fftSize = 256;

    // Series chain → split into dry + parallel reverb/delay sends → sum.
    this.input.connect(this.hp);
    this.hp.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    this.eqHigh.connect(this.comp);
    this.comp.connect(this.saturator);
    this.saturator.connect(this.satMakeup);

    this.satMakeup.connect(this.dry);
    this.dry.connect(this.sum);

    // Reverb send (parallel)
    this.satMakeup.connect(this.reverb);
    this.reverb.connect(this.reverbWet);
    this.reverbWet.connect(this.sum);

    // Delay send (parallel, with feedback loop)
    this.satMakeup.connect(this.delay);
    this.delay.connect(this.delayFeedback);
    this.delayFeedback.connect(this.delay);
    this.delay.connect(this.delayWet);
    this.delayWet.connect(this.sum);

    this.sum.connect(this.limiter);
    this.limiter.connect(this.limiterMakeup);
    this.limiterMakeup.connect(this.panner);
    this.panner.connect(this.channelGain);
    this.channelGain.connect(this.output);
    if (this.analyser) this.channelGain.connect(this.analyser);

    // Neutral defaults (bypass everything until plugins are applied).
    this.bypassDefaults();
  }

  private bypassDefaults() {
    this.eqLow.gain.value = 0;
    this.eqMid.gain.value = 0;
    this.eqHigh.gain.value = 0;
    this.comp.threshold.value = 0; this.comp.ratio.value = 1;
    this.saturator.curve = null;
    this.satMakeup.gain.value = 1;
    this.dry.gain.value = 1;
    this.reverbWet.gain.value = 0;
    this.delayWet.gain.value = 0;
    this.delayFeedback.gain.value = 0;
    this.limiter.threshold.value = 0; this.limiter.ratio.value = 1;
    this.limiterMakeup.gain.value = 1;
    this.panner.pan.value = 0;
    this.channelGain.gain.value = 1;
  }

  setBpm(bpm: number) { this.bpm = bpm; }

  // pan: -1..1, gain: 0..1
  setPan(pan: number) { this.panner.pan.value = clamp(pan, -1, 1); }
  setGain(gain: number, ramp = false) {
    const g = clamp(gain, 0, 1.5);
    if (ramp && (this.ctx as AudioContext).currentTime !== undefined) {
      const t = this.ctx.currentTime;
      this.channelGain.gain.setTargetAtTime(g, t, 0.02);
    } else {
      this.channelGain.gain.value = g;
    }
  }

  // Apply an array of plugin states to the strip's nodes. Disabled or absent
  // plugins fall back to a transparent (bypass) setting.
  applyPlugins(plugins: PluginLike[]) {
    const byType = new Map<PluginKind, PluginLike>();
    for (const p of plugins) if (p.enabled) byType.set(p.type, p);

    // EQ
    const eq = byType.get('eq');
    if (eq) {
      this.eqLow.gain.value = clamp(num(eq.params.low, 0), -24, 24);
      this.eqMid.gain.value = clamp(num(eq.params.mid, 0), -24, 24);
      this.eqHigh.gain.value = clamp(num(eq.params.high, 0), -24, 24);
      this.hp.frequency.value = clamp(num(eq.params.hp, 20), 20, 400);
    } else {
      this.eqLow.gain.value = 0; this.eqMid.gain.value = 0; this.eqHigh.gain.value = 0;
      this.hp.frequency.value = 20;
    }

    // Compressor
    const comp = byType.get('compressor');
    if (comp) {
      this.comp.threshold.value = clamp(num(comp.params.threshold, -16), -60, 0);
      this.comp.ratio.value = clamp(num(comp.params.ratio, 3), 1, 20);
      this.comp.attack.value = clamp(num(comp.params.attack, 10) / 1000, 0, 1);
      this.comp.release.value = clamp(num(comp.params.release, 120) / 1000, 0, 1);
      this.satMakeup.gain.value = Math.pow(10, clamp(num(comp.params.makeup, 0), 0, 24) / 20);
    } else {
      this.comp.threshold.value = 0; this.comp.ratio.value = 1;
      this.satMakeup.gain.value = 1;
    }

    // Saturation (series soft-clip with wet/dry blend via curve intensity)
    const sat = byType.get('saturation');
    if (sat) {
      const drive = num(sat.params.drive, 15);
      const mix = clamp(num(sat.params.mix, 45), 0, 100) / 100;
      this.saturator.curve = makeSaturationCurve(drive * mix);
    } else {
      this.saturator.curve = null;
    }

    // Reverb
    const rev = byType.get('reverb');
    if (rev) {
      const size = clamp(num(rev.params.size, 65), 0, 100);
      const decay = clamp(num(rev.params.decay, 2.4), 0.2, 8);
      const mix = clamp(num(rev.params.mix, 24), 0, 100) / 100;
      const seconds = 0.3 + (size / 100) * 4;
      if (Math.abs(size - this.reverbSizeCache) > 0.5 || Math.abs(decay - this.reverbDecayCache) > 0.05) {
        this.reverb.buffer = makeImpulseResponse(this.ctx, seconds, decay);
        this.reverbSizeCache = size;
        this.reverbDecayCache = decay;
      }
      this.reverbWet.gain.value = mix * 0.9;
      this.dry.gain.value = 1 - mix * 0.4;
    } else {
      this.reverbWet.gain.value = 0;
      this.dry.gain.value = 1;
    }

    // Delay
    const dly = byType.get('delay');
    if (dly) {
      this.delay.delayTime.value = clamp(noteToSeconds(dly.params.time, this.bpm), 0.01, 2);
      this.delayFeedback.gain.value = clamp(num(dly.params.feedback, 30) / 100, 0, 0.85);
      this.delayWet.gain.value = clamp(num(dly.params.mix, 18) / 100, 0, 1) * 0.9;
    } else {
      this.delayFeedback.gain.value = 0;
      this.delayWet.gain.value = 0;
    }

    // Limiter
    const lim = byType.get('limiter');
    if (lim) {
      this.limiter.threshold.value = clamp(num(lim.params.threshold, -1), -24, 0);
      this.limiter.ratio.value = 20;
      this.limiter.release.value = clamp(num(lim.params.release, 80) / 1000, 0, 1);
      this.limiterMakeup.gain.value = Math.pow(10, clamp(num(lim.params.output, -0.1), -12, 0) / 20) + 0.0;
    } else {
      this.limiter.threshold.value = 0; this.limiter.ratio.value = 1;
      this.limiterMakeup.gain.value = 1;
    }
    // 'pitch' and 'noise' have no native real-time DSP equivalent here; they are
    // applied server-side during generation/mastering and left transparent.
  }

  // Instantaneous RMS level (0..1) for metering.
  getLevel(): number {
    if (!this.analyser) return 0;
    const buf = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    return clamp(Math.sqrt(sum / buf.length) * 2.2, 0, 1);
  }

  disconnect() {
    [this.input, this.hp, this.eqLow, this.eqMid, this.eqHigh, this.comp, this.saturator,
     this.satMakeup, this.dry, this.reverb, this.reverbWet, this.delay, this.delayFeedback,
     this.delayWet, this.sum, this.limiter, this.limiterMakeup, this.panner, this.channelGain,
     this.output].forEach((n) => { try { n.disconnect(); } catch {} });
    if (this.analyser) { try { this.analyser.disconnect(); } catch {} }
  }
}

// ── Loudness metering ─────────────────────────────────────────────────────
// Lightweight integrated-loudness estimate (approximate LUFS) + true-peak.
export class LoudnessMeter {
  readonly analyser: AnalyserNode;
  private buf: Float32Array;
  private sumSquares = 0;
  private blocks = 0;
  private peak = 0;

  constructor(ctx: BaseAudioContext) {
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.buf = new Float32Array(this.analyser.fftSize);
  }

  // Call periodically while playing to integrate loudness.
  sample(): { momentaryLufs: number; integratedLufs: number; truePeakDb: number } {
    this.analyser.getFloatTimeDomainData(this.buf);
    let sq = 0;
    let blockPeak = 0;
    for (let i = 0; i < this.buf.length; i++) {
      const v = this.buf[i];
      sq += v * v;
      const a = Math.abs(v);
      if (a > blockPeak) blockPeak = a;
    }
    const meanSq = sq / this.buf.length;
    this.sumSquares += meanSq;
    this.blocks += 1;
    if (blockPeak > this.peak) this.peak = blockPeak;

    const momentary = meanSq > 1e-9 ? -0.691 + 10 * Math.log10(meanSq) : -70;
    const integratedMean = this.sumSquares / Math.max(1, this.blocks);
    const integrated = integratedMean > 1e-9 ? -0.691 + 10 * Math.log10(integratedMean) : -70;
    const truePeakDb = this.peak > 1e-6 ? 20 * Math.log10(this.peak) : -70;
    return {
      momentaryLufs: Math.round(momentary * 10) / 10,
      integratedLufs: Math.round(integrated * 10) / 10,
      truePeakDb: Math.round(truePeakDb * 10) / 10,
    };
  }

  reset() { this.sumSquares = 0; this.blocks = 0; this.peak = 0; }
}

// ── Waveform peaks from a real decoded buffer ─────────────────────────────
export async function decodePeaks(ctx: AudioContext, audioUrl: string, bins = 200): Promise<number[]> {
  const res = await fetch(audioUrl, { mode: 'cors' });
  const arr = await res.arrayBuffer();
  const buffer = await ctx.decodeAudioData(arr.slice(0));
  const channel = buffer.getChannelData(0);
  const block = Math.floor(channel.length / bins) || 1;
  const peaks: number[] = [];
  for (let i = 0; i < bins; i++) {
    let max = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(channel[start + j] || 0);
      if (v > max) max = v;
    }
    peaks.push(max);
  }
  return peaks;
}

// ── Offline WAV export ────────────────────────────────────────────────────
// Renders an audio source through an optional master chain offline and returns
// a WAV Blob — a real, downloadable export with no backend render worker.
export interface ExportOptions {
  plugins?: PluginLike[];
  gain?: number;       // 0..1.5 master gain
  bpm?: number;
  sampleRate?: number;
}

export async function renderUrlToWav(audioUrl: string, opts: ExportOptions = {}): Promise<Blob> {
  const probe = new (window.AudioContext || (window as any).webkitAudioContext)();
  let decoded: AudioBuffer;
  try {
    const res = await fetch(audioUrl, { mode: 'cors' });
    const arr = await res.arrayBuffer();
    decoded = await probe.decodeAudioData(arr.slice(0));
  } finally {
    void probe.close();
  }

  const sampleRate = opts.sampleRate || decoded.sampleRate;
  const offline = new OfflineAudioContext(2, Math.ceil(decoded.duration * sampleRate), sampleRate);
  const source = offline.createBufferSource();
  source.buffer = decoded;

  const strip = new ChannelStrip(offline, { bpm: opts.bpm, withAnalyser: false });
  if (opts.plugins) strip.applyPlugins(opts.plugins);
  strip.setGain(opts.gain ?? 1);
  source.connect(strip.input);
  strip.output.connect(offline.destination);
  source.start(0);

  const rendered = await offline.startRendering();
  return encodeWav(rendered);
}

// Encode an AudioBuffer into a 16-bit PCM WAV Blob.
export function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const numFrames = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);          // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 8 * bytesPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const channels: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) channels.push(buffer.getChannelData(ch));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channels[ch][i];
      sample = Math.max(-1, Math.min(1, sample));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: 'audio/wav' });
}
