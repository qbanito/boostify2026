/**
 * Adds songs.firestore_id column + unique index for the lazy Firestore→Postgres
 * promotion sync. Idempotent: safe to run multiple times.
 */
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  try {
    console.log('▶ Adding songs.firestore_id column (if not exists)...');
    await pool.query(`ALTER TABLE songs ADD COLUMN IF NOT EXISTS firestore_id TEXT;`);
    console.log('▶ Creating unique index on songs.firestore_id (if not exists)...');
    await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS songs_firestore_id_unique ON songs (firestore_id);`);
    console.log('✅ Done.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
