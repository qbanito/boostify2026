/**
 * Drip Engine — Processes scheduled email sequences
 * Runs on interval, picks up sequences due for their next step,
 * renders personalized templates, sends via Brevo, and advances the sequence.
 */

import { db } from '../../db';
import { dripSequences, musicIndustryContacts, activationScores } from '../../db/schema';
import { eq, and, lte, sql, isNotNull } from 'drizzle-orm';
import { sendNotificationEmail, type EmailResult } from '../brevo-email-service';
import {
  SEQUENCE_TEMPLATES, SEQUENCE_STEPS, SEQUENCE_DELAYS,
  type SequenceType, type TemplateData
} from './email-templates';
import {
  trackEvent, generateMagicLink, getUnsubscribeUrl,
} from './activation-tracker';
import { personalizeEmail, selectOptimalSequence } from '../artist-discovery/agent-brain';
import { getABVariant, getWinningSubject, recordABEvent } from '../artist-discovery/agent-autonomy';

const PLATFORM_URL = process.env.BASE_URL || 'https://boostifymusic.com';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Music';

// ─── Daily Email Rate Limiter ────────────────────────────────────
// Brevo free tier: 300/day. Paid: 20K+/day. Default conservative limit.
const DAILY_EMAIL_LIMIT = parseInt(process.env.DAILY_EMAIL_LIMIT || '250', 10);

interface DailyCounter {
  date: string; // YYYY-MM-DD
  count: number;
}

let dailyCounter: DailyCounter = { date: '', count: 0 };

function getTodayKey(): string {
  return new Date().toISOString().split('T')[0];
}

function canSendEmail(): boolean {
  const today = getTodayKey();
  if (dailyCounter.date !== today) {
    dailyCounter = { date: today, count: 0 };
  }
  return dailyCounter.count < DAILY_EMAIL_LIMIT;
}

function recordEmailSent(): void {
  const today = getTodayKey();
  if (dailyCounter.date !== today) {
    dailyCounter = { date: today, count: 1 };
  } else {
    dailyCounter.count++;
  }
}

export function getDailyEmailStats(): { date: string; sent: number; limit: number; remaining: number } {
  const today = getTodayKey();
  if (dailyCounter.date !== today) {
    return { date: today, sent: 0, limit: DAILY_EMAIL_LIMIT, remaining: DAILY_EMAIL_LIMIT };
  }
  return { date: today, sent: dailyCounter.count, limit: DAILY_EMAIL_LIMIT, remaining: Math.max(0, DAILY_EMAIL_LIMIT - dailyCounter.count) };
}

// ─── Send HTML email directly (for custom templates) ─────────────

async function sendHtmlEmail(to: string, subject: string, htmlContent: string): Promise<EmailResult> {
  try {
    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': BREVO_API_KEY,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        subject,
        htmlContent,
      }),
    });
    const result = await response.json();
    if (result.messageId) {
      return { success: true, messageId: result.messageId };
    }
    return { success: false, error: result.message || JSON.stringify(result) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Enroll a contact into a drip sequence ───────────────────────

export async function enrollInSequence(
  contactId: number,
  sequenceType: SequenceType,
  delayMinutes: number = 0,
): Promise<boolean> {
  try {
    // Check if already enrolled in this sequence
    const existing = await db.select().from(dripSequences).where(
      and(
        eq(dripSequences.contactId, contactId),
        eq(dripSequences.sequenceType, sequenceType),
        eq(dripSequences.status, 'active'),
      )
    ).limit(1);
    if (existing.length > 0) return false; // Already active

    const totalSteps = SEQUENCE_STEPS[sequenceType];
    const nextSend = new Date(Date.now() + delayMinutes * 60 * 1000);

    await db.insert(dripSequences).values({
      contactId,
      sequenceType,
      currentStep: 0,
      totalSteps,
      status: 'active',
      nextSendAt: nextSend,
      emailsSent: 0,
      emailsOpened: 0,
      emailsClicked: 0,
      metadata: {},
    });

    console.log(`[DripEngine] Enrolled contact ${contactId} in ${sequenceType} (next: ${nextSend.toISOString()})`);
    return true;
  } catch (err) {
    console.error('[DripEngine] Enroll error:', err);
    return false;
  }
}

// ─── Process due sequences ───────────────────────────────────────

export async function processDripQueue(batchSize: number = 50): Promise<{
  processed: number;
  sent: number;
  errors: number;
  completed: number;
  rateLimited: number;
}> {
  const stats = { processed: 0, sent: 0, errors: 0, completed: 0, rateLimited: 0 };

  try {
    // Check daily limit before processing
    const dailyStats = getDailyEmailStats();
    if (!canSendEmail()) {
      console.log(`[DripEngine] ⚠️ Daily email limit reached (${dailyStats.sent}/${dailyStats.limit}). Skipping batch.`);
      return { ...stats, rateLimited: dailyStats.sent };
    }
    const availableToSend = dailyStats.remaining;

    // Get sequences that are due — limit to what we can still send today
    const effectiveBatch = Math.min(batchSize, availableToSend);
    const dueSequences = await db.select({
      seq: dripSequences,
      contact: musicIndustryContacts,
    })
      .from(dripSequences)
      .innerJoin(musicIndustryContacts, eq(dripSequences.contactId, musicIndustryContacts.id))
      .where(
        and(
          eq(dripSequences.status, 'active'),
          lte(dripSequences.nextSendAt, new Date()),
        )
      )
      .limit(effectiveBatch);

    console.log(`[DripEngine] Found ${dueSequences.length} due sequences`);

    for (const { seq, contact } of dueSequences) {
      stats.processed++;

      // Skip if no email or invalid email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!contact.email || !emailRegex.test(contact.email)) {
        await db.update(dripSequences)
          .set({ status: 'cancelled' as any, updatedAt: new Date() })
          .where(eq(dripSequences.id, seq.id));
        // Mark contact with invalid email so we don't retry
        if (contact.email && !emailRegex.test(contact.email)) {
          await db.update(musicIndustryContacts)
            .set({ emailStatus: 'invalid' as any, updatedAt: new Date() })
            .where(eq(musicIndustryContacts.id, contact.id));
        }
        continue;
      }

      // Skip bounced/unsubscribed contacts
      if (contact.status === 'unsubscribed' || contact.status === 'bounced') {
        await db.update(dripSequences)
          .set({ status: 'cancelled' as any, updatedAt: new Date() })
          .where(eq(dripSequences.id, seq.id));
        continue;
      }

      // Get template for current step
      const templates = SEQUENCE_TEMPLATES[seq.sequenceType as SequenceType];
      if (!templates || seq.currentStep >= templates.length) {
        await db.update(dripSequences)
          .set({ status: 'completed' as any, updatedAt: new Date() })
          .where(eq(dripSequences.id, seq.id));
        stats.completed++;
        continue;
      }

      // Build template data
      const magicLinkUrl = generateMagicLink({
        contactId: contact.id,
        email: contact.email,
        name: contact.fullName,
        genre: contact.keywords?.split(',')[0]?.trim(),
        country: contact.country || undefined,
      });

      const templateData: TemplateData = {
        artistName: contact.firstName || contact.fullName.split(' ')[0] || contact.fullName,
        email: contact.email,
        genre: contact.keywords?.split(',')[0]?.trim(),
        country: contact.country || undefined,
        magicLinkUrl,
        landingPageUrl: `${PLATFORM_URL}/artist/${contact.fullName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        unsubscribeUrl: getUnsubscribeUrl(contact.email, contact.id),
      };

      // Render template
      const templateFn = templates[seq.currentStep];
      let { subject, html } = templateFn(templateData);

      // A/B Testing: check for winning subject or assign variant
      let abVariant: string | null = null;
      try {
        // First check if there's already a proven winner for this sequence+step
        const winner = await getWinningSubject(seq.sequenceType as any, seq.currentStep);
        if (winner) {
          subject = winner;
        } else {
          // Try to assign an A/B test variant
          const variant = await getABVariant(seq.sequenceType as any, seq.currentStep);
          if (variant) {
            subject = variant.subject;
            abVariant = variant.variant;
            // Record that this variant was sent
            await recordABEvent(variant.testId, variant.variant as 'A' | 'B', 'sent');
          }
        }
      } catch (err) {
        // Non-critical — continue with original subject
      }

      // AI personalization: try to get custom subject line + opener
      try {
        // Look up AI signals from activation_scores
        const scoreRow = await db.execute(sql`
          SELECT signals FROM activation_scores WHERE contact_id = ${contact.id} LIMIT 1
        `);
        const signals = scoreRow.rows[0]?.signals as Record<string, any> | undefined;

        const personalized = await personalizeEmail({
          id: contact.id,
          fullName: contact.fullName,
          email: contact.email,
          genre: contact.keywords?.split(',')[0]?.trim(),
          country: contact.country,
          keywords: contact.keywords,
          signals,
        }, subject, seq.sequenceType, seq.currentStep);

        if (personalized) {
          if (personalized.subject) subject = personalized.subject;
          if (personalized.opener && html) {
            // Inject opener after the hero section
            html = html.replace('</table><!--hero-end-->', `</table><!--hero-end--><div style="padding:0 24px;color:#e0e0e0;font-size:15px;line-height:1.6;">${personalized.opener}</div>`);
          }
        }
      } catch (err) {
        // Non-critical — continue with original template
      }

      // Ensure subject is never empty — fallback to template default
      if (!subject || subject.trim().length === 0) {
        const fallbackTemplate = templates[seq.currentStep];
        const fallbackRendered = fallbackTemplate(templateData);
        subject = fallbackRendered.subject || `Boostify — Opportunity for ${templateData.artistName}`;
      }

      // Send email
      const result = await sendHtmlEmail(contact.email, subject, html);

      if (result.success) {
        stats.sent++;
        recordEmailSent();

        // Check if we hit the daily limit mid-batch
        if (!canSendEmail()) {
          console.log(`[DripEngine] ⚠️ Daily limit reached mid-batch after ${stats.sent} sends. Stopping.`);
          break;
        }

        // Track event
        await trackEvent(contact.email, 'email_sent', {
          sequenceType: seq.sequenceType,
          step: seq.currentStep,
          subject,
          messageId: result.messageId,
        }, contact.id);

        // Calculate next send time
        const delays = SEQUENCE_DELAYS[seq.sequenceType as SequenceType];
        const nextStep = seq.currentStep + 1;

        if (nextStep >= seq.totalSteps) {
          // Sequence complete
          await db.update(dripSequences)
            .set({
              currentStep: nextStep,
              status: 'completed' as any,
              lastSentAt: new Date(),
              emailsSent: (seq.emailsSent || 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(dripSequences.id, seq.id));
          stats.completed++;
        } else {
          // Schedule next step
          const delayHours = delays[nextStep] - delays[seq.currentStep];
          const nextSendAt = new Date(Date.now() + delayHours * 60 * 60 * 1000);

          await db.update(dripSequences)
            .set({
              currentStep: nextStep,
              nextSendAt,
              lastSentAt: new Date(),
              emailsSent: (seq.emailsSent || 0) + 1,
              updatedAt: new Date(),
            })
            .where(eq(dripSequences.id, seq.id));
        }

        // Update contact record
        await db.update(musicIndustryContacts)
          .set({
            lastContactedAt: new Date(),
            emailsSent: sql`COALESCE(emails_sent, 0) + 1`,
            status: contact.status === 'new' ? 'contacted' as any : undefined,
            updatedAt: new Date(),
          })
          .where(eq(musicIndustryContacts.id, contact.id));

        // Small delay between sends to avoid rate limits
        await new Promise(r => setTimeout(r, 200));
      } else {
        stats.errors++;
        console.error(`[DripEngine] Send failed for ${contact.email}: ${result.error}`);

        // If bounced, mark sequence AND propagate to contact
        if (result.error?.includes('bounce') || result.error?.includes('invalid')) {
          await db.update(dripSequences)
            .set({ status: 'bounced' as any, updatedAt: new Date() })
            .where(eq(dripSequences.id, seq.id));

          // Cancel ALL active sequences for this contact
          await db.update(dripSequences)
            .set({ status: 'cancelled' as any, updatedAt: new Date() })
            .where(and(
              eq(dripSequences.contactId, contact.id),
              eq(dripSequences.status, 'active' as any),
            ));

          // Mark contact as bounced
          await db.update(musicIndustryContacts)
            .set({ status: 'bounced' as any, emailStatus: 'bounced', updatedAt: new Date() })
            .where(eq(musicIndustryContacts.id, contact.id));

          // Track bounce event
          await trackEvent(contact.email, 'email_bounced', {
            reason: result.error,
            sequenceType: seq.sequenceType,
            step: seq.currentStep,
          }, contact.id);
        }
      }
    }
  } catch (err) {
    console.error('[DripEngine] Process queue error:', err);
  }

  console.log(`[DripEngine] Batch done: ${stats.sent} sent, ${stats.errors} errors, ${stats.completed} completed (daily: ${getDailyEmailStats().sent}/${getDailyEmailStats().limit})`);
  return stats;
}

// ─── Auto-enroll new discovery contacts ──────────────────────────

export async function autoEnrollNewContacts(batchSize: number = 200): Promise<number> {
  try {
    // Find contacts that have email but are NOT in any drip sequence
    // Also fetch their score + signals for smart sequence selection
    const result = await db.execute(sql`
      SELECT mic.id, mic.email, mic.full_name,
             COALESCE(a.score, 0) as score,
             COALESCE(a.signals, '{}'::json) as signals,
             mic.opens_count, mic.clicks_count, mic.emails_sent
      FROM music_industry_contacts mic
      LEFT JOIN drip_sequences ds ON ds.contact_id = mic.id
      LEFT JOIN activation_scores a ON a.contact_id = mic.id
      WHERE mic.email IS NOT NULL
        AND mic.email ~ '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$'
        AND mic.status = 'new'
        AND ds.id IS NULL
        AND mic.email_status IS DISTINCT FROM 'bounced'
        AND mic.email_status IS DISTINCT FROM 'invalid'
      ORDER BY COALESCE(a.score, 0) DESC, mic.created_at DESC
      LIMIT ${batchSize}
    `);

    let enrolled = 0;
    for (const row of result.rows) {
      const score = (row.score as number) || 0;
      const signals = (row.signals || {}) as Record<string, any>;
      const tier = score >= 80 ? 'S' : score >= 60 ? 'A' : score >= 40 ? 'B' : score >= 20 ? 'C' : 'D';

      // Smart sequence selection based on score/tier/AI signals
      const sequence = selectOptimalSequence({
        score,
        tier,
        opensCount: (row.opens_count as number) || 0,
        clicksCount: (row.clicks_count as number) || 0,
        emailsSent: (row.emails_sent as number) || 0,
        signals,
      });

      const success = await enrollInSequence(
        row.id as number,
        sequence,
        Math.floor(Math.random() * 60), // Random delay 0-60 min to spread sends
      );
      if (success) enrolled++;
    }

    if (enrolled > 0) {
      console.log(`[DripEngine] Smart-enrolled ${enrolled} new contacts into optimal sequences`);
    }
    return enrolled;
  } catch (err) {
    console.error('[DripEngine] Auto-enroll error:', err);
    return 0;
  }
}

// ─── Get drip stats ──────────────────────────────────────────────

export async function getDripStats() {
  try {
    const [activeResult, byTypeResult, sentResult, completedResult] = await Promise.all([
      db.execute(sql`SELECT count(*) as cnt FROM drip_sequences WHERE status = 'active'`),
      db.execute(sql`SELECT sequence_type, status, count(*) as cnt FROM drip_sequences GROUP BY sequence_type, status ORDER BY sequence_type`),
      db.execute(sql`SELECT count(*) as cnt FROM activation_events WHERE event_type = 'email_sent' AND created_at > NOW() - INTERVAL '7 days'`),
      db.execute(sql`SELECT count(*) as cnt FROM drip_sequences WHERE status = 'completed'`),
    ]);

    return {
      activeSequences: parseInt(activeResult.rows[0]?.cnt as string || '0'),
      byTypeAndStatus: byTypeResult.rows,
      emailsSentThisWeek: parseInt(sentResult.rows[0]?.cnt as string || '0'),
      completedSequences: parseInt(completedResult.rows[0]?.cnt as string || '0'),
    };
  } catch (err) {
    console.error('[DripEngine] Stats error:', err);
    return { activeSequences: 0, byTypeAndStatus: [], emailsSentThisWeek: 0, completedSequences: 0 };
  }
}
