/**
 * BUSINESS PLAN AUTO-POPULATE ENGINE
 * 
 * Reads the artist's full profile in real-time (songs, merch, tokens, vault,
 * engine, transactions, streaming data, social links) and auto-generates /
 * re-adapts every field of the business plan so it's never empty.
 * 
 * Every time the artist visits the Business Plan, the plan adapts to reflect
 * their current state: revenue estimates adjust, expenses recalculate, goals
 * scale, milestones update, and projections re-forecast.
 */

import { db } from '../db';
import {
  artistBusinessPlans, artistEconomicProfile, artistTreasuryVault,
  users, songs, merchandise, tokenizedSongs,
  treasuryTransactions, royaltyTransactions,
} from '../../db/schema';
import { eq, sql, count, gte, and, desc } from 'drizzle-orm';
import { scanArtistProfile, runRoadmapScan, type ProfileSnapshot } from './roadmap-engine';
import OpenAI from 'openai';
import { PRIMARY_MODEL } from '../utils/ai-config';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || '' });

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface RevenueStreams {
  streaming: number;
  merchandise: number;
  liveShows: number;
  licensing: number;
  brandDeals: number;
  courses: number;
  crowdfunding: number;
  other: number;
}

interface MonthlyExpenses {
  studio: number;
  marketing: number;
  equipment: number;
  travel: number;
  contentCreation: number;
  team: number;
  distribution: number;
  other: number;
}

interface FinancialGoals {
  monthlyTarget: number;
  yearlyTarget: number;
  savingsTarget: number;
  investmentAsk: number;
}

interface Projection {
  month: string;
  revenue: number;
  expenses: number;
  profit: number;
}

// ═══════════════════════════════════════════
// REAL FINANCIAL DATA EXTRACTORS
// ═══════════════════════════════════════════

/** Pull actual streaming revenue from royaltyTransactions (last 90 days avg) */
async function getStreamingRevenue(artistId: number): Promise<number> {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const rows = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${royaltyTransactions.netRevenue} AS NUMERIC)), 0)`
    }).from(royaltyTransactions)
      .where(and(
        eq(royaltyTransactions.userId, artistId),
        gte(royaltyTransactions.createdAt, ninetyDaysAgo)
      ));
    const total90d = parseFloat(rows[0]?.total || '0');
    return Math.round((total90d / 3) * 100) / 100; // monthly average
  } catch { return 0; }
}

/** Pull treasury income deposits (last 30 days) */
async function getTreasuryIncome(artistId: number): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${treasuryTransactions.amount} AS NUMERIC)), 0)`
    }).from(treasuryTransactions)
      .where(and(
        eq(treasuryTransactions.artistId, artistId),
        eq(treasuryTransactions.transactionType, 'income_deposit'),
        gte(treasuryTransactions.createdAt, thirtyDaysAgo)
      ));
    return Math.round(parseFloat(rows[0]?.total || '0') * 100) / 100;
  } catch { return 0; }
}

/** Pull treasury fee collections (last 30 days — proxy for expenses) */
async function getTreasuryExpenses(artistId: number): Promise<number> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await db.select({
      total: sql<string>`COALESCE(SUM(CAST(${treasuryTransactions.amount} AS NUMERIC)), 0)`
    }).from(treasuryTransactions)
      .where(and(
        eq(treasuryTransactions.artistId, artistId),
        eq(treasuryTransactions.transactionType, 'fee_collection'),
        gte(treasuryTransactions.createdAt, thirtyDaysAgo)
      ));
    return Math.round(parseFloat(rows[0]?.total || '0') * 100) / 100;
  } catch { return 0; }
}

/** Get merchandise count with potential pricing data */
async function getMerchEstimate(artistId: number): Promise<{ count: number; avgPrice: number }> {
  try {
    const rows = await db.select({
      cnt: count(),
      avgPrice: sql<string>`COALESCE(AVG(CAST(${merchandise.price} AS NUMERIC)), 0)`
    }).from(merchandise).where(eq(merchandise.userId, artistId));
    return {
      count: rows[0]?.cnt || 0,
      avgPrice: parseFloat(rows[0]?.avgPrice || '0'),
    };
  } catch { return { count: 0, avgPrice: 0 }; }
}

// ═══════════════════════════════════════════
// SMART REVENUE ESTIMATION
// ═══════════════════════════════════════════

async function estimateRevenueStreams(
  artistId: number,
  snapshot: ProfileSnapshot,
  existing?: RevenueStreams | null,
): Promise<RevenueStreams> {
  // Start with existing if nonzero, otherwise build from real data
  const hasExisting = existing && Object.values(existing).some(v => v > 0);

  const streamingRev = await getStreamingRevenue(artistId);
  const treasuryIncome = await getTreasuryIncome(artistId);
  const merchData = await getMerchEstimate(artistId);

  // Streaming: real royalties or estimate from song count
  const streaming = streamingRev > 0
    ? streamingRev
    : (hasExisting && existing!.streaming > 0 ? existing!.streaming : Math.max(snapshot.totalSongs * 15, 50));

  // Merchandise: estimate from merch count * avgPrice * estimated monthly sales
  const merchMonthlyEst = merchData.count > 0
    ? Math.round(merchData.count * merchData.avgPrice * 2) // ~2 sales per item/month
    : 0;
  const merch = merchMonthlyEst > 0
    ? merchMonthlyEst
    : (hasExisting && existing!.merchandise > 0 ? existing!.merchandise : (snapshot.totalMerch > 0 ? 100 : 0));

  // Use existing values for categories we can't auto-detect, with smart defaults
  const liveShows = hasExisting && existing!.liveShows > 0 ? existing!.liveShows : (snapshot.totalSongs >= 5 ? 200 : 0);
  const licensing = hasExisting && existing!.licensing > 0 ? existing!.licensing : (snapshot.totalSongs >= 10 ? 100 : 0);
  const brandDeals = hasExisting && existing!.brandDeals > 0 ? existing!.brandDeals : (snapshot.socialLinksCount >= 3 ? 150 : 0);
  const courses = hasExisting && existing!.courses > 0 ? existing!.courses : 0;
  const crowdfunding = hasExisting && existing!.crowdfunding > 0 ? existing!.crowdfunding : (snapshot.totalTokens > 0 ? 75 : 0);

  // "other" captures unattributed treasury income
  const attributedTotal = streaming + merch + liveShows + licensing + brandDeals + courses + crowdfunding;
  const other = treasuryIncome > attributedTotal
    ? Math.round(treasuryIncome - attributedTotal)
    : (hasExisting && existing!.other > 0 ? existing!.other : 0);

  return { streaming, merchandise: merch, liveShows, licensing, brandDeals, courses, crowdfunding, other };
}

// ═══════════════════════════════════════════
// SMART EXPENSE ESTIMATION
// ═══════════════════════════════════════════

function estimateExpenses(
  totalRevenue: number,
  snapshot: ProfileSnapshot,
  existing?: MonthlyExpenses | null,
): MonthlyExpenses {
  const hasExisting = existing && Object.values(existing).some(v => v > 0);
  if (hasExisting) {
    // Re-validate but keep user-entered data
    return existing!;
  }

  // Career-stage based expense ratios
  const isEarly = snapshot.totalSongs < 5 && snapshot.vaultTotal < 500;
  const isMid = snapshot.totalSongs >= 5 && snapshot.totalSongs < 20;
  const isEstablished = snapshot.totalSongs >= 20;

  const base = Math.max(totalRevenue * 0.6, 200); // spend ~60% of revenue, min $200

  if (isEstablished) {
    return {
      studio: Math.round(base * 0.15),
      marketing: Math.round(base * 0.25),
      equipment: Math.round(base * 0.05),
      travel: Math.round(base * 0.15),
      contentCreation: Math.round(base * 0.15),
      team: Math.round(base * 0.15),
      distribution: Math.round(base * 0.05),
      other: Math.round(base * 0.05),
    };
  } else if (isMid) {
    return {
      studio: Math.round(base * 0.20),
      marketing: Math.round(base * 0.20),
      equipment: Math.round(base * 0.10),
      travel: Math.round(base * 0.10),
      contentCreation: Math.round(base * 0.15),
      team: Math.round(base * 0.10),
      distribution: Math.round(base * 0.08),
      other: Math.round(base * 0.07),
    };
  } else {
    // Early stage — focus on production + marketing
    return {
      studio: Math.round(base * 0.25),
      marketing: Math.round(base * 0.15),
      equipment: Math.round(base * 0.15),
      travel: Math.round(base * 0.05),
      contentCreation: Math.round(base * 0.15),
      team: Math.round(base * 0.05),
      distribution: Math.round(base * 0.10),
      other: Math.round(base * 0.10),
    };
  }
}

// ═══════════════════════════════════════════
// SMART FINANCIAL GOALS
// ═══════════════════════════════════════════

function estimateGoals(
  totalRevenue: number,
  totalExpenses: number,
  snapshot: ProfileSnapshot,
  existing?: FinancialGoals | null,
): FinancialGoals {
  // If user explicitly set custom goals (investmentAsk > 0 or targets deviate significantly), keep them
  if (existing && existing.investmentAsk > 0) return existing;

  const profit = totalRevenue - totalExpenses;
  const growthFactor = snapshot.totalSongs >= 20 ? 1.5 : snapshot.totalSongs >= 5 ? 2.0 : 3.0;

  const monthlyTarget = Math.max(Math.round(totalRevenue * growthFactor), 1000);
  const yearlyTarget = monthlyTarget * 12;
  const savingsTarget = Math.round(yearlyTarget * 0.15); // 15% savings goal
  const investmentAsk = existing?.investmentAsk || 0;

  return { monthlyTarget, yearlyTarget, savingsTarget, investmentAsk };
}

// ═══════════════════════════════════════════
// SMART BUDGET ALLOCATION
// ═══════════════════════════════════════════

function estimateBudgetAllocation(
  snapshot: ProfileSnapshot,
  existing?: Record<string, number> | null,
): Record<string, number> {
  // If user customized, keep their allocation
  if (existing && Object.keys(existing).length > 5) return existing;

  const isEarly = snapshot.totalSongs < 5;
  const isMid = snapshot.totalSongs >= 5 && snapshot.totalSongs < 20;

  if (isEarly) {
    return { production: 30, marketing: 20, equipment: 15, content: 15, distribution: 10, touring: 5, savings: 5 };
  } else if (isMid) {
    return { marketing: 30, production: 20, touring: 15, content: 15, equipment: 10, distribution: 5, savings: 5 };
  } else {
    return { marketing: 25, touring: 20, team: 15, production: 15, content: 10, branding: 10, savings: 5 };
  }
}

// ═══════════════════════════════════════════
// SMART 12-MONTH PROJECTIONS
// ═══════════════════════════════════════════

function generateProjections(
  revenue: RevenueStreams,
  expenses: MonthlyExpenses,
  snapshot: ProfileSnapshot,
): Projection[] {
  const totalRev = Object.values(revenue).reduce((a, b) => a + b, 0);
  const totalExp = Object.values(expenses).reduce((a, b) => a + b, 0);

  // Growth rate based on career stage
  const growthRate = snapshot.totalSongs < 5 ? 0.08 // 8% early growth
    : snapshot.totalSongs < 20 ? 0.05 // 5% mid growth
    : 0.03; // 3% established growth

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();

  return months.map((_, i) => {
    const monthIdx = (now.getMonth() + i) % 12;
    const r = Math.round(totalRev * Math.pow(1 + growthRate, i));
    const e = Math.round(totalExp * Math.pow(1 + growthRate * 0.5, i)); // expenses grow slower
    return {
      month: months[monthIdx],
      revenue: r,
      expenses: e,
      profit: r - e,
    };
  });
}

// ═══════════════════════════════════════════
// AI: BUSINESS NAME + MISSION STATEMENT
// ═══════════════════════════════════════════

async function generateBusinessIdentity(
  snapshot: ProfileSnapshot,
  existingName?: string | null,
  existingMission?: string | null,
): Promise<{ businessName: string; missionStatement: string }> {
  // If already set, keep them
  if (existingName && existingName.length > 3 && existingMission && existingMission.length > 20) {
    return { businessName: existingName, missionStatement: existingMission };
  }

  try {
    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a music industry branding consultant. Output JSON only, no markdown.'
        },
        {
          role: 'user',
          content: `Generate a professional business entity name and mission statement for this artist:

Name: ${snapshot.artistName}
Genre: ${snapshot.genre || 'Independent'}
Songs: ${snapshot.totalSongs}
Merch Items: ${snapshot.totalMerch}
Tokenized: ${snapshot.totalTokens}
Social Platforms: ${snapshot.socialLinksCount}/6
${snapshot.biography ? `Bio: ${snapshot.biography.substring(0, 200)}` : ''}

Return JSON: {"businessName": "...", "missionStatement": "..."}
Business name should be like "[Artist Name] Music" or "[Artist Name] Entertainment" — professional but personal.
Mission statement should be 2-3 sentences about their artistic vision and business goals.`
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      businessName: existingName && existingName.length > 3 ? existingName : (parsed.businessName || `${snapshot.artistName} Music`),
      missionStatement: existingMission && existingMission.length > 20 ? existingMission : (parsed.missionStatement || ''),
    };
  } catch {
    return {
      businessName: existingName || `${snapshot.artistName} Music`,
      missionStatement: existingMission || `${snapshot.artistName} is building a sustainable music career through innovative distribution, community engagement, and strategic partnerships.`,
    };
  }
}

// ═══════════════════════════════════════════
// AI: EXECUTIVE SUMMARY
// ═══════════════════════════════════════════

async function generateExecutiveSummary(
  snapshot: ProfileSnapshot,
  revenue: RevenueStreams,
  expenses: MonthlyExpenses,
  goals: FinancialGoals,
  existing?: string | null,
): Promise<string> {
  // Only regenerate if empty or very short
  if (existing && existing.length > 100) return existing;

  try {
    const totalRev = Object.values(revenue).reduce((a, b) => a + b, 0);
    const totalExp = Object.values(expenses).reduce((a, b) => a + b, 0);

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are a professional music industry business consultant. Write a concise executive summary (3-4 paragraphs). Be specific with numbers. Write in English.'
        },
        {
          role: 'user',
          content: `Executive summary for:
Artist: ${snapshot.artistName} | Genre: ${snapshot.genre || 'Independent'}
Songs: ${snapshot.totalSongs} | Merch: ${snapshot.totalMerch} | Tokens: ${snapshot.totalTokens}
Social: ${snapshot.socialLinksCount}/6 platforms | Profile: ${snapshot.profileCompleteness}% complete
Monthly Revenue: $${totalRev} | Monthly Expenses: $${totalExp} | Profit: $${totalRev - totalExp}
Vault Balance: $${snapshot.vaultTotal.toFixed(2)} | Engine: ${snapshot.engineEnabled ? snapshot.engineMode : 'Not active'}
Revenue Target: $${goals.monthlyTarget}/month | Annual Target: $${goals.yearlyTarget}
${snapshot.biography ? `Bio: ${snapshot.biography.substring(0, 300)}` : ''}

Write 3-4 paragraphs covering: current business state, revenue strategy, growth opportunities, and investment thesis.`
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    return response.choices[0]?.message?.content || '';
  } catch {
    return '';
  }
}

// ═══════════════════════════════════════════
// AI: PITCH DECK AUTO-GENERATION
// ═══════════════════════════════════════════

async function generatePitchDeck(
  snapshot: ProfileSnapshot,
  revenue: RevenueStreams,
  expenses: MonthlyExpenses,
  goals: FinancialGoals,
  budget: Record<string, number>,
  existing?: Record<string, any> | null,
): Promise<Record<string, any>> {
  // Keep if already generated
  if (existing && existing.tagline && existing.problemStatement) return existing;

  try {
    const totalRev = Object.values(revenue).reduce((a, b) => a + b, 0);
    const totalExp = Object.values(expenses).reduce((a, b) => a + b, 0);

    const response = await openai.chat.completions.create({
      model: PRIMARY_MODEL,
      messages: [
        {
          role: 'system',
          content: 'You are an investor pitch deck writer for music startups. Output JSON only, no markdown.'
        },
        {
          role: 'user',
          content: `Generate pitch deck for:
Artist: ${snapshot.artistName} | Genre: ${snapshot.genre || 'Independent'}
Songs: ${snapshot.totalSongs} | Merch: ${snapshot.totalMerch} | Tokens: ${snapshot.totalTokens}
Monthly Revenue: $${totalRev} | Profit: $${totalRev - totalExp}
Vault: $${snapshot.vaultTotal.toFixed(2)} | Engine: ${snapshot.engineEnabled ? snapshot.engineMode : 'inactive'}
Social: ${snapshot.socialLinksCount}/6 | Profile: ${snapshot.profileCompleteness}%
${snapshot.biography ? `Bio: ${snapshot.biography.substring(0, 200)}` : ''}
Budget: ${JSON.stringify(budget)}
Investment Ask: $${goals.investmentAsk || 'Not set'}

Return JSON:
{
  "tagline": "One-line pitch",
  "problemStatement": "2-3 sentences about the problem",
  "solution": "2-3 sentences about the solution",
  "marketOpportunity": "2-3 sentences about market size",
  "traction": "Current metrics and achievements",
  "useOfFunds": "How investment will be used",
  "askAmount": ${goals.investmentAsk || 0},
  "askTerms": "Investment terms"
}`
        }
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const text = response.choices[0]?.message?.content || '';
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════
// MAIN: AUTO-POPULATE ENTIRE BUSINESS PLAN
// ═══════════════════════════════════════════

export async function autoPopulateBusinessPlan(artistId: number): Promise<{
  plan: any;
  snapshot: ProfileSnapshot;
  wasCreated: boolean;
  fieldsUpdated: string[];
}> {
  const fieldsUpdated: string[] = [];

  // 1. Scan the artist's real-time profile
  const snapshot = await scanArtistProfile(artistId);

  // 2. Load existing plan (may be null)
  const [existing] = await db.select().from(artistBusinessPlans)
    .where(eq(artistBusinessPlans.artistId, artistId)).limit(1);

  const existingRevenue = existing?.revenueStreams as RevenueStreams | null;
  const existingExpenses = existing?.monthlyExpenses as MonthlyExpenses | null;
  const existingGoals = existing?.financialGoals as FinancialGoals | null;
  const existingBudget = existing?.budgetAllocation as Record<string, number> | null;

  // 3. Auto-populate revenue streams from real data
  const revenueStreams = await estimateRevenueStreams(artistId, snapshot, existingRevenue);
  const totalRevenue = Object.values(revenueStreams).reduce((a, b) => a + b, 0);
  if (JSON.stringify(revenueStreams) !== JSON.stringify(existingRevenue)) fieldsUpdated.push('revenueStreams');

  // 4. Auto-populate expenses
  const monthlyExpenses = estimateExpenses(totalRevenue, snapshot, existingExpenses);
  const totalExpenses = Object.values(monthlyExpenses).reduce((a, b) => a + b, 0);
  if (JSON.stringify(monthlyExpenses) !== JSON.stringify(existingExpenses)) fieldsUpdated.push('monthlyExpenses');

  // 5. Financial goals
  const financialGoals = estimateGoals(totalRevenue, totalExpenses, snapshot, existingGoals);
  if (JSON.stringify(financialGoals) !== JSON.stringify(existingGoals)) fieldsUpdated.push('financialGoals');

  // 6. Budget allocation
  const budgetAllocation = estimateBudgetAllocation(snapshot, existingBudget);
  if (JSON.stringify(budgetAllocation) !== JSON.stringify(existingBudget)) fieldsUpdated.push('budgetAllocation');

  // 7. 12-month projections (always recalculate)
  const projections = generateProjections(revenueStreams, monthlyExpenses, snapshot);
  fieldsUpdated.push('projections');

  // 8. Business name + mission (AI)
  const identity = await generateBusinessIdentity(snapshot, existing?.businessName, existing?.missionStatement);
  if (identity.businessName !== existing?.businessName) fieldsUpdated.push('businessName');
  if (identity.missionStatement !== existing?.missionStatement) fieldsUpdated.push('missionStatement');

  // 9. Executive summary (AI — only if missing)
  const executiveSummary = await generateExecutiveSummary(
    snapshot, revenueStreams, monthlyExpenses, financialGoals, existing?.executiveSummary
  );
  if (executiveSummary && executiveSummary !== existing?.executiveSummary) fieldsUpdated.push('executiveSummary');

  // 10. Pitch deck (AI — only if missing)
  const pitchDeckData = await generatePitchDeck(
    snapshot, revenueStreams, monthlyExpenses, financialGoals, budgetAllocation,
    existing?.pitchDeckData as Record<string, any> | null
  );
  if (Object.keys(pitchDeckData).length > 0 && JSON.stringify(pitchDeckData) !== JSON.stringify(existing?.pitchDeckData)) {
    fieldsUpdated.push('pitchDeckData');
  }

  // 11. Run roadmap scan for milestones (only if plan already exists, or on create)
  let milestones = existing?.milestones || [];
  try {
    const scanResult = await runRoadmapScan(artistId);
    milestones = scanResult.milestonesCreated.length > 0 || scanResult.milestonesUpdated.length > 0
      ? (await db.select().from(artistBusinessPlans).where(eq(artistBusinessPlans.artistId, artistId)).limit(1))[0]?.milestones || milestones
      : milestones;
    if (scanResult.milestonesCreated.length > 0 || scanResult.milestonesUpdated.length > 0) {
      fieldsUpdated.push('milestones');
    }
  } catch { /* Roadmap scan is optional */ }

  // 12. Save or create the plan
  const planData = {
    businessName: identity.businessName,
    missionStatement: identity.missionStatement,
    executiveSummary: executiveSummary || existing?.executiveSummary || '',
    revenueStreams,
    monthlyExpenses,
    financialGoals,
    budgetAllocation,
    projections,
    pitchDeckData: Object.keys(pitchDeckData).length > 0 ? pitchDeckData : (existing?.pitchDeckData || {}),
    linkedEngineMode: snapshot.engineEnabled ? snapshot.engineMode : (existing?.linkedEngineMode || null),
    roadmapAutoUpdate: true,
    lastRoadmapSync: new Date(),
    updatedAt: new Date(),
  };

  let plan: any;
  let wasCreated = false;

  if (existing) {
    const [updated] = await db.update(artistBusinessPlans)
      .set(planData)
      .where(eq(artistBusinessPlans.artistId, artistId))
      .returning();
    plan = updated;
  } else {
    wasCreated = true;
    const [created] = await db.insert(artistBusinessPlans).values({
      artistId,
      ...planData,
      milestones: milestones || [],
      roadmapExecutionLog: [],
    }).returning();
    plan = created;
  }

  console.log(`✅ Business plan auto-populated for artist ${artistId}: ${fieldsUpdated.length} fields updated [${fieldsUpdated.join(', ')}]`);

  return { plan, snapshot, wasCreated, fieldsUpdated };
}

// ═══════════════════════════════════════════
// LIGHT RE-ADAPT: Just financials + projections, no AI
// ═══════════════════════════════════════════

export async function readaptFinancials(artistId: number): Promise<{
  plan: any;
  snapshot: ProfileSnapshot;
  fieldsUpdated: string[];
}> {
  const fieldsUpdated: string[] = [];
  const snapshot = await scanArtistProfile(artistId);

  const [existing] = await db.select().from(artistBusinessPlans)
    .where(eq(artistBusinessPlans.artistId, artistId)).limit(1);

  if (!existing) {
    // No plan exists — do full auto-populate
    const result = await autoPopulateBusinessPlan(artistId);
    return { plan: result.plan, snapshot: result.snapshot, fieldsUpdated: result.fieldsUpdated };
  }

  const existingRevenue = existing.revenueStreams as RevenueStreams | null;

  // Re-estimate revenue from real data
  const revenueStreams = await estimateRevenueStreams(artistId, snapshot, existingRevenue);
  const totalRevenue = Object.values(revenueStreams).reduce((a, b) => a + b, 0);

  // Keep user's expenses but recalculate if they were auto-generated (all zeros or unchanged)
  const existingExpenses = existing.monthlyExpenses as MonthlyExpenses | null;
  const expensesAllZero = existingExpenses && Object.values(existingExpenses).every(v => v === 0);
  const monthlyExpenses = expensesAllZero
    ? estimateExpenses(totalRevenue, snapshot, null)
    : (existingExpenses || estimateExpenses(totalRevenue, snapshot, null));
  const totalExpenses = Object.values(monthlyExpenses).reduce((a, b) => a + b, 0);

  // Recalculate goals only if they're still at defaults
  const existingGoals = existing.financialGoals as FinancialGoals | null;
  const goalsAtDefault = existingGoals && existingGoals.monthlyTarget === 5000 && existingGoals.yearlyTarget === 60000;
  const financialGoals = goalsAtDefault
    ? estimateGoals(totalRevenue, totalExpenses, snapshot, null)
    : (existingGoals || estimateGoals(totalRevenue, totalExpenses, snapshot, null));

  // Always recalculate projections
  const projections = generateProjections(revenueStreams, monthlyExpenses, snapshot);

  if (JSON.stringify(revenueStreams) !== JSON.stringify(existingRevenue)) fieldsUpdated.push('revenueStreams');
  if (JSON.stringify(monthlyExpenses) !== JSON.stringify(existingExpenses)) fieldsUpdated.push('monthlyExpenses');
  if (JSON.stringify(financialGoals) !== JSON.stringify(existingGoals)) fieldsUpdated.push('financialGoals');
  fieldsUpdated.push('projections');

  const [updated] = await db.update(artistBusinessPlans)
    .set({
      revenueStreams,
      monthlyExpenses,
      financialGoals,
      projections,
      linkedEngineMode: snapshot.engineEnabled ? snapshot.engineMode : existing.linkedEngineMode,
      lastRoadmapSync: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(artistBusinessPlans.artistId, artistId))
    .returning();

  return { plan: updated, snapshot, fieldsUpdated };
}
