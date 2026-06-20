/**
 * One-off / admin trigger for the immersive 360° environment generation.
 *
 * Runs the SAME pipeline as POST /api/hologram-gallery/:artistId/environments/generate
 * but without the Clerk HTTP auth layer, so it can be executed locally by a
 * trusted operator.
 *
 * Usage:
 *   npx tsx scripts/generate-environments.ts <artistId> [--force]
 *   npx tsx scripts/generate-environments.ts 1417 --force
 */
import 'dotenv/config';

async function main() {
  const artistId = process.argv[2] || '1417';
  const force = process.argv.includes('--force');

  console.log(`[gen-env] Generating immersive 3D environments for artist ${artistId} (force=${force})...`);

  // Dynamic import AFTER dotenv has populated process.env so firebase/db init correctly.
  const { generateEnvironments } = await import('../server/routes/hologram-gallery');

  const { environments, alreadyExists } = await generateEnvironments(artistId, force);
  if (alreadyExists) {
    console.log('[gen-env] Environments already existed (use --force to regenerate):');
  } else {
    console.log(`[gen-env] ✅ ${environments.length} environments generated and saved:`);
  }
  for (const e of environments) {
    console.log(`  • ${e.label}: ${e.url}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[gen-env] ❌ Failed:', err?.message || err);
    process.exit(1);
  });
