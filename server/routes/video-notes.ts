/**
 * Video Notes — Time-coded annotations on videos.
 *
 * Routes:
 *  GET    /api/videos/:videoId/notes        → list notes (respects isPrivate)
 *  POST   /api/videos/:videoId/notes        → create note (auth required)
 *  PATCH  /api/video-notes/:id              → edit note (only author)
 *  DELETE /api/video-notes/:id              → delete (author or video owner)
 */
import { Router, Request, Response } from 'express';
import { and, asc, eq, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getAuth as getClerkAuth } from '@clerk/express';
import { db } from '../db';
import { videoNotes, users } from '../../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// ---- Validators --------------------------------------------------------
const createSchema = z.object({
  timecodeMs: z.number().int().min(0).max(60 * 60 * 24 * 1000), // up to 24h
  endTimecodeMs: z.number().int().min(0).optional().nullable(),
  text: z.string().min(1).max(2000),
  color: z.string().max(16).optional().nullable(),
  isPrivate: z.boolean().optional(),
  ownerUserId: z.number().int().optional(),
  // Guest display name (required when not authenticated)
  guestName: z.string().trim().min(1).max(60).optional().nullable(),
});

const updateSchema = z.object({
  timecodeMs: z.number().int().min(0).optional(),
  endTimecodeMs: z.number().int().min(0).optional().nullable(),
  text: z.string().min(1).max(2000).optional(),
  color: z.string().max(16).optional().nullable(),
  isPrivate: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

// ---- Simple in-memory rate limit (10 writes / min per user or IP) -----
const writeBuckets = new Map<string, { count: number; resetAt: number }>();
function rateLimit(key: string | number): boolean {
  const k = String(key);
  const now = Date.now();
  const bucket = writeBuckets.get(k);
  if (!bucket || bucket.resetAt < now) {
    writeBuckets.set(k, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (bucket.count >= 10) return false;
  bucket.count++;
  return true;
}

// ---- Helpers -----------------------------------------------------------
async function getNoteById(id: number) {
  const [note] = await db
    .select()
    .from(videoNotes)
    .where(eq(videoNotes.id, id))
    .limit(1);
  return note;
}

/**
 * Resolve the numeric Postgres users.id from whatever auth identifier is on
 * the request. Our Clerk middleware puts the clerk string id on
 * req.user.id, which is NOT the FK we need for video_notes.user_id.
 */
async function resolveNumericUserId(req: Request): Promise<number | null> {
  // 1) If a higher middleware already attached req.user, try that first.
  let raw: unknown = (req as any).user?.id;
  // 2) Fall back to Clerk (works even on public routes without `authenticate`).
  if (raw == null) {
    try {
      const clerkAuth = getClerkAuth(req);
      if (clerkAuth && clerkAuth.userId) raw = clerkAuth.userId;
    } catch {
      /* clerk not configured */
    }
  }
  if (raw == null) return null;
  if (typeof raw === 'number') return raw;
  const asNum = Number(raw);
  if (!Number.isNaN(asNum) && /^\d+$/.test(String(raw))) return asNum;
  const [row] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkId, String(raw)))
    .limit(1);
  return row?.id ?? null;
}

// ========================================================================
// GET /api/videos/:videoId/notes
// ========================================================================
export function registerVideoNotesList(app: any) {
  app.get('/api/videos/:videoId/notes', async (req: Request, res: Response) => {
    try {
      const { videoId } = req.params;
      if (!videoId) return res.status(400).json({ error: 'videoId required' });

      // Best-effort: identify current user if session/token is present (not
      // required — we want anon visitors to see public notes).
      const currentUserId = await resolveNumericUserId(req);

      // Filter: public notes OR private notes where user is the author OR
      // owner of the video.
      const rows = await db
        .select()
        .from(videoNotes)
        .where(
          and(
            eq(videoNotes.videoId, String(videoId)),
            currentUserId
              ? or(
                  eq(videoNotes.isPrivate, false),
                  eq(videoNotes.userId, currentUserId),
                  eq(videoNotes.ownerUserId, currentUserId),
                )
              : eq(videoNotes.isPrivate, false),
          ),
        )
        .orderBy(asc(videoNotes.timecodeMs));

      // Enrich with author name (single batched query)
      const authorIds = Array.from(
        new Set(rows.map((r) => r.userId).filter((v): v is number => v != null)),
      );
      let authorsById = new Map<number, { id: number; name: string | null; avatar: string | null }>();
      if (authorIds.length > 0) {
        const authors = await db
          .select({
            id: users.id,
            artistName: users.artistName,
            firstName: users.firstName,
            username: users.username,
            profileImage: users.profileImage,
          })
          .from(users)
          .where(sql`${users.id} = ANY(${authorIds})`);
        for (const a of authors) {
          authorsById.set(a.id, {
            id: a.id,
            name: a.artistName || a.firstName || a.username || null,
            avatar: a.profileImage || null,
          });
        }
      }

      const enriched = rows.map((n) => ({
        ...n,
        author: n.userId != null
          ? authorsById.get(n.userId) || null
          : (n.guestName ? { id: 0, name: n.guestName, avatar: null } : null),
        isGuest: n.userId == null,
        isOwnerNote: n.userId != null && n.ownerUserId != null && n.ownerUserId === n.userId,
        canEdit: currentUserId != null && currentUserId === n.userId,
        canDelete:
          (currentUserId != null && currentUserId === n.userId) ||
          (currentUserId != null && currentUserId === n.ownerUserId),
      }));

      return res.json({ notes: enriched });
    } catch (err: any) {
      console.error('❌ [video-notes] list failed:', err);
      return res.status(500).json({ error: 'Failed to list notes' });
    }
  });

  // ======================================================================
  // POST /api/videos/:videoId/notes (public — guests allowed with name)
  // ======================================================================
  app.post(
    '/api/videos/:videoId/notes',
    async (req: Request, res: Response) => {
      try {
        const userId = await resolveNumericUserId(req);
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            error: 'Invalid payload',
            details: parsed.error.flatten(),
          });
        }
        const data = parsed.data;

        // Require either a logged-in user OR a non-empty guest name.
        const guestName = data.guestName ? data.guestName.trim().slice(0, 60) : null;
        if (!userId && !guestName) {
          return res.status(400).json({ error: 'Name required to post as guest' });
        }

        const rlKey = userId ?? `ip:${req.ip || req.socket?.remoteAddress || 'anon'}`;
        if (!rateLimit(rlKey)) {
          return res.status(429).json({ error: 'Too many notes. Slow down.' });
        }

        const { videoId } = req.params;
        if (!videoId) return res.status(400).json({ error: 'videoId required' });

        const [created] = await db
          .insert(videoNotes)
          .values({
            videoId: String(videoId),
            userId: userId ?? null,
            guestName: userId ? null : guestName,
            ownerUserId: data.ownerUserId ?? null,
            timecodeMs: data.timecodeMs,
            endTimecodeMs: data.endTimecodeMs ?? null,
            text: data.text.trim(),
            color: data.color ?? null,
            // Guests can't post private notes.
            isPrivate: userId ? (data.isPrivate ?? false) : false,
          } as any)
          .returning();

        return res.status(201).json({ note: created });
      } catch (err: any) {
        console.error('❌ [video-notes] create failed:', err);
        return res.status(500).json({ error: 'Failed to create note' });
      }
    },
  );
}

// ========================================================================
// Router for /api/video-notes/:id (PATCH / DELETE)
// ========================================================================
router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    if (!rateLimit(userId)) {
      return res.status(429).json({ error: 'Too many updates' });
    }

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const note = await getNoteById(id);
    if (!note) return res.status(404).json({ error: 'Note not found' });
    if (note.userId !== userId) {
      return res.status(403).json({ error: 'Only the author can edit this note' });
    }

    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
    }
    const data = parsed.data;

    const patch: any = { updatedAt: new Date() };
    if (data.timecodeMs != null) patch.timecodeMs = data.timecodeMs;
    if (data.endTimecodeMs !== undefined) patch.endTimecodeMs = data.endTimecodeMs;
    if (data.text != null) patch.text = data.text.trim();
    if (data.color !== undefined) patch.color = data.color;
    if (data.isPrivate != null) patch.isPrivate = data.isPrivate;
    if (data.isPinned != null) patch.isPinned = data.isPinned;

    const [updated] = await db
      .update(videoNotes)
      .set(patch)
      .where(eq(videoNotes.id, id))
      .returning();

    return res.json({ note: updated });
  } catch (err: any) {
    console.error('❌ [video-notes] update failed:', err);
    return res.status(500).json({ error: 'Failed to update note' });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await resolveNumericUserId(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ error: 'Invalid id' });

    const note = await getNoteById(id);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    const isAuthor = note.userId === userId;
    const isVideoOwner = note.ownerUserId != null && note.ownerUserId === userId;
    if (!isAuthor && !isVideoOwner) {
      return res.status(403).json({ error: 'Not allowed' });
    }

    await db.delete(videoNotes).where(eq(videoNotes.id, id));
    return res.json({ success: true });
  } catch (err: any) {
    console.error('❌ [video-notes] delete failed:', err);
    return res.status(500).json({ error: 'Failed to delete note' });
  }
});

export default router;
