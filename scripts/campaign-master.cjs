/**
 * 🎛️ CAMPAIGN MASTER - Ejecuta todas las campañas
 * 
 * Uso:
 *   node campaign-master.cjs extract    # Extrae leads de todas las campañas
 *   node campaign-master.cjs send       # Envía warmup de todas las campañas
 *   node campaign-master.cjs status     # Muestra estado de todas las campañas
 *   node campaign-master.cjs all        # Extrae + Envía
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const { Pool } = require('pg');
const loadCampaign = require('./campaigns/campaign-loader.cjs');

const execAsync = promisify(exec);

const pool = new Pool({
  connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

const CAMPAIGNS = ['INDUSTRY', 'ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4'];

async function runCommand(script, campaign) {
  try {
    const { stdout, stderr } = await execAsync(`node scripts/${script} ${campaign}`);
    return { success: true, output: stdout };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function showStatus() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 ESTADO DE TODAS LAS CAMPAÑAS');
  console.log('='.repeat(70));

  const client = await pool.connect();

  try {
    // Warmup config
    const configResult = await client.query(`
      SELECT domain, daily_limit, sent_today, warmup_week 
      FROM warmup_config 
      ORDER BY domain
    `);

    console.log('\n📧 LÍMITES DE ENVÍO:');
    console.log('─'.repeat(70));
    console.log('Dominio'.padEnd(25) + 'Límite'.padEnd(10) + 'Enviados'.padEnd(12) + 'Disponibles'.padEnd(12) + 'Semana');
    console.log('─'.repeat(70));
    
    let totalLimit = 0;
    let totalSent = 0;
    
    configResult.rows.forEach(r => {
      const available = r.daily_limit - r.sent_today;
      totalLimit += r.daily_limit || 0;
      totalSent += r.sent_today || 0;
      console.log(
        r.domain.padEnd(25) + 
        String(r.daily_limit || 0).padEnd(10) + 
        String(r.sent_today || 0).padEnd(12) +
        String(available).padEnd(12) +
        String(r.warmup_week || 1)
      );
    });
    
    console.log('─'.repeat(70));
    console.log(
      'TOTAL'.padEnd(25) + 
      String(totalLimit).padEnd(10) + 
      String(totalSent).padEnd(12) +
      String(totalLimit - totalSent).padEnd(12)
    );

    // Leads por campaña
    const leadsResult = await client.query(`
      SELECT 
        source,
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE ls.status = 'new') as new_leads,
        COUNT(*) FILTER (WHERE ls.status = 'warming') as warming,
        COUNT(*) FILTER (WHERE ls.warmup_stage = 3) as warmup_done
      FROM leads l
      JOIN lead_status ls ON l.id = ls.lead_id
      GROUP BY source
      ORDER BY source
    `);

    console.log('\n📋 LEADS POR CAMPAÑA:');
    console.log('─'.repeat(70));
    console.log('Campaña'.padEnd(15) + 'Total'.padEnd(10) + 'Nuevos'.padEnd(10) + 'En Warmup'.padEnd(12) + 'Completados');
    console.log('─'.repeat(70));
    
    leadsResult.rows.forEach(r => {
      console.log(
        (r.source || 'manual').padEnd(15) + 
        String(r.total).padEnd(10) + 
        String(r.new_leads).padEnd(10) +
        String(r.warming).padEnd(12) +
        String(r.warmup_done)
      );
    });

    // Resumen
    const totalLeads = await client.query('SELECT COUNT(*) FROM leads');
    const newLeads = await client.query("SELECT COUNT(*) FROM lead_status WHERE status = 'new'");
    
    console.log('\n📈 RESUMEN GLOBAL:');
    console.log(`   • Total leads en BD: ${totalLeads.rows[0].count}`);
    console.log(`   • Pendientes de contactar: ${newLeads.rows[0].count}`);
    console.log(`   • Capacidad diaria: ${totalLimit} emails`);
    console.log(`   • Enviados hoy: ${totalSent}`);

  } finally {
    client.release();
    await pool.end();
  }
}

async function extractAll() {
  console.log('\n' + '='.repeat(60));
  console.log('🔄 EXTRAYENDO LEADS DE TODAS LAS CAMPAÑAS');
  console.log('='.repeat(60));

  for (const campaign of CAMPAIGNS) {
    const config = loadCampaign.all.find(c => c.id === campaign);
    if (!config?.apis.apify) {
      console.log(`\n⏭️  ${campaign}: Sin API de Apify`);
      continue;
    }
    
    console.log(`\n🚀 Extrayendo ${campaign}...`);
    const result = await runCommand('apify-extract-v2.cjs', campaign);
    if (!result.success) {
      console.log(`   ❌ Error: ${result.error}`);
    }
  }
}

async function sendAll() {
  console.log('\n' + '='.repeat(60));
  console.log('📧 ENVIANDO WARMUP DE TODAS LAS CAMPAÑAS');
  console.log('='.repeat(60));

  for (const campaign of CAMPAIGNS) {
    console.log(`\n📤 Enviando ${campaign}...`);
    const result = await runCommand('warmup-sender-v2.cjs', campaign);
    if (!result.success) {
      console.log(`   ❌ Error: ${result.error}`);
    }
  }
}

async function main() {
  const action = process.argv[2] || 'status';

  console.log('\n🎛️  CAMPAIGN MASTER');
  console.log(`   Acción: ${action.toUpperCase()}`);

  switch (action.toLowerCase()) {
    case 'extract':
      await extractAll();
      break;
    case 'send':
      await sendAll();
      break;
    case 'status':
      await showStatus();
      break;
    case 'all':
      await extractAll();
      await sendAll();
      break;
    default:
      console.log('\nUso:');
      console.log('  node campaign-master.cjs extract  # Extrae leads');
      console.log('  node campaign-master.cjs send     # Envía warmup');
      console.log('  node campaign-master.cjs status   # Muestra estado');
      console.log('  node campaign-master.cjs all      # Todo');
  }
}

main();
