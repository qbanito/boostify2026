/**
 * Migration: Art Gallery / Auction Module  (Galería de Arte — Artes Plásticas)
 *
 * Módulo enfocado en artistas visuales: cuadros, pinturas, esculturas, arte digital.
 * Soporta 3 modos de venta:
 *   - fixed     : precio fijo (compra directa de la obra original 1/1)
 *   - auction   : subasta con contador / cuenta regresiva + pujas
 *   - tokenized : ediciones numeradas vendidas con tokens (como vinyl_editions)
 *
 * Crea:
 *   - art_artworks      : la obra de arte (modo de venta + economía)
 *   - art_bids          : historial de pujas de las subastas
 *   - art_tokens        : tokens numerados individuales (ediciones tokenizadas)
 *   - art_transactions  : registro de auditoría (ventas / pujas / mint / reventa)
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

    // ── art_artworks ──────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS art_artworks (
        id                      SERIAL PRIMARY KEY,
        artist_id               INTEGER NOT NULL,
        title                   TEXT    NOT NULL,
        description             TEXT,

        -- Clasificación de la obra
        category                TEXT    NOT NULL DEFAULT 'painting'
                                  CHECK (category IN ('painting','drawing','sculpture','photography','digital','mixed','print','other')),
        medium                  TEXT,                 -- p.ej. "Óleo sobre lienzo"
        dimensions              TEXT,                 -- p.ej. "80 x 100 cm"
        year_created            INTEGER,
        is_original             BOOLEAN DEFAULT true,  -- pieza única 1/1 vs edición

        -- Imágenes
        image_url               TEXT    NOT NULL,
        extra_images            JSONB   DEFAULT '[]'::jsonb,
        ai_prompt               TEXT,
        ai_model                TEXT,

        -- Modo de venta + moneda
        sale_mode               TEXT    NOT NULL DEFAULT 'fixed'
                                  CHECK (sale_mode IN ('fixed','auction','tokenized')),
        currency                TEXT    NOT NULL DEFAULT 'usd',

        -- Venta a PRECIO FIJO (obra original)
        price                   NUMERIC(12,2),
        is_sold                 BOOLEAN DEFAULT false,
        sold_to_user_id         INTEGER,
        sold_to_name            TEXT,
        sold_price              NUMERIC(12,2),
        sold_at                 TIMESTAMPTZ,
        buy_stripe_session_id   TEXT,
        buy_payment_status      TEXT    DEFAULT 'available'
                                  CHECK (buy_payment_status IN ('available','pending','paid','refunded')),

        -- SUBASTA (con contador / cuenta regresiva)
        starting_price          NUMERIC(12,2),
        reserve_price           NUMERIC(12,2),
        min_increment           NUMERIC(12,2) DEFAULT 10,
        buy_now_price           NUMERIC(12,2),
        current_bid             NUMERIC(12,2),
        current_bidder_user_id  INTEGER,
        current_bidder_name     TEXT,
        current_bidder_email    TEXT,
        bid_count               INTEGER DEFAULT 0,
        auction_start           TIMESTAMPTZ,
        auction_end             TIMESTAMPTZ,            -- objetivo de la cuenta regresiva
        auction_settled         BOOLEAN DEFAULT false,
        winner_user_id          INTEGER,
        winner_name             TEXT,
        winner_email            TEXT,
        winner_stripe_session_id TEXT,
        winner_payment_status   TEXT    DEFAULT 'unpaid'
                                  CHECK (winner_payment_status IN ('unpaid','pending','paid','refunded')),

        -- EDICIÓN TOKENIZADA (ediciones numeradas vendidas con tokens)
        edition_size            INTEGER DEFAULT 1,
        token_price             NUMERIC(12,2),
        token_symbol            TEXT,
        tokens_minted           INTEGER DEFAULT 0,
        shipping_flat_rate      NUMERIC(12,2) DEFAULT 0,

        -- Compartido
        status                  TEXT    NOT NULL DEFAULT 'draft'
                                  CHECK (status IN ('draft','live','sold','ended','archived')),
        is_published            BOOLEAN DEFAULT false,
        featured                BOOLEAN DEFAULT false,
        views                   INTEGER DEFAULT 0,
        tags                    JSONB   DEFAULT '[]'::jsonb,

        created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── art_bids ──────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS art_bids (
        id               SERIAL PRIMARY KEY,
        artwork_id       INTEGER NOT NULL REFERENCES art_artworks(id) ON DELETE CASCADE,
        artist_id        INTEGER NOT NULL,
        bidder_user_id   INTEGER,
        bidder_name      TEXT    NOT NULL,
        bidder_email     TEXT,
        amount           NUMERIC(12,2) NOT NULL,
        status           TEXT    NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','outbid','won','lost','refunded')),
        stripe_session_id TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── art_tokens ────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS art_tokens (
        id                 SERIAL PRIMARY KEY,
        artwork_id         INTEGER NOT NULL REFERENCES art_artworks(id) ON DELETE CASCADE,
        artist_id          INTEGER NOT NULL,
        token_number       INTEGER NOT NULL,
        serial_label       TEXT,
        owner_user_id      INTEGER,
        holder_name        TEXT,
        holder_email       TEXT,
        purchase_price     NUMERIC(12,2),
        purchased_at       TIMESTAMPTZ,
        stripe_session_id  TEXT,
        payment_status     TEXT    NOT NULL DEFAULT 'available'
                             CHECK (payment_status IN ('available','pending','paid','refunded')),
        current_value      NUMERIC(12,2),
        is_listed_for_sale BOOLEAN DEFAULT false,
        list_price         NUMERIC(12,2),
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_art_token UNIQUE (artwork_id, token_number)
      );
    `);

    // ── art_transactions ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS art_transactions (
        id               SERIAL PRIMARY KEY,
        artwork_id       INTEGER NOT NULL,
        token_id         INTEGER,
        artist_id        INTEGER NOT NULL,
        transaction_type TEXT    NOT NULL
                           CHECK (transaction_type IN ('sale','bid','mint','resale','refund','auction_win')),
        from_user_id     INTEGER,
        to_user_id       INTEGER,
        buyer_name       TEXT,
        price            NUMERIC(12,2),
        note             TEXT,
        created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // ── Índices ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_art_artworks_artist   ON art_artworks(artist_id);
      CREATE INDEX IF NOT EXISTS idx_art_artworks_status    ON art_artworks(status);
      CREATE INDEX IF NOT EXISTS idx_art_artworks_sale_mode ON art_artworks(sale_mode);
      CREATE INDEX IF NOT EXISTS idx_art_bids_artwork       ON art_bids(artwork_id);
      CREATE INDEX IF NOT EXISTS idx_art_bids_bidder        ON art_bids(bidder_user_id);
      CREATE INDEX IF NOT EXISTS idx_art_tokens_artwork     ON art_tokens(artwork_id);
      CREATE INDEX IF NOT EXISTS idx_art_tokens_owner       ON art_tokens(owner_user_id);
      CREATE INDEX IF NOT EXISTS idx_art_tx_artwork         ON art_transactions(artwork_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Art Gallery tables created: art_artworks, art_bids, art_tokens, art_transactions');
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
