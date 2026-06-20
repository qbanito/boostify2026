/**
 * Migration: create fan_club_members + fan_point_events tables
 * Run: node add-fan-club-tables.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🚀 Creating fan_club_members table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS fan_club_members (
        id              SERIAL PRIMARY KEY,
        artist_id       INTEGER NOT NULL,
        email           TEXT NOT NULL,
        name            TEXT,
        fan_number      INTEGER NOT NULL,
        points          INTEGER NOT NULL DEFAULT 0,
        tier            TEXT NOT NULL DEFAULT 'rookie',
        streak_days     INTEGER NOT NULL DEFAULT 0,
        last_checkin_at TIMESTAMP,
        artist_slug     TEXT,
        joined_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        last_active_at  TIMESTAMP NOT NULL DEFAULT NOW(),
        metadata        JSONB
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_club_artist_email
        ON fan_club_members (artist_id, email);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_club_artist
        ON fan_club_members (artist_id);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_club_points
        ON fan_club_members (artist_id, points);
    `);

    console.log('🚀 Creating fan_point_events table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS fan_point_events (
        id          SERIAL PRIMARY KEY,
        artist_id   INTEGER NOT NULL,
        email       TEXT NOT NULL,
        action      TEXT NOT NULL,
        points      INTEGER NOT NULL DEFAULT 0,
        day_key     TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_fan_points_daily
        ON fan_point_events (artist_id, email, action, day_key);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_fan_points_artist_email
        ON fan_point_events (artist_id, email);
    `);

    console.log('✅ Fan Club tables created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
