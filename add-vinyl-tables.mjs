/**
 * Migration: add vinyl_campaigns and vinyl_preorders tables
 * Run: node add-vinyl-tables.mjs
 */
import { config } from 'dotenv';
import pg from 'pg';

config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ── vinyl_campaigns ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinyl_campaigns (
        id                      SERIAL PRIMARY KEY,
        artist_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        title                   TEXT NOT NULL,
        subtitle                TEXT,
        cover_image_1000        TEXT NOT NULL,
        cover_image_back        TEXT,
        tracklist_json          JSONB NOT NULL DEFAULT '[]',

        -- Vinyl specs
        vinyl_format            TEXT NOT NULL DEFAULT '12',
        vinyl_type              TEXT NOT NULL DEFAULT '1LP',
        vinyl_color             TEXT NOT NULL DEFAULT 'black',
        vinyl_weight            TEXT NOT NULL DEFAULT '140g',
        vinyl_speed             TEXT NOT NULL DEFAULT '33RPM',
        sleeve_type             TEXT NOT NULL DEFAULT 'color',
        print_finish            TEXT NOT NULL DEFAULT 'gloss',
        inner_sleeve            TEXT NOT NULL DEFAULT 'white',
        numbered                TEXT NOT NULL DEFAULT 'none',
        with_insert             TEXT NOT NULL DEFAULT 'none',
        with_shrink             BOOLEAN NOT NULL DEFAULT false,
        with_barcode            BOOLEAN NOT NULL DEFAULT true,
        include_mastering       BOOLEAN NOT NULL DEFAULT false,

        -- Economics
        diggers_quote_ref       TEXT,
        diggers_project_url     TEXT,
        production_cost_total   DECIMAL(10,2) NOT NULL,
        minimum_units           INTEGER NOT NULL DEFAULT 100,
        max_units               INTEGER NOT NULL DEFAULT 300,
        unit_cost               DECIMAL(10,2) NOT NULL,
        sell_price              DECIMAL(10,2) NOT NULL,
        shipping_flat_rate      DECIMAL(10,2) NOT NULL DEFAULT 12.00,

        -- State
        current_units           INTEGER NOT NULL DEFAULT 0,
        campaign_status         TEXT NOT NULL DEFAULT 'active',
        is_published            BOOLEAN NOT NULL DEFAULT true,

        -- Copyright
        copyright_org           TEXT,
        copyright_confirmed     BOOLEAN NOT NULL DEFAULT false,

        -- Fulfillment
        fulfillment_sent_at     TIMESTAMP,
        fulfillment_report      JSONB,

        -- Dates
        campaign_start          TIMESTAMP NOT NULL DEFAULT NOW(),
        campaign_end            TIMESTAMP,
        created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vinyl_campaigns_artist ON vinyl_campaigns(artist_id);
      CREATE INDEX IF NOT EXISTS idx_vinyl_campaigns_status ON vinyl_campaigns(campaign_status);
    `);

    // ── vinyl_preorders ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinyl_preorders (
        id                        SERIAL PRIMARY KEY,
        campaign_id               INTEGER NOT NULL REFERENCES vinyl_campaigns(id) ON DELETE CASCADE,
        artist_id                 INTEGER NOT NULL REFERENCES users(id),
        buyer_clerk_id            TEXT,
        buyer_email               TEXT NOT NULL,
        buyer_name                TEXT NOT NULL,
        quantity                  INTEGER NOT NULL DEFAULT 1,
        unit_price                DECIMAL(10,2) NOT NULL,
        total_price               DECIMAL(10,2) NOT NULL,

        -- Stripe
        stripe_payment_intent_id  TEXT UNIQUE,
        stripe_payment_status     TEXT NOT NULL DEFAULT 'pending',
        stripe_session_id         TEXT,

        -- Shipping
        shipping_name             TEXT,
        shipping_address_line1    TEXT,
        shipping_address_line2    TEXT,
        shipping_city             TEXT,
        shipping_state            TEXT,
        shipping_postal_code      TEXT,
        shipping_country          TEXT NOT NULL DEFAULT 'US',

        -- Order status
        status                    TEXT NOT NULL DEFAULT 'pending',
        tracking_number           TEXT,
        tracking_url              TEXT,
        notes                     TEXT,

        created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vinyl_preorders_campaign ON vinyl_preorders(campaign_id);
      CREATE INDEX IF NOT EXISTS idx_vinyl_preorders_buyer ON vinyl_preorders(buyer_email);
      CREATE INDEX IF NOT EXISTS idx_vinyl_preorders_stripe ON vinyl_preorders(stripe_payment_intent_id);
    `);

    await client.query('COMMIT');
    console.log('✅ vinyl_campaigns and vinyl_preorders tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
