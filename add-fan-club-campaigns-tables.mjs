/**
 * Migration: Fan Club CRM — imported contacts + automated news campaigns.
 *
 * Lets an artist import their own fan database (CSV) and send intelligent,
 * non-aggressive news campaigns to fans via Resend. Idempotent.
 *
 *   fan_club_contacts            — imported / collected fan contacts (email list)
 *   fan_club_campaigns           — a news / update campaign (draft → sent)
 *   fan_club_campaign_recipients — per-fan delivery log for a campaign
 *
 * Run: source ~/.nvm/nvm.sh && node add-fan-club-campaigns-tables.mjs
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS fan_club_contacts (
        id              SERIAL PRIMARY KEY,
        artist_id       INTEGER NOT NULL,
        email           TEXT NOT NULL,
        name            TEXT,
        source          TEXT NOT NULL DEFAULT 'csv',
        tags            TEXT,
        subscribed      BOOLEAN NOT NULL DEFAULT TRUE,
        unsubscribe_token TEXT,
        last_emailed_at TIMESTAMP,
        metadata        JSONB,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fan_contacts_artist ON fan_club_contacts(artist_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_contacts_artist_email ON fan_club_contacts(artist_id, LOWER(email));`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fan_contacts_token ON fan_club_contacts(unsubscribe_token);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fan_club_campaigns (
        id               SERIAL PRIMARY KEY,
        artist_id        INTEGER NOT NULL,
        name             TEXT NOT NULL,
        subject          TEXT NOT NULL,
        message          TEXT NOT NULL,
        audience         TEXT NOT NULL DEFAULT 'all',
        tag              TEXT,
        cta_url          TEXT,
        cta_label        TEXT,
        status           TEXT NOT NULL DEFAULT 'draft',
        recipients_count INTEGER NOT NULL DEFAULT 0,
        sent_count       INTEGER NOT NULL DEFAULT 0,
        failed_count     INTEGER NOT NULL DEFAULT 0,
        created_by       INTEGER,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        sent_at          TIMESTAMP,
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fan_campaigns_artist ON fan_club_campaigns(artist_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS fan_club_campaign_recipients (
        id                SERIAL PRIMARY KEY,
        campaign_id       INTEGER NOT NULL REFERENCES fan_club_campaigns(id) ON DELETE CASCADE,
        email             TEXT NOT NULL,
        name              TEXT,
        source            TEXT NOT NULL DEFAULT 'contact',
        status            TEXT NOT NULL DEFAULT 'queued',
        email_provider    TEXT,
        email_message_id  TEXT,
        error             TEXT,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fan_campaign_recipients_campaign ON fan_club_campaign_recipients(campaign_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_fan_campaign_recipients_email ON fan_club_campaign_recipients(LOWER(email));`);

    await client.query('COMMIT');
    console.log('✅ Fan Club CRM / campaign tables created successfully');
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
