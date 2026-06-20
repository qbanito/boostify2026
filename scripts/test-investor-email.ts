#!/usr/bin/env node
/**
 * Test Investor Email Script
 * Sends test emails to verify templates before going live
 * Using Brevo for info@boostifymusic.com
 */

import 'dotenv/config';
import { generatePersonalizedEmail } from '../server/services/investor-outreach/email-templates';
import { InvestorLead } from '../server/services/investor-outreach/types';

const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Test recipient
const TEST_EMAIL = 'convoycubano@gmail.com';
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music';

// Sample lead for testing
const testLead: InvestorLead = {
  id: 'test-001',
  email: TEST_EMAIL,
  firstName: 'John',
  lastName: 'Smith',
  fullName: 'John Smith',
  company: 'Music Ventures Capital',
  title: 'Managing Partner',
  industry: 'Venture Capital',
  source: 'manual',
  createdAt: new Date(),
  emailsSent: 0,
  status: 'new',
  investorType: 'vc_fund',
  personalizedData: {
    recentNews: 'Recently led $10M round in streaming startup',
    relevantInvestments: ['Spotify', 'SoundCloud', 'Bandcamp'],
  },
};

// All templates to test
const TEMPLATES = [
  'cold_outreach_direct',
  'cold_outreach_problem',
  'warm_vc_intro',
  'record_label_exec',
  'follow_up_3d',
  'follow_up_7d',
];

async function sendTestEmail(templateId: string): Promise<void> {
  console.log(`\n📧 Sending test email: ${templateId}...`);
  
  const { subject, html, text } = generatePersonalizedEmail(testLead, templateId);
  
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: TEST_EMAIL }],
        subject: `[TEST] ${subject}`,
        htmlContent: html,
        textContent: text
      })
    });

    const result = await response.json();

    if (result.messageId) {
      console.log(`✅ Sent! Message ID: ${result.messageId}`);
    } else {
      console.error(`❌ Error:`, result);
    }
  } catch (error: any) {
    console.error(`❌ Failed: ${error.message}`);
  }
}

async function main(): Promise<void> {
  console.log('═'.repeat(60));
  console.log('   🎵 BOOSTIFY - TEST INVESTOR EMAILS');
  console.log('═'.repeat(60));
  console.log(`\n📬 Sending to: ${TEST_EMAIL}`);
  console.log(`📤 From: ${FROM_EMAIL}`);
  console.log(`📋 Templates: ${TEMPLATES.length}`);
  
  // Check API key
  if (!BREVO_API_KEY) {
    console.error('\n❌ BREVO_API_KEY not found in .env');
    process.exit(1);
  }
  
  const templateArg = process.argv[2];
  
  if (templateArg && templateArg !== 'all') {
    // Send specific template
    if (!TEMPLATES.includes(templateArg)) {
      console.error(`\n❌ Unknown template: ${templateArg}`);
      console.log('Available templates:', TEMPLATES.join(', '));
      process.exit(1);
    }
    await sendTestEmail(templateArg);
  } else {
    // Send all templates
    console.log('\n🚀 Sending all templates...\n');
    
    for (const template of TEMPLATES) {
      await sendTestEmail(template);
      // Small delay between emails
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n' + '═'.repeat(60));
  console.log('✅ Test complete! Check your inbox at:');
  console.log(`   ${TEST_EMAIL}`);
  console.log('═'.repeat(60) + '\n');
}

main().catch(console.error);
