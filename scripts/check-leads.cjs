/**
 * 🔍 CHECK LEADS - Verificar leads en Supabase
 */
const { Pool } = require('pg');

try {
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
  require('dotenv').config({ path: require('path').join(__dirname, '..', '.env.secrets') });
} catch (e) { /* ignore — env vars set directly in CI */ }

const pool = new Pool({
  connectionString: process.env.SUPABASE_CONNECTION_STRING || process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const isMissingRelation = (err) => err && (err.code === '42P01' || err.code === '42703');

async function check() {
  let client;
  try {
    client = await pool.connect();
    try {
      // Total por campaña
      const bySource = await client.query(`
        SELECT source, COUNT(*) as count 
        FROM leads 
        GROUP BY source 
        ORDER BY count DESC
      `);

      console.log('='.repeat(60));
      console.log('📊 LEADS POR CAMPAÑA');
      console.log('='.repeat(60));
      bySource.rows.forEach(r => {
        console.log(`  ${r.source}: ${r.count} leads`);
      });

      // Total
      const total = await client.query('SELECT COUNT(*) as count FROM leads');
      console.log('\n' + '='.repeat(60));
      console.log(`📈 TOTAL LEADS EN BASE: ${total.rows[0].count}`);
      console.log('='.repeat(60));
    } catch (err) {
      if (!isMissingRelation(err)) throw err;
      console.log('ℹ️  leads table not found — using music_industry_contacts');
      const byCategory = await client.query(`
        SELECT COALESCE(NULLIF(category, ''), 'uncategorized') AS source, COUNT(*) AS count
        FROM music_industry_contacts
        WHERE email IS NOT NULL AND email <> ''
        GROUP BY 1
        ORDER BY count DESC
        LIMIT 15
      `);
      console.log('='.repeat(60));
      console.log('📊 CONTACTOS POR CATEGORÍA (music_industry_contacts)');
      console.log('='.repeat(60));
      byCategory.rows.forEach(r => console.log(`  ${r.source}: ${r.count}`));

      const total = await client.query(
        `SELECT COUNT(*) as count FROM music_industry_contacts WHERE email IS NOT NULL AND email <> ''`
      );
      console.log('\n' + '='.repeat(60));
      console.log(`📈 TOTAL CONTACTOS EN BASE: ${total.rows[0].count}`);
      console.log('='.repeat(60));
    }
  } catch (err) {
    // Stats are informational only — never fail the workflow.
    console.log(`⚠️  No se pudieron leer estadísticas: ${err.message}`);
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

check();
