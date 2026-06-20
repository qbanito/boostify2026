/**
 * Artist Career Suite — REST API
 *
 * Mounted at:
 *   /api/artist/suite           → artist-authenticated endpoints
 *   /api/admin/artist-suite     → admin endpoints (approve / reject / list)
 *
 * Subscription lifecycle:
 *   activate  → status='pending' (or 'approved' if requester is admin)
 *   admin approve / reject
 *   first chat command → status='active'
 *
 * NOTE: This router exposes BOTH user-facing and admin endpoints under one file
 * for cohesion. Mount it twice in routes.ts (the path prefix discriminates).
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import {
  artistSuiteSubscriptions,
  artistSuiteAgents,
  artistSuiteThreads,
  artistSuiteMessages,
  artistSuiteSettings,
  artistSuiteMemory,
  artistSuiteGoals,
} from '../db/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import { requireAdmin } from '../middleware/require-admin';
import { requireAuth } from '../middleware/clerk-auth';
import { isAdminEmail } from '../../shared/constants';
import {
  runArtistAgentTurn,
  artistRuntimeEvents,
  seedPersonalAgentsForArtist,
} from '../services/artist-suite/runtime';
import {
  PERSONAL_AGENT_KEYS,
  CORPORATE_AGENT_KEYS,
  PERSONAL_AGENT_PRESETS,
  type ArtistAgentKey,
} from '../services/artist-suite/agent-presets';

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

function resolveArtistId(req: Request): string | null {
  // Priority 1: explicit param/body (admin pages, scripted clients)
  const explicit =
    (req.params && (req.params.artistId as string)) ||
    (req.body && (req.body.artistId as string)) ||
    (req.query && (req.query.artistId as string));
  if (explicit) return String(explicit);

  // Priority 2: fall back to the authenticated Clerk user id
  const u = (req as any).user;
  if (u?.id) return String(u.id);
  return null;
}

function isRequesterAdmin(req: Request): boolean {
  const email =
    (req as any).adminEmail ||
    (req as any).user?.email ||
    (req as any).auth?.sessionClaims?.email;
  return !!email && isAdminEmail(email);
}

/**
 * Guard for artist-self endpoints: only the artist themselves OR an admin
 * may operate on a given artistId.
 */
function ensureSelfOrAdmin(req: Request, res: Response, artistId: string): boolean {
  const u = (req as any).user;
  const isAdmin = isRequesterAdmin(req);
  if (isAdmin) return true;
  if (!u?.id) {
    res.status(401).json({ ok: false, error: 'Authentication required' });
    return false;
  }
  if (String(u.id) !== String(artistId)) {
    res.status(403).json({ ok: false, error: 'You can only manage your own Career Suite.' });
    return false;
  }
  return true;
}

async function loadSubscription(artistId: string) {
  const [sub] = await db
    .select()
    .from(artistSuiteSubscriptions)
    .where(eq(artistSuiteSubscriptions.artistId, artistId))
    .limit(1);
  return sub;
}

// ════════════════════════════════════════════════════════════════
// Router
// ════════════════════════════════════════════════════════════════

const router = Router();

// ──────────────────────────────────────────────────────────────
// PUBLIC catalog (no auth required) — agent presets metadata
// ──────────────────────────────────────────────────────────────
router.get('/catalog', (_req, res) => {
  res.json({
    ok: true,
    personalAgents: PERSONAL_AGENT_PRESETS.map((p) => ({
      agentKey: p.agentKey,
      name: p.name,
      role: p.role,
    })),
    corporateAgents: CORPORATE_AGENT_KEYS,
  });
});

// ──────────────────────────────────────────────────────────────
// ARTIST endpoints (mount under `/api/artist/suite`)
// All require auth; artistId resolved from session OR explicit param.
// ──────────────────────────────────────────────────────────────

router.get('/status', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;

    const sub = await loadSubscription(artistId);
    if (!sub) {
      return res.json({
        ok: true,
        artistId,
        subscription: null,
        active: false,
      });
    }
    const agents = await db
      .select()
      .from(artistSuiteAgents)
      .where(eq(artistSuiteAgents.artistId, artistId));
    res.json({
      ok: true,
      artistId,
      subscription: sub,
      active: sub.status === 'approved' || sub.status === 'active',
      agents,
    });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/activate', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;

    const requesterIsAdmin = isRequesterAdmin(req);
    const note = (req.body?.note as string) || null;

    const existing = await loadSubscription(artistId);
    if (existing && existing.status !== 'rejected' && existing.status !== 'cancelled') {
      return res.status(409).json({
        ok: false,
        error: `Subscription already exists with status '${existing.status}'.`,
        subscription: existing,
      });
    }

    const initialStatus = requesterIsAdmin ? 'approved' : 'pending';
    let row;
    if (existing) {
      [row] = await db
        .update(artistSuiteSubscriptions)
        .set({
          status: initialStatus,
          requestedAt: new Date(),
          decidedAt: requesterIsAdmin ? new Date() : null,
          decidedBy: requesterIsAdmin ? (req as any).adminEmail || (req as any).user?.email : null,
          decisionNote: note,
          updatedAt: new Date(),
        })
        .where(eq(artistSuiteSubscriptions.id, existing.id))
        .returning();
    } else {
      [row] = await db
        .insert(artistSuiteSubscriptions)
        .values({
          artistId,
          plan: 'elite',
          status: initialStatus,
          decidedAt: requesterIsAdmin ? new Date() : null,
          decidedBy: requesterIsAdmin ? (req as any).adminEmail || (req as any).user?.email : null,
          decisionNote: note,
        })
        .returning();
    }

    if (initialStatus === 'approved') {
      const seed = await seedPersonalAgentsForArtist(artistId);
      return res.json({ ok: true, subscription: row, autoApproved: true, seeded: seed });
    }
    res.json({ ok: true, subscription: row, autoApproved: false });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/agents', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const agents = await db
      .select()
      .from(artistSuiteAgents)
      .where(eq(artistSuiteAgents.artistId, artistId));
    res.json({ ok: true, agents });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/command', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;

    const { agentKey, sessionType, message, parentThreadId } = req.body || {};
    if (!agentKey || !message) {
      return res.status(400).json({ ok: false, error: 'agentKey and message are required' });
    }
    const session: 'personal' | 'corporate' =
      sessionType === 'corporate' ? 'corporate' : 'personal';

    if (
      session === 'personal' &&
      !PERSONAL_AGENT_KEYS.includes(agentKey)
    ) {
      return res.status(400).json({ ok: false, error: `Unknown personal agent: ${agentKey}` });
    }
    if (
      session === 'corporate' &&
      !(CORPORATE_AGENT_KEYS as readonly string[]).includes(agentKey)
    ) {
      return res.status(400).json({ ok: false, error: `Unknown corporate agent: ${agentKey}` });
    }

    const result = await runArtistAgentTurn({
      artistId,
      agentKey: agentKey as ArtistAgentKey,
      sessionType: session,
      userMessage: String(message),
      parentThreadId: parentThreadId ? Number(parentThreadId) : undefined,
      triggeredBy: 'artist',
      artistEmail: (req as any).user?.email,
      adminOverride: isRequesterAdmin(req),
    });

    // Check if user message has external action intent (IG post, email fans, etc.)
    const userId: number | undefined = (req as any).user?.id;
    if (userId) {
      try {
        const { handleExternalActionIntent } = await import('../services/external-action-router');
        const extResult = await handleExternalActionIntent(userId, String(message), {
          generatedContent: result.finalText,
        });
        if (extResult.handled && extResult.message) {
          return res.json({ ok: true, result, externalAction: extResult });
        }
      } catch (_) { /* fire-and-forget */ }
    }

    res.json({ ok: true, result });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/stream', requireAuth, async (req, res) => {
  const artistId = resolveArtistId(req);
  if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
  if (!ensureSelfOrAdmin(req, res, artistId)) return;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  const handler = (event: any) => {
    if (!event || event.artistId !== artistId) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };
  artistRuntimeEvents.on('event', handler);

  const ping = setInterval(() => {
    res.write(`: ping\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(ping);
    artistRuntimeEvents.off('event', handler);
  });
});

router.get('/threads', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const rows = await db
      .select()
      .from(artistSuiteThreads)
      .where(eq(artistSuiteThreads.artistId, artistId))
      .orderBy(desc(artistSuiteThreads.createdAt))
      .limit(limit);
    res.json({ ok: true, threads: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/threads/:id/messages', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const id = Number(req.params.id);
    // Verify the thread belongs to this artist:
    const [thread] = await db
      .select()
      .from(artistSuiteThreads)
      .where(and(eq(artistSuiteThreads.id, id), eq(artistSuiteThreads.artistId, artistId)))
      .limit(1);
    if (!thread) return res.status(404).json({ ok: false, error: 'Thread not found' });
    const msgs = await db
      .select()
      .from(artistSuiteMessages)
      .where(eq(artistSuiteMessages.threadId, id))
      .orderBy(artistSuiteMessages.createdAt);
    res.json({ ok: true, thread, messages: msgs });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/goals', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const rows = await db
      .select()
      .from(artistSuiteGoals)
      .where(eq(artistSuiteGoals.artistId, artistId))
      .orderBy(desc(artistSuiteGoals.createdAt));
    res.json({ ok: true, goals: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/goals', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const { ownerAgent, title, metric, targetValue, baseline, periodEnd } = req.body || {};
    if (!ownerAgent || !title || !metric || targetValue == null) {
      return res.status(400).json({ ok: false, error: 'ownerAgent, title, metric, targetValue required' });
    }
    const [row] = await db
      .insert(artistSuiteGoals)
      .values({
        artistId,
        ownerAgent: String(ownerAgent),
        title: String(title),
        metric: String(metric),
        targetValue: String(targetValue),
        baseline: baseline != null ? String(baseline) : null,
        periodEnd: periodEnd ? new Date(periodEnd) : null,
        status: 'on_track',
      })
      .returning();
    res.json({ ok: true, goal: row });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/memory/:agentKey', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const rows = await db
      .select()
      .from(artistSuiteMemory)
      .where(
        and(
          eq(artistSuiteMemory.artistId, artistId),
          eq(artistSuiteMemory.agentKey, req.params.agentKey),
        ),
      )
      .orderBy(desc(artistSuiteMemory.weight))
      .limit(100);
    res.json({ ok: true, memory: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.get('/settings', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const [row] = await db
      .select()
      .from(artistSuiteSettings)
      .where(eq(artistSuiteSettings.artistId, artistId))
      .limit(1);
    res.json({ ok: true, settings: row || null });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.patch('/settings', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const allowed: Record<string, any> = {};
    for (const k of ['killSwitch', 'dryRunGlobal', 'preferredModel', 'notes']) {
      if (k in (req.body || {})) allowed[k] = (req.body as any)[k];
    }
    if (!Object.keys(allowed).length) {
      return res.status(400).json({ ok: false, error: 'No updatable fields provided' });
    }
    allowed.updatedAt = new Date();

    const existing = await db
      .select()
      .from(artistSuiteSettings)
      .where(eq(artistSuiteSettings.artistId, artistId))
      .limit(1);
    let row;
    if (existing.length) {
      [row] = await db
        .update(artistSuiteSettings)
        .set(allowed)
        .where(eq(artistSuiteSettings.artistId, artistId))
        .returning();
    } else {
      [row] = await db
        .insert(artistSuiteSettings)
        .values({ artistId, ...allowed })
        .returning();
    }
    res.json({ ok: true, settings: row });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const artistId = resolveArtistId(req);
    if (!artistId) return res.status(400).json({ ok: false, error: 'Missing artistId' });
    if (!ensureSelfOrAdmin(req, res, artistId)) return;
    const [row] = await db
      .update(artistSuiteSubscriptions)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(eq(artistSuiteSubscriptions.artistId, artistId))
      .returning();
    res.json({ ok: true, subscription: row });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

export default router;

// ════════════════════════════════════════════════════════════════
// ADMIN router — mount under `/api/admin/artist-suite`
// ════════════════════════════════════════════════════════════════

export const adminArtistSuiteRouter = Router();
adminArtistSuiteRouter.use(requireAdmin);

adminArtistSuiteRouter.get('/requests', async (req, res) => {
  try {
    const status = (req.query.status as string) || 'pending';
    const rows = await db
      .select()
      .from(artistSuiteSubscriptions)
      .where(eq(artistSuiteSubscriptions.status, status))
      .orderBy(desc(artistSuiteSubscriptions.requestedAt))
      .limit(200);
    res.json({ ok: true, requests: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

adminArtistSuiteRouter.get('/subscriptions', async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(artistSuiteSubscriptions)
      .orderBy(desc(artistSuiteSubscriptions.updatedAt))
      .limit(500);
    res.json({ ok: true, subscriptions: rows });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

adminArtistSuiteRouter.post('/requests/:id/approve', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const note = (req.body?.note as string) || null;
    const adminEmail = (req as any).adminEmail;
    const [updated] = await db
      .update(artistSuiteSubscriptions)
      .set({
        status: 'approved',
        decidedAt: new Date(),
        decidedBy: adminEmail,
        decisionNote: note,
        updatedAt: new Date(),
      })
      .where(eq(artistSuiteSubscriptions.id, id))
      .returning();
    if (!updated) return res.status(404).json({ ok: false, error: 'Subscription not found' });
    const seed = await seedPersonalAgentsForArtist(updated.artistId);
    res.json({ ok: true, subscription: updated, seeded: seed });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

adminArtistSuiteRouter.post('/requests/:id/reject', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const note = (req.body?.note as string) || null;
    const [updated] = await db
      .update(artistSuiteSubscriptions)
      .set({
        status: 'rejected',
        decidedAt: new Date(),
        decidedBy: (req as any).adminEmail,
        decisionNote: note,
        updatedAt: new Date(),
      })
      .where(eq(artistSuiteSubscriptions.id, id))
      .returning();
    if (!updated) return res.status(404).json({ ok: false, error: 'Subscription not found' });
    res.json({ ok: true, subscription: updated });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

adminArtistSuiteRouter.get('/stats', async (_req, res) => {
  try {
    const [counts] = await db.execute<any>(sql`
      SELECT
        COUNT(*) FILTER (WHERE status='pending')   AS pending,
        COUNT(*) FILTER (WHERE status='approved')  AS approved,
        COUNT(*) FILTER (WHERE status='active')    AS active,
        COUNT(*) FILTER (WHERE status='rejected')  AS rejected,
        COUNT(*) FILTER (WHERE status='cancelled') AS cancelled
      FROM artist_suite_subscriptions
    `);
    res.json({ ok: true, stats: counts });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e.message });
  }
});
