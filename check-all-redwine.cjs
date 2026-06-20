require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // All artists with redwine in slug or name
  const r = await pool.query(
    "SELECT id, slug, artist_name, is_published, created_at FROM users WHERE artist_name ILIKE '%redwine%' OR slug ILIKE '%redwine%' ORDER BY id"
  );
  console.log('ALL REDWINE artists (' + r.rows.length + '):');
  r.rows.forEach(a => console.log('  ID', a.id, '|', a.slug, '|', a.artist_name, '| created:', a.created_at));

  // Check if any were recently deleted — look at user deletion logs or soft-delete columns
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='users' ORDER BY ordinal_position"
  );
  console.log('\nUsers table columns:', cols.rows.map(c => c.column_name).join(', '));

  // Total users count
  const total = await pool.query('SELECT COUNT(*) FROM users');
  console.log('\nTotal users rows:', total.rows[0].count);

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
