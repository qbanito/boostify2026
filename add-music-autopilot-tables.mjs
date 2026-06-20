import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🤖 Creating music auto-pilot tables...');

await pool.query(`
  CREATE TABLE IF NOT EXISTS music_auto_schedules (
    id                 SERIAL PRIMARY KEY,
    user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    cadence            TEXT NOT NULL DEFAULT 'weekly'
                       CHECK (cadence IN ('daily', 'weekly', 'biweekly', 'monthly')),
    release_type       TEXT NOT NULL DEFAULT 'single'
                       CHECK (release_type IN ('single', 'ep', 'album')),
    songs_per_run      INTEGER NOT NULL DEFAULT 1,
    reference_song_ids INTEGER[],
    style_notes        TEXT,
    auto_publish       BOOLEAN NOT NULL DEFAULT TRUE,
    generate_cover     BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at        TIMESTAMP,
    last_run_at        TIMESTAMP,
    last_run_status    TEXT,
    last_error         TEXT,
    created_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_music_auto_schedules_user ON music_auto_schedules(user_id);
  CREATE INDEX IF NOT EXISTS idx_music_auto_schedules_next ON music_auto_schedules(enabled, next_run_at);
`);

await pool.query(`
  CREATE TABLE IF NOT EXISTS music_auto_runs (
    id            SERIAL PRIMARY KEY,
    schedule_id   INTEGER NOT NULL REFERENCES music_auto_schedules(id) ON DELETE CASCADE,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        TEXT NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running', 'completed', 'partial', 'failed')),
    release_type  TEXT,
    song_ids      INTEGER[],
    release_id    INTEGER,
    concept_json  JSONB,
    error         TEXT,
    started_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at   TIMESTAMP
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_music_auto_runs_schedule ON music_auto_runs(schedule_id);
  CREATE INDEX IF NOT EXISTS idx_music_auto_runs_user ON music_auto_runs(user_id);
`);

const { rows: s } = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='music_auto_schedules'"
);
console.log('✅ music_auto_schedules columns:', s.map(r => r.column_name).join(', '));

const { rows: r } = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='music_auto_runs'"
);
console.log('✅ music_auto_runs columns:', r.map(r2 => r2.column_name).join(', '));

await pool.end();
console.log('🤖 Music auto-pilot migration complete!');
