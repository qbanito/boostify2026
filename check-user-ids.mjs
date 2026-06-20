import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

const r = await db.query(`
  SELECT id, clerk_id, replit_id, username, artist_name, email 
  FROM users 
  WHERE clerk_id IS NOT NULL OR replit_id IS NOT NULL 
  ORDER BY id LIMIT 20
`);
console.log('Usuarios con clerk_id o replit_id:');
for (const row of r.rows) {
  console.log(JSON.stringify(row));
}

// También buscar usuario ID 248 específicamente
const r2 = await db.query('SELECT id, clerk_id, replit_id, username, artist_name, email FROM users WHERE id = 248');
console.log('\nUsuario ID 248:', r2.rows);

// Buscar usuarios con videos en Firestore (IDs con videos: 42, 89, 88, 9, 2, 156)
const r3 = await db.query(`
  SELECT id, clerk_id, replit_id, username, artist_name, email
  FROM users WHERE id IN (2, 9, 42, 88, 89, 156, 248, 380, 386, 387)
  ORDER BY id
`);
console.log('\nUsuarios con videos:');
for (const row of r3.rows) {
  console.log(JSON.stringify(row));
}

await db.end();
