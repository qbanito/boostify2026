/**
 * CAMPAIGN: MUSIC INDUSTRY
 * Dominio: boostifymusic.com
 * Target: Industry professionals (managers, A&R, labels, venues)
 * Limit: 100 emails/dia (cuando este calentado)
 * Using Brevo for info@boostifymusic.com
 */

const secrets = require('./secrets.cjs');

module.exports = {
  // Identificacion
  id: 'INDUSTRY',
  name: 'MUSIC INDUSTRY',
  domain: 'boostifymusic.com',
  
  // Email (using Brevo)
  fromEmail: 'info@boostifymusic.com',
  fromName: 'Alex from Boostify',
  emailProvider: 'brevo',
  
  // APIs (desde variables de entorno)
  apis: {
    apify: secrets.apify.INDUSTRY,
    apifyActor: 'code_crafter/leads-finder',
    brevo: secrets.brevo?.INDUSTRY || process.env.BREVO_API_KEY,
    openai: secrets.openai
  },
  
  // Supabase
  supabase: {
    connectionString: secrets.supabase
  },
  
  // Keywords para extraccion de leads
  search: {
    keywords: 'music manager, A&R director, record label, talent buyer, music venue, booking agent, music publisher, entertainment lawyer',
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
