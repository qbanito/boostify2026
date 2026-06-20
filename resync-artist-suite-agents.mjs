// Re-sync personal agent rows in artist_suite_agents to current presets
// (refreshes tools list & persona for any artist already activated).
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows: artists } = await pool.query(
    'SELECT DISTINCT artist_id FROM artist_suite_agents',
  );
  console.log(`Found ${artists.length} artist(s) with seeded agents.`);
  for (const a of artists) {
    const { artist_id } = a;
    console.log(`\n→ Re-syncing artist_id=${artist_id}`);
    // dynamic import so we hit the actual TS runtime via tsx
    const { seedPersonalAgentsForArtist } = await import(
      './server/services/artist-suite/runtime.ts'
    );
    const r = await seedPersonalAgentsForArtist(artist_id);
    console.log('  inserted:', r.inserted, 'synced:', r.synced);
  }
  await pool.end();
  console.log('\n✅ Re-sync complete.');
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
