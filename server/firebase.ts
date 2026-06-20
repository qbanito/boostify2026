import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { createPrivateKey } from 'crypto';

let app: any;
let db: any;
let auth: any;
let storage: any;

/**
 * Normalizes an RSA private key PEM so it works with OpenSSL 3.x (Node ≥18).
 * The FIREBASE_ADMIN_KEY JSON or FIREBASE_PRIVATE_KEY env var may contain
 * literal \n sequences; we ensure they become real newlines and then
 * re-export via Node's crypto so OpenSSL 3 always gets a well-formed PKCS#8 key.
 */
function normalizeFirebasePrivateKey(raw: string): string {
  // Strip surrounding single or double quotes added by dotenv / env parsers
  // e.g. FIREBASE_PRIVATE_KEY="-----BEGIN ... stored with literal leading "
  let pem = raw.trim().replace(/^['"]|['"]$/g, '');
  // Ensure literal \n sequences → real newlines (covers dotenv v<16 and manual escaping)
  pem = pem.replace(/\\n/g, '\n');
  try {
    const keyObject = createPrivateKey(pem);
    return keyObject.export({ type: 'pkcs8', format: 'pem' }) as string;
  } catch {
    // If createPrivateKey fails, return as-is and let cert() surface the real error
    return pem;
  }
}

try {
  let projectId: string | undefined;
  let clientEmail: string | undefined;
  let privateKey: string | undefined;

  // Prefer the full JSON service account key if available (FIREBASE_ADMIN_KEY)
  if (process.env.FIREBASE_ADMIN_KEY) {
    try {
      // Strip surrounding single/double quotes added by some env stores (e.g. Render dashboard)
      const raw = process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g, '');
      const sa = JSON.parse(raw);
      projectId = sa.project_id;
      clientEmail = sa.client_email;
      privateKey = sa.private_key;
    } catch {
      // Fall through to individual env vars
    }
  }

  if (!projectId) projectId = process.env.FIREBASE_PROJECT_ID;
  if (!clientEmail) clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  if (!privateKey) privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing Firebase Admin env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY');
  }

  const normalizedKey = normalizeFirebasePrivateKey(privateKey);

  app = initializeApp({
    credential: cert({
      projectId,
      clientEmail,
      privateKey: normalizedKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  });

  db = getFirestore(app);
  auth = getAuth(app);
  storage = getStorage(app);

  console.log('✅ Firebase Admin SDK initialized successfully');
  console.log('✅ Firestore, Auth, and Storage ready');
} catch (error) {
  console.error('❌ Error initializing Firebase Admin SDK:', error);
  console.log('⚠️ Firebase Admin deshabilitado - usando modo cliente solamente');
  
  db = null;
  auth = null;
  storage = null;
  app = null;
}

export { db, auth, storage, FieldValue };

// Configure Firestore security rules
const rules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /spotify_data/{userId} {
      allow read, write: if request.auth != null;
    }
    match /campaigns/{documentId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    match /marketing_metrics/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }
    match /contacts/{contactId} {
      allow read: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.userId;
    }
    match /courses/{courseId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && request.auth.uid == resource.data.createdBy;
    }
    match /course_progress/{progressId} {
      allow read: if request.auth != null && progressId.matches(request.auth.uid + '_.*');
      allow write: if request.auth != null && progressId.matches(request.auth.uid + '_.*');
    }
    match /investors/{investorId} {
      // Simplify rules for development
      allow read, write: if request.auth != null;
    }
    // New collections for the social network
    match /social_users/{userId} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    match /social_posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
    match /social_comments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null;
    }
  }
}
`;

// Configure Storage security rules
const storageRules = `
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Allow public read access to all files
      allow read: if true;

      // Only allow write access to authenticated users
      allow write: if request.auth != null;
    }
  }
}
`;

export const firebaseAdmin = app || null;