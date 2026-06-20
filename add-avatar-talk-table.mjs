import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🎬 Creating artist_avatar_videos table...');

await pool.query(`
  CREATE TABLE IF NOT EXISTS artist_avatar_videos (
    id              SERIAL PRIMARY KEY,
    artist_id       TEXT NOT NULL,
    video_url       TEXT NOT NULL,
    thumbnail_url   TEXT,
    title           TEXT,
    prompt          TEXT,
    voice           TEXT,
    scene           TEXT,
    talking_style   TEXT DEFAULT 'stable',
    aspect_ratio    TEXT DEFAULT '9:16',
    captions_enabled BOOLEAN DEFAULT FALSE,
    status          TEXT NOT NULL DEFAULT 'processing'
                    CHECK (status IN ('processing', 'ready', 'failed')),
    fal_request_id  TEXT,
    error_message   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
  )
`);

await pool.query(`
  CREATE INDEX IF NOT EXISTS idx_avatar_videos_artist ON artist_avatar_videos(artist_id);
`);

console.log('✅ artist_avatar_videos table created');
await pool.end();
