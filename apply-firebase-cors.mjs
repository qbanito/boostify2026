import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { readFileSync } from 'fs';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  console.error('❌ Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY');
  process.exit(1);
}

const app = initializeApp({
  credential: cert({ projectId, clientEmail, privateKey }),
  storageBucket: `${projectId}.firebasestorage.app`,
});

const corsConfig = JSON.parse(readFileSync('firebase-cors.json', 'utf8'));

const bucket = getStorage(app).bucket();
console.log(`▶ Applying CORS to gs://${bucket.name} ...`);
console.log(JSON.stringify(corsConfig, null, 2));

await bucket.setCorsConfiguration(corsConfig);

const [meta] = await bucket.getMetadata();
console.log('✅ CORS applied. Current bucket CORS:');
console.log(JSON.stringify(meta.cors, null, 2));
process.exit(0);
