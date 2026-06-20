// Seat-map WRITE path under contention — the "Ticketmaster moment".
// Each VU loads the live seat map, tries to HOLD a small random batch of
// available seats, then RELEASES them. This stresses the
// `SELECT … FOR UPDATE SKIP LOCKED` hold path and the sharded availability
// counters against thousands of concurrent buyers fighting for the same seats.
//
//   k6 run -e SCALE=1k -e EVENT_ID=123 -e BASE_URL=http://localhost:3000 load-tests/seat-map-holds.js
//
// REQUIRES a reserved-seating event id (EVENT_ID). Run against a STAGING event,
// never a real on-sale — holds mutate seat state.
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Counter } from 'k6/metrics';
import { BASE_URL, SCALE, stagesFor, baseThresholds } from './options.js';

const errors = new Rate('app_errors');
const holdsOk = new Counter('holds_succeeded');
const holdsConflict = new Counter('holds_conflict_409'); // expected & healthy under contention

export const options = {
  stages: stagesFor(SCALE),
  thresholds: {
    ...baseThresholds,
    // 5xx must stay rare; 409 conflicts are EXPECTED (someone else got the seat)
    // and are tracked separately, not counted as failures.
    app_errors: ['rate<0.02'],
  },
};

const EVENT_ID = __ENV.EVENT_ID;
if (!EVENT_ID) {
  throw new Error('EVENT_ID is required, e.g. -e EVENT_ID=123 (use a STAGING event)');
}

function pickAvailableSeatIds(seatmap, n) {
  const available = (seatmap.seats || []).filter((s) => s.status === 'available');
  if (!available.length) return [];
  // Random start → buyers collide on overlapping ranges (realistic contention).
  const start = Math.floor(Math.random() * available.length);
  return available.slice(start, start + n).map((s) => s.id);
}

export default function () {
  let seatIds = [];

  group('load seatmap', () => {
    const r = http.get(`${BASE_URL}/api/seat-map/events/${EVENT_ID}/seatmap`);
    const ok = check(r, { 'seatmap 200': (res) => res.status === 200 });
    if (!ok) { errors.add(1); return; }
    let body;
    try { body = JSON.parse(r.body); } catch { errors.add(1); return; }
    if (!body.reserved) return; // event is general admission; nothing to hold
    seatIds = pickAvailableSeatIds(body, 1 + Math.floor(Math.random() * 3));
  });

  if (!seatIds.length) { sleep(1); return; }

  let holdToken = null;
  group('hold seats', () => {
    const payload = JSON.stringify({ email: `loadtest+${__VU}_${__ITER}@example.com`, seatIds });
    const r = http.post(`${BASE_URL}/api/seat-map/events/${EVENT_ID}/hold`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (r.status === 200) {
      holdsOk.add(1);
      try { holdToken = JSON.parse(r.body).holdToken; } catch { /* ignore */ }
    } else if (r.status === 409) {
      holdsConflict.add(1); // healthy: anti double-sell rejected a contested seat
    } else {
      errors.add(1);
    }
  });

  // Hold briefly, then release so the inventory recycles for other VUs.
  sleep(1 + Math.random());
  if (holdToken) {
    group('release hold', () => {
      const r = http.post(
        `${BASE_URL}/api/seat-map/events/${EVENT_ID}/release`,
        JSON.stringify({ holdToken }),
        { headers: { 'Content-Type': 'application/json' } },
      );
      check(r, { 'release 200': (res) => res.status === 200 }) || errors.add(1);
    });
  }

  sleep(Math.random());
}
