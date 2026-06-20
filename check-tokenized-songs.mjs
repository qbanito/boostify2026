/**
 * Diagnóstico: ¿Por qué Música Tokenizada muestra "Próximamente"?
 *
 * Verifica:
 * 1. Cuántas canciones existen en `tokenized_songs`
 * 2. Qué artistId tienen
 * 3. Si están isActive=true
 * 4. Si el artistId coincide con algún users.id real
 *
 * USO: node check-tokenized-songs.mjs [artistName?]
 *   Ej: node check-tokenized-songs.mjs QBANITO
 */
import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;
const target = process.argv[2]; // optional artist name filter

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

console.log('═══════════════════════════════════════════════════════════');
console.log('  DIAGNÓSTICO: Música Tokenizada');
console.log('═══════════════════════════════════════════════════════════\n');

// 1) Count all tokenized songs
const total = await client.query('SELECT COUNT(*)::int AS n FROM tokenized_songs');
console.log(`📊 Total canciones tokenizadas en DB: ${total.rows[0].n}`);

// 2) List with artist info
const sql = `
  SELECT ts.id, ts.artist_id, ts.song_name, ts.token_symbol,
         ts.is_active, ts.created_at,
         u.id AS user_id, u.username, u.email,
         u.first_name, u.last_name
  FROM tokenized_songs ts
  LEFT JOIN users u ON u.id = ts.artist_id
  ${target ? `WHERE u.username ILIKE $1 OR u.first_name ILIKE $1 OR u.last_name ILIKE $1 OR ts.song_name ILIKE $1` : ''}
  ORDER BY ts.created_at DESC
  LIMIT 50;
`;
const params = target ? [`%${target}%`] : [];
const { rows } = await client.query(sql, params);

if (rows.length === 0) {
  console.log('\n❌ No hay canciones tokenizadas que coincidan.');
  if (!target) {
    console.log('   La tabla `tokenized_songs` está vacía o no se está insertando.');
    console.log('   Verifica que POST /api/tokenization/create esté funcionando.');
  }
} else {
  console.log(`\n✅ Encontradas ${rows.length} canciones:\n`);
  for (const r of rows) {
    const artistLabel = r.username || r.first_name || r.email || `(user ${r.user_id || 'NO MATCH'})`;
    const flag = r.is_active ? '🟢 ACTIVE' : '🔴 INACTIVE';
    console.log(`  [${r.id}] "${r.song_name}" (${r.token_symbol})`);
    console.log(`       artist_id=${r.artist_id} → ${artistLabel}  ${flag}`);
    console.log(`       creada: ${r.created_at}`);
    if (!r.user_id) {
      console.log(`       ⚠️  artist_id=${r.artist_id} NO existe en users → el viewer nunca lo encontrará`);
    } else if (!r.is_active) {
      console.log(`       ⚠️  isActive=false → el endpoint /songs/active/:id LO FILTRA`);
    }
    console.log('');
  }
}

// 3) Check what the frontend sends — pgId mapping
if (target) {
  const u = await client.query(
    `SELECT id, username, email, clerk_id, first_name, last_name FROM users
     WHERE username ILIKE $1 OR first_name ILIKE $1 OR last_name ILIKE $1
     LIMIT 5`,
    [`%${target}%`],
  );
  console.log('\n👤 Users que coinciden con "' + target + '":');
  for (const u_ of u.rows) {
    console.log(`  • id=${u_.id} username=${u_.username} clerk=${u_.clerk_id}`);
    console.log(`    → frontend GET /api/tokenization/songs/active/${u_.id}`);
  }
}

await client.end();
console.log('\n═══════════════════════════════════════════════════════════');
