import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where, limit, orderBy } from 'firebase/firestore';
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

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const searchSlugs = ['redwine_vinoconsal', 'vinoconsal', 'redwine'];
const searchIds = [1394, 1395, 1396, 1399, 1400, 1401, 1402, 1403, 1404, 1405];

console.log('\n=== Searching ARTISTS/USERS in Firestore ===');
for (const coll of ['artists', 'users', 'profiles']) {
  for (const slug of searchSlugs) {
    try {
      const snap = await getDocs(query(collection(db, coll), where('slug', '==', slug), limit(5)));
      if (!snap.empty) {
        console.log(`FOUND in ${coll} with slug=${slug}:`);
        snap.docs.forEach(d => console.log('  ID:', d.id, '| data:', JSON.stringify(d.data()).substring(0, 200)));
      }
    } catch (e) { /* skip */ }
  }
  for (const id of searchIds) {
    try {
      const snap = await getDocs(query(collection(db, coll), where('pgId', '==', id), limit(3)));
      if (!snap.empty) {
        console.log(`FOUND in ${coll} with pgId=${id}:`);
        snap.docs.forEach(d => console.log('  ID:', d.id, '| data:', JSON.stringify(d.data()).substring(0, 200)));
      }
    } catch (e) { /* skip */ }
  }
}

// Also check songs collection for deleted artist IDs
console.log('\n=== Orphan songs in Firestore ===');
for (const id of searchIds) {
  try {
    const snap = await getDocs(query(collection(db, 'songs'), where('userId', '==', id), limit(5)));
    if (!snap.empty) {
      console.log(`Songs for deleted artist ID ${id}:`);
      snap.docs.forEach(d => console.log('  -', d.id, JSON.stringify(d.data()).substring(0, 150)));
    }
  } catch (e) { /* skip */ }
}

// Check if admin user (33) has any artist slugs stored in their profile
console.log('\n=== Admin user 33 in Firestore ===');
try {
  const snap = await getDocs(query(collection(db, 'users'), where('pgId', '==', 33), limit(3)));
  snap.docs.forEach(d => console.log('  ID:', d.id, '| data:', JSON.stringify(d.data()).substring(0, 300)));
} catch(e) { console.log('Error:', e.message); }

console.log('\nDone');
process.exit(0);
