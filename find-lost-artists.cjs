require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  // Search broadly - vinoconsal or redwine in any field
  const r = await pool.query(`
    SELECT id, slug, artist_name, generated_by, created_at, updated_at
    FROM users
    WHERE slug ILIKE '%vinoconsal%'
       OR artist_name ILIKE '%vinoconsal%'
       OR slug ILIKE '%redwine%'
       OR artist_name ILIKE '%redwine%'
    ORDER BY id
  `);
  console.log('All redwine/vinoconsal artists (' + r.rows.length + '):');
  r.rows.forEach(a => console.log('  ID', a.id, '|', a.slug, '|', a.artist_name, '| gen_by:', a.generated_by, '| created:', a.created_at?.toISOString().slice(0,10)));

  // Search ALL artists created by user 33 (admin) in last 30 days
  const recent = await pool.query(`
    SELECT id, slug, artist_name, created_at
    FROM users
    WHERE generated_by = 33
      AND created_at > NOW() - INTERVAL '30 days'
    ORDER BY created_at DESC
    LIMIT 50
  `);
  console.log('\nRecent artists by admin user 33 (last 30 days, ' + recent.rows.length + '):');
  recent.rows.forEach(a => console.log('  ID', a.id, '|', a.slug, '|', a.artist_name, '| created:', a.created_at?.toISOString().slice(0,16)));

  // Check if there are gaps in IDs (suggesting deletions between known IDs)
  const gaps = await pool.query(`
    SELECT s.id+1 as missing_from, MIN(n.id)-1 as missing_to
    FROM users s
    JOIN users n ON n.id > s.id
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = s.id+1)
    GROUP BY s.id
    HAVING s.id+1 <= MIN(n.id)-1
      AND s.id BETWEEN 1380 AND 1410
    ORDER BY s.id
  `);
  console.log('\nID gaps (possible deletions) between 1380-1410:');
  gaps.rows.forEach(g => console.log('  Missing IDs:', g.missing_from, '-', g.missing_to));

  // Check songs table for any songs that reference missing artist IDs
  const orphanSongs = await pool.query(`
    SELECT s.id, s.title, s.user_id
    FROM songs s
    WHERE s.user_id BETWEEN 1380 AND 1410
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = s.user_id)
    LIMIT 20
  `);
  console.log('\nOrphan songs (songs whose artist was deleted):');
  orphanSongs.rows.forEach(s => console.log('  Song ID', s.id, '|', s.title, '| artist_id:', s.user_id));

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
