/**
 * Promo Clips Route — Song-to-Visual Lipsync Promo Engine
 * Genera videos promocionales cortos donde el artista canta sincronizado.
 *
 * Pipeline:
 *  1. GET  /context         — Cargar contexto completo del artista
 *  2. POST /analyze-song    — Analizar canción y seleccionar segmentos
 *  3. POST /create-visual-direction — Generar dirección visual por género
 *  4. POST /generate-fal-image      — Generar imagen 9:16 del artista (Flux Kontext)
 *  5. POST /generate-lipsync-video  — Imagen + audio → video lipsync/performance (OmniHuman/Seedance/Sync-3)
 *  6. POST /generate-captions       — Captions + hashtags + CTA
 *  7. POST /save-job                — Guardar job completo en Firestore
 *  8. GET  /jobs/:jobId             — Consultar estado de un job
 *  9. GET  /jobs                    — Listar jobs del artista
 * 10. POST /poll-fal/:requestId     — Consultar estado de cola FAL
 */

import { Router, Request, Response } from 'express';
import { db } from '../firebase';
import { db as pgDb } from '../../db';
import { users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { cached } from '../utils/cache';
import { createTrackedOpenAI } from '../utils/tracked-openai';
import {
  FAL_MODELS,
  generateOmniHumanLipsync,
  generateSeedanceFastReferenceVideo,
  replaceVideoAudioWithOriginalSong,
  stitchPromoSceneVideosWithOriginalAudio,
  generateSyncLipsyncV3,
  generateKlingV3ProVideo,
  generateImageWithFluxKontextPro,
} from '../services/fal-service';
import { PRIMARY_MODEL } from '../utils/ai-config';
import { logger } from '../utils/logger';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

const router = Router();
const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';

const openai = createTrackedOpenAI({
  apiKey: process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY || '',
});

const seedanceAudioLocks = new Map<string, {
  audioUrl: string;
  clipStartSeconds: number;
  duration: number;
  createdAt: number;
}>();

const sync3AudioLocks = new Map<string, {
  audioUrl: string;
  clipStartSeconds: number;
  duration: number;
  sourceMode?: string;
  createdAt: number;
}>();

const seedanceSync3Chains = new Map<string, {
  syncRequestId: string;
  statusUrl?: string;
  resultUrl?: string;
  audioUrl: string;
  clipStartSeconds: number;
  duration: number;
  createdAt: number;
}>();

const KLING_SYNC3_WORKFLOWS: Record<string, {
  endpoint: string;
  label: string;
  cost5s: string;
  cost30s: string;
  baseCost5s?: number;
  syncCost5s?: number;
}> = {
  'kling-v21-standard-sync3': {
    endpoint: FAL_MODELS.KLING_V21_STANDARD_I2V,
    label: 'Kling v2.1 Standard + Sync-3',
    cost5s: '$0.95',
    cost30s: '$5.68',
    baseCost5s: 0.28,
    syncCost5s: 0.67,
  },
  'kling-v3-standard-sync3': {
    endpoint: FAL_MODELS.KLING_V3_STANDARD_I2V,
    label: 'Kling v3 Standard + Sync-3',
    cost5s: '$1.09',
    cost30s: '$6.52',
    baseCost5s: 0.42,
    syncCost5s: 0.67,
  },
  'kling-v3-pro-sync3': {
    endpoint: FAL_MODELS.KLING_V3_PRO_I2V,
    label: 'Kling v3 Pro + Sync-3',
    cost5s: '$1.23',
    cost30s: '$7.36',
    baseCost5s: 0.56,
    syncCost5s: 0.67,
  },
  // Backward-compatible alias for older frontend state.
  'kling+sync3': {
    endpoint: FAL_MODELS.KLING_V3_PRO_I2V,
    label: 'Kling v3 Pro + Sync-3',
    cost5s: '$1.23',
    cost30s: '$7.36',
    baseCost5s: 0.56,
    syncCost5s: 0.67,
  },
};

type NarrativeSceneType = 'lipsync' | 'performance' | 'broll' | 'cutaway';
type NarrativeAct = 'ACT_1' | 'ACT_2' | 'ACT_3';

interface NarrativeScenePlan {
  id: string;
  index: number;
  act?: NarrativeAct;
  startTime: number;
  endTime: number;
  duration: number;
  sourceSceneId: string;
  sourceIndex: number;
  generationStartTime: number;
  sourceOffset: number;
  sourceDuration: number;
  isContinuationCut: boolean;
  sceneType: NarrativeSceneType;
  shotType: string;
  cameraMovement: string;
  lyricsExcerpt: string;
  visualIntent: string;
  emotion: string;
  model: string;
  requiresLipsync: boolean;
  estimatedCost: number;
  lyricConnection: string;
  continuityPrompt: string;
  brollSubject: string;
  palettePrompt: string;
  identityPrompt: string;
  cutVariationPrompt: string;
  symbolEvolution: string;
  lensPrompt?: string;
  lightingPrompt?: string;
  editCue?: string;
  transition?: string;
  shotContinuityPrompt?: string;
  faceBiblePrompt?: string;
  paletteBiblePrompt?: string;
  pipelineRole?: string;
  qualityChecklist?: string[];
  location?: string;
  timeOfDay?: string;
  wardrobePiece?: string;
  propStaging?: string;
  actionBeat?: string;
  effect?: string;
  forbiddenRepeats?: string;
  imagePrompt: string;
  videoPrompt: string;
}

interface LyricWindow {
  startTime: number;
  endTime: number;
  text: string;
}

interface NarrativeTimelineCut {
  index: number;
  startTime: number;
  endTime: number;
  duration: number;
  sourceSceneId: string;
  sourceIndex: number;
  generationStartTime: number;
  sourceOffset: number;
  sourceDuration: number;
  isContinuationCut: boolean;
}

interface CharacterLockPlan {
  id?: string;
  referenceImageUrls?: string[];
  primaryReferenceImageUrl?: string;
  masterImageUrl?: string;
  identityLabel?: string;
  faceLockPrompt?: string;
  wardrobeLockPrompt?: string;
  accessoryLockPrompt?: string;
  brollContinuityPrompt?: string;
  lyricContinuityPrompt?: string;
  negativePrompt?: string;
  scenePromptPrefix?: string;
  faceBiblePrompt?: string;
  faceQualityChecklist?: string[];
  qualityChecklist?: string[];
}

interface ArtistFaceBiblePlan {
  identityLabel: string;
  primaryReferenceImageUrl?: string;
  referenceImageUrls: string[];
  prompt: string;
  qualityChecklist: string[];
}

interface PaletteBiblePlan {
  prompt: string;
  colorStory: string;
  skinToneRule: string;
  lightingRule: string;
  gradeRule: string;
}

interface EditingGrammarPlan {
  bpmFeel: string;
  rhythmRule: string;
  transitionPlan: string;
  microCutRule: string;
}

// REFACTOR 2026-05: 12 independent short cuts (avg 2.5s) ≤ 30s total.
// Each cut now has its own paid source (no pair-splitting). Variable durations
// per cut give the edit randomness, while the AI gets full creative freedom
// per cut against a locked global palette/identity.
const NARRATIVE_TOTAL_DURATION = 30;
const NARRATIVE_TOTAL_SCENES = 12;                 // 12 paid sources
const NARRATIVE_CUTS_PER_SOURCE_SCENE = 1;         // 1 cut per paid source
const NARRATIVE_TOTAL_CUTS = NARRATIVE_TOTAL_SCENES * NARRATIVE_CUTS_PER_SOURCE_SCENE;
const NARRATIVE_SCENE_DURATION = NARRATIVE_TOTAL_DURATION / NARRATIVE_TOTAL_SCENES; // 2.5s nominal
// Random duration palette used to break the metronome feeling. Sums chosen so
// any rotation of 12 values stays under 30s with a final tiny tail-trim.
const NARRATIVE_CUT_DURATION_POOL: number[] = [1.8, 2.0, 2.2, 2.4, 2.6, 2.8, 3.0];
const SEEDANCE_SYNC3_COST_5S = 1.88;
// Seedance 2.0 Mini: variante económica (~40% más barata que Fast)
const SEEDANCE_MINI_SYNC3_COST_5S = 1.12;

function clampPercent(value: any, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function getModelCost5s(model: string, requiresLipsync: boolean): number {
  if (model === 'seedance-fast-r2v') return requiresLipsync ? SEEDANCE_SYNC3_COST_5S : 1.21;
  if (model === 'seedance-mini-r2v') return requiresLipsync ? SEEDANCE_MINI_SYNC3_COST_5S : 0.72;
  const workflow = KLING_SYNC3_WORKFLOWS[model] || KLING_SYNC3_WORKFLOWS['kling-v3-standard-sync3'];
  const baseCost = workflow.baseCost5s ?? 0.42;
  return requiresLipsync ? baseCost + (workflow.syncCost5s ?? 0.67) : baseCost;
}

function calculateNarrativeSceneCounts(performancePercent: number, lipsyncPercent: number) {
  const lipsyncSceneCount = Math.max(1, Math.min(NARRATIVE_TOTAL_SCENES, Math.round(NARRATIVE_TOTAL_SCENES * (lipsyncPercent / 100))));
  const performanceSceneCount = Math.max(lipsyncSceneCount, Math.min(NARRATIVE_TOTAL_SCENES, Math.round(NARRATIVE_TOTAL_SCENES * (performancePercent / 100))));
  return {
    lipsyncSceneCount,
    performanceSceneCount,
    brollSceneCount: NARRATIVE_TOTAL_SCENES - performanceSceneCount,
  };
}

function seedHash(value: string): number {
  return String(value || '')
    .split('')
    .reduce((hash, char) => ((hash << 5) - hash + char.charCodeAt(0)) | 0, 0);
}

function buildEditorialCutTimeline(clipStartSeconds: number, seed: string): NarrativeTimelineCut[] {
  // 12 independent paid sources, each a single short cut with randomized
  // duration drawn from NARRATIVE_CUT_DURATION_POOL. Total is normalized so
  // the edited timeline lands at or just under NARRATIVE_TOTAL_DURATION (30s).
  const hash = Math.abs(seedHash(seed));
  const pool = NARRATIVE_CUT_DURATION_POOL;
  const rawDurations: number[] = Array.from({ length: NARRATIVE_TOTAL_SCENES }).map((_, i) => {
    // Pseudo-random rotation over the pool to avoid metronome patterns.
    const idx = (hash * 9301 + i * 49297 + ((hash >> (i % 5)) & 0xff)) % pool.length;
    return pool[idx];
  });
  const rawSum = rawDurations.reduce((a, b) => a + b, 0);
  const scale = Math.min(1, NARRATIVE_TOTAL_DURATION / rawSum);
  const durations = rawDurations.map(d => Math.max(1.2, Number((d * scale).toFixed(2))));

  const cuts: NarrativeTimelineCut[] = [];
  let timelineCursor = 0;
  for (let sourceIndex = 0; sourceIndex < NARRATIVE_TOTAL_SCENES; sourceIndex++) {
    const duration = durations[sourceIndex];
    const startTime = clipStartSeconds + timelineCursor;
    const endTime = startTime + duration;
    cuts.push({
      index: sourceIndex,
      startTime: Number(startTime.toFixed(2)),
      endTime: Number(endTime.toFixed(2)),
      duration: Number(duration.toFixed(2)),
      sourceSceneId: `source_${sourceIndex + 1}`,
      sourceIndex,
      generationStartTime: Number(startTime.toFixed(2)),
      sourceOffset: 0,
      sourceDuration: Number(duration.toFixed(2)),
      isContinuationCut: false,
    });
    timelineCursor += duration;
  }
  return cuts;
}

function normalizeReferenceUrls(value: any): string[] {
  const urls = Array.isArray(value) ? value : [value];
  return Array.from(new Set(
    urls
      .flat()
      .map((url: any) => String(url || '').trim())
      .filter((url: string) => /^https?:\/\//i.test(url))
  )).slice(0, 8);
}

function cleanPromptPart(value: any, fallback: string, maxLength = 700): string {
  const text = String(value || fallback || '').replace(/\s+/g, ' ').trim();
  return text.slice(0, maxLength);
}

function isUsableLyrics(value: any): boolean {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (text.length < 80) return false;
  if (/^(instrumental|no lyrics|sin letra|not provided|undefined|null)$/i.test(text)) return false;
  const wordCount = (text.match(/[\p{L}\p{N}']+/gu) || []).length;
  return wordCount >= 18;
}

function normalizeTranscriptSegments(value: any): Array<{ start: number; end: number; text: string }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((segment: any) => ({
      start: Number(segment?.start ?? segment?.startTime ?? 0),
      end: Number(segment?.end ?? segment?.endTime ?? segment?.start ?? 0),
      text: String(segment?.text || '').replace(/\s+/g, ' ').trim(),
    }))
    .filter(segment => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.text.length > 0)
    .slice(0, 160);
}

function formatTranscriptSegments(segments: Array<{ start: number; end: number; text: string }>, maxChars = 5000): string {
  const text = segments
    .map(segment => `${segment.start.toFixed(1)}-${segment.end.toFixed(1)}s: ${segment.text}`)
    .join('\n');
  return text.slice(0, maxChars);
}

function buildLyricWindows(
  segments: Array<{ start: number; end: number; text: string }>,
  clipStartSeconds: number,
  sceneCount = NARRATIVE_TOTAL_SCENES,
  sceneDuration = NARRATIVE_SCENE_DURATION,
): LyricWindow[] {
  return Array.from({ length: sceneCount }).map((_, index) => {
    const startTime = clipStartSeconds + index * sceneDuration;
    const endTime = startTime + sceneDuration;
    const text = segments
      .filter(segment => segment.end >= startTime - 0.35 && segment.start <= endTime + 0.35)
      .map(segment => segment.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { startTime, endTime, text };
  });
}

function buildTextLyricWindows(
  lyrics: string,
  clipStartSeconds: number,
  sceneCount = NARRATIVE_TOTAL_SCENES,
  sceneDuration = NARRATIVE_SCENE_DURATION,
): LyricWindow[] {
  const cleanLyrics = String(lyrics || '').replace(/\r/g, '').trim();
  const lyricLines = cleanLyrics
    .split(/\n+|(?<=[.!?])\s+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const chunks = lyricLines.length >= sceneCount
    ? Array.from({ length: sceneCount }).map((_, index) => {
        const start = Math.floor(index * lyricLines.length / sceneCount);
        const end = Math.floor((index + 1) * lyricLines.length / sceneCount);
        return lyricLines.slice(start, Math.max(start + 1, end)).join(' ');
      })
    : Array.from({ length: sceneCount }).map((_, index) => {
        const words = cleanLyrics.split(/\s+/).filter(Boolean);
        const start = Math.floor(index * words.length / sceneCount);
        const end = Math.floor((index + 1) * words.length / sceneCount);
        return words.slice(start, Math.max(start + 1, end)).join(' ');
      });

  return chunks.map((text, index) => {
    const startTime = clipStartSeconds + index * sceneDuration;
    return { startTime, endTime: startTime + sceneDuration, text: text.slice(0, 260) };
  });
}

function buildLyricWindowsForTimeline(
  segments: Array<{ start: number; end: number; text: string }>,
  timelineCuts: NarrativeTimelineCut[],
): LyricWindow[] {
  return timelineCuts.map(cut => {
    const text = segments
      .filter(segment => segment.end >= cut.startTime - 0.25 && segment.start <= cut.endTime + 0.25)
      .map(segment => segment.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    return { startTime: cut.startTime, endTime: cut.endTime, text };
  });
}

function buildTextLyricWindowsForTimeline(lyrics: string, timelineCuts: NarrativeTimelineCut[]): LyricWindow[] {
  const cleanLyrics = String(lyrics || '').replace(/\r/g, '').trim();
  const lyricLines = cleanLyrics
    .split(/\n+|(?<=[.!?])\s+/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const fallbackWords = cleanLyrics.split(/\s+/).filter(Boolean);
  const sourceItems = lyricLines.length >= Math.max(4, Math.floor(timelineCuts.length / 2)) ? lyricLines : fallbackWords;

  return timelineCuts.map((cut, index) => {
    const start = Math.floor(index * sourceItems.length / Math.max(1, timelineCuts.length));
    const end = Math.floor((index + 1) * sourceItems.length / Math.max(1, timelineCuts.length));
    const text = sourceItems.slice(start, Math.max(start + 1, end)).join(' ');
    return { startTime: cut.startTime, endTime: cut.endTime, text: text.slice(0, 260) };
  });
}

function formatLyricWindows(windows: LyricWindow[]): string {
  return windows
    .map((window, index) => `Cut ${index + 1} (${window.startTime}-${window.endTime}s): ${window.text || '[instrumental / breath / unclear lyric]'} `)
    .join('\n');
}

async function transcribePromoAudioFromUrl(audioUrl: string): Promise<{
  text: string;
  language?: string;
  duration?: number;
  segments?: Array<{ start: number; end: number; text: string }>;
} | null> {
  const response = await fetch(audioUrl);
  if (!response.ok) throw new Error(`Failed to fetch audio for transcription: ${response.status}`);

  const contentType = response.headers.get('content-type') || 'audio/mpeg';
  const extension = contentType.includes('wav') ? '.wav'
    : contentType.includes('mp4') || contentType.includes('m4a') ? '.m4a'
    : contentType.includes('ogg') ? '.ogg'
    : contentType.includes('flac') ? '.flac'
    : '.mp3';
  const tempDir = path.join(process.cwd(), 'uploads');
  fs.mkdirSync(tempDir, { recursive: true });
  const tempPath = path.join(tempDir, `promo_transcript_${Date.now()}_${Math.random().toString(36).slice(2)}${extension}`);

  try {
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(tempPath, audioBuffer);
    const transcription: any = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tempPath),
      model: 'whisper-1',
      response_format: 'verbose_json',
      timestamp_granularities: ['segment'],
    } as any);

    return {
      text: transcription?.text || '',
      language: transcription?.language,
      duration: transcription?.duration,
      segments: normalizeTranscriptSegments(transcription?.segments || []),
    };
  } finally {
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  }
}

async function resolvePromoLyrics(song: any, songDocRef?: FirebaseFirestore.DocumentReference): Promise<{
  lyrics: string;
  lyricsSource: string;
  transcriptSegments: Array<{ start: number; end: number; text: string }>;
  language?: string;
  duration?: number;
}> {
  const storedLyrics = song?.lyrics || song?.finalLyrics || song?.customLyrics || song?.lyricsText || song?.promoLyricsTranscript || '';
  const storedSegments = normalizeTranscriptSegments(song?.promoLyricsSegments || song?.transcriptSegments || song?.segments);

  if (isUsableLyrics(storedLyrics)) {
    return {
      lyrics: String(storedLyrics),
      lyricsSource: song?.lyrics ? 'song.lyrics' : song?.promoLyricsTranscript ? 'promoLyricsTranscript' : 'stored',
      transcriptSegments: storedSegments,
      language: song?.promoLyricsLanguage,
      duration: song?.promoLyricsDuration,
    };
  }

  if (!song?.audioUrl) {
    return { lyrics: String(storedLyrics || ''), lyricsSource: 'missing-audio', transcriptSegments: storedSegments };
  }

  logger.log(`[PromoClips] Lyrics missing/weak for song ${song.id || song.title || song.name}; transcribing audio for lyric-first storyboard...`);
  const transcription = await transcribePromoAudioFromUrl(song.audioUrl).catch(error => {
    logger.warn('[PromoClips] Audio transcription failed:', error?.message || error);
    return null;
  });

  const transcribedLyrics = transcription?.text?.replace(/\s+/g, ' ').trim() || '';
  const transcribedSegments = normalizeTranscriptSegments(transcription?.segments || []);
  if (isUsableLyrics(transcribedLyrics)) {
    const update: Record<string, any> = {
      promoLyricsTranscript: transcribedLyrics,
      promoLyricsSource: 'whisper-audio-transcription',
      promoLyricsUpdatedAt: new Date(),
    };
    if (transcribedSegments.length) update.promoLyricsSegments = transcribedSegments;
    if (transcription?.language) update.promoLyricsLanguage = transcription.language;
    if (transcription?.duration) update.promoLyricsDuration = transcription.duration;
    if (!isUsableLyrics(song?.lyrics)) update.lyrics = transcribedLyrics;
    if (songDocRef) {
      await songDocRef.set(update, { merge: true }).catch(error => logger.warn('[PromoClips] Could not save transcribed lyrics:', error.message));
    }
    return {
      lyrics: transcribedLyrics,
      lyricsSource: 'whisper-audio-transcription',
      transcriptSegments: transcribedSegments,
      language: transcription?.language,
      duration: transcription?.duration,
    };
  }

  return {
    lyrics: String(storedLyrics || transcribedLyrics || ''),
    lyricsSource: transcribedLyrics ? 'weak-transcription' : 'unavailable',
    transcriptSegments: transcribedSegments.length ? transcribedSegments : storedSegments,
    language: transcription?.language,
    duration: transcription?.duration,
  };
}

function buildCharacterContinuityPrompt(characterLock?: CharacterLockPlan | null): string {
  if (!characterLock) {
    return 'Character continuity: preserve the exact artist identity from the profile reference image whenever the artist is visible. Same face, hair, skin tone, age, facial proportions, wardrobe logic and accessories.';
  }
  const references = normalizeReferenceUrls(characterLock.referenceImageUrls || characterLock.primaryReferenceImageUrl);
  return [
    'CHARACTER LOCK is mandatory for every artist-visible frame.',
    characterLock.primaryReferenceImageUrl ? `Primary identity reference: ${characterLock.primaryReferenceImageUrl}.` : '',
    references.length ? `Use these supporting references only for the same person identity: ${references.join(' | ')}.` : '',
    cleanPromptPart(characterLock.faceBiblePrompt, '', 700),
    cleanPromptPart(characterLock.faceLockPrompt, 'Preserve exact face, facial proportions, skin tone, age, hairstyle, eyes, nose, mouth, jawline and overall likeness.'),
    cleanPromptPart(characterLock.wardrobeLockPrompt, 'Keep wardrobe coherent across the full edit.'),
    cleanPromptPart(characterLock.accessoryLockPrompt, 'Accessories must not appear, disappear, toggle, morph or change between shots.'),
    cleanPromptPart(characterLock.brollContinuityPrompt, 'B-roll must stay inside the same visual world and should not introduce a different singer or lookalike.'),
    cleanPromptPart(characterLock.lyricContinuityPrompt, 'Every scene should connect directly to the lyric, emotion or story beat.'),
    cleanPromptPart(characterLock.negativePrompt, 'No different face, no face swap, no identity drift, no random extra artist, no text, no watermark.', 500),
  ].filter(Boolean).join(' ');
}

function buildDefaultCharacterLock(params: {
  artistName?: string;
  profileImageUrl?: string | null;
  genre?: string;
  direction?: any;
}): CharacterLockPlan | null {
  const references = normalizeReferenceUrls(params.profileImageUrl);
  if (references.length === 0) return null;
  const artistLabel = cleanPromptPart(params.artistName, 'Artist', 80);
  const wardrobe = cleanPromptPart(params.direction?.wardrobe_detail, 'the artist signature wardrobe and styling', 220);
  return {
    id: `profile_identity_lock_${Date.now()}`,
    referenceImageUrls: references,
    primaryReferenceImageUrl: references[0],
    masterImageUrl: references[0],
    identityLabel: `${artistLabel} canonical profile identity`,
    faceLockPrompt: `${artistLabel} — same face structure, skin tone, apparent age, short beard, and overall likeness across all cuts. Do not swap to a different performer.`,
    faceBiblePrompt: `Artist Face Bible for ${artistLabel}: preserve exact face geometry, eye spacing, nose bridge, lips, teeth, jawline, cheekbones, skin tone, hairline, facial hair, apparent age and expression language from the profile reference. Mouth area must be natural and clean for lipsync.`,
    faceQualityChecklist: ['Face matches profile reference', 'Eyes/nose/lips/jawline remain stable', 'Mouth and teeth are natural', 'No alternate actor or beauty-filter drift'],
    wardrobeLockPrompt: `Style family: ${wardrobe}. Wardrobe changes cut-to-cut within this style family. The artist does NOT wear the same hat/glasses/outfit in every cut — each cut picks a DIFFERENT item from the family.`,
    // CRITICAL FIX: "keep hat/glasses stable" was the direct cause of every cut generating
    // the same portrait. Accessories MUST vary across cuts for a dynamic music video.
    accessoryLockPrompt: 'Accessories VARY per cut — this is a music video, not a photo shoot. The same hat or sunglasses must NOT appear in more than 2 cuts. Most cuts should show the artist without the signature hat, or with different eyewear, or in a totally different wardrobe item from the same style family.',
    brollContinuityPrompt: 'B-roll must stay inside the same visual world, color palette, lighting logic, props and wardrobe details. No other person faces.',
    lyricContinuityPrompt: 'Every visual beat connects to the lyric, emotional turn, or story detail of that specific cut.',
    negativePrompt: 'different person, identity drift, face swap, random actor, extra singer, copied profile portrait, same dark-grey studio background in every cut, text, watermark',
  };
}

function buildConceptPalettePrompt(params: {
  artistName?: string;
  genre?: string;
  mood?: string;
  direction?: any;
}): string {
  const signal = [params.artistName, params.genre, params.mood, params.direction?.color_grade, params.direction?.lighting]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/redwine|red wine|vino|blues|jazz|soul/.test(signal)) {
    return 'Concept palette lock: deep wine red and oxblood accents, midnight indigo shadows, smoky charcoal blacks, warm tungsten amber practical lights, and muted ivory highlights. Use restrained blues-club warmth with cinematic contrast; avoid neon rainbow colors, random pastel backgrounds, generic beige rooms and flat white portrait lighting.';
  }
  if (/trap|hip hop|rap|drill|urban/.test(signal)) {
    return 'Concept palette lock: graphite black, wet asphalt gray, sodium amber, muted crimson accents and cold cyan rim light. Keep the grade cinematic and street-real, with controlled contrast; avoid random rainbow neon and unrelated luxury colors.';
  }
  if (/latin|reggaeton|salsa|bachata|tropical/.test(signal)) {
    return 'Concept palette lock: deep teal shadows, warm coral accents, golden practical light, rich plant green details and off-white highlights. Keep it sensual and rhythmic without turning every shot into saturated neon.';
  }
  if (/rock|metal|punk|alternative/.test(signal)) {
    return 'Concept palette lock: charcoal black, oxidized silver, dirty white highlights, rust red accents and hard amber stage light. Keep contrast gritty and coherent; avoid glossy pop colors unless the lyric demands it.';
  }
  if (/r&b|rnb|pop|electronic|dance/.test(signal)) {
    return 'Concept palette lock: deep plum shadows, teal-blue edge light, warm champagne highlights, soft magenta accents and clean black negative space. Keep the color story premium and consistent across all cuts.';
  }
  return 'Concept palette lock: one coherent campaign palette with 4-5 recurring colors: dark neutral shadows, one warm accent, one cool accent, one skin-friendly highlight, and one grounded wardrobe color. Keep lighting, props and backgrounds inside this palette across every cut; avoid random color changes between scenes.';
}

function getNarrativeAct(index: number): NarrativeAct {
  if (index <= 2) return 'ACT_1';
  if (index <= 8) return 'ACT_2';
  return 'ACT_3';
}

function buildArtistFaceBible(params: {
  characterLock?: CharacterLockPlan | null;
  artistName?: string;
  profileImageUrl?: string | null;
}): ArtistFaceBiblePlan {
  const references = normalizeReferenceUrls([
    params.characterLock?.primaryReferenceImageUrl,
    params.characterLock?.masterImageUrl,
    params.characterLock?.referenceImageUrls,
    params.profileImageUrl,
  ]);
  const identityLabel = cleanPromptPart(params.characterLock?.identityLabel, `${params.artistName || 'Artist'} locked face`, 120);
  const faceRule = cleanPromptPart(
    params.characterLock?.faceBiblePrompt || params.characterLock?.faceLockPrompt,
    'Preserve exact facial geometry, eye spacing, nose bridge, lips, jawline, cheekbones, skin tone, apparent age, hairline, facial hair, mouth shape and expression language from the primary reference. No alternate actor, no younger/older version, no beauty-filter drift.',
    720,
  );
  const qualityChecklist = [
    'Face matches the primary reference before spending video credits',
    'Eyes, nose, lips, jawline, skin tone, hairline and facial hair stay consistent',
    'Mouth/teeth area remains natural and clean for lipsync',
    'No extra singer, face swap, plastic skin or alternate actor appears',
    ...(params.characterLock?.faceQualityChecklist || params.characterLock?.qualityChecklist || []),
  ].map(item => String(item).slice(0, 160)).slice(0, 8);

  return {
    identityLabel,
    primaryReferenceImageUrl: references[0],
    referenceImageUrls: references,
    prompt: [
      `ARTIST FACE BIBLE: ${identityLabel}.`,
      references[0] ? `Primary face reference: ${references[0]}.` : '',
      references.length > 1 ? `Supporting references: ${references.slice(1, 4).join(' | ')}.` : '',
      faceRule,
      'Every artist-visible still and video prompt must preserve this same face with a sharp, natural, camera-ready mouth and skin texture.',
    ].filter(Boolean).join(' '),
    qualityChecklist,
  };
}

function buildPaletteBible(params: {
  palettePrompt: string;
  genre?: string;
  mood?: string;
  director?: any;
}): PaletteBiblePlan {
  const directorPalette = [
    ...(params.director?.visual_style?.color_palette?.primary_colors || []).slice(0, 2),
    ...(params.director?.visual_style?.color_palette?.accent_colors || []).slice(0, 2),
  ].filter(Boolean).join(', ');
  const grade = params.director?.post_production?.color_grading_style || 'cinematic Dolby Vision-style contrast with controlled highlights';
  const lighting = params.director?.lighting_style?.description
    || (params.director?.lighting_style?.key_techniques || []).slice(0, 2).join('; ')
    || 'motivated practical light, shaped key light, skin-friendly fill and cinematic rim separation';
  const colorStory = directorPalette
    ? `Director color story: ${directorPalette}. ${params.palettePrompt}`
    : params.palettePrompt;
  const skinToneRule = 'Skin tones stay natural and premium in every grade: no wax skin, no grey skin, no over-saturated red/magenta faces, no crushed facial detail.';
  const lightingRule = `Lighting bible: ${lighting}. Keep sources motivated by the set: practicals, stage lights, window slashes, neon, tungsten bars, reflected floor light.`;
  const gradeRule = `Color grade bible: ${grade}. One coherent campaign LUT across all cuts; ACT_1 more restrained, ACT_2 warmer or more saturated, ACT_3 highest contrast or peak saturation.`;
  return {
    prompt: [colorStory, skinToneRule, lightingRule, gradeRule].filter(Boolean).join(' '),
    colorStory,
    skinToneRule,
    lightingRule,
    gradeRule,
  };
}

function buildEditingGrammar(params: {
  analysis?: any;
  timelineCuts: NarrativeTimelineCut[];
}): EditingGrammarPlan {
  const bpmFeel = cleanPromptPart(params.analysis?.detected_bpm_feel || params.analysis?.bpm_feel || params.analysis?.detected_bpm || 'song-driven pulse', 'song-driven pulse', 90);
  const averageDuration = params.timelineCuts.length
    ? params.timelineCuts.reduce((sum, cut) => sum + cut.duration, 0) / params.timelineCuts.length
    : 2.5;
  const rhythmRule = `Editorial rhythm: ${params.timelineCuts.length || 12} microcuts averaging ${averageDuration.toFixed(2)}s, cut on lyric phrases, downbeats, snare hits, breath turns and visual action beats.`;
  const transitionPlan = 'Use motivated music-video transitions: hard cuts on consonants, match cuts on props, whip pans only when camera motion supports it, light flashes on beat accents, freeze-frame only for emotional punctuation.';
  const microCutRule = `BPM feel: ${bpmFeel}. Every cut must have one clean action beat, one clear focal subject and one precise entry/exit cue; no dead air, no duplicated still poses.`;
  return { bpmFeel, rhythmRule, transitionPlan, microCutRule };
}

function getShotContinuityForCut(params: {
  cut: NarrativeTimelineCut;
  index: number;
  sceneType: NarrativeSceneType;
  act: NarrativeAct;
  editingGrammar: EditingGrammarPlan;
}): {
  lensPrompt: string;
  lightingPrompt: string;
  transition: string;
  editCue: string;
  shotContinuityPrompt: string;
} {
  const artistVisible = params.sceneType === 'lipsync' || params.sceneType === 'performance';
  const pattern = (params.index + params.cut.sourceIndex) % 6;
  const lensPool = artistVisible
    ? ['85mm close portrait lens, shallow depth of field', '50mm intimate music-video lens, slight handheld energy', '35mm three-quarter performance lens, visible set geography', '70mm compressed stage portrait, clean face separation', '24mm controlled wide performance lens, no face distortion', 'macro-to-medium detail lens for hands/mic/wardrobe then face']
    : ['100mm macro insert lens on object texture', '50mm still-life lens with layered background depth', '35mm empty-location lens with foreground object', '70mm compressed prop detail lens', '24mm low-angle object/location lens', 'rack-focus lens language from foreground prop to background light'];
  const actLighting: Record<NarrativeAct, string> = {
    ACT_1: 'ACT_1 lighting: cooler or restrained palette, controlled shadows, world-establishing contrast, calm camera breathing.',
    ACT_2: 'ACT_2 lighting: warmth and saturation build, tighter motivated key light, more contrast, emotional pressure rising.',
    ACT_3: 'ACT_3 lighting: boldest contrast or peak saturation, strongest rim/practical light, climax-level visual impact.',
  };
  const transitionPool = [
    'hard cut on vocal consonant/downbeat',
    'match cut through a prop shape or hand/microphone gesture',
    'light-flash cut on snare or kick accent',
    'whip-pan cut only if the next shot continues motion direction',
    'rack-focus cut from foreground symbol to artist/object',
    'freeze-frame punctuation for the emotional word, then immediate cut',
  ];
  const transition = transitionPool[pattern];
  const editCue = `Edit cue: enter at ${params.cut.startTime.toFixed(2)}s for ${params.cut.duration.toFixed(2)}s; ${transition}; keep one readable action beat and exit before the frame goes static.`;
  const lensPrompt = lensPool[pattern];
  const lightingPrompt = actLighting[params.act];
  return {
    lensPrompt,
    lightingPrompt,
    transition,
    editCue,
    shotContinuityPrompt: `${params.act}. ${lensPrompt}. ${lightingPrompt} ${editCue} ${params.editingGrammar.microCutRule}`,
  };
}

function buildSceneQualityChecklist(params: {
  sceneType: NarrativeSceneType;
  requiresLipsync: boolean;
  faceBible?: ArtistFaceBiblePlan;
  paletteBible: PaletteBiblePlan;
  shotContinuityPrompt: string;
}): string[] {
  const checks = params.sceneType === 'broll' || params.sceneType === 'cutaway'
    ? [
        'Object-only frame: no person, no face, no body, no hands, no random actor',
        'Prop/object clearly connects to the lyric or instrumental beat',
        'Palette and lighting match the campaign bible',
        'Shot has foreground, midground and background depth',
        'No generic ocean/storm/cloud metaphor unless the lyric literally says it',
      ]
    : [
        ...(params.faceBible?.qualityChecklist || []),
        params.requiresLipsync ? 'Mouth is visible, clean, natural and ready for Sync-3 lipsync' : 'Face remains consistent even when mouth is not the focus',
        'Wardrobe/accessories stay inside the scene continuity plan',
        'No copied static profile-photo pose',
      ];
  return [
    ...checks,
    params.paletteBible.skinToneRule,
    params.shotContinuityPrompt,
  ].filter(Boolean).map(item => String(item).slice(0, 180)).slice(0, 8);
}

function getFallbackSceneDetail(params: {
  field: 'location' | 'timeOfDay' | 'wardrobe' | 'prop' | 'action' | 'effect';
  sceneType: NarrativeSceneType;
  index: number;
  act: NarrativeAct;
  genre?: string;
  brollSubject?: string;
}): string {
  const artistVisible = params.sceneType === 'lipsync' || params.sceneType === 'performance';
  const idx = params.index;
  if (params.field === 'timeOfDay') return ['night', 'interior-lit', 'golden-hour', 'dusk', 'day', 'dawn'][idx % 6];
  if (params.field === 'effect') return ['rack-focus', 'light-flash', 'slow-mo', 'whip-pan', 'smoke-pass', 'lens-flare'][idx % 6];
  if (params.field === 'location') {
    const artistLocations = ['smoky club stage', 'recording booth', 'backstage hallway', 'wet street outside the venue', 'mirror dressing room', 'rooftop under stage-like practicals', 'vinyl shop aisle', 'empty theater aisle', 'car interior with sodium street light', 'warehouse rehearsal room', 'hotel corridor', 'bar corner with tungsten lamps'];
    const brollLocations = ['empty stage floor', 'studio console corner', 'backstage prop table', 'wet asphalt outside the club', 'amp wall detail', 'piano room corner', 'bar top with reflections', 'vinyl crate shelf', 'dressing-room mirror surface', 'side-stage cable run', 'neon doorway', 'drum riser close-up'];
    return (artistVisible ? artistLocations : brollLocations)[idx % 12];
  }
  if (params.field === 'wardrobe') {
    if (!artistVisible) return 'b-roll: no person';
    const wardrobe = ['open-collar ivory shirt with dark tailored jacket', 'wine-red satin shirt under black leather jacket', 'white tank top with oxidized silver chain', 'charcoal oversized hoodie with stage-worn texture', 'midnight blazer over a warm neutral tee', 'deep teal shirt with rolled sleeves', 'black leather jacket without hat or sunglasses', 'champagne shirt under long dark coat', 'graphic tee with vintage jacket', 'bare-neck performance look with no eyewear', 'matte bomber jacket in grounded campaign color', 'profile-look tribute used only once'];
    return wardrobe[idx % wardrobe.length];
  }
  if (params.field === 'prop') return params.brollSubject || ['vintage microphone', 'lyric notebook', 'guitar cable coil', 'wine-red reflection', 'stage light', 'piano keys', 'drum cymbal edge', 'amp tubes', 'mirror crack', 'empty chair', 'setlist', 'pedalboard'][idx % 12];
  if (params.field === 'action') {
    const artistActions = ['leans into the phrase then pulls back before the cut', 'turns from shadow into the key light on the downbeat', 'grips the mic stand then releases it on the lyric', 'steps through a thin smoke pass with eyes locked to camera', 'moves one hand across chest then snaps gaze off-camera', 'lets the jacket fall from one shoulder as the beat turns'];
    const brollActions = ['light crawls across the object as the camera pushes in', 'rack focus reveals the prop at the exact beat accent', 'reflection trembles once then settles before the cut', 'smoke passes over the object and clears on the lyric', 'a practical light flickers once in sync with the groove', 'the camera slides past texture into a deeper background layer'];
    return (artistVisible ? artistActions : brollActions)[idx % 6];
  }
  return '';
}

function getCutVariationPrompt(cut: NarrativeTimelineCut, sceneType: NarrativeSceneType): {
  shotType: string;
  cameraMovement: string;
  prompt: string;
} {
  const firstCut = !cut.isContinuationCut;
  const pattern = cut.sourceIndex % 6;
  if (sceneType === 'lipsync') {
    return firstCut
      ? {
          shotType: pattern % 2 === 0 ? 'medium close-up lead vocal' : 'three-quarter close-up vocal',
          cameraMovement: pattern % 2 === 0 ? 'slow push-in on the downbeat' : 'small handheld sway with beat accents',
          prompt: 'Visible cut role: lead vocal phrase. Show the artist in a fresh performance setup with clear mouth visibility, shoulders and hands alive to the groove, not a static copied portrait.',
        }
      : {
          shotType: pattern % 2 === 0 ? 'tight emotional vocal reaction' : 'micro-expression and hand-detail vocal insert',
          cameraMovement: pattern % 2 === 0 ? 'quick reframed push from the same setup' : 'short rhythmic side drift',
          prompt: 'Visible cut role: continuation cut from the same paid source. Keep the same setup and identity, but change framing into a tighter reaction, hand gesture, profile angle or lyric accent so it never looks like the same still repeated.',
        };
  }
  if (sceneType === 'performance') {
    return firstCut
      ? {
          shotType: 'medium performance body-language setup',
          cameraMovement: 'controlled handheld push with beat-driven weight shift',
          prompt: 'Visible cut role: performance setup. Show posture, wardrobe, set geography and musical body language while keeping the artist identity locked.',
        }
      : {
          shotType: 'performance detail insert',
          cameraMovement: 'short cut-in to hands, jacket, microphone or side profile',
          prompt: 'Visible cut role: performance continuation. Use a different angle or detail from the same setup, not a repeated front-facing frame.',
        };
  }
  if (sceneType === 'cutaway') {
    return firstCut
      ? {
          shotType: 'lyric cutaway without clear face',
          cameraMovement: 'brief cinematic slide across the scene',
          prompt: 'Visible cut role: object-only cutaway connected to the lyric. Do not show a person, face, body, singer mouth or performance pose. Use instruments, props, empty stage/studio details, wardrobe fragments on furniture, reflections, room detail or symbolic objects tied to the lyric.',
        }
      : {
          shotType: 'symbolic reaction cutaway detail',
          cameraMovement: 'quick insert movement following a prop or light change',
          prompt: 'Visible cut role: object-only cutaway continuation. Use a different instrument, prop, shadow, reflection, empty room detail or wardrobe fragment from the same world so the pair feels edited, not duplicated.',
        };
  }
  return firstCut
    ? {
        shotType: 'wide lyric b-roll establishing detail',
        cameraMovement: 'slow cinematic drift through the environment',
        prompt: 'Visible cut role: object-only b-roll establishing beat. Show a lyric-connected instrument, prop, empty stage/studio/club detail, location texture or symbolic object. No person, no body, no face, no portrait.',
      }
    : {
        shotType: 'tight b-roll insert',
        cameraMovement: 'short rhythmic cut-in on texture, prop, reflection or light',
        prompt: 'Visible cut role: object-only b-roll continuation. Change scale and subject from the sibling cut: tighter insert, different instrument, prop, reflection, shadow, cable, notebook, amp, microphone, stage light or room texture, never the same image repeated. No person, no body, no face, no portrait.',
      };
}

function hasClearLyricText(value: any): boolean {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return false;
  if (/\b(instrumental|unclear|breath|silence|no lyric|no lyrics|sin letra|vocal unclear|unclear vocal|empty space)\b/i.test(text)) return false;
  return (text.match(/[\p{L}\p{N}']+/gu) || []).length >= 3;
}

function looksArtistCentric(value: string, artistName?: string): boolean {
  const text = String(value || '');
  const artistTokens = String(artistName || '')
    .toLowerCase()
    .split(/\s+/)
    .map(token => token.replace(/[^a-z0-9]/gi, ''))
    .filter(token => token.length >= 3);
  const namesArtist = artistTokens.some(token => new RegExp(`\\b${token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(text));
  return namesArtist || /\b(artist|singer|performer|face|portrait|mouth|singing|sings|lip|lipsync|vocal|close-up|closeup|front-facing|camera-facing|directly engaging the camera|looking directly|arms open|embracing|head tilt|expression|expressing)\b/i.test(text);
}

function looksGenericStoryDrift(value: string): boolean {
  return /\b(stormy ocean|ocean|sea|waves|crashing rocks|stormy sky|dark clouds|clouds above|tilt.*sky|generic room|dimly lit room|hand reaching out|reaching out towards the camera|reflective surface|turmoil)\b/i.test(value || '');
}

function findNearestClearLyricText(windows: LyricWindow[] | undefined, index: number): string {
  if (!windows?.length) return '';
  for (let distance = 0; distance <= 3; distance++) {
    const previous = windows[index - distance]?.text;
    if (hasClearLyricText(previous)) return cleanPromptPart(previous, '', 220);
    const next = windows[index + distance]?.text;
    if (hasClearLyricText(next)) return cleanPromptPart(next, '', 220);
  }
  return '';
}

function getInstrumentBrollPool(genre?: string): string[] {
  const signal = String(genre || '').toLowerCase();
  if (/blues|jazz|soul|r&b|rnb/.test(signal)) {
    return [
      'a wine-red electric blues guitar neck with strings bending under tungsten light',
      'a drummer brush sweeping the snare beside a warm ride cymbal',
      'upright piano keys and felt hammers moving in smoky club light',
      'a harmonica resting on a vintage amplifier with cable coils and dust texture',
      'a bass guitar string vibrating in a tight macro shot',
      'a vintage ribbon microphone and guitar pedal glowing beside a setlist',
    ];
  }
  if (/rock|metal|punk|alternative/.test(signal)) {
    return [
      'distorted electric guitar strings beside a worn pedalboard',
      'drumsticks hitting a snare rim with cymbal shimmer',
      'a bass guitar headstock vibrating under hard amber stage light',
      'amplifier tubes glowing red behind smoke and cables',
      'a pick scraping guitar strings in an aggressive macro insert',
    ];
  }
  if (/latin|reggaeton|salsa|bachata|tropical/.test(signal)) {
    return [
      'nylon guitar strings plucked close to the sound hole',
      'conga drums and worn drumhead texture under amber club light',
      'timbales sticks and cowbell catching a rhythmic highlight',
      'a güira texture scraped in a tight metallic close-up',
      'bass strings pulsing beside a small studio mixer',
    ];
  }
  if (/hip hop|rap|trap|drill|urban|electronic|dance/.test(signal)) {
    return [
      'an MPC pad grid lighting up on the beat beside a notebook',
      'turntable needle dropping on a dark vinyl groove',
      '808 controller knobs and waveform screen glowing in the studio',
      'headphones wrapped around a mixer while meters jump with the bass',
      'a synth keyboard line blinking under blue edge light',
    ];
  }
  return [
    'electric guitar strings vibrating in a tight cinematic macro shot',
    'drumsticks striking snare and cymbal in a rhythmic insert',
    'piano keys moving under warm practical light',
    'bass guitar strings pulsing beside coiled stage cables',
    'a microphone stand, instrument case and lyric notebook in the same color world',
  ];
}

function buildInstrumentalBrollSubject(params: {
  genre?: string;
  mood?: string;
  sourceIndex: number;
  cutIndex: number;
  nearbyLyricText?: string;
}): string {
  const pool = getInstrumentBrollPool(params.genre);
  const instrument = pool[(params.sourceIndex * 3 + params.cutIndex) % pool.length];
  const storyAnchor = hasClearLyricText(params.nearbyLyricText)
    ? `answering the nearby lyric: ${cleanPromptPart(params.nearbyLyricText, '', 160)}`
    : 'carrying the instrumental groove without inventing lyrics';
  return `${instrument}, ${storyAnchor}. Object-only frame: no visible person, no face, no body, no portrait. Mood: ${params.mood || 'song-driven emotion'}`;
}

interface SymbolEvolutionBeat {
  visualIntent: string;
  brollSubject: string;
  symbolEvolution: string;
  continuityNote: string;
  cameraHint: string;
}

function looksStaticRepeatedSymbol(_value: string): boolean {
  // REFACTOR 2026-05: AI is now free per user directive "DEJA LIBRE A LA IA".
  // We no longer second-guess the model's storyboard with regex pattern matching.
  return false;
}

function hasDualityLoveConflictSignal(_value: string): boolean {
  // REFACTOR 2026-05: deprecated — duality script is fully disabled.
  return false;
}

function buildDualityLoveConflictBeat(params: {
  index: number;
  sceneType: NarrativeSceneType;
  lyricText?: string;
  nearbyLyricText?: string;
  mood?: string;
}): SymbolEvolutionBeat | null {
  const lyricSignal = `${params.lyricText || ''} ${params.nearbyLyricText || ''}`;
  if (!hasDualityLoveConflictSignal(lyricSignal) && !looksStaticRepeatedSymbol(lyricSignal)) return null;

  const isArtistVisible = params.sceneType === 'lipsync' || params.sceneType === 'performance';
  const beats: Array<SymbolEvolutionBeat> = [
    {
      visualIntent: 'The artist sings into a classic vintage microphone with his face split between wine-red shadow and soft white light, opening the chaos-versus-calm question.',
      brollSubject: 'a classic vintage microphone split by wine-red shadow on one side and soft white light on the other, introducing the emotional duality',
      symbolEvolution: 'Introduce the visual conflict: red shadow means chaos/desire, white light means calm/vulnerability, and the microphone becomes the confession point.',
      continuityNote: 'Opening duality: chaos versus calm, shadow versus light.',
      cameraHint: 'medium close-up, slow push-in, slight handheld emotional movement',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist slowly puts on a black leather jacket while performing with confident but wounded dark energy.'
        : 'a black leather jacket is introduced alone under wine-red stage light, freshly placed as the desired dangerous persona',
      brollSubject: 'a black leather jacket introduced under wine-red stage light, not yet damaged, representing the desired dangerous persona',
      symbolEvolution: 'The black leather jacket enters the story as the bad version that receives desire.',
      continuityNote: 'The black jacket becomes the symbol of the bad persona she loves.',
      cameraHint: 'medium shot with a slow right pan ending in a close-up or jacket detail',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist leaves a clean white flower on an empty chair and steps back into red darkness, leaving vulnerability alone.'
        : 'a clean white flower newly appears on an empty wooden chair under soft white light, with the black jacket blurred far behind it',
      brollSubject: 'a clean white flower newly placed on an empty wooden chair under soft white light, the black jacket only blurred in the background',
      symbolEvolution: 'The flower is introduced as vulnerability and innocence, separate from the jacket instead of repeating the same still life.',
      continuityNote: 'The flower becomes the vulnerable good version that is rejected.',
      cameraHint: 'slow tilt down from upper space to the flower on the chair',
    },
    {
      visualIntent: 'Two chairs form a split symbolic composition: one holds the black jacket under red light, the other holds the white flower under pale light, with a wine-red reflection between them.',
      brollSubject: 'two separated chairs: black leather jacket on one under red light, white flower on the other under pale light, with a wine-red floor reflection dividing them like a wound',
      symbolEvolution: 'The jacket and flower appear together for the first time, but as opposing choices separated by a red border.',
      continuityNote: 'This is the static comparison beat; after it, the symbols must change state.',
      cameraHint: 'locked-off wide shot with subtle parallax and slow push-in',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist performs while pulling the black jacket off one shoulder, starting to abandon the dark persona while white light touches his face.'
        : 'the black jacket hangs half off the chair as if slipping away, while the white flower sits blurred and unreachable in the foreground',
      brollSubject: 'the black leather jacket half slipped from the chair, no longer cleanly worn or displayed, with the white flower blurred and unreachable in the foreground',
      symbolEvolution: 'The jacket changes from power into something the artist tries to remove; the white flower remains out of reach.',
      continuityNote: 'The artist starts moving from bad persona toward vulnerability.',
      cameraHint: 'medium performance tilt up or tight detail moving toward the fallen jacket edge',
    },
    {
      visualIntent: 'A lyric notebook reveals the internal confession: malo is underlined in red ink, bueno is blurred by a tear-like water drop, with a microphone shadow crossing the page.',
      brollSubject: 'a lyric notebook on a studio table with malo underlined in red ink and bueno blurred by a tear-like water drop, crossed by a vintage microphone shadow',
      symbolEvolution: 'The conflict moves from props into written confession: the words malo and bueno become visible evidence.',
      continuityNote: 'The story moves from external symbols to the artist inner confession.',
      cameraHint: 'steady close-up with very slow lateral slide',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist puts the black jacket back on with resignation instead of pride, showing the symbol has become a prison.'
        : 'the black jacket is back on the central chair but now folded tight like a restraint, with the white flower on the floor out of reach',
      brollSubject: 'the black leather jacket returned to the central chair, folded tight like a restraint, while the white flower lies on the floor out of reach',
      symbolEvolution: 'The jacket repeats with a changed meaning: it is now an emotional prison, not seductive power.',
      continuityNote: 'The repeated jacket now means resignation and captivity.',
      cameraHint: 'slow dolly in with a slight low angle or tight jacket restraint detail',
    },
    {
      visualIntent: isArtistVisible
        ? 'A wine-red reflection moves like slow fire across the empty stage floor while the artist stops before reaching the distant white flower.'
        : 'a moving wine-red reflection crawls across the dark stage floor like slow fire, stopping far from a white flower isolated in soft light',
      brollSubject: 'a moving wine-red reflection crawling across the dark stage floor like slow fire, with the white flower far away in a separate soft light',
      symbolEvolution: 'The red reflection evolves into burning desire, while the flower becomes distant unreachable love.',
      continuityNote: 'Desire burns around him, but love stays far away.',
      cameraHint: 'low-angle floor tracking shot following the red reflection',
    },
    {
      visualIntent: isArtistVisible
        ? 'Extreme close-up of the artist wearing the black jacket, tired and wounded rather than powerful, with a faint white catchlight in his eyes.'
        : 'the black jacket rests under flickering red light, creased and tired, with a faint white reflection caught on its edge',
      brollSubject: 'the black leather jacket under flickering red light, now creased and tired, with a faint white reflection caught on one edge',
      symbolEvolution: 'The bad persona remains, but the mask starts breaking; red desire is no longer triumphant.',
      continuityNote: 'The artist understands desire rewards the mask but does not bring love.',
      cameraHint: 'extreme close-up or macro detail with almost static micro push-in',
    },
    {
      visualIntent: isArtistVisible
        ? 'The white flower falls from the chair to the stage floor while the artist watches from the red background without moving.'
        : 'the white flower has fallen from the empty chair onto the dark stage floor, lit by a hard white spot against a red background',
      brollSubject: 'the white flower fallen from the empty chair onto the dark stage floor under a hard white spotlight, with red darkness behind it',
      symbolEvolution: 'The flower changes from offered vulnerability into rejected vulnerability by falling to the floor.',
      continuityNote: 'The rejection becomes visible through the fallen flower.',
      cameraHint: 'slow-motion close-up or rack focus from flower to background',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist removes the black jacket completely, lets it fall, and picks up the white flower while red and white lights merge into warm amber.'
        : 'the black jacket lies dropped on the stage floor beside the white flower as red and white lights merge into warm amber',
      brollSubject: 'the black leather jacket dropped fully on the stage floor beside the white flower, both caught in merging red and white light turning amber',
      symbolEvolution: 'The symbols resolve into one frame: he stops hiding the contradiction and exposes both darkness and vulnerability.',
      continuityNote: 'Climax: no longer choosing between bad and good; both are visible.',
      cameraHint: 'medium shot moving into close-up or slow push toward the joined symbols',
    },
    {
      visualIntent: isArtistVisible
        ? 'The artist walks away from the vintage microphone into darkness while the black jacket and white flower remain together under one warm spotlight.'
        : 'the black leather jacket and white flower lie together on the empty stage floor under a single warm spotlight, with the vintage microphone abandoned in the background',
      brollSubject: 'the black leather jacket and white flower together on the empty stage floor under one warm spotlight, vintage microphone abandoned in the background',
      symbolEvolution: 'Final resolution: the jacket and flower are unified, and the artist leaves the toxic split behind.',
      continuityNote: 'The story ends by unifying both symbols and leaving the conflict behind.',
      cameraHint: 'locked-off wide shot with a slow fade-out feeling',
    },
  ];

  return beats[Math.max(0, Math.min(beats.length - 1, params.index))];
}

function buildLyricObjectBrollSubject(params: {
  lyricText?: string;
  nearbyLyricText?: string;
  mood?: string;
  sourceIndex: number;
  cutIndex: number;
}): string {
  const lyric = cleanPromptPart(params.lyricText || params.nearbyLyricText, 'the emotional meaning of the song', 180);
  const signal = lyric.toLowerCase();
  const totalCuts = NARRATIVE_TOTAL_CUTS || 12;
  const stageIndex = Math.max(0, Math.min(3, Math.floor((params.sourceIndex * 2 + params.cutIndex) / Math.max(1, totalCuts / 4))));

  // Each keyword maps to a 4-stage visual evolution so the same symbol
  // never looks identical across sequential cuts.
  const lyricSymbolArcs: Record<string, string[]> = {
    'caos|calma|sombra|luz|shadow|light': [
      'an empty microphone stand with light falling only on one side, leaving the other collapsed in deep shadow',
      'two stage lights pointed toward each other, leaving a dark no-mans-land in the middle where nothing is lit',
      'the same microphone stand, now fully surrounded by red light as if the shadow swallowed the bright side',
      'a single warm lamp where the microphone used to be — the station is abandoned but the light stayed',
    ],
    'malo|bueno|veneno|bad|good|poison': [
      'a black leather jacket hung alone on a chair under red light',
      'a clean white flower placed on a second chair, facing away from the jacket',
      'the jacket now draped over the same chair, while the flower lies on the floor, displaced',
      'the jacket and the flower together on the floor, caught in a single amber spot',
    ],
    'amas|odias|love|hate|quieres|want|me amas|me odias': [
      'a lyric notebook open on a studio table with one love line underlined',
      'the same notebook now with the page torn halfway, caught under a coiled guitar cable',
      'the torn page alone under warm stage light — the notebook is gone',
      'the coiled cable now on the empty table, with nothing left around it',
    ],
    'deseo|quema|burn|fire|fuego|pasion|passion': [
      'a wine-red glass reflection moving slowly across a dark stage floor like liquid fire',
      'the same red reflection now climbing a white wall, as if the fire spread',
      'cables, picks and a guitar neck half swallowed by shifting warm red light',
      'a single spot of warm amber on bare stage wood — the fire faded but left heat',
    ],
    'todo|esconder|hide|everything|darte todo': [
      'an open instrument case and a folded setlist placed carefully beside it',
      'the same setlist now unfolded with lines visibly marked, guitar picks scattered',
      'the case lid half closed with a scarf caught in it, a lyric page inside',
      'the case fully latched and a small light left on beside it, like something hidden',
    ],
    'odio|desprecio|rechazo|hate|reject': [
      'an empty club chair seen from distance, lit coldly in a mostly dark room',
      'the chair now closer, with a crumpled lyric page left on the seat',
      'the chair shot from above, with only a crushed flower petal left on it',
      'the chair pushed out of the faint spot, now partially dissolved in shadow',
    ],
    'llanto|lagrimas|cry|tears|sadness|tristeza': [
      'a close-up of piano keys whose reflection shows a faint red flicker',
      'a water ring left on a studio table beside a half-empty glass',
      'a lyric page with blurred ink, as if moisture touched the page',
      'bare stage floor under a dim ring of light with nothing left in the center',
    ],
    'ciudad|city|noche|night|calle|street': [
      'a narrow lane of neon amber light cutting through wet asphalt',
      'club smoke spilling from a doorway into the night air',
      'a bicycle, street sign, or car reflection in wet pavement under sodium light',
      'the same street from further back, now almost empty with one light still burning',
    ],
    'mujer|woman|mujeres|chica|girl|ella|she|baby': [
      'a perfume bottle and red lipstick left on a dark vanity surface',
      'a high-heel shoe pressed against a stage cable on a dim-lit floor',
      'a silk scarf draped over a microphone stand, catching red light',
      'the empty vanity surface now bare except for a fading scent stain on the glass',
    ],
    'rival|enemy|guerra|war|fight|lucha': [
      'two guitar picks placed face-to-face on a surface like opponents',
      'a crack running between two stage monitors in dramatic side light',
      'monitor wedges turned away from each other, a cable stretched between them',
      'the cable now loose on the floor, one monitor missing from the frame',
    ],
    'verdad|truth|mentira|lie|false': [
      'a mirror tilted against a wall with cigarette smoke curling past it',
      'the mirror now with a new diagonal crack splitting the reflection',
      'a torn lyric page taped over the cracked mirror, hiding the reflection',
      'the bare wall where the mirror was — just a nail and a faint dust outline',
    ],
    'noche|beber|drink|copa|glass|bar': [
      'an empty whiskey glass catching red stage light on a dark bar surface',
      'the same glass now tilted, with a wine ring spreading slowly on the wood',
      'a guitar pick soaked in the wine ring, lit by close amber light',
      'the bar surface cleaned, with only the mark where the ring was',
    ],
  };

  let subject = '';
  for (const [pattern, stages] of Object.entries(lyricSymbolArcs)) {
    if (new RegExp(pattern, 'i').test(signal)) {
      subject = stages[stageIndex % stages.length];
      break;
    }
  }

  if (!subject) {
    const fallbackArcs = [
      ['an unused microphone stand under smoky amber light',
       'a lyric notebook and guitar pick on a studio table, lit from one side',
       'the same notebook now closed with a cable wound around it',
       'the table empty under a single warm light — everything was cleared'],
      ['guitar amp tubes glowing faintly behind a road case',
       'snare wires shimmering under a tilted stage light',
       'a bass neck detail with dust and a fresh fingerprint on the body',
       'the bare backline with cables draped but no instrument visible'],
      ['bass strings pulsing dimly beside coiled stage cables',
       'piano keys reflecting amber and indigo from a side light',
       'the curved edge of a cymbal catching a bright red flare',
       'faded stage-tape marks on the floor with nothing standing on them'],
    ];
    const arc = fallbackArcs[(params.sourceIndex) % fallbackArcs.length];
    subject = arc[stageIndex % arc.length];
  }

  return `${subject}, connected to lyric meaning: ${lyric}. Object-only music video b-roll: no visible person, no face, no body, no portrait. Mood: ${params.mood || 'song emotion'}`;
}

function buildVideoclipBrollSubject(params: {
  lyricText?: string;
  nearbyLyricText?: string;
  mood?: string;
  genre?: string;
  sourceIndex: number;
  cutIndex: number;
}): string {
  return hasClearLyricText(params.lyricText)
    ? buildLyricObjectBrollSubject(params)
    : buildInstrumentalBrollSubject(params);
}

function getDeterministicBrollShotType(cut: NarrativeTimelineCut, hasClearLyric: boolean): string {
  const shotTypes = hasClearLyric
    ? ['object story insert', 'empty stage wide b-roll', 'symbolic prop close-up', 'studio texture detail', 'lyric object still life', 'light-and-shadow cutaway']
    : ['instrument macro b-roll', 'drum kit detail', 'guitar/bass texture insert', 'empty studio gear close-up', 'microphone and pedalboard cutaway', 'stage instrument still life'];
  return shotTypes[(cut.sourceIndex * 2 + cut.index) % shotTypes.length];
}

function getDeterministicBrollCameraMovement(cut: NarrativeTimelineCut): string {
  const moves = [
    'slow lateral slide across the object texture',
    'gentle push-in on the instrument detail',
    'short rack-focus from foreground prop to background light',
    'slow tilt across cables, notebook and stage light',
    'locked-off cinematic insert with subtle parallax',
    'brief beat-synced drift around the empty stage object',
  ];
  return moves[(cut.sourceIndex + cut.index) % moves.length];
}

function buildNarrativeSourcePriority(lyricWindows: LyricWindow[] | undefined, timelineCuts: NarrativeTimelineCut[]): number[] {
  const fallbackOrder = [0, 2, 4, 5, 1, 3];
  const stats = Array.from({ length: NARRATIVE_TOTAL_SCENES }).map((_, sourceIndex) => ({
    sourceIndex,
    clearCuts: 0,
    wordScore: 0,
    unclearCuts: 0,
  }));

  timelineCuts.forEach((cut, index) => {
    const stat = stats[cut.sourceIndex];
    const text = lyricWindows?.[index]?.text || '';
    if (hasClearLyricText(text)) {
      stat.clearCuts += 1;
      stat.wordScore += Math.min(20, (text.match(/[\p{L}\p{N}']+/gu) || []).length);
    } else {
      stat.unclearCuts += 1;
    }
  });

  return stats
    .sort((a, b) => {
      const scoreA = a.clearCuts * 100 + a.wordScore - a.unclearCuts * 20 + (fallbackOrder.length - fallbackOrder.indexOf(a.sourceIndex));
      const scoreB = b.clearCuts * 100 + b.wordScore - b.unclearCuts * 20 + (fallbackOrder.length - fallbackOrder.indexOf(b.sourceIndex));
      return scoreB - scoreA;
    })
    .map(stat => stat.sourceIndex);
}

function buildStoryDetailSubject(params: {
  lyricText?: string;
  nearbyLyricText?: string;
  mood?: string;
  genre?: string;
  sourceIndex: number;
  cutIndex: number;
}): string {
  return buildVideoclipBrollSubject(params);
}

function normalizeNarrativeScenes(rawScenes: any[], options: {
  clipStartSeconds: number;
  performanceMode: string;
  brollMode: string;
  lipsyncSceneCount: number;
  performanceSceneCount: number;
  timelineCuts: NarrativeTimelineCut[];
  visualBible: string;
  palettePrompt: string;
  faceBible: ArtistFaceBiblePlan;
  paletteBible: PaletteBiblePlan;
  editingGrammar: EditingGrammarPlan;
  characterPrompt: string;
  lyricContinuityPlan: string;
  songTitle: string;
  artistName?: string;
  genre?: string;
  lyricsExcerpt: string;
  lyricWindows?: LyricWindow[];
  mood: string;
}) {
  const scenePriority = buildNarrativeSourcePriority(options.lyricWindows, options.timelineCuts);
  const lipsyncIndexes = new Set(scenePriority.slice(0, options.lipsyncSceneCount));
  const performanceIndexes = new Set(scenePriority.slice(0, options.performanceSceneCount));

  return options.timelineCuts.map((cut, index): NarrativeScenePlan => {
    const raw = rawScenes?.[index] || rawScenes?.[cut.sourceIndex] || {};
    const act = (String(raw.act || '') as NarrativeAct) || getNarrativeAct(index);
    const lyricWindow = options.lyricWindows?.[index];
    const rawLyricsCandidate = String(raw.lyricsExcerpt || raw.lyrics_excerpt || '').slice(0, 260);
    const sourceClearLyric = (options.lyricWindows || [])
      .filter((window, windowIndex) => options.timelineCuts[windowIndex]?.sourceIndex === cut.sourceIndex && hasClearLyricText(window.text))
      .map(window => window.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 260);
    const nearbyClearLyric = findNearestClearLyricText(options.lyricWindows, index) || sourceClearLyric || options.lyricsExcerpt;
    const sourceHasClearLyric = hasClearLyricText(sourceClearLyric);
    const isLipsync = lipsyncIndexes.has(cut.sourceIndex) && sourceHasClearLyric;
    const isPerformance = performanceIndexes.has(cut.sourceIndex) && sourceHasClearLyric;
    const sceneType: NarrativeSceneType = isLipsync
      ? 'lipsync'
      : isPerformance
      ? (cut.sourceIndex % 2 === 0 ? 'performance' : 'cutaway')
      : 'broll';
    const isStoryCut = sceneType === 'broll' || sceneType === 'cutaway';
    const cutVariation = getCutVariationPrompt(cut, sceneType);
    const shotContinuity = getShotContinuityForCut({
      cut,
      index,
      sceneType,
      act,
      editingGrammar: options.editingGrammar,
    });
    const model = isLipsync ? options.performanceMode : options.brollMode;
    const windowHasClearLyric = hasClearLyricText(lyricWindow?.text) || hasClearLyricText(rawLyricsCandidate);
    const lyricsExcerpt = (hasClearLyricText(rawLyricsCandidate)
      ? rawLyricsCandidate
      : hasClearLyricText(lyricWindow?.text)
      ? String(lyricWindow?.text || '').slice(0, 260)
      : (!isStoryCut && hasClearLyricText(sourceClearLyric))
      ? sourceClearLyric
      : 'instrumental / unclear lyric').slice(0, 260);
    const instrumentalStoryCut = isStoryCut && !windowHasClearLyric;
    const rawShotType = String(raw.shotType || raw.shot_type || '').slice(0, 140);
    const shotType = isStoryCut
      ? getDeterministicBrollShotType(cut, windowHasClearLyric)
      : (looksArtistCentric(rawShotType, options.artistName)
      ? cutVariation.shotType
      : String(rawShotType || cutVariation.shotType).slice(0, 140));
    const storyDetailSubject = buildStoryDetailSubject({
      lyricText: windowHasClearLyric ? (lyricWindow?.text || lyricsExcerpt) : '',
      nearbyLyricText: nearbyClearLyric,
      mood: options.mood,
      genre: options.genre,
      sourceIndex: cut.sourceIndex,
      cutIndex: index,
    });
    const symbolBeat = buildDualityLoveConflictBeat({
      index,
      sceneType,
      lyricText: `${lyricsExcerpt} ${sourceClearLyric}`,
      nearbyLyricText: `${nearbyClearLyric} ${options.lyricsExcerpt}`,
      mood: options.mood,
    });
    const evolvedStorySubject = symbolBeat?.brollSubject || storyDetailSubject;
    const rawVisualCandidate = String(raw.visualIntent || raw.visual_intent || raw.description || '').slice(0, 320);
    const rawVisualIntent = isStoryCut
      ? `Object-only videoclip b-roll: ${evolvedStorySubject}`
      : (symbolBeat?.visualIntent || (looksStaticRepeatedSymbol(rawVisualCandidate) ? '' : rawVisualCandidate) || `${sceneType} scene for ${options.songTitle}`);
    const visualIntent = rawVisualIntent.slice(0, 520);
    const cameraMovement = isStoryCut
      ? getDeterministicBrollCameraMovement(cut)
      : String(symbolBeat?.cameraHint || raw.cameraMovement || raw.camera_movement || cutVariation.cameraMovement).slice(0, 180);
    const emotion = String(raw.emotion || options.mood || 'confident').slice(0, 120);
    const rawLyricConnection = String(raw.lyricConnection || raw.lyric_connection || '').slice(0, 320);
    const lyricConnection = instrumentalStoryCut
      ? `Instrumental/breath section: use ${evolvedStorySubject} so the music, instruments and story keep moving without inventing lyrics. Nearby lyric context: ${cleanPromptPart(nearbyClearLyric, 'emotional groove', 170)}`.slice(0, 420)
      : String(rawLyricConnection || (lyricWindow?.text ? `Visualizes the lyric window ${lyricWindow.startTime}-${lyricWindow.endTime}s: ${lyricWindow.text}` : lyricsExcerpt) || '').slice(0, 320);
    const continuityPrompt = isStoryCut
      ? 'B-roll world continuity only: same campaign palette, same lighting logic, same studio/stage/club world, same props and instrument language. No visible person, no artist face, no body, no portrait, no random actor.'
      : String(symbolBeat?.continuityNote || raw.continuityPrompt || raw.continuity_prompt || options.characterPrompt || '').slice(0, 700);
    const brollSubject = isStoryCut
      ? evolvedStorySubject.slice(0, 360)
      : '';
    const rawSymbolEvolution = String(raw.symbolEvolution || raw.symbol_evolution || '').replace(/\s+/g, ' ').trim().slice(0, 320);
    const symbolEvolution = symbolBeat?.symbolEvolution || rawSymbolEvolution || (isStoryCut
      ? `Symbol evolution stage ${Math.min(4, Math.floor(index / Math.max(1, NARRATIVE_TOTAL_CUTS / 4)) + 1)}: the recurring visual symbols must change state in this cut, not repeat as the same static arrangement.`
      : '');
    const sceneRoleInstruction = isStoryCut
      ? 'Object-only b-roll rule: this is a music-video insert, not a person shot. The frame must show instruments, props, empty stage/studio/club details, lighting, cables, notebook, microphone, guitar, drums, piano, bass, harmonica, pedalboard, mirror/object symbolism or location texture. Absolutely no visible person, no face, no body, no portrait, no singer mouth, no performance pose, no random actor.'
      : 'Artist scene rule: the artist identity must be clearly preserved and consistent with the locked references.';
    const identityPrompt = isStoryCut
      ? 'Story/b-roll identity rule: do not show the artist or any person. Carry the artist world only through objects, instruments, props, wardrobe fragments placed on furniture, color palette, light and setting.'
      : `${options.faceBible.prompt} ${options.characterPrompt} The artist must remain recognizably the same person from the profile identity reference.`;
    const promptPrefix = isStoryCut
      ? [options.paletteBible.prompt, identityPrompt, continuityPrompt, shotContinuity.shotContinuityPrompt, options.lyricContinuityPlan, lyricConnection ? `Lyric/story connection: ${lyricConnection}` : '', `Timeline cut ${index + 1}: ${cut.startTime}-${cut.endTime}s, source ${cut.sourceIndex + 1}, offset ${cut.sourceOffset}s.`].filter(Boolean).join(' ')
      : [options.visualBible, options.paletteBible.prompt, identityPrompt, continuityPrompt, shotContinuity.shotContinuityPrompt, options.lyricContinuityPlan, lyricConnection ? `Lyric/story connection: ${lyricConnection}` : '', `Timeline cut ${index + 1}: ${cut.startTime}-${cut.endTime}s, source ${cut.sourceIndex + 1}, offset ${cut.sourceOffset}s.`].filter(Boolean).join(' ');
    const rawImageCandidate = String(raw.imagePrompt || raw.image_prompt || '').slice(0, 650);
    const rawVideoCandidate = String(raw.videoPrompt || raw.video_prompt || '').slice(0, 800);
    const rawImagePrompt = isStoryCut || symbolBeat || looksStaticRepeatedSymbol(rawImageCandidate) ? '' : rawImageCandidate;
    const rawVideoPrompt = isStoryCut || symbolBeat || looksStaticRepeatedSymbol(rawVideoCandidate) ? '' : rawVideoCandidate;
    const imageCoreBase = rawImagePrompt || `${visualIntent}. ${shotType}.`;
    const videoCoreBase = rawVideoPrompt || `${visualIntent}. ${shotType}. ${cameraMovement}. ${sceneType === 'lipsync' ? 'Artist sings directly with visible mouth performance matching the song.' : 'No close visible singing mouth unless Sync-3 will be used.'}`;
    const location = cleanPromptPart(raw.location, getFallbackSceneDetail({ field: 'location', sceneType, index, act, genre: options.genre, brollSubject }), 160);
    const timeOfDay = cleanPromptPart(raw.timeOfDay || raw.time_of_day, getFallbackSceneDetail({ field: 'timeOfDay', sceneType, index, act, genre: options.genre, brollSubject }), 40);
    const wardrobePiece = cleanPromptPart(raw.wardrobePiece || raw.wardrobe_piece, getFallbackSceneDetail({ field: 'wardrobe', sceneType, index, act, genre: options.genre, brollSubject }), 140);
    const propStaging = cleanPromptPart(raw.propStaging || raw.prop_staging, getFallbackSceneDetail({ field: 'prop', sceneType, index, act, genre: options.genre, brollSubject }), 160);
    const actionBeat = cleanPromptPart(raw.actionBeat || raw.action_beat, getFallbackSceneDetail({ field: 'action', sceneType, index, act, genre: options.genre, brollSubject }), 180);
    const effect = cleanPromptPart(raw.effect, getFallbackSceneDetail({ field: 'effect', sceneType, index, act, genre: options.genre, brollSubject }), 80);
    const pipelineRole = isStoryCut
      ? 'BROLL_OBJECT_ONLY_TEXT_TO_IMAGE_THEN_I2V'
      : isLipsync
      ? 'ARTIST_FACE_LOCK_IMAGE_TO_IMAGE_THEN_SYNC3_LIPSYNC'
      : 'ARTIST_FACE_LOCK_PERFORMANCE_I2V';
    const qualityChecklist = buildSceneQualityChecklist({
      sceneType,
      requiresLipsync: isLipsync,
      faceBible: options.faceBible,
      paletteBible: options.paletteBible,
      shotContinuityPrompt: shotContinuity.shotContinuityPrompt,
    });
    const imageCore = `${imageCoreBase} Location: ${location}. Time: ${timeOfDay}. Wardrobe: ${wardrobePiece}. Prop/staging: ${propStaging}. Action: ${actionBeat}. Lens: ${shotContinuity.lensPrompt}. Lighting: ${shotContinuity.lightingPrompt}. ${symbolEvolution ? `Symbol evolution: ${symbolEvolution}. ` : ''}${sceneRoleInstruction}.`;
    const videoCore = `${videoCoreBase} Location: ${location}. Action: ${actionBeat}. Camera/edit: ${shotContinuity.editCue}. Transition: ${shotContinuity.transition}. Effect: ${effect}. ${symbolEvolution ? `Symbol evolution: ${symbolEvolution}. ` : ''}${sceneRoleInstruction}.`;
    const storyNegative = isStoryCut ? ' No person, no human figure, no face, no body, no portrait, no performer, no singer, no mouth, no performance pose, no front-facing artist, no random actor, no random ocean, no stormy sky, no unrelated clouds unless the lyric literally names them.' : '';
    const imagePrompt = `${promptPrefix}. ${cutVariation.prompt} ${imageCore}.${storyNegative} Photorealistic vertical 9:16 music video frame, campaign palette locked, no text, no watermark.`.slice(0, 1900);
    const videoPrompt = `${promptPrefix}. ${cutVariation.prompt} ${videoCore}.${storyNegative} Photorealistic vertical 9:16, stable wardrobe and identity, campaign palette locked, no text, no watermark.`.slice(0, 2200);

    return {
      id: `cut_${index + 1}`,
      index,
      act,
      startTime: cut.startTime,
      endTime: cut.endTime,
      duration: cut.duration,
      sourceSceneId: cut.sourceSceneId,
      sourceIndex: cut.sourceIndex,
      generationStartTime: cut.generationStartTime,
      sourceOffset: cut.sourceOffset,
      sourceDuration: cut.sourceDuration,
      isContinuationCut: cut.isContinuationCut,
      sceneType,
      shotType,
      cameraMovement,
      lyricsExcerpt,
      visualIntent,
      emotion,
      model,
      requiresLipsync: isLipsync,
      estimatedCost: cut.isContinuationCut ? 0 : Number(getModelCost5s(model, isLipsync).toFixed(2)),
      lyricConnection,
      continuityPrompt,
      brollSubject,
      palettePrompt: options.palettePrompt,
      identityPrompt,
      cutVariationPrompt: cutVariation.prompt,
      symbolEvolution,
      lensPrompt: shotContinuity.lensPrompt,
      lightingPrompt: shotContinuity.lightingPrompt,
      editCue: shotContinuity.editCue,
      transition: shotContinuity.transition,
      shotContinuityPrompt: shotContinuity.shotContinuityPrompt,
      faceBiblePrompt: isStoryCut ? '' : options.faceBible.prompt,
      paletteBiblePrompt: options.paletteBible.prompt,
      pipelineRole,
      qualityChecklist,
      // REFACTOR 2026-05-B: per-cut staging fields the AI now invents.
      location,
      timeOfDay,
      wardrobePiece,
      propStaging,
      actionBeat,
      effect,
      forbiddenRepeats: cleanPromptPart(raw.forbiddenRepeats || raw.forbidden_repeats, '', 300),
      imagePrompt,
      videoPrompt,
    };
  });
}

async function resolveArtistProfileImage(artistId: string): Promise<string | null> {
  const artistDoc = await db.collection('artists').doc(artistId).get();
  if (artistDoc.exists) {
    const data = artistDoc.data() as any;
    const profileImage = data?.profileImage || data?.imageUrl || data?.photoURL || data?.profile_image;
    if (profileImage) return profileImage;
  }

  const numericId = parseInt(artistId, 10);
  if (!Number.isNaN(numericId)) {
    const [pgArtist] = await pgDb
      .select({ profileImage: users.profileImage })
      .from(users)
      .where(eq(users.id, numericId))
      .limit(1);
    if (pgArtist?.profileImage) return pgArtist.profileImage;
  }

  return null;
}

// ──────────────────────────────────────────────
// GET /api/promo-clips/:artistId/context
// ──────────────────────────────────────────────
router.get('/:artistId/context', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;

    // Load artist profile
    const artistDoc = await db.collection('artists').doc(artistId).get();
    const brandDoc = await db.collection('artist_branding').doc(artistId).get();
    const audienceDoc = await db.collection('artist_audience').doc(artistId).get();

    // Load songs
    const songsSnap = await db.collection('songs')
      .where('userId', '==', artistId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const songs = songsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Load active campaigns
    const campaignsSnap = await db.collection('artist_campaigns')
      .where('artistId', '==', artistId)
      .where('status', '==', 'active')
      .limit(5)
      .get();
    const campaigns = campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    res.json({
      success: true,
      artist: artistDoc.exists ? { id: artistId, ...artistDoc.data() } : null,
      branding: brandDoc.exists ? brandDoc.data() : null,
      audience: audienceDoc.exists ? audienceDoc.data() : null,
      songs,
      campaigns,
    });
  } catch (err: any) {
    logger.error('[PromoClips] context error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/analyze-song
// Body: { songId, clipDuration, targetGoal }
// ──────────────────────────────────────────────
router.post('/:artistId/analyze-song', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { songId, clipDuration = 30, targetGoal = 'virality' } = req.body;

    if (!songId) return res.status(400).json({ success: false, error: 'songId required' });

    // Fetch song data
    const songDoc = await db.collection('songs').doc(songId).get();
    if (!songDoc.exists) return res.status(404).json({ success: false, error: 'Song not found' });
    const song = { id: songId, ...songDoc.data() } as any;

    const lyricContext = await resolvePromoLyrics(song, songDoc.ref);
    const lyrics = lyricContext.lyrics || '';
    const timestampedTranscript = formatTranscriptSegments(lyricContext.transcriptSegments, 3600);
    const genre = song.genre || 'pop';
    const mood = song.song_mood || song.mood || '';
    const bpm = song.bpm || '';
    const duration = song.duration || '';

    const prompt = `You are a music video director and viral content strategist.

Analyze this song and select the best ${clipDuration}-second segment for a short-form promotional video.

Song Info:
- Title: ${song.name || song.title}
- Genre: ${genre}
- Mood: ${mood}
- BPM: ${bpm}
- Duration: ${duration}s
- Target goal: ${targetGoal}

Lyrics source: ${lyricContext.lyricsSource}

${timestampedTranscript ? `Timestamped transcript (authoritative; choose exact lyric phrases from here when possible):\n${timestampedTranscript}` : `Lyrics text:\n${lyrics.slice(0, 3000) || '[lyrics unavailable or instrumental]'}`}

Important rules:
- Do not invent lyrics. Use exact words from the provided transcript/lyrics.
- If the vocal is unclear, mark the phrase as "unclear lyric" and choose a segment based on emotion/beat.
- Prefer a 30-second section with connected lyric meaning, not just a generic hook.
- The best_segment.lyrics_excerpt must be copied from the transcript/lyrics when available.

Return a JSON object with:
{
  "detected_genre": "<genre>",
  "detected_mood": "<mood adjectives>",
  "detected_bpm_feel": "<slow|medium|energetic|frenetic>",
  "best_segment": {
    "start_time": <seconds>,
    "end_time": <seconds>,
    "lyrics_excerpt": "<exact lyrics in this segment>",
    "reason": "<why this is the best segment>"
  },
  "segment_type": "<hook|chorus|drop|emotional|narrative|viral_phrase>",
  "viral_hook": "<1 sentence why this is viral>",
  "energy_level": <1-10>,
  "emotional_trigger": "<emotion this evokes in listener>",
  "lyrics_source": "${lyricContext.lyricsSource}",
  "transcript_quality": "<good|partial|unclear|instrumental>",
  "story_seed": "<one sentence narrative implied by the real lyrics>"
}
Return ONLY the JSON, no markdown.`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    });

    const analysis = {
      ...JSON.parse(result.choices[0]?.message?.content || '{}'),
      lyrics_source: lyricContext.lyricsSource,
      transcribed_lyrics_excerpt: lyrics.slice(0, 1200),
      transcript_segments: lyricContext.transcriptSegments.slice(0, 80),
    };

    res.json({ success: true, analysis, song: { id: songId, name: song.name || song.title, audioUrl: song.audioUrl, genre, mood, bpm } });
  } catch (err: any) {
    logger.error('[PromoClips] analyze-song error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/promo-clips/:artistId/create-visual-direction
// Body: { genre, mood, segmentType, artistName, artistBiography, artistProfileImage, artistPersonality, brandColors, wardrobeStyle, targetPlatforms }
// ──────────────────────────────────────────────
router.post('/:artistId/create-visual-direction', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      genre, mood, segmentType, artistName, artistPersonality,
      artistBiography, artistProfileImage,
      brandColors, wardrobeStyle, targetPlatforms = ['tiktok', 'instagram_reels'],
      campaignGoal,
      // Song analysis data (passed from frontend after analyze-song)
      lyricsExcerpt, emotionalTrigger, viralHook, energyLevel, bpmFeel,
    } = req.body;

    // Cargar datos del artista desde Firestore o PostgreSQL
    let artistData: any = {};
    const artistDoc = await db.collection('artists').doc(artistId).get();
    if (artistDoc.exists) {
      artistData = artistDoc.data() as any;
    } else {
      const numericId = parseInt(artistId, 10);
      if (!isNaN(numericId)) {
        const [pgArtist] = await pgDb
          .select({ profileImage: users.profileImage })
          .from(users)
          .where(eq(users.id, numericId))
          .limit(1);
        if (pgArtist) artistData = pgArtist;
      }
    }
    const realName = artistName || artistData.name || 'the artist';
    const realBio = artistBiography || artistData.biography || artistData.description || '';
    const realGenre = genre || artistData.genre || 'pop';
    const realPersonality = artistPersonality || artistData.personality || 'charismatic performer';
    const realWardrobe = wardrobeStyle || artistData.wardrobeStyle || artistData.visual_style || 'their signature style';
    const realColors = brandColors || artistData.brandColors || artistData.brand_colors || 'not specified';
    const hasReferencePhoto = !!(artistProfileImage || artistData.profileImage);

    // KEY: Flux Kontext Pro (image-to-image) takes the artist's reference photo
    // and transforms it into a NEW cinematic scene while preserving the person's identity.
    // The prompt must start with "The same person" and describe: scene, wardrobe, lighting, mood.
    const imagePromptRule = hasReferencePhoto
      ? `CRITICAL — Flux Kontext Pro image-to-image rules:
- The model receives the artist's reference photo and will transform it into the described scene while preserving the person's face, hair, skin tone, and identity
- Start the prompt with: "The same person," then describe the new scene
- Describe ONLY: the new scene/setting, outfit/wardrobe, lighting, atmosphere, camera angle
- The scene must be directly inspired by the song's specific theme, lyrics, and emotional trigger — NOT generic genre clichés
- Wardrobe/outfit should reflect the song's concept and energy
- The image must be a REAL PHOTOGRAPH — photorealistic, cinematic. NEVER use words like "animated", "anime", "cartoon", "illustration", "painting", "3D render", "digital art"
- End every prompt with: "Cinematic 9:16 vertical portrait, photorealistic, professional music photography, no text, no watermarks"
- Keep under 100 words
- Format: "The same person, [specific scene inspired by song], [outfit matching song concept], [lighting], [mood/atmosphere]. Cinematic 9:16 vertical portrait, photorealistic, professional music photography, no text, no watermarks."`
      : `Write a complete creative scene prompt describing the artist performing in a visual setting that matches the song's theme.
Describe setting, wardrobe, lighting, mood based on the song's lyrics, emotional trigger and energy. Photorealistic, cinematic 9:16 vertical portrait, professional music photography. No text. Under 100 words.`;

    const prompt = `You are a music video director specializing in short-form viral content for ${targetPlatforms.join('/')}.

Artist: ${realName}
Genre: ${realGenre}
Mood: ${mood || 'not specified'}
Segment type: ${segmentType || 'chorus'}
Personality: ${realPersonality}
Brand colors: ${realColors}
Wardrobe style: ${realWardrobe}
Campaign goal: ${campaignGoal || 'increase streams and virality'}
Artist bio: ${realBio.slice(0, 200)}

SONG ANALYSIS — use this to build the visual concept:
- Key lyrics in the clip: "${lyricsExcerpt || 'not provided'}"
- Emotional trigger: ${emotionalTrigger || mood || 'not specified'}
- Viral hook: ${viralHook || 'not specified'}
- Energy level: ${energyLevel || 5}/10
- BPM feel: ${bpmFeel || 'medium'}

${imagePromptRule}

Return a JSON object:
{
  "scene_description": "<vivid 2-sentence scene description inspired by the lyrics>",
  "artist_action": "<what the artist is doing, matching the song's energy and lyrics>",
  "lighting": "<lighting description that matches the song's mood>",
  "camera_movement": "<camera movement type>",
  "emotion": "<dominant emotion expressed, matching the emotional trigger>",
  "wardrobe_detail": "<specific outfit inspired by the song's theme — NOT generic genre clothes>",
  "background_detail": "<background environment that reflects the song's story/imagery>",
  "color_grade": "<cinematic color grading that matches the song's mood>",
  "fal_image_prompt": "<image prompt following the rules above — describes ONLY new scene/wardrobe/lighting, NOT the person>",
  "kling_motion_prompt": "<complete prompt for Kling image-to-video: describe lip-sync motion, camera movement, emotional intensity matching the song's energy>"
}
Return ONLY the JSON, no markdown.`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const direction = JSON.parse(result.choices[0]?.message?.content || '{}');
    res.json({ success: true, direction });
  } catch (err: any) {
    logger.error('[PromoClips] create-visual-direction error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/create-character-lock
// Body: { referenceImageUrls[], primaryReferenceImageUrl?, characterNotes?, direction?, analysis? }
// ──────────────────────────────────────────────
router.post('/:artistId/create-character-lock', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      referenceImageUrls = [],
      primaryReferenceImageUrl,
      artistProfileImage,
      artistName,
      artistBiography,
      characterNotes = '',
      direction,
      analysis,
      songTitle,
    } = req.body;

    const resolvedProfileImage = primaryReferenceImageUrl || artistProfileImage || await resolveArtistProfileImage(artistId);
    const references = normalizeReferenceUrls([resolvedProfileImage, ...normalizeReferenceUrls(referenceImageUrls)]);
    if (references.length === 0) {
      return res.status(400).json({ success: false, error: 'At least one character reference image is required' });
    }

    const primaryReference = references.includes(primaryReferenceImageUrl) ? primaryReferenceImageUrl : references[0];
    const prompt = `You are a film character continuity supervisor for an AI music video pipeline.

Build a strict Character Lock bible for the same artist using the attached/reference images.

Artist: ${artistName || 'the artist'}
Song: ${songTitle || 'selected song'}
Artist bio: ${String(artistBiography || '').slice(0, 350)}
User identity notes: ${String(characterNotes || '').slice(0, 900)}
Visual direction: ${JSON.stringify(direction || {}).slice(0, 1200)}
Song analysis: ${JSON.stringify(analysis || {}).slice(0, 1000)}

Return ONLY JSON:
{
  "identityLabel": "short identity label",
  "faceLockPrompt": "precise face identity preservation rules",
  "faceBiblePrompt": "artist face bible: exact face geometry, eye spacing, nose/lips/jaw/skin/hairline/facial hair/mouth realism rules",
  "wardrobeLockPrompt": "wardrobe/style rules for continuity",
  "accessoryLockPrompt": "hat/glasses/jewelry/mic/accessory rules",
  "brollContinuityPrompt": "rules for b-roll so it remains in the same visual world and never creates a different artist",
  "lyricContinuityPrompt": "rules for connecting every scene to lyrics/story/emotion",
  "negativePrompt": "identity drift and visual errors to forbid",
  "faceQualityChecklist": ["4-6 short face checks before generating video"],
  "qualityChecklist": ["5-8 short checks before generation"]
}`;

    let rawLock: any = {};
    try {
      const content: any[] = [
        { type: 'text', text: prompt },
        ...references.slice(0, 4).map(url => ({ type: 'image_url', image_url: { url } })),
      ];
      const result = await openai.chat.completions.create({
        model: PRIMARY_MODEL,
        messages: [{ role: 'user', content } as any],
        max_tokens: 1100,
        temperature: 0.25,
        response_format: { type: 'json_object' },
      });
      rawLock = JSON.parse(result.choices[0]?.message?.content || '{}');
    } catch (visionError: any) {
      logger.warn('[PromoClips] character-lock vision analysis fallback:', visionError?.message || visionError);
    }

    const characterLock: CharacterLockPlan & { id: string; artistId: string; createdAt: string } = {
      id: `character_lock_${artistId}_${Date.now()}`,
      artistId,
      referenceImageUrls: references,
      primaryReferenceImageUrl: primaryReference,
      masterImageUrl: primaryReference,
      identityLabel: cleanPromptPart(rawLock.identityLabel, `${artistName || 'Artist'} locked identity`, 120),
      faceLockPrompt: cleanPromptPart(
        rawLock.faceLockPrompt || rawLock.face_lock_prompt,
        'Preserve the exact same person from the primary reference image: face shape, facial proportions, skin tone, age, hairstyle, facial hair, eyes, nose, lips, teeth, jawline and expression language. No beautified alternate face, no younger/older version, no lookalike.'
      ),
      wardrobeLockPrompt: cleanPromptPart(
        rawLock.wardrobeLockPrompt || rawLock.wardrobe_lock_prompt,
        'Keep wardrobe coherent with the chosen visual direction. Same outfit logic, same color family, same fit, same performance styling across all artist-visible scenes.'
      ),
      accessoryLockPrompt: cleanPromptPart(
        rawLock.accessoryLockPrompt || rawLock.accessory_lock_prompt,
        'Accessories are continuity-locked. If a hat, glasses, jewelry or microphone is visible in the approved reference, keep it stable; if not visible, do not introduce it. Never let accessories appear, disappear, flicker, morph or change.'
      ),
      brollContinuityPrompt: cleanPromptPart(
        rawLock.brollContinuityPrompt || rawLock.broll_continuity_prompt,
        'B-roll must share the same color world, lighting, props, wardrobe details and story geography. It should be object-only: instruments, empty stage/studio/club details, lyric objects, cables, microphone, guitar, drums, piano, bass, harmonica, notebook, light and reflections. It must not show a person, singer face, body, hands or unrelated world.'
      ),
      faceBiblePrompt: cleanPromptPart(
        rawLock.faceBiblePrompt || rawLock.face_bible_prompt || rawLock.faceLockPrompt || rawLock.face_lock_prompt,
        'Artist Face Bible: preserve exact face geometry, eye spacing, nose bridge, lips, teeth, jawline, cheekbones, skin tone, hairline, facial hair, age and expression language from the primary reference. The mouth must remain natural and camera-ready for lipsync. No alternate actor, no face swap, no beautified drift.',
        900
      ),
      lyricContinuityPrompt: cleanPromptPart(
        rawLock.lyricContinuityPrompt || rawLock.lyric_continuity_prompt,
        'Every scene must answer one lyric, phrase, emotion or beat from the selected song segment. Avoid generic beauty shots that do not connect to the lyric story.'
      ),
      negativePrompt: cleanPromptPart(
        rawLock.negativePrompt || rawLock.negative_prompt,
        'different person, identity drift, face swap, morphing face, inconsistent age, changing hairstyle, changing skin tone, extra singer, random actor, unstable hat, disappearing accessories, text, watermark, logo, cartoon, anime, plastic skin, distorted mouth, deformed hands',
        600
      ),
      scenePromptPrefix: '',
      qualityChecklist: Array.isArray(rawLock.qualityChecklist || rawLock.quality_checklist)
        ? (rawLock.qualityChecklist || rawLock.quality_checklist).map((item: any) => String(item).slice(0, 160)).slice(0, 8)
        : [
            'Face matches primary reference before motion generation',
            'Wardrobe and accessories remain stable',
            'B-roll connects to the lyric or emotional beat',
            'No extra singer or alternate artist appears',
            'Final audio remains the original song segment',
          ],
      faceQualityChecklist: Array.isArray(rawLock.faceQualityChecklist || rawLock.face_quality_checklist)
        ? (rawLock.faceQualityChecklist || rawLock.face_quality_checklist).map((item: any) => String(item).slice(0, 160)).slice(0, 6)
        : [
            'Face geometry matches primary reference',
            'Eyes, nose, lips, jawline and skin tone remain stable',
            'Mouth/teeth area is clean for lipsync',
            'No alternate actor or beauty-filter identity drift',
          ],
      createdAt: new Date().toISOString(),
    };
    characterLock.scenePromptPrefix = buildCharacterContinuityPrompt(characterLock);

    await db.collection('promo_clip_character_locks').doc(characterLock.id).set(characterLock, { merge: true }).catch(e => {
      logger.warn('[PromoClips] character lock auto-save failed:', e.message);
    });

    res.json({ success: true, characterLock });
  } catch (err: any) {
    logger.error('[PromoClips] create-character-lock error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/create-narrative-storyboard
// Body: { songId, analysis, direction, performancePercent, lipsyncPercent, performanceMode, brollMode }
// ──────────────────────────────────────────────
router.post('/:artistId/create-narrative-storyboard', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      songId,
      analysis,
      direction,
      performancePercent: rawPerformancePercent = 40,
      lipsyncPercent: rawLipsyncPercent = 20,
      performanceMode = 'kling-v3-standard-sync3',
      brollMode = 'kling-v3-standard-sync3',
      artistName,
      artistBiography,
      characterLock = null,
      targetGoal = 'virality',
      director = null,
    } = req.body;

    if (!songId) return res.status(400).json({ success: false, error: 'songId required' });

    const songDoc = await db.collection('songs').doc(songId).get();
    if (!songDoc.exists) return res.status(404).json({ success: false, error: 'Song not found' });
    const song = { id: songId, ...songDoc.data() } as any;

    const performancePercent = clampPercent(rawPerformancePercent, 40);
    const lipsyncPercent = Math.min(performancePercent, clampPercent(rawLipsyncPercent, 20));
    const { lipsyncSceneCount, performanceSceneCount, brollSceneCount } = calculateNarrativeSceneCounts(performancePercent, lipsyncPercent);

    const lyricContext = await resolvePromoLyrics(song, songDoc.ref);
    const songTitle = song.name || song.title || 'Untitled song';
    const lyrics = lyricContext.lyrics || analysis?.best_segment?.lyrics_excerpt || '';
    const clipStartSeconds = Math.max(0, Number(analysis?.best_segment?.start_time || 0));
    const clipEndSeconds = clipStartSeconds + NARRATIVE_TOTAL_DURATION;
    const editorialTimeline = buildEditorialCutTimeline(clipStartSeconds, `${songId}_${Date.now()}_${Math.random()}`);
    const lyricWindows = lyricContext.transcriptSegments.length > 0
      ? buildLyricWindowsForTimeline(lyricContext.transcriptSegments, editorialTimeline)
      : buildTextLyricWindowsForTimeline(lyrics, editorialTimeline);
    const timestampedTranscript = formatTranscriptSegments(lyricContext.transcriptSegments, 6000);
    const lyricWindowText = formatLyricWindows(lyricWindows);
    const mood = analysis?.detected_mood || song.song_mood || song.mood || '';
    const genre = analysis?.detected_genre || song.genre || 'music';
    const lyricsExcerpt = analysis?.best_segment?.lyrics_excerpt || lyrics.slice(0, 700);
    const resolvedProfileImage = characterLock?.primaryReferenceImageUrl || characterLock?.masterImageUrl || await resolveArtistProfileImage(artistId);
    const effectiveCharacterLock = characterLock || buildDefaultCharacterLock({
      artistName: artistName || song.artistName || 'the artist',
      profileImageUrl: resolvedProfileImage,
      genre,
      direction,
    });
    const characterContinuityPrompt = buildCharacterContinuityPrompt(effectiveCharacterLock);
    const palettePrompt = buildConceptPalettePrompt({ artistName, genre, mood, direction });
    const faceBible = buildArtistFaceBible({
      characterLock: effectiveCharacterLock,
      artistName: artistName || song.artistName || 'the artist',
      profileImageUrl: resolvedProfileImage,
    });
    const paletteBible = buildPaletteBible({ palettePrompt, genre, mood, director });
    const editingGrammar = buildEditingGrammar({ analysis, timelineCuts: editorialTimeline });
    const sourcePriority = buildNarrativeSourcePriority(lyricWindows, editorialTimeline);
    const lipsyncSourceIndexes = new Set(sourcePriority.slice(0, lipsyncSceneCount));
    const performanceSourceIndexes = new Set(sourcePriority.slice(0, performanceSceneCount));
    const detectedInstrumentPalette = getInstrumentBrollPool(genre).join('; ');
    const sourceRolePlan = Array.from({ length: NARRATIVE_TOTAL_SCENES }).map((_, sourceIndex) => {
      const sourceLyricText = lyricWindows
        .filter((_, windowIndex) => editorialTimeline[windowIndex]?.sourceIndex === sourceIndex)
        .map(window => window.text)
        .filter(hasClearLyricText)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sourceHasClearLyric = hasClearLyricText(sourceLyricText);
      const role = sourceHasClearLyric && lipsyncSourceIndexes.has(sourceIndex)
        ? 'LIPSYNC PERFORMANCE - clear artist face and mouth, exact vocal phrase'
        : sourceHasClearLyric && performanceSourceIndexes.has(sourceIndex)
        ? 'ARTISTIC PERFORMANCE - artist body language or partial presence, not necessarily mouth close-up'
        : 'STORY B-ROLL / INSTRUMENTAL - object-only; detected instruments, stage/studio details, props, empty spaces, reflections, memories and story texture; no people';
      const firstCut = sourceIndex + 1;
      return `Source ${sourceIndex + 1} / cut ${firstCut}: ${role}`;
    }).join('\n');
    const baseVisualBible = [
      faceBible.prompt,
      characterContinuityPrompt,
      paletteBible.prompt,
      editingGrammar.rhythmRule,
      editingGrammar.transitionPlan,
      `Song: ${songTitle}`,
      `Genre/mood: ${genre}, ${mood || 'song-driven emotion'}`,
      `Visual direction: ${direction?.scene_description || 'cinematic vertical short-form music video'}`,
      `Wardrobe/look: ${direction?.wardrobe_detail || 'consistent signature artist look'}`,
      `Lighting/color: ${direction?.lighting || 'professional music video lighting'}, ${direction?.color_grade || 'cinematic color grade'}`,
      `Continuity: same face, same hair, same wardrobe, stable accessories, no text, no watermark`,
    ].join('. ');

    const prompt = `You are a senior music video director and editor.

Build a coherent 30-second vertical music video as a real edited timeline of exactly ${NARRATIVE_TOTAL_CUTS} INDEPENDENT short cuts.

CUT MODEL (REFACTOR 2026-05):
- ${NARRATIVE_TOTAL_CUTS} cuts. Each cut is its OWN paid video generation (no pair-splitting from a shared source).
- Each cut lasts between 1.8s and 3.0s (variable per cut — already pre-computed in the lyric map below). Total timeline ≤ 30s.
- Each cut MUST be a different scene: different location/set, different time-of-day, different prop staging, different camera setup, different action beat. Do NOT repeat the same room, wardrobe piece or symbol across consecutive cuts.
- Effects allowed and encouraged: slow-mo, jump-cut, light flash, lens flare, whip pan, rack focus, freeze-frame, neon flicker, smoke pass, mirror reflection, water reflection, anamorphic streak, sparks, dust motes, projection mapping.

LOCKED GLOBAL STYLE (every cut MUST respect):
- Campaign palette and color grade (see palette below) — same dominant colors across all 12 cuts.
- Artist identity from the locked reference image: same face, same hair, same skin tone, same overall age and look.
- Face Bible comes before creativity: if a cut shows the artist, the face must match the primary reference before any motion/video generation.
- Wardrobe FAMILY (e.g. blues/leather/streetwear) — but the specific piece/outfit MAY change per cut as long as it stays inside the family.
- Genre/mood emotional register.
- Editing grammar: ${editingGrammar.rhythmRule} ${editingGrammar.transitionPlan}

PER-CUT CREATIVE FREEDOM (you, the director, decide):
- Invent a unique location per cut (street, alley, rooftop, club, studio, dressing room, neon corridor, car interior, mirror room, stage wing, vinyl shop, smoke-filled bar, hotel hallway, motorbike garage, etc — let the lyric of THAT cut suggest it).
- Invent a unique prop/action/symbol per cut tied to the lyric of that exact window.
- Invent a unique camera setup and effect per cut.
- DO NOT repeat any location, prop or wardrobe piece from any previous cut. Use the forbiddenRepeats field in your output to track what you used.

ANTI-CLONE RULE (CRITICAL — fixes prior failure):
- Reading your previous storyboards: cuts looked almost identical because the same setting/wardrobe/pose was reused. THIS IS FORBIDDEN.
- Two adjacent cuts MUST visually feel like two different scenes from the same campaign, NOT two slightly reframed versions of the same still.

WARDROBE VARIATION MANDATE (CRITICAL — this is a music video, not a photo shoot):
- The artist's signature hat (fedora, cap, etc.) may appear in AT MOST 2 cuts out of 12. The other 10 cuts must show the artist WITHOUT the hat, or with a completely different head item.
- Dark sunglasses / tinted glasses may appear in AT MOST 2 cuts. Other cuts show the artist with no glasses or different eyewear.
- Every wardrobePiece field MUST be DIFFERENT from every other cut. If cut 1 has "black turtleneck", cut 2 CANNOT also have "black turtleneck". Pick: open-collar shirt, white tank top, leather jacket (no turtleneck), oversized hoodie, blazer over bare chest, etc.
- Some cuts should show the artist in BRIGHT or COLORED clothing — not always all-black.
- The profile photo outfit (hat + sunglasses + black turtleneck + black blazer) should appear in at MOST 1 cut as a tribute to the reference look.
- If you repeat hat+sunglasses in more than 2 cuts, you have failed this directive.

THREE-ACT STRUCTURE MANDATE — 12 cuts MUST follow this narrative arc:
- CUTS 1-3 (ACT_1 — SETUP): Wider shots, cooler or more muted color temperature. Establish the emotional world and the artist's state. Visually calm relative to what follows. Favor "broll" or "story" sceneType for at least 1 of these cuts.
- CUTS 4-9 (ACT_2 — DEVELOPMENT): Tighter framing, building intensity, warmer or more saturated palette. The emotional journey deepens — conflict, longing, transformation, hunger. Mix of "performance", "broll" and "story". Camera gets more restless and personal.
- CUTS 10-12 (ACT_3 — CLIMAX + RESOLUTION): Most dynamic camera work, boldest visual choices, peak emotional moment in cuts 10-11, then resolution or powerful freeze in cut 12. Highest color saturation or highest contrast moment of the whole piece.
Each scene MUST include "act": "ACT_1" | "ACT_2" | "ACT_3" in the JSON.

SHOT DISTRIBUTION MANDATE — across the 12 cuts you MUST include:
- 3-4 cuts: sceneType "performance" (artist singing/performing on screen, body + energy visible)
- 4-5 cuts: sceneType "broll" (cinematic insert — NO artist, object/location/symbol/texture)
- 3-4 cuts: sceneType "story" (narrative scene — characters, locations, props that TELL the lyric without being pure b-roll)
Do NOT make all cuts "performance". Spread energy across all three types and interleave them.

VISUAL PROGRESSION — imagePrompt and palettePrompt MUST reflect the act they belong to:
- ACT_1 cuts: cooler/desaturated tones, wider focal lengths (35mm-50mm feel), world-establishing, calm depth of field
- ACT_2 cuts: mid-range warmth building, medium lenses (24mm-35mm feel), intimacy growing, slight push-in energy
- ACT_3 cuts: warmest/most saturated OR highest contrast, wide-angle OR extreme close-up, maximum emotional impact — the viewer must FEEL the culmination

SHOT CONTINUITY + QC MANDATE:
- Every cut needs one unique lens/framing idea, one motivated light source, one edit cue and one transition cue.
- Artist-visible cuts must pass Face Bible QC: reference face, mouth, eyes, nose, lips, jawline, skin tone, hairline and age all stable.
- B-roll cuts must be object-only and should never accidentally generate a person, singer, face, body or hand.
- The final edit should feel like a professional 30-second music video: microcuts on lyric phrases/downbeats, not twelve unrelated AI clips.

${director ? `DIRECTOR SIGNATURE — ${director.name || 'Selected Director'}:
- Visual style: ${director.visual_style?.description || director.authorial_identity?.one_liner || ''}
- Camera preferences: ${(director.camera_preferences?.favorite_shot_types || director.camera_preferences?.shot_types || []).slice(0, 3).join(', ') || ''} — movements: ${(director.camera_preferences?.favorite_movements || director.camera_preferences?.movements || []).slice(0, 2).join(', ') || ''}
- Lighting approach: ${(director.lighting_style?.key_techniques || []).slice(0, 2).join('; ') || director.lighting_style?.description || ''}
- Color palette: ${[...(director.visual_style?.color_palette?.primary_colors || []).slice(0, 2), ...(director.visual_style?.color_palette?.accent_colors || []).slice(0, 1)].join(', ') || ''}
- Color grade: ${director.post_production?.color_grading_style || ''}
- Forbidden visuals (never generate these): ${(director.visual_style?.forbidden_visuals || []).slice(0, 4).join('; ') || 'none'}
- Signature techniques: ${(director.visual_style?.signature_techniques || director.visual_style?.image_rules || []).slice(0, 3).join('; ') || ''}
Apply this director's visual language consistently — every imagePrompt must carry these stylistic fingerprints.` : ''}

Song:
- Title: ${songTitle}
- Genre: ${genre}
- Mood: ${mood || 'not specified'}
- BPM feel: ${analysis?.detected_bpm_feel || song.bpm || 'medium'}
- Clip time: ${clipStartSeconds}s to ${clipEndSeconds}s
- Campaign goal: ${targetGoal}
- Artist: ${artistName || 'the artist'}
- Artist bio: ${String(artistBiography || '').slice(0, 250)}

Lyrics source: ${lyricContext.lyricsSource}

${timestampedTranscript ? `Timestamped transcript (authoritative; use exact words and timestamps):\n${timestampedTranscript}` : `Lyrics/context:\n${String(lyrics).slice(0, 3500) || '[lyrics unavailable or instrumental]'}`}

Per-cut lyric map (each entry is ONE independent cut):
${lyricWindowText}

Existing analysis:
${JSON.stringify(analysis || {}).slice(0, 1400)}

Locked Face Bible:
${faceBible.prompt}

Locked Palette Bible / color grade:
${paletteBible.prompt}

Locked Editing Grammar:
${editingGrammar.rhythmRule}
${editingGrammar.transitionPlan}
${editingGrammar.microCutRule}

Character lock (artist identity rules — ALWAYS preserve):
${characterContinuityPrompt}

Detected instrument/story b-roll palette for instrumental or unclear cuts:
${detectedInstrumentPalette}

Mandatory source role plan (which cuts are lipsync vs performance vs b-roll):
${sourceRolePlan}

Quota:
- Exactly ${lipsyncSceneCount} cuts MUST be lipsync (clear artist face + visible mouth performance, lyric exactly matches transcript).
- Exactly ${performanceSceneCount} cuts feature the artist (lipsync cuts count toward this).
- The remaining ${brollSceneCount} cuts are pure object-only story b-roll: instruments, props, locations, lyric objects, light, reflections — NO visible person.
- Interleave lipsync / performance / b-roll energy across the timeline. Avoid clustering one type.
- Story b-roll cuts: NEVER show the artist or any person. Use objects/locations/instruments/light from the locked world.

CONTENT GROUNDED IN REAL LYRICS (CRITICAL — this is what makes the images cinematic and story-driven):
- Do not invent lyrics. lyricsExcerpt MUST be copied verbatim from the transcript when words exist.
- Every visualIntent, imagePrompt and lyricConnection MUST be directly inspired by the SPECIFIC WORDS in lyricsExcerpt for that cut.
  * Example: if the lyric is "tus labios son veneno", the image should show lips, poison, something dangerous and seductive — NOT a generic performance shot.
  * Example: if the lyric is "me quedé sin ti", the image should show emptiness, a vacant chair, a doorway with no one there.
  * Example: if the lyric is "el blues de mi alma", the image should show a blues musician, raw soul, dimly lit stage, harmonica, old guitar.
- The imagePrompt field MUST describe a CINEMATIC STILL that could be a film frame — shallow depth of field, specific lighting rig, named location textures, a clear focal subject that EMBODIES the lyric.
- Do NOT write imagePrompt as a list of features. Write it as a SCENE: "Close-up of [subject], [lighting], [background], [mood], [camera detail]."
- If a window is instrumental/unclear, choose a concrete music/story insert that reflects the emotional arc at that point in the song. No generic ocean/storm/clouds.

IMAGE QUALITY DIRECTIVE — cinematic stills:
- Every imagePrompt must reference: (1) a specific camera angle/lens feel, (2) a specific light source or rig, (3) a specific background texture/depth, (4) a clear emotional register.
- Good: "Medium close-up, artist under tungsten amber bar light, worn brick wall behind, smoke drifting through the frame, eyes closed mid-phrase, slow rack focus"
- Bad: "A man performing in a dark place with colored lights"

Return ONLY JSON:
{
  "title": "<short storyboard name>",
  "concept": "<one sentence music video concept>",
  "narrativeArcPlan": "<1-3 sentences describing the emotional arc across the 12 cuts and how they connect>",
  "visualBible": "<compact continuity bible: palette, lighting language, wardrobe family, identity rules>",
  "lyricContinuityPlan": "<how the 12 cuts connect to the selected lyric/story>",
  "editingGrammar": "<how the final 30s edit cuts to BPM, lyrics, transitions and microcut rhythm>",
  "scenes": [
    {
      "act": "<ACT_1|ACT_2|ACT_3>",
      "shotType": "<close-up|medium|wide|detail|b-roll|hero|insert>",
      "cameraMovement": "<specific movement>",
      "lensPrompt": "<lens/framing language for this cut>",
      "lightingPrompt": "<motivated light and color logic for this cut>",
      "editCue": "<exact editorial beat/entry/exit cue>",
      "transition": "<hard cut|match cut|light flash|whip pan|rack focus|freeze-frame>",
      "qualityChecklist": ["3-6 checks specific to this cut"],
      "effect": "<slow-mo|jump-cut|whip-pan|rack-focus|freeze-frame|light-flash|smoke-pass|mirror-reflection|lens-flare|none>",
      "location": "<unique location for THIS cut — must differ from every previous cut>",
      "timeOfDay": "<dawn|day|golden-hour|dusk|night|interior-lit>",
      "wardrobePiece": "<specific wardrobe piece worn in this cut (inside the locked family) OR 'b-roll: no person'>",
      "propStaging": "<specific prop/object staged in this cut>",
      "actionBeat": "<exact physical action for this 2-3s cut>",
      "lyricsExcerpt": "<exact lyric words for this cut, or 'instrumental / unclear lyric'>",
      "lyricConnection": "<what lyric/emotion this exact cut answers>",
      "visualIntent": "<what happens on screen in 1-2 sentences>",
      "emotion": "<emotion>",
      "continuityPrompt": "<identity/wardrobe/world continuity note>",
      "brollSubject": "<if b-roll: object/location/detail; otherwise empty>",
      "forbiddenRepeats": "<comma-separated list of locations/props/wardrobe used in earlier cuts so this cut is forced to diverge>",
      "imagePrompt": "<photorealistic 9:16 reference-frame prompt — bake in the unique location, prop and wardrobe of THIS cut>",
      "videoPrompt": "<motion + camera + effect prompt for THIS cut's video generation>"
    }
  ]
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 4000,
      temperature: 0.85,
      response_format: { type: 'json_object' },
    });

    const rawStoryboard = JSON.parse(result.choices[0]?.message?.content || '{}');
    const visualBible = String(rawStoryboard.visualBible || rawStoryboard.visual_bible || baseVisualBible).slice(0, 1200);
    const lyricContinuityPlan = String(rawStoryboard.lyricContinuityPlan || rawStoryboard.lyric_continuity_plan || 'Twelve independent short editorial cuts (1.8s-3s each) mapped to the lyric, locked to one campaign palette and artist identity, with a different location/prop/wardrobe per cut.').slice(0, 900);
    const scenes = normalizeNarrativeScenes(rawStoryboard.scenes || [], {
      clipStartSeconds,
      performanceMode,
      brollMode,
      lipsyncSceneCount,
      performanceSceneCount,
      timelineCuts: editorialTimeline,
      visualBible,
      palettePrompt,
      faceBible,
      paletteBible,
      editingGrammar,
      characterPrompt: characterContinuityPrompt,
      lyricContinuityPlan,
      songTitle,
      artistName: artistName || song.artistName || '',
      genre,
      lyricsExcerpt,
      lyricWindows,
      mood,
    });
    const totalEstimatedCost = scenes.reduce((sum, scene) => sum + scene.estimatedCost, 0);
    const storyboardId = `storyboard_${artistId}_${Date.now()}`;
    const storyboard = {
      id: storyboardId,
      title: rawStoryboard.title || `${songTitle} 30s Narrative Promo`,
      concept: rawStoryboard.concept || `A coherent 30-second vertical music video for ${songTitle}.`,
      narrativeArcPlan: String(rawStoryboard.narrativeArcPlan || rawStoryboard.narrative_arc_plan || '').slice(0, 1000),
      songId,
      songTitle,
      duration: NARRATIVE_TOTAL_DURATION,
      clipStartSeconds,
      clipEndSeconds,
      sceneDuration: NARRATIVE_SCENE_DURATION,
      sourceSceneDuration: NARRATIVE_SCENE_DURATION,
      sourceSceneCount: NARRATIVE_TOTAL_SCENES,
      totalCuts: scenes.length,
      editMode: 'twelve-independent-variable-cuts',
      performancePercent,
      lipsyncPercent,
      performanceSceneCount,
      lipsyncSceneCount,
      brollSceneCount,
      performanceMode,
      brollMode,
      visualBible,
      palettePrompt,
      faceBiblePrompt: faceBible.prompt,
      faceQualityChecklist: faceBible.qualityChecklist,
      paletteBiblePrompt: paletteBible.prompt,
      paletteBible,
      editingGrammar,
      editingGrammarPrompt: rawStoryboard.editingGrammar || rawStoryboard.editing_grammar || editingGrammar.microCutRule,
      lyricContinuityPlan,
      lyricsSource: lyricContext.lyricsSource,
      characterLock: effectiveCharacterLock || null,
      estimatedCost: Number(totalEstimatedCost.toFixed(2)),
      costBreakdown: {
        paidSourceScenes: NARRATIVE_TOTAL_SCENES,
        timelineCuts: scenes.length,
        lipsyncScenes: lipsyncSceneCount,
        performanceOnlyScenes: performanceSceneCount - lipsyncSceneCount,
        brollScenes: brollSceneCount,
        imageGenerationEstimate: 0.12,
        totalWithImages: Number((totalEstimatedCost + 0.12).toFixed(2)),
      },
      scenes,
      createdAt: new Date().toISOString(),
    };

    await db.collection('promo_clip_storyboards').doc(storyboardId).set({ artistId, ...storyboard }, { merge: true }).catch(e => {
      logger.warn('[PromoClips] storyboard auto-save failed:', e.message);
    });

    res.json({ success: true, storyboard });
  } catch (err: any) {
    logger.error('[PromoClips] create-narrative-storyboard error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-fal-image
// Body: { falImagePrompt, referenceImageUrl, artistProfileImage, songName, artistName, imageModel? }
// Submits async job to FAL queue → returns { pending: true, requestId, statusUrl, resultUrl, endpoint }
// When no reference photo → sync fal-ai/flux/dev T2I (fast, 10-20s)
// ──────────────────────────────────────────────
const FAL_QUEUE_URL = 'https://queue.fal.run';
const FAL_MODEL_KONTEXT = 'fal-ai/flux-pro/kontext'; // image-to-image, photorealistic, identity-preserving
const FAL_MODEL_KONTEXT_T2I = 'fal-ai/flux-pro/kontext/text-to-image'; // text-to-image concept frames; avoids copying profile photos
const FAL_MODEL_FLUX_DEV = 'fal-ai/flux/dev';

function formatFalError(error: any, fallback = 'FAL request failed'): string {
  const detail = error?.response?.data?.detail || error?.response?.data?.error;
  if (Array.isArray(detail)) return detail.map((item: any) => item?.msg || item?.type || JSON.stringify(item)).join('; ');
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (error?.response?.status === 405) {
    return 'FAL rejected the HTTP method for this endpoint. The request was moved to the queue API path; if this repeats, refresh and retry the generation.';
  }
  return error?.message || fallback;
}

async function submitFalQueue(endpoint: string, input: Record<string, any>, timeout = 15000) {
  const response = await axios.post(
    `${FAL_QUEUE_URL}/${endpoint}`,
    input,
    { headers: { Authorization: `Key ${FAL_API_KEY}`, 'Content-Type': 'application/json' }, timeout }
  );
  const requestId = response.data?.request_id;
  if (!requestId) throw new Error(`No request_id returned from ${endpoint} queue — response: ${JSON.stringify(response.data)}`);
  return {
    requestId,
    statusUrl: response.data?.status_url || `${FAL_QUEUE_URL}/${endpoint}/requests/${requestId}/status`,
    resultUrl: response.data?.response_url || `${FAL_QUEUE_URL}/${endpoint}/requests/${requestId}`,
  };
}

const HOLLYWOOD_FRAME_RULES = [
  'Hollywood-grade music-video frame, ARRI Alexa 35 feel, premium cinema lenses, intentional motivated lighting, filmic contrast, natural skin tones, precise color separation, clean highlights, rich shadows.',
  'Frame must look like a real production still from a high-end music video, not an AI portrait, not a generic fashion shoot, not a copied profile photo.',
].join(' ');

const FACE_IDENTITY_RULES = [
  'FACE LOCK: preserve the exact same person from the identity reference image: facial geometry, eye spacing, nose bridge, lips, jawline, cheekbones, skin tone, apparent age, hairline, facial hair and expression language.',
  'The face must be sharp, natural, symmetrical enough for camera realism, with realistic teeth and mouth area, no melted skin, no beauty-filter identity drift, no alternate actor, no face swap.',
].join(' ');

router.post('/:artistId/generate-fal-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { falImagePrompt, referenceImageUrl, artistProfileImage, imageModel } = req.body;

    if (!falImagePrompt) return res.status(400).json({ success: false, error: 'falImagePrompt required' });
    if (!FAL_API_KEY) return res.status(500).json({ success: false, error: 'FAL_API_KEY not configured' });

    // Prioridad: referenceImageUrl > artistProfileImage > Firestore profileImage
    let baseImageUrl = referenceImageUrl || artistProfileImage || null;

    // Si aún no hay imagen, intentar cargarla de Firestore o PostgreSQL
    if (!baseImageUrl) {
      const artistDoc = await db.collection('artists').doc(artistId).get();
      if (artistDoc.exists) {
        const data = artistDoc.data() as any;
        baseImageUrl = data?.profileImage || data?.imageUrl || null;
      }
      if (!baseImageUrl) {
        const numericId = parseInt(artistId, 10);
        if (!isNaN(numericId)) {
          const [pgArtist] = await pgDb
            .select({ profileImage: users.profileImage })
            .from(users)
            .where(eq(users.id, numericId))
            .limit(1);
          baseImageUrl = pgArtist?.profileImage || null;
        }
      }
    }

    const songName = req.body.songName || '';
    const artistNameForGallery = req.body.artistName || '';

    logger.log(`[PromoClips] 🎨 generate-fal-image — model=${imageModel || 'flux-kontext'} baseImage=${baseImageUrl ? baseImageUrl.substring(0, 60) : 'none (T2I)'}`);
    logger.log(`[PromoClips] Prompt: ${falImagePrompt.substring(0, 120)}...`);

    if (baseImageUrl) {
      // ── IDENTITY-PRESERVING GENERATION: 3 Flux Kontext Pro jobs in parallel ──
      // Flux Kontext Pro (image-to-image) takes the artist's reference photo and
      // transforms it into cinematic scenes while preserving the person's identity.
      // Far superior to PuLID — produces real photorealistic results.
      const selectedModel = imageModel || FAL_MODEL_KONTEXT;
      const genre = (req.body.genre || '').toLowerCase();
      const isClassic = genre.includes('classic') || genre.includes('opera') || genre.includes('jazz') || genre.includes('flamenco') || genre.includes('acoustic');
      const micType = isClassic ? 'vintage ribbon microphone on a stand' : 'professional modern microphone stand';

      // Ensure prompt starts with "The same person" for Flux Kontext identity preservation
      const ensureKontextPrompt = (p: string) => {
        const clean = p.replace(/\.?\s*(cinematic 9:16.*|no text.*|no watermark.*)/gi, '').trim();
        const hasRef = /^the same person/i.test(clean);
        return hasRef ? clean : `The same person, ${clean}`;
      };
      const promptSuffix = 'Cinematic 9:16 vertical portrait, photorealistic, professional music photography, no text, no watermarks.';
      const baseScene = ensureKontextPrompt(falImagePrompt);

      const shotPrompts = [
        // 1. Full scene — as described by the AI
        `${baseScene}. ${promptSuffix}`,
        // 2. Close-up — face and shoulders
        `${baseScene}, extreme close-up portrait, face and upper shoulders only, intense emotional expression, shallow depth of field, dramatic lighting. ${promptSuffix}`,
        // 3. Stage performance
        `${baseScene}, performing live on stage, ${micType} visible, dramatic spotlights, crowd blur in background. ${promptSuffix}`,
      ];

      const kontextBase = {
        image_url: baseImageUrl,
        aspect_ratio: '9:16',
        output_format: 'jpeg',
        safety_tolerance: '6',
        num_images: 1,
      };

      // Submit all 3 jobs in parallel
      const jobResults = await Promise.allSettled(
        shotPrompts.map((prompt, i) =>
          submitFalQueue(selectedModel, { ...kontextBase, prompt }, 15000).then(job => ({
            requestId: job.requestId,
            statusUrl: job.statusUrl,
            resultUrl: job.resultUrl,
            shotType: ['scene', 'closeup', 'stage'][i],
          }))
        )
      );

      const jobs = jobResults
        .filter(r => r.status === 'fulfilled' && r.value?.requestId)
        .map(r => (r as PromiseFulfilledResult<any>).value);

      if (jobs.length === 0) {
        const reasons = jobResults
          .filter(r => r.status === 'rejected')
          .map(r => formatFalError((r as PromiseRejectedResult).reason))
          .filter(Boolean)
          .join(' | ');
        throw new Error(reasons || 'No Flux Kontext jobs were queued successfully');
      }

      logger.log(`[PromoClips] ✅ Queued ${jobs.length}/3 Flux Kontext shot jobs | model=${selectedModel}`);

      return res.json({
        success: true,
        pending: true,
        jobs,
        endpoint: selectedModel,
        mode: 'identity',
        songName,
        artistName: artistNameForGallery,
        falImagePrompt,
      });

    } else {
      // ── FALLBACK: T2I por queue cuando no hay foto de perfil ──
      const job = await submitFalQueue(FAL_MODEL_FLUX_DEV, {
        prompt: falImagePrompt,
        image_size: 'portrait_16_9',
        num_images: 6,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        enable_safety_checker: false,
      }, 15000);

      logger.log(`[PromoClips] ✅ Queued Flux Dev T2I fallback (sin foto ref) request=${job.requestId}`);

      return res.json({
        success: true,
        pending: true,
        jobs: [{ ...job, shotType: 't2i-fallback' }],
        endpoint: FAL_MODEL_FLUX_DEV,
        mode: 'generate',
        songName,
        artistName: artistNameForGallery,
        falImagePrompt,
      });
    }
  } catch (err: any) {
    const httpStatus = err?.response?.status;
    const falDetail = err?.response?.data?.detail || err?.response?.data?.error || '';
    if (httpStatus === 403 && (falDetail?.toLowerCase().includes('balance') || falDetail?.toLowerCase().includes('locked'))) {
      return res.status(402).json({ success: false, error: '💳 Saldo FAL agotado — recarga en fal.ai/dashboard/billing para continuar.', fal_error: falDetail });
    }
    const message = formatFalError(err);
    logger.error('[PromoClips] generate-fal-image error:', falDetail || message);
    res.status(500).json({ success: false, error: falDetail || message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-narrative-scene-image
// Body: { scene, identityReferenceUrl?, characterLock }
// Creates a new 9:16 concept still/reference frame before spending video credits.
// ──────────────────────────────────────────────
router.post('/:artistId/generate-narrative-scene-image', authenticate, async (req: Request, res: Response) => {
  try {
    const { scene, imageUrl, identityReferenceUrl, characterLock = null, director = null } = req.body;
    if (!scene?.id) return res.status(400).json({ success: false, error: 'scene.id required' });
    if (!FAL_API_KEY) return res.status(500).json({ success: false, error: 'FAL_API_KEY not configured' });

    const isStoryOnly = scene.sceneType === 'broll' || scene.sceneType === 'cutaway';
    const sceneSymbolBeat = buildDualityLoveConflictBeat({
      index: Number(scene.index ?? 0),
      sceneType: scene.sceneType,
      lyricText: `${scene.lyricsExcerpt || ''} ${scene.lyricConnection || ''}`,
      nearbyLyricText: `${scene.visualIntent || ''} ${scene.imagePrompt || ''}`,
      mood: scene.emotion,
    });
    const rawSceneBrollSubject = String(scene.brollSubject || '').slice(0, 320);
    const generatedSceneBrollSubject = buildVideoclipBrollSubject({
      lyricText: scene.lyricsExcerpt,
      nearbyLyricText: scene.lyricConnection,
      genre: `${scene.palettePrompt || ''} ${scene.imagePrompt || ''} ${scene.videoPrompt || ''}`,
      mood: scene.emotion,
      sourceIndex: Number(scene.sourceIndex ?? 0),
      cutIndex: Number(scene.index ?? 0),
    });
    const safeSceneBrollSubject = isStoryOnly
      ? (sceneSymbolBeat?.brollSubject || (rawSceneBrollSubject && !looksStaticRepeatedSymbol(rawSceneBrollSubject) ? rawSceneBrollSubject : generatedSceneBrollSubject))
      : rawSceneBrollSubject;
    const rawScenePrompt = String(scene.imagePrompt || scene.visualIntent || '').slice(0, 1200);
    // REFACTOR 2026-05-D: prompt now builds from the LYRIC UP, not from a generic visual label.
    // Three layers: (1) what lyric is sung → drives visual metaphor,
    //               (2) what the AI director decided happens → sceneCore + staging,
    //               (3) palette + forbidden clone.
    const identityReferenceCandidates = normalizeReferenceUrls([
      identityReferenceUrl,
      characterLock?.primaryReferenceImageUrl,
      characterLock?.masterImageUrl,
      characterLock?.referenceImageUrls,
      imageUrl,
    ]);
    const resolvedProfileImage = !isStoryOnly && identityReferenceCandidates.length === 0
      ? await resolveArtistProfileImage(req.params.artistId)
      : null;
    const identityStillReferenceUrl = !isStoryOnly
      ? (identityReferenceCandidates[0] || resolvedProfileImage || '')
      : '';
    if (!isStoryOnly && !identityStillReferenceUrl) {
      return res.status(400).json({
        success: false,
        error: 'Artist-visible scene requires an identity reference image. Upload/choose an artist profile image first so the face can stay consistent.',
      });
    }
    const modelPath = !isStoryOnly && identityStillReferenceUrl ? FAL_MODEL_KONTEXT : FAL_MODEL_KONTEXT_T2I;
    const artistNameT2I = cleanPromptPart(
      characterLock?.identityLabel?.replace(/canonical profile identity/i, '').trim(),
      'the artist',
      60
    );

    // Layer 1 — lyric anchor: the EXACT line being performed in this cut
    const lyricLine = (() => {
      const raw = String(scene.lyricsExcerpt || '').trim();
      if (!raw || raw === 'instrumental / unclear lyric') return '';
      return cleanPromptPart(raw, '', 130);
    })();

    // Layer 2 — story context: what this lyric moment MEANS visually
    const storyContext = cleanPromptPart(scene.lyricConnection, '', 200);

    // Layer 3 — visual intent: what happens on screen (from the storyboard AI director)
    const sceneCore = isStoryOnly
      ? cleanPromptPart(safeSceneBrollSubject || scene.visualIntent, 'cinematic music-video b-roll insert', 280)
      : cleanPromptPart(scene.visualIntent || rawScenePrompt, 'cinematic music-video performance moment', 280);

    // Layer 4 — staging: per-cut location / wardrobe / prop / camera / effect
    const sceneLocation = cleanPromptPart((scene as any).location, '', 100);
    const sceneWardrobe = cleanPromptPart((scene as any).wardrobePiece, '', 80);
    const sceneProp = cleanPromptPart((scene as any).propStaging, '', 80);
    const sceneAction = cleanPromptPart((scene as any).actionBeat, '', 100);
    const sceneEffect = cleanPromptPart((scene as any).effect, '', 60);
    const sceneTimeOfDay = cleanPromptPart((scene as any).timeOfDay, '', 30);
    const sceneCameraMovement = cleanPromptPart(scene.cameraMovement, '', 80);
    const sceneShotType = cleanPromptPart(scene.shotType, '', 60);
    const sceneEmotion = cleanPromptPart(scene.emotion, '', 50);
    const sceneLens = cleanPromptPart((scene as any).lensPrompt, '', 110);
    const sceneLighting = cleanPromptPart((scene as any).lightingPrompt, '', 170);
    const sceneContinuity = cleanPromptPart((scene as any).shotContinuityPrompt, '', 260);
    const scenePipelineRole = cleanPromptPart((scene as any).pipelineRole, '', 90);
    const sceneFaceBible = cleanPromptPart((scene as any).faceBiblePrompt || characterLock?.faceBiblePrompt, '', 420);
    const scenePaletteBible = cleanPromptPart((scene as any).paletteBiblePrompt || scene.palettePrompt, '', 380);
    const sceneQc = Array.isArray((scene as any).qualityChecklist)
      ? (scene as any).qualityChecklist.map((item: any) => String(item).slice(0, 120)).slice(0, 6).join(' | ')
      : '';

    const stagingDetails = [
      sceneLocation && `Location: ${sceneLocation}`,
      sceneTimeOfDay && `Time of day: ${sceneTimeOfDay}`,
      !isStoryOnly && sceneWardrobe && `Wardrobe: ${sceneWardrobe}`,
      sceneProp && `Prop: ${sceneProp}`,
      sceneAction && `Action: ${sceneAction}`,
      sceneShotType && `Shot: ${sceneShotType}`,
      sceneLens && `Lens: ${sceneLens}`,
      sceneLighting && `Lighting: ${sceneLighting}`,
      sceneCameraMovement && `Camera: ${sceneCameraMovement}`,
      sceneEmotion && `Emotion: ${sceneEmotion}`,
      sceneEffect && sceneEffect.toLowerCase() !== 'none' && `Effect: ${sceneEffect}`,
      sceneContinuity && `Shot continuity: ${sceneContinuity}`,
    ].filter(Boolean).join('. ');

    const paletteShort = cleanPromptPart(scenePaletteBible || scene.palettePrompt, '', 380);

    // Director signature — inject if a director was selected
    const directorStyle = (() => {
      if (!director) return '';
      const style = director.visual_style?.description || director.authorial_identity?.one_liner || '';
      const lighting = (director.lighting_style?.key_techniques || [])[0] || director.lighting_style?.mood_lighting || '';
      const primaryColors = (director.visual_style?.color_palette?.primary_colors || []).slice(0, 2);
      const accentColors = (director.visual_style?.color_palette?.accent_colors || []).slice(0, 1);
      const palette = [...primaryColors, ...accentColors].join(', ');
      const grade = director.post_production?.color_grading_style || '';
      return [
        style && `${director.name || 'Director'} style: ${style.slice(0, 80)}.`,
        lighting && `Lighting: ${lighting.slice(0, 70)}.`,
        palette && `Color palette: ${palette}.`,
        grade && `Grade: ${grade.slice(0, 60)}.`,
      ].filter(Boolean).join(' ');
    })();
    const directorForbidden = director
      ? (director.visual_style?.forbidden_visuals || []).slice(0, 3).join('; ')
      : '';

    const promptParts = isStoryOnly
      ? [
          // Object-only b-roll: lyric moment drives the object/symbol, no person.
          `Music-video b-roll insert for the lyric moment "${lyricLine || storyContext || 'instrumental section'}":`,
          sceneCore,
          stagingDetails,
          directorStyle,
          paletteShort && `Color palette: ${paletteShort}`,
          scenePipelineRole && `Pipeline role: ${scenePipelineRole}.`,
          sceneQc && `QC checklist: ${sceneQc}.`,
          'No visible person, no face, no body, no portrait.',
          directorForbidden && `Avoid: ${directorForbidden}.`,
          'Photorealistic 9:16 vertical, cinematic music-video editorial insert, shallow depth of field, no text, no watermark.',
        ]
      : [
          // Performance cut: lyric-first → scene → staging → director → palette → quality tail.
          lyricLine && `For the lyric "${lyricLine}" —`,
          `${artistNameT2I ? `${artistNameT2I}` : 'Male artist'}, ${sceneCore}.`,
          storyContext && `Story context: ${storyContext}.`,
          stagingDetails,
          directorStyle,
          paletteShort && `Color palette: ${paletteShort}`,
          scenePipelineRole && `Pipeline role: ${scenePipelineRole}.`,
          sceneFaceBible && `Face Bible: ${sceneFaceBible}.`,
          sceneQc && `QC checklist before video: ${sceneQc}.`,
          buildCharacterContinuityPrompt(characterLock),
          FACE_IDENTITY_RULES,
          HOLLYWOOD_FRAME_RULES,
          'Photorealistic 9:16 vertical music-video frame, cinematic depth of field, dramatic lighting, no text, no watermark.',
          directorForbidden && `Avoid: ${directorForbidden}.`,
          'Forbidden: grey studio backdrop, black fedora + dark sunglasses portrait clone, static frontal pose identical to a press photo.',
        ];

    const prompt = promptParts.filter(Boolean).join(' ').slice(0, 1900);

    const input: Record<string, any> = {
      prompt,
      aspect_ratio: '9:16',
      output_format: 'jpeg',
      safety_tolerance: '6',
      num_images: 1,
    };
    if (identityStillReferenceUrl) input.image_url = identityStillReferenceUrl;

    logger.log(`[PromoClips] 🎬 scene-image cut=${(scene.index ?? 0) + 1} mode=${identityStillReferenceUrl ? 'identity-kontext' : 't2i'} prompt="${prompt.slice(0, 220)}..."`);

    const job = await submitFalQueue(modelPath, input, 15000);

    res.json({
      success: true,
      sceneId: scene.id,
      requestId: job.requestId,
      endpoint: modelPath,
      mode: identityStillReferenceUrl ? 'identity-kontext-image' : 'concept-text-to-image',
      statusUrl: job.statusUrl,
      resultUrl: job.resultUrl,
      message: 'Narrative concept still queued',
    });
  } catch (err: any) {
    const falDetail = err?.response?.data?.detail || err?.response?.data?.error || '';
    const message = formatFalError(err);
    logger.error('[PromoClips] generate-narrative-scene-image error:', falDetail || message);
    res.status(500).json({ success: false, error: falDetail || message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-lipsync-video
// Body: { mode: 'omnihuman'|'seedance-fast-r2v'|'kling-v21-standard-sync3'|'kling-v3-standard-sync3'|'kling-v3-pro-sync3', imageUrl, identityImageUrl, audioUrl, klingPrompt, seedancePrompt, clipStartSeconds, lyricsExcerpt }
// ──────────────────────────────────────────────
router.post('/:artistId/generate-lipsync-video', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      mode = 'omnihuman',
      imageUrl,
      identityImageUrl,
      audioUrl,
      klingPrompt,
      seedancePrompt,
      clipStartSeconds = 0,
      lyricsExcerpt,
      mood,
      energyLevel,
      bpmFeel,
      segmentType,
      songTitle,
    } = req.body;

    if (!imageUrl) return res.status(400).json({ success: false, error: 'imageUrl required' });
    if (!audioUrl) return res.status(400).json({ success: false, error: 'audioUrl required' });

    if (mode === 'omnihuman') {
      // Route A: OmniHuman v1.5 — 1-step image+audio → lipsync video
      const result = await generateOmniHumanLipsync({ imageUrl, audioUrl });
      return res.json({
        success: result.success,
        requestId: result.requestId,
        endpoint: FAL_MODELS.OMNIHUMAN_V15,
        // FAL returns status_url with the correct poll path — use it directly
        statusUrl: result.statusUrl,
        resultUrl: result.resultUrl,
        mode: 'omnihuman',
        message: result.success ? 'OmniHuman lipsync queued' : undefined,
        error: result.error,
      });
    }

    if (mode === 'seedance-fast-r2v' || mode === 'seedance-mini-r2v') {
      // Route B: Seedance 2.0 R2V — 5s rhythmic singer performance locked to profile identity + original song audio.
      // 'seedance-mini-r2v' usa la variante MÁS ECONÓMICA (mismo flujo, menor coste FAL).
      const isMini = mode === 'seedance-mini-r2v';
      const seedanceModelPath = isMini ? FAL_MODELS.SEEDANCE_2_MINI_R2V : FAL_MODELS.SEEDANCE_2_FAST_R2V;
      const artistProfileIdentityUrl = identityImageUrl || await resolveArtistProfileImage(artistId) || imageUrl;
      const seedanceResult = await generateSeedanceFastReferenceVideo({
        imageUrl,
        identityImageUrl: artistProfileIdentityUrl,
        audioUrl,
        prompt: seedancePrompt || klingPrompt,
        duration: 5,
        clipStartSeconds: Number(clipStartSeconds) || 0,
        lyricsExcerpt,
        mood,
        energyLevel: Number(energyLevel) || 6,
        bpmFeel,
        segmentType,
        songTitle,
        modelPath: seedanceModelPath,
      });
      if (seedanceResult.success && seedanceResult.requestId) {
        const finalAudioSourceUrl = seedanceResult.referenceAudioUrl || audioUrl;
        const finalAudioStartSeconds = seedanceResult.referenceAudioUrl ? 0 : Number(clipStartSeconds) || 0;
        seedanceAudioLocks.set(seedanceResult.requestId, {
          audioUrl: finalAudioSourceUrl,
          clipStartSeconds: finalAudioStartSeconds,
          duration: 5,
          createdAt: Date.now(),
        });
      }
      return res.json({
        success: seedanceResult.success,
        requestId: seedanceResult.requestId,
        endpoint: seedanceModelPath,
        statusUrl: seedanceResult.statusUrl,
        resultUrl: seedanceResult.resultUrl,
        mode,
        duration: 5,
        clipStartSeconds: Number(clipStartSeconds) || 0,
        audioLock: 'exact-seedance-reference-audio-postprocess',
        audioSync: 'seedance-internal-audio-on-final-audio-replaced',
        identityLock: artistProfileIdentityUrl,
        message: seedanceResult.success ? `${isMini ? 'Seedance 2.0 Mini' : 'Seedance 2.0'} rhythmic singer video queued` : undefined,
        error: seedanceResult.error,
      });
    }

    const klingWorkflow = KLING_SYNC3_WORKFLOWS[mode];
    if (klingWorkflow) {
      // Route C: selected Kling base → Sync Lipsync v3 (2-step)
      if (!klingPrompt) return res.status(400).json({ success: false, error: 'klingPrompt required for Kling + Sync-3 mode' });
      const klingResult = await generateKlingV3ProVideo({
        imageUrl,
        prompt: klingPrompt,
        duration: 5,
        aspectRatio: '9:16',
        modelPath: klingWorkflow.endpoint,
        modelLabel: klingWorkflow.label,
      });
      return res.json({
        success: klingResult.success,
        requestId: klingResult.requestId,
        endpoint: klingWorkflow.endpoint,
        mode,
        nextStep: 'poll-then-sync3',
        workflowLabel: klingWorkflow.label,
        estimatedCost5s: klingWorkflow.cost5s,
        estimatedCost30s: klingWorkflow.cost30s,
        message: klingResult.success ? `${klingWorkflow.label} video base queued (step 1/2)` : undefined,
        error: klingResult.error,
      });
    }

    return res.status(400).json({ success: false, error: 'Invalid mode. Use omnihuman, seedance-fast-r2v, seedance-mini-r2v, kling-v21-standard-sync3, kling-v3-standard-sync3 or kling-v3-pro-sync3' });
  } catch (err: any) {
    logger.error('[PromoClips] generate-lipsync-video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-narrative-scene
// Body: { scene, imageUrl, identityImageUrl, audioUrl, performanceMode, brollMode }
// ──────────────────────────────────────────────
router.post('/:artistId/generate-narrative-scene', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      scene,
      imageUrl,
      identityImageUrl,
      audioUrl,
      performanceMode = 'kling-v3-standard-sync3',
      brollMode = 'kling-v3-standard-sync3',
      characterLock = null,
      referenceImageUrls = [],
      songTitle,
    } = req.body;

    if (!scene?.id) return res.status(400).json({ success: false, error: 'scene.id required' });
    if (!imageUrl) return res.status(400).json({ success: false, error: 'imageUrl required' });

    const isStoryOnlyScene = scene.sceneType === 'broll' || scene.sceneType === 'cutaway';
    const requiresLipsync = !isStoryOnlyScene && Boolean(scene.requiresLipsync || scene.sceneType === 'lipsync');
    const duration = Math.max(4, Math.min(10, Number(scene.sourceDuration || scene.duration || 5)));
    const clipStartSeconds = Math.max(0, Number(scene.generationStartTime ?? scene.startTime ?? 0));
    const rawModel = String(scene.model || (requiresLipsync ? performanceMode : brollMode));
    const mode = rawModel === 'omnihuman' ? 'kling-v3-standard-sync3' : rawModel;
    const characterReferences = normalizeReferenceUrls(characterLock?.referenceImageUrls || referenceImageUrls);
    const artistProfileIdentityUrl = characterLock?.masterImageUrl || characterLock?.primaryReferenceImageUrl || identityImageUrl || await resolveArtistProfileImage(artistId) || imageUrl;
    const sceneImageUrl = scene.sceneImageUrl || imageUrl;
    if (isStoryOnlyScene && !scene.sceneImageUrl) {
      return res.status(400).json({
        success: false,
        error: 'Genera primero el concepto/still de b-roll para esta escena. No se usará la imagen del artista como base para b-roll.',
      });
    }
    const characterContinuityPrompt = buildCharacterContinuityPrompt({
      ...(characterLock || {}),
      referenceImageUrls: characterReferences.length ? characterReferences : characterLock?.referenceImageUrls,
      primaryReferenceImageUrl: artistProfileIdentityUrl,
    });
    const sceneSymbolBeat = buildDualityLoveConflictBeat({
      index: Number(scene.index ?? 0),
      sceneType: scene.sceneType,
      lyricText: `${scene.lyricsExcerpt || ''} ${scene.lyricConnection || ''}`,
      nearbyLyricText: `${scene.visualIntent || ''} ${scene.videoPrompt || ''}`,
      mood: scene.emotion,
    });
    const rawObjectOnlyBrollSubject = String(scene.brollSubject || '').slice(0, 360);
    const objectOnlyBrollSubject = isStoryOnlyScene
      ? (sceneSymbolBeat?.brollSubject || (rawObjectOnlyBrollSubject && !looksStaticRepeatedSymbol(rawObjectOnlyBrollSubject) ? rawObjectOnlyBrollSubject : buildVideoclipBrollSubject({
          lyricText: scene.lyricsExcerpt,
          nearbyLyricText: scene.lyricConnection,
          genre: `${scene.palettePrompt || ''} ${scene.imagePrompt || ''} ${scene.videoPrompt || ''}`,
          mood: scene.emotion,
          sourceIndex: Number(scene.sourceIndex ?? 0),
          cutIndex: Number(scene.index ?? 0),
        })))
      : '';
    const sceneSymbolEvolution = String(sceneSymbolBeat?.symbolEvolution || scene.symbolEvolution || '').replace(/\s+/g, ' ').trim().slice(0, 360);
    const sceneFaceBible = cleanPromptPart(scene.faceBiblePrompt || characterLock?.faceBiblePrompt, '', 520);
    const scenePaletteBible = cleanPromptPart(scene.paletteBiblePrompt || scene.palettePrompt, '', 520);
    const sceneContinuityMap = cleanPromptPart(scene.shotContinuityPrompt, '', 420);
    const sceneEditCue = cleanPromptPart(scene.editCue, '', 220);
    const sceneTransition = cleanPromptPart(scene.transition, '', 140);
    const scenePipelineRole = cleanPromptPart(scene.pipelineRole, '', 120);
    const sceneQc = Array.isArray(scene.qualityChecklist)
      ? scene.qualityChecklist.map((item: any) => String(item).slice(0, 140)).slice(0, 7).join(' | ')
      : '';
    const basePrompt = isStoryOnlyScene
      ? `Object-only videoclip b-roll video: ${objectOnlyBrollSubject}. ${sceneSymbolEvolution ? `Symbol evolution: ${sceneSymbolEvolution}. ` : ''}${getDeterministicBrollCameraMovement({ ...scene, sourceIndex: Number(scene.sourceIndex ?? 0), index: Number(scene.index ?? 0) } as NarrativeTimelineCut)}. No visible person, no hands, no face, no body, no portrait, no performer.`
      : `${sceneSymbolBeat?.visualIntent || (looksStaticRepeatedSymbol(String(scene.videoPrompt || scene.visualIntent || '')) ? '' : String(scene.videoPrompt || scene.visualIntent || 'cinematic vertical music video scene').slice(0, 1200))} ${sceneSymbolEvolution ? `Symbol evolution: ${sceneSymbolEvolution}.` : ''}`.trim();
    const narrativePrompt = isStoryOnlyScene
      ? [
          'B-roll video source only. This must look like a real music video insert, not a portrait or performance.',
          scenePipelineRole ? `Pipeline role: ${scenePipelineRole}` : '',
          scenePaletteBible ? `Palette Bible: ${scenePaletteBible}` : '',
          sceneContinuityMap ? `Shot continuity map: ${sceneContinuityMap}` : '',
          sceneEditCue ? `Edit cue: ${sceneEditCue}` : '',
          sceneTransition ? `Transition cue: ${sceneTransition}` : '',
          sceneQc ? `QC checklist: ${sceneQc}` : '',
          scene.lyricConnection ? `Lyric/story connection: ${String(scene.lyricConnection).slice(0, 320)}` : '',
          `B-roll subject: ${objectOnlyBrollSubject}`,
          sceneSymbolEvolution ? `Required symbol evolution: ${sceneSymbolEvolution}` : '',
          basePrompt,
          'Use cinematic movement on objects/instruments/props/empty stage or studio details only. No visible person, no hands, no face, no body, no singer, no mouth, no actor, no performance pose. No random ocean, no storm sky, no unrelated clouds.',
          'Vertical 9:16, photorealistic music video b-roll, locked campaign palette, no text, no watermark.',
        ].filter(Boolean).join(' ')
      : [
          scenePipelineRole ? `Pipeline role: ${scenePipelineRole}` : '',
          sceneFaceBible ? `Face Bible: ${sceneFaceBible}` : '',
          scenePaletteBible ? `Palette Bible: ${scenePaletteBible}` : '',
          sceneContinuityMap ? `Shot continuity map: ${sceneContinuityMap}` : '',
          sceneEditCue ? `Edit cue: ${sceneEditCue}` : '',
          sceneTransition ? `Transition cue: ${sceneTransition}` : '',
          sceneQc ? `QC checklist: ${sceneQc}` : '',
          characterContinuityPrompt,
          scene.continuityPrompt ? `Scene continuity: ${String(scene.continuityPrompt).slice(0, 500)}` : '',
          scene.lyricConnection ? `Lyric/story connection: ${String(scene.lyricConnection).slice(0, 320)}` : '',
          sceneSymbolEvolution ? `Required symbol evolution: ${sceneSymbolEvolution}` : '',
          basePrompt,
          'This is an exact visible singing/performance shot. Keep the artist mouth clearly visible, natural and ready for Sync-3 lipsync correction.',
          'Vertical 9:16, photorealistic music video, stable identity when the artist appears, stable wardrobe/accessories, no text, no watermark.',
        ].filter(Boolean).join(' ');

    if (requiresLipsync && (mode === 'seedance-fast-r2v' || mode === 'seedance-mini-r2v')) {
      if (!audioUrl) return res.status(400).json({ success: false, error: 'audioUrl required for lipsync scene' });
      const isMiniScene = mode === 'seedance-mini-r2v';
      const seedanceSceneModelPath = isMiniScene ? FAL_MODELS.SEEDANCE_2_MINI_R2V : FAL_MODELS.SEEDANCE_2_FAST_R2V;
      const seedanceResult = await generateSeedanceFastReferenceVideo({
        imageUrl: sceneImageUrl,
        identityImageUrl: artistProfileIdentityUrl,
        audioUrl,
        prompt: narrativePrompt,
        duration: duration as 5 | 10,
        clipStartSeconds,
        lyricsExcerpt: scene.lyricsExcerpt || '',
        mood: scene.emotion || '',
        energyLevel: Number(scene.energyLevel || 7),
        bpmFeel: scene.cameraMovement || '',
        segmentType: 'narrative_lipsync',
        songTitle,
        modelPath: seedanceSceneModelPath,
      });
      if (seedanceResult.success && seedanceResult.requestId) {
        const finalAudioSourceUrl = seedanceResult.referenceAudioUrl || audioUrl;
        seedanceAudioLocks.set(seedanceResult.requestId, {
          audioUrl: finalAudioSourceUrl,
          clipStartSeconds: seedanceResult.referenceAudioUrl ? 0 : clipStartSeconds,
          duration,
          createdAt: Date.now(),
        });
      }
      return res.json({
        success: seedanceResult.success,
        sceneId: scene.id,
        requestId: seedanceResult.requestId,
        endpoint: seedanceSceneModelPath,
        statusUrl: seedanceResult.statusUrl,
        resultUrl: seedanceResult.resultUrl,
        mode,
        requiresLipsync: true,
        duration,
        clipStartSeconds,
        message: seedanceResult.success ? 'Narrative Seedance scene queued' : undefined,
        error: seedanceResult.error,
      });
    }

    const klingWorkflow = KLING_SYNC3_WORKFLOWS[mode] || KLING_SYNC3_WORKFLOWS[brollMode] || KLING_SYNC3_WORKFLOWS['kling-v3-standard-sync3'];
    const klingResult = await generateKlingV3ProVideo({
      imageUrl: sceneImageUrl,
      prompt: narrativePrompt,
      duration: duration <= 5 ? 5 : 10,
      aspectRatio: '9:16',
      modelPath: klingWorkflow.endpoint,
      modelLabel: requiresLipsync ? `${klingWorkflow.label} narrative base` : `${klingWorkflow.label.replace(' + Sync-3', '')} b-roll`,
    });

    return res.json({
      success: klingResult.success,
      sceneId: scene.id,
      requestId: klingResult.requestId,
      endpoint: klingWorkflow.endpoint,
      mode: Object.keys(KLING_SYNC3_WORKFLOWS).find(key => KLING_SYNC3_WORKFLOWS[key].endpoint === klingWorkflow.endpoint) || mode,
      nextStep: requiresLipsync ? 'poll-then-sync3' : 'poll-only',
      requiresLipsync,
      duration,
      clipStartSeconds,
      workflowLabel: requiresLipsync ? klingWorkflow.label : `${klingWorkflow.label.replace(' + Sync-3', '')} b-roll`,
      message: klingResult.success ? 'Narrative scene queued' : undefined,
      error: klingResult.error,
    });
  } catch (err: any) {
    logger.error('[PromoClips] generate-narrative-scene error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/apply-sync3
// Body: { videoUrl, audioUrl } — Second step of kling+sync3 route
// ──────────────────────────────────────────────
router.post('/:artistId/apply-sync3', authenticate, async (req: Request, res: Response) => {
  try {
    const { videoUrl, audioUrl, clipStartSeconds = 0, duration = 5, syncMode = 'cut_off', sourceMode } = req.body;
    if (!videoUrl || !audioUrl) return res.status(400).json({ success: false, error: 'videoUrl and audioUrl required' });

    const result = await generateSyncLipsyncV3({
      videoUrl,
      audioUrl,
      clipStartSeconds: Number(clipStartSeconds) || 0,
      duration: Number(duration) || 5,
      syncMode,
    });
    if (result.success && result.requestId) {
      sync3AudioLocks.set(result.requestId, {
        audioUrl: result.referenceAudioUrl || audioUrl,
        clipStartSeconds: result.referenceAudioUrl ? 0 : Number(clipStartSeconds) || 0,
        duration: Number(duration) || 5,
        sourceMode,
        createdAt: Date.now(),
      });
    }
    res.json({
      success: result.success,
      requestId: result.requestId,
      endpoint: FAL_MODELS.SYNC_LIPSYNC_V3,
      statusUrl: result.statusUrl,
      resultUrl: result.resultUrl,
      message: result.success ? 'Sync Lipsync v3 queued' : undefined,
      error: result.error,
    });
  } catch (err: any) {
    logger.error('[PromoClips] apply-sync3 error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// Helper: save generated images to artist gallery
// ──────────────────────────────────────────────
function saveImagesToGallery(artistId: string, images: any[], prompt: string, songName: string, artistName: string) {
  db.collection('image_galleries')
    .where('userId', '==', artistId)
    .where('singleName', '==', 'Promo Clips')
    .limit(1)
    .get()
    .then(async existing => {
      const now = new Date().toISOString();
      const newImgs = images.map((img: any) => ({
        id: `promo_${uuidv4()}`,
        url: img.url,
        prompt: prompt.substring(0, 200),
        createdAt: now,
        isVideo: false,
        source: 'promo_clips',
        songName,
      }));
      if (!existing.empty) {
        const cur = existing.docs[0].data().generatedImages || [];
        await existing.docs[0].ref.update({ generatedImages: [...cur, ...newImgs], updatedAt: now });
      } else {
        const gId = `promo_gallery_${artistId}_${Date.now()}`;
        await db.collection('image_galleries').doc(gId).set({
          id: gId, userId: artistId, singleName: 'Promo Clips',
          artistName, basePrompt: 'AI Promo Clips',
          styleInstructions: 'Identity-preserved from artist profile photo (PuLID)',
          referenceImageUrls: [], generatedImages: newImgs,
          createdAt: now, updatedAt: now, isPublic: false, source: 'promo_clips',
        });
      }
      logger.log(`[PromoClips] 🖼️ Auto-saved ${newImgs.length} image(s) to gallery`);
    })
    .catch(e => logger.warn('[PromoClips] gallery auto-save failed:', e.message));
}

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/poll-fal
// Body: { requestId, endpoint, statusUrl?, resultUrl?, jobType?, songName?, artistName?, falImagePrompt?, audioUrl?, clipStartSeconds?, duration? }
// ──────────────────────────────────────────────
router.post('/:artistId/poll-fal', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { requestId, endpoint, statusUrl, resultUrl, jobType, songName, artistName, falImagePrompt, audioUrl, clipStartSeconds = 0, duration = 5, deferSave = false } = req.body;
    if (!requestId || !endpoint) return res.status(400).json({ success: false, error: 'requestId and endpoint required' });

    if (!FAL_API_KEY) return res.status(500).json({ success: false, error: 'FAL_API_KEY not configured' });

    const seedanceChain = endpoint.includes('seedance') ? seedanceSync3Chains.get(requestId) : undefined;
    const effectiveEndpoint = seedanceChain ? FAL_MODELS.SYNC_LIPSYNC_V3 : endpoint;
    const effectiveRequestId = seedanceChain?.syncRequestId || requestId;

    // Use FAL's returned status_url directly when available (avoids wrong poll path for OmniHuman)
    // Fallback: construct from endpoint (works for Kling, Sync-3)
    const pollStatusUrl = seedanceChain?.statusUrl || statusUrl || `https://queue.fal.run/${effectiveEndpoint}/requests/${effectiveRequestId}/status`;
    const pollResultUrl = seedanceChain?.resultUrl || resultUrl || `https://queue.fal.run/${effectiveEndpoint}/requests/${effectiveRequestId}`;

    logger.log(`[PromoClips] poll-fal → ${pollStatusUrl.substring(0, 80)}`);

    // Check status (non-blocking single poll)
    const statusRes = await axios.get(
      pollStatusUrl,
      { headers: { Authorization: `Key ${FAL_API_KEY}` }, timeout: 10000 }
    );

    const status = statusRes.data?.status;
    logger.log(`[PromoClips] poll-fal status=${status} queuePos=${statusRes.data?.queue_position ?? 'n/a'} requestId=${effectiveRequestId.substring(0, 20)}`);

    if (status === 'COMPLETED') {
      let result: any;
      try {
        const resultRes = await axios.get(
          pollResultUrl,
          { headers: { Authorization: `Key ${FAL_API_KEY}` }, timeout: 15000 }
        );
        result = resultRes.data;
      } catch (resultErr: any) {
        // FAL returns 422 when the job completed but had a processing error (e.g. audio download failed)
        const detail = resultErr?.response?.data?.detail;
        const errMsg = Array.isArray(detail)
          ? detail.map((d: any) => d.msg || d.type).join('; ')
          : (typeof detail === 'string' ? detail : resultErr.message);
        logger.error(`[PromoClips] poll-fal COMPLETED but result fetch failed (${resultErr?.response?.status}):`, errMsg);
        return res.json({ success: false, status: 'FAILED', error: `FAL procesó el job con error: ${errMsg}` });
      }
      let videoUrl = result?.video?.url || result?.video_url || result?.output?.video?.url || result?.output?.url || result?.url;
      const imageUrls: any[] = result?.images || [];
      logger.log(`[PromoClips] COMPLETED result keys: ${Object.keys(result || {}).join(', ')} | videoUrl: ${videoUrl?.substring(0, 60) || 'none'} | images: ${imageUrls.length}`);

      const seedanceAudioLock = seedanceAudioLocks.get(requestId);
      const seedanceAudioUrl = audioUrl || seedanceAudioLock?.audioUrl;
      const seedanceClipStart = Number(clipStartSeconds) || seedanceAudioLock?.clipStartSeconds || 0;
      const seedanceDuration = Number(duration) || seedanceAudioLock?.duration || 5;

      if (videoUrl && endpoint.includes('seedance') && !seedanceChain && seedanceAudioUrl) {
        logger.log(`[PromoClips] Seedance performance complete; queuing Sync-3 final lipsync for ${requestId}`);
        const syncResult = await generateSyncLipsyncV3({
          videoUrl,
          audioUrl: seedanceAudioUrl,
          clipStartSeconds: seedanceClipStart,
          duration: seedanceDuration,
          syncMode: 'cut_off',
        });
        if (!syncResult.success || !syncResult.requestId) {
          return res.json({ success: false, status: 'FAILED', error: `Seedance completó, pero falló el envío a Sync-3: ${syncResult.error}` });
        }
        const finalAudioUrl = syncResult.referenceAudioUrl || seedanceAudioUrl;
        seedanceSync3Chains.set(requestId, {
          syncRequestId: syncResult.requestId,
          statusUrl: syncResult.statusUrl,
          resultUrl: syncResult.resultUrl,
          audioUrl: finalAudioUrl,
          clipStartSeconds: syncResult.referenceAudioUrl ? 0 : seedanceClipStart,
          duration: seedanceDuration,
          sourceMode: 'seedance-fast-r2v',
          createdAt: Date.now(),
        });
        sync3AudioLocks.set(syncResult.requestId, {
          audioUrl: finalAudioUrl,
          clipStartSeconds: syncResult.referenceAudioUrl ? 0 : seedanceClipStart,
          duration: seedanceDuration,
          createdAt: Date.now(),
        });
        seedanceAudioLocks.delete(requestId);
        return res.json({
          success: true,
          status: 'IN_PROGRESS',
          phase: 'SYNC3_QUEUED',
          requestId,
          sync3RequestId: syncResult.requestId,
          message: 'Seedance completó la actuación; Sync-3 está ajustando labios exactos a la canción original...',
        });
      } else if (videoUrl && endpoint.includes('seedance') && !seedanceChain) {
        logger.warn(`[PromoClips] Seedance completed without audio lock metadata for request ${requestId}`);
      }

      const sync3AudioLock = sync3AudioLocks.get(effectiveRequestId);
      const sync3AudioUrl = audioUrl || sync3AudioLock?.audioUrl;
      const sync3ClipStart = Number(clipStartSeconds) || sync3AudioLock?.clipStartSeconds || 0;
      const sync3Duration = Number(duration) || sync3AudioLock?.duration || 5;

      if (videoUrl && effectiveEndpoint.includes('sync-lipsync') && sync3AudioUrl) {
        const lockedVideo = await replaceVideoAudioWithOriginalSong({
          videoUrl,
          audioUrl: sync3AudioUrl,
          clipStartSeconds: sync3ClipStart,
          duration: sync3Duration,
        });
        if (!lockedVideo.success || !lockedVideo.videoUrl) {
          return res.json({ success: false, status: 'FAILED', error: `Sync-3 completó, pero falló el bloqueo del audio original: ${lockedVideo.error}` });
        }
        const originalSync3Url = videoUrl;
        videoUrl = lockedVideo.videoUrl;
        result = {
          ...result,
          video: {
            ...(result?.video || {}),
            url: videoUrl,
            original_sync3_url: originalSync3Url,
            seedance_sync3_pipeline: Boolean(seedanceChain),
            audio_locked: true,
          },
          audio_locked: true,
          seedance_sync3_pipeline: Boolean(seedanceChain),
        };
        sync3AudioLocks.delete(effectiveRequestId);
        if (seedanceChain) seedanceSync3Chains.delete(requestId);
      } else if (videoUrl && effectiveEndpoint.includes('sync-lipsync')) {
        logger.warn(`[PromoClips] Sync-3 completed without audio lock metadata for request ${effectiveRequestId}`);
      }

      // Auto-save VIDEO to 'videos' collection (fire-and-forget)
      if (videoUrl && artistId && !deferSave) {
        const now = new Date().toISOString();
        const videoId = `promo_video_${uuidv4()}`;
        const lipsyncMode = endpoint.includes('omnihuman')
          ? 'omnihuman'
          : endpoint.includes('seedance')
          ? 'seedance-fast-r2v-sync3'
          : sync3AudioLock?.sourceMode || 'sync3';
        db.collection('videos').doc(videoId).set({
          id: videoId,
          userId: artistId,
          title: `Promo Lipsync`,
          url: videoUrl,
          thumbnailUrl: '',
          type: 'promo_lipsync',
          source: 'promo_clips',
          lipsyncMode,
          createdAt: new Date(),
          isPublic: false,
        }).catch(e => logger.warn('[PromoClips] video auto-save failed:', e.message));
        logger.log(`[PromoClips] 🎬 Auto-saved lipsync video to videos collection`);
      }

      // Auto-save IMAGES to gallery (fire-and-forget) — for PuLID / image jobs
      if (imageUrls.length > 0 && artistId && (jobType === 'image' || endpoint.includes('pulid') || endpoint.includes('ip-adapter'))) {
        saveImagesToGallery(artistId, imageUrls, falImagePrompt || '', songName || '', artistName || '');
      }

      return res.json({ success: true, status: 'COMPLETED', result });
    }

    if (status === 'FAILED') {
      if (seedanceChain) {
        sync3AudioLocks.delete(seedanceChain.syncRequestId);
        seedanceSync3Chains.delete(requestId);
      }
      return res.json({ success: false, status: 'FAILED', error: statusRes.data?.error });
    }

    // IN_QUEUE or IN_PROGRESS
    return res.json({
      success: true,
      status,
      queuePosition: statusRes.data?.queue_position,
      message: 'Still processing...',
    });
  } catch (err: any) {
    logger.error('[PromoClips] poll-fal error:', err?.response?.data || err.message);
    res.status(500).json({ success: false, error: err?.response?.data?.detail || err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/render-narrative-video
// Body: { storyboardId, scenes: [{ id, videoUrl, startTime, duration }], audioUrl, clipStartSeconds, totalDuration }
// ──────────────────────────────────────────────
router.post('/:artistId/render-narrative-video', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      storyboardId,
      scenes = [],
      audioUrl,
      clipStartSeconds = 0,
      totalDuration = 30,
      songId,
      songName,
      artistName,
    } = req.body;

    if (!audioUrl) return res.status(400).json({ success: false, error: 'audioUrl required' });
    if (!Array.isArray(scenes) || scenes.length === 0) return res.status(400).json({ success: false, error: 'scenes required' });

    const renderResult = await stitchPromoSceneVideosWithOriginalAudio({
      scenes,
      audioUrl,
      clipStartSeconds: Number(clipStartSeconds) || 0,
      totalDuration: Number(totalDuration) || 30,
    });

    if (!renderResult.success || !renderResult.videoUrl) {
      return res.json({ success: false, error: renderResult.error || 'Narrative render failed' });
    }

    const now = new Date().toISOString();
    const videoId = `promo_narrative_${uuidv4()}`;
    await db.collection('videos').doc(videoId).set({
      id: videoId,
      userId: artistId,
      title: `${songName || 'Promo Narrative'} — 30s Music Video`,
      url: renderResult.videoUrl,
      thumbnailUrl: '',
      songId: songId || '',
      songName: songName || '',
      artistName: artistName || '',
      type: 'promo_narrative_30s',
      source: 'promo_clips',
      lipsyncMode: 'narrative_mixed_models',
      storyboardId: storyboardId || '',
      createdAt: new Date(),
      isPublic: false,
    });

    if (storyboardId) {
      await db.collection('promo_clip_storyboards').doc(storyboardId).set({
        finalVideoUrl: renderResult.videoUrl,
        finalVideoId: videoId,
        renderStatus: 'complete',
        updatedAt: now,
      }, { merge: true }).catch(e => logger.warn('[PromoClips] storyboard final update failed:', e.message));
    }

    res.json({ success: true, videoUrl: renderResult.videoUrl, videoId });
  } catch (err: any) {
    logger.error('[PromoClips] render-narrative-video error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-captions
// Body: { songTitle, lyricsExcerpt, genre, mood, targetPlatforms, cta, streamingUrl }
// ──────────────────────────────────────────────
router.post('/:artistId/generate-captions', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { songTitle, lyricsExcerpt, genre, mood, targetPlatforms = ['tiktok', 'instagram_reels', 'youtube_shorts'], cta, streamingUrl } = req.body;

    // Fetch artist name
    const artistDoc = await db.collection('artists').doc(artistId).get();
    const artistName = (artistDoc.data() as any)?.name || 'the artist';

    const prompt = `You are a viral social media content strategist for music artists.

Create captions, hashtags and CTA text for a short-form music promo clip.

Artist: ${artistName}
Song: ${songTitle}
Genre: ${genre}
Mood: ${mood}
Lyrics shown: ${lyricsExcerpt}
CTA / link: ${streamingUrl || cta || 'link in bio'}
Target platforms: ${targetPlatforms.join(', ')}

Return a JSON object:
{
  "tiktok": {
    "caption": "<hook line + song reference, max 150 chars>",
    "hashtags": ["<tag1>", "<tag2>", ...8 tags],
    "cta_text": "<call to action text>",
    "onscreen_text": "<text to overlay on video, max 5 words>"
  },
  "instagram_reels": {
    "caption": "<engaging caption with emojis, max 200 chars>",
    "hashtags": ["<tag1>", "<tag2>", ...10 tags],
    "cta_text": "<call to action text>",
    "onscreen_text": "<text to overlay on video, max 5 words>"
  },
  "youtube_shorts": {
    "caption": "<title-style caption>",
    "hashtags": ["<tag1>", "<tag2>", ...5 tags],
    "cta_text": "<subscribe/like prompt>",
    "onscreen_text": "<text to overlay on video, max 5 words>"
  }
}
Return ONLY the JSON, no markdown.`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 800,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const captions = JSON.parse(result.choices[0]?.message?.content || '{}');
    res.json({ success: true, captions });
  } catch (err: any) {
    logger.error('[PromoClips] generate-captions error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/save-job
// Body: full promo clip job data
// ──────────────────────────────────────────────
router.post('/:artistId/save-job', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const jobData = req.body;

    const jobId = jobData.job_id || `promo_job_${uuidv4()}`;
    const now = new Date().toISOString();

    const doc = {
      job_id: jobId,
      artist_id: artistId,
      created_at: now,
      updated_at: now,
      status: 'saved',
      ...jobData,
    };

    await db.collection('promo_clip_jobs').doc(jobId).set(doc, { merge: true });

    res.json({ success: true, jobId });
  } catch (err: any) {
    logger.error('[PromoClips] save-job error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/save-to-gallery
// Saves generated promo images into the artist's image_galleries collection
// Body: { imageUrls[], songName, prompt, artistName }
// ──────────────────────────────────────────────
router.post('/:artistId/save-to-gallery', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { imageUrls, songName, prompt, artistName } = req.body;

    if (!imageUrls?.length) return res.status(400).json({ success: false, error: 'imageUrls required' });

    const now = new Date().toISOString();

    // Find existing "Promo Clips" gallery for this artist or create new
    const galleriesRef = db.collection('image_galleries');
    const existing = await galleriesRef
      .where('userId', '==', artistId)
      .where('singleName', '==', 'Promo Clips')
      .limit(1)
      .get();

    const newImages = imageUrls.map((url: string, i: number) => ({
      id: `promo_${uuidv4()}`,
      url,
      prompt: prompt || `Promo clip image for ${songName || 'song'}`,
      createdAt: now,
      isVideo: false,
      source: 'promo_clips',
      songName: songName || '',
    }));

    if (!existing.empty) {
      // Append to existing gallery
      const galleryDoc = existing.docs[0];
      const currentImages: any[] = galleryDoc.data().generatedImages || [];
      await galleryDoc.ref.update({
        generatedImages: [...currentImages, ...newImages],
        updatedAt: now,
      });
      logger.log(`[PromoClips] 🖼️ Added ${newImages.length} images to existing gallery ${galleryDoc.id}`);
      return res.json({ success: true, galleryId: galleryDoc.id, added: newImages.length });
    } else {
      // Create new gallery
      const galleryId = `promo_gallery_${artistId}_${Date.now()}`;
      await galleriesRef.doc(galleryId).set({
        id: galleryId,
        userId: artistId,
        singleName: 'Promo Clips',
        artistName: artistName || '',
        basePrompt: 'AI Promo Clips — Artist Identity Images',
        styleInstructions: 'Respects artist profile photo: same face, features, color palette and mood',
        referenceImageUrls: [],
        generatedImages: newImages,
        createdAt: now,
        updatedAt: now,
        isPublic: false,
        source: 'promo_clips',
      });
      logger.log(`[PromoClips] 🖼️ Created new promo gallery ${galleryId} with ${newImages.length} images`);
      return res.json({ success: true, galleryId, added: newImages.length, created: true });
    }
  } catch (err: any) {
    logger.error('[PromoClips] save-to-gallery error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/save-to-videos
// Saves a generated lipsync video to the Firestore 'videos' collection
// Body: { videoUrl, songName, songId, imageUrl, artistName, mode }
// ──────────────────────────────────────────────
router.post('/:artistId/save-to-videos', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { videoUrl, songName, songId, imageUrl, artistName, mode = 'omnihuman' } = req.body;

    if (!videoUrl) return res.status(400).json({ success: false, error: 'videoUrl required' });

    const now = new Date().toISOString();
    const videoId = `promo_video_${uuidv4()}`;

    const videoDoc = {
      id: videoId,
      userId: artistId,
      title: `${songName || 'Promo Clip'} — Lipsync`,
      url: videoUrl,
      thumbnailUrl: imageUrl || '',
      songId: songId || '',
      songName: songName || '',
      artistName: artistName || '',
      type: 'promo_lipsync',
      lipsyncMode: mode,
      source: 'promo_clips',
      createdAt: new Date(),
      isPublic: false,
    };

    await db.collection('videos').doc(videoId).set(videoDoc);
    logger.log(`[PromoClips] 🎬 Saved lipsync video ${videoId} to videos collection`);

    res.json({ success: true, videoId });
  } catch (err: any) {
    logger.error('[PromoClips] save-to-videos error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/promo-clips/:artistId/jobs
// ──────────────────────────────────────────────
router.get('/:artistId/jobs', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    // No orderBy to avoid requiring a composite Firestore index — sort in memory
    const snap = await db.collection('promo_clip_jobs')
      .where('artist_id', '==', artistId)
      .limit(50)
      .get();
    const jobs = snap.docs
      .map(d => d.data())
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
      .slice(0, 20);
    res.json({ success: true, jobs });
  } catch (err: any) {
    logger.error('[PromoClips] list jobs error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// GET /api/promo-clips/:artistId/jobs/:jobId
// ──────────────────────────────────────────────
router.get('/:artistId/jobs/:jobId', authenticate, async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const doc = await db.collection('promo_clip_jobs').doc(jobId).get();
    if (!doc.exists) return res.status(404).json({ success: false, error: 'Job not found' });
    res.json({ success: true, job: doc.data() });
  } catch (err: any) {
    logger.error('[PromoClips] get job error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────
// POST /api/promo-clips/:artistId/create-promo-concept
// Body: { songId, lyrics?, artistName, genre, targetGoal, director? }
// Generates a high-level visual concept (story, wardrobe, locations, palette)
// BEFORE the storyboard — gives the storyboard AI a pre-planned creative brief.
// ──────────────────────────────────────────────
router.post('/:artistId/create-promo-concept', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { songId, lyrics, artistName, genre = 'music', targetGoal = 'virality', director = null } = req.body;

    if (!songId) return res.status(400).json({ success: false, error: 'songId required' });

    const songDoc = await db.collection('songs').doc(songId).get();
    if (!songDoc.exists) return res.status(404).json({ success: false, error: 'Song not found' });
    const song = { id: songId, ...songDoc.data() } as any;

    const songTitle = song.name || song.title || 'Untitled song';
    const mood = song.song_mood || song.mood || '';
    const resolvedLyrics = lyrics || song.lyrics || song.lyricsText || '';

    const directorBlock = director
      ? `\nDirector selected: ${director.name || 'unknown'}. Style: ${director.visual_style?.description?.slice(0, 120) || ''}. Color palette: ${[...(director.visual_style?.color_palette?.primary_colors || []).slice(0, 2), ...(director.visual_style?.color_palette?.accent_colors || []).slice(0, 1)].join(', ')}. Forbidden: ${(director.visual_style?.forbidden_visuals || []).slice(0, 3).join('; ')}.`
      : '';

    const conceptPrompt = `You are a music video creative director. Generate a complete visual concept brief for a 30-second vertical promo clip.

Song: "${songTitle}" by ${artistName || 'the artist'}
Genre: ${genre}
Mood: ${mood || 'not specified'}
Campaign goal: ${targetGoal}
${directorBlock}

Lyrics excerpt:
${String(resolvedLyrics).slice(0, 1200) || '[lyrics unavailable]'}

Generate a cinematic visual concept that:
1. Draws DIRECTLY from the specific lyric themes and images
2. Provides a clear narrative story arc (not just vibes)
3. Defines specific locations, wardrobe, and visual symbols
4. Creates visual coherence across 12 cuts

Return ONLY this JSON:
{
  "story_concept": "<2-3 sentence narrative concept — what story does this music video tell?>",
  "narrative_arc": {
    "act1_setup": "<what the opening 3 cuts establish>",
    "act2_development": "<what the middle 6 cuts develop — the conflict or longing>",
    "act3_resolution": "<what the final 3 cuts resolve or leave open>"
  },
  "main_wardrobe": {
    "outfit_description": "<specific garment descriptions>",
    "colors": ["<color1>", "<color2>", "<color3>"],
    "style": "<wardrobe style label, e.g. urban luxury, raw street, ethereal romantic>",
    "accessories": "<specific accessories that recur as symbols>",
    "wardrobe_variations": ["<outfit variant 1>", "<outfit variant 2>", "<outfit variant 3>"]
  },
  "locations": [
    { "name": "<location name>", "description": "<specific visual description>", "mood": "<emotional register>", "time_of_day": "<dawn|day|golden-hour|dusk|night|interior-lit>" },
    { "name": "<location name>", "description": "<specific visual description>", "mood": "<emotional register>", "time_of_day": "<dawn|day|golden-hour|dusk|night|interior-lit>" },
    { "name": "<location name>", "description": "<specific visual description>", "mood": "<emotional register>", "time_of_day": "<dawn|day|golden-hour|dusk|night|interior-lit>" }
  ],
  "color_palette": {
    "primary_colors": ["<color1>", "<color2>"],
    "accent_colors": ["<color3>", "<color4>"],
    "color_grade": "<color grading description — e.g. teal-orange contrast, crushed blacks, warm neon glow>",
    "mood": "<palette mood>"
  },
  "recurring_visual_elements": ["<symbol1>", "<symbol2>", "<symbol3>"],
  "key_narrative_moments": [
    { "cut": "<e.g. cut 1-3>", "lyric_anchor": "<lyric phrase>", "visual_moment": "<what happens on screen>" },
    { "cut": "<e.g. cut 7-8>", "lyric_anchor": "<lyric phrase>", "visual_moment": "<what happens on screen>" },
    { "cut": "<e.g. cut 11-12>", "lyric_anchor": "<lyric phrase>", "visual_moment": "<what happens on screen>" }
  ],
  "broll_symbol_pool": ["<symbol/object 1>", "<symbol/object 2>", "<symbol/object 3>", "<symbol/object 4>", "<symbol/object 5>"]
}`;

    const result = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [{ role: 'user', content: conceptPrompt }],
      max_tokens: 2000,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    const raw = result.choices[0]?.message?.content || '{}';
    let concept: any;
    try {
      concept = JSON.parse(raw);
    } catch {
      return res.status(500).json({ success: false, error: 'Failed to parse concept JSON', raw });
    }

    logger.log(`[PromoClips] ✅ create-promo-concept for ${artistId} song=${songId}`);
    return res.json({ success: true, concept });
  } catch (err: any) {
    logger.error('[PromoClips] create-promo-concept error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-style-preview
// Generates a single 512×768 preview image for a visual style (fal.ai Flux Kontext Pro)
// Body: { styleId, styleName, promptSuffix, referenceImageUrl }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:artistId/generate-style-preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { styleId, styleName, promptSuffix, referenceImageUrl } = req.body;

    if (!styleId || !promptSuffix) {
      return res.status(400).json({ success: false, error: 'styleId and promptSuffix required' });
    }

    // Build a style-specific prompt
    const baseSubject = referenceImageUrl
      ? `Artist portrait with authentic face and features preserved`
      : `Cinematic solo artist portrait`;

    const fullPrompt = `${baseSubject}, ${promptSuffix}, editorial quality, visually striking, perfect for music marketing, 3:4 portrait format`;

    logger.log(`[PromoClips] 🎨 Generating style preview for style=${styleId} artist=${artistId}`);

    const result = await generateImageWithFluxKontextPro(fullPrompt, {
      aspectRatio: '3:4',
      outputFolder: `artists/${artistId}/style-previews`,
    });

    if (!result.success || !result.imageUrl) {
      return res.status(500).json({ success: false, error: result.error || 'Image generation failed' });
    }

    // Save to Firestore global cache (no reference → generic example; with reference → artist-specific)
    try {
      const cacheKey = referenceImageUrl ? `${styleId}__${artistId}` : styleId;
      await db.collection('promoStylePreviews').doc(cacheKey).set({
        styleId,
        styleName: styleName || styleId,
        imageUrl: result.imageUrl,
        artistId: referenceImageUrl ? artistId : 'global',
        generatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (saveErr) {
      logger.warn('[PromoClips] Could not save style preview to Firestore:', saveErr);
    }

    logger.log(`[PromoClips] ✅ Style preview done: ${styleId}`);
    return res.json({ success: true, imageUrl: result.imageUrl, styleId });
  } catch (err: any) {
    logger.error('[PromoClips] generate-style-preview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-mood-preview
// Generates a cinematic music video scene image for a color mood (no artist in scene)
// Body: { moodId, moodName, promptHint }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:artistId/generate-mood-preview', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { moodId, moodName, promptHint } = req.body;

    if (!moodId || !promptHint) {
      return res.status(400).json({ success: false, error: 'moodId and promptHint required' });
    }

    const fullPrompt = `Cinematic music video scene still frame, ${promptHint}, no people or faces, pure atmospheric environment and scenery, dramatic moody lighting that emphasizes the color palette, shot with an anamorphic cinema lens, shallow depth of field, high-end production value music video aesthetic, dark and immersive atmosphere, striking visual composition, editorial quality`;

    logger.log(`[PromoClips] 🎨 Generating mood scene preview for mood=${moodId} artist=${artistId}`);

    const result = await generateImageWithFluxKontextPro(fullPrompt, {
      aspectRatio: '3:4',
      outputFolder: `artists/${artistId}/mood-previews`,
    });

    if (!result.success || !result.imageUrl) {
      return res.status(500).json({ success: false, error: result.error || 'Image generation failed' });
    }

    // Save to Firestore global mood cache (moods are atmospheric, shared across all artists)
    try {
      await db.collection('promoMoodPreviews').doc(moodId).set({
        moodId,
        moodName: moodName || moodId,
        imageUrl: result.imageUrl,
        generatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (saveErr) {
      logger.warn('[PromoClips] Could not save mood preview to Firestore:', saveErr);
    }

    logger.log(`[PromoClips] ✅ Mood scene preview done: ${moodId}`);
    return res.json({ success: true, imageUrl: result.imageUrl, moodId });
  } catch (err: any) {
    logger.error('[PromoClips] generate-mood-preview error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/promo-clips/previews/styles — Load all globally cached style preview images
// ──────────────────────────────────────────────────────────────────────────────
router.get('/previews/styles', authenticate, async (req: Request, res: Response) => {
  try {
    // Global (same for every user) → cache 5 min + bound the read.
    const previews = await cached('promo:previews:styles', 300, async () => {
      const snapshot = await db.collection('promoStylePreviews').limit(500).get();
      const out: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Only include global (non-artist-specific) previews
        if (data.artistId === 'global' || !data.artistId) {
          out[data.styleId] = data.imageUrl;
        }
      });
      return out;
    });
    return res.json({ success: true, previews });
  } catch (err: any) {
    logger.error('[PromoClips] previews/styles error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /api/promo-clips/previews/moods — Load all globally cached mood preview images
// ──────────────────────────────────────────────────────────────────────────────
router.get('/previews/moods', authenticate, async (req: Request, res: Response) => {
  try {
    // Global (same for every user) → cache 5 min + bound the read.
    const previews = await cached('promo:previews:moods', 300, async () => {
      const snapshot = await db.collection('promoMoodPreviews').limit(500).get();
      const out: Record<string, string> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        out[data.moodId] = data.imageUrl;
      });
      return out;
    });
    return res.json({ success: true, previews });
  } catch (err: any) {
    logger.error('[PromoClips] previews/moods error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /api/promo-clips/:artistId/generate-hollywood-poster
// Generates a Hollywood-style 9:16 movie poster for the promo clip
// Body: { artistName, songName, songGenre, viralHook, storySeed, mood, energyLevel, referenceImageUrl, colorPromptHint }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:artistId/generate-hollywood-poster', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const {
      artistName,
      songName,
      songGenre,
      viralHook,
      storySeed,
      mood,
      energyLevel,
      referenceImageUrl,
      colorPromptHint,
    } = req.body;

    if (!artistName) {
      return res.status(400).json({ success: false, error: 'artistName required' });
    }

    // Step 1: GPT writes the Hollywood poster copy
    logger.log(`[PromoClips] 🎬 GPT writing Hollywood poster copy for ${artistName} - ${songName}`);

    const copyPrompt = `You are a Hollywood movie poster copywriter and art director. Create cinematic poster copy for a music artist.

Artist: ${artistName}
Song: ${songName || 'Untitled'}
Genre: ${songGenre || 'Music'}
Vibe/Mood: ${mood || 'intense, emotional'}
Energy: ${energyLevel || 'high'}
Story Hook: ${storySeed || viralHook || `The rise of ${artistName}`}
Viral Hook: ${viralHook || ''}

Generate poster copy in JSON format:
{
  "headline": "<Bold all-caps hero line — max 5 words, like a movie title>",
  "tagline": "<One iconic italic line — the promise/emotion — max 12 words>",
  "story_text": "<2-sentence cinematic story blurb — like the back of a DVD case>",
  "visual_direction": "<How the poster should look: pose, lighting, atmosphere — 2 sentences>",
  "font_style": "<Typography feel: bold sans-serif, elegant serif, distressed grunge, etc.>"
}

Make it feel like a real Hollywood A-list movie poster. Be bold, cinematic, iconic.`;

    const copyResult = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: copyPrompt }],
      max_tokens: 500,
      temperature: 0.9,
      response_format: { type: 'json_object' },
    });

    let posterCopy: any = {};
    try {
      posterCopy = JSON.parse(copyResult.choices[0]?.message?.content || '{}');
    } catch {
      posterCopy = {
        headline: (songName || artistName).toUpperCase(),
        tagline: `The music doesn't stop.`,
        story_text: `${artistName} delivers a powerful visual journey through sound and emotion.`,
        visual_direction: `Dramatic cinematic portrait with strong lighting and bold colors.`,
        font_style: 'bold condensed sans-serif',
      };
    }

    logger.log(`[PromoClips] ✅ Poster copy: "${posterCopy.headline}" — "${posterCopy.tagline}"`);

    // Step 2: Flux Pro generates the 9:16 poster image
    const colorSuffix = colorPromptHint || 'dramatic cinematic color palette';
    const visualBase = referenceImageUrl
      ? `Cinematic Hollywood movie poster portrait of ${artistName}`
      : `Cinematic Hollywood movie poster of a music artist`;

    const posterPrompt = `${visualBase}, ${posterCopy.visual_direction}, ${colorSuffix}, 9:16 portrait format, dramatic moody lighting, ${songGenre || 'music'} industry aesthetic, ${mood || 'intense'} atmosphere, photorealistic, ultra high quality editorial poster photography, Hollywood A-list production value, title card: "${posterCopy.headline}", subtitle: "${posterCopy.tagline}"`;

    logger.log(`[PromoClips] 🖼️ Generating poster image with Flux Kontext Pro...`);

    const imageResult = await generateImageWithFluxKontextPro(posterPrompt, {
      aspectRatio: '9:16',
      outputFolder: `artists/${artistId}/posters`,
    });

    if (!imageResult.success || !imageResult.imageUrl) {
      return res.status(500).json({ success: false, error: imageResult.error || 'Poster image generation failed' });
    }

    // Step 3: Save to Firestore gallery
    const now = new Date().toISOString();
    const galleriesRef = db.collection('image_galleries');
    const existing = await galleriesRef
      .where('userId', '==', artistId)
      .where('singleName', '==', 'Hollywood Posters')
      .limit(1)
      .get();

    const newImage = {
      id: `poster_${uuidv4()}`,
      url: imageResult.imageUrl,
      prompt: posterPrompt,
      createdAt: now,
      isVideo: false,
      source: 'promo_clips_poster',
      songName: songName || '',
      headline: posterCopy.headline || '',
      tagline: posterCopy.tagline || '',
    };

    let galleryId: string;
    if (!existing.empty) {
      const galleryDoc = existing.docs[0];
      const currentImages: any[] = galleryDoc.data().generatedImages || [];
      await galleryDoc.ref.update({
        generatedImages: [...currentImages, newImage],
        updatedAt: now,
      });
      galleryId = galleryDoc.id;
      logger.log(`[PromoClips] 🖼️ Hollywood poster added to existing gallery ${galleryId}`);
    } else {
      galleryId = `poster_gallery_${artistId}_${Date.now()}`;
      await galleriesRef.doc(galleryId).set({
        id: galleryId,
        userId: artistId,
        singleName: 'Hollywood Posters',
        artistName: artistName || '',
        basePrompt: 'AI Hollywood Movie Posters — Promo Clips',
        generatedImages: [newImage],
        createdAt: now,
        updatedAt: now,
        isPublic: false,
        source: 'promo_clips_poster',
      });
      logger.log(`[PromoClips] 🖼️ Created Hollywood poster gallery ${galleryId}`);
    }

    return res.json({
      success: true,
      posterUrl: imageResult.imageUrl,
      galleryId,
      headline: posterCopy.headline,
      tagline: posterCopy.tagline,
      storyText: posterCopy.story_text,
      visualDirection: posterCopy.visual_direction,
    });
  } catch (err: any) {
    logger.error('[PromoClips] generate-hollywood-poster error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
