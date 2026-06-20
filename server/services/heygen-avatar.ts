/**
 * 🗣️ HeyGen Avatar 4 (talking-head spoken promo) via FAL
 *
 * Model: fal-ai/heygen/avatar4/image-to-video
 *
 * Pipeline:
 *   - Input: an image of the artist + an audio URL OR a script + voice id
 *   - Output: video of the artist speaking the script in their voice
 */
import axios from 'axios';
import { logger } from '../utils/logger';

const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_API_KEY_BACKUP || '';
const QUEUE_BASE = 'https://queue.fal.run';
const MODEL = 'fal-ai/heygen/avatar4/image-to-video';

export interface HeygenSubmitArgs {
  imageUrl: string;
  audioUrl?: string;     // pre-rendered TTS audio (preferred)
  script?: string;       // alternative: text + voice id (FAL handles TTS)
  voiceId?: string;      // HeyGen voice id when using script
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

export interface HeygenSubmitResponse {
  requestId: string;
  statusUrl: string;
  responseUrl: string;
  model: string;
}

export async function submitHeygenAvatar(args: HeygenSubmitArgs): Promise<HeygenSubmitResponse> {
  if (!FAL_API_KEY) throw new Error('FAL_API_KEY not configured');
  if (!args.audioUrl && !(args.script && args.voiceId)) {
    throw new Error('HeyGen requires either audioUrl or (script + voiceId)');
  }

  const body: Record<string, any> = {
    image_url: args.imageUrl,
    aspect_ratio: args.aspectRatio || '9:16',
  };
  if (args.audioUrl) {
    body.audio_url = args.audioUrl;
  } else {
    body.input_text = args.script;
    body.voice_id = args.voiceId;
  }

  logger.info('[HeyGen] submitting', { mode: args.audioUrl ? 'audio' : 'tts' });
  const resp = await axios.post(`${QUEUE_BASE}/${MODEL}`, body, {
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
    model: MODEL,
  };
}

export async function getHeygenStatus(requestId: string) {
  const url = `${QUEUE_BASE}/${MODEL}/requests/${requestId}/status`;
  const r = await axios.get(url, {
    headers: { Authorization: `Key ${FAL_API_KEY}` },
    timeout: 30_000,
  });
  return {
    status: r.data?.status as 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED',
    queuePosition: r.data?.queue_position,
    logs: r.data?.logs,
  };
}

export async function getHeygenResult(requestId: string) {
  const url = `${QUEUE_BASE}/${MODEL}/requests/${requestId}`;
  const r = await axios.get(url, {
    headers: { Authorization: `Key ${FAL_API_KEY}` },
    timeout: 60_000,
  });
  const videoUrl =
    r.data?.video?.url ||
    r.data?.output?.video?.url ||
    r.data?.video_url ||
    '';
  if (!videoUrl) throw new Error('HeyGen returned no video URL');
  return { videoUrl, raw: r.data };
}

export async function generateHeygenBlocking(
  args: HeygenSubmitArgs & { pollIntervalMs?: number; maxWaitMs?: number },
): Promise<{ videoUrl: string; requestId: string; model: string }> {
  const submitted = await submitHeygenAvatar(args);
  const interval = args.pollIntervalMs ?? 5000;
  const maxWait = args.maxWaitMs ?? 10 * 60_000;
  const deadline = Date.now() + maxWait;

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    const s = await getHeygenStatus(submitted.requestId);
    if (s.status === 'COMPLETED') {
      const result = await getHeygenResult(submitted.requestId);
      return {
        videoUrl: result.videoUrl,
        requestId: submitted.requestId,
        model: MODEL,
      };
    }
    if (s.status === 'FAILED') {
      throw new Error('HeyGen avatar generation failed');
    }
  }
  throw new Error('HeyGen avatar generation timed out');
}
