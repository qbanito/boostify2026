/**
 * Migration: Claim Loop
 *
 * Adds the columns needed for the reverse-onboarding "claim your profile" loop:
 * - users.claimed_at    → NULL = unclaimed pre-built AI profile waiting for its owner
 * - users.claim_source  → how it was claimed ('magic_link' | 'profile_banner' | 'email')
 *
 * The activation_events.event_type column is plain TEXT (Drizzle enum is a
 * TS-only constraint) so the new 'claim_viewed' / 'profile_claimed' values
 * require no DB change.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS claimed_at   TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS claim_source TEXT
    `);

    // Speeds up "unclaimed AI profiles" lookups used by the funnel dashboard.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_unclaimed
        ON users (is_ai_generated, claimed_at)
    `);

    await client.query('COMMIT');

    const { rows } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_ai_generated AND claimed_at IS NULL)  AS unclaimed_ai,
        COUNT(*) FILTER (WHERE claimed_at IS NOT NULL)                  AS claimed,
        COUNT(*)                                                        AS total
      FROM users
    `);
    console.log('✅ Claim Loop columns ready.');
    console.table(rows);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
