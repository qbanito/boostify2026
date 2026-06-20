/**
 * Artist Business Plan API Routes
 * 
 * Professional financial planning, pitch deck generation,
 * revenue projections and roadmap management for artists.
 */

import { Router, Request, Response } from 'express';
import { db } from '../db';
import { artistBusinessPlans, users, songs, merchandise } from '../../db/schema';
import { eq, or, desc } from 'drizzle-orm';
import { authenticate } from '../middleware/auth';
import {
  syncEngineToBusinessPlan,
  updateDynamicRoadmap,
  getCombinedDashboardData,
} from '../services/business-plan-engine-bridge';
import {
  runRoadmapScan,
  scanArtistProfile,
  generateRoadmapAdvice,
} from '../services/roadmap-engine';
import {
  autoPopulateBusinessPlan,
  readaptFinancials,
} from '../services/business-plan-auto-populate';
import { callAI } from '../utils/smart-ai';
import { generateFullBusinessPlan } from '../services/business-plan-full-generator';

const router = Router();

// ─── Auth helper — resolves Clerk/Firebase string ID to PG integer ───
async function getUserPgId(req: Request): Promise<number | null> {
  const clerkId = (req as any).auth?.userId;
  if (clerkId) {
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.clerkId, clerkId)).limit(1);
    if (u) return u.id;
  }
  const rawId = (req as any).user?.id;
  if (!rawId) return null;
  const numId = Number(rawId);
  if (!isNaN(numId) && numId > 0) return numId;
  const [u] = await db.select({ id: users.id }).from(users)
    .where(or(eq(users.clerkId, String(rawId)), eq(users.firestoreId, String(rawId))))
    .limit(1);
  return u?.id || null;
}

// ============================================
// GET /api/business-plan/:artistId — Get business plan
// ============================================
router.get('/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    // Try URL param first, fall back to authenticated user's PG ID
    let targetId = parseInt(req.params.artistId);
    if (isNaN(targetId) || targetId <= 0) {
      const userId = await getUserPgId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      targetId = userId;
    }

    const [plan] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, targetId))
      .limit(1);

    if (!plan) {
      return res.json({ success: true, plan: null });
    }

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('❌ Error fetching business plan:', error.message);
    res.status(500).json({ error: 'Failed to fetch business plan' });
  }
});

// ============================================
// POST /api/business-plan/:artistId — Create or update business plan
// ============================================
router.post('/:artistId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const {
      businessName,
      executiveSummary,
      missionStatement,
      revenueStreams,
      monthlyExpenses,
      financialGoals,
      milestones,
      pitchDeckData,
      projections,
      budgetAllocation
    } = req.body;

    // Check if plan exists for this user
    const [existing] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId))
      .limit(1);

    if (existing) {
      // Update
      const [updated] = await db.update(artistBusinessPlans)
        .set({
          businessName: businessName ?? existing.businessName,
          executiveSummary: executiveSummary ?? existing.executiveSummary,
          missionStatement: missionStatement ?? existing.missionStatement,
          revenueStreams: revenueStreams ?? existing.revenueStreams,
          monthlyExpenses: monthlyExpenses ?? existing.monthlyExpenses,
          financialGoals: financialGoals ?? existing.financialGoals,
          milestones: milestones ?? existing.milestones,
          pitchDeckData: pitchDeckData ?? existing.pitchDeckData,
          projections: projections ?? existing.projections,
          budgetAllocation: budgetAllocation ?? existing.budgetAllocation,
          updatedAt: new Date(),
        })
        .where(eq(artistBusinessPlans.artistId, userId))
        .returning();

      return res.json({ success: true, plan: updated });
    } else {
      // Create — use authenticated userId as the FK to users.id
      const [created] = await db.insert(artistBusinessPlans).values({
        artistId: userId,
        businessName,
        executiveSummary,
        missionStatement,
        revenueStreams: revenueStreams || {
          streaming: 0, merchandise: 0, liveShows: 0, licensing: 0,
          brandDeals: 0, courses: 0, crowdfunding: 0, other: 0
        },
        monthlyExpenses: monthlyExpenses || {
          studio: 0, marketing: 0, equipment: 0, travel: 0,
          contentCreation: 0, team: 0, distribution: 0, other: 0
        },
        financialGoals: financialGoals || {
          monthlyTarget: 5000, yearlyTarget: 60000, savingsTarget: 10000, investmentAsk: 0
        },
        milestones: milestones || [],
        pitchDeckData,
        projections,
        budgetAllocation: budgetAllocation || {
          marketing: 35, production: 25, equipment: 15, touring: 15, content: 10
        },
      }).returning();

      return res.json({ success: true, plan: created });
    }
  } catch (error: any) {
    console.error('❌ Error saving business plan:', error.message);
    res.status(500).json({ error: 'Failed to save business plan' });
  }
});

// ============================================
// POST /api/business-plan/:artistId/generate-summary — AI Executive Summary
// ============================================
router.post('/:artistId/generate-summary', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistName, genre, revenueStreams, monthlyExpenses, financialGoals, milestones } = req.body;

    const totalRevenue = revenueStreams ? Object.values(revenueStreams as Record<string, number>).reduce((a, b) => a + b, 0) : 0;
    const totalExpenses = monthlyExpenses ? Object.values(monthlyExpenses as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

    const buildFallbackSummary = () => {
      const annualRevenue = totalRevenue * 12;
      const monthlyProfit = totalRevenue - totalExpenses;
      const margin = totalRevenue > 0 ? Math.round((monthlyProfit / totalRevenue) * 100) : 0;
      const streams = Object.entries(revenueStreams || {}).filter(([, v]) => (v as number) > 0).map(([k]) => k).join(', ') || 'streaming, merchandise and live performance';
      const goalAsk = (financialGoals as any)?.investmentAsk || Math.max(50000, Math.round(annualRevenue * 0.5));
      const milestoneCount = (milestones || []).length;
      return `${artistName || 'This independent artist'} operates in the ${genre || 'music'} space with diversified revenue across ${streams}. Current monthly revenue stands at $${totalRevenue.toLocaleString()} against $${totalExpenses.toLocaleString()} in expenses, yielding a ${margin}% operating margin and an annual run-rate of $${annualRevenue.toLocaleString()}.\n\nThe roadmap includes ${milestoneCount} prioritised milestone${milestoneCount === 1 ? '' : 's'} spanning catalog releases, audience growth and direct-to-fan monetisation. By doubling down on the highest-margin revenue streams and reinvesting into marketing and content production, we project sustainable triple-digit YoY growth over the next 24 months.\n\nWe are raising $${goalAsk.toLocaleString()} to accelerate this trajectory: capital is allocated to (1) high-ROI marketing and audience acquisition, (2) production of flagship releases that drive streams and licensing revenue, and (3) operational infrastructure for the artist business stack. The investment has a clear path to return through royalty growth, merchandise scaling, sync placements and tour revenue.\n\nThis is an opportunity to back an artist-owned, vertically integrated music brand with proven monetisation, a credible roadmap and disciplined unit economics.`;
    };

    let summary = '';
    let aiSource: 'openai' | 'fallback' = 'openai';
    try {
      summary = await callAI(
        'bio',
        [
          {
            role: 'system',
            content: `You are a professional music industry business consultant. Write a concise executive summary (3-4 paragraphs) for an artist's business plan. Be specific with numbers and actionable strategies. Write in English.`
          },
          {
            role: 'user',
            content: `Generate an executive summary for this artist business plan:

Artist: ${artistName || 'Independent Artist'}
Genre: ${genre || 'Various'}
Monthly Revenue: $${totalRevenue.toLocaleString()}
Monthly Expenses: $${totalExpenses.toLocaleString()}
Monthly Profit: $${(totalRevenue - totalExpenses).toLocaleString()}
Revenue Streams: ${JSON.stringify(revenueStreams || {})}
Financial Goals: ${JSON.stringify(financialGoals || {})}
Key Milestones: ${(milestones || []).map((m: any) => m.title).join(', ') || 'None set'}

Focus on growth strategy, revenue optimization, and investment opportunity.`
          }
        ],
        { maxTokens: 1000, temperature: 0.7, label: 'business-plan-summary' }
      );
      if (!summary.trim()) {
        summary = buildFallbackSummary();
        aiSource = 'fallback';
      }
    } catch (aiErr: any) {
      console.warn('⚠️ AI unavailable for summary, using fallback:', aiErr?.message);
      summary = buildFallbackSummary();
      aiSource = 'fallback';
    }

    // Save to DB
    const [existing] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId)).limit(1);

    if (existing) {
      await db.update(artistBusinessPlans)
        .set({ executiveSummary: summary, updatedAt: new Date() })
        .where(eq(artistBusinessPlans.artistId, userId));
    }

    res.json({ success: true, summary, aiSource });
  } catch (error: any) {
    console.error('❌ Error generating summary:', error?.status, error?.code, error?.message);
    res.status(500).json({
      error: 'Failed to generate summary',
      detail: error?.message,
    });
  }
});

// ============================================
// POST /api/business-plan/:artistId/generate-pitch — AI Pitch Deck (rich slides)
// ============================================
router.post('/:artistId/generate-pitch', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const { artistName, genre, biography, revenueStreams, monthlyExpenses, financialGoals, milestones } = req.body;

    // ─── Pull rich artist context: profile image, banner, top songs, top merch ───
    const [artist] = await db.select({
      id: users.id,
      firstName: users.firstName,
      lastName: users.lastName,
      artistName: users.artistName,
      profileImageUrl: users.profileImageUrl,
      profileImage: users.profileImage,
      coverImage: users.coverImage,
      biography: users.biography,
      genre: users.genre,
      genres: users.genres,
      country: users.country,
      location: users.location,
    }).from(users).where(eq(users.id, userId)).limit(1);

    const topSongs = await db.select({
      id: songs.id,
      title: songs.title,
      coverArt: songs.coverArt,
      genre: songs.genre,
      plays: songs.plays,
    }).from(songs)
      .where(eq(songs.userId, userId))
      .orderBy(desc(songs.plays), desc(songs.createdAt))
      .limit(6);

    const topMerch = await db.select({
      id: merchandise.id,
      name: merchandise.name,
      images: merchandise.images,
      price: merchandise.price,
      category: merchandise.category,
    }).from(merchandise)
      .where(eq(merchandise.userId, userId))
      .orderBy(desc(merchandise.viewCount), desc(merchandise.createdAt))
      .limit(6);

    const coverImageUrl =
      artist?.profileImageUrl || artist?.profileImage ||
      topSongs.find((s) => s.coverArt)?.coverArt ||
      topMerch.find((m) => m.images?.[0])?.images?.[0] || null;
    const bannerImageUrl = artist?.coverImage || null;

    const galleryImages: string[] = [
      ...topSongs.map((s) => s.coverArt).filter(Boolean) as string[],
      ...topMerch.flatMap((m) => m.images || []).filter(Boolean) as string[],
    ].slice(0, 6);

    const totalRevenue = revenueStreams ? Object.values(revenueStreams as Record<string, number>).reduce((a, b) => a + b, 0) : 0;
    const totalExpenses = monthlyExpenses ? Object.values(monthlyExpenses as Record<string, number>).reduce((a, b) => a + b, 0) : 0;

    const resolvedArtistName = artistName || artist?.artistName || `${artist?.firstName || ''} ${artist?.lastName || ''}`.trim() || 'Independent Artist';
    const resolvedGenre = genre || artist?.genre || (artist?.genres?.[0]) || 'Music';
    const resolvedBio = biography || artist?.biography || 'Independent music artist';
    const askAmount = (financialGoals?.investmentAsk as number) || Math.max(50000, Math.round(totalRevenue * 12 * 0.5));

    // ─── Deterministic fallback content (used when OpenAI is unavailable) ───
    const buildFallbackAiContent = () => {
      const annualRevenue = totalRevenue * 12;
      const tamByGenre: Record<string, number> = {
        pop: 28_000_000_000, rock: 12_000_000_000, 'hip-hop': 18_000_000_000, rap: 18_000_000_000,
        electronic: 9_000_000_000, edm: 9_000_000_000, latin: 11_000_000_000, reggaeton: 8_000_000_000,
        jazz: 2_500_000_000, classical: 1_800_000_000, country: 6_000_000_000, rnb: 7_000_000_000,
        indie: 4_500_000_000, metal: 3_200_000_000, folk: 1_500_000_000, music: 26_000_000_000,
      };
      const genreKey = (resolvedGenre || 'music').toLowerCase();
      const tam = tamByGenre[genreKey] || tamByGenre[Object.keys(tamByGenre).find((k) => genreKey.includes(k)) || 'music'] || 26_000_000_000;
      const sam = Math.round(tam * 0.06);
      const som = Math.round(sam * 0.012);
      const fans = Math.max(1000, Math.round(annualRevenue / 12));
      const songsCount = topSongs.length;
      const merchCount = topMerch.length;
      const totalPlays = topSongs.reduce((sum, s) => sum + (s.plays || 0), 0);

      return {
        tagline: `${resolvedGenre} that moves culture forward`,
        vision: `Within five years, ${resolvedArtistName} will be a globally recognised ${resolvedGenre} brand with multi-platform presence, owned IP and a self-sustaining direct-to-fan economy. We aim to convert listeners into stakeholders through tokenised releases and an artist-first business stack.`,
        problemStatement: `Independent artists capture less than 12% of the value their music generates while streaming platforms and labels take the rest. Fans have no real ownership in the artists they love, and discovery is dictated by opaque algorithms rather than authentic connection.`,
        solution: `${resolvedArtistName} operates as a vertically integrated music brand: original catalog, owned merch, direct fan monetisation and data-driven release strategy. Every revenue stream feeds back into the artist instead of intermediaries.`,
        uniqueValue: `Artist-owned catalog with built-in fan economy.`,
        marketSizing: {
          tam, sam, som, currency: 'USD',
          narrative: `${resolvedGenre} is a $${(tam / 1e9).toFixed(1)}B global market; we target a $${(som / 1e6).toFixed(0)}M serviceable share over 3 years.`,
        },
        competitors: [
          { name: 'Major-label peers', differentiator: 'Higher overhead, lower artist share' },
          { name: 'Generic streaming-only artists', differentiator: 'No owned merch or fan economy' },
          { name: 'Other indie acts', differentiator: 'Lack integrated tech stack' },
        ],
        traction: `${songsCount} releases generating ${totalPlays.toLocaleString()} streams${merchCount > 0 ? `, ${merchCount} merch SKUs live` : ''} and $${totalRevenue.toLocaleString()} monthly recurring revenue. Audience growing organically across streaming and social.`,
        keyHighlights: [
          { label: 'Monthly Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: 'dollar' },
          { label: 'Annual Run-rate', value: `$${annualRevenue.toLocaleString()}`, icon: 'trending' },
          { label: 'Catalog', value: `${songsCount} song${songsCount !== 1 ? 's' : ''}`, icon: 'music' },
          { label: 'Active Fans', value: fans.toLocaleString(), icon: 'users' },
        ],
        useOfFundsBreakdown: { marketing: 35, production: 20, team: 15, touring: 15, technology: 10, reserve: 5 },
        useOfFunds: `Capital is deployed for high-ROI marketing (35%) and content production (20%) to accelerate audience growth. The remainder funds team expansion, live touring, technology infrastructure and operating reserve.`,
        team: [
          { name: resolvedArtistName, role: 'Founder & Artist', bio: `Driving creative direction and brand vision for the project.` },
          { name: 'Management Team', role: 'Operations & Strategy', bio: 'Music industry veterans handling business development.' },
          { name: 'Advisory Board', role: 'Industry Advisors', bio: 'Senior figures from streaming, labels and live touring.' },
        ],
        keyMilestones: [
          { quarter: 'Q1', title: 'Flagship single + tour announce', metric: '+50% MoM streams' },
          { quarter: 'Q2', title: 'Merch drop & fan club launch', metric: '$30K/mo D2C' },
          { quarter: 'Q3', title: 'EP release + sync placements', metric: '5M+ streams' },
          { quarter: 'Q4', title: 'International tour leg', metric: '20K tickets sold' },
        ],
        askAmount,
        askValuation: Math.round(askAmount / 0.15),
        askEquity: 15,
        askTerms: `$${askAmount.toLocaleString()} for 15% equity on a $${Math.round(askAmount / 0.15).toLocaleString()} post-money valuation.`,
        askRunway: '18 months runway',
        callToAction: 'Join the next chapter of music',
      };
    };

    let aiContent: any;
    let aiSource: 'openai' | 'fallback' = 'openai';
    try {
      const rawContent = await callAI(
        'business_plan',
        [
          {
            role: 'system',
            content: `You are a senior investment banker who writes pitch decks for music artists raising seed/Series A capital. Generate STRUCTURED JSON ONLY. Numbers must be realistic and non-zero. Reference specific revenue streams. Write in confident, concise English. Do NOT use markdown or code fences.`
          },
        {
          role: 'user',
          content: `Create a 10-slide investor pitch deck JSON for:

ARTIST: ${resolvedArtistName}
GENRE: ${resolvedGenre}
COUNTRY: ${artist?.country || artist?.location || 'Global'}
BIO: ${resolvedBio.slice(0, 400)}
MONTHLY REVENUE: $${totalRevenue.toLocaleString()}
MONTHLY EXPENSES: $${totalExpenses.toLocaleString()}
ANNUAL REVENUE: $${(totalRevenue * 12).toLocaleString()}
REVENUE STREAMS: ${JSON.stringify(revenueStreams || {})}
RAISE TARGET: $${askAmount.toLocaleString()}
TOP SONGS: ${topSongs.map((s) => s.title).join(', ') || 'TBD'}
TOP MERCH: ${topMerch.map((m) => m.name).join(', ') || 'TBD'}
KEY MILESTONES: ${(milestones || []).slice(0, 8).map((m: any) => `${m.title} (${m.status})`).join('; ') || 'None'}

Return JSON with EXACTLY this schema (no extra fields, no nulls — use empty strings/arrays):

{
  "tagline": "string · ≤12 words",
  "vision": "string · 2 sentences about where the artist will be in 5 years",
  "problemStatement": "string · 2-3 sentences on the music industry pain point this artist solves",
  "solution": "string · 2-3 sentences on the artist's unique approach / product",
  "uniqueValue": "string · one short sentence",
  "marketSizing": {
    "tam": number (USD, total addressable market for the genre globally),
    "sam": number (serviceable available market for the artist's region/niche),
    "som": number (realistic 3-year market share),
    "currency": "USD",
    "narrative": "string · one short sentence interpreting the numbers"
  },
  "competitors": [
    { "name": "string", "differentiator": "string · ≤10 words" }
  ] (3 entries),
  "traction": "string · 2 sentences with concrete metrics",
  "keyHighlights": [
    { "label": "string · ≤3 words", "value": "string · ≤6 words", "icon": "trending|users|music|dollar|globe|trophy" }
  ] (4 entries),
  "useOfFundsBreakdown": {
    "marketing": number (% 0-100),
    "production": number (% 0-100),
    "team": number (% 0-100),
    "touring": number (% 0-100),
    "technology": number (% 0-100),
    "reserve": number (% 0-100)
  } (must sum to 100),
  "useOfFunds": "string · 2 sentence narrative summarising the breakdown",
  "team": [
    { "name": "string", "role": "string", "bio": "string · ≤15 words" }
  ] (1-3 entries — invent reasonable advisors if unknown),
  "keyMilestones": [
    { "quarter": "Q1 2026", "title": "string · ≤8 words", "metric": "string · ≤6 words" }
  ] (4 entries covering next 12 months),
  "askAmount": number,
  "askValuation": number (post-money USD valuation),
  "askEquity": number (% offered, 0-100),
  "askTerms": "string · 1 sentence",
  "askRunway": "string · e.g. '18 months runway'",
  "callToAction": "string · ≤10 words"
}`
        }
        ],
        { maxTokens: 3000, temperature: 0.7, requireJSON: true, label: 'business-plan-pitch-deck' }
      );
      try {
        aiContent = JSON.parse(rawContent || '{}');
        if (!aiContent || typeof aiContent !== 'object' || !aiContent.tagline) {
          throw new Error('AI returned empty or malformed JSON');
        }
      } catch (parseErr) {
        console.warn('⚠️ AI JSON parse failed, using fallback:', (parseErr as any)?.message);
        aiContent = buildFallbackAiContent();
        aiSource = 'fallback';
      }
    } catch (aiErr: any) {
      console.warn('⚠️ AI unavailable, using deterministic fallback:', aiErr?.message);
      aiContent = buildFallbackAiContent();
      aiSource = 'fallback';
    }

    // ─── Build slides[] array (deterministic, derived from AI content + artist images) ───
    const accentColor = '#a855f7';
    const slides = [
      {
        id: 'cover', type: 'cover', title: resolvedArtistName,
        subtitle: aiContent.tagline || 'Music is the universal language',
        image: coverImageUrl,
        meta: { genre: resolvedGenre, country: artist?.country || artist?.location || '' },
      },
      {
        id: 'problem', type: 'problem', title: 'The Problem',
        body: aiContent.problemStatement || '',
        icon: 'alert-triangle',
      },
      {
        id: 'solution', type: 'solution', title: 'Our Solution',
        body: aiContent.solution || '',
        highlight: aiContent.uniqueValue || '',
        icon: 'lightbulb',
      },
      {
        id: 'market', type: 'market', title: 'Market Opportunity',
        sizing: aiContent.marketSizing || { tam: 0, sam: 0, som: 0, currency: 'USD', narrative: '' },
        competitors: aiContent.competitors || [],
        icon: 'globe',
      },
      {
        id: 'traction', type: 'traction', title: 'Traction',
        body: aiContent.traction || '',
        highlights: aiContent.keyHighlights || [],
        gallery: galleryImages,
        icon: 'trending-up',
      },
      {
        id: 'product', type: 'product', title: 'Product · Catalog',
        songs: topSongs.map((s) => ({ title: s.title, image: s.coverArt, plays: s.plays || 0 })),
        merch: topMerch.map((m) => ({ name: m.name, image: m.images?.[0] || null, price: parseFloat(m.price as any) || 0 })),
      },
      {
        id: 'financials', type: 'financials', title: 'Financials',
        revenueStreams: revenueStreams || {},
        monthlyRevenue: totalRevenue,
        monthlyExpenses: totalExpenses,
        annualRevenue: totalRevenue * 12,
        profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue) * 100 : 0,
      },
      {
        id: 'use-of-funds', type: 'use-of-funds', title: 'Use of Funds',
        breakdown: aiContent.useOfFundsBreakdown || {},
        narrative: aiContent.useOfFunds || '',
      },
      {
        id: 'roadmap', type: 'roadmap', title: 'Roadmap · Next 12 Months',
        milestones: aiContent.keyMilestones || [],
      },
      {
        id: 'team', type: 'team', title: 'Team',
        members: aiContent.team || [],
        artistImage: coverImageUrl,
      },
      {
        id: 'ask', type: 'ask', title: 'The Ask',
        amount: aiContent.askAmount || askAmount,
        valuation: aiContent.askValuation || 0,
        equity: aiContent.askEquity || 0,
        terms: aiContent.askTerms || '',
        runway: aiContent.askRunway || '',
        cta: aiContent.callToAction || 'Join us',
      },
      {
        id: 'vision', type: 'vision', title: 'Vision',
        body: aiContent.vision || '',
        image: bannerImageUrl || coverImageUrl,
      },
    ];

    // Final shape persisted to DB — preserves AI fields + adds slides + images for richer UI
    const pitchData = {
      ...aiContent,
      // Ensure legacy fields stay populated for backwards compat
      tagline: aiContent.tagline || '',
      problemStatement: aiContent.problemStatement || '',
      solution: aiContent.solution || '',
      marketOpportunity: aiContent.marketSizing?.narrative || '',
      traction: aiContent.traction || '',
      useOfFunds: aiContent.useOfFunds || '',
      askAmount: aiContent.askAmount || askAmount,
      askTerms: aiContent.askTerms || '',
      // New rich fields
      slides,
      coverImageUrl,
      bannerImageUrl,
      galleryImages,
      accentColor,
      generatedAt: new Date().toISOString(),
      aiSource,
      version: 2,
    };

    // Save to DB
    const [existing] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId)).limit(1);

    if (existing) {
      await db.update(artistBusinessPlans)
        .set({ pitchDeckData: pitchData, updatedAt: new Date() })
        .where(eq(artistBusinessPlans.artistId, userId));
    } else {
      await db.insert(artistBusinessPlans).values({
        artistId: userId,
        pitchDeckData: pitchData,
      });
    }

    res.json({ success: true, pitchDeckData: pitchData, aiSource });
  } catch (error: any) {
    console.error('❌ Error generating pitch deck:', error?.status, error?.code, error?.message, error?.stack);
    res.status(500).json({
      error: 'Failed to generate pitch deck',
      detail: error?.message,
    });
  }
});

// ============================================
// POST /api/business-plan/:artistId/sync-engine — Sync Economic Engine data
// ============================================
router.post('/:artistId/sync-engine', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    await syncEngineToBusinessPlan(userId);

    // Return updated plan
    const [plan] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId)).limit(1);

    res.json({ success: true, plan });
  } catch (error: any) {
    console.error('❌ Error syncing engine:', error.message);
    res.status(500).json({ error: 'Failed to sync economic engine' });
  }
});

// ============================================
// POST /api/business-plan/:artistId/update-roadmap — Trigger dynamic roadmap update
// ============================================
router.post('/:artistId/update-roadmap', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await updateDynamicRoadmap(userId);

    // Return updated plan with milestones
    const [plan] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId)).limit(1);

    res.json({
      success: true,
      updated: result.updated,
      milestones: plan?.milestones || [],
      executionLog: plan?.roadmapExecutionLog || [],
    });
  } catch (error: any) {
    console.error('❌ Error updating roadmap:', error.message);
    res.status(500).json({ error: 'Failed to update roadmap' });
  }
});

// ============================================
// GET /api/business-plan/:artistId/dashboard — Combined engine + plan data
// ============================================
router.get('/:artistId/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    let targetId = parseInt(req.params.artistId);
    if (isNaN(targetId) || targetId <= 0) {
      const userId = await getUserPgId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      targetId = userId;
    }

    const dashboard = await getCombinedDashboardData(targetId);
    res.json({ success: true, ...dashboard });
  } catch (error: any) {
    console.error('❌ Error fetching dashboard:', error.message);
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

// ════════════════════════════════════════════════════════════════
// DYNAMIC ROADMAP ENGINE — Real-time profile scan + actions + news
// ════════════════════════════════════════════════════════════════

// ─── Full Roadmap Scan — scans profile, generates milestones, executes actions, publishes news ───
router.post('/:artistId/roadmap-scan', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await runRoadmapScan(userId);

    // Also return the updated plan
    const [plan] = await db.select().from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, userId)).limit(1);

    res.json({
      success: true,
      ...result,
      milestones: plan?.milestones || [],
      executionLog: plan?.roadmapExecutionLog || [],
      lastSync: plan?.lastRoadmapSync,
    });
  } catch (error: any) {
    console.error('❌ Error running roadmap scan:', error.message);
    res.status(500).json({ error: 'Failed to run roadmap scan' });
  }
});

// ─── Profile Snapshot — read-only profile state for the roadmap dashboard ───
router.get('/:artistId/profile-snapshot', authenticate, async (req: Request, res: Response) => {
  try {
    let targetId = parseInt(req.params.artistId);
    if (isNaN(targetId) || targetId <= 0) {
      const userId = await getUserPgId(req);
      if (!userId) return res.status(401).json({ error: 'Not authenticated' });
      targetId = userId;
    }

    const snapshot = await scanArtistProfile(targetId);
    res.json({ success: true, snapshot });
  } catch (error: any) {
    console.error('❌ Error scanning profile:', error.message);
    res.status(500).json({ error: 'Failed to scan profile' });
  }
});

// ─── AI Roadmap Advice — personalized recommendations based on profile state ───
router.post('/:artistId/roadmap-advice', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const snapshot = await scanArtistProfile(userId);
    const advice = await generateRoadmapAdvice(snapshot);

    res.json({ success: true, advice, snapshot });
  } catch (error: any) {
    console.error('❌ Error generating roadmap advice:', error.message);
    res.status(500).json({ error: 'Failed to generate advice' });
  }
});

// ─── Auto-Populate — full AI + data-driven business plan generation ───
router.post('/:artistId/auto-populate', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await autoPopulateBusinessPlan(userId);
    res.json({
      success: true,
      plan: result.plan,
      snapshot: result.snapshot,
      wasCreated: result.wasCreated,
      fieldsUpdated: result.fieldsUpdated,
    });
  } catch (error: any) {
    console.error('❌ Error auto-populating business plan:', error.message);
    res.status(500).json({ error: 'Failed to auto-populate business plan' });
  }
});

// ─── Re-adapt — light financial recalculation without AI (fast) ───
router.post('/:artistId/readapt', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const result = await readaptFinancials(userId);
    res.json({
      success: true,
      plan: result.plan,
      snapshot: result.snapshot,
      fieldsUpdated: result.fieldsUpdated,
    });
  } catch (error: any) {
    console.error('❌ Error re-adapting financials:', error.message);
    res.status(500).json({ error: 'Failed to re-adapt financials' });
  }
});

// ============================================
// POST /api/business-plan/:artistId/generate-full
// Full AI-generated business plan (async, polls via GET /:artistId/full-status)
// Accepts optional body inputs: revenueStreams, monthlyExpenses, financialGoals, businessName
// If provided, saves them to the DB before generation so the AI uses real numbers.
// ============================================
router.post('/:artistId/generate-full', authenticate, async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId) || artistId <= 0) {
      return res.status(400).json({ error: 'Invalid artist ID' });
    }

    const userId = await getUserPgId(req);
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    // Optional user-supplied base data
    const {
      revenueStreams: inputRevenue,
      monthlyExpenses: inputExpenses,
      financialGoals: inputGoals,
      businessName: inputBusinessName,
    } = req.body;

    // Check if already generating
    const [existing] = await db
      .select({ id: artistBusinessPlans.id, generationStatus: artistBusinessPlans.generationStatus })
      .from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, artistId))
      .limit(1);

    if (existing?.generationStatus === 'generating') {
      return res.status(409).json({ error: 'Business plan generation already in progress', status: 'generating' });
    }

    const defaultRevenue = { streaming: 0, merchandise: 0, liveShows: 0, licensing: 0, brandDeals: 0, courses: 0, crowdfunding: 0, other: 0 };
    const defaultExpenses = { studio: 0, marketing: 0, equipment: 0, travel: 0, contentCreation: 0, team: 0, distribution: 0, other: 0 };
    const defaultGoals = { monthlyTarget: 5000, yearlyTarget: 60000, savingsTarget: 10000, investmentAsk: 0 };

    // Upsert with status = generating and save user inputs if provided
    if (existing) {
      await db.update(artistBusinessPlans)
        .set({
          generationStatus: 'generating',
          generationError: null,
          updatedAt: new Date(),
          ...(inputRevenue ? { revenueStreams: inputRevenue } : {}),
          ...(inputExpenses ? { monthlyExpenses: inputExpenses } : {}),
          ...(inputGoals ? { financialGoals: inputGoals } : {}),
          ...(inputBusinessName ? { businessName: inputBusinessName } : {}),
        } as any)
        .where(eq(artistBusinessPlans.artistId, artistId));
    } else {
      await db.insert(artistBusinessPlans).values({
        artistId,
        generationStatus: 'generating',
        businessName: inputBusinessName || null,
        revenueStreams: inputRevenue || defaultRevenue,
        monthlyExpenses: inputExpenses || defaultExpenses,
        financialGoals: inputGoals || defaultGoals,
        milestones: [],
        budgetAllocation: { marketing: 35, production: 25, equipment: 15, touring: 15, content: 10 },
      } as any);
    }

    // Respond immediately — client polls
    res.status(202).json({ success: true, status: 'generating', artistId });

    // Background generation
    setImmediate(async () => {
      try {
        console.log(`[business-plan] ⚡ Full generation started for artist ${artistId}`);
        const plan = await generateFullBusinessPlan(artistId);

        await db.update(artistBusinessPlans)
          .set({
            aiGeneratedPlan: plan as any,
            generationStatus: 'completed',
            generationError: null,
            generatedAt: new Date(),
            updatedAt: new Date(),
          } as any)
          .where(eq(artistBusinessPlans.artistId, artistId));

        console.log(`[business-plan] ✅ Full business plan completed for artist ${artistId} — score: ${plan._meta?.business_plan_score}`);
      } catch (genErr: any) {
        const errMsg = genErr instanceof Error ? genErr.message : String(genErr);
        console.error(`[business-plan] ❌ Generation failed for artist ${artistId}:`, errMsg);
        await db.update(artistBusinessPlans)
          .set({ generationStatus: 'failed', generationError: errMsg, updatedAt: new Date() } as any)
          .where(eq(artistBusinessPlans.artistId, artistId))
          .catch(() => {});
      }
    });
  } catch (error: any) {
    console.error('❌ Error in generate-full:', error.message);
    res.status(500).json({ error: 'Failed to start business plan generation' });
  }
});

// ============================================
// GET /api/business-plan/:artistId/full-status — poll generation status (public)
// ============================================
router.get('/:artistId/full-status', async (req: Request, res: Response) => {
  try {
    const artistId = parseInt(req.params.artistId, 10);
    if (isNaN(artistId) || artistId <= 0) return res.status(400).json({ error: 'Invalid artist ID' });

    const [row] = await db
      .select({
        generationStatus: artistBusinessPlans.generationStatus,
        generationError: artistBusinessPlans.generationError,
        generatedAt: artistBusinessPlans.generatedAt,
        aiGeneratedPlan: artistBusinessPlans.aiGeneratedPlan,
      } as any)
      .from(artistBusinessPlans)
      .where(eq(artistBusinessPlans.artistId, artistId))
      .limit(1);

    if (!row) return res.json({ status: 'pending', hasPlan: false });

    res.json({
      status: row.generationStatus || 'pending',
      hasPlan: row.generationStatus === 'completed' && !!row.aiGeneratedPlan,
      generatedAt: row.generatedAt,
      error: row.generationError,
      plan: row.generationStatus === 'completed' ? row.aiGeneratedPlan : undefined,
    });
  } catch (error: any) {
    console.error('❌ Error fetching business plan status:', error.message);
    res.status(500).json({ error: 'Failed to fetch status' });
  }
});

export default router;
