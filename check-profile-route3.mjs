import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Dynamically import schema
const schema = await import('./db/schema.js').catch(e => {
  console.error('Schema import error:', e.message);
  process.exit(1);
});

const { users, songs, merchandise, artistMedia } = schema;
const { eq } = await import('drizzle-orm');

try {
  console.log('Testing profile route for redwine...');
  
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.slug, 'redwine'))
    .limit(1);

  console.log('User found:', user ? user.id + ' ' + user.artistName : 'NOT FOUND');
  
  if (!user) {
    console.log('No user - would return 404');
  } else {
    const [userSongs, userMerch, userVideos] = await Promise.all([
      db.select().from(songs).where(eq(songs.userId, user.id)),
      db.select().from(merchandise).where(eq(merchandise.userId, user.id)),
      db.select().from(artistMedia).where(eq(artistMedia.userId, user.id))
    ]);
    
    console.log('Songs:', userSongs.length);
    console.log('Merch:', userMerch.length);
    console.log('Videos:', userVideos.length);
    console.log('SUCCESS - would return 200');
  }
} catch (err) {
  console.error('ROUTE ERROR:', err.message);
  console.error(err.stack);
}

await pool.end();
