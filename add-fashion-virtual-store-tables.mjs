/**
 * Migration: Fashion Virtual Store Module
 *
 * Creates:
 *   - fashion_brands           : Artist fashion brand identity
 *   - fashion_collections      : Seasonal drops & limited collections
 *   - fashion_products         : Product concepts with AI visuals
 *   - fashion_campaigns        : AI-generated fashion campaigns
 *   - fashion_tryon_sessions   : Virtual try-on + fan scenes
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

    // ── fashion_brands ───────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fashion_brands (
        id                   SERIAL PRIMARY KEY,
        user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        brand_name           TEXT NOT NULL,
        tagline              TEXT,
        aesthetic            TEXT,
        color_palette        TEXT[]    DEFAULT '{}',
        typography_style     TEXT,
        logo_url             TEXT,
        moodboard_urls       TEXT[]    DEFAULT '{}',
        brand_manifesto      TEXT,
        brand_story          TEXT,
        founded              TEXT,
        influences           TEXT[]    DEFAULT '{}',
        is_published         BOOLEAN   NOT NULL DEFAULT false,
        shopify_store_domain TEXT,
        shopify_access_token TEXT,
        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS uniq_fashion_brand_user
        ON fashion_brands(user_id);
    `);

    // ── fashion_collections ──────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fashion_collections (
        id                 SERIAL PRIMARY KEY,
        brand_id           INTEGER NOT NULL REFERENCES fashion_brands(id) ON DELETE CASCADE,
        user_id            INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name               TEXT    NOT NULL,
        season             TEXT    NOT NULL DEFAULT 'limited'
                             CHECK (season IN ('spring_summer','fall_winter','limited','capsule','collab')),
        year               INTEGER,
        theme              TEXT,
        inspired_by_song   TEXT,
        hero_image_url     TEXT,
        lookbook_urls      TEXT[]  DEFAULT '{}',
        status             TEXT    NOT NULL DEFAULT 'upcoming'
                             CHECK (status IN ('upcoming','active','sold_out','archived')),
        drop_date          TIMESTAMPTZ,
        is_limited         BOOLEAN NOT NULL DEFAULT false,
        limited_quantity   INTEGER,
        token_gated        BOOLEAN NOT NULL DEFAULT false,
        created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fashion_coll_brand ON fashion_collections(brand_id);
      CREATE INDEX IF NOT EXISTS idx_fashion_coll_user  ON fashion_collections(user_id);
    `);

    // ── fashion_products ─────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fashion_products (
        id                  SERIAL PRIMARY KEY,
        collection_id       INTEGER REFERENCES fashion_collections(id) ON DELETE SET NULL,
        brand_id            INTEGER NOT NULL REFERENCES fashion_brands(id) ON DELETE CASCADE,
        user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name                TEXT    NOT NULL,
        description         TEXT,
        category            TEXT    NOT NULL DEFAULT 'top'
                              CHECK (category IN ('top','bottom','outerwear','footwear','accessory','headwear','bodysuit','set')),
        price               NUMERIC(10,2) NOT NULL DEFAULT 0,
        compare_at_price    NUMERIC(10,2),
        product_image_urls  TEXT[]  DEFAULT '{}',
        visual_direction    TEXT,
        colorways           TEXT[]  DEFAULT '{}',
        sizes               TEXT[]  DEFAULT '{"XS","S","M","L","XL","2XL"}',
        materials           TEXT[]  DEFAULT '{}',
        printful_product_id TEXT,
        shopify_product_id  TEXT,
        is_available        BOOLEAN NOT NULL DEFAULT true,
        stock               INTEGER NOT NULL DEFAULT 0,
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fashion_prod_brand      ON fashion_products(brand_id);
      CREATE INDEX IF NOT EXISTS idx_fashion_prod_collection ON fashion_products(collection_id);
      CREATE INDEX IF NOT EXISTS idx_fashion_prod_user       ON fashion_products(user_id);
    `);

    // ── fashion_campaigns ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fashion_campaigns (
        id                SERIAL PRIMARY KEY,
        brand_id          INTEGER NOT NULL REFERENCES fashion_brands(id) ON DELETE CASCADE,
        user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        collection_id     INTEGER REFERENCES fashion_collections(id) ON DELETE SET NULL,
        title             TEXT    NOT NULL,
        concept           TEXT,
        campaign_images   TEXT[]  DEFAULT '{}',
        video_prompt      TEXT,
        target_platforms  TEXT[]  DEFAULT '{}',
        hashtags          TEXT[]  DEFAULT '{}',
        caption           TEXT,
        status            TEXT    NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','ready','published')),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fashion_camp_brand ON fashion_campaigns(brand_id);
    `);

    // ── fashion_tryon_sessions ───────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS fashion_tryon_sessions (
        id                SERIAL PRIMARY KEY,
        product_id        INTEGER REFERENCES fashion_products(id) ON DELETE SET NULL,
        user_id           INTEGER REFERENCES users(id) ON DELETE SET NULL,
        brand_id          INTEGER REFERENCES fashion_brands(id) ON DELETE CASCADE,
        model_image_url   TEXT    NOT NULL,
        garment_image_url TEXT,
        result_image_url  TEXT,
        is_fan_scene      BOOLEAN NOT NULL DEFAULT false,
        fan_name          TEXT,
        is_public         BOOLEAN NOT NULL DEFAULT false,
        status            TEXT    NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','processing','completed','failed')),
        created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fashion_tryon_brand ON fashion_tryon_sessions(brand_id);
      CREATE INDEX IF NOT EXISTS idx_fashion_tryon_prod  ON fashion_tryon_sessions(product_id);
    `);

    await client.query('COMMIT');
    console.log('✅ Fashion Virtual Store tables created successfully.');
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
