/**
 * 📧 Gateway Email Service
 *
 * Sends professional email notifications for the Artist Agent Gateway.
 * Uses Brevo (primary) with Resend fallback.
 * Routes emails intelligently based on request type.
 *
 * IMPORTANT: Brevo requires verified sender addresses. We use info@boostifymusic.com
 * as the verified sender for ALL emails, and set the agent-specific email as replyTo
 * so replies go to the right team.
 *
 * Agent routing (replyTo):
 *   booking@boostifymusic.com     → Booking requests
 *   deals@boostifymusic.com       → Brand deals, partnerships
 *   licensing@boostifymusic.com   → Music licensing, sync
 *   press@boostifymusic.com       → Press, interviews, media
 *   manager@boostifymusic.com     → Escalated / high-value requests
 *   collab@boostifymusic.com      → Collaboration requests
 *   gateway@boostifymusic.com     → General / fan messages
 */

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const RESEND_API_URL = 'https://api.resend.com/emails';
const RESEND_API_KEY = process.env.RESEND_API_KEY || '';

// Verified sender (must be verified in both Brevo and Resend)
const VERIFIED_SENDER_EMAIL = 'info@boostifymusic.com';
const FROM_NAME = 'Boostify Artist Gateway';

// Intelligent email routing — used as replyTo so replies go to the right team
const AGENT_EMAIL_MAP: Record<string, { email: string; label: string }> = {
  booking:       { email: 'booking@boostifymusic.com',     label: 'Booking Team' },
  brand_deals:   { email: 'deals@boostifymusic.com',       label: 'Brand Partnerships' },
  licensing:     { email: 'licensing@boostifymusic.com',   label: 'Licensing Team' },
  press:         { email: 'press@boostifymusic.com',       label: 'Press & Media' },
  collaboration: { email: 'collab@boostifymusic.com',      label: 'Collaborations' },
  fan_relations: { email: 'gateway@boostifymusic.com',     label: 'Artist Gateway' },
  manager:       { email: 'manager@boostifymusic.com',     label: 'Management' },
  legal_guard:   { email: 'manager@boostifymusic.com',     label: 'Management' },
  finance:       { email: 'manager@boostifymusic.com',     label: 'Management' },
};

export interface GatewayEmailData {
  artistName: string;
  artistId: number;
  ownerEmail?: string;           // artist owner's registered email
  agentType: string;
  conversationId: string;
  senderName: string;
  senderEmail: string;
  senderCompany?: string;
  intent: string;
  opportunityScore?: number;
  riskLevel?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  agentSummary?: string;
  agentRecommendation?: string;
  messagePreview?: string;
}

export interface EmailResult {
  success: boolean;
  provider: 'brevo' | 'resend' | 'none';
  messageId?: string;
  error?: string;
}

/**
 * Get the appropriate "from" email for an agent type
 */
export function getAgentEmail(agentType: string): { email: string; label: string } {
  return AGENT_EMAIL_MAP[agentType] || AGENT_EMAIL_MAP.fan_relations;
}

/**
 * Send email via Brevo (primary provider)
 * Uses verified sender email with agent-specific replyTo
 */
async function sendViaBrevo(to: string, toName: string, subject: string, html: string, replyToEmail: string): Promise<EmailResult> {
  if (!BREVO_API_KEY) return { success: false, provider: 'brevo', error: 'BREVO_API_KEY not set' };
  try {
    const res = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'accept': 'application/json', 'api-key': BREVO_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        sender: { email: VERIFIED_SENDER_EMAIL, name: FROM_NAME },
        to: [{ email: to, name: toName }],
        replyTo: { email: replyToEmail, name: FROM_NAME },
        subject,
        htmlContent: html,
        tags: ['agent-gateway'],
      }),
    });
    const data = await res.json();
    if (data.messageId) {
      console.log(`[GatewayEmail] ✅ Brevo sent to ${to}, messageId: ${data.messageId}`);
      return { success: true, provider: 'brevo', messageId: data.messageId };
    }
    console.error(`[GatewayEmail] ❌ Brevo error:`, data.message || JSON.stringify(data));
    return { success: false, provider: 'brevo', error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    console.error(`[GatewayEmail] ❌ Brevo exception:`, err?.message);
    return { success: false, provider: 'brevo', error: err?.message };
  }
}

/**
 * Send email via Resend (fallback provider)
 * Uses verified sender email with agent-specific replyTo
 */
async function sendViaResend(to: string, toName: string, subject: string, html: string, replyToEmail: string): Promise<EmailResult> {
  if (!RESEND_API_KEY) return { success: false, provider: 'resend', error: 'RESEND_API_KEY not set' };
  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${FROM_NAME} <${VERIFIED_SENDER_EMAIL}>`,
        to: [`${toName} <${to}>`],
        reply_to: replyToEmail,
        subject,
        html,
      }),
    });
    const data = await res.json();
    if (data.id) {
      console.log(`[GatewayEmail] ✅ Resend sent to ${to}, id: ${data.id}`);
      return { success: true, provider: 'resend', messageId: data.id };
    }
    console.error(`[GatewayEmail] ❌ Resend error:`, data.message || JSON.stringify(data));
    return { success: false, provider: 'resend', error: data.message || JSON.stringify(data) };
  } catch (err: any) {
    console.error(`[GatewayEmail] ❌ Resend exception:`, err?.message);
    return { success: false, provider: 'resend', error: err?.message };
  }
}

/**
 * Send email with Brevo primary, Resend fallback
 * replyToEmail is the agent-specific email (e.g. booking@boostifymusic.com)
 */
async function sendEmail(to: string, toName: string, subject: string, html: string, replyToEmail: string): Promise<EmailResult> {
  console.log(`[GatewayEmail] 📧 Sending to ${to} (replyTo: ${replyToEmail})`);
  let result = await sendViaBrevo(to, toName, subject, html, replyToEmail);
  if (result.success) return result;
  console.warn('[GatewayEmail] Brevo failed, trying Resend:', result.error);
  result = await sendViaResend(to, toName, subject, html, replyToEmail);
  if (result.success) return result;
  console.error('[GatewayEmail] ❌ Both providers failed for', to, ':', result.error);
  return result;
}

// ─── Email Templates ──────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#22c55e';
  if (score >= 50) return '#f59e0b';
  return '#ef4444';
}

function riskColor(risk: string): string {
  if (risk === 'low') return '#22c55e';
  if (risk === 'medium') return '#f59e0b';
  if (risk === 'high') return '#ef4444';
  return '#6b7280';
}

function baseEmailTemplate(content: string, artistName: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#0a0a14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 24px;">
  <div style="text-align:center;margin-bottom:32px;">
    <div style="display:inline-block;background:linear-gradient(135deg,#7c3aed,#3b82f6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;font-size:24px;font-weight:900;letter-spacing:-0.5px;">BOOSTIFY</div>
    <div style="color:#64748b;font-size:11px;margin-top:4px;letter-spacing:2px;text-transform:uppercase;">Artist Agent Gateway</div>
  </div>
  ${content}
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.08);text-align:center;">
    <p style="color:#475569;font-size:11px;margin:0;">This notification was sent by ${artistName}'s Agent Gateway on Boostify Music.</p>
    <p style="color:#334155;font-size:10px;margin:4px 0 0;">© ${new Date().getFullYear()} Boostify Music. All rights reserved.</p>
  </div>
</div></body></html>`;
}

/**
 * Notify artist owner about a new opportunity
 */
export async function notifyOwnerNewOpportunity(data: GatewayEmailData): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);
  const sc = scoreColor(data.opportunityScore || 0);
  const rc = riskColor(data.riskLevel || 'medium');
  const valMin = data.estimatedValueMin ? `$${Math.round(data.estimatedValueMin).toLocaleString()}` : '—';
  const valMax = data.estimatedValueMax ? `$${Math.round(data.estimatedValueMax).toLocaleString()}` : '—';

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 8px;">🎯 New Opportunity for ${data.artistName}</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">A new ${data.intent.replace(/_/g, ' ')} request has been received and evaluated by the ${agentInfo.label}.</p>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Score</div>
          <div style="color:${sc};font-size:28px;font-weight:900;">${data.opportunityScore || '—'}</div>
          <div style="color:#64748b;font-size:10px;">/100</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Risk</div>
          <div style="color:${rc};font-size:16px;font-weight:700;text-transform:capitalize;">${data.riskLevel || 'Unknown'}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Est. Value</div>
          <div style="color:#f1f5f9;font-size:14px;font-weight:700;">${valMin} — ${valMax}</div>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">From</div>
        <div style="color:#f1f5f9;font-size:14px;font-weight:600;">${data.senderName}</div>
        ${data.senderCompany ? `<div style="color:#94a3b8;font-size:12px;">${data.senderCompany}</div>` : ''}
        <div style="color:#64748b;font-size:12px;">${data.senderEmail}</div>
      </div>

      ${data.agentRecommendation ? `
      <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#a78bfa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Agent Recommendation</div>
        <div style="color:#e2e8f0;font-size:13px;line-height:1.5;">${data.agentRecommendation}</div>
      </div>` : ''}

      ${data.messagePreview ? `
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Message Preview</div>
        <div style="color:#cbd5e1;font-size:13px;line-height:1.5;font-style:italic;">"${data.messagePreview.slice(0, 300)}${data.messagePreview.length > 300 ? '…' : ''}"</div>
      </div>` : ''}

      <a href="https://boostifymusic.com/artist/${data.artistId}" style="display:block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px;">
        Review in Agent Console →
      </a>
    </div>
  `, data.artistName);

  return sendEmail(
    data.ownerEmail || VERIFIED_SENDER_EMAIL,
    data.artistName,
    `🎯 [${data.artistName}] New ${data.intent.replace(/_/g, ' ')} — Score: ${data.opportunityScore || '?'}/100`,
    html,
    agentInfo.email,  // replyTo: agent-specific email
  );
}

/**
 * Send confirmation to the external sender that their request was received
 */
export async function notifySenderConfirmation(data: GatewayEmailData): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 8px;">✅ Request Received</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">Hello ${data.senderName},</p>
      <p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Thank you for your interest in ${data.artistName}. Your ${data.intent.replace(/_/g, ' ')} request has been received and is being evaluated by our ${agentInfo.label}.
      </p>
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Conversation ID</div>
        <div style="color:#a78bfa;font-size:14px;font-weight:600;font-family:monospace;">${data.conversationId}</div>
      </div>
      <p style="color:#94a3b8;font-size:12px;line-height:1.5;margin:0;">
        You can use this ID to track the status of your request. Our team typically responds within 24-72 hours for business inquiries. Fan messages are usually answered instantly.
      </p>
      <p style="color:#64748b;font-size:12px;margin:16px 0 0;">
        — ${data.artistName}'s Agent Gateway
      </p>
    </div>
  `, data.artistName);

  return sendEmail(
    data.senderEmail,
    data.senderName,
    `✅ Your request to ${data.artistName} has been received`,
    html,
    agentInfo.email,  // replyTo: agent-specific email
  );
}

/**
 * Notify owner about a pending approval
 */
export async function notifyOwnerApprovalNeeded(data: GatewayEmailData & { approvalType: string }): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 8px;">⏳ Approval Required</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">
        A ${data.approvalType.replace(/_/g, ' ')} request for ${data.artistName} requires your approval.
      </p>
      <div style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.2);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#fbbf24;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Agent Recommendation</div>
        <div style="color:#e2e8f0;font-size:13px;line-height:1.5;">${data.agentRecommendation || 'Requires your review.'}</div>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:16px;">
        <div style="flex:1;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;">From</div>
          <div style="color:#f1f5f9;font-size:13px;font-weight:600;">${data.senderName}</div>
          ${data.senderCompany ? `<div style="color:#94a3b8;font-size:11px;">${data.senderCompany}</div>` : ''}
        </div>
        <div style="flex:1;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;">Est. Value</div>
          <div style="color:#f1f5f9;font-size:13px;font-weight:600;">${data.estimatedValueMin ? `$${Math.round(data.estimatedValueMin).toLocaleString()}` : '—'} — ${data.estimatedValueMax ? `$${Math.round(data.estimatedValueMax).toLocaleString()}` : '—'}</div>
        </div>
      </div>
      <a href="https://boostifymusic.com/artist/${data.artistId}" style="display:block;background:linear-gradient(135deg,#f59e0b,#ef4444);color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;">
        Review & Decide →
      </a>
    </div>
  `, data.artistName);

  return sendEmail(
    data.ownerEmail || VERIFIED_SENDER_EMAIL,
    data.artistName,
    `⏳ [${data.artistName}] Approval Required — ${data.approvalType.replace(/_/g, ' ')}`,
    html,
    agentInfo.email,  // replyTo: agent-specific email
  );
}

/**
 * Notify sender that their request was approved
 */
export async function notifySenderApproved(data: GatewayEmailData & { note?: string }): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#22c55e;font-size:18px;margin:0 0 8px;">✅ Request Approved</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">Hello ${data.senderName},</p>
      <p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Great news! Your ${data.intent.replace(/_/g, ' ')} request to ${data.artistName} has been approved by the team.
      </p>
      ${data.note ? `
      <div style="background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#4ade80;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Note from the Team</div>
        <div style="color:#e2e8f0;font-size:13px;line-height:1.5;">${data.note}</div>
      </div>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        Our team will follow up with next steps shortly. If you have any questions, please reference your conversation ID: <strong style="color:#a78bfa;">${data.conversationId}</strong>
      </p>
    </div>
  `, data.artistName);

  return sendEmail(
    data.senderEmail,
    data.senderName,
    `✅ Your request to ${data.artistName} has been approved!`,
    html,
    agentInfo.email,
  );
}

/**
 * Notify sender that their request was declined
 */
export async function notifySenderRejected(data: GatewayEmailData & { note?: string }): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#94a3b8;font-size:18px;margin:0 0 8px;">Request Update</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 16px;">Hello ${data.senderName},</p>
      <p style="color:#cbd5e1;font-size:13px;line-height:1.6;margin:0 0 16px;">
        Thank you for your interest in ${data.artistName}. After careful review, we are unable to proceed with your ${data.intent.replace(/_/g, ' ')} request at this time.
      </p>
      ${data.note ? `
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Feedback</div>
        <div style="color:#cbd5e1;font-size:13px;line-height:1.5;">${data.note}</div>
      </div>` : ''}
      <p style="color:#94a3b8;font-size:12px;margin:0;">
        We appreciate your interest and encourage you to reach out again in the future if circumstances change.
      </p>
    </div>
  `, data.artistName);

  return sendEmail(
    data.senderEmail,
    data.senderName,
    `Update on your request to ${data.artistName}`,
    html,
    agentInfo.email,  // replyTo: agent-specific email
  );
}

/**
 * Send conversation summary to the artist owner
 * Called when a conversation reaches a significant milestone or after N messages
 */
export async function sendConversationSummary(data: {
  artistName: string;
  artistId: number;
  ownerEmail: string;
  agentType: string;
  conversationId: string;
  senderName: string;
  senderEmail: string;
  senderCompany?: string;
  intent: string;
  status: string;
  opportunityScore?: number;
  riskLevel?: string;
  estimatedValueMin?: number;
  estimatedValueMax?: number;
  agentRecommendation?: string;
  messageCount: number;
  lastMessage: string;
  collectedData?: Record<string, any>;
}): Promise<EmailResult> {
  const agentInfo = getAgentEmail(data.agentType);
  const sc = scoreColor(data.opportunityScore || 0);
  const rc = riskColor(data.riskLevel || 'medium');
  const valMin = data.estimatedValueMin ? `$${Math.round(data.estimatedValueMin).toLocaleString()}` : '—';
  const valMax = data.estimatedValueMax ? `$${Math.round(data.estimatedValueMax).toLocaleString()}` : '—';

  // Build collected data summary
  const dataEntries = data.collectedData ? Object.entries(data.collectedData).filter(([, v]) => v) : [];
  const dataHtml = dataEntries.length > 0
    ? dataEntries.map(([key, value]) => `
        <tr>
          <td style="padding:6px 12px;color:#94a3b8;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);text-transform:capitalize;">${key.replace(/_/g, ' ')}</td>
          <td style="padding:6px 12px;color:#f1f5f9;font-size:12px;border-bottom:1px solid rgba(255,255,255,0.05);">${value}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="2" style="padding:12px;color:#64748b;font-size:12px;text-align:center;">No structured data collected yet</td></tr>';

  const statusColors: Record<string, string> = {
    new: '#3b82f6', collecting_info: '#f59e0b', qualified: '#22c55e',
    negotiating: '#a855f7', pending_approval: '#f97316', approved: '#22c55e',
    rejected: '#ef4444', completed: '#10b981', spam: '#6b7280',
  };

  const html = baseEmailTemplate(`
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:24px;">
      <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 8px;">📋 Conversation Summary</h2>
      <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">
        Here's a summary of the ongoing conversation with <strong style="color:#f1f5f9;">${data.senderName}</strong>${data.senderCompany ? ` (${data.senderCompany})` : ''}.
      </p>

      <!-- Status & Score Row -->
      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Status</div>
          <div style="color:${statusColors[data.status] || '#94a3b8'};font-size:14px;font-weight:700;text-transform:capitalize;">${data.status.replace(/_/g, ' ')}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Score</div>
          <div style="color:${sc};font-size:24px;font-weight:900;">${data.opportunityScore || '—'}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Risk</div>
          <div style="color:${rc};font-size:14px;font-weight:700;text-transform:capitalize;">${data.riskLevel || '—'}</div>
        </div>
        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:12px;text-align:center;">
          <div style="color:#64748b;font-size:10px;text-transform:uppercase;letter-spacing:1px;">Est. Value</div>
          <div style="color:#f1f5f9;font-size:12px;font-weight:700;">${valMin} — ${valMax}</div>
        </div>
      </div>

      <!-- Sender Info -->
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Contact</div>
        <div style="color:#f1f5f9;font-size:14px;font-weight:600;">${data.senderName}</div>
        ${data.senderCompany ? `<div style="color:#94a3b8;font-size:12px;">${data.senderCompany}</div>` : ''}
        <div style="color:#64748b;font-size:12px;">${data.senderEmail}</div>
        <div style="color:#64748b;font-size:11px;margin-top:4px;">Intent: ${data.intent.replace(/_/g, ' ')} · ${data.messageCount} messages</div>
      </div>

      <!-- Collected Data -->
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Collected Information</div>
        <table style="width:100%;border-collapse:collapse;">${dataHtml}</table>
      </div>

      <!-- Agent Recommendation -->
      ${data.agentRecommendation ? `
      <div style="background:rgba(124,58,237,0.1);border:1px solid rgba(124,58,237,0.2);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#a78bfa;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Agent Recommendation</div>
        <div style="color:#e2e8f0;font-size:13px;line-height:1.5;">${data.agentRecommendation}</div>
      </div>` : ''}

      <!-- Latest Message -->
      <div style="background:rgba(255,255,255,0.03);border-radius:10px;padding:16px;margin-bottom:16px;">
        <div style="color:#64748b;font-size:11px;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">Latest Message</div>
        <div style="color:#cbd5e1;font-size:13px;line-height:1.5;font-style:italic;">"${data.lastMessage.slice(0, 500)}${data.lastMessage.length > 500 ? '…' : ''}"</div>
      </div>

      <a href="https://boostifymusic.com/artist/${data.artistId}" style="display:block;background:linear-gradient(135deg,#7c3aed,#3b82f6);color:white;text-align:center;padding:14px 24px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px;margin-top:16px;">
        Open Agent Console →
      </a>
    </div>
  `, data.artistName);

  return sendEmail(
    data.ownerEmail,
    data.artistName,
    `📋 [${data.artistName}] Conversation Summary — ${data.senderName} (${data.intent.replace(/_/g, ' ')})`,
    html,
    agentInfo.email,
  );
}
