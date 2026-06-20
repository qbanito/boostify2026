/**
 * Smart Merch — Fan Campaign Email Service
 *
 * Delivers marketing campaigns from an artist to their fans (the people who
 * bought tickets to a show, or previous merch buyers) promoting a Smart Merch
 * product. Resend is the primary provider with Brevo as an automatic fallback,
 * matching the rest of the platform's email infrastructure.
 *
 * This is artist-facing marketing (distinct from the admin↔supplier emails):
 * the "from" name carries the artist's name so fans recognise the sender, and
 * every email includes a clear product CTA.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Resend only has boostifymusic.site verified, not .com
const RESEND_FROM_EMAIL = process.env.RESEND_CAMPAIGN_FROM || process.env.RESEND_FROM_EMAIL || 'shows@boostifymusic.site';
const BREVO_FROM_EMAIL = process.env.CAMPAIGN_FROM_EMAIL || 'shows@boostifymusic.com';
const REPLY_TO_EMAIL = process.env.CAMPAIGN_REPLY_TO || 'support@boostifymusic.com';

export interface CampaignEmailResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

function fromName(artistName?: string): string {
  const base = (artistName || '').trim();
  return base ? `${base} · Boostify` : 'Boostify Merch';
}

async function sendResend(to: string, subject: string, html: string, artistName?: string): Promise<CampaignEmailResult> {
  if (!RESEND_API_KEY) return { success: false, provider: 'resend', error: 'RESEND_API_KEY not configured' };
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${fromName(artistName)} <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        reply_to: REPLY_TO_EMAIL,
      }),
    });
    const data: any = await res.json();
    if (data?.id) return { success: true, provider: 'resend', messageId: data.id };
    return { success: false, provider: 'resend', error: data?.message || `Resend HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'resend', error: e.message };
  }
}

async function sendBrevo(to: string, subject: string, html: string, artistName?: string): Promise<CampaignEmailResult> {
  if (!BREVO_API_KEY) return { success: false, provider: 'brevo', error: 'BREVO_API_KEY not configured' };
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: BREVO_FROM_EMAIL, name: fromName(artistName) },
        to: [{ email: to }],
        replyTo: { email: REPLY_TO_EMAIL },
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

/** Send a fan campaign email: Resend first, Brevo fallback. */
export async function sendFanCampaignEmail(
  to: string,
  subject: string,
  html: string,
  artistName?: string,
): Promise<CampaignEmailResult> {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { success: false, error: 'A valid fan email is required' };
  }
  const resend = await sendResend(to, subject, html, artistName);
  if (resend.success) return resend;
  const brevo = await sendBrevo(to, subject, html, artistName);
  if (brevo.success) return brevo;
  return { success: false, error: `Resend: ${resend.error} | Brevo: ${brevo.error}` };
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface CampaignEmailData {
  artistName: string;
  fanName?: string;
  headline: string;
  body: string;            // plain text; newlines become paragraphs
  productTitle?: string;
  productImageUrl?: string;
  productPrice?: string;   // already formatted e.g. "$79"
  ctaUrl: string;
  ctaLabel?: string;
  discountCode?: string;
  eventTitle?: string;     // the show the fan attended (personalisation)
  accentColor?: string;    // artist brand accent
}

/**
 * Builds a branded promotional email body promoting a Smart Merch product to a
 * fan. Returns ready-to-send HTML.
 */
export function buildCampaignEmail(d: CampaignEmailData): string {
  const accent = /^#[0-9a-fA-F]{6}$/.test(d.accentColor || '') ? d.accentColor! : '#db2777';
  const paragraphs = String(d.body || '')
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="margin:0 0 14px;color:#d1d5db;font-size:15px;line-height:1.65;">${esc(p)}</p>`)
    .join('');

  const greeting = d.fanName
    ? `<p style="margin:0 0 14px;color:#fff;font-size:15px;">Hey ${esc(d.fanName)},</p>`
    : '';

  const eventLine = d.eventTitle
    ? `<p style="margin:0 0 18px;color:${accent};font-size:12px;text-transform:uppercase;letter-spacing:1px;">Thanks for coming to ${esc(d.eventTitle)}</p>`
    : '';

  const productCard = d.productTitle
    ? `
    <div style="margin:18px 0;background:#0f0f17;border:1px solid ${accent}55;border-radius:14px;overflow:hidden;">
      ${d.productImageUrl ? `<img src="${esc(d.productImageUrl)}" alt="${esc(d.productTitle)}" style="display:block;width:100%;max-height:280px;object-fit:cover;" />` : ''}
      <div style="padding:16px 18px;">
        <p style="margin:0;color:#fff;font-size:16px;font-weight:700;">${esc(d.productTitle)}</p>
        ${d.productPrice ? `<p style="margin:6px 0 0;color:${accent};font-size:18px;font-weight:800;">${esc(d.productPrice)}</p>` : ''}
      </div>
    </div>`
    : '';

  const discountBlock = d.discountCode
    ? `
    <div style="margin:16px 0;text-align:center;background:${accent}1a;border:1px dashed ${accent};border-radius:12px;padding:14px;">
      <p style="margin:0;color:#9ca3af;font-size:12px;text-transform:uppercase;letter-spacing:1px;">Your fan code</p>
      <p style="margin:6px 0 0;color:#fff;font-size:22px;font-weight:800;letter-spacing:2px;">${esc(d.discountCode)}</p>
    </div>`
    : '';

  const cta = `
    <div style="text-align:center;margin:24px 0 8px;">
      <a href="${esc(d.ctaUrl)}" style="display:inline-block;background:${accent};color:#000;text-decoration:none;font-weight:800;font-size:15px;padding:14px 28px;border-radius:999px;">${esc(d.ctaLabel || 'Get yours now')}</a>
    </div>`;

  return `
  <div style="margin:0;padding:24px;background:#08080d;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#121219;border:1px solid #24242f;border-radius:18px;overflow:hidden;">
      <div style="padding:22px 24px;background:linear-gradient(135deg,${accent},#7c3aed);">
        <p style="margin:0;color:#fff;font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">${esc(d.artistName)}</p>
        <h1 style="margin:6px 0 0;color:#fff;font-size:22px;line-height:1.25;">${esc(d.headline)}</h1>
      </div>
      <div style="padding:24px;">
        ${eventLine}
        ${greeting}
        ${paragraphs}
        ${productCard}
        ${discountBlock}
        ${cta}
      </div>
      <div style="padding:16px 24px;border-top:1px solid #24242f;color:#7b7b8a;font-size:11px;line-height:1.5;">
        You're receiving this because you bought tickets or merch from ${esc(d.artistName)} on Boostify.
        Reply to this email if you have any questions.
      </div>
    </div>
  </div>`;
}
