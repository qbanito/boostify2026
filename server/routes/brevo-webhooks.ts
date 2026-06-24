/**
 * Brevo Webhook Routes
 * Handles incoming webhooks from Brevo for email events
 * Webhook URL: https://boostifymusic.com/api/webhooks/brevo
 * 
 * ACTUALIZADO: Usa music_industry_contacts (tabla Drizzle correcta),
 * registra bounces, y conecta eventos al activation scoring.
 */

import express, { Request, Response, Router } from 'express';
import { pool } from '../db';
import { registerBounce } from '../services/email-verification-service.js';

const router: Router = express.Router();

// Lazy import for activation tracker (avoids circular deps)
let _trackEvent: ((email: string, eventType: string, data?: Record<string, any>, contactId?: number) => Promise<void>) | null = null;
async function getTrackEvent() {
  if (!_trackEvent) {
    try {
      const mod = await import('../services/artist-activation/activation-tracker');
      _trackEvent = mod.trackEvent;
    } catch { _trackEvent = async () => {}; }
  }
  return _trackEvent!;
}

// Helper: find contactId from email
async function findContactId(email: string): Promise<number | undefined> {
  try {
    const result = await pool.query(
      `SELECT id FROM music_industry_contacts WHERE LOWER(email) = LOWER($1) LIMIT 1`,
      [email]
    );
    return result.rows[0]?.id;
  } catch { return undefined; }
}

// Brevo webhook event types
interface BrevoWebhookEvent {
  event: 'sent' | 'delivered' | 'request' | 'soft_bounce' | 'hard_bounce' | 'opened' | 'click' | 'spam' | 'unsubscribed' | 'blocked' | 'invalid_email' | 'deferred';
  email: string;
  id: number;
  date: string;
  ts: number;
  'message-id': string;
  subject?: string;
  tag?: string;
  link?: string;
  reason?: string;
}

/**
 * POST /api/webhooks/brevo
 * Main webhook endpoint for Brevo events
 */
router.post('/', express.json(), async (req: Request, res: Response) => {
  try {
    const event: BrevoWebhookEvent = req.body;
    
    console.log(`📧 [Brevo Webhook] Event received: ${event.event} for ${event.email}`);
    
    const trackEvent = await getTrackEvent();
    const contactId = await findContactId(event.email);
    
    switch (event.event) {
      case 'sent':
      case 'request':
        console.log('✅ Email sent successfully');
        break;
        
      case 'delivered':
        console.log('✅ Email delivered to recipient');
        await trackEvent(event.email, 'email_delivered', { messageId: event['message-id'], subject: event.subject }, contactId);
        break;
        
      case 'opened':
        console.log('👀 Email was opened');
        await handleEmailOpened(event.email, event.subject, contactId);
        await trackEvent(event.email, 'email_opened', { messageId: event['message-id'], subject: event.subject }, contactId);
        break;
        
      case 'click':
        console.log(`🔗 Link clicked: ${event.link}`);
        await handleEmailClicked(event.email, event.link, contactId);
        await trackEvent(event.email, 'email_clicked', { messageId: event['message-id'], link: event.link, subject: event.subject }, contactId);
        break;
        
      case 'soft_bounce':
        console.log(`⚠️ Soft bounce: ${event.reason}`);
        await handleSoftBounce(event.email, event.reason || 'Soft bounce');
        break;
        
      case 'hard_bounce':
        console.log(`❌ Hard bounce: ${event.reason}`);
        await handleHardBounce(event.email, event.reason || 'Hard bounce');
        break;
        
      case 'spam':
        console.log('🚫 Email marked as spam');
        await handleSpamComplaint(event.email);
        break;
        
      case 'unsubscribed':
        console.log('📤 User unsubscribed');
        await handleUnsubscribe(event.email);
        break;
        
      case 'blocked':
        console.log(`🚫 Email blocked: ${event.reason}`);
        await handleHardBounce(event.email, `Blocked: ${event.reason}`);
        break;
        
      case 'invalid_email':
        console.log('❌ Invalid email address');
        await handleHardBounce(event.email, 'Invalid email address');
        break;
        
      case 'deferred':
        console.log('⏳ Email deferred');
        break;
        
      default:
        console.log(`ℹ️ Unknown event type: ${event.event}`);
    }
    
    // Always respond with 200 to acknowledge receipt
    res.status(200).json({ received: true, event: event.event });
    
  } catch (error: any) {
    console.error('❌ [Brevo Webhook] Error processing event:', error.message);
    res.status(200).json({ received: true, error: error.message });
  }
});

// === EVENT HANDLERS ===

/**
 * Handle email opened — update opens count and status
 */
async function handleEmailOpened(email: string, subject?: string, contactId?: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE music_industry_contacts 
      SET opens_count = COALESCE(opens_count, 0) + 1,
          status = CASE WHEN status IN ('new', 'contacted', 'queued') THEN 'opened' ELSE status END,
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    console.log(`   👀 Opens count updated for ${email}`);
  } catch (error) {
    console.log(`   ⚠️ Could not update open count for ${email}`);
  } finally {
    client.release();
  }
}

/**
 * Handle email click — update clicks count and status
 */
async function handleEmailClicked(email: string, link?: string, contactId?: number): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      UPDATE music_industry_contacts 
      SET clicks_count = COALESCE(clicks_count, 0) + 1,
          status = CASE WHEN status IN ('new', 'contacted', 'queued', 'opened') THEN 'clicked' ELSE status END,
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    console.log(`   🔗 Clicks count updated for ${email}`);
  } catch (error) {
    console.log(`   ⚠️ Could not update click count for ${email}`);
  } finally {
    client.release();
  }
}

// === BOUNCE HANDLERS ===

/**
 * Handle hard bounce - email doesn't exist
 */
async function handleHardBounce(email: string, reason: string): Promise<void> {
  console.log(`📛 HANDLING HARD BOUNCE: ${email}`);
  
  // 1. Register in memory for future verifications
  registerBounce(email);
  
  // 2. Update database — use correct table: music_industry_contacts
  const client = await pool.connect();
  try {
    // Update music_industry_contacts (main contacts table)
    await client.query(`
      UPDATE music_industry_contacts 
      SET status = 'bounced',
          email_status = 'bounced',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    // Cancel any active drip sequences for this contact
    await client.query(`
      UPDATE drip_sequences 
      SET status = 'bounced',
          updated_at = NOW()
      WHERE contact_id IN (
        SELECT id FROM music_industry_contacts WHERE LOWER(email) = LOWER($1)
      ) AND status = 'active'
    `, [email]).catch(() => {});
    
    // Update investor_leads if exists
    await client.query(`
      UPDATE investor_leads 
      SET status = 'bounced',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]).catch(() => {});
    
    console.log(`   ✅ Database updated for ${email}`);
  } catch (error) {
    console.log(`   ⚠️ Could not update all tables for bounce`);
  } finally {
    client.release();
  }
}

/**
 * Handle soft bounce - temporary delivery failure
 */
async function handleSoftBounce(email: string, reason: string): Promise<void> {
  console.log(`⚠️ HANDLING SOFT BOUNCE: ${email}`);
  
  const client = await pool.connect();
  try {
    // Count previous soft bounces from activation_events
    const result = await client.query(`
      SELECT COUNT(*) as count FROM activation_events 
      WHERE LOWER(email) = LOWER($1) AND event_type = 'email_soft_bounce'
      AND created_at > NOW() - INTERVAL '7 days'
    `, [email]).catch(() => ({ rows: [{ count: '0' }] }));
    
    const previousCount = parseInt(result.rows[0]?.count || '0');
    
    // If 3+ soft bounces in a week, treat as hard bounce
    if (previousCount >= 2) {
      console.log(`   ⚠️ 3rd soft bounce in 7 days, treating as hard bounce`);
      await handleHardBounce(email, '3 consecutive soft bounces');
      return;
    }
    
    // Track soft bounce event
    const trackEvent = await getTrackEvent();
    const contactId = await findContactId(email);
    await trackEvent(email, 'email_soft_bounce', { reason }, contactId);
    
    console.log(`   📊 Soft bounce logged (${previousCount + 1}/3)`);
  } catch (error) {
    console.log(`   ⚠️ Could not log soft bounce`);
  } finally {
    client.release();
  }
}

/**
 * Handle spam complaint - never send again
 */
async function handleSpamComplaint(email: string): Promise<void> {
  console.log(`🔴 HANDLING SPAM COMPLAINT: ${email}`);
  
  // Register as bounce to never send again
  registerBounce(email);
  
  const client = await pool.connect();
  try {
    // Update music_industry_contacts
    await client.query(`
      UPDATE music_industry_contacts 
      SET status = 'unsubscribed',
          email_status = 'spam',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    // Cancel drip sequences
    await client.query(`
      UPDATE drip_sequences 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE contact_id IN (
        SELECT id FROM music_industry_contacts WHERE LOWER(email) = LOWER($1)
      ) AND status = 'active'
    `, [email]).catch(() => {});
    
    await client.query(`
      UPDATE investor_leads 
      SET status = 'spam_complaint',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]).catch(() => {});
    
    console.log(`   ✅ Marked as spam complaint, drip sequences cancelled`);
  } catch (error) {
    console.log(`   ⚠️ Partial update`);
  } finally {
    client.release();
  }
}

/**
 * Handle unsubscribe
 */
async function handleUnsubscribe(email: string): Promise<void> {
  console.log(`📭 HANDLING UNSUBSCRIBE: ${email}`);
  
  const client = await pool.connect();
  try {
    // Update music_industry_contacts
    await client.query(`
      UPDATE music_industry_contacts 
      SET status = 'unsubscribed',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]);
    
    // Cancel active drip sequences
    await client.query(`
      UPDATE drip_sequences 
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE contact_id IN (
        SELECT id FROM music_industry_contacts WHERE LOWER(email) = LOWER($1)
      ) AND status = 'active'
    `, [email]).catch(() => {});
    
    await client.query(`
      UPDATE investor_leads 
      SET status = 'unsubscribed',
          updated_at = NOW()
      WHERE LOWER(email) = LOWER($1)
    `, [email]).catch(() => {});
    
    console.log(`   ✅ Marked as unsubscribed, drip sequences cancelled`);
  } catch (error) {
    console.log(`   ⚠️ Partial update`);
  } finally {
    client.release();
  }
}

/**
 * GET /api/webhooks/brevo/health
 * Health check endpoint for webhook
 */
router.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'brevo-webhooks',
    timestamp: new Date().toISOString(),
    webhookUrl: 'https://boostifymusic.com/api/webhooks/brevo'
  });
});

// ──────────────────────────────────────────────────────────────
// Inbound parsing — replies received on monitored addresses
// Brevo "Inbound Parsing" posts JSON to this endpoint. Shape:
//   { items: [ { From, To, Subject, RawHtmlBody, RawTextBody,
//                MessageId, InReplyTo, Headers, ... } ] }
// Docs: https://developers.brevo.com/docs/inbound-parse-webhooks
// ──────────────────────────────────────────────────────────────
router.post('/inbound', express.json({ limit: '10mb' }), async (req: Request, res: Response) => {
  try {
    const { recordInboundMessage } = await import('../services/aas-audit');
    const body = req.body || {};
    const items: any[] = Array.isArray(body.items) ? body.items : [body];
    let saved = 0;

    for (const it of items) {
      const from = it.From || it.from || {};
      const toArr = it.To || it.to || [];
      const fromEmail = (typeof from === 'string' ? from : from.Address || from.address || from.email || '').toLowerCase();
      if (!fromEmail) continue;
      const fromName = typeof from === 'object' ? (from.Name || from.name || null) : null;
      const toEmail = Array.isArray(toArr)
        ? (typeof toArr[0] === 'string' ? toArr[0] : toArr[0]?.Address || toArr[0]?.address || null)
        : (typeof toArr === 'string' ? toArr : null);

      const contactId = await findContactId(fromEmail);
      await recordInboundMessage({
        provider: 'brevo',
        fromEmail,
        fromName,
        toEmail,
        subject: it.Subject || it.subject || null,
        text: it.RawTextBody || it.ExtractedTextBody || it.text || null,
        html: it.RawHtmlBody || it.html || null,
        messageId: it.MessageId || it['Message-Id'] || null,
        inReplyTo: it.InReplyTo || it['In-Reply-To'] || null,
        contactId: contactId ?? null,
        receivedAt: new Date(it.SentAtDate || Date.now()).toISOString(),
        raw: { headers: it.Headers || null, attachments: it.Attachments?.length || 0 },
      });
      saved++;

      // Track reply in activation-tracker so scoring picks it up
      try {
        const trackEvent = await getTrackEvent();
        await trackEvent(fromEmail, 'email_replied', {
          subject: it.Subject || null,
          messageId: it.MessageId || null,
          provider: 'brevo',
        }, contactId);
      } catch { /* non-fatal */ }

      // Mark contact as "replied"
      try {
        await pool.query(`
          UPDATE music_industry_contacts
          SET status = CASE WHEN status IN ('new','contacted','queued','opened','clicked') THEN 'responded' ELSE status END,
              updated_at = NOW()
          WHERE LOWER(email) = LOWER($1)
        `, [fromEmail]);
      } catch { /* non-fatal */ }
    }

    res.status(200).json({ received: true, saved });
  } catch (error: any) {
    console.error('❌ [Brevo Inbound] Error:', error.message);
    res.status(200).json({ received: true, error: error.message });
  }
});

export default router;
