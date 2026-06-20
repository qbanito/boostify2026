/**
 * Re-compresses an artist's EXISTING stored GLB (Draco + WebP) and updates the
 * `hologram_characters` Firestore doc — WITHOUT re-running FAL (zero AI cost).
 *
 * Usage: npx tsx scripts/recompress-existing-glb.ts <artistId>
 */
import 'dotenv/config';

async function main() {
  const artistId = process.argv[2] || '1417';

  const { db: firestoreDb, storage } = await import('../server/firebase');
  const { compressGlb } = await import('../server/services/glb-compress');

  const ref = firestoreDb.collection('hologram_characters').doc(String(artistId));
  const snap = await ref.get();
  if (!snap.exists) throw new Error(`No hologram_characters doc for artist ${artistId}`);
  const data = snap.data() as any;
  const glbUrl: string = data.glbUrl;
  if (!glbUrl) throw new Error('Doc has no glbUrl');

  console.log('⬇️  Downloading current GLB:', glbUrl);
  const res = await fetch(glbUrl);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const input = Buffer.from(await res.arrayBuffer());
  console.log(`   original: ${(input.length / 1024 / 1024).toFixed(2)} MB`);

  const out = await compressGlb(input);
  if (!out.compressed) {
    console.log('ℹ️  Compression produced no smaller file — leaving doc unchanged.');
    return;
  }
  console.log(
    `   compressed: ${(out.compressedBytes / 1024 / 1024).toFixed(2)} MB ` +
      `(${((1 - out.compressedBytes / out.originalBytes) * 100).toFixed(1)}% smaller)`,
  );

  const fileName = `hologram-characters/${artistId}/${Date.now()}-character.glb`;
  const file = storage.bucket().file(fileName);
  await file.save(out.buffer, { contentType: 'model/gltf-binary', public: true });
  const newUrl = `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
  console.log('⬆️  Uploaded compressed GLB:', newUrl);

  await ref.set({ glbUrl: newUrl, compressed: true, recompressedAt: new Date().toISOString() }, { merge: true });
  console.log('✅ Firestore doc updated with compressed glbUrl.');
}

main().catch((e) => {
  console.error('❌', e);
  process.exit(1);
});
