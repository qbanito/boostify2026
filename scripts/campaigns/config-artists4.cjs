/**
 * 🎤 CAMPAIGN: ARTISTS_4
 * Dominio: boostifymusic.online
 * Target: Artistas Electrónica/Productores
 * Limit: 100 emails/día (cuando esté calentado)
 * NOTE: No tiene API de Apify asignada aún
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificación
  id: 'ARTISTS_4',
  name: 'ARTISTS 4',
  domain: 'boostifymusic.online',
  
  // Email
  fromEmail: 'info@boostifymusic.online',
  fromName: 'Alex from Boostify',
  resendEmail: 'vwiajcsytrosywcyey@fxavaj.com',
  
  // APIs (desde variables de entorno)
  apis: {
    apify: secrets.apify.ARTISTS_4,
    apifyActor: 'code_crafter/leads-finder',
    resend: secrets.resend.ARTISTS_4,
    openai: secrets.openai
  },
  
  // Supabase
  supabase: {
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  },
  
  // Keywords para extracción - ELECTRONICA/DJ/PRODUCERS
  search: {
    keywords: 'EDM artist, DJ producer, electronic music artist, music producer, beat maker, electronic producer',
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
