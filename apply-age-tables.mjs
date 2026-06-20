/**
 * apply-age-tables.mjs
 * Aplica solo las tablas/FKs/índices del Artist Growth Engine al DB
 * (extrae de migrations/0012_left_the_hunter.sql cualquier statement
 * que mencione age_*).
 */

import pg from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

config();

const { Client } = pg;
const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  await client.connect();
  console.log('🔌 Connected to Postgres');

  const sql = readFileSync(new URL('./migrations/0012_left_the_hunter.sql', import.meta.url), 'utf8');
  const statements = sql
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => /\bage_[a-z_]+/i.test(s)); // solo statements que tocan tablas age_*

  console.log(`📦 ${statements.length} statements AGE encontrados`);

  let ok = 0;
  let skip = 0;
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok++;
    } catch (err) {
      const msg = err.message || String(err);
      if (
        msg.includes('already exists') ||
        msg.includes('duplicate') ||
        msg.includes('ya existe')
      ) {
        skip++;
      } else {
        console.error('❌', msg);
        console.error('   →', stmt.slice(0, 120));
      }
    }
  }

  console.log(`✅ Aplicados: ${ok}, ya existían: ${skip}`);

  // Verificación
  const check = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'age_%'
    ORDER BY table_name
  `);
  console.log('\n📋 Tablas AGE en la DB:');
  check.rows.forEach((r) => console.log('   -', r.table_name));

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
