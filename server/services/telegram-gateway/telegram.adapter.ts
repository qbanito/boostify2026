// ───────────────────────────────────────────────────────────────────────────
// Telegram Artist Command Center — Gateway Adapter
// Talks to the Telegram Bot API (https://api.telegram.org/bot<token>/METHOD) or
// a self-hosted Bot API server (TELEGRAM_BOT_API_BASE_URL). Token-based: the
// artist pastes their @BotFather token, we validate via getMe and register a
// per-artist webhook. A simulation mode (token "demo"/"sim") lets the module be
// tried without a real bot.
//
// Bot tokens are NEVER exposed to the browser. They are AES-256-GCM encrypted at
// rest in Firestore and only decrypted inside the backend.
// ───────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const TG_API_BASE = (process.env.TELEGRAM_BOT_API_BASE_URL || 'https://api.telegram.org').replace(/\/+$/, '');

export type BotStatusState = 'connected' | 'disconnected' | 'invalid' | 'error' | 'initializing';

export interface InlineButton { text: string; url: string; }

export interface BotConnectionResponse {
  botId: string;
  status: BotStatusState;
  botUsername?: string | null;
  botName?: string | null;
  error?: string | null;
  simulated?: boolean;
}

export interface BotStatus {
  botId: string;
  status: BotStatusState;
  botUsername?: string | null;
  botName?: string | null;
  lastConnectedAt?: number | null;
  simulated?: boolean;
}

export interface MessageResponse {
  ok: boolean;
  messageId?: string | number | null;
  chatId: string;
  error?: string | null;
  simulated?: boolean;
}

export interface InviteLinkResponse {
  ok: boolean;
  inviteLink?: string | null;
  error?: string | null;
  simulated?: boolean;
}

export interface NormalizedTelegramInbound {
  botId?: string;
  chatId: string;
  fromUserId: string;
  fromName?: string | null;
  username?: string | null;
  body: string;
  mediaUrl?: string | null;
  messageType: 'text' | 'photo' | 'audio' | 'video' | 'document' | 'unknown';
  timestamp: number;
  raw?: any;
}

export interface TelegramGateway {
  connectBot(artistId: string, botToken: string, opts?: { webhookUrl?: string; webhookSecret?: string }): Promise<BotConnectionResponse>;
  getBotStatus(botId: string): Promise<BotStatus>;
  sendMessage(botId: string, chatId: string, message: string, opts?: { buttons?: InlineButton[] }): Promise<MessageResponse>;
  sendMedia(botId: string, chatId: string, mediaUrl: string, caption?: string): Promise<MessageResponse>;
  createInviteLink(botId: string, chatId: string, opts?: { name?: string }): Promise<InviteLinkResponse>;
  receiveWebhook(payload: any): Promise<NormalizedTelegramInbound | null>;
  disconnectBot(botId: string): Promise<void>;
}

// ── Token encryption (AES-256-GCM) ───────────────────────────────────────────
function deriveKey(): Buffer {
  const raw = process.env.TELEGRAM_TOKEN_ENC_KEY || process.env.OPENWA_API_KEY || 'boostify-telegram-dev-key';
  return crypto.createHash('sha256').update(raw).digest(); // 32 bytes
}

export function encryptToken(token: string): string {
  if (!token) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const enc = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

export function decryptToken(payload: string): string {
  if (!payload) return '';
  if (payload === 'SIMULATION') return 'SIMULATION';
  try {
    const [ivB, tagB, dataB] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ── In-memory token cache (re-populated from Firestore on demand) ─────────────
const tokenCache = new Map<string, string>();
const simStatus = new Map<string, boolean>();

export function botIdFor(artistId: string): string {
  return `tg_${artistId}`;
}

export function cacheBotToken(botId: string, token: string): void {
  if (token) tokenCache.set(botId, token);
  if (token === 'SIMULATION') simStatus.set(botId, true);
}

function isSimToken(token: string): boolean {
  return /^(demo|sim|simulation|simular|test)$/i.test((token || '').trim());
}

export function normalizeTelegramUpdate(update: any): NormalizedTelegramInbound | null {
  if (!update) return null;
  const msg = update.message || update.channel_post || update.edited_message || update.edited_channel_post;
  if (!msg) return null;
  const chat = msg.chat || {};
  const from = msg.from || {};
  let messageType: NormalizedTelegramInbound['messageType'] = 'text';
  if (Array.isArray(msg.photo) && msg.photo.length) messageType = 'photo';
  else if (msg.video) messageType = 'video';
  else if (msg.voice || msg.audio) messageType = 'audio';
  else if (msg.document) messageType = 'document';
  else if (!msg.text && !msg.caption) messageType = 'unknown';
  const fromName = [from.first_name, from.last_name].filter(Boolean).join(' ') || chat.title || null;
  return {
    chatId: String(chat.id ?? from.id ?? ''),
    fromUserId: String(from.id ?? chat.id ?? ''),
    fromName,
    username: from.username || null,
    body: msg.text || msg.caption || '',
    mediaUrl: null,
    messageType,
    timestamp: msg.date ? msg.date * 1000 : Date.now(),
    raw: msg,
  };
}

// ── Real adapter ─────────────────────────────────────────────────────────────
class TelegramApiAdapter implements TelegramGateway {
  private async call(token: string, method: string, params: any): Promise<any> {
    const url = `${TG_API_BASE}/bot${token}/${method}`;
    const { data } = await axios.post(url, params, { timeout: 20000 });
    return data;
  }

  async connectBot(artistId: string, botToken: string, opts?: { webhookUrl?: string; webhookSecret?: string }): Promise<BotConnectionResponse> {
    const botId = botIdFor(artistId);
    const token = (botToken || '').trim();

    if (isSimToken(token)) {
      tokenCache.set(botId, 'SIMULATION');
      simStatus.set(botId, true);
      return { botId, status: 'connected', botUsername: 'boostify_demo_bot', botName: 'Boostify Demo Bot', simulated: true };
    }
    if (!token) return { botId, status: 'invalid', error: 'Empty bot token' };

    try {
      const me = await this.call(token, 'getMe', {});
      if (!me?.ok) return { botId, status: 'invalid', error: me?.description || 'getMe failed' };
      cacheBotToken(botId, token);
      simStatus.delete(botId);
      if (opts?.webhookUrl) {
        try {
          await this.call(token, 'setWebhook', {
            url: opts.webhookUrl,
            secret_token: opts.webhookSecret || undefined,
            allowed_updates: ['message', 'edited_message', 'channel_post', 'callback_query'],
            drop_pending_updates: false,
          });
        } catch (e: any) {
          logger.warn(`[telegram] setWebhook failed: ${e?.response?.data?.description || e?.message}`);
        }
      }
      return { botId, status: 'connected', botUsername: me.result?.username || null, botName: me.result?.first_name || null };
    } catch (e: any) {
      const desc = e?.response?.data?.description;
      return { botId, status: desc ? 'invalid' : 'error', error: desc || e?.message || 'connect failed' };
    }
  }

  async getBotStatus(botId: string): Promise<BotStatus> {
    if (simStatus.get(botId)) {
      return { botId, status: 'connected', botUsername: 'boostify_demo_bot', botName: 'Boostify Demo Bot', simulated: true };
    }
    const token = tokenCache.get(botId);
    if (!token) return { botId, status: 'disconnected' };
    if (token === 'SIMULATION') return { botId, status: 'connected', simulated: true };
    try {
      const me = await this.call(token, 'getMe', {});
      if (me?.ok) return { botId, status: 'connected', botUsername: me.result?.username, botName: me.result?.first_name, lastConnectedAt: Date.now() };
      return { botId, status: 'invalid' };
    } catch {
      return { botId, status: 'disconnected' };
    }
  }

  async sendMessage(botId: string, chatId: string, message: string, opts?: { buttons?: InlineButton[] }): Promise<MessageResponse> {
    const token = tokenCache.get(botId);
    if (!token) return { ok: false, chatId, error: 'bot not connected' };
    if (token === 'SIMULATION') {
      logger.info(`[telegram:sim] → ${chatId}: ${message.slice(0, 80)}`);
      return { ok: true, messageId: `sim_${Date.now()}`, chatId, simulated: true };
    }
    try {
      const params: any = { chat_id: chatId, text: message, parse_mode: 'HTML', disable_web_page_preview: false };
      if (opts?.buttons?.length) {
        params.reply_markup = { inline_keyboard: [opts.buttons.filter(b => b.url).map(b => ({ text: b.text, url: b.url }))] };
      }
      const data = await this.call(token, 'sendMessage', params);
      return { ok: !!data?.ok, messageId: data?.result?.message_id ?? null, chatId, error: data?.ok ? null : data?.description };
    } catch (e: any) {
      return { ok: false, chatId, error: e?.response?.data?.description || e?.message || 'send failed' };
    }
  }

  async sendMedia(botId: string, chatId: string, mediaUrl: string, caption?: string): Promise<MessageResponse> {
    const token = tokenCache.get(botId);
    if (!token) return { ok: false, chatId, error: 'bot not connected' };
    if (token === 'SIMULATION') {
      logger.info(`[telegram:sim] media → ${chatId}: ${mediaUrl}`);
      return { ok: true, messageId: `sim_${Date.now()}`, chatId, simulated: true };
    }
    try {
      const data = await this.call(token, 'sendPhoto', { chat_id: chatId, photo: mediaUrl, caption: caption || undefined, parse_mode: 'HTML' });
      return { ok: !!data?.ok, messageId: data?.result?.message_id ?? null, chatId, error: data?.ok ? null : data?.description };
    } catch (e: any) {
      return { ok: false, chatId, error: e?.response?.data?.description || e?.message || 'send media failed' };
    }
  }

  async createInviteLink(botId: string, chatId: string, opts?: { name?: string }): Promise<InviteLinkResponse> {
    const token = tokenCache.get(botId);
    if (!token) return { ok: false, error: 'bot not connected' };
    if (token === 'SIMULATION') {
      return { ok: true, inviteLink: `https://t.me/+sim${Math.random().toString(36).slice(2, 10)}`, simulated: true };
    }
    try {
      const data = await this.call(token, 'createChatInviteLink', { chat_id: chatId, name: opts?.name || undefined });
      if (data?.ok) return { ok: true, inviteLink: data.result?.invite_link || null };
      return { ok: false, error: data?.description || 'create invite failed' };
    } catch (e: any) {
      return { ok: false, error: e?.response?.data?.description || e?.message || 'create invite failed' };
    }
  }

  async receiveWebhook(payload: any): Promise<NormalizedTelegramInbound | null> {
    return normalizeTelegramUpdate(payload);
  }

  async disconnectBot(botId: string): Promise<void> {
    const token = tokenCache.get(botId);
    if (token && token !== 'SIMULATION') {
      try {
        await this.call(token, 'deleteWebhook', { drop_pending_updates: false });
      } catch {
        /* ignore */
      }
    }
    tokenCache.delete(botId);
    simStatus.delete(botId);
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
let gatewaySingleton: TelegramGateway | null = null;

export function getTelegramGateway(): TelegramGateway {
  if (!gatewaySingleton) gatewaySingleton = new TelegramApiAdapter();
  return gatewaySingleton;
}

export function isTelegramConfigured(): boolean {
  // The Telegram Bot API is reachable by default (api.telegram.org); a self-hosted
  // base url is optional. The module is "live" as soon as an artist pastes a token.
  return true;
}
