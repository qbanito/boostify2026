/**
 * Meshy text-to-3D props service
 * ------------------------------
 * Genera elementos 3D decorativos (props) para la boutique virtual del artista
 * usando la API text-to-3D de Meshy: candelabros, esculturas, etc. Pipeline en
 * dos etapas (preview → refine) para obtener un GLB texturizado PBR.
 *
 *   POST /openapi/v2/text-to-3d { mode:'preview', prompt, ... } → { result: taskId }
 *   POST /openapi/v2/text-to-3d { mode:'refine', preview_task_id } → { result: taskId }
 *   GET  /openapi/v2/text-to-3d/:id → status + model_urls
 *
 * IMPORTANTE: las URLs que devuelve Meshy EXPIRAN — el caller debe descargar y
 * persistir el GLB inmediatamente.
 *
 * Docs: https://docs.meshy.ai/en/api/text-to-3d
 */

import axios from 'axios';

const MESHY_API_KEY = process.env.MESHY_API_KEY || '';
const MESHY_T23D = 'https://api.meshy.ai/openapi/v2/text-to-3d';

export function isMeshyPropsConfigured(): boolean {
  return !!MESHY_API_KEY;
}

function authHeaders(json = true): Record<string, string> {
  return {
    Authorization: `Bearer ${MESHY_API_KEY}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

interface MeshyT23DTask {
  status?: string;
  model_urls?: { glb?: string; fbx?: string; obj?: string; usdz?: string };
  thumbnail_url?: string;
  task_error?: { message?: string };
}

async function createT23DTask(body: Record<string, unknown>): Promise<string> {
  const res = await axios.post(MESHY_T23D, body, { headers: authHeaders(), timeout: 60_000 });
  const taskId = res.data?.result;
  if (!taskId) throw new Error(`Meshy text-to-3d create failed: ${res.data?.message || 'no task id'}`);
  return taskId as string;
}

// La cola pública de Meshy puede tardar bastante en arrancar un task — timeout amplio.
async function pollT23DTask(taskId: string, maxWaitMs = 1_500_000): Promise<MeshyT23DTask> {
  const deadline = Date.now() + maxWaitMs;
  let delay = 5000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.35, 15_000);
    const res = await axios.get(`${MESHY_T23D}/${taskId}`, { headers: authHeaders(false), timeout: 30_000 });
    const status = res.data?.status as string;
    if (status === 'SUCCEEDED') return res.data as MeshyT23DTask;
    if (status === 'FAILED' || status === 'CANCELED') {
      throw new Error(`Meshy task ${taskId} ${status}: ${res.data?.task_error?.message || ''}`.trim());
    }
    // PENDING / IN_PROGRESS → seguir
  }
  throw new Error(`Meshy text-to-3d task ${taskId} timed out`);
}

export interface MeshyPropResult {
  /** GLB texturizado (URL TEMPORAL de Meshy — descargar ya). */
  glbUrl: string;
  thumbnailUrl: string | null;
  previewTaskId: string;
  refineTaskId: string;
}

/**
 * Genera un prop 3D texturizado a partir de un prompt de texto.
 * preview (geometría) → refine (texturas PBR). Tarda ~3-6 min en total.
 */
export async function generatePropModel(opts: {
  prompt: string;
  onStage?: (stage: 'preview' | 'refine', taskId: string) => void;
}): Promise<MeshyPropResult> {
  if (!isMeshyPropsConfigured()) throw new Error('MESHY_API_KEY not configured');

  const previewTaskId = await createT23DTask({
    mode: 'preview',
    prompt: opts.prompt.slice(0, 600),
    art_style: 'realistic',
    should_remesh: true,
    topology: 'triangle',
    target_polycount: 30_000,
  });
  opts.onStage?.('preview', previewTaskId);
  await pollT23DTask(previewTaskId);

  const refineTaskId = await createT23DTask({
    mode: 'refine',
    preview_task_id: previewTaskId,
    enable_pbr: true,
  });
  opts.onStage?.('refine', refineTaskId);
  const refined = await pollT23DTask(refineTaskId);

  const glbUrl = refined.model_urls?.glb;
  if (!glbUrl) throw new Error('Meshy refine returned no GLB url');

  return {
    glbUrl,
    thumbnailUrl: refined.thumbnail_url || null,
    previewTaskId,
    refineTaskId,
  };
}
