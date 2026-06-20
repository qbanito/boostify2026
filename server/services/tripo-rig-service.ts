/**
 * Tripo3D auto-rigging service
 * ----------------------------
 * Adds a skeleton (armature) + skinning to a humanoid character so it can play
 * FBX/GLB animations — an API-driven alternative to the manual Mixamo upload.
 *
 * Tripo's rigging pipeline only operates on models that were generated *inside*
 * Tripo (referenced by a `task_id`), and it does not accept an arbitrary external
 * GLB URL. So we feed Tripo the same clean A/T-pose image we already produce for
 * the FAL Hunyuan mesh, and let Tripo build its own riggable mesh from it:
 *
 *   image_to_model  →  animate_rig  →  (optional) animate_retarget
 *
 * Two output modes:
 *   • "animate"  — spec="tripo" rig, then retarget to a preset animation
 *                  (idle/walk/run/…). Returns a baked, ready-to-play animated GLB.
 *   • "rig"      — spec="mixamo" rig. Returns a Mixamo-compatible skeleton so the
 *                  artist can drop in any Mixamo clip (or our retarget catalog).
 *     NOTE: Tripo only supports retargeting on its own ("tripo") skeleton, so the
 *           preset animations are NOT available for the Mixamo-spec output.
 *
 * Docs: https://platform.tripo3d.ai/docs/animation
 */

import axios from 'axios';

const TRIPO_API_KEY = process.env.TRIPO_API_KEY || '';
const TRIPO_BASE = 'https://api.tripo3d.ai/v2/openapi';

/** Preset animations available via Tripo retarget (spec="tripo" rig only). */
export const TRIPO_PRESET_ANIMATIONS = [
  'preset:idle',
  'preset:walk',
  'preset:run',
  'preset:jump',
  'preset:dive',
  'preset:climb',
  'preset:slash',
  'preset:shoot',
  'preset:hurt',
  'preset:fall',
  'preset:turn',
] as const;

export type TripoPresetAnimation = (typeof TRIPO_PRESET_ANIMATIONS)[number];

export function isTripoConfigured(): boolean {
  return !!TRIPO_API_KEY;
}

interface TripoTaskOutput {
  model?: string;
  base_model?: string;
  pbr_model?: string;
  rendered_image?: string;
  [k: string]: unknown;
}

function authHeaders(json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${TRIPO_API_KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

/** Create a Tripo task and return its task_id. */
async function createTask(body: Record<string, unknown>): Promise<string> {
  const res = await axios.post(`${TRIPO_BASE}/task`, body, {
    headers: authHeaders(),
    timeout: 60_000,
  });
  if (res.data?.code !== 0 || !res.data?.data?.task_id) {
    throw new Error(`Tripo task create failed (${body.type}): ${res.data?.message || 'no task_id'}`);
  }
  return res.data.data.task_id as string;
}

/** Poll a Tripo task until it reaches a finalized status. Returns the output. */
async function pollTask(taskId: string, maxWaitMs = 300_000): Promise<TripoTaskOutput> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 4000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 12_000);

    const res = await axios.get(`${TRIPO_BASE}/task/${taskId}`, {
      headers: authHeaders(false),
      timeout: 30_000,
    });
    if (res.data?.code !== 0) {
      throw new Error(`Tripo poll error: ${res.data?.message || res.data?.code}`);
    }
    const status = res.data?.data?.status as string;
    if (status === 'success') {
      return (res.data?.data?.output ?? {}) as TripoTaskOutput;
    }
    if (status === 'failed' || status === 'banned' || status === 'expired' || status === 'cancelled' || status === 'unknown') {
      throw new Error(`Tripo task ${taskId} ${status}`);
    }
    // queued / running → keep polling
  }
  throw new Error(`Tripo task ${taskId} timed out`);
}

export interface AutoRigResult {
  /** Animated, ready-to-play GLB (only present in "animate" mode). */
  animatedUrl: string | null;
  /** Rigged GLB (bind pose). Present in both modes. */
  riggedUrl: string | null;
  format: 'glb' | 'fbx';
  mode: 'animate' | 'rig';
  /** "mixamo" | "tripo" — the skeleton naming convention of the rigged output. */
  skeleton: 'mixamo' | 'tripo';
  animation: string | null;
  modelTaskId: string;
  rigTaskId: string;
  retargetTaskId?: string;
}

export interface AutoRigOptions {
  /** Public URL of the clean A/T-pose image (best rig input). */
  imageUrl: string;
  /**
   * A Tripo preset animation (e.g. "preset:idle"). When provided, the model is
   * rigged with the Tripo skeleton and retargeted to this animation, producing a
   * baked animated GLB. When omitted/"none", the model is rigged with a
   * Mixamo-compatible skeleton (no baked animation).
   */
  animation?: string | null;
  outFormat?: 'glb' | 'fbx';
  /** Hard cap for each individual Tripo stage. */
  stageTimeoutMs?: number;
  onStage?: (stage: 'model' | 'rig' | 'retarget', taskId: string) => void;
}

/**
 * Full Tripo auto-rig pipeline from a pose image.
 * Returns the (temporary, ~minutes-expiring) Tripo download URLs — the caller is
 * responsible for downloading + persisting them immediately.
 */
export async function autoRigFromImage(opts: AutoRigOptions): Promise<AutoRigResult> {
  if (!isTripoConfigured()) {
    throw new Error('TRIPO_API_KEY not configured');
  }
  const { imageUrl } = opts;
  if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) {
    throw new Error('A valid public image URL is required for auto-rigging');
  }

  const outFormat = opts.outFormat ?? 'glb';
  const stageTimeout = opts.stageTimeoutMs ?? 300_000;
  const animate = !!opts.animation && opts.animation !== 'none';
  const animation = animate ? (opts.animation as string) : null;
  // Retarget presets only work on Tripo's own skeleton; Mixamo-compat rig is used
  // when no preset animation is requested.
  const skeleton: 'mixamo' | 'tripo' = animate ? 'tripo' : 'mixamo';

  const ext = imageUrl.split('?')[0].toLowerCase();
  const fileType = ext.endsWith('.png') ? 'png' : ext.endsWith('.webp') ? 'webp' : 'jpg';

  // ── Stage 1: image → riggable textured mesh ──
  const modelTaskId = await createTask({
    type: 'image_to_model',
    model_version: 'v3.1-20260211',
    file: { type: fileType, url: imageUrl },
    texture: true,
    pbr: true,
    orientation: 'align_image',
  });
  opts.onStage?.('model', modelTaskId);
  await pollTask(modelTaskId, stageTimeout);

  // ── Stage 2: rig (add skeleton + skinning) ──
  const rigTaskId = await createTask({
    type: 'animate_rig',
    original_model_task_id: modelTaskId,
    out_format: outFormat,
    spec: skeleton,
  });
  opts.onStage?.('rig', rigTaskId);
  const rigOut = await pollTask(rigTaskId, stageTimeout);
  const riggedUrl = (rigOut.model || rigOut.pbr_model || null) as string | null;

  // ── Stage 3 (optional): retarget to a preset animation ──
  let animatedUrl: string | null = null;
  let retargetTaskId: string | undefined;
  if (animate) {
    retargetTaskId = await createTask({
      type: 'animate_retarget',
      original_model_task_id: rigTaskId,
      out_format: outFormat,
      bake_animation: true,
      animation,
    });
    opts.onStage?.('retarget', retargetTaskId);
    const animOut = await pollTask(retargetTaskId, stageTimeout);
    animatedUrl = (animOut.model || animOut.pbr_model || null) as string | null;
  }

  return {
    animatedUrl,
    riggedUrl,
    format: outFormat,
    mode: animate ? 'animate' : 'rig',
    skeleton,
    animation,
    modelTaskId,
    rigTaskId,
    retargetTaskId,
  };
}
