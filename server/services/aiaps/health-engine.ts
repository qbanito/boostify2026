/**
 * Health Engine — derives health reports from current account state
 * and open incidents, and persists them for trend tracking.
 */
import { pool } from './db';

export async function snapshotHealth(artistId?: string): Promise<number> {
  const accounts = artistId
    ? (await pool.query('SELECT * FROM aiaps_social_accounts WHERE artist_id=$1', [artistId])).rows
    : (await pool.query('SELECT * FROM aiaps_social_accounts LIMIT 500')).rows;

  let written = 0;
  for (const a of accounts) {
    const score = scoreFromStatus(a.status);
    const status = score >= 80 ? 'healthy' : score >= 50 ? 'warning' : 'risk';
    const openInc = await pool.query(
      `SELECT COUNT(*)::int AS n FROM aiaps_incidents WHERE artist_id=$1 AND platform=$2 AND status='open'`,
      [a.artist_id, a.platform],
    );
    const alerts = openInc.rows[0].n > 0 ? [{ count: openInc.rows[0].n, type: 'incidents' }] : [];
    await pool.query(
      `INSERT INTO aiaps_health_reports (artist_id, platform, health_score, status, alerts)
       VALUES ($1,$2,$3,$4,$5)`,
      [a.artist_id, a.platform, score, status, JSON.stringify(alerts)],
    );
    written++;
  }
  return written;
}

function scoreFromStatus(status: string): number {
  if (['active', 'profile_configured', 'secured'].includes(status)) return 100;
  if (['warming'].includes(status)) return 85;
  if (['verification_pending', 'otp_required'].includes(status)) return 70;
  if (['pending_signup', 'identity_ready', 'draft'].includes(status)) return 50;
  if (['restricted', 'recovery_needed'].includes(status)) return 20;
  if (['archived', 'banned'].includes(status)) return 0;
  return 50;
}

/**
 * Promote critical health issues into incidents.
 */
export async function autoCreateIncidents(): Promise<number> {
  const { rows } = await pool.query(
    `SELECT artist_id, platform, status FROM aiaps_social_accounts
     WHERE status IN ('restricted','recovery_needed','banned')`,
  );
  let created = 0;
  for (const r of rows) {
    const title = `Cuenta ${r.platform} en estado ${r.status}`;
    const exists = await pool.query(
      `SELECT id FROM aiaps_incidents WHERE artist_id=$1 AND platform=$2 AND title=$3 AND status='open' LIMIT 1`,
      [r.artist_id, r.platform, title],
    );
    if (!exists.rows.length) {
      await pool.query(
        `INSERT INTO aiaps_incidents (artist_id, platform, severity, title, status)
         VALUES ($1,$2,'critical',$3,'open')`,
        [r.artist_id, r.platform, title],
      );
      created++;
    }
  }
  return created;
}
