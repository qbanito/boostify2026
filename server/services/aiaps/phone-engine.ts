/**
 * Phone Engine — Twilio integration.
 * - purchasePhone: rents a new number (requires TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN)
 * - releasePhone: releases a number
 * - handleIncomingSms: parses SMS payload, inserts verification event
 * Fallback: if Twilio creds are missing, purchasePhone returns a mock number
 * so the development flow works without credentials.
 */
import { pool } from './db';

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const AUTH_HEADER =
  ACCOUNT_SID && AUTH_TOKEN
    ? 'Basic ' + Buffer.from(`${ACCOUNT_SID}:${AUTH_TOKEN}`).toString('base64')
    : null;

export interface PurchaseOptions {
  country?: string; // ISO-2
  areaCode?: string;
  purpose?: string;
  platforms?: string[];
}

export async function purchasePhone(
  artistId: string,
  opts: PurchaseOptions = {},
): Promise<{ number: string; provider: string; country: string; cost_cents: number; mock?: boolean }> {
  const country = opts.country || 'US';

  if (!AUTH_HEADER) {
    // Mock in dev so the UI flow works
    const mockNumber = `+1 (305) 555-${String(Math.floor(1000 + Math.random() * 9000))}`;
    const res = await pool.query(
      `INSERT INTO aiaps_phone_assets (artist_id, number, provider, country, purpose, platforms, cost_cents, active)
       VALUES ($1,$2,'twilio_mock',$3,$4,$5,0,TRUE) RETURNING *`,
      [artistId, mockNumber, country, opts.purpose || 'verification', JSON.stringify(opts.platforms || [])],
    );
    return { number: res.rows[0].number, provider: 'twilio_mock', country, cost_cents: 0, mock: true };
  }

  // Search available numbers
  const params = new URLSearchParams({
    SmsEnabled: 'true',
    VoiceEnabled: 'true',
    ...(opts.areaCode ? { AreaCode: opts.areaCode } : {}),
  });
  const searchUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/AvailablePhoneNumbers/${country}/Local.json?${params}`;
  const searchResp = await fetch(searchUrl, { headers: { Authorization: AUTH_HEADER } });
  if (!searchResp.ok) throw new Error(`Twilio search ${searchResp.status}`);
  const searchData: any = await searchResp.json();
  const candidate = searchData?.available_phone_numbers?.[0];
  if (!candidate) throw new Error('No numbers available in region');

  // Purchase
  const buyUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers.json`;
  const buyResp = await fetch(buyUrl, {
    method: 'POST',
    headers: {
      Authorization: AUTH_HEADER,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      PhoneNumber: candidate.phone_number,
      SmsUrl: `${process.env.PUBLIC_URL || ''}/api/webhooks/aiaps/sms`,
      SmsMethod: 'POST',
    }),
  });
  if (!buyResp.ok) throw new Error(`Twilio purchase ${buyResp.status}`);
  const buyData: any = await buyResp.json();

  const costCents = 115; // Twilio local US ~$1.15/month
  await pool.query(
    `INSERT INTO aiaps_phone_assets (artist_id, number, provider, country, purpose, platforms, cost_cents, active)
     VALUES ($1,$2,'twilio',$3,$4,$5,$6,TRUE)`,
    [artistId, buyData.phone_number, country, opts.purpose || 'verification', JSON.stringify(opts.platforms || []), costCents],
  );
  return { number: buyData.phone_number, provider: 'twilio', country, cost_cents: costCents };
}

export async function releasePhone(phoneId: number): Promise<boolean> {
  const { rows } = await pool.query('SELECT * FROM aiaps_phone_assets WHERE id=$1', [phoneId]);
  const phone = rows[0];
  if (!phone) return false;
  if (AUTH_HEADER && phone.provider === 'twilio') {
    // Find SID via list
    const listUrl = `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(phone.number)}`;
    try {
      const lr = await fetch(listUrl, { headers: { Authorization: AUTH_HEADER! } });
      const ld: any = await lr.json();
      const sid = ld?.incoming_phone_numbers?.[0]?.sid;
      if (sid) {
        await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${ACCOUNT_SID}/IncomingPhoneNumbers/${sid}.json`,
          { method: 'DELETE', headers: { Authorization: AUTH_HEADER! } },
        );
      }
    } catch (err: any) {
      console.warn('[AIAPS phone] release failed:', err.message);
    }
  }
  await pool.query('UPDATE aiaps_phone_assets SET active=FALSE WHERE id=$1', [phoneId]);
  return true;
}

/**
 * Extract OTP from SMS and match to a pending account.
 */
export function extractOtpFromSms(body: string): { code: string; platform: string } | null {
  const platformMatch = body.match(/(instagram|tiktok|facebook|x|twitter|youtube|threads|spotify|soundcloud|whatsapp|telegram)/i);
  const codeMatch = body.match(/\b(\d{4,8})\b/) || body.match(/code[:\s]+([A-Z0-9]{4,10})/i);
  if (!codeMatch) return null;
  return {
    code: codeMatch[1],
    platform: (platformMatch?.[1] || 'unknown').toLowerCase(),
  };
}

export async function ingestSmsWebhook(payload: {
  From: string;
  To: string;
  Body: string;
  MessageSid?: string;
}): Promise<{ ok: boolean; matched?: boolean; verificationId?: number }> {
  const otp = extractOtpFromSms(payload.Body || '');
  // Find the phone asset + artist
  const { rows: phones } = await pool.query(
    `SELECT id, artist_id FROM aiaps_phone_assets WHERE number=$1 LIMIT 1`,
    [payload.To],
  );
  const artistId = phones[0]?.artist_id || null;

  const insertRes = await pool.query(
    `INSERT INTO aiaps_verification_events (artist_id, platform, channel, subject, code, status)
     VALUES ($1,$2,'sms',$3,$4,'new') RETURNING id`,
    [
      artistId,
      otp?.platform || 'unknown',
      (payload.Body || '').slice(0, 255),
      otp?.code || null,
    ],
  );
  return { ok: true, matched: !!artistId, verificationId: insertRes.rows[0].id };
}
