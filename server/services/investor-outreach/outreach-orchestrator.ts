/**
 * Investor Outreach Orchestrator
 * Main service that coordinates lead collection, email sending, and follow-ups
 */

import { collectAllLeads, MUSIC_INDUSTRY_SEARCH_CONFIGS } from './apify-lead-scraper';
import { sendBatchEmails, sendInvestorEmail } from './email-sender';
import { 
  saveLeads, 
  getNewLeadsForOutreach, 
  getLeadsForFollowUp,
  getOutreachStats,
  createCampaign,
  updateCampaignStats 
} from './lead-database';
import { InvestorLead, OutreachConfig } from './types';

// ============================================
// CONFIGURATION
// ============================================
const DEFAULT_DAILY_CONFIG: OutreachConfig = {
  dailyEmailLimit: 100,
  sendingHoursStart: 9, // 9 AM UTC (adjust for target timezone)
  sendingHoursEnd: 17, // 5 PM UTC
  delayBetweenEmails: 30, // 30 seconds
  maxRetriesPerLead: 3,
  followUpDays: [3, 7], // Follow up after 3 and 7 days
};

// ============================================
// MAIN DAILY JOB
// ============================================
export async function runDailyInvestorOutreach(): Promise<{
  leadsCollected: number;
  emailsSent: number;
  followUpsSent: number;
  errors: string[];
}> {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 BOOSTIFY INVESTOR OUTREACH SYSTEM');
  console.log('='.repeat(60));
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log('');

  const results = {
    leadsCollected: 0,
    emailsSent: 0,
    followUpsSent: 0,
    errors: [] as string[],
  };

  try {
    // STEP 1: Collect new leads (if needed)
    console.log('\n📥 STEP 1: Checking for new leads...');
    const existingLeads = await getNewLeadsForOutreach(1);
    
    if (existingLeads.length < 50) {
      console.log('Lead pool low, collecting new leads from Apify...');
      
      const newLeads = await collectAllLeads();
      const { saved } = await saveLeads(newLeads);
      results.leadsCollected = saved;
      
      console.log(`✅ Collected and saved ${saved} new leads`);
    } else {
      console.log(`✅ Sufficient leads in pool (${existingLeads.length}+)`);
    }

    // STEP 2: Send initial outreach emails
    console.log('\n📧 STEP 2: Sending initial outreach emails...');
    const leadsToContact = await getNewLeadsForOutreach(DEFAULT_DAILY_CONFIG.dailyEmailLimit);
    
    if (leadsToContact.length > 0) {
      const { sent, failed } = await sendBatchEmails(leadsToContact, {
        dailyEmailLimit: Math.floor(DEFAULT_DAILY_CONFIG.dailyEmailLimit * 0.7), // 70% for new outreach
      });
      
      results.emailsSent = sent;
      
      if (failed > 0) {
        results.errors.push(`${failed} initial emails failed to send`);
      }
      
      console.log(`✅ Sent ${sent} initial outreach emails`);
    } else {
      console.log('⚠️ No new leads to contact');
    }

    // STEP 3: Send follow-up emails
    console.log('\n🔄 STEP 3: Sending follow-up emails...');
    
    for (const days of DEFAULT_DAILY_CONFIG.followUpDays) {
      const followUpLeads = await getLeadsForFollowUp(days);
      
      if (followUpLeads.length > 0) {
        console.log(`Sending ${days}-day follow-ups to ${followUpLeads.length} leads...`);
        
        const templateId = days === 3 ? 'follow_up_3d' : 'follow_up_7d';
        
        for (const lead of followUpLeads.slice(0, 15)) { // Max 15 follow-ups per type
          const result = await sendInvestorEmail(lead, templateId);
          if (result.success) {
            results.followUpsSent++;
          }
          
          // Short delay
          await sleep(10000);
        }
      }
    }
    
    console.log(`✅ Sent ${results.followUpsSent} follow-up emails`);

    // STEP 4: Generate report
    console.log('\n📊 STEP 4: Generating daily report...');
    const stats = await getOutreachStats();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 DAILY OUTREACH REPORT');
    console.log('='.repeat(60));
    console.log(`📋 Total Leads in Database: ${stats.totalLeads}`);
    console.log(`📧 Total Emails Sent (All Time): ${stats.totalEmailsSent}`);
    console.log('');
    console.log('Lead Status Breakdown:');
    Object.entries(stats.byStatus).forEach(([status, count]) => {
      const emoji = getStatusEmoji(status);
      console.log(`  ${emoji} ${status}: ${count}`);
    });
    console.log('');
    console.log(`📈 Response Rate: ${stats.responseRate.toFixed(2)}%`);
    console.log(`💰 Conversion Rate: ${stats.conversionRate.toFixed(2)}%`);
    console.log('='.repeat(60));

  } catch (error: any) {
    console.error('\n❌ OUTREACH ERROR:', error.message);
    results.errors.push(error.message);
  }

  return results;
}

// ============================================
// TARGETED CAMPAIGN
// ============================================
export async function runTargetedCampaign(
  campaignName: string,
  investorType: 'vc_fund' | 'record_label' | 'angel_investor' | 'music_tech_investor' | 'industry_consultant',
  maxLeads: number = 100
): Promise<{ campaignId: string; leadsSaved: number; emailsSent: number }> {
  console.log(`\n🎯 Starting targeted campaign: ${campaignName}`);
  console.log(`Target: ${investorType}, Max leads: ${maxLeads}`);

  // Get appropriate search config
  const searchConfig = MUSIC_INDUSTRY_SEARCH_CONFIGS.find(c => 
    c.keywords.some(k => k.toLowerCase().includes(investorType.replace('_', ' ')))
  ) || MUSIC_INDUSTRY_SEARCH_CONFIGS[0];

  // Create campaign
  const campaignId = await createCampaign(campaignName, {
    keywords: searchConfig.keywords,
    locations: ['United States', 'United Kingdom', 'Los Angeles', 'New York', 'Nashville', 'Miami'],
    industries: ['Music', 'Entertainment', 'Venture Capital'],
    titles: searchConfig.titles,
    maxResults: maxLeads,
  });

  // Collect leads
  const leads = await collectAllLeads();
  const filteredLeads = leads.filter(l => l.investorType === investorType);
  
  const { saved } = await saveLeads(filteredLeads);
  
  // Send initial batch to full leads (not filtered which could be empty)
  const leadsToSend = leads.slice(0, 50) as InvestorLead[];
  const { sent } = await sendBatchEmails(leadsToSend);
  
  // Update campaign stats
  await updateCampaignStats(campaignId, saved, sent);

  console.log(`✅ Campaign ${campaignName} started: ${saved} leads, ${sent} emails sent`);
  
  return { campaignId, leadsSaved: saved, emailsSent: sent };
}

// ============================================
// QUICK OUTREACH (Single batch)
// ============================================
export async function quickOutreach(
  numEmails: number = 25,
  force: boolean = false
): Promise<{ sent: number; failed: number }> {
  console.log(`\n⚡ Quick outreach: sending ${numEmails} emails...`);
  
  const leads = await getNewLeadsForOutreach(numEmails);
  
  if (leads.length === 0) {
    console.log('❌ No leads available. Collecting new leads first...');
    const newLeads = await collectAllLeads();
    await saveLeads(newLeads);
    return quickOutreach(numEmails, force);
  }
  
  const { sent, failed } = await sendBatchEmails(leads, { dailyEmailLimit: numEmails, force });
  
  return { sent, failed };
}

// ============================================
// COLLECT LEADS ONLY (No sending)
// ============================================
export async function collectAndSaveLeads(
  _maxLeads: number = 500
): Promise<{ collected: number; saved: number; duplicates: number }> {
  console.log(`\n📥 Collecting leads...`);
  
  const leads = await collectAllLeads();
  console.log(`Found ${leads.length} leads from Apify`);
  
  const { saved, duplicates } = await saveLeads(leads);
  
  return { collected: leads.length, saved, duplicates };
}

// ============================================
// HELPERS
// ============================================
function getStatusEmoji(status: string): string {
  const emojis: Record<string, string> = {
    new: '🆕',
    contacted: '📧',
    responded: '💬',
    converted: '💰',
    bounced: '🔴',
    unsubscribed: '🚫',
  };
  return emojis[status] || '❓';
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// EXPORTS
// ============================================
export default {
  runDailyInvestorOutreach,
  runTargetedCampaign,
  quickOutreach,
  collectAndSaveLeads,
  getOutreachStats,
};
