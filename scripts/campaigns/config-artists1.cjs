/**
 * 🎤 CAMPAIGN: ARTISTS_1
 * Dominio: boostifymusic.site
 * Target: Artistas independientes
 * Limit: 100 emails/día (cuando esté calentado)
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificación
  id: 'ARTISTS_1',
  name: 'ARTISTS 1',
  domain: 'boostifymusic.site',
  
  // Email
  fromEmail: 'info@boostifymusic.site',
  fromName: 'Alex from Boostify',
  resendEmail: 'rzofbevpsjqcakdzus@nespj.com',
  
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
  
  // Keywords para extracción - ARTISTAS INDIE
  search: {
    keywords: 'independent artist, indie musician, singer songwriter, upcoming artist, new artist, emerging artist',
    country: 'United States',
    maxResults: 100
  },
  
  // Warmup schedule
  warmup: {
    currentLimit: 20,
    targetLimit: 100,
    warmupEmails: 3,
    daysBetweenEmails: 2
  },
  
  // GitHub
  github: {
    account: 'convoycubano1'
  }
};
