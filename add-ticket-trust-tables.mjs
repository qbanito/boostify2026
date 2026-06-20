/**
 * Migration: Boostify — Ticket Trust Engine (scan audit + secure transfers)
 * ========================================================================
 * Phase 2 of the Live Ticketing system. Adds the AUDIT + TRUST layer on top of
 * the existing signed-QR passes (concert_ticket_passes already enforces an
 * HMAC signature + atomic single-use check-in).
 *
 *  • concert_scan_logs  → an immutable record of EVERY door scan attempt (valid
 *                         or rejected) for fraud auditing, the security
 *                         dashboard, and CSV export. The backend is the only
 *                         writer; the frontend can never forge a "valid" scan.
 *  • concert_ticket_transfers → a record of each secure ownership transfer. A
 *                         transfer mints a NEW pass code + signature for the new
 *                         owner and voids the old QR (status 'transferred'), so
 *                         a screenshot of the old ticket can never re-enter.
 *
 * Idempotent: safe to run multiple times.
 *
 * Run:  node add-ticket-trust-tables.mjs
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

    // ── Scan logs (immutable audit trail of every door scan) ─────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_scan_logs (
        id          SERIAL PRIMARY KEY,
        artist_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concert_id  INTEGER REFERENCES concert_events(id) ON DELETE SET NULL,
        pass_id     INTEGER REFERENCES concert_ticket_passes(id) ON DELETE SET NULL,
        pass_code   TEXT,
        result      TEXT NOT NULL,            -- valid | already_used | bad_signature | not_found | wrong_artist | wrong_event | void | race | malformed | error
        scanned_by  TEXT,                     -- owner/staff identifier
        gate        TEXT,                     -- optional door label
        buyer_name  TEXT,
        created_at  TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scan_logs_artist ON concert_scan_logs(artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scan_logs_event ON concert_scan_logs(concert_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_scan_logs_result ON concert_scan_logs(artist_id, result);`);

    // ── Secure ticket transfers (old QR invalidated, new one minted) ─────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS concert_ticket_transfers (
        id            SERIAL PRIMARY KEY,
        artist_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        concert_id    INTEGER REFERENCES concert_events(id) ON DELETE SET NULL,
        old_pass_id   INTEGER REFERENCES concert_ticket_passes(id) ON DELETE SET NULL,
        new_pass_id   INTEGER REFERENCES concert_ticket_passes(id) ON DELETE SET NULL,
        from_email    TEXT NOT NULL,
        to_email      TEXT NOT NULL,
        to_name       TEXT,
        status        TEXT NOT NULL DEFAULT 'completed', -- completed | reverted
        created_at    TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_transfers_artist ON concert_ticket_transfers(artist_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_transfers_from ON concert_ticket_transfers(from_email);`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_ticket_transfers_to ON concert_ticket_transfers(to_email);`);

    await client.query('COMMIT');
    console.log('✅ Ticket Trust tables created (concert_scan_logs, concert_ticket_transfers)');
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
