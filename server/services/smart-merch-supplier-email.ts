/**
 * Smart Merch — Supplier Email Service
 *
 * Delivers two kinds of messages to fulfillment suppliers, primarily through
 * Resend (with Brevo as an automatic fallback):
 *   1. Order dispatch  — a paid Smart Merch order routed directly to the
 *      supplier who fulfills the product ("providers receive orders directly").
 *   2. Admin message   — a free-form message from the Boostify admin to a
 *      supplier (the messaging system). Supplier replies land in the admin
 *      inbox via the reply-to address.
 *
 * Only the admin operates this surface.
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';

const FROM_NAME = 'Boostify Smart Merch';
// Resend only has boostifymusic.site verified, not .com
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'fulfillment@boostifymusic.site';
const BREVO_FROM_EMAIL = process.env.SUPPLIER_FROM_EMAIL || 'fulfillment@boostifymusic.com';
// Replies from suppliers go here so the admin can track conversations.
const REPLY_TO_EMAIL = process.env.SUPPLIER_REPLY_TO || 'fulfillment@boostifymusic.com';
// A copy of every supplier RFQ / contact is sent here, and supplier replies are
// routed here too, so the operator always keeps a record of the conversation.
export const SUPPLIER_COPY_EMAIL = process.env.SUPPLIER_COPY_EMAIL || 'convoycubano@gmail.com';

export interface SupplierEmailResult {
  success: boolean;
  provider?: string;
  messageId?: string;
  error?: string;
}

export interface SupplierEmailOptions {
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
}

function toList(v?: string | string[]): string[] {
  if (!v) return [];
  return (Array.isArray(v) ? v : [v]).filter((e) => !!e && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
}

async function sendResend(to: string, subject: string, html: string, opts: SupplierEmailOptions = {}): Promise<SupplierEmailResult> {
  if (!RESEND_API_KEY) return { success: false, provider: 'resend', error: 'RESEND_API_KEY not configured' };
  try {
    const cc = toList(opts.cc);
    const bcc = toList(opts.bcc);
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${RESEND_FROM_EMAIL}>`,
        to: [to],
        ...(cc.length ? { cc } : {}),
        ...(bcc.length ? { bcc } : {}),
        subject,
        html,
        reply_to: opts.replyTo || REPLY_TO_EMAIL,
      }),
    });
    const data: any = await res.json();
    if (data?.id) return { success: true, provider: 'resend', messageId: data.id };
    return { success: false, provider: 'resend', error: data?.message || `Resend HTTP ${res.status}` };
  } catch (e: any) {
    return { success: false, provider: 'resend', error: e.message };
  }
}

async function sendBrevo(to: string, subject: string, html: string, opts: SupplierEmailOptions = {}): Promise<SupplierEmailResult> {
  if (!BREVO_API_KEY) return { success: false, provider: 'brevo', error: 'BREVO_API_KEY not configured' };
  try {
    const cc = toList(opts.cc).map((email) => ({ email }));
    const bcc = toList(opts.bcc).map((email) => ({ email }));
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { accept: 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: BREVO_FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        ...(cc.length ? { cc } : {}),
        ...(bcc.length ? { bcc } : {}),
        replyTo: { email: opts.replyTo || REPLY_TO_EMAIL },
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

/** Send a supplier email: Resend first (per platform preference), Brevo fallback. */
export async function sendSupplierEmail(to: string, subject: string, html: string, opts: SupplierEmailOptions = {}): Promise<SupplierEmailResult> {
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { success: false, error: 'A valid supplier email is required' };
  }
  const resend = await sendResend(to, subject, html, opts);
  if (resend.success) {
    console.log(`📦 [SupplierEmail] Sent via Resend to ${to}: ${subject}`);
    return resend;
  }
  console.warn(`⚠️ [SupplierEmail] Resend failed (${resend.error}), trying Brevo…`);
  const brevo = await sendBrevo(to, subject, html, opts);
  if (brevo.success) {
    console.log(`📦 [SupplierEmail] Sent via Brevo (fallback) to ${to}: ${subject}`);
    return brevo;
  }
  console.error(`❌ [SupplierEmail] All providers failed for ${to}: Resend(${resend.error}) Brevo(${brevo.error})`);
  return { success: false, error: `Resend: ${resend.error} | Brevo: ${brevo.error}` };
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function shell(title: string, inner: string): string {
  return `
  <div style="margin:0;padding:24px;background:#0b0b12;font-family:Inter,Segoe UI,Arial,sans-serif;">
    <div style="max-width:560px;margin:0 auto;background:#14141d;border:1px solid #2a2a38;border-radius:16px;overflow:hidden;">
      <div style="padding:20px 24px;background:linear-gradient(135deg,#7c3aed,#db2777);">
        <p style="margin:0;color:#fff;font-size:13px;letter-spacing:1px;text-transform:uppercase;opacity:.85;">Boostify Smart Merch</p>
        <h1 style="margin:4px 0 0;color:#fff;font-size:20px;">${esc(title)}</h1>
      </div>
      <div style="padding:24px;color:#e5e7eb;font-size:14px;line-height:1.6;">${inner}</div>
      <div style="padding:16px 24px;border-top:1px solid #2a2a38;color:#8b8b9a;font-size:12px;">
        Reply to this email to reach the Boostify fulfillment team.
      </div>
    </div>
  </div>`;
}

export interface SupplierOrderEmailData {
  supplierName: string;
  orderId: number | string;
  productTitle: string;
  productSku?: string | null;
  quantity: number;
  unitPrice?: number | null;
  currency?: string | null;
  buyerName?: string | null;
  shippingNote?: string | null;
  artistName?: string | null;
  managementNote?: string | null;
}

/** Builds the HTML for an order dispatched directly to a supplier. */
export function buildSupplierOrderEmail(d: SupplierOrderEmailData): { subject: string; html: string } {
  const cur = (d.currency || 'usd').toUpperCase();
  const rows: Array<[string, string]> = [
    ['Order #', `SM-${d.orderId}`],
    ['Product', d.productTitle],
    d.productSku ? ['SKU', d.productSku] : null,
    ['Quantity', String(d.quantity)],
    d.unitPrice != null ? ['Unit price', `${cur} ${Number(d.unitPrice).toFixed(2)}`] : null,
    d.artistName ? ['Artist / brand', d.artistName] : null,
    d.buyerName ? ['Ship to', d.buyerName] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#9ca3af;width:130px;">${esc(k)}</td><td style="padding:8px 0;color:#fff;font-weight:600;">${esc(v)}</td></tr>`,
    )
    .join('');

  const inner = `
    <p style="margin:0 0 16px;">Hi ${esc(d.supplierName)},</p>
    <p style="margin:0 0 16px;">A new pre-order has been confirmed and is ready for fulfillment. Please process and ship the following:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">${table}</table>
    ${d.shippingNote ? `<p style="margin:0 0 12px;color:#cbd5e1;"><strong style="color:#fff;">Shipping notes:</strong> ${esc(d.shippingNote)}</p>` : ''}
    ${d.managementNote ? `<p style="margin:0 0 12px;color:#cbd5e1;">${esc(d.managementNote)}</p>` : ''}
    <p style="margin:16px 0 0;color:#9ca3af;">Reply to confirm acceptance and share a tracking number once shipped.</p>`;

  return {
    subject: `New Smart Merch order SM-${d.orderId} — ${d.productTitle} ×${d.quantity}`,
    html: shell('New fulfillment order', inner),
  };
}

/** Builds the HTML for a free-form admin → supplier message. */
export function buildSupplierMessageEmail(supplierName: string, subject: string, message: string): { subject: string; html: string } {
  const inner = `
    <p style="margin:0 0 16px;">Hi ${esc(supplierName)},</p>
    <div style="margin:0 0 16px;white-space:pre-wrap;">${esc(message)}</div>`;
  return {
    subject: subject || 'Message from Boostify Smart Merch',
    html: shell(subject || 'New message', inner),
  };
}

export interface SupplierQuoteEmailData {
  supplierName: string;
  productTitle: string;
  category?: string | null;
  estimatedQuantity?: number | null;
  targetPrice?: number | null;
  currency?: string | null;
  artistName?: string | null;
  productImageUrl?: string | null;
  extraNotes?: string | null;
}

/**
 * Builds a professional Request-for-Quote (RFQ) email that an artist/operator
 * sends to a manufacturing supplier to start a conversation about producing a
 * Smart Merch product. Always in English.
 */
export function buildSupplierQuoteEmail(d: SupplierQuoteEmailData): { subject: string; html: string } {
  const cur = (d.currency || 'usd').toUpperCase();
  const rows: Array<[string, string]> = [
    ['Product', d.productTitle],
    d.category ? ['Type', d.category] : null,
    d.estimatedQuantity != null ? ['Estimated quantity', `${d.estimatedQuantity} units (pre-order based)`] : null,
    d.targetPrice != null ? ['Target unit cost', `${cur} ${Number(d.targetPrice).toFixed(2)}`] : null,
    d.artistName ? ['Artist / brand', d.artistName] : null,
  ].filter(Boolean) as Array<[string, string]>;

  const table = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:8px 0;color:#9ca3af;width:150px;">${esc(k)}</td><td style="padding:8px 0;color:#fff;font-weight:600;">${esc(v)}</td></tr>`,
    )
    .join('');

  const inner = `
    <p style="margin:0 0 16px;">Hello ${esc(d.supplierName)} team,</p>
    <p style="margin:0 0 16px;">We are sourcing a manufacturing partner for an upcoming artist merchandise drop and would like to request a quote. Here are the details:</p>
    <table style="width:100%;border-collapse:collapse;margin:8px 0 16px;">${table}</table>
    ${d.productImageUrl ? `<p style="margin:0 0 12px;"><a href="${esc(d.productImageUrl)}" style="color:#a78bfa;">View product design / reference image</a></p>` : ''}
    ${d.extraNotes ? `<p style="margin:0 0 16px;color:#cbd5e1;white-space:pre-wrap;"><strong style="color:#fff;">Notes:</strong> ${esc(d.extraNotes)}</p>` : ''}
    <p style="margin:0 0 8px;color:#fff;font-weight:600;">Could you please share:</p>
    <ul style="margin:0 0 16px;padding-left:18px;color:#cbd5e1;">
      <li>Unit price at different quantity tiers (MOQ, 50, 100, 250, 500)</li>
      <li>Available materials, colors, sizes and customization / branding options</li>
      <li>Production lead time and shipping options &amp; costs</li>
      <li>Sample availability and setup fees, if any</li>
    </ul>
    <p style="margin:16px 0 0;color:#9ca3af;">Simply reply to this email with your quote — we look forward to working with you.</p>`;

  return {
    subject: `Quote request — ${d.productTitle}${d.estimatedQuantity != null ? ` (≈${d.estimatedQuantity} units)` : ''}`,
    html: shell('Request for quote', inner),
  };
}
