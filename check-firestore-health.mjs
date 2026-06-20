/**
 * Firestore health check — verifica que el proyecto NO esté suspendido
 * y que las colecciones del perfil de artista (songs, videos, imágenes) respondan.
 *
 * Uso:  node check-firestore-health.mjs
 */
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizeKey(key) {
  if (!key) return key;
  let k = key.trim().replace(/^['"]|['"]$/g, '');
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
  return k;
}

function loadCredentials() {
  // 1) JSON completo en FIREBASE_ADMIN_KEY
  if (process.env.FIREBASE_ADMIN_KEY) {
    try {
      const raw = process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g, '');
      const sa = JSON.parse(raw);
      return {
        projectId: sa.project_id,
        clientEmail: sa.client_email,
        privateKey: normalizeKey(sa.private_key),
      };
    } catch {
      /* cae a vars individuales */
    }
  }
  // 2) Variables individuales
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

async function main() {
  const { projectId, clientEmail, privateKey } = loadCredentials();
  if (!projectId || !clientEmail || !privateKey) {
    console.error('❌ Faltan credenciales de Firebase Admin en el entorno.');
    process.exit(1);
  }

  console.log(`🔎 Proyecto: ${projectId}`);
  console.log('⏳ Conectando a Firestore...\n');

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  const collections = ['songs', 'videos', 'image_galleries', 'merchandise', 'users'];
  let allOk = true;

  for (const name of collections) {
    const started = Date.now();
    try {
      const snap = await db.collection(name).limit(5).get();
      const ms = Date.now() - started;
      // count total (puede ser costoso en colecciones grandes, usamos count())
      let total = '?';
      try {
        const agg = await db.collection(name).count().get();
        total = agg.data().count;
      } catch { /* count() puede no estar disponible, ignorar */ }
      console.log(`✅ ${name.padEnd(16)} OK   (muestra: ${snap.size}, total: ${total}, ${ms}ms)`);
    } catch (err) {
      allOk = false;
      const code = err?.code || err?.status || 'unknown';
      console.log(`❌ ${name.padEnd(16)} ERROR (${code}): ${err?.message || err}`);
      if (/suspend|billing|PERMISSION_DENIED|UNAVAILABLE|RESOURCE_EXHAUSTED/i.test(String(err?.message))) {
        console.log('   ⚠️  Posible suspensión de billing aún activa.');
      }
    }
  }

  console.log('\n' + '─'.repeat(50));
  if (allOk) {
    console.log('🟢 Firestore RESPONDE correctamente. La suspensión fue levantada.');
  } else {
    console.log('🔴 Firestore NO responde del todo. Si acabas de pagar, espera unos');
    console.log('   minutos (hasta ~1h) y vuelve a correr este script.');
  }
  process.exit(allOk ? 0 : 2);
}

main().catch((e) => {
  console.error('❌ Fallo inesperado:', e);
  process.exit(1);
});
