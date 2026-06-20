/**
 * Live Ticketing & Seat Map Engine — API (Phase 1)
 * ================================================
 * Mounted at /api/seat-map. Adds reserved seating on top of the existing
 * Postgres concert ticketing system. A VENUE is a reusable visual map (sections
 * + seats); the live sellable status of every seat lives PER EVENT in
 * concert_event_seats (available | held | sold | blocked).
 *
 * Anti double-sell is enforced atomically: holds are a transactional conditional
 * UPDATE (`... WHERE status='available'`) guarded by a unique (concertId, seatId)
 * index, so two buyers can never grab the same seat.
 *
 * Owner (Clerk auth + ownership):
 *   POST   /:artistId/venues                          — create a venue
 *   GET    /:artistId/venues                          — list venues (+ counts)
 *   GET    /:artistId/venues/:venueId                 — full layout
 *   PUT    /:artistId/venues/:venueId                 — save layout (sections + seats)
 *   DELETE /:artistId/venues/:venueId                 — archive a venue
 *   POST   /:artistId/events/:eventId/attach-venue    — turn an event into reserved seating
 *   POST   /:artistId/events/:eventId/detach-venue    — back to general admission
 *
 * Public (buyer, no login):
 *   GET    /events/:eventId/seatmap                   — layout + live seat status
 *   POST   /events/:eventId/hold                      — hold seats for 10 min
 *   POST   /events/:eventId/release                   — release a hold
 */
import { Router, Request, Response } from 'express';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import { db } from '../db';
import {
  concertEvents, concertOrders, concertTicketPasses,
  concertVenues, concertVenueSections, concertSeats, concertEventSeats, users,
} from '../db/schema';
import { isAuthenticated, getUserId, isAdmin } from '../middleware/clerk-auth';
import { signPass, generatePassCode } from '../services/concert-tickets';

const router = Router();

const HOLD_MINUTES = 10;
const CHECKOUT_HOLD_MINUTES = 30; // extended while the buyer is in Stripe checkout

// ── helpers ──────────────────────────────────────────────────────────────────
function parseId(v: unknown): number | null {
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}
function clampStr(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null;
}
function money(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
}

/** Resolve the logged-in user's numeric Postgres id (or null). */
async function resolveOwnerId(req: Request): Promise<number | null> {
  const pre = (req as any).user?.id;
  if (typeof pre === 'number') return pre;
  const clerkId = getUserId(req);
  if (!clerkId) return null;
  try {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    return u?.id ?? null;
  } catch {
    return null;
  }
}

/** True if the logged-in user owns this artist profile (or is an admin). */
async function ownsArtist(req: Request, artistId: number): Promise<boolean> {
  if (isAdmin(req)) return true;
  const ownerId = await resolveOwnerId(req);
  if (ownerId == null) return false;
  if (ownerId === artistId) return true;
  try {
    const [profile] = await db
      .select({ generatedBy: users.generatedBy })
      .from(users)
      .where(eq(users.id, artistId))
      .limit(1);
    return profile?.generatedBy != null && profile.generatedBy === ownerId;
  } catch {
    return false;
  }
}

/** Release any holds on this event whose 10-minute timer has expired. */
async function releaseExpiredHolds(concertId: number): Promise<void> {
  try {
    await db
      .update(concertEventSeats)
      .set({ status: 'available', holdToken: null, heldByEmail: null, holdExpiresAt: null, updatedAt: new Date() })
      .where(and(
        eq(concertEventSeats.concertId, concertId),
        eq(concertEventSeats.status, 'held'),
        sql`${concertEventSeats.holdExpiresAt} < NOW()`,
      ));
  } catch (e: any) {
    console.warn('[seat-map] releaseExpiredHolds failed:', e?.message);
  }
}

/** The effective price of a seat for an event = override || section default. */
function effectiveSeatPrice(seat: { priceOverride: string | null }, section: { defaultPrice: string }): number {
  if (seat.priceOverride != null && seat.priceOverride !== '') return money(seat.priceOverride);
  return money(section.defaultPrice);
}

// ═════════════════════════════════════════════════════════════════════════════
// OWNER — venue CRUD
// ═════════════════════════════════════════════════════════════════════════════

// Create a venue (shell — the editor then saves sections + seats via PUT).
router.post('/:artistId/venues', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  const name = clampStr(req.body?.name, 160);
  if (!name) return res.status(400).json({ success: false, error: 'Venue name is required' });

  try {
    const [venue] = await db
      .insert(concertVenues)
      .values({
        artistId,
        name,
        address: clampStr(req.body?.address, 240),
        city: clampStr(req.body?.city, 120),
        country: clampStr(req.body?.country, 80),
        description: clampStr(req.body?.description, 1000),
        canvasWidth: Math.max(400, Math.min(3000, parseId(req.body?.canvasWidth) || 1000)),
        canvasHeight: Math.max(300, Math.min(3000, parseId(req.body?.canvasHeight) || 700)),
        stageLabel: clampStr(req.body?.stageLabel, 40) || 'STAGE',
      })
      .returning();
    res.json({ success: true, venue });
  } catch (err: any) {
    console.error('[seat-map] create venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to create venue' });
  }
});

// List an artist's venues with section/seat counts.
router.get('/:artistId/venues', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const venues = await db
      .select()
      .from(concertVenues)
      .where(and(eq(concertVenues.artistId, artistId), eq(concertVenues.status, 'active')))
      .orderBy(sql`${concertVenues.updatedAt} DESC`);

    const ids = venues.map((v) => v.id);
    const counts: Record<number, { sections: number; seats: number; capacity: number }> = {};
    if (ids.length) {
      const seatCounts = await db
        .select({
          venueId: concertSeats.venueId,
          seats: sql<number>`COUNT(*)::int`,
          capacity: sql<number>`COALESCE(SUM(${concertSeats.capacity}),0)::int`,
        })
        .from(concertSeats)
        .where(inArray(concertSeats.venueId, ids))
        .groupBy(concertSeats.venueId);
      const secCounts = await db
        .select({ venueId: concertVenueSections.venueId, sections: sql<number>`COUNT(*)::int` })
        .from(concertVenueSections)
        .where(inArray(concertVenueSections.venueId, ids))
        .groupBy(concertVenueSections.venueId);
      for (const r of seatCounts) counts[r.venueId] = { sections: 0, seats: Number(r.seats), capacity: Number(r.capacity) };
      for (const r of secCounts) counts[r.venueId] = { ...(counts[r.venueId] || { seats: 0, capacity: 0 }), sections: Number(r.sections) };
    }
    res.json({ success: true, venues: venues.map((v) => ({ ...v, ...(counts[v.id] || { sections: 0, seats: 0, capacity: 0 }) })) });
  } catch (err: any) {
    console.error('[seat-map] list venues failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load venues' });
  }
});

// Full layout of a venue (sections + seats).
router.get('/:artistId/venues/:venueId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  const venueId = parseId(req.params.venueId);
  if (!artistId || !venueId) return res.status(400).json({ success: false, error: 'Invalid id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const [venue] = await db.select().from(concertVenues).where(eq(concertVenues.id, venueId)).limit(1);
    if (!venue || venue.artistId !== artistId) return res.status(404).json({ success: false, error: 'Venue not found' });
    const sections = await db.select().from(concertVenueSections).where(eq(concertVenueSections.venueId, venueId)).orderBy(concertVenueSections.sortOrder);
    const seats = await db.select().from(concertSeats).where(eq(concertSeats.venueId, venueId)).orderBy(concertSeats.id);
    res.json({ success: true, venue, sections, seats });
  } catch (err: any) {
    console.error('[seat-map] get venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load venue' });
  }
});

/**
 * Save a venue layout. The editor sends the FULL set of sections + seats; we
 * replace the venue's layout atomically. Seats reference sections by a client
 * `tempId` (string) so brand-new sections get real ids on save.
 *
 * Body: {
 *   venue?: { name, address, city, country, description, canvasWidth, canvasHeight, stageLabel },
 *   sections: [{ tempId, name, kind, color, defaultPrice, gaCapacity, tableSeats, x, y, sortOrder }],
 *   seats:    [{ sectionTempId, kind, rowLabel, seatNumber, label, capacity, x, y, priceOverride, isBlocked }]
 * }
 */
router.put('/:artistId/venues/:venueId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  const venueId = parseId(req.params.venueId);
  if (!artistId || !venueId) return res.status(400).json({ success: false, error: 'Invalid id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  const inSections: any[] = Array.isArray(req.body?.sections) ? req.body.sections : [];
  const inSeats: any[] = Array.isArray(req.body?.seats) ? req.body.seats : [];
  if (inSections.length > 200) return res.status(400).json({ success: false, error: 'Too many sections (max 200)' });
  if (inSeats.length > 5000) return res.status(400).json({ success: false, error: 'Too many seats (max 5000)' });

  try {
    const [venue] = await db.select().from(concertVenues).where(eq(concertVenues.id, venueId)).limit(1);
    if (!venue || venue.artistId !== artistId) return res.status(404).json({ success: false, error: 'Venue not found' });

    // Guard: don't let the map be rebuilt while a reserved event is live on it
    // (would orphan sold seats). Editing requires no reserved events attached.
    const attached = await db
      .select({ id: concertEvents.id })
      .from(concertEvents)
      .where(and(eq(concertEvents.venueId, venueId), eq(concertEvents.seatingMode, 'reserved')))
      .limit(1);
    if (attached.length) {
      return res.status(409).json({ success: false, error: 'This venue is in use by a reserved-seating event. Detach it before editing the map.' });
    }

    const venuePatch = req.body?.venue || {};
    let totalCapacity = 0;

    await db.transaction(async (tx) => {
      // Update venue meta
      await tx.update(concertVenues).set({
        name: clampStr(venuePatch.name, 160) || venue.name,
        address: clampStr(venuePatch.address, 240),
        city: clampStr(venuePatch.city, 120),
        country: clampStr(venuePatch.country, 80),
        description: clampStr(venuePatch.description, 1000),
        canvasWidth: Math.max(400, Math.min(3000, parseId(venuePatch.canvasWidth) || venue.canvasWidth)),
        canvasHeight: Math.max(300, Math.min(3000, parseId(venuePatch.canvasHeight) || venue.canvasHeight)),
        stageLabel: clampStr(venuePatch.stageLabel, 40) || venue.stageLabel || 'STAGE',
        updatedAt: new Date(),
      }).where(eq(concertVenues.id, venueId));

      // Wipe + rebuild the layout (seats cascade from sections; also clear directly)
      await tx.delete(concertSeats).where(eq(concertSeats.venueId, venueId));
      await tx.delete(concertVenueSections).where(eq(concertVenueSections.venueId, venueId));

      // Insert sections, mapping each client tempId → new real id.
      const idByTemp = new Map<string, number>();
      for (let i = 0; i < inSections.length; i++) {
        const s = inSections[i];
        const kind = ['seats', 'tables', 'ga'].includes(s?.kind) ? s.kind : 'seats';
        const [row] = await tx.insert(concertVenueSections).values({
          venueId,
          name: clampStr(s?.name, 80) || `Section ${i + 1}`,
          kind,
          color: clampStr(s?.color, 16) || '#7c3aed',
          defaultPrice: money(s?.defaultPrice).toFixed(2),
          gaCapacity: Math.max(0, Math.min(100000, parseId(s?.gaCapacity) || 0)),
          tableSeats: Math.max(1, Math.min(50, parseId(s?.tableSeats) || 4)),
          x: parseId(s?.x) || 0,
          y: parseId(s?.y) || 0,
          sortOrder: i,
        }).returning({ id: concertVenueSections.id });
        const temp = String(s?.tempId ?? s?.id ?? `s${i}`);
        idByTemp.set(temp, row.id);
        if (kind === 'ga') totalCapacity += Math.max(0, parseId(s?.gaCapacity) || 0);
      }

      // Insert seats, resolving their section by tempId.
      const seatValues: typeof concertSeats.$inferInsert[] = [];
      for (const st of inSeats) {
        const temp = String(st?.sectionTempId ?? st?.sectionId ?? '');
        const sectionId = idByTemp.get(temp);
        if (!sectionId) continue; // skip seats whose section didn't resolve
        const kind = st?.kind === 'table' ? 'table' : 'seat';
        const capacity = kind === 'table' ? Math.max(1, Math.min(50, parseId(st?.capacity) || 1)) : 1;
        totalCapacity += capacity;
        seatValues.push({
          venueId,
          sectionId,
          kind,
          rowLabel: clampStr(st?.rowLabel, 16),
          seatNumber: clampStr(st?.seatNumber, 16),
          label: clampStr(st?.label, 40) || 'Seat',
          capacity,
          x: parseId(st?.x) || 0,
          y: parseId(st?.y) || 0,
          priceOverride: (st?.priceOverride === null || st?.priceOverride === undefined || st?.priceOverride === '')
            ? null : money(st.priceOverride).toFixed(2),
          isBlocked: st?.isBlocked === true,
        });
      }
      // Batch insert seats (chunked to stay under bind-parameter limits).
      for (let i = 0; i < seatValues.length; i += 500) {
        await tx.insert(concertSeats).values(seatValues.slice(i, i + 500));
      }

      await tx.update(concertVenues).set({ capacity: totalCapacity }).where(eq(concertVenues.id, venueId));
    });

    const sections = await db.select().from(concertVenueSections).where(eq(concertVenueSections.venueId, venueId)).orderBy(concertVenueSections.sortOrder);
    const seats = await db.select().from(concertSeats).where(eq(concertSeats.venueId, venueId)).orderBy(concertSeats.id);
    const [venueRow] = await db.select().from(concertVenues).where(eq(concertVenues.id, venueId)).limit(1);
    res.json({ success: true, venue: venueRow, sections, seats });
  } catch (err: any) {
    console.error('[seat-map] save venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to save venue layout' });
  }
});

// Archive a venue (soft delete; keeps history for past events).
router.delete('/:artistId/venues/:venueId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  const venueId = parseId(req.params.venueId);
  if (!artistId || !venueId) return res.status(400).json({ success: false, error: 'Invalid id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const [venue] = await db.select().from(concertVenues).where(eq(concertVenues.id, venueId)).limit(1);
    if (!venue || venue.artistId !== artistId) return res.status(404).json({ success: false, error: 'Venue not found' });
    await db.update(concertVenues).set({ status: 'archived', updatedAt: new Date() }).where(eq(concertVenues.id, venueId));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[seat-map] delete venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to archive venue' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// OWNER — attach / detach a venue to an event (turns it into reserved seating)
// ═════════════════════════════════════════════════════════════════════════════
router.post('/:artistId/events/:eventId/attach-venue', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  const eventId = parseId(req.params.eventId);
  const venueId = parseId(req.body?.venueId);
  if (!artistId || !eventId || !venueId) return res.status(400).json({ success: false, error: 'Invalid id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });
    const [venue] = await db.select().from(concertVenues).where(eq(concertVenues.id, venueId)).limit(1);
    if (!venue || venue.artistId !== artistId) return res.status(404).json({ success: false, error: 'Venue not found' });

    const sections = await db.select().from(concertVenueSections).where(eq(concertVenueSections.venueId, venueId));
    const seats = await db.select().from(concertSeats).where(eq(concertSeats.venueId, venueId));
    if (!seats.length) return res.status(400).json({ success: false, error: 'This venue has no seats yet. Build the seat map first.' });
    const sectionById = new Map(sections.map((s) => [s.id, s]));

    // Optional per-section price overrides for THIS event.
    const priceBySection: Record<string, number> = (req.body?.priceBySection && typeof req.body.priceBySection === 'object') ? req.body.priceBySection : {};

    await db.transaction(async (tx) => {
      await tx.update(concertEvents).set({ venueId, seatingMode: 'reserved', updatedAt: new Date() }).where(eq(concertEvents.id, eventId));
      // Initialize a status row per seat (idempotent via unique index — skip dupes).
      const rows: typeof concertEventSeats.$inferInsert[] = [];
      for (const seat of seats) {
        const section = sectionById.get(seat.sectionId);
        if (!section) continue;
        const evOverride = priceBySection[String(seat.sectionId)];
        const price = (typeof evOverride === 'number' && evOverride >= 0)
          ? money(evOverride)
          : effectiveSeatPrice(seat, section);
        rows.push({
          concertId: eventId,
          seatId: seat.id,
          sectionId: seat.sectionId,
          status: seat.isBlocked ? 'blocked' : 'available',
          price: price.toFixed(2),
        });
      }
      for (let i = 0; i < rows.length; i += 500) {
        await tx.insert(concertEventSeats).values(rows.slice(i, i + 500)).onConflictDoNothing();
      }
    });

    const total = await db.select({ n: sql<number>`COUNT(*)::int` }).from(concertEventSeats).where(eq(concertEventSeats.concertId, eventId));
    res.json({ success: true, seatsInitialized: Number(total[0]?.n || 0) });
  } catch (err: any) {
    console.error('[seat-map] attach venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to attach venue' });
  }
});

router.post('/:artistId/events/:eventId/detach-venue', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = parseId(req.params.artistId);
  const eventId = parseId(req.params.eventId);
  if (!artistId || !eventId) return res.status(400).json({ success: false, error: 'Invalid id' });
  if (!(await ownsArtist(req, artistId))) return res.status(403).json({ success: false, error: 'Forbidden' });

  try {
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });
    // Refuse if seats were already sold (would erase real tickets).
    const sold = await db.select({ n: sql<number>`COUNT(*)::int` }).from(concertEventSeats)
      .where(and(eq(concertEventSeats.concertId, eventId), eq(concertEventSeats.status, 'sold')));
    if (Number(sold[0]?.n || 0) > 0) {
      return res.status(409).json({ success: false, error: 'Seats have already been sold for this event — cannot switch to general admission.' });
    }
    await db.transaction(async (tx) => {
      await tx.delete(concertEventSeats).where(eq(concertEventSeats.concertId, eventId));
      await tx.update(concertEvents).set({ venueId: null, seatingMode: 'general', updatedAt: new Date() }).where(eq(concertEvents.id, eventId));
    });
    res.json({ success: true });
  } catch (err: any) {
    console.error('[seat-map] detach venue failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to detach venue' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC — buyer seat map + holds
// ═════════════════════════════════════════════════════════════════════════════

// The live seat map for an on-sale event (no login). Releases expired holds first.
router.get('/events/:eventId/seatmap', async (req: Request, res: Response) => {
  const eventId = parseId(req.params.eventId);
  if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });

  try {
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev) return res.status(404).json({ success: false, error: 'Event not found' });
    if (ev.seatingMode !== 'reserved' || !ev.venueId) {
      return res.json({ success: true, reserved: false });
    }
    await releaseExpiredHolds(eventId);

    const [venue] = await db.select().from(concertVenues).where(eq(concertVenues.id, ev.venueId)).limit(1);
    const sections = await db.select().from(concertVenueSections).where(eq(concertVenueSections.venueId, ev.venueId)).orderBy(concertVenueSections.sortOrder);
    const seats = await db.select().from(concertSeats).where(eq(concertSeats.venueId, ev.venueId)).orderBy(concertSeats.id);
    const statuses = await db.select().from(concertEventSeats).where(eq(concertEventSeats.concertId, eventId));
    const statusBySeat = new Map(statuses.map((s) => [s.seatId, s]));

    // Public seat payload — never leak who holds/bought a seat, only its state.
    const seatPayload = seats.map((seat) => {
      const st = statusBySeat.get(seat.id);
      return {
        id: seat.id,
        sectionId: seat.sectionId,
        kind: seat.kind,
        label: seat.label,
        rowLabel: seat.rowLabel,
        seatNumber: seat.seatNumber,
        capacity: seat.capacity,
        x: seat.x,
        y: seat.y,
        status: st ? st.status : (seat.isBlocked ? 'blocked' : 'available'),
        price: st ? money(st.price) : 0,
      };
    });

    res.json({
      success: true,
      reserved: true,
      event: { id: ev.id, title: ev.title, currency: ev.currency, startsAt: ev.startsAt, venue: ev.venue, location: ev.location },
      venue: venue ? { id: venue.id, name: venue.name, canvasWidth: venue.canvasWidth, canvasHeight: venue.canvasHeight, stageLabel: venue.stageLabel } : null,
      sections: sections.map((s) => ({ id: s.id, name: s.name, kind: s.kind, color: s.color, defaultPrice: money(s.defaultPrice), x: s.x, y: s.y })),
      seats: seatPayload,
      holdMinutes: HOLD_MINUTES,
    });
  } catch (err: any) {
    console.error('[seat-map] public seatmap failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load seat map' });
  }
});

// Hold seats for 10 minutes (transactional, anti double-sell).
router.post('/events/:eventId/hold', async (req: Request, res: Response) => {
  const eventId = parseId(req.params.eventId);
  if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
  const email = clampStr(req.body?.email, 160);
  const seatIds: number[] = Array.isArray(req.body?.seatIds)
    ? Array.from(new Set(req.body.seatIds.map((s: unknown) => parseId(s)).filter((n: number | null): n is number => n != null)))
    : [];
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ success: false, error: 'A valid email is required' });
  if (!seatIds.length) return res.status(400).json({ success: false, error: 'Select at least one seat' });
  if (seatIds.length > 20) return res.status(400).json({ success: false, error: 'Up to 20 seats per order' });

  try {
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.seatingMode !== 'reserved') return res.status(404).json({ success: false, error: 'Reserved seating not available for this event' });
    if (!['published', 'live'].includes(ev.status)) return res.status(400).json({ success: false, error: 'This event is not on sale' });

    await releaseExpiredHolds(eventId);

    const token = randomBytes(16).toString('hex');
    const expiresAt = new Date(Date.now() + HOLD_MINUTES * 60_000);

    // Atomic conditional hold: only flip rows that are currently AVAILABLE. If
    // any requested seat was grabbed by someone else, the row count won't match
    // and we roll back so the buyer holds nothing (no partial holds).
    let held: { id: number; seatId: number; price: string }[] = [];
    await db.transaction(async (tx) => {
      const updated = await tx
        .update(concertEventSeats)
        .set({ status: 'held', holdToken: token, heldByEmail: email, holdExpiresAt: expiresAt, updatedAt: new Date() })
        .where(and(
          eq(concertEventSeats.concertId, eventId),
          inArray(concertEventSeats.seatId, seatIds),
          eq(concertEventSeats.status, 'available'),
        ))
        .returning({ id: concertEventSeats.id, seatId: concertEventSeats.seatId, price: concertEventSeats.price });
      if (updated.length !== seatIds.length) {
        throw new Error('SEATS_UNAVAILABLE');
      }
      held = updated;
    });

    // Decorate with seat labels for the cart UI.
    const seatRows = await db.select().from(concertSeats).where(inArray(concertSeats.id, held.map((h) => h.seatId)));
    const labelById = new Map(seatRows.map((s) => [s.id, s.label]));
    const seatsOut = held.map((h) => ({ seatId: h.seatId, label: labelById.get(h.seatId) || `Seat ${h.seatId}`, price: money(h.price) }));
    const total = seatsOut.reduce((s, x) => s + x.price, 0);

    res.json({ success: true, holdToken: token, expiresAt: expiresAt.toISOString(), seats: seatsOut, total: Math.round(total * 100) / 100, currency: ev.currency || 'usd' });
  } catch (err: any) {
    if (err?.message === 'SEATS_UNAVAILABLE') {
      return res.status(409).json({ success: false, error: 'Sorry, one or more of those seats was just taken. Please pick again.' });
    }
    console.error('[seat-map] hold failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to hold seats' });
  }
});

// Release a hold (buyer cancelled / changed selection).
router.post('/events/:eventId/release', async (req: Request, res: Response) => {
  const eventId = parseId(req.params.eventId);
  const holdToken = clampStr(req.body?.holdToken, 64);
  if (!eventId || !holdToken) return res.status(400).json({ success: false, error: 'Missing hold token' });
  try {
    await db
      .update(concertEventSeats)
      .set({ status: 'available', holdToken: null, heldByEmail: null, holdExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(concertEventSeats.concertId, eventId), eq(concertEventSeats.holdToken, holdToken), eq(concertEventSeats.status, 'held')));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[seat-map] release failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to release seats' });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// Helpers used by the concerts checkout + fulfilment (exported)
// ═════════════════════════════════════════════════════════════════════════════

export interface ReservedSeatLine {
  seatId: number;
  label: string;
  sectionId: number;
  sectionName: string;
  price: number;
}

/**
 * Validate that `seatIds` are currently held by `holdToken`+`email` for this
 * event, extend the hold to cover the Stripe checkout window, tag them with the
 * pending order, and return their priced lines. Returns null if the hold is
 * invalid/expired or the seats don't all match.
 */
export async function reserveSeatsForCheckout(
  concertId: number,
  seatIds: number[],
  holdToken: string,
  email: string,
): Promise<{ lines: ReservedSeatLine[]; total: number } | null> {
  if (!concertId || !holdToken || !Array.isArray(seatIds) || !seatIds.length) return null;
  await releaseExpiredHolds(concertId);

  const rows = await db
    .select({
      seatId: concertEventSeats.seatId,
      price: concertEventSeats.price,
      status: concertEventSeats.status,
      holdToken: concertEventSeats.holdToken,
      sectionId: concertSeats.sectionId,
      label: concertSeats.label,
      sectionName: concertVenueSections.name,
    })
    .from(concertEventSeats)
    .innerJoin(concertSeats, eq(concertSeats.id, concertEventSeats.seatId))
    .leftJoin(concertVenueSections, eq(concertVenueSections.id, concertSeats.sectionId))
    .where(and(eq(concertEventSeats.concertId, concertId), inArray(concertEventSeats.seatId, seatIds)));

  // Every requested seat must be present, held, and held by THIS token.
  if (rows.length !== seatIds.length) return null;
  for (const r of rows) {
    if (r.status !== 'held' || r.holdToken !== holdToken) return null;
  }

  const expiresAt = new Date(Date.now() + CHECKOUT_HOLD_MINUTES * 60_000);
  await db
    .update(concertEventSeats)
    .set({ holdExpiresAt: expiresAt, heldByEmail: email, updatedAt: new Date() })
    .where(and(eq(concertEventSeats.concertId, concertId), eq(concertEventSeats.holdToken, holdToken)));

  const lines: ReservedSeatLine[] = rows.map((r) => ({
    seatId: r.seatId,
    label: r.label,
    sectionId: r.sectionId,
    sectionName: r.sectionName || 'Seat',
    price: money(r.price),
  }));
  const total = Math.round(lines.reduce((s, l) => s + l.price, 0) * 100) / 100;
  return { lines, total };
}

/**
 * Mint one signed pass PER reserved seat for a completed order, mark each event
 * seat as SOLD (linked to the order + pass), and label the pass with its seat.
 * Idempotent — does nothing if passes already exist for the order. Used by
 * concerts.ts fulfilConcertOrder when the order has seatIds.
 */
export async function mintReservedSeatPasses(order: {
  id: number;
  concertId: number;
  artistId: number;
  buyerEmail: string | null;
  buyerName: string | null;
  seatIds: unknown;
}): Promise<number> {
  const seatIds: number[] = Array.isArray(order.seatIds)
    ? (order.seatIds as unknown[]).map((s) => parseId(s)).filter((n): n is number => n != null)
    : [];
  if (!seatIds.length) return 0;

  // Idempotency: skip if this order already has passes.
  const existing = await db.select({ id: concertTicketPasses.id }).from(concertTicketPasses).where(eq(concertTicketPasses.orderId, order.id)).limit(1);
  if (existing.length) return 0;

  const rows = await db
    .select({
      seatId: concertSeats.id,
      label: concertSeats.label,
      sectionName: concertVenueSections.name,
    })
    .from(concertSeats)
    .leftJoin(concertVenueSections, eq(concertVenueSections.id, concertSeats.sectionId))
    .where(inArray(concertSeats.id, seatIds));

  let minted = 0;
  for (const seat of rows) {
    const passCode = generatePassCode();
    const signature = signPass({ passCode, orderId: order.id, concertId: order.concertId, tierId: null });
    const [pass] = await db.insert(concertTicketPasses).values({
      orderId: order.id,
      concertId: order.concertId,
      artistId: order.artistId,
      tierId: null,
      tierName: seat.sectionName || 'Reserved seat',
      buyerEmail: order.buyerEmail,
      buyerName: order.buyerName,
      passCode,
      signature,
      status: 'valid',
      seat: seat.label,
      seatId: seat.seatId,
    }).returning({ id: concertTicketPasses.id });

    await db
      .update(concertEventSeats)
      .set({ status: 'sold', orderId: order.id, passId: pass.id, holdToken: null, heldByEmail: null, holdExpiresAt: null, updatedAt: new Date() })
      .where(and(eq(concertEventSeats.concertId, order.concertId), eq(concertEventSeats.seatId, seat.seatId)));
    minted++;
  }
  return minted;
}

export default router;
