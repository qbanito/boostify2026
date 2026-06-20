const { Pool } = require('@neondatabase/serverless');
require('dotenv').config();
const p = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // List all instagram tables
  const tables = await p.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name LIKE '%instagram%' ORDER BY table_name"
  );
  console.log('=== Instagram Tables ===');
  tables.rows.forEach(r => console.log(' -', r.table_name));

  // Check connection
  const conn = await p.query('SELECT * FROM instagram_extension_connections WHERE id = 1');
  console.log('\n=== Connection ===');
  console.log(JSON.stringify(conn.rows[0], null, 2));

  // Check if snapshots table exists
  const snapCheck = await p.query(
    "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'instagram_extension_snapshots')"
  );
  console.log('\n=== Snapshots table exists:', snapCheck.rows[0].exists);

  // Check events
  const events = await p.query('SELECT * FROM instagram_extension_events WHERE connection_id = 1 ORDER BY id DESC LIMIT 3');
  console.log('\n=== Recent Events ===');
  console.log(JSON.stringify(events.rows, null, 2));

  await p.end();
  process.exit(0);
}
main().catch(e => { console.error(e.message); process.exit(1); });
