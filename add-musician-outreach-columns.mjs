// One-off migration: musician outreach system (2026-07-03)
//  - musicians.terms_accepted_at / terms_version → legal acceptance gate
//  - geo_cache → permanent cache for Nominatim city geocoding
//  - instagram_leads.city → city captured from IG export CSVs
// Idempotent — safe to re-run.
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const stmts = [
  `ALTER TABLE musicians ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ`,
  `ALTER TABLE musicians ADD COLUMN IF NOT EXISTS terms_version TEXT`,
  `ALTER TABLE instagram_leads ADD COLUMN IF NOT EXISTS city TEXT`,
  `CREATE TABLE IF NOT EXISTS geo_cache (
     id SERIAL PRIMARY KEY,
     query TEXT UNIQUE NOT NULL,
     lat DOUBLE PRECISION,
     lng DOUBLE PRECISION,
     created_at TIMESTAMPTZ DEFAULT NOW()
   )`,
];

for (const s of stmts) {
  await client.query(s);
  console.log('OK:', s.split('\n')[0].trim());
}

await client.end();
console.log('Migration complete.');
