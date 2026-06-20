import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  console.log('[migration] Adding hero video + artist link columns to cinematic_event_landings...');
  await pool.query(`
    ALTER TABLE cinematic_event_landings
      ADD COLUMN IF NOT EXISTS hero_video_url TEXT,
      ADD COLUMN IF NOT EXISTS hero_media_type TEXT DEFAULT 'image',
      ADD COLUMN IF NOT EXISTS linked_artist_id INTEGER,
      ADD COLUMN IF NOT EXISTS linked_artist_slug TEXT;
  `);
  console.log('[migration] Done.');
  await pool.end();
}

run().catch((err) => {
  console.error('[migration] Failed:', err);
  process.exit(1);
});
