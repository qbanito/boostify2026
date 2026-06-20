/**
 * CRYPTO COMMUNITY — API Routes
 * Endpoints for community management, posts, proposals, BoostiSwap integration,
 * and Apify-powered outreach with AI content generation
 */

import { Router } from 'express';
import { getCryptoCommunityAgent } from '../services/crypto-community/crypto-community-agent';
import { getCryptoAudienceScraper } from '../services/crypto-community/audience-scraper';
import {
  generateOutreachPost,
  generateCampaignTemplate,
  generateCampaignPosts,
  executeCampaignBatch,
  loadArtistContext,
} from '../services/crypto-community/outreach-generator';
import { db } from '../db';
import { eq, and, desc, sql } from 'drizzle-orm';
import {
  cryptoOutreachCampaigns,
  cryptoOutreachContacts,
  cryptoOutreachLog,
  cryptoCommunityMembers,
} from '../../db/crypto-community-schema';
import { tokenizedSongs, tokenPurchases, artistBusinessPlans, users } from '../../db/schema';

const router = Router();

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3';
const COINGECKO_PRO_BASE = 'https://pro-api.coingecko.com/api/v3';

function getCoinGeckoHeaders(): Record<string, string> {
  const key = process.env.COINGECKO_API_KEY;
  return key ? { 'x-cg-pro-api-key': key } : {};
}

function getCoinGeckoBase(): string {
  return process.env.COINGECKO_API_KEY ? COINGECKO_PRO_BASE : COINGECKO_BASE;
}

function safeUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '#') return null;
  if (!(trimmed.startsWith('http://') || trimmed.startsWith('https://'))) return null;
  return trimmed;
}

function inferPlatformFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('telegram')) return 'Telegram';
  if (lower.includes('discord')) return 'Discord';
  if (lower.includes('reddit')) return 'Reddit';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'X';
  if (lower.includes('youtube')) return 'YouTube';
  if (lower.includes('facebook')) return 'Facebook';
  if (lower.includes('medium')) return 'Medium';
  if (lower.includes('forum')) return 'Forum';
  return 'Website';
}

function compactCommunities(links: Array<{ platform: string; url: string }>, maxItems = 5) {
  const seen = new Set<string>();
  const ordered = links.filter((item) => {
    if (!item.url || seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });

  const priority = ['Telegram', 'Discord', 'Reddit', 'X', 'Forum', 'Website'];
  ordered.sort((a, b) => {
    const ai = priority.indexOf(a.platform);
    const bi = priority.indexOf(b.platform);
    const av = ai === -1 ? 999 : ai;
    const bv = bi === -1 ? 999 : bi;
    return av - bv;
  });

  return ordered.slice(0, maxItems);
}

const REAL_CRYPTO_COMMUNITIES_FALLBACK = [
  {
    id: 'bitcoin',
    name: 'Bitcoin',
    symbol: 'BTC',
    rank: 1,
    image: 'https://assets.coingecko.com/coins/images/1/large/bitcoin.png',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Reddit', url: 'https://www.reddit.com/r/Bitcoin/' },
      { platform: 'X', url: 'https://x.com/bitcoin' },
      { platform: 'Website', url: 'https://bitcoin.org/' },
    ],
  },
  {
    id: 'ethereum',
    name: 'Ethereum',
    symbol: 'ETH',
    rank: 2,
    image: 'https://assets.coingecko.com/coins/images/279/large/ethereum.png',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Discord', url: 'https://discord.com/invite/ethereum-org' },
      { platform: 'Reddit', url: 'https://www.reddit.com/r/ethereum/' },
      { platform: 'Website', url: 'https://ethereum.org/' },
    ],
  },
  {
    id: 'solana',
    name: 'Solana',
    symbol: 'SOL',
    rank: 3,
    image: 'https://assets.coingecko.com/coins/images/4128/large/solana.png',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Discord', url: 'https://discord.gg/solana' },
      { platform: 'X', url: 'https://x.com/solana' },
      { platform: 'Website', url: 'https://solana.com/' },
    ],
  },
  {
    id: 'chainlink',
    name: 'Chainlink',
    symbol: 'LINK',
    rank: 4,
    image: 'https://assets.coingecko.com/coins/images/877/large/chainlink-new-logo.png',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Discord', url: 'https://discord.gg/chainlink' },
      { platform: 'Reddit', url: 'https://www.reddit.com/r/Chainlink/' },
      { platform: 'Website', url: 'https://chain.link/' },
    ],
  },
  {
    id: 'polygon',
    name: 'Polygon',
    symbol: 'POL',
    rank: 5,
    image: 'https://assets.coingecko.com/coins/images/4713/large/polygon.png',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Discord', url: 'https://discord.gg/polygon' },
      { platform: 'X', url: 'https://x.com/0xPolygon' },
      { platform: 'Website', url: 'https://polygon.technology/' },
    ],
  },
  {
    id: 'arbitrum',
    name: 'Arbitrum',
    symbol: 'ARB',
    rank: 6,
    image: 'https://assets.coingecko.com/coins/images/16547/large/photo_2023-03-29_21.47.00.jpeg',
    members: null,
    activityScore: null,
    communities: [
      { platform: 'Discord', url: 'https://discord.gg/arbitrum' },
      { platform: 'Reddit', url: 'https://www.reddit.com/r/Arbitrum/' },
      { platform: 'Website', url: 'https://arbitrum.io/' },
    ],
  },
];

// ── Config ──

router.get('/:artistId/config', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const status = await agent.getChannelStatus(Number(req.params.artistId));
    res.json({ success: true, ...status });
  } catch (error: any) {
    console.warn('[crypto-community/config] fallback:', error?.message || error);
    res.json({
      success: true,
      configured: false,
      channels: { telegram: false, discord: false, twitter: false },
      linkedToken: null,
    });
  }
});

router.put('/:artistId/config', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const config = await agent.upsertConfig(Number(req.params.artistId), req.body);
    res.json({ success: true, config });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Channel Status ──

router.get('/:artistId/channels', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const status = await agent.getChannelStatus(Number(req.params.artistId));
    res.json({ success: true, channels: status.channels, linkedToken: status.linkedToken });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Posts ──

router.get('/:artistId/posts', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const limit = Number(req.query.limit) || 20;
    const posts = await agent.getPosts(Number(req.params.artistId), limit);
    res.json({ success: true, posts });
  } catch (error: any) {
    console.warn('[crypto-community/posts] fallback:', error?.message || error);
    res.json({ success: true, posts: [] });
  }
});

router.post('/:artistId/posts', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const { postType, content, channels, tokenSymbol, tokenPrice, priceChange, generatedByAi } = req.body;

    if (!postType || !content) {
      return res.status(400).json({ success: false, error: 'postType and content required' });
    }

    const result = await agent.createPost(Number(req.params.artistId), {
      postType,
      content,
      channels: channels || { telegram: true, discord: true, twitter: true },
      tokenSymbol,
      tokenPrice,
      priceChange,
      generatedByAi: generatedByAi || false,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// AI-generated auto-post
router.post('/:artistId/posts/auto', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const { context, postType } = req.body;

    const result = await agent.createPost(Number(req.params.artistId), {
      postType: postType || 'news',
      content: context || 'Community update',
      channels: { telegram: true, discord: true, twitter: true },
      generatedByAi: true,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Proposals ──

router.get('/:artistId/proposals', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const proposals = await agent.getProposals(Number(req.params.artistId));
    res.json({ success: true, proposals });
  } catch (error: any) {
    console.warn('[crypto-community/proposals] fallback:', error?.message || error);
    res.json({ success: true, proposals: [] });
  }
});

router.post('/:artistId/proposals', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const { title, description, proposalType, options, minTokensToVote, endsAt, linkedTokenId } = req.body;

    if (!title || !description || !options?.length) {
      return res.status(400).json({ success: false, error: 'title, description, and options required' });
    }

    const proposal = await agent.createProposal(Number(req.params.artistId), {
      title,
      description,
      proposalType,
      options,
      minTokensToVote,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      linkedTokenId,
    });

    res.json({ success: true, proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:artistId/proposals/:proposalId/vote', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const { memberId, optionId } = req.body;

    if (!memberId || optionId === undefined) {
      return res.status(400).json({ success: false, error: 'memberId and optionId required' });
    }

    const result = await agent.voteOnProposal(
      Number(req.params.proposalId),
      Number(memberId),
      Number(optionId),
    );

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Stats ──

router.get('/:artistId/stats', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const stats = await agent.getStats(Number(req.params.artistId));
    res.json({ success: true, ...stats });
  } catch (error: any) {
    console.warn('[crypto-community/stats] fallback:', error?.message || error);
    res.json({
      success: true,
      totalPosts: 0,
      totalMembers: 0,
      activeProposals: 0,
      channelsActive: { telegram: false, discord: false, twitter: false },
      tokenStats: null,
    });
  }
});

// ── Real crypto communities (live feed + fallback) ──
router.get('/:artistId/real-communities', async (req, res) => {
  const limit = Math.min(10, Math.max(3, Number(req.query.limit) || 6));
  const base = getCoinGeckoBase();
  const headers = getCoinGeckoHeaders();

  try {
    const trendingRes = await fetch(`${base}/search/trending`, { headers });
    if (!trendingRes.ok) {
      throw new Error(`CoinGecko trending error: ${trendingRes.status}`);
    }

    const trendingJson = await trendingRes.json();
    const candidateCoins = (trendingJson?.coins || []).slice(0, Math.max(limit, 6));

    const communities = await Promise.all(candidateCoins.map(async (coinWrap: any) => {
      const coin = coinWrap?.item;
      if (!coin?.id) return null;

      try {
        const coinRes = await fetch(
          `${base}/coins/${coin.id}?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false`,
          { headers },
        );

        if (!coinRes.ok) return null;
        const details = await coinRes.json();
        const links = details?.links || {};
        const socialLinks: Array<{ platform: string; url: string }> = [];

        const homepage = safeUrl(Array.isArray(links.homepage) ? links.homepage[0] : null);
        if (homepage) socialLinks.push({ platform: 'Website', url: homepage });

        if (Array.isArray(links.chat_url)) {
          for (const chat of links.chat_url) {
            const u = safeUrl(chat);
            if (u) socialLinks.push({ platform: inferPlatformFromUrl(u), url: u });
          }
        }

        if (Array.isArray(links.official_forum_url)) {
          for (const forum of links.official_forum_url) {
            const u = safeUrl(forum);
            if (u) socialLinks.push({ platform: inferPlatformFromUrl(u), url: u });
          }
        }

        const subreddit = safeUrl(links.subreddit_url);
        if (subreddit) socialLinks.push({ platform: 'Reddit', url: subreddit });

        if (links.twitter_screen_name && typeof links.twitter_screen_name === 'string') {
          const handle = links.twitter_screen_name.replace(/^@/, '').trim();
          if (handle) socialLinks.push({ platform: 'X', url: `https://x.com/${handle}` });
        }

        const normalizedLinks = compactCommunities(socialLinks, 5);
        if (normalizedLinks.length === 0) return null;

        const communityData = details?.community_data || {};
        const members =
          Number(communityData.telegram_channel_user_count)
          || Number(communityData.reddit_subscribers)
          || Number(communityData.twitter_followers)
          || null;

        const activityScore =
          (Number(communityData.reddit_average_posts_48h) || 0)
          + (Number(communityData.reddit_average_comments_48h) || 0)
          + (Number(communityData.reddit_subscribers) || 0) / 1000;

        return {
          id: details.id,
          name: details.name,
          symbol: String(details.symbol || '').toUpperCase(),
          rank: details.market_cap_rank || coin.market_cap_rank || null,
          image: details.image?.large || details.image?.small || coin.large || coin.thumb || '',
          members,
          activityScore: Number.isFinite(activityScore) ? Math.round(activityScore * 10) / 10 : null,
          communities: normalizedLinks,
        };
      } catch {
        return null;
      }
    }));

    const cleaned = communities
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const ar = Number(a?.rank) || 9999;
        const br = Number(b?.rank) || 9999;
        return ar - br;
      })
      .slice(0, limit);

    if (cleaned.length > 0) {
      return res.json({
        success: true,
        source: 'coingecko',
        communities: cleaned,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      source: 'fallback',
      communities: REAL_CRYPTO_COMMUNITIES_FALLBACK.slice(0, limit),
      updatedAt: new Date().toISOString(),
    });
  } catch {
    res.json({
      success: true,
      source: 'fallback',
      communities: REAL_CRYPTO_COMMUNITIES_FALLBACK.slice(0, limit),
      updatedAt: new Date().toISOString(),
    });
  }
});

// ── Overview: aggregates artist tokens + business plan + community KPIs ──
// Powers the unified "Crypto Hub" panel: token economy + roadmap + financial goals
router.get('/:artistId/overview', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    if (!Number.isFinite(artistId)) {
      return res.status(400).json({ success: false, error: 'invalid artistId' });
    }

    const [tokens, plan, holdersAgg, membersAgg, artistRow] = await Promise.all([
      db.select({
        id: tokenizedSongs.id,
        tokenSymbol: tokenizedSongs.tokenSymbol,
        tokenName: tokenizedSongs.songName,
        contractAddress: tokenizedSongs.contractAddress,
        totalSupply: tokenizedSongs.totalSupply,
        availableSupply: tokenizedSongs.availableSupply,
        pricePerTokenUsd: tokenizedSongs.pricePerTokenUsd,
        royaltyPercentageArtist: tokenizedSongs.royaltyPercentageArtist,
        isActive: tokenizedSongs.isActive,
        imageUrl: tokenizedSongs.imageUrl,
        createdAt: tokenizedSongs.createdAt,
      })
        .from(tokenizedSongs)
        .where(eq(tokenizedSongs.artistId, artistId))
        .orderBy(desc(tokenizedSongs.createdAt))
        .limit(20),
      db.select().from(artistBusinessPlans).where(eq(artistBusinessPlans.artistId, artistId)).limit(1),
      db.select({
        tokenId: tokenPurchases.tokenizedSongId,
        holders: sql<number>`count(distinct coalesce(${tokenPurchases.buyerUserId}::text, ${tokenPurchases.buyerWalletAddress}))`.as('holders'),
        totalSold: sql<string>`coalesce(sum(${tokenPurchases.amountTokens}), 0)`.as('totalSold'),
      })
        .from(tokenPurchases)
        .where(eq(tokenPurchases.status, 'confirmed'))
        .groupBy(tokenPurchases.tokenizedSongId),
      db.select({ count: sql<number>`count(*)`.as('count') })
        .from(cryptoCommunityMembers)
        .where(eq(cryptoCommunityMembers.artistId, artistId)),
      db.select({ artistName: users.artistName, displayName: users.displayName })
        .from(users).where(eq(users.id, artistId)).limit(1),
    ]);

    const holdersByToken = new Map<number, { holders: number; totalSold: string }>();
    for (const h of holdersAgg) holdersByToken.set(h.tokenId, { holders: Number(h.holders) || 0, totalSold: String(h.totalSold || '0') });

    const enrichedTokens = tokens.map(t => {
      const h = holdersByToken.get(t.id);
      const total = Number(t.totalSupply) || 0;
      const avail = Number(t.availableSupply) || 0;
      const sold = total - avail;
      const soldPct = total > 0 ? Math.round((sold / total) * 1000) / 10 : 0;
      return {
        ...t,
        holders: h?.holders || 0,
        soldAmount: sold,
        soldPercentage: soldPct,
      };
    });

    // Business plan summary
    const bp = plan[0];
    let businessPlan: any = null;
    if (bp) {
      const revenueStreams = bp.revenueStreams || {} as any;
      const monthlyRevenueEstimate = Object.values(revenueStreams).reduce((s: number, v: any) => s + (Number(v) || 0), 0);
      const milestones = (bp.milestones || []) as any[];
      const activeMilestones = milestones.filter(m => m.status === 'planned' || m.status === 'in_progress');
      const completedCount = milestones.filter(m => m.status === 'completed').length;
      const goal = bp.financialGoals?.monthlyTarget || 0;
      const goalProgress = goal > 0 ? Math.min(100, Math.round((monthlyRevenueEstimate / goal) * 100)) : 0;

      businessPlan = {
        businessName: bp.businessName,
        missionStatement: bp.missionStatement,
        revenueStreams,
        monthlyRevenueEstimate,
        financialGoals: bp.financialGoals,
        goalProgress,
        milestonesTotal: milestones.length,
        milestonesCompleted: completedCount,
        activeMilestones: activeMilestones.slice(0, 6),
      };
    }

    // Pending milestones not yet announced (heuristic: planned + autoGenerated false or recent)
    const suggestedAnnouncements = (businessPlan?.activeMilestones || []).slice(0, 3);

    res.json({
      success: true,
      artistName: artistRow[0]?.artistName || artistRow[0]?.displayName || 'Artist',
      tokens: enrichedTokens,
      tokenSummary: {
        totalTokens: enrichedTokens.length,
        totalHolders: enrichedTokens.reduce((s, t) => s + t.holders, 0),
        totalSupply: enrichedTokens.reduce((s, t) => s + (Number(t.totalSupply) || 0), 0),
        totalSold: enrichedTokens.reduce((s, t) => s + t.soldAmount, 0),
      },
      businessPlan,
      suggestedAnnouncements,
      community: {
        totalMembers: Number(membersAgg[0]?.count) || 0,
      },
    });
  } catch (error: any) {
    console.warn('[crypto-community/overview] fallback:', error?.message || error);
    res.json({
      success: true,
      artistName: 'Artist',
      tokens: [],
      tokenSummary: {
        totalTokens: 0,
        totalHolders: 0,
        totalSupply: 0,
        totalSold: 0,
      },
      businessPlan: null,
      suggestedAnnouncements: [],
      community: { totalMembers: 0 },
    });
  }
});

// ── Convert a business-plan milestone into a community announcement post ──
router.post('/:artistId/announce-milestone', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const { milestoneTitle, milestoneDescription, milestoneId, generatedByAi = true } = req.body || {};
    if (!milestoneTitle) return res.status(400).json({ success: false, error: 'milestoneTitle required' });

    const agent = getCryptoCommunityAgent();
    const content = `🎯 New Milestone: ${milestoneTitle}${milestoneDescription ? `\n\n${milestoneDescription}` : ''}${milestoneId ? `\n\nRoadmap ID: ${milestoneId}` : ''}`;

    const result = await agent.createPost(artistId, {
      postType: 'milestone',
      content,
      channels: { telegram: true, discord: true, twitter: true },
      generatedByAi,
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Convert a business-plan milestone into a token-gated community proposal ──
router.post('/:artistId/milestone-to-proposal', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const { milestoneTitle, milestoneDescription, milestoneId, options, linkedTokenId, minTokensToVote } = req.body || {};
    if (!milestoneTitle) return res.status(400).json({ success: false, error: 'milestoneTitle required' });

    const agent = getCryptoCommunityAgent();
    const proposalOptions = (Array.isArray(options) && options.length >= 2)
      ? options.map((o: any, i: number) => ({ id: i + 1, label: String(o.label || o), votes: 0 }))
      : [
          { id: 1, label: 'Approve & prioritize', votes: 0 },
          { id: 2, label: 'Delay / re-evaluate', votes: 0 },
          { id: 3, label: 'Reject', votes: 0 },
        ];

    const proposal = await agent.createProposal(artistId, {
      title: milestoneTitle,
      description: milestoneDescription || `Community vote on roadmap milestone "${milestoneTitle}"${milestoneId ? ` (${milestoneId})` : ''}`,
      proposalType: 'roadmap',
      options: proposalOptions,
      minTokensToVote: minTokensToVote || '1',
      linkedTokenId,
    });

    res.json({ success: true, proposal });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Members ──

router.get('/:artistId/members', async (req, res) => {
  try {
    const agent = getCryptoCommunityAgent();
    const limit = Number(req.query.limit) || 50;
    const members = await agent.getMembers(Number(req.params.artistId), limit);
    res.json({ success: true, members });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════════════════════
//  OUTREACH — Apify Scraping + AI Post Generation + Campaigns
// ════════════════════════════════════════════════════════════════

// ── Scrape Audience ──

router.post('/:artistId/outreach/scrape', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const { platforms, keywords, hashtags, targetAccounts, maxPerPlatform } = req.body;

    if (!platforms?.length) {
      return res.status(400).json({ success: false, error: 'platforms array required (instagram, twitter, tiktok)' });
    }

    const scraper = getCryptoAudienceScraper();
    const results = await scraper.scrapeAudience(artistId, {
      platforms,
      keywords,
      hashtags,
      targetAccounts,
      maxPerPlatform: maxPerPlatform || 100,
    });

    res.json({ success: true, results });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Contacts ──

router.get('/:artistId/outreach/contacts', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const scraper = getCryptoAudienceScraper();

    const contacts = await scraper.getContacts(artistId, {
      platform: req.query.platform as string,
      audienceType: req.query.audienceType as string,
      outreachStatus: req.query.outreachStatus as string,
      minFollowers: req.query.minFollowers ? Number(req.query.minFollowers) : undefined,
      maxFollowers: req.query.maxFollowers ? Number(req.query.maxFollowers) : undefined,
      limit: Number(req.query.limit) || 50,
      offset: Number(req.query.offset) || 0,
    });

    res.json({ success: true, contacts, count: contacts.length });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Outreach Stats ──

router.get('/:artistId/outreach/stats', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const scraper = getCryptoAudienceScraper();
    const contactStats = await scraper.getStats(artistId);

    // Campaign stats
    const campaigns = await db.select()
      .from(cryptoOutreachCampaigns)
      .where(eq(cryptoOutreachCampaigns.artistId, artistId));

    const campaignStats = {
      total: campaigns.length,
      active: campaigns.filter(c => c.status === 'active').length,
      totalSent: campaigns.reduce((sum, c) => sum + (c.totalSent || 0), 0),
      totalReplied: campaigns.reduce((sum, c) => sum + (c.totalReplied || 0), 0),
    };

    res.json({ success: true, contacts: contactStats, campaigns: campaignStats });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── AI Post Generation ──

router.post('/:artistId/outreach/generate-post', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const { campaignType, platform, contactName, contactBio, contactTags, customContext, lang } = req.body;

    if (!platform) {
      return res.status(400).json({ success: false, error: 'platform required' });
    }

    const artistContext = await loadArtistContext(artistId);
    const post = await generateOutreachPost({
      artistContext,
      campaignType: campaignType || 'general',
      platform,
      contactName,
      contactBio,
      contactTags,
      customContext,
      lang: lang || 'en',
    });

    res.json({ success: true, post });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Campaigns CRUD ──

router.get('/:artistId/outreach/campaigns', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const campaigns = await db.select()
      .from(cryptoOutreachCampaigns)
      .where(eq(cryptoOutreachCampaigns.artistId, artistId))
      .orderBy(desc(cryptoOutreachCampaigns.createdAt));

    res.json({ success: true, campaigns });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/:artistId/outreach/campaigns', async (req, res) => {
  try {
    const artistId = Number(req.params.artistId);
    const {
      name, campaignType, platform, targetPlatforms, targetTags,
      targetMinFollowers, targetMaxFollowers, targetAudienceTypes,
      dailyLimit, customContext, lang, linkedTokenId,
    } = req.body;

    if (!name || !campaignType) {
      return res.status(400).json({ success: false, error: 'name and campaignType required' });
    }

    // Generate AI template for the campaign
    const messageTemplate = await generateCampaignTemplate(
      artistId,
      campaignType,
      platform || 'instagram',
      customContext,
      lang || 'en',
    );

    const [campaign] = await db.insert(cryptoOutreachCampaigns).values({
      artistId,
      name,
      campaignType,
      messageTemplate,
      targetPlatforms: targetPlatforms || [platform || 'instagram'],
      targetTags: targetTags || [],
      targetMinFollowers: targetMinFollowers || 0,
      targetMaxFollowers: targetMaxFollowers || 0,
      targetAudienceTypes: targetAudienceTypes || [],
      dailyLimit: dailyLimit || 20,
      status: 'draft',
      linkedTokenId: linkedTokenId || null,
    }).returning();

    res.json({ success: true, campaign });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/:artistId/outreach/campaigns/:campaignId', async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    const { status, name, messageTemplate, dailyLimit } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (name) updates.name = name;
    if (messageTemplate) updates.messageTemplate = messageTemplate;
    if (dailyLimit !== undefined) updates.dailyLimit = dailyLimit;

    const [updated] = await db.update(cryptoOutreachCampaigns)
      .set(updates)
      .where(eq(cryptoOutreachCampaigns.id, campaignId))
      .returning();

    res.json({ success: true, campaign: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Campaign Execution ──

router.post('/:artistId/outreach/campaigns/:campaignId/send', async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    const batchSize = Number(req.body.batchSize) || 20;

    const result = await executeCampaignBatch(campaignId, batchSize);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── Campaign Logs ──

router.get('/:artistId/outreach/campaigns/:campaignId/logs', async (req, res) => {
  try {
    const campaignId = Number(req.params.campaignId);
    const logs = await db.select()
      .from(cryptoOutreachLog)
      .where(eq(cryptoOutreachLog.campaignId, campaignId))
      .orderBy(desc(cryptoOutreachLog.sentAt))
      .limit(Number(req.query.limit) || 50);

    res.json({ success: true, logs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
