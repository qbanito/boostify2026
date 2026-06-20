/**
 * Sync restored REDWINE artists (PG IDs 1407-1410) to Firestore.
 * Creates generated_artists + songs documents so the frontend can find them.
 */
require('dotenv').config();
const { neon } = require('@neondatabase/serverless');
const admin = require('firebase-admin');

const sql = neon(process.env.DATABASE_URL);

// Init Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_KEY);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const Timestamp = admin.firestore.Timestamp;

async function syncArtistToFirestore(pgArtist, pgSongs) {
  const artistId = pgArtist.id;
  const slug = pgArtist.slug;
  const artistName = pgArtist.artist_name || 'REDWINE';

  console.log('\n--- Syncing artist ID=' + artistId + ' slug=' + slug + ' ---');

  // Create artist doc in generated_artists
  const artistPayload = {
    name: artistName,
    displayName: artistName,
    slug: slug,
    biography: pgArtist.biography || '',
    location: pgArtist.location || 'MIAMI',
    genre: (pgArtist.genres && pgArtist.genres[0]) || 'LATIN',
    genres: pgArtist.genres || ['LATIN'],
    profileImage: pgArtist.profile_image || '',
    bannerImage: pgArtist.cover_image || '',
    photoURL: pgArtist.profile_image || '',
    isAIGenerated: false,
    isPublished: true,
    pgId: artistId,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  };

  const docRef = await db.collection('generated_artists').add(artistPayload);
  const firestoreId = docRef.id;

  // Update the doc to include its own ID
  await docRef.update({ firestoreId });

  console.log('  ✅ Artist Firestore doc created: ' + firestoreId);

  // Update PostgreSQL artist with firestore_id
  await sql`UPDATE users SET firestore_id = ${firestoreId} WHERE id = ${artistId}`;
  console.log('  ✅ PostgreSQL firestore_id updated');

  // Create song documents in Firestore
  let songCount = 0;
  for (const song of pgSongs) {
    const songPayload = {
      userId: firestoreId,
      artistId: firestoreId,
      artistName: artistName,
      name: song.title,
      title: song.title,
      audioUrl: song.audio_url || '',
      coverArt: song.cover_art || '',
      genre: song.genre || (pgArtist.genres && pgArtist.genres[0]) || 'LATIN',
      mood: song.mood || '',
      lyrics: song.lyrics || '',
      isPublished: true,
      generatedWithAI: false,
      pgId: song.id,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };

    const songDoc = await db.collection('songs').add(songPayload);

    // Update PostgreSQL song with firestore_id
    await sql`UPDATE songs SET firestore_id = ${songDoc.id} WHERE id = ${song.id}`;

    console.log('    ✅ Song synced: ' + song.title + ' → ' + songDoc.id);
    songCount++;
  }

  console.log('  Total songs synced: ' + songCount);
  return firestoreId;
}

async function main() {
  console.log('=== SYNCING RESTORED REDWINE ARTISTS TO FIRESTORE ===\n');

  // Get all 4 restored artists from PostgreSQL
  const artists = await sql`
    SELECT id, slug, artist_name, biography, location, genres, profile_image, cover_image
    FROM users
    WHERE id IN (1407, 1408, 1409, 1410)
    ORDER BY id
  `;

  for (const artist of artists) {
    // Get songs for this artist
    const songs = await sql`
      SELECT id, title, audio_url, cover_art, genre, mood, lyrics
      FROM songs
      WHERE user_id = ${artist.id}
      ORDER BY id
    `;

    await syncArtistToFirestore(artist, songs);
  }

  console.log('\n=== ALL DONE ===');
  console.log('Artists synced: 1407 (vinoconsal), 1408 (vinoconsal_vol2), 1409 (islacallada), 1410 (lifevol2)');
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
