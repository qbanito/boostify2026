#!/usr/bin/env node
/**
 * Daily Investor Outreach Script
 * Runs automatically via GitHub Actions to send 100 personalized emails daily
 * 
 * Usage:
 *   npm run outreach:daily     - Full daily run (collect + send + follow-ups)
 *   npm run outreach:quick     - Quick batch of 25 emails
 *   npm run outreach:collect   - Collect leads only (no sending)
 *   npm run outreach:stats     - Show current statistics
 */

import 'dotenv/config';
import { 
  runDailyInvestorOutreach,
  quickOutreach,
  collectAndSaveLeads,
  getOutreachStats 
} from '../server/services/investor-outreach';

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
function validateEnvironment(): void {
  const required = [
    'RESEND_API_KEY',
    'APIFY_API_KEY',
  ];
  
  // Check for Firebase credentials (either format)
  const hasFirebase = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.FIREBASE_ADMIN_KEY || process.env.FIREBASE_PROJECT_ID;
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0 || !hasFirebase) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(key => console.error(`  - ${key}`));
    if (!hasFirebase) {
      console.error('  - FIREBASE_SERVICE_ACCOUNT or FIREBASE_ADMIN_KEY or FIREBASE_PROJECT_ID');
    }
    console.error('\nPlease set these in your .env file or GitHub Secrets');
    process.exit(1);
  }
  
  console.log('✅ Environment validated');
}

// ============================================
// COMMAND HANDLERS
// ============================================
async function handleDaily(): Promise<void> {
  console.log('\n🚀 Running daily investor outreach...\n');
  
  const result = await runDailyInvestorOutreach();
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 EXECUTION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Leads Collected: ${result.leadsCollected}`);
  console.log(`Emails Sent: ${result.emailsSent}`);
  console.log(`Follow-ups Sent: ${result.followUpsSent}`);
  
  if (result.errors.length > 0) {
    console.log(`\n⚠️ Errors encountered:`);
    result.errors.forEach(e => console.log(`  - ${e}`));
  }
}

async function handleQuick(force: boolean = false): Promise<void> {
  console.log('\n⚡ Running quick outreach batch...\n');
  
  const numEmails = parseInt(process.env.QUICK_BATCH_SIZE || '25', 10);
  const { sent, failed } = await quickOutreach(numEmails, force);
  
  console.log(`\n✅ Quick batch complete: ${sent} sent, ${failed} failed`);
}

async function handleCollect(): Promise<void> {
  console.log('\n📥 Collecting leads only (no sending)...\n');
  
  const maxLeads = parseInt(process.env.MAX_LEADS_TO_COLLECT || '500', 10);
  const { collected, saved, duplicates } = await collectAndSaveLeads(maxLeads);
  
  console.log(`\n✅ Collection complete:`);
  console.log(`  Collected: ${collected}`);
  console.log(`  Saved: ${saved}`);
  console.log(`  Duplicates: ${duplicates}`);
}

async function handleStats(): Promise<void> {
  console.log('\n📊 Fetching outreach statistics...\n');
  
  const stats = await getOutreachStats();
  
  console.log('='.repeat(50));
  console.log('INVESTOR OUTREACH STATISTICS');
  console.log('='.repeat(50));
  console.log(`\n📋 Total Leads: ${stats.totalLeads}`);
  console.log(`📧 Total Emails Sent: ${stats.totalEmailsSent}`);
  console.log(`\n📈 Response Rate: ${stats.responseRate.toFixed(2)}%`);
  console.log(`💰 Conversion Rate: ${stats.conversionRate.toFixed(2)}%`);
  console.log('\nLead Breakdown:');
  
  const statusOrder = ['new', 'contacted', 'responded', 'converted', 'bounced', 'unsubscribed'];
  statusOrder.forEach(status => {
    const count = stats.byStatus[status] || 0;
    const bar = '█'.repeat(Math.min(20, Math.floor(count / 5)));
    console.log(`  ${status.padEnd(12)} ${count.toString().padStart(5)} ${bar}`);
  });
}

// ============================================
// MAIN EXECUTION
// ============================================
async function main(): Promise<void> {
  const command = process.argv[2] || 'daily';
  const hasForceFlag = process.argv.includes('--force') || process.argv.includes('-f');
  
  console.log('\n' + '═'.repeat(60));
  console.log('   🎵 BOOSTIFY MUSIC - INVESTOR OUTREACH SYSTEM');
  console.log('═'.repeat(60));
  console.log(`   Command: ${command}${hasForceFlag ? ' (forced)' : ''}`);
  console.log(`   Time: ${new Date().toISOString()}`);
  console.log('═'.repeat(60));
  
  try {
    validateEnvironment();
    
    switch (command) {
      case 'daily':
        await handleDaily();
        break;
      case 'quick':
        await handleQuick(hasForceFlag);
        break;
      case 'collect':
        await handleCollect();
        break;
      case 'stats':
        await handleStats();
        break;
      default:
        console.error(`\n❌ Unknown command: ${command}`);
        console.log('\nAvailable commands:');
        console.log('  daily   - Full daily outreach run');
        console.log('  quick   - Quick batch of emails (add --force to bypass hours)');
        console.log('  collect - Collect leads only');
        console.log('  stats   - Show statistics');
        process.exit(1);
    }
    
    console.log('\n✅ Outreach job completed successfully\n');
    
  } catch (error: any) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
