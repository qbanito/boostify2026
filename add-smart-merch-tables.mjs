/**
 * Migration: Boostify Smart Merch Engine
 *
 * Features:
 * - Physical products sold in pre-sale mode only
 * - Fulfillment unlock after minimum sold units is reached
 * - NFC/QR activations mapped to per-unit serials
 * - Artist commission split (default 30%) configurable by admin
 * - Supplier and lead-time tracking
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
      CREATE TABLE IF NOT EXISTS smart_merch_products (
        id                        SERIAL PRIMARY KEY,
        artist_id                 INTEGER NOT NULL,
        title                     TEXT NOT NULL,
        description               TEXT,
        category                  TEXT NOT NULL DEFAULT 'wearable'
                                   CHECK (category IN ('wearable','collectible','vinyl','poster','accessory','other')),
        image_url                 TEXT,
        gallery                   JSONB NOT NULL DEFAULT '[]'::jsonb,

        supplier_name             TEXT,
        supplier_sku              TEXT,
        supplier_cost_unit        NUMERIC(12,2),
        estimated_lead_days       INTEGER NOT NULL DEFAULT 21,

        currency                  TEXT NOT NULL DEFAULT 'usd',
        presale_price             NUMERIC(12,2) NOT NULL,
        min_presale_units         INTEGER NOT NULL DEFAULT 50,
        max_presale_units         INTEGER,
        sold_units                INTEGER NOT NULL DEFAULT 0,

        artist_profit_pct         NUMERIC(5,2) NOT NULL DEFAULT 30.00,
        platform_profit_pct       NUMERIC(5,2) NOT NULL DEFAULT 70.00,

        nfc_enabled               BOOLEAN NOT NULL DEFAULT true,
        qr_enabled                BOOLEAN NOT NULL DEFAULT true,
        unlock_type               TEXT NOT NULL DEFAULT 'exclusive-content'
                                   CHECK (unlock_type IN ('exclusive-content','discount','fan-club','vip-message','download','other')),
        unlock_payload            JSONB NOT NULL DEFAULT '{}'::jsonb,

        is_example                BOOLEAN NOT NULL DEFAULT false,
        is_published              BOOLEAN NOT NULL DEFAULT false,
        status                    TEXT NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','presale_live','presale_closed','fulfillment_ready','shipping','completed','archived')),
        fulfillment_unlocked      BOOLEAN NOT NULL DEFAULT false,
        fulfillment_unlocked_at   TIMESTAMPTZ,

        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_orders (
        id                        SERIAL PRIMARY KEY,
        artist_id                 INTEGER NOT NULL,
        product_id                INTEGER NOT NULL REFERENCES smart_merch_products(id) ON DELETE CASCADE,
        buyer_user_id             INTEGER,
        buyer_name                TEXT NOT NULL,
        buyer_email               TEXT NOT NULL,
        quantity                  INTEGER NOT NULL DEFAULT 1,
        unit_price                NUMERIC(12,2) NOT NULL,
        subtotal                  NUMERIC(12,2) NOT NULL,
        artist_profit_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
        platform_profit_amount    NUMERIC(12,2) NOT NULL DEFAULT 0,

        stripe_session_id         TEXT,
        payment_status            TEXT NOT NULL DEFAULT 'pending'
                                   CHECK (payment_status IN ('pending','paid','expired','refunded','cancelled')),
        shipping_status           TEXT NOT NULL DEFAULT 'pending_threshold'
                                   CHECK (shipping_status IN ('pending_threshold','ready_to_ship','shipped','delivered','cancelled')),

        shipping_name             TEXT,
        shipping_line1            TEXT,
        shipping_line2            TEXT,
        shipping_city             TEXT,
        shipping_state            TEXT,
        shipping_postal_code      TEXT,
        shipping_country          TEXT,
        tracking_number           TEXT,

        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        paid_at                   TIMESTAMPTZ,
        shipped_at                TIMESTAMPTZ,
        delivered_at              TIMESTAMPTZ
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_serials (
        id                        SERIAL PRIMARY KEY,
        order_id                  INTEGER NOT NULL REFERENCES smart_merch_orders(id) ON DELETE CASCADE,
        product_id                INTEGER NOT NULL REFERENCES smart_merch_products(id) ON DELETE CASCADE,
        artist_id                 INTEGER NOT NULL,
        serial_number             INTEGER NOT NULL,
        serial_code               TEXT NOT NULL,
        qr_payload                TEXT,
        activation_url            TEXT,
        is_activated              BOOLEAN NOT NULL DEFAULT false,
        activated_at              TIMESTAMPTZ,
        activated_by_name         TEXT,
        activated_by_email        TEXT,

        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_smart_merch_serial UNIQUE (serial_code)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_admin_config (
        id                        SERIAL PRIMARY KEY,
        artist_id                 INTEGER NOT NULL UNIQUE,
        artist_profit_pct         NUMERIC(5,2) NOT NULL DEFAULT 30.00,
        updated_by_user_id        INTEGER,
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_suppliers (
        id                        SERIAL PRIMARY KEY,
        artist_id                 INTEGER NOT NULL,
        supplier_name             TEXT NOT NULL,
        contact_name              TEXT,
        contact_email             TEXT,
        contact_phone             TEXT,
        regions                   JSONB NOT NULL DEFAULT '[]'::jsonb,
        notes                     TEXT,
        is_active                 BOOLEAN NOT NULL DEFAULT true,
        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_smart_merch_products_artist ON smart_merch_products(artist_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_products_status ON smart_merch_products(status);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_orders_artist ON smart_merch_orders(artist_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_orders_product ON smart_merch_orders(product_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_orders_payment ON smart_merch_orders(payment_status);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_serials_product ON smart_merch_serials(product_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_serials_order ON smart_merch_serials(order_id);
      CREATE INDEX IF NOT EXISTS idx_smart_merch_suppliers_artist ON smart_merch_suppliers(artist_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Smart Merch tables created successfully');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Smart Merch migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
