/**
 * 🎵 BOOSTIFY MUSIC - Automated Intelligent Outreach System
 * 
 * This script runs automatically via GitHub Actions and:
 * 1. Checks if there are enough leads in the database
 * 2. Automatically scrapes new leads from Apify if needed
 * 3. Sends personalized outreach emails
 * 4. Generates a report for tracking
 * 
 * Usage:
 *   npx tsx scripts/automated-outreach.ts                    # Default: 50 emails
 *   npx tsx scripts/automated-outreach.ts --max 100          # Custom limit
 *   npx tsx scripts/automated-outreach.ts --dry-run          # Preview mode
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { 
  saveLeads, 
  getOutreachStats, 
  getNewLeadsForOutreach 
} from '../server/services/investor-outreach/lead-database';
import { quickOutreach } from '../server/services/investor-outreach/outreach-orchestrator';
import { InvestorLead } from '../server/services/investor-outreach/types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';

// Configuration
const APIFY_API_KEY = process.env.APIFY_API_KEY || '';
const DATASET_ID = 'ebsl5vr8G0Y7lDBEV';
const LEAD_SCRAPER_ACTOR = 'pipelinelabs/lead-scraper-apollo-zoominfo-lusha-ppe';
const MIN_LEADS_THRESHOLD = 100; // Minimum leads before triggering new scrape

// Parse arguments
const args = process.argv.slice(2);
const maxEmails = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1]) : 50;
const dryRun = args.includes('--dry-run');

interface OutreachReport {
  timestamp: string;
  stats: {
    totalLeads: number;
    availableLeads: number;
    emailsSent: number;
    emailsFailed: number;
    newLeadsScraped: number;
  };
  actions: string[];
  errors: string[];
}

const report: OutreachReport = {
  timestamp: new Date().toISOString(),
  stats: {
    totalLeads: 0,
    availableLeads: 0,
    emailsSent: 0,
    emailsFailed: 0,
    newLeadsScraped: 0,
  },
  actions: [],
  errors: [],
};

function log(message: string) {
  console.log(message);
  report.actions.push(`${new Date().toISOString()}: ${message}`);
}

function logError(message: string) {
  console.error(`❌ ${message}`);
  report.errors.push(`${new Date().toISOString()}: ${message}`);
}

// ============================================
// LEAD SCRAPING FROM APIFY
// ============================================
async function fetchLeadsFromApify(): Promise<Partial<InvestorLead>[]> {
  if (!APIFY_API_KEY) {
    logError('APIFY_API_KEY not configured');
    return [];
  }

  const client = new ApifyClient({ token: APIFY_API_KEY });
  
  try {
    log(`📥 Fetching leads from Apify dataset: ${DATASET_ID}`);
    const { items } = await client.dataset(DATASET_ID).listItems();
    log(`✅ Found ${items.length} leads in Apify dataset`);
    
    return items.map((item: any) => mapApifyLead(item));
  } catch (error: any) {
    logError(`Failed to fetch from Apify: ${error.message}`);
    return [];
  }
}

async function scrapeNewLeads(searchQueries: string[]): Promise<Partial<InvestorLead>[]> {
  if (!APIFY_API_KEY) {
    logError('APIFY_API_KEY not configured for scraping');
    return [];
  }

  const client = new ApifyClient({ token: APIFY_API_KEY });
  const allLeads: Partial<InvestorLead>[] = [];
  
  for (const query of searchQueries) {
    try {
      log(`🔍 Scraping leads for: ${query}`);
      
      const run = await client.actor(LEAD_SCRAPER_ACTOR).call({
        searchQuery: query,
        maxResults: 50,
      }, {
        timeoutSecs: 300,
      });
      
      const { items } = await client.dataset(run.defaultDatasetId).listItems();
      log(`   Found ${items.length} leads`);
      
      allLeads.push(...items.map((item: any) => mapApifyLead(item)));
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      logError(`Scraping failed for "${query}": ${error.message}`);
    }
  }
  
  return allLeads;
}

function mapApifyLead(item: any): Partial<InvestorLead> {
  const firstName = item.firstName || item.first_name || item.name?.split(' ')[0] || '';
  const lastName = item.lastName || item.last_name || item.name?.split(' ').slice(1).join(' ') || '';
  const email = item.email || item.emailAddress || item.work_email || item.personal_email || '';
  const company = item.company || item.companyName || item.orgName || item.organization || '';
  const title = item.title || item.jobTitle || item.position || item.headline || '';
  const industry = parseIndustry(item.orgIndustry || item.industry);
  const investorType = determineInvestorType(item);
  
  const lead: Partial<InvestorLead> = {
    id: uuidv4(),
    email: email.toLowerCase().trim(),
    firstName,
    lastName,
    fullName: item.fullName || `${firstName} ${lastName}`.trim() || item.name || '',
    company,
    title,
    linkedInUrl: item.linkedinUrl || item.linkedin_url || '',
    industry,
    location: `${item.city || ''}, ${item.country || ''}`.replace(/^,\s*/, '').replace(/,\s*$/, ''),
    source: 'apify',
    sourceUrl: item.linkedinUrl || '',
    createdAt: new Date(),
    emailsSent: 0,
    status: 'new',
    personalizedData: {
      recentNews: item.orgDescription || '',
      seniority: item.seniority || '',
    },
  };
  
  if (investorType) {
    lead.investorType = investorType;
  }
  
  return lead;
}

function parseIndustry(industryStr: string | undefined): string {
  if (!industryStr) return '';
  const match = industryStr.match(/\['([^']+)'/);
  if (match) return match[1].replace(/_/g, ' ');
  return industryStr;
}

function determineInvestorType(item: any): InvestorLead['investorType'] | undefined {
  const position = (item.position || item.title || '').toLowerCase();
  const industry = (item.orgIndustry || item.industry || '').toLowerCase();
  const company = (item.orgName || item.company || '').toLowerCase();
  
  if (industry.includes('venture') || industry.includes('investment') || 
      company.includes('capital') || company.includes('ventures') ||
      position.includes('partner') || position.includes('investor')) {
    return 'vc_fund';
  }
  if (industry.includes('music') || industry.includes('entertainment') ||
      company.includes('records') || company.includes('music') ||
      position.includes('a&r')) {
    return 'record_label';
  }
  if (position.includes('angel') || position.includes('founder')) {
    return 'angel_investor';
  }
  if (position.includes('consultant') || position.includes('advisor')) {
    return 'industry_consultant';
  }
  if (item.seniority === 'c_suite' || item.seniority === 'vp') {
    return 'vc_fund';
  }
  return undefined;
}

// ============================================
// MAIN AUTOMATION LOGIC
// ============================================
async function runAutomatedOutreach() {
  console.log('\n' + '═'.repeat(60));
  console.log('🎵 BOOSTIFY MUSIC - AUTOMATED OUTREACH SYSTEM');
  console.log('═'.repeat(60));
  console.log(`📅 ${new Date().toLocaleString()}`);
  console.log(`📧 Max emails: ${maxEmails}`);
  console.log(`🔍 Dry run: ${dryRun}`);
  console.log('═'.repeat(60) + '\n');

  try {
    // Step 1: Check current lead stats
    log('📊 Checking current lead statistics...');
    const stats = await getOutreachStats();
    report.stats.totalLeads = stats.totalLeads;
    
    log(`   Total leads: ${stats.totalLeads}`);
    log(`   Leads not yet contacted: ${stats.leadsNotYetContacted || 0}`);
    
    // Step 2: Get available leads for outreach
    const availableLeads = await getNewLeadsForOutreach(maxEmails);
    report.stats.availableLeads = availableLeads.length;
    log(`   Available for outreach: ${availableLeads.length}`);
    
    // Step 3: Check if we need more leads
    if (availableLeads.length < MIN_LEADS_THRESHOLD) {
      log(`\n⚠️ Low lead count (${availableLeads.length} < ${MIN_LEADS_THRESHOLD})`);
      log('🔄 Triggering automatic lead import...');
      
      // First, try to import from existing dataset
      const datasetLeads = await fetchLeadsFromApify();
      
      if (datasetLeads.length > 0) {
        const validLeads = datasetLeads.filter(l => l.email);
        log(`📥 Importing ${validLeads.length} leads from Apify dataset...`);
        
        if (!dryRun) {
          const result = await saveLeads(validLeads);
          report.stats.newLeadsScraped = result.saved;
          log(`✅ Imported ${result.saved} new leads (${result.duplicates} duplicates skipped)`);
        } else {
          log(`[DRY RUN] Would import ${validLeads.length} leads`);
        }
      }
      
      // If still not enough, scrape new leads
      const updatedLeads = await getNewLeadsForOutreach(maxEmails);
      if (updatedLeads.length < MIN_LEADS_THRESHOLD && !dryRun) {
        log('\n🔍 Scraping new leads from search queries...');
        
        const searchQueries = [
          'music tech investor',
          'entertainment VC partner',
          'record label executive',
          'music startup investor',
          'angel investor entertainment',
        ];
        
        const newLeads = await scrapeNewLeads(searchQueries);
        const validNewLeads = newLeads.filter(l => l.email);
        
        if (validNewLeads.length > 0) {
          const result = await saveLeads(validNewLeads);
          report.stats.newLeadsScraped += result.saved;
          log(`✅ Scraped and saved ${result.saved} new leads`);
        }
      }
    }
    
    // Step 4: Send outreach emails
    log('\n📧 Starting email outreach...');
    
    if (dryRun) {
      log('[DRY RUN] Would send emails to:');
      const leadsToContact = await getNewLeadsForOutreach(maxEmails);
      for (const lead of leadsToContact.slice(0, 5)) {
        log(`   • ${lead.fullName} (${lead.email}) - ${lead.title} at ${lead.company}`);
      }
      if (leadsToContact.length > 5) {
        log(`   ... and ${leadsToContact.length - 5} more`);
      }
      report.stats.emailsSent = 0;
    } else {
      const result = await quickOutreach({
        maxEmails,
        force: true, // Bypass time restrictions for automation
      });
      
      report.stats.emailsSent = result.sent;
      report.stats.emailsFailed = result.failed;
      
      log(`\n✅ Outreach complete: ${result.sent} sent, ${result.failed} failed`);
    }
    
    // Step 5: Generate final report
    console.log('\n' + '═'.repeat(60));
    console.log('📊 OUTREACH REPORT');
    console.log('═'.repeat(60));
    console.log(`📋 Total Leads in Database: ${report.stats.totalLeads}`);
    console.log(`📬 Emails Sent: ${report.stats.emailsSent}`);
    console.log(`❌ Emails Failed: ${report.stats.emailsFailed}`);
    console.log(`🆕 New Leads Scraped: ${report.stats.newLeadsScraped}`);
    console.log('═'.repeat(60) + '\n');
    
    // Save report to file for GitHub Actions artifact
    fs.writeFileSync('outreach-report.json', JSON.stringify(report, null, 2));
    log('📄 Report saved to outreach-report.json');
    
    if (report.errors.length > 0) {
      console.log('\n⚠️ Errors encountered:');
      for (const error of report.errors) {
        console.log(`   ${error}`);
      }
    }
    
    console.log('\n✅ Automated outreach completed successfully!\n');
    
  } catch (error: any) {
    logError(`Critical error: ${error.message}`);
    console.error(error);
    
    // Save report even on error
    fs.writeFileSync('outreach-report.json', JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

// Run
runAutomatedOutreach().catch(console.error);
