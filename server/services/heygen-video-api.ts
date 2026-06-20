/**
 * HeyGen Video API Service
 *
 * Wraps the HeyGen v2 REST API for:
 * - Listing avatars and voices
 * - Creating talking-head video generation jobs
 * - Polling video status
 * - Handling webhook callbacks
 *
 * HeyGen API docs: https://docs.heygen.com/reference/generate-a-video
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const HEYGEN_BASE = 'https://api.heygen.com';
const HEYGEN_API_KEY = () => process.env.HEYGEN_API_KEY || '';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender?: string;
  preview_image_url?: string;
  preview_video_url?: string;
}

export interface HeyGenVoice {
  voice_id: string;
  language: string;
  gender?: string;
  name: string;
  preview_audio?: string;
  emotion_support?: boolean;
}

export interface HeyGenVideoGeneratePayload {
  avatar_id: string;
  voice_id: string;
  script: string;
  background?: {
    type: 'color' | 'image' | 'video';
    value: string;
  };
  dimension?: {
    width: number;
    height: number;
  };
  caption?: boolean;
  talking_style?: 'stable' | 'expressive' | 'friendly';
  webhook_url?: string;
  title?: string;
}

export interface HeyGenVideoStatus {
  video_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

// ─── Avatar & Voice catalog ───────────────────────────────────────────────────

export async function listHeyGenAvatars(): Promise<HeyGenAvatar[]> {
  const key = HEYGEN_API_KEY();
  if (!key) return getMockAvatars();

  try {
    const res = await axios.get<{
      data: {
        avatars?: Array<{ avatar_id: string; avatar_name: string; gender?: string; preview_image_url?: string; preview_video_url?: string }>;
        talking_photos?: Array<{ talking_photo_id: string; talking_photo_name: string; preview_image_url?: string }>;
      };
    }>(
      `${HEYGEN_BASE}/v2/avatars`,
      { headers: { 'X-Api-Key': key }, timeout: 15000 }
    );
    const data = res.data?.data;
    // Map talking_photos (the real API format) to our HeyGenAvatar interface
    if (data?.talking_photos?.length) {
      return data.talking_photos.map(tp => ({
        avatar_id: tp.talking_photo_id,
        avatar_name: tp.talking_photo_name,
        preview_image_url: tp.preview_image_url,
      }));
    }
    // Fallback: older API format uses avatars[]
    return data?.avatars ?? [];
  } catch (err: any) {
    logger.warn(`[HeyGen] Failed to fetch avatars: ${err.message}`);
    return getMockAvatars();
  }
}

export async function listHeyGenVoices(language?: string): Promise<HeyGenVoice[]> {
  const key = HEYGEN_API_KEY();
  if (!key) return getMockVoices();

  try {
    const url = language
      ? `${HEYGEN_BASE}/v2/voices?language=${encodeURIComponent(language)}`
      : `${HEYGEN_BASE}/v2/voices`;
    const res = await axios.get<{ data: { voices: HeyGenVoice[] } }>(
      url,
      { headers: { 'X-Api-Key': key }, timeout: 15000 }
    );
    return res.data?.data?.voices ?? [];
  } catch (err: any) {
    logger.warn(`[HeyGen] Failed to fetch voices: ${err.message}`);
    return getMockVoices();
  }
}

// ─── Video generation ────────────────────────────────────────────────────────

export async function generateHeyGenVideo(payload: HeyGenVideoGeneratePayload): Promise<string> {
  const key = HEYGEN_API_KEY();
  if (!key) {
    throw new Error('HEYGEN_API_KEY is not configured');
  }

  const body = {
    video_inputs: [
      {
        character: {
          type: 'avatar',
          avatar_id: payload.avatar_id,
          avatar_style: 'normal',
        },
        voice: {
          type: 'text',
          input_text: payload.script,
          voice_id: payload.voice_id,
          speed: 1.0,
        },
        background: payload.background ?? { type: 'color', value: '#000000' },
      },
    ],
    dimension: payload.dimension ?? { width: 1080, height: 1920 },
    caption: payload.caption ?? false,
    title: payload.title ?? 'Boostify AI Video',
    callback_id: payload.webhook_url
      ? `boostify_${Date.now()}`
      : undefined,
  };

  try {
    logger.info(`[HeyGen] Creating video for avatar ${payload.avatar_id}`);
    const res = await axios.post<{ data: { video_id: string } }>(
      `${HEYGEN_BASE}/v2/video/generate`,
      body,
      {
        headers: {
          'X-Api-Key': key,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const videoId = res.data?.data?.video_id;
    if (!videoId) throw new Error('HeyGen did not return a video_id');

    logger.info(`[HeyGen] Video queued: ${videoId}`);
    return videoId;
  } catch (err: any) {
    const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`HeyGen video generation failed: ${detail}`);
  }
}

// ─── Status polling ───────────────────────────────────────────────────────────

export async function getHeyGenVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
  const key = HEYGEN_API_KEY();
  if (!key) {
    throw new Error('HEYGEN_API_KEY is not configured');
  }

  try {
    const res = await axios.get<{
      data: {
        video_id: string;
        status: 'pending' | 'processing' | 'completed' | 'failed';
        video_url?: string;
        thumbnail_url?: string;
        duration?: number;
        error?: { code: string; message: string };
      };
    }>(
      `${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`,
      {
        headers: { 'X-Api-Key': key },
        timeout: 15000,
      }
    );

    const d = res.data?.data;
    return {
      video_id: d.video_id,
      status: d.status,
      video_url: d.video_url,
      thumbnail_url: d.thumbnail_url,
      duration: d.duration,
      error: d.error?.message,
    };
  } catch (err: any) {
    throw new Error(`HeyGen status check failed: ${err.message}`);
  }
}

// ─── Poll until completion (with timeout) ────────────────────────────────────

export async function pollHeyGenVideoUntilDone(
  videoId: string,
  maxWaitMs = 600000,    // 10 min max
  pollIntervalMs = 5000, // poll every 5s
): Promise<HeyGenVideoStatus> {
  const deadline = Date.now() + maxWaitMs;

  while (Date.now() < deadline) {
    const status = await getHeyGenVideoStatus(videoId);
    logger.info(`[HeyGen] Poll ${videoId}: ${status.status}`);

    if (status.status === 'completed') return status;
    if (status.status === 'failed') throw new Error(`HeyGen video ${videoId} failed: ${status.error}`);

    await new Promise(r => setTimeout(r, pollIntervalMs));
  }

  throw new Error(`HeyGen video ${videoId} timed out after ${maxWaitMs / 1000}s`);
}

// ─── Build avatar dimension from format ──────────────────────────────────────

export function heygenDimensionFromFormat(format: '9:16' | '16:9' | '1:1') {
  const map = {
    '9:16': { width: 1080, height: 1920 },
    '16:9': { width: 1920, height: 1080 },
    '1:1':  { width: 1080, height: 1080 },
  };
  return map[format] ?? map['9:16'];
}

// ─── Mock data (no API key) ───────────────────────────────────────────────────

function getMockAvatars(): HeyGenAvatar[] {
  return [
    { avatar_id: 'mock_avatar_male_1', avatar_name: 'Alex (Male)', gender: 'male', preview_image_url: '' },
    { avatar_id: 'mock_avatar_female_1', avatar_name: 'Sofia (Female)', gender: 'female', preview_image_url: '' },
    { avatar_id: 'mock_avatar_male_2', avatar_name: 'Marcus (Male)', gender: 'male', preview_image_url: '' },
    { avatar_id: 'mock_avatar_female_2', avatar_name: 'Luna (Female)', gender: 'female', preview_image_url: '' },
    { avatar_id: 'mock_avatar_neutral_1', avatar_name: 'Artist Avatar', gender: 'neutral', preview_image_url: '' },
  ];
}

function getMockVoices(): HeyGenVoice[] {
  return [
    { voice_id: 'mock_voice_en_1', language: 'en', gender: 'male', name: 'Deep Baritone EN' },
    { voice_id: 'mock_voice_en_2', language: 'en', gender: 'female', name: 'Warm Alto EN' },
    { voice_id: 'mock_voice_es_1', language: 'es', gender: 'male', name: 'Voz Masculina ES' },
    { voice_id: 'mock_voice_es_2', language: 'es', gender: 'female', name: 'Voz Femenina ES' },
    { voice_id: 'mock_voice_pt_1', language: 'pt', gender: 'male', name: 'Voz Masculina PT' },
  ];
}
