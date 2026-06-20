require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const artists = await sql`SELECT id, username, display_name, role FROM users WHERE id IN (1407,1408,1409,1410)`;
  console.log('Artists:');
  for (const a of artists) {
    console.log('  ID=' + a.id + ' slug=' + a.username + ' name=' + a.display_name + ' role=' + a.role);
  }

  const songs = await sql`SELECT id, user_id, title, audio_url, is_public FROM songs WHERE user_id IN (1407,1408,1409,1410) ORDER BY user_id, id`;
  console.log('\nSongs count:', songs.length);
  for (const s of songs) {
    console.log('  user_id=' + s.user_id + ' | is_public=' + s.is_public + ' | ' + s.title + ' | audio: ' + (s.audio_url ? 'YES' : 'NO'));
  }

  const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='songs' AND table_schema='public' ORDER BY ordinal_position`;
  console.log('\nSongs table columns:', cols.map(c => c.column_name).join(', '));

  // Check user table columns
  const ucols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND table_schema='public' ORDER BY ordinal_position`;
  console.log('\nUsers table columns:', ucols.map(c => c.column_name).join(', '));
}

check().catch(console.error);
