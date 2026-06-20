// Migration: Boostify Streaming — social / personalization layer
//  - listening_history   : every meaningful play (>=30s) → trending, charts, recs, wrapped
//  - song_likes          : "Me gusta" / saved songs (auto "Tus me gusta" playlist)
//  - artist_follows      : follow artists → new-releases feed + network effect
//  - playlist_followers   : save/follow public playlists (viral playlists)
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🎧 Creating streaming social tables...');

    // ── listening_history ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER REFERENCES users(id) ON DELETE CASCADE,
        song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        ms_played  INTEGER NOT NULL DEFAULT 0,
        source     TEXT NOT NULL DEFAULT 'stream',   -- 'stream' | 'embed' | 'radio'
        played_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listen_user_time ON listening_history (user_id, played_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listen_song_time ON listening_history (song_id, played_at DESC);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_listen_time ON listening_history (played_at DESC);`);
    console.log('✅ listening_history ready');

    // ── song_likes ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS song_likes (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        song_id    INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_song_likes_unique ON song_likes (user_id, song_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_song_likes_song ON song_likes (song_id);`);
    console.log('✅ song_likes ready');

    // ── artist_follows ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_follows (
        id         SERIAL PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        artist_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_artist_follows_unique ON artist_follows (user_id, artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_artist_follows_artist ON artist_follows (artist_id);`);
    console.log('✅ artist_follows ready');

    // ── playlist_followers ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS playlist_followers (
        id          SERIAL PRIMARY KEY,
        user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_playlist_followers_unique ON playlist_followers (user_id, playlist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_playlist_followers_playlist ON playlist_followers (playlist_id);`);
    console.log('✅ playlist_followers ready');

    console.log('🎉 Streaming social tables migration complete.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
