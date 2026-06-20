/**
 * add-event-interactive-config.mjs
 * ────────────────────────────────
 * Adds an `interactive_config` JSONB column to cinematic_event_landings.
 * Lets the event owner configure the guest-driven interactive modules
 * (Soundtrack, Photo Booth, Gallery, Memory Book) with intros, prompts,
 * a suggested playlist and custom photo-booth frames. Shape:
 *
 *   {
 *     soundtrack:  { intro, playlist: [{ title, artist }] },
 *     photo_booth: { intro, hashtag, frames: [{ label, color }] },
 *     gallery:     { intro },
 *     memory_book: { intro, prompt }
 *   }
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const client = await pool.connect();
try {
  await client.query(
    `ALTER TABLE cinematic_event_landings
     ADD COLUMN IF NOT EXISTS interactive_config JSONB`
  );
  console.log('✅  interactive_config');
  console.log('\n🎉 interactive_config migration complete!');
} catch (err) {
  console.error('❌  migration failed:', err);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
