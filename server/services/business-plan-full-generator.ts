/**
 * Business Plan Full Generator
 *
 * Generates a complete, investor-grade AI Business Plan JSON for an artist
 * in a single pass — pulling real data from:
 *   • Artist profile (name, bio, genre, socials)
 *   • Songs catalog (tracks, plays, cover art)
 *   • Merchandise catalog
 *   • Superstar Blueprint (if exists) — for brand/identity context
 *   • Economic Engine / Treasury (if exists) — for real financial figures
 *
 * Output: a structured BusinessPlanDoc with 10 modules:
 *   executive_summary, market_analysis, revenue_model, financial_plan,
 *   pitch_deck, roadmap, operations, team, risk_analysis, _meta
 */

import { callAI } from '../utils/smart-ai';
import { buildEnrichedSystemPrompt } from '../utils/ai-skills-injector';
import { db as pgDb } from '../../db';
import {
  users, songs, merchandise, artistBlueprints,
  artistBusinessPlans, artistEconomicProfile, artistTreasuryVault,
} from '../../db/schema';
import { eq, desc } from 'drizzle-orm';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BusinessPlanDoc {
  _meta: {
    schema_version: string;
    generated_at: string;
    artist_id: number;
    artist_name: string;
    ai_model: string;
    business_plan_score: number; // 0-100 overall readiness score
  };
  executive_summary: {
    vision: string;
    mission: string;
    tagline: string;
    elevator_pitch: string;
    key_highlights: Array<{ label: string; value: string; icon: string }>;
    investment_thesis: string;
  };
  market_analysis: {
    tam: number;
    sam: number;
    som: number;
    currency: 'USD';
    market_narrative: string;
    target_audience: {
      primary: string;
      secondary: string;
      age_range: string;
      psychographics: string[];
    };
    competitive_landscape: Array<{
      name: string;
      category: string;
      differentiator: string;
    }>;
    market_trends: string[];
    market_opportunity: string;
  };
  revenue_model: {
    primary_streams: Array<{
      name: string;
      description: string;
      monthly_estimate_usd: number;
      growth_potential: 'low' | 'medium' | 'high';
    }>;
    secondary_streams: Array<{
      name: string;
      description: string;
      monthly_estimate_usd: number;
    }>;
    total_monthly_revenue_usd: number;
    total_annual_revenue_usd: number;
    revenue_diversification_score: number; // 0-100
    monetization_strategy: string;
  };
  financial_plan: {
    monthly_revenue: number;
    monthly_expenses: number;
    monthly_profit: number;
    profit_margin_pct: number;
    annual_revenue: number;
    annual_expenses: number;
    annual_profit: number;
    investment_ask: number;
    pre_money_valuation: number;
    break_even_months: number;
    use_of_funds: {
      marketing: number;
      production: number;
      team: number;
      touring: number;
      technology: number;
      reserve: number;
    };
    use_of_funds_narrative: string;
    projections_12m: Array<{
      month: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
    projections_3yr: Array<{
      year: string;
      revenue: number;
      expenses: number;
      profit: number;
    }>;
  };
  pitch_deck: {
    slides: Array<{
      id: number;
      title: string;
      subtitle: string;
      body: string;
      key_stat?: string;
      key_stat_label?: string;
      bullet_points?: string[];
      chart_type?: 'bar' | 'pie' | 'line' | 'none';
      cta?: string;
    }>;
    ask_amount: number;
    ask_terms: string;
    closing_statement: string;
  };
  roadmap: {
    current_phase: string;
    phase_1: {
      name: string;
      timeframe: string;
      objective: string;
      milestones: Array<{ title: string; month: number; category: string; priority: string }>;
    };
    phase_2: {
      name: string;
      timeframe: string;
      objective: string;
      milestones: Array<{ title: string; month: number; category: string; priority: string }>;
    };
    phase_3: {
      name: string;
      timeframe: string;
      objective: string;
      milestones: Array<{ title: string; month: number; category: string; priority: string }>;
    };
    kpis: Record<string, string | number>;
  };
  operations: {
    business_model: string;
    distribution_strategy: string;
    tech_stack: string[];
    key_partnerships: string[];
    content_pipeline: string;
    release_cadence: string;
    fan_engagement_strategy: string;
    ip_protection_strategy: string;
  };
  team: {
    founder: { name: string; role: string; bio: string };
    core_team: Array<{ role: string; responsibility: string; status: 'existing' | 'hiring' }>;
    advisors: Array<{ area: string; value_add: string }>;
    team_narrative: string;
  };
  risk_analysis: {
    risks: Array<{
      category: string;
      risk: string;
      probability: 'low' | 'medium' | 'high';
      impact: 'low' | 'medium' | 'high';
      mitigation: string;
    }>;
    overall_risk_level: 'low' | 'medium' | 'high';
  };
}

// ─── Context Gatherer ─────────────────────────────────────────────────────────

async function gatherArtistContext(artistId: number) {
  // Artist profile
  const [artist] = await pgDb
    .select({
      id: users.id,
      artistName: users.artistName,
      firstName: users.firstName,
      lastName: users.lastName,
      biography: users.biography,
      genre: users.genre,
      genres: users.genres,
      country: users.country,
      location: users.location,
      instagramHandle: users.instagramHandle,
      twitterHandle: users.twitterHandle,
      youtubeChannel: users.youtubeChannel,
      spotifyUrl: users.spotifyUrl,
      profileImageUrl: users.profileImageUrl,
    })
    .from(users)
    .where(eq(users.id, artistId))
    .limit(1);

  if (!artist) throw new Error(`Artist ${artistId} not found`);

  const name =
    artist.artistName ||
    `${artist.firstName || ''} ${artist.lastName || ''}`.trim() ||
    'Independent Artist';

  // Songs catalog
  const catalog = await pgDb
    .select({ id: songs.id, title: songs.title, genre: songs.genre, plays: songs.plays })
    .from(songs)
    .where(eq(songs.userId, artistId))
    .orderBy(desc(songs.plays))
    .limit(20);

  // Merch
  const merch = await pgDb
    .select({ id: merchandise.id, name: merchandise.name, price: merchandise.price, category: merchandise.category })
    .from(merchandise)
    .where(eq(merchandise.userId, artistId))
    .limit(10);

  // Superstar Blueprint (for brand/identity context)
  const [blueprint] = await pgDb
    .select({ blueprintJson: artistBlueprints.blueprintJson, globalArtistScore: artistBlueprints.globalArtistScore })
    .from(artistBlueprints)
    .where(eq(artistBlueprints.artistId, artistId))
    .limit(1);

  // Economic Engine profile
  const [economic] = await pgDb
    .select({ isEnabled: artistEconomicProfile.isEnabled, monthlyOperatingCost: artistEconomicProfile.monthlyOperatingCost })
    .from(artistEconomicProfile)
    .where(eq(artistEconomicProfile.artistId, artistId))
    .limit(1).catch(() => [null]);

  // Treasury vault
  const [vault] = await pgDb
    .select({
      operationBalance: artistTreasuryVault.operationBalance,
      growthBalance: artistTreasuryVault.growthBalance,
      reserveBalance: artistTreasuryVault.reserveBalance,
      totalDeposited: artistTreasuryVault.totalDeposited,
    })
    .from(artistTreasuryVault)
    .where(eq(artistTreasuryVault.artistId, artistId))
    .limit(1).catch(() => [null]);

  // Existing manual business plan (for financial reference)
  const [existingPlan] = await pgDb
    .select({
      revenueStreams: artistBusinessPlans.revenueStreams,
      monthlyExpenses: artistBusinessPlans.monthlyExpenses,
      financialGoals: artistBusinessPlans.financialGoals,
      milestones: artistBusinessPlans.milestones,
    })
    .from(artistBusinessPlans)
    .where(eq(artistBusinessPlans.artistId, artistId))
    .limit(1);

  return { name, artist, catalog, merch, blueprint, economic, vault, existingPlan };
}

// ─── Prompt Builder ───────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  return `You are Boostify Business Architect — an elite AI combining the rigor of a McKinsey consultant, the creativity of a music industry CEO, and the precision of a venture capitalist.

Your task: Generate a complete, investor-grade Business Plan JSON for an independent music artist. The plan must be:
- Data-driven (use ALL real figures provided)
- Hyper-specific (no generic content — every sentence is for THIS artist)
- Actionable (specific numbers, timelines, names)
- Investor-grade (would pass scrutiny from a music-industry VC)

CRITICAL RULES:
1. Output ONLY valid JSON — no markdown, no explanation text
2. Use real numbers from the provided data — extrapolate intelligently
3. All financial figures in USD
4. All projections must be realistic and internally consistent
5. The pitch deck must have exactly 10 slides`;
}

function buildUserPrompt(ctx: Awaited<ReturnType<typeof gatherArtistContext>>): string {
  const { name, artist, catalog, merch, blueprint, economic, vault, existingPlan } = ctx;

  const totalPlays = catalog.reduce((s, c) => s + (c.plays || 0), 0);
  const songsList = catalog.length
    ? catalog.slice(0, 10).map(s => `"${s.title}"${s.genre ? ` (${s.genre})` : ''}${s.plays ? ` — ${s.plays} plays` : ''}`).join(', ')
    : 'No songs yet';
  const merchList = merch.length
    ? merch.map(m => `${m.name} ($${m.price || '?'})`).join(', ')
    : 'No merch yet';

  const blueprintContext = blueprint?.blueprintJson
    ? `\nSuperstar Blueprint Summary:
  - Artist Score: ${blueprint.globalArtistScore}/100
  - Brand Archetype: ${(blueprint.blueprintJson as any)?.identity?.brand_archetype || 'Unknown'}
  - Brand Essence: ${(blueprint.blueprintJson as any)?.artist_dna?.brand_essence || 'Unknown'}
  - Era: ${(blueprint.blueprintJson as any)?.era_evolution?.current_era || 'Genesis Era'}
  - Revenue Model: ${(blueprint.blueprintJson as any)?.monetization?.revenue_model || 'diversified'}
  - Projected Year-1 Revenue: $${(blueprint.blueprintJson as any)?.monetization?.projected_year1_revenue_usd || 0}`
    : '';

  const existingRevenue = existingPlan?.revenueStreams
    ? Object.values(existingPlan.revenueStreams as Record<string, number>).reduce((a, b) => a + b, 0)
    : 0;
  const existingExpenses = existingPlan?.monthlyExpenses
    ? Object.values(existingPlan.monthlyExpenses as Record<string, number>).reduce((a, b) => a + b, 0)
    : 0;
  const investmentAsk = (existingPlan?.financialGoals as any)?.investmentAsk || 0;

  const genres = artist.genres?.join(', ') || artist.genre || 'music';
  const primaryGenre = artist.genres?.[0] || artist.genre || 'music';

  // TAM estimation by genre
  const tamMap: Record<string, number> = {
    pop: 28_000_000_000, rock: 12_000_000_000, 'hip-hop': 18_000_000_000, rap: 18_000_000_000,
    electronic: 9_000_000_000, latin: 11_000_000_000, reggaeton: 8_000_000_000,
    jazz: 2_500_000_000, classical: 1_800_000_000, country: 6_000_000_000,
    rnb: 7_000_000_000, indie: 4_500_000_000, metal: 3_200_000_000,
  };
  const genreKey = primaryGenre.toLowerCase();
  const tam = tamMap[genreKey] || tamMap[Object.keys(tamMap).find(k => genreKey.includes(k)) || ''] || 26_000_000_000;

  return `Generate a complete Business Plan for this REAL music artist:

=== ARTIST PROFILE ===
ID: ${ctx.artist.id}
Name: ${name}
Genre(s): ${genres}
Country: ${artist.country || 'Unknown'}
City: ${artist.location || 'Unknown'}
Bio: ${artist.biography || 'No biography'}
Instagram: ${artist.instagramHandle ? `@${artist.instagramHandle}` : 'Not set'}
Twitter/X: ${artist.twitterHandle ? `@${artist.twitterHandle}` : 'Not set'}
YouTube: ${artist.youtubeChannel || 'Not set'}
Spotify: ${artist.spotifyUrl || 'Not set'}

=== CATALOG (${catalog.length} tracks, ${totalPlays.toLocaleString()} total plays) ===
${songsList}

=== MERCHANDISE (${merch.length} items) ===
${merchList}

=== FINANCIAL DATA ===
Monthly Revenue (from plan): $${existingRevenue.toLocaleString()}
Monthly Expenses (from plan): $${existingExpenses.toLocaleString()}
Engine Operating Cost: $${economic?.monthlyOperatingCost || 0}
Treasury Balance: $${vault ? Math.round(parseFloat(String(vault.operationBalance || 0)) + parseFloat(String(vault.growthBalance || 0)) + parseFloat(String(vault.reserveBalance || 0))) : 0}
Investment Ask (if set): $${investmentAsk.toLocaleString()}
${blueprintContext}

=== MARKET DATA ===
TAM (${primaryGenre} market): $${(tam / 1e9).toFixed(1)}B

=== INSTRUCTIONS ===
Generate a JSON that follows EXACTLY this structure. Be hyper-specific. All numbers must be internally consistent.

{
  "_meta": {
    "schema_version": "2.0",
    "generated_at": "${new Date().toISOString()}",
    "artist_id": ${ctx.artist.id},
    "artist_name": "${name}",
    "ai_model": "auto",
    "business_plan_score": <integer 0-100, honest assessment of business readiness>
  },
  "executive_summary": {
    "vision": "<1-2 sentence transformative vision for this artist's career in 5 years>",
    "mission": "<1 sentence mission statement — what they do and for whom>",
    "tagline": "<5-7 word memorable business tagline, NOT the artist tagline>",
    "elevator_pitch": "<3 sentences: who they are, what they do, why it matters to investors>",
    "key_highlights": [
      { "label": "Monthly Revenue", "value": "$<X,XXX>", "icon": "dollar" },
      { "label": "Catalog Size", "value": "${catalog.length} Tracks", "icon": "music" },
      { "label": "Total Streams", "value": "${totalPlays.toLocaleString()}", "icon": "play" },
      { "label": "Artist Score", "value": "${blueprint?.globalArtistScore || 0}/100", "icon": "trophy" },
      { "label": "Investment Ask", "value": "$<ask>", "icon": "trending" }
    ],
    "investment_thesis": "<Why invest in this artist right now — 2-3 sentences connecting market opportunity to their specific traction>"
  },
  "market_analysis": {
    "tam": ${tam},
    "sam": ${Math.round(tam * 0.06)},
    "som": ${Math.round(tam * 0.00072)},
    "currency": "USD",
    "market_narrative": "<2 sentences explaining the market opportunity in ${primaryGenre}>",
    "target_audience": {
      "primary": "<age range + lifestyle — e.g., '18-34 urban millennials who stream 3h+ daily'>",
      "secondary": "<secondary audience>",
      "age_range": "<e.g., 18-34>",
      "psychographics": ["<4 psychographic descriptors>"]
    },
    "competitive_landscape": [
      { "name": "<competitor 1>", "category": "<label/indie/streaming>", "differentiator": "<why this artist beats them>" },
      { "name": "<competitor 2>", "category": "<indie>", "differentiator": "<why this artist is different>" },
      { "name": "<competitor 3>", "category": "<platform>", "differentiator": "<unique advantage>" }
    ],
    "market_trends": ["<4-5 specific trends in ${primaryGenre} right now>"],
    "market_opportunity": "<Why this exact moment is the right time for this business>"
  },
  "revenue_model": {
    "primary_streams": [
      { "name": "Streaming Royalties", "description": "<specific strategy>", "monthly_estimate_usd": <integer>, "growth_potential": "high" },
      { "name": "Merchandise", "description": "<specific strategy>", "monthly_estimate_usd": <integer>, "growth_potential": "high" },
      { "name": "Live Performances", "description": "<specific strategy>", "monthly_estimate_usd": <integer>, "growth_potential": "medium" }
    ],
    "secondary_streams": [
      { "name": "Brand Deals / Sponsorships", "description": "<strategy>", "monthly_estimate_usd": <integer> },
      { "name": "Sync Licensing", "description": "<strategy>", "monthly_estimate_usd": <integer> },
      { "name": "Direct Fan Support", "description": "<strategy>", "monthly_estimate_usd": <integer> }
    ],
    "total_monthly_revenue_usd": <sum of all streams>,
    "total_annual_revenue_usd": <monthly * 12>,
    "revenue_diversification_score": <integer 0-100>,
    "monetization_strategy": "<2-3 sentence overall monetization strategy for this artist>"
  },
  "financial_plan": {
    "monthly_revenue": <integer>,
    "monthly_expenses": <integer>,
    "monthly_profit": <revenue - expenses>,
    "profit_margin_pct": <0-100 integer>,
    "annual_revenue": <monthly * 12>,
    "annual_expenses": <monthly expenses * 12>,
    "annual_profit": <annual revenue - annual expenses>,
    "investment_ask": <integer — realistic ask for this stage>,
    "pre_money_valuation": <integer — 2-4x annual revenue>,
    "break_even_months": <integer>,
    "use_of_funds": {
      "marketing": <0-100 pct>,
      "production": <0-100 pct>,
      "team": <0-100 pct>,
      "touring": <0-100 pct>,
      "technology": <0-100 pct>,
      "reserve": <0-100 pct — must sum to 100>
    },
    "use_of_funds_narrative": "<1-2 sentences explaining how the investment will be deployed>",
    "projections_12m": [
      { "month": "Month 1", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 2", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 3", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 4", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 5", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 6", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 7", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 8", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 9", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 10", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 11", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "month": "Month 12", "revenue": <integer>, "expenses": <integer>, "profit": <integer> }
    ],
    "projections_3yr": [
      { "year": "Year 1", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "year": "Year 2", "revenue": <integer>, "expenses": <integer>, "profit": <integer> },
      { "year": "Year 3", "revenue": <integer>, "expenses": <integer>, "profit": <integer> }
    ]
  },
  "pitch_deck": {
    "slides": [
      { "id": 1, "title": "Cover", "subtitle": "${name}", "body": "<artist tagline>", "key_stat": "<artist score>", "key_stat_label": "Artist Score" },
      { "id": 2, "title": "The Problem", "subtitle": "The Music Industry Is Broken", "body": "<2-3 sentences describing the problem independent artists face>", "bullet_points": ["<3 specific pain points>"] },
      { "id": 3, "title": "Our Solution", "subtitle": "<catchy solution headline>", "body": "<2-3 sentences on how this artist's business model solves the problem>", "bullet_points": ["<3 solution pillars>"] },
      { "id": 4, "title": "Market Opportunity", "subtitle": "$${(tam/1e9).toFixed(1)}B Market", "body": "<market opportunity narrative>", "key_stat": "$${(tam/1e9).toFixed(1)}B", "key_stat_label": "Total Addressable Market", "chart_type": "none" },
      { "id": 5, "title": "Traction", "subtitle": "Proven Momentum", "body": "<what they've already achieved>", "bullet_points": ["${catalog.length} tracks released", "${totalPlays.toLocaleString()} total streams", "${merch.length} merch products live"], "key_stat": "${totalPlays.toLocaleString()}", "key_stat_label": "Total Streams" },
      { "id": 6, "title": "Revenue Model", "subtitle": "Multiple Revenue Streams", "body": "<revenue model description>", "bullet_points": ["<3 primary revenue pillars>"], "chart_type": "pie" },
      { "id": 7, "title": "Financial Projections", "subtitle": "Path to Profitability", "body": "<projection narrative>", "chart_type": "line", "key_stat": "<Year 1 revenue>", "key_stat_label": "Year 1 Revenue" },
      { "id": 8, "title": "The Team", "subtitle": "Built for Scale", "body": "<why this team can execute>", "bullet_points": ["<3 team strengths>"] },
      { "id": 9, "title": "Use of Funds", "subtitle": "Capital Allocation Strategy", "body": "<how the investment will be deployed>", "bullet_points": ["Marketing & Audience Growth — XX%", "Production & Catalog — XX%", "Team & Operations — XX%"], "chart_type": "pie" },
      { "id": 10, "title": "The Ask", "subtitle": "Join the Journey", "body": "<closing investment invitation>", "key_stat": "$<ask amount>", "key_stat_label": "Investment Round", "cta": "<compelling CTA>", "bullet_points": ["<3 key investment terms or returns>"] }
    ],
    "ask_amount": <integer>,
    "ask_terms": "<investment terms — equity %, SAFE, revenue share, etc.>",
    "closing_statement": "<powerful 1-sentence closing statement for the pitch>"
  },
  "roadmap": {
    "current_phase": "<Phase name based on career stage>",
    "phase_1": {
      "name": "Foundation Phase",
      "timeframe": "Months 1–6",
      "objective": "<primary objective for first 6 months>",
      "milestones": [
        { "title": "<milestone>", "month": <1-6>, "category": "release|marketing|financial|branding|growth", "priority": "high|critical" },
        { "title": "<milestone>", "month": <1-6>, "category": "release|marketing|financial|branding|growth", "priority": "high|critical" },
        { "title": "<milestone>", "month": <1-6>, "category": "release|marketing|financial|branding|growth", "priority": "high" },
        { "title": "<milestone>", "month": <1-6>, "category": "release|marketing|financial|branding|growth", "priority": "high" }
      ]
    },
    "phase_2": {
      "name": "Growth Phase",
      "timeframe": "Months 7–18",
      "objective": "<primary objective for months 7-18>",
      "milestones": [
        { "title": "<milestone>", "month": <7-18>, "category": "tour|marketing|financial|growth", "priority": "high|critical" },
        { "title": "<milestone>", "month": <7-18>, "category": "tour|marketing|financial|growth", "priority": "high" },
        { "title": "<milestone>", "month": <7-18>, "category": "tour|marketing|financial|growth", "priority": "high" },
        { "title": "<milestone>", "month": <7-18>, "category": "tour|marketing|financial|growth", "priority": "medium" }
      ]
    },
    "phase_3": {
      "name": "Scale Phase",
      "timeframe": "Months 19–36",
      "objective": "<primary objective for months 19-36>",
      "milestones": [
        { "title": "<milestone>", "month": <19-36>, "category": "tour|financial|growth|branding", "priority": "high" },
        { "title": "<milestone>", "month": <19-36>, "category": "tour|financial|growth|branding", "priority": "high" },
        { "title": "<milestone>", "month": <19-36>, "category": "tour|financial|growth|branding", "priority": "medium" }
      ]
    },
    "kpis": {
      "stream_target_year1": <integer>,
      "merch_revenue_year1_usd": <integer>,
      "fan_count_year1": <integer>,
      "monthly_revenue_month12_usd": <integer>
    }
  },
  "operations": {
    "business_model": "<B2C streaming + direct-to-fan + B2B sync — tailored description>",
    "distribution_strategy": "<specific distribution and release strategy for this artist>",
    "tech_stack": ["<4-5 tools and platforms they use or should use>"],
    "key_partnerships": ["<4-5 strategic partnerships to pursue>"],
    "content_pipeline": "<content production and release pipeline description>",
    "release_cadence": "<monthly|quarterly|bi-monthly>",
    "fan_engagement_strategy": "<specific fan engagement tactics for this genre>",
    "ip_protection_strategy": "<how they protect their catalog and brand>"
  },
  "team": {
    "founder": {
      "name": "${name}",
      "role": "Founder, Artist & Creative Director",
      "bio": "<2 sentence bio based on their data>"
    },
    "core_team": [
      { "role": "Music Producer", "responsibility": "<what they do>", "status": "existing" },
      { "role": "Marketing Manager", "responsibility": "<what they do>", "status": "hiring" },
      { "role": "Business Manager", "responsibility": "<what they do>", "status": "hiring" }
    ],
    "advisors": [
      { "area": "Music Industry", "value_add": "<what type of advisor needed>" },
      { "area": "Digital Marketing", "value_add": "<what type of advisor needed>" }
    ],
    "team_narrative": "<2 sentences on the team's strengths and hiring plan>"
  },
  "risk_analysis": {
    "risks": [
      { "category": "Market", "risk": "<streaming market risk>", "probability": "medium", "impact": "medium", "mitigation": "<specific mitigation>" },
      { "category": "Operational", "risk": "<content production risk>", "probability": "low", "impact": "high", "mitigation": "<specific mitigation>" },
      { "category": "Financial", "risk": "<cash flow risk>", "probability": "medium", "impact": "high", "mitigation": "<specific mitigation>" },
      { "category": "Competition", "risk": "<competition risk>", "probability": "high", "impact": "medium", "mitigation": "<specific mitigation>" }
    ],
    "overall_risk_level": "medium"
  }
}`;
}

// ─── Main Generator ───────────────────────────────────────────────────────────

export async function generateFullBusinessPlan(artistId: number): Promise<BusinessPlanDoc> {
  const ctx = await gatherArtistContext(artistId);

  const baseSystemPrompt = buildSystemPrompt();
  const systemPrompt = await buildEnrichedSystemPrompt('business-plan', baseSystemPrompt, artistId);
  const userPrompt = buildUserPrompt(ctx);

  const raw = await callAI(
    'business_plan',
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    { maxTokens: 6000, temperature: 0.6, label: 'business-plan-full-generator' }
  );

  // Extract JSON from response
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI did not return valid JSON for business plan');
  }

  let parsed: BusinessPlanDoc;
  try {
    parsed = JSON.parse(jsonMatch[0]) as BusinessPlanDoc;
  } catch (e) {
    throw new Error(`Business plan JSON parse error: ${(e as Error).message}`);
  }

  // Ensure _meta is accurate
  parsed._meta = {
    ...parsed._meta,
    schema_version: '2.0',
    generated_at: new Date().toISOString(),
    artist_id: artistId,
    artist_name: ctx.name,
  };

  return parsed;
}
