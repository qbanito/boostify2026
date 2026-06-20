require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);

async function check() {
  const ucols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='users' AND table_schema='public' ORDER BY ordinal_position`;
  console.log('Users columns:', ucols.map(c => c.column_name).join(', '));

  const artists = await sql`SELECT id, username, role FROM users WHERE id IN (1407,1408,1409,1410)`;
  console.log('\nArtists:');
  for (const a of artists) {
    console.log('  ID=' + a.id + ' slug=' + a.username + ' role=' + a.role);
  }

  const songs = await sql`SELECT id, user_id, title, audio_url, is_public FROM songs WHERE user_id IN (1407,1408,1409,1410) ORDER BY user_id, id`;
  console.log('\nSongs count:', songs.length);
  for (const s of songs) {
    console.log('  user_id=' + s.user_id + ' | is_public=' + s.is_public + ' | ' + s.title);
  }

  const scols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name='songs' AND table_schema='public' ORDER BY ordinal_position`;
  console.log('\nSongs columns:', scols.map(c => c.column_name).join(', '));
}

check().catch(console.error);
