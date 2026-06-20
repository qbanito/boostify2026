/**
 * Migration: create concert_ticket_passes table (anti-fraud ticketing)
 * One row PER admitted unit, each with an HMAC signature for forgery-proof QR
 * codes and single-use atomic check-in.
 * Run: node add-concert-ticket-passes-table.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🎫 Creating concert_ticket_passes table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_ticket_passes (
        id             SERIAL PRIMARY KEY,
        order_id       INTEGER NOT NULL REFERENCES concert_orders(id) ON DELETE CASCADE,
        concert_id     INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        artist_id      INTEGER NOT NULL,
        tier_id        INTEGER REFERENCES concert_ticket_tiers(id) ON DELETE SET NULL,
        tier_name      TEXT,
        buyer_email    TEXT,
        buyer_name     TEXT,
        pass_code      TEXT NOT NULL UNIQUE,
        signature      TEXT NOT NULL,
        status         TEXT NOT NULL DEFAULT 'valid',
        checked_in_at  TIMESTAMP,
        checked_in_by  TEXT,
        seat           TEXT,
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_concert_passes_order
        ON concert_ticket_passes (order_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_concert_passes_event
        ON concert_ticket_passes (concert_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_concert_passes_artist
        ON concert_ticket_passes (artist_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_concert_passes_email
        ON concert_ticket_passes (artist_id, buyer_email);
    `);

    console.log('✅ concert_ticket_passes table ready.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
