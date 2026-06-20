require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // Check user_created_artists table structure
  const cols = await pool.query(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='user_created_artists' ORDER BY ordinal_position`
  );
  console.log('=== user_created_artists columns ===');
  cols.rows.forEach(c => console.log(' ', c.column_name, '-', c.data_type));

  // Get all entries for user 33 (admin) -- uses creator_user_id
  const r = await pool.query(
    `SELECT creator_user_id, artist_user_id, artist_name, created_at FROM user_created_artists WHERE creator_user_id=33 ORDER BY created_at DESC LIMIT 60`
  );
  console.log('\n=== user_created_artists for creator 33 (' + r.rows.length + ' entries) ===');
  r.rows.forEach(a => console.log('  artist_user_id:', a.artist_user_id, '| name:', a.artist_name));

  // Now check "My Artists" via generated_by in users table
  const r2 = await pool.query(
    `SELECT id, slug, artist_name, generated_by, created_at FROM users WHERE generated_by=33 ORDER BY id`
  );
  console.log('\n=== users generated_by=33 (dashboard My Artists) (' + r2.rows.length + ' total) ===');
  r2.rows.forEach(a => console.log('  ID', a.id, '|', a.slug, '|', a.artist_name, '| created:', a.created_at?.toISOString?.()?.slice(0,10)));

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
