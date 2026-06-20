/**
 * Diagnóstico de un artista específico por slug.
 * Busca el usuario en Postgres, obtiene sus IDs y consulta en Firestore
 * sus galerías de imágenes, canciones y videos usando los MISMOS criterios
 * que usa el cliente (image-gallery-display.tsx / artist-profile-card.tsx).
 *
 * Uso:  node diagnose-artist.mjs juventino
 */
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import pg from 'pg';

const slug = process.argv[2] || 'juventino';

function normalizeKey(key) {
  if (!key) return key;
  let k = key.trim().replace(/^['"]|['"]$/g, '');
  if (k.includes('\\n')) k = k.replace(/\\n/g, '\n');
  return k;
}
function loadCreds() {
  if (process.env.FIREBASE_ADMIN_KEY) {
    try {
      const raw = process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g, '');
      const sa = JSON.parse(raw);
      return { projectId: sa.project_id, clientEmail: sa.client_email, privateKey: normalizeKey(sa.private_key) };
    } catch { /* fall through */ }
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: normalizeKey(process.env.FIREBASE_PRIVATE_KEY),
  };
}

async function countByUserIdVariants(db, collName, ids) {
  const found = new Map();
  for (const uid of ids) {
    try {
      const snap = await db.collection(collName).where('userId', '==', uid).get();
      snap.docs.forEach(d => found.set(d.id, d.data()));
    } catch (e) {
      console.log(`   (error en ${collName} userId==${JSON.stringify(uid)}: ${e.message})`);
    }
  }
  return found;
}

async function main() {
  console.log(`\n🔎 Diagnóstico del artista slug="${slug}"\n${'─'.repeat(50)}`);

  // 1) Postgres: buscar usuario por slug
  const { Pool } = pg;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const { rows } = await pool.query(
    'SELECT id, username, artist_name, slug, firestore_id, profile_image, cover_image, page_mode, profile_layout FROM users WHERE slug = $1 LIMIT 1',
    [slug]
  );
  if (rows.length === 0) {
    console.log(`❌ No existe usuario con slug="${slug}" en Postgres.`);
    await pool.end();
    process.exit(1);
  }
  const u = rows[0];
  console.log('👤 Usuario en Postgres:');
  console.log(`   id (pg):        ${u.id}`);
  console.log(`   artistName:     ${u.artist_name}`);
  console.log(`   firestoreId:    ${u.firestore_id || '(ninguno)'}`);
  console.log(`   profileImage:   ${u.profile_image ? 'sí' : 'NO'}`);
  console.log(`   coverImage:     ${u.cover_image ? 'sí' : 'NO'}`);
  console.log(`   pageMode:       ${u.page_mode || '(default)'}`);

  // Revisar visibilidad de secciones en profileLayout
  if (u.profile_layout) {
    try {
      const layout = typeof u.profile_layout === 'string' ? JSON.parse(u.profile_layout) : u.profile_layout;
      const vis = layout?.visibility || layout?.vis;
      if (vis) {
        console.log(`   visibility.galleries: ${vis.galleries}`);
        console.log(`   visibility.songs:     ${vis.songs}`);
        console.log(`   visibility.videos:    ${vis.videos}`);
      }
    } catch { /* ignore */ }
  }

  // 2) Firestore
  const creds = loadCreds();
  initializeApp({ credential: cert(creds) });
  const db = getFirestore();

  // IDs candidatos (mismo set que arma el cliente)
  const ids = new Set();
  ids.add(String(u.id));
  ids.add(Number(u.id));
  if (u.firestore_id) { ids.add(String(u.firestore_id)); }
  ids.add(String(slug));
  const idList = Array.from(ids);
  console.log(`\n🔑 IDs probados en Firestore: ${JSON.stringify(idList)}`);

  console.log(`\n📊 Resultados en Firestore:`);
  const galleries = await countByUserIdVariants(db, 'image_galleries', idList);
  const songs = await countByUserIdVariants(db, 'songs', idList);
  const videos = await countByUserIdVariants(db, 'videos', idList);

  // songs también puede usar artistId
  const songsByArtistId = new Map();
  for (const uid of idList) {
    try {
      const snap = await db.collection('songs').where('artistId', '==', uid).get();
      snap.docs.forEach(d => songsByArtistId.set(d.id, d.data()));
    } catch { /* ignore */ }
  }

  console.log(`   image_galleries (userId):  ${galleries.size}`);
  console.log(`   songs (userId):            ${songs.size}`);
  console.log(`   songs (artistId):          ${songsByArtistId.size}`);
  console.log(`   videos (userId):           ${videos.size}`);

  // Detalle de galerías: ¿tienen imágenes dentro?
  if (galleries.size > 0) {
    console.log(`\n🖼️  Detalle de galerías:`);
    for (const [id, g] of galleries) {
      const imgs = g.generatedImages || g.images || [];
      console.log(`   - "${g.title || '(sin título)'}" (${id}): ${Array.isArray(imgs) ? imgs.length : 0} imágenes, userId guardado=${JSON.stringify(g.userId)}`);
    }
  } else {
    console.log(`\n⚠️  No se encontró ninguna galería para este artista con los IDs probados.`);
    // Buscar de forma amplia: ¿existe alguna galería cuyo userId contenga algo del artista?
  }

  await pool.end();
  console.log(`\n${'─'.repeat(50)}\n✅ Diagnóstico completado.`);
  process.exit(0);
}

main().catch(e => { console.error('❌ Error:', e); process.exit(1); });
