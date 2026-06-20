#!/usr/bin/env node
/**
 * artist-modules-audit — verifies the 6 "My Artist" modules are properly wired.
 *
 *   · each router is mounted in server/routes.ts
 *   · each module's expected DB tables exist in Postgres
 *   · counts per table are reported
 *   · optional: fetches /api/artist-modules/status/:artistId against a running server
 *
 * Usage:
 *   node scripts/artist-modules-audit.mjs
 *   node scripts/artist-modules-audit.mjs --artistId=1 --url=http://localhost:5000
 */
import pg from 'pg';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const ARTIST_ID = Number((process.argv.find((a) => a.startsWith('--artistId=')) || '').split('=')[1]) || null;
const URL = (process.argv.find((a) => a.startsWith('--url=')) || '').split('=')[1] || null;

const MODULES = [
  { id: 'sponsor-acquisition',   mount: "app.use('/api/sponsors'",          tables: ['sponsor_contacts', 'sponsor_campaigns', 'sponsor_deals', 'sponsor_email_log'] },
  { id: 'venue-booking',         mount: "app.use('/api/venue-outreach'",    tables: ['venue_contacts', 'venue_booking_campaigns', 'venue_booking_deals'] },
  { id: 'exclusive-content',     mount: "app.use('/api/explicit'",          tables: ['explicit_content', 'explicit_subscriptions', 'explicit_purchases', 'explicit_ai_generations'] },
  { id: 'aas-engine',            mount: "app.use('/api/aas'",               tables: ['aas_config', 'aas_daily_action_log', 'aas_survival_metrics', 'aas_deal_pipeline', 'aas_approval_queue'] },
  { id: 'viral-product-ads',     mount: "app.use('/api/viral-products'",    tables: [] },
  { id: 'brand-collaborations',  mount: "app.use('/api/influencer'",        tables: ['brand_profiles', 'brand_products', 'brand_campaigns', 'brand_messages'] },
];

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
});

async function tableExists(name) {
  const { rows } = await pool.query(
    `SELECT to_regclass($1) AS reg`,
    [name],
  );
  return Boolean(rows[0]?.reg);
}

async function countTable(name) {
  try {
    const { rows } = await pool.query(`SELECT COUNT(*)::int AS c FROM ${name}`);
    return rows[0]?.c ?? 0;
  } catch {
    return null;
  }
}

async function main() {
  console.log('🔎 Artist Modules Audit\n');

  // 1. Check route mounts
  const routesFile = path.resolve('server/routes.ts');
  const routesSrc = fs.readFileSync(routesFile, 'utf8');

  const report = [];
  for (const mod of MODULES) {
    const mounted = routesSrc.includes(mod.mount);
    const tableChecks = [];
    for (const t of mod.tables) {
      const exists = await tableExists(t);
      const count = exists ? await countTable(t) : null;
      tableChecks.push({ table: t, exists, count });
    }
    const tablesOk = tableChecks.every((c) => c.exists);
    report.push({ id: mod.id, mounted, tablesOk, tableChecks });
  }

  // 2. Optional live status hit
  let liveStatus = null;
  if (URL && ARTIST_ID) {
    try {
      const resp = await fetch(`${URL}/api/artist-modules/status/${ARTIST_ID}`);
      liveStatus = await resp.json();
    } catch (e) {
      liveStatus = { error: String(e) };
    }
  }

  // 3. Print report
  console.log('┌─────────────────────────────┬─────────┬────────┐');
  console.log('│ Module                      │ Mounted │ Tables │');
  console.log('├─────────────────────────────┼─────────┼────────┤');
  for (const r of report) {
    const id = r.id.padEnd(27);
    const m = (r.mounted ? '✅' : '❌').padEnd(6);
    const t = (r.tablesOk ? '✅' : '⚠️ ').padEnd(6);
    console.log(`│ ${id} │ ${m}  │ ${t} │`);
  }
  console.log('└─────────────────────────────┴─────────┴────────┘\n');

  for (const r of report) {
    if (r.tableChecks.length === 0) continue;
    console.log(`• ${r.id}`);
    for (const c of r.tableChecks) {
      const mark = c.exists ? '✅' : '❌';
      const cnt = c.exists ? `(${c.count} rows)` : '';
      console.log(`    ${mark} ${c.table} ${cnt}`);
    }
  }

  if (liveStatus) {
    console.log('\n🌐 Live /api/artist-modules/status response:');
    console.log(JSON.stringify(liveStatus, null, 2));
  }

  const allOk = report.every((r) => r.mounted && r.tablesOk);
  await pool.end();
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
