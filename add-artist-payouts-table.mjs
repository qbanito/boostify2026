/**
 * Migration: Unified Artist Payouts
 *
 * Adds:
 * - artist_wallet.{payout_method, payout_account, payout_details, total_paid_out}
 *   → artist's withdrawal method + lifetime paid-out tracker.
 * - artist_payouts → unified payout requests + ledger across ALL revenue
 *   streams (music unlocks/memberships, merch, shows, etc.) backed by
 *   artist_wallet.balance.
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1) Wallet: payout method + lifetime paid-out tracker
    await client.query(`
      ALTER TABLE artist_wallet
        ADD COLUMN IF NOT EXISTS payout_method  TEXT,
        ADD COLUMN IF NOT EXISTS payout_account TEXT,
        ADD COLUMN IF NOT EXISTS payout_details JSONB,
        ADD COLUMN IF NOT EXISTS total_paid_out NUMERIC(10,2) NOT NULL DEFAULT 0
    `);

    // 2) Payout requests + ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_payouts (
        id            SERIAL PRIMARY KEY,
        artist_id     INTEGER NOT NULL REFERENCES users(id),
        amount        NUMERIC(10,2) NOT NULL,
        currency      TEXT NOT NULL DEFAULT 'usd',
        method        TEXT,
        account       TEXT,
        status        TEXT NOT NULL DEFAULT 'requested'
                      CHECK (status IN ('requested','approved','paid','rejected')),
        reference     TEXT,
        notes         TEXT,
        requested_by  INTEGER REFERENCES users(id),
        processed_by  INTEGER REFERENCES users(id),
        requested_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        processed_at  TIMESTAMP,
        paid_at       TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_artist_payouts_artist ON artist_payouts(artist_id);
      CREATE INDEX IF NOT EXISTS idx_artist_payouts_status ON artist_payouts(status);
    `);

    await client.query('COMMIT');
    console.log('✅ Artist payouts migration applied (wallet payout columns + artist_payouts).');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
