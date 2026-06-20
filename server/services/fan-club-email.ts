/**
 * Fan Club — News Campaign Email Service
 *
 * Lets an artist stay in touch with their fans by sending intelligent, friendly
 * news updates (new release, show, behind-the-scenes, milestone) to the fan
 * email list they imported (CSV) plus fans who joined the Fan Club on Boostify.
 *
 * Designed to NOT feel aggressive: a clean newsletter layout, a warm personal
 * tone, a single soft CTA, and an always-present one-click unsubscribe link so
 * the relationship stays respectful. Resend is primary, Brevo is the fallback.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// Resend only has boostifymusic.site verified, not .com
const RESEND_FROM_EMAIL = process.env.RESEND_FANCLUB_FROM || process.env.RESEND_CAMPAIGN_FROM || process.env.RESEND_FROM_EMAIL || 'news@boostifymusic.site';
const BREVO_FROM_EMAIL = process.env.FANCLUB_FROM_EMAIL || process.env.CAMPAIGN_FROM_EMAIL || 'news@boostifymusic.com';
const REPLY_TO_EMAIL = process.env.CAMPAIGN_REPLY_TO || 'support@boostifymusic.com';

export interface FanEmailResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

function fromName(artistName?: string): string {
  const base = (artistName || '').trim();
  return base ? `${base} · Boostify` : 'Boostify Fan Club';
}

async function sendResend(to: string, subject: string, html: string, artistName?: string): Promise<FanEmailResult> {
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

async function sendBrevo(to: string, subject: string, html: string, artistName?: string): Promise<FanEmailResult> {
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

/** Send a fan news email: Resend first, Brevo fallback. */
export async function sendFanNewsEmail(
  to: string,
  subject: string,
  html: string,
  artistName?: string,
): Promise<FanEmailResult> {
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

export interface FanNewsEmailData {
  artistName: string;
  fanName?: string;
  headline: string;
  body: string;             // plain text; blank lines become paragraphs
  imageUrl?: string;        // hero image (artist photo, cover art, poster)
  ctaUrl?: string;          // optional soft CTA (listen, watch, RSVP)
  ctaLabel?: string;
  unsubscribeUrl: string;   // always required — keeps it respectful
  accentColor?: string;     // artist brand accent (highlight pop)
  primaryColor?: string;    // artist brand primary (gradient start)
  secondaryColor?: string;  // artist brand secondary (gradient end)
  profileUrl?: string;      // link back to the artist's Boostify page
  eyebrow?: string;         // small label above the headline (e.g. "NEW SINGLE")
  preheader?: string;       // hidden inbox-preview text
  genre?: string;           // optional, shown as a subtle tag
}

function isHex(s?: string): boolean {
  return !!s && /^#[0-9a-fA-F]{6}$/.test(s);
}

/** Mix a hex color toward black by `amt` (0..1) for readable contrast on text. */
function darken(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)));
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)));
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

/** Relative luminance → pick black/white text that reads on a given color. */
function readableText(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? '#0b0b12' : '#ffffff';
}

/** Average two hex colors → the gradient's visual midpoint. */
function mix(a: string, b: string): string {
  const na = parseInt(a.slice(1), 16);
  const nb = parseInt(b.slice(1), 16);
  const r = Math.round((((na >> 16) & 255) + ((nb >> 16) & 255)) / 2);
  const g = Math.round((((na >> 8) & 255) + ((nb >> 8) & 255)) / 2);
  const bl = Math.round(((na & 255) + (nb & 255)) / 2);
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1)}`;
}

/** Perceived lightness 0..1 of a hex color. */
function lumOf(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

/**
 * Builds a spectacular, magazine-style fan email. Email-client-safe (table
 * layout + inline styles, works in Gmail/Apple Mail/Outlook): a full-bleed
 * artist hero image with a brand gradient veil, the artist name badge, a bold
 * headline, warm body copy, a glowing brand CTA, the artist's signature, and a
 * respectful one-click unsubscribe footer.
 */
export function buildFanNewsEmail(d: FanNewsEmailData): string {
  const primary = isHex(d.primaryColor) ? d.primaryColor! : (isHex(d.accentColor) ? d.accentColor! : '#ec4899');
  const secondary = isHex(d.secondaryColor) ? d.secondaryColor! : '#7c3aed';
  // The CTA fills with the primary→secondary gradient, so its label must read
  // against that gradient's midpoint — NOT the accent (a light accent over a
  // dark gradient gave a black-on-black, invisible button).
  const ctaBg = mix(primary, secondary);
  const ctaText = readableText(ctaBg);
  const gradient = `linear-gradient(135deg, ${primary} 0%, ${secondary} 100%)`;
  // For very dark monochrome brand palettes the gradient blends into the page;
  // give the CTA a subtle light outline so it always pops as a button.
  const ctaBorder = lumOf(ctaBg) < 0.25 ? 'border:1px solid rgba(255,255,255,.28);' : '';
  const eyebrow = (d.eyebrow || `${d.artistName} · Fan Club`).toUpperCase();

  const paragraphs = String(d.body || '')
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map(
      (p) =>
        `<p style="margin:0 0 18px;color:#3a3a44;font-size:17px;line-height:1.72;font-family:Georgia,'Times New Roman',serif;">${esc(p)}</p>`,
    )
    .join('');

  const greeting = d.fanName
    ? `<p style="margin:0 0 18px;color:#0b0b12;font-size:18px;font-weight:700;font-family:Georgia,serif;">Dear ${esc(d.fanName)},</p>`
    : '';

  // Hero: full-bleed artist image with a dark brand gradient veil + name badge.
  const hero = d.imageUrl
    ? `
      <tr>
        <td style="position:relative;padding:0;background:${darken(primary, 0.55)};">
          <a href="${esc(d.profileUrl || '#')}" style="text-decoration:none;display:block;">
            <img src="${esc(d.imageUrl)}" alt="${esc(d.artistName)}" width="600" style="display:block;width:100%;max-width:600px;height:auto;border:0;outline:none;text-decoration:none;" />
          </a>
        </td>
      </tr>
      <tr>
        <td style="height:6px;background:${gradient};line-height:6px;font-size:6px;">&nbsp;</td>
      </tr>`
    : `<tr><td style="height:8px;background:${gradient};line-height:8px;font-size:8px;">&nbsp;</td></tr>`;

  const genreTag = d.genre
    ? `<span style="display:inline-block;margin-left:8px;padding:2px 9px;border:1px solid ${primary};border-radius:999px;color:${darken(primary, 0.05)};font-size:10px;letter-spacing:1px;">${esc(String(d.genre).toUpperCase())}</span>`
    : '';

  const cta = d.ctaUrl
    ? `
      <tr>
        <td align="center" style="padding:8px 0 6px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="border-radius:999px;background:${gradient};box-shadow:0 8px 24px ${primary}40;${ctaBorder}">
              <a href="${esc(d.ctaUrl)}" style="display:inline-block;padding:15px 38px;color:${ctaText};text-decoration:none;font-weight:800;font-size:15px;letter-spacing:.3px;font-family:Helvetica,Arial,sans-serif;border-radius:999px;">${esc(d.ctaLabel || 'Listen now')} &nbsp;→</a>
            </td>
          </tr></table>
        </td>
      </tr>`
    : '';

  const signature = `
      <tr>
        <td style="padding:6px 0 0;">
          <p style="margin:22px 0 2px;color:#3a3a44;font-size:16px;font-family:Georgia,serif;">With love,</p>
          <p style="margin:0;font-size:24px;font-weight:800;color:${darken(primary, 0.1)};font-family:Georgia,serif;letter-spacing:.3px;">${esc(d.artistName)}</p>
        </td>
      </tr>`;

  const profileLink = d.profileUrl
    ? `<a href="${esc(d.profileUrl)}" style="color:${darken(primary, 0.1)};text-decoration:none;font-weight:600;">Open ${esc(d.artistName)} on Boostify →</a><br/><br/>`
    : '';

  const preheader = d.preheader || `${d.headline} — a note from ${d.artistName}`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="light" />
  <title>${esc(d.headline)}</title>
</head>
<body style="margin:0;padding:0;background:#ece9e4;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#ece9e4;">
    <tr>
      <td align="center" style="padding:28px 14px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(20,16,30,.18);">

          <!-- Brand bar -->
          <tr>
            <td style="background:${gradient};padding:16px 30px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
                <td style="color:${readableText(primary)};font-size:12px;font-weight:800;letter-spacing:3px;font-family:Helvetica,Arial,sans-serif;">${esc(d.artistName.toUpperCase())}</td>
                <td align="right" style="color:${readableText(primary)};font-size:11px;letter-spacing:2px;font-family:Helvetica,Arial,sans-serif;opacity:.85;">★ FAN CLUB</td>
              </tr></table>
            </td>
          </tr>

          ${hero}

          <!-- Body -->
          <tr>
            <td style="padding:34px 38px 14px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <p style="margin:0 0 10px;color:${darken(primary, 0.05)};font-size:12px;font-weight:800;letter-spacing:2px;font-family:Helvetica,Arial,sans-serif;">${esc(eyebrow)}${genreTag}</p>
                    <h1 style="margin:0 0 22px;color:#0b0b12;font-size:32px;line-height:1.18;font-family:Georgia,'Times New Roman',serif;font-weight:800;">${esc(d.headline)}</h1>
                    ${greeting}
                    ${paragraphs}
                  </td>
                </tr>
                ${cta}
                ${signature}
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 38px;"><div style="height:1px;background:#e6e2da;margin:26px 0 0;"></div></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 38px 30px;">
              <p style="margin:0 0 8px;color:#8a8682;font-size:12px;line-height:1.7;font-family:Helvetica,Arial,sans-serif;">
                ${profileLink}You're receiving this because you joined ${esc(d.artistName)}'s Fan Club. We only send news worth your time.
              </p>
              <p style="margin:0;color:#a8a39c;font-size:12px;font-family:Helvetica,Arial,sans-serif;">
                <a href="${esc(d.unsubscribeUrl)}" style="color:#8a8682;text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp; Powered by <span style="color:${darken(primary, 0.1)};font-weight:700;">Boostify</span>
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;color:#b4afa8;font-size:11px;font-family:Helvetica,Arial,sans-serif;">© ${new Date().getFullYear()} ${esc(d.artistName)} · Boostify Fan Club</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
