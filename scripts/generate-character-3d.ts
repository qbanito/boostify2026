/**
 * One-off / admin trigger for the Hologram 3D character generation pipeline.
 *
 * Runs the SAME pipeline as POST /api/hologram-gallery/:artistId/character-3d
 * but without the Clerk HTTP auth layer, so it can be executed locally by a
 * trusted operator (e.g. to (re)generate a model for a specific artist).
 *
 * Usage:
 *   npx tsx scripts/generate-character-3d.ts <artistId> [--force]
 *   npx tsx scripts/generate-character-3d.ts 1417 --force
 */
import 'dotenv/config';

async function main() {
  const artistId = process.argv[2] || '1417';
  const force = process.argv.includes('--force');

  console.log(`[gen-3d] Generating 3D character for artist ${artistId} (force=${force})...`);

  // Dynamic import AFTER dotenv has populated process.env so firebase/db init correctly.
  const { generateCharacter3D } = await import('../server/routes/hologram-gallery');

  const { character, alreadyExists } = await generateCharacter3D(artistId, force);
  if (alreadyExists) {
    console.log('[gen-3d] Character already existed (use --force to regenerate):');
  } else {
    console.log('[gen-3d] ✅ Character generated and saved:');
  }
  console.log(JSON.stringify(character, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[gen-3d] ❌ Failed:', err?.message || err);
    process.exit(1);
  });
