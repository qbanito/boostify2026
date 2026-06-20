import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function normalizeKey(key){ if(!key) return key; let k=key.trim().replace(/^['"]|['"]$/g,''); if(k.includes('\\n')) k=k.replace(/\\n/g,'\n'); return k; }
function loadCreds(){
  if(process.env.FIREBASE_ADMIN_KEY){ try{ const raw=process.env.FIREBASE_ADMIN_KEY.trim().replace(/^['"]|['"]$/g,''); const sa=JSON.parse(raw); return {projectId:sa.project_id,clientEmail:sa.client_email,privateKey:normalizeKey(sa.private_key)};}catch{} }
  return {projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:normalizeKey(process.env.FIREBASE_PRIVATE_KEY)};
}

const galleryId = process.argv[2] || 'Dn8F2K4Z6N34fOa0Roky';

async function main(){
  initializeApp({ credential: cert(loadCreds()) });
  const db = getFirestore();
  const doc = await db.collection('image_galleries').doc(galleryId).get();
  if(!doc.exists){ console.log('❌ Galería no existe'); process.exit(1); }
  const g = doc.data();
  const imgs = g.generatedImages || g.images || [];
  console.log(`Galería "${g.title||'(sin título)'}" — ${imgs.length} imágenes\n`);
  const urls = [];
  imgs.forEach((im, i) => {
    const url = typeof im === 'string' ? im : (im.url || im.imageUrl || im.src);
    urls.push(url);
    console.log(`${i+1}. ${url}`);
  });

  // Probar accesibilidad HTTP de las primeras 3
  console.log('\n⏳ Probando accesibilidad de las imágenes...');
  for (const url of urls.slice(0,5)) {
    if(!url){ console.log('   (url vacía)'); continue; }
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`   [${res.status}] ${res.headers.get('content-type')||''}  ${url.slice(0,80)}`);
    } catch(e) {
      console.log(`   [ERROR] ${e.message}  ${url.slice(0,80)}`);
    }
  }
  process.exit(0);
}
main().catch(e=>{console.error(e);process.exit(1);});
