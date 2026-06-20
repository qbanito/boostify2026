/**
 * 🎨 Flux Kontext PRO Image Generator
 *
 * Generates promo images using fal-ai/flux-pro/kontext (FLUX CONTEXT PRO).
 * When a reference image URL is provided, the model maintains visual identity
 * from the reference while following the creative prompt.
 *
 * Sync mode: POST https://fal.run/fal-ai/flux-pro/kontext
 *   body: { prompt, image_url?, aspect_ratio, num_images,
 *           guidance_scale?, num_inference_steps?, output_format? }
 */
import axios from 'axios';
import { logger } from '../utils/logger';
import { getStyle, type PromoStyle } from './promo-style-presets';

// Primary and backup keys — FAL_KEY_BACKUP matches the .env variable name
const FAL_KEYS = [
  process.env.FAL_KEY,
  process.env.FAL_AI_KEY,
  process.env.FAL_API_KEY,
  process.env.FAL_KEY_BACKUP,        // ← correct .env name
  process.env.FAL_API_KEY_BACKUP,    // ← legacy alias (keep for safety)
].filter(Boolean) as string[];

const KONTEXT_ENDPOINT = 'https://fal.run/fal-ai/flux-pro/kontext';

function authHeaders(key: string) {
  return { Authorization: `Key ${key}`, 'Content-Type': 'application/json' };
}

export type AspectRatio = '1:1' | '9:16' | '16:9' | '4:5' | '3:4';

export interface KontextGenInput {
  basePrompt: string;             // creative description from GPT
  style: PromoStyle;              // preset id
  triggerWord?: string;           // artist trigger word (kept for prompt composition)
  loraUrl?: string;               // legacy — ignored by kontext (use referenceImageUrl instead)
  loraScale?: number;             // legacy — ignored by kontext
  referenceImageUrl?: string;     // artist profile / reference image for visual identity
  aspectRatio?: AspectRatio;
  seed?: number;
  numImages?: number;
  apiKeyOverride?: string;
}

export interface KontextGenOutput {
  imageUrls: string[];
  prompt: string;
  seed: number;
  raw: any;
}

export async function generateKontextImage(input: KontextGenInput): Promise<KontextGenOutput> {
  const keys = input.apiKeyOverride
    ? [input.apiKeyOverride, ...FAL_KEYS.filter(key => key !== input.apiKeyOverride)]
    : FAL_KEYS;
  if (keys.length === 0) throw new Error('No FAL API key configured (FAL_KEY / FAL_API_KEY / FAL_KEY_BACKUP)');

  const preset = getStyle(input.style);

  // Compose final prompt: trigger + creative + style suffix
  const triggerPart = input.triggerWord ? `${input.triggerWord}, ` : '';
  const prompt = `${triggerPart}${input.basePrompt}. ${preset.promptSuffix}`;

  const body: any = {
    prompt,
    aspect_ratio: input.aspectRatio ?? '4:5',
    num_images: input.numImages ?? 1,
    guidance_scale: 3.5,
    num_inference_steps: 28,
    output_format: 'jpeg',
    enable_safety_checker: true,
  };

  if (input.referenceImageUrl) body.image_url = input.referenceImageUrl;
  if (input.seed != null) body.seed = input.seed;

  logger.info('[FluxKontextPRO] generating', {
    style: input.style,
    hasReference: !!input.referenceImageUrl,
    keys: keys.length,
  });

  let lastErr: any;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    try {
      const r = await axios.post(KONTEXT_ENDPOINT, body, {
        headers: authHeaders(key),
        timeout: 120_000,
      });
      const images: any[] = r.data?.images || [];
      const imageUrls = images.map((img) => img.url).filter(Boolean);
      if (imageUrls.length === 0) {
        throw new Error('fal-ai/flux-pro/kontext returned no images: ' + JSON.stringify(r.data));
      }
      if (i > 0) logger.info('[FluxKontextPRO] succeeded with backup key', { keyIndex: i });
      return { imageUrls, prompt, seed: r.data?.seed ?? 0, raw: r.data };
    } catch (err: any) {
      const status = err?.response?.status ?? err?.status ?? 0;
      const isExhausted =
        status === 403 ||
        String(err?.message || '').toLowerCase().includes('exhausted') ||
        String(err?.message || '').toLowerCase().includes('balance') ||
        String(err?.response?.data?.detail || '').toLowerCase().includes('exhausted');
      lastErr = err;
      if (isExhausted && i < keys.length - 1) {
        logger.warn('[FluxKontextPRO] key exhausted, retrying with next key', { keyIndex: i });
        continue;
      }
      throw err; // non-recoverable or no more keys
    }
  }
  throw lastErr;
}
