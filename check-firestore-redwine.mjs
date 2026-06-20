import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load env
const envContent = readFileSync(resolve('.env'), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
  const [k, ...v] = line.split('=');
  if (k && v.length) env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
}

const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

console.log('Firebase projectId:', firebaseConfig.projectId);

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Try to find redwine songs
const fields = ['artistSlug', 'slug', 'userId', 'artistId', 'artist'];
const values = ['redwine', '1392', 1392];

console.log('\n=== Searching SONGS collection ===');
for (const field of fields) {
  for (const val of values) {
    try {
      const snap = await getDocs(query(collection(db, 'songs'), where(field, '==', val), limit(5)));
      if (!snap.empty) {
        console.log(`FOUND songs with ${field}=${val}: ${snap.size} docs`);
        snap.docs.slice(0,3).forEach(d => console.log('  -', d.id, JSON.stringify(d.data()).substring(0,120)));
      }
    } catch (e) { /* skip */ }
  }
}

console.log('\n=== Searching VIDEOS collection ===');
for (const field of fields) {
  for (const val of values) {
    try {
      const snap = await getDocs(query(collection(db, 'videos'), where(field, '==', val), limit(5)));
      if (!snap.empty) {
        console.log(`FOUND videos with ${field}=${val}: ${snap.size} docs`);
        snap.docs.slice(0,3).forEach(d => console.log('  -', d.id, JSON.stringify(d.data()).substring(0,120)));
      }
    } catch (e) { /* skip */ }
  }
}

// Also check top-level songs docs for redwine
console.log('\n=== Sample from songs collection (first 5) ===');
const allSongs = await getDocs(query(collection(db, 'songs'), limit(5)));
allSongs.docs.forEach(d => {
  const data = d.data();
  console.log(d.id, '| artistSlug:', data.artistSlug, '| userId:', data.userId, '| title:', data.title || data.name);
});

process.exit(0);
