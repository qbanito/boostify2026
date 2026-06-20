import { Router, Request, Response } from "express";
import { db } from "../db";
import { apiUsageLog, users } from "../db/schema";
import { eq, gte, lte, sql, desc } from "drizzle-orm";
import { requireAdmin } from '../middleware/require-admin';

const router = Router();
router.use(requireAdmin);

// GET API usage statistics (platform total)
router.get("/stats", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    // Total usage by provider
    const providerStats = await db
      .select({
        provider: apiUsageLog.apiProvider,
        count: sql<number>`cast(count(*) as integer)`,
        totalTokens: sql<number>`cast(coalesce(sum(${apiUsageLog.tokensUsed}), 0) as integer)`,
        totalCost: sql<string>`coalesce(sum(${apiUsageLog.estimatedCost})::text, '0')`,
        avgCost: sql<string>`coalesce(avg(${apiUsageLog.estimatedCost})::text, '0')`,
        successRate: sql<number>`round(100.0 * sum(case when ${apiUsageLog.status} = 'success' then 1 else 0 end) / count(*), 2)`
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(apiUsageLog.apiProvider)
      .catch(() => []);

    // Daily usage trend
    const dailyTrend = await db
      .select({
        date: sql<string>`date(${apiUsageLog.createdAt})`,
        count: sql<number>`cast(count(*) as integer)`,
        totalCost: sql<string>`coalesce(sum(${apiUsageLog.estimatedCost})::text, '0')`
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(sql`date(${apiUsageLog.createdAt})`)
      .orderBy(sql`date(${apiUsageLog.createdAt})`)
      .catch(() => []);

    // Top models used
    const topModels = await db
      .select({
        model: apiUsageLog.model,
        count: sql<number>`cast(count(*) as integer)`,
        totalTokens: sql<number>`cast(coalesce(sum(${apiUsageLog.tokensUsed}), 0) as integer)`,
        totalCost: sql<string>`coalesce(sum(${apiUsageLog.estimatedCost})::text, '0')`
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(apiUsageLog.model)
      .orderBy(sql`count(*) desc`)
      .limit(10)
      .catch(() => []);

    // Error rates
    const errorStats = await db
      .select({
        status: apiUsageLog.status,
        count: sql<number>`count(*)`,
        percentage: sql<number>`round(100.0 * count(*) / (select count(*) from api_usage_log where created_at >= $1), 2)`
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(apiUsageLog.status);

    // Platform totals
    const totals = await db
      .select({
        totalRequests: sql<number>`cast(count(*) as integer)`,
        totalTokens: sql<number>`cast(coalesce(sum(${apiUsageLog.tokensUsed}), 0) as integer)`,
        totalCost: sql<string>`coalesce(sum(${apiUsageLog.estimatedCost})::text, '0')`,
        avgCost: sql<string>`coalesce(avg(${apiUsageLog.estimatedCost})::text, '0')`
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .catch(() => []);

    res.json({
      success: true,
      period: `Last ${daysNum} days`,
      totals: totals[0] || { totalRequests: 0, totalTokens: 0, totalCost: '0', avgCost: '0' },
      providerStats,
      dailyTrend,
      topModels,
      errorStats
    });
  } catch (error) {
    console.error("Error fetching API usage stats:", error);
    res.status(500).json({ error: "Error fetching API usage stats" });
  }
});

// GET user-specific API usage
router.get("/user/:userId", async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { days = "30" } = req.query;
    const daysNum = parseInt(days as string);
    const startDate = new Date(Date.now() - daysNum * 24 * 60 * 60 * 1000);

    const userUsage = await db
      .select({
        provider: apiUsageLog.apiProvider,
        count: sql<number>`count(*)`,
        totalTokens: sql<number>`sum(${apiUsageLog.tokensUsed})`,
        totalCost: sql<string>`sum(${apiUsageLog.estimatedCost})`
      })
      .from(apiUsageLog)
      .where(
        eq(apiUsageLog.userId, parseInt(userId)) &&
        gte(apiUsageLog.createdAt, startDate)
      )
      .groupBy(apiUsageLog.apiProvider);

    const userTotals = await db
      .select({
        totalRequests: sql<number>`count(*)`,
        totalTokens: sql<number>`sum(${apiUsageLog.tokensUsed})`,
        totalCost: sql<string>`sum(${apiUsageLog.estimatedCost})`
      })
      .from(apiUsageLog)
      .where(
        eq(apiUsageLog.userId, parseInt(userId)) &&
        gte(apiUsageLog.createdAt, startDate)
      );

    res.json({
      success: true,
      userId,
      period: `Last ${daysNum} days`,
      totals: userTotals[0] || { totalRequests: 0, totalTokens: 0, totalCost: '0' },
      byProvider: userUsage
    });
  } catch (error) {
    console.error("Error fetching user API usage:", error);
    res.status(500).json({ error: "Error fetching user API usage" });
  }
});

// GET recent API calls
router.get("/recent", async (req: Request, res: Response) => {
  try {
    const { limit = "50" } = req.query;
    
    const recentCalls = await db
      .select({
        id: apiUsageLog.id,
        provider: apiUsageLog.apiProvider,
        model: apiUsageLog.model,
        tokensUsed: apiUsageLog.tokensUsed,
        cost: apiUsageLog.estimatedCost,
        status: apiUsageLog.status,
        responseTime: apiUsageLog.responseTime,
        createdAt: apiUsageLog.createdAt,
        userName: users.firstName
      })
      .from(apiUsageLog)
      .leftJoin(users, eq(apiUsageLog.userId, users.id))
      .orderBy(desc(apiUsageLog.createdAt))
      .limit(parseInt(limit as string));

    res.json({
      success: true,
      calls: recentCalls
    });
  } catch (error) {
    console.error("Error fetching recent API calls:", error);
    res.status(500).json({ error: "Error fetching recent API calls" });
  }
});

// POST log API usage (internal endpoint)
router.post("/log", async (req: Request, res: Response) => {
  try {
    const { userId, apiProvider, endpoint, model, tokensUsed, promptTokens, completionTokens, estimatedCost, responseTime, status, errorMessage, metadata } = req.body;

    const result = await db.insert(apiUsageLog).values({
      userId: userId ? parseInt(userId) : null,
      apiProvider,
      endpoint,
      model,
      tokensUsed: tokensUsed || 0,
      promptTokens: promptTokens || 0,
      completionTokens: completionTokens || 0,
      estimatedCost: estimatedCost || '0',
      responseTime,
      status: status || 'success',
      errorMessage,
      metadata
    }).returning();

    res.json({ success: true, logged: result[0] });
  } catch (error) {
    console.error("Error logging API usage:", error);
    res.status(500).json({ error: "Error logging API usage" });
  }
});

export default router;
