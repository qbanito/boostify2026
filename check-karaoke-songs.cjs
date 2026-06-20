require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
(async () => {
  const rows = await sql`SELECT id, user_id, title, firestore_id FROM songs WHERE user_id IN (1407,1408,1409,1410) ORDER BY user_id, id LIMIT 50`;
  console.log('Songs for restored artists:');
  rows.forEach(r => console.log(` id=${r.id} user_id=${r.user_id} firestore_id=${r.firestore_id || '(null)'} title=${(r.title||'').substring(0,30)}`));
  console.log('Total:', rows.length);
})().catch(e => console.error(e));
