import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config();
const sql = neon(process.env.DATABASE_URL);

const a = await sql`SELECT id, "artistName", biography, genres, location, gender, slug FROM users WHERE LOWER("artistName") LIKE '%redwine%' OR LOWER(slug) LIKE '%redwine%' LIMIT 3`;
console.log('=== ARTIST ROW ===');
a.forEach(r => console.log(JSON.stringify({ id: r.id, name: r.artistName, slug: r.slug, bio: r.biography?.slice(0, 150) + '...', genres: r.genres, location: r.location, gender: r.gender })));

if (!a.length) { console.log('NOT FOUND'); process.exit(1); }
const id = a[0].id;

const s = await sql`SELECT title, genre, description FROM songs WHERE "artistId" = ${String(id)} OR "userId" = ${id} ORDER BY created_at DESC LIMIT 15`;
console.log(`\n=== SONGS (${s.length}) ===`);
s.forEach(r => console.log(` - "${r.title}" [${r.genre}] ${r.description?.slice(0, 80) || ''}`));

const c = await sql`SELECT agent_id, voice_id, cloned_voice_id, persona, topics, language, gender FROM artist_talk_to_me_config WHERE artist_id = ${String(id)} LIMIT 1`;
console.log('\n=== TALK TO ME CONFIG ===');
if (c.length) console.log(JSON.stringify(c[0], null, 2)); else console.log('(none)');

const bp = await sql`SELECT global_artist_score, current_era, brand_archetype, primary_genre FROM artist_blueprints WHERE artist_id = ${id} AND generation_status = 'completed' ORDER BY updated_at DESC LIMIT 1`;
console.log('\n=== BLUEPRINT ===');
if (bp.length) console.log(JSON.stringify(bp[0], null, 2)); else console.log('(none)');
