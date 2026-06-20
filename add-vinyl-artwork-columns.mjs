/**
 * Migration: add print-ready artwork + booklet columns to vinyl_campaigns
 * Run: node add-vinyl-artwork-columns.mjs
 *
 * Adds the fields used by the Boostify auto-generated vinyl artwork
 * (high-resolution print front/back + multi-page booklet "book").
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

    await client.query(`
      ALTER TABLE vinyl_campaigns
        ADD COLUMN IF NOT EXISTS print_front_url   TEXT,
        ADD COLUMN IF NOT EXISTS print_back_url    TEXT,
        ADD COLUMN IF NOT EXISTS book_pages_json   JSONB NOT NULL DEFAULT '[]',
        ADD COLUMN IF NOT EXISTS artwork_provider  TEXT,
        ADD COLUMN IF NOT EXISTS artwork_meta       JSONB;
    `);

    await client.query('COMMIT');
    console.log('✅ vinyl_campaigns artwork columns ready');
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
