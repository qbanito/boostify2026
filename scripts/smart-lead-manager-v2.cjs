/**
 * 🧠 SMART LEAD MANAGER V2
 * Sistema inteligente de extracción usando Google Search Scraper
 * 
 * Usa: apify/google-search-scraper (funciona con plan gratis)
 * Extrae emails de perfiles de LinkedIn
 * 
 * Uso:
 *   node smart-lead-manager-v2.cjs check           # Ver estado
 *   node smart-lead-manager-v2.cjs extract INDUSTRY # Extraer si necesita
 *   node smart-lead-manager-v2.cjs extract-all     # Extraer para todas
 */

const { Pool } = require('pg');
const { ApifyClient } = require('apify-client');
const loadCampaign = require('./campaigns/campaign-loader.cjs');

// ============================================
// 🎯 KEYWORD POOLS - Optimizados para Google Search
// ============================================
const KEYWORD_POOLS = {
  INDUSTRY: [
    'music manager contact email',
    'artist manager booking email',
    'A&R director email contact',
    'talent buyer music email',
    'booking agent music email',
    'record label A&R email',
    'music publisher contact email',
    'concert promoter email contact',
    'music industry professional email',
    'entertainment manager email'
  ],
  ARTISTS_1: [
    'indie musician contact email',
    'independent artist email contact',
    'singer songwriter email',
    'unsigned artist contact email',
    'emerging artist email',
    'DIY musician email contact',
    'solo artist email',
    'acoustic artist email contact',
    'folk artist email',
    'indie rock band email'
  ],
  ARTISTS_2: [
    'hip hop producer email contact',
    'rapper email contact',
    'trap producer email',
    'hip hop artist email',
    'beat maker email contact',
    'underground rapper email',
    'drill artist email',
    'hip hop beatmaker email',
    'freestyle rapper email',
    'rap artist contact email'
  ],
  ARTISTS_3: [
    'R&B artist email contact',
    'pop artist email',
    'soul singer email contact',
    'neo soul artist email',
    'R&B vocalist email',
    'pop singer email contact',
    'alternative R&B email',
    'contemporary R&B email',
    'urban artist email',
    'R&B producer email'
  ],
  ARTISTS_4: [
    'EDM producer email contact',
    'DJ email contact booking',
    'electronic music producer email',
    'house music DJ email',
    'techno producer email',
    'dubstep artist email',
    'trance DJ email contact',
    'bass music producer email',
    'electronic artist email',
    'music producer EDM email'
  ]
};

// ============================================
// ⚙️ CONFIGURACIÓN
// ============================================
const CONFIG = {
  MIN_PENDING_LEADS: 50,
  MAX_LEADS_PER_EXTRACTION: 50,
  KEYWORD_COOLDOWN_DAYS: 7,
  KEYWORD_RESURRECT_DAYS: 30,
  MAX_EXTRACTIONS_PER_DAY: 5,
  PAGES_PER_SEARCH: 5,
  RESULTS_PER_PAGE: 20
};

const SUPABASE_URL = 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres';

// ============================================
// 📧 EXTRACTOR DE EMAILS
// ============================================
function extractEmailsFromText(text) {
  if (!text) return [];
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return text.match(emailRegex) || [];
}

function parseLinkedInResult(result) {
  const leads = [];
  
  if (!result.organicResults) return leads;
  
  for (const item of result.organicResults) {
    // Extraer emails del título y descripción
    const allText = `${item.title || ''} ${item.description || ''}`;
    const emails = extractEmailsFromText(allText);
    
    if (emails.length === 0) continue;
    
    // Extraer nombre del título
    let fullName = item.title || '';
    fullName = fullName.split(' - ')[0].trim();
    fullName = fullName.replace(/[^\w\s]/g, '').trim();
    
    const nameParts = fullName.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Extraer job title y company
    let jobTitle = '';
    let companyName = '';
    
    if (item.personalInfo) {
      jobTitle = item.personalInfo.jobTitle || '';
      companyName = item.personalInfo.companyName || '';
    } else if (item.title && item.title.includes(' - ')) {
      jobTitle = item.title.split(' - ')[1] || '';
    }
    
    // Extraer ubicación
    let city = '';
    let state = '';
    let country = 'United States';
    
    if (item.personalInfo && item.personalInfo.location) {
      const locParts = item.personalInfo.location.split(',').map(p => p.trim());
      city = locParts[0] || '';
      state = locParts[1] || '';
      country = locParts[2] || 'United States';
    }
    
    for (const email of emails) {
      // Filtrar emails genéricos
      if (email.includes('example.com') || email.includes('linkedin.com')) continue;
      
      leads.push({
        email: email.toLowerCase(),
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        jobTitle,
        companyName,
        city,
        state,
        country,
        linkedin: item.url || '',
        description: item.description || ''
      });
    }
  }
  
  return leads;
}

// ============================================
// 🗄️ DATABASE
// ============================================
async function initDatabase(client) {
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
  console.log('✅ Keywords sembrados');
}

async function getNextKeyword(client, campaignId) {
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

  // Resucitar keyword si es necesario
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
    console.log(`🔄 Keyword resucitado: "${keyword.substring(0, 40)}..."`);
    return keyword;
  }

  return null;
}

async function getPendingLeadsCount(client, campaignId) {
  // Contar leads que pertenecen a esta campaña Y no han sido contactados
  const result = await client.query(`
    SELECT COUNT(*) as count
    FROM leads l
    LEFT JOIN lead_status ls ON l.id = ls.lead_id
    WHERE l.source = $1
      AND (ls.status IS NULL OR ls.status = 'new')
      AND (ls.warmup_stage IS NULL OR ls.warmup_stage < 3)
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
  
  const keywordStats = await client.query(`
    SELECT status, COUNT(*) as count
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
      exhausted: stats.exhausted || 0
    }
  };
}

// ============================================
// 🚀 EXTRACCIÓN INTELIGENTE
// ============================================
async function smartExtract(client, campaignId) {
  const config = loadCampaign(campaignId);
  
  if (!config.apis.apify) {
    console.log(`❌ ${campaignId} no tiene API de Apify`);
    return null;
  }

  const status = await checkCampaignStatus(client, campaignId);
  
  console.log(`\n📊 Estado de ${campaignId}:`);
  console.log(`   Leads pendientes: ${status.pendingLeads}`);
  console.log(`   Extracciones hoy: ${status.todayExtractions}/${status.maxExtractionsToday}`);
  console.log(`   Keywords activos: ${status.keywords.active}`);
  
  if (!status.needsExtraction) {
    if (status.pendingLeads >= CONFIG.MIN_PENDING_LEADS) {
      console.log(`\n✅ Suficientes leads (${status.pendingLeads}). No extrae.`);
    } else {
      console.log(`\n⏸️  Límite diario alcanzado`);
    }
    return status;
  }

  const keyword = await getNextKeyword(client, campaignId);
  
  if (!keyword) {
    console.log(`\n⚠️  Sin keywords disponibles`);
    return status;
  }

  console.log(`\n🎯 Keyword: "${keyword.substring(0, 50)}..."`);
  console.log(`🚀 Iniciando Google Search...`);

  try {
    const apifyClient = new ApifyClient({ token: config.apis.apify });
    
    // Usar Google Search Scraper
    const run = await apifyClient.actor('apify/google-search-scraper').call({
      queries: keyword,
      maxPagesPerQuery: CONFIG.PAGES_PER_SEARCH,
      resultsPerPage: CONFIG.RESULTS_PER_PAGE,
      countryCode: 'us',
      languageCode: 'en'
    });

    console.log(`   ✅ Búsqueda completada (Run: ${run.id})`);

    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    
    // Parsear resultados
    let allLeads = [];
    for (const result of items) {
      const leads = parseLinkedInResult(result);
      allLeads = allLeads.concat(leads);
    }

    console.log(`   📥 ${allLeads.length} leads con email encontrados`);

    if (allLeads.length === 0) {
      // Marcar keyword como agotado
      await client.query(`
        UPDATE keyword_tracking 
        SET last_used = NOW(), times_used = times_used + 1, status = 'exhausted'
        WHERE campaign_id = $1 AND keyword = $2
      `, [campaignId, keyword]);
      
      console.log(`   ⚠️  Keyword sin resultados, marcado como agotado`);
      return { ...status, extracted: true, leadsNew: 0 };
    }

    // Insertar leads
    let inserted = 0;
    let duplicates = 0;

    for (const lead of allLeads) {
      try {
        const result = await client.query(`
          INSERT INTO leads (
            email, first_name, last_name, full_name,
            job_title, company_name, city, state, country, 
            linkedin, company_description, keywords, source
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (email) DO NOTHING
          RETURNING id
        `, [
          lead.email,
          lead.firstName,
          lead.lastName,
          lead.fullName,
          lead.jobTitle,
          lead.companyName,
          lead.city,
          lead.state,
          lead.country,
          lead.linkedin,
          lead.description,
          keyword.split(' site:')[0],
          campaignId
        ]);

        if (result.rows.length > 0) {
          await client.query(`
            INSERT INTO lead_status (lead_id, status, warmup_stage)
            VALUES ($1, 'new', 0)
          `, [result.rows[0].id]);
          inserted++;
          console.log(`   ✅ ${lead.email} (${lead.fullName})`);
        } else {
          duplicates++;
        }
      } catch (err) {
        // Ignorar errores
      }
    }

    // Actualizar keyword tracking
    const newStatus = inserted < 3 ? 'exhausted' : 'active';
    await client.query(`
      UPDATE keyword_tracking 
      SET last_used = NOW(), times_used = times_used + 1, 
          leads_extracted = leads_extracted + $3, status = $4
      WHERE campaign_id = $1 AND keyword = $2
    `, [campaignId, keyword, inserted, newStatus]);

    // Log de extracción
    await client.query(`
      INSERT INTO extraction_log (campaign_id, keyword, leads_found, leads_new)
      VALUES ($1, $2, $3, $4)
    `, [campaignId, keyword.substring(0, 100), allLeads.length, inserted]);

    console.log(`\n📊 RESULTADO:`);
    console.log(`   ✅ Nuevos: ${inserted}`);
    console.log(`   ⏭️  Duplicados: ${duplicates}`);
    
    if (newStatus === 'exhausted') {
      console.log(`   ⚠️  Keyword agotado`);
    }

    return {
      ...status,
      extracted: true,
      keyword: keyword.substring(0, 50),
      leadsFound: allLeads.length,
      leadsNew: inserted,
      leadsDuplicate: duplicates
    };

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    return { ...status, error: error.message };
  }
}

async function showFullStatus(client) {
  console.log('='.repeat(70));
  console.log('🧠 SMART LEAD MANAGER V2 - Estado del Sistema');
  console.log('='.repeat(70));

  const campaigns = ['INDUSTRY', 'ARTISTS_1', 'ARTISTS_2', 'ARTISTS_3', 'ARTISTS_4'];
  let totalPending = 0;

  for (const campaignId of campaigns) {
    const status = await checkCampaignStatus(client, campaignId);
    const config = loadCampaign(campaignId);
    
    const icon = status.needsExtraction ? '🔴' : '🟢';
    totalPending += status.pendingLeads;
    
    console.log(`\n${icon} ${campaignId} (${config.domain})`);
    console.log(`   Leads pendientes: ${status.pendingLeads} (mín: ${CONFIG.MIN_PENDING_LEADS})`);
    console.log(`   Extracciones hoy: ${status.todayExtractions}/${status.maxExtractionsToday}`);
    console.log(`   Keywords: ${status.keywords.active} activos, ${status.keywords.exhausted || 0} agotados`);
    
    if (status.needsExtraction) {
      const nextKeyword = await getNextKeyword(client, campaignId);
      if (nextKeyword) {
        console.log(`   📌 Próximo: "${nextKeyword.substring(0, 45)}..."`);
      }
    }
  }

  // Stats globales
  const globalStats = await client.query(`
    SELECT 
      COUNT(*) as total_leads,
      COUNT(DISTINCT source) as campaigns_with_leads
    FROM leads
  `);

  console.log('\n' + '─'.repeat(70));
  console.log('📈 ESTADÍSTICAS GLOBALES:');
  console.log(`   Total leads en base: ${globalStats.rows[0].total_leads}`);
  console.log(`   Leads pendientes (todas): ${totalPending}`);
  console.log('='.repeat(70));
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
    await initDatabase(client);
    await seedKeywords(client);

    switch (command) {
      case 'check':
      case 'status':
        await showFullStatus(client);
        break;

      case 'extract':
        if (!campaignArg) {
          console.log('❌ Uso: node smart-lead-manager-v2.cjs extract INDUSTRY');
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

      default:
        console.log(`
🧠 SMART LEAD MANAGER V2

  node smart-lead-manager-v2.cjs check              Ver estado
  node smart-lead-manager-v2.cjs extract CAMPAIGN   Extraer leads
  node smart-lead-manager-v2.cjs extract-all        Extraer todas

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
