/**
 * Migration: Boostify — Aggregated stats (artist_stats / event_stats)
 * ===================================================================
 * Dashboards were computing artist/event KPIs with live aggregate queries
 * (COUNT/SUM across songs, concert_orders, ticket passes, fan tables) on every
 * page load. That doesn't scale. This migration adds two denormalised aggregate
 * tables kept fresh by:
 *
 *   • TRIGGERS — a write to concert_orders (or insert/delete on songs) calls a
 *     SCOPED recompute for just that event/artist, so KPIs are exact in real
 *     time without scanning whole tables.
 *   • CRON — a periodic full refresh (see server/services/stats-aggregates.ts,
 *     scheduled from server/index.ts) corrects drift and folds in high-churn
 *     counters we deliberately keep OFF the write path (e.g. song play counts).
 *
 * The aggregate tables are derived data: they can be rebuilt from source at any
 * time by calling refresh_event_stats(id) / refresh_artist_stats(id).
 *
 * Idempotent. Run:  node add-stats-aggregates.mjs
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

    // ── Tables ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS event_stats (
        concert_id        INTEGER PRIMARY KEY REFERENCES concert_events(id) ON DELETE CASCADE,
        artist_id         INTEGER,
        orders_completed  INTEGER NOT NULL DEFAULT 0,
        tickets_sold      INTEGER NOT NULL DEFAULT 0,
        gross_revenue     NUMERIC(14,2) NOT NULL DEFAULT 0,
        platform_fee      NUMERIC(14,2) NOT NULL DEFAULT 0,
        artist_earning    NUMERIC(14,2) NOT NULL DEFAULT 0,
        passes_valid      INTEGER NOT NULL DEFAULT 0,
        checked_in        INTEGER NOT NULL DEFAULT 0,
        refreshed_at      TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_event_stats_artist ON event_stats(artist_id);`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS artist_stats (
        artist_id              INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        songs_count            INTEGER NOT NULL DEFAULT 0,
        total_plays            BIGINT  NOT NULL DEFAULT 0,
        events_count           INTEGER NOT NULL DEFAULT 0,
        tickets_sold           INTEGER NOT NULL DEFAULT 0,
        concert_gross_revenue  NUMERIC(14,2) NOT NULL DEFAULT 0,
        concert_artist_earning NUMERIC(14,2) NOT NULL DEFAULT 0,
        fans_count             INTEGER NOT NULL DEFAULT 0,
        fan_club_count         INTEGER NOT NULL DEFAULT 0,
        refreshed_at           TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // ── Recompute functions (scoped, idempotent upserts) ──────────────────────
    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_event_stats(p_event_id integer)
      RETURNS void AS $$
      BEGIN
        INSERT INTO event_stats (
          concert_id, artist_id, orders_completed, tickets_sold,
          gross_revenue, platform_fee, artist_earning, passes_valid, checked_in, refreshed_at)
        SELECT
          e.id, e.artist_id,
          COALESCE(o.orders_completed, 0),
          COALESCE(o.tickets_sold, 0),
          COALESCE(o.gross_revenue, 0),
          COALESCE(o.platform_fee, 0),
          COALESCE(o.artist_earning, 0),
          COALESCE(p.passes_valid, 0),
          COALESCE(p.checked_in, 0),
          NOW()
        FROM concert_events e
        LEFT JOIN (
          SELECT concert_id,
            COUNT(*) FILTER (WHERE status = 'completed')                       AS orders_completed,
            COALESCE(SUM(quantity)       FILTER (WHERE status = 'completed'),0) AS tickets_sold,
            COALESCE(SUM(subtotal)       FILTER (WHERE status = 'completed'),0) AS gross_revenue,
            COALESCE(SUM(platform_fee)   FILTER (WHERE status = 'completed'),0) AS platform_fee,
            COALESCE(SUM(artist_earning) FILTER (WHERE status = 'completed'),0) AS artist_earning
          FROM concert_orders WHERE concert_id = p_event_id GROUP BY concert_id
        ) o ON o.concert_id = e.id
        LEFT JOIN (
          SELECT concert_id,
            COUNT(*) FILTER (WHERE status IN ('valid','checked_in')) AS passes_valid,
            COUNT(*) FILTER (WHERE status = 'checked_in')            AS checked_in
          FROM concert_ticket_passes WHERE concert_id = p_event_id GROUP BY concert_id
        ) p ON p.concert_id = e.id
        WHERE e.id = p_event_id
        ON CONFLICT (concert_id) DO UPDATE SET
          artist_id        = EXCLUDED.artist_id,
          orders_completed = EXCLUDED.orders_completed,
          tickets_sold     = EXCLUDED.tickets_sold,
          gross_revenue    = EXCLUDED.gross_revenue,
          platform_fee     = EXCLUDED.platform_fee,
          artist_earning   = EXCLUDED.artist_earning,
          passes_valid     = EXCLUDED.passes_valid,
          checked_in       = EXCLUDED.checked_in,
          refreshed_at     = NOW();
      END;
      $$ LANGUAGE plpgsql;
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION refresh_artist_stats(p_artist_id integer)
      RETURNS void AS $$
      BEGIN
        INSERT INTO artist_stats (
          artist_id, songs_count, total_plays, events_count, tickets_sold,
          concert_gross_revenue, concert_artist_earning, fans_count, fan_club_count, refreshed_at)
        SELECT
          p_artist_id,
          COALESCE((SELECT COUNT(*)       FROM songs WHERE user_id = p_artist_id), 0),
          COALESCE((SELECT SUM(plays)     FROM songs WHERE user_id = p_artist_id), 0),
          COALESCE((SELECT COUNT(*)       FROM concert_events WHERE artist_id = p_artist_id), 0),
          COALESCE((SELECT SUM(quantity)  FROM concert_orders WHERE artist_id = p_artist_id AND status = 'completed'), 0),
          COALESCE((SELECT SUM(subtotal)       FROM concert_orders WHERE artist_id = p_artist_id AND status = 'completed'), 0),
          COALESCE((SELECT SUM(artist_earning) FROM concert_orders WHERE artist_id = p_artist_id AND status = 'completed'), 0),
          COALESCE((SELECT COUNT(*) FROM artist_fan_leads WHERE artist_id = p_artist_id AND is_unsubscribed = false), 0),
          COALESCE((SELECT COUNT(*) FROM fan_club_members WHERE artist_id = p_artist_id), 0),
          NOW()
        ON CONFLICT (artist_id) DO UPDATE SET
          songs_count            = EXCLUDED.songs_count,
          total_plays            = EXCLUDED.total_plays,
          events_count           = EXCLUDED.events_count,
          tickets_sold           = EXCLUDED.tickets_sold,
          concert_gross_revenue  = EXCLUDED.concert_gross_revenue,
          concert_artist_earning = EXCLUDED.concert_artist_earning,
          fans_count             = EXCLUDED.fans_count,
          fan_club_count         = EXCLUDED.fan_club_count,
          refreshed_at           = NOW();
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ── Trigger functions ─────────────────────────────────────────────────────
    // A ticket order changed → recompute just that event + that artist.
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_concert_orders_stats()
      RETURNS trigger AS $$
      BEGIN
        PERFORM refresh_event_stats(COALESCE(NEW.concert_id, OLD.concert_id));
        PERFORM refresh_artist_stats(COALESCE(NEW.artist_id, OLD.artist_id));
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // A song was added/removed → recompute that artist. (UPDATE is intentionally
    // excluded: songs.plays increments are high-churn and handled by the cron.)
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_songs_stats()
      RETURNS trigger AS $$
      BEGIN
        PERFORM refresh_artist_stats(COALESCE(NEW.user_id, OLD.user_id));
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // ── Triggers (drop+create for idempotency) ────────────────────────────────
    await client.query(`DROP TRIGGER IF EXISTS concert_orders_stats_aiud ON concert_orders;`);
    await client.query(`
      CREATE TRIGGER concert_orders_stats_aiud
        AFTER INSERT OR UPDATE OR DELETE ON concert_orders
        FOR EACH ROW EXECUTE FUNCTION trg_concert_orders_stats();
    `);

    await client.query(`DROP TRIGGER IF EXISTS songs_stats_aid ON songs;`);
    await client.query(`
      CREATE TRIGGER songs_stats_aid
        AFTER INSERT OR DELETE ON songs
        FOR EACH ROW EXECUTE FUNCTION trg_songs_stats();
    `);

    await client.query('COMMIT');
    console.log('✅ artist_stats + event_stats tables, recompute functions, and triggers created');

    // Initial backfill (outside the txn — can be large).
    console.log('⏳ Backfilling aggregates from source tables…');
    await pool.query('SELECT refresh_event_stats(id) FROM concert_events');
    await pool.query(`
      SELECT refresh_artist_stats(aid) FROM (
        SELECT DISTINCT user_id   AS aid FROM songs WHERE user_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM concert_events WHERE artist_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM artist_fan_leads WHERE artist_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM fan_club_members WHERE artist_id IS NOT NULL
      ) s
    `);
    console.log('✅ Backfill complete');
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch { /* already committed */ }
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run();
