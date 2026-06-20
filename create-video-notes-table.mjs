// Create video_notes table in Postgres if it doesn't exist.
// Run: node create-video-notes-table.mjs
import pg from 'pg';
import 'dotenv/config';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
CREATE TABLE IF NOT EXISTS video_notes (
  id             SERIAL PRIMARY KEY,
  video_id       TEXT NOT NULL,
  owner_user_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  user_id        INTEGER REFERENCES users(id) ON DELETE CASCADE,
  guest_name     TEXT,
  timecode_ms    INTEGER NOT NULL,
  end_timecode_ms INTEGER,
  text           TEXT NOT NULL,
  color          TEXT,
  is_private     BOOLEAN NOT NULL DEFAULT FALSE,
  is_pinned      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Migrations (safe to re-run):
ALTER TABLE video_notes ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE video_notes ADD COLUMN IF NOT EXISTS guest_name TEXT;

CREATE INDEX IF NOT EXISTS idx_video_notes_video ON video_notes(video_id, timecode_ms);
CREATE INDEX IF NOT EXISTS idx_video_notes_user  ON video_notes(user_id);
`;

try {
  console.log('🛠  Creating video_notes table (if not exists)...');
  await pool.query(SQL);
  console.log('✅ video_notes table ready.');
} catch (err) {
  console.error('❌ Failed:', err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
