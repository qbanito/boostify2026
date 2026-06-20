// ─── Motion Capture routes ──────────────────────────────────────────────────
// Powers the "phone-as-camera" Live Link flow + recorded performance takes.
//
//  • Pairing: the desktop studio asks for a short-lived pairing code/token and
//    shows it as a QR. The phone opens the encoded URL, validates the token and
//    starts streaming its camera motion into the artist's Live Link room — no
//    App Store app required, it's just a web page.
//  • Takes: a recorded performance (a timeline of bone-direction + face frames,
//    optionally sung to one of the artist's songs) is uploaded here. The motion
//    JSON is stored in Firebase Storage; a metadata row in `motion_capture_takes`
//    links it to the artist + song so it can be replayed on the avatar for the
//    hologram repertoire.

import { Router, type Request, type Response } from 'express';
import { randomUUID, randomInt } from 'crypto';
import { db } from '../db';
import { motionCaptureTakes, songs, users } from '../../db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import { storage } from '../firebase';

const router = Router();

// ─── Ownership helper ────────────────────────────────────────────────────────
async function isArtistOwner(pgUserId: number, artistId: number, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  if (pgUserId === artistId) return true;
  try {
    const [artist] = await db
      .select({ generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);
    return artist?.generatedBy === pgUserId;
  } catch {
    return false;
  }
}

// ─── Pairing sessions (in-memory, short-lived) ───────────────────────────────
// A pairing ties a random token to an artist's Live Link room. The phone must
// present a valid, unexpired token before it streams, so a stranger can't push
// motion into an artist's room just by guessing the numeric id.
interface PairingSession {
  token: string;
  code: string;        // human-readable 6-digit code (fallback to typing)
  artistId: string;
  showId: string;
  createdAt: number;
  expiresAt: number;
  claimedAt: number | null;
  claimedLabel: string | null;
}

const PAIRING_TTL_MS = 10 * 60 * 1000; // 10 minutes
const pairings = new Map<string, PairingSession>();

function prunePairings(): void {
  const now = Date.now();
  for (const [token, p] of pairings) {
    if (p.expiresAt < now) pairings.delete(token);
  }
}

// POST /api/motion-capture/:artistId/pair — desktop creates a pairing (auth + owner).
router.post('/:artistId/pair', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = String(req.params.artistId || '');
    const numericArtist = Number(artistId);
    if (!Number.isInteger(numericArtist) || numericArtist <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid artist id' });
    }
    const pgUserId = Number(req.user!.id);
    const isAdmin = !!req.user!.isAdmin;
    if (!(await isArtistOwner(pgUserId, numericArtist, isAdmin))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this artist' });
    }

    prunePairings();
    const showId = String(req.body?.showId || 'livelink');
    const token = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const now = Date.now();
    const session: PairingSession = {
      token, code, artistId, showId,
      createdAt: now,
      expiresAt: now + PAIRING_TTL_MS,
      claimedAt: null,
      claimedLabel: null,
    };
    pairings.set(token, session);

    // Relative path the phone should open. The client turns this into an
    // absolute URL (with its own origin) for the QR code.
    const path = `/m/mocap/${encodeURIComponent(artistId)}?s=${encodeURIComponent(token)}`;
    res.json({
      success: true,
      token,
      code,
      path,
      showId,
      expiresAt: session.expiresAt,
    });
  } catch (error: any) {
    console.error('[motion-capture] pair error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not create pairing' });
  }
});

// GET /api/motion-capture/pair/:token — validate/poll a pairing (no auth; the
// phone has no session). Returns minimal info + claim status.
router.get('/pair/:token', (req: Request, res: Response) => {
  prunePairings();
  const p = pairings.get(String(req.params.token || ''));
  if (!p) return res.status(404).json({ success: false, valid: false, message: 'Pairing not found or expired' });
  res.json({
    success: true,
    valid: true,
    artistId: p.artistId,
    showId: p.showId,
    claimed: !!p.claimedAt,
    claimedLabel: p.claimedLabel,
    expiresAt: p.expiresAt,
  });
});

// POST /api/motion-capture/pair/:token/claim — phone marks the pairing claimed
// (no auth). The desktop polls GET to learn the phone connected.
router.post('/pair/:token/claim', (req: Request, res: Response) => {
  prunePairings();
  const p = pairings.get(String(req.params.token || ''));
  if (!p) return res.status(404).json({ success: false, message: 'Pairing not found or expired' });
  p.claimedAt = Date.now();
  p.claimedLabel = String(req.body?.label || 'Phone camera').slice(0, 60);
  res.json({ success: true, artistId: p.artistId, showId: p.showId });
});

// ─── Recorded takes ──────────────────────────────────────────────────────────

// GET /api/motion-capture/:artistId/takes — list takes for an artist (public read).
router.get('/:artistId/takes', async (req: Request, res: Response) => {
  try {
    const numericArtist = Number(req.params.artistId);
    if (!Number.isInteger(numericArtist) || numericArtist <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid artist id' });
    }
    const songFilter = req.query.songId != null ? Number(req.query.songId) : null;
    const where = songFilter && Number.isInteger(songFilter)
      ? and(eq(motionCaptureTakes.artistId, numericArtist), eq(motionCaptureTakes.songId, songFilter))
      : eq(motionCaptureTakes.artistId, numericArtist);
    const takes = await db
      .select()
      .from(motionCaptureTakes)
      .where(where)
      .orderBy(desc(motionCaptureTakes.createdAt));
    res.json({ success: true, takes });
  } catch (error: any) {
    console.error('[motion-capture] list takes error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not load takes' });
  }
});

// GET /api/motion-capture/takes/:id/motion — fetch the motion timeline JSON for
// playback (proxied via the stored public URL). Public read.
router.get('/takes/:id/motion', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const [take] = await db.select().from(motionCaptureTakes).where(eq(motionCaptureTakes.id, id)).limit(1);
    if (!take) return res.status(404).json({ success: false, message: 'Take not found' });
    res.json({ success: true, motionUrl: take.motionUrl, take });
  } catch (error: any) {
    console.error('[motion-capture] get motion error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not load take' });
  }
});

// POST /api/motion-capture/:artistId/takes — save a recorded performance (auth + owner).
// Body: { title, songId?, songTitle?, source, fps, durationMs, hasFace, frames: [...] }
router.post('/:artistId/takes', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = String(req.params.artistId || '');
    const numericArtist = Number(artistId);
    if (!Number.isInteger(numericArtist) || numericArtist <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid artist id' });
    }
    const pgUserId = Number(req.user!.id);
    const isAdmin = !!req.user!.isAdmin;
    if (!(await isArtistOwner(pgUserId, numericArtist, isAdmin))) {
      return res.status(403).json({ success: false, message: 'Not authorized for this artist' });
    }

    const body = req.body || {};
    const frames = Array.isArray(body.frames) ? body.frames : null;
    if (!frames || frames.length === 0) {
      return res.status(400).json({ success: false, message: 'No motion frames to save' });
    }
    if (frames.length > 200_000) {
      return res.status(413).json({ success: false, message: 'Recording too long' });
    }

    const source = ['phone', 'webcam', 'suit'].includes(body.source) ? body.source : 'webcam';
    const fps = Math.max(1, Math.min(120, Number(body.fps) || 30));
    const durationMs = Math.max(0, Number(body.durationMs) || 0);
    const hasFace = !!body.hasFace;
    let songId: number | null = body.songId != null ? Number(body.songId) : null;
    if (songId != null && !Number.isInteger(songId)) songId = null;
    const songTitle = body.songTitle ? String(body.songTitle).slice(0, 200) : null;
    const title = String(body.title || songTitle || `Take ${new Date().toISOString().slice(0, 16)}`).slice(0, 200);

    if (!storage) {
      return res.status(503).json({ success: false, message: 'Storage not available' });
    }

    // Store the motion timeline JSON in Firebase Storage.
    const payload = JSON.stringify({
      version: 1,
      artistId,
      songId,
      songTitle,
      source,
      fps,
      durationMs,
      hasFace,
      frames,
      recordedAt: Date.now(),
    });
    const objectPath = `motion-capture/${artistId}/take-${Date.now()}-${randomUUID().slice(0, 8)}.json`;
    const bucket = storage.bucket();
    const file = bucket.file(objectPath);
    await file.save(Buffer.from(payload), {
      contentType: 'application/json',
      resumable: false,
      metadata: { cacheControl: 'public, max-age=31536000, immutable' },
    });
    await file.makePublic();
    const motionUrl = `https://storage.googleapis.com/${bucket.name}/${encodeURI(objectPath)}`;

    const [take] = await db
      .insert(motionCaptureTakes)
      .values({
        artistId: numericArtist,
        userId: pgUserId,
        songId: songId ?? undefined,
        songTitle: songTitle ?? undefined,
        title,
        source,
        motionUrl,
        durationMs,
        frameCount: frames.length,
        fps,
        hasFace,
        thumbnailUrl: body.thumbnailUrl ? String(body.thumbnailUrl).slice(0, 500) : undefined,
      })
      .returning();

    console.log(`🎭 [motion-capture] saved take ${take.id} (${frames.length} frames, ${(payload.length / 1024).toFixed(0)}KB) for artist ${artistId}`);
    res.json({ success: true, take });
  } catch (error: any) {
    console.error('[motion-capture] save take error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not save take' });
  }
});

// DELETE /api/motion-capture/takes/:id — delete a take (auth + owner).
router.delete('/takes/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const [take] = await db.select().from(motionCaptureTakes).where(eq(motionCaptureTakes.id, id)).limit(1);
    if (!take) return res.status(404).json({ success: false, message: 'Take not found' });

    const pgUserId = Number(req.user!.id);
    const isAdmin = !!req.user!.isAdmin;
    if (!(await isArtistOwner(pgUserId, take.artistId, isAdmin))) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Best-effort delete of the stored JSON.
    try {
      if (storage && take.motionUrl) {
        const bucket = storage.bucket();
        const prefix = `https://storage.googleapis.com/${bucket.name}/`;
        if (take.motionUrl.startsWith(prefix)) {
          const objectPath = decodeURI(take.motionUrl.slice(prefix.length));
          await bucket.file(objectPath).delete().catch(() => {});
        }
      }
    } catch { /* ignore storage cleanup errors */ }

    await db.delete(motionCaptureTakes).where(eq(motionCaptureTakes.id, id));
    res.json({ success: true });
  } catch (error: any) {
    console.error('[motion-capture] delete take error:', error?.message || error);
    res.status(500).json({ success: false, message: 'Could not delete take' });
  }
});

export default router;
