import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { resolve } from 'path';

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(resolve('./firebase-service-account.json'), 'utf-8'));
} catch {
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
const db = getFirestore();

// Ver todos los videos y sus userId
const snap = await db.collection('videos').get();
console.log(`Total videos en Firestore: ${snap.size}\n`);

const userIds = new Set();
for (const doc of snap.docs) {
  const data = doc.data();
  userIds.add(data.userId);
  console.log(`ID: ${doc.id}`);
  console.log(`  userId: ${data.userId}`);
  console.log(`  title: ${data.title}`);
  console.log(`  url: ${data.url?.substring(0, 80)}...`);
  console.log('');
}

console.log('userId únicos encontrados:', [...userIds]);

// También ver la colección users de Firestore para entender los IDs
const usersSnap = await db.collection('users').get();
console.log(`\nTotal users en Firestore: ${usersSnap.size}`);
for (const doc of usersSnap.docs) {
  const data = doc.data();
  console.log(`  doc.id: ${doc.id}, name: ${data.name || data.artistName}, profileImage: ${data.profileImage ? 'YES' : 'NO'}`);
}

process.exit(0);
