/**
 * Migration: Boostify — Live Ticketing & Seat Map Engine (Phase 1)
 * ================================================================
 * Adds reserved-seating ("Ticketmaster-style") on top of the existing Postgres
 * concert ticketing system (concert_events / concert_orders / concert_ticket_passes).
 *
 * A VENUE is a reusable visual map owned by an artist. It has SECTIONS (pricing
 * zones: blocks of seats, groups of tables, or general-admission areas) and
 * SEATS (one sellable unit each — an individual seat or a whole table).
 *
 * Because a venue is reused across many events, the live sellable STATUS of each
 * seat lives PER EVENT in concert_event_seats (available | held | sold | blocked)
 * together with the price for that event and the temporary hold (10-min timer).
 *
 * Anti double-sell is enforced at the DB level: a unique (concert_id, seat_id)
 * row + transactional `UPDATE ... WHERE status='available'` in the hold endpoint.
 *
 * Idempotent: safe to run multiple times.
 *
 * Run:  node add-seat-map-engine-tables.mjs
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

    // ── Venues ───────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_venues (
        id            SERIAL PRIMARY KEY,
        artist_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        address       TEXT,
        city          TEXT,
        country       VARCHAR(80),
        description   TEXT,
        capacity      INTEGER NOT NULL DEFAULT 0,
        canvas_width  INTEGER NOT NULL DEFAULT 1000,
        canvas_height INTEGER NOT NULL DEFAULT 700,
        stage_label   TEXT DEFAULT 'STAGE',
        image_url     TEXT,
        status        TEXT NOT NULL DEFAULT 'active',
        created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_venues_artist ON concert_venues(artist_id);`);

    // ── Sections (pricing / visual zones) ────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_venue_sections (
        id            SERIAL PRIMARY KEY,
        venue_id      INTEGER NOT NULL REFERENCES concert_venues(id) ON DELETE CASCADE,
        name          TEXT NOT NULL,
        kind          TEXT NOT NULL DEFAULT 'seats',  -- seats | tables | ga
        color         VARCHAR(16) NOT NULL DEFAULT '#7c3aed',
        default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
        ga_capacity   INTEGER NOT NULL DEFAULT 0,      -- general-admission only
        table_seats   INTEGER NOT NULL DEFAULT 4,      -- chairs per table (tables only)
        x             INTEGER NOT NULL DEFAULT 0,
        y             INTEGER NOT NULL DEFAULT 0,
        sort_order    INTEGER NOT NULL DEFAULT 0,
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_venue_sections_venue ON concert_venue_sections(venue_id);`);

    // ── Seats (one sellable unit each) ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_seats (
        id             SERIAL PRIMARY KEY,
        venue_id       INTEGER NOT NULL REFERENCES concert_venues(id) ON DELETE CASCADE,
        section_id     INTEGER NOT NULL REFERENCES concert_venue_sections(id) ON DELETE CASCADE,
        kind           TEXT NOT NULL DEFAULT 'seat',   -- seat | table
        row_label      VARCHAR(16),
        seat_number    VARCHAR(16),
        label          TEXT NOT NULL,                  -- "A12" or "Table 3"
        capacity       INTEGER NOT NULL DEFAULT 1,     -- chairs (table) | 1 (seat)
        x              INTEGER NOT NULL DEFAULT 0,
        y              INTEGER NOT NULL DEFAULT 0,
        price_override NUMERIC(10,2),                  -- null → section.default_price
        is_blocked     BOOLEAN NOT NULL DEFAULT FALSE, -- structurally unsellable
        created_at     TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_seats_venue ON concert_seats(venue_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_concert_seats_section ON concert_seats(section_id);`);

    // ── Per-event seat status (the live sellable state) ──────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_event_seats (
        id              SERIAL PRIMARY KEY,
        concert_id      INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        seat_id         INTEGER NOT NULL REFERENCES concert_seats(id) ON DELETE CASCADE,
        section_id      INTEGER REFERENCES concert_venue_sections(id) ON DELETE SET NULL,
        status          TEXT NOT NULL DEFAULT 'available', -- available | held | sold | blocked
        price           NUMERIC(10,2) NOT NULL DEFAULT 0,
        hold_token      VARCHAR(64),
        held_by_email   TEXT,
        hold_expires_at TIMESTAMP,
        order_id        INTEGER REFERENCES concert_orders(id) ON DELETE SET NULL,
        pass_id         INTEGER REFERENCES concert_ticket_passes(id) ON DELETE SET NULL,
        updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    // Enforce one status row per (event, seat) → the anti double-sell anchor.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS idx_event_seat_unique ON concert_event_seats(concert_id, seat_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_seat_status ON concert_event_seats(concert_id, status);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_seat_hold ON concert_event_seats(hold_token);`);

    // ── Link events to a venue + seating mode ────────────────────────────────
    await client.query(`ALTER TABLE concert_events ADD COLUMN IF NOT EXISTS venue_id INTEGER REFERENCES concert_venues(id) ON DELETE SET NULL;`);
    await client.query(`ALTER TABLE concert_events ADD COLUMN IF NOT EXISTS seating_mode TEXT NOT NULL DEFAULT 'general';`); // general | reserved

    // ── Record the reserved seats on the order ───────────────────────────────
    await client.query(`ALTER TABLE concert_orders ADD COLUMN IF NOT EXISTS seat_ids JSONB;`);

    // ── Label each minted pass with its seat (the passes table already exists) ─
    await client.query(`ALTER TABLE concert_ticket_passes ADD COLUMN IF NOT EXISTS seat_id INTEGER REFERENCES concert_seats(id) ON DELETE SET NULL;`);

    await client.query('COMMIT');
    console.log('✅ Seat Map Engine tables created (venues, sections, seats, event seats) + event/order/pass columns added');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Migration failed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
