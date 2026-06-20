/**
 * Seat availability — sharded counters (Ticketing Phase 2)
 * =======================================================
 * Advisory, high-throughput availability aggregate for reserved-seating events.
 * The authoritative state lives in `concert_event_seats`; these counters let the
 * public seat map show a live "N left" without a COUNT(*) scan on every request,
 * and spread hold/release/sale writes across N shards to avoid lock contention
 * during an on-sale spike.
 *
 * All functions are best-effort and NEVER throw — a counter glitch must never
 * break a real hold/checkout. Call `reconcileSeatCounters()` to rebuild the
 * aggregate from the source-of-truth table at any time.
 */
import { pool } from '../db';

/** Number of shards the held/sold deltas are spread across. */
export const SEAT_COUNTER_SHARDS = 8;

function randomShard(): number {
  return Math.floor(Math.random() * SEAT_COUNTER_SHARDS);
}

/** Store the event's total seat count (kept on shard 0). Idempotent. */
export async function initSeatCounters(concertId: number, totalSeats: number): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO concert_event_seat_counters (concert_id, shard, total_seats)
       VALUES ($1, 0, $2)
       ON CONFLICT (concert_id, shard)
       DO UPDATE SET total_seats = EXCLUDED.total_seats, updated_at = NOW()`,
      [concertId, totalSeats],
    );
  } catch (e: any) {
    console.warn('[seat-counters] init failed:', e?.message);
  }
}

/**
 * Apply a net change to held/sold for an event by bumping ONE random shard.
 * Positive `held` = more seats held; negative = released. `sold` shifts held→sold.
 */
export async function applySeatDelta(
  concertId: number,
  delta: { held?: number; sold?: number },
): Promise<void> {
  const held = delta.held ?? 0;
  const sold = delta.sold ?? 0;
  if (held === 0 && sold === 0) return;
  const shard = randomShard();
  try {
    await pool.query(
      `INSERT INTO concert_event_seat_counters (concert_id, shard, held, sold)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (concert_id, shard)
       DO UPDATE SET held = concert_event_seat_counters.held + $3,
                     sold = concert_event_seat_counters.sold + $4,
                     updated_at = NOW()`,
      [concertId, shard, held, sold],
    );
  } catch (e: any) {
    console.warn('[seat-counters] applyDelta failed:', e?.message);
  }
}

export interface SeatAvailability {
  total: number;
  held: number;
  sold: number;
  available: number;
}

/** Fast read of current availability from the sharded aggregate. */
export async function getSeatAvailability(concertId: number): Promise<SeatAvailability | null> {
  try {
    const { rows } = await pool.query(
      `SELECT COALESCE(MAX(total_seats), 0) AS total,
              COALESCE(SUM(held), 0)        AS held,
              COALESCE(SUM(sold), 0)        AS sold
         FROM concert_event_seat_counters
        WHERE concert_id = $1`,
      [concertId],
    );
    if (!rows.length) return null;
    const total = Number(rows[0].total) || 0;
    const held = Number(rows[0].held) || 0;
    const sold = Number(rows[0].sold) || 0;
    return { total, held, sold, available: Math.max(0, total - held - sold) };
  } catch (e: any) {
    console.warn('[seat-counters] getAvailability failed:', e?.message);
    return null;
  }
}

/**
 * Rebuild the sharded counters for an event from `concert_event_seats`
 * (the source of truth). Use on attach-venue, after bulk releases, or as a
 * scheduled drift correction. Returns the recomputed availability.
 */
export async function reconcileSeatCounters(concertId: number): Promise<SeatAvailability | null> {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                            AS total,
         COUNT(*) FILTER (WHERE status = 'held')::int             AS held,
         COUNT(*) FILTER (WHERE status = 'sold')::int             AS sold
       FROM concert_event_seats
       WHERE concert_id = $1`,
      [concertId],
    );
    const total = Number(rows[0]?.total) || 0;
    const held = Number(rows[0]?.held) || 0;
    const sold = Number(rows[0]?.sold) || 0;

    await pool.query('DELETE FROM concert_event_seat_counters WHERE concert_id = $1', [concertId]);
    await pool.query(
      `INSERT INTO concert_event_seat_counters (concert_id, shard, held, sold, total_seats)
       VALUES ($1, 0, $2, $3, $4)`,
      [concertId, held, sold, total],
    );
    return { total, held, sold, available: Math.max(0, total - held - sold) };
  } catch (e: any) {
    console.warn('[seat-counters] reconcile failed:', e?.message);
    return null;
  }
}
