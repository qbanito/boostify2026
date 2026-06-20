/**
 * Artist Fan Leads Routes
 * POST   /api/fan-leads              — capture fan email (public)
 * GET    /api/fan-leads/:artistId    — list fans (owner only)
 * POST   /api/fan-leads/unsubscribe  — unsubscribe by email+artistId
 * GET    /api/fan-leads/count/:artistId — public fan count
 */
import { Router, Request, Response } from 'express';
import { db } from '../../db';
import { artistFanLeads, users } from '../../db/schema';
import { eq, and, count } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import {
  sendFanWelcomeEmail,
  sendArtistNewFanNotification,
} from '../services/brevo-email-service';

const router = Router();

const DEFAULT_FAN_PRIMARY = '#f97316';
const DEFAULT_FAN_ACCENT = '#f59e0b';

function normalizePaletteColor(value: unknown, fallback: string) {
  return typeof value === 'string' && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

// POST /api/fan-leads — capture a fan lead
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email, name, artistId, artistSlug, source, primaryColor, accentColor } = req.body;

    if (!email || !artistId) {
      return res.status(400).json({ message: 'email and artistId are required' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: 'Invalid email address' });
    }

    const pgArtistId = parseInt(String(artistId), 10);
    if (isNaN(pgArtistId)) {
      return res.status(400).json({ message: 'Invalid artistId' });
    }

    // Fetch artist info for emails
    const [artist] = await db
      .select({ email: users.email, artistName: users.artistName, slug: users.slug, profileImage: users.profileImage })
      .from(users)
      .where(eq(users.id, pgArtistId))
      .limit(1);

    if (!artist) {
      return res.status(404).json({ message: 'Artist not found' });
    }

    const resolvedSlug = artistSlug || artist.slug || String(pgArtistId);
    const artistName = artist.artistName || 'this artist';
    const emailPalette = {
      primaryColor: normalizePaletteColor(primaryColor, DEFAULT_FAN_PRIMARY),
      accentColor: normalizePaletteColor(accentColor, DEFAULT_FAN_ACCENT),
    };

    // Upsert — if already subscribed, return success silently
    const now = new Date();
    const day3 = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

    try {
      await db.insert(artistFanLeads).values({
        artistId: pgArtistId,
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        artistSlug: resolvedSlug,
        source: source || 'artist_page',
        sequenceStep: 0,
        nextEmailAt: day3,
        ipAddress: req.ip || null,
      });
    } catch (insertErr: any) {
      // Unique constraint violation = already subscribed
      if (insertErr?.code === '23505') {
        return res.json({ success: true, alreadySubscribed: true });
      }
      throw insertErr;
    }

    // Fire welcome email + artist notification (non-blocking)
    sendFanWelcomeEmail(email, name || '', artistName, resolvedSlug, artist.profileImage || undefined, emailPalette).catch((e) =>
      console.warn('[FanLeads] Welcome email failed:', e?.message)
    );

    if (artist.email) {
      sendArtistNewFanNotification(artist.email, artistName, name || null, email, artist.profileImage || undefined, emailPalette).catch((e) =>
        console.warn('[FanLeads] Artist notification failed:', e?.message)
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[FanLeads] POST / error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/fan-leads/count/:artistId — public count
router.get('/count/:artistId', async (req: Request, res: Response) => {
  try {
    const pgArtistId = parseInt(req.params.artistId, 10);
    if (isNaN(pgArtistId)) return res.status(400).json({ message: 'Invalid artistId' });

    const [row] = await db
      .select({ total: count() })
      .from(artistFanLeads)
      .where(and(eq(artistFanLeads.artistId, pgArtistId), eq(artistFanLeads.isUnsubscribed, false)));

    return res.json({ count: Number(row?.total ?? 0) });
  } catch (err: any) {
    console.error('[FanLeads] GET /count error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// GET /api/fan-leads/:artistId — list fans (owner only)
router.get('/:artistId', authenticate, async (req: any, res: Response) => {
  try {
    const pgArtistId = parseInt(req.params.artistId, 10);
    if (isNaN(pgArtistId)) return res.status(400).json({ message: 'Invalid artistId' });

    // Only owner can see their fans
    if (req.user?.id !== pgArtistId) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    const fans = await db
      .select()
      .from(artistFanLeads)
      .where(eq(artistFanLeads.artistId, pgArtistId))
      .orderBy(artistFanLeads.subscribedAt);

    return res.json({ fans });
  } catch (err: any) {
    console.error('[FanLeads] GET /:artistId error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// POST /api/fan-leads/unsubscribe
router.post('/unsubscribe', async (req: Request, res: Response) => {
  try {
    const { email, artistSlug } = req.body;
    if (!email || !artistSlug) {
      return res.status(400).json({ message: 'email and artistSlug are required' });
    }

    await db
      .update(artistFanLeads)
      .set({ isUnsubscribed: true, unsubscribedAt: new Date() })
      .where(
        and(
          eq(artistFanLeads.email, email.toLowerCase().trim()),
          eq(artistFanLeads.artistSlug, artistSlug)
        )
      );

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[FanLeads] POST /unsubscribe error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

export default router;
