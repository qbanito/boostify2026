/**
 * One-shot fix: Reassign tokenized songs that were created with the
 * OWNER's user id instead of the AI artist's user id.
 *
 * Specifically: songs 633, 634, 635 belong to QBANITO (user 1388),
 * but were inserted with artist_id=33 (convoycubano, the owner).
 *
 * USAGE:
 *   node fix-qbanito-tokenized-songs.mjs           # preview
 *   node fix-qbanito-tokenized-songs.mjs --apply   # actually update
 */
import 'dotenv/config';
import pg from 'pg';

const apply = process.argv.includes('--apply');
const c = new pg.Client({ connectionString: process.env.DATABASE_URL });
await c.connect();

const SONG_IDS = [633, 634, 635];
const NEW_ARTIST_ID = 1388;

const before = await c.query(
  `SELECT id, song_name, artist_id, is_active FROM tokenized_songs WHERE id = ANY($1::int[])`,
  [SONG_IDS]
);
console.log('ANTES:');
console.table(before.rows);

if (!apply) {
  console.log('\n(modo preview) Vuelve a correr con --apply para escribir.');
} else {
  const r = await c.query(
    `UPDATE tokenized_songs SET artist_id = $1, updated_at = NOW()
     WHERE id = ANY($2::int[])
     RETURNING id, song_name, artist_id`,
    [NEW_ARTIST_ID, SONG_IDS]
  );
  console.log(`\n✅ Reasignadas ${r.rowCount} canciones a artist_id=${NEW_ARTIST_ID}:`);
  console.table(r.rows);
}

await c.end();
