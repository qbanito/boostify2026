/**
 * Migration: add tiktok_connections table
 * Run once: node add-tiktok-connections-table.mjs
 */
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS tiktok_connections (
        id               SERIAL PRIMARY KEY,
        user_id          INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
        access_token     TEXT NOT NULL,
        refresh_token    TEXT,
        token_expires_at TIMESTAMPTZ NOT NULL,
        tiktok_open_id   TEXT,
        display_name     TEXT,
        avatar_url       TEXT,
        profile_deep_link TEXT,
        scopes           TEXT,
        is_active        BOOLEAN NOT NULL DEFAULT TRUE,
        last_synced_at   TIMESTAMPTZ,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_tiktok_user ON tiktok_connections(user_id);`);
    console.log('✅ tiktok_connections table created (or already existed).');
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err) => { console.error(err); process.exit(1); });
