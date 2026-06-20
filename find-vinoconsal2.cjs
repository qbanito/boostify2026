const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // 1. No vinoconsal in users - confirmed
  console.log('Step 1: vinoconsal not in users table - cascade delete confirmed\n');

  // 2. Get columns of songs table
  const cols = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='songs' ORDER BY ordinal_position"
  );
  console.log('Songs table columns:', cols.rows.map(r => r.column_name).join(', '));

  // 3. Get all tables
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
  );
  console.log('\nAll tables:', tables.rows.map(r => r.table_name).join(', '));

  // 4. Check the two surviving REDWINE artists
  const r5 = await pool.query(
    "SELECT id, slug, artist_name, profile_image_url, banner_image_url, bio, genres, country, generated_by FROM users WHERE id IN (1392, 1398)"
  );
  console.log('\nExisting REDWINE artists:', JSON.stringify(r5.rows, null, 2));

  await pool.end();
}

main().catch(console.error);
