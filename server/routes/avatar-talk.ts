/**
 * Avatar Talk — ElevenLabs voice + Flux Kontext avatar + Avatar4 image-to-video
 *
 * Transforms an artist photo into a generated talking-head video. The default
 * flow uses the selected Talk To Me ElevenLabs voice as audio_url and a Flux
 * Kontext avatar image, then animates it with fal-ai/heygen/avatar4.
 *
 * Endpoints:
 *   POST /api/avatar-talk/:artistId/generate   — generate a new video
 *   GET  /api/avatar-talk/:artistId/videos     — list saved videos
 *   DELETE /api/avatar-talk/:artistId/videos/:videoId — delete a video
 */

import { Router, Request, Response } from 'express';
import axios from 'axios';
import { fal } from '@fal-ai/client';
import { neon } from '@neondatabase/serverless';
import { db } from '../db';
import { artistAvatarVideos } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { generateKontextImage } from '../services/flux-kontext-generator';
import type { PromoStyle } from '../services/promo-style-presets';

const sql = neon(process.env.DATABASE_URL!);
const PLATFORM_FAL_KEY = process.env.FAL_KEY || process.env.FAL_AI_KEY || process.env.FAL_API_KEY || '';
const PLATFORM_EL_API_KEY = process.env.ELEVENLABS_API_KEY || '';
const EL_BASE = 'https://api.elevenlabs.io/v1';

if (PLATFORM_FAL_KEY) {
  fal.config({ credentials: PLATFORM_FAL_KEY });
}

const router = Router();

const DEFAULT_TTM_VOICES = {
  male:        process.env.ELEVENLABS_DEFAULT_MALE_VOICE_ID || 'MyPsCU77MauIyEn2QAFP',
  female:      process.env.ELEVENLABS_DEFAULT_FEMALE_VOICE_ID || 'EXAVITQu4vr4xnSDxMaL',
  unspecified: process.env.ELEVENLABS_DEFAULT_MALE_VOICE_ID || 'MyPsCU77MauIyEn2QAFP',
};

// ─── Scene background presets ─────────────────────────────────────────────────
const SCENE_BACKGROUNDS: Record<string, { type: 'color' | 'image' | 'video'; value: string }> = {
  studio:    { type: 'color', value: '#0d1117' },   // dark studio night
  home:      { type: 'color', value: '#1c1008' },   // warm home light
  backstage: { type: 'color', value: '#080808' },   // pure black backstage
  live:      { type: 'color', value: '#12062b' },   // deep purple live stage
};

const SCENE_FLUX_STYLE: Record<string, PromoStyle> = {
  studio:    'editorial_photography',
  home:      'golden_hour',
  backstage: 'cinematic',
  live:      'neon_cyberpunk',
};

function uniqueStrings(values: Array<string | number | null | undefined>) {
  return [...new Set(values.map(v => String(v || '').trim()).filter(Boolean))];
}

async function resolveFalKey(artistId: string): Promise<string> {
  let key = PLATFORM_FAL_KEY;
  try {
    const rows = await sql`SELECT fal_key FROM artist_avatar_talk_config WHERE artist_id = ${artistId} LIMIT 1`;
    if (rows[0]?.fal_key) key = rows[0].fal_key;
  } catch { /* use platform key */ }
  return key;
}

async function fetchArtistIdentity(artistId: string): Promise<any | null> {
  try {
    const numeric = /^\d+$/.test(artistId);
    if (numeric) {
      const rows = await sql`
        SELECT id, artist_name, biography, genre, genres, location, profile_image, slug, firestore_id
        FROM users WHERE id = ${Number(artistId)} LIMIT 1
      `;
      if (rows[0]) return rows[0];
    }
    const rows = await sql`
      SELECT id, artist_name, biography, genre, genres, location, profile_image, slug, firestore_id
      FROM users
      WHERE slug = ${artistId} OR firestore_id = ${artistId}
      LIMIT 1
    `;
    return rows[0] ?? null;
  } catch (error) {
    console.warn('[AvatarTalk] artist identity lookup skipped:', (error as any)?.message);
    return null;
  }
}

async function fetchTalkToMeConfig(artistId: string, artist: any | null): Promise<any | null> {
  const lookupIds = uniqueStrings([artistId, artist?.id, artist?.slug, artist?.firestore_id]);
  for (const lookupId of lookupIds) {
    try {
      const rows = await sql`SELECT * FROM artist_talk_to_me_config WHERE artist_id = ${lookupId} LIMIT 1`;
      if (rows[0]) return rows[0];
    } catch { /* table may not exist */ }
  }
  return null;
}

async function resolveTalkToMeVoice(artistId: string, artist: any | null) {
  const config = await fetchTalkToMeConfig(artistId, artist);
  const gender = (config?.gender || 'unspecified') as keyof typeof DEFAULT_TTM_VOICES;
  const voiceId = config?.cloned_voice_id
    || config?.voice_id
    || DEFAULT_TTM_VOICES[gender]
    || DEFAULT_TTM_VOICES.unspecified;
  const apiKey = (config?.elevenlabs_api_key && String(config.elevenlabs_api_key).trim())
    ? String(config.elevenlabs_api_key).trim()
    : PLATFORM_EL_API_KEY;

  if (!apiKey) {
    throw new Error('ElevenLabs API key not configured. Save one in Talk To Me settings or set ELEVENLABS_API_KEY.');
  }
  if (!voiceId) {
    throw new Error('No Talk To Me voice configured. Select or clone a voice in Talk To Me first.');
  }

  const voiceLabel = config?.voice_name
    || (config?.cloned_voice_id ? 'Talk To Me cloned voice' : config?.voice_id ? 'Talk To Me selected voice' : 'Talk To Me default voice');
  return { apiKey, voiceId: String(voiceId), voiceLabel, source: config ? 'talk-to-me' : 'talk-to-me-default' };
}

async function generateElevenLabsSpeech(params: {
  apiKey: string;
  voiceId: string;
  text: string;
  talkingStyle: string;
}): Promise<Buffer> {
  const expressive = params.talkingStyle === 'expressive';
  const response = await axios.post(
    `${EL_BASE}/text-to-speech/${encodeURIComponent(params.voiceId)}?output_format=mp3_44100_128`,
    {
      text: params.text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability:         expressive ? 0.34 : 0.48,
        similarity_boost:  0.86,
        style:             expressive ? 0.58 : 0.28,
        use_speaker_boost: true,
      },
    },
    {
      headers: {
        'xi-api-key': params.apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      responseType: 'arraybuffer',
      timeout: 60000,
    },
  );
  return Buffer.from(response.data);
}

async function uploadAudioToFalStorage(audio: Buffer, falKey: string): Promise<string> {
  fal.config({ credentials: falKey });
  const bytes = new Uint8Array(audio.buffer.slice(audio.byteOffset, audio.byteOffset + audio.byteLength));
  const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
  return fal.storage.upload(audioBlob as any);
}

function buildFluxAvatarPrompt(params: {
  artistName: string;
  scene: string;
  prompt: string;
}) {
  const scenePrompt = params.scene === 'home'
    ? 'warm home studio, intimate creator update, natural seated portrait'
    : params.scene === 'backstage'
    ? 'backstage music venue, dramatic low light, pre-show energy'
    : params.scene === 'live'
    ? 'live stage portrait, concert lighting, confident performance energy'
    : 'professional recording studio, clean talking-head portrait, premium artist interview look';

  return `${params.artistName}, realistic talking-head avatar portrait, facing camera, clear face, shoulders visible, natural mouth shape, expressive eyes, ${scenePrompt}. Preserve the exact identity from the reference image. The artist is about to say: ${params.prompt.slice(0, 240)}`;
}

async function generateFluxAvatarImage(params: {
  artistName: string;
  sourceImageUrl: string;
  prompt: string;
  scene: string;
  aspectRatio: '9:16' | '16:9' | '1:1';
  falKey: string;
}) {
  const style = SCENE_FLUX_STYLE[params.scene] || 'cinematic';
  const result = await generateKontextImage({
    basePrompt: buildFluxAvatarPrompt(params),
    style,
    referenceImageUrl: params.sourceImageUrl,
    aspectRatio: params.aspectRatio,
    numImages: 1,
    apiKeyOverride: params.falKey,
  });
  const avatarUrl = result.imageUrls[0];
  if (!avatarUrl) throw new Error('Flux Kontext returned no avatar image');
  return { avatarUrl, fluxPrompt: result.prompt };
}

// ─── POST /api/avatar-talk/:artistId/generate ────────────────────────────────
router.post('/:artistId/generate', authenticate, async (req: Request, res: Response) => {
  const { artistId } = req.params;
  const {
    imageUrl,
    artistName: bodyArtistName,
    prompt,
    voice = 'Melissa',
    voiceMode = 'talk-to-me',
    useFluxAvatar = true,
    scene = 'studio',
    talkingStyle = 'stable',
    aspectRatio = '9:16',
    captionsEnabled = false,
    title,
  } = req.body;

  if (!imageUrl) {
    return res.status(400).json({ success: false, error: 'imageUrl is required' });
  }
  if (!prompt || prompt.trim().length < 5) {
    return res.status(400).json({ success: false, error: 'prompt must be at least 5 characters' });
  }

  const falKeyToUse = await resolveFalKey(artistId);

  if (!falKeyToUse) {
    return res.status(503).json({ success: false, error: 'FAL API key not configured. Add your FAL key in Avatar Talk settings.' });
  }

  fal.config({ credentials: falKeyToUse });

  const background = SCENE_BACKGROUNDS[scene] ?? SCENE_BACKGROUNDS.studio;

  try {
    console.log(`🎬 [avatar-talk] Generating video for artist ${artistId} — scene: ${scene} — voiceMode: ${voiceMode}`);

    const artist = await fetchArtistIdentity(artistId);
    const artistName = artist?.artist_name || bodyArtistName || title || 'Artist';
    let avatarImageUrl = imageUrl;
    let fluxPrompt: string | null = null;
    let audioUrl: string | null = null;
    let voiceForStorage = voice;

    if (useFluxAvatar !== false) {
      const fluxAvatar = await generateFluxAvatarImage({
        artistName,
        sourceImageUrl: imageUrl,
        prompt: prompt.trim(),
        scene,
        aspectRatio,
        falKey: falKeyToUse,
      });
      avatarImageUrl = fluxAvatar.avatarUrl;
      fluxPrompt = fluxAvatar.fluxPrompt;
    }

    if (voiceMode !== 'heygen') {
      const talkVoice = await resolveTalkToMeVoice(artistId, artist);
      const audioBuffer = await generateElevenLabsSpeech({
        apiKey: talkVoice.apiKey,
        voiceId: talkVoice.voiceId,
        text: prompt.trim(),
        talkingStyle,
      });
      audioUrl = await uploadAudioToFalStorage(audioBuffer, falKeyToUse);
      voiceForStorage = `${talkVoice.voiceLabel} (${talkVoice.source})`;
    }

    const heygenInput: Record<string, any> = {
      image_url: avatarImageUrl,
      talking_style: talkingStyle,
      background,
      resolution: '720p',
      aspect_ratio: aspectRatio,
      caption: captionsEnabled,
    };
    if (audioUrl) {
      heygenInput.audio_url = audioUrl;
    } else {
      heygenInput.prompt = prompt.trim();
      heygenInput.voice = voice;
    }

    const result: any = await fal.subscribe('fal-ai/heygen/avatar4/image-to-video', { input: heygenInput });

    const videoUrl: string = result?.data?.video?.url;
    if (!videoUrl) {
      throw new Error('No video URL returned from FAL');
    }

    const [row] = await db
      .insert(artistAvatarVideos)
      .values({
        artistId,
        videoUrl,
        thumbnailUrl: avatarImageUrl !== imageUrl ? avatarImageUrl : null,
        title: title || `${scene.charAt(0).toUpperCase() + scene.slice(1)} Talk`,
        prompt: prompt.trim(),
        voice: voiceForStorage,
        scene,
        talkingStyle,
        aspectRatio,
        captionsEnabled,
        status: 'ready',
        falRequestId: result?.requestId || null,
      })
      .returning();

    console.log(`✅ [avatar-talk] Video ready — id=${row.id} url=${videoUrl}`);
    return res.json({
      success: true,
      video: row,
      assets: {
        avatarImageUrl,
        audioUrl,
        voiceMode,
        fluxAvatar: useFluxAvatar !== false,
        fluxPrompt,
      },
    });
  } catch (err: any) {
    console.error(`❌ [avatar-talk] Generation failed:`, err.message);
    return res.status(500).json({ success: false, error: err.message || 'Generation failed' });
  }
});

// ─── GET /api/avatar-talk/:artistId/videos ────────────────────────────────────
router.get('/:artistId/videos', async (req: Request, res: Response) => {
  const { artistId } = req.params;
  try {
    const videos = await db
      .select()
      .from(artistAvatarVideos)
      .where(eq(artistAvatarVideos.artistId, artistId))
      .orderBy(desc(artistAvatarVideos.createdAt))
      .limit(20);

    return res.json({ success: true, videos });
  } catch (err: any) {
    console.error(`❌ [avatar-talk] List error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── DELETE /api/avatar-talk/:artistId/videos/:videoId ───────────────────────
router.delete('/:artistId/videos/:videoId', authenticate, async (req: Request, res: Response) => {
  const { artistId, videoId } = req.params;
  const id = parseInt(videoId, 10);
  if (isNaN(id)) return res.status(400).json({ success: false, error: 'Invalid videoId' });

  try {
    await db
      .delete(artistAvatarVideos)
      .where(and(eq(artistAvatarVideos.id, id), eq(artistAvatarVideos.artistId, artistId)));

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/avatar-talk/:artistId/config — save per-artist FAL key ─────────
router.post('/:artistId/config', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.uid;
    if (!userId) return res.status(401).json({ success: false, error: 'Unauthorized' });

    const { artistId } = req.params;
    const { falKey } = req.body;

    if (!falKey?.trim()) {
      return res.status(400).json({ success: false, error: 'falKey is required' });
    }

    await sql`
      INSERT INTO artist_avatar_talk_config (artist_id, owner_uid, fal_key, updated_at)
      VALUES (${artistId}, ${userId}, ${falKey.trim()}, NOW())
      ON CONFLICT (artist_id) DO UPDATE SET
        owner_uid  = EXCLUDED.owner_uid,
        fal_key    = EXCLUDED.fal_key,
        updated_at = NOW()
    `;

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[AvatarTalk] /config save error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/avatar-talk/:artistId/config — get config (key masked) ──────────
router.get('/:artistId/config', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const rows = await sql`
      SELECT
        artist_id,
        CASE WHEN fal_key IS NOT NULL AND fal_key != ''
             THEN '****saved' ELSE NULL END AS fal_key_hint,
        updated_at
      FROM artist_avatar_talk_config
      WHERE artist_id = ${artistId} LIMIT 1
    `;
    return res.json({ success: true, config: rows[0] ?? null });
  } catch (err: any) {
    return res.json({ success: true, config: null });
  }
});

export default router;

