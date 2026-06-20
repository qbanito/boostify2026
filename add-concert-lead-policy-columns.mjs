/**
 * Migration: concert refund policy + complete buyer-lead capture.
 *
 * Adds:
 *   concert_events.refund_policy        — free-text policy shown at checkout
 *   concert_events.refund_policy_type   — preset key (flexible|moderate|strict|no_refunds|custom)
 *   concert_orders.buyer_phone          — buyer phone (lead)
 *   concert_orders.buyer_city           — buyer city (lead)
 *   concert_orders.marketing_opt_in     — buyer agreed to receive news/marketing
 *   concert_orders.policy_accepted      — buyer accepted the refund policy / terms
 * (concert_orders.buyer_country already exists; it is now populated.)
 *
 * Run: node add-concert-lead-policy-columns.mjs
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

    console.log('🎫 Adding refund-policy columns to concert_events...');
    await client.query(`
      ALTER TABLE concert_events
        ADD COLUMN IF NOT EXISTS refund_policy       TEXT,
        ADD COLUMN IF NOT EXISTS refund_policy_type  VARCHAR(32) DEFAULT 'flexible';
    `);

    console.log('🎫 Adding lead-capture columns to concert_orders...');
    await client.query(`
      ALTER TABLE concert_orders
        ADD COLUMN IF NOT EXISTS buyer_phone      VARCHAR(40),
        ADD COLUMN IF NOT EXISTS buyer_city       VARCHAR(120),
        ADD COLUMN IF NOT EXISTS marketing_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS policy_accepted  BOOLEAN NOT NULL DEFAULT FALSE;
    `);

    await client.query('COMMIT');
    console.log('✅ Concert refund-policy + lead-capture columns added successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(() => process.exit(1));
