/**
 * add-event-film-book.mjs
 * ────────────────────────
 * Adds film_book_json to cinematic_event_landings. Stores the "movie book"
 * (cinematic photo album) the host uploads: a list of page images plus
 * ordering/availability info so parents can buy the printed book later.
 *
 * Shape:
 * {
 *   images: string[],        // page image URLs
 *   title?: string,
 *   subtitle?: string,
 *   available: boolean,      // false => show "Coming soon"
 *   price?: string,
 *   currency?: string,
 *   orderUrl?: string,       // checkout / contact link
 *   comingSoonText?: string
 * }
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const alterations = [
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS film_book_json JSONB DEFAULT '{}'::jsonb`,
];

(async () => {
  const client = await pool.connect();
  try {
    for (const sql of alterations) {
      await client.query(sql);
      console.log('OK:', sql.replace(/\s+/g, ' ').slice(0, 90));
    }
    console.log('✅ film_book_json migration complete');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
