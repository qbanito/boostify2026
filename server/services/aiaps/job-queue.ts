/**
 * AIAPS Job Queue — bridges the admin dashboard to workers
 * (Chrome extension, Playwright, human operators).
 *
 * Model: claim → execute → report. Any authenticated worker polls
 * GET /jobs/claim?worker_id=... and posts back to /jobs/:id/report.
 *
 * Stored in `aiaps_jobs`. Lifecycle:
 *   queued → claimed → running → succeeded | failed
 * Timeouts: jobs claimed >15m without report auto-release.
 */
import { pool } from './db';

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS aiaps_jobs (
      id SERIAL PRIMARY KEY,
      kind VARCHAR(64) NOT NULL,
      platform VARCHAR(32),
      artist_id VARCHAR(64),
      account_id INTEGER,
      payload JSONB,
      status VARCHAR(24) DEFAULT 'queued',
      priority INTEGER DEFAULT 5,
      worker_id VARCHAR(128),
      attempts INTEGER DEFAULT 0,
      max_attempts INTEGER DEFAULT 3,
      result JSONB,
      error TEXT,
      claimed_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_status ON aiaps_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_kind ON aiaps_jobs(kind);
    CREATE INDEX IF NOT EXISTS idx_aiaps_jobs_artist ON aiaps_jobs(artist_id);
  `);
  ensured = true;
}

export type JobKind =
  | 'signup'
  | 'verify'
  | 'configure_profile'
  | 'warmup_action'
  | 'health_check'
  | 'post';

export interface EnqueueOptions {
  kind: JobKind;
  platform?: string;
  artistId?: string;
  accountId?: number;
  payload?: Record<string, any>;
  priority?: number;
  maxAttempts?: number;
}

export async function enqueueJob(opts: EnqueueOptions): Promise<number> {
  await ensureTable();
  const { rows } = await pool.query(
    `INSERT INTO aiaps_jobs (kind, platform, artist_id, account_id, payload, priority, max_attempts)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [
      opts.kind,
      opts.platform || null,
      opts.artistId || null,
      opts.accountId || null,
      opts.payload ? JSON.stringify(opts.payload) : null,
      opts.priority ?? 5,
      opts.maxAttempts ?? 3,
    ],
  );
  return rows[0].id;
}

export async function claimJob(
  workerId: string,
  filter: { kinds?: JobKind[]; platforms?: string[] } = {},
): Promise<any | null> {
  await ensureTable();
  await releaseStale();

  const conds: string[] = [`status='queued'`];
  const params: any[] = [];
  if (filter.kinds?.length) {
    params.push(filter.kinds);
    conds.push(`kind = ANY($${params.length}::text[])`);
  }
  if (filter.platforms?.length) {
    params.push(filter.platforms);
    conds.push(`platform = ANY($${params.length}::text[])`);
  }
  params.push(workerId);
  const workerParam = `$${params.length}`;

  const sql = `
    UPDATE aiaps_jobs SET
      status='claimed',
      worker_id=${workerParam},
      attempts=attempts+1,
      claimed_at=NOW(),
      updated_at=NOW()
    WHERE id = (
      SELECT id FROM aiaps_jobs
       WHERE ${conds.join(' AND ')}
       ORDER BY priority DESC, id ASC
       FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *`;
  const { rows } = await pool.query(sql, params);
  return rows[0] || null;
}

export async function reportJob(
  jobId: number,
  workerId: string,
  result: { ok: boolean; data?: any; error?: string },
): Promise<boolean> {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT max_attempts, attempts FROM aiaps_jobs WHERE id=$1 AND worker_id=$2`,
    [jobId, workerId],
  );
  if (!rows.length) return false;

  const nextStatus = result.ok
    ? 'succeeded'
    : rows[0].attempts >= rows[0].max_attempts
      ? 'failed'
      : 'queued';

  await pool.query(
    `UPDATE aiaps_jobs SET
       status=$2,
       result=$3,
       error=$4,
       completed_at=CASE WHEN $2 IN ('succeeded','failed') THEN NOW() ELSE completed_at END,
       worker_id=CASE WHEN $2='queued' THEN NULL ELSE worker_id END,
       claimed_at=CASE WHEN $2='queued' THEN NULL ELSE claimed_at END,
       updated_at=NOW()
     WHERE id=$1`,
    [jobId, nextStatus, result.data ? JSON.stringify(result.data) : null, result.error || null],
  );
  return true;
}

async function releaseStale(): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE aiaps_jobs
        SET status='queued', worker_id=NULL, claimed_at=NULL, updated_at=NOW()
      WHERE status='claimed' AND claimed_at < NOW() - INTERVAL '15 minutes'`,
  );
  return rowCount || 0;
}

export async function listJobs(filter: { status?: string; kind?: string; limit?: number } = {}): Promise<any[]> {
  await ensureTable();
  const where: string[] = [];
  const params: any[] = [];
  if (filter.status) { params.push(filter.status); where.push(`status=$${params.length}`); }
  if (filter.kind) { params.push(filter.kind); where.push(`kind=$${params.length}`); }
  params.push(filter.limit ?? 100);
  const sql = `SELECT * FROM aiaps_jobs ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY id DESC LIMIT $${params.length}`;
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function jobStats(): Promise<Record<string, number>> {
  await ensureTable();
  const { rows } = await pool.query(
    `SELECT status, COUNT(*)::int AS n FROM aiaps_jobs GROUP BY status`,
  );
  const out: Record<string, number> = { queued: 0, claimed: 0, succeeded: 0, failed: 0 };
  for (const r of rows) out[r.status] = r.n;
  return out;
}
