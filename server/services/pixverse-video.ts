/**
 * PixVerse Video Generation Service
 * Based on: PixVerseAI/skills (PixVerse CLI skill library)
 *
 * Provides a unified interface to 10+ video generation models via
 * the PixVerse REST API:
 *   - PixVerse V6 / C1
 *   - Sora 2 / Sora 2 Pro
 *   - Veo 3.1 Standard / Fast / Lite
 *   - Grok Imagine
 *   - Seedance 2.0 Standard / Fast
 *   - Kling O3 Pro / Kling 3.0
 *
 * Capabilities:
 *   - Text-to-video (all models)
 *   - Image-to-video (all models)
 *   - Prompt enhancement (V6)
 *   - Video modification (replace subjects, change backgrounds)
 *   - Video extension (add duration)
 *   - Video upscaling (1080p → 4K)
 *
 * Environment: PIXVERSE_API_KEY
 *
 * PixVerse requires a paid subscription at https://app.pixverse.ai
 * All calls are no-ops (return null) if the API key is not set,
 * so the system degrades gracefully to Kling.
 */

import { logger } from '../utils/logger.js';

const PIXVERSE_API_KEY = process.env.PIXVERSE_API_KEY || '';
const PIXVERSE_BASE_URL = 'https://app-api.pixverse.ai/openapi/v2';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type PixVerseModel =
  | 'v6'
  | 'pixverse-c1'
  | 'sora-2'
  | 'sora-2-pro'
  | 'veo-3.1-standard'
  | 'veo-3.1-fast'
  | 'veo-3.1-lite'
  | 'grok-imagine'
  | 'seedance-2.0-standard'
  | 'seedance-2.0-fast'
  | 'kling-o3-pro'
  | 'kling-3.0';

export type PixVerseAspectRatio = '9:16' | '16:9' | '1:1' | '4:3' | '3:4';

export type PixVerseVideoResult = {
  videoUrl: string;
  taskId: string;
  model: PixVerseModel;
  durationSeconds: number;
  costCredits: number;
};

export type PixVerseModifyResult = {
  videoUrl: string;
  taskId: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Credit cost map (PixVerse credits per generation)
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_CREDITS: Record<PixVerseModel, number> = {
  'v6': 60,
  'pixverse-c1': 40,
  'sora-2': 200,
  'sora-2-pro': 320,
  'veo-3.1-standard': 150,
  'veo-3.1-fast': 80,
  'veo-3.1-lite': 50,
  'grok-imagine': 40,
  'seedance-2.0-standard': 60,
  'seedance-2.0-fast': 30,
  'kling-o3-pro': 120,
  'kling-3.0': 80,
};

// ─────────────────────────────────────────────────────────────────────────────
// HTTP helpers
// ─────────────────────────────────────────────────────────────────────────────

function pixverseHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${PIXVERSE_API_KEY}`,
    'Ai-trace-id': `boostify-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  };
}

async function pixversePost(endpoint: string, body: Record<string, unknown>): Promise<any> {
  const url = `${PIXVERSE_BASE_URL}${endpoint}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: pixverseHeaders(),
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`PixVerse API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

async function pixverseGet(endpoint: string): Promise<any> {
  const url = `${PIXVERSE_BASE_URL}${endpoint}`;
  const resp = await fetch(url, {
    method: 'GET',
    headers: pixverseHeaders(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => resp.statusText);
    throw new Error(`PixVerse API error ${resp.status}: ${text}`);
  }
  return resp.json();
}

/**
 * Polls a PixVerse task until it's complete or fails.
 * PixVerse tasks typically complete in 30-120 seconds.
 */
async function pollPixVerseTask(taskId: string, maxWaitMs = 240_000): Promise<string> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 4000;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    const resp = await pixverseGet(`/video/result/${taskId}`);
    const status = resp?.data?.status ?? resp?.status;
    const videoUrl = resp?.data?.video_url ?? resp?.data?.videoUrl ?? resp?.video_url;

    if (status === 'success' || status === 'completed') {
      if (!videoUrl) throw new Error(`PixVerse task ${taskId} completed but no video_url found`);
      return videoUrl;
    }
    if (status === 'failed' || status === 'error') {
      throw new Error(`PixVerse task ${taskId} failed: ${resp?.data?.message || 'unknown error'}`);
    }
    // Still processing — increase polling interval
    delay = Math.min(delay * 1.4, 15000);
  }
  throw new Error(`PixVerse task ${taskId} timed out after ${maxWaitMs / 1000}s`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Prompt Enhancement (V6 recommended)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Enhances a raw video prompt for better PixVerse V6 results.
 * Returns the original prompt if enhancement fails or API key is missing.
 */
export async function enhancePixVersePrompt(
  rawPrompt: string,
  model: PixVerseModel = 'v6',
): Promise<string> {
  if (!PIXVERSE_API_KEY) return rawPrompt;

  try {
    const resp = await pixversePost('/prompt/enhance', {
      prompt: rawPrompt,
      model,
    });
    return resp?.data?.enhanced_prompt ?? resp?.enhanced_prompt ?? rawPrompt;
  } catch (err) {
    logger.warn('[PixVerse] Prompt enhancement failed, using original:', err);
    return rawPrompt;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Text-to-Video
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePixVerseTextToVideo(args: {
  prompt: string;
  model?: PixVerseModel;
  aspectRatio?: PixVerseAspectRatio;
  duration?: 5 | 8 | 10;
  enhancePrompt?: boolean;
}): Promise<PixVerseVideoResult> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const model = args.model ?? 'v6';
  const duration = args.duration ?? 5;
  const aspectRatio = args.aspectRatio ?? '9:16';

  let prompt = args.prompt;
  if (args.enhancePrompt !== false) {
    prompt = await enhancePixVersePrompt(prompt, model);
  }

  logger.info('[PixVerse] Text-to-video', { model, duration, aspectRatio });

  const resp = await pixversePost('/video/text', {
    prompt,
    model,
    aspect_ratio: aspectRatio,
    duration,
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in response: ${JSON.stringify(resp)}`);

  const videoUrl = await pollPixVerseTask(taskId);

  return {
    videoUrl,
    taskId,
    model,
    durationSeconds: duration,
    costCredits: MODEL_CREDITS[model] ?? 60,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Image-to-Video
// ─────────────────────────────────────────────────────────────────────────────

export async function generatePixVerseImageToVideo(args: {
  imageUrl: string;
  prompt?: string;
  model?: PixVerseModel;
  aspectRatio?: PixVerseAspectRatio;
  duration?: 5 | 8 | 10;
  enhancePrompt?: boolean;
}): Promise<PixVerseVideoResult> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const model = args.model ?? 'v6';
  const duration = args.duration ?? 5;
  const aspectRatio = args.aspectRatio ?? '9:16';

  let prompt = args.prompt || 'Cinematic motion, natural movement, photorealistic';
  if (args.enhancePrompt !== false) {
    prompt = await enhancePixVersePrompt(prompt, model);
  }

  logger.info('[PixVerse] Image-to-video', { model, duration, aspectRatio });

  const resp = await pixversePost('/video/img', {
    img_url: args.imageUrl,
    prompt,
    model,
    aspect_ratio: aspectRatio,
    duration,
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in response: ${JSON.stringify(resp)}`);

  const videoUrl = await pollPixVerseTask(taskId);

  return {
    videoUrl,
    taskId,
    model,
    durationSeconds: duration,
    costCredits: MODEL_CREDITS[model] ?? 60,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Modify Video (replace subjects / change backgrounds / swap outfits)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Modifies an existing video via natural language instruction.
 * Examples:
 *   "replace the background with a tropical beach"
 *   "change the outfit to a red dress"
 *   "add fog and dramatic lighting"
 */
export async function modifyPixVerseVideo(args: {
  videoUrl: string;
  instruction: string;
  model?: PixVerseModel;
}): Promise<PixVerseModifyResult> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const model = args.model ?? 'v6';

  logger.info('[PixVerse] Modify video', { instruction: args.instruction.slice(0, 80) });

  const resp = await pixversePost('/video/modify', {
    video_url: args.videoUrl,
    prompt: args.instruction,
    model,
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in modify response`);

  const videoUrl = await pollPixVerseTask(taskId);
  return { videoUrl, taskId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Post-process: Extend duration
// ─────────────────────────────────────────────────────────────────────────────

export async function extendPixVerseVideo(args: {
  videoUrl: string;
  additionalSeconds?: 4 | 8;
}): Promise<PixVerseModifyResult> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  logger.info('[PixVerse] Extend video', { additionalSeconds: args.additionalSeconds ?? 4 });

  const resp = await pixversePost('/video/extend', {
    video_url: args.videoUrl,
    duration: args.additionalSeconds ?? 4,
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in extend response`);

  const videoUrl = await pollPixVerseTask(taskId);
  return { videoUrl, taskId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Post-process: Upscale
// ─────────────────────────────────────────────────────────────────────────────

export async function upscalePixVerseVideo(args: {
  videoUrl: string;
  resolution?: '1080p' | '4K';
}): Promise<PixVerseModifyResult> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const target = args.resolution ?? '1080p';
  logger.info('[PixVerse] Upscale video', { resolution: target });

  const resp = await pixversePost('/video/upscale', {
    video_url: args.videoUrl,
    resolution: target === '4K' ? '3840x2160' : '1920x1080',
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in upscale response`);

  const videoUrl = await pollPixVerseTask(taskId, 300_000); // upscale can take longer
  return { videoUrl, taskId };
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Async task helpers (start + status-check without blocking)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Starts an image-to-video generation and returns the task ID immediately
 * without waiting for completion. Use `checkPixVerseTaskStatus` to poll.
 */
export async function startPixVerseImageToVideo(args: {
  imageUrl: string;
  prompt?: string;
  model?: PixVerseModel;
  aspectRatio?: PixVerseAspectRatio;
  duration?: 5 | 8 | 10;
}): Promise<{ taskId: string; costCredits: number; model: PixVerseModel }> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const model = args.model ?? 'v6';
  const duration = args.duration ?? 5;
  const aspectRatio = args.aspectRatio ?? '9:16';
  const prompt = args.prompt || 'Cinematic motion, natural movement, photorealistic';

  logger.info('[PixVerse] Start image-to-video (async)', { model, duration });

  const resp = await pixversePost('/video/img', {
    img_url: args.imageUrl,
    prompt,
    model,
    aspect_ratio: aspectRatio,
    duration,
  });

  const taskId = resp?.data?.task_id ?? resp?.task_id;
  if (!taskId) throw new Error(`PixVerse: no task_id in response: ${JSON.stringify(resp)}`);

  return { taskId, costCredits: MODEL_CREDITS[model] ?? 60, model };
}

/**
 * Checks the status of a previously started PixVerse task.
 * Returns `status: 'processing'` while still running.
 */
export async function checkPixVerseTaskStatus(taskId: string): Promise<{
  status: 'processing' | 'completed' | 'failed';
  videoUrl?: string;
  error?: string;
}> {
  if (!PIXVERSE_API_KEY) throw new Error('PIXVERSE_API_KEY not configured');

  const resp = await pixverseGet(`/video/result/${taskId}`);
  const status: string = resp?.data?.status ?? resp?.status ?? 'processing';
  const videoUrl: string | undefined = resp?.data?.video_url ?? resp?.data?.videoUrl ?? resp?.video_url;

  if (status === 'success' || status === 'completed') {
    return { status: 'completed', videoUrl };
  }
  if (status === 'failed' || status === 'error') {
    return { status: 'failed', error: resp?.data?.message || 'Task failed' };
  }
  return { status: 'processing' };
}

// 8. Availability check
// ─────────────────────────────────────────────────────────────────────────────

/** Returns true if PixVerse API key is configured and the service is usable */
export function isPixVerseAvailable(): boolean {
  return Boolean(PIXVERSE_API_KEY);
}

/** Returns cost in Boostify credits for a PixVerse model */
export function getPixVerseCost(model: PixVerseModel): number {
  // Boostify credits ≈ PixVerse credits / 10
  return Math.ceil((MODEL_CREDITS[model] ?? 60) / 10);
}
