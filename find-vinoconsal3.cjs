const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Get users table columns
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='users' ORDER BY ordinal_position"
  );
  console.log('Users table columns:', cols.rows.map(r => r.column_name).join(', '));

  // Get existing REDWINE artists (all columns)
  const r5 = await pool.query(
    "SELECT * FROM users WHERE id IN (1392, 1398)"
  );
  console.log('\nExisting REDWINE artists (full data):', JSON.stringify(r5.rows, null, 2));

  // Songs by user_id in the deleted range
  const r3 = await pool.query(
    "SELECT id, user_id, title, cover_art, audio_url, firestore_id FROM songs WHERE user_id BETWEEN 1390 AND 1410 ORDER BY user_id, id LIMIT 50"
  );
  console.log('\nSongs in user_id range 1390-1410:', JSON.stringify(r3.rows, null, 2));

  // Check artist_profile_images table
  const pimg = await pool.query(
    "SELECT * FROM artist_profile_images WHERE artist_id BETWEEN 1390 AND 1410 LIMIT 20"
  );
  console.log('\nProfile images in range:', JSON.stringify(pimg.rows, null, 2));

  // Check artist_personality for vinoconsal
  const pers = await pool.query(
    "SELECT * FROM artist_personality WHERE artist_id BETWEEN 1390 AND 1410 LIMIT 20"
  );
  console.log('\nPersonality in range:', JSON.stringify(pers.rows, null, 2));

  // Check artist_media
  const med = await pool.query(
    "SELECT * FROM artist_media WHERE artist_id BETWEEN 1390 AND 1410 LIMIT 20"
  );
  console.log('\nMedia in range:', JSON.stringify(med.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
