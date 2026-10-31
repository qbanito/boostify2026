/**
 * Artist Hermes Proxy — Clerk-authenticated frontend facade over /api/hermes
 *
 * The raw /api/hermes/* routes require x-hermes-secret header (server-to-server).
 * This router exposes the same data to the authenticated frontend user via
 * Clerk session auth, so the secret is never sent to the browser.
 *
 * Mounted at: /api/artist-hermes
 */

import { Router } from 'express';
import { getUserId, requireAuth } from '../middleware/clerk-auth';
import { exportArtistHermesProfile } from '../services/hermes-memory';
import { HERMES_AGENT_MODEL, runHermesArtistChat } from '../services/hermes-agent';
import { rateLimitAiGen } from '../middleware/rate-limit';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { copilotUiResultSchema, type CopilotStreamEvent } from '../../shared/artist-profile-copilot';
import { findProfileCopilotSession, ProfileCopilotSession } from '../services/artist-profile-copilot-session';

const router = Router();

// ── Ownership guard ────────────────────────────────────────────────────────────
// Confirms the requesting user owns the given pgId (numeric artist id).
async function isArtistOwner(clerkId: string, artistPgId: number): Promise<boolean> {
  try {
    const [requester] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.clerkId, clerkId))
      .limit(1);
    const [artist] = await db
      .select({ id: users.id, clerkId: users.clerkId, generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, artistPgId))
      .limit(1);
    return !!artist && (
      artist.clerkId === clerkId ||
      (!!requester && (artist.id === requester.id || artist.generatedBy === requester.id))
    );
  } catch {
    return false;
  }
}

// ── GET /api/artist-hermes/:id/status ─────────────────────────────────────────
router.get('/:id/status', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req) || '';
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json({
      status: process.env.OPENAI_API_KEY ? 'ok' : 'degraded',
      agentName: 'Hermes',
      model: HERMES_AGENT_MODEL,
      provider: 'OpenAI Agents SDK',
      capabilities: ['artist-context', 'music-catalog', 'blueprint', 'goals', 'visual-history', 'specialist-handoffs', 'profile-tools', 'profile-layout'],
      integration: process.env.OPENAI_API_KEY ? 'active' : 'needs_openai_key',
      artistId,
    });
  } catch (err) {
    console.error('[hermes-proxy] status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const chatSchema = z.object({
  message: z.string().trim().min(1).max(5000),
  enableProfileTools: z.boolean().optional().default(false),
  stream: z.boolean().optional().default(false),
  conversationHistory: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(5000),
  })).max(20).optional(),
});

router.post('/:id/chat/:runId/ui-result', requireAuth, async (req, res) => {
  const artistId = Number(req.params.id);
  const ownerId = getUserId(req);
  const parsed = z.object({ requestId: z.string().uuid(), result: copilotUiResultSchema }).safeParse(req.body);
  if (!Number.isSafeInteger(artistId) || artistId <= 0 || !parsed.success) return res.status(400).json({ error: 'Invalid interface result.' });
  const session = ownerId ? findProfileCopilotSession(req.params.runId, artistId, ownerId) : undefined;
  if (!session) return res.status(404).json({ error: 'This Copilot session is no longer active.' });
  if (!session.accept(parsed.data.requestId, parsed.data.result)) return res.status(409).json({ error: 'This interface request was already completed or expired.' });
  return res.json({ success: true });
});

// OpenAI-powered chat; artist data is loaded server-side after the ownership check.
router.post('/:id/chat', requireAuth, rateLimitAiGen, async (req, res) => {
  let session: ProfileCopilotSession | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const send = (event: CopilotStreamEvent) => {
    if (!res.writableEnded && !res.destroyed) res.write(`${JSON.stringify(event)}\n`);
  };
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const parsed = chatSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten() });
    }
    if (parsed.data.stream) {
      if (!parsed.data.enableProfileTools) return res.status(400).json({ error: 'Streaming requires profile tools.' });
      session = new ProfileCopilotSession(artistId, userId, send);
      res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.on('close', () => session?.close());
      heartbeat = setInterval(() => send({ type: 'heartbeat' }), 10_000);
      send({ type: 'session', runId: session.id });
      const result = await runHermesArtistChat({ artistId, ...parsed.data, ownerId: userId, runtime: session });
      send({ type: 'result', response: result.response, actions: result.actions, actionsHandled: true });
      return res.end();
    }
    const result = await runHermesArtistChat({ artistId, ...parsed.data, ownerId: userId });
    return res.json({ success: true, ...result });
  } catch (err: any) {
    if (err?.message === 'OpenAI is not configured for Hermes.') {
      if (res.headersSent) { send({ type: 'error', message: 'Hermes AI is temporarily unavailable.' }); return res.end(); }
      return res.status(503).json({ error: 'Hermes AI is temporarily unavailable.' });
    }
    const diagnosticMessage = String(err?.message || 'unknown error')
      .replace(/sk-[A-Za-z0-9_-]{8,}/g, '[redacted]')
      .slice(0, 400);
    const diagnostic = {
      name: String(err?.name || 'Error').slice(0, 80),
      status: Number.isFinite(err?.status) ? err.status : undefined,
      code: typeof err?.code === 'string' ? err.code.slice(0, 80) : undefined,
      message: diagnosticMessage,
    };
    console.error('[hermes-proxy] chat error:', diagnostic);
    if (res.headersSent) {
      send({ type: 'error', message: process.env.NODE_ENV === 'production' ? 'Hermes could not finish this task. Applied changes remain visible in your profile.' : `Hermes could not finish this task: ${diagnostic.message}` });
      return res.end();
    }
    return res.status(502).json({
      error: 'Hermes could not complete that reply. Please try again.',
      ...(process.env.NODE_ENV === 'production' ? {} : { diagnostic }),
    });
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    session?.close();
  }
});

// ── GET /api/artist-hermes/:id/profile ────────────────────────────────────────
router.get('/:id/profile', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req) || '';
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const profile = await exportArtistHermesProfile(artistId);
    res.json({ success: true, ...profile });
  } catch (err) {
    console.error('[hermes-proxy] profile error:', err);
    res.status(500).json({ error: 'Failed to load Hermes profile' });
  }
});

// ── GET /api/artist-hermes/:id/memory ─────────────────────────────────────────
router.get('/:id/memory', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req) || '';
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { memory } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, memory });
  } catch (err) {
    console.error('[hermes-proxy] memory error:', err);
    res.status(500).json({ error: 'Failed to load memory' });
  }
});

// ── GET /api/artist-hermes/:id/soul ───────────────────────────────────────────
router.get('/:id/soul', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req) || '';
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { soul } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, soul });
  } catch (err) {
    console.error('[hermes-proxy] soul error:', err);
    res.status(500).json({ error: 'Failed to load soul' });
  }
});

// ── GET /api/artist-hermes/:id/goals ──────────────────────────────────────────
router.get('/:id/goals', requireAuth, async (req, res) => {
  try {
    const artistId = parseInt(req.params.id, 10);
    if (isNaN(artistId)) return res.status(400).json({ error: 'Invalid artist id' });

    const userId = getUserId(req) || '';
    if (!(await isArtistOwner(userId, artistId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const { goals } = await exportArtistHermesProfile(artistId);
    res.json({ success: true, goals });
  } catch (err) {
    console.error('[hermes-proxy] goals error:', err);
    res.status(500).json({ error: 'Failed to load goals' });
  }
});

export default router;
