import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🎤 Creating song_karaoke table...');

await pool.query(`
  CREATE TABLE IF NOT EXISTS song_karaoke (
    id          SERIAL PRIMARY KEY,
    song_id     INTEGER NOT NULL UNIQUE REFERENCES songs(id) ON DELETE CASCADE,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    synced_lyrics JSONB,
    raw_transcript TEXT,
    status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'ready', 'failed')),
    provider    TEXT,
    error_message TEXT,
    generated_at TIMESTAMP,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_song_karaoke_song ON song_karaoke(song_id);
  CREATE INDEX IF NOT EXISTS idx_song_karaoke_user ON song_karaoke(user_id);
`);

const { rows } = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='song_karaoke'"
);
console.log('✅ song_karaoke columns:', rows.map(r => r.column_name).join(', '));

await pool.end();
console.log('🎤 Karaoke table migration complete!');
