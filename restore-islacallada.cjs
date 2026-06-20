const admin = require('firebase-admin');
const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

const sa = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(sa),
  storageBucket: 'artist-boost.firebasestorage.app'
});
const bucket = admin.storage().bucket();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getUrl(filePath) {
  const [url] = await bucket.file(filePath).getSignedUrl({ action: 'read', expires: '03-01-2030' });
  return url;
}

async function main() {
  console.log('=== RESTORING REDWINE ISLA CALLADA (Firebase ID 1405) ===\n');

  const profileUrl = await getUrl('artist-profiles/1405/profile_1778776349996_PORTADA.png');
  const bannerUrl  = await getUrl('artist-profiles/1405/banner_1778776370199_7a2aebe0-f43e-4b8b-8ee5-bed93fb5a570.png');
  console.log('Profile & banner URLs obtained');

  const insertArtist = await pool.query(`
    INSERT INTO users (
      role, slug, artist_name, biography, location, genres,
      profile_image, cover_image, banner_position,
      generated_by, is_ai_generated, is_published, page_mode,
      amazon_ai_booster_enabled, amazon_manual_picks,
      created_at, updated_at
    ) VALUES (
      'artist',
      'redwine_islacallada',
      'REDWINE',
      'La Isla Callada es el proyecto más íntimo y político de REDWINE. Diez canciones que hablan de Cuba desde adentro — de los que esperan, de los que callan, de los que nunca se rinden. Música de pueblo, con alma de resistencia.',
      'CUBA / MIAMI',
      ARRAY['TROVA', 'LATIN', 'FOLK'],
      $1, $2,
      '50',
      33, false, true, 'artist', true, '[]'::jsonb,
      NOW(), NOW()
    ) RETURNING id, slug
  `, [profileUrl, bannerUrl]);

  const newId = insertArtist.rows[0].id;
  console.log(`\n✅ Artist restored with ID: ${newId}, slug: 'redwine_islacallada'`);

  // Songs paired with their covers (audio + cover_PORTADA.png alternating)
  const songs = [
    { audio: '1778776471408_Candado en la Boca.mp3',          cover: '1778776479599_cover_PORTADA.png',  title: 'Candado en la Boca' },
    { audio: '1778776483890_Cartas Que No Llegaron.mp3',      cover: '1778776493953_cover_PORTADA.png',  title: 'Cartas Que No Llegaron' },
    { audio: '1778776497532_Cuando Cuba Cante Libre.mp3',     cover: '1778776506869_cover_PORTADA.png',  title: 'Cuando Cuba Cante Libre' },
    { audio: '1778776510300_El Hombre del Malecón.mp3',       cover: '1778776520635_cover_PORTADA.png',  title: 'El Hombre del Malecón' },
    { audio: '1778776524162_El Niño Que No Jugaba.mp3',       cover: '1778776536523_cover_PORTADA.png',  title: 'El Niño Que No Jugaba' },
    { audio: '1778776540212_La Isla Callada.mp3',             cover: '1778776548292_cover_PORTADA.png',  title: 'La Isla Callada' },
    { audio: '1778776551542_La Policía del Silencio.mp3',     cover: '1778776561020_cover_PORTADA.png',  title: 'La Policía del Silencio' },
    { audio: '1778776564678_Los Que Mandan No Hacen Cola.mp3',cover: '1778776574529_cover_PORTADA.png',  title: 'Los Que Mandan No Hacen Cola' },
    { audio: '1778776578065_Madre de Preso.mp3',              cover: '1778776588719_cover_PORTADA.png',  title: 'Madre de Preso' },
    { audio: '1778776592276_No Hay Luz en el Barrio.mp3',     cover: '1778776601937_cover_PORTADA.png',  title: 'No Hay Luz en el Barrio' },
  ];

  console.log('\nRestoring songs...');
  for (let i = 0; i < songs.length; i++) {
    const audioUrl = await getUrl(`songs/1405/${songs[i].audio}`);
    const coverUrl = await getUrl(`songs/1405/${songs[i].cover}`);

    await pool.query(`
      INSERT INTO songs (user_id, title, audio_url, cover_art, is_published, genre, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, 'LATIN', NOW(), NOW())
    `, [newId, songs[i].title, audioUrl, coverUrl]);

    console.log(`  ✅ Song ${i + 1}: ${songs[i].title}`);
  }

  console.log(`\n✅ RESTORATION COMPLETE:`);
  console.log(`   Slug: redwine_islacallada`);
  console.log(`   New ID: ${newId}`);
  console.log(`   Songs: ${songs.length}`);
  console.log(`   Profile: /redwine_islacallada`);

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
