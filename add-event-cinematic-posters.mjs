/**
 * add-event-cinematic-posters.mjs
 * ────────────────────────────────
 * Adds cinematic_posters_json to cinematic_event_landings so events can
 * display styled banner images with text overlays in a strategic place.
 * Each entry: { imageUrl, title, subtitle, align, height }
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const alterations = [
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS cinematic_posters_json JSONB DEFAULT '[]'::jsonb`,
];

(async () => {
  const client = await pool.connect();
  try {
    for (const sql of alterations) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 90));
    }
    console.log('✅ cinematic_posters_json migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
