/**
 * Migration: create artist_access_unlocks table
 * Fan pays-what-you-want ($5 min) to unlock an artist's full catalog.
 * Run: node add-artist-access-unlocks-table.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating artist_access_unlocks table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_access_unlocks (
        id                SERIAL PRIMARY KEY,
        artist_id         INTEGER NOT NULL REFERENCES users(id),
        fan_user_id       INTEGER REFERENCES users(id),
        fan_email         TEXT,
        amount_paid       NUMERIC(10,2) NOT NULL,
        currency          TEXT NOT NULL DEFAULT 'usd',
        stripe_payment_id TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Idempotency on the Stripe session/payment id.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_access_unlocks_stripe
        ON artist_access_unlocks (stripe_payment_id)
        WHERE stripe_payment_id IS NOT NULL;
    `);
    // Fast lookup: does this fan have access to this artist?
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_access_unlocks_fan_artist
        ON artist_access_unlocks (artist_id, fan_user_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_access_unlocks_fan_email
        ON artist_access_unlocks (artist_id, fan_email);
    `);

    console.log('✅ artist_access_unlocks table created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
