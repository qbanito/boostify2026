/**
 * Song Collaborators API
 *
 * POST /api/song-collaborators/add         — Add a musician to a song project
 * GET  /api/song-collaborators/:projectId  — List collaborators for a project
 * PATCH /api/song-collaborators/:id/deliver — Mark work delivered
 * DELETE /api/song-collaborators/:id       — Remove a collaborator
 */

import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { neon } from '@neondatabase/serverless';

const router = Router();
const sql = neon(process.env.DATABASE_URL!);

// ─── POST /add ────────────────────────────────────────────────────────────────

router.post('/add', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const {
      songProjectId,
      musicianName,
      instrument,
      role,
      agreementType,
      contributionNotes,
      royaltyPercentage = 0,
      musicianId,
      bookingRef,
    } = req.body;

    if (!songProjectId || !musicianName || !instrument || !role || !agreementType) {
      return res.status(400).json({ error: 'songProjectId, musicianName, instrument, role, agreementType required' });
    }

    // Verify the project belongs to this artist
    const [project] = await sql(
      `SELECT id FROM original_song_projects WHERE id = $1 AND user_id = $2`,
      [songProjectId, userId]
    );
    if (!project) return res.status(404).json({ error: 'Song project not found' });

    const [collab] = await sql(
      `INSERT INTO song_collaborators
         (song_project_id, artist_user_id, musician_id, musician_name, instrument,
          role, agreement_type, contribution_notes, royalty_percentage, booking_ref,
          agreement_sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NOW())
       RETURNING *`,
      [songProjectId, userId, musicianId || null, musicianName, instrument,
        role, agreementType, contributionNotes || null, royaltyPercentage, bookingRef || null]
    );

    res.json({ ok: true, collaborator: collab });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /:projectId ──────────────────────────────────────────────────────────

router.get('/:projectId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Verify ownership
    const [project] = await sql(
      `SELECT id FROM original_song_projects WHERE id = $1 AND user_id = $2`,
      [req.params.projectId, userId]
    );
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const collabs = await sql(
      `SELECT * FROM song_collaborators WHERE song_project_id = $1 ORDER BY created_at`,
      [req.params.projectId]
    );
    res.json({ collaborators: collabs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /:id/sign-agreement ────────────────────────────────────────────────

router.patch('/:id/sign-agreement', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await sql(
      `UPDATE song_collaborators SET agreement_signed_at = NOW()
       WHERE id = $1 AND artist_user_id = $2`,
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PATCH /:id/deliver ───────────────────────────────────────────────────────

router.patch('/:id/deliver', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { deliveryUrl, deliveryNotes } = req.body;

    await sql(
      `UPDATE song_collaborators SET delivery_url = $1, delivery_notes = $2, delivered_at = NOW()
       WHERE id = $3 AND artist_user_id = $4`,
      [deliveryUrl || null, deliveryNotes || null, req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── DELETE /:id ──────────────────────────────────────────────────────────────

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await sql(
      `DELETE FROM song_collaborators WHERE id = $1 AND artist_user_id = $2`,
      [req.params.id, userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
