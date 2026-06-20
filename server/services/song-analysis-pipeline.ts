/**
 * 🎵 Song Analysis Pipeline
 * 
 * Triggered automatically every time an artist uploads (or AI-generates) a song.
 * Produces a rich JSON document used by downstream AI agents for proposals,
 * video scripts, marketing angles, sync licensing pitches, etc.
 *
 * Pipeline (fire-and-forget, runs in background after upload):
 *  1. OpenAI Whisper     → primary transcription + structural analysis
 *                          (delegates to existing `analyzeAudio()` service).
 *  2. fal-ai/wizper      → secondary sound analysis at word-level granularity,
 *                          used to verify lyrics and gather precise timestamps.
 *  3. OpenAI GPT-4o-mini → creative-insights extraction from the lyrics:
 *                          themes, audience, emotional arc, video concepts,
 *                          marketing angles, sync-licensing fit, hashtags.
 *  4. Persist combined JSON to `songs.analysis_json` + bump status/timestamps.
 *
 * The pipeline is best-effort: any failed step is captured in the JSON under
 * `errors[]` so partial results are still useful for the agents.
 */

import { db } from '../db';
import { songs } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { fal } from '@fal-ai/client';
import { logger } from '../utils/logger';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { analyzeAudio, type AudioAnalysisResult } from './audio-analysis-service';
import { PRIMARY_MODEL } from '../utils/ai-config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';

if (FAL_KEY) {
  try { fal.config({ credentials: FAL_KEY }); } catch { /* already configured */ }
}

const openai = OPENAI_API_KEY ? createTrackedOpenAI({ apiKey: OPENAI_API_KEY }) : null;

// ---------- Types ----------

export interface SongCreativeInsights {
  /** 1-2 sentence pitch for the song. */
  summary: string;
  /** Core lyrical/emotional themes. */
  themes: string[];
  /** Mood descriptors derived from lyrics + structure. */
  mood: string[];
  /** Target listener persona (age range, lifestyle, taste). */
  targetAudience: string;
  /** Best-fit social platforms & content formats. */
  recommendedPlatforms: string[];
  /** Concrete music-video / shortform concepts the director agent can use. */
  videoConcepts: string[];
  /** Marketing-campaign angles for the marketing agent. */
  marketingAngles: string[];
  /** Sync-licensing opportunities (films, brands, contexts). */
  syncOpportunities: string[];
  /** Suggested hashtags for social posts. */
  hashtags: string[];
  /** A short 4-6 line emotional arc (for reels / TikTok storytelling). */
  emotionalArc: string;
}

export interface SongAnalysisJson {
  songId: number;
  audioUrl: string;
  pipelineVersion: string;
  generatedAt: string;
  /** Step 1: Whisper-based audio analysis (BPM, sections, transcription, key moments). */
  audio: AudioAnalysisResult | null;
  /** Step 2: fal sound analysis (word-level timestamps, language verification). */
  fal: {
    provider: 'fal-ai/wizper';
    text?: string;
    language?: string;
    /** Word-level chunks: `{ text, timestamp: [start, end] }`. */
    words?: Array<{ text: string; timestamp: [number, number] }>;
  } | null;
  /** Step 3: GPT-4o-mini creative insights for AI agents. */
  insights: SongCreativeInsights | null;
  errors: Array<{ step: 'audio' | 'fal' | 'insights'; message: string }>;
}

const PIPELINE_VERSION = '1.0.0';

// ---------- Steps ----------

async function runFalSoundAnalysis(audioUrl: string): Promise<SongAnalysisJson['fal']> {
  if (!FAL_KEY) {
    logger.warn('[SongAnalysis] FAL_KEY not configured, skipping fal step');
    return null;
  }
  const result: any = await fal.subscribe('fal-ai/wizper', {
    input: {
      audio_url: audioUrl,
      task: 'transcribe',
      chunk_level: 'word',
    },
    logs: false,
  });
  const data = result?.data || result || {};
  return {
    provider: 'fal-ai/wizper',
    text: data.text,
    language: data.language || data.detected_language,
    words: Array.isArray(data.chunks)
      ? data.chunks.map((c: any) => ({ text: c.text, timestamp: c.timestamp }))
      : undefined,
  };
}

async function runCreativeInsights(
  lyrics: string | undefined,
  audio: AudioAnalysisResult | null,
  songMeta: { title: string; genre?: string | null; mood?: string | null },
): Promise<SongCreativeInsights | null> {
  if (!openai) {
    logger.warn('[SongAnalysis] OpenAI not configured, skipping insights step');
    return null;
  }

  const prompt = `You are a music A&R + content strategist. Given the song below, return ONLY a strict JSON object matching this TypeScript shape:

{
  "summary": string,
  "themes": string[],
  "mood": string[],
  "targetAudience": string,
  "recommendedPlatforms": string[],
  "videoConcepts": string[],         // 3-5 short, concrete music-video ideas
  "marketingAngles": string[],       // 3-5 distinct campaign angles
  "syncOpportunities": string[],     // 3-5 brand / film / TV sync ideas
  "hashtags": string[],              // 6-10 relevant hashtags (no leading #)
  "emotionalArc": string             // 4-6 lines describing the journey
}

SONG METADATA:
- Title: ${songMeta.title}
- Genre: ${songMeta.genre || 'unknown'}
- Mood (declared): ${songMeta.mood || 'unknown'}
- BPM: ${audio?.bpm ?? 'unknown'}
- Duration: ${audio?.duration ?? 'unknown'}s
- Sections: ${audio?.sections?.map((s) => s.type).join(' → ') || 'unknown'}

LYRICS:
${(lyrics || '(instrumental — no lyrics)').slice(0, 6000)}

Respond with raw JSON only. No markdown, no commentary.`;

  const completion = await openai.chat.completions.create({
    model: PRIMARY_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    response_format: { type: 'json_object' },
  });
  const raw = completion.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(raw) as SongCreativeInsights;
  } catch (err) {
    logger.warn('[SongAnalysis] Could not parse insights JSON:', (err as Error).message);
    return null;
  }
}

// ---------- Main entry point ----------

/**
 * Run the full analysis pipeline for a song. Persists the result to
 * `songs.analysis_json` and updates `analysis_status` / `analyzed_at`.
 *
 * Designed to be called fire-and-forget; never throws.
 */
export async function analyzeSongAndStore(songId: number): Promise<void> {
  const errors: SongAnalysisJson['errors'] = [];

  // Mark as processing
  try {
    await db
      .update(songs)
      .set({ analysisStatus: 'processing', analysisError: null })
      .where(eq(songs.id, songId));
  } catch (err) {
    logger.warn(`[SongAnalysis] Could not flag song ${songId} as processing:`, (err as Error).message);
  }

  // Load the song
  const [song] = await db.select().from(songs).where(eq(songs.id, songId)).limit(1);
  if (!song) {
    logger.warn(`[SongAnalysis] Song ${songId} not found, aborting`);
    return;
  }
  if (!song.audioUrl) {
    logger.warn(`[SongAnalysis] Song ${songId} has no audioUrl, aborting`);
    await db
      .update(songs)
      .set({ analysisStatus: 'failed', analysisError: 'no audio url' })
      .where(eq(songs.id, songId));
    return;
  }

  // Step 1: OpenAI Whisper + structural analysis
  let audio: AudioAnalysisResult | null = null;
  try {
    audio = await analyzeAudio(song.audioUrl);
  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`[SongAnalysis] step=audio song=${songId} failed:`, msg);
    errors.push({ step: 'audio', message: msg });
  }

  // Step 2: fal-ai/wizper sound analysis (word-level)
  let falResult: SongAnalysisJson['fal'] = null;
  try {
    falResult = await runFalSoundAnalysis(song.audioUrl);
  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`[SongAnalysis] step=fal song=${songId} failed:`, msg);
    errors.push({ step: 'fal', message: msg });
  }

  // Step 3: Creative insights via GPT-4o-mini
  const lyricsForInsights =
    audio?.transcription?.text || falResult?.text || song.lyrics || undefined;
  let insights: SongCreativeInsights | null = null;
  try {
    insights = await runCreativeInsights(lyricsForInsights, audio, {
      title: song.title,
      genre: song.genre,
      mood: song.mood,
    });
  } catch (err) {
    const msg = (err as Error).message;
    logger.error(`[SongAnalysis] step=insights song=${songId} failed:`, msg);
    errors.push({ step: 'insights', message: msg });
  }

  // Persist combined JSON
  const json: SongAnalysisJson = {
    songId,
    audioUrl: song.audioUrl,
    pipelineVersion: PIPELINE_VERSION,
    generatedAt: new Date().toISOString(),
    audio,
    fal: falResult,
    insights,
    errors,
  };

  const fullyFailed = !audio && !falResult && !insights;
  const status = fullyFailed ? 'failed' : 'ready';

  try {
    await db
      .update(songs)
      .set({
        analysisJson: json as any,
        analysisStatus: status,
        analyzedAt: new Date(),
        analysisError: fullyFailed
          ? errors.map((e) => `${e.step}: ${e.message}`).join('; ').slice(0, 500)
          : null,
        // Backfill convenient flat columns when we have data
        lyrics: song.lyrics || lyricsForInsights || song.lyrics,
        mood:
          song.mood ||
          (insights?.mood && insights.mood.length ? insights.mood.join(', ') : song.mood),
      })
      .where(eq(songs.id, songId));
    logger.log(`[SongAnalysis] ✅ Song ${songId} analyzed (status=${status})`);
  } catch (err) {
    logger.error(`[SongAnalysis] Failed to persist analysis for song ${songId}:`, (err as Error).message);
  }
}

/** Fire-and-forget wrapper for use right after song insertion. */
export function triggerSongAnalysis(songId: number): void {
  analyzeSongAndStore(songId).catch((err) => {
    logger.error(`[SongAnalysis] Pipeline crashed for song ${songId}:`, err?.message || err);
  });
}
