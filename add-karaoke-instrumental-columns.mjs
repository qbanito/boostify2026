import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

console.log('🎤 Adding instrumental (karaoke backing-track) columns to song_karaoke...');

// The karaoke instrumental is generated once (vocals removed) and cached
// permanently on Firebase Storage, mirroring how synced_lyrics is cached.
await pool.query(`
  ALTER TABLE song_karaoke
    ADD COLUMN IF NOT EXISTS instrumental_url           TEXT,
    ADD COLUMN IF NOT EXISTS instrumental_status        TEXT DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS instrumental_provider      TEXT,
    ADD COLUMN IF NOT EXISTS instrumental_error         TEXT,
    ADD COLUMN IF NOT EXISTS instrumental_generated_at  TIMESTAMP
`);

const { rows } = await pool.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='song_karaoke' ORDER BY ordinal_position"
);
console.log('✅ song_karaoke columns:', rows.map(r => r.column_name).join(', '));

await pool.end();
console.log('🎤 Karaoke instrumental migration complete!');
