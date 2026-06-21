/**
 * Discord Fan Nation — API routes (mounted at /api/discord).
 * ---------------------------------------------------------------------------
 * Turns Discord into the premium community hub for each artist: connect a
 * server, run the setup wizard (channels + roles), manage roles, token-gate
 * VIP access with $BTF, run campaigns & events, reward fans, moderate with AI
 * and read full community analytics.
 *
 * The Boostify bot token is an app-level secret used by the backend only.
 * Per-artist OAuth tokens are AES-256-GCM encrypted at rest. When credentials
 * are missing the gateway runs in SIMULATION mode so the module is fully usable.
 *
 * Firestore (Admin-SDK only, client access denied by rules):
 *   artists/{artistId}/discordGuilds/{guildId}      — connected servers
 *   artists/{artistId}/discordConfig/main           — active guild + gating rules
 *   artists/{artistId}/discordRoles/{roleId}        — managed roles
 *   artists/{artistId}/discordChannels/{channelId}  — managed channels
 *   artists/{artistId}/discordMembers/{memberId}    — fan directory
 *   artists/{artistId}/discordCampaigns/{id}        — campaigns
 *   artists/{artistId}/discordEvents/{id}           — events
 *   artists/{artistId}/discordRewards/{id}          — rewards
 *   artists/{artistId}/discordAICommands/{id}       — concierge history
 *   artists/{artistId}/discordModeration/{id}       — moderation log
 *   artists/{artistId}/discordAuditLog/{id}         — compliance trail
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  getDiscordGateway, isDiscordConfigured, normalizeDiscordEvent,
  RECOMMENDED_CHANNELS, RECOMMENDED_ROLES,
} from '../services/discord-fan-nation/discord.adapter';
import {
  classifyConciergeCommand, buildConciergeReply, moderateMessage,
} from '../services/discord-fan-nation/discord.ai';
import {
  rankTopFans, growthStats, revenueStats, activityTimeline, vipRetention,
  qualifiesForTokenGate, type MemberLike,
} from '../services/discord-fan-nation/discord.analytics';

const router = Router();

function nowMs() { return Date.now(); }
function artistDoc(artistId: string) { return db.collection('artists').doc(String(artistId)); }
function uid(req: Request): string {
  return String((req.user as any)?.id ?? (req.user as any)?.uid ?? '');
}

// ─── Per-artist write rate limiter (protects Discord's API budget) ───────────
const actionBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_ACTIONS_PER_MINUTE = 30;
function checkRate(artistId: string): boolean {
  const key = String(artistId);
  const now = nowMs();
  const b = actionBuckets.get(key);
  if (!b || now > b.resetAt) { actionBuckets.set(key, { count: 1, resetAt: now + 60_000 }); return true; }
  if (b.count + 1 > MAX_ACTIONS_PER_MINUTE) return false;
  b.count += 1;
  return true;
}

async function audit(artistId: string, action: string, detail: any, ownerId?: string) {
  try {
    await artistDoc(artistId).collection('discordAuditLog').add({ action, detail: detail ?? null, ownerId: ownerId ?? null, at: nowMs() });
  } catch (e: any) {
    logger.warn('[discord] audit write failed:', e?.message);
  }
}

// ─── Config (active guild + gating rules) ─────────────────────────────────────
interface DiscordConfig {
  activeGuildId: string | null;
  tokenGate: { minBtf: number; requireVip: boolean; minSpent: number; roleId: string | null };
  autoRoles: boolean;
  updatedAt: number;
}
async function loadConfig(artistId: string): Promise<DiscordConfig> {
  const snap = await artistDoc(artistId).collection('discordConfig').doc('main').get();
  const d = (snap.exists ? snap.data() : {}) as Partial<DiscordConfig>;
  return {
    activeGuildId: d.activeGuildId || null,
    tokenGate: {
      minBtf: d.tokenGate?.minBtf ?? 1000,
      requireVip: d.tokenGate?.requireVip ?? false,
      minSpent: d.tokenGate?.minSpent ?? 0,
      roleId: d.tokenGate?.roleId ?? null,
    },
    autoRoles: d.autoRoles ?? true,
    updatedAt: d.updatedAt || 0,
  };
}

router.get('/config/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    res.json({ success: true, config: await loadConfig(req.params.artistId), configured: isDiscordConfigured() });
  } catch (e: any) {
    logger.error('[discord] get config:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to load config' });
  }
});

router.post('/config/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const cur = await loadConfig(artistId);
    const body = req.body || {};
    const next: DiscordConfig = {
      activeGuildId: body.activeGuildId !== undefined ? body.activeGuildId : cur.activeGuildId,
      tokenGate: {
        minBtf: Number(body.tokenGate?.minBtf ?? cur.tokenGate.minBtf),
        requireVip: Boolean(body.tokenGate?.requireVip ?? cur.tokenGate.requireVip),
        minSpent: Number(body.tokenGate?.minSpent ?? cur.tokenGate.minSpent),
        roleId: body.tokenGate?.roleId ?? cur.tokenGate.roleId,
      },
      autoRoles: body.autoRoles ?? cur.autoRoles,
      updatedAt: nowMs(),
    };
    await artistDoc(artistId).collection('discordConfig').doc('main').set(next, { merge: true });
    await audit(artistId, 'config.update', next, uid(req));
    res.json({ success: true, config: next });
  } catch (e: any) {
    logger.error('[discord] save config:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to save config' });
  }
});

// ─── OAuth: build install URL + handle callback ──────────────────────────────
router.get('/oauth/url/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const gateway = getDiscordGateway();
    const state = Buffer.from(JSON.stringify({ artistId: req.params.artistId, t: nowMs() })).toString('base64url');
    res.json({ success: true, url: gateway.buildInstallUrl(state), simulated: gateway.isSimulated() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to build install URL' });
  }
});

// Callback. Body: { code, artistId } (or simulated:true to fake a connection).
router.post('/oauth/callback', authenticate, async (req: Request, res: Response) => {
  try {
    const { code, artistId, simulated } = req.body || {};
    if (!artistId) return res.status(400).json({ success: false, error: 'artistId required' });
    const gateway = getDiscordGateway();
    const result = await gateway.exchangeOAuth(code || (simulated ? 'simulation' : ''));
    if (!result.ok) return res.status(400).json({ success: false, error: result.error || 'OAuth failed' });
    // Persist the (encrypted) tokens + available guilds for the picker.
    await artistDoc(artistId).collection('discordConfig').doc('oauth').set({
      discordUserId: result.discordUserId || null,
      username: result.username || null,
      accessTokenEnc: result.accessTokenEnc || null,
      refreshTokenEnc: result.refreshTokenEnc || null,
      connectedAt: nowMs(),
    }, { merge: true });
    await audit(artistId, 'oauth.connect', { discordUserId: result.discordUserId, guilds: result.guilds?.length || 0 }, uid(req));
    res.json({ success: true, username: result.username, guilds: result.guilds || [], simulated: !!result.simulated || gateway.isSimulated() });
  } catch (e: any) {
    logger.error('[discord] oauth callback:', e?.message);
    res.status(500).json({ success: false, error: 'OAuth callback failed' });
  }
});

// ─── Connect / select a guild ─────────────────────────────────────────────────
router.post('/guild/connect/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { guildId, guildName } = req.body || {};
    if (!guildId) return res.status(400).json({ success: false, error: 'guildId required' });
    const gateway = getDiscordGateway();
    const status = await gateway.getGuildStatus(String(guildId));
    const doc = {
      artistId: String(artistId),
      guildId: String(guildId),
      guildName: guildName || status.guildName || 'My Server',
      ownerId: uid(req),
      botInstalled: status.botInstalled,
      permissions: null,
      status: status.status,
      memberCount: status.memberCount ?? null,
      iconUrl: status.iconUrl ?? null,
      simulated: !!status.simulated,
      createdAt: nowMs(),
      updatedAt: nowMs(),
    };
    await artistDoc(artistId).collection('discordGuilds').doc(String(guildId)).set(doc, { merge: true });
    await artistDoc(artistId).collection('discordConfig').doc('main').set({ activeGuildId: String(guildId), updatedAt: nowMs() }, { merge: true });
    await audit(artistId, 'guild.connect', { guildId, status: status.status }, uid(req));
    res.json({ success: true, guild: doc });
  } catch (e: any) {
    logger.error('[discord] guild connect:', e?.message);
    res.status(500).json({ success: false, error: 'Failed to connect guild' });
  }
});

router.get('/guild/:artistId/status', authenticate, async (req: Request, res: Response) => {
  try {
    const cfg = await loadConfig(req.params.artistId);
    if (!cfg.activeGuildId) return res.json({ success: true, status: null, configured: isDiscordConfigured() });
    const gateway = getDiscordGateway();
    const status = await gateway.getGuildStatus(cfg.activeGuildId);
    // Refresh stored snapshot.
    await artistDoc(req.params.artistId).collection('discordGuilds').doc(cfg.activeGuildId).set(
      { status: status.status, botInstalled: status.botInstalled, memberCount: status.memberCount ?? null, updatedAt: nowMs() }, { merge: true });
    res.json({ success: true, status, configured: isDiscordConfigured() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to get guild status' });
  }
});

router.get('/guilds/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordGuilds').orderBy('createdAt', 'desc').limit(20).get();
    res.json({ success: true, guilds: snap.docs.map((d) => d.data()) });
  } catch {
    res.json({ success: true, guilds: [] });
  }
});

// ─── Overview ─────────────────────────────────────────────────────────────────
router.get('/overview/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const cfg = await loadConfig(artistId);
    const guildSnap = cfg.activeGuildId ? await artistDoc(artistId).collection('discordGuilds').doc(cfg.activeGuildId).get() : null;
    const guild = guildSnap?.exists ? guildSnap.data() : null;
    res.json({
      success: true,
      configured: isDiscordConfigured(),
      simulated: getDiscordGateway().isSimulated(),
      connected: !!guild && guild.status === 'connected',
      activeGuildId: cfg.activeGuildId,
      guild,
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to load overview' });
  }
});

// ─── Server Setup Wizard ──────────────────────────────────────────────────────
router.get('/setup/recommendations', authenticate, async (_req: Request, res: Response) => {
  res.json({ success: true, channels: RECOMMENDED_CHANNELS, roles: RECOMMENDED_ROLES });
});

router.post('/setup-server/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit, intenta en un minuto' });
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    if (!guildId) return res.status(400).json({ success: false, error: 'No active guild' });
    const gateway = getDiscordGateway();
    const channels = Array.isArray(req.body?.channels) ? req.body.channels : RECOMMENDED_CHANNELS;
    const roles = Array.isArray(req.body?.roles) ? req.body.roles : RECOMMENDED_ROLES;

    const createdChannels: any[] = [];
    for (const ch of channels) {
      const r = await gateway.createChannel(guildId, ch.name, ch.type || 'text');
      if (r.ok && r.channelId) {
        const doc = { guildId, channelId: r.channelId, name: ch.name, type: ch.type || 'text', description: ch.description || '', simulated: !!r.simulated, createdAt: nowMs() };
        await artistDoc(artistId).collection('discordChannels').doc(r.channelId).set(doc);
        createdChannels.push(doc);
      }
      await new Promise((rs) => setTimeout(rs, 250)); // gentle pacing
    }

    const createdRoles: any[] = [];
    for (const ro of roles) {
      const r = await gateway.createRole(guildId, ro.name, { color: ro.color });
      if (r.ok && r.roleId) {
        const doc = { guildId, roleId: r.roleId, roleName: ro.name, discordRoleId: r.roleId, color: ro.color ?? 0, accessLevel: ro.accessLevel || 'free', ruleType: ro.ruleType || 'manual', ruleValue: null, simulated: !!r.simulated, createdAt: nowMs() };
        await artistDoc(artistId).collection('discordRoles').doc(r.roleId).set(doc);
        createdRoles.push(doc);
      }
      await new Promise((rs) => setTimeout(rs, 250));
    }

    await audit(artistId, 'setup.run', { guildId, channels: createdChannels.length, roles: createdRoles.length }, uid(req));
    res.json({ success: true, channels: createdChannels, roles: createdRoles, simulated: gateway.isSimulated() });
  } catch (e: any) {
    logger.error('[discord] setup-server:', e?.message);
    res.status(500).json({ success: false, error: 'Setup failed' });
  }
});

// ─── Channels & Roles directory ───────────────────────────────────────────────
router.get('/channels/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordChannels').orderBy('createdAt', 'asc').limit(50).get();
    res.json({ success: true, channels: snap.docs.map((d) => d.data()) });
  } catch { res.json({ success: true, channels: [] }); }
});

router.get('/roles/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordRoles').orderBy('createdAt', 'asc').limit(50).get();
    res.json({ success: true, roles: snap.docs.map((d) => d.data()) });
  } catch { res.json({ success: true, roles: [] }); }
});

router.post('/channel/create/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit' });
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    const { name, type } = req.body || {};
    if (!guildId || !name) return res.status(400).json({ success: false, error: 'guildId and name required' });
    const r = await getDiscordGateway().createChannel(guildId, name, type || 'text');
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    const doc = { guildId, channelId: r.channelId, name, type: type || 'text', description: req.body?.description || '', simulated: !!r.simulated, createdAt: nowMs() };
    await artistDoc(artistId).collection('discordChannels').doc(String(r.channelId)).set(doc);
    await audit(artistId, 'channel.create', { name, channelId: r.channelId }, uid(req));
    res.json({ success: true, channel: doc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to create channel' });
  }
});

router.post('/role/create/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit' });
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    const { name, color, accessLevel, ruleType, ruleValue } = req.body || {};
    if (!guildId || !name) return res.status(400).json({ success: false, error: 'guildId and name required' });
    const r = await getDiscordGateway().createRole(guildId, name, { color: typeof color === 'number' ? color : undefined });
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    const doc = { guildId, roleId: r.roleId, roleName: name, discordRoleId: r.roleId, color: color ?? 0, accessLevel: accessLevel || 'free', ruleType: ruleType || 'manual', ruleValue: ruleValue ?? null, simulated: !!r.simulated, createdAt: nowMs() };
    await artistDoc(artistId).collection('discordRoles').doc(String(r.roleId)).set(doc);
    await audit(artistId, 'role.create', { name, roleId: r.roleId }, uid(req));
    res.json({ success: true, role: doc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to create role' });
  }
});

router.post('/role/assign/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit' });
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    const { userId, roleId } = req.body || {};
    if (!guildId || !userId || !roleId) return res.status(400).json({ success: false, error: 'guildId, userId, roleId required' });
    const r = await getDiscordGateway().assignRole(guildId, String(userId), String(roleId));
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    // Track on member doc.
    const memRef = artistDoc(artistId).collection('discordMembers').doc(String(userId));
    await memRef.set({ discordUserId: String(userId), roles: FieldValue.arrayUnion(String(roleId)), updatedAt: nowMs() }, { merge: true });
    await audit(artistId, 'role.assign', { userId, roleId }, uid(req));
    res.json({ success: true, simulated: !!r.simulated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to assign role' });
  }
});

router.post('/role/remove/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    const { userId, roleId } = req.body || {};
    if (!guildId || !userId || !roleId) return res.status(400).json({ success: false, error: 'guildId, userId, roleId required' });
    const r = await getDiscordGateway().removeRole(guildId, String(userId), String(roleId));
    if (!r.ok) return res.status(400).json({ success: false, error: r.error });
    await artistDoc(artistId).collection('discordMembers').doc(String(userId)).set({ roles: FieldValue.arrayRemove(String(roleId)), updatedAt: nowMs() }, { merge: true });
    await audit(artistId, 'role.remove', { userId, roleId }, uid(req));
    res.json({ success: true, simulated: !!r.simulated });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Failed to remove role' });
  }
});

// ─── Members / Fan Community ──────────────────────────────────────────────────
async function loadMembers(artistId: string): Promise<MemberLike[]> {
  const snap = await artistDoc(artistId).collection('discordMembers').limit(500).get();
  return snap.docs.map((d) => d.data() as MemberLike);
}

router.get('/members/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const members = await loadMembers(req.params.artistId);
    const ranked = rankTopFans(members, 100);
    res.json({ success: true, members: ranked, total: members.length });
  } catch { res.json({ success: true, members: [], total: 0 }); }
});

router.get('/top-fans/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const members = await loadMembers(req.params.artistId);
    res.json({ success: true, topFans: rankTopFans(members, 15) });
  } catch { res.json({ success: true, topFans: [] }); }
});

// Import / upsert members (CSV-style). Body: { members: [{discordUserId, username, btfBalance, totalSpent, ...}] }
router.post('/members/:artistId/import', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const list = Array.isArray(req.body?.members) ? req.body.members : [];
    if (!list.length) return res.status(400).json({ success: false, error: 'members[] required' });
    const batch = db.batch();
    let count = 0;
    for (const m of list.slice(0, 300)) {
      const id = String(m.discordUserId || m.id || '').trim();
      if (!id) continue;
      const ref = artistDoc(artistId).collection('discordMembers').doc(id);
      batch.set(ref, {
        discordUserId: id,
        username: m.username || null,
        roles: Array.isArray(m.roles) ? m.roles : [],
        tags: Array.isArray(m.tags) ? m.tags : [],
        isVip: !!m.isVip,
        btfBalance: Number(m.btfBalance || 0),
        totalSpent: Number(m.totalSpent || 0),
        messagesCount: Number(m.messagesCount || 0),
        joinedAt: m.joinedAt || nowMs(),
        lastActiveAt: m.lastActiveAt || nowMs(),
        updatedAt: nowMs(),
      }, { merge: true });
      count++;
    }
    await batch.commit();
    await audit(artistId, 'members.import', { count }, uid(req));
    res.json({ success: true, imported: count });
  } catch (e: any) {
    logger.error('[discord] members import:', e?.message);
    res.status(500).json({ success: false, error: 'Import failed' });
  }
});

// ─── BTF Token Gate verification ──────────────────────────────────────────────
// Body: { userId, btfBalance?, isVip?, totalSpent? }. Assigns the gate role when qualified.
router.post('/token-gate/verify/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const cfg = await loadConfig(artistId);
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ success: false, error: 'userId required' });
    // Prefer stored member data, fall back to body.
    const memSnap = await artistDoc(artistId).collection('discordMembers').doc(String(userId)).get();
    const stored = (memSnap.exists ? memSnap.data() : {}) as MemberLike;
    const member: MemberLike = {
      discordUserId: String(userId),
      btfBalance: Number(req.body?.btfBalance ?? stored.btfBalance ?? 0),
      isVip: req.body?.isVip ?? stored.isVip ?? false,
      totalSpent: Number(req.body?.totalSpent ?? stored.totalSpent ?? 0),
    };
    const qualifies = qualifiesForTokenGate(member, { minBtf: cfg.tokenGate.minBtf, requireVip: cfg.tokenGate.requireVip, minSpent: cfg.tokenGate.minSpent });
    let assigned = false;
    if (qualifies && cfg.tokenGate.roleId && cfg.activeGuildId) {
      const r = await getDiscordGateway().assignRole(cfg.activeGuildId, String(userId), cfg.tokenGate.roleId);
      assigned = r.ok;
      if (r.ok) {
        await artistDoc(artistId).collection('discordMembers').doc(String(userId)).set(
          { discordUserId: String(userId), btfBalance: member.btfBalance, isVip: true, roles: FieldValue.arrayUnion(cfg.tokenGate.roleId), updatedAt: nowMs() }, { merge: true });
      }
    }
    await audit(artistId, 'tokengate.verify', { userId, qualifies, assigned }, uid(req));
    res.json({ success: true, qualifies, roleAssigned: assigned, gate: cfg.tokenGate });
  } catch (e: any) {
    logger.error('[discord] token-gate:', e?.message);
    res.status(500).json({ success: false, error: 'Verification failed' });
  }
});

// ─── Campaigns ────────────────────────────────────────────────────────────────
router.get('/campaigns/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordCampaigns').orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, campaigns: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, campaigns: [] }); }
});

router.post('/campaign/send/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit' });
    const { name, channelId, message, mediaUrl, buttons } = req.body || {};
    if (!channelId || !message) return res.status(400).json({ success: false, error: 'channelId and message required' });
    const gateway = getDiscordGateway();
    const sent = mediaUrl
      ? await gateway.sendMedia(String(channelId), String(mediaUrl), String(message))
      : await gateway.sendMessage(String(channelId), String(message), { buttons: Array.isArray(buttons) ? buttons : undefined });
    const doc = {
      name: name || 'Campaign',
      channelId: String(channelId),
      message: String(message),
      mediaUrl: mediaUrl || null,
      buttons: Array.isArray(buttons) ? buttons : [],
      status: sent.ok ? 'sent' : 'failed',
      messageId: sent.messageId || null,
      error: sent.error || null,
      sentAt: nowMs(),
      clickCount: 0,
      conversionCount: 0,
      revenue: 0,
      simulated: !!sent.simulated,
      createdAt: nowMs(),
    };
    const ref = await artistDoc(artistId).collection('discordCampaigns').add(doc);
    await audit(artistId, 'campaign.send', { id: ref.id, channelId, ok: sent.ok }, uid(req));
    res.json({ success: sent.ok, campaign: { id: ref.id, ...doc }, error: sent.error });
  } catch (e: any) {
    logger.error('[discord] campaign send:', e?.message);
    res.status(500).json({ success: false, error: 'Campaign failed' });
  }
});

// ─── Events ───────────────────────────────────────────────────────────────────
router.get('/events/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordEvents').orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, events: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, events: [] }); }
});

router.post('/event/create/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    if (!checkRate(artistId)) return res.status(429).json({ success: false, error: 'Rate limit' });
    const cfg = await loadConfig(artistId);
    const guildId = req.body?.guildId || cfg.activeGuildId;
    const { title, description, startTime, endTime, channelId, accessLevel, location } = req.body || {};
    if (!guildId || !title || !startTime) return res.status(400).json({ success: false, error: 'guildId, title, startTime required' });
    const r = await getDiscordGateway().createEvent(guildId, { title, description, startTime, endTime, channelId, location });
    const doc = {
      title: String(title), description: description || '', channelId: channelId || null,
      startTime, endTime: endTime || null, accessLevel: accessLevel || 'all',
      eventId: r.eventId || null, status: r.ok ? 'scheduled' : 'failed', error: r.error || null,
      attendees: [], revenue: 0, simulated: !!r.simulated, createdAt: nowMs(),
    };
    const ref = await artistDoc(artistId).collection('discordEvents').add(doc);
    await audit(artistId, 'event.create', { id: ref.id, title, ok: r.ok }, uid(req));
    res.json({ success: r.ok, event: { id: ref.id, ...doc }, error: r.error });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Event creation failed' });
  }
});

// ─── Rewards ──────────────────────────────────────────────────────────────────
router.get('/rewards/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordRewards').orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, rewards: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, rewards: [] }); }
});

router.post('/reward/create/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { name, type, trigger, value, roleId } = req.body || {};
    if (!name || !type) return res.status(400).json({ success: false, error: 'name and type required' });
    const doc = { name: String(name), type: String(type), trigger: trigger || 'manual', value: value ?? null, roleId: roleId || null, status: 'active', claims: 0, createdAt: nowMs() };
    const ref = await artistDoc(artistId).collection('discordRewards').add(doc);
    await audit(artistId, 'reward.create', { id: ref.id, name }, uid(req));
    res.json({ success: true, reward: { id: ref.id, ...doc } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Reward creation failed' });
  }
});

// Reward top fans in one shot. Body: { count?, rewardName?, roleId? }
router.post('/reward/top-fans/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const count = Math.min(50, Number(req.body?.count || 10));
    const members = await loadMembers(artistId);
    const top = rankTopFans(members, count);
    const cfg = await loadConfig(artistId);
    const roleId = req.body?.roleId || null;
    let assigned = 0;
    if (roleId && cfg.activeGuildId && !getDiscordGateway().isSimulated()) {
      for (const f of top) {
        const r = await getDiscordGateway().assignRole(cfg.activeGuildId, f.discordUserId, roleId);
        if (r.ok) assigned++;
        await new Promise((rs) => setTimeout(rs, 200));
      }
    } else if (roleId) {
      assigned = top.length; // simulation
    }
    const doc = { name: req.body?.rewardName || `Top ${count} Fans`, type: 'role', trigger: 'top_fans', value: count, roleId, status: 'granted', recipients: top.map((f) => f.discordUserId), createdAt: nowMs() };
    const ref = await artistDoc(artistId).collection('discordRewards').add(doc);
    await audit(artistId, 'reward.top_fans', { id: ref.id, count, assigned }, uid(req));
    res.json({ success: true, rewarded: top.length, roleAssigned: assigned, topFans: top });
  } catch (e: any) {
    logger.error('[discord] reward top-fans:', e?.message);
    res.status(500).json({ success: false, error: 'Reward failed' });
  }
});

// ─── AI Concierge ─────────────────────────────────────────────────────────────
router.get('/ai-commands/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordAICommands').orderBy('createdAt', 'desc').limit(40).get();
    res.json({ success: true, commands: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, commands: [] }); }
});

router.post('/ai-command/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { text, artistName } = req.body || {};
    if (!text) return res.status(400).json({ success: false, error: 'text required' });
    const classification = await classifyConciergeCommand(String(text));
    const reply = buildConciergeReply(classification.intent, artistName || 'Artist');
    const doc = {
      rawText: String(text),
      intent: classification.intent,
      moduleTarget: classification.moduleTarget,
      params: classification.params,
      confidence: classification.confidence,
      source: classification.source,
      reply,
      actionStatus: classification.intent === 'unknown' ? 'unhandled' : 'suggested',
      createdAt: nowMs(),
    };
    const ref = await artistDoc(artistId).collection('discordAICommands').add(doc);
    res.json({ success: true, command: { id: ref.id, ...doc } });
  } catch (e: any) {
    logger.error('[discord] ai-command:', e?.message);
    res.status(500).json({ success: false, error: 'AI command failed' });
  }
});

// ─── AI Moderator (manual test + log) ─────────────────────────────────────────
router.get('/moderation/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const snap = await artistDoc(req.params.artistId).collection('discordModeration').orderBy('createdAt', 'desc').limit(50).get();
    res.json({ success: true, log: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch { res.json({ success: true, log: [] }); }
});

router.post('/moderation/check/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { text, username } = req.body || {};
    if (!text) return res.status(400).json({ success: false, error: 'text required' });
    const result = await moderateMessage(String(text));
    const doc = { text: String(text).slice(0, 400), username: username || null, ...result, createdAt: nowMs() };
    if (result.flagged) await artistDoc(artistId).collection('discordModeration').add(doc);
    res.json({ success: true, result: doc });
  } catch (e: any) {
    res.status(500).json({ success: false, error: 'Moderation failed' });
  }
});

// ─── Analytics ────────────────────────────────────────────────────────────────
router.get('/analytics/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const [members, campSnap, eventSnap] = await Promise.all([
      loadMembers(artistId),
      artistDoc(artistId).collection('discordCampaigns').limit(200).get(),
      artistDoc(artistId).collection('discordEvents').limit(200).get(),
    ]);
    const campaigns = campSnap.docs.map((d) => d.data() as any);
    const events = eventSnap.docs.map((d) => d.data() as any);
    const growth = growthStats(members);
    const revenue = revenueStats(members, campaigns);
    const cfg = await loadConfig(artistId);
    const guildSnap = cfg.activeGuildId ? await artistDoc(artistId).collection('discordGuilds').doc(cfg.activeGuildId).get() : null;
    const guildMemberCount = guildSnap?.exists ? (guildSnap.data()?.memberCount || growth.total) : growth.total;
    res.json({
      success: true,
      analytics: {
        totalMembers: Math.max(guildMemberCount, growth.total),
        trackedMembers: growth.total,
        activeMembers: growth.active,
        newMembers: growth.newMembers,
        churnRate: growth.churnRate,
        activeRate: growth.activeRate,
        vipRetention: vipRetention(members),
        ...revenue,
        campaignsSent: campaigns.length,
        eventsCreated: events.length,
        ticketsSold: campaigns.reduce((s, c) => s + (c.conversionCount || 0), 0),
        timeline: activityTimeline(members),
        topFans: rankTopFans(members, 8),
      },
    });
  } catch (e: any) {
    logger.error('[discord] analytics:', e?.message);
    res.json({ success: true, analytics: null });
  }
});

// ─── Webhook (no auth; Discord interactions / relay events) ───────────────────
// Mounted before global json in index.ts is NOT required — Discord interaction
// verification (ed25519) would happen upstream; here we accept normalized events.
router.post('/webhook/:artistId', async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const inbound = normalizeDiscordEvent(req.body);
    if (!inbound) return res.json({ ok: true });
    // Member touch + message counting.
    if (inbound.discordUserId && inbound.discordUserId !== 'unknown') {
      const ref = artistDoc(artistId).collection('discordMembers').doc(inbound.discordUserId);
      const update: any = { discordUserId: inbound.discordUserId, username: inbound.username || null, lastActiveAt: nowMs(), updatedAt: nowMs() };
      if (inbound.messageType === 'message') update.messagesCount = FieldValue.increment(1);
      if (inbound.messageType === 'member_join') update.joinedAt = nowMs();
      await ref.set(update, { merge: true });
    }
    // AI moderation on plain messages.
    if (inbound.messageType === 'message' && inbound.body) {
      const mod = await moderateMessage(inbound.body);
      if (mod.flagged) {
        await artistDoc(artistId).collection('discordModeration').add({
          text: inbound.body.slice(0, 400), username: inbound.username || null,
          discordUserId: inbound.discordUserId, ...mod, createdAt: nowMs(),
        });
      }
    }
    res.json({ ok: true });
  } catch (e: any) {
    logger.warn('[discord] webhook error:', e?.message);
    res.json({ ok: true }); // never fail the webhook
  }
});

export default router;
