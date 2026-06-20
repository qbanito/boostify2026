/**
 * Investor Outreach Module Index
 * Central export for all outreach services
 */

// Types
export * from './types';

// Services
export { default as leadScraper, collectAllLeads, getSampleLeads, parseCSVLeads, MUSIC_INDUSTRY_SEARCH_CONFIGS } from './apify-lead-scraper';
export { default as emailTemplates, generatePersonalizedEmail, selectBestTemplate } from './email-templates';
export { default as emailSender, sendInvestorEmail, sendBatchEmails, runDailyOutreach } from './email-sender';
export { default as leadDatabase, saveLeads, getNewLeadsForOutreach, getOutreachStats } from './lead-database';
export { 
  default as outreachOrchestrator,
  runDailyInvestorOutreach, 
  runTargetedCampaign, 
  quickOutreach, 
  collectAndSaveLeads 
} from './outreach-orchestrator';
