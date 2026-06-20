/**
 * Cinematic Event Email Service
 * Smart messaging for parents/guests when they RSVP to an event.
 * - Sends a styled confirmation email (Brevo → Resend fallback)
 * - Attaches an .ics calendar invite with automatic reminders
 *   (1 day before + 2 hours before) so guests never forget
 * - Notifies the event host when a new RSVP arrives
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
// Resend only has boostifymusic.site verified, not .com
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@boostifymusic.site';
const FROM_NAME = 'Boostify Events';
const BASE_URL = process.env.PRODUCTION_URL || process.env.APP_BASE_URL || 'https://boostifymusic.com';

interface EmailAttachment {
  /** base64-encoded content */
  content: string;
  name: string;
}

interface EmailResult { success: boolean; messageId?: string; error?: string; provider?: string }

async function sendBrevo(
  to: string, subject: string, html: string, attachments?: EmailAttachment[]
): Promise<EmailResult> {
  if (!BREVO_API_KEY) return { success: false, error: 'BREVO_API_KEY not configured', provider: 'brevo' };
  try {
    const body: any = {
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    };
    if (attachments?.length) {
      body.attachment = attachments.map(a => ({ content: a.content, name: a.name }));
    }
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.messageId) return { success: true, messageId: data.messageId, provider: 'brevo' };
    return { success: false, error: data.message || `Brevo HTTP ${res.status}`, provider: 'brevo' };
  } catch (e: any) {
    return { success: false, error: e.message, provider: 'brevo' };
  }
}

async function sendResend(
  to: string, subject: string, html: string, attachments?: EmailAttachment[]
): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not configured', provider: 'resend' };
  try {
    const body: any = {
      from: `${FROM_NAME} <${RESEND_FROM_EMAIL}>`,
      to: [to],
      subject,
      html,
      reply_to: FROM_EMAIL,
    };
    if (attachments?.length) {
      body.attachments = attachments.map(a => ({ filename: a.name, content: a.content }));
    }
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.id) return { success: true, messageId: data.id, provider: 'resend' };
    return { success: false, error: data.message || `Resend HTTP ${res.status}`, provider: 'resend' };
  } catch (e: any) {
    return { success: false, error: e.message, provider: 'resend' };
  }
}

/** Send email with automatic fallback: Brevo → Resend */
async function sendEmail(
  to: string, subject: string, html: string, attachments?: EmailAttachment[]
): Promise<EmailResult> {
  const brevoResult = await sendBrevo(to, subject, html, attachments);
  if (brevoResult.success) {
    console.log(`📧 [EventEmail] Sent via Brevo to ${to}: ${subject}`);
    return brevoResult;
  }
  console.warn(`⚠️ [EventEmail] Brevo failed (${brevoResult.error}), trying Resend...`);
  const resendResult = await sendResend(to, subject, html, attachments);
  if (resendResult.success) {
    console.log(`📧 [EventEmail] Sent via Resend (fallback) to ${to}: ${subject}`);
    return resendResult;
  }
  console.error(`❌ [EventEmail] All providers failed for ${to}: Brevo(${brevoResult.error}) Resend(${resendResult.error})`);
  return { success: false, error: `Brevo: ${brevoResult.error} | Resend: ${resendResult.error}` };
}

// ─────────────────────────────────────────────────────────────────────────────
// Calendar (.ics) generation
// ─────────────────────────────────────────────────────────────────────────────

export interface EventForEmail {
  id: number | string;
  slug: string;
  event_title: string;
  event_subtitle?: string | null;
  event_type?: string | null;
  event_date?: string | Date | null;
  event_location?: string | null;
  honoree_name?: string | null;
  hero_image_url?: string | null;
  accent_color?: string | null;
}

function icsDate(d: Date): string {
  // UTC format: YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return (s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/**
 * Build an iCalendar invite with two reminders (1 day before, 2 hours before).
 * Returns null if the event has no valid date.
 */
function buildEventICS(event: EventForEmail): string | null {
  if (!event.event_date) return null;
  const start = new Date(event.event_date);
  if (isNaN(start.getTime())) return null;
  // Default 3-hour duration
  const end = new Date(start.getTime() + 3 * 60 * 60 * 1000);
  const url = `${BASE_URL}/event/${event.slug}`;
  const uid = `event-${event.id}-${event.slug}@boostifymusic.com`;
  const summary = icsEscape(event.event_title || 'Event');
  const description = icsEscape(
    `${event.event_subtitle || ''}\n\nVer el evento: ${url}`.trim()
  );
  const location = icsEscape(event.event_location || '');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Boostify//Cinematic Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : '',
    `URL:${url}`,
    'STATUS:CONFIRMED',
    // Reminder 1 day before
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary} — mañana`,
    'END:VALARM',
    // Reminder 2 hours before
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${summary} — en 2 horas`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return lines.join('\r\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML templates
// ─────────────────────────────────────────────────────────────────────────────

function formatEventDate(d?: string | Date | null): string {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  try {
    return date.toLocaleString('es-ES', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return date.toISOString();
  }
}

function wrap(accent: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:16px;overflow:hidden;border:1px solid #222">
${body}
<tr><td style="padding:20px;text-align:center;border-top:1px solid #222">
<p style="color:#666;font-size:12px;margin:0">Enviado con ✨ por Boostify Events</p>
</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Confirmation email sent to a guest/parent after they RSVP.
 * `smartNote` is an optional AI-personalized warm line.
 */
function rsvpConfirmationHtml(opts: {
  guestName: string;
  event: EventForEmail;
  attending: boolean;
  guestCount: number;
  smartNote?: string;
}): string {
  const accent = opts.event.accent_color || '#f97316';
  const url = `${BASE_URL}/event/${opts.event.slug}`;
  const dateStr = formatEventDate(opts.event.event_date);
  const hero = opts.event.hero_image_url
    ? `<tr><td style="padding:0"><img src="${opts.event.hero_image_url}" width="600" style="display:block;width:100%;max-height:240px;object-fit:cover" alt=""></td></tr>`
    : '';
  const headline = opts.attending
    ? '¡Tu asistencia está confirmada! 🎉'
    : 'Gracias por avisarnos 💛';
  const smart = opts.smartNote
    ? `<p style="color:#ddd;font-size:15px;line-height:1.6;margin:0 0 16px;font-style:italic">"${opts.smartNote}"</p>`
    : '';

  const details = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#1a1a1a;border-radius:12px">
      <tr><td style="padding:16px">
        <p style="color:${accent};font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px">Detalles del evento</p>
        <p style="color:#fff;font-size:18px;font-weight:700;margin:0 0 6px">${opts.event.event_title}</p>
        ${dateStr ? `<p style="color:#ccc;font-size:14px;margin:0 0 4px">📅 ${dateStr}</p>` : ''}
        ${opts.event.event_location ? `<p style="color:#ccc;font-size:14px;margin:0 0 4px">📍 ${opts.event.event_location}</p>` : ''}
        <p style="color:#ccc;font-size:14px;margin:4px 0 0">👥 ${opts.guestCount} ${opts.guestCount === 1 ? 'asistente' : 'asistentes'}</p>
      </td></tr>
    </table>`;

  const body = `
${hero}
<tr><td style="background:linear-gradient(135deg,${accent},${accent}cc);padding:28px 24px;text-align:center">
  <h1 style="color:#fff;font-size:24px;margin:0">${headline}</h1>
</td></tr>
<tr><td style="padding:28px 24px">
  <p style="color:#fff;font-size:16px;margin:0 0 16px">Hola ${opts.guestName},</p>
  ${smart}
  <p style="color:#bbb;font-size:15px;line-height:1.6;margin:0 0 8px">
    Hemos registrado tu respuesta. Te enviamos esta confirmación con todos los detalles.
  </p>
  ${details}
  <p style="color:#bbb;font-size:14px;line-height:1.6;margin:0 0 20px">
    📎 Adjuntamos una invitación de calendario con <strong>recordatorios automáticos</strong>
    (1 día antes y 2 horas antes). Solo ábrela para añadir el evento a tu calendario.
  </p>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <a href="${url}" style="display:inline-block;background:${accent};color:#fff;text-decoration:none;padding:14px 32px;border-radius:30px;font-weight:700;font-size:15px">Ver el evento →</a>
  </td></tr></table>
</td></tr>`;

  return wrap(accent, body);
}

/** Notification email sent to the host when a guest RSVPs. */
function hostNotificationHtml(opts: {
  event: EventForEmail;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount: number;
  attending: boolean;
  message?: string | null;
  mealPreference?: string | null;
}): string {
  const accent = opts.event.accent_color || '#f97316';
  const status = opts.attending ? '✅ Asistirá' : '❌ No asistirá';
  const body = `
<tr><td style="background:linear-gradient(135deg,${accent},${accent}cc);padding:24px;text-align:center">
  <h1 style="color:#fff;font-size:20px;margin:0">Nueva confirmación RSVP</h1>
  <p style="color:#fff;opacity:.9;font-size:14px;margin:8px 0 0">${opts.event.event_title}</p>
</td></tr>
<tr><td style="padding:24px">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a1a1a;border-radius:12px">
    <tr><td style="padding:16px">
      <p style="color:#fff;font-size:17px;font-weight:700;margin:0 0 10px">${opts.guestName} — ${status}</p>
      <p style="color:#ccc;font-size:14px;margin:0 0 4px">👥 ${opts.guestCount} ${opts.guestCount === 1 ? 'asistente' : 'asistentes'}</p>
      ${opts.guestEmail ? `<p style="color:#ccc;font-size:14px;margin:0 0 4px">✉️ ${opts.guestEmail}</p>` : ''}
      ${opts.guestPhone ? `<p style="color:#ccc;font-size:14px;margin:0 0 4px">📞 ${opts.guestPhone}</p>` : ''}
      ${opts.mealPreference ? `<p style="color:#ccc;font-size:14px;margin:0 0 4px">🍽️ ${opts.mealPreference}</p>` : ''}
      ${opts.message ? `<p style="color:#ddd;font-size:14px;margin:8px 0 0;font-style:italic">"${opts.message}"</p>` : ''}
    </td></tr>
  </table>
</td></tr>`;
  return wrap(accent, body);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export async function sendRsvpConfirmation(opts: {
  to: string;
  guestName: string;
  event: EventForEmail;
  attending: boolean;
  guestCount: number;
  smartNote?: string;
}): Promise<EmailResult> {
  const subject = opts.attending
    ? `🎉 Confirmado: ${opts.event.event_title}`
    : `Respuesta recibida: ${opts.event.event_title}`;
  const html = rsvpConfirmationHtml(opts);

  const attachments: EmailAttachment[] = [];
  const ics = buildEventICS(opts.event);
  if (ics) {
    attachments.push({
      content: Buffer.from(ics, 'utf-8').toString('base64'),
      name: 'evento.ics',
    });
  }
  return sendEmail(opts.to, subject, html, attachments.length ? attachments : undefined);
}

export async function sendHostRsvpNotification(opts: {
  to: string;
  event: EventForEmail;
  guestName: string;
  guestEmail?: string | null;
  guestPhone?: string | null;
  guestCount: number;
  attending: boolean;
  message?: string | null;
  mealPreference?: string | null;
}): Promise<EmailResult> {
  const subject = `📨 ${opts.guestName} ${opts.attending ? 'asistirá' : 'respondió'} — ${opts.event.event_title}`;
  const html = hostNotificationHtml(opts);
  return sendEmail(opts.to, subject, html);
}

export { buildEventICS };
