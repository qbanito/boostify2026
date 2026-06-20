// ────────────────────────────────────────────────────────────────────
// StageSync — Generate Default Asset Pack (CLI)
// ────────────────────────────────────────────────────────────────────
// Usage:
//   tsx scripts/generate-stage-sync-assets.ts          (only missing)
//   tsx scripts/generate-stage-sync-assets.ts --force  (regenerate all)
// ────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { generateDefaultAssetPack } from '../server/services/stage-sync-asset-pack';

async function main() {
  const force = process.argv.includes('--force');
  console.log(`[stage-sync-assets] starting (force=${force})`);
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY not set in env. Aborting.');
    process.exit(1);
  }

  const out = await generateDefaultAssetPack({ force });
  console.log(`\n=== StageSync Asset Pack ===`);
  console.log(`Output dir : ${out.dir}`);
  console.log(`Total      : ${out.total}`);
  console.log(`Generated  : ${out.generated}`);
  console.log(`Cached     : ${out.cached}`);
  console.log(`Failed     : ${out.failed}`);
  for (const r of out.results) {
    const tag = r.skipped ? '⏭ ' : r.provider === 'error' ? '✗ ' : '✓ ';
    console.log(`${tag}${r.slug.padEnd(34)}  ${r.url || ''}  ${r.error || ''}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
