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
  console.log('=== RESTORING REDWINE VINO CON SAL VOL 2 (Firebase ID 1404) ===\n');

  // Profile & banner images
  const profileUrl = await getUrl('artist-profiles/1404/profile_1778771082147_VINO CO SAL VOL 2.png');
  const bannerUrl  = await getUrl('artist-profiles/1404/banner_1778771096275_a0ba4a57-ebd7-4b58-867a-a24e870cf5ff.png');
  console.log('Profile & banner URLs obtained');

  // Each song has audio + a corresponding cover_VINO CO SAL VOL 2.png right after it
  // The covers are all the same album art - use one shared cover URL
  const sharedCoverUrl = await getUrl('songs/1404/1778770896763_cover_VINO CO SAL VOL 2.png');
  console.log('Album cover URL obtained');

  // Insert the artist
  const insertArtist = await pool.query(`
    INSERT INTO users (
      role, slug, artist_name, biography, location, genres,
      profile_image, cover_image, banner_position,
      generated_by, is_ai_generated, is_published, page_mode,
      amazon_ai_booster_enabled, amazon_manual_picks,
      created_at, updated_at
    ) VALUES (
      'artist',
      'redwine_vinoconsal_vol2',
      'REDWINE',
      'VINO CON SAL VOL 2 es la continuación de la saga musical de REDWINE. Diez nuevas canciones que fusionan son cubano, salsa y bolero moderno, con historias de calle, de barrio y de amor profundo.',
      'MIAMI',
      ARRAY['LATIN', 'SALSA', 'SON CUBANO'],
      $1, $2,
      '50',
      33, false, true, 'artist', true, '[]'::jsonb,
      NOW(), NOW()
    ) RETURNING id, slug
  `, [profileUrl, bannerUrl]);

  const newId = insertArtist.rows[0].id;
  console.log(`\n✅ Artist restored with ID: ${newId}, slug: 'redwine_vinoconsal_vol2'`);

  // Songs for ID 1404 (audio files only - covers are paired but same artwork)
  const songs = [
    { file: '1778770885037_Azúcar en la Sombra.mp3',       title: 'Azúcar en la Sombra' },
    { file: '1778770900979_Bilongo en el Callejón.mp3',    title: 'Bilongo en el Callejón' },
    { file: '1778770915766_Café Sin Testigos.mp3',         title: 'Café Sin Testigos' },
    { file: '1778770930179_El Diablo en la Rumba.mp3',     title: 'El Diablo en la Rumba' },
    { file: '1778770944260_El Tren de Oriente.mp3',        title: 'El Tren de Oriente' },
    { file: '1778770959100_Guajira con Cadena.mp3',        title: 'Guajira con Cadena' },
    { file: '1778770974384_La Llave del Cuarto.mp3',       title: 'La Llave del Cuarto' },
    { file: '1778770991778_La Negra del Portal.mp3',       title: 'La Negra del Portal' },
    { file: '1778771007729_Malecón de Madrugada.mp3',      title: 'Malecón de Madrugada' },
    { file: '1778771022936_Tabaco y Mala Fe.mp3',          title: 'Tabaco y Mala Fe' },
  ];

  // Each song has its own corresponding cover (same art, different upload)
  const coverFiles = [
    '1778770896763_cover_VINO CO SAL VOL 2.png',
    '1778770911777_cover_VINO CO SAL VOL 2.png',
    '1778770926674_cover_VINO CO SAL VOL 2.png',
    '1778770940705_cover_VINO CO SAL VOL 2.png',
    '1778770955635_cover_VINO CO SAL VOL 2.png',
    '1778770970768_cover_VINO CO SAL VOL 2.png',
    '1778770987991_cover_VINO CO SAL VOL 2.png',
    '1778771002927_cover_VINO CO SAL VOL 2.png',
    '1778771019463_cover_VINO CO SAL VOL 2.png',
    '1778771034107_cover_VINO CO SAL VOL 2.png',
  ];

  console.log('\nRestoring songs...');
  for (let i = 0; i < songs.length; i++) {
    const audioUrl = await getUrl(`songs/1404/${songs[i].file}`);
    const coverUrl = await getUrl(`songs/1404/${coverFiles[i]}`);

    await pool.query(`
      INSERT INTO songs (user_id, title, audio_url, cover_art, is_published, genre, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, 'LATIN', NOW(), NOW())
    `, [newId, songs[i].title, audioUrl, coverUrl]);

    console.log(`  ✅ Song ${i + 1}: ${songs[i].title}`);
  }

  console.log(`\n✅ RESTORATION COMPLETE:`);
  console.log(`   Slug: redwine_vinoconsal_vol2`);
  console.log(`   New ID: ${newId}`);
  console.log(`   Songs: ${songs.length}`);
  console.log(`   Profile: /redwine_vinoconsal_vol2`);

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
