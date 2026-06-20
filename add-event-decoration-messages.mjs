/**
 * add-event-decoration-messages.mjs
 * ─────────────────────────────────
 * Adds two new landing modules to cinematic_event_landings:
 *   • Elegant Messages — styled text blocks (messages_json / feature_messages)
 *   • Decorative Animations — page-wide animated ornaments
 *     (decorations_json / feature_decorations)
 */

import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const alterations = [
  // Elegant styled text blocks (array of { title, body, style, align })
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS messages_json JSONB`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_messages BOOLEAN DEFAULT false`,

  // Decorative page-wide animations ({ style, density })
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS decorations_json JSONB`,
  `ALTER TABLE cinematic_event_landings
   ADD COLUMN IF NOT EXISTS feature_decorations BOOLEAN DEFAULT false`,
];

const client = await pool.connect();
try {
  for (const sql of alterations) {
    await client.query(sql);
    const col = sql.match(/ADD COLUMN IF NOT EXISTS (\w+)/)?.[1] ?? '?';
    console.log(`✅  ${col}`);
  }
  console.log('\n🎉 messages + decorations migration complete!');
} finally {
  client.release();
  await pool.end();
}
