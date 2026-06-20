/**
 * Mini Studio — Generation + DAW backend service
 * --------------------------------------------------------------
 * Wraps FAL.ai (already installed) and Replicate for audio
 * generation primitives used by the Mini Studio DAW UI:
 *   - beats / basslines / synths / pads / hooks / fx / intros / outros
 *   - remix versions
 *   - mastering presets metadata
 *   - stem separation (delegates to voice-ai-service)
 *
 * All functions degrade gracefully when API keys are absent so
 * the UI keeps working in dev with placeholder audio.
 */

import * as fal from '@fal-ai/serverless-client';
import Replicate from 'replicate';

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const REPLICATE_KEY = process.env.REPLICATE_API_TOKEN || '';

if (FAL_KEY) {
  try {
    fal.config({ credentials: FAL_KEY });
  } catch (e) {
    console.warn('[mini-studio] FAL config failed:', (e as Error).message);
  }
}

const replicate = REPLICATE_KEY ? new Replicate({ auth: REPLICATE_KEY }) : null;

// ---------------------------------------------------------------
// Types
// ---------------------------------------------------------------

export type MSGenerationKind =
  | 'beat'
  | 'bassline'
  | 'synth'
  | 'pad'
  | 'vocal'
  | 'hook'
  | 'fx'
  | 'intro'
  | 'outro'
  | 'remix';

export interface MSGenerationRequest {
  kind: MSGenerationKind;
  prompt?: string;
  bpm?: number;
  key?: string;
  bars?: number;
  durationSec?: number;
  reference?: string; // optional reference audio URL
  styleTags?: string[];
}

export interface MSGenerationResult {
  success: boolean;
  kind: MSGenerationKind;
  audioUrl: string;
  durationSec: number;
  bpm: number;
  key: string;
  provider: 'fal' | 'replicate' | 'placeholder';
  meta?: Record<string, any>;
}

// ---------------------------------------------------------------
// Prompt templates per kind
// ---------------------------------------------------------------

const KIND_PROMPTS: Record<MSGenerationKind, (r: MSGenerationRequest) => string> = {
  beat: (r) =>
    r.prompt ||
    `Punchy modern ${r.styleTags?.join(' ') || 'deep house'} drum loop, kick + snare + hats + percussion, ${r.bpm || 122} BPM, ${r.bars || 8} bars, club-ready mix, no melody.`,
  bassline: (r) =>
    r.prompt ||
    `Sub bassline, ${r.styleTags?.join(' ') || 'house'}, ${r.bpm || 122} BPM in ${r.key || 'A minor'}, groovy and rhythmic, ${r.bars || 8} bars.`,
  synth: (r) =>
    r.prompt ||
    `Atmospheric synth pad layer, ${r.styleTags?.join(' ') || 'cinematic warm analog'}, ${r.bpm || 122} BPM, ${r.key || 'A minor'}, evolving texture.`,
  pad: (r) =>
    r.prompt ||
    `Lush ambient pad, ${r.styleTags?.join(' ') || 'ethereal'}, ${r.key || 'A minor'}, ${r.durationSec || 30}s.`,
  vocal: (r) =>
    r.prompt ||
    `Female angelic lead vocal, ${r.styleTags?.join(' ') || 'pop'}, expressive phrasing, in ${r.key || 'A minor'}, dry recording.`,
  hook: (r) =>
    r.prompt ||
    `Catchy melodic hook, ${r.styleTags?.join(' ') || 'pop'}, ${r.bpm || 122} BPM in ${r.key || 'A minor'}, 4 bars.`,
  fx: (r) =>
    r.prompt ||
    `Whoosh impact transition FX, cinematic riser into hit, ${r.durationSec || 4}s.`,
  intro: (r) =>
    r.prompt ||
    `Intro for a ${r.styleTags?.join(' ') || 'pop'} song, ${r.bpm || 122} BPM, in ${r.key || 'A minor'}, ${r.bars || 16} bars build-up.`,
  outro: (r) =>
    r.prompt ||
    `Outro fade-out for a ${r.styleTags?.join(' ') || 'pop'} song, ${r.bpm || 122} BPM, in ${r.key || 'A minor'}, ${r.bars || 16} bars.`,
  remix: (r) =>
    r.prompt ||
    `Club remix version, ${r.styleTags?.join(' ') || 'tech house'}, ${r.bpm || 124} BPM in ${r.key || 'A minor'}, danceable groove.`,
};

// ---------------------------------------------------------------
// Generator
// ---------------------------------------------------------------

export async function generateAudio(req: MSGenerationRequest): Promise<MSGenerationResult> {
  const prompt = KIND_PROMPTS[req.kind](req);
  const durationSec = Math.min(Math.max(req.durationSec || 15, 3), 47);
  const bpm = req.bpm || 122;
  const key = req.key || 'A minor';

  // Strategy 1 — FAL stable-audio if available
  if (FAL_KEY) {
    try {
      const result: any = await fal.subscribe('fal-ai/stable-audio', {
        input: {
          prompt,
          seconds_total: durationSec,
        },
        logs: false,
      });
      const audioUrl: string | undefined =
        result?.audio_file?.url || result?.audio?.url || result?.url;
      if (audioUrl) {
        return {
          success: true,
          kind: req.kind,
          audioUrl,
          durationSec,
          bpm,
          key,
          provider: 'fal',
          meta: { model: 'fal-ai/stable-audio', prompt },
        };
      }
    } catch (err) {
      console.warn('[mini-studio] FAL audio gen failed, falling back:', (err as Error).message);
    }
  }

  // Strategy 2 — Replicate (Meta MusicGen) if available
  if (replicate) {
    try {
      const output: any = await replicate.run(
        'meta/musicgen:b05b1dff1d8c6dc63d14b0cdb42135378dcb87f6373b0d3d341ede46e59e2b38',
        {
          input: {
            prompt,
            duration: durationSec,
            output_format: 'mp3',
            normalization_strategy: 'loudness',
          },
        }
      );
      const audioUrl: string | undefined =
        typeof output === 'string' ? output : output?.[0] || output?.audio || output?.url;
      if (audioUrl) {
        return {
          success: true,
          kind: req.kind,
          audioUrl,
          durationSec,
          bpm,
          key,
          provider: 'replicate',
          meta: { model: 'meta/musicgen', prompt },
        };
      }
    } catch (err) {
      console.warn('[mini-studio] Replicate musicgen failed, falling back:', (err as Error).message);
    }
  }

  // Strategy 3 — Placeholder (silent dev mode)
  return {
    success: true,
    kind: req.kind,
    audioUrl: `https://cdn.boostify.local/placeholder/${req.kind}.mp3`,
    durationSec,
    bpm,
    key,
    provider: 'placeholder',
    meta: { prompt, note: 'No FAL_KEY or REPLICATE_API_TOKEN configured.' },
  };
}

// ---------------------------------------------------------------
// Mastering presets
// ---------------------------------------------------------------

export interface MasteringPreset {
  id: string;
  name: string;
  targetLufs: number;
  truePeakDb: number;
  description: string;
}

export const MASTERING_PRESETS: MasteringPreset[] = [
  { id: 'spotify', name: 'Spotify', targetLufs: -14, truePeakDb: -1.0, description: 'Optimized for Spotify normalization' },
  { id: 'youtube', name: 'YouTube', targetLufs: -14, truePeakDb: -1.0, description: 'Optimized for YouTube' },
  { id: 'tiktok', name: 'TikTok', targetLufs: -10, truePeakDb: -1.0, description: 'Loud + punchy for TikTok feeds' },
  { id: 'club', name: 'Club', targetLufs: -8, truePeakDb: -0.3, description: 'Maximum loudness for club PA' },
  { id: 'radio', name: 'Radio', targetLufs: -16, truePeakDb: -2.0, description: 'Broadcast-safe radio master' },
];

export function getMasteringPreset(id: string): MasteringPreset | undefined {
  return MASTERING_PRESETS.find((p) => p.id === id);
}

// ---------------------------------------------------------------
// Quick action prompts for AI agents
// ---------------------------------------------------------------

export const AGENT_QUICK_ACTIONS = {
  generateBeat: (style?: string, bpm?: number) =>
    ({ kind: 'beat', styleTags: style ? [style] : undefined, bpm }) as MSGenerationRequest,
  writeLyrics: (topic: string, genre?: string) => ({ topic, genre }),
  improveVocal: (audioUrl: string) => ({ audioUrl, mode: 'pitch+denoise+presence' }),
  separateStems: (audioUrl: string) => ({ audioUrl, mode: '4-stem' }),
  mixSong: (projectId: string) => ({ projectId, mode: 'auto-mix' }),
  masterTrack: (projectId: string, presetId = 'spotify') => ({ projectId, presetId }),
  createTikTokVersion: (projectId: string) => ({ projectId, target: 'tiktok-30s' }),
  prepareRelease: (projectId: string) => ({ projectId, channels: ['distrokid', 'tunecore', 'spotify-for-artists'] }),
};
