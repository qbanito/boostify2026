/**
 * Video Self-Evaluator
 * Adapted from: HKUDS/VideoAgent (Adaptive Feedback Loop module)
 *
 * VideoAgent insight: generated videos often miss the intent on first attempt.
 * Rather than delivering poor results, the system should:
 *   1. Evaluate the generated output against the original intent
 *   2. If quality is low (score < threshold), auto-retry with improved prompt
 *   3. Max 2 retries to prevent infinite loops
 *
 * This service uses GPT-4o Vision to evaluate:
 *   - Does the video match the intended mood/style?
 *   - Is the subject (artist) clearly visible?
 *   - Is the motion quality acceptable?
 *   - Does the colour palette match the intent?
 *
 * For VIDEO evaluation: uses a thumbnail/frame from the video URL.
 * For IMAGE evaluation: uses the image URL directly.
 */

import OpenAI from 'openai';
import { createTrackedOpenAI } from '../utils/tracked-openai.js';
import type { VideoIntent } from './video-intent-analyzer.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Minimum score to accept without retry
const RETRY_THRESHOLD = 62;
const MAX_RETRIES = 2;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type MediaType = 'image' | 'video';

export type EvaluationResult = {
  score: number;           // 0-100
  issues: string[];        // detected problems
  suggestions: string[];   // specific improvements for retry
  shouldRetry: boolean;    // score < RETRY_THRESHOLD && attempt < MAX_RETRIES
  attempt: number;
};

export type RetryContext = {
  originalPrompt: string;
  evaluation: EvaluationResult;
  attempt: number;
  intent?: VideoIntent;
};

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation prompts
// ─────────────────────────────────────────────────────────────────────────────

function buildImageEvaluationPrompt(args: {
  originalPrompt: string;
  intent?: VideoIntent;
}): string {
  const intentBlock = args.intent
    ? `INTENDED MOOD: ${args.intent.moodKeywords.join(', ')}\nPIPELINE: ${args.intent.recommendedPipeline}`
    : '';

  return `
You are a professional art director evaluating an AI-generated image.

ORIGINAL PROMPT: "${args.originalPrompt}"
${intentBlock}

Evaluate on a 0-100 scale. Return JSON only:
{
  "score": 0-100,
  "issues": ["list of specific problems"],
  "suggestions": ["specific prompt improvements to address each issue"],
  "qualityBreakdown": {
    "composition": 0-100,
    "lighting": 0-100,
    "subjectClarity": 0-100,
    "moodMatch": 0-100,
    "technicalQuality": 0-100
  }
}

Penalise heavily for: blurry subjects, text in image, distorted faces, wrong aspect ratio,
missing subjects from the prompt, colour palette mismatch.
`.trim();
}

function buildVideoEvaluationPrompt(args: {
  originalPrompt: string;
  intent?: VideoIntent;
}): string {
  const intentBlock = args.intent
    ? `INTENDED MOOD: ${args.intent.moodKeywords.join(', ')}\nPIPELINE: ${args.intent.recommendedPipeline}`
    : '';

  return `
You are evaluating a frame/thumbnail from an AI-generated video clip.

ORIGINAL VIDEO PROMPT: "${args.originalPrompt}"
${intentBlock}

Evaluate the thumbnail on a 0-100 scale as a proxy for overall video quality.
Return JSON only:
{
  "score": 0-100,
  "issues": ["list of specific problems"],
  "suggestions": ["specific prompt improvements to fix each issue"],
  "qualityBreakdown": {
    "subjectClarity": 0-100,
    "motionQuality": 0-100,
    "cinematography": 0-100,
    "moodMatch": 0-100
  }
}

Penalise for: blurry/distorted subjects, wrong composition, mood mismatch, 
low dynamic range, washed out colours, static/no motion impression.
`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Core evaluation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Evaluates a generated image or video frame using GPT-4o Vision.
 * Returns evaluation with score, issues, and retry suggestions.
 *
 * For video URLs, pass a thumbnail or the first frame as the mediaUrl.
 */
export async function evaluateGeneratedMedia(args: {
  mediaUrl: string;
  mediaType: MediaType;
  originalPrompt: string;
  intent?: VideoIntent;
  attempt?: number;
}): Promise<EvaluationResult> {
  const attempt = args.attempt ?? 1;

  // Skip evaluation if no API key (always accept)
  if (!OPENAI_API_KEY) {
    return {
      score: 75,
      issues: [],
      suggestions: [],
      shouldRetry: false,
      attempt,
    };
  }

  try {
    const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

    const evalPrompt =
      args.mediaType === 'image'
        ? buildImageEvaluationPrompt({ originalPrompt: args.originalPrompt, intent: args.intent })
        : buildVideoEvaluationPrompt({ originalPrompt: args.originalPrompt, intent: args.intent });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: args.mediaUrl, detail: 'low' },
            },
            { type: 'text', text: evalPrompt },
          ],
        },
      ],
      max_tokens: 500,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const score = typeof parsed.score === 'number' ? Math.max(0, Math.min(100, parsed.score)) : 70;
    const issues: string[] = Array.isArray(parsed.issues) ? parsed.issues : [];
    const suggestions: string[] = Array.isArray(parsed.suggestions) ? parsed.suggestions : [];

    return {
      score,
      issues,
      suggestions,
      shouldRetry: score < RETRY_THRESHOLD && attempt < MAX_RETRIES,
      attempt,
    };
  } catch (err) {
    console.warn('[VideoSelfEvaluator] Vision evaluation failed:', err);
    // Fail open — don't block generation on evaluation errors
    return {
      score: 72,
      issues: [],
      suggestions: [],
      shouldRetry: false,
      attempt,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt improvement
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds an improved prompt for retry based on evaluation feedback.
 * Incorporates the suggestions from the evaluator into the prompt.
 */
export function buildRetryPrompt(ctx: RetryContext): string {
  const { originalPrompt, evaluation, attempt, intent } = ctx;

  if (evaluation.suggestions.length === 0) {
    // No specific suggestions — apply generic quality boosters
    const boosters = [
      'ultra-photorealistic',
      'sharp focus',
      'professional cinematography',
      'perfect composition',
      'high dynamic range',
    ];
    return `${originalPrompt}, ${boosters.join(', ')}`;
  }

  // Build targeted improvements from evaluation
  const fixes = evaluation.suggestions.slice(0, 3).join(', ');
  const moodBoost = intent?.moodKeywords.slice(0, 3).join(', ') || '';

  const parts = [
    originalPrompt,
    `CORRECTION (attempt ${attempt + 1}): ${fixes}`,
    moodBoost ? `Mood: ${moodBoost}` : '',
    'Photorealistic, professional cinematography, high quality',
  ].filter(Boolean);

  return parts.join('. ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility: retry configuration
// ─────────────────────────────────────────────────────────────────────────────

export const EVALUATOR_CONFIG = {
  RETRY_THRESHOLD,
  MAX_RETRIES,
};

/**
 * Determines whether a score warrants a retry.
 */
export function shouldRetry(score: number, attempt: number): boolean {
  return score < RETRY_THRESHOLD && attempt < MAX_RETRIES;
}
