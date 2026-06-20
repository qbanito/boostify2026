/**
 * Migration: Vinyl Limited Edition Token System
 * 
 * Creates:
 *   - vinyl_editions       : Limited edition drops (100 / 300 / 500 copies)
 *   - vinyl_edition_tokens : Individual numbered tokens / physical copies
 *   - vinyl_token_transactions : Value tracking + transfer history
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

    // ── vinyl_editions ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinyl_editions (
        id                    SERIAL PRIMARY KEY,
        artist_id             INTEGER NOT NULL,
        title                 TEXT    NOT NULL,
        subtitle              TEXT,
        description           TEXT,

        -- Cover art (1000x1000 – Diggers spec)
        cover_image_1000      TEXT,
        cover_image_back      TEXT,
        ai_cover_prompt       TEXT,
        ai_cover_model        TEXT    DEFAULT 'fal-ai/flux-pro/kontext/text-to-image',

        -- Vinyl specs (mirrors vinyl_campaigns fields)
        vinyl_format          TEXT    NOT NULL DEFAULT '12',
        vinyl_type            TEXT    NOT NULL DEFAULT '1LP',
        vinyl_color           TEXT    NOT NULL DEFAULT 'black',
        vinyl_weight          TEXT    NOT NULL DEFAULT '180g',
        vinyl_speed           TEXT    NOT NULL DEFAULT '33RPM',
        sleeve_type           TEXT    NOT NULL DEFAULT 'color',
        print_finish          TEXT    NOT NULL DEFAULT 'gloss',
        inner_sleeve          TEXT    NOT NULL DEFAULT 'white',
        numbered              TEXT    NOT NULL DEFAULT 'hand',
        with_shrink           BOOLEAN NOT NULL DEFAULT true,
        with_barcode          BOOLEAN NOT NULL DEFAULT true,
        include_mastering     BOOLEAN NOT NULL DEFAULT false,

        -- Edition economics
        edition_size          INTEGER NOT NULL DEFAULT 100 CHECK (edition_size IN (100, 300, 500)),
        tokens_minted         INTEGER NOT NULL DEFAULT 0,
        mint_price            NUMERIC(10,2) NOT NULL DEFAULT 45.00,
        current_market_value  NUMERIC(10,2),
        shipping_flat_rate    NUMERIC(10,2) NOT NULL DEFAULT 14.00,
        production_cost_total NUMERIC(12,2),
        unit_cost             NUMERIC(10,2),

        -- Investment / token metadata
        token_symbol          TEXT,      -- e.g. "REDWINE001"
        rarity_tier           TEXT NOT NULL DEFAULT 'unique'
                                CHECK (rarity_tier IN ('unique','rare','limited')),
        -- unique=100 copies, rare=300, limited=500
        appreciation_notes    TEXT,      -- marketing copy about expected value growth
        catalog_number        TEXT,      -- e.g. "BFY-2025-001"

        -- Diggers Factory integration
        diggers_quote_ref     TEXT,
        diggers_project_url   TEXT,
        diggers_order_status  TEXT       DEFAULT 'not_submitted',
        copyright_confirmed   BOOLEAN    NOT NULL DEFAULT false,
        copyright_org         TEXT,
        tracklist_json        JSONB      NOT NULL DEFAULT '[]',

        -- Lifecycle
        status                TEXT NOT NULL DEFAULT 'draft'
                                CHECK (status IN ('draft','presale','live','sold_out','production','fulfilled','cancelled')),
        is_published          BOOLEAN NOT NULL DEFAULT false,
        sale_start            TIMESTAMPTZ,
        sale_end              TIMESTAMPTZ,
        created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── vinyl_edition_tokens ────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinyl_edition_tokens (
        id                  SERIAL PRIMARY KEY,
        edition_id          INTEGER NOT NULL REFERENCES vinyl_editions(id) ON DELETE CASCADE,
        token_number        INTEGER NOT NULL,         -- 1 .. edition_size
        serial_label        TEXT,                     -- e.g. "001/100"

        -- Ownership
        owner_user_id       INTEGER,                  -- NULL = available
        holder_name         TEXT,
        holder_email        TEXT,

        -- Purchase
        purchase_price      NUMERIC(10,2),
        purchased_at        TIMESTAMPTZ,
        stripe_session_id   TEXT,
        payment_status      TEXT NOT NULL DEFAULT 'available'
                              CHECK (payment_status IN ('available','pending','paid','refunded')),

        -- Market / resale
        current_value       NUMERIC(10,2),
        is_listed_for_sale  BOOLEAN NOT NULL DEFAULT false,
        list_price          NUMERIC(10,2),
        listed_at           TIMESTAMPTZ,

        -- Physical delivery
        shipping_status     TEXT NOT NULL DEFAULT 'not_shipped'
                              CHECK (shipping_status IN ('not_shipped','processing','shipped','delivered')),
        tracking_number     TEXT,
        shipped_at          TIMESTAMPTZ,

        -- Metadata
        transfer_history    JSONB NOT NULL DEFAULT '[]',
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

        UNIQUE (edition_id, token_number)
      );
    `);

    // ── vinyl_token_transactions ────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS vinyl_token_transactions (
        id               SERIAL PRIMARY KEY,
        edition_id       INTEGER NOT NULL REFERENCES vinyl_editions(id) ON DELETE CASCADE,
        token_id         INTEGER REFERENCES vinyl_edition_tokens(id),
        token_number     INTEGER,
        transaction_type TEXT NOT NULL CHECK (transaction_type IN ('mint','resale','gift','refund')),
        from_user_id     INTEGER,
        to_user_id       INTEGER,
        price            NUMERIC(10,2),
        note             TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Indices ─────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_vinyl_editions_artist ON vinyl_editions(artist_id);
      CREATE INDEX IF NOT EXISTS idx_vinyl_edition_tokens_edition ON vinyl_edition_tokens(edition_id);
      CREATE INDEX IF NOT EXISTS idx_vinyl_edition_tokens_owner ON vinyl_edition_tokens(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_vinyl_token_tx_edition ON vinyl_token_transactions(edition_id);
    `);

    await client.query('COMMIT');
    console.log('✅ vinyl_editions, vinyl_edition_tokens, vinyl_token_transactions tables created');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
