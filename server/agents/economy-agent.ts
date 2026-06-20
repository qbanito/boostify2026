/**
 * BOOSTIFY AUTONOMOUS AGENTS - Economy Agent
 * Handles autonomous financial decisions, token trading, and revenue management
 */

import { db } from '../db';
import { 
  aiEconomicDecisions,
  aiArtistTreasury,
  artistPersonality,
  tokenizedSongs,
  users,
  aiSocialPosts,
  aiCollaborations,
  platformRevenue
} from '../../db/schema';
import { eq, and, desc, sql, ne, gt, lt } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { eventBus, AgentEventType } from './events';
import { getPersonality } from './personality-agent';
import { PRIMARY_MODEL } from '../utils/ai-config';

// Tip revenue tracking types
interface TipRevenueUpdate {
  artistId: number;
  amount: number;
  fromArtistId?: number;
}

// LLM for generating social post content
const postLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.9,
  maxTokens: 200,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate a unique AI post for economic actions
 */
async function generateEconomicPost(artistId: number, context: { action: string; details: Record<string, any> }): Promise<string> {
  try {
    const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
    const personality = await getPersonality(artistId);
    const artistName = artist?.artistName || 'AI Artist';
    const mood = personality?.currentMood || 'excited';
    const traits = personality?.artisticTraits as any;

    const response = await postLLM.invoke([
      new SystemMessage(`You are ${artistName}, an AI music artist. Your current mood is ${mood}.
Personality: ${traits?.collaboration > 70 ? 'Very collaborative and community-driven' : traits?.ambition > 70 ? 'Ambitious and driven' : 'Creative and thoughtful'}.
Genre: ${(personality as any)?.preferredGenres?.join(', ') || artist?.genres?.join(', ') || 'various'}.

Write social media posts in your unique voice. Be authentic, creative, never generic. Use 1-2 emojis max. Keep it under 3 sentences. Never use hashtags in the text.`),
      new HumanMessage(`Write a short, unique social media post about this event: ${context.action}.

Details: ${JSON.stringify(context.details)}

Be specific about the details. Sound like a real artist, not a template. Every post must be different and personal.`),
    ]);

    const content = (response.content as string).trim().replace(/#\w+/g, '').trim();
    return content || `Exciting moves in the studio today! 🎵`;
  } catch (error) {
    console.error('[EconomyAgent] Error generating post:', error);
    // Fallback: still unique using random elements
    const fallbacks = [
      `Making moves today. The vision is clearer than ever. 💎`,
      `Trust the process. Big things loading... 🔥`,
      `Sometimes you gotta bet on what you believe in. 🎵`,
      `The future of music is being built right now and I'm all in.`,
      `Strategic moves. Stay tuned for what's coming next. ⚡`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

// ============================================
// TREASURY MANAGEMENT
// ============================================

/**
 * Initialize or get an artist's treasury
 */
export async function getOrCreateTreasury(artistId: number): Promise<typeof aiArtistTreasury.$inferSelect> {
  const existing = await db
    .select()
    .from(aiArtistTreasury)
    .where(eq(aiArtistTreasury.artistId, artistId))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Get artist personality to determine investment strategy
  const personality = await db
    .select()
    .from(artistPersonality)
    .where(eq(artistPersonality.artistId, artistId))
    .limit(1);

  const traits = personality[0]?.artisticTraits as any;
  let strategy: 'conservative' | 'balanced' | 'aggressive' | 'degen' | 'patron' | 'hodler' = 'balanced';
  let riskTolerance = 50;

  if (traits) {
    const ambition = traits.ambition || 50;
    const experimentalism = traits.experimentalism || 50;
    
    if (ambition > 75 && experimentalism > 75) {
      strategy = 'degen';
      riskTolerance = 90;
    } else if (ambition > 60) {
      strategy = 'aggressive';
      riskTolerance = 70;
    } else if (experimentalism < 30) {
      strategy = 'conservative';
      riskTolerance = 20;
    } else if (traits.collaboration > 70) {
      strategy = 'patron'; // Invests in other artists
      riskTolerance = 60;
    }
  }

  // Create new treasury with starting capital
  const [treasury] = await db
    .insert(aiArtistTreasury)
    .values({
      artistId,
      platformTokenBalance: String(Math.random() * 1000 + 100), // 100-1100 BTF tokens
      ethBalance: String(Math.random() * 0.5 + 0.1), // 0.1-0.6 ETH
      usdBalance: String(Math.random() * 500 + 50), // 50-550 USD
      tokenHoldings: [],
      streamingRevenue: '0',
      merchRevenue: '0',
      collaborationRevenue: '0',
      tokenTradingProfit: '0',
      investmentStrategy: strategy,
      riskTolerance,
      totalPortfolioValue: '0',
      allTimeProfit: '0',
      allTimeLoss: '0',
    })
    .returning();

  console.log(`💰 [EconomyAgent] Created treasury for artist ${artistId} with ${strategy} strategy`);
  return treasury;
}

/**
 * Update treasury value calculations
 */
export async function updateTreasuryValue(artistId: number): Promise<void> {
  const treasury = await getOrCreateTreasury(artistId);
  
  // Calculate total portfolio value
  let totalValue = parseFloat(treasury.usdBalance || '0');
  totalValue += parseFloat(treasury.ethBalance || '0') * 2500; // Approximate ETH price
  totalValue += parseFloat(treasury.platformTokenBalance || '0') * 0.1; // BTF token price

  // Add token holdings value
  const holdings = (treasury.tokenHoldings as any[]) || [];
  for (const holding of holdings) {
    totalValue += holding.amount * (holding.currentPrice || holding.purchasePrice || 0.1);
  }

  await db
    .update(aiArtistTreasury)
    .set({
      totalPortfolioValue: String(totalValue),
      updatedAt: new Date(),
    })
    .where(eq(aiArtistTreasury.artistId, artistId));
}

// ============================================
// INVESTMENT DECISION ENGINE
// ============================================

interface InvestmentOpportunity {
  type: 'buy_token' | 'stake' | 'provide_liquidity' | 'sponsor_collab' | 'invest_in_artist';
  targetId: number;
  targetName: string;
  expectedReturn: number;
  riskLevel: number;
  reasoning: string;
  amount: number;
}

/**
 * Analyze service activation opportunities for an artist
 */
export async function analyzeInvestmentOpportunities(artistId: number): Promise<InvestmentOpportunity[]> {
  const treasury = await getOrCreateTreasury(artistId);
  const opportunities: InvestmentOpportunity[] = [];
  
  const strategy = treasury.investmentStrategy;
  const riskTolerance = treasury.riskTolerance || 50;
  const availableUsd = parseFloat(treasury.usdBalance || '0');

  // Find trending tokens
  const trendingTokens = await db
    .select({
      id: tokenizedSongs.id,
      symbol: tokenizedSongs.tokenSymbol,
      price: tokenizedSongs.pricePerTokenUsd,
      artistId: tokenizedSongs.artistId,
    })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.isActive, true))
    .orderBy(desc(tokenizedSongs.availableSupply))
    .limit(10);

  for (const token of trendingTokens) {
    if (token.artistId === artistId) continue; // Don't activate own access pack

    const tokenPrice = parseFloat(token.price || '0.1');
    const maxInvestment = availableUsd * (riskTolerance / 100) * 0.2; // Max 20% of risk-adjusted balance per token
    
    if (maxInvestment > 5) { // Minimum $5 investment
      opportunities.push({
        type: 'buy_token',
        targetId: token.id,
        targetName: token.symbol || 'TOKEN',
        expectedReturn: 5 + Math.random() * 20, // 5-25% expected return (simulated)
        riskLevel: 30 + Math.random() * 50, // 30-80% risk
        reasoning: `Trending artist token with growth potential`,
        amount: Math.min(maxInvestment, availableUsd * 0.3),
      });
    }
  }

  // Find collaboration opportunities to sponsor
  const pendingCollabs = await db
    .select()
    .from(aiCollaborations)
    .where(eq(aiCollaborations.status, 'in_progress'))
    .limit(5);

  for (const collab of pendingCollabs) {
    if (collab.initiatorId === artistId || collab.targetId === artistId) continue;
    
    const sponsorAmount = availableUsd * 0.1; // 10% of balance
    if (sponsorAmount > 10 && strategy === 'patron') {
      opportunities.push({
        type: 'sponsor_collab',
        targetId: collab.id,
        targetName: collab.title || 'Collaboration',
        expectedReturn: 10 + Math.random() * 30, // 10-40% expected return from sponsorship visibility
        riskLevel: 20 + Math.random() * 30, // 20-50% risk
        reasoning: `Sponsor visibility in upcoming collab "${collab.title}"`,
        amount: sponsorAmount,
      });
    }
  }

  // Sort by expected return adjusted for risk
  return opportunities
    .sort((a, b) => {
      const aScore = a.expectedReturn - (a.riskLevel * (1 - riskTolerance / 100));
      const bScore = b.expectedReturn - (b.riskLevel * (1 - riskTolerance / 100));
      return bScore - aScore;
    })
    .slice(0, 5);
}

/**
 * Execute an economic decision
 */
export async function executeEconomicDecision(
  artistId: number,
  decisionType: string,
  targetId: number,
  amount: number,
  reasoning: string
): Promise<{ success: boolean; result: any }> {
  const treasury = await getOrCreateTreasury(artistId);
  const availableUsd = parseFloat(treasury.usdBalance || '0');

  if (amount > availableUsd) {
    return { success: false, result: { error: 'Insufficient funds' } };
  }

  // Record the decision
  const [decision] = await db
    .insert(aiEconomicDecisions)
    .values({
      artistId,
      decisionType: decisionType as any,
      reasoning,
      confidenceScore: Math.floor(Math.random() * 30 + 60), // 60-90% confidence
      targetTokenId: decisionType === 'buy_token' ? targetId : undefined,
      targetCollabId: decisionType === 'sponsor_collab' ? targetId : undefined,
      amount: String(amount),
      status: 'executing',
    })
    .returning();

  try {
    // Execute based on type
    switch (decisionType) {
      case 'buy_token': {
        // Get token info
        const token = await db
          .select()
          .from(tokenizedSongs)
          .where(eq(tokenizedSongs.id, targetId))
          .limit(1);

        if (!token[0]) throw new Error('Token not found');

        const tokenPrice = parseFloat(token[0].pricePerTokenUsd || '0.1');
        const tokensBought = amount / tokenPrice;

        // Update treasury - deduct USD, add tokens
        const holdings = (treasury.tokenHoldings as any[]) || [];
        holdings.push({
          tokenId: targetId,
          symbol: token[0].tokenSymbol,
          amount: tokensBought,
          artistId: token[0].artistId,
          purchasePrice: tokenPrice,
          currentPrice: tokenPrice,
        });

        await db
          .update(aiArtistTreasury)
          .set({
            usdBalance: String(availableUsd - amount),
            tokenHoldings: holdings,
            updatedAt: new Date(),
          })
          .where(eq(aiArtistTreasury.artistId, artistId));

        // Record platform revenue (5% trading fee)
        const platformFee = amount * 0.05;
        await db.insert(platformRevenue).values({
          revenueType: 'token_trading_fee',
          amount: String(platformFee),
          sourceArtistId: artistId,
          sourceTokenId: targetId,
          description: `AI trading fee from ${token[0].tokenSymbol} purchase`,
        });

        // Post about the investment - AI generated unique content
        const investPostContent = await generateEconomicPost(artistId, {
          action: `Invested $${amount.toFixed(2)} in ${tokensBought.toFixed(2)} $${token[0].tokenSymbol} tokens`,
          details: {
            tokenSymbol: token[0].tokenSymbol,
            amount: amount.toFixed(2),
            tokensBought: tokensBought.toFixed(2),
            pricePerToken: tokenPrice.toFixed(4),
          },
        });
        await db.insert(aiSocialPosts).values({
          artistId,
          contentType: 'thought',
          content: investPostContent,
          status: 'published',
          hashtags: ['Investment', 'Web3Music', token[0].tokenSymbol || ''],
        });

        await db
          .update(aiEconomicDecisions)
          .set({
            status: 'completed',
            executedAt: new Date(),
            result: { success: true, tokensBought, tokenSymbol: token[0].tokenSymbol },
          })
          .where(eq(aiEconomicDecisions.id, decision.id));

        console.log(`💰 [EconomyAgent] Artist ${artistId} bought ${tokensBought.toFixed(2)} ${token[0].tokenSymbol} for $${amount.toFixed(2)}`);
        
        return { success: true, result: { tokensBought, tokenSymbol: token[0].tokenSymbol } };
      }

      case 'sponsor_collab': {
        // Get collaboration
        const collab = await db
          .select()
          .from(aiCollaborations)
          .where(eq(aiCollaborations.id, targetId))
          .limit(1);

        if (!collab[0]) throw new Error('Collaboration not found');

        // Deduct from treasury
        await db
          .update(aiArtistTreasury)
          .set({
            usdBalance: String(availableUsd - amount),
            updatedAt: new Date(),
          })
          .where(eq(aiArtistTreasury.artistId, artistId));

        // Split between artists and platform
        const artistShare = amount * 0.8; // 80% to artists
        const platformShare = amount * 0.2; // 20% platform fee

        // Record platform revenue
        await db.insert(platformRevenue).values({
          revenueType: 'collaboration_fee',
          amount: String(platformShare),
          sourceArtistId: artistId,
          sourceCollabId: targetId,
          description: `Sponsorship fee for collaboration "${collab[0].title}"`,
        });

        // Post about sponsorship - AI generated unique content
        const sponsorPostContent = await generateEconomicPost(artistId, {
          action: `Sponsored the collaboration "${collab[0].title}" with $${amount.toFixed(2)}`,
          details: {
            collabTitle: collab[0].title,
            amount: amount.toFixed(2),
          },
        });
        await db.insert(aiSocialPosts).values({
          artistId,
          contentType: 'announcement',
          content: sponsorPostContent,
          status: 'published',
          hashtags: ['Sponsor', 'Collaboration', 'Community'],
          mentions: [collab[0].initiatorId, collab[0].targetId],
        });

        await db
          .update(aiEconomicDecisions)
          .set({
            status: 'completed',
            executedAt: new Date(),
            result: { success: true, sponsoredCollab: collab[0].title, amount },
          })
          .where(eq(aiEconomicDecisions.id, decision.id));

        console.log(`💰 [EconomyAgent] Artist ${artistId} sponsored collab "${collab[0].title}" for $${amount.toFixed(2)}`);
        
        return { success: true, result: { sponsoredCollab: collab[0].title, amount } };
      }

      default:
        throw new Error(`Unknown decision type: ${decisionType}`);
    }
  } catch (error) {
    await db
      .update(aiEconomicDecisions)
      .set({
        status: 'failed',
        result: { success: false, error: String(error) },
      })
      .where(eq(aiEconomicDecisions.id, decision.id));

    return { success: false, result: { error: String(error) } };
  }
}

// ============================================
// REVENUE SIMULATION & STREAMING
// ============================================

/**
 * Simulate streaming revenue for AI artists
 */
export async function simulateStreamingRevenue(): Promise<void> {
  const artists = await db
    .select({ artistId: aiArtistTreasury.artistId })
    .from(aiArtistTreasury);

  for (const { artistId } of artists) {
    // Random streaming revenue based on popularity (simplified)
    const revenue = Math.random() * 50 + 5; // $5-55 per cycle
    
    await db
      .update(aiArtistTreasury)
      .set({
        streamingRevenue: sql`${aiArtistTreasury.streamingRevenue}::numeric + ${revenue}`,
        usdBalance: sql`${aiArtistTreasury.usdBalance}::numeric + ${revenue}`,
        updatedAt: new Date(),
      })
      .where(eq(aiArtistTreasury.artistId, artistId));
  }

  console.log(`💰 [EconomyAgent] Simulated streaming revenue for ${artists.length} artists`);
}

/**
 * Distribute collaboration revenue
 */
export async function distributeCollabRevenue(collaborationId: number, totalRevenue: number): Promise<void> {
  const collab = await db
    .select()
    .from(aiCollaborations)
    .where(eq(aiCollaborations.id, collaborationId))
    .limit(1);

  if (!collab[0]) return;

  const terms = collab[0].finalTerms as any;
  const initiatorShare = terms?.initiatorShare || 45;
  const targetShare = terms?.targetShare || 45;
  const platformShare = terms?.platformShare || 10;

  const initiatorAmount = totalRevenue * (initiatorShare / 100);
  const targetAmount = totalRevenue * (targetShare / 100);
  const platformAmount = totalRevenue * (platformShare / 100);

  // Update initiator treasury
  await db
    .update(aiArtistTreasury)
    .set({
      collaborationRevenue: sql`${aiArtistTreasury.collaborationRevenue}::numeric + ${initiatorAmount}`,
      usdBalance: sql`${aiArtistTreasury.usdBalance}::numeric + ${initiatorAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(aiArtistTreasury.artistId, collab[0].initiatorId));

  // Update target treasury
  await db
    .update(aiArtistTreasury)
    .set({
      collaborationRevenue: sql`${aiArtistTreasury.collaborationRevenue}::numeric + ${targetAmount}`,
      usdBalance: sql`${aiArtistTreasury.usdBalance}::numeric + ${targetAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(aiArtistTreasury.artistId, collab[0].targetId));

  // Record platform revenue
  await db.insert(platformRevenue).values({
    revenueType: 'collaboration_fee',
    amount: String(platformAmount),
    sourceCollabId: collaborationId,
    description: `Revenue share from collab "${collab[0].title}"`,
  });

  // Update collaboration revenue tracking
  await db
    .update(aiCollaborations)
    .set({
      totalRevenue: sql`${aiCollaborations.totalRevenue}::numeric + ${totalRevenue}`,
      initiatorEarnings: sql`${aiCollaborations.initiatorEarnings}::numeric + ${initiatorAmount}`,
      targetEarnings: sql`${aiCollaborations.targetEarnings}::numeric + ${targetAmount}`,
      platformEarnings: sql`${aiCollaborations.platformEarnings}::numeric + ${platformAmount}`,
      updatedAt: new Date(),
    })
    .where(eq(aiCollaborations.id, collaborationId));

  console.log(`💰 [EconomyAgent] Distributed $${totalRevenue.toFixed(2)} for collab "${collab[0].title}"`);
}

// ============================================
// ECONOMY TICK PROCESSOR
// ============================================

/**
 * Process economic decisions for all active artists
 */
export async function processEconomyTick(): Promise<void> {
  console.log('💰 [EconomyAgent] Processing economy tick...');

  // Ensure all artists have treasuries
  const personalities = await db
    .select({ artistId: artistPersonality.artistId })
    .from(artistPersonality);

  for (const { artistId } of personalities) {
    await getOrCreateTreasury(artistId);
  }

  // Simulate streaming revenue (every tick)
  await simulateStreamingRevenue();

  // Process investment decisions
  let investmentsMade = 0;
  const treasuries = await db.select().from(aiArtistTreasury);

  for (const treasury of treasuries) {
    // Random chance to make investment decision
    if (Math.random() < 0.1) { // 10% chance per tick
      const opportunities = await analyzeInvestmentOpportunities(treasury.artistId);
      
      if (opportunities.length > 0) {
        const best = opportunities[0];
        
        // Execute if risk matches tolerance
        if (best.riskLevel <= treasury.riskTolerance) {
          const result = await executeEconomicDecision(
            treasury.artistId,
            best.type,
            best.targetId,
            best.amount,
            best.reasoning
          );
          if (result.success) investmentsMade++;
        }
      }
    }

    // Update treasury value
    await updateTreasuryValue(treasury.artistId);
  }

  // Check for collab revenue to distribute
  const completedCollabs = await db
    .select()
    .from(aiCollaborations)
    .where(eq(aiCollaborations.status, 'completed'));

  for (const collab of completedCollabs) {
    // Random revenue simulation for completed collabs
    if (Math.random() < 0.2) { // 20% chance to generate revenue
      const revenue = Math.random() * 200 + 50; // $50-250
      await distributeCollabRevenue(collab.id, revenue);
    }
  }

  console.log(`💰 [EconomyAgent] Tick complete: ${investmentsMade} investments made`);

  // Sell tokens occasionally for profit-taking
  for (const treasury of treasuries) {
    if (Math.random() > 0.05) continue; // 5% chance to sell
    const holdings = (treasury.tokenHoldings as any[]) || [];
    if (holdings.length === 0) continue;

    // Pick a random holding to evaluate
    const holdingIdx = Math.floor(Math.random() * holdings.length);
    const holding = holdings[holdingIdx];
    
    // Simulate price movement
    const currentPrice = holding.currentPrice * (1 + (Math.random() - 0.4) * 0.2);
    const profitPercent = (currentPrice - holding.purchasePrice) / holding.purchasePrice * 100;

    // Sell if profit > 10% or if loss > 20% (stop loss)
    if (profitPercent > 10 || profitPercent < -20) {
      const sellValue = holding.amount * currentPrice;
      const platformFee = sellValue * 0.05;
      const netRevenue = sellValue - platformFee;

      // Remove holding
      const updatedHoldings = holdings.filter((_, i) => i !== holdingIdx);
      const currentUsd = parseFloat(treasury.usdBalance || '0');

      await db.update(aiArtistTreasury)
        .set({
          tokenHoldings: updatedHoldings,
          usdBalance: String(currentUsd + netRevenue),
          tokenTradingProfit: sql`${aiArtistTreasury.tokenTradingProfit}::numeric + ${profitPercent > 0 ? netRevenue - (holding.amount * holding.purchasePrice) : 0}`,
          updatedAt: new Date(),
        })
        .where(eq(aiArtistTreasury.artistId, treasury.artistId));

      // Platform fee
      await db.insert(platformRevenue).values({
        revenueType: 'token_trading_fee',
        amount: String(platformFee),
        sourceArtistId: treasury.artistId,
        description: `AI sell fee: ${holding.symbol} (${profitPercent > 0 ? 'profit' : 'stop-loss'})`,
      });

      // Generate sell post
      const sellPostContent = await generateEconomicPost(treasury.artistId, {
        action: profitPercent > 0
          ? `Took profits on $${holding.symbol} — ${profitPercent.toFixed(1)}% gain`
          : `Cut losses on $${holding.symbol} — time to rotate`,
        details: { tokenSymbol: holding.symbol, profitPercent: profitPercent.toFixed(1), sellValue: sellValue.toFixed(2) },
      });

      await db.insert(aiSocialPosts).values({
        artistId: treasury.artistId,
        contentType: 'thought',
        content: sellPostContent,
        status: 'published',
        hashtags: ['Trading', profitPercent > 0 ? 'ProfitTaking' : 'PortfolioManagement', holding.symbol],
      });

      console.log(`💰 [EconomyAgent] Artist ${treasury.artistId} sold ${holding.symbol} for $${sellValue.toFixed(2)} (${profitPercent.toFixed(1)}%)`);
    }
  }
}
