import express from 'express';
import { db } from '../db';
import {
  studioProjects, studioVersions, studioFeedback, studioSessions,
  insertStudioProjectSchema, insertStudioVersionSchema, insertStudioFeedbackSchema
} from '../../db/schema';
import { eq, desc, and, sql, count } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Apply auth middleware to all studio routes
router.use(authenticate);

// Helper to extract userId from authenticated request
function getUserId(req: express.Request): string | null {
  const user = (req as any).user;
  return user?.id || user?.uid || null;
}

// ============================================================
// STUDIO PROJECTS
// ============================================================

// GET /api/studio/projects â€” List user's projects
router.get('/projects', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projects = await db
      .select()
      .from(studioProjects)
      .where(eq(studioProjects.userId, userId))
      .orderBy(desc(studioProjects.updatedAt));

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('[studio] Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// POST /api/studio/projects â€” Create project
router.post('/projects', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { name, description, tracks, genre, bpm, key: musicalKey } = req.body;
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Name is required' });
    
    const [project] = await db.insert(studioProjects).values({
      userId,
      name,
      description: description || null,
      tracks: Array.isArray(tracks) ? tracks : [],
      genre: genre || null,
      bpm: bpm ? parseInt(bpm) : null,
      key: musicalKey || null,
    }).returning();
    res.json({ success: true, data: project });
  } catch (error) {
    console.error('[studio] Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// PATCH /api/studio/projects/:id â€” Update project
router.patch('/projects/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id);
    const [existing] = await db.select().from(studioProjects)
      .where(and(eq(studioProjects.id, projectId), eq(studioProjects.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    const { name, description, tracks, status, genre, bpm, key: musicalKey } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (tracks !== undefined) updates.tracks = tracks;
    if (status !== undefined) updates.status = status;
    if (genre !== undefined) updates.genre = genre;
    if (bpm !== undefined) updates.bpm = bpm;
    if (musicalKey !== undefined) updates.key = musicalKey;

    const [updated] = await db.update(studioProjects)
      .set(updates)
      .where(eq(studioProjects.id, projectId))
      .returning();
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[studio] Error updating project:', error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// DELETE /api/studio/projects/:id â€” Delete project (cascade deletes versions + feedback)
router.delete('/projects/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id);
    const [existing] = await db.select().from(studioProjects)
      .where(and(eq(studioProjects.id, projectId), eq(studioProjects.userId, userId)));
    if (!existing) return res.status(404).json({ error: 'Project not found' });

    await db.delete(studioProjects).where(eq(studioProjects.id, projectId));
    res.json({ success: true });
  } catch (error) {
    console.error('[studio] Error deleting project:', error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ============================================================
// STUDIO VERSIONS
// ============================================================

// GET /api/studio/projects/:id/versions â€” List versions for a project
router.get('/projects/:id/versions', async (req, res) => {
  try {
    const projectId = parseInt(req.params.id);
    const versions = await db
      .select()
      .from(studioVersions)
      .where(eq(studioVersions.projectId, projectId))
      .orderBy(desc(studioVersions.createdAt));

    res.json({ success: true, data: versions });
  } catch (error) {
    console.error('[studio] Error fetching versions:', error);
    res.status(500).json({ error: 'Failed to fetch versions' });
  }
});

// POST /api/studio/projects/:id/versions â€” Create version (metadata only, file uploaded to Firebase)
router.post('/projects/:id/versions', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const projectId = parseInt(req.params.id);
    const { name, trackName, audioUrl, duration, fileSize, format, uploadedByName, notes } = req.body;
    if (!name || !trackName || !audioUrl) return res.status(400).json({ error: 'name, trackName, audioUrl required' });

    const [version] = await db.insert(studioVersions).values({
      projectId,
      userId,
      name,
      trackName,
      audioUrl,
      duration: duration ? parseInt(duration) : null,
      fileSize: fileSize ? parseInt(fileSize) : null,
      format: format || null,
      uploadedByName: uploadedByName || null,
      notes: notes || null,
    }).returning();
    res.json({ success: true, data: version });
  } catch (error) {
    console.error('[studio] Error creating version:', error);
    res.status(500).json({ error: 'Failed to create version' });
  }
});

// PATCH /api/studio/versions/:id/status â€” Approve/reject version
router.patch('/versions/:id/status', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const versionId = parseInt(req.params.id);
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const [updated] = await db.update(studioVersions)
      .set({ status })
      .where(eq(studioVersions.id, versionId))
      .returning();
    if (!updated) return res.status(404).json({ error: 'Version not found' });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('[studio] Error updating version status:', error);
    res.status(500).json({ error: 'Failed to update version status' });
  }
});

// DELETE /api/studio/versions/:id â€” Delete version
router.delete('/versions/:id', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const versionId = parseInt(req.params.id);
    await db.delete(studioVersions).where(eq(studioVersions.id, versionId));
    res.json({ success: true });
  } catch (error) {
    console.error('[studio] Error deleting version:', error);
    res.status(500).json({ error: 'Failed to delete version' });
  }
});

// ============================================================
// FEEDBACK
// ============================================================

// GET /api/studio/versions/:id/feedback â€” List feedback for a version
router.get('/versions/:id/feedback', async (req, res) => {
  try {
    const versionId = parseInt(req.params.id);
    const feedback = await db
      .select()
      .from(studioFeedback)
      .where(eq(studioFeedback.versionId, versionId))
      .orderBy(desc(studioFeedback.createdAt));

    res.json({ success: true, data: feedback });
  } catch (error) {
    console.error('[studio] Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

// POST /api/studio/versions/:id/feedback â€” Add feedback
router.post('/versions/:id/feedback', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const versionId = parseInt(req.params.id);
    const { content, userName, timestamp: ts } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const [fb] = await db.insert(studioFeedback).values({
      versionId,
      userId,
      content,
      userName: userName || null,
      timestamp: ts || null,
    }).returning();
    res.json({ success: true, data: fb });
  } catch (error) {
    console.error('[studio] Error adding feedback:', error);
    res.status(500).json({ error: 'Failed to add feedback' });
  }
});

// ============================================================
// STUDIO STATS
// ============================================================

// GET /api/studio/stats â€” Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const userId = getUserId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const [projectCount] = await db
      .select({ count: count() })
      .from(studioProjects)
      .where(eq(studioProjects.userId, userId));

    const [versionCount] = await db
      .select({ count: count() })
      .from(studioVersions)
      .where(eq(studioVersions.userId, userId));

    const [pendingCount] = await db
      .select({ count: count() })
      .from(studioVersions)
      .where(and(eq(studioVersions.userId, userId), eq(studioVersions.status, 'pending')));

    const [approvedCount] = await db
      .select({ count: count() })
      .from(studioVersions)
      .where(and(eq(studioVersions.userId, userId), eq(studioVersions.status, 'approved')));

    const [feedbackCount] = await db
      .select({ count: count() })
      .from(studioFeedback)
      .where(eq(studioFeedback.userId, userId));

    const [sessionCount] = await db
      .select({ count: count() })
      .from(studioSessions)
      .where(eq(studioSessions.hostUserId, userId));

    res.json({
      success: true,
      data: {
        projects: projectCount?.count || 0,
        versions: versionCount?.count || 0,
        pending: pendingCount?.count || 0,
        approved: approvedCount?.count || 0,
        feedback: feedbackCount?.count || 0,
        sessions: sessionCount?.count || 0,
      }
    });
  } catch (error) {
    console.error('[studio] Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

