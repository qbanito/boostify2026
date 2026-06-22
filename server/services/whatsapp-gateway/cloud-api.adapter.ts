/**
 * WhatsApp Gateway Adapter — Meta WhatsApp Business Cloud API (OFFICIAL)
 * ---------------------------------------------------------------------------
 * Production-grade, official Meta API. Unlike OpenWA there is NO QR pairing and
 * no risk of number bans: Boostify sends through a verified WhatsApp Business
 * number (Phone Number ID) using a permanent System User access token.
 *
 * This class implements the SAME `WhatsAppGateway` contract as the OpenWA
 * adapter, so selecting it is just a matter of the WHATSAPP_PROVIDER env flag —
 * nothing else in the routes, hooks or UI changes.
 *
 * Configuration (env):
 *   WHATSAPP_PROVIDER=cloud          Switch getGateway() to this adapter
 *   WHATSAPP_ACCESS_TOKEN            Permanent System User token (never expires)
 *   WHATSAPP_PHONE_NUMBER_ID         The sending number's Phone Number ID
 *   WHATSAPP_WABA_ID                 WhatsApp Business Account id (optional)
 *   WHATSAPP_API_VERSION             Graph API version (default: v21.0)
 *   WHATSAPP_VERIFY_TOKEN            Webhook GET verification token (you pick it)
 *   WHATSAPP_APP_SECRET             (optional) verify X-Hub-Signature-256
 *
 * ⚠️ COMPLIANCE: Free-form text only works inside the 24h customer-service
 * window (the user messaged you first). Business-initiated / cold outreach
 * (campaigns) REQUIRES a pre-approved message TEMPLATE — use sendTemplate().
 *
 * Docs: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
import axios, { AxiosInstance } from 'axios';
import { logger } from '../../utils/logger';
import {
  WhatsAppGateway,
  SessionResponse,
  SessionStatus,
  MessageResponse,
  NormalizedInbound,
  normalizePhone,
} from './openwa.adapter';

const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

export class CloudApiAdapter implements WhatsAppGateway {
  private http: AxiosInstance;
  private phoneNumberId: string;
  private displayNumber: string | null = null;

  constructor(accessToken: string, phoneNumberId: string) {
    this.phoneNumberId = phoneNumberId;
    this.http = axios.create({
      baseURL: `https://graph.facebook.com/${API_VERSION}`,
      timeout: 30_000,
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });
  }

  /**
   * Cloud API has no QR/session handshake — the number is already verified with
   * Meta. We simply confirm the Phone Number ID is reachable and report the
   * display number so the UI shows "connected" with the real number.
   */
  async createSession(_sessionId: string): Promise<SessionResponse> {
    try {
      const { data } = await this.http.get(`/${this.phoneNumberId}`, {
        params: { fields: 'display_phone_number,verified_name,quality_rating' },
      });
      this.displayNumber = data?.display_phone_number || null;
      return { sessionId: _sessionId, status: 'connected', qrCode: null, phoneNumber: this.displayNumber };
    } catch (e: any) {
      logger.error('[whatsapp:cloud] createSession failed:', e?.response?.data?.error?.message || e?.message);
      return { sessionId: _sessionId, status: 'error', qrCode: null, phoneNumber: null };
    }
  }

  async getSessionStatus(sessionId: string): Promise<SessionStatus> {
    try {
      const { data } = await this.http.get(`/${this.phoneNumberId}`, {
        params: { fields: 'display_phone_number,verified_name' },
      });
      this.displayNumber = data?.display_phone_number || this.displayNumber;
      return { sessionId, status: 'connected', qrCode: null, phoneNumber: this.displayNumber, lastConnectedAt: Date.now() };
    } catch (e: any) {
      return { sessionId, status: 'disconnected', qrCode: null, phoneNumber: this.displayNumber };
    }
  }

  /** Free-form text message (only valid inside the 24h service window). */
  async sendMessage(_sessionId: string, to: string, message: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    try {
      const { data } = await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'text',
        text: { preview_url: true, body: message },
      });
      return { ok: true, messageId: data?.messages?.[0]?.id || null, to: phone };
    } catch (e: any) {
      const err = e?.response?.data?.error;
      return { ok: false, to: phone, error: err?.message || e?.message || 'send failed' };
    }
  }

  /** Image/document by URL (also valid only inside the 24h window). */
  async sendMedia(_sessionId: string, to: string, mediaUrl: string, caption?: string): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    const isVideo = /\.(mp4|mov|3gp)(\?|$)/i.test(mediaUrl);
    const isDoc = /\.(pdf|docx?|xlsx?|pptx?)(\?|$)/i.test(mediaUrl);
    const type = isVideo ? 'video' : isDoc ? 'document' : 'image';
    try {
      const { data } = await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type,
        [type]: { link: mediaUrl, ...(caption ? { caption } : {}) },
      });
      return { ok: true, messageId: data?.messages?.[0]?.id || null, to: phone };
    } catch (e: any) {
      const err = e?.response?.data?.error;
      return { ok: false, to: phone, error: err?.message || e?.message || 'send media failed' };
    }
  }

  /**
   * Send a PRE-APPROVED template — REQUIRED for business-initiated / cold
   * outreach (campaigns) outside the 24h window. `components` follows the Meta
   * template component schema (body params, header media, buttons).
   */
  async sendTemplate(
    to: string,
    templateName: string,
    languageCode = 'es',
    components?: any[],
  ): Promise<MessageResponse> {
    const phone = normalizePhone(to);
    try {
      const { data } = await this.http.post(`/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phone,
        type: 'template',
        template: {
          name: templateName,
          language: { code: languageCode },
          ...(components && components.length ? { components } : {}),
        },
      });
      return { ok: true, messageId: data?.messages?.[0]?.id || null, to: phone };
    } catch (e: any) {
      const err = e?.response?.data?.error;
      return { ok: false, to: phone, error: err?.message || e?.message || 'send template failed' };
    }
  }

  async receiveWebhook(payload: any): Promise<NormalizedInbound | null> {
    return normalizeCloudInbound(payload);
  }

  /** Cloud API numbers are always "logged in" — nothing to disconnect. */
  async disconnectSession(_sessionId: string): Promise<void> {
    /* no-op for the official API */
  }
}

/**
 * Normalize a Meta Cloud API webhook payload into our NormalizedInbound shape.
 * Meta wraps everything in entry[].changes[].value with parallel `messages` and
 * `contacts` arrays. Status callbacks (sent/delivered/read) have no `messages`.
 */
export function normalizeCloudInbound(payload: any): NormalizedInbound | null {
  try {
    const change = payload?.entry?.[0]?.changes?.[0];
    const value = change?.value;
    const msg = value?.messages?.[0];
    if (!msg) return null; // status callbacks etc. — ignore

    const phoneNumberId = value?.metadata?.phone_number_id || '';
    const contact = value?.contacts?.[0];
    const from = normalizePhone(msg.from);
    const type = (msg.type || 'text').toLowerCase();

    let body = '';
    let mediaUrl: string | null = null;
    let messageType: NormalizedInbound['messageType'] = 'unknown';
    if (type === 'text') { messageType = 'text'; body = msg.text?.body || ''; }
    else if (type === 'interactive') {
      messageType = 'text';
      body = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    }
    else if (type === 'button') { messageType = 'text'; body = msg.button?.text || ''; }
    else if (['image', 'audio', 'video', 'document'].includes(type)) {
      messageType = type as any;
      // Media must be fetched via the media id through a second Graph call;
      // we store the id so a downloader can resolve it if/when needed.
      mediaUrl = msg[type]?.id ? `wamid-media:${msg[type].id}` : null;
      body = msg[type]?.caption || '';
    }

    return {
      // Encode the Phone Number ID so the route can map it → artist.
      sessionId: phoneNumberId ? `cloud:${phoneNumberId}` : '',
      from,
      fromName: contact?.profile?.name || null,
      body,
      mediaUrl,
      messageType,
      timestamp: msg.timestamp ? Number(msg.timestamp) * 1000 : Date.now(),
      raw: { msg, phoneNumberId },
    };
  } catch {
    return null;
  }
}

export function isCloudApiConfigured(): boolean {
  return process.env.WHATSAPP_PROVIDER === 'cloud'
    && !!process.env.WHATSAPP_ACCESS_TOKEN
    && !!process.env.WHATSAPP_PHONE_NUMBER_ID;
}
