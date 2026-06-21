/**
 * boostify-whatsapp-gateway — real OpenWA gateway for Boostify Music
 * ---------------------------------------------------------------------------
 * Runs OpenWA (open-wa / wa-automate) and exposes the EXACT REST contract that
 * Boostify's adapter (server/services/whatsapp-gateway/openwa.adapter.ts) calls:
 *
 *   POST   /api/sessions                          { sessionId }         -> { status, qr }
 *   GET    /api/sessions/:sessionId/status                              -> { status, qr, phoneNumber }
 *   POST   /api/sessions/:sessionId/send-text     { to, content }       -> { messageId }
 *   POST   /api/sessions/:sessionId/send-media    { to, url, caption }  -> { messageId }
 *   POST   /api/sessions/:sessionId/logout
 *
 * Auth: every request must carry header `api_key: <OPENWA_API_KEY>`
 *       (Boostify also sends it as `Authorization: Bearer <OPENWA_API_KEY>`).
 * Inbound: each received WhatsApp message is POSTed to
 *       `${BOOSTIFY_API_URL}/api/whatsapp/webhook` with header
 *       `x-openwa-token: <OPENWA_API_KEY>` and body `{ sessionId, message }`.
 *
 * ⚠️ OpenWA is NOT the official Meta API. Use for support / concierge /
 * controlled automations only — never for unsolicited spam.
 */
'use strict';

const express = require('express');
const axios = require('axios');
const { create } = require('@open-wa/wa-automate');

const PORT = Number(process.env.PORT || 8002);
const API_KEY = process.env.OPENWA_API_KEY || '';
const WEBHOOK_URL =
  process.env.BOOSTIFY_WEBHOOK_URL ||
  (process.env.BOOSTIFY_API_URL ? `${process.env.BOOSTIFY_API_URL.replace(/\/+$/, '')}/api/whatsapp/webhook` : '');

// sessionId -> { status, qr, phoneNumber, client, starting, lastConnectedAt }
const sessions = new Map();

function normalizePhone(input) {
  return String(input || '')
    .replace(/@c\.us$/i, '')
    .replace(/[^\d]/g, '');
}
function chatId(to) {
  const digits = normalizePhone(to);
  return digits.includes('@') ? digits : `${digits}@c.us`;
}
function getState(sessionId) {
  let s = sessions.get(sessionId);
  if (!s) {
    s = { status: 'disconnected', qr: null, phoneNumber: null, client: null, starting: false, lastConnectedAt: null };
    sessions.set(sessionId, s);
  }
  return s;
}

async function postInbound(sessionId, message) {
  if (!WEBHOOK_URL) return;
  try {
    await axios.post(
      WEBHOOK_URL,
      { sessionId, message },
      { headers: { 'x-openwa-token': API_KEY, 'Content-Type': 'application/json' }, timeout: 15_000 },
    );
  } catch (e) {
    console.warn(`[gateway] webhook POST failed: ${e?.response?.status || ''} ${e?.message}`);
  }
}

/** Boot an OpenWA client for a sessionId (idempotent). Captures QR + inbound. */
async function startSession(sessionId) {
  const s = getState(sessionId);
  if (s.client || s.starting) return s;
  s.starting = true;
  s.status = 'initializing';
  s.qr = null;

  create({
    sessionId,
    multiDevice: true,
    headless: true,
    qrTimeout: 0, // never give up waiting for the scan
    authTimeout: 0,
    cacheEnabled: false,
    restartOnCrash: () => startSession(sessionId),
    killProcessOnBrowserClose: false,
    disableSpins: true,
    logConsole: false,
    sessionDataPath: process.env.SESSION_DATA_PATH || './_sessions',
    catchQR: (qrData) => {
      // qrData is a base64 data URL: "data:image/png;base64,...."
      s.status = 'qr';
      s.qr = qrData;
      console.log(`[gateway] ${sessionId} → QR ready (scan it in the Boostify Connect tab)`);
    },
  })
    .then((client) => {
      s.client = client;
      s.qr = null;
      s.status = 'connected';
      s.lastConnectedAt = Date.now();
      s.starting = false;
      console.log(`[gateway] ${sessionId} → connected ✅`);

      client.getHostNumber().then((n) => { s.phoneNumber = normalizePhone(n); }).catch(() => {});

      client.onStateChanged((state) => {
        console.log(`[gateway] ${sessionId} state: ${state}`);
        if (['CONFLICT', 'UNLAUNCHED', 'UNPAIRED', 'UNPAIRED_IDLE'].includes(state)) {
          try { client.forceRefocus(); } catch (_) {}
        }
        if (state === 'CONNECTED') { s.status = 'connected'; s.lastConnectedAt = Date.now(); }
      });

      client.onMessage((msg) => {
        if (msg?.fromMe) return;
        postInbound(sessionId, {
          from: msg.from,
          author: msg.author || msg.from,
          notifyName: msg.notifyName || msg.sender?.pushname || null,
          pushname: msg.sender?.pushname || null,
          body: msg.body || msg.content || '',
          type: msg.type || 'chat',
          mediaUrl: msg.deprecatedMms3Url || null,
          deprecatedMms3Url: msg.deprecatedMms3Url || null,
          t: msg.t || Math.floor(Date.now() / 1000),
          fromMe: false,
        });
      });
    })
    .catch((err) => {
      s.starting = false;
      s.status = 'error';
      s.client = null;
      console.error(`[gateway] ${sessionId} failed to start:`, err?.message || err);
    });

  return s;
}

// ───────────────────────────── HTTP API ─────────────────────────────────────
const app = express();
app.use(express.json({ limit: '15mb' }));

// Shared-secret auth (skip health check).
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health') return next();
  const provided = req.header('api_key') || (req.header('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!API_KEY || provided === API_KEY) return next();
  return res.status(401).json({ error: 'unauthorized' });
});

app.get('/', (_req, res) => res.json({ ok: true, service: 'boostify-whatsapp-gateway' }));

app.post('/api/sessions', async (req, res) => {
  const sessionId = String(req.body?.sessionId || '').trim();
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });
  const s = await startSession(sessionId);
  res.json({ sessionId, status: s.status, qr: s.qr, phoneNumber: s.phoneNumber });
});

app.get('/api/sessions/:sessionId/status', (req, res) => {
  const s = getState(req.params.sessionId);
  res.json({
    sessionId: req.params.sessionId,
    status: s.status,
    qr: s.qr,
    phoneNumber: s.phoneNumber,
    lastConnectedAt: s.lastConnectedAt,
  });
});

app.post('/api/sessions/:sessionId/send-text', async (req, res) => {
  const s = getState(req.params.sessionId);
  if (!s.client) return res.status(409).json({ error: 'session not connected' });
  try {
    const messageId = await s.client.sendText(chatId(req.body?.to), String(req.body?.content || ''));
    res.json({ messageId });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'send failed' });
  }
});

app.post('/api/sessions/:sessionId/send-media', async (req, res) => {
  const s = getState(req.params.sessionId);
  if (!s.client) return res.status(409).json({ error: 'session not connected' });
  try {
    const id = chatId(req.body?.to);
    const url = String(req.body?.url || '');
    const caption = String(req.body?.caption || '');
    const filename = (url.split('/').pop() || 'file').split('?')[0] || 'file';
    const messageId = await s.client.sendFileFromUrl(id, url, filename, caption);
    res.json({ messageId });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'send media failed' });
  }
});

app.post('/api/sessions/:sessionId/logout', async (req, res) => {
  const s = getState(req.params.sessionId);
  try {
    if (s.client) {
      try { await s.client.logout(); } catch (_) {}
      try { await s.client.kill(); } catch (_) {}
    }
  } finally {
    s.client = null;
    s.status = 'disconnected';
    s.qr = null;
  }
  res.json({ ok: true });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[gateway] boostify-whatsapp-gateway listening on :${PORT}`);
  console.log(`[gateway] webhook → ${WEBHOOK_URL || '(BOOSTIFY_API_URL not set — inbound disabled)'}`);
  if (!API_KEY) console.warn('[gateway] OPENWA_API_KEY not set — API is UNPROTECTED. Set it!');
});
