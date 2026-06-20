/**
 * Merch Analytics API — Real data from salesTransactions + platformRevenue + Printful API
 * 
 * Endpoints:
 *   GET /overview        — KPI summary (revenue, orders, products, margins)
 *   GET /sales-trend     — Time-series sales data (daily/weekly/monthly)
 *   GET /top-products    — Best-selling products from salesTransactions
 *   GET /recent-sales    — Latest sales with buyer info
 *   GET /revenue-split   — Artist vs Platform earnings breakdown
 */

import { Router, type Request, type Response } from 'express';
import { db } from '../db';
import { salesTransactions, platformRevenue, users } from '../db/schema';
import { desc, eq, gte, sql, count, sum, avg, and } from 'drizzle-orm';

const router = Router();

// ─── GET /overview — KPIs summary ────────────────────────────────────────────
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const allTime = await db
      .select({
        totalSales: count(),
        totalRevenue: sum(salesTransactions.saleAmount),
        totalProductionCost: sum(salesTransactions.productionCost),
        totalArtistEarnings: sum(salesTransactions.artistEarning),
        totalPlatformFees: sum(salesTransactions.platformFee),
        totalQuantity: sum(salesTransactions.quantity),
        avgOrderValue: avg(salesTransactions.saleAmount),
      })
      .from(salesTransactions);

    const s = allTime[0];

    // Last-30-day totals
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const last30 = await db
      .select({
        totalSales: count(),
        totalRevenue: sum(salesTransactions.saleAmount),
      })
      .from(salesTransactions)
      .where(gte(salesTransactions.createdAt, thirtyDaysAgo));

    const prev30 = await db
      .select({
        totalSales: count(),
        totalRevenue: sum(salesTransactions.saleAmount),
      })
      .from(salesTransactions)
      .where(and(
        gte(salesTransactions.createdAt, sixtyDaysAgo),
        sql`${salesTransactions.createdAt} < ${thirtyDaysAgo}`
      ));

    const l = last30[0];
    const p = prev30[0];

    const revTrend = Number(p?.totalRevenue || 0) > 0
      ? ((Number(l?.totalRevenue || 0) - Number(p?.totalRevenue || 0)) / Number(p.totalRevenue!) * 100).toFixed(1)
      : '0';
    const salesTrend = Number(p?.totalSales || 0) > 0
      ? ((Number(l?.totalSales || 0) - Number(p?.totalSales || 0)) / Number(p.totalSales) * 100).toFixed(1)
      : '0';

    // Status breakdown
    const statusBreakdown = await db
      .select({
        status: salesTransactions.status,
        count: count(),
      })
      .from(salesTransactions)
      .groupBy(salesTransactions.status);

    // Unique buyers
    const buyers = await db
      .select({ count: sql<string>`count(distinct ${salesTransactions.buyerEmail})` })
      .from(salesTransactions);

    res.json({
      allTime: {
        totalSales: Number(s?.totalSales || 0),
        totalRevenue: Number(s?.totalRevenue || 0),
        totalProductionCost: Number(s?.totalProductionCost || 0),
        totalArtistEarnings: Number(s?.totalArtistEarnings || 0),
        totalPlatformFees: Number(s?.totalPlatformFees || 0),
        totalQuantity: Number(s?.totalQuantity || 0),
        avgOrderValue: Number(s?.avgOrderValue || 0),
      },
      last30Days: {
        totalSales: Number(l?.totalSales || 0),
        totalRevenue: Number(l?.totalRevenue || 0),
        revenueTrend: revTrend,
        salesTrend: salesTrend,
      },
      statusBreakdown: statusBreakdown.reduce((acc, r) => {
        acc[r.status || 'unknown'] = Number(r.count);
        return acc;
      }, {} as Record<string, number>),
      uniqueBuyers: Number(buyers[0]?.count || 0),
    });
  } catch (err) {
    console.error('[merch-analytics] overview error:', err);
    res.status(500).json({ error: 'Failed to load analytics overview' });
  }
});

// ─── GET /sales-trend — Time-series ──────────────────────────────────────────
router.get('/sales-trend', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as string) || '30d';
    let days = 30;
    if (period === '7d') days = 7;
    if (period === '90d') days = 90;
    if (period === '1y') days = 365;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const rows = await db
      .select({
        date: sql<string>`to_char(${salesTransactions.createdAt}, 'YYYY-MM-DD')`,
        totalRevenue: sum(salesTransactions.saleAmount),
        totalSales: count(),
        totalPlatformFees: sum(salesTransactions.platformFee),
      })
      .from(salesTransactions)
      .where(gte(salesTransactions.createdAt, startDate))
      .groupBy(sql`to_char(${salesTransactions.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`to_char(${salesTransactions.createdAt}, 'YYYY-MM-DD')`);

    // Fill missing dates with zeros
    const dateMap = new Map<string, { revenue: number; sales: number; fees: number }>();
    for (const r of rows) {
      dateMap.set(r.date, {
        revenue: Number(r.totalRevenue || 0),
        sales: Number(r.totalSales || 0),
        fees: Number(r.totalPlatformFees || 0),
      });
    }

    const trend: { date: string; revenue: number; sales: number; fees: number }[] = [];
    const cur = new Date(startDate);
    const now = new Date();
    while (cur <= now) {
      const key = cur.toISOString().split('T')[0];
      const entry = dateMap.get(key);
      trend.push({
        date: key,
        revenue: entry?.revenue || 0,
        sales: entry?.sales || 0,
        fees: entry?.fees || 0,
      });
      cur.setDate(cur.getDate() + 1);
    }

    res.json({ period, trend });
  } catch (err) {
    console.error('[merch-analytics] sales-trend error:', err);
    res.status(500).json({ error: 'Failed to load sales trend' });
  }
});

// ─── GET /top-products — Best sellers ────────────────────────────────────────
router.get('/top-products', async (_req: Request, res: Response) => {
  try {
    const products = await db
      .select({
        productName: salesTransactions.productName,
        totalQuantity: sum(salesTransactions.quantity),
        totalRevenue: sum(salesTransactions.saleAmount),
        totalPlatformFees: sum(salesTransactions.platformFee),
        orderCount: count(),
      })
      .from(salesTransactions)
      .groupBy(salesTransactions.productName)
      .orderBy(desc(sum(salesTransactions.quantity)))
      .limit(10);

    res.json(products.map(p => ({
      productName: p.productName,
      totalQuantity: Number(p.totalQuantity || 0),
      totalRevenue: Number(p.totalRevenue || 0),
      totalPlatformFees: Number(p.totalPlatformFees || 0),
      orderCount: Number(p.orderCount || 0),
    })));
  } catch (err) {
    console.error('[merch-analytics] top-products error:', err);
    res.status(500).json({ error: 'Failed to load top products' });
  }
});

// ─── GET /recent-sales — Latest transactions ─────────────────────────────────
router.get('/recent-sales', async (_req: Request, res: Response) => {
  try {
    const sales = await db
      .select({
        id: salesTransactions.id,
        productName: salesTransactions.productName,
        saleAmount: salesTransactions.saleAmount,
        quantity: salesTransactions.quantity,
        artistEarning: salesTransactions.artistEarning,
        platformFee: salesTransactions.platformFee,
        buyerEmail: salesTransactions.buyerEmail,
        status: salesTransactions.status,
        createdAt: salesTransactions.createdAt,
        artistName: users.artistName,
      })
      .from(salesTransactions)
      .leftJoin(users, eq(salesTransactions.artistId, users.id))
      .orderBy(desc(salesTransactions.createdAt))
      .limit(50);

    // Mask buyer emails for privacy
    res.json(sales.map(s => ({
      ...s,
      saleAmount: Number(s.saleAmount),
      artistEarning: Number(s.artistEarning),
      platformFee: Number(s.platformFee),
      buyerEmail: s.buyerEmail
        ? s.buyerEmail.replace(/(.{2}).*(@.*)/, '$1***$2')
        : null,
    })));
  } catch (err) {
    console.error('[merch-analytics] recent-sales error:', err);
    res.status(500).json({ error: 'Failed to load recent sales' });
  }
});

// ─── GET /revenue-split — Artist vs Platform ─────────────────────────────────
router.get('/revenue-split', async (_req: Request, res: Response) => {
  try {
    // Per-artist breakdown
    const artistBreakdown = await db
      .select({
        artistId: salesTransactions.artistId,
        artistName: users.artistName,
        totalRevenue: sum(salesTransactions.saleAmount),
        totalArtistEarnings: sum(salesTransactions.artistEarning),
        totalPlatformFees: sum(salesTransactions.platformFee),
        totalSales: count(),
      })
      .from(salesTransactions)
      .leftJoin(users, eq(salesTransactions.artistId, users.id))
      .groupBy(salesTransactions.artistId, users.artistName)
      .orderBy(desc(sum(salesTransactions.saleAmount)));

    // Platform total from platformRevenue (if any merch entries)
    const platformTotal = await db
      .select({
        total: sum(platformRevenue.amount),
      })
      .from(platformRevenue)
      .where(eq(platformRevenue.revenueType, 'merch_commission'));

    res.json({
      byArtist: artistBreakdown.map(a => ({
        artistId: a.artistId,
        artistName: a.artistName || 'Unknown',
        totalRevenue: Number(a.totalRevenue || 0),
        totalArtistEarnings: Number(a.totalArtistEarnings || 0),
        totalPlatformFees: Number(a.totalPlatformFees || 0),
        totalSales: Number(a.totalSales || 0),
      })),
      platformMerchRevenue: Number(platformTotal[0]?.total || 0),
    });
  } catch (err) {
    console.error('[merch-analytics] revenue-split error:', err);
    res.status(500).json({ error: 'Failed to load revenue split' });
  }
});

export default router;