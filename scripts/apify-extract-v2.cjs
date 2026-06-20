/**
 * 🔄 APIFY EXTRACTOR - Multi-Campaign Version
 * Extrae leads de Apify y los guarda en Supabase
 * 
 * Uso:
 *   node apify-extract-v2.cjs INDUSTRY
 *   node apify-extract-v2.cjs ARTISTS_1
 *   node apify-extract-v2.cjs ARTISTS_2
 *   node apify-extract-v2.cjs ARTISTS_3
 *   node apify-extract-v2.cjs ARTISTS_4
 */

const { Pool } = require('pg');
const { ApifyClient } = require('apify-client');
const loadCampaign = require('./campaigns/campaign-loader.cjs');

// Obtener campaña desde argumentos
const campaignArg = process.argv[2] || 'ARTISTS_1';
const config = loadCampaign(campaignArg);

// Verificar que tenga API de Apify
if (!config.apis.apify) {
  console.error(`\n❌ La campaña ${config.name} no tiene API de Apify configurada`);
  process.exit(1);
}

// Conexiones
const pool = new Pool({
  connectionString: config.supabase.connectionString,
  ssl: { rejectUnauthorized: false }
});

const apifyClient = new ApifyClient({
  token: config.apis.apify
});

async function extractLeads() {
  console.log('='.repeat(60));
  console.log(`🔄 APIFY EXTRACTOR - ${config.name}`);
  console.log('='.repeat(60));
  console.log(`\n📋 Búsqueda: "${config.search.keywords}"`);
  console.log(`🌍 País: ${config.search.country}`);
  console.log(`📊 Máximo: ${config.search.maxResults} leads`);
  console.log('─'.repeat(60));

  const client = await pool.connect();

  try {
    // 1. Ejecutar Apify actor
    console.log('\n🚀 Ejecutando Apify actor...');
    console.log(`   Actor: ${config.apis.apifyActor}`);
    
    const run = await apifyClient.actor(config.apis.apifyActor).call({
      query: config.search.keywords,
      country: config.search.country,
      maxResults: config.search.maxResults
    });

    console.log(`   ✅ Completado (Run ID: ${run.id})`);

    // 2. Obtener resultados
    console.log('\n📥 Obteniendo resultados...');
    const { items } = await apifyClient.dataset(run.defaultDatasetId).listItems();
    console.log(`   ✅ ${items.length} leads extraídos`);

    if (items.length === 0) {
      console.log('\n⚠️  No se encontraron leads');
      return;
    }

    // 3. Insertar en Supabase
    console.log('\n📦 Guardando en Supabase...');
    
    let inserted = 0;
    let duplicates = 0;
    let errors = 0;

    for (const item of items) {
      const email = item.email || item.personal_email;
      if (!email) {
        errors++;
        continue;
      }

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
          item.country || config.search.country,
          item.linkedin || null,
          item.keywords || null,
          config.id  // Guardar de qué campaña vino
        ]);

        if (result.rows.length > 0) {
          await client.query(`
            INSERT INTO lead_status (lead_id, status, warmup_stage)
            VALUES ($1, 'new', 0)
          `, [result.rows[0].id]);
          
          inserted++;
          console.log(`   ✅ ${item.first_name || email} - ${item.company_name || 'N/A'}`);
        } else {
          duplicates++;
        }
      } catch (err) {
        errors++;
        console.log(`   ❌ ${email}: ${err.message}`);
      }
    }

    // Resumen
    console.log('\n' + '='.repeat(60));
    console.log(`📊 RESUMEN - ${config.name}`);
    console.log('='.repeat(60));
    console.log(`   ✅ Nuevos: ${inserted}`);
    console.log(`   ⏭️  Duplicados: ${duplicates}`);
    console.log(`   ❌ Errores: ${errors}`);
    console.log(`   📦 Total: ${items.length}`);

    // Stats globales
    const stats = await client.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE source = $1) as campaign_leads
      FROM leads
    `, [config.id]);
    
    console.log(`\n📈 EN SUPABASE:`);
    console.log(`   • Total leads: ${stats.rows[0].total}`);
    console.log(`   • Leads de ${config.name}: ${stats.rows[0].campaign_leads}`);

  } catch (error) {
    console.error('\n❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

extractLeads();
