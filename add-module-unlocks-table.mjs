/**
 * Migration: create module_unlocks table
 * One-time payment to unlock a platform module for life (100% Boostify, no artist split).
 * Run: node add-module-unlocks-table.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating module_unlocks table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS module_unlocks (
        id                SERIAL PRIMARY KEY,
        user_id           INTEGER NOT NULL REFERENCES users(id),
        module_key        TEXT NOT NULL,
        amount_paid       NUMERIC(10,2) NOT NULL,
        currency          TEXT NOT NULL DEFAULT 'usd',
        stripe_payment_id TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // Idempotency on the Stripe session/payment id.
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_module_unlocks_stripe
        ON module_unlocks (stripe_payment_id)
        WHERE stripe_payment_id IS NOT NULL;
    `);
    // Fast lookup: does this user have this module unlocked?
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_module_unlocks_user_module
        ON module_unlocks (user_id, module_key);
    `);

    console.log('✅ module_unlocks table created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
