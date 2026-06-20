import 'dotenv/config';
import { Pool, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const client = await pool.connect();
try {
  const res = await client.query(
    `SELECT id, slug, epk_data FROM artist_epks WHERE slug = $1`,
    ['redwine-1409']
  );

  if (!res.rows.length) {
    console.log('No EPK found for redwine-1409');
    process.exit(0);
  }

  const row = res.rows[0];
  console.log('Found EPK id:', row.id, '| slug:', row.slug);

  const epk = typeof row.epk_data === 'string' ? JSON.parse(row.epk_data) : row.epk_data;
  const oldInfluences = epk.influences || [];
  console.log('Current influences:', JSON.stringify(oldInfluences));

  const blocked = /(silvio\s*rodr[ií]gu[e]z|pablo\s*milan[eé]s|nueva\s*trova)/i;
  epk.influences = oldInfluences.filter(inf => !blocked.test(inf));
  console.log('Cleaned influences:', JSON.stringify(epk.influences));

  await client.query(
    `UPDATE artist_epks SET epk_data = $1 WHERE id = $2`,
    [JSON.stringify(epk), row.id]
  );

  console.log('EPK updated successfully.');
} finally {
  client.release();
  await pool.end();
}
