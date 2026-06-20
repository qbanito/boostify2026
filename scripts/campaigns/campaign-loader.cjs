/**
 * 🔧 CAMPAIGN LOADER - Carga la configuración de cualquier campaña
 * 
 * Uso: 
 *   const config = require('./campaign-loader')('ARTISTS_1');
 *   const config = require('./campaign-loader')('INDUSTRY');
 * 
 * Campañas disponibles:
 *   - INDUSTRY    (boostifymusic.com)   - Music Industry
 *   - ARTISTS_1   (boostifymusic.site)  - Artistas Indie
 *   - ARTISTS_2   (boostifymusic.space) - Artistas Rap/HipHop
 *   - ARTISTS_3   (boostifymusic.sbs)   - Artistas R&B/Pop
 *   - ARTISTS_4   (boostifymusic.online)- Artistas EDM/Producers
 */

const industryConfig = require('./config-industry.cjs');
const artists1Config = require('./config-artists1.cjs');
const artists2Config = require('./config-artists2.cjs');
const artists3Config = require('./config-artists3.cjs');
const artists4Config = require('./config-artists4.cjs');

const campaigns = {
  'INDUSTRY': industryConfig,
  'MUSIC_INDUSTRY': industryConfig,
  'ARTISTS_1': artists1Config,
  'ARTISTS1': artists1Config,
  'ARTISTS_2': artists2Config,
  'ARTISTS2': artists2Config,
  'ARTISTS_3': artists3Config,
  'ARTISTS3': artists3Config,
  'ARTISTS_4': artists4Config,
  'ARTISTS4': artists4Config,
};

// Lista todas las campañas
const allCampaigns = [
  industryConfig,
  artists1Config,
  artists2Config,
  artists3Config,
  artists4Config
];

function loadCampaign(campaignName) {
  const name = campaignName?.toUpperCase() || 'ARTISTS_1';
  const config = campaigns[name];
  
  if (!config) {
    console.error(`\n❌ Campaña "${campaignName}" no encontrada`);
    console.log('\n📋 Campañas disponibles:');
    allCampaigns.forEach(c => {
      console.log(`   • ${c.id.padEnd(12)} → ${c.domain} (${c.name})`);
    });
    process.exit(1);
  }
  
  console.log(`\n🎯 Campaña: ${config.name}`);
  console.log(`   📧 Email: ${config.fromEmail}`);
  console.log(`   🌐 Dominio: ${config.domain}`);
  console.log(`   📊 Límite: ${config.warmup.currentLimit}/${config.warmup.targetLimit} emails/día\n`);
  
  return config;
}

// Exportar también la lista completa
loadCampaign.all = allCampaigns;
loadCampaign.list = () => {
  console.log('\n📋 TODAS LAS CAMPAÑAS:');
  console.log('─'.repeat(60));
  allCampaigns.forEach((c, i) => {
    const status = c.apis.apify ? '✅' : '⚠️ (sin Apify)';
    console.log(`${i+1}. ${c.id.padEnd(12)} │ ${c.domain.padEnd(22)} │ ${status}`);
  });
  console.log('─'.repeat(60));
  console.log(`Total: ${allCampaigns.length} campañas = ${allCampaigns.length * 100} emails/día potencial\n`);
};

module.exports = loadCampaign;
