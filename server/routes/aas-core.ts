/**
 * AAS Core Routes
 * 
 * API endpoints for the Autonomous Artist Survival System.
 * All routes are mounted under /api/aas
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import {
  aasConfig,
  aasDailyActionLog,
  aasSurvivalMetrics,
  aasDealPipeline,
  aasApprovalQueue,
  aasStrategicMemory,
  users,
} from '../db/schema';
import { eq, desc, and } from 'drizzle-orm';
import { calculateSurvivalScore, getFinancialSnapshot } from '../services/aas/survival-score';
import { runDailyCycle } from '../services/aas/daily-cycle';
import { getTodayGoals, getGoalsSummary } from '../services/aas/daily-goals';
import { isAuthenticated } from '../middleware/clerk-auth';
import { isAdminEmail } from '../../shared/constants';

const router = Router();

// ── Ownership / auth helpers ──────────────────────────────
// The AAS engine can spend real budget and send real outreach on an artist's
// behalf, so mutating endpoints MUST verify that the caller owns the artist.

/** Extract the Clerk user id + pre-resolved pg id from the request. */
function getCaller(req: Request): { clerkUserId: string; resolvedPgId?: number } {
  const clerkUserId = (req as any).user?.clerkUserId ?? (req as any).user?.uid ?? '';
  const resolvedPgId = typeof (req as any).user?.id === 'number' ? ((req as any).user.id as number) : undefined;
  return { clerkUserId, resolvedPgId };
}

/** Verify that the authenticated caller owns (or is admin over) the given artist. */
async function verifyArtistOwnership(
  artistId: number,
  clerkUserId: string,
  resolvedPgId?: number,
): Promise<{ allowed: boolean; pgUserId?: number; error?: string }> {
  let pgUserId: number | undefined = resolvedPgId;
  let callerEmail = '';

  if (pgUserId) {
    const [callerRow] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, pgUserId))
      .limit(1);
    callerEmail = callerRow?.email ?? '';
  } else {
    if (!clerkUserId) return { allowed: false, error: 'Authentication required' };
    const [callerRow] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.clerkId, clerkUserId))
      .limit(1);
    if (!callerRow) return { allowed: false, error: 'User not found' };
    pgUserId = callerRow.id;
    callerEmail = callerRow.email ?? '';
  }

  // Admin bypass
  if (isAdminEmail(callerEmail)) return { allowed: true, pgUserId };

  const [artist] = await db
    .select({ id: users.id, generatedBy: users.generatedBy })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);
  if (!artist) return { allowed: false, pgUserId, error: 'Artist not found' };

  const isOwner = artist.id === pgUserId || artist.generatedBy === pgUserId;
  return { allowed: isOwner, pgUserId, error: isOwner ? undefined : 'Not authorized for this artist' };
}

/**
 * Express guard: requires auth + ownership of req.params.artistId.
 * Responds 401/403/400 directly when the check fails, otherwise calls next().
 */
async function requireArtistOwner(req: Request, res: Response, next: () => void) {
  const artistId = parseInt(req.params.artistId, 10);
  if (isNaN(artistId)) {
    return res.status(400).json({ success: false, error: 'Invalid artist ID' });
  }
  const { clerkUserId, resolvedPgId } = getCaller(req);
  if (!clerkUserId && resolvedPgId === undefined) {
    return res.status(401).json({ success: false, error: 'Authentication required' });
  }
  const { allowed, error } = await verifyArtistOwnership(artistId, clerkUserId, resolvedPgId);
  if (!allowed) {
    return res.status(error === 'Artist not found' ? 404 : 403).json({ success: false, error: error || 'Forbidden' });
  }
  next();
}

// Tracks artists with a manual cycle currently running, to prevent duplicate /
// concurrent cycles (which would double-spend budget and send duplicate emails).
const runningCycles = new Set<number>();
const MANUAL_CYCLE_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes

// ── Toggle AAS on/off for an artist ───────────────────────
router.post('/toggle/:artistId', isAuthenticated, requireArtistOwner, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    // Check if config exists
    const [existing] = await db
      .select()
      .from(aasConfig)
      .where(eq(aasConfig.artistId, artistId));

    if (existing) {
      // Toggle
      const newEnabled = !existing.enabled;
      await db
        .update(aasConfig)
        .set({ enabled: newEnabled, updatedAt: new Date() })
        .where(eq(aasConfig.artistId, artistId));

      return res.json({ success: true, enabled: newEnabled });
    } else {
      // First activation — create config with defaults
      await db.insert(aasConfig).values({
        artistId,
        enabled: true,
      });
      return res.json({ success: true, enabled: true });
    }
  } catch (error: any) {
    console.error('[AAS] Toggle error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get AAS status for an artist ──────────────────────────
router.get('/status/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const [config] = await db
      .select()
      .from(aasConfig)
      .where(eq(aasConfig.artistId, artistId));

    if (!config) {
      return res.json({
        success: true,
        enabled: false,
        configured: false,
      });
    }

    return res.json({
      success: true,
      enabled: config.enabled,
      configured: true,
      survivalScore: config.survivalScore,
      lastCycleAt: config.lastCycleAt,
      pricingTier: config.pricingTier,
      maxDailyBudget: config.maxDailyBudget,
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get full AAS profile for an artist ────────────────────
router.get('/profile/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const [config] = await db
      .select()
      .from(aasConfig)
      .where(eq(aasConfig.artistId, artistId));

    if (!config) {
      return res.json({ success: true, profile: null });
    }

    return res.json({ success: true, profile: config });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Update AAS config ─────────────────────────────────────
router.patch('/config/:artistId', isAuthenticated, requireArtistOwner, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const allowedFields = [
      'lore', 'voiceTone', 'aestheticStyle', 'brandValues', 'moralLimits',
      'targetMarket', 'pricingTier', 'productsEnabled', 'targetTerritories',
      'primaryLanguage', 'quarterlyGoals', 'maxDailyBudget', 'maxOutreachPerDay',
      'requireApprovalAbove', 'allowedChannels', 'blockedActions',
    ];

    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    await db
      .update(aasConfig)
      .set(updates)
      .where(eq(aasConfig.artistId, artistId));

    return res.json({ success: true });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Run a cycle manually ──────────────────────────────────
router.post('/run-cycle/:artistId', isAuthenticated, requireArtistOwner, async (req: Request, res: Response) => {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    // Prevent duplicate / concurrent cycles for the same artist — a second
    // cycle while one is in flight would double-spend budget and send
    // duplicate outreach.
    if (runningCycles.has(artistId)) {
      return res.status(409).json({ success: false, error: 'A cycle is already running for this artist' });
    }

    runningCycles.add(artistId);
    try {
      // Watchdog: if a single agent hangs, fail fast instead of holding the
      // HTTP request (and the concurrency lock) open indefinitely.
      const summary = await Promise.race([
        runDailyCycle(artistId),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cycle timed out after 4 minutes')), MANUAL_CYCLE_TIMEOUT_MS),
        ),
      ]);
      return res.json({ success: true, summary });
    } catch (error: any) {
      console.error('[AAS] Run cycle error:', error);
      return res.status(500).json({ success: false, error: error.message });
    } finally {
      runningCycles.delete(artistId);
    }
});

// ── Get survival score ────────────────────────────────────
router.get('/score/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const score = await calculateSurvivalScore(artistId);
    const financial = await getFinancialSnapshot(artistId);

    // Refresh the cached score on the config row so GET /status agrees with the
    // freshly computed value (it previously kept showing the "50.00" default).
    try {
      await db
        .update(aasConfig)
        .set({ survivalScore: String(score.total), updatedAt: new Date() })
        .where(eq(aasConfig.artistId, artistId));
    } catch (cacheErr) {
      console.error('[AAS] Failed to refresh cached survival score:', cacheErr);
    }

    return res.json({ success: true, score, financial });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get metrics history ───────────────────────────────────
router.get('/metrics/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const metrics = await db
      .select()
      .from(aasSurvivalMetrics)
      .where(eq(aasSurvivalMetrics.artistId, artistId))
      .orderBy(desc(aasSurvivalMetrics.createdAt))
      .limit(30);

    return res.json({ success: true, metrics });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get today's plan ──────────────────────────────────────
router.get('/plan/:artistId/today', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const today = new Date().toISOString().slice(0, 10);
    const [log] = await db
      .select()
      .from(aasDailyActionLog)
      .where(
        and(
          eq(aasDailyActionLog.artistId, artistId),
          eq(aasDailyActionLog.cycleDate, today),
        ),
      )
      .orderBy(desc(aasDailyActionLog.createdAt))
      .limit(1);

    return res.json({ success: true, plan: log || null });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get deal pipeline ─────────────────────────────────────
router.get('/deals/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const deals = await db
      .select()
      .from(aasDealPipeline)
      .where(eq(aasDealPipeline.artistId, artistId))
      .orderBy(desc(aasDealPipeline.updatedAt));

    return res.json({ success: true, deals });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get pending approvals ─────────────────────────────────
router.get('/approvals/:artistId/pending', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const pending = await db
      .select()
      .from(aasApprovalQueue)
      .where(
        and(
          eq(aasApprovalQueue.artistId, artistId),
          eq(aasApprovalQueue.status, 'pending'),
        ),
      )
      .orderBy(desc(aasApprovalQueue.createdAt));

    return res.json({ success: true, approvals: pending });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Approve/Reject an action ──────────────────────────────
router.post('/approvals/:id/:decision', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10);
    const decision = req.params.decision;
    if (isNaN(id) || !['approve', 'reject'].includes(decision)) {
      return res.status(400).json({ success: false, error: 'Invalid id or decision' });
    }

    // Verify the caller owns the artist this approval belongs to.
    const [approval] = await db
      .select({ artistId: aasApprovalQueue.artistId })
      .from(aasApprovalQueue)
      .where(eq(aasApprovalQueue.id, id))
      .limit(1);
    if (!approval) {
      return res.status(404).json({ success: false, error: 'Approval not found' });
    }
    const { clerkUserId, resolvedPgId } = getCaller(req);
    const { allowed, error: ownerErr } = await verifyArtistOwnership(approval.artistId, clerkUserId, resolvedPgId);
    if (!allowed) {
      return res.status(403).json({ success: false, error: ownerErr || 'Forbidden' });
    }

    const status = decision === 'approve' ? 'approved' : 'rejected';
    const note = req.body.note || '';

    await db
      .update(aasApprovalQueue)
      .set({
        status: status as 'approved' | 'rejected',
        decidedAt: new Date(),
        decisionNote: note,
      })
      .where(eq(aasApprovalQueue.id, id));

    return res.json({ success: true, status });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get strategic memory ──────────────────────────────────
router.get('/insights/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const insights = await db
      .select()
      .from(aasStrategicMemory)
      .where(eq(aasStrategicMemory.artistId, artistId))
      .orderBy(desc(aasStrategicMemory.updatedAt))
      .limit(50);

    return res.json({ success: true, insights });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get daily goals ───────────────────────────────────────
router.get('/goals/:artistId', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const goals = await getTodayGoals(artistId);
    return res.json({ success: true, goals });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ── Get goals summary ─────────────────────────────────────
router.get('/goals/:artistId/summary', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId)) {
      return res.status(400).json({ success: false, error: 'Invalid artist ID' });
    }

    const date = req.query.date as string | undefined;
    const summary = await getGoalsSummary(artistId, date);
    return res.json({ success: true, summary });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
