/**
 * Influencer Pipeline — Orchestrates the full content generation flow:
 * 
 * Script (OpenAI) → Voice (FAL/ElevenLabs) → Avatar (HeyGen) → B-Roll (Kling/Wan) → Final Video
 *
 * Each step updates the influencer_content record status so the UI can track progress.
 */

import { logger } from '../utils/logger';
import { db } from '../../db';
import { influencerContent } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateInfluencerScript, saveScriptAsDraft } from './influencer-script-service';
import { generateInfluencerSpeech } from './influencer-voice-service';
import { generateAvatarVideo } from './influencer-avatar-service';
import { generateVideoFromImage } from './fal-service';

export interface PipelineResult {
  success: boolean;
  contentId?: number;
  finalVideoUrl?: string;
  status?: string;
  error?: string;
  steps?: PipelineStepResult[];
}

interface PipelineStepResult {
  step: string;
  success: boolean;
  durationMs: number;
  output?: string;
  error?: string;
}

/**
 * Run the full influencer content pipeline
 */
export async function runInfluencerPipeline(
  userId: number,
  options: {
    topic?: string;
    contentType?: string;
    targetDurationSec?: number;
    language?: string;
    customPrompt?: string;
    existingContentId?: number;
  } = {}
): Promise<PipelineResult> {
  const steps: PipelineStepResult[] = [];
  let contentId = options.existingContentId;

  try {
    // ── STEP 1: Generate Script ──
    const scriptStart = Date.now();
    let scriptText: string;
    let title: string;

    if (contentId) {
      // Resume from existing content
      const [existing] = await db.select().from(influencerContent).where(eq(influencerContent.id, contentId)).limit(1);
      if (!existing) return { success: false, error: 'Content not found' };
      scriptText = existing.scriptText;
      title = existing.title;
      steps.push({ step: 'script', success: true, durationMs: 0, output: 'Using existing script' });
    } else {
      await updateStatus(contentId, 'draft', 'Generating script...');
      
      const scriptResult = await generateInfluencerScript(userId, {
        topic: options.topic,
        contentType: options.contentType,
        targetDurationSec: options.targetDurationSec,
        language: options.language,
        customPrompt: options.customPrompt,
      });

      if (!scriptResult.success || !scriptResult.script) {
        steps.push({ step: 'script', success: false, durationMs: Date.now() - scriptStart, error: scriptResult.error });
        return { success: false, error: `Script generation failed: ${scriptResult.error}`, steps };
      }

      // Save as draft
      const draft = await saveScriptAsDraft(userId, scriptResult, options.contentType);
      contentId = draft.id;
      scriptText = scriptResult.script;
      title = scriptResult.title || 'Untitled';

      steps.push({ step: 'script', success: true, durationMs: Date.now() - scriptStart, output: title });
    }

    // ── STEP 2: Generate Voice Audio ──
    const voiceStart = Date.now();
    await updateStatus(contentId!, 'generating_voice', 'Generating voice audio...');

    // Clean script text for TTS (remove [PAUSE] markers, stage directions)
    const cleanScript = scriptText
      .replace(/\[PAUSE\]/gi, '...')
      .replace(/\[.*?\]/g, '')
      .trim();

    const voiceResult = await generateInfluencerSpeech(userId, cleanScript, {
      language: options.language,
    });

    if (!voiceResult.success || !voiceResult.audioUrl) {
      await updateStatus(contentId!, 'failed', undefined, `Voice generation failed: ${voiceResult.error}`);
      steps.push({ step: 'voice', success: false, durationMs: Date.now() - voiceStart, error: voiceResult.error });
      return { success: false, contentId, error: `Voice failed: ${voiceResult.error}`, steps };
    }

    await db.update(influencerContent)
      .set({ voiceAudioUrl: voiceResult.audioUrl })
      .where(eq(influencerContent.id, contentId!));

    steps.push({ step: 'voice', success: true, durationMs: Date.now() - voiceStart, output: voiceResult.audioUrl });

    // ── STEP 3: Generate Avatar Video ──
    const avatarStart = Date.now();
    await updateStatus(contentId!, 'generating_avatar', 'Creating avatar video...');

    const avatarResult = await generateAvatarVideo(userId, cleanScript, voiceResult.audioUrl, {
      aspectRatio: '9:16', // Vertical for TikTok/Reels
    });

    if (!avatarResult.success || !avatarResult.videoUrl) {
      // Avatar failed — mark as ready without avatar (voice-only content)
      await updateStatus(contentId!, 'generating_broll', undefined, undefined);
      steps.push({ step: 'avatar', success: false, durationMs: Date.now() - avatarStart, error: avatarResult.error });
      logger.warn(`[Pipeline] Avatar failed for content ${contentId}, continuing without avatar`);
    } else {
      await db.update(influencerContent)
        .set({
          avatarVideoUrl: avatarResult.videoUrl,
          thumbnailUrl: avatarResult.thumbnailUrl,
        })
        .where(eq(influencerContent.id, contentId!));

      steps.push({ step: 'avatar', success: true, durationMs: Date.now() - avatarStart, output: avatarResult.videoUrl });
    }

    // ── STEP 4: Generate B-Roll clips (Kling via FAL) ──
    const brollStart = Date.now();
    await updateStatus(contentId!, 'generating_broll', 'Generating visual clips...');

    const brollUrls: string[] = [];
    try {
      // Generate 1-2 supplementary visual clips
      const brollPrompt = `Cinematic B-roll footage for a ${options.contentType || 'entertainment'} video about "${options.topic || 'music'}". Dynamic, colorful, trending TikTok aesthetic. Smooth camera movement.`;
      
      const brollResult = await generateVideoFromImage(
        'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800', // Generic music visual
        brollPrompt,
        { duration: 4 }
      );

      if (brollResult?.videoUrl) {
        brollUrls.push(brollResult.videoUrl);
      }
    } catch (brollErr: any) {
      logger.warn(`[Pipeline] B-roll generation failed: ${brollErr.message}`);
    }

    if (brollUrls.length > 0) {
      await db.update(influencerContent)
        .set({ brollClips: brollUrls })
        .where(eq(influencerContent.id, contentId!));
    }

    steps.push({ step: 'broll', success: brollUrls.length > 0, durationMs: Date.now() - brollStart });

    // ── STEP 5: Mark as Ready ──
    // The final video is the avatar video (main) + b-roll can be composited in the timeline editor
    const finalVideoUrl = avatarResult?.videoUrl || voiceResult.audioUrl;

    await db.update(influencerContent)
      .set({
        finalVideoUrl,
        status: 'ready',
        pipelineStep: 'complete',
        updatedAt: new Date(),
      })
      .where(eq(influencerContent.id, contentId!));

    const totalCost = estimatePipelineCost(steps);
    await db.update(influencerContent)
      .set({ generationCostUsd: totalCost.toString() })
      .where(eq(influencerContent.id, contentId!));

    logger.info(`[Pipeline] Content ${contentId} pipeline complete. Cost: $${totalCost}`);

    return {
      success: true,
      contentId: contentId!,
      finalVideoUrl,
      status: 'ready',
      steps,
    };
  } catch (error: any) {
    logger.error(`[Pipeline] Fatal error: ${error.message}`);
    if (contentId) {
      await updateStatus(contentId, 'failed', undefined, error.message);
    }
    return { success: false, contentId, error: error.message, steps };
  }
}

/**
 * Get pipeline status for a content item
 */
export async function getPipelineStatus(contentId: number) {
  const [content] = await db.select()
    .from(influencerContent)
    .where(eq(influencerContent.id, contentId))
    .limit(1);
  
  if (!content) return null;

  return {
    id: content.id,
    status: content.status,
    pipelineStep: content.pipelineStep,
    title: content.title,
    hasVoice: !!content.voiceAudioUrl,
    hasAvatar: !!content.avatarVideoUrl,
    hasBroll: ((content.brollClips as string[]) || []).length > 0,
    hasFinalVideo: !!content.finalVideoUrl,
    error: content.errorMessage,
  };
}

// ── Helpers ──

async function updateStatus(contentId: number | undefined, status: string, step?: string, error?: string) {
  if (!contentId) return;
  await db.update(influencerContent)
    .set({
      status: status as any,
      pipelineStep: step || status,
      errorMessage: error || null,
      updatedAt: new Date(),
    })
    .where(eq(influencerContent.id, contentId));
}

function estimatePipelineCost(steps: PipelineStepResult[]): number {
  let cost = 0;
  for (const step of steps) {
    if (!step.success) continue;
    switch (step.step) {
      case 'script': cost += 0.01; break;   // GPT-4o-mini
      case 'voice': cost += 0.03; break;    // TTS
      case 'avatar': cost += 0.50; break;   // HeyGen
      case 'broll': cost += 0.28; break;    // Kling
    }
  }
  return Math.round(cost * 100) / 100;
}
