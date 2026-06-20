/**
 * Video Intent Analyzer
 * Adapted from: HKUDS/VideoAgent (Intent Analysis module)
 *
 * Decomposes user/artist intent into explicit + implicit sub-intents
 * and maps them to the optimal video generation pipeline.
 *
 * VideoAgent insight: user instructions contain both explicit requests
 * ("make a promo video") and implicit expectations ("should look professional",
 * "should be on-brand", "artist face must be recognizable").
 *
 * This service analyzes the full context and returns a structured intent
 * that the promo-video-orchestrator uses to select the optimal pipeline.
 */

import { createTrackedOpenAI } from '../utils/tracked-openai.js';
import { PRIMARY_MODEL } from '../utils/ai-config.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type VideoPipeline =
  | 'lipsync'           // Artist face + lipsync (OmniHuman/Seedance)
  | 'performance-broll' // Artist performance scenes + b-roll cuts
  | 'narrative-30s'     // Multi-scene narrative with storyboard
  | 'spoken-promo';     // HeyGen/SadTalker talking head promo

export type VideoPlatform = 'tiktok' | 'instagram' | 'youtube' | 'all';

export type VideoIntent = {
  /** Things the artist literally requested */
  explicitIntents: string[];
  /** Things the artist almost certainly also wants but didn't say */
  implicitIntents: string[];
  /** Detected or inferred target platform */
  platform: VideoPlatform;
  /** Best pipeline for this combination of intents */
  recommendedPipeline: VideoPipeline;
  /** Mood/aesthetic keywords extracted from song + context */
  moodKeywords: string[];
  /** Recommended clip duration in seconds */
  suggestedDuration: 5 | 10 | 15 | 30;
  /** Estimated number of scenes for narrative mode */
  suggestedSceneCount: number;
  /** Whether artist face/identity is critical to the video */
  requiresArtistFace: boolean;
  /** Confidence score 0-1 in the pipeline recommendation */
  confidence: number;
  /** Free-text reasoning for the recommendation */
  reasoning: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Intent analysis
// ─────────────────────────────────────────────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `You are a music video strategy expert analyzing what kind of video
an artist needs. Given artist context and song data, identify:
1. EXPLICIT intents: what they literally asked for
2. IMPLICIT intents: what they probably also want (quality, branding, platform fit)
3. Best pipeline to serve those intents

Return a single JSON object — no markdown, no fences.`;

function buildIntentUserPrompt(args: {
  artistContext: { genre?: string; style?: string; name?: string; hasPhoto?: boolean };
  songData: { title: string; mood?: string; bpm?: number; genre?: string; duration?: number };
  userRequest?: string;
  platform?: string;
}): string {
  const lines = [
    `ARTIST: ${args.artistContext.name || 'unknown'}, genre: ${args.artistContext.genre || 'unknown'}, style: ${args.artistContext.style || 'unknown'}`,
    `HAS ARTIST PHOTO: ${args.artistContext.hasPhoto ? 'yes' : 'no'}`,
    `SONG: "${args.songData.title}", mood: ${args.songData.mood || 'unknown'}, bpm: ${args.songData.bpm || '?'}, duration: ${args.songData.duration ? `${args.songData.duration}s` : '?'}`,
    args.userRequest ? `USER REQUEST: "${args.userRequest}"` : 'USER REQUEST: (none — using defaults)',
    args.platform ? `TARGET PLATFORM: ${args.platform}` : '',
    '',
    'Return this JSON (fill all fields):',
    JSON.stringify({
      explicitIntents: ['string'],
      implicitIntents: ['string'],
      platform: 'tiktok|instagram|youtube|all',
      recommendedPipeline: 'lipsync|performance-broll|narrative-30s|spoken-promo',
      moodKeywords: ['string'],
      suggestedDuration: '5|10|15|30',
      suggestedSceneCount: 'number',
      requiresArtistFace: 'boolean',
      confidence: '0-1',
      reasoning: 'string',
    }),
  ];
  return lines.filter(Boolean).join('\n');
}

/**
 * Analyzes video creation intent from artist + song context.
 * Returns a structured VideoIntent for pipeline selection.
 */
export async function analyzeVideoIntent(args: {
  artistContext: { genre?: string; style?: string; name?: string; hasPhoto?: boolean };
  songData: { title: string; mood?: string; bpm?: number; genre?: string; duration?: number };
  userRequest?: string;
  platform?: string;
}): Promise<VideoIntent> {
  // Rule-based fast path when no API key (avoids unnecessary failures)
  if (!OPENAI_API_KEY) {
    return buildDefaultIntent(args);
  }

  try {
    const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: INTENT_SYSTEM_PROMPT },
        { role: 'user', content: buildIntentUserPrompt(args) },
      ],
      max_tokens: 600,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    return {
      explicitIntents: Array.isArray(parsed.explicitIntents) ? parsed.explicitIntents : [],
      implicitIntents: Array.isArray(parsed.implicitIntents) ? parsed.implicitIntents : [],
      platform: validatePlatform(parsed.platform),
      recommendedPipeline: validatePipeline(parsed.recommendedPipeline),
      moodKeywords: Array.isArray(parsed.moodKeywords) ? parsed.moodKeywords : [],
      suggestedDuration: validateDuration(parsed.suggestedDuration),
      suggestedSceneCount: typeof parsed.suggestedSceneCount === 'number' ? parsed.suggestedSceneCount : 4,
      requiresArtistFace: Boolean(parsed.requiresArtistFace),
      confidence: typeof parsed.confidence === 'number' ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
      reasoning: String(parsed.reasoning || ''),
    };
  } catch (err) {
    console.warn('[VideoIntentAnalyzer] LLM analysis failed, using rule-based fallback:', err);
    return buildDefaultIntent(args);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Rule-based fallback (no API call needed)
// ─────────────────────────────────────────────────────────────────────────────

function buildDefaultIntent(args: {
  artistContext: { genre?: string; hasPhoto?: boolean };
  songData: { bpm?: number; duration?: number };
  userRequest?: string;
  platform?: string;
}): VideoIntent {
  const hasPhoto = args.artistContext.hasPhoto ?? false;
  const isHighBpm = (args.songData.bpm ?? 120) >= 130;
  const isLongSong = (args.songData.duration ?? 180) >= 120;

  let pipeline: VideoPipeline = hasPhoto ? 'lipsync' : 'performance-broll';
  if (isLongSong) pipeline = 'narrative-30s';
  if (args.userRequest?.toLowerCase().includes('talking')) pipeline = 'spoken-promo';
  if (args.userRequest?.toLowerCase().includes('narrative') || args.userRequest?.toLowerCase().includes('story')) {
    pipeline = 'narrative-30s';
  }

  return {
    explicitIntents: ['create promo video'],
    implicitIntents: ['look professional', 'be platform-optimized', 'showcase artist identity'],
    platform: validatePlatform(args.platform),
    recommendedPipeline: pipeline,
    moodKeywords: [],
    suggestedDuration: isHighBpm ? 15 : 30,
    suggestedSceneCount: isLongSong ? 6 : 4,
    requiresArtistFace: hasPhoto,
    confidence: 0.65,
    reasoning: 'Rule-based default — LLM analysis unavailable.',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Validators
// ─────────────────────────────────────────────────────────────────────────────

function validatePlatform(p: unknown): VideoPlatform {
  if (p === 'tiktok' || p === 'instagram' || p === 'youtube') return p;
  return 'all';
}

function validatePipeline(p: unknown): VideoPipeline {
  if (p === 'lipsync' || p === 'performance-broll' || p === 'narrative-30s' || p === 'spoken-promo') return p;
  return 'lipsync';
}

function validateDuration(d: unknown): 5 | 10 | 15 | 30 {
  if (d === 5 || d === 10 || d === 15 || d === 30) return d;
  return 15;
}
