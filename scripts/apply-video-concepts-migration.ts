/**
 * Apply migrations/video-concepts.sql to the configured Postgres database.
 * Run with:  npx tsx -r dotenv/config scripts/apply-video-concepts-migration.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { db } from '../db/index';

async function main() {
  const sqlPath = path.resolve(process.cwd(), 'migrations/video-concepts.sql');
  const sqlText = fs.readFileSync(sqlPath, 'utf8');

  // Split on statement boundaries while preserving DO $$ ... $$ blocks.
  const statements: string[] = [];
  let buf = '';
  let inDollar = false;
  for (const line of sqlText.split(/\r?\n/)) {
    if (/\$\$/.test(line)) {
      const occurrences = (line.match(/\$\$/g) || []).length;
      if (occurrences % 2 === 1) inDollar = !inDollar;
    }
    buf += line + '\n';
    if (!inDollar && /;\s*$/.test(line)) {
      const trimmed = buf.trim();
      if (trimmed) statements.push(trimmed);
      buf = '';
    }
  }
  if (buf.trim()) statements.push(buf.trim());

  for (const stmt of statements) {
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80);
    process.stdout.write(`▶ ${preview} ... `);
    try {
      await db.execute(stmt as any);
      console.log('ok');
    } catch (e: any) {
      console.log(`fail: ${e.message}`);
    }
  }

  const tables = await db.execute(
    `SELECT table_name FROM information_schema.tables WHERE table_name LIKE 'video_concept%' ORDER BY table_name` as any
  );
  console.log('\nFinal tables:', JSON.stringify((tables as any).rows ?? tables));
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
