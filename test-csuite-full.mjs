#!/usr/bin/env node
/**
 * Exhaustive C-Suite AI System diagnostic
 * Tests every endpoint, every agent, runtime, goals, approvals, memory, settings.
 *
 * Usage: node test-csuite-full.mjs
 */

const BASE = process.env.CSUITE_BASE || 'http://localhost:3000';
const ADMIN = process.env.ADMIN_EMAIL || 'convoycubano@gmail.com';
const HEAD = { 'x-admin-email': ADMIN, 'Content-Type': 'application/json' };

const results = [];
let pass = 0, fail = 0, warn = 0;

const c = {
  g: (s) => `\x1b[32m${s}\x1b[0m`,
  r: (s) => `\x1b[31m${s}\x1b[0m`,
  y: (s) => `\x1b[33m${s}\x1b[0m`,
  b: (s) => `\x1b[36m${s}\x1b[0m`,
  d: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

function record(name, status, details = '') {
  const tag =
    status === 'PASS' ? c.g('✅ PASS') :
    status === 'FAIL' ? c.r('❌ FAIL') :
    status === 'WARN' ? c.y('⚠️  WARN') : c.d('ℹ️  INFO');
  console.log(`  ${tag} ${name}${details ? c.d(' — ' + details) : ''}`);
  results.push({ name, status, details });
  if (status === 'PASS') pass++;
  else if (status === 'FAIL') fail++;
  else if (status === 'WARN') warn++;
}

function section(title) {
  console.log('\n' + c.bold(c.b('━'.repeat(70))));
  console.log(c.bold(c.b(`  ${title}`)));
  console.log(c.bold(c.b('━'.repeat(70))));
}

async function req(path, opts = {}) {
  const url = `${BASE}${path}`;
  const init = {
    method: opts.method || 'GET',
    headers: HEAD,
    ...(opts.body ? { body: JSON.stringify(opts.body) } : {}),
  };
  const t0 = Date.now();
  try {
    const r = await fetch(url, init);
    const ms = Date.now() - t0;
    const text = await r.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { ok: r.ok, status: r.status, ms, text, json };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: e.message };
  }
}

// ────────────────────────────────────────────────────────────
async function main() {
  console.log(c.bold(c.b('\n╔══════════════════════════════════════════════════════════════════════╗')));
  console.log(c.bold(c.b('║          C-SUITE AI · EXHAUSTIVE DIAGNOSTIC TEST                     ║')));
  console.log(c.bold(c.b('╚══════════════════════════════════════════════════════════════════════╝')));
  console.log(c.d(`  Base: ${BASE}`));
  console.log(c.d(`  Admin: ${ADMIN}`));
  console.log(c.d(`  Started: ${new Date().toISOString()}`));

  // ── 1. Connectivity ────────────────────────────────────────
  section('1️⃣  CONNECTIVITY & AUTH');
  {
    const r = await req('/api/admin/c-suite/agents');
    if (r.status === 0) {
      record('Backend reachable', 'FAIL', r.error);
      console.log(c.r('\n  Backend is DOWN. Start with: npm run dev'));
      return summary();
    }
    record('Backend reachable', 'PASS', `HTTP ${r.status} in ${r.ms}ms`);
    if (r.status === 401 || r.status === 403) {
      record('Admin auth (x-admin-email)', 'FAIL', `HTTP ${r.status} — set ALLOW_DEV_ADMIN_HEADER=1`);
      return summary();
    }
    record('Admin auth (x-admin-email)', 'PASS');
  }

  // ── 2. Agents ──────────────────────────────────────────────
  section('2️⃣  AGENTS REGISTRY (10 expected)');
  let agents = [];
  {
    const r = await req('/api/admin/c-suite/agents');
    if (!r.ok) { record('GET /agents', 'FAIL', `HTTP ${r.status}`); return summary(); }
    agents = Array.isArray(r.json) ? r.json : (r.json?.agents || r.json?.data || []);
    record('GET /agents', 'PASS', `${agents.length} agents · ${r.ms}ms`);

    const expected = ['ceo','cmo','cro','cpo','cfo','coo','cto','clo','cdo','ciso'];
    const found = agents.map(a => a.id);
    const missing = expected.filter(e => !found.includes(e));
    if (missing.length === 0) {
      record('All 10 expected agent IDs present', 'PASS');
    } else {
      record('Expected agent IDs', 'FAIL', `missing: ${missing.join(',')}`);
    }

    let active = 0, autonomyOk = 0, dryRun = 0;
    for (const a of agents) {
      if (a.active) active++;
      if ((a.autonomy ?? 0) >= 3) autonomyOk++;
      if (a.dryRun || a.dry_run) dryRun++;
    }
    record(`Active agents: ${active}/${agents.length}`, active >= 8 ? 'PASS' : 'WARN');
    record(`Autonomy >= 3: ${autonomyOk}/${agents.length}`, autonomyOk >= 8 ? 'PASS' : 'WARN');
    record(`DryRun ON: ${dryRun}/${agents.length}`, dryRun === 0 ? 'PASS' : 'WARN', dryRun > 0 ? 'agents in dry-run cannot execute writes' : '');
  }

  // ── 3. Settings ────────────────────────────────────────────
  section('3️⃣  GLOBAL SETTINGS (kill-switch / dry-run / budget)');
  {
    const r = await req('/api/admin/c-suite/settings');
    if (!r.ok) { record('GET /settings', 'FAIL', `HTTP ${r.status}`); }
    else {
      record('GET /settings', 'PASS', `${r.ms}ms`);
      const s = r.json || {};
      record(`killSwitch = ${s.killSwitch ?? s.kill_switch ?? 'unknown'}`,
        (s.killSwitch || s.kill_switch) ? 'FAIL' : 'PASS',
        (s.killSwitch || s.kill_switch) ? 'AGENTS PAUSED — turn off to test' : '');
      record(`globalDryRun = ${s.globalDryRun ?? s.global_dry_run ?? 'unknown'}`,
        (s.globalDryRun || s.global_dry_run) ? 'WARN' : 'PASS',
        (s.globalDryRun || s.global_dry_run) ? 'writes blocked globally' : '');
      const budget = s.dailyTokenBudgetUsd ?? s.daily_token_budget_usd ?? s.settings?.dailyTokenBudgetUsd ?? 0;
      // $0 = unlimited (acceptable in dev)
      record(`dailyTokenBudgetUsd = $${budget}`, 'PASS', budget === 0 ? 'unlimited (dev mode OK)' : '');
    }
  }

  // ── 4. Goal presets ────────────────────────────────────────
  section('4️⃣  GOAL PRESETS (15 expected)');
  let presets = [];
  {
    const r = await req('/api/admin/c-suite/goals/presets');
    if (!r.ok) record('GET /goals/presets', 'FAIL', `HTTP ${r.status}`);
    else {
      presets = Array.isArray(r.json) ? r.json : (r.json?.presets || []);
      record('GET /goals/presets', 'PASS', `${presets.length} presets · ${r.ms}ms`);
      record(`Preset count >= 14`, presets.length >= 14 ? 'PASS' : 'WARN');
    }
  }

  // ── 5. Goals list ──────────────────────────────────────────
  section('5️⃣  GOALS LIST');
  let goals = [];
  {
    const r = await req('/api/admin/c-suite/goals');
    if (!r.ok) record('GET /goals', 'FAIL', `HTTP ${r.status}`);
    else {
      goals = Array.isArray(r.json) ? r.json : (r.json?.goals || []);
      record('GET /goals', 'PASS', `${goals.length} existing goals · ${r.ms}ms`);
    }
  }

  // ── 6. Stats ───────────────────────────────────────────────
  section('6️⃣  DASHBOARD STATS');
  {
    const r = await req('/api/admin/c-suite/stats');
    if (!r.ok) record('GET /stats', 'FAIL', `HTTP ${r.status}`);
    else {
      record('GET /stats', 'PASS', `${r.ms}ms`);
      const s = r.json || {};
      console.log(c.d(`     ${JSON.stringify(s).slice(0, 200)}`));
    }
  }

  // ── 7. Approvals ───────────────────────────────────────────
  section('7️⃣  APPROVALS QUEUE');
  {
    const r = await req('/api/admin/c-suite/approvals');
    if (!r.ok) record('GET /approvals', 'FAIL', `HTTP ${r.status}`);
    else {
      const list = Array.isArray(r.json) ? r.json : (r.json?.approvals || []);
      record('GET /approvals', 'PASS', `${list.length} pending · ${r.ms}ms`);
    }
  }

  // ── 8. Self-improvement ────────────────────────────────────
  section('8️⃣  SELF-IMPROVEMENT LOG');
  {
    const r = await req('/api/admin/c-suite/self-improvement');
    if (!r.ok) record('GET /self-improvement', 'FAIL', `HTTP ${r.status}`);
    else {
      const list = Array.isArray(r.json) ? r.json : (r.json?.issues || r.json?.items || []);
      record('GET /self-improvement', 'PASS', `${list.length} entries · ${r.ms}ms`);
    }
  }

  // ── 9. Threads ─────────────────────────────────────────────
  section('9️⃣  THREADS HISTORY');
  let threadsCount = 0;
  {
    const r = await req('/api/admin/c-suite/threads');
    if (!r.ok) record('GET /threads', 'FAIL', `HTTP ${r.status}`);
    else {
      const list = Array.isArray(r.json) ? r.json : (r.json?.threads || []);
      threadsCount = list.length;
      record('GET /threads', 'PASS', `${list.length} threads · ${r.ms}ms`);
    }
  }

  // ── 10. Per-agent memory ───────────────────────────────────
  section('🔟 PER-AGENT MEMORY');
  {
    let okCount = 0;
    for (const a of agents.slice(0, 4)) {
      const r = await req(`/api/admin/c-suite/memory/${a.id}`);
      if (r.ok) okCount++;
      record(`memory/${a.id}`, r.ok ? 'PASS' : 'FAIL', `HTTP ${r.status} · ${r.ms}ms`);
    }
  }

  // ── 11. SSE stream ─────────────────────────────────────────
  section('1️⃣1️⃣ SSE EVENT STREAM');
  {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 2500);
      const r = await fetch(`${BASE}/api/admin/c-suite/stream`, {
        headers: HEAD,
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (r.ok && (r.headers.get('content-type') || '').includes('event-stream')) {
        record('GET /stream (SSE handshake)', 'PASS', `content-type=${r.headers.get('content-type')}`);
      } else {
        record('GET /stream', 'WARN', `HTTP ${r.status} · ct=${r.headers.get('content-type')}`);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        record('GET /stream (SSE handshake)', 'PASS', 'connection held open (expected)');
      } else {
        record('GET /stream', 'FAIL', e.message);
      }
    }
  }

  // ── 12. RUNTIME — actual agent turn (live OpenAI call) ─────
  section('1️⃣2️⃣ RUNTIME · LIVE AGENT TURN (OpenAI)');
  {
    const cdo = agents.find(a => a.id === 'cdo') || agents.find(a => a.active) || agents[0];
    if (!cdo) {
      record('Agent runtime', 'FAIL', 'no agents available');
    } else {
      console.log(c.d(`     Sending message to ${cdo.id} ("${cdo.role || cdo.name || ''}")`));
      const r = await req('/api/admin/c-suite/command', {
        method: 'POST',
        body: {
          agentId: cdo.id,
          message: 'Diagnostic ping: respond with one short sentence confirming you are operational and list your top 1 KPI you would query.',
        },
      });
      if (r.status === 0) {
        record('POST /command runtime', 'FAIL', r.error);
      } else if (r.status === 429 || (r.text && r.text.includes('insufficient_quota'))) {
        record('POST /command runtime', 'WARN', 'OpenAI quota exhausted — agent loop reachable but cannot reason');
      } else if (!r.ok) {
        record('POST /command runtime', 'FAIL', `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
      } else {
        record('POST /command runtime', 'PASS', `${r.ms}ms`);
        const reply = r.json?.reply || r.json?.message || r.json?.content || JSON.stringify(r.json).slice(0, 300);
        console.log(c.d(`     Reply: ${String(reply).slice(0, 300)}`));
      }
    }
  }

  // ── 13. GOALS · create from preset (live agent dispatch) ───
  section('1️⃣3️⃣ GOALS · APPLY PRESET (live dispatch)');
  let createdGoalId = null;
  {
    if (presets.length === 0) {
      record('from-preset', 'WARN', 'no presets to test');
    } else {
      // pick a low-risk read-only preset (cdo/cmo if present)
      const target = presets.find(p => ['nps_50', 'virality_1_3', 'feature_adoption_75'].includes(p.key))
        || presets[0];
      console.log(c.d(`     Using preset: ${target.key} (owner=${target.ownerAgent || target.owner_agent})`));
      const r = await req('/api/admin/c-suite/goals/from-preset', {
        method: 'POST',
        body: { presetKey: target.key, autoExecute: false }, // do not burn tokens
      });
      if (!r.ok) {
        record('POST /goals/from-preset', 'FAIL', `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
      } else {
        const g = r.json?.goal || r.json;
        createdGoalId = g?.id;
        record('POST /goals/from-preset', 'PASS', `goalId=${createdGoalId} · ${r.ms}ms`);
      }
    }
  }

  // ── 14. GOALS · re-execute existing goal endpoint ──────────
  section('1️⃣4️⃣ GOALS · /:id/execute endpoint');
  {
    const id = createdGoalId || (goals[0] && goals[0].id);
    if (!id) {
      record('execute endpoint', 'WARN', 'no goal id available to test');
    } else {
      // Fire-and-forget HEAD-style: just verify route exists by sending real request
      const r = await req(`/api/admin/c-suite/goals/${id}/execute`, { method: 'POST' });
      if (r.status === 0) {
        record(`POST /goals/${id}/execute`, 'FAIL', r.error);
      } else if (r.status === 404) {
        record(`POST /goals/${id}/execute`, 'FAIL', 'route not registered (404)');
      } else if (r.status === 429 || (r.text && r.text.includes('insufficient_quota'))) {
        record(`POST /goals/${id}/execute`, 'WARN', 'OpenAI quota exhausted, but route works');
      } else if (!r.ok) {
        record(`POST /goals/${id}/execute`, 'WARN', `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
      } else {
        record(`POST /goals/${id}/execute`, 'PASS', `${r.ms}ms`);
      }
    }
  }

  // ── 15. GOALS · DELETE endpoint ────────────────────────────
  section('1️⃣5️⃣ GOALS · DELETE /:id');
  {
    if (!createdGoalId) {
      record('DELETE goal', 'WARN', 'nothing to delete (create failed earlier)');
    } else {
      const r = await req(`/api/admin/c-suite/goals/${createdGoalId}`, { method: 'DELETE' });
      if (r.ok) record(`DELETE /goals/${createdGoalId}`, 'PASS', `${r.ms}ms`);
      else record(`DELETE /goals/${createdGoalId}`, 'FAIL', `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
    }
  }

  // ── 16. Self-improvement run ───────────────────────────────
  section('1️⃣6️⃣ SELF-IMPROVEMENT · trigger CTO cycle');
  {
    const r = await req('/api/admin/c-suite/self-improvement/run', { method: 'POST' });
    if (r.status === 0) record('POST /self-improvement/run', 'FAIL', r.error);
    else if (r.status === 429 || (r.text && r.text.includes('insufficient_quota'))) {
      record('POST /self-improvement/run', 'WARN', 'OpenAI quota exhausted, route reachable');
    } else if (!r.ok) record('POST /self-improvement/run', 'WARN', `HTTP ${r.status}: ${r.text.slice(0, 200)}`);
    else record('POST /self-improvement/run', 'PASS', `${r.ms}ms`);
  }

  // ── 17. Briefing run ───────────────────────────────────────
  section('1️⃣7️⃣ DAILY BRIEFING · trigger');
  {
    const r = await req('/api/admin/c-suite/briefing/run', { method: 'POST' });
    if (r.status === 0) record('POST /briefing/run', 'FAIL', r.error);
    else if (r.status === 429 || (r.text && r.text.includes('insufficient_quota'))) {
      record('POST /briefing/run', 'WARN', 'OpenAI quota exhausted, route reachable');
    } else if (r.status === 404) record('POST /briefing/run', 'WARN', 'route not implemented');
    else if (!r.ok) record('POST /briefing/run', 'WARN', `HTTP ${r.status}`);
    else record('POST /briefing/run', 'PASS', `${r.ms}ms`);
  }

  summary();
}

function summary() {
  console.log('\n' + c.bold(c.b('━'.repeat(70))));
  console.log(c.bold('  📋 SUMMARY'));
  console.log(c.bold(c.b('━'.repeat(70))));
  console.log(`  ${c.g('PASS')}: ${pass}`);
  console.log(`  ${c.y('WARN')}: ${warn}`);
  console.log(`  ${c.r('FAIL')}: ${fail}`);
  console.log(`  TOTAL: ${results.length}`);

  if (fail > 0) {
    console.log('\n' + c.r(c.bold('  ❌ FAILURES:')));
    for (const r of results.filter(x => x.status === 'FAIL')) {
      console.log(`     - ${r.name}${r.details ? ': ' + r.details : ''}`);
    }
  }
  if (warn > 0) {
    console.log('\n' + c.y(c.bold('  ⚠️  WARNINGS:')));
    for (const r of results.filter(x => x.status === 'WARN')) {
      console.log(`     - ${r.name}${r.details ? ': ' + r.details : ''}`);
    }
  }

  console.log('\n' + c.bold(c.b('━'.repeat(70))));
  if (fail === 0 && warn === 0) {
    console.log(c.g(c.bold('  🎉 ALL SYSTEMS GO — C-Suite is fully operational')));
  } else if (fail === 0) {
    console.log(c.y(c.bold('  ⚠️  OPERATIONAL with warnings (review above)')));
  } else {
    console.log(c.r(c.bold('  ❌ FAILURES DETECTED — fix items above')));
  }
  console.log(c.bold(c.b('━'.repeat(70))) + '\n');

  process.exit(fail > 0 ? 1 : 0);
}

main().catch(e => {
  console.error(c.r('\nFATAL: ' + e.stack));
  process.exit(2);
});
