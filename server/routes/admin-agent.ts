import { Router, Request, Response } from "express";
import { createTrackedOpenAI } from '../utils/tracked-openai';
import { db } from "../db";
import {
  transactions, payments, subscriptions, apiUsageLog, users,
  platformRevenue, salesTransactions, creditTransactions,
  affiliateEarnings, videoBudgets, userCredits,
} from "../db/schema";
import { sql, gte, eq, and, desc, lt, count as drizzleCount } from "drizzle-orm";
import { PRIMARY_MODEL } from '../utils/ai-config';
import { requireAdmin } from '../middleware/require-admin';

const router = Router();
router.use(requireAdmin);

// ─── Helper: Fetch comprehensive financial metrics from DB ────────
async function fetchFinancialMetrics(daysNum: number) {
  const now = new Date();
  const startDate = new Date(now.getTime() - daysNum * 86_400_000);
  const prevStartDate = new Date(now.getTime() - daysNum * 2 * 86_400_000);

  const [
    revenueResult,
    prevRevenueResult,
    expenseResult,
    txCountResult,
    txByTypeResult,
    paymentStatusResult,
    subsByPlanResult,
    apiCostResult,
    apiCostByProviderResult,
    recentTxResult,
    activeSubsResult,
    mrrResult,
    // New queries
    userGrowthResult,
    totalUsersResult,
    creditPurchasesResult,
    creditBalanceResult,
    platformRevResult,
    platformRevByTypeResult,
    merchSalesResult,
    videoBudgetResult,
    affiliateResult,
    dailyRevenueResult,
    dailyApiCostResult,
    topModelsResult,
  ] = await Promise.all([
    // 1. Revenue: completed transactions in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
    }).from(transactions)
      .where(and(gte(transactions.createdAt, startDate), eq(transactions.paymentStatus, 'completed'))),

    // 2. Previous period revenue for growth comparison
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
    }).from(transactions)
      .where(and(
        gte(transactions.createdAt, prevStartDate),
        lt(transactions.createdAt, startDate),
        eq(transactions.paymentStatus, 'completed')
      )),

    // 3. Expenses: API costs in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(estimated_cost AS numeric)), 0)`,
    }).from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate)),

    // 4. Transaction count
    db.select({
      total: sql<number>`count(*)::int`,
      completed: sql<number>`count(*) FILTER (WHERE payment_status = 'completed')::int`,
    }).from(transactions)
      .where(gte(transactions.createdAt, startDate)),

    // 5. Transactions by type
    db.select({
      type: transactions.type,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
    }).from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .groupBy(transactions.type),

    // 6. Payments by status
    db.select({
      status: payments.status,
      count: sql<number>`count(*)::int`,
      amount: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
    }).from(payments)
      .where(gte(payments.createdAt, startDate))
      .groupBy(payments.status),

    // 7. Active subscriptions by plan
    db.select({
      plan: subscriptions.plan,
      count: sql<number>`count(*)::int`,
      revenue: sql<string>`COALESCE(SUM(CAST(price AS numeric)), 0)`,
    }).from(subscriptions)
      .where(eq(subscriptions.status, 'active'))
      .groupBy(subscriptions.plan),

    // 8. Total API costs
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(estimated_cost AS numeric)), 0)`,
      calls: sql<number>`count(*)::int`,
      tokens: sql<number>`COALESCE(SUM(tokens_used), 0)::int`,
    }).from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate)),

    // 9. API costs by provider
    db.select({
      provider: apiUsageLog.apiProvider,
      cost: sql<string>`COALESCE(SUM(CAST(estimated_cost AS numeric)), 0)`,
      calls: sql<number>`count(*)::int`,
    }).from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(apiUsageLog.apiProvider),

    // 10. Recent transactions (last 10)
    db.select({
      type: transactions.type,
      description: transactions.description,
      amount: transactions.amount,
      status: transactions.paymentStatus,
      date: transactions.createdAt,
    }).from(transactions)
      .where(gte(transactions.createdAt, startDate))
      .orderBy(desc(transactions.createdAt))
      .limit(10),

    // 11. Active subscriptions count
    db.select({ count: sql<number>`count(*)::int` })
      .from(subscriptions).where(eq(subscriptions.status, 'active')),

    // 12. MRR
    db.select({
      monthly: sql<string>`COALESCE(SUM(CASE WHEN interval = 'monthly' THEN CAST(price AS numeric) ELSE 0 END), 0)`,
      yearly: sql<string>`COALESCE(SUM(CASE WHEN interval = 'yearly' THEN CAST(price AS numeric) / 12 ELSE 0 END), 0)`,
    }).from(subscriptions).where(eq(subscriptions.status, 'active')),

    // ─── NEW: 13. User growth in period ───
    db.select({ count: sql<number>`count(*)::int` })
      .from(users).where(gte(users.createdAt, startDate)),

    // 14. Total users ever
    db.select({ count: sql<number>`count(*)::int` }).from(users),

    // 15. Credit purchases in period
    db.select({
      purchased: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' THEN amount ELSE 0 END), 0)::int`,
      spent: sql<number>`COALESCE(SUM(CASE WHEN type = 'deduction' THEN ABS(amount) ELSE 0 END), 0)::int`,
      txCount: sql<number>`count(*)::int`,
    }).from(creditTransactions)
      .where(gte(creditTransactions.createdAt, startDate)),

    // 16. Total credit balance across all users
    db.select({
      total: sql<number>`COALESCE(SUM(credits), 0)::int`,
      holders: sql<number>`count(*)::int`,
    }).from(userCredits),

    // 17. Platform revenue in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startDate)),

    // 18. Platform revenue by type
    db.select({
      type: platformRevenue.revenueType,
      amount: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(platformRevenue)
      .where(gte(platformRevenue.createdAt, startDate))
      .groupBy(platformRevenue.revenueType),

    // 19. Merch sales in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(sale_amount AS numeric)), 0)`,
      platformFees: sql<string>`COALESCE(SUM(CAST(platform_fee AS numeric)), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(salesTransactions)
      .where(and(gte(salesTransactions.createdAt, startDate), eq(salesTransactions.status, 'completed'))),

    // 20. Video budget revenue in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(user_price AS numeric)), 0)`,
      internalCost: sql<string>`COALESCE(SUM(CAST(internal_cost AS numeric)), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(videoBudgets)
      .where(and(gte(videoBudgets.createdAt, startDate), eq(videoBudgets.paymentStatus, 'paid'))),

    // 21. Affiliate payouts in period
    db.select({
      total: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
      pending: sql<string>`COALESCE(SUM(CASE WHEN status = 'pending' THEN CAST(amount AS numeric) ELSE 0 END), 0)`,
      count: sql<number>`count(*)::int`,
    }).from(affiliateEarnings)
      .where(gte(affiliateEarnings.createdAt, startDate)),

    // 22. Daily revenue (for chart)
    db.select({
      day: sql<string>`TO_CHAR(${transactions.createdAt}, 'YYYY-MM-DD')`,
      revenue: sql<string>`COALESCE(SUM(CAST(amount AS numeric)), 0)`,
    }).from(transactions)
      .where(and(gte(transactions.createdAt, startDate), eq(transactions.paymentStatus, 'completed')))
      .groupBy(sql`TO_CHAR(${transactions.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${transactions.createdAt}, 'YYYY-MM-DD')`),

    // 23. Daily API cost (for chart)
    db.select({
      day: sql<string>`TO_CHAR(${apiUsageLog.createdAt}, 'YYYY-MM-DD')`,
      cost: sql<string>`COALESCE(SUM(CAST(estimated_cost AS numeric)), 0)`,
    }).from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(sql`TO_CHAR(${apiUsageLog.createdAt}, 'YYYY-MM-DD')`)
      .orderBy(sql`TO_CHAR(${apiUsageLog.createdAt}, 'YYYY-MM-DD')`),

    // 24. Top API models by cost
    db.select({
      model: apiUsageLog.model,
      cost: sql<string>`COALESCE(SUM(CAST(estimated_cost AS numeric)), 0)`,
      calls: sql<number>`count(*)::int`,
    }).from(apiUsageLog)
      .where(gte(apiUsageLog.createdAt, startDate))
      .groupBy(apiUsageLog.model)
      .orderBy(sql`SUM(CAST(estimated_cost AS numeric)) DESC`)
      .limit(8),
  ]);

  const revenue = parseFloat(revenueResult[0]?.total || '0');
  const prevRevenue = parseFloat(prevRevenueResult[0]?.total || '0');
  const expenses = parseFloat(expenseResult[0]?.total || '0');
  const netProfit = revenue - expenses;
  const totalTx = txCountResult[0]?.total || 0;
  const completedTx = txCountResult[0]?.completed || 0;
  const completionRate = totalTx > 0 ? ((completedTx / totalTx) * 100) : 0;
  const revenueGrowth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue * 100) : 0;
  const mrrMonthly = parseFloat(mrrResult[0]?.monthly || '0');
  const mrrYearly = parseFloat(mrrResult[0]?.yearly || '0');
  const mrr = mrrMonthly + mrrYearly;
  const profitMargin = revenue > 0 ? ((netProfit / revenue) * 100) : 0;
  const merchTotal = parseFloat(merchSalesResult[0]?.total || '0');
  const merchFees = parseFloat(merchSalesResult[0]?.platformFees || '0');
  const videoTotal = parseFloat(videoBudgetResult[0]?.total || '0');
  const videoInternalCost = parseFloat(videoBudgetResult[0]?.internalCost || '0');

  return {
    metrics: {
      totalRevenue: revenue.toFixed(2),
      totalExpenses: expenses.toFixed(2),
      netProfit: netProfit.toFixed(2),
      profitMargin: profitMargin.toFixed(1),
      completionRate: completionRate.toFixed(1),
      transactionCount: totalTx,
      revenueGrowth: revenueGrowth.toFixed(1),
      mrr: mrr.toFixed(2),
      activeSubscriptions: activeSubsResult[0]?.count || 0,
      apiCalls: apiCostResult[0]?.calls || 0,
      apiTokens: apiCostResult[0]?.tokens || 0,
      // New metrics
      newUsers: userGrowthResult[0]?.count || 0,
      totalUsers: totalUsersResult[0]?.count || 0,
      creditsPurchased: creditPurchasesResult[0]?.purchased || 0,
      creditsSpent: creditPurchasesResult[0]?.spent || 0,
      creditTxCount: creditPurchasesResult[0]?.txCount || 0,
      totalCreditsInCirculation: creditBalanceResult[0]?.total || 0,
      creditHolders: creditBalanceResult[0]?.holders || 0,
      platformRevenueTotal: parseFloat(platformRevResult[0]?.total || '0').toFixed(2),
      merchSalesTotal: merchTotal.toFixed(2),
      merchPlatformFees: merchFees.toFixed(2),
      merchSalesCount: merchSalesResult[0]?.count || 0,
      videoRevenueTotal: videoTotal.toFixed(2),
      videoInternalCost: videoInternalCost.toFixed(2),
      videoProfit: (videoTotal - videoInternalCost).toFixed(2),
      videoCount: videoBudgetResult[0]?.count || 0,
      affiliatePayouts: parseFloat(affiliateResult[0]?.total || '0').toFixed(2),
      affiliatePending: parseFloat(affiliateResult[0]?.pending || '0').toFixed(2),
    },
    breakdowns: {
      byType: txByTypeResult.map(r => ({ type: r.type, count: r.count, amount: parseFloat(r.amount).toFixed(2) })),
      byPaymentStatus: paymentStatusResult.map(r => ({ status: r.status, count: r.count, amount: parseFloat(r.amount).toFixed(2) })),
      byPlan: subsByPlanResult.map(r => ({ plan: r.plan, count: r.count, revenue: parseFloat(r.revenue).toFixed(2) })),
      byApiProvider: apiCostByProviderResult.map(r => ({ provider: r.provider, cost: parseFloat(r.cost).toFixed(4), calls: r.calls })),
      byPlatformRevType: platformRevByTypeResult.map(r => ({
        type: r.type, amount: parseFloat(r.amount).toFixed(2), count: r.count,
      })),
      topModels: topModelsResult.map(r => ({
        model: r.model || 'unknown', cost: parseFloat(r.cost).toFixed(4), calls: r.calls,
      })),
    },
    charts: {
      dailyRevenue: dailyRevenueResult.map(r => ({ day: r.day, value: parseFloat(r.revenue).toFixed(2) })),
      dailyApiCost: dailyApiCostResult.map(r => ({ day: r.day, value: parseFloat(r.cost).toFixed(4) })),
    },
    recentTransactions: recentTxResult,
    period: { days: daysNum, startDate: startDate.toISOString(), endDate: now.toISOString() },
  };
}

// ─── POST /api/admin/agent/analyze — AI Financial Analysis ─────────
router.post("/analyze", async (req: Request, res: Response) => {
  try {
    const { days = "30" } = req.body;
    const daysNum = Math.max(1, Math.min(365, parseInt(days as string) || 30));

    // Fetch REAL metrics from database
    const financialData = await fetchFinancialMetrics(daysNum);
    const { metrics, breakdowns } = financialData;

    const openaiKey = process.env.OPENAI_API_KEY;
    
    if (!openaiKey) {
      // Return real data without AI analysis
      return res.json({
        success: true,
        analysis: buildFallbackAnalysis(metrics, breakdowns, daysNum),
        metrics,
        breakdowns,
        charts: financialData.charts,
        recentTransactions: financialData.recentTransactions,
        period: financialData.period,
      });
    }

    const openai = createTrackedOpenAI({ apiKey: openaiKey });

    const prompt = `You are a senior financial analyst for Boostify Music, an AI-powered SaaS platform for music artists. Analyze this REAL business data and provide actionable, data-driven insights.

═══════════════════════════════════════════════
FINANCIAL SUMMARY — Last ${daysNum} days (${financialData.period.startDate.split('T')[0]} → ${financialData.period.endDate.split('T')[0]})
═══════════════════════════════════════════════

CORE P&L:
• Total Revenue: $${metrics.totalRevenue}
• Total API Expenses: $${metrics.totalExpenses}
• Net Profit: $${metrics.netProfit} (${metrics.profitMargin}% margin)
• Revenue Growth vs Prev Period: ${parseFloat(metrics.revenueGrowth) >= 0 ? '+' : ''}${metrics.revenueGrowth}%

RECURRING REVENUE:
• MRR: $${metrics.mrr} from ${metrics.activeSubscriptions} active subscriptions
• Subscription mix: ${breakdowns.byPlan.map(p => `${p.plan}(${p.count})`).join(', ') || 'none'}

USERS:
• New signups: ${metrics.newUsers} | Total: ${metrics.totalUsers}
• Conversion rate: ${metrics.totalUsers > 0 ? ((metrics.activeSubscriptions / metrics.totalUsers) * 100).toFixed(1) : '0'}%

TRANSACTIONS: ${metrics.transactionCount} total, ${metrics.completionRate}% completed
${breakdowns.byType.map(t => `  • ${t.type}: ${t.count} txns = $${t.amount}`).join('\n') || '  • No transactions'}

CREDIT ECONOMY:
• Credits purchased: ${metrics.creditsPurchased} | Used: ${metrics.creditsSpent}
• In circulation: ${metrics.totalCreditsInCirculation} across ${metrics.creditHolders} holders

MERCHANDISE: ${metrics.merchSalesCount} sales = $${metrics.merchSalesTotal} (platform fees: $${metrics.merchPlatformFees})

VIDEO PRODUCTION: ${metrics.videoCount} projects = $${metrics.videoRevenueTotal} revenue, $${metrics.videoInternalCost} cost → $${metrics.videoProfit} profit

API INFRASTRUCTURE: ${metrics.apiCalls} calls, ${metrics.apiTokens.toLocaleString()} tokens = $${metrics.totalExpenses}
${breakdowns.byApiProvider.map(a => `  • ${a.provider}: $${a.cost} (${a.calls} calls)`).join('\n') || '  • No API usage'}

TOP MODELS BY COST:
${breakdowns.topModels.map(m => `  • ${m.model}: $${m.cost} (${m.calls} calls)`).join('\n') || '  • No model data'}

AFFILIATE PROGRAM: $${metrics.affiliatePayouts} total ($${metrics.affiliatePending} pending)

PLATFORM REVENUE STREAMS:
${breakdowns.byPlatformRevType.map(r => `  • ${r.type.replace(/_/g, ' ')}: $${r.amount} (${r.count})`).join('\n') || '  • No platform revenue recorded'}

PAYMENT STATUS:
${breakdowns.byPaymentStatus.map(s => `  • ${s.status}: ${s.count} = $${s.amount}`).join('\n') || '  • No payments'}

─────────────────────────────────────────
Provide a structured analysis with these exact sections:
1. **Financial Health Score** (0-100 with brief justification)
2. **Key Insights** (4-6 data-driven findings — reference specific numbers)
3. **Revenue Analysis** (growth patterns, MRR trajectory, subscription mix, merch + video revenue)
4. **Cost Optimization** (API cost breakdown, top models to optimize, estimated savings)
5. **Credit Economy** (purchase vs usage patterns, monetization opportunities)
6. **Growth Opportunities** (3-5 specific recommendations with projected impact)
7. **Risk Alerts** (concerning patterns, churn signals, cash flow issues, margin alerts)
8. **Action Items** (prioritized: [HIGH] [MEDIUM] [LOW] tags)

Be specific with numbers. No generic advice — every recommendation must reference actual data points from above.`;

    const completion = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        { role: "system", content: "You are a senior financial analyst specializing in SaaS music platforms. Always reference specific numbers from the provided data. Be direct, actionable, and quantitative. Use markdown formatting with **bold** section headers." },
        { role: "user", content: prompt }
      ],
      max_tokens: 3000,
      temperature: 0.4,
    });
    const analysis = completion.choices[0]?.message?.content || "Unable to generate analysis.";

    res.json({
      success: true,
      analysis,
      metrics,
      breakdowns,
      charts: financialData.charts,
      recentTransactions: financialData.recentTransactions,
      period: financialData.period,
    });
  } catch (error) {
    console.error("Error analyzing data:", error);
    // Return error without mock data — never fake financial numbers
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Analysis failed. Please try again.",
    });
  }
});

// ─── Fallback analysis when no OpenAI key ─────────────────────────
function buildFallbackAnalysis(metrics: any, breakdowns: any, days: number): string {
  const margin = parseFloat(metrics.profitMargin);
  const healthScore = margin > 50 ? 85 : margin > 20 ? 70 : margin > 0 ? 55 : 35;
  return [
    `**Financial Health Score**\n${healthScore}/100 — ${margin > 50 ? 'Strong profitability' : margin > 0 ? 'Positive but room for improvement' : 'Needs attention'}`,
    `**Key Insights**\n- Revenue: $${metrics.totalRevenue} (${parseFloat(metrics.revenueGrowth) >= 0 ? '+' : ''}${metrics.revenueGrowth}% vs previous ${days}d)\n- ${metrics.transactionCount} transactions with ${metrics.completionRate}% completion rate\n- API costs: $${metrics.totalExpenses} across ${metrics.apiCalls} calls\n- MRR: $${metrics.mrr} from ${metrics.activeSubscriptions} active subscriptions\n- ${metrics.newUsers} new users joined (${metrics.totalUsers} total)`,
    `**Revenue Analysis**\n${breakdowns.byType.map((t: any) => `- ${t.type}: ${t.count} txns → $${t.amount}`).join('\n') || '- No transactions in period'}\n\nMerch sales: $${metrics.merchSalesTotal} (${metrics.merchSalesCount} orders)\nVideo production: $${metrics.videoRevenueTotal} revenue → $${metrics.videoProfit} profit`,
    `**Subscription Distribution**\n${breakdowns.byPlan.map((p: any) => `- ${p.plan}: ${p.count} subs → $${p.revenue}/mo`).join('\n') || '- No active subscriptions'}`,
    `**Cost Optimization**\n${breakdowns.byApiProvider.map((a: any) => `- ${a.provider}: $${a.cost} (${a.calls} calls)`).join('\n') || '- No API usage'}`,
    `**Action Items**\n1. [HIGH] Review API cost optimization — top models consuming budget\n2. [MEDIUM] Focus on subscription upsell to higher tiers\n3. [LOW] Monitor payment completion rate (${metrics.completionRate}%)`,
  ].join('\n\n');
}

export default router;
