// Quick fix: rewrite tools[] for already-seeded artist_suite_agents rows.
// Run once with `npx tsx fix-artist-suite-tools.ts`.
import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PRESETS: Record<string, string[]> = {
  manager: [
    'recallArtistMemory',
    'rememberArtistFact',
    'listArtistGoals',
    'checkInOnArtistGoal',
    'queryMyArtistOverview',
    'handoffToArtistAgent',
  ],
  marketing: [
    'recallArtistMemory',
    'rememberArtistFact',
    'listArtistGoals',
    'checkInOnArtistGoal',
    'queryMyArtistOverview',
    'queryMyArtistFanMetrics',
    'queryMyArtistSongStats',
  ],
  ar: [
    'recallArtistMemory',
    'rememberArtistFact',
    'listArtistGoals',
    'checkInOnArtistGoal',
    'queryMyArtistSongStats',
    'queryMyArtistOverview',
  ],
  merch: [
    'recallArtistMemory',
    'rememberArtistFact',
    'listArtistGoals',
    'checkInOnArtistGoal',
    'queryMyArtistOverview',
    'queryMyArtistMerchPerformance',
  ],
  finance: [
    'recallArtistMemory',
    'rememberArtistFact',
    'listArtistGoals',
    'checkInOnArtistGoal',
    'queryMyArtistOverview',
    'queryMyArtistTreasury',
    'queryMyArtistMonetizationFunnel',
  ],
};

async function main() {
  const { rows } = await pool.query(
    'SELECT id, artist_id, agent_key, tools FROM artist_suite_agents ORDER BY artist_id, agent_key',
  );
  console.log(`${rows.length} agent row(s) to inspect.`);
  let updated = 0;
  for (const r of rows) {
    const want = PRESETS[r.agent_key];
    if (!want) continue;
    const cur = (r.tools as string[]) || [];
    const same = cur.length === want.length && cur.every((t, i) => t === want[i]);
    if (same) continue;
    await pool.query('UPDATE artist_suite_agents SET tools=$1::jsonb, updated_at=NOW() WHERE id=$2', [
      JSON.stringify(want),
      r.id,
    ]);
    console.log(
      `  ↻ ${r.artist_id}/${r.agent_key}: [${cur.join(',')}] → [${want.join(',')}]`,
    );
    updated++;
  }
  console.log(`\n✅ Updated ${updated} row(s).`);
  await pool.end();
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
