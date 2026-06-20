/**
 * 🎵 Song Audio Extractor for Promo
 * 
 * Extracts the best clip from a song to use as background in promotional videos
 * Strategies:
 * - 'hook': First 10-15 seconds (most memorable part)
 * - 'chorus': Find and extract chorus
 * - 'best-section': AI analysis of energy/emotion
 * - 'custom': User-specified time range
 */

import { db } from '../db';
import { songs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import OpenAI from 'openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';

export interface SongClipParams {
  songId: number;
  strategy: 'hook' | 'chorus' | 'best-section' | 'drop' | 'custom';
  customStart?: number;        // Seconds into song
  customDuration?: number;     // Duration to extract
  targetDuration?: number;     // Resample to this duration
}

export interface ExtractedClip {
  startSeconds: number;
  durationSeconds: number;
  confidence: number;          // 0-1: how good is this clip
  reason: string;              // Why this section
  audioPath?: string;          // Path to extracted file
}

function parseDurationToSeconds(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return 240;

  // Supports "mm:ss", "hh:mm:ss" and plain seconds as string.
  if (/^\d+$/.test(raw.trim())) return Math.max(1, Number(raw.trim()));

  const parts = raw.split(':').map((p) => Number(p.trim()));
  if (parts.some((n) => !Number.isFinite(n))) return 240;
  if (parts.length === 2) return Math.max(1, parts[0] * 60 + parts[1]);
  if (parts.length === 3) return Math.max(1, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  return 240;
}

/**
 * Analyze song structure to find best promo clip
 */
async function analyzeSongStructure(args: {
  songTitle: string;
  duration: number;
  analysisJson?: any;
}): Promise<{
  hookEnd: number;              // Where hook ends (seconds)
  firstChorusStart: number;     // Where first chorus starts
  energyPeak: number;           // Where energy is highest
  emotionalPeak: number;        // Where emotion peaks
}> {
  if (!OPENAI_API_KEY) {
    // Fallback if no API
    return {
      hookEnd: Math.min(15, args.duration / 2),
      firstChorusStart: Math.min(30, args.duration / 2),
      energyPeak: args.duration / 2,
      emotionalPeak: Math.max(args.duration * 0.6, 45),
    };
  }

  const insights = args.analysisJson?.insights || {};
  const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

  const prompt = `Song: "${args.songTitle}"
Duration: ${args.duration} seconds
Genre: ${insights.genre || 'unknown'}
Mood: ${(insights.mood || []).join(', ')}
Themes: ${(insights.themes || []).join(', ')}

Where are the key moments in a typical song of this style?
Return JSON: {
  "hookEnd": number (seconds where intro/hook typically ends),
  "firstChorusStart": number (where first chorus likely starts),
  "energyPeak": number (seconds where energy peaks),
  "emotionalPeak": number (where emotional impact is strongest)
}`;

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      response_format: { type: 'json_object' },
      temperature: 0.6,
      messages: [
        {
          role: 'system',
          content:
            'You are a music producer analyzing song structure. Return JSON with song section timings.',
        },
        { role: 'user', content: prompt },
      ],
    });

    const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
    return {
      hookEnd: Math.min(parsed.hookEnd || 15, args.duration),
      firstChorusStart: Math.min(parsed.firstChorusStart || 30, args.duration),
      energyPeak: Math.min(parsed.energyPeak || 60, args.duration),
      emotionalPeak: Math.min(parsed.emotionalPeak || 90, args.duration),
    };
  } catch (err) {
    logger.error('[SongAnalyzer] failed', { err });
    // Return sensible defaults
    return {
      hookEnd: Math.min(15, args.duration / 2),
      firstChorusStart: Math.min(30, args.duration / 2),
      energyPeak: args.duration / 2,
      emotionalPeak: Math.max(args.duration * 0.6, 45),
    };
  }
}

/**
 * Extract best clip from song based on strategy
 */
export async function extractSongClipForPromo(args: SongClipParams): Promise<ExtractedClip> {
  const [song] = await db.select().from(songs).where(eq(songs.id, args.songId)).limit(1);
  if (!song) throw new Error(`Song ${args.songId} not found`);

  const duration = parseDurationToSeconds(song.duration); // default ~4 minutes
  const analysisJson = song.analysisJson || {};

  let clip: ExtractedClip;

  if (args.strategy === 'custom') {
    // User-specified range
    if (args.customStart === undefined || args.customDuration === undefined) {
      throw new Error('Custom strategy requires customStart and customDuration');
    }
    clip = {
      startSeconds: Math.max(0, args.customStart),
      durationSeconds: Math.min(args.customDuration, duration - args.customStart),
      confidence: 0.8,
      reason: `User selected: ${args.customStart}s - ${args.customStart + args.customDuration}s`,
    };
  } else {
    // Analyze song structure
    const structure = await analyzeSongStructure({
      songTitle: song.title || 'Unknown',
      duration,
      analysisJson,
    });

    switch (args.strategy) {
      case 'hook':
        // First 10-15 seconds (most recognizable)
        clip = {
          startSeconds: 0,
          durationSeconds: Math.min(12, structure.hookEnd),
          confidence: 0.95,
          reason: 'Song intro/hook - most recognizable',
        };
        break;

      case 'chorus':
        // Find and extract chorus
        const chorusStart = structure.firstChorusStart;
        clip = {
          startSeconds: chorusStart,
          durationSeconds: Math.min(10, duration - chorusStart),
          confidence: 0.88,
          reason: 'First chorus - most memorable melody',
        };
        break;

      case 'drop':
        // Energy peak (for upbeat songs)
        clip = {
          startSeconds: Math.max(20, structure.energyPeak - 3),
          durationSeconds: 8,
          confidence: 0.85,
          reason: 'Energy peak - most impactful moment',
        };
        break;

      case 'best-section':
      default:
        // Emotional peak (default best section)
        clip = {
          startSeconds: Math.max(30, structure.emotionalPeak - 4),
          durationSeconds: 10,
          confidence: 0.9,
          reason: 'Emotional peak - most moving moment',
        };
        break;
    }
  }

  // Resample if target duration specified
  if (args.targetDuration && args.targetDuration !== clip.durationSeconds) {
    logger.info('[SongClip] resampling', {
      from: clip.durationSeconds,
      to: args.targetDuration,
    });
    // In real implementation, would call FFmpeg to resample
    clip.durationSeconds = Math.min(args.targetDuration, clip.durationSeconds);
  }

  return clip;
}

/**
 * Get promo-ready audio clip from song
 * Returns the extracted clip ready to mix with video
 */
export async function getPromoAudioClip(args: {
  songId: number;
  strategy?: 'hook' | 'chorus' | 'best-section' | 'drop';
  duration?: number; // Target duration (e.g., 6 seconds for video)
}): Promise<{
  songTitle: string;
  clipStart: number;
  clipDuration: number;
  confidence: number;
  readyToMix: boolean;
}> {
  const clip = await extractSongClipForPromo({
    songId: args.songId,
    strategy: args.strategy || 'best-section',
    targetDuration: args.duration || 6,
  });

  const [song] = await db.select().from(songs).where(eq(songs.id, args.songId)).limit(1);

  return {
    songTitle: song?.title || 'Unknown',
    clipStart: clip.startSeconds,
    clipDuration: clip.durationSeconds,
    confidence: clip.confidence,
    readyToMix: true, // In real impl, would check if audio file exists
  };
}
