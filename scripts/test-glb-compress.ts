/**
 * Verifies the GLB compression pipeline (Draco + WebP textures) on an existing
 * stored model WITHOUT calling FAL. Usage:
 *   npx tsx scripts/test-glb-compress.ts <glbUrl>
 */
import 'dotenv/config';

async function main() {
  const url =
    process.argv[2] ||
    'https://storage.googleapis.com/artist-boost.firebasestorage.app/hologram-characters/1417/1781120655569-character.glb';

  console.log('⬇️  Downloading GLB:', url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  console.log(`   original: ${(input.length / 1024 / 1024).toFixed(2)} MB`);

  const { compressGlb } = await import('../server/services/glb-compress');
  const t0 = Date.now();
  const out = await compressGlb(input);
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('—'.repeat(40));
  console.log(`   compressed: ${(out.compressedBytes / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   ratio:      ${((1 - out.compressedBytes / out.originalBytes) * 100).toFixed(1)}% smaller`);
  console.log(`   applied:    ${out.compressed}`);
  console.log(`   took:       ${secs}s`);
  console.log('✅ Compression pipeline OK');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
