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
  console.log('=== RESTORING REDWINE LIFE VOL 2 (Firebase ID 1399) ===\n');

  // Use the latest uploaded profile & banner (highest timestamp = final choice)
  const profileUrl = await getUrl('artist-profiles/1399/profile_1778549727015_magnific_generate-a-cinematic-stor_2950820607.jpg');
  const bannerUrl  = await getUrl('artist-profiles/1399/banner_1778549708480_magnific_generate-a-cinematic-stor_2950820633.jpg');
  console.log('Profile & banner URLs obtained');

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
      'redwine_lifevol2',
      'REDWINE',
      'Life Vol. 2 es la segunda entrega de la colección bilingüe de REDWINE. Canciones que hablan de amor y pérdida en dos idiomas, porque las emociones no tienen fronteras. Del español al inglés, de Harlem al mundo.',
      'HARLEM NEW YORK',
      ARRAY['R&B', 'SOUL', 'POP'],
      $1, $2,
      '50',
      33, false, true, 'artist', true, '[]'::jsonb,
      NOW(), NOW()
    ) RETURNING id, slug
  `, [profileUrl, bannerUrl]);

  const newId = insertArtist.rows[0].id;
  console.log(`\n✅ Artist restored with ID: ${newId}, slug: 'redwine_lifevol2'`);

  // 13 songs — no individual cover art exists, use profile image as cover
  const songs = [
    { file: "1778549950758_El Orgullo y el Amor.mp3",       title: "El Orgullo y el Amor" },
    { file: "1778549962337_El Tiempo No Miente.mp3",        title: "El Tiempo No Miente" },
    { file: "1778549971798_Entre Sombras y Luz.mp3",        title: "Entre Sombras y Luz" },
    { file: "1778549980621_Huellas en el Cristal.mp3",      title: "Huellas en el Cristal" },
    { file: "1778549989881_I'd Rather Let You Go.mp3",      title: "I'd Rather Let You Go" },
    { file: "1778550000238_If I had just one more minute,.mp3", title: "If I Had Just One More Minute" },
    { file: "1778550010884_Marks on the Glass (1).mp3",     title: "Marks on the Glass (Alt)" },
    { file: "1778550020485_Marks on the Glass.mp3",         title: "Marks on the Glass" },
    { file: "1778550029928_Por Lo Que Nunca Fuimos.mp3",    title: "Por Lo Que Nunca Fuimos" },
    { file: "1778550037296_Pride Over Love.mp3",            title: "Pride Over Love" },
    { file: "1778550046746_Tu Pasado Sí Importa.mp3",       title: "Tu Pasado Sí Importa" },
    { file: "1778550056406_Tus tatuajes.mp3",               title: "Tus Tatuajes" },
    { file: "1778550068309_Un Minuto Más.mp3",              title: "Un Minuto Más" },
  ];

  console.log('\nRestoring songs...');
  for (let i = 0; i < songs.length; i++) {
    const audioUrl = await getUrl(`songs/1399/${songs[i].file}`);

    await pool.query(`
      INSERT INTO songs (user_id, title, audio_url, cover_art, is_published, genre, created_at, updated_at)
      VALUES ($1, $2, $3, $4, true, 'R&B', NOW(), NOW())
    `, [newId, songs[i].title, audioUrl, profileUrl]);

    console.log(`  ✅ Song ${i + 1}: ${songs[i].title}`);
  }

  // Also store the extra profile images as artist_profile_images entries (optional alt photos)
  console.log('\nStoring alternate profile photos...');
  const altImages = [
    'artist-profiles/1399/profile_1778549608206_magnific_generate-9-different-angl_2950740036.jpg',
    'artist-profiles/1399/profile_1778549683002_magnific_redwine2-plano-cerrado-de_2950753769.jpg',
    'artist-profiles/1399/banner_1778549648396_magnific_redwine2-plano-cerrado-de_2950753769.jpg',
  ];

  // Check if artist_profile_images table has the right columns
  const colCheck = await pool.query(
    "SELECT column_name FROM information_schema.columns WHERE table_name='artist_profile_images' ORDER BY ordinal_position LIMIT 10"
  );
  console.log('  artist_profile_images columns:', colCheck.rows.map(r => r.column_name).join(', '));

  for (const imgPath of altImages) {
    try {
      const imgUrl = await getUrl(imgPath);
      const isProfile = imgPath.includes('/profile_');
      await pool.query(
        'INSERT INTO artist_profile_images (artist_id, image_url, image_type, created_at) VALUES ($1, $2, $3, NOW())',
        [newId, imgUrl, isProfile ? 'profile' : 'banner']
      );
      console.log(`  ✅ Alt image stored: ${imgPath.split('/').pop()}`);
    } catch (e) {
      console.log(`  ⚠️  Could not store alt image: ${e.message.substring(0, 80)}`);
    }
  }

  console.log(`\n✅ RESTORATION COMPLETE:`);
  console.log(`   Slug:  redwine_lifevol2`);
  console.log(`   ID:    ${newId}`);
  console.log(`   Songs: ${songs.length}`);
  console.log(`   URL:   /redwine_lifevol2`);

  await pool.end();
  process.exit(0);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
