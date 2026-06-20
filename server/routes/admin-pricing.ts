/**
 * Admin Pricing Routes
 * =====================
 * Endpoints for admin to manage credit pricing, markup, and view cost analytics.
 * All routes require a valid admin session (Clerk).
 */

import express from 'express';
import { db } from '../db';
import { adminPricingConfig, adminGlobalSettings, creditTransactions, userCredits, apiUsageLog } from '../db/schema';
import { eq, desc, sql, and, gte } from 'drizzle-orm';
import {
  getGlobalMarkup,
  setGlobalMarkup,
  setOperationPricing,
  seedPricingConfig,
  invalidatePricingCache,
} from '../services/credit-engine';
import {
  OPERATION_COSTS,
  DEFAULT_MARKUP_MULTIPLIER,
  CREDITS_PER_DOLLAR,
  CREDIT_PACKAGES,
  TIER_CREDIT_ALLOCATIONS,
  getFullPricingTable,
  type OperationType,
} from '../../shared/credit-pricing';
import { requireAdmin } from '../middleware/require-admin';

const router = express.Router();
router.use('/api/admin/pricing', requireAdmin);

// ============================================
// GET /api/admin/pricing — Full pricing table
// ============================================
router.get('/api/admin/pricing', async (req, res) => {
  try {
    const markup = await getGlobalMarkup();

    // Get DB overrides
    let dbOverrides: any[] = [];
    try {
      dbOverrides = await db.select().from(adminPricingConfig);
    } catch (_) {
      // Table may not exist yet
    }

    const overrideMap = new Map(dbOverrides.map((r: any) => [r.operationType, r]));

    // Build complete pricing table
    const pricingTable = Object.entries(OPERATION_COSTS).map(([type, op]) => {
      const override = overrideMap.get(type);
      const effectiveMarkup = override ? parseFloat(override.markupMultiplier) : markup;
      const effectiveCreditCost = override
        ? override.creditCost
        : Math.ceil(op.internalCostUsd * markup * CREDITS_PER_DOLLAR);

      return {
        type,
        name: op.name,
        category: op.category,
        provider: op.provider,
        model: op.model,
        unit: op.unit,
        internalCostUsd: op.internalCostUsd,
        markupMultiplier: effectiveMarkup,
        creditCost: effectiveCreditCost,
        userPriceUsd: (effectiveCreditCost / CREDITS_PER_DOLLAR).toFixed(2),
        hasOverride: !!override,
        isActive: override ? override.isActive : true,
      };
    });

    res.json({
      globalMarkup: markup,
      defaultMarkup: DEFAULT_MARKUP_MULTIPLIER,
      totalOperations: pricingTable.length,
      pricingTable,
      creditPackages: CREDIT_PACKAGES,
      tierAllocations: TIER_CREDIT_ALLOCATIONS,
    });
  } catch (error: any) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/admin/pricing/global-markup — Update global markup
// ============================================
router.post('/api/admin/pricing/global-markup', async (req, res) => {
  try {
    const adminEmail = (req as any).adminEmail as string;
    const { multiplier } = req.body;

    if (typeof multiplier !== 'number' || multiplier < 1 || multiplier > 20) {
      return res.status(400).json({ error: 'Multiplier must be between 1 and 20' });
    }

    await setGlobalMarkup(multiplier, adminEmail);

    res.json({ success: true, newMultiplier: multiplier });
  } catch (error: any) {
    console.error('Error updating global markup:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/admin/pricing/operation — Update per-operation pricing
// ============================================
router.post('/api/admin/pricing/operation', async (req, res) => {
  try {
    const adminEmail = (req as any).adminEmail as string;
    const { operationType, markupMultiplier } = req.body;

    if (!operationType || typeof markupMultiplier !== 'number') {
      return res.status(400).json({ error: 'operationType and markupMultiplier required' });
    }

    if (markupMultiplier < 1 || markupMultiplier > 20) {
      return res.status(400).json({ error: 'Multiplier must be between 1 and 20' });
    }

    await setOperationPricing(operationType, markupMultiplier, adminEmail);

    const op = OPERATION_COSTS[operationType as OperationType];
    const newCreditCost = Math.ceil(op.internalCostUsd * markupMultiplier * CREDITS_PER_DOLLAR);

    res.json({
      success: true,
      operationType,
      newMarkup: markupMultiplier,
      newCreditCost,
      newUserPriceUsd: (newCreditCost / CREDITS_PER_DOLLAR).toFixed(2),
    });
  } catch (error: any) {
    console.error('Error updating operation pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/admin/pricing/seed — Initialize all pricing in DB
// ============================================
router.post('/api/admin/pricing/seed', async (req, res) => {
  try {
    const adminEmail = (req as any).adminEmail as string;

    const count = await seedPricingConfig(adminEmail);

    res.json({ success: true, seededOperations: count });
  } catch (error: any) {
    console.error('Error seeding pricing:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// GET /api/admin/pricing/analytics — Cost/revenue analytics
// ============================================
router.get('/api/admin/pricing/analytics', async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Total API costs (last 30 days)
    const [apiCosts] = await db
      .select({
        totalCost: sql<string>`COALESCE(SUM(CAST(${apiUsageLog.estimatedCost} AS NUMERIC)), 0)`,
        totalCalls: sql<number>`COUNT(*)`,
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, thirtyDaysAgo));

    // Total credits spent (last 30 days)
    const [creditSpent] = await db
      .select({
        totalCreditsSpent: sql<number>`COALESCE(SUM(ABS(${creditTransactions.amount})), 0)`,
        totalTransactions: sql<number>`COUNT(*)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.type, 'deduction'),
          gte(creditTransactions.createdAt, thirtyDaysAgo)
        )
      );

    // Total credits purchased (last 30 days)
    const [creditPurchased] = await db
      .select({
        totalCreditsPurchased: sql<number>`COALESCE(SUM(${creditTransactions.amount}), 0)`,
      })
      .from(creditTransactions)
      .where(
        and(
          eq(creditTransactions.type, 'purchase'),
          gte(creditTransactions.createdAt, thirtyDaysAgo)
        )
      );

    // Active users with credits
    const [activeUsers] = await db
      .select({
        count: sql<number>`COUNT(*)`,
        totalCreditsHeld: sql<number>`COALESCE(SUM(${userCredits.credits}), 0)`,
      })
      .from(userCredits);

    // API cost by provider
    const costByProvider = await db
      .select({
        provider: apiUsageLog.apiProvider,
        totalCost: sql<string>`COALESCE(SUM(CAST(${apiUsageLog.estimatedCost} AS NUMERIC)), 0)`,
        callCount: sql<number>`COUNT(*)`,
      })
      .from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, thirtyDaysAgo))
      .groupBy(apiUsageLog.apiProvider);

    const totalApiCostNum = parseFloat(apiCosts.totalCost || '0');
    const totalRevenueCredits = creditSpent?.totalCreditsSpent || 0;
    const totalRevenueUsd = totalRevenueCredits / CREDITS_PER_DOLLAR;

    res.json({
      period: '30 days',
      apiCosts: {
        totalUsd: totalApiCostNum.toFixed(2),
        totalCalls: apiCosts.totalCalls,
        byProvider: costByProvider,
      },
      creditRevenue: {
        totalCreditsSpent: totalRevenueCredits,
        totalRevenueUsd: totalRevenueUsd.toFixed(2),
        totalTransactions: creditSpent?.totalTransactions || 0,
      },
      creditPurchases: {
        totalCreditsPurchased: creditPurchased?.totalCreditsPurchased || 0,
      },
      profitMargin: {
        internalCostUsd: totalApiCostNum.toFixed(2),
        revenueUsd: totalRevenueUsd.toFixed(2),
        profitUsd: (totalRevenueUsd - totalApiCostNum).toFixed(2),
        markupEffective: totalApiCostNum > 0
          ? (totalRevenueUsd / totalApiCostNum).toFixed(2) + 'x'
          : 'N/A',
      },
      users: {
        totalWithCredits: activeUsers?.count || 0,
        totalCreditsHeld: activeUsers?.totalCreditsHeld || 0,
      },
    });
  } catch (error: any) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// POST /api/admin/pricing/reset-cache — Force invalidate pricing cache
// ============================================
router.post('/api/admin/pricing/reset-cache', async (req, res) => {
  try {
    invalidatePricingCache();

    res.json({ success: true, message: 'Pricing cache invalidated' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
