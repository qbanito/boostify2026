/**
 * Migration: create lyrics_video_jobs table
 * Run: node add-lyrics-video-table.mjs
 */
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const sql = `
CREATE TABLE IF NOT EXISTS lyrics_video_jobs (
  id               SERIAL PRIMARY KEY,
  artist_id        INTEGER NOT NULL,
  song_id          INTEGER,
  firestore_song_id TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  progress         INTEGER DEFAULT 0,
  segments_json    JSONB,
  words_json       JSONB,
  input_props_json JSONB,
  output_url       TEXT,
  youtube_url      TEXT,
  error_msg        TEXT,
  duration_secs    NUMERIC(10,2),
  theme            TEXT DEFAULT 'dark',
  accent_color     TEXT DEFAULT '#7c3aed',
  font_family      TEXT DEFAULT 'Inter',
  song_title       TEXT,
  artist_name      TEXT,
  cover_art_url    TEXT,
  audio_url        TEXT,
  created_at       TIMESTAMP DEFAULT NOW(),
  updated_at       TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lvj_artist ON lyrics_video_jobs(artist_id);
CREATE INDEX IF NOT EXISTS idx_lvj_status  ON lyrics_video_jobs(status);
`;

try {
  await pool.query(sql);
  console.log('✅ lyrics_video_jobs table created successfully');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
} finally {
  await pool.end();
}
