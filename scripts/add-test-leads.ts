#!/usr/bin/env node
/**
 * Add Test Leads Script
 * Adds real test leads with user's email for testing the full sequence
 */

import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';
import { saveLeads } from '../server/services/investor-outreach/lead-database';
import { InvestorLead } from '../server/services/investor-outreach/types';

async function main(): Promise<void> {
  const testEmail = process.argv[2] || 'convoycubano@gmail.com';
  
  console.log('\n' + '═'.repeat(60));
  console.log('   🎵 BOOSTIFY MUSIC - ADD TEST LEADS');
  console.log('═'.repeat(60));
  console.log(`\n📧 Creating test leads with email: ${testEmail}\n`);
  
  // Create diverse test leads (all with user's email for testing)
  const testLeads: Partial<InvestorLead>[] = [
    {
      id: uuidv4(),
      email: testEmail,
      firstName: 'David',
      lastName: 'Goldman',
      fullName: 'David Goldman',
      company: 'Starlight Ventures',
      title: 'Managing Partner',
      industry: 'Venture Capital',
      location: 'Los Angeles, CA',
      investorType: 'vc_fund',
      source: 'manual',
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new',
      personalizedData: {
        recentNews: 'Led $50M Series B in AI music startup',
        relevantInvestments: ['Spotify', 'SoundCloud', 'Bandcamp'],
      },
    },
    {
      id: uuidv4(),
      email: testEmail,
      firstName: 'Jessica',
      lastName: 'Martinez',
      fullName: 'Jessica Martinez',
      company: 'Atlantic Records',
      title: 'VP of A&R',
      industry: 'Music',
      location: 'New York, NY',
      investorType: 'record_label',
      source: 'manual',
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new',
      personalizedData: {
        recentNews: 'Signed 3 independent artists to major deals',
      },
    },
    {
      id: uuidv4(),
      email: testEmail,
      firstName: 'Robert',
      lastName: 'Chen',
      fullName: 'Robert Chen',
      company: 'Tech Angels Miami',
      title: 'Angel Investor',
      industry: 'Angel Investment',
      location: 'Miami, FL',
      investorType: 'angel_investor',
      source: 'manual',
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new',
    },
    {
      id: uuidv4(),
      email: testEmail,
      firstName: 'Amanda',
      lastName: 'Thompson',
      fullName: 'Amanda Thompson',
      company: 'Music Innovation Fund',
      title: 'Principal',
      industry: 'Venture Capital',
      location: 'Nashville, TN',
      investorType: 'music_tech_investor',
      source: 'manual',
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new',
      personalizedData: {
        relevantInvestments: ['DistroKid', 'Splice', 'Landr'],
      },
    },
    {
      id: uuidv4(),
      email: testEmail,
      firstName: 'Marcus',
      lastName: 'Williams',
      fullName: 'Marcus Williams',
      company: 'Williams Entertainment Consulting',
      title: 'Music Industry Consultant',
      industry: 'Consulting',
      location: 'Atlanta, GA',
      investorType: 'industry_consultant',
      source: 'manual',
      createdAt: new Date(),
      emailsSent: 0,
      status: 'new',
    },
  ];
  
  console.log('📋 Test leads to add:');
  testLeads.forEach((lead, i) => {
    console.log(`   ${i + 1}. ${lead.fullName} - ${lead.title} @ ${lead.company} (${lead.investorType})`);
  });
  
  const { saved, duplicates } = await saveLeads(testLeads);
  
  console.log(`\n✅ Added ${saved} test leads (${duplicates} duplicates)`);
  console.log('\n💡 Next steps:');
  console.log('   1. Run: npx tsx scripts/investor-outreach.ts stats');
  console.log('   2. Run: npx tsx scripts/investor-outreach.ts quick');
  console.log(`   3. Check inbox: ${testEmail}\n`);
}

main().catch(error => {
  console.error('\n❌ Error:', error.message);
  process.exit(1);
});
