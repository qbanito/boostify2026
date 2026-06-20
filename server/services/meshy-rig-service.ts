/**
 * Meshy auto-rigging service
 * --------------------------
 * Adds a skeleton (armature) + skinning to an EXISTING humanoid GLB so it can play
 * animations — without regenerating the mesh.
 *
 * Unlike Tripo (which only rigs models created inside Tripo via a task_id), Meshy's
 * Rigging API accepts a public `model_url` directly, so we can hand it the GLB we
 * already generated + stored (FAL Hunyuan) and get back a rigged character plus
 * basic walking/running animations.
 *
 *   POST /openapi/v1/rigging   { model_url, height_meters }  → { result: taskId }
 *   GET  /openapi/v1/rigging/:id                              → status + result urls
 *
 * Requirements (from Meshy docs):
 *   • Textured humanoid .glb, < 300,000 faces.
 *   • The character's face must point toward +Z (standard glTF forward).
 *
 * Docs: https://docs.meshy.ai/en/api/rigging
 */

import axios from 'axios';

const MESHY_API_KEY = process.env.MESHY_API_KEY || '';
const MESHY_BASE = 'https://api.meshy.ai/openapi/v1';

export function isMeshyConfigured(): boolean {
  return !!MESHY_API_KEY;
}

function authHeaders(json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${MESHY_API_KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

interface MeshyRiggingResult {
  rigged_character_glb_url?: string;
  rigged_character_fbx_url?: string;
  basic_animations?: {
    walking_glb_url?: string;
    walking_fbx_url?: string;
    running_glb_url?: string;
    running_fbx_url?: string;
    [k: string]: unknown;
  };
  [k: string]: unknown;
}

/** Create a Meshy rigging task from a public GLB url. Returns the task id. */
async function createRiggingTask(modelUrl: string, heightMeters: number): Promise<string> {
  const res = await axios.post(
    `${MESHY_BASE}/rigging`,
    { model_url: modelUrl, height_meters: heightMeters },
    { headers: authHeaders(), timeout: 60_000 },
  );
  const taskId = res.data?.result;
  if (!taskId) {
    throw new Error(`Meshy rigging create failed: ${res.data?.message || 'no task id'}`);
  }
  return taskId as string;
}

/** Poll a Meshy rigging task until it finalizes. Returns the result object. */
async function pollRiggingTask(taskId: string, maxWaitMs = 300_000): Promise<MeshyRiggingResult> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 4000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 12_000);

    const res = await axios.get(`${MESHY_BASE}/rigging/${taskId}`, {
      headers: authHeaders(false),
      timeout: 30_000,
    });
    const status = res.data?.status as string;
    if (status === 'SUCCEEDED') {
      return (res.data?.result ?? {}) as MeshyRiggingResult;
    }
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Meshy rigging task ${taskId} ${status}: ${res.data?.task_error?.message || ''}`.trim());
    }
    // PENDING / IN_PROGRESS → keep polling
  }
  throw new Error(`Meshy rigging task ${taskId} timed out`);
}

export interface MeshyRigResult {
  /** Rigged GLB (bind pose) — Mixamo-compatible skeleton. */
  riggedGlbUrl: string | null;
  riggedFbxUrl: string | null;
  /** Baked walking animation GLB (with skin), when Meshy returns one. */
  walkingGlbUrl: string | null;
  /** Baked running animation GLB (with skin), when Meshy returns one. */
  runningGlbUrl: string | null;
  taskId: string;
}

export interface MeshyRigOptions {
  /** Public URL of the textured humanoid GLB to rig. */
  modelUrl: string;
  /** Approx character height in meters (scaling/rigging accuracy). */
  heightMeters?: number;
  stageTimeoutMs?: number;
  onStage?: (stage: 'rig', taskId: string) => void;
}

/**
 * Rig an existing GLB via Meshy. Returns Meshy's (temporary, expiring) download
 * URLs — the caller must download + persist them immediately.
 */
export async function rigExistingModel(opts: MeshyRigOptions): Promise<MeshyRigResult> {
  if (!isMeshyConfigured()) {
    throw new Error('MESHY_API_KEY not configured');
  }
  const { modelUrl } = opts;
  if (!modelUrl || !/^https?:\/\//i.test(modelUrl)) {
    throw new Error('A valid public GLB URL is required for Meshy rigging');
  }
  if (!/\.glb(\?.*)?$/i.test(modelUrl.split('?')[0]) && !modelUrl.includes('.glb')) {
    throw new Error('Meshy rigging only supports .glb models');
  }

  const heightMeters = opts.heightMeters ?? 1.7;
  const stageTimeout = opts.stageTimeoutMs ?? 300_000;

  const taskId = await createRiggingTask(modelUrl, heightMeters);
  opts.onStage?.('rig', taskId);
  const result = await pollRiggingTask(taskId, stageTimeout);

  return {
    riggedGlbUrl: result.rigged_character_glb_url ?? null,
    riggedFbxUrl: result.rigged_character_fbx_url ?? null,
    walkingGlbUrl: result.basic_animations?.walking_glb_url ?? null,
    runningGlbUrl: result.basic_animations?.running_glb_url ?? null,
    taskId,
  };
}
