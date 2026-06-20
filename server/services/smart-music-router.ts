/**
 * Smart Music Router — Boostify internal engine selector.
 * 
 * The user NEVER sees model names. The router picks the best engine
 * based on the request parameters and falls back automatically.
 * 
 * Priority order (as of 2026):
 *   1. Lyria 3 Pro  — best quality, full songs with vocals
 *   2. MiniMax v2   — fast vocals + custom lyrics support
 *   3. Stable Audio — instrumentals and atmospheric tracks
 */

import { generateMusicWithLyria3, type Lyria3CompositionParams } from './lyria3-service';
import { generateMusicWithMiniMax } from './fal-service';
import { log } from '../vite';

export interface SmartMusicRequest {
  title: string;
  genre: string;
  mood: string;
  language: string;
  isInstrumental: boolean;
  customLyrics?: string;
  originalVerse?: string; // artist's own line used as seed
}

export interface SmartMusicResult {
  success: boolean;
  audioUrl?: string;
  lyrics?: string;
  modelUsed: 'lyria-3-pro' | 'minimax-v2' | 'stable-audio';
  error?: string;
}

// ── Routing logic ──────────────────────────────────────────────────────────────

function selectModel(req: SmartMusicRequest): 'lyria-3-pro' | 'minimax-v2' | 'stable-audio' {
  if (req.isInstrumental) return 'stable-audio';
  if (req.customLyrics && req.customLyrics.length > 50) return 'minimax-v2';
  return 'lyria-3-pro'; // default — best quality
}

// ── Generation with automatic fallback ────────────────────────────────────────

export async function generateOriginalSong(req: SmartMusicRequest): Promise<SmartMusicResult> {
  const preferred = selectModel(req);
  const fallbackOrder: Array<'lyria-3-pro' | 'minimax-v2' | 'stable-audio'> = [
    preferred,
    preferred !== 'lyria-3-pro' ? 'lyria-3-pro' : 'minimax-v2',
    'stable-audio',
  ];

  // Compose prompt — includes artist's original verse as creative seed
  const promptParts: string[] = [];
  if (req.originalVerse) {
    promptParts.push(`Inspired by the artist's original phrase: "${req.originalVerse}".`);
  }
  promptParts.push(`${req.mood} ${req.genre} song in ${req.language}.`);
  if (req.title) promptParts.push(`Title: "${req.title}".`);
  const prompt = promptParts.join(' ');

  for (const model of fallbackOrder) {
    try {
      log(`[SmartRouter] Trying model: ${model}`, 'smart-router');

      if (model === 'lyria-3-pro') {
        const params: Lyria3CompositionParams = {
          genre: req.genre,
          mood: req.mood,
          language: req.language,
          instrumental: req.isInstrumental,
          customLyrics: req.customLyrics || undefined,
          useClipModel: false,
        };
        const result = await generateMusicWithLyria3(prompt, params);
        if (result.success && result.audioUrl) {
          return { success: true, audioUrl: result.audioUrl, lyrics: result.lyrics, modelUsed: 'lyria-3-pro' };
        }
        log(`[SmartRouter] Lyria 3 failed: ${result.error}`, 'smart-router');
      }

      if (model === 'minimax-v2') {
        const stylePrompt = `${req.mood} ${req.genre} ${req.language} song. Title: ${req.title}.`;
        const lyricsPrompt = req.customLyrics || req.originalVerse || '';
        const result = await generateMusicWithMiniMax(stylePrompt, lyricsPrompt);
        if (result.success && result.audioUrl) {
          return { success: true, audioUrl: result.audioUrl, modelUsed: 'minimax-v2' };
        }
        log(`[SmartRouter] MiniMax failed: ${result.error}`, 'smart-router');
      }

      if (model === 'stable-audio') {
        // Stable Audio via Lyria instrumental mode
        const params: Lyria3CompositionParams = {
          genre: req.genre,
          mood: req.mood,
          instrumental: true,
          useClipModel: false,
        };
        const result = await generateMusicWithLyria3(prompt, params);
        if (result.success && result.audioUrl) {
          return { success: true, audioUrl: result.audioUrl, modelUsed: 'stable-audio' };
        }
        log(`[SmartRouter] Stable Audio fallback failed: ${result.error}`, 'smart-router');
      }

    } catch (err: any) {
      log(`[SmartRouter] ${model} threw: ${err.message}`, 'smart-router');
    }
  }

  return { success: false, modelUsed: preferred, error: 'All generation engines failed. Please try again.' };
}
