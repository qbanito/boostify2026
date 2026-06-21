// ───────────────────────────────────────────────────────────────────────────
// Discord Fan Nation — Gateway Adapter
// Talks to the Discord REST API (https://discord.com/api/v10) using the official
// Boostify bot token (Authorization: Bot <token>) for guild operations, plus
// OAuth2 (https://discord.com/api/oauth2/token) so an artist can connect their
// account / pick a server. When DISCORD_BOT_TOKEN is missing the adapter runs in
// SIMULATION mode so the module is fully usable without real Discord credentials.
//
// SECURITY: the bot token is an app-level secret and NEVER reaches the browser.
// Per-artist OAuth access/refresh tokens are AES-256-GCM encrypted at rest.
// We only ever request the minimum scopes / permissions needed.
// ───────────────────────────────────────────────────────────────────────────
import axios from 'axios';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

const API_BASE = 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN || '';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID || '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || '';

// Minimum bot permissions we request when installing into a guild.
// MANAGE_ROLES(0x10000000) | MANAGE_CHANNELS(0x10) | SEND_MESSAGES(0x800) |
// MANAGE_GUILD(0x20) | KICK(0x2) | BAN(0x4) | MANAGE_EVENTS(0x200000000) |
// CREATE_INSTANT_INVITE(0x1) | MODERATE_MEMBERS(0x10000000000) | EMBED_LINKS(0x4000)
export const REQUIRED_BOT_PERMISSIONS = '1099780115030';

export type GuildStatusState = 'connected' | 'disconnected' | 'missing_permissions' | 'error' | 'initializing';

export interface GuildConnectionResponse {
  guildId: string;
  guildName?: string | null;
  status: GuildStatusState;
  botInstalled: boolean;
  ownerId?: string | null;
  iconUrl?: string | null;
  memberCount?: number | null;
  error?: string | null;
  simulated?: boolean;
}

export interface GuildStatus {
  guildId: string;
  guildName?: string | null;
  status: GuildStatusState;
  botInstalled: boolean;
  memberCount?: number | null;
  iconUrl?: string | null;
  simulated?: boolean;
  error?: string | null;
}

export interface ChannelResponse { ok: boolean; channelId?: string | null; name: string; type: string; error?: string | null; simulated?: boolean; }
export interface RoleResponse { ok: boolean; roleId?: string | null; name: string; color?: number; error?: string | null; simulated?: boolean; }
export interface MessageResponse { ok: boolean; messageId?: string | null; channelId: string; error?: string | null; simulated?: boolean; }
export interface EventResponse { ok: boolean; eventId?: string | null; title: string; error?: string | null; simulated?: boolean; }

export interface OAuthResult {
  ok: boolean;
  discordUserId?: string | null;
  username?: string | null;
  accessTokenEnc?: string | null;
  refreshTokenEnc?: string | null;
  guilds?: Array<{ id: string; name: string; icon?: string | null; owner?: boolean; permissions?: string }>;
  error?: string | null;
  simulated?: boolean;
}

export interface EventPayload {
  title: string;
  description?: string;
  startTime: string; // ISO
  endTime?: string;   // ISO
  channelId?: string;
  location?: string;
}

export interface NormalizedDiscordInbound {
  guildId?: string | null;
  channelId?: string | null;
  discordUserId: string;
  username?: string | null;
  body: string;
  messageType: 'message' | 'interaction' | 'member_join' | 'unknown';
  command?: string | null;
  timestamp: number;
  raw?: any;
}

export interface DiscordGateway {
  isSimulated(): boolean;
  buildInstallUrl(state: string): string;
  exchangeOAuth(code: string): Promise<OAuthResult>;
  getGuildStatus(guildId: string): Promise<GuildStatus>;
  createChannel(guildId: string, name: string, type: string): Promise<ChannelResponse>;
  createRole(guildId: string, name: string, opts?: { color?: number; permissions?: string }): Promise<RoleResponse>;
  assignRole(guildId: string, userId: string, roleId: string): Promise<{ ok: boolean; error?: string | null; simulated?: boolean }>;
  removeRole(guildId: string, userId: string, roleId: string): Promise<{ ok: boolean; error?: string | null; simulated?: boolean }>;
  sendMessage(channelId: string, message: string, opts?: { buttons?: Array<{ label: string; url: string }> }): Promise<MessageResponse>;
  sendMedia(channelId: string, mediaUrl: string, caption?: string): Promise<MessageResponse>;
  createEvent(guildId: string, payload: EventPayload): Promise<EventResponse>;
}

// ── Recommended server structure (Setup Wizard) ──────────────────────────────
export const RECOMMENDED_CHANNELS: Array<{ name: string; type: string; description: string }> = [
  { name: 'announcements', type: 'announcement', description: 'Official drops & news from the artist' },
  { name: 'new-releases', type: 'text', description: 'Every new song, video & project' },
  { name: 'vip-fans', type: 'text', description: 'Private lounge for VIP & Super Fans' },
  { name: 'general-chat', type: 'text', description: 'Hang out with the community' },
  { name: 'ticket-support', type: 'text', description: 'Help with tickets & passes' },
  { name: 'merch-drops', type: 'text', description: 'Limited merch & restocks' },
  { name: 'live-events', type: 'text', description: 'Watch parties, lives & Q&As' },
  { name: 'btf-holders', type: 'text', description: 'Token-gated channel for $BTF holders' },
  { name: 'backstage', type: 'text', description: 'Behind-the-scenes content' },
  { name: 'fan-challenges', type: 'text', description: 'Missions, contests & giveaways' },
];

export const RECOMMENDED_ROLES: Array<{ name: string; color: number; accessLevel: string; ruleType: string }> = [
  { name: 'Fan', color: 0x95a5a6, accessLevel: 'free', ruleType: 'default' },
  { name: 'VIP Fan', color: 0x5865f2, accessLevel: 'vip', ruleType: 'purchase' },
  { name: 'Super Fan', color: 0xeb459e, accessLevel: 'super', ruleType: 'engagement' },
  { name: 'BTF Holder', color: 0xf1c40f, accessLevel: 'token', ruleType: 'btf_balance' },
  { name: 'Ticket Buyer', color: 0x2ecc71, accessLevel: 'buyer', ruleType: 'ticket_purchase' },
  { name: 'Merch Buyer', color: 0xe67e22, accessLevel: 'buyer', ruleType: 'merch_purchase' },
  { name: 'Moderator', color: 0x3498db, accessLevel: 'staff', ruleType: 'manual' },
  { name: 'Artist Team', color: 0x9b59b6, accessLevel: 'staff', ruleType: 'manual' },
  { name: 'Founder Fan', color: 0xe74c3c, accessLevel: 'founder', ruleType: 'manual' },
];

// ── Token encryption (AES-256-GCM) for per-artist OAuth tokens ───────────────
function deriveKey(): Buffer {
  const raw = process.env.DISCORD_TOKEN_ENC_KEY || process.env.DISCORD_CLIENT_SECRET || process.env.OPENWA_API_KEY || 'boostify-discord-dev-key';
  return crypto.createHash('sha256').update(raw).digest();
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
  if (!payload || payload === 'SIMULATION') return payload || '';
  try {
    const [ivB, tagB, dataB] = payload.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', deriveKey(), Buffer.from(ivB, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
  } catch { return ''; }
}

export function isDiscordConfigured(): boolean {
  return !!(BOT_TOKEN && CLIENT_ID);
}

// Discord channel type ints → our labels
const CHANNEL_TYPE_MAP: Record<string, number> = { text: 0, announcement: 5, voice: 2, forum: 15, stage: 13 };

function botHeaders() {
  return { Authorization: `Bot ${BOT_TOKEN}`, 'Content-Type': 'application/json' };
}

// ── Real adapter ─────────────────────────────────────────────────────────────
class DiscordApiAdapter implements DiscordGateway {
  isSimulated() { return false; }

  buildInstallUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      permissions: REQUIRED_BOT_PERMISSIONS,
      scope: 'bot applications.commands identify guilds',
      response_type: 'code',
      redirect_uri: REDIRECT_URI,
      state,
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
  }

  async exchangeOAuth(code: string): Promise<OAuthResult> {
    try {
      const body = new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      });
      const tokenRes = await axios.post(`${API_BASE}/oauth2/token`, body.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 12000,
      });
      const access = tokenRes.data?.access_token as string;
      const refresh = tokenRes.data?.refresh_token as string;
      const userRes = await axios.get(`${API_BASE}/users/@me`, { headers: { Authorization: `Bearer ${access}` }, timeout: 10000 });
      let guilds: OAuthResult['guilds'] = [];
      try {
        const gRes = await axios.get(`${API_BASE}/users/@me/guilds`, { headers: { Authorization: `Bearer ${access}` }, timeout: 10000 });
        guilds = (gRes.data || []).map((g: any) => ({ id: g.id, name: g.name, icon: g.icon, owner: g.owner, permissions: g.permissions }));
      } catch { /* guilds scope optional */ }
      return {
        ok: true,
        discordUserId: userRes.data?.id,
        username: userRes.data?.username,
        accessTokenEnc: encryptToken(access),
        refreshTokenEnc: encryptToken(refresh || ''),
        guilds,
      };
    } catch (e: any) {
      logger.error('[discord] oauth exchange failed:', e?.response?.data || e?.message);
      return { ok: false, error: e?.response?.data?.error_description || e?.message || 'OAuth exchange failed' };
    }
  }

  async getGuildStatus(guildId: string): Promise<GuildStatus> {
    try {
      const res = await axios.get(`${API_BASE}/guilds/${guildId}?with_counts=true`, { headers: botHeaders(), timeout: 10000 });
      return {
        guildId,
        guildName: res.data?.name,
        status: 'connected',
        botInstalled: true,
        memberCount: res.data?.approximate_member_count ?? null,
        iconUrl: res.data?.icon ? `https://cdn.discordapp.com/icons/${guildId}/${res.data.icon}.png` : null,
      };
    } catch (e: any) {
      const code = e?.response?.status;
      if (code === 403) return { guildId, status: 'missing_permissions', botInstalled: true, error: 'Missing permissions' };
      if (code === 404) return { guildId, status: 'disconnected', botInstalled: false, error: 'Bot not in guild' };
      return { guildId, status: 'error', botInstalled: false, error: e?.message || 'Status check failed' };
    }
  }

  async createChannel(guildId: string, name: string, type: string): Promise<ChannelResponse> {
    try {
      const res = await axios.post(`${API_BASE}/guilds/${guildId}/channels`,
        { name, type: CHANNEL_TYPE_MAP[type] ?? 0 }, { headers: botHeaders(), timeout: 10000 });
      return { ok: true, channelId: res.data?.id, name, type };
    } catch (e: any) {
      return { ok: false, name, type, error: e?.response?.data?.message || e?.message };
    }
  }

  async createRole(guildId: string, name: string, opts?: { color?: number; permissions?: string }): Promise<RoleResponse> {
    try {
      const res = await axios.post(`${API_BASE}/guilds/${guildId}/roles`,
        { name, color: opts?.color ?? 0, hoist: true, mentionable: true, permissions: opts?.permissions ?? '0' },
        { headers: botHeaders(), timeout: 10000 });
      return { ok: true, roleId: res.data?.id, name, color: opts?.color };
    } catch (e: any) {
      return { ok: false, name, error: e?.response?.data?.message || e?.message };
    }
  }

  async assignRole(guildId: string, userId: string, roleId: string) {
    try {
      await axios.put(`${API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`, {}, { headers: botHeaders(), timeout: 10000 });
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e?.response?.data?.message || e?.message }; }
  }

  async removeRole(guildId: string, userId: string, roleId: string) {
    try {
      await axios.delete(`${API_BASE}/guilds/${guildId}/members/${userId}/roles/${roleId}`, { headers: botHeaders(), timeout: 10000 });
      return { ok: true };
    } catch (e: any) { return { ok: false, error: e?.response?.data?.message || e?.message }; }
  }

  async sendMessage(channelId: string, message: string, opts?: { buttons?: Array<{ label: string; url: string }> }): Promise<MessageResponse> {
    try {
      const payload: any = { content: message.slice(0, 2000) };
      if (opts?.buttons?.length) {
        payload.components = [{
          type: 1,
          components: opts.buttons.slice(0, 5).map((b) => ({ type: 2, style: 5, label: b.label.slice(0, 80), url: b.url })),
        }];
      }
      const res = await axios.post(`${API_BASE}/channels/${channelId}/messages`, payload, { headers: botHeaders(), timeout: 10000 });
      return { ok: true, messageId: res.data?.id, channelId };
    } catch (e: any) {
      return { ok: false, channelId, error: e?.response?.data?.message || e?.message };
    }
  }

  async sendMedia(channelId: string, mediaUrl: string, caption?: string): Promise<MessageResponse> {
    try {
      const payload = { content: caption ? caption.slice(0, 1800) : '', embeds: [{ image: { url: mediaUrl } }] };
      const res = await axios.post(`${API_BASE}/channels/${channelId}/messages`, payload, { headers: botHeaders(), timeout: 10000 });
      return { ok: true, messageId: res.data?.id, channelId };
    } catch (e: any) {
      return { ok: false, channelId, error: e?.response?.data?.message || e?.message };
    }
  }

  async createEvent(guildId: string, payload: EventPayload): Promise<EventResponse> {
    try {
      const body: any = {
        name: payload.title.slice(0, 100),
        description: (payload.description || '').slice(0, 1000),
        scheduled_start_time: payload.startTime,
        scheduled_end_time: payload.endTime,
        privacy_level: 2,
        entity_type: payload.channelId ? 2 : 3, // 2=voice, 3=external
        ...(payload.channelId ? { channel_id: payload.channelId } : { entity_metadata: { location: payload.location || 'Boostify Live' }, scheduled_end_time: payload.endTime || payload.startTime }),
      };
      const res = await axios.post(`${API_BASE}/guilds/${guildId}/scheduled-events`, body, { headers: botHeaders(), timeout: 10000 });
      return { ok: true, eventId: res.data?.id, title: payload.title };
    } catch (e: any) {
      return { ok: false, title: payload.title, error: e?.response?.data?.message || e?.message };
    }
  }
}

// ── Simulation adapter (no Discord credentials) ──────────────────────────────
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}
let simSeq = 1000;
function simId(): string { return String(17000000000000000 + simSeq++); }

class DiscordSimulationAdapter implements DiscordGateway {
  isSimulated() { return true; }

  buildInstallUrl(state: string): string {
    return `https://discord.com/oauth2/authorize?simulated=1&state=${encodeURIComponent(state)}`;
  }

  async exchangeOAuth(code: string): Promise<OAuthResult> {
    const seed = hashStr(code || 'sim');
    const gid = String(17000000000000000 + (seed % 9000));
    return {
      ok: true,
      discordUserId: String(900000000000000 + (seed % 99999)),
      username: 'artist_demo',
      accessTokenEnc: 'SIMULATION',
      refreshTokenEnc: 'SIMULATION',
      simulated: true,
      guilds: [
        { id: gid, name: 'Fan Nation HQ', owner: true, permissions: '8' },
        { id: String(Number(gid) + 11), name: 'My Music Server', owner: true, permissions: '8' },
      ],
    };
  }

  async getGuildStatus(guildId: string): Promise<GuildStatus> {
    const seed = hashStr(guildId);
    return {
      guildId,
      guildName: 'Fan Nation HQ',
      status: 'connected',
      botInstalled: true,
      memberCount: 1200 + (seed % 8000),
      iconUrl: null,
      simulated: true,
    };
  }

  async createChannel(guildId: string, name: string, type: string): Promise<ChannelResponse> {
    return { ok: true, channelId: simId(), name, type, simulated: true };
  }
  async createRole(guildId: string, name: string, opts?: { color?: number }): Promise<RoleResponse> {
    return { ok: true, roleId: simId(), name, color: opts?.color, simulated: true };
  }
  async assignRole() { return { ok: true, simulated: true }; }
  async removeRole() { return { ok: true, simulated: true }; }
  async sendMessage(channelId: string): Promise<MessageResponse> {
    return { ok: true, messageId: simId(), channelId, simulated: true };
  }
  async sendMedia(channelId: string): Promise<MessageResponse> {
    return { ok: true, messageId: simId(), channelId, simulated: true };
  }
  async createEvent(guildId: string, payload: EventPayload): Promise<EventResponse> {
    return { ok: true, eventId: simId(), title: payload.title, simulated: true };
  }
}

// ── Singleton ────────────────────────────────────────────────────────────────
let gateway: DiscordGateway | null = null;
export function getDiscordGateway(): DiscordGateway {
  if (gateway) return gateway;
  gateway = isDiscordConfigured() ? new DiscordApiAdapter() : new DiscordSimulationAdapter();
  if (!isDiscordConfigured()) logger.warn('[discord] DISCORD_BOT_TOKEN/CLIENT_ID not set — Discord Fan Nation running in SIMULATION mode');
  return gateway;
}

// ── Inbound webhook / interaction normalizer ─────────────────────────────────
export function normalizeDiscordEvent(payload: any): NormalizedDiscordInbound | null {
  if (!payload) return null;
  // Slash-command interaction
  if (payload.type === 2 && payload.data) {
    return {
      guildId: payload.guild_id || null,
      channelId: payload.channel_id || null,
      discordUserId: payload.member?.user?.id || payload.user?.id || 'unknown',
      username: payload.member?.user?.username || payload.user?.username || null,
      body: payload.data?.options?.map((o: any) => `${o.name}:${o.value}`).join(' ') || '',
      messageType: 'interaction',
      command: payload.data?.name || null,
      timestamp: Date.now(),
      raw: payload,
    };
  }
  // Gateway MESSAGE_CREATE-style payload (via a relay)
  if (payload.content !== undefined && payload.author) {
    return {
      guildId: payload.guild_id || null,
      channelId: payload.channel_id || null,
      discordUserId: payload.author?.id || 'unknown',
      username: payload.author?.username || null,
      body: payload.content || '',
      messageType: 'message',
      timestamp: Date.now(),
      raw: payload,
    };
  }
  // Member join
  if (payload.type === 'GUILD_MEMBER_ADD' || payload.member_join) {
    return {
      guildId: payload.guild_id || null,
      channelId: null,
      discordUserId: payload.user?.id || payload.member_join?.id || 'unknown',
      username: payload.user?.username || null,
      body: '',
      messageType: 'member_join',
      timestamp: Date.now(),
      raw: payload,
    };
  }
  return null;
}
