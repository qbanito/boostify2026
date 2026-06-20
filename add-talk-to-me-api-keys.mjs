/**
 * Migration: add per-artist API key fields for Talk To Me and Avatar Talk modules
 */
import 'dotenv/config';
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function run() {
  // Create talk-to-me config table if not exists (first time setup)
  await sql`
    CREATE TABLE IF NOT EXISTS artist_talk_to_me_config (
      artist_id          text        PRIMARY KEY,
      owner_uid          text        NOT NULL,
      voice_id           text,
      persona            text,
      topics             text        DEFAULT '[]',
      language           text        DEFAULT 'español',
      agent_id           text,
      is_enabled         boolean     NOT NULL DEFAULT true,
      elevenlabs_api_key text,
      gender             text        DEFAULT 'unspecified',
      cloned_voice_id    text,
      voice_name         text,
      updated_at         timestamptz NOT NULL DEFAULT NOW()
    )
  `;
  // Add new columns to existing tables (safe to run multiple times)
  await sql`ALTER TABLE artist_talk_to_me_config ADD COLUMN IF NOT EXISTS elevenlabs_api_key text`;
  await sql`ALTER TABLE artist_talk_to_me_config ADD COLUMN IF NOT EXISTS gender text DEFAULT 'unspecified'`;
  await sql`ALTER TABLE artist_talk_to_me_config ADD COLUMN IF NOT EXISTS cloned_voice_id text`;
  await sql`ALTER TABLE artist_talk_to_me_config ADD COLUMN IF NOT EXISTS voice_name text`;
  console.log('✅ artist_talk_to_me_config table + columns ensured');

  // Create avatar-talk config table for per-artist FAL key
  await sql`
    CREATE TABLE IF NOT EXISTS artist_avatar_talk_config (
      artist_id    text        PRIMARY KEY,
      owner_uid    text        NOT NULL,
      fal_key      text,
      updated_at   timestamptz NOT NULL DEFAULT NOW()
    )
  `;
  console.log('✅ artist_avatar_talk_config table created');
}

run().catch(e => { console.error(e); process.exit(1); });
