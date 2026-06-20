/**
 * Concert Command Center — public + owner API
 * ===========================================
 * Mounted at /api/concerts.
 *
 * Unifies concert organization, ticketing (Stripe), buyer messaging and
 * cross-module links (merch / streaming / fan club). Boostify charges an
 * admin-configurable 10–30% commission, resolved per-artist at checkout.
 *
 * Public (no login, buyer side):
 *   GET  /event/:eventId            — single published event + tiers
 *   GET  /order/status?session_id=  — order status after Stripe redirect
 *   GET  /:artistId/events          — published events for an artist
 *   POST /:artistId/checkout        — buy tickets (prices recomputed server-side)
 *   POST /:artistId/messages        — buyer sends a message
 *   GET  /:artistId/thread?email=   — buyer fetches their thread
 *
 * Owner (Clerk auth + ownership, artistId === logged-in user id, or admin):
 *   GET    /:artistId/manage                       — owner dashboard bootstrap
 *   POST   /:artistId/events                       — create event
 *   PATCH  /:artistId/events/:eventId              — update event
 *   DELETE /:artistId/events/:eventId              — delete event
 *   POST   /:artistId/events/:eventId/tiers        — add ticket tier
 *   PATCH  /:artistId/tiers/:tierId                — update tier
 *   DELETE /:artistId/tiers/:tierId                — delete tier
 *   GET    /:artistId/orders                       — orders for owner's events
 *   GET    /:artistId/threads                      — buyer threads
 *   POST   /:artistId/threads/:threadId/reply      — artist replies
 */
import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import {
  concertEvents, concertTicketTiers, concertOrders, concertThreads, concertMessages, concertTicketPasses,
  concertDiscountCodes, concertWaitlist, concertScanLogs, concertTicketTransfers, users,
} from '../db/schema';
import { isAuthenticated, getUserId, isAdmin } from '../middleware/clerk-auth';
import { resolveCommissionRate, splitAmount } from '../services/concert-commission';
import {
  signPass, verifyPassSignature, generatePassCode, buildPassToken, parsePassToken,
} from '../services/concert-tickets';
import { reserveSeatsForCheckout, mintReservedSeatPasses } from './seat-map';
import { sendNotificationEmail } from '../services/brevo-email-service';
const router = Router();

const stripeKey = process.env.TESTING_STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: '2025-01-27.acacia' as any }) : null;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getBaseUrl(req: Request): string {
  const canonical = (process.env.PRODUCTION_URL || process.env.APP_URL || '').replace(/\/$/, '');
  // In production always use the canonical public domain so post-checkout links
  // never point at an internal host.
  if (canonical && process.env.NODE_ENV === 'production') return canonical;
  // Otherwise follow the frontend origin the request actually came from. In dev
  // the SPA runs on a different port than the API (Vite proxies /api to the
  // backend), so req.headers.host = the API port — using it would send the
  // Stripe success_url to the backend, which has no SPA fallback and returns
  // "Cannot GET /artist/:slug". The Origin/Referer header is the real frontend.
  const origin = req.headers.origin;
  if (typeof origin === 'string' && /^https?:\/\//.test(origin)) return origin.replace(/\/$/, '');
  const referer = req.headers.referer;
  if (typeof referer === 'string') {
    try { const u = new URL(referer); return `${u.protocol}//${u.host}`; } catch { /* ignore */ }
  }
  if (canonical) return canonical;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0];
  const proto = forwardedProto || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:5001';
  return `${proto}://${host}`;
}

function parseId(value: unknown): number | null {
  const n = parseInt(String(value), 10);
  return Number.isNaN(n) ? null : n;
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  return EMAIL_REGEX.test(trimmed) ? trimmed : null;
}

function ticketCode(orderId: number): string {
  return `CC-${orderId}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Look up + validate a discount code for an artist/event. Returns the code row
 * when it is usable right now, or a reason string explaining why it is not.
 */
async function resolveDiscount(
  artistId: number,
  eventId: number,
  rawCode: unknown,
): Promise<{ row: any | null; reason?: string }> {
  const code = typeof rawCode === 'string' ? rawCode.trim() : '';
  if (!code) return { row: null };
  try {
    const rows = await db
      .select()
      .from(concertDiscountCodes)
      .where(and(
        eq(concertDiscountCodes.artistId, artistId),
        sql`LOWER(${concertDiscountCodes.code}) = ${code.toLowerCase()}`,
      ))
      .limit(1);
    const row = rows[0];
    if (!row) return { row: null, reason: 'Código no válido' };
    if (!row.isActive) return { row: null, reason: 'Código desactivado' };
    if (row.concertId != null && row.concertId !== eventId) {
      return { row: null, reason: 'Código no aplicable a este evento' };
    }
    const now = Date.now();
    if (row.startsAt && new Date(row.startsAt).getTime() > now) return { row: null, reason: 'El código aún no está activo' };
    if (row.endsAt && new Date(row.endsAt).getTime() < now) return { row: null, reason: 'El código ha expirado' };
    if (row.maxRedemptions != null && (row.timesRedeemed ?? 0) >= row.maxRedemptions) {
      return { row: null, reason: 'El código ya alcanzó su límite de usos' };
    }
    return { row };
  } catch {
    return { row: null, reason: 'No se pudo validar el código' };
  }
}

/** Apply a discount row to a subtotal, clamped to [0, subtotal]. */
function applyDiscount(subtotal: number, row: any | null): number {
  if (!row) return 0;
  const amount = Number(row.amount) || 0;
  if (amount <= 0) return 0;
  const off = row.kind === 'fixed' ? amount : subtotal * (amount / 100);
  return Math.min(subtotal, Math.max(0, Math.round(off * 100) / 100));
}

/** Best-effort buyer device class from the User-Agent header. */
function detectDevice(req: Request): string {
  const ua = String(req.headers['user-agent'] || '').toLowerCase();
  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|android|iphone/.test(ua)) return 'mobile';
  return 'desktop';
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
  // Real artists: the profile row IS the user row.
  if (ownerId === artistId) return true;
  // AI-generated artists live in the users table with generatedBy = creator's user id.
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

function serializeEvent(e: any, tiers: any[] = []) {
  return {
    id: e.id,
    artistId: e.artistId,
    title: e.title,
    description: e.description,
    type: e.type,
    status: e.status,
    startsAt: e.startsAt instanceof Date ? e.startsAt.toISOString() : e.startsAt,
    endsAt: e.endsAt instanceof Date ? e.endsAt.toISOString() : e.endsAt,
    timezone: e.timezone,
    venue: e.venue,
    location: e.location,
    capacity: e.capacity,
    posterUrl: e.posterUrl,
    currency: e.currency,
    streamingConfig: e.streamingConfig || null,
    linkedModules: e.linkedModules || null,
    artistSlug: e.artistSlug,
    refundPolicy: e.refundPolicy || null,
    refundPolicyType: e.refundPolicyType || 'flexible',
    seatingMode: e.seatingMode || 'general',
    venueId: e.venueId ?? null,
    tiers: tiers.map(serializeTier),
  };
}

function serializeTier(t: any) {
  const total = t.quantityTotal ?? null;
  const sold = t.quantitySold ?? 0;
  return {
    id: t.id,
    concertId: t.concertId,
    name: t.name,
    description: t.description,
    priceUsd: Number(t.priceUsd),
    quantityTotal: total,
    quantitySold: sold,
    remaining: total == null ? null : Math.max(0, total - sold),
    maxPerOrder: t.maxPerOrder ?? null,
    perks: t.perks || [],
    sortOrder: t.sortOrder,
    isActive: t.isActive,
  };
}

async function loadTiers(concertIds: number[]) {
  if (!concertIds.length) return [] as any[];
  return db.select().from(concertTicketTiers).where(inArray(concertTicketTiers.concertId, concertIds));
}

/** Public-safe view of a pass, including the signed QR token. */
function serializePass(p: any) {
  return {
    id: p.id,
    passCode: p.passCode,
    token: buildPassToken(p.passCode, p.signature),
    tierName: p.tierName,
    buyerName: p.buyerName,
    status: p.status,
    seat: p.seat,
    checkedInAt: p.checkedInAt,
  };
}

// ════════════════════════════════════════════════════════════════════════
// PUBLIC — buyer side
// ════════════════════════════════════════════════════════════════════════

// Single published event + tiers
router.get('/event/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev) return res.status(404).json({ success: false, error: 'Event not found' });
    // Only owners/admins can preview non-published events.
    if (ev.status === 'draft' && !(await ownsArtist(req, ev.artistId))) {
      return res.status(404).json({ success: false, error: 'Event not found' });
    }
    const tiers = await loadTiers([eventId]);
    res.json({ success: true, event: serializeEvent(ev, tiers) });
  } catch (err: any) {
    console.error('[concerts] GET /event failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load event' });
  }
});

/**
 * On-demand fulfilment fallback. In production a Stripe webhook calls
 * fulfilConcertOrder(). But webhooks can be delayed, mis-configured, or simply
 * unreachable in local/dev — which left the buyer's success page polling
 * forever and never sent the ticket email. When the buyer lands back on the
 * success page we proactively verify the session with Stripe and fulfil the
 * order here. fulfilConcertOrder is idempotent (returns early once completed),
 * so this can run alongside the webhook with no double-send / double-mint.
 */
async function ensureOrderFulfilled(sessionId: string): Promise<void> {
  if (!sessionId || !stripe) return;
  try {
    const [order] = await db.select().from(concertOrders).where(eq(concertOrders.stripePaymentId, sessionId)).limit(1);
    if (!order || order.status === 'completed') return;
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (paid) await fulfilConcertOrder(sessionId, true);
  } catch (e: any) {
    console.warn('[concerts] ensureOrderFulfilled failed:', e?.message);
  }
}

// Order status after Stripe redirect
router.get('/order/status', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ success: false, error: 'Missing session_id' });
    await ensureOrderFulfilled(sessionId);
    const [order] = await db.select().from(concertOrders).where(eq(concertOrders.stripePaymentId, sessionId)).limit(1);
    if (!order) return res.json({ success: true, order: null, status: 'unknown' });
    res.json({
      success: true,
      status: order.status,
      order: {
        id: order.id,
        status: order.status,
        quantity: order.quantity,
        subtotal: Number(order.subtotal),
        qrCode: order.qrCode,
        items: order.items,
      },
    });
  } catch (err: any) {
    console.error('[concerts] GET /order/status failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load order' });
  }
});

// Passes for a completed order (shown right after a successful purchase)
router.get('/order/passes', async (req: Request, res: Response) => {
  try {
    const sessionId = String(req.query.session_id || '');
    if (!sessionId) return res.status(400).json({ success: false, error: 'Missing session_id' });
    await ensureOrderFulfilled(sessionId);
    const [order] = await db.select().from(concertOrders).where(eq(concertOrders.stripePaymentId, sessionId)).limit(1);
    if (!order) return res.json({ success: true, passes: [], order: null });
    const passes = await db
      .select()
      .from(concertTicketPasses)
      .where(eq(concertTicketPasses.orderId, order.id))
      .orderBy(concertTicketPasses.id);
    const [ev] = await db
      .select({ title: concertEvents.title, startsAt: concertEvents.startsAt, venue: concertEvents.venue, location: concertEvents.location })
      .from(concertEvents)
      .where(eq(concertEvents.id, order.concertId))
      .limit(1);
    const addons = Array.isArray(order.items)
      ? (order.items as any[]).filter((i) => i?.kind === 'addon').map((i) => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice }))
      : [];
    res.json({
      success: true,
      order: { id: order.id, status: order.status },
      event: ev || null,
      addons,
      passes: passes.map(serializePass),
    });
  } catch (err: any) {
    console.error('[concerts] GET /order/passes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load passes' });
  }
});

// Look up a fan's passes by email (re-download tickets without an account)
router.get('/:artistId/my-tickets', async (req: Request, res: Response) => {
  try {
    const artistId = parseId(req.params.artistId);
    if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
    const email = normalizeEmail(req.query.email);
    if (!email) return res.status(400).json({ success: false, error: 'A valid email is required' });
    const passes = await db
      .select()
      .from(concertTicketPasses)
      .where(and(eq(concertTicketPasses.artistId, artistId), eq(concertTicketPasses.buyerEmail, email)))
      .orderBy(desc(concertTicketPasses.id))
      .limit(200);
    const eventIds = Array.from(new Set(passes.map((p) => p.concertId)));
    const events = eventIds.length
      ? await db
          .select({ id: concertEvents.id, title: concertEvents.title, startsAt: concertEvents.startsAt, venue: concertEvents.venue, location: concertEvents.location })
          .from(concertEvents)
          .where(inArray(concertEvents.id, eventIds))
      : [];
    const evMap = new Map(events.map((e) => [e.id, e]));
    res.json({
      success: true,
      passes: passes.map((p) => ({ ...serializePass(p), event: evMap.get(p.concertId) || null })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /my-tickets failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load tickets' });
  }
});

// Published events for an artist (public)
router.get('/:artistId/events', async (req: Request, res: Response) => {
  try {
    const artistId = parseId(req.params.artistId);
    if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
    const owner = await ownsArtist(req, artistId);
    const events = await db
      .select()
      .from(concertEvents)
      .where(
        owner
          ? eq(concertEvents.artistId, artistId)
          : and(eq(concertEvents.artistId, artistId), inArray(concertEvents.status, ['published', 'live', 'ended'])),
      )
      .orderBy(desc(concertEvents.startsAt));
    const tiers = await loadTiers(events.map((e) => e.id));
    const byEvent = new Map<number, any[]>();
    for (const t of tiers) {
      const arr = byEvent.get(t.concertId) || [];
      arr.push(t);
      byEvent.set(t.concertId, arr);
    }
    res.json({
      success: true,
      isOwner: owner,
      events: events.map((e) => serializeEvent(e, byEvent.get(e.id) || [])),
    });
  } catch (err: any) {
    console.error('[concerts] GET /:artistId/events failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load events' });
  }
});

// Buy tickets — prices recomputed server-side (never trust the client)
router.post('/:artistId/checkout', async (req: Request, res: Response) => {
  try {
    if (!stripe) return res.status(503).json({ success: false, error: 'Stripe is not configured' });
    const artistId = parseId(req.params.artistId);
    if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });

    const eventId = parseId(req.body?.eventId);
    const buyerEmail = normalizeEmail(req.body?.buyerEmail);
    const buyerName = typeof req.body?.buyerName === 'string' ? req.body.buyerName.trim().slice(0, 120) : null;
    const buyerPhone = typeof req.body?.buyerPhone === 'string' ? req.body.buyerPhone.trim().slice(0, 40) : null;
    const buyerCity = typeof req.body?.buyerCity === 'string' ? req.body.buyerCity.trim().slice(0, 120) : null;
    const buyerCountry = typeof req.body?.buyerCountry === 'string' ? req.body.buyerCountry.trim().slice(0, 8) : null;
    const marketingOptIn = req.body?.marketingOptIn === true;
    const policyAccepted = req.body?.policyAccepted === true;
    const rawItems: Array<{ tierId: number; quantity: number }> = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!eventId) return res.status(400).json({ success: false, error: 'Missing eventId' });
    if (!buyerEmail) return res.status(400).json({ success: false, error: 'A valid email is required' });
    if (!buyerName) return res.status(400).json({ success: false, error: 'Your name is required' });
    if (!rawItems.length) return res.status(400).json({ success: false, error: 'No tickets selected' });

    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });
    if (!['published', 'live'].includes(ev.status)) {
      return res.status(400).json({ success: false, error: 'This event is not on sale' });
    }
    // The buyer must accept the refund policy / terms before paying.
    if (!policyAccepted) {
      return res.status(400).json({ success: false, error: 'Debes aceptar la política de reembolso y los términos para continuar' });
    }

    // ── Reserved seating: price comes from the seats the buyer is holding ─────
    if (ev.seatingMode === 'reserved') {
      const holdToken = typeof req.body?.holdToken === 'string' ? req.body.holdToken.trim().slice(0, 64) : '';
      const seatIds: number[] = Array.isArray(req.body?.seatIds)
        ? Array.from(new Set(req.body.seatIds.map((s: unknown) => parseId(s)).filter((n: number | null): n is number => n != null)))
        : [];
      if (!holdToken || !seatIds.length) {
        return res.status(400).json({ success: false, error: 'Select your seats before checking out' });
      }
      const reserved = await reserveSeatsForCheckout(eventId, seatIds, holdToken, buyerEmail);
      if (!reserved) {
        return res.status(409).json({ success: false, error: 'Your seat hold expired or those seats are no longer yours. Please pick your seats again.' });
      }
      const seatLineItems = reserved.lines.map((l) => ({
        kind: 'ticket' as const, name: `${l.sectionName} · ${l.label}`, unitPrice: l.price, quantity: 1, seatId: l.seatId,
      }));
      const subtotalR = reserved.total;

      const { row: discountRow, reason: discountReason } = await resolveDiscount(artistId, eventId, req.body?.discountCode);
      if (req.body?.discountCode && !discountRow) {
        return res.status(400).json({ success: false, error: discountReason || 'Código no válido' });
      }
      const discountAmount = applyDiscount(subtotalR, discountRow);
      const payable = Math.max(0, Math.round((subtotalR - discountAmount) * 100) / 100);
      if (payable <= 0) return res.status(400).json({ success: false, error: 'El descuento deja la compra en $0 — contacta al artista' });

      const rate = await resolveCommissionRate(artistId);
      const { platformFee, artistEarning } = splitAmount(payable, rate);

      const [order] = await db
        .insert(concertOrders)
        .values({
          concertId: eventId, artistId, buyerEmail, buyerName, buyerPhone, buyerCity, buyerCountry,
          marketingOptIn, policyAccepted,
          items: seatLineItems,
          seatIds: reserved.lines.map((l) => l.seatId),
          quantity: seatLineItems.length,
          subtotal: payable.toFixed(2),
          commissionRate: rate,
          platformFee: platformFee.toFixed(2),
          artistEarning: artistEarning.toFixed(2),
          currency: ev.currency || 'usd',
          discountCode: discountRow ? String(discountRow.code) : null,
          discountAmount: discountAmount.toFixed(2),
          buyerDevice: detectDevice(req),
          status: 'pending',
        })
        .returning({ id: concertOrders.id });

      const baseUrl = getBaseUrl(req);
      const slug = ev.artistSlug || String(artistId);
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        customer_email: buyerEmail,
        phone_number_collection: { enabled: true },
        billing_address_collection: 'auto',
        line_items: seatLineItems.map((i) => ({
          price_data: {
            currency: ev.currency || 'usd',
            product_data: { name: `${ev.title} — ${i.name}` },
            unit_amount: Math.round(i.unitPrice * 100),
          },
          quantity: 1,
        })),
        ...(discountAmount > 0
          ? {
              discounts: [{
                coupon: (await stripe.coupons.create({
                  amount_off: Math.round(discountAmount * 100),
                  currency: ev.currency || 'usd',
                  duration: 'once',
                  name: discountRow ? `Código ${discountRow.code}` : 'Descuento',
                })).id,
              }],
            }
          : {}),
        mode: 'payment',
        success_url: `${baseUrl}/artist/${slug}?concert=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/artist/${slug}?concert=cancelled`,
        metadata: {
          type: 'concert_ticket', orderId: String(order.id), artistId: String(artistId),
          eventId: String(eventId), buyerEmail, discountCode: discountRow ? String(discountRow.code) : '',
        },
      });

      await db.update(concertOrders).set({ stripePaymentId: session.id }).where(eq(concertOrders.id, order.id));
      return res.json({ success: true, url: session.url, sessionId: session.id, orderId: order.id });
    }

    const tiers = await loadTiers([eventId]);
    const lineItems: Array<{ kind: 'ticket' | 'addon'; tierId?: number; addonId?: string; name: string; unitPrice: number; quantity: number }> = [];
    let subtotal = 0;
    let ticketQty = 0;
    for (const raw of rawItems) {
      const tierId = parseId(raw.tierId);
      const qty = Math.max(0, Math.min(20, parseInt(String(raw.quantity), 10) || 0));
      if (!tierId || qty <= 0) continue;
      const tier = tiers.find((t) => t.id === tierId);
      if (!tier || !tier.isActive) continue;
      // Anti-fraud: enforce per-order limit (tier override, else global cap 20).
      const perOrderCap = (tier.maxPerOrder && tier.maxPerOrder > 0) ? tier.maxPerOrder : 20;
      if (qty > perOrderCap) {
        return res.status(400).json({ success: false, error: `Máximo ${perOrderCap} entradas "${tier.name}" por compra` });
      }
      if (tier.quantityTotal != null) {
        const remaining = Math.max(0, tier.quantityTotal - (tier.quantitySold ?? 0));
        if (qty > remaining) {
          return res.status(400).json({ success: false, error: `Only ${remaining} "${tier.name}" tickets left` });
        }
      }
      const unitPrice = Number(tier.priceUsd);
      subtotal += unitPrice * qty;
      ticketQty += qty;
      lineItems.push({ kind: 'ticket', tierId, name: tier.name, unitPrice, quantity: qty });
    }

    // Merch / experience add-ons sold alongside the ticket. Prices are
    // recomputed from the event's linkedModules.addons (never trust the client).
    const eventAddons: Array<{ id: string; label: string; priceUsd: number }> =
      Array.isArray((ev.linkedModules as any)?.addons) ? (ev.linkedModules as any).addons : [];
    const rawAddons: Array<{ addonId: string; quantity: number }> = Array.isArray(req.body?.addons) ? req.body.addons : [];
    for (const raw of rawAddons) {
      const addonId = String(raw?.addonId || '').slice(0, 64);
      const qty = Math.max(0, Math.min(20, parseInt(String(raw?.quantity), 10) || 0));
      if (!addonId || qty <= 0) continue;
      const addon = eventAddons.find((a) => String(a.id) === addonId);
      if (!addon) continue;
      const unitPrice = Math.max(0, Number(addon.priceUsd) || 0);
      if (unitPrice <= 0) continue;
      subtotal += unitPrice * qty;
      lineItems.push({ kind: 'addon', addonId, name: addon.label || 'Add-on', unitPrice, quantity: qty });
    }

    if (!lineItems.length) return res.status(400).json({ success: false, error: 'No items selected' });
    if (!ticketQty && !rawAddons.length) return res.status(400).json({ success: false, error: 'No tickets selected' });
    if (subtotal <= 0) return res.status(400).json({ success: false, error: 'Free events do not require checkout' });

    // Promo / presale code (optional). Discount is applied to the subtotal and
    // the commission split is computed on the discounted amount.
    const { row: discountRow, reason: discountReason } = await resolveDiscount(artistId, eventId, req.body?.discountCode);
    if (req.body?.discountCode && !discountRow) {
      return res.status(400).json({ success: false, error: discountReason || 'Código no válido' });
    }
    const discountAmount = applyDiscount(subtotal, discountRow);
    const payable = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
    if (payable <= 0) {
      return res.status(400).json({ success: false, error: 'El descuento deja la compra en $0 — contacta al artista' });
    }

    const totalQty = lineItems.reduce((s, i) => s + i.quantity, 0);
    const rate = await resolveCommissionRate(artistId);
    const { platformFee, artistEarning } = splitAmount(payable, rate);

    // Record a pending order BEFORE redirecting (idempotency anchor).
    const [order] = await db
      .insert(concertOrders)
      .values({
        concertId: eventId,
        artistId,
        buyerEmail,
        buyerName,
        buyerPhone,
        buyerCity,
        buyerCountry,
        marketingOptIn,
        policyAccepted,
        items: lineItems,
        quantity: totalQty,
        subtotal: payable.toFixed(2),
        commissionRate: rate,
        platformFee: platformFee.toFixed(2),
        artistEarning: artistEarning.toFixed(2),
        currency: ev.currency || 'usd',
        discountCode: discountRow ? String(discountRow.code) : null,
        discountAmount: discountAmount.toFixed(2),
        buyerDevice: detectDevice(req),
        status: 'pending',
      })
      .returning({ id: concertOrders.id });

    const baseUrl = getBaseUrl(req);
    const slug = ev.artistSlug || String(artistId);
    const successUrl = `${baseUrl}/artist/${slug}?concert=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/artist/${slug}?concert=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: buyerEmail,
      // Collect phone + billing country at Stripe checkout too, so we can
      // backfill the buyer lead even if the on-site form left them blank.
      phone_number_collection: { enabled: true },
      billing_address_collection: 'auto',
      line_items: lineItems.map((i) => ({
        price_data: {
          currency: ev.currency || 'usd',
          product_data: { name: `${ev.title} — ${i.name}` },
          unit_amount: Math.round(i.unitPrice * 100),
        },
        quantity: i.quantity,
      })),
      ...(discountAmount > 0
        ? {
            discounts: [{
              coupon: (await stripe.coupons.create({
                amount_off: Math.round(discountAmount * 100),
                currency: ev.currency || 'usd',
                duration: 'once',
                name: discountRow ? `Código ${discountRow.code}` : 'Descuento',
              })).id,
            }],
          }
        : {}),
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: 'concert_ticket',
        orderId: String(order.id),
        artistId: String(artistId),
        eventId: String(eventId),
        buyerEmail,
        discountCode: discountRow ? String(discountRow.code) : '',
      },
    });

    await db
      .update(concertOrders)
      .set({ stripePaymentId: session.id })
      .where(eq(concertOrders.id, order.id));

    res.json({ success: true, url: session.url, sessionId: session.id, orderId: order.id });
  } catch (err: any) {
    console.error('[concerts] POST /checkout failed:', err?.message);
    res.status(500).json({ success: false, error: 'Checkout failed' });
  }
});

// Buyer sends a message (email identity, no login)
router.post('/:artistId/messages', async (req: Request, res: Response) => {
  try {
    const artistId = parseId(req.params.artistId);
    if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
    const buyerEmail = normalizeEmail(req.body?.buyerEmail);
    const buyerName = typeof req.body?.buyerName === 'string' ? req.body.buyerName.trim().slice(0, 120) : null;
    const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 2000) : '';
    const eventId = parseId(req.body?.eventId);
    if (!buyerEmail) return res.status(400).json({ success: false, error: 'A valid email is required' });
    if (!body) return res.status(400).json({ success: false, error: 'Message is empty' });

    // Find or create the thread for (artist, buyer, event).
    const existing = await db
      .select()
      .from(concertThreads)
      .where(and(
        eq(concertThreads.artistId, artistId),
        eq(concertThreads.buyerEmail, buyerEmail),
        eventId ? eq(concertThreads.concertId, eventId) : sql`${concertThreads.concertId} IS NULL`,
      ))
      .limit(1);

    let threadId: number;
    if (existing.length) {
      threadId = existing[0].id;
      await db.update(concertThreads).set({
        lastMessagePreview: body.slice(0, 140),
        lastMessageAt: new Date(),
        artistUnread: (existing[0].artistUnread ?? 0) + 1,
        buyerName: buyerName || existing[0].buyerName,
        updatedAt: new Date(),
        status: 'open',
      }).where(eq(concertThreads.id, threadId));
    } else {
      const [created] = await db.insert(concertThreads).values({
        concertId: eventId ?? null,
        artistId,
        buyerEmail,
        buyerName,
        subject: 'Concert inquiry',
        lastMessagePreview: body.slice(0, 140),
        lastMessageAt: new Date(),
        artistUnread: 1,
        buyerUnread: 0,
        status: 'open',
      }).returning({ id: concertThreads.id });
      threadId = created.id;
    }

    await db.insert(concertMessages).values({ threadId, senderRole: 'buyer', body });
    res.json({ success: true, threadId });
  } catch (err: any) {
    console.error('[concerts] POST /messages failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to send message' });
  }
});

// Buyer fetches their thread + messages
router.get('/:artistId/thread', async (req: Request, res: Response) => {
  try {
    const artistId = parseId(req.params.artistId);
    if (!artistId) return res.status(400).json({ success: false, error: 'Invalid artist id' });
    const email = normalizeEmail(req.query.email);
    if (!email) return res.json({ success: true, thread: null, messages: [] });
    const [thread] = await db
      .select()
      .from(concertThreads)
      .where(and(eq(concertThreads.artistId, artistId), eq(concertThreads.buyerEmail, email)))
      .orderBy(desc(concertThreads.updatedAt))
      .limit(1);
    if (!thread) return res.json({ success: true, thread: null, messages: [] });
    const messages = await db
      .select()
      .from(concertMessages)
      .where(eq(concertMessages.threadId, thread.id))
      .orderBy(concertMessages.createdAt);
    // Mark artist replies as read for the buyer.
    if ((thread.buyerUnread ?? 0) > 0) {
      await db.update(concertThreads).set({ buyerUnread: 0 }).where(eq(concertThreads.id, thread.id));
    }
    res.json({
      success: true,
      thread: { id: thread.id, subject: thread.subject, status: thread.status },
      messages: messages.map((m) => ({ id: m.id, role: m.senderRole, body: m.body, createdAt: m.createdAt })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /thread failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load thread' });
  }
});

// ════════════════════════════════════════════════════════════════════════
// OWNER — artist side (auth + ownership)
// ════════════════════════════════════════════════════════════════════════

async function guardOwner(req: Request, res: Response): Promise<number | null> {
  const artistId = parseId(req.params.artistId);
  if (!artistId) {
    res.status(400).json({ success: false, error: 'Invalid artist id' });
    return null;
  }
  if (!(await ownsArtist(req, artistId))) {
    res.status(403).json({ success: false, error: 'Not authorized for this artist' });
    return null;
  }
  return artistId;
}

// Owner dashboard bootstrap
router.get('/:artistId/manage', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const events = await db.select().from(concertEvents).where(eq(concertEvents.artistId, artistId)).orderBy(desc(concertEvents.createdAt));
    const tiers = await loadTiers(events.map((e) => e.id));
    const byEvent = new Map<number, any[]>();
    for (const t of tiers) {
      const arr = byEvent.get(t.concertId) || [];
      arr.push(t);
      byEvent.set(t.concertId, arr);
    }
    const [revenue] = await db
      .select({
        orders: sql<number>`count(*)`,
        gross: sql<string>`coalesce(sum(${concertOrders.subtotal}), 0)`,
        earnings: sql<string>`coalesce(sum(${concertOrders.artistEarning}), 0)`,
      })
      .from(concertOrders)
      .where(and(eq(concertOrders.artistId, artistId), eq(concertOrders.status, 'completed')));
    const [threadAgg] = await db
      .select({ unread: sql<number>`coalesce(sum(${concertThreads.artistUnread}), 0)`, total: sql<number>`count(*)` })
      .from(concertThreads)
      .where(eq(concertThreads.artistId, artistId));
    const commissionRate = await resolveCommissionRate(artistId);
    res.json({
      success: true,
      commissionRate,
      events: events.map((e) => serializeEvent(e, byEvent.get(e.id) || [])),
      revenue: {
        completedOrders: Number(revenue?.orders || 0),
        grossRevenue: Number(revenue?.gross || 0),
        netEarnings: Number(revenue?.earnings || 0),
      },
      messages: { unread: Number(threadAgg?.unread || 0), threads: Number(threadAgg?.total || 0) },
    });
  } catch (err: any) {
    console.error('[concerts] GET /manage failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load dashboard' });
  }
});

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const raw = String(value).trim();
  if (!raw) return null;
  // The client always sends a full ISO-8601 instant (e.g. "2026-06-18T21:30:00.000Z"),
  // computed from the artist's local wall-clock so the stored instant is exact.
  // Be defensive: if a bare datetime-local string ("2026-06-18T14:30", no offset)
  // ever arrives, new Date() parses it in the server's local tz — still valid, just
  // less precise. We never silently drop a date.
  const d = new Date(raw);
  return isNaN(d.getTime()) ? null : d;
}

// ── Refund / cancellation policy presets ─────────────────────────────────
// Artists pick a preset (or write a custom policy). The text is shown at
// checkout, stored on the order's snapshot and included in the confirmation
// email — giving both the buyer and the artist clear, enforceable terms.
const REFUND_POLICY_PRESETS: Record<string, string> = {
  flexible: 'Reembolso completo hasta 7 días antes del evento. Después de esa fecha no se admiten reembolsos, pero tu entrada es transferible a otra persona.',
  moderate: 'Reembolso del 50% hasta 48 horas antes del evento. No se admiten reembolsos en las últimas 48 horas. Tu entrada es transferible.',
  strict: 'Todas las ventas son finales. No se admiten reembolsos salvo cancelación del evento por parte del artista.',
  no_refunds: 'Todas las ventas son finales. No se admiten reembolsos ni cambios bajo ninguna circunstancia.',
};
const REFUND_POLICY_TYPES = ['flexible', 'moderate', 'strict', 'no_refunds', 'custom'];

/** Normalize a refund policy {type,text} pair coming from the client. */
function normalizeRefundPolicy(type: unknown, text: unknown): { type: string; text: string } {
  const t = typeof type === 'string' && REFUND_POLICY_TYPES.includes(type) ? type : 'flexible';
  const custom = typeof text === 'string' ? text.trim().slice(0, 2000) : '';
  if (t === 'custom') {
    return { type: 'custom', text: custom || REFUND_POLICY_PRESETS.flexible };
  }
  // For a preset, prefer any explicit text the artist tweaked, else the preset copy.
  return { type: t, text: custom || REFUND_POLICY_PRESETS[t] || REFUND_POLICY_PRESETS.flexible };
}

// Create event
router.post('/:artistId/events', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const b = req.body || {};
    const title = typeof b.title === 'string' ? b.title.trim().slice(0, 160) : '';
    if (!title) return res.status(400).json({ success: false, error: 'Title is required' });
    const type = ['in_person', 'online', 'hybrid'].includes(b.type) ? b.type : 'in_person';
    // Resolve the artist's slug for buyer-facing links.
    const [u] = await db.select({ slug: users.slug, username: users.username }).from(users).where(eq(users.id, artistId)).limit(1);
    const policy = normalizeRefundPolicy(b.refundPolicyType, b.refundPolicy);
    const [created] = await db.insert(concertEvents).values({
      artistId,
      title,
      description: typeof b.description === 'string' ? b.description.slice(0, 4000) : null,
      type,
      status: b.status === 'published' ? 'published' : 'draft',
      startsAt: parseDate(b.startsAt),
      endsAt: parseDate(b.endsAt),
      timezone: typeof b.timezone === 'string' ? b.timezone.slice(0, 64) : null,
      venue: typeof b.venue === 'string' ? b.venue.slice(0, 200) : null,
      location: typeof b.location === 'string' ? b.location.slice(0, 200) : null,
      capacity: parseId(b.capacity),
      posterUrl: typeof b.posterUrl === 'string' ? b.posterUrl.slice(0, 600) : null,
      currency: typeof b.currency === 'string' ? b.currency.slice(0, 8) : 'usd',
      streamingConfig: b.streamingConfig ?? null,
      linkedModules: b.linkedModules ?? null,
      refundPolicy: policy.text,
      refundPolicyType: policy.type,
      artistSlug: u?.slug || u?.username || String(artistId),
    }).returning();
    res.json({ success: true, event: serializeEvent(created, []) });
  } catch (err: any) {
    console.error('[concerts] POST /events failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to create event' });
  }
});

// ── Standalone TICKETING / SHOWS module entry point ──────────────────────
// Quick-create a sellable show in ONE call — used by the profile "Add Show"
// form so an artist can put a show on sale (Stripe checkout + QR pass +
// platform commission) without opening the full event editor. Creates a
// PUBLISHED event plus a default "General Admission" ticket tier when a price
// is supplied. A price of 0 produces a free, listed-only show (no tier).
//
// This endpoint belongs to the standalone ticketing module (sell entradas).
// It does NOT create merch add-ons — merchandise monetization is layered on
// top by the SEPARATE Concert Command Center connector via `linkedModules`.
router.post('/:artistId/quick-show', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const b = req.body || {};
    const venue = typeof b.venue === 'string' ? b.venue.trim().slice(0, 200) : '';
    const location = typeof b.location === 'string' ? b.location.trim().slice(0, 200) : '';
    const title = (typeof b.title === 'string' && b.title.trim())
      ? b.title.trim().slice(0, 160)
      : (venue ? `Live · ${venue}` : 'Live Show');
    if (!venue && !location && !(typeof b.title === 'string' && b.title.trim())) {
      return res.status(400).json({ success: false, error: 'Venue or title is required' });
    }
    const startsAt = parseDate(b.startsAt);
    const priceUsd = Math.max(0, Number(b.priceUsd) || 0);
    const capacity = parseId(b.capacity);
    const type = ['in_person', 'online', 'hybrid'].includes(b.type) ? b.type : 'in_person';
    const externalTicketUrl = typeof b.ticketUrl === 'string' && /^https?:\/\//i.test(b.ticketUrl.trim())
      ? b.ticketUrl.trim().slice(0, 600)
      : null;

    const [u] = await db.select({ slug: users.slug, username: users.username }).from(users).where(eq(users.id, artistId)).limit(1);
    const policy = normalizeRefundPolicy(b.refundPolicyType, b.refundPolicy);
    const [created] = await db.insert(concertEvents).values({
      artistId,
      title,
      description: typeof b.description === 'string' ? b.description.slice(0, 4000) : null,
      type,
      status: 'published', // immediately on sale / listed
      startsAt,
      timezone: typeof b.timezone === 'string' ? b.timezone.slice(0, 64) : null,
      venue: venue || null,
      location: location || null,
      capacity,
      currency: 'usd',
      linkedModules: externalTicketUrl ? { externalTicketUrl } : null,
      refundPolicy: policy.text,
      refundPolicyType: policy.type,
      artistSlug: u?.slug || u?.username || String(artistId),
    }).returning();

    // Default ticket tier — only when a paid price is given. Free shows are
    // listed without a tier (no checkout).
    let tier: any = null;
    if (priceUsd > 0) {
      const tierName = typeof b.tierName === 'string' && b.tierName.trim()
        ? b.tierName.trim().slice(0, 80)
        : 'General Admission';
      [tier] = await db.insert(concertTicketTiers).values({
        concertId: created.id,
        name: tierName,
        priceUsd: priceUsd.toFixed(2),
        quantityTotal: capacity,
        isActive: true,
        sortOrder: 0,
      }).returning();
    }
    res.json({ success: true, event: serializeEvent(created, tier ? [tier] : []) });
  } catch (err: any) {
    console.error('[concerts] POST /quick-show failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to create show' });
  }
});

// Update event
router.patch('/:artistId/events/:eventId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });

    const b = req.body || {};
    const patch: any = { updatedAt: new Date() };
    if (typeof b.title === 'string') patch.title = b.title.trim().slice(0, 160);
    if (typeof b.description === 'string') patch.description = b.description.slice(0, 4000);
    if (['in_person', 'online', 'hybrid'].includes(b.type)) patch.type = b.type;
    if (['draft', 'published', 'live', 'ended', 'cancelled'].includes(b.status)) patch.status = b.status;
    if ('startsAt' in b) patch.startsAt = parseDate(b.startsAt);
    if ('endsAt' in b) patch.endsAt = parseDate(b.endsAt);
    if (typeof b.timezone === 'string') patch.timezone = b.timezone.slice(0, 64);
    if (typeof b.venue === 'string') patch.venue = b.venue.slice(0, 200);
    if (typeof b.location === 'string') patch.location = b.location.slice(0, 200);
    if ('capacity' in b) patch.capacity = parseId(b.capacity);
    if (typeof b.posterUrl === 'string') patch.posterUrl = b.posterUrl.slice(0, 600);
    if (typeof b.currency === 'string') patch.currency = b.currency.slice(0, 8);
    if ('streamingConfig' in b) patch.streamingConfig = b.streamingConfig ?? null;
    if ('linkedModules' in b) patch.linkedModules = b.linkedModules ?? null;
    if ('refundPolicy' in b || 'refundPolicyType' in b) {
      const policy = normalizeRefundPolicy(b.refundPolicyType ?? ev.refundPolicyType, b.refundPolicy ?? ev.refundPolicy);
      patch.refundPolicy = policy.text;
      patch.refundPolicyType = policy.type;
    }

    const [updated] = await db.update(concertEvents).set(patch).where(eq(concertEvents.id, eventId)).returning();
    const tiers = await loadTiers([eventId]);
    res.json({ success: true, event: serializeEvent(updated, tiers) });
  } catch (err: any) {
    console.error('[concerts] PATCH /events failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to update event' });
  }
});

// Delete event
router.delete('/:artistId/events/:eventId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });
    await db.delete(concertEvents).where(eq(concertEvents.id, eventId));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[concerts] DELETE /events failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to delete event' });
  }
});

// Add ticket tier
router.post('/:artistId/events/:eventId/tiers', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });

    const b = req.body || {};
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 80) : '';
    if (!name) return res.status(400).json({ success: false, error: 'Tier name is required' });
    const price = Math.max(0, Number(b.priceUsd) || 0);
    const [created] = await db.insert(concertTicketTiers).values({
      concertId: eventId,
      name,
      description: typeof b.description === 'string' ? b.description.slice(0, 400) : null,
      priceUsd: price.toFixed(2),
      quantityTotal: 'quantityTotal' in b ? parseId(b.quantityTotal) : null,
      maxPerOrder: 'maxPerOrder' in b ? parseId(b.maxPerOrder) : null,
      perks: Array.isArray(b.perks) ? b.perks.slice(0, 12) : null,
      sortOrder: parseInt(String(b.sortOrder), 10) || 0,
      isActive: b.isActive !== false,
    }).returning();
    res.json({ success: true, tier: serializeTier(created) });
  } catch (err: any) {
    console.error('[concerts] POST /tiers failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to add tier' });
  }
});

// Update tier
router.patch('/:artistId/tiers/:tierId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const tierId = parseId(req.params.tierId);
    if (!tierId) return res.status(400).json({ success: false, error: 'Invalid tier id' });
    const [tier] = await db.select().from(concertTicketTiers).where(eq(concertTicketTiers.id, tierId)).limit(1);
    if (!tier) return res.status(404).json({ success: false, error: 'Tier not found' });
    const [ev] = await db.select({ artistId: concertEvents.artistId }).from(concertEvents).where(eq(concertEvents.id, tier.concertId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(403).json({ success: false, error: 'Not authorized' });

    const b = req.body || {};
    const patch: any = {};
    if (typeof b.name === 'string') patch.name = b.name.trim().slice(0, 80);
    if (typeof b.description === 'string') patch.description = b.description.slice(0, 400);
    if ('priceUsd' in b) patch.priceUsd = Math.max(0, Number(b.priceUsd) || 0).toFixed(2);
    if ('quantityTotal' in b) patch.quantityTotal = parseId(b.quantityTotal);
    if ('maxPerOrder' in b) patch.maxPerOrder = parseId(b.maxPerOrder);
    if ('perks' in b) patch.perks = Array.isArray(b.perks) ? b.perks.slice(0, 12) : null;
    if ('sortOrder' in b) patch.sortOrder = parseInt(String(b.sortOrder), 10) || 0;
    if ('isActive' in b) patch.isActive = b.isActive !== false;

    const [updated] = await db.update(concertTicketTiers).set(patch).where(eq(concertTicketTiers.id, tierId)).returning();
    res.json({ success: true, tier: serializeTier(updated) });
  } catch (err: any) {
    console.error('[concerts] PATCH /tiers failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to update tier' });
  }
});

// Delete tier
router.delete('/:artistId/tiers/:tierId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const tierId = parseId(req.params.tierId);
    if (!tierId) return res.status(400).json({ success: false, error: 'Invalid tier id' });
    const [tier] = await db.select().from(concertTicketTiers).where(eq(concertTicketTiers.id, tierId)).limit(1);
    if (!tier) return res.status(404).json({ success: false, error: 'Tier not found' });
    const [ev] = await db.select({ artistId: concertEvents.artistId }).from(concertEvents).where(eq(concertEvents.id, tier.concertId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(403).json({ success: false, error: 'Not authorized' });
    await db.delete(concertTicketTiers).where(eq(concertTicketTiers.id, tierId));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[concerts] DELETE /tiers failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to delete tier' });
  }
});

// Orders for owner's events
router.get('/:artistId/orders', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const rows = await db
      .select({
        id: concertOrders.id,
        concertId: concertOrders.concertId,
        buyerEmail: concertOrders.buyerEmail,
        buyerName: concertOrders.buyerName,
        quantity: concertOrders.quantity,
        subtotal: concertOrders.subtotal,
        commissionRate: concertOrders.commissionRate,
        artistEarning: concertOrders.artistEarning,
        status: concertOrders.status,
        createdAt: concertOrders.createdAt,
        eventTitle: concertEvents.title,
      })
      .from(concertOrders)
      .leftJoin(concertEvents, eq(concertOrders.concertId, concertEvents.id))
      .where(eq(concertOrders.artistId, artistId))
      .orderBy(desc(concertOrders.createdAt))
      .limit(100);
    res.json({ success: true, orders: rows });
  } catch (err: any) {
    console.error('[concerts] GET /orders failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load orders' });
  }
});

// Door check-in — validate a scanned QR token and admit (single-use, atomic)
router.post('/:artistId/scan', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  const scannedBy = String(resolveOwnerId(req) ?? 'owner');
  const gate = typeof req.body?.gate === 'string' ? req.body.gate.slice(0, 60) : null;
  // Fire-and-forget audit writer: the backend is the only thing that can log a
  // scan, so the security dashboard can never be spoofed from the client.
  const logScan = (result: string, pass?: any) => {
    db.insert(concertScanLogs).values({
      artistId,
      concertId: pass?.concertId ?? parseId(req.body?.eventId) ?? null,
      passId: pass?.id ?? null,
      passCode: pass?.passCode ?? null,
      result,
      scannedBy,
      gate,
      buyerName: pass?.buyerName ?? null,
    }).catch(() => { /* logging must never block the door */ });
  };
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token : '';
    const eventFilter = parseId(req.body?.eventId); // optional: restrict to one event's door
    const parsed = parsePassToken(token);
    if (!parsed) { logScan('malformed'); return res.json({ ok: false, reason: 'malformed', message: 'Código no válido' }); }

    const [pass] = await db
      .select()
      .from(concertTicketPasses)
      .where(eq(concertTicketPasses.passCode, parsed.passCode))
      .limit(1);
    if (!pass) { logScan('not_found'); return res.json({ ok: false, reason: 'not_found', message: 'Pase no encontrado' }); }

    // Cryptographic check first — a forged/edited token fails here.
    const validSig = verifyPassSignature(
      { passCode: pass.passCode, orderId: pass.orderId, concertId: pass.concertId, tierId: pass.tierId ?? null },
      parsed.signature,
    );
    if (!validSig) { logScan('bad_signature', pass); return res.json({ ok: false, reason: 'bad_signature', message: 'Firma inválida (posible falsificación)' }); }

    // Authorization: the pass must belong to this artist (and event, if given).
    if (pass.artistId !== artistId) { logScan('wrong_artist', pass); return res.json({ ok: false, reason: 'wrong_artist', message: 'Este pase no es de tu evento' }); }
    if (eventFilter && pass.concertId !== eventFilter) {
      logScan('wrong_event', pass);
      return res.json({ ok: false, reason: 'wrong_event', message: 'Pase de otro evento' });
    }

    if (pass.status === 'void') { logScan('void', pass); return res.json({ ok: false, reason: 'void', message: 'Pase anulado (reembolsado)', pass: serializePass(pass) }); }
    if (pass.status === 'transferred') { logScan('void', pass); return res.json({ ok: false, reason: 'transferred', message: 'Pase transferido — el QR antiguo ya no es válido', pass: serializePass(pass) }); }
    if (pass.status === 'checked_in') {
      logScan('already_used', pass);
      return res.json({
        ok: false,
        reason: 'already_used',
        message: 'Ya se usó este pase',
        checkedInAt: pass.checkedInAt,
        pass: serializePass(pass),
      });
    }

    // Atomic single-use admission: only one request can flip valid → checked_in.
    const updated = await db
      .update(concertTicketPasses)
      .set({ status: 'checked_in', checkedInAt: new Date(), checkedInBy: scannedBy })
      .where(and(eq(concertTicketPasses.id, pass.id), eq(concertTicketPasses.status, 'valid')))
      .returning({ id: concertTicketPasses.id });
    if (!updated.length) {
      logScan('race', pass);
      return res.json({ ok: false, reason: 'race', message: 'Pase usado en otra puerta', pass: serializePass(pass) });
    }

    logScan('valid', pass);
    res.json({
      ok: true,
      message: '✅ Acceso permitido',
      pass: { ...serializePass(pass), status: 'checked_in', checkedInAt: new Date() },
    });
  } catch (err: any) {
    console.error('[concerts] POST /scan failed:', err?.message);
    logScan('error');
    res.status(500).json({ ok: false, reason: 'error', message: 'Error al validar' });
  }
});

// Owner roster of passes for an event (door dashboard + check-in stats)
router.get('/:artistId/passes', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.query.eventId);
    const where = eventId
      ? and(eq(concertTicketPasses.artistId, artistId), eq(concertTicketPasses.concertId, eventId))
      : eq(concertTicketPasses.artistId, artistId);
    const rows = await db
      .select()
      .from(concertTicketPasses)
      .where(where)
      .orderBy(desc(concertTicketPasses.id))
      .limit(500);
    const stats = {
      total: rows.length,
      checkedIn: rows.filter((r) => r.status === 'checked_in').length,
      valid: rows.filter((r) => r.status === 'valid').length,
      void: rows.filter((r) => r.status === 'void').length,
    };
    res.json({
      success: true,
      stats,
      passes: rows.map((p) => ({
        id: p.id,
        passCode: p.passCode,
        tierName: p.tierName,
        buyerName: p.buyerName,
        buyerEmail: p.buyerEmail,
        status: p.status,
        checkedInAt: p.checkedInAt,
        concertId: p.concertId,
      })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /passes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load passes' });
  }
});

// Owner security dashboard — scan audit log + fraud stats
router.get('/:artistId/scan-logs', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.query.eventId);
    const where = eventId
      ? and(eq(concertScanLogs.artistId, artistId), eq(concertScanLogs.concertId, eventId))
      : eq(concertScanLogs.artistId, artistId);
    const rows = await db
      .select()
      .from(concertScanLogs)
      .where(where)
      .orderBy(desc(concertScanLogs.id))
      .limit(300);
    const count = (r: string) => rows.filter((x) => x.result === r).length;
    const stats = {
      totalScans: rows.length,
      admitted: count('valid'),
      duplicateAttempts: count('already_used') + count('race'),
      forged: count('bad_signature') + count('malformed'),
      wrong: count('wrong_artist') + count('wrong_event'),
      voided: count('void'),
      // anything that isn't a clean admit is a "rejected" attempt worth review
      rejected: rows.length - count('valid'),
    };
    res.json({
      success: true,
      stats,
      logs: rows.map((l) => ({
        id: l.id,
        result: l.result,
        passCode: l.passCode,
        buyerName: l.buyerName,
        gate: l.gate,
        scannedBy: l.scannedBy,
        concertId: l.concertId,
        createdAt: l.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /scan-logs failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load scan logs' });
  }
});

// Owner CSV export — door manifest (all passes for an event, or all events)
router.get('/:artistId/passes.csv', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = parseId(req.query.eventId);
    const where = eventId
      ? and(eq(concertTicketPasses.artistId, artistId), eq(concertTicketPasses.concertId, eventId))
      : eq(concertTicketPasses.artistId, artistId);
    const rows = await db
      .select()
      .from(concertTicketPasses)
      .where(where)
      .orderBy(desc(concertTicketPasses.id))
      .limit(5000);
    const esc = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = ['pass_code', 'event_id', 'tier', 'seat', 'buyer_name', 'buyer_email', 'status', 'checked_in_at'];
    const lines = [header.join(',')];
    for (const p of rows) {
      lines.push([
        esc(p.passCode), esc(p.concertId), esc(p.tierName), esc(p.seat),
        esc(p.buyerName), esc(p.buyerEmail), esc(p.status),
        esc(p.checkedInAt ? new Date(p.checkedInAt).toISOString() : ''),
      ].join(','));
    }
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="boostify-passes${eventId ? `-event-${eventId}` : ''}.csv"`);
    res.send(csv);
  } catch (err: any) {
    console.error('[concerts] GET /passes.csv failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to export passes' });
  }
});

// ════════════════════════════════════════════════════════════════════════
// FAN TICKET WALLET — public, identified by email (no login, like the rest of
// the fan-facing flow). Returns every live ticket for that email + the signed
// QR token, grouped by event. The QR's validity is always re-checked at the
// door against the server, so exposing the token here is safe.
// ════════════════════════════════════════════════════════════════════════
router.get('/wallet', async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!email || !EMAIL_REGEX.test(email)) {
      return res.status(400).json({ success: false, error: 'A valid email is required' });
    }
    const passes = await db
      .select()
      .from(concertTicketPasses)
      .where(and(eq(concertTicketPasses.buyerEmail, email), inArray(concertTicketPasses.status, ['valid', 'checked_in'])))
      .orderBy(desc(concertTicketPasses.id))
      .limit(200);

    if (!passes.length) return res.json({ success: true, tickets: [] });

    const eventIds = Array.from(new Set(passes.map((p) => p.concertId)));
    const events = await db.select().from(concertEvents).where(inArray(concertEvents.id, eventIds));
    const evById = new Map(events.map((e) => [e.id, e]));

    // Group passes under their event, newest event first.
    const groups = new Map<number, any>();
    for (const p of passes) {
      const ev = evById.get(p.concertId);
      if (!ev) continue;
      if (!groups.has(ev.id)) {
        groups.set(ev.id, {
          eventId: ev.id,
          title: ev.title,
          startsAt: ev.startsAt instanceof Date ? ev.startsAt.toISOString() : ev.startsAt,
          venue: ev.venue,
          location: ev.location,
          posterUrl: ev.posterUrl,
          artistSlug: (ev as any).artistSlug || null,
          passes: [],
        });
      }
      groups.get(ev.id).passes.push({
        id: p.id,
        passCode: p.passCode,
        token: buildPassToken(p.passCode, p.signature),
        tierName: p.tierName,
        seat: p.seat,
        status: p.status,
        buyerName: p.buyerName,
        checkedInAt: p.checkedInAt,
      });
    }
    const tickets = Array.from(groups.values()).sort((a, b) => String(b.startsAt || '').localeCompare(String(a.startsAt || '')));
    res.json({ success: true, tickets });
  } catch (err: any) {
    console.error('[concerts] GET /wallet failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load wallet' });
  }
});

// ════════════════════════════════════════════════════════════════════════
// SECURE TICKET TRANSFER — the current owner (proven by email + passCode) gives
// a ticket to a new owner. A brand-new pass code + signature is minted for the
// recipient and the OLD pass is marked 'transferred' (its QR can never re-enter
// — the door scan explicitly rejects 'transferred'). Atomic.
// ════════════════════════════════════════════════════════════════════════
router.post('/transfer', async (req: Request, res: Response) => {
  try {
    const fromEmail = String(req.body?.fromEmail || '').trim().toLowerCase();
    const toEmail = String(req.body?.toEmail || '').trim().toLowerCase();
    const toName = typeof req.body?.toName === 'string' ? req.body.toName.trim().slice(0, 120) : null;
    const passCode = typeof req.body?.passCode === 'string' ? req.body.passCode.trim() : '';
    if (!EMAIL_REGEX.test(fromEmail) || !EMAIL_REGEX.test(toEmail)) {
      return res.status(400).json({ success: false, error: 'Valid sender and recipient emails are required' });
    }
    if (fromEmail === toEmail) return res.status(400).json({ success: false, error: 'The recipient must be a different email' });
    if (!passCode) return res.status(400).json({ success: false, error: 'Missing ticket code' });

    const [pass] = await db.select().from(concertTicketPasses).where(eq(concertTicketPasses.passCode, passCode)).limit(1);
    if (!pass) return res.status(404).json({ success: false, error: 'Ticket not found' });
    // Ownership proof: the requester must be the current buyer email.
    if (String(pass.buyerEmail || '').toLowerCase() !== fromEmail) {
      return res.status(403).json({ success: false, error: 'This ticket is not registered to that email' });
    }
    if (pass.status !== 'valid') {
      return res.status(409).json({ success: false, error: pass.status === 'checked_in' ? 'This ticket was already used' : 'This ticket can no longer be transferred' });
    }

    // Mint the new pass for the recipient and void the old QR atomically.
    const newCode = generatePassCode();
    const newSig = signPass({ passCode: newCode, orderId: pass.orderId, concertId: pass.concertId, tierId: pass.tierId ?? null });
    let newPass: any = null;
    await db.transaction(async (tx) => {
      // Only transfer if it's still 'valid' at write time (guards double-transfer).
      const flipped = await tx
        .update(concertTicketPasses)
        .set({ status: 'transferred' })
        .where(and(eq(concertTicketPasses.id, pass.id), eq(concertTicketPasses.status, 'valid')))
        .returning({ id: concertTicketPasses.id });
      if (!flipped.length) throw new Error('ALREADY_TRANSFERRED');

      const [created] = await tx.insert(concertTicketPasses).values({
        orderId: pass.orderId,
        concertId: pass.concertId,
        artistId: pass.artistId,
        tierId: pass.tierId,
        tierName: pass.tierName,
        buyerEmail: toEmail,
        buyerName: toName || pass.buyerName,
        passCode: newCode,
        signature: newSig,
        status: 'valid',
        seat: pass.seat,
        seatId: pass.seatId,
      }).returning();
      newPass = created;

      await tx.insert(concertTicketTransfers).values({
        artistId: pass.artistId,
        concertId: pass.concertId,
        oldPassId: pass.id,
        newPassId: created.id,
        fromEmail,
        toEmail,
        toName,
      });
    });

    // Notify the new owner (best-effort) with a link to their wallet.
    try {
      const base = getBaseUrl(req);
      const walletUrl = `${base}/my-tickets?email=${encodeURIComponent(toEmail)}`;
      const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, pass.concertId)).limit(1);
      await sendNotificationEmail(
        toEmail,
        `🎟️ You received a ticket for ${ev?.title || 'a show'}`,
        'A ticket was transferred to you',
        `${pass.buyerName || fromEmail} sent you a ticket${ev?.title ? ` for <strong>${ev.title}</strong>` : ''}. Open your wallet to view your QR at the door.`,
        'Open my wallet',
        walletUrl,
      );
    } catch { /* email is best-effort */ }

    res.json({ success: true, newPassCode: newPass?.passCode, toEmail });
  } catch (err: any) {
    if (err?.message === 'ALREADY_TRANSFERRED') {
      return res.status(409).json({ success: false, error: 'This ticket was just transferred or used.' });
    }
    console.error('[concerts] POST /transfer failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to transfer ticket' });
  }
});

// Buyer threads for owner
router.get('/:artistId/threads', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const threads = await db
      .select()
      .from(concertThreads)
      .where(eq(concertThreads.artistId, artistId))
      .orderBy(desc(concertThreads.updatedAt))
      .limit(100);
    const detailId = parseId(req.query.threadId);
    let messages: any[] = [];
    if (detailId) {
      const owns = threads.find((t) => t.id === detailId);
      if (owns) {
        messages = await db.select().from(concertMessages).where(eq(concertMessages.threadId, detailId)).orderBy(concertMessages.createdAt);
        if ((owns.artistUnread ?? 0) > 0) {
          await db.update(concertThreads).set({ artistUnread: 0 }).where(eq(concertThreads.id, detailId));
        }
      }
    }
    res.json({
      success: true,
      threads: threads.map((t) => ({
        id: t.id, concertId: t.concertId, buyerEmail: t.buyerEmail, buyerName: t.buyerName,
        subject: t.subject, lastMessagePreview: t.lastMessagePreview, lastMessageAt: t.lastMessageAt,
        artistUnread: t.artistUnread, status: t.status,
      })),
      messages: messages.map((m) => ({ id: m.id, role: m.senderRole, body: m.body, createdAt: m.createdAt })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /threads failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load threads' });
  }
});

// Artist replies to a buyer thread
router.post('/:artistId/threads/:threadId/reply', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const threadId = parseId(req.params.threadId);
    if (!threadId) return res.status(400).json({ success: false, error: 'Invalid thread id' });
    const body = typeof req.body?.body === 'string' ? req.body.body.trim().slice(0, 2000) : '';
    if (!body) return res.status(400).json({ success: false, error: 'Message is empty' });
    const [thread] = await db.select().from(concertThreads).where(eq(concertThreads.id, threadId)).limit(1);
    if (!thread || thread.artistId !== artistId) return res.status(404).json({ success: false, error: 'Thread not found' });

    await db.insert(concertMessages).values({ threadId, senderRole: 'artist', body });
    await db.update(concertThreads).set({
      lastMessagePreview: body.slice(0, 140),
      lastMessageAt: new Date(),
      buyerUnread: (thread.buyerUnread ?? 0) + 1,
      artistUnread: 0,
      updatedAt: new Date(),
    }).where(eq(concertThreads.id, threadId));
    res.json({ success: true, threadId });
  } catch (err: any) {
    console.error('[concerts] POST /reply failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to send reply' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// DISCOUNT / PRESALE CODES
// ─────────────────────────────────────────────────────────────────────

// Public: validate a code + preview the discount (used by the buy modal)
router.post('/event/:eventId/validate-code', async (req: Request, res: Response) => {
  try {
    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ success: false, error: 'Invalid event id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev) return res.status(404).json({ success: false, error: 'Event not found' });
    const subtotal = Math.max(0, Number(req.body?.subtotal) || 0);
    const { row, reason } = await resolveDiscount(ev.artistId, eventId, req.body?.code);
    if (!row) return res.json({ success: false, valid: false, error: reason || 'Código no válido' });
    const discount = subtotal > 0 ? applyDiscount(subtotal, row) : 0;
    res.json({
      success: true,
      valid: true,
      code: row.code,
      kind: row.kind,
      amount: Number(row.amount),
      isPresale: row.isPresale,
      discount,
      newTotal: Math.max(0, Math.round((subtotal - discount) * 100) / 100),
    });
  } catch (err: any) {
    console.error('[concerts] POST /validate-code failed:', err?.message);
    res.status(500).json({ success: false, error: 'Validation failed' });
  }
});

// Owner: list discount codes
router.get('/:artistId/discount-codes', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const rows = await db
      .select()
      .from(concertDiscountCodes)
      .where(eq(concertDiscountCodes.artistId, artistId))
      .orderBy(desc(concertDiscountCodes.createdAt));
    res.json({
      success: true,
      codes: rows.map((c) => ({
        id: c.id,
        concertId: c.concertId,
        code: c.code,
        kind: c.kind,
        amount: Number(c.amount),
        isPresale: c.isPresale,
        maxRedemptions: c.maxRedemptions,
        timesRedeemed: c.timesRedeemed,
        startsAt: c.startsAt instanceof Date ? c.startsAt.toISOString() : c.startsAt,
        endsAt: c.endsAt instanceof Date ? c.endsAt.toISOString() : c.endsAt,
        isActive: c.isActive,
      })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /discount-codes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load codes' });
  }
});

// Owner: create a discount code
router.post('/:artistId/discount-codes', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const b = req.body || {};
    const code = typeof b.code === 'string' ? b.code.trim().slice(0, 64) : '';
    if (!code) return res.status(400).json({ success: false, error: 'Código requerido' });
    const kind = b.kind === 'fixed' ? 'fixed' : 'percent';
    let amount = Math.max(0, Number(b.amount) || 0);
    if (kind === 'percent') amount = Math.min(100, amount);
    if (amount <= 0) return res.status(400).json({ success: false, error: 'El valor debe ser mayor que 0' });
    const concertId = b.concertId != null ? parseId(b.concertId) : null;
    const maxRedemptions = b.maxRedemptions != null && b.maxRedemptions !== '' ? (Math.max(1, parseInt(String(b.maxRedemptions), 10) || 0) || null) : null;
    try {
      const [created] = await db.insert(concertDiscountCodes).values({
        artistId,
        concertId: concertId ?? null,
        code,
        kind,
        amount: amount.toFixed(2),
        isPresale: Boolean(b.isPresale),
        maxRedemptions,
        startsAt: b.startsAt ? parseDate(b.startsAt) : null,
        endsAt: b.endsAt ? parseDate(b.endsAt) : null,
        isActive: true,
      }).returning();
      res.json({ success: true, code: created });
    } catch (e: any) {
      if (String(e?.message || '').includes('duplicate')) {
        return res.status(409).json({ success: false, error: 'Ya existe un código con ese nombre' });
      }
      throw e;
    }
  } catch (err: any) {
    console.error('[concerts] POST /discount-codes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to create code' });
  }
});

// Owner: toggle a discount code active flag
router.patch('/:artistId/discount-codes/:codeId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const codeId = parseId(req.params.codeId);
    if (!codeId) return res.status(400).json({ success: false, error: 'Invalid code id' });
    const [row] = await db.select().from(concertDiscountCodes).where(eq(concertDiscountCodes.id, codeId)).limit(1);
    if (!row || row.artistId !== artistId) return res.status(404).json({ success: false, error: 'Code not found' });
    const patch: any = {};
    if (typeof req.body?.isActive === 'boolean') patch.isActive = req.body.isActive;
    if (Object.keys(patch).length) {
      await db.update(concertDiscountCodes).set(patch).where(eq(concertDiscountCodes.id, codeId));
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[concerts] PATCH /discount-codes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to update code' });
  }
});

router.delete('/:artistId/discount-codes/:codeId', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const codeId = parseId(req.params.codeId);
    if (!codeId) return res.status(400).json({ success: false, error: 'Invalid code id' });
    const [row] = await db.select().from(concertDiscountCodes).where(eq(concertDiscountCodes.id, codeId)).limit(1);
    if (!row || row.artistId !== artistId) return res.status(404).json({ success: false, error: 'Code not found' });
    await db.delete(concertDiscountCodes).where(eq(concertDiscountCodes.id, codeId));
    res.json({ success: true });
  } catch (err: any) {
    console.error('[concerts] DELETE /discount-codes failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to delete code' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// WAITLIST (sold-out / pre-on-sale demand capture)
// ─────────────────────────────────────────────────────────────────────

// Public: a fan joins the waitlist for an event
router.post('/:artistId/events/:eventId/waitlist', async (req: Request, res: Response) => {
  try {
    const artistId = parseId(req.params.artistId);
    const eventId = parseId(req.params.eventId);
    if (!artistId || !eventId) return res.status(400).json({ success: false, error: 'Invalid id' });
    const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, eventId)).limit(1);
    if (!ev || ev.artistId !== artistId) return res.status(404).json({ success: false, error: 'Event not found' });
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ success: false, error: 'Email válido requerido' });
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 120) : null;
    const city = typeof req.body?.city === 'string' ? req.body.city.trim().slice(0, 120) : null;
    const quantity = Math.max(1, Math.min(20, parseInt(String(req.body?.quantity), 10) || 1));
    try {
      await db.insert(concertWaitlist).values({ concertId: eventId, artistId, email, name, city, quantity, status: 'waiting' });
    } catch (e: any) {
      if (String(e?.message || '').includes('duplicate')) {
        return res.json({ success: true, alreadyOnList: true });
      }
      throw e;
    }
    res.json({ success: true });
  } catch (err: any) {
    console.error('[concerts] POST /waitlist failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to join waitlist' });
  }
});

// Owner: read the waitlist + demand-by-city for the artist's events
router.get('/:artistId/waitlist', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = req.query.eventId ? parseId(req.query.eventId) : null;
    const cond = eventId
      ? and(eq(concertWaitlist.artistId, artistId), eq(concertWaitlist.concertId, eventId))
      : eq(concertWaitlist.artistId, artistId);
    const rows = await db.select().from(concertWaitlist).where(cond).orderBy(desc(concertWaitlist.createdAt));
    const byCity: Record<string, number> = {};
    let totalDemand = 0;
    for (const r of rows) {
      totalDemand += r.quantity ?? 1;
      const c = (r.city || 'Sin ciudad').trim();
      byCity[c] = (byCity[c] || 0) + (r.quantity ?? 1);
    }
    res.json({
      success: true,
      total: rows.length,
      totalDemand,
      byCity: Object.entries(byCity).map(([city, demand]) => ({ city, demand })).sort((a, b) => b.demand - a.demand),
      entries: rows.map((r) => ({
        id: r.id,
        concertId: r.concertId,
        email: r.email,
        name: r.name,
        quantity: r.quantity,
        city: r.city,
        status: r.status,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    });
  } catch (err: any) {
    console.error('[concerts] GET /waitlist failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load waitlist' });
  }
});

// ─────────────────────────────────────────────────────────────────────
// SALES ANALYTICS
// ─────────────────────────────────────────────────────────────────────

// Owner: aggregate sales analytics across the artist's events
router.get('/:artistId/analytics', isAuthenticated, async (req: Request, res: Response) => {
  const artistId = await guardOwner(req, res);
  if (artistId == null) return;
  try {
    const eventId = req.query.eventId ? parseId(req.query.eventId) : null;
    const baseCond = eventId
      ? and(eq(concertOrders.artistId, artistId), eq(concertOrders.concertId, eventId), eq(concertOrders.status, 'completed'))
      : and(eq(concertOrders.artistId, artistId), eq(concertOrders.status, 'completed'));
    const orders = await db.select().from(concertOrders).where(baseCond);

    let grossRevenue = 0;
    let netEarning = 0;
    let ticketsSold = 0;
    let discountTotal = 0;
    const byDevice: Record<string, number> = {};
    const byTier: Record<string, { name: string; tickets: number; revenue: number }> = {};
    const byDay: Record<string, { revenue: number; tickets: number }> = {};
    const byCountry: Record<string, number> = {};

    for (const o of orders) {
      grossRevenue += Number(o.subtotal) || 0;
      netEarning += Number(o.artistEarning) || 0;
      discountTotal += Number(o.discountAmount) || 0;
      ticketsSold += o.quantity ?? 0;
      const dev = o.buyerDevice || 'desconocido';
      byDevice[dev] = (byDevice[dev] || 0) + 1;
      if (o.buyerCountry) byCountry[o.buyerCountry] = (byCountry[o.buyerCountry] || 0) + (o.quantity ?? 0);
      const day = (o.createdAt instanceof Date ? o.createdAt : new Date(o.createdAt as any)).toISOString().slice(0, 10);
      byDay[day] = byDay[day] || { revenue: 0, tickets: 0 };
      byDay[day].revenue += Number(o.subtotal) || 0;
      byDay[day].tickets += o.quantity ?? 0;
      const items = Array.isArray(o.items) ? (o.items as any[]) : [];
      for (const it of items) {
        if (it?.kind === 'addon') continue;
        const key = String(it.tierId ?? it.name ?? 'tier');
        byTier[key] = byTier[key] || { name: it.name || 'Entrada', tickets: 0, revenue: 0 };
        byTier[key].tickets += parseInt(String(it.quantity), 10) || 0;
        byTier[key].revenue += (Number(it.unitPrice) || 0) * (parseInt(String(it.quantity), 10) || 0);
      }
    }

    res.json({
      success: true,
      summary: {
        orders: orders.length,
        ticketsSold,
        grossRevenue: Math.round(grossRevenue * 100) / 100,
        netEarning: Math.round(netEarning * 100) / 100,
        discountTotal: Math.round(discountTotal * 100) / 100,
        avgOrderValue: orders.length ? Math.round((grossRevenue / orders.length) * 100) / 100 : 0,
      },
      byTier: Object.values(byTier).sort((a, b) => b.revenue - a.revenue),
      byDay: Object.entries(byDay).map(([day, v]) => ({ day, ...v })).sort((a, b) => a.day.localeCompare(b.day)),
      byDevice: Object.entries(byDevice).map(([device, count]) => ({ device, count })).sort((a, b) => b.count - a.count),
      byCountry: Object.entries(byCountry).map(([country, tickets]) => ({ country, tickets })).sort((a, b) => b.tickets - a.tickets),
    });
  } catch (err: any) {
    console.error('[concerts] GET /analytics failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load analytics' });
  }
});

export default router;

/**
 * Webhook helper — fulfil a paid concert ticket order.
 * Idempotent: only transitions a pending order to completed once, increments
 * sold counters, mints one signed anti-fraud pass per admitted ticket unit, and
 * stamps a legacy ticket/QR code. Imported by webhook-stripe.ts.
 */
export async function fulfilConcertOrder(sessionId: string, paid: boolean): Promise<void> {
  if (!sessionId) return;
  const [order] = await db.select().from(concertOrders).where(eq(concertOrders.stripePaymentId, sessionId)).limit(1);
  if (!order) {
    console.warn('[concerts] fulfilConcertOrder: no order for session', sessionId);
    return;
  }
  if (order.status === 'completed') return; // already fulfilled

  if (!paid) {
    await db.update(concertOrders).set({ status: 'cancelled' }).where(eq(concertOrders.id, order.id));
    return;
  }

  const code = ticketCode(order.id);
  await db.update(concertOrders).set({ status: 'completed', qrCode: code }).where(eq(concertOrders.id, order.id));

  // Backfill the buyer lead from Stripe's collected details (phone / country)
  // when the on-site form left them blank. Best-effort, never blocks fulfilment.
  if (stripe) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const cd: any = (session as any)?.customer_details || {};
      const backfill: Record<string, any> = {};
      if (!order.buyerPhone && cd.phone) backfill.buyerPhone = String(cd.phone).slice(0, 40);
      if (!order.buyerName && cd.name) backfill.buyerName = String(cd.name).slice(0, 120);
      if (!order.buyerCountry && cd.address?.country) backfill.buyerCountry = String(cd.address.country).slice(0, 8);
      if (!order.buyerCity && cd.address?.city) backfill.buyerCity = String(cd.address.city).slice(0, 120);
      if (Object.keys(backfill).length) {
        await db.update(concertOrders).set(backfill).where(eq(concertOrders.id, order.id));
      }
    } catch (e: any) {
      console.warn('[concerts] lead backfill from Stripe failed:', e?.message);
    }
  }

  // Count a redemption for the promo/presale code used on this order.
  if (order.discountCode) {
    try {
      await db
        .update(concertDiscountCodes)
        .set({ timesRedeemed: sql`${concertDiscountCodes.timesRedeemed} + 1` })
        .where(and(
          eq(concertDiscountCodes.artistId, order.artistId),
          sql`LOWER(${concertDiscountCodes.code}) = ${String(order.discountCode).toLowerCase()}`,
        ));
    } catch (e: any) {
      console.warn('[concerts] discount redemption increment failed:', e?.message);
    }
  }

  // Increment sold counters per tier + mint one signed pass per admitted unit.
  const items = Array.isArray(order.items) ? (order.items as any[]) : [];
  const passRows: Array<typeof concertTicketPasses.$inferInsert> = [];

  // Reserved-seating orders mint one signed pass PER seat and mark each seat
  // sold (handled in the seat-map engine so all seat logic lives in one place).
  const orderSeatIds = Array.isArray((order as any).seatIds) ? (order as any).seatIds : [];
  if (orderSeatIds.length) {
    try {
      const minted = await mintReservedSeatPasses(order as any);
      console.log(`🎫 Concert order #${order.id} fulfilled (reserved seating, ${minted} seat passes, code ${code})`);
    } catch (e: any) {
      console.error('[concerts] mintReservedSeatPasses failed:', e?.message);
    }
  } else {
  for (const it of items) {
    if (it?.kind === 'addon') continue; // merch add-ons are not gate passes
    const tierId = parseId(it.tierId);
    const qty = parseInt(String(it.quantity), 10) || 0;
    if (qty <= 0) continue;
    if (tierId) {
      await db
        .update(concertTicketTiers)
        .set({ quantitySold: sql`${concertTicketTiers.quantitySold} + ${qty}` })
        .where(eq(concertTicketTiers.id, tierId));
    }
    for (let i = 0; i < qty; i++) {
      const passCode = generatePassCode();
      const signature = signPass({ passCode, orderId: order.id, concertId: order.concertId, tierId: tierId ?? null });
      passRows.push({
        orderId: order.id,
        concertId: order.concertId,
        artistId: order.artistId,
        tierId: tierId ?? null,
        tierName: typeof it.name === 'string' ? it.name.slice(0, 80) : null,
        buyerEmail: order.buyerEmail,
        buyerName: order.buyerName,
        passCode,
        signature,
        status: 'valid',
      });
    }
  }

  // Idempotency guard: only mint if this order has no passes yet.
  if (passRows.length) {
    const existing = await db
      .select({ id: concertTicketPasses.id })
      .from(concertTicketPasses)
      .where(eq(concertTicketPasses.orderId, order.id))
      .limit(1);
    if (!existing.length) {
      await db.insert(concertTicketPasses).values(passRows);
    }
  }

  console.log(`🎫 Concert order #${order.id} fulfilled (${order.quantity} tickets, ${passRows.length} passes, code ${code})`);
  }

  // Best-effort buyer confirmation email with a link back to "My Tickets"
  // and a real, scannable QR code embedded for every ticket.
  if (order.buyerEmail) {
    try {
      const [ev] = await db.select().from(concertEvents).where(eq(concertEvents.id, order.concertId)).limit(1);
      const when = ev?.startsAt ? new Date(ev.startsAt).toLocaleString('es-ES', { dateStyle: 'long', timeStyle: 'short' }) : '';
      const ticketsUrl = `${(process.env.PRODUCTION_URL || process.env.APP_URL || 'https://boostifymusic.com').replace(/\/$/, '')}/my-tickets?email=${encodeURIComponent(order.buyerEmail)}`;

      // Pull the persisted passes (works whether minted just now or previously)
      // and render one scannable QR per pass — the QR encodes the exact signed
      // token the door scanner validates.
      const passes = await db
        .select()
        .from(concertTicketPasses)
        .where(eq(concertTicketPasses.orderId, order.id));
      let qrHtml = '';
      if (passes.length) {
        const cards = passes.map((p, i) => {
          const token = buildPassToken(p.passCode, p.signature);
          const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(token)}`;
          const tierLabel = p.tierName ? String(p.tierName) : `Entrada ${i + 1}`;
          return `
            <td align="center" valign="top" style="padding:10px;">
              <div style="background:#ffffff;border:1px solid #e6e6e6;border-radius:14px;padding:16px;display:inline-block;">
                <div style="font:600 13px/1.2 Arial,Helvetica,sans-serif;color:#111;margin-bottom:10px;">${tierLabel}</div>
                <img src="${qrSrc}" width="180" height="180" alt="QR entrada ${i + 1}" style="display:block;width:180px;height:180px;border-radius:8px;" />
                <div style="font:500 11px/1.4 'Courier New',monospace;color:#888;margin-top:10px;letter-spacing:1px;">${p.passCode}</div>
              </div>
            </td>`;
        });
        // 2 QR cards per row
        const rows: string[] = [];
        for (let i = 0; i < cards.length; i += 2) {
          rows.push(`<tr>${cards[i] || ''}${cards[i + 1] || ''}</tr>`);
        }
        qrHtml = `
          <br/>
          <div style="font:700 15px/1.3 Arial,Helvetica,sans-serif;color:#111;margin:18px 0 6px;">🎟️ Tus entradas</div>
          <div style="font:400 13px/1.5 Arial,Helvetica,sans-serif;color:#555;margin-bottom:10px;">Presenta cada código QR en la puerta (desde el móvil o impreso).</div>
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tbody>${rows.join('')}</tbody></table>`;
      }

      const lines = [
        `Tu compra para <strong>${ev?.title || 'el evento'}</strong> está confirmada.`,
        when ? `📅 ${when}` : '',
        ev?.venue ? `📍 ${ev.venue}${ev.location ? ', ' + ev.location : ''}` : '',
        `🎫 ${order.quantity} entrada${order.quantity === 1 ? '' : 's'} · Total $${Number(order.subtotal).toFixed(2)}`,
        `Código de confirmación: <strong>${code}</strong>`,
        qrHtml,
        ev?.refundPolicy ? `<br/><span style="font-size:12px;color:#888"><strong>Política de reembolso:</strong> ${ev.refundPolicy}</span>` : '',
      ].filter(Boolean);
      await sendNotificationEmail(
        order.buyerEmail,
        `🎫 Entradas confirmadas — ${ev?.title || 'Boostify'}`,
        '¡Tu compra está confirmada!',
        lines.join('<br/>'),
        'Ver mis entradas',
        ticketsUrl,
      );
    } catch (e: any) {
      console.warn('[concerts] confirmation email failed:', e?.message);
    }
  }
}

/**
 * Webhook helper — void a concert order after a refund or dispute.
 * Marks the order refunded, voids all its passes (so they can never scan
 * again), and rolls back the per-tier sold counters. Idempotent.
 */
export async function voidConcertOrderBySession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  const [order] = await db.select().from(concertOrders).where(eq(concertOrders.stripePaymentId, sessionId)).limit(1);
  if (!order) {
    console.warn('[concerts] voidConcertOrderBySession: no order for session', sessionId);
    return;
  }
  if (order.status === 'refunded') return; // already voided

  // Roll back sold counters only if the order had been completed.
  if (order.status === 'completed') {
    const items = Array.isArray(order.items) ? (order.items as any[]) : [];
    for (const it of items) {
      if (it?.kind === 'addon') continue;
      const tierId = parseId(it.tierId);
      const qty = parseInt(String(it.quantity), 10) || 0;
      if (tierId && qty > 0) {
        await db
          .update(concertTicketTiers)
          .set({ quantitySold: sql`GREATEST(0, ${concertTicketTiers.quantitySold} - ${qty})` })
          .where(eq(concertTicketTiers.id, tierId));
      }
    }
  }

  await db.update(concertOrders).set({ status: 'refunded' }).where(eq(concertOrders.id, order.id));
  await db
    .update(concertTicketPasses)
    .set({ status: 'void' })
    .where(and(eq(concertTicketPasses.orderId, order.id), eq(concertTicketPasses.status, 'valid')));

  console.log(`↩️ Concert order #${order.id} refunded — passes voided`);
}
