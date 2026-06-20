/**
 * Legal / DMCA Notification Service
 *
 * Whenever a legal event happens on the platform (a DMCA takedown notice, a
 * counter-notification, or an artist verification request), this service sends
 * an internal alert email so the designated agent never misses a submission.
 *
 * Sender: copywrite@boostifymusic.com (the DMCA designated-agent address).
 * Forwarded to: convoycubano@gmail.com (the personal inbox of the agent).
 *
 * Resend is the primary provider with Brevo as an automatic fallback, matching
 * the rest of the platform's email infrastructure.
 *
 * NOTE: For Resend to deliver FROM copywrite@boostifymusic.com you must verify
 * the boostifymusic.com domain in the Resend dashboard. If it is not verified
 * the send falls back to Brevo (or the verified .site sender via env override).
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

// DMCA designated-agent sender + internal forward target (env-overridable).
const LEGAL_FROM_EMAIL = process.env.LEGAL_FROM_EMAIL || 'copywrite@boostifymusic.com';
const LEGAL_FROM_NAME = process.env.LEGAL_FROM_NAME || 'Boostify Legal · DMCA Agent';
const LEGAL_NOTIFY_EMAIL = process.env.LEGAL_NOTIFY_EMAIL || 'convoycubano@gmail.com';

export interface LegalNotifyResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function sendResend(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<LegalNotifyResult> {
  if (!RESEND_API_KEY) return { success: false, provider: 'resend', error: 'RESEND_API_KEY not configured' };
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${LEGAL_FROM_NAME} <${LEGAL_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        reply_to: replyTo || LEGAL_FROM_EMAIL,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (data?.id) return { success: true, provider: 'resend', messageId: data.id };
    return { success: false, provider: 'resend', error: data?.message || `Resend HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'resend', error: e?.message };
  }
}

async function sendBrevo(
  to: string,
  subject: string,
  html: string,
  replyTo?: string,
): Promise<LegalNotifyResult> {
  if (!BREVO_API_KEY) return { success: false, provider: 'brevo', error: 'BREVO_API_KEY not configured' };
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: LEGAL_FROM_EMAIL, name: LEGAL_FROM_NAME },
        to: [{ email: to }],
        replyTo: { email: replyTo || LEGAL_FROM_EMAIL },
        subject,
        htmlContent: html,
      }),
    });
    const data: any = await res.json().catch(() => ({}));
    if (data?.messageId) return { success: true, provider: 'brevo', messageId: data.messageId };
    return { success: false, provider: 'brevo', error: data?.message || `Brevo HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'brevo', error: e?.message };
  }
}

/**
 * Low-level: forward a legal alert email. Resend first, Brevo fallback.
 * Never throws — returns a result object so callers can fire-and-forget.
 */
export async function forwardLegalNotice(
  subject: string,
  html: string,
  replyTo?: string,
  to: string = LEGAL_NOTIFY_EMAIL,
): Promise<LegalNotifyResult> {
  const resend = await sendResend(to, subject, html, replyTo);
  if (resend.success) return resend;
  const brevo = await sendBrevo(to, subject, html, replyTo);
  if (brevo.success) return brevo;
  return { success: false, error: `Resend: ${resend.error} | Brevo: ${brevo.error}` };
}

function rows(fields: Array<[string, unknown]>): string {
  return fields
    .filter(([, v]) => v !== undefined && v !== null && String(v).trim() !== '')
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px;font-weight:600;color:#0f172a;vertical-align:top;white-space:nowrap">${esc(
          k,
        )}</td><td style="padding:6px 12px;color:#334155">${esc(v).replace(/\n/g, '<br/>')}</td></tr>`,
    )
    .join('');
}

function wrap(title: string, badge: string, inner: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:640px;margin:0 auto;padding:24px">
    <div style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0">
      <div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:20px 24px">
        <div style="display:inline-block;background:#f97316;color:#fff;font-size:11px;font-weight:700;letter-spacing:.05em;padding:4px 10px;border-radius:999px;text-transform:uppercase">${esc(
          badge,
        )}</div>
        <h1 style="margin:12px 0 0;color:#fff;font-size:20px">${esc(title)}</h1>
        <p style="margin:6px 0 0;color:#94a3b8;font-size:12px">Boostify Music · DMCA Designated Agent (Reg. DMCA-1074443)</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${inner}</table>
      <div style="padding:16px 24px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px">
        Reenvío automático a ${esc(LEGAL_NOTIFY_EMAIL)}. Responde directamente para contactar al remitente.
      </div>
    </div>
  </div></body></html>`;
}

/** Notify the agent of a new DMCA takedown notice. */
export async function notifyDmcaTakedown(notice: {
  caseUuid: string;
  claimantName: string;
  claimantEmail: string;
  claimantOrg?: string | null;
  targetUrl?: string | null;
  targetUserId?: number | null;
  workDescription: string;
  infringementDescription: string;
}): Promise<LegalNotifyResult> {
  const html = wrap(
    'Nueva notificación DMCA recibida',
    'DMCA Takedown',
    rows([
      ['Caso', notice.caseUuid],
      ['Reclamante', notice.claimantName],
      ['Email', notice.claimantEmail],
      ['Organización', notice.claimantOrg],
      ['Usuario objetivo', notice.targetUserId],
      ['URL objetivo', notice.targetUrl],
      ['Obra protegida', notice.workDescription],
      ['Infracción', notice.infringementDescription],
    ]),
  );
  return forwardLegalNotice(
    `🛡️ DMCA: ${notice.claimantName} — caso ${notice.caseUuid}`,
    html,
    notice.claimantEmail,
  );
}

/** Notify the agent of a new counter-notification. */
export async function notifyCounterNotice(notice: {
  caseUuid: string;
  takedownId: number;
  fullName: string;
  email: string;
  explanation: string;
}): Promise<LegalNotifyResult> {
  const html = wrap(
    'Nueva contranotificación recibida',
    'Counter-Notice',
    rows([
      ['Caso', notice.caseUuid],
      ['DMCA original', notice.takedownId],
      ['Nombre', notice.fullName],
      ['Email', notice.email],
      ['Explicación', notice.explanation],
    ]),
  );
  return forwardLegalNotice(
    `↩️ Contranotificación — caso ${notice.caseUuid}`,
    html,
    notice.email,
  );
}

/** Notify the agent of a new artist verification request. */
export async function notifyVerificationRequest(req: {
  userId: number;
  level: string;
  legalName?: string | null;
  organization?: string | null;
  email?: string | null;
}): Promise<LegalNotifyResult> {
  const html = wrap(
    'Nueva solicitud de verificación',
    'Verification',
    rows([
      ['Usuario', req.userId],
      ['Nivel solicitado', req.level],
      ['Nombre legal', req.legalName],
      ['Organización', req.organization],
      ['Email', req.email],
    ]),
  );
  return forwardLegalNotice(
    `🟢 Verificación (${req.level}) — usuario ${req.userId}`,
    html,
    req.email || undefined,
  );
}
