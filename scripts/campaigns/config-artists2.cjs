/**
 * 🎤 CAMPAIGN: ARTISTS_2
 * Dominio: boostifymusic.space
 * Target: Artistas Hip-Hop/Rap
 * Limit: 100 emails/día (cuando esté calentado)
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificación
  id: 'ARTISTS_2',
  name: 'ARTISTS 2',
  domain: 'boostifymusic.space',
  
  // Email
  fromEmail: 'info@boostifymusic.space',
  fromName: 'Alex from Boostify',
  resendEmail: 'ghzdolcziurypohkss@nespj.com',
  
  // APIs (desde variables de entorno)
  apis: {
    apify: secrets.apify.ARTISTS_2,
    apifyActor: 'code_crafter/leads-finder',
    resend: secrets.resend.ARTISTS_2,
    openai: secrets.openai
  },
  
  // Supabase
  supabase: {
    connectionString: 'postgresql://postgres.twlflkphpowpvjvoyrae:Metafeed2024%40@aws-0-us-west-2.pooler.supabase.com:6543/postgres'
  },
  
  // Keywords para extracción - RAP/HIPHOP
  search: {
    keywords: 'rapper, hip hop artist, rap artist, trap artist, urban artist, hip hop producer',
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
