const admin = require('firebase-admin');
const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: 'artist-boost.firebasestorage.app'
});
const bucket = admin.storage().bucket();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Get the profile image URL stored for artist 1407
  const r = await pool.query('SELECT profile_image FROM users WHERE id = 1407');
  const profileImg = r.rows[0].profile_image;
  console.log('Profile image URL:', profileImg.substring(0, 80) + '...');

  // Get signed URL for the one song cover found (REMIX)
  const [remixCoverUrl] = await bucket.file(
    'song-covers/1778725783944-9e8c24d1-song-9mujock3YHkdAyNOxBFG-1778725767346-png.png'
  ).getSignedUrl({ action: 'read', expires: '03-01-2030' });

  // Update ALL songs with profile image as default cover
  await pool.query('UPDATE songs SET cover_art = $1 WHERE user_id = 1407', [profileImg]);
  console.log('All songs updated with profile image as cover');

  // Update REMIX with its actual cover art
  await pool.query(
    "UPDATE songs SET cover_art = $1 WHERE user_id = 1407 AND title = 'Vino con sal REMIX'",
    [remixCoverUrl]
  );
  console.log('REMIX cover art updated with original cover');

  // Show final state
  const songs = await pool.query(
    'SELECT id, title FROM songs WHERE user_id = 1407 ORDER BY id'
  );
  console.log('\nAll restored songs:');
  songs.rows.forEach(s => console.log(`  ID ${s.id}: ${s.title}`));
  console.log(`\nTotal: ${songs.rows.length} songs`);

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
