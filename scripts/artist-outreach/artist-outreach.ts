/**
 * 🎵 BOOSTIFY MUSIC - ARTIST OUTREACH AUTOMATION
 * 
 * Sistema de envío de emails automatizados para artistas
 * Secuencia de 10 emails para convertir artistas en usuarios activos
 * 
 * API Key de Resend (Artistas): re_Q73PRQ8o_8wYWWVHufVwDocuKaLRrVJhf
 * SEPARADO del sistema de inversores
 */

import { Resend } from 'resend';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import * as fs from 'fs';
import * as path from 'path';
import {
  ArtistLead,
  ArtistEmailTemplate,
  ARTIST_EMAIL_SEQUENCE,
  ARTIST_RESEND_API_KEY,
  ARTIST_COLLECTION_NAME,
  ARTIST_FROM_EMAIL,
  ARTIST_FROM_NAME,
  getArtistEmailTemplate,
  personalizeSubject,
  getNextSequenceNumber,
} from './artist-email-templates';

// Initialize Resend with ARTIST API key (separate from investor)
const resend = new Resend(ARTIST_RESEND_API_KEY);

// Initialize Firebase Admin
function initFirebaseAdmin() {
  if (getApps().length === 0) {
    const serviceAccountPath = path.join(
      process.cwd(),
      'attached_assets',
      'artist-boost-firebase-adminsdk-fbsvc-c4227e7d7b_1763184143691.json'
    );

    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
      initializeApp({
        credential: cert(serviceAccount),
      });
      console.log('✅ Firebase Admin initialized');
    } else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      throw new Error('No Firebase service account found');
    }
  }
  return getFirestore();
}

// Email sending result
interface EmailSendResult {
  success: boolean;
  leadId: string;
  email: string;
  sequenceNumber: number;
  messageId?: string;
  error?: string;
}

/**
 * Send a single email to an artist lead
 */
async function sendArtistEmail(
  lead: ArtistLead,
  template: ArtistEmailTemplate
): Promise<EmailSendResult> {
  try {
    const subject = personalizeSubject(template, lead);
    const htmlContent = template.generateHTML(lead);

    const response = await resend.emails.send({
      from: `${ARTIST_FROM_NAME} <${ARTIST_FROM_EMAIL}>`,
      to: lead.email,
      subject: subject,
      html: htmlContent,
      headers: {
        'X-Entity-Ref-ID': `artist-${lead.id}-seq-${template.sequenceNumber}`,
      },
      tags: [
        { name: 'type', value: 'artist_outreach' },
        { name: 'sequence', value: String(template.sequenceNumber) },
        { name: 'lead_id', value: lead.id },
      ],
    });

    console.log(`✅ Email sent to ${lead.email} (Sequence ${template.sequenceNumber})`);

    return {
      success: true,
      leadId: lead.id,
      email: lead.email,
      sequenceNumber: template.sequenceNumber,
      messageId: response.data?.id,
    };
  } catch (error: any) {
    console.error(`❌ Failed to send email to ${lead.email}:`, error.message);

    return {
      success: false,
      leadId: lead.id,
      email: lead.email,
      sequenceNumber: template.sequenceNumber,
      error: error.message,
    };
  }
}

/**
 * Get leads that are ready for the next email in the sequence
 */
async function getLeadsReadyForNextEmail(
  db: FirebaseFirestore.Firestore,
  limit: number = 50
): Promise<ArtistLead[]> {
  const now = new Date();
  const readyLeads: ArtistLead[] = [];

  // Get all active leads (not unsubscribed or fully activated)
  const leadsSnapshot = await db
    .collection(ARTIST_COLLECTION_NAME)
    .where('status', 'not-in', ['unsubscribed', 'activated'])
    .orderBy('createdAt', 'asc')
    .limit(limit * 2) // Get more than needed to account for filtering
    .get();

  for (const doc of leadsSnapshot.docs) {
    const lead = { id: doc.id, ...doc.data() } as ArtistLead;

    // Check if lead is ready for next email based on wait days
    const nextSequence = (lead.currentSequence || 0) + 1;
    const template = getArtistEmailTemplate(nextSequence);

    if (!template) {
      // Sequence completed, mark as activated
      await doc.ref.update({
        status: 'activated',
        activatedAt: FieldValue.serverTimestamp(),
      });
      continue;
    }

    // Check if enough time has passed since last email
    if (lead.lastEmailSent) {
      const lastSent = lead.lastEmailSent instanceof Timestamp 
        ? lead.lastEmailSent.toDate() 
        : new Date(lead.lastEmailSent);
      const daysSinceLastEmail = Math.floor(
        (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceLastEmail < template.waitDays) {
        continue; // Not ready yet
      }
    }

    readyLeads.push(lead);

    if (readyLeads.length >= limit) {
      break;
    }
  }

  return readyLeads;
}

/**
 * Update lead status after sending email
 */
async function updateLeadAfterEmail(
  db: FirebaseFirestore.Firestore,
  leadId: string,
  sequenceNumber: number,
  success: boolean
): Promise<void> {
  const docRef = db.collection(ARTIST_COLLECTION_NAME).doc(leadId);

  if (success) {
    await docRef.update({
      currentSequence: sequenceNumber,
      status: `sequence_${sequenceNumber}`,
      lastEmailSent: FieldValue.serverTimestamp(),
      [`emailHistory.sequence_${sequenceNumber}`]: {
        sentAt: FieldValue.serverTimestamp(),
        success: true,
      },
    });
  } else {
    await docRef.update({
      [`emailHistory.sequence_${sequenceNumber}`]: {
        attemptedAt: FieldValue.serverTimestamp(),
        success: false,
      },
    });
  }
}

/**
 * Process artist email queue - send next emails in sequence
 */
export async function processArtistEmailQueue(options: {
  maxEmails?: number;
  dryRun?: boolean;
}): Promise<{
  processed: number;
  successful: number;
  failed: number;
  results: EmailSendResult[];
}> {
  const { maxEmails = 50, dryRun = false } = options;
  const db = initFirebaseAdmin();

  console.log('\n🎵 BOOSTIFY ARTIST OUTREACH - Processing Email Queue');
  console.log('═'.repeat(50));
  console.log(`📧 Max emails to send: ${maxEmails}`);
  console.log(`🔄 Dry run: ${dryRun}`);
  console.log('');

  const leads = await getLeadsReadyForNextEmail(db, maxEmails);
  console.log(`📋 Found ${leads.length} leads ready for next email`);

  if (leads.length === 0) {
    console.log('✅ No leads to process at this time');
    return { processed: 0, successful: 0, failed: 0, results: [] };
  }

  const results: EmailSendResult[] = [];
  let successful = 0;
  let failed = 0;

  for (const lead of leads) {
    const nextSequence = (lead.currentSequence || 0) + 1;
    const template = getArtistEmailTemplate(nextSequence);

    if (!template) {
      continue;
    }

    console.log(`\n📤 Processing: ${lead.email} (Sequence ${nextSequence})`);

    if (dryRun) {
      console.log(`   [DRY RUN] Would send: ${personalizeSubject(template, lead)}`);
      results.push({
        success: true,
        leadId: lead.id,
        email: lead.email,
        sequenceNumber: nextSequence,
        messageId: 'dry-run',
      });
      successful++;
      continue;
    }

    // Send email
    const result = await sendArtistEmail(lead, template);
    results.push(result);

    if (result.success) {
      successful++;
      await updateLeadAfterEmail(db, lead.id, nextSequence, true);
    } else {
      failed++;
      await updateLeadAfterEmail(db, lead.id, nextSequence, false);
    }

    // Small delay between emails to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 ARTIST OUTREACH SUMMARY');
  console.log('═'.repeat(50));
  console.log(`   📧 Processed: ${results.length}`);
  console.log(`   ✅ Successful: ${successful}`);
  console.log(`   ❌ Failed: ${failed}`);

  return {
    processed: results.length,
    successful,
    failed,
    results,
  };
}

/**
 * Send welcome email to new leads (first email in sequence)
 */
export async function sendWelcomeEmailsToNewLeads(options: {
  maxEmails?: number;
  dryRun?: boolean;
}): Promise<{ sent: number; results: EmailSendResult[] }> {
  const { maxEmails = 100, dryRun = false } = options;
  const db = initFirebaseAdmin();

  console.log('\n🎵 BOOSTIFY ARTIST OUTREACH - Sending Welcome Emails');
  console.log('═'.repeat(50));

  // Get new leads that haven't received any email yet
  const newLeadsSnapshot = await db
    .collection(ARTIST_COLLECTION_NAME)
    .where('status', '==', 'new')
    .where('currentSequence', '==', 0)
    .orderBy('createdAt', 'asc')
    .limit(maxEmails)
    .get();

  console.log(`📋 Found ${newLeadsSnapshot.size} new leads to welcome`);

  if (newLeadsSnapshot.empty) {
    console.log('✅ No new leads to welcome');
    return { sent: 0, results: [] };
  }

  const welcomeTemplate = getArtistEmailTemplate(1);
  if (!welcomeTemplate) {
    throw new Error('Welcome template (sequence 1) not found');
  }

  const results: EmailSendResult[] = [];
  let sent = 0;

  for (const doc of newLeadsSnapshot.docs) {
    const lead = { id: doc.id, ...doc.data() } as ArtistLead;

    console.log(`\n📤 Welcoming: ${lead.email}`);

    if (dryRun) {
      console.log(`   [DRY RUN] Would send welcome to: ${lead.email}`);
      results.push({
        success: true,
        leadId: lead.id,
        email: lead.email,
        sequenceNumber: 1,
        messageId: 'dry-run',
      });
      sent++;
      continue;
    }

    const result = await sendArtistEmail(lead, welcomeTemplate);
    results.push(result);

    if (result.success) {
      sent++;
      await updateLeadAfterEmail(db, lead.id, 1, true);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`\n✅ Sent ${sent} welcome emails`);
  return { sent, results };
}

/**
 * Get statistics about the artist outreach campaign
 */
export async function getArtistOutreachStats(): Promise<{
  totalLeads: number;
  byStatus: Record<string, number>;
  bySequence: Record<number, number>;
  conversionRate: number;
}> {
  const db = initFirebaseAdmin();

  const snapshot = await db.collection(ARTIST_COLLECTION_NAME).get();
  
  const stats = {
    totalLeads: snapshot.size,
    byStatus: {} as Record<string, number>,
    bySequence: {} as Record<number, number>,
    conversionRate: 0,
  };

  let activated = 0;

  snapshot.forEach(doc => {
    const lead = doc.data() as ArtistLead;
    
    // Count by status
    const status = lead.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;

    // Count by sequence
    const sequence = lead.currentSequence || 0;
    stats.bySequence[sequence] = (stats.bySequence[sequence] || 0) + 1;

    if (lead.status === 'activated') {
      activated++;
    }
  });

  // Calculate conversion rate
  stats.conversionRate = stats.totalLeads > 0 
    ? (activated / stats.totalLeads) * 100 
    : 0;

  return stats;
}

/**
 * Print campaign statistics
 */
export async function printCampaignStats(): Promise<void> {
  console.log('\n🎵 BOOSTIFY ARTIST OUTREACH - Campaign Statistics');
  console.log('═'.repeat(50));

  const stats = await getArtistOutreachStats();

  console.log(`\n📊 Total Artist Leads: ${stats.totalLeads}`);
  
  console.log('\n📈 By Status:');
  Object.entries(stats.byStatus).sort().forEach(([status, count]) => {
    const bar = '█'.repeat(Math.min(Math.ceil(count / 10), 30));
    console.log(`   ${status.padEnd(15)} ${String(count).padStart(5)} ${bar}`);
  });

  console.log('\n📧 By Email Sequence:');
  for (let i = 0; i <= 10; i++) {
    const count = stats.bySequence[i] || 0;
    const bar = '█'.repeat(Math.min(Math.ceil(count / 10), 30));
    const label = i === 0 ? 'Not started' : `Email ${i}`;
    console.log(`   ${label.padEnd(15)} ${String(count).padStart(5)} ${bar}`);
  }

  console.log(`\n🎯 Conversion Rate: ${stats.conversionRate.toFixed(2)}%`);
}

// CLI entry point
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  const dryRun = args.includes('--dry-run');

  async function main() {
    switch (command) {
      case 'welcome':
        await sendWelcomeEmailsToNewLeads({ dryRun });
        break;

      case 'process':
        await processArtistEmailQueue({
          maxEmails: parseInt(args[1]) || 50,
          dryRun,
        });
        break;

      case 'stats':
        await printCampaignStats();
        break;

      case 'run-daily':
        // Full daily routine
        console.log('\n🎵 Running daily artist outreach routine...\n');
        
        // 1. Send welcome emails to new leads
        await sendWelcomeEmailsToNewLeads({ maxEmails: 100 });
        
        // 2. Process email queue for existing leads
        await processArtistEmailQueue({ maxEmails: 100 });
        
        // 3. Print stats
        await printCampaignStats();
        break;

      default:
        console.log(`
🎵 BOOSTIFY MUSIC - Artist Outreach Automation

Usage:
  npx ts-node scripts/artist-outreach/artist-outreach.ts <command> [options]

Commands:
  welcome              Send welcome emails to new leads
  process [max]        Process email queue (send next emails in sequence)
  stats                Show campaign statistics
  run-daily            Run full daily routine (welcome + process + stats)

Options:
  --dry-run            Preview what would be sent without actually sending

Examples:
  npx ts-node scripts/artist-outreach/artist-outreach.ts welcome
  npx ts-node scripts/artist-outreach/artist-outreach.ts process 100
  npx ts-node scripts/artist-outreach/artist-outreach.ts stats
  npx ts-node scripts/artist-outreach/artist-outreach.ts run-daily
  npx ts-node scripts/artist-outreach/artist-outreach.ts welcome --dry-run
        `);
    }
  }

  main().catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
}
