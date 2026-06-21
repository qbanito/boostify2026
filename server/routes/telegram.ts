/**
 * Telegram Artist Command Center — API routes (mounted at /api/telegram).
 * ---------------------------------------------------------------------------
 * Every call to the Telegram Bot API goes THROUGH this backend (the frontend
 * never sees bot tokens — they are AES-encrypted at rest). Data is stored
 * per-artist under Firestore subcollections:
 *
 *   artists/{artistId}/telegramBots/{botId}
 *   artists/{artistId}/telegramUsers/{telegramUserId}
 *   artists/{artistId}/telegramMessages/{messageId}
 *   artists/{artistId}/telegramCampaigns/{campaignId}
 *   artists/{artistId}/telegramCommunities/{communityId}
 *   artists/{artistId}/telegramAICommands/{commandId}
 *   artists/{artistId}/telegramSales/{saleId}
 *
 * Consent + opt-out (/stop, SALIR, CANCELAR) are enforced before any broadcast.
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  getTelegramGateway,
  isTelegramConfigured,
  botIdFor,
  cacheBotToken,
  encryptToken,
  decryptToken,
  type InlineButton,
  type NormalizedTelegramInbound,
} from '../services/telegram-gateway/telegram.adapter';
import {
  classifyTelegramCommand,
  buildReply,
  isOptOut,
} from '../services/telegram-gateway/telegram-ai-agent';

const router = Router();

function nowMs() { return Date.now(); }
function artistDoc(artistId: string) { return db.collection('artists').doc(String(artistId)); }

/** Resolve the authenticated user id (Clerk-resolved PG id or string). */
function uid(req: Request): string {
  return String((req.user as any)?.id ?? (req.user as any)?.uid ?? '');
}

function baseApiUrl(req: Request): string {
  return (process.env.BOOSTIFY_API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

// ─── Per-artist rate limiter (broadcast pacing + abuse guard) ────────────────
const sendBuckets = new Map<string, { count: number; resetAt: number }>();
const MAX_SENDS_PER_MINUTE = 60; // safe ceiling per artist to avoid bans/spam
function checkRateLimit(artistId: string, n = 1): boolean {
  const key = String(artistId);
  const now = nowMs();
  const b = sendBuckets.get(key);
  if (!b || now > b.resetAt) {
    sendBuckets.set(key, { count: n, resetAt: now + 60_000 });
    return n <= MAX_SENDS_PER_MINUTE;
  }
  if (b.count + n > MAX_SENDS_PER_MINUTE) return false;
  b.count += n;
  return true;
}

/** Write an audit-log entry under the artist for compliance/traceability. */
async function audit(artistId: string, action: string, detail: any, ownerId?: string) {
  try {
    await artistDoc(artistId).collection('telegramAuditLog').add({
      action, detail: detail ?? null, ownerId: ownerId ?? null, at: nowMs(),
    });
  } catch (e: any) {
    logger.warn('[telegram] audit write failed:', e?.message);
  }
}

/**
 * Re-hydrate the in-memory token cache from Firestore (decrypting the stored
 * token) so sends/status work after a server restart. Returns the resolved
 * bot doc + whether the bot is in simulation mode.
 */
async function ensureBotToken(artistId: string): Promise<{ botId: string; ok: boolean; simulated: boolean }> {
  const botId = botIdFor(String(artistId));
  try {
    const snap = await artistDoc(artistId).collection('telegramBots').doc(botId).get();
    if (!snap.exists) return { botId, ok: false, simulated: false };
    const data = snap.data() as any;
    if (data?.simulated) {
      cacheBotToken(botId, 'SIMULATION');
      return { botId, ok: true, simulated: true };
    }
    const token = decryptToken(data?.botTokenEncrypted || '');
    if (token) {
      cacheBotToken(botId, token);
      return { botId, ok: true, simulated: false };
    }
    return { botId, ok: false, simulated: false };
  } catch {
    return { botId, ok: false, simulated: false };
  }
}

// ─────────────────────────── BOT CONNECTION ─────────────────────────────────

/** POST /bot/connect { artistId, artistName, botToken } */
router.post('/bot/connect', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, botToken } = req.body || {};
    if (!artistId || !botToken) return res.status(400).json({ success: false, error: 'artistId and botToken are required' });
    const ownerId = uid(req);

    const webhookUrl = `${baseApiUrl(req)}/api/telegram/webhook/${String(artistId)}`;
    const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET || undefined;

    const result = await getTelegramGateway().connectBot(String(artistId), String(botToken), { webhookUrl, webhookSecret });

    const botRef = artistDoc(artistId).collection('telegramBots').doc(result.botId);
    await botRef.set(
      {
        botId: result.botId,
        artistId: String(artistId),
        ownerId,
        artistName: artistName || null,
        botUsername: result.botUsername || null,
        botName: result.botName || null,
        botStatus: result.status,
        simulated: !!result.simulated,
        botTokenEncrypted: result.simulated ? 'SIMULATION' : (result.status === 'connected' ? encryptToken(String(botToken)) : FieldValue.delete()),
        webhookUrl,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: nowMs(),
        lastConnectedAt: result.status === 'connected' ? nowMs() : null,
      },
      { merge: true },
    );
    await audit(artistId, 'bot.connect', { botId: result.botId, status: result.status, simulated: result.simulated }, ownerId);

    return res.json({
      success: result.status === 'connected',
      botId: result.botId,
      status: result.status,
      botUsername: result.botUsername || null,
      botName: result.botName || null,
      simulated: !!result.simulated,
      error: result.error || null,
    });
  } catch (e: any) {
    logger.error('[telegram] bot/connect error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'bot connect failed' });
  }
});

/** GET /bot/:botId/status → live status (+persist transitions). */
router.get('/bot/:botId/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const artistId = botId.replace(/^tg_/, '');
    await ensureBotToken(artistId);
    const status = await getTelegramGateway().getBotStatus(botId);

    await artistDoc(artistId).collection('telegramBots').doc(botId).set(
      {
        botStatus: status.status,
        botUsername: status.botUsername || null,
        botName: status.botName || null,
        updatedAt: nowMs(),
        ...(status.status === 'connected' ? { lastConnectedAt: nowMs() } : {}),
      },
      { merge: true },
    ).catch(() => {});

    return res.json({ success: true, ...status, configured: isTelegramConfigured() });
  } catch (e: any) {
    logger.error('[telegram] bot status error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'status failed' });
  }
});

/** POST /bot/:botId/disconnect */
router.post('/bot/:botId/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const { botId } = req.params;
    const artistId = botId.replace(/^tg_/, '');
    await ensureBotToken(artistId);
    await getTelegramGateway().disconnectBot(botId);
    await artistDoc(artistId).collection('telegramBots').doc(botId)
      .set({ botStatus: 'disconnected', updatedAt: nowMs() }, { merge: true }).catch(() => {});
    await audit(artistId, 'bot.disconnect', { botId }, uid(req));
    return res.json({ success: true });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'disconnect failed' });
  }
});

// ─────────────────────────── MESSAGING ──────────────────────────────────────

async function persistMessage(artistId: string, msg: {
  direction: 'in' | 'out';
  from: string; to: string; body: string; mediaUrl?: string | null;
  messageType: string; status: string; campaignId?: string | null;
}) {
  const ref = artistDoc(artistId).collection('telegramMessages').doc();
  await ref.set({ id: ref.id, ...msg, mediaUrl: msg.mediaUrl ?? null, campaignId: msg.campaignId ?? null, timestamp: nowMs() });
  return ref.id;
}

/** POST /message/send { artistId, chatId, message, buttons? } */
router.post('/message/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, chatId, message, buttons } = req.body || {};
    if (!artistId || !chatId || !message) return res.status(400).json({ success: false, error: 'artistId, chatId and message are required' });
    if (!checkRateLimit(artistId)) return res.status(429).json({ success: false, error: 'rate limit exceeded' });
    const { botId } = await ensureBotToken(artistId);

    const r = await getTelegramGateway().sendMessage(botId, String(chatId), message, { buttons: Array.isArray(buttons) ? buttons as InlineButton[] : undefined });
    await persistMessage(artistId, { direction: 'out', from: botId, to: String(chatId), body: message, messageType: 'text', status: r.ok ? 'sent' : 'failed' });
    return res.json({ success: r.ok, ...r });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'send failed' });
  }
});

/** POST /media/send { artistId, chatId, mediaUrl, caption } */
router.post('/media/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, chatId, mediaUrl, caption } = req.body || {};
    if (!artistId || !chatId || !mediaUrl) return res.status(400).json({ success: false, error: 'artistId, chatId and mediaUrl are required' });
    if (!checkRateLimit(artistId)) return res.status(429).json({ success: false, error: 'rate limit exceeded' });
    const { botId } = await ensureBotToken(artistId);

    const r = await getTelegramGateway().sendMedia(botId, String(chatId), mediaUrl, caption);
    await persistMessage(artistId, { direction: 'out', from: botId, to: String(chatId), body: caption || '', mediaUrl, messageType: 'image', status: r.ok ? 'sent' : 'failed' });
    return res.json({ success: r.ok, ...r });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'media send failed' });
  }
});

// ─────────────────────────── CONTACTS (telegramUsers) ───────────────────────

/** GET /contacts/:artistId */
router.get('/contacts/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramUsers').orderBy('lastMessageAt', 'desc').limit(500).get().catch(async () => {
      return artistDoc(artistId).collection('telegramUsers').limit(500).get();
    });
    const contacts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, contacts });
  } catch {
    return res.json({ success: true, contacts: [] });
  }
});

/** POST /contacts/:artistId → import/add subscribers (array) with consent flag. */
router.post('/contacts/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { contacts } = req.body || {};
    if (!Array.isArray(contacts) || !contacts.length) return res.status(400).json({ success: false, error: 'contacts array required' });
    const col = artistDoc(artistId).collection('telegramUsers');
    const batch = db.batch();
    let added = 0;
    for (const c of contacts.slice(0, 1000)) {
      const chatId = String(c.chatId || c.telegramUserId || '').trim();
      if (!chatId) continue;
      const ref = col.doc(chatId); // telegram chat/user id = stable id (dedupe)
      batch.set(ref, {
        name: c.name || c.firstName || chatId,
        chatId,
        telegramUserId: chatId,
        username: c.username || null,
        tags: Array.isArray(c.tags) ? c.tags : [],
        source: c.source || 'import',
        consentStatus: c.consentStatus || 'opted_in',
        city: c.city || null,
        isVip: !!c.isVip,
        totalSpent: Number(c.totalSpent) || 0,
        lastMessageAt: c.lastMessageAt || null,
        updatedAt: nowMs(),
      }, { merge: true });
      added++;
    }
    await batch.commit();
    await audit(artistId, 'contacts.import', { added }, uid(req));
    return res.json({ success: true, added });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'import failed' });
  }
});

// ─────────────────────────── CAMPAIGNS (broadcast) ──────────────────────────

/** Match a subscriber against a segment filter. */
function matchesSegment(contact: any, segment: string): boolean {
  switch (segment) {
    case 'vip': return !!contact.isVip;
    case 'buyers': return Number(contact.totalSpent) > 0;
    case 'top': return Number(contact.totalSpent) >= 50;
    case 'new': return (contact.source || '') === 'import' || !contact.lastMessageAt;
    case 'all':
    default: return true;
  }
}

/** POST /campaign/send { artistId, name, segment, message, mediaUrl, city, buttons } */
router.post('/campaign/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, name, segment = 'all', message, mediaUrl, city, buttons } = req.body || {};
    if (!artistId || !message) return res.status(400).json({ success: false, error: 'artistId and message are required' });
    const ownerId = uid(req);
    const { botId } = await ensureBotToken(artistId);

    // Eligible subscribers = matches segment AND has consent AND not opted-out.
    const snap = await artistDoc(artistId).collection('telegramUsers').get();
    const targets = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      .filter((c: any) => c.consentStatus !== 'opted_out')
      .filter((c: any) => matchesSegment(c, segment))
      .filter((c: any) => (segment === 'city' && city ? (c.city || '').toLowerCase() === String(city).toLowerCase() : true));

    if (!checkRateLimit(artistId, targets.length)) {
      return res.status(429).json({ success: false, error: `rate limit: máximo ${MAX_SENDS_PER_MINUTE} mensajes/min. Reduce el segmento.` });
    }

    const campaignRef = artistDoc(artistId).collection('telegramCampaigns').doc();
    const campaignId = campaignRef.id;
    await campaignRef.set({
      id: campaignId, name: name || 'Campaña', segment, message, mediaUrl: mediaUrl || null,
      status: 'sending', sentCount: 0, deliveredCount: 0, responseCount: 0, conversionCount: 0,
      revenue: 0, targetCount: targets.length, ownerId, createdAt: nowMs(),
    });

    // Fire-and-forget paced send so the request returns immediately.
    (async () => {
      const gateway = getTelegramGateway();
      const btn = Array.isArray(buttons) ? (buttons as InlineButton[]) : undefined;
      let sent = 0;
      for (const c of targets) {
        const chatId = String(c.chatId || c.id);
        try {
          const r = mediaUrl
            ? await gateway.sendMedia(botId, chatId, mediaUrl, message)
            : await gateway.sendMessage(botId, chatId, message, { buttons: btn });
          if (r.ok) {
            sent++;
            await persistMessage(artistId, { direction: 'out', from: botId, to: chatId, body: message, mediaUrl: mediaUrl || null, messageType: mediaUrl ? 'image' : 'text', status: 'sent', campaignId });
          }
        } catch { /* per-contact failure isolation */ }
        await new Promise((r) => setTimeout(r, 1200)); // pacing → avoid bans
      }
      await campaignRef.set({ status: 'completed', sentCount: sent, deliveredCount: sent, updatedAt: nowMs() }, { merge: true });
      await audit(artistId, 'campaign.sent', { campaignId, sent, segment }, ownerId);
    })().catch((e) => logger.error('[telegram] campaign send error:', e?.message));

    return res.json({ success: true, campaignId, targetCount: targets.length, status: 'sending' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'campaign failed' });
  }
});

/** GET /campaigns/:artistId */
router.get('/campaigns/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramCampaigns').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('telegramCampaigns').limit(100).get());
    return res.json({ success: true, campaigns: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, campaigns: [] });
  }
});

/** GET /messages/:artistId — recent message history. */
router.get('/messages/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramMessages').orderBy('timestamp', 'desc').limit(200).get()
      .catch(() => artistDoc(artistId).collection('telegramMessages').limit(200).get());
    return res.json({ success: true, messages: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, messages: [] });
  }
});

// ─────────────────────────── COMMUNITIES (channels/groups) ──────────────────

/**
 * POST /community/create { artistId, type, name, chatId? }
 * NOTE: the Telegram Bot API cannot CREATE channels/groups (that needs a user
 * account / TDLib). Here we register the community metadata and, if the artist
 * provides a chatId where the bot is admin, we generate an invite link.
 */
router.post('/community/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, type = 'channel', name, chatId, description } = req.body || {};
    if (!artistId || !name) return res.status(400).json({ success: false, error: 'artistId and name are required' });
    const ownerId = uid(req);
    const { botId } = await ensureBotToken(artistId);

    let inviteLink: string | null = null;
    let note: string | null = null;
    if (chatId) {
      const r = await getTelegramGateway().createInviteLink(botId, String(chatId), { name });
      if (r.ok) inviteLink = r.inviteLink || null;
      else note = r.error || 'No se pudo generar el link (¿el bot es admin del canal/grupo?)';
    } else {
      note = 'Crea el canal/grupo en Telegram, añade el bot como admin y pega su chatId para generar el link de invitación.';
    }

    const ref = artistDoc(artistId).collection('telegramCommunities').doc();
    await ref.set({
      id: ref.id, type, name, description: description || null, chatId: chatId || null,
      inviteLink, memberCount: 0, status: inviteLink ? 'active' : 'pending', note,
      ownerId, createdAt: nowMs(), updatedAt: nowMs(),
    });
    await audit(artistId, 'community.create', { id: ref.id, type, hasLink: !!inviteLink }, ownerId);

    return res.json({ success: true, communityId: ref.id, inviteLink, note });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'community create failed' });
  }
});

/** GET /communities/:artistId */
router.get('/communities/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramCommunities').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('telegramCommunities').limit(100).get());
    return res.json({ success: true, communities: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, communities: [] });
  }
});

/** POST /invite/create { artistId, chatId, name? } → fresh invite link. */
router.post('/invite/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, chatId, name } = req.body || {};
    if (!artistId || !chatId) return res.status(400).json({ success: false, error: 'artistId and chatId are required' });
    const { botId } = await ensureBotToken(artistId);
    const r = await getTelegramGateway().createInviteLink(botId, String(chatId), { name });
    if (!r.ok) return res.status(400).json({ success: false, error: r.error || 'invite failed' });
    await audit(artistId, 'invite.create', { chatId }, uid(req));
    return res.json({ success: true, inviteLink: r.inviteLink, simulated: r.simulated });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'invite failed' });
  }
});

// ─────────────────────────── AI COMMAND ─────────────────────────────────────

/** POST /ai-command { artistId, artistName, text, chatId? } */
router.post('/ai-command', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, text, chatId } = req.body || {};
    if (!artistId || !text) return res.status(400).json({ success: false, error: 'artistId and text are required' });
    const ownerId = uid(req);

    const classification = await classifyTelegramCommand(text);
    const reply = buildReply(classification, artistName || '');

    const cmdRef = artistDoc(artistId).collection('telegramAICommands').doc();
    await cmdRef.set({
      id: cmdRef.id, rawText: text, intent: classification.intent, moduleTarget: classification.moduleTarget,
      params: classification.params, confidence: classification.confidence, source: classification.source,
      actionStatus: 'classified', result: reply, ownerId, createdAt: nowMs(),
    });

    // If a live chat is provided, push the reply over Telegram.
    if (chatId) {
      const { botId } = await ensureBotToken(artistId);
      await getTelegramGateway().sendMessage(botId, String(chatId), reply).catch(() => {});
    }

    return res.json({ success: true, commandId: cmdRef.id, classification, reply });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'ai-command failed' });
  }
});

/** GET /ai-commands/:artistId — command history. */
router.get('/ai-commands/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramAICommands').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('telegramAICommands').limit(100).get());
    return res.json({ success: true, commands: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, commands: [] });
  }
});

// ─────────────────────────── ANALYTICS ──────────────────────────────────────

/** GET /analytics/:artistId — aggregate KPIs for the dashboard. */
router.get('/analytics/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const root = artistDoc(artistId);
    const [msgs, campaigns, contacts, sales, commands, communities] = await Promise.all([
      root.collection('telegramMessages').get().catch(() => ({ docs: [] as any[] })),
      root.collection('telegramCampaigns').get().catch(() => ({ docs: [] as any[] })),
      root.collection('telegramUsers').get().catch(() => ({ docs: [] as any[] })),
      root.collection('telegramSales').get().catch(() => ({ docs: [] as any[] })),
      root.collection('telegramAICommands').get().catch(() => ({ docs: [] as any[] })),
      root.collection('telegramCommunities').get().catch(() => ({ docs: [] as any[] })),
    ]);

    const messageDocs = msgs.docs.map((d: any) => d.data());
    const sent = messageDocs.filter((m: any) => m.direction === 'out').length;
    const responded = messageDocs.filter((m: any) => m.direction === 'in').length;
    const saleDocs = sales.docs.map((d: any) => d.data());
    const revenue = saleDocs.reduce((acc: number, s: any) => acc + (Number(s.amount) || 0), 0);
    const ticketsSold = saleDocs.filter((s: any) => s.type === 'ticket').length;
    const merchSold = saleDocs.filter((s: any) => s.type === 'merch').length;

    // Top AI commands by intent.
    const intentCounts: Record<string, number> = {};
    commands.docs.forEach((d: any) => { const i = d.data().intent || 'unknown'; intentCounts[i] = (intentCounts[i] || 0) + 1; });
    const topCommands = Object.entries(intentCounts).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([intent, count]) => ({ intent, count }));

    const activeFans = contacts.docs.map((d: any) => d.data()).filter((c: any) => c.lastMessageAt).length;
    const conversion = sent > 0 ? Math.round((saleDocs.length / sent) * 1000) / 10 : 0;

    return res.json({
      success: true,
      analytics: {
        messagesSent: sent,
        messagesResponded: responded,
        activeFans,
        totalContacts: contacts.docs.length,
        conversionRate: conversion,
        revenue,
        ticketsSold,
        merchSold,
        campaignsCount: campaigns.docs.length,
        communitiesCount: communities.docs.length,
        topCommands,
      },
    });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'analytics failed' });
  }
});

/** GET /sales/:artistId */
router.get('/sales/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('telegramSales').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('telegramSales').limit(100).get());
    return res.json({ success: true, sales: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, sales: [] });
  }
});

// ─────────────────────────── WEBHOOK ────────────────────────────────────────

/**
 * POST /webhook/:artistId — inbound updates from Telegram. NO Boostify auth
 * (Telegram is the caller), but we verify the secret token header that we set
 * when registering the webhook (setWebhook secret_token).
 */
router.post('/webhook/:artistId', async (req: Request, res: Response) => {
  // Verify Telegram's secret token if one is configured.
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (expected) {
    const provided = req.headers['x-telegram-bot-api-secret-token'] || '';
    if (provided !== expected) return res.status(401).json({ ok: false });
  }

  // Acknowledge fast; process asynchronously so Telegram isn't blocked.
  res.json({ ok: true });

  try {
    const artistId = String(req.params.artistId || '');
    if (!artistId) return;
    const inbound: NormalizedTelegramInbound | null = await getTelegramGateway().receiveWebhook(req.body);
    if (!inbound || !inbound.chatId) return;

    const root = artistDoc(artistId);
    const { botId } = await ensureBotToken(artistId);

    // Persist inbound message.
    await persistMessage(artistId, { direction: 'in', from: inbound.fromUserId, to: botId, body: inbound.body, mediaUrl: inbound.mediaUrl, messageType: inbound.messageType, status: 'received' });

    // Touch / create the subscriber.
    const contactRef = root.collection('telegramUsers').doc(inbound.fromUserId);
    await contactRef.set({
      name: inbound.fromName || inbound.username || inbound.fromUserId,
      chatId: inbound.chatId,
      telegramUserId: inbound.fromUserId,
      username: inbound.username || null,
      consentStatus: 'opted_in',
      lastMessageAt: nowMs(),
    }, { merge: true });

    // Consent: opt-out keywords.
    if (isOptOut(inbound.body)) {
      await contactRef.set({ consentStatus: 'opted_out', optedOutAt: nowMs() }, { merge: true });
      await getTelegramGateway().sendMessage(botId, inbound.chatId, '✅ Listo, no recibirás más campañas. Escribe /start para reactivar.').catch(() => {});
      await audit(artistId, 'contact.opt_out', { from: inbound.fromUserId });
      return;
    }
    if (/^\s*\/start\s*$/i.test(inbound.body)) {
      await contactRef.set({ consentStatus: 'opted_in' }, { merge: true });
    }

    // Classify + auto-reply for actionable intents.
    const artistName = (await root.get().catch(() => null))?.data?.()?.artistName || '';
    const classification = await classifyTelegramCommand(inbound.body);
    if (classification.intent !== 'unknown') {
      const cmdRef = root.collection('telegramAICommands').doc();
      await cmdRef.set({
        id: cmdRef.id, rawText: inbound.body, intent: classification.intent, moduleTarget: classification.moduleTarget,
        params: classification.params, confidence: classification.confidence, source: classification.source,
        actionStatus: 'classified', from: inbound.fromUserId, channel: 'inbound', createdAt: nowMs(),
      });
      const reply = buildReply(classification, artistName);
      await getTelegramGateway().sendMessage(botId, inbound.chatId, reply).catch(() => {});
      await persistMessage(artistId, { direction: 'out', from: botId, to: inbound.chatId, body: reply, messageType: 'text', status: 'sent' });
    }
  } catch (e: any) {
    logger.error('[telegram] webhook processing error:', e?.message);
  }
});

export default router;
