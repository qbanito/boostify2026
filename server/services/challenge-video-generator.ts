/**
 * 🎬 Challenge Video Generator
 *
 * Generates 3 Kling image-to-video clips for a challenge campaign.
 * All videos: 9:16, 10s, Kling pro tier (NOT 4k — too expensive).
 *
 * Styles:
 *  A) Urban Influencer — clean, street, professional look
 *  B) Group Dance      — high-energy crowd/synchronized vibes
 *  C) Luxury Rooftop   — aspirational, premium aesthetic
 *
 * Videos are submitted to FAL queue concurrently and polled until all complete.
 * Results are saved to promo_assets + challenge_campaigns updated.
 */
import OpenAI from 'openai';
import { db } from '../db';
import { songs, users, promoAssets, challengeCampaigns } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';
import { submitKlingVideo, getKlingStatus, getKlingResult } from './kling-video';
import { mirrorUrlToFirebase } from './storage-mirror';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY2 || process.env.OPENAI_API_KEY || '';
const POLL_INTERVAL_MS = 8_000;
const MAX_POLL_ATTEMPTS = 40; // 40 × 8s = 5min 20s

export interface ChallengeVideoStyle {
  key: 'urban' | 'groupDance' | 'luxury';
  label: string;
  basePromptSuffix: string;
}

const CHALLENGE_STYLES: ChallengeVideoStyle[] = [
  {
    key: 'urban',
    label: 'Urban Influencer',
    basePromptSuffix:
      'urban influencer in city street, clean professional style, natural sunlight, Nike/streetwear outfit, confident casual movement, trending dance or gesture, slow dolly push-in, 9:16 vertical, photorealistic',
  },
  {
    key: 'groupDance',
    label: 'Group Dance',
    basePromptSuffix:
      'group of dancers in perfect synchrony, open outdoor plaza, high energy crowd, stadium atmosphere, colorful streetwear, viral choreography, wide establishing shot then zoom, 9:16 vertical, photorealistic',
  },
  {
    key: 'luxury',
    label: 'Luxury Rooftop',
    basePromptSuffix:
      'solo performer on luxury rooftop terrace, city skyline at golden hour sunset, premium aspirational aesthetic, elegant outfit, smooth confident movement, cinematic bokeh background, 9:16 vertical, photorealistic',
  },
];

export interface GeneratedChallengeVideos {
  urbanVideoUrl: string | null;
  groupDanceVideoUrl: string | null;
  luxuryVideoUrl: string | null;
  urbanAssetId: number | null;
  groupDanceAssetId: number | null;
  luxuryAssetId: number | null;
}

export async function generateChallengeVideos(args: {
  campaignId: number;
  referenceImageUrl: string;    // artist profile image or first-frame of reference video
  referenceVideoUrl?: string | null;
}): Promise<GeneratedChallengeVideos> {
  const [campaign] = await db
    .select()
    .from(challengeCampaigns)
    .where(eq(challengeCampaigns.id, args.campaignId))
    .limit(1);
  if (!campaign) throw new Error(`Campaign ${args.campaignId} not found`);

  const [song] = await db
    .select()
    .from(songs)
    .where(eq(songs.id, campaign.songId))
    .limit(1);
  if (!song) throw new Error(`Song ${campaign.songId} not found`);

  const insights = (song.analysisJson as any)?.insights ?? {};
  const songTitle = song.title || `Song #${song.id}`;

  // Mark as generating
  await db
    .update(challengeCampaigns)
    .set({ status: 'generating', updatedAt: new Date() })
    .where(eq(challengeCampaigns.id, args.campaignId));

  // Build motion prompts for each style
  const motionPrompts = await buildChallengeMotionPrompts({
    songTitle,
    challengeName: campaign.challengeName,
    hashtag: campaign.hashtag,
    hookText: campaign.hookText ?? '',
    insights,
  });

  // Submit all 3 jobs concurrently
  logger.info('[ChallengeVideo] submitting 3 Kling jobs', { campaignId: args.campaignId });

  const submitResults = await Promise.all(
    CHALLENGE_STYLES.map(async (style) => {
      const prompt = `${motionPrompts[style.key]} — ${style.basePromptSuffix}`;
      try {
        const submit = await submitKlingVideo({
          imageUrl: args.referenceImageUrl,
          prompt,
          duration: 10,
          aspectRatio: '9:16',
          negativePrompt: 'blur, low quality, watermark, text, logo, ugly, distorted, nsfw, cartoon',
          tier: 'pro',
        });
        return { style, submit, prompt, error: null };
      } catch (err: any) {
        logger.error('[ChallengeVideo] submit failed', { style: style.key, err: err?.message });
        return { style, submit: null, prompt, error: err?.message };
      }
    }),
  );

  // Poll all jobs until complete
  const pollResults = await Promise.all(
    submitResults.map(async ({ style, submit, prompt, error }) => {
      if (!submit || error) return { style, videoUrl: null, error };
      try {
        const videoUrl = await pollKlingUntilDone(submit.model, submit.requestId);
        return { style, videoUrl, error: null };
      } catch (err: any) {
        return { style, videoUrl: null, error: err?.message };
      }
    }),
  );

  // Save results to promo_assets + collect URLs/assetIds
  const result: GeneratedChallengeVideos = {
    urbanVideoUrl: null,
    groupDanceVideoUrl: null,
    luxuryVideoUrl: null,
    urbanAssetId: null,
    groupDanceAssetId: null,
    luxuryAssetId: null,
  };

  await Promise.all(
    pollResults.map(async ({ style, videoUrl, error }) => {
      if (!videoUrl) {
        logger.warn('[ChallengeVideo] style failed', { style: style.key, error });
        return;
      }
      // Mirror to Firebase Storage
      let finalUrl = videoUrl;
      try {
        finalUrl = await mirrorUrlToFirebase(videoUrl, `challenge_${style.key}_${args.campaignId}.mp4`);
      } catch (_) { /* keep original URL if mirror fails */ }

      const urlKey = `${style.key}VideoUrl` as keyof GeneratedChallengeVideos;
      const assetKey = `${style.key}AssetId` as keyof GeneratedChallengeVideos;
      (result as any)[urlKey] = finalUrl;

      // Save promo asset
      try {
        const [asset] = await db
          .insert(promoAssets)
          .values({
            songId: campaign.songId,
            artistId: campaign.artistId,
            packId: `challenge_${args.campaignId}`,
            type: 'hook_video',
            variant: style.key,
            style: style.label,
            url: finalUrl,
            prompt: submitResults.find(r => r.style.key === style.key)?.prompt,
            model: 'fal-ai/kling-video/v3/pro/image-to-video',
            durationSeconds: 10,
            status: 'ready',
            metadata: { campaignId: args.campaignId, challengeStyle: style.key },
          })
          .returning();
        (result as any)[assetKey] = asset.id;
      } catch (err: any) {
        logger.warn('[ChallengeVideo] promo_assets insert failed', { err: err?.message });
      }
    }),
  );

  // Update campaign with URLs and final status
  const updateData: Record<string, any> = {
    urbanVideoUrl: result.urbanVideoUrl,
    groupDanceVideoUrl: result.groupDanceVideoUrl,
    luxuryVideoUrl: result.luxuryVideoUrl,
    urbanAssetId: result.urbanAssetId,
    groupDanceAssetId: result.groupDanceAssetId,
    luxuryAssetId: result.luxuryAssetId,
    status: 'done',
    updatedAt: new Date(),
  };

  await db
    .update(challengeCampaigns)
    .set(updateData)
    .where(eq(challengeCampaigns.id, args.campaignId));

  return result;
}

// ── Polling helper ────────────────────────────────────────────────────────

async function pollKlingUntilDone(model: string, requestId: string): Promise<string> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    await sleep(POLL_INTERVAL_MS);
    const status = await getKlingStatus(model, requestId);
    if (status.status === 'COMPLETED') {
      const result = await getKlingResult(model, requestId);
      return result.videoUrl;
    }
    if (status.status === 'FAILED') {
      throw new Error(`Kling job ${requestId} failed`);
    }
    logger.info('[ChallengeVideo] polling', { attempt, status: status.status, queue: status.queuePosition });
  }
  throw new Error(`Kling job ${requestId} timed out after ${MAX_POLL_ATTEMPTS} polls`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── GPT Motion Prompts ────────────────────────────────────────────────────

async function buildChallengeMotionPrompts(args: {
  songTitle: string;
  challengeName: string;
  hashtag: string;
  hookText: string;
  insights: any;
}): Promise<Record<'urban' | 'groupDance' | 'luxury', string>> {
  const defaults = {
    urban: `Person dancing energetically to "${args.songTitle}" in urban setting`,
    groupDance: `Group synchronized dance performance inspired by "${args.songTitle}"`,
    luxury: `Premium lifestyle performance inspired by "${args.songTitle}"`,
  };

  if (!OPENAI_API_KEY) return defaults;

  try {
    const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.8,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You create motion descriptions for AI video generation (Kling image-to-video). Be specific about body movement, camera motion, and energy. Keep each under 40 words. Return JSON only.',
        },
        {
          role: 'user',
          content: `Song: "${args.songTitle}"
Challenge: ${args.challengeName} (${args.hashtag})
Hook: "${args.hookText}"
Mood: ${(args.insights?.mood || []).join(', ') || 'energetic'}

Create motion prompts for 3 challenge video styles. Return JSON:
{
  "urban": "<motion description for urban influencer style>",
  "groupDance": "<motion description for group synchronized dance>",
  "luxury": "<motion description for luxury rooftop aspirational style>"
}`,
        },
      ],
    });
    const raw = JSON.parse(resp.choices[0].message.content || '{}');
    return {
      urban: raw.urban || defaults.urban,
      groupDance: raw.groupDance || defaults.groupDance,
      luxury: raw.luxury || defaults.luxury,
    };
  } catch (err: any) {
    logger.warn('[ChallengeVideo] GPT prompts failed, using defaults', { err: err?.message });
    return defaults;
  }
}
