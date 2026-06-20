/**
 * Migration: Boostify — Seat availability sharded counters (Ticketing Phase 2)
 * ============================================================================
 * High-concurrency on-sales ("Ticketmaster moment") hammer a single event with
 * thousands of concurrent holds/releases. Counting availability with
 * `COUNT(*) ... WHERE status='available'` over every seat row on each request
 * becomes a hot, slow scan, and a single denormalised counter row becomes a
 * write-contention bottleneck (every hold updates the same row → lock queue).
 *
 * SHARDED COUNTERS fix the write contention: the net held/sold deltas for an
 * event are spread across N shard rows. Each hold/release/sale updates ONE
 * RANDOM shard, so concurrent writers rarely touch the same row. Availability =
 * total_seats − SUM(held) − SUM(sold) across the shards. Individual shard rows
 * may go negative; only the SUM is meaningful (classic sharded-counter trick).
 *
 * The authoritative source of truth is still concert_event_seats; these counters
 * are an advisory fast-read aggregate, reconcilable at any time.
 *
 * Idempotent. Run:  node add-seat-availability-counters.mjs
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

    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_event_seat_counters (
        concert_id   INTEGER NOT NULL REFERENCES concert_events(id) ON DELETE CASCADE,
        shard        SMALLINT NOT NULL,
        held         INTEGER NOT NULL DEFAULT 0,
        sold         INTEGER NOT NULL DEFAULT 0,
        total_seats  INTEGER NOT NULL DEFAULT 0,
        updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (concert_id, shard)
      );
    `);

    // Fast aggregate read by event.
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_event_seat_counters_concert
        ON concert_event_seat_counters(concert_id);
    `);

    await client.query('COMMIT');
    console.log('✅ concert_event_seat_counters created (sharded availability counters)');
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
