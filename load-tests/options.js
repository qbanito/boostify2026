// Shared k6 options & stage profiles.
// Pick a scale with the SCALE env var: 100 | 1k | 5k | 10k (default 100).
//   k6 run -e SCALE=1k -e BASE_URL=https://boostifymusic.com load-tests/<script>.js

const PROFILES = {
  '100': [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '20s', target: 0 },
  ],
  '1k': [
    { duration: '1m', target: 1000 },
    { duration: '2m', target: 1000 },
    { duration: '30s', target: 0 },
  ],
  '5k': [
    { duration: '2m', target: 5000 },
    { duration: '3m', target: 5000 },
    { duration: '1m', target: 0 },
  ],
  '10k': [
    { duration: '3m', target: 10000 },
    { duration: '5m', target: 10000 },
    { duration: '1m', target: 0 },
  ],
};

export const SCALE = __ENV.SCALE || '100';
export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

export function stagesFor(scale) {
  return PROFILES[scale] || PROFILES['100'];
}

// Common thresholds — tune per environment. p95 latency + low error rate.
export const baseThresholds = {
  http_req_failed: ['rate<0.02'], // <2% request errors
  http_req_duration: ['p(95)<800', 'p(99)<2000'],
};
