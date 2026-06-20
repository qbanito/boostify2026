import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Check actual column names in songs and merchandise tables
const cols = await pool.query(`
  SELECT table_name, column_name 
  FROM information_schema.columns 
  WHERE table_name IN ('songs','merchandise','artist_media') 
  AND column_name LIKE '%user%'
  ORDER BY table_name, column_name
`).catch(e => ({ error: e.message }));
console.log(JSON.stringify(cols.rows ?? cols, null, 2));

// Also check if the Drizzle query would work
const r = await pool.query(`
  SELECT s.id, s.title FROM songs s 
  JOIN users u ON u.id = s.user_id 
  WHERE u.slug = 'redwine' LIMIT 3
`).catch(e => ({ error: e.message }));
console.log('songs with user_id join:', JSON.stringify(r.rows ?? r));

const r2 = await pool.query(`
  SELECT s.id, s.title FROM songs s 
  JOIN users u ON u.id = s.artist_id 
  WHERE u.slug = 'redwine' LIMIT 3
`).catch(e => ({ error: 'artist_id does not work: ' + e.message }));
console.log('songs with artist_id join:', JSON.stringify(r2.rows ?? r2));

await pool.end();
