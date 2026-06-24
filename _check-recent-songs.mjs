import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const artists = await pool.query(`
  SELECT id, artist_name, created_at
  FROM users
  WHERE artist_name IS NOT NULL
  ORDER BY id DESC
  LIMIT 8
`);

console.log('=== Recent artists (users) ===');
for (const a of artists.rows) {
  const songs = await pool.query(
    `SELECT id, title, is_published, audio_url, ai_provider FROM songs WHERE user_id = $1 ORDER BY id DESC`,
    [a.id]
  );
  console.log(`\n#${a.id} ${a.artist_name} (created ${a.created_at?.toISOString?.() || a.created_at}) -> ${songs.rows.length} songs`);
  for (const s of songs.rows) {
    const audio = s.audio_url ? (s.audio_url.length > 50 ? s.audio_url.slice(0, 50) + '…' : s.audio_url) : '(none)';
    console.log(`   song#${s.id} pub=${s.is_published} prov=${s.ai_provider} ${s.title} | ${audio}`);
  }
}

await pool.end();
