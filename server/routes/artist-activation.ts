/**
 * Artist Activation API Routes
 * Admin endpoints + public magic link handler + unsubscribe
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { musicIndustryContacts, dripSequences, activationScores } from '../db/schema';
import { eq, sql, and } from 'drizzle-orm';
import {
  getFullActivationDashboard,
  processActivationTick,
  startActivationScheduler,
  stopActivationScheduler,
  isActivationSchedulerRunning,
  isActivationProcessing,
  getActivationRunHistory,
  enrollInSequence,
  trackEvent,
  verifyMagicLink,
  verifyUnsubscribeToken,
  getHotLeads,
  autoEnrollNewContacts,
} from '../services/artist-activation';

const router = Router();

// ═══════════════════════════════════════════════════════════════
// PUBLIC ENDPOINTS (no auth required)
// ═══════════════════════════════════════════════════════════════

// GET /api/artist-activation/magic?token=xxx — Magic link handler
router.get('/magic', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.redirect('/?error=invalid_link');
    }

    const payload = verifyMagicLink(token);
    if (!payload) {
      return res.redirect('/?error=expired_link');
    }

    // Track magic link click
    await trackEvent(payload.email, 'magic_link_clicked', {
      contactId: payload.contactId,
      name: payload.name,
    }, payload.contactId);

    // Redirect to signup/onboarding with pre-filled data
    const params = new URLSearchParams({
      email: payload.email,
      name: payload.name,
      ...(payload.genre ? { genre: payload.genre } : {}),
      ...(payload.country ? { country: payload.country } : {}),
      ...(payload.spotifyUrl ? { spotify: payload.spotifyUrl } : {}),
      ...(payload.instagramHandle ? { instagram: payload.instagramHandle } : {}),
      source: 'magic_link',
    });

    res.redirect(`/artist-setup?${params.toString()}`);
  } catch (err: any) {
    console.error('[Activation] Magic link error:', err);
    res.redirect('/?error=link_error');
  }
});

// GET /api/artist-activation/unsubscribe?token=xxx
router.get('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).send(unsubscribePage(false, 'Invalid link'));
    }

    const data = verifyUnsubscribeToken(token);
    if (!data) {
      return res.status(400).send(unsubscribePage(false, 'Expired link'));
    }

    // Mark contact as unsubscribed
    await db.update(musicIndustryContacts)
      .set({ status: 'unsubscribed' as any, updatedAt: new Date() })
      .where(eq(musicIndustryContacts.id, data.contactId));

    // Cancel all active drip sequences
    await db.update(dripSequences)
      .set({ status: 'cancelled' as any, updatedAt: new Date() })
      .where(eq(dripSequences.contactId, data.contactId));

    await trackEvent(data.email, 'email_bounced', { reason: 'unsubscribed' }, data.contactId);

    res.send(unsubscribePage(true));
  } catch (err: any) {
    console.error('[Activation] Unsubscribe error:', err);
    res.status(500).send(unsubscribePage(false, 'Server error'));
  }
});

// ═══════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (auth required via Clerk middleware)
// ═══════════════════════════════════════════════════════════════

// GET /api/admin/artist-activation/dashboard
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const data = await getFullActivationDashboard();
    res.json({ ok: true, ...data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/artist-activation/run — Manual trigger
router.post('/run', async (_req: Request, res: Response) => {
  try {
    if (isActivationProcessing()) {
      return res.status(409).json({ ok: false, error: 'Activation tick already in progress' });
    }
    res.json({ ok: true, message: 'Activation tick started' });
    processActivationTick().catch(err => console.error('[Activation] Manual run error:', err));
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/artist-activation/enroll-new — Force enroll new contacts
router.post('/enroll-new', async (_req: Request, res: Response) => {
  try {
    const count = await autoEnrollNewContacts(500);
    res.json({ ok: true, enrolled: count });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /api/admin/artist-activation/scheduler/start
router.post('/scheduler/start', async (_req: Request, res: Response) => {
  startActivationScheduler();
  res.json({ ok: true, running: true });
});

// POST /api/admin/artist-activation/scheduler/stop
router.post('/scheduler/stop', async (_req: Request, res: Response) => {
  stopActivationScheduler();
  res.json({ ok: true, running: false });
});

// GET /api/admin/artist-activation/history
router.get('/history', async (_req: Request, res: Response) => {
  res.json({ ok: true, runs: getActivationRunHistory().slice(0, 50) });
});

// GET /api/admin/artist-activation/hot-leads
router.get('/hot-leads', async (_req: Request, res: Response) => {
  try {
    const leads = await getHotLeads(60, 100);
    res.json({ ok: true, leads });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/artist-activation/daily-email-stats — Current daily sending limits
router.get('/daily-email-stats', async (_req: Request, res: Response) => {
  try {
    const { getDailyEmailStats } = await import('../services/artist-activation/drip-engine');
    const stats = getDailyEmailStats();
    
    // Also get today's actual sends from DB
    const dbResult = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM activation_events 
      WHERE event_type = 'email_sent' 
      AND created_at::date = CURRENT_DATE
    `);
    const dbSentToday = parseInt(dbResult.rows[0]?.cnt as string || '0');
    
    res.json({ 
      ok: true, 
      daily: stats,
      dbSentToday,
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/artist-activation/email-activity — Recent email events for monitoring
router.get('/email-activity', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const eventType = req.query.type as string; // filter: email_opened, email_clicked, etc.
    
    let query;
    if (eventType) {
      query = sql`
        SELECT ae.*, mic.full_name, mic.email as contact_email, mic.country
        FROM activation_events ae
        LEFT JOIN music_industry_contacts mic ON mic.id = ae.contact_id
        WHERE ae.event_type = ${eventType}
        ORDER BY ae.created_at DESC
        LIMIT ${limit}
      `;
    } else {
      query = sql`
        SELECT ae.*, mic.full_name, mic.email as contact_email, mic.country
        FROM activation_events ae
        LEFT JOIN music_industry_contacts mic ON mic.id = ae.contact_id
        WHERE ae.event_type IN ('email_sent', 'email_opened', 'email_clicked', 'email_delivered', 'email_soft_bounce', 'magic_link_clicked')
        ORDER BY ae.created_at DESC
        LIMIT ${limit}
      `;
    }
    
    const result = await db.execute(query);
    res.json({ ok: true, events: result.rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// GET /api/admin/artist-activation/responded — Contacts that clicked/engaged heavily (replied proxy)
router.get('/responded', async (_req: Request, res: Response) => {
  try {
    const result = await db.execute(sql`
      SELECT mic.id, mic.full_name, mic.email, mic.country, mic.status,
             mic.opens_count, mic.clicks_count, mic.last_contacted_at,
             asc2.score, asc2.segment, asc2.signals, asc2.last_activity_at
      FROM music_industry_contacts mic
      INNER JOIN activation_scores asc2 ON LOWER(asc2.email) = LOWER(mic.email)
      WHERE asc2.score >= 30
        AND mic.status NOT IN ('bounced', 'unsubscribed')
      ORDER BY asc2.score DESC, asc2.last_activity_at DESC
      LIMIT 100
    `);
    res.json({ ok: true, contacts: result.rows });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// BREVO WEBHOOK — Real-time email events (opens, clicks, bounces)
// Configure in Brevo: Settings → Webhooks → URL: https://yoursite.com/api/artist-activation/webhook/brevo
// ═══════════════════════════════════════════════════════════════

router.post('/webhook/brevo', async (req: Request, res: Response) => {
  try {
    const event = req.body;
    if (!event || !event.email) {
      return res.status(200).json({ ok: true }); // Acknowledge but ignore
    }

    const email = (event.email as string).toLowerCase();
    const brevoEvent = event.event as string; // delivered, opened, click, hard_bounce, soft_bounce, spam, unsubscribed

    // Map Brevo event types to our event types
    const eventMap: Record<string, string> = {
      delivered: 'email_delivered',
      opened: 'email_opened',
      click: 'email_clicked',
      hard_bounce: 'email_bounced',
      soft_bounce: 'email_soft_bounce',
      spam: 'email_bounced',
      unsubscribed: 'email_bounced',
    };

    const ourEventType = eventMap[brevoEvent];
    if (!ourEventType) {
      return res.status(200).json({ ok: true }); // Unknown event, acknowledge
    }

    // Find the contact by email
    const contacts = await db.select({ id: musicIndustryContacts.id })
      .from(musicIndustryContacts)
      .where(sql`LOWER(${musicIndustryContacts.email}) = ${email}`)
      .limit(1);

    const contactId = contacts[0]?.id;

    // Track the event (this also updates the score via activation-tracker)
    await trackEvent(email, ourEventType, {
      brevoEvent,
      timestamp: event.date || new Date().toISOString(),
      messageId: event['message-id'],
      link: event.link, // For click events
      ip: event.ip,
    }, contactId);

    // Update contact engagement counters
    if (contactId) {
      if (brevoEvent === 'opened') {
        await db.update(musicIndustryContacts)
          .set({
            opensCount: sql`COALESCE(opens_count, 0) + 1`,
            status: sql`CASE WHEN status = 'contacted' THEN 'opened' ELSE status END` as any,
            updatedAt: new Date(),
          })
          .where(eq(musicIndustryContacts.id, contactId));
      } else if (brevoEvent === 'click') {
        await db.update(musicIndustryContacts)
          .set({
            clicksCount: sql`COALESCE(clicks_count, 0) + 1`,
            status: sql`CASE WHEN status IN ('contacted', 'opened') THEN 'clicked' ELSE status END` as any,
            updatedAt: new Date(),
          })
          .where(eq(musicIndustryContacts.id, contactId));
      } else if (brevoEvent === 'hard_bounce' || brevoEvent === 'spam') {
        // Hard bounce or spam → mark contact as bounced, cancel sequences
        await db.update(musicIndustryContacts)
          .set({ status: 'bounced' as any, emailStatus: 'bounced', updatedAt: new Date() })
          .where(eq(musicIndustryContacts.id, contactId));
        await db.update(dripSequences)
          .set({ status: 'cancelled' as any, updatedAt: new Date() })
          .where(and(
            eq(dripSequences.contactId, contactId),
            eq(dripSequences.status, 'active' as any),
          ));
      } else if (brevoEvent === 'unsubscribed') {
        await db.update(musicIndustryContacts)
          .set({ status: 'unsubscribed' as any, updatedAt: new Date() })
          .where(eq(musicIndustryContacts.id, contactId));
        await db.update(dripSequences)
          .set({ status: 'cancelled' as any, updatedAt: new Date() })
          .where(and(
            eq(dripSequences.contactId, contactId),
            eq(dripSequences.status, 'active' as any),
          ));
      }
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[Activation] Brevo webhook error:', err);
    res.status(200).json({ ok: true }); // Always 200 for webhooks to prevent retries
  }
});

// ═══════════════════════════════════════════════════════════════
// Unsubscribe HTML page
// ═══════════════════════════════════════════════════════════════

function unsubscribePage(success: boolean, error?: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Boostify — Unsubscribe</title>
<style>body{margin:0;padding:40px 20px;font-family:system-ui;background:#0a0a0a;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;}
.card{background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:16px;padding:40px;max-width:500px;text-align:center;}
h1{background:linear-gradient(90deg,#8B5CF6,#EC4899);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:28px;}
p{color:#a0a0a0;font-size:16px;line-height:1.6;}</style>
</head><body><div class="card">
<h1>🎵 Boostify Music</h1>
${success
  ? '<p>You have been unsubscribed. We\'re sorry to see you go!</p><p style="color:#6b7280;font-size:13px;">You can always come back at <a href="https://boostifymusic.com" style="color:#8B5CF6;">boostifymusic.com</a></p>'
  : `<p>Something went wrong: ${error || 'Unknown error'}</p>`
}
</div></body></html>`;
}

export default router;
