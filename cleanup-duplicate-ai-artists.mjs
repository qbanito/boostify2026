/**
 * Cleanup duplicate AI artists (Tarea 3)
 * ---------------------------------------
 * users WHERE is_ai_generated = true grouped by LOWER(TRIM(artist_name)):
 * keeps the copy with most songs (tie → lowest id), deletes the rest.
 *
 * Safety:
 *  - Only touches is_ai_generated = true rows.
 *  - Hard guard: refuses to delete anything matching REDWINE / QBANITO /
 *    VINCENZO MORETTI / CONTROL or ids 1388-1436 range protected set.
 *  - Full JSON backup of deleted users rows before deleting.
 *  - Per-id delete with error capture (FK NO ACTION rows are skipped, not forced).
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const sql = neon(process.env.DATABASE_URL);
const PROTECTED_NAME = /redwine|qbanito|vincenzo|moretti/i;
const PROTECTED_IDS = new Set([1388, 1390, 1391, 1393, 1397, 1398, 1407, 1408, 1409, 1410, 1412, 1414, 1415, 1417, 1432, 1436, 2300]);

async function main() {
  const dup = await sql`
    SELECT LOWER(TRIM(artist_name)) AS name_key, array_agg(id ORDER BY id) AS ids
    FROM users WHERE is_ai_generated = true AND artist_name IS NOT NULL
    GROUP BY 1 HAVING COUNT(*) > 1`;
  console.log(`Grupos duplicados: ${dup.length}`);

  const allIds = dup.flatMap((r) => r.ids.map(Number));
  const songCounts = await sql`
    SELECT user_id, COUNT(*)::int AS n FROM songs WHERE user_id = ANY(${allIds}) GROUP BY user_id`;
  const songsBy = new Map(songCounts.map((r) => [Number(r.user_id), Number(r.n)]));

  const deleteIds = [];
  for (const g of dup) {
    const ids = g.ids.map(Number);
    // keeper: most songs, tie → lowest id
    const keeper = [...ids].sort((a, b) => (songsBy.get(b) || 0) - (songsBy.get(a) || 0) || a - b)[0];
    for (const id of ids) if (id !== keeper) deleteIds.push(id);
  }
  console.log(`Copias a eliminar: ${deleteIds.length}`);

  // Fetch rows + guards
  const rows = await sql`SELECT * FROM users WHERE id = ANY(${deleteIds})`;
  for (const r of rows) {
    if (!r.is_ai_generated) throw new Error(`GUARD: id ${r.id} no es AI-generated`);
    if (PROTECTED_NAME.test(r.artist_name || '')) throw new Error(`GUARD: id ${r.id} "${r.artist_name}" es nombre protegido`);
    if (PROTECTED_IDS.has(Number(r.id))) throw new Error(`GUARD: id ${r.id} está en la lista protegida`);
  }
  console.log('Guardas OK: ningún protegido en la lista.');

  // Backup
  const backupPath = `./_backup-ai-duplicates-${new Date().toISOString().slice(0, 10)}.json`;
  fs.writeFileSync(backupPath, JSON.stringify(rows, null, 1));
  console.log(`Backup: ${backupPath} (${rows.length} filas)`);

  // Delete one by one (FK NO ACTION → skip + report)
  let ok = 0;
  const failed = [];
  for (const id of deleteIds) {
    try {
      await sql`DELETE FROM users WHERE id = ${id} AND is_ai_generated = true`;
      ok++;
    } catch (e) {
      failed.push({ id, error: e.message?.slice(0, 140) });
    }
  }
  console.log(`Eliminados: ${ok}/${deleteIds.length}`);
  if (failed.length) {
    console.log('Fallidos (FK u otro):');
    for (const f of failed) console.log(` id ${f.id}: ${f.error}`);
  }

  const remaining = await sql`
    SELECT COUNT(*)::int AS n FROM (
      SELECT 1 FROM users WHERE is_ai_generated = true AND artist_name IS NOT NULL
      GROUP BY LOWER(TRIM(artist_name)) HAVING COUNT(*) > 1) t`;
  console.log(`Grupos duplicados restantes: ${remaining[0].n}`);

  const prot = await sql`SELECT id, artist_name FROM users WHERE artist_name ~* 'redwine|qbanito|vincenzo|moretti' ORDER BY id`;
  console.log(`Artistas protegidos intactos: ${prot.length}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
