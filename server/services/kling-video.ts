/**
 * 🎬 Kling video — image-to-video (FAL queue API)
 *
 * Models: fal-ai/kling-video/v3/{standard|pro|4k}/image-to-video
 *
 * Standard ~ cheap fast hooks, Pro ~ better detail, 4K ~ hero shots.
 * Always uses queue endpoint (videos take 30-90s to render).
 */
import axios from 'axios';
import { logger } from '../utils/logger';

const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_API_KEY_BACKUP || '';
const QUEUE_BASE = 'https://queue.fal.run';

export type KlingTier = 'standard' | 'pro' | '4k';

const MODEL_BY_TIER: Record<KlingTier, string> = {
  standard: 'fal-ai/kling-video/v3/standard/image-to-video',
  pro: 'fal-ai/kling-video/v3/pro/image-to-video',
  '4k': 'fal-ai/kling-video/v3/4k/image-to-video',
};

export interface KlingSubmitArgs {
  imageUrl: string;
  prompt: string;        // motion description (camera + subject action)
  duration?: 5 | 10;     // seconds (Kling supports 5s or 10s)
  aspectRatio?: '16:9' | '9:16' | '1:1';
  negativePrompt?: string;
  cfgScale?: number;     // 0.1 - 1.0, defaults vary
  tier?: KlingTier;
}

export interface KlingSubmitResponse {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  model: string;
}

export async function submitKlingVideo(args: KlingSubmitArgs): Promise<KlingSubmitResponse> {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY not configured');
  const tier: KlingTier = args.tier || 'standard';
  const model = MODEL_BY_TIER[tier];

  const body: Record<string, any> = {
    prompt: args.prompt,
    image_url: args.imageUrl,
    duration: String(args.duration || 5),
    aspect_ratio: args.aspectRatio || '9:16',
  };
  if (args.negativePrompt) body.negative_prompt = args.negativePrompt;
  if (typeof args.cfgScale === 'number') body.cfg_scale = args.cfgScale;

  logger.info('[Kling] submitting', { tier, model, duration: body.duration, ar: body.aspect_ratio });
  const resp = await axios.post(`${QUEUE_BASE}/${model}`, body, {
    headers: {
      Authorization: `Key ${FAL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 60_000,
  });
  const d = resp.data || {};
  return {
    requestId: d.request_id || d.requestId,
    statusUrl: d.status_url || d.statusUrl,
    responseUrl: d.response_url || d.responseUrl,
    model,
  };
}

export interface KlingStatus {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  queuePosition?: number;
  logs?: any[];
}

export async function getKlingStatus(model: string, requestId: string): Promise<KlingStatus> {
  const url = `${QUEUE_BASE}/${model}/requests/${requestId}/status`;
  const r = await axios.get(url, {
    headers: { Authorization: `Key ${FAL_API_KEY}` },
    timeout: 30_000,
  });
  return {
    status: r.data?.status,
    queuePosition: r.data?.queue_position,
    logs: r.data?.logs,
  };
}

export interface KlingResult {
  videoUrl: string;
  raw: any;
}

export async function getKlingResult(model: string, requestId: string): Promise<KlingResult> {
  const url = `${QUEUE_BASE}/${model}/requests/${requestId}`;
  const r = await axios.get(url, {
    headers: { Authorization: `Key ${FAL_API_KEY}` },
    timeout: 60_000,
  });
  const videoUrl =
    r.data?.video?.url ||
    r.data?.output?.video?.url ||
    r.data?.video_url ||
    '';
  if (!videoUrl) throw new Error('Kling returned no video URL');
  return { videoUrl, raw: r.data };
}

/**
 * Convenience: submit + poll until done, return final video URL.
 * Used by the promo orchestrator (server-side, behind a queued route).
 */
export async function generateKlingVideoBlocking(args: KlingSubmitArgs & {
  pollIntervalMs?: number;
  maxWaitMs?: number;
}): Promise<{ videoUrl: string; requestId: string; model: string }> {
  const submitted = await submitKlingVideo(args);
  const interval = args.pollIntervalMs ?? 5000;
  const maxWait = args.maxWaitMs ?? 8 * 60_000;
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const s = await getKlingStatus(submitted.model, submitted.requestId);
    if (s.status === 'COMPLETED') {
      const result = await getKlingResult(submitted.model, submitted.requestId);
      return {
        videoUrl: result.videoUrl,
        requestId: submitted.requestId,
        model: submitted.model,
      };
    }
    if (s.status === 'FAILED') {
      throw new Error('Kling video generation failed');
    }
  }
  throw new Error('Kling video generation timed out');
}
