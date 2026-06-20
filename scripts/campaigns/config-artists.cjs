/**
 * 🎤 CAMPAIGN CONFIG: ARTISTS
 * Dominio: boostifymusic.site
 * Target: Artistas específicos (secuencia 10 emails HTML)
 * Status: EN DESARROLLO
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificación
  name: 'ARTISTS',
  domain: 'boostifymusic.site',
  
  // Email
  fromEmail: 'info@boostifymusic.site',
  fromName: 'Alex from Boostify',
  alternativeEmails: {
    artists: 'artists@boostifymusic.site',
    carlos: 'carlos@boostifymusic.site'
  },
  
  // APIs (desde variables de entorno)
  apis: {
    apify: secrets.apify.ARTISTS_1,
    apifyActor: 'code_crafter/leads-finder',
    resend: secrets.resend.ARTISTS_1,
    openai: secrets.openai
  },
  
  // Supabase
  supabase: {
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  },
  
  // Configuración de búsqueda
  search: {
    keywords: 'music artist, singer, rapper, musician, producer, DJ',
    country: 'United States',
    maxResults: 50
  },
  
  // Warmup config
  warmup: {
    dailyLimit: 20,
    warmupEmails: 3,
    daysBetweenEmails: 2
  },
  
  // Secuencia de 10 emails HTML
  sequence: {
    totalEmails: 10,
    templates: [
      'email1-intro.html',
      'email2-value.html',
      'email3-social-proof.html',
      'email4-urgency.html',
      'email5-benefits.html',
      'email6-testimonials.html',
      'email7-analytics.html',
      'email8-premium.html',
      'email9-community.html',
      'email10-farewell.html'
    ]
  },
  
  // GitHub
  github: {
    account: 'convoycubano1',
    repo: 'boostify-artists' // ajustar nombre real
  }
};
