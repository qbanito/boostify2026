/**
 * WhatsApp Gateway Adapter — OpenWA (open-wa / wa-automate)
 * ---------------------------------------------------------------------------
 * Boostify never talks to the OpenWA core directly. Instead we run OpenWA as a
 * SEPARATE service (`whatsapp-gateway-service`, Docker or Node) that exposes a
 * thin REST API, and this adapter is the only seam between Boostify and that
 * service. Swapping providers later (e.g. WhatsApp Business Cloud API) means
 * writing a new class that implements `WhatsAppGateway` — nothing else changes.
 *
 * ⚠️ OpenWA is NOT the official Meta WhatsApp API. Use it for testing, support,
 * concierge and controlled automations only — never for unsolicited spam.
 *
 * Reference: https://github.com/rmyndharis/OpenWA · https://openwa.dev
 *
 * Configuration (env):
 *   OPENWA_BASE_URL   Base URL of the gateway service (e.g. http://localhost:8002)
 *   OPENWA_API_KEY    Shared secret sent as `api_key` header to the gateway
 *
 * When OPENWA_BASE_URL is not set the adapter runs in SIMULATION mode so the
 * whole module is usable in local dev without a live WhatsApp session.
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';

export type SessionState = 'initializing' | 'qr' | 'connected' | 'disconnected' | 'expired' | 'error';

export interface SessionResponse {
  sessionId: string;
  status: SessionState;
  /** Base64 data URL or raw string for the WhatsApp pairing QR (when status === 'qr'). */
  qrCode?: string | null;
  phoneNumber?: string | null;
}

export interface SessionStatus {
  sessionId: string;
  status: SessionState;
  qrCode?: string | null;
  phoneNumber?: string | null;
  lastConnectedAt?: number | null;
}

export interface MessageResponse {
  ok: boolean;
  messageId?: string | null;
  to: string;
  error?: string | null;
  simulated?: boolean;
}

/** Stable contract every WhatsApp provider must satisfy. */
export interface WhatsAppGateway {
  createSession(sessionId: string): Promise<SessionResponse>;
  getSessionStatus(sessionId: string): Promise<SessionStatus>;
  sendMessage(sessionId: string, to: string, message: string): Promise<MessageResponse>;
  sendMedia(sessionId: string, to: string, mediaUrl: string, caption?: string): Promise<MessageResponse>;
  receiveWebhook(payload: any): Promise<NormalizedInbound | null>;
  disconnectSession(sessionId: string): Promise<void>;
}

/** Provider-agnostic shape we normalize every inbound webhook into. */
export interface NormalizedInbound {
  sessionId: string;
  from: string; // phone in E.164-ish form (digits only)
  fromName?: string | null;
  body: string;
  mediaUrl?: string | null;
  messageType: 'text' | 'image' | 'audio' | 'video' | 'document' | 'unknown';
  timestamp: number;
  raw?: any;
}

/** Normalize phone to digits only (drop +, spaces, the @c.us suffix, etc). */
export function normalizePhone(input: string): string {
  return String(input || '')
    .replace(/@c\.us$/i, '')
    .replace(/[^\d]/g, '');
}

// ───────────────────────── Live OpenWA gateway ──────────────────────────────
class OpenWaAdapter implements WhatsAppGateway {
  private http: AxiosInstance;

  constructor(baseUrl: string, apiKey: string) {
    this.http = axios.create({
      baseURL: baseUrl.replace(/\/+$/, ''),
      timeout: 30_000,
      headers: apiKey ? { api_key: apiKey, Authorization: `Bearer ${apiKey}` } : {},
    });
  }

  async createSession(sessionId: string): Promise<SessionResponse> {
    const { data } = await this.http.post(`/api/sessions`, { sessionId });
    return {
      sessionId,
      status: (data?.status as SessionState) || 'initializing',
      qrCode: data?.qr || data?.qrCode || null,
      phoneNumber: data?.phoneNumber || null,
    };
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    const { data } = await this.http.get(`/api/sessions/${encodeURIComponent(sessionId)}/status`);
    return {
      sessionId,
      status: (data?.status as SessionState) || 'disconnected',
      qrCode: data?.qr || data?.qrCode || null,
      phoneNumber: data?.phoneNumber || null,
      lastConnectedAt: data?.lastConnectedAt || null,
    };
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    try {
      const { data } = await this.http.post(`/api/sessions/${encodeURIComponent(sessionId)}/send-text`, {
        to: phone,
        content: message,
      });
      return { ok: true, messageId: data?.messageId || data?.id || null, to: phone };
    } catch (e: any) {
      return { ok: false, to: phone, error: e?.response?.data?.error || e?.message || 'send failed' };
    }
  }

  async sendMedia(sessionId: string, to: string, mediaUrl: string, caption?: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    try {
      const { data } = await this.http.post(`/api/sessions/${encodeURIComponent(sessionId)}/send-media`, {
        to: phone,
        url: mediaUrl,
        caption: caption || '',
      });
      return { ok: true, messageId: data?.messageId || data?.id || null, to: phone };
    } catch (e: any) {
      return { ok: false, to: phone, error: e?.response?.data?.error || e?.message || 'send media failed' };
    }
  }

  async receiveWebhook(payload: any): Promise<NormalizedInbound | null> {
    return normalizeInbound(payload);
  }

  async disconnectSession(sessionId: string): Promise<void> {
    try {
      await this.http.post(`/api/sessions/${encodeURIComponent(sessionId)}/logout`, {});
    } catch (e: any) {
      logger.warn('[openwa] logout failed:', e?.message);
    }
  }
}

// ───────────────────────── Simulation adapter ───────────────────────────────
// Used when OPENWA_BASE_URL is not configured. Lets the whole module run end to
// end in local dev (QR is a placeholder, messages are logged but not sent).
class SimulatedWhatsAppGateway implements WhatsAppGateway {
  private sessions = new Map<string, SessionStatus>();

  async createSession(sessionId: string): Promise<SessionResponse> {
    // A tiny inline SVG QR placeholder so the UI has something to render.
    const qr =
      'data:image/svg+xml;base64,' +
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240"><rect width="240" height="240" fill="#0b0f14"/><text x="120" y="120" fill="#22c55e" font-size="14" text-anchor="middle" font-family="monospace">SIMULATED QR</text><text x="120" y="145" fill="#64748b" font-size="10" text-anchor="middle" font-family="monospace">${sessionId.slice(0, 18)}</text></svg>`,
      ).toString('base64');
    const status: SessionStatus = { sessionId, status: 'qr', qrCode: qr, phoneNumber: null, lastConnectedAt: null };
    this.sessions.set(sessionId, status);
    // Auto-"connect" after a short delay to emulate scanning the QR.
    setTimeout(() => {
      const s = this.sessions.get(sessionId);
      if (s) this.sessions.set(sessionId, { ...s, status: 'connected', qrCode: null, lastConnectedAt: Date.now() });
    }, 6000);
    return { sessionId, status: 'qr', qrCode: qr, phoneNumber: null };
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    return this.sessions.get(sessionId) || { sessionId, status: 'disconnected', qrCode: null, phoneNumber: null };
  }

  async sendMessage(sessionId: string, to: string, message: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    logger.info(`[whatsapp:sim] → ${phone}: ${message.slice(0, 80)}`);
    return { ok: true, messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, to: phone, simulated: true };
  }

  async sendMedia(sessionId: string, to: string, mediaUrl: string, caption?: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    logger.info(`[whatsapp:sim] → ${phone} [media ${mediaUrl}] ${caption || ''}`);
    return { ok: true, messageId: `sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, to: phone, simulated: true };
  }

  async receiveWebhook(payload: any): Promise<NormalizedInbound | null> {
    return normalizeInbound(payload);
  }

  async disconnectSession(sessionId: string): Promise<void> {
    const s = this.sessions.get(sessionId);
    if (s) this.sessions.set(sessionId, { ...s, status: 'disconnected', qrCode: null });
  }
}

/**
 * Normalize an OpenWA-style webhook payload into our NormalizedInbound shape.
 * OpenWA emits messages under various keys depending on version; we accept the
 * common ones and degrade gracefully.
 */
export function normalizeInbound(payload: any): NormalizedInbound | null {
  if (!payload) return null;
  const msg = payload.message || payload.data || payload.msg || payload;
  // OpenWA marks our own outbound messages with fromMe — ignore those.
  if (msg?.fromMe === true || msg?.self === 'in' && msg?.fromMe) return null;

  const fromRaw = msg?.from || msg?.author || payload.from;
  if (!fromRaw) return null;
  const sessionId = payload.sessionId || payload.session || payload.instanceId || msg?.sessionId || '';
  const type = (msg?.type || '').toLowerCase();
  let messageType: NormalizedInbound['messageType'] = 'unknown';
  if (!type || type === 'chat' || type === 'text') messageType = 'text';
  else if (['image', 'audio', 'video', 'document', 'ptt'].includes(type)) {
    messageType = type === 'ptt' ? 'audio' : (type as any);
  }

  return {
    sessionId,
    from: normalizePhone(fromRaw),
    fromName: msg?.notifyName || msg?.sender?.pushname || msg?.pushname || null,
    body: msg?.body || msg?.content || msg?.text || '',
    mediaUrl: msg?.mediaUrl || msg?.deprecatedMms3Url || null,
    messageType,
    timestamp: (msg?.t ? Number(msg.t) * 1000 : Date.now()),
    raw: msg,
  };
}

// ───────────────────────── Singleton resolver ───────────────────────────────
let _gateway: WhatsAppGateway | null = null;

export function isGatewayConfigured(): boolean {
  return !!process.env.OPENWA_BASE_URL;
}

export function getGateway(): WhatsAppGateway {
  if (_gateway) return _gateway;
  const baseUrl = process.env.OPENWA_BASE_URL;
  const apiKey = process.env.OPENWA_API_KEY || '';
  if (baseUrl) {
    logger.info('[whatsapp] using live OpenWA gateway at', baseUrl);
    _gateway = new OpenWaAdapter(baseUrl, apiKey);
  } else {
    logger.warn('[whatsapp] OPENWA_BASE_URL not set — running WhatsApp gateway in SIMULATION mode');
    _gateway = new SimulatedWhatsAppGateway();
  }
  return _gateway;
}
