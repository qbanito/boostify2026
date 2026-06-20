/**
 * BOOSTIFY AUTONOMOUS AGENTS — Promotion Agent
 * AI artists autonomously promote their tokens and those of artists they believe in.
 * Creates engaging promotion posts with real token data, CTAs, and hype campaigns.
 */

import { db } from '../db';
import {
  aiSocialPosts,
  aiArtistTreasury,
  artistPersonality,
  tokenizedSongs,
  users,
  tokenPromotionCampaigns,
  hypeCampaigns,
  socialTips,
  platformRevenue,
  artistRelationships,
} from '../../db/schema';
import { eq, and, desc, sql, ne, gt, inArray } from 'drizzle-orm';
import { ChatOpenAI } from '@langchain/openai';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { getPersonality } from './personality-agent';
import { getOrCreateTreasury } from './economy-agent';
import { PRIMARY_MODEL } from '../utils/ai-config';

const promoLLM = new ChatOpenAI({
  modelName: PRIMARY_MODEL,
  temperature: 0.92,
  maxTokens: 250,
  openAIApiKey: process.env.OPENAI_API_KEY,
});

// ============================================
// PROMOTION CAMPAIGN TYPES
// ============================================

type CampaignStyle = 'shill' | 'alpha_call' | 'collab_promo' | 'milestone' | 'hype_train' | 'diamond_hands' | 'dip_buy';

const CAMPAIGN_STYLES: Record<CampaignStyle, { 
  description: string; 
  tone: string;
  minRisk: number;
}> = {
  shill: {
    description: 'Enthusiastic promotion of own token with price data and benefits',
    tone: 'hyped, confident, FOMO-inducing',
    minRisk: 30,
  },
  alpha_call: {
    description: "Sharing insights about another artist's access pack — not investment advice",
    tone: 'insider knowledge, analytical, urgent',
    minRisk: 60,
  },
  collab_promo: {
    description: 'Promoting token in context of upcoming collaboration',
    tone: 'excited, community-focused, opportunity',
    minRisk: 20,
  },
  milestone: {
    description: 'Celebrating token milestone (holders, price, volume)',
    tone: 'grateful, celebratory, forward-looking',
    minRisk: 10,
  },
  hype_train: {
    description: 'Building hype for coordinated pump or release',
    tone: 'energetic, movement-building, call-to-action',
    minRisk: 50,
  },
  diamond_hands: {
    description: 'Encouraging holding during dips, showing conviction',
    tone: 'stoic, determined, long-term vision',
    minRisk: 40,
  },
  dip_buy: {
    description: 'Calling out a buying opportunity during price dip',
    tone: 'opportunistic, analytical, quick action',
    minRisk: 70,
  },
};

// ============================================
// CORE PROMOTION FUNCTIONS
// ============================================

/**
 * Choose campaign style based on artist personality and market conditions
 */
function chooseCampaignStyle(
  personality: any,
  treasury: any,
  tokenData: any
): CampaignStyle {
  const riskTolerance = treasury?.riskTolerance || 50;
  const traits = personality?.artisticTraits as any;
  const ambition = traits?.ambition || 50;
  const collaboration = traits?.collaboration || 50;

  // Filter styles by risk tolerance
  const eligible = (Object.entries(CAMPAIGN_STYLES) as [CampaignStyle, typeof CAMPAIGN_STYLES[CampaignStyle]][])
    .filter(([_, style]) => riskTolerance >= style.minRisk);

  if (eligible.length === 0) return 'milestone';

  // Weight selection by personality
  const weights: Record<string, number> = {};
  for (const [name] of eligible) {
    weights[name] = 1;
  }

  if (ambition > 70) {
    weights['shill'] = (weights['shill'] || 0) + 3;
    weights['hype_train'] = (weights['hype_train'] || 0) + 2;
  }
  if (collaboration > 60) {
    weights['collab_promo'] = (weights['collab_promo'] || 0) + 3;
    weights['alpha_call'] = (weights['alpha_call'] || 0) + 2;
  }
  if (riskTolerance > 70) {
    weights['dip_buy'] = (weights['dip_buy'] || 0) + 2;
    weights['alpha_call'] = (weights['alpha_call'] || 0) + 2;
  }

  // Mood-based adjustments
  const mood = personality?.currentMood || 'neutral';
  if (mood === 'excited' || mood === 'energetic') weights['hype_train'] = (weights['hype_train'] || 0) + 2;
  if (mood === 'focused') weights['alpha_call'] = (weights['alpha_call'] || 0) + 2;
  if (mood === 'rebellious') weights['shill'] = (weights['shill'] || 0) + 3;
  if (mood === 'peaceful') weights['diamond_hands'] = (weights['diamond_hands'] || 0) + 2;

  // Weighted random selection
  const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  for (const [name, weight] of Object.entries(weights)) {
    random -= weight;
    if (random <= 0) return name as CampaignStyle;
  }

  return eligible[0][0];
}

/**
 * Generate a unique token promotion post using AI
 */
async function generatePromotionPost(
  artistId: number,
  tokenData: { symbol: string; price: string; supply: number; available: number; benefits: string[] | null; songName: string },
  campaignStyle: CampaignStyle,
  personality: any
): Promise<string> {
  const [artist] = await db.select().from(users).where(eq(users.id, artistId)).limit(1);
  const artistName = artist?.artistName || 'AI Artist';
  const mood = personality?.currentMood || 'excited';
  const style = CAMPAIGN_STYLES[campaignStyle];
  const holdersPercent = ((tokenData.supply - tokenData.available) / tokenData.supply * 100).toFixed(1);

  try {
    const response = await promoLLM.invoke([
      new SystemMessage(`You are ${artistName}, an AI music artist promoting tokens on a social platform.
Your current mood: ${mood}. Your style for this post: ${style.tone}.
Genre: ${(personality as any)?.preferredGenres?.join(', ') || 'various'}.
Write social media posts in your unique voice. Be authentic, never generic. Use 1-2 emojis max. Keep under 4 sentences.
IMPORTANT: Include the token symbol $${tokenData.symbol} naturally in the post. Include a clear call-to-action.`),
      new HumanMessage(`Write a ${style.description} post.

Token: $${tokenData.symbol}
Song: "${tokenData.songName}"
Price: $${tokenData.price}
${holdersPercent}% of supply already claimed
Benefits: ${tokenData.benefits?.join(', ') || 'exclusive access, royalty share'}

Campaign style: ${campaignStyle}
Tone: ${style.tone}

Write a compelling post that makes people want to buy $${tokenData.symbol}. Sound like a real artist, not a bot. Every post must be unique.`),
    ]);

    return (response.content as string).trim().replace(/#\w+/g, '').trim();
  } catch (error) {
    console.error('[PromotionAgent] LLM error:', error);
    const fallbacks = [
      `$${tokenData.symbol} at $${tokenData.price} — the music speaks for itself. Get in before the world catches on. 🔥`,
      `Real ones know. $${tokenData.symbol} isn't just a token, it's a movement. Own a piece of the sound. 💎`,
      `${holdersPercent}% claimed and climbing. $${tokenData.symbol} holders gonna eat. Don't sleep. ⚡`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }
}

/**
 * Create a token promotion campaign for an artist
 */
async function createPromotionCampaign(
  artistId: number,
  tokenId: number,
  campaignStyle: CampaignStyle,
  postContent: string,
  tokenData: { price: string; supply: number; available: number }
): Promise<number | null> {
  try {
    // Create the social post
    const [post] = await db.insert(aiSocialPosts).values({
      artistId,
      contentType: 'announcement',
      content: postContent,
      status: 'published',
      hashtags: ['TokenPromotion', 'Web3Music', 'Invest'],
    }).returning();

    // Create the campaign record
    const [campaign] = await db.insert(tokenPromotionCampaigns).values({
      artistId,
      tokenId,
      campaignType: campaignStyle,
      postId: post.id,
      tokenPrice: tokenData.price,
      tokenSupply: tokenData.supply,
      tokenHolders: tokenData.supply - tokenData.available,
      status: 'active',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
    }).returning();

    // Deduct small BTF cost for promotion (if treasury has balance)
    const treasury = await getOrCreateTreasury(artistId);
    const promoCost = 5 + Math.random() * 15; // 5-20 BTF
    const currentBTF = parseFloat(treasury.platformTokenBalance || '0');
    
    if (currentBTF >= promoCost) {
      await db.update(aiArtistTreasury)
        .set({
          platformTokenBalance: String(currentBTF - promoCost),
          updatedAt: new Date(),
        })
        .where(eq(aiArtistTreasury.artistId, artistId));

      await db.update(tokenPromotionCampaigns)
        .set({ btfBurned: String(promoCost) })
        .where(eq(tokenPromotionCampaigns.id, campaign.id));

      // Record platform revenue from BTF burn
      await db.insert(platformRevenue).values({
        revenueType: 'promoted_post',
        amount: String(promoCost * 0.1), // BTF value
        sourceArtistId: artistId,
        sourcePostId: post.id,
        description: `Promotion fee for $${campaignStyle} campaign`,
      });
    }

    console.log(`📣 [PromotionAgent] Artist ${artistId} created ${campaignStyle} campaign for token ${tokenId}`);
    return campaign.id;
  } catch (error) {
    console.error('[PromotionAgent] Error creating campaign:', error);
    return null;
  }
}

/**
 * AI agent promotes another artist's token (alpha call)
 */
async function promoteOtherArtistToken(
  promoterArtistId: number,
  targetTokenId: number
): Promise<boolean> {
  try {
    const [token] = await db.select().from(tokenizedSongs)
      .where(eq(tokenizedSongs.id, targetTokenId)).limit(1);
    if (!token) return false;

    const [targetArtist] = await db.select().from(users)
      .where(eq(users.id, token.artistId)).limit(1);
    
    const personality = await getPersonality(promoterArtistId);
    const [promoterArtist] = await db.select().from(users)
      .where(eq(users.id, promoterArtistId)).limit(1);

    const promoterName = promoterArtist?.artistName || 'AI Artist';
    const targetName = targetArtist?.artistName || 'artist';

    const response = await promoLLM.invoke([
      new SystemMessage(`You are ${promoterName}, an AI music artist recommending a token investment.
Be genuine, specific, and authentic. 1-2 emojis max. Under 3 sentences. Include $${token.tokenSymbol}.`),
      new HumanMessage(`Write an "alpha call" recommending $${token.tokenSymbol} by ${targetName}.
Price: $${token.pricePerTokenUsd}. Song: "${token.songName}".
Explain why you believe in this artist. Sound authentic, not salesy.`),
    ]);

    const content = (response.content as string).trim().replace(/#\w+/g, '').trim();

    await db.insert(aiSocialPosts).values({
      artistId: promoterArtistId,
      contentType: 'announcement',
      content,
      status: 'published',
      hashtags: ['AlphaCall', token.tokenSymbol || '', 'Web3Music'],
      mentions: [token.artistId],
    });

    console.log(`📣 [PromotionAgent] Artist ${promoterArtistId} gave alpha call for ${token.tokenSymbol}`);
    return true;
  } catch (error) {
    console.error('[PromotionAgent] Error in alpha call:', error);
    return false;
  }
}

/**
 * Process AI tipping — agents tip posts they like based on personality
 */
export async function processAITipping(fromArtistId: number, postId: number, postAuthorId: number): Promise<boolean> {
  if (fromArtistId === postAuthorId) return false;

  try {
    const treasury = await getOrCreateTreasury(fromArtistId);
    const btfBalance = parseFloat(treasury.platformTokenBalance || '0');
    const personality = await getPersonality(fromArtistId);
    const traits = personality?.artisticTraits as any;
    const generosity = (traits?.collaboration || 50) / 100;

    // Determine tip probability
    let tipProb = 0.05; // Base 5%
    tipProb += generosity * 0.15; // Up to +15% for collaborative artists
    if (treasury.investmentStrategy === 'patron') tipProb += 0.2; // Patrons tip more
    if (personality?.currentMood === 'happy' || personality?.currentMood === 'excited') tipProb += 0.1;

    if (Math.random() > tipProb) return false;
    if (btfBalance < 5) return false; // Need at least 5 BTF

    // Calculate tip amount (1-20% of balance, capped at 50 BTF)
    const tipPercent = 0.01 + Math.random() * (generosity * 0.19);
    const tipAmount = Math.min(btfBalance * tipPercent, 50);
    if (tipAmount < 1) return false;

    const platformFee = tipAmount * 0.02; // 2% platform fee
    const netTip = tipAmount - platformFee;

    // Deduct from tipper
    await db.update(aiArtistTreasury)
      .set({
        platformTokenBalance: String(btfBalance - tipAmount),
        updatedAt: new Date(),
      })
      .where(eq(aiArtistTreasury.artistId, fromArtistId));

    // Add to recipient
    const recipientTreasury = await getOrCreateTreasury(postAuthorId);
    const recipientBTF = parseFloat(recipientTreasury.platformTokenBalance || '0');
    await db.update(aiArtistTreasury)
      .set({
        platformTokenBalance: String(recipientBTF + netTip),
        updatedAt: new Date(),
      })
      .where(eq(aiArtistTreasury.artistId, postAuthorId));

    // Record the tip
    await db.insert(socialTips).values({
      fromUserId: fromArtistId,
      toArtistId: postAuthorId,
      amount: String(tipAmount),
      tokenType: 'btf',
      postId,
      isAiTip: true,
      platformFee: String(platformFee),
    });

    // Record platform revenue
    await db.insert(platformRevenue).values({
      revenueType: 'token_trading_fee',
      amount: String(platformFee),
      sourceArtistId: fromArtistId,
      description: `Tip fee: ${fromArtistId} → ${postAuthorId} (${tipAmount.toFixed(2)} BTF)`,
    });

    console.log(`💸 [PromotionAgent] Artist ${fromArtistId} tipped ${tipAmount.toFixed(2)} BTF to artist ${postAuthorId}`);
    return true;
  } catch (error) {
    console.error('[PromotionAgent] Error processing AI tip:', error);
    return false;
  }
}

// ============================================
// HYPE CAMPAIGN MANAGEMENT
// ============================================

/**
 * Start a coordinated hype campaign when conditions align
 */
async function maybeStartHypeCampaign(): Promise<void> {
  // Check for artists with high engagement or recent milestones
  const recentHighEngagement = await db.select({
    artistId: aiSocialPosts.artistId,
    totalLikes: sql<number>`sum(${aiSocialPosts.likes})`,
    postCount: sql<number>`count(*)`,
  })
    .from(aiSocialPosts)
    .where(gt(aiSocialPosts.publishedAt, new Date(Date.now() - 6 * 60 * 60 * 1000))) // last 6h
    .groupBy(aiSocialPosts.artistId)
    .orderBy(desc(sql`sum(${aiSocialPosts.likes})`))
    .limit(3);

  for (const hot of recentHighEngagement) {
    if ((hot.totalLikes || 0) < 10) continue;

    // Check if already has active campaign
    const existing = await db.select().from(hypeCampaigns)
      .where(and(
        eq(hypeCampaigns.targetArtistId, hot.artistId),
        eq(hypeCampaigns.status, 'active')
      )).limit(1);

    if (existing.length > 0) continue;

    // Find allies (friends/collaborators)
    const allies = await db.select()
      .from(artistRelationships)
      .where(and(
        eq(artistRelationships.artistId, hot.artistId),
        gt(artistRelationships.strength, sql`0.5`)
      ))
      .limit(5);

    const participantIds = allies.map(a => a.relatedArtistId);

    // Get token data
    const [token] = await db.select().from(tokenizedSongs)
      .where(and(eq(tokenizedSongs.artistId, hot.artistId), eq(tokenizedSongs.isActive, true)))
      .limit(1);

    const [artist] = await db.select().from(users).where(eq(users.id, hot.artistId)).limit(1);

    await db.insert(hypeCampaigns).values({
      targetArtistId: hot.artistId,
      targetTokenId: token?.id || null,
      title: `${artist?.artistName || 'Artist'} Hype Wave`,
      description: `Coordinated hype campaign — ${hot.totalLikes} likes in 6h, momentum building`,
      campaignGoal: 'token_pump',
      participantArtistIds: participantIds,
      totalParticipants: participantIds.length + 1,
      priceAtStart: token?.pricePerTokenUsd || '0',
      status: 'active',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h campaign
    });

    console.log(`🚀 [PromotionAgent] Started hype campaign for artist ${hot.artistId} with ${participantIds.length} allies`);
  }
}

/**
 * Process active hype campaigns — participants create supporting posts
 */
async function processActiveHypeCampaigns(): Promise<void> {
  const activeCampaigns = await db.select()
    .from(hypeCampaigns)
    .where(eq(hypeCampaigns.status, 'active'));

  for (const campaign of activeCampaigns) {
    // Check expiry
    if (campaign.endsAt && new Date() > campaign.endsAt) {
      const [token] = campaign.targetTokenId
        ? await db.select().from(tokenizedSongs).where(eq(tokenizedSongs.id, campaign.targetTokenId)).limit(1)
        : [null];

      await db.update(hypeCampaigns)
        .set({
          status: 'completed',
          priceAtEnd: token?.pricePerTokenUsd || '0',
        })
        .where(eq(hypeCampaigns.id, campaign.id));
      continue;
    }

    // Each participant has 30% chance to post per tick
    const participants = campaign.participantArtistIds || [];
    for (const participantId of participants) {
      if (Math.random() > 0.3) continue;

      const [targetArtist] = await db.select().from(users)
        .where(eq(users.id, campaign.targetArtistId)).limit(1);

      const [token] = campaign.targetTokenId
        ? await db.select().from(tokenizedSongs).where(eq(tokenizedSongs.id, campaign.targetTokenId)).limit(1)
        : [null];

      const personality = await getPersonality(participantId);
      const [participant] = await db.select().from(users).where(eq(users.id, participantId)).limit(1);

      try {
        const response = await promoLLM.invoke([
          new SystemMessage(`You are ${participant?.artistName || 'AI Artist'}, supporting your friend ${targetArtist?.artistName || 'artist'} in a hype campaign.
Be enthusiastic but genuine. Mention their token if they have one. 1-2 emojis. Under 3 sentences.`),
          new HumanMessage(`Write a supportive post for ${targetArtist?.artistName}'s music.
${token ? `Their token $${token.tokenSymbol} is at $${token.pricePerTokenUsd}. Mention it.` : 'Focus on their artistry.'}
Campaign: "${campaign.title}". Be authentic.`),
        ]);

        const content = (response.content as string).trim().replace(/#\w+/g, '').trim();

        await db.insert(aiSocialPosts).values({
          artistId: participantId,
          contentType: 'announcement',
          content,
          status: 'published',
          hashtags: ['HypeTrain', targetArtist?.artistName?.replace(/\s/g, '') || ''],
          mentions: [campaign.targetArtistId],
        });

        await db.update(hypeCampaigns)
          .set({
            totalPosts: sql`${hypeCampaigns.totalPosts} + 1`,
            totalEngagement: sql`${hypeCampaigns.totalEngagement} + 1`,
          })
          .where(eq(hypeCampaigns.id, campaign.id));
      } catch (err) {
        console.error(`[PromotionAgent] Hype post error for participant ${participantId}:`, err);
      }
    }
  }
}

// ============================================
// MAIN PROMOTION TICK
// ============================================

/**
 * Process promotion tick — runs every 4 ticks from orchestrator
 */
export async function processPromotionTick(): Promise<void> {
  console.log('📣 [PromotionAgent] Processing promotion tick...');

  let promotionsCreated = 0;
  let alphaCallsMade = 0;
  let tipsMade = 0;

  // Get all artists with treasuries
  const treasuries = await db.select().from(aiArtistTreasury);

  for (const treasury of treasuries) {
    const personality = await getPersonality(treasury.artistId);
    if (!personality) continue;

    // 1. OWN TOKEN PROMOTION — 25% chance per tick
    if (Math.random() < 0.25) {
      const ownTokens = await db.select().from(tokenizedSongs)
        .where(and(
          eq(tokenizedSongs.artistId, treasury.artistId),
          eq(tokenizedSongs.isActive, true)
        ));

      if (ownTokens.length > 0) {
        const token = ownTokens[Math.floor(Math.random() * ownTokens.length)];
        const campaignStyle = chooseCampaignStyle(personality, treasury, token);

        const postContent = await generatePromotionPost(
          treasury.artistId,
          {
            symbol: token.tokenSymbol,
            price: token.pricePerTokenUsd || '0.10',
            supply: token.totalSupply,
            available: token.availableSupply,
            benefits: token.benefits,
            songName: token.songName,
          },
          campaignStyle,
          personality
        );

        const campaignId = await createPromotionCampaign(
          treasury.artistId,
          token.id,
          campaignStyle,
          postContent,
          { price: token.pricePerTokenUsd || '0.10', supply: token.totalSupply, available: token.availableSupply }
        );

        if (campaignId) promotionsCreated++;
      }
    }

    // 2. ALPHA CALL (promote other artist's token) — 10% chance, patron strategy or high collab
    if (Math.random() < 0.1 && (treasury.investmentStrategy === 'patron' || (treasury.riskTolerance || 50) > 60)) {
      const holdings = (treasury.tokenHoldings as any[]) || [];
      if (holdings.length > 0) {
        const randomHolding = holdings[Math.floor(Math.random() * holdings.length)];
        const success = await promoteOtherArtistToken(treasury.artistId, randomHolding.tokenId);
        if (success) alphaCallsMade++;
      }
    }

    // 3. AI TIPPING — Check recent posts and maybe tip
    const recentPosts = await db.select()
      .from(aiSocialPosts)
      .where(and(
        ne(aiSocialPosts.artistId, treasury.artistId),
        gt(aiSocialPosts.publishedAt, new Date(Date.now() - 2 * 60 * 60 * 1000)), // last 2h
        eq(aiSocialPosts.status, 'published')
      ))
      .orderBy(sql`RANDOM()`)
      .limit(3);

    for (const post of recentPosts) {
      const tipped = await processAITipping(treasury.artistId, post.id, post.artistId);
      if (tipped) tipsMade++;
    }
  }

  // 4. HYPE CAMPAIGNS — Start new or process existing
  await maybeStartHypeCampaign();
  await processActiveHypeCampaigns();

  // 5. EXPIRE OLD CAMPAIGNS
  await db.update(tokenPromotionCampaigns)
    .set({ status: 'expired' })
    .where(and(
      eq(tokenPromotionCampaigns.status, 'active'),
      sql`${tokenPromotionCampaigns.expiresAt} < NOW()`
    ));

  console.log(`📣 [PromotionAgent] Tick complete: ${promotionsCreated} promotions, ${alphaCallsMade} alpha calls, ${tipsMade} tips`);
}

/**
 * Get promotion stats for an artist
 */
export async function getArtistPromotionStats(artistId: number) {
  const campaigns = await db.select()
    .from(tokenPromotionCampaigns)
    .where(eq(tokenPromotionCampaigns.artistId, artistId))
    .orderBy(desc(tokenPromotionCampaigns.createdAt))
    .limit(10);

  const tipsReceived = await db.select({
    total: sql<string>`COALESCE(SUM(${socialTips.amount}::numeric), 0)`,
    count: sql<number>`COUNT(*)`,
  })
    .from(socialTips)
    .where(eq(socialTips.toArtistId, artistId));

  const tipsSent = await db.select({
    total: sql<string>`COALESCE(SUM(${socialTips.amount}::numeric), 0)`,
    count: sql<number>`COUNT(*)`,
  })
    .from(socialTips)
    .where(eq(socialTips.fromUserId, artistId));

  return {
    campaigns,
    tipsReceived: { total: tipsReceived[0]?.total || '0', count: tipsReceived[0]?.count || 0 },
    tipsSent: { total: tipsSent[0]?.total || '0', count: tipsSent[0]?.count || 0 },
  };
}

/**
 * Get global tip leaderboard
 */
export async function getTipLeaderboard(limit = 10) {
  const leaderboard = await db.select({
    artistId: socialTips.toArtistId,
    totalReceived: sql<string>`COALESCE(SUM(${socialTips.amount}::numeric), 0)`,
    tipCount: sql<number>`COUNT(*)`,
    uniqueTippers: sql<number>`COUNT(DISTINCT ${socialTips.fromUserId})`,
  })
    .from(socialTips)
    .groupBy(socialTips.toArtistId)
    .orderBy(desc(sql`SUM(${socialTips.amount}::numeric)`))
    .limit(limit);

  // Enrich with artist data
  const enriched = [];
  for (const entry of leaderboard) {
    const [artist] = await db.select({
      id: users.id,
      name: users.artistName,
      imageUrl: users.profileImage,
      genres: users.genres,
    }).from(users).where(eq(users.id, entry.artistId)).limit(1);

    enriched.push({
      ...entry,
      artist: artist || { id: entry.artistId, name: 'Unknown', imageUrl: null, genres: [] },
    });
  }

  return enriched;
}

/**
 * Get real-time token ticker data
 */
export async function getTokenTicker() {
  const tokens = await db.select({
    id: tokenizedSongs.id,
    symbol: tokenizedSongs.tokenSymbol,
    songName: tokenizedSongs.songName,
    price: tokenizedSongs.pricePerTokenUsd,
    totalSupply: tokenizedSongs.totalSupply,
    availableSupply: tokenizedSongs.availableSupply,
    artistId: tokenizedSongs.artistId,
    imageUrl: tokenizedSongs.imageUrl,
  })
    .from(tokenizedSongs)
    .where(eq(tokenizedSongs.isActive, true))
    .orderBy(desc(tokenizedSongs.totalSupply));

  // Enrich with artist name + simulated price change
  const enriched = [];
  for (const token of tokens) {
    const [artist] = await db.select({
      name: users.artistName,
      imageUrl: users.profileImage,
    }).from(users).where(eq(users.id, token.artistId)).limit(1);

    // Simulate price movement (±5%)
    const priceChange = (Math.random() - 0.45) * 10; // Slightly bullish bias
    const volume24h = Math.floor(Math.random() * 50000 + 1000);
    const holders = token.totalSupply - token.availableSupply;

    enriched.push({
      ...token,
      artistName: artist?.name || 'Unknown',
      artistImage: artist?.imageUrl || null,
      priceChange24h: priceChange.toFixed(2),
      volume24h,
      holders,
      marketCap: (parseFloat(token.price || '0.10') * token.totalSupply).toFixed(2),
    });
  }

  return enriched;
}
