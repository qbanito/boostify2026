/**
 * Influencer Avatar Service — HeyGen talking-head avatar creation & video generation
 *
 * 1. Create a photo avatar from the artist's profile image
 * 2. Generate talking-head videos from script + voice audio
 * 3. Manage avatar profiles
 *
 * API: HeyGen v2 (https://docs.heygen.com/reference)
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { db } from '../../db';
import { influencerAvatarProfiles } from '../../db/schema';
import { eq } from 'drizzle-orm';

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || process.env.VITE_HEYGEN_API_KEY || '';
const HEYGEN_BASE_URL = 'https://api.heygen.com';

function getHeygenHeaders() {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Key': HEYGEN_API_KEY,
  };
}

export interface AvatarCreateResult {
  success: boolean;
  avatarId?: string;
  previewUrl?: string;
  error?: string;
}

export interface AvatarVideoResult {
  success: boolean;
  videoId?: string;
  videoUrl?: string;
  durationSec?: number;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Create a talking photo avatar from artist's profile image
 */
export async function createInfluencerAvatar(
  userId: number,
  imageUrl: string,
  avatarStyle: string = 'casual'
): Promise<AvatarCreateResult> {
  try {
    logger.info(`[InfluencerAvatar] Creating avatar for user ${userId}`);

    // HeyGen: Create talking photo
    const response = await axios.post(
      `${HEYGEN_BASE_URL}/v2/photo_avatar`,
      { image_url: imageUrl },
      { headers: getHeygenHeaders(), timeout: 60000 }
    );

    const avatarId = response.data?.data?.photo_avatar_id || response.data?.data?.id;
    if (!avatarId) {
      // Fallback: try the legacy endpoint
      const legacyRes = await axios.post(
        `${HEYGEN_BASE_URL}/v1/talking_photo`,
        { photo_url: imageUrl },
        { headers: getHeygenHeaders(), timeout: 60000 }
      );
      
      const legacyId = legacyRes.data?.data?.talking_photo_id;
      if (!legacyId) {
        return { success: false, error: 'Failed to create HeyGen avatar' };
      }

      await saveAvatarProfile(userId, legacyId, imageUrl, avatarStyle);
      return { success: true, avatarId: legacyId, previewUrl: imageUrl };
    }

    await saveAvatarProfile(userId, avatarId, imageUrl, avatarStyle);

    logger.info(`[InfluencerAvatar] Avatar created: ${avatarId}`);
    return {
      success: true,
      avatarId,
      previewUrl: response.data?.data?.preview_url || imageUrl,
    };
  } catch (error: any) {
    logger.error(`[InfluencerAvatar] Create error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Generate a talking-head video: avatar speaks the script with the artist's voice
 */
export async function generateAvatarVideo(
  userId: number,
  scriptText: string,
  voiceAudioUrl: string,
  options: {
    aspectRatio?: '16:9' | '9:16' | '1:1';
    background?: string;
  } = {}
): Promise<AvatarVideoResult> {
  try {
    // Get avatar profile
    const [avatarProfile] = await db.select()
      .from(influencerAvatarProfiles)
      .where(eq(influencerAvatarProfiles.userId, userId))
      .limit(1);

    if (!avatarProfile) {
      return { success: false, error: 'No avatar profile found. Create avatar first.' };
    }

    logger.info(`[InfluencerAvatar] Generating video for user ${userId}, avatar ${avatarProfile.heygenAvatarId}`);

    // Create video with HeyGen
    const response = await axios.post(
      `${HEYGEN_BASE_URL}/v2/video/generate`,
      {
        video_inputs: [{
          character: {
            type: 'talking_photo',
            talking_photo_id: avatarProfile.heygenAvatarId,
          },
          voice: {
            type: 'audio',
            audio_url: voiceAudioUrl,
          },
          background: options.background ? {
            type: 'image',
            value: options.background,
          } : undefined,
        }],
        dimension: options.aspectRatio === '9:16'
          ? { width: 1080, height: 1920 }
          : options.aspectRatio === '1:1'
            ? { width: 1080, height: 1080 }
            : { width: 1920, height: 1080 },
      },
      { headers: getHeygenHeaders(), timeout: 30000 }
    );

    const videoId = response.data?.data?.video_id;
    if (!videoId) {
      return { success: false, error: 'No video_id from HeyGen' };
    }

    // Poll for completion
    const videoResult = await pollHeygenVideo(videoId);
    return videoResult;
  } catch (error: any) {
    logger.error(`[InfluencerAvatar] Video gen error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Get avatar profile for a user
 */
export async function getAvatarProfile(userId: number) {
  const [profile] = await db.select()
    .from(influencerAvatarProfiles)
    .where(eq(influencerAvatarProfiles.userId, userId))
    .limit(1);
  return profile || null;
}

/**
 * Delete avatar profile
 */
export async function deleteAvatarProfile(userId: number) {
  await db.delete(influencerAvatarProfiles)
    .where(eq(influencerAvatarProfiles.userId, userId));
  return { success: true };
}

// ── Internal helpers ──

async function saveAvatarProfile(userId: number, avatarId: string, imageUrl: string, style: string) {
  const existing = await db.select().from(influencerAvatarProfiles).where(eq(influencerAvatarProfiles.userId, userId)).limit(1);
  
  if (existing.length > 0) {
    await db.update(influencerAvatarProfiles)
      .set({
        heygenAvatarId: avatarId,
        sourceImageUrl: imageUrl,
        avatarStyle: style as any,
        updatedAt: new Date(),
      })
      .where(eq(influencerAvatarProfiles.userId, userId));
  } else {
    await db.insert(influencerAvatarProfiles).values({
      userId,
      heygenAvatarId: avatarId,
      sourceImageUrl: imageUrl,
      avatarStyle: style as any,
    });
  }
}

async function pollHeygenVideo(videoId: string, maxAttempts = 120): Promise<AvatarVideoResult> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));

    try {
      const statusRes = await axios.get(
        `${HEYGEN_BASE_URL}/v1/video_status.get?video_id=${videoId}`,
        { headers: getHeygenHeaders() }
      );

      const status = statusRes.data?.data?.status;

      if (status === 'completed') {
        return {
          success: true,
          videoId,
          videoUrl: statusRes.data.data.video_url,
          durationSec: statusRes.data.data.duration,
          thumbnailUrl: statusRes.data.data.thumbnail_url,
        };
      }

      if (status === 'failed') {
        return { success: false, error: `HeyGen video failed: ${statusRes.data.data.error || 'unknown'}` };
      }

      // 'processing', 'pending' → keep polling
    } catch (err: any) {
      logger.warn(`[InfluencerAvatar] Poll error: ${err.message}`);
    }
  }

  return { success: false, error: 'HeyGen video timed out after 6 minutes' };
}
