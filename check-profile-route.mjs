import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Check if redwine exists and what tables fail
const r1 = await pool.query("SELECT id, slug, artist_name FROM users WHERE slug='redwine'").catch(e => ({ error: e.message }));
console.log('redwine user:', JSON.stringify(r1.rows ?? r1));

if (r1.rows?.[0]) {
  const userId = r1.rows[0].id;
  const r2 = await pool.query("SELECT COUNT(*) FROM songs WHERE user_id=$1", [userId]).catch(e => ({ error: e.message }));
  const r3 = await pool.query("SELECT COUNT(*) FROM merchandise WHERE user_id=$1", [userId]).catch(e => ({ error: e.message }));
  const r4 = await pool.query("SELECT COUNT(*) FROM artist_media WHERE user_id=$1", [userId]).catch(e => ({ error: e.message }));
  console.log('songs:', JSON.stringify(r2.rows ?? r2));
  console.log('merch:', JSON.stringify(r3.rows ?? r3));
  console.log('artist_media:', JSON.stringify(r4.rows ?? r4));
}

await pool.end();
