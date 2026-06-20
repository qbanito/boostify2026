import { db } from './db/index.js';
import { sql } from 'drizzle-orm';

const result = await db.execute(sql`
  SELECT u.slug, u.id, COUNT(s.id) as song_count 
  FROM users u 
  LEFT JOIN songs s ON s.user_id = u.id 
  WHERE u.slug = 'redwine' 
  GROUP BY u.slug, u.id
`);
console.log('Songs in PG:', JSON.stringify(result.rows));

const songs = await db.execute(sql`
  SELECT s.id, s.title, s.user_id 
  FROM songs s 
  JOIN users u ON u.id = s.user_id
  WHERE u.slug = 'redwine'
  LIMIT 10
`);
console.log('Song details:', JSON.stringify(songs.rows));
process.exit(0);
