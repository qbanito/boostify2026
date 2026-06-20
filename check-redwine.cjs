require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // REVERT: restore slug back to 'redwine' for artist 1392
  const revert = await pool.query(
    `UPDATE users SET slug='redwine', updated_at=NOW() WHERE id=1392 RETURNING id, slug, artist_name`
  );
  console.log('Reverted:', revert.rows[0]);

  // Now investigate: what artists does user 33 (admin) own?
  const mine = await pool.query(
    `SELECT id, slug, artist_name, is_published, is_ai_generated, created_at FROM users WHERE generated_by=33 ORDER BY id DESC LIMIT 30`
  );
  console.log('\nAll artists generated_by=33 (', mine.rows.length, 'total):');
  mine.rows.forEach(a => console.log(`  ID ${a.id} | ${a.slug} | ${a.artist_name} | ai:${a.is_ai_generated}`)  );

  // Check profile_layouts for ID 1405
  try {
    const pl = await pool.query(`SELECT artist_id, updated_at FROM profile_layouts WHERE artist_id=1405 LIMIT 1`);
    console.log('\nprofile_layouts 1405:', pl.rows);
  } catch(e) { console.log('profile_layouts error:', e.message); }

  // Check if there's a users record recently deleted (look for gaps near 1405)
  const nearby = await pool.query(`SELECT id, slug, artist_name FROM users WHERE id BETWEEN 1400 AND 1406 ORDER BY id`);
  console.log('\nUsers 1400-1406:', nearby.rows);

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });








