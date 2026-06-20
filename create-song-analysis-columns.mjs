// Add audio-analysis columns to the songs table.
// Run: node create-song-analysis-columns.mjs
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analysis_json   JSONB;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analysis_status TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analysis_error  TEXT;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS analyzed_at     TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_songs_analysis_status ON songs(analysis_status);
`;

try {
  console.log('🛠  Adding analysis_json / analysis_status columns to songs...');
  await pool.query(SQL);
  console.log('✅ songs analysis columns ready.');
} catch (err) {
  console.error('❌ Failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
