#!/usr/bin/env node
/**
 * Artist Career Suite — exhaustive diagnostic
 *
 *   node test-artist-suite.mjs
 *
 * Env:
 *   ARTIST_SUITE_BASE   default http://localhost:3000
 *   ADMIN_EMAIL         default convoycubano@gmail.com (must be in shared/constants ADMIN_EMAILS)
 *   ARTIST_ID           default 'test-artist-001'  (uses dev x-admin-email so we skip Clerk)
 *
 * IMPORTANT: this script uses the dev admin header (ALLOW_DEV_ADMIN_HEADER=1)
 * for every call (since the dev server has it enabled). That makes the
 * admin requester also pass requireAuth on artist endpoints (because
 * ensureSelfOrAdmin lets admins through), so we don't need a Clerk session.
 */

const BASE = process.env.ARTIST_SUITE_BASE || 'http://localhost:3000';
const ADMIN = process.env.ADMIN_EMAIL || 'convoycubano@gmail.com';
const ARTIST_ID = process.env.ARTIST_ID || 'test-artist-001';

const HEAD_ADMIN = {
  'x-admin-email': ADMIN,
  'Content-Type': 'application/json',
};

const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[36m${s}\x1b[0m`,
  d: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

let pass = 0;
let fail = 0;
let warn = 0;
const results = [];

function record(name, status, details = '') {
  const tag =
    status === 'PASS'
      ? c.g('✅ PASS')
      : status === 'FAIL'
      ? c.r('❌ FAIL')
      : status === 'WARN'
      ? c.y('⚠️  WARN')
      : c.d('ℹ️  INFO');
  console.log(`  ${tag} ${name}${details ? c.d(' — ' + details) : ''}`);
  results.push({ name, status, details });
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  else if (status === 'WARN') warn++;
}

function section(t) {
  console.log('\n' + c.bold(c.b('━'.repeat(70))));
  console.log(c.bold(c.b(`  ${t}`)));
  console.log(c.bold(c.b('━'.repeat(70))));
}

async function req(path, opts = {}) {
  const url = `${BASE}${path}`;
  const init = {
    method: opts.method || 'GET',
    headers: HEAD_ADMIN,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  };
  const t0 = Date.now();
  try {
    const r = await fetch(url, init);
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try {
      json = JSON.parse(text);
    } catch {}
    return { ok: r.ok, status: r.status, ms, text, json };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e.message };
  }
}

// ───────────── tests ─────────────

async function testHealth() {
  section('1. Server reachable');
  const r = await req('/api/admin/c-suite/settings');
  if (r.status === 200) record('Server is up & admin auth works', 'PASS', `${r.ms}ms`);
  else record('Server unreachable or admin auth broken', 'FAIL', `status=${r.status} ${r.error || ''}`);
  return r.status === 200;
}

async function testCatalog() {
  section('2. Public catalog');
  const r = await req('/api/artist/suite/catalog');
  if (r.json?.ok && Array.isArray(r.json.personalAgents) && r.json.personalAgents.length === 5) {
    record(
      'GET /api/artist/suite/catalog returns 5 personal agents',
      'PASS',
      r.json.personalAgents.map((a) => a.agentKey).join(','),
    );
  } else {
    record('catalog endpoint failed', 'FAIL', r.text?.slice(0, 200));
    return false;
  }
  if (Array.isArray(r.json.corporateAgents) && r.json.corporateAgents.length === 10) {
    record('catalog includes 10 corporate agents', 'PASS', r.json.corporateAgents.join(','));
  } else {
    record('catalog corporate agent count off', 'WARN', `got ${r.json.corporateAgents?.length}`);
  }
  return true;
}

async function cleanup() {
  // Best-effort: cancel any leftover subscription for ARTIST_ID
  await req('/api/artist/suite/cancel', {
    method: 'POST',
    body: { artistId: ARTIST_ID },
  });
}

async function testActivationFlow() {
  section('3. Activation lifecycle (admin-self-activate path)');
  await cleanup();

  // Initial status (no subscription)
  const r0 = await req(`/api/artist/suite/status?artistId=${ARTIST_ID}`);
  if (r0.json?.ok && r0.json.subscription === null) {
    record('Status endpoint returns null subscription before activation', 'PASS');
  } else if (r0.json?.subscription?.status === 'cancelled') {
    record('Pre-existing cancelled subscription detected (will reuse row)', 'INFO');
  } else {
    record('Unexpected initial status response', 'WARN', JSON.stringify(r0.json).slice(0, 200));
  }

  // Activate as admin → should auto-approve
  const r1 = await req('/api/artist/suite/activate', {
    method: 'POST',
    body: { artistId: ARTIST_ID, note: 'diagnostic-self-activate' },
  });
  if (r1.json?.ok && r1.json.autoApproved && r1.json.subscription?.status === 'approved') {
    record('Admin self-activate auto-approves', 'PASS', `id=${r1.json.subscription.id}`);
  } else {
    record('Admin self-activate did NOT auto-approve', 'FAIL', JSON.stringify(r1.json).slice(0, 200));
    return false;
  }
  if (r1.json.seeded?.inserted?.length === 5 || r1.json.seeded?.total === 5) {
    record('5 personal agents seeded', 'PASS', `inserted=${(r1.json.seeded?.inserted || []).join(',')}`);
  } else {
    record('Personal agent seed count unexpected', 'WARN', JSON.stringify(r1.json.seeded));
  }

  // Re-fetch status
  const r2 = await req(`/api/artist/suite/status?artistId=${ARTIST_ID}`);
  if (r2.json?.active && r2.json.agents?.length >= 5) {
    record('Status reports active + 5 agents present', 'PASS');
  } else {
    record('Status post-activation incomplete', 'FAIL', JSON.stringify(r2.json).slice(0, 200));
  }
  return true;
}

async function testApprovalEndpoints() {
  section('4. Admin approval endpoints');
  // Create a second pending subscription via a non-admin path: simulate by calling
  // activate with an artistId different from any admin (we still send admin header,
  // but the route auto-approves when isRequesterAdmin → so to test pending we need
  // a workaround). We'll instead just hit /admin/artist-suite/* listings.
  const r1 = await req('/api/admin/artist-suite/subscriptions');
  if (r1.json?.ok && Array.isArray(r1.json.subscriptions)) {
    record('GET /admin/artist-suite/subscriptions', 'PASS', `${r1.json.subscriptions.length} rows`);
  } else {
    record('GET subscriptions failed', 'FAIL', r1.text?.slice(0, 200));
  }

  const r2 = await req('/api/admin/artist-suite/requests?status=pending');
  if (r2.json?.ok) record('GET /admin/artist-suite/requests', 'PASS', `${r2.json.requests.length} pending`);
  else record('GET requests failed', 'FAIL');

  const r3 = await req('/api/admin/artist-suite/stats');
  if (r3.json?.ok && r3.json.stats) {
    record('GET /admin/artist-suite/stats', 'PASS', JSON.stringify(r3.json.stats));
  } else record('stats endpoint failed', 'FAIL');
}

async function testCommandPersonal() {
  section('5. Personal-agent chat (live OpenAI call)');
  const r = await req('/api/artist/suite/command', {
    method: 'POST',
    body: {
      artistId: ARTIST_ID,
      agentKey: 'manager',
      sessionType: 'personal',
      message: 'Give me one sentence: am I online?',
    },
  });
  if (r.json?.ok && r.json.result?.threadId) {
    record(
      'Personal manager replied',
      'PASS',
      `thread=${r.json.result.threadId} cost=$${r.json.result.totalCostUsd?.toFixed(5)}`,
    );
    return r.json.result.threadId;
  }
  record('Personal manager command failed', 'FAIL', r.text?.slice(0, 300));
  return null;
}

async function testCommandCorporate() {
  section('6. Corporate consultation chat');
  const r = await req('/api/artist/suite/command', {
    method: 'POST',
    body: {
      artistId: ARTIST_ID,
      agentKey: 'cfo',
      sessionType: 'corporate',
      message: 'Reply with exactly two words.',
    },
  });
  if (r.json?.ok && r.json.result) {
    record(
      'Corporate CFO consultation replied',
      'PASS',
      `cost=$${r.json.result.totalCostUsd?.toFixed(5)}`,
    );
  } else if (r.json?.error?.includes('not seeded')) {
    record('Corporate CFO requires bootstrap', 'WARN', r.json.error);
  } else {
    record('Corporate CFO consultation failed', 'FAIL', r.text?.slice(0, 300));
  }
}

async function testThreadsAndMessages(threadId) {
  section('7. Threads + messages');
  const r1 = await req(`/api/artist/suite/threads?artistId=${ARTIST_ID}`);
  if (r1.json?.ok && Array.isArray(r1.json.threads)) {
    record(`GET threads → ${r1.json.threads.length}`, 'PASS');
  } else record('GET threads failed', 'FAIL');

  if (threadId) {
    const r2 = await req(
      `/api/artist/suite/threads/${threadId}/messages?artistId=${ARTIST_ID}`,
    );
    if (r2.json?.ok && Array.isArray(r2.json.messages) && r2.json.messages.length >= 2) {
      record(`GET thread/${threadId}/messages → ${r2.json.messages.length}`, 'PASS');
    } else record('thread messages incomplete', 'WARN', JSON.stringify(r2.json).slice(0, 200));
  }
}

async function testGoals() {
  section('8. Goals');
  const r1 = await req('/api/artist/suite/goals', {
    method: 'POST',
    body: {
      artistId: ARTIST_ID,
      ownerAgent: 'manager',
      title: 'Diag goal — reach 10k monthly listeners',
      metric: 'monthly_listeners',
      targetValue: 10000,
    },
  });
  if (r1.json?.ok && r1.json.goal?.id) record('POST /goals', 'PASS', `id=${r1.json.goal.id}`);
  else record('POST /goals failed', 'FAIL', r1.text?.slice(0, 200));

  const r2 = await req(`/api/artist/suite/goals?artistId=${ARTIST_ID}`);
  if (r2.json?.ok && Array.isArray(r2.json.goals)) record(`GET goals → ${r2.json.goals.length}`, 'PASS');
  else record('GET goals failed', 'FAIL');
}

async function testSettings() {
  section('9. Settings');
  const r1 = await req(`/api/artist/suite/settings?artistId=${ARTIST_ID}`);
  if (r1.json?.ok) record('GET settings', 'PASS', JSON.stringify(r1.json.settings).slice(0, 100));
  else record('GET settings failed', 'FAIL');

  const r2 = await req('/api/artist/suite/settings', {
    method: 'PATCH',
    body: { artistId: ARTIST_ID, dryRunGlobal: true, notes: 'diag run' },
  });
  if (r2.json?.ok) record('PATCH settings', 'PASS');
  else record('PATCH settings failed', 'FAIL', r2.text?.slice(0, 200));
}

async function testKillSwitch() {
  section('10. Kill switch enforcement');
  await req('/api/artist/suite/settings', {
    method: 'PATCH',
    body: { artistId: ARTIST_ID, killSwitch: true },
  });
  const r = await req('/api/artist/suite/command', {
    method: 'POST',
    body: {
      artistId: ARTIST_ID,
      agentKey: 'manager',
      sessionType: 'personal',
      message: 'are you online?',
    },
  });
  if (!r.json?.ok && /kill switch/i.test(r.json?.error || '')) {
    record('Kill switch blocks command', 'PASS', r.json.error);
  } else {
    record('Kill switch did NOT block command', 'FAIL', JSON.stringify(r.json).slice(0, 200));
  }
  // Restore
  await req('/api/artist/suite/settings', {
    method: 'PATCH',
    body: { artistId: ARTIST_ID, killSwitch: false },
  });
}

async function testCancelAndCleanup() {
  section('11. Cancel + cleanup');
  const r = await req('/api/artist/suite/cancel', {
    method: 'POST',
    body: { artistId: ARTIST_ID },
  });
  if (r.json?.ok && r.json.subscription?.status === 'cancelled') record('Cancel succeeds', 'PASS');
  else record('Cancel failed', 'WARN', JSON.stringify(r.json).slice(0, 200));
}

// ───────────── runner ─────────────

(async () => {
  console.log(c.bold(c.b('🎯 Artist Career Suite Diagnostic\n')));
  console.log(c.d(`base=${BASE} admin=${ADMIN} artistId=${ARTIST_ID}\n`));

  const ok = await testHealth();
  if (!ok) {
    console.log(c.r('\n❌ aborting: server not reachable\n'));
    process.exit(1);
  }
  await testCatalog();
  await testActivationFlow();
  await testApprovalEndpoints();
  const threadId = await testCommandPersonal();
  await testCommandCorporate();
  await testThreadsAndMessages(threadId);
  await testGoals();
  await testSettings();
  await testKillSwitch();
  await testCancelAndCleanup();

  section('SUMMARY');
  console.log(`  ${c.g('✅ PASS')} ${pass}`);
  console.log(`  ${c.y('⚠️  WARN')} ${warn}`);
  console.log(`  ${c.r('❌ FAIL')} ${fail}`);
  console.log(`  Total: ${pass + warn + fail}`);
  if (fail > 0) {
    console.log('\n' + c.r('Failures:'));
    for (const f of results.filter((r) => r.status === 'FAIL')) {
      console.log(`  - ${f.name}: ${f.details}`);
    }
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error(c.r('\nFATAL:'), e);
  process.exit(2);
});
