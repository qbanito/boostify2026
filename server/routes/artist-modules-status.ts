/**
 * Artist Modules Status — unified snapshot of the 6 artist modules
 * (Sponsor Acquisition, Venue Booking, Exclusive Content, AAS Engine,
 *  Viral Product Ads, Brand Collaborations).
 *
 * GET /api/artist-modules/status/:artistId
 *   → { modules: { [moduleId]: { healthy, counts, lastActivity } }, summary }
 *
 * Each module subquery is wrapped in try/catch so one broken table never
 * poisons the whole endpoint — missing tables return `healthy:false`.
 */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { sql } from 'drizzle-orm';

const router = Router();

interface ModuleStatus {
  healthy: boolean;
  counts: Record<string, number>;
  lastActivity: string | null;
  error?: string;
}

async function safeQuery<T = any>(label: string, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  try {
    const value = await fn();
    return { ok: true, value };
  } catch (err: any) {
    console.warn(`[artist-modules-status] ${label} failed:`, err?.message || err);
    return { ok: false, error: err?.message || 'unknown' };
  }
}

router.get('/status/:artistId', async (req: Request, res: Response) => {
  const artistId = Number(req.params.artistId);
  if (!Number.isFinite(artistId) || artistId <= 0) {
    return res.status(400).json({ success: false, error: 'Invalid artistId' });
  }

  const out: Record<string, ModuleStatus> = {};

  // Sponsor Acquisition
  {
    const r = await safeQuery('sponsor', async () => {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('proposed','viewed')) AS open_deals,
          COUNT(*) FILTER (WHERE status IN ('accepted','active','payment_pending')) AS won_deals,
          COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_deals,
          MAX(updated_at) AS last_activity
        FROM sponsor_deals WHERE artist_id = ${artistId}
      `);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || {};
      return {
        openDeals: Number(row.open_deals || 0),
        wonDeals: Number(row.won_deals || 0),
        rejectedDeals: Number(row.rejected_deals || 0),
        lastActivity: row.last_activity || null,
      };
    });
    out['sponsor-acquisition'] = r.ok
      ? { healthy: true, counts: { open: r.value.openDeals, won: r.value.wonDeals, rejected: r.value.rejectedDeals }, lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  // Venue Booking
  {
    const r = await safeQuery('venue', async () => {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('proposed','viewed','negotiating')) AS open_deals,
          COUNT(*) FILTER (WHERE status IN ('confirmed','performed')) AS confirmed_deals,
          MAX(updated_at) AS last_activity
        FROM venue_booking_deals WHERE artist_id = ${artistId}
      `);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || {};
      return {
        openDeals: Number(row.open_deals || 0),
        confirmedDeals: Number(row.confirmed_deals || 0),
        lastActivity: row.last_activity || null,
      };
    });
    out['venue-booking'] = r.ok
      ? { healthy: true, counts: { open: r.value.openDeals, confirmed: r.value.confirmedDeals }, lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  // Exclusive Content
  {
    const r = await safeQuery('explicit', async () => {
      const rows = await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM explicit_content WHERE artist_id = ${artistId}) AS content_count,
          (SELECT COUNT(*) FROM explicit_subscriptions WHERE artist_id = ${artistId} AND status = 'active') AS active_subs,
          (SELECT COUNT(*) FROM explicit_purchases WHERE artist_id = ${artistId}) AS total_purchases,
          (SELECT MAX(created_at) FROM explicit_content WHERE artist_id = ${artistId}) AS last_activity
      `);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || {};
      return {
        content: Number(row.content_count || 0),
        subs: Number(row.active_subs || 0),
        purchases: Number(row.total_purchases || 0),
        lastActivity: row.last_activity || null,
      };
    });
    out['exclusive-content'] = r.ok
      ? { healthy: true, counts: { content: r.value.content, subs: r.value.subs, purchases: r.value.purchases }, lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  // AAS Engine
  {
    const r = await safeQuery('aas', async () => {
      const rows = await db.execute(sql`
        SELECT enabled, survival_score, last_cycle_at
          FROM aas_config WHERE artist_id = ${artistId} LIMIT 1
      `);
      const cfg = (rows as any).rows?.[0] || (rows as any)[0] || null;
      if (!cfg) return { configured: false, enabled: false, score: 0, lastActivity: null };
      return {
        configured: true,
        enabled: Boolean(cfg.enabled),
        score: Number(cfg.survival_score || 0),
        lastActivity: cfg.last_cycle_at || null,
      };
    });
    out['aas-engine'] = r.ok
      ? { healthy: true, counts: { configured: r.value.configured ? 1 : 0, enabled: r.value.enabled ? 1 : 0, survivalScore: r.value.score }, lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  // Viral Product Ads — no dedicated DB table yet, status comes from the service
  out['viral-product-ads'] = {
    healthy: Boolean(process.env.FAL_KEY || process.env.FAL_AI_KEY),
    counts: { aiConfigured: (process.env.FAL_KEY || process.env.FAL_AI_KEY) ? 1 : 0 },
    lastActivity: null,
  };

  // Brand Collaborations
  {
    const r = await safeQuery('brand', async () => {
      const rows = await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('pending_payment')) AS pending,
          COUNT(*) FILTER (WHERE status IN ('active','content_ready','approved','published')) AS active,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          MAX(updated_at) AS last_activity
        FROM brand_campaigns WHERE artist_id = ${artistId}
      `);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || {};
      return {
        pending: Number(row.pending || 0),
        active: Number(row.active || 0),
        completed: Number(row.completed || 0),
        lastActivity: row.last_activity || null,
      };
    });
    out['brand-collaborations'] = r.ok
      ? { healthy: true, counts: { pending: r.value.pending, active: r.value.active, completed: r.value.completed }, lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  // AI Career Suite (per-artist Elite tier, admin-approved)
  {
    const r = await safeQuery('career-suite', async () => {
      const rows = await db.execute(sql`
        SELECT
          (SELECT status FROM artist_suite_subscriptions WHERE artist_id = ${String(artistId)} LIMIT 1) AS sub_status,
          (SELECT COUNT(*) FROM artist_suite_threads WHERE artist_id = ${String(artistId)}) AS thread_count,
          (SELECT MAX(created_at) FROM artist_suite_threads WHERE artist_id = ${String(artistId)}) AS last_activity
      `);
      const row = (rows as any).rows?.[0] || (rows as any)[0] || {};
      return {
        status: row.sub_status || 'inactive',
        threads: Number(row.thread_count || 0),
        lastActivity: row.last_activity || null,
      };
    });
    out['career-suite'] = r.ok
      ? {
          healthy: r.value.status === 'approved' || r.value.status === 'active',
          counts: { status: r.value.status, threads: r.value.threads },
          lastActivity: r.value.lastActivity ? new Date(r.value.lastActivity).toISOString() : null,
        }
      : { healthy: false, counts: {}, lastActivity: null, error: r.error };
  }

  const healthyCount = Object.values(out).filter((m) => m.healthy).length;
  res.json({
    success: true,
    artistId,
    modules: out,
    summary: {
      totalModules: Object.keys(out).length,
      healthy: healthyCount,
      unhealthy: Object.keys(out).length - healthyCount,
    },
  });
});

export default router;
