// Adds storyboard + client brief fields to video_concept_projects.
// Idempotent: safe to run multiple times.
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function run() {
  console.log('🛠  Adding storyboard + client brief fields to video_concept_projects…');
  await pool.query(`
    ALTER TABLE video_concept_projects
      ADD COLUMN IF NOT EXISTS client_brief_details   jsonb,
      ADD COLUMN IF NOT EXISTS storyboard_json        jsonb,
      ADD COLUMN IF NOT EXISTS storyboard_status      text DEFAULT 'not_started',
      ADD COLUMN IF NOT EXISTS storyboard_updated_at  timestamp;
  `);
  console.log('✅ video_concept_projects storyboard fields ready.');
}

run()
  .catch((err) => { console.error('❌', err); process.exitCode = 1; })
  .finally(() => pool.end());
