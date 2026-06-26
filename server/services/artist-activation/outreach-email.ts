/**
 * Artist Activation — Cold Outreach Email Sender
 * ══════════════════════════════════════════════
 * Dedicated sender for COLD claim outreach (scraped IG / discovery leads).
 *
 * Why a separate sender from the transactional Brevo path:
 *   - Cold outreach to scraped lists carries spam-complaint risk. We send it
 *     from a DEDICATED, already-verified domain (boostifymusic.site via Resend)
 *     so any reputation damage never touches the primary boostifymusic.com
 *     domain used for real transactional mail.
 *   - boostifymusic.site is DKIM/SPF verified in Resend → authenticated mail,
 *     far better inbox placement than an unauthenticated blast.
 *
 * Resend first, Brevo as automatic fallback. Returns a normalized result.
 */

import { db } from '../../db';
import { sql } from 'drizzle-orm';

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const FROM_NAME = 'Boostify Music';
const BREVO_FROM_EMAIL = process.env.OUTREACH_BREVO_FROM || 'artists@boostifymusic.com';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Multi-account Resend pool ──────────────────────────────────────────────
// Each entry is a verified Resend account/domain. We rotate the FROM domain
// (and its API key) across sends so cold-outreach volume is spread over many
// authenticated domains → far better inbox placement than blasting one domain.
interface ResendAccount { key: string; from: string; replyTo: string; }

function buildPool(): ResendAccount[] {
  const pool: ResendAccount[] = [];
  const raw = process.env.RESEND_OUTREACH_POOL;
  if (raw) {
    try {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        for (const a of arr) {
          if (a?.key && a?.from && EMAIL_RE.test(a.from)) {
            const domain = String(a.from).split('@')[1];
            pool.push({ key: a.key, from: a.from, replyTo: a.replyTo || `info@${domain}` });
          }
        }
      }
    } catch { /* fall through to single-key default */ }
  }
  if (pool.length === 0) {
    const key = process.env.RESEND_API_KEY || '';
    const from = process.env.OUTREACH_FROM_EMAIL || 'artists@boostifymusic.site';
    if (key) pool.push({ key, from, replyTo: process.env.OUTREACH_REPLY_TO || 'info@boostifymusic.com' });
  }
  return pool;
}

// Env-defined accounts (static, from RESEND_OUTREACH_POOL). Admin-provisioned
// sending domains are layered on top from the DB so new domains go live
// WITHOUT an env edit or restart (works on Render's ephemeral fs too).
const ENV_POOL = buildPool();
let RESEND_POOL: ResendAccount[] = [...ENV_POOL];
let rotIndex = Math.floor(Math.random() * Math.max(RESEND_POOL.length, 1));
function nextAccount(): ResendAccount | null {
  if (RESEND_POOL.length === 0) return null;
  const acct = RESEND_POOL[rotIndex % RESEND_POOL.length];
  rotIndex = (rotIndex + 1) % RESEND_POOL.length;
  return acct;
}

export function outreachPoolSize(): number { return RESEND_POOL.length; }

// ─── DB-backed pool (admin-provisioned sending domains) ─────────────────────
// Reloads RESEND_POOL = env accounts + every DB domain with status='active'
// (deduped by from address). Call after provisioning/verifying a domain.
export async function refreshOutreachPool(): Promise<number> {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS outreach_sending_domains (
        id                SERIAL PRIMARY KEY,
        domain            TEXT UNIQUE NOT NULL,
        from_email        TEXT NOT NULL,
        reply_to          TEXT,
        api_key           TEXT NOT NULL,
        resend_domain_id  TEXT,
        status            TEXT NOT NULL DEFAULT 'pending',
        hostinger_bought  BOOLEAN DEFAULT false,
        dns_written       BOOLEAN DEFAULT false,
        verified_at       TIMESTAMPTZ,
        last_error        TEXT,
        created_at        TIMESTAMPTZ DEFAULT NOW()
      )`);
    const res: any = await db.execute(sql`
      SELECT api_key, from_email, reply_to FROM outreach_sending_domains WHERE status = 'active'`);
    const rows: any[] = res?.rows || res || [];
    const dbPool: ResendAccount[] = [];
    for (const r of rows) {
      if (r?.api_key && r?.from_email && EMAIL_RE.test(r.from_email)) {
        const domain = String(r.from_email).split('@')[1];
        dbPool.push({ key: r.api_key, from: r.from_email, replyTo: r.reply_to || `info@${domain}` });
      }
    }
    const seen = new Set<string>();
    const merged: ResendAccount[] = [];
    for (const a of [...ENV_POOL, ...dbPool]) {
      if (seen.has(a.from)) continue;
      seen.add(a.from);
      merged.push(a);
    }
    RESEND_POOL = merged.length ? merged : ENV_POOL;
  } catch (e: any) {
    console.warn('[Outreach] refreshOutreachPool failed:', e?.message || e);
  }
  return RESEND_POOL.length;
}

// Warm the DB-backed pool at startup (non-blocking).
refreshOutreachPool().catch(() => {});

export interface OutreachResult {
  success: boolean;
  provider?: 'resend' | 'brevo';
  from?: string;
  messageId?: string;
  error?: string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

// ─── Branded claim email (ES / EN) ───────────────────────────────────────────
export function buildClaimEmail(opts: {
  name: string;
  lang: 'es' | 'en';
  claimUrl: string;
  imageUrl?: string | null;
}): { subject: string; html: string } {
  const first = (opts.name || '').trim().split(/\s+/)[0] || (opts.lang === 'es' ? 'artista' : 'there');
  const safeName = escapeHtml(first);
  const claimUrl = opts.claimUrl;
  const img = opts.imageUrl && /^https?:\/\//.test(opts.imageUrl) ? opts.imageUrl : '';

  const t = opts.lang === 'es'
    ? {
        subject: `${first}, tu perfil de artista en Boostify ya está listo`,
        eyebrow: 'Boostify Music',
        h1: 'Tu perfil te está esperando',
        body: `Hola ${safeName}, te preparamos un perfil de artista en Boostify con tu nombre y tu imagen. Actívalo gratis en un toque y empieza a publicar tu música, vender merch y conectar con tus fans.`,
        cta: 'Activar mi perfil gratis',
        ps: 'Es gratis y solo toma 30 segundos. Si no eres tú, simplemente ignora este mensaje.',
      }
    : {
        subject: `${first}, your Boostify artist profile is ready`,
        eyebrow: 'Boostify Music',
        h1: 'Your profile is waiting for you',
        body: `Hi ${safeName}, we set up an artist profile on Boostify with your name and image. Activate it free in one tap and start publishing your music, selling merch and connecting with your fans.`,
        cta: 'Activate my profile free',
        ps: 'It is free and takes 30 seconds. If this is not you, just ignore this message.',
      };

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0b0b0f;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0b0f;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#101016;border:1px solid rgba(255,255,255,0.08);border-radius:20px;overflow:hidden;">
        <tr><td style="padding:22px 28px 0;">
          <p style="margin:0;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#e8c98a;font-weight:700;">${t.eyebrow}</p>
        </td></tr>
        ${img ? `<tr><td align="center" style="padding:18px 28px 0;">
          <img src="${escapeHtml(img)}" alt="${safeName}" width="96" height="96" style="width:96px;height:96px;border-radius:18px;object-fit:cover;border:2px solid rgba(232,201,138,0.4);" />
        </td></tr>` : ''}
        <tr><td style="padding:18px 28px 0;">
          <h1 style="margin:0;color:#ffffff;font-size:22px;line-height:1.25;font-weight:800;">${t.h1}</h1>
          <p style="margin:14px 0 0;color:#b9b9c6;font-size:15px;line-height:1.6;">${t.body}</p>
        </td></tr>
        <tr><td align="center" style="padding:26px 28px 6px;">
          <a href="${claimUrl}" style="display:inline-block;background:linear-gradient(90deg,#ff7b00,#ff2d95);color:#ffffff;text-decoration:none;padding:15px 38px;border-radius:12px;font-weight:700;font-size:16px;">${t.cta}</a>
        </td></tr>
        <tr><td style="padding:8px 28px 26px;">
          <p style="margin:0;color:#6b6b78;font-size:12px;line-height:1.5;">${t.ps}</p>
        </td></tr>
        <tr><td style="background:#0c0c12;padding:18px 28px;text-align:center;border-top:1px solid rgba(255,255,255,0.06);">
          <p style="margin:0;color:#5a5a66;font-size:11px;">© ${new Date().getFullYear()} Boostify Music · The network for artists</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject: t.subject, html };
}

// ─── Senders ─────────────────────────────────────────────────────────────────
async function viaResend(acct: ResendAccount, to: string, subject: string, html: string): Promise<OutreachResult> {
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${acct.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${acct.from}>`,
        to: [to],
        reply_to: acct.replyTo,
        subject,
        html,
      }),
    });
    const data: any = await res.json();
    if (data?.id) return { success: true, provider: 'resend', from: acct.from, messageId: data.id };
    return { success: false, provider: 'resend', from: acct.from, error: data?.message || `Resend HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'resend', error: e.message };
  }
}

async function viaBrevo(to: string, subject: string, html: string): Promise<OutreachResult> {
  if (!BREVO_API_KEY) return { success: false, provider: 'brevo', error: 'BREVO_API_KEY not configured' };
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: BREVO_FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        replyTo: { email: process.env.OUTREACH_REPLY_TO || 'info@boostifymusic.com' },
        subject,
        htmlContent: html,
      }),
    });
    const data: any = await res.json();
    if (data?.messageId) return { success: true, provider: 'brevo', messageId: data.messageId };
    return { success: false, provider: 'brevo', error: data?.message || `Brevo HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'brevo', error: e.message };
  }
}

/** Send a cold outreach email: rotate across the verified Resend account pool, Brevo fallback. */
export async function sendOutreachEmail(to: string, subject: string, html: string): Promise<OutreachResult> {
  const addr = String(to || '').trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) return { success: false, error: 'invalid_email' };

  // Try the next account in rotation; on failure, try one more account so a
  // single throttled/exhausted account never blocks the send.
  const errors: string[] = [];
  const attempts = Math.min(RESEND_POOL.length, 2);
  for (let i = 0; i < attempts; i++) {
    const acct = nextAccount();
    if (!acct) break;
    const r = await viaResend(acct, addr, subject, html);
    if (r.success) return r;
    errors.push(`${acct.from}:${r.error}`);
  }

  const brevo = await viaBrevo(addr, subject, html);
  if (brevo.success) return brevo;
  return { success: false, error: `resend[${errors.join(' | ')}] brevo:${brevo.error}` };
}
