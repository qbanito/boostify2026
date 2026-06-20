import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';

console.log('DATABASE_URL host:', new URL(process.env.DATABASE_URL).host);

// Test 1: via @neondatabase/serverless (same as app)
const sql = neon(process.env.DATABASE_URL);
const r1 = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'c_suite_%' ORDER BY table_name`;
console.log('[neon-serverless] c_suite tables:', r1.length);
r1.forEach(r => console.log('  -', r.table_name));

// Test 2: try selecting from c_suite_agents
try {
  const r2 = await sql`SELECT COUNT(*) as cnt FROM c_suite_agents`;
  console.log('[neon-serverless] c_suite_agents count:', r2[0].cnt);
} catch (e) {
  console.log('[neon-serverless] c_suite_agents ERROR:', e.message);
}

// Test 3: via pg (same as migration script)
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const r3 = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE 'c_suite_%' ORDER BY table_name");
console.log('[pg] c_suite tables:', r3.rows.length);
r3.rows.forEach(r => console.log('  -', r.table_name));
await client.end();
