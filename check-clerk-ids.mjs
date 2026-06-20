import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// Ver usuarios reales (no AI-generated) con su clerk_id
const r = await db.query(`
  SELECT id, clerk_id, artist_name, email, loop_video_url
  FROM users 
  WHERE is_ai_generated = false OR is_ai_generated IS NULL
  ORDER BY id DESC LIMIT 20
`);
console.log('Usuarios reales en PostgreSQL:');
for (const row of r.rows) {
  console.log(`  ID: ${row.id}, clerk_id: ${row.clerk_id}, name: ${row.artist_name}, email: ${row.email}`);
}

await db.end();
