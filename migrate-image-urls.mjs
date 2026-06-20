import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;
const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

function fixUrl(url) {
  if (!url) return url;
  const OLD = 'https://storage.googleapis.com/artist-boost.firebasestorage.app/';
  if (!url.startsWith(OLD)) return url;
  const path = url.slice(OLD.length);
  const encoded = path.split('/').map(encodeURIComponent).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/${encoded}?alt=media`;
}

const checks = [
  ['users', 'cover_image'],
  ['users', 'profile_image'],
  ['musicians', 'photo'],
  ['songs', 'cover_art'],
];

let total = 0;
for (const [table, col] of checks) {
  try {
    const r = await db.query(`SELECT id, ${col} FROM ${table} WHERE ${col} LIKE 'https://storage.googleapis.com/artist-boost%'`);
    if (r.rows.length === 0) { console.log(`${table}.${col}: OK (sin URLs rotas)`); continue; }
    console.log(`${table}.${col}: ${r.rows.length} rotas - migrando...`);
    for (const row of r.rows) {
      await db.query(`UPDATE ${table} SET ${col} = $1 WHERE id = $2`, [fixUrl(row[col]), row.id]);
    }
    total += r.rows.length;
    console.log(`  -> ${r.rows.length} actualizadas OK`);
  } catch(e) { console.log(`${table}.${col}: columna no existe`); }
}

console.log(`\nTotal imágenes migradas: ${total}`);
await db.end();
