/**
 * Aggregated stats — cron refresh (artist_stats / event_stats)
 * ===========================================================
 * Triggers keep the aggregates exact on the write path for orders + songs.
 * This periodic full refresh corrects any drift and folds in high-churn
 * counters we deliberately keep OFF the write path (notably song play counts,
 * which would otherwise fire a trigger on every single play).
 *
 * Backed by the SQL recompute functions installed by add-stats-aggregates.mjs
 * (refresh_event_stats / refresh_artist_stats), so this module stays tiny and
 * the aggregation logic lives in one place (the DB).
 *
 * Best-effort: never throws — a stats refresh must never take the app down.
 */
import { pool } from '../db';

let running = false;

/** Recompute every event + artist aggregate from source. Safe to call anytime. */
export async function refreshAllStats(): Promise<{ events: number; artists: number } | null> {
  if (running) return null; // avoid overlapping runs
  running = true;
  try {
    const ev = await pool.query('SELECT refresh_event_stats(id) FROM concert_events');
    const ar = await pool.query(`
      SELECT refresh_artist_stats(aid) FROM (
        SELECT DISTINCT user_id   AS aid FROM songs WHERE user_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM concert_events WHERE artist_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM artist_fan_leads WHERE artist_id IS NOT NULL
        UNION SELECT DISTINCT artist_id FROM fan_club_members WHERE artist_id IS NOT NULL
      ) s
    `);
    return { events: ev.rowCount ?? 0, artists: ar.rowCount ?? 0 };
  } catch (e: any) {
    console.warn('[stats] refreshAllStats failed:', e?.message);
    return null;
  } finally {
    running = false;
  }
}

/**
 * Start the periodic refresh. Runs once shortly after boot, then on an interval.
 * Default 10 minutes; override with STATS_REFRESH_MINUTES.
 */
export function startStatsCron(): void {
  const minutes = Math.max(1, Number(process.env.STATS_REFRESH_MINUTES || 10));
  const intervalMs = minutes * 60_000;
  setTimeout(() => {
    refreshAllStats().then((r) => {
      if (r) console.log(`📊 [stats] initial refresh: ${r.events} events, ${r.artists} artists`);
    });
  }, 90_000);
  setInterval(() => {
    refreshAllStats().then((r) => {
      if (r) console.log(`📊 [stats] refresh: ${r.events} events, ${r.artists} artists`);
    });
  }, intervalMs);
  console.log(`📊 [stats] cron scheduled every ${minutes} min`);
}

export interface ArtistStatsRow {
  artistId: number;
  songsCount: number;
  totalPlays: number;
  eventsCount: number;
  ticketsSold: number;
  concertGrossRevenue: number;
  concertArtistEarning: number;
  fansCount: number;
  fanClubCount: number;
  refreshedAt: string | null;
}

/** Fast read of an artist's aggregate row (recomputes once if missing). */
export async function getArtistStats(artistId: number): Promise<ArtistStatsRow | null> {
  try {
    let { rows } = await pool.query('SELECT * FROM artist_stats WHERE artist_id = $1', [artistId]);
    if (!rows.length) {
      await pool.query('SELECT refresh_artist_stats($1)', [artistId]);
      ({ rows } = await pool.query('SELECT * FROM artist_stats WHERE artist_id = $1', [artistId]));
    }
    const r = rows[0];
    if (!r) return null;
    return {
      artistId: r.artist_id,
      songsCount: Number(r.songs_count),
      totalPlays: Number(r.total_plays),
      eventsCount: Number(r.events_count),
      ticketsSold: Number(r.tickets_sold),
      concertGrossRevenue: Number(r.concert_gross_revenue),
      concertArtistEarning: Number(r.concert_artist_earning),
      fansCount: Number(r.fans_count),
      fanClubCount: Number(r.fan_club_count),
      refreshedAt: r.refreshed_at ? new Date(r.refreshed_at).toISOString() : null,
    };
  } catch (e: any) {
    console.warn('[stats] getArtistStats failed:', e?.message);
    return null;
  }
}
