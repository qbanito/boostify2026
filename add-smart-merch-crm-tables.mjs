/**
 * Migration: Boostify Smart Merch Engine — Fan CRM & Smart Campaigns
 *
 * Connects the Smart Merch module to the concert ticketing module so an artist
 * can market their products to the fans who bought tickets (and to past merch
 * buyers). Adds:
 * - smart_merch_campaigns            → a marketing campaign promoting a product
 *                                      to a fan audience (ticket buyers of a show,
 *                                      all ticket buyers, merch buyers, or all
 *                                      fans), delivered via Resend.
 * - smart_merch_campaign_recipients  → per-fan delivery record for a campaign
 *                                      (email, source, status, provider id).
 *
 * The fan audience is derived live from concert_orders (completed ticket
 * purchases) and smart_merch_orders (paid merch), so no contact list is stored
 * separately — the CRM always reflects real buyers.
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

    // 1) Campaigns
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_campaigns (
        id                SERIAL PRIMARY KEY,
        artist_id         INTEGER NOT NULL,
        name              TEXT NOT NULL,
        product_id        INTEGER REFERENCES smart_merch_products(id) ON DELETE SET NULL,
        concert_id        INTEGER,
        audience          TEXT NOT NULL DEFAULT 'all_ticket_buyers',
        subject           TEXT NOT NULL,
        message           TEXT NOT NULL,
        discount_code     TEXT,
        status            TEXT NOT NULL DEFAULT 'draft',
        recipients_count  INTEGER NOT NULL DEFAULT 0,
        sent_count        INTEGER NOT NULL DEFAULT 0,
        failed_count      INTEGER NOT NULL DEFAULT 0,
        created_by        INTEGER,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at           TIMESTAMP,
        updated_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2) Per-recipient delivery record
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_campaign_recipients (
        id                SERIAL PRIMARY KEY,
        campaign_id       INTEGER NOT NULL REFERENCES smart_merch_campaigns(id) ON DELETE CASCADE,
        email             TEXT NOT NULL,
        name              TEXT,
        source            TEXT NOT NULL DEFAULT 'ticket',
        concert_id        INTEGER,
        status            TEXT NOT NULL DEFAULT 'queued',
        email_provider    TEXT,
        email_message_id  TEXT,
        error             TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS idx_sm_campaigns_artist ON smart_merch_campaigns(artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sm_campaigns_concert ON smart_merch_campaigns(concert_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sm_campaign_recipients_campaign ON smart_merch_campaign_recipients(campaign_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_sm_campaign_recipients_email ON smart_merch_campaign_recipients(email);`);

    await client.query('COMMIT');
    console.log('✅ Smart Merch CRM / campaign tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
