const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. Check users table for vinoconsal
  const r1 = await pool.query(
    "SELECT id, slug, artist_name, role, is_published, profile_image_url, generated_by, created_at FROM users WHERE slug ILIKE $1 OR artist_name ILIKE $1",
    ['%vinoconsal%']
  );
  console.log('Users matching vinoconsal:', JSON.stringify(r1.rows, null, 2));

  // 2. Check songs by slug pattern
  const r2 = await pool.query(
    "SELECT id, title, artist_id, audio_url, cover_image_url, firestore_id FROM songs WHERE title ILIKE $1 OR audio_url ILIKE $1 LIMIT 20",
    ['%vinoconsal%']
  );
  console.log('\nSongs matching vinoconsal:', JSON.stringify(r2.rows, null, 2));

  // 3. Look for ALL songs belonging to user 33 artists sorted by artist_id descending
  // to see songs near the deleted IDs range (1394-1405)
  const r3 = await pool.query(
    "SELECT id, title, artist_id, cover_image_url, audio_url, firestore_id FROM songs WHERE artist_id BETWEEN 1390 AND 1410 ORDER BY artist_id, id LIMIT 50"
  );
  console.log('\nSongs in artist_id range 1390-1410:', JSON.stringify(r3.rows, null, 2));

  // 4. Look in artist_profiles table if it exists
  const r4 = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name ILIKE '%profile%'"
  );
  console.log('\nProfile-related tables:', JSON.stringify(r4.rows, null, 2));

  // 5. Check the two surviving REDWINE artists for reference
  const r5 = await pool.query(
    "SELECT id, slug, artist_name, profile_image_url, banner_image_url, bio, genres, country, generated_by FROM users WHERE id IN (1392, 1398)"
  );
  console.log('\nExisting REDWINE artists:', JSON.stringify(r5.rows, null, 2));

  // 6. Check if firestore_artists or similar table has vinoconsal
  const r6 = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('\nAll tables:', r6.rows.map(r => r.table_name).join(', '));

  await pool.end();
}

main().catch(console.error);
