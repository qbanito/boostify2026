/**
 * Migration: Boostify Smart Merch Engine — v2 (monetization + branding + contract)
 *
 * Adds:
 * - smart_merch_products.management_type
 *     'boostify_managed'  → producto gestionado por Boostify (artista recibe 30%, plataforma 70%)
 *     'artist_uploaded'   → producto propio del artista (Boostify cobra 30% de comisión, artista recibe 70%)
 * - smart_merch_settings  → portada (hero) generada con IA + estado del contrato firmado por el artista
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

    // 1) management_type on products
    await client.query(`
      ALTER TABLE smart_merch_products
        ADD COLUMN IF NOT EXISTS management_type TEXT NOT NULL DEFAULT 'boostify_managed'
    `);

    // (re)apply the CHECK constraint idempotently
    await client.query(`
      ALTER TABLE smart_merch_products DROP CONSTRAINT IF EXISTS smart_merch_products_management_type_check
    `);
    await client.query(`
      ALTER TABLE smart_merch_products
        ADD CONSTRAINT smart_merch_products_management_type_check
        CHECK (management_type IN ('boostify_managed','artist_uploaded'))
    `);

    // 2) per-artist settings: hero image + contract acceptance
    await client.query(`
      CREATE TABLE IF NOT EXISTS smart_merch_settings (
        id                        SERIAL PRIMARY KEY,
        artist_id                 INTEGER NOT NULL UNIQUE,

        hero_image_url            TEXT,
        hero_prompt               TEXT,
        hero_generated_at         TIMESTAMPTZ,

        contract_accepted         BOOLEAN NOT NULL DEFAULT false,
        contract_version          TEXT,
        contract_accepted_at      TIMESTAMPTZ,
        contract_signer_name      TEXT,
        contract_signer_email     TEXT,
        contract_signer_ip        TEXT,

        created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_smart_merch_settings_artist
        ON smart_merch_settings(artist_id)
    `);

    await client.query('COMMIT');
    console.log('✅ Smart Merch Engine v2 migration applied (management_type + smart_merch_settings).');
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
