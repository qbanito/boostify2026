/**
 * Storyboard-to-Video Pipeline
 * Based on: PixVerseAI/skills (storyboard-to-video workflow) + HKUDS/VideoAgent
 *
 * Animates each scene image from a completed storyboard into a video clip,
 * then assembles them into a final narrative video.
 *
 * Pipeline:
 *   1. Per scene: imageUrl → [PixVerse or Kling] → videoClipUrl
 *   2. All clips are assembled into a timeline with per-scene durations
 *   3. Optional: audio URL (song snippet) is passed for final assembly
 *
 * The pipeline is designed to be:
 *   - Incremental: each scene is animated independently
 *   - Progressive: `onSceneComplete` callback fires after each scene so the
 *     UI can show live progress
 *   - Fault-tolerant: if a scene animation fails, it is skipped and the
 *     remaining scenes continue
 *
 * Video assembly (stitching) is intentionally delegated to Shotstack or
 * client-side via the returned timeline, to keep this service stateless.
 */

import { logger } from '../utils/logger.js';
import { generatePixVerseImageToVideo, isPixVerseAvailable } from './pixverse-video.js';
import { generateKlingVideoBlocking } from './kling-video.js';
import type { StoryboardJson, StoryboardScene } from './video-concepts-storyboard.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type AnimationProvider = 'pixverse' | 'kling';

export type AnimatedSceneResult = {
  sceneId: string;
  order: number;
  videoUrl: string;
  durationSeconds: number;
  provider: AnimationProvider;
  error?: string;
};

export type StoryboardVideoTimeline = {
  totalDurationSeconds: number;
  scenes: Array<{
    sceneId: string;
    order: number;
    startSeconds: number;
    endSeconds: number;
    durationSeconds: number;
    videoUrl: string | null;   // null if animation failed
    imageUrl: string | null;   // fallback still
    narration?: string;
  }>;
};

export type AnimateStoryboardResult = {
  projectId: string;
  timeline: StoryboardVideoTimeline;
  animatedScenes: AnimatedSceneResult[];
  failedScenes: string[];      // sceneIds that failed
  totalDurationSeconds: number;
  provider: AnimationProvider;
};

// ─────────────────────────────────────────────────────────────────────────────
// Scene duration parser
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a storyboard scene duration string like "00:08" into seconds.
 * Falls back to a sensible default if parsing fails.
 */
function parseDurationString(dur: string | undefined, fallback = 5): number {
  if (!dur) return fallback;
  const parts = dur.split(':').map(Number);
  if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return (minutes ?? 0) * 60 + (seconds ?? 0);
  }
  if (parts.length === 1 && !isNaN(parts[0])) return parts[0];
  return fallback;
}

/**
 * Clamps a scene duration to values supported by the video API.
 * PixVerse supports 5, 8, 10 seconds; Kling supports 5 or 10.
 */
function clampDuration(seconds: number, provider: AnimationProvider): 5 | 8 | 10 {
  if (seconds <= 5) return 5;
  if (provider === 'pixverse' && seconds <= 8) return 8;
  return 10;
}

// ─────────────────────────────────────────────────────────────────────────────
// Single scene animation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animates a single storyboard scene image into a video clip.
 *
 * The video prompt is built from the scene's imagePrompt + cameraMove +
 * visualDirection to give the model the most context possible.
 */
export async function animateStoryboardScene(
  scene: StoryboardScene,
  provider: AnimationProvider,
  projectId: string,
): Promise<AnimatedSceneResult> {
  if (!scene.imageUrl) {
    return {
      sceneId: scene.id,
      order: scene.order,
      videoUrl: '',
      durationSeconds: 0,
      provider,
      error: 'No imageUrl — scene not yet generated',
    };
  }

  const rawDuration = parseDurationString(scene.duration);
  const duration = clampDuration(rawDuration, provider);

  // Build a focused motion prompt from the scene context
  const motionPrompt = buildSceneMotionPrompt(scene);

  logger.info('[StoryboardPipeline] animating scene', {
    sceneId: scene.id,
    order: scene.order,
    provider,
    duration,
  });

  try {
    if (provider === 'pixverse') {
      const result = await generatePixVerseImageToVideo({
        imageUrl: scene.imageUrl,
        prompt: motionPrompt,
        model: 'v6',
        aspectRatio: '16:9',
        duration: duration as 5 | 8 | 10,
        enhancePrompt: false, // we already craft a detailed prompt
      });
      return {
        sceneId: scene.id,
        order: scene.order,
        videoUrl: result.videoUrl,
        durationSeconds: result.durationSeconds,
        provider,
      };
    } else {
      // Kling fallback
      const result = await generateKlingVideoBlocking({
        imageUrl: scene.imageUrl,
        prompt: motionPrompt,
        duration: duration === 8 ? 10 : duration, // Kling only supports 5 or 10
        aspectRatio: '16:9',
        tier: 'standard',
      });
      return {
        sceneId: scene.id,
        order: scene.order,
        videoUrl: result.videoUrl,
        durationSeconds: duration,
        provider,
      };
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('[StoryboardPipeline] scene animation failed', { sceneId: scene.id, error });
    return {
      sceneId: scene.id,
      order: scene.order,
      videoUrl: '',
      durationSeconds: 0,
      provider,
      error,
    };
  }
}

/**
 * Builds a motion-focused prompt from a storyboard scene.
 * Combines the image prompt with camera movement and visual direction.
 */
function buildSceneMotionPrompt(scene: StoryboardScene): string {
  const parts: string[] = [];

  if (scene.imagePrompt) {
    // Take the first sentence of the image prompt to avoid over-conditioning
    const shortPrompt = scene.imagePrompt.split('.')[0].trim();
    if (shortPrompt) parts.push(shortPrompt);
  }

  if (scene.cameraMove) {
    parts.push(`Camera: ${scene.cameraMove}`);
  }

  if (scene.visualDirection) {
    parts.push(scene.visualDirection);
  }

  parts.push('Cinematic, smooth motion, photorealistic');

  return parts.join('. ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline builder
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Computes a video timeline from a storyboard, fitting scenes into an
 * optional total audio duration.
 *
 * If audioDuration is provided, scene durations are proportionally
 * scaled to fill the audio exactly.
 */
export function buildStoryboardVideoTimeline(
  storyboard: StoryboardJson,
  animatedScenes: AnimatedSceneResult[],
  audioDuration?: number,
): StoryboardVideoTimeline {
  const animatedMap = new Map(animatedScenes.map((s) => [s.sceneId, s]));

  const sceneDurations = storyboard.scenes.map((scene) => {
    const animated = animatedMap.get(scene.id);
    return animated?.durationSeconds || parseDurationString(scene.duration, 5);
  });

  // Scale to audio duration if provided
  const rawTotal = sceneDurations.reduce((a, b) => a + b, 0);
  const scale = audioDuration && audioDuration > 0 ? audioDuration / rawTotal : 1;

  let cursor = 0;
  const timelineScenes = storyboard.scenes.map((scene, i) => {
    const rawDur = sceneDurations[i] ?? 5;
    const dur = Math.round(rawDur * scale * 10) / 10;
    const animated = animatedMap.get(scene.id);
    const entry = {
      sceneId: scene.id,
      order: scene.order,
      startSeconds: cursor,
      endSeconds: cursor + dur,
      durationSeconds: dur,
      videoUrl: animated?.videoUrl || null,
      imageUrl: scene.imageUrl || null,
      narration: scene.narration,
    };
    cursor += dur;
    return entry;
  });

  return {
    totalDurationSeconds: cursor,
    scenes: timelineScenes,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Full storyboard animation orchestration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Animates all scenes in a storyboard, in parallel (up to `concurrency`).
 *
 * @param storyboard - The completed storyboard with imageUrls per scene
 * @param audioUrl - Optional song audio URL for the final assembly
 * @param audioDuration - Duration of the audio clip in seconds (for timeline scaling)
 * @param provider - 'pixverse' (default if key configured) or 'kling'
 * @param projectId - For logging
 * @param concurrency - Max parallel animations (default 3; PixVerse rate limits)
 * @param onSceneComplete - Called after each scene completes (for SSE progress)
 */
export async function animateFullStoryboard(args: {
  storyboard: StoryboardJson;
  audioUrl?: string;
  audioDuration?: number;
  provider?: AnimationProvider;
  projectId: string;
  concurrency?: number;
  onSceneComplete?: (result: AnimatedSceneResult, progress: number) => void;
}): Promise<AnimateStoryboardResult> {
  const provider: AnimationProvider =
    args.provider ?? (isPixVerseAvailable() ? 'pixverse' : 'kling');

  const concurrency = args.concurrency ?? 3;
  const scenes = args.storyboard.scenes.filter((s) => s.imageUrl); // skip ungenerated

  if (scenes.length === 0) {
    throw new Error('No scenes with imageUrl — generate scene images first');
  }

  logger.info('[StoryboardPipeline] animating storyboard', {
    projectId: args.projectId,
    sceneCount: scenes.length,
    provider,
    concurrency,
  });

  const animatedScenes: AnimatedSceneResult[] = [];
  const failedScenes: string[] = [];

  // Process scenes in batches (respect concurrency limit)
  for (let i = 0; i < scenes.length; i += concurrency) {
    const batch = scenes.slice(i, i + concurrency);
    const results = await Promise.all(
      batch.map((scene) => animateStoryboardScene(scene, provider, args.projectId)),
    );

    for (const result of results) {
      if (result.error || !result.videoUrl) {
        failedScenes.push(result.sceneId);
      } else {
        animatedScenes.push(result);
      }

      const progress = Math.round(((animatedScenes.length + failedScenes.length) / scenes.length) * 100);
      args.onSceneComplete?.(result, progress);
    }
  }

  const timeline = buildStoryboardVideoTimeline(
    args.storyboard,
    animatedScenes,
    args.audioDuration,
  );

  return {
    projectId: args.projectId,
    timeline,
    animatedScenes,
    failedScenes,
    totalDurationSeconds: timeline.totalDurationSeconds,
    provider,
  };
}
