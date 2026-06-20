// ────────────────────────────────────────────────────────────────────
// Song Cover Art Generator
// ────────────────────────────────────────────────────────────────────
// Generates professional album covers using FAL Flux Context (primary)
// with fallbacks to Flux Pro and other models.
//
// Cascade (professional music photography focus):
//   1. fal-ai/flux-context/text-to-image   ← PRIMARY - Flux Context (best quality)
//   2. fal-ai/flux-pro/text-to-image        ← SECONDARY - Flux Pro (fast)
//   3. fal-ai/flux/dev                      ← TERTIARY - Flux Dev
//   4. OpenAI images.generate (gpt-4o)      ← FALLBACK
// ────────────────────────────────────────────────────────────────────

import { fal } from '@fal-ai/client';
import OpenAI from 'openai';
import { buildImageMasterpieceRules, type ArtistContext } from '../utils/masterpiece-rules';
import { getBrandPromptContext } from './artist-brand-profile';

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
if (FAL_KEY) fal.config({ credentials: FAL_KEY });
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

export interface SongCoverInput {
  songTitle: string;
  artistName?: string;
  genre?: string | null;
  mood?: string | null;
  description?: string | null;
  /** User-supplied prompt — when present we still enrich it with title/style. */
  userPrompt?: string;
  /** Profile image of the artist. Used as visual anchor in EDIT mode. */
  referenceImage?: string | null;
  /** Artist's Postgres id — when present we inject the shared Brand DNA. */
  artistId?: number | string;
}

export interface SongCoverResult {
  url: string;
  provider: string;
  prompt: string;
}

/**
 * Compose a professional album-cover prompt optimized for Flux Context.
 * Applies Masterpiece Rules: composition, color theory, symbol, and permanence.
 */
export function buildSongCoverPrompt(input: SongCoverInput, brandBlock?: string): string {
  const { songTitle, artistName, genre, mood, description, userPrompt } = input;

  // Use custom prompt if provided (still enrich with masterpiece rules)
  const basePrompt = userPrompt?.trim()
    ? userPrompt.trim()
    : buildCoreImagePrompt(input);

  // Build masterpiece rules block
  const ctx: ArtistContext = {
    artistName: artistName || 'Artist',
    genre,
    mood,
    songTitle,
  };
  const masterpieceBlock = buildImageMasterpieceRules(ctx, 'album-cover');

  return `${basePrompt}${brandBlock ? `\n\n${brandBlock}` : ''}\n\n${masterpieceBlock}`;
}

/**
 * Core visual concept — called by buildSongCoverPrompt when no userPrompt is given.
 */
function buildCoreImagePrompt(input: SongCoverInput): string {
  const { songTitle, artistName, genre, mood, description } = input;

  const genreStyle = genre ? `${genre} music aesthetic` : 'contemporary music';
  const moodDescriptor = mood ? `${mood} mood` : 'professional production';

  return [
    `Premium album cover for "${songTitle}"${artistName ? ` by ${artistName}` : ''}.`,
    `${genreStyle}, ${moodDescriptor}.`,
    `Shot by renowned music photographer on Arri Alexa LF cinema camera.`,
    `Studio lighting: 3-point key + fill setup, cinematic depth of field, f/2.0 bokeh.`,
    `Color grading: award-winning color scientist, rich tones, premium look.`,
    `Composition: symmetrical golden ratio, magazine-cover visual hierarchy.`,
    `Production design: haute couture styling, luxury props, high-end retouching.`,
    `Format: square 1:1 vinyl LP cover, professional printing standards.`,
    `Style: editorial, sophisticated, timeless, iconic album artwork.`,
    `NO text, NO logos, NO watermarks, NO captions, NO typography.`,
    description ? `Creative direction: ${description.slice(0, 180)}.` : '',
  ].filter(Boolean).join(' ');
}

async function tryFalModel(modelId: string, input: any): Promise<string> {
  const result = await fal.subscribe(modelId, { input, logs: false });
  const data: any = (result as any)?.data ?? result;
  const url =
    data?.images?.[0]?.url ||
    data?.image?.url ||
    (typeof data?.images?.[0] === 'string' ? data.images[0] : null);
  if (!url) throw new Error(`fal model ${modelId} returned no image url`);
  return url;
}

async function fetchAsBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Reference fetch failed (${res.status})`);
  const contentType = res.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await res.arrayBuffer());
  return { buffer, contentType };
}

/**
 * Generate a single cover using FAL Flux Context (primary) with fallbacks.
 * Returns the image URL + which provider produced it.
 * Throws an aggregated error if every cascade step fails.
 */
export async function generateSongCover(input: SongCoverInput): Promise<SongCoverResult> {
  // Pull the shared Brand DNA (palette/mood/style) when we know the artist.
  let brandBlock = '';
  if (input.artistId != null) {
    const brandCtx = await getBrandPromptContext({
      artistId: input.artistId,
      artistName: input.artistName,
      genre: input.genre || undefined,
      artistImageUrl: input.referenceImage || undefined,
      ensure: true,
    });
    brandBlock = brandCtx.promptBlock;
  }
  const prompt = buildSongCoverPrompt(input, brandBlock);
  const errors: string[] = [];

  // ── PRIMARY: FAL Flux Context (best quality for professional covers) ──
  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/flux-context/text-to-image', {
        prompt: prompt,
        image_size: '1024x1024',
        num_images: 1,
        num_inference_steps: 28,
        guidance_scale: 7.5,
        enable_safety_checker: true,
      });
      return { url, provider: 'fal:flux-context', prompt };
    } catch (e: any) {
      errors.push(`flux-context: ${e?.message || e}`);
    }
  }

  // ── SECONDARY: FAL Flux Pro (fast, good quality) ──
  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/flux-pro/text-to-image', {
        prompt: prompt,
        image_size: '1024x1024',
        num_images: 1,
        safety_tolerance: 2,
      });
      return { url, provider: 'fal:flux-pro', prompt };
    } catch (e: any) {
      errors.push(`flux-pro: ${e?.message || e}`);
    }
  }

  // ── TERTIARY: FAL Flux Dev ──
  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/flux/dev', {
        prompt: prompt,
        image_size: '1024x1024',
        num_images: 1,
        num_inference_steps: 28,
        guidance_scale: 7.5,
      });
      return { url, provider: 'fal:flux-dev', prompt };
    } catch (e: any) {
      errors.push(`flux-dev: ${e?.message || e}`);
    }
  }

  // ── FALLBACK: OpenAI Images Generate ──
  if (OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const resp: any = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        size: '1024x1024',
        n: 1,
        quality: 'hd',
      });
      const direct = resp?.data?.[0]?.url;
      if (direct) return { url: direct, provider: 'openai:dall-e-3', prompt };
      throw new Error('OpenAI images.generate returned no data');
    } catch (e: any) {
      errors.push(`openai:dall-e-3: ${e?.message || e}`);
    }
  }

  throw new Error(`All cover-art providers failed:\n${errors.join('\n')}`);
}
