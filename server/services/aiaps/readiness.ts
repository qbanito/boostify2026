/**
 * Readiness score calculator.
 * Aggregates completeness across identity + assets + accounts + warmup.
 */
import { pool } from './db';

export async function recomputeReadiness(artistId: string): Promise<number> {
  const [aRes, acctsRes, unsRes, emailsRes, phonesRes, warmupRes] = await Promise.all([
    pool.query('SELECT * FROM aiaps_artists WHERE id=$1', [artistId]),
    pool.query('SELECT status FROM aiaps_social_accounts WHERE artist_id=$1', [artistId]),
    pool.query('SELECT id FROM aiaps_username_candidates WHERE artist_id=$1', [artistId]),
    pool.query('SELECT status FROM aiaps_email_assets WHERE artist_id=$1', [artistId]),
    pool.query('SELECT active FROM aiaps_phone_assets WHERE artist_id=$1', [artistId]),
    pool.query('SELECT status FROM aiaps_warmup_tasks WHERE artist_id=$1', [artistId]),
  ]);
  const a = aRes.rows[0];
  if (!a) return 0;

  // Identity completeness (15%)
  const idFields = ['long_bio', 'slogan', 'tagline', 'aesthetic_keywords', 'target_markets', 'brand_voice'];
  const idDone = idFields.filter((f) => !!a[f]).length;
  const identityScore = (idDone / idFields.length) * 15;

  // Usernames (10%)
  const usernameScore = unsRes.rows.length >= 1 ? 10 : 0;

  // Emails (10%)
  const emailsOk = emailsRes.rows.filter((e) => e.status === 'verified').length;
  const emailScore = Math.min(1, emailsOk / 2) * 10;

  // Phone (10%)
  const phoneScore = phonesRes.rows.some((p) => p.active) ? 10 : 0;

  // Accounts ready (35%)
  const ready = acctsRes.rows.filter((r) =>
    ['active', 'profile_configured', 'secured', 'warming'].includes(r.status),
  ).length;
  const accountsScore = acctsRes.rows.length
    ? (ready / acctsRes.rows.length) * 35
    : 0;

  // Warm-up (20%)
  const done = warmupRes.rows.filter((w) => w.status === 'completed').length;
  const warmupScore = warmupRes.rows.length
    ? (done / warmupRes.rows.length) * 20
    : 0;

  const total = Math.round(identityScore + usernameScore + emailScore + phoneScore + accountsScore + warmupScore);

  // Update launch_status based on thresholds
  let launchStatus = a.launch_status || 'draft';
  if (total >= 95) launchStatus = 'active';
  else if (total >= 75) launchStatus = 'warming';
  else if (total >= 55) launchStatus = 'secured';
  else if (total >= 35) launchStatus = 'identity_ready';
  else launchStatus = 'draft';

  await pool.query(
    `UPDATE aiaps_artists SET readiness_score=$2, launch_status=$3, updated_at=NOW() WHERE id=$1`,
    [artistId, total, launchStatus],
  );

  return total;
}
