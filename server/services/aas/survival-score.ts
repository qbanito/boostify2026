/**
 * AAS Engine — Survival Score Calculator
 * 
 * Formula: Score = (Revenue + Pipeline + Audience + Brand + Deals) 
 *                - (BurnRate + LegalRisk + Churn + ContentFatigue)
 * 
 * Pulls data from existing tables: artistWallet, salesTransactions, 
 * walletTransactions, marketingMetrics, analyticsHistory, aasDealPipeline
 */

import { db } from '../../db';
import { 
  artistWallet, 
  salesTransactions, 
  walletTransactions,
  marketingMetrics,
  aasDealPipeline,
  aasConfig,
  aasSurvivalMetrics,
  aasStrategicMemory,
} from '../../../db/schema';
import { eq, and, gte, desc, sql, count } from 'drizzle-orm';
import type { SurvivalScore, SurvivalScoreComponents, FinancialSnapshot } from './types';

/**
 * Get financial snapshot from existing wallet + transaction data
 */
export async function getFinancialSnapshot(artistId: number): Promise<FinancialSnapshot> {
  // Get wallet balance
  const [wallet] = await db
    .select()
    .from(artistWallet)
    .where(eq(artistWallet.userId, artistId))
    .limit(1);

  const cashAvailable = parseFloat(wallet?.balance || '0');
  const totalEarnings = parseFloat(wallet?.totalEarnings || '0');
  const totalSpent = parseFloat(wallet?.totalSpent || '0');

  // Get last 7 days of transactions for burn rate
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  
  const recentSpending = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)` })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.userId, artistId),
        eq(walletTransactions.type, 'spending'),
        gte(walletTransactions.createdAt, sevenDaysAgo)
      )
    );

  const recentEarning = await db
    .select({ total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)` })
    .from(walletTransactions)
    .where(
      and(
        eq(walletTransactions.userId, artistId),
        eq(walletTransactions.type, 'earning'),
        gte(walletTransactions.createdAt, sevenDaysAgo)
      )
    );

  const weeklySpend = parseFloat(recentSpending[0]?.total || '0');
  const weeklyRevenue = parseFloat(recentEarning[0]?.total || '0');
  const dailyBurnRate = weeklySpend / 7;
  const runwayDays = dailyBurnRate > 0 ? Math.floor(cashAvailable / dailyBurnRate) : 999;

  // Revenue by channel from salesTransactions
  const salesByType = await db
    .select({ 
      productName: salesTransactions.productName,
      total: sql<string>`COALESCE(SUM(CAST(sale_amount AS numeric)), 0)` 
    })
    .from(salesTransactions)
    .where(
      and(
        eq(salesTransactions.artistId, artistId),
        gte(salesTransactions.createdAt, sevenDaysAgo)
      )
    )
    .groupBy(salesTransactions.productName);

  const revenueByChannel: Record<string, number> = {};
  for (const row of salesByType) {
    revenueByChannel[row.productName || 'other'] = parseFloat(row.total);
  }

  const minimumMonthly = dailyBurnRate * 30 * 1.2; // costs + 20% safety

  // "Above survival threshold" means the artist is actually earning enough to
  // cover costs. An artist with $0 revenue AND $0 costs is NOT thriving — it is
  // inactive — so require real revenue before reporting survival. (Previously
  // 0 >= 0 evaluated true, producing a false positive that pushed the strategist
  // into "grow" mode for broke/inactive artists.)
  const isAboveSurvivalThreshold = weeklyRevenue > 0 && weeklyRevenue * 4 >= minimumMonthly;

  return {
    cashAvailable,
    totalEarnings,
    totalSpent,
    dailyBurnRate,
    weeklyBurnRate: weeklySpend,
    runwayDays,
    revenueByChannel,
    costByCategory: { weekly_total: weeklySpend },
    isAboveSurvivalThreshold,
  };
}

/**
 * Calculate the full Survival Score from real data
 */
export async function calculateSurvivalScore(artistId: number): Promise<SurvivalScore> {
  const financial = await getFinancialSnapshot(artistId);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // === Revenue Health (0-100) ===
  // Based on weekly revenue vs weekly costs
  const weeklyRevenue = Object.values(financial.revenueByChannel).reduce((a, b) => a + b, 0);
  const revenueCostRatio = financial.weeklyBurnRate > 0 
    ? weeklyRevenue / financial.weeklyBurnRate 
    : weeklyRevenue > 0 ? 5 : 0;
  const revenueHealth = Math.min(100, Math.round(revenueCostRatio * 20)); // ratio of 5 = 100

  // === Pipeline Strength (0-100) ===
  const [dealCounts] = await db
    .select({ 
      total: count(),
      active: sql<number>`COUNT(*) FILTER (WHERE stage NOT IN ('closed_won', 'closed_lost'))`,
    })
    .from(aasDealPipeline)
    .where(eq(aasDealPipeline.artistId, artistId));
  
  const pipelineStrength = Math.min(100, (dealCounts?.active || 0) * 10); // 10 active deals = 100

  // === Audience Momentum (0-100) ===
  const [metrics] = await db
    .select()
    .from(marketingMetrics)
    .where(eq(marketingMetrics.userId, artistId))
    .limit(1);

  const totalFollowers = (metrics?.spotifyFollowers || 0) 
    + (metrics?.instagramFollowers || 0) 
    + (metrics?.youtubeViews || 0);
  const audienceMomentum = Math.min(100, Math.round(Math.log10(Math.max(totalFollowers, 1)) * 20));

  // === Brand Relevance (0-100) ===
  const engagement = metrics?.totalEngagement || 0;
  const brandRelevance = Math.min(100, Math.round(Math.log10(Math.max(engagement, 1)) * 25));

  // === Deal Velocity (0-100) ===
  const [recentDeals] = await db
    .select({ closed: count() })
    .from(aasDealPipeline)
    .where(
      and(
        eq(aasDealPipeline.artistId, artistId),
        eq(aasDealPipeline.stage, 'closed_won'),
        gte(aasDealPipeline.updatedAt, thirtyDaysAgo)
      )
    );
  const dealVelocity = Math.min(100, (recentDeals?.closed || 0) * 25); // 4 deals/month = 100

  // === Negative factors ===
  const burnRateScore = financial.runwayDays < 30 ? 80 
    : financial.runwayDays < 60 ? 50 
    : financial.runwayDays < 90 ? 25 : 5;

  const legalRiskScore = 5; // Low default — will increase when compliance issues detected
  const churnRate = 10; // Default — will be calculated from audience delta when data available
  const contentFatigue = 10; // Default

  const components: SurvivalScoreComponents = {
    revenueHealth,
    pipelineStrength,
    audienceMomentum,
    brandRelevance,
    dealVelocity,
    burnRate: burnRateScore,
    legalRiskScore,
    churnRate,
    contentFatigue,
  };

  // Formula: weighted positive sum minus weighted negative sum
  const positiveScore = (
    revenueHealth * 0.30 +
    pipelineStrength * 0.15 +
    audienceMomentum * 0.20 +
    brandRelevance * 0.15 +
    dealVelocity * 0.20
  );
  
  const negativeScore = (
    burnRateScore * 0.35 +
    legalRiskScore * 0.15 +
    churnRate * 0.25 +
    contentFatigue * 0.25
  );

  const total = Math.max(0, Math.min(100, Math.round(positiveScore - negativeScore * 0.4)));

  const status: SurvivalScore['status'] = 
    total >= 80 ? 'thriving' :
    total >= 60 ? 'healthy' :
    total >= 40 ? 'surviving' :
    total >= 20 ? 'at_risk' : 'critical';

  return { total, components, status };
}

/**
 * Save a survival score snapshot to the metrics table
 */
export async function saveSurvivalSnapshot(
  artistId: number, 
  score: SurvivalScore,
  financial: FinancialSnapshot,
  periodType: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<void> {
  const now = new Date();
  const period = periodType === 'daily' 
    ? now.toISOString().split('T')[0]
    : periodType === 'weekly'
      ? `${now.getFullYear()}-W${Math.ceil(now.getDate() / 7)}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await db.insert(aasSurvivalMetrics).values({
    artistId,
    period,
    periodType,
    revenueHealth: String(score.components.revenueHealth),
    pipelineStrength: String(score.components.pipelineStrength),
    audienceMomentum: String(score.components.audienceMomentum),
    brandRelevance: String(score.components.brandRelevance),
    dealVelocity: String(score.components.dealVelocity),
    burnRate: String(financial.dailyBurnRate),
    legalRiskScore: String(score.components.legalRiskScore),
    churnRate: String(score.components.churnRate),
    contentFatigue: String(score.components.contentFatigue),
    survivalScore: String(score.total),
    totalRevenue: String(Object.values(financial.revenueByChannel).reduce((a, b) => a + b, 0)),
    totalCosts: String(financial.weeklyBurnRate),
    netProfit: String(
      Object.values(financial.revenueByChannel).reduce((a, b) => a + b, 0) - financial.weeklyBurnRate
    ),
    runwayDays: financial.runwayDays,
  });

  // Update cached score on aasConfig
  await db.update(aasConfig)
    .set({ survivalScore: String(score.total), updatedAt: now })
    .where(eq(aasConfig.artistId, artistId));
}

/**
 * Get top strategic insights for an artist
 */
export async function getTopInsights(artistId: number, limit = 5): Promise<string[]> {
  const insights = await db
    .select({ insight: aasStrategicMemory.insight })
    .from(aasStrategicMemory)
    .where(eq(aasStrategicMemory.artistId, artistId))
    .orderBy(desc(aasStrategicMemory.confidence))
    .limit(limit);

  return insights.map(i => i.insight);
}
