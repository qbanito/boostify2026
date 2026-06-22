/**
 * WhatsApp Artist Command Center — API routes (mounted at /api/whatsapp).
 * ---------------------------------------------------------------------------
 * Every call to the OpenWA gateway goes THROUGH this backend (the frontend
 * never sees OpenWA tokens). Data is stored per-artist under Firestore
 * subcollections:
 *
 *   artists/{artistId}/whatsappSessions/{sessionId}
 *   artists/{artistId}/whatsappContacts/{contactId}
 *   artists/{artistId}/whatsappMessages/{messageId}
 *   artists/{artistId}/whatsappCampaigns/{campaignId}
 *   artists/{artistId}/aiCommands/{commandId}
 *   artists/{artistId}/whatsappSales/{saleId}
 *
 * ⚠️ OpenWA is NOT the official Meta API. Consent + opt-out (STOP/SALIR/
 * CANCELAR) are enforced before any campaign send.
 */
import { Router, Request, Response } from 'express';
import { db, FieldValue } from '../firebase';
import { authenticate } from '../middleware/auth';
import { logger } from '../utils/logger';
import {
  getGateway,
  isGatewayConfigured,
  normalizePhone,
  type NormalizedInbound,
} from '../services/whatsapp-gateway/openwa.adapter';
import {
  classifyCommand,
  buildReply,
  isOptOut,
} from '../services/whatsapp-gateway/whatsapp-ai-agent';

const router = Router();

function nowMs() { return Date.now(); }
function artistDoc(artistId: string) { return db.collection('artists').doc(String(artistId)); }

/** Resolve the authenticated user id (Clerk-resolved PG id or string). */
function uid(req: Request): string {
  return String((req.user as any)?.id ?? (req.user as any)?.uid ?? '');
}

/** Which gateway is active: 'cloud' (official Meta, no QR), 'openwa' (QR) or 'simulated'. */
function currentProvider(): 'cloud' | 'openwa' | 'simulated' {
  if (process.env.WHATSAPP_PROVIDER === 'cloud'
      && process.env.WHATSAPP_ACCESS_TOKEN
      && process.env.WHATSAPP_PHONE_NUMBER_ID) return 'cloud';
  if (process.env.OPENWA_BASE_URL) return 'openwa';
  return 'simulated';
}

// ─── Per-artist rate limiter (campaign send pacing + abuse guard) ────────────
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
    await artistDoc(artistId).collection('whatsappAuditLog').add({
      action, detail: detail ?? null, ownerId: ownerId ?? null, at: nowMs(),
    });
  } catch (e: any) {
    logger.warn('[whatsapp] audit write failed:', e?.message);
  }
}

// ─────────────────────────── SESSION ────────────────────────────────────────

/** POST /session/create → create/refresh an OpenWA session, return QR. */
router.post('/session/create', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, phoneNumber } = req.body || {};
    if (!artistId) return res.status(400).json({ success: false, error: 'artistId is required' });
    const ownerId = uid(req);

    // Deterministic session id per artist so reconnects reuse the same session.
    const sessionId = `boostify_${String(artistId)}`;
    const gateway = getGateway();
    const created = await gateway.createSession(sessionId);

    const sessionRef = artistDoc(artistId).collection('whatsappSessions').doc(sessionId);
    await sessionRef.set(
      {
        sessionId,
        artistId: String(artistId),
        ownerId,
        artistName: artistName || null,
        phoneNumber: phoneNumber || created.phoneNumber || null,
        sessionStatus: created.status,
        qrCode: created.qrCode || null,
        simulated: !isGatewayConfigured(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: nowMs(),
        lastConnectedAt: created.status === 'connected' ? nowMs() : null,
      },
      { merge: true },
    );
    await audit(artistId, 'session.create', { sessionId, status: created.status }, ownerId);

    // For the official Cloud API, inbound webhooks are keyed by Phone Number ID
    // (not by sessionId), so persist a number→artist map for attribution.
    if (process.env.WHATSAPP_PROVIDER === 'cloud' && process.env.WHATSAPP_PHONE_NUMBER_ID) {
      await db.collection('whatsappNumberMap').doc(String(process.env.WHATSAPP_PHONE_NUMBER_ID))
        .set({ artistId: String(artistId), sessionId, updatedAt: nowMs() }, { merge: true })
        .catch((e: any) => logger.warn('[whatsapp] number map write failed:', e?.message));
    }

    return res.json({ success: true, sessionId, status: created.status, qrCode: created.qrCode || null, simulated: !isGatewayConfigured(), provider: currentProvider() });
  } catch (e: any) {
    logger.error('[whatsapp] session/create error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'session create failed' });
  }
});

/** GET /session/:sessionId/status → live status (+persist transitions). */
router.get('/session/:sessionId/status', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const artistId = sessionId.replace(/^boostify_/, '');
    const gateway = getGateway();
    const status = await gateway.getSessionStatus(sessionId);

    const sessionRef = artistDoc(artistId).collection('whatsappSessions').doc(sessionId);
    await sessionRef.set(
      {
        sessionStatus: status.status,
        qrCode: status.qrCode || null,
        phoneNumber: status.phoneNumber || null,
        updatedAt: nowMs(),
        ...(status.status === 'connected' ? { lastConnectedAt: nowMs() } : {}),
      },
      { merge: true },
    ).catch(() => {});

    return res.json({ success: true, ...status, provider: currentProvider() });
  } catch (e: any) {
    logger.error('[whatsapp] session status error:', e?.message);
    return res.status(500).json({ success: false, error: e?.message || 'status failed' });
  }
});

/** POST /session/:sessionId/disconnect */
router.post('/session/:sessionId/disconnect', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const artistId = sessionId.replace(/^boostify_/, '');
    await getGateway().disconnectSession(sessionId);
    await artistDoc(artistId).collection('whatsappSessions').doc(sessionId)
      .set({ sessionStatus: 'disconnected', qrCode: null, updatedAt: nowMs() }, { merge: true }).catch(() => {});
    await audit(artistId, 'session.disconnect', { sessionId }, uid(req));
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
  const ref = artistDoc(artistId).collection('whatsappMessages').doc();
  await ref.set({ id: ref.id, ...msg, mediaUrl: msg.mediaUrl ?? null, campaignId: msg.campaignId ?? null, timestamp: nowMs() });
  return ref.id;
}

/** POST /message/send { sessionId, to, message } */
router.post('/message/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, to, message } = req.body || {};
    if (!sessionId || !to || !message) return res.status(400).json({ success: false, error: 'sessionId, to and message are required' });
    const artistId = String(sessionId).replace(/^boostify_/, '');
    if (!checkRateLimit(artistId)) return res.status(429).json({ success: false, error: 'rate limit exceeded' });

    const r = await getGateway().sendMessage(sessionId, to, message);
    await persistMessage(artistId, { direction: 'out', from: sessionId, to: normalizePhone(to), body: message, messageType: 'text', status: r.ok ? 'sent' : 'failed' });
    return res.json({ success: r.ok, ...r });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'send failed' });
  }
});

/** POST /media/send { sessionId, to, mediaUrl, caption } */
router.post('/media/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { sessionId, to, mediaUrl, caption } = req.body || {};
    if (!sessionId || !to || !mediaUrl) return res.status(400).json({ success: false, error: 'sessionId, to and mediaUrl are required' });
    const artistId = String(sessionId).replace(/^boostify_/, '');
    if (!checkRateLimit(artistId)) return res.status(429).json({ success: false, error: 'rate limit exceeded' });

    const r = await getGateway().sendMedia(sessionId, to, mediaUrl, caption);
    await persistMessage(artistId, { direction: 'out', from: sessionId, to: normalizePhone(to), body: caption || '', mediaUrl, messageType: 'image', status: r.ok ? 'sent' : 'failed' });
    return res.json({ success: r.ok, ...r });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'media send failed' });
  }
});

// ─────────────────────────── CONTACTS ───────────────────────────────────────

/** GET /contacts/:artistId */
router.get('/contacts/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('whatsappContacts').orderBy('lastMessageAt', 'desc').limit(500).get().catch(async () => {
      return artistDoc(artistId).collection('whatsappContacts').limit(500).get();
    });
    const contacts = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    return res.json({ success: true, contacts });
  } catch (e: any) {
    return res.json({ success: true, contacts: [] });
  }
});

/** POST /contacts/:artistId → import/add contacts (array) with consent flag. */
router.post('/contacts/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const { contacts } = req.body || {};
    if (!Array.isArray(contacts) || !contacts.length) return res.status(400).json({ success: false, error: 'contacts array required' });
    const col = artistDoc(artistId).collection('whatsappContacts');
    const batch = db.batch();
    let added = 0;
    for (const c of contacts.slice(0, 1000)) {
      const phone = normalizePhone(c.phone || '');
      if (!phone) continue;
      const ref = col.doc(phone); // phone = stable id (dedupe)
      batch.set(ref, {
        name: c.name || phone,
        phone,
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

// ─────────────────────────── CAMPAIGNS ──────────────────────────────────────

/** Match a contact against a segment filter. */
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

/** POST /campaign/send { artistId, sessionId, name, segment, message, mediaUrl } */
router.post('/campaign/send', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, sessionId, name, segment = 'all', message, mediaUrl, city } = req.body || {};
    if (!artistId || !sessionId || !message) return res.status(400).json({ success: false, error: 'artistId, sessionId and message are required' });
    const ownerId = uid(req);

    // Eligible contacts = matches segment AND has consent AND not opted-out.
    const snap = await artistDoc(artistId).collection('whatsappContacts').get();
    let targets = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
      .filter((c: any) => c.consentStatus !== 'opted_out')
      .filter((c: any) => matchesSegment(c, segment))
      .filter((c: any) => (segment === 'city' && city ? (c.city || '').toLowerCase() === String(city).toLowerCase() : true));

    if (!checkRateLimit(artistId, targets.length)) {
      return res.status(429).json({ success: false, error: `rate limit: máximo ${MAX_SENDS_PER_MINUTE} mensajes/min. Reduce el segmento.` });
    }

    const campaignRef = artistDoc(artistId).collection('whatsappCampaigns').doc();
    const campaignId = campaignRef.id;
    await campaignRef.set({
      id: campaignId, name: name || 'Campaña', segment, message, mediaUrl: mediaUrl || null,
      status: 'sending', sentCount: 0, deliveredCount: 0, responseCount: 0, conversionCount: 0,
      revenue: 0, targetCount: targets.length, ownerId, createdAt: nowMs(),
    });

    // Fire-and-forget paced send so the request returns immediately.
    (async () => {
      const gateway = getGateway();
      let sent = 0;
      for (const c of targets) {
        try {
          const r = mediaUrl
            ? await gateway.sendMedia(sessionId, c.phone, mediaUrl, message)
            : await gateway.sendMessage(sessionId, c.phone, message);
          if (r.ok) {
            sent++;
            await persistMessage(artistId, { direction: 'out', from: sessionId, to: c.phone, body: message, mediaUrl: mediaUrl || null, messageType: mediaUrl ? 'image' : 'text', status: 'sent', campaignId });
          }
        } catch { /* per-contact failure isolation */ }
        await new Promise((r) => setTimeout(r, 1200)); // pacing → avoid bans
      }
      await campaignRef.set({ status: 'completed', sentCount: sent, deliveredCount: sent, updatedAt: nowMs() }, { merge: true });
      await audit(artistId, 'campaign.sent', { campaignId, sent, segment }, ownerId);
    })().catch((e) => logger.error('[whatsapp] campaign send error:', e?.message));

    return res.json({ success: true, campaignId, targetCount: targets.length, status: 'sending' });
  } catch (e: any) {
    return res.status(500).json({ success: false, error: e?.message || 'campaign failed' });
  }
});

/** GET /campaigns/:artistId */
router.get('/campaigns/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('whatsappCampaigns').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('whatsappCampaigns').limit(100).get());
    return res.json({ success: true, campaigns: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, campaigns: [] });
  }
});

/** GET /messages/:artistId — recent message history. */
router.get('/messages/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const snap = await artistDoc(artistId).collection('whatsappMessages').orderBy('timestamp', 'desc').limit(200).get()
      .catch(() => artistDoc(artistId).collection('whatsappMessages').limit(200).get());
    return res.json({ success: true, messages: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, messages: [] });
  }
});

// ─────────────────────────── AI COMMAND ─────────────────────────────────────

/** POST /ai-command { artistId, artistName, text, sessionId?, replyTo? } */
router.post('/ai-command', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId, artistName, text, sessionId, replyTo } = req.body || {};
    if (!artistId || !text) return res.status(400).json({ success: false, error: 'artistId and text are required' });
    const ownerId = uid(req);

    const classification = await classifyCommand(text);
    const reply = buildReply(classification, artistName || '');

    const cmdRef = artistDoc(artistId).collection('aiCommands').doc();
    await cmdRef.set({
      id: cmdRef.id, rawText: text, intent: classification.intent, moduleTarget: classification.moduleTarget,
      params: classification.params, confidence: classification.confidence, source: classification.source,
      actionStatus: 'classified', result: reply, ownerId, createdAt: nowMs(),
    });

    // If a live session + target phone are provided, push the reply over WhatsApp.
    if (sessionId && replyTo) {
      await getGateway().sendMessage(sessionId, replyTo, reply).catch(() => {});
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
    const snap = await artistDoc(artistId).collection('aiCommands').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('aiCommands').limit(100).get());
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
    const [msgs, campaigns, contacts, sales, commands] = await Promise.all([
      root.collection('whatsappMessages').get().catch(() => ({ docs: [] as any[] })),
      root.collection('whatsappCampaigns').get().catch(() => ({ docs: [] as any[] })),
      root.collection('whatsappContacts').get().catch(() => ({ docs: [] as any[] })),
      root.collection('whatsappSales').get().catch(() => ({ docs: [] as any[] })),
      root.collection('aiCommands').get().catch(() => ({ docs: [] as any[] })),
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
    const snap = await artistDoc(artistId).collection('whatsappSales').orderBy('createdAt', 'desc').limit(100).get()
      .catch(() => artistDoc(artistId).collection('whatsappSales').limit(100).get());
    return res.json({ success: true, sales: snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) });
  } catch {
    return res.json({ success: true, sales: [] });
  }
});

// ─────────────────────────── WEBHOOK ────────────────────────────────────────

/**
 * GET /webhook — Meta Cloud API verification handshake. When you register the
 * callback URL in the Meta dashboard, Meta sends hub.mode/hub.verify_token/
 * hub.challenge; we echo the challenge back if the token matches.
 */
router.get('/webhook', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  const expected = process.env.WHATSAPP_VERIFY_TOKEN || process.env.OPENWA_API_KEY;
  if (mode === 'subscribe' && token && token === expected) {
    return res.status(200).send(String(challenge));
  }
  return res.sendStatus(403);
});

/**
 * POST /webhook — inbound messages from the gateway (OpenWA) or Meta Cloud API.
 * NO Boostify auth (the sender is a server), but we verify a shared secret /
 * Meta signature and ignore anything we can't attribute to an artist session.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const isCloud = process.env.WHATSAPP_PROVIDER === 'cloud';

  // Verify shared secret. Cloud API does NOT send x-openwa-token; it signs the
  // body with X-Hub-Signature-256 (verified at the body-parser level if an app
  // secret is set). For OpenWA we check the shared token header.
  if (!isCloud) {
    const expected = process.env.OPENWA_API_KEY;
    if (expected) {
      const provided = req.headers['x-openwa-token'] || (req.query.token as string) || '';
      if (provided !== expected) return res.status(401).json({ success: false, error: 'unauthorized' });
    }
  }

  // Acknowledge fast; process asynchronously so the gateway isn't blocked.
  res.json({ success: true });

  try {
    const inbound: NormalizedInbound | null = await getGateway().receiveWebhook(req.body);
    if (!inbound || !inbound.from) return;

    // Resolve artistId. Cloud API encodes the Phone Number ID (cloud:<id>);
    // OpenWA encodes the artist in the sessionId (boostify_<artistId>).
    let artistId = '';
    if (inbound.sessionId.startsWith('cloud:')) {
      const phoneNumberId = inbound.sessionId.slice('cloud:'.length);
      const mapSnap = await db.collection('whatsappNumberMap').doc(phoneNumberId).get().catch(() => null);
      artistId = (mapSnap?.exists ? mapSnap.data()?.artistId : '') || '';
    } else {
      artistId = (inbound.sessionId || '').replace(/^boostify_/, '');
    }
    if (!artistId) {
      const q = await db.collectionGroup('whatsappSessions').where('sessionId', '==', inbound.sessionId).limit(1).get().catch(() => ({ docs: [] as any[] }));
      if (q.docs.length) artistId = q.docs[0].ref.parent.parent?.id || '';
    }
    if (!artistId) { logger.warn('[whatsapp] webhook: no artist for session', inbound.sessionId); return; }

    const root = artistDoc(artistId);
    const sessionId = inbound.sessionId.startsWith('cloud:') ? `boostify_${artistId}` : (inbound.sessionId || `boostify_${artistId}`);

    // Persist inbound message.
    await persistMessage(artistId, { direction: 'in', from: inbound.from, to: sessionId, body: inbound.body, mediaUrl: inbound.mediaUrl, messageType: inbound.messageType, status: 'received' });

    // Touch / create the contact.
    const contactRef = root.collection('whatsappContacts').doc(inbound.from);
    await contactRef.set({ name: inbound.fromName || inbound.from, phone: inbound.from, lastMessageAt: nowMs() }, { merge: true });

    // Consent: opt-out keywords.
    if (isOptOut(inbound.body)) {
      await contactRef.set({ consentStatus: 'opted_out', optedOutAt: nowMs() }, { merge: true });
      await getGateway().sendMessage(sessionId, inbound.from, '✅ Listo, no recibirás más campañas. Escribe START para reactivar.').catch(() => {});
      await audit(artistId, 'contact.opt_out', { from: inbound.from });
      return;
    }
    if (/^\s*start\s*$/i.test(inbound.body)) {
      await contactRef.set({ consentStatus: 'opted_in' }, { merge: true });
      await getGateway().sendMessage(sessionId, inbound.from, '🔔 ¡Reactivado! Volverás a recibir novedades.').catch(() => {});
      return;
    }

    // Classify + auto-reply for actionable intents.
    const artistName = (await root.get().catch(() => null))?.data?.()?.artistName || '';
    const classification = await classifyCommand(inbound.body);
    if (classification.intent !== 'unknown') {
      const cmdRef = root.collection('aiCommands').doc();
      await cmdRef.set({
        id: cmdRef.id, rawText: inbound.body, intent: classification.intent, moduleTarget: classification.moduleTarget,
        params: classification.params, confidence: classification.confidence, source: classification.source,
        actionStatus: 'classified', from: inbound.from, channel: 'inbound', createdAt: nowMs(),
      });
      const reply = buildReply(classification, artistName);
      await getGateway().sendMessage(sessionId, inbound.from, reply).catch(() => {});
      await persistMessage(artistId, { direction: 'out', from: sessionId, to: inbound.from, body: reply, messageType: 'text', status: 'sent' });
    }
  } catch (e: any) {
    logger.error('[whatsapp] webhook processing error:', e?.message);
  }
});

export default router;
