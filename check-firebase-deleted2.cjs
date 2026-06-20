const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase Admin using FIREBASE_ADMIN_KEY env var
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'artist-boost.firebasestorage.app'
  });
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

async function checkStorageFolder(prefix) {
  try {
    const [files] = await bucket.getFiles({ prefix, maxResults: 30 });
    return files.map(f => f.name);
  } catch (e) {
    return [`ERROR: ${e.message}`];
  }
}

async function main() {
  // Deleted IDs to check
  const deletedIds = [1382, 1394, 1395, 1396, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
  
  console.log('=== FIREBASE STORAGE CHECK FOR DELETED ARTISTS ===\n');
  
  for (const id of deletedIds) {
    const profileFiles = await checkStorageFolder(`artist-profiles/${id}/`);
    const songFiles = await checkStorageFolder(`songs/${id}/`);
    
    if (profileFiles.length > 0 || songFiles.length > 0) {
      console.log(`\n✅ ARTIST ID ${id} HAS FILES:`);
      if (profileFiles.length > 0) {
        console.log(`  Profile files:`);
        profileFiles.forEach(f => console.log(`    ${f}`));
      }
      if (songFiles.length > 0) {
        console.log(`  Song audio files:`);
        songFiles.forEach(f => console.log(`    ${f}`));
      }
    } else {
      console.log(`ID ${id}: No files found`);
    }
  }
  
  // Check Firestore songs collection for user_ids in deleted range
  console.log('\n=== FIRESTORE SONGS CHECK ===');
  for (const id of deletedIds) {
    try {
      const snap = await db.collection('songs').where('userId', '==', id).limit(10).get();
      if (!snap.empty) {
        console.log(`\n✅ Firestore songs for userId ${id}:`);
        snap.forEach(doc => {
          const d = doc.data();
          console.log(`  ${doc.id}: ${d.title || d.name || '?'} | audio: ${d.audioUrl || d.audio_url || '?'}`);
        });
      }
    } catch (e) {
      console.log(`ID ${id} Firestore error: ${e.message}`);
    }
  }

  // Also check songs with user_id as string (some Firestore collections store as string)
  console.log('\n=== FIRESTORE songs collection - all documents user_id search ===');
  try {
    // Check with numeric and string
    const snap2 = await db.collection('songs').orderBy('userId').startAt(1394).endAt(1405).limit(30).get();
    if (!snap2.empty) {
      console.log(`Found ${snap2.size} songs:`);
      snap2.forEach(doc => {
        const d = doc.data();
        console.log(`  ${doc.id}: userId=${d.userId} title=${d.title || '?'}`);
      });
    } else {
      console.log('No songs found in Firestore for that range');
    }
  } catch (e) {
    console.log(`Firestore range query error: ${e.message}`);
  }
}

main().catch(console.error).finally(() => process.exit(0));
