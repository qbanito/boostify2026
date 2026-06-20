/**
 * Migration: create artist_fan_leads table
 * Run: node add-artist-fan-leads-table.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating artist_fan_leads table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_fan_leads (
        id              SERIAL PRIMARY KEY,
        artist_id       INTEGER NOT NULL,
        email           TEXT NOT NULL,
        name            TEXT,
        subscribed_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        source          TEXT DEFAULT 'artist_page',
        artist_slug     TEXT,
        sequence_step   INTEGER NOT NULL DEFAULT 0,
        last_email_sent_at TIMESTAMP,
        next_email_at   TIMESTAMP,
        is_unsubscribed BOOLEAN NOT NULL DEFAULT FALSE,
        unsubscribed_at TIMESTAMP,
        ip_address      TEXT,
        metadata        JSONB
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_leads_artist_email
        ON artist_fan_leads (artist_id, email);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_leads_artist
        ON artist_fan_leads (artist_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_leads_email
        ON artist_fan_leads (email);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_leads_next_email
        ON artist_fan_leads (next_email_at);
    `);

    console.log('✅ artist_fan_leads table created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
