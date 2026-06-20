/**
 * Warm-up Engine — generates and schedules warm-up tasks per phase/platform.
 *
 * Phases (per platform):
 *   1 → Foundation: profile complete + first 1 post + follow 20 curated accounts.
 *   2 → Light activity: 2-3 posts/week + organic likes.
 *   3 → Content expansion: Reels / short-form + contextual comments.
 *   4 → Collabs: mentions + duets / reposts with allied accounts.
 *   5 → Growth: ads + viral formats + UGC campaigns.
 */
import { pool } from './db';
import { recomputeReadiness } from './readiness';

interface TaskTemplate {
  action: string;
  priority: 'low' | 'normal' | 'high';
  risk: 'low' | 'medium' | 'high';
}

const TEMPLATES: Record<number, TaskTemplate[]> = {
  1: [
    { action: 'Completar perfil (bio + avatar + banner)', priority: 'high', risk: 'low' },
    { action: 'Primera publicación', priority: 'high', risk: 'low' },
    { action: 'Seguir 20 cuentas curadas', priority: 'normal', risk: 'low' },
  ],
  2: [
    { action: 'Publicaciones iniciales (3/semana)', priority: 'normal', risk: 'low' },
    { action: 'Seguimiento ligero', priority: 'normal', risk: 'low' },
    { action: 'Interacción mínima (likes orgánicos)', priority: 'normal', risk: 'low' },
    { action: 'Contenido temático', priority: 'normal', risk: 'low' },
    { action: 'Colaboraciones internas', priority: 'normal', risk: 'low' },
  ],
  3: [
    { action: 'Reels / short-form (2/semana)', priority: 'normal', risk: 'medium' },
    { action: 'Comentarios contextuales en cuentas afines', priority: 'normal', risk: 'medium' },
    { action: 'Historias diarias', priority: 'normal', risk: 'low' },
  ],
  4: [
    { action: 'Duetos / reposts con aliados', priority: 'high', risk: 'medium' },
    { action: 'Menciones cruzadas', priority: 'normal', risk: 'medium' },
  ],
  5: [
    { action: 'Lanzar campaña de ads', priority: 'high', risk: 'low' },
    { action: 'Formato viral / UGC', priority: 'high', risk: 'medium' },
  ],
};

export async function generateWarmupTasks(
  artistId: string,
  platform: string,
  phase: number,
): Promise<number> {
  const tpls = TEMPLATES[phase] || [];
  let inserted = 0;
  const now = Date.now();
  for (let i = 0; i < tpls.length; i++) {
    const t = tpls[i];
    const scheduledAt = new Date(now + i * 6 * 3600 * 1000); // 6h apart
    try {
      await pool.query(
        `INSERT INTO aiaps_warmup_tasks (artist_id, platform, phase, action, priority, risk, scheduled_at, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')`,
        [artistId, platform, phase, t.action, t.priority, t.risk, scheduledAt],
      );
      inserted++;
    } catch {
      /* ignore */
    }
  }
  await recomputeReadiness(artistId);
  return inserted;
}

export async function advanceTask(
  taskId: number,
  status: 'in_progress' | 'completed' | 'failed',
  result?: Record<string, any>,
): Promise<void> {
  await pool.query(
    `UPDATE aiaps_warmup_tasks
       SET status = $2,
           completed_at = CASE WHEN $2 IN ('completed','failed') THEN NOW() ELSE completed_at END,
           result = COALESCE($3, result)
     WHERE id = $1`,
    [taskId, status, result ? JSON.stringify(result) : null],
  );
  const { rows } = await pool.query('SELECT artist_id FROM aiaps_warmup_tasks WHERE id=$1', [taskId]);
  if (rows[0]?.artist_id) await recomputeReadiness(rows[0].artist_id);
}
