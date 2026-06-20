/**
 * Video Concepts Consistency Check Engine
 * Adapted from: HKUDS/ViMax (Character Consistency System)
 *
 * Implements the ViMax pipeline:
 *   1. Generate N parallel image variants for a scene
 *   2. Use GPT-4o Vision (VLM) to select the variant most consistent
 *      with the visual theme and previously generated scenes
 *   3. Return the winner with a consistency score
 *
 * For scene 1-2: uses the best image by quality (no previous context)
 * For scene 3+:  generates 2 variants, VLM selects most consistent one
 *
 * This approach ensures that the protagonist's appearance, colour palette,
 * and film look remain coherent across all 10 storyboard scenes — the
 * core quality improvement from ViMax.
 */

import OpenAI from 'openai';
import { fal } from '@fal-ai/client';
import { createTrackedOpenAI } from '../utils/tracked-openai.js';
import type { VisualTheme } from './video-concepts-visual-theme.js';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type CandidateImage = {
  url: string;
  provider: string;
};

export type ConsistencySelectionResult = {
  selectedUrl: string;
  selectedProvider: string;
  consistencyScore: number;   // 0-100, how consistent with previous scenes
  reason: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Parallel variant generation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates N image variants of the same prompt in parallel using different
 * FAL providers. Returns all successful results.
 */
export async function generateParallelVariants(args: {
  prompt: string;
  referenceUrls?: string[];
  count?: number;
}): Promise<CandidateImage[]> {
  const count = args.count ?? 2;
  const refs = (args.referenceUrls || []).filter(Boolean);
  const prompt = args.prompt;

  // Generate all variants in parallel across different models
  const tasks: Array<Promise<CandidateImage | null>> = [];

  // Variant 1: nano-banana-2 (fast, cheap)
  if (FAL_KEY && count >= 1) {
    tasks.push(
      (async (): Promise<CandidateImage | null> => {
        try {
          const input: any = {
            prompt: `${prompt} — cinematic, photorealistic`,
            num_images: 1,
            aspect_ratio: '4:5',
            output_format: 'jpeg',
          };
          if (refs.length > 0) {
            input.image_urls = refs.slice(0, 3);
          }
          const modelId = refs.length > 0 ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2';
          const result: any = await fal.subscribe(modelId, { input, logs: false });
          const data: any = (result as any)?.data ?? result;
          const url = data?.images?.[0]?.url || data?.image?.url;
          if (!url) return null;
          return { url, provider: refs.length > 0 ? 'fal:nano-banana-2/edit' : 'fal:nano-banana-2' };
        } catch {
          return null;
        }
      })(),
    );
  }

  // Variant 2: seedream v4 (alternative style)
  if (FAL_KEY && count >= 2) {
    tasks.push(
      (async (): Promise<CandidateImage | null> => {
        try {
          const input: any = {
            prompt: `${prompt} — cinematic, photorealistic`,
            image_size: 'portrait_4_3',
            num_images: 1,
          };
          if (refs.length > 0) {
            input.image_urls = refs.slice(0, 3);
          }
          const modelId =
            refs.length > 0
              ? 'fal-ai/bytedance/seedream/v4/edit'
              : 'fal-ai/bytedance/seedream/v4/text-to-image';
          const result: any = await fal.subscribe(modelId, { input, logs: false });
          const data: any = (result as any)?.data ?? result;
          const url = data?.images?.[0]?.url || data?.image?.url;
          if (!url) return null;
          return {
            url,
            provider: refs.length > 0 ? 'fal:seedream-v4/edit' : 'fal:seedream-v4/t2i',
          };
        } catch {
          return null;
        }
      })(),
    );
  }

  const results = await Promise.all(tasks);
  return results.filter((r): r is CandidateImage => r !== null);
}

// ─────────────────────────────────────────────────────────────────────────────
// VLM consistency evaluation (ViMax-style)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a GPT-4o Vision prompt to evaluate which candidate image best
 * matches the visual theme and previously generated scenes.
 */
function buildConsistencyEvaluationPrompt(args: {
  sceneOrder: number;
  sceneDescription: string;
  visualTheme?: VisualTheme;
  previousSceneUrls: string[];
}): string {
  const { sceneOrder, sceneDescription, visualTheme, previousSceneUrls } = args;

  const themeBlock = visualTheme
    ? `
PRODUCTION BIBLE (all scenes must match):
- Colour palette: ${visualTheme.palette.join(', ')}
- Lighting: ${visualTheme.lightingStyle}
- Lens: ${visualTheme.lensCharacter}
- Film look: ${visualTheme.filmLook}
- Atmospherics: ${visualTheme.atmospherics}
- Colour temperature: ${visualTheme.colorTemperature}
    `.trim()
    : '';

  return `
You are the Director of Photography evaluating candidate images for Scene ${sceneOrder} of a premium event film.

SCENE DESCRIPTION: "${sceneDescription}"

${themeBlock}

PREVIOUS SCENES (reference images): ${previousSceneUrls.length} images shown above.

The candidate images are labelled [A], [B], etc.

Evaluate each candidate on:
1. VISUAL CONSISTENCY (50%): Does it match the palette, lighting, lens character from the Production Bible?
2. CONTINUITY (30%): Does it feel like it belongs to the same film as the previous scenes?
3. QUALITY (20%): Technical quality, composition, cinematic feel.

Respond with JSON only:
{
  "winner": "A" or "B" (or "C" etc.),
  "winnerIndex": 0 (0-based),
  "consistencyScore": 0-100,
  "reason": "one sentence explanation"
}
`.trim();
}

/**
 * Uses GPT-4o Vision to select the most consistent image from candidates.
 * Falls back to the first candidate if VLM evaluation fails.
 */
export async function selectBestConsistentImage(args: {
  candidates: CandidateImage[];
  previousSceneUrls: string[];
  visualTheme?: VisualTheme;
  sceneDescription: string;
  sceneOrder: number;
}): Promise<ConsistencySelectionResult> {
  const { candidates, previousSceneUrls, visualTheme, sceneDescription, sceneOrder } = args;

  // If only one candidate, return it directly
  if (candidates.length === 1) {
    return {
      selectedUrl: candidates[0].url,
      selectedProvider: candidates[0].provider,
      consistencyScore: 75,
      reason: 'Single candidate — no comparison performed.',
    };
  }

  // Skip VLM if no API key or no previous context (scenes 1-2)
  if (!OPENAI_API_KEY || previousSceneUrls.length === 0) {
    return {
      selectedUrl: candidates[0].url,
      selectedProvider: candidates[0].provider,
      consistencyScore: 70,
      reason: 'No previous scene context — selected first candidate.',
    };
  }

  try {
    const openai = createTrackedOpenAI({ apiKey: OPENAI_API_KEY });

    // Build the message content: previous scene images + candidate images + prompt
    const imageContent: OpenAI.ChatCompletionContentPart[] = [];

    // Add previous scenes as context (max 3 to avoid token overflow)
    previousSceneUrls.slice(-3).forEach((url, i) => {
      imageContent.push({
        type: 'text',
        text: `Previous Scene ${i + 1}:`,
      });
      imageContent.push({
        type: 'image_url',
        image_url: { url, detail: 'low' },
      });
    });

    // Add candidate images with labels
    candidates.forEach((c, i) => {
      const label = String.fromCharCode(65 + i); // A, B, C...
      imageContent.push({
        type: 'text',
        text: `Candidate [${label}]:`,
      });
      imageContent.push({
        type: 'image_url',
        image_url: { url: c.url, detail: 'low' },
      });
    });

    imageContent.push({
      type: 'text',
      text: buildConsistencyEvaluationPrompt({
        sceneOrder,
        sceneDescription,
        visualTheme,
        previousSceneUrls,
      }),
    });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'user',
          content: imageContent,
        },
      ],
      max_tokens: 300,
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);

    const winnerIndex = typeof parsed.winnerIndex === 'number' ? parsed.winnerIndex : 0;
    const winner = candidates[winnerIndex] ?? candidates[0];

    return {
      selectedUrl: winner.url,
      selectedProvider: winner.provider,
      consistencyScore: typeof parsed.consistencyScore === 'number' ? parsed.consistencyScore : 72,
      reason: String(parsed.reason || 'Selected by VLM evaluation.'),
    };
  } catch (err) {
    // Fallback to first candidate on any error
    console.warn('[ConsistencyCheck] VLM evaluation failed, using first candidate:', err);
    return {
      selectedUrl: candidates[0].url,
      selectedProvider: candidates[0].provider,
      consistencyScore: 65,
      reason: 'VLM evaluation unavailable — selected first candidate as fallback.',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: generate + select in one call
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Full ViMax-style consistency pipeline:
 *   1. Generate N variants in parallel
 *   2. VLM selects most consistent one
 *
 * For scenes 1-2 (no prior context): generates 1 variant, returns directly.
 * For scenes 3+: generates 2 variants, VLM selects best.
 */
export async function generateConsistentSceneImage(args: {
  prompt: string;
  sceneOrder: number;
  sceneDescription: string;
  referenceUrls?: string[];        // client-uploaded reference images
  previousSceneUrls?: string[];    // URLs of already-generated scene images
  visualTheme?: VisualTheme;
}): Promise<ConsistencySelectionResult & { allCandidates: CandidateImage[] }> {
  const {
    prompt,
    sceneOrder,
    sceneDescription,
    referenceUrls = [],
    previousSceneUrls = [],
    visualTheme,
  } = args;

  // For early scenes (1-2), generate a single variant to save cost
  const variantCount = sceneOrder <= 2 ? 1 : 2;

  const candidates = await generateParallelVariants({
    prompt,
    referenceUrls,
    count: variantCount,
  });

  if (candidates.length === 0) {
    throw new Error(`Consistency engine: all ${variantCount} variant generation attempts failed`);
  }

  const selection = await selectBestConsistentImage({
    candidates,
    previousSceneUrls,
    visualTheme,
    sceneDescription,
    sceneOrder,
  });

  return {
    ...selection,
    allCandidates: candidates,
  };
}
