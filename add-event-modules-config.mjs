/**
 * add-event-modules-config.mjs
 * ─────────────────────────────
 * Adds modules_config, story_json, schedule_json, dress_code_json,
 * venue_json, vendors_json, gift_registry_json, and client_info columns
 * to cinematic_event_landings so the Event Creator can store full
 * module configuration and content per event.
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const alterations = [
  // Module ordering & visibility — array of module ids in display order
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS modules_config JSONB DEFAULT '["hero","rsvp","story","schedule","photo_booth","soundtrack","dress_code","venue","gallery","memory_book","vendors","gift_registry","ai_scenes","after_movie"]'::jsonb`,

  // Story module — honoree bio
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS story_json JSONB`,

  // Schedule module — timeline of the event day
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS schedule_json JSONB`,

  // Dress code module
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS dress_code_json JSONB`,

  // Venue details + directions
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS venue_json JSONB`,

  // Vendors credits
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS vendors_json JSONB`,

  // Gift registry / wishlist
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS gift_registry_json JSONB`,

  // Client contact info (for the event owner's records)
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS client_name TEXT`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS client_email TEXT`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS client_phone TEXT`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS client_notes TEXT`,

  // Feature flag for new modules
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_story BOOLEAN DEFAULT false`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_schedule BOOLEAN DEFAULT false`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_dress_code BOOLEAN DEFAULT false`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_venue BOOLEAN DEFAULT false`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_vendors BOOLEAN DEFAULT false`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_gift_registry BOOLEAN DEFAULT false`,
];

const client = await pool.connect();
try {
  for (const sql of alterations) {
    await client.query(sql);
    const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] ?? '?';
    console.log(`✅  ${col}`);
  }
  console.log('\n🎬 modules_config migration complete!');
} finally {
  client.release();
  await pool.end();
}
