const admin = require('firebase-admin');
require('dotenv').config();

const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: 'artist-boost.firebasestorage.app'
});
const bucket = admin.storage().bucket();

async function scanAll(prefix) {
  const [files] = await bucket.getFiles({ prefix, maxResults: 100 });
  return files.map(f => f.name);
}

async function main() {
  // Check all 4 restored firebase IDs for videos
  const ids = [1399, 1400, 1404, 1405];
  const videoExts = ['.mp4', '.mov', '.webm', '.avi', '.mkv'];

  for (const id of ids) {
    const allFiles = await scanAll(`songs/${id}/`);
    const profileFiles = await scanAll(`artist-profiles/${id}/`);
    const allCombined = [...allFiles, ...profileFiles];

    // Check extra storage paths
    const videosPath = await scanAll(`videos/${id}/`);
    const artistVideos = await scanAll(`artist-videos/${id}/`);

    const videos = [...allCombined, ...videosPath, ...artistVideos]
      .filter(f => videoExts.some(ext => f.toLowerCase().endsWith(ext)));

    console.log(`\n=== ID ${id} ===`);
    if (videos.length > 0) {
      console.log('  VIDEOS FOUND:');
      videos.forEach(v => console.log(`    ${v}`));
    } else {
      console.log('  No video files found');
    }

    // Also list all profile files for 1399
    if (id === 1399) {
      console.log('  All profile files for 1399:');
      profileFiles.forEach(f => console.log(`    ${f}`));
      console.log('  All song files for 1399:');
      allFiles.forEach(f => console.log(`    ${f}`));
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e.message); process.exit(1); });
