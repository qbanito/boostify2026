/**
 * Copyright Certificate Email Service
 * 
 * Sends a timestamped authorship certificate to the artist after the full
 * original song pipeline completes (generation → stems → SHA-256 → blockchain).
 * 
 * Uses Brevo SMTP API — same pattern as hologram-email-service.ts
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const FROM_EMAIL = 'vr@boostifymusic.com';
const FROM_NAME = 'Boostify Music — Copyright Registry';
const ADMIN_CC = 'convoycubano@gmail.com';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CertificateEmailData {
  // Artist
  artistName: string;
  artistEmail: string;

  // Song
  songTitle: string;
  genre: string;
  language: string;
  isInstrumental: boolean;

  // Authorship declaration
  creativeStory?: string;
  originalVerse?: string;
  declarationSignedAt: Date;

  // Pipeline timestamps
  generationCompletedAt?: Date;
  stemsSeparatedAt?: Date;
  hashGeneratedAt: Date;
  blockchainRegisteredAt?: Date;
  certifiedAt: Date;

  // Technical
  projectId: string;
  documentHash: string;
  blockchainTx?: string;

  // Collaborators
  collaborators: {
    name: string;
    instrument: string;
    role: string;
    agreementType: string;
    agreementSignedAt?: Date;
    deliveredAt?: Date;
  }[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(d?: Date | null): string {
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    performer: 'Intérprete',
    'co-producer': 'Co-productor',
    'co-author': 'Co-autor',
    arranger: 'Arreglista',
  };
  return map[role] || role;
}

function agreementLabel(type: string): string {
  return type === 'work-for-hire' ? 'Work For Hire (derechos cedidos al artista)' : 'Co-autoría';
}

function instrumentIcon(instrument: string): string {
  const map: Record<string, string> = {
    guitar: '🎸', piano: '🎹', drums: '🥁', bass: '🎸',
    vocals: '🎤', violin: '🎻', saxophone: '🎷', trumpet: '🎺',
    producer: '🎛️',
  };
  const key = instrument.toLowerCase();
  for (const [k, v] of Object.entries(map)) {
    if (key.includes(k)) return v;
  }
  return '🎵';
}

// ─── Email builder ─────────────────────────────────────────────────────────────

function buildCertificateHtml(data: CertificateEmailData): string {
  const collaboratorRows = data.collaborators.length === 0
    ? `<tr><td colspan="4" style="padding:12px 16px;color:#6b7280;font-style:italic;text-align:center;">Sin colaboradores registrados — obra 100% del artista</td></tr>`
    : data.collaborators.map(c => `
      <tr>
        <td style="padding:10px 16px;border-bottom:1px solid #1f2937;">
          ${instrumentIcon(c.instrument)} <strong style="color:#f9fafb;">${c.name}</strong><br>
          <span style="color:#9ca3af;font-size:12px;">${c.instrument} · ${roleLabel(c.role)}</span>
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #1f2937;color:#d1d5db;font-size:12px;">
          ${agreementLabel(c.agreementType)}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:12px;">
          ${c.agreementSignedAt ? '✅ ' + fmtDate(c.agreementSignedAt) : '⏳ Pendiente'}
        </td>
        <td style="padding:10px 16px;border-bottom:1px solid #1f2937;color:#9ca3af;font-size:12px;">
          ${c.deliveredAt ? '✅ ' + fmtDate(c.deliveredAt) : '⏳ Pendiente'}
        </td>
      </tr>
    `).join('');

  const timelineSteps = [
    { done: true, time: data.declarationSignedAt, label: 'Declaración de autoría firmada por el artista' },
    { done: !!data.generationCompletedAt, time: data.generationCompletedAt, label: 'Generación musical completada por Boostify Music Generator' },
    { done: !!data.stemsSeparatedAt, time: data.stemsSeparatedAt, label: 'Separación de stems completada (4 tracks: Vocals, Drums, Bass, Other)' },
    { done: true, time: data.hashGeneratedAt, label: 'Huella digital SHA-256 generada sobre el paquete completo de evidencia' },
    { done: !!data.blockchainTx, time: data.blockchainRegisteredAt, label: `Registrado en blockchain Polygon${data.blockchainTx ? ` · TX: ${data.blockchainTx.slice(0, 10)}...${data.blockchainTx.slice(-6)}` : ''}` },
    { done: true, time: data.certifiedAt, label: 'Certificado emitido y enviado al artista' },
  ].filter(s => s.done || s.time);

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;padding:32px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <div style="display:inline-block;background:linear-gradient(135deg,#f97316,#fb923c);border-radius:16px;padding:12px 24px;margin-bottom:16px;">
        <span style="color:#000;font-weight:900;font-size:18px;letter-spacing:1px;">BOOSTIFY MUSIC</span>
      </div>
      <h1 style="color:#f9fafb;font-size:26px;font-weight:900;margin:8px 0 4px;">Certificado de Obra Original</h1>
      <p style="color:#6b7280;font-size:14px;margin:0;">Documento de evidencia de autoría y creación</p>
    </div>

    <!-- Identity card -->
    <div style="background:#0f172a;border:1px solid #1e3a5f;border-radius:16px;padding:24px;margin-bottom:24px;">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;">Obra</td>
          <td style="color:#f97316;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;padding-bottom:4px;text-align:right;">ID Único</td>
        </tr>
        <tr>
          <td style="color:#f9fafb;font-size:22px;font-weight:900;">"${data.songTitle}"</td>
          <td style="color:#f97316;font-size:12px;font-family:monospace;text-align:right;vertical-align:bottom;">${data.projectId}</td>
        </tr>
        <tr><td colspan="2" style="height:16px;"></td></tr>
        <tr>
          <td><span style="color:#6b7280;font-size:12px;">Artista</span><br><span style="color:#f9fafb;font-weight:700;">${data.artistName}</span></td>
          <td style="text-align:right;">
            <span style="background:#f97316;color:#000;font-size:11px;font-weight:800;padding:3px 10px;border-radius:99px;">${data.genre}</span>
            <span style="background:#1e3a5f;color:#60a5fa;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;margin-left:6px;">${data.language}</span>
            ${data.isInstrumental ? '<span style="background:#1a1a2e;color:#a78bfa;font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;margin-left:6px;">Instrumental</span>' : ''}
          </td>
        </tr>
      </table>
    </div>

    <!-- Authorship declaration -->
    <div style="background:#0f172a;border:1px solid #374151;border-radius:16px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#f97316;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">✍️ Declaración de Autoría</h2>
      <p style="color:#d1d5db;font-size:13px;margin:0 0 12px;">
        <strong style="color:#f9fafb;">${data.artistName}</strong> declaró ser el/la autor/a y director/a creativo/a 
        de esta obra el <strong style="color:#f97316;">${fmtDate(data.declarationSignedAt)}</strong>.
      </p>
      ${data.creativeStory ? `
      <div style="background:#1f2937;border-left:3px solid #f97316;border-radius:0 8px 8px 0;padding:12px 16px;margin-bottom:12px;">
        <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px;">Historia creativa declarada</p>
        <p style="color:#e5e7eb;font-size:13px;font-style:italic;margin:0;">"${data.creativeStory}"</p>
      </div>
      ` : ''}
      ${data.originalVerse ? `
      <div style="background:#1f2937;border-left:3px solid #8b5cf6;border-radius:0 8px 8px 0;padding:12px 16px;">
        <p style="color:#9ca3af;font-size:11px;font-weight:600;text-transform:uppercase;margin:0 0 6px;">Verso/frase original escrito por el artista</p>
        <p style="color:#e5e7eb;font-size:14px;font-style:italic;margin:0;">"${data.originalVerse}"</p>
      </div>
      ` : ''}
    </div>

    <!-- Timeline -->
    <div style="background:#0f172a;border:1px solid #374151;border-radius:16px;padding:24px;margin-bottom:24px;">
      <h2 style="color:#f97316;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0 0 16px;">📋 Línea de Tiempo de Creación</h2>
      ${timelineSteps.map((step, i) => `
      <div style="display:flex;gap:16px;margin-bottom:${i < timelineSteps.length - 1 ? '16px' : '0'};">
        <div style="flex-shrink:0;width:24px;height:24px;border-radius:50%;background:${step.done ? '#16a34a' : '#374151'};display:flex;align-items:center;justify-content:center;margin-top:1px;">
          <span style="color:white;font-size:12px;">${step.done ? '✓' : '○'}</span>
        </div>
        <div>
          <p style="color:#9ca3af;font-size:11px;margin:0 0 2px;font-family:monospace;">${fmtDate(step.time)}</p>
          <p style="color:#e5e7eb;font-size:13px;margin:0;">${step.label}</p>
        </div>
      </div>
      `).join('')}
    </div>

    <!-- Collaborators -->
    <div style="background:#0f172a;border:1px solid #374151;border-radius:16px;overflow:hidden;margin-bottom:24px;">
      <div style="padding:20px 24px 16px;">
        <h2 style="color:#f97316;font-size:14px;font-weight:800;text-transform:uppercase;letter-spacing:1px;margin:0;">🎼 Colaboradores Registrados</h2>
      </div>
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#1f2937;">
            <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Músico</th>
            <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Acuerdo</th>
            <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Firma</th>
            <th style="padding:10px 16px;text-align:left;color:#6b7280;font-size:11px;text-transform:uppercase;font-weight:600;">Entrega</th>
          </tr>
        </thead>
        <tbody>
          ${collaboratorRows}
        </tbody>
      </table>
    </div>

    <!-- Hash fingerprint -->
    <div style="background:#0f172a;border:2px solid #f97316;border-radius:16px;padding:24px;margin-bottom:24px;text-align:center;">
      <p style="color:#6b7280;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:1px;margin:0 0 8px;">Huella Digital SHA-256 (inmutable)</p>
      <p style="color:#f97316;font-family:monospace;font-size:13px;word-break:break-all;margin:0 0 12px;background:#1a0a00;padding:12px 16px;border-radius:8px;">${data.documentHash}</p>
      ${data.blockchainTx ? `
      <p style="color:#6b7280;font-size:11px;margin:0;">Blockchain Polygon · TX: <span style="color:#60a5fa;font-family:monospace;">${data.blockchainTx}</span></p>
      ` : ''}
    </div>

    <!-- Legal note -->
    <div style="background:#0f172a;border:1px solid #374151;border-radius:12px;padding:20px 24px;margin-bottom:32px;">
      <p style="color:#6b7280;font-size:12px;line-height:1.6;margin:0;">
        Este certificado es emitido por Boostify Music como evidencia de la participación creativa del artista 
        en la creación de esta obra. El hash SHA-256 sirve como prueba de existencia ("proof of creation") 
        y puede ser utilizado como evidencia complementaria en procesos de registro de derechos de autor. 
        Los derechos patrimoniales pertenecen al artista según las leyes de propiedad intelectual aplicables. 
        Los colaboradores bajo acuerdo Work For Hire han cedido sus derechos al artista contratante.
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align:center;">
      <p style="color:#374151;font-size:12px;margin:0 0 4px;">Boostify Music · boostifymusic.com</p>
      <p style="color:#374151;font-size:11px;margin:0;">Este email fue enviado automáticamente. No responder a este correo.</p>
    </div>

  </div>
</body>
</html>`;
}

// ─── Send ──────────────────────────────────────────────────────────────────────

async function sendBrevo(to: string, subject: string, html: string): Promise<void> {
  if (!BREVO_API_KEY) {
    console.warn('[CopyrightEmail] BREVO_API_KEY not set — skipping email');
    return;
  }
  const res = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    console.error('[CopyrightEmail] Brevo error', res.status, txt.slice(0, 300));
  } else {
    const data = await res.json() as any;
    console.log('[CopyrightEmail] Sent to', to, '— messageId:', data?.messageId);
  }
}

export async function sendCopyrightCertificate(data: CertificateEmailData): Promise<void> {
  const html = buildCertificateHtml(data);
  const subject = `🎵 Certificado de Obra Original: "${data.songTitle}" — Boostify Music`;

  // Send to artist
  await sendBrevo(data.artistEmail, subject, html);

  // Admin copy
  await sendBrevo(ADMIN_CC, `[COPY] ${subject}`, html);

  console.log('[CopyrightEmail] Certificate sent for project', data.projectId);
}
