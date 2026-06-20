import 'dotenv/config';
import pg from 'pg';
const { Client } = pg;

const db = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await db.connect();

// Ver columnas reales
const tables = ['musicians', 'songs', 'users', 'artists'];
for (const table of tables) {
  try {
    const r = await db.query(`SELECT column_name FROM information_schema.columns WHERE table_name='${table}' AND table_schema='public' ORDER BY ordinal_position`);
    if (r.rows.length > 0) {
      console.log(`${table}: ${r.rows.map(x => x.column_name).join(', ')}`);
    }
  } catch(e) { console.log(`${table}: error`); }
}

// Buscar cualquier URL rota en todas las tablas relevantes
const urlColumns = [
  ['musicians', 'profile_image'], ['musicians', 'cover_image'],
  ['users', 'profile_image_url'], ['users', 'cover_image'],
  ['songs', 'cover_art_url'], ['songs', 'cover_image_url'],
];

console.log('\n--- URLs rotas por columna ---');
for (const [table, col] of urlColumns) {
  try {
    const r = await db.query(`SELECT count(*) FROM ${table} WHERE ${col} LIKE 'https://storage.googleapis.com/artist-boost%'`);
    console.log(`${table}.${col}: ${r.rows[0].count} rotas`);
  } catch(e) { console.log(`${table}.${col}: no existe`); }
}

await db.end();
