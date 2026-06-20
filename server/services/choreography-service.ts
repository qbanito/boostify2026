/**
 * 💃 Choreography Service
 * Permite al artista grabar un video corto de coreografía (3-10s) que se usa como
 * "driving video" para transferir esos movimientos a la imagen AI del artista.
 *
 * Pipeline:
 * 1. Upload: Video de coreografía → Firebase Storage → URL pública
 * 2. Loop:   Calc repeticiones para cubrir duración del clip
 * 3. Apply:  DreamActor v2 (image + driving video → video animado)
 * 4. Sync:   (Opcional) PixVerse lipsync sobre el resultado
 *
 * Modelos FAL:
 * - fal-ai/bytedance/dreamactor/v2  → Motion transfer (driving video)
 * - fal-ai/pixverse/lipsync          → Lip-sync post-process
 * - fal-ai/bytedance/omnihuman/v1.5  → Fallback (audio-driven body)
 */

import { logger } from '../utils/logger';
import { storage } from '../firebase';
import axios from 'axios';

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN || '';

// ============================================
// TYPES
// ============================================

export interface ChoreographyPreset {
  id: string;
  label: string;
  description: string;
  promptHint: string;  // Added to DreamActor prompt
}

export const CHOREOGRAPHY_PRESETS: ChoreographyPreset[] = [
  { id: 'head-bop',   label: 'Head Bop',   description: 'Movimiento rítmico de cabeza',        promptHint: 'rhythmic head bobbing to the beat' },
  { id: 'sway',       label: 'Sway',       description: 'Balanceo suave del cuerpo',            promptHint: 'gentle body swaying side to side' },
  { id: 'full-body',  label: 'Full Body',   description: 'Coreografía de cuerpo completo',      promptHint: 'full body dance choreography' },
  { id: 'arms-wave',  label: 'Arms Wave',   description: 'Movimiento de brazos y manos',        promptHint: 'expressive arm and hand movements' },
  { id: 'hip-hop',    label: 'Hip Hop',     description: 'Pasos estilo hip-hop',                promptHint: 'hip hop dance style with sharp movements' },
  { id: 'latin',      label: 'Latin',       description: 'Movimientos latinos (salsa, reggaeton)', promptHint: 'latin dance movements with hip motion' },
  { id: 'custom',     label: 'Custom',      description: 'Tu propia coreografía',               promptHint: 'custom dance choreography' },
];

// ============================================
// MOTION TEMPLATE REGISTRY
// Auto-selects driving videos by genre when no
// user-uploaded choreography is available.
// Templates stored in Firebase Storage.
// ============================================

export interface MotionTemplate {
  id: string;
  label: string;
  genres: string[];           // Matching genres
  drivingVideoUrl: string;    // Firebase Storage URL
  duration: number;           // seconds
  style: 'portrait' | 'half-body' | 'full-body';
  energy: 'low' | 'medium' | 'high';
}

// Firebase Storage base path for motion templates
const MOTION_TEMPLATES_BASE = 'https://storage.googleapis.com/boostify-music.appspot.com/motion-templates';

export const MOTION_TEMPLATES: MotionTemplate[] = [
  {
    id: 'head-bop-chill',
    label: 'Chill Head Bop',
    genres: ['lo-fi', 'chill', 'ambient', 'jazz', 'r&b', 'soul', 'indie'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/head-bop-chill.mp4`,
    duration: 5,
    style: 'portrait',
    energy: 'low',
  },
  {
    id: 'sway-medium',
    label: 'Medium Sway',
    genres: ['pop', 'indie', 'folk', 'country', 'alternative', 'singer-songwriter'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/sway-medium.mp4`,
    duration: 5,
    style: 'half-body',
    energy: 'medium',
  },
  {
    id: 'dance-hiphop',
    label: 'Hip Hop Dance',
    genres: ['hip-hop', 'rap', 'trap', 'drill', 'grime'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/dance-hiphop.mp4`,
    duration: 5,
    style: 'full-body',
    energy: 'high',
  },
  {
    id: 'dance-latin',
    label: 'Latin Dance',
    genres: ['reggaeton', 'latin', 'salsa', 'bachata', 'dembow', 'cumbia'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/dance-latin.mp4`,
    duration: 5,
    style: 'full-body',
    energy: 'high',
  },
  {
    id: 'dance-edm',
    label: 'EDM Dance',
    genres: ['electronic', 'edm', 'house', 'techno', 'dubstep', 'trance', 'drum-and-bass'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/dance-edm.mp4`,
    duration: 5,
    style: 'full-body',
    energy: 'high',
  },
  {
    id: 'rock-performance',
    label: 'Rock Performance',
    genres: ['rock', 'metal', 'punk', 'grunge', 'hard-rock', 'classic-rock'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/rock-performance.mp4`,
    duration: 5,
    style: 'half-body',
    energy: 'high',
  },
  {
    id: 'singer-ballad',
    label: 'Ballad Singer',
    genres: ['ballad', 'classical', 'opera', 'gospel', 'blues'],
    drivingVideoUrl: `${MOTION_TEMPLATES_BASE}/singer-ballad.mp4`,
    duration: 5,
    style: 'portrait',
    energy: 'low',
  },
];

/**
 * Select the best motion template for a given genre.
 * Falls back to 'sway-medium' if no genre match.
 */
export function selectMotionTemplate(genre: string): MotionTemplate {
  const normalized = genre.toLowerCase().trim();
  const match = MOTION_TEMPLATES.find(t =>
    t.genres.some(g => normalized.includes(g) || g.includes(normalized))
  );
  return match || MOTION_TEMPLATES.find(t => t.id === 'sway-medium')!;
}

export interface ChoreographyUploadResult {
  success: boolean;
  videoUrl?: string;
  firebasePath?: string;
  error?: string;
}

export interface ChoreographyApplyResult {
  success: boolean;
  videoUrl?: string;
  requestId?: string;
  duration?: number;
  error?: string;
}

export interface ChoreographyRequest {
  choreographyVideoUrl: string;   // Driving video URL (uploaded choreography)
  artistImageUrl: string;          // Source image of the AI artist
  clipDuration: number;            // How long the clip is (seconds)
  loopStart?: number;              // Loop trim start (seconds)
  loopEnd?: number;                // Loop trim end (seconds)
  mirrorLoop?: boolean;            // Ping-pong loop
  preset?: string;                 // Preset ID for prompt enrichment
  addLipsync?: boolean;            // Whether to add PixVerse lipsync after
  audioUrl?: string;               // Audio URL for lipsync (required if addLipsync)
}

// ============================================
// UPLOAD
// ============================================

/**
 * Upload choreography video to Firebase Storage
 */
export async function uploadChoreographyVideo(
  videoBuffer: Buffer,
  userEmail: string,
  contentType: string = 'video/webm'
): Promise<ChoreographyUploadResult> {
  if (!storage) {
    return { success: false, error: 'Firebase Storage not available' };
  }

  try {
    const timestamp = Date.now();
    const sanitizedEmail = userEmail.replace(/[^a-zA-Z0-9]/g, '_');
    const ext = contentType.includes('mp4') ? 'mp4' : 'webm';
    const fileName = `choreography/${sanitizedEmail}/choreo-${timestamp}.${ext}`;

    const bucket = storage.bucket();
    const file = bucket.file(fileName);

    await file.save(videoBuffer, {
      metadata: {
        contentType,
        metadata: { userEmail, type: 'choreography', uploadedAt: new Date().toISOString() }
      },
      validation: false
    });

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;

    logger.log(`✅ [CHOREO] Video subido: ${publicUrl.substring(0, 80)}...`);
    return { success: true, videoUrl: publicUrl, firebasePath: fileName };
  } catch (error: any) {
    logger.error(`❌ [CHOREO] Upload error:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// APPLY — DreamActor v2 Motion Transfer
// ============================================

/**
 * Apply choreography to an artist image using DreamActor v2.
 * The choreography video acts as the "driving video" that transfers
 * pose/movement to the static artist image.
 *
 * DreamActor v2: fal-ai/bytedance/dreamactor/v2
 *   Input:  image_url (artist) + video_url (choreography driving video)
 *   Output: Video with motion transfer applied
 *   Max:    ~30 seconds per request
 */
export async function applyChoreography(
  request: ChoreographyRequest
): Promise<ChoreographyApplyResult> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    const { choreographyVideoUrl, artistImageUrl, preset } = request;

    // Get preset hint for better results
    const presetData = CHOREOGRAPHY_PRESETS.find(p => p.id === preset);
    const promptHint = presetData?.promptHint || 'dance choreography performance';

    logger.log(`💃 [CHOREO] Applying choreography via DreamActor v2`);
    logger.log(`   🖼️ Artist: ${artistImageUrl.substring(0, 60)}...`);
    logger.log(`   🎬 Driving: ${choreographyVideoUrl.substring(0, 60)}...`);
    logger.log(`   💡 Preset: ${preset || 'custom'} (${promptHint})`);

    // Submit to DreamActor v2
    const submitResponse = await fetch('https://queue.fal.run/fal-ai/bytedance/dreamactor/v2', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: artistImageUrl,
        video_url: choreographyVideoUrl,
        trim_first_second: false  // Keep choreography from start
      })
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      logger.error(`❌ [CHOREO] DreamActor submit error:`, errorData);
      return { success: false, error: `DreamActor submit failed: ${submitResponse.status}` };
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;
    logger.log(`⏳ [CHOREO] DreamActor request: ${requestId}`);

    // Poll for completion (max 5 minutes, check every 5s)
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const videoUrl = resultData.video?.url || resultData.video_url;

        if (videoUrl) {
          logger.log(`✅ [CHOREO] DreamActor completed: ${videoUrl.substring(0, 60)}...`);

          // Optionally add lipsync
          if (request.addLipsync && request.audioUrl) {
            return await addLipsyncToChoreography(videoUrl, request.audioUrl);
          }

          return { success: true, videoUrl, requestId };
        }
        return { success: false, error: 'No video URL in DreamActor response' };
      }

      if (statusData.status === 'FAILED') {
        logger.error(`❌ [CHOREO] DreamActor failed:`, statusData);
        return { success: false, error: 'DreamActor processing failed' };
      }

      logger.log(`⏳ [CHOREO] Processing... (${i + 1}/${maxAttempts})`);
    }

    return { success: false, error: 'DreamActor timeout (5 min)' };
  } catch (error: any) {
    logger.error(`❌ [CHOREO] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// LIPSYNC — PixVerse post-process
// ============================================

/**
 * Add lip-sync to an already-generated choreography video.
 * Uses PixVerse: fal-ai/pixverse/lipsync
 *   Input:  video_url + audio_url
 *   Output: Video with synchronized lips
 */
async function addLipsyncToChoreography(
  videoUrl: string,
  audioUrl: string
): Promise<ChoreographyApplyResult> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    logger.log(`🎤 [CHOREO] Adding lipsync via PixVerse...`);

    const submitResponse = await fetch('https://queue.fal.run/fal-ai/pixverse/lipsync', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        video_url: videoUrl,
        audio_url: audioUrl
      })
    });

    if (!submitResponse.ok) {
      // If lipsync fails, return the original choreography video
      logger.warn(`⚠️ [CHOREO] Lipsync submit failed, returning choreo-only video`);
      return { success: true, videoUrl };
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    // Poll for lipsync completion (max 3 min)
    const maxAttempts = 36;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/pixverse/lipsync/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/pixverse/lipsync/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const lipsyncUrl = resultData.video?.url || resultData.video_url;

        if (lipsyncUrl) {
          logger.log(`✅ [CHOREO] Lipsync completed: ${lipsyncUrl.substring(0, 60)}...`);
          return { success: true, videoUrl: lipsyncUrl, requestId };
        }
        // Fallback to original
        return { success: true, videoUrl };
      }

      if (statusData.status === 'FAILED') {
        logger.warn(`⚠️ [CHOREO] Lipsync failed, returning choreo-only video`);
        return { success: true, videoUrl };
      }
    }

    // Timeout — return original
    logger.warn(`⚠️ [CHOREO] Lipsync timeout, returning choreo-only video`);
    return { success: true, videoUrl };
  } catch (error: any) {
    logger.warn(`⚠️ [CHOREO] Lipsync error, returning choreo-only:`, error.message);
    return { success: true, videoUrl };
  }
}

// ============================================
// FALLBACK — OmniHuman (audio-driven)
// ============================================

/**
 * Fallback: Generate choreography from audio only (no driving video needed).
 * Uses OmniHuman v1.5: fal-ai/bytedance/omnihuman/v1.5
 *   Input:  image_url + audio_url + prompt
 *   Output: Video with body movement + lipsync
 */
export async function generateAudioDrivenChoreography(
  artistImageUrl: string,
  audioUrl: string,
  preset?: string,
  resolution: '720p' | '1080p' = '720p'
): Promise<ChoreographyApplyResult> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  if (!FAL_API_KEY) {
    return { success: false, error: 'FAL_API_KEY not configured' };
  }

  try {
    const presetData = CHOREOGRAPHY_PRESETS.find(p => p.id === preset);
    const prompt = presetData
      ? `Music artist performing ${presetData.promptHint}, professional music video, natural body movement`
      : 'Music artist dancing performance, professional music video, natural body movement';

    logger.log(`🎤 [CHOREO-AUDIO] OmniHuman fallback: ${prompt.substring(0, 60)}...`);

    const submitResponse = await fetch('https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${FAL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        image_url: artistImageUrl,
        audio_url: audioUrl,
        prompt,
        turbo_mode: false,
        resolution
      })
    });

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json().catch(() => ({}));
      return { success: false, error: `OmniHuman submit failed: ${submitResponse.status}` };
    }

    const submitData = await submitResponse.json();
    const requestId = submitData.request_id;

    // Poll (max 5 min)
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));

      const statusResponse = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5/requests/${requestId}/status`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      const statusData = await statusResponse.json();

      if (statusData.status === 'COMPLETED') {
        const resultResponse = await fetch(
          `https://queue.fal.run/fal-ai/bytedance/omnihuman/v1.5/requests/${requestId}`,
          { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
        );
        const resultData = await resultResponse.json();
        const videoUrl = resultData.video?.url || resultData.video_url;

        if (videoUrl) {
          logger.log(`✅ [CHOREO-AUDIO] OmniHuman completed: ${videoUrl.substring(0, 60)}...`);
          return { success: true, videoUrl, requestId, duration: resultData.duration };
        }
        return { success: false, error: 'No video URL in OmniHuman response' };
      }

      if (statusData.status === 'FAILED') {
        return { success: false, error: 'OmniHuman processing failed' };
      }
    }

    return { success: false, error: 'OmniHuman timeout (5 min)' };
  } catch (error: any) {
    logger.error(`❌ [CHOREO-AUDIO] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

// ============================================
// STATUS CHECK (for async polling from client)
// ============================================

export async function checkDreamActorStatus(
  requestId: string
): Promise<{ status: string; videoUrl?: string; error?: string }> {
  const FAL_API_KEY = process.env.FAL_API_KEY;
  if (!FAL_API_KEY) {
    return { status: 'error', error: 'FAL_API_KEY not configured' };
  }

  try {
    const statusResponse = await fetch(
      `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}/status`,
      { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
    );
    const statusData = await statusResponse.json();

    if (statusData.status === 'COMPLETED') {
      const resultResponse = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/dreamactor/v2/requests/${requestId}`,
        { headers: { 'Authorization': `Key ${FAL_API_KEY}` } }
      );
      const resultData = await resultResponse.json();
      const videoUrl = resultData.video?.url || resultData.video_url;
      return { status: 'completed', videoUrl };
    }

    if (statusData.status === 'FAILED') {
      return { status: 'failed', error: 'Processing failed' };
    }

    return { status: 'processing' };
  } catch (error: any) {
    return { status: 'error', error: error.message };
  }
}

// ============================================
// REPLICATE — DreamActor M2.0 (Upgraded Motion Transfer)
// ============================================

/**
 * Apply choreography using DreamActor M2.0 via Replicate.
 * Upgraded model: better motion quality, works with humans, cartoons, animals.
 * Cost: $0.05/second of output video.
 *
 * Replicate API: bytedance/dreamactor-m2.0
 *   Input:  image (artist) + video (driving video) + cut_first_second
 *   Output: Animated video with motion transfer
 */
export async function applyChoreographyWithReplicate(
  request: ChoreographyRequest
): Promise<ChoreographyApplyResult> {
  if (!REPLICATE_API_TOKEN) {
    return { success: false, error: 'REPLICATE_API_TOKEN not configured' };
  }

  try {
    const { choreographyVideoUrl, artistImageUrl } = request;

    logger.log(`💃 [CHOREO-REPLICATE] DreamActor M2.0 via Replicate`);
    logger.log(`   🖼️ Artist: ${artistImageUrl.substring(0, 60)}...`);
    logger.log(`   🎬 Driving: ${choreographyVideoUrl.substring(0, 60)}...`);

    // Create prediction via Replicate models API
    const createResponse = await axios.post(
      'https://api.replicate.com/v1/models/bytedance/dreamactor-m2.0/predictions',
      {
        input: {
          image: artistImageUrl,
          video: choreographyVideoUrl,
          cut_first_second: true, // Remove 1s transition at start
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Prefer': 'wait',          // Try synchronous (up to ~60s)
        },
        timeout: 300000, // 5 min max
      }
    );

    let prediction = createResponse.data;

    // If not completed yet (long video), poll for result
    if (prediction.status !== 'succeeded' && prediction.status !== 'failed') {
      const pollUrl = prediction.urls?.get || `https://api.replicate.com/v1/predictions/${prediction.id}`;
      logger.log(`⏳ [CHOREO-REPLICATE] Polling prediction ${prediction.id}...`);

      // Poll up to 5 minutes (60 × 5s = 300s)
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const pollRes = await axios.get(pollUrl, {
          headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
          timeout: 15000,
        });
        prediction = pollRes.data;

        if (prediction.status === 'succeeded' || prediction.status === 'failed') {
          break;
        }
        if (i % 6 === 0) {
          logger.log(`⏳ [CHOREO-REPLICATE] Still processing... (${Math.round((i * 5) / 60)}min)`);
        }
      }
    }

    if (prediction.status === 'failed') {
      const err = prediction.error || 'DreamActor M2.0 prediction failed';
      logger.error(`❌ [CHOREO-REPLICATE] Failed: ${err}`);
      return { success: false, error: err };
    }

    if (prediction.status !== 'succeeded') {
      return { success: false, error: 'DreamActor M2.0 timeout (5 min)' };
    }

    // Get video URL from output
    const videoUrl = typeof prediction.output === 'string'
      ? prediction.output
      : Array.isArray(prediction.output) ? prediction.output[0] : prediction.output?.url;

    if (!videoUrl) {
      return { success: false, error: 'No video URL in DreamActor M2.0 response' };
    }

    logger.log(`✅ [CHOREO-REPLICATE] DreamActor M2.0 completed!`);
    logger.log(`   🎬 Video: ${videoUrl.substring(0, 80)}...`);

    // Upload to Firebase Storage for permanent URL
    try {
      const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 60000 });
      const videoBuffer = Buffer.from(videoResponse.data);
      const fileName = `choreography/replicate/dreamactor-${Date.now()}.mp4`;
      const bucket = storage?.bucket();

      if (bucket) {
        const file = bucket.file(fileName);
        await file.save(videoBuffer, {
          metadata: { contentType: 'video/mp4' },
          validation: false,
        });
        const permanentUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(fileName)}?alt=media`;
        logger.log(`✅ [CHOREO-REPLICATE] Uploaded to Firebase: ${permanentUrl.substring(0, 80)}...`);

        // Optionally add lipsync
        if (request.addLipsync && request.audioUrl) {
          return await addLipsyncToChoreography(permanentUrl, request.audioUrl);
        }

        return { success: true, videoUrl: permanentUrl, requestId: prediction.id };
      }
    } catch (uploadErr: any) {
      logger.warn(`⚠️ [CHOREO-REPLICATE] Firebase upload failed, using Replicate URL: ${uploadErr.message}`);
    }

    // Fallback: return Replicate URL (temporary, expires in ~1hr)
    if (request.addLipsync && request.audioUrl) {
      return await addLipsyncToChoreography(videoUrl, request.audioUrl);
    }

    return { success: true, videoUrl, requestId: prediction.id };
  } catch (error: any) {
    const detail = error.response?.data?.detail || error.response?.data?.title || error.message;
    logger.error(`❌ [CHOREO-REPLICATE] Error: ${detail}`);
    return { success: false, error: `DreamActor M2.0 (Replicate): ${detail}` };
  }
}

// ============================================
// SMART ANIMATE — Auto-select best model
// ============================================

/**
 * Animate an artist image with the best available model.
 * Chain: FAL DreamActor v2 → Replicate DreamActor M2.0 → OmniHuman (audio-only fallback)
 *
 * If no driving video is provided, auto-selects a motion template based on genre.
 */
export async function animateArtist(options: {
  artistImageUrl: string;
  drivingVideoUrl?: string;    // User-uploaded or template
  audioUrl?: string;           // For lipsync or audio-driven fallback
  genre?: string;              // For auto template selection
  preset?: string;             // Choreography preset
  addLipsync?: boolean;
}): Promise<ChoreographyApplyResult> {
  const { artistImageUrl, genre, audioUrl, preset, addLipsync } = options;

  // Step 1: Determine driving video
  let drivingVideoUrl = options.drivingVideoUrl;
  if (!drivingVideoUrl && genre) {
    const template = selectMotionTemplate(genre);
    drivingVideoUrl = template.drivingVideoUrl;
    logger.log(`🎬 [ANIMATE] Auto-selected template: ${template.label} for genre: ${genre}`);
  }

  // Step 2: If we have a driving video, try motion transfer models
  if (drivingVideoUrl) {
    const choreographyRequest: ChoreographyRequest = {
      choreographyVideoUrl: drivingVideoUrl,
      artistImageUrl,
      clipDuration: 5,
      preset,
      addLipsync,
      audioUrl,
    };

    // Try FAL DreamActor v2 first
    logger.log(`🎭 [ANIMATE] Trying FAL DreamActor v2...`);
    const falResult = await applyChoreography(choreographyRequest);
    if (falResult.success) {
      logger.log(`✅ [ANIMATE] FAL DreamActor v2 succeeded`);
      return falResult;
    }
    logger.warn(`⚠️ [ANIMATE] FAL DreamActor v2 failed: ${falResult.error}`);

    // Fallback to Replicate DreamActor M2.0
    if (REPLICATE_API_TOKEN) {
      logger.log(`🎭 [ANIMATE] Fallback → Replicate DreamActor M2.0...`);
      const replicateResult = await applyChoreographyWithReplicate(choreographyRequest);
      if (replicateResult.success) {
        logger.log(`✅ [ANIMATE] Replicate DreamActor M2.0 succeeded`);
        return replicateResult;
      }
      logger.warn(`⚠️ [ANIMATE] Replicate DreamActor M2.0 failed: ${replicateResult.error}`);
    }
  }

  // Step 3: Audio-driven fallback (OmniHuman) — no driving video needed
  if (audioUrl) {
    logger.log(`🎤 [ANIMATE] Final fallback → OmniHuman audio-driven...`);
    const audioResult = await generateAudioDrivenChoreography(
      artistImageUrl, audioUrl, preset
    );
    if (audioResult.success) {
      logger.log(`✅ [ANIMATE] OmniHuman audio-driven succeeded`);
      return audioResult;
    }
    logger.warn(`⚠️ [ANIMATE] OmniHuman failed: ${audioResult.error}`);
  }

  return {
    success: false,
    error: 'All animation models failed (DreamActor v2, DreamActor M2.0, OmniHuman)',
  };
}
