require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const artists = await sql`SELECT id, username, slug, artist_name, firestore_id FROM users WHERE id IN (1407,1408,1409,1410)`;
  console.log('Artists firestore_id:');
  for (const a of artists) {
    console.log('  ID=' + a.id + ' | slug=' + a.slug + ' | artist_name=' + a.artist_name + ' | firestore_id=' + a.firestore_id);
  }

  const songs = await sql`SELECT id, user_id, title, audio_url, cover_art, genre, firestore_id FROM songs WHERE user_id IN (1407,1408,1409,1410) ORDER BY user_id, id`;
  console.log('\nSongs:');
  for (const s of songs) {
    console.log('  user_id=' + s.user_id + ' | id=' + s.id + ' | firestore_id=' + s.firestore_id + ' | ' + s.title + ' | cover=' + (s.cover_art ? 'YES' : 'NO'));
  }
}

check().catch(console.error);
