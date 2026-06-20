// Direct SQL migration for Promote Engine tables
import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SQL = `
CREATE TABLE IF NOT EXISTS artist_loras (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lora_url TEXT,
  trigger_word TEXT NOT NULL,
  training_job_id TEXT,
  reference_images JSONB,
  character_sheet JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  cost_cents INTEGER DEFAULT 0,
  trained_at TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artist_loras_artist ON artist_loras (artist_id);
CREATE INDEX IF NOT EXISTS idx_artist_loras_status ON artist_loras (status);

CREATE TABLE IF NOT EXISTS promo_assets (
  id SERIAL PRIMARY KEY,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pack_id TEXT,
  type TEXT NOT NULL,
  variant TEXT,
  style TEXT,
  url TEXT,
  thumbnail_url TEXT,
  prompt TEXT,
  script TEXT,
  voice_id TEXT,
  model TEXT,
  duration_seconds INTEGER,
  cost_cents INTEGER DEFAULT 0,
  metadata JSONB,
  status TEXT NOT NULL DEFAULT 'ready',
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_assets_song ON promo_assets (song_id);
CREATE INDEX IF NOT EXISTS idx_promo_assets_artist ON promo_assets (artist_id);
CREATE INDEX IF NOT EXISTS idx_promo_assets_pack ON promo_assets (pack_id);

CREATE TABLE IF NOT EXISTS promo_schedule (
  id SERIAL PRIMARY KEY,
  asset_id INTEGER NOT NULL REFERENCES promo_assets(id) ON DELETE CASCADE,
  song_id INTEGER NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  caption TEXT,
  scheduled_for TIMESTAMP NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  posted_url TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_schedule_due ON promo_schedule (scheduled_for, status);
CREATE INDEX IF NOT EXISTS idx_promo_schedule_song ON promo_schedule (song_id);

CREATE TABLE IF NOT EXISTS artist_voice_clones (
  id SERIAL PRIMARY KEY,
  artist_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  voice_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'elevenlabs',
  reference_audio_url TEXT,
  language TEXT,
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_artist_voice_clones_artist ON artist_voice_clones (artist_id);
`;

async function run() {
  console.log('▶ Applying Promote Engine migration...');
  await pool.query(SQL);
  console.log('✅ Done.');
  await pool.end();
}

run().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
