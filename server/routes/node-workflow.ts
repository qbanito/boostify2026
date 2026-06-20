/**
 * BOOSTIFY NODE WORKFLOW — API Routes
 * GET  /api/node-workflow/:artistId  — load saved workflow
 * POST /api/node-workflow/:artistId  — save workflow (nodes + edges + schedules)
 * POST /api/node-workflow/webhook/:token — external webhook trigger
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { users } from '../db/schema';
import { eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { workflowScheduler } from '../services/workflow-scheduler';

const router = Router();

// ─── GET: load workflow ───────────────────────────────────────────────────────
router.get('/:artistId', async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const isNumeric = /^\d+$/.test(artistId);

    let artist: any = null;
    if (isNumeric) {
      [artist] = await db.select().from(users).where(eq(users.id, parseInt(artistId))).limit(1);
    } else {
      [artist] = await db.select().from(users).where(eq(users.username, artistId)).limit(1);
    }

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const workflow = (artist as any).nodeWorkflow ?? null;
    return res.json({ workflow, savedAt: workflow?.savedAt ?? null });
  } catch (err: any) {
    console.error('[node-workflow] GET error:', err);
    return res.status(500).json({ error: 'Failed to load workflow' });
  }
});

// ─── POST: save workflow ──────────────────────────────────────────────────────
router.post('/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const { artistId } = req.params;
    const userId = (req as any).user?.id;
    const { nodes = [], edges = [] } = req.body;

    const isNumeric = /^\d+$/.test(artistId);
    let artist: any = null;
    if (isNumeric) {
      [artist] = await db.select().from(users).where(eq(users.id, parseInt(artistId))).limit(1);
    } else {
      [artist] = await db.select().from(users).where(eq(users.username, artistId)).limit(1);
    }

    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    // Only the artist owner can save
    if (artist.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const workflow = {
      nodes,
      edges,
      savedAt: new Date().toISOString(),
    };

    await db
      .update(users)
      .set({ nodeWorkflow: workflow } as any)
      .where(eq(users.id, artist.id));

    // Re-register cron schedules for this artist after save
    try {
      workflowScheduler.registerArtistSchedules(artist.id, artist.username, nodes);
    } catch (schedErr) {
      console.warn('[node-workflow] Schedule registration warning:', schedErr);
    }

    return res.json({ success: true, savedAt: workflow.savedAt });
  } catch (err: any) {
    console.error('[node-workflow] POST error:', err);
    return res.status(500).json({ error: 'Failed to save workflow' });
  }
});

// ─── POST: webhook trigger ────────────────────────────────────────────────────
// External services POST here to trigger a webhook-trigger node in the workflow.
router.post('/webhook/:artistSlug/:token', async (req: Request, res: Response) => {
  try {
    const { artistSlug, token } = req.params;
    const payload = req.body ?? {};

    const [artist] = await db.select().from(users).where(eq(users.username, artistSlug)).limit(1);
    if (!artist) return res.status(404).json({ error: 'Artist not found' });

    const workflow = (artist as any).nodeWorkflow as { nodes?: any[] } | null;
    if (!workflow?.nodes) return res.status(400).json({ error: 'No workflow configured' });

    // Find the webhook trigger node matching the token
    const webhookNode = workflow.nodes.find(
      (n: any) => n.type === 'webhookTrigger' && n.data?.webhookToken === token
    );
    if (!webhookNode) return res.status(404).json({ error: 'Webhook token not found' });

    // Record last trigger time
    webhookNode.data.lastTriggered = new Date().toISOString();
    webhookNode.data.lastPayload = JSON.stringify(payload).slice(0, 500);

    await db
      .update(users)
      .set({ nodeWorkflow: { ...workflow, savedAt: new Date().toISOString() } } as any)
      .where(eq(users.id, artist.id));

    console.log(`[webhook] Triggered for artist ${artistSlug}, node ${webhookNode.id}`);
    return res.json({ success: true, triggered: webhookNode.id, artistId: artist.id });
  } catch (err: any) {
    console.error('[node-workflow] webhook error:', err);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
