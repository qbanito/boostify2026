/**
 * 🧠 SMART LEAD MANAGER
 * Sistema inteligente de extracción y rotación de leads
 * 
 * Características:
 * - Rotación automática de keywords
 * - Extracción bajo demanda (solo cuando faltan leads)
 * - Cooldown por keyword para evitar saturación
 * - Resurrect automático de keywords agotados
 * 
 * Uso:
 *   node smart-lead-manager.cjs check           # Ver estado
 *   node smart-lead-manager.cjs extract INDUSTRY # Extraer si necesita
 *   node smart-lead-manager.cjs extract-all     # Extraer para todas
 *   node smart-lead-manager.cjs rotate INDUSTRY # Rotar keyword manualmente
 */

const { Pool } = require('pg');
const { ApifyClient } = require('apify-client');
const loadCampaign = require('./campaigns/campaign-loader.cjs');

// ============================================
// 🎯 CONFIGURACIÓN DE KEYWORDS POR CAMPAÑA
// ============================================
const KEYWORD_POOLS = {
  INDUSTRY: [
    'music manager United States',
    'A&R director record label',
    'talent buyer music venue',
    'music booking agent',
    'record label executive',
    'music publisher A&R',
    'concert promoter music',
    'music industry professional',
    'artist manager entertainment',
    'label scout talent'
  ],
  ARTISTS_1: [
    'independent artist musician',
    'indie musician singer',
    'singer songwriter independent',
    'unsigned artist music',
    'emerging artist indie',
    'DIY musician independent',
    'solo artist singer',
    'acoustic artist songwriter',
    'folk artist independent',
    'indie rock musician'
  ],
  ARTISTS_2: [
    'rapper hip hop artist',
    'hip hop artist underground',
    'trap artist producer',
    'underground rapper music',
    'hip hop producer beats',
    'drill artist rapper',
    'latin trap artist',
    'conscious rapper hip hop',
    'freestyle rapper artist',
    'boom bap hip hop'
  ],
  ARTISTS_3: [
    'R&B artist singer',
    'pop artist vocalist',
    'soul singer artist',
    'neo soul artist',
    'R&B vocalist independent',
    'pop singer songwriter',
    'alternative R&B artist',
    'contemporary R&B singer',
    'smooth R&B artist',
    'urban pop artist'
  ],
  ARTISTS_4: [
    'EDM artist producer',
    'DJ producer electronic',
    'electronic music producer',
    'house music DJ',
    'techno producer artist',
    'dubstep artist producer',
    'trance DJ producer',
    'bass music producer',
    'future bass artist',
    'synthwave producer'
  ]
};

// ============================================
// ⚙️ CONFIGURACIÓN DEL SISTEMA
// ============================================
const CONFIG = {
  // Umbral mínimo de leads pendientes antes de extraer
  MIN_PENDING_LEADS: 50,
  
  // Máximo leads a extraer por keyword
  MAX_LEADS_PER_EXTRACTION: 100,
  
  // Días de cooldown antes de reusar un keyword
  KEYWORD_COOLDOWN_DAYS: 7,
  
  // Días para "resucitar" un keyword agotado
  KEYWORD_RESURRECT_DAYS: 30,
  
  // Máximo extracciones por día por campaña
  MAX_EXTRACTIONS_PER_DAY: 3
};

// Conexión a Supabase
const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

async function initDatabase(client) {
  // Crear tabla de tracking de keywords si no existe
  await client.query(`
    CREATE TABLE IF NOT EXISTS keyword_tracking (
      id SERIAL PRIMARY KEY,
      campaign_id VARCHAR(50) NOT NULL,
      keyword TEXT NOT NULL,
      last_used TIMESTAMP,
      times_used INTEGER DEFAULT 0,
      leads_extracted INTEGER DEFAULT 0,
      status VARCHAR(20) DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(campaign_id, keyword)
    )
  `);

  // Crear tabla de extracción diaria
  await client.query(`
    CREATE TABLE IF NOT EXISTS extraction_log (
      id SERIAL PRIMARY KEY,
      campaign_id VARCHAR(50) NOT NULL,
      keyword TEXT NOT NULL,
      leads_found INTEGER DEFAULT 0,
      leads_new INTEGER DEFAULT 0,
      extracted_at TIMESTAMP DEFAULT NOW()
    )
  `);

  console.log('✅ Tablas de tracking inicializadas');
}

async function seedKeywords(client) {
  for (const [campaignId, keywords] of Object.entries(KEYWORD_POOLS)) {
    for (const keyword of keywords) {
      await client.query(`
        INSERT INTO keyword_tracking (campaign_id, keyword, status)
        VALUES ($1, $2, 'active')
        ON CONFLICT (campaign_id, keyword) DO NOTHING
      `, [campaignId, keyword]);
    }
  }
  console.log('✅ Keywords sembrados en la base de datos');
}

async function getNextKeyword(client, campaignId) {
  // Buscar keyword activo que no haya sido usado recientemente
  const result = await client.query(`
    SELECT keyword FROM keyword_tracking
    WHERE campaign_id = $1
      AND status = 'active'
      AND (last_used IS NULL OR last_used < NOW() - INTERVAL '${CONFIG.KEYWORD_COOLDOWN_DAYS} days')
    ORDER BY 
      COALESCE(last_used, '1970-01-01') ASC,
      times_used ASC
    LIMIT 1
  `, [campaignId]);

  if (result.rows.length > 0) {
    return result.rows[0].keyword;
  }

  // Si no hay keywords disponibles, intentar resucitar uno
  const resurrect = await client.query(`
    SELECT keyword FROM keyword_tracking
    WHERE campaign_id = $1
      AND status = 'exhausted'
      AND last_used < NOW() - INTERVAL '${CONFIG.KEYWORD_RESURRECT_DAYS} days'
    ORDER BY last_used ASC
    LIMIT 1
  `, [campaignId]);

  if (resurrect.rows.length > 0) {
    const keyword = resurrect.rows[0].keyword;
    await client.query(`
      UPDATE keyword_tracking 
      SET status = 'active', times_used = 0, leads_extracted = 0
      WHERE campaign_id = $1 AND keyword = $2
    `, [campaignId, keyword]);
    console.log(`🔄 Keyword resucitado: "${keyword}"`);
    return keyword;
  }

  return null;
}

async function getPendingLeadsCount(client, campaignId) {
  const result = await client.query(`
    SELECT COUNT(*) as count
    FROM leads l
    JOIN lead_status ls ON l.id = ls.lead_id
    WHERE l.source = $1
      AND ls.status = 'new'
      AND ls.warmup_stage < 3
  `, [campaignId]);
  
  return parseInt(result.rows[0].count);
}

async function getTodayExtractions(client, campaignId) {
  const result = await client.query(`
    SELECT COUNT(*) as count
    FROM extraction_log
    WHERE campaign_id = $1
      AND extracted_at > CURRENT_DATE
  `, [campaignId]);
  
  return parseInt(result.rows[0].count);
}

async function checkCampaignStatus(client, campaignId) {
  const pending = await getPendingLeadsCount(client, campaignId);
  const todayExtractions = await getTodayExtractions(client, campaignId);
  
  // Contar keywords por estado
  const keywordStats = await client.query(`
    SELECT 
      status,
      COUNT(*) as count
    FROM keyword_tracking
    WHERE campaign_id = $1
    GROUP BY status
  `, [campaignId]);

  const stats = {};
  keywordStats.rows.forEach(row => {
    stats[row.status] = parseInt(row.count);
  });

  return {
    campaignId,
    pendingLeads: pending,
    todayExtractions,
    maxExtractionsToday: CONFIG.MAX_EXTRACTIONS_PER_DAY,
    needsExtraction: pending < CONFIG.MIN_PENDING_LEADS && todayExtractions < CONFIG.MAX_EXTRACTIONS_PER_DAY,
    keywords: {
      active: stats.active || 0,
      exhausted: stats.exhausted || 0,
      cooldown: stats.cooldown || 0
    }
  };
}

async function smartExtract(client, campaignId) {
  const config = loadCampaign(campaignId);
  
  if (!config.apis.apify) {
    console.log(`❌ ${campaignId} no tiene API de Apify configurada`);
    return null;
  }

  // Verificar si necesita extracción
  const status = await checkCampaignStatus(client, campaignId);
  
  console.log(`\n📊 Estado de ${campaignId}:`);
  console.log(`   Leads pendientes: ${status.pendingLeads}`);
  console.log(`   Extracciones hoy: ${status.todayExtractions}/${status.maxExtractionsToday}`);
  console.log(`   Keywords activos: ${status.keywords.active}`);
  
  if (!status.needsExtraction) {
    if (status.pendingLeads >= CONFIG.MIN_PENDING_LEADS) {
      console.log(`\n✅ Suficientes leads (${status.pendingLeads} >= ${CONFIG.MIN_PENDING_LEADS}). No es necesario extraer.`);
    } else {
      console.log(`\n⏸️  Límite de extracciones alcanzado hoy (${status.todayExtractions}/${status.maxExtractionsToday})`);
    }
    return status;
  }

  // Obtener siguiente keyword
  const keyword = await getNextKeyword(client, campaignId);
  
  if (!keyword) {
    console.log(`\n⚠️  No hay keywords disponibles para ${campaignId}`);
    console.log(`   Todos están en cooldown o agotados`);
    return status;
  }

  console.log(`\n🎯 Keyword seleccionado: "${keyword}"`);
  console.log(`🚀 Iniciando extracción...`);

  try {
    const apifyClient = new ApifyClient({ token: config.apis.apify });
    
    const run = await apifyClient.actor(config.apis.apifyActor).call({
      query: keyword,
      country: config.search.country || 'United States',
      maxResults: CONFIG.MAX_LEADS_PER_EXTRACTION
    });

    console.log(`   ✅ Actor completado (Run ID: ${run.id})`);

    // Obtener resultados
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`   📥 ${items.length} leads encontrados`);

    // Insertar leads
    let inserted = 0;
    let duplicates = 0;

    for (const item of items) {
      const email = item.email || item.personal_email;
      if (!email) continue;

      try {
        const result = await client.query(`
          INSERT INTO leads (
            email, personal_email, first_name, last_name, full_name,
            job_title, company_name, company_website, company_description,
            industry, company_size, city, state, country, linkedin, keywords, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `, [
          email,
          item.personal_email || null,
          item.first_name || null,
          item.last_name || null,
          item.full_name || `${item.first_name || ''} ${item.last_name || ''}`.trim() || null,
          item.job_title || null,
          item.company_name || null,
          item.company_website || null,
          item.company_description || null,
          item.industry || null,
          item.company_size || null,
          item.city || null,
          item.state || null,
          item.country || 'United States',
          item.linkedin || null,
          keyword,
          campaignId
        ]);

        if (result.rows.length > 0) {
          await client.query(`
            INSERT INTO lead_status (lead_id, status, warmup_stage)
            VALUES ($1, 'new', 0)
          `, [result.rows[0].id]);
          inserted++;
        } else {
          duplicates++;
        }
      } catch (err) {
        // Ignorar errores de inserción
      }
    }

    // Actualizar tracking del keyword
    const newStatus = inserted < 5 ? 'exhausted' : 'active';
    await client.query(`
      UPDATE keyword_tracking 
      SET 
        last_used = NOW(),
        times_used = times_used + 1,
        leads_extracted = leads_extracted + $3,
        status = $4
      WHERE campaign_id = $1 AND keyword = $2
    `, [campaignId, keyword, inserted, newStatus]);

    // Registrar extracción
    await client.query(`
      INSERT INTO extraction_log (campaign_id, keyword, leads_found, leads_new)
      VALUES ($1, $2, $3, $4)
    `, [campaignId, keyword, items.length, inserted]);

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ✅ Nuevos: ${inserted}`);
    console.log(`   ⏭️  Duplicados: ${duplicates}`);
    
    if (newStatus === 'exhausted') {
      console.log(`   ⚠️  Keyword marcado como agotado (pocos resultados nuevos)`);
    }

    return {
      ...status,
      extracted: true,
      keyword,
      leadsFound: items.length,
      leadsNew: inserted,
      leadsDuplicate: duplicates
    };

  } catch (error) {
    console.error(`\n❌ Error en extracción: ${error.message}`);
    return { ...status, error: error.message };
  }
}

async function showFullStatus(client) {
  console.log('='.repeat(70));
  console.log('🧠 SMART LEAD MANAGER - Estado del Sistema');
  console.log('='.repeat(70));

  const campaigns = ['INDUSTRY', 'ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4'];

  for (const campaignId of campaigns) {
    const status = await checkCampaignStatus(client, campaignId);
    const config = loadCampaign(campaignId);
    
    const icon = status.needsExtraction ? '🔴' : '🟢';
    const apifyStatus = config.apis.apify ? '✅' : '❌';
    
    console.log(`\n${icon} ${campaignId} (${config.domain})`);
    console.log(`   Apify: ${apifyStatus}`);
    console.log(`   Leads pendientes: ${status.pendingLeads} (mín: ${CONFIG.MIN_PENDING_LEADS})`);
    console.log(`   Extracciones hoy: ${status.todayExtractions}/${status.maxExtractionsToday}`);
    console.log(`   Keywords: ${status.keywords.active} activos, ${status.keywords.exhausted || 0} agotados`);
    
    if (status.needsExtraction) {
      const nextKeyword = await getNextKeyword(client, campaignId);
      if (nextKeyword) {
        console.log(`   📌 Próximo keyword: "${nextKeyword.substring(0, 40)}..."`);
      } else {
        console.log(`   ⚠️  Sin keywords disponibles`);
      }
    }
  }

  // Estadísticas globales
  const globalStats = await client.query(`
    SELECT 
      COUNT(*) as total_leads,
      COUNT(*) FILTER (WHERE ls.status = 'new') as pending,
      COUNT(*) FILTER (WHERE ls.warmup_stage >= 3) as completed
    FROM leads l
    LEFT JOIN lead_status ls ON l.id = ls.lead_id
  `);

  console.log('\n' + '─'.repeat(70));
  console.log('📈 ESTADÍSTICAS GLOBALES:');
  console.log(`   Total leads en base: ${globalStats.rows[0].total_leads}`);
  console.log(`   Pendientes de warmup: ${globalStats.rows[0].pending}`);
  console.log(`   Warmup completado: ${globalStats.rows[0].completed}`);
  console.log('='.repeat(70));
}

async function rotateKeyword(client, campaignId) {
  const currentKeyword = await getNextKeyword(client, campaignId);
  
  if (currentKeyword) {
    // Marcar el actual como en cooldown
    await client.query(`
      UPDATE keyword_tracking 
      SET last_used = NOW()
      WHERE campaign_id = $1 AND keyword = $2
    `, [campaignId, currentKeyword]);
    
    // Obtener el siguiente
    const nextKeyword = await getNextKeyword(client, campaignId);
    console.log(`🔄 Keyword rotado para ${campaignId}`);
    console.log(`   Anterior: "${currentKeyword}"`);
    console.log(`   Nuevo: "${nextKeyword || 'ninguno disponible'}"`);
  }
}

// ============================================
// 🚀 MAIN
// ============================================
async function main() {
  const command = process.argv[2] || 'check';
  const campaignArg = process.argv[3];

  const pool = new Pool({
    connectionString: SUPABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();

  try {
    // Inicializar tablas
    await initDatabase(client);
    await seedKeywords(client);

    switch (command) {
      case 'check':
      case 'status':
        await showFullStatus(client);
        break;

      case 'extract':
        if (!campaignArg) {
          console.log('❌ Especifica una campaña: node smart-lead-manager.cjs extract INDUSTRY');
          break;
        }
        await smartExtract(client, campaignArg);
        break;

      case 'extract-all':
        console.log('🚀 Extracción inteligente para todas las campañas...\n');
        const campaigns = ['INDUSTRY', 'ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4'];
        for (const campaign of campaigns) {
          console.log('\n' + '─'.repeat(60));
          await smartExtract(client, campaign);
        }
        break;

      case 'rotate':
        if (!campaignArg) {
          console.log('❌ Especifica una campaña: node smart-lead-manager.cjs rotate INDUSTRY');
          break;
        }
        await rotateKeyword(client, campaignArg);
        break;

      default:
        console.log(`
🧠 SMART LEAD MANAGER - Comandos disponibles:

  node smart-lead-manager.cjs check              Ver estado de todas las campañas
  node smart-lead-manager.cjs extract CAMPAIGN   Extraer si la campaña necesita leads
  node smart-lead-manager.cjs extract-all        Extraer para todas las que necesiten
  node smart-lead-manager.cjs rotate CAMPAIGN    Rotar keyword manualmente

Campañas: INDUSTRY, ARTISTS_1, ARTISTS_2, ARTISTS_3, ARTISTS_4
        `);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
