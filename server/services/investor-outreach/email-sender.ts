/**
 * Investor Outreach Email Sender
 * Uses Brevo for email delivery with tracking
 */

import { InvestorLead, EmailSendResult, OutreachConfig } from './types';
import { generatePersonalizedEmail, selectBestTemplate } from './email-templates';
import { db, FieldValue } from '../../firebase';

// Brevo API configuration
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const FROM_EMAIL = 'investors@boostifymusic.com';
const FROM_NAME = 'Boostify Music';
const REPLY_TO = 'hello@boostifymusic.com';

// Helper function to send email via Brevo
async function sendBrevoEmail(to: string, subject: string, htmlContent: string, textContent?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        replyTo: { email: REPLY_TO },
        subject,
        htmlContent,
        textContent
      })
    });
    
    const result = await response.json();
    
    if (result.messageId) {
      return { success: true, messageId: result.messageId };
    } else {
      return { success: false, error: result.message || JSON.stringify(result) };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Default outreach configuration
const DEFAULT_CONFIG: OutreachConfig = {
  dailyEmailLimit: 100,
  sendingHoursStart: 9, // 9 AM UTC
  sendingHoursEnd: 17, // 5 PM UTC
  delayBetweenEmails: 30, // 30 seconds between emails
  maxRetriesPerLead: 3,
  followUpDays: [3, 7], // Days after initial email
};

// ============================================
// SEND SINGLE EMAIL
// ============================================
export async function sendInvestorEmail(
  lead: InvestorLead,
  templateId?: string
): Promise<EmailSendResult> {
  try {
    // Validate email
    if (!lead.email || !isValidEmail(lead.email)) {
      return {
        success: false,
        leadId: lead.id,
        email: lead.email || '',
        error: 'Invalid or missing email address',
        sentAt: new Date(),
      };
    }

    // Select template
    const template = templateId || selectBestTemplate(lead);
    
    // Generate personalized email
    const { subject, html, text } = generatePersonalizedEmail(lead, template);

    // Send via Brevo
    const response = await sendBrevoEmail(lead.email, subject, html, text);

    if (!response.success) {
      throw new Error(response.error || 'Unknown Brevo error');
    }

    // Update lead status in database
    await updateLeadAfterSend(lead.id, true);

    console.log(`✅ Email sent to ${lead.email} (${lead.fullName})`);

    return {
      success: true,
      leadId: lead.id,
      email: lead.email,
      messageId: response.messageId,
      sentAt: new Date(),
    };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${lead.email}:`, error.message);

    // Update lead status
    await updateLeadAfterSend(lead.id, false, error.message);

    return {
      success: false,
      leadId: lead.id,
      email: lead.email || '',
      error: error.message,
      sentAt: new Date(),
    };
  }
}

// ============================================
// BATCH SEND EMAILS
// ============================================
export async function sendBatchEmails(
  leads: InvestorLead[],
  config: Partial<OutreachConfig> & { force?: boolean } = {}
): Promise<{ sent: number; failed: number; results: EmailSendResult[] }> {
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };
  const results: EmailSendResult[] = [];
  let sent = 0;
  let failed = 0;

  // Check if within sending hours (unless forced)
  if (!config.force) {
    const currentHour = new Date().getUTCHours();
    if (currentHour < mergedConfig.sendingHoursStart || currentHour >= mergedConfig.sendingHoursEnd) {
      console.log(`⏰ Outside sending hours (${mergedConfig.sendingHoursStart}-${mergedConfig.sendingHoursEnd} UTC). Skipping.`);
      console.log(`💡 Use --force flag to bypass sending hours check`);
      return { sent: 0, failed: 0, results: [] };
    }
  } else {
    console.log(`⚠️ Force mode enabled - bypassing sending hours check`);
  }

  // Limit to daily maximum
  const leadsToProcess = leads.slice(0, mergedConfig.dailyEmailLimit);
  console.log(`📧 Processing ${leadsToProcess.length} leads...`);

  for (const lead of leadsToProcess) {
    // Check if already contacted today
    if (lead.lastContactedAt) {
      const lastContact = new Date(lead.lastContactedAt);
      const today = new Date();
      if (lastContact.toDateString() === today.toDateString()) {
        console.log(`⏭️ Skipping ${lead.email} - already contacted today`);
        continue;
      }
    }

    // Check retry limit
    if (lead.emailsSent >= mergedConfig.maxRetriesPerLead) {
      console.log(`⏭️ Skipping ${lead.email} - max retries reached`);
      continue;
    }

    // Send email
    const result = await sendInvestorEmail(lead);
    results.push(result);

    if (result.success) {
      sent++;
    } else {
      failed++;
    }

    // Delay between emails
    await sleep(mergedConfig.delayBetweenEmails * 1000);
  }

  console.log(`\n📊 BATCH COMPLETE: ${sent} sent, ${failed} failed`);
  return { sent, failed, results };
}

// ============================================
// DAILY OUTREACH JOB
// ============================================
export async function runDailyOutreach(): Promise<void> {
  console.log('\n🚀 Starting Daily Investor Outreach...');
  console.log(`📅 Date: ${new Date().toISOString()}`);

  try {
    // 1. Get leads to contact today
    const leads = await getLeadsForToday();
    console.log(`📋 Found ${leads.length} leads to contact`);

    if (leads.length === 0) {
      console.log('No leads to process. Exiting.');
      return;
    }

    // 2. Send batch emails
    const { sent, failed, results } = await sendBatchEmails(leads);

    // 3. Log results
    await logOutreachResults(results);

    // 4. Summary
    console.log('\n📊 DAILY OUTREACH SUMMARY');
    console.log('========================');
    console.log(`✅ Emails Sent: ${sent}`);
    console.log(`❌ Emails Failed: ${failed}`);
    console.log(`📈 Success Rate: ${((sent / (sent + failed)) * 100).toFixed(1)}%`);

  } catch (error) {
    console.error('❌ Daily outreach failed:', error);
    throw error;
  }
}

// ============================================
// GET LEADS FOR TODAY
// ============================================
async function getLeadsForToday(): Promise<InvestorLead[]> {
  try {
    if (!db) {
      console.error('Firebase not initialized');
      return [];
    }
    const snapshot = await db.collection('investor_leads')
      .where('status', 'in', ['new', 'contacted'])
      .where('emailsSent', '<', DEFAULT_CONFIG.maxRetriesPerLead)
      .orderBy('emailsSent', 'asc')
      .orderBy('createdAt', 'asc')
      .limit(DEFAULT_CONFIG.dailyEmailLimit)
      .get();

    return snapshot.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    } as InvestorLead));
  } catch (error) {
    console.error('Error fetching leads:', error);
    return [];
  }
}

// ============================================
// UPDATE LEAD AFTER SEND
// ============================================
async function updateLeadAfterSend(
  leadId: string,
  success: boolean,
  error?: string
): Promise<void> {
  try {
    if (!db) return;
    const updateData: any = {
      lastContactedAt: new Date(),
      emailsSent: FieldValue.increment(1),
    };

    if (success) {
      updateData.status = 'contacted';
    } else if (error?.includes('bounce') || error?.includes('invalid')) {
      updateData.status = 'bounced';
    }

    if (error) {
      updateData.lastError = error;
    }

    await db.collection('investor_leads').doc(leadId).update(updateData);
  } catch (err) {
    console.error('Error updating lead:', err);
  }
}

// ============================================
// LOG OUTREACH RESULTS
// ============================================
async function logOutreachResults(results: EmailSendResult[]): Promise<void> {
  try {
    if (!db) return;
    const batch = db.batch();
    
    for (const result of results) {
      const logRef = db.collection('outreach_logs').doc();
      batch.set(logRef, {
        ...result,
        timestamp: new Date(),
      });
    }

    await batch.commit();
  } catch (error) {
    console.error('Error logging results:', error);
  }
}

// ============================================
// HELPERS
// ============================================
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default {
  sendInvestorEmail,
  sendBatchEmails,
  runDailyOutreach,
  DEFAULT_CONFIG,
};
