/**
 * Sponsor Follow-up Scheduler
 * Automatically sends follow-up emails for deals that haven't received a response.
 * Schedule: Day 3, Day 7, Day 14 after initial proposal.
 * Max 3 follow-ups per deal.
 */

import { db } from '../db';
import { sponsorDeals, sponsorEmailLog, sponsorContacts } from '../db/schema';
import { eq, and, lte, inArray, sql, count } from 'drizzle-orm';
import { sendFollowUp } from './sponsor-email-service';
import { createNotification } from '../utils/notifications';

const FOLLOW_UP_DAYS = [3, 7, 14]; // Days after proposal to send follow-ups
const MAX_FOLLOW_UPS = 3;
const CHECK_INTERVAL_MS = 60 * 60 * 1000; // Check every hour

let intervalHandle: ReturnType<typeof setInterval> | null = null;

/**
 * Check for deals that need follow-up and send them
 */
async function processFollowUps(): Promise<{ sent: number; skipped: number; errors: number }> {
  let sent = 0, skipped = 0, errors = 0;

  try {
    // Find deals in "proposed" status that had a proposal sent
    const openDeals = await db.select({
      deal: sponsorDeals,
    }).from(sponsorDeals)
      .where(and(
        inArray(sponsorDeals.status, ['proposed']),
        sql`${sponsorDeals.proposalSentAt} IS NOT NULL`
      ));

    for (const { deal } of openDeals) {
      try {
        // Count existing follow-ups for this deal
        const [followUpCount] = await db.select({ count: count() })
          .from(sponsorEmailLog)
          .where(and(
            eq(sponsorEmailLog.dealId, deal.id),
            eq(sponsorEmailLog.emailType, 'follow_up'),
          ));

        const numFollowUps = followUpCount?.count || 0;
        if (numFollowUps >= MAX_FOLLOW_UPS) {
          skipped++;
          continue;
        }

        // Calculate when the next follow-up is due
        const proposalDate = new Date(deal.proposalSentAt!);
        const nextFollowUpDay = FOLLOW_UP_DAYS[numFollowUps];
        if (!nextFollowUpDay) {
          skipped++;
          continue;
        }

        const nextFollowUpDate = new Date(proposalDate.getTime() + nextFollowUpDay * 24 * 60 * 60 * 1000);
        const now = new Date();

        if (now < nextFollowUpDate) {
          skipped++;
          continue;
        }

        // Check if the proposal was opened — if opened, use different messaging
        const wasOpened = deal.proposalOpenedAt !== null;

        console.log(`📧 Auto follow-up #${numFollowUps + 1} for deal #${deal.id} (${wasOpened ? 'opened' : 'not opened'})`);

        const result = await sendFollowUp(deal.id, 'follow_up');
        if (result.success) {
          sent++;

          // Notify the artist
          const contact = await db.select().from(sponsorContacts)
            .where(eq(sponsorContacts.id, deal.sponsorContactId)).limit(1);

          await createNotification({
            userId: deal.artistId,
            type: 'SPONSOR_AUTO_FOLLOWUP',
            title: `📧 Auto follow-up #${numFollowUps + 1} sent to ${contact[0]?.brandName || 'sponsor'}`,
            message: `Day ${nextFollowUpDay} follow-up sent for "${deal.title}"${wasOpened ? ' (they opened the original!)' : ''}.`,
            metadata: { dealId: deal.id, followUpNumber: numFollowUps + 1, daysSinceProposal: nextFollowUpDay },
          });
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`❌ Follow-up error for deal #${deal.id}:`, err);
        errors++;
      }
    }
  } catch (err) {
    console.error('❌ Follow-up scheduler global error:', err);
  }

  if (sent > 0 || errors > 0) {
    console.log(`📨 Follow-up scheduler: ${sent} sent, ${skipped} skipped, ${errors} errors`);
  }

  return { sent, skipped, errors };
}

/**
 * Start the follow-up scheduler
 */
export function startFollowUpScheduler(): void {
  if (intervalHandle) return; // Already running

  console.log('⏰ Sponsor follow-up scheduler started (checking every hour)');

  // Run once immediately on startup (delayed 30s to let DB settle)
  setTimeout(() => {
    processFollowUps().catch(console.error);
  }, 30_000);

  // Then run every hour
  intervalHandle = setInterval(() => {
    processFollowUps().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the follow-up scheduler
 */
export function stopFollowUpScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('⏰ Sponsor follow-up scheduler stopped');
  }
}

/** Manually trigger a follow-up check (for admin/testing) */
export { processFollowUps };
