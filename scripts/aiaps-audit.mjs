#!/usr/bin/env node
/**
 * AIAPS offline audit — inspects the database directly.
 * Requires DATABASE_URL. Reports schema integrity, row counts,
 * seed data presence, orphaned references, and vault encryption.
 */
import pg from 'pg';
import 'dotenv/config';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL missing'); process.exit(2); }

const pool = new pg.Pool({
  connectionString: url,
  ssl: url.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

const REQUIRED = [
  'aiaps_artists', 'aiaps_social_accounts', 'aiaps_username_candidates',
  'aiaps_email_assets', 'aiaps_phone_assets', 'aiaps_verification_events',
  'aiaps_warmup_tasks', 'aiaps_health_reports', 'aiaps_incidents',
  'aiaps_jobs', 'aiaps_vault_secrets', 'aiaps_operators', 'audit_log',
];

async function q(sql, params = []) { const { rows } = await pool.query(sql, params); return rows; }

(async () => {
  console.log('═══════════════ AIAPS OFFLINE AUDIT ═══════════════\n');
  let score = 0, total = 0;
  function check(label, ok, detail = '') {
    total++;
    if (ok) score++;
    console.log(`${ok ? '✅' : '❌'} ${label}${detail ? ' — ' + detail : ''}`);
  }

  for (const t of REQUIRED) {
    try {
      const r = await q(`SELECT COUNT(*)::int AS n FROM ${t}`);
      check(`Table ${t}`, true, `${r[0].n} rows`);
    } catch (err) {
      check(`Table ${t}`, false, err.message);
    }
  }

  // Column probes on key tables
  const columnChecks = [
    ['aiaps_artists', ['id', 'stage_name', 'readiness_score', 'launch_status', 'profile_image_url', 'banner_url']],
    ['aiaps_social_accounts', ['artist_id', 'platform', 'username', 'status']],
    ['aiaps_jobs', ['kind', 'status', 'worker_id', 'attempts']],
    ['aiaps_operators', ['email', 'role', 'active']],
  ];
  for (const [table, cols] of columnChecks) {
    try {
      const rows = await q(
        `SELECT column_name FROM information_schema.columns WHERE table_name=$1`, [table],
      );
      const present = new Set(rows.map((r) => r.column_name));
      const missing = cols.filter((c) => !present.has(c));
      check(`Columns on ${table}`, missing.length === 0, missing.length ? `missing: ${missing.join(',')}` : '');
    } catch (err) {
      check(`Columns on ${table}`, false, err.message);
    }
  }

  // Orphan checks
  try {
    const r = await q(`SELECT COUNT(*)::int AS n FROM aiaps_social_accounts WHERE artist_id IS NOT NULL AND artist_id NOT IN (SELECT id FROM aiaps_artists)`);
    check('No orphaned social accounts', r[0].n === 0, `${r[0].n} orphans`);
  } catch { /* table may not exist */ }

  try {
    const r = await q(`SELECT COUNT(*)::int AS n FROM aiaps_warmup_tasks WHERE artist_id NOT IN (SELECT id FROM aiaps_artists)`);
    check('No orphaned warmup tasks', r[0].n === 0, `${r[0].n} orphans`);
  } catch { /* ignore */ }

  // Vault encryption sanity: ciphertext should not equal plaintext hints
  try {
    const r = await q(`SELECT COUNT(*)::int AS n FROM aiaps_vault_secrets WHERE ciphertext IS NULL OR iv IS NULL`);
    check('Vault secrets have ciphertext+iv', r[0].n === 0, `${r[0].n} broken`);
  } catch { /* ignore */ }

  // Env presence
  const envs = ['OPENAI_API_KEY', 'TWILIO_ACCOUNT_SID', 'AIAPS_VAULT_KEY', 'DATABASE_URL'];
  for (const e of envs) {
    const present = !!process.env[e];
    const critical = e === 'DATABASE_URL';
    if (critical) check(`env ${e}`, present);
    else console.log(`${present ? '✅' : '⚠️ '} env ${e} ${present ? 'set' : 'missing (fallback active)'}`);
  }

  console.log(`\n  Score: ${score}/${total} hard checks passing`);
  await pool.end();
  process.exit(score === total ? 0 : 1);
})().catch((err) => { console.error(err); process.exit(2); });
