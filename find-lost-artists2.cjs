require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const missingIds = [1382, 1394, 1395, 1396, 1399, 1400, 1401, 1402, 1403, 1404, 1405];

  // Check songs (in case CASCADE didn't run)
  const songs = await pool.query(`SELECT id, title, user_id, audio_url, cover_art FROM songs WHERE user_id = ANY($1) ORDER BY user_id`, [missingIds]);
  console.log('\nSongs from deleted artists:', songs.rows.length);
  songs.rows.forEach(s => console.log('  user_id:', s.user_id, '| song:', s.title));

  // Check lyrics_video_jobs
  const lvJobs = await pool.query(`SELECT id, artist_id, song_title FROM lyrics_video_jobs WHERE artist_id = ANY($1) LIMIT 20`, [missingIds]).catch(() => ({ rows: [] }));
  console.log('\nLyrics video jobs:', lvJobs.rows.length);
  lvJobs.rows.forEach(j => console.log('  artist_id:', j.artist_id, '|', j.song_title));

  // Check vinyl_campaigns
  const vinyl = await pool.query(`SELECT id, artist_id, title FROM vinyl_campaigns WHERE artist_id = ANY($1) LIMIT 10`, [missingIds]).catch(() => ({ rows: [] }));
  console.log('\nVinyl campaigns:', vinyl.rows.length);
  vinyl.rows.forEach(v => console.log('  artist_id:', v.artist_id, '|', v.title));

  // Check promo_clips or similar
  const promos = await pool.query(`SELECT table_name FROM information_schema.columns WHERE column_name='artist_id' AND table_schema='public' GROUP BY table_name ORDER BY table_name`).catch(() => ({ rows: [] }));
  console.log('\nAll tables with artist_id column:');
  promos.rows.forEach(t => console.log(' ', t.table_name));

  // Try to find firestore_id pattern for these deleted artists from songs
  // Songs table might have firestore data
  const songCheck = await pool.query(`
    SELECT user_id, COUNT(*) as cnt, MIN(title) as sample
    FROM songs
    GROUP BY user_id
    HAVING user_id BETWEEN 1380 AND 1410
    ORDER BY user_id
  `);
  console.log('\nSongs grouped by artist_id 1380-1410:');
  songCheck.rows.forEach(s => console.log('  artist_id:', s.user_id, '| songs:', s.cnt, '| sample:', s.sample));

  await pool.end();
}
run().catch(e => { console.error(e.message); pool.end(); });
