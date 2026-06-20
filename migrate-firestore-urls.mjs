/**
 * Migra URLs rotas de storage.googleapis.com al formato correcto
 * en la colección 'videos' de Firestore
 */
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Inicializar Firebase Admin
let serviceAccount;
try {
  // Intentar cargar desde archivo
  const saPath = resolve('./firebase-service-account.json');
  serviceAccount = JSON.parse(readFileSync(saPath, 'utf-8'));
} catch {
  // Usar variables de entorno
  serviceAccount = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
  };
}

initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();

function fixUrl(url) {
  if (!url) return url;
  const OLD = 'https://storage.googleapis.com/artist-boost.firebasestorage.app/';
  if (!url.startsWith(OLD)) return url;
  const path = url.slice(OLD.length);
  const encoded = path.split('/').map(encodeURIComponent).join('%2F');
  return `https://firebasestorage.googleapis.com/v0/b/artist-boost.firebasestorage.app/o/${encoded}?alt=media`;
}

async function migrateCollection(collectionName, urlFields) {
  console.log(`\n📋 Colección: ${collectionName}`);
  const snap = await firestore.collection(collectionName).get();
  
  let fixed = 0;
  const batch = firestore.batch();
  let batchCount = 0;
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const updates = {};
    
    for (const field of urlFields) {
      const val = data[field];
      if (val && typeof val === 'string' && val.startsWith('https://storage.googleapis.com/artist-boost')) {
        updates[field] = fixUrl(val);
        console.log(`  Doc ${doc.id}: ${field} → OK`);
        fixed++;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      batch.update(doc.ref, updates);
      batchCount++;
      
      // Firestore batch limit is 500
      if (batchCount >= 490) {
        await batch.commit();
        batchCount = 0;
        console.log(`  (batch commit intermedio)`);
      }
    }
  }
  
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`  ✅ ${fixed} URLs arregladas (de ${snap.size} documentos)`);
  return fixed;
}

async function main() {
  console.log('🔗 Conectado a Firestore\n');
  let total = 0;
  
  // Colecciones con URLs de Storage
  total += await migrateCollection('videos', ['url', 'thumbnailUrl', 'storagePath']);
  total += await migrateCollection('songs', ['audioUrl', 'coverArtUrl', 'url']);
  total += await migrateCollection('artists', ['profileImage', 'coverImage', 'loopVideoUrl']);
  total += await migrateCollection('users', ['profileImage', 'coverImage', 'loopVideoUrl']);
  total += await migrateCollection('musicVideoProjects', ['finalVideoUrl', 'thumbnail']);
  total += await migrateCollection('lipsyncProjects', ['videoUrl', 'artistImageUrl']);
  total += await migrateCollection('choreographyProjects', ['videoUrl', 'imageUrl']);
  
  console.log(`\n✅ Total Firestore: ${total} campos migrados`);
  process.exit(0);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
