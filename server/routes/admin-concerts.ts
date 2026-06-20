/**
 * Admin · Concert Command Center
 * ==============================
 * Mounted at /api/admin/concerts (requireAdmin).
 *
 *   GET  /settings       — current commission config + per-artist overrides
 *   POST /settings       — update global rate (10–30%) and/or per-artist overrides
 *   GET  /transactions   — recent concert ticket orders (commission split)
 *   GET  /events         — all concert events across the platform
 *   GET  /summary        — revenue + commission KPIs
 */
import { Router, Request, Response } from 'express';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { concertEvents, concertOrders, users } from '../db/schema';
import { requireAdmin } from '../middleware/require-admin';
import {
  getCommissionConfig,
  saveCommissionConfig,
  COMMISSION_MIN,
  COMMISSION_MAX,
  COMMISSION_DEFAULT,
} from '../services/concert-commission';

const router = Router();
router.use(requireAdmin);

async function resolveAdminUserId(req: Request): Promise<number | undefined> {
  const email = (req as any).adminEmail
    || (req as any).auth?.sessionClaims?.email
    || (req as any).user?.email;
  if (!email) return undefined;
  try {
    const rows = await db.select({ id: users.id }).from(users).where(eq(users.email, String(email).toLowerCase())).limit(1);
    return rows[0]?.id;
  } catch {
    return undefined;
  }
}

// ── GET /settings ─────────────────────────────────────────────────────────
router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const config = await getCommissionConfig();

    // Resolve artist names for the override keys so the UI can show who's who.
    const ids = Object.keys(config.overrides).map((k) => parseInt(k, 10)).filter((n) => !isNaN(n));
    let overrideArtists: Array<{ artistId: number; name: string; rate: number }> = [];
    if (ids.length) {
      const rows = await db
        .select({ id: users.id, artistName: users.artistName, username: users.username })
        .from(users)
        .where(sql`${users.id} = ANY(${ids})`);
      overrideArtists = ids.map((id) => {
        const u = rows.find((r) => r.id === id);
        return {
          artistId: id,
          name: u?.artistName || u?.username || `Artist #${id}`,
          rate: config.overrides[String(id)],
        };
      });
    }

    res.json({
      success: true,
      config,
      overrideArtists,
      bounds: { min: COMMISSION_MIN, max: COMMISSION_MAX, default: COMMISSION_DEFAULT },
    });
  } catch (err: any) {
    console.error('[admin-concerts] GET /settings failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load commission settings' });
  }
});

// ── POST /settings ────────────────────────────────────────────────────────
router.post('/settings', async (req: Request, res: Response) => {
  try {
    const { globalRate, overrides } = req.body || {};
    const updatedBy = await resolveAdminUserId(req);
    const config = await saveCommissionConfig(
      {
        globalRate: globalRate != null ? Number(globalRate) : undefined,
        overrides: overrides && typeof overrides === 'object' ? overrides : undefined,
      },
      updatedBy,
    );
    res.json({ success: true, config });
  } catch (err: any) {
    console.error('[admin-concerts] POST /settings failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to save commission settings' });
  }
});

// ── GET /transactions ─────────────────────────────────────────────────────
router.get('/transactions', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50));
    const rows = await db
      .select({
        id: concertOrders.id,
        concertId: concertOrders.concertId,
        artistId: concertOrders.artistId,
        buyerEmail: concertOrders.buyerEmail,
        buyerName: concertOrders.buyerName,
        quantity: concertOrders.quantity,
        subtotal: concertOrders.subtotal,
        commissionRate: concertOrders.commissionRate,
        platformFee: concertOrders.platformFee,
        artistEarning: concertOrders.artistEarning,
        currency: concertOrders.currency,
        status: concertOrders.status,
        createdAt: concertOrders.createdAt,
        eventTitle: concertEvents.title,
        artistName: users.artistName,
      })
      .from(concertOrders)
      .leftJoin(concertEvents, eq(concertOrders.concertId, concertEvents.id))
      .leftJoin(users, eq(concertOrders.artistId, users.id))
      .orderBy(desc(concertOrders.createdAt))
      .limit(limit);
    res.json({ success: true, transactions: rows });
  } catch (err: any) {
    console.error('[admin-concerts] GET /transactions failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load transactions' });
  }
});

// ── GET /events ───────────────────────────────────────────────────────────
router.get('/events', async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: concertEvents.id,
        artistId: concertEvents.artistId,
        title: concertEvents.title,
        type: concertEvents.type,
        status: concertEvents.status,
        startsAt: concertEvents.startsAt,
        venue: concertEvents.venue,
        location: concertEvents.location,
        createdAt: concertEvents.createdAt,
        artistName: users.artistName,
      })
      .from(concertEvents)
      .leftJoin(users, eq(concertEvents.artistId, users.id))
      .orderBy(desc(concertEvents.createdAt))
      .limit(200);
    res.json({ success: true, events: rows });
  } catch (err: any) {
    console.error('[admin-concerts] GET /events failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load events' });
  }
});

// ── GET /summary ──────────────────────────────────────────────────────────
router.get('/summary', async (_req: Request, res: Response) => {
  try {
    const [agg] = await db
      .select({
        orders: sql<number>`count(*)`,
        gross: sql<string>`coalesce(sum(${concertOrders.subtotal}), 0)`,
        platform: sql<string>`coalesce(sum(${concertOrders.platformFee}), 0)`,
        artist: sql<string>`coalesce(sum(${concertOrders.artistEarning}), 0)`,
      })
      .from(concertOrders)
      .where(eq(concertOrders.status, 'completed'));
    const [eventsAgg] = await db
      .select({ total: sql<number>`count(*)` })
      .from(concertEvents);
    res.json({
      success: true,
      summary: {
        completedOrders: Number(agg?.orders || 0),
        grossRevenue: Number(agg?.gross || 0),
        platformRevenue: Number(agg?.platform || 0),
        artistPayouts: Number(agg?.artist || 0),
        totalEvents: Number(eventsAgg?.total || 0),
      },
    });
  } catch (err: any) {
    console.error('[admin-concerts] GET /summary failed:', err?.message);
    res.status(500).json({ success: false, error: 'Failed to load summary' });
  }
});

export default router;
