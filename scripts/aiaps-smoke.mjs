#!/usr/bin/env node
/**
 * AIAPS smoke test — verifies every critical endpoint end-to-end.
 *
 * Usage:
 *   BOOSTIFY_ADMIN_TOKEN=xxxxx BASE_URL=http://localhost:5000 node scripts/aiaps-smoke.mjs
 *
 * Alternatively, set BOOSTIFY_ADMIN_COOKIE if you are using cookie-based auth.
 * The script exits 0 on full success, 1 on any failure.
 */
const BASE = process.env.BASE_URL || 'http://localhost:5000';
const TOKEN = process.env.BOOSTIFY_ADMIN_TOKEN;
const COOKIE = process.env.BOOSTIFY_ADMIN_COOKIE;

if (!TOKEN && !COOKIE) {
  console.error('[smoke] Need BOOSTIFY_ADMIN_TOKEN or BOOSTIFY_ADMIN_COOKIE');
  process.exit(2);
}

function headers() {
  const h = { 'Content-Type': 'application/json' };
  if (TOKEN) h.Authorization = `Bearer ${TOKEN}`;
  if (COOKIE) h.Cookie = COOKIE;
  return h;
}

async function call(method, path, body) {
  const resp = await fetch(`${BASE}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await resp.text();
  let data; try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: resp.status, data };
}

const results = [];
async function step(label, fn) {
  const t0 = Date.now();
  try {
    const out = await fn();
    const ok = out?.ok !== false && out?.status < 400;
    results.push({ label, ok, ms: Date.now() - t0, status: out?.status, detail: out?.data?.error || '' });
    console.log(`${ok ? '✅' : '❌'} ${label} (${Date.now() - t0}ms, status=${out?.status})`);
    return out?.data;
  } catch (err) {
    results.push({ label, ok: false, ms: Date.now() - t0, status: 'ERR', detail: err.message });
    console.log(`❌ ${label} — ${err.message}`);
    return null;
  }
}

(async () => {
  console.log(`[smoke] BASE=${BASE}\n`);

  await step('GET /api/admin/artist-identity/diagnostic', () =>
    call('GET', '/api/admin/artist-identity/diagnostic'),
  );

  const overview = await step('GET /overview', () =>
    call('GET', '/api/admin/artist-identity/overview'),
  );

  const testId = `BTF_SMOKE_${Date.now()}`;
  await step(`POST /artists (create ${testId})`, () =>
    call('POST', '/api/admin/artist-identity/artists', {
      id: testId, stage_name: 'Smoke Test', genre_primary: 'pop', visual_style: 'cinematic',
    }),
  );

  await step('POST /artists/:id/generate-identity', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/generate-identity`, {}),
  );
  await step('POST /artists/:id/generate-usernames', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/generate-usernames`, { platform: 'instagram' }),
  );
  await step('POST /artists/:id/provision-emails', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/provision-emails`, { roles: ['primary', 'recovery'] }),
  );
  await step('POST /artists/:id/purchase-phone (mock)', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/purchase-phone`, { country: 'US', purpose: 'verification' }),
  );
  await step('POST /artists/:id/provision-account (instagram)', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/provision-account`, { platform: 'instagram' }),
  );
  await step('POST /artists/:id/provision-account (tiktok)', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/provision-account`, { platform: 'tiktok' }),
  );
  await step('POST /artists/:id/warmup/generate', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/warmup/generate`, { platform: 'instagram', phase: 1 }),
  );
  await step('POST /artists/:id/generate-images', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/generate-images`, {}),
  );
  await step('POST /artists/:id/recompute-readiness', () =>
    call('POST', `/api/admin/artist-identity/artists/${testId}/recompute-readiness`, {}),
  );
  await step('GET /artists/:id/compliance', () =>
    call('GET', `/api/admin/artist-identity/artists/${testId}/compliance`),
  );
  await step('POST /health/snapshot (full)', () =>
    call('POST', '/api/admin/artist-identity/health/snapshot', {}),
  );

  // Jobs queue test
  const enq = await step('POST /jobs (enqueue signup)', () =>
    call('POST', '/api/admin/artist-identity/jobs', {
      kind: 'signup', platform: 'instagram', artist_id: testId, payload: { test: true },
    }),
  );
  await step('POST /jobs/claim', () =>
    call('POST', '/api/admin/artist-identity/jobs/claim', { worker_id: 'smoke-worker', platforms: ['instagram'] }),
  );
  if (enq?.id) {
    await step('POST /jobs/:id/report (ok)', () =>
      call('POST', `/api/admin/artist-identity/jobs/${enq.id}/report`, { worker_id: 'smoke-worker', ok: true, data: { smoke: 'ok' } }),
    );
  }

  // Operators
  await step('POST /operators (upsert smoke)', () =>
    call('POST', '/api/admin/artist-identity/operators', {
      email: 'smoke@boostify.local', role: 'auditor', display_name: 'Smoke Tester',
    }),
  );
  await step('GET /operators', () => call('GET', '/api/admin/artist-identity/operators'));

  // Summary
  console.log('\n════════════════════════ SMOKE SUMMARY ════════════════════════');
  const pass = results.filter((r) => r.ok).length;
  console.log(`${pass}/${results.length} tests passed`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.log('\nFailures:');
    for (const f of failed) console.log(`  ❌ ${f.label} — ${f.status} ${f.detail}`);
  }
  process.exit(failed.length ? 1 : 0);
})();
