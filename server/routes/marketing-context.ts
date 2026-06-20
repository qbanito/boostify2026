/**
 * Marketing Context API Routes
 * Mounted at: /api/marketing-context
 *
 * Endpoints:
 *   GET  /api/marketing-context/:userId               — get stored context
 *   POST /api/marketing-context/:userId/generate      — (re)generate context
 *   PUT  /api/marketing-context/:userId               — manual update of fields
 *   GET  /api/marketing-context/:userId/skills        — list available skills
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { artistMarketingContext, users } from '../../db/schema';
import { eq } from 'drizzle-orm';
import {
  getArtistMarketingContext,
  generateArtistMarketingContext,
} from '../services/artist-marketing-context';
import { listAvailableSkills, loadSkill } from '../services/marketing-skills-loader';

const router = Router();

// ─── Helper: resolve Clerk userId → PostgreSQL userId ────────────────────────
async function resolvePgUserId(paramId: string): Promise<number | null> {
  const numId = parseInt(paramId, 10);
  if (!isNaN(numId)) return numId;
  // If not numeric, try looking up by clerkId
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, paramId))
    .limit(1);
  return u?.id ?? null;
}

// ─── GET /api/marketing-context/:userId ──────────────────────────────────────
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const pgId = await resolvePgUserId(req.params.userId);
    if (!pgId) return res.status(404).json({ success: false, error: 'Artist not found' });

    const ctx = await getArtistMarketingContext(pgId);
    if (!ctx) return res.json({ success: true, context: null, message: 'No context generated yet' });

    return res.json({ success: true, context: ctx });
  } catch (err: any) {
    console.error('[marketing-context] GET error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /api/marketing-context/:userId/generate ────────────────────────────
router.post('/:userId/generate', async (req: Request, res: Response) => {
  try {
    const pgId = await resolvePgUserId(req.params.userId);
    if (!pgId) return res.status(404).json({ success: false, error: 'Artist not found' });

    const contextMd = await generateArtistMarketingContext(pgId);
    const stored = await getArtistMarketingContext(pgId);

    return res.json({ success: true, contextMd, context: stored });
  } catch (err: any) {
    console.error('[marketing-context] POST generate error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PUT /api/marketing-context/:userId ──────────────────────────────────────
// Allows manual overrides of individual fields (usp, targetAudience, brandVoice, etc.)
router.put('/:userId', async (req: Request, res: Response) => {
  try {
    const pgId = await resolvePgUserId(req.params.userId);
    if (!pgId) return res.status(404).json({ success: false, error: 'Artist not found' });

    const allowedFields = [
      'artistName', 'genre', 'subgenre', 'targetAudience', 'brandVoice',
      'usp', 'positioning', 'primaryGoals', 'contentPillars',
      'similarArtists', 'differentiators',
    ] as const;

    const updates: Record<string, any> = { updatedAt: new Date() };
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 1) {
      return res.status(400).json({ success: false, error: 'No valid fields provided' });
    }

    const existing = await db
      .select({ id: artistMarketingContext.id })
      .from(artistMarketingContext)
      .where(eq(artistMarketingContext.userId, pgId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(artistMarketingContext)
        .set(updates)
        .where(eq(artistMarketingContext.userId, pgId));
    } else {
      await db.insert(artistMarketingContext).values({ userId: pgId, ...updates });
    }

    const stored = await getArtistMarketingContext(pgId);
    return res.json({ success: true, context: stored });
  } catch (err: any) {
    console.error('[marketing-context] PUT error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/marketing-context/skills/list ─────────────────────────────────
router.get('/skills/list', async (_req: Request, res: Response) => {
  try {
    const skills = listAvailableSkills();
    return res.json({ success: true, skills, count: skills.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /api/marketing-context/skills/:skillName ────────────────────────────
router.get('/skills/:skillName', async (req: Request, res: Response) => {
  try {
    const content = loadSkill(req.params.skillName);
    if (!content) return res.status(404).json({ success: false, error: 'Skill not found' });
    return res.json({ success: true, skillName: req.params.skillName, content });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
