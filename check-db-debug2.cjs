require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const artists = await sql`SELECT id, username, slug, artist_name, role, is_published FROM users WHERE id IN (1407,1408,1409,1410)`;
  console.log('Artists:');
  for (const a of artists) {
    console.log('  ID=' + a.id + ' | username=' + a.username + ' | slug=' + a.slug + ' | artist_name=' + a.artist_name + ' | published=' + a.is_published);
  }

  const songs = await sql`SELECT id, user_id, title, audio_url FROM songs WHERE user_id IN (1407,1408,1409,1410) ORDER BY user_id, id`;
  console.log('\nSongs count:', songs.length);
  for (const s of songs) {
    console.log('  user_id=' + s.user_id + ' | ' + s.title + ' | audio: ' + (s.audio_url ? 'YES' : 'NO'));
  }

  const scols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='songs' AND table_schema='public' ORDER BY ordinal_position`;
  console.log('\nSongs columns:', scols.map(c => c.column_name).join(', '));
}

check().catch(console.error);
