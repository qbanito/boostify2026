// Creates the `motion_capture_takes` table — recorded Live Link / phone /
// webcam / Rokoko-suit performances that drive the artist's 3D avatar in the
// hologram show. The motion timeline itself lives as JSON in Firebase Storage;
// this table holds the metadata + link so a performance can be replayed on the
// avatar for the hologram repertoire.
//
//   node add-motion-capture-takes-table.mjs
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log('🎭 Creating motion_capture_takes table…');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS motion_capture_takes (
      id            SERIAL PRIMARY KEY,
      artist_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      song_id       INTEGER REFERENCES songs(id) ON DELETE SET NULL,
      song_title    TEXT,
      title         TEXT NOT NULL,
      source        TEXT NOT NULL DEFAULT 'webcam',
      motion_url    TEXT NOT NULL,
      duration_ms   INTEGER NOT NULL DEFAULT 0,
      frame_count   INTEGER NOT NULL DEFAULT 0,
      fps           INTEGER NOT NULL DEFAULT 30,
      has_face      BOOLEAN NOT NULL DEFAULT FALSE,
      thumbnail_url TEXT,
      created_at    TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mocap_takes_artist ON motion_capture_takes (artist_id)`);
  await pool.query(`CREATE INDEX IF NOT EXISTS idx_mocap_takes_song ON motion_capture_takes (song_id)`);

  console.log('✅ motion_capture_takes table ready.');
  await pool.end();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
