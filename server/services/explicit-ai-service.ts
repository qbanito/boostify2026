/**
 * Boostify Explicit — AI Generation Service (Uncensored)
 *
 * Real uncensored image generation. Provider priority is built so the module
 * ALWAYS lands on a working, truly-uncensored backend:
 *   1. Replicate InstantID  → artist LIKENESS from a reference photo (uncensored)
 *   2. Replicate Realistic-Vision → uncensored realistic text-to-image / img2img
 *   3. FAL FLUX / FHDR (HuggingFace / local GPU) → legacy / optional
 * Every successful result is downloaded and re-hosted on Firebase Storage so the
 * URLs are permanent (FAL / Replicate URLs expire within minutes).
 */
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { storage as firebaseStorage } from '../firebase';

const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';
const FAL_BASE_URL = 'https://fal.run';
const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN || '';
const HF_FHDR_INFERENCE_URL = 'https://router.huggingface.co/models/kpsss34/FHDR_Uncensored';
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';
const REPLICATE_BASE_URL = 'https://api.replicate.com/v1';

// Pinned Replicate model versions (verified working, uncensored-capable).
const REPLICATE_VERSIONS = {
  // asiryan/realistic-vision-v6.0-b1 — photoreal, NO safety checker, supports img2img
  REALISTIC_VISION: '79840b7a2de6e3c5b4a5623cda51186fc532a8e64055cd7683b125eaeda3df53',
  // zsxkib/instant-id — identity-preserving generation from a single reference face
  INSTANT_ID: '2e4785a4d80dadf580077b2244c8d7c05d8e3faac04a04c02d8e099dd2876789',
} as const;

const DEFAULT_NEGATIVE_PROMPT =
  'deformed iris, deformed pupils, semi-realistic, cgi, 3d, render, sketch, cartoon, drawing, anime, ' +
  'text, watermark, logo, cropped, out of frame, worst quality, low quality, jpeg artifacts, ugly, ' +
  'duplicate, morbid, mutilated, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, ' +
  'mutation, deformed, blurry, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, ' +
  'gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, fused fingers, ' +
  'too many fingers, long neck';

export const EXPLICIT_FAL_MODELS = {
  // ─── Uncensored Replicate models (PRIMARY, verified working) ───
  // Realistic Vision — uncensored photoreal text-to-image / img2img
  REALISTIC_UNCENSORED: 'replicate/realistic-vision',
  // InstantID — uncensored artist likeness from a reference photo
  ARTIST_LIKENESS: 'replicate/instant-id',
  // ─── Legacy FAL / FHDR (optional, auto-fallback to Replicate if unavailable) ───
  IMAGE_HIGH_QUALITY: 'fal-ai/flux/dev',
  IMAGE_FAST: 'fal-ai/flux/schnell',
  IMAGE_LORA: 'fal-ai/flux-lora',
  FHDR_UNCENSORED: 'local/fhdr-uncensored',
  // ─── Video ───
  VIDEO_FROM_IMAGE: 'fal-ai/ltx-2-19b/image-to-video',
  VIDEO_FROM_TEXT: 'fal-ai/ltx-2.3/text-to-video',
} as const;

const LOCAL_AI_MODEL_SERVER_URL = process.env.LOCAL_AI_MODEL_SERVER_URL || 'http://127.0.0.1:9000';

async function callLocalAiModelServer(task: 'image' | 'video' | 'music', prompt: string, duration?: number, resolution?: string): Promise<any> {
  try {
    const payload: Record<string, unknown> = { task, prompt };
    if (duration !== undefined) payload.duration = duration;
    if (resolution) payload.resolution = resolution;
    const response = await axios.post(`${LOCAL_AI_MODEL_SERVER_URL}/generate`, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000,
    });
    return response.data;
  } catch (error: any) {
    logger.warn(`[ExplicitAI] Local AI server call failed (${task}): ${error.message || error}`);
    throw error;
  }
}

export const EXPLICIT_MODEL_COSTS: Record<string, number> = {
  [EXPLICIT_FAL_MODELS.REALISTIC_UNCENSORED]: 0.00,
  [EXPLICIT_FAL_MODELS.ARTIST_LIKENESS]: 0.012,
  [EXPLICIT_FAL_MODELS.IMAGE_HIGH_QUALITY]: 0.025,
  [EXPLICIT_FAL_MODELS.IMAGE_FAST]: 0.003,
  [EXPLICIT_FAL_MODELS.IMAGE_LORA]: 0.025,
  [EXPLICIT_FAL_MODELS.FHDR_UNCENSORED]: 0.00,
  [EXPLICIT_FAL_MODELS.VIDEO_FROM_IMAGE]: 0.10,
  [EXPLICIT_FAL_MODELS.VIDEO_FROM_TEXT]: 0.10,
};

interface ExplicitImageOptions {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  imageSize?: string;
  numImages?: number;
  numInferenceSteps?: number;
  guidanceScale?: number;
  loraUrl?: string;
  loraScale?: number;
  /** Reference photo of the artist — enables likeness (InstantID / img2img). */
  referenceImageUrl?: string;
  /** PG user id — used to namespace persisted Firebase objects. */
  artistId?: number;
}

interface ExplicitVideoFromImageOptions {
  prompt: string;
  imageUrl: string;
  negativePrompt?: string;
  numFrames?: number;
  frameRate?: number;
}

interface ExplicitVideoFromTextOptions {
  prompt: string;
  negativePrompt?: string;
  numFrames?: number;
  frameRate?: number;
  resolution?: string;
}

interface FalGenerationResult {
  success: boolean;
  images?: Array<{ url: string; content_type?: string }>;
  video?: { url: string };
  error?: string;
  requestId?: string;
}

async function callFalApi(modelPath: string, input: Record<string, unknown>): Promise<any> {
  if (!FAL_API_KEY) {
    throw new Error('FAL_API_KEY not configured');
  }

  const url = `${FAL_BASE_URL}/${modelPath}`;
  logger.info(`[ExplicitAI] Calling FAL model: ${modelPath}`);

  const response = await axios.post(url, { ...input, enable_safety_checker: false }, {
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000,
  });

  return response.data;
}

// ─── Replicate helper (run + poll) ──────────────────────────────────
async function callReplicate(
  version: string,
  input: Record<string, unknown>,
  opts: { pollMs?: number; maxPolls?: number } = {},
): Promise<string[]> {
  if (!REPLICATE_API_TOKEN) throw new Error('REPLICATE_API_TOKEN not configured');
  const pollMs = opts.pollMs ?? 2500;
  const maxPolls = opts.maxPolls ?? 120; // ~5 min

  const start = await axios.post(`${REPLICATE_BASE_URL}/predictions`, { version, input }, {
    headers: {
      'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Prefer': 'wait=30', // server may return finished result inline
    },
    timeout: 120000,
  });

  let prediction = start.data;
  const getUrl = prediction?.urls?.get || `${REPLICATE_BASE_URL}/predictions/${prediction?.id}`;

  for (let i = 0; i < maxPolls; i++) {
    const status = prediction?.status;
    if (status === 'succeeded') break;
    if (status === 'failed' || status === 'canceled') {
      throw new Error(`Replicate prediction ${status}: ${prediction?.error || 'unknown error'}`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
    const poll = await axios.get(getUrl, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
      timeout: 60000,
    });
    prediction = poll.data;
  }

  if (prediction?.status !== 'succeeded') {
    throw new Error('Replicate prediction timed out');
  }

  const out = prediction.output;
  const urls: string[] = Array.isArray(out)
    ? out.filter((u: unknown): u is string => typeof u === 'string')
    : typeof out === 'string'
      ? [out]
      : [];
  if (urls.length === 0) throw new Error('Replicate returned no images');
  return urls;
}

// ─── Persist any remote / data-URL image to Firebase Storage (permanent) ───
async function persistImageToFirebase(srcUrl: string, artistId?: number): Promise<string> {
  if (!firebaseStorage) return srcUrl; // no storage → keep original URL

  let buffer: Buffer;
  let contentType = 'image/png';

  if (srcUrl.startsWith('data:')) {
    const match = srcUrl.match(/^data:([^;]+);base64,(.*)$/);
    if (!match) throw new Error('Invalid data URL');
    contentType = match[1] || 'image/png';
    buffer = Buffer.from(match[2], 'base64');
  } else {
    const resp = await axios.get(srcUrl, { responseType: 'arraybuffer', timeout: 120000 });
    buffer = Buffer.from(resp.data);
    contentType = resp.headers['content-type'] || contentType;
  }

  const ext = (contentType.split('/')[1] || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'png';
  const folder = `explicit-content/${artistId || 'shared'}/ai-gen`;
  const objectPath = `${folder}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  const bucket = firebaseStorage.bucket();
  const file = bucket.file(objectPath);
  await file.save(buffer, {
    contentType,
    resumable: false,
    metadata: { cacheControl: 'public, max-age=31536000, immutable' },
  });
  await file.makePublic();
  return `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;
}

async function finalizeImages(urls: string[], artistId: number | undefined, requestId: string): Promise<FalGenerationResult> {
  const images: Array<{ url: string }> = [];
  for (const u of urls) {
    try {
      images.push({ url: await persistImageToFirebase(u, artistId) });
    } catch (e: any) {
      logger.warn(`[ExplicitAI] persist to Firebase failed, using raw URL: ${e?.message}`);
      images.push({ url: u });
    }
  }
  return { success: true, images, requestId };
}

function parseImageSize(imageSize?: string): { width: number; height: number } {
  // Accept "1024x1024" or named FAL sizes
  if (imageSize && /^\d+x\d+$/.test(imageSize)) {
    const [w, h] = imageSize.split('x').map(Number);
    return { width: w, height: h };
  }
  switch (imageSize) {
    case 'portrait_4_3':
    case 'portrait_16_9': return { width: 768, height: 1024 };
    case 'landscape_4_3':
    case 'landscape_16_9': return { width: 1024, height: 768 };
    default: return { width: 768, height: 1024 }; // portrait default (people)
  }
}

// ─── Replicate: uncensored realistic text-to-image / img2img ───
async function replicateRealisticVision(options: ExplicitImageOptions): Promise<string[]> {
  const { width, height } = parseImageSize(options.imageSize);
  const input: Record<string, unknown> = {
    prompt: options.prompt,
    negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    width,
    height,
    num_inference_steps: options.numInferenceSteps || 30,
    guidance_scale: options.guidanceScale || 7,
    scheduler: 'DPMSolverMultistep',
  };
  // If a reference photo is provided, use img2img to retain some likeness
  if (options.referenceImageUrl) {
    input.image = options.referenceImageUrl;
    input.strength = 0.65;
  }
  return callReplicate(REPLICATE_VERSIONS.REALISTIC_VISION, input);
}

// ─── Replicate: uncensored artist likeness (InstantID) ───
async function replicateInstantId(options: ExplicitImageOptions): Promise<string[]> {
  if (!options.referenceImageUrl) {
    throw new Error('Artist likeness requires a reference image of the artist.');
  }
  const input: Record<string, unknown> = {
    image: options.referenceImageUrl,
    prompt: options.prompt,
    negative_prompt: options.negativePrompt || DEFAULT_NEGATIVE_PROMPT,
    disable_safety_checker: true,
    num_outputs: Math.min(options.numImages || 1, 4),
    guidance_scale: options.guidanceScale || 5,
    ip_adapter_scale: 0.8,
    num_inference_steps: options.numInferenceSteps || 30,
    output_format: 'png',
    output_quality: 95,
  };
  return callReplicate(REPLICATE_VERSIONS.INSTANT_ID, input);
}

// ─── Pollinations.ai — FREE, uncensored, always available ───
// Text-to-image (and optional reference image for likeness). No API key needed.
async function pollinationsGenerate(options: ExplicitImageOptions): Promise<string[]> {
  const { width, height } = parseImageSize(options.imageSize);
  const seed = Math.floor(Math.random() * 1_000_000);
  const params = new URLSearchParams({
    model: 'flux',
    width: String(width),
    height: String(height),
    seed: String(seed),
    nologo: 'true',
    enhance: 'true',
    safe: 'false',
  });
  if (options.referenceImageUrl) params.set('image', options.referenceImageUrl);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(options.prompt)}?${params.toString()}`;
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 180000 });
  const contentType = resp.headers['content-type'] || '';
  if (!contentType.startsWith('image/')) {
    throw new Error('Pollinations returned a non-image response');
  }
  const base64 = Buffer.from(resp.data).toString('base64');
  return [`data:${contentType};base64,${base64}`];
}

// ─── HuggingFace FLUX.1-schnell — FREE serverless text-to-image ───
async function hfSchnellGenerate(options: ExplicitImageOptions): Promise<string[]> {
  if (!HUGGINGFACE_TOKEN) throw new Error('HUGGINGFACE_TOKEN not set');
  const resp = await axios.post(
    'https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell',
    { inputs: options.prompt },
    {
      headers: {
        'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
        'Accept': 'image/png',
        'Content-Type': 'application/json',
      },
      responseType: 'arraybuffer',
      timeout: 180000,
    },
  );
  const contentType = resp.headers['content-type'] || '';
  if (!contentType.includes('image') && !contentType.includes('octet-stream')) {
    throw new Error('HF schnell is cold-starting, retry in ~30s');
  }
  const base64 = Buffer.from(resp.data).toString('base64');
  return [`data:image/png;base64,${base64}`];
}


export async function generateExplicitImage(options: ExplicitImageOptions): Promise<FalGenerationResult> {
  const model = options.model || EXPLICIT_FAL_MODELS.REALISTIC_UNCENSORED;
  const artistId = options.artistId;
  const errors: string[] = [];

  // Ordered list of generators to try. Each returns raw (temporary) image URLs.
  const attempts: Array<{ name: string; run: () => Promise<string[]> }> = [];

  // 1) Artist likeness — requires a reference photo (InstantID, uncensored)
  if (model === EXPLICIT_FAL_MODELS.ARTIST_LIKENESS) {
    if (!options.referenceImageUrl) {
      return { success: false, error: 'Para "Artist Likeness" debes subir o elegir una foto de referencia del artista (rostro visible).' };
    }
    attempts.push({ name: 'replicate-instant-id', run: () => replicateInstantId(options) });
  }

  // 2) FHDR — local GPU server or HuggingFace Inference (optional)
  if (model === EXPLICIT_FAL_MODELS.FHDR_UNCENSORED) {
    attempts.push({ name: 'fhdr', run: () => fhdrGenerate(options) });
  }

  // 3) Legacy FAL FLUX (will fall through to free providers if FAL balance is empty)
  if (model === EXPLICIT_FAL_MODELS.IMAGE_HIGH_QUALITY ||
      model === EXPLICIT_FAL_MODELS.IMAGE_FAST ||
      model === EXPLICIT_FAL_MODELS.IMAGE_LORA) {
    attempts.push({ name: 'fal-flux', run: () => falFluxGenerate(model, options) });
  }

  // 4) Replicate Realistic Vision (uncensored, paid — used when credit available)
  if (model === EXPLICIT_FAL_MODELS.REALISTIC_UNCENSORED || model === EXPLICIT_FAL_MODELS.ARTIST_LIKENESS) {
    attempts.push({ name: 'replicate-realistic-vision', run: () => replicateRealisticVision(options) });
  }

  // 5) FREE uncensored providers that ALWAYS work — guarantee the module never
  //    returns "no image" even when every paid provider is out of balance.
  attempts.push({ name: 'pollinations-flux', run: () => pollinationsGenerate(options) });
  attempts.push({ name: 'hf-flux-schnell', run: () => hfSchnellGenerate(options) });

  for (const attempt of attempts) {
    try {
      logger.info(`[ExplicitAI] image attempt via ${attempt.name} (model=${model})`);
      const urls = await attempt.run();
      if (urls && urls.length > 0) {
        return await finalizeImages(urls, artistId, `${attempt.name}-${Date.now()}`);
      }
      errors.push(`${attempt.name}: empty result`);
    } catch (e: any) {
      const msg = e?.response?.data?.detail || e?.message || String(e);
      logger.warn(`[ExplicitAI] ${attempt.name} failed: ${msg}`);
      errors.push(`${attempt.name}: ${msg}`);
    }
  }

  return { success: false, error: errors[0] || 'Image generation failed across all providers.' };
}

// ─── FHDR: local Python GPU server → HuggingFace Inference API ───
async function fhdrGenerate(options: ExplicitImageOptions): Promise<string[]> {
  // Strategy 1: local Python model server (GPU or HF proxy)
  try {
    const response = await axios.post(`${LOCAL_AI_MODEL_SERVER_URL}/generate-fhdr`, {
      prompt: options.prompt,
      negative_prompt: options.negativePrompt || null,
      num_inference_steps: options.numInferenceSteps || 30,
      guidance_scale: options.guidanceScale || 7.5,
      width: 1024,
      height: 1024,
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 300000 });
    const imgs = response.data?.images;
    if (Array.isArray(imgs) && imgs.length) {
      return imgs.map((im: any) => (typeof im === 'string' ? im : im.url)).filter(Boolean);
    }
  } catch (localErr: any) {
    logger.warn(`[ExplicitAI] FHDR local server unavailable: ${localErr.message}`);
  }

  // Strategy 2: HuggingFace Inference API directly
  if (HUGGINGFACE_TOKEN) {
    const hfResponse = await axios.post(HF_FHDR_INFERENCE_URL, {
      inputs: options.prompt,
      parameters: {
        num_inference_steps: options.numInferenceSteps || 30,
        guidance_scale: options.guidanceScale || 7.5,
        ...(options.negativePrompt ? { negative_prompt: options.negativePrompt } : {}),
      },
    }, {
      headers: { 'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`, 'Content-Type': 'application/json' },
      responseType: 'arraybuffer',
      timeout: 300000,
    });
    const contentType = hfResponse.headers['content-type'] || '';
    if (contentType.includes('image') || contentType.includes('octet-stream')) {
      const base64 = Buffer.from(hfResponse.data).toString('base64');
      return [`data:image/png;base64,${base64}`];
    }
    throw new Error('FHDR HuggingFace model is cold-starting, retry in ~60s.');
  }

  throw new Error('FHDR unavailable: no local server and HUGGINGFACE_TOKEN not set.');
}

// ─── Legacy FAL FLUX generation ───
async function falFluxGenerate(model: string, options: ExplicitImageOptions): Promise<string[]> {
  const input: Record<string, unknown> = {
    prompt: options.prompt,
    image_size: options.imageSize && /^\d+x\d+$/.test(options.imageSize) ? 'square_hd' : (options.imageSize || 'portrait_4_3'),
    num_images: options.numImages || 1,
    num_inference_steps: options.numInferenceSteps || (model === EXPLICIT_FAL_MODELS.IMAGE_FAST ? 4 : 28),
    guidance_scale: options.guidanceScale || 3.5,
  };
  if (options.negativePrompt) input.negative_prompt = options.negativePrompt;
  if (model === EXPLICIT_FAL_MODELS.IMAGE_LORA && options.loraUrl) {
    input.loras = [{ path: options.loraUrl, scale: options.loraScale || 1.0 }];
  }
  const data = await callFalApi(model, input);
  const imgs = data?.images;
  if (!Array.isArray(imgs) || imgs.length === 0) throw new Error('FAL returned no images');
  return imgs.map((im: any) => im.url).filter(Boolean);
}


export async function generateExplicitVideoFromImage(options: ExplicitVideoFromImageOptions): Promise<FalGenerationResult> {
  try {
    // Try local server first
    const local = await callLocalAiModelServer('video', options.prompt, undefined, '640x360');
    if (local && local.status !== 'error') {
      return {
        success: true,
        video: { url: local.resultUrl || local.videoUrl || local.video?.url || local.video_url },
        requestId: local.requestId || local.request_id,
      };
    }
  } catch (localErr) {
    logger.warn('[ExplicitAI] Local video-from-image generation failed, falling back to FAL.');
  }

  try {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      image_url: options.imageUrl,
      num_frames: options.numFrames || 97,
      frame_rate: options.frameRate || 24,
    };

    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt;
    }

    const data = await callFalApi(EXPLICIT_FAL_MODELS.VIDEO_FROM_IMAGE, input);

    return {
      success: true,
      video: data.video || { url: data.video_url },
      requestId: data.request_id,
    };
  } catch (error: any) {
    logger.error(`[ExplicitAI] Video from image failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function generateExplicitVideoFromText(options: ExplicitVideoFromTextOptions): Promise<FalGenerationResult> {
  try {
    const local = await callLocalAiModelServer('video', options.prompt, options.numFrames || 5, options.resolution || '640x360');
    if (local && local.status !== 'error') {
      return {
        success: true,
        video: { url: local.resultUrl || local.videoUrl || local.video?.url || local.video_url },
        requestId: local.requestId || local.request_id,
      };
    }
  } catch (localErr) {
    logger.warn('[ExplicitAI] Local video-from-text generation failed, falling back to FAL.');
  }

  try {
    const input: Record<string, unknown> = {
      prompt: options.prompt,
      num_frames: options.numFrames || 97,
      frame_rate: options.frameRate || 24,
    };

    if (options.negativePrompt) {
      input.negative_prompt = options.negativePrompt;
    }

    const data = await callFalApi(EXPLICIT_FAL_MODELS.VIDEO_FROM_TEXT, input);

    return {
      success: true,
      video: data.video || { url: data.video_url },
      requestId: data.request_id,
    };
  } catch (error: any) {
    logger.error(`[ExplicitAI] Video from text failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export function getModelCost(model: string): number {
  return EXPLICIT_MODEL_COSTS[model] || 0;
}
