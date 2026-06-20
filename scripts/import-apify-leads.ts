/**
 * Import Leads from Apify Dataset to Firestore
 * 
 * This script imports leads from your Apify dataset (ebsl5vr8G0Y7lDBEV)
 * into the Firestore database for outreach
 * 
 * Usage:
 *   npx tsx scripts/import-apify-leads.ts             # Import all leads
 *   npx tsx scripts/import-apify-leads.ts --max 100   # Import max 100 leads
 *   npx tsx scripts/import-apify-leads.ts --dry-run   # Preview without importing
 */

import 'dotenv/config';
import { ApifyClient } from 'apify-client';
import { saveLeads, getOutreachStats } from '../server/services/investor-outreach/lead-database';
import { InvestorLead } from '../server/services/investor-outreach/types';
import { v4 as uuidv4 } from 'uuid';

const APIFY_API_KEY = process.env.APIFY_API_KEY || 'apify_api_nrudThRO1hQ9XCTFzUZkRI0VKCcSkv2h3mYq';
const DATASET_ID = 'ebsl5vr8G0Y7lDBEV';

// Parse command line arguments
const args = process.argv.slice(2);
const maxLeads = args.includes('--max') ? parseInt(args[args.indexOf('--max') + 1]) : undefined;
const dryRun = args.includes('--dry-run');

async function importLeadsFromApify() {
  console.log('🚀 Importing leads from Apify dataset...\n');
  
  const client = new ApifyClient({ token: APIFY_API_KEY });
  
  try {
    // Fetch leads from dataset
    console.log(`📥 Fetching leads from dataset: ${DATASET_ID}`);
    const { items } = await client.dataset(DATASET_ID).listItems();
    console.log(`✅ Found ${items.length} leads in Apify dataset\n`);
    
    if (items.length === 0) {
      console.log('❌ No leads found in dataset');
      return;
    }
    
    // Get current stats
    const statsBefore = await getOutreachStats();
    console.log(`📊 Current leads in Firestore: ${statsBefore.totalLeads}`);
    
    // Limit leads if specified
    const leadsToProcess = maxLeads ? items.slice(0, maxLeads) : items;
    console.log(`📋 Processing ${leadsToProcess.length} leads${maxLeads ? ` (limited to ${maxLeads})` : ''}...\n`);
    
    // Map all leads
    const mappedLeads: Partial<InvestorLead>[] = [];
    let skippedNoEmail = 0;
    
    for (const item of leadsToProcess as any[]) {
      // Skip leads without email
      if (!item.email) {
        skippedNoEmail++;
        continue;
      }
      
      const email = item.email.toLowerCase().trim();
      const investorType = determineInvestorType(item);
      
      // Map Apify lead to our format - avoid undefined values for Firestore
      const lead: Partial<InvestorLead> = {
        id: uuidv4(),
        email,
        firstName: item.firstName || '',
        lastName: item.lastName || '',
        fullName: item.fullName || `${item.firstName || ''} ${item.lastName || ''}`.trim(),
        company: item.orgName || item.company || '',
        title: item.position || item.title || '',
        linkedInUrl: item.linkedinUrl || '',
        industry: parseIndustry(item.orgIndustry),
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
      
      // Only add investorType if it's defined
      if (investorType) {
        lead.investorType = investorType;
      }
      
      mappedLeads.push(lead);
    }
    
    console.log(`📧 Valid leads with email: ${mappedLeads.length}`);
    console.log(`⏭️  Skipped (no email): ${skippedNoEmail}\n`);
    
    if (dryRun) {
      console.log('🔍 DRY RUN - Sample leads that would be imported:\n');
      for (const lead of mappedLeads.slice(0, 5)) {
        console.log(`   • ${lead.fullName} (${lead.email})`);
        console.log(`     ${lead.title} at ${lead.company}`);
        console.log(`     Industry: ${lead.industry}, Type: ${lead.investorType || 'unclassified'}\n`);
      }
      if (mappedLeads.length > 5) {
        console.log(`   ... and ${mappedLeads.length - 5} more leads\n`);
      }
      console.log('⚠️  This was a dry run. No leads were actually imported.');
      console.log('   Remove --dry-run to import for real.');
      return;
    }
    
    // Save leads in batches
    console.log('💾 Saving leads to Firestore...');
    const result = await saveLeads(mappedLeads);
    
    console.log('\n' + '='.repeat(50));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(50));
    console.log(`✅ Saved: ${result.saved}`);
    console.log(`⏭️  Duplicates: ${result.duplicates}`);
    console.log(`⏭️  No email: ${skippedNoEmail}`);
    
    const statsAfter = await getOutreachStats();
    console.log(`\n📈 Total leads in database: ${statsAfter.totalLeads}`);
    console.log(`   - New (ready for outreach): ${statsAfter.leadsNotYetContacted}`);
    console.log(`   - Contacted: ${statsAfter.totalLeads - statsAfter.leadsNotYetContacted}`);
    
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Parse industry from Apify format (e.g., "['investment management']")
function parseIndustry(industryStr: string | undefined): string {
  if (!industryStr) return '';
  try {
    // Handle array-like string: "['industry1', 'industry2']"
    const match = industryStr.match(/\['([^']+)'/);
    if (match) return match[1].replace(/_/g, ' ');
    return industryStr;
  } catch {
    return industryStr;
  }
}

// Determine investor type based on lead data
function determineInvestorType(item: any): InvestorLead['investorType'] {
  const position = (item.position || '').toLowerCase();
  const industry = (item.orgIndustry || '').toLowerCase();
  const company = (item.orgName || '').toLowerCase();
  
  // Check for VC indicators
  if (industry.includes('venture') || industry.includes('investment') || 
      company.includes('capital') || company.includes('ventures') ||
      position.includes('partner') || position.includes('investor')) {
    return 'vc_fund';
  }
  
  // Check for record label indicators
  if (industry.includes('music') || industry.includes('entertainment') ||
      company.includes('records') || company.includes('music') ||
      position.includes('a&r')) {
    return 'record_label';
  }
  
  // Check for angel investor indicators
  if (position.includes('angel') || position.includes('founder') ||
      industry.includes('angel')) {
    return 'angel_investor';
  }
  
  // Check for consultant indicators
  if (position.includes('consultant') || position.includes('advisor')) {
    return 'industry_consultant';
  }
  
  // Default based on seniority
  if (item.seniority === 'c_suite' || item.seniority === 'vp') {
    return 'vc_fund'; // C-suite executives often invest
  }
  
  return undefined;
}

// Run
importLeadsFromApify().catch(console.error);
