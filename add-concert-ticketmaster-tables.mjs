/**
 * Migration: Concert Center — Ticketmaster-grade upgrade
 * ──────────────────────────────────────────────────────
 * Adds the missing pieces that turn the Concert Center into a full event
 * infrastructure (discount/presale codes, sold-out waitlist) and a per-order
 * purchase limit on tiers (anti-fraud). 100% additive — does NOT modify or
 * drop any existing column or table.
 *
 * Run: node add-concert-ticketmaster-tables.mjs
 */
import pg from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // ─────────────────────────────────────────────────────────────────
    // 1. concert_discount_codes
    //    Promo / presale codes. A code can be a percentage or a fixed
    //    amount, optionally scoped to one event, time-boxed, usage-capped,
    //    and optionally a "presale" gate (unlocks tickets before the public
    //    on-sale window or for fan-club members only).
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_discount_codes (
        id                SERIAL PRIMARY KEY,
        artist_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concert_id        INTEGER REFERENCES concert_events(id) ON DELETE CASCADE,
        code              VARCHAR(64) NOT NULL,
        kind              TEXT NOT NULL DEFAULT 'percent',   -- 'percent' | 'fixed'
        amount            DECIMAL(10,2) NOT NULL DEFAULT 0,  -- percent (0-100) or USD
        is_presale        BOOLEAN NOT NULL DEFAULT FALSE,    -- unlocks before public on-sale
        max_redemptions   INTEGER,                           -- null = unlimited
        times_redeemed    INTEGER NOT NULL DEFAULT 0,
        starts_at         TIMESTAMP,
        ends_at           TIMESTAMP,
        is_active         BOOLEAN NOT NULL DEFAULT TRUE,
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // One code string per artist (codes are matched case-insensitively in app code).
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS concert_discount_codes_artist_code_idx
        ON concert_discount_codes (artist_id, LOWER(code));
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS concert_discount_codes_concert_idx
        ON concert_discount_codes (concert_id);
    `);

    // ─────────────────────────────────────────────────────────────────
    // 2. concert_waitlist
    //    Fans queue for a sold-out / not-yet-on-sale event. The artist can
    //    see demand by city and notify the list when tickets are released.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_waitlist (
        id            SERIAL PRIMARY KEY,
        concert_id    INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        artist_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email         TEXT NOT NULL,
        name          TEXT,
        quantity      INTEGER NOT NULL DEFAULT 1,
        city          TEXT,
        status        TEXT NOT NULL DEFAULT 'waiting',  -- 'waiting' | 'notified' | 'converted'
        notified_at   TIMESTAMP,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS concert_waitlist_concert_email_idx
        ON concert_waitlist (concert_id, LOWER(email));
    `);

    // ─────────────────────────────────────────────────────────────────
    // 3. concert_ticket_tiers.max_per_order — anti-fraud purchase cap.
    //    null/0 = fall back to the global hard cap (20). Additive column.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE concert_ticket_tiers
        ADD COLUMN IF NOT EXISTS max_per_order INTEGER;
    `);

    // ─────────────────────────────────────────────────────────────────
    // 4. concert_orders.discount columns — record the code used + amount off
    //    so analytics and receipts are accurate. Additive columns.
    // ─────────────────────────────────────────────────────────────────
    await client.query(`
      ALTER TABLE concert_orders
        ADD COLUMN IF NOT EXISTS discount_code   VARCHAR(64);
    `);
    await client.query(`
      ALTER TABLE concert_orders
        ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0;
    `);
    // Buyer geo/device captured at checkout for analytics (best-effort).
    await client.query(`
      ALTER TABLE concert_orders
        ADD COLUMN IF NOT EXISTS buyer_country VARCHAR(8);
    `);
    await client.query(`
      ALTER TABLE concert_orders
        ADD COLUMN IF NOT EXISTS buyer_device  VARCHAR(16);
    `);

    await client.query('COMMIT');
    console.log('✅ Concert Ticketmaster-grade tables/columns ready.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
