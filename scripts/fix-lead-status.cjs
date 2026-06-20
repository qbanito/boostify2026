/**
 * 🔧 FIX LEAD STATUS - Crear lead_status para leads que no tienen
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function fix() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Buscando leads sin status...\n');
    
    // Verificar cuántos faltan
    const missing = await client.query(`
      SELECT COUNT(*) as count 
      FROM leads l 
      LEFT JOIN lead_status ls ON l.id = ls.lead_id 
      WHERE ls.id IS NULL
    `);
    
    console.log(`⚠️ Leads sin status: ${missing.rows[0].count}`);
    
    if (parseInt(missing.rows[0].count) === 0) {
      console.log('✅ Todos los leads ya tienen status');
      return;
    }
    
    // Insertar lead_status para los que faltan
    const result = await client.query(`
      INSERT INTO lead_status (lead_id, status, warmup_stage, emails_sent)
      SELECT l.id, 'new', 0, 0
      FROM leads l
      LEFT JOIN lead_status ls ON l.id = ls.lead_id
      WHERE ls.id IS NULL
      RETURNING id
    `);
    
    console.log(`✅ Creados ${result.rows.length} registros de lead_status`);
    
    // Verificar total final
    const total = await client.query('SELECT COUNT(*) as count FROM lead_status');
    console.log(`\n📊 Total lead_status ahora: ${total.rows[0].count}`);
    
    // Distribución por status
    const byStatus = await client.query(`
      SELECT status, COUNT(*) as count 
      FROM lead_status 
      GROUP BY status
    `);
    
    console.log('\n📈 Distribución:');
    byStatus.rows.forEach(r => {
      console.log(`   ${r.status}: ${r.count}`);
    });
    
  } finally {
    client.release();
    await pool.end();
  }
}

fix();
