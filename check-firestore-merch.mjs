// Script para verificar merchandise en Firestore
import 'dotenv/config';
import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase if not already
if (!admin.apps.length) {
  const serviceAccountPath = join(__dirname, 'attached_assets', 'artist-boost-firebase-adminsdk-fbsvc-c4227e7d7b_1763184143691.json');
  const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf-8'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: 'artist-boost.appspot.com'
  });
}

const db = admin.firestore();

async function checkFirestoreMerch() {
  try {
    console.log('\n=== CHECKING FIRESTORE MERCHANDISE ===\n');
    
    // Get all merchandise
    const merchandiseSnapshot = await db.collection('merchandise').limit(20).get();
    console.log('Total merchandise docs:', merchandiseSnapshot.size);
    
    if (merchandiseSnapshot.size > 0) {
      console.log('\nMerchandise items:');
      merchandiseSnapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`\n[${i + 1}] ${doc.id}:`);
        console.log(`   Name: ${data.name}`);
        console.log(`   ArtistName: ${data.artistName}`);
        console.log(`   UserId: ${data.userId} (type: ${typeof data.userId})`);
        console.log(`   Category: ${data.category}`);
        console.log(`   Price: ${data.price}`);
      });
    } else {
      console.log('No merchandise found in Firestore');
    }
    
    // Check generated_artists for merchandise
    console.log('\n\n=== CHECKING GENERATED_ARTISTS FOR MERCHANDISE ===\n');
    const artistsSnapshot = await db.collection('generated_artists')
      .where('merchandise', '!=', null)
      .limit(10)
      .get();
    
    console.log('Artists with merchandise field:', artistsSnapshot.size);
    
    if (artistsSnapshot.size > 0) {
      artistsSnapshot.docs.forEach((doc, i) => {
        const data = doc.data();
        console.log(`\n[${i + 1}] ${data.artistName || data.name}:`);
        console.log(`   PostgreSQL ID: ${data.postgresId || data.id}`);
        console.log(`   Merchandise count: ${data.merchandise?.length || 0}`);
        if (data.merchandise?.[0]) {
          console.log(`   First product: ${data.merchandise[0].name}`);
        }
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkFirestoreMerch();
