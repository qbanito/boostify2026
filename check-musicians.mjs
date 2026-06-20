import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

// Check Supabase leads
const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';
const supa = new Client({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });
await supa.connect();
try {
  const cnt = await supa.query("SELECT count(*) FROM leads");
  console.log('Supabase leads count:', cnt.rows[0].count);
  const cols = await supa.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'leads' ORDER BY ordinal_position`);
  console.log('Leads columns:', cols.rows.map(r => r.column_name).join(', '));
  const sample = await supa.query("SELECT * FROM leads LIMIT 3");
  console.log('Leads sample:', JSON.stringify(sample.rows, null, 2));
} catch (e) { console.log('Supabase leads error:', e.message); }
await supa.end();

// Check Neon music_industry_contacts and outreach
const neon = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await neon.connect();
for (const t of ['music_industry_contacts', 'marketing_contacts', 'outreach_campaigns']) {
  try {
    const cnt = await neon.query(`SELECT count(*) FROM ${t}`);
    console.log(`Neon ${t} count:`, cnt.rows[0].count);
    if (parseInt(cnt.rows[0].count) > 0) {
      const cols = await neon.query(`SELECT column_name FROM information_schema.columns WHERE table_name = '${t}' ORDER BY ordinal_position`);
      console.log(`  Columns: ${cols.rows.map(r => r.column_name).join(', ')}`);
      const s = await neon.query(`SELECT * FROM ${t} LIMIT 2`);
      console.log(`  Sample:`, JSON.stringify(s.rows, null, 2));
    }
  } catch(e) { console.log(`${t}: ${e.message}`); }
}
await neon.end();
process.exit(0);
