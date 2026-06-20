/**
 * Migration: Boostify Smart Merch Engine — Supplier Network (admin-only)
 *
 * Adds the admin-managed fulfillment supplier network:
 * - smart_merch_global_suppliers   → curated, admin-managed directory of real
 *                                     manufacturing / print-on-demand providers
 *                                     (name, links, contact, product categories).
 * - smart_merch_supplier_threads    → admin ↔ supplier message threads (Resend).
 * - smart_merch_supplier_messages   → individual messages within a thread.
 * - smart_merch_order_routes         → record of paid orders dispatched to a
 *                                     supplier (so providers receive orders
 *                                     directly, with delivery status).
 * - smart_merch_products.assigned_supplier_id → which global supplier fulfills a
 *                                     product (admin assigns).
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

    // 1) Global supplier directory (admin-curated)
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_global_suppliers (
        id                  SERIAL PRIMARY KEY,
        name                TEXT NOT NULL,
        provider_key        TEXT,
        category            TEXT,
        website             TEXT,
        order_email         TEXT,
        contact_name        TEXT,
        contact_phone       TEXT,
        regions             JSONB NOT NULL DEFAULT '[]'::jsonb,
        product_categories  JSONB NOT NULL DEFAULT '[]'::jsonb,
        api_ready           BOOLEAN NOT NULL DEFAULT false,
        api_connected       BOOLEAN NOT NULL DEFAULT false,
        notes               TEXT,
        is_active           BOOLEAN NOT NULL DEFAULT true,
        created_by          INTEGER,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2) Admin ↔ supplier message threads
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_supplier_threads (
        id                    SERIAL PRIMARY KEY,
        supplier_id           INTEGER NOT NULL REFERENCES smart_merch_global_suppliers(id) ON DELETE CASCADE,
        subject               TEXT,
        status                TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
        related_order_id      INTEGER,
        last_message_preview  TEXT,
        last_message_at       TIMESTAMPTZ,
        admin_unread          INTEGER NOT NULL DEFAULT 0,
        supplier_unread       INTEGER NOT NULL DEFAULT 0,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 3) Individual messages
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_supplier_messages (
        id                SERIAL PRIMARY KEY,
        thread_id         INTEGER NOT NULL REFERENCES smart_merch_supplier_threads(id) ON DELETE CASCADE,
        sender_role       TEXT NOT NULL CHECK (sender_role IN ('admin','supplier','system')),
        body              TEXT NOT NULL,
        email_provider    TEXT,
        email_message_id  TEXT,
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 4) Order routing ledger — providers receive orders directly
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_order_routes (
        id                SERIAL PRIMARY KEY,
        order_id          INTEGER NOT NULL,
        product_id        INTEGER,
        supplier_id       INTEGER REFERENCES smart_merch_global_suppliers(id) ON DELETE SET NULL,
        status            TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','acknowledged','shipped')),
        email_provider    TEXT,
        email_message_id  TEXT,
        error             TEXT,
        sent_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 5) Product → assigned supplier
    await client.query(`
      ALTER TABLE smart_merch_products
        ADD COLUMN IF NOT EXISTS assigned_supplier_id INTEGER
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_sm_global_suppliers_active ON smart_merch_global_suppliers(is_active);
      CREATE INDEX IF NOT EXISTS idx_sm_supplier_threads_supplier ON smart_merch_supplier_threads(supplier_id);
      CREATE INDEX IF NOT EXISTS idx_sm_supplier_messages_thread ON smart_merch_supplier_messages(thread_id);
      CREATE INDEX IF NOT EXISTS idx_sm_order_routes_order ON smart_merch_order_routes(order_id);
      CREATE INDEX IF NOT EXISTS idx_sm_order_routes_supplier ON smart_merch_order_routes(supplier_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Smart Merch supplier-network tables created successfully');
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
