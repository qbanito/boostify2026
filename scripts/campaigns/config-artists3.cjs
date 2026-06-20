/**
 * 🎤 CAMPAIGN: ARTISTS_3
 * Dominio: boostifymusic.sbs
 * Target: Artistas R&B/Pop
 * Limit: 100 emails/día (cuando esté calentado)
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificación
  id: 'ARTISTS_3',
  name: 'ARTISTS 3',
  domain: 'boostifymusic.sbs',
  
  // Email
  fromEmail: 'info@boostifymusic.sbs',
  fromName: 'Alex from Boostify',
  resendEmail: 'fqmooshywiozsxhyvl@fxavaj.com',
  
  // APIs (desde variables de entorno)
  apis: {
    apify: secrets.apify.ARTISTS_3,
    apifyActor: 'code_crafter/leads-finder',
    resend: secrets.resend.ARTISTS_3,
    openai: secrets.openai
  },
  
  // Supabase
  supabase: {
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  },
  
  // Keywords para extracción - R&B/POP
  search: {
    keywords: 'R&B artist, pop artist, soul singer, pop singer, R&B singer, vocal artist',
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
