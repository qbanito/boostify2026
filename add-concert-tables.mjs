/**
 * Migration: Concert Command Center tables
 *   - concert_events        — an artist's concert/show (in-person, online, hybrid)
 *   - concert_ticket_tiers  — ticket types per event (GA, VIP, Meet & Greet…)
 *   - concert_orders        — paid ticket orders + commission split (artist/platform)
 *   - concert_threads       — buyer↔artist conversation per event
 *   - concert_messages      — messages inside a thread
 *
 * Run: node add-concert-tables.mjs
 */
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    console.log('🎫 Creating concert_events table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_events (
        id               SERIAL PRIMARY KEY,
        artist_id        INTEGER NOT NULL,
        title            TEXT NOT NULL,
        description      TEXT,
        type             TEXT NOT NULL DEFAULT 'in_person',
        status           TEXT NOT NULL DEFAULT 'draft',
        starts_at        TIMESTAMP,
        ends_at          TIMESTAMP,
        timezone         TEXT,
        venue            TEXT,
        location         TEXT,
        capacity         INTEGER,
        poster_url       TEXT,
        currency         TEXT NOT NULL DEFAULT 'usd',
        streaming_config JSONB,
        linked_modules   JSONB,
        artist_slug      TEXT,
        created_at       TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at       TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_events_artist ON concert_events (artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_events_status ON concert_events (status);`);

    console.log('🎟️ Creating concert_ticket_tiers table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_ticket_tiers (
        id              SERIAL PRIMARY KEY,
        concert_id      INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        name            TEXT NOT NULL,
        description     TEXT,
        price_usd       DECIMAL(10,2) NOT NULL DEFAULT '0',
        quantity_total  INTEGER,
        quantity_sold   INTEGER NOT NULL DEFAULT 0,
        perks           JSONB,
        sort_order      INTEGER NOT NULL DEFAULT 0,
        is_active       BOOLEAN NOT NULL DEFAULT TRUE,
        created_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_tiers_concert ON concert_ticket_tiers (concert_id);`);

    console.log('💳 Creating concert_orders table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_orders (
        id                SERIAL PRIMARY KEY,
        concert_id        INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        artist_id         INTEGER NOT NULL,
        buyer_email       TEXT,
        buyer_name        TEXT,
        buyer_user_id     INTEGER,
        items             JSONB NOT NULL,
        quantity          INTEGER NOT NULL DEFAULT 1,
        subtotal          DECIMAL(10,2) NOT NULL,
        commission_rate   INTEGER NOT NULL DEFAULT 20,
        platform_fee      DECIMAL(10,2) NOT NULL,
        artist_earning    DECIMAL(10,2) NOT NULL,
        currency          TEXT NOT NULL DEFAULT 'usd',
        stripe_payment_id TEXT,
        qr_code           TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        created_at        TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_concert_orders_stripe ON concert_orders (stripe_payment_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_orders_concert ON concert_orders (concert_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_orders_artist ON concert_orders (artist_id);`);

    console.log('💬 Creating concert_threads table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_threads (
        id                   SERIAL PRIMARY KEY,
        concert_id           INTEGER REFERENCES concert_events(id) ON DELETE CASCADE,
        artist_id            INTEGER NOT NULL,
        buyer_email          TEXT NOT NULL,
        buyer_name           TEXT,
        subject              TEXT,
        last_message_preview TEXT,
        last_message_at      TIMESTAMP,
        artist_unread        INTEGER NOT NULL DEFAULT 0,
        buyer_unread         INTEGER NOT NULL DEFAULT 0,
        status               TEXT NOT NULL DEFAULT 'open',
        created_at           TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at           TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_threads_artist ON concert_threads (artist_id);`);
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_concert_threads_unique ON concert_threads (artist_id, buyer_email, concert_id);`);

    console.log('✉️ Creating concert_messages table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_messages (
        id           SERIAL PRIMARY KEY,
        thread_id    INTEGER NOT NULL REFERENCES concert_threads(id) ON DELETE CASCADE,
        sender_role  TEXT NOT NULL DEFAULT 'buyer',
        body         TEXT NOT NULL,
        attachments  JSONB,
        created_at   TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_messages_thread ON concert_messages (thread_id);`);

    console.log('✅ Concert Command Center tables created successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
