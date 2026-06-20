import { Router } from "express";
import { db } from "../db";
import {
  users,
  songs,
  subscriptions,
  salesTransactions,
  creditTransactions,
  musicVideoProjects,
  platformRevenue,
  walletTransactions,
  userCredits,
  courseEnrollments,
  bookings,
  merchandise,
  crowdfundingCampaigns,
  events,
} from "../db/schema";
import { eq, and, gte, lte, desc, sql, count, sum, avg } from "drizzle-orm";

const router = Router();

// ============================================
// GET /api/platform-analytics/overview
// Main KPI cards — real aggregated numbers
// ============================================
router.get("/overview", async (_req, res) => {
  try {
    // Total users
    const [usersCount] = await db.select({ total: count() }).from(users);

    // Total songs
    const [songsCount] = await db.select({ total: count() }).from(songs);

    // Total plays across all songs
    const [totalPlays] = await db
      .select({ total: sum(songs.plays) })
      .from(songs);

    // Active subscriptions
    const [activeSubs] = await db
      .select({ total: count() })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    // Total revenue from platform_revenue
    const [totalRevenue] = await db
      .select({ total: sum(platformRevenue.amount) })
      .from(platformRevenue);

    // Total sales transactions
    const [totalSales] = await db
      .select({
        total: count(),
        revenue: sum(salesTransactions.saleAmount),
        platformFees: sum(salesTransactions.platformFee),
      })
      .from(salesTransactions);

    // Credit transactions total
    const [creditsPurchased] = await db
      .select({ total: sum(creditTransactions.amount) })
      .from(creditTransactions)
      .where(eq(creditTransactions.type, "purchase"));

    // Music video projects
    const [videoProjects] = await db
      .select({ total: count() })
      .from(musicVideoProjects);

    // AI generated songs
    const [aiSongs] = await db
      .select({ total: count() })
      .from(songs)
      .where(eq(songs.generatedWithAI, true));

    // Merch products
    const [merchCount] = await db
      .select({ total: count() })
      .from(merchandise);

    // Courses enrollments
    const [enrollments] = await db
      .select({ total: count() })
      .from(courseEnrollments);

    res.json({
      totalUsers: Number(usersCount?.total || 0),
      totalSongs: Number(songsCount?.total || 0),
      totalPlays: Number(totalPlays?.total || 0),
      activeSubscriptions: Number(activeSubs?.total || 0),
      totalPlatformRevenue: Number(totalRevenue?.total || 0),
      totalSalesCount: Number(totalSales?.total || 0),
      totalSalesRevenue: Number(totalSales?.revenue || 0),
      totalPlatformFees: Number(totalSales?.platformFees || 0),
      creditsPurchased: Number(creditsPurchased?.total || 0),
      videoProjects: Number(videoProjects?.total || 0),
      aiGeneratedSongs: Number(aiSongs?.total || 0),
      merchProducts: Number(merchCount?.total || 0),
      courseEnrollments: Number(enrollments?.total || 0),
    });
  } catch (error) {
    console.error("Error fetching platform analytics overview:", error);
    res.status(500).json({ error: "Failed to fetch analytics overview" });
  }
});

// ============================================
// GET /api/platform-analytics/user-growth
// User registrations over time (by day)
// ============================================
router.get("/user-growth", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const growth = await db
      .select({
        date: sql<string>`DATE(${users.createdAt})`.as("date"),
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, startDate))
      .groupBy(sql`DATE(${users.createdAt})`)
      .orderBy(sql`DATE(${users.createdAt})`);

    // Cumulative total
    const [totalBefore] = await db
      .select({ total: count() })
      .from(users)
      .where(lte(users.createdAt, startDate));

    let cumulative = Number(totalBefore?.total || 0);
    const data = growth.map((row) => {
      cumulative += Number(row.count);
      return {
        date: row.date,
        newUsers: Number(row.count),
        totalUsers: cumulative,
      };
    });

    res.json(data);
  } catch (error) {
    console.error("Error fetching user growth:", error);
    res.status(500).json({ error: "Failed to fetch user growth" });
  }
});

// ============================================
// GET /api/platform-analytics/revenue-breakdown
// Revenue by type from platformRevenue table
// ============================================
router.get("/revenue-breakdown", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const breakdown = await db
      .select({
        revenueType: platformRevenue.revenueType,
        total: sum(platformRevenue.amount),
        count: count(),
      })
      .from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startDate))
      .groupBy(platformRevenue.revenueType)
      .orderBy(desc(sum(platformRevenue.amount)));

    res.json(
      breakdown.map((r) => ({
        type: r.revenueType,
        total: Number(r.total || 0),
        count: Number(r.count),
      }))
    );
  } catch (error) {
    console.error("Error fetching revenue breakdown:", error);
    res.status(500).json({ error: "Failed to fetch revenue breakdown" });
  }
});

// ============================================
// GET /api/platform-analytics/revenue-trend
// Daily revenue trend
// ============================================
router.get("/revenue-trend", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Platform revenue by day
    const revenueTrend = await db
      .select({
        date: sql<string>`DATE(${platformRevenue.createdAt})`.as("date"),
        total: sum(platformRevenue.amount),
        count: count(),
      })
      .from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startDate))
      .groupBy(sql`DATE(${platformRevenue.createdAt})`)
      .orderBy(sql`DATE(${platformRevenue.createdAt})`);

    // Sales revenue by day
    const salesTrend = await db
      .select({
        date: sql<string>`DATE(${salesTransactions.createdAt})`.as("date"),
        salesRevenue: sum(salesTransactions.saleAmount),
        platformFees: sum(salesTransactions.platformFee),
      })
      .from(salesTransactions)
      .where(gte(salesTransactions.createdAt, startDate))
      .groupBy(sql`DATE(${salesTransactions.createdAt})`)
      .orderBy(sql`DATE(${salesTransactions.createdAt})`);

    res.json({ revenueTrend, salesTrend });
  } catch (error) {
    console.error("Error fetching revenue trend:", error);
    res.status(500).json({ error: "Failed to fetch revenue trend" });
  }
});

// ============================================
// GET /api/platform-analytics/subscriptions
// Subscription distribution by plan
// ============================================
router.get("/subscriptions", async (_req, res) => {
  try {
    const subsByPlan = await db
      .select({
        plan: subscriptions.plan,
        status: subscriptions.status,
        count: count(),
        totalRevenue: sum(subscriptions.price),
      })
      .from(subscriptions)
      .groupBy(subscriptions.plan, subscriptions.status)
      .orderBy(subscriptions.plan);

    // Monthly Recurring Revenue (MRR)
    const [mrr] = await db
      .select({
        monthly: sum(subscriptions.price),
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.interval, "monthly")
        )
      );

    const [arr] = await db
      .select({
        yearly: sum(subscriptions.price),
      })
      .from(subscriptions)
      .where(
        and(
          eq(subscriptions.status, "active"),
          eq(subscriptions.interval, "yearly")
        )
      );

    res.json({
      byPlan: subsByPlan.map((s) => ({
        plan: s.plan,
        status: s.status,
        count: Number(s.count),
        revenue: Number(s.totalRevenue || 0),
      })),
      mrr: Number(mrr?.monthly || 0),
      arr: Number(arr?.yearly || 0),
    });
  } catch (error) {
    console.error("Error fetching subscriptions analytics:", error);
    res.status(500).json({ error: "Failed to fetch subscriptions" });
  }
});

// ============================================
// GET /api/platform-analytics/content-stats
// Songs, genres, AI vs manual, top songs
// ============================================
router.get("/content-stats", async (_req, res) => {
  try {
    // Songs by genre
    const byGenre = await db
      .select({
        genre: songs.genre,
        count: count(),
        totalPlays: sum(songs.plays),
      })
      .from(songs)
      .groupBy(songs.genre)
      .orderBy(desc(count()));

    // Top 10 most played songs
    const topSongs = await db
      .select({
        id: songs.id,
        title: songs.title,
        plays: songs.plays,
        genre: songs.genre,
        generatedWithAI: songs.generatedWithAI,
        createdAt: songs.createdAt,
      })
      .from(songs)
      .orderBy(desc(songs.plays))
      .limit(10);

    // AI vs Manual
    const [aiCount] = await db
      .select({ total: count() })
      .from(songs)
      .where(eq(songs.generatedWithAI, true));

    const [manualCount] = await db
      .select({ total: count() })
      .from(songs)
      .where(eq(songs.generatedWithAI, false));

    // Songs created over time (last 90 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const songsTrend = await db
      .select({
        date: sql<string>`DATE(${songs.createdAt})`.as("date"),
        count: count(),
      })
      .from(songs)
      .where(gte(songs.createdAt, startDate))
      .groupBy(sql`DATE(${songs.createdAt})`)
      .orderBy(sql`DATE(${songs.createdAt})`);

    res.json({
      byGenre: byGenre.map((g) => ({
        genre: g.genre || "Unknown",
        count: Number(g.count),
        totalPlays: Number(g.totalPlays || 0),
      })),
      topSongs: topSongs.map((s) => ({
        ...s,
        plays: Number(s.plays),
      })),
      aiVsManual: {
        ai: Number(aiCount?.total || 0),
        manual: Number(manualCount?.total || 0),
      },
      songsTrend: songsTrend.map((s) => ({
        date: s.date,
        count: Number(s.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching content stats:", error);
    res.status(500).json({ error: "Failed to fetch content stats" });
  }
});

// ============================================
// GET /api/platform-analytics/sales
// Merch sales statistics
// ============================================
router.get("/sales", async (req, res) => {
  try {
    const days = parseInt(req.query.days as string) || 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Sales by day
    const salesByDay = await db
      .select({
        date: sql<string>`DATE(${salesTransactions.createdAt})`.as("date"),
        total: sum(salesTransactions.saleAmount),
        count: count(),
        platformFees: sum(salesTransactions.platformFee),
        artistEarnings: sum(salesTransactions.artistEarning),
      })
      .from(salesTransactions)
      .where(gte(salesTransactions.createdAt, startDate))
      .groupBy(sql`DATE(${salesTransactions.createdAt})`)
      .orderBy(sql`DATE(${salesTransactions.createdAt})`);

    // Top products by revenue
    const topProducts = await db
      .select({
        productName: salesTransactions.productName,
        totalRevenue: sum(salesTransactions.saleAmount),
        totalSold: sum(salesTransactions.quantity),
        count: count(),
      })
      .from(salesTransactions)
      .where(gte(salesTransactions.createdAt, startDate))
      .groupBy(salesTransactions.productName)
      .orderBy(desc(sum(salesTransactions.saleAmount)))
      .limit(10);

    // Sales by status
    const byStatus = await db
      .select({
        status: salesTransactions.status,
        count: count(),
        total: sum(salesTransactions.saleAmount),
      })
      .from(salesTransactions)
      .groupBy(salesTransactions.status);

    res.json({
      salesByDay: salesByDay.map((s) => ({
        date: s.date,
        total: Number(s.total || 0),
        count: Number(s.count),
        platformFees: Number(s.platformFees || 0),
        artistEarnings: Number(s.artistEarnings || 0),
      })),
      topProducts: topProducts.map((p) => ({
        name: p.productName,
        revenue: Number(p.totalRevenue || 0),
        sold: Number(p.totalSold || 0),
        orders: Number(p.count),
      })),
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: Number(s.count),
        total: Number(s.total || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching sales analytics:", error);
    res.status(500).json({ error: "Failed to fetch sales analytics" });
  }
});

// ============================================
// GET /api/platform-analytics/credits
// Credit system analytics
// ============================================
router.get("/credits", async (_req, res) => {
  try {
    // Credits by transaction type
    const byType = await db
      .select({
        type: creditTransactions.type,
        total: sum(creditTransactions.amount),
        count: count(),
      })
      .from(creditTransactions)
      .groupBy(creditTransactions.type);

    // Recent credit activity (last 30 days)
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    const recentActivity = await db
      .select({
        date: sql<string>`DATE(${creditTransactions.createdAt})`.as("date"),
        purchases: sql<number>`SUM(CASE WHEN ${creditTransactions.type} = 'purchase' THEN ${creditTransactions.amount} ELSE 0 END)`,
        deductions: sql<number>`SUM(CASE WHEN ${creditTransactions.type} = 'deduction' THEN ABS(${creditTransactions.amount}) ELSE 0 END)`,
      })
      .from(creditTransactions)
      .where(gte(creditTransactions.createdAt, startDate))
      .groupBy(sql`DATE(${creditTransactions.createdAt})`)
      .orderBy(sql`DATE(${creditTransactions.createdAt})`);

    res.json({
      byType: byType.map((t) => ({
        type: t.type,
        total: Number(t.total || 0),
        count: Number(t.count),
      })),
      recentActivity: recentActivity.map((a) => ({
        date: a.date,
        purchases: Number(a.purchases || 0),
        deductions: Number(a.deductions || 0),
      })),
    });
  } catch (error) {
    console.error("Error fetching credits analytics:", error);
    res.status(500).json({ error: "Failed to fetch credits analytics" });
  }
});

// ============================================
// GET /api/platform-analytics/video-projects
// Music video project stats
// ============================================
router.get("/video-projects", async (_req, res) => {
  try {
    // Count by status
    const byStatus = await db
      .select({
        status: musicVideoProjects.status,
        count: count(),
      })
      .from(musicVideoProjects)
      .groupBy(musicVideoProjects.status);

    // Paid vs unpaid
    const [paidStats] = await db
      .select({
        totalPaid: count(),
        totalRevenue: sum(musicVideoProjects.paidAmount),
        totalCreditsUsed: sum(musicVideoProjects.creditsUsed),
      })
      .from(musicVideoProjects)
      .where(eq(musicVideoProjects.isPaid, true));

    // Projects over time
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90);
    const projectsTrend = await db
      .select({
        date: sql<string>`DATE(${musicVideoProjects.createdAt})`.as("date"),
        count: count(),
      })
      .from(musicVideoProjects)
      .where(gte(musicVideoProjects.createdAt, startDate))
      .groupBy(sql`DATE(${musicVideoProjects.createdAt})`)
      .orderBy(sql`DATE(${musicVideoProjects.createdAt})`);

    res.json({
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: Number(s.count),
      })),
      paid: {
        totalPaid: Number(paidStats?.totalPaid || 0),
        totalRevenue: Number(paidStats?.totalRevenue || 0),
        totalCreditsUsed: Number(paidStats?.totalCreditsUsed || 0),
      },
      trend: projectsTrend.map((p) => ({
        date: p.date,
        count: Number(p.count),
      })),
    });
  } catch (error) {
    console.error("Error fetching video project analytics:", error);
    res.status(500).json({ error: "Failed to fetch video project analytics" });
  }
});

// ============================================
// GET /api/platform-analytics/recent-activity
// Latest platform activity feed
// ============================================
router.get("/recent-activity", async (_req, res) => {
  try {
    // Recent users
    const recentUsers = await db
      .select({
        id: users.id,
        artistName: users.artistName,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt))
      .limit(10);

    // Recent sales
    const recentSales = await db
      .select({
        id: salesTransactions.id,
        productName: salesTransactions.productName,
        saleAmount: salesTransactions.saleAmount,
        status: salesTransactions.status,
        createdAt: salesTransactions.createdAt,
      })
      .from(salesTransactions)
      .orderBy(desc(salesTransactions.createdAt))
      .limit(10);

    // Recent credit transactions
    const recentCredits = await db
      .select({
        id: creditTransactions.id,
        userEmail: creditTransactions.userEmail,
        amount: creditTransactions.amount,
        type: creditTransactions.type,
        description: creditTransactions.description,
        createdAt: creditTransactions.createdAt,
      })
      .from(creditTransactions)
      .orderBy(desc(creditTransactions.createdAt))
      .limit(10);

    res.json({
      recentUsers: recentUsers.map((u) => ({
        ...u,
        email: u.email ? u.email.replace(/(.{2}).*(@.*)/, "$1***$2") : "N/A",
      })),
      recentSales,
      recentCredits: recentCredits.map((c) => ({
        ...c,
        userEmail: c.userEmail.replace(/(.{2}).*(@.*)/, "$1***$2"),
      })),
    });
  } catch (error) {
    console.error("Error fetching recent activity:", error);
    res.status(500).json({ error: "Failed to fetch recent activity" });
  }
});

export default router;
