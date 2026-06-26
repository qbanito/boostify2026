/**
 * Admin — Email Command Center
 * ════════════════════════════════════════════════════════════════════════
 * Absolute control + observability over EVERY automated email the platform
 * sends (in-app outreach senders) and that GitHub Actions sends (cron
 * campaigns via scripts/email-smart-router.cjs). Aggregates:
 *   - Today's sends per provider + the global daily ceiling (email_daily_limits)
 *   - 7-day send trend
 *   - Deliverability funnel (sent → opened → clicked → replied → bounced)
 *   - Sending-domain / account pool health
 *   - Reply inbox (auto-captured via Resend inbound + manual) with status
 *   - A kill switch (global + per-channel) honored by senders
 *   - An AI analyst that recommends improvements
 *
 * Mounted at /api/admin/email-command (requireAdmin).
 */

import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../middleware/require-admin';
import { outreachPoolSize } from '../services/artist-activation/outreach-email';
import { getEmailControls, setEmailControls, ensureControlsTable } from '../services/email-controls';
import { analyzeEmailOps, type EmailOpsMetrics } from '../services/email-ops-analyst';

const router = Router();
router.use(requireAdmin);

const GLOBAL_DAILY_TARGET = Number(process.env.DAILY_SEND_TARGET || 700);

const REPLY_STATUSES = ['new', 'read', 'replied', 'won', 'lost'] as const;
type ReplyStatus = (typeof REPLY_STATUSES)[number];

// Static descriptor of the automated GitHub-Actions campaigns so the dashboard
// can show WHAT is scheduled (the cron lives in .github/workflows/*.yml).
const AUTOMATED_CAMPAIGNS = [
  { id: 'multi-campaign-warmup', name: 'Multi-Campaign Warmup', schedule: '5×/día (14,16,18,20,22 UTC)', audience: 'Industria + Artistas', provider: 'Brevo + Resend', channel: 'warmup' },
  { id: 'boostify-promo', name: 'Boostify Promo', schedule: 'Lun/Mié/Vie 14:00 UTC', audience: 'Industria', provider: 'Brevo', channel: 'promo' },
  { id: 'news-blast', name: 'News Blast', schedule: 'Mar/Mié/Jue', audience: 'Artistas/Industria/Inversores', provider: 'Brevo + Resend', channel: 'news' },
  { id: 'artist-press', name: 'Artist Press', schedule: 'Lun–Vie (escalonado)', audience: 'Industria', provider: 'Brevo', channel: 'press' },
  { id: 'artist-tools-promo', name: 'Artist Tools Promo', schedule: 'Lun–Sáb 16:00 UTC', audience: 'Artistas', provider: 'Resend', channel: 'tools' },
  { id: 'music-video-sequence', name: 'Music Video Sequence', schedule: 'Lun/Jue 15:00 UTC', audience: 'Artistas', provider: 'Brevo', channel: 'music-video' },
  { id: 'boostiswap-sequence', name: 'BoostiSwap Sequence', schedule: 'Mar/Vie 15:00 UTC', audience: 'Artistas', provider: 'Brevo', channel: 'boostiswap' },
  { id: 'youtube-views-sequence', name: 'YouTube Views Sequence', schedule: 'Mié/Sáb 15:00 UTC', audience: 'Artistas', provider: 'Brevo', channel: 'youtube' },
  { id: 'artist-email-sequence', name: 'Artist Email Sequence', schedule: 'Manual', audience: 'Artistas', provider: 'Resend', channel: 'sequence' },
];

async function ensureRepliesTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS email_replies (
      id           SERIAL PRIMARY KEY,
      from_email   TEXT NOT NULL,
      from_name    TEXT,
      to_email     TEXT,
      subject      TEXT,
      body         TEXT,
      provider     TEXT,
      lead_handle  TEXT,
      status       TEXT NOT NULL DEFAULT 'new',
      received_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      raw          JSONB
    )
  `);
}

function rowsOf(res: any): any[] {
  return (res?.rows || res || []) as any[];
}

/** Best-effort numeric reader for a single-value query (returns 0 on any error). */
async function safeCount(query: any): Promise<number> {
  try {
    const res: any = await db.execute(query);
    const row = rowsOf(res)[0] || {};
    const v = row.count ?? row.total ?? row.n ?? Object.values(row)[0];
    return Number(v) || 0;
  } catch {
    return 0;
  }
}

// ─── Overview ────────────────────────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    await Promise.all([ensureControlsTable(), ensureRepliesTable()]);

    const today = new Date().toISOString().slice(0, 10);

    // Providers today + global ceiling (from email_daily_limits — shared with GH Actions router)
    let providersToday: { provider: string; sent: number }[] = [];
    let sentToday = 0;
    try {
      const res: any = await db.execute(sql`SELECT provider, sent FROM email_daily_limits WHERE date = ${today} ORDER BY sent DESC`);
      providersToday = rowsOf(res).map((r) => ({ provider: String(r.provider), sent: Number(r.sent) || 0 }));
      sentToday = providersToday.reduce((a, b) => a + b.sent, 0);
    } catch { /* table may not exist yet */ }

    // 7-day trend
    let last7Days: { date: string; sent: number }[] = [];
    try {
      const res: any = await db.execute(sql`
        SELECT date::text AS date, COALESCE(SUM(sent),0) AS sent
        FROM email_daily_limits
        WHERE date >= (CURRENT_DATE - INTERVAL '6 days')
        GROUP BY date ORDER BY date ASC
      `);
      last7Days = rowsOf(res).map((r) => ({ date: String(r.date), sent: Number(r.sent) || 0 }));
    } catch { /* ignore */ }

    // Deliverability funnel (outreach_email_log — may not exist; degrade to zeros)
    const funnel = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
    try {
      const res: any = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked','replied')) AS sent,
          COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
          COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
          COUNT(*) FILTER (WHERE replied_at IS NOT NULL) AS replied,
          COUNT(*) FILTER (WHERE bounced_at IS NOT NULL) AS bounced
        FROM outreach_email_log
        WHERE created_at >= (NOW() - INTERVAL '30 days')
      `);
      const r = rowsOf(res)[0] || {};
      funnel.sent = Number(r.sent) || 0;
      funnel.opened = Number(r.opened) || 0;
      funnel.clicked = Number(r.clicked) || 0;
      funnel.replied = Number(r.replied) || 0;
      funnel.bounced = Number(r.bounced) || 0;
    } catch { /* ignore */ }

    // Sending-domain pool health
    let activeDomains = 0, pendingDomains = 0;
    try {
      const res: any = await db.execute(sql`SELECT status, COUNT(*) AS n FROM outreach_sending_domains GROUP BY status`);
      for (const row of rowsOf(res)) {
        if (row.status === 'active') activeDomains = Number(row.n) || 0;
        else if (row.status === 'pending' || row.status === 'provisioning') pendingDomains += Number(row.n) || 0;
      }
    } catch { /* ignore */ }

    // Instagram lead funnel (quick numbers)
    const leads = { total: 0, ready: 0, sent: 0, claimed: 0 };
    try {
      const res: any = await db.execute(sql`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE dm_status = 'ready') AS ready,
          COUNT(*) FILTER (WHERE dm_status = 'sent') AS sent,
          COUNT(*) FILTER (WHERE dm_status = 'claimed') AS claimed
        FROM instagram_leads
      `);
      const r = rowsOf(res)[0] || {};
      leads.total = Number(r.total) || 0;
      leads.ready = Number(r.ready) || 0;
      leads.sent = Number(r.sent) || 0;
      leads.claimed = Number(r.claimed) || 0;
    } catch { /* ignore */ }

    // Replies summary
    const replies = { total: 0, new: 0, read: 0, replied: 0, won: 0, lost: 0 };
    try {
      const res: any = await db.execute(sql`SELECT status, COUNT(*) AS n FROM email_replies GROUP BY status`);
      for (const row of rowsOf(res)) {
        const n = Number(row.n) || 0;
        replies.total += n;
        if (row.status in replies) (replies as any)[row.status] = n;
      }
    } catch { /* ignore */ }

    const controls = await getEmailControls(true);
    const pausedChannels = Object.keys(controls.channels).filter((c) => controls.channels[c]);

    res.json({
      success: true,
      ceiling: { target: GLOBAL_DAILY_TARGET, sentToday, remaining: Math.max(GLOBAL_DAILY_TARGET - sentToday, 0) },
      providersToday,
      last7Days,
      funnel,
      pool: { activeAccounts: outreachPoolSize(), activeDomains, pendingDomains },
      leads,
      replies,
      controls: { global: controls.global, channels: controls.channels, pausedChannels, updatedAt: controls.updatedAt },
      campaigns: AUTOMATED_CAMPAIGNS,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'overview_failed' });
  }
});

// ─── Kill switch (global + per-channel) ──────────────────────────────────────
router.post('/controls', async (req: Request, res: Response) => {
  try {
    const { global: globalPause, channel, paused } = req.body || {};
    const next: any = {};
    if (typeof globalPause === 'boolean') next.global = globalPause;
    if (typeof channel === 'string' && typeof paused === 'boolean') next.channels = { [channel]: paused };
    if (!('global' in next) && !('channels' in next)) {
      return res.status(400).json({ success: false, error: 'nothing_to_update' });
    }
    const updated = await setEmailControls(next);
    res.json({ success: true, controls: updated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'controls_failed' });
  }
});

// ─── Replies inbox ───────────────────────────────────────────────────────────
router.get('/replies', async (req: Request, res: Response) => {
  try {
    await ensureRepliesTable();
    const status = String(req.query.status || 'all');
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    let rows: any[] = [];
    if (status === 'all') {
      const r: any = await db.execute(sql`SELECT * FROM email_replies ORDER BY received_at DESC LIMIT ${limit}`);
      rows = rowsOf(r);
    } else {
      const r: any = await db.execute(sql`SELECT * FROM email_replies WHERE status = ${status} ORDER BY received_at DESC LIMIT ${limit}`);
      rows = rowsOf(r);
    }
    res.json({ success: true, replies: rows });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'replies_failed' });
  }
});

router.post('/replies/:id/status', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '');
    if (!Number.isFinite(id) || !REPLY_STATUSES.includes(status as ReplyStatus)) {
      return res.status(400).json({ success: false, error: 'invalid_status' });
    }
    await ensureRepliesTable();
    await db.execute(sql`UPDATE email_replies SET status = ${status} WHERE id = ${id}`);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'update_failed' });
  }
});

// Manual reply logging (when a reply is handled outside the auto-capture path)
router.post('/replies', async (req: Request, res: Response) => {
  try {
    const { fromEmail, fromName, subject, body, provider, leadHandle } = req.body || {};
    if (!fromEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fromEmail))) {
      return res.status(400).json({ success: false, error: 'invalid_from_email' });
    }
    await ensureRepliesTable();
    await db.execute(sql`
      INSERT INTO email_replies (from_email, from_name, subject, body, provider, lead_handle)
      VALUES (${String(fromEmail).toLowerCase()}, ${fromName || null}, ${subject || null}, ${body || null}, ${provider || 'manual'}, ${leadHandle || null})
    `);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'create_failed' });
  }
});

// ─── AI analyst ──────────────────────────────────────────────────────────────
async function buildMetrics(): Promise<EmailOpsMetrics> {
  const today = new Date().toISOString().slice(0, 10);
  let providersToday: { provider: string; sent: number }[] = [];
  let sentToday = 0;
  try {
    const r: any = await db.execute(sql`SELECT provider, sent FROM email_daily_limits WHERE date = ${today}`);
    providersToday = rowsOf(r).map((x) => ({ provider: String(x.provider), sent: Number(x.sent) || 0 }));
    sentToday = providersToday.reduce((a, b) => a + b.sent, 0);
  } catch { /* ignore */ }

  let last7Days: { date: string; sent: number }[] = [];
  try {
    const r: any = await db.execute(sql`
      SELECT date::text AS date, COALESCE(SUM(sent),0) AS sent FROM email_daily_limits
      WHERE date >= (CURRENT_DATE - INTERVAL '6 days') GROUP BY date ORDER BY date ASC`);
    last7Days = rowsOf(r).map((x) => ({ date: String(x.date), sent: Number(x.sent) || 0 }));
  } catch { /* ignore */ }

  const funnel = { sent: 0, opened: 0, clicked: 0, replied: 0, bounced: 0 };
  try {
    const r: any = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE status IN ('sent','opened','clicked','replied')) AS sent,
        COUNT(*) FILTER (WHERE opened_at IS NOT NULL) AS opened,
        COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) AS clicked,
        COUNT(*) FILTER (WHERE replied_at IS NOT NULL) AS replied,
        COUNT(*) FILTER (WHERE bounced_at IS NOT NULL) AS bounced
      FROM outreach_email_log WHERE created_at >= (NOW() - INTERVAL '30 days')`);
    const x = rowsOf(r)[0] || {};
    funnel.sent = Number(x.sent) || 0; funnel.opened = Number(x.opened) || 0;
    funnel.clicked = Number(x.clicked) || 0; funnel.replied = Number(x.replied) || 0;
    funnel.bounced = Number(x.bounced) || 0;
  } catch { /* ignore */ }

  let activeDomains = 0, pendingDomains = 0;
  try {
    const r: any = await db.execute(sql`SELECT status, COUNT(*) AS n FROM outreach_sending_domains GROUP BY status`);
    for (const row of rowsOf(r)) {
      if (row.status === 'active') activeDomains = Number(row.n) || 0;
      else if (row.status === 'pending' || row.status === 'provisioning') pendingDomains += Number(row.n) || 0;
    }
  } catch { /* ignore */ }

  const leads = { total: 0, ready: 0, sent: 0, claimed: 0 };
  try {
    const r: any = await db.execute(sql`
      SELECT COUNT(*) AS total,
        COUNT(*) FILTER (WHERE dm_status='ready') AS ready,
        COUNT(*) FILTER (WHERE dm_status='sent') AS sent,
        COUNT(*) FILTER (WHERE dm_status='claimed') AS claimed
      FROM instagram_leads`);
    const x = rowsOf(r)[0] || {};
    leads.total = Number(x.total) || 0; leads.ready = Number(x.ready) || 0;
    leads.sent = Number(x.sent) || 0; leads.claimed = Number(x.claimed) || 0;
  } catch { /* ignore */ }

  const replies = { total: 0, new: 0, replied: 0, won: 0, lost: 0 };
  try {
    const r: any = await db.execute(sql`SELECT status, COUNT(*) AS n FROM email_replies GROUP BY status`);
    for (const row of rowsOf(r)) {
      const n = Number(row.n) || 0; replies.total += n;
      if (row.status === 'new') replies.new = n;
      else if (row.status === 'replied') replies.replied = n;
      else if (row.status === 'won') replies.won = n;
      else if (row.status === 'lost') replies.lost = n;
    }
  } catch { /* ignore */ }

  const controls = await getEmailControls(true);
  const pausedChannels = Object.keys(controls.channels).filter((c) => controls.channels[c]);

  return {
    ceiling: { target: GLOBAL_DAILY_TARGET, sentToday, remaining: Math.max(GLOBAL_DAILY_TARGET - sentToday, 0) },
    providersToday,
    last7Days,
    funnel,
    pool: { activeAccounts: outreachPoolSize(), activeDomains, pendingDomains },
    replies,
    leads,
    paused: { global: controls.global, channels: pausedChannels },
  };
}

router.post('/analyze', async (_req: Request, res: Response) => {
  try {
    const metrics = await buildMetrics();
    const analysis = await analyzeEmailOps(metrics);
    // Cache last analysis in settings for instant reload
    try {
      await ensureControlsTable();
      await db.execute(sql`
        INSERT INTO email_command_settings (key, value, updated_at)
        VALUES ('last_analysis', ${JSON.stringify(analysis)}::jsonb, NOW())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `);
    } catch { /* ignore cache failure */ }
    res.json({ success: true, analysis, metrics });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'analyze_failed' });
  }
});

router.get('/analysis', async (_req: Request, res: Response) => {
  try {
    await ensureControlsTable();
    const r: any = await db.execute(sql`SELECT value, updated_at FROM email_command_settings WHERE key = 'last_analysis' LIMIT 1`);
    const row = rowsOf(r)[0];
    res.json({ success: true, analysis: row?.value || null, updatedAt: row?.updated_at || null });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e?.message || 'analysis_failed' });
  }
});

export default router;
