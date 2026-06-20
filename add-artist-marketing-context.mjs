/**
 * Migration: Add artist_marketing_context table
 *
 * Stores AI-enriched marketing context for each artist, used to personalise
 * AI calls across all modules via the ai-skills-injector utility.
 *
 * Run: node add-artist-marketing-context.mjs
 */

import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech') ? { rejectUnauthorized: false } : false,
});

await client.connect();
console.log('✅ Connected to database');

try {
  await client.query(`
    CREATE TABLE IF NOT EXISTS artist_marketing_context (
      id                  SERIAL PRIMARY KEY,
      user_id             INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      -- Core identity
      artist_name         TEXT,
      genre               TEXT[],
      subgenre            TEXT,
      -- Positioning
      target_audience     TEXT,
      brand_voice         TEXT,
      usp                 TEXT,
      positioning         TEXT,
      -- Goals & channels
      primary_goals       TEXT[],
      social_channels     JSONB,
      key_releases        JSONB,
      -- Content strategy
      content_pillars     TEXT[],
      similar_artists     TEXT[],
      differentiators     TEXT[],
      -- Compiled markdown context (injected into AI prompts)
      context_md          TEXT,
      last_generated_at   TIMESTAMP,
      created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  console.log('✅ Table artist_marketing_context created (or already exists)');

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_marketing_ctx_user
    ON artist_marketing_context (user_id);
  `);
  console.log('✅ Index idx_marketing_ctx_user created');

} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
} finally {
  await client.end();
  console.log('✅ Migration complete');
}
