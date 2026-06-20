// Apply artist_epks table directly. Idempotent: uses IF NOT EXISTS.
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

const sql = `
CREATE TABLE IF NOT EXISTS artist_epks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  epk_data JSONB NOT NULL,
  master_snapshot JSONB,
  version INTEGER DEFAULT 1,
  generated_at TIMESTAMP DEFAULT NOW(),
  last_viewed_at TIMESTAMP,
  views INTEGER DEFAULT 0,
  is_public BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS artist_epks_user_id_idx ON artist_epks(user_id);
CREATE INDEX IF NOT EXISTS artist_epks_slug_idx ON artist_epks(slug);
`;

(async () => {
  try {
    await pool.query(sql);
    console.log('✅ artist_epks table created (or already existed).');
  } catch (e) {
    console.error('❌ Failed to apply artist_epks table:', e);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
