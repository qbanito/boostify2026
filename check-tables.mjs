import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' 
  AND (table_name LIKE 'brand%' OR table_name LIKE 'influencer%' OR table_name LIKE 'campaign%')
  ORDER BY table_name
`);
console.log('TABLES FOUND:', r.rows.map(x => x.table_name));
await c.end();
