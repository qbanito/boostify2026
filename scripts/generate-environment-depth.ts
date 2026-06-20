/**
 * Add depth maps to an artist's EXISTING immersive environments so the viewer
 * can build a 3D parallax world (no image re-render — only depth estimation).
 *
 * Usage:
 *   npx tsx scripts/generate-environment-depth.ts <artistId> [--force] [--limit=N]
 *   npx tsx scripts/generate-environment-depth.ts 1417 --limit=2
 */
import 'dotenv/config';

async function main() {
  const artistId = process.argv[2] || '1417';
  const force = process.argv.includes('--force');
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) || 0 : 0;

  console.log(`[gen-depth] Adding depth maps for artist ${artistId} (force=${force}, limit=${limit || 'all'})...`);

  const { addEnvironmentDepth } = await import('../server/routes/hologram-gallery');
  const { environments, updated } = await addEnvironmentDepth(artistId, force, limit);

  console.log(`[gen-depth] ✅ ${updated} environment(s) updated with depth.`);
  for (const e of environments) {
    console.log(`  • ${e.label}: ${e.depthUrl ? 'depth ✓' : 'no depth'}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[gen-depth] ❌ Failed:', err?.message || err);
    process.exit(1);
  });
