const admin = require('firebase-admin');
const path = require('path');
require('dotenv').config();

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json';
  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'artist-boost.firebasestorage.app'
    });
  } catch (e) {
    // Try environment variable approach
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'artist-boost.firebasestorage.app'
    });
  }
}

const bucket = admin.storage().bucket();
const db = admin.firestore();

async function main() {
  // Deleted IDs to check: 1382, 1394-1396, 1399-1405
  const deletedIds = [1382, 1394, 1395, 1396, 1399, 1400, 1401, 1402, 1403, 1404, 1405];
  
  console.log('=== CHECKING FIREBASE STORAGE FOR DELETED ARTIST FILES ===\n');
  
  for (const id of deletedIds) {
    console.log(`\n--- Artist ID ${id} ---`);
    
    // Check artist profile images folder
    try {
      const [profileFiles] = await bucket.getFiles({ prefix: `artist-profiles/${id}/` });
      if (profileFiles.length > 0) {
        console.log(`  Profile images (${profileFiles.length}):`);
        profileFiles.forEach(f => console.log(`    ${f.name}`));
      } else {
        console.log(`  No profile images found`);
      }
    } catch (e) {
      console.log(`  Error checking profile: ${e.message}`);
    }
    
    // Check songs folder
    try {
      const [songFiles] = await bucket.getFiles({ prefix: `songs/${id}/` });
      if (songFiles.length > 0) {
        console.log(`  Song files (${songFiles.length}):`);
        songFiles.forEach(f => console.log(`    ${f.name}`));
      } else {
        console.log(`  No song files found`);
      }
    } catch (e) {
      console.log(`  Error checking songs: ${e.message}`);
    }
    
    // Check Firestore for artist documents with this user_id
    try {
      const artistQuery = await db.collection('artists').where('userId', '==', id).limit(5).get();
      if (!artistQuery.empty) {
        console.log(`  Firestore artists (${artistQuery.size}):`);
        artistQuery.forEach(doc => console.log(`    ${doc.id}: ${JSON.stringify(doc.data()).substring(0, 100)}`));
      }
      
      // Also check songs collection
      const songQuery = await db.collection('songs').where('userId', '==', id).limit(10).get();
      if (!songQuery.empty) {
        console.log(`  Firestore songs (${songQuery.size}):`);
        songQuery.forEach(doc => console.log(`    ${doc.id}: ${doc.data().title}`));
      }
    } catch (e) {
      console.log(`  Error checking Firestore: ${e.message}`);
    }
  }
  
  // Also search Firestore for any document with slug containing 'vinoconsal'
  console.log('\n=== FIRESTORE SEARCH FOR VINOCONSAL ===');
  try {
    const snap = await db.collection('artists').where('slug', '==', 'redwine_vinoconsal').get();
    if (!snap.empty) {
      snap.forEach(doc => console.log('Found:', doc.id, JSON.stringify(doc.data(), null, 2)));
    } else {
      console.log('No Firestore artist with slug redwine_vinoconsal found');
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
}

main().catch(console.error).finally(() => process.exit(0));
