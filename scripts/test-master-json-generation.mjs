#!/usr/bin/env node
/**
 * Master JSON Generation Test
 * A: DB column + GIN index check
 * B: Service unit test via temp CJS helper
 * C: Full API pipeline test (needs server running)
 *
 * Run: node --require dotenv/config scripts/test-master-json-generation.mjs
 */
import { createRequire } from 'module';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

const require = createRequire(import.meta.url);
const fetch = (await import('node-fetch')).default;
const { neon } = require('@neondatabase/serverless');

const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red   = (s) => `\x1b[31m${s}\x1b[0m`;
const yel   = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan  = (s) => `\x1b[36m${s}\x1b[0m`;
const bold  = (s) => `\x1b[1m${s}\x1b[0m`;
const gray  = (s) => `\x1b[90m${s}\x1b[0m`;

let passed = 0; let failed = 0;
const pass = (m, d) => { console.log(`  ${green('✔')} ${m}${d ? gray(' — ' + d) : ''}`); passed++; };
const fail = (m, d) => { console.log(`  ${red('✘')} ${m}${d ? gray(' — ' + d) : ''}`); failed++; };
const info = (m) => console.log(`  ${cyan('ℹ')} ${m}`);
const sep  = () => console.log(cyan('─'.repeat(62)));
const dot  = () => console.log(gray('  ' + '·'.repeat(58)));
function ok(cond, label, detail) { cond ? pass(label, detail) : fail(label, detail); }

// ── TEST A: Database ────────────────────────────────────────────────────────
async function testDatabase() {
  console.log(bold('\nTest A: Database — master_json column'));
  sep();
  const sql = neon(process.env.DATABASE_URL);
  try {
    const cols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'master_json'
    `;
    ok(cols.length > 0, "Column 'master_json' exists in table 'users'");
    if (cols[0]) ok(cols[0].data_type === 'jsonb', `Type is JSONB`, cols[0].data_type);

    const idx = await sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'users' AND indexname LIKE '%master_json%'
    `;
    ok(idx.length > 0, 'GIN index on master_json', idx[0]?.indexname || 'none');

    const stats = await sql`
      SELECT COUNT(*) AS total, COUNT(master_json) AS with_json FROM users
    `;
    info(`Users: ${stats[0].total} total | ${stats[0].with_json} with masterJson`);

    const latest = await sql`
      SELECT id, username, master_json IS NOT NULL AS has_json
      FROM users WHERE is_ai_generated = true ORDER BY id DESC LIMIT 3
    `;
    if (latest.length > 0) {
      for (const u of latest) {
        ok(u.has_json, `AI user #${u.id} (${u.username || 'unnamed'}) has master_json`, u.has_json ? 'PRESENT' : 'NULL');
      }
    } else {
      info('No AI artists in DB yet — create one to verify persistence.');
    }
  } catch (e) {
    fail('DB error: ' + e.message.substring(0, 150));
  }
}

// ── TEST B: Service unit test ───────────────────────────────────────────────
async function testService() {
  console.log(bold('\nTest B: Service — generateArtistMasterJSON()'));
  sep();

  // Use a TypeScript temp file + npx tsx (simpler than CJS + tsx/cjs tricks)
  const tmpTs = join(process.cwd(), 'scripts', '_tmp_mjtest.ts');
  const tsLines = [
    `import 'dotenv/config';`,
    `import { generateArtistMasterJSON, deriveParamsFromMaster } from '../server/services/artist-master-generator';`,
    `(async () => {`,
    `  const mj = await generateArtistMasterJSON({ genre: 'Electronic', gender: 'female', mood: 'dark', artistName: 'TestArtist' });`,
    `  const derived = deriveParamsFromMaster(mj);`,
    `  process.stdout.write(JSON.stringify({ ok: true, masterJson: mj, derived }));`,
    `})().catch(e => { process.stdout.write(JSON.stringify({ error: e.message })); process.exit(0); });`,
  ];

  let result;
  try {
    writeFileSync(tmpTs, tsLines.join('\n'));
  } catch (e) {
    fail('Could not write temp test file: ' + e.message);
    return;
  }

  try {
    const tsx = process.platform === 'win32'
      ? join(process.cwd(), 'node_modules', '.bin', 'tsx.cmd')
      : join(process.cwd(), 'node_modules', '.bin', 'tsx');
    const raw = execSync(`"${tsx}" "${tmpTs}"`, {
      cwd: process.cwd(),
      timeout: 90000,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
      env: { ...process.env },
    });
    const match = raw.match(/\{[\s\S]*\}(?=[^{]*$)/);
    result = match ? JSON.parse(match[0]) : null;
  } catch (e) {
    const msg = (e.stderr || e.message || '').substring(0, 200);
    fail('Service spawn failed: ' + msg);
    return;
  } finally {
    try { unlinkSync(tmpTs); } catch {}
  }

  if (!result) { fail('No JSON output from service test'); return; }
  if (result.error) {
    if (result.error.includes('tsx not available')) {
      info(yel('tsx not installed — service test skipped (run: npm i -D tsx)'));
    } else {
      fail('Service error: ' + result.error.substring(0, 200));
    }
    return;
  }

  // Full masterJson check
  dot();
  console.log(`\n  ${bold('generateArtistMasterJSON() — full AI call:')}`);
  const mj = result.masterJson;
  ok(!!mj, 'generateArtistMasterJSON() returned value');

  for (const k of ['schema_version','generated_at','canonical','visual_dna','musical_dna',
                    'persona','narrative','audience','business_model','agent_context','system_rules','module_views','memory']) {
    ok(k in mj, `Key: ${k}`);
  }

  info(`Artist:    ${bold(mj?.canonical?.artist_name || '?')}`);
  info(`Genre:     ${mj?.musical_dna?.primary_genre}`);
  info(`Archetype: ${mj?.persona?.archetype_name}`);
  info(`Tagline:   "${mj?.canonical?.tagline}"`);
  info(`Colors:    ${mj?.visual_dna?.color_palette?.join(', ')}`);
  info(`JSON size: ${JSON.stringify(mj).length} chars`);

  ok(mj?.canonical?.biography_long?.length > 100, 'biography_long >100 chars');
  ok(Array.isArray(mj?.visual_dna?.color_palette) && mj.visual_dna.color_palette.length >= 2, 'color_palette ≥2 colors');
  ok(mj?.musical_dna?.bpm_range?.min > 0, 'bpm_range populated');
  ok(Array.isArray(mj?.musical_dna?.influences) && mj.musical_dna.influences.length >= 2, 'influences ≥2 artists');
  ok(!!mj?.agent_context?.news_agent_brief, 'news_agent_brief');
  ok(!!mj?.agent_context?.epk_agent_brief, 'epk_agent_brief');
  ok(!!mj?.agent_context?.song_agent_brief, 'song_agent_brief');
  ok(!!mj?.agent_context?.video_agent_brief, 'video_agent_brief');

  // Derived params
  if (result.derived) {
    dot();
    const d = result.derived;
    ok(!!d.genre || !!d.artistName, 'deriveParamsFromMaster() returns params',
      `genre=${d.genre} | gender=${d.gender} | mood=${d.mood}`);
  }
}

// ── TEST C: Full API test ────────────────────────────────────────────────────
async function testAPI(port = 5000) {
  console.log(bold('\nTest C: Full Pipeline — POST /api/artist-generator/generate-artist'));
  sep();

  let alive = false;
  try {
    const ping = await fetch(`http://localhost:${port}/api/health`, { timeout: 3000 });
    alive = ping.ok;
  } catch {}

  if (!alive) {
    info(yel(`Server not running on port ${port} — skipping API tests.`));
    info(yel('To test the full pipeline: npm run dev   then re-run this script.'));
    return;
  }

  info(`Server alive ✅   Calling generate-artist...`);
  info(yel('⚠ This will consume ~1 OpenAI + FAL call (~$0.01)'));
  console.log('');

  let res, data;
  try {
    res = await fetch(`http://localhost:${port}/api/artist-generator/generate-artist`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ genre: 'Pop', gender: 'female', mood: 'confident' }),
      timeout: 120000,
    });
  } catch (e) {
    fail('Request error: ' + e.message); return;
  }

  ok(res.ok, `Response status ${res.status}`);
  if (!res.ok) { info(red('Body: ' + (await res.text()).substring(0, 200))); return; }

  data = await res.json();

  // Debug: show top-level response keys
  const responseKeys = Object.keys(data || {});
  info(`Response keys (${responseKeys.length}): ${responseKeys.join(', ')}`);

  // Artist created
  ok(!!(data.name || data.canonical?.artist_name), `Artist name: ${data.name || data.canonical?.artist_name || '?'}`);
  ok(!!(data.postgresId || data.id), `postgresId: ${data.postgresId || data.id}`);
  ok(!!data.firestoreId, `firestoreId: ${data.firestoreId}`);

  // masterJson in response
  dot();
  console.log(`\n  ${bold('masterJson in response:')}`);
  if ('masterJson' in data && data.masterJson === null) {
    info(yel('  ⚠ masterJson key EXISTS but value is null — server running old code, needs restart'));
  } else if (!('masterJson' in data)) {
    info(yel('  ⚠ masterJson key ABSENT from response — server running pre-masterJson code, needs restart'));
  }
  ok(!!data.masterJson, 'masterJson present in API response');

  if (data.masterJson) {
    const mj = data.masterJson;
    for (const k of ['canonical','visual_dna','musical_dna','persona','narrative','audience','business_model','agent_context']) {
      ok(k in mj, `masterJson.${k}`);
    }
    info(`Artist: ${bold(mj.canonical?.artist_name)} | Genre: ${mj.musical_dna?.primary_genre}`);
    info(`Archetype: ${mj.persona?.archetype_name}`);
    info(`JSON size: ${JSON.stringify(mj).length} chars`);
  }

  // DB persistence
  dot();
  console.log(`\n  ${bold('Persistence (PostgreSQL):')}`);
  try {
    const sql = neon(process.env.DATABASE_URL);
    const pgId = data.postgresId || data.id;
    const row = await sql`SELECT id, master_json IS NOT NULL AS has_json FROM users WHERE id = ${pgId}`;
    ok(row.length > 0, `User #${pgId} found in PostgreSQL`);
    ok(row[0]?.has_json === true, `master_json saved to PostgreSQL for user #${pgId}`);
  } catch (e) {
    fail('DB persistence check: ' + e.message.substring(0, 100));
  }
}

// ── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold(cyan('\n╔══════════════════════════════════════════════════════════╗')));
  console.log(bold(cyan('║    BOOSTIFY — MASTER JSON GENERATION TEST SUITE          ║')));
  console.log(bold(cyan('╚══════════════════════════════════════════════════════════╝')));

  await testDatabase();
  await testService();
  await testAPI(5000);

  sep();
  console.log(bold(`\n📊 Results: ${green(passed + ' passed')}  ${failed > 0 ? red(failed + ' failed') : '0 failed'}\n`));

  if (failed === 0) {
    console.log(green('🎉 Master JSON system verified!\n'));
  } else {
    console.log(yel(`⚠ ${failed} checks failed — see above.\n`));
    process.exit(1);
  }
}

main().catch(e => { console.error(red('\n❌ Crashed: ' + e.message)); process.exit(1); });
