/**
 * Public webhook endpoints for AIAPS.
 * Mounted at /api/webhooks/aiaps/* — NO admin auth (external providers call these).
 *
 * Security:
 *  - /sms validates the optional Twilio signature header when
 *    TWILIO_AUTH_TOKEN is present. Otherwise accepts (dev mode).
 *  - /email-inbound validates a shared secret via header
 *    X-Boostify-Secret against AIAPS_EMAIL_WEBHOOK_SECRET.
 */
import { Router, type Request, type Response } from 'express';
import crypto from 'node:crypto';
import { ingestSmsWebhook } from '../services/aiaps/phone-engine';
import { extractOtpFromEmail } from '../services/aiaps/email-engine';
import { pool } from '../services/aiaps/db';
import { logAudit } from '../services/aiaps/audit';

const router = Router();

function verifyTwilioSignature(req: Request): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  const sig = req.header('X-Twilio-Signature');
  if (!token || !sig) return !token; // skip if no token configured
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const params = req.body || {};
  const data =
    url +
    Object.keys(params)
      .sort()
      .map((k) => k + params[k])
      .join('');
  const expected = crypto.createHmac('sha1', token).update(data).digest('base64');
  return expected === sig;
}

// ---------------------------------------------------------------------------
// POST /sms — Twilio inbound SMS webhook
// ---------------------------------------------------------------------------
router.post('/sms', async (req: Request, res: Response) => {
  try {
    if (!verifyTwilioSignature(req)) {
      return res.status(403).send('Invalid signature');
    }
    const { From, To, Body, MessageSid } = req.body || {};
    const result = await ingestSmsWebhook({ From, To, Body, MessageSid });
    await logAudit({
      action: 'aiaps.sms.received',
      targetType: 'verification',
      targetId: result.verificationId,
      meta: { from: From, to: To, matched: result.matched },
    });
    // Twilio expects 200 + empty TwiML
    res.set('Content-Type', 'text/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
  } catch (err: any) {
    console.error('[AIAPS sms webhook]', err);
    res.status(500).send('err');
  }
});

// ---------------------------------------------------------------------------
// POST /email-inbound — generic inbound email parser
// Expects JSON: { to, from, subject, text, html, provider }
// ---------------------------------------------------------------------------
router.post('/email-inbound', async (req: Request, res: Response) => {
  try {
    const secret = process.env.AIAPS_EMAIL_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.header('X-Boostify-Secret');
      if (provided !== secret) return res.status(403).json({ ok: false, error: 'bad_secret' });
    }
    const { to, subject, text, html, from } = req.body || {};
    const body = text || html || '';
    const otp = extractOtpFromEmail(subject || '', body);

    // Find artist via email_asset address match
    let artistId: string | null = null;
    if (to) {
      const { rows } = await pool.query(
        'SELECT artist_id FROM aiaps_email_assets WHERE address=$1 LIMIT 1',
        [to],
      );
      artistId = rows[0]?.artist_id || null;
    }

    const { rows: insRows } = await pool.query(
      `INSERT INTO aiaps_verification_events (artist_id, platform, channel, subject, code, status)
       VALUES ($1,$2,'email',$3,$4,'new') RETURNING id`,
      [artistId, otp?.platform || 'unknown', (subject || '').slice(0, 255), otp?.code || null],
    );
    await logAudit({
      action: 'aiaps.email.received',
      targetType: 'verification',
      targetId: insRows[0].id,
      meta: { from, to, matched: !!artistId },
    });
    res.json({ ok: true, verificationId: insRows[0].id, matched: !!artistId });
  } catch (err: any) {
    console.error('[AIAPS email webhook]', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
