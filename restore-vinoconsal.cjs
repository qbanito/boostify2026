const admin = require('firebase-admin');
const { Pool } = require('@neondatabase/serverless');
const { neonConfig } = require('@neondatabase/serverless');
const ws = require('ws');
neonConfig.webSocketConstructor = ws;
require('dotenv').config();

// Init Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'artist-boost.firebasestorage.app'
});

const bucket = admin.storage().bucket();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getDownloadUrl(filePath) {
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    action: 'read',
    expires: '03-01-2030'
  });
  return url;
}

async function main() {
  console.log('=== RESTORING REDWINE VINO CON SAL (ID 1400) ===\n');

  // Get download URLs for profile images
  const profileUrl = await getDownloadUrl('artist-profiles/1400/profile_1778636024537_VINO CON SAL PORTADA.png');
  const bannerUrl = await getDownloadUrl('artist-profiles/1400/banner_1778636043341_56f77a1d-9cf0-461e-8e68-ef36f58a6055.png');
  
  console.log('Profile image URL obtained');
  console.log('Banner image URL obtained');

  // Insert the artist back into PostgreSQL
  const insertArtist = await pool.query(`
    INSERT INTO users (
      role, slug, artist_name, biography, location, genres,
      profile_image, cover_image, banner_position,
      generated_by, is_ai_generated, is_published, page_mode,
      amazon_ai_booster_enabled, amazon_manual_picks,
      created_at, updated_at
    ) VALUES (
      'artist',
      'redwine_vinoconsal',
      'REDWINE',
      'VINO CON SAL es una propuesta musical del artista REDWINE, una fusión profunda de baladas latinas, bolero moderno y soul tropical. Cada canción es una historia de amor, nostalgia y verdad emocional, contada con voz de barrio y corazón abierto.',
      'MIAMI',
      ARRAY['LATIN', 'SOUL', 'BOLERO'],
      $1,
      $2,
      '50',
      33,
      false,
      true,
      'artist',
      true,
      '[]'::jsonb,
      NOW(),
      NOW()
    ) RETURNING id, slug, artist_name
  `, [profileUrl, bannerUrl]);

  const newArtistId = insertArtist.rows[0].id;
  console.log(`\n✅ Artist restored with ID: ${newArtistId}, slug: 'redwine_vinoconsal'`);

  // Song data for artist 1400
  const songs = [
    { filename: '1778635582494_Besos que arden.mp3',       title: 'Besos que arden' },
    { filename: '1778635592461_Ceniza y miel.mp3',         title: 'Ceniza y miel' },
    { filename: '1778635604307_Donde dejaste tu nombre.mp3', title: 'Donde dejaste tu nombre' },
    { filename: '1778635616975_Lo que no dijiste.mp3',     title: 'Lo que no dijiste' },
    { filename: '1778635631222_Ropa en el pizo.mp3',       title: 'Ropa en el piso' },
    { filename: '1778635637490_Te ame de espalda.mp3',     title: 'Te amé de espalda' },
    { filename: '1778635643839_Vino con Sal.mp3',          title: 'Vino con Sal' },
    { filename: '1778725708574_Vino con sal REMIX.mp3',    title: 'Vino con sal REMIX' },
  ];

  console.log('\nRestoring songs...');
  let songCount = 0;
  for (const song of songs) {
    const audioUrl = await getDownloadUrl(`songs/1400/${song.filename}`);
    
    await pool.query(`
      INSERT INTO songs (
        user_id, title, audio_url, is_published, generated_with_ai,
        genre, created_at, updated_at
      ) VALUES (
        $1, $2, $3, true, false,
        'LATIN', NOW(), NOW()
      )
    `, [newArtistId, song.title, audioUrl]);
    
    songCount++;
    console.log(`  ✅ Song ${songCount}: ${song.title}`);
  }

  console.log(`\n✅ RESTORATION COMPLETE:`);
  console.log(`   Artist: REDWINE (VINO CON SAL)`);
  console.log(`   Slug: redwine_vinoconsal`);
  console.log(`   New ID: ${newArtistId}`);
  console.log(`   Songs restored: ${songCount}`);
  console.log(`   Profile: /redwine_vinoconsal`);

  await pool.end();
  process.exit(0);
}

main().catch(e => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
