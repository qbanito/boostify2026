require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
pool.query(
  `SELECT id, artist_name, profile_image, cover_image, loop_video_url FROM users WHERE loop_video_url IS NOT NULL AND loop_video_url != '' LIMIT 5`,
  (err, r) => {
    if (err) return console.log(err.message);
    r.rows.forEach(row => {
      console.log(row.id, row.artist_name);
      console.log('  loopVideo:', row.loop_video_url?.slice(0, 120));
      console.log('  profileImage:', row.profile_image?.slice(0, 80));
      console.log('  coverImage:', row.coverImage?.slice(0, 80));
    });
    pool.end();
  }
);
