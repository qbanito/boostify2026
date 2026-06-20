const { Pool } = require('pg');
require('dotenv').config({ path: '.env' });
const p = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const slugs = ['redwine_vinoconsal','redwine_lifevol2','redwineli','qbanito-nocturnal','qbanito_conciencia','qbanitobollwood'];
async function run() {
  const c = await p.connect();
  try {
    const ar = await c.query('SELECT id, artist_name, slug, genre, genres, biography, profile_image_url, profile_image, spotify_url, instagram_handle, youtube_channel, country FROM users WHERE slug = ANY($1)', [slugs]);
    console.log('ARTISTS', ar.rows.length);
    ar.rows.forEach(a => {
      console.log('\n--- ' + a.slug + ' ---');
      console.log('name:', a.artist_name, '| genre:', a.genre || JSON.stringify(a.genres), '| country:', a.country);
      console.log('bio:', (a.biography||'').slice(0,300));
      console.log('ig:', a.instagram_handle, 'spotify:', a.spotify_url, 'yt:', a.youtube_channel);
      console.log('img:', (a.profile_image_url||a.profile_image||'none').slice(0,120));
    });
    const ids = ar.rows.map(a=>a.id);
    if(ids.length) {
      const s = await c.query('SELECT s.title, s.genre, s.mood, s.streams_count, u.artist_name, u.slug FROM songs s JOIN users u ON s.user_id=u.id WHERE u.id=ANY($1) ORDER BY s.streams_count DESC NULLS LAST LIMIT 20', [ids]);
      console.log('\nSONGS', s.rows.length);
      s.rows.forEach(r => console.log(' ['+r.artist_name+'] "'+r.title+'" genre:'+r.genre+' mood:'+r.mood+' streams:'+r.streams_count));
    }
  } finally { c.release(); p.end(); }
}
run().catch(e=>{console.error(e.message);process.exit(1);});
