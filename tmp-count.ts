import 'dotenv/config';
import { db } from './server/db';
import { sql } from 'drizzle-orm';

async function main() {
  const r1 = await db.execute(sql`SELECT count(*) as total FROM music_industry_contacts`);
  console.log('music_industry_contacts:', r1.rows[0]);

  const r2 = await db.execute(sql`SELECT count(*) as total FROM musicians`);
  console.log('musicians:', r2.rows[0]);

  const r3 = await db.execute(sql`SELECT import_source, count(*) as cnt FROM music_industry_contacts GROUP BY import_source ORDER BY cnt DESC`);
  console.log('\nBy import_source:', r3.rows);

  const r4 = await db.execute(sql`SELECT import_batch_id, count(*) as cnt FROM music_industry_contacts GROUP BY import_batch_id ORDER BY cnt DESC LIMIT 10`);
  console.log('\nBy import_batch:', r4.rows);

  // Check other contact tables
  const tables = ['manager_contacts', 'marketing_contacts', 'sponsor_contacts', 'venue_contacts'];
  for (const t of tables) {
    const r = await db.execute(sql.raw(`SELECT count(*) as total FROM ${t}`));
    console.log(`${t}:`, r.rows[0]);
  }

  // Check if the user's CSV has more data
  console.log('\nSample from music_industry_contacts (first 3):');
  const sample = await db.execute(sql`SELECT id, full_name, email, import_source FROM music_industry_contacts ORDER BY id LIMIT 3`);
  console.log(sample.rows);
  
  console.log('\nLast 3 by ID:');
  const last = await db.execute(sql`SELECT id, full_name, email, import_source FROM music_industry_contacts ORDER BY id DESC LIMIT 3`);
  console.log(last.rows);

  process.exit(0);
}
main();
