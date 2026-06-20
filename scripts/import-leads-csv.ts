#!/usr/bin/env node
/**
 * Import Leads from CSV Script
 * 
 * Usage:
 *   npx tsx scripts/import-leads-csv.ts path/to/leads.csv
 * 
 * CSV Format:
 *   email,firstName,lastName,company,title,industry,location
 *   john@example.com,John,Smith,Music Ventures,Partner,Venture Capital,Los Angeles
 */

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { parseCSVLeads, getSampleLeads } from '../server/services/investor-outreach/apify-lead-scraper';
import { saveLeads } from '../server/services/investor-outreach/lead-database';

async function main(): Promise<void> {
  console.log('\n' + '═'.repeat(60));
  console.log('   🎵 BOOSTIFY MUSIC - LEAD IMPORT TOOL');
  console.log('═'.repeat(60));
  
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.log('\n⚠️  No CSV file provided. Using sample leads for testing...\n');
    
    const sampleLeads = getSampleLeads();
    console.log(`📋 Sample leads: ${sampleLeads.length}`);
    sampleLeads.forEach(lead => {
      console.log(`   - ${lead.fullName} (${lead.company}) - ${lead.email}`);
    });
    
    const { saved, duplicates } = await saveLeads(sampleLeads);
    
    console.log(`\n✅ Saved ${saved} leads (${duplicates} duplicates skipped)`);
    return;
  }
  
  // Read CSV file
  const absolutePath = path.resolve(csvPath);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`\n❌ File not found: ${absolutePath}`);
    process.exit(1);
  }
  
  console.log(`\n📁 Reading: ${absolutePath}`);
  const csvContent = fs.readFileSync(absolutePath, 'utf-8');
  
  // Parse CSV
  const leads = parseCSVLeads(csvContent);
  
  if (leads.length === 0) {
    console.error('\n❌ No valid leads found in CSV');
    console.log('\nExpected format:');
    console.log('  email,firstName,lastName,company,title,industry,location');
    process.exit(1);
  }
  
  console.log(`\n📋 Parsed ${leads.length} leads from CSV:`);
  leads.slice(0, 5).forEach(lead => {
    console.log(`   - ${lead.fullName} (${lead.company}) - ${lead.email}`);
  });
  
  if (leads.length > 5) {
    console.log(`   ... and ${leads.length - 5} more`);
  }
  
  // Save to database
  const { saved, duplicates } = await saveLeads(leads);
  
  console.log(`\n✅ Import complete:`);
  console.log(`   Saved: ${saved}`);
  console.log(`   Duplicates skipped: ${duplicates}`);
  console.log(`\n💡 Run 'npx tsx scripts/investor-outreach.ts quick' to send emails\n`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
