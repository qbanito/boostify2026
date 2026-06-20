/**
 * Monetization Routes - Central hub for all platform revenue
 * 
 * Revenue Streams:
 * 1. Trading Fees (5% on BoostiSwap swaps)
 * 2. Subscriptions (Stripe recurring)
 * 3. Token Sales Commission (20% on primary sales)
 * 4. Promoted Posts (pay for visibility)
 */

import { Router } from "express";
import { db } from "../db";
import { 
  platformRevenue, 
  promotedPosts,
  tokenizedSongs,
  tokenPurchases,
  subscriptions,
  users,
  aiSocialPosts
} from "../../db/schema";
import { eq, desc, sql, and, gte, lte, sum } from "drizzle-orm";
import Stripe from "stripe";

const router = Router();

// Fee Constants
export const FEES = {
  SWAP_FEE_PERCENTAGE: 5,           // 5% on all swaps
  TOKEN_SALE_COMMISSION: 20,        // 20% on primary token sales
  PROMOTED_POST_CPM: 10,            // $10 per 1000 impressions
  PROMOTED_POST_MIN_BUDGET: 20,     // Minimum $20 to promote
  PROMOTED_POST_DAILY_CAP: 500,     // Max $500/day per post
};

// ============================================
// REVENUE DASHBOARD
// ============================================

/**
 * GET /api/monetization/dashboard
 * Get overview of all revenue streams
 */
router.get("/dashboard", async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 7);

    // Total revenue all time
    const totalRevenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(platformRevenue);

    // Revenue this month
    const monthlyRevenueResult = await db
      .select({ total: sql<string>`COALESCE(SUM(amount::numeric), 0)` })
      .from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startOfMonth));

    // Revenue by type
    const revenueByType = await db
      .select({
        type: platformRevenue.revenueType,
        total: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        count: sql<number>`COUNT(*)`
      })
      .from(platformRevenue)
      .groupBy(platformRevenue.revenueType)
      .orderBy(desc(sql`SUM(amount::numeric)`));

    // Revenue last 7 days by day
    const dailyRevenue = await db
      .select({
        date: sql<string>`DATE(created_at)`,
        total: sql<string>`COALESCE(SUM(amount::numeric), 0)`
      })
      .from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startOfWeek))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at)`);

    // Active subscriptions count
    const activeSubsResult = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"));

    // Active promotions
    const activePromotionsResult = await db
      .select({ 
        count: sql<number>`COUNT(*)`,
        totalBudget: sql<string>`COALESCE(SUM(budget::numeric), 0)`
      })
      .from(promotedPosts)
      .where(eq(promotedPosts.status, "active"));

    res.json({
      totalRevenue: parseFloat(totalRevenueResult[0]?.total || "0"),
      monthlyRevenue: parseFloat(monthlyRevenueResult[0]?.total || "0"),
      revenueByType: revenueByType.map(r => ({
        type: r.type,
        total: parseFloat(r.total),
        count: r.count
      })),
      dailyRevenue: dailyRevenue.map(d => ({
        date: d.date,
        total: parseFloat(d.total)
      })),
      activeSubscriptions: activeSubsResult[0]?.count || 0,
      activePromotions: {
        count: activePromotionsResult[0]?.count || 0,
        totalBudget: parseFloat(activePromotionsResult[0]?.totalBudget || "0")
      },
      fees: FEES
    });
  } catch (error) {
    console.error("❌ Error fetching monetization dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// ============================================
// TRADING FEES (BoostiSwap)
// ============================================

/**
 * POST /api/monetization/record-swap-fee
 * Record a fee from a swap transaction
 */
router.post("/record-swap-fee", async (req, res) => {
  try {
    const { 
      swapAmount, 
      tokenInId, 
      tokenOutId, 
      userWallet,
      txHash 
    } = req.body;

    const feeAmount = swapAmount * (FEES.SWAP_FEE_PERCENTAGE / 100);

    const [revenue] = await db.insert(platformRevenue).values({
      revenueType: "swap_fee",
      amount: String(feeAmount.toFixed(2)),
      description: `Swap fee: ${swapAmount} swap, ${FEES.SWAP_FEE_PERCENTAGE}% fee`,
      sourceTokenId: tokenInId,
      metadata: { 
        swapAmount, 
        tokenInId, 
        tokenOutId, 
        userWallet,
        txHash,
        feePercentage: FEES.SWAP_FEE_PERCENTAGE
      }
    }).returning();

    console.log(`💰 [MONETIZATION] Recorded swap fee: $${feeAmount.toFixed(2)}`);

    res.json({ 
      success: true, 
      feeAmount: feeAmount.toFixed(2),
      revenueId: revenue.id 
    });
  } catch (error) {
    console.error("❌ Error recording swap fee:", error);
    res.status(500).json({ error: "Failed to record swap fee" });
  }
});

// ============================================
// TOKEN SALES COMMISSION (20%)
// ============================================

/**
 * POST /api/monetization/record-token-sale
 * Record commission from a primary token sale
 */
router.post("/record-token-sale", async (req, res) => {
  try {
    const { 
      tokenId, 
      artistId,
      buyerWallet, 
      buyerUserId,
      amount, // Total sale amount in USD
      tokensAmount,
      txHash 
    } = req.body;

    const commissionAmount = amount * (FEES.TOKEN_SALE_COMMISSION / 100);
    const artistAmount = amount - commissionAmount;

    // Record platform commission
    const [revenue] = await db.insert(platformRevenue).values({
      revenueType: "token_sale_commission",
      amount: String(commissionAmount.toFixed(2)),
      description: `Token sale commission: $${amount} sale, ${FEES.TOKEN_SALE_COMMISSION}% commission`,
      sourceTokenId: tokenId,
      sourceArtistId: artistId,
      metadata: { 
        totalSale: amount,
        tokensAmount,
        artistReceived: artistAmount,
        buyerWallet,
        buyerUserId,
        txHash,
        commissionPercentage: FEES.TOKEN_SALE_COMMISSION
      }
    }).returning();

    console.log(`💰 [MONETIZATION] Token sale: $${amount} total, $${commissionAmount.toFixed(2)} commission (${FEES.TOKEN_SALE_COMMISSION}%)`);

    res.json({ 
      success: true, 
      totalSale: amount,
      commission: commissionAmount.toFixed(2),
      artistReceived: artistAmount.toFixed(2),
      revenueId: revenue.id 
    });
  } catch (error) {
    console.error("❌ Error recording token sale:", error);
    res.status(500).json({ error: "Failed to record token sale" });
  }
});

/**
 * GET /api/monetization/token-sales-stats
 * Get stats on token sales and commissions
 */
router.get("/token-sales-stats", async (req, res) => {
  try {
    const stats = await db
      .select({
        totalCommissions: sql<string>`COALESCE(SUM(amount::numeric), 0)`,
        salesCount: sql<number>`COUNT(*)`,
        avgCommission: sql<string>`COALESCE(AVG(amount::numeric), 0)`
      })
      .from(platformRevenue)
      .where(eq(platformRevenue.revenueType, "token_sale_commission"));

    // Top earning artists
    const topArtists = await db
      .select({
        artistId: platformRevenue.sourceArtistId,
        artistName: users.artistName,
        totalCommissions: sql<string>`COALESCE(SUM(${platformRevenue.amount}::numeric), 0)`,
        salesCount: sql<number>`COUNT(*)`
      })
      .from(platformRevenue)
      .leftJoin(users, eq(platformRevenue.sourceArtistId, users.id))
      .where(eq(platformRevenue.revenueType, "token_sale_commission"))
      .groupBy(platformRevenue.sourceArtistId, users.artistName)
      .orderBy(desc(sql`SUM(${platformRevenue.amount}::numeric)`))
      .limit(10);

    res.json({
      totalCommissions: parseFloat(stats[0]?.totalCommissions || "0"),
      salesCount: stats[0]?.salesCount || 0,
      avgCommission: parseFloat(stats[0]?.avgCommission || "0"),
      commissionRate: FEES.TOKEN_SALE_COMMISSION,
      topArtists: topArtists.map(a => ({
        artistId: a.artistId,
        artistName: a.artistName,
        totalCommissions: parseFloat(a.totalCommissions),
        salesCount: a.salesCount
      }))
    });
  } catch (error) {
    console.error("❌ Error fetching token sales stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============================================
// PROMOTED POSTS
// ============================================

/**
 * POST /api/monetization/promote-post
 * Create a new promoted post
 */
router.post("/promote-post", async (req, res) => {
  try {
    const { 
      postId, 
      artistId, 
      budget, 
      dailyBudget,
      targetGenres,
      targetAudience,
      durationDays = 7
    } = req.body;

    // Validate minimum budget
    if (budget < FEES.PROMOTED_POST_MIN_BUDGET) {
      return res.status(400).json({ 
        error: `Minimum budget is $${FEES.PROMOTED_POST_MIN_BUDGET}` 
      });
    }

    // Validate post exists
    const post = await db.select().from(aiSocialPosts).where(eq(aiSocialPosts.id, postId)).limit(1);
    if (post.length === 0) {
      return res.status(404).json({ error: "Post not found" });
    }

    const endsAt = new Date();
    endsAt.setDate(endsAt.getDate() + durationDays);

    const [promotion] = await db.insert(promotedPosts).values({
      postId,
      artistId,
      budget: String(budget),
      dailyBudget: dailyBudget ? String(dailyBudget) : null,
      costPerImpression: String(FEES.PROMOTED_POST_CPM / 1000),
      targetGenres,
      targetAudience: targetAudience || "all",
      status: "pending", // Will become active after payment
      endsAt
    }).returning();

    console.log(`📢 [MONETIZATION] New promotion created: Post #${postId}, Budget: $${budget}`);

    res.json({ 
      success: true, 
      promotion,
      estimatedImpressions: Math.floor(budget / (FEES.PROMOTED_POST_CPM / 1000)),
      message: "Promotion created. Complete payment to activate."
    });
  } catch (error) {
    console.error("❌ Error creating promotion:", error);
    res.status(500).json({ error: "Failed to create promotion" });
  }
});

/**
 * POST /api/monetization/activate-promotion/:id
 * Activate a promotion after payment
 */
router.post("/activate-promotion/:id", async (req, res) => {
  try {
    const promotionId = parseInt(req.params.id);
    const { stripePaymentId } = req.body;

    const [promotion] = await db.select().from(promotedPosts)
      .where(eq(promotedPosts.id, promotionId));

    if (!promotion) {
      return res.status(404).json({ error: "Promotion not found" });
    }

    // Record revenue
    await db.insert(platformRevenue).values({
      revenueType: "promoted_post",
      amount: promotion.budget,
      description: `Promoted post payment: Post #${promotion.postId}`,
      sourceArtistId: promotion.artistId,
      sourcePostId: promotion.postId,
      metadata: { promotionId, stripePaymentId }
    });

    // Activate promotion
    const [updated] = await db.update(promotedPosts)
      .set({ 
        status: "active",
        stripePaymentId,
        startsAt: new Date()
      })
      .where(eq(promotedPosts.id, promotionId))
      .returning();

    console.log(`✅ [MONETIZATION] Promotion activated: #${promotionId}, Budget: $${promotion.budget}`);

    res.json({ success: true, promotion: updated });
  } catch (error) {
    console.error("❌ Error activating promotion:", error);
    res.status(500).json({ error: "Failed to activate promotion" });
  }
});

/**
 * GET /api/monetization/promoted-posts
 * Get active promoted posts for feed integration
 */
router.get("/promoted-posts", async (req, res) => {
  try {
    const now = new Date();

    const activePromotions = await db
      .select({
        promotion: promotedPosts,
        post: aiSocialPosts,
        artist: {
          id: users.id,
          artistName: users.artistName,
          profileImage: users.profileImage
        }
      })
      .from(promotedPosts)
      .leftJoin(aiSocialPosts, eq(promotedPosts.postId, aiSocialPosts.id))
      .leftJoin(users, eq(promotedPosts.artistId, users.id))
      .where(and(
        eq(promotedPosts.status, "active"),
        lte(promotedPosts.startsAt, now)
      ))
      .orderBy(desc(promotedPosts.budget));

    res.json(activePromotions);
  } catch (error) {
    console.error("❌ Error fetching promoted posts:", error);
    res.status(500).json({ error: "Failed to fetch promoted posts" });
  }
});

/**
 * POST /api/monetization/record-impression/:promotionId
 * Record an impression and update spent
 */
router.post("/record-impression/:promotionId", async (req, res) => {
  try {
    const promotionId = parseInt(req.params.promotionId);

    const [promotion] = await db.select().from(promotedPosts)
      .where(eq(promotedPosts.id, promotionId));

    if (!promotion || promotion.status !== "active") {
      return res.status(404).json({ error: "Active promotion not found" });
    }

    const costPerImpression = parseFloat(promotion.costPerImpression || "0.01");
    const newSpent = parseFloat(promotion.spent || "0") + costPerImpression;
    const budget = parseFloat(promotion.budget);

    // Check if budget exhausted
    if (newSpent >= budget) {
      await db.update(promotedPosts)
        .set({ 
          impressions: (promotion.impressions || 0) + 1,
          spent: String(budget),
          status: "completed"
        })
        .where(eq(promotedPosts.id, promotionId));

      return res.json({ success: true, completed: true });
    }

    await db.update(promotedPosts)
      .set({ 
        impressions: (promotion.impressions || 0) + 1,
        spent: String(newSpent.toFixed(4))
      })
      .where(eq(promotedPosts.id, promotionId));

    res.json({ success: true, impressions: (promotion.impressions || 0) + 1 });
  } catch (error) {
    console.error("❌ Error recording impression:", error);
    res.status(500).json({ error: "Failed to record impression" });
  }
});

// ============================================
// SUBSCRIPTION REVENUE TRACKING
// ============================================

/**
 * POST /api/monetization/record-subscription
 * Record subscription revenue (called from Stripe webhook)
 */
router.post("/record-subscription", async (req, res) => {
  try {
    const { 
      userId, 
      plan, 
      amount, 
      interval, 
      stripeSubscriptionId 
    } = req.body;

    const [revenue] = await db.insert(platformRevenue).values({
      revenueType: "subscription",
      amount: String(amount),
      description: `${plan} subscription (${interval})`,
      sourceUserId: userId,
      metadata: { 
        plan, 
        interval, 
        stripeSubscriptionId 
      }
    }).returning();

    console.log(`💰 [MONETIZATION] Subscription revenue: $${amount} - ${plan} (${interval})`);

    res.json({ success: true, revenueId: revenue.id });
  } catch (error) {
    console.error("❌ Error recording subscription:", error);
    res.status(500).json({ error: "Failed to record subscription" });
  }
});

/**
 * GET /api/monetization/subscription-stats
 * Get subscription revenue stats
 */
router.get("/subscription-stats", async (req, res) => {
  try {
    // Active subscriptions by plan
    const planBreakdown = await db
      .select({
        plan: subscriptions.plan,
        count: sql<number>`COUNT(*)`,
      })
      .from(subscriptions)
      .where(eq(subscriptions.status, "active"))
      .groupBy(subscriptions.plan);

    // MRR calculation
    const monthlyRevenue = await db
      .select({
        total: sql<string>`COALESCE(SUM(amount::numeric), 0)`
      })
      .from(platformRevenue)
      .where(and(
        eq(platformRevenue.revenueType, "subscription"),
        gte(platformRevenue.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      ));

    res.json({
      planBreakdown: planBreakdown.map(p => ({
        plan: p.plan,
        count: p.count
      })),
      mrr: parseFloat(monthlyRevenue[0]?.total || "0"),
      totalActiveSubscriptions: planBreakdown.reduce((acc, p) => acc + (p.count || 0), 0)
    });
  } catch (error) {
    console.error("❌ Error fetching subscription stats:", error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ============================================
// REVENUE HISTORY
// ============================================

/**
 * GET /api/monetization/history
 * Get revenue history with filters
 */
router.get("/history", async (req, res) => {
  try {
    const { type, limit = 50, offset = 0, startDate, endDate } = req.query;

    let query = db
      .select({
        revenue: platformRevenue,
        artist: {
          id: users.id,
          name: users.artistName
        }
      })
      .from(platformRevenue)
      .leftJoin(users, eq(platformRevenue.sourceArtistId, users.id))
      .orderBy(desc(platformRevenue.createdAt))
      .limit(Number(limit))
      .offset(Number(offset));

    const results = await query;

    res.json({
      revenues: results.map(r => ({
        ...r.revenue,
        artist: r.artist
      })),
      pagination: {
        limit: Number(limit),
        offset: Number(offset)
      }
    });
  } catch (error) {
    console.error("❌ Error fetching revenue history:", error);
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
