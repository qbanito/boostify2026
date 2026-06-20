import { Pool } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

async function main() {
  const client = await pool.connect();
  try {
    const check = await client.query(
      `SELECT table_name FROM information_schema.tables WHERE table_name IN ('brand_messages', 'campaign_songs') AND table_schema='public'`
    );
    console.log('Existing tables:', check.rows.map(r => r.table_name));

    if (!check.rows.find(r => r.table_name === 'brand_messages')) {
      await client.query(`
        CREATE TABLE brand_messages (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES brand_campaigns(id) ON DELETE CASCADE,
          sender_type TEXT NOT NULL CHECK (sender_type IN ('brand', 'artist', 'system')),
          sender_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          message TEXT NOT NULL,
          attachment_url TEXT,
          attachment_type TEXT CHECK (attachment_type IS NULL OR attachment_type IN ('image', 'video', 'file', 'audio')),
          is_read BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
        CREATE INDEX idx_brand_msg_campaign ON brand_messages(campaign_id);
      `);
      console.log('✅ Created brand_messages');
    } else {
      console.log('⏭️ brand_messages already exists');
    }

    if (!check.rows.find(r => r.table_name === 'campaign_songs')) {
      await client.query(`
        CREATE TABLE campaign_songs (
          id SERIAL PRIMARY KEY,
          campaign_id INTEGER NOT NULL REFERENCES brand_campaigns(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          audio_url TEXT,
          lyrics TEXT,
          genre TEXT DEFAULT 'pop',
          mood TEXT DEFAULT 'upbeat',
          duration INTEGER,
          ai_model TEXT,
          prompt TEXT,
          status TEXT NOT NULL DEFAULT 'generating' CHECK (status IN ('generating', 'ready', 'approved', 'rejected')),
          created_at TIMESTAMP DEFAULT NOW() NOT NULL
        );
      `);
      console.log('✅ Created campaign_songs');
    } else {
      console.log('⏭️ campaign_songs already exists');
    }

    console.log('🎯 Done!');
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error('❌', e.message); process.exit(1); });
