/**
 * Public — Inbound Email Webhook (reply capture)
 * ════════════════════════════════════════════════════════════════════════
 * Receives inbound emails forwarded by Resend (or any provider configured to
 * POST here) and records them in `email_replies` so the admin Email Command
 * Center can show "clientes que respondieron" and let you manage follow-up.
 *
 * Mounted PUBLIC at /api/email-inbound (path ends in /webhook so it bypasses
 * auth + rate-limiting, same as the other provider webhooks).
 *
 * To activate: in Resend, set the inbound/forwarding destination of the cold
 * outreach domains to POST to https://boostifymusic.com/api/email-inbound/webhook
 */

import { Router, type Request, type Response } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '../db';

const router = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

/** Pull a usable {from,to,subject,body} out of various provider payload shapes. */
function parseInbound(payload: any): { fromEmail: string; fromName: string | null; toEmail: string | null; subject: string | null; body: string | null } | null {
  const d = payload?.data || payload || {};

  // from can be a string "Name <a@b.com>" or an object {email,name} or array
  const rawFrom = d.from ?? d.sender ?? d.From ?? payload?.from;
  let fromEmail = '', fromName: string | null = null;
  if (typeof rawFrom === 'string') {
    const m = rawFrom.match(/<([^>]+)>/);
    fromEmail = (m ? m[1] : rawFrom).trim().toLowerCase();
    fromName = m ? rawFrom.replace(/<[^>]+>/, '').replace(/"/g, '').trim() || null : null;
  } else if (rawFrom && typeof rawFrom === 'object') {
    fromEmail = String(rawFrom.email || rawFrom.address || '').trim().toLowerCase();
    fromName = rawFrom.name || null;
  }

  const rawTo = d.to ?? d.To ?? d.recipient;
  let toEmail: string | null = null;
  if (typeof rawTo === 'string') {
    const m = rawTo.match(/<([^>]+)>/);
    toEmail = (m ? m[1] : rawTo).trim().toLowerCase();
  } else if (Array.isArray(rawTo) && rawTo.length) {
    const first = rawTo[0];
    toEmail = (typeof first === 'string' ? first : first?.email || '').trim().toLowerCase() || null;
  } else if (rawTo && typeof rawTo === 'object') {
    toEmail = String(rawTo.email || '').trim().toLowerCase() || null;
  }

  const subject = d.subject ?? d.Subject ?? null;
  const body = d.text ?? d.body ?? d.html ?? d['stripped-text'] ?? d['body-plain'] ?? null;

  if (!fromEmail || !EMAIL_RE.test(fromEmail)) return null;
  return { fromEmail, fromName, toEmail, subject: subject ? String(subject).slice(0, 500) : null, body: body ? String(body).slice(0, 8000) : null };
}

router.post('/webhook', async (req: Request, res: Response) => {
  // Always 200 quickly so the provider does not retry-storm.
  try {
    const payload = req.body || {};
    const type = String(payload?.type || '').toLowerCase();

    // Only act on inbound/received email events; ack everything else.
    const isInbound = !type || type.includes('inbound') || type.includes('received') || payload?.data?.from || payload?.from;
    if (!isInbound) return res.json({ ok: true, ignored: type });

    const parsed = parseInbound(payload);
    if (!parsed) return res.json({ ok: true, ignored: 'unparseable' });

    await ensureRepliesTable();
    await db.execute(sql`
      INSERT INTO email_replies (from_email, from_name, to_email, subject, body, provider, raw)
      VALUES (${parsed.fromEmail}, ${parsed.fromName}, ${parsed.toEmail}, ${parsed.subject}, ${parsed.body}, 'resend-inbound', ${JSON.stringify(payload)}::jsonb)
    `);

    res.json({ ok: true, captured: true });
  } catch {
    // Never fail the webhook — providers retry on non-2xx.
    res.json({ ok: true });
  }
});

export default router;
