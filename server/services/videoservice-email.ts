/**
 * Video Service Email Templates
 * 5-phase email flow for video production projects via Brevo
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
// Resend has only boostifymusic.site verified, not .com — use different sender for Resend
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@boostifymusic.site';
const FROM_NAME = 'Boostify Video Service';
const BASE_URL = process.env.PRODUCTION_URL || 'https://boostifymusic.com';
const ADMIN_EMAIL = 'convoycubano@gmail.com';

// Startup diagnostic — prints once when the module loads so we can verify config on Render
console.log(
  `[VideoService Email] Providers on boot: ` +
  `Brevo=${BREVO_API_KEY ? 'configured(' + BREVO_API_KEY.length + ' chars)' : 'MISSING'} · ` +
  `Resend=${RESEND_API_KEY ? 'configured(' + RESEND_API_KEY.length + ' chars)' : 'MISSING'} · ` +
  `brevoFrom=${FROM_EMAIL} · resendFrom=${RESEND_FROM_EMAIL} · admin=${ADMIN_EMAIL}`
);

interface EmailResult { success: boolean; messageId?: string; error?: string; provider?: string }

async function sendBrevo(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!BREVO_API_KEY) return { success: false, error: 'BREVO_API_KEY not configured', provider: 'brevo' };
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({ sender: { email: FROM_EMAIL, name: FROM_NAME }, to: [{ email: to }], subject, htmlContent: html }),
    });
    const data = await res.json();
    if (data.messageId) return { success: true, messageId: data.messageId, provider: 'brevo' };
    return { success: false, error: data.message || `Brevo HTTP ${res.status}`, provider: 'brevo' };
  } catch (e: any) {
    return { success: false, error: e.message, provider: 'brevo' };
  }
}

async function sendResend(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { success: false, error: 'RESEND_API_KEY not configured', provider: 'resend' };
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
        reply_to: FROM_EMAIL,
      }),
    });
    const data = await res.json();
    if (data.id) return { success: true, messageId: data.id, provider: 'resend' };
    return { success: false, error: data.message || `Resend HTTP ${res.status}`, provider: 'resend' };
  } catch (e: any) {
    return { success: false, error: e.message, provider: 'resend' };
  }
}

// Expose direct-provider helpers for diagnostic endpoints
export const __sendBrevoRaw = sendBrevo;
export const __sendResendRaw = sendResend;

/** Send email with automatic fallback: Brevo → Resend */
async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  // Try Brevo first
  const brevoResult = await sendBrevo(to, subject, html);
  if (brevoResult.success) {
    console.log(`📧 [VideoService] Email sent via Brevo to ${to}: ${subject}`);
    return brevoResult;
  }
  console.warn(`⚠️ [VideoService] Brevo failed (${brevoResult.error}), trying Resend fallback...`);

  // Detect terminal Brevo errors (quota/plan limits) — no point retrying Brevo in those cases
  const brevoQuotaHit = /quota|limit|credit|plan|upgrade|daily/i.test(brevoResult.error || '');

  // Fallback to Resend
  const resendResult = await sendResend(to, subject, html);
  if (resendResult.success) {
    console.log(`📧 [VideoService] Email sent via Resend (fallback) to ${to}: ${subject}`);
    return resendResult;
  }

  // Final retry pass (1s delay) — skip Brevo retry if quota was the issue
  await new Promise(r => setTimeout(r, 1000));
  if (!brevoQuotaHit) {
    const retryBrevo = await sendBrevo(to, subject, html);
    if (retryBrevo.success) {
      console.log(`📧 [VideoService] Email sent via Brevo on retry to ${to}: ${subject}`);
      return retryBrevo;
    }
  }
  const retryResend = await sendResend(to, subject, html);
  if (retryResend.success) {
    console.log(`📧 [VideoService] Email sent via Resend on retry to ${to}: ${subject}`);
    return retryResend;
  }

  console.error(`❌ [VideoService] All attempts failed for ${to}: Brevo(${brevoResult.error}), Resend(${resendResult.error})`);
  return { success: false, error: `Brevo: ${brevoResult.error} | Resend: ${resendResult.error}` };
}

function progressBar(active: number, lang: 'es' | 'en'): string {
  const phases = lang === 'es'
    ? ['Recibido', 'Guión', 'Propuesta', 'Producción', 'Entrega']
    : ['Received', 'Script', 'Proposal', 'Production', 'Delivery'];
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0">
    <tr>${phases.map((p, i) => {
      const done = i < active;
      const current = i === active;
      const bg = done ? '#f97316' : current ? '#fb923c' : '#374151';
      const clr = done || current ? '#fff' : '#9ca3af';
      return `<td width="20%" align="center" style="padding:4px">
        <div style="background:${bg};color:${clr};border-radius:4px;padding:8px 4px;font-size:11px;font-weight:${current ? 700 : 400}">${i + 1}. ${p}</div>
      </td>`;
    }).join('')}</tr>
  </table>`;
}

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:12px;overflow:hidden;border:1px solid #222">
<tr><td style="background:linear-gradient(135deg,#f97316,#ea580c);padding:24px;text-align:center">
  <img src="${BASE_URL}/boostify-logo-white.png" alt="Boostify" width="140" style="margin-bottom:8px" onerror="this.style.display='none'">
  <div style="color:#fff;font-size:22px;font-weight:700">Boostify Video Service</div>
</td></tr>
<tr><td style="padding:32px;color:#e5e7eb">${body}</td></tr>
<tr><td style="padding:16px 32px;border-top:1px solid #222;text-align:center;color:#6b7280;font-size:12px">
  &copy; ${new Date().getFullYear()} Boostify Music &bull; <a href="${BASE_URL}/terms" style="color:#f97316">Terms</a> &bull;
  <a href="${BASE_URL}/privacy" style="color:#f97316">Privacy</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

export interface VideoProjectEmailData {
  email: string;
  name: string;
  projectId: number;
  songName: string;
  calculatedPrice: string;
  depositAmount: string;
  lang: 'es' | 'en';
  artistPageUrl?: string;
  artistImageUrl?: string;
}

/** Phase 1 – Project Received (sent after deposit) */
export async function sendProjectReceivedEmail(d: VideoProjectEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `Proyecto Recibido – #${d.projectId}` : `Project Received – #${d.projectId}`;
  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">${isEs ? '¡Hola' : 'Hello'} ${d.name}!</h2>
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `Tu proyecto de video para <strong>"${d.songName}"</strong> ha sido recibido exitosamente.`
      : `Your video project for <strong>"${d.songName}"</strong> has been received successfully.`}</p>
    ${progressBar(0, d.lang)}
    <table width="100%" style="background:#1a1a2e;border-radius:8px;margin:16px 0">
      <tr><td style="padding:16px">
        <div style="color:#9ca3af;font-size:12px">${isEs ? 'Proyecto' : 'Project'} #${d.projectId}</div>
        <div style="color:#fff;font-size:16px;margin:4px 0">${d.songName}</div>
        <div style="color:#9ca3af;font-size:13px">${isEs ? 'Presupuesto estimado' : 'Estimated budget'}: <strong style="color:#f97316">$${d.calculatedPrice}</strong></div>
        <div style="color:#9ca3af;font-size:13px">${isEs ? 'Depósito pagado' : 'Deposit paid'}: <strong style="color:#22c55e">$${d.depositAmount}</strong></div>
      </td></tr>
    </table>
    <p style="font-size:14px;color:#9ca3af">${isEs
      ? 'Nuestro equipo revisará tu solicitud y comenzará a trabajar en el guión creativo. Te contactaremos en las próximas 24-48 horas.'
      : 'Our team will review your request and start working on the creative script. We\'ll contact you within 24-48 hours.'}</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${BASE_URL}/videoservice/success?project_id=${d.projectId}" style="background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">${isEs ? 'Ver Mi Proyecto' : 'View My Project'}</a>
    </div>
  `);
  return sendEmail(d.email, subject, html);
}

/** Phase 0 – Free Request Received (no deposit) + Artist Page + Video Proposal */
export async function sendFreeRequestReceivedEmail(d: VideoProjectEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `🎁 Tu Página de Artista Gratis + Propuesta de Video – #${d.projectId}` : `🎁 Your Free Artist Page + Video Proposal – #${d.projectId}`;

  const artistPageSection = d.artistPageUrl ? `
    <div style="background:linear-gradient(135deg,#1a1a2e,#16213e);border-radius:12px;padding:24px;margin:20px 0;border:1px solid #f97316;text-align:center">
      <div style="font-size:24px;margin-bottom:8px">🎁</div>
      <h3 style="color:#f97316;margin:0 0 8px;font-size:18px">${isEs ? '¡Tu Landing Page de Artista está Lista!' : 'Your Artist Landing Page is Ready!'}</h3>
      <p style="color:#9ca3af;font-size:13px;margin:0 0 16px">${isEs
        ? 'Hemos creado tu página profesional de artista GRATIS. Compártela con fans y sube tu música.'
        : 'We\'ve created your professional artist page FOR FREE. Share it with fans and upload your music.'}</p>
      ${d.artistImageUrl ? `<img src="${d.artistImageUrl}" alt="Artist" width="120" height="120" style="border-radius:50%;margin:0 auto 16px;display:block;border:3px solid #f97316;object-fit:cover" />` : ''}
      <a href="${d.artistPageUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${isEs ? '🌟 Ver Mi Página de Artista' : '🌟 View My Artist Page'}</a>
      <p style="color:#6b7280;font-size:11px;margin:12px 0 0">${d.artistPageUrl}</p>
    </div>
  ` : '';

  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">${isEs ? '¡Hola' : 'Hello'} ${d.name}!</h2>
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `Hemos recibido tu solicitud de video para <strong>"${d.songName}"</strong>. Tu proyecto ha sido registrado exitosamente.`
      : `We've received your video request for <strong>"${d.songName}"</strong>. Your project has been registered successfully.`}</p>

    ${artistPageSection}

    ${progressBar(0, d.lang)}

    <div style="background:#1a1a2e;border-radius:8px;padding:20px;margin:20px 0">
      <h3 style="color:#f97316;margin:0 0 12px;font-size:16px">${isEs ? '🎬 Tu Propuesta de Video' : '🎬 Your Video Proposal'}</h3>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #222">${isEs ? 'Proyecto' : 'Project'}</td><td style="padding:8px 0;color:#fff;font-size:13px;border-bottom:1px solid #222;text-align:right">#${d.projectId} – ${d.songName}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #222">${isEs ? 'Presupuesto estimado' : 'Estimated budget'}</td><td style="padding:8px 0;color:#f97316;font-size:16px;font-weight:700;border-bottom:1px solid #222;text-align:right">$${d.calculatedPrice}</td></tr>
        <tr><td style="padding:8px 0;color:#9ca3af;font-size:13px">${isEs ? 'Depósito requerido (50%)' : 'Required deposit (50%)'}</td><td style="padding:8px 0;color:#22c55e;font-size:14px;font-weight:600;text-align:right">$${d.depositAmount}</td></tr>
      </table>
    </div>

    <p style="font-size:14px;color:#e5e7eb;line-height:1.6">${isEs
      ? 'Nuestro equipo revisará tu solicitud y comenzará a preparar el guión creativo. Para iniciar la producción, realiza tu depósito del 50% desde tu página de proyecto.'
      : 'Our team will review your request and start preparing the creative script. To begin production, make your 50% deposit from your project page.'}</p>

    <div style="text-align:center;margin:24px 0">
      <a href="${BASE_URL}/videoservice/success?project_id=${d.projectId}" style="display:inline-block;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;padding:14px 40px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${isEs ? '💳 Ver Proyecto y Pagar Depósito' : '💳 View Project & Pay Deposit'}</a>
    </div>

    <div style="background:#1a1a2e;border-radius:8px;padding:16px;margin:16px 0">
      <p style="color:#f97316;font-weight:600;margin:0 0 8px">${isEs ? '💡 Incluye con tu video:' : '💡 Included with your video:'}</p>
      <ul style="color:#9ca3af;font-size:13px;margin:0;padding-left:20px">
        <li style="margin-bottom:4px">${isEs ? 'Landing page de artista profesional (gratis)' : 'Professional artist landing page (free)'}</li>
        <li style="margin-bottom:4px">${isEs ? 'Video optimizado para YouTube, Instagram, TikTok y Spotify' : 'Video optimized for YouTube, Instagram, TikTok & Spotify'}</li>
        <li style="margin-bottom:4px">${isEs ? 'Hasta 2 rondas de revisiones sin costo' : 'Up to 2 revision rounds at no cost'}</li>
        <li>${isEs ? 'Entrega en calidad profesional' : 'Professional quality delivery'}</li>
      </ul>
    </div>
  `);
  return sendEmail(d.email, subject, html);
}

/** Phase 2 – Script Creation */
export async function sendScriptCreationEmail(d: VideoProjectEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `Guión en Progreso – #${d.projectId}` : `Script in Progress – #${d.projectId}`;
  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">${isEs ? '¡Estamos creando tu guión!' : 'We\'re creating your script!'}</h2>
    ${progressBar(1, d.lang)}
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `Nuestro equipo creativo está trabajando en el guión y storyboard para <strong>"${d.songName}"</strong>.`
      : `Our creative team is working on the script and storyboard for <strong>"${d.songName}"</strong>.`}</p>
    <p style="font-size:14px;color:#9ca3af">${isEs
      ? 'Recibirás la propuesta visual completa en los próximos días.'
      : 'You\'ll receive the complete visual proposal in the coming days.'}</p>
  `);
  return sendEmail(d.email, subject, html);
}

/** Phase 3 – Proposal Sent */
export async function sendProposalEmail(d: VideoProjectEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `Tu Propuesta Está Lista – #${d.projectId}` : `Your Proposal is Ready – #${d.projectId}`;
  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">${isEs ? '¡Tu propuesta está lista!' : 'Your proposal is ready!'}</h2>
    ${progressBar(2, d.lang)}
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `Hemos creado una propuesta visual para <strong>"${d.songName}"</strong>. Revísala y déjanos saber si necesitas ajustes.`
      : `We've created a visual proposal for <strong>"${d.songName}"</strong>. Review it and let us know if you need adjustments.`}</p>
    <div style="text-align:center;margin:24px 0">
      <a href="${BASE_URL}/videoservice/success?project_id=${d.projectId}" style="background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">${isEs ? 'Ver Propuesta' : 'View Proposal'}</a>
    </div>
  `);
  return sendEmail(d.email, subject, html);
}

/** Phase 4 – In Production */
export async function sendInProductionEmail(d: VideoProjectEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `Tu Video Está en Producción – #${d.projectId}` : `Your Video is in Production – #${d.projectId}`;
  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">${isEs ? '¡Tu video está en producción!' : 'Your video is in production!'}</h2>
    ${progressBar(3, d.lang)}
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `La producción de <strong>"${d.songName}"</strong> está en progreso. Podrás ver avances parciales pronto.`
      : `Production of <strong>"${d.songName}"</strong> is in progress. You'll be able to see partial advances soon.`}</p>
  `);
  return sendEmail(d.email, subject, html);
}

/** Phase 5 – Final Delivery */
/** Admin Notification – New lead received */
export async function sendAdminLeadNotification(d: VideoProjectEmailData & { phone?: string; instagram?: string; spotify?: string; videoType?: string; aesthetic?: string; description?: string; artistPageUrl?: string }): Promise<EmailResult> {
  const subject = `🔔 Nuevo Lead VideoService – ${d.name} – "${d.songName}" (#${d.projectId})`;
  const html = wrap(`
    <h2 style="color:#f97316;margin:0 0 16px">🔔 Nuevo Lead Recibido</h2>
    <table width="100%" style="background:#1a1a2e;border-radius:8px;margin:16px 0">
      <tr><td style="padding:16px">
        <div style="color:#f97316;font-size:18px;font-weight:700;margin-bottom:12px">Proyecto #${d.projectId}</div>
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Nombre</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right">${d.name}</td></tr>
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Email</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right"><a href="mailto:${d.email}" style="color:#f97316">${d.email}</a></td></tr>
          ${d.phone ? `<tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Teléfono</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right">${d.phone}</td></tr>` : ''}
          ${d.instagram ? `<tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Instagram</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right">${d.instagram}</td></tr>` : ''}
          ${d.spotify ? `<tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Spotify</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right"><a href="${d.spotify}" style="color:#f97316">Ver perfil</a></td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Canción</td><td style="padding:6px 0;color:#fff;font-size:13px;font-weight:700;border-bottom:1px solid #333;text-align:right">${d.songName}</td></tr>
          ${d.videoType ? `<tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Tipo de video</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right">${d.videoType}</td></tr>` : ''}
          ${d.aesthetic ? `<tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Estética</td><td style="padding:6px 0;color:#fff;font-size:13px;border-bottom:1px solid #333;text-align:right">${d.aesthetic}</td></tr>` : ''}
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #333">Presupuesto</td><td style="padding:6px 0;color:#f97316;font-size:16px;font-weight:700;border-bottom:1px solid #333;text-align:right">$${d.calculatedPrice}</td></tr>
          <tr><td style="padding:6px 0;color:#9ca3af;font-size:13px">Depósito (50%)</td><td style="padding:6px 0;color:#22c55e;font-size:14px;font-weight:600;text-align:right">$${d.depositAmount}</td></tr>
        </table>
      </td></tr>
    </table>
    ${d.description ? `<div style="background:#1a1a2e;border-radius:8px;padding:16px;margin:16px 0"><p style="color:#9ca3af;font-size:12px;margin:0 0 4px">Descripción / Visión:</p><p style="color:#e5e7eb;font-size:14px;margin:0;line-height:1.5">${d.description}</p></div>` : ''}
    ${d.artistPageUrl ? `<div style="text-align:center;margin:20px 0"><a href="${d.artistPageUrl}" style="display:inline-block;background:#f97316;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Ver Página del Artista</a></div>` : ''}
    <div style="text-align:center;margin:16px 0">
      <a href="${BASE_URL}/videoservice/success?project_id=${d.projectId}" style="display:inline-block;background:#374151;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px">Ver Proyecto</a>
    </div>
  `);
  return sendEmail(ADMIN_EMAIL, subject, html);
}

export async function sendDeliveryEmail(d: VideoProjectEmailData & { downloadUrl?: string }): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const subject = isEs ? `¡Tu Video Está Listo! – #${d.projectId}` : `Your Video is Ready! – #${d.projectId}`;
  const html = wrap(`
    <h2 style="color:#22c55e;margin:0 0 16px">${isEs ? '🎬 ¡Tu video está listo!' : '🎬 Your video is ready!'}</h2>
    ${progressBar(4, d.lang)}
    <p style="font-size:15px;line-height:1.6">${isEs
      ? `La producción de <strong>"${d.songName}"</strong> ha sido completada. ¡Estamos emocionados de compartirlo contigo!`
      : `Production of <strong>"${d.songName}"</strong> is complete. We're excited to share it with you!`}</p>
    ${d.downloadUrl ? `<div style="text-align:center;margin:24px 0">
      <a href="${d.downloadUrl}" style="background:#22c55e;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">${isEs ? 'Descargar Video' : 'Download Video'}</a>
    </div>` : ''}
    <div style="background:#1a1a2e;border-radius:8px;padding:16px;margin:16px 0">
      <p style="color:#f97316;font-weight:600;margin:0 0 8px">${isEs ? '🎁 ¡No olvides tu landing page gratis!' : '🎁 Don\'t forget your free landing page!'}</p>
      <p style="color:#9ca3af;font-size:13px;margin:0">${isEs
        ? 'Actívala ahora en Boostify y comparte tu música con el mundo.'
        : 'Activate it now on Boostify and share your music with the world.'}</p>
    </div>
  `);
  return sendEmail(d.email, subject, html);
}
