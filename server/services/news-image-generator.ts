// ────────────────────────────────────────────────────────────────────
// AI News Cover Image Generator
// ────────────────────────────────────────────────────────────────────
// Generates HYPER-REALISTIC, NATURAL editorial photographs for news
// articles featuring the artist. When the artist's real profile photo
// is available we use EDIT mode so the generated image preserves the
// artist's actual face.
//
// Cascade (FAL-first, low-cost by default):
//   1. fal-ai/flux-pro/kontext          (edit, when artist ref exists)
//   2. fal-ai/nano-banana-2/edit
//   3. fal-ai/bytedance/seedream/v4/edit
//   4. fal-ai/flux/dev                  (text-only)
//   5. fal-ai/nano-banana-2             (text-only)
//   6. OpenAI fallbacks only when ENABLE_OPENAI_NEWS_FALLBACKS=1
//   7. placeholder
//
// Output is downloaded immediately and returned as a permanent
// data:URL (base64) so we don't end up with expiring fal/openai links.
// ────────────────────────────────────────────────────────────────────

import { fal } from '@fal-ai/client';
import axios from 'axios';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { storage } from '../firebase';

const FAL_KEY = process.env.FAL_KEY || process.env.FAL_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
// OpenAI gpt-image-1 is the strongest fallback model — it is now ON BY DEFAULT
// whenever an API key is present (FAL stays first for cost). Set
// DISABLE_OPENAI_NEWS_FALLBACKS=1 to force it off; ENABLE_OPENAI_NEWS_FALLBACKS=1
// keeps working for backwards compatibility.
const enableOpenAINewsFallbacks =
  process.env.DISABLE_OPENAI_NEWS_FALLBACKS === '1'
    ? false
    : (process.env.ENABLE_OPENAI_NEWS_FALLBACKS === '1' || !!OPENAI_API_KEY);
if (FAL_KEY) {
  try { fal.config({ credentials: FAL_KEY }); } catch { /* ignore */ }
}

// Upload b64 to Firebase Storage to get a permanent URL (mirror of fal-service helper)
async function uploadNewsBase64(base64Data: string, mimeType = 'image/png'): Promise<string> {
  try {
    if (!storage) return `data:${mimeType};base64,${base64Data}`;
    const ts = Date.now();
    const rid = Math.random().toString(36).slice(2, 8);
    const ext = mimeType.split('/')[1] || 'png';
    const fileName = `news-images/${ts}_${rid}.${ext}`;
    const bucket = storage.bucket();
    const file = bucket.file(fileName);
    await file.save(Buffer.from(base64Data, 'base64'), {
      metadata: { contentType: mimeType },
      validation: false,
    });
    return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
  } catch (e: any) {
    logger.error('[News-Image] upload to Storage failed:', e?.message || e);
    return `data:${mimeType};base64,${base64Data}`;
  }
}

export interface NewsImageInput {
  /** Article title (used in prompt). */
  title: string;
  /** Artist's stage name. */
  artistName: string;
  /** Music genre — drives wardrobe / scene cues. */
  genre?: string | null;
  /** News category (release / performance / collaboration / achievement / lifestyle / artist-debut / etc). */
  category?: string | null;
  /** Short article summary or angle — used to ground the scene. */
  context?: string | null;
  /** Profile photo of the real artist. When provided we use EDIT models. */
  referenceImageUrl?: string | null;
  /** Aspect ratio. Defaults to 16:9 for news covers. */
  aspectRatio?: '16:9' | '4:3' | '1:1' | '9:16';
  /** OpenAI gpt-image-1 quality. Defaults to 'high' for spectacular covers. */
  openaiQuality?: 'low' | 'medium' | 'high' | 'auto';
  /** OpenAI gpt-image-1 size. Defaults to '1536x1024' (landscape) for news covers. */
  openaiSize?: '1024x1024' | '1024x1536' | '1536x1024' | 'auto';
  /**
   * Visual treatment. 'newspaper' = dramatic classic front-page photojournalism
   * (default — looks like a prestige newspaper front page). 'editorial' = the
   * earlier natural magazine-style look.
   */
  style?: 'newspaper' | 'editorial';
}

export interface NewsImageResult {
  imageUrl: string;
  prompt: string;
  provider: string;
}

// ── Prompt Builder ─────────────────────────────────────────────
export function buildNewsImagePrompt(input: NewsImageInput): string {
  const { title, artistName, genre, category, context, referenceImageUrl } = input;
  const style = input.style || 'newspaper';

  const sceneByCategory: Record<string, string> = {
    release: 'the artist unveiling new music — caught mid-moment, real-world location, dramatic available light, a decisive front-page instant',
    performance: 'the artist commanding a real stage mid-performance, sweat and stage haze, a sea of raised hands, a once-in-a-tour photograph',
    collaboration: 'the artist with fellow musicians in a real recording studio or backstage, candid energy and conversation, available light',
    achievement: 'the artist at the peak of a milestone, honest raw emotion, real environment, dramatic light breaking through — a defining career image',
    lifestyle: 'the artist in a real urban or natural setting, an unguarded human moment, in the tradition of Magnum street photojournalism',
    'artist-debut': 'the artist arriving on the music scene, real venue lobby or rooftop at dusk, the air of an event being witnessed',
    song_released: 'the artist on release day caught in a candid, charged moment in a real environment, dramatic natural light',
    artist_debut: 'the artist debuting at a real venue, photojournalistic, the energy of a breaking story',
    song_tokenized: 'the artist beside glowing screens of music data in a real studio, late-night newsroom energy, available light',
    album_complete: 'the artist holding a vinyl record in a real listening room, warm tungsten glow, reflective and historic',
    merch_launched: 'the artist wearing their own merch on a real city street, candid documentary energy, motion in the frame',
    crowdfunding_started: 'the artist surrounded by a small crowd of real-looking fans, a movement gathering, available daylight',
    milestone_reached: 'the artist mid-celebration, real friends erupting around them, an unrepeatable reaction shot',
    collaboration_announced: 'two musicians meeting in a real studio, a handshake or shared laugh that signals something historic',
    distribution_live: 'the artist with headphones at a real console, screens aglow, the quiet intensity before a launch',
  };

  const scene = sceneByCategory[(category || '').toLowerCase()] ||
    sceneByCategory.lifestyle;

  const subject = referenceImageUrl
    ? `The subject is ${artistName} — preserve the EXACT face, skin tone, hair, eye color and overall likeness from the reference photo. The person must clearly be the same real human, photographed for real, NOT a stylized or AI-looking version.`
    : `The subject is a ${genre || 'music'} artist named ${artistName}.`;

  // CLASSIC NEWSPAPER (default): dramatic, timeless, prestige front-page photojournalism.
  const newspaperDirection = [
    'CLASSIC NEWSPAPER FRONT-PAGE PHOTOGRAPH — a single powerful press image as it would run above the fold on the front page of a prestige newspaper (The New York Times, The Guardian, Le Monde).',
    'Timeless photojournalistic composition with a strong decisive moment, rich tonal range, deep blacks and luminous highlights, cinematic yet utterly believable.',
    'Dramatic real-world lighting (raking sunlight, stage spill, tungsten, window light) sculpting the subject — high impact but natural, in the tradition of a Pulitzer-winning press photo.',
    'Shot on a full-frame DSLR / Leica with a 35mm or 50mm prime, shallow depth of field, fine silver-halide film grain, slight vignette, accurate true-to-life color science (or rich classic black-and-white if it serves the drama).',
    'Hyper-realistic natural skin with pores and texture, lifelike eyes with catchlights, real hair strands, honest human expression — looks PHOTOGRAPHED, never illustrated or rendered.',
    'Leave a little clean negative space / sky so the image works as a front-page lead photo. Editorial, spectacular, emotionally arresting.',
    'Strict rules: NO text, NO headlines, NO captions, NO logos, NO watermarks, NO newspaper layout or columns drawn in the image, NO illustration, NO 3D render, NO plastic airbrushed skin, NO neon cyberpunk glow, NO uncanny-valley features.',
  ].join(' ');

  const editorialDirection = [
    'Hyper-realistic natural photograph — looks like a real photo taken with a Sony A7 IV or Leica Q3 by a professional editorial photographer.',
    'Natural skin texture with visible pores and imperfections, realistic eyes with proper catchlights, natural body proportions, lifelike hair strands.',
    'Real-world ambient lighting (natural sunlight, tungsten, sodium street lights or stage lighting). NO neon glow, NO over-saturated cyberpunk colors, NO digital-art look.',
    'Shallow depth of field, 35mm or 50mm lens feel, slight film grain, accurate color science, photojournalistic composition.',
    'Mood: editorial, honest, documentary-grade. As if shot for Rolling Stone, The New York Times, or NPR Music.',
    'Strict rules: NO text, NO captions, NO logos, NO watermarks, NO illustration, NO 3D render, NO airbrushed plastic skin, NO uncanny valley features.',
  ].join(' ');

  const photoDirection = style === 'editorial' ? editorialDirection : newspaperDirection;

  const headline = style === 'editorial'
    ? `Editorial news photo for the article "${title}".`
    : `Front-page news photograph for the story "${title}". Show ${scene}.`;
  const grounding = context ? `Story context: ${String(context).slice(0, 240)}.` : '';

  return [headline, subject, scene, grounding, photoDirection]
    .filter(Boolean)
    .join(' ');
}

// ── Helpers ────────────────────────────────────────────────────
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

async function downloadAsDataUrl(url: string): Promise<string | null> {
  try {
    if (url.startsWith('data:')) return url;
    const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) return null;
    const buffer = await resp.arrayBuffer();
    const ct = resp.headers.get('content-type') || 'image/png';
    return `data:${ct};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch {
    return null;
  }
}

function aspectToImageSize(ar: NewsImageInput['aspectRatio']): string {
  switch (ar) {
    case '1:1': return 'square_hd';
    case '9:16': return 'portrait_16_9';
    case '4:3': return 'landscape_4_3';
    case '16:9':
    default: return 'landscape_16_9';
  }
}

// ── Main Cascade ───────────────────────────────────────────────
export async function generateNewsImage(input: NewsImageInput): Promise<NewsImageResult> {
  const prompt = buildNewsImagePrompt(input);
  const ref = input.referenceImageUrl?.trim() || null;
  const aspectRatio = input.aspectRatio || '16:9';
  const imageSize = aspectToImageSize(aspectRatio);
  const errors: string[] = [];

  const finalize = async (rawUrl: string, provider: string): Promise<NewsImageResult> => {
    const permanent = (await downloadAsDataUrl(rawUrl)) || rawUrl;
    return { imageUrl: permanent, prompt, provider };
  };

  // ── EDIT-MODE attempts (only when we have the artist photo) ─────
  if (ref) {
    // 1. fal-ai/flux-pro/kontext — best low-cost edit for ref-preserving editorial shots
    if (FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/flux-pro/kontext', {
          prompt,
          image_url: ref,
          image_size: imageSize,
          output_format: 'jpeg',
        });
        return finalize(url, 'fal:flux-pro/kontext');
      } catch (e: any) {
        errors.push(`flux-pro/kontext: ${e?.message || e}`);
        logger.warn('[News-Image] flux-pro/kontext failed:', e?.message || e);
      }
    }

    // 2. nano-banana-2/edit
    if (FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/nano-banana-2/edit', {
          prompt,
          image_urls: [ref],
          num_images: 1,
          aspect_ratio: aspectRatio,
          output_format: 'jpeg',
        });
        return finalize(url, 'fal:nano-banana-2/edit');
      } catch (e: any) {
        errors.push(`nano-banana-2/edit: ${e?.message || e}`);
        logger.warn('[News-Image] nano-banana-2/edit failed:', e?.message || e);
      }
    }

    // 3. seedream/v4/edit
    if (FAL_KEY) {
      try {
        const url = await tryFalModel('fal-ai/bytedance/seedream/v4/edit', {
          prompt,
          image_urls: [ref],
          image_size: imageSize,
          num_images: 1,
        });
        return finalize(url, 'fal:seedream-v4/edit');
      } catch (e: any) {
        errors.push(`seedream-v4/edit: ${e?.message || e}`);
        logger.warn('[News-Image] seedream-v4/edit failed:', e?.message || e);
      }
    }

    if (enableOpenAINewsFallbacks && OPENAI_API_KEY) {
      try {
        const oaQuality: 'low' | 'medium' | 'high' | 'auto' =
          (input.openaiQuality as any) ||
          (process.env.OPENAI_IMAGE_QUALITY as any) ||
          'high';
        const oaSize: '1024x1024' | '1024x1536' | '1536x1024' | 'auto' =
          (input.openaiSize as any) ||
          (process.env.OPENAI_NEWS_IMAGE_SIZE as any) ||
          (aspectRatio === '9:16' ? '1024x1536' : aspectRatio === '1:1' ? '1024x1024' : '1536x1024');

        logger.log(`[News-Image] 🤖 OpenAI gpt-image-1 /v1/images/edits fallback (q=${oaQuality}, ${oaSize})`);

        const FormData = (await import('form-data')).default;
        const form = new FormData();
        form.append('model', 'gpt-image-1');
        form.append('prompt', prompt.slice(0, 32000));
        form.append('size', oaSize);
        form.append('quality', oaQuality);
        form.append('n', '1');

        const imgResp = await axios.get(ref, { responseType: 'arraybuffer', timeout: 30000 });
        const buf = Buffer.from(imgResp.data);
        const pngBuf = await sharp(buf).png().toBuffer();
        form.append('image[]', pngBuf, { filename: 'artist_ref.png', contentType: 'image/png' });

        const oaResp = await axios.post(
          'https://api.openai.com/v1/images/edits',
          form,
          {
            headers: { ...form.getHeaders(), Authorization: `Bearer ${OPENAI_API_KEY}` },
            timeout: 240000,
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
          }
        );
        const b64 = oaResp.data?.data?.[0]?.b64_json;
        const remoteUrl = oaResp.data?.data?.[0]?.url;
        if (b64) {
          const permanentUrl = await uploadNewsBase64(b64, 'image/png');
          return { imageUrl: permanentUrl, prompt, provider: 'openai-direct:gpt-image-1/edits' };
        }
        if (remoteUrl) {
          return finalize(remoteUrl, 'openai-direct:gpt-image-1/edits');
        }
      } catch (e: any) {
        const detail = e?.response?.data?.error?.message || e?.response?.data || e?.message;
        errors.push(`openai-direct/edit: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
      }
    }
  }

  // ── TEXT-TO-IMAGE fallbacks (no reference photo, or all edits failed) ──
  // 1. Flux Dev first for better cost/quality than OpenAI
  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/flux/dev', {
        prompt,
        image_size: imageSize,
        num_images: 1,
        enable_safety_checker: true,
        num_inference_steps: 28,
        guidance_scale: 3.5,
      });
      return finalize(url, 'fal:flux/dev');
    } catch (e: any) {
      errors.push(`flux/dev: ${e?.message || e}`);
      logger.warn('[News-Image] flux/dev failed:', e?.message || e);
    }
  }

  if (FAL_KEY) {
    try {
      const url = await tryFalModel('fal-ai/nano-banana-2', {
        prompt,
        aspect_ratio: aspectRatio,
        num_images: 1,
        output_format: 'jpeg',
      });
      return finalize(url, 'fal:nano-banana-2');
    } catch (e: any) {
      errors.push(`nano-banana-2: ${e?.message || e}`);
    }
  }

  if (enableOpenAINewsFallbacks && OPENAI_API_KEY) {
    try {
      const oaQuality: 'low' | 'medium' | 'high' | 'auto' =
        (input.openaiQuality as any) ||
        (process.env.OPENAI_IMAGE_QUALITY as any) ||
        'high';
      const oaSize: '1024x1024' | '1024x1536' | '1536x1024' | 'auto' =
        (input.openaiSize as any) ||
        (process.env.OPENAI_NEWS_IMAGE_SIZE as any) ||
        (aspectRatio === '9:16' ? '1024x1536' : aspectRatio === '1:1' ? '1024x1024' : '1536x1024');

      logger.log(`[News-Image] 🤖 OpenAI gpt-image-1 /v1/images/generations fallback (q=${oaQuality}, ${oaSize})`);
      const oaResp = await axios.post(
        'https://api.openai.com/v1/images/generations',
        { model: 'gpt-image-1', prompt: prompt.slice(0, 32000), size: oaSize, quality: oaQuality, n: 1 },
        {
          headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
          timeout: 240000,
        }
      );
      const b64 = oaResp.data?.data?.[0]?.b64_json;
      const remoteUrl = oaResp.data?.data?.[0]?.url;
      if (b64) {
        const permanentUrl = await uploadNewsBase64(b64, 'image/png');
        return { imageUrl: permanentUrl, prompt, provider: 'openai-direct:gpt-image-1/generations' };
      }
      if (remoteUrl) return finalize(remoteUrl, 'openai-direct:gpt-image-1/generations');
    } catch (e: any) {
      const detail = e?.response?.data?.error?.message || e?.response?.data || e?.message;
      errors.push(`openai-direct/t2i: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
    }
  }

  // ── Final placeholder ─────────────────────────────────────────
  logger.error('[News-Image] All providers failed. Errors:', errors.join(' | '));
  return {
    imageUrl: `https://placehold.co/1536x1024/1a1a2e/f97316?text=${encodeURIComponent(input.title.slice(0, 30))}`,
    prompt,
    provider: 'placeholder',
  };
}
