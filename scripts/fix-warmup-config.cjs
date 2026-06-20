/**
 * 🔧 FIX WARMUP CONFIG - Actualiza límites para todos los dominios
 */

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fixConfig() {
  const client = await pool.connect();
  
  try {
    // Actualizar todos los dominios con límite 20
    const domains = [
      'boostifymusic.com',
      'boostifymusic.site',
      'boostifymusic.space',
      'boostifymusic.sbs',
      'boostifymusic.online'
    ];
    
    for (const domain of domains) {
      await client.query(`
        INSERT INTO warmup_config (domain, daily_limit, warmup_day, warmup_week)
        VALUES ($1, 20, 1, 1)
        ON CONFLICT (domain) DO UPDATE SET daily_limit = 20
      `, [domain]);
    }
    
    const result = await client.query('SELECT domain, daily_limit, sent_today FROM warmup_config ORDER BY domain');
    console.log('\n✅ Configuración actualizada:\n');
    result.rows.forEach(r => {
      console.log(`   ${r.domain.padEnd(24)} → ${r.daily_limit}/día (enviados hoy: ${r.sent_today})`);
    });
    console.log('');
    
  } finally {
    client.release();
    await pool.end();
  }
}

fixConfig();
