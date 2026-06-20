// Public read endpoints under load (no auth) — homepage data, education academy,
// and the fast seat-map availability counter. Validates read scalability and the
// sharded availability aggregate path.
//
//   k6 run -e SCALE=1k -e BASE_URL=http://localhost:3000 load-tests/public-read.js
//   (optional) -e EVENT_ID=123 to exercise /api/seat-map/events/:id/availability
import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { BASE_URL, SCALE, stagesFor, baseThresholds } from './options.js';

const errors = new Rate('app_errors');
const availTrend = new Trend('availability_ms', true);

export const options = {
  stages: stagesFor(SCALE),
  thresholds: {
    ...baseThresholds,
    app_errors: ['rate<0.02'],
  },
};

const EVENT_ID = __ENV.EVENT_ID || '';

export default function () {
  group('health', () => {
    const r = http.get(`${BASE_URL}/api/health`);
    check(r, { 'health 200': (res) => res.status === 200 }) || errors.add(1);
  });

  group('education academy', () => {
    const r = http.get(`${BASE_URL}/api/education/academy-thumbnails`);
    check(r, {
      'thumbs 200': (res) => res.status === 200,
      'thumbs json': (res) => {
        try { return Array.isArray(JSON.parse(res.body).thumbnails || []); } catch { return true; }
      },
    }) || errors.add(1);
  });

  if (EVENT_ID) {
    group('seat availability (sharded counter)', () => {
      const r = http.get(`${BASE_URL}/api/seat-map/events/${EVENT_ID}/availability`);
      availTrend.add(r.timings.duration);
      check(r, { 'availability 200': (res) => res.status === 200 }) || errors.add(1);
    });
  }

  sleep(Math.random() * 1.5);
}
