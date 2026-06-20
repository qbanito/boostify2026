/**
 * 🔍 CHECK WARMUP STATUS - Verificar estado del warmup
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function check() {
  const client = await pool.connect();
  try {
    // Verificar tabla warmup_config
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 WARMUP CONFIG (límites por dominio)');
    console.log('═══════════════════════════════════════════════════════════');
    const warmup = await client.query('SELECT * FROM warmup_config ORDER BY domain');
    if (warmup.rows.length === 0) {
      console.log('⚠️ No hay configuración de warmup. Se creará automáticamente al ejecutar.');
    } else {
      warmup.rows.forEach(r => {
        console.log(`\n  🌐 ${r.domain}`);
        console.log(`     Límite diario: ${r.daily_limit}`);
        console.log(`     Enviados hoy: ${r.sent_today}`);
        console.log(`     Día warmup: ${r.warmup_day}, Semana: ${r.warmup_week}`);
        console.log(`     Último reset: ${r.last_reset}`);
      });
    }
    
    // Verificar si existe tabla lead_status
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📊 LEAD_STATUS (estado de contacto)');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      const statusCount = await client.query(`
        SELECT status, COUNT(*) as count 
        FROM lead_status 
        GROUP BY status
      `);
      statusCount.rows.forEach(r => {
        console.log(`  ${r.status}: ${r.count} leads`);
      });
    } catch (e) {
      console.log('⚠️ Tabla lead_status no existe o está vacía');
    }
    
    // Leads pendientes de warmup
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📧 LEADS PENDIENTES DE WARMUP');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      const pending = await client.query(`
        SELECT COUNT(*) as count FROM leads l
        JOIN lead_status ls ON l.id = ls.lead_id
        WHERE ls.status IN ('new', 'warming')
          AND ls.warmup_stage < 3
          AND (ls.next_email_at IS NULL OR ls.next_email_at <= NOW())
      `);
      console.log(`  ✅ Listos para contactar ahora: ${pending.rows[0].count}`);
      
      // Total con status
      const total = await client.query('SELECT COUNT(*) as count FROM lead_status');
      console.log(`  📊 Total leads con status: ${total.rows[0].count}`);
      
      // Total sin status
      const noStatus = await client.query(`
        SELECT COUNT(*) as count FROM leads l
        LEFT JOIN lead_status ls ON l.id = ls.lead_id
        WHERE ls.id IS NULL
      `);
      console.log(`  ⚠️ Leads SIN status (no en warmup): ${noStatus.rows[0].count}`);
      
    } catch (e) {
      console.log('Error:', e.message);
    }
    
    // Últimos emails enviados
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('📧 ÚLTIMOS EMAILS ENVIADOS POR DOMINIO');
    console.log('═══════════════════════════════════════════════════════════');
    
    try {
      // Emails de Brevo (info@boostifymusic.com)
      console.log('\n🟢 BREVO (info@boostifymusic.com):');
      const brevoEmails = await client.query(`
        SELECT to_email, subject, created_at
        FROM email_sends 
        WHERE from_email = 'info@boostifymusic.com'
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (brevoEmails.rows.length === 0) {
        console.log('  ⚠️ No hay emails enviados desde Brevo');
      } else {
        brevoEmails.rows.forEach(r => {
          console.log(`  ${r.created_at} -> ${r.to_email}`);
        });
      }
      
      // Emails de Resend (otros dominios)
      console.log('\n🔵 RESEND (otros dominios):');
      const resendEmails = await client.query(`
        SELECT from_email, to_email, created_at
        FROM email_sends 
        WHERE from_email != 'info@boostifymusic.com'
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      if (resendEmails.rows.length === 0) {
        console.log('  ⚠️ No hay emails enviados desde Resend');
      } else {
        resendEmails.rows.forEach(r => {
          console.log(`  ${r.from_email} -> ${r.to_email} (${r.created_at})`);
        });
      }
      
    } catch (e) {
      console.log('⚠️ Tabla email_sends no existe');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

check();
