/**
 * Migration: Boostify Smart Merch Engine — v3 (ecosystem)
 *
 * Adds:
 * - smart_merch_products.linked_event_id      → link a product to a concert event
 *                                                (ticket ↔ merch ecosystem)
 * - smart_merch_products.fulfillment_provider → assigned supplier/provider key
 * - smart_merch_suppliers.{provider_key, fulfillment_mode, website, api_connected}
 * - smart_merch_settings.{payout_method, payout_account, payout_details, total_paid_out}
 * - smart_merch_payouts → artist payout requests + ledger (transparent earnings → payouts)
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

    // 1) Products: link to concert events + assigned fulfillment provider
    await client.query(`
      ALTER TABLE smart_merch_products
        ADD COLUMN IF NOT EXISTS linked_event_id      INTEGER,
        ADD COLUMN IF NOT EXISTS fulfillment_provider TEXT
    `);

    // 2) Suppliers: provider catalog metadata + connection state
    await client.query(`
      ALTER TABLE smart_merch_suppliers
        ADD COLUMN IF NOT EXISTS provider_key     TEXT,
        ADD COLUMN IF NOT EXISTS fulfillment_mode TEXT NOT NULL DEFAULT 'manual',
        ADD COLUMN IF NOT EXISTS website          TEXT,
        ADD COLUMN IF NOT EXISTS api_connected    BOOLEAN NOT NULL DEFAULT false
    `);

    // 3) Settings: artist payout method + lifetime paid-out tracker
    await client.query(`
      ALTER TABLE smart_merch_settings
        ADD COLUMN IF NOT EXISTS payout_method  TEXT,
        ADD COLUMN IF NOT EXISTS payout_account TEXT,
        ADD COLUMN IF NOT EXISTS payout_details JSONB NOT NULL DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS total_paid_out NUMERIC(12,2) NOT NULL DEFAULT 0
    `);

    // 4) Payout requests + ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_payouts (
        id                  SERIAL PRIMARY KEY,
        artist_id           INTEGER NOT NULL,
        amount              NUMERIC(12,2) NOT NULL,
        currency            TEXT NOT NULL DEFAULT 'usd',
        method              TEXT,
        account             TEXT,
        status              TEXT NOT NULL DEFAULT 'requested'
                             CHECK (status IN ('requested','approved','paid','rejected')),
        reference           TEXT,
        notes               TEXT,
        requested_by        INTEGER,
        processed_by        INTEGER,
        requested_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        processed_at        TIMESTAMPTZ,
        paid_at             TIMESTAMPTZ
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_smart_merch_payouts_artist ON smart_merch_payouts(artist_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_payouts_status ON smart_merch_payouts(status);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_products_event ON smart_merch_products(linked_event_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Smart Merch Engine v3 migration applied (events link + suppliers + payouts).');
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
