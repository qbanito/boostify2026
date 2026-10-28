import { pool } from '../db';
import type { TourProject } from '../../shared/world-tour';

// Private state stays in Postgres, behind the authenticated API; Firebase is used only for media files.
let ready: Promise<void> | undefined;
export function ensureTourStore(): Promise<void> {
  ready ??= (async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`CREATE TABLE IF NOT EXISTS world_tour_projects (
        id text PRIMARY KEY, artist_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query('CREATE INDEX IF NOT EXISTS world_tour_projects_artist_idx ON world_tour_projects(artist_id, updated_at DESC)');
      await client.query(`CREATE TABLE IF NOT EXISTS world_tour_operations (
        id text PRIMARY KEY, project_id text NOT NULL REFERENCES world_tour_projects(id) ON DELETE CASCADE,
        data jsonb NOT NULL, lease_until timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query(`CREATE INDEX IF NOT EXISTS world_tour_operations_status_idx ON world_tour_operations((data->>'status'))`);
      await client.query(`CREATE TABLE IF NOT EXISTS world_tour_references (
        id text PRIMARY KEY, artist_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        url text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query('COMMIT');
    } catch (error) { await client.query('ROLLBACK'); ready = undefined; throw error; }
    finally { client.release(); }
  })();
  return ready;
}

export async function loadTourProject(id: string): Promise<TourProject | null> {
  await ensureTourStore();
  const result = await pool.query('SELECT data FROM world_tour_projects WHERE id=$1', [id]);
  return result.rows[0]?.data || null;
}
export async function listTourProjects(artistId: number): Promise<TourProject[]> {
  await ensureTourStore();
  const result = await pool.query('SELECT data FROM world_tour_projects WHERE artist_id=$1 ORDER BY updated_at DESC LIMIT 100', [artistId]);
  return result.rows.map((row: any) => row.data);
}
export async function saveNewTourProject(project: TourProject): Promise<void> {
  await ensureTourStore();
  await pool.query('INSERT INTO world_tour_projects(id,artist_id,data) VALUES($1,$2,$3::jsonb)', [project.id, project.artistId, JSON.stringify(project)]);
}
export async function mutateTourProject<T>(id: string, action: (project: TourProject, tx: any) => Promise<T>): Promise<T> {
  await ensureTourStore();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query('SELECT data FROM world_tour_projects WHERE id=$1 FOR UPDATE', [id]);
    if (!result.rows.length) throw new Error('Tour project not found.');
    const project = result.rows[0].data as TourProject;
    const value = await action(project, client);
    project.updatedAt = new Date().toISOString();
    await client.query('UPDATE world_tour_projects SET data=$2::jsonb,updated_at=now() WHERE id=$1', [id, JSON.stringify(project)]);
    await client.query('COMMIT');
    return value;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
export async function leaseTourOperation(id: string): Promise<any | null> {
  const result = await pool.query(`UPDATE world_tour_operations SET lease_until=now()+interval '6 minutes'
    WHERE id=$1 AND lease_until<=now() AND data->>'status' NOT IN ('DONE','FAILED') RETURNING data`, [id]);
  return result.rows[0]?.data || null;
}
export async function updateTourOperation(op: any): Promise<void> {
  await pool.query('UPDATE world_tour_operations SET data=$2::jsonb WHERE id=$1', [op.id, JSON.stringify(op)]);
}
export async function existingTourOperations(ids: string[]): Promise<string[]> {
  await ensureTourStore();
  const result = await pool.query('SELECT id FROM world_tour_operations WHERE id=ANY($1::text[])', [ids]);
  return result.rows.map((row: any) => row.id);
}
export async function releaseTourOperation(id: string): Promise<void> {
  await pool.query('UPDATE world_tour_operations SET lease_until=now() WHERE id=$1', [id]);
}
export async function pendingTourOperations(): Promise<string[]> {
  await ensureTourStore();
  const result = await pool.query(`SELECT id FROM world_tour_operations WHERE data->>'status' IN ('PREPARING','QUEUED','FINALIZING','REFUND_PENDING') AND lease_until<=now() ORDER BY lease_until LIMIT 24`);
  return result.rows.map((row: any) => row.id);
}
export async function tourReferences(artistId: number): Promise<string[]> {
  await ensureTourStore();
  const result = await pool.query('SELECT url FROM world_tour_references WHERE artist_id=$1 ORDER BY created_at DESC LIMIT 6', [artistId]);
  return result.rows.map((row: any) => row.url);
}
export async function addTourReference(id: string, artistId: number, url: string): Promise<void> {
  await ensureTourStore();
  await pool.query('INSERT INTO world_tour_references(id,artist_id,url) VALUES($1,$2,$3)', [id, artistId, url]);
}
