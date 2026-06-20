/**
 * Influencer Voice Service — Voice cloning & TTS
 *
 * PROVIDERS (in priority order):
 *   1. ElevenLabs  — Instant Voice Cloning from uploaded audio
 *   2. Gemini TTS  — High-quality preset voices (gemini-2.5-flash-preview-tts)
 *   3. FAL / Qwen-3-TTS — Fallback voice clone + TTS
 */

import axios from 'axios';
import FormData from 'form-data';
import { logger } from '../utils/logger';
import { db } from '../../db';
import { influencerVoiceProfiles } from '../../db/schema';
import { eq } from 'drizzle-orm';

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const ELEVENLABS_BASE_URL = 'https://api.elevenlabs.io/v1';
const FAL_API_KEY = process.env.FAL_API_KEY || process.env.FAL_KEY || '';
const FAL_QUEUE_URL = 'https://queue.fal.run';
const GEMINI_API_KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY2 ||
  process.env.AI_INTEGRATIONS_GEMINI_API_KEY ||
  '';
const GEMINI_TTS_MODEL = 'gemini-2.5-flash-preview-tts';
const GEMINI_TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TTS_MODEL}:generateContent`;

/** Available Gemini TTS preset voices */
export const GEMINI_VOICES = [
  { id: 'Aoede',  label: 'Aoede',  description: 'Warm, expressive female' },
  { id: 'Charon', label: 'Charon', description: 'Deep, commanding male' },
  { id: 'Fenrir', label: 'Fenrir', description: 'Powerful, confident male' },
  { id: 'Kore',   label: 'Kore',   description: 'Bright, clear female' },
  { id: 'Puck',   label: 'Puck',   description: 'Energetic, dynamic male' },
  { id: 'Zephyr', label: 'Zephyr', description: 'Airy, neutral, modern' },
  { id: 'Orus',   label: 'Orus',   description: 'Authoritative male' },
  { id: 'Leda',   label: 'Leda',   description: 'Sweet, soft female' },
];

function getElevenLabsHeaders() {
  return {
    'Accept': 'application/json',
    'xi-api-key': ELEVENLABS_API_KEY,
  };
}

function getFalHeaders() {
  return {
    'Authorization': `Key ${FAL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

export interface VoiceCloneResult {
  success: boolean;
  voiceId?: string;
  voiceName?: string;
  previewUrl?: string;
  provider?: 'elevenlabs' | 'fal';
  error?: string;
}

export interface VoiceTTSResult {
  success: boolean;
  audioUrl?: string;
  durationSec?: number;
  error?: string;
}

/**
 * Clone voice from uploaded audio buffer (ElevenLabs Instant Voice Cloning)
 */
export async function cloneInfluencerVoiceFromBuffer(
  userId: number,
  fileBuffer: Buffer,
  fileName: string,
  voiceName: string,
  language: string = 'en'
): Promise<VoiceCloneResult> {
  try {
    logger.info(`[InfluencerVoice] Cloning voice for user ${userId} from upload: "${voiceName}"`);

    let result: VoiceCloneResult;

    if (ELEVENLABS_API_KEY) {
      result = await cloneViaElevenLabs(fileBuffer, fileName, voiceName);
    } else {
      result = { success: false, error: 'No ElevenLabs API key. Set ELEVENLABS_API_KEY in .env' };
    }

    if (result.success && result.voiceId) {
      await saveVoiceProfile(userId, result.voiceId, voiceName, language, result.provider || 'elevenlabs');
      logger.info(`[InfluencerVoice] Voice cloned: ${result.voiceId} via ${result.provider}`);
    }

    return result;
  } catch (error: any) {
    logger.error(`[InfluencerVoice] Clone from buffer error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Clone voice from URL (downloads then sends to ElevenLabs)
 */
export async function cloneInfluencerVoice(
  userId: number,
  audioSampleUrl: string,
  voiceName: string,
  language: string = 'en'
): Promise<VoiceCloneResult> {
  try {
    logger.info(`[InfluencerVoice] Cloning voice for user ${userId} from URL: "${voiceName}"`);

    let result: VoiceCloneResult;

    if (ELEVENLABS_API_KEY) {
      const audioRes = await axios.get(audioSampleUrl, { responseType: 'arraybuffer', timeout: 30000 });
      const buffer = Buffer.from(audioRes.data);
      result = await cloneViaElevenLabs(buffer, 'voice_sample.mp3', voiceName);
    } else if (FAL_API_KEY) {
      result = await cloneViaFal(audioSampleUrl, voiceName);
    } else {
      return { success: false, error: 'No voice cloning API key configured' };
    }

    if (result.success && result.voiceId) {
      await saveVoiceProfile(userId, result.voiceId, voiceName, language, result.provider || 'elevenlabs', audioSampleUrl);
    }

    return result;
  } catch (error: any) {
    logger.error(`[InfluencerVoice] Clone error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Set up a Gemini TTS voice profile (no audio upload needed — uses a preset voice)
 */
export async function setupGeminiVoice(
  userId: number,
  voiceName: string,
  geminiVoiceId: string = 'Aoede',
): Promise<VoiceCloneResult> {
  if (!GEMINI_API_KEY) {
    return { success: false, error: 'GEMINI_API_KEY not configured' };
  }

  const validVoice = GEMINI_VOICES.find(v => v.id === geminiVoiceId);
  if (!validVoice) {
    return { success: false, error: `Unknown Gemini voice: ${geminiVoiceId}` };
  }

  // Store the voice ID prefixed so we know which provider to use for TTS
  const syntheticVoiceId = `gemini:${geminiVoiceId}`;
  await saveVoiceProfile(userId, syntheticVoiceId, voiceName, 'en', 'gemini');

  logger.info(`[InfluencerVoice] Gemini TTS profile saved for user ${userId}: ${geminiVoiceId}`);
  return {
    success: true,
    voiceId: syntheticVoiceId,
    voiceName,
    provider: 'gemini' as any,
  };
}

/**
 * Generate speech using Gemini TTS (preset voices, no cloning required)
 */
async function ttsViaGemini(text: string, geminiVoiceId: string): Promise<VoiceTTSResult> {
  try {
    const response = await axios.post(
      `${GEMINI_TTS_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: geminiVoiceId },
            },
          },
        },
      },
      { timeout: 60000 },
    );

    // Gemini returns base64-encoded PCM audio
    const audioPart = response.data?.candidates?.[0]?.content?.parts?.[0];
    if (!audioPart?.inlineData?.data) {
      return { success: false, error: 'No audio data in Gemini TTS response' };
    }

    const mimeType = audioPart.inlineData.mimeType || 'audio/wav';
    const audioUrl = `data:${mimeType};base64,${audioPart.inlineData.data}`;
    return { success: true, audioUrl };
  } catch (error: any) {
    const msg = error.response?.data?.error?.message || error.message;
    logger.error(`[InfluencerVoice] Gemini TTS error: ${msg}`);
    return { success: false, error: `Gemini TTS: ${msg}` };
  }
}

/**
 * Generate speech using cloned voice
 */
export async function generateInfluencerSpeech(
  userId: number,
  scriptText: string,
  options: { speed?: number; language?: string } = {}
): Promise<VoiceTTSResult> {
  try {
    const [voiceProfile] = await db.select()
      .from(influencerVoiceProfiles)
      .where(eq(influencerVoiceProfiles.userId, userId))
      .limit(1);

    if (!voiceProfile) {
      return { success: false, error: 'No voice profile found. Clone voice first.' };
    }

    logger.info(`[InfluencerVoice] TTS for user ${userId}, voice: ${voiceProfile.voiceName}`);

    const voiceId = voiceProfile.elevenLabsVoiceId;

    // Gemini TTS (no cloning needed — preset voice)
    if (voiceId.startsWith('gemini:')) {
      const geminiVoiceId = voiceId.replace('gemini:', '');
      return await ttsViaGemini(scriptText, geminiVoiceId);
    }

    // ElevenLabs TTS (real cloned voice)
    const isElevenLabsVoice = ELEVENLABS_API_KEY && !voiceId.startsWith('http');

    if (isElevenLabsVoice) {
      return await ttsViaElevenLabs(scriptText, voiceId, options.speed);
    } else if (FAL_API_KEY) {
      return await ttsViaFal(scriptText, voiceId, options.language || voiceProfile.language || 'en');
    }

    return { success: false, error: 'No TTS provider available' };
  } catch (error: any) {
    logger.error(`[InfluencerVoice] TTS error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

export async function getVoiceProfile(userId: number) {
  const [profile] = await db.select()
    .from(influencerVoiceProfiles)
    .where(eq(influencerVoiceProfiles.userId, userId))
    .limit(1);
  return profile || null;
}

export async function deleteVoiceProfile(userId: number) {
  const [profile] = await db.select()
    .from(influencerVoiceProfiles)
    .where(eq(influencerVoiceProfiles.userId, userId))
    .limit(1);

  if (profile && ELEVENLABS_API_KEY && profile.elevenLabsVoiceId && !profile.elevenLabsVoiceId.startsWith('http')) {
    try {
      await axios.delete(`${ELEVENLABS_BASE_URL}/voices/${profile.elevenLabsVoiceId}`, {
        headers: getElevenLabsHeaders(),
      });
    } catch (e) {
      logger.warn(`[InfluencerVoice] Could not delete from ElevenLabs: ${(e as any).message}`);
    }
  }

  await db.delete(influencerVoiceProfiles).where(eq(influencerVoiceProfiles.userId, userId));
  return { success: true };
}

export async function listElevenLabsVoices() {
  if (!ELEVENLABS_API_KEY) return [];
  try {
    const res = await axios.get(`${ELEVENLABS_BASE_URL}/voices`, { headers: getElevenLabsHeaders() });
    return (res.data?.voices || []).map((v: any) => ({
      voiceId: v.voice_id, name: v.name, category: v.category,
      previewUrl: v.preview_url, labels: v.labels,
    }));
  } catch (e) {
    return [];
  }
}

// -- ElevenLabs Internal --

async function cloneViaElevenLabs(audioBuffer: Buffer, fileName: string, voiceName: string): Promise<VoiceCloneResult> {
  try {
    const form = new FormData();
    form.append('name', voiceName);
    form.append('files', audioBuffer, { filename: fileName, contentType: 'audio/mpeg' });
    form.append('description', `Influencer voice: ${voiceName}`);

    const response = await axios.post(`${ELEVENLABS_BASE_URL}/voices/add`, form, {
      headers: { ...form.getHeaders(), 'xi-api-key': ELEVENLABS_API_KEY },
      timeout: 120000,
    });

    const voiceId = response.data?.voice_id;
    if (!voiceId) return { success: false, error: 'No voice_id in ElevenLabs response' };

    let previewUrl: string | undefined;
    try {
      const detail = await axios.get(`${ELEVENLABS_BASE_URL}/voices/${voiceId}`, { headers: getElevenLabsHeaders() });
      previewUrl = detail.data?.preview_url;
    } catch (_) {}

    return { success: true, voiceId, voiceName, previewUrl, provider: 'elevenlabs' };
  } catch (error: any) {
    const msg = error.response?.data?.detail?.message || error.response?.data?.detail || error.message;
    logger.error(`[InfluencerVoice] ElevenLabs clone error: ${msg}`);
    return { success: false, error: `ElevenLabs: ${msg}` };
  }
}

async function ttsViaElevenLabs(text: string, voiceId: string, speed?: number): Promise<VoiceTTSResult> {
  try {
    const response = await axios.post(
      `${ELEVENLABS_BASE_URL}/text-to-speech/${voiceId}`,
      {
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
      },
      { headers: { ...getElevenLabsHeaders(), 'Content-Type': 'application/json' }, responseType: 'arraybuffer', timeout: 60000 }
    );

    const audioBase64 = Buffer.from(response.data).toString('base64');
    return { success: true, audioUrl: `data:audio/mpeg;base64,${audioBase64}` };
  } catch (error: any) {
    const msg = error.response?.data ? Buffer.from(error.response.data).toString() : error.message;
    return { success: false, error: `ElevenLabs TTS: ${msg}` };
  }
}

// -- FAL fallback --

async function cloneViaFal(audioUrl: string, voiceName: string): Promise<VoiceCloneResult> {
  try {
    const submitRes = await axios.post(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/clone-voice/1.7b`, { audio_url: audioUrl }, { headers: getFalHeaders() });
    const requestId = submitRes.data.request_id;
    if (!requestId) return { success: false, error: 'No request_id from FAL' };

    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await axios.get(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/clone-voice/1.7b/requests/${requestId}/status`, { headers: getFalHeaders() });
      if (s.data.status === 'COMPLETED') {
        const r = await axios.get(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/clone-voice/1.7b/requests/${requestId}`, { headers: getFalHeaders() });
        const emb = r.data?.speaker_embedding?.url || r.data?.audio?.url;
        if (emb) return { success: true, voiceId: emb, voiceName, previewUrl: emb, provider: 'fal' };
        return { success: false, error: 'No speaker embedding in FAL response' };
      }
      if (s.data.status === 'FAILED') return { success: false, error: `FAL clone failed` };
    }
    return { success: false, error: 'FAL clone timed out' };
  } catch (error: any) { return { success: false, error: error.message }; }
}

async function ttsViaFal(text: string, speakerUrl: string, language: string): Promise<VoiceTTSResult> {
  try {
    const submitRes = await axios.post(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/text-to-speech/1.7b`,
      { text, speaker_embedding_url: speakerUrl, language: language || 'auto', temperature: 0.3 },
      { headers: getFalHeaders() });
    const requestId = submitRes.data.request_id;
    if (!requestId) return { success: false, error: 'No request_id from FAL TTS' };

    for (let i = 0; i < 90; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const s = await axios.get(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/text-to-speech/1.7b/requests/${requestId}/status`, { headers: getFalHeaders() });
      if (s.data.status === 'COMPLETED') {
        const r = await axios.get(`${FAL_QUEUE_URL}/fal-ai/qwen-3-tts/text-to-speech/1.7b/requests/${requestId}`, { headers: getFalHeaders() });
        const audioUrl = r.data?.audio?.url;
        if (audioUrl) return { success: true, audioUrl, durationSec: r.data?.audio?.duration };
        return { success: false, error: 'No audio in FAL TTS response' };
      }
      if (s.data.status === 'FAILED') return { success: false, error: 'FAL TTS failed' };
    }
    return { success: false, error: 'FAL TTS timed out' };
  } catch (error: any) { return { success: false, error: error.message }; }
}

// -- DB helper --

async function saveVoiceProfile(userId: number, voiceId: string, voiceName: string, language: string, provider: string, sampleUrl?: string) {
  const existing = await db.select().from(influencerVoiceProfiles).where(eq(influencerVoiceProfiles.userId, userId)).limit(1);
  if (existing.length > 0) {
    await db.update(influencerVoiceProfiles)
      .set({ elevenLabsVoiceId: voiceId, voiceName, voiceSampleUrl: sampleUrl || null, language, updatedAt: new Date() })
      .where(eq(influencerVoiceProfiles.userId, userId));
  } else {
    await db.insert(influencerVoiceProfiles).values({ userId, elevenLabsVoiceId: voiceId, voiceName, voiceSampleUrl: sampleUrl || null, language });
  }
}
