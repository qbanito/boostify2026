// Migration: Boostify Streaming page tables
//  - playlists                : user-created playlists
//  - playlist_songs           : tracks inside a playlist (ordered)
//  - streaming_featured       : admin + AI-agent controlled artist curation / ranking
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🎧 Creating streaming tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title       TEXT NOT NULL,
        description TEXT,
        cover_art   TEXT,
        is_public   BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists (user_id);`);
    console.log('✅ playlists ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_songs (
        id           SERIAL PRIMARY KEY,
        playlist_id  INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        song_id      INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        order_index  INTEGER NOT NULL DEFAULT 0,
        added_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_songs_unique ON playlist_songs (playlist_id, song_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs (playlist_id);`);
    console.log('✅ playlist_songs ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS streaming_featured (
        id             SERIAL PRIMARY KEY,
        artist_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        featured_order INTEGER NOT NULL DEFAULT 0,
        is_featured    BOOLEAN NOT NULL DEFAULT TRUE,
        badge          TEXT,
        source         TEXT NOT NULL DEFAULT 'admin',   -- 'admin' | 'ai-agent'
        ai_score       NUMERIC DEFAULT 0,
        ai_reason      TEXT,
        updated_by     INTEGER,
        updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_streaming_featured_artist ON streaming_featured (artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_streaming_featured_order ON streaming_featured (featured_order);`);
    console.log('✅ streaming_featured ready');

    console.log('🎉 Streaming tables migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
