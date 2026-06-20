import 'dotenv/config';
import pg from 'pg';
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const t = await c.query(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND (table_name ILIKE '%artist%')
  ORDER BY table_name
`);
console.log('Tablas artist:', t.rows.map(r => r.table_name));

for (const tn of ['ai_artists', 'artists', 'artist_profiles', 'musicians']) {
  try {
    const r = await c.query(`SELECT * FROM ${tn} WHERE LOWER(COALESCE(name,'')) LIKE '%qbanito%' OR LOWER(COALESCE(stage_name,'')) LIKE '%qbanito%' OR LOWER(COALESCE(artist_name,'')) LIKE '%qbanito%' LIMIT 5`);
    if (r.rows.length) { console.log(`\n>>> ${tn}:`, r.rows); }
  } catch (e) { console.log(`(tabla ${tn} no aplica)`); }
}

const u = await c.query(`SELECT * FROM users WHERE id IN (33, 1383, 1384, 1385, 1388)`);
console.log('\nUsers:', u.rows);

await c.end();
