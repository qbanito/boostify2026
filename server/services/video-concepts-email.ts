// ────────────────────────────────────────────────────────────────────
// Video Concepts — Email Notifications
// ────────────────────────────────────────────────────────────────────
// Same dual-provider strategy as videoservice-email.ts (Brevo → Resend
// with retry) but with templates themed for premium private events
// (quinceañeras, weddings, corporate, legacy films) instead of music
// videos.
//
// Triggers:
//   • Intake submitted              → client confirmation + admin lead alert
//   • Deposit paid                  → client confirmation + admin payment alert
//   • Final balance paid            → client confirmation + admin payment alert
//   • Storyboard ready (10 scenes)  → client notification + admin alert
// ────────────────────────────────────────────────────────────────────

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const FROM_EMAIL = 'info@boostifymusic.com';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'info@boostifymusic.site';
const FROM_NAME = 'Boostify Video Concepts';
const BASE_URL = process.env.PRODUCTION_URL || 'https://boostifymusic.com';
const ADMIN_EMAIL = process.env.VIDEO_CONCEPTS_ADMIN_EMAIL || 'convoycubano@gmail.com';

console.log(
  `[VideoConcepts Email] Providers on boot: ` +
  `Brevo=${BREVO_API_KEY ? 'configured' : 'MISSING'} · ` +
  `Resend=${RESEND_API_KEY ? 'configured' : 'MISSING'} · ` +
  `from=${FROM_EMAIL} · admin=${ADMIN_EMAIL}`
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

async function sendEmail(to: string, subject: string, html: string): Promise<EmailResult> {
  if (!to) return { success: false, error: 'no recipient' };
  const brevoResult = await sendBrevo(to, subject, html);
  if (brevoResult.success) {
    console.log(`📧 [VideoConcepts] Brevo → ${to}: ${subject}`);
    return brevoResult;
  }
  console.warn(`⚠️ [VideoConcepts] Brevo failed (${brevoResult.error}) — trying Resend`);
  const resendResult = await sendResend(to, subject, html);
  if (resendResult.success) {
    console.log(`📧 [VideoConcepts] Resend → ${to}: ${subject}`);
    return resendResult;
  }
  console.error(`❌ [VideoConcepts] Both providers failed for ${to}: brevo=${brevoResult.error} resend=${resendResult.error}`);
  return { success: false, error: `Brevo: ${brevoResult.error} | Resend: ${resendResult.error}` };
}

// ───────────────────────── HTML wrapper ─────────────────────────

function wrap(body: string, lang: 'es' | 'en' = 'es'): string {
  const tagline = lang === 'es' ? 'Películas privadas para momentos irrepetibles' : 'Private films for irreplaceable moments';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:20px">
<table width="600" cellpadding="0" cellspacing="0" style="background:#111;border-radius:14px;overflow:hidden;border:1px solid #1f1f1f">
<tr><td style="background:linear-gradient(135deg,#f59e0b,#ea580c);padding:28px 24px;text-align:center">
  <img src="${BASE_URL}/boostify-logo-white.png" alt="Boostify" width="150" style="margin-bottom:8px" onerror="this.style.display='none'">
  <div style="color:#fff;font-size:22px;font-weight:700;letter-spacing:0.5px">Boostify Video Concepts</div>
  <div style="color:#fff7ed;font-size:12px;margin-top:6px;opacity:0.9">${tagline}</div>
</td></tr>
<tr><td style="padding:32px;color:#e5e7eb;font-size:15px;line-height:1.6">${body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid #1f1f1f;text-align:center;color:#6b7280;font-size:12px">
  &copy; ${new Date().getFullYear()} Boostify Music &bull;
  <a href="${BASE_URL}/terms" style="color:#f59e0b;text-decoration:none">${lang === 'es' ? 'Términos' : 'Terms'}</a> &bull;
  <a href="${BASE_URL}/privacy" style="color:#f59e0b;text-decoration:none">${lang === 'es' ? 'Privacidad' : 'Privacy'}</a>
</td></tr>
</table></td></tr></table></body></html>`;
}

function statusPill(text: string, color = '#f59e0b'): string {
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${color}22;color:${color};font-size:11px;font-weight:700;letter-spacing:0.6px;text-transform:uppercase">${text}</span>`;
}

function detailRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:8px 0;color:#9ca3af;font-size:13px;border-bottom:1px solid #1f1f1f">${label}</td>
    <td style="padding:8px 0;color:#e5e7eb;font-size:13px;border-bottom:1px solid #1f1f1f;text-align:right">${value}</td>
  </tr>`;
}

const EVENT_LABEL_ES: Record<string, string> = {
  quinceanera: 'Quinceañera',
  wedding: 'Boda',
  corporate: 'Evento corporativo',
  legacy: 'Legacy / memoria familiar',
  other: 'Evento privado',
};
const EVENT_LABEL_EN: Record<string, string> = {
  quinceanera: 'Quinceañera',
  wedding: 'Wedding',
  corporate: 'Corporate event',
  legacy: 'Legacy / family memoir',
  other: 'Private event',
};
const eventLabel = (key: string, lang: 'es' | 'en') =>
  (lang === 'es' ? EVENT_LABEL_ES : EVENT_LABEL_EN)[key] || (lang === 'es' ? 'Evento privado' : 'Private event');

function fmtMoney(n?: number | null) {
  if (n == null) return '—';
  return `$${new Intl.NumberFormat('en-US').format(n)} USD`;
}

function fmtDate(d?: string | Date | null, lang: 'es' | 'en' = 'es') {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString(lang === 'es' ? 'es-MX' : 'en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch { return String(d); }
}

// ───────────────────────── Public API ─────────────────────────

export interface VideoConceptEmailData {
  email: string;
  name: string;
  projectId: number;
  eventType: string;
  eventDate?: string | Date | null;
  eventLocation?: string | null;
  budgetRange?: string | null;
  selectedPreset?: string | null;
  visualStyle?: string | null;
  musicDirection?: string | null;
  notes?: string | null;
  totalAmount?: number | null;
  depositAmount?: number | null;
  finalAmount?: number | null;
  galleryUrl: string;       // absolute URL to /video-concepts/project/:id?token=…
  lang: 'es' | 'en';
  phone?: string | null;
  importantPeople?: string | null;
  emotionalKeywords?: string[] | null;
  contractSignature?: string | null;
  contractVersion?: string | null;
}

// ─── 1. Intake confirmation → client ───
export async function sendIntakeReceivedClient(d: VideoConceptEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const evt = eventLabel(d.eventType, d.lang);
  const subject = isEs
    ? `Tu propuesta privada está reservada · ${evt} #${d.projectId}`
    : `Your private proposal is reserved · ${evt} #${d.projectId}`;

  const greeting = isEs ? `Hola ${d.name}` : `Hello ${d.name}`;
  const intro = isEs
    ? `Recibimos tu solicitud para una <strong>${evt.toLowerCase()}</strong> y la guardamos como un proyecto privado. Tu contrato fue firmado y registrado con sello temporal.`
    : `We received your request for a <strong>${evt.toLowerCase()}</strong> and saved it as a private project. Your contract was signed and timestamped.`;

  const nextSteps = isEs ? [
    'Revisaremos tu visión y prepararemos un blueprint creativo personalizado.',
    'Para desbloquear el guion, las referencias visuales y el demo privado necesitamos confirmar el depósito (50 %).',
    'Después del depósito podrás subir fotos y detalles para generar tu storyboard interactivo de 10 escenas.',
    'Te contactaremos directamente en menos de 24 h para coordinar la sesión creativa.',
  ] : [
    'We\'ll review your vision and prepare a tailored creative blueprint.',
    'To unlock the script, visual references and private demo we need the booking deposit (50 %).',
    'After the deposit you can upload photos and details to generate your interactive 10-scene storyboard.',
    'We\'ll reach out directly within 24 h to coordinate the creative session.',
  ];

  const body = `
    <div style="margin-bottom:8px">${statusPill(isEs ? 'Reserva privada' : 'Private booking')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:24px;font-weight:700">${greeting},</h2>
    <p>${intro}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;margin:18px 0;padding:0 18px">
      <tr><td>
        <div style="padding-top:14px;color:#9ca3af;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">${isEs ? 'Detalles del proyecto' : 'Project details'}</div>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 14px">
          ${detailRow(isEs ? 'Proyecto' : 'Project', `#${d.projectId} — ${evt}`)}
          ${detailRow(isEs ? 'Fecha del evento' : 'Event date', fmtDate(d.eventDate, d.lang))}
          ${d.eventLocation ? detailRow(isEs ? 'Locación' : 'Location', d.eventLocation) : ''}
          ${d.selectedPreset ? detailRow(isEs ? 'Estilo' : 'Style', d.selectedPreset) : ''}
          ${detailRow(isEs ? 'Inversión total' : 'Total investment', `${fmtMoney(d.totalAmount)}+`)}
          ${detailRow(isEs ? 'Depósito (50 %)' : 'Deposit (50 %)', `<strong style="color:#f59e0b">${fmtMoney(d.depositAmount)}</strong>`)}
          ${detailRow(isEs ? 'Saldo restante (50 %)' : 'Remaining balance (50 %)', fmtMoney(d.finalAmount))}
        </table>
      </td></tr>
    </table>

    <div style="background:#1c1404;border:1px solid #4a2d05;border-radius:12px;padding:18px;margin:18px 0">
      <div style="color:#fcd34d;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px">${isEs ? 'Próximos pasos' : 'Next steps'}</div>
      <ol style="margin:0;padding-left:20px;color:#e5e7eb">
        ${nextSteps.map((s) => `<li style="margin-bottom:6px">${s}</li>`).join('')}
      </ol>
    </div>

    <div style="text-align:center;margin:28px 0 18px">
      <a href="${d.galleryUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px">
        ${isEs ? '🔓 Ver mi proyecto privado' : '🔓 Open my private project'}
      </a>
      <div style="color:#6b7280;font-size:11px;margin-top:10px;word-break:break-all">${d.galleryUrl}</div>
    </div>

    <p style="color:#9ca3af;font-size:13px">${isEs
      ? `Si tienes preguntas, responde a este correo o escríbenos a <a href="mailto:${FROM_EMAIL}" style="color:#f59e0b">${FROM_EMAIL}</a>.`
      : `Any questions, just reply to this email or write to <a href="mailto:${FROM_EMAIL}" style="color:#f59e0b">${FROM_EMAIL}</a>.`}</p>
  `;

  return sendEmail(d.email, subject, wrap(body, d.lang));
}

// ─── 2. Intake admin alert → admin ───
export async function sendIntakeAdminAlert(d: VideoConceptEmailData): Promise<EmailResult> {
  const evt = eventLabel(d.eventType, 'es');
  const subject = `🔔 Nuevo Lead Video Concepts — ${d.name} · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill('Nuevo Lead', '#22c55e')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:22px">Lead privado #${d.projectId}</h2>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;margin:14px 0;padding:0 18px">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0">
          ${detailRow('Cliente', `<strong>${d.name}</strong>`)}
          ${detailRow('Email', `<a href="mailto:${d.email}" style="color:#f59e0b">${d.email}</a>`)}
          ${d.phone ? detailRow('Teléfono', d.phone) : ''}
          ${detailRow('Tipo de evento', evt)}
          ${detailRow('Fecha del evento', fmtDate(d.eventDate, 'es'))}
          ${d.eventLocation ? detailRow('Locación', d.eventLocation) : ''}
          ${d.selectedPreset ? detailRow('Preset', d.selectedPreset) : ''}
          ${d.visualStyle ? detailRow('Estilo visual', d.visualStyle) : ''}
          ${d.musicDirection ? detailRow('Dirección musical', d.musicDirection) : ''}
          ${detailRow('Inversión total', `<strong style="color:#f59e0b">${fmtMoney(d.totalAmount)}+</strong>`)}
          ${detailRow('Depósito (50 %)', `<strong style="color:#22c55e">${fmtMoney(d.depositAmount)}</strong>`)}
          ${d.contractVersion ? detailRow('Contrato', `${d.contractVersion} · firmado: ${d.contractSignature || '—'}`) : ''}
        </table>
      </td></tr>
    </table>

    ${d.importantPeople ? `<div style="background:#161616;border-radius:10px;padding:14px;margin:14px 0">
      <p style="color:#9ca3af;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">Personas clave</p>
      <p style="margin:0;color:#e5e7eb;font-size:14px">${d.importantPeople}</p>
    </div>` : ''}

    ${d.emotionalKeywords && d.emotionalKeywords.length ? `<div style="margin:14px 0">
      ${d.emotionalKeywords.map((k) => `<span style="display:inline-block;margin:0 6px 6px 0;padding:4px 10px;border-radius:999px;background:#1f1f1f;border:1px solid #2a2a2a;color:#e5e7eb;font-size:12px">${k}</span>`).join('')}
    </div>` : ''}

    ${d.notes ? `<div style="background:#161616;border-radius:10px;padding:14px;margin:14px 0">
      <p style="color:#9ca3af;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;margin:0 0 6px">Notas del cliente</p>
      <p style="margin:0;color:#e5e7eb;font-size:14px;line-height:1.6">${d.notes}</p>
    </div>` : ''}

    <div style="text-align:center;margin:22px 0 8px">
      <a href="${d.galleryUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Abrir proyecto</a>
    </div>
  `;
  return sendEmail(ADMIN_EMAIL, subject, wrap(body, 'es'));
}

// ─── 3. Deposit paid → client ───
export async function sendDepositPaidClient(d: VideoConceptEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const evt = eventLabel(d.eventType, d.lang);
  const subject = isEs
    ? `✅ Depósito confirmado · ${evt} #${d.projectId}`
    : `✅ Deposit confirmed · ${evt} #${d.projectId}`;

  const body = `
    <div style="margin-bottom:8px">${statusPill(isEs ? 'Depósito confirmado' : 'Deposit confirmed', '#22c55e')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:24px">${isEs ? `¡Gracias, ${d.name}!` : `Thank you, ${d.name}!`}</h2>
    <p>${isEs
      ? `Tu depósito de <strong style="color:#22c55e">${fmtMoney(d.depositAmount)}</strong> fue procesado de forma segura. Acabas de desbloquear tu blueprint creativo, las referencias visuales y la zona privada del proyecto.`
      : `Your <strong style="color:#22c55e">${fmtMoney(d.depositAmount)}</strong> deposit was processed securely. You just unlocked your creative blueprint, visual references and the private project area.`}</p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;margin:18px 0;padding:0 18px">
      <tr><td>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:14px 0">
          ${detailRow(isEs ? 'Proyecto' : 'Project', `#${d.projectId} — ${evt}`)}
          ${detailRow(isEs ? 'Inversión total' : 'Total investment', `${fmtMoney(d.totalAmount)}+`)}
          ${detailRow(isEs ? 'Depósito pagado' : 'Deposit paid', `<strong style="color:#22c55e">${fmtMoney(d.depositAmount)}</strong>`)}
          ${detailRow(isEs ? 'Saldo (día del rodaje)' : 'Balance (filming day)', fmtMoney(d.finalAmount))}
          ${detailRow(isEs ? 'Fecha del evento' : 'Event date', fmtDate(d.eventDate, d.lang))}
        </table>
      </td></tr>
    </table>

    <div style="background:#0c1f12;border:1px solid #14532d;border-radius:12px;padding:18px;margin:18px 0">
      <div style="color:#86efac;font-size:11px;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;margin-bottom:10px">${isEs ? 'Tu storyboard interactivo te espera' : 'Your interactive storyboard is waiting'}</div>
      <p style="margin:0;color:#e5e7eb;font-size:14px">${isEs
        ? 'Sube fotos y detalles dentro de tu página privada y nuestro director creativo IA generará 10 escenas cinematográficas personalizadas que podrás editar y regenerar.'
        : 'Upload photos and details inside your private page and our AI creative director will generate 10 cinematic scenes — fully editable and regeneratable.'}</p>
    </div>

    <div style="text-align:center;margin:24px 0 14px">
      <a href="${d.galleryUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px">
        ${isEs ? '🎬 Abrir mi blueprint' : '🎬 Open my blueprint'}
      </a>
    </div>

    <p style="color:#9ca3af;font-size:13px">${isEs
      ? 'El saldo restante se procesa el día del rodaje, antes de comenzar a grabar.'
      : 'The remaining balance is processed on filming day, before any recording begins.'}</p>
  `;
  return sendEmail(d.email, subject, wrap(body, d.lang));
}

// ─── 4. Deposit paid → admin ───
export async function sendDepositPaidAdmin(d: VideoConceptEmailData): Promise<EmailResult> {
  const evt = eventLabel(d.eventType, 'es');
  const subject = `💰 Depósito recibido — ${d.name} · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill('Depósito pagado', '#22c55e')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:22px">Pago confirmado · #${d.projectId}</h2>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;padding:0 18px;margin:14px 0">
      <tr><td>
        <table width="100%" style="margin:14px 0">
          ${detailRow('Cliente', `<strong>${d.name}</strong> · <a href="mailto:${d.email}" style="color:#f59e0b">${d.email}</a>`)}
          ${detailRow('Evento', `${evt} — ${fmtDate(d.eventDate, 'es')}`)}
          ${detailRow('Inversión total', `<strong>${fmtMoney(d.totalAmount)}+</strong>`)}
          ${detailRow('Depósito recibido', `<strong style="color:#22c55e">${fmtMoney(d.depositAmount)}</strong>`)}
          ${detailRow('Saldo pendiente', fmtMoney(d.finalAmount))}
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:18px 0">
      <a href="${d.galleryUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Abrir proyecto</a>
    </div>
  `;
  return sendEmail(ADMIN_EMAIL, subject, wrap(body, 'es'));
}

// ─── 5. Final balance paid → client ───
export async function sendFinalPaidClient(d: VideoConceptEmailData): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const evt = eventLabel(d.eventType, d.lang);
  const subject = isEs
    ? `🎉 Saldo final confirmado · ${evt} #${d.projectId}`
    : `🎉 Final balance confirmed · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill(isEs ? 'Pagado al 100 %' : 'Paid in full', '#22c55e')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:24px">${isEs ? `¡Listos para rodar, ${d.name}!` : `Ready to roll, ${d.name}!`}</h2>
    <p>${isEs
      ? `Recibimos tu saldo final. Tu proyecto está al 100 % cubierto y listo para producción.`
      : `We received your final balance. Your project is fully paid and ready for production.`}</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;margin:18px 0;padding:0 18px">
      <tr><td>
        <table width="100%" style="margin:14px 0">
          ${detailRow(isEs ? 'Proyecto' : 'Project', `#${d.projectId} — ${evt}`)}
          ${detailRow(isEs ? 'Total cubierto' : 'Total covered', `<strong style="color:#22c55e">${fmtMoney(d.totalAmount)}</strong>`)}
          ${detailRow(isEs ? 'Fecha del evento' : 'Event date', fmtDate(d.eventDate, d.lang))}
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:24px 0">
      <a href="${d.galleryUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800">${isEs ? 'Ver mi proyecto' : 'Open my project'}</a>
    </div>
    <p style="color:#9ca3af;font-size:13px">${isEs ? 'Nuestro equipo de producción te contactará para coordinar la logística final del rodaje.' : 'Our production team will reach out to coordinate the final shoot logistics.'}</p>
  `;
  return sendEmail(d.email, subject, wrap(body, d.lang));
}

// ─── 6. Final balance paid → admin ───
export async function sendFinalPaidAdmin(d: VideoConceptEmailData): Promise<EmailResult> {
  const evt = eventLabel(d.eventType, 'es');
  const subject = `🎉 Saldo final pagado — ${d.name} · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill('Saldo final pagado', '#22c55e')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:22px">#${d.projectId} · ${d.name}</h2>
    <p>El proyecto está cubierto al 100 %. Confirma logística de rodaje cuanto antes.</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;padding:0 18px;margin:14px 0">
      <tr><td>
        <table width="100%" style="margin:14px 0">
          ${detailRow('Cliente', `<strong>${d.name}</strong> · <a href="mailto:${d.email}" style="color:#f59e0b">${d.email}</a>`)}
          ${detailRow('Evento', `${evt} — ${fmtDate(d.eventDate, 'es')}`)}
          ${detailRow('Total cubierto', `<strong style="color:#22c55e">${fmtMoney(d.totalAmount)}</strong>`)}
        </table>
      </td></tr>
    </table>
    <div style="text-align:center;margin:18px 0">
      <a href="${d.galleryUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Abrir proyecto</a>
    </div>
  `;
  return sendEmail(ADMIN_EMAIL, subject, wrap(body, 'es'));
}

// ─── 7. Storyboard ready → client ───
export async function sendStoryboardReadyClient(d: VideoConceptEmailData & { storyboardTitle?: string; sceneCount?: number }): Promise<EmailResult> {
  const isEs = d.lang === 'es';
  const evt = eventLabel(d.eventType, d.lang);
  const subject = isEs
    ? `🎞️ Tu storyboard está listo · ${evt} #${d.projectId}`
    : `🎞️ Your storyboard is ready · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill(isEs ? 'Storyboard listo' : 'Storyboard ready')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:24px">${isEs ? `¡Adelante, ${d.name}!` : `Hey ${d.name}!`}</h2>
    <p>${isEs
      ? `Generamos un storyboard cinematográfico de <strong>${d.sceneCount ?? 10} escenas</strong> a partir de tus fotos y tu brief. Cada escena trae imagen, narración, dirección visual y cue musical, y todo es <strong>editable y regenerable</strong>.`
      : `We generated a <strong>${d.sceneCount ?? 10}-scene</strong> cinematic storyboard from your photos and brief. Every scene includes image, narration, visual direction and music cue — fully <strong>editable and regeneratable</strong>.`}</p>
    ${d.storyboardTitle ? `<div style="background:#161616;border:1px solid #1f1f1f;border-radius:12px;padding:18px;margin:16px 0;text-align:center">
      <div style="color:#9ca3af;font-size:11px;letter-spacing:0.18em;text-transform:uppercase">${isEs ? 'Título de la película' : 'Film title'}</div>
      <div style="color:#fff;font-size:22px;font-weight:700;margin-top:6px">${d.storyboardTitle}</div>
    </div>` : ''}
    <div style="text-align:center;margin:24px 0">
      <a href="${d.galleryUrl}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#ea580c);color:#000;padding:14px 36px;border-radius:10px;text-decoration:none;font-weight:800">${isEs ? '🎬 Ver mi storyboard' : '🎬 Open my storyboard'}</a>
    </div>
  `;
  return sendEmail(d.email, subject, wrap(body, d.lang));
}

// ─── 8. Storyboard ready → admin ───
export async function sendStoryboardReadyAdmin(d: VideoConceptEmailData & { storyboardTitle?: string }): Promise<EmailResult> {
  const evt = eventLabel(d.eventType, 'es');
  const subject = `🎞️ Storyboard generado — ${d.name} · ${evt} #${d.projectId}`;
  const body = `
    <div style="margin-bottom:8px">${statusPill('Storyboard listo')}</div>
    <h2 style="color:#fff;margin:6px 0 14px;font-size:22px">#${d.projectId} · ${d.name}${d.storyboardTitle ? ` — “${d.storyboardTitle}”` : ''}</h2>
    <p>El cliente puede revisar, editar y regenerar escenas desde su página privada.</p>
    <div style="text-align:center;margin:18px 0">
      <a href="${d.galleryUrl}" style="display:inline-block;background:#f59e0b;color:#000;padding:12px 28px;border-radius:10px;text-decoration:none;font-weight:700">Abrir proyecto</a>
    </div>
  `;
  return sendEmail(ADMIN_EMAIL, subject, wrap(body, 'es'));
}
