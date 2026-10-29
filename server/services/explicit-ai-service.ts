/** AI image and video generation for the Exclusive Content creator studio. */
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../utils/logger';
import { storage as firebaseStorage } from '../firebase';

const FAL_API_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || process.env.FAL_KEY_BACKUP || '';
const FAL_BASE_URL = 'https://fal.run';

export const EXPLICIT_FAL_MODELS = {
  IMAGE_NANO_BANANA_21: 'google/nano-banana-2.1',
  IMAGE_NANO_BANANA_PRO: 'fal-ai/nano-banana-pro',
  IMAGE_GPT_IMAGE_25: 'openai/gpt-image-2.5/flare/text-to-image',
  VIDEO_FROM_IMAGE: 'fal-ai/ltx-2-19b/image-to-video',
  VIDEO_FROM_TEXT: 'fal-ai/ltx-2.3/text-to-video',
} as const;

export const EXPLICIT_IMAGE_MODELS = [
  EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_21,
  EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_PRO,
  EXPLICIT_FAL_MODELS.IMAGE_GPT_IMAGE_2,
] as const;

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
  // Costs reflect the selected 2K generation setting. GPT Image 2.5 varies by usage.
  [EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_21]: 0.12,
  [EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_PRO]: 0.15,
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
  /** Reference photo of the artist for likeness consistency. */
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
  images?: Array<{ url: string; storagePath?: string; content_type?: string }>;
  video?: { url: string };
  error?: string;
  requestId?: string;
  model?: string;
}

async function callFalApi(modelPath: string, input: Record<string, unknown>): Promise<any> {
  if (!FAL_API_KEY) {
    throw new Error('FAL_API_KEY not configured');
  }

  const url = `${FAL_BASE_URL}/${modelPath}`;
  logger.info(`[ExplicitAI] Calling FAL model: ${modelPath}`);

  const response = await axios.post(url, input, {
    headers: {
      'Authorization': `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000,
  });

  return response.data;
}

// Image persistence and generation helpers
async function persistImageToFirebase(srcUrl: string, artistId?: number): Promise<{ url: string; storagePath?: string }> {
  if (!firebaseStorage) throw new Error('Private creator media storage is not configured.');

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
    metadata: { cacheControl: 'private, max-age=900, no-transform' },
  });
  const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 15 * 60 * 1000 });
  return { url, storagePath: `private://${objectPath}` };
}

async function finalizeImages(urls: string[], artistId: number | undefined, requestId: string): Promise<FalGenerationResult> {
  const images: Array<{ url: string; storagePath?: string }> = [];
  for (const u of urls) {
    try {
      images.push(await persistImageToFirebase(u, artistId));
    } catch (e: any) {
      logger.warn(`[ExclusiveContentAI] private storage persistence failed: ${e?.message}`);
      throw e;
    }
  }
  return { success: true, images, requestId };
}

function falImageEndpoint(model: string, withReference: boolean): string {
  const endpointByModel: Record<string, { text: string; edit: string }> = {
    [EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_21]: {
      text: 'google/nano-banana-2.1',
      edit: 'google/nano-banana-2.1/edit',
    },
    [EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_PRO]: {
      text: 'fal-ai/nano-banana-pro',
      edit: 'fal-ai/nano-banana-pro/edit',
    },
    [EXPLICIT_FAL_MODELS.IMAGE_GPT_IMAGE_25]: {
      text: 'openai/gpt-image-2.5/flare/text-to-image',
      edit: 'openai/gpt-image-2.5/flare/edit',
    },
  };
  const endpoints = endpointByModel[model];
  if (!endpoints) throw new Error('Unsupported image model. Choose one of the available creator studio models.');
  return withReference ? endpoints.edit : endpoints.text;
}

function falAspectRatio(imageSize?: string): string {
  switch (imageSize) {
    case 'portrait_4_3': return '3:4';
    case 'portrait_16_9': return '9:16';
    case 'landscape_4_3': return '4:3';
    case 'landscape_16_9': return '16:9';
    default: return '1:1';
  }
}

async function generateWithFalImageModel(model: string, options: ExplicitImageOptions): Promise<string[]> {
  const withReference = Boolean(options.referenceImageUrl);
  const endpoint = falImageEndpoint(model, withReference);
  const input: Record<string, unknown> = {
    prompt: options.prompt,
    num_images: Math.max(1, Math.min(Number(options.numImages) || 1, 4)),
    output_format: 'png',
    aspect_ratio: falAspectRatio(options.imageSize),
  };

  if (withReference) input.image_urls = [options.referenceImageUrl];
  if (model === EXPLICIT_FAL_MODELS.IMAGE_GPT_IMAGE_25) {
    input.image_size = options.imageSize && /^\d+x\d+$/.test(options.imageSize) ? options.imageSize : 'portrait_4_3';
    input.quality = 'high';
    input.enable_safety_checker = true;
    delete input.aspect_ratio;
  } else {
    input.resolution = '2K';
    // Keep Fal's moderation enabled at its documented default.
    input.safety_tolerance = '4';
  }

  const data = await callFalApi(endpoint, input);
  const images = Array.isArray(data?.images)
    ? data.images.map((image: any) => typeof image === 'string' ? image : image?.url).filter((url: unknown): url is string => typeof url === 'string' && url.length > 0)
    : [];
  if (!images.length) throw new Error(`${model} returned no images`);
  return images;
}

export async function generateExplicitImage(options: ExplicitImageOptions): Promise<FalGenerationResult> {
  const selectedModel = options.model || EXPLICIT_FAL_MODELS.IMAGE_NANO_BANANA_21;
  if (!(EXPLICIT_IMAGE_MODELS as readonly string[]).includes(selectedModel)) {
    return { success: false, error: 'Unsupported image model. Refresh the page and choose an available model.' };
  }

  const fallbacks = [selectedModel, ...EXPLICIT_IMAGE_MODELS.filter((model) => model !== selectedModel)];
  const errors: string[] = [];
  for (const model of fallbacks) {
    let urls: string[];
    try {
      logger.info(`[ExclusiveContentAI] Trying fal image model ${model}`);
      urls = await generateWithFalImageModel(model, options);
    } catch (error: any) {
      const message = error?.response?.data?.detail || error?.message || String(error);
      logger.warn(`[ExclusiveContentAI] fal image model ${model} failed: ${message}`);
      errors.push(`${model}: ${message}`);
      continue;
    }
    try {
      const result = await finalizeImages(urls, options.artistId, `${model}-${Date.now()}`);
      return { ...result, model };
    } catch (error: any) {
      return { success: false, error: `The image was generated but could not be saved privately: ${error?.message || error}` };
    }
  }
  return { success: false, error: errors.join(' | ') || 'Image generation failed across available fal models.' };
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

export function getModelCost(model: string, quantity = 1): number | null {
  const unitCost = EXPLICIT_MODEL_COSTS[model];
  return unitCost == null ? null : unitCost * Math.max(1, Math.min(Math.floor(quantity) || 1, 4));
}
